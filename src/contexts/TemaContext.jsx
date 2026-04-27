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

const INTERVALLO_RICONTROLLO_MS = 10 * 60 * 1000;

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
  const body = document.body;
  const modo = chiaro ? 'light' : 'dark';

  if (chiaro) html.setAttribute('data-tema', 'chiaro');
  else html.removeAttribute('data-tema');

  html.setAttribute('data-theme', modo);
  body?.setAttribute('data-theme', modo);
  body?.classList.toggle('dark', !chiaro);
  body?.classList.toggle('light', chiaro);

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
  const [coords, setCoords] = useState(leggiCoordsSalvate);
  const [coordsRichieste, setCoordsRich] = useState(false);
  const intervalRef = useRef(null);

  const richiediCoords = useCallback(() => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = arrotondaCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setCoords(c);
          try { localStorage.setItem(CHIAVE_COORDS, JSON.stringify(c)); } catch { /* ignore */ }
          setCoordsRich(false);
          resolve(true);
        },
        () => {
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

  useEffect(() => {
    const mq = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: light)')
      : { matches: false, addEventListener: () => {}, removeEventListener: () => {} };

    const aggiorna = () => {
      applicaTema(devEsserChiaro(modalita, mq.matches, coords));
    };
    aggiorna();

    let listenerSistema = null;
    if (modalita === 'auto') {
      listenerSistema = () => aggiorna();
      mq.addEventListener('change', listenerSistema);
    }

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

// eslint-disable-next-line react-refresh/only-export-components -- hook esportato accanto al provider per comodita`
export const useTema = () => useContext(TemaCtx);
