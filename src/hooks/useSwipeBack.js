/**
 * useSwipeBack — gesture iOS/Android-style: swipe orizzontale dal bordo
 * sinistro per tornare indietro nella history.
 *
 * - Si attiva solo su touch (no mouse), e solo se il pointer parte
 *   dai primi `bordoPx` pixel orizzontali (tipico edge-swipe).
 * - Threshold: deve muoversi di almeno `sogliaPx` con direzione
 *   prevalente orizzontale rispetto a verticale.
 * - Chiama `history.back()` allo swipe completato.
 * - Disattivato in input/textarea/contenteditable per non interferire
 *   con la selezione testo.
 */
import { useEffect } from 'react';
import { hapticLight } from '../utils/haptics';

const BORDO_PX = 24;
const SOGLIA_PX = 80;

function dentroCampoTesto(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function useSwipeBack(attivo = true) {
  useEffect(() => {
    if (!attivo) return undefined;
    if (typeof window === 'undefined') return undefined;

    let inizio = null; // { x, y, time, pointerId }
    let trigger = false;

    const onPointerDown = (e) => {
      if (e.pointerType !== 'touch') return;
      if (e.clientX > BORDO_PX) return;
      if (dentroCampoTesto(e.target)) return;
      if (window.history.length <= 1) return;
      inizio = { x: e.clientX, y: e.clientY, time: Date.now(), pointerId: e.pointerId };
      trigger = false;
    };

    const onPointerMove = (e) => {
      if (!inizio || e.pointerId !== inizio.pointerId) return;
      const dx = e.clientX - inizio.x;
      const dy = e.clientY - inizio.y;
      // Direzione prevalente orizzontale (verso destra)
      if (Math.abs(dy) > Math.abs(dx)) { inizio = null; return; }
      if (!trigger && dx > 16) {
        trigger = true;
        hapticLight();
      }
    };

    const onPointerEnd = (e) => {
      if (!inizio || e.pointerId !== inizio.pointerId) return;
      const dx = e.clientX - inizio.x;
      const dy = e.clientY - inizio.y;
      const ms = Date.now() - inizio.time;
      inizio = null;
      // Swipe ampio o swipe veloce (flick) verso destra
      const ampioSufficiente = dx >= SOGLIA_PX && Math.abs(dy) < 60;
      const flickVeloce = dx >= 40 && ms < 300 && Math.abs(dy) < 40;
      if (ampioSufficiente || flickVeloce) {
        try { window.history.back(); } catch { /* no-op */ }
      }
    };

    const onPointerCancel = () => { inizio = null; };

    /* Listener passivi → niente latenza percepita */
    window.addEventListener('pointerdown',   onPointerDown,   { passive: true });
    window.addEventListener('pointermove',   onPointerMove,   { passive: true });
    window.addEventListener('pointerup',     onPointerEnd,    { passive: true });
    window.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      window.removeEventListener('pointerdown',   onPointerDown);
      window.removeEventListener('pointermove',   onPointerMove);
      window.removeEventListener('pointerup',     onPointerEnd);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [attivo]);
}
