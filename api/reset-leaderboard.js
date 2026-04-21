import { Redis } from '@upstash/redis';

/**
 * Admin leaderboard management endpoint.
 * Protected by: Authorization: Bearer <IUA_SECRET>
 *
 * GET  /api/reset-leaderboard
 *   Returns the current state (entry counts, TTLs) of all active leaderboard keys.
 *
 * POST /api/reset-leaderboard  — body examples:
 *
 *   {}  or  { "weekly": true }
 *     Reset the current week's weekly key.
 *
 *   { "monthly": true }
 *     Reset the current month's monthly key AND subtract those scores from lb:general.
 *
 *   { "general": true }
 *     Wipe lb:general entirely.
 *
 *   { "recalculate_general": true }
 *     Rebuild lb:general by summing ALL existing lb:*:monthly keys.
 *     Use this after manual edits or to fix any drift.
 *
 *   { "user": "twitchusername" }
 *     Remove a user from all active boards (weekly + monthly + general adjustment).
 *
 *   { "full": true }
 *     Wipe every lb:* key. Nuclear option.
 *
 * Usage (curl):
 *   curl -X GET https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>"
 *
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"weekly": true}'
 *
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"monthly": true}'
 *
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"recalculate_general": true}'
 *
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"user": "twitchusername"}'
 *
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"full": true}'
 */

const GENERAL_KEY = 'lb:general';
const SUPPORTED_GAMES = new Set(['monthly', 'legend']);

function gamePrefix(game) {
  return game === 'legend' ? 'lb:legend' : 'lb';
}
function generalKeyFor(game) {
  return game === 'legend' ? 'lb:legend:general' : GENERAL_KEY;
}

function getCurrentSeason(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWeeklyKey(season, now = new Date(), game = 'monthly') {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${gamePrefix(game)}:${season}:weekly:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function parseScores(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(e => ({
      username: String(e.value ?? e.member ?? e.element ?? ''),
      score: Number(e.score ?? 0),
    }));
  }
  const result = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    result.push({ username: String(raw[i]), score: Number(raw[i + 1]) });
  }
  return result;
}

