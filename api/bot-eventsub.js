/**
 * bot-eventsub.js — Ricevitore webhook EventSub di Twitch.
 *
 * POST /api/bot-eventsub
 *
 * Gestisce i tre tipi di messaggio EventSub:
 *   webhook_callback_verification → risponde con il challenge (handshake iniziale)
 *   notification                  → evento reale (messaggio chat, follow, sub, ecc.)
 *   revocation                    → la sottoscrizione è stata revocata da Twitch
 *
 * Sicurezza:
 *   - Verifica firma HMAC-SHA256 (Twitch-Eventsub-Message-Signature) su ogni richiesta
 *   - Controllo timestamp (rifiuta messaggi più vecchi di 10 minuti)
 *   - Deduplicazione via Twitch-Eventsub-Message-Id (TTL 10 min in Redis)
 *
 * Il bodyParser di Vercel è disabilitato: legge il raw body per la verifica HMAC.
 */

import { Redis } from '@upstash/redis';
import { createHmac } from 'crypto';
import { eseguiComando, eseguiKeywords } from './_botLogic.js';
import { inviaMessaggioChat, aggiungiLog } from './_botHelix.js';

// Disabilita il bodyParser di Vercel per leggere il raw body (necessario per HMAC)
export const config = {
  api: { bodyParser: false },
};

const HDR_SIGNATURE  = 'twitch-eventsub-message-signature';
const HDR_TIMESTAMP  = 'twitch-eventsub-message-timestamp';
const HDR_MSG_ID     = 'twitch-eventsub-message-id';
const HDR_MSG_TYPE   = 'twitch-eventsub-message-type';
const HDR_SUB_TYPE   = 'twitch-eventsub-subscription-type';
const DEDUP_TTL      = 600; // 10 minuti

/** Legge il raw body della richiesta. */
async function leggiRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Verifica la firma HMAC-SHA256 di Twitch.
 * Confronto timing-safe per prevenire timing attacks.
 */
