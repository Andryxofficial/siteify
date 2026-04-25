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
import {
  benvenutoIkigai,
  localizzaRotte,
  normalizzaLinguaIkigai,
  rilevaConversazioneIkigai,
  rispostaConversazionaleIkigai,
  rispostaNaturaleIkigai,
} from './_linguaNaturalisIkigai.js';
import {
  pensaIkigai,
  rifinisciRispostaIkigai,
  tracciaCognitivaIkigai,
} from './_metacoscienzaIkigai.js';

const KNOWLEDGE_PATH = path.join(process.cwd(), 'docs', 'ikigai-knowledge.md');
const MAX_QUESTION = 700;
const MAX_HISTORY = 6;
let knowledgeCache = null;
let sectionsCache = null;

const ROUTES = [
  { path: '/', label: 'Home', terms: ['home', 'inicio', 'inizio', 'panoramica', 'overview'] },
  { path: '/socialify', label: 'SOCIALify', terms: ['socialify', 'community', 'comunidad', 'feed', 'post', 'risposte', 'replies', 'respuestas', 'tag', 'tags', 'trend', 'tendencias', 'macrocategorie', 'macro-categories'] },
  { path: '/socialify/info-tag', label: 'Info tag', terms: ['tag', 'tags', 'hashtag', 'categorie', 'categories', 'categorias', 'categorías', 'macrocategorie', 'macro-categories', 'tendenze', 'trends', 'tendencias'] },
  { path: '/gioco', label: 'Giochi', terms: ['giochi', 'juegos', 'games', 'game', 'gaming', 'gioca', 'play', 'jugar'] },
  { path: '/chat', label: 'Chat', terms: ['chat', 'conversazione', 'conversation', 'conversacion', 'conversación'] },
  { path: '/messaggi', label: 'Messaggi', terms: ['messaggi', 'messages', 'mensajes', 'dm', 'privati', 'private'] },
  { path: '/amici', label: 'Amici', terms: ['amici', 'friends', 'amigos', 'amicizia'] },
  { path: '/impostazioni', label: 'Impostazioni', terms: ['impostazioni', 'settings', 'ajustes', 'notifiche', 'notifications', 'notificaciones', 'privacy', 'privacidad', 'tema', 'theme', 'lingua', 'language', 'idioma', 'account', 'dati', 'data', 'datos'] },
  { path: '/privacy', label: 'Privacy', terms: ['privacy', 'privacidad', 'sicurezza', 'security', 'seguridad', 'dati', 'data', 'datos', 'ikigai'] },
  { path: '/twitch', label: 'Twitch', terms: ['twitch', 'stream', 'live', 'diretta', 'directo'] },
  { path: '/profilo', label: 'Profilo', terms: ['profilo', 'profile', 'perfil', 'utente', 'user', 'usuario', 'avatar', 'bio'] },
];

