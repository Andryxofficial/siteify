import { Redis } from '@upstash/redis';
import { GENERAL_KEY, getMonthlyKey, getCurrentSeason } from './social-leaderboard.js';

export const config = { maxDuration: 45 };

async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.login) return null;
  return { login: data.login, clientId: data.client_id };
}

function safeUser(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 80);
}

async function scanKeys(redis, pattern, max = 2500) {
  const found = [];
  let cursor = 0;
  do {
    const out = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(out?.[0] || 0);
    const keys = out?.[1] || [];
    found.push(...keys);
    if (found.length >= max) break;
  } while (cursor !== 0);
  return [...new Set(found)].slice(0, max);
}

async function eliminaPost(redis, postId, stats) {
  const post = await redis.hgetall(`community:post:${postId}`);
  if (!post?.id) return;

  const replyIds = await redis.zrange(`community:replies:${postId}`, 0, -1).catch(() => []);
  const tagSlugs = (() => {
    try { return JSON.parse(post.tags || '[]'); } catch { return []; }
  })().filter(Boolean);

  const ops = [
    redis.del(`community:post:${postId}`),
    redis.del(`community:likes:${postId}`),
    redis.del(`community:replies:${postId}`),
    redis.zrem('community:timeline', postId),
    redis.zrem(`community:tag:${post.tag || 'generale'}`, postId),
    redis.zrem(`community:user:${post.author}`, postId),
    ...tagSlugs.flatMap(slug => [
      redis.zrem(`tag:${slug}`, postId),
      redis.zrem(`tag:${slug}:trending`, postId).catch(() => {}),
    ]),
    ...replyIds.map(rid => redis.del(`community:reply:${rid}`)),
    ...replyIds.map(rid => redis.del(`community:reply-likes:${rid}`)),
  ];

  if (post.mediaId) {
    ops.push(redis.del(`cm:${post.mediaId}`));
    ops.push(redis.del(`cm:${post.mediaId}:meta`));
  }

  await Promise.allSettled(ops);
  stats.postEliminati += 1;
  stats.risposteEliminate += replyIds.length;
}

async function eliminaRisposta(redis, replyId, stats) {
  const reply = await redis.hgetall(`community:reply:${replyId}`);
  if (!reply?.id) return;
  await Promise.allSettled([
    redis.del(`community:reply:${replyId}`),
    redis.del(`community:reply-likes:${replyId}`),
    redis.zrem(`community:replies:${reply.postId}`, replyId),
    redis.zrem(`community:user-replies:${reply.author}`, replyId),
    redis.hincrby(`community:post:${reply.postId}`, 'replyCount', -1).catch(() => {}),
    ...(reply.mediaId ? [redis.del(`cm:${reply.mediaId}`), redis.del(`cm:${reply.mediaId}:meta`)] : []),
  ]);
  stats.risposteEliminate += 1;
}

async function rimuoviLikeDaTutti(redis, username, stats) {
  const likeKeys = await scanKeys(redis, 'community:likes:*', 5000);
  const replyLikeKeys = await scanKeys(redis, 'community:reply-likes:*', 5000);

  for (const key of likeKeys) {
    const removed = await redis.srem(key, username).catch(() => 0);
    if (removed) {
      const postId = key.replace('community:likes:', '');
      await redis.hincrby(`community:post:${postId}`, 'likeCount', -1).catch(() => {});
      stats.likeRimossi += 1;
    }
  }

  for (const key of replyLikeKeys) {
    const removed = await redis.srem(key, username).catch(() => 0);
    if (removed) {
      const replyId = key.replace('community:reply-likes:', '');
      await redis.hincrby(`community:reply:${replyId}`, 'likeCount', -1).catch(() => {});
      stats.likeRisposteRimossi += 1;
    }
  }
}

async function eliminaAmicizie(redis, username, stats) {
  const amici = await redis.smembers(`friends:${username}`).catch(() => []);
  const richiesteIn = await redis.smembers(`friend:req:in:${username}`).catch(() => []);
  const richiesteOut = await redis.smembers(`friend:req:out:${username}`).catch(() => []);

  const ops = [
    redis.del(`friends:${username}`),
    redis.del(`friend:req:in:${username}`),
    redis.del(`friend:req:out:${username}`),
    ...amici.map(a => redis.srem(`friends:${a}`, username)),
    ...richiesteIn.map(a => redis.srem(`friend:req:out:${a}`, username)),
    ...richiesteOut.map(a => redis.srem(`friend:req:in:${a}`, username)),
  ];
  await Promise.allSettled(ops);
  stats.amicizieRimosse = amici.length + richiesteIn.length + richiesteOut.length;
}

async function eliminaClassifiche(redis, username, stats) {
  const current = getCurrentSeason();
  const seasons = new Set([current]);
  const now = new Date();
  for (let i = 0; i < 36; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    seasons.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const ops = [redis.zrem(GENERAL_KEY, username), ...[...seasons].map(s => redis.zrem(getMonthlyKey(s), username))];
  await Promise.allSettled(ops);
  stats.classificheRipulite = seasons.size + 1;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Metodo non consentito.' });

  const twitchUser = await validateTwitch(req.headers.authorization);
  if (!twitchUser) return res.status(401).json({ error: 'Accedi con Twitch per eliminare i dati account.' });

  const username = safeUser(twitchUser.login);
  if (!username) return res.status(400).json({ error: 'Utente non valido.' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const stats = {
    postEliminati: 0,
    risposteEliminate: 0,
    likeRimossi: 0,
    likeRisposteRimossi: 0,
    amicizieRimosse: 0,
    classificheRipulite: 0,
  };

  try {
    const [postIds, replyIds] = await Promise.all([
      redis.zrange(`community:user:${username}`, 0, -1).catch(() => []),
      redis.zrange(`community:user-replies:${username}`, 0, -1).catch(() => []),
    ]);

    for (const postId of postIds || []) await eliminaPost(redis, postId, stats);
    for (const replyId of replyIds || []) await eliminaRisposta(redis, replyId, stats);

    await Promise.allSettled([
      rimuoviLikeDaTutti(redis, username, stats),
      eliminaAmicizie(redis, username, stats),
      eliminaClassifiche(redis, username, stats),
    ]);

    const keysDirette = [
      `profile:${username}`,
      `profile:${username}:likes`,
      `favorites:${username}`,
      `community:user:${username}`,
      `community:user-replies:${username}`,
      `community:ratelimit:${username}`,
      `community:ratelimit:reply:${username}`,
      `social:decay:post:${username}`,
      `social:decay:reply:${username}`,
      `social:decay:like:${username}`,
      `social:decay:reply-like:${username}`,
      `users:mention:meta:${username}`,
      `ikigai:custodia:user:${username}`,
      `ikigai:profile:user:${username}`,
      `ikigai:semantic:user:${username}`,
      `notifications:${username}`,
      `notification:prefs:${username}`,
      `push:${username}`,
    ];

    await Promise.allSettled([
      ...keysDirette.map(k => redis.del(k)),
      redis.zrem('users:mention', username),
      redis.srem('users:all', username).catch(() => {}),
    ]);

    return res.status(200).json({
      ok: true,
      deleted: true,
      username,
      message: 'Dati account eliminati. Al prossimo accesso l’utente ripartirà da zero.',
      stats,
    });
  } catch (err) {
    console.error('[user-delete] errore:', err);
    return res.status(500).json({ error: 'Errore durante l’eliminazione dei dati. Riprova tra poco.' });
  }
}
