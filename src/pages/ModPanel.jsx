/**
 * ModPanel — Private dashboard for streamer & moderators.
 *
 * Hidden route (/mod-panel), not in navbar.
 * Shows CRUD UI for chat commands and timers stored in Redis.
 * Each command has a permission level (everyone/subscriber/vip/mod).
 * Requires Twitch login + username in MOD_USERNAMES whitelist.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Terminal, Timer, Plus, Trash2, Save, X, Copy, Check, LogIn,
  Twitch, ToggleLeft, ToggleRight, Loader, AlertTriangle, Clock, MessageSquare,
  Users, Star, Crown, Edit2,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const API_URL = '/api/mod-commands';

const PERMISSION_OPTIONS = [
  { value: 'everyone',   label: 'Tutti',       icon: Users, color: 'var(--secondary)' },
  { value: 'subscriber', label: 'Sub',         icon: Star,  color: 'var(--accent-twitch)' },
  { value: 'vip',        label: 'VIP',         icon: Crown, color: 'var(--accent-warm)' },
  { value: 'mod',        label: 'Mod',         icon: Shield, color: 'var(--accent)' },
];

function getPermissionInfo(value) {
  return PERMISSION_OPTIONS.find(p => p.value === value) || PERMISSION_OPTIONS[0];
}

const entrata = (ritardo = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

/* ─── Helpers ─── */

function formatInterval(seconds) {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
}

/* ═══════════════════════════════════════
   COMMAND FORM (modal / inline)
   ═══════════════════════════════════════ */
