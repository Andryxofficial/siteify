import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Music2, TrendingUp, Sparkles, Zap } from 'lucide-react';
import TikTokIcon from '../components/TikTokIcon';

const highlights = [
  { emoji: '🎮', label: 'Gaming Clips',    desc: 'I momenti più epici in formato corto.' },
  { emoji: '🤖', label: 'IA in 60 sec',    desc: 'Pillole di intelligenza artificiale.' },
  { emoji: '😂', label: 'Behind the Scenes', desc: 'Dietro le quinte delle live.' },
  { emoji: '💡', label: 'Tech Tips',        desc: 'Consigli e curiosità digitali.' },
  { emoji: '🎙️', label: 'Podcast Snippet', desc: 'I migliori estratti del podcast.' },
  { emoji: '🔥', label: 'Trending',         desc: 'Partecipazioni ai trend del momento.' },
];

export default function TikTokPage() {
  // Load TikTok embed script once
  useEffect(() => {
    if (document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) return;
    const s = document.createElement('script');
    s.src = 'https://www.tiktok.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
    >
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title">
          <span style={{ color: '#00F2FE' }}>TikTok</span> Vibes
        </h1>
        <p className="subtitle">
          Clip, trend, IA e gaming nei formati più veloci del web.
        </p>
      </header>

      {/* Profile card */}
      <motion.div
        className="glass-panel"
        style={{ padding: 0, overflow: 'hidden' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Banner gradient TikTok */}
        <div style={{
          height: 120,
          background: 'linear-gradient(135deg,#010101 0%,#69C9D0 40%,#EE1D52 100%)',
          position: 'relative',
        }}>
          <TikTokIcon size={40} color="rgba(255,255,255,.18)" style={{ position: 'absolute', right: 24, top: 20 }} />
        </div>

        <div style={{
          padding: '0 2rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginTop: -50,
        }}>
          <div style={{
            width: 96, height: 96,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#EE1D52,#69C9D0)',
            padding: 3,
            position: 'relative',
            zIndex: 2,
            marginBottom: '1rem',
          }}>
            <img
              src="/logo.png"
              alt="@andryxify"
              style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#111', objectFit: 'contain', padding: 8 }}
            />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.2rem' }}>@andryxify</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: 420, lineHeight: 1.6 }}>
            Gaming, IA, tech e tanto altro in pillole veloci. Seguimi per non perdere nemmeno un trend!
          </p>
          <motion.a
            href="https://tiktok.com/@andryxify"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: 'linear-gradient(135deg,#010101,#EE1D52)',
              color: '#fff',
              boxShadow: '0 5px 20px rgba(238,29,82,.3)',
              gap: '8px',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <TikTokIcon size={18} color="#fff" /> Seguimi su TikTok
          </motion.a>
        </div>
      </motion.div>

      {/* Embed TikTok profile widget */}
      <motion.div
        className="glass-panel"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TikTokIcon size={20} color="#EE1D52" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Feed TikTok</h2>
        </div>

        {/* TikTok embed via blockquote */}
        <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <blockquote
            className="tiktok-embed"
            cite="https://www.tiktok.com/@andryxify"
            data-unique-id="andryxify"
            data-embed-type="creator"
            style={{ maxWidth: '100%', minWidth: 288, border: 'none' }}
          >
            <section>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.tiktok.com/@andryxify?refer=creator_embed"
              >
                @andryxify
              </a>
            </section>
          </blockquote>
        </div>
      </motion.div>
      <div>
        <h2 className="section-title">Cosa trovi su TikTok 🎬</h2>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {highlights.map((h, i) => (
            <motion.div
              key={h.label}
              className="glass-card"
              style={{
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 240, damping: 22 }}
              whileHover={{ scale: 1.03 }}
            >
              <span style={{ fontSize: '1.8rem' }}>{h.emoji}</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#00F2FE' }}>{h.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{h.desc}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats / CTA */}
      <motion.div
        className="glass-panel"
        style={{ textAlign: 'center', padding: '2rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Music2 size={20} color="#EE1D52" />, label: 'Trending Sounds' },
            { icon: <TrendingUp size={20} color="#69C9D0" />, label: 'Viral Clips' },
            { icon: <Sparkles size={20} color="#FFD700" />, label: 'IA Content' },
            { icon: <Zap size={20} color="#9146FF" />, label: 'Gaming Moments' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              {stat.icon}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</span>
            </div>
          ))}
        </div>
        <motion.a
          href="https://tiktok.com/@andryxify"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          whileHover={{ scale: 1.04 }}
        >
          <ExternalLink size={16} /> Apri il profilo TikTok
        </motion.a>
      </motion.div>
    </motion.div>
  );
}
