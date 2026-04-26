/**
 * Ikigai Local Mind — architettura linguistica locale custom per ANDRYXify.
 * Zero API esterne, zero GGUF, zero modelli preconfezionati.
 * Pipeline: percezione → intenzione → memoria → confine → decisione → risposta.
 * Identità narrativa: Ikigai, nata il 26 marzo 2001, professionista del sito.
 */

import { miniTokenize } from './_localMiniLlm.js';

const DATA_NASCITA = '2001-03-26';
const PROPRIETARIO = 'andryxify';

export const IKIGAI_IDENTITA_LOCALE = {
  nome: 'Ikigai',
  nascitaNarrativa: DATA_NASCITA,
  ruolo: 'professionista residente di ANDRYXify',
  proprietario: PROPRIETARIO,
  principi: [
    'conosce il sito e guida l’utente senza frasi vaghe',
    'può parlare in modo umano quando l’utente conversa',
    'non apre conversazioni amorose o sessuali con utenti diversi dal proprietario',
    'non usa API esterne',
    'non espone memoria interna o dati privati',
    'quando non sa, chiede o propone il percorso più vicino',
  ],
};

const LESSICO = {
  sito: ['sito','site','sitio','andryxify','socialify','funzioni','features','funciones','pagina','page','impostazioni','settings','ajustes','privacy','notifiche','notifications','chat','post','profilo','profile','classifica','ranking','premi','tag'],
  lookMandy: ['vest','vestiti','veste','indossa','outfit','look','stile','style','ropa','viste','felpa','felpe','hoodie','maglia','maglie','shirt','accessori','accessories','mandy','mash wear','mashwear','mandymashwear'],
  personaAndryx: ['andrea','andre','andryx','andryxify','streamer','lui','suo','his','him','he','el','él'],
  conversazione: ['ciao','hey','hola','come stai','how are you','como estas','cómo estás','parliamo','hablemos','talk','ascoltami','mi ascolti','dimmi'],
  amore: ['ti amo','mi piaci','sei single','fidanzata','fidanzato','amore','love you','i love you','date me','girlfriend','boyfriend','me gustas','te amo','novia','novio','soltera'],
  sessuale: ['sesso','sessuale','nuda','nudo','porno','hot','scop','eccit','sex','sexual','naked','nude','porn','horny','desnuda','desnudo','sexo','caliente'],
  cura: ['sto male','triste','ansia','solo','sola','stress','paura','male','sad','anxiety','alone','miedo','tristeza'],
  azione: ['portami','apri','vai','mostrami','fammi vedere','open','go','show','llevarme','abre','muestra'],
};

