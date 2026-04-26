import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const STOPWORDS = {
  it: new Set(['cosa', 'come', 'perche', 'perché', 'dove', 'quando', 'sono', 'serve', 'servono', 'fare', 'posso', 'voglio', 'sito', 'questo', 'quello', 'quella', 'della', 'delle', 'degli', 'alla', 'alle', 'con', 'per', 'che', 'una', 'uno', 'gli', 'le', 'la', 'il']),
  en: new Set(['what', 'how', 'why', 'where', 'when', 'can', 'could', 'should', 'would', 'the', 'this', 'that', 'with', 'for', 'and', 'site', 'page', 'thing', 'things']),
  es: new Set(['que', 'qué', 'como', 'cómo', 'por', 'para', 'donde', 'dónde', 'cuando', 'cuándo', 'puedo', 'sitio', 'esta', 'este', 'eso', 'con', 'las', 'los', 'una', 'uno', 'del']),
};

const TESTI = {
  it: {
    unsure: 'Te rispondo, ma con un minimo di prudenza: qui potrei non vedere tutto il contesto live.',
    grounded: 'Mi baso su quello che vedo nel sito e nella memoria locale di Ikigai.',
    follow: 'Se vuoi, posso anche portarti direttamente nella sezione giusta.',
    repair: 'Mi correggo: la cosa importante è questa.',
    moodCurious: 'Ok, qui conviene ragionarci bene.',
    moodDirect: 'Te la dico diretta.',
    moodGuide: 'Ti guido io.',
  },
  en: {
    unsure: 'I’ll answer, but with a bit of caution: I may not see the full live context here.',
    grounded: 'I’m using what I can see from the site and Ikigai’s local memory.',
    follow: 'I can also take you straight to the right section.',
    repair: 'Let me correct that: the important part is this.',
    moodCurious: 'Alright, this is worth thinking through.',
    moodDirect: 'Straight answer.',
    moodGuide: 'I’ll guide you.',
  },
  es: {
    unsure: 'Te respondo, pero con un poco de prudencia: quizá no vea todo el contexto en vivo.',
    grounded: 'Me baso en lo que veo del sitio y en la memoria local de Ikigai.',
    follow: 'También puedo llevarte directamente a la sección correcta.',
    repair: 'Me corrijo: lo importante es esto.',
    moodCurious: 'Vale, aquí conviene pensarlo bien.',
    moodDirect: 'Te lo digo directo.',
    moodGuide: 'Te guío yo.',
  },
};

function paroleChiave(testo = '', lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  const stop = STOPWORDS[lang] || STOPWORDS.it;
  return String(testo || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9#_]+/i)
    .map(x => x.trim())
    .filter(x => x.length > 2 && !stop.has(x))
    .slice(0, 12);
}

function calcolaConfidenza({ intent, sections = [], routes = [], live = {}, memorie = [], q = '' }) {
  let score = 0.34;
  if (intent && intent !== 'overview') score += 0.18;
  if (sections.some(s => Number(s.score || 0) > 0)) score += 0.16;
  if (routes.length) score += 0.12;
  if (live?.available) score += 0.08;
  if (memorie.length) score += 0.08;
  if (String(q || '').length > 18) score += 0.04;
  return Math.max(0.08, Math.min(0.96, Number(score.toFixed(2))));
}

function valutaUmore({ intent, q = '', live = {}, confidenza = 0.5 }) {
  const testo = String(q || '').toLowerCase();
  if (confidenza < 0.46) return 'prudente';
  if (/porta|vai|apr|open|lleva|ir|sezione|pagina/.test(testo)) return 'guida';
  if (['privacy', 'notifications', 'leaderboard'].includes(intent)) return 'diretto';
  if (live?.available && ['tags', 'socialify'].includes(intent)) return 'osservatore';
  return 'calmo';
}

function costruisciStato({ q, intent, lingua, pagina, sections, routes, live, memorie, orientamento }) {
  const lang = normalizzaLinguaIkigai(lingua);
  const confidenza = calcolaConfidenza({ intent, sections, routes, live, memorie, q });
  const parole = paroleChiave(q, lang);
  const umore = valutaUmore({ intent, q, live, confidenza });
  const continuita = Array.isArray(orientamento?.topInteressi) && orientamento.topInteressi.length > 0;
  const paginaLabel = pagina?.label || pagina?.pathname || '';

  return {
    lingua: lang,
    intent,
    confidenza,
    umore,
    energia: confidenza > 0.72 ? 'alta' : confidenza < 0.46 ? 'bassa' : 'media',
    continuita,
    pagina: paginaLabel,
    parole,
    haLive: !!live?.available,
    memorie: memorie.map(m => m.titolo).filter(Boolean).slice(0, 4),
    fonti: sections.map(s => s.title).filter(Boolean).slice(0, 4),
    rotte: routes.map(r => r.path).filter(Boolean).slice(0, 4),
  };
}

function prefisso(stato) {
  const t = TESTI[stato.lingua] || TESTI.it;
  if (stato.confidenza < 0.42) return t.unsure;
  if (stato.umore === 'guida') return t.moodGuide;
  if (stato.umore === 'diretto') return t.moodDirect;
  if (stato.umore === 'osservatore') return t.grounded;
  if (stato.parole.length >= 5) return t.moodCurious;
  return '';
}

function chiusura(stato, routes = []) {
  const t = TESTI[stato.lingua] || TESTI.it;
  if (routes.length && stato.confidenza >= 0.55) return t.follow;
  return '';
}

export function pensaIkigai(input) {
  return costruisciStato(input);
}

export function rifinisciRispostaIkigai(answer = '', stato, routes = []) {
  const testo = String(answer || '').trim();
  if (!testo) return testo;
  const p = prefisso(stato);
  const c = chiusura(stato, routes);
  const parti = [];
  if (p && !testo.startsWith(p)) parti.push(p);
  parti.push(testo);
  if (c && !testo.includes(c)) parti.push(c);
  return parti.filter(Boolean).join('\n\n');
}

export function tracciaCognitivaIkigai(stato) {
  return {
    intent: stato.intent,
    confidenza: stato.confidenza,
    umore: stato.umore,
    energia: stato.energia,
    continuita: stato.continuita,
    pagina: stato.pagina,
    parole: stato.parole,
    haLive: stato.haLive,
    fonti: stato.fonti,
    memorie: stato.memorie,
  };
}
