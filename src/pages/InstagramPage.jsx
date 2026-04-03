import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function InstagramPage() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sostituisci questo URL con quello che ti fornisce Behold.so
  const BEHOLD_API_URL = "https://behold.so/api/v1/posts?api_key=IL_TUO_API_KEY";

  useEffect(() => {
    fetch(BEHOLD_API_URL)
      .then(res => res.json())
      .then(data => {
        setFeed(data.slice(0, 6)); // Prendiamo solo le ultime 6 foto
        setLoading(false);
      })
      .catch(err => console.error("Errore nel caricamento del feed:", err));
  }, []);

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
        
        {loading ? (
          <p>Caricamento istanti...</p>
        ) : (
          <div className="links-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px' 
          }}>
            {feed.map((post) => (
              <motion.a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                style={{ aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', position: 'relative', display: 'block' }}
                whileHover={{ scale: 1.03 }}
              >
                <img 
                  src={post.media_url} 
                  alt={post.caption || "Instagram post"} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                
                {/* Overlay interattivo */}
                <div 
                  className="ig-overlay"
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: 'rgba(0,0,0,0.4)', 
                    opacity: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    transition: 'opacity 0.3s',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                >
                  <span>Vedi su IG</span>
                </div>
              </motion.a>
            ))}
          </div>
        )}

        <div style={{ marginTop: '2rem' }}>
          <a 
            href="https://instagram.com/andryxify" 
            target="_blank" 
            rel="noreferrer"
            className="nav-link" 
            style={{ 
              display: 'inline-block', 
              background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', 
              color: 'white', 
              borderRadius: '20px', 
              padding: '12px 35px', 
              fontWeight: 'bold',
              textDecoration: 'none'
            }}
          >
            Seguimi su Instagram
          </a>
        </div>
      </div>
    </motion.div>
  );
}
