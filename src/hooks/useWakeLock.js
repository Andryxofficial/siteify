/**
 * useWakeLock — tiene lo schermo acceso durante una sessione attiva
 * (es. partita ai giochi). Si basa sulla Wake Lock API (Chromium/Safari 16.4+).
 *
 * Usage:
 *   useWakeLock(gameStatus === 'playing');
 *
 * Si re-acquisisce automaticamente quando la tab torna in foreground
 * (visibilitychange), perché il browser rilascia il lock al blur.
 *
 * Silente su browser non supportati o se l'utente nega.
 */
import { useEffect } from 'react';

export default function useWakeLock(attivo) {
  useEffect(() => {
    if (!attivo) return undefined;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;

    let lock = null;
    let smontato = false;

    const acquisisci = async () => {
      if (smontato) return;
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        // Se viene rilasciato dall'OS (es. screen-off), il listener riprova quando torna visibile.
        lock.addEventListener?.('release', () => { lock = null; });
      } catch { /* silente: utente ha negato o batteria bassa */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !lock) acquisisci();
    };
    document.addEventListener('visibilitychange', onVisibility);

    acquisisci();

    return () => {
      smontato = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { lock?.release?.(); } catch { /* silente */ }
      lock = null;
    };
  }, [attivo]);
}
