/**
 * GoalsOverlay.jsx — Overlay OBS per obiettivi/barre di avanzamento.
 * Sfondo trasparente, polling ogni 4s.
 * URL: /overlay/goals?slug=<slug>
 */
import { useState, useEffect } from 'react';

export default function GoalsOverlay() {
  const [goals, setGoals] = useState([]);
  const slug = new URLSearchParams(window.location.search).get('slug');

  useEffect(() => {
    if (!slug) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/mod-overlays?type=goals&slug=${slug}`);
        if (r.ok) setGoals((await r.json()).goals || []);
      } catch { /* silenzioso */ }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [slug]);

  if (!slug) return <p style={{ color: '#fff', fontFamily: 'sans-serif', padding: 16 }}>Slug mancante nell'URL.</p>;
  if (!goals.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 40, left: 40, width: 320,
      display: 'flex', flexDirection: 'column', gap: 10,
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      pointerEvents: 'none',
    }}>
      {goals.map((g, i) => {
        const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100));
        return (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.62)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${g.color}40`,
            borderRadius: 12, padding: '0.6rem 0.9rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, color: '#fff', fontWeight: 600 }}>
              <span>{g.label}</span>
              <span style={{ color: g.color }}>{g.current} / {g.target}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
