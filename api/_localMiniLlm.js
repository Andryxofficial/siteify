/**
 * ANDRYXify Mini LLM — backend-only, zero API esterne, zero modelli GGUF.
 * Motore linguistico locale ad hoc per SOCIALify: classifica post/tag, propone tag,
 * e genera nomi/descrizioni per trend e macroCategorie.
 */
const MAX_TEXT = 1800;
const MAX_TAGS = 16;
const MAX_OUTPUT_TAGS = 5;

const STOPWORDS = new Set([
  'a','ad','al','allo','alla','alle','agli','ai','anche','che','chi','con','da','dal','dalla','dei','del','della','delle','di','e','gli','ha','hai','ho','il','in','io','la','le','lo','ma','mi','nel','nella','non','o','per','piu','poi','qui','se','si','sono','su','sul','sulla','tra','un','una','uno',
  'the','and','for','from','this','that','with','you','your','are','was','were','not','all','one','new','out','into','about',
  'el','los','las','unos','unas','de','para','por','que','como','este','esta','son','mas',
]);

const TAXONOMY = [
  { id: 'gaming', label: 'Gaming', emoji: '🎮', prior: 1.15, seed: ['game','gaming','gioco','giochi','videogioco','videogiochi','valorant','fortnite','minecraft','league','legends','lol','cod','warzone','gta','rpg','fps','mmo','steam','console','playstation','xbox','nintendo','ranked','speedrun','boss','build','quest','patch','server','modpack'], templates: ['Gaming e partite','Giochi in evidenza','Community gaming'] },
  { id: 'streaming', label: 'Streaming e live', emoji: '📺', prior: 1.25, seed: ['stream','streaming','twitch','live','diretta','obs','clip','raid','chat','viewer','canale','sub','emote','vod','broadcast','overlay','webcam','microfono','scene','follow','host','moderazione','mod'], templates: ['Streaming e live','Momenti live','Twitch e community'] },
  { id: 'tech-ai', label: 'Tech e IA', emoji: '🤖', prior: 1.2, seed: ['tech','tecnologia','ai','ia','llm','modello','prompt','codice','dev','javascript','react','vite','server','backend','frontend','api','database','redis','windows','linux','hardware','software','bug','fix','release','deploy','github'], templates: ['Tech e IA','Sviluppo e tecnologia','Laboratorio digitale'] },
  { id: 'community', label: 'Community', emoji: '💬', prior: 1.0, seed: ['community','social','socialify','amici','post','thread','risposta','risposte','discussione','sondaggio','gruppo','profilo','like','preferiti','tag','categoria','feed','commenti','utenti'], templates: ['Community e discussioni','Conversazioni della community','Feed community'] },
  { id: 'meme', label: 'Meme e ironia', emoji: '😂', prior: 0.95, seed: ['meme','lol','ironia','ridere','ridiamo','shitpost','trash','humor','divertente','funny','roast','reaction','mood','assurdo'], templates: ['Meme e ironia','Momenti assurdi','Community mood'] },
  { id: 'creative', label: 'Creatività e video', emoji: '🎬', prior: 1.0, seed: ['video','foto','fotografia','editing','montaggio','cinematic','creator','contenuti','reel','tiktok','youtube','thumbnail','camera','riprese','color','grading','podcast','episodio','clip','short','render'], templates: ['Creatività e video','Produzione contenuti','Video e creator'] },
  { id: 'anime-manga', label: 'Anime e manga', emoji: '🌸', prior: 0.9, seed: ['anime','manga','one-piece','onepiece','naruto','dragonball','otaku','cosplay','gear','luffy','zoro','nami','shonen','seinen','waifu','opening'], templates: ['Anime e manga','Discussioni otaku','Mondo anime'] },
  { id: 'music', label: 'Musica', emoji: '🎵', prior: 0.85, seed: ['musica','music','song','track','playlist','spotify','album','beat','cantante','concerto','audio','mix','sound','cover','chitarra','piano'], templates: ['Musica e audio','Ascolti in crescita','Playlist community'] },
  { id: 'news', label: 'News e attualità', emoji: '📰', prior: 0.85, seed: ['news','notizie','attualita','oggi','evento','update','novita','annuncio','breaking','rilascio','uscita','concorso','bando','polizia','mondo'], templates: ['News e aggiornamenti','Attualità community','Novità in evidenza'] },
];

