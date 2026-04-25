import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TESTI_LEGACY = [
  'Tendenze Neurali',
  'Evoluzione Organica',
  'interazioni cellulari',
  'picchi sinaptici',
  'Stato di Singolarità',
  "L'ecosistema sta imparando",
  'ecosistema sta imparando',
];

function contieneLegacy(el) {
  const testo = el?.textContent || '';
  return TESTI_LEGACY.some(x => testo.includes(x));
}

function pannelloDaRimuovere(el) {
  return (
    el.closest?.('.glass-panel') ||
    el.closest?.('.glass-card') ||
    el.closest?.('[class*="sidebar"]') ||
    el.closest?.('aside') ||
    el.closest?.('section') ||
    el.closest?.('div')
  );
}

function rimuoviBlocchiLegacy() {
  if (typeof document === 'undefined') return;
  const candidati = Array.from(document.querySelectorAll('body *'));
  const rimossi = new Set();

  for (const el of candidati) {
    if (!contieneLegacy(el)) continue;
    const target = pannelloDaRimuovere(el);
    if (!target || target === document.body || rimossi.has(target)) continue;
    target.remove();
    rimossi.add(target);
  }
}

function bloccaNotificheLegacy() {
  if (typeof window === 'undefined') return undefined;
  const OriginalNotification = window.Notification;
  if (!OriginalNotification || OriginalNotification.__andryxLegacyGuard) return undefined;

  function NotificationFiltrata(title, options = {}) {
    const corpo = `${title || ''} ${options?.body || ''}`;
    if (TESTI_LEGACY.some(x => corpo.includes(x))) return null;
    return new OriginalNotification(title, options);
  }

  try {
    Object.setPrototypeOf(NotificationFiltrata, OriginalNotification);
    NotificationFiltrata.prototype = OriginalNotification.prototype;
    Object.defineProperty(NotificationFiltrata, 'permission', { get: () => OriginalNotification.permission });
    Object.defineProperty(NotificationFiltrata, 'maxActions', { get: () => OriginalNotification.maxActions });
    NotificationFiltrata.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
    NotificationFiltrata.__andryxLegacyGuard = true;
    window.Notification = NotificationFiltrata;
    return () => { window.Notification = OriginalNotification; };
  } catch {
    return undefined;
  }
}

export default function LegacySocialifyPurge() {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith('/socialify')) return undefined;

    const ripristinaNotifiche = bloccaNotificheLegacy();
    rimuoviBlocchiLegacy();

    const observer = new MutationObserver(() => rimuoviBlocchiLegacy());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const timer = window.setInterval(rimuoviBlocchiLegacy, 900);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      if (typeof ripristinaNotifiche === 'function') ripristinaNotifiche();
    };
  }, [location.pathname]);

  return null;
}
