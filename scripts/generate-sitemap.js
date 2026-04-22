/**
 * scripts/generate-sitemap.js
 *
 * Genera dist/sitemap.xml a build-time con `lastmod` aggiornato.
 * Include solo le pagine pubbliche del sito; le pagine private (messaggi,
 * amici, impostazioni, profilo, overlay, mod-panel, scoiattoli) restano
 * disallow nel robots.txt e fuori dalla sitemap.
 *
 * Invocato come step post-build: "build": "vite build && node scripts/stamp-sw.js && node scripts/generate-sitemap.js"
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://andryxify.it';

// Pagine pubbliche con priority + changefreq.
// L'ordine determina l'ordine nella sitemap.
const PAGES = [
  { loc: '/',          priority: '1.0', changefreq: 'daily'   },
  { loc: '/chi-sono',  priority: '0.9', changefreq: 'monthly' },
  { loc: '/twitch',    priority: '0.9', changefreq: 'daily'   },
  { loc: '/youtube',   priority: '0.8', changefreq: 'weekly'  },
  { loc: '/podcast',   priority: '0.8', changefreq: 'weekly'  },
  { loc: '/instagram', priority: '0.7', changefreq: 'weekly'  },
  { loc: '/tiktok',    priority: '0.7', changefreq: 'weekly'  },
  { loc: '/gioco',     priority: '0.8', changefreq: 'monthly' },
  { loc: '/socialify', priority: '0.8', changefreq: 'daily'   },
  { loc: '/chat',      priority: '0.6', changefreq: 'daily'   },
  { loc: '/app',       priority: '0.5', changefreq: 'monthly' },
];

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  PAGES.map(p =>
    `  <url>\n` +
    `    <loc>${BASE_URL}${p.loc}</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${p.changefreq}</changefreq>\n` +
    `    <priority>${p.priority}</priority>\n` +
    `  </url>`
  ).join('\n') +
  `\n</urlset>\n`;

const outPath = path.resolve(process.cwd(), 'dist/sitemap.xml');
const outDir = path.dirname(outPath);

if (!fs.existsSync(outDir)) {
  console.error('[generate-sitemap] dist/ non trovata — eseguire prima "vite build".');
  process.exit(1);
}

fs.writeFileSync(outPath, xml);
console.log(`[generate-sitemap] dist/sitemap.xml generato con lastmod=${today} (${PAGES.length} URL)`);
