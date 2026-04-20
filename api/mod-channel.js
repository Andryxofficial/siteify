import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, getBroadcasterUsername,
  helixGet, helixRequest,
} from './_modAuth.js';

/**
 * mod-channel.js — Stato e gestione del canale Twitch.
 *
 * GET  /api/mod-channel          → info live + canale + broadcaster
 * PATCH /api/mod-channel         → aggiorna titolo e/o categoria
 * GET  /api/mod-channel?action=search_categories&q=<query>
 *                                → ricerca categorie (search-as-you-type)
 */

const CACHE_KEY   = 'mod:channel:cache';
const CACHE_TTL   = 30; // 30 secondi

export default async function handler(req, res) {
  corsHeaders(res, 'GET, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });

  /* ─── RICERCA CATEGORIE ─── */
  if (req.method === 'GET' && req.query?.action === 'search_categories') {
    const q = (req.query.q || '').trim().slice(0, 80);
    if (!q) return res.status(200).json({ categories: [] });
    try {
      const data = await helixGet('search/categories', { query: q, first: 8 }, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ categories: (data.data || []).map(c => ({ id: c.id, name: c.name, box_art_url: c.box_art_url })) });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── GET: stato canale ─── */
  if (req.method === 'GET') {
    // Controlla cache Redis
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);

    try {
      const broadcaster = await getBroadcasterUsername(redis);
      const broadcasterId = await getBroadcasterId(redis);

      if (!broadcasterId) {
        return res.status(200).json({ live: false, broadcaster: broadcaster || twitchUser.login, error: 'ID broadcaster non disponibile.' });
      }

      const [streamData, channelData, userInfoData] = await Promise.allSettled([
        helixGet('streams', { user_id: broadcasterId, first: 1 }, twitchUser.token, twitchUser.clientId),
        helixGet('channels', { broadcaster_id: broadcasterId }, twitchUser.token, twitchUser.clientId),
        helixGet('users', { id: broadcasterId }, twitchUser.token, twitchUser.clientId),
      ]);

      const stream  = streamData.status  === 'fulfilled' ? streamData.value?.data?.[0]  || null : null;
      const channel = channelData.status === 'fulfilled' ? channelData.value?.data?.[0] || null : null;
      const userInfo = userInfoData.status === 'fulfilled' ? userInfoData.value?.data?.[0] || null : null;

      const result = {
        live:            !!stream,
        broadcaster:     broadcaster || twitchUser.login,
        broadcasterId,
        viewerCount:     stream?.viewer_count      ?? 0,
        startedAt:       stream?.started_at        ?? null,
        title:           channel?.title            ?? stream?.title ?? '',
        gameName:        channel?.game_name        ?? stream?.game_name ?? '',
        gameId:          channel?.game_id          ?? stream?.game_id ?? '',
        thumbnailUrl:    stream?.thumbnail_url
          ? stream.thumbnail_url.replace('{width}', '520').replace('{height}', '292')
          : null,
        language:        channel?.broadcaster_language ?? null,
        tags:            channel?.tags ?? [],
        isMature:        channel?.is_branded_content ?? false,
        avatar:          userInfo?.profile_image_url ?? null,
        displayName:     userInfo?.display_name      ?? broadcaster,
        description:     userInfo?.description       ?? '',
        viewTotal:       userInfo?.view_count         ?? 0,
        createdAt:       userInfo?.created_at         ?? null,
      };

      // Salva in cache 30s
      await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL });
      return res.status(200).json(result);
    } catch (e) {
      console.error('mod-channel GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── PATCH: aggiorna titolo/categoria ─── */
  if (req.method === 'PATCH') {
    try {
      const broadcasterId = await getBroadcasterId(redis);
      if (!broadcasterId) return res.status(400).json({ error: 'ID broadcaster non disponibile.' });

      const body = req.body || {};
      const patchBody = {};
      if (typeof body.title    === 'string') patchBody.title    = body.title.trim().slice(0, 140);
      if (typeof body.game_id  === 'string') patchBody.game_id  = body.game_id;
      if (!Object.keys(patchBody).length)   return res.status(400).json({ error: 'Nessun campo da aggiornare.' });

      const url = `channels?broadcaster_id=${broadcasterId}`;
      await helixRequest('PATCH', url, patchBody, twitchUser.token, twitchUser.clientId);

      // Invalida cache
      await redis.del(CACHE_KEY).catch(() => null);
      return res.status(200).json({ ok: true, updated: patchBody });
    } catch (e) {
      console.error('mod-channel PATCH error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
