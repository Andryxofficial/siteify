import { motion } from 'framer-motion';
import { Twitch, ExternalLink, Calendar, Users, Star, Clock, Trophy, LogIn } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

/* ─── Utilità tempo ─── */
function formattaTempo(secondi) {
  const s = Math.max(0, Math.floor(secondi));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(ss)}`;
  return `${pad(m)}:${pad(ss)}`;
}

function tempoBreve(secondi) {
  const s = Math.max(0, Math.floor(secondi));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const MEDAGLIE = ['🥇', '🥈', '🥉'];
const MILESTONES = [
  { hours: 50, emoji: '👑', label: '50h' },
  { hours: 10, emoji: '💎', label: '10h' },
  { hours:  5, emoji: '⭐', label: '5h' },
  { hours:  1, emoji: '⏱️', label: '1h' },
];

function getMilestone(totalSeconds) {
  const hours = totalSeconds / 3600;
  for (const m of MILESTONES) {
    if (hours >= m.hours) return m;
  }
  return null;
}

/* ─── Componente classifica watch time ─── */
function ClassificaWatchTime({ t, twitchUser, twitchToken }) {
  const [tabAttiva, setTabAttiva]         = useState('globale');
  const [dati, setDati]                   = useState(null);
  const [mioDato, setMioDato]             = useState(null);
  const [caricamento, setCaricamento]     = useState(true);
  const [tempoLocale, setTempoLocale]     = useState(0); // offset locale in secondi (tick ogni secondo)
  const timerRef                          = useRef(null);
  const ultimoFetchRef                    = useRef(Date.now());

  const caricaClassifica = useCallback(async () => {
    try {
      const r = await fetch('/api/watch-time?action=leaderboard');
      if (r.ok) {
        const d = await r.json();
        setDati(d);
      }
    } catch { /* best effort */ } finally {
      setCaricamento(false);
    }
  }, []);

  const caricaMioDato = useCallback(async () => {
    if (!twitchToken) return;
    try {
      const r = await fetch('/api/watch-time?action=me', {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (r.ok) {
        const d = await r.json();
        setMioDato(d);
        setTempoLocale(0); // reset offset locale al momento del fetch
        ultimoFetchRef.current = Date.now();
      }
    } catch { /* best effort */ }
  }, [twitchToken]);

  /* Caricamento iniziale e refresh ogni 30s */
  useEffect(() => {
    caricaClassifica();
    caricaMioDato();
    const id = setInterval(() => {
      caricaClassifica();
      caricaMioDato();
    }, 30000);
    return () => clearInterval(id);
  }, [caricaClassifica, caricaMioDato]);

  /* Ticker locale: aggiorna ogni secondo per mostrare HH:MM:SS in tempo reale */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTempoLocale(Math.floor((Date.now() - ultimoFetchRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const voci = tabAttiva === 'globale' ? (dati?.leaderboard || []) : (dati?.monthly || []);
  // Aggiunge l'offset locale solo se mioDato è già stato ricevuto almeno una volta
  const offsetLocale      = mioDato !== null ? tempoLocale : 0;
  const mioTotaleGlobale  = (mioDato?.totalSeconds   || 0) + offsetLocale;
  const mioTotaleMensile  = (mioDato?.monthlySeconds || 0) + offsetLocale;
  const mioTotale = tabAttiva === 'globale' ? mioTotaleGlobale : mioTotaleMensile;
  const mioRank   = tabAttiva === 'globale' ? mioDato?.rank      : mioDato?.monthlyRank;

  return (
    <motion.section
      className="glass-panel"
      style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden', borderColor: 'rgba(145,70,255,.12)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      {/* Header viola */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg,#9146FF,#c800ff,#9146FF)',
        backgroundSize: '200% 100%',
        animation: 'twitch-shimmer 3s linear infinite',
      }} />

      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
          <Clock size={22} color="#9146FF" />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#9146FF', fontFamily: "'Space Grotesk','Outfit',sans-serif" }}>
            {t('twitch.watchtime.titolo')}
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          {t('twitch.watchtime.desc')}
        </p>

        {/* Badge milestone */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {MILESTONES.map(m => (
            <span key={m.label} style={{
              background: 'rgba(145,70,255,.13)',
              border: '1px solid rgba(145,70,255,.22)',
              borderRadius: '20px',
              padding: '2px 10px',
              fontSize: '0.78rem',
              color: '#c9b8ff',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {m.emoji} {m.label}
            </span>
          ))}
        </div>

        {/* Tab Globale / Mensile */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {['globale', 'mensile'].map(tab => (
            <button
              key={tab}
              onClick={() => setTabAttiva(tab)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                border: tabAttiva === tab ? '1px solid rgba(145,70,255,.5)' : '1px solid rgba(145,70,255,.15)',
                background: tabAttiva === tab ? 'rgba(145,70,255,.22)' : 'transparent',
                color: tabAttiva === tab ? '#d4b3ff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: tabAttiva === tab ? 700 : 400,
                cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              {t(tab === 'globale' ? 'twitch.watchtime.tab.globale' : 'twitch.watchtime.tab.mensile')}
            </button>
          ))}
          {tabAttiva === 'mensile' && dati?.currentMonthLabel && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto', alignSelf: 'center' }}>
              {dati.currentMonthLabel}
            </span>
          )}
        </div>
      </div>

      {/* Stato utente loggato */}
      {twitchUser && mioDato && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(145,70,255,.10)',
          border: '1px solid rgba(145,70,255,.22)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <Clock size={16} color="#9146FF" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>
            {t('twitch.watchtime.tracking')}:{' '}
            <strong style={{ color: '#c9b8ff', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: '1rem' }}>
              {formattaTempo(mioTotale)}
            </strong>
          </span>
          {mioRank && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {t('twitch.watchtime.rank')}: <strong style={{ color: '#c9b8ff' }}>#{mioRank}</strong>
            </span>
          )}
          {getMilestone(mioTotaleGlobale) && (
            <span style={{ fontSize: '1rem' }} title={getMilestone(mioTotaleGlobale).label}>
              {getMilestone(mioTotaleGlobale).emoji}
            </span>
          )}
        </div>
      )}

      {/* Prompt login */}
      {!twitchUser && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(145,70,255,.07)',
          border: '1px solid rgba(145,70,255,.15)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.84rem',
          color: 'var(--text-muted)',
        }}>
          <LogIn size={15} color="#9146FF" />
          {t('twitch.watchtime.login')}
        </div>
      )}

      {/* Lista classifica */}
      <div style={{ overflowY: 'auto', maxHeight: 380 }}>
        {caricamento ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ⏳ Caricamento…
          </div>
        ) : voci.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('twitch.watchtime.vuota')}
          </div>
        ) : (
          voci.map((voce, idx) => {
            const mioUsernameNorm = twitchUser?.toLowerCase();
            const isMe = !!mioUsernameNorm && voce.username?.toLowerCase() === mioUsernameNorm;
            const milestone = getMilestone(voce.totalSeconds);
            const secondiEffettivi = isMe ? mioTotale : voce.totalSeconds;
            return (
              <div
                key={voce.username}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0.7rem 1.5rem',
                  borderBottom: '1px solid rgba(145,70,255,.07)',
                  background: isMe ? 'rgba(145,70,255,.10)' : 'transparent',
                  transition: 'background .15s',
                }}
              >
                {/* Rank */}
                <span style={{
                  minWidth: 28,
                  fontSize: idx < 3 ? '1.2rem' : '0.85rem',
                  fontWeight: 700,
                  color: idx < 3 ? undefined : 'var(--text-muted)',
                  textAlign: 'center',
                }}>
                  {idx < 3 ? MEDAGLIE[idx] : `#${idx + 1}`}
                </span>

                {/* Username */}
                <span style={{
                  flex: 1,
                  fontSize: '0.9rem',
                  fontWeight: isMe ? 700 : 500,
                  color: isMe ? '#c9b8ff' : 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {voce.username}
                  {isMe && (
                    <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#9146FF', fontWeight: 600 }}>
                      ({t('twitch.watchtime.tu')})
                    </span>
                  )}
                </span>

                {/* Milestone badge */}
                {milestone && (
                  <span style={{ fontSize: '1rem' }} title={`${milestone.label}: ${milestone.hours}h`}>
                    {milestone.emoji}
                  </span>
                )}

                {/* Tempo in HH:MM:SS */}
                <span style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: 'monospace',
                  fontSize: '0.92rem',
                  color: isMe ? '#b39dff' : 'var(--text-muted)',
                  fontWeight: isMe ? 700 : 400,
                  minWidth: 64,
                  textAlign: 'right',
                }}>
                  {formattaTempo(secondiEffettivi)}
                </span>

                {/* Tempo breve per mobile */}
                <span style={{
                  display: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }} className="watch-time-short">
                  {tempoBreve(secondiEffettivi)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '0.6rem 1.5rem', borderTop: '1px solid rgba(145,70,255,.08)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9146FF', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        Aggiornamento in tempo reale · solo utenti loggati con Twitch
      </div>
    </motion.section>
  );
}

