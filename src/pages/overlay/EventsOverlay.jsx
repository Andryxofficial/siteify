/**
 * EventsOverlay.jsx — Overlay OBS per feed di eventi recenti.
 * Mostra gli ultimi follower/sub in una lista animata.
 * URL: /overlay/events?slug=<slug>
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_ICONS = { follow: '💜', sub: '⭐', raid: '⚔️' };

export default function EventsOverlay() {
  const [events, setEvents] = useState([]);
  const prevRef = useRef([]);
  const slug = new URLSearchParams(window.location.search).get('slug');

  useEffect(() => {
    if (!slug) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/mod-overlays?type=events&slug=${slug}`);
        if (!r.ok) return;
        const { events: latest } = await r.json();
        // Aggiungi solo i nuovi eventi (non già presenti)
        const prevIds = new Set(prevRef.current.map(e => e.ts));
        const nuovi = (latest || []).filter(e => !prevIds.has(e.ts));
        if (nuovi.length) {
          setEvents(prev => [...nuovi, ...prev].slice(0, 8));
          prevRef.current = latest;
        }
      } catch { /* silenzioso */ }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [slug]);

  if (!slug) return null;

  return (
    <div style={{
      position: 'fixed', top: 80, right: 20, width: 280,
      display: 'flex', flexDirection: 'column', gap: 6,
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {events.map(ev => (
          <motion.div key={ev.ts}
            initial={{ opacity: 0, x: 40, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(130,170,240,0.2)',
              borderRadius: 10, padding: '0.5rem 0.75rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{TYPE_ICONS[ev.type] || '📢'}</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{ev.user}</div>
              {ev.message && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{ev.message}</div>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
