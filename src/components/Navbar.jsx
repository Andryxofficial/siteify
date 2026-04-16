import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home as HomeIcon, Twitch as TwitchIcon, Youtube as YoutubeIcon, Instagram as InstagramIcon, Mic as MicIcon, Gamepad2 as GameIcon } from 'lucide-react';
import TikTokIcon from './TikTokIcon';

const NAV_LINKS = [
  { path: '/',          label: 'Home',      Icon: HomeIcon      },
  { path: '/twitch',    label: 'Twitch',    Icon: TwitchIcon    },
  { path: '/youtube',   label: 'YouTube',   Icon: YoutubeIcon   },
  { path: '/instagram', label: 'Instagram', Icon: InstagramIcon },
  { path: '/podcast',   label: 'Podcast',   Icon: MicIcon       },
  { path: '/tiktok',    label: 'TikTok',    Icon: ({ size }) => <TikTokIcon size={size} /> },
  { path: '/gioco',     label: 'Gioco',     Icon: GameIcon      },
];

const LOGO_URL = '/logo.png';

/* ─────────────────────────────────────────────────────────
   MOBILE BOTTOM TAB BAR  (iOS-style, liquid glass)
   ─────────────────────────────────────────────────────────
   Pill uses declarative `animate` prop with % positioning —
   no DOM measurements, no imperative animate(), works on
   framer-motion v10/11/12.
   ───────────────────────────────────────────────────────── */
function MobileTabBar({ activePath, onNavigate }) {
  const touchStartX  = useRef(0);
  const touchStartY  = useRef(0);
  const isHorizontal = useRef(false);

  const activeIdx   = NAV_LINKS.findIndex(l => l.path === activePath);
  const tabWidthPct = 100 / NAV_LINKS.length; // each slot is 20%

  const handleTouchStart = useCallback((e) => {
    touchStartX.current  = e.touches[0].clientX;
    touchStartY.current  = e.touches[0].clientY;
    isHorizontal.current = false;
  }, []);

  const handleTouchMove = useCallback((e) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isHorizontal.current && Math.abs(dx) > 6)
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!isHorizontal.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 30) return;
    const nextIdx = dx < 0
      ? Math.min(activeIdx + 1, NAV_LINKS.length - 1)
      : Math.max(activeIdx - 1, 0);
    if (nextIdx !== activeIdx) onNavigate(NAV_LINKS[nextIdx].path);
  }, [activeIdx, onNavigate]);

  return (
    <nav
      className="mobile-tab-bar"
      aria-label="Navigazione principale"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mobile-tab-items">

        {/* ── Sliding liquid glass pill ── */}
        <motion.div
          className="mobile-tab-pill"
          animate={{ left: `${activeIdx * tabWidthPct}%`, width: `${tabWidthPct}%` }}
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
        />

        {/* ── Tab items ── */}
        {NAV_LINKS.map(({ path, label, Icon }) => {
          const isActive = activePath === path;
          return (
            <Link
              key={path}
              to={path}
              className={`tab-item${isActive ? ' active' : ''}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <motion.span
                className="tab-icon"
                animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                <Icon size={22} />
              </motion.span>
              <motion.span
                className="tab-label"
                animate={{ opacity: isActive ? 1 : 0.5 }}
                transition={{ duration: 0.2 }}
              >
                {label}
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────
   DESKTOP TOP NAVBAR
   ─────────────────────────────────────────────────────────
   Pill uses declarative animate={{ left, width }} with
   pixel state values — no MotionValues, no imperative
   animate(), no drag. Pill follows hover across links
   (Apple-style), returns to activePath on mouse-leave.
   ───────────────────────────────────────────────────────── */
export default function Navbar() {
  const location          = useLocation();
  const navigate          = useNavigate();
  const linksContainerRef = useRef(null);
  const linkRefs          = useRef({});

  const [hoveredPath, setHoveredPath] = useState(null);
  const [pillPos,     setPillPos]     = useState({ left: 0, width: 0 });
  const [pillReady,   setPillReady]   = useState(false);

  // displayPath: hover takes priority over active route
  const displayPath = hoveredPath ?? location.pathname;

  const getInfo = useCallback((path) => {
    const container = linksContainerRef.current;
    const link      = linkRefs.current?.[path];
    if (!container || !link) return null;
    const cR = container.getBoundingClientRect();
    const lR = link.getBoundingClientRect();
    return { left: lR.left - cR.left, width: lR.width };
  }, []);

  /* ── Init pill on mount ── */
  useEffect(() => {
    const t = setTimeout(() => {
      const info = getInfo(location.pathname);
      if (info && info.width > 0) { setPillPos(info); setPillReady(true); }
    }, 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Follow displayPath (hover or route) ── */
  useEffect(() => {
    if (!pillReady) return;
    const info = getInfo(displayPath);
    if (info) setPillPos(info);
  }, [displayPath, pillReady, getInfo]);

  /* ── Resize: recompute without animation ── */
  useEffect(() => {
    const onResize = () => {
      if (!pillReady) return;
      const info = getInfo(displayPath);
      if (info) setPillPos(info);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [displayPath, pillReady, getInfo]);

  return (
    <>
      {/* ── Top pill navbar (desktop) ── */}
      <nav className="navbar-container glass-panel">
        <div className="navbar-content">
          <Link to="/" className="navbar-logo" aria-label="ANDRYXify – Home">
            <img src={LOGO_URL} alt="Andryx" className="navbar-logo-img" />
          </Link>

          <div
            ref={linksContainerRef}
            className="nav-links"
            style={{ position: 'relative', overflow: 'visible' }}
            onMouseLeave={() => setHoveredPath(null)}
          >
            {/* ── Sliding liquid glass pill ── */}
            {pillReady && (
              <motion.div
                className="liquid-nav-pill"
                initial={false}
                animate={{ left: pillPos.left, width: pillPos.width }}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
              />
            )}

            {NAV_LINKS.map(({ path, label, Icon }) => {
              const isActive = location.pathname === path;
              return (
                <div
                  key={path}
                  ref={el => { linkRefs.current[path] = el; }}
                  style={{ position: 'relative', zIndex: 1 }}
                  onMouseEnter={() => setHoveredPath(path)}
                >
                  <Link
                    to={path}
                    className={`nav-link${isActive ? ' active' : ''}`}
                  >
                    <motion.span
                      whileHover={{ scale: 1.15, rotate: 4 }}
                      style={{ display: 'flex', pointerEvents: 'none' }}
                    >
                      <Icon size={16} />
                    </motion.span>
                    <span className="nav-label" style={{ pointerEvents: 'none' }}>{label}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobile only) ── */}
      <MobileTabBar activePath={location.pathname} onNavigate={navigate} />
    </>
  );
}
