import { motion } from 'framer-motion';

const variants = {
  initial:  { opacity: 0, y: 16, scale: 0.99 },
  animate:  { opacity: 1, y: 0,  scale: 1 },
  exit:     { opacity: 0, y: -10, scale: 0.99 },
};

const transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.8,
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
