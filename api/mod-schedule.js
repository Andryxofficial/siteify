import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
  pickHelixAuth, broadcasterTokenMissing,
} from './_modAuth.js';

/**
 * mod-schedule.js — Programmazione settimanale del canale.
 *
 * GET    /api/mod-schedule        → legge lo schedule Helix
 * POST   /api/mod-schedule        → crea un segmento
 * PATCH  /api/mod-schedule        → modifica un segmento esistente
 * DELETE /api/mod-schedule        → rimuove un segmento
 */

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ error: 'Token mancante.' });
  if (!isMod)      return res.status(403).json({ error: 'Accesso riservato.' });

  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(400).json({ error: 'Broadcaster ID non disponibile.' });

  if (req.method === 'GET') {
    try {
      // GET /schedule è pubblico; basta un qualsiasi user token valido.
      const data = await helixGet('schedule', { broadcaster_id: broadcasterId, first: 25 }, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ segments: data.data?.segments || [], vacation: data.data?.vacation || null });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  // Tutte le mutazioni schedule richiedono il token broadcaster (channel:manage:schedule).
  const auth = await pickHelixAuth({ twitchUser, redis, requireBroadcaster: true });
  if (!auth) return broadcasterTokenMissing(res);

  if (req.method === 'POST') {
    const { start_time, timezone, is_recurring, duration, category_id, title } = req.body || {};
    if (!start_time) return res.status(400).json({ error: 'start_time obbligatorio.' });
    try {
      const payload = {
        broadcaster_id: broadcasterId,
        start_time,
        timezone: timezone || 'Europe/Rome',
        is_recurring: !!is_recurring,
        duration:  Math.max(30, Math.min(1440, parseInt(duration) || 120)),
      };
      if (category_id) payload.category_id = category_id;
      if (title)       payload.title = String(title).slice(0, 140);
      const data = await helixRequest('POST', 'schedule/segment', payload, auth.token, auth.clientId);
      return res.status(200).json({ ok: true, segment: data.data?.segments?.[0] || null });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    const { segment_id, ...fields } = req.body || {};
    if (!segment_id) return res.status(400).json({ error: 'segment_id obbligatorio.' });
    try {
      const payload = { broadcaster_id: broadcasterId, id: segment_id };
      if (fields.start_time)  payload.start_time  = fields.start_time;
      if (fields.duration)    payload.duration    = parseInt(fields.duration);
      if (fields.title)       payload.title       = String(fields.title).slice(0, 140);
      if (fields.category_id) payload.category_id = fields.category_id;
      if (fields.is_canceled !== undefined) payload.is_canceled = !!fields.is_canceled;
      const data = await helixRequest('PATCH', 'schedule/segment', payload, auth.token, auth.clientId);
      return res.status(200).json({ ok: true, segment: data.data?.segments?.[0] || null });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const { segment_id } = req.body || {};
    if (!segment_id) return res.status(400).json({ error: 'segment_id obbligatorio.' });
    try {
      await helixRequest('DELETE',
        `schedule/segment?broadcaster_id=${broadcasterId}&id=${segment_id}`,
        null, auth.token, auth.clientId);
      return res.status(200).json({ ok: true, deleted: segment_id });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
