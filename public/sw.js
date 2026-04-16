// ANDRYXify Service Worker — auto-versioned on every build
// The __BUILD_TIMESTAMP__ placeholder is replaced by a Unix timestamp during `npm run build`.
const CACHE_NAME = 'andryxify-__BUILD_TIMESTAMP__';
const FONTS_CACHE = 'andryxify-fonts';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/logo.png',
  '/pwa-192.png',
  '/pwa-512.png',
  '/apple-touch-icon.png',
];

// Install: pre-cache key static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: remove ALL old caches (different CACHE_NAME = new deploy)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== FONTS_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ── API routes: always network, never cache ──────────────────────────────
  if (url.pathname.startsWith('/api/')) return;

  // ── Google Fonts: cache-first (long-lived) ───────────────────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Vite-hashed JS/CSS bundles (/assets/…): cache-first (safe, content-addressed) ──
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Static public assets (images, manifest, icons): cache-first ──────────
  if (
    url.origin === self.location.origin &&
    (request.destination === 'image' ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico'))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── HTML navigation: network-first, fall back to cached '/' ──────────────
  if (request.destination === 'document' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r || fetch(request))
      )
    );
  }
});
