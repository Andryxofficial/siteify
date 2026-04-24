import { Helmet } from 'react-helmet-async';
import { useLingua } from '../contexts/LinguaContext';

const SITE_NAME = 'ANDRYXify';
const BASE_URL = 'https://andryxify.it';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;
const DEFAULT_KEYWORDS = 'andrea, andrea taliento, andryx, ANDRYXify, andryxify, andryx098, genova, streamer genova, twitch, twitch italia, social, youtube, youtube italia, gaming, intelligenza artificiale, ia online, podcast, content creator, live streaming, entità digitale';

/* Mappa lingua → locale Open Graph */
const OG_LOCALE = { it: 'it_IT', en: 'en_US', es: 'es_ES' };

export default function SEO({
  title, description, path = '/', image = DEFAULT_IMAGE,
  type = 'website', keywords = '', jsonLd = null, noindex = false,
  article = null,
}) {
  const { lingua } = useLingua();
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Streamer, Gaming & IA`;
  const url = `${BASE_URL}${path}`;
  const allKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;
  const desc = description || 'ANDRYXify — Streamer Twitch, gaming, IA e intrattenimento italiano.';
  const ogLocale = OG_LOCALE[lingua] || OG_LOCALE.it;

  return (
    <Helmet>
      <html lang={lingua} />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
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
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
