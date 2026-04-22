/**
 * _botHelix.js — Helper per invio messaggi via Twitch Helix API e gestione token bot.
 *
 * Strategia di invio messaggi (ordine di priorità):
 *   1. Se in Redis è presente il token OAuth del broadcaster (mod:broadcaster:token,
 *      persistito da api/_modAuth.js) E quel token include lo scope user:write:chat,
 *      il messaggio viene inviato come BROADCASTER (sender_id = broadcaster_id).
 *      Questa è la modalità raccomandata: nessun account bot separato necessario.
 *   2. Altrimenti, fallback sul vecchio account bot dedicato (bot:token:access).
 *
 * Funzioni esportate:
 *   refreshBotToken(redis)         → rinnova access token del bot dedicato
 *   ottieniTokenBot(redis)         → token bot dedicato (rinnova se in scadenza)
 *   ottieniAppToken(redis)         → app access token (client credentials) per EventSub
 *   inviaMessaggioChat(redis, broadcasterId, testo) → POST Helix con fallback auto
 *   aggiungiLog(redis, tipo, msg)  → appende voce al log bot (ultimi 50)
 */

import { getBroadcasterToken } from './_modAuth.js';

const HELIX_CHAT_URL = 'https://api.twitch.tv/helix/chat/messages';
const HELIX_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

const BOT_TOKEN_KEY     = 'bot:token:access';
const BOT_REFRESH_KEY   = 'bot:token:refresh';
const BOT_EXPIRES_KEY   = 'bot:token:expires_at';
const BOT_USER_ID_KEY   = 'bot:user:id';
const APP_TOKEN_KEY     = 'bot:app:token:access';
const APP_TOKEN_EXP_KEY = 'bot:app:token:expires_at';

/** Rinnova l'access token del bot usando il refresh token salvato in Redis. */
export async function refreshBotToken(redis) {
  const refreshToken = await redis.get(BOT_REFRESH_KEY);
  if (!refreshToken) throw new Error('Nessun refresh token trovato. Autorizza prima il bot tramite il Mod Panel.');

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CHIAVETWITCH_CLIENT_ID / CHIAVETWITCH_CLIENT_SECRET non configurati.');
  }

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'refresh_token',
    refresh_token: String(refreshToken),
  });

  const res = await fetch(HELIX_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Refresh token bot fallito: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const scadeAt = Date.now() + (data.expires_in || 14400) * 1000;

  await Promise.all([
    redis.set(BOT_TOKEN_KEY,   data.access_token),
    redis.set(BOT_REFRESH_KEY, data.refresh_token),
    redis.set(BOT_EXPIRES_KEY, String(scadeAt)),
  ]);

  return data.access_token;
}

/**
 * Ottieni il token del bot da Redis.
 * Se scade entro 5 minuti, rinnova automaticamente.
 */
export async function ottieniTokenBot(redis) {
  const [token, scadeAtRaw] = await Promise.all([
    redis.get(BOT_TOKEN_KEY),
    redis.get(BOT_EXPIRES_KEY),
  ]);

  if (!token) throw new Error('Token bot non trovato. Autorizza il bot dal Mod Panel → Bot 24/7.');

  const scadeAt = scadeAtRaw ? Number(scadeAtRaw) : 0;
  if (scadeAt - Date.now() < 5 * 60 * 1000) {
    return refreshBotToken(redis);
  }

  return String(token);
}

/**
 * Ottieni un app access token (client credentials).
 * Usato per creare/gestire le sottoscrizioni EventSub.
 */
