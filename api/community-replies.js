import { Redis } from '@upstash/redis';
import { GENERAL_KEY, getMonthlyKey, getCurrentSeason, getDecayedXp, getContentQualityMultiplier, getProfanityPenalty, censorProfanity } from './social-leaderboard.js';

const XP_REPLY                = 5; // create a reply (base, subject to hourly diminishing returns + quality)
const XP_REPLY_RECEIVED       = 2; // post author receives XP when someone replies to their post
const XP_REPLY_LIKE_GIVEN     = 1; // user gives a like to a reply (subject to decay)
const XP_REPLY_LIKE_RECEIVED  = 1; // reply author receives a like

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
 *   community:reply:<id>         → Hash  { id, postId, author, authorAvatar, authorDisplay, body, createdAt, likeCount }
 *   community:replies:<postId>   → Sorted Set (score = timestamp, member = replyId)
 *   community:reply-likes:<id>   → Set of usernames who liked the reply
 *   community:reply-counter      → String (auto-increment reply ID counter)
 *   community:ratelimit:reply:<user> → String (TTL-based rate limiter)
 *
 * GET  /api/community-replies?postId=<id>&page=1&limit=30
 * POST /api/community-replies  { postId, body }  — requires Twitch auth
 * PATCH /api/community-replies { replyId, action: "like" | "unlike" } — requires Twitch auth
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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

      const validReplies = replies.filter(r => r && r.id);

      // Determina viewer (per flag `liked`) — best effort, GET resta pubblico
      let viewerLogin = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const twitchUser = await validateTwitch(authHeader);
        if (twitchUser) viewerLogin = twitchUser.login;
      }

      let likedFlags = {};
      if (viewerLogin && validReplies.length > 0) {
        const checks = await Promise.all(
          validReplies.map(r => redis.sismember(`community:reply-likes:${r.id}`, viewerLogin))
        );
        validReplies.forEach((r, i) => { likedFlags[r.id] = !!checks[i]; });
      }

      const enriched = validReplies.map(r => ({
        ...r,
        likeCount: Number(r.likeCount || 0),
        liked: !!likedFlags[r.id],
      }));

      return res.status(200).json({
        replies: enriched,
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

      const { postId, body: rawBody, mediaId: rawMediaId, mediaType: rawMediaType, parentReplyId: rawParentReplyId } = req.body || {};

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

      // Parent reply (optional): valida che esista e appartenga allo stesso post
      let parentReplyId = '';
      let parentReplySnippet = '';
      let parentReplyAuthor = '';
      let parentReplyAuthorDisplay = '';
      if (rawParentReplyId) {
        const candidateId = sanitize(String(rawParentReplyId), 32);
        const parentReply = await redis.hgetall(`community:reply:${candidateId}`);
        if (!parentReply || !parentReply.id) {
          return res.status(404).json({ error: 'Risposta originale non trovata.' });
        }
        if (String(parentReply.postId) !== String(postId)) {
          return res.status(400).json({ error: 'La risposta originale non appartiene a questo post.' });
        }
        parentReplyId = parentReply.id;
        // Snippet della risposta originale per visualizzazione "in risposta a"
        parentReplySnippet = (parentReply.body || '').slice(0, 140);
        parentReplyAuthor = parentReply.author || '';
        parentReplyAuthorDisplay = parentReply.authorDisplay || parentReply.author || '';
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
        likeCount: 0,
        ...(mediaId ? { mediaId, mediaType } : {}),
        ...(parentReplyId ? {
          parentReplyId,
          parentReplyAuthor,
          parentReplyAuthorDisplay,
          parentReplySnippet,
        } : {}),
      };

      await Promise.all([
        redis.hset(`community:reply:${id}`, reply),
        redis.zadd(`community:replies:${postId}`, { score: now, member: id }),
        redis.zadd(`community:user-replies:${twitchUser.login}`, { score: now, member: id }),
        redis.hincrby(`community:post:${postId}`, 'replyCount', 1),
        redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS }),
        /* Indice mention */
        redis.zadd('users:mention', { score: now, member: twitchUser.login }),
        redis.hset(`users:mention:meta:${twitchUser.login}`, {
          displayName: twitchUser.displayName,
          avatar:      twitchUser.avatar || '',
          updatedAt:   now,
        }),
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

      return res.status(201).json({ reply: { ...reply, likeCount: 0, liked: false } });
    } catch (e) {
      console.error('Replies POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'invio della risposta.' });
    }
  }

  /* ─── PATCH: like/unlike a reply ─── */
  if (req.method === 'PATCH') {
    try {
      const twitchUser = await validateTwitch(req.headers.authorization);
      if (!twitchUser) {
        return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
      }

      const { replyId, action } = req.body || {};
      if (!replyId || !['like', 'unlike'].includes(action)) {
        return res.status(400).json({ error: 'Richiesta non valida.' });
      }

      const replyKey = `community:reply:${replyId}`;
      const reply = await redis.hgetall(replyKey);
      if (!reply || !reply.id) {
        return res.status(404).json({ error: 'Risposta non trovata.' });
      }

      const likesKey = `community:reply-likes:${replyId}`;

      if (action === 'like') {
        const added = await redis.sadd(likesKey, twitchUser.login);
        if (added) {
          await redis.hincrby(replyKey, 'likeCount', 1);
          /* Counter aggregato per la scheda profilo dell'autore */
          if (reply.author && reply.author !== twitchUser.login) {
            redis.incr(`profile:${reply.author}:likes`).catch(() => {});
          }
          // XP best-effort: liker (decay) + autore della risposta
          ;(async () => {
            try {
              const likerXp = await getDecayedXp(redis, twitchUser.login, 'reply-like', XP_REPLY_LIKE_GIVEN);
              if (likerXp > 0) await awardXp(redis, twitchUser.login, likerXp);

              const replyAuthor = reply.author;
              if (replyAuthor && replyAuthor !== twitchUser.login) {
                await awardXp(redis, replyAuthor, XP_REPLY_LIKE_RECEIVED);
              }
            } catch (e) { console.warn('XP award (reply like) error:', e); }
          })();
        }
      } else {
        const removed = await redis.srem(likesKey, twitchUser.login);
        if (removed) {
          await redis.hincrby(replyKey, 'likeCount', -1);
          if (reply.author && reply.author !== twitchUser.login) {
            (async () => {
              try {
                const v = await redis.decr(`profile:${reply.author}:likes`);
                if (Number(v) < 0) await redis.set(`profile:${reply.author}:likes`, '0');
              } catch { /* ignora */ }
            })();
          }
        }
      }

      const newCount = Number(await redis.hget(replyKey, 'likeCount') || 0);
      return res.status(200).json({ likeCount: Math.max(0, newCount), liked: action === 'like' });
    } catch (e) {
      console.error('Replies PATCH error:', e);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del mi piace.' });
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
        redis.del(`community:reply-likes:${replyId}`),
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