const INTENTS = [
  { id: 'tags', peso: 1.22, terms: ['tag', 'tags', 'hashtag', '#', 'categorie smart', 'smart categories', 'categorias inteligentes', 'categorías inteligentes', 'macrocategorie', 'macro categorie', 'macro-categories', 'trend', 'trends', 'tendenze', 'tendencias', 'a cosa servono i tag', 'what are tags for', 'para que sirven las etiquetas', 'para qué sirven las etiquetas', 'servono i tag', 'ricerca contenuti', 'find content', 'buscar contenido', 'scoprire contenuti'] },
  { id: 'leaderboard', peso: 1.15, terms: ['classifica', 'classifiche', 'ranking', 'rankings', 'leaderboard', 'clasificacion', 'clasificación', 'xp', 'livello', 'livelli', 'level', 'levels', 'nivel', 'niveles', 'premi', 'premio', 'rewards', 'reward', 'premios', 'premio', 'salire in classifica', 'climb the ranking', 'subir en la clasificacion', 'punti', 'points', 'puntos', 'vip settimanale', 'weekly vip', 'campione mensile', 'monthly champion'] },
  { id: 'notifications', peso: 1.12, terms: ['notifiche', 'notifica', 'notifications', 'notification', 'notificaciones', 'notificacion', 'notificación', 'push', 'suoni', 'sounds', 'sonidos', 'vibrazione', 'vibration', 'vibracion', 'vibración', 'ore silenziose', 'quiet hours', 'horas silenciosas', 'menzioni', 'mentions', 'menciones', 'avvisi', 'alerts', 'avisos'] },
  { id: 'socialify', peso: 1.0, terms: ['socialify', 'post', 'feed', 'community', 'comunidad', 'risposte', 'replies', 'respuestas', 'thread', 'pubblicare', 'publish', 'publicar', 'preferiti', 'favorites', 'favoritos', 'like', 'likes', 'commenti', 'comments', 'comentarios'] },
  { id: 'account', peso: 1.0, terms: ['login', 'logout', 'twitch', 'account', 'profilo', 'profile', 'perfil', 'accesso', 'sign in', 'iniciar sesion', 'iniciar sesión'] },
  { id: 'privacy', peso: 1.0, terms: ['privacy', 'privacidad', 'sicurezza', 'security', 'seguridad', 'solo amici', 'friends only', 'solo amigos', 'visibilità', 'visibility', 'visibilidad', 'privato', 'private', 'privado', 'friends-only', 'dati', 'data', 'datos', 'chat private', 'private chats', 'chats privados'] },
  { id: 'games', peso: 1.0, terms: ['giochi', 'gioco', 'gaming', 'giocare', 'games', 'game', 'play', 'juegos', 'juego', 'jugar'] },
  { id: 'overview', peso: 1.0, terms: ['cosa posso fare', 'what can i do', 'que puedo hacer', 'qué puedo hacer', 'cosa fa', 'what does it do', 'que hace', 'qué hace', 'funzioni', 'features', 'funciones', 'sito', 'site', 'sitio', 'aiuto', 'help', 'ayuda', 'iniziare', 'start', 'empezar', 'come funziona', 'how does it work', 'como funciona', 'cómo funciona'] },
];

