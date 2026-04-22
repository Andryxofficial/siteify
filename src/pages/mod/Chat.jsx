/**
 * Chat.jsx — Gestione comandi, timer, citazioni, contatori e parole chiave.
 * Migrazione completa dalla vecchia ModPanel con tab interne.
 *
 * Supporta inserimento di emote Twitch + 7TV (incluse animate) nelle risposte
 * dei comandi/keyword e nei messaggi dei timer, tramite EmotePicker.
 * L'anteprima delle emote viene renderizzata nelle card dei comandi.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Timer, Quote, Hash, Plus, Trash2, Save, X, Copy, Check,
  Edit2, Clock, ToggleLeft, ToggleRight, Loader, Shield, Users, Star, Crown,
  MessageSquare, RefreshCw, Sparkles,
} from 'lucide-react';
import EmotePicker from '../../components/EmotePicker';
import { useEmoteTwitch } from '../../hooks/useEmoteTwitch';

const API = '/api/mod-commands';

const PERMISSION_OPTIONS = [
  { value: 'everyone',   label: 'Tutti',  icon: Users,  color: 'var(--secondary)' },
  { value: 'subscriber', label: 'Sub',    icon: Star,   color: 'var(--accent-twitch)' },
  { value: 'vip',        label: 'VIP',    icon: Crown,  color: 'var(--accent-warm)' },
  { value: 'mod',        label: 'Mod',    icon: Shield, color: 'var(--accent)' },
];
const getPermInfo = v => PERMISSION_OPTIONS.find(p => p.value === v) || PERMISSION_OPTIONS[0];

function formatInterval(s) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="mod-icon-btn" onClick={async () => { await navigator.clipboard.writeText(text).catch(()=>{}); setOk(true); setTimeout(()=>setOk(false),1400); }}>
      {ok ? <Check size={13} color="var(--accent-spotify)" /> : <Copy size={13} />}
    </button>
  );
}

/* ── Helper: inserisce un nome emote alla posizione del cursore in un textarea ── */
function inserisciAlCursore(textareaRef, valore, setValore, nome) {
  const ta = textareaRef.current;
  if (!ta) {
    // Fallback: append alla fine
    setValore(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ');
    return;
  }
  const start = ta.selectionStart ?? valore.length;
  const end   = ta.selectionEnd   ?? valore.length;
  const prima = valore.slice(0, start);
  const dopo  = valore.slice(end);
  // Aggiungi spazi ai bordi se non già presenti
  const sepPrima = prima && !prima.endsWith(' ') ? ' ' : '';
  const sepDopo  = dopo && !dopo.startsWith(' ') ? ' ' : ' ';
  const nuovo = prima + sepPrima + nome + sepDopo + dopo;
  setValore(nuovo);
  // Riposiziona il cursore subito dopo l'emote inserita: somma di lunghezze,
  // evitando di ricostruire la stringa concatenata.
  const nuovoCursore = start + sepPrima.length + nome.length + sepDopo.length;
  requestAnimationFrame(() => {
    ta.focus();
    try { ta.setSelectionRange(nuovoCursore, nuovoCursore); } catch { /* noop */ }
  });
}

/* ── COMMAND FORM (riusato sia per !comandi che per keyword) ── */
function CommandForm({ initial, tipo: tipoFisso, onSave, onCancel, saving, emoteCanale, emoteGlobali, seventvCanale, seventvGlobali }) {
  const [trigger,    setTrigger]    = useState(initial?.trigger    || '');
  const [response,   setResponse]   = useState(initial?.response   || '');
  const [cooldown,   setCooldown]   = useState(initial?.cooldown   ?? 10);
  const [permission, setPermission] = useState(initial?.permission || 'everyone');
  const responseRef = useRef(null);
  const isKeyword = tipoFisso === 'keyword';
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ trigger: trigger.trim(), response: response.trim(), cooldown: Number(cooldown), permission, tipo: tipoFisso || 'comando' }); }} className="mod-form glass-card" style={{ padding: '1.25rem' }}>
      <div className="mod-form-row">
        <label>
          {isKeyword ? <><Sparkles size={13} /> Parola chiave</> : <><Terminal size={13} /> Trigger</>}
          <input className="mod-input" value={trigger} onChange={e => setTrigger(e.target.value)}
            placeholder={isKeyword ? 'sito (senza !)' : 'sito'} maxLength={50} required disabled={!!initial?.trigger} />
        </label>
        <label><Clock size={13} /> Cooldown (s)
          <input type="number" className="mod-input mod-input-small" value={cooldown} onChange={e => setCooldown(e.target.value)} min={0} max={3600} />
        </label>
      </div>
      {isKeyword && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
          Il bot risponderà ogni volta che la parola chiave appare nel messaggio (anche senza !, case insensitive).
        </p>
      )}
      <label>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span><MessageSquare size={13} /> Risposta</span>
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            seventvCanale={seventvCanale}
            seventvGlobali={seventvGlobali}
            onSelect={nome => inserisciAlCursore(responseRef, response, setResponse, nome)}
          />
        </span>
        <textarea ref={responseRef} className="mod-input mod-textarea" value={response} onChange={e => setResponse(e.target.value)} placeholder="🔗 Ecco il sito…" maxLength={500} required rows={2} />
      </label>
      <div className="mod-permission-row">
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}><Shield size={12} style={{ verticalAlign: 'middle' }} /> Chi può usarlo:</span>
        <div className="mod-permission-options">
          {PERMISSION_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.value} type="button"
                className={`mod-permission-btn${permission === opt.value ? ' mod-permission-btn-active' : ''}`}
                onClick={() => setPermission(opt.value)}
                style={permission === opt.value ? { borderColor: opt.color, color: opt.color } : {}}>
                <Icon size={12} /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mod-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}><Save size={13} /> {initial?.trigger ? 'Salva' : 'Aggiungi'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}><X size={13} /> Annulla</button>
      </div>
    </form>
  );
}

