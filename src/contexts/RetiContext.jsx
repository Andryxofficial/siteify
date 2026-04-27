/**
 * RetiContext — stato di rete dell'utente.
 *
 * Espone:
 *   online           true/false (basato su navigator.onLine + ping reale)
 *   tipoConnessione  '4g' | '3g' | '2g' | 'slow-2g' | undefined
 *   reteLeggera      true se la connessione è 2g/slow-2g o saveData attivo
 *   salvaDati        true se l'utente ha attivato "Risparmio dati" nel browser
 *
 * navigator.onLine da solo è notoriamente bugato (ritorna true anche
 * con sola interfaccia di rete attiva ma nessun internet). Aggiungiamo
 * un ping leggero verso /favicon.ico ogni volta che cambia stato.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const RetiCtx = createContext({
  online: true,
  tipoConnessione: undefined,
  reteLeggera: false,
  salvaDati: false,
});

function leggiConnessione() {
  if (typeof navigator === 'undefined') return {};
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return {};
  return {
    tipoConnessione: c.effectiveType,
    salvaDati: !!c.saveData,
  };
}

export function RetiProvider({ children }) {
  const [online, setOnline]                   = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [{ tipoConnessione, salvaDati }, setConn] = useState(() => leggiConnessione());

  /* Verifica reale di connettività con ping al server.
     navigator.onLine può mentire (es. wifi senza internet). */
  const verificaConnettivita = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    try {
      // Cache-bust query string per evitare risposte 304 dal SW.
      const r = await fetch(`/favicon.ico?_=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      setOnline(r.ok || r.status === 0);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    const onOnline   = () => { setOnline(true);  verificaConnettivita(); };
    const onOffline  = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    /* Connessione: aggiorna su change */
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const onConnChange = () => setConn(leggiConnessione());
    if (c && typeof c.addEventListener === 'function') {
      c.addEventListener('change', onConnChange);
    }

    /* Ping iniziale dopo un breve delay (lascia caricare la pagina) */
    const t = setTimeout(verificaConnettivita, 1500);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      if (c && typeof c.removeEventListener === 'function') {
        c.removeEventListener('change', onConnChange);
      }
      clearTimeout(t);
    };
  }, [verificaConnettivita]);

  const reteLeggera = salvaDati || tipoConnessione === '2g' || tipoConnessione === 'slow-2g';

  return (
    <RetiCtx.Provider value={{ online, tipoConnessione, reteLeggera, salvaDati }}>
      {children}
    </RetiCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook esportato accanto al provider per comodita`
export const useReti = () => useContext(RetiCtx);
