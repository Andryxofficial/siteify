import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Twitch, Sparkles, Zap, Brain, Gamepad2,
  Trophy, Crown, Star, Lock, MessageSquare,
  Fingerprint, Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialHub from '../components/SocialHub';
import PodcastPromo from '../components/PodcastPromo';
import SEO from '../components/SEO';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

// Variante con whileInView per sezioni sotto il fold
const inView = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport:   { once: true, margin: '-60px' },
  transition: { delay, type: 'spring', stiffness: 200, damping: 26 },
});

const PREMI = [
  {
    emoji: '🏆',
    colore: 'var(--accent-twitch)',
    titolo: 'VIP Settimanale',
    desc: 'Il punteggio più alto della settimana vince il ruolo VIP su Twitch per un mese intero.',
    cta: { label: 'Gioca ora', to: '/gioco', ext: null },
  },
  {
    emoji: '👑',
    colore: 'var(--accent-warm)',
    titolo: 'Campione Mensile',
    desc: 'Il punteggio più alto del mese riceve un premio speciale rivelato in live da Andryx.',
    cta: { label: 'Classifica', to: '/gioco', ext: null },
  },
  {
    emoji: '⭐',
    colore: 'var(--primary)',
    titolo: 'Social Star',
    desc: 'Il membro più attivo e costruttivo della community ogni mese ottiene un riconoscimento speciale.',
    cta: { label: 'Community', to: null, ext: 'https://discord.gg/BuckKZ4' },
  },
];

const STILE_PREMIO_CTA = {
  fontSize: '0.76rem', padding: '0.3rem 0.85rem',
  marginTop: 'auto', alignSelf: 'flex-start', minHeight: 'unset',
};

const MSG_FEATURES = [
  {
    icona: <Twitch size={22} />,
    colore: 'var(--accent-twitch)',
    titolo: 'Login con Twitch',
    desc: 'Accedi con il tuo account Twitch in un click, nessuna registrazione extra.',
  },
  {
    icona: <Lock size={22} />,
    colore: 'var(--secondary)',
    titolo: 'Cifrati End‑to‑End',
    desc: 'I messaggi sono leggibili solo da te e dal destinatario. Nemmeno il server può leggerli.',
  },
  {
    icona: <Fingerprint size={22} />,
    colore: 'var(--primary)',
    titolo: 'Passkey',
    desc: 'Proteggi le tue chiavi con Face ID, impronta digitale o PIN del dispositivo.',
  },
];

