import { readFile } from 'fs/promises';
import path from 'path';
import { Redis } from '@upstash/redis';
import { getLevel } from './social-leaderboard.js';
import { miniTokenize } from './_localMiniLlm.js';
import {
  evocaMemorie,
  radicaDomanda,
  seminaMemorieBase,
  sintesiMemoria,
} from './_memoriaSemanticaIkigai.js';
import {
  identificaCustodia,
  leggiProfiloIkigai,
  registraUsoIkigai,
  orientamentoIkigai,
} from './_custodiaIkigai.js';

const KNOWLEDGE_PATH = path.join(process.cwd(), 'docs', 'ikigai-knowledge.md');
const MAX_QUESTION = 700;
const MAX_HISTORY = 6;
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
  { id: 'tags', peso: 1.22, terms: ['tag', 'tags', 'hashtag', '#', 'categorie smart', 'macrocategorie', 'macro categorie', 'trend', 'tendenze', 'a cosa servono i tag', 'servono i tag', 'ricerca contenuti', 'scoprire contenuti'] },
  { id: 'leaderboard', peso: 1.15, terms: ['classifica', 'classifiche', 'xp', 'livello', 'livelli', 'premi', 'premio', 'salire in classifica', 'punti', 'ranking', 'vip settimanale', 'campione mensile'] },
  { id: 'notifications', peso: 1.12, terms: ['notifiche', 'notifica', 'push', 'suoni', 'vibrazione', 'ore silenziose', 'menzioni', 'avvisi'] },
  { id: 'socialify', peso: 1.0, terms: ['socialify', 'post', 'feed', 'community', 'risposte', 'thread', 'pubblicare', 'preferiti', 'like', 'commenti'] },
  { id: 'account', peso: 1.0, terms: ['login', 'twitch', 'account', 'profilo', 'logout', 'accesso'] },
  { id: 'privacy', peso: 1.0, terms: ['privacy', 'solo amici', 'visibilità', 'privato', 'friends-only', 'dati'] },
  { id: 'games', peso: 1.0, terms: ['giochi', 'gioco', 'gaming', 'giocare'] },
  { id: 'overview', peso: 1.0, terms: ['cosa posso fare', 'cosa fa', 'funzioni', 'sito', 'aiuto', 'help', 'iniziare', 'come funziona'] },
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

function punteggiaIntento(testo, intent) {
  const q = clean(testo).toLowerCase();
  const tokens = new Set(tokenize(q));
  let score = 0;
  for (const term of intent.terms) {
    const norm = term.toLowerCase();
    if (q.includes(norm)) score += norm.includes(' ') ? 8 : 4;
    for (const token of tokenize(norm)) if (tokens.has(token)) score += 1.1;
  }
  return score * (intent.peso || 1);
}

