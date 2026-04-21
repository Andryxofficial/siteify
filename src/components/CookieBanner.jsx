/**
 * CookieBanner — Banner cookie GDPR minimalista, glass, bottom-left.
 *
 * Appare solo al primo ingresso (localStorage). Sparisce dopo la scelta.
 * Non troppo grande, super responsivo e fluido con Framer Motion.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Check } from 'lucide-react';

const CHIAVE_STORAGE = 'andryx_cookie_consent';
// Ritardo prima della comparsa: lascia caricare la pagina senza interferire
const RITARDO_BANNER_MS = 1400;

export default function CookieBanner() {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    const consenso = localStorage.getItem(CHIAVE_STORAGE);
    if (!consenso) {
      // Piccolo delay: prima carica la pagina, poi appare il banner
      const t = setTimeout(() => setVisibile(true), RITARDO_BANNER_MS);
      return () => clearTimeout(t);
    }
  }, []);

  const chiudi = (scelta) => {
    localStorage.setItem(CHIAVE_STORAGE, scelta);
    setVisibile(false);
  };

  return (
    <AnimatePresence>
      {visibile && (
        <motion.div
          className="cookie-banner"
          role="dialog"
          aria-label="Consenso cookie"
          aria-modal="false"
          initial={{ opacity: 0, x: -24, y: 16 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -24, y: 16, transition: { duration: 0.22 } }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
        >
          {/* Speculare vetro */}
          <span className="cookie-speculare" aria-hidden="true" />

          <div className="cookie-header">
            <span className="cookie-icona" aria-hidden="true">
              <Cookie size={15} />
            </span>
            <span className="cookie-titolo">Cookie & Privacy</span>
            <button
              className="cookie-chiudi"
              onClick={() => chiudi('rifiutato')}
              aria-label="Chiudi banner cookie"
            >
              <X size={11} />
            </button>
          </div>

          <p className="cookie-testo">
            Usiamo cookie tecnici essenziali per far funzionare il sito.
            Nessun dato venduto a terzi.
          </p>

          <div className="cookie-azioni">
            <button
              className="cookie-btn cookie-btn-rifiuta"
              onClick={() => chiudi('rifiutato')}
            >
              Rifiuta
            </button>
            <button
              className="cookie-btn cookie-btn-accetta"
              onClick={() => chiudi('accettato')}
            >
              <Check size={11} /> Accetta
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
