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
  Film, Award, Command, Radio, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { createTwitchBot } from '../utils/twitchBot';
import SEO from '../components/SEO';
import QuickActions from './mod/QuickActions';
import CommandPalette from './mod/CommandPalette';

// Scope minimi richiesti per il Pannello Mod.
// ATTENZIONE: questa lista deve restare allineata con i `scope` nell'URL OAuth
// definito in src/contexts/TwitchAuthContext.jsx → buildTwitchLoginUrl().
// Se aggiungi/rimuovi scope dall'URL OAuth, aggiorna anche questa lista.
const SCOPI_PANNELLO_MOD = [
  'moderation:read',
  'channel:manage:broadcast',
  'channel:read:subscriptions',
  'channel:read:vips',
  'channel:manage:redemptions',
  'channel:read:goals',
  'channel:read:hype_train',
  'channel:read:charity',
  'moderator:manage:banned_users',
  'moderator:manage:chat_settings',
  'moderator:manage:announcements',
  'moderator:manage:warnings',
  'moderator:manage:shield_mode',
  'moderator:manage:blocked_terms',
  'moderator:manage:unban_requests',
  'moderator:manage:automod_settings',
  'moderator:read:chatters',
  'moderator:read:followers',
  'user:write:chat',
  'chat:read',
  'chat:edit',
];

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

/**
 * Banner scope mancanti — mostra un avviso chiaro quando il token OAuth
 * non include tutti i permessi necessari per il Pannello Mod.
 * Il token vecchio viene eliminato e l'utente viene reindirizzato al login.
 */
function BannerScopiMancanti({ scopiMancanti, onRiautentica }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{
        padding: '1rem 1.1rem',
        marginBottom: '1rem',
        borderColor: 'rgba(255,184,108,0.35)',
        background: 'linear-gradient(135deg, rgba(255,184,108,0.10), rgba(255,107,107,0.05) 60%, transparent)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <AlertTriangle size={18} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--accent-warm)' }}>
          Permessi Twitch insufficienti
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.6rem' }}>
          Il tuo token di accesso è vecchio e manca di alcuni permessi necessari
          (es. <code style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>
            {scopiMancanti.slice(0, 3).join(', ')}{scopiMancanti.length > 3 ? ` e altri ${scopiMancanti.length - 3}` : ''}
          </code>).
          Riautentica per aggiornare i permessi — i tuoi dati rimarranno invariati.
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.78rem', padding: '0.38rem 1rem', minHeight: 32 }}
          onClick={onRiautentica}
        >
          <RefreshCw size={13} /> Aggiorna permessi
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Banner: token broadcaster non disponibile in Redis.
 * Mostrato ai mod (non al broadcaster) quando il broadcaster non ha mai aperto
 * il pannello — alcune azioni falliranno finché Andryx non rinfresca il token.
 */
function BannerBroadcasterToken({ broadcasterUsername }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{
        padding: '1rem 1.1rem',
        marginBottom: '1rem',
        borderColor: 'rgba(255,184,108,0.35)',
        background: 'linear-gradient(135deg, rgba(255,184,108,0.10), rgba(255,107,107,0.05) 60%, transparent)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <AlertTriangle size={18} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--accent-warm)' }}>
          Autorizzazione broadcaster mancante
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {broadcasterUsername ? <><strong>{broadcasterUsername}</strong> deve</> : 'Il broadcaster (Andryx) deve'} aprire
          una volta il Mod Panel per autorizzare le azioni broadcaster (cambio titolo, sondaggi,
          predictions, rewards, schedule, raid, pubblicità, gestione VIP / sub).
          Le azioni di moderazione (ban, timeout, chat-settings, shoutout) continuano a funzionare normalmente.
        </div>
      </div>
    </motion.div>
  );
}

