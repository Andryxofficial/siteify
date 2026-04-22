/**
 * Chatters.jsx — Lista degli spettatori attualmente in chat.
 *
 * GET /api/mod-chatters → {count, total, chatters:[{user_id, user_login, user_name}]}
 * Refresh automatico ogni 30s + bottone refresh manuale (force ?fresh=1).
 * Per ogni chatter: pulsanti Timeout 10m, Ban, Shoutout → POST /api/mod-moderation.
 * Input ricerca per filtrare la lista localmente.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Loader, RefreshCw, Search, Clock, Ban, Zap, AlertCircle,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet, modPost } from '../../utils/modApi';

export default function Chatters({ token }) {
  const toast = useToast();
  const [chatters, setChatters] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // user_id dell'azione in corso

  const loadChatters = useCallback(async (force = false) => {
    setLoading(true);
    const url = force ? '/api/mod-chatters?fresh=1' : '/api/mod-chatters';
    const r = await modGet(url, token);
    if (r.ok) {
      setChatters(r.data?.chatters || []);
      setCount(r.data?.count || 0);
    } else {
      toast.error(r.error, { titolo: 'Chatters' });
    }
    setLoading(false);
  }, [token, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChatters();
    // Refresh automatico ogni 30s
    const interval = setInterval(() => loadChatters(), 30000);
    return () => clearInterval(interval);
  }, [loadChatters]);

  const handleTimeout = useCallback(async (chatter) => {
    setActionLoading(chatter.user_id);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'timeout',
      target_user_id: chatter.user_id,
      duration: 600, // 10 minuti
      reason: 'Timeout rapido da lista chatters',
    });
    if (r.ok) {
      toast.success(`Timeout di 10min a ${chatter.user_name}`, { titolo: '⏱️ Timeout' });
    } else {
      toast.error(r.error, { titolo: 'Timeout fallito' });
    }
    setActionLoading(null);
  }, [token, toast]);

  const handleBan = useCallback(async (chatter) => {
    if (!confirm(`Bannare permanentemente ${chatter.user_name}?`)) return;
    setActionLoading(chatter.user_id);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'ban',
      target_user_id: chatter.user_id,
      reason: 'Ban rapido da lista chatters',
    });
    if (r.ok) {
      toast.success(`${chatter.user_name} bannato.`, { titolo: '🔨 Ban' });
      await loadChatters();
    } else {
      toast.error(r.error, { titolo: 'Ban fallito' });
    }
    setActionLoading(null);
  }, [token, toast, loadChatters]);

  const handleShoutout = useCallback(async (chatter) => {
    setActionLoading(chatter.user_id);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'shoutout',
      to_broadcaster_id: chatter.user_id,
    });
    if (r.ok) {
      toast.success(`Shoutout a ${chatter.user_name} inviato!`, { titolo: '⚡ Shoutout' });
    } else {
      toast.error(r.error, { titolo: 'Shoutout fallito' });
    }
    setActionLoading(null);
  }, [token, toast]);

  const filteredChatters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return chatters;
    return chatters.filter(c =>
      c.user_login?.toLowerCase().includes(q) ||
      c.user_name?.toLowerCase().includes(q)
    );
  }, [chatters, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1, minWidth: 'max-content' }}>
          <Users size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent-twitch)' }} />
          Chatters in Live
        </h2>
        <div className="chip" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {count} utenti
        </div>
        <button
          className="mod-icon-btn"
          onClick={() => loadChatters(true)}
          disabled={loading}
          title="Aggiorna"
        >
          {loading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {/* Ricerca */}
      <div className="glass-card" style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          className="mod-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cerca utente..."
          style={{ marginTop: 0, flex: 1 }}
        />
      </div>

      {/* Lista chatters */}
      {loading && chatters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={28} className="spin" style={{ color: 'var(--accent-twitch)' }} />
        </div>
      ) : filteredChatters.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {searchQuery ? 'Nessun utente trovato.' : 'Nessuno in chat al momento.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.65rem' }}>
          {filteredChatters.map((c, i) => {
            const inLavoro = actionLoading === c.user_id;
            return (
              <motion.div
                key={c.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.25) }}
                className="glass-card"
                style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  {c.user_name || c.user_login}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  @{c.user_login}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: 'auto' }}>
                  <button
                    className="mod-icon-btn"
                    onClick={() => handleTimeout(c)}
                    disabled={inLavoro}
                    title="Timeout 10 minuti"
                    style={{ flex: 1, fontSize: '0.72rem', padding: '0.35rem 0.5rem', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    {inLavoro ? <Loader size={11} className="spin" /> : <Clock size={11} />}
                    <span>10m</span>
                  </button>
                  <button
                    className="mod-icon-btn mod-icon-btn-danger"
                    onClick={() => handleBan(c)}
                    disabled={inLavoro}
                    title="Ban"
                    style={{ flex: 1, fontSize: '0.72rem', padding: '0.35rem 0.5rem', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    {inLavoro ? <Loader size={11} className="spin" /> : <Ban size={11} />}
                    <span>Ban</span>
                  </button>
                  <button
                    className="mod-icon-btn"
                    onClick={() => handleShoutout(c)}
                    disabled={inLavoro}
                    title="Shoutout"
                    style={{ flex: 1, fontSize: '0.72rem', padding: '0.35rem 0.5rem', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    {inLavoro ? <Loader size={11} className="spin" /> : <Zap size={11} />}
                    <span>SO</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
