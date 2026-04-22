import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet,
  pickHelixAuth,
} from './_modAuth.js';

/**
 * mod-events.js — Feed eventi recenti del canale.
 *
 * GET /api/mod-events → ultimi follower + subscriber, cachati 60s in Redis.
 *
 * Redis:
 *   mod:events:cache → JSON string con TTL 60s
 */

const CACHE_KEY = 'mod:events:cache';
const CACHE_TTL = 60;

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

  // Cache Redis
  const cached = await redis.get(CACHE_KEY).catch(() => null);
  if (cached) return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);

  try {
    const broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) return res.status(200).json({ followers: [], subscriptions: [] });

    // /channels/followers funziona col token del moderatore se gli passiamo
    // moderator_id (scope moderator:read:followers, di norma incluso nel
    // login mod-panel). Le subscriptions invece richiedono il token del
    // broadcaster (channel:read:subscriptions).
    const broadcasterAuth = await pickHelixAuth({ twitchUser, redis, requireBroadcaster: true });

    const followersParams = { broadcaster_id: broadcasterId, first: 20 };
    if (twitchUser.userId) followersParams.moderator_id = twitchUser.userId;

    const [followersRes, subsRes] = await Promise.allSettled([
      helixGet('channels/followers', followersParams, twitchUser.token, twitchUser.clientId),
      // Se il token broadcaster non è ancora persistito, saltiamo le sub:
      // ritorniamo lista vuota ma la pagina continua a funzionare.
      broadcasterAuth
        ? helixGet('subscriptions', { broadcaster_id: broadcasterId, first: 10 }, broadcasterAuth.token, broadcasterAuth.clientId)
        : Promise.resolve(null),
    ]);

    const followers = followersRes.status === 'fulfilled'
      ? (followersRes.value?.data || []).map(f => ({
          user_id:    f.user_id,
          user_name:  f.user_name,
          user_login: f.user_login,
          followed_at: f.followed_at,
          type: 'follow',
        }))
      : [];

    const subscriptions = subsRes.status === 'fulfilled' && subsRes.value
      ? (subsRes.value?.data || []).map(s => ({
          user_id:    s.user_id,
          user_name:  s.user_name,
          user_login: s.user_login,
          tier:       s.tier, // 1000/2000/3000
          is_gift:    s.is_gift,
          subscribed_at: s.subscribed_at ?? null,
          type: 'sub',
        }))
      : [];

    const totalFollowers = followersRes.status === 'fulfilled'
      ? (followersRes.value?.total ?? 0)
      : null;
    const totalSubs = subsRes.status === 'fulfilled' && subsRes.value
      ? (subsRes.value?.total ?? 0)
      : null;

    const result = { followers, subscriptions, totalFollowers, totalSubs };
    await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL });
    return res.status(200).json(result);
  } catch (e) {
    console.error('mod-events GET error:', e);
    return res.status(500).json({ error: e.message });
  }
}
