import { readFile } from 'fs/promises';
import path from 'path';
import { Redis } from '@upstash/redis';
import { getLevel } from './social-leaderboard.js';
import { miniTokenize } from './_localMiniLlm.js';
import {
  evocaMemorie,
  integraMemorieNelTesto,
  radicaDomanda,
  seminaMemorieBase,
  sintesiMemoria,
} from './_memoriaSemanticaIkigai.js';

const KNOWLEDGE_PATH = path.join(process.cwd(), 'docs', 'ikigai-knowledge.md');
const MAX_QUESTION = 700;
const MAX_HISTORY = 8;
let knowledgeCache = null;
let sectionsCache = null;

const ROUTES = [
  { path: '/', label: 'Home', terms: ['home', 'inizio', 'panoramica'] },
  { path: '/socialify', label: 'SOCIALify', terms: ['socialify', 'community', 'feed', 'post', 'risposte', 'tag', 'trend', 'macrocategorie'] },
  { path: '/socialify/info-tag', label: 'Info tag', terms: ['tag', 'hashtag', 'categorie', 'macrocategorie', 'tendenze'] },
  { path: '/gioco', label: 'Giochi', terms: ['giochi', 'game', 'gaming', 'gioca'] },
  { path: '/chat', label: 'Chat', terms: ['chat', 'conversazione'] },
  { path: '/messaggi', label: 'Messaggi', terms: ['messaggi', 'dm', 'privati'] },
  { path: '/amici', label: 'Amici', terms: ['amici', 'amicizia'] },
  { path: '/impostazioni', label: 'Impostazioni', terms: ['impostazioni', 'notifiche', 'privacy', 'tema', 'lingua', 'account', 'dati'] },
  { path: '/twitch', label: 'Twitch', terms: ['twitch', 'stream', 'live', 'diretta'] },
  { path: '/profilo', label: 'Profilo', terms: ['profilo', 'utente', 'avatar', 'bio'] },
];

const INTENTS = [
  { id: 'overview', terms: ['cosa posso fare', 'cosa fa', 'funzioni', 'sito', 'aiuto', 'help', 'iniziare', 'come funziona'] },
  { id: 'socialify', terms: ['socialify', 'post', 'feed', 'community', 'risposte', 'thread', 'pubblicare', 'preferiti'] },
  { id: 'leaderboard', terms: ['classifica', 'classifiche', 'xp', 'livello', 'livelli', 'premi', 'premio', 'salire', 'punti', 'ranking'] },
  { id: 'tags', terms: ['tag', 'hashtag', 'categorie', 'macrocategorie', 'trend', 'tendenze', 'ricerca contenuti', 'scoprire'] },
  { id: 'notifications', terms: ['notifiche', 'push', 'suoni', 'vibrazione', 'ore silenziose', 'menzioni', 'avvisi'] },
  { id: 'account', terms: ['login', 'twitch', 'account', 'profilo', 'logout', 'accesso'] },
  { id: 'privacy', terms: ['privacy', 'solo amici', 'visibilità', 'privato', 'friends-only', 'dati'] },
  { id: 'games', terms: ['giochi', 'gioco', 'gaming', 'giocare'] },
];

function clean(value, max = MAX_QUESTION) {
  return String(value || '').normalize('NFKC').replace(/[\x00-\x1F]/g, ' ').replace(/<[^>]*>/g, ' ').trim().slice(0, max);
}

function tokenize(text) {
  return miniTokenize(clean(text, 1400)).map(t => t.toLowerCase());
}

async function loadKnowledge() {
  if (knowledgeCache) return knowledgeCache;
  try { knowledgeCache = await readFile(KNOWLEDGE_PATH, 'utf8'); }
  catch { knowledgeCache = '# Ikigai\nHelper interno ANDRYXify.'; }
  return knowledgeCache;
}

