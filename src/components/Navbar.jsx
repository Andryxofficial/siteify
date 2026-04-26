import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from 'framer-motion';
import { Home as HomeIcon, Twitch as TwitchIcon, Youtube as YoutubeIcon, Instagram as InstagramIcon, Mic as MicIcon, Gamepad2 as GameIcon, Users as UsersIcon, MessageCircle as MessageCircleIcon, Settings as SettingsIcon, Sun, Moon, SunMoon, Sunrise, UserCircle as UserCircleIcon, LogOut, LogIn, UserRound } from 'lucide-react';
import TikTokIcon from './TikTokIcon';
import useScrollHeader from '../hooks/useScrollHeader';
import { hapticLight } from '../utils/haptics';
import { useTema } from '../contexts/TemaContext';
import { useLingua } from '../contexts/LinguaContext';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { prefetchPagina } from '../lazyPages';

const LOGO_URL = '/Firma_Andryx.png';
const LOGO_AVATAR_FALLBACK = '/pwa-192.png';
const CHIAVE_NON_LETTI = 'andryxify_ha_non_letti';

const NAV_LINKS = [
  { path: '/',          labelKey: 'nav.home',       Icon: HomeIcon      },
  { path: '/chi-sono',  labelKey: 'nav.chi-sono',   Icon: UserCircleIcon },
  { path: '/socialify', labelKey: 'nav.socialify',  Icon: UsersIcon     },
  { path: '/twitch',    labelKey: 'nav.twitch',     Icon: TwitchIcon    },
  { path: '/youtube',   labelKey: 'nav.youtube',    Icon: YoutubeIcon   },
  { path: '/instagram', labelKey: 'nav.instagram',  Icon: InstagramIcon },
  { path: '/podcast',   labelKey: 'nav.podcast',    Icon: MicIcon       },
  { path: '/tiktok',    labelKey: 'nav.tiktok',     Icon: ({ size }) => <TikTokIcon size={size} /> },
  { path: '/gioco',     labelKey: 'nav.giochi',     Icon: GameIcon      },
  { path: '/chat',      labelKey: 'nav.chat',       Icon: MessageCircleIcon },
];

const MOBILE_LINKS = [
  { path: '/',              labelKey: 'nav.home',          Icon: HomeIcon          },
  { path: '/chi-sono',      labelKey: 'nav.chi-sono',      Icon: UserCircleIcon    },
  { path: '/socialify',     labelKey: 'nav.socialify',     Icon: UsersIcon         },
  { path: '/gioco',         labelKey: 'nav.giochi',        Icon: GameIcon          },
  { path: '/chat',          labelKey: 'nav.chat',          Icon: MessageCircleIcon },
  { path: '/impostazioni',  labelKey: 'nav.impostazioni',  Icon: SettingsIcon     },
];

const ELASTICITA_BORDO = 0.2;

function calcolaIndiceTarget(offset, tabWidth, activeIdx, count) {
  const baseX   = activeIdx * tabWidth;
  const clampedX = Math.max(0, Math.min((count - 1) * tabWidth, baseX + offset));
  const center   = clampedX + tabWidth / 2;
  let idx = Math.floor(center / tabWidth);
  return Math.max(0, Math.min(count - 1, idx));
}

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

const ICONE_TEMA = { auto: SunMoon, 'alba-tramonto': Sunrise, chiaro: Sun, scuro: Moon };
const CHIAVI_TEMA = {
  auto:            'nav.tema.auto',
  'alba-tramonto': 'nav.tema.alba-tramonto',
  chiaro:          'nav.tema.chiaro',
  scuro:           'nav.tema.scuro',
};

function labelTemaMobile(modalita, t) {
  if (modalita === 'chiaro') return t('settings.tema.chiaro');
  if (modalita === 'scuro') return t('settings.tema.scuro');
  if (modalita === 'alba-tramonto') return t('settings.tema.alba-tramonto');
  return t('settings.tema.auto');
}

function MobileTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLingua();
  const { modalita, cicla } = useTema();
  const { twitchUser, twitchDisplay, twitchAvatar, isLoggedIn, logout, getTwitchLoginUrl } = useTwitchAuth();
  const [aperto, setAperto] = useState(false);
  const menuRef = useRef(null);
  const labelTema = `${t('settings.tema.label')}: ${labelTemaMobile(modalita, t)}`;
  const TemaIcon = ICONE_TEMA[modalita] || SunMoon;

  useEffect(() => {
    if (!aperto) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setAperto(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('pointerdown', close, { passive: true });
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  const doLogin = () => {
    hapticLight();
    window.location.href = getTwitchLoginUrl(location.pathname);
  };

  const doLogout = () => {
    hapticLight();
    logout();
    setAperto(false);
  };

  const go = (path) => {
    hapticLight();
    setAperto(false);
    navigate(path);
  };

  return (
    <div className="mobile-topbar" ref={menuRef}>
      <Link to="/" className="mobile-topbar-brand" aria-label={t('nav.aria.logo')}>
        <img src={LOGO_URL} alt="ANDRYXify" />
      </Link>

      <button
        type="button"
        className={`mobile-profile-trigger${aperto ? ' active' : ''}`}
        aria-label={isLoggedIn ? t('nav.profile.open') : t('nav.profile.login')}
        aria-expanded={aperto}
        onClick={() => {
          hapticLight();
          if (!isLoggedIn) doLogin();
          else setAperto(v => !v);
        }}
      >
        {isLoggedIn ? <img src={twitchAvatar || LOGO_AVATAR_FALLBACK} alt="" /> : <LogIn size={20} />}
      </button>

      <AnimatePresence>
        {aperto && isLoggedIn && (
          <motion.div
            className="mobile-profile-menu glass-panel"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <div className="mobile-profile-menu-head">
              <img src={twitchAvatar || LOGO_AVATAR_FALLBACK} alt="" />
              <div>
                <strong>{twitchDisplay || twitchUser}</strong>
                <span>@{twitchUser}</span>
              </div>
            </div>

            <button type="button" onClick={() => go(`/profilo/${twitchUser}`)}>
              <UserRound size={17} /> {t('settings.vedi_profilo')}
            </button>
            <button type="button" onClick={() => { cicla(); hapticLight(); }}>
              <TemaIcon size={17} /> {labelTema}
            </button>
            <button type="button" onClick={() => go('/impostazioni')}>
              <SettingsIcon size={17} /> {t('nav.impostazioni')}
            </button>
            <button type="button" className="danger" onClick={doLogout}>
              <LogOut size={17} /> {t('settings.esci')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileTabBar({ activePath, haNonLetti }) {
  const navigate    = useNavigate();
  const { t }       = useLingua();
  const activeIdx   = MOBILE_LINKS.findIndex(l => l.path === activePath);
  const count       = MOBILE_LINKS.length;
  const tabWidthPct = 100 / count;
  const itemsRef    = useRef(null);

  const isDraggingRef = useRef(false);
  const prevSnapRef   = useRef(activeIdx);
  const activeIdxRef  = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  const pillX     = useMotionValue(0);
  const pillScale = useMotionValue(1);

  const getTabWidth = useCallback(() => {
    const el = itemsRef.current;
    return el ? el.offsetWidth / count : 0;
  }, [count]);

  useLayoutEffect(() => {
    const tw = getTabWidth();
    if (tw > 0) pillX.jump(activeIdx * tw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const tw = getTabWidth();
    if (tw > 0) {
      fmAnimate(pillX, activeIdx * tw, { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 });
    }
  }, [activeIdx, getTabWidth, pillX]);

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

    if (targetX < minX) targetX = minX + (targetX - minX) * ELASTICITA_BORDO;
    else if (targetX > maxX) targetX = maxX + (targetX - maxX) * ELASTICITA_BORDO;

    pillX.set(targetX);

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

    fmAnimate(pillX, targetIdx * tw, { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 });

    if (targetIdx !== ai) {
      hapticLight();
      navigate(MOBILE_LINKS[targetIdx].path);
    }
  }, [count, getTabWidth, navigate, pillX, pillScale]);

  const handleTabClick = useCallback(() => { hapticLight(); }, []);

  return (
    <nav className="mobile-tab-bar" aria-label={t('nav.aria.main')}>
      <motion.div ref={itemsRef} className="mobile-tab-items" onPanStart={handlePanStart} onPan={handlePan} onPanEnd={handlePanEnd} style={{ touchAction: 'pan-y' }}>
        {activeIdx >= 0 && <motion.div className="mobile-tab-pill" style={{ x: pillX, scale: pillScale, width: `${tabWidthPct}%` }} />}
        {MOBILE_LINKS.map(({ path, labelKey, Icon }) => {
          const isActive = activePath === path;
          const label = t(labelKey);
          return (
            <Link key={path} to={path} className={`tab-item${isActive ? ' active' : ''}`} aria-label={label} aria-current={isActive ? 'page' : undefined} onClick={handleTabClick} onTouchStart={() => prefetchPagina(path)} onPointerEnter={() => prefetchPagina(path)}>
              <motion.span className="tab-icon" animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
                <span style={{ position: 'relative', display: 'flex' }}>
                  <Icon size={22} />
                  {path === '/chat' && haNonLetti && <span className="tab-pallino" aria-hidden="true" />}
                </span>
              </motion.span>
              <motion.span className="tab-label" animate={{ opacity: isActive ? 1 : 0.5 }} transition={{ duration: 0.2 }}>{label}</motion.span>
            </Link>
          );
        })}
      </motion.div>
    </nav>
  );
}

export default function Navbar() {
  const location          = useLocation();
  const linksContainerRef = useRef(null);
  const linkRefs          = useRef({});
  const headerVisible     = useScrollHeader();
  const haNonLetti        = useNonLetti();
  const { modalita, cicla } = useTema();
  const { t }             = useLingua();
  const labelTema = t(CHIAVI_TEMA[modalita] || 'nav.tema.auto');
  const [hoveredPath, setHoveredPath] = useState(null);
  const [pillPos, setPillPos] = useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = useState(false);
  const displayPath = hoveredPath ?? location.pathname;

  const getInfo = useCallback((path) => {
    const container = linksContainerRef.current;
    const link = linkRefs.current?.[path];
    if (!container || !link) return null;
    const cR = container.getBoundingClientRect();
    const lR = link.getBoundingClientRect();
    return { left: lR.left - cR.left, width: lR.width };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const info = getInfo(location.pathname);
      if (info && info.width > 0) { setPillPos(info); setPillReady(true); }
    }, 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pillReady) return;
    const info = getInfo(displayPath);
    if (info) setPillPos(info);
  }, [displayPath, pillReady, getInfo]);

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
      <MobileTopBar />
      <AnimatePresence>
        {headerVisible && (
          <motion.nav className="navbar-container glass-panel" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.8 }}>
            <div className="navbar-content">
              <Link to="/" className="navbar-logo" aria-label={t('nav.aria.logo')}>
                <img src={LOGO_URL} alt="ANDRYXify" className="navbar-logo-img" width="220" height="44" fetchPriority="high" />
              </Link>
              <div ref={linksContainerRef} className="nav-links" style={{ position: 'relative', overflow: 'visible' }} onMouseLeave={() => setHoveredPath(null)}>
                {pillReady && <motion.div className="liquid-nav-pill" initial={false} animate={{ left: pillPos.left, width: pillPos.width }} transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }} />}
                {NAV_LINKS.map(({ path, labelKey, Icon }) => {
                  const isActive = location.pathname === path;
                  const label = t(labelKey);
                  return (
                    <div key={path} ref={el => { linkRefs.current[path] = el; }} style={{ position: 'relative', zIndex: 1 }} onMouseEnter={() => { setHoveredPath(path); prefetchPagina(path); }} onFocus={() => prefetchPagina(path)}>
                      <Link to={path} className={`nav-link${isActive ? ' active' : ''}`}>
                        <motion.span whileHover={{ scale: 1.15, rotate: 4 }} style={{ display: 'flex', pointerEvents: 'none', position: 'relative' }}>
                          <Icon size={16} />
                          {path === '/chat' && haNonLetti && <span className="nav-pallino" aria-hidden="true" />}
                        </motion.span>
                        <span className="nav-label" style={{ pointerEvents: 'none' }}>{label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
              <motion.button onClick={() => { cicla(); hapticLight(); }} className="nav-link nav-tema-toggle" aria-label={labelTema} title={labelTema} style={{ marginLeft: '0.25rem', border: 'none', cursor: 'pointer', background: 'transparent' }} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9, rotate: 15 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <motion.span key={modalita} initial={{ opacity: 0, rotate: -30, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }} style={{ display: 'flex' }}>
                  {React.createElement(ICONE_TEMA[modalita], { size: 17 })}
                </motion.span>
              </motion.button>
              <Link to="/impostazioni" className="nav-link nav-settings" aria-label={t('nav.impostazioni')} style={{ marginLeft: '0.25rem', display: 'flex', alignItems: 'center' }}>
                <SettingsIcon size={17} />
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
      <MobileTabBar activePath={location.pathname} haNonLetti={haNonLetti} />
    </>
  );
}
