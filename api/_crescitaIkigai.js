import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const MAX_EVENTI = 120;
const MAX_NODI = 80;

function pulisci(value = '', max = 800) {
  return String(value || '')
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- sanitizzazione: rimuove caratteri di controllo
    .replace(/[\x00-\x1F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .slice(0, max);
}

function tokens(text = '') {
  return pulisci(text, 1000)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9#_]+/i)
    .filter(t => t.length >= 3)
    .slice(0, 24);
}

function tonoDaDomanda(q = '') {
  const testo = pulisci(q).toLowerCase();
  if (/[?!]{2,}|\b(figo|wow|assurdo|top|bello|cool)\b/i.test(testo)) return 'energico';
  if (/\b(non capisco|aiuto|problema|bug|rotto|errore|help|ayuda)\b/i.test(testo)) return 'pratico';
  if (/\b(grazie|perfetto|bello|ottimo|thanks|gracias)\b/i.test(testo)) return 'caldo';
  return 'naturale';
}

function creaEvento({ domanda, intent, lingua, pagina, routes = [], worldAware = false } = {}) {
  return {
    ts: Date.now(),
    intent: pulisci(intent, 80) || 'unknown',
    lingua: normalizzaLinguaIkigai(lingua),
    pagina: pulisci(pagina?.pathname || pagina?.path || '', 140),
    tokens: tokens(domanda),
    tono: tonoDaDomanda(domanda),
    routes: routes.map(r => r.path || r.href).filter(Boolean).slice(0, 4),
    worldAware: !!worldAware,
  };
}

function scoreMap(items = [], key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, valore]) => ({ nome, valore }));
}

export async function registraCrescitaIkigai(redis, idCustodia, eventoInput = {}) {
  if (!redis || !idCustodia) return null;
  const key = `ikigai:growth:${idCustodia}`;
  const evento = creaEvento(eventoInput);
  try {
    await redis.lpush(key, JSON.stringify(evento));
    await redis.ltrim(key, 0, MAX_EVENTI - 1);
    await redis.expire(key, 60 * 60 * 24 * 180);
    for (const token of evento.tokens.slice(0, 8)) {
      await redis.zincrby(`ikigai:growth:nodes:${idCustodia}`, 1, token).catch(() => {});
    }
    await redis.zremrangebyrank(`ikigai:growth:nodes:${idCustodia}`, 0, -MAX_NODI - 1).catch(() => {});
    await redis.expire(`ikigai:growth:nodes:${idCustodia}`, 60 * 60 * 24 * 180).catch(() => {});
  } catch { /* best-effort */ }
  return evento;
}

export async function profiloCrescitaIkigai(redis, idCustodia) {
  if (!redis || !idCustodia) return { livello: 0, tono: 'naturale', interessi: [], pagine: [], intenti: [] };
  try {
    const raw = await redis.lrange(`ikigai:growth:${idCustodia}`, 0, MAX_EVENTI - 1);
    const eventi = (raw || []).map(x => {
      try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; }
    }).filter(Boolean);
    const nodiRaw = await redis.zrange(`ikigai:growth:nodes:${idCustodia}`, 0, 12, { rev: true, withScores: true }).catch(() => []);
    const nodi = [];
    for (let i = 0; i < (nodiRaw || []).length; i += 2) nodi.push({ nome: nodiRaw[i], valore: Number(nodiRaw[i + 1] || 0) });

    const livello = Math.min(12, Math.floor(Math.sqrt(eventi.length)));
    const intenti = scoreMap(eventi, e => e.intent);
    const pagine = scoreMap(eventi, e => e.pagina).filter(x => x.nome);
    const toni = scoreMap(eventi, e => e.tono);
    const tono = toni[0]?.nome || 'naturale';
    const worldAwareRatio = eventi.length ? eventi.filter(e => e.worldAware).length / eventi.length : 0;

    return {
      livello,
      esperienza: eventi.length,
      tono,
      interessi: nodi.slice(0, 8),
      pagine,
      intenti,
      worldAwareRatio: Number(worldAwareRatio.toFixed(2)),
      quasiPersona: true,
      descrizione: 'Ikigai cresce usando segnali minimizzati e cancellabili: intenti, pagine, termini generici e tono conversazionale.',
    };
  } catch {
    return { livello: 0, tono: 'naturale', interessi: [], pagine: [], intenti: [] };
  }
}

export function innestaCrescitaNellaRisposta(answer = '', crescita = {}, lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  if (!crescita?.livello || crescita.livello < 3) return answer;
  const prefix = {
    it: crescita.tono === 'pratico' ? 'Te la rendo semplice: ' : crescita.tono === 'energico' ? 'Ci sta, guarda qui: ' : '',
    en: crescita.tono === 'pratico' ? 'Let me make it simple: ' : crescita.tono === 'energico' ? 'Nice, look here: ' : '',
    es: crescita.tono === 'pratico' ? 'Te lo dejo simple: ' : crescita.tono === 'energico' ? 'Bien, mira esto: ' : '',
  }[lang] || '';
  if (!prefix || answer.startsWith(prefix)) return answer;
  return `${prefix}${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
}
