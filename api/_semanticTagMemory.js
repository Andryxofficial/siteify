import { miniTokenize, miniClassify, miniNameMacro } from './_localMiniLlm.js';

const MEMORY_VERSION = 1;
const MAX_CONTEXT_TERMS = 48;
const MAX_TAGS = 8;
const MAX_RELATED = 14;
const MAX_MACROS = 10;
const MIN_EMERGENT_POSTS = 3;

function clean(value, max = 120) {
  return String(value || '')
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- sanitizzazione: rimuove caratteri di controllo (tranne tab/CR/LF)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .trim()
    .slice(0, max);
}

function uniq(list) { return [...new Set((list || []).filter(Boolean))]; }

function normalizeTag(tag) {
  return clean(tag, 32)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[#@]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function safeTags(tags) {
  return uniq((Array.isArray(tags) ? tags : []).map(normalizeTag).filter(t => t.length >= 2)).slice(0, MAX_TAGS);
}

function weightedTerms({ title = '', body = '', tags = [] }) {
  const titleTerms = miniTokenize(title).slice(0, 36);
  const bodyTerms = miniTokenize(body).slice(0, 80);
  const tagTerms = safeTags(tags);
  const weights = new Map();
  const add = (term, weight) => {
    const t = normalizeTag(term);
    if (!t || t.length < 2 || /^\d+$/.test(t)) return;
    weights.set(t, (weights.get(t) || 0) + weight);
  };
  titleTerms.forEach(t => add(t, 2.3));
  bodyTerms.forEach(t => add(t, 1));
  tagTerms.forEach(t => add(t, 3.4));
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CONTEXT_TERMS)
    .map(([term, weight]) => ({ term, weight: Number(weight.toFixed(2)) }));
}

export async function learnFromPost(redis, { postId, title, body, tags, author, ts = Date.now() } = {}) {
  const tagList = safeTags(tags);
  if (!redis || !postId || tagList.length === 0) return { learned: false, reason: 'missing_data' };

  const terms = weightedTerms({ title, body, tags: tagList });
  const ops = [
    redis.hincrby('semantic:model:stats', 'postCount', 1),
    redis.hset('semantic:model:stats', { version: MEMORY_VERSION, updatedAt: ts }),
    redis.zadd('semantic:recent-posts', { score: ts, member: String(postId) }),
  ];

  for (const tag of tagList) {
    ops.push(redis.zincrby('semantic:tag-usage', 1, tag));
    ops.push(redis.hincrby(`semantic:tag-meta:${tag}`, 'postCount', 1));
    ops.push(redis.hset(`semantic:tag-meta:${tag}`, { lastPostId: String(postId), lastUseAt: ts, lastAuthor: clean(author, 50) }));

    for (const { term, weight } of terms) {
      if (term === tag) continue;
      ops.push(redis.zincrby(`semantic:tag-context:${tag}`, weight, term));
      ops.push(redis.zincrby(`semantic:term-tags:${term}`, weight, tag));
    }

    for (const other of tagList) {
      if (other === tag) continue;
      ops.push(redis.zincrby(`semantic:tag-cooc:${tag}`, 1, other));
    }
  }

  /* Invalida cache macro evolutive: il prossimo GET le ricostruisce. */
  ops.push(redis.del('semantic:macros:cache'));
  await Promise.allSettled(ops);
  return { learned: true, tags: tagList, terms: terms.slice(0, 12).map(t => t.term) };
}

async function getTagProfile(redis, tag) {
  const slug = normalizeTag(tag);
  if (!slug) return null;
  const [meta, context, related] = await Promise.all([
    redis.hgetall(`semantic:tag-meta:${slug}`),
    redis.zrange(`semantic:tag-context:${slug}`, 0, 11, { rev: true, withScores: true }),
    redis.zrange(`semantic:tag-cooc:${slug}`, 0, MAX_RELATED - 1, { rev: true, withScores: true }),
  ]);

  const ctx = [];
  if (Array.isArray(context)) {
    for (let i = 0; i < context.length; i += 2) ctx.push({ term: context[i], score: Number(context[i + 1] || 0) });
  }
  const rel = [];
  if (Array.isArray(related)) {
    for (let i = 0; i < related.length; i += 2) rel.push({ tag: related[i], score: Number(related[i + 1] || 0) });
  }
  const postCount = Number(meta?.postCount || 0);
  return { tag: slug, postCount, context: ctx, related: rel, mature: postCount >= MIN_EMERGENT_POSTS };
}

function buildEmergentName(profile, fallback) {
  const topRelated = profile.related?.[0]?.tag;
  const topContext = profile.context?.find(x => x.term !== profile.tag)?.term;
  if (profile.mature && topRelated && topContext) return `${profile.tag} + ${topRelated}`;
  if (profile.mature && topContext) return `${profile.tag}: ${topContext}`;
  return fallback?.displayName || fallback?.category || profile.tag;
}

