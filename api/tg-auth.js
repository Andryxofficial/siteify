import { Redis } from '@upstash/redis';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * tg-auth.js — Validazione Telegram Mini App initData
 *
 * POST /api/tg-auth
 *   Body: { initData: string }     (la stringa raw da window.Telegram.WebApp.initData)
 *   Risposta: { ok: true, user: { id, firstName, lastName, username, languageCode, isPremium } }
 *             oppure { ok: false, error: string }
 *
 * La firma HMAC-SHA256 è verificata secondo la specifica Telegram:
 *   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Il token salvato in Redis (tg:auth:<userId>) funge da sessione temporanea
 * per ridurre le verifiche ripetute (TTL 1 ora).
 */

const AUTH_CACHE_TTL = 3600; // 1 ora

/** Verifica la firma HMAC dell'initData Telegram. */
function verificaInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Costruisce la data-check string: coppie key=value ordinate, senza hash
  const entries = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hash') entries.push(`${k}=${v}`);
  }
  entries.sort();
  const dataCheckString = entries.join('\n');

  // Chiave segreta = HMAC-SHA256("WebAppData", botToken)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Hash calcolato = HMAC-SHA256(dataCheckString, secretKey)
  const calcolato = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Confronto sicuro contro timing attack
  try {
    const hashBuf  = Buffer.from(hash, 'hex');
    const calcBuf  = Buffer.from(calcolato, 'hex');
    if (hashBuf.length !== calcBuf.length) return null;
    if (!timingSafeEqual(hashBuf, calcBuf)) return null;
  } catch {
    return null;
  }

  // Controlla la freschezza: auth_date non deve essere più vecchio di 10 minuti
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const adesso = Math.floor(Date.now() / 1000);
  if (!authDate || adesso - authDate > 600) return null;

  // Estrai dati utente
  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const u = JSON.parse(userRaw);
    return {
      id:           u.id,
      firstName:    u.first_name  || '',
      lastName:     u.last_name   || '',
      username:     u.username    || null,
      languageCode: u.language_code || 'it',
      isPremium:    u.is_premium  || false,
      photoUrl:     u.photo_url   || null,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo non consentito.' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ ok: false, error: 'Bot Telegram non configurato.' });
  }

  const { initData } = req.body || {};
  if (!initData || typeof initData !== 'string' || initData.length > 4096) {
    return res.status(400).json({ ok: false, error: 'initData mancante o non valido.' });
  }

  const utente = verificaInitData(initData, botToken);
  if (!utente) {
    return res.status(401).json({ ok: false, error: 'Firma initData non valida o scaduta.' });
  }

  // Opzionale: cachea in Redis per un'ora così non ripetiamo la crypto ogni req
  try {
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (kvUrl && kvToken) {
      const redis = new Redis({ url: kvUrl, token: kvToken });
      await redis.set(`tg:auth:${utente.id}`, JSON.stringify(utente), { ex: AUTH_CACHE_TTL });
    }
  } catch { /* non bloccante */ }

  return res.status(200).json({ ok: true, user: utente });
}
