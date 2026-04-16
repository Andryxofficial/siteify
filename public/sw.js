// ANDRYXify Service Worker — Cache-first for static assets
const CACHE_NAME = 'andryxify-v1';

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

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation, cache-first for same-origin static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (except Google Fonts)
  if (request.method !== 'GET') return;

  // Google Fonts — cache-first (90 days)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open('andryxify-fonts').then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Same-origin assets (JS/CSS/PNG/SVG) — cache-first
  if (url.origin === self.location.origin && request.destination !== 'document') {
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

  // HTML navigation — network-first, fall back to cached '/'
  if (request.destination === 'document' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r || fetch(request))
      )
    );
  }
});
