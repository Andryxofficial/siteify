import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

/**
 * Community Media API — upload e serve media pubblici (immagini, audio, video)
 * per post e risposte della community. Non cifrato (contenuto pubblico).
 *
 * Redis:
 *   community:media:<uuid>       → base64 del file (TTL 90gg)
 *   community:media:<uuid>:meta  → JSON { author, mimeType, name, size, createdAt } (TTL 90gg)
 *
 * POST /api/community-media  { action:'upload', data:base64, mimeType, name }
 *   → { mediaId, url }
 *
 * GET  /api/community-media?id=<mediaId>
 *   → binario con Content-Type corretto
 */

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const MAX_MEDIA_BYTES = 5_500_000; // ~4MB raw (5.5MB base64)
const MEDIA_TTL       = 90 * 86400; // 90 giorni

const MIME_AMMESSI = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif',
  'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav',
  'audio/x-m4a', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
]);

/* Normalizza MIME aliasi comuni ricevuti dal browser */
function normalizzaMime(mime) {
  if (!mime) return '';
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m === 'audio/x-wav') return 'audio/wav';
  if (m === 'video/x-mp4') return 'video/mp4';
  return m;
}

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

  /* ─── GET: serve il media come binario ─── */
  if (req.method === 'GET') {
    const mediaId = sanitize(req.query?.id || '', 100);
    if (!mediaId) return res.status(400).json({ error: 'ID media richiesto.' });

    try {
      const [rawData, rawMeta] = await Promise.all([
        redis.get(`community:media:${mediaId}`),
        redis.get(`community:media:${mediaId}:meta`),
      ]);

      if (!rawData || !rawMeta) return res.status(404).json({ error: 'Media non trovato.' });

      const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      const base64 = typeof rawData === 'string' ? rawData : String(rawData);

      const buffer = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=7776000, immutable'); // 90 giorni
      return res.status(200).end(buffer);
    } catch (e) {
      console.error('community-media GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero del media.' });
    }
  }

  /* ─── POST: carica un media ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });

    const { dataBase64, contentType: rawMime, name: rawName } = req.body || {};

    if (!dataBase64 || typeof dataBase64 !== 'string') return res.status(400).json({ error: 'Data base64 richiesta.' });
    if (dataBase64.length > MAX_MEDIA_BYTES) {
      return res.status(413).json({ error: 'File troppo grande (massimo ~4MB).' });
    }

    const mimeType = normalizzaMime(rawMime);
    if (!mimeType || !MIME_AMMESSI.has(mimeType)) {
      return res.status(415).json({ error: 'Tipo di file non supportato.' });
    }

    const name = sanitize(rawName || 'media', 200);

    try {
      const mediaId = randomUUID();
      const meta = JSON.stringify({
        author: twitchUser.login,
        mimeType,
        name,
        size: dataBase64.length,
        createdAt: Date.now(),
      });

      await Promise.all([
        redis.set(`community:media:${mediaId}`, dataBase64, { ex: MEDIA_TTL }),
        redis.set(`community:media:${mediaId}:meta`, meta, { ex: MEDIA_TTL }),
      ]);

      return res.status(201).json({
        id: mediaId,
        url: `/api/community-media?id=${mediaId}`,
      });
    } catch (e) {
      console.error('community-media POST error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento del media.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
