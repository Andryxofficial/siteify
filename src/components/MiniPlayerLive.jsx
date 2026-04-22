/**
 * MiniPlayerLive.jsx — Mini player floating Twitch in bottom-right desktop.
 *
 * Mounted in ModPanel.jsx come overlay globale. Caratteristiche:
 *   - Fixed position bottom-right, dimensione 160×90 default (draggabile)
 *   - Header bar per drag, bottoni mute/expand/close
 *   - State persistito in localStorage (position, muted, hidden)
 *   - Nascosto su mobile (<768px)
 *   - Listen a eventi window `mod-live-section-active` / `mod-live-section-inactive`
 *     per nascondersi quando l'utente è nella sezione Live
 *   - Usa Twitch Player SDK (lazy load tramite twitchPlayerLoader.js)
 *   - Muted di default per evitare problemi autoplay
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Maximize2, X, Loader, GripVertical,
} from 'lucide-react';
import { loadTwitchPlayer } from '../utils/twitchPlayerLoader';

const STORAGE_KEY = 'andryxify_modplayer_state';

/** Calcolo lazy dello stato di default per evitare crash in SSR / build (window undefined). */
function getDefaultState() {
  const w = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 720;
  return {
    x: w - 180,
    y: h - 120,
    muted: true,
    hidden: false,
    expanded: false,
  };
}

function loadState() {
  try {
    if (typeof window === 'undefined') return getDefaultState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    const def = getDefaultState();
    // Valida che la posizione sia dentro il viewport
    const x = Math.max(0, Math.min(parsed.x ?? def.x, window.innerWidth - 160));
    const y = Math.max(0, Math.min(parsed.y ?? def.y, window.innerHeight - 90));
    return {
      x,
      y,
      muted: parsed.muted ?? true,
      hidden: parsed.hidden ?? false,
      expanded: false,
    };
  } catch {
    return getDefaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* noop */ }
}

export default function MiniPlayerLive({ broadcaster, onExpand, sezioneAttiva }) {
  const [state, setState] = useState(loadState);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [playerReady, setPlayerReady] = useState(false);
  const [liveSectionActive, setLiveSectionActive] = useState(false);
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  // Listen eventi Live section
  useEffect(() => {
    const onActive = () => setLiveSectionActive(true);
    const onInactive = () => setLiveSectionActive(false);
    window.addEventListener('mod-live-section-active', onActive);
    window.addEventListener('mod-live-section-inactive', onInactive);
    return () => {
      window.removeEventListener('mod-live-section-active', onActive);
      window.removeEventListener('mod-live-section-inactive', onInactive);
    };
  }, []);

  // Save state quando cambia
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Init Twitch Player
  useEffect(() => {
    if (!broadcaster || !containerRef.current || state.hidden || liveSectionActive) return;

    let mounted = true;
    (async () => {
      try {
        const TwitchPlayer = await loadTwitchPlayer();
        if (!mounted) return;

        const hostname = window.location.hostname;
        const player = new TwitchPlayer(containerRef.current, {
          channel: broadcaster,
          width: '100%',
          height: '100%',
          muted: state.muted,
          autoplay: true,
          parent: [hostname],
          layout: 'video',
        });

        player.addEventListener(TwitchPlayer.READY, () => {
          if (mounted) {
            setPlayerReady(true);
            playerRef.current = player;
          }
        });
      } catch { /* silenzioso */ }
    })();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try { playerRef.current.pause(); } catch { /* */ }
        playerRef.current = null;
      }
      setPlayerReady(false);
    };
  }, [broadcaster, state.hidden, state.muted, liveSectionActive]);

  // Dragging handlers
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    setDragOffset({
      x: e.clientX - state.x,
      y: e.clientY - state.y,
    });
  }, [state.x, state.y]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    requestAnimationFrame(() => {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 160));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 90));
      setState(prev => ({ ...prev, x: newX, y: newY }));
    });
  }, [dragging, dragOffset]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMuted = !prev.muted;
      if (playerRef.current) {
        try {
          playerRef.current.setMuted(newMuted);
        } catch { /* */ }
      }
      return { ...prev, muted: newMuted };
    });
  }, []);

  const handleExpand = useCallback(() => {
    onExpand?.();
  }, [onExpand]);

  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, hidden: true }));
  }, []);

  // Reset hidden su re-apertura ModPanel (o prop change)
  useEffect(() => {
    if (sezioneAttiva !== 'live') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(prev => ({ ...prev, hidden: false }));
    }
  }, [sezioneAttiva]);

  // Non mostrare se: hidden, broadcaster mancante, mobile, live section attiva
  if (state.hidden || !broadcaster || liveSectionActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="mini-player-live"
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          width: 160,
          height: 90,
          zIndex: 9999,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <div className="glass-card" style={{
          padding: 0,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}>
          {/* Header bar (drag handle) */}
          <div
            onPointerDown={handlePointerDown}
            style={{
              padding: '0.25rem 0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: dragging ? 'grabbing' : 'grab',
              background: 'rgba(0,0,0,0.3)',
              borderBottom: '1px solid var(--glass-border)',
            }}
          >
            <GripVertical size={12} style={{ color: 'var(--text-faint)' }} />
            <span style={{ flex: 1, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Live
            </span>
            <button
              className="mod-icon-btn"
              onClick={toggleMute}
              title={state.muted ? 'Unmute' : 'Mute'}
              style={{ padding: '0.15rem' }}
            >
              {state.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>
            <button
              className="mod-icon-btn"
              onClick={handleExpand}
              title="Espandi"
              style={{ padding: '0.15rem' }}
            >
              <Maximize2 size={11} />
            </button>
            <button
              className="mod-icon-btn"
              onClick={handleClose}
              title="Chiudi"
              style={{ padding: '0.15rem' }}
            >
              <X size={11} />
            </button>
          </div>

          {/* Player */}
          <div style={{ flex: 1, position: 'relative', background: '#000' }}>
            <div
              ref={containerRef}
              style={{ width: '100%', height: '100%' }}
            />
            {!playerReady && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)',
              }}>
                <Loader size={18} className="spin" style={{ color: '#fff' }} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
