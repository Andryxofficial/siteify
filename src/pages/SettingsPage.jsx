/**
 * SettingsPage — Pagina impostazioni utente.
 * Route: /impostazioni
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Bell, Shield, Palette, Eye, Database, LogOut, Check, Download, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const NOTIF_PREFS_KEY = 'andryxify_msg_notif_prefs';
const TEMA_KEY = 'andryxify_tema';
const TEMI = [
  { id: 'default', label: 'Default', color: '#e040fb' },
  { id: 'magenta', label: 'Magenta', color: '#ff4081' },
  { id: 'cyan', label: 'Ciano', color: '#00e5ff' },
  { id: 'amber', label: 'Ambra', color: '#ffb300' },
  { id: 'emerald', label: 'Smeraldo', color: '#4ade80' },
];

const entrata = (ritardo = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function Interruttore({ attivo, onChange, etichetta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
      <span style={{ fontSize: '0.9rem' }}>{etichetta}</span>
      <button
        role="switch"
        aria-checked={attivo}
        onClick={() => onChange(!attivo)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: attivo ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: attivo ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const {
    isLoggedIn, twitchUser, twitchDisplay, twitchAvatar, twitchToken,
    logout, clientId, getTwitchLoginUrl,
  } = useTwitchAuth();

  // Notifiche
  const [notifiche, setNotifiche] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTIF_PREFS_KEY);
      return saved ? JSON.parse(saved) : { inApp: true, push: false, sound: true };
    } catch { return { inApp: true, push: false, sound: true }; }
  });

  // Tema
  const [temaAttivo, setTemaAttivo] = useState(() => localStorage.getItem(TEMA_KEY) || 'default');

  // Privacy
  const [privacy, setPrivacy] = useState({ friendRequestsOpen: true, visibility: 'public' });
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Carica privacy dal server
  useEffect(() => {
    if (!twitchToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/profile?user=${encodeURIComponent(twitchUser)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPrivacy({
            friendRequestsOpen: data.friendRequestsOpen !== false,
            visibility: data.visibility || 'public',
          });
        }
      } catch { /* silenzioso */ }
    })();
  }, [twitchToken, twitchUser]);

  // Salva notifiche
  useEffect(() => {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notifiche));
  }, [notifiche]);

  // Salva e applica tema
  useEffect(() => {
    localStorage.setItem(TEMA_KEY, temaAttivo);
    const tema = TEMI.find(t => t.id === temaAttivo);
    if (tema) document.documentElement.style.setProperty('--primary', tema.color);
  }, [temaAttivo]);

  const aggiornaNotifica = (campo, valore) => {
    setNotifiche(prev => ({ ...prev, [campo]: valore }));
  };

  const salvaPrivacy = useCallback(async (nuovaPrivacy) => {
    if (!twitchToken) return;
    setPrivacyLoading(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify(nuovaPrivacy),
      });
      setPrivacy(nuovaPrivacy);
    } catch { /* silenzioso */ }
    finally { setPrivacyLoading(false); }
  }, [twitchToken]);


  const esportaDati = () => {
    const dati = {
      notifiche,
      tema: temaAttivo,
      privacy,
      esportatoIl: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `andryxify-impostazioni-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Non autenticato ── */
  if (!isLoggedIn) {
    return (
      <div className="main-content">
        <SEO title="Impostazioni" description="Gestisci il tuo account, notifiche, privacy e sicurezza su ANDRYXify." path="/impostazioni" noindex />
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginTop: '1rem' }} {...entrata(0.1)}>
          <Settings size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Accedi per le impostazioni</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Effettua il login con Twitch per gestire il tuo account e le preferenze.
          </p>
          {clientId && (
            <a href={getTwitchLoginUrl('/impostazioni')} className="btn social-btn-twitch">
              <LogIn size={14} /> Accedi con Twitch
            </a>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <SEO title="Impostazioni" description="Gestisci il tuo account, notifiche, privacy e sicurezza su ANDRYXify." path="/impostazioni" noindex />

      {/* Intestazione */}
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <Settings size={28} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span className="text-gradient">Impostazioni</span>
        </motion.h1>
      </section>

      {/* ═══ Account ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.1)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '1rem' }}>
          <User size={18} /> Account
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {twitchAvatar ? (
            <img src={twitchAvatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={28} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{twitchDisplay || twitchUser}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{twitchUser}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to={`/profilo/${twitchUser}`} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            <User size={14} /> Vedi profilo
          </Link>
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem', color: 'var(--accent)' }} onClick={logout}>
            <LogOut size={14} /> Esci
          </button>
        </div>
      </motion.section>

      {/* ═══ Notifiche ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.15)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Bell size={18} /> Notifiche
        </h3>
        <Interruttore etichetta="Notifiche in-app" attivo={notifiche.inApp} onChange={v => aggiornaNotifica('inApp', v)} />
        <Interruttore etichetta="Notifiche push" attivo={notifiche.push} onChange={v => aggiornaNotifica('push', v)} />
        <Interruttore etichetta="Suoni" attivo={notifiche.sound} onChange={v => aggiornaNotifica('sound', v)} />
      </motion.section>

      {/* ═══ Sicurezza E2E ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.2)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Shield size={18} /> Sicurezza E2E
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          La crittografia end-to-end è configurata direttamente nella sezione Messaggi.
          Puoi gestire le chiavi, aggiungere dispositivi o reimpostare la crittografia da lì.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/messaggi" className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            <Check size={13} /> Vai a Messaggi
          </Link>
        </div>
      </motion.section>

      {/* ═══ Aspetto ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.25)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Palette size={18} /> Aspetto
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>Colore principale dell'interfaccia:</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {TEMI.map(tema => (
            <button
              key={tema.id}
              title={tema.label}
              onClick={() => setTemaAttivo(tema.id)}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: tema.color, cursor: 'pointer', position: 'relative',
                boxShadow: temaAttivo === tema.id ? `0 0 0 3px ${tema.color}44, inset 0 0 0 2px #fff` : '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.2s',
              }}
              aria-label={tema.label}
            >
              {temaAttivo === tema.id && (
                <Check size={16} color="#fff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              )}
            </button>
          ))}
        </div>
      </motion.section>

      {/* ═══ Privacy ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.3)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Eye size={18} /> Privacy
        </h3>
        <Interruttore
          etichetta="Richieste di amicizia aperte"
          attivo={privacy.friendRequestsOpen}
          onChange={v => salvaPrivacy({ ...privacy, friendRequestsOpen: v })}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
          <span style={{ fontSize: '0.9rem' }}>Visibilità profilo</span>
          <select
            value={privacy.visibility}
            onChange={e => salvaPrivacy({ ...privacy, visibility: e.target.value })}
            disabled={privacyLoading}
            style={{
              background: 'var(--surface-1)', color: 'var(--text)', border: '1px solid var(--glass-border)',
              borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            <option value="public">Pubblico</option>
            <option value="friends">Solo amici</option>
            <option value="private">Privato</option>
          </select>
        </div>
      </motion.section>

      {/* ═══ Dati ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '2rem' }} {...entrata(0.35)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Database size={18} /> Dati
        </h3>
        <button className="btn btn-ghost" style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }} onClick={esportaDati}>
          <Download size={14} /> Esporta impostazioni (JSON)
        </button>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
          Per eliminare il tuo account e tutti i dati associati, contatta l'amministratore tramite i canali social.
        </p>
      </motion.section>
    </div>
  );
}