function BotIndicator({ status, onToggle }) {
  const acceso     = status === 'connected';
  const inAttesa   = status === 'connecting';
  const inErrore   = status === 'error';
  const Icon       = acceso ? Wifi : WifiOff;
  const coloreIcona = acceso ? 'var(--accent-spotify)' : inAttesa ? 'var(--accent-warm)' : inErrore ? '#ff6b6b' : 'var(--text-faint)';
  const titolo     = inAttesa
    ? 'Bot in connessione… clicca per annullare'
    : inErrore
    ? 'Errore autenticazione bot — clicca per riprovare (potrebbe servire ri-login)'
    : acceso ? 'Bot attivo — clicca per disattivare' : 'Bot disattivo — clicca per attivare';
  return (
    <div className="mod-bot-switch-wrap" title={titolo}>
      <Icon size={13} style={{ color: coloreIcona, flexShrink: 0 }} />
      <span className="mod-bot-switch-label">Bot</span>
      <button
        type="button"
        role="switch"
        aria-checked={acceso}
        aria-label={acceso ? 'Disattiva bot' : inAttesa ? 'Annulla connessione bot' : inErrore ? 'Ritenta connessione bot' : 'Attiva bot'}
        aria-busy={inAttesa}
        onClick={onToggle}
        className={`mod-bot-switch${acceso ? ' is-on' : ''}${inAttesa ? ' is-loading' : ''}${inErrore ? ' is-error' : ''}`}
        style={{ '--on': acceso ? 1 : 0 }}
      >
        <span className="mod-bot-switch-knob" />
      </button>
    </div>
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
  const { twitchToken, twitchUser, twitchDisplay, twitchAvatar, twitchScopes, isLoggedIn, loading, getTwitchLoginUrl, logout } = useTwitchAuth();
  const [sezione,    setSezione]    = useState(() => {
    // Leggi ?sezione= dalla callback OAuth del bot
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sezione');
    return (s && SEZIONI.find(x => x.id === s)) ? s : 'overview';
  });
  const [isMod,      setIsMod]      = useState(null); // null=loading, true/false
  const [broadcasterTokenOk, setBroadcasterTokenOk] = useState(true);
  const [botStatus,  setBotStatus]  = useState('disconnected');
  const [broadcaster, setBroadcaster] = useState('');
  const [paletteAperta, setPaletteAperta] = useState(false);
  const botRef = useRef(null);
  const mobileTabsRef = useRef(null);

  // Controlla se l'utente è mod facendo una richiesta al backend.
  // La risposta include anche `broadcasterTokenAvailable`: se false, alcune
  // azioni (cambio titolo, polls, rewards, schedule, raid…) falliranno finché
  // il broadcaster non aprirà una volta il pannello.
  useEffect(() => {
    if (!isLoggedIn || !twitchToken) return;
    let attivo = true;
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.json())
      .then(d => {
        if (!attivo) return;
        setIsMod(!!d.isMod);
        setBroadcasterTokenOk(d.broadcasterTokenAvailable !== false);
      })
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
    // Se esiste già un'istanza bot — in qualsiasi stato (connected, connecting,
    // error, disconnected in auto-reconnect) — la spegniamo. In questo modo lo
    // switch funziona anche per annullare un tentativo di connessione bloccato
    // e non si accumulano istanze fantasma che continuano a riconnettersi.
    if (botRef.current) {
      botRef.current.disconnect();
      botRef.current = null;
      setBotStatus('disconnected');
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
  }, [twitchToken, twitchUser, broadcaster]);

  // Voci della command palette: tutte le sezioni
  const vociPalette = useMemo(() => SEZIONI.map(s => ({
    id:     s.id,
    label:  s.label,
    descrizione: s.descrizione,
    icon:   s.icon,
    color:  s.color,
    gruppo: 'Sezione',
  })), []);

  // Handler ri-autenticazione: elimina il token da localStorage (sincrono)
  // poi reindirizza — la rimozione è garantita prima del redirect poiché
  // localStorage.removeItem() è un'operazione sincrona.
  // NOTA: deve stare PRIMA dei return condizionali per rispettare le Regole degli Hook.
  const riautentica = useCallback(() => {
    localStorage.removeItem('twitchGameToken');
    window.location.href = getTwitchLoginUrl('/mod-panel');
  }, [getTwitchLoginUrl]);

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

  // Calcola scope mancanti: confronta quelli necessari con quelli presenti nel token
  const scopiMancanti = twitchScopes.length > 0
    ? SCOPI_PANNELLO_MOD.filter(s => !twitchScopes.includes(s))
    : [];

  return (
    <main className="mod-panel-shell">
      <SEO title="Pannello Mod" noindex />

      {/* ─── Header magico ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="mod-panel-header glass-card"
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

          {/* ── Banner scope mancanti: visibile se il token non ha i permessi necessari ── */}
          {scopiMancanti.length > 0 && (
            <BannerScopiMancanti scopiMancanti={scopiMancanti} onRiautentica={riautentica} />
          )}

          {/* ── Banner: il broadcaster non ha ancora autorizzato il pannello ──
              Mostrato solo ai mod che non sono il broadcaster stesso (per Andryx
              il problema si risolve da solo aprendo il pannello, e il flag
              `broadcasterTokenOk` diventerà `true` al prossimo refresh). */}
          {!broadcasterTokenOk && twitchUser && broadcaster && twitchUser !== broadcaster && (
            <BannerBroadcasterToken broadcasterUsername={broadcaster} />
          )}

          {/* Titolo sezione */}
          <div className="mod-section-titolo">
            <span className="mod-section-icon" style={{ color: sezioneInfo.color, background: `${sezioneInfo.color}1a` }}>
              <SezioneIcona size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{sezioneInfo.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sezioneInfo.descrizione}</div>
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
