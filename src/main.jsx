import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './socialify-responsive.css'
import './socialify-social-product.css'
import './mobile-shell.css'
import './dark-polish.css'
import './native-mobile.css'
import './socialify-desktop-hardfix.css'
import './socialify-tabs-fix.css'
import './reactive-experience.css'
import './mobile-nav-always.css'
import './apple-liquid-glass.css'
import './ikigai-visibility-fix.css'
import './mobile-profile-hero-fix.css'
import './light-mode-polish.css'
import './desktop-navbar-position-fix.css'
import './theme-parity-guard.css'
import './light-wow-parity.css'
import './navbar-glow-contour-fix.css'
import './light-mobile-final-fix.css'
import './ikigai-light-readability-final.css'
import './mobile-input-nozoom.css'
import './liquid-glass-v2.css'
import './mobile-experience-v2.css'
import './ikigai-mobile-morph.css'
import './ikigai-agency.css'
import './geometric-liquid-glass.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setInterval(() => { try { reg.update(); } catch { } }, 60_000);
      const onNewSW = (sw) => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('swUpdate', { detail: { registration: reg } }));
        }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('swUpdate', { detail: { registration: reg } }));
          }
        });
      };
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', () => { if (reg.installing) onNewSW(reg.installing); });
    }).catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
