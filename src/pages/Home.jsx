import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Twitch, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';

export default function Home() {
  // 0 = Offline, 1 = Twitch Live, 2 = Twitch + YouTube Live
  const [liveState, setLiveState] = useState(0);

  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const response = await fetch('https://decapi.me/twitch/uptime/andryxify');
        const text = await response.text();
        if (text.toLowerCase().includes('offline')) {
          setLiveState(0);
        } else {
          setLiveState(1); // Real-time detection of Twitch Live
        }
      } catch (error) {
        console.error("Error fetching live status:", error);
      }
    };
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
    >
      <section className="header">
        <motion.div 
          className="profile-img-container"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
          onClick={() => setLiveState(prev => (prev + 1) % 3)}
          style={{ cursor: 'pointer' }}
          title="Segreto: Cambia stato Live"
        >
          <img 
            src="/logo.png" 
            alt="ANDRYXify Logo" 
            className="profile-img" 
            style={{ padding: '15px' }}
          />
        </motion.div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twidech size={24} color="#9146FF" />
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Live Preview</h2>
          {liveState > 0 ? (
            <span style={{ background: 'rgba(255,0,0,0.2)', color: '#ff4d4d', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(255,0,0,0.5)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4d4d', display: 'inline-block', boxShadow: '0 0 8px #ff4d4d' }}></span> LIVE NOW
            </span>
          ) : (
            <span style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: 'auto' }}>
              ⚪ OFFLINE
            </span>
          )}
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
        
        {liveState === 2 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            <a 
              href="https://youtube.com/@ANDRYXify/live"
              target="_blank"
              rel="noreferrer"
              style={{ background: 'linear-gradient(45deg, #FF0000, #990000)', color: 'white', padding: '10px 25px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(255,0,0,0.3)', width: '100%', justifyContent: 'center' }}
            >
              <span>🔴 In simulcast anche su YouTube</span>
            </a>
          </motion.div>
        )}

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
