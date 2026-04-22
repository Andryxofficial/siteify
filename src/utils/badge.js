/**
 * Wrapper per la Badging API (navigator.setAppBadge).
 *
 * Mostra il pallino numerato sull'icona della PWA installata, esattamente
 * come fanno le app native. Funziona su Chrome/Edge desktop e Android in PWA;
 * Safari iOS supporta solo dopo "Aggiungi a Home + permesso notifiche".
 *
 * Silente su browser non supportati.
 */

export function impostaBadge(numero) {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.setAppBadge !== 'function') return;
  try {
    if (typeof numero === 'number' && numero > 0) {
      navigator.setAppBadge(numero).catch(() => { /* silente */ });
    } else {
      navigator.setAppBadge().catch(() => { /* silente */ });
    }
  } catch { /* silente */ }
}

export function pulisciBadge() {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.clearAppBadge !== 'function') return;
  try { navigator.clearAppBadge().catch(() => {}); } catch { /* silente */ }
}

/**
 * Imposta il badge con un numero, oppure lo pulisce se 0/falsy.
 * Comodo per "non letti": setBadge(unread).
 */
export function setBadge(numero) {
  if (numero && Number(numero) > 0) impostaBadge(Number(numero));
  else pulisciBadge();
}
