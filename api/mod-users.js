import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet,
} from './_modAuth.js';

/**
 * mod-users.js — Lista moderatori, VIP ed editor del canale.
 *
 * GET /api/mod-users?type=mods|vips|subs
 *
 * Cache Redis 5 min per tipo.
 */

const CACHE_TTL = 300;

export default async function handler(req, res) {
  corsHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non supportato.' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });

  const type = req.query?.type || 'mods';
  const cacheKey = `mod:users:cache:${type}`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);

  try {
    const broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) return res.status(200).json({ users: [], type });

    let users = [];
    if (type === 'mods') {
      const data = await helixGet('moderation/moderators', { broadcaster_id: broadcasterId, first: 100 }, twitchUser.token, twitchUser.clientId);
      users = (data.data || []).map(m => ({ user_id: m.user_id, user_name: m.user_name, user_login: m.user_login }));
    } else if (type === 'vips') {
      const data = await helixGet('channels/vips', { broadcaster_id: broadcasterId, first: 100 }, twitchUser.token, twitchUser.clientId);
      users = (data.data || []).map(v => ({ user_id: v.user_id, user_name: v.user_name, user_login: v.user_login }));
    } else if (type === 'subs') {
      const data = await helixGet('subscriptions', { broadcaster_id: broadcasterId, first: 100 }, twitchUser.token, twitchUser.clientId);
      users = (data.data || []).map(s => ({
        user_id:   s.user_id,
        user_name: s.user_name,
        user_login: s.user_login,
        tier:      s.tier,
        is_gift:   s.is_gift,
      }));
    }

    const result = { users, type };
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    return res.status(200).json(result);
  } catch (e) {
    console.error('mod-users GET error:', e);
    return res.status(500).json({ error: e.message });
  }
}
