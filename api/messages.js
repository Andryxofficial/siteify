import { Redis } from '@upstash/redis';

/**
 * E2E Encrypted Messages API — Private messaging for ANDRYXify
 *
 * Architecture:
 *   - Client generates ECDH key pair on first login
 *   - Public key stored in Redis (`userkeys:<user>`)
 *   - Messages encrypted client-side with AES-GCM (derived from ECDH shared secret)
 *   - Server stores only encrypted blobs — zero knowledge
 *   - Messages expire after 30 days (TTL)
 *
 * Redis data model:
 *   userkeys:<user>              → String (base64-encoded ECDH public key JWK)
 *   conversations:<user>         → Sorted Set (score = last message timestamp, member = otherUser)
 *   messages:<user1>:<user2>     → List of JSON { id, from, to, encrypted, iv, createdAt }
 *                                  (canonical order: sorted usernames)
 *   msg:counter                  → String (auto-increment message ID)
 *
 * Endpoints:
 *   GET    /api/messages?action=key&user=<username>    → get public key of a user
 *   POST   /api/messages  { action: "register_key", publicKey }  → register own public key
 *   GET    /api/messages?action=conversations          → list all conversations
 *   GET    /api/messages?action=history&with=<user>&cursor=<n>  → get message history
 *   POST   /api/messages  { action: "send", to, encrypted, iv } → send encrypted message
 *   GET    /api/messages?action=poll&with=<user>&after=<id>     → poll new messages
 */

const MAX_MSG_SIZE = 8000; // encrypted blob max size
const MSG_TTL_DAYS = 30;
const MSG_TTL_SECONDS = MSG_TTL_DAYS * 86400;
const MAX_HISTORY = 50;
const RATE_LIMIT_SECONDS = 2;

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** Canonical conversation key — alphabetically sorted usernames */
function convoKey(a, b) {
  return [a, b].sort().join(':');
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

  /* ─── GET ─── */
  if (req.method === 'GET') {
    const action = req.query?.action;

    // Public key lookup (no auth required for reading public keys)
    if (action === 'key') {
      const user = sanitize(req.query?.user, 50).toLowerCase();
      if (!user) return res.status(400).json({ error: 'Username richiesto.' });
      const key = await redis.get(`userkeys:${user}`);
      return res.status(200).json({ user, publicKey: key || null });
    }

    // Everything else requires auth
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) {
      return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    }
    const me = twitchUser.login;

    // List conversations
    if (action === 'conversations') {
      try {
        const convos = await redis.zrange(`conversations:${me}`, 0, -1, { rev: true, withScores: true });
        // convos comes as [member, score, member, score, ...]
        const result = [];
        if (Array.isArray(convos)) {
          for (let i = 0; i < convos.length; i += 2) {
            result.push({ user: convos[i], lastMessageAt: Number(convos[i + 1]) });
          }
        }
        return res.status(200).json({ conversations: result });
      } catch (e) {
        console.error('Messages conversations error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento delle conversazioni.' });
      }
    }

    // Message history
    if (action === 'history') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });

      // Check friendship
      const isFriend = await redis.sismember(`friends:${me}`, withUser);
      if (!isFriend) {
        return res.status(403).json({ error: 'Puoi inviare messaggi solo agli amici.' });
      }

      try {
        const key = `messages:${convoKey(me, withUser)}`;
        const cursor = Math.max(0, parseInt(req.query?.cursor) || 0);
        const raw = await redis.lrange(key, cursor, cursor + MAX_HISTORY - 1);

        const messages = (raw || []).map(m => {
          try { return typeof m === 'string' ? JSON.parse(m) : m; }
          catch { return null; }
        }).filter(Boolean);

        return res.status(200).json({ messages, cursor: cursor + messages.length, hasMore: messages.length >= MAX_HISTORY });
      } catch (e) {
        console.error('Messages history error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento dei messaggi.' });
      }
    }

    // Poll for new messages
    if (action === 'poll') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });

      try {
        const key = `messages:${convoKey(me, withUser)}`;
        const afterId = req.query?.after;
        const raw = await redis.lrange(key, -50, -1); // last 50

        let messages = (raw || []).map(m => {
          try { return typeof m === 'string' ? JSON.parse(m) : m; }
          catch { return null; }
        }).filter(Boolean);

        if (afterId) {
          const idx = messages.findIndex(m => m.id === afterId);
          if (idx >= 0) messages = messages.slice(idx + 1);
        }

        return res.status(200).json({ messages });
      } catch (e) {
        console.error('Messages poll error:', e);
        return res.status(500).json({ error: 'Errore nel polling dei messaggi.' });
      }
    }

    return res.status(400).json({ error: 'Azione GET non valida.' });
  }

  /* ─── POST ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) {
      return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    }
    const me = twitchUser.login;
    const { action } = req.body || {};

    // Register public key
    if (action === 'register_key') {
      const publicKey = sanitize(req.body.publicKey, 2000);
      if (!publicKey) {
        return res.status(400).json({ error: 'Chiave pubblica richiesta.' });
      }
      await redis.set(`userkeys:${me}`, publicKey);
      return res.status(200).json({ ok: true });
    }

    // Send encrypted message
    if (action === 'send') {
      const to = sanitize(req.body.to, 50).toLowerCase();
      const encrypted = sanitize(req.body.encrypted, MAX_MSG_SIZE);
      const iv = sanitize(req.body.iv, 100);

      if (!to || to === me) {
        return res.status(400).json({ error: 'Destinatario non valido.' });
      }
      if (!encrypted || !iv) {
        return res.status(400).json({ error: 'Messaggio crittografato e IV richiesti.' });
      }

      // Check friendship
      const isFriend = await redis.sismember(`friends:${me}`, to);
      if (!isFriend) {
        return res.status(403).json({ error: 'Puoi inviare messaggi solo agli amici.' });
      }

      // Rate limit
      const rlKey = `msg:ratelimit:${me}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta prima di inviare un altro messaggio.' });
      }

      try {
        const msgId = String(await redis.incr('msg:counter'));
        const now = Date.now();

        const message = {
          id: msgId,
          from: me,
          to,
          encrypted,
          iv,
          createdAt: now,
        };

        const convo = convoKey(me, to);
        const msgKey = `messages:${convo}`;

        await Promise.all([
          redis.rpush(msgKey, JSON.stringify(message)),
          redis.expire(msgKey, MSG_TTL_SECONDS),
          redis.zadd(`conversations:${me}`, { score: now, member: to }),
          redis.zadd(`conversations:${to}`, { score: now, member: me }),
          redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS }),
        ]);

        return res.status(201).json({ message: { id: msgId, from: me, to, createdAt: now } });
      } catch (e) {
        console.error('Messages send error:', e);
        return res.status(500).json({ error: 'Errore nell\'invio del messaggio.' });
      }
    }

    return res.status(400).json({ error: 'Azione POST non valida.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
