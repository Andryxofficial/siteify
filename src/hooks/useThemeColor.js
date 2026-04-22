/**
 * useThemeColor — applica un colore alla meta theme-color in modo dinamico,
 * così la status bar in PWA standalone (e su Android Chrome) cambia colore
 * in base alla pagina o al contesto. Effetto "app-aware" molto nativo.
 *
 * Usage:
 *   useThemeColor('#9146FF');           // forza viola (es. /twitch)
 *   useThemeColor('#FF0000');           // rosso (es. /youtube)
 *
 * Su unmount ripristina il colore originale.
 *
 * Rispetta automaticamente prefers-color-scheme: aggiorna anche le meta
 * specifiche (light/dark) se presenti, altrimenti aggiorna quella generica.
 */
import { useEffect } from 'react';

function getMetaTags() {
  const tags = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  return tags.length > 0 ? tags : null;
}

export default function useThemeColor(colore) {
  useEffect(() => {
    if (!colore || typeof document === 'undefined') return undefined;

    const meta = getMetaTags();
    let creato = null;
    let originali = [];

    if (meta) {
      // Salva i valori originali per ripristinarli
      originali = meta.map((m) => ({
        el: m,
        value: m.getAttribute('content'),
        media: m.getAttribute('media'),
      }));
      // Aggiorna tutte le varianti (light, dark, default) con lo stesso colore
      meta.forEach((m) => m.setAttribute('content', colore));
    } else {
      // Nessuna meta presente — la creiamo
      creato = document.createElement('meta');
      creato.setAttribute('name', 'theme-color');
      creato.setAttribute('content', colore);
      document.head.appendChild(creato);
    }

    return () => {
      if (creato && creato.parentNode) creato.parentNode.removeChild(creato);
      originali.forEach(({ el, value }) => {
        if (value === null) el.removeAttribute('content');
        else el.setAttribute('content', value);
      });
    };
  }, [colore]);
}
