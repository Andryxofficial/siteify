import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
} from './_modAuth.js';

/**
 * mod-rewards.js — Custom Channel Points rewards.
 *
 * GET    /api/mod-rewards                              → lista rewards custom
 * POST   /api/mod-rewards  { title, cost, prompt? }    → crea reward
 * PATCH  /api/mod-rewards  { id, ...patch }            → aggiorna reward
 *           patch ammessi: is_enabled, is_paused, cost, title, prompt,
 *                          should_redemptions_skip_request_queue
 * DELETE /api/mod-rewards  { id }                      → elimina reward
 *
 * NB: l'API Helix richiede broadcaster token (channel:manage:redemptions
 * scope). Nelle UI i pulsanti vanno mostrati solo se il login dell'utente
 * combacia col broadcaster.
 */

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);
  if (!twitchUser) return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });

  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(400).json({ error: 'Broadcaster ID non disponibile.' });

  try {
    /* ─── GET: lista ─── */
    if (req.method === 'GET') {
      const data = await helixGet('channel_points/custom_rewards',
        { broadcaster_id: broadcasterId, only_manageable_rewards: false },
        twitchUser.token, twitchUser.clientId);
      const rewards = (data.data || []).map(r => ({
        id:    r.id,
        title: r.title,
        cost:  r.cost,
        prompt: r.prompt,
        is_enabled:           r.is_enabled,
        is_paused:            r.is_paused,
        is_in_stock:          r.is_in_stock,
        background_color:     r.background_color,
        image_url:            r.image?.url_4x || r.default_image?.url_4x,
        max_per_stream_setting:        r.max_per_stream_setting,
        max_per_user_per_stream_setting: r.max_per_user_per_stream_setting,
        global_cooldown_setting:       r.global_cooldown_setting,
        should_redemptions_skip_request_queue: r.should_redemptions_skip_request_queue,
        redemptions_redeemed_current_stream: r.redemptions_redeemed_current_stream,
      }));
      return res.status(200).json({ rewards });
    }

    /* ─── POST: crea ─── */
    if (req.method === 'POST') {
      const body = req.body || {};
      const title = String(body.title || '').trim().slice(0, 45);
      const cost  = Math.max(1, parseInt(body.cost) || 100);
      if (!title) return res.status(400).json({ error: 'title obbligatorio.' });
      const payload = { title, cost };
      if (body.prompt) payload.prompt = String(body.prompt).slice(0, 200);
      if (body.background_color) payload.background_color = String(body.background_color);
      const data = await helixRequest('POST',
        `channel_points/custom_rewards?broadcaster_id=${broadcasterId}`,
        payload, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, reward: data?.data?.[0] || null });
    }

    /* ─── PATCH: aggiorna ─── */
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id obbligatorio.' });
      const allowed = [
        'is_enabled', 'is_paused', 'cost', 'title', 'prompt',
        'background_color',
        'should_redemptions_skip_request_queue',
        'is_user_input_required',
        'is_max_per_stream_enabled', 'max_per_stream',
        'is_max_per_user_per_stream_enabled', 'max_per_user_per_stream',
        'is_global_cooldown_enabled', 'global_cooldown_seconds',
      ];
      const patch = {};
      for (const k of allowed) if (k in body) patch[k] = body[k];
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nessun campo da aggiornare.' });
      const data = await helixRequest('PATCH',
        `channel_points/custom_rewards?broadcaster_id=${broadcasterId}&id=${id}`,
        patch, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, reward: data?.data?.[0] || null });
    }

    /* ─── DELETE ─── */
    if (req.method === 'DELETE') {
      const body = req.body || {};
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id obbligatorio.' });
      await helixRequest('DELETE',
        `channel_points/custom_rewards?broadcaster_id=${broadcasterId}&id=${id}`,
        null, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: 'Metodo non supportato.' });
  } catch (e) {
    console.error('mod-rewards error:', e);
    return res.status(500).json({ error: e.message });
  }
}
