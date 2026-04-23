import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

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

/* Rotte che NON devono mai avere un antenato con `transform`/`opacity`/`filter`
   o qualsiasi altra proprietà che generi un layer di compositing. Twitch usa
   IntersectionObserver V2 sull'iframe della chat: se un antenato genera un
   layer (anche solo per `transform: matrix(1,0,0,1,0,0)` lasciato inline da
   framer-motion dopo la fine dell'animazione), considera la chat "oscurata"
   e disabilita l'input per moderatori e broadcaster (anti click-jacking),
   mostrando il messaggio "La chat è disattivata ... perché la finestra
   chat di Twitch è oscurata da un altro elemento".
   Su queste rotte renderizziamo i children in un wrapper statico senza
   motion: rinunciamo alla transizione di pagina pur di avere la chat
   funzionante per chi va live. */
const ROTTE_SENZA_TRANSIZIONE = ['/twitch'];

function senzaTransizione(pathname) {
  if (!pathname) return false;
  return ROTTE_SENZA_TRANSIZIONE.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/**
 * Wraps each page route for consistent iOS-like spring transitions.
 * Key is provided externally by AnimatePresence in App.jsx —
 * do NOT add a key here or it will break exit animations.
 */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();

  if (senzaTransizione(pathname)) {
    // Wrapper statico: nessun transform/opacity inline, nessun layer di
    // compositing → IntersectionObserver V2 di Twitch non rileva oscuramenti.
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    );
  }

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
