import { miniTokenize, miniClassify } from './_localMiniLlm.js';
import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const MAX_TESTO = 1800;
const MAX_STILE_TERMINI = 32;

const NODI = [
  { id: 'chiarezza', peso: 1.18, semi: ['chiaro','spiega','capire','semplice','preciso','brief','clear','explain','simple','claro','explica','entender'] },
  { id: 'energia', peso: 1.05, semi: ['figo','forte','wow','bello','spinto','vivo','cool','great','wow','fuerte','vivo'] },
  { id: 'community', peso: 1.08, semi: ['community','socialify','post','feed','risposte','amici','chat','comunidad','friends','reply'] },
  { id: 'gaming', peso: 1.04, semi: ['gaming','gioco','giochi','zelda','nintendo','twitch','live','game','juegos'] },
  { id: 'tecnico', peso: 1.12, semi: ['api','backend','frontend','sicurezza','privacy','codice','deploy','bug','fix','security','code'] },
  { id: 'scrittura', peso: 1.15, semi: ['titolo','testo','scrivere','caption','post','tono','frase','write','style','escribir','texto'] },
  { id: 'prudenza', peso: 1.0, semi: ['privacy','sicuro','sicurezza','dati','privato','safe','security','private','datos'] },
  { id: 'azione', peso: 1.1, semi: ['porta','apri','vai','clicca','fai','crea','open','go','create','haz','abre'] },
];

