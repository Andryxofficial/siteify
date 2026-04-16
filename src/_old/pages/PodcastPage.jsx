import { motion } from 'framer-motion';
import { Mic, Headphones, Share2 } from 'lucide-react';

export default function PodcastPage() {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Umanità o IA? - ANDRYXify Podcast',
        text: "Scopri il podcast dove indaghiamo il confine tra tecnologia e biologia.",
        url: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9?si=whQgruxhQ_i34elguQP8Eg',
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText('https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9?si=whQgruxhQ_i34elguQP8Eg').then(() => {
        alert("Link copiato negli appunti!");
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="main-content"
    >
      <header className="header" style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '1rem' }}>
           <Mic size={48} color="#00f5d4" />
           <Headphones size={48} color="#9d4edd" />
        </div>
        <h1 className="title"><span className="text-gradient">Umanità o IA?</span></h1>
        <p className="subtitle">Il podcast che esplora i confini tra l'essere umano e la tecnologia.</p>
      </header>

      <div className="glass-panel" style={{ padding: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Ascolta l'Ultimo Episodio</h2>
        
        {/* Placeholder for real podcast widget (Spotify/Apple) */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '16px', background: 'linear-gradient(45deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🎙️</span>
          </div>
          <div style={{ flex: 1 }}>
             <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Inizia ad ascoltare ora</h3>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scegli la tua piattaforma preferita per tuffarti negli ultimi episodi integrali.</p>
             <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <a href="https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9?si=whQgruxhQ_i34elguQP8Eg" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ background: '#1DB954', color: 'white', borderRadius: '20px', padding: '8px 20px', fontWeight: '600', textDecoration: 'none' }}>Spotify</a>
                <a href="https://podcasts.apple.com/it/podcast/umanit%C3%A0-o-ia/id1869893930" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ background: '#FF1A1A', color: 'white', borderRadius: '20px', padding: '8px 20px', fontWeight: '600', textDecoration: 'none' }}>Apple Podcast</a>
                <a href="https://youtube.com/playlist?list=PLFG8B0vJXbXcvI4M3trS3cyfQuH6A6hub&si=z-Y4DsUht0BEkrvy" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ background: '#FF0000', color: 'white', borderRadius: '20px', padding: '8px 20px', fontWeight: '600', textDecoration: 'none' }}>YouTube Music</a>
                <button onClick={handleShare} className="glass-card" style={{ borderRadius: '20px', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '5px', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><Share2 size={16} /> Share</button>
             </div>
          </div>
        </div>

        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Perché questo podcast?</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
            Nell'era dell'intelligenza artificiale, sappiamo davvero distinguere fra strumento e cervello in prestito? ANDRYXify ti guida in questo viaggio tra bit e biologia.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
