import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'ANDRYXify';
const BASE_URL = 'https://andryxify.it';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;
const DEFAULT_KEYWORDS = 'ANDRYXify, Andrea Taliento, streamer italiano, Twitch, gaming, intelligenza artificiale, podcast, YouTube, TikTok, Instagram, content creator, live streaming';

export default function SEO({
  title, description, path = '/', image = DEFAULT_IMAGE,
  type = 'website', keywords = '', jsonLd = null, noindex = false,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Streamer, Gaming & IA`;
  const url = `${BASE_URL}${path}`;
  const allKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="it_IT" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@andryxify" />
      <meta name="twitter:creator" content="@andryxify" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
