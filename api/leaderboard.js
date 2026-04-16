import { Redis } from '@upstash/redis';

/**
 * Season-based leaderboard API.
 *
 * Each month/game has its own leaderboard "season" (e.g. "2026-04").
 * Old seasons are automatically archived and queryable.
 *
 * Keys in Redis:
 *   lb:<season>              — all-time sorted set for that season
 *   lb:<season>:weekly:<W>   — weekly sorted set with TTL
 *   lb:<season>:monthly      — monthly sorted set with TTL
 *
 * Also keeps the legacy all-time key for backward compatibility:
 *   neural_dash_leaderboard  — global all-time across all seasons
 */

const LEGACY_ALLTIME_KEY = 'neural_dash_leaderboard';
const MAX_ENTRIES = 50;
const WEEKLY_TTL_SECONDS = 8 * 24 * 60 * 60;
const MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60;

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/* ─── Helpers ─── */

function getSeasonKey(season) {
  return `lb:${season}`;
}

function getWeeklyKey(season, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `lb:${season}:weekly:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMonthlyKey(season) {
  return `lb:${season}:monthly`;
}

function getCurrentSeason(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthLabel(now = new Date()) {
  return `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

function getCompletedSeasons(now = new Date()) {
  const year = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-based
  const seasons = [];
  for (let m = 0; m < currentMonth; m++) {
    const mm = String(m + 1).padStart(2, '0');
    seasons.push({
      season: `${year}-${mm}`,
      label: `${MONTH_NAMES[m]} ${year}`,
      monthNum: m + 1,
    });
  }
  return seasons;
}

function parseScores(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(entry => ({
      username: String(entry.value ?? entry.member ?? entry.element ?? ''),
      score: Number(entry.score ?? 0),
    }));
  }
  const result = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    result.push({
      username: String(raw[i]),
      score: Number(raw[i + 1]),
    });
  }
  return result;
}

/* ─── Handler ─── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

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

  const now = new Date();
  const currentSeason = getCurrentSeason(now);

  // Allow client to pass ?season=YYYY-MM, default to current
  const requestedSeason = (req.query?.season || req.body?.season || currentSeason)
    .replace(/[^0-9-]/g, '');

  // ─── GET: leaderboard data ───
  if (req.method === 'GET') {
    try {
      const seasonKey = getSeasonKey(requestedSeason);
      const weeklyKey = getWeeklyKey(requestedSeason, now);
      const monthlyKey = getMonthlyKey(requestedSeason);
      const completedSeasons = getCompletedSeasons(now);

      // Fetch all data in parallel
      const archivePromises = completedSeasons.map(s =>
        redis.zrange(getSeasonKey(s.season), 0, 2, { rev: true, withScores: true })
      );

      const [weeklyRaw, alltimeRaw, currentMonthRaw, legacyAlltimeRaw, ...archiveRawArr] = await Promise.all([
        redis.zrange(weeklyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(seasonKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(monthlyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(LEGACY_ALLTIME_KEY, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        ...archivePromises,
      ]);

      // Build archive: past months' top 3
      const archive = completedSeasons
        .map((s, i) => ({
          season: s.season,
          label: s.label,
          monthNum: s.monthNum,
          top3: parseScores(archiveRawArr[i]),
        }))
        .filter(a => a.top3.length > 0)
        .reverse(); // Most recent first

      // Also build legacy monthly winners from old keys (backward compat)
      const legacyMonthPromises = completedSeasons.map(s =>
        redis.zrange(`neural_dash_leaderboard:monthly:${s.season}`, 0, 2, { rev: true, withScores: true })
      );
      const legacyMonthlyRaw = await Promise.all(legacyMonthPromises);
      const monthlyWinners = completedSeasons
        .map((s, i) => ({
          month: s.season,
          label: s.label,
          top3: parseScores(legacyMonthlyRaw[i]),
        }))
        .filter(m => m.top3.length > 0)
        .reverse();

      const currentMonthStr = currentSeason;

      return res.status(200).json({
        weekly: parseScores(weeklyRaw),
        alltime: parseScores(alltimeRaw),
        currentMonth: {
          month: currentMonthStr,
          label: getCurrentMonthLabel(now),
          scores: parseScores(currentMonthRaw),
        },
        monthlyWinners,
        archive,
        // Legacy field
        leaderboard: parseScores(legacyAlltimeRaw),
      });
    } catch (e) {
      console.error('Leaderboard GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
    }
  }

  // ─── POST: submit score ───
  if (req.method === 'POST') {
    try {
      const { score, season: bodySeason } = req.body;
      const targetSeason = (bodySeason || currentSeason).replace(/[^0-9-]/g, '');

      if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || score > 999999) {
        return res.status(400).json({ error: 'Punteggio non valido.' });
      }

      // Only allow posting to the current season
      if (targetSeason !== currentSeason) {
        return res.status(400).json({ error: 'Non puoi inviare punteggi per una stagione passata.' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token Twitch mancante. Effettua il login.' });
      }

      const twitchToken = authHeader.split(' ')[1];
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

      const seasonKey = getSeasonKey(targetSeason);
      const weeklyKey = getWeeklyKey(targetSeason, now);
      const monthlyKey = getMonthlyKey(targetSeason);

      const [currentSeasonScore, currentWeekly, currentMonthly, currentLegacy] = await Promise.all([
        redis.zscore(seasonKey, username),
        redis.zscore(weeklyKey, username),
        redis.zscore(monthlyKey, username),
        redis.zscore(LEGACY_ALLTIME_KEY, username),
      ]);

      const ops = [];
      let updated = false;

      if (currentSeasonScore === null || Number(currentSeasonScore) < score) {
        ops.push(redis.zadd(seasonKey, { score, member: username }));
        updated = true;
      }
      if (currentWeekly === null || Number(currentWeekly) < score) {
        ops.push(redis.zadd(weeklyKey, { score, member: username }));
        updated = true;
      }
      if (currentMonthly === null || Number(currentMonthly) < score) {
        ops.push(redis.zadd(monthlyKey, { score, member: username }));
        updated = true;
      }
      // Also write to legacy all-time
      if (currentLegacy === null || Number(currentLegacy) < score) {
        ops.push(redis.zadd(LEGACY_ALLTIME_KEY, { score, member: username }));
        updated = true;
      }

      if (ops.length > 0) await Promise.all(ops);

      // Set TTLs
      await Promise.all([
        redis.expire(weeklyKey, WEEKLY_TTL_SECONDS).catch(() => {}),
        redis.expire(monthlyKey, MONTHLY_TTL_SECONDS).catch(() => {}),
      ]);

      if (!updated) {
        return res.status(200).json({
          message: 'Hai già un punteggio più alto!',
          username,
          currentBest: Number(currentSeasonScore),
          submitted: score,
        });
      }

      return res.status(200).json({ message: 'Punteggio registrato!', username, score });
    } catch (e) {
      console.error('Leaderboard POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio del punteggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
