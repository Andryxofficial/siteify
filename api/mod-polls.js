import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
  pickHelixAuth, broadcasterTokenMissing,
} from './_modAuth.js';

/**
 * mod-polls.js — Sondaggi e predizioni Twitch Helix.
 *
 * GET    /api/mod-polls?type=poll|prediction  → attivi/recenti
 * POST   /api/mod-polls                       → crea sondaggio o predizione
 * PATCH  /api/mod-polls                       → chiudi/termina
 */

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, PATCH, OPTIONS');
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

  // Polls/predictions: tutte le chiamate Helix richiedono il token del broadcaster.
  const auth = await pickHelixAuth({ twitchUser, redis, requireBroadcaster: true });
  if (!auth) return broadcasterTokenMissing(res);

  /* ─── GET ─── */
  if (req.method === 'GET') {
    const type = req.query?.type || 'poll';
    try {
      if (type === 'poll') {
        const data = await helixGet('polls', { broadcaster_id: broadcasterId, first: 5 }, auth.token, auth.clientId);
        return res.status(200).json({ polls: data.data || [] });
      }
      if (type === 'prediction') {
        const data = await helixGet('predictions', { broadcaster_id: broadcasterId, first: 5 }, auth.token, auth.clientId);
        return res.status(200).json({ predictions: data.data || [] });
      }
      return res.status(400).json({ error: 'type non valido (poll|prediction).' });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  /* ─── POST: crea ─── */
  if (req.method === 'POST') {
    const body = req.body || {};
    try {
      if (body.type === 'poll') {
        const { title, choices, duration, channel_points_voting_enabled, channel_points_per_vote } = body;
        if (!title || !choices?.length) return res.status(400).json({ error: 'Titolo e scelte obbligatori.' });
        const payload = {
          broadcaster_id: broadcasterId,
          title: String(title).slice(0, 60),
          choices: choices.slice(0, 5).map(c => ({ title: String(c).slice(0, 25) })),
          duration: Math.max(15, Math.min(1800, parseInt(duration) || 300)),
          channel_points_voting_enabled: !!channel_points_voting_enabled,
          channel_points_per_vote: channel_points_voting_enabled ? Math.max(1, parseInt(channel_points_per_vote) || 100) : undefined,
        };
        const data = await helixRequest('POST', 'polls', payload, auth.token, auth.clientId);
        return res.status(200).json({ ok: true, poll: data.data?.[0] || null });
      }

      if (body.type === 'prediction') {
        const { title, outcomes, prediction_window } = body;
        if (!title || !outcomes?.length) return res.status(400).json({ error: 'Titolo e outcomes obbligatori.' });
        const payload = {
          broadcaster_id: broadcasterId,
          title: String(title).slice(0, 45),
          outcomes: outcomes.slice(0, 10).map(o => ({ title: String(o).slice(0, 25) })),
          prediction_window: Math.max(30, Math.min(1800, parseInt(prediction_window) || 300)),
        };
        const data = await helixRequest('POST', 'predictions', payload, auth.token, auth.clientId);
        return res.status(200).json({ ok: true, prediction: data.data?.[0] || null });
      }

      return res.status(400).json({ error: 'type non valido (poll|prediction).' });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  /* ─── PATCH: chiudi/risolvi ─── */
  if (req.method === 'PATCH') {
    const body = req.body || {};
    try {
      if (body.type === 'poll') {
        const { poll_id, status } = body; // TERMINATED | ARCHIVED
        if (!poll_id) return res.status(400).json({ error: 'poll_id obbligatorio.' });
        const data = await helixRequest('PATCH', 'polls',
          { broadcaster_id: broadcasterId, id: poll_id, status: status || 'TERMINATED' },
          auth.token, auth.clientId);
        return res.status(200).json({ ok: true, poll: data.data?.[0] || null });
      }

      if (body.type === 'prediction') {
        const { prediction_id, status, winning_outcome_id } = body; // RESOLVED | CANCELED | LOCKED
        if (!prediction_id) return res.status(400).json({ error: 'prediction_id obbligatorio.' });
        const payload = { broadcaster_id: broadcasterId, id: prediction_id, status: status || 'CANCELED' };
        if (winning_outcome_id) payload.winning_outcome_id = winning_outcome_id;
        const data = await helixRequest('PATCH', 'predictions', payload, auth.token, auth.clientId);
        return res.status(200).json({ ok: true, prediction: data.data?.[0] || null });
      }

      return res.status(400).json({ error: 'type non valido (poll|prediction).' });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
