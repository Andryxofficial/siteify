import { motion } from 'framer-motion';

const variants = {
  initial:  { opacity: 0, y: 8, scale: 0.995 },
  animate:  { opacity: 1, y: 0, scale: 1 },
  exit:     { opacity: 0, y: -4, scale: 1.002 },
};

const transition = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.6,
};

/**
 * Wraps each page route for consistent iOS-like spring transitions.
 * Key is provided externally by AnimatePresence in App.jsx —
 * do NOT add a key here or it will break exit animations.
 */
export default function PageTransition({ children }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {children}
    </motion.div>
  );
}
