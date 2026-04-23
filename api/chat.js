import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

/**
 * Chat API — Chat generale della community ANDRYXify
 *
 * Redis data model:
 *   chat:messages              → List (newest first, max 200 entries, each JSON string)
 *   chat:ratelimit:<user>      → String with TTL 3 seconds
 *   chat:media:<uuid>          → base64 media data (TTL 7 giorni)
 *   chat:media:<uuid>:meta     → JSON { author, mimeType, name, mediaType, createdAt } (TTL 7 giorni)
 *
 * GET    /api/chat?action=messages&limit=100      → messaggi pubblici (nessuna auth)
 * GET    /api/chat?action=media&id=<mediaId>      → scarica media (nessuna auth)
 * POST   /api/chat  { action: "send", text, mediaId?, mediaType? }   → invio messaggio (auth)
 * POST   /api/chat  { action: "upload_media", data, mimeType, name } → carica media (auth)
 */

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const MAX_MESSAGES    = 200;
const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_SECONDS = 3;
const MAX_MEDIA_SIZE  = 8_000_000; // ~8 MB base64 ≈ 6 MB raw
const MEDIA_TTL       = 7 * 86400; // 7 giorni (coerente con le ultime ~200 chat)
const VALID_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
/* SVG bloccato: può contenere script e abilitare XSS */
const BLOCKED_MIME_TYPES  = ['image/svg+xml'];

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];

  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.login) return null;

  const clientId = data.client_id;
  let avatar = null;
  let displayName = data.login;
  try {
    const profileRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
    });
    if (profileRes.ok) {
      const pd = await profileRes.json();
      const u = pd.data?.[0];
      if (u) {
        avatar = u.profile_image_url || null;
        displayName = u.display_name || data.login;
      }
    }
  } catch { /* best effort */ }

  return { login: data.login, avatar, displayName };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch {
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  /* ─── GET: recupera messaggi pubblici ─── */
  if (req.method === 'GET') {
    try {
      const action = req.query?.action;

      /* GET media: scarica media allegato a un messaggio (pubblico) */
      if (action === 'media') {
        const id = (req.query?.id || '').slice(0, 100).trim();
        if (!id) return res.status(400).json({ error: 'ID media richiesto.' });
        const metaRaw = await redis.get(`chat:media:${id}:meta`);
        if (!metaRaw) return res.status(404).json({ error: 'Media non trovato.' });
        const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
        const data = await redis.get(`chat:media:${id}`);
        if (!data) return res.status(404).json({ error: 'Media non trovato.' });
        return res.status(200).json({ data, mimeType: meta.mimeType, name: meta.name, mediaType: meta.mediaType });
      }

      if (action !== 'messages') {
        return res.status(400).json({ error: 'Azione non valida. Usa: action=messages' });
      }

      let limit = parseInt(req.query?.limit, 10);
      if (!limit || limit < 1) limit = 100;
      if (limit > MAX_MESSAGES) limit = MAX_MESSAGES;

      const raw = await redis.lrange('chat:messages', 0, limit - 1);
      const messages = (raw || []).map((entry) => {
        try {
          return typeof entry === 'string' ? JSON.parse(entry) : entry;
        } catch {
          return null;
        }
      }).filter(Boolean);

      return res.status(200).json({ messages });
    } catch (e) {
      console.error('Chat GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento dei messaggi.' });
    }
  }

  /* ─── POST: invio messaggio o upload media ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) {
      return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    }

    try {
      const { action, text: rawText, mediaId: rawMediaId, mediaType: rawMediaType, data, mimeType: rawMime, name: rawName } = req.body || {};

      /* ── Upload media allegato ── */
      if (action === 'upload_media') {
        if (!data || typeof data !== 'string') return res.status(400).json({ error: 'Dati media richiesti.' });
        if (data.length > MAX_MEDIA_SIZE) return res.status(413).json({ error: 'File troppo grande (max ~6 MB).' });
        const mimeType = (rawMime || '').trim().slice(0, 100);
        if (!VALID_MIME_PREFIXES.some(p => mimeType.startsWith(p)) || BLOCKED_MIME_TYPES.includes(mimeType)) {
          return res.status(400).json({ error: 'Tipo MIME non supportato. Usa immagine (non SVG), audio o video.' });
        }
        const name      = (rawName || 'file').trim().slice(0, 200);
        const mediaType = ['image', 'audio', 'video'].includes(rawMediaType) ? rawMediaType : 'image';
        const mediaId   = randomUUID();
        const meta = JSON.stringify({ author: twitchUser.login, mimeType, name, mediaType, createdAt: Date.now() });
        await Promise.all([
          redis.set(`chat:media:${mediaId}`, data, { ex: MEDIA_TTL }),
          redis.set(`chat:media:${mediaId}:meta`, meta, { ex: MEDIA_TTL }),
        ]);
        return res.status(201).json({ mediaId });
      }

      /* ── Invio messaggio ── */
      if (action !== 'send') {
        return res.status(400).json({ error: 'Azione non valida. Usa: action=send' });
      }

      const text     = sanitize(rawText || '', MAX_TEXT_LENGTH);
      const mediaId  = rawMediaId  ? String(rawMediaId).trim().slice(0, 100)  : '';
      const mediaType = ['image', 'audio', 'video'].includes(rawMediaType) ? rawMediaType : '';

      if (!text && !mediaId) {
        return res.status(400).json({ error: 'Il messaggio non può essere vuoto.' });
      }
      /* Se è presente un mediaId, il mediaType deve essere valido */
      if (mediaId && !mediaType) {
        return res.status(400).json({ error: 'Tipo media non valido.' });
      }

      // Rate limiting
      const rlKey = `chat:ratelimit:${twitchUser.login}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta qualche secondo prima di inviare un altro messaggio.' });
      }
      await redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS });

      const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        author: twitchUser.login,
        authorAvatar: twitchUser.avatar,
        authorDisplay: twitchUser.displayName,
        text,
        createdAt: Date.now(),
        ...(mediaId ? { mediaId, mediaType } : {}),
      };

      await redis.lpush('chat:messages', JSON.stringify(message));
      await redis.ltrim('chat:messages', 0, MAX_MESSAGES - 1);

      /* Indice mention: aggiorna score (più recente = priorità maggiore) — non-bloccante */
      redis.zadd('users:mention', { score: Date.now(), member: twitchUser.login }).catch(() => {});
      redis.hset(`users:mention:meta:${twitchUser.login}`, {
        displayName: twitchUser.displayName,
        avatar:      twitchUser.avatar || '',
        updatedAt:   Date.now(),
      }).catch(() => {});

      return res.status(200).json({ ok: true, message });
    } catch (e) {
      console.error('Chat POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'invio del messaggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
