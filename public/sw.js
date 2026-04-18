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

// ── Push notifications (SOCIALify) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { titolo: 'SOCIALify', corpo: 'Nuovo aggiornamento!', url: '/socialify' };
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch { /* fallback ai dati predefiniti */ }

  event.waitUntil(
    self.registration.showNotification(data.titolo, {
      body: data.corpo,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag || 'socialify',
      data: { url: data.url || '/socialify' },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/socialify';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se c'è già una finestra aperta, focalizzala e naviga
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Altrimenti apri una nuova finestra
      return clients.openWindow(url);
    })
  );
});
