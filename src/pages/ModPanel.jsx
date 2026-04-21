/**
 * ModPanel — Dashboard completa stile Twitch dashboard per moderatori.
 *
 * Rotta nascosta (/mod-panel), non in navbar. Visibile solo ai mod.
 * Shell con sidebar desktop / tab bar mobile.
 * Ogni sezione è un componente lazy-loaded da src/pages/mod/.
 *
 * Caratteristiche "magiche":
 *   • Quick actions in header: Raid, Pubblicità, Marker
 *   • Command palette ⌘K per saltare velocemente tra sezioni
 *   • Indicatore live con pulse animato e contatore durata in tempo reale
 *   • Toast notifications eleganti per ogni azione (vedi ToastContext)
 */
import { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Activity, Terminal, Shield, Zap,
  TrendingUp, Monitor, Calendar, Twitch, Loader,
  ChevronRight, Wifi, WifiOff, Users as UsersIcon,
  Film, Award, Command, Radio,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { createTwitchBot } from '../utils/twitchBot';
import SEO from '../components/SEO';
import QuickActions from './mod/QuickActions';
import CommandPalette from './mod/CommandPalette';

// Sezioni lazy-loaded
const SecOverview    = lazy(() => import('./mod/Overview'));
const SecActivity    = lazy(() => import('./mod/Activity'));
const SecChat        = lazy(() => import('./mod/Chat'));
const SecModeration  = lazy(() => import('./mod/Moderation'));
const SecEngagement  = lazy(() => import('./mod/Engagement'));
const SecStats       = lazy(() => import('./mod/Stats'));
const SecOverlays    = lazy(() => import('./mod/Overlays'));
const SecSchedule    = lazy(() => import('./mod/Schedule'));
const SecBot24h      = lazy(() => import('./mod/Bot24h'));
const SecUsers       = lazy(() => import('./mod/Users'));
const SecClips       = lazy(() => import('./mod/Clips'));
const SecRewards     = lazy(() => import('./mod/Rewards'));

const SEZIONI = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard, color: 'var(--primary)',         descrizione: 'Stato live, titolo, gioco' },
  { id: 'activity',    label: 'Attività',     icon: Activity,        color: 'var(--secondary)',       descrizione: 'Follower e sub recenti' },
  { id: 'chat',        label: 'Chat',         icon: Terminal,        color: 'var(--accent-warm)',     descrizione: 'Comandi, timer, citazioni' },
  { id: 'moderation',  label: 'Moderazione',  icon: Shield,          color: 'var(--accent)',          descrizione: 'Ban, timeout, chat settings' },
  { id: 'engagement',  label: 'Engagement',   icon: Zap,             color: 'var(--accent-twitch)',   descrizione: 'Sondaggi e predizioni' },
  { id: 'users',       label: 'Utenti',       icon: UsersIcon,       color: 'var(--accent-twitch)',   descrizione: 'Mod, VIP, sub, bannati' },
  { id: 'rewards',     label: 'Premi',        icon: Award,           color: 'var(--accent-warm)',     descrizione: 'Channel Points custom' },
  { id: 'clips',       label: 'Clip',         icon: Film,            color: 'var(--primary)',         descrizione: 'Clip recenti del canale' },
  { id: 'stats',       label: 'Statistiche',  icon: TrendingUp,      color: 'var(--accent-spotify)',  descrizione: 'Andamento viewer e follower' },
  { id: 'overlays',    label: 'Overlay OBS',  icon: Monitor,         color: 'var(--secondary)',       descrizione: 'Goal, eventi, alert per OBS' },
  { id: 'schedule',    label: 'Schedule',     icon: Calendar,        color: 'var(--primary)',         descrizione: 'Programmazione settimanale' },
  { id: 'bot24h',      label: 'Bot 24/7',     icon: Wifi,            color: 'var(--accent-spotify)',  descrizione: 'Bot serverless sempre attivo' },
];

const COMPONENTI = {
  overview:   SecOverview,
  activity:   SecActivity,
  chat:       SecChat,
  moderation: SecModeration,
  engagement: SecEngagement,
  users:      SecUsers,
  rewards:    SecRewards,
  clips:      SecClips,
  stats:      SecStats,
  overlays:   SecOverlays,
  schedule:   SecSchedule,
  bot24h:     SecBot24h,
};

function SkeletonSezione() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[160, 100, 200].map(h => (
        <div key={h} className="glass-panel skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}

function BotIndicator({ status, onToggle }) {
  const color = status === 'connected' ? 'var(--accent-spotify)' : status === 'connecting' ? 'var(--accent-warm)' : 'var(--text-faint)';
  const Icon  = status === 'connected' ? Wifi : WifiOff;
  return (
    <button onClick={onToggle}
      className="mod-icon-btn"
      title={`Bot ${status === 'connected' ? 'connesso' : 'disconnesso'} — clicca per ${status === 'connected' ? 'disconnettere' : 'connettere'}`}
      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color, width: 'auto', padding: '0 0.55rem' }}>
      <Icon size={14} />
      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{status === 'connected' ? 'BOT ON' : 'BOT OFF'}</span>
    </button>
  );
}

