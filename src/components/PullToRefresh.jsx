/**
 * PullToRefresh — gesture nativa: trascinare verso il basso quando si è
 * in cima alla pagina per ricaricare. Indicatore vetro con spinner
 * personalizzato (sembra iOS / Android nativo).
 *
 * Uso:
 *   <PullToRefresh onRefresh={async () => { await ricarica(); }}>
 *     <Contenuto />
 *   </PullToRefresh>
 *
 * Note:
 *  - Si attiva solo su touch e solo se window.scrollY === 0.
 *  - In standalone PWA il pull-to-refresh del browser è disabilitato,
 *    quindi serve sostituirlo per avere il feel nativo.
 *  - Disattivato su desktop (mouse): inutile e potenzialmente fastidioso.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const SOGLIA_TRIGGER_PX = 70;
const RESISTENZA = 0.45;
const ALTEZZA_MAX_PX = 120;

export default function PullToRefresh({ children, onRefresh, abilitato = true }) {
  const containerRef = useRef(null);
  const inizioY = useRef(null);
  const trascinamento = useRef(false);
  const [pulled, setPulled] = useState(0); // px attuali di pull
  const [stato, setStato] = useState('idle'); // idle | pulling | release | refreshing
  const trigerato = useRef(false);

  const eseguiRefresh = useCallback(async () => {
    setStato('refreshing');
    setPulled(SOGLIA_TRIGGER_PX);
    hapticSuccess();
    try { await Promise.resolve(onRefresh?.()); } catch { /* silente */ }
    setStato('idle');
    setPulled(0);
    trigerato.current = false;
  }, [onRefresh]);

  useEffect(() => {
    if (!abilitato) return undefined;
    if (typeof window === 'undefined') return undefined;
    const el = containerRef.current;
    if (!el) return undefined;

    const onTouchStart = (e) => {
      if (window.scrollY > 0) return;
      if (stato === 'refreshing') return;
      if (e.touches.length !== 1) return;
      inizioY.current = e.touches[0].clientY;
      trascinamento.current = false;
    };

    const onTouchMove = (e) => {
      if (inizioY.current === null) return;
      if (stato === 'refreshing') return;
      if (window.scrollY > 0) { inizioY.current = null; return; }
      const dy = e.touches[0].clientY - inizioY.current;
      if (dy <= 0) { setPulled(0); setStato('idle'); return; }
      // Resistenza a bordo: il pull diventa più "duro" mentre tiri
      const dist = Math.min(ALTEZZA_MAX_PX, dy * RESISTENZA);
      setPulled(dist);
      if (dist > 8) trascinamento.current = true;
      if (dist >= SOGLIA_TRIGGER_PX) {
        if (!trigerato.current) {
          trigerato.current = true;
          hapticLight();
        }
        setStato('release');
      } else {
        trigerato.current = false;
        setStato('pulling');
      }
      // Solo se siamo davvero in pull (non scroll laterale): impedisci default
      if (trascinamento.current && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (inizioY.current === null) return;
      const era = stato;
      inizioY.current = null;
      if (era === 'release') {
        eseguiRefresh();
      } else {
        setPulled(0);
        setStato('idle');
        trigerato.current = false;
      }
    };

    /* passive:false su touchmove per poter chiamare preventDefault */
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('touchcancel',onTouchEnd);
    };
  }, [abilitato, eseguiRefresh, stato]);

  const progresso = Math.min(1, pulled / SOGLIA_TRIGGER_PX);
  const èInRefresh = stato === 'refreshing';

  return (
    <div ref={containerRef} className="ptr-host">
      <motion.div
        className="ptr-indicator glass-panel"
        animate={{
          y: pulled - 40,
          opacity: pulled > 4 ? 1 : 0,
          scale: 0.8 + 0.2 * progresso,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        aria-hidden={pulled <= 4}
      >
        <motion.span
          animate={{ rotate: èInRefresh ? 360 : progresso * 270 }}
          transition={èInRefresh
            ? { repeat: Infinity, duration: 0.9, ease: 'linear' }
            : { type: 'spring', stiffness: 220, damping: 22 }}
          style={{ display: 'flex' }}
        >
          <RefreshCw size={20} />
        </motion.span>
      </motion.div>
      {children}
    </div>
  );
}
