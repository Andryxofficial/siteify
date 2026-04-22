/**
 * SubCharity.jsx — Abbonati e campagne Charity.
 *
 * 2 sezioni:
 *   - Subs: GET /api/mod-users?action=subs → lista subs groupati per tier (1000/2000/3000)
 *     + leaderboard gift-sub (chi ha regalato più sub)
 *   - Charity: GET /api/mod-goals?type=charity → campagna attiva + top donations
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Users, Award, TrendingUp, Loader, RefreshCw, Gift, Crown,
  DollarSign, Target,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet } from '../../utils/modApi';

const TIER_INFO = {
  1000: { label: 'Tier 1',  emoji: '⭐', color: 'var(--accent-twitch)' },
  2000: { label: 'Tier 2',  emoji: '💎', color: 'var(--accent-warm)' },
  3000: { label: 'Tier 3',  emoji: '👑', color: 'var(--accent-spotify)' },
};

function formatAmount(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SubCharity({ token }) {
  const toast = useToast();

  // Subs
  const [subs, setSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);

  // Charity
  const [charity, setCharity] = useState(null);
  const [charityLoading, setCharityLoading] = useState(true);

  const loadSubs = useCallback(async () => {
    setSubsLoading(true);
    const r = await modGet('/api/mod-users?action=subs', token);
    if (r.ok) {
      setSubs(r.data?.subs || []);
    } else {
      toast.error(r.error, { titolo: 'Caricamento Sub' });
    }
    setSubsLoading(false);
  }, [token, toast]);

  const loadCharity = useCallback(async () => {
    setCharityLoading(true);
    const r = await modGet('/api/mod-goals?type=charity', token);
    if (r.ok) {
      setCharity(r.data);
    } else {
      // Non è un errore critico se non c'è campagna charity attiva
      if (r.status !== 404) {
        toast.error(r.error, { titolo: 'Caricamento Charity' });
      }
    }
    setCharityLoading(false);
  }, [token, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubs();
    loadCharity();
  }, [loadSubs, loadCharity]);

  // Grouping subs per tier
  const subsByTier = useMemo(() => {
    const groups = { 1000: [], 2000: [], 3000: [] };
    subs.forEach(s => {
      const tier = Number(s.tier) || 1000;
      if (groups[tier]) groups[tier].push(s);
    });
    return groups;
  }, [subs]);

  // Leaderboard gifters
  const giftLeaderboard = useMemo(() => {
    const gifters = {};
    subs.forEach(s => {
      if (s.is_gift && s.gifter_login) {
        if (!gifters[s.gifter_login]) {
          gifters[s.gifter_login] = { login: s.gifter_login, name: s.gifter_name || s.gifter_login, count: 0 };
        }
        gifters[s.gifter_login].count += 1;
      }
    });
    return Object.values(gifters).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [subs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
        <Heart size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent-twitch)' }} />
        Abbonati e Charity
      </h2>

      <div className="mod-grid-2" style={{ alignItems: 'start' }}>
        {/* Subs */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
              <Users size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-twitch)' }} />
              Abbonati ({subs.length})
            </h3>
            <button className="mod-icon-btn" onClick={loadSubs} title="Aggiorna">
              {subsLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          {subsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader size={26} className="spin" style={{ color: 'var(--accent-twitch)' }} />
            </div>
          ) : subs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Heart size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessun abbonato al momento.
              </p>
            </div>
          ) : (
            <>
              {/* Group per tier */}
              {Object.keys(subsByTier).map(tier => {
                const list = subsByTier[tier];
                if (list.length === 0) return null;
                const info = TIER_INFO[tier] || { label: `Tier ${tier}`, emoji: '⭐', color: 'var(--secondary)' };
                return (
                  <div key={tier} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: info.color }}>
                      {info.emoji} {info.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({list.length})</span>
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {list.map((s, i) => (
                        <div key={i} className="glass-card" style={{ padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500 }}>{s.user_name || s.user_login}</span>
                          {s.is_gift && (
                            <span className="chip" style={{ fontSize: '0.66rem' }}>
                              <Gift size={9} /> Regalo
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Gift leaderboard */}
              {giftLeaderboard.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-warm)' }}>
                    <Award size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    Top Gifters
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {giftLeaderboard.map((g, i) => (
                      <div key={i} className="glass-card" style={{ padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {i === 0 && <Crown size={12} style={{ color: 'var(--accent-warm)' }} />}
                        <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 500 }}>{g.name}</span>
                        <span className="chip" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                          {g.count} 🎁
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Charity */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
              <Target size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-spotify)' }} />
              Campagna Charity
            </h3>
            <button className="mod-icon-btn" onClick={loadCharity} title="Aggiorna">
              {charityLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          {charityLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader size={26} className="spin" style={{ color: 'var(--accent-spotify)' }} />
            </div>
          ) : !charity || !charity.campaign ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Target size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessuna campagna charity attiva.
              </p>
            </div>
          ) : (
            <>
              {/* Campagna info */}
              <div className="glass-card" style={{ padding: '0.85rem', marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  {charity.campaign.charity_name}
                </div>
                {charity.campaign.charity_description && (
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                    {charity.campaign.charity_description}
                  </p>
                )}
                <div style={{ marginBottom: '0.4rem' }}>
                  <div style={{
                    height: 10,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {charity.campaign.target_amount > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((charity.campaign.current_amount / charity.campaign.target_amount) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--accent-spotify), var(--accent-spotify)dd)',
                          borderRadius: 12,
                        }}
                      />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent-spotify)' }}>
                    {formatAmount(charity.campaign.current_amount.value)}
                  </span>
                  {charity.campaign.target_amount > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      obiettivo {formatAmount(charity.campaign.target_amount.value)}
                    </span>
                  )}
                </div>
              </div>

              {/* Top donations */}
              {charity.donations && charity.donations.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-warm)' }}>
                    <TrendingUp size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    Top Donazioni
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {charity.donations.slice(0, 10).map((d, i) => (
                      <div key={i} className="glass-card" style={{ padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {i === 0 && <Crown size={12} style={{ color: 'var(--accent-warm)' }} />}
                        <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 500 }}>{d.user_name || d.user_login}</span>
                        <span className="chip" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-spotify)' }}>
                          <DollarSign size={10} />
                          {formatAmount(d.amount.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
