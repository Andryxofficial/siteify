import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PodcastPromo() {
  return (
    <motion.section
      className="glass-panel"
      style={{ padding: '0', overflow: 'hidden' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, type: 'spring', stiffness: 180, damping: 22 }}
      whileHover={{ boxShadow: '0 10px 48px rgba(0,245,212,.18)' }}
    >
      {/* Header strip */}
      <div style={{
        padding: '1.4rem 2rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.7rem',
      }}>
        <Mic size={20} color="var(--secondary)" />
        <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>
          <span className="text-gradient-cyan">Umanità o IA?</span> — Podcast
        </h2>
        <Link
          to="/podcast"
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
        >
          Tutti gli episodi →
        </Link>
      </div>

      {/* Real Spotify embed */}
      <div style={{ padding: '1rem 1rem 0' }}>
        <iframe
          title="Umanità o IA? – Spotify Podcast"
          src="https://open.spotify.com/embed/show/1wtbUNmK9cWJXum02QsxW9?utm_source=generator&theme=0"
          width="100%"
          height="232"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ borderRadius: 'var(--r-md)', display: 'block' }}
        />
      </div>

      {/* CTA row */}
      <div style={{ padding: '1rem 2rem 1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a
          href="https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{ background: 'var(--accent-spotify)', color: '#fff', fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
        >
          Ascolta su Spotify
        </a>
        <a
          href="https://podcasts.apple.com/it/podcast/umanit%C3%A0-o-ia/id1869893930"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
        >
          Apple Podcast
        </a>
      </div>
    </motion.section>
  );
}
