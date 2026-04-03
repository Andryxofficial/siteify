import { motion } from 'framer-motion';

export default function InstagramPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="main-content"
    >
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="title"><span style={{ color: '#E1306C' }}>Instagram</span> Feed</h1>
        <p className="subtitle">Dietro le quinte, storie quotidiane e istanti catturati.</p>
      </header>

      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Esplora il profilo ufficiale @andryxify</p>
        
        {/* Simplified Instagram viewer using a nice grid of cards or iframes if permitted */}
        <div className="links-grid">
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <motion.div 
               key={i} 
               className="glass-card" 
               style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               whileHover={{ scale: 1.05 }}
             >
               <span style={{ fontSize: '2rem', opacity: 0.2 }}>📷</span>
             </motion.div>
           ))}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <a 
            href="https://instagram.com/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="nav-link" 
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', color: 'white', borderRadius: '20px', padding: '10px 30px', fontWeight: 'bold' }}
          >
            Seguimi su Instagram
          </a>
        </div>
      </div>
    </motion.div>
  );
}
