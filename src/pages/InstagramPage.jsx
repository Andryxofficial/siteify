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
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Gli ultimi aggiornamenti direttamente dal profilo.
        </p>
        
        {/* WIDGET SMART INSTAGRAM */}
        <div className="instagram-widget-container" style={{ minHeight: '400px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* ISTRUZIONI: 
              1. Vai su un sito come behold.so o elfsight.com
              2. Crea un widget gratuito collegando il tuo Instagram
              3. Incolla qui l'iframe o il div che ti forniscono! 
              
              Esempio di come apparirà il codice che ti daranno:
              <iframe src="LINK_DEL_TUO_WIDGET" width="100%" height="600px" frameBorder="0"></iframe>
          */}
          
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            [Incolla qui il codice del Widget Instagram (es. Elfsight o Behold.so) per il feed dinamico]
          </p>
          
        </div>

        <div style={{ marginTop: '3rem' }}>
          <a 
            href="https://instagram.com/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="nav-link" 
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', color: 'white', borderRadius: '30px', padding: '12px 40px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 5px 20px rgba(225, 48, 108, 0.3)' }}
          >
            Seguimi su Instagram
          </a>
        </div>
      </div>
    </motion.div>
  );
}
