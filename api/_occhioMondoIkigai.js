import { normalizzaLinguaIkigai } from './_linguaNaturalisIkigai.js';

const MANDY_URL = 'https://mandymashwear.it/';

const WORLD = {
  mandy_mashwear: {
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
};

function scoreTerms(text, terms = []) {
  const q = String(text || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (q.includes(t)) score += t.length > 8 ? 7 : 4;
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

export function occhioMondoIkigai({ domanda = '', pagina = {}, lingua = 'it' } = {}) {
  const lang = normalizzaLinguaIkigai(lingua);
  const text = `${domanda} ${pagina?.pathname || ''} ${pagina?.label || ''}`;
  const matches = Object.entries(WORLD)
    .map(([id, item]) => ({ id, item, score: scoreTerms(text, item.terms) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = matches[0];
  if (!top || top.score < 4) return null;

  return {
    intent: top.id,
    answer: top.item.answer[lang] || top.item.answer.it,
    routes: localizzaWorldRoutes(top.item.routes, lang),
    confidence: Math.min(0.98, 0.62 + top.score / 30),
    worldAware: true,
  };
}

export const IKIGAI_WORLD_MAP = WORLD;
