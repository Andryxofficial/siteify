import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Youtube, ExternalLink, Play } from 'lucide-react';
import SEO from '../components/SEO';

const CHANNEL_ID = 'UCt_i4p3p-5_pB_7d9D0yTqQ';
const CHANNEL_URL = 'https://youtube.com/@ANDRYXify';

export default function YouTubePage() {
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res  = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
        );
        const data = await res.json();
        if (data.items) setVideos(data.items.slice(0, 6));
      } catch (e) {
        console.error('YouTube RSS error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
    >
      <SEO
        title="YouTube — Video, Highlights & Approfondimenti"
        description="Guarda i video di ANDRYXify su YouTube: gameplay, highlights, approfondimenti su intelligenza artificiale e gaming. Iscriviti al canale YouTube di Andrea Taliento!"
        path="/youtube"
      />
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title"><span style={{ color: '#FF0000' }}>YouTube</span> Hub</h1>
        <p className="subtitle">Riflessioni, approfondimenti e highlights sul futuro digitale.</p>
      </header>

      {/* Channel card */}
      <motion.div
        className="glass-panel"
        style={{ padding: 0, overflow: 'hidden' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Banner */}
        <div style={{
          height: 120,
          background: 'linear-gradient(135deg,#FF0000 0%,#600000 60%,#1a0000 100%)',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 2rem',
        }}>
          <Youtube size={36} color="rgba(255,255,255,.15)" style={{ position: 'absolute', right: 24, top: 16 }} />
        </div>

        <div style={{
          padding: '0 2rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginTop: -50,
        }}>
          <img
            src="/logo.png"
            alt="ANDRYXify"
            style={{
              width: 96, height: 96,
              borderRadius: '50%',
              border: '4px solid var(--bg-dark)',
              background: '#111',
              objectFit: 'contain',
              padding: 8,
              position: 'relative',
              zIndex: 2,
              marginBottom: '1rem',
            }}
          />
          <h2 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.4rem' }}>ANDRYXify</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: 480, fontSize: '0.92rem', lineHeight: 1.6 }}>
            Live, estratti, approfondimenti sull'intelligenza artificiale, reaction e gaming. Esplora tutti i contenuti originali e unisciti alla community!
          </p>
          <motion.a
            href={CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{ background: '#FF0000', color: '#fff', boxShadow: '0 5px 20px rgba(255,0,0,.3)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Youtube size={18} /> Iscriviti al Canale
          </motion.a>
        </div>
      </motion.div>

      {/* Latest videos */}
      <div>
        <h2 className="section-title">
          <span style={{ color: '#FF0000' }}>▶</span> Ultimi Video
        </h2>
        <div
          className="links-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="glass-card skeleton" style={{ height: 220 }} />
              ))
            : videos.map(video => (
                <motion.a
                  key={video.guid}
                  href={video.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card"
                  style={{ overflow: 'hidden', padding: 0, textDecoration: 'none', color: 'inherit', display: 'block' }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', background: '#111' }}>
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,.3)',
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      opacity: 0,
                      transition: 'opacity .2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <div style={{
                        background: 'rgba(255,0,0,.85)',
                        borderRadius: '50%',
                        width: 48, height: 48,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Play size={20} fill="white" color="white" style={{ marginLeft: 2 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.35, fontWeight: 700 }}>{video.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                      <ExternalLink size={12} color="var(--text-faint)" />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Guarda su YouTube</span>
                    </div>
                  </div>
                </motion.a>
              ))
          }
        </div>
      </div>
    </motion.div>
  );
}
