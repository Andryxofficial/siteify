import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Twitch, Sparkles, Zap, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';
import SEO from '../components/SEO';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

// Variante con whileInView per sezioni sotto il fold
const inView = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport:   { once: true, margin: '-60px' },
  transition: { delay, type: 'spring', stiffness: 200, damping: 26 },
});

export default function Home() {
  const [liveState, setLiveState] = useState(0); // 0=offline 1=twitch 2=simulcast

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('https://decapi.me/twitch/uptime/andryxify');
        const text = await res.text();
        setLiveState(text.toLowerCase().includes('offline') ? 0 : 1);
      } catch { /* silent */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="main-content">
      <SEO
        title="Home"
        description="ANDRYXify (Andrea Taliento) — Streamer Twitch, gamer e content creator italiano. Live streaming di videogiochi, podcast su Intelligenza Artificiale, video YouTube, clip TikTok e minigioco esclusivo con classifica."
        path="/"
        keywords="andryxify, andrea taliento, streamer twitch italiano, content creator gaming, podcast intelligenza artificiale"
      />
      {/* ── Hero ── */}
      <section className="header" style={{ paddingTop: '1.5rem', paddingBottom: '0.5rem' }}>
        <motion.div {...su(0.05)} style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.9rem' }}>
          <img
            src="/Firma_Andryx.png"
            alt="ANDRYXify"
            className="logo-hero-flotta"
            loading="eager"
            style={{ height: 'clamp(60px, 14vw, 110px)', width: 'auto', objectFit: 'contain' }}
          />
        </motion.div>
        <motion.p className="subtitle" {...su(0.15)}>
          Esplorando il confine tra{' '}
          <span style={{ color: 'var(--primary)',   fontWeight: 600 }}>Umanità</span>,{' '}
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Intelligenza Artificiale</span>{' '}
          e <span style={{ color: 'var(--accent-warm)',  fontWeight: 600 }}>Gaming</span>.
        </motion.p>

        {/* Tagline chips */}
        <motion.div {...su(0.22)} style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Sparkles size={14} />, label: 'Content Creator', color: 'var(--primary)', bg: 'rgba(224,64,251,0.12)', border: 'rgba(224,64,251,0.20)' },
            { icon: <Brain size={14} />,    label: 'AI Explorer',     color: 'var(--secondary)', bg: 'rgba(0,229,255,0.12)', border: 'rgba(0,229,255,0.20)' },
            { icon: <Zap size={14} />,      label: 'Gamer',           color: 'var(--accent-warm)', bg: 'rgba(255,184,108,0.12)', border: 'rgba(255,184,108,0.20)' },
          ].map(t => (
            <motion.span
              key={t.label}
              className="chip"
              style={{
                background: t.bg,
                color: t.color,
                border: `1px solid ${t.border}`,
                fontSize: '0.72rem',
                padding: '4px 12px',
              }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {t.icon} {t.label}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* ── Live preview ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
        {...su(0.28)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twitch size={20} color="#9146FF" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>Live Preview</h2>
          <div style={{ marginLeft: 'auto' }}>
            {liveState > 0
              ? <span className="chip chip-live"><span className="chip-live-dot" /> LIVE ORA</span>
              : <span className="chip chip-offline">⚪ OFFLINE</span>
            }
          </div>
        </div>

        <div className="glass-card" style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}&muted=true`}
            height="100%" width="100%" allowFullScreen
            loading="lazy"
            style={{ border: 'none', display: 'block' }}
          />
        </div>

        {liveState === 2 && (
          <motion.a
            href="https://youtube.com/@ANDRYXify/live"
            target="_blank" rel="noreferrer"
            className="btn"
            style={{ background: 'linear-gradient(135deg,#FF0000,#990000)', color: '#fff', justifyContent: 'center' }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          >
            🔴 In simulcast anche su YouTube
          </motion.a>
        )}

        <Link to="/twitch" className="btn btn-primary" style={{ alignSelf: 'center' }}>
          Apri stream completo
        </Link>
      </motion.section>

      {/* ── Social Hub ── */}
      <motion.div {...inView(0)}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>Trovami su 📡</h2>
        <SocialHub />
      </motion.div>

      {/* ── Podcast Promo ── */}
      <motion.div {...inView(0.05)}>
        <PodcastPromo />
      </motion.div>
    </div>
  );
}

