import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Twitch, Sparkles, Zap, Brain, Gamepad2,
  Trophy, Crown, Star, Lock, MessageSquare,
  Fingerprint, Shield, Share2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';
import { useToast } from '../contexts/ToastContext';
import { localFirstText } from '../i18n/localFirst';
import { condividi, puoCondividere } from '../utils/condividi';
import { hapticLight } from '../utils/haptics';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

const inView = (delay = 0) => ({
  initial:     { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport:    { once: true, margin: '-60px' },
  transition:  { delay, type: 'spring', stiffness: 200, damping: 26 },
});

const STILE_PREMIO_CTA = {
  fontSize: '0.76rem', padding: '0.3rem 0.85rem',
  marginTop: 'auto', alignSelf: 'flex-start', minHeight: 'unset',
};

export default function Home() {
  const [liveState] = useState(0); // local-first: niente polling esterno automatico
  const { t, lingua } = useLingua();
  const localTxt = localFirstText(lingua);
  const toast = useToast();

  const onCondividi = async () => {
    hapticLight();
    const r = await condividi({
      titolo: 'ANDRYXify',
      testo:  t('app.claim'),
      url:    typeof window !== 'undefined' ? window.location.origin + '/' : 'https://andryxify.it/',
    });
    if (r === 'copied') toast.success(t('condividi.copiato'));
    else if (r === 'unsupported') toast.error(t('condividi.errore'));
  };

  return (
    <div className="main-content home-flow local-first-page">
      <SEO
        title="Home"
        description="ANDRYXify (Andrea Taliento) — Streamer Twitch di Genova, gamer e content creator italiano. Live streaming di videogiochi, podcast su Intelligenza Artificiale, video YouTube, clip TikTok e minigioco esclusivo con classifica."
        path="/"
        keywords="andryxify, andrea taliento, streamer genova, gamer genovese, content creator liguria, twitch genova, streaming italiano"
      />

      {/* ── Hero ── */}
      <section className="header hero-section hero-section-safe" style={{ paddingTop: 'clamp(3.8rem, 12vw, 6.2rem)', paddingBottom: '0.5rem', overflow: 'visible' }}>
        <div className="hero-orb" aria-hidden="true" />

        <motion.h1 className="hero-title" {...su(0)}>
          ANDRYX<span className="hero-title-ify">ify</span>
        </motion.h1>

        <motion.p className="subtitle" {...su(0.10)}>
          {t('home.hero.sottotitolo_prefix')}{' '}
          <span style={{ color: 'var(--primary)',   fontWeight: 600 }}>{t('home.hero.umanita')}</span>,{' '}
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>{t('home.hero.ai')}</span>{' '}
          {t('home.hero.e')} <span style={{ color: 'var(--accent-warm)',  fontWeight: 600 }}>{t('home.hero.gaming')}</span>.
        </motion.p>

        <motion.div {...su(0.24)} style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Sparkles size={14} />, label: t('home.chip.creator'),     color: 'var(--primary)', bg: 'rgba(224,64,251,0.12)', border: 'rgba(224,64,251,0.20)' },
            { icon: <Brain size={14} />,    label: t('home.chip.ai_explorer'), color: 'var(--secondary)', bg: 'rgba(0,229,255,0.12)', border: 'rgba(0,229,255,0.20)' },
            { icon: <Zap size={14} />,      label: t('home.chip.gamer'),       color: 'var(--accent-warm)', bg: 'rgba(255,184,108,0.12)', border: 'rgba(255,184,108,0.20)' },
          ].map(chip => (
            <motion.span
              key={chip.label}
              className="chip"
              style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, fontSize: '0.72rem', padding: '4px 12px' }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {chip.icon} {chip.label}
            </motion.span>
          ))}
        </motion.div>

        <motion.div {...su(0.32)} style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.6rem', flexWrap: 'wrap' }}>
          <a href="https://twitch.tv/andryxify" target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #9146FF, #6441a5)' }}>
            <Twitch size={15} /> {t('home.cta.seguimi')}
          </a>
          <Link to="/gioco" className="btn btn-ghost">
            <Gamepad2 size={15} /> {t('home.cta.gioca_ora')}
          </Link>
          {puoCondividere() && (
            <button type="button" onClick={onCondividi} className="btn btn-ghost" aria-label={t('condividi.titolo')}>
              <Share2 size={15} /> {t('condividi.titolo')}
            </button>
          )}
        </motion.div>
      </section>

      <motion.section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }} {...su(0.28)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twitch size={20} color="#9146FF" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('home.live.titolo')}</h2>
          <div style={{ marginLeft: 'auto' }}>
            <span className="chip chip-offline">{t('home.live.offline')}</span>
          </div>
        </div>

        <div className="glass-card local-live-placeholder" style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--r-md)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
          <div>
            <strong>{localTxt.livePrivacyTitle}</strong>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {localTxt.livePrivacyText}
            </p>
          </div>
        </div>

        <a href="https://twitch.tv/andryxify" target="_blank" rel="noreferrer" className="btn btn-primary" style={{ alignSelf: 'center' }}>
          {t('home.live.apri')}
        </a>
      </motion.section>

      <motion.section className="glass-panel" style={{ padding: '1.6rem 1.8rem' }} {...inView(0)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Trophy size={20} color="var(--accent-warm)" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>{t('home.premi.titolo')}</h2>
          <span className="chip" style={{ marginLeft: 'auto', background: 'rgba(255,184,108,0.12)', color: 'var(--accent-warm)', border: '1px solid rgba(255,184,108,0.22)', fontSize: '0.7rem', padding: '3px 10px' }}>{t('home.premi.frequenza')}</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.65 }}>{t('home.premi.desc')}</p>

        <div className="premi-grid">
          {[
            { emoji: '🏆', colore: 'var(--accent-twitch)', titoloKey: 'home.premi.vip.titolo',      descKey: 'home.premi.vip.desc',      ctaKey: 'home.premi.vip.cta',      to: '/gioco' },
            { emoji: '👑', colore: 'var(--accent-warm)',   titoloKey: 'home.premi.campione.titolo', descKey: 'home.premi.campione.desc', ctaKey: 'home.premi.campione.cta', to: '/gioco#classifica' },
            { emoji: '⭐', colore: 'var(--primary)',       titoloKey: 'home.premi.star.titolo',     descKey: 'home.premi.star.desc',     ctaKey: 'home.premi.star.cta',     to: '/socialify' },
          ].map(p => (
            <div key={p.titoloKey} className="premio-card" style={{ '--accent-card': p.colore }}>
              <div className="premio-emoji">{p.emoji}</div>
              <div className="premio-titolo" style={{ color: p.colore }}>{t(p.titoloKey)}</div>
              <div className="premio-desc">{t(p.descKey)}</div>
              <Link to={p.to} className="btn btn-ghost" style={STILE_PREMIO_CTA}>{t(p.ctaKey)} →</Link>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section className="glass-panel" style={{ padding: '1.6rem 1.8rem' }} {...inView(0.04)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Shield size={20} color="var(--secondary)" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            <span className="text-gradient-cyan">{t('home.msg.titolo')}</span><span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> {t('home.msg.e2e')}</span>
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.65 }}>{t('home.msg.desc')}</p>

        <div className="msg-features">
          {[
            { icona: <Twitch size={22} />,      colore: 'var(--accent-twitch)', titoloKey: 'home.msg.feature.login.titolo',   descKey: 'home.msg.feature.login.desc'   },
            { icona: <Lock size={22} />,         colore: 'var(--secondary)',     titoloKey: 'home.msg.feature.e2e.titolo',    descKey: 'home.msg.feature.e2e.desc'     },
            { icona: <Fingerprint size={22} />,  colore: 'var(--primary)',       titoloKey: 'home.msg.feature.passkey.titolo', descKey: 'home.msg.feature.passkey.desc' },
          ].map(f => (
            <div key={f.titoloKey} className="msg-feature" style={{ '--accent-card': f.colore }}>
              <div className="msg-feature-icon" style={{ color: f.colore }}>{f.icona}</div>
              <div className="msg-feature-titolo">{t(f.titoloKey)}</div>
              <div className="msg-feature-desc">{t(f.descKey)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link to="/messaggi" className="btn btn-primary"><MessageSquare size={15} /> {t('home.msg.cta')}</Link>
        </div>
      </motion.section>

      <motion.div {...inView(0)}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>{t('home.trovami')}</h2>
        <SocialHub />
      </motion.div>

      <motion.div {...inView(0.05)}>
        <PodcastPromo />
      </motion.div>
    </div>
  );
}