export async function ottieniAppToken(redis) {
  const [token, scadeAtRaw] = await Promise.all([
    redis.get(APP_TOKEN_KEY),
    redis.get(APP_TOKEN_EXP_KEY),
  ]);

  const scadeAt = scadeAtRaw ? Number(scadeAtRaw) : 0;
  if (token && scadeAt - Date.now() > 5 * 60 * 1000) {
    return String(token);
  }

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CHIAVETWITCH_CLIENT_ID / CHIAVETWITCH_CLIENT_SECRET non configurati.');
  }

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'client_credentials',
  });

  const res = await fetch(HELIX_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`App token fallito: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const nuovaScadenza = Date.now() + (data.expires_in || 14400) * 1000;

  await Promise.all([
    redis.set(APP_TOKEN_KEY,     data.access_token),
    redis.set(APP_TOKEN_EXP_KEY, String(nuovaScadenza)),
  ]);

  return data.access_token;
}

/**
 * Invia un messaggio nella chat Twitch tramite Helix API.
 *
 * Modalità:
 *   A. BROADCASTER (preferita): se in Redis è presente il token OAuth del broadcaster
 *      con scope `user:write:chat`, viene usato quello e il messaggio appare scritto
 *      direttamente dall'account dello streamer. Nessun account bot separato richiesto.
 *   B. BOT DEDICATO (fallback): se manca il token broadcaster o lo scope, ripiega
 *      sul vecchio flow `bot:token:access` (account bot autorizzato dal Mod Panel).
 *
 * Auto-rinnova il token bot se riceve 401 (in modalità B).
 *
 * @param {object} redis          - istanza @upstash/redis
 * @param {string} broadcasterId  - user_id del broadcaster (canale destinazione)
 * @param {string} testo          - testo del messaggio (max 500 caratteri)
 */
export async function inviaMessaggioChat(redis, broadcasterId, testo) {
  const clientId = process.env.CHIAVETWITCH_CLIENT_ID;
  if (!clientId) throw new Error('CHIAVETWITCH_CLIENT_ID non configurato.');

  /* ─── A. Tenta invio come BROADCASTER (preferito) ─── */
  // Il token broadcaster è persistito in Redis ogni volta che lo streamer apre
  // il Mod Panel (api/_modAuth.js → maybePersistBroadcasterToken).
  try {
    const broadcaster = await getBroadcasterToken(redis);
    if (broadcaster?.token && Array.isArray(broadcaster.scopes) &&
        broadcaster.scopes.includes('user:write:chat')) {
      const senderId = broadcaster.userId || String(broadcasterId);
      const r = await fetch(HELIX_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${broadcaster.token}`,
          'Client-Id':    broadcaster.clientId || clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          broadcaster_id: String(broadcasterId),
          sender_id:      String(senderId),
          message:        testo.slice(0, 500),
        }),
      });
      if (r.ok) return r.json();
      // 401 con broadcaster token: lascia che il fallback gestisca o termina.
      // Se non c'è bot dedicato, alza l'errore originale.
      if (r.status !== 401) {
        const errText = await r.text();
        // Non c'è retry su altri errori — ritorna l'errore "broadcaster"
        // tranne quando un bot dedicato è disponibile, sotto.
        const botEsiste = await redis.exists('bot:token:access');
        if (!botEsiste) {
          throw new Error(`Invio messaggio (broadcaster) fallito: ${r.status} — ${errText}`);
        }
      }
    }
  } catch (e) {
    // Errore lettura broadcaster token o invio: prosegui con fallback bot.
    if (e?.message?.startsWith('Invio messaggio (broadcaster) fallito')) throw e;
  }

  /* ─── B. Fallback: invio come ACCOUNT BOT DEDICATO ─── */
  const botUserId = await redis.get(BOT_USER_ID_KEY);
  if (!botUserId) {
    throw new Error('Nessun token broadcaster con scope user:write:chat e nessun account bot configurato. Riautentica dal Mod Panel per concedere il permesso "Scrivere in chat".');
  }

  async function tentaInvio(token) {
    return fetch(HELIX_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Client-Id':    clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        broadcaster_id: String(broadcasterId),
        sender_id:      String(botUserId),
        message:        testo.slice(0, 500),
      }),
    });
  }

  let token = await ottieniTokenBot(redis);
  let res   = await tentaInvio(token);

  // Token scaduto: forza rinnovo e riprova
  if (res.status === 401) {
    token = await refreshBotToken(redis);
    res   = await tentaInvio(token);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Invio messaggio fallito: ${res.status} — ${errText}`);
  }

  return res.json();
}

/**
 * Aggiunge una voce al log del bot in Redis.
 * La lista è mantenuta agli ultimi 50 elementi.
 */
export async function aggiungiLog(redis, tipo, messaggio) {
  const entry = JSON.stringify({ tipo, messaggio, ts: new Date().toISOString() });
  await redis.rpush('bot:log', entry);
  await redis.ltrim('bot:log', -50, -1);
}
