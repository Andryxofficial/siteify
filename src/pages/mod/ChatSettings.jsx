/**
 * ChatSettings.jsx — Toggle live di Slow / Sub-Only / Follower-Only / Emote-Only / Unique chat.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Clock, Star, Heart, Smile, Hash, Loader, RefreshCw,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API = '/api/mod-moderation';

function Toggle({ attivo, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!attivo)}
      disabled={disabled}
      role="switch"
      aria-checked={attivo}
      className="chat-set-toggle"
      style={{ '--on': attivo ? 1 : 0 }}
    >
      <span className="chat-set-toggle-knob" />
    </button>
  );
}

const TOGGLES = [
  { chiave: 'slow_mode',           etichetta: 'Slow mode',     descr: 'Ritardo tra messaggi',   icon: Clock,  durataChiave: 'slow_mode_wait_time',           durataMin: 3,   durataMax: 120, durataDef: 5,  durataLabel: 'sec', color: 'var(--accent-warm)' },
  { chiave: 'follower_mode',       etichetta: 'Follower-only', descr: 'Solo follower in chat',  icon: Heart,  durataChiave: 'follower_mode_duration',         durataMin: 0,   durataMax: 525600, durataDef: 0, durataLabel: 'min', color: 'var(--accent)' },
  { chiave: 'subscriber_mode',     etichetta: 'Sub-only',      descr: 'Solo abbonati in chat',  icon: Star,   color: 'var(--accent-twitch)' },
  { chiave: 'emote_mode',          etichetta: 'Solo emote',    descr: 'Solo emote nei messaggi', icon: Smile, color: 'var(--accent-spotify)' },
  { chiave: 'unique_chat_mode',    etichetta: 'Unique chat',   descr: 'No messaggi duplicati',  icon: Hash,   color: 'var(--secondary)' },
];

export default function ChatSettings({ token }) {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [salvandoChiave, setSalvandoChiave] = useState('');

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}?action=chat_settings`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSettings(d.settings || {});
    } catch (e) { toast.error(e.message, { titolo: 'Caricamento chat' }); }
    finally    { setLoading(false); }
  }, [token, toast]);

  useEffect(() => { carica(); }, [carica]);

  const salva = useCallback(async (patch, etichetta) => {
    setSalvandoChiave(Object.keys(patch)[0]);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'chat_settings', settings: patch }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSettings(d.settings);
      if (etichetta) toast.success(etichetta);
    } catch (e) { toast.error(e.message, { titolo: 'Aggiornamento fallito' }); }
    finally    { setSalvandoChiave(''); }
  }, [token, toast]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '1.5rem' }}>
      <Loader size={20} className="spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  return (
    <motion.div className="glass-panel" style={{ padding: '1.25rem' }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Settings size={15} style={{ color: 'var(--secondary)' }} />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1 }}>Impostazioni chat live</h3>
        <button className="mod-icon-btn" onClick={carica} title="Aggiorna"><RefreshCw size={13} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
        {TOGGLES.map(t => {
          const Icon = t.icon;
          const attivo  = !!settings?.[t.chiave];
          const inLavoro = salvandoChiave === t.chiave || salvandoChiave === t.durataChiave;
          const valoreDurata = (t.durataChiave && settings?.[t.durataChiave]) || t.durataDef;
          return (
            <div key={t.chiave} className="glass-card chat-set-row"
              style={{ padding: '0.75rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                opacity: inLavoro ? 0.7 : 1 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${t.color}1f`, color: t.color, flexShrink: 0,
              }}>
                <Icon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.etichetta}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{t.descr}</div>
                {/* Durata mini-input se attivo e ha durata */}
                {attivo && t.durataChiave && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <input type="number"
                      className="mod-input mod-input-small"
                      value={valoreDurata}
                      min={t.durataMin} max={t.durataMax}
                      onChange={e => {
                        const v = Math.max(t.durataMin, Math.min(t.durataMax, parseInt(e.target.value) || 0));
                        setSettings(prev => ({ ...prev, [t.durataChiave]: v }));
                      }}
                      onBlur={e => {
                        const v = Math.max(t.durataMin, Math.min(t.durataMax, parseInt(e.target.value) || 0));
                        salva({ [t.durataChiave]: v }, 'Durata aggiornata');
                      }}
                      style={{ width: 64, marginTop: 0, padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                    />
                    <span>{t.durataLabel}</span>
                  </div>
                )}
              </div>
              <Toggle attivo={attivo} disabled={inLavoro}
                onChange={(v) => salva({ [t.chiave]: v }, `${t.etichetta} ${v ? 'attivo' : 'disattivato'}`)} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