async function scanKeys(redis, pattern) {
  const keys = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);
    if (batch.length > 0) keys.push(...batch);
  } while (cursor !== 0);
  return [...new Set(keys)];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  // ─── Auth ───
  const secret = process.env.IUA_SECRET;
  if (!secret) return res.status(500).json({ error: 'IUA_SECRET non configurato sul server.' });
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  // ─── Redis ───
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch (e) {
    console.error('Redis init error:', e);
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  const now = new Date();
  const season = getCurrentSeason(now);
  /* `game` puo` essere passato come query (?game=legend) o nel body. */
  const requestedGame = SUPPORTED_GAMES.has(req.query?.game)
    ? req.query.game
    : (SUPPORTED_GAMES.has(req.body?.game) ? req.body.game : 'monthly');
  const weeklyKey = getWeeklyKey(season, now, requestedGame);
  const monthlyKey = `${gamePrefix(requestedGame)}:${season}:monthly`;
  const generalKey = generalKeyFor(requestedGame);

  /* ─── GET: status ─── */
  if (req.method === 'GET') {
    try {
      const [weeklyCount, monthlyCount, generalCount, weeklyTtl, allKeys] = await Promise.all([
        redis.zcard(weeklyKey),
        redis.zcard(monthlyKey),
        redis.zcard(generalKey),
        redis.ttl(weeklyKey),
        scanKeys(redis, 'lb:*'),
      ]);

      return res.status(200).json({
        season,
        keys: {
          weekly: weeklyKey,
          monthly: monthlyKey,
          general: generalKey,
        },
        entries: {
          weekly: weeklyCount ?? 0,
          monthly: monthlyCount ?? 0,
          general: generalCount ?? 0,
        },
        weeklyTtlSeconds: weeklyTtl,
        allLbKeys: allKeys.sort(),
      });
    } catch (e) {
      console.error('Reset-leaderboard GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero dello stato.' });
    }
  }

  /* ─── POST: admin operations ─── */
  try {
    const body = req.body || {};

    // ── Full wipe ──
    if (body.full === true) {
      const keys = await scanKeys(redis, 'lb:*');
      if (keys.length > 0) await redis.del(...keys);
      console.log(`[reset-leaderboard] FULL WIPE: deleted ${keys.length} key(s)`, keys);
      return res.status(200).json({
        action: 'full_wipe',
        message: `Wipe completo. ${keys.length} chiave/i eliminate.`,
        deletedKeys: keys,
      });
    }

    // ── Wipe general leaderboard ──
    if (body.general === true) {
      await redis.del(generalKey);
      console.log('[reset-leaderboard] General leaderboard wiped.');
      return res.status(200).json({
        action: 'reset_general',
        message: 'Classifica generale azzerata.',
      });
    }

    // ── Recalculate general from all monthly keys ──
    if (body.recalculate_general === true) {
      const monthlyKeys = await scanKeys(redis, `${gamePrefix(requestedGame)}:*:monthly`);
      const allData = await Promise.all(
        monthlyKeys.map(k => redis.zrange(k, 0, -1, { rev: false, withScores: true }))
      );
      const userTotals = {};
      for (const data of allData) {
        for (const { username, score } of parseScores(data)) {
          if (username) userTotals[username] = (userTotals[username] || 0) + score;
        }
      }
      await redis.del(generalKey);
      const entries = Object.entries(userTotals);
      if (entries.length > 0) {
        await Promise.all(entries.map(([u, s]) => redis.zadd(generalKey, { score: s, member: u })));
      }
      console.log(`[reset-leaderboard] General recalculated from ${monthlyKeys.length} monthly key(s). ${entries.length} user(s).`);
      return res.status(200).json({
        action: 'recalculate_general',
        message: `Generale ricalcolata da ${monthlyKeys.length} chiave/i mensili. ${entries.length} utente/i.`,
        monthlyKeysScanned: monthlyKeys,
        userTotals,
      });
    }

    // ── Reset current monthly + adjust general ──
    if (body.monthly === true) {
      const monthlyRaw = await redis.zrange(monthlyKey, 0, -1, { rev: false, withScores: true });
      const entries = parseScores(monthlyRaw);
      await redis.del(monthlyKey);
      // Subtract each user's monthly score from general; remove user if score drops to 0
      for (const { username, score } of entries) {
        const newScore = await redis.zincrby(generalKey, -score, username);
        if (Number(newScore) <= 0) await redis.zrem(generalKey, username);
      }
      console.log(`[reset-leaderboard] Monthly ${monthlyKey} reset. ${entries.length} user(s) adjusted.`);
      return res.status(200).json({
        action: 'reset_monthly',
        message: `Classifica mensile di ${season} azzerata. ${entries.length} utente/i aggiustati nella generale.`,
        season,
        adjustedUsers: entries.map(e => ({ username: e.username, removed: e.score })),
      });
    }

    // ── Remove a specific user from all active boards ──
    if (body.user) {
      const username = String(body.user).trim().toLowerCase();
      if (!username) return res.status(400).json({ error: 'Username non valido.' });
      const monthlyScore = await redis.zscore(monthlyKey, username);
      await Promise.all([
        redis.zrem(weeklyKey, username),
        redis.zrem(monthlyKey, username),
      ]);
      if (monthlyScore !== null) {
        const newScore = await redis.zincrby(generalKey, -Number(monthlyScore), username);
        if (Number(newScore) <= 0) await redis.zrem(generalKey, username);
      }
      console.log(`[reset-leaderboard] User "${username}" removed. Monthly score was: ${monthlyScore}`);
      return res.status(200).json({
        action: 'remove_user',
        message: `Utente "${username}" rimosso dalla classifica attiva.`,
        username,
        monthlyScoreRemoved: monthlyScore !== null ? Number(monthlyScore) : null,
      });
    }

    // ── Reset current weekly (default) ──
    const allWeeklyKeys = await scanKeys(redis, `${gamePrefix(requestedGame)}:${season}:weekly:*`);
    const toDelete = allWeeklyKeys.length > 0 ? allWeeklyKeys : [weeklyKey];
    const existing = toDelete.filter(Boolean);
    if (existing.length > 0) await redis.del(...existing);
    console.log(`[reset-leaderboard] Weekly keys cleared: ${existing.join(', ')}`);
    return res.status(200).json({
      action: 'reset_weekly',
      message: `${existing.length} chiave/i settimanali eliminate.`,
      deletedKeys: existing,
    });
  } catch (e) {
    console.error('Reset-leaderboard POST error:', e);
    return res.status(500).json({ error: 'Errore durante l\'operazione.' });
  }
}
