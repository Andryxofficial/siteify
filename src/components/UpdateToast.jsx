/**
 * UpdateToast — Shows a non-intrusive banner when a new version of the site
 * is available (service worker update detected). User taps to reload.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export default function UpdateToast() {
  const [show, setShow] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setRegistration(e.detail?.registration ?? null);
      setShow(true);
    };
    window.addEventListener('swUpdate', handler);
    return () => window.removeEventListener('swUpdate', handler);
  }, []);

  /* Also listen for controllerchange to auto-reload after the new SW activates */
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
    if (registration?.waiting) {
      registration.waiting.postMessage('SKIP_WAITING');
    } else {
      // Fallback: just reload
      window.location.reload();
    }
  }, [registration]);

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
