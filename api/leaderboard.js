import { Redis } from '@upstash/redis';

/**
 * Leaderboard API — v2
 *
 * Three scoreboards, all stored in Redis sorted sets:
 *
 *   Weekly   — Max score per user in the current ISO week.
 *              Key: lb:<YYYY-MM>:weekly:<YYYY-WNN>  (TTL 8 days)
 *
 *   Monthly  — Max score per user in the current month.
 *              Key: lb:<YYYY-MM>:monthly  (no TTL — permanent archive)
 *
 *   General  — Cumulative: sum of each user's monthly maxima across all months.
 *              Key: lb:general  (no TTL — updated incrementally via ZINCRBY)
 *              Logic: when a user improves their monthly best by Δ, add Δ to their
 *              general score. So general[user] = Σ monthly_max(user, month) over all months.
 *
 * GET /api/leaderboard[?season=YYYY-MM]
 *   Returns: { weekly, monthly, general, archive, currentSeason, currentLabel }
 *
 * POST /api/leaderboard
 *   Body:  { score: number, season?: string }
 *   Auth:  Authorization: Bearer <twitchAccessToken>
 *   Logic: updates weekly max; if monthly max improves → update monthly + ZINCRBY general
 */

const GENERAL_KEY = 'lb:general';
const MAX_ENTRIES = 50;
const WEEKLY_TTL_SECONDS = 8 * 24 * 60 * 60; // 8 days

/* Giochi supportati. 'monthly' = gioco del mese (key prefix 'lb');
   'legend' = Andryx Legend (key prefix 'lb:legend');
   'platform' = Andryx Jump (key prefix 'lb:platform'). */
const SUPPORTED_GAMES = new Set(['monthly', 'legend', 'platform']);

/** Prefisso Redis per il gioco (default = monthly per retrocompatibilita`). */
function gamePrefix(game) {
  if (game === 'legend') return 'lb:legend';
  if (game === 'platform') return 'lb:platform';
  return 'lb';
}

/** Chiave generale per il gioco. */
function generalKeyFor(game) {
  if (game === 'legend') return 'lb:legend:general';
  if (game === 'platform') return 'lb:platform:general';
  return GENERAL_KEY;
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/* ─── Key helpers ─── */

/**
 * Converte un Date in data locale italiana (Europe/Rome).
 * Necessario perché il reset settimanale deve avvenire a mezzanotte italiana,
 * non a mezzanotte UTC (dove c'è 1-2h di differenza).
 */
function italianDate(now = new Date()) {
  const s = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d }; // month 0-based
}

