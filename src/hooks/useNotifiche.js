import { useState, useCallback } from 'react';

/**
 * Hook per gestire le notifiche push nel browser.
 * Utilizza la Notification API nativa — nessuna dipendenza esterna.
 *
 * Salva la preferenza in localStorage per ricordare la scelta dell'utente.
 */
const CHIAVE_STORAGE = 'andryxify_notifiche';

function leggiStatoIniziale() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  const salvato = localStorage.getItem(CHIAVE_STORAGE);
  return salvato === 'attivo' && Notification.permission === 'granted';
}

export function useNotifiche() {
  const supportato = typeof window !== 'undefined' && 'Notification' in window;
  const [attivo, setAttivo] = useState(leggiStatoIniziale);

  const attiva = useCallback(async () => {
    if (!supportato) return;
    try {
      const permesso = await Notification.requestPermission();
      if (permesso === 'granted') {
        setAttivo(true);
        localStorage.setItem(CHIAVE_STORAGE, 'attivo');
        // Mostra una notifica di conferma
        new Notification('SOCIALify — Notifiche attive 🔔', {
          body: 'Riceverai avvisi per nuove risposte e interazioni.',
          icon: '/pwa-192.png',
          badge: '/pwa-192.png',
          tag: 'socialify-benvenuto',
        });
      }
    } catch { /* l'utente ha rifiutato */ }
  }, [supportato]);

  const disattiva = useCallback(() => {
    setAttivo(false);
    localStorage.setItem(CHIAVE_STORAGE, 'disattivo');
  }, []);

  /**
   * Invia una notifica locale (se le notifiche sono attive).
   * Da chiamare quando arriva una risposta, un mi piace, ecc.
   */
  const invia = useCallback((titolo, opzioni = {}) => {
    if (!attivo || !supportato || Notification.permission !== 'granted') return;
    try {
      new Notification(titolo, {
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        ...opzioni,
      });
    } catch { /* silenzioso su errore */ }
  }, [attivo, supportato]);

  return { supportato, attivo, attiva, disattiva, invia };
}
