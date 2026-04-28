import { miniTokenize } from './_localMiniLlm.js';

const RADICE = 'ikigai:memoria';
const LIMITE_TESTO = 900;
const LIMITE_TERMINI = 32;
const LIMITE_EVOCAZIONI = 5;
const PESO_DECORRENZA = 0.000001;

function purificaTesto(valore, massimo = LIMITE_TESTO) {
  return String(valore || '')
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- sanitizzazione: rimuove caratteri di controllo
    .replace(/[\x00-\x1F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, massimo);
}

function terminiSemantici(testo) {
  return [...new Set(miniTokenize(purificaTesto(testo, 1600))
    .map(t => t.toLowerCase())
    .filter(t => t.length >= 3 && t.length <= 32 && !/^\d+$/.test(t)))].slice(0, LIMITE_TERMINI);
}

function idMemoria(ambito, testo, istante = Date.now()) {
  const base = `${ambito}:${testo}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 72);
  return `${base || 'memoria'}-${istante.toString(36)}`;
}

function chiaveMemoria(id) { return `${RADICE}:fatto:${id}`; }
function chiaveTermine(termine) { return `${RADICE}:termine:${termine}`; }
function chiaveAmbito(ambito) { return `${RADICE}:ambito:${ambito}`; }

export async function memorizzaFatto(redis, { ambito = 'generale', titolo = '', testo = '', fonte = 'sistema', peso = 1, meta = {} } = {}) {
  if (!redis) return { salvato: false, motivo: 'redis_mancante' };
  const testoPulito = purificaTesto(testo || titolo);
  if (!testoPulito || testoPulito.length < 8) return { salvato: false, motivo: 'testo_troppo_corto' };

  const ora = Date.now();
  const ambitoPulito = purificaTesto(ambito, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'generale';
  const titoloPulito = purificaTesto(titolo || testoPulito.split(/[.!?]/)[0], 120);
  const termini = terminiSemantici(`${titoloPulito} ${testoPulito}`);
  const id = idMemoria(ambitoPulito, titoloPulito, ora);
  const memoria = {
    id,
    ambito: ambitoPulito,
    titolo: titoloPulito,
    testo: testoPulito,
    fonte: purificaTesto(fonte, 50),
    termini,
    peso: Number.isFinite(Number(peso)) ? Math.max(0.1, Math.min(5, Number(peso))) : 1,
    meta,
    creataIl: ora,
    aggiornataIl: ora,
  };

  const operazioni = [
    redis.hset(chiaveMemoria(id), memoria),
    redis.zadd(`${RADICE}:recenti`, { score: ora, member: id }),
    redis.zadd(chiaveAmbito(ambitoPulito), { score: ora, member: id }),
    redis.hincrby(`${RADICE}:statistiche`, 'fatti', 1),
    redis.hset(`${RADICE}:statistiche`, { aggiornataIl: ora }),
  ];
  for (const termine of termini) {
    operazioni.push(redis.zadd(chiaveTermine(termine), { score: memoria.peso + ora * PESO_DECORRENZA, member: id }));
  }
  await Promise.allSettled(operazioni);
  return { salvato: true, id, termini };
}

export async function radicaDomanda(redis, { domanda = '', intento = 'generale', risposta = '' } = {}) {
  const domandaPulita = purificaTesto(domanda, 360);
  if (!domandaPulita || !redis) return { salvato: false };
  return memorizzaFatto(redis, {
    ambito: `domande-${intento || 'generale'}`,
    titolo: domandaPulita,
    testo: risposta ? `Domanda frequente: ${domandaPulita}. Risposta utile: ${purificaTesto(risposta, 420)}` : `Domanda frequente: ${domandaPulita}`,
    fonte: 'ikigai-domande',
    peso: 0.8,
    meta: { intento },
  });
}

export async function memorizzaFunzione(redis, { nome = '', descrizione = '', percorso = '', categoria = 'funzione' } = {}) {
  return memorizzaFatto(redis, {
    ambito: categoria,
    titolo: nome,
    testo: `${nome}. ${descrizione}${percorso ? ` Percorso: ${percorso}.` : ''}`,
    fonte: 'documentazione-sito',
    peso: 1.4,
    meta: { percorso, categoria },
  });
}

export async function evocaMemorie(redis, { testo = '', ambito = '', limite = LIMITE_EVOCAZIONI } = {}) {
  if (!redis) return [];
  const termini = terminiSemantici(`${ambito} ${testo}`);
  if (!termini.length) return [];

  const punteggi = new Map();
  await Promise.all(termini.map(async (termine) => {
    try {
      const raw = await redis.zrange(chiaveTermine(termine), 0, 12, { rev: true, withScores: true });
      if (!Array.isArray(raw)) return;
      for (let i = 0; i < raw.length; i += 2) {
        const id = raw[i];
        const score = Number(raw[i + 1] || 0);
        punteggi.set(id, (punteggi.get(id) || 0) + score);
      }
    } catch { /* best effort */ }
  }));

  const ids = [...punteggi.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Math.min(12, limite * 3))).map(([id]) => id);
  const memorie = [];
  for (const id of ids) {
    try {
      const m = await redis.hgetall(chiaveMemoria(id));
      if (m && m.id) memorie.push({ id: m.id, ambito: m.ambito, titolo: m.titolo, testo: m.testo, fonte: m.fonte, peso: Number(m.peso || 1), meta: m.meta || {}, creataIl: Number(m.creataIl || 0) });
    } catch { /* ignore */ }
  }
  return memorie.slice(0, limite);
}

export function integraMemorieNelTesto(memorie = []) {
  return memorie.length ? memorie.map(m => `• ${m.titolo}: ${m.testo}`).join('\n').slice(0, 1400) : '';
}

export async function sintesiMemoria(redis) {
  if (!redis) return { disponibile: false };
  try {
    const [statistiche, recenti] = await Promise.all([
      redis.hgetall(`${RADICE}:statistiche`),
      redis.zrange(`${RADICE}:recenti`, 0, 10, { rev: true }),
    ]);
    return { disponibile: true, statistiche: statistiche || {}, recenti: recenti || [] };
  } catch {
    return { disponibile: false };
  }
}

export async function seminaMemorieBase(redis) {
  if (!redis) return { seminato: false };
  const gia = await redis.hget(`${RADICE}:statistiche`, 'seminaBase');
  if (gia) return { seminato: false, motivo: 'gia_presente' };
  const funzioni = [
    ['SOCIALify', 'Feed community con post, risposte, tag smart, preferiti, media e interazioni.', '/socialify', 'socialify'],
    ['Classifiche XP', 'Classifiche mensili e generali basate su post, risposte, like e qualità dei contenuti.', '/socialify', 'classifiche'],
    ['Tag intelligenti', 'Tag liberi validati, indicizzati e usati per tendenze e macroCategorie.', '/socialify/info-tag', 'tag'],
    ['Notifiche avanzate', 'Preferenze per push, in-app, suoni, vibrazione, anteprime, categorie e ore silenziose.', '/impostazioni', 'notifiche'],
    ['Profilo utente', 'Pagina pubblica con informazioni, contenuti e attività utente.', '/profilo/:username', 'profilo'],
    ['Amici e privacy', 'Relazioni di amicizia e visibilità pubblica o solo amici.', '/amici', 'privacy'],
  ];
  for (const [nome, descrizione, percorso, categoria] of funzioni) {
    await memorizzaFunzione(redis, { nome, descrizione, percorso, categoria });
  }
  await redis.hset(`${RADICE}:statistiche`, { seminaBase: Date.now() });
  return { seminato: true, totale: funzioni.length };
}
