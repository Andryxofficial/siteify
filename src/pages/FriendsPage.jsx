/**
 * FriendsPage — Social friends management.
 *
 * Route: /amici (hidden — not in navbar)
 * Accessible only when logged in with Twitch.
 * Shows: friend list, incoming requests, search users, friendship actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, UserMinus, UserCheck, Clock, X, Check, Search,
  Twitch, LogIn, Loader, MessageSquare, ExternalLink,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const API_URL = '/api/friends';

const entrata = (ritardo = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoFa(ts) {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore}h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 30) return `${giorni}g fa`;
  return `${Math.floor(giorni / 30)} mesi fa`;
}

export default function FriendsPage() {
  const { isLoggedIn, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();

  const [tab, setTab] = useState('friends'); // friends | requests | search
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState(null); // { status, target }
  const [searching, setSearching] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!twitchToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) throw new Error('Errore di rete');
      const data = await res.json();
      setFriends(data.friends || []);
      setRequests(data.requests || []);
      setSent(data.sent || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [twitchToken]);

  useEffect(() => { if (isLoggedIn) loadFriends(); }, [isLoggedIn, loadFriends]);

  const doAction = async (action, target) => {
    setActionLoading(target);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      await loadFriends();
      // Reset search status after action
      if (searchStatus?.target === target) setSearchStatus(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const searchUser = async () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return;
    setSearching(true);
    setSearchStatus(null);
    try {
      const res = await fetch(`${API_URL}?user=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) throw new Error('Errore');
      const data = await res.json();
      setSearchStatus(data);
    } catch {
      setSearchStatus({ status: 'error', target: q });
    } finally {
      setSearching(false);
    }
  };

  /* ── Not logged in ── */
  if (!isLoggedIn) {
    return (
      <div className="main-content">
        <SEO title="Amici — SOCIALify" description="Gestisci le tue amicizie su ANDRYXify" path="/amici" />
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginTop: '1rem' }} {...entrata(0.1)}>
          <Users size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Accedi per gestire i tuoi amici</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Effettua il login con Twitch per aggiungere amici e inviare messaggi.
          </p>
          {clientId && (
            <a href={getTwitchLoginUrl('/amici')} className="btn social-btn-twitch">
              <LogIn size={14} /> Accedi con Twitch
            </a>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <SEO title="Amici — SOCIALify" description="Gestisci le tue amicizie su ANDRYXify" path="/amici" />

      {/* Header */}
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <Users size={28} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span className="text-gradient">Amici</span>
        </motion.h1>
        <motion.p className="subtitle" {...entrata(0.1)}>
          Gestisci le tue amicizie nella community.
        </motion.p>
      </section>

      {/* Tabs */}
      <motion.div {...entrata(0.15)} className="mod-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`mod-tab${tab === 'friends' ? ' mod-tab-active' : ''}`} onClick={() => setTab('friends')}>
          <Users size={15} /> Amici <span className="mod-badge">{friends.length}</span>
        </button>
        <button className={`mod-tab${tab === 'requests' ? ' mod-tab-active' : ''}`} onClick={() => setTab('requests')}>
          <UserPlus size={15} /> Richieste
          {requests.length > 0 && <span className="mod-badge" style={{ background: 'var(--accent)', color: 'white' }}>{requests.length}</span>}
        </button>
        <button className={`mod-tab${tab === 'search' ? ' mod-tab-active' : ''}`} onClick={() => setTab('search')}>
          <Search size={15} /> Cerca
        </button>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderColor: 'rgba(255,107,107,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <span style={{ flex: 1, color: 'var(--accent)', fontSize: '0.85rem' }}>{error}</span>
            <button className="mod-icon-btn" onClick={() => setError('')}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FRIENDS TAB ─── */}
      {tab === 'friends' && (
        <motion.div className="glass-panel" style={{ padding: '1.25rem' }} {...entrata(0.05)}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader size={20} className="spin" /> Caricamento…
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🫥</p>
              <p style={{ fontSize: '0.9rem' }}>Nessun amico ancora. Usa la ricerca per aggiungerne!</p>
            </div>
          ) : (
            <div className="mod-list">
              {friends.map(f => (
                <div key={f} className="mod-item glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
                  <Twitch size={16} color="#9146FF" />
                  <span style={{ fontWeight: 600, flex: 1 }}>{f}</span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <Link to={`/messaggi?con=${f}`} className="mod-icon-btn" title="Invia messaggio">
                      <MessageSquare size={14} />
                    </Link>
                    <button
                      className="mod-icon-btn mod-icon-btn-danger"
                      title="Rimuovi amico"
                      disabled={actionLoading === f}
                      onClick={() => doAction('remove', f)}
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── REQUESTS TAB ─── */}
      {tab === 'requests' && (
        <motion.div {...entrata(0.05)}>
          {/* Incoming */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              📩 Richieste ricevute ({requests.length})
            </h3>
            {requests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                Nessuna richiesta in sospeso.
              </p>
            ) : (
              <div className="mod-list">
                {requests.map(r => (
                  <div key={r.from} className="mod-item glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
                    {r.avatar ? (
                      <img src={r.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    ) : (
                      <Twitch size={16} color="#9146FF" />
                    )}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{r.display || r.from}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: '0.4rem' }}>
                        <Clock size={10} /> {tempoFa(r.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="mod-icon-btn" style={{ color: 'var(--accent-spotify)' }}
                        disabled={actionLoading === r.from} onClick={() => doAction('accept', r.from)} title="Accetta">
                        <Check size={16} />
                      </button>
                      <button className="mod-icon-btn mod-icon-btn-danger"
                        disabled={actionLoading === r.from} onClick={() => doAction('reject', r.from)} title="Rifiuta">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent */}
          {sent.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                📤 Richieste inviate ({sent.length})
              </h3>
              <div className="mod-list">
                {sent.map(s => (
                  <div key={s} className="mod-item glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
                    <Twitch size={16} color="#9146FF" />
                    <span style={{ fontWeight: 600, flex: 1 }}>{s}</span>
                    <button className="mod-icon-btn mod-icon-btn-danger" title="Annulla richiesta"
                      disabled={actionLoading === s} onClick={() => doAction('cancel', s)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── SEARCH TAB ─── */}
      {tab === 'search' && (
        <motion.div className="glass-panel" style={{ padding: '1.25rem' }} {...entrata(0.05)}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Search size={16} style={{ verticalAlign: 'middle' }} /> Cerca utente Twitch
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); searchUser(); }}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Username Twitch…"
              className="mod-input"
              style={{ flex: 1 }}
              maxLength={50}
            />
            <button type="submit" className="btn btn-primary" disabled={searching || searchQuery.trim().length < 2}
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
              {searching ? <Loader size={14} className="spin" /> : <Search size={14} />} Cerca
            </button>
          </form>

          <AnimatePresence>
            {searchStatus && (
              <motion.div className="glass-card" style={{ padding: '1rem' }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Twitch size={18} color="#9146FF" />
                  <span style={{ fontWeight: 600, flex: 1 }}>{searchStatus.target}</span>
                  {searchStatus.status === 'self' && (
                    <span className="chip" style={{ fontSize: '0.72rem' }}>Sei tu! 😄</span>
                  )}
                  {searchStatus.status === 'friends' && (
                    <span className="chip" style={{ fontSize: '0.72rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <UserCheck size={12} /> Già amici
                    </span>
                  )}
                  {searchStatus.status === 'pending' && (
                    <span className="chip" style={{ fontSize: '0.72rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                      <Clock size={12} /> Richiesta inviata
                    </span>
                  )}
                  {searchStatus.status === 'incoming' && (
                    <button className="btn btn-primary" onClick={() => doAction('accept', searchStatus.target)}
                      disabled={actionLoading === searchStatus.target}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}>
                      <Check size={13} /> Accetta richiesta
                    </button>
                  )}
                  {searchStatus.status === 'none' && (
                    <button className="btn btn-primary" onClick={() => doAction('send', searchStatus.target)}
                      disabled={actionLoading === searchStatus.target}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}>
                      <UserPlus size={13} /> Aggiungi
                    </button>
                  )}
                  {searchStatus.status === 'error' && (
                    <span style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>Errore nella ricerca</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p style={{ color: 'var(--text-faint)', fontSize: '0.76rem', marginTop: '1rem' }}>
            💡 Inserisci il nome utente Twitch esatto della persona che vuoi aggiungere.
          </p>
        </motion.div>
      )}

      {/* Discord integration */}
      <motion.div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1rem', textAlign: 'center' }} {...entrata(0.2)}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          🎮 Vuoi parlare in vocale?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Unisciti al server Discord della community per chat vocali, stanze tematiche e altro!
        </p>
        <a
          href={import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/andryx'}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1.3rem', background: 'linear-gradient(135deg, #5865F2, #7289DA)' }}
        >
          <ExternalLink size={14} /> Unisciti al Discord
        </a>
      </motion.div>
    </div>
  );
}
