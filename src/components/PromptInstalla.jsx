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

/**
 * Rotte dove PromptInstalla NON deve apparire perché ha un input/form
 * fissato in basso che verrebbe coperto dal bottom-sheet (z-index 1050).
 * Tipico problema su mobile dove il prompt copre l'input di scrittura
 * della chat e l'utente non riesce più a digitare.
 */
const ROUTE_SENZA_PROMPT = [
  '/chat',
  '/messaggi',
  '/community',
  '/mod-panel',
];

function rotteEscluse(pathname) {
  if (!pathname) return false;
  return ROUTE_SENZA_PROMPT.some(p => pathname === p || pathname.startsWith(p + '/'));
}

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
  const [pathname, setPathname] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  /* Tieni traccia della rotta corrente: nascondi sulle pagine con input
   * fissato in basso (chat, messaggi, community, mod-panel). React Router v7
   * non emette `popstate` sulle navigazioni interne, quindi monitoriamo sia
   * `popstate` (back/forward) sia patchando pushState/replaceState in modo
   * non invasivo: emettiamo un evento custom che ascoltiamo qui. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const aggiorna = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', aggiorna);

    // Wrap pushState/replaceState una volta sola (idempotente via flag globale).
    if (!window.__andryxNavWrapped) {
      window.__andryxNavWrapped = true;
      const orig = { push: history.pushState, replace: history.replaceState };
      history.pushState = function (...args) {
        const r = orig.push.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
        return r;
      };
      history.replaceState = function (...args) {
        const r = orig.replace.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
        return r;
      };
    }
    window.addEventListener('locationchange', aggiorna);
    return () => {
      window.removeEventListener('popstate', aggiorna);
      window.removeEventListener('locationchange', aggiorna);
    };
  }, []);

  /* Mostra dopo un piccolo delay, solo se davvero possiamo proporlo
   * E non siamo su una rotta esclusa (pagine con input fissato in basso). */
  useEffect(() => {
    if (!puoMostrareCard || rotteEscluse(pathname)) {
      setVisibile(false);
      return;
    }
    const id = setTimeout(() => setVisibile(true), MOSTRA_DOPO_MS);
    return () => clearTimeout(id);
  }, [puoMostrareCard, pathname]);

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
