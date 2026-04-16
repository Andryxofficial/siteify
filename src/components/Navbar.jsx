import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Home as HomeIcon, Twitch as TwitchIcon, Youtube as YoutubeIcon, Instagram as InstagramIcon, Mic as MicIcon } from 'lucide-react';

const NAV_LINKS = [
  { path: '/',          label: 'Home',      Icon: HomeIcon      },
  { path: '/twitch',    label: 'Twitch',    Icon: TwitchIcon    },
  { path: '/youtube',   label: 'YouTube',   Icon: YoutubeIcon   },
  { path: '/instagram', label: 'Instagram', Icon: InstagramIcon },
  { path: '/podcast',   label: 'Podcast',   Icon: MicIcon       },
];

const LOGO_URL =
  'https://github.com/user-attachments/assets/f721344e-6153-4d66-b5ad-a8a39945fa99';

/* ─────────────────────────────────────────────────────────
   LIQUID GLASS PILL  (desktop drag indicator)
   ───────────────────────────────────────────────────────── */
function LiquidPill({ activePath, onNavigate, containerRef, linkRefs }) {
  const x     = useMotionValue(0);
  const pillW = useMotionValue(90);

  const [isDragging, setIsDragging] = useState(false);
  const [hoverTarget, setHoverTarget] = useState(activePath);
  const [ready, setReady] = useState(false);
  const wasDragging = useRef(false);

  const getInfo = useCallback((path) => {
    const container = containerRef.current;
    const link      = linkRefs.current?.[path];
    if (!container || !link) return { x: 0, w: 90 };
    const cR = container.getBoundingClientRect();
    const lR = link.getBoundingClientRect();
    return { x: lR.left - cR.left, w: lR.width };
  }, [containerRef, linkRefs]);

  useEffect(() => {
    const t = setTimeout(() => {
      const info = getInfo(activePath);
      if (info.w > 0) { x.set(info.x); pillW.set(info.w); setHoverTarget(activePath); setReady(true); }
    }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDragging || !ready) return;
    const info = getInfo(activePath);
    animate(x, info.x, { type: 'spring', stiffness: 340, damping: 30 });
    animate(pillW, info.w, { type: 'spring', stiffness: 340, damping: 30 });
    setHoverTarget(activePath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, ready]);

  useEffect(() => {
    const onResize = () => {
      if (isDragging || !ready) return;
      const info = getInfo(activePath);
      x.set(info.x); pillW.set(info.w);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePath, isDragging, ready, getInfo, x, pillW]);

  const handleDragStart = useCallback(() => { setIsDragging(true); wasDragging.current = true; }, []);
  const handleDrag = useCallback((_, info) => {
    for (const [path, ref] of Object.entries(linkRefs.current || {})) {
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      if (info.point.x >= rect.left - 10 && info.point.x <= rect.right + 10) {
        if (path !== hoverTarget) { setHoverTarget(path); animate(pillW, getInfo(path).w, { type: 'spring', stiffness: 380, damping: 26 }); }
        return;
      }
    }
  }, [linkRefs, hoverTarget, getInfo, pillW]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const info = getInfo(hoverTarget);
    animate(x, info.x, { type: 'spring', stiffness: 420, damping: 32 });
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
   ───────────────────────────────────────────────────────── */
export default function Navbar() {
  const location          = useLocation();
  const navigate          = useNavigate();
  const linksContainerRef = useRef(null);
  const linkRefs          = useRef({});

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
          >
            <LiquidPill
              activePath={location.pathname}
              onNavigate={navigate}
              containerRef={linksContainerRef}
              linkRefs={linkRefs}
            />
            {NAV_LINKS.map(({ path, label, Icon }) => {
              const isActive = location.pathname === path;
              return (
                <div
                  key={path}
                  ref={el => { linkRefs.current[path] = el; }}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <Link
                    to={path}
                    className={`nav-link${isActive ? ' active' : ''}`}
                    style={{ position: 'relative', zIndex: isActive ? 0 : 1 }}
                  >
                    <motion.span
                      whileHover={{ scale: 1.2, rotate: 5 }}
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
