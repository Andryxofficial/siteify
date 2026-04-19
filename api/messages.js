import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

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
 *   userkeys:<user>              → String (ECDH public key JWK)
 *   conversations:<user>         → Sorted Set (score = last message timestamp, member = otherUser)
 *   messages:<user1>:<user2>     → List of JSON { id, from, to, encrypted, iv, createdAt,
 *                                    editedAt?, deleted? }
 *                                  (canonical order: sorted usernames)
 *   msg:counter                  → String (auto-increment message ID)
 *   media:<uuid>                 → String (base64-encoded encrypted media blob)
 *   media:<uuid>:meta            → String (JSON: { from, to, mimeType, name, createdAt })
 *
 * Endpoints:
 *   GET    /api/messages?action=key&user=<username>              → public key of a user
 *   POST   /api/messages  { action: "register_key", publicKey }  → register own public key
 *   GET    /api/messages?action=conversations                     → list all conversations
 *   GET    /api/messages?action=history&with=<user>&cursor=<n>   → message history
 *   POST   /api/messages  { action: "send", to, encrypted, iv }  → send message
 *   GET    /api/messages?action=poll&with=<user>&after=<id>&since=<ts> → new + edited msgs
 *   POST   /api/messages  { action: "edit", msgId, convoWith, encrypted, iv }  → edit msg
 *   POST   /api/messages  { action: "delete", msgId, convoWith } → soft-delete msg
 *   POST   /api/messages  { action: "upload_media", data, mimeType, name } → upload media
 *   GET    /api/messages?action=media&id=<uuid>                  → fetch encrypted media
 */

const MAX_MSG_SIZE = 8000;   // encrypted text blob max size (bytes)
const MAX_MEDIA_SIZE = 1_100_000; // ~1MB base64 — fits in Upstash 1MB value limit
const MSG_TTL_DAYS = 30;
const MSG_TTL_SECONDS = MSG_TTL_DAYS * 86400;
const MAX_HISTORY = 50;
const RATE_LIMIT_SECONDS = 2;
const MAX_SCAN = 500; // max messages to scan for edit/delete

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Scan a Redis list for a message by id. Returns { index, msg } or null.
 * Scans at most MAX_SCAN entries (from the end — most recent edits are recent messages).
 */
