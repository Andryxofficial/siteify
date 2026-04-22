/**
 * PromptInstalla — Bottom-sheet vetro che invita a installare la PWA.
 *
 * Comportamento:
 *  - Su Android/Chromium/Edge: usa `beforeinstallprompt` per il prompt nativo.
 *  - Su iOS Safari: mostra una guida visuale "Aggiungi a Home"
 *    (icona Condividi → "Aggiungi alla schermata Home"), perché iOS non
 *    espone API programmatiche.
 *  - In standalone (già installata): non mostra nulla.
 *  - Persistenza in `localStorage.andryxify_installa_stato` per evitare spam.
 *  - Ritardo iniziale di MOSTRA_DOPO_MS dopo il primo paint, così la
 *    homepage si carica senza overlay prima che l'utente abbia visto i contenuti.
 *
 * Cancellabile dall'utente con "Più tardi" (rimanda 7gg) o "X" (rifiuto definitivo).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, Plus, X } from 'lucide-react';
import useStatoInstallazione from '../hooks/useStatoInstallazione';
import { useLingua } from '../contexts/LinguaContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const MOSTRA_DOPO_MS = 8000;

export default function PromptInstalla() {
  const { t } = useLingua();
  const {
    piattaforma,
    puoMostrareCard,
    mostraPrompt,
    rimanda,
    rifiuta,
  } = useStatoInstallazione();
  const [visibile, setVisibile] = useState(false);

  /* Mostra dopo un piccolo delay, solo se davvero possiamo proporlo. */
  useEffect(() => {
    if (!puoMostrareCard) {
      const id = setTimeout(() => setVisibile(false), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setVisibile(true), MOSTRA_DOPO_MS);
    return () => clearTimeout(id);
  }, [puoMostrareCard]);

  const onInstalla = async () => {
    hapticLight();
    if (piattaforma === 'beforeinstallprompt') {
      const esito = await mostraPrompt();
      setVisibile(false);
      if (esito === 'accepted') hapticSuccess();
    }
    /* Su iOS resta visibile la guida; l'utente la chiude quando ha capito. */
  };

  const onRimanda = () => {
    hapticLight();
    rimanda();
    setVisibile(false);
  };

  const onRifiuta = () => {
    hapticLight();
    rifiuta();
    setVisibile(false);
  };

  if (!puoMostrareCard) return null;
  const èIOS = piattaforma === 'ios-safari';

  return (
    <AnimatePresence>
      {visibile && (
        <motion.div
          className="prompt-installa glass-panel"
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          role="dialog"
          aria-modal="false"
          aria-labelledby="prompt-installa-titolo"
        >
          <button
            type="button"
            className="prompt-installa-chiudi"
            onClick={onRifiuta}
            aria-label={t('installa.aria.chiudi')}
          >
            <X size={16} />
          </button>

          <div className="prompt-installa-corpo">
            <div className="prompt-installa-icona" aria-hidden="true">
              <img src="/pwa-192.png" alt="" width={48} height={48} />
            </div>
            <div className="prompt-installa-testi">
              <h3 id="prompt-installa-titolo" className="prompt-installa-titolo">
                {t('installa.titolo')}
              </h3>
              <p className="prompt-installa-descrizione">
                {èIOS ? t('installa.descrizione_ios') : t('installa.descrizione_android')}
              </p>
            </div>
          </div>

          {èIOS ? (
            <div className="prompt-installa-passi" aria-hidden="false">
              <div className="prompt-installa-passo">
                <span className="prompt-installa-passo-num">1</span>
                <span className="prompt-installa-passo-testo">
                  {t('installa.ios.passo1_prefix')} <Share size={14} aria-label="Condividi" /> {t('installa.ios.passo1_suffix')}
                </span>
              </div>
              <div className="prompt-installa-passo">
                <span className="prompt-installa-passo-num">2</span>
                <span className="prompt-installa-passo-testo">
                  {t('installa.ios.passo2_prefix')} <strong>“{t('installa.ios.aggiungi')}”</strong> <Plus size={14} aria-hidden="true" />
                </span>
              </div>
              <div className="prompt-installa-passo">
                <span className="prompt-installa-passo-num">3</span>
                <span className="prompt-installa-passo-testo">{t('installa.ios.passo3')}</span>
              </div>
            </div>
          ) : null}

          <div className="prompt-installa-azioni">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onRimanda}
            >
              {t('installa.piu_tardi')}
            </button>
            {!èIOS && (
              <button
                type="button"
                className="btn btn-primary prompt-installa-cta"
                onClick={onInstalla}
              >
                <Download size={16} />
                {t('installa.installa')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
