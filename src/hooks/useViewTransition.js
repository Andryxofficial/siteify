/**
 * useViewTransition — wrapper opzionale per la View Transitions API
 * (document.startViewTransition). Quando supportata, fornisce
 * transizioni cross-fade native a livello di compositor del browser
 * — quelle vere "alla iOS" che nessun framework può eguagliare.
 *
 * Se la API non è supportata, la callback viene eseguita subito
 * (fallback al sistema esistente con Framer Motion).
 *
 * Esempio:
 *   const startTransition = useViewTransition();
 *   startTransition(() => navigate('/tiktok'));
 */
import { useCallback } from 'react';

export default function useViewTransition() {
  return useCallback((aggiorna) => {
    if (typeof document === 'undefined' || typeof aggiorna !== 'function') {
      aggiorna?.();
      return null;
    }
    if (typeof document.startViewTransition !== 'function') {
      aggiorna();
      return null;
    }
    try {
      return document.startViewTransition(() => {
        aggiorna();
      });
    } catch {
      aggiorna();
      return null;
    }
  }, []);
}
