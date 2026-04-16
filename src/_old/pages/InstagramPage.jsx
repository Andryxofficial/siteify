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

      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>
          Segui @andryxify per aggiornamenti quotidiani e contenuti esclusivi.
        </p>
        
        <div style={{ marginTop: '1rem' }}>
          <a 
            href="https://instagram.com/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="nav-link" 
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', color: 'white', borderRadius: '30px', padding: '15px 45px', fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none', boxShadow: '0 5px 20px rgba(225, 48, 108, 0.3)' }}
          >
            Vedi il profilo Instagram
          </a>
        </div>
      </div>
    </motion.div>
  );
}
