import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from 'framer-motion';
import { Home as HomeIcon, Twitch as TwitchIcon, Youtube as YoutubeIcon, Instagram as InstagramIcon, Mic as MicIcon, Gamepad2 as GameIcon, Users as UsersIcon, MessageCircle as MessageCircleIcon, Settings as SettingsIcon } from 'lucide-react';
import TikTokIcon from './TikTokIcon';
import useScrollHeader from '../hooks/useScrollHeader';
import { hapticLight } from '../utils/haptics';

const LOGO_URL = '/Firma_Andryx.png';

/* Chiave localStorage condivisa con MessagesPage per il badge non-letti */
const CHIAVE_NON_LETTI = 'andryxify_ha_non_letti';

const NAV_LINKS = [
  { path: '/',          label: 'Home',      Icon: HomeIcon      },
  { path: '/socialify', label: 'SOCIALify', Icon: UsersIcon     },
  { path: '/twitch',    label: 'Twitch',    Icon: TwitchIcon    },
  { path: '/youtube',   label: 'YouTube',   Icon: YoutubeIcon   },
  { path: '/instagram', label: 'Instagram', Icon: InstagramIcon },
  { path: '/podcast',   label: 'Podcast',   Icon: MicIcon       },
  { path: '/tiktok',    label: 'TikTok',    Icon: ({ size }) => <TikTokIcon size={size} /> },
  { path: '/gioco',     label: 'Gioco',     Icon: GameIcon      },
  { path: '/chat',      label: 'Chat',      Icon: MessageCircleIcon },
];

const MOBILE_LINKS = [
  { path: '/',              label: 'Home',        Icon: HomeIcon          },
  { path: '/socialify',     label: 'SOCIALify',   Icon: UsersIcon         },
  { path: '/gioco',         label: 'Gioco',       Icon: GameIcon          },
  { path: '/chat',          label: 'Chat',        Icon: MessageCircleIcon },
  { path: '/impostazioni',  label: 'Impostazioni', Icon: SettingsIcon     },
];

/* Elasticità ai bordi della bolla trascinabile (0 = rigido, 1 = libero) */
const ELASTICITA_BORDO = 0.2;

/* Calcola l'indice del tab più vicino al centro della pill */
function calcolaIndiceTarget(offset, tabWidth, activeIdx, count) {
  const baseX   = activeIdx * tabWidth;
  const clampedX = Math.max(0, Math.min((count - 1) * tabWidth, baseX + offset));
  const center   = clampedX + tabWidth / 2;
  let idx = Math.floor(center / tabWidth);
  return Math.max(0, Math.min(count - 1, idx));
}

/* Legge lo stato non-letti dal localStorage e si aggiorna via eventi */
function useNonLetti() {
  const [haNonLetti, setHaNonLetti] = useState(() => !!localStorage.getItem(CHIAVE_NON_LETTI));
  useEffect(() => {
    const suEvento  = (e) => setHaNonLetti(e.detail?.haNonLetti ?? false);
    const suStorage = (e) => { if (e.key === CHIAVE_NON_LETTI) setHaNonLetti(!!e.newValue); };
    window.addEventListener('andryxify:non-letti', suEvento);
    window.addEventListener('storage', suStorage);
    return () => {
      window.removeEventListener('andryxify:non-letti', suEvento);
      window.removeEventListener('storage', suStorage);
    };
  }, []);
  return haNonLetti;
}

/* ─────────────────────────────────────────────────────────
   MOBILE BOTTOM TAB BAR  (iOS 26-style, liquid glass)
   ─────────────────────────────────────────────────────────
   Bolla vetro trascinabile — l'utente può fare swipe
   orizzontale per spostarsi fra le sezioni.

   Prestazioni: useMotionValue → 0 re-render React durante
   il drag. Tutto gira sul compositor GPU (translateX/scale).
   Pan rilevato sul container (tap normali passano ai Link).
   ───────────────────────────────────────────────────────── */
