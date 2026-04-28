/**
 * ShieldModeModal.jsx — Popup di selezione modalità scudo.
 *
 * Mostra 4 preset di protezione quando si attiva Shield Mode:
 *   • Solo Scudo     → solo Shield Mode ON
 *   • Scudo+Follower → Shield Mode + follower-only (10 min)
 *   • Scudo+Sub      → Shield Mode + subscriber-only
 *   • Protezione Max → Shield Mode + subscriber-only + emote-only
 *
 * Usato sia da Security.jsx sia da QuickActions.jsx.
 * Supporta temi chiaro/scuro (CSS vars) e i18n IT/EN/ES.
 *
 * Props:
 *   token    — Bearer token Twitch del mod loggato
 *   onClose  — callback al chiudi/annulla
 *   onDone   — callback(shieldActive: boolean) dopo successo
 */
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldX, Users, Star, Lock, X, Loader, Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modPost } from '../../utils/modApi';
import { useLingua } from '../../contexts/LinguaContext';

const MOD_API = '/api/mod-moderation';

/* Definizione preset — chat_settings null = nessuna modifica chat aggiuntiva */
const PRESET_IDS = ['base', 'follower', 'sub', 'max'];

const PRESET_META = {
  base:     { icon: ShieldCheck, accento: 'var(--accent)',         chat: null },
  follower: { icon: Users,       accento: 'var(--primary)',        chat: { follower_mode: true, follower_mode_duration: 10 } },
  sub:      { icon: Star,        accento: 'var(--accent-twitch)',  chat: { subscriber_mode: true } },
  max:      { icon: Lock,        accento: '#ef4444',               chat: { subscriber_mode: true, emote_mode: true } },
};

export default function ShieldModeModal({ token, onClose, onDone }) {
  const toast = useToast();
  const { t } = useLingua();

  const [selezionato, setSelezionato] = useState('base');
  const [caricamento, setCaricamento] = useState(false);

  const attiva = useCallback(async () => {
    setCaricamento(true);
    try {
      /* 1. Attiva Shield Mode */
      const rShield = await modPost(MOD_API, token, { action: 'shield_mode', active: true });
      if (!rShield.ok) {
        toast.error(rShield.error, { titolo: '🛡️ Shield Mode' });
        return;
      }

      /* 2. Applica chat settings aggiuntive se il preset le prevede */
      const preset = PRESET_META[selezionato];
      if (preset?.chat) {
        const rChat = await modPost(MOD_API, token, {
          action: 'chat_settings',
          settings: preset.chat,
        });
        if (!rChat.ok) {
          /* Shield già attivo, ma le impostazioni chat hanno fallito — avvisa ma non bloccare */
          toast.error(rChat.error || 'Impostazioni chat non applicate.', {
            titolo: '⚠️ Chat Settings',
          });
        }
      }

      toast.success(t('mod.shield.attivato'), { titolo: '🛡️ Shield Mode' });
      onDone?.(true);
      onClose();
    } finally {
      setCaricamento(false);
    }
  }, [token, selezionato, toast, t, onDone, onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="quick-action-modale-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('mod.shield.titolo')}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="quick-action-modale glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ borderTop: '2px solid var(--accent)' }}
      >
        {/* Intestazione */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <span style={{
            width: 34, height: 34, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(var(--accent-rgb,255,107,107),0.12)',
            color: 'var(--accent)',
          }}>
            <ShieldCheck size={18} />
          </span>
          <h3 style={{ flex: 1, fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            {t('mod.shield.titolo')}
          </h3>
          <button className="mod-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={14} />
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.45 }}>
          {t('mod.shield.sottotitolo')}
        </p>

        {/* Selezione preset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
          {PRESET_IDS.map(id => {
            const meta   = PRESET_META[id];
            const Icona  = meta.icon;
            const attivo = selezionato === id;
            return (
              <button
                key={id}
                onClick={() => setSelezionato(id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--r-sm)',
                  border: attivo
                    ? `1.5px solid ${meta.accento}`
                    : '1.5px solid var(--vetro-bordo-color, rgba(130,170,240,0.14))',
                  background: attivo
                    ? `color-mix(in srgb, ${meta.accento} 12%, transparent)`
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  width: '100%',
                }}
                aria-pressed={attivo}
              >
                {/* Icona + radio dot */}
                <span style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `color-mix(in srgb, ${meta.accento} 18%, transparent)`,
                  color: meta.accento,
                }}>
                  <Icona size={16} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{
                      fontSize: '0.88rem', fontWeight: 700,
                      color: attivo ? meta.accento : 'var(--text-main)',
                    }}>
                      {t(`mod.shield.mode.${id}.label`)}
                    </span>
                    {attivo && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: '50%',
                        background: meta.accento, color: '#fff', flexShrink: 0,
                      }}>
                        <Check size={10} />
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 2 }}>
                    {t(`mod.shield.mode.${id}.desc`)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Nota chat settings (solo per preset con restrizioni aggiuntive) */}
        <AnimatePresence>
          {selezionato !== 'base' && (
            <motion.p
              key="nota"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                fontSize: '0.71rem', color: 'var(--text-faint)',
                lineHeight: 1.5, marginBottom: '1rem', overflow: 'hidden',
                padding: '0.45rem 0.65rem',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              ℹ️ {t('mod.shield.nota_chat')}
            </motion.p>
          )}
        </AnimatePresence>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-primary"
            onClick={attiva}
            disabled={caricamento}
            style={{ flex: 1, fontSize: '0.9rem', padding: '0.6rem' }}
          >
            {caricamento
              ? <Loader size={14} className="spin" />
              : <ShieldCheck size={14} />}
            {t('mod.shield.conferma')}
          </button>
          <button
            className="btn-ghost"
            onClick={onClose}
            disabled={caricamento}
            style={{ fontSize: '0.85rem', padding: '0.6rem 1rem' }}
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/**
 * ModaleDisattivaScudo — semplice confirm inline per disattivare Shield Mode.
 * Usato come alternativa leggera senza bisogno di selezione preset.
 */
// eslint-disable-next-line react-refresh/only-export-components -- hook esportato accanto al modale per riuso quick-action
export function useDisattivaScudo({ token, onDone }) {
  const toast = useToast();
  const { t } = useLingua();

  return useCallback(async () => {
    const r = await modPost(MOD_API, token, { action: 'shield_mode', active: false });
    if (r.ok) {
      toast.success(t('mod.shield.disattivato'), { titolo: '🛡️ Shield Mode' });
      onDone?.(false);
    } else {
      toast.error(r.error, { titolo: '🛡️ Shield Mode' });
    }
  }, [token, toast, t, onDone]);
}