const TAXONOMY_BY_ID = Object.fromEntries(TAXONOMY.map(x => [x.id, x]));

function safeText(value, max = MAX_TEXT) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .slice(0, max);
}

function normalize(value) {
  return safeText(value, 300)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[#@]/g, '')
    .replace(/[^a-z0-9_-]+/g, ' ')
    .replace(/[_]+/g, '-')
    .trim();
}

export function miniTokenize(text) {
  const tokens = normalize(text)
    .split(/\s+/)
    .map(t => t.replace(/^-+|-+$/g, ''))
    .filter(t => t.length >= 2 && t.length <= 32 && !STOPWORDS.has(t));
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = `${tokens[i]}-${tokens[i + 1]}`;
    if (pair.length <= 40) bigrams.push(pair);
  }
  return [...tokens, ...bigrams];
}

function uniq(list) { return [...new Set((list || []).filter(Boolean))]; }

function cleanTags(tags) {
  return uniq((Array.isArray(tags) ? tags : [])
    .map(t => normalize(t).replace(/\s+/g, '-'))
    .filter(t => t.length >= 2 && t.length <= 24))
    .slice(0, MAX_TAGS);
}

function lexicalScore(tokens, category) {
  let score = Math.log(category.prior || 1);
  const matched = [];
  const tokenSet = new Set(tokens);
  for (const seed of category.seed) {
    const s = normalize(seed).replace(/\s+/g, '-');
    if (!s) continue;
    if (tokenSet.has(s)) { score += 3.3; matched.push(s); continue; }
    for (const token of tokenSet) {
      if (token.length < 4 || s.length < 4) continue;
      if (token.includes(s) || s.includes(token)) { score += 1.25; matched.push(s); break; }
    }
  }
  return { score, matched: uniq(matched).slice(0, 8) };
}

function getTopTerms(tokens, limit = 8) {
  const freq = new Map();
  for (const token of tokens) {
    if (STOPWORDS.has(token) || token.length < 3 || /^\d+$/.test(token)) continue;
    const bonus = token.includes('-') ? 1.35 : 1;
    freq.set(token, (freq.get(token) || 0) + bonus);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token)
    .slice(0, limit);
}

