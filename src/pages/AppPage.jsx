/**
 * AppPage — Pagina "store-like" per spiegare e proporre l'installazione
 * della PWA. Adatta il bottone install alla piattaforma:
 *  - Android/Chromium/Edge: chiama `beforeinstallprompt` direttamente
 *  - iOS Safari: mostra una guida visuale
 *  - Browser non supportati: mostra il QR code da scansionare col telefono
 *
 * Include: icona, claim, chips, lista feature, QR code (libreria `qrcode`
 * già presente nelle deps), changelog leggibile.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Gamepad2, Wifi, Zap, Download, Check, Share, Plus } from 'lucide-react';
import useStatoInstallazione from '../hooks/useStatoInstallazione';
import { useLingua } from '../contexts/LinguaContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import SEO from '../components/SEO';

const URL_APP = 'https://andryxify.it/';

/* Lista changelog statica — si aggiorna di rilascio in rilascio. */
const NOVITA = [
  { it: 'Esperienza nativa: tap, swipe-back, theme-color contestuale.',
    en: 'Native feel: tap, swipe-back, contextual theme color.',
    es: 'Experiencia nativa: tap, swipe-back, theme-color contextual.' },
  { it: 'Andryx Jump (platformer 2D, 10 mondi).',
    en: 'Andryx Jump (2D platformer, 10 worlds).',
    es: 'Andryx Jump (plataformas 2D, 10 mundos).' },
  { it: 'Andryx Legend con renderer pixel-art Minish-Cap-style.',
    en: 'Andryx Legend with Minish-Cap-style pixel-art renderer.',
    es: 'Andryx Legend con renderer pixel-art estilo Minish Cap.' },
  { it: 'Notifiche push, badge sull\'icona, share di sistema.',
    en: 'Push notifications, app icon badge, system share.',
    es: 'Notificaciones push, badge en el icono, compartir del sistema.' },
];

export default function AppPage() {
  const { t, lingua } = useLingua();
  const {
    piattaforma,
    giàInstallata,
    mostraPrompt,
  } = useStatoInstallazione();
  const qrRef = useRef(null);
  const [qrPronto, setQrPronto] = useState(false);

  /* Genera il QR code lato client. La libreria `qrcode` è già in deps,
     la importiamo dinamicamente per non pesare sul bundle iniziale. */
  useEffect(() => {
    let smontato = false;
    import('qrcode').then(({ default: QRCode }) => {
      if (smontato || !qrRef.current) return;
      QRCode.toCanvas(qrRef.current, URL_APP, {
        width: 176,
        margin: 1,
        color: { dark: '#050506', light: '#ffffff' },
      }, (err) => { if (!err) setQrPronto(true); });
    }).catch(() => { /* libreria non disponibile, ignoriamo */ });
    return () => { smontato = true; };
  }, []);

  const onInstalla = async () => {
    hapticLight();
    if (piattaforma === 'beforeinstallprompt') {
      const r = await mostraPrompt();
      if (r === 'accepted') hapticSuccess();
    }
  };

  const FEATURES = [
    { Icon: Bell,     titolo: t('app.feature.live.titolo'),    desc: t('app.feature.live.descrizione') },
    { Icon: Gamepad2, titolo: t('app.feature.gioco.titolo'),   desc: t('app.feature.gioco.descrizione') },
    { Icon: Wifi,     titolo: t('app.feature.offline.titolo'), desc: t('app.feature.offline.descrizione') },
    { Icon: Zap,      titolo: t('app.feature.veloce.titolo'),  desc: t('app.feature.veloce.descrizione') },
  ];

  return (
    <div className="app-page">
      <SEO
        title={t('app.titolo')}
        description={t('app.claim')}
        path="/app"
      />

      {/* ── Hero stile App Store ── */}
      <motion.section
        className="app-hero glass-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <div className="app-hero-icona">
          <img src="/pwa-512.png" alt="ANDRYXify" />
        </div>
        <div className="app-hero-meta">
          <h1 className="app-hero-nome">ANDRYXify</h1>
          <p className="app-hero-claim">{t('app.claim')}</p>
          <div className="app-hero-chips">
            <span className="app-hero-chip">{t('app.chip.gratis')}</span>
            <span className="app-hero-chip">{t('app.chip.no_pubblicita')}</span>
            <span className="app-hero-chip">{t('app.chip.privacy')}</span>
          </div>
        </div>
      </motion.section>

      {/* ── Azione principale: install / stato ── */}
      <section className="app-azioni">
        {giàInstallata ? (
          <span className="app-stato">
            <Check size={16} /> {t('app.gia_installata')}
          </span>
        ) : piattaforma === 'beforeinstallprompt' ? (
          <button type="button" className="btn btn-primary prompt-installa-cta" onClick={onInstalla}>
            <Download size={16} /> {t('app.installa_ora')}
          </button>
        ) : piattaforma === 'ios-safari' ? (
          <span className="app-stato" style={{ background: 'rgba(0, 229, 255, 0.10)', borderColor: 'rgba(0, 229, 255, 0.28)' }}>
            <Share size={14} /> {t('app.guida_ios')} <Plus size={14} aria-hidden="true" />
          </span>
        ) : null}
      </section>

      {/* ── Feature grid ── */}
      <section className="app-features">
        {FEATURES.map(({ Icon, titolo, desc }) => (
          <motion.div
            key={titolo}
            className="app-feature glass-card"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <span className="app-feature-icon"><Icon size={20} /></span>
            <h3 className="app-feature-titolo">{titolo}</h3>
            <p className="app-feature-descrizione">{desc}</p>
          </motion.div>
        ))}
      </section>

      {/* ── QR per aprirla sul telefono ── */}
      <section className="app-qr glass-panel">
        <div className="app-qr-canvas">
          <canvas ref={qrRef} aria-label="QR code andryxify.it" />
          {!qrPronto && (
            <span style={{ color: '#888', fontSize: 12 }}>QR…</span>
          )}
        </div>
        <div>
          <h2 className="app-qr-titolo">{t('app.qr.titolo')}</h2>
          <p className="app-qr-testo">{t('app.qr.testo')}</p>
        </div>
      </section>

      {/* ── Cosa c'è di nuovo ── */}
      <section className="app-novita glass-panel">
        <h2 className="app-novita-titolo">{t('app.novita.titolo')}</h2>
        <ul className="app-novita-lista">
          {NOVITA.map((n, i) => <li key={i}>{n[lingua] || n.it}</li>)}
        </ul>
      </section>
    </div>
  );
}
