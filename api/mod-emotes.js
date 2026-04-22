import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId,
} from './_modAuth.js';

/**
 * mod-emotes.js — Gestione completa 7TV.
 *
 * GET  /api/mod-emotes?action=seventv_status              → stato integrazione (token presente?, slot, set_id)
 * GET  /api/mod-emotes?action=seventv_search&q=...        → ricerca emote pubbliche (no auth)
 *
 * POST /api/mod-emotes  { action: 'seventv_add',    emote_id, name? }
 * POST /api/mod-emotes  { action: 'seventv_remove', emote_id }
 * POST /api/mod-emotes  { action: 'seventv_rename', emote_id, name }
 * POST /api/mod-emotes  { action: 'seventv_set_token', token }   ← BROADCASTER ONLY
 *
 * NOTE permessi:
 *   - Tutte le mutation 7TV richiedono token utente 7TV salvato in Redis
 *     (`mod:seventv:token`, TTL 90gg). Solo il broadcaster lo può impostare.
 *   - I MOD possono cercare/leggere; possono fare add/remove/rename SE
 *     il broadcaster ha salvato un token (essi usano quel token, perché 7TV
 *     non ha distinzione moderator/broadcaster come Twitch — è il broadcaster
 *     a configurare gli "editor" lato 7TV).
 *
 * Redis:
 *   mod:seventv:token         → token utente 7TV (TTL 90gg)
 *   mod:seventv:set_id_cache  → emote_set ID del canale (TTL 24h)
 */

const SEVENTV_TOKEN_KEY  = 'mod:seventv:token';
const SEVENTV_TOKEN_TTL  = 90 * 24 * 60 * 60;
const SEVENTV_SET_KEY    = 'mod:seventv:set_id_cache';
const SEVENTV_SET_TTL    = 24 * 60 * 60;

