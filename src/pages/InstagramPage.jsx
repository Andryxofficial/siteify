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
        
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <motion.div 
               key={i} 
               style={{ aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}
               whileHover={{ scale: 1.05 }}
             >
               <img src={`https://picsum.photos/seed/andryxify${i}/300/300`} alt={`Instagram post mock ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               {/* Hover overlay hint */}
               <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s', className: 'ig-hover-overlay' }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0}>
                 <span style={{ color: 'white', fontWeight: 'bold' }}>❤️ 1.2k</span>
               </div>
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
