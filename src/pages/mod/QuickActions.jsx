/**
 * QuickActions.jsx — Pulsanti azioni rapide nell'header del Mod Panel.
 *
 * Mostra tre azioni "magiche":
 *   • Raid       → manda il canale in raid su un altro streamer
 *   • Commercial → fa partire una pubblicità (durata configurabile)
 *   • Marker     → crea uno stream marker per ritrovare un momento
 *
 * Ogni azione apre un modale glass con conferma + descrizione.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Megaphone, Bookmark, X, Loader, Play, Search, Sparkles,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API = '/api/mod-actions';
const MOD_API = '/api/mod-moderation';

const DURATE_COMMERCIAL = [30, 60, 90, 120, 150, 180];

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

/* ─── COMPONENT ROOT ─── */
export default function QuickActions({ token, isLive }) {
  const [aperta, setAperta] = useState(null); // 'raid' | 'commercial' | 'marker' | null

  const azioni = [
    { id: 'raid',       label: 'Raid',       icon: Rocket,     color: 'var(--primary)',       desc: 'Manda gli spettatori in raid' },
    { id: 'commercial', label: 'Pubblicità', icon: Megaphone,  color: 'var(--accent-warm)',   desc: 'Lancia una pubblicità' },
    { id: 'marker',     label: 'Marker',     icon: Bookmark,   color: 'var(--accent-spotify)', desc: 'Salva questo momento' },
  ];

  return (
    <>
      <div className="quick-actions">
        {azioni.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.id}
              className="quick-action-btn"
              onClick={() => setAperta(a.id)}
              title={a.desc + (isLive ? '' : ' (canale offline)')}
              disabled={!isLive && a.id !== 'raid'}
              style={{ '--accent-azione': a.color }}
            >
              <Icon size={14} />
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {aperta === 'raid'       && <ModaleRaid       token={token} onClose={() => setAperta(null)} />}
        {aperta === 'commercial' && <ModaleCommercial token={token} onClose={() => setAperta(null)} />}
        {aperta === 'marker'     && <ModaleMarker     token={token} onClose={() => setAperta(null)} />}
      </AnimatePresence>
    </>
  );
}
