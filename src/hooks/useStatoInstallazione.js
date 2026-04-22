/**
 * useStatoInstallazione
 *
 * Espone:
 *   - puoIstallare       true se è disponibile il prompt nativo Android/Chromium
 *     oppure se siamo su iOS Safari (dove serve la guida manuale)
 *   - piattaforma        'beforeinstallprompt' | 'ios-safari' | 'standalone' | 'altro'
 *   - giàInstallata      true se già in modalità standalone
 *   - mostraPrompt()     mostra il prompt nativo se disponibile, ritorna 'accepted'|'dismissed'|null
 *   - rimanda()          segna l'utente come "non ora" (ricomparirà fra X giorni)
 *   - rifiuta()          segna l'utente come "non chiedere più"
 *   - puoMostrareCard    true se non è installata, non è stata rifiutata e l'attesa è scaduta
 *
 * Stato persistente in localStorage (chiave `andryxify_installa_stato`):
 *   { decisione: 'rimandato'|'rifiutato'|'installato', timestamp: ms }
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

const CHIAVE = 'andryxify_installa_stato';
/* Ricompare fra 7 giorni dopo "rimanda". */
const ATTESA_RIMANDO_MS = 7 * 24 * 60 * 60 * 1000;

function leggiStato() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHIAVE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function salvaStato(decisione) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ decisione, timestamp: Date.now() }));
  } catch { /* quota piena */ }
}

function rilevaStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function rilevaIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPhone/iPad/iPod, escluso webview di app già native (CriOS=Chrome iOS, FxiOS=Firefox iOS, etc.)
  const èIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!èIOS) return false;
  const èSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line|TikTok/i.test(ua);
  return èSafari;
}

export default function useStatoInstallazione() {
  const [evento, setEvento]                 = useState(null);
  const [standalone, setStandalone]         = useState(rilevaStandalone);
  const [stato, setStato]                   = useState(leggiStato);
  const iosSafari = useMemo(() => rilevaIOSSafari(), []);

  /* Cattura beforeinstallprompt (Android/Chromium/Edge). */
  useEffect(() => {
    const onBefore = (e) => {
      e.preventDefault();
      setEvento(e);
    };
    const onInstalled = () => {
      salvaStato('installato');
      setStato({ decisione: 'installato', timestamp: Date.now() });
      setEvento(null);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* Sincronizza display-mode (utente potrebbe installare e tornare). */
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const h = (e) => setStandalone(e.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);

  const piattaforma = standalone
    ? 'standalone'
    : evento
      ? 'beforeinstallprompt'
      : iosSafari
        ? 'ios-safari'
        : 'altro';

  const puoIstallare = piattaforma === 'beforeinstallprompt' || piattaforma === 'ios-safari';

  /* Determina se è il momento giusto per proporre la card.
     Calcoliamo via useMemo con un "tick" che avanza al timer di rimando,
     così evitiamo setState dentro un effect derivato (anti-pattern). */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!stato || stato.decisione !== 'rimandato') return undefined;
    const restante = ATTESA_RIMANDO_MS - (Date.now() - (stato.timestamp || 0));
    if (restante <= 0) return undefined;
    const id = setTimeout(() => setTick((n) => n + 1), restante);
    return () => clearTimeout(id);
  }, [stato]);

  const puoMostrareCard = useMemo(() => {
    if (standalone) return false;
    if (!puoIstallare) return false;
    if (!stato) return true;
    if (stato.decisione === 'installato' || stato.decisione === 'rifiutato') return false;
    if (stato.decisione === 'rimandato') {
      return Date.now() - (stato.timestamp || 0) > ATTESA_RIMANDO_MS;
    }
    return true;
    // tick è incluso intenzionalmente per ricalcolare quando l'attesa scade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standalone, puoIstallare, stato, tick]);

  const mostraPrompt = useCallback(async () => {
    if (!evento) return null;
    try {
      evento.prompt();
      const scelta = await evento.userChoice;
      if (scelta?.outcome === 'accepted') {
        salvaStato('installato');
        setStato({ decisione: 'installato', timestamp: Date.now() });
      } else {
        salvaStato('rimandato');
        setStato({ decisione: 'rimandato', timestamp: Date.now() });
      }
      setEvento(null);
      return scelta?.outcome ?? null;
    } catch {
      return null;
    }
  }, [evento]);

  const rimanda = useCallback(() => {
    salvaStato('rimandato');
    setStato({ decisione: 'rimandato', timestamp: Date.now() });
  }, []);

  const rifiuta = useCallback(() => {
    salvaStato('rifiutato');
    setStato({ decisione: 'rifiutato', timestamp: Date.now() });
  }, []);

  return {
    piattaforma,
    puoIstallare,
    giàInstallata: standalone,
    puoMostrareCard,
    mostraPrompt,
    rimanda,
    rifiuta,
    statoSalvato: stato,
  };
}
