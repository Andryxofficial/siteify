import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Clock, MessageCircle } from 'lucide-react';
import useIkigaiAgency from '../hooks/useIkigaiAgency';

export default function IkigaiAgencyToast() {
  const { advice, copy, close, later, quiet, ask } = useIkigaiAgency({
    onAskIkigai: (a) => {
      window.dispatchEvent(new CustomEvent('andryxify:ikigai:open-with', { detail: a }));
    },
  });

  return (
    <AnimatePresence>
      {advice && (
        <motion.aside
          className="ikigai-agency-toast glass-panel"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          role="status"
          aria-live="polite"
        >
          <div className="ikigai-agency-icon" aria-hidden="true"><Sparkles size={18} /></div>
          <div className="ikigai-agency-body">
            <strong>{advice.title}</strong>
            <p>{advice.text}</p>
            <div className="ikigai-agency-actions">
              <button type="button" onClick={ask}><MessageCircle size={15} /> {copy.ask}</button>
              <button type="button" onClick={later}><Clock size={15} /> {copy.later}</button>
              <button type="button" onClick={quiet}>30 min</button>
            </div>
          </div>
          <button type="button" className="ikigai-agency-close" onClick={close} aria-label={copy.close}>
            <X size={17} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
