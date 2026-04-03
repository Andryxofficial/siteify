import { motion } from 'framer-motion';

export default function TwitchPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="main-content"
      style={{ maxWidth: '1200px' }}
    >
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="title"><span style={{ color: '#9146FF' }}>Twitch</span> Experience</h1>
        <p className="subtitle">Segui le dirette, interagisci in chat e scopri i momenti migliori.</p>
      </header>

      <div className="twitch-container glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1px', background: 'var(--glass-border)', overflow: 'hidden', minHeight: '600px', borderRadius: '24px' }}>
        <div className="player-side" style={{ background: 'black' }}>
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}`}
            height="100%"
            width="100%"
            allowFullScreen
          ></iframe>
        </div>
        <div className="chat-side" style={{ background: 'var(--glass-bg)' }}>
          <iframe
            src={`https://www.twitch.tv/embed/andryxify/chat?parent=${window.location.hostname}&darkpopout`}
            height="100%"
            width="100%"
          ></iframe>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Cosa aspettarti sui miei stream:</h2>
        <div className="links-grid">
          <div className="glass-card link-item" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: '#9146FF' }}>Gaming</h3>
            <p style={{ color: 'var(--text-muted)' }}>Gameplay evoluti e analisi dei titoli più attesi.</p>
          </div>
          <div className="glass-card link-item" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: '#00f5d4' }}>Tech Talk</h3>
            <p style={{ color: 'var(--text-muted)' }}>Discussioni sull'IA e l'impatto sulla società.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
