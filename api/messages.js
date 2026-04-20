import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

/**
 * Messaggi Privati E2E — ANDRYXify v3
 *
 * Architettura:
 *   - Ogni utente genera una coppia ECDH P-256 al primo accesso
 *   - La chiave privata è cifrata dalla passkey (WebAuthn PRF) e salvata in IDB
 *   - I messaggi sono cifrati client-side (ECDH + AES-GCM)
 *   - Il server non conosce le chiavi private — zero-knowledge
 *   - Sincronizzazione multi-dispositivo via protocollo ECDH efimero
 *
 * Modello dati Redis:
 *   userkeys:<user>              → JWK chiave pubblica ECDH
 *   e2e_passkey:<user>           → JSON { credentialId, encryptedPrivateKey, iv, publicKey }
 *   conversations:<user>         → Sorted Set (score=timestamp, member=altroUtente)
 *   messages:<u1>:<u2>           → List JSON { id,from,to,encrypted,iv,createdAt,editedAt?,deleted? }
 *   msg:counter                  → auto-increment ID messaggi
 *   media:<uuid>                 → base64 blob cifrato
 *   media:<uuid>:meta            → JSON { from,to,mimeType,name,createdAt }
 *   sync:<sessionId>             → JSON sessione sync efimera, TTL 5min
 *   sync_code:<code6>            → sessionId, TTL 5min
 */

const MAX_MSG_SIZE    = 8000;
const MAX_MEDIA_SIZE  = 1_100_000;
const MSG_TTL_SECONDS = 30 * 86400;
const MAX_HISTORY     = 50;
const RATE_LIMIT_SEC  = 2;
const MAX_SCAN        = 500;
const SYNC_TTL        = 300; // 5 minuti
const MAX_ENRICHED_CONVERSATIONS = 30;
const MEDIA_SIZE_THRESHOLD       = 10000; // soglia caratteri encrypted per distinguere media da testo
const TYPING_TTL      = 8;  // indicatore digitazione scade dopo 8 secondi
const ONLINE_TTL      = 90; // stato online scade dopo 90 secondi
const MAX_REACTIONS_PER_MSG = 20;
const ALLOWED_REACTIONS     = ['❤️','😂','👍','🔥','😮','😢','🎉','💀'];

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function convoKey(a, b) {
  return [a, b].sort().join(':');
}

async function findMsgInList(redis, listKey, msgId) {
  const len = await redis.llen(listKey);
  if (!len) return null;
  const start = Math.max(0, len - MAX_SCAN);
  const raw = await redis.lrange(listKey, start, len - 1);
  for (let i = raw.length - 1; i >= 0; i--) {
    try {
      const m = typeof raw[i] === 'string' ? JSON.parse(raw[i]) : raw[i];
      if (m.id === msgId) return { index: start + i, msg: m };
    } catch { /* malformato */ }
  }
  return null;
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
  return { login: data.login, userId: data.user_id || null };
}

