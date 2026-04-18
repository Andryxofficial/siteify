import { Redis } from '@upstash/redis';
import { GENERAL_KEY, getMonthlyKey, getCurrentSeason, getLevel, getDecayedXp } from './social-leaderboard.js';

/**
 * Community API — Custom forum for ANDRYXify
 *
 * Redis data model:
 *   community:post:<id>          → Hash  { id, author, authorAvatar, authorDisplay, title, body, tag, createdAt, replyCount, likeCount }
 *   community:timeline           → Sorted Set  (score = timestamp, member = postId)
 *   community:tag:<tag>          → Sorted Set  (score = timestamp, member = postId)
 *   community:user:<username>    → Sorted Set  (score = timestamp, member = postId)
 *   community:likes:<postId>     → Set of usernames
 *   community:counter            → String (auto-increment post ID counter)
 *   community:ratelimit:<user>   → String (TTL-based rate limiter)
 *
 * GET  /api/community?page=1&limit=20&tag=<tag>&user=<username>
 * POST /api/community   { title, body, tag }  — requires Twitch auth
 * DELETE /api/community { postId }            — requires Twitch auth (author or admin)
 * PATCH  /api/community { postId, action: "like" | "unlike" } — requires Twitch auth
 *
 * XP system (with diminishing returns + engagement multiplier):
 *   - Create a post:  base +10 XP, decays if posting too often (window: 24h)
 *   - Like given:     base +1 XP, decays if liking too many times (window: 1h)
 *   - Like received:  base +2 XP × engagement multiplier (1.0–2.0x based on post popularity)
 */

const VALID_TAGS = ['generale', 'giochi', 'stream', 'tech', 'meme', 'suggerimenti'];
const MAX_TITLE = 120;
const MAX_BODY = 2000;
const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 20;
const RATE_LIMIT_SECONDS = 30; // min seconds between posts

/* ─── XP base rewards ─── */
const XP_POST          = 10; // create a post
const XP_LIKE_RECEIVED = 2;  // post author receives a like (× engagement multiplier)
const XP_LIKE_GIVEN    = 1;  // user gives a like (subject to decay)

/**
 * Engagement multiplier for the post author.
 * Posts that attract many interactions reward the author more per like/reply.
 *   0–4 interactions  → 1.0×
 *   5–9               → 1.25×
 *  10–19              → 1.5×
 *  20+                → 2.0×
 */
function getEngagementMultiplier(likeCount, replyCount) {
  const total = Number(likeCount || 0) + Number(replyCount || 0);
  if (total >= 20) return 2.0;
  if (total >= 10) return 1.5;
  if (total >= 5)  return 1.25;
  return 1.0;
}

/** Award XP to a user on both the monthly and general leaderboards. */
async function awardXp(redis, username, xp) {
  if (!username || xp <= 0) return;
  const season = getCurrentSeason();
  const monthlyKey = getMonthlyKey(season);
  await Promise.all([
    redis.zincrby(monthlyKey, xp, username),
    redis.zincrby(GENERAL_KEY, xp, username),
  ]);
}