function MobileTabBar({ activePath, haNonLetti }) {
  const navigate    = useNavigate();
  const activeIdx   = MOBILE_LINKS.findIndex(l => l.path === activePath);
  const count       = MOBILE_LINKS.length;
  const tabWidthPct = 100 / count;
  const itemsRef    = useRef(null);

  /* Ref stabili per evitare chiusure stantie nei gestori pan */
  const isDraggingRef = useRef(false);
  const prevSnapRef   = useRef(activeIdx);
  const activeIdxRef  = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  /* ── Motion values — nessun re-render, 60fps ── */
  const pillX     = useMotionValue(0);
  const pillScale = useMotionValue(1);

  const getTabWidth = useCallback(() => {
    const el = itemsRef.current;
    return el ? el.offsetWidth / count : 0;
  }, [count]);

  /* Posizione iniziale (sincrono, prima del paint — solo al mount
     per evitare flash; le dipendenze sono stabili al mount) */
  useLayoutEffect(() => {
    const tw = getTabWidth();
    if (tw > 0) pillX.jump(activeIdx * tw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Anima al tab attivo quando cambia (tap o navigazione) */
  useEffect(() => {
    if (isDraggingRef.current) return;
    const tw = getTabWidth();
    if (tw > 0) {
      fmAnimate(pillX, activeIdx * tw, {
        type: 'spring', stiffness: 420, damping: 34, mass: 0.9,
      });
    }
  }, [activeIdx, getTabWidth, pillX]);

  /* Ricalcola posizione su resize / orientamento */
  useEffect(() => {
    const handler = () => {
      if (isDraggingRef.current) return;
      const el = itemsRef.current;
      if (!el) return;
      const tw = el.offsetWidth / count;
      if (tw > 0) pillX.jump(activeIdxRef.current * tw);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [count, pillX]);

  /* ── Gestori pan — trascinamento bolla vetro ── */
  const handlePanStart = useCallback(() => {
    isDraggingRef.current = true;
    prevSnapRef.current = activeIdxRef.current;
    fmAnimate(pillScale, 1.04, { type: 'spring', stiffness: 400, damping: 22 });
  }, [pillScale]);

  const handlePan = useCallback((_, info) => {
    if (!isDraggingRef.current) return;
    const tw = getTabWidth();
    if (!tw) return;

    const ai   = activeIdxRef.current;
    const baseX = ai * tw;
    const minX  = 0;
    const maxX  = (count - 1) * tw;
    let targetX = baseX + info.offset.x;

    /* Elasticità ai bordi — sensazione Apple */
    if (targetX < minX) targetX = minX + (targetX - minX) * ELASTICITA_BORDO;
    else if (targetX > maxX) targetX = maxX + (targetX - maxX) * ELASTICITA_BORDO;

    pillX.set(targetX);

    /* Feedback aptico al passaggio di confine tab */
    const idx = calcolaIndiceTarget(info.offset.x, tw, ai, count);
    if (idx !== prevSnapRef.current) {
      hapticLight();
      prevSnapRef.current = idx;
    }
  }, [count, getTabWidth, pillX]);

  const handlePanEnd = useCallback((_, info) => {
    isDraggingRef.current = false;
    fmAnimate(pillScale, 1, { type: 'spring', stiffness: 400, damping: 22 });

    const tw = getTabWidth();
    if (!tw) return;

    const ai       = activeIdxRef.current;
    const targetIdx = calcolaIndiceTarget(info.offset.x, tw, ai, count);

    /* Snap magnetico al tab più vicino */
    fmAnimate(pillX, targetIdx * tw, {
      type: 'spring', stiffness: 420, damping: 34, mass: 0.9,
    });

    if (targetIdx !== ai) {
      hapticLight();
      navigate(MOBILE_LINKS[targetIdx].path);
    }
  }, [count, getTabWidth, navigate, pillX, pillScale]);

  const handleTabClick = useCallback(() => {
    hapticLight();
  }, []);

  return (
    <nav className="mobile-tab-bar" aria-label="Navigazione principale">
      {/* motion.div per rilevare il pan orizzontale; touch-action:pan-y
          lascia lo scroll verticale al browser, cattura solo l'asse X */}
      <motion.div
        ref={itemsRef}
        className="mobile-tab-items"
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        style={{ touchAction: 'pan-y' }}
      >

        {/* ── Bolla liquid glass trascinabile ── */}
        {activeIdx >= 0 && (
          <motion.div
            className="mobile-tab-pill"
            style={{
              x: pillX,
              scale: pillScale,
              width: `${tabWidthPct}%`,
            }}
          />
        )}

        {/* ── Tab items ── */}
        {MOBILE_LINKS.map(({ path, label, Icon }) => {
          const isActive = activePath === path;
          return (
            <Link
              key={path}
              to={path}
              className={`tab-item${isActive ? ' active' : ''}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={handleTabClick}
            >
              <motion.span
                className="tab-icon"
                animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                {/* Pallino non-letti sovrapposto all'icona */}
                <span style={{ position: 'relative', display: 'flex' }}>
                  <Icon size={22} />
                  {path === '/chat' && haNonLetti && <span className="tab-pallino" aria-hidden="true" />}
                </span>
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
      </motion.div>
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
  const linksContainerRef = useRef(null);
  const linkRefs          = useRef({});
  const headerVisible     = useScrollHeader();
  const haNonLetti        = useNonLetti();

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
      {/* ── Top pill navbar (desktop) — hides on scroll-down ── */}
      <AnimatePresence>
        {headerVisible && (
          <motion.nav
            className="navbar-container glass-panel"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.8 }}
          >
            <div className="navbar-content">
              <Link to="/" className="navbar-logo" aria-label="ANDRYXify – Home">
                <img src={LOGO_URL} alt="ANDRYXify" className="navbar-logo-img" />
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
                          style={{ display: 'flex', pointerEvents: 'none', position: 'relative' }}
                        >
                          <Icon size={16} />
                          {/* Pallino non-letti sul link Chat (Messaggi Privati ora vivono qui) */}
                          {path === '/chat' && haNonLetti && <span className="nav-pallino" aria-hidden="true" />}
                        </motion.span>
                        <span className="nav-label" style={{ pointerEvents: 'none' }}>{label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Icona impostazioni */}
              <Link to="/impostazioni" className="nav-link" aria-label="Impostazioni" style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <SettingsIcon size={17} />
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* ── Tab bar inferiore (solo mobile) — passa lo stato non-letti ── */}
      <MobileTabBar activePath={location.pathname} haNonLetti={haNonLetti} />
    </>
  );
}
