/**
 * ToastContext — Sistema di notifiche "magiche" per ANDRYXify.
 *
 * Stack di toast in basso a destra (in alto su mobile), con
 * animazioni spring, vetro liquido, auto-dismiss e pulsante chiudi.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Salvato!');
 *   toast.error('Qualcosa è andato storto', { titolo: 'Errore' });
 *   toast.info('In corso…', { durata: 0 }); // permanente
 *
 * I toast sono identificati da id e si possono rimuovere
 * programmaticamente: const id = toast.show(...); toast.dismiss(id);
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>');
  return ctx;
}

const ICONA_TIPO = {
  success: CheckCircle2,
  error:   AlertTriangle,
  warning: AlertCircle,
  info:    Info,
};

const COLORE_TIPO = {
  success: 'var(--accent-spotify)',
  error:   'var(--accent)',
  warning: 'var(--accent-warm)',
  info:    'var(--secondary)',
};

const SFONDO_TIPO = {
  success: 'rgba(29, 185, 84, 0.14)',
  error:   'rgba(255, 107, 107, 0.16)',
  warning: 'rgba(255, 184, 0, 0.16)',
  info:    'rgba(0, 229, 255, 0.14)',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((messaggio, opts = {}) => {
    const id = ++idRef.current;
    const tipo    = opts.tipo    || 'info';
    const titolo  = opts.titolo  || null;
    const durata  = opts.durata ?? 4200;
    const azione  = opts.azione  || null; // { etichetta, onClick }
    setToasts(prev => [...prev.slice(-4), { id, tipo, titolo, messaggio, azione }]);
    if (durata > 0) setTimeout(() => dismiss(id), durata);
    return id;
  }, [dismiss]);

  const valore = {
    show,
    dismiss,
    success: (msg, o = {}) => show(msg, { ...o, tipo: 'success' }),
    error:   (msg, o = {}) => show(msg, { ...o, tipo: 'error' }),
    warning: (msg, o = {}) => show(msg, { ...o, tipo: 'warning' }),
    info:    (msg, o = {}) => show(msg, { ...o, tipo: 'info' }),
  };

  return (
    <ToastContext.Provider value={valore}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const Icon = ICONA_TIPO[t.tipo] || Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.9 }}
                className="toast-item glass-card"
                style={{
                  borderColor: `${COLORE_TIPO[t.tipo]}55`,
                  background: `linear-gradient(135deg, ${SFONDO_TIPO[t.tipo]}, var(--surface-1))`,
                }}
                role={t.tipo === 'error' || t.tipo === 'warning' ? 'alert' : 'status'}
              >
                <div className="toast-icon" style={{ color: COLORE_TIPO[t.tipo] }}>
                  <Icon size={18} />
                </div>
                <div className="toast-body">
                  {t.titolo && <div className="toast-titolo">{t.titolo}</div>}
                  <div className="toast-msg">{t.messaggio}</div>
                </div>
                {t.azione && (
                  <button
                    className="toast-azione"
                    style={{ color: COLORE_TIPO[t.tipo] }}
                    onClick={() => { t.azione.onClick?.(); dismiss(t.id); }}
                  >
                    {t.azione.etichetta}
                  </button>
                )}
                <button
                  className="toast-chiudi"
                  onClick={() => dismiss(t.id)}
                  aria-label="Chiudi notifica"
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
