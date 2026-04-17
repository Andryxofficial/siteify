import { useState, useEffect } from 'react';

/**
 * Detects if the app is running as an installed PWA (standalone mode).
 * Returns true when there's no browser chrome around the app.
 */
export default function useStandalone() {
  const [standalone, setStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e) => setStandalone(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return standalone;
}
