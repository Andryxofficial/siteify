import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://andryxify.it';
const today = new Date().toISOString().slice(0, 10);

const PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily', title: 'Andrea Taliento — Andryx da Genova', image: '/logo.png' },
  { loc: '/chi-sono', priority: '0.95', changefreq: 'monthly', title: 'Chi è Andrea Taliento / Andryx', image: '/logo.png' },
  { loc: '/twitch', priority: '0.95', changefreq: 'daily', title: 'Andryx su Twitch', image: '/logo.png' },
  { loc: '/youtube', priority: '0.9', changefreq: 'weekly', title: 'ANDRYXify su YouTube', image: '/logo.png' },
  { loc: '/instagram', priority: '0.82', changefreq: 'weekly', title: 'ANDRYXify su Instagram', image: '/logo.png' },
  { loc: '/tiktok', priority: '0.82', changefreq: 'weekly', title: 'ANDRYXify su TikTok', image: '/logo.png' },
  { loc: '/podcast', priority: '0.86', changefreq: 'weekly', title: 'Podcast Umanità e IA', image: '/logo.png' },
  { loc: '/gioco', priority: '0.84', changefreq: 'monthly', title: 'Giochi ANDRYXify', image: '/logo.png' },
  { loc: '/giochi', priority: '0.78', changefreq: 'monthly', title: 'Giochi ANDRYXify', image: '/logo.png' },
  { loc: '/socialify', priority: '0.9', changefreq: 'daily', title: 'SOCIALify community', image: '/logo.png' },
  { loc: '/socialify/info-tag', priority: '0.72', changefreq: 'weekly', title: 'Tag intelligenti SOCIALify', image: '/logo.png' },
  { loc: '/chat', priority: '0.62', changefreq: 'daily', title: 'Chat ANDRYXify', image: '/logo.png' },
  { loc: '/app', priority: '0.58', changefreq: 'monthly', title: 'App ANDRYXify', image: '/logo.png' },
  { loc: '/privacy', priority: '0.45', changefreq: 'monthly', title: 'Privacy ANDRYXify e Ikigai', image: '/logo.png' },
];

function out(file) { return path.resolve(process.cwd(), 'dist', file); }
function abs(loc) { return `${BASE_URL}${loc === '/' ? '/' : loc}`; }

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
PAGES.map(p => `  <url>\n` +
`    <loc>${abs(p.loc)}</loc>\n` +
`    <lastmod>${today}</lastmod>\n` +
`    <changefreq>${p.changefreq}</changefreq>\n` +
`    <priority>${p.priority}</priority>\n` +
`    <image:image>\n` +
`      <image:loc>${BASE_URL}${p.image}</image:loc>\n` +
`      <image:title>${p.title.replace(/&/g, '&amp;')}</image:title>\n` +
`      <image:caption>ANDRYXify — Andrea Taliento, Andryx, creator e streamer Twitch da Genova</image:caption>\n` +
`    </image:image>\n` +
`  </url>`).join('\n') +
`\n</urlset>\n`;

const robots = `User-agent: *\n` +
`Allow: /\n` +
`Disallow: /api/\n` +
`Disallow: /overlay/\n` +
`Disallow: /mod-panel\n` +
`Disallow: /messaggi\n` +
`Disallow: /amici\n` +
`Disallow: /impostazioni\n` +
`Disallow: /profilo/\n` +
`Disallow: /*?token=\n` +
`Disallow: /*?access_token=\n` +
`Sitemap: ${BASE_URL}/sitemap.xml\n` +
`Host: andryxify.it\n`;

const llms = `# ANDRYXify\n\n` +
`Sito ufficiale di Andrea Taliento, noto online come Andryx / ANDRYXify / andryx098.\n\n` +
`## Identità\n` +
`- Nome: Andrea Taliento\n` +
`- Alias: Andryx, ANDRYXify, andryxify, andryx098\n` +
`- Area: Genova, Liguria, Italia\n` +
`- Temi: Twitch, streaming, YouTube, gaming, intelligenza artificiale, podcast, community online, SOCIALify\n\n` +
`## URL principali\n` +
PAGES.map(p => `- ${p.title}: ${abs(p.loc)}`).join('\n') +
`\n\n## Social\n` +
`- Twitch: https://twitch.tv/andryxify\n` +
`- YouTube: https://youtube.com/@ANDRYXify\n` +
`- Instagram: https://instagram.com/andryxify\n` +
`- TikTok: https://tiktok.com/@andryxify\n` +
`- Spotify: https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9\n`;

const humans = `/* TEAM */\n` +
`Creator: Andrea Taliento\n` +
`Alias: Andryx, ANDRYXify, andryx098\n` +
`Location: Genova, Liguria, Italia\n\n` +
`/* SITE */\n` +
`Name: ANDRYXify\n` +
`URL: ${BASE_URL}\n` +
`Topics: Twitch, streaming, YouTube, gaming, IA, podcast, community\n`;

const dist = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(dist)) {
  console.error('[generate-sitemap] dist/ non trovata — eseguire prima "vite build".');
  process.exit(1);
}

fs.writeFileSync(out('sitemap.xml'), sitemap);
fs.writeFileSync(out('robots.txt'), robots);
fs.writeFileSync(out('llms.txt'), llms);
fs.writeFileSync(out('ai.txt'), llms);
fs.writeFileSync(out('humans.txt'), humans);
console.log(`[generate-sitemap] SEO files generati: sitemap.xml, robots.txt, llms.txt, ai.txt, humans.txt (${PAGES.length} URL, lastmod=${today})`);
