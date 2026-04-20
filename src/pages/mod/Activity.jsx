/**
 * Activity.jsx — Feed eventi recenti: follower e subscriber.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, RefreshCw, Loader, Users } from 'lucide-react';

function TierBadge({ tier }) {
  const label = tier === '3000' ? 'Tier 3' : tier === '2000' ? 'Tier 2' : 'Tier 1';
  const color  = tier === '3000' ? 'var(--accent-warm)' : tier === '2000' ? 'var(--primary)' : 'var(--accent-twitch)';
  return (
    <span className="chip" style={{ fontSize: '0.65rem', background: `${color}20`, color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

export default function Activity({ token }) {
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');

  const carica = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/mod-events', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  useEffect(() => { carica(); }, [carica]);
  useEffect(() => {
    const t = setInterval(carica, 60_000);
    return () => clearInterval(t);
  }, [carica]);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader size={28} className="spin" style={{ color: 'var(--primary)' }} /></div>;
  if (error)   return <div className="glass-card" style={{ padding: '1rem', color: 'var(--accent)' }}>⚠️ {error}</div>;

  const followers     = data?.followers     || [];
  const subscriptions = data?.subscriptions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Contatori */}
      <div className="mod-grid-2">
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={20} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data?.totalFollowers?.toLocaleString('it-IT') ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Follower totali</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Star size={20} style={{ color: 'var(--accent-twitch)' }} />
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data?.totalSubs?.toLocaleString('it-IT') ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Subscriber totali</div>
          </div>
        </div>
      </div>

      {/* Ultimi follower */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Heart size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--primary)' }} />Ultimi follower</h3>
          <button className="mod-icon-btn" onClick={carica} title="Aggiorna"><RefreshCw size={13} /></button>
        </div>
        {followers.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Nessun dato disponibile.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {followers.slice(0, 15).map((f, i) => (
              <motion.div key={f.user_id} className="glass-card"
                style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              >
                <Heart size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.user_name}</span>
                {f.followed_at && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                    {new Date(f.followed_at).toLocaleDateString('it-IT')}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Ultimi subscriber */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.9rem' }}>
          <Star size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-twitch)' }} />Ultimi subscriber
        </h3>
        {subscriptions.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Nessun dato disponibile (scope channel:read:subscriptions richiesto).</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {subscriptions.slice(0, 10).map((s, i) => (
              <motion.div key={s.user_id} className="glass-card"
                style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              >
                <Star size={12} style={{ color: 'var(--accent-twitch)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.user_name}</span>
                <TierBadge tier={s.tier} />
                {s.is_gift && <span className="chip" style={{ fontSize: '0.65rem' }}>🎁 Gift</span>}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
