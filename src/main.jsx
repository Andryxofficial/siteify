import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './socialify-responsive.css'
import './mobile-shell.css'
import './dark-polish.css'
import './native-mobile.css'
import App from './App.jsx'

// Register service worker for PWA support + update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Poll for SW updates every 60 seconds
      setInterval(() => { try { reg.update(); } catch { /* silent */ } }, 60_000);

      // Detect new SW waiting / installing
      const onNewSW = (sw) => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          // A new SW is waiting — dispatch event so React can show toast
          window.dispatchEvent(new CustomEvent('swUpdate', { detail: { registration: reg } }));
        }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('swUpdate', { detail: { registration: reg } }));
          }
        });
      };
      // On initial page load: if a new SW is already waiting (from a previous deploy),
      // apply it silently so it doesn't pop up on every fresh page open.
      // The controllerchange handler in UpdateToast will reload the page once.
      if (reg.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      }
      // Mid-session updates (detected while the page is already active) → show toast
      reg.addEventListener('updatefound', () => { if (reg.installing) onNewSW(reg.installing); });
    }).catch(() => {/* silent */});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