async function findMsgInList(redis, listKey, msgId) {
  const len = await redis.llen(listKey);
  if (!len) return null;
  const start = Math.max(0, len - MAX_SCAN);
  const raw = await redis.lrange(listKey, start, len - 1);
  for (let i = raw.length - 1; i >= 0; i--) {
    try {
      const m = typeof raw[i] === 'string' ? JSON.parse(raw[i]) : raw[i];
      if (m.id === msgId) return { index: start + i, msg: m };
    } catch (e) { console.warn('Malformed message in list:', e); }
  }
  return null;
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
      // @upstash/redis may auto-parse the stored JSON string into an object; normalize to string
      let publicKey = null;
      if (key !== null && key !== undefined) {
        if (typeof key === 'object') {
          try { publicKey = JSON.stringify(key); } catch { publicKey = null; }
        } else {
          publicKey = String(key);
        }
      }
      return res.status(200).json({ user, publicKey });
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

    // Poll for new messages AND edited/deleted messages since a given timestamp
    if (action === 'poll') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });

      try {
        const key = `messages:${convoKey(me, withUser)}`;
        const afterId = req.query?.after;
        const since = Number(req.query?.since) || 0; // timestamp — return changed msgs since
        const raw = await redis.lrange(key, -50, -1); // last 50

        const all = (raw || []).map(m => {
          try { return typeof m === 'string' ? JSON.parse(m) : m; }
          catch { return null; }
        }).filter(Boolean);

        // New messages (after lastMsgId)
        let newMessages = all;
        if (afterId) {
          const idx = all.findIndex(m => m.id === afterId);
          if (idx >= 0) newMessages = all.slice(idx + 1);
        }

        // Changed messages (edited or deleted after `since`)
        const changed = since > 0
          ? all.filter(m =>
            (m.editedAt && m.editedAt > since) ||
            (m.deleted && m.deletedAt && m.deletedAt > since)
          )
          : [];

        return res.status(200).json({ messages: newMessages, changed });
      } catch (e) {
        console.error('Messages poll error:', e);
        return res.status(500).json({ error: 'Errore nel polling dei messaggi.' });
      }
    }

    // Fetch encrypted media blob
    if (action === 'media') {
      const mediaId = sanitize(req.query?.id, 100);
      if (!mediaId) return res.status(400).json({ error: 'ID media richiesto.' });

      try {
        const metaRaw = await redis.get(`media:${mediaId}:meta`);
        if (!metaRaw) return res.status(404).json({ error: 'Media non trovato.' });
        const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;

        // Only the two parties of the conversation can access the media
        if (meta.from !== me && meta.to !== me) {
          return res.status(403).json({ error: 'Non autorizzato.' });
        }

        const data = await redis.get(`media:${mediaId}`);
        if (!data) return res.status(404).json({ error: 'Media non trovato.' });

        return res.status(200).json({ data, mimeType: meta.mimeType, name: meta.name });
      } catch (e) {
        console.error('Messages get_media error:', e);
        return res.status(500).json({ error: 'Errore nel recupero del media.' });
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

    // Edit an existing message (only own messages)
    if (action === 'edit') {
      const convoWith = sanitize(req.body.convoWith, 50).toLowerCase();
      const msgId = sanitize(req.body.msgId, 50);
      const encrypted = sanitize(req.body.encrypted, MAX_MSG_SIZE);
      const iv = sanitize(req.body.iv, 100);

      if (!convoWith || !msgId || !encrypted || !iv) {
        return res.status(400).json({ error: 'Campi richiesti mancanti.' });
      }

      const isFriend = await redis.sismember(`friends:${me}`, convoWith);
      if (!isFriend) return res.status(403).json({ error: 'Non autorizzato.' });

      try {
        const listKey = `messages:${convoKey(me, convoWith)}`;
        const found = await findMsgInList(redis, listKey, msgId);
        if (!found) return res.status(404).json({ error: 'Messaggio non trovato.' });
        if (found.msg.from !== me) return res.status(403).json({ error: 'Puoi modificare solo i tuoi messaggi.' });
        if (found.msg.deleted) return res.status(400).json({ error: 'Impossibile modificare un messaggio eliminato.' });

        const updated = { ...found.msg, encrypted, iv, editedAt: Date.now() };
        await redis.lset(listKey, found.index, JSON.stringify(updated));
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('Messages edit error:', e);
        return res.status(500).json({ error: 'Errore nella modifica del messaggio.' });
      }
    }

    // Soft-delete a message (only own messages)
    if (action === 'delete') {
      const convoWith = sanitize(req.body.convoWith, 50).toLowerCase();
      const msgId = sanitize(req.body.msgId, 50);

      if (!convoWith || !msgId) {
        return res.status(400).json({ error: 'Campi richiesti mancanti.' });
      }

      const isFriend = await redis.sismember(`friends:${me}`, convoWith);
      if (!isFriend) return res.status(403).json({ error: 'Non autorizzato.' });

      try {
        const listKey = `messages:${convoKey(me, convoWith)}`;
        const found = await findMsgInList(redis, listKey, msgId);
        if (!found) return res.status(404).json({ error: 'Messaggio non trovato.' });
        if (found.msg.from !== me) return res.status(403).json({ error: 'Puoi eliminare solo i tuoi messaggi.' });

        const tombstone = {
          id: found.msg.id,
          from: found.msg.from,
          to: found.msg.to,
          createdAt: found.msg.createdAt,
          deleted: true,
          deletedAt: Date.now(),
        };
        await redis.lset(listKey, found.index, JSON.stringify(tombstone));
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('Messages delete error:', e);
        return res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio.' });
      }
    }

    // Upload encrypted media blob (image / video)
    if (action === 'upload_media') {
      const to = sanitize(req.body.to, 50).toLowerCase();
      const data = req.body.data; // base64-encoded encrypted bytes
      const mimeType = sanitize(req.body.mimeType || '', 100);
      const name = sanitize(req.body.name || 'file', 200);

      if (!to || to === me) return res.status(400).json({ error: 'Destinatario non valido.' });
      if (!data || typeof data !== 'string') return res.status(400).json({ error: 'Data richiesta.' });
      if (data.length > MAX_MEDIA_SIZE) return res.status(413).json({ error: 'File troppo grande (max ~800KB).' });

      const isFriend = await redis.sismember(`friends:${me}`, to);
      if (!isFriend) return res.status(403).json({ error: 'Puoi inviare media solo agli amici.' });

      try {
        const mediaId = randomUUID();
        const meta = JSON.stringify({ from: me, to, mimeType, name, createdAt: Date.now() });

        await Promise.all([
          redis.set(`media:${mediaId}`, data, { ex: MSG_TTL_SECONDS }),
          redis.set(`media:${mediaId}:meta`, meta, { ex: MSG_TTL_SECONDS }),
        ]);

        return res.status(201).json({ mediaId });
      } catch (e) {
        console.error('Messages upload_media error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento del media.' });
      }
    }

    return res.status(400).json({ error: 'Azione POST non valida.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
