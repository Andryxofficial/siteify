import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId,
  pickHelixAuth, broadcasterTokenMissing, helixGet, sendHelixError,
} from './_modAuth.js';

/**
 * mod-goals.js — Goals, Hype Train e Charity.
 *
 * GET /api/mod-goals?type=goals      → channel goals (read)
 * GET /api/mod-goals?type=hype_train → ultimi eventi hype train
 * GET /api/mod-goals?type=charity    → charity campaign attiva
 *
 * Tutti questi endpoint richiedono il TOKEN BROADCASTER (channel-scoped):
 *   - goals       → scope `channel:read:goals`
 *   - hype_train  → scope `channel:read:hype_train`
 *   - charity     → scope `channel:read:charity`
 *
 * Se il broadcaster non ha mai aperto il pannello (token non persistito) →
 * 503 broadcaster_token_missing.
 */

const CACHE_TTL = 60;

export default async function handler(req, res) {
  corsHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non supportato.' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ code: 'unauthenticated', error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ code: 'not_mod', error: 'Accesso riservato ai moderatori.' });

  const type = req.query?.type || 'goals';
  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(503).json({ code: 'broadcaster_id_missing', error: 'Broadcaster ID non disponibile.' });

  // Cache key by type
  const cacheKey = `mod:goals:cache:${type}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    return res.status(200).json({ ...(typeof cached === 'string' ? JSON.parse(cached) : cached), fromCache: true });
  }

  // Scelta token + scope richiesto
  const SCOPE_MAP = {
    goals:      'channel:read:goals',
    hype_train: 'channel:read:hype_train',
    charity:    'channel:read:charity',
  };
  const requiredScope = SCOPE_MAP[type];
  if (!requiredScope) return res.status(400).json({ error: 'type non valido. Usa goals|hype_train|charity.' });

  const auth = await pickHelixAuth({
    twitchUser, redis,
    requireBroadcaster: true,
    requireScopes: [requiredScope],
  });
  if (!auth) return broadcasterTokenMissing(res);
  if (auth.missingScopes?.length) {
    return res.status(403).json({
      code: 'scope_missing',
      tokenSource: auth.source,
      requiredScopes: auth.missingScopes,
      error: `Il token broadcaster non ha lo scope ${auth.missingScopes.join(', ')}. Riautentica come broadcaster.`,
    });
  }

  try {
    let payload;

    if (type === 'goals') {
      const data = await helixGet('goals', { broadcaster_id: broadcasterId }, auth.token, auth.clientId);
      payload = { goals: data.data || [] };
    } else if (type === 'hype_train') {
      const data = await helixGet('hypetrain/events', { broadcaster_id: broadcasterId, first: 5 }, auth.token, auth.clientId);
      payload = { events: data.data || [] };
    } else if (type === 'charity') {
      // GET /helix/charity/campaigns ritorna 0 o 1 campagna attiva
      const camp = await helixGet('charity/campaigns', { broadcaster_id: broadcasterId }, auth.token, auth.clientId);
      const c = camp.data?.[0] || null;
      let donations = [];
      if (c) {
        try {
          const don = await helixGet('charity/donations', { broadcaster_id: broadcasterId, first: 20 }, auth.token, auth.clientId);
          donations = don.data || [];
        } catch { /* tollera errori sulle donations */ }
      }
      payload = { campaign: c, donations };
    }

    try { await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }); } catch { /* */ }
    return res.status(200).json({ ...payload, fromCache: false });
  } catch (e) {
    return sendHelixError(res, e, `leggere ${type}`);
  }
}
