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

      <div className="twitch-container glass-panel">
        <div className="player-side">
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}`}
            height="100%"
            width="100%"
            allowFullScreen
          ></iframe>
        </div>
        <div className="chat-side">
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
          <div className="glass-card link-item" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>🎮</span>
              <h3 style={{ color: '#9146FF', margin: 0 }}>Variety Gaming</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Dagli sparatutto adrenalinici ai capolavori indie. Gioco di tutto esplorando storie e meccaniche uniche, senza mai annoiarmi su un solo titolo.</p>
          </div>
          <div className="glass-card link-item" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>🎙️</span>
              <h3 style={{ color: '#00f5d4', margin: 0 }}>Just Chatting & Tech</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Non solo gameplay: ci prendiamo il nostro tempo per chiacchierare a ruota libera, analizzare l'IA, commentare le news tech e filosofeggiare sul futuro.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '3rem', marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#00f5d4' }}>💖</span> Supporta il Canale
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Unisciti alla community o supporta direttamente lo stream! Ogni interazione è oro.
        </p>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          
          <motion.a 
            href="https://streamlabs.com/andryxify/tip" 
            target="_blank" 
            rel="noreferrer"
            className="glass-card link-item" 
            style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: 'rgba(49, 196, 141, 0.1)', border: '1px solid rgba(49, 196, 141, 0.3)' }}
            whileHover={{ scale: 1.05 }}
          >
            <h3 style={{ color: '#31C48D', margin: 0, fontSize: '1.2rem' }}>Streamlabs</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fai una Donazione</span>
          </motion.a>

          <motion.a 
            href="https://streamelements.com/andryxify/tip" 
            target="_blank" 
            rel="noreferrer"
            className="glass-card link-item" 
            style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: 'rgba(67, 181, 129, 0.1)', border: '1px solid rgba(67, 181, 129, 0.3)' }}
            whileHover={{ scale: 1.05 }}
          >
            <h3 style={{ color: '#43b581', margin: 0, fontSize: '1.2rem' }}>StreamElements</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supporto Grafico</span>
          </motion.a>

          <motion.a 
            href="https://www.tangia.co/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="glass-card link-item" 
            style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: 'rgba(164, 91, 255, 0.1)', border: '1px solid rgba(164, 91, 255, 0.3)' }}
            whileHover={{ scale: 1.05 }}
          >
            <h3 style={{ color: '#a45bff', margin: 0, fontSize: '1.2rem' }}>Tangia</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Interazioni in Live</span>
          </motion.a>

          <motion.a 
            href="https://x.la/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="glass-card link-item" 
            style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: 'rgba(255, 105, 180, 0.1)', border: '1px solid rgba(255, 105, 180, 0.3)' }}
            whileHover={{ scale: 1.05 }}
          >
            <h3 style={{ color: '#ff69b4', margin: 0, fontSize: '1.2rem' }}>x.la</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pagina Donazioni</span>
          </motion.a>

        </div>
      </div>
    </motion.div>
  );
}
