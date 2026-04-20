/**
 * Stats.jsx — Statistiche canale con grafici Recharts.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader, RefreshCw, TrendingUp, Camera } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

const API = '/api/mod-stats';

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20,26,44,0.92)',
      border: '1px solid rgba(130,170,240,0.2)',
      borderRadius: 12, padding: '0.6rem 0.9rem',
      fontSize: '0.8rem', color: 'var(--text-main)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value?.toLocaleString('it-IT') ?? '—'}</div>
      ))}
    </div>
  );
}

export default function Stats({ token }) {
  const [points,  setPoints]  = useState([]);
  const [days,    setDays]    = useState(7);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [error,   setError]   = useState('');

  const carica = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setPoints(d.points || []);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token, days]);

  useEffect(() => { carica(); }, [carica]);

  const snapshot = useCallback(async () => {
    setSnapping(true);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await carica();
    } catch (e) { setError(e.message); }
    finally    { setSnapping(false); }
  }, [token, carica]);

  // Trasforma i punti per i grafici
  const chartData = points.map(p => ({
    time:      new Date(p.ts).toLocaleDateString('it-IT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    Spettatori: p.viewerCount ?? null,
    Follower:   p.followerTotal ?? null,
  }));

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader size={28} className="spin" style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div className="glass-card" style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`mod-tab${days === d ? ' mod-tab-active' : ''}`}
            style={{ fontSize: '0.8rem' }}>
            {d} giorni
          </button>
        ))}
        <button className="mod-icon-btn" onClick={carica} style={{ marginLeft: 'auto' }} title="Aggiorna"><RefreshCw size={13} /></button>
        <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={snapshot} disabled={snapping} title="Cattura snapshot ora">
          {snapping ? <Loader size={13} className="spin" /> : <Camera size={13} />} Snapshot
        </button>
      </div>

      {points.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <TrendingUp size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Nessun dato disponibile per questo periodo.
          </p>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Il cron raccoglie uno snapshot giornaliero alle 03:00 UTC.<br />
            Oppure clicca <strong>Snapshot</strong> per salvare i dati attuali.
          </p>
        </div>
      ) : (
        <>
          {/* Grafico spettatori */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
              <TrendingUp size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--primary)' }} />
              Spettatori durante gli stream
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradViewers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,240,0.1)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<GlassTooltip />} />
                <Area type="monotone" dataKey="Spettatori" stroke="var(--primary)" fill="url(#gradViewers)" strokeWidth={2} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Grafico follower */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
              <TrendingUp size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--secondary)' }} />
              Follower nel tempo
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,240,0.1)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<GlassTooltip />} />
                <Area type="monotone" dataKey="Follower" stroke="var(--secondary)" fill="url(#gradFollowers)" strokeWidth={2} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
