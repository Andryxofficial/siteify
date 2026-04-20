/**
 * Schedule.jsx — Programmazione settimanale del canale Twitch.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Trash2, Edit2, Save, X, Loader, Clock, RefreshCw } from 'lucide-react';

const API = '/api/mod-schedule';

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function formatSegmentTime(startTime) {
  if (!startTime) return '—';
  return new Date(startTime).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
}

export default function Schedule({ token }) {
  const [segments, setSegments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [showForm, setShowForm] = useState(false);

  const [startDate,   setStartDate]   = useState('');
  const [startTime_,  setStartTime_]  = useState('20:00');
  const [duration,    setDuration]    = useState(180);
  const [title,       setTitle]       = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const carica = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setSegments(d.segments || []);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);

  const creaSegmento = async () => {
    if (!startDate) { setError('Data e ora obbligatori.'); return; }
    setSaving(true); setError('');
    try {
      // Costruisce la stringa ISO nel formato richiesto da Helix senza
      // ambiguità di timezone del browser: inviamo la stringa letterale
      // con il timezone Europe/Rome gestito lato server.
      const startISO = `${startDate}T${startTime_}:00+01:00`;
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ start_time: startISO, duration, title: title.trim(), is_recurring: isRecurring, timezone: 'Europe/Rome' }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setShowForm(false); setStartDate(''); setTitle('');
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  };

  const cancellaSegmento = async (id) => {
    if (!confirm('Rimuovere questo slot dallo schedule?')) return;
    try {
      const r = await fetch(API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ segment_id: id }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader size={28} className="spin" style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--primary)' }} />
          Schedule Stream
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="mod-icon-btn" onClick={carica}><RefreshCw size={13} /></button>
          <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
            onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Annulla' : 'Nuovo slot'}
          </button>
        </div>
      </div>

      {/* Form nuovo segmento */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="glass-card" style={{ padding: '1.25rem' }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.75rem' }}>Nuovo slot</h4>
            <div className="mod-form-row">
              <label>Data
                <input type="date" className="mod-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label>Ora
                <input type="time" className="mod-input" value={startTime_} onChange={e => setStartTime_(e.target.value)} />
              </label>
              <label><Clock size={12} /> Durata (min)
                <input type="number" className="mod-input mod-input-small" value={duration} onChange={e => setDuration(e.target.value)} min={30} max={1440} />
              </label>
            </div>
            <input className="mod-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo (opzionale)" maxLength={140} style={{ marginBottom: '0.5rem' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '0.75rem' }}>
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
              Ricorrente settimanalmente
            </label>
            <button className="btn-primary" style={{ fontSize: '0.85rem' }} onClick={creaSegmento} disabled={saving}>
              {saving ? <Loader size={13} className="spin" /> : <Save size={13} />} Crea slot
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista segmenti */}
      {segments.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Calendar size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nessuno slot programmato.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {segments.map(s => (
              <motion.div key={s.id} className="mod-item glass-card"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <div className="mod-item-header">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.title || '(nessun titolo)'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span><Calendar size={10} /> {formatSegmentTime(s.start_time)}</span>
                      <span><Clock size={10} /> {s.duration_minutes || '?'}min</span>
                      {s.is_recurring && <span className="chip" style={{ fontSize: '0.65rem' }}>🔁 Ricorrente</span>}
                      {s.canceled_until && <span className="chip" style={{ fontSize: '0.65rem', background: 'rgba(255,107,107,.15)', color: 'var(--accent)' }}>Annullato</span>}
                    </div>
                  </div>
                  <div className="mod-item-actions">
                    <button className="mod-icon-btn mod-icon-btn-danger" onClick={() => cancellaSegmento(s.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
                {s.category?.name && (
                  <p className="mod-item-body" style={{ fontSize: '0.75rem' }}>🎮 {s.category.name}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
