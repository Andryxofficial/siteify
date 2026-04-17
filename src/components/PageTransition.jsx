import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

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
 * Use in place of manual per-page motion.div wrappers.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
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
