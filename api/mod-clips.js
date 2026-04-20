import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet,
} from './_modAuth.js';

/**
 * mod-clips.js — Lista clip recenti del canale.
 *
 * GET /api/mod-clips?period=7|30|all → ultimi N giorni (default 7), max 30 clip
 *
 * Cache Redis 5 minuti per period.
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

  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(200).json({ clips: [] });

  const periodParam = req.query?.period === '30' ? '30'
                    : req.query?.period === 'all' ? 'all' : '7';
  const cacheKey = `mod:clips:cache:${periodParam}`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);

  try {
    const params = { broadcaster_id: broadcasterId, first: 30 };
    if (periodParam !== 'all') {
      const giorni = parseInt(periodParam);
      const start = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);
      params.started_at = start.toISOString();
      params.ended_at   = new Date().toISOString();
    }
    const data = await helixGet('clips', params, twitchUser.token, twitchUser.clientId);
    const clips = (data.data || []).map(c => ({
      id:           c.id,
      url:          c.url,
      embed_url:    c.embed_url,
      title:        c.title,
      thumbnail:    c.thumbnail_url,
      duration:     c.duration,
      view_count:   c.view_count,
      created_at:   c.created_at,
      creator_name: c.creator_name,
      game_id:      c.game_id,
    }));
    // Ordinato per views desc
    clips.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

    const result = { clips, period: periodParam };
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    return res.status(200).json(result);
  } catch (e) {
    console.error('mod-clips GET error:', e);
    return res.status(500).json({ error: e.message });
  }
}