export async function classifyWithMemory(redis, { title = '', body = '', tags = [] } = {}) {
  const tagList = safeTags(tags);
  const fallback = miniClassify({ title, body, tags: tagList });
  if (!redis || tagList.length === 0) return { ...fallback, learned: false, source: 'bootstrap' };

  const profiles = (await Promise.all(tagList.map(t => getTagProfile(redis, t)))).filter(Boolean);
  const mature = profiles.filter(p => p.mature);
  if (mature.length === 0) return { ...fallback, learned: false, source: 'bootstrap-waiting-data', profiles };

  const contextTerms = weightedTerms({ title, body, tags: tagList }).map(x => x.term);
  const scores = mature.map(profile => {
    let score = Math.min(10, profile.postCount) * 0.4;
    const profileTerms = new Set(profile.context.map(x => x.term));
    const related = new Set(profile.related.map(x => x.tag));
    for (const term of contextTerms) if (profileTerms.has(term)) score += 1.7;
    for (const tag of tagList) if (related.has(tag)) score += 2.2;
    if (tagList.includes(profile.tag)) score += 2.5;
    return { profile, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const confidence = Number(Math.max(0.42, Math.min(0.98, best.score / 12)).toFixed(2));
  const suggestedTags = uniq([
    ...tagList,
    ...best.profile.related.slice(0, 3).map(x => x.tag),
    ...best.profile.context.slice(0, 4).map(x => x.term),
  ]).slice(0, 5);

  return {
    engine: 'andryx-adaptive-tag-memory',
    mode: 'backend-local-evolving',
    source: 'semantic-memory',
    learned: true,
    categoryId: `emergent:${best.profile.tag}`,
    category: buildEmergentName(best.profile, fallback),
    emoji: fallback.emoji || '✨',
    confidence,
    suggestedTags,
    reasons: [
      `postCount:${best.profile.postCount}`,
      ...best.profile.context.slice(0, 4).map(x => `context:${x.term}`),
      ...best.profile.related.slice(0, 3).map(x => `cooc:${x.tag}`),
    ],
    alternatives: scores.slice(1, 4).map(x => ({
      id: `emergent:${x.profile.tag}`,
      label: buildEmergentName(x.profile, fallback),
      confidence: Number(Math.max(0.1, Math.min(0.9, x.score / 12)).toFixed(2)),
    })),
    profiles: profiles.map(p => ({ tag: p.tag, postCount: p.postCount, mature: p.mature })),
  };
}

async function enrichMacroWithMemory(redis, macro) {
  const tags = safeTags(macro.tags?.length ? macro.tags : [macro.name, macro.id]);
  const profiles = (await Promise.all(tags.map(t => getTagProfile(redis, t)))).filter(Boolean);
  const matureProfiles = profiles.filter(p => p.mature);

  if (matureProfiles.length === 0) {
    return miniNameMacro(macro);
  }

  const top = matureProfiles
    .sort((a, b) => b.postCount - a.postCount || b.context.length - a.context.length)[0];
  const topContext = top.context.slice(0, 3).map(x => x.term);
  const displayName = topContext.length
    ? `${top.tag}: ${topContext[0].replace(/-/g, ' ')}`
    : top.tag;

  return {
    ...macro,
    displayName,
    categoryId: `emergent:${top.tag}`,
    category: displayName,
    emoji: miniNameMacro(macro).emoji || '✨',
    confidence: Number(Math.max(0.5, Math.min(0.97, top.postCount / 18)).toFixed(2)),
    summary: `MacroCategoria nata dai tag reali della community: ${tags.slice(0, 6).map(t => `#${t}`).join(', ')}.${topContext.length ? ` Contesto dominante: ${topContext.join(', ')}.` : ''}`,
    engine: 'andryx-adaptive-tag-memory',
    learned: true,
  };
}

export async function buildAdaptiveOverview(redis, { trending = [], macros = [] } = {}) {
  const cached = await redis.get('semantic:macros:cache');
  if (cached) {
    try { return typeof cached === 'string' ? JSON.parse(cached) : cached; } catch { /* rebuild */ }
  }

  const enrichedMacros = await Promise.all((Array.isArray(macros) ? macros : []).slice(0, MAX_MACROS).map(m => enrichMacroWithMemory(redis, m)));
  const trendTags = (Array.isArray(trending) ? trending : []).map(t => t?.slug || t?.displayName || t?.name || t).filter(Boolean).slice(0, 12);
  const trendClassification = await classifyWithMemory(redis, { tags: trendTags });
  const stats = await redis.hgetall('semantic:model:stats');

  const overview = {
    engine: trendClassification.learned ? 'andryx-adaptive-tag-memory' : 'andryx-mini-llm-js-bootstrap',
    labels: { trending: 'Tendenze in crescita', macros: 'Evoluzione macroCategorie' },
    trends: {
      title: 'Tendenze in crescita',
      categoryId: trendClassification.categoryId,
      category: trendClassification.category,
      emoji: trendClassification.emoji || '✨',
      confidence: trendClassification.confidence,
      learned: !!trendClassification.learned,
      summary: trendTags.length
        ? `${trendClassification.emoji || '✨'} Area in crescita: ${trendClassification.category}. Tag in movimento: ${trendTags.slice(0, 5).map(t => `#${t}`).join(', ')}.`
        : 'Nessuna tendenza forte al momento: appena la community si muove, qui emerge automaticamente.',
    },
    macrosTitle: 'Evoluzione macroCategorie',
    macros: enrichedMacros,
    modelStats: {
      version: MEMORY_VERSION,
      postCount: Number(stats?.postCount || 0),
      updatedAt: Number(stats?.updatedAt || 0),
      minPostsForEmergence: MIN_EMERGENT_POSTS,
    },
  };

  await redis.set('semantic:macros:cache', JSON.stringify(overview), { ex: 180 });
  return overview;
}

export async function getSemanticDebug(redis, tag) {
  if (tag) return { tag: await getTagProfile(redis, tag) };
  const stats = await redis.hgetall('semantic:model:stats');
  const top = await redis.zrange('semantic:tag-usage', 0, 20, { rev: true, withScores: true });
  return { stats, topTags: top };
}
