/**
 * scripts/stamp-sw.js
 *
 * Replaces the __BUILD_TIMESTAMP__ placeholder in dist/sw.js with the current
 * Unix timestamp. This runs as a post-build step so every Vercel deployment
 * produces a unique SW cache name, automatically evicting stale caches.
 *
 * Invoked via: "build": "vite build && node scripts/stamp-sw.js"
 */
import fs from 'fs';
import path from 'path';

const swPath = path.resolve(process.cwd(), 'dist/sw.js');

if (!fs.existsSync(swPath)) {
  console.warn('[stamp-sw] dist/sw.js not found — skipping.');
  process.exit(0);
}

const content = fs.readFileSync(swPath, 'utf-8');
const ts = Date.now().toString();
const stamped = content.replaceAll('__BUILD_TIMESTAMP__', ts);

if (stamped === content) {
  console.warn('[stamp-sw] Placeholder __BUILD_TIMESTAMP__ not found in dist/sw.js — already stamped or missing.');
} else {
  fs.writeFileSync(swPath, stamped);
  console.log(`[stamp-sw] Stamped dist/sw.js with build timestamp: ${ts}`);
}