function getWeeklyKey(season, now = new Date(), game = 'monthly') {
  const it = italianDate(now);
  const d = new Date(Date.UTC(it.year, it.month, it.day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${gamePrefix(game)}:${season}:weekly:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMonthlyKey(season, game = 'monthly') {
  return `${gamePrefix(game)}:${season}:monthly`;
}

function getCurrentSeason(now = new Date()) {
  const it = italianDate(now);
  return `${it.year}-${String(it.month + 1).padStart(2, '0')}`;
}

function getCurrentMonthLabel(now = new Date()) {
  const it = italianDate(now);
  return `${MONTH_NAMES[it.month]} ${it.year}`;
}

/** Returns up to `lookback` completed months before the current one, oldest first. */
function getCompletedSeasons(now = new Date(), lookback = 12) {
  const it = italianDate(now);
  const result = [];
  for (let i = lookback; i >= 1; i--) {
    const d = new Date(Date.UTC(it.year, it.month - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    result.push({
      season: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[month]} ${year}`,
      monthNum: month + 1,
      year,
    });
  }
  return result;
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
    result.push({ username: String(raw[i]), score: Number(raw[i + 1]) });
  }
  return result;
}

/* ─── VIP helpers ─── */

/** Restituisce ora e giorno della settimana in timezone italiano */
function getItalianDateTime(now = new Date()) {
  const hour = parseInt(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false }));
  const day = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' })).getDay();
  return { hour, day };
}

/** Finestra VIP: Domenica ≥ 23:00 → Lunedì < 10:00 (ora italiana) */
function isVipWindowOpen(now = new Date()) {
  const { hour, day } = getItalianDateTime(now);
  return (day === 0 && hour >= 23) || (day === 1 && hour < 10);
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
    console.error('Leaderboard: KV env vars missing.');
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
  const requestedSeason = (req.query?.season || currentSeason).replace(/[^0-9-]/g, '');

  /* Gioco richiesto: 'monthly' (default, gioco del mese), 'legend' (Andryx Legend)
     o 'platform' (Andryx Jump). Sanificato in modo strict: qualsiasi valore
     non riconosciuto cade su 'monthly' per non perdere punteggi inviati con
     valori malformati. */
  const requestedGame = SUPPORTED_GAMES.has(req.query?.game) ? req.query.game : 'monthly';
  const GENERAL = generalKeyFor(requestedGame);

  /* ─── GET: fetch leaderboard data ─── */
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.searchParams.get('action') === 'vip_winner_status') {
      // Richiede autenticazione
      const authHeader = req.headers.authorization || req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autenticato' });
      const token = authHeader.split(' ')[1];
      const valRes = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
      if (!valRes.ok) return res.status(401).json({ error: 'Token non valido' });
      const valData = await valRes.json();
      const username = valData.login;

      const season = getCurrentSeason(now);
      const weeklyKey = getWeeklyKey(season, now, requestedGame);

      // Chi è il vincitore settimanale?
      const top = await redis.zrange(weeklyKey, 0, 0, { rev: true, withScores: true });
      const winner = top?.[0]?.member || top?.[0]?.value || (typeof top?.[0] === 'string' ? top[0] : null);
      const isWinner = !!winner && String(winner).toLowerCase() === username.toLowerCase();

      // Finestra VIP: Domenica ≥ 23:00 → Lunedì < 10:00 (ora italiana)
      const windowOpen = isVipWindowOpen(now);

      // Stato grant
      const grantKey = `lb:vip_grant:${weeklyKey}`;
      const grantData = await redis.hgetall(grantKey);
      const alreadyGranted = !!grantData?.grantee;

      return res.status(200).json({
        isWinner,
        canGrant: isWinner && windowOpen && !alreadyGranted,
        alreadyGranted,
        grantee: grantData?.grantee || null,
        windowOpen,
        weekKey: weeklyKey,
      });
    }

    try {
      const weeklyKey = getWeeklyKey(requestedSeason, now, requestedGame);
      const monthlyKey = getMonthlyKey(requestedSeason, requestedGame);
      const completedSeasons = getCompletedSeasons(now);

      const archivePromises = completedSeasons.map(s =>
        redis.zrange(getMonthlyKey(s.season, requestedGame), 0, 2, { rev: true, withScores: true })
      );

      const [weeklyRaw, monthlyRaw, generalRaw, ...archiveRawArr] = await Promise.all([
        redis.zrange(weeklyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(monthlyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        redis.zrange(GENERAL, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        ...archivePromises,
      ]);

      const archive = completedSeasons
        .map((s, i) => ({
          season: s.season,
          label: s.label,
          monthNum: s.monthNum,
          year: s.year,
          top3: parseScores(archiveRawArr[i]).slice(0, 3),
        }))
        .filter(a => a.top3.length > 0)
        .reverse(); // most recent first

      return res.status(200).json({
        weekly: parseScores(weeklyRaw),
        monthly: parseScores(monthlyRaw),
        general: parseScores(generalRaw),
        archive,
        currentSeason: requestedSeason,
        currentLabel: getCurrentMonthLabel(now),
        game: requestedGame,
      });
    } catch (e) {
      console.error('Leaderboard GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
    }
  }

  /* ─── POST: submit score ─── */
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      if (body.action === 'grant_vip') {
        const authHeader = req.headers.authorization || req.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autenticato' });
        const token = authHeader.split(' ')[1];
        const valRes = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
        if (!valRes.ok) return res.status(401).json({ error: 'Token non valido' });
        const valData = await valRes.json();
        const username = valData.login;

        const targetUsername = typeof body.targetUsername === 'string' ? body.targetUsername.trim().toLowerCase().slice(0, 50) : '';
        if (!targetUsername || targetUsername === username) return res.status(400).json({ error: 'Nome utente non valido' });

        const season = getCurrentSeason(now);
        const weeklyKey = getWeeklyKey(season, now);

        // Verifica finestra temporale
        const windowOpen = isVipWindowOpen(now);
        if (!windowOpen) return res.status(400).json({ error: 'La finestra per assegnare il VIP non è aperta' });

        // Verifica vincitore
        const top = await redis.zrange(weeklyKey, 0, 0, { rev: true, withScores: true });
        const winner = top?.[0]?.member || top?.[0]?.value || (typeof top?.[0] === 'string' ? top[0] : null);
        if (!winner || String(winner).toLowerCase() !== username.toLowerCase()) {
          return res.status(403).json({ error: 'Non sei il vincitore settimanale' });
        }

        // Verifica non già assegnato
        const grantKey = `lb:vip_grant:${weeklyKey}`;
        const existing = await redis.hget(grantKey, 'grantee');
        if (existing) return res.status(400).json({ error: 'Hai già assegnato il VIP questa settimana' });

        // Salva grant
        await redis.hset(grantKey, { winner: username, grantee: targetUsername, grantedAt: Date.now().toString() });
        await redis.expire(grantKey, 864000); // 10 giorni

        // Log audit
        await redis.lpush('lb:vip_log', JSON.stringify({ winner: username, grantee: targetUsername, weekKey: weeklyKey, grantedAt: Date.now() }));
        await redis.ltrim('lb:vip_log', 0, 99);

        return res.status(200).json({ ok: true, grantee: targetUsername });
      }

      const { score, season: bodySeason, game: bodyGame } = body;
      const targetSeason = (bodySeason || currentSeason).replace(/[^0-9-]/g, '');
      const targetGame = SUPPORTED_GAMES.has(bodyGame) ? bodyGame : 'monthly';

      if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || score > 999999) {
        return res.status(400).json({ error: 'Punteggio non valido.' });
      }
      if (targetSeason !== currentSeason) {
        return res.status(400).json({ error: 'Non puoi inviare punteggi per una stagione passata.' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
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

      const weeklyKey = getWeeklyKey(targetSeason, now, targetGame);
      const monthlyKey = getMonthlyKey(targetSeason, targetGame);
      const generalKey = generalKeyFor(targetGame);

      // Fetch current best scores
      const [oldMonthly, oldWeekly] = await Promise.all([
        redis.zscore(monthlyKey, username),
        redis.zscore(weeklyKey, username),
      ]);

      const ops = [];
      let updatedMonthly = false;
      let updatedWeekly = false;

      // Monthly: update only if this score is higher than the current monthly best
      if (oldMonthly === null || Number(oldMonthly) < score) {
        ops.push(redis.zadd(monthlyKey, { score, member: username }));
        updatedMonthly = true;
      }

      // Weekly: update only if this score is higher than the current weekly best
      if (oldWeekly === null || Number(oldWeekly) < score) {
        ops.push(redis.zadd(weeklyKey, { score, member: username }));
        ops.push(redis.expire(weeklyKey, WEEKLY_TTL_SECONDS));
        updatedWeekly = true;
      }

      if (ops.length > 0) await Promise.all(ops);

      // General: add the delta of monthly improvement via ZINCRBY
      // This keeps general = Σ monthly_max across all months
      if (updatedMonthly) {
        const delta = score - (oldMonthly !== null ? Number(oldMonthly) : 0);
        await redis.zincrby(generalKey, delta, username);
      }

      if (!updatedMonthly && !updatedWeekly) {
        return res.status(200).json({
          message: 'Hai già un punteggio più alto!',
          username,
          currentMonthlyBest: Number(oldMonthly),
          submitted: score,
        });
      }

      return res.status(200).json({
        message: 'Punteggio registrato!',
        username,
        score,
        updatedMonthly,
        updatedWeekly,
      });
    } catch (e) {
      console.error('Leaderboard POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio del punteggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
