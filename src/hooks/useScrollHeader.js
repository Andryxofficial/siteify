import { useState, useEffect, useRef } from 'react';

/**
 * Hook that tracks scroll direction and returns whether
 * the header should be visible. Hides on scroll-down, shows on scroll-up.
 * Like iOS Safari / native app navigation bars.
 */
export default function useScrollHeader(threshold = 12) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 60) {
          // Near top — always show
          setVisible(true);
        } else if (Math.abs(y - lastY.current) > threshold) {
          setVisible(y < lastY.current);
        }
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return visible;
}
