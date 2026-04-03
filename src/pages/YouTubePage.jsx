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

      <section className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ height: '150px', background: 'linear-gradient(45deg, #FF0000, #400000)', position: 'relative' }}>
          {/* Faux banner area */}
        </div>
        <div style={{ padding: '0 2rem 3rem 2rem', textAlign: 'center', marginTop: '-60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/logo.png" 
            alt="ANDRYXify Channel" 
            style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid var(--bg-dark)', background: '#111', marginBottom: '1rem', position: 'relative', zIndex: 2 }} 
          />
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ANDRYXify</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '500px' }}>
            Tutte le live, estratti, approfondimenti sull'intelligenza artificiale, le reaction e il gaming. Esplora tutti i contenuti originali e unisciti alla community!
          </p>
          <a 
            href="https://youtube.com/@ANDRYXify" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'inline-block', background: '#FF0000', color: 'white', borderRadius: '30px', padding: '12px 40px', fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none', transition: 'transform 0.2s', boxShadow: '0 5px 20px rgba(255,0,0,0.3)' }}
          >
            Visita il Canale
          </a>
        </div>
      </section>
    </motion.div>
  );
}
