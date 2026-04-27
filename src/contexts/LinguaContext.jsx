/**
 * LinguaContext — gestisce la lingua dell'interfaccia.
 *
 * Modalità:
 *   'auto'  → segue la lingua del dispositivo (navigator.languages). Al cambio di
 *             lingua del dispositivo l'interfaccia si aggiorna automaticamente.
 *   'it' | 'en' | 'es' → forza una lingua specifica scelta dall'utente.
 *
 * Persistenza: `localStorage.andryxify_lingua` salva la **modalità**
 * ('auto' o un codice), non la lingua risolta. Così la preferenza dell'utente
 * viene rispettata se in futuro cambia il dispositivo o la lingua di sistema.
 *
 * Espone tramite useLingua():
 *   lingua        codice lingua risolto correntemente ('it' | 'en' | 'es')
 *   modalita      'auto' oppure un codice (scelta utente)
 *   setModalita   imposta la modalità (persiste e applica)
 *   t(chiave)     restituisce la traduzione nella lingua corrente;
 *                 fallback su italiano se manca, poi sulla chiave stessa
 *   lingueDisponibili  metadata per UI selettore (codice/nome/bandiera)
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  TRADUZIONI,
  LINGUE_DISPONIBILI,
  LINGUA_DEFAULT,
  rilevaLinguaDispositivo,
} from '../i18n/traduzioni';

const CHIAVE_STORAGE = 'andryxify_lingua';

/* In dev: logga una sola volta per chiave mancante, per non intasare la console */
const chiaviMancantiLoggate = new Set();

function applicaHtmlLang(codice) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', codice);
  }
}

/**
 * Risolve la modalità scelta in una lingua concreta.
 * 'auto' → rileva dal dispositivo; altrimenti usa il codice come lingua diretta.
 */
function risolviLingua(modalita) {
  if (modalita === 'auto' || !modalita) return rilevaLinguaDispositivo();
  if (TRADUZIONI[modalita]) return modalita;
  return LINGUA_DEFAULT;
}

const LinguaCtx = createContext({
  lingua:            LINGUA_DEFAULT,
  modalita:          'auto',
  setModalita:       () => {},
  t:                 (k) => k,
  lingueDisponibili: LINGUE_DISPONIBILI,
});

export function LinguaProvider({ children }) {
  const [modalita, setModalitaState] = useState(() => {
    if (typeof localStorage === 'undefined') return 'auto';
    return localStorage.getItem(CHIAVE_STORAGE) || 'auto';
  });
  const [lingua, setLingua] = useState(() => risolviLingua(modalita));

  /* Applica html[lang] al montaggio iniziale */
  useEffect(() => {
    applicaHtmlLang(lingua);
  }, [lingua]);

  /* Quando la modalità cambia, ricalcola la lingua corrente */
  useEffect(() => {
    setLingua(risolviLingua(modalita));
  }, [modalita]);

  /* In modalità auto: ascolta cambi di lingua del sistema.
     Purtroppo non esiste un evento standard per navigator.language;
     riduciamo il problema ri-leggendo navigator.languages al ritorno
     in foreground (visibilitychange) — molti browser aggiornano l'array
     dopo un cambio di impostazioni di sistema. */
  useEffect(() => {
    if (modalita !== 'auto') return;
    const ricontrolla = () => {
      if (document.hidden) return;
      const rilevata = rilevaLinguaDispositivo();
      setLingua((prev) => (prev === rilevata ? prev : rilevata));
    };
    document.addEventListener('visibilitychange', ricontrolla);
    window.addEventListener('languagechange', ricontrolla);
    return () => {
      document.removeEventListener('visibilitychange', ricontrolla);
      window.removeEventListener('languagechange', ricontrolla);
    };
  }, [modalita]);

  const setModalita = useCallback((nuova) => {
    try { localStorage.setItem(CHIAVE_STORAGE, nuova); } catch { /* ignore */ }
    setModalitaState(nuova);
  }, []);

  /**
   * t(chiave) — traduce una chiave nella lingua corrente.
   * Fallback: italiano → chiave grezza (con log in sviluppo).
   */
  const t = useCallback((chiave) => {
    const dizLingua = TRADUZIONI[lingua] || {};
    if (chiave in dizLingua) return dizLingua[chiave];
    const fallback = TRADUZIONI[LINGUA_DEFAULT]?.[chiave];
    if (fallback !== undefined) {
      if (import.meta.env?.DEV && !chiaviMancantiLoggate.has(`${lingua}:${chiave}`)) {
        chiaviMancantiLoggate.add(`${lingua}:${chiave}`);
        console.warn(`[i18n] Chiave "${chiave}" mancante per lingua "${lingua}", uso fallback "${LINGUA_DEFAULT}".`);
      }
      return fallback;
    }
    if (import.meta.env?.DEV && !chiaviMancantiLoggate.has(`missing:${chiave}`)) {
      chiaviMancantiLoggate.add(`missing:${chiave}`);
      console.warn(`[i18n] Chiave "${chiave}" non definita in nessuna lingua.`);
    }
    return chiave;
  }, [lingua]);

  return (
    <LinguaCtx.Provider value={{
      lingua,
      modalita,
      setModalita,
      t,
      lingueDisponibili: LINGUE_DISPONIBILI,
    }}>
      {children}
    </LinguaCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook esportato accanto al provider per comodita`
export const useLingua = () => useContext(LinguaCtx);
