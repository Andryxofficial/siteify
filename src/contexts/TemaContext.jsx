/**
 * TemaContext — stato chiaro/scuro/auto condiviso tra Navbar e SettingsPage.
 *
 * Espone:
 *   modalita   'auto' | 'chiaro' | 'scuro'
 *   setModalita(modalita)  imposta esplicitamente
 *   cicla()                ruota auto → chiaro → scuro → auto
 */
import { createContext, useContext, useState, useEffect } from 'react';

const CHIAVE    = 'andryxify_tema_modalita';
const SEQUENZA  = ['auto', 'chiaro', 'scuro'];

function applicaTema(modalita, mq) {
  const html      = document.documentElement;
  const isChiaro  = modalita === 'chiaro' || (modalita === 'auto' && mq.matches);
  if (isChiaro) {
    html.setAttribute('data-tema', 'chiaro');
  } else {
    html.removeAttribute('data-tema');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
  if (metaTheme) metaTheme.content = isChiaro ? '#f0f2f8' : '#050506';
}

const TemaCtx = createContext({
  modalita:    'auto',
  setModalita: () => {},
  cicla:       () => {},
});

export function TemaProvider({ children }) {
  const [modalita, setModalitaState] = useState(
    () => localStorage.getItem(CHIAVE) || 'auto'
  );

  const setModalita = (nuova) => {
    localStorage.setItem(CHIAVE, nuova);
    setModalitaState(nuova);
  };

  const cicla = () => {
    const idx = SEQUENZA.indexOf(modalita);
    setModalita(SEQUENZA[(idx + 1) % SEQUENZA.length]);
  };

  /* Applica tema al DOM e ascolta cambi sistema in modalità 'auto' */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    applicaTema(modalita, mq);

    if (modalita === 'auto') {
      const listener = (e) => applicaTema(modalita, e);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [modalita]);

  return (
    <TemaCtx.Provider value={{ modalita, setModalita, cicla }}>
      {children}
    </TemaCtx.Provider>
  );
}

export const useTema = () => useContext(TemaCtx);