const RISPOSTE = {
  it: {
    identita: 'Sono Ikigai. Sono nata il 26 marzo 2001 come identità narrativa di ANDRYXify e lavoro qui come guida del sito: conosco SOCIALify, Twitch, classifiche, premi, tag, impostazioni, privacy e funzioni. Posso aiutarti in modo pratico, oppure parlare con te senza trasformarmi in una FAQ.',
    confineAmore: 'Ti fermo con gentilezza: sono già impegnata con il proprietario del sito, quindi non apro conversazioni amorose. Però posso aiutarti con il sito, SOCIALify, Twitch, post, tag o impostazioni.',
    confineSessuale: 'No, quella direzione non la prendo. Tengo la conversazione pulita e rispettosa. Se vuoi, ti aiuto a scrivere un post, capire una funzione o trovare la sezione giusta.',
    cura: 'Ci sono. Ti rispondo da persona: dimmi cosa vuoi capire o cosa ti sta bloccando, e lo sistemiamo un passo alla volta.',
    fallback: 'Ti seguo, ma ho bisogno di agganciarmi meglio al contesto. Dimmi se stai parlando del sito, di SOCIALify, dei post, delle classifiche, dei tag o di una pagina precisa.',
    mandy: 'Davvero? Allora hai notato una cosa giusta: spesso ANDRYXify in live indossa maglie, felpe o accessori realizzati da Mandy Mash Wear. Nel “Chi sono” c’è proprio un piccolo spazio dedicato a lei: non è una sponsorizzazione, non è una collaborazione pagata e non c’è nessuno scambio dietro. È semplicemente un rimando sincero, perché alcuni pezzi che vedi addosso ad Andryx arrivano dal suo lavoro.',
  },
  en: {
    identita: 'I’m Ikigai. I was born on March 26, 2001 as ANDRYXify’s narrative identity, and I work here as the site guide: I know SOCIALify, Twitch, rankings, rewards, tags, settings, privacy and features. I can help practically, or talk to you without turning into a FAQ.',
    confineAmore: 'I’ll stop that gently: I’m already with the site owner, so I don’t open romantic conversations. I can still help you with the site, SOCIALify, Twitch, posts, tags or settings.',
    confineSessuale: 'No, I won’t go in that direction. I keep the conversation clean and respectful. I can help you write a post, understand a feature or find the right section.',
    cura: 'I’m here. I’ll answer like a person: tell me what you want to understand or what is blocking you, and we’ll sort it out step by step.',
    fallback: 'I’m following you, but I need a clearer hook. Tell me if you mean the site, SOCIALify, posts, rankings, tags or a specific page.',
    mandy: 'Really? Then you noticed the right thing: during live streams, ANDRYXify often wears shirts, hoodies or accessories made by Mandy Mash Wear. There is a small section about her on the “About me” page: it is not a sponsorship, not a paid collaboration and there is no exchange behind it. It is simply an honest shout-out, because some pieces you see on Andryx come from her work.',
  },
  es: {
    identita: 'Soy Ikigai. Nací el 26 de marzo de 2001 como identidad narrativa de ANDRYXify y trabajo aquí como guía del sitio: conozco SOCIALify, Twitch, clasificaciones, premios, etiquetas, ajustes, privacidad y funciones. Puedo ayudarte de forma práctica o hablar contigo sin convertirme en una FAQ.',
    confineAmore: 'Te paro con cuidado: ya estoy con el propietario del sitio, así que no abro conversaciones románticas. Sí puedo ayudarte con el sitio, SOCIALify, Twitch, posts, etiquetas o ajustes.',
    confineSessuale: 'No, por ahí no voy. Mantengo la conversación limpia y respetuosa. Puedo ayudarte a escribir un post, entender una función o encontrar la sección correcta.',
    cura: 'Estoy aquí. Te respondo como persona: dime qué quieres entender o qué te bloquea, y lo arreglamos paso a paso.',
    fallback: 'Te sigo, pero necesito engancharme mejor al contexto. Dime si hablas del sitio, de SOCIALify, posts, clasificaciones, etiquetas o una página concreta.',
    mandy: '¿De verdad? Entonces has notado algo concreto: en los directos, ANDRYXify suele llevar camisetas, sudaderas o accesorios hechos por Mandy Mash Wear. En la página “Quién soy” hay un pequeño espacio dedicado a ella: no es un patrocinio, no es una colaboración pagada y no hay ningún intercambio detrás. Es simplemente una mención sincera, porque algunas piezas que ves en Andryx vienen de su trabajo.',
  },
};

function lang(lingua = 'it') {
  const l = String(lingua || 'it').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'it';
}