function verificaFirma(secret, messageId, timestamp, rawBody, signature) {
  const messaggio = messageId + timestamp + rawBody;
  const attesa    = 'sha256=' + createHmac('sha256', secret).update(messaggio).digest('hex');

  if (attesa.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < attesa.length; i++) {
    diff |= attesa.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  const secret = process.env.EVENTSUB_SECRET;
  if (!secret) return res.status(500).json({ error: 'EVENTSUB_SECRET non configurato.' });

  // Leggi il raw body prima di qualsiasi parsing
  const bodyBuffer = await leggiRawBody(req);
  const bodyString = bodyBuffer.toString('utf8');

  const messageId = req.headers[HDR_MSG_ID]    || '';
  const timestamp = req.headers[HDR_TIMESTAMP] || '';
  const signature = req.headers[HDR_SIGNATURE] || '';
  const msgType   = req.headers[HDR_MSG_TYPE]  || '';
  const subType   = req.headers[HDR_SUB_TYPE]  || '';

  // 1. Verifica firma
  if (!verificaFirma(secret, messageId, timestamp, bodyString, signature)) {
    return res.status(403).json({ error: 'Firma non valida.' });
  }

  // 2. Verifica timestamp (max 10 minuti di skew)
  const tsMs = new Date(timestamp).getTime();
  if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) {
    return res.status(403).json({ error: 'Timestamp non valido o troppo vecchio.' });
  }

  // 3. Parsing JSON
  let payload;
  try {
    payload = JSON.parse(bodyString);
  } catch {
    return res.status(400).json({ error: 'Body JSON non valido.' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  /* ── Handshake iniziale ── */
  if (msgType === 'webhook_callback_verification') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(payload.challenge);
  }

  /* ── Revoca sottoscrizione ── */
  if (msgType === 'revocation') {
    await aggiungiLog(redis, 'revoca', `Sottoscrizione ${subType} revocata da Twitch.`).catch(() => {});
    return res.status(204).end();
  }

  /* ── Notifica evento ── */
  if (msgType === 'notification') {
    // Deduplicazione: ignora lo stesso messaggio inviato più volte da Twitch
    const dedupKey = `bot:eventsub:dedup:${messageId}`;
    const giaProcesato = await redis.exists(dedupKey).catch(() => 0);
    if (giaProcesato) {
      return res.status(200).json({ ok: true, dedup: true });
    }
    // Marca come processato (TTL 10 minuti)
    await redis.set(dedupKey, '1', { ex: DEDUP_TTL }).catch(() => {});

    // Rispondi subito a Twitch (evita timeout dei retry) e processa in background
    res.status(200).json({ ok: true });

    const event = payload.event || {};
    gestisciEvento(redis, subType, event).catch(e =>
      console.error('[bot-eventsub] Errore gestione evento:', e.message)
    );

    return;
  }

  return res.status(204).end();
}

/** Dispatcher degli eventi EventSub. */
async function gestisciEvento(redis, tipo, event) {
  const broadcasterId = await redis.get('bot:broadcaster:id').catch(() => null);
  if (!broadcasterId) return;

  if (tipo === 'channel.chat.message') {
    await gestisciMessaggioChat(redis, event, String(broadcasterId));
    return;
  }

  // Messaggi automatici per altri eventi social
  const msg = messaggioEvento(tipo, event);
  if (msg) {
    await inviaMessaggioChat(redis, String(broadcasterId), msg);
    await aggiungiLog(redis, tipo, msg);
  }
}

/**
 * Gestisce un messaggio chat: cerca comandi ! e parole chiave.
 * Due passaggi distinti:
 *   1. Se inizia con !  → eseguiComando (comandi standard)
 *   2. Sempre           → eseguiKeywords (parole chiave naturali)
 */
async function gestisciMessaggioChat(redis, event, broadcasterId) {
  const testo      = event.message?.text || '';
  const userLogin  = (event.chatter_user_login || '').toLowerCase();
  const broadLogin = (event.broadcaster_user_login || '').toLowerCase();

  // Ignora i messaggi del bot stesso per evitare loop
  const botLogin = await redis.get('bot:user:login').catch(() => null);
  if (botLogin && userLogin === String(botLogin).toLowerCase()) return;

  // Determina permessi dai badge EventSub
  const badges      = event.badges || [];
  const badgeIds    = badges.map(b => b.set_id);
  const isBroadcaster = userLogin === broadLogin;
  const isMod         = badgeIds.includes('moderator') || isBroadcaster;
  const isVip         = badgeIds.includes('vip');
  const isSub         = badgeIds.includes('subscriber');
  const userPerms     = { isMod, isBroadcaster, isVip, isSub };

  const argomentiInvio = {
    userPerms,
    userLogin,
    canale: broadLogin,
    redis,
    invia: async (risposta) => {
      await inviaMessaggioChat(redis, broadcasterId, risposta);
      await aggiungiLog(redis, 'risposta', `[${userLogin}] → ${risposta.slice(0, 80)}`);
    },
  };

  // 1. Comandi con !
  if (testo.startsWith('!')) {
    const parti   = testo.slice(1).split(' ');
    const trigger = parti[0].toLowerCase();
    const args    = parti.slice(1);
    await eseguiComando({ trigger, args, ...argomentiInvio });
  }

  // 2. Parole chiave naturali (sempre, indipendentemente da !)
  await eseguiKeywords({ testo, ...argomentiInvio });
}

/** Genera un messaggio di cortesia per gli eventi social. */
function messaggioEvento(tipo, event) {
  const nome = event.user_name || event.from_broadcaster_user_name || event.gifter_user_name || '';
  switch (tipo) {
    case 'channel.follow':
      return `Benvenuto/a ${nome}! Grazie per il follow! 🎉`;
    case 'channel.subscribe':
      return `Grazie per la sub, ${nome}! 💜`;
    case 'channel.subscription.gift':
      return `${nome} ha regalato ${event.total || 1} sub! Grazie mille! 🎁`;
    case 'channel.cheer':
      return `Grazie per i ${event.bits} bit, ${nome}! ⭐`;
    case 'channel.raid':
      return `Raid da ${nome} con ${event.viewers} persone! Benvenuti tutti! 🚀`;
    case 'stream.online':
    case 'stream.offline':
      return null; // nessun messaggio automatico per questi eventi
    default:
      return null;
  }
}
