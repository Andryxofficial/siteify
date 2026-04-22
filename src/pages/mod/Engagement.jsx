/**
 * Engagement.jsx — Sondaggi e predizioni Twitch.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, Trophy, Plus, X, Check, Loader, RefreshCw, Clock, Play, Square, AlertTriangle } from 'lucide-react';

const API = '/api/mod-polls';

function PollCard({ poll, onClose }) {
  const total = poll.choices?.reduce((s, c) => s + (c.votes || 0), 0) || 1;
  const isActive = poll.status === 'ACTIVE';
  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
        <div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{poll.title}</h4>
          <span className={`chip ${isActive ? 'chip-success' : 'chip-neutral'}`} style={{ fontSize: '0.65rem', marginTop: '0.2rem' }}>
            {poll.status}
          </span>
        </div>
        {isActive && onClose && (
          <button className="mod-icon-btn" onClick={() => onClose(poll.id)} title="Termina sondaggio">
            <Square size={13} color="var(--accent)" />
          </button>
        )}
      </div>
      {poll.choices?.map(c => {
        const pct = Math.round(((c.votes || 0) / total) * 100);
        return (
          <div key={c.id} style={{ marginBottom: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.15rem' }}>
              <span>{c.title}</span><span style={{ color: 'var(--text-muted)' }}>{c.votes ?? 0} ({pct}%)</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width .4s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PredictionCard({ pred, onResolve, onCancel }) {
  const isActive = pred.status === 'ACTIVE' || pred.status === 'LOCKED';
  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
        <div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{pred.title}</h4>
          <span className={`chip ${isActive ? 'chip-info' : 'chip-neutral'}`} style={{ fontSize: '0.65rem' }}>
            {pred.status}
          </span>
        </div>
        {isActive && (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {onCancel && <button className="mod-icon-btn" onClick={() => onCancel(pred.id)} title="Annulla"><X size={13} /></button>}
          </div>
        )}
      </div>
      {pred.outcomes?.map(o => (
        <div key={o.id} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span>{o.title}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>{o.channel_points || 0} pts · {o.users || 0} utenti</span>
              {isActive && onResolve && (
                <button className="mod-icon-btn text-tonal-success" onClick={() => onResolve(pred.id, o.id)} title="Vinci con questo outcome" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                  <Check size={12} /> Vinci
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Engagement({ token }) {
  const [tab,    setTab]    = useState('polls');
  const [polls,  setPolls]  = useState([]);
  const [preds,  setPreds]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form sondaggio
  const [pollTitle,    setPollTitle]    = useState('');
  const [pollChoices,  setPollChoices]  = useState(['', '']);
  const [pollDuration, setPollDuration] = useState(300);

  // Form predizione
  const [predTitle,    setPredTitle]    = useState('');
  const [predOutcomes, setPredOutcomes] = useState(['', '']);
  const [predWindow,   setPredWindow]   = useState(300);

  const carica = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rp, rd] = await Promise.all([
        fetch(`${API}?type=poll`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}?type=prediction`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dp = await rp.json();
      const dd = await rd.json();
      setPolls(dp.polls || []);
      setPreds(dd.predictions || []);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);

  const closePoll = useCallback(async (id) => {
    setSaving(true);
    try {
      const r = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'poll', poll_id: id, status: 'TERMINATED' }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  }, [token, carica]);

  const resolvePred = useCallback(async (id, outcomeId) => {
    setSaving(true);
    try {
      const r = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'prediction', prediction_id: id, status: 'RESOLVED', winning_outcome_id: outcomeId }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  }, [token, carica]);

  const cancelPred = useCallback(async (id) => {
    setSaving(true);
    try {
      const r = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'prediction', prediction_id: id, status: 'CANCELED' }) });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  }, [token, carica]);

  const creaPoll = async () => {
    const choices = pollChoices.filter(c => c.trim());
    if (!pollTitle.trim() || choices.length < 2) { setError('Titolo e almeno 2 scelte obbligatori.'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'poll', title: pollTitle.trim(), choices, duration: pollDuration }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setShowForm(false); setPollTitle(''); setPollChoices(['', '']); setPollDuration(300);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  };

  const creaPred = async () => {
    const outcomes = predOutcomes.filter(o => o.trim());
    if (!predTitle.trim() || outcomes.length < 2) { setError('Titolo e almeno 2 outcome obbligatori.'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'prediction', title: predTitle.trim(), outcomes, prediction_window: predWindow }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setShowForm(false); setPredTitle(''); setPredOutcomes(['', '']); setPredWindow(300);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', borderColor: 'rgba(255,107,107,0.3)' }}>
          <AlertTriangle size={14} color="var(--accent)" />
          <span style={{ flex: 1, color: 'var(--accent)', fontSize: '0.85rem' }}>{error}</span>
          <button className="mod-icon-btn" onClick={() => setError('')}><X size={13} /></button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button className={`mod-tab${tab === 'polls' ? ' mod-tab-active' : ''}`} onClick={() => { setTab('polls'); setShowForm(false); }}>
          <BarChart2 size={14} /> Sondaggi
        </button>
        <button className={`mod-tab${tab === 'predictions' ? ' mod-tab-active' : ''}`} onClick={() => { setTab('predictions'); setShowForm(false); }}>
          <Trophy size={14} /> Predizioni
        </button>
        <button className="mod-icon-btn" onClick={carica} style={{ marginLeft: 'auto' }}><RefreshCw size={13} /></button>
        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Annulla' : 'Nuovo'}
        </button>
      </div>

      {/* Form creazione sondaggio */}
      <AnimatePresence>
        {showForm && tab === 'polls' && (
          <motion.div className="glass-card" style={{ padding: '1.25rem' }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Nuovo sondaggio</h3>
            <input className="mod-input" value={pollTitle} onChange={e => setPollTitle(e.target.value)} placeholder="Domanda del sondaggio" maxLength={60} style={{ marginBottom: '0.5rem' }} />
            {pollChoices.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <input className="mod-input" value={c} onChange={e => { const nc = [...pollChoices]; nc[i] = e.target.value; setPollChoices(nc); }} placeholder={`Scelta ${i + 1}`} maxLength={25} style={{ flex: 1 }} />
                {pollChoices.length > 2 && <button className="mod-icon-btn" onClick={() => setPollChoices(pollChoices.filter((_, j) => j !== i))}><X size={12} /></button>}
              </div>
            ))}
            {pollChoices.length < 5 && (
              <button className="btn-ghost" style={{ fontSize: '0.78rem', marginBottom: '0.75rem' }} onClick={() => setPollChoices([...pollChoices, ''])}><Plus size={12} /> Aggiungi scelta</button>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Clock size={13} /> Durata (s)
                <input type="number" className="mod-input mod-input-small" value={pollDuration} onChange={e => setPollDuration(e.target.value)} min={15} max={1800} />
              </label>
            </div>
            <button className="btn-primary" style={{ fontSize: '0.85rem' }} onClick={creaPoll} disabled={saving}>
              {saving ? <Loader size={13} className="spin" /> : <Play size={13} />} Avvia sondaggio
            </button>
          </motion.div>
        )}
        {showForm && tab === 'predictions' && (
          <motion.div className="glass-card" style={{ padding: '1.25rem' }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Nuova predizione</h3>
            <input className="mod-input" value={predTitle} onChange={e => setPredTitle(e.target.value)} placeholder="Domanda della predizione" maxLength={45} style={{ marginBottom: '0.5rem' }} />
            {predOutcomes.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <input className="mod-input" value={o} onChange={e => { const no = [...predOutcomes]; no[i] = e.target.value; setPredOutcomes(no); }} placeholder={`Outcome ${i + 1}`} maxLength={25} style={{ flex: 1 }} />
                {predOutcomes.length > 2 && <button className="mod-icon-btn" onClick={() => setPredOutcomes(predOutcomes.filter((_, j) => j !== i))}><X size={12} /></button>}
              </div>
            ))}
            {predOutcomes.length < 10 && (
              <button className="btn-ghost" style={{ fontSize: '0.78rem', marginBottom: '0.75rem' }} onClick={() => setPredOutcomes([...predOutcomes, ''])}><Plus size={12} /> Aggiungi outcome</button>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Clock size={13} /> Finestra predizione (s)
                <input type="number" className="mod-input mod-input-small" value={predWindow} onChange={e => setPredWindow(e.target.value)} min={30} max={1800} />
              </label>
            </div>
            <button className="btn-primary" style={{ fontSize: '0.85rem' }} onClick={creaPred} disabled={saving}>
              {saving ? <Loader size={13} className="spin" /> : <Trophy size={13} />} Avvia predizione
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Loader size={24} className="spin" style={{ color: 'var(--primary)' }} /></div>}

      {/* Lista sondaggi */}
      {tab === 'polls' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {polls.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Nessun sondaggio recente.</p>}
          {polls.map(p => <PollCard key={p.id} poll={p} onClose={closePoll} />)}
        </div>
      )}

      {/* Lista predizioni */}
      {tab === 'predictions' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {preds.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Nessuna predizione recente.</p>}
          {preds.map(p => <PredictionCard key={p.id} pred={p} onResolve={resolvePred} onCancel={cancelPred} />)}
        </div>
      )}
    </div>
  );
}
