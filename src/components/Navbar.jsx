import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Twitch, Youtube, Instagram, Mic } from 'lucide-react';

const navLinks = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/twitch', label: 'Twitch', icon: <Twitch size={18} /> },
  { path: '/youtube', label: 'YouTube', icon: <Youtube size={18} /> },
  { path: '/instagram', label: 'Instagram', icon: <Instagram size={18} /> },
  { path: '/podcast', label: 'Podcast', icon: <Mic size={18} /> },
];

export default function Navbar() {
  const location = useLocation();
  const [twitchUser, setTwitchUser] = useState(null);

  const clientId = 'i08d9n8i6zv0atnj3hyn70vbbu3yye';
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'https://andryxify.it';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=user:read:email`;

  useEffect(() => {
    const fetchTwitchUser = async () => {
      const token = localStorage.getItem('twitchAccessToken');
      if (token) {
        try {
          const res = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Client-Id': clientId
            }
          });
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            setTwitchUser(data.data[0]);
          } else {
            // Invalid token
            localStorage.removeItem('twitchAccessToken');
          }
        } catch (e) {
          console.error('Failed to fetch Twitch user', e);
        }
      }
    };
    // Slight delay to allow App.jsx to set localStorage if we just redirected back
    setTimeout(fetchTwitchUser, 500); 
  }, []);

  return (
    <>
    <nav className="navbar-container glass-panel">
      <div className="navbar-content">
        <Link to="/" className="navbar-logo" style={{ textDecoration: 'none' }}>
          <span className="text-gradient" style={{ fontWeight: 800 }}>ANDRYX</span>ify
        </Link>
        <div className="nav-links">
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              <motion.span 
                className="nav-icon"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                {link.icon}
              </motion.span>
              <span className="nav-label">{link.label}</span>
              {location.pathname === link.path && (
                <motion.div 
                  layoutId="active-pill"
                  className="active-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
    <div className="top-right-auth">
      {twitchUser ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="login-btn" title="Logout">
          <img src={twitchUser.profile_image_url} alt="Profile" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
          <span style={{ fontSize: '0.9rem' }}>{twitchUser.display_name}</span>
          <button 
            onClick={() => { localStorage.removeItem('twitchAccessToken'); window.location.reload(); }}
            style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', marginLeft: '5px', fontWeight: 'bold' }}
            title="Log out"
          >
            x
          </button>
        </div>
      ) : (
        <motion.a 
          href={authUrl}
          className="login-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Twitch size={18} />
          <span className="login-text">Accedi</span>
        </motion.a>
      )}
    </div>
    </>
  );
}