async function getSections() {
  if (sectionsCache) return sectionsCache;
  const md = await loadKnowledge();
  sectionsCache = md.split(/\n##\s+/g).map(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const [first, ...rest] = trimmed.split('\n');
    const title = first.replace(/^#\s*/, '').trim();
    const body = rest.join('\n').trim() || title;
    return { title, body, tokens: tokenize(`${title} ${body}`) };
  }).filter(Boolean);
  return sectionsCache;
}

function detectIntent(question) {
  const q = clean(question).toLowerCase();
  const tokens = new Set(tokenize(q));
  const scored = INTENTS.map(intent => {
    let score = 0;
    for (const term of intent.terms) {
      const norm = term.toLowerCase();
      if (q.includes(norm)) score += 4;
      for (const token of tokenize(norm)) if (tokens.has(token)) score += 1.2;
    }
    return { id: intent.id, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].id : 'overview';
}

async function retrieve(question, intent, limit = 4) {
  const sections = await getSections();
  const qTokens = new Set(tokenize(`${question} ${intent}`));
  return sections.map(section => {
    let score = 0;
    for (const token of section.tokens) if (qTokens.has(token)) score += 1;
    if (section.title.toLowerCase().includes(intent)) score += 3;
    return { ...section, score };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

function routeMatches(question, intent) {
  const q = clean(question).toLowerCase();
  const tokens = new Set(tokenize(`${q} ${intent}`));
  return ROUTES.map(route => {
    let score = 0;
    for (const term of route.terms) {
      if (q.includes(term)) score += 3;
      for (const token of tokenize(term)) if (tokens.has(token)) score += 1;
    }
    return { path: route.path, label: route.label, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

async function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

async function liveContext(intent) {
  const redis = await getRedis();
  if (!redis) return { available: false };
  try {
    if (intent === 'leaderboard') {
      const season = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      const [monthly, general] = await Promise.all([
        redis.zrange(`social:lb:${season}`, 0, 2, { rev: true, withScores: true }),
        redis.zrange('social:lb:general', 0, 2, { rev: true, withScores: true }),
      ]);
      return { available: true, monthly, general, sampleLevel: getLevel(150) };
    }
    if (['tags', 'socialify', 'overview'].includes(intent)) {
      const [popular, trending] = await Promise.all([
        redis.zrange('tags:popular', 0, 7, { rev: true, withScores: true }),
        redis.zrange('tags:trending', 0, 7, { rev: true, withScores: true }),
      ]);
      return { available: true, popular, trending };
    }
  } catch { return { available: false }; }
  return { available: true };
}

function routesText(routes) {
  return routes.length ? `\n\nPercorsi utili: ${routes.map(r => `${r.label} (${r.path})`).join(', ')}.` : '';
}

function memoryText(memorie) {
  const testo = integraMemorieNelTesto(memorie);
  return testo ? `\n\nMemoria utile:\n${testo}` : '';
}

function answerByIntent(intent, routes, live, memorie = []) {
  const rt = routesText(routes);
  const mt = memoryText(memorie);
  if (intent === 'leaderboard') return `Ikigai ti direbbe di puntare sulla qualità, non sullo spam. La classifica cresce con XP da post, risposte, like dati/ricevuti e milestone dei tag. I livelli vanno da Nuovo Arrivato a Leggenda; ripetere troppe azioni in poco tempo rende meno XP.${live?.available ? ' Posso leggere anche il contesto live delle classifiche quando Redis è disponibile.' : ''}${rt}${mt}`;
  if (intent === 'tags') return `I tag servono a far trovare i contenuti giusti: ogni post può avere tag liberi, il sistema li valida, li indicizza e li usa per tendenze e macroCategorie. Più la community usa tag coerenti, più Ikigai capisce gli interessi reali e può suggerire percorsi migliori.${live?.available ? ' Posso usare anche tag popolari e trend reali.' : ''}${rt}${mt}`;
  if (intent === 'notifications') return `Le notifiche si gestiscono dalle impostazioni: puoi scegliere push, in-app, suoni, vibrazione, anteprime, ore silenziose e categorie come messaggi, risposte, menzioni, amici, community, live e sistema.${rt}${mt}`;
  if (intent === 'socialify') return `Su SOCIALify puoi leggere il feed, pubblicare post, rispondere, usare tag, allegare media, mettere like, salvare preferiti e seguire thread. Alcune azioni richiedono login Twitch.${rt}${mt}`;
  if (intent === 'privacy') return `La privacy gira attorno a login Twitch, profilo, amici e visibilità dei post. Puoi avere contenuti pubblici o solo amici; nelle impostazioni gestisci visibilità, richieste amicizia, dati e preferenze.${rt}${mt}`;
  if (intent === 'account') return `L'account usa Twitch: con il login puoi pubblicare, rispondere, mettere like, salvare preferiti, usare amici/messaggi, partecipare alle classifiche e personalizzare profilo e notifiche.${rt}${mt}`;
  if (intent === 'games') return `La sezione Giochi raccoglie i contenuti interattivi del sito. La trovi dalla tab Giochi; se vuoi restare nella parte community/gaming, SOCIALify usa anche categorie e tag dedicati ai giochi.${rt}${mt}`;
  return `Su ANDRYXify puoi esplorare contenuti di Andryx, usare SOCIALify, seguire Twitch/social, giocare, chattare, gestire profilo, notifiche e impostazioni. La parte più viva è SOCIALify: post, tag, classifiche XP, livelli, premi e macroCategorie evolvono con la community.${rt}${mt}`;
}

export async function interpellaIkigai({ domanda, question, cronologia = [], history = [] } = {}) {
  const q = clean(domanda || question);
  if (!q) return { ok: true, name: 'Ikigai', intent: 'welcome', answer: 'Sono Ikigai. Chiedimi cosa puoi fare sul sito, come funzionano SOCIALify, classifiche, premi, tag, notifiche o profilo.', routes: [{ label: 'SOCIALify', path: '/socialify' }, { label: 'Impostazioni', path: '/impostazioni' }] };
  const fonteCronologia = Array.isArray(cronologia) && cronologia.length ? cronologia : history;
  const safeHistory = Array.isArray(fonteCronologia) ? fonteCronologia.slice(-MAX_HISTORY).map(x => clean(x, 240)) : [];
  const intent = detectIntent(`${safeHistory.join(' ')} ${q}`);
  const sections = await retrieve(q, intent);
  const routes = routeMatches(q, intent);
  const live = await liveContext(intent);
  const redis = await getRedis();
  if (redis) await seminaMemorieBase(redis).catch(() => {});
  const memorie = redis ? await evocaMemorie(redis, { testo: `${q} ${sections.map(s => s.title).join(' ')}`, ambito: intent }).catch(() => []) : [];
  const answer = answerByIntent(intent, routes, live, memorie);
  if (redis) {
    redis.zincrby('ikigai:intents', 1, intent).catch(() => {});
    redis.lpush('ikigai:questions:recent', JSON.stringify({ q, intent, ts: Date.now() })).catch(() => {});
    redis.ltrim('ikigai:questions:recent', 0, 99).catch(() => {});
    radicaDomanda(redis, { domanda: q, intento: intent, risposta: answer }).catch(() => {});
  }
  return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-local-helper', externalApis: false, intent, answer, routes: routes.map(({ label, path }) => ({ label, path })), sources: sections.map(s => s.title), memories: memorie.map(m => m.titolo), liveAvailable: !!live?.available };
}

export async function statoIkigai() {
  const sections = await getSections();
  const redis = await getRedis();
  let stats = null;
  let memoria = null;
  if (redis) {
    try {
      await seminaMemorieBase(redis).catch(() => {});
      const [intents, recent] = await Promise.all([redis.zrange('ikigai:intents', 0, 10, { rev: true, withScores: true }), redis.lrange('ikigai:questions:recent', 0, 5)]);
      stats = { intents, recent };
      memoria = await sintesiMemoria(redis);
    } catch { stats = null; }
  }
  return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-local-helper', externalApis: false, knowledgeSections: sections.map(s => s.title), stats, memoria };
}

export const askIkigai = interpellaIkigai;
export const ikigaiStatus = statoIkigai;
