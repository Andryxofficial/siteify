import { Redis } from '@upstash/redis';

/**
 * Watch Time API — Classifica spettatori più longevi
 *
 * Traccia quanto tempo ogni utente loggato trascorre sulla pagina Twitch
 * tramite heartbeat periodici dal frontend (ogni ~30 secondi).
 *
 * Struttura Redis:
 *   watch:leaderboard          — sorted set globale: member=username, score=secondi_totali
 *   watch:lb:monthly:<YYYY-MM> — sorted set mensile: member=username, score=secondi_del_mese
 *   watch:rl:<username>        — chiave rate-limit (TTL 25s): impedisce heartbeat troppo frequenti
 *   watch:daily:<YYYY-MM-DD>:<username> — contatore heartbeat giornaliero (TTL 25h), cap 720/giorno
 *
 * GET /api/watch-time?action=leaderboard
 *   → { leaderboard: [{username, totalSeconds, rank}], monthly: [...], currentSeason }
 *
 * GET /api/watch-time?action=me  (richiede Authorization: Bearer <token>)
 *   → { username, totalSeconds, rank, monthlySeconds, monthlyRank }
 *
 * POST /api/watch-time  (richiede Authorization: Bearer <token>)
 *   Body: {}  — il server aggiunge sempre esattamente 30 secondi (non il client)
 *   → { ok: true, totalSeconds, monthlySeconds }
 */

const LEADERBOARD_KEY = 'watch:leaderboard';
const HEARTBEAT_SECONDS = 30;          // secondi aggiunti per ogni heartbeat
const RATE_LIMIT_TTL = 25;             // secondi minimi tra un heartbeat e il successivo
const DAILY_HEARTBEAT_CAP = 720;       // max heartbeat/giorno = 720 × 30s = 6 ore
const MAX_ENTRIES = 50;

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/** Milestone: badge assegnati in base al totale di ore guardate. */
const MILESTONES = [
  { hours: 50, emoji: '👑', label: 'Leggenda' },
  { hours: 10, emoji: '💎', label: 'Veterano' },
  { hours:  5, emoji: '⭐', label: 'Habitué' },
  { hours:  1, emoji: '⏱️', label: '1 ora' },
];

export function getMilestone(totalSeconds) {
  const hours = totalSeconds / 3600;
  for (const m of MILESTONES) {
    if (hours >= m.hours) return m;
  }
  return null;
}

function italianDate(now = new Date()) {
  const s = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD
  return s; // 'YYYY-MM-DD'
}

function getCurrentSeason(now = new Date()) {
  const s = italianDate(now); // YYYY-MM-DD
  return s.slice(0, 7);       // YYYY-MM
}

function getMonthlyKey(season) {
  return `watch:lb:monthly:${season}`;
}

function parseScores(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(entry => ({
      username: String(entry.value ?? entry.member ?? entry.element ?? ''),
      totalSeconds: Math.floor(Number(entry.score ?? 0)),
    }));
  }
  const result = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    result.push({ username: String(raw[i]), totalSeconds: Math.floor(Number(raw[i + 1])) });
  }
  return result;
}

function enrichEntries(entries) {
  return entries.map((e, idx) => ({
    ...e,
    rank: idx + 1,
    milestone: getMilestone(e.totalSeconds),
  }));
}

