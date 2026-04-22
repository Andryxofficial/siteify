import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet, helixRequest,
  pickHelixAuth, broadcasterTokenMissing, scopeMissing, sendHelixError,
} from './_modAuth.js';

/**
 * mod-moderation.js — Azioni di moderazione chat (estese).
 *
 * POST /api/mod-moderation  { action, ...params }
 *
 * Azioni POST:
 *   ban / timeout       { target_user_id, reason?, duration? }
 *   unban               { target_user_id }
 *   clear               {}
 *   delete              { message_id }
 *   shoutout            { to_broadcaster_id }
 *   automod             { msg_id, status: 'ALLOW'|'DENY' }
 *   chat_settings       { settings: {...} }
 *   lookup_user         { login }
 *
 *   warning             { target_user_id, reason }                       (NEW)
 *   announcement        { message, color? }                              (NEW)
 *   shield_mode         { active: bool }                                 (NEW)
 *   blocked_term_add    { text }                                         (NEW)
 *   blocked_term_remove { id }                                           (NEW)
 *   automod_settings    { settings: {...} }                              (NEW)
 *   send_chat           { message, reply_parent_message_id? }            (NEW, scope user:write:chat)
 *   unban_request       { id, status: 'approved'|'denied', message? }    (NEW)
 *
 * Azioni GET (?action=):
 *   automod_queue
 *   banned_users
 *   chat_settings
 *   blocked_terms                                                        (NEW)
 *   unban_requests   [&status=pending|approved|denied]                   (NEW)
 *   shield_mode                                                          (NEW)
 *   automod_settings                                                     (NEW)
 *   warnings_history (locale, da Redis)                                  (NEW)
 *
 * NOTE PERMESSI:
 *   - Tutte le azioni "moderator-scoped" (ban, warnings, announcements,
 *     shield_mode, blocked_terms, unban_requests, automod_settings,
 *     chat_settings) usano il TOKEN DEL MOD con `moderator_id`.
 *     Twitch verifica lì che il mod abbia il diritto sul canale.
 *   - L'azione `send_chat` con `sender_id` = mod usa il token del mod
 *     se ha lo scope `user:write:chat`; altrimenti tenta col token
 *     broadcaster persistito.
 */

const KEY_WARNINGS_HIST = 'mod:warnings:history';   // lista JSON {target_user_id, target_login, reason, mod_login, ts}
const KEY_BLOCKED_TERMS_CACHE = 'mod:blocked_terms:cache'; // cache 5min

