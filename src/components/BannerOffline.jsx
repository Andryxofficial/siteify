/**
 * BannerOffline — Banner discreto mostrato quando l'utente perde la connessione.
 *
 * Comportamento:
 *  • Appare quando navigator.onLine diventa false (o il ping fallisce).
 *  • Mostra "Sei offline" + CTA "Gioca offline" che porta a /gioco
 *    (i giochi del mese sono cachati dal service worker e funzionano
 *    completamente senza rete).
 *  • Quando si torna online, mostra brevemente "Connessione ripristinata"
 *    poi sparisce dopo ~3 secondi.
 *  • Una sola istanza globale, posizionata sopra la tab bar mobile e in
 *    basso al centro su desktop. Riusa lo stile .update-toast esistente.
 */
import { useEffect, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Gamepad2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useReti } from '../contexts/RetiContext';
import { useLingua } from '../contexts/LinguaContext';

const DELAY_NASCONDI_RIPRISTINO_MS = 3000;

/* Stati possibili del banner.
   nascosto       online dall'inizio, niente da mostrare
   offline        connessione persa, banner rosso visibile
   ripristinato   connessione tornata, banner verde temporaneo */
function reducer(stato, azione) {
  switch (azione.tipo) {
    case 'andato-offline':
      return 'offline';
    case 'tornato-online':
      // Solo se eravamo offline mostriamo lo stato "ripristinato"
      return stato === 'offline' ? 'ripristinato' : 'nascosto';
    case 'fine-ripristino':
      return 'nascosto';
    default:
      return stato;
  }
}

export default function BannerOffline() {
  const { online } = useReti();
  const location = useLocation();
  const { t } = useLingua();
  const [stato, dispatch] = useReducer(
    reducer,
    online ? 'nascosto' : 'offline'
  );

  /* Quando online cambia, dispatcha l'azione corrispondente.
     Usare un reducer evita il pattern set-state-in-effect. */
  useEffect(() => {
    dispatch({ tipo: online ? 'tornato-online' : 'andato-offline' });
  }, [online]);

  /* Auto-nascondi dopo il messaggio di ripristino */
  useEffect(() => {
    if (stato !== 'ripristinato') return;
    const t = setTimeout(() => dispatch({ tipo: 'fine-ripristino' }), DELAY_NASCONDI_RIPRISTINO_MS);
    return () => clearTimeout(t);
  }, [stato]);

  const giàSulGioco = location.pathname.startsWith('/gioco');
  const visibile = stato !== 'nascosto';

  return (
    <AnimatePresence>
      {visibile && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="banner-offline"
          role="status"
          aria-live="polite"
        >
          {stato === 'ripristinato' ? (
            <>
              <Wifi size={15} className="banner-offline-icon banner-offline-icon-ok" aria-hidden="true" />
              <span>{t('offline.ripristinata')}</span>
            </>
          ) : (
            <>
              <WifiOff size={15} className="banner-offline-icon" aria-hidden="true" />
              <span>{t('offline.sei_offline')}</span>
              {!giàSulGioco && (
                <Link
                  to="/gioco"
                  className="banner-offline-cta"
                  aria-label={t('offline.aria.gioca')}
                >
                  <Gamepad2 size={13} /> {t('offline.gioca_offline')}
                </Link>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
