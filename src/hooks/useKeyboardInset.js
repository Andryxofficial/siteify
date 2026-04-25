import { useEffect } from 'react';

function datiViewport() {
  if (typeof window === 'undefined') {
    return { inset: 0, left: 0, top: 0, width: 0, height: 0 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { inset: 0, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  return {
    inset: Math.round(inset),
    left: Math.round(vv.offsetLeft || 0),
    top: Math.round(vv.offsetTop || 0),
    width: Math.round(vv.width || window.innerWidth),
    height: Math.round(vv.height || window.innerHeight),
  };
}

function focusEditabileAttivo() {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export default function useKeyboardInset() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    const body = document.body;

    const aggiorna = () => {
      const dati = datiViewport();
      const aperta = dati.inset > 80 && focusEditabileAttivo();

      root.style.setProperty('--keyboard-inset', aperta ? `${dati.inset}px` : '0px');
      root.style.setProperty('--vv-left', `${dati.left}px`);
      root.style.setProperty('--vv-top', `${dati.top}px`);
      root.style.setProperty('--vv-width', `${dati.width}px`);
      root.style.setProperty('--vv-height', `${dati.height}px`);
      body.classList.toggle('keyboard-open', aperta);
      body.classList.toggle('visual-viewport-shifted', dati.left !== 0 || dati.top !== 0);
    };

    const ritarda = () => {
      aggiorna();
      window.setTimeout(aggiorna, 60);
      window.setTimeout(aggiorna, 160);
      window.setTimeout(aggiorna, 320);
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', aggiorna);
    vv?.addEventListener('scroll', aggiorna);
    window.addEventListener('resize', aggiorna);
    window.addEventListener('orientationchange', ritarda);
    document.addEventListener('focusin', ritarda);
    document.addEventListener('focusout', ritarda);

    aggiorna();

    return () => {
      vv?.removeEventListener('resize', aggiorna);
      vv?.removeEventListener('scroll', aggiorna);
      window.removeEventListener('resize', aggiorna);
      window.removeEventListener('orientationchange', ritarda);
      document.removeEventListener('focusin', ritarda);
      document.removeEventListener('focusout', ritarda);
      root.style.removeProperty('--keyboard-inset');
      root.style.removeProperty('--vv-left');
      root.style.removeProperty('--vv-top');
      root.style.removeProperty('--vv-width');
      root.style.removeProperty('--vv-height');
      body.classList.remove('keyboard-open');
      body.classList.remove('visual-viewport-shifted');
    };
  }, []);
}
