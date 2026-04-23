import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { leggiEResetNavigazione } from '../utils/navTransizione';

/* ─── Varianti click (spring fade — comportamento originale) ─── */
const variantiClick = {
  initial:  { opacity: 0, y: 8, scale: 0.995 },
  animate:  { opacity: 1, y: 0, scale: 1 },
  exit:     { opacity: 0, y: -4, scale: 1.002 },
};

const transitionClick = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.6,
};

/**
 * Wraps each page route for consistent iOS-like spring transitions.
 * Distinguishes swipe navigation (horizontal slide) from click navigation (fade).
 * Key is provided externally by AnimatePresence in App.jsx —
 * do NOT add a key here or it will break exit animations.
 */
export default function PageTransition({ children }) {
  /* Legge il tipo di navigazione prima del primo paint — useLayoutEffect
     garantisce la sincronizzazione con il ciclo di render. */
  const navRef = useRef(leggiEResetNavigazione());

  useLayoutEffect(() => {
    navRef.current = leggiEResetNavigazione();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { tipo, dir } = navRef.current;
  const isSwipe = tipo === 'swipe';

  /* Varianti swipe: slide orizzontale nella direzione corretta */
  const variantiSwipe = {
    initial: { opacity: 0.6, x: `${dir * 55}%`  },
    animate: { opacity: 1,   x: 0 },
    exit:    { opacity: 0,   x: `${-dir * 28}%` },
  };

  const transitionSwipe = {
    type: 'spring',
    stiffness: 340,
    damping: 34,
    mass: 0.7,
  };

  return (
    <motion.div
      variants={isSwipe ? variantiSwipe : variantiClick}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={isSwipe ? transitionSwipe : transitionClick}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {children}
    </motion.div>
  );
}
