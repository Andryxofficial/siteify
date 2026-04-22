import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, sendHelixError, scopeMissing,
} from './_modAuth.js';

/**
 * mod-chatters.js — Lista utenti attualmente in chat.
 *
 * GET /api/mod-chatters
 *   → { count, total, chatters: [{ user_id, user_login, user_name }] }
 *
 * Helix `GET /helix/chat/chatters` richiede:
 *   - scope `moderator:read:chatters` sul mod o broadcaster
 *   - param `broadcaster_id` + `moderator_id` (token usato deve appartenere a quel mod)
 *
 * Cache Redis 30s per evitare di battere Helix ad ogni refresh dell'UI
 * (Twitch rate-limit per token: 800 req/minuto).
 */

const CACHE_KEY = 'mod:chatters:cache';
const CACHE_TTL = 30;
const MAX_PAGES = 5;       // 5 pagine × 1000 = max 5000 chatters letti
const PAGE_SIZE = 1000;

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
  if (!twitchUser.scopes.includes('moderator:read:chatters')) {
    return scopeMissing(res, ['moderator:read:chatters'], 'mod');
  }

  // Cache (skippata se ?fresh=1)
  if (!req.query?.fresh) {
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.status(200).json({ ...parsed, fromCache: true });
    }
  }

  try {
    const broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) return res.status(503).json({ code: 'broadcaster_id_missing', error: 'Broadcaster ID non disponibile.' });

    const all = [];
    let cursor = null;
    let total = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = {
        broadcaster_id: broadcasterId,
        moderator_id:   twitchUser.userId,
        first:          PAGE_SIZE,
      };
      if (cursor) params.after = cursor;
      const data = await helixGet('chat/chatters', params, twitchUser.token, twitchUser.clientId);
      const list = data.data || [];
      total = data.total || (total || 0) + list.length;
      all.push(...list);
      cursor = data.pagination?.cursor;
      if (!cursor || list.length < PAGE_SIZE) break;
    }

    // Restituisci almeno login normalizzato a minuscolo per match facile
    const chatters = all.map(c => ({
      user_id:    c.user_id,
      user_login: (c.user_login || '').toLowerCase(),
      user_name:  c.user_name,
    }));

    const payload = {
      count: chatters.length,
      total,
      chatters,
      ts: Date.now(),
    };

    try { await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL }); } catch { /* */ }
    return res.status(200).json({ ...payload, fromCache: false });
  } catch (e) {
    return sendHelixError(res, e, 'leggere i chatters');
  }
}
