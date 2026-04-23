import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, Clock } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useLingua } from '../contexts/LinguaContext';

export default function SchermataCampione() {
  const { twitchUser, twitchToken } = useTwitchAuth();
  const { t } = useLingua();
  const [stato, setStato] = useState(null);
  const [visibile, setVisibile] = useState(false);
  const [target, setTarget] = useState('');
  const [conferma, setConferma] = useState(false);
  const [invio, setInvio] = useState(false);
  const [successo, setSuccesso] = useState(false);
  const [errore, setErrore] = useState('');
  const [countdown, setCountdown] = useState('');

  // Controlla stato VIP al mount
  useEffect(() => {
    if (!twitchUser || !twitchToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/leaderboard?action=vip_winner_status`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStato(data);
        if (data.isWinner && data.windowOpen && !data.alreadyGranted) {
          const dismissed = sessionStorage.getItem(`vip_dismissed_${data.weekKey}`);
          if (!dismissed) setVisibile(true);
        }
      } catch { /* silenzioso */ }
    })();
  }, [twitchUser, twitchToken]);

  // Countdown fino a lunedì 10:00
  useEffect(() => {
    if (!visibile) return;
    const tick = () => {
      const now = new Date();
      const itStr = now.toLocaleString('en-US', { timeZone: 'Europe/Rome' });
      const itNow = new Date(itStr);
      const tgt = new Date(itNow);
      if (itNow.getDay() === 0) { tgt.setDate(tgt.getDate() + 1); }
      tgt.setHours(10, 0, 0, 0);
      const diff = Math.max(0, tgt - itNow);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visibile]);

  const assegnaVIP = useCallback(async () => {
    if (!target.trim() || invio) return;
    setInvio(true);
    setErrore('');
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'grant_vip', targetUsername: target.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setSuccesso(true);
    } catch (e) { setErrore(e.message); }
    finally { setInvio(false); }
  }, [target, twitchToken, invio]);

  const chiudi = () => {
    if (stato?.weekKey) sessionStorage.setItem(`vip_dismissed_${stato.weekKey}`, '1');
    setVisibile(false);
  };

  if (!visibile && !stato?.alreadyGranted) return null;
  if (!visibile && stato?.alreadyGranted) return null;

  return (
    <AnimatePresence>
      {visibile && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,5,6,0.85)', backdropFilter: 'blur(20px)', padding: '1rem' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="glass-panel"
            style={{ maxWidth: 440, width: '100%', padding: '2rem', textAlign: 'center' }}
          >
            {successo ? (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
                  <span style={{ fontSize: '4rem' }}>🎉</span>
                </motion.div>
                <h2 style={{ marginTop: '1rem' }}>{t('campione.successo.titolo')} <span className="text-gradient">@{target}</span>!</h2>
                <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>{t('campione.successo.desc')}</p>
                <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setVisibile(false)}>{t('campione.chiudi')}</button>
              </>
            ) : stato?.alreadyGranted ? (
              <>
                <span style={{ fontSize: '3rem' }}>🏆</span>
                <h2 style={{ marginTop: '0.5rem' }}>{t('campione.gia.titolo')}</h2>
                <p style={{ opacity: 0.7 }}>{t('campione.gia.desc')} <strong>@{stato.grantee}</strong> {t('campione.gia.settimana')}</p>
                <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setVisibile(false)}>{t('campione.chiudi')}</button>
              </>
            ) : (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, -10, 10, 0] }} transition={{ type: 'spring', delay: 0.1 }}>
                  <span style={{ fontSize: '4rem' }}>🏆</span>
                </motion.div>
                <h2 className="text-gradient" style={{ marginTop: '0.75rem', fontSize: '1.4rem' }}>
                  {t('campione.congrats')}
                </h2>
                <p style={{ opacity: 0.7, margin: '0.5rem 0' }}>
                  {t('campione.tempo_rimasto')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', margin: '0.5rem 0', color: 'var(--accent-warm)' }}>
                  <Clock size={16} />
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>{countdown}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <input
                    className="glass-card"
                    placeholder={t('campione.placeholder')}
                    value={target}
                    onChange={e => { setTarget(e.target.value); setConferma(false); setErrore(''); }}
                    style={{ flex: 1, padding: '0.6rem 0.8rem', border: '1px solid rgba(130,170,240,0.14)', borderRadius: 12, background: 'var(--surface-2)', outline: 'none', color: 'inherit', fontSize: '0.9rem' }}
                  />
                </div>
                {errore && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem' }}>{errore}</p>}
                {target.trim() && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '0.75rem' }}>
                    {!conferma ? (
                      <button className="btn btn-primary" style={{ width: '100%' }}
                        onClick={() => setConferma(true)} disabled={invio}>
                        <Award size={16} /> {t('campione.dai_vip')} @{target.trim()}
                      </button>
                    ) : (
                      <button className="btn" style={{ width: '100%', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
                        onClick={assegnaVIP} disabled={invio}>
                        {invio ? t('campione.invio') : t('campione.conferma')}
                      </button>
                    )}
                  </motion.div>
                )}
                <button className="btn btn-ghost" style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.85rem' }} onClick={chiudi}>
                  {t('campione.decidi_dopo')}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
