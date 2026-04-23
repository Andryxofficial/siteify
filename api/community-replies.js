import { Redis } from '@upstash/redis';
import { GENERAL_KEY, getMonthlyKey, getCurrentSeason, getDecayedXp, getContentQualityMultiplier, getProfanityPenalty, censorProfanity } from './social-leaderboard.js';

const XP_REPLY          = 5; // create a reply (base, subject to hourly diminishing returns + quality)
const XP_REPLY_RECEIVED = 2; // post author receives XP when someone replies to their post

async function awardXp(redis, username, xp) {
  if (!username || xp <= 0) return;
  const season = getCurrentSeason();
  const monthlyKey = getMonthlyKey(season);
  await Promise.all([
    redis.zincrby(monthlyKey, xp, username),
    redis.zincrby(GENERAL_KEY, xp, username),
  ]);
}

/**
 * Community Replies API
 *
 * Redis data model:
 *   community:reply:<id>         → Hash  { id, postId, author, authorAvatar, authorDisplay, body, createdAt }
 *   community:replies:<postId>   → Sorted Set (score = timestamp, member = replyId)
 *   community:reply-counter      → String (auto-increment reply ID counter)
 *   community:ratelimit:reply:<user> → String (TTL-based rate limiter)
 *
 * GET  /api/community-replies?postId=<id>&page=1&limit=30
 * POST /api/community-replies  { postId, body }  — requires Twitch auth
 * DELETE /api/community-replies { replyId }       — requires Twitch auth (author or admin)
 */

const MAX_BODY = 1000;
const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 30;
const RATE_LIMIT_SECONDS = 15;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  /* ─── GET: list replies for a post ─── */
  if (req.method === 'GET') {
    try {
      const postId = req.query?.postId;
      if (!postId) {
        return res.status(400).json({ error: 'postId richiesto.' });
      }

      const page = Math.max(1, parseInt(req.query?.page) || 1);
      const limit = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(req.query?.limit) || DEFAULT_PER_PAGE));
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const repliesKey = `community:replies:${postId}`;
      const replyIds = await redis.zrange(repliesKey, start, end);
      const total = await redis.zcard(repliesKey);

      if (!replyIds || replyIds.length === 0) {
        return res.status(200).json({ replies: [], total, page, pages: Math.ceil(total / limit) });
      }

      const replies = await Promise.all(
        replyIds.map(id => redis.hgetall(`community:reply:${id}`))
      );

      return res.status(200).json({
        replies: replies.filter(r => r && r.id),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (e) {
      console.error('Replies GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento delle risposte.' });
    }
  }

  /* ─── POST: create a reply ─── */
  if (req.method === 'POST') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { postId, body: rawBody, mediaId: rawMediaId, mediaType: rawMediaType } = req.body || {};

      if (!postId) {
        return res.status(400).json({ error: 'postId richiesto.' });
      }

      const body = censorProfanity(sanitize(rawBody, MAX_BODY));
      if (!body || body.length < 2) {
        return res.status(400).json({ error: 'La risposta deve avere almeno 2 caratteri.' });
      }

      // Media allegato (opzionale)
      const mediaId   = rawMediaId  ? sanitize(rawMediaId, 100) : '';
      const mediaType = ['image', 'audio', 'video'].includes(rawMediaType) ? rawMediaType : '';

      // Check parent post exists (and get author for XP)
      const parentPost = await redis.hgetall(`community:post:${postId}`);
      if (!parentPost || !parentPost.id) {
        return res.status(404).json({ error: 'Post non trovato.' });
      }

      // Rate limiting
      const rlKey = `community:ratelimit:reply:${twitchUser.login}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta qualche secondo prima di rispondere ancora.' });
      }

      const replyId = await redis.incr('community:reply-counter');
      const id = String(replyId);
      const now = Date.now();

      const reply = {
        id,
        postId: String(postId),
        author: twitchUser.login,
        authorAvatar: twitchUser.avatar || '',
        authorDisplay: twitchUser.displayName,
        body,
        createdAt: now,
        ...(mediaId ? { mediaId, mediaType } : {}),
      };

      await Promise.all([
        redis.hset(`community:reply:${id}`, reply),
        redis.zadd(`community:replies:${postId}`, { score: now, member: id }),
        redis.hincrby(`community:post:${postId}`, 'replyCount', 1),
        redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS }),
      ]);

      // Award XP for writing a reply — quality-adjusted, profanity-penalized, with diminishing returns
      ;(async () => {
        try {
          const qualityMultiplier = getContentQualityMultiplier(body);
          const profanityPenalty = getProfanityPenalty(body);
          const qualityAdjusted = Math.max(1, Math.round(XP_REPLY * qualityMultiplier));
          const decayedXp = await getDecayedXp(redis, twitchUser.login, 'reply', qualityAdjusted);
          const finalXp = Math.max(0, decayedXp + profanityPenalty);
          if (finalXp > 0) await awardXp(redis, twitchUser.login, finalXp);

          // Award XP to the post author for receiving a reply (engagement reward)
          const postAuthor = parentPost.author;
          if (postAuthor && postAuthor !== twitchUser.login) {
            await awardXp(redis, postAuthor, XP_REPLY_RECEIVED);
          }
        } catch (e) { console.warn('XP award (reply) error:', e); }
      })();

      return res.status(201).json({ reply });
    } catch (e) {
      console.error('Replies POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'invio della risposta.' });
    }
  }

  /* ─── DELETE: remove a reply (author or admin) ─── */
  if (req.method === 'DELETE') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { replyId } = req.body || {};
      if (!replyId) {
        return res.status(400).json({ error: 'ID risposta mancante.' });
      }

      const replyKey = `community:reply:${replyId}`;
      const reply = await redis.hgetall(replyKey);
      if (!reply || !reply.id) {
        return res.status(404).json({ error: 'Risposta non trovata.' });
      }

      const adminSecret = process.env.IUA_SECRET;
      const isAdmin = adminSecret && req.headers['x-admin-key'] === adminSecret;
      if (reply.author !== twitchUser.login && !isAdmin) {
        return res.status(403).json({ error: 'Non puoi eliminare questa risposta.' });
      }

      await Promise.all([
        redis.del(replyKey),
        redis.zrem(`community:replies:${reply.postId}`, replyId),
        redis.hincrby(`community:post:${reply.postId}`, 'replyCount', -1),
        ...(reply.mediaId ? [
          redis.del(`cm:${reply.mediaId}`),
          redis.del(`cm:${reply.mediaId}:meta`),
        ] : []),
      ]);

      return res.status(200).json({ deleted: true });
    } catch (e) {
      console.error('Replies DELETE error:', e);
      return res.status(500).json({ error: 'Errore nell\'eliminazione della risposta.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
