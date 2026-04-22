import { motion } from 'framer-motion';
import {
  User, MapPin, Calendar, Gamepad2, Brain, Camera,
  Tv2, Rss, Heart, BookOpen,
} from 'lucide-react';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

const inView = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport:   { once: true, margin: '-60px' },
  transition: { delay, type: 'spring', stiffness: 200, damping: 26 },
});

export default function ChiSonoPage() {
  const { t } = useLingua();

  const passioni = [
    { icon: <Gamepad2 size={22} />, color: 'var(--primary)',       label: t('chisono.passioni.videogiochi') },
    { icon: <Brain    size={22} />, color: 'var(--secondary)',     label: t('chisono.passioni.ia') },
    { icon: <Camera   size={22} />, color: 'var(--accent-warm)',   label: t('chisono.passioni.foto') },
    { icon: <Tv2      size={22} />, color: '#9146FF',              label: t('chisono.passioni.streaming') },
    { icon: <Rss      size={22} />, color: '#1DB954',              label: t('chisono.passioni.podcast') },
    { icon: <BookOpen size={22} />, color: '#EE1D52',              label: t('chisono.passioni.manga') },
    { icon: <Heart    size={22} />, color: '#ff6b9d',              label: t('chisono.passioni.anime') },
  ];

  /* JSON-LD strutturato per la pagina persona */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://andryxify.it/#persona',
    name: 'Andrea Taliento',
    alternateName: ['ANDRYXify', 'Andryx', 'andryxify'],
    url: 'https://andryxify.it',
    image: 'https://andryxify.it/logo.png',
    birthDate: '1998-03-05',
    birthPlace: {
      '@type': 'Place',
      name: 'Italia',
    },
    homeLocation: {
      '@type': 'Place',
      name: 'Genova',
      addressRegion: 'Liguria',
      addressCountry: 'IT',
    },
    description: 'Streamer Twitch, gamer, content creator e nerd italiano di Genova. Appassionato di videogiochi, IA, fotografia, anime e manga. Canale Twitch: andryxify.',
    jobTitle: 'Content Creator & Streamer',
    knowsAbout: [
      'Video Gaming', 'Artificial Intelligence', 'Live Streaming',
      'Podcast', 'Content Creation', 'Photography', 'Anime', 'Manga', 'One Piece',
    ],
    sameAs: [
      'https://twitch.tv/andryxify',
      'https://youtube.com/@ANDRYXify',
      'https://instagram.com/andryxify',
      'https://tiktok.com/@andryxify',
      'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',
    ],
  };

  return (
    <div className="main-content">
      <SEO
        title={t('chisono.seo.titolo')}
        description={t('chisono.seo.descrizione')}
        path="/chi-sono"
        keywords={t('chisono.seo.keywords')}
        type="profile"
        jsonLd={jsonLd}
      />

      {/* ── Hero ── */}
      <section className="header" style={{ paddingTop: '2rem', paddingBottom: '0.5rem', textAlign: 'center' }}>
        <motion.div {...su(0)} style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="glass-avatar" style={{
            width: 108, height: 108, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            padding: 4,
            position: 'relative',
          }}>
            <img
              src="/logo.png"
              alt="Andrea Taliento — ANDRYXify"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain', background: '#111', padding: 8 }}
            />
          </div>
        </motion.div>

        <motion.h1 className="hero-title" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }} {...su(0.06)}>
          {t('chisono.titolo')}
        </motion.h1>

        <motion.div
          {...su(0.12)}
          style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', flexWrap: 'wrap', marginTop: '0.8rem' }}
        >
          <span className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={13} /> Andrea Taliento
          </span>
          <span className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} /> Genova, Italia
          </span>
          <span className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={13} /> 5 {t('chisono.nascita_mese')} 1998
          </span>
        </motion.div>
      </section>

      {/* ── Presentazione ── */}
      <motion.section className="glass-panel" style={{ padding: '2rem 2.4rem' }} {...su(0.18)}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem', fontWeight: 700, fontFamily: "'Space Grotesk','Outfit',sans-serif" }}>
          {t('chisono.presentazione.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, fontSize: '1rem', margin: 0 }}>
          {t('chisono.bio')}
        </p>
      </motion.section>

      {/* ── Passioni ── */}
      <motion.section className="glass-panel" style={{ padding: '2rem 2.4rem' }} {...inView(0)}>
        <h2 style={{ marginTop: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Space Grotesk','Outfit',sans-serif" }}>
          {t('chisono.passioni.titolo')}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.85rem',
          marginTop: '1rem',
        }}>
          {passioni.map((p) => (
            <motion.div
              key={p.label}
              className="glass-card"
              style={{
                padding: '1rem 0.9rem',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '0.5rem',
                textAlign: 'center',
                cursor: 'default',
              }}
              whileHover={{ scale: 1.05, y: -3 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              <span style={{ color: p.color }}>{p.icon}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{p.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Anime & Manga ── */}
      <motion.section className="glass-panel" style={{ padding: '2rem 2.4rem' }} {...inView(0.04)}>
        <h2 style={{ marginTop: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Space Grotesk','Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} color="#EE1D52" />
          {t('chisono.anime.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
          {t('chisono.anime.testo')}
        </p>
        <span className="chip" style={{
          background: 'rgba(238,29,82,0.13)',
          color: '#EE1D52',
          border: '1px solid rgba(238,29,82,0.22)',
          fontSize: '0.8rem', padding: '5px 14px',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          ❤️ One Piece
        </span>
      </motion.section>

      {/* ── Dove trovarmi ── */}
      <motion.section className="glass-panel" style={{ padding: '2rem 2.4rem' }} {...inView(0.06)}>
        <h2 style={{ marginTop: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Space Grotesk','Outfit',sans-serif" }}>
          {t('chisono.trovami.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.75, fontSize: '0.92rem', marginTop: '0.5rem' }}>
          {t('chisono.trovami.testo')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginTop: '1.1rem' }}>
          {[
            { label: 'Twitch', href: 'https://twitch.tv/andryxify',           color: '#9146FF' },
            { label: 'YouTube', href: 'https://youtube.com/@ANDRYXify',        color: '#FF0000' },
            { label: 'Instagram', href: 'https://instagram.com/andryxify',    color: '#E1306C' },
            { label: 'TikTok', href: 'https://tiktok.com/@andryxify',         color: '#69C9D0' },
            { label: 'Podcast', href: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9', color: '#1DB954' },
          ].map(s => (
            <motion.a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', color: s.color, borderColor: s.color + '44' }}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.96 }}
            >
              {s.label}
            </motion.a>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
