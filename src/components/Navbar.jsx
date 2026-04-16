import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Twitch, Youtube, Instagram, Mic } from 'lucide-react';

const navLinks = [
  { path: '/',          label: 'Home',      icon: <Home      size={16} /> },
  { path: '/twitch',    label: 'Twitch',    icon: <Twitch    size={16} /> },
  { path: '/youtube',   label: 'YouTube',   icon: <Youtube   size={16} /> },
  { path: '/instagram', label: 'Instagram', icon: <Instagram size={16} /> },
  { path: '/podcast',   label: 'Podcast',   icon: <Mic       size={16} /> },
];

const LOGO_URL = 'https://github.com/user-attachments/assets/f721344e-6153-4d66-b5ad-a8a39945fa99';
const CLIENT_ID = 'i08d9n8i6zv0atnj3hyn70vbbu3yye';

export default function Navbar() {
  const location  = useLocation();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [twitchUser,  setTwitchUser]  = useState(null);

  const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'https://andryxify.it';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=user:read:email`;

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]); // eslint-disable-line react-hooks/set-state-in-effect

  // Fetch Twitch user from stored token
  useEffect(() => {
    const fetchTwitchUser = async () => {
      const token = localStorage.getItem('twitchAccessToken');
      if (!token) return;
      try {
        const res  = await fetch('https://api.twitch.tv/helix/users', {
          headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': CLIENT_ID },
        });
        const data = await res.json();
        if (data.data?.length > 0) {
          setTwitchUser(data.data[0]);
        } else {
          localStorage.removeItem('twitchAccessToken');
        }
      } catch (e) {
        console.error('Failed to fetch Twitch user', e);
      }
    };
    setTimeout(fetchTwitchUser, 500);
  }, []);

  return (
    <>
      {/* ── Desktop / Tablet pill navbar ── */}
      <nav className="navbar-container glass-panel">
        <div className="navbar-content">
          {/* Logo firma */}
          <Link to="/" className="navbar-logo" aria-label="ANDRYXify – Home">
            <img
              src={LOGO_URL}
              alt="Andryx"
              style={{
                height: '34px',
                width: 'auto',
                display: 'block',
                filter: 'invert(1) hue-rotate(180deg)',
                mixBlendMode: 'screen',
                objectFit: 'contain',
              }}
            />
          </Link>

          {/* Desktop links */}
          <div className="nav-links">
            {navLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <motion.span whileHover={{ scale: 1.15, rotate: 5 }} style={{ display: 'flex' }}>
                    {link.icon}
                  </motion.span>
                  <span className="nav-label">{link.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="active-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Hamburger (mobile only) */}
          <button
            className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── Mobile slide-down drawer ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="nav-mobile-drawer open"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            {navLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-mobile-link ${isActive ? 'active' : ''}`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Twitch auth button (top-right) ── */}
      <div className="top-right-auth">
        {twitchUser ? (
          <div className="login-btn" title="Sei connesso con Twitch">
            <img
              src={twitchUser.profile_image_url}
              alt={twitchUser.display_name}
              style={{ width: 22, height: 22, borderRadius: '50%' }}
            />
            <span style={{ fontSize: '0.85rem' }}>{twitchUser.display_name}</span>
            <button
              onClick={() => { localStorage.removeItem('twitchAccessToken'); window.location.reload(); }}
              style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontWeight: 800, lineHeight: 1 }}
              title="Logout"
            >
              ×
            </button>
          </div>
        ) : (
          <motion.a
            href={authUrl}
            className="login-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Twitch size={16} />
            <span className="login-text">Accedi</span>
          </motion.a>
        )}
      </div>
    </>
  );
}