// Re-export getLevel so it can be used in GET response enrichment (optional)
export { getLevel };

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

  // Fetch full profile
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
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

  /* ─── GET: list posts OR single post ─── */
  if (req.method === 'GET') {
    try {
      // Single post fetch: GET /api/community?id=<postId>
      const singleId = req.query?.id;
      if (singleId) {
        const post = await redis.hgetall(`community:post:${singleId}`);
        if (!post || !post.id) {
          return res.status(404).json({ error: 'Post non trovato.' });
        }
        let liked = false;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const twitchUser = await validateTwitch(authHeader);
          if (twitchUser) {
            liked = !!(await redis.sismember(`community:likes:${singleId}`, twitchUser.login));
          }
        }
        return res.status(200).json({
          post: {
            ...post,
            replyCount: Number(post.replyCount || 0),
            likeCount: Number(post.likeCount || 0),
            liked,
          },
        });
      }

      const page = Math.max(1, parseInt(req.query?.page) || 1);
      const limit = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(req.query?.limit) || DEFAULT_PER_PAGE));
      const tag = req.query?.tag;
      const user = req.query?.user;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let sourceKey = 'community:timeline';
      if (tag && VALID_TAGS.includes(tag)) {
        sourceKey = `community:tag:${tag}`;
      } else if (user) {
        sourceKey = `community:user:${sanitize(user, 50)}`;
      }

      // Get post IDs (newest first)
      const postIds = await redis.zrange(sourceKey, start, end, { rev: true });
      const total = await redis.zcard(sourceKey);

      if (!postIds || postIds.length === 0) {
        return res.status(200).json({ posts: [], total, page, pages: Math.ceil(total / limit) });
      }

      // Fetch all post hashes in parallel
      const posts = await Promise.all(
        postIds.map(id => redis.hgetall(`community:post:${id}`))
      );

      // Check likes for current user if authenticated
      let userLikes = {};
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const twitchUser = await validateTwitch(authHeader);
        if (twitchUser) {
          const likeChecks = await Promise.all(
            postIds.map(id => redis.sismember(`community:likes:${id}`, twitchUser.login))
          );
          postIds.forEach((id, i) => { userLikes[id] = !!likeChecks[i]; });
        }
      }

      const result = posts
        .filter(p => p && p.id)
        .map(p => ({
          ...p,
          replyCount: Number(p.replyCount || 0),
          likeCount: Number(p.likeCount || 0),
          liked: !!userLikes[p.id],
        }));

      return res.status(200).json({
        posts: result,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (e) {
      console.error('Community GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento dei post.' });
    }
  }

  /* ─── POST: create a new post ─── */
  if (req.method === 'POST') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { title: rawTitle, body: rawBody, tag: rawTag } = req.body || {};

      const title = sanitize(rawTitle, MAX_TITLE);
      const body = sanitize(rawBody, MAX_BODY);
      const tag = VALID_TAGS.includes(rawTag) ? rawTag : 'generale';

      if (!title || title.length < 3) {
        return res.status(400).json({ error: 'Il titolo deve avere almeno 3 caratteri.' });
      }
      if (!body || body.length < 5) {
        return res.status(400).json({ error: 'Il contenuto deve avere almeno 5 caratteri.' });
      }

      // Rate limiting
      const rlKey = `community:ratelimit:${twitchUser.login}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta qualche secondo prima di pubblicare un altro post.' });
      }

      // Generate unique ID
      const postId = await redis.incr('community:counter');
      const id = String(postId);
      const now = Date.now();

      const post = {
        id,
        author: twitchUser.login,
        authorAvatar: twitchUser.avatar || '',
        authorDisplay: twitchUser.displayName,
        title,
        body,
        tag,
        createdAt: now,
        replyCount: 0,
        likeCount: 0,
      };

      // Write atomically
      await Promise.all([
        redis.hset(`community:post:${id}`, post),
        redis.zadd('community:timeline', { score: now, member: id }),
        redis.zadd(`community:tag:${tag}`, { score: now, member: id }),
        redis.zadd(`community:user:${twitchUser.login}`, { score: now, member: id }),
        redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS }),
      ]);

      // Award XP for creating a post — subject to daily diminishing returns (best-effort)
      ;(async () => {
        try {
          const xp = await getDecayedXp(redis, twitchUser.login, 'post', XP_POST);
          if (xp > 0) await awardXp(redis, twitchUser.login, xp);
        } catch (e) { console.warn('XP award (post) error:', e); }
      })();

      return res.status(201).json({ post: { ...post, liked: false } });
    } catch (e) {
      console.error('Community POST error:', e);
      return res.status(500).json({ error: 'Errore nella creazione del post.' });
    }
  }

  /* ─── PATCH: like/unlike a post ─── */
  if (req.method === 'PATCH') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { postId, action } = req.body || {};
      if (!postId || !['like', 'unlike'].includes(action)) {
        return res.status(400).json({ error: 'Richiesta non valida.' });
      }

      const postKey = `community:post:${postId}`;
      // Fetch full post to access author + engagement counts
      const post = await redis.hgetall(postKey);
      if (!post || !post.id) {
        return res.status(404).json({ error: 'Post non trovato.' });
      }

      const likesKey = `community:likes:${postId}`;

      if (action === 'like') {
        const added = await redis.sadd(likesKey, twitchUser.login);
        if (added) {
          await redis.hincrby(postKey, 'likeCount', 1);
          // Award XP with diminishing returns + engagement multiplier (best-effort)
          ;(async () => {
            try {
              // Liker: base +1 XP, decays if liking too frequently
              const likerXp = await getDecayedXp(redis, twitchUser.login, 'like', XP_LIKE_GIVEN);
              if (likerXp > 0) await awardXp(redis, twitchUser.login, likerXp);

              // Post author: base +2 XP × engagement multiplier (popular posts reward more)
              const postAuthor = post.author;
              if (postAuthor && postAuthor !== twitchUser.login) {
                const multiplier = getEngagementMultiplier(Number(post.likeCount), Number(post.replyCount));
                const authorXp = Math.round(XP_LIKE_RECEIVED * multiplier);
                if (authorXp > 0) await awardXp(redis, postAuthor, authorXp);
              }
            } catch (e) { console.warn('XP award (like) error:', e); }
          })();
        }
      } else {
        const removed = await redis.srem(likesKey, twitchUser.login);
        if (removed) {
          await redis.hincrby(postKey, 'likeCount', -1);
        }
      }

      const newCount = Number(await redis.hget(postKey, 'likeCount') || 0);
      return res.status(200).json({ likeCount: Math.max(0, newCount), liked: action === 'like' });
    } catch (e) {
      console.error('Community PATCH error:', e);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del like.' });
    }
  }

  /* ─── DELETE: remove a post (author or admin) ─── */
  if (req.method === 'DELETE') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { postId } = req.body || {};
      if (!postId) {
        return res.status(400).json({ error: 'ID post mancante.' });
      }

      const postKey = `community:post:${postId}`;
      const post = await redis.hgetall(postKey);
      if (!post || !post.id) {
        return res.status(404).json({ error: 'Post non trovato.' });
      }

      // Only the author or the admin can delete
      const adminSecret = process.env.IUA_SECRET;
      const isAdmin = adminSecret && req.headers['x-admin-key'] === adminSecret;
      if (post.author !== twitchUser.login && !isAdmin) {
        return res.status(403).json({ error: 'Non puoi eliminare questo post.' });
      }

      // Clean up all related keys
      const replyIds = await redis.zrange(`community:replies:${postId}`, 0, -1);
      const deleteOps = [
        redis.del(postKey),
        redis.del(`community:likes:${postId}`),
        redis.del(`community:replies:${postId}`),
        redis.zrem('community:timeline', postId),
        redis.zrem(`community:tag:${post.tag}`, postId),
        redis.zrem(`community:user:${post.author}`, postId),
        ...replyIds.map(rid => redis.del(`community:reply:${rid}`)),
      ];
      await Promise.all(deleteOps);

      return res.status(200).json({ deleted: true });
    } catch (e) {
      console.error('Community DELETE error:', e);
      return res.status(500).json({ error: 'Errore nell\'eliminazione del post.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
