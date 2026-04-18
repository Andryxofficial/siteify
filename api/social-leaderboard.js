import { Redis } from '@upstash/redis';

/**
 * Social Leaderboard API — Community XP Ranking
 *
 * Users earn XP through community interactions:
 *   - Create a post:  +10 XP
 *   - Write a reply:  +5 XP
 *   - Like received:  +2 XP (to the post author)
 *   - Like given:     +1 XP (to the person who liked)
 *
 * Three scoreboards stored as Redis sorted sets:
 *
 *   Monthly  — Total XP earned by each user in the current month.
 *              Key: social:lb:<YYYY-MM>  (permanent archive)
 *              Levels reset every month (level is derived from monthly XP).
 *
 *   General  — Cumulative: sum of all monthly XP across every month.
 *              Key: social:lb:general  (updated incrementally via ZINCRBY)
 *              So general[user] = Σ monthly_xp(user, month) over all months.
 *
 * GET /api/social-leaderboard[?season=YYYY-MM]
 *   Returns: { monthly, general, archive, currentSeason, currentLabel }
 *
 * Each entry: { username, xp, level, levelLabel, levelEmoji, nextLevelXp, progress }
 */

export const GENERAL_KEY = 'social:lb:general';
const MAX_ENTRIES = 50;

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/* ─── Level thresholds ─── */
export const LEVELS = [
  { level: 1, xp: 0,    label: 'Nuovo Arrivato', emoji: '🌱' },
  { level: 2, xp: 50,   label: 'Curioso',         emoji: '🌿' },
  { level: 3, xp: 150,  label: 'Appassionato',    emoji: '⭐' },
  { level: 4, xp: 350,  label: 'Habitué',         emoji: '💫' },
  { level: 5, xp: 700,  label: 'Esperto',         emoji: '🔥' },
  { level: 6, xp: 1200, label: 'Veterano',        emoji: '💎' },
  { level: 7, xp: 2000, label: 'Elite',           emoji: '🏆' },
  { level: 8, xp: 3500, label: 'Leggenda',        emoji: '👑' },
];

export function getLevel(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xp) current = l;
    else break;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const prevXp = current.xp;
  const nextXp = next ? next.xp : null;
  const progress = next
    ? Math.min(100, Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100))
    : 100;
  return {
    level: current.level,
    levelLabel: current.label,
    levelEmoji: current.emoji,
    nextLevelXp: nextXp,
    progress,
  };
}

/* ─── Diminishing returns ───
 *
 * Each action type has a time window. The more times a user repeats the same
 * action within that window, the less XP they earn. This prevents spam.
 *
 * Multipliers per repetition count (1-indexed):
 *   1st action → 100%
 *   2nd         →  75%
 *   3rd         →  50%
 *   4th         →  25%
 *   5th+        →  10%
 *
 * Windows:
 *   post  → 24 h  (daily cap on post XP)
 *   reply → 1 h   (hourly cap on reply XP)
 *   like  → 1 h   (hourly cap on like-given XP)
 */
const DECAY_MULTIPLIERS = [1.0, 0.75, 0.5, 0.25, 0.1];
const DECAY_WINDOWS = {
  post:  24 * 3600, // 24 hours
  reply: 3600,      // 1 hour
  like:  3600,      // 1 hour
};

/**
 * Increments the user's action counter and returns a decayed XP value.
 * Redis key: `social:decay:<action>:<username>` with TTL = window seconds.
 */