export default function Home() {
  const [liveState, setLiveState] = useState(0); // 0=offline 1=twitch 2=simulcast

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('https://decapi.me/twitch/uptime/andryxify');
        const text = await res.text();
        setLiveState(text.toLowerCase().includes('offline') ? 0 : 1);
      } catch { /* silent */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="main-content home-flow">
      <SEO
        title="Home"
        description="ANDRYXify (Andrea Taliento) — Streamer Twitch, gamer e content creator italiano. Live streaming di videogiochi, podcast su Intelligenza Artificiale, video YouTube, clip TikTok e minigioco esclusivo con classifica."
        path="/"
        keywords="andryxify, andrea taliento, streamer twitch italiano, content creator gaming, podcast intelligenza artificiale"
      />

      {/* ── Hero ── */}
      <section className="header hero-section" style={{ paddingTop: '2.5rem', paddingBottom: '0.5rem' }}>

        {/* Orb decorativo ambientale */}
        <div className="hero-orb" aria-hidden="true" />

        {/* Headline tipografica */}
        <motion.h1 className="hero-title" {...su(0)}>
          ANDRYX<span className="hero-title-ify">ify</span>
        </motion.h1>

        <motion.p className="subtitle" {...su(0.10)}>
          Esplorando il confine tra{' '}
          <span style={{ color: 'var(--primary)',   fontWeight: 600 }}>Umanità</span>,{' '}
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Intelligenza Artificiale</span>{' '}
          e <span style={{ color: 'var(--accent-warm)',  fontWeight: 600 }}>Gaming</span>.
        </motion.p>

        {/* Tagline chips */}
        <motion.div {...su(0.24)} style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Sparkles size={14} />, label: 'Content Creator', color: 'var(--primary)', bg: 'rgba(224,64,251,0.12)', border: 'rgba(224,64,251,0.20)' },
            { icon: <Brain size={14} />,    label: 'AI Explorer',     color: 'var(--secondary)', bg: 'rgba(0,229,255,0.12)', border: 'rgba(0,229,255,0.20)' },
            { icon: <Zap size={14} />,      label: 'Gamer',           color: 'var(--accent-warm)', bg: 'rgba(255,184,108,0.12)', border: 'rgba(255,184,108,0.20)' },
          ].map(t => (
            <motion.span
              key={t.label}
              className="chip"
              style={{
                background: t.bg,
                color: t.color,
                border: `1px solid ${t.border}`,
                fontSize: '0.72rem',
                padding: '4px 12px',
              }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {t.icon} {t.label}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA principali */}
        <motion.div
          {...su(0.32)}
          style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.6rem', flexWrap: 'wrap' }}
        >
          {liveState > 0 ? (
            <Link to="/twitch" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #9146FF, #6441a5)' }}>
              <Twitch size={15} /> Guarda la LIVE
            </Link>
          ) : (
            <a href="https://twitch.tv/andryxify" target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #9146FF, #6441a5)' }}>
              <Twitch size={15} /> Seguimi su Twitch
            </a>
          )}
          <Link to="/gioco" className="btn btn-ghost">
            <Gamepad2 size={15} /> Gioca ora
          </Link>
        </motion.div>
      </section>

      {/* ── Live preview ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
        {...su(0.28)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Twitch size={20} color="#9146FF" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>Live Preview</h2>
          <div style={{ marginLeft: 'auto' }}>
            {liveState > 0
              ? <span className="chip chip-live"><span className="chip-live-dot" /> LIVE ORA</span>
              : <span className="chip chip-offline">⚪ OFFLINE</span>
            }
          </div>
        </div>

        <div className="glass-card" style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}&muted=true`}
            height="100%" width="100%" allowFullScreen
            loading="lazy"
            style={{ border: 'none', display: 'block' }}
          />
        </div>

        {liveState === 2 && (
          <motion.a
            href="https://youtube.com/@ANDRYXify/live"
            target="_blank" rel="noreferrer"
            className="btn"
            style={{ background: 'linear-gradient(135deg,#FF0000,#990000)', color: '#fff', justifyContent: 'center' }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          >
            🔴 In simulcast anche su YouTube
          </motion.a>
        )}

        <Link to="/twitch" className="btn btn-primary" style={{ alignSelf: 'center' }}>
          Apri stream completo
        </Link>
      </motion.section>

      {/* ── Premi della Community ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.6rem 1.8rem' }}
        {...inView(0)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Trophy size={20} color="var(--accent-warm)" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            Premi della Community
          </h2>
          <span className="chip" style={{ marginLeft: 'auto', background: 'rgba(255,184,108,0.12)', color: 'var(--accent-warm)', border: '1px solid rgba(255,184,108,0.22)', fontSize: '0.7rem', padding: '3px 10px' }}>
            Ogni settimana e ogni mese
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.65 }}>
          Competi nel gioco del mese, rimani attivo nella community e vinci premi esclusivi. Tre modi per distinguersi.
        </p>

        <div className="premi-grid">
          {PREMI.map(p => (
            <div
              key={p.titolo}
              className="premio-card"
              style={{ '--accent-card': p.colore }}
            >
              <div className="premio-emoji">{p.emoji}</div>
              <div className="premio-titolo" style={{ color: p.colore }}>{p.titolo}</div>
              <div className="premio-desc">{p.desc}</div>
              {p.cta.to ? (
                <Link
                  to={p.cta.to}
                  className="btn btn-ghost"
                  style={STILE_PREMIO_CTA}
                >
                  {p.cta.label} →
                </Link>
              ) : (
                <a
                  href={p.cta.ext}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  style={STILE_PREMIO_CTA}
                >
                  {p.cta.label} →
                </a>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Messaggi Privati promo ── */}
      <motion.section
        className="glass-panel"
        style={{ padding: '1.6rem 1.8rem' }}
        {...inView(0.04)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Shield size={20} color="var(--secondary)" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            <span className="text-gradient-cyan">Messaggi Privati</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — Cifrati E2E</span>
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.65 }}>
          Chatta in modo sicuro con gli altri membri della community. Zero intercettazioni, massima privacy — protetto dalla tua passkey.
        </p>

        <div className="msg-features">
          {MSG_FEATURES.map(f => (
            <div
              key={f.titolo}
              className="msg-feature"
              style={{ '--accent-card': f.colore }}
            >
              <div className="msg-feature-icon" style={{ color: f.colore }}>{f.icona}</div>
              <div className="msg-feature-titolo">{f.titolo}</div>
              <div className="msg-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link to="/messaggi" className="btn btn-primary">
            <MessageSquare size={15} /> Prova i Messaggi
          </Link>
        </div>
      </motion.section>

      {/* ── Social Hub ── */}
      <motion.div {...inView(0)}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>Trovami su 📡</h2>
        <SocialHub />
      </motion.div>

      {/* ── Podcast Promo ── */}
      <motion.div {...inView(0.05)}>
        <PodcastPromo />
      </motion.div>
    </div>
  );
}