function clean(value, max = MAX_QUESTION) { return String(value || '').normalize('NFKC').replace(/[\x00-\x1F]/g, ' ').replace(/<[^>]*>/g, ' ').trim().slice(0, max); }
function tokenize(text) { return miniTokenize(clean(text, 1400)).map(t => t.toLowerCase()); }
async function loadKnowledge() { if (knowledgeCache) return knowledgeCache; try { knowledgeCache = await readFile(KNOWLEDGE_PATH, 'utf8'); } catch { knowledgeCache = '# Ikigai\nHelper interno ANDRYXify.'; } return knowledgeCache; }
async function getSections() { if (sectionsCache) return sectionsCache; const md = await loadKnowledge(); sectionsCache = md.split(/\n##\s+/g).map(raw => { const trimmed = raw.trim(); if (!trimmed) return null; const [first, ...rest] = trimmed.split('\n'); const title = first.replace(/^#\s*/, '').trim(); const body = rest.join('\n').trim() || title; return { title, body, tokens: tokenize(`${title} ${body}`) }; }).filter(Boolean); return sectionsCache; }
function punteggiaIntento(testo, intent) { const q = clean(testo).toLowerCase(); const tokens = new Set(tokenize(q)); let score = 0; for (const term of intent.terms) { const norm = term.toLowerCase(); if (q.includes(norm)) score += norm.includes(' ') ? 8 : 4; for (const token of tokenize(norm)) if (tokens.has(token)) score += 1.1; } return score * (intent.peso || 1); }
function detectIntent(domandaAttuale, cronologia = [], contestoPagina = {}) { const attuale = clean(domandaAttuale).toLowerCase(); if (/\btag\b|\btags\b|hashtag|macro\s?categorie|macro-categories|smart categories|categor[ií]as inteligentes|tendenz|trend|tendencias/.test(attuale)) return 'tags'; if (/classific|leaderboard|ranking|\bxp\b|livell|level|nivel|premi|premio|reward|premios|ranking|vip|campione|champion|campe[oó]n/.test(attuale)) return 'leaderboard'; if (/notific|notification|push|vibraz|vibration|vibraci[oó]n|suon|sound|sonido|menzion|mention|menci[oó]n|ore silenziose|quiet hours|horas silenciosas|avvisi|alerts/.test(attuale)) return 'notifications'; if (/privacy|privacidad|sicurezza|security|seguridad|solo amici|friends only|solo amigos|visibilit|visibility|visibilidad|privat|private|privado|dati|data|datos|chat private|private chats|chats privados/.test(attuale)) return 'privacy'; if (/login|logout|twitch|account|profilo|profile|perfil|accesso|sign in|iniciar sesi[oó]n/.test(attuale)) return 'account'; if (/giochi|gioco|gaming|giocare|games|game|play|juegos|jugar/.test(attuale)) return 'games'; if (/socialify|post|feed|rispost|reply|respuest|thread|preferit|favorite|favorit|like|comment/.test(attuale)) return 'socialify'; const pagina = clean(contestoPagina?.pathname || contestoPagina?.path || '', 120).toLowerCase(); const pesoPagina = pagina.includes('socialify') ? ' socialify tag community post ' : ''; const testoCorrente = `${attuale} ${pesoPagina}`; const testoStorico = Array.isArray(cronologia) ? cronologia.slice(-MAX_HISTORY).join(' ') : ''; const scored = INTENTS.map(intent => ({ id: intent.id, score: punteggiaIntento(testoCorrente, intent) + punteggiaIntento(testoStorico, intent) * 0.18 })).sort((a, b) => b.score - a.score); return scored[0]?.score > 0 ? scored[0].id : 'overview'; }
async function retrieve(question, intent, limit = 4) { const sections = await getSections(); const qTokens = new Set(tokenize(`${question} ${intent}`)); return sections.map(section => { let score = 0; for (const token of section.tokens) if (qTokens.has(token)) score += 1; if (section.title.toLowerCase().includes(intent)) score += 3; return { ...section, score }; }).sort((a, b) => b.score - a.score).slice(0, limit); }
function routeMatches(question, intent, orientamento = {}) { const q = clean(question).toLowerCase(); const tokens = new Set(tokenize(`${q} ${intent} ${(orientamento.topPagine || []).join(' ')}`)); return ROUTES.map(route => { let score = 0; for (const term of route.terms) { if (q.includes(term)) score += 3; for (const token of tokenize(term)) if (tokens.has(token)) score += 1; } if (intent === 'tags' && route.path.includes('info-tag')) score += 5; if (intent === 'leaderboard' && route.path === '/socialify') score += 4; if (intent === 'notifications' && route.path === '/impostazioni') score += 5; if (intent === 'privacy' && route.path === '/privacy') score += 5; if ((orientamento.topPagine || []).some(p => route.path !== '/' && p.startsWith(route.path))) score += 1.5; return { path: route.path, label: route.label, score }; }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3); }
async function getRedis() { if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null; return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }); }
function listaZset(raw = [], limite = 4) { if (!Array.isArray(raw)) return []; const out = []; for (let i = 0; i < raw.length; i += 2) out.push({ nome: raw[i], valore: Number(raw[i + 1] || 0) }); return out.slice(0, limite); }
async function liveContext(intent) { const redis = await getRedis(); if (!redis) return { available: false }; try { if (intent === 'leaderboard') { const season = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`; const [monthly, general] = await Promise.all([redis.zrange(`social:lb:${season}`, 0, 4, { rev: true, withScores: true }), redis.zrange('social:lb:general', 0, 4, { rev: true, withScores: true })]); return { available: true, monthly: listaZset(monthly), general: listaZset(general), sampleLevel: getLevel(150) }; } if (['tags', 'socialify', 'overview'].includes(intent)) { const [popular, trending] = await Promise.all([redis.zrange('tags:popular', 0, 7, { rev: true, withScores: true }), redis.zrange('tags:trending', 0, 7, { rev: true, withScores: true })]); return { available: true, popular: listaZset(popular, 6), trending: listaZset(trending, 6) }; } } catch { return { available: false }; } return { available: true }; }
function rispostaDaMemorizzare(intent) { const map = { tags: 'I tag aiutano ricerca, tendenze, collegamento tra post simili e macroCategorie della community.', leaderboard: 'Classifiche e premi usano XP da partecipazione utile: post, risposte, like e tag popolari, con anti-spam.', notifications: 'Le notifiche si personalizzano dalle impostazioni: push, in-app, suoni, vibrazione, anteprime, categorie e ore silenziose.', socialify: 'SOCIALify è il feed community con post, risposte, like, preferiti, allegati, menzioni e tag.', privacy: 'La privacy copre profilo, chat private, notifiche, Ikigai, dati adattivi e cancellazione.' }; return map[intent] || 'Ikigai orienta l’utente tra funzioni, pagine e impostazioni del sito.'; }

export async function interpellaIkigai({ domanda, question, cronologia = [], history = [], contestoPagina = {}, pageContext = {}, req = null, corpo = {} } = {}) {
  const lingua = normalizzaLinguaIkigai(corpo?.lingua || corpo?.language || contestoPagina?.lingua || pageContext?.lingua || req?.headers?.['accept-language']);
  const q = clean(domanda || question);
  if (!q) return { ok: true, name: 'Ikigai', intent: 'welcome', answer: benvenutoIkigai(lingua), routes: localizzaRotte([{ path: '/socialify' }, { path: '/impostazioni' }], lingua) };

  const conversazione = rilevaConversazioneIkigai(q);
  if (conversazione) {
    const answer = rispostaConversazionaleIkigai(conversazione, lingua) || benvenutoIkigai(lingua);
    const routes = conversazione === 'identita' ? localizzaRotte([{ path: '/privacy' }, { path: '/impostazioni' }], lingua) : [];
    const coscienza = tracciaCognitivaIkigai(pensaIkigai({ q, intent: conversazione, lingua, pagina: contestoPagina, sections: [], routes, live: {}, memorie: [], orientamento: {} }));
    return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-cognitive-local-helper', externalApis: false, lingua, intent: conversazione, answer, routes, sources: [], memories: [], adaptive: false, liveAvailable: false, coscienza };
  }

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
  const routesLocalizzate = localizzaRotte(routes, lingua);
  const live = await liveContext(intent);
  const memorie = redis ? await evocaMemorie(redis, { testo: `${q} ${sections.map(s => s.title).join(' ')}`, ambito: intent }).catch(() => []) : [];
  const statoIkigai = pensaIkigai({ q, intent, lingua, pagina, sections, routes: routesLocalizzate, live, memorie, orientamento });
  const baseAnswer = rispostaNaturaleIkigai({ intent, routes: routesLocalizzate, live, contestoPagina: pagina, orientamento, lingua });
  const answer = rifinisciRispostaIkigai(baseAnswer, statoIkigai, routesLocalizzate);
  if (redis) { redis.zincrby('ikigai:intenti', 1, intent).catch(() => {}); redis.zincrby('ikigai:intents', 1, intent).catch(() => {}); redis.lpush('ikigai:domande:recenti', JSON.stringify({ q, intent, lingua, pagina: pagina?.pathname || '', confidenza: statoIkigai.confidenza, umore: statoIkigai.umore, ts: Date.now() })).catch(() => {}); redis.ltrim('ikigai:domande:recenti', 0, 99).catch(() => {}); radicaDomanda(redis, { domanda: q, intento: intent, risposta: rispostaDaMemorizzare(intent) }).catch(() => {}); registraUsoIkigai(redis, identita.idCustodia, { tipo: identita.tipo, intent, pagina: pagina?.pathname || '', domanda: q, termini: tokenize(q).filter(t => t.length > 3).slice(0, 10) }).catch(() => {}); }
  return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-cognitive-local-helper', externalApis: false, lingua, intent, answer, routes: routesLocalizzate, sources: sections.map(s => s.title), memories: memorie.map(m => m.titolo), adaptive: !!(profilo && !profilo.optOut), liveAvailable: !!live?.available, coscienza: tracciaCognitivaIkigai(statoIkigai) };
}

export async function statoIkigai() { const sections = await getSections(); const redis = await getRedis(); let stats = null; let memoria = null; if (redis) { try { await seminaMemorieBase(redis).catch(() => {}); const [intents, recent] = await Promise.all([redis.zrange('ikigai:intenti', 0, 10, { rev: true, withScores: true }), redis.lrange('ikigai:domande:recenti', 0, 5)]); stats = { intents, recent }; memoria = await sintesiMemoria(redis); } catch { stats = null; } } return { ok: true, name: 'Ikigai', engine: 'andryx-ikigai-cognitive-local-helper', externalApis: false, knowledgeSections: sections.map(s => s.title), stats, memoria };
}
export const askIkigai = interpellaIkigai;
export const ikigaiStatus = statoIkigai;