export function miniClassify(input = {}) {
  const title = safeText(input.title, 220);
  const body = safeText(input.body, MAX_TEXT);
  const tags = cleanTags(input.tags);
  const tokens = miniTokenize(`${title} ${body} ${tags.join(' ')}`);
  const ranked = TAXONOMY.map(category => {
    const base = lexicalScore(tokens, category);
    return { ...category, score: base.score, matched: base.matched };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  const margin = best.score - (second?.score || 0);
  const rawConfidence = 0.36 + Math.min(0.52, Math.max(0, margin) / 7) + Math.min(0.12, best.matched.length * 0.025);
  const confidence = Number(Math.max(0.22, Math.min(0.97, rawConfidence)).toFixed(2));
  const topTerms = getTopTerms([...tags, ...tokens], 10);
  return {
    engine: 'andryx-mini-llm-js',
    mode: 'backend-local',
    categoryId: best.id,
    category: best.label,
    emoji: best.emoji,
    confidence,
    suggestedTags: uniq([...tags, ...topTerms]).slice(0, MAX_OUTPUT_TAGS),
    reasons: best.matched.length ? best.matched.slice(0, 6).map(x => `match:${x}`) : topTerms.slice(0, 4).map(x => `term:${x}`),
    alternatives: ranked.slice(1, 4).map(x => ({ id: x.id, label: x.label, emoji: x.emoji })),
  };
}

function chooseMacroName(category, tags) {
  const clean = cleanTags(tags);
  const prominent = clean.find(t => t.length >= 4 && !['generale','post','community'].includes(t));
  if (prominent && !category.seed.includes(prominent)) return `${category.emoji} ${category.label}: ${prominent.replace(/-/g, ' ')}`;
  const templates = category.templates || [category.label];
  return `${category.emoji} ${templates[0]}`;
}

export function miniNameMacro(macro = {}) {
  const tags = cleanTags(macro.tags?.length ? macro.tags : [macro.name, macro.id]);
  const classified = miniClassify({ title: `${macro.name || ''} ${tags.join(' ')}`, tags });
  const category = TAXONOMY_BY_ID[classified.categoryId] || TAXONOMY_BY_ID.community;
  const displayName = chooseMacroName(category, tags);
  const readableTags = tags.slice(0, 5).map(t => `#${t}`).join(', ');
  return {
    ...macro,
    displayName,
    categoryId: category.id,
    category: category.label,
    emoji: category.emoji,
    confidence: classified.confidence,
    summary: readableTags ? `Raggruppa conversazioni correlate a ${readableTags}.` : `Raggruppa conversazioni simili nella macroCategoria ${category.label}.`,
    engine: 'andryx-mini-llm-js',
  };
}

export function miniEnrichMacros(macros = []) {
  return (Array.isArray(macros) ? macros : []).slice(0, 12).map(m => miniNameMacro({
    id: safeText(m.id || m.name || 'macro', 40),
    name: safeText(m.name || m.id || 'macro', 60),
    emoji: safeText(m.emoji || '✨', 8),
    tags: cleanTags(m.tags || []),
    postCount: Number(m.postCount || 0),
  }));
}

export function miniTrendOverview({ popular = [], trending = [], macros = [] } = {}) {
  const trendingTags = (Array.isArray(trending) ? trending : []).map(t => t?.slug || t?.displayName || t?.name || t).filter(Boolean).slice(0, 12);
  const popularTags = (Array.isArray(popular) ? popular : []).map(t => t?.slug || t?.displayName || t?.name || t).filter(Boolean).slice(0, 12);
  const classified = miniClassify({ tags: [...trendingTags, ...popularTags] });
  return {
    engine: 'andryx-mini-llm-js',
    labels: { trending: 'Tendenze in crescita', macros: 'Evoluzione macroCategorie' },
    trends: {
      title: 'Tendenze in crescita',
      categoryId: classified.categoryId,
      category: classified.category,
      emoji: classified.emoji,
      confidence: classified.confidence,
      summary: trendingTags.length ? `${classified.emoji} Area più attiva: ${classified.category}. Tag in movimento: ${trendingTags.slice(0, 5).map(t => `#${t}`).join(', ')}.` : 'Nessuna tendenza forte al momento: appena la community si muove, qui emerge automaticamente.',
    },
    macrosTitle: 'Evoluzione macroCategorie',
    macros: miniEnrichMacros(macros),
  };
}

export function miniGenerate(input = {}) {
  const action = safeText(input.action || 'classify', 40);
  if (action === 'macro') return miniNameMacro(input.macro || input);
  if (action === 'overview') return miniTrendOverview(input);
  return miniClassify(input);
}

export const MINI_LLM_INFO = {
  name: 'ANDRYXify Mini LLM',
  engine: 'andryx-mini-llm-js',
  backendOnly: true,
  externalApis: false,
  gguf: false,
  capabilities: ['classify-post', 'suggest-tags', 'name-macroCategories', 'trend-overview'],
  taxonomy: TAXONOMY.map(({ id, label, emoji }) => ({ id, label, emoji })),
};
