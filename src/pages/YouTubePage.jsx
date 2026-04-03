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

      <section className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
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

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#FF0000' }}>▶</span> Ultimi Video
        </h3>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {[1, 2, 3, 4].map((i) => (
             <motion.div 
               key={i} 
               className="glass-card" 
               style={{ overflow: 'hidden', padding: 0 }}
               whileHover={{ scale: 1.05 }}
             >
               <div style={{ width: '100%', aspectRatio: '16/9', background: `linear-gradient(45deg, #222, #111)`, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>14:2{i}</div>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem' }}>▶</span>
               </div>
               <div style={{ padding: '15px' }}>
                 <h4 style={{ margin: 0, fontSize: '1rem', lineHeight: '1.3' }}>Titolo video di esempio #{i} (Mock)</h4>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>1{i}k visualizzazioni • {i} giorni fa</p>
               </div>
             </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
