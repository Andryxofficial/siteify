import { Redis } from '@upstash/redis';

/**
 * Chat API — Chat generale della community ANDRYXify
 *
 * Redis data model:
 *   chat:messages              → List (newest first, max 200 entries, each JSON string)
 *   chat:ratelimit:<user>      → String with TTL 3 seconds
 *
 * GET    /api/chat?action=messages&limit=100   → messaggi pubblici (nessuna auth)
 * POST   /api/chat  { action: "send", text }   → invio messaggio (auth richiesta)
 */

const MAX_MESSAGES = 200;
const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_SECONDS = 3;

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

  /* ─── POST: invio messaggio ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) {
      return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    }

    try {
      const { action, text: rawText } = req.body || {};

      if (action !== 'send') {
        return res.status(400).json({ error: 'Azione non valida. Usa: action=send' });
      }

      const text = sanitize(rawText, MAX_TEXT_LENGTH);
      if (!text) {
        return res.status(400).json({ error: 'Il messaggio non può essere vuoto.' });
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
      };

      await redis.lpush('chat:messages', JSON.stringify(message));
      await redis.ltrim('chat:messages', 0, MAX_MESSAGES - 1);

      return res.status(200).json({ ok: true, message });
    } catch (e) {
      console.error('Chat POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'invio del messaggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
