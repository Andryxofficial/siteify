import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'ANDRYXify';
const BASE_URL = 'https://andryxify.it';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;
const DEFAULT_KEYWORDS = 'ANDRYXify, Andrea Taliento, streamer italiano, Twitch, gaming, intelligenza artificiale, podcast, YouTube, TikTok, Instagram, content creator, live streaming';

export default function SEO({
  title, description, path = '/', image = DEFAULT_IMAGE,
  type = 'website', keywords = '', jsonLd = null, noindex = false,
  article = null,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Streamer, Gaming & IA`;
  const url = `${BASE_URL}${path}`;
  const allKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;
  const desc = description || 'ANDRYXify — Streamer Twitch, gaming, IA e intrattenimento italiano.';

  return (
    <Helmet>
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
      <meta property="og:locale" content="it_IT" />

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
