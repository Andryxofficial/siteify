import { useEffect } from 'react';

function calcolaInsetTastiera() {
  if (typeof window === 'undefined' || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  const differenza = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  return Math.round(differenza);
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
      const inset = calcolaInsetTastiera();
      const aperta = inset > 80 && focusEditabileAttivo();
      root.style.setProperty('--keyboard-inset', aperta ? `${inset}px` : '0px');
      body.classList.toggle('keyboard-open', aperta);
    };

    const ritarda = () => {
      aggiorna();
      window.setTimeout(aggiorna, 90);
      window.setTimeout(aggiorna, 260);
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
      body.classList.remove('keyboard-open');
    };
  }, []);
}
