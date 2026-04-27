import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Twitch, Sparkles, Zap, Brain, Gamepad2,
  Lock, Mic, ArrowRight, Users, Share2,
} from 'lucide-react';
import { Youtube, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import TikTokIcon from '../components/TikTokIcon';
import DiscordIcon from '../components/DiscordIcon';
import { useLingua } from '../contexts/LinguaContext';
import { useToast } from '../contexts/ToastContext';
import { condividi, puoCondividere } from '../utils/condividi';
import { hapticLight } from '../utils/haptics';

const fade = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

function rispostaIndicaLive(testo) {
  const v = String(testo || '').trim().toLowerCase();
  if (!v) return false;
  return !(
    v.includes('offline') ||
    v.includes('not live') ||
    v.includes('is not streaming') ||
    v.includes('not streaming') ||
    v.includes('channel does not exist') ||
    v.includes('error')
  );
}

const SOCIAL = [
  { id: 'twitch',    icon: <Twitch      size={18} />, color: '#9146FF', url: 'https://twitch.tv/andryxify',                                  label: 'Twitch'    },
  { id: 'youtube',   icon: <Youtube     size={18} />, color: '#FF0000', url: 'https://youtube.com/@ANDRYXify',                                label: 'YouTube'   },
  { id: 'instagram', icon: <Instagram   size={18} />, color: '#E1306C', url: 'https://instagram.com/andryxify',                               label: 'Instagram' },
  { id: 'tiktok',    icon: <TikTokIcon  size={18} />, color: '#00F2FE', url: 'https://tiktok.com/@andryxify',                                 label: 'TikTok'    },
  { id: 'discord',   icon: <DiscordIcon size={18} />, color: '#5865F2', url: 'https://discord.gg/BuckKZ4',                                    label: 'Discord'   },
  { id: 'podcast',   icon: <Mic         size={18} />, color: '#1DB954', url: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9',          label: 'Podcast'   },
];

export default function Home() {
  const [liveState, setLiveState] = useState(null);
  const { t } = useLingua();
  const toast = useToast();

  useEffect(() => {
    let annullato = false;
    let timer = 0;

    const controllaLive = async () => {
      try {
        const res = await fetch(`https://decapi.me/twitch/uptime/andryxify?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { accept: 'text/plain' },
        });
        const testo = await res.text();
        if (!annullato) setLiveState(rispostaIndicaLive(testo) ? 1 : 0);
      } catch {
        if (!annullato) setLiveState(null);
      }
    };

    controllaLive();
    timer = window.setInterval(controllaLive, 60_000);

    return () => {
      annullato = true;
      window.clearInterval(timer);
    };
  }, []);

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

      {/* ── HERO ── */}
      <section className="hero-section hero-section-safe home-hero">
        <div className="hero-orb" aria-hidden="true" />

        <motion.h1 className="hero-title" {...fade(0)}>
          ANDRYX<span className="hero-title-ify">ify</span>
        </motion.h1>

        <motion.p className="subtitle" {...fade(0.08)}>
          {t('home.hero.sottotitolo_prefix')}{' '}
          <span className="home-accent-primary">{t('home.hero.umanita')}</span>,{' '}
          <span className="home-accent-secondary">{t('home.hero.ai')}</span>{' '}
          {t('home.hero.e')}{' '}
          <span className="home-accent-warm">{t('home.hero.gaming')}</span>.
        </motion.p>

        <motion.div className="home-chips-row" {...fade(0.16)}>
          {[
            { icon: <Sparkles size={13} />, label: t('home.chip.creator'),     cls: 'chip chip-home-primary'   },
            { icon: <Brain    size={13} />, label: t('home.chip.ai_explorer'), cls: 'chip chip-home-secondary' },
            { icon: <Zap      size={13} />, label: t('home.chip.gamer'),       cls: 'chip chip-home-warm'      },
          ].map(chip => (
            <motion.span
              key={chip.label}
              className={chip.cls}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {chip.icon} {chip.label}
            </motion.span>
          ))}
        </motion.div>

        <motion.div className="home-cta-row" {...fade(0.24)}>
          <a href="https://twitch.tv/andryxify" target="_blank" rel="noreferrer" className="btn btn-twitch">
            <Twitch size={15} /> {t('home.cta.seguimi')}
          </a>
          <Link to="/gioco" className="btn btn-ghost">
            <Gamepad2 size={15} /> {t('home.cta.gioca_ora')}
          </Link>
          {puoCondividere() && (
            <button type="button" onClick={onCondividi} className="btn btn-ghost btn-icona" aria-label={t('condividi.titolo')}>
              <Share2 size={15} />
            </button>
          )}
        </motion.div>
      </section>

      {/* ── BENTO GRID ── */}
      <motion.div className="home-bento" {...fade(0.30)}>

        {/* LIVE — full width */}
        <a
          href="https://twitch.tv/andryxify"
          target="_blank"
          rel="noreferrer"
          className="bento-tile bento-tile-live glass-panel"
        >
          <div className="bento-live-glow" aria-hidden="true" />
          <div className="bento-live-body">
            <div className="bento-live-top">
              <Twitch size={20} className="bento-live-icon" />
              <h2 className="bento-tile-title">{t('home.live.titolo')}</h2>
              {liveState === 1
                ? <span className="chip chip-live"><span className="chip-live-dot" />{t('home.live.live_ora')}</span>
                : liveState === 0
                  ? <span className="chip chip-offline">{t('home.live.offline')}</span>
                  : null}
            </div>
            <p className="bento-tile-sub">{t('home.live.sub')}</p>
            <span className="bento-cta">{t('home.live.apri')} <ArrowRight size={13} /></span>
          </div>
          <Twitch size={88} className="bento-live-bg" aria-hidden="true" />
        </a>

        {/* GIOCHI */}
        <Link to="/gioco" className="bento-tile bento-tile-games glass-card">
          <div className="bento-icon bento-icon-games"><Gamepad2 size={22} /></div>
          <h3 className="bento-tile-title">{t('home.bento.gioca')}</h3>
          <p className="bento-tile-sub">{t('home.bento.gioca_sub')}</p>
          <span className="bento-cta">{t('home.cta.gioca_ora')} <ArrowRight size={13} /></span>
        </Link>

        {/* COMMUNITY */}
        <Link to="/community" className="bento-tile bento-tile-community glass-card">
          <div className="bento-icon bento-icon-community"><Users size={22} /></div>
          <h3 className="bento-tile-title">{t('home.bento.community')}</h3>
          <p className="bento-tile-sub">{t('home.bento.community_sub')}</p>
          <span className="bento-cta">{t('home.bento.entra')} <ArrowRight size={13} /></span>
        </Link>

        {/* MESSAGGI */}
        <Link to="/messaggi" className="bento-tile bento-tile-msg glass-card">
          <div className="bento-icon bento-icon-msg"><Lock size={20} /></div>
          <h3 className="bento-tile-title">{t('home.bento.msg')}</h3>
          <p className="bento-tile-sub">{t('home.bento.msg_sub')}</p>
          <span className="bento-cta">{t('home.bento.scrivi')} <ArrowRight size={13} /></span>
        </Link>

        {/* PODCAST */}
        <a
          href="https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9"
          target="_blank"
          rel="noreferrer"
          className="bento-tile bento-tile-podcast glass-card"
        >
          <div className="bento-icon bento-icon-podcast"><Mic size={20} /></div>
          <h3 className="bento-tile-title">{t('podcastpromo.titolo')}</h3>
          <p className="bento-tile-sub">{t('home.bento.podcast_sub')}</p>
          <span className="bento-cta">{t('podcastpromo.cta.spotify')} <ArrowRight size={13} /></span>
        </a>

      </motion.div>

      {/* ── SOCIAL ROW ── */}
      <motion.div className="home-social-row" {...fade(0.42)}>
        {SOCIAL.map((s, i) => (
          <motion.a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill"
            style={{ '--pill-color': s.color }}
            aria-label={s.label}
            whileHover={{ scale: 1.07, y: -2 }}
            whileTap={{ scale: 0.93 }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.42 + i * 0.05, type: 'spring', stiffness: 300, damping: 22 }}
          >
            <span className="social-pill-icon" style={{ color: s.color }}>{s.icon}</span>
            <span className="social-pill-label">{s.label}</span>
          </motion.a>
        ))}
      </motion.div>

    </div>
  );
}