function CommandForm({ initial, onSave, onCancel, saving }) {
  const [trigger, setTrigger] = useState(initial?.trigger || '');
  const [response, setResponse] = useState(initial?.response || '');
  const [cooldown, setCooldown] = useState(initial?.cooldown ?? 10);
  const [permission, setPermission] = useState(initial?.permission || 'everyone');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ trigger: trigger.trim(), response: response.trim(), cooldown: Number(cooldown), permission });
  };

  return (
    <form onSubmit={handleSubmit} className="mod-form glass-card" style={{ padding: '1.25rem' }}>
      <div className="mod-form-row">
        <label>
          <Terminal size={14} /> Trigger
          <input
            type="text"
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="sito"
            maxLength={50}
            required
            className="mod-input"
            disabled={!!initial?.trigger}
          />
        </label>
        <label>
          <Clock size={14} /> Cooldown (sec)
          <input
            type="number"
            value={cooldown}
            onChange={e => setCooldown(e.target.value)}
            min={0}
            max={3600}
            className="mod-input mod-input-small"
          />
        </label>
      </div>
      <label>
        <MessageSquare size={14} /> Risposta
        <textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          placeholder="🔗 Ecco il sito: https://andryx.it"
          maxLength={500}
          required
          className="mod-input mod-textarea"
          rows={3}
        />
      </label>
      <div className="mod-permission-row">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          <Shield size={13} style={{ verticalAlign: 'middle' }} /> Chi può usarlo:
        </span>
        <div className="mod-permission-options">
          {PERMISSION_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                className={`mod-permission-btn${permission === opt.value ? ' mod-permission-btn-active' : ''}`}
                onClick={() => setPermission(opt.value)}
                style={permission === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
              >
                <Icon size={13} /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mod-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          <Save size={14} /> {initial?.trigger ? 'Salva' : 'Aggiungi'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          <X size={14} /> Annulla
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════
   TIMER FORM
   ═══════════════════════════════════════ */
function TimerForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const [message, setMessage] = useState(initial?.message || '');
  const [interval, setInterval_] = useState(initial?.interval ?? 300);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim(), message: message.trim(), interval: Number(interval), enabled });
  };

  return (
    <form onSubmit={handleSubmit} className="mod-form glass-card" style={{ padding: '1.25rem' }}>
      <div className="mod-form-row">
        <label>
          <Timer size={14} /> Nome
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="promo-sito"
            maxLength={50}
            required
            className="mod-input"
            disabled={!!initial?.name}
          />
        </label>
        <label>
          <Clock size={14} /> Intervallo (sec)
          <input
            type="number"
            value={interval}
            onChange={e => setInterval_(e.target.value)}
            min={60}
            max={7200}
            className="mod-input mod-input-small"
          />
        </label>
      </div>
      <label>
        <MessageSquare size={14} /> Messaggio
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="🔗 Visita il sito!"
          maxLength={500}
          required
          className="mod-input mod-textarea"
          rows={3}
        />
      </label>
      <div className="mod-form-row" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Attivo:</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
        >
          {enabled
            ? <ToggleRight size={28} color="var(--accent-spotify)" />
            : <ToggleLeft size={28} color="var(--text-faint)" />
          }
        </button>
      </div>
      <div className="mod-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          <Save size={14} /> {initial?.name ? 'Salva' : 'Aggiungi'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          <X size={14} /> Annulla
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════
   COPY BUTTON
   ═══════════════════════════════════════ */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <button
      className="mod-icon-btn"
      onClick={handleCopy}
      title="Copia"
    >
      {copied ? <Check size={14} color="var(--accent-spotify)" /> : <Copy size={14} />}
    </button>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function ModPanel() {
  const { twitchUser, twitchToken, isLoggedIn, loading: authLoading, getTwitchLoginUrl } = useTwitchAuth();

  const [commands, setCommands] = useState([]);
  const [timers, setTimers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMod, setIsMod] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showCmdForm, setShowCmdForm] = useState(false);
  const [editingCmd, setEditingCmd] = useState(null);
  const [showTimerForm, setShowTimerForm] = useState(false);
  const [editingTimer, setEditingTimer] = useState(null);

  // Active tab
  const [tab, setTab] = useState('commands');

  /* ─── Fetch data ─── */
  const fetchData = useCallback(async () => {
    if (!twitchToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (res.status === 403) {
        setIsMod(false);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento');
      const data = await res.json();
      setCommands(data.commands || []);
      setTimers(data.timers || []);
      setIsMod(data.isMod);
    } catch (e) {
      setError(e.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }, [twitchToken]);

  useEffect(() => {
    if (isLoggedIn && twitchToken) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isLoggedIn, twitchToken, authLoading, fetchData]);

  /* ─── Save command ─── */
  const saveCommand = async (data) => {
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ type: 'command', ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore');
      }
      setShowCmdForm(false);
      setEditingCmd(null);
      await fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Delete command ─── */
  const deleteCommand = async (trigger) => {
    if (!confirm(`Eliminare il comando !${trigger}?`)) return;
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ type: 'command', key: trigger }),
      });
      if (!res.ok) throw new Error('Errore nella cancellazione');
      await fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  /* ─── Save timer ─── */
  const saveTimer = async (data) => {
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ type: 'timer', ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore');
      }
      setShowTimerForm(false);
      setEditingTimer(null);
      await fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Delete timer ─── */
  const deleteTimer = async (name) => {
    if (!confirm(`Eliminare il timer "${name}"?`)) return;
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ type: 'timer', key: name }),
      });
      if (!res.ok) throw new Error('Errore nella cancellazione');
      await fetchData();
    } catch (e) {
      setError(e.message);
    }
  };

  /* ─── Toggle timer enabled ─── */
  const toggleTimer = async (timer) => {
    await saveTimer({ ...timer, enabled: !timer.enabled });
  };

  /* ─── Render states ─── */

  // Still loading auth
  if (authLoading || (isLoggedIn && loading)) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <SEO title="Mod Panel" description="Pannello moderatori — Comandi e timer per la chat." path="/mod-panel" />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={32} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Caricamento...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <SEO title="Mod Panel" description="Pannello moderatori — Comandi e timer per la chat." path="/mod-panel" />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Shield size={48} style={{ color: 'var(--accent)', margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ marginBottom: '0.75rem' }}>Accesso Riservato</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Devi effettuare il login con Twitch per accedere al pannello moderatori.
          </p>
          <a href={getTwitchLoginUrl('/mod-panel')} className="btn-primary" style={{ display: 'inline-flex', gap: '0.5rem' }}>
            <Twitch size={16} /> <LogIn size={16} /> Accedi con Twitch
          </a>
        </div>
      </div>
    );
  }

  // Not a mod
  if (!isMod) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <SEO title="Mod Panel" description="Pannello moderatori — Comandi e timer per la chat." path="/mod-panel" />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} style={{ color: 'var(--accent-warm)', margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ marginBottom: '0.75rem' }}>Accesso Negato</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Ciao <strong>{twitchUser}</strong>, questa sezione è riservata allo streamer e ai moderatori.
          </p>
        </div>
      </div>
    );
  }

  /* ─── Main panel ─── */
  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>
      <SEO title="Mod Panel" description="Pannello moderatori — Comandi e timer per la chat." path="/mod-panel" />

      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title">
          <Shield size={28} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent)' }} />
          <span className="text-gradient">Mod</span> Panel
        </h1>
        <p className="subtitle">Gestisci comandi e timer per la chat di Twitch.</p>
      </header>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="glass-card"
            style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderColor: 'rgba(255,107,107,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <AlertTriangle size={16} color="var(--accent)" />
            <span style={{ flex: 1, color: 'var(--accent)', fontSize: '0.85rem' }}>{error}</span>
            <button className="mod-icon-btn" onClick={() => setError('')}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab switcher */}
      <div className="mod-tabs" style={{ marginBottom: '1.25rem' }}>
        <button
          className={`mod-tab${tab === 'commands' ? ' mod-tab-active' : ''}`}
          onClick={() => setTab('commands')}
        >
          <Terminal size={16} /> Comandi <span className="mod-badge">{commands.length}</span>
        </button>
        <button
          className={`mod-tab${tab === 'timers' ? ' mod-tab-active' : ''}`}
          onClick={() => setTab('timers')}
        >
          <Timer size={16} /> Timer <span className="mod-badge">{timers.length}</span>
        </button>
      </div>

      {/* ─── COMMANDS TAB ─── */}
      {tab === 'commands' && (
        <motion.div {...entrata(0.05)}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                <Terminal size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Comandi Chat
              </h2>
              {!showCmdForm && (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => { setEditingCmd(null); setShowCmdForm(true); }}>
                  <Plus size={14} /> Nuovo
                </button>
              )}
            </div>

            <AnimatePresence>
              {showCmdForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                  <CommandForm
                    initial={editingCmd}
                    onSave={saveCommand}
                    onCancel={() => { setShowCmdForm(false); setEditingCmd(null); }}
                    saving={saving}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {commands.length === 0 && !showCmdForm ? (
              <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
                Nessun comando configurato. Clicca &quot;Nuovo&quot; per aggiungerne uno.
              </p>
            ) : (
              <div className="mod-list">
                {commands.map(cmd => {
                  const perm = getPermissionInfo(cmd.permission);
                  const PermIcon = perm.icon;
                  return (
                    <motion.div key={cmd.trigger} className="mod-item glass-card" layout {...entrata(0)}>
                      <div className="mod-item-header">
                        <code className="mod-trigger">!{cmd.trigger}</code>
                        <span className="chip mod-chip-permission" style={{
                          fontSize: '0.7rem',
                          background: `${perm.color}18`,
                          color: perm.color,
                          border: `1px solid ${perm.color}30`,
                        }}>
                          <PermIcon size={10} /> {perm.label}
                        </span>
                        {cmd.cooldown > 0 && (
                          <span className="chip" style={{ fontSize: '0.7rem' }}>
                            <Clock size={10} /> {cmd.cooldown}s
                          </span>
                        )}
                        <div className="mod-item-actions">
                          <CopyButton text={`!${cmd.trigger}`} />
                          <button className="mod-icon-btn" title="Modifica"
                            onClick={() => { setEditingCmd(cmd); setShowCmdForm(true); }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="mod-icon-btn mod-icon-btn-danger" title="Elimina"
                            onClick={() => deleteCommand(cmd.trigger)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="mod-item-body">{cmd.response}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── TIMERS TAB ─── */}
      {tab === 'timers' && (
        <motion.div {...entrata(0.05)}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                <Timer size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Timer Automatici
              </h2>
              {!showTimerForm && (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => { setEditingTimer(null); setShowTimerForm(true); }}>
                  <Plus size={14} /> Nuovo
                </button>
              )}
            </div>

            <AnimatePresence>
              {showTimerForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                  <TimerForm
                    initial={editingTimer}
                    onSave={saveTimer}
                    onCancel={() => { setShowTimerForm(false); setEditingTimer(null); }}
                    saving={saving}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {timers.length === 0 && !showTimerForm ? (
              <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
                Nessun timer configurato. Clicca &quot;Nuovo&quot; per aggiungerne uno.
              </p>
            ) : (
              <div className="mod-list">
                {timers.map(t => (
                  <motion.div key={t.name} className="mod-item glass-card" layout {...entrata(0)}>
                    <div className="mod-item-header">
                      <code className="mod-trigger">{t.name}</code>
                      <span className="chip" style={{ fontSize: '0.7rem' }}>
                        <Clock size={10} /> {formatInterval(t.interval)}
                      </span>
                      <button
                        className="mod-icon-btn"
                        onClick={() => toggleTimer(t)}
                        title={t.enabled ? 'Disattiva' : 'Attiva'}
                      >
                        {t.enabled
                          ? <ToggleRight size={22} color="var(--accent-spotify)" />
                          : <ToggleLeft size={22} color="var(--text-faint)" />
                        }
                      </button>
                      <div className="mod-item-actions">
                        <CopyButton text={t.message} />
                        <button className="mod-icon-btn" title="Modifica"
                          onClick={() => { setEditingTimer(t); setShowTimerForm(true); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="mod-icon-btn mod-icon-btn-danger" title="Elimina"
                          onClick={() => deleteTimer(t.name)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="mod-item-body">{t.message}</p>
                    {!t.enabled && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        Disattivato
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
