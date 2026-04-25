const LINGUE = new Set(['it', 'en', 'es']);

export function normalizzaLinguaIkigai(lingua = 'it') {
  const codice = String(lingua || 'it').toLowerCase().slice(0, 2);
  return LINGUE.has(codice) ? codice : 'it';
}

const ROTTE = {
  it: {
    '/': 'Home',
    '/socialify': 'SOCIALify',
    '/socialify/info-tag': 'Info tag',
    '/gioco': 'Giochi',
    '/chat': 'Chat',
    '/messaggi': 'Messaggi',
    '/amici': 'Amici',
    '/impostazioni': 'Impostazioni',
    '/twitch': 'Twitch',
    '/profilo': 'Profilo',
    '/privacy': 'Privacy',
  },
  en: {
    '/': 'Home',
    '/socialify': 'SOCIALify',
    '/socialify/info-tag': 'Tag info',
    '/gioco': 'Games',
    '/chat': 'Chat',
    '/messaggi': 'Messages',
    '/amici': 'Friends',
    '/impostazioni': 'Settings',
    '/twitch': 'Twitch',
    '/profilo': 'Profile',
    '/privacy': 'Privacy',
  },
  es: {
    '/': 'Inicio',
    '/socialify': 'SOCIALify',
    '/socialify/info-tag': 'Info etiquetas',
    '/gioco': 'Juegos',
    '/chat': 'Chat',
    '/messaggi': 'Mensajes',
    '/amici': 'Amigos',
    '/impostazioni': 'Ajustes',
    '/twitch': 'Twitch',
    '/profilo': 'Perfil',
    '/privacy': 'Privacidad',
  },
};

const UI = {
  it: {
    welcome: 'Eccomi. Chiedimi pure cosa puoi fare qui, come funzionano tag, classifiche, premi, notifiche o SOCIALify.',
    links: 'Ti lascio i collegamenti utili qui sotto.',
    currentPage: page => ` Ora sei su ${page}, quindi posso orientarti rispetto a questa pagina.`,
    trending: trend => ` In questo momento vedo muoversi soprattutto ${trend}.`,
    personalTags: tags => ` Per come la stai usando, partirei da ${tags}.`,
    trendAndPersonal: (trend, tags) => ` In questo momento vedo muoversi soprattutto ${trend}; per te terrei d’occhio anche ${tags}.`,
    topMonthly: (name, xp) => ` Al momento il primo mensile risulta ${name} con ${xp} XP.`,
  },
  en: {
    welcome: 'I’m here. Ask me what you can do here, how tags work, how rankings and rewards work, or how to manage notifications and SOCIALify.',
    links: 'I’ll leave the useful links below.',
    currentPage: page => ` You’re currently on ${page}, so I can guide you from here.`,
    trending: trend => ` Right now, the tags gaining the most traction are ${trend}.`,
    personalTags: tags => ` Based on how you use the site, I’d start from ${tags}.`,
    trendAndPersonal: (trend, tags) => ` Right now, ${trend} is moving; for you, I’d also keep an eye on ${tags}.`,
    topMonthly: (name, xp) => ` Right now, the monthly leader appears to be ${name} with ${xp} XP.`,
  },
  es: {
    welcome: 'Estoy aquí. Pregúntame qué puedes hacer en el sitio, cómo funcionan las etiquetas, las clasificaciones, los premios, las notificaciones o SOCIALify.',
    links: 'Te dejo los enlaces útiles aquí abajo.',
    currentPage: page => ` Ahora estás en ${page}, así que puedo orientarte desde esta página.`,
    trending: trend => ` Ahora mismo se están moviendo sobre todo ${trend}.`,
    personalTags: tags => ` Por cómo estás usando el sitio, empezaría por ${tags}.`,
    trendAndPersonal: (trend, tags) => ` Ahora mismo se están moviendo sobre todo ${trend}; para ti también vigilaría ${tags}.`,
    topMonthly: (name, xp) => ` Ahora mismo el primero del mes parece ser ${name} con ${xp} XP.`,
  },
};

function tx(lingua) {
  return UI[normalizzaLinguaIkigai(lingua)] || UI.it;
}

export function etichettaRotta(path, lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  return ROTTE[lang]?.[path] || ROTTE.it[path] || path;
}

export function localizzaRotte(routes = [], lingua = 'it') {
  return routes.map(route => ({
    ...route,
    label: etichettaRotta(route.path, lingua),
    href: route.path,
  }));
}

function routesText(routes, lingua) {
  return routes?.length ? `\n\n${tx(lingua).links}` : '';
}

function tagsLiveText(live, orientamento, lingua) {
  const t = tx(lingua);
  const trend = live?.trending?.map(x => `#${x.nome}`).join(', ');
  const interessi = orientamento?.topInteressi?.slice(0, 3).map(x => `#${x}`).join(', ');
  if (trend && interessi) return t.trendAndPersonal(trend, interessi);
  if (trend) return t.trending(trend);
  if (interessi) return t.personalTags(interessi);
  return '';
}

