import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion';
import { Home, Twitch, Youtube, Instagram, Mic } from 'lucide-react';

const navLinks = [
  { path: '/',          label: 'Home',      icon: <Home      size={16} /> },
  { path: '/twitch',    label: 'Twitch',    icon: <Twitch    size={16} /> },
  { path: '/youtube',   label: 'YouTube',   icon: <Youtube   size={16} /> },
  { path: '/instagram', label: 'Instagram', icon: <Instagram size={16} /> },
  { path: '/podcast',   label: 'Podcast',   icon: <Mic       size={16} /> },
];

const LOGO_URL =
  'https://github.com/user-attachments/assets/f721344e-6153-4d66-b5ad-a8a39945fa99';

/* ─────────────────────────────────────────────────────────
   LIQUID GLASS PILL — draggabile, liquida, magica
   ───────────────────────────────────────────────────────── */
function LiquidPill({ activePath, onNavigate, containerRef, linkRefs }) {
  const x     = useMotionValue(0);
  const pillW = useMotionValue(90);

  const [isDragging, setIsDragging]   = useState(false);
  const [hoverTarget, setHoverTarget] = useState(activePath);
  const [ready, setReady]             = useState(false);
  const wasDragging                   = useRef(false);

  const getInfo = useCallback((path) => {
    const container = containerRef.current;
    const link      = linkRefs.current?.[path];
    if (!container || !link) return { x: 0, w: 90 };
    const cR = container.getBoundingClientRect();
    const lR = link.getBoundingClientRect();
    return { x: lR.left - cR.left, w: lR.width };
  }, [containerRef, linkRefs]);

  /* Init */
  useEffect(() => {
    const t = setTimeout(() => {
      const info = getInfo(activePath);
      if (info.w > 0) {
        x.set(info.x);
        pillW.set(info.w);
        setHoverTarget(activePath);
        setReady(true);
      }
    }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sync on route change */
  useEffect(() => {
    if (isDragging || !ready) return;
    const info = getInfo(activePath);
    animate(x,     info.x, { type: 'spring', stiffness: 340, damping: 30 });
    animate(pillW, info.w, { type: 'spring', stiffness: 340, damping: 30 });
    setHoverTarget(activePath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, ready]);

  /* Resize */
  useEffect(() => {
    const onResize = () => {
      if (isDragging || !ready) return;
      const info = getInfo(activePath);
      x.set(info.x);
      pillW.set(info.w);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePath, isDragging, ready, getInfo, x, pillW]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    wasDragging.current = true;
  }, []);

  const handleDrag = useCallback((_, info) => {
    for (const [path, ref] of Object.entries(linkRefs.current || {})) {
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      if (info.point.x >= rect.left - 10 && info.point.x <= rect.right + 10) {
        if (path !== hoverTarget) {
          setHoverTarget(path);
          animate(pillW, getInfo(path).w, { type: 'spring', stiffness: 380, damping: 26 });
        }
        return;
      }
    }
  }, [linkRefs, hoverTarget, getInfo, pillW]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const info = getInfo(hoverTarget);
    animate(x,     info.x, { type: 'spring', stiffness: 420, damping: 32 });
    animate(pillW, info.w, { type: 'spring', stiffness: 420, damping: 32 });
    onNavigate(hoverTarget);
    setTimeout(() => { wasDragging.current = false; }, 50);
  }, [hoverTarget, getInfo, x, pillW, onNavigate]);

  if (!ready) return null;

  return (
    <motion.div
      className={`liquid-nav-pill${isDragging ? ' is-dragging' : ''}`}
      drag="x"
      dragConstraints={containerRef}
      dragElastic={0.06}
      dragMomentum={false}
      style={{ x, width: pillW, position: 'absolute', top: 0, left: 0, height: '100%' }}
      animate={{ scale: isDragging ? 1.1 : 1, zIndex: isDragging ? 9999 : 2 }}
      transition={{ scale: { type: 'spring', stiffness: 260, damping: 18 } }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   NAVBAR
   ───────────────────────────────────────────────────────── */
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const linksContainerRef = useRef(null);
  const linkRefs          = useRef({});

  useEffect(() => {
    setMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [location.pathname]);

  return (
    <>
      {/* ── Pill navbar ── */}
      <nav className="navbar-container glass-panel">
        <div className="navbar-content">

          <Link to="/" className="navbar-logo" aria-label="ANDRYXify – Home">
            <img src={LOGO_URL} alt="Andryx" className="navbar-logo-img" />
          </Link>

          <div
            ref={linksContainerRef}
            className="nav-links"
            style={{ position: 'relative', overflow: 'visible' }}
          >
            <LiquidPill
              activePath={location.pathname}
              onNavigate={navigate}
              containerRef={linksContainerRef}
              linkRefs={linkRefs}
            />

            {navLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <div
                  key={link.path}
                  ref={el => { linkRefs.current[link.path] = el; }}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <Link
                    to={link.path}
                    className={`nav-link${isActive ? ' active' : ''}`}
                    style={{ position: 'relative', zIndex: isActive ? 0 : 1 }}
                  >
                    <motion.span
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      style={{ display: 'flex', pointerEvents: 'none' }}
                    >
                      {link.icon}
                    </motion.span>
                    <span className="nav-label" style={{ pointerEvents: 'none' }}>
                      {link.label}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>

          <button
            className={`nav-hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="nav-mobile-drawer open"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-mobile-link${location.pathname === link.path ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
