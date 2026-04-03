import { motion } from 'framer-motion';

export default function YouTubePage() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="main-content"
    >
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="title"><span style={{ color: '#FF0000' }}>YouTube</span> Hub</h1>
        <p className="subtitle">Video nonsense, analisi profonde e pillole di saggezza digitale.</p>
      </header>

      <section className="glass-panel" style={{ padding: '2rem' }}>
        <div className="player-wrapper glass-card" style={{ aspectRatio: '16/9', overflow: 'hidden', marginBottom: '2rem' }}>
          {/* Latest Video placeholder - using the channel URL might require API for dynamic latest, using embed of specific if any, or general */}
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed?listType=user_uploads&list=ANDRYXify"
            title="Latest from ANDRYXify"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <a 
            href="https://youtube.com/@ANDRYXify" 
            target="_blank" 
            rel="noreferrer"
            className="nav-link" 
            style={{ display: 'inline-block', background: '#FF0000', color: 'white', borderRadius: '20px', padding: '10px 30px', fontWeight: 'bold' }}
          >
            Iscriviti al Canale
          </a>
        </div>
      </section>
    </motion.div>
  );
}
