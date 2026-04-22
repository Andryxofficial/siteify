/* ─────────────────────────────────────────────────────────
   Pagine lazy + prefetch
   ─────────────────────────────────────────────────────────
   Ogni pagina è caricata con React.lazy() per mantenere il
   bundle iniziale leggero. Tuttavia, mostriamo SEMPRE uno
   skeleton di Suspense la prima volta che si naviga in una
   sezione → l'app sembra "caricare" ad ogni cambio di tab.

   Soluzione: esportare anche le funzioni di import() così da
   poter PREFETCHARE i chunk on-demand (hover/focus sul link
   in navbar) e in idle dopo il primo render. Quando l'utente
   clicca, il chunk è già in cache → niente skeleton.
   ───────────────────────────────────────────────────────── */
import { lazy } from 'react';

/* Loader functions — riusabili sia da React.lazy() sia per il prefetch */
const loaders = {
  '/twitch':       () => import('./pages/TwitchPage'),
  '/youtube':      () => import('./pages/YouTubePage'),
  '/instagram':    () => import('./pages/InstagramPage'),
  '/podcast':      () => import('./pages/PodcastPage'),
  '/tiktok':       () => import('./pages/TikTokPage'),
  '/gioco':        () => import('./pages/GamePage'),
  '/socialify':    () => import('./pages/CommunityPage'),
  '/socialify/:postId': () => import('./components/ThreadView'),
  '/scoiattoli':   () => import('./pages/tracker_scoiattoli'),
  '/mod-panel':    () => import('./pages/ModPanel'),
  '/amici':        () => import('./pages/FriendsPage'),
  '/messaggi':     () => import('./pages/MessagesPage'),
  '/chat':         () => import('./pages/ChatGeneralePage'),
  '/impostazioni': () => import('./pages/SettingsPage'),
  '/profilo/:username': () => import('./pages/ProfiloPage'),
  '/app':          () => import('./pages/AppPage'),
};

/* Componenti lazy — uno per route */
export const TwitchPage    = lazy(loaders['/twitch']);
export const YouTubePage   = lazy(loaders['/youtube']);
export const InstagramPage = lazy(loaders['/instagram']);
export const PodcastPage   = lazy(loaders['/podcast']);
export const TikTokPage    = lazy(loaders['/tiktok']);
export const GamePage      = lazy(loaders['/gioco']);
export const CommunityPage = lazy(loaders['/socialify']);
export const ThreadView    = lazy(loaders['/socialify/:postId']);
export const Scoiattoli    = lazy(loaders['/scoiattoli']);
export const ModPanel      = lazy(loaders['/mod-panel']);
export const FriendsPage   = lazy(loaders['/amici']);
export const MessagesPage  = lazy(loaders['/messaggi']);
export const ChatGeneralePage = lazy(loaders['/chat']);
export const SettingsPage  = lazy(loaders['/impostazioni']);
export const ProfiloPage   = lazy(loaders['/profilo/:username']);
export const AppPage       = lazy(loaders['/app']);

/* Cache delle Promise: import() è già idempotente lato bundler, ma
   tracciamo qui i percorsi già richiesti per evitare lavoro inutile */
const paginePrefetchate = new Set();

/* Prefetcha il chunk di una route. Sicuro da chiamare più volte. */
export function prefetchPagina(path) {
  if (!path || paginePrefetchate.has(path)) return;
  const loader = loaders[path];
  if (!loader) return;
  paginePrefetchate.add(path);
  // Ignora errori di rete: il prefetch è best-effort; il caricamento
  // reale al click ritenterà e mostrerà l'errore se necessario.
  loader().catch(() => paginePrefetchate.delete(path));
}

/* Prefetcha in background tutte le pagine principali della navbar,
   con priorità bassa (requestIdleCallback con fallback a setTimeout). */
export function prefetchPagineMain() {
  const principali = ['/socialify', '/twitch', '/youtube', '/instagram', '/podcast', '/tiktok', '/gioco', '/chat', '/impostazioni'];
  const eseguiPrefetch = () => { principali.forEach(prefetchPagina); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(eseguiPrefetch, { timeout: 2000 });
  } else {
    setTimeout(eseguiPrefetch, 600);
  }
}
