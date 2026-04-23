/**
 * Overview.jsx — Stato live del canale e azioni rapide.
 * Mostra: live/offline, viewer, titolo, gioco, thumbnail, quick-edit.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Tv2, Users, Edit2, Check, X, Search, Loader, RefreshCw, Radio } from 'lucide-react';

const entrata = (d = 0) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, type: 'spring', stiffness: 220, damping: 24 } });

function formatDuration(startedAt) {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Overview({ token, clientId }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [editing, setEditing]   = useState(false);
  const [title, setTitle]       = useState('');
  const [gameId, setGameId]     = useState('');
  const [gameName, setGameName] = useState('');
  const [gameSearch, setGameSearch] = useState('');
  const [gameResults, setGameResults] = useState([]);
  const [searching, setSearching]    = useState(false);
  const [saving, setSaving]     = useState(false);
  // ref per calcolare la posizione del dropdown con position:fixed
  const searchWrapRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const carica = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/mod-channel', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setData(d);
      setTitle(d.title || '');
      setGameId(d.gameId || '');
      setGameName(d.gameName || '');
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);
  useEffect(() => {
    const t = setInterval(carica, 30_000);
    return () => clearInterval(t);
  }, [carica]);

  const cercaGioco = useCallback(async (q) => {
    setGameSearch(q);
    if (q.length < 2) { setGameResults([]); return; }
    setSearching(true);
    // Aggiorna posizione dropdown in base al wrapper di ricerca
    if (searchWrapRef.current) {
      const rect = searchWrapRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    try {
      const r = await fetch(`/api/mod-channel?action=search_categories&q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setGameResults(d.categories || []);
    } catch { setGameResults([]); }
    finally { setSearching(false); }
  }, [token]);

  const salva = async () => {
    setSaving(true);
    try {
      const body = {};
      if (title !== data?.title) body.title = title;
      if (gameId && gameId !== data?.gameId) body.game_id = gameId;
      if (!Object.keys(body).length) { setEditing(false); return; }
      const r = await fetch('/api/mod-channel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore salvataggio');
      setEditing(false);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSaving(false); }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
    </div>
  );

  if (error) return (
    <div className="glass-card" style={{ padding: '1rem', color: 'var(--accent)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      ⚠️ {error}
      <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.8rem' }} onClick={carica}>Riprova</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Status card — zIndex elevato quando in editing per non essere coperto dai fratelli */}
      <motion.div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', zIndex: editing ? 200 : 'auto' }} {...entrata(0)}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Thumbnail — responsiva: 120px su mobile, 180px su schermi più ampi */}
          {data?.thumbnailUrl ? (
            <img src={data.thumbnailUrl} alt="Anteprima stream"
              style={{ width: 'clamp(100px, 30vw, 180px)', aspectRatio: '16/9', borderRadius: 'var(--r-md)', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 'clamp(100px, 30vw, 180px)', aspectRatio: '16/9', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Tv2 size={32} style={{ color: 'var(--text-faint)' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Live badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              {data?.live ? (
                <>
                  <span className="chip chip-live" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                    <Radio size={10} /> LIVE
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDuration(data.startedAt)}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Users size={12} /> {data.viewerCount.toLocaleString('it-IT')}
                  </span>
                </>
              ) : (
                <span className="chip" style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Offline</span>
              )}
              <button className="mod-icon-btn" onClick={carica} title="Aggiorna" style={{ marginLeft: 'auto' }}>
                <RefreshCw size={14} />
              </button>
            </div>
            {/* Form modifica / visualizzazione */}
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input className="mod-input" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Titolo stream" maxLength={140} />
                {/* Wrapper ricerca categoria — ref per calcolare posizione dropdown fixed */}
                <div ref={searchWrapRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input className="mod-input" value={gameSearch}
                      onChange={e => cercaGioco(e.target.value)}
                      placeholder={gameName || 'Cerca categoria/gioco…'}
                      style={{ flex: 1, minWidth: 0 }} />
                    {searching && <Loader size={14} className="spin" style={{ flexShrink: 0 }} />}
                  </div>
                  {/* Dropdown — position:fixed per sfuggire a qualsiasi stacking context / overflow */}
                  {gameResults.length > 0 && (
                    <div className="glass-card" style={{
                      position: 'fixed',
                      zIndex: 9999,
                      top: dropdownPos.top,
                      left: dropdownPos.left,
                      width: dropdownPos.width,
                      maxHeight: 220,
                      overflowY: 'auto',
                      padding: '0.25rem 0',
                      boxShadow: '0 8px 32px rgba(8,12,48,0.55)',
                    }}>
                      {gameResults.map(g => (
                        <button key={g.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                          onPointerDown={e => {
                            // onPointerDown per prevenire il blur dell'input che chiuderebbe il dropdown prima del click
                            e.preventDefault();
                            setGameId(g.id); setGameName(g.name); setGameSearch(''); setGameResults([]);
                          }}
                        >
                          {g.box_art_url && <img src={g.box_art_url.replace('{width}', '30').replace('{height}', '40')} alt="" style={{ width: 22, height: 30, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {gameName && gameId && (
                  <span className="text-tonal-success" style={{ fontSize: '0.8rem' }}>✓ {gameName}</span>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={salva} disabled={saving}>
                    {saving ? <Loader size={12} className="spin" /> : <Check size={12} />} Salva
                  </button>
                  <button className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => { setEditing(false); setGameResults([]); setGameSearch(''); }}>
                    <X size={12} /> Annulla
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.3, flex: 1, wordBreak: 'break-word' }}>
                    {data?.title || <span style={{ color: 'var(--text-faint)' }}>(nessun titolo)</span>}
                  </h2>
                  <button className="mod-icon-btn" onClick={() => setEditing(true)} title="Modifica">
                    <Edit2 size={14} />
                  </button>
                </div>
                {data?.gameName && (
                  <span className="chip" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>🎮 {data.gameName}</span>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats mini row */}
      <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }} {...entrata(0.05)}>
        {[
          { label: 'Visualizzazioni totali', value: data?.viewTotal?.toLocaleString('it-IT') ?? '—' },
          { label: 'Lingua', value: data?.language?.toUpperCase() ?? '—' },
          { label: 'Canale attivo dal', value: data?.createdAt ? new Date(data.createdAt).getFullYear() : '—' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Bio */}
      {data?.description && (
        <motion.div className="glass-card" style={{ padding: '1rem' }} {...entrata(0.1)}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{data.description}</p>
        </motion.div>
      )}
    </div>
  );
}
