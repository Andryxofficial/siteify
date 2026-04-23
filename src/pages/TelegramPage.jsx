/**
 * TelegramPage — Hub di benvenuto per ANDRYXify come Telegram Mini App.
 *
 * Route: /telegram
 * Aperta quando l'utente avvia la Mini App dal bot (@AndryxBot) o
 * da un link diretto t.me/AndryxBot/app.
 *
 * Fuori da Telegram (browser normale) funziona comunque come pagina
 * di presentazione della Mini App con link al bot.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, MessageCircle, Users, Radio, Trophy, ExternalLink, Send } from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { hapticLight, hapticMedium } from '../utils/haptics';
import SEO from '../components/SEO';

const BOT_LINK = 'https://t.me/AndryxBot';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 240, damping: 26 },
});

/* Sezioni rapide accessibili dalla Mini App */
const SEZIONI = [
  {
    path:  '/gioco',
    icon:  Gamepad2,
    label: 'Gioca',
    desc:  'Legend, Jump e Gioco del Mese',
    color: 'var(--primary)',
    bg:    'rgba(224,64,251,0.12)',
    border:'rgba(224,64,251,0.22)',
  },
  {
    path:  '/socialify',
    icon:  Users,
    label: 'Community',
    desc:  'SOCIALify — post e discussioni',
    color: 'var(--secondary)',
    bg:    'rgba(0,229,255,0.10)',
    border:'rgba(0,229,255,0.20)',
  },
  {
    path:  '/chat',
    icon:  MessageCircle,
    label: 'Chat',
    desc:  'Chat pubblica in tempo reale',
    color: 'var(--accent-warm)',
    bg:    'rgba(255,184,108,0.10)',
    border:'rgba(255,184,108,0.20)',
  },
  {
    path:  '/twitch',
    icon:  Radio,
    label: 'Live',
    desc:  'Stream Twitch + chat embed',
    color: 'var(--accent-twitch)',
    bg:    'rgba(145,70,255,0.10)',
    border:'rgba(145,70,255,0.20)',
  },
];

export default function TelegramPage() {
  const navigate   = useNavigate();
  const { isTelegram, tgUser, haptic, mainButton } = useTelegram();
  const { isLoggedIn, twitchDisplay, twitchAvatar } = useTwitchAuth();

  const [classifica, setClassifica] = useState([]);
  const [live, setLive]             = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  /* Carica stato live e top 3 classifica */
  useEffect(() => {
    async function carica() {
      try {
        const [lbRes, liveData] = await Promise.allSettled([
          fetch('/api/leaderboard?game=monthly').then(r => r.json()),
          fetch('/api/profile?user=andryxify').then(r => r.json()),
        ]);
        if (lbRes.status === 'fulfilled' && lbRes.value?.general) {
          setClassifica(lbRes.value.general.slice(0, 3));
        }
        if (liveData.status === 'fulfilled' && liveData.value?.live) {
          setLive(liveData.value.live);
        }
      } catch { /* silent */ }
      finally { setCaricamento(false); }
    }
    carica();
  }, []);

  /* MainButton Telegram — "Gioca ora" */
  useEffect(() => {
    if (!isTelegram) return;
    mainButton.mostra('🎮 Gioca ora', () => {
      haptic.impact('medium');
      navigate('/gioco');
    });
    return () => mainButton.nascondi();
  }, [isTelegram, mainButton, haptic, navigate]);

  const onSezione = (path) => {
    hapticLight();
    if (isTelegram) haptic?.impact('light');
    navigate(path);
  };

  return (
    <div className="main-content tg-page" style={{ paddingTop: isTelegram ? '0.75rem' : '2rem' }}>
      <SEO
        title="ANDRYXify su Telegram"
        description="Apri ANDRYXify direttamente da Telegram. Gioca, chatta con la community e segui le live di Andryx."
        path="/telegram"
      />

      {/* ── Intestazione ── */}
      <motion.div className="tg-hero glass-panel" {...su(0)}>
        <div className="tg-hero__inner">
          <img
            src="/Firma_Andryx.png"
            alt="ANDRYXify"
            className="tg-logo"
          />
          <div>
            <h1 className="tg-titolo">ANDRYXify</h1>
            <p className="tg-claim">Streaming · Gaming · IA</p>
          </div>
        </div>

        {/* Stato live */}
        {!caricamento && live?.live && (
          <motion.div
            className="tg-live-badge"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <span className="tg-live-dot" />
            <span>LIVE — {live.gameName || 'In diretta'}</span>
            <span className="tg-live-count">{live.viewerCount} 👁</span>
          </motion.div>
        )}

        {/* Utente Telegram / Twitch */}
        {(tgUser || isLoggedIn) && (
          <div className="tg-utente">
            {twitchAvatar && (
              <img src={twitchAvatar} alt="" className="tg-utente__avatar" />
            )}
            <span className="tg-utente__nome">
              Ciao, {twitchDisplay || tgUser?.firstName || 'giocatore'}! 👋
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Sezioni rapide ── */}
      <motion.div className="tg-sezioni" {...su(0.06)}>
        {SEZIONI.map((s) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.path}
              className="tg-sezione-card"
              style={{ '--c': s.color, '--bg': s.bg, '--border': s.border }}
              onClick={() => { hapticMedium(); onSezione(s.path); }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <Icon size={24} style={{ color: s.color, flexShrink: 0 }} />
              <div className="tg-sezione-card__testo">
                <span className="tg-sezione-card__label">{s.label}</span>
                <span className="tg-sezione-card__desc">{s.desc}</span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* ── Top 3 classifica ── */}
      {classifica.length > 0 && (
        <motion.div className="tg-classifica glass-panel" {...su(0.12)}>
          <div className="tg-classifica__intestazione">
            <Trophy size={18} style={{ color: 'var(--accent-warm)' }} />
            <span>Classifica Generale</span>
          </div>
          <ol className="tg-classifica__lista">
            {classifica.map((e, i) => (
              <li key={e.username} className="tg-classifica__riga">
                <span className="tg-classifica__medaglia">
                  {['🥇','🥈','🥉'][i]}
                </span>
                <span className="tg-classifica__nome">{e.username}</span>
                <span className="tg-classifica__score">
                  {Number(e.score).toLocaleString('it-IT')} pt
                </span>
              </li>
            ))}
          </ol>
          <Link to="/gioco" className="tg-classifica__link" onClick={hapticLight}>
            Vedi classifica completa →
          </Link>
        </motion.div>
      )}

      {/* ── CTA fuori da Telegram: link al bot ── */}
      {!isTelegram && (
        <motion.div className="tg-cta-telegram glass-panel" {...su(0.18)}>
          <Send size={22} style={{ color: '#27A7E7', flexShrink: 0 }} />
          <div>
            <p className="tg-cta__titolo">Aprila su Telegram!</p>
            <p className="tg-cta__desc">
              Aggiungi il bot ANDRYXify e apri l&apos;app direttamente da Telegram —
              senza installare nulla.
            </p>
            <a
              href={BOT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ marginTop: '0.75rem', display: 'inline-flex', gap: '0.4rem' }}
              onClick={hapticMedium}
            >
              <ExternalLink size={15} /> Apri @AndryxBot
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
