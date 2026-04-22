import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, sendHelixError,
} from './_modAuth.js';

/**
 * mod-eventsub.js — EventSub Console.
 *
 * GET  /api/mod-eventsub                   → lista subscription EventSub attive (App-Access-Token)
 * GET  /api/mod-eventsub?action=log&n=50   → ultimi N eventi ricevuti dal nostro webhook
 * POST /api/mod-eventsub  { action: 'delete', id }    → cancella una subscription
 *
 * NOTE:
 *   - EventSub list/delete richiedono App Access Token (client_credentials),
 *     NON un token utente. Quindi NON serve broadcaster token; basta che il
 *     server abbia CHIAVETWITCH_CLIENT_ID/SECRET.
 *   - Il log eventi è alimentato dal nostro webhook in api/bot-eventsub.js
 *     (chiave Redis `bot:eventsub:log` lpush + ltrim a 200).
 */

const APP_TOKEN_KEY = 'mod:eventsub:app_token';
const APP_TOKEN_TTL = 60 * 60 * 12;     // 12h conservative
const EVENTSUB_LOG_KEY = 'bot:eventsub:log';

async function getAppAccessToken(redis) {
  const cached = await redis.get(APP_TOKEN_KEY).catch(() => null);
  if (cached) {
    const obj = typeof cached === 'string' ? JSON.parse(cached) : cached;
    if (obj?.token && obj?.expiresAt && obj.expiresAt > Date.now() + 60_000) {
      return { token: obj.token, clientId: obj.clientId };
    }
  }

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CHIAVETWITCH_CLIENT_ID/SECRET non configurati nel server.');
  }

  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`App-token Helix fallito: ${r.status} ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  const token = j.access_token;
  const expiresAt = Date.now() + (j.expires_in || 3600) * 1000;
  try {
    await redis.set(APP_TOKEN_KEY, JSON.stringify({ token, clientId, expiresAt }), { ex: APP_TOKEN_TTL });
  } catch { /* */ }
  return { token, clientId };
}

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ code: 'unauthenticated', error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ code: 'not_mod', error: 'Accesso riservato ai moderatori.' });

  if (req.method === 'GET') {
    const action = req.query?.action;

    /* Log eventi recenti dal webhook */
    if (action === 'log') {
      const n = Math.min(200, Math.max(1, parseInt(req.query?.n) || 50));
      const list = await redis.lrange(EVENTSUB_LOG_KEY, 0, n - 1).catch(() => []);
      const items = (list || []).map(s => {
        try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
      }).filter(Boolean);
      return res.status(200).json({ items });
    }

    /* Lista subscription attive */
    try {
      const { token, clientId } = await getAppAccessToken(redis);
      const r = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return res.status(r.status).json({ code: 'helix_error', error: `Helix ${r.status}: ${t.slice(0, 200)}` });
      }
      const j = await r.json();
      return res.status(200).json({
        total:        j.total || 0,
        cost:         j.total_cost || 0,
        maxCost:      j.max_total_cost || 0,
        subscriptions: j.data || [],
      });
    } catch (e) {
      return sendHelixError(res, e, 'leggere le EventSub subscriptions');
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.action === 'delete') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id obbligatorio.' });
      try {
        const { token, clientId } = await getAppAccessToken(redis);
        const r = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
        });
        if (!r.ok && r.status !== 204) {
          const t = await r.text().catch(() => '');
          return res.status(r.status).json({ code: 'helix_error', error: `Helix ${r.status}: ${t.slice(0, 200)}` });
        }
        return res.status(200).json({ ok: true, deleted: id });
      } catch (e) {
        return sendHelixError(res, e, 'cancellare la subscription');
      }
    }
    return res.status(400).json({ error: 'action non riconosciuta.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
