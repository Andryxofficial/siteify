/**
 * SISTEMA TAG INTELLIGENTE
 * ────────────────────────
 * Sistema di tagging libero (hashtag-style) con:
 *   • Validazione + anti-spam deterministico (regex + blocklist + ripetizioni)
 *   • Indicizzazione Redis dei post per ogni tag
 *   • Generazione automatica di "macro-categorie" tramite clustering per
 *     co-occorrenza (Jaccard similarity + union-find)
 *   • Reward XP per tag virali; penalità per spam
 *   • Follow/unfollow utenti
 *
 * Perché un classifier euristico e non una vera LLM:
 *   Una LLM (anche distillata) richiede 50-100 MB di pesi e tempi di inferenza
 *   incompatibili con l'edge serverless. Il nostro classifier usa regole
 *   deterministiche + clustering matematico: leggero, locale, prevedibile,
 *   spiegabile. Vedi `src/pages/TagInfoPage.jsx` per i dettagli mostrati
 *   all'utente finale.
 *
 * Modello dati Redis:
 *   tag:<slug>                 → SortedSet (score=ts, member=postId)
 *   tag:meta:<slug>            → Hash { displayName, slug, firstUser, firstUseAt,
 *                                       postCount, status: 'ok'|'flagged'|'banned',
 *                                       followerCount }
 *   tags:popular               → SortedSet (score=postCount, member=slug)
 *   tags:trending              → SortedSet (score=ts ultima creazione, member=slug)
 *   tag:followers:<slug>       → Set di username
 *   tag:follows:<username>     → Set di slug
 *   tags:macros:cache          → JSON string (TTL 300s) — risultato buildMacros
 *   tags:rewards:<username>    → Hash { tag_<slug>: 'milestone1'|'milestone2' }
 *                                (idempotenza reward)
 */

import { getProfanityPenalty } from './social-leaderboard.js';

/* ════════════════ COSTANTI ════════════════ */

export const TAG_MIN_LEN = 2;
export const TAG_MAX_LEN = 24;
export const TAGS_PER_POST_MAX = 5;
export const MACROS_CACHE_TTL_SEC = 300;
export const MACROS_MAX = 8;
export const MACROS_TOP_TAGS = 50;
export const MACROS_JACCARD_THRESHOLD = 0.22;

/* Parole bloccate categoricamente (no scampo) */
const TAG_BANNED = new Set([
  'admin', 'root', 'system', 'null', 'undefined', 'nan',
  'porn', 'xxx', 'porno', 'nudes',
  'casino', 'slot', 'slots', 'bet', 'gambling', 'scommesse',
  'crypto-airdrop', 'airdrop', 'pump', 'pumpgroup',
  'onlyfans', 'of-leak', 'leak', 'leaked',
  'viagra', 'cialis',
  // mascherate variazioni con dash
  'free-money', 'money-now', 'easy-cash',
]);

/* Pattern sospetti che generano "flag" (visibile ma penalizzato) */
const TAG_SPAM_PATTERNS = [
  /^free/, /money$/, /^buy/, /cash$/, /^win/, /win$/,
  /^promo/, /^sale/, /^discount/, /^cheap/, /^bonus/,
  /sex/, /erotic/,
];

/* Reward XP (concessi una sola volta per (utente, tag, milestone)) */
export const TAG_XP_MILESTONE_5_USERS = 15;   // 5+ utenti distinti hanno usato il tag
export const TAG_XP_MILESTONE_10_FOLLOWERS = 25; // 10+ follower
export const TAG_XP_PENALTY_SPAM = -10;       // tag flaggato come spam

/* ════════════════ SLUGIFY + VALIDATE ════════════════ */

/**
 * Trasforma input utente in slug ASCII canonico.
 * Mantiene `-` per separare parole; rimuove tutto il resto.
 *   "Pixel Art!"   → "pixel-art"
 *   "  CIAO123 "   → "ciao123"
 *   "café-noir"    → "cafe-noir"
 */
