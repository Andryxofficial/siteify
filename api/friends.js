import { Redis } from '@upstash/redis';

/**
 * Friends API — Social friend system for ANDRYXify
 *
 * Redis data model:
 *   friends:<user>              → Set of usernames (accepted friends)
 *   friend_requests:<user>      → Hash { fromUser: JSON{ from, avatar, display, createdAt } }
 *   friend_requests_sent:<user> → Set of usernames (pending outgoing)
 *
 * GET    /api/friends                              → list friends + pending requests
 * GET    /api/friends?user=<username>              → check friendship status with a user
 * POST   /api/friends  { action, target }          → send/accept/reject/cancel/remove
 */

const MAX_FRIENDS = 200;
const RATE_LIMIT_SECONDS = 5;

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

  const twitchUser = await validateTwitch(req.headers.authorization);
  if (!twitchUser) {
    return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
  }

  const me = twitchUser.login;

  /* ─── GET: list friends + requests, or check status with a user ─── */
  if (req.method === 'GET') {
    try {
      const targetUser = req.query?.user;

      // Check friendship status with a specific user
      if (targetUser) {
        const target = sanitize(targetUser, 50).toLowerCase();
        if (!target || target === me) {
          return res.status(200).json({ status: 'self' });
        }

        const [isFriend, hasIncoming, hasSent] = await Promise.all([
          redis.sismember(`friends:${me}`, target),
          redis.hexists(`friend_requests:${me}`, target),
          redis.sismember(`friend_requests_sent:${me}`, target),
        ]);

        let status = 'none';
        if (isFriend) status = 'friends';
        else if (hasIncoming) status = 'incoming';
        else if (hasSent) status = 'pending';

        return res.status(200).json({ status, target });
      }

      // Full friends list + pending requests
      const [friendsList, requestsRaw, sentList] = await Promise.all([
        redis.smembers(`friends:${me}`),
        redis.hgetall(`friend_requests:${me}`),
        redis.smembers(`friend_requests_sent:${me}`),
      ]);

      const friends = (friendsList || []).sort();

      const requests = [];
      if (requestsRaw) {
        for (const [from, val] of Object.entries(requestsRaw)) {
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            requests.push({ from, ...parsed });
          } catch {
            requests.push({ from, avatar: null, display: from, createdAt: 0 });
          }
        }
      }
      requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return res.status(200).json({
        friends,
        requests,
        sent: sentList || [],
        count: friends.length,
      });
    } catch (e) {
      console.error('Friends GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento degli amici.' });
    }
  }

  /* ─── POST: friend actions ─── */
  if (req.method === 'POST') {
    try {
      const { action, target: rawTarget } = req.body || {};
      const target = sanitize(rawTarget, 50).toLowerCase();

      if (!target || target === me) {
        return res.status(400).json({ error: 'Target non valido.' });
      }

      // Rate limiting
      const rlKey = `friends:ratelimit:${me}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta qualche secondo.' });
      }
      await redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS });

      /* ── SEND friend request ── */
      if (action === 'send') {
        // Check limits
        const friendCount = await redis.scard(`friends:${me}`);
        if (friendCount >= MAX_FRIENDS) {
          return res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_FRIENDS} amici.` });
        }

        // Can't send if already friends
        const alreadyFriends = await redis.sismember(`friends:${me}`, target);
        if (alreadyFriends) {
          return res.status(400).json({ error: 'Siete già amici.' });
        }

        // Can't send if already pending
        const alreadySent = await redis.sismember(`friend_requests_sent:${me}`, target);
        if (alreadySent) {
          return res.status(400).json({ error: 'Richiesta già inviata.' });
        }

        // If the target already sent us a request, auto-accept
        const incomingExists = await redis.hexists(`friend_requests:${me}`, target);
        if (incomingExists) {
          // Auto-accept: both become friends
          await Promise.all([
            redis.sadd(`friends:${me}`, target),
            redis.sadd(`friends:${target}`, me),
            redis.hdel(`friend_requests:${me}`, target),
            redis.srem(`friend_requests_sent:${target}`, me),
          ]);
          return res.status(200).json({ ok: true, action: 'accepted', target });
        }

        // Send request
        const requestData = JSON.stringify({
          from: me,
          avatar: twitchUser.avatar || '',
          display: twitchUser.displayName,
          createdAt: Date.now(),
        });
        await Promise.all([
          redis.hset(`friend_requests:${target}`, { [me]: requestData }),
          redis.sadd(`friend_requests_sent:${me}`, target),
        ]);

        return res.status(200).json({ ok: true, action: 'sent', target });
      }

      /* ── ACCEPT friend request ── */
      if (action === 'accept') {
        const exists = await redis.hexists(`friend_requests:${me}`, target);
        if (!exists) {
          return res.status(404).json({ error: 'Richiesta non trovata.' });
        }

        await Promise.all([
          redis.sadd(`friends:${me}`, target),
          redis.sadd(`friends:${target}`, me),
          redis.hdel(`friend_requests:${me}`, target),
          redis.srem(`friend_requests_sent:${target}`, me),
        ]);

        return res.status(200).json({ ok: true, action: 'accepted', target });
      }

      /* ── REJECT friend request ── */
      if (action === 'reject') {
        await Promise.all([
          redis.hdel(`friend_requests:${me}`, target),
          redis.srem(`friend_requests_sent:${target}`, me),
        ]);
        return res.status(200).json({ ok: true, action: 'rejected', target });
      }

      /* ── CANCEL sent request ── */
      if (action === 'cancel') {
        await Promise.all([
          redis.hdel(`friend_requests:${target}`, me),
          redis.srem(`friend_requests_sent:${me}`, target),
        ]);
        return res.status(200).json({ ok: true, action: 'cancelled', target });
      }

      /* ── REMOVE friend ── */
      if (action === 'remove') {
        await Promise.all([
          redis.srem(`friends:${me}`, target),
          redis.srem(`friends:${target}`, me),
        ]);
        return res.status(200).json({ ok: true, action: 'removed', target });
      }

      return res.status(400).json({ error: 'Azione non valida. Usa: send, accept, reject, cancel, remove.' });
    } catch (e) {
      console.error('Friends POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'operazione amici.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
