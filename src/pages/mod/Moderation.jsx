/**
 * Moderation.jsx — Azioni di moderazione: ban, timeout, unban, warning, shoutout, clear chat
 * + impostazioni live della chat (slow/sub-only/follower/emote/unique).
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Ban, Clock, UserCheck, Trash2, Zap, Loader, Search, AlertTriangle, X, Check } from 'lucide-react';
import ChatSettings from './ChatSettings';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../../hooks/useEmoteTwitch';
import EmotePicker from '../../components/EmotePicker';

const API = '/api/mod-moderation';

function punisciLabel(action) {
  return action === 'ban' ? 'Bannato' : action === 'timeout' ? 'Timeout' : action === 'warning' ? 'Avvisato' : 'Graziato';
}

export default function Moderation({ token }) {
  const { twitchToken } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali } = useEmoteTwitch(twitchToken);
  const [targetLogin, setTargetLogin] = useState('');
  const [targetUser,  setTargetUser]  = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [reason,      setReason]      = useState('');
  const [duration,    setDuration]    = useState(600);
  const [actionType,  setActionType]  = useState('timeout'); // 'ban' | 'timeout' | 'unban' | 'warning'
  const [loading,     setLoading]     = useState(false);
  const [feedback,    setFeedback]    = useState(null); // { ok, message }
  const [shoutoutLogin, setShoutoutLogin] = useState('');
  const [soLoading, setSoLoading] = useState(false);
  const [soFeedback, setSoFeedback] = useState(null);

  const cercaUtente = useCallback(async () => {
    if (!targetLogin.trim()) return;
    setSearching(true);
    setTargetUser(null);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'lookup_user', login: targetLogin.trim() }),
      });
      const d = await r.json();
      setTargetUser(d.user || null);
      if (!d.user) setFeedback({ ok: false, message: 'Utente non trovato.' });
    } catch (e) { setFeedback({ ok: false, message: e.message }); }
    finally    { setSearching(false); }
  }, [token, targetLogin]);

  const eseguiAzione = useCallback(async () => {
    if (!targetUser) return;
    if (actionType === 'warning' && !reason.trim()) {
      setFeedback({ ok: false, message: 'L\'azione "Avvisa" richiede una motivazione.' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const body = {
        action: actionType,
        target_user_id: targetUser.id,
        target_login:   targetUser.login,
        reason: reason || undefined,
        duration: actionType === 'timeout' ? duration : undefined,
      };
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        // Errore strutturato: scope_missing, broadcaster_token_missing, ecc.
        const msg = d.code === 'scope_missing'
          ? `Permesso mancante: ${(d.requiredScopes || []).join(', ')}. Riautentica con i permessi richiesti.`
          : (d.error || 'Errore sconosciuto');
        throw new Error(msg);
      }
      setFeedback({ ok: true, message: `${punisciLabel(actionType)} ${targetUser.display_name} con successo.` });
      setTargetUser(null); setTargetLogin(''); setReason('');
    } catch (e) { setFeedback({ ok: false, message: e.message }); }
    finally    { setLoading(false); }
  }, [token, targetUser, actionType, reason, duration]);

  const clearChat = useCallback(async () => {
    if (!confirm('Cancellare tutta la chat?')) return;
    setLoading(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'clear' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFeedback({ ok: true, message: 'Chat cancellata.' });
    } catch (e) { setFeedback({ ok: false, message: e.message }); }
    finally    { setLoading(false); }
  }, [token]);

  const shoutout = useCallback(async () => {
    if (!shoutoutLogin.trim()) return;
    setSoLoading(true); setSoFeedback(null);
    try {
      // Recupera l'ID dell'utente a cui fare shoutout
      const ru = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'lookup_user', login: shoutoutLogin.trim() }),
      });
      const du = await ru.json();
      if (!du.user) throw new Error('Utente non trovato.');
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'shoutout', to_broadcaster_id: du.user.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSoFeedback({ ok: true, message: `Shoutout a ${du.user.display_name} inviato!` });
      setShoutoutLogin('');
    } catch (e) { setSoFeedback({ ok: false, message: e.message }); }
    finally    { setSoLoading(false); }
  }, [token, shoutoutLogin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Impostazioni chat live (slow/sub-only/follower/emote/unique) */}
      <ChatSettings token={token} />

      {/* Feedback globale */}
      <AnimatePresence>
        {feedback && (
          <motion.div className="glass-card"
            style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: feedback.ok ? 'rgba(29,185,84,0.3)' : 'rgba(255,107,107,0.3)' }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {feedback.ok ? <Check size={14} color="var(--accent-spotify)" /> : <AlertTriangle size={14} color="var(--accent)" />}
            <span className={feedback.ok ? 'text-tonal-success' : 'text-tonal-danger'} style={{ flex: 1, fontSize: '0.85rem' }}>{feedback.message}</span>
            <button className="mod-icon-btn" onClick={() => setFeedback(null)}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ban / Timeout / Unban */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
          <Shield size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent)' }} />
          Ban / Timeout / Grazia
        </h3>

        {/* Tipo azione */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { k: 'ban',     label: 'Ban',     icon: Ban,            color: 'var(--accent)' },
            { k: 'timeout', label: 'Timeout', icon: Clock,          color: 'var(--accent-warm)' },
            { k: 'warning', label: 'Avvisa',  icon: AlertTriangle,  color: 'var(--accent-twitch)' },
            { k: 'unban',   label: 'Grazia',  icon: UserCheck,      color: 'var(--accent-spotify)' },
          ].map(({ k, label, icon: Icon, color }) => (
            <button key={k}
              onClick={() => setActionType(k)}
              className={`mod-permission-btn${actionType === k ? ' mod-permission-btn-active' : ''}`}
              style={actionType === k ? { borderColor: color, color } : {}}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Cerca utente */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input className="mod-input" value={targetLogin}
            onChange={e => setTargetLogin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cercaUtente()}
            placeholder="Username Twitch" style={{ flex: 1 }} />
          <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            onClick={cercaUtente} disabled={searching}>
            {searching ? <Loader size={13} className="spin" /> : <Search size={13} />} Cerca
          </button>
        </div>

        {/* Info utente trovato */}
        {targetUser && (
          <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {targetUser.profile_image_url && (
              <img src={targetUser.profile_image_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{targetUser.display_name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {targetUser.id}</div>
            </div>
            <button className="mod-icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setTargetUser(null)}><X size={13} /></button>
          </div>
        )}

        {actionType !== 'unban' && (
          <div className="mod-form-row" style={{ marginBottom: '0.75rem', alignItems: 'flex-end' }}>
            <label style={{ flex: 2 }}>
              {actionType === 'warning' ? 'Motivazione (obbligatoria)' : 'Motivazione'}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input className="mod-input" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={actionType === 'warning' ? 'es. linguaggio inappropriato' : 'es. spam'}
                  maxLength={500} style={{ flex: 1 }} />
                <EmotePicker
                  emoteCanale={emoteCanale}
                  emoteGlobali={emoteGlobali}
                  seventvCanale={seventvCanale}
                  seventvGlobali={seventvGlobali}
                  onSelect={(nome) => setReason(prev => (prev ? `${prev} ${nome}` : nome).slice(0, 500))}
                />
              </div>
            </label>
            {actionType === 'timeout' && (
              <label>
                Durata (sec)
                <input className="mod-input mod-input-small" type="number" value={duration}
                  onChange={e => setDuration(e.target.value)} min={1} max={1209600} />
              </label>
            )}
          </div>
        )}

        <button className="btn-primary" disabled={!targetUser || loading} onClick={eseguiAzione}
          style={{ fontSize: '0.85rem' }}>
          {loading ? <Loader size={13} className="spin" /> :
            actionType === 'warning' ? <AlertTriangle size={13} /> : <Ban size={13} />}
          {actionType === 'ban' ? 'Banna' :
           actionType === 'timeout' ? 'Timeout' :
           actionType === 'warning' ? 'Invia avviso' : 'Grazia'}
        </button>
      </div>

      {/* Clear chat + Shoutout */}
      <div className="mod-grid-2">
        {/* Clear chat */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent)' }} />
            Cancella Chat
          </h3>
          <button className="btn-primary btn-tonal-danger" style={{ fontSize: '0.8rem' }}
            onClick={clearChat} disabled={loading}>
            <Trash2 size={13} /> Cancella ora
          </button>
        </div>

        {/* Shoutout */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Zap size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-warm)' }} />
            Shoutout
          </h3>
          {soFeedback && (
            <p className={soFeedback.ok ? 'text-tonal-success' : 'text-tonal-danger'} style={{ fontSize: '0.78rem', marginBottom: '0.5rem' }}>{soFeedback.message}</p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input className="mod-input" value={shoutoutLogin}
              onChange={e => setShoutoutLogin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && shoutout()}
              placeholder="Username" style={{ flex: 1 }} />
            <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              onClick={shoutout} disabled={soLoading}>
              {soLoading ? <Loader size={13} className="spin" /> : <Zap size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