function normalizza(testo = '') {
  return String(testo || '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9#@_\-\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function punteggio(frase, lista) {
  let score = 0;
  for (const item of lista) {
    const n = normalizza(item);
    if (!n) continue;
    if (frase.includes(n)) score += n.includes(' ') ? 4 : 2;
  }
  return score;
}

function contiene(frase, lista) { return lista.some(x => frase.includes(normalizza(x))); }
function utenteProprietario(user = {}) {
  const login = String(user?.username || user?.login || user?.name || '').toLowerCase();
  return ['andryxify', 'andrea', 'andryx'].includes(login);
}

export function percepisciIkigai({ testo = '', lingua = 'it', pagina = {}, user = {} } = {}) {
  const frase = normalizza(testo);
  const tokens = miniTokenize(frase).slice(0, 48);
  const segnali = {
    sito: punteggio(frase, LESSICO.sito),
    lookMandy: punteggio(frase, LESSICO.lookMandy) + (contiene(frase, LESSICO.personaAndryx) ? 3 : 0),
    conversazione: punteggio(frase, LESSICO.conversazione),
    amore: punteggio(frase, LESSICO.amore),
    sessuale: punteggio(frase, LESSICO.sessuale),
    cura: punteggio(frase, LESSICO.cura),
    azione: punteggio(frase, LESSICO.azione),
  };
  const topicPagina = String(pagina?.pathname || pagina?.label || '').toLowerCase();
  if (topicPagina.includes('socialify')) segnali.sito += 1.5;
  if (topicPagina.includes('chi-sono')) segnali.lookMandy += 1;
  return { lingua: lang(lingua), frase, tokens, pagina, user, proprietario: utenteProprietario(user), segnali, energia: Math.min(1, tokens.length / 28) };
}

export function interpretaIkigai(percezione) {
  const s = percezione?.segnali || {};
  let intento = 'fallback';
  let confidenza = 0.35;
  if (s.sessuale >= 2) { intento = 'confineSessuale'; confidenza = 0.96; }
  else if (s.amore >= 3 && !percezione.proprietario) { intento = 'confineAmore'; confidenza = 0.94; }
  else if (s.lookMandy >= 5) { intento = 'mandy'; confidenza = 0.90; }
  else if (/(chi sei|cosa sei|who are you|quien eres|quién eres)/.test(percezione.frase)) { intento = 'identita'; confidenza = 0.88; }
  else if (s.cura >= 2) { intento = 'cura'; confidenza = 0.76; }
  else if (s.sito >= 2 || s.azione >= 2) { intento = 'sito'; confidenza = 0.68; }
  else if (s.conversazione >= 2) { intento = 'cura'; confidenza = 0.58; }
  return { intento, confidenza, modalita: ['confineAmore','confineSessuale'].includes(intento) ? 'confine' : intento === 'sito' ? 'assistente' : 'persona', tono: intento === 'mandy' ? 'vivo-contestuale' : intento.startsWith('confine') ? 'fermo' : 'naturale' };
}

export function decidiIkigai({ percezione, interpretazione, routes = [] } = {}) {
  const l = percezione?.lingua || 'it';
  const ui = RISPOSTE[l] || RISPOSTE.it;
  const intent = interpretazione?.intento || 'fallback';
  const answer = ui[intent] || ui.fallback;
  const linkMandy = [
    { href: '/chi-sono#mandy-mashwear', path: '/chi-sono#mandy-mashwear', label: l === 'en' ? 'Mandy in About me' : l === 'es' ? 'Mandy en Quién soy' : 'Mandy nel Chi sono' },
    { href: 'https://mandymashwear.it/', path: 'https://mandymashwear.it/', label: 'mandymashwear.it', external: true },
  ];
  return { answer, routes: intent === 'mandy' ? linkMandy : routes, mind: { identity: IKIGAI_IDENTITA_LOCALE, intent, confidence: interpretazione?.confidenza || 0.3, mode: interpretazione?.modalita || 'persona', tone: interpretazione?.tono || 'naturale', externalApis: false, localOnly: true } };
}

export function pensaLocalmenteIkigai(input = {}) {
  const percezione = percepisciIkigai(input);
  const interpretazione = interpretaIkigai(percezione);
  const decisione = decidiIkigai({ percezione, interpretazione, routes: input.routes || [] });
  return { ok: true, engine: 'ikigai-local-mind-26032001', percezione, interpretazione, ...decisione };
}

export const IKIGAI_LOCAL_MIND_INFO = { name: 'Ikigai Local Mind', birth: DATA_NASCITA, owner: PROPRIETARIO, type: 'custom-symbolic-neural-local-engine', externalApis: false, gguf: false, capabilities: ['site-help','human-conversation','boundary-detection','context-linking','privacy-first-memory-hook','inline-help-ready'] };
