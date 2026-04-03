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
      <motion.a 
        href="https://www.twitch.tv/login" 
        target="_blank" 
        rel="noreferrer"
        className="login-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Twitch size={18} />
        <span className="login-text">Accedi</span>
      </motion.a>
    </div>
    </>
  );
}