/* ─── Hook heartbeat watch time ─── */
function useWatchTimeHeartbeat(twitchToken, attivo) {
  const inviaHeartbeat = useCallback(async () => {
    if (!twitchToken) return;
    try {
      await fetch('/api/watch-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
      });
    } catch { /* best effort */ }
  }, [twitchToken]);

  useEffect(() => {
    if (!attivo || !twitchToken) return;
    // Primo heartbeat subito
    inviaHeartbeat();
    const id = setInterval(inviaHeartbeat, 30000);
    return () => clearInterval(id);
  }, [attivo, twitchToken, inviaHeartbeat]);
}

/* ─── Componente principale TwitchPage ─── */
export default function TwitchPage() {
  const { t } = useLingua();
  const { twitchUser, twitchToken } = useTwitchAuth();

  /* Traccia se la pagina è visibile (non in background) */
  const [paginaVisibile, setPaginaVisibile] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  useEffect(() => {
    const onVisibility = () => setPaginaVisibile(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /* Il heartbeat è attivo solo quando la pagina è visibile e l'utente è loggato */
  useWatchTimeHeartbeat(twitchToken, paginaVisibile && !!twitchUser);

  const twitchStats = [
    { icon: <Users size={18} color="#9146FF" />, label: t('twitch.stat.community') },
    { icon: <Star  size={18} color="#FFD700" />, label: t('twitch.stat.contenuti') },
    { icon: <Calendar size={18} color="var(--secondary)" />, label: t('twitch.stat.live') },
  ];

  return (
    <div
      className="main-content"
      style={{ maxWidth: '1100px' }}
    >
      <SEO
        title="Twitch — Live Streaming & Gaming"
        description="Guarda le dirette live di ANDRYXify (Andrea Taliento) su Twitch. Streaming di videogiochi, interazione in chat e community gaming italiana. Segui il canale Twitch e attiva le notifiche!"
        path="/twitch"
        keywords="twitch andryxify, live streaming gaming, streamer italiano twitch, diretta videogiochi"
      />
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title">
          <span style={{ color: '#9146FF' }}>Twitch</span> Experience
        </h1>
        <p className="subtitle">{t('twitch.subtitle')}</p>

        <div className="glass-stats-bar" style={{ marginTop: '1rem' }}>
          {twitchStats.map(s => (
            <div key={s.label}>
              {s.icon}
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Player + Chat */}
      <div className="twitch-container glass-panel" style={{ padding: 0 }}>
        <div className="player-side">
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}`}
            height="100%"
            width="100%"
            allowFullScreen
            style={{ border: 'none', display: 'block', minHeight: 350 }}
            title={t('twitch.iframe.stream.title')}
          />
        </div>
        <div className="chat-side">
          <div style={{
            background: 'rgba(145,70,255,.08)',
            padding: '8px 14px',
            fontSize: '0.82rem',
            color: '#c9b8ff',
            borderBottom: '1px solid rgba(145,70,255,.10)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Twitch size={14} />
            {t('twitch.chat.hint')}
          </div>
          <iframe
            src={`https://www.twitch.tv/embed/andryxify/chat?parent=${window.location.hostname}&darkpopout`}
            height="100%"
            width="100%"
            style={{ flex: 1, border: 'none', display: 'block' }}
            title={t('twitch.iframe.chat.title')}
          />
        </div>
      </div>

      {/* Classifica spettatori più longevi */}
      <ClassificaWatchTime t={t} twitchUser={twitchUser} twitchToken={twitchToken} />

      {/* Channel panel */}
      <motion.div
        className="glass-panel"
        style={{
          marginTop: '1.5rem',
          padding: '0',
          overflow: 'hidden',
          borderColor: 'rgba(145,70,255,.12)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Twitch-purple banner accent */}
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg,#9146FF,#c800ff,#9146FF)',
          backgroundSize: '200% 100%',
          animation: 'twitch-shimmer 3s linear infinite',
        }} />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <Twitch size={28} color="#9146FF" />
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#9146FF', fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {t('twitch.canale.titolo')}
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '560px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {t('twitch.canale.desc')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.a
              href="https://twitch.tv/andryxify"
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{
                background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(145,70,255,.3)',
              }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <Twitch size={16} /> {t('twitch.cta.segui')}
            </motion.a>
            <motion.a
              href="https://x.la/@andryxify"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ gap: '8px' }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <ExternalLink size={16} />
              {t('twitch.cta.donazioni')}
            </motion.a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}