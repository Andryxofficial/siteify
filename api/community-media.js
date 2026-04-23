import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

/**
 * Community Media API — Upload e download di media (immagini, audio, video)
 * allegati a post e risposte della community ANDRYXify.
 *
 * Redis data model:
 *   cm:<uuid>       → base64 data (nessun TTL — permanente come i post)
 *   cm:<uuid>:meta  → JSON { author, mimeType, name, mediaType, createdAt }
 *
 * POST /api/community-media  { action:'upload', data, mimeType, name, mediaType }
 *   → { mediaId }   (richiede Twitch auth Bearer)
 *
 * GET  /api/community-media?action=get&id=<mediaId>
 *   → { data, mimeType, name, mediaType }   (pubblico, nessuna auth)
 */

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const MAX_DATA_SIZE = 8_000_000; // ~8 MB base64 ≈ 6 MB raw
const VALID_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
/* SVG bloccato: può contenere script e abilitare XSS se caricato come <object>/<embed> */
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
  return { login: data.login };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch {
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  /* ─── GET: scarica media (pubblico) ─── */
  if (req.method === 'GET') {
    if (req.query?.action !== 'get') return res.status(400).json({ error: 'Azione non valida.' });
    const id = sanitize(req.query?.id || '', 100);
    if (!id) return res.status(400).json({ error: 'ID media richiesto.' });
    try {
      const metaRaw = await redis.get(`cm:${id}:meta`);
      if (!metaRaw) return res.status(404).json({ error: 'Media non trovato.' });
      const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
      const data = await redis.get(`cm:${id}`);
      if (!data) return res.status(404).json({ error: 'Media non trovato.' });
      return res.status(200).json({
        data,
        mimeType: meta.mimeType,
        name: meta.name,
        mediaType: meta.mediaType,
      });
    } catch (e) {
      console.error('community-media GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero del media.' });
    }
  }

  /* ─── POST: carica media (richiede auth) ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });

    const { action, data, mimeType: rawMime, name: rawName, mediaType: rawMediaType } = req.body || {};
    if (action !== 'upload') return res.status(400).json({ error: 'Azione non valida.' });
    if (!data || typeof data !== 'string') return res.status(400).json({ error: 'Dati media richiesti.' });
    if (data.length > MAX_DATA_SIZE) return res.status(413).json({ error: 'File troppo grande (max ~6 MB).' });

    const mimeType = sanitize(rawMime || '', 100);
    if (!VALID_MIME_PREFIXES.some(p => mimeType.startsWith(p)) || BLOCKED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo MIME non supportato. Usa immagine (non SVG), audio o video.' });
    }

    const name      = sanitize(rawName || 'file', 200);
    const mediaType = ['image', 'audio', 'video'].includes(rawMediaType) ? rawMediaType : 'image';

    try {
      const mediaId = randomUUID();
      const meta = JSON.stringify({
        author: twitchUser.login,
        mimeType,
        name,
        mediaType,
        createdAt: Date.now(),
      });
      await Promise.all([
        redis.set(`cm:${mediaId}`, data),
        redis.set(`cm:${mediaId}:meta`, meta),
      ]);
      return res.status(201).json({ mediaId });
    } catch (e) {
      console.error('community-media POST error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento del media.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