/* ── TIMER FORM ── */
function TimerForm({ initial, onSave, onCancel, saving, emoteCanale, emoteGlobali, seventvCanale, seventvGlobali }) {
  const [name,    setName]    = useState(initial?.name    || '');
  const [message, setMessage] = useState(initial?.message || '');
  const [interval_, setInterval_] = useState(initial?.interval ?? 300);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const messageRef = useRef(null);
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ name: name.trim(), message: message.trim(), interval: Number(interval_), enabled }); }} className="mod-form glass-card" style={{ padding: '1.25rem' }}>
      <div className="mod-form-row">
        <label><Timer size={13} /> Nome
          <input className="mod-input" value={name} onChange={e => setName(e.target.value)} placeholder="promo-sito" maxLength={50} required disabled={!!initial?.name} />
        </label>
        <label><Clock size={13} /> Intervallo (s)
          <input type="number" className="mod-input mod-input-small" value={interval_} onChange={e => setInterval_(e.target.value)} min={60} max={7200} />
        </label>
      </div>
      <label>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span><MessageSquare size={13} /> Messaggio</span>
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            seventvCanale={seventvCanale}
            seventvGlobali={seventvGlobali}
            onSelect={nome => inserisciAlCursore(messageRef, message, setMessage, nome)}
          />
        </span>
        <textarea ref={messageRef} className="mod-input mod-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="🔗 Visita il sito!" maxLength={500} required rows={2} />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Attivo:</span>
        <button type="button" onClick={() => setEnabled(!enabled)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
          {enabled ? <ToggleRight size={26} color="var(--accent-spotify)" /> : <ToggleLeft size={26} color="var(--text-faint)" />}
        </button>
      </div>
      <div className="mod-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}><Save size={13} /> {initial?.name ? 'Salva' : 'Aggiungi'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}><X size={13} /> Annulla</button>
      </div>
    </form>
  );
}

