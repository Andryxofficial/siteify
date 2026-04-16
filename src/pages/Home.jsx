import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Twitch } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
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
      {/* ── Hero ── */}
      <section className="header">
        <motion.div
          className="profile-img-container"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 14, stiffness: 120 }}
          onClick={() => setLiveState(p => (p + 1) % 3)}
          style={{ cursor: 'pointer' }}
          title="Segreto: cambia stato live"
        >
          <img src="/logo.png" alt="ANDRYXify" className="profile-img" />
        </motion.div>

        <motion.h1 className="title" {...fadeUp(0.15)}>
          <span className="text-gradient">ANDRYX</span>ify
        </motion.h1>

        <motion.p className="subtitle" {...fadeUp(0.25)}>
          Esplorando il confine tra{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Umanità</span>,{' '}
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Intelligenza Artificiale</span>{' '}
          e <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Gaming</span>.
        </motion.p>
      </section>

      {/* ── Live Preview ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        {...fadeUp(0.35)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twitch size={22} color="#9146FF" />
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>Live Preview</h2>
          <div style={{ marginLeft: 'auto' }}>
            {liveState > 0 ? (
              <span className="chip chip-live">
                <span className="chip-live-dot" />
                LIVE ORA
              </span>
            ) : (
              <span className="chip chip-offline">⚪ OFFLINE</span>
            )}
          </div>
        </div>

        {/* 16:9 player */}
        <div
          className="glass-card"
          style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--r-md)' }}
        >
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}&muted=true`}
            height="100%"
            width="100%"
            allowFullScreen
            style={{ border: 'none', display: 'block' }}
          />
        </div>

        {/* Simulcast banner */}
        {liveState === 2 && (
          <motion.a
            href="https://youtube.com/@ANDRYXify/live"
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{
              background: 'linear-gradient(135deg,#FF0000,#990000)',
              color: '#fff',
              justifyContent: 'center',
              boxShadow: '0 5px 20px rgba(255,0,0,.3)',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            🔴 In simulcast anche su YouTube
          </motion.a>
        )}

        <Link
          to="/twitch"
          className="btn btn-primary"
          style={{ alignSelf: 'center' }}
        >
          Apri stream completo
        </Link>
      </motion.section>

      {/* ── Social Hub ── */}
      <motion.div {...fadeUp(0.45)}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          Trovami su 📡
        </h2>
        <SocialHub />
      </motion.div>

      {/* ── Podcast Promo ── */}
      <PodcastPromo />
    </motion.div>
  );
}
