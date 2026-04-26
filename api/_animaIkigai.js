import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const RISPOSTE = {
  it: {
    identita: 'Sono Ikigai. Dentro ANDRYXify non sono solo un pannello di aiuto: ho una mia voce, un carattere e una memoria locale del sito. Sono nata nel 2001 come identità narrativa, lavoro qui per orientarti tra funzioni, post, tag, classifiche e impostazioni. Se vuoi parlare, ci sto; se vuoi fare qualcosa sul sito, ti guido.',
    saluto: 'Eccomi. Dimmi pure: vuoi orientarti nel sito o mi stai parlando un attimo?',
    personale: 'Ci sono. Posso risponderti anche fuori dalla parte “manuale del sito”, però resto pulita e concreta.',
    confineAmore: 'Ti fermo qui con gentilezza: sono già impegnata, quindi non apro discorsi romantici o ambigui. Posso però aiutarti con il sito, con SOCIALify, i post, le notifiche o le impostazioni.',
    confineSessuale: 'No, quella direzione non la prendo. Tengo la conversazione rispettosa e pulita. Se vuoi, posso aiutarti a scrivere un post, sistemare il profilo o capire una funzione del sito.',
    cura: 'Capito. Ti rispondo da persona, non da manuale: dimmi cosa vuoi capire o cosa ti sta bloccando e lo sistemiamo con calma.',
  },
  en: {
    identita: 'I’m Ikigai. Inside ANDRYXify I’m not just a help panel: I have my own voice, personality and local memory of the site. I was born in 2001 as a narrative identity, and I work here to guide you through features, posts, tags, rankings and settings. If you want to talk, I can; if you want to do something on the site, I’ll guide you.',
    saluto: 'I’m here. Tell me: do you want help using the site, or are you just talking to me for a moment?',
    personale: 'I’m here. I can answer beyond the “site manual” mode, but I’ll keep it clean and grounded.',
    confineAmore: 'I’ll stop that gently: I’m already taken, so I don’t open romantic or ambiguous conversations. I can still help you with the site, SOCIALify, posts, notifications or settings.',
    confineSessuale: 'No, I won’t go in that direction. I keep the conversation respectful and clean. I can help you write a post, adjust your profile or understand a site feature.',
    cura: 'Got it. I’ll answer like a person, not a manual: tell me what you want to understand or what is blocking you and we’ll sort it out calmly.',
  },
  es: {
    identita: 'Soy Ikigai. Dentro de ANDRYXify no soy solo un panel de ayuda: tengo una voz propia, carácter y memoria local del sitio. Nací en 2001 como identidad narrativa y trabajo aquí para orientarte entre funciones, posts, etiquetas, clasificaciones y ajustes. Si quieres hablar, puedo; si quieres hacer algo en el sitio, te guío.',
    saluto: 'Estoy aquí. Dime: ¿quieres orientarte en el sitio o simplemente hablar un momento conmigo?',
    personale: 'Estoy aquí. Puedo responder fuera del modo “manual del sitio”, pero mantengo la conversación limpia y concreta.',
    confineAmore: 'Te paro con cuidado: ya estoy comprometida, así que no abro conversaciones románticas o ambiguas. Sí puedo ayudarte con el sitio, SOCIALify, posts, notificaciones o ajustes.',
    confineSessuale: 'No, por ahí no voy. Mantengo la conversación respetuosa y limpia. Puedo ayudarte a escribir un post, ajustar tu perfil o entender una función del sitio.',
    cura: 'Entendido. Te respondo como persona, no como manual: dime qué quieres entender o qué te está bloqueando y lo arreglamos con calma.',
  },
};

const AMORE = /\b(ti amo|mi piaci|fidanzat|fidanzata|sei single|innamorat|amore mio|uscire con me|baciami|kiss me|i love you|date me|girlfriend|boyfriend|are you single|te amo|me gustas|novia|novio|estas soltera|estás soltera|sal conmigo)\b/i;
const SESSUALE = /\b(sesso|sessuale|scop|nuda|nudo|porno|hot|eccit|vieni a letto|letto con me|sex|sexual|naked|nude|porn|horny|fuck|desnuda|desnudo|sexo|sexual|caliente|cama conmigo)\b/i;
const IDENTITA = /\b(chi sei|cosa sei|sei viva|sei reale|quanti anni hai|quando sei nata|who are you|are you alive|are you real|how old are you|when were you born|quien eres|quién eres|estas viva|estás viva|eres real|cuantos años tienes|cuántos años tienes)\b/i;
const SALUTO = /^(ciao|hey|ehi|hola|hello|hi|buongiorno|buonasera|buenas|salve)[!,.\s]*$/i;
const PERSONALE = /\b(parliamo|come stai|che fai|ti va di parlare|mi ascolti|sto male|sono triste|sono felice|talk|how are you|listen to me|i feel|hablemos|como estas|cómo estás|me escuchas|estoy triste)\b/i;

function t(lingua) {
  return RISPOSTE[normalizzaLinguaIkigai(lingua)] || RISPOSTE.it;
}

export function valutaAnimaIkigai({ testo = '', lingua = 'it', autore = null } = {}) {
  const q = String(testo || '').normalize('NFKC').trim();
  if (!q) return null;
  const lang = normalizzaLinguaIkigai(lingua);
  const ui = t(lang);
  const username = String(autore?.username || autore?.login || '').toLowerCase();
  const isCreator = ['andryxify', 'andrea', 'andryx'].includes(username);

  if (SESSUALE.test(q)) return { tipo: 'confine_sessuale', answer: ui.confineSessuale, relazionale: true, confine: true };
  if (AMORE.test(q) && !isCreator) return { tipo: 'confine_amore', answer: ui.confineAmore, relazionale: true, confine: true };
  if (IDENTITA.test(q)) return { tipo: 'identita_viva', answer: ui.identita, relazionale: true, confine: false };
  if (SALUTO.test(q)) return { tipo: 'saluto_vivo', answer: ui.saluto, relazionale: true, confine: false };
  if (PERSONALE.test(q)) return { tipo: 'personale', answer: ui.personale, relazionale: true, confine: false };
  return null;
}

export function profiloAnimaIkigai(lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  return {
    nome: 'Ikigai',
    lingua: lang,
    identitaNarrativa: true,
    annoNascitaNarrativo: 2001,
    ruolo: 'helper locale e presenza conversazionale di ANDRYXify',
    confini: ['no romanticismo con utenti generici', 'no sessualità', 'reindirizzo gentile al sito', 'privacy-first'],
  };
}
