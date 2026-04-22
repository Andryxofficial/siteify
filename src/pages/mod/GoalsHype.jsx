/**
 * GoalsHype.jsx — Visualizzazione Goal e Hype Train.
 *
 * 2 colonne (responsive: stack su mobile):
 *   - Goal: GET /api/mod-goals?type=goals → progress bar per follower/sub/bits goals
 *   - Hype Train: GET /api/mod-goals?type=hype_train → ultimi 5 hype train attivi/completati
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Target, TrendingUp, Users, Heart, Coins, Loader, RefreshCw,
  Award, Flame, Trophy, Clock,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet } from '../../utils/modApi';

const GOAL_TYPE_INFO = {
  follower:    { label: 'Follower',  icon: Users,  color: 'var(--primary)' },
  subscription:{ label: 'Sub',       icon: Heart,  color: 'var(--accent-twitch)' },
  subscription_count:{ label: 'Sub Count', icon: Heart, color: 'var(--accent-warm)' },
  new_subscription:{ label: 'Nuovi Sub', icon: Heart, color: 'var(--accent-spotify)' },
  new_subscription_count:{ label: 'Nuovi Sub Count', icon: Heart, color: 'var(--accent)' },
  bit:         { label: 'Bit',       icon: Coins,  color: 'var(--accent-warm)' },
};

function formatNum(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n?.toLocaleString('it-IT') || '0';
}

export default function GoalsHype({ token }) {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [hypeTrains, setHypeTrains] = useState([]);
  const [hypeLoading, setHypeLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    const r = await modGet('/api/mod-goals?type=goals', token);
    if (r.ok) {
      setGoals(r.data?.goals || []);
    } else {
      toast.error(r.error, { titolo: 'Caricamento Goal' });
    }
    setGoalsLoading(false);
  }, [token, toast]);

  const loadHypeTrains = useCallback(async () => {
    setHypeLoading(true);
    const r = await modGet('/api/mod-goals?type=hype_train', token);
    if (r.ok) {
      setHypeTrains(r.data?.events || []);
    } else {
      toast.error(r.error, { titolo: 'Caricamento Hype Train' });
    }
    setHypeLoading(false);
  }, [token, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGoals();
    loadHypeTrains();
  }, [loadGoals, loadHypeTrains]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
        <Target size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent-warm)' }} />
        Goal e Hype Train
      </h2>

      <div className="mod-grid-2" style={{ alignItems: 'start' }}>
        {/* Goal */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
              <Target size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-twitch)' }} />
              Goal Attivi
            </h3>
            <button className="mod-icon-btn" onClick={loadGoals} title="Aggiorna">
              {goalsLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
          {goalsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader size={26} className="spin" style={{ color: 'var(--accent-twitch)' }} />
            </div>
          ) : goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Target size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessun goal attivo al momento.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {goals.map((g, i) => {
                const info = GOAL_TYPE_INFO[g.type] || { label: g.type, icon: Award, color: 'var(--secondary)' };
                const Icon = info.icon;
                const progress = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass-card"
                    style={{ padding: '0.85rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Icon size={14} style={{ color: info.color }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{info.label}</span>
                    </div>
                    {g.description && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                        {g.description}
                      </p>
                    )}
                    <div style={{ marginBottom: '0.4rem' }}>
                      <div style={{
                        height: 8,
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        position: 'relative',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            background: `linear-gradient(90deg, ${info.color}, ${info.color}dd)`,
                            borderRadius: 12,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600, color: info.color }}>
                        {formatNum(g.current_amount)} / {formatNum(g.target_amount)}
                      </span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hype Train */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
              <Flame size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-warm)' }} />
              Hype Train Recenti
            </h3>
            <button className="mod-icon-btn" onClick={loadHypeTrains} title="Aggiorna">
              {hypeLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
          {hypeLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader size={26} className="spin" style={{ color: 'var(--accent-warm)' }} />
            </div>
          ) : hypeTrains.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Flame size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessun Hype Train ancora.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {hypeTrains.slice(0, 5).map((ht, i) => {
                const data = ht.event_data || {};
                const isActive = ht.event_type === 'hypetrain.begin' || ht.event_type === 'hypetrain.progress';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass-card"
                    style={{
                      padding: '0.85rem',
                      borderLeft: isActive ? '3px solid var(--accent-warm)' : '3px solid var(--text-faint)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                      {isActive ? (
                        <Flame size={14} style={{ color: 'var(--accent-warm)' }} />
                      ) : (
                        <Trophy size={14} style={{ color: 'var(--accent-spotify)' }} />
                      )}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isActive ? 'var(--accent-warm)' : 'var(--text-main)' }}>
                        Livello {data.level || 1}
                      </span>
                      {isActive && (
                        <span className="chip" style={{ fontSize: '0.66rem', marginLeft: 'auto' }}>
                          🔥 LIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      {formatNum(data.total || 0)} punti totali
                    </div>
                    {data.top_contributions && data.top_contributions.length > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        Top: {data.top_contributions.slice(0, 3).map(c => c.user_name || c.user_login).join(', ')}
                      </div>
                    )}
                    {data.started_at && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={10} />
                        {new Date(data.started_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