function detectIntent(domandaAttuale, cronologia = [], contestoPagina = {}) {
  const attuale = clean(domandaAttuale).toLowerCase();
  if (/\btag\b|\btags\b|hashtag|macro\s?categorie|categorie smart|tendenz/.test(attuale)) return 'tags';
  if (/classific|\bxp\b|livell|premi|premio|ranking|vip|campione/.test(attuale)) return 'leaderboard';
  if (/notific|push|vibraz|suon|menzion|ore silenziose|avvisi/.test(attuale)) return 'notifications';
  if (/privacy|solo amici|visibilit|privat|dati/.test(attuale)) return 'privacy';
  if (/login|logout|twitch|account|profilo/.test(attuale)) return 'account';
  if (/giochi|gioco|gaming|giocare/.test(attuale)) return 'games';
  if (/socialify|post|feed|rispost|thread|preferit|like|comment/.test(attuale)) return 'socialify';

  const pagina = clean(contestoPagina?.pathname || contestoPagina?.path || '', 120).toLowerCase();
  const pesoPagina = pagina.includes('socialify') ? ' socialify tag community post ' : '';
  const testoCorrente = `${attuale} ${pesoPagina}`;
  const testoStorico = Array.isArray(cronologia) ? cronologia.slice(-MAX_HISTORY).join(' ') : '';
  const scored = INTENTS.map(intent => ({
    id: intent.id,
    score: punteggiaIntento(testoCorrente, intent) + punteggiaIntento(testoStorico, intent) * 0.18,
  })).sort((a, b) => b.score - a.score);
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

function routeMatches(question, intent, orientamento = {}) {
  const q = clean(question).toLowerCase();
  const tokens = new Set(tokenize(`${q} ${intent} ${(orientamento.topPagine || []).join(' ')}`));
  return ROUTES.map(route => {
    let score = 0;
    for (const term of route.terms) {
      if (q.includes(term)) score += 3;
      for (const token of tokenize(term)) if (tokens.has(token)) score += 1;
    }
    if (intent === 'tags' && route.path.includes('info-tag')) score += 5;
    if (intent === 'leaderboard' && route.path === '/socialify') score += 4;
    if (intent === 'notifications' && route.path === '/impostazioni') score += 5;
    if ((orientamento.topPagine || []).some(p => route.path !== '/' && p.startsWith(route.path))) score += 1.5;
    return { path: route.path, label: route.label, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

async function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

function listaZset(raw = [], limite = 4) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length; i += 2) out.push({ nome: raw[i], valore: Number(raw[i + 1] || 0) });
  return out.slice(0, limite);
}

async function liveContext(intent) {
  const redis = await getRedis();
  if (!redis) return { available: false };
  try {
    if (intent === 'leaderboard') {
      const season = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      const [monthly, general] = await Promise.all([
        redis.zrange(`social:lb:${season}`, 0, 4, { rev: true, withScores: true }),
        redis.zrange('social:lb:general', 0, 4, { rev: true, withScores: true }),
      ]);
      return { available: true, monthly: listaZset(monthly), general: listaZset(general), sampleLevel: getLevel(150) };
    }
    if (['tags', 'socialify', 'overview'].includes(intent)) {
      const [popular, trending] = await Promise.all([
        redis.zrange('tags:popular', 0, 7, { rev: true, withScores: true }),
        redis.zrange('tags:trending', 0, 7, { rev: true, withScores: true }),
      ]);
      return { available: true, popular: listaZset(popular, 6), trending: listaZset(trending, 6) };
    }
  } catch { return { available: false }; }
  return { available: true };
}

function routesText(routes) {
  return routes.length ? '\n\nTi lascio i collegamenti utili qui sotto.' : '';
}

function tagsLiveText(live, orientamento) {
  const trend = live?.trending?.map(x => `#${x.nome}`).join(', ');
  const interessi = orientamento?.topInteressi?.slice(0, 3).map(x => `#${x}`).join(', ');
  if (trend && interessi) return ` In questo momento vedo muoversi soprattutto ${trend}; per te terrei d’occhio anche ${interessi}.`;
  if (trend) return ` In questo momento vedo muoversi soprattutto ${trend}.`;
  if (interessi) return ` Per come la stai usando, partirei da ${interessi}.`;
  return '';
}

function classificaLiveText(live) {
  const top = live?.monthly?.[0];
  if (top?.nome) return ` Al momento il primo mensile risulta ${top.nome} con ${top.valore} XP.`;
  return '';
}

function tonoFinale(testo, orientamento = {}) {
  if (orientamento.profondita === 'breve') return testo.split('\n\n').slice(0, 2).join('\n\n');
  return testo;
}

function answerByIntent(intent, routes, live, contestoPagina = {}, orientamento = {}) {
  const rt = routesText(routes);
  const pagina = clean(contestoPagina?.pathname || '', 80);
  let risposta;

  if (intent === 'tags') {
    risposta = `Sì: i tag sono il modo più comodo per far capire al sito “di cosa parla” un post. Non sono solo etichette: servono per cercare contenuti, creare tendenze, collegare post simili e far nascere macroCategorie quando la community usa spesso gli stessi argomenti insieme.${tagsLiveText(live, orientamento)}\n\nEsempio pratico: se molti post usano #zelda, #nintendo e #ocarinaoftime, Ikigai può capire che lì sta nascendo un’area gaming specifica e suggerirti contenuti simili.${rt}`;
  } else if (intent === 'leaderboard') {
    risposta = `La classifica funziona a XP: guadagni punti partecipando bene, non spammando. Post utili, risposte, like ricevuti/dati e tag che diventano popolari aiutano a salire; se ripeti troppe azioni uguali, il rendimento cala.${classificaLiveText(live)}\n\nI premi tipo VIP settimanale o campione mensile hanno senso proprio lì: premiare chi tiene viva la community.${rt}`;
  } else if (intent === 'notifications') {
    risposta = `Le notifiche le gestisci dalle Impostazioni. Puoi separare push e notifiche in-app, scegliere suoni/vibrazione, anteprime, ore silenziose e categorie come messaggi, risposte, menzioni, amici, community, live e sistema.\n\nIn pratica: puoi farle diventare tranquille o super presenti, senza subire tutto insieme.${rt}`;
  } else if (intent === 'socialify') {
    risposta = `SOCIALify è la piazza del sito: feed, post, risposte, like, preferiti, allegati, menzioni e tag. Se sei loggato con Twitch puoi partecipare davvero; se non lo sei puoi comunque esplorare ciò che è pubblico.\n\nDa lì passano anche classifiche, tendenze e macroCategorie.${rt}`;
  } else if (intent === 'privacy') {
    risposta = `La privacy qui ruota attorno a profilo, amici e visibilità dei post. Puoi avere contenuti pubblici o solo amici; le impostazioni servono per decidere quanto vuoi esporti e quali dati/preferenze gestire.${rt}`;
  } else if (intent === 'account') {
    risposta = `L’account passa da Twitch. Con il login sblocchi post, risposte, like, preferiti, amici, messaggi, profilo, classifiche XP e notifiche personalizzate.${rt}`;
  } else if (intent === 'games') {
    risposta = `La sezione Giochi raccoglie la parte interattiva. Se invece vuoi parlare di gaming con la community, SOCIALify usa categorie e tag dedicati per far emergere giochi, discussioni e trend.${rt}`;
  } else {
    risposta = `Puoi usare ANDRYXify come hub personale/community: SOCIALify per post e discussioni, classifiche e premi per la parte competitiva, tag per trovare contenuti, giochi per la parte interattiva, profilo/messaggi/amici per la parte social e impostazioni per personalizzare tutto.${pagina ? ` Ora sei su ${pagina}, quindi posso anche orientarti rispetto a questa pagina.` : ''}${rt}`;
  }
  return tonoFinale(risposta, orientamento);
}

function rispostaDaMemorizzare(intent) {
  const map = {
    tags: 'I tag aiutano ricerca, tendenze, collegamento tra post simili e macroCategorie della community.',
    leaderboard: 'Classifiche e premi usano XP da partecipazione utile: post, risposte, like e tag popolari, con anti-spam.',
    notifications: 'Le notifiche si personalizzano dalle impostazioni: push, in-app, suoni, vibrazione, anteprime, categorie e ore silenziose.',
    socialify: 'SOCIALify è il feed community con post, risposte, like, preferiti, allegati, menzioni e tag.',
  };
  return map[intent] || 'Ikigai orienta l’utente tra funzioni, pagine e impostazioni del sito.';
}

export async function interpellaIkigai({ domanda, question, cronologia = [], history = [], contestoPagina = {}, pageContext = {}, req = null, corpo = {} } = {}) {
  const q = clean(domanda || question);
  if (!q) return { ok: true, name: 'Ikigai', intent: 'welcome', answer: 'Eccomi. Chiedimi pure cosa puoi fare qui, come funzionano tag, classifiche, premi, notifiche o SOCIALify.', routes: [{ label: 'SOCIALify', path: '/socialify' }, { label: 'Impostazioni', path: '/impostazioni' }] };

  const fonteCronologia = Array.isArray(cronologia) && cronologia.length ? cronologia : history;
  const safeHistory = Array.isArray(fonteCronologia) ? fonteCronologia.slice(-MAX_HISTORY).map(x => clean(x, 240)) : [];
  const pagina = Object.keys(contestoPagina || {}).length ? contestoPagina : pageContext;
  const redis = await getRedis();
  if (redis) await seminaMemorieBase(redis).catch(() => {});

  const identita = identificaCustodia(req, corpo);
  const profilo = redis ? await leggiProfiloIkigai(redis, identita.idCustodia, identita.tipo).catch(() => null) : null;
  const orientamento = profilo && !profilo.optOut ? orientamentoIkigai(profilo) : {};

  const intent = detectIntent(q, safeHistory, pagina);
  const sections = await retrieve(q, intent);
  const routes = routeMatches(q, intent, orientamento);
  const live = await liveContext(intent);
  const memorie = redis ? await evocaMemorie(redis, { testo: `${q} ${sections.map(s => s.title).join(' ')}`, ambito: intent }).catch(() => []) : [];
  const answer = answerByIntent(intent, routes, live, pagina, orientamento);

  if (redis) {
    redis.zincrby('ikigai:intenti', 1, intent).catch(() => {});
    redis.zincrby('ikigai:intents', 1, intent).catch(() => {});
    redis.lpush('ikigai:domande:recenti', JSON.stringify({ q, intent, pagina: pagina?.pathname || '', ts: Date.now() })).catch(() => {});
    redis.ltrim('ikigai:domande:recenti', 0, 99).catch(() => {});
    radicaDomanda(redis, { domanda: q, intento: intent, risposta: rispostaDaMemorizzare(intent) }).catch(() => {});
    registraUsoIkigai(redis, identita.idCustodia, {
      tipo: identita.tipo,
      intent,
      pagina: pagina?.pathname || '',
      domanda: q,
      termini: tokenize(q).filter(t => t.length > 3).slice(0, 10),
    }).catch(() => {});
  }

  return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-local-helper', externalApis: false, intent, answer, routes: routes.map(({ label, path }) => ({ label, path, href: path })), sources: sections.map(s => s.title), memories: memorie.map(m => m.titolo), adaptive: !!(profilo && !profilo.optOut), liveAvailable: !!live?.available };
}

export async function statoIkigai() {
  const sections = await getSections();
  const redis = await getRedis();
  let stats = null;
  let memoria = null;
  if (redis) {
    try {
      await seminaMemorieBase(redis).catch(() => {});
      const [intents, recent] = await Promise.all([
        redis.zrange('ikigai:intenti', 0, 10, { rev: true, withScores: true }),
        redis.lrange('ikigai:domande:recenti', 0, 5),
      ]);
      stats = { intents, recent };
      memoria = await sintesiMemoria(redis);
    } catch { stats = null; }
  }
  return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-local-helper', externalApis: false, knowledgeSections: sections.map(s => s.title), stats, memoria };
}

export const askIkigai = interpellaIkigai;
export const ikigaiStatus = statoIkigai;
