import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Twitch } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';
import SEO from '../components/SEO';

const up = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
    >
      <SEO
        title="Home"
        description="ANDRYXify (Andrea Taliento) — Streamer Twitch, gamer e content creator italiano. Live streaming di videogiochi, podcast su Intelligenza Artificiale, video YouTube, clip TikTok e minigioco esclusivo con classifica."
        path="/"
      />
      {/* ── Hero: solo testo, niente cerchio ── */}
      <section className="header" style={{ paddingTop: '1rem' }}>
        <motion.h1 className="title" {...up(0.05)} style={{ letterSpacing: '-2px' }}>
          <span className="text-gradient">ANDRYX</span>ify
        </motion.h1>
        <motion.p className="subtitle" {...up(0.15)}>
          Esplorando il confine tra{' '}
          <span style={{ color: 'var(--primary)',   fontWeight: 600 }}>Umanità</span>,{' '}
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Intelligenza Artificiale</span>{' '}
          e <span style={{ color: 'var(--accent)',  fontWeight: 600 }}>Gaming</span>.
        </motion.p>
      </section>

      {/* ── Live preview ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
        {...up(0.25)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twitch size={20} color="#9146FF" />
          <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>Live Preview</h2>
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
      <motion.div {...up(0.38)}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>Trovami su 📡</h2>
        <SocialHub />
      </motion.div>

      {/* ── Podcast Promo ── */}
      <PodcastPromo />
    </motion.div>
  );
}
