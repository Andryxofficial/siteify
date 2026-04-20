/**
 * UpdateToast — Mostra un banner non intrusivo quando è disponibile una nuova
 * versione del sito (service worker update rilevato). L'utente può cliccare
 * per ricaricare, oppure l'aggiornamento viene applicato automaticamente:
 *  • appena la tab passa in background (visibilitychange → hidden), oppure
 *  • dopo un timeout di sicurezza (AUTO_APPLY_DELAY_MS).
 * In entrambi i casi il reload avviene silenzioso via il listener
 * `controllerchange` mentre l'utente non sta guardando.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

// Dopo questo tempo dalla comparsa del toast, l'update viene applicato
// automaticamente anche se la tab resta in primo piano.
const AUTO_APPLY_DELAY_MS = 5 * 60 * 1000;

export default function UpdateToast() {
  const [show, setShow] = useState(false);
  const [registration, setRegistration] = useState(null);
  const autoApplyTimerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      setRegistration(e.detail?.registration ?? null);
      setShow(true);
    };
    window.addEventListener('swUpdate', handler);
    return () => window.removeEventListener('swUpdate', handler);
  }, []);

  /* Ascolta controllerchange per ricaricare automaticamente quando il nuovo SW attiva */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const applyUpdate = useCallback(() => {
    // Cancella eventuale timer di auto-apply: l'update sta partendo ora
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    if (registration?.waiting) {
      registration.waiting.postMessage('SKIP_WAITING');
    } else {
      // Fallback: ricarica direttamente
      window.location.reload();
    }
  }, [registration]);

  /* Auto-flush: applica l'update quando la tab passa in background o dopo timeout.
     Così l'utente non viene mai interrotto a metà di un'azione. */
  useEffect(() => {
    if (!show || !registration?.waiting) return;

    let applicato = false;
    const flush = () => {
      if (applicato) return;
      applicato = true;
      // Cancella il timer di backup: stiamo già applicando ora
      if (autoApplyTimerRef.current) {
        clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = null;
      }
      try { registration.waiting?.postMessage('SKIP_WAITING'); } catch { /* silent */ }
    };

    const onVisibility = () => {
      if (document.hidden) flush();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Timer di sicurezza: anche se l'utente resta sulla pagina, applichiamo
    // l'update dopo AUTO_APPLY_DELAY_MS per garantire la freschezza.
    autoApplyTimerRef.current = setTimeout(flush, AUTO_APPLY_DELAY_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (autoApplyTimerRef.current) {
        clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = null;
      }
    };
  }, [show, registration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          onClick={applyUpdate}
          className="update-toast"
          aria-label="Aggiorna alla nuova versione"
        >
          <RefreshCw size={15} className="update-toast-icon" />
          <span>Nuova versione disponibile — tocca per aggiornare</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
