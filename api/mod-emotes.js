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
 * POST /api/mod-emotes  { action: 'seventv_upload', name, contentType, dataBase64, tags?, addToSet? }
 *
 * NOTE permessi:
 *   - Tutte le mutation 7TV richiedono token utente 7TV salvato in Redis
 *     (`mod:seventv:token`, TTL 90gg). Solo il broadcaster lo può impostare.
 *   - I MOD possono cercare/leggere; possono fare add/remove/rename/upload SE
 *     il broadcaster ha salvato un token (essi usano quel token, perché 7TV
 *     non ha distinzione moderator/broadcaster come Twitch — è il broadcaster
 *     a configurare gli "editor" lato 7TV).
 *
 * Redis:
 *   mod:seventv:token         → token utente 7TV (TTL 90gg)
 *   mod:seventv:set_id_cache  → emote_set ID del canale (TTL 24h)
 */

/* Aumentato il limite del body parser per accettare upload immagini fino a ~6 MB
   (base64 ~33% overhead → cap pratico immagine raw ≈ 4.5 MB). */
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

/* Tipi MIME accettati per l'upload (supportati da 7TV) */
const SEVENTV_UPLOAD_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/apng',
  'image/avif',
]);
const SEVENTV_UPLOAD_MAX_BYTES = 6 * 1024 * 1024; // 6 MB raw
const SEVENTV_NAME_RE = /^[A-Za-z0-9_-]{2,25}$/;

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

    /* UPLOAD — carica un'immagine custom su 7TV e (opzionalmente) la aggiunge al set del canale */
    if (action === 'seventv_upload') {
      const { name, contentType, dataBase64, tags, addToSet } = body;
      // Validazione nome
      if (!name || typeof name !== 'string' || !SEVENTV_NAME_RE.test(name)) {
        return res.status(400).json({
          code: 'invalid_name',
          error: 'Nome emote non valido. Usa 2-25 caratteri tra lettere, numeri, "_" e "-".',
        });
      }
      // Validazione MIME
      if (!contentType || typeof contentType !== 'string' || !SEVENTV_UPLOAD_MIME.has(contentType.toLowerCase())) {
        return res.status(400).json({
          code: 'invalid_mime',
          error: 'Formato immagine non supportato. Usa PNG, JPEG, WebP, GIF, APNG o AVIF.',
        });
      }
      // Validazione payload base64
      if (!dataBase64 || typeof dataBase64 !== 'string') {
        return res.status(400).json({ code: 'missing_image', error: 'Immagine mancante.' });
      }
      // Strip eventuale prefisso data: URL
      const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '');
      let buffer;
      try {
        buffer = Buffer.from(cleanBase64, 'base64');
      } catch {
        return res.status(400).json({ code: 'invalid_image', error: 'Immagine base64 non decodificabile.' });
      }
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ code: 'invalid_image', error: 'Immagine vuota.' });
      }
      if (buffer.length > SEVENTV_UPLOAD_MAX_BYTES) {
        return res.status(413).json({
          code: 'image_too_large',
          error: `Immagine troppo grande (${Math.round(buffer.length / 1024)} KB). Massimo ${Math.round(SEVENTV_UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`,
        });
      }

      // Costruisci multipart form-data verso 7TV REST
      // 7TV accetta POST https://7tv.io/v3/emotes con campo "image" (file) + "name" + "tags"
      const formData = new FormData();
      formData.append('name', name);
      if (Array.isArray(tags) && tags.length > 0) {
        // Tag: lowercase, solo [a-z0-9-], 1-30 char ciascuno, max 6 (limite 7TV).
        const cleanTags = tags
          .map(t => String(t || '').trim().toLowerCase())
          .filter(t => /^[a-z0-9-]{1,30}$/.test(t))
          .slice(0, 6);
        if (cleanTags.length > 0) formData.append('tags', cleanTags.join(','));
      }
      const blob = new Blob([buffer], { type: contentType.toLowerCase() });
      // Determina estensione corretta
      const extByMime = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
        'image/gif': 'gif', 'image/apng': 'apng', 'image/avif': 'avif',
      };
      const ext = extByMime[contentType.toLowerCase()] || 'png';
      formData.append('image', blob, `${name}.${ext}`);

      let uploadJson = null;
      let uploadStatus = 0;
      try {
        const uploadRes = await fetch(`${SEVENTV_REST}/emotes`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sevenTvToken}` },
          body: formData,
        });
        uploadStatus = uploadRes.status;
        // 7TV può rispondere JSON o testo in caso di errore CDN
        const ct = uploadRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          uploadJson = await uploadRes.json().catch(() => null);
        } else {
          const txt = await uploadRes.text().catch(() => '');
          uploadJson = { error: txt || `7TV ${uploadStatus}` };
        }
        if (!uploadRes.ok) {
          const msg = uploadJson?.error_humanized
            || uploadJson?.error
            || uploadJson?.message
            || `7TV upload fallito (HTTP ${uploadStatus}).`;
          return res.status(uploadStatus >= 400 && uploadStatus < 600 ? uploadStatus : 502).json({
            code: 'seventv_upload_failed',
            error: msg,
          });
        }
      } catch (e) {
        return res.status(502).json({
          code: 'seventv_upload_failed',
          error: `Connessione a 7TV fallita: ${e.message}`,
        });
      }

      // L'ID dell'emote creata può apparire in vari campi: id, emote_id, data.id
      const newEmoteId = uploadJson?.id || uploadJson?.emote_id || uploadJson?.data?.id || null;
      if (!newEmoteId) {
        return res.status(502).json({
          code: 'seventv_upload_no_id',
          error: 'Upload completato ma 7TV non ha restituito un ID emote.',
        });
      }

      // Opzionalmente aggiungi al set del canale (default: true)
      const shouldAdd = addToSet !== false;
      let addResult = null;
      let addError = null;
      if (shouldAdd) {
        const addQuery = `
          mutation AddUploadedEmote($id: ObjectID!, $emote_id: ObjectID!, $name: String) {
            emoteSet(id: $id) {
              emotes(id: $emote_id, action: ADD, name: $name) {
                id
                name
              }
            }
          }
        `;
        try {
          addResult = await gqlCall(addQuery, {
            id: setId,
            emote_id: newEmoteId,
            name,
          }, sevenTvToken);
        } catch (e) {
          addError = e.message;
        }
      }

      return res.status(200).json({
        ok: true,
        emote_id: newEmoteId,
        added: shouldAdd && !addError,
        addError,
        addResult,
      });
    }

    return res.status(400).json({ error: 'Azione POST non riconosciuta.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
