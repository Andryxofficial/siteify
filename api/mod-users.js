import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
} from './_modAuth.js';

/**
 * mod-users.js — Lista moderatori, VIP ed editor del canale.
 *
 * GET  /api/mod-users?type=mods|vips|subs  → lista
 * POST /api/mod-users  { action, role, login | user_id }
 *      action: 'add' | 'remove'
 *      role:   'mod' | 'vip'
 *
 * Cache Redis 5 min per tipo (invalidata su modifica).
 */

const CACHE_TTL = 300;
const CACHE_KEYS = {
  mods: 'mod:users:cache:mods',
  vips: 'mod:users:cache:vips',
  subs: 'mod:users:cache:subs',
};

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });

  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(200).json({ users: [], type: req.query?.type || 'mods' });

  /* ─── GET: lista ─── */
  if (req.method === 'GET') {
    const type = req.query?.type || 'mods';
    const cacheKey = CACHE_KEYS[type] || `mod:users:cache:${type}`;

    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);

    try {
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

  /* ─── POST: add/remove mod o VIP (richiede broadcaster) ─── */
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action, role } = body;
    if (!['add', 'remove'].includes(action)) return res.status(400).json({ error: 'action deve essere add o remove.' });
    if (!['mod', 'vip'].includes(role))      return res.status(400).json({ error: 'role deve essere mod o vip.' });

    try {
      // Risolvi l'user_id dal login se necessario
      let userId = body.user_id;
      if (!userId && body.login) {
        const data = await helixGet('users', { login: String(body.login).toLowerCase() }, twitchUser.token, twitchUser.clientId);
        userId = data.data?.[0]?.id;
        if (!userId) return res.status(404).json({ error: 'Utente non trovato.' });
      }
      if (!userId) return res.status(400).json({ error: 'login o user_id obbligatorio.' });

      const path = role === 'mod' ? 'moderation/moderators' : 'channels/vips';
      const method = action === 'add' ? 'POST' : 'DELETE';
      await helixRequest(method,
        `${path}?broadcaster_id=${broadcasterId}&user_id=${userId}`,
        null, twitchUser.token, twitchUser.clientId);

      // Invalida le cache rilevanti
      const tipoCache = role === 'mod' ? 'mods' : 'vips';
      await redis.del(CACHE_KEYS[tipoCache]).catch(() => null);

      return res.status(200).json({ ok: true, action, role, user_id: userId });
    } catch (e) {
      console.error('mod-users POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
