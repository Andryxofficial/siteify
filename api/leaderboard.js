import { Redis } from '@upstash/redis';

const ALLTIME_KEY = 'neural_dash_leaderboard';
const MAX_ENTRIES = 50;
const WEEKLY_TTL_SECONDS = 8 * 24 * 60 * 60; // 8 days (buffer beyond 7)

/**
 * Get the ISO week key for the current week (Monday–Sunday).
 * Format: neural_dash_leaderboard:weekly:YYYY-WXX
 */
function getWeeklyKey(now = new Date()) {
  // ISO week: Monday is the first day of the week
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Set to nearest Thursday (ISO week belongs to the year of its Thursday)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `neural_dash_leaderboard:weekly:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Parse scores returned by zrange with withScores.
 * @upstash/redis v1.x returns a flat interleaved array: [member, score, member, score, …]
 * The object-format branch (value/member/element) is a defensive fallback in case
 * future SDK versions change the response shape.
 */
function parseScores(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Check if response is already in object format [{value/member, score}]
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(entry => ({
      username: String(entry.value ?? entry.member ?? entry.element ?? ''),
      score: Number(entry.score ?? 0),
    }));
  }

  // Flat interleaved array: [member, score, member, score, …]
  const result = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    result.push({
      username: String(raw[i]),
      score: Number(raw[i + 1]),
    });
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    console.error('Leaderboard: KV_REST_API_URL or KV_REST_API_TOKEN not configured.');
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch (e) {
    console.error('Redis init error:', e);
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  const weeklyKey = getWeeklyKey();

  // GET: return both weekly and all-time leaderboards
  if (req.method === 'GET') {
    try {
      const [weeklyRaw, alltimeRaw] = await Promise.all([
        redis.zrange(weeklyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(ALLTIME_KEY, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
      ]);

      return res.status(200).json({
        weekly: parseScores(weeklyRaw),
        alltime: parseScores(alltimeRaw),
        // Keep legacy field for backwards compatibility
        leaderboard: parseScores(alltimeRaw),
      });
    } catch (e) {
      console.error('Leaderboard GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
    }
  }

  // POST: submit a score (requires Twitch token)
  if (req.method === 'POST') {
    try {
      const { score } = req.body;

      if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || score > 999999) {
        return res.status(400).json({ error: 'Punteggio non valido.' });
      }

      // Validate Twitch token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token Twitch mancante. Effettua il login.' });
      }

      const twitchToken = authHeader.split(' ')[1];

      // Validate token with Twitch API
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${twitchToken}` },
      });

      if (!validateRes.ok) {
        return res.status(401).json({ error: 'Token Twitch non valido o scaduto.' });
      }

      const twitchData = await validateRes.json();
      const username = twitchData.login;

      if (!username) {
        return res.status(401).json({ error: 'Impossibile ottenere il nome utente Twitch.' });
      }

      // Write to both all-time and weekly leaderboards.
      // For each, only update if the new score is higher.
      const [currentAlltime, currentWeekly] = await Promise.all([
        redis.zscore(ALLTIME_KEY, username),
        redis.zscore(weeklyKey, username),
      ]);

      const ops = [];
      let updatedAlltime = false;
      let updatedWeekly = false;

      if (currentAlltime === null || Number(currentAlltime) < score) {
        ops.push(redis.zadd(ALLTIME_KEY, { score, member: username }));
        updatedAlltime = true;
      }

      if (currentWeekly === null || Number(currentWeekly) < score) {
        ops.push(redis.zadd(weeklyKey, { score, member: username }));
        updatedWeekly = true;
      }

      if (ops.length > 0) {
        await Promise.all(ops);
      }

      // Set TTL on weekly key separately so a failure here doesn't lose the score
      if (updatedWeekly) {
        await redis.expire(weeklyKey, WEEKLY_TTL_SECONDS).catch((e) => {
          console.error('Failed to set weekly TTL:', e);
        });
      }

      if (!updatedAlltime && !updatedWeekly) {
        return res.status(200).json({
          message: 'Hai già un punteggio più alto!',
          username,
          currentBest: Number(currentAlltime),
          submitted: score,
        });
      }

      return res.status(200).json({
        message: 'Punteggio registrato!',
        username,
        score,
      });
    } catch (e) {
      console.error('Leaderboard POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio del punteggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