export function slugifyTag(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accenti
    .replace(/[#@]/g, '')                                // rimuovi prefissi
    .replace(/[^a-z0-9-]+/g, '-')                        // tutto-non-alfanum → dash
    .replace(/-+/g, '-')                                  // collassa dash multipli
    .replace(/^-+|-+$/g, '')                              // trim dash
    .slice(0, TAG_MAX_LEN);
}

/**
 * Valida uno slug. Ritorna { ok, status, reason }.
 *   status: 'ok' (clean), 'flagged' (sospetto, indicizza ma penalizza),
 *           'banned' (rifiutato totalmente).
 *   reason: stringa human-readable per errori.
 */
export function validateTag(slug) {
  if (!slug || typeof slug !== 'string') {
    return { ok: false, status: 'banned', reason: 'Tag vuoto.' };
  }
  if (slug.length < TAG_MIN_LEN) {
    return { ok: false, status: 'banned', reason: `Troppo corto (min ${TAG_MIN_LEN}).` };
  }
  if (slug.length > TAG_MAX_LEN) {
    return { ok: false, status: 'banned', reason: `Troppo lungo (max ${TAG_MAX_LEN}).` };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { ok: false, status: 'banned', reason: 'Solo lettere, numeri e trattini.' };
  }
  // 4+ stessa lettera consecutiva → "aaaa", "ssss" → spam
  if (/(.)\1{3,}/.test(slug)) {
    return { ok: false, status: 'banned', reason: 'Troppe lettere ripetute.' };
  }
  if (TAG_BANNED.has(slug)) {
    return { ok: false, status: 'banned', reason: 'Tag non consentito.' };
  }
  // Profanità: sfrutta lo stesso classifier dei post
  const penalty = getProfanityPenalty(slug.replace(/-/g, ' '));
  if (penalty <= -3) {
    return { ok: false, status: 'banned', reason: 'Tag offensivo.' };
  }
  // Pattern sospetti → flagged ma indicizzato
  for (const pattern of TAG_SPAM_PATTERNS) {
    if (pattern.test(slug)) {
      return { ok: true, status: 'flagged', reason: 'Tag sospetto (penalizzato in classifica).' };
    }
  }
  if (penalty < 0) {
    return { ok: true, status: 'flagged', reason: 'Tag con linguaggio scurrile.' };
  }
  return { ok: true, status: 'ok', reason: '' };
}

/**
 * Normalizza+valida una lista di tag grezza dell'utente.
 * Ritorna { accepted: [{ slug, status }], rejected: [{ raw, reason }] }
 * Limita ai primi TAGS_PER_POST_MAX accettati.
 */
export function normalizeTagList(rawList) {
  if (!Array.isArray(rawList)) return { accepted: [], rejected: [] };
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  for (const raw of rawList) {
    if (typeof raw !== 'string') continue;
    const slug = slugifyTag(raw);
    if (!slug) {
      rejected.push({ raw, reason: 'Tag non valido dopo normalizzazione.' });
      continue;
    }
    if (seen.has(slug)) continue; // duplicato silenzioso
    seen.add(slug);
    const v = validateTag(slug);
    if (!v.ok) {
      rejected.push({ raw, slug, reason: v.reason });
      continue;
    }
    accepted.push({ slug, status: v.status });
    if (accepted.length >= TAGS_PER_POST_MAX) break;
  }
  return { accepted, rejected };
}

/* ════════════════ INDEXING ════════════════ */

/**
 * Indicizza un post sotto i tag accettati e aggiorna le metadata.
 * Esegue le operazioni Redis in parallelo dove possibile.
 * Se un tag non esiste in `tag:meta:<slug>`, lo crea con autore = creatorLogin.
 */
export async function indexPostTags(redis, { postId, tags, creatorLogin, ts, displayMap = {} }) {
  if (!tags || tags.length === 0) return;
  const ops = [];
  for (const { slug, status } of tags) {
    ops.push(redis.zadd(`tag:${slug}`, { score: ts, member: String(postId) }));
    // Aggiorna meta — usa hsetnx-equivalente: leggi prima per sapere se esiste
    ops.push((async () => {
      const existing = await redis.hgetall(`tag:meta:${slug}`);
      if (!existing || !existing.slug) {
        // Prima volta che il tag viene usato
        await redis.hset(`tag:meta:${slug}`, {
          slug,
          displayName: displayMap[slug] || slug,
          firstUser: creatorLogin,
          firstUseAt: ts,
          postCount: 1,
          followerCount: 0,
          status,
        });
      } else {
        await redis.hincrby(`tag:meta:${slug}`, 'postCount', 1);
        // Se nuovo status è peggiore, aggiornalo
        if (status === 'flagged' && existing.status === 'ok') {
          await redis.hset(`tag:meta:${slug}`, { status: 'flagged' });
        }
      }
    })());
    // Aggiorna ranking popolarità (zincrby aggiunge se non esiste)
    ops.push(redis.zincrby('tags:popular', 1, slug));
    // Aggiorna trending (timestamp = ultimo uso)
    ops.push(redis.zadd('tags:trending', { score: ts, member: slug }));
  }
  await Promise.all(ops);
}

/**
 * Ritorna i tag che un post ha (lista di slug). Utile per de-indicizzare al delete.
 */
export async function getPostTags(redis, postId) {
  const raw = await redis.hget(`community:post:${postId}`, 'tags');
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.map(t => typeof t === 'string' ? t : t?.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * De-indicizza un post da tutti i suoi tag (chiamato al delete del post).
 */
export async function unindexPostTags(redis, postId, tagSlugs) {
  if (!tagSlugs || tagSlugs.length === 0) return;
  const ops = [];
  for (const slug of tagSlugs) {
    ops.push(redis.zrem(`tag:${slug}`, String(postId)));
    ops.push(redis.hincrby(`tag:meta:${slug}`, 'postCount', -1));
    ops.push(redis.zincrby('tags:popular', -1, slug));
  }
  await Promise.all(ops);
}

/* ════════════════ MACRO-CATEGORIE (CLUSTERING) ════════════════ */

/**
 * Costruisce le macro-categorie clusterizzando i tag più popolari per
 * co-occorrenza (Jaccard similarity sui set di postId).
 *
 * Algoritmo:
 *   1. Prendi i top MACROS_TOP_TAGS tag per popolarità
 *   2. Per ogni tag, prendi il suo set di post (top 100 recenti)
 *   3. Per ogni coppia di tag, calcola Jaccard = |A∩B| / |A∪B|
 *   4. Se > MACROS_JACCARD_THRESHOLD, uniscili (union-find)
 *   5. Cluster con 2+ tag diventano macro-categorie
 *   6. Nome macro = tag con più post nel cluster
 *
 * Risultato cachato in `tags:macros:cache` per MACROS_CACHE_TTL_SEC sec.
 */
export async function getMacroCategories(redis, { force = false } = {}) {
  if (!force) {
    const cached = await redis.get('tags:macros:cache');
    if (cached) {
      try { return typeof cached === 'string' ? JSON.parse(cached) : cached; } catch { /* rebuild */ }
    }
  }

  // 1. Top tag per popolarità
  const slugs = await redis.zrange('tags:popular', 0, MACROS_TOP_TAGS - 1, { rev: true });
  if (!slugs || slugs.length < 2) {
    const empty = [];
    await redis.set('tags:macros:cache', JSON.stringify(empty), { ex: MACROS_CACHE_TTL_SEC });
    return empty;
  }

  // Filtra fuori i tag bannati/flagged
  const metas = await Promise.all(slugs.map(s => redis.hgetall(`tag:meta:${s}`)));
  const validSlugs = [];
  const tagPosts = {};   // slug → Set di postId
  for (let i = 0; i < slugs.length; i++) {
    const m = metas[i];
    if (!m || m.status === 'banned') continue;
    validSlugs.push(slugs[i]);
  }
  if (validSlugs.length < 2) {
    await redis.set('tags:macros:cache', JSON.stringify([]), { ex: MACROS_CACHE_TTL_SEC });
    return [];
  }

  // 2. Set di post per ogni tag
  const postLists = await Promise.all(
    validSlugs.map(s => redis.zrange(`tag:${s}`, 0, 99, { rev: true }))
  );
  validSlugs.forEach((s, i) => {
    tagPosts[s] = new Set(postLists[i] || []);
  });

  // 3-4. Union-find su coppie con Jaccard > soglia
  const parent = Object.fromEntries(validSlugs.map(s => [s, s]));
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];   // path compression
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < validSlugs.length; i++) {
    const a = tagPosts[validSlugs[i]];
    if (a.size === 0) continue;
    for (let j = i + 1; j < validSlugs.length; j++) {
      const b = tagPosts[validSlugs[j]];
      if (b.size === 0) continue;
      // Jaccard
      let inter = 0;
      for (const x of a) if (b.has(x)) inter++;
      const union_size = a.size + b.size - inter;
      if (union_size === 0) continue;
      const jaccard = inter / union_size;
      if (jaccard >= MACROS_JACCARD_THRESHOLD) {
        union(validSlugs[i], validSlugs[j]);
      }
    }
  }

  // 5. Raggruppa per radice
  const clusters = {};
  for (const s of validSlugs) {
    const root = find(s);
    if (!clusters[root]) clusters[root] = [];
    clusters[root].push(s);
  }

  // 6. Tieni solo cluster con 2+ tag, ordina per # post totali, prendi top MACROS_MAX
  const macros = Object.values(clusters)
    .filter(tags => tags.length >= 2)
    .map(tags => {
      // Tag con più post → leader del cluster (= nome macro)
      let leader = tags[0];
      let leaderSize = tagPosts[tags[0]].size;
      let totalPosts = 0;
      for (const t of tags) {
        totalPosts += tagPosts[t].size;
        if (tagPosts[t].size > leaderSize) {
          leaderSize = tagPosts[t].size;
          leader = t;
        }
      }
      return {
        id: leader,
        name: leader,
        emoji: pickMacroEmoji(leader),
        tags,
        postCount: totalPosts,
      };
    })
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, MACROS_MAX);

  await redis.set('tags:macros:cache', JSON.stringify(macros), { ex: MACROS_CACHE_TTL_SEC });
  return macros;
}

/**
 * Sceglie un emoji semantico in base al nome del leader del cluster.
 * Heuristica leggera: keyword match. Default: ✨
 */
function pickMacroEmoji(slug) {
  const s = slug.toLowerCase();
  const map = [
    [['game', 'gaming', 'gioch', 'play', 'console', 'pc', 'switch', 'rpg', 'fps', 'mmo'], '🎮'],
    [['stream', 'twitch', 'live', 'kick'], '📺'],
    [['music', 'musica', 'song', 'playlist', 'album', 'beat'], '🎵'],
    [['art', 'pixel', 'design', 'draw', 'paint'], '🎨'],
    [['code', 'dev', 'tech', 'ai', 'web', 'js', 'python', 'js'], '💻'],
    [['meme', 'lol', 'humor', 'fun'], '😂'],
    [['food', 'cibo', 'cook', 'recipe', 'pizza'], '🍕'],
    [['movie', 'film', 'cinema', 'serie', 'tv'], '🎬'],
    [['book', 'libro', 'read'], '📚'],
    [['sport', 'calcio', 'football', 'basket', 'tennis'], '⚽'],
    [['anime', 'manga', 'otaku'], '🌸'],
    [['news', 'notizie'], '📰'],
  ];
  for (const [keywords, emoji] of map) {
    if (keywords.some(k => s.includes(k))) return emoji;
  }
  return '✨';
}

/* ════════════════ FOLLOW ════════════════ */

export async function followTag(redis, login, slug) {
  const [added] = await Promise.all([
    redis.sadd(`tag:followers:${slug}`, login),
    redis.sadd(`tag:follows:${login}`, slug),
  ]);
  if (added === 1) {
    await redis.hincrby(`tag:meta:${slug}`, 'followerCount', 1);
  }
  return added === 1;
}

export async function unfollowTag(redis, login, slug) {
  const [removed] = await Promise.all([
    redis.srem(`tag:followers:${slug}`, login),
    redis.srem(`tag:follows:${login}`, slug),
  ]);
  if (removed === 1) {
    await redis.hincrby(`tag:meta:${slug}`, 'followerCount', -1);
  }
  return removed === 1;
}

export async function getFollowedTags(redis, login) {
  if (!login) return [];
  const slugs = await redis.smembers(`tag:follows:${login}`);
  return Array.isArray(slugs) ? slugs : [];
}

/* ════════════════ REWARD MILESTONES ════════════════
 * Concessi una sola volta per (utente, tag, milestone).
 * Tracciamento via hash `tags:rewards:<username>` con chiave `tag_<slug>`.
 *
 * I reward sono opportunistici: chiamati DOPO indexPostTags se l'utente
 * è il `firstUser` del tag e il tag ha raggiunto una soglia.
 */
export async function maybeAwardTagMilestones(redis, login, slug, awardXpFn) {
  if (!login || !slug || typeof awardXpFn !== 'function') return;
  try {
    const meta = await redis.hgetall(`tag:meta:${slug}`);
    if (!meta || meta.firstUser !== login) return; // solo il creatore del tag

    const rewardsKey = `tags:rewards:${login}`;
    const fieldKey = `tag_${slug}`;
    const alreadyDone = await redis.hget(rewardsKey, fieldKey);

    const postCount = Number(meta.postCount || 0);
    const followerCount = Number(meta.followerCount || 0);
    const status = meta.status || 'ok';

    // Penalità immediata se flagged → -10 una volta sola
    if (status === 'flagged' && alreadyDone !== 'penalty') {
      await Promise.all([
        awardXpFn(login, TAG_XP_PENALTY_SPAM),
        redis.hset(rewardsKey, { [fieldKey]: 'penalty' }),
      ]);
      return;
    }
    if (status === 'banned') return;

    // Milestone 1: 5+ post (proxy per "tag interessante")
    if (postCount >= 5 && alreadyDone !== 'm1' && alreadyDone !== 'm2') {
      await Promise.all([
        awardXpFn(login, TAG_XP_MILESTONE_5_USERS),
        redis.hset(rewardsKey, { [fieldKey]: 'm1' }),
      ]);
    }
    // Milestone 2: 10+ follower
    if (followerCount >= 10 && alreadyDone !== 'm2') {
      await Promise.all([
        awardXpFn(login, TAG_XP_MILESTONE_10_FOLLOWERS),
        redis.hset(rewardsKey, { [fieldKey]: 'm2' }),
      ]);
    }
  } catch (e) {
    console.warn('[tagSystem] maybeAwardTagMilestones failed:', e?.message);
  }
}
