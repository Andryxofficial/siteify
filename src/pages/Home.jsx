import { motion } from 'framer-motion';
import { Twitch, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';

export default function Home() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
    >
      <section className="header">
        <motion.h1 
          className="title"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ letterSpacing: '-2px' }}
        >
          <span className="text-gradient">ANDRYX</span>ify
        </motion.h1>
        <motion.p 
          className="subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ color: 'var(--text-muted)', fontWeight: 400 }}
        >
          Esplorando il confine tra <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Umanità</span>, <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Intelligenza Artificiale</span> e <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Gaming</span>.
        </motion.p>
      </section>

      {/* Twitch Preview Section */}
      <motion.section 
        className="glass-panel" 
        style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Twidech size={24} color="#9146FF" />
          <h2 style={{ fontSize: '1.4rem' }}>Live Preview</h2>
          <span className="live-status-badge"></span>
        </div>
        <div className="player-wrapper glass-card" style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}&muted=true`}
            height="100%"
            width="100%"
            allowFullScreen
            style={{ border: 'none' }}
          ></iframe>
        </div>
        <Link to="/twitch" className="nav-link" style={{ alignSelf: 'center', marginTop: '0.5rem', background: 'var(--primary)', color: 'white', borderRadius: '20px', padding: '8px 25px' }}>
          Vedi tutto
        </Link>
      </motion.section>

      <SocialHub />
      
      <PodcastPromo />
      
    </motion.div>
  );
}

// Fixed Lucide icon name: Twitch
function Twidech(props) { return <Twitch {...props} /> }
