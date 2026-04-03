import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Sostituisci questo con l'ID del tuo canale YouTube.
// Per trovarlo: vai sul tuo canale -> Impostazioni -> Impostazioni avanzate -> ID Canale (inizia con "UC")
const YOUTUBE_CHANNEL_ID = "UC_IL_TUO_ID_CANALE_QUI"; 
const RSS_TO_JSON_API = `https://api.rss2json.com/v1/api.json?rss_url=https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

export default function YouTubePage() {
  const [latestVideoId, setLatestVideoId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch "smart" dell'ultimo video pubblicato
    fetch(RSS_TO_JSON_API)
      .then(res => res.json())
      .then(data => {
        if (data?.items?.length > 0) {
          // data.items[0] è il video più recente. Estraiamo l'ID dall'URL.
          const videoUrl = data.items[0].link;
          const videoId = videoUrl.split('v=')[1];
          setLatestVideoId(videoId);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error("Errore nel recupero dell'ultimo video YouTube:", error);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="main-content"
    >
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="title"><span style={{ color: '#FF0000' }}>YouTube</span> Hub</h1>
        <p className="subtitle">L'ultimo contenuto, direttamente dal canale.</p>
      </header>

      <section className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ height: '150px', background: 'linear-gradient(45deg, #FF0000, #400000)', position: 'relative' }}></div>
        <div style={{ padding: '0 2rem 3rem 2rem', textAlign: 'center', marginTop: '-60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/logo.png" 
            alt="ANDRYXify Channel" 
            style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid var(--bg-dark)', background: '#111', marginBottom: '1rem', position: 'relative', zIndex: 2 }} 
          />
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ANDRYXify</h2>
          <a 
            href="https://youtube.com/@ANDRYXify" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'inline-block', background: '#FF0000', color: 'white', borderRadius: '30px', padding: '10px 30px', fontWeight: 'bold', fontSize: '1rem', textDecoration: 'none', marginTop: '1rem' }}
          >
            Iscriviti al Canale
          </a>
        </div>
      </section>

      {/* PLAYER SMART: Mostra l'ultimo video in grande */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#FF0000' }}>▶</span> In Riproduzione
        </h3>
        
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Caricamento ultimo video...
            </div>
          ) : latestVideoId ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe 
                src={`https://www.youtube.com/embed/${latestVideoId}?autoplay=0`} 
                title="Ultimo Video YouTube"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nessun video trovato.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
