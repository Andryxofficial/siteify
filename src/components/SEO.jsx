import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLingua } from '../contexts/LinguaContext';

const SITE_NAME = 'ANDRYXify';
const BASE_URL = 'https://andryxify.it';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;
const DEFAULT_IMAGE_ALT = 'ANDRYXify, sito ufficiale di Andrea Taliento: Andryx, streamer Twitch e creator digitale di Genova';
const DEFAULT_KEYWORDS = [
  'Andrea Taliento',
  'Andrea',
  'Andryx',
  'ANDRYXify',
  'andryxify',
  'andryx098',
  'Genova',
  'Liguria',
  'streamer Genova',
  'streamer Twitch Genova',
  'Twitch Italia',
  'streaming italiano',
  'live streaming',
  'gaming italiano',
  'content creator Genova',
  'creator digitale',
  'videomaker',
  'YouTube Italia',
  'TikTok Italia',
  'Instagram creator',
  'podcast intelligenza artificiale',
  'IA online',
  'gaming',
  'community online',
].join(', ');

/* Mappa lingua → locale Open Graph */
const OG_LOCALE = { it: 'it_IT', en: 'en_US', es: 'es_ES' };
const ABSOLUTE_URL_RE = /^https?:\/\//i;

function normalizzaPath(path) {
  if (!path || path === '/') return '/';
  const pulito = path.startsWith('/') ? path : `/${path}`;
  return pulito.length > 1 ? pulito.replace(/\/$/, '') : pulito;
}

function urlAssoluto(value, fallback = BASE_URL) {
  if (!value) return fallback;
  if (ABSOLUTE_URL_RE.test(value)) return value;
  return `${BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export default function SEO({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  imageAlt = DEFAULT_IMAGE_ALT,
  imageWidth = 512,
  imageHeight = 512,
  type = 'website',
  keywords = '',
  jsonLd = null,
  noindex = false,
  article = null,
}) {
  const { lingua } = useLingua();
  const cleanPath = normalizzaPath(path);
  const url = `${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`;
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Andrea Taliento, Andryx: streamer Twitch e creator da Genova`;
  const allKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;
  const desc = description || 'ANDRYXify è il sito ufficiale di Andrea Taliento, in arte Andryx: streamer Twitch, creator digitale, gaming, social e podcast da Genova.';
  const ogLocale = OG_LOCALE[lingua] || OG_LOCALE.it;
  const absoluteImage = urlAssoluto(image, DEFAULT_IMAGE);
  const robots = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const jsonLdItems = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  /*
   * Mantiene il titolo stabile anche se script legacy o widget provano a mutarlo.
   * È volutamente locale al componente SEO: non tocca giochi, router, auth o social.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (document.title !== fullTitle) document.title = fullTitle;

    const titleEl = document.querySelector('title');
    if (!titleEl || typeof MutationObserver === 'undefined') return undefined;

    const observer = new MutationObserver(() => {
      if (document.title !== fullTitle) document.title = fullTitle;
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [fullTitle]);

  return (
    <Helmet>
      <html lang={lingua} />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={allKeywords} />
      <meta name="author" content="Andrea Taliento (ANDRYXify / Andryx / andryx098)" />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="publisher" content="Andrea Taliento" />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="it" href={`${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`} />
      <link rel="alternate" hrefLang="en" href={`${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`} />
      <link rel="alternate" hrefLang="es" href={`${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`} />
      <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}${cleanPath === '/' ? '/' : cleanPath}`} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:secure_url" content={absoluteImage} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />

      {/* Article metadata (per pagine tipo post/thread) */}
      {article?.publishedTime && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@andryxify" />
      <meta name="twitter:creator" content="@andryxify" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {/* JSON-LD */}
      {jsonLdItems.map((item, index) => (
        <script key={`jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
