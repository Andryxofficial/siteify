/**
 * LivePlayer.jsx — Player Twitch embed + chat, con controlli avanzati.
 *
 * 2 colonne (responsive: stack su mobile):
 *   - Left: Twitch Player con quality selector + low-latency toggle + PiP
 *   - Right: Chat embed iframe
 *
 * Carica Twitch Player SDK via twitchPlayerLoader.js.
 * Emette eventi window custom `mod-live-section-active` / `mod-live-section-inactive`
 * per nascondere il MiniPlayerLive quando questa sezione è attiva.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, Loader, Play, Maximize2, AlertCircle, Settings, Zap, ZapOff,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet } from '../../utils/modApi';
import { loadTwitchPlayer } from '../../utils/twitchPlayerLoader';

const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '720p60', label: '720p' },
  { value: '480p30', label: '480p' },
  { value: 'audio_only', label: 'Audio Only' },
];

export default function LivePlayer({ token }) {
  const toast = useToast();
  const [broadcaster, setBroadcaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [lowLatency, setLowLatency] = useState(true);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);

  // Carica broadcaster login
  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await modGet('/api/mod-channel', token);
      if (r.ok && r.data?.broadcaster) {
        setBroadcaster(r.data.broadcaster);
      } else {
        toast.error(r.error || 'Impossibile caricare broadcaster.', { titolo: 'Live Player' });
      }
      setLoading(false);
    })();
  }, [token, toast]);

  // Inizializza Twitch Player
  useEffect(() => {
    if (!broadcaster || !containerRef.current) return;

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
          muted: false,
          autoplay: true,
          parent: [hostname],
          layout: 'video',
        });

        player.addEventListener(TwitchPlayer.READY, () => {
          if (mounted) {
            setPlayerReady(true);
            playerInstanceRef.current = player;
            // Imposta low-latency
            try {
              player.setQuality('auto');
            } catch { /* noop */ }
          }
        });

        playerRef.current = player;
      } catch (e) {
        if (mounted) {
          toast.error('Impossibile caricare Twitch Player SDK.', { titolo: 'Player' });
        }
      }
    })();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try { playerRef.current.pause(); } catch { /* */ }
        playerRef.current = null;
        playerInstanceRef.current = null;
      }
    };
  }, [broadcaster, toast]);

  // Emit event on mount/unmount → MiniPlayerLive ascolta e si nasconde
  useEffect(() => {
    window.dispatchEvent(new Event('mod-live-section-active'));
    return () => {
      window.dispatchEvent(new Event('mod-live-section-inactive'));
    };
  }, []);

  const handleQualityChange = useCallback((q) => {
    setQuality(q);
    if (playerInstanceRef.current) {
      try {
        playerInstanceRef.current.setQuality(q);
      } catch (e) {
        toast.error('Impossibile cambiare qualità.', { titolo: 'Player' });
      }
    }
  }, [toast]);

  const toggleLowLatency = useCallback(() => {
    const newVal = !lowLatency;
    setLowLatency(newVal);
    // Low-latency non ha un'API diretta nel player embed, ma ricreando il player
    // con parametro parent si può forzare. Per ora solo toggle UI.
    toast.info(`Low-latency ${newVal ? 'abilitato' : 'disabilitato'}.`, { titolo: 'Player' });
  }, [lowLatency, toast]);

  const handlePiP = useCallback(() => {
    if (!containerRef.current) return;
    const video = containerRef.current.querySelector('video');
    if (video && document.pictureInPictureEnabled) {
      video.requestPictureInPicture().catch(() => {
        toast.error('PiP non disponibile.', { titolo: 'Player' });
      });
    } else {
      toast.error('PiP non supportato dal browser.', { titolo: 'Player' });
    }
  }, [toast]);

  const hostname = window.location.hostname;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1 }}>
          <Radio size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent-twitch)' }} />
          Live Player
        </h2>
        {playerReady && (
          <span className="chip" style={{ fontSize: '0.72rem', color: 'var(--accent-twitch)' }}>
            🔴 LIVE
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader size={32} className="spin" style={{ color: 'var(--accent-twitch)' }} />
        </div>
      ) : !broadcaster ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Impossibile caricare il broadcaster.
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="glass-card" style={{ padding: '0.65rem 0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Settings size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qualità:</span>
              <select
                className="mod-input"
                value={quality}
                onChange={e => handleQualityChange(e.target.value)}
                disabled={!playerReady}
                style={{ marginTop: 0, fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
              >
                {QUALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              className={`mod-permission-btn${lowLatency ? ' mod-permission-btn-active' : ''}`}
              onClick={toggleLowLatency}
              disabled={!playerReady}
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}
            >
              {lowLatency ? <Zap size={11} /> : <ZapOff size={11} />}
              Low-Latency
            </button>

            <button
              className="btn-primary"
              onClick={handlePiP}
              disabled={!playerReady}
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
            >
              <Maximize2 size={11} /> PiP
            </button>
          </div>

          {/* Player + Chat grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: '0.75rem',
            '@media (max-width: 900px)': {
              gridTemplateColumns: '1fr',
            },
          }}
          className="live-player-grid"
          >
            {/* Player */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
              <div style={{ paddingTop: '56.25%', position: 'relative', background: '#000' }}>
                <div
                  ref={containerRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                  }}
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
                    <Loader size={32} className="spin" style={{ color: '#fff' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', minHeight: 400 }}>
              <iframe
                src={`https://www.twitch.tv/embed/${broadcaster}/chat?parent=${hostname}&darkpopout`}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 400,
                  border: 'none',
                  display: 'block',
                }}
                title="Twitch Chat"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
