import { motion } from 'framer-motion';
import { Mic, Headphones, Share2, ExternalLink } from 'lucide-react';
import SEO from '../components/SEO';

const SPOTIFY_URL = 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9';
const APPLE_URL   = 'https://podcasts.apple.com/it/podcast/umanit%C3%A0-o-ia/id1869893930';
const YT_URL      = 'https://youtube.com/playlist?list=PLFG8B0vJXbXcvI4M3trS3cyfQuH6A6hub';

const platforms = [
  { label: 'Spotify',       href: SPOTIFY_URL, bg: '#1DB954', color: '#fff' },
  { label: 'Apple Podcast', href: APPLE_URL,   bg: '#FF1A1A', color: '#fff' },
  { label: 'YouTube Music', href: YT_URL,      bg: '#FF0000', color: '#fff' },
];

export default function PodcastPage() {
  const handleShare = () => {
    const shareData = {
      title: 'Umanità o IA? — ANDRYXify Podcast',
      text: 'Scopri il podcast dove indaghiamo il confine tra tecnologia e biologia.',
      url: SPOTIFY_URL,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(SPOTIFY_URL).then(() => alert('Link copiato!'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
    >
      <SEO
        title="Podcast — Umanità o IA?"
        description="Ascolta il podcast 'Umanità o IA?' di ANDRYXify (Andrea Taliento). Episodi su intelligenza artificiale, gaming, tecnologia e il futuro dell'umanità. Disponibile su Spotify e Apple Podcast."
        path="/podcast"
      />
      {/* Hero */}
      <header className="header" style={{ marginBottom: '1rem' }}>
        <motion.div
          style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.2rem' }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        >
          <div style={{
            width: 76, height: 76,
            borderRadius: 'var(--r-md)',
            background: 'linear-gradient(135deg,var(--secondary),var(--primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(0,245,212,.3)',
          }}>
            <Mic size={36} color="#fff" />
          </div>
        </motion.div>
        <h1 className="title"><span className="text-gradient">Umanità o IA?</span></h1>
        <p className="subtitle">Il podcast che esplora i confini tra l'essere umano e la tecnologia.</p>
      </header>

      {/* Spotify embed — full widget */}
      <motion.div
        className="glass-panel"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Headphones size={20} color="var(--secondary)" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Ascolta su Spotify</h2>
        </div>

        {/* Full Spotify show embed — tall to show full episode list */}
        <iframe
          title="Umanità o IA? – Podcast completo"
          src="https://open.spotify.com/embed/show/1wtbUNmK9cWJXum02QsxW9?utm_source=generator&theme=0"
          width="100%"
          height="500"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ borderRadius: 'var(--r-md)', display: 'block' }}
        />

        {/* Platform buttons + Share */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {platforms.map(p => (
            <motion.a
              key={p.label}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ background: p.bg, color: p.color, fontSize: '0.85rem', padding: '0.5rem 1.1rem' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {p.label}
            </motion.a>
          ))}
          <motion.button
            onClick={handleShare}
            className="btn btn-ghost"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
          >
            <Share2 size={15} /> Condividi
          </motion.button>
        </div>
      </motion.div>

      {/* About the podcast */}
      <motion.div
        className="glass-panel"
        style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎙️ Perché questo podcast?
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.85, margin: 0, fontSize: '0.95rem' }}>
          Nell'era dell'intelligenza artificiale, sappiamo davvero distinguere fra strumento e cervello in prestito?
          ANDRYXify ti guida in un viaggio tra bit e biologia, esplorando domande che nessun algoritmo sa ancora rispondere.
        </p>
        <motion.a
          href={SPOTIFY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          whileHover={{ scale: 1.05 }}
        >
          <ExternalLink size={15} /> Inizia ad ascoltare
        </motion.a>
      </motion.div>
    </motion.div>
  );
}
