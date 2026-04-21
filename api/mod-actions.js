import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
} from './_modAuth.js';

/**
 * mod-actions.js — Quick actions del Mod Panel.
 *
 * POST /api/mod-actions  { action, ...params }
 *
 * Azioni supportate:
 *   raid        { to_login | to_id }  → avvia raid
 *   cancel_raid {}                    → annulla raid in corso
 *   commercial  { length }            → avvia commercial (solo broadcaster)
 *   marker      { description? }      → crea uno stream marker
 *   ad_schedule {}                    → GET via query: stato schedule pubblicità
 */

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
  if (!broadcasterId) return res.status(400).json({ error: 'Broadcaster ID non disponibile.' });

  /* ─── GET: stato corrente (schedule pubblicità) ─── */
  if (req.method === 'GET') {
    const action = req.query?.action;
    try {
      if (action === 'ad_schedule') {
        const data = await helixGet('channels/ads', { broadcaster_id: broadcasterId },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ schedule: data.data?.[0] || null });
      }
      return res.status(400).json({ error: 'Azione GET non riconosciuta.' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non supportato.' });

  const body = req.body || {};
  const { action } = body;

  try {
    /* ─── RAID ─── */
    if (action === 'raid') {
      let toId = body.to_id;
      // Se ci passano un login, risolviamo prima
      if (!toId && body.to_login) {
        const data = await helixGet('users', { login: String(body.to_login).toLowerCase() },
          twitchUser.token, twitchUser.clientId);
        toId = data.data?.[0]?.id;
        if (!toId) return res.status(404).json({ error: 'Canale destinazione non trovato.' });
      }
      if (!toId) return res.status(400).json({ error: 'to_login o to_id obbligatorio.' });
      const data = await helixRequest('POST',
        `raids?from_broadcaster_id=${broadcasterId}&to_broadcaster_id=${toId}`,
        null, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, raid: data?.data?.[0] || null });
    }

    if (action === 'cancel_raid') {
      await helixRequest('DELETE',
        `raids?broadcaster_id=${broadcasterId}`,
        null, twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true });
    }

    /* ─── COMMERCIAL ─── */
    if (action === 'commercial') {
      const length = Math.max(30, Math.min(180, parseInt(body.length) || 30));
      // Helix accetta solo multipli di 30: 30/60/90/120/150/180
      const valido = [30, 60, 90, 120, 150, 180];
      const lenOk = valido.includes(length) ? length
        : valido.reduce((p, c) => Math.abs(c - length) < Math.abs(p - length) ? c : p, 60);
      const data = await helixRequest('POST', 'channels/commercial',
        { broadcaster_id: broadcasterId, length: lenOk },
        twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, commercial: data?.data?.[0] || null });
    }

    /* ─── STREAM MARKER ─── */
    if (action === 'marker') {
      const description = (body.description || '').toString().trim().slice(0, 140);
      const payload = { user_id: broadcasterId };
      if (description) payload.description = description;
      const data = await helixRequest('POST', 'streams/markers', payload,
        twitchUser.token, twitchUser.clientId);
      return res.status(200).json({ ok: true, marker: data?.data?.[0] || null });
    }

    return res.status(400).json({ error: `Azione non riconosciuta: ${action}` });
  } catch (e) {
    console.error('mod-actions error:', e);
    return res.status(500).json({ error: e.message });
  }
}
