import { motion } from 'framer-motion';
import { Mic, Radio } from 'lucide-react';

export default function PodcastPromo() {
  return (
    <motion.section 
      className="glass-panel podcast-section"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.8, type: "spring" }}
      whileHover={{ boxShadow: "0 10px 40px rgba(0, 245, 212, 0.15)" }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <Mic size={28} color="var(--secondary)" />
        <h2 className="podcast-header">
          <span className="text-gradient">Umanità o IA?</span>
        </h2>
        <Radio size={28} color="var(--primary)" />
      </div>
      
      <p style={{ color: 'var(--text-muted)' }}>
        Riflessioni, domande e indagini per capire come le nuove tecnologie stiano cambiando la nostra essenza.
      </p>

      <div className="podcast-player glass-card">
        {/* Placeholder for an actual Spotify/Apple embed if available, or just a cool visualizer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'linear-gradient(45deg, #1DB954, #191414)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '24px' }}>🎧</span>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Episodio Recente</h4>
            <span style={{ fontSize: '0.85rem', color: '#adb5bd' }}>ANDRYXify • Umanità o IA?</span>
          </div>
          <motion.a 
            href="https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9?si=whQgruxhQ_i34elguQP8Eg" 
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              padding: '8px 20px', 
              borderRadius: '20px', 
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Ascolta
          </motion.a>
        </div>
      </div>
    </motion.section>
  );
}
