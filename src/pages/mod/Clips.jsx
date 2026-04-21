/**
 * Clips.jsx — Clip recenti del canale Twitch.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Film, Eye, Clock, ExternalLink, Copy, Check, Loader, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API = '/api/mod-clips';

const PERIODI = [
  { id: '7',   label: '7 giorni' },
  { id: '30',  label: '30 giorni' },
  { id: 'all', label: 'Sempre' },
];

function formatDurata(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatViews(n) {
  if (!n) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function CopyBtn({ url }) {
  const [copiato, setCopiato] = useState(false);
  const toast = useToast();
  return (
    <button className="mod-icon-btn" onClick={async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiato(true);
        toast.success('Link copiato!');
        setTimeout(() => setCopiato(false), 1500);
      } catch { toast.error('Impossibile copiare il link.'); }
    }} title="Copia URL">
      {copiato ? <Check size={13} color="var(--accent-spotify)" /> : <Copy size={13} />}
    </button>
  );
}

export default function Clips({ token }) {
  const toast = useToast();
  const [periodo, setPeriodo] = useState('7');
  const [clips,   setClips]   = useState([]);
  const [loading, setLoading] = useState(true);

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?period=${periodo}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setClips(d.clips || []);
    } catch (e) { toast.error(e.message, { titolo: 'Caricamento clip' }); }
    finally    { setLoading(false); }
  }, [token, periodo, toast]);

  useEffect(() => { carica(); }, [carica]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filtri periodo */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {PERIODI.map(p => (
          <button key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={`mod-tab${periodo === p.id ? ' mod-tab-active' : ''}`}>
            <Calendar size={12} /> {p.label}
          </button>
        ))}
        <button className="mod-icon-btn" onClick={carica} title="Aggiorna" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={26} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : clips.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Film size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nessuna clip in questo periodo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {clips.map((c, i) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.4), type: 'spring', stiffness: 260, damping: 24 }}
              className="glass-card"
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Thumbnail */}
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                style={{ position: 'relative', display: 'block', aspectRatio: '16/9', overflow: 'hidden' }}>
                {c.thumbnail && (
                  <img src={c.thumbnail} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {/* Badge durata + views */}
                <div style={{
                  position: 'absolute', left: 8, bottom: 8,
                  background: 'rgba(0,0,0,0.65)', color: '#fff',
                  fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Clock size={10} /> {formatDurata(c.duration)}
                </div>
                <div style={{
                  position: 'absolute', right: 8, bottom: 8,
                  background: 'rgba(0,0,0,0.65)', color: '#fff',
                  fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Eye size={10} /> {formatViews(c.view_count)}
                </div>
              </a>
              {/* Info */}
              <div style={{ padding: '0.65rem 0.8rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, marginBottom: '0.35rem',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.title || '(senza titolo)'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                  Clip di <strong style={{ color: 'var(--text-muted)' }}>{c.creator_name}</strong> · {new Date(c.created_at).toLocaleDateString('it-IT')}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: 'auto' }}>
                  <CopyBtn url={c.url} />
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="mod-icon-btn" title="Apri su Twitch">
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
