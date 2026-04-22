import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Gamepad2, Brain, Camera, BookOpen, Cpu,
  Twitch, MapPin, Cake, Heart, Star,
} from 'lucide-react';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';

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

const JSON_LD_PERSON = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Andrea Taliento',
  alternateName: 'ANDRYXify',
  birthDate: '1998-03-05',
  birthPlace: {
    '@type': 'Place',
    name: 'Genova',
    addressCountry: 'IT',
  },
  url: 'https://andryxify.it/chi-sono',
  sameAs: [
    'https://twitch.tv/andryxify',
    'https://youtube.com/@ANDRYXify',
    'https://instagram.com/andryxify',
    'https://tiktok.com/@andryxify',
  ],
  jobTitle: 'Content Creator, Streamer',
  knowsAbout: ['Gaming', 'Intelligenza Artificiale', 'Anime', 'Manga', 'Tecnologia', 'Fotografia'],
  description: 'Streamer Twitch, content creator e appassionato di gaming, IA, anime e manga. Nato a Genova il 5 marzo 1998.',
};

export default function ChiSonoPage() {
  const { t } = useLingua();

  const INTERESSI = [
    { icon: <Gamepad2 size={22} />, label: t('chi-sono.interessi.gaming'), color: 'var(--accent-twitch)' },
    { icon: <Brain    size={22} />, label: t('chi-sono.interessi.ia'),     color: 'var(--secondary)'     },
    { icon: <Camera   size={22} />, label: t('chi-sono.interessi.foto'),   color: 'var(--accent-warm)'   },
    { icon: <BookOpen size={22} />, label: t('chi-sono.interessi.anime'),  color: 'var(--primary)'       },
    { icon: <Cpu      size={22} />, label: t('chi-sono.interessi.tech'),   color: '#4ade80'              },
  ];

  const FATTI = [
    { icona: <Cake   size={16} />, label: t('chi-sono.fatti.nato'),  valore: '5 Marzo 1998' },
    { icona: <MapPin size={16} />, label: t('chi-sono.fatti.citta'), valore: 'Genova 🇮🇹'    },
    { icona: <Heart  size={16} />, label: t('chi-sono.fatti.anime'), valore: 'One Piece'    },
    { icona: <Star   size={16} />, label: t('chi-sono.fatti.tipo'),  valore: t('chi-sono.fatti.tipo_val') },
  ];

  return (
    <div className="main-content">
      <SEO
        title={t('chi-sono.seo.title')}
        description={t('chi-sono.seo.description')}
        path="/chi-sono"
        keywords={t('chi-sono.seo.keywords')}
        jsonLd={JSON_LD_PERSON}
        type="profile"
      />

      {/* ── Hero ── */}
      <section className="header hero-section" style={{ paddingTop: '2.5rem', paddingBottom: '0' }}>
        <div className="hero-orb" aria-hidden="true" />

        <motion.div
          {...su(0)}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}
        >
          <div className="glass-avatar" style={{
            width: 108, height: 108,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src="/logo.png"
              alt="ANDRYXify — Andrea Taliento"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain', background: 'var(--bg-dark)', padding: 8 }}
            />
          </div>
        </motion.div>

        <motion.h1 className="title" {...su(0.08)}>
          {t('chi-sono.titolo')}
        </motion.h1>
        <motion.p className="subtitle" {...su(0.14)}>
          Andrea Taliento
          <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · </span>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>ANDRYXify</span>
          <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · </span>
          Genova 🇮🇹
        </motion.p>
      </section>

      {/* ── Scheda fatti ── */}
      <motion.div
        className="glass-panel"
        style={{ padding: '1.5rem' }}
        {...su(0.18)}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
        }}>
          {FATTI.map(f => (
            <div
              key={f.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', gap: '0.4rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ color: 'var(--primary)' }}>{f.icona}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{f.valore}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Bio ── */}
      <motion.div
        className="glass-panel"
        style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
        {...su(0.24)}
      >
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {t('chi-sono.saluto')} 👋
        </h2>
        <p style={{
          color: 'var(--text-main)',
          lineHeight: 1.9,
          fontSize: '1rem',
          margin: 0,
        }}>
          {t('chi-sono.bio')}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <Link to="/twitch" className="btn btn-primary">
            <Twitch size={15} /> {t('chi-sono.seguimi')}
          </Link>
          <Link to="/gioco" className="btn btn-ghost">
            <Gamepad2 size={15} /> {t('chi-sono.scopri')}
          </Link>
        </div>
      </motion.div>

      {/* ── Interessi ── */}
      <motion.div
        className="glass-panel"
        style={{ padding: '1.75rem' }}
        {...inView(0)}
      >
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.2rem', fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
          {t('chi-sono.interessi.titolo')}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.85rem',
        }}>
          {INTERESSI.map(i => (
            <motion.div
              key={i.label}
              className="glass-card"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.6rem', padding: '1rem 0.75rem',
                textAlign: 'center',
                borderColor: `${i.color}20`,
                '--card-glow': i.color,
              }}
              whileHover={{ scale: 1.04, y: -3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              <span style={{ color: i.color }}>{i.icon}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{i.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Live su Twitch ── */}
      <motion.div
        className="glass-panel"
        style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        {...inView(0.05)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Twitch size={22} color="#9146FF" />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif", color: '#9146FF' }}>
            {t('chi-sono.live.titolo')}
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, fontSize: '0.95rem' }}>
          {t('chi-sono.live.desc')}
        </p>
        <div className="glass-card" style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${typeof window !== 'undefined' ? window.location.hostname : 'andryxify.it'}&muted=true`}
            height="100%" width="100%" allowFullScreen
            loading="lazy"
            style={{ border: 'none', display: 'block' }}
            title="Twitch stream di andryxify"
          />
        </div>
        <Link
          to="/twitch"
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg,#9146FF,#6441a5)' }}
        >
          <Twitch size={15} /> {t('chi-sono.seguimi')}
        </Link>
      </motion.div>
    </div>
  );
}
