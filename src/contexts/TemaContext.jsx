/**
 * TemaContext — stato chiaro/scuro/auto/alba-tramonto condiviso fra Navbar e SettingsPage.
 *
 * Modalità supportate:
 *   'auto'          segue la preferenza di sistema (prefers-color-scheme)
 *   'alba-tramonto' chiaro tra alba e tramonto, scuro altrimenti
 *                   (usa coordinate geografiche se disponibili, altrimenti Roma)
 *   'chiaro'        forzato chiaro
 *   'scuro'         forzato scuro
 *
 * Espone:
 *   modalita        modalità corrente
 *   setModalita(m)  imposta modalità (e gestisce permesso geolocazione per alba-tramonto)
 *   cicla()         ruota auto → alba-tramonto → chiaro → scuro → auto
 *   coordsRichieste true se la modalità alba-tramonto è attiva ma le coordinate non sono ancora state ottenute
 *   richiediCoords()  prova a ottenere la posizione GPS dell'utente
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { inOreDiLuce } from '../utils/sole';

const CHIAVE_MODALITA = 'andryxify_tema_modalita';
const CHIAVE_COORDS   = 'andryxify_tema_coords';
const SEQUENZA        = ['auto', 'alba-tramonto', 'chiaro', 'scuro'];

/* Ricontrolla se è "ora di luce" almeno ogni 10 minuti. Sufficiente per
   rilevare il passaggio attraverso alba/tramonto senza sprecare cicli. */
const INTERVALLO_RICONTROLLO_MS = 10 * 60 * 1000;

/* Privacy: arrotondiamo le coordinate a 1 decimale (~11 km di precisione)
   prima di salvarle in localStorage. Sufficiente per calcolare alba/tramonto
   al minuto, ma rimuove la geolocalizzazione precisa dell'utente. */
function arrotondaCoords(c) {
  return {
    lat: Math.round(c.lat * 10) / 10,
    lon: Math.round(c.lon * 10) / 10,
  };
}

function leggiCoordsSalvate() {
  try {
    const raw = localStorage.getItem(CHIAVE_COORDS);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (typeof c?.lat === 'number' && typeof c?.lon === 'number') return c;
  } catch { /* ignore */ }
  return null;
}

/**
 * Calcola se il tema deve essere chiaro, dato modalità + sistema + coordinate.
 */
function devEsserChiaro(modalita, sistemaChiaro, coords) {
  if (modalita === 'chiaro') return true;
  if (modalita === 'scuro')  return false;
  if (modalita === 'auto')   return sistemaChiaro;
  if (modalita === 'alba-tramonto') {
    return inOreDiLuce(new Date(), coords?.lat, coords?.lon);
  }
  return sistemaChiaro;
}

function applicaTema(chiaro) {
  const html = document.documentElement;
  if (chiaro) html.setAttribute('data-tema', 'chiaro');
  else        html.removeAttribute('data-tema');
  const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
  if (metaTheme) metaTheme.content = chiaro ? '#f0f2f8' : '#050506';
}

const TemaCtx = createContext({
  modalita:        'auto',
  setModalita:     () => {},
  cicla:           () => {},
  coordsRichieste: false,
  richiediCoords:  () => Promise.resolve(false),
});

export function TemaProvider({ children }) {
  const [modalita, setModalitaState] = useState(
    () => localStorage.getItem(CHIAVE_MODALITA) || 'auto'
  );
  const [coords, setCoords]               = useState(leggiCoordsSalvate);
  const [coordsRichieste, setCoordsRich]  = useState(false);
  const intervalRef = useRef(null);

  /* ── Prova a ottenere coordinate GPS (richiede permesso utente) ── */
  const richiediCoords = useCallback(() => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          /* Arrotondiamo prima di salvare per non persistere geolocalizzazione precisa. */
          const c = arrotondaCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setCoords(c);
          try { localStorage.setItem(CHIAVE_COORDS, JSON.stringify(c)); } catch { /* ignore */ }
          setCoordsRich(false);
          resolve(true);
        },
        () => {
          // Permesso negato o timeout: silenziosamente useremo Roma come fallback
          setCoordsRich(false);
          resolve(false);
        },
        { timeout: 8000, maximumAge: 24 * 60 * 60 * 1000 }
      );
    });
  }, []);

  const setModalita = useCallback((nuova) => {
    localStorage.setItem(CHIAVE_MODALITA, nuova);
    setModalitaState(nuova);
    /* Quando l'utente sceglie alba-tramonto, segnala che servirebbero coords
       (se non già salvate). La SettingsPage mostrerà il bottone per richiederle. */
    if (nuova === 'alba-tramonto' && !leggiCoordsSalvate()) {
      setCoordsRich(true);
    } else {
      setCoordsRich(false);
    }
  }, []);

  const cicla = useCallback(() => {
    const idx = SEQUENZA.indexOf(modalita);
    setModalita(SEQUENZA[(idx + 1) % SEQUENZA.length]);
  }, [modalita, setModalita]);

  /* ── Applica tema al DOM quando cambia modalità o coordinate ── */
  useEffect(() => {
    const mq = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: light)')
      : { matches: false, addEventListener: () => {}, removeEventListener: () => {} };

    const aggiorna = () => {
      applicaTema(devEsserChiaro(modalita, mq.matches, coords));
    };
    aggiorna();

    /* Sistema cambia → aggiorna se modalità auto */
    let listenerSistema = null;
    if (modalita === 'auto') {
      listenerSistema = () => aggiorna();
      mq.addEventListener('change', listenerSistema);
    }

    /* Modalità alba-tramonto: ricontrolla periodicamente
       (necessario per rilevare il passaggio attraverso l'orario). */
    if (modalita === 'alba-tramonto') {
      intervalRef.current = setInterval(aggiorna, INTERVALLO_RICONTROLLO_MS);
    }

    return () => {
      if (listenerSistema) mq.removeEventListener('change', listenerSistema);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [modalita, coords]);

  return (
    <TemaCtx.Provider value={{ modalita, setModalita, cicla, coordsRichieste, richiediCoords }}>
      {children}
    </TemaCtx.Provider>
  );
}

export const useTema = () => useContext(TemaCtx);