async function generaCodice(redis) {
  for (let t = 0; t < 20; t++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await redis.exists(`sync_code:${code}`);
    if (!exists) return code;
  }
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
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

  /* ═══════════════════ GET ═══════════════════ */
  if (req.method === 'GET') {
    const action = req.query?.action;

    if (action === 'key') {
      const user = sanitize(req.query?.user, 50).toLowerCase();
      if (!user) return res.status(400).json({ error: 'Username richiesto.' });
      const key = await redis.get(`userkeys:${user}`);
      let publicKey = null;
      if (key !== null && key !== undefined) {
        publicKey = typeof key === 'object' ? JSON.stringify(key) : String(key);
      }
      return res.status(200).json({ user, publicKey });
    }

    if (action === 'has_passkey_backup') {
      const user = sanitize(req.query?.user, 50).toLowerCase();
      if (!user) return res.status(400).json({ error: 'Username richiesto.' });
      const exists = await redis.exists(`e2e_passkey:${user}`);
      return res.status(200).json({ hasBackup: !!exists });
    }

    if (action === 'sync_peek') {
      const code = sanitize(req.query?.code, 10).toUpperCase();
      if (!code) return res.status(400).json({ error: 'Codice richiesto.' });
      const sessionId = await redis.get(`sync_code:${code}`);
      if (!sessionId) return res.status(404).json({ error: 'Codice scaduto o non valido.' });
      const raw = await redis.get(`sync:${sessionId}`);
      if (!raw) return res.status(404).json({ error: 'Sessione scaduta.' });
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json({
        sessionId,
        initiatorEphemeralPubKey: session.initiatorEphemeralPubKey,
        status: session.status,
      });
    }

    if (action === 'sync_status') {
      const sessionId = sanitize(req.query?.sessionId, 100);
      if (!sessionId) return res.status(400).json({ error: 'sessionId richiesto.' });
      const raw = await redis.get(`sync:${sessionId}`);
      if (!raw) return res.status(200).json({ status: 'expired' });
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json({
        status: session.status,
        joinerEphemeralPubKey: session.joinerEphemeralPubKey || null,
        encryptedKey: session.encryptedKey || null,
        iv: session.iv || null,
        initiatorEphemeralPubKey: session.initiatorEphemeralPubKey,
      });
    }

    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    const me = twitchUser.login;

    if (action === 'conversations') {
      try {
        const convos = await redis.zrange(`conversations:${me}`, 0, -1, { rev: true, withScores: true });
        const entries = [];
        if (Array.isArray(convos)) {
          for (let i = 0; i < convos.length; i += 2) {
            entries.push({ user: convos[i], lastMessageAt: Number(convos[i + 1]) });
          }
        }
        const result = await Promise.all(entries.slice(0, MAX_ENRICHED_CONVERSATIONS).map(async (entry) => {
          const ck = convoKey(me, entry.user);
          const listKey = `messages:${ck}`;
          const [lastRaw, lastReadRaw] = await Promise.all([
            redis.lrange(listKey, -1, -1),
            redis.get(`lastread:${me}:${entry.user}`),
          ]);
          let lastMessage = null;
          if (lastRaw?.length > 0) {
            try {
              const full = typeof lastRaw[0] === 'string' ? JSON.parse(lastRaw[0]) : lastRaw[0];
              const isMedia = (full.encrypted?.length || 0) > MEDIA_SIZE_THRESHOLD;
              lastMessage = {
                id: full.id, from: full.from, to: full.to,
                createdAt: full.createdAt, deleted: full.deleted || false,
                encrypted: isMedia ? null : full.encrypted,
                iv: isMedia ? null : full.iv,
                isMedia,
              };
            } catch { /* skip */ }
          }
          let unread = 0;
          const lastReadTs = lastReadRaw ? Number(lastReadRaw) : 0;
          if (lastMessage && lastMessage.from !== me && !lastMessage.deleted && lastMessage.createdAt > lastReadTs) {
            const recent = await redis.lrange(listKey, -30, -1);
            for (const raw of recent) {
              try {
                const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (m.from !== me && !m.deleted && m.createdAt > lastReadTs) unread++;
              } catch { /* skip */ }
            }
          }
          return { ...entry, lastMessage, unread };
        }));
        if (entries.length > MAX_ENRICHED_CONVERSATIONS) result.push(...entries.slice(MAX_ENRICHED_CONVERSATIONS));
        return res.status(200).json({ conversations: result });
      } catch (e) {
        console.error('conversations error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento delle conversazioni.' });
      }
    }

    if (action === 'history') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });
      const isFriend = await redis.sismember(`friends:${me}`, withUser);
      if (!isFriend) return res.status(403).json({ error: 'Puoi inviare messaggi solo agli amici.' });
      try {
        const key    = `messages:${convoKey(me, withUser)}`;
        const cursor = Math.max(0, parseInt(req.query?.cursor) || 0);
        const raw    = await redis.lrange(key, cursor, cursor + MAX_HISTORY - 1);
        const messages = (raw || []).map(m => {
          try { return typeof m === 'string' ? JSON.parse(m) : m; } catch { return null; }
        }).filter(Boolean);
        return res.status(200).json({ messages, cursor: cursor + messages.length, hasMore: messages.length >= MAX_HISTORY });
      } catch (e) {
        console.error('history error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento dei messaggi.' });
      }
    }

    if (action === 'poll') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });
      try {
        const key     = `messages:${convoKey(me, withUser)}`;
        const afterId = req.query?.after;
        const since   = Number(req.query?.since) || 0;
        const raw     = await redis.lrange(key, -50, -1);
        const all     = (raw || []).map(m => {
          try { return typeof m === 'string' ? JSON.parse(m) : m; } catch { return null; }
        }).filter(Boolean);
        let newMessages = all;
        if (afterId) {
          const idx = all.findIndex(m => m.id === afterId);
          if (idx >= 0) newMessages = all.slice(idx + 1);
        }
        const changed = since > 0 ? all.filter(m =>
          (m.editedAt && m.editedAt > since) || (m.deleted && m.deletedAt && m.deletedAt > since)
        ) : [];
        return res.status(200).json({ messages: newMessages, changed });
      } catch (e) {
        console.error('poll error:', e);
        return res.status(500).json({ error: 'Errore nel polling dei messaggi.' });
      }
    }

    if (action === 'get_passkey_backup') {
      try {
        const raw = await redis.get(`e2e_passkey:${me}`);
        if (!raw) return res.status(404).json({ error: 'Nessun backup trovato.' });
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return res.status(200).json(data);
      } catch (e) {
        console.error('get_passkey_backup error:', e);
        return res.status(500).json({ error: 'Errore nel recupero del backup.' });
      }
    }

    if (action === 'media') {
      const mediaId = sanitize(req.query?.id, 100);
      if (!mediaId) return res.status(400).json({ error: 'ID media richiesto.' });
      try {
        const metaRaw = await redis.get(`media:${mediaId}:meta`);
        if (!metaRaw) return res.status(404).json({ error: 'Media non trovato.' });
        const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
        if (meta.from !== me && meta.to !== me) return res.status(403).json({ error: 'Non autorizzato.' });
        const data = await redis.get(`media:${mediaId}`);
        if (!data) return res.status(404).json({ error: 'Media non trovato.' });
        return res.status(200).json({ data, mimeType: meta.mimeType, name: meta.name });
      } catch (e) {
        console.error('get_media error:', e);
        return res.status(500).json({ error: 'Errore nel recupero del media.' });
      }
    }

    /* ── Controlla se l'altro utente sta digitando ── */
    if (action === 'typing_status') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });
      try {
        const typing = await redis.get(`typing:${withUser}:${me}`);
        return res.status(200).json({ typing: !!typing });
      } catch {
        return res.status(200).json({ typing: false });
      }
    }

    /* ── Stato online utente ── */
    if (action === 'online_status') {
      const users = sanitize(req.query?.users || '', 1000).toLowerCase();
      if (!users) return res.status(400).json({ error: 'Lista utenti richiesta.' });
      try {
        const userList = users.split(',').filter(u => u && u.length <= 50).slice(0, 30);
        const pipeline = userList.map(u => redis.get(`online:${u}`));
        const results = await Promise.all(pipeline);
        const online = {};
        userList.forEach((u, i) => { online[u] = !!results[i]; });
        return res.status(200).json({ online });
      } catch {
        return res.status(200).json({ online: {} });
      }
    }

    /* ── Reazioni a un messaggio ── */
    if (action === 'reactions') {
      const withUser = sanitize(req.query?.with, 50).toLowerCase();
      const msgId    = sanitize(req.query?.msgId, 50);
      if (!withUser || !msgId) return res.status(400).json({ error: 'Parametri mancanti.' });
      try {
        const key = `reactions:${convoKey(me, withUser)}:${msgId}`;
        const raw = await redis.get(key);
        const reactions = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        return res.status(200).json({ reactions });
      } catch {
        return res.status(200).json({ reactions: [] });
      }
    }

    return res.status(400).json({ error: 'Azione GET non valida.' });
  }

  /* ═══════════════════ POST ═══════════════════ */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    const me = twitchUser.login;
    const { action } = req.body || {};

    if (action === 'register_key') {
      const publicKey = sanitize(req.body.publicKey, 2000);
      if (!publicKey) return res.status(400).json({ error: 'Chiave pubblica richiesta.' });
      await redis.set(`userkeys:${me}`, publicKey);
      return res.status(200).json({ ok: true });
    }

    if (action === 'save_passkey_backup') {
      const credentialId        = sanitize(req.body.credentialId, 500);
      const encryptedPrivateKey = sanitize(req.body.encryptedPrivateKey, 5000);
      const iv                  = sanitize(req.body.iv, 100);
      const publicKey           = sanitize(req.body.publicKey, 2000);
      if (!credentialId || !encryptedPrivateKey || !iv) {
        return res.status(400).json({ error: 'Dati backup incompleti.' });
      }
      const backup = JSON.stringify({ credentialId, encryptedPrivateKey, iv, publicKey: publicKey || null, savedAt: Date.now() });
      await redis.set(`e2e_passkey:${me}`, backup);
      if (publicKey) await redis.set(`userkeys:${me}`, publicKey);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_passkey_backup') {
      try {
        await redis.del(`e2e_passkey:${me}`);
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('delete_passkey_backup error:', e);
        return res.status(500).json({ error: 'Errore nella rimozione del backup.' });
      }
    }

    if (action === 'mark_read') {
      const withUser = sanitize(req.body.withUser, 50).toLowerCase();
      if (!withUser) return res.status(400).json({ error: 'Destinatario richiesto.' });
      try {
        await redis.set(`lastread:${me}:${withUser}`, Date.now());
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('mark_read error:', e);
        return res.status(500).json({ error: 'Errore nel salvataggio della lettura.' });
      }
    }

    if (action === 'send') {
      const to        = sanitize(req.body.to, 50).toLowerCase();
      const encrypted = sanitize(req.body.encrypted, MAX_MSG_SIZE);
      const iv        = sanitize(req.body.iv, 100);
      if (!to || to === me) return res.status(400).json({ error: 'Destinatario non valido.' });
      if (!encrypted || !iv) return res.status(400).json({ error: 'Messaggio cifrato e IV richiesti.' });
      const isFriend = await redis.sismember(`friends:${me}`, to);
      if (!isFriend) return res.status(403).json({ error: 'Puoi inviare messaggi solo agli amici.' });
      const rlKey    = `msg:ratelimit:${me}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) return res.status(429).json({ error: 'Aspetta prima di inviare un altro messaggio.' });
      try {
        const msgId   = String(await redis.incr('msg:counter'));
        const now     = Date.now();
        const message = { id: msgId, from: me, to, encrypted, iv, createdAt: now };
        const convo   = convoKey(me, to);
        const msgKey  = `messages:${convo}`;
        await Promise.all([
          redis.rpush(msgKey, JSON.stringify(message)),
          redis.expire(msgKey, MSG_TTL_SECONDS),
          redis.zadd(`conversations:${me}`, { score: now, member: to }),
          redis.zadd(`conversations:${to}`,  { score: now, member: me }),
          redis.set(rlKey, '1', { ex: RATE_LIMIT_SEC }),
          redis.set(`lastread:${me}:${to}`, now),
        ]);
        return res.status(201).json({ message: { id: msgId, from: me, to, createdAt: now } });
      } catch (e) {
        console.error('send error:', e);
        return res.status(500).json({ error: "Errore nell'invio del messaggio." });
      }
    }

    if (action === 'edit') {
      const convoWith = sanitize(req.body.convoWith, 50).toLowerCase();
      const msgId     = sanitize(req.body.msgId, 50);
      const encrypted = sanitize(req.body.encrypted, MAX_MSG_SIZE);
      const iv        = sanitize(req.body.iv, 100);
      if (!convoWith || !msgId || !encrypted || !iv) return res.status(400).json({ error: 'Campi richiesti mancanti.' });
      const isFriend = await redis.sismember(`friends:${me}`, convoWith);
      if (!isFriend) return res.status(403).json({ error: 'Non autorizzato.' });
      try {
        const listKey = `messages:${convoKey(me, convoWith)}`;
        const found   = await findMsgInList(redis, listKey, msgId);
        if (!found) return res.status(404).json({ error: 'Messaggio non trovato.' });
        if (found.msg.from !== me) return res.status(403).json({ error: 'Puoi modificare solo i tuoi messaggi.' });
        if (found.msg.deleted) return res.status(400).json({ error: 'Impossibile modificare un messaggio eliminato.' });
        await redis.lset(listKey, found.index, JSON.stringify({ ...found.msg, encrypted, iv, editedAt: Date.now() }));
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('edit error:', e);
        return res.status(500).json({ error: 'Errore nella modifica del messaggio.' });
      }
    }

    if (action === 'delete') {
      const convoWith = sanitize(req.body.convoWith, 50).toLowerCase();
      const msgId     = sanitize(req.body.msgId, 50);
      if (!convoWith || !msgId) return res.status(400).json({ error: 'Campi richiesti mancanti.' });
      const isFriend = await redis.sismember(`friends:${me}`, convoWith);
      if (!isFriend) return res.status(403).json({ error: 'Non autorizzato.' });
      try {
        const listKey   = `messages:${convoKey(me, convoWith)}`;
        const found     = await findMsgInList(redis, listKey, msgId);
        if (!found) return res.status(404).json({ error: 'Messaggio non trovato.' });
        if (found.msg.from !== me) return res.status(403).json({ error: 'Puoi eliminare solo i tuoi messaggi.' });
        const tombstone = { id: found.msg.id, from: found.msg.from, to: found.msg.to, createdAt: found.msg.createdAt, deleted: true, deletedAt: Date.now() };
        await redis.lset(listKey, found.index, JSON.stringify(tombstone));
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('delete error:', e);
        return res.status(500).json({ error: "Errore nell'eliminazione del messaggio." });
      }
    }

    if (action === 'upload_media') {
      const to       = sanitize(req.body.to, 50).toLowerCase();
      const data     = req.body.data;
      const mimeType = sanitize(req.body.mimeType || '', 100);
      const name     = sanitize(req.body.name || 'file', 200);
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
        console.error('upload_media error:', e);
        return res.status(500).json({ error: 'Errore nel caricamento del media.' });
      }
    }

    /* ═══ Sincronizzazione multi-dispositivo ═══ */

    if (action === 'sync_start') {
      const initiatorEphemeralPubKey = sanitize(req.body.initiatorEphemeralPubKey, 2000);
      if (!initiatorEphemeralPubKey) return res.status(400).json({ error: 'Chiave efimera richiesta.' });
      try {
        const sessionId = randomUUID();
        const code      = await generaCodice(redis);
        const session   = JSON.stringify({
          owner: me,
          initiatorEphemeralPubKey,
          status: 'waiting',
          createdAt: Date.now(),
        });
        await Promise.all([
          redis.set(`sync:${sessionId}`, session, { ex: SYNC_TTL }),
          redis.set(`sync_code:${code}`, sessionId, { ex: SYNC_TTL }),
        ]);
        return res.status(200).json({ sessionId, code });
      } catch (e) {
        console.error('sync_start error:', e);
        return res.status(500).json({ error: 'Errore nella creazione della sessione di sync.' });
      }
    }

    if (action === 'sync_join') {
      const code                  = sanitize(req.body.code, 10).toUpperCase();
      const joinerEphemeralPubKey = sanitize(req.body.joinerEphemeralPubKey, 2000);
      if (!code || !joinerEphemeralPubKey) return res.status(400).json({ error: 'Codice e chiave efimera richiesti.' });
      try {
        const sessionId = await redis.get(`sync_code:${code}`);
        if (!sessionId) return res.status(404).json({ error: 'Codice scaduto o non valido.' });
        const raw = await redis.get(`sync:${sessionId}`);
        if (!raw) return res.status(404).json({ error: 'Sessione scaduta.' });
        const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (session.status !== 'waiting') return res.status(409).json({ error: 'Sessione già utilizzata.' });
        const updated = JSON.stringify({ ...session, joinerEphemeralPubKey, joiner: me, status: 'joined' });
        const ttlLeft = await redis.ttl(`sync:${sessionId}`);
        await redis.set(`sync:${sessionId}`, updated, { ex: Math.max(ttlLeft, 30) });
        return res.status(200).json({ sessionId, initiatorEphemeralPubKey: session.initiatorEphemeralPubKey });
      } catch (e) {
        console.error('sync_join error:', e);
        return res.status(500).json({ error: "Errore nell'unione alla sessione di sync." });
      }
    }

    if (action === 'sync_deliver') {
      const sessionId    = sanitize(req.body.sessionId, 100);
      const encryptedKey = sanitize(req.body.encryptedKey, 5000);
      const iv           = sanitize(req.body.iv, 100);
      if (!sessionId || !encryptedKey || !iv) return res.status(400).json({ error: 'Dati richiesti mancanti.' });
      try {
        const raw = await redis.get(`sync:${sessionId}`);
        if (!raw) return res.status(404).json({ error: 'Sessione scaduta.' });
        const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (session.owner !== me) return res.status(403).json({ error: 'Non autorizzato.' });
        if (session.status !== 'joined') return res.status(409).json({ error: 'Nessun dispositivo ha ancora aderito alla sessione.' });
        const updated = JSON.stringify({ ...session, encryptedKey, iv, status: 'ready' });
        const ttlLeft = await redis.ttl(`sync:${sessionId}`);
        await redis.set(`sync:${sessionId}`, updated, { ex: Math.max(ttlLeft, 60) });
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('sync_deliver error:', e);
        return res.status(500).json({ error: 'Errore nella consegna della chiave.' });
      }
    }

    if (action === 'sync_complete') {
      const sessionId = sanitize(req.body.sessionId, 100);
      if (!sessionId) return res.status(400).json({ error: 'sessionId richiesto.' });
      try {
        const raw = await redis.get(`sync:${sessionId}`);
        if (raw) {
          const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (session.joiner && session.joiner !== me) return res.status(403).json({ error: 'Non autorizzato.' });
          await redis.del(`sync:${sessionId}`);
        }
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('sync_complete error:', e);
        return res.status(500).json({ error: 'Errore nella finalizzazione del sync.' });
      }
    }

    /* ── Segnala che sto digitando ── */
    if (action === 'typing') {
      const to = sanitize(req.body.to, 50).toLowerCase();
      if (!to || to === me) return res.status(400).json({ error: 'Destinatario non valido.' });
      try {
        await redis.set(`typing:${me}:${to}`, '1', { ex: TYPING_TTL });
        return res.status(200).json({ ok: true });
      } catch {
        return res.status(200).json({ ok: true });
      }
    }

    /* ── Heartbeat: aggiorna stato online ── */
    if (action === 'heartbeat') {
      try {
        await redis.set(`online:${me}`, Date.now(), { ex: ONLINE_TTL });
        return res.status(200).json({ ok: true });
      } catch {
        return res.status(200).json({ ok: true });
      }
    }

    /* ── Aggiungi/rimuovi reazione a un messaggio ── */
    if (action === 'react') {
      const convoWith = sanitize(req.body.convoWith, 50).toLowerCase();
      const msgId     = sanitize(req.body.msgId, 50);
      const emoji     = (req.body.emoji || '').trim();
      if (!convoWith || !msgId || !emoji) return res.status(400).json({ error: 'Parametri mancanti.' });
      if (!ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Reazione non supportata.' });
      try {
        const key = `reactions:${convoKey(me, convoWith)}:${msgId}`;
        const raw = await redis.get(key);
        let reactions = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        if (!Array.isArray(reactions)) reactions = [];
        const esistente = reactions.findIndex(r => r.user === me && r.emoji === emoji);
        if (esistente >= 0) {
          reactions.splice(esistente, 1);
        } else {
          if (reactions.length >= MAX_REACTIONS_PER_MSG) return res.status(400).json({ error: 'Troppe reazioni.' });
          reactions.push({ user: me, emoji, ts: Date.now() });
        }
        await redis.set(key, JSON.stringify(reactions), { ex: MSG_TTL_SECONDS });
        return res.status(200).json({ reactions });
      } catch (e) {
        console.error('react error:', e);
        return res.status(500).json({ error: 'Errore nella reazione.' });
      }
    }

    /* ── Rispondi a un messaggio (reply_to) ── */
    if (action === 'send_reply') {
      const to        = sanitize(req.body.to, 50).toLowerCase();
      const encrypted = sanitize(req.body.encrypted, MAX_MSG_SIZE);
      const iv        = sanitize(req.body.iv, 100);
      const replyToId = sanitize(req.body.replyToId, 50);
      const replyPreview = sanitize(req.body.replyPreview, 200);
      if (!to || to === me) return res.status(400).json({ error: 'Destinatario non valido.' });
      if (!encrypted || !iv) return res.status(400).json({ error: 'Messaggio cifrato e IV richiesti.' });
      const isFriend = await redis.sismember(`friends:${me}`, to);
      if (!isFriend) return res.status(403).json({ error: 'Puoi inviare messaggi solo agli amici.' });
      const rlKey    = `msg:ratelimit:${me}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) return res.status(429).json({ error: 'Aspetta prima di inviare un altro messaggio.' });
      try {
        const msgId   = String(await redis.incr('msg:counter'));
        const now     = Date.now();
        const message = { id: msgId, from: me, to, encrypted, iv, createdAt: now, replyToId: replyToId || null, replyPreview: replyPreview || null };
        const convo   = convoKey(me, to);
        const msgKey  = `messages:${convo}`;
        await Promise.all([
          redis.rpush(msgKey, JSON.stringify(message)),
          redis.expire(msgKey, MSG_TTL_SECONDS),
          redis.zadd(`conversations:${me}`, { score: now, member: to }),
          redis.zadd(`conversations:${to}`,  { score: now, member: me }),
          redis.set(rlKey, '1', { ex: RATE_LIMIT_SEC }),
          redis.set(`lastread:${me}:${to}`, now),
        ]);
        return res.status(201).json({ message: { id: msgId, from: me, to, createdAt: now, replyToId: replyToId || null, replyPreview: replyPreview || null } });
      } catch (e) {
        console.error('send_reply error:', e);
        return res.status(500).json({ error: "Errore nell'invio del messaggio." });
      }
    }

    return res.status(400).json({ error: 'Azione POST non valida.' });
  }

  return res.status(405).json({ error: 'Metodo non consentito.' });
}
