/**
 * Overlays.jsx — Gestione overlay OBS (goals, eventi recenti, alerts).
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Copy, Check, RefreshCw, Plus, Trash2, Loader, ExternalLink, Target } from 'lucide-react';

const API = '/api/mod-overlays';

const OVERLAY_LABELS = {
  goals:  { label: 'Obiettivi',      desc: 'Barre di avanzamento per follower/sub/goals' },
  events: { label: 'Feed eventi',    desc: 'Ultimi follower e subscriber in sovraimpressione' },
  alerts: { label: 'Alert animati',  desc: 'Notifiche animate per nuovi follower/sub' },
};

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="mod-icon-btn" onClick={async () => { await navigator.clipboard.writeText(text).catch(()=>{}); setOk(true); setTimeout(()=>setOk(false),1500); }}>
      {ok ? <Check size={13} color="var(--accent-spotify)" /> : <Copy size={13} />}
    </button>
  );
}

export default function Overlays({ token }) {
  const [overlays, setOverlays] = useState([]);
  const [goals,    setGoals]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const carica = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}?action=list`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setOverlays(d.overlays || []);
      setGoals(d.goals || []);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);

  const rigenera = useCallback(async (type) => {
    if (!confirm(`Rigenerare il link per "${OVERLAY_LABELS[type]?.label}"? Il vecchio URL non funzionerà più.`)) return;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'regenerate', type }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
  }, [token, carica]);

  const salvaGoals = useCallback(async () => {
    setSaving(true); setError('');
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'save_goals', goals }) });
      if (!r.ok) throw new Error((await r.json()).error);
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  }, [token, goals]);

  const aggiungiGoal = () => setGoals(prev => [...prev, { label: '', current: 0, target: 100, color: '#E040FB' }]);
  const aggiornaGoal = (i, k, v) => setGoals(prev => prev.map((g, j) => j === i ? { ...g, [k]: v } : g));
  const rimuoviGoal  = (i) => setGoals(prev => prev.filter((_, j) => j !== i));

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader size={28} className="spin" style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      {/* Istruzioni */}
      <div className="glass-card" style={{ padding: '1rem', borderColor: 'rgba(0,229,255,0.2)' }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <Monitor size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--secondary)' }} />
          Copia un URL e aggiungilo in OBS come <strong>Browser Source</strong> (sfondo trasparente, 1920×1080).
          Ogni overlay si aggiorna automaticamente in polling.
        </p>
      </div>

      {/* URL overlay */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
          <Monitor size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--secondary)' }} />
          URL Browser Source
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {overlays.map(ov => {
            const info = OVERLAY_LABELS[ov.type] || { label: ov.type, desc: '' };
            return (
              <motion.div key={ov.type} className="glass-card" style={{ padding: '0.9rem 1rem' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{info.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{info.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <CopyBtn text={ov.url} />
                    <a href={ov.url} target="_blank" rel="noopener noreferrer" className="mod-icon-btn" title="Anteprima">
                      <ExternalLink size={13} />
                    </a>
                    <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => rigenera(ov.type)} title="Rigenera URL">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', padding: '0.4rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {ov.url}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Gestione obiettivi */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            <Target size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-warm)' }} />
            Obiettivi (Goals)
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={aggiungiGoal} disabled={goals.length >= 6}><Plus size={13} /></button>
            <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }} onClick={salvaGoals} disabled={saving}>
              {saving ? <Loader size={13} className="spin" /> : <Check size={13} />} Salva
            </button>
          </div>
        </div>
        {goals.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Nessun obiettivo. Clicca + per aggiungerne uno.</p>
        )}
        {goals.map((g, i) => (
          <div key={i} className="glass-card" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="mod-input" value={g.label} onChange={e => aggiornaGoal(i, 'label', e.target.value)} placeholder="Nome obiettivo" maxLength={40} style={{ flex: 2, minWidth: 100 }} />
              <input type="number" className="mod-input mod-input-small" value={g.current} onChange={e => aggiornaGoal(i, 'current', parseInt(e.target.value) || 0)} placeholder="Attuale" min={0} />
              <input type="number" className="mod-input mod-input-small" value={g.target} onChange={e => aggiornaGoal(i, 'target', parseInt(e.target.value) || 1)} placeholder="Target" min={1} />
              <input type="color" value={g.color} onChange={e => aggiornaGoal(i, 'color', e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }} />
              <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => rimuoviGoal(i)}><Trash2 size={13} /></button>
            </div>
            {/* Preview barra */}
            <div style={{ marginTop: '0.5rem', height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100))}%`, background: g.color, borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.15rem' }}>
              {g.current} / {g.target} ({Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100))}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
