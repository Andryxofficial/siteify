/**
 * AlertsOverlay.jsx — Overlay OBS per alert animati (follow, sub, raid).
 * Mostra un alert grande al centro dello schermo per qualche secondi.
 * URL: /overlay/alerts?slug=<slug>
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ALERT_COLORS = { follow: '#E040FB', sub: '#9146FF', raid: '#FF6B6B' };
const ALERT_ICONS  = { follow: '💜', sub: '⭐', raid: '⚔️' };
const ALERT_LABELS = { follow: 'Nuovo Follower!', sub: 'Nuovo Sub!', raid: 'RAID!' };
const ALERT_DURATION = 5000; // ms

export default function AlertsOverlay() {
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);
  const showingRef = useRef(false);
  const lastTsRef = useRef(null);
  const slug = new URLSearchParams(window.location.search).get('slug');

  const mostraNext = () => {
    if (queueRef.current.length === 0) { showingRef.current = false; return; }
    showingRef.current = true;
    const next = queueRef.current.shift();
    setCurrent(next);
    setTimeout(() => { setCurrent(null); mostraNext(); }, ALERT_DURATION);
  };

  useEffect(() => {
    if (!slug) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/mod-overlays?type=alerts&slug=${slug}`);
        if (!r.ok) return;
        const { events } = await r.json();
        if (!events?.length) return;
        const newest = events[0];
        if (newest.ts === lastTsRef.current) return;
        // Aggiungi solo gli eventi arrivati dopo l'ultimo visto
        const nuovi = lastTsRef.current
          ? events.filter(e => e.ts > lastTsRef.current)
          : [newest];
        lastTsRef.current = newest.ts;
        queueRef.current.push(...nuovi);
        if (!showingRef.current) mostraNext();
      } catch { /* silenzioso */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!slug) return null;

  const color = ALERT_COLORS[current?.type] || '#E040FB';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    }}>
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -30 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            style={{
              background: `linear-gradient(135deg, rgba(0,0,0,.75) 0%, ${color}20 100%)`,
              border: `2px solid ${color}60`,
              borderRadius: 20,
              backdropFilter: 'blur(18px)',
              padding: '1.5rem 2.5rem',
              textAlign: 'center',
              minWidth: 280,
              boxShadow: `0 0 40px ${color}40`,
            }}
          >
            <div style={{ fontSize: 56, lineHeight: 1 }}>{ALERT_ICONS[current.type] || '🎉'}</div>
            <div style={{ color, fontSize: 28, fontWeight: 900, marginTop: 8, textShadow: `0 0 20px ${color}` }}>
              {ALERT_LABELS[current.type] || 'Alert!'}
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{current.user}</div>
            {current.message && (
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>{current.message}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
