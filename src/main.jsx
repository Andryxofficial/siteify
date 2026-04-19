import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
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
      if (reg.waiting) onNewSW(reg.waiting);
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