export default function Chat({ token }) {
  const [tab,       setTab]      = useState('commands');
  const [data,      setData]     = useState({ commands: [], timers: [], quotes: [], counters: [] });
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');

  // Carica le emote (Twitch + 7TV) per inserimento e anteprima
  const {
    emoteCanale, emoteGlobali, seventvCanale, seventvGlobali, renderTestoConEmote,
  } = useEmoteTwitch(token);

  // Props comuni passati alle form per il picker emote
  const propEmote = { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali };

  const [showCmdForm,    setShowCmdForm]    = useState(false);
  const [editingCmd,     setEditingCmd]     = useState(null);
  const [showKwForm,     setShowKwForm]     = useState(false);
  const [editingKw,      setEditingKw]      = useState(null);
  const [showTimerForm,  setShowTimerForm]  = useState(false);
  const [editingTimer,   setEditingTimer]   = useState(null);
  const [quoteText,      setQuoteText]      = useState('');
  const [counterName,    setCounterName]    = useState('');
  const [counterLabel,   setCounterLabel]   = useState('');

  const carica = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);

  const post = useCallback(async (body) => {
    setSaving(true);
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  }, [token, carica]);

  const del = useCallback(async (body) => {
    try {
      const r = await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      await carica();
    } catch (e) { setError(e.message); }
  }, [token, carica]);

  const patchCounter = useCallback(async (name, delta) => {
    try {
      const r = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'counter', key: name, delta }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      await carica();
    } catch (e) { setError(e.message); }
  }, [token, carica]);

  const aggiungiQuote = async () => {
    if (!quoteText.trim()) return;
    await post({ type: 'quote', text: quoteText.trim() });
    setQuoteText('');
  };

  const aggiungiCounter = async () => {
    if (!counterName.trim()) return;
    await post({ type: 'counter', name: counterName.trim(), label: counterLabel.trim() || counterName.trim(), value: 0 });
    setCounterName(''); setCounterLabel('');
  };

  // Separa comandi normali (!) da parole chiave
  const comandiNormali = (data.commands || []).filter(c => !c.tipo || c.tipo === 'comando');
  const paroleChiave   = (data.commands || []).filter(c => c.tipo === 'keyword');

  const TABS = [
    { k: 'commands', label: 'Comandi', icon: Terminal,  count: comandiNormali.length },
    { k: 'keywords', label: 'Parole chiave', icon: Sparkles, count: paroleChiave.length },
    { k: 'timers',   label: 'Timer',   icon: Timer,     count: data.timers?.length },
    { k: 'quotes',   label: 'Citazioni', icon: Quote,   count: data.quotes?.length },
    { k: 'counters', label: 'Contatori', icon: Hash,    count: data.counters?.length },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader size={28} className="spin" style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderColor: 'rgba(255,107,107,0.3)' }}>
          <span style={{ flex: 1, color: 'var(--accent)', fontSize: '0.85rem' }}>{error}</span>
          <button className="mod-icon-btn" onClick={() => setError('')}><X size={13} /></button>
        </div>
      )}

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {TABS.map(({ k, label, icon: Icon, count }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`mod-tab${tab === k ? ' mod-tab-active' : ''}`}>
            <Icon size={14} /> {label} <span className="mod-badge">{count}</span>
          </button>
        ))}
        <button className="mod-icon-btn" onClick={carica} style={{ marginLeft: 'auto' }} title="Aggiorna"><RefreshCw size={13} /></button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {/* ── COMANDI ! ── */}
        {tab === 'commands' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Terminal size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Comandi Chat</h3>
              {!showCmdForm && (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => { setEditingCmd(null); setShowCmdForm(true); }}><Plus size={13} /> Nuovo</button>
              )}
            </div>
            <AnimatePresence>
              {showCmdForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ marginBottom: '1rem' }}>
                  <CommandForm tipo="comando" initial={editingCmd} onSave={async d => { await post({ type: 'command', ...d }); setShowCmdForm(false); setEditingCmd(null); }} onCancel={() => { setShowCmdForm(false); setEditingCmd(null); }} saving={saving} {...propEmote} />
                </motion.div>
              )}
            </AnimatePresence>
            {comandiNormali.length === 0 && !showCmdForm && (
              <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Nessun comando. Clicca "Nuovo" per aggiungerne uno.</p>
            )}
            <div className="mod-list">
              {comandiNormali.map(cmd => {
                const perm = getPermInfo(cmd.permission);
                const PI = perm.icon;
                return (
                  <div key={cmd.trigger} className="mod-item glass-card">
                    <div className="mod-item-header">
                      <code className="mod-trigger">!{cmd.trigger}</code>
                      <span className="chip mod-chip-permission" style={{ fontSize: '0.68rem', background: `${perm.color}18`, color: perm.color, border: `1px solid ${perm.color}30` }}>
                        <PI size={10} /> {perm.label}
                      </span>
                      {cmd.cooldown > 0 && <span className="chip" style={{ fontSize: '0.68rem' }}><Clock size={10} /> {cmd.cooldown}s</span>}
                      <div className="mod-item-actions">
                        <CopyBtn text={`!${cmd.trigger}`} />
                        <button className="mod-icon-btn" onClick={() => { setEditingCmd(cmd); setShowCmdForm(true); }}><Edit2 size={13} /></button>
                        <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => { if (confirm(`Eliminare !${cmd.trigger}?`)) del({ type: 'command', key: cmd.trigger }); }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="mod-item-body">{renderTestoConEmote(cmd.response)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PAROLE CHIAVE (keyword naturali) ── */}
        {tab === 'keywords' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Parole Chiave</h3>
              {!showKwForm && (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => { setEditingKw(null); setShowKwForm(true); }}><Plus size={13} /> Nuova</button>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Il bot risponde quando la parola chiave viene menzionata in chat, <strong>senza bisogno del !</strong>.
              La corrispondenza è case-insensitive e segue il confine di parola: <code className="mod-trigger">sito</code> risponde a
              "visita il sito!" ma <em>non</em> a "visitositoweb". Cooldown e permessi funzionano come i comandi normali.
            </p>
            <AnimatePresence>
              {showKwForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ marginBottom: '1rem' }}>
                  <CommandForm tipo="keyword" initial={editingKw} onSave={async d => { await post({ type: 'command', ...d }); setShowKwForm(false); setEditingKw(null); }} onCancel={() => { setShowKwForm(false); setEditingKw(null); }} saving={saving} {...propEmote} />
                </motion.div>
              )}
            </AnimatePresence>
            {paroleChiave.length === 0 && !showKwForm && (
              <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Nessuna parola chiave. Clicca "Nuova" per aggiungerne una.</p>
            )}
            <div className="mod-list">
              {paroleChiave.map(kw => {
                const perm = getPermInfo(kw.permission);
                const PI = perm.icon;
                return (
                  <div key={kw.trigger} className="mod-item glass-card">
                    <div className="mod-item-header">
                      <span className="mod-trigger" style={{ background: 'rgba(var(--secondary-rgb,100,180,255),0.12)', borderColor: 'rgba(var(--secondary-rgb,100,180,255),0.25)' }}>
                        <Sparkles size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{kw.trigger}
                      </span>
                      <span className="chip mod-chip-permission" style={{ fontSize: '0.68rem', background: `${perm.color}18`, color: perm.color, border: `1px solid ${perm.color}30` }}>
                        <PI size={10} /> {perm.label}
                      </span>
                      {kw.cooldown > 0 && <span className="chip" style={{ fontSize: '0.68rem' }}><Clock size={10} /> {kw.cooldown}s</span>}
                      <div className="mod-item-actions">
                        <CopyBtn text={kw.trigger} />
                        <button className="mod-icon-btn" onClick={() => { setEditingKw(kw); setShowKwForm(true); }}><Edit2 size={13} /></button>
                        <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => { if (confirm(`Eliminare keyword "${kw.trigger}"?`)) del({ type: 'command', key: kw.trigger }); }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="mod-item-body">{renderTestoConEmote(kw.response)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── TIMER ── */}
        {tab === 'timers' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Timer size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Timer Automatici</h3>
              {!showTimerForm && (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => { setEditingTimer(null); setShowTimerForm(true); }}><Plus size={13} /> Nuovo</button>
              )}
            </div>
            <AnimatePresence>
              {showTimerForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ marginBottom: '1rem' }}>
                  <TimerForm initial={editingTimer} onSave={async d => { await post({ type: 'timer', ...d }); setShowTimerForm(false); setEditingTimer(null); }} onCancel={() => { setShowTimerForm(false); setEditingTimer(null); }} saving={saving} {...propEmote} />
                </motion.div>
              )}
            </AnimatePresence>
            {data.timers?.length === 0 && !showTimerForm && (
              <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Nessun timer. Clicca "Nuovo" per aggiungerne uno.</p>
            )}
            <div className="mod-list">
              {(data.timers || []).map(t => (
                <div key={t.name} className="mod-item glass-card">
                  <div className="mod-item-header">
                    <code className="mod-trigger">{t.name}</code>
                    <span className="chip" style={{ fontSize: '0.68rem' }}><Clock size={10} /> {formatInterval(t.interval)}</span>
                    <button className="mod-icon-btn" onClick={() => post({ type: 'timer', ...t, enabled: !t.enabled })}>
                      {t.enabled ? <ToggleRight size={22} color="var(--accent-spotify)" /> : <ToggleLeft size={22} color="var(--text-faint)" />}
                    </button>
                    <div className="mod-item-actions">
                      <CopyBtn text={t.message} />
                      <button className="mod-icon-btn" onClick={() => { setEditingTimer(t); setShowTimerForm(true); }}><Edit2 size={13} /></button>
                      <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => { if (confirm(`Eliminare timer "${t.name}"?`)) del({ type: 'timer', key: t.name }); }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <p className="mod-item-body">{renderTestoConEmote(t.message)}</p>
                  {!t.enabled && <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>Disattivato</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CITAZIONI ── */}
        {tab === 'quotes' && (
          <>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}><Quote size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Citazioni Stream</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Usabili con <code className="mod-trigger">!quote</code> (random) o <code className="mod-trigger">!quote N</code>.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input className="mod-input" value={quoteText} onChange={e => setQuoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aggiungiQuote()}
                placeholder="Testo della citazione…" maxLength={500} style={{ flex: 1 }} />
              <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                onClick={aggiungiQuote} disabled={saving}><Plus size={13} /></button>
            </div>
            {data.quotes?.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Nessuna citazione.</p>}
            <div className="mod-list">
              {(data.quotes || []).map(q => (
                <div key={q.index} className="mod-item glass-card">
                  <div className="mod-item-header">
                    <span className="mod-trigger">#{q.index}</span>
                    {q.addedBy && <span className="chip" style={{ fontSize: '0.68rem' }}>{q.addedBy}</span>}
                    <div className="mod-item-actions">
                      <CopyBtn text={q.text} />
                      <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => { if (confirm(`Eliminare la citazione #${q.index}?`)) del({ type: 'quote', index: q.index }); }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <p className="mod-item-body">"{q.text}"</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CONTATORI ── */}
        {tab === 'counters' && (
          <>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}><Hash size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Contatori</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Il bot risponde a <code className="mod-trigger">!{'<nome>'}</code> con il valore attuale e lo incrementa.
            </p>
            <div className="mod-form-row" style={{ marginBottom: '1rem' }}>
              <input className="mod-input" value={counterName} onChange={e => setCounterName(e.target.value)} placeholder="Nome (es. morti)" maxLength={30} />
              <input className="mod-input" value={counterLabel} onChange={e => setCounterLabel(e.target.value)} placeholder="Label (es. Morti: )" maxLength={30} />
              <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                onClick={aggiungiCounter} disabled={saving}><Plus size={13} /></button>
            </div>
            {data.counters?.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Nessun contatore.</p>}
            <div className="mod-list">
              {(data.counters || []).map(c => (
                <div key={c.name} className="mod-item glass-card">
                  <div className="mod-item-header">
                    <code className="mod-trigger">!{c.name}</code>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{c.value}</span>
                    <div className="mod-item-actions">
                      <button className="mod-icon-btn" title="-1" onClick={() => patchCounter(c.name, -1)} style={{ fontSize: '1rem', fontWeight: 700 }}>−</button>
                      <button className="mod-icon-btn text-tonal-success" title="+1" onClick={() => patchCounter(c.name, 1)} style={{ fontSize: '1rem', fontWeight: 700 }}>+</button>
                      <button className="mod-icon-btn" title="Reset a 0" onClick={() => post({ type: 'counter', name: c.name, label: c.label, value: 0 })}>↺</button>
                      <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => { if (confirm(`Eliminare contatore "${c.name}"?`)) del({ type: 'counter', key: c.name }); }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {c.label && c.label !== c.name && <p className="mod-item-body" style={{ marginTop: '0.2rem', fontSize: '0.8rem' }}>{c.label}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