function classificaLiveText(live, lingua) {
  const top = live?.monthly?.[0];
  if (top?.nome) return tx(lingua).topMonthly(top.nome, top.valore);
  return '';
}

function tonoFinale(testo, orientamento = {}) {
  if (orientamento.profondita === 'breve') return testo.split('\n\n').slice(0, 2).join('\n\n');
  return testo;
}

const RISPOSTE = {
  it: {
    tags: ({ live, orientamento, routes }) => `Sì: i tag sono il modo più comodo per far capire al sito “di cosa parla” un post. Non sono solo etichette: servono per cercare contenuti, creare tendenze, collegare post simili e far nascere macroCategorie quando la community usa spesso gli stessi argomenti insieme.${tagsLiveText(live, orientamento, 'it')}\n\nEsempio pratico: se molti post usano #zelda, #nintendo e #ocarinaoftime, Ikigai può capire che lì sta nascendo un’area gaming specifica e suggerirti contenuti simili.${routesText(routes, 'it')}`,
    leaderboard: ({ live, routes }) => `La classifica funziona a XP: guadagni punti partecipando bene, non spammando. Post utili, risposte, like ricevuti/dati e tag che diventano popolari aiutano a salire; se ripeti troppe azioni uguali, il rendimento cala.${classificaLiveText(live, 'it')}\n\nI premi tipo VIP settimanale o campione mensile hanno senso proprio lì: premiare chi tiene viva la community.${routesText(routes, 'it')}`,
    notifications: ({ routes }) => `Le notifiche le gestisci dalle Impostazioni. Puoi separare push e notifiche in-app, scegliere suoni/vibrazione, anteprime, ore silenziose e categorie come messaggi, risposte, menzioni, amici, community, live e sistema.\n\nIn pratica: puoi farle diventare tranquille o super presenti, senza subire tutto insieme.${routesText(routes, 'it')}`,
    socialify: ({ routes }) => `SOCIALify è la piazza del sito: feed, post, risposte, like, preferiti, allegati, menzioni e tag. Se sei loggato con Twitch puoi partecipare davvero; se non lo sei puoi comunque esplorare ciò che è pubblico.\n\nDa lì passano anche classifiche, tendenze e macroCategorie.${routesText(routes, 'it')}`,
    privacy: ({ routes }) => `La privacy qui ruota attorno a profilo, amici, visibilità dei post, chat private e Ikigai. Puoi controllare cosa mostri, come ricevi notifiche e quali dati adattivi tenere attivi.${routesText(routes, 'it')}`,
    account: ({ routes }) => `L’account passa da Twitch. Con il login sblocchi post, risposte, like, preferiti, amici, messaggi, profilo, classifiche XP e notifiche personalizzate.${routesText(routes, 'it')}`,
    games: ({ routes }) => `La sezione Giochi raccoglie la parte interattiva. Se invece vuoi parlare di gaming con la community, SOCIALify usa categorie e tag dedicati per far emergere giochi, discussioni e trend.${routesText(routes, 'it')}`,
    overview: ({ routes, page }) => `Puoi usare ANDRYXify come hub personale/community: SOCIALify per post e discussioni, classifiche e premi per la parte competitiva, tag per trovare contenuti, giochi per la parte interattiva, profilo/messaggi/amici per la parte social e impostazioni per personalizzare tutto.${page ? tx('it').currentPage(page) : ''}${routesText(routes, 'it')}`,
  },
  en: {
    tags: ({ live, orientamento, routes }) => `Yes: tags are the easiest way to tell the site what a post is about. They’re not just labels: they help people search, surface trends, connect similar posts and grow macro-categories when the community keeps using related topics together.${tagsLiveText(live, orientamento, 'en')}\n\nPractical example: if many posts use #zelda, #nintendo and #ocarinaoftime, Ikigai can understand that a specific gaming area is forming and suggest similar content.${routesText(routes, 'en')}`,
    leaderboard: ({ live, routes }) => `The ranking is XP-based: you climb by participating well, not by spamming. Useful posts, replies, likes received/given and tags that become popular can all help; repeating the same actions too quickly gives diminishing returns.${classificaLiveText(live, 'en')}\n\nWeekly VIP and monthly champion rewards are built around that idea: rewarding people who actually keep the community alive.${routesText(routes, 'en')}`,
    notifications: ({ routes }) => `You manage notifications from Settings. You can separate push and in-app alerts, choose sounds/vibration, previews, quiet hours and categories such as messages, replies, mentions, friends, community, live streams and system updates.\n\nBasically, you can make them calm or very present without getting everything at once.${routesText(routes, 'en')}`,
    socialify: ({ routes }) => `SOCIALify is the site’s community square: feed, posts, replies, likes, favorites, attachments, mentions and tags. If you’re logged in with Twitch, you can participate fully; if not, you can still explore public content.\n\nRankings, trends and macro-categories all grow from there.${routesText(routes, 'en')}`,
    privacy: ({ routes }) => `Privacy here is about your profile, friends, post visibility, private chats and Ikigai. You can control what you show, how notifications behave and whether adaptive data stays enabled.${routesText(routes, 'en')}`,
    account: ({ routes }) => `The account system uses Twitch. Logging in unlocks posts, replies, likes, favorites, friends, messages, your profile, XP rankings and personalized notifications.${routesText(routes, 'en')}`,
    games: ({ routes }) => `The Games section contains the interactive side of the site. If you want to talk about gaming with the community, SOCIALify uses dedicated categories and tags to surface games, discussions and trends.${routesText(routes, 'en')}`,
    overview: ({ routes, page }) => `You can use ANDRYXify as a personal/community hub: SOCIALify for posts and discussions, rankings and rewards for the competitive side, tags to find content, games for interaction, profile/messages/friends for the social layer and settings to personalize everything.${page ? tx('en').currentPage(page) : ''}${routesText(routes, 'en')}`,
  },
  es: {
    tags: ({ live, orientamento, routes }) => `Sí: las etiquetas son la forma más cómoda de decirle al sitio de qué trata un post. No son solo etiquetas: sirven para buscar contenido, crear tendencias, conectar posts parecidos y hacer nacer macroCategorías cuando la comunidad usa a menudo los mismos temas juntos.${tagsLiveText(live, orientamento, 'es')}\n\nEjemplo práctico: si muchos posts usan #zelda, #nintendo y #ocarinaoftime, Ikigai puede entender que está naciendo un área gaming específica y sugerirte contenido similar.${routesText(routes, 'es')}`,
    leaderboard: ({ live, routes }) => `La clasificación funciona con XP: subes participando bien, no haciendo spam. Posts útiles, respuestas, likes recibidos/dados y etiquetas que se vuelven populares ayudan a subir; repetir demasiadas acciones iguales en poco tiempo rinde menos.${classificaLiveText(live, 'es')}\n\nPremios como VIP semanal o campeón mensual tienen sentido ahí: premiar a quien mantiene viva la comunidad.${routesText(routes, 'es')}`,
    notifications: ({ routes }) => `Las notificaciones se gestionan desde Ajustes. Puedes separar push y avisos dentro de la app, elegir sonidos/vibración, vistas previas, horas silenciosas y categorías como mensajes, respuestas, menciones, amigos, comunidad, directos y sistema.\n\nEn la práctica, puedes hacerlas discretas o muy presentes sin recibir todo junto.${routesText(routes, 'es')}`,
    socialify: ({ routes }) => `SOCIALify es la plaza de la comunidad: feed, posts, respuestas, likes, favoritos, adjuntos, menciones y etiquetas. Si inicias sesión con Twitch puedes participar de verdad; si no, puedes explorar el contenido público.\n\nDe ahí nacen también clasificaciones, tendencias y macroCategorías.${routesText(routes, 'es')}`,
    privacy: ({ routes }) => `La privacidad aquí gira alrededor del perfil, amigos, visibilidad de posts, chats privados e Ikigai. Puedes controlar qué muestras, cómo se comportan las notificaciones y si los datos adaptativos siguen activos.${routesText(routes, 'es')}`,
    account: ({ routes }) => `La cuenta funciona con Twitch. Al iniciar sesión desbloqueas posts, respuestas, likes, favoritos, amigos, mensajes, perfil, clasificaciones XP y notificaciones personalizadas.${routesText(routes, 'es')}`,
    games: ({ routes }) => `La sección Juegos recoge la parte interactiva. Si quieres hablar de gaming con la comunidad, SOCIALify usa categorías y etiquetas dedicadas para hacer emerger juegos, discusiones y tendencias.${routesText(routes, 'es')}`,
    overview: ({ routes, page }) => `Puedes usar ANDRYXify como hub personal y de comunidad: SOCIALify para posts y discusiones, clasificaciones y premios para la parte competitiva, etiquetas para encontrar contenido, juegos para la parte interactiva, perfil/mensajes/amigos para la parte social y ajustes para personalizarlo todo.${page ? tx('es').currentPage(page) : ''}${routesText(routes, 'es')}`,
  },
};

export function rispostaNaturaleIkigai({ intent, routes, live, contestoPagina = {}, orientamento = {}, lingua = 'it' }) {
  const lang = normalizzaLinguaIkigai(lingua);
  const page = String(contestoPagina?.label || contestoPagina?.pathname || '').slice(0, 80);
  const gruppo = RISPOSTE[lang] || RISPOSTE.it;
  const builder = gruppo[intent] || gruppo.overview;
  return tonoFinale(builder({ routes, live, page, orientamento }), orientamento);
}

export function benvenutoIkigai(lingua = 'it') {
  return tx(lingua).welcome;
}

export function rispostaFallbackIkigai(lingua = 'it') {
  const lang = normalizzaLinguaIkigai(lingua);
  if (lang === 'en') return 'Something got stuck for a second. Try again and I’ll answer properly.';
  if (lang === 'es') return 'Algo se atascó un momento. Inténtalo de nuevo y te contesto bien.';
  return 'Mh, qui mi si è inceppato il collegamento. Riprova tra poco e ti rispondo meglio.';
}
