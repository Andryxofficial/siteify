/**
 * QuickActions.jsx — Pulsanti azioni rapide nell'header del Mod Panel.
 *
 * Mostra 6 azioni "magiche":
 *   • Raid       → manda il canale in raid su un altro streamer
 *   • Commercial → fa partire una pubblicità (durata configurabile)
 *   • Marker     → crea uno stream marker per ritrovare un momento
 *   • Annuncio   → invia annuncio rapido in chat con color selector + EmotePicker
 *   • Shield     → toggle Shield Mode ON/OFF con stato pulsante + polling 30s
 *   • Snippet    → dropdown snippets salvati localstorage + copy + manage
 *
 * Ogni azione apre un modale glass con conferma + descrizione.
 */
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Megaphone, Bookmark, X, Loader, Play, Search, Sparkles,
  ShieldCheck, ShieldX, MessageCircle, FileText, Plus, Trash2, Edit2, Check, Copy,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../../hooks/useEmoteTwitch';
import EmotePicker from '../../components/EmotePicker';
import { modPost, modGet } from '../../utils/modApi';

const API = '/api/mod-actions';
const MOD_API = '/api/mod-moderation';

const DURATE_COMMERCIAL = [30, 60, 90, 120, 150, 180];
const ANNOUNCEMENT_COLORS = [
  { value: 'blue', label: 'Blu' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Arancione' },
  { value: 'purple', label: 'Viola' },
  { value: 'primary', label: 'Primario' },
];

const SNIPPETS_KEY = 'andryxify_mod_snippets';

function loadSnippets() {
  try {
    const raw = localStorage.getItem(SNIPPETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSnippets(arr) {
  try {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

function ModaleGlass({ onClose, children, titolo, icona: Icona, accento }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="quick-action-modale-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="quick-action-modale glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ borderTop: `2px solid ${accento}` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <span style={{
            width: 34, height: 34, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${accento}1f`, color: accento,
          }}>
            <Icona size={18} />
          </span>
          <h3 style={{ flex: 1, fontSize: '1rem', fontWeight: 700 }}>{titolo}</h3>
          <button className="mod-icon-btn" onClick={onClose} aria-label="Chiudi"><X size={14} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ─── RAID ─── */
function ModaleRaid({ token, onClose }) {
  const toast = useToast();
  const [login, setLogin] = useState('');
  const [info,  setInfo]  = useState(null);
  const [cercando, setCercando] = useState(false);
  const [inviando, setInviando] = useState(false);

  const cerca = useCallback(async () => {
    if (!login.trim()) return;
    setCercando(true); setInfo(null);
    try {
      const r = await fetch(MOD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'lookup_user', login: login.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!d.user) throw new Error('Canale non trovato');
      setInfo(d.user);
    } catch (e) { toast.error(e.message); }
    finally    { setCercando(false); }
  }, [login, token, toast]);

  const lancia = useCallback(async () => {
    if (!info) return;
    setInviando(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'raid', to_id: info.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Raid in partenza verso ${info.display_name}!`, {
        titolo: '🚀 Raid lanciato',
        durata: 6000,
      });
      onClose();
    } catch (e) { toast.error(e.message, { titolo: 'Raid fallito' }); }
    finally    { setInviando(false); }
  }, [info, token, toast, onClose]);

  return (
    <ModaleGlass titolo="Lancia un Raid" icona={Rocket} accento="var(--primary)" onClose={onClose}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
        Cerca il canale di destinazione e invia tutti i tuoi spettatori in raid.
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
        <input className="mod-input" autoFocus value={login} onChange={e => setLogin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && cerca()}
          placeholder="username Twitch" style={{ flex: 1, marginTop: 0 }} />
        <button className="btn-primary" onClick={cerca} disabled={cercando || !login.trim()}
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem' }}>
          {cercando ? <Loader size={13} className="spin" /> : <Search size={13} />} Cerca
        </button>
      </div>
      {info && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
          {info.profile_image_url && (
            <img src={info.profile_image_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{info.display_name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{info.login}</div>
          </div>
        </motion.div>
      )}
      <button className="btn-primary" disabled={!info || inviando} onClick={lancia}
        style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}>
        {inviando ? <Loader size={14} className="spin" /> : <Rocket size={14} />}
        Avvia raid
      </button>
    </ModaleGlass>
  );
}

/* ─── COMMERCIAL ─── */
function ModaleCommercial({ token, onClose }) {
  const toast = useToast();
  const [durata,   setDurata]   = useState(60);
  const [inviando, setInviando] = useState(false);

  const lancia = async () => {
    setInviando(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'commercial', length: durata }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Pubblicità da ${durata}s in partenza.`, { titolo: '📣 Commercial' });
      onClose();
    } catch (e) { toast.error(e.message, { titolo: 'Commercial fallito' }); }
    finally    { setInviando(false); }
  };

  return (
    <ModaleGlass titolo="Avvia Commercial" icona={Megaphone} accento="var(--accent-warm)" onClose={onClose}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
        Manda in onda una pubblicità Twitch. Solo il broadcaster può lanciarla.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
        {DURATE_COMMERCIAL.map(d => (
          <button key={d}
            onClick={() => setDurata(d)}
            className={`mod-permission-btn${durata === d ? ' mod-permission-btn-active' : ''}`}
            style={{ justifyContent: 'center' }}
          >
            {d}s
          </button>
        ))}
      </div>
      <button className="btn-primary btn-tonal-warn" disabled={inviando} onClick={lancia}
        style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}>
        {inviando ? <Loader size={14} className="spin" /> : <Play size={14} />}
        Avvia pubblicità da {durata}s
      </button>
    </ModaleGlass>
  );
}

/* ─── STREAM MARKER ─── */
function ModaleMarker({ token, onClose }) {
  const toast = useToast();
  const [descr,    setDescr]    = useState('');
  const [inviando, setInviando] = useState(false);

  const crea = async () => {
    setInviando(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'marker', description: descr.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Marker creato sullo stream!', { titolo: '🔖 Salvato' });
      onClose();
    } catch (e) { toast.error(e.message, { titolo: 'Marker fallito' }); }
    finally    { setInviando(false); }
  };

  return (
    <ModaleGlass titolo="Stream Marker" icona={Bookmark} accento="var(--accent-spotify)" onClose={onClose}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
        Marca questo momento dello stream con una nota: lo ritroverai facilmente nel video.
      </p>
      <input className="mod-input" autoFocus value={descr}
        onChange={e => setDescr(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && crea()}
        placeholder="Descrizione opzionale (max 140)" maxLength={140}
        style={{ marginBottom: '1rem', marginTop: 0 }} />
      <button className="btn-primary btn-tonal-success" disabled={inviando} onClick={crea}
        style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}>
        {inviando ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
        Salva marker
      </button>
    </ModaleGlass>
  );
}

/* ─── ANNUNCIO RAPIDO ─── */
function ModaleAnnuncio({ token, onClose, emoteCanale, emoteGlobali, seventvCanale, seventvGlobali }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('blue');
  const [inviando, setInviando] = useState(false);

  const invia = async () => {
    if (!message.trim()) return;
    setInviando(true);
    try {
      const r = await modPost(MOD_API, token, {
        action: 'announcement',
        message: message.trim(),
        color,
      });
      if (!r.ok) throw new Error(r.error);
      toast.success('Annuncio inviato!', { titolo: '📣 Annuncio' });
      onClose();
    } catch (e) { toast.error(e.message, { titolo: 'Annuncio fallito' }); }
    finally    { setInviando(false); }
  };

  return (
    <ModaleGlass titolo="Annuncio Rapido" icona={MessageCircle} accento="var(--accent-twitch)" onClose={onClose}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
        Invia un annuncio colorato in chat. Usa le emote per renderlo più accattivante!
      </p>
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <label style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>Messaggio</label>
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            seventvCanale={seventvCanale}
            seventvGlobali={seventvGlobali}
            onSelect={(nome) => setMessage(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ')}
          />
        </div>
        <textarea
          className="mod-input mod-textarea"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Scrivi qui l'annuncio..."
          maxLength={500}
          rows={3}
          autoFocus
          style={{ marginTop: 0 }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.5rem' }}>Colore</label>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {ANNOUNCEMENT_COLORS.map(c => (
            <button key={c.value}
              onClick={() => setColor(c.value)}
              className={`mod-permission-btn${color === c.value ? ' mod-permission-btn-active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary" disabled={inviando || !message.trim()} onClick={invia}
        style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}>
        {inviando ? <Loader size={14} className="spin" /> : <MessageCircle size={14} />}
        Invia annuncio
      </button>
    </ModaleGlass>
  );
}

/* ─── COMPONENT ROOT ─── */
export default function QuickActions({ token, isLive }) {
  const toast = useToast();
  const { twitchToken } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali } = useEmoteTwitch(twitchToken);

  const [aperta, setAperta] = useState(null); // 'raid' | 'commercial' | 'marker' | 'annuncio' | 'snippet' | null
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldLoading, setShieldLoading] = useState(false);

  // Snippet management
  const [snippets, setSnippets] = useState(loadSnippets);
  const [snippetEditing, setSnippetEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editText, setEditText] = useState('');

  // Polling shield mode ogni 30s
  useEffect(() => {
    (async () => {
      const r = await modGet(MOD_API + '?action=shield_mode', token);
      if (r.ok) setShieldActive(r.data?.status?.is_active || false);
    })();
    const interval = setInterval(async () => {
      const r = await modGet(MOD_API + '?action=shield_mode', token);
      if (r.ok) setShieldActive(r.data?.status?.is_active || false);
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const toggleShield = useCallback(async () => {
    const nuovoStato = !shieldActive;
    setShieldLoading(true);
    const r = await modPost(MOD_API, token, {
      action: 'shield_mode',
      active: nuovoStato,
    });
    if (r.ok) {
      setShieldActive(nuovoStato);
      toast.success(nuovoStato ? 'Shield Mode attivato!' : 'Shield Mode disattivato.', {
        titolo: '🛡️ Shield Mode',
      });
    } else {
      toast.error(r.error, { titolo: 'Shield Mode' });
    }
    setShieldLoading(false);
  }, [token, toast, shieldActive]);

  const addSnippet = useCallback(() => {
    if (!editLabel.trim() || !editText.trim()) return;
    const newSnippet = { id: Date.now(), label: editLabel.trim(), text: editText.trim() };
    const updated = editId ? snippets.map(s => s.id === editId ? { ...s, label: editLabel.trim(), text: editText.trim() } : s) : [...snippets, newSnippet];
    setSnippets(updated);
    saveSnippets(updated);
    setEditId(null);
    setEditLabel('');
    setEditText('');
    setSnippetEditing(false);
  }, [editLabel, editText, editId, snippets]);

  const deleteSnippet = useCallback((id) => {
    const updated = snippets.filter(s => s.id !== id);
    setSnippets(updated);
    saveSnippets(updated);
  }, [snippets]);

  const openSnippetForEdit = useCallback((s) => {
    setEditId(s.id);
    setEditLabel(s.label);
    setEditText(s.text);
    setSnippetEditing(true);
  }, []);

  const azioni = [
    { id: 'raid',       label: 'Raid',       icon: Rocket,         color: 'var(--primary)',       desc: 'Manda gli spettatori in raid' },
    { id: 'commercial', label: 'Pubblicità', icon: Megaphone,      color: 'var(--accent-warm)',   desc: 'Lancia una pubblicità' },
    { id: 'marker',     label: 'Marker',     icon: Bookmark,       color: 'var(--accent-spotify)', desc: 'Salva questo momento' },
    { id: 'annuncio',   label: 'Annuncio',   icon: MessageCircle,  color: 'var(--accent-twitch)', desc: 'Invia annuncio colorato' },
    {
      id: 'shield',
      label: shieldActive ? 'Shield ON' : 'Shield OFF',
      icon: shieldActive ? ShieldCheck : ShieldX,
      color: shieldActive ? 'var(--accent)' : 'var(--text-muted)',
      desc: 'Toggle Shield Mode',
      onClick: toggleShield,
      loading: shieldLoading,
      pulse: shieldActive,
    },
    { id: 'snippet',    label: 'Snippet',    icon: FileText,       color: 'var(--secondary)',     desc: 'Snippet salvati' },
  ];

  return (
    <>
      <div className="quick-actions">
        {azioni.map(a => {
          const Icon = a.icon;
          const disabled = (!isLive && a.id !== 'raid' && a.id !== 'snippet') || a.loading;
          return (
            <button key={a.id}
              className={`quick-action-btn${a.pulse ? ' quick-action-btn-pulse' : ''}`}
              onClick={a.onClick || (() => setAperta(a.id))}
              title={a.desc + (isLive || a.id === 'raid' || a.id === 'snippet' ? '' : ' (canale offline)')}
              disabled={disabled}
              style={{ '--accent-azione': a.color }}
            >
              {a.loading ? <Loader size={14} className="spin" /> : <Icon size={14} />}
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {aperta === 'raid'       && <ModaleRaid       token={token} onClose={() => setAperta(null)} />}
        {aperta === 'commercial' && <ModaleCommercial token={token} onClose={() => setAperta(null)} />}
        {aperta === 'marker'     && <ModaleMarker     token={token} onClose={() => setAperta(null)} />}
        {aperta === 'annuncio'   && <ModaleAnnuncio   token={token} onClose={() => setAperta(null)}
          emoteCanale={emoteCanale} emoteGlobali={emoteGlobali} seventvCanale={seventvCanale} seventvGlobali={seventvGlobali} />}
        {aperta === 'snippet' && (
          <ModaleGlass titolo="Snippet Rapidi" icona={FileText} accento="var(--secondary)" onClose={() => { setAperta(null); setSnippetEditing(false); }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Salva frasi ricorrenti per usarle rapidamente negli annunci.
            </p>
            {snippetEditing ? (
              <div>
                <input
                  className="mod-input"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  placeholder="Etichetta (es. Benvenuto)"
                  maxLength={30}
                  style={{ marginTop: 0, marginBottom: '0.5rem' }}
                />
                <textarea
                  className="mod-input mod-textarea"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder="Testo dello snippet..."
                  maxLength={500}
                  rows={3}
                  style={{ marginTop: 0, marginBottom: '0.75rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    onClick={addSnippet}
                    disabled={!editLabel.trim() || !editText.trim()}
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem' }}
                  >
                    <Check size={13} /> Salva
                  </button>
                  <button
                    className="btn-primary btn-tonal-danger"
                    onClick={() => { setSnippetEditing(false); setEditId(null); setEditLabel(''); setEditText(''); }}
                    style={{ fontSize: '0.82rem', padding: '0.45rem' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {snippets.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                    Nessuno snippet salvato.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem', maxHeight: 300, overflowY: 'auto' }}>
                    {snippets.map(s => (
                      <div key={s.id} className="glass-card" style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.text}
                          </div>
                        </div>
                        <button className="mod-icon-btn" onClick={() => { navigator.clipboard.writeText(s.text); toast.success('Snippet copiato!'); }} title="Copia">
                          <Copy size={12} />
                        </button>
                        <button className="mod-icon-btn" onClick={() => openSnippetForEdit(s)} title="Modifica">
                          <Edit2 size={12} />
                        </button>
                        <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => deleteSnippet(s.id)} title="Elimina">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn-primary"
                  onClick={() => { setSnippetEditing(true); setEditId(null); setEditLabel(''); setEditText(''); }}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.5rem' }}
                >
                  <Plus size={13} /> Aggiungi snippet
                </button>
              </>
            )}
          </ModaleGlass>
        )}
      </AnimatePresence>
    </>
  );
}
