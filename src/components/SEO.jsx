import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLingua } from '../contexts/LinguaContext';
import {
  BASE_URL,
  SITE_NAME,
  DEFAULT_IMAGE,
  paroleChiave,
  urlAssoluto,
  personaJsonLd,
  sitoJsonLd,
  organizzazioneJsonLd,
} from '../seo/andryxIdentity';

const DEFAULT_IMAGE_ALT = 'ANDRYXify, sito ufficiale di Andrea Taliento: Andryx, streamer Twitch e creator digitale di Genova';
const OG_LOCALE = { it: 'it_IT', en: 'en_US', es: 'es_ES' };

function normalizzaPath(path) {
  if (!path || path === '/') return '/';
  const pulito = path.startsWith('/') ? path : `/${path}`;
  return pulito.length > 1 ? pulito.replace(/\/$/, '') : pulito;
}

function paginaJsonLd({ url, fullTitle, desc, cleanPath, image }) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: fullTitle,
    description: desc,
    inLanguage: 'it-IT',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    about: { '@id': `${BASE_URL}/#andrea-taliento` },
    primaryImageOfPage: { '@type': 'ImageObject', url: image },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
        ...(cleanPath === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: fullTitle.replace(` | ${SITE_NAME}`, ''), item: url }]),
      ],
    },
  };
}

export default function SEO({
  title,
  description,
  path = '/',
  canonical,
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
  const cleanPath = normalizzaPath(canonical || path);
  const url = urlAssoluto(cleanPath);
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Andrea Taliento / Andryx da Genova: Twitch, YouTube, Gaming, IA`;
  const allKeywords = paroleChiave(keywords ? keywords.split(',').map(x => x.trim()).filter(Boolean) : []);
  const desc = description || 'Sito ufficiale di Andrea Taliento, in arte Andryx / ANDRYXify: creator digitale e streamer Twitch da Genova, tra gaming, YouTube, community, podcast e intelligenza artificiale.';
  const ogLocale = OG_LOCALE[lingua] || OG_LOCALE.it;
  const absoluteImage = urlAssoluto(image || DEFAULT_IMAGE);
  const robots = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const baseGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      personaJsonLd(),
      organizzazioneJsonLd(),
      sitoJsonLd(),
      paginaJsonLd({ url, fullTitle, desc, cleanPath, image: absoluteImage }),
    ],
  };
  const jsonLdItems = [baseGraph, ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [])];

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
      <html lang={lingua || 'it'} />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={allKeywords} />
      <meta name="author" content="Andrea Taliento (Andryx / ANDRYXify)" />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="publisher" content="Andrea Taliento" />
      <meta name="creator" content="Andrea Taliento" />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="bingbot" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="it" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="es" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

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

      {article?.publishedTime && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@andryxify" />
      <meta name="twitter:creator" content="@andryxify" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {jsonLdItems.map((item, index) => (
        <script key={`jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