const COLORS_ANNOUNCEMENT = ['blue', 'green', 'orange', 'purple', 'primary'];

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ code: 'unauthenticated', error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ code: 'not_mod', error: 'Accesso riservato ai moderatori.' });

  const broadcasterId = await getBroadcasterId(redis);
  if (!broadcasterId) return res.status(503).json({ code: 'broadcaster_id_missing', error: 'Broadcaster ID non disponibile.' });

  const modId = twitchUser.userId;

  /* Helper locale: chiama Helix con il token del mod, ma se manca uno scope
     specifico restituisce 403 scope_missing in modo coerente. */
  function requireScope(scope) {
    if (!twitchUser.scopes.includes(scope)) {
      scopeMissing(res, [scope], 'mod');
      return false;
    }
    return true;
  }

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
      if (action === 'chat_settings') {
        const data = await helixGet('chat/settings',
          { broadcaster_id: broadcasterId, moderator_id: modId },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ settings: data.data?.[0] || null });
      }

      /* ─── NEW: blocked_terms ─── */
      if (action === 'blocked_terms') {
        if (!requireScope('moderator:manage:blocked_terms')) return;
        const data = await helixGet('moderation/blocked_terms',
          { broadcaster_id: broadcasterId, moderator_id: modId, first: 100 },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ terms: data.data || [], pagination: data.pagination });
      }

      /* ─── NEW: unban_requests ─── */
      if (action === 'unban_requests') {
        if (!requireScope('moderator:manage:unban_requests')) return;
        const status = ['pending', 'approved', 'denied', 'acknowledged', 'canceled'].includes(req.query?.status)
          ? req.query.status
          : 'pending';
        const data = await helixGet('moderation/unban_requests',
          { broadcaster_id: broadcasterId, moderator_id: modId, status, first: 100 },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ requests: data.data || [] });
      }

      /* ─── NEW: shield_mode ─── */
      if (action === 'shield_mode') {
        if (!requireScope('moderator:manage:shield_mode')) return;
        const data = await helixGet('moderation/shield_mode',
          { broadcaster_id: broadcasterId, moderator_id: modId },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ status: data.data?.[0] || null });
      }

      /* ─── NEW: automod_settings ─── */
      if (action === 'automod_settings') {
        if (!requireScope('moderator:manage:automod_settings')) return;
        const data = await helixGet('moderation/automod/settings',
          { broadcaster_id: broadcasterId, moderator_id: modId },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ settings: data.data?.[0] || null });
      }

      /* ─── NEW: warnings_history (cronologia locale) ─── */
      if (action === 'warnings_history') {
        const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit) || 30));
        const list = await redis.lrange(KEY_WARNINGS_HIST, 0, limit - 1);
        const items = (list || []).map(s => {
          try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
        }).filter(Boolean);
        return res.status(200).json({ items });
      }

      return res.status(400).json({ error: 'Azione GET non riconosciuta.' });
    } catch (e) {
      return sendHelixError(res, e, `eseguire ${action}`);
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
        if (!requireScope('moderator:manage:banned_users')) return;
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
        if (!requireScope('moderator:manage:banned_users')) return;
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
        const histKey = 'mod:shoutout:history';
        const entry = JSON.stringify({ to_broadcaster_id, ts: new Date().toISOString() });
        await redis.lpush(histKey, entry);
        await redis.ltrim(histKey, 0, 49);
        return res.status(200).json({ ok: true, action: 'shoutout', to_broadcaster_id });
      }

      if (action === 'automod') {
        const { msg_id, status } = body;
        if (!msg_id || !status) return res.status(400).json({ error: 'msg_id e status obbligatori.' });
        await helixRequest('POST', 'moderation/automod/message',
          { user_id: modId, msg_id, action: status },
          twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action: 'automod', msg_id, status });
      }

      if (action === 'lookup_user') {
        const { login } = body;
        if (!login) return res.status(400).json({ error: 'login obbligatorio.' });
        const data = await helixGet('users', { login: login.toLowerCase() }, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ user: data.data?.[0] || null });
      }

      if (action === 'chat_settings') {
        const allowed = [
          'slow_mode', 'slow_mode_wait_time',
          'follower_mode', 'follower_mode_duration',
          'subscriber_mode', 'emote_mode', 'unique_chat_mode',
          'non_moderator_chat_delay', 'non_moderator_chat_delay_duration',
        ];
        const settings = body.settings || {};
        const patch = {};
        for (const k of allowed) {
          if (k in settings && settings[k] !== undefined && settings[k] !== null) {
            patch[k] = settings[k];
          }
        }
        if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nessuna impostazione da aggiornare.' });
        const data = await helixRequest('PATCH',
          `chat/settings?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          patch, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, settings: data?.data?.[0] || null });
      }

      /* ════════════════════════════════════════════════════════════════
         NUOVE AZIONI
         ════════════════════════════════════════════════════════════════ */

      /* ─── WARNING ─── moderator-scoped */
      if (action === 'warning') {
        const { target_user_id, target_login, reason } = body;
        if (!target_user_id || !reason) {
          return res.status(400).json({ error: 'target_user_id e reason obbligatori.' });
        }
        if (!requireScope('moderator:manage:warnings')) return;
        const reasonClean = String(reason).slice(0, 500);
        await helixRequest('POST',
          `moderation/warnings?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          { data: { user_id: target_user_id, reason: reasonClean } },
          twitchUser.token, twitchUser.clientId);
        // Persist in cronologia locale
        const entry = JSON.stringify({
          target_user_id,
          target_login: target_login || null,
          reason: reasonClean,
          mod_login: twitchUser.login,
          mod_id:    twitchUser.userId,
          ts: new Date().toISOString(),
        });
        try {
          await redis.lpush(KEY_WARNINGS_HIST, entry);
          await redis.ltrim(KEY_WARNINGS_HIST, 0, 199);
        } catch { /* non bloccante */ }
        return res.status(200).json({ ok: true, action: 'warning', target_user_id });
      }

      /* ─── ANNOUNCEMENT ─── moderator-scoped, max 500 chars */
      if (action === 'announcement') {
        const { message, color } = body;
        if (!message || !String(message).trim()) {
          return res.status(400).json({ error: 'message obbligatorio.' });
        }
        if (!requireScope('moderator:manage:announcements')) return;
        const payload = { message: String(message).slice(0, 500) };
        if (color && COLORS_ANNOUNCEMENT.includes(color)) payload.color = color;
        await helixRequest('POST',
          `chat/announcements?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          payload, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, action: 'announcement' });
      }

      /* ─── SHIELD MODE toggle ─── moderator-scoped */
      if (action === 'shield_mode') {
        const { active } = body;
        if (typeof active !== 'boolean') {
          return res.status(400).json({ error: 'active (bool) obbligatorio.' });
        }
        if (!requireScope('moderator:manage:shield_mode')) return;
        const data = await helixRequest('PUT',
          `moderation/shield_mode?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          { is_active: active }, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, status: data?.data?.[0] || null });
      }

      /* ─── BLOCKED TERMS — add ─── moderator-scoped */
      if (action === 'blocked_term_add') {
        const { text } = body;
        if (!text || !String(text).trim()) {
          return res.status(400).json({ error: 'text obbligatorio.' });
        }
        if (!requireScope('moderator:manage:blocked_terms')) return;
        const cleanText = String(text).slice(0, 500);
        const data = await helixRequest('POST',
          `moderation/blocked_terms?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          { text: cleanText }, twitchUser.token, twitchUser.clientId);
        try { await redis.del(KEY_BLOCKED_TERMS_CACHE); } catch { /* */ }
        return res.status(200).json({ ok: true, term: data?.data?.[0] || null });
      }

      /* ─── BLOCKED TERMS — remove ─── moderator-scoped */
      if (action === 'blocked_term_remove') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id obbligatorio.' });
        if (!requireScope('moderator:manage:blocked_terms')) return;
        await helixRequest('DELETE',
          `moderation/blocked_terms?broadcaster_id=${broadcasterId}&moderator_id=${modId}&id=${encodeURIComponent(id)}`,
          null, twitchUser.token, twitchUser.clientId);
        try { await redis.del(KEY_BLOCKED_TERMS_CACHE); } catch { /* */ }
        return res.status(200).json({ ok: true, removed: id });
      }

      /* ─── AUTOMOD SETTINGS ─── moderator-scoped */
      if (action === 'automod_settings') {
        if (!requireScope('moderator:manage:automod_settings')) return;
        // Se è presente `overall_level` (1-4) Twitch sovrascrive le singole.
        // Le 7 categorie sono valori 0-4. Inviamo solo quelle definite.
        const allowed = [
          'overall_level', 'aggression', 'bullying', 'disability',
          'misogyny', 'race_ethnicity_or_religion', 'sex_based_terms',
          'sexuality_sex_or_gender', 'swearing',
        ];
        const settings = body.settings || {};
        const patch = {};
        for (const k of allowed) {
          if (k in settings && settings[k] !== undefined && settings[k] !== null) {
            const v = parseInt(settings[k]);
            if (!Number.isNaN(v) && v >= 0 && v <= 4) patch[k] = v;
          }
        }
        if (!Object.keys(patch).length) {
          return res.status(400).json({ error: 'Nessuna impostazione AutoMod da aggiornare.' });
        }
        const data = await helixRequest('PUT',
          `moderation/automod/settings?broadcaster_id=${broadcasterId}&moderator_id=${modId}`,
          patch, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, settings: data?.data?.[0] || null });
      }

      /* ─── SEND CHAT MESSAGE ─── user-scoped (user:write:chat).
       * Twitch Helix POST /helix/chat/messages permette di mandare un messaggio
       * usando un sender_id arbitrario PURCHE' quel sender abbia user:write:chat.
       *
       * Comportamento:
       *  - Se il MOD ha user:write:chat → messaggio inviato come MOD (sender_id = mod).
       *  - Altrimenti tenta col token broadcaster persistito → messaggio inviato come BROADCASTER.
       *  - Se nessuno dei due è disponibile → 403 scope_missing.
       */
      if (action === 'send_chat') {
        const { message, reply_parent_message_id } = body;
        if (!message || !String(message).trim()) {
          return res.status(400).json({ error: 'message obbligatorio.' });
        }
        const cleanMsg = String(message).slice(0, 500);

        // Decisione token + sender_id
        let useToken    = null;
        let useClientId = null;
        let senderId    = null;
        let usedAs      = null;

        if (twitchUser.scopes.includes('user:write:chat')) {
          useToken    = twitchUser.token;
          useClientId = twitchUser.clientId;
          senderId    = twitchUser.userId;
          usedAs      = 'mod';
        } else {
          const auth = await pickHelixAuth({ twitchUser, redis, requireBroadcaster: true });
          if (!auth) return broadcasterTokenMissing(res);
          if (!auth.scopes?.length || !auth.scopes.includes('user:write:chat')) {
            // Helix richiede user:write:chat sul sender; sia mod che broadcaster mancano
            return scopeMissing(res, ['user:write:chat'], auth.source || 'broadcaster');
          }
          useToken    = auth.token;
          useClientId = auth.clientId;
          senderId    = broadcasterId; // broadcaster invia come se stesso
          usedAs      = 'broadcaster';
        }

        const payload = {
          broadcaster_id: broadcasterId,
          sender_id:      senderId,
          message:        cleanMsg,
        };
        if (reply_parent_message_id) payload.reply_parent_message_id = reply_parent_message_id;

        const data = await helixRequest('POST', 'chat/messages', payload, useToken, useClientId);
        return res.status(200).json({ ok: true, sentAs: usedAs, result: data?.data?.[0] || null });
      }

      /* ─── UNBAN REQUEST resolve ─── moderator-scoped */
      if (action === 'unban_request') {
        const { id, status, message } = body;
        if (!id || !['approved', 'denied'].includes(status)) {
          return res.status(400).json({ error: 'id e status (approved|denied) obbligatori.' });
        }
        if (!requireScope('moderator:manage:unban_requests')) return;
        const params = new URLSearchParams({
          broadcaster_id: broadcasterId,
          moderator_id:   modId,
          unban_request_id: id,
          status,
        });
        if (message) params.set('resolution_text', String(message).slice(0, 500));
        const data = await helixRequest('PATCH',
          `moderation/unban_requests?${params.toString()}`,
          null, twitchUser.token, twitchUser.clientId);
        return res.status(200).json({ ok: true, request: data?.data?.[0] || null });
      }

      return res.status(400).json({ error: `Azione non riconosciuta: ${action}` });
    } catch (e) {
      console.error('mod-moderation POST error:', e);
      return sendHelixError(res, e, `eseguire ${action}`);
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