export async function getDecayedXp(redis, username, action, baseXp) {
  if (!username || baseXp <= 0) return 0;
  const window = DECAY_WINDOWS[action] || 3600;
  const key = `social:decay:${action}:${username}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, window);
  const factor = DECAY_MULTIPLIERS[Math.min(count - 1, DECAY_MULTIPLIERS.length - 1)];
  return Math.max(1, Math.round(baseXp * factor));
}

/* ─── Content quality scoring ───
 *
 * Posts and replies earn a quality multiplier based on their content.
 * Short, low-effort, or repetitive text gives less XP.
 * Longer, more thoughtful content gets a bonus.
 *
 * Quality multiplier (0.3 – 1.5):
 *   - Base 1.0
 *   - Very short (< 15 chars)            → 0.3  (low effort)
 *   - Short (15–29 chars)                 → 0.6
 *   - Medium (30–79 chars)                → 1.0
 *   - Long (80–199 chars)                 → 1.15
 *   - Very long (200+ chars)              → 1.3
 *   - Has multiple unique words (10+)     → +0.2 bonus
 *   - Repetitive (>50% repeated words)    → ×0.5 penalty (halved)
 *   - ALL CAPS                            → ×0.6 penalty
 */
export function getContentQualityMultiplier(text) {
  if (!text || typeof text !== 'string') return 0.3;
  const trimmed = text.trim();
  const len = trimmed.length;

  // Length-based factor
  let factor;
  if (len < 15)       factor = 0.3;
  else if (len < 30)  factor = 0.6;
  else if (len < 80)  factor = 1.0;
  else if (len < 200) factor = 1.15;
  else                factor = 1.3;

  // Word analysis
  const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);

  // Bonus for vocabulary diversity (10+ unique words)
  if (uniqueWords.size >= 10) factor += 0.2;

  // Penalty for repetitive text (>50% repeated words, at least 4 words needed)
  if (words.length >= 4 && uniqueWords.size / words.length < 0.5) {
    factor *= 0.5;
  }

  // Penalty for ALL CAPS (more than 60% uppercase letters if >10 alpha chars)
  const alphaChars = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (alphaChars.length > 10) {
    const upperCount = [...alphaChars].filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
    if (upperCount / alphaChars.length > 0.6) {
      factor *= 0.6;
    }
  }

  return Math.max(0.1, Math.min(1.5, Math.round(factor * 100) / 100));
}

/* ─── Profanity detection & censoring (Italian) ───
 *
 * Checks text for Italian blasphemies and vulgar language.
 *
 * Two exported functions:
 *   getProfanityPenalty(text) → XP penalty (0 to -5)
 *   censorProfanity(text)    → text with profanity replaced by asterisks
 *
 * Penalty:  0 (clean) to -5 (heavy profanity)
 */

/* ── Multi-word blasphemies (compound forms) ──
 * Each entry is an array of "word parts" that can appear with or without spaces.
 * e.g. ['porco','dio'] matches "porcodio", "porco dio", "p o r c o d i o" etc.
 */
const BESTEMMIE_COMPOUND = [
  ['porco', 'dio'],    ['porco', 'dd', 'io'], ['porco', 'ddi', 'o'],
  ['dio', 'porco'],    ['dio', 'cane'],       ['dio', 'boia'],
  ['dio', 'bestia'],   ['dio', 'ladro'],      ['dio', 'maiale'],
  ['madonna', 'puttana'], ['madonna', 'troia'],
  ['dio', 'santo'],    ['porco', 'madonna'],  ['porca', 'madonna'],
  ['cristo', 'd'],     ['dio', 'merda'],
  ['porco', 'dd'],     ['dio', 'fa'],         ['dio', 'cr'],
];
const VOLGARITA = [
  'cazzo', 'minchia', 'stronzo', 'stronza', 'vaffanculo', 'fanculo',
  'merda', 'coglione', 'cogliona', 'troia', 'puttana',
  'fottiti', 'fottere', 'scopare', 'cazzata', 'minkia',
  'porcodue', 'mannaggia',
];

/** Build a case-insensitive regex that matches compound parts with optional spaces/punctuation between them. */
function buildCompoundRegex(parts) {
  // Each part is matched literally; parts can be separated by spaces/punctuation
  const escaped = parts.map(p =>
    p.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.,!?;:\'"-]*')
  );
  return new RegExp(escaped.join('[\\s.,!?;:\'"-]*'), 'gi');
}

/** Pre-compiled regexes for all profanity patterns (built once at module load). */
const BESTEMMIE_REGEXES = BESTEMMIE_COMPOUND.map(parts => buildCompoundRegex(parts));
const VOLGARITA_REGEXES = VOLGARITA.map(word => new RegExp(
  word.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.,!?;:\'"-]*'),
  'gi',
));

// Flat list for penalty detection (normalized, no-space version)
const BESTEMMIE = BESTEMMIE_COMPOUND.map(parts => parts.join(''));


/**
 * Returns XP penalty (0 to -5) based on profanity in text.
 * Heavy (bestemmie) → -3 per match (max -5)
 * Mild (volgarità)  → -1 per match (max -3)
 */
export function getProfanityPenalty(text) {
  if (!text || typeof text !== 'string') return 0;
  // Normalize: lowercase, remove accents, collapse spaces, strip punctuation
  const normalized = text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let penalty = 0;

  // Build regex for each word, allowing optional spaces between characters of multi-word combos
  for (const word of BESTEMMIE) {
    // Allow spaces inside compound words (e.g. "porco dio" matches "porcodio")
    const pattern = word.split('').join('\\s*');
    if (new RegExp(pattern).test(normalized)) {
      penalty -= 3;
    }
  }

  for (const word of VOLGARITA) {
    if (normalized.includes(word)) {
      penalty -= 1;
    }
  }

  return Math.max(-5, penalty);
}

/**
 * Censors profanity in text by replacing matched words with asterisks.
 * Bestemmie (compound) are replaced first, then individual vulgar words.
 * Preserves original text structure — only the matched characters become `*`.
 */
export function censorProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;

  // Bestemmie first (longer compound matches take priority)
  for (const regex of BESTEMMIE_REGEXES) {
    result = result.replace(regex, match => '*'.repeat(match.length));
  }

  // Then individual vulgar words
  for (const regex of VOLGARITA_REGEXES) {
    result = result.replace(regex, match => '*'.repeat(match.length));
  }

  return result;
}

/* ─── Key helpers ─── */

export function getMonthlyKey(season) {
  return `social:lb:${season}`;
}

export function getCurrentSeason(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthLabel(now = new Date()) {
  return `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

/** Returns up to `lookback` completed months before the current one, newest first. */
function getCompletedSeasons(now = new Date(), lookback = 12) {
  const result = [];
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
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

function parseEntries(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(e => ({
      username: String(e.value ?? e.member ?? e.element ?? ''),
      xp: Number(e.score ?? 0),
    }));
  }
  const result = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    result.push({ username: String(raw[i]), xp: Number(raw[i + 1]) });
  }
  return result;
}

