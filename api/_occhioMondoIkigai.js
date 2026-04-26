import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const MANDY_URL = 'https://mandymashwear.it/';

const WORLD = {
  mandy_mashwear: {
    peso: 1.45,
    terms: ['mandy', 'mandymashwear', 'mashwear', 'maglie', 'felpe', 'accessori', 'merch', 'abbigliamento', 'hoodies', 'shirts', 'clothes', 'accessories', 'sudaderas', 'camisetas', 'accesorios', 'ropa'],
    routes: [
      { path: '/chi-sono#mandy-mashwear', label: { it: 'Sezione Mandy su Chi sono', en: 'Mandy section on About me', es: 'Sección Mandy en Quién soy' }, anchor: 'mandy-mashwear' },
      { href: MANDY_URL, external: true, label: { it: 'mandymashwear.it', en: 'mandymashwear.it', es: 'mandymashwear.it' } },
    ],
    answer: {
      it: 'Sì, Mandy Mashwear ha un piccolo spazio nella pagina “Chi sono”. Andrea spiega che spesso in live indossa accessori, maglie o felpe fatte da lei, e specifica anche che non è una collaborazione pagata né una sponsorizzazione: è solo un rimando sincero perché gli fa piacere darle visibilità. Ti porto direttamente lì, oppure puoi aprire il suo sito.',
      en: 'Yes, Mandy Mashwear has a small dedicated space on the “About me” page. Andrea explains that during live streams he often wears accessories, shirts or hoodies made by her, and also makes clear that it is not a paid collaboration or sponsorship: it is just an honest shout-out because he is happy to give her visibility. I can take you straight there, or you can open her website.',
      es: 'Sí, Mandy Mashwear tiene un pequeño espacio en la página “Quién soy”. Andrea explica que en los directos suele llevar accesorios, camisetas o sudaderas hechas por ella, y deja claro que no es una colaboración pagada ni un patrocinio: es simplemente una mención sincera porque le hace ilusión darle visibilidad. Te llevo directamente ahí, o puedes abrir su sitio.',
    },
  },
  chi_sono: {
    peso: 1.1,
    terms: ['chi sei', 'andrea', 'andryx', 'andryxify', 'taliento', 'chi sono', 'about', 'about me', 'quien eres', 'quién eres', 'genova', 'creator', 'streamer'],
    routes: [{ path: '/chi-sono', label: { it: 'Chi sono', en: 'About me', es: 'Quién soy' } }],
    answer: {
      it: 'La pagina “Chi sono” raccoglie la parte personale di ANDRYXify: Andrea, Genova, streaming, gaming, IA, interessi e collegamenti principali. Se vuoi capire chi c’è dietro al sito, partirei da lì.',
      en: 'The “About me” page collects the personal side of ANDRYXify: Andrea, Genoa, streaming, gaming, AI, interests and main links. If you want to understand who is behind the site, I’d start there.',
      es: 'La página “Quién soy” reúne la parte personal de ANDRYXify: Andrea, Génova, streaming, gaming, IA, intereses y enlaces principales. Si quieres entender quién está detrás del sitio, empezaría por ahí.',
    },
  },
  socialify: {
    peso: 1.18,
    terms: ['socialify', 'community', 'feed', 'post', 'risposte', 'thread', 'like', 'preferiti', 'tag', 'community', 'comunidad', 'publicar', 'respuestas', 'favoritos', 'replies'],
    routes: [
      { path: '/socialify', label: { it: 'Apri SOCIALify', en: 'Open SOCIALify', es: 'Abrir SOCIALify' } },
      { path: '/socialify/info-tag', label: { it: 'Info tag', en: 'Tag info', es: 'Info etiquetas' } },
    ],
    answer: {
      it: 'SOCIALify è la parte community: puoi leggere e pubblicare post, rispondere, usare tag, seguire trend, salvare preferiti e partecipare alle classifiche. Se vuoi scoprire contenuti o parlare con la community, è la sezione giusta.',
      en: 'SOCIALify is the community area: you can read and publish posts, reply, use tags, follow trends, save favorites and join rankings. If you want to discover content or talk with the community, that is the right section.',
      es: 'SOCIALify es la zona de comunidad: puedes leer y publicar posts, responder, usar etiquetas, seguir tendencias, guardar favoritos y participar en clasificaciones. Si quieres descubrir contenido o hablar con la comunidad, es la sección correcta.',
    },
  },
  classifiche_premi: {
    peso: 1.16,
    terms: ['classifica', 'classifiche', 'premi', 'premio', 'xp', 'livelli', 'vip settimanale', 'campione mensile', 'ranking', 'leaderboard', 'rewards', 'levels', 'clasificacion', 'clasificación', 'premios', 'niveles'],
    routes: [{ path: '/socialify', label: { it: 'Classifiche SOCIALify', en: 'SOCIALify rankings', es: 'Clasificaciones SOCIALify' } }],
    answer: {
      it: 'Le classifiche premiano partecipazione utile, non spam: post, risposte, like ricevuti/dati, tag usati bene e milestone. I livelli crescono con l’XP e alcune sezioni premio sono legate all’attività settimanale o mensile.',
      en: 'Rankings reward useful participation, not spam: posts, replies, likes given/received, well-used tags and milestones. Levels grow with XP and some rewards are tied to weekly or monthly activity.',
      es: 'Las clasificaciones premian la participación útil, no el spam: posts, respuestas, likes dados/recibidos, etiquetas bien usadas y logros. Los niveles suben con XP y algunos premios dependen de la actividad semanal o mensual.',
    },
  },
  notifiche: {
    peso: 1.14,
    terms: ['notifiche', 'push', 'suoni', 'vibrazione', 'menzioni', 'ore silenziose', 'notifications', 'sounds', 'quiet hours', 'mentions', 'notificaciones', 'sonidos', 'horas silenciosas', 'menciones'],
    routes: [{ path: '/impostazioni#notifiche', label: { it: 'Impostazioni notifiche', en: 'Notification settings', es: 'Ajustes de notificaciones' }, anchor: 'notifiche' }],
    answer: {
      it: 'Le notifiche si gestiscono dalle impostazioni. Puoi separare in-app, push, suoni, vibrazione, anteprime, categorie e ore silenziose. Se il browser non supporta le push, il sito lo mostra chiaramente.',
      en: 'Notifications are managed from settings. You can separate in-app, push, sounds, vibration, previews, categories and quiet hours. If the browser does not support push notifications, the site says it clearly.',
      es: 'Las notificaciones se gestionan desde ajustes. Puedes separar in-app, push, sonidos, vibración, vistas previas, categorías y horas silenciosas. Si el navegador no soporta push, el sitio lo indica claramente.',
    },
  },
  privacy_sicurezza: {
    peso: 1.22,
    terms: ['privacy', 'sicurezza', 'dati', 'elimina dati', 'cancellare account', 'chat private', 'crittografia', 'e2e', 'privacidad', 'seguridad', 'datos', 'eliminar cuenta', 'private chats', 'delete account', 'security'],
    routes: [
      { path: '/privacy', label: { it: 'Privacy e sicurezza', en: 'Privacy and security', es: 'Privacidad y seguridad' } },
      { path: '/impostazioni#dati', label: { it: 'Gestione dati', en: 'Data management', es: 'Gestión de datos' }, anchor: 'dati' },
    ],
    answer: {
      it: 'Per privacy e sicurezza hai due punti: la pagina Privacy spiega cosa viene trattato, mentre in Impostazioni puoi gestire dati, notifiche, account e cancellazione. Le chat private sono considerate una bolla separata e più delicata.',
      en: 'For privacy and security there are two places: the Privacy page explains what is handled, while Settings lets you manage data, notifications, account and deletion. Private chats are treated as a separate and more sensitive bubble.',
      es: 'Para privacidad y seguridad hay dos lugares: la página de Privacidad explica qué se trata, mientras que Ajustes permite gestionar datos, notificaciones, cuenta y eliminación. Los chats privados se tratan como una burbuja separada y más sensible.',
    },
  },
  twitch_live: {
    peso: 1.08,
    terms: ['twitch', 'live', 'stream', 'diretta', 'offline', 'player', 'streaming', 'directo'],
    routes: [{ path: '/twitch', label: { it: 'Pagina Twitch', en: 'Twitch page', es: 'Página Twitch' } }],
    answer: {
      it: 'La parte Twitch raccoglie la presenza live di ANDRYXify. Dalla Home vedi la preview, mentre la pagina Twitch è il posto giusto per lo stream completo e i collegamenti.',
      en: 'The Twitch area collects ANDRYXify’s live presence. The Home shows the preview, while the Twitch page is the right place for the full stream and links.',
      es: 'La zona Twitch reúne la presencia en directo de ANDRYXify. En la Home ves la vista previa, mientras que la página Twitch es el lugar correcto para el stream completo y los enlaces.',
    },
  },
  giochi: {
    peso: 1.05,
    terms: ['giochi', 'gioco', 'game', 'gaming', 'gioca', 'play', 'juegos', 'jugar'],
    routes: [{ path: '/gioco', label: { it: 'Giochi', en: 'Games', es: 'Juegos' } }],
    answer: {
      it: 'La sezione Giochi raccoglie la parte interattiva del sito. Se vuoi provare qualcosa subito, ti porto lì.',
      en: 'The Games section contains the interactive side of the site. If you want to try something right away, I’ll take you there.',
      es: 'La sección Juegos reúne la parte interactiva del sitio. Si quieres probar algo enseguida, te llevo allí.',
    },
  },
};