function pulisci(testo = '', max = MAX_TESTO) {
  return String(testo || '')
    .normalize('NFKC')
    .replace(/[\x00-\x1F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .slice(0, max);
}

function frequenze(tokens = []) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
  return map;
}

function vettore(testo = '') {
  const tokens = miniTokenize(pulisci(testo));
  const freq = frequenze(tokens);
  const out = {};
  for (const nodo of NODI) {
    let score = 0;
    for (const seme of nodo.semi) {
      const s = seme.toLowerCase();
      score += (freq.get(s) || 0) * 2.5;
      for (const token of freq.keys()) {
        if (token.length >= 4 && (token.includes(s) || s.includes(token))) score += 0.55 * freq.get(token);
      }
    }
    out[nodo.id] = Number(Math.min(1, score / 8 * nodo.peso).toFixed(3));
  }
  return out;
}

function mediaLunghezzaFrase(testo = '') {
  const frasi = pulisci(testo).split(/[.!?\n]+/).map(x => x.trim()).filter(Boolean);
  if (!frasi.length) return 0;
  const parole = frasi.map(f => f.split(/\s+/).filter(Boolean).length);
  return Math.round(parole.reduce((a,b) => a + b, 0) / parole.length);
}

function profiloScrittura(testi = [], lingua = 'it') {
  const uniti = testi.map(x => pulisci(x, 900)).join('\n');
  const tokens = miniTokenize(uniti);
  const freq = [...frequenze(tokens).entries()].sort((a,b) => b[1] - a[1]).slice(0, MAX_STILE_TERMINI);
  const esclamazioni = (uniti.match(/!/g) || []).length;
  const domande = (uniti.match(/\?/g) || []).length;
  const lunghezza = mediaLunghezzaFrase(uniti);
  const densitaEmoji = (uniti.match(/\p{Extended_Pictographic}/gu) || []).length;
  return {
    lingua: normalizzaLinguaIkigai(lingua),
    terminiRicorrenti: freq.map(([token, count]) => ({ token, count })),
    fraseMedia: lunghezza,
    energia: Math.min(1, Number(((esclamazioni + densitaEmoji) / 12).toFixed(2))),
    interrogativo: Math.min(1, Number((domande / 10).toFixed(2))),
    compattezza: lunghezza <= 9 ? 'breve' : lunghezza <= 18 ? 'media' : 'lunga',
  };
}

function tonoDaProfilo(profilo) {
  if (!profilo) return 'naturale';
  if (profilo.energia > 0.55 && profilo.compattezza === 'breve') return 'diretto-energico';
  if (profilo.compattezza === 'lunga') return 'ragionato';
  if (profilo.interrogativo > 0.42) return 'guidato';
  return 'naturale';
}

function suggerisciPost({ testo = '', titolo = '', tags = [], lingua = 'it', storico = [] } = {}) {
  const lang = normalizzaLinguaIkigai(lingua);
  const contenuto = pulisci(`${titolo}\n${testo}`);
  const classificazione = miniClassify({ title: titolo, body: testo, tags });
  const profilo = profiloScrittura(storico.length ? storico : [contenuto], lang);
  const tono = tonoDaProfilo(profilo);
  const parole = miniTokenize(contenuto).slice(0, 12);
  const breve = contenuto.length < 80;
  const senzaTag = !Array.isArray(tags) || tags.length === 0;

  const copy = {
    it: {
      ok: 'Il post è già leggibile. Lo renderei solo un filo più chiaro nel punto centrale.',
      short: 'Aggiungerei un dettaglio concreto: cosa sta succedendo, cosa vuoi sapere o che reazione cerchi dalla community.',
      tags: 'Aggiungerei 2-3 tag mirati: aiutano Ikigai a collegarlo a post simili e trend.',
      title: 'Titolo più forte: breve, specifico, con una parola chiave riconoscibile.',
      tone: 'Tono consigliato',
    },
    en: {
      ok: 'The post is already readable. I’d only make the main point a little clearer.',
      short: 'I’d add one concrete detail: what is happening, what you want to know, or what reaction you want from the community.',
      tags: 'I’d add 2–3 focused tags: they help Ikigai connect it to similar posts and trends.',
      title: 'Stronger title: short, specific, with one recognizable keyword.',
      tone: 'Suggested tone',
    },
    es: {
      ok: 'El post ya se entiende. Solo haría un poco más claro el punto central.',
      short: 'Añadiría un detalle concreto: qué pasa, qué quieres saber o qué reacción buscas de la comunidad.',
      tags: 'Añadiría 2–3 etiquetas precisas: ayudan a Ikigai a conectarlo con posts similares y tendencias.',
      title: 'Título más fuerte: breve, específico, con una palabra clave reconocible.',
      tone: 'Tono recomendado',
    },
  }[lang];

  const consigli = [];
  if (breve) consigli.push(copy.short);
  else consigli.push(copy.ok);
  if (senzaTag) consigli.push(copy.tags);
  if (!titolo || titolo.length < 5) consigli.push(copy.title);

  return {
    ok: true,
    engine: 'andryx-ikigai-reticulum-local',
    externalApis: false,
    lingua: lang,
    tipo: 'inline-post-help',
    tono,
    profilo,
    classificazione,
    vettore: vettore(contenuto),
    paroleChiave: parole,
    consigli: consigli.slice(0, 4),
    suggerimentiTag: classificazione.suggestedTags,
    testoSintesi: `${copy.tone}: ${tono}. ${consigli[0]}`,
  };
}

function fondiVettori(a = {}, b = {}, pesoB = 0.35) {
  const out = {};
  for (const nodo of NODI) {
    out[nodo.id] = Number((((a[nodo.id] || 0) * (1 - pesoB)) + ((b[nodo.id] || 0) * pesoB)).toFixed(3));
  }
  return out;
}

export function reticoloIkigai(input = {}) {
  const lingua = normalizzaLinguaIkigai(input.lingua || input.language || 'it');
  const testo = pulisci(input.testo || input.text || input.domanda || input.question || '');
  const storico = Array.isArray(input.storico || input.history) ? (input.storico || input.history).map(x => pulisci(x, 900)).slice(-30) : [];
  const base = vettore(testo);
  const memoria = storico.length ? vettore(storico.join('\n')) : {};
  const stato = fondiVettori(base, memoria, storico.length ? 0.28 : 0);
  const profilo = profiloScrittura([...storico, testo].filter(Boolean), lingua);
  return {
    ok: true,
    engine: 'andryx-ikigai-reticulum-local',
    externalApis: false,
    lingua,
    stato,
    profilo,
    tono: tonoDaProfilo(profilo),
    nodi: NODI.map(n => ({ id: n.id, valore: stato[n.id] || 0 })),
  };
}

export function inlineHelpPostIkigai(input = {}) {
  return suggerisciPost(input);
}

export const RETICOLO_INFO = {
  name: 'Ikigai Reticolo Neuronale Locale',
  engine: 'andryx-ikigai-reticulum-local',
  externalApis: false,
  backendOnly: true,
  capabilities: ['user-writing-profile', 'inline-post-help', 'style-adaptation', 'intent-energy-vector', 'privacy-first-personalization'],
  nodes: NODI.map(({ id, peso }) => ({ id, peso })),
};