/* ─── Handler ─── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch (e) {
    console.error('watch-time: Redis init error:', e);
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  const now = new Date();
  const currentSeason = getCurrentSeason(now);
  const monthlyKey = getMonthlyKey(currentSeason);
  const currentMonthLabel = `${MONTH_NAMES[parseInt(currentSeason.split('-')[1], 10) - 1]} ${currentSeason.split('-')[0]}`;

  /* ─── GET ─── */
  if (req.method === 'GET') {
    const action = req.query?.action || 'leaderboard';

    /* GET ?action=leaderboard — classifica pubblica */
    if (action === 'leaderboard') {
      try {
        const [globalRaw, monthlyRaw] = await Promise.all([
          redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
          redis.zrange(monthlyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
        ]);
        return res.status(200).json({
          leaderboard: enrichEntries(parseScores(globalRaw)),
          monthly:     enrichEntries(parseScores(monthlyRaw)),
          currentSeason,
          currentMonthLabel,
          milestones: MILESTONES,
        });
      } catch (e) {
        console.error('watch-time GET leaderboard error:', e);
        return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
      }
    }

    /* GET ?action=me — stato utente autenticato */
    if (action === 'me') {
      const authHeader = req.headers.authorization || req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non autenticato' });
      }
      const token = authHeader.split(' ')[1];
      const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!valRes.ok) return res.status(401).json({ error: 'Token non valido' });
      const valData = await valRes.json();
      const username = valData.login;
      if (!username) return res.status(401).json({ error: 'Username non trovato' });

      try {
        const [totalRaw, monthlyRaw, globalRankRaw, monthlyRankRaw] = await Promise.all([
          redis.zscore(LEADERBOARD_KEY, username),
          redis.zscore(monthlyKey, username),
          redis.zrevrank(LEADERBOARD_KEY, username),
          redis.zrevrank(monthlyKey, username),
        ]);
        const totalSeconds   = Math.floor(Number(totalRaw ?? 0));
        const monthlySeconds = Math.floor(Number(monthlyRaw ?? 0));
        return res.status(200).json({
          username,
          totalSeconds,
          rank:          totalRaw   !== null ? (Number(globalRankRaw)  + 1) : null,
          monthlySeconds,
          monthlyRank:   monthlyRaw !== null ? (Number(monthlyRankRaw) + 1) : null,
          milestone:     getMilestone(totalSeconds),
        });
      } catch (e) {
        console.error('watch-time GET me error:', e);
        return res.status(500).json({ error: 'Errore nel recupero del tuo stato.' });
      }
    }

    return res.status(400).json({ error: 'Azione non riconosciuta.' });
  }

  /* ─── POST — heartbeat ─── */
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token Twitch mancante. Effettua il login.' });
    }
    const token = authHeader.split(' ')[1];

    let username;
    try {
      const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!valRes.ok) return res.status(401).json({ error: 'Token Twitch non valido o scaduto.' });
      const valData = await valRes.json();
      username = valData.login;
      if (!username) return res.status(401).json({ error: 'Impossibile ottenere il nome utente Twitch.' });
    } catch (e) {
      console.error('watch-time POST validate error:', e);
      return res.status(500).json({ error: 'Errore di validazione token.' });
    }

    try {
      /* Rate limit: max 1 heartbeat ogni RATE_LIMIT_TTL secondi per utente */
      const rlKey = `watch:rl:${username}`;
      const alreadyLocked = await redis.set(rlKey, '1', { nx: true, ex: RATE_LIMIT_TTL });
      if (alreadyLocked === null) {
        /* null = SET NX fallito = chiave esisteva già = troppo frequente */
        const [totalRaw, monthlyRaw] = await Promise.all([
          redis.zscore(LEADERBOARD_KEY, username),
          redis.zscore(monthlyKey, username),
        ]);
        return res.status(429).json({
          error: 'Heartbeat troppo frequente.',
          totalSeconds:   Math.floor(Number(totalRaw ?? 0)),
          monthlySeconds: Math.floor(Number(monthlyRaw ?? 0)),
        });
      }

      /* Cap giornaliero: max DAILY_HEARTBEAT_CAP heartbeat/giorno */
      const dailyKey = `watch:daily:${italianDate(now)}:${username}`;
      const dailyCount = await redis.incr(dailyKey);
      if (dailyCount === 1) {
        // Prima volta oggi: imposta TTL 25 ore
        await redis.expire(dailyKey, 25 * 3600);
      }
      if (dailyCount > DAILY_HEARTBEAT_CAP) {
        const [totalRaw, monthlyRaw] = await Promise.all([
          redis.zscore(LEADERBOARD_KEY, username),
          redis.zscore(monthlyKey, username),
        ]);
        return res.status(200).json({
          ok: true,
          capped: true,
          totalSeconds:   Math.floor(Number(totalRaw ?? 0)),
          monthlySeconds: Math.floor(Number(monthlyRaw ?? 0)),
        });
      }

      /* Incrementa watch time globale e mensile */
      const [newTotal, newMonthly] = await Promise.all([
        redis.zincrby(LEADERBOARD_KEY, HEARTBEAT_SECONDS, username),
        redis.zincrby(monthlyKey, HEARTBEAT_SECONDS, username),
      ]);

      return res.status(200).json({
        ok:             true,
        totalSeconds:   Math.floor(Number(newTotal)),
        monthlySeconds: Math.floor(Number(newMonthly)),
        milestone:      getMilestone(Math.floor(Number(newTotal))),
      });
    } catch (e) {
      console.error('watch-time POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio del watch time.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
