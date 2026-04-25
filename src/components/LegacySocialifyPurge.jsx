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
  const pannello = el.closest?.('.glass-panel, .glass-card, aside, section');
  if (!pannello || pannello === document.body) return null;
  return pannello;
}

function rimuoviBlocchiLegacy() {
  if (typeof document === 'undefined') return;

  const selettori = [
    '.glass-panel',
    '.glass-card',
    'aside',
    'section',
  ].join(',');

  const candidati = Array.from(document.querySelectorAll(selettori));
  for (const el of candidati) {
    if (!contieneLegacy(el)) continue;
    const target = pannelloDaRimuovere(el);
    if (target) target.remove();
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
    let annullato = false;
    let raf = 0;
    let tentativi = 0;

    const cicloLeggero = () => {
      if (annullato || tentativi >= 8) return;
      tentativi += 1;
      rimuoviBlocchiLegacy();
      raf = window.requestAnimationFrame(cicloLeggero);
    };

    raf = window.requestAnimationFrame(cicloLeggero);

    return () => {
      annullato = true;
      if (raf) window.cancelAnimationFrame(raf);
      if (typeof ripristinaNotifiche === 'function') ripristinaNotifiche();
    };
  }, [location.pathname]);

  return null;
}
