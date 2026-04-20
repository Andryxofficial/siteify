/**
 * ModPanel — Dashboard completa stile StreamElements per moderatori.
 *
 * Rotta nascosta (/mod-panel), non in navbar.
 * Shell con sidebar desktop / tab bar mobile.
 * Ogni sezione è un componente lazy-loaded da src/pages/mod/.
 */
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Activity, Terminal, Shield, Zap,
  TrendingUp, Monitor, Calendar, Twitch, LogIn, Loader,
  ChevronRight, Wifi, WifiOff, Radio,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { createTwitchBot } from '../utils/twitchBot';
import SEO from '../components/SEO';

// Sezioni lazy-loaded
const SecOverview    = lazy(() => import('./mod/Overview'));
const SecActivity    = lazy(() => import('./mod/Activity'));
const SecChat        = lazy(() => import('./mod/Chat'));
const SecModeration  = lazy(() => import('./mod/Moderation'));
const SecEngagement  = lazy(() => import('./mod/Engagement'));
const SecStats       = lazy(() => import('./mod/Stats'));
const SecOverlays    = lazy(() => import('./mod/Overlays'));
const SecSchedule    = lazy(() => import('./mod/Schedule'));

const SEZIONI = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard, color: 'var(--primary)' },
  { id: 'activity',    label: 'Attività',     icon: Activity,        color: 'var(--secondary)' },
  { id: 'chat',        label: 'Chat',         icon: Terminal,        color: 'var(--accent-warm)' },
  { id: 'moderation',  label: 'Moderazione',  icon: Shield,          color: 'var(--accent)' },
  { id: 'engagement',  label: 'Engagement',   icon: Zap,             color: 'var(--accent-twitch)' },
  { id: 'stats',       label: 'Statistiche',  icon: TrendingUp,      color: 'var(--accent-spotify)' },
  { id: 'overlays',    label: 'Overlay OBS',  icon: Monitor,         color: 'var(--secondary)' },
  { id: 'schedule',    label: 'Schedule',     icon: Calendar,        color: 'var(--primary)' },
];

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
      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color }}>
      <Icon size={14} />
      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{status === 'connected' ? 'BOT ON' : 'BOT OFF'}</span>
    </button>
  );
}

export default function ModPanel() {
  const { twitchToken, twitchUser, twitchDisplay, twitchAvatar, isLoggedIn, loading, getTwitchLoginUrl } = useTwitchAuth();
  const [sezione,    setSezione]  = useState('overview');
  const [isMod,      setIsMod]    = useState(null); // null=loading, true/false
  const [botStatus,  setBotStatus] = useState('disconnected');
  const [broadcaster, setBroadcaster] = useState('');
  const botRef = useRef(null);

  // Controlla se l'utente è mod facendo una richiesta al backend
  useEffect(() => {
    if (!isLoggedIn || !twitchToken) {
      // useEffect non deve chiamare setState direttamente in linea — usa una fn
      const reset = () => setIsMod(false);
      reset();
      return;
    }
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => setIsMod(!!d.isMod))
      .catch(() => setIsMod(false));
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

  const toggleBot = () => {
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
    // Aggiorna dati bot dai comandi/timer correnti
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => bot.updateData(d))
      .catch(() => {});
    botRef.current = bot;
    bot.connect();
  };

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

  // ─── Non loggato ───
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

  // ─── Accesso negato ───
  if (isMod === false) {
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

  const SezioneAttiva = {
    overview:   SecOverview,
    activity:   SecActivity,
    chat:       SecChat,
    moderation: SecModeration,
    engagement: SecEngagement,
    stats:      SecStats,
    overlays:   SecOverlays,
    schedule:   SecSchedule,
  }[sezione] || SecOverview;

  const sezioneInfo = SEZIONI.find(s => s.id === sezione) || SEZIONI[0];
  void sezioneInfo; // usato futuramente per il breadcrumb

  return (
    <main className="main-content mod-panel-shell" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 0 4rem' }}>
      <SEO title="Mod Panel" noindex />

      {/* ─── Header ─── */}
      <div className="mod-panel-header glass-card" style={{ padding: '0.9rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {twitchAvatar && (
          <img src={twitchAvatar} alt={twitchUser} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.1 }}>Mod Panel</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {twitchDisplay || twitchUser}
            {broadcaster && broadcaster !== twitchUser && <span> · canale: <strong>{broadcaster}</strong></span>}
          </div>
        </div>
        <BotIndicator status={botStatus} onToggle={toggleBot} />
        <span className="chip" style={{ fontSize: '0.68rem', background: 'rgba(145,70,255,.18)', color: 'var(--accent-twitch)' }}>
          <Shield size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />MOD
        </span>
      </div>

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
        </nav>

        {/* ─── Contenuto principale ─── */}
        <div className="mod-main-area">
          {/* Breadcrumb mobile */}
          <div className="mod-mobile-tabs">
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

          <AnimatePresence mode="wait">
            <motion.div key={sezione}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}>
              <Suspense fallback={<SkeletonSezione />}>
                <SezioneAttiva token={twitchToken} clientId={undefined} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
