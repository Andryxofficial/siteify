/**
 * Rewards.jsx — Channel Points custom rewards.
 *
 * Lista, crea, abilita/disabilita, mette in pausa, elimina.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Plus, Pause, Play, Power, Trash2, Loader, RefreshCw, X, Check,
  Coins, Sparkles,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../../hooks/useEmoteTwitch';
import EmotePicker from '../../components/EmotePicker';

const API = '/api/mod-rewards';

export default function Rewards({ token }) {
  const toast = useToast();
  const { twitchToken } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);
  const [rewards,    setRewards]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [creando,    setCreando]    = useState(false);
  const [aggiornoId, setAggiornoId] = useState('');
  const [titolo, setTitolo] = useState('');
  const [costo,  setCosto]  = useState(500);
  const [prompt, setPrompt] = useState('');
  const [colore, setColore] = useState('#9146FF');

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setRewards(d.rewards || []);
    } catch (e) { toast.error(e.message, { titolo: 'Caricamento Premi' }); }
    finally    { setLoading(false); }
  }, [token, toast]);

  useEffect(() => { carica(); }, [carica]);

  const crea = async () => {
    if (!titolo.trim()) return;
    setCreando(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: titolo.trim(), cost: Number(costo), prompt: prompt.trim() || undefined, background_color: colore }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Premio creato!', { titolo: '✨ Nuovo premio' });
      setTitolo(''); setCosto(500); setPrompt(''); setShowForm(false);
      await carica();
    } catch (e) { toast.error(e.message, { titolo: 'Creazione fallita' }); }
    finally    { setCreando(false); }
  };

  const aggiorna = async (id, patch, etichetta) => {
    setAggiornoId(id);
    try {
      const r = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...patch }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(etichetta || 'Aggiornato');
      await carica();
    } catch (e) { toast.error(e.message, { titolo: 'Aggiornamento fallito' }); }
    finally    { setAggiornoId(''); }
  };

  const elimina = async (r) => {
    if (!confirm(`Eliminare il premio "${r.title}"?`)) return;
    setAggiornoId(r.id);
    try {
      const res = await fetch(API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: r.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`"${r.title}" eliminato.`);
      await carica();
    } catch (e) { toast.error(e.message, { titolo: 'Eliminazione fallita' }); }
    finally    { setAggiornoId(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1 }}>
          <Award size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-twitch)' }} />
          Premi a Punti Canale
        </h3>
        <button className="mod-icon-btn" onClick={carica} title="Aggiorna"><RefreshCw size={13} /></button>
        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? 'Annulla' : 'Nuovo'}
        </button>
      </div>

      {/* Form crea */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="glass-card" style={{ padding: '1.25rem' }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--accent-warm)' }} />
              Nuovo premio
            </h4>
            <div className="mod-form-row">
              <label style={{ flex: 2 }}>Titolo
                <input className="mod-input" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="es. Skip canzone" maxLength={45} />
              </label>
              <label>
                <Coins size={12} /> Costo
                <input type="number" className="mod-input mod-input-small" value={costo} onChange={e => setCosto(e.target.value)} min={1} />
              </label>
              <label>Colore
                <input type="color" value={colore} onChange={e => setColore(e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6, marginTop: '0.2rem' }} />
              </label>
            </div>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <textarea className="mod-input mod-textarea" value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Descrizione (opzionale, max 200 caratteri)" maxLength={200} />
              <div style={{ position: 'absolute', right: '0.4rem', bottom: '0.4rem' }}>
                <EmotePicker
                  emoteCanale={emoteCanale}
                  emoteGlobali={emoteGlobali}
                  seventvCanale={seventvCanale}
                  seventvGlobali={seventvGlobali}
                  onSelect={(nome) => setPrompt(prev => (prev ? `${prev} ${nome}` : nome).slice(0, 200))}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={crea} disabled={creando || !titolo.trim()}
              style={{ fontSize: '0.85rem' }}>
              {creando ? <Loader size={13} className="spin" /> : <Check size={13} />} Crea premio
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={26} className="spin" style={{ color: 'var(--accent-twitch)' }} />
        </div>
      ) : rewards.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Award size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nessun premio personalizzato.</p>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
            I premi creati da altre app non sono modificabili da qui (limite Twitch).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {rewards.map((r, i) => {
            const dimmed = !r.is_enabled;
            const inLavoro = aggiornoId === r.id;
            return (
              <motion.div key={r.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="glass-card"
                style={{
                  padding: '0.85rem 0.95rem',
                  opacity: dimmed ? 0.55 : 1,
                  borderTop: `3px solid ${r.background_color || '#9146FF'}`,
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem',
                      display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Coins size={11} style={{ color: 'var(--accent-warm)' }} /> {r.cost?.toLocaleString('it-IT')} pt
                      {r.is_paused && <span className="chip" style={{ fontSize: '0.62rem' }}>⏸ Pausa</span>}
                      {!r.is_enabled && <span className="chip chip-danger" style={{ fontSize: '0.62rem' }}>OFF</span>}
                    </div>
                  </div>
                </div>
                {r.prompt && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', lineHeight: 1.35,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {renderTestoConEmote(r.prompt)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: 'auto' }}>
                  <button className="mod-icon-btn" disabled={inLavoro}
                    onClick={() => aggiorna(r.id, { is_enabled: !r.is_enabled }, r.is_enabled ? 'Disabilitato' : 'Abilitato')}
                    title={r.is_enabled ? 'Disabilita' : 'Abilita'}>
                    {inLavoro ? <Loader size={13} className="spin" /> : <Power size={13} color={r.is_enabled ? 'var(--accent-spotify)' : 'var(--text-faint)'} />}
                  </button>
                  <button className="mod-icon-btn" disabled={inLavoro || !r.is_enabled}
                    onClick={() => aggiorna(r.id, { is_paused: !r.is_paused }, r.is_paused ? 'Ripreso' : 'Messo in pausa')}
                    title={r.is_paused ? 'Riprendi' : 'Metti in pausa'}>
                    {r.is_paused ? <Play size={13} /> : <Pause size={13} />}
                  </button>
                  <button className="mod-icon-btn mod-icon-btn-danger" disabled={inLavoro}
                    onClick={() => elimina(r)} title="Elimina premio" style={{ marginLeft: 'auto' }}>
                    <Trash2 size={13} />
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