const SEVENTV_GQL = 'https://7tv.io/v3/gql';
const SEVENTV_REST = 'https://7tv.io/v3';

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const { twitchUser, isMod, isBroadcaster } = await modAuthGate(req, redis);

  if (!twitchUser) return res.status(401).json({ code: 'unauthenticated', error: 'Token Twitch mancante o non valido.' });
  if (!isMod)      return res.status(403).json({ code: 'not_mod', error: 'Accesso riservato ai moderatori.' });

  /* ─── helper 7TV: ottieni emote_set_id del canale (cache 24h) ─── */
  async function getChannelSetId() {
    let setId = await redis.get(SEVENTV_SET_KEY).catch(() => null);
    if (setId) return setId;
    const broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) return null;
    try {
      const r = await fetch(`${SEVENTV_REST}/users/twitch/${broadcasterId}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const j = await r.json();
      setId = j?.emote_set?.id || null;
      if (setId) await redis.set(SEVENTV_SET_KEY, setId, { ex: SEVENTV_SET_TTL });
      return setId;
    } catch { return null; }
  }

  async function getStoredToken() {
    return await redis.get(SEVENTV_TOKEN_KEY).catch(() => null);
  }

  async function gqlCall(query, variables, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(SEVENTV_GQL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) {
      const msg = j.errors?.[0]?.message || `7TV ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      err.helix = j;
      throw err;
    }
    return j.data;
  }

  /* ─── GET ─── */
  if (req.method === 'GET') {
    const action = req.query?.action;

    if (action === 'seventv_status') {
      const setId = await getChannelSetId();
      const tokenPresent = !!(await getStoredToken());
      let setInfo = null;
      let emotes = [];
      if (setId) {
        try {
          const r = await fetch(`${SEVENTV_REST}/emote-sets/${setId}`, { headers: { Accept: 'application/json' } });
          if (r.ok) {
            const j = await r.json();
            const rawEmotes = Array.isArray(j.emotes) ? j.emotes : [];
            setInfo = {
              id: j.id,
              name: j.name,
              capacity: j.capacity,
              count:    rawEmotes.length,
            };
            emotes = rawEmotes.map(en => {
              const data = en.data || {};
              const host = data.host || {};
              const baseUrl = host.url ? `https:${host.url}` : '';
              return {
                id:       en.id,                                // emote_id (riferimento al set)
                nome:     en.name || data.name || '',           // alias usato nel canale
                originalName: data.name || '',
                animata:  !!data.animated,
                url:      baseUrl ? `${baseUrl}/1x.webp` : null,
                url2x:    baseUrl ? `${baseUrl}/2x.webp` : null,
                url4x:    baseUrl ? `${baseUrl}/4x.webp` : null,
                owner:    data.owner?.display_name || data.owner?.username || '',
              };
            });
          }
        } catch { /* tolleriamo: setInfo resta null, emotes resta [] */ }
      }
      return res.status(200).json({ tokenPresent, setId, set: setInfo, emotes, isBroadcaster });
    }

    if (action === 'seventv_search') {
      const q = String(req.query?.q || '').trim();
      if (!q) return res.status(200).json({ emotes: [] });
      const limit = Math.min(50, Math.max(1, parseInt(req.query?.limit) || 24));
      // Il REST /v3/emotes non supporta la ricerca testuale: usiamo GraphQL.
      const query = `
        query SearchEmotes($query: String!, $page: Int, $limit: Int) {
          emotes(query: $query, page: $page, limit: $limit) {
            items {
              id
              name
              animated
              owner { id username display_name }
              host { url }
            }
          }
        }
      `;
      try {
        const data = await gqlCall(query, { query: q, page: 1, limit }, null);
        const items = (data?.emotes?.items || []).slice(0, limit).map(e => {
          const host = e.host || {};
          const baseUrl = host.url ? `https:${host.url}` : '';
          return {
            id:        e.id,
            name:      e.name,
            owner:     e.owner?.display_name || e.owner?.username || '',
            animated:  !!e.animated,
            preview:   baseUrl ? `${baseUrl}/2x.webp` : null,
            preview4x: baseUrl ? `${baseUrl}/4x.webp` : null,
          };
        });
        return res.status(200).json({ emotes: items });
      } catch (e) {
        return res.status(e.status && e.status !== 200 ? e.status : 502).json({
          code: 'seventv_search_failed',
          error: `Ricerca 7TV non disponibile: ${e.message}`,
        });
      }
    }

    return res.status(400).json({ error: 'Azione GET non riconosciuta.' });
  }

  /* ─── POST ─── */
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;

    /* SET TOKEN — solo broadcaster */
    if (action === 'seventv_set_token') {
      if (!isBroadcaster) {
        return res.status(403).json({ code: 'broadcaster_only', error: 'Solo il broadcaster può impostare il token 7TV.' });
      }
      const { token } = body;
      if (!token || typeof token !== 'string' || token.length < 20) {
        return res.status(400).json({ error: 'Token 7TV non valido.' });
      }
      await redis.set(SEVENTV_TOKEN_KEY, token.trim(), { ex: SEVENTV_TOKEN_TTL });
      return res.status(200).json({ ok: true });
    }

    /* CLEAR TOKEN — solo broadcaster */
    if (action === 'seventv_clear_token') {
      if (!isBroadcaster) {
        return res.status(403).json({ code: 'broadcaster_only', error: 'Solo il broadcaster può rimuovere il token 7TV.' });
      }
      await redis.del(SEVENTV_TOKEN_KEY);
      return res.status(200).json({ ok: true });
    }

    /* MUTATIONS — richiedono token salvato */
    const sevenTvToken = await getStoredToken();
    if (!sevenTvToken) {
      return res.status(503).json({
        code: 'seventv_token_missing',
        error: 'Nessun token 7TV configurato. Il broadcaster deve impostarlo dalla sezione Emote.',
      });
    }
    const setId = await getChannelSetId();
    if (!setId) {
      return res.status(503).json({ code: 'seventv_set_missing', error: 'Emote set 7TV del canale non trovato.' });
    }

    if (action === 'seventv_add' || action === 'seventv_remove' || action === 'seventv_rename') {
      const { emote_id, name } = body;
      if (!emote_id) return res.status(400).json({ error: 'emote_id obbligatorio.' });

      const map = { seventv_add: 'ADD', seventv_remove: 'REMOVE', seventv_rename: 'UPDATE' };
      const apiAction = map[action];
      if (apiAction === 'UPDATE' && !name) return res.status(400).json({ error: 'name obbligatorio per rename.' });

      const query = `
        mutation ChangeEmoteInSet($id: ObjectID!, $action: ListItemAction!, $emote_id: ObjectID!, $name: String) {
          emoteSet(id: $id) {
            emotes(id: $emote_id, action: $action, name: $name) {
              id
              name
            }
          }
        }
      `;
      try {
        const data = await gqlCall(query, {
          id: setId,
          action: apiAction,
          emote_id,
          name: name || null,
        }, sevenTvToken);
        return res.status(200).json({ ok: true, action, result: data });
      } catch (e) {
        return res.status(e.status || 500).json({ code: 'seventv_error', error: e.message });
      }
    }

    return res.status(400).json({ error: 'Azione POST non riconosciuta.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
