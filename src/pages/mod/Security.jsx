/**
 * Security.jsx — Strumenti di sicurezza e moderazione avanzata.
 *
 * 4 sezioni:
 *   1. Shield Mode: toggle ON/OFF con stato pulsante + banner red quando attivo
 *   2. AutoMod settings: slider 0-4 per overall_level + 7 categorie
 *   3. Blocked Terms: lista termini bloccati + add/remove
 *   4. Unban Requests: lista richieste in pending con approve/deny
 *   5. Warnings History: cronologia avvisi inviati (read-only)
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldX, Shield, AlertTriangle, Plus, Trash2, Loader,
  Check, X, Clock, AlertCircle, RefreshCw, Info, Ban,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet, modPost } from '../../utils/modApi';

const AUTOMOD_CATEGORIES = [
  { key: 'aggression',                label: 'Aggressività' },
  { key: 'bullying',                  label: 'Bullismo' },
  { key: 'disability',                label: 'Discriminazione disabilità' },
  { key: 'misogyny',                  label: 'Misoginia' },
  { key: 'race_ethnicity_or_religion',label: 'Razzismo/Etnia/Religione' },
  { key: 'sex_based_terms',           label: 'Termini sessuali' },
  { key: 'sexuality_sex_or_gender',   label: 'Sessualità/Sesso/Genere' },
  { key: 'swearing',                  label: 'Parolacce' },
];

export default function Security({ token }) {
  const toast = useToast();

  // Shield Mode
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldLoading, setShieldLoading] = useState(true);

  // AutoMod
  const [automodSettings, setAutomodSettings] = useState(null);
  const [automodLoading, setAutomodLoading] = useState(true);
  const [automodSaving, setAutomodSaving] = useState(false);

  // Blocked Terms
  const [blockedTerms, setBlockedTerms] = useState([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termInput, setTermInput] = useState('');
  const [termAdding, setTermAdding] = useState(false);
  const [termRemoving, setTermRemoving] = useState(null);

  // Unban Requests
  const [unbanRequests, setUnbanRequests] = useState([]);
  const [unbanLoading, setUnbanLoading] = useState(true);
  const [unbanProcessing, setUnbanProcessing] = useState(null);

  // Warnings History
  const [warnings, setWarnings] = useState([]);
  const [warningsLoading, setWarningsLoading] = useState(true);

  /* ─── SHIELD MODE ─── */
  const loadShield = useCallback(async () => {
    setShieldLoading(true);
    const r = await modGet('/api/mod-moderation?action=shield_mode', token);
    if (r.ok) {
      setShieldActive(r.data?.status?.is_active || false);
    } else {
      toast.error(r.error, { titolo: 'Shield Mode' });
    }
    setShieldLoading(false);
  }, [token, toast]);

  const toggleShield = useCallback(async () => {
    const nuovoStato = !shieldActive;
    setShieldLoading(true);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'shield_mode',
      active: nuovoStato,
    });
    if (r.ok) {
      setShieldActive(nuovoStato);
      toast.success(nuovoStato ? 'Shield Mode attivato!' : 'Shield Mode disattivato.', {
        titolo: '🛡️ Shield Mode',
      });
    } else {
      toast.error(r.error, { titolo: 'Shield Mode' });
    }
    setShieldLoading(false);
  }, [token, toast, shieldActive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShield();
  }, [loadShield]);

  /* ─── AUTOMOD SETTINGS ─── */
  const loadAutomod = useCallback(async () => {
    setAutomodLoading(true);
    const r = await modGet('/api/mod-moderation?action=automod_settings', token);
    if (r.ok && r.data?.settings) {
      setAutomodSettings(r.data.settings);
    } else {
      toast.error(r.error || 'Impossibile caricare AutoMod.', { titolo: 'AutoMod' });
    }
    setAutomodLoading(false);
  }, [token, toast]);

  const saveAutomod = useCallback(async () => {
    if (!automodSettings) return;
    setAutomodSaving(true);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'automod_settings',
      settings: automodSettings,
    });
    if (r.ok) {
      toast.success('Impostazioni AutoMod salvate!', { titolo: '✅ AutoMod' });
    } else {
      toast.error(r.error, { titolo: 'Salvataggio AutoMod' });
    }
    setAutomodSaving(false);
  }, [token, toast, automodSettings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAutomod();
  }, [loadAutomod]);

  /* ─── BLOCKED TERMS ─── */
  const loadBlockedTerms = useCallback(async () => {
    setTermsLoading(true);
    const r = await modGet('/api/mod-moderation?action=blocked_terms', token);
    if (r.ok) {
      setBlockedTerms(r.data?.terms || []);
    } else {
      toast.error(r.error, { titolo: 'Termini Bloccati' });
    }
    setTermsLoading(false);
  }, [token, toast]);

  const addBlockedTerm = useCallback(async () => {
    if (!termInput.trim()) return;
    setTermAdding(true);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'blocked_term_add',
      text: termInput.trim(),
    });
    if (r.ok) {
      toast.success(`Termine "${termInput.trim()}" bloccato.`, { titolo: '🚫 Bloccato' });
      setTermInput('');
      await loadBlockedTerms();
    } else {
      toast.error(r.error, { titolo: 'Aggiungi termine' });
    }
    setTermAdding(false);
  }, [token, toast, termInput, loadBlockedTerms]);

  const removeBlockedTerm = useCallback(async (id, text) => {
    setTermRemoving(id);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'blocked_term_remove',
      id,
    });
    if (r.ok) {
      toast.success(`Termine "${text}" rimosso.`);
      await loadBlockedTerms();
    } else {
      toast.error(r.error, { titolo: 'Rimozione termine' });
    }
    setTermRemoving(null);
  }, [token, toast, loadBlockedTerms]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBlockedTerms();
  }, [loadBlockedTerms]);

  /* ─── UNBAN REQUESTS ─── */
  const loadUnbanRequests = useCallback(async () => {
    setUnbanLoading(true);
    const r = await modGet('/api/mod-moderation?action=unban_requests&status=pending', token);
    if (r.ok) {
      setUnbanRequests(r.data?.requests || []);
    } else {
      toast.error(r.error, { titolo: 'Unban Requests' });
    }
    setUnbanLoading(false);
  }, [token, toast]);

  const handleUnbanRequest = useCallback(async (req, status) => {
    setUnbanProcessing(req.id);
    const r = await modPost('/api/mod-moderation', token, {
      action: 'unban_request',
      id: req.id,
      status,
    });
    if (r.ok) {
      toast.success(`Richiesta di ${req.user_login} ${status === 'approved' ? 'approvata' : 'negata'}.`, {
        titolo: status === 'approved' ? '✅ Graziato' : '❌ Negato',
      });
      await loadUnbanRequests();
    } else {
      toast.error(r.error, { titolo: 'Unban Request' });
    }
    setUnbanProcessing(null);
  }, [token, toast, loadUnbanRequests]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUnbanRequests();
  }, [loadUnbanRequests]);

  /* ─── WARNINGS HISTORY ─── */
  const loadWarnings = useCallback(async () => {
    setWarningsLoading(true);
    const r = await modGet('/api/mod-moderation?action=warnings_history', token);
    if (r.ok) {
      setWarnings(r.data?.items || []);
    } else {
      toast.error(r.error, { titolo: 'Cronologia Avvisi' });
    }
    setWarningsLoading(false);
  }, [token, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWarnings();
  }, [loadWarnings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1 }}>
          <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent)' }} />
          Sicurezza e AutoMod
        </h2>
      </div>

      {/* Shield Mode */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={15} style={{ color: 'var(--accent)' }} />
          Shield Mode
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
          Attiva temporaneamente protezioni extra contro raid e harassment: limita la chat a follower e sub verificati.
        </p>
        {shieldActive && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{
              padding: '0.65rem 0.85rem',
              marginBottom: '0.75rem',
              borderColor: 'rgba(255,107,107,0.4)',
              background: 'linear-gradient(135deg, rgba(255,107,107,0.12), rgba(255,184,108,0.06))',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse-red 1.5s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>
              Shield Mode ATTIVO
            </span>
          </motion.div>
        )}
        <button
          className={shieldActive ? 'btn-primary btn-tonal-danger' : 'btn-primary'}
          onClick={toggleShield}
          disabled={shieldLoading}
          style={{ fontSize: '0.85rem' }}
        >
          {shieldLoading ? <Loader size={14} className="spin" /> : shieldActive ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
          {shieldActive ? 'Disattiva Shield Mode' : 'Attiva Shield Mode'}
        </button>
      </div>

      {/* AutoMod Settings */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={15} style={{ color: 'var(--accent-twitch)' }} />
          AutoMod Impostazioni
        </h3>
        {automodLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Loader size={24} className="spin" style={{ color: 'var(--accent-twitch)' }} />
          </div>
        ) : automodSettings ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                <span>Livello Generale</span>
                <span style={{ fontSize: '1rem', color: 'var(--primary)' }}>{automodSettings.overall_level}</span>
              </label>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={automodSettings.overall_level ?? 0}
                onChange={e => setAutomodSettings({ ...automodSettings, overall_level: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                <span>0 OFF</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4 MAX</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
              {AUTOMOD_CATEGORIES.map(cat => (
                <label key={cat.key} style={{ fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 500 }}>{cat.label}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{automodSettings[cat.key] ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={automodSettings[cat.key] ?? 0}
                    onChange={e => setAutomodSettings({ ...automodSettings, [cat.key]: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-twitch)' }}
                  />
                </label>
              ))}
            </div>
            <button
              className="btn-primary"
              onClick={saveAutomod}
              disabled={automodSaving}
              style={{ fontSize: '0.85rem' }}
            >
              {automodSaving ? <Loader size={13} className="spin" /> : <Check size={13} />}
              Salva impostazioni
            </button>
          </>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Impossibile caricare AutoMod.</p>
        )}
      </div>

      {/* Blocked Terms */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
            <Ban size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent)' }} />
            Termini Bloccati
          </h3>
          <button className="mod-icon-btn" onClick={loadBlockedTerms} title="Aggiorna">
            <RefreshCw size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <input
            className="mod-input"
            value={termInput}
            onChange={e => setTermInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBlockedTerm()}
            placeholder="Aggiungi termine da bloccare"
            maxLength={500}
            style={{ flex: 1, marginTop: 0 }}
          />
          <button
            className="btn-primary"
            onClick={addBlockedTerm}
            disabled={termAdding || !termInput.trim()}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            {termAdding ? <Loader size={13} className="spin" /> : <Plus size={13} />}
          </button>
        </div>
        {termsLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Loader size={22} className="spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : blockedTerms.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            Nessun termine bloccato al momento.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {blockedTerms.map(term => (
              <div key={term.id} className="glass-card" style={{ padding: '0.5rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'monospace' }}>{term.text}</span>
                <button
                  className="mod-icon-btn mod-icon-btn-danger"
                  onClick={() => removeBlockedTerm(term.id, term.text)}
                  disabled={termRemoving === term.id}
                  title="Rimuovi"
                >
                  {termRemoving === term.id ? <Loader size={12} className="spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unban Requests */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
            <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-warm)' }} />
            Richieste Unban
          </h3>
          <button className="mod-icon-btn" onClick={loadUnbanRequests} title="Aggiorna">
            <RefreshCw size={13} />
          </button>
        </div>
        {unbanLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Loader size={22} className="spin" style={{ color: 'var(--accent-warm)' }} />
          </div>
        ) : unbanRequests.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            Nessuna richiesta in pending.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {unbanRequests.map(req => (
              <div key={req.id} className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{req.user_login}</span>
                  <span className="chip" style={{ fontSize: '0.68rem' }}>
                    <Clock size={10} /> {new Date(req.created_at).toLocaleDateString('it-IT')}
                  </span>
                </div>
                {req.text && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.65rem', lineHeight: 1.4 }}>
                    "{req.text}"
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn-primary btn-tonal-success"
                    onClick={() => handleUnbanRequest(req, 'approved')}
                    disabled={unbanProcessing === req.id}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
                  >
                    {unbanProcessing === req.id ? <Loader size={12} className="spin" /> : <Check size={12} />}
                    Approva
                  </button>
                  <button
                    className="btn-primary btn-tonal-danger"
                    onClick={() => handleUnbanRequest(req, 'denied')}
                    disabled={unbanProcessing === req.id}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
                  >
                    {unbanProcessing === req.id ? <Loader size={12} className="spin" /> : <X size={12} />}
                    Nega
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings History */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
            <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-spotify)' }} />
            Cronologia Avvisi
          </h3>
          <button className="mod-icon-btn" onClick={loadWarnings} title="Aggiorna">
            <RefreshCw size={13} />
          </button>
        </div>
        {warningsLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Loader size={22} className="spin" style={{ color: 'var(--accent-spotify)' }} />
          </div>
        ) : warnings.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            Nessun avviso emesso ancora.
          </p>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {warnings.map((w, i) => (
              <div key={i} className="glass-card" style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                <AlertCircle size={13} style={{ color: 'var(--accent-warm)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{w.target_login}</span>
                  {w.reason && <span style={{ color: 'var(--text-muted)' }}> — {w.reason}</span>}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {w.mod_login}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {new Date(w.ts).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
