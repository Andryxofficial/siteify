export const BASE_URL = 'https://andryxify.it';
export const SITE_NAME = 'ANDRYXify';
export const PERSON_NAME = 'Andrea Taliento';
export const CREATOR_NAME = 'Andryx';
export const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;

export const SEO_ALIASES = [
  'Andrea Taliento',
  'Andrea',
  'Andryx',
  'ANDRYXify',
  'andryxify',
  'andryx098',
  'Andrea Genova',
  'Andrea Taliento Genova',
  'Andryx Genova',
  'ANDRYXify Genova',
];

export const SEO_TOPICS = [
  'Genova',
  'Liguria',
  'streaming',
  'streamer Twitch',
  'Twitch Italia',
  'streaming italiano',
  'YouTube Italia',
  'gaming italiano',
  'content creator italiano',
  'creator digitale',
  'videomaker',
  'fotografia',
  'podcast intelligenza artificiale',
  'intelligenza artificiale',
  'IA',
  'community online',
  'SOCIALify',
  'ANDRYXify community',
];

export const SAME_AS = [
  'https://twitch.tv/andryxify',
  'https://www.twitch.tv/andryxify',
  'https://youtube.com/@ANDRYXify',
  'https://www.youtube.com/@ANDRYXify',
  'https://instagram.com/andryxify',
  'https://www.instagram.com/andryxify',
  'https://tiktok.com/@andryxify',
  'https://www.tiktok.com/@andryxify',
  'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',
];

export const PUBLIC_PAGES = [
  { loc: '/', title: 'Andrea Taliento — Andryx da Genova', priority: '1.0', changefreq: 'daily', image: '/logo.png' },
  { loc: '/chi-sono', title: 'Chi è Andrea Taliento / Andryx', priority: '0.95', changefreq: 'monthly', image: '/logo.png' },
  { loc: '/twitch', title: 'Andryx su Twitch', priority: '0.95', changefreq: 'daily', image: '/logo.png' },
  { loc: '/youtube', title: 'ANDRYXify su YouTube', priority: '0.9', changefreq: 'weekly', image: '/logo.png' },
  { loc: '/instagram', title: 'ANDRYXify su Instagram', priority: '0.82', changefreq: 'weekly', image: '/logo.png' },
  { loc: '/tiktok', title: 'ANDRYXify su TikTok', priority: '0.82', changefreq: 'weekly', image: '/logo.png' },
  { loc: '/podcast', title: 'Podcast Umanità e IA', priority: '0.86', changefreq: 'weekly', image: '/logo.png' },
  { loc: '/gioco', title: 'Giochi ANDRYXify', priority: '0.84', changefreq: 'monthly', image: '/logo.png' },
  { loc: '/giochi', title: 'Giochi ANDRYXify', priority: '0.78', changefreq: 'monthly', image: '/logo.png' },
  { loc: '/socialify', title: 'SOCIALify community', priority: '0.9', changefreq: 'daily', image: '/logo.png' },
  { loc: '/socialify/info-tag', title: 'Tag intelligenti SOCIALify', priority: '0.72', changefreq: 'weekly', image: '/logo.png' },
  { loc: '/chat', title: 'Chat ANDRYXify', priority: '0.62', changefreq: 'daily', image: '/logo.png' },
  { loc: '/app', title: 'App ANDRYXify', priority: '0.58', changefreq: 'monthly', image: '/logo.png' },
  { loc: '/privacy', title: 'Privacy ANDRYXify e Ikigai', priority: '0.45', changefreq: 'monthly', image: '/logo.png' },
];

export function paroleChiave(extra = []) {
  return [...new Set([...SEO_ALIASES, ...SEO_TOPICS, ...extra])].join(', ');
}

export function urlAssoluto(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  const pulito = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${pulito === '/' ? '/' : pulito.replace(/\/$/, '')}`;
}

export function personaJsonLd() {
  return {
    '@type': 'Person',
    '@id': `${BASE_URL}/#andrea-taliento`,
    name: PERSON_NAME,
    givenName: 'Andrea',
    familyName: 'Taliento',
    alternateName: SEO_ALIASES,
    url: BASE_URL,
    image: DEFAULT_IMAGE,
    description: 'Andrea Taliento, noto online come Andryx / ANDRYXify: creator digitale e streamer Twitch da Genova, attivo su gaming, YouTube, community, podcast e intelligenza artificiale.',
    jobTitle: ['Content Creator', 'Streamer Twitch', 'Videomaker'],
    gender: 'Male',
    nationality: 'Italian',
    birthPlace: { '@type': 'Place', name: 'Genova', address: { '@type': 'PostalAddress', addressLocality: 'Genova', addressRegion: 'Liguria', addressCountry: 'IT' } },
    homeLocation: { '@type': 'Place', name: 'Genova, Liguria, Italia' },
    knowsAbout: ['Twitch', 'YouTube', 'Streaming', 'Gaming', 'Intelligenza Artificiale', 'Podcast', 'Videomaking', 'Fotografia', 'Community online'],
    sameAs: SAME_AS,
  };
}

export function sitoJsonLd() {
  return {
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: SITE_NAME,
    alternateName: ['Andryx', 'Andrea Taliento', 'ANDRYXify community', 'andryxify.it'],
    url: BASE_URL,
    inLanguage: ['it-IT', 'en', 'es'],
    publisher: { '@id': `${BASE_URL}/#andrea-taliento` },
    about: { '@id': `${BASE_URL}/#andrea-taliento` },
    keywords: paroleChiave(),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/socialify?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizzazioneJsonLd() {
  return {
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'ANDRYXify',
    url: BASE_URL,
    logo: DEFAULT_IMAGE,
    founder: { '@id': `${BASE_URL}/#andrea-taliento` },
    sameAs: SAME_AS,
  };
}
