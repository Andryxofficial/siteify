import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
} from './_modAuth.js';

/**
 * mod-moderation.js — Azioni di moderazione chat.
 *
 * POST /api/mod-moderation  { action, ...params }
 *
 * Azioni supportate:
 *   ban        { target_user_id, reason?, duration? }   → timeout se duration, ban se assente
 *   unban      { target_user_id }
 *   clear      {}                                        → cancella tutta la chat
 *   delete     { message_id }                           → elimina un messaggio
 *   shoutout   { to_broadcaster_id }
 *   automod    { message_id, action: 'approve'|'deny' }
 *
 * GET /api/mod-moderation?action=automod_queue → coda AutoMod
 * GET /api/mod-moderation?action=banned_users  → lista ban attivi
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

  const modId = twitchUser.userId;

  /* ─── GET ─── */
  if (req.method === 'GET') {
    const action = req.query?.action;
    try {
      if (action === 'automod_queue') {
        const data = await helixGet('moderation/automod/message',
          { broadcaster_id: broadcasterId, moderator_id: modId },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ messages: data.data || [] });
      }
      if (action === 'banned_users') {
        const data = await helixGet('moderation/banned',
          { broadcaster_id: broadcasterId, first: 100 },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ users: data.data || [] });
      }
      return res.status(400).json({ error: 'Azione GET non riconosciuta.' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── POST ─── */
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;
    try {
      if (action === 'ban' || action === 'timeout') {
        const { target_user_id, reason, duration } = body;
        if (!target_user_id) return res.status(400).json({ error: 'target_user_id obbligatorio.' });
        const banBody = { data: { user_id: target_user_id } };
        if (reason)   banBody.data.reason   = String(reason).slice(0, 500);
        if (duration) banBody.data.duration = Math.max(1, Math.min(1209600, parseInt(duration)));
        await helixRequest('POST',
          `moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          banBody, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action, target_user_id });
      }

      if (action === 'unban') {
        const { target_user_id } = body;
        if (!target_user_id) return res.status(400).json({ error: 'target_user_id obbligatorio.' });
        await helixRequest('DELETE',
          `moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${modId}&user_id=${target_user_id}`,
          null, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action, target_user_id });
      }

      if (action === 'clear') {
        await helixRequest('DELETE',
          `moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          null, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action: 'clear' });
      }

      if (action === 'delete') {
        const { message_id } = body;
        if (!message_id) return res.status(400).json({ error: 'message_id obbligatorio.' });
        await helixRequest('DELETE',
          `moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${modId}&message_id=${message_id}`,
          null, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action: 'delete', message_id });
      }

      if (action === 'shoutout') {
        const { to_broadcaster_id } = body;
        if (!to_broadcaster_id) return res.status(400).json({ error: 'to_broadcaster_id obbligatorio.' });
        await helixRequest('POST',
          `chat/shoutouts?from_broadcaster_id=${broadcasterId}&to_broadcaster_id=${to_broadcaster_id}&moderator_id=${modId}`,
          null, twitchUser.token, twitchUser.clientId);
        // Salva in cronologia shoutout
        const histKey = 'mod:shoutout:history';
        const entry = JSON.stringify({ to_broadcaster_id, ts: new Date().toISOString() });
        await redis.lpush(histKey, entry);
        await redis.ltrim(histKey, 0, 49);
        return res.status(200).json({ ok: true, action: 'shoutout', to_broadcaster_id });
      }

      if (action === 'automod') {
        const { msg_id, status } = body; // status: 'ALLOW' | 'DENY'
        if (!msg_id || !status) return res.status(400).json({ error: 'msg_id e status obbligatori.' });
        await helixRequest('POST', 'moderation/automod/message',
          { user_id: modId, msg_id, action: status },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action: 'automod', msg_id, status });
      }

      // Ricerca utente per username (usata dalla UI ban)
      if (action === 'lookup_user') {
        const { login } = body;
        if (!login) return res.status(400).json({ error: 'login obbligatorio.' });
        const data = await helixGet('users', { login: login.toLowerCase() }, twitchUser.token, twitchUser.clientId);
        const user = data.data?.[0] || null;
        return res.status(200).json({ user });
      }

      return res.status(400).json({ error: `Azione non riconosciuta: ${action}` });
    } catch (e) {
      console.error('mod-moderation POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
