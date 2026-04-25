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

const SELETTORI_PANNELLI = '.glass-panel, .glass-card, aside, section';

function contieneLegacy(el) {
  const testo = el?.textContent || '';
  return TESTI_LEGACY.some(x => testo.includes(x));
}

function rimuoviBlocchiLegacy() {
  if (typeof document === 'undefined') return 0;

  let rimossi = 0;
  const candidati = Array.from(document.querySelectorAll(SELETTORI_PANNELLI));

  for (const el of candidati) {
    if (!contieneLegacy(el)) continue;
    if (el === document.body || el.classList?.contains('app-container')) continue;
    el.remove();
    rimossi += 1;
  }

  return rimossi;
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
    let annullato = false;
    let timer = 0;
    let observer = null;
    const start = Date.now();

    const ciclo = () => {
      if (annullato) return;
      rimuoviBlocchiLegacy();
      if (Date.now() - start > 8000) return;
      timer = window.setTimeout(ciclo, 180);
    };

    ciclo();

    try {
      observer = new MutationObserver(() => {
        if (!annullato) rimuoviBlocchiLegacy();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => observer?.disconnect(), 8000);
    } catch {
      observer = null;
    }

    return () => {
      annullato = true;
      if (timer) window.clearTimeout(timer);
      observer?.disconnect();
      if (typeof ripristinaNotifiche === 'function') ripristinaNotifiche();
    };
  }, [location.pathname]);

  return null;
}
