/**
 * bot-refresh-token.js — Cron job per rinnovare il token del bot ogni 3 ore.
 *
 * Il token Twitch (authorization_code flow) dura circa 4 ore.
 * Questo endpoint lo rinnova proattivamente per evitare interruzioni del servizio.
 *
 * GET /api/bot-refresh-token  (Vercel Cron: ogni 3 ore — "0 * /3 * * *")
 */

import { Redis } from '@upstash/redis';
import { refreshBotToken } from './_botHelix.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  const isCronVercel = req.headers['x-vercel-cron'] === '1';
  const authHeader   = req.headers.authorization;
  const iuaSecret    = process.env.IUA_SECRET;
  const isAdmin      = iuaSecret && authHeader === `Bearer ${iuaSecret}`;

  if (!isCronVercel && !isAdmin) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  // Non fare nulla se il bot non è ancora autorizzato
  const refreshEsiste = await redis.exists('bot:token:refresh').catch(() => 0);
  if (!refreshEsiste) {
    return res.status(200).json({ ok: true, saltato: 'refresh token non trovato' });
  }

  try {
    await refreshBotToken(redis);
    return res.status(200).json({ ok: true, aggiornato: true, ts: new Date().toISOString() });
  } catch (e) {
    console.error('[bot-refresh-token] Fallito:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