function enrichEntries(entries) {
  return entries.map(e => ({ ...e, ...getLevel(e.xp) }));
}

/* ─── Handler ─── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non supportato.' });

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

  try {
    const now = new Date();
    const currentSeason = getCurrentSeason(now);
    const requestedSeason = (req.query?.season || currentSeason).replace(/[^0-9-]/g, '');
    const monthlyKey = getMonthlyKey(requestedSeason);
    const completedSeasons = getCompletedSeasons(now);

    const archivePromises = completedSeasons.map(s =>
      redis.zrange(getMonthlyKey(s.season), 0, 2, { rev: true, withScores: true })
    );

    const [monthlyRaw, generalRaw, ...archiveRawArr] = await Promise.all([
      redis.zrange(monthlyKey, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
      redis.zrange(GENERAL_KEY, 0, MAX_ENTRIES - 1, { rev: true, withScores: true }),
      ...archivePromises,
    ]);

    const archive = completedSeasons
      .map((s, i) => ({
        season: s.season,
        label: s.label,
        monthNum: s.monthNum,
        year: s.year,
        top3: enrichEntries(parseEntries(archiveRawArr[i]).slice(0, 3)),
      }))
      .filter(a => a.top3.length > 0);

    return res.status(200).json({
      monthly: enrichEntries(parseEntries(monthlyRaw)),
      general: enrichEntries(parseEntries(generalRaw)),
      archive,
      currentSeason: requestedSeason,
      currentLabel: getCurrentMonthLabel(now),
      levels: LEVELS,
    });
  } catch (e) {
    console.error('Social leaderboard GET error:', e);
    return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
  }
}