/* ── Indicatore live con pulse + durata che si aggiorna in tempo reale ── */
function LiveIndicator({ token }) {
  const [stato,  setStato]  = useState({ live: false, viewers: 0, startedAt: null });
  const [durata, setDurata] = useState('');

  // Carica/aggiorna info live ogni 30s
  useEffect(() => {
    if (!token) return;
    let attivo = true;
    const carica = async () => {
      try {
        const r = await fetch('/api/mod-channel', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const d = await r.json();
        if (!attivo) return;
        setStato({
          live:      !!d.live,
          viewers:   d.viewerCount || 0,
          startedAt: d.startedAt   || null,
        });
      } catch { /* ignore */ }
    };
    carica();
    const id = setInterval(carica, 30_000);
    return () => { attivo = false; clearInterval(id); };
  }, [token]);

  // Aggiorna la stringa "durata" ogni secondo quando siamo live.
  // Pattern legittimo: setInterval è una sorgente esterna a React.
  useEffect(() => {
    if (!stato.live || !stato.startedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDurata('');
      return;
    }
    const calcola = () => {
      const ms = Date.now() - new Date(stato.startedAt).getTime();
      const h  = Math.floor(ms / 3600000);
      const m  = Math.floor((ms % 3600000) / 60000);
      const s  = Math.floor((ms % 60000) / 1000);
      setDurata(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    calcola();
    const id = setInterval(calcola, 1000);
    return () => clearInterval(id);
  }, [stato.live, stato.startedAt]);

  if (!stato.live) {
    return (
      <span className="live-pill live-pill-off" title="Stream offline">
        <span className="live-dot" />
        OFFLINE
      </span>
    );
  }

  return (
    <span className="live-pill live-pill-on" title={`In diretta · ${stato.viewers} spettatori`}>
      <span className="live-dot live-dot-pulse" />
      LIVE
      <span style={{ opacity: 0.85 }}>· {stato.viewers} 👁</span>
      {durata && <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>· {durata}</span>}
    </span>
  );
}

export default function ModPanel() {
  const { twitchToken, twitchUser, twitchDisplay, twitchAvatar, isLoggedIn, loading, getTwitchLoginUrl } = useTwitchAuth();
  const [sezione,    setSezione]    = useState(() => {
    // Leggi ?sezione= dalla callback OAuth del bot
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sezione');
    return (s && SEZIONI.find(x => x.id === s)) ? s : 'overview';
  });
  const [isMod,      setIsMod]      = useState(null); // null=loading, true/false
  const [botStatus,  setBotStatus]  = useState('disconnected');
  const [broadcaster, setBroadcaster] = useState('');
  const [paletteAperta, setPaletteAperta] = useState(false);
  const botRef = useRef(null);
  const mobileTabsRef = useRef(null);

  // Controlla se l'utente è mod facendo una richiesta al backend.
  useEffect(() => {
    if (!isLoggedIn || !twitchToken) return;
    let attivo = true;
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => { if (attivo) setIsMod(!!d.isMod); })
      .catch(() => { if (attivo) setIsMod(false); });
    return () => { attivo = false; };
  }, [isLoggedIn, twitchToken]);

  // Recupera broadcaster per il bot
  useEffect(() => {
    if (!twitchToken) return;
    fetch('/api/mod-channel', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => { if (d.broadcaster) setBroadcaster(d.broadcaster); })
      .catch(() => {});
  }, [twitchToken]);

  // Cleanup bot on unmount
  useEffect(() => () => botRef.current?.disconnect(), []);

  // Auto-scroll della tab mobile attiva al centro quando cambia sezione
  useEffect(() => {
    const cont = mobileTabsRef.current;
    if (!cont) return;
    const attiva = cont.querySelector('.mod-mobile-tab-active');
    if (!attiva) return;
    const offset = attiva.offsetLeft - (cont.clientWidth / 2) + (attiva.clientWidth / 2);
    cont.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
  }, [sezione]);

  // ⌘K / Ctrl+K → apri palette
  useEffect(() => {
    const handler = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteAperta(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleBot = useCallback(() => {
    if (botRef.current && botStatus === 'connected') {
      botRef.current.disconnect();
      botRef.current = null;
      return;
    }
    if (!twitchToken || !twitchUser || !broadcaster) return;
    const bot = createTwitchBot({
      token:    twitchToken,
      username: twitchUser,
      channel:  broadcaster,
      onStatus: setBotStatus,
    });
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => bot.updateData(d))
      .catch(() => {});
    botRef.current = bot;
    bot.connect();
  }, [botStatus, twitchToken, twitchUser, broadcaster]);

  // Voci della command palette: tutte le sezioni
  const vociPalette = useMemo(() => SEZIONI.map(s => ({
    id:     s.id,
    label:  s.label,
    descrizione: s.descrizione,
    icon:   s.icon,
    color:  s.color,
    gruppo: 'Sezione',
  })), []);

  // ─── Stato di caricamento ───
  if (loading) {
    return (
      <main className="main-content" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      </main>
    );
  }

  // ─── Accesso negato ───
  if (isMod === false || (!isLoggedIn && !loading)) {
    if (!isLoggedIn) {
      return (
        <main className="main-content" style={{ maxWidth: 520, margin: '0 auto' }}>
          <SEO title="Mod Panel" noindex />
          <motion.div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Shield size={42} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <h1 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Mod Panel</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Accedi con Twitch per aprire la dashboard.
            </p>
            <a href={getTwitchLoginUrl('/mod-panel')} className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Twitch size={16} /> Accedi con Twitch
            </a>
          </motion.div>
        </main>
      );
    }
    return (
      <main className="main-content" style={{ maxWidth: 520, margin: '0 auto' }}>
        <SEO title="Mod Panel" noindex />
        <motion.div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <Shield size={42} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Accesso non autorizzato</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Il tuo account <strong>{twitchDisplay || twitchUser}</strong> non è nella lista dei moderatori.
          </p>
        </motion.div>
      </main>
    );
  }

  // ─── Caricamento verifica mod ───
  if (isMod === null) {
    return (
      <main className="main-content" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      </main>
    );
  }

  const SezioneAttiva = COMPONENTI[sezione] || SecOverview;
  const sezioneInfo = SEZIONI.find(s => s.id === sezione) || SEZIONI[0];
  const SezioneIcona = sezioneInfo.icon;

  return (
    <main className="main-content mod-panel-shell" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 0 4rem', width: '100%', boxSizing: 'border-box' }}>
      <SEO title="Pannello Mod" noindex />

      {/* ─── Header magico ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="mod-panel-header glass-card"
        style={{ marginBottom: '1rem' }}
      >
        <div className="mod-panel-header-row">
          {twitchAvatar && (
            <div className="mod-avatar-wrap">
              <img src={twitchAvatar} alt={twitchUser} className="mod-avatar" />
              <span className="mod-avatar-ring" aria-hidden="true" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mod-header-titolo">
              <Radio size={13} style={{ color: 'var(--primary)' }} />
              Pannello Mod
              <LiveIndicator token={twitchToken} />
            </div>
            <div className="mod-header-sotto">
              {twitchDisplay || twitchUser}
              {broadcaster && broadcaster !== twitchUser && (
                <> · canale <strong style={{ color: 'var(--accent-twitch)' }}>{broadcaster}</strong></>
              )}
            </div>
          </div>
          <button className="mod-cmdk-hint" onClick={() => setPaletteAperta(true)} title="Apri palette comandi (⌘K)">
            <Command size={12} />
            <kbd>⌘K</kbd>
          </button>
          <BotIndicator status={botStatus} onToggle={toggleBot} />
          <span className="chip mod-chip-mod" style={{ fontSize: '0.68rem' }}>
            <Shield size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />MOD
          </span>
        </div>
        {/* Quick Actions: raid, commercial, marker */}
        <QuickActions token={twitchToken} isLive />
      </motion.div>

      <div className="mod-panel-layout">
        {/* ─── Sidebar desktop ─── */}
        <nav className="mod-sidebar">
          {SEZIONI.map(s => {
            const Icon = s.icon;
            const attiva = sezione === s.id;
            return (
              <button key={s.id}
                className={`mod-nav-item${attiva ? ' mod-nav-item-active' : ''}`}
                onClick={() => setSezione(s.id)}
                style={attiva ? { borderColor: `${s.color}40`, color: s.color, background: `${s.color}0f` } : {}}>
                <Icon size={16} />
                <span>{s.label}</span>
                {attiva && <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </button>
            );
          })}
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.85rem', fontSize: '0.68rem', color: 'var(--text-faint)', borderTop: '1px solid var(--vetro-bordo-colore)', paddingTop: '0.7rem' }}>
            Tip: premi <kbd className="cmd-kbd-inline">⌘K</kbd> per saltare ovunque
          </div>
        </nav>

        {/* ─── Contenuto principale ─── */}
        <div className="mod-main-area">
          {/* Breadcrumb mobile */}
          <div className="mod-mobile-tabs" ref={mobileTabsRef}>
            {SEZIONI.map(s => {
              const Icon = s.icon;
              const attiva = sezione === s.id;
              return (
                <button key={s.id}
                  className={`mod-mobile-tab${attiva ? ' mod-mobile-tab-active' : ''}`}
                  onClick={() => setSezione(s.id)}
                  style={attiva ? { color: s.color, borderColor: `${s.color}50` } : {}}>
                  <Icon size={15} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Titolo sezione */}
          <div className="mod-section-titolo">
            <span className="mod-section-icon" style={{ color: sezioneInfo.color, background: `${sezioneInfo.color}1a` }}>
              <SezioneIcona size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{sezioneInfo.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{sezioneInfo.descrizione}</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={sezione}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}>
              <Suspense fallback={<SkeletonSezione />}>
                <SezioneAttiva token={twitchToken} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Command palette ⌘K */}
      <CommandPalette
        aperta={paletteAperta}
        onClose={() => setPaletteAperta(false)}
        voci={vociPalette}
        onScegli={(v) => setSezione(v.id)}
      />
    </main>
  );
}