function tokens(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9#_]+/i)
    .filter(Boolean);
}

function scoreTerms(text, terms = []) {
  const q = String(text || '').toLowerCase();
  const qTokens = new Set(tokens(q));
  let score = 0;
  for (const term of terms) {
    const t = String(term).toLowerCase();
    if (q.includes(t)) score += t.length > 8 ? 8 : 4;
    for (const token of tokens(t)) {
      if (qTokens.has(token)) score += token.length > 5 ? 1.6 : 0.8;
    }
  }
  return score;
}

export function localizzaWorldRoutes(routes = [], lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  return routes.map(route => ({
    ...route,
    label: typeof route.label === 'object' ? (route.label[lang] || route.label.it) : route.label,
  }));
}

export function occhioMondoIkigai({ domanda = '', pagina = {}, lingua = 'it', memoria = [], orientamento = {} } = {}) {
  const lang = normalizzaLinguaIkigai(lingua);
  const mem = Array.isArray(memoria) ? memoria.map(m => `${m.titolo || ''} ${m.testo || ''}`).join(' ') : '';
  const orient = `${(orientamento.topPagine || []).join(' ')} ${(orientamento.topIntenti || []).join(' ')}`;
  const text = `${domanda} ${pagina?.pathname || ''} ${pagina?.label || ''} ${mem} ${orient}`;
  const matches = Object.entries(WORLD)
    .map(([id, item]) => ({ id, item, score: scoreTerms(text, item.terms) * (item.peso || 1) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = matches[0];
  if (!top || top.score < 4) return null;

  return {
    intent: top.id,
    answer: top.item.answer[lang] || top.item.answer.it,
    routes: localizzaWorldRoutes(top.item.routes, lang),
    confidence: Math.min(0.98, 0.58 + top.score / 34),
    worldAware: true,
    alternatives: matches.slice(1, 4).map(x => ({ intent: x.id, score: Number(x.score.toFixed(2)) })),
  };
}

export const IKIGAI_WORLD_MAP = WORLD;
