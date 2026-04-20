/**
 * MessagesPage — E2E encrypted messaging, full app.
 *
 * Route: /messaggi
 * Crypto: ECDH P-256 + AES-GCM-256
 * Cross-device: passphrase (PBKDF2) or passkey (WebAuthn PRF)
 * Once unlocked, keys are cached in IndexedDB — no repeated prompts.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Send, ArrowLeft, ArrowDown, MessageSquare, Users, LogIn,
  Loader, Shield, Clock, AlertTriangle, Pencil, Trash2, X, Plus,
  Image as ImageIcon, Check, RefreshCw, Bell,
  KeyRound, ChevronDown, Search, Fingerprint, Key,
  Copy, CornerUpRight,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNotifiche } from '../hooks/useNotifiche';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import SEO from '../components/SEO';
import {
  importPublicKey, deriveKey,
  encryptMessage, decryptMessage,
  encryptBytes, decryptBytes,
  isPasskeyPRFAvailable,
} from '../utils/e2eKeys';

const API_URL = '/api/messages';
const FRIENDS_API = '/api/friends';
const POLL_ACTIVE = 1500;
const POLL_HIDDEN = 6000;
const MAX_FILE_BYTES = 8_000_000;
const LONG_PRESS_DURATION = 450;
const DERIVE_RETRY_DELAY_MS = 600;
const MAX_MEDIA_B64 = 1_100_000;
const NOTIF_PREFS_KEY = 'andryxify_msg_notif_prefs';

/* Chiavi localStorage per il tracciamento dei messaggi non letti */
const CHIAVE_ULTIMA_LETTURA = 'andryxify_msg_ultima_lettura';
const CHIAVE_HA_NON_LETTI   = 'andryxify_ha_non_letti';

function safeBlobUrl(url) {
  return typeof url === 'string' && url.startsWith('blob:') ? url : '';
}

async function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const r = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Compressione fallita')),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida')); };
    img.src = url;
  });
}

/* ── Helpers ── */
const entrata = (d = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: d, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoMsg(ts) {
  const d = new Date(Number(ts));
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function tempoRelativo(ts) {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore}h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 7) return `${giorni}g fa`;
  return new Date(Number(ts)).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function dateSeparatorLabel(ts) {
  const d = new Date(Number(ts));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - msgDay) / 86400000);
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return d.toLocaleDateString('it-IT', { weekday: 'long' });
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

function getNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)) || { inApp: true, push: true, sound: true, muted: [] }; }
  catch { return { inApp: true, push: true, sound: true, muted: [] }; }
}
function saveNotifPrefs(p) { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); }

/* ── Helpers per i messaggi non letti ── */

/* Legge la mappa "ultima lettura" dal localStorage: { "utente:amico": timestamp } */
function leggiUltimaLettura() {
  try { return JSON.parse(localStorage.getItem(CHIAVE_ULTIMA_LETTURA)) || {}; }
  catch { return {}; }
}

/* Salva il timestamp di ultima lettura per una conversazione */
function salvaUltimaLettura(me, amico, ts) {
  const dati = leggiUltimaLettura();
  dati[`${me}:${amico}`] = ts;
  localStorage.setItem(CHIAVE_ULTIMA_LETTURA, JSON.stringify(dati));
}

/* Notifica la Navbar (e le altre schede) del cambiamento dello stato non-letti */
function notificaNonLetti(haNonLetti) {
  if (haNonLetti) {
    localStorage.setItem(CHIAVE_HA_NON_LETTI, '1');
  } else {
    localStorage.removeItem(CHIAVE_HA_NON_LETTI);
  }
  window.dispatchEvent(new CustomEvent('andryxify:non-letti', { detail: { haNonLetti } }));
}

/* Calcola quali conversazioni hanno messaggi non ancora letti */
function calcolaNonLetti(conversazioni, me) {
  const ultimaLettura = leggiUltimaLettura();
  return new Set(
    conversazioni
      .filter(cv => cv.lastMessageAt > (ultimaLettura[`${me}:${cv.user}`] ?? 0))
      .map(cv => cv.user)
  );
}

/* ── MediaBubble ── */
function MediaBubble({ mediaId, mediaIv, mimeType, name, aesKey, twitchToken }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let url = null, cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?action=media&id=${encodeURIComponent(mediaId)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        const buffer = await decryptBytes(aesKey, data.data, mediaIv);
        const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
        url = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(url);
      } catch { if (!cancelled) setErr(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [mediaId, mediaIv, mimeType, aesKey, twitchToken]);

  if (loading) return <div className="msg-media-loading"><Loader size={14} className="spin" /> Caricamento…</div>;
  if (err || !blobUrl) return <div className="msg-media-error">🔒 Media non disponibile</div>;
  const safeUrl = safeBlobUrl(blobUrl);
  const isVideo = mimeType?.startsWith('video/');
  if (isVideo) return <video src={safeUrl} controls className="msg-media-content" />;
  return <img src={safeUrl} alt={name || 'immagine'} className="msg-media-content" style={{ cursor: 'zoom-in' }} onClick={() => window.open(safeUrl, '_blank')} />;
}

/* ═══════════════════════════════════════════════
   KEY SETUP DIALOG
   - mode: 'setup' -> user chooses method (passkey / password / skip)
   - mode: 'unlock' -> auto-detects stored method, offers alternative
   Once completed, keys are in IndexedDB -> no more prompts on this device.
   ═══════════════════════════════════════════════ */
function KeySetupDialog({ mode, backupInfo, loadingBackupInfo, onSetupPassword, onSetupPasskey, onUnlockPassword, onUnlockPasskey, onSkip, onResetKeys, onRetrySync }) {
  const [view, setView] = useState(mode === 'unlock' ? 'unlock' : mode === 'sync_retry' ? 'sync_retry' : 'choose');
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  // Extra fields for the passkey setup step (optional password fallback)
  const [pkFallback, setPkFallback] = useState('');
  const [pkFallbackConfirm, setPkFallbackConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { isPasskeyPRFAvailable().then(setPasskeyAvailable); }, []);

  const handlePasswordSetup = async (e) => {
    e?.preventDefault(); setError('');
    if (phrase.length < 8) { setError('Almeno 8 caratteri.'); return; }
    if (phrase !== confirm) { setError('Le password non corrispondono.'); return; }
    setLoading(true);
    try { await onSetupPassword(phrase); } catch (err) { setError(err.message || 'Errore.'); }
    finally { setLoading(false); }
  };

  const handlePasskeySetup = async () => {
    setError('');
    // Validate optional fallback password before triggering WebAuthn dialog
    if (pkFallback) {
      if (pkFallback.length < 8) { setError('La password di recupero deve avere almeno 8 caratteri.'); return; }
      if (pkFallback !== pkFallbackConfirm) { setError('Le password di recupero non corrispondono.'); return; }
    }
    setLoading(true);
    try { await onSetupPasskey(pkFallback || null); }
    catch (err) {
      if (err.message === 'PRF_NOT_SUPPORTED') setError('Passkey PRF non supportata. Usa una password.');
      else setError(err.name === 'NotAllowedError' ? 'Operazione annullata.' : (err.message || 'Errore.'));
    }
    finally { setLoading(false); }
  };

  const handlePasswordUnlock = async (e) => {
    e?.preventDefault(); setError('');
    if (!phrase) { setError('Inserisci la password.'); return; }
    setLoading(true);
    try { await onUnlockPassword(phrase); } catch { setError('Password errata. Riprova.'); }
    finally { setLoading(false); }
  };

  const handlePasskeyUnlock = async () => {
    setError(''); setLoading(true);
    try { await onUnlockPasskey(); }
    catch (err) {
      if (err.message === 'PRF_NOT_SUPPORTED') setError('Passkey PRF non disponibile su questo dispositivo.');
      else setError(err.name === 'NotAllowedError' ? 'Autenticazione annullata.' : 'Errore di autenticazione.');
    }
    finally { setLoading(false); }
  };

  return (
    <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1.5rem', marginTop: '1rem' }} {...entrata(0.1)}>
      <AnimatePresence mode="wait">
        {/* ── Method chooser (setup) ── */}
        {view === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <KeyRound size={36} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.3rem' }}>Proteggi i tuoi messaggi</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Scegli come sincronizzare le chiavi<br />su tutti i tuoi dispositivi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '300px', margin: '0 auto' }}>
              {passkeyAvailable && (
                <button className="msg-method-btn" onClick={() => { setError(''); setView('passkey-setup'); }} disabled={loading}>
                  <Fingerprint size={20} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Passkey</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Face ID, impronta, biometria</div>
                  </div>
                </button>
              )}

              <button className="msg-method-btn" onClick={() => setView('password')} disabled={loading}>
                <Key size={20} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Password</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Scegli una password per le chiavi</div>
                </div>
              </button>

              {onSkip && (
                <button className="btn btn-ghost" onClick={onSkip} style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Salta per ora (solo questo dispositivo)
                </button>
              )}
            </div>

            <AnimatePresence>
              {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</motion.p>}
            </AnimatePresence>

            <p style={{ color: 'var(--text-faint)', fontSize: '0.7rem', marginTop: '1.25rem', lineHeight: 1.4 }}>
              🔒 Le credenziali non lasciano mai il tuo dispositivo.
            </p>
          </motion.div>
        )}

        {/* ── Passkey setup (with optional password fallback) ── */}
        {view === 'passkey-setup' && (
          <motion.div key="passkey-setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Fingerprint size={34} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Crea passkey</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              La passkey usa la biometria del tuo dispositivo.<br />
              Puoi usarla anche da un altro device tramite QR code.<br />
              Aggiungi una <strong>password di recupero</strong> come alternativa.
            </p>
            <div style={{ maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', textAlign: 'left', margin: '0 0 0.15rem' }}>Password di recupero (opzionale)</p>
              <input type="password" className="mod-input" placeholder="Password (lascia vuoto per saltare)" value={pkFallback} onChange={e => setPkFallback(e.target.value)} autoComplete="new-password" />
              {pkFallback && (
                <input type="password" className="mod-input" placeholder="Conferma password" value={pkFallbackConfirm} onChange={e => setPkFallbackConfirm(e.target.value)} autoComplete="new-password" />
              )}
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</motion.p>}
              </AnimatePresence>
              <button className="btn btn-primary" onClick={handlePasskeySetup} disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? <Loader size={14} className="spin" /> : <><Fingerprint size={14} /> Crea passkey</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setView('choose'); setError(''); setPkFallback(''); setPkFallbackConfirm(''); }} style={{ fontSize: '0.8rem' }}>
                <ArrowLeft size={12} /> Indietro
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Password setup ── */}
        {view === 'password' && (
          <motion.div key="password" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Key size={32} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Crea una password</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              Userai questa password per accedere ai messaggi da nuovi dispositivi.
            </p>
            <form onSubmit={handlePasswordSetup} style={{ maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input type="password" className="mod-input" placeholder="Password" value={phrase} onChange={e => setPhrase(e.target.value)} autoFocus autoComplete="new-password" />
              <input type="password" className="mod-input" placeholder="Conferma password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</motion.p>}
              </AnimatePresence>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? <Loader size={14} className="spin" /> : <><Key size={14} /> Conferma</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setView('choose'); setError(''); }} style={{ fontSize: '0.8rem' }}>
                <ArrowLeft size={12} /> Indietro
              </button>
            </form>
          </motion.div>
        )}

        {/* ── Unlock (existing backup) ── */}
        {view === 'unlock' && (
          <motion.div key="unlock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Lock size={32} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Sblocca i messaggi</h2>

            {loadingBackupInfo ? (
              <div style={{ padding: '1.25rem 0 0.5rem', color: 'var(--text-muted)' }}>
                <Loader size={22} className="spin" style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.82rem', margin: '0.4rem 0 0' }}>Caricamento metodo di accesso…</p>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                  {backupInfo?.method === 'passkey'
                    ? 'Usa la passkey per accedere da questo dispositivo.'
                    : 'Inserisci la password per accedere da questo dispositivo.'}
                </p>

                <div style={{ maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {backupInfo?.method === 'passkey' ? (
                    <>
                      <button className="msg-method-btn" onClick={handlePasskeyUnlock} disabled={loading} style={{ justifyContent: 'center' }}>
                        <Fingerprint size={22} />
                        <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Usa passkey</span>
                        {loading && <Loader size={14} className="spin" />}
                      </button>
                      {backupInfo?.hasPasswordFallback ? (
                        <button type="button" className="btn btn-ghost" onClick={() => { setView('unlock-password'); setError(''); }} style={{ fontSize: '0.78rem' }}>
                          <Key size={12} /> Usa password di recupero invece
                        </button>
                      ) : (
                        <p style={{ color: 'var(--text-faint)', fontSize: '0.73rem', lineHeight: 1.4, margin: '0.15rem 0 0' }}>
                          Clicca &quot;Usa passkey&quot; — se il browser mostra un QR code, scansionalo col telefono dove hai creato la passkey.<br />
                          Se non funziona, usa il pulsante &quot;Hai dimenticato? Reset chiavi&quot; qui sotto.
                        </p>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handlePasswordUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="password" className="mod-input" placeholder="Password" value={phrase} onChange={e => setPhrase(e.target.value)} autoFocus autoComplete="current-password" />
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Loader size={14} className="spin" /> : <><Lock size={14} /> Sblocca</>}
                      </button>
                      {passkeyAvailable && (
                        <button type="button" className="btn btn-ghost" onClick={handlePasskeyUnlock} disabled={loading} style={{ fontSize: '0.78rem' }}>
                          <Fingerprint size={12} /> Usa passkey invece
                        </button>
                      )}
                    </form>
                  )}

                  <AnimatePresence>
                    {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</motion.p>}
                  </AnimatePresence>

                  {onResetKeys && !confirmReset && (
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}
                      style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.5rem' }}>
                      <AlertTriangle size={12} /> Hai dimenticato? Reset chiavi
                    </button>
                  )}

                  <AnimatePresence>
                    {onResetKeys && confirmReset && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="glass-card" style={{ padding: '0.85rem', border: '1px solid rgba(248,113,113,0.35)', marginTop: '0.5rem', textAlign: 'left' }}>
                        <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.3rem', lineHeight: 1.5 }}>
                          ⚠️ <strong>Attenzione:</strong> il reset genera chiavi completamente nuove.
                        </p>
                        <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.6rem', lineHeight: 1.5 }}>
                          <strong>Tutti i messaggi su tutti i tuoi dispositivi diventeranno illeggibili per sempre.</strong>
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }}
                            onClick={() => setConfirmReset(false)}>
                            Annulla
                          </button>
                          <button className="btn btn-primary"
                            style={{ fontSize: '0.78rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                            onClick={onResetKeys}>
                            Sì, resetta le chiavi
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            <p style={{ color: 'var(--text-faint)', fontSize: '0.7rem', marginTop: '1rem', lineHeight: 1.4 }}>
              Il reset genera nuove chiavi — i vecchi messaggi non saranno più leggibili.
            </p>
          </motion.div>
        )}

        {/* ── Unlock with password (fallback from passkey) ── */}
        {view === 'unlock-password' && (
          <motion.div key="unlock-pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Key size={32} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Password di recupero</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              Inserisci la password di recupero impostata quando hai creato la passkey.
            </p>
            <form onSubmit={handlePasswordUnlock} style={{ maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input type="password" className="mod-input" placeholder="Password di recupero" value={phrase} onChange={e => setPhrase(e.target.value)} autoFocus autoComplete="current-password" />
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</motion.p>}
              </AnimatePresence>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Loader size={14} className="spin" /> : <><Lock size={14} /> Sblocca</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setView('unlock'); setError(''); }} style={{ fontSize: '0.8rem' }}>
                <ArrowLeft size={12} /> Indietro
              </button>
            </form>
          </motion.div>
        )}

        {/* ── Sync retry (auto-sync fallito su nuovo dispositivo con chiavi esistenti) ── */}
        {view === 'sync_retry' && (
          <motion.div key="sync_retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RefreshCw size={34} color="var(--accent)" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Sincronizzazione non riuscita</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Stai accedendo da un nuovo dispositivo, ma la sincronizzazione automatica
              delle chiavi non è andata a buon fine.<br /><br />
              Controlla la connessione e riprova. <strong>Non eseguire il reset</strong> senza
              aver prima riprovato più volte: il reset rende tutti i messaggi illeggibili.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '300px', margin: '0 auto' }}>
              <button className="btn btn-primary" onClick={() => onRetrySync?.()} disabled={loading}>
                {loading ? <Loader size={14} className="spin" /> : <><RefreshCw size={14} /> Riprova sincronizzazione</>}
              </button>
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</motion.p>}
              </AnimatePresence>
              {onResetKeys && !confirmReset && (
                <button type="button" className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem' }}
                  onClick={() => setConfirmReset(true)}>
                  <AlertTriangle size={12} /> Reset chiavi (ultima risorsa)
                </button>
              )}
              <AnimatePresence>
                {onResetKeys && confirmReset && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="glass-card" style={{ padding: '0.85rem', border: '1px solid rgba(248,113,113,0.35)', textAlign: 'left' }}>
                    <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.3rem', lineHeight: 1.5 }}>
                      ⚠️ <strong>Attenzione:</strong> il reset genera chiavi completamente nuove.
                    </p>
                    <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.6rem', lineHeight: 1.5 }}>
                      <strong>Tutti i messaggi su tutti i dispositivi diventeranno illeggibili per sempre.</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setConfirmReset(false)}>Annulla</button>
                      <button className="btn btn-primary"
                        style={{ fontSize: '0.78rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                        onClick={onResetKeys}>
                        Sì, resetta le chiavi
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── SyncBanner ── */
function SyncBanner({ onSetup }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="msg-sync-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        <KeyRound size={14} color="var(--accent-warm)" />
        <span style={{ fontSize: '0.8rem' }}>Sincronizza le chiavi per usare i messaggi su tutti i dispositivi.</span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        <button className="btn btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }} onClick={onSetup}>Attiva</button>
        <button className="mod-icon-btn" onClick={() => setDismissed(true)} style={{ padding: '2px' }}><X size={13} /></button>
      </div>
    </motion.div>
  );
}

/* ── SecuritySettings ── */
function SecuritySettings({ onClose, onShowSetup }) {
  const { getE2EBackupInfo, resetE2E, addE2EPasswordFallback } = useTwitchAuth();
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [fallbackPhrase, setFallbackPhrase] = useState('');
  const [fallbackConfirm, setFallbackConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    getE2EBackupInfo().then(i => { setInfo(i); setLoadingInfo(false); });
  }, [getE2EBackupInfo]);

  const handleAddFallback = async (e) => {
    e?.preventDefault();
    setError(''); setSuccess('');
    if (fallbackPhrase.length < 8) { setError('Almeno 8 caratteri.'); return; }
    if (fallbackPhrase !== fallbackConfirm) { setError('Le password non corrispondono.'); return; }
    setBusy(true);
    try {
      await addE2EPasswordFallback(fallbackPhrase);
      setInfo(i => ({ ...i, hasPasswordFallback: true }));
      setSuccess('Password di recupero salvata con successo.');
      setFallbackPhrase(''); setFallbackConfirm('');
    } catch (err) { setError(err.message || 'Errore nel salvataggio.'); }
    finally { setBusy(false); }
  };

  const handleReset = async () => {
    setBusy(true);
    try { await resetE2E(); onClose(); }
    catch (err) { setError(err.message || 'Errore nel reset.'); setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <button className="mod-icon-btn" onClick={onClose}><ArrowLeft size={16} /></button>
        <span style={{ fontWeight: 600, flex: 1, fontSize: '1rem' }}>Sicurezza chiavi E2E</span>
        <Shield size={15} color="var(--primary)" />
      </div>

      <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Status card */}
        <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stato backup chiavi</div>
          {loadingInfo ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}><Loader size={13} className="spin" /> Caricamento…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {info ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {info.method === 'passkey' ? <Fingerprint size={14} color="#22c55e" /> : <Key size={14} color="#22c55e" />}
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#22c55e' }}>
                      {info.method === 'passkey' ? 'Passkey' : 'Password'}
                    </span>
                    <span className="chip" style={{ fontSize: '0.68rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '0 0.4rem' }}>Attivo</span>
                  </div>
                  {info.method === 'passkey' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: info.hasPasswordFallback ? '#22c55e' : 'var(--text-faint)' }}>
                      {info.hasPasswordFallback ? <Check size={12} /> : <X size={12} />}
                      Password di recupero {info.hasPasswordFallback ? 'configurata' : 'non configurata'}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                  <AlertTriangle size={14} color="#f87171" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.82rem', color: '#f87171', margin: 0, lineHeight: 1.4 }}>
                    Nessun backup attivo. Se perdi questo dispositivo, le chat non saranno recuperabili.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Success message */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#22c55e' }}>
              <Check size={14} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add password fallback — only when passkey is active but no fallback yet */}
        {!loadingInfo && info?.method === 'passkey' && !info.hasPasswordFallback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              <Key size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Aggiungi password di recupero
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: 0, lineHeight: 1.4 }}>
              Permette di sbloccare i messaggi da PC o dispositivi dove la passkey non è disponibile.
            </p>
            <form onSubmit={handleAddFallback} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <input type="password" className="mod-input" placeholder="Password di recupero (min 8 caratteri)"
                value={fallbackPhrase} onChange={e => setFallbackPhrase(e.target.value)} autoComplete="new-password" />
              <input type="password" className="mod-input" placeholder="Conferma password"
                value={fallbackConfirm} onChange={e => setFallbackConfirm(e.target.value)} autoComplete="new-password" />
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.78rem', margin: 0 }}>{error}</motion.p>}
              </AnimatePresence>
              <button type="submit" className="btn btn-primary" disabled={busy} style={{ fontSize: '0.82rem' }}>
                {busy ? <Loader size={13} className="spin" /> : <><Key size={13} /> Salva password</>}
              </button>
            </form>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: 0 }} />

        {/* Change backup method */}
        <button className="btn btn-ghost" style={{ fontSize: '0.82rem', justifyContent: 'flex-start', gap: '0.5rem' }}
          onClick={() => { onClose(); onShowSetup(); }}>
          <KeyRound size={14} /> {info ? 'Cambia metodo di backup' : 'Configura backup'}
        </button>

        {/* Reset keys */}
        {!confirmReset ? (
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem', color: 'var(--accent)', justifyContent: 'flex-start', gap: '0.5rem' }}
            onClick={() => { setError(''); setConfirmReset(true); }} disabled={busy}>
            <AlertTriangle size={14} /> Reset chiavi E2E
          </button>
        ) : (
          <div className="glass-card" style={{ padding: '0.85rem', border: '1px solid rgba(248,113,113,0.3)' }}>
            <p style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.6rem', lineHeight: 1.4 }}>
              ⚠️ Genera nuove chiavi — i vecchi messaggi cifrati non saranno più leggibili.
            </p>
            <AnimatePresence>
              {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: '0.78rem', margin: '0 0 0.5rem' }}>{error}</motion.p>}
            </AnimatePresence>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.78rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                onClick={handleReset} disabled={busy}>
                {busy ? <Loader size={12} className="spin" /> : 'Conferma reset'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setConfirmReset(false)} disabled={busy}>
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}


function FriendPicker({ twitchToken, existingConvos, onSelect, onClose }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch(FRIENDS_API, { headers: { Authorization: `Bearer ${twitchToken}` } });
        if (res.ok) { const d = await res.json(); if (!c) setFriends(d.friends || []); }
      } catch { /* silent */ } finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [twitchToken]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = friends.filter(f => !q || f.toLowerCase().includes(q));
    const convoSet = new Set(existingConvos.map(cv => cv.user));
    return list.sort((a, b) => (convoSet.has(a) ? 1 : 0) - (convoSet.has(b) ? 1 : 0));
  }, [friends, search, existingConvos]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <button className="mod-icon-btn" onClick={onClose}><ArrowLeft size={16} /></button>
        <span style={{ fontWeight: 600, flex: 1, fontSize: '1rem' }}>Nuovo messaggio</span>
      </div>
      <div style={{ padding: '0.75rem 0' }}>
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input type="text" className="mod-input" placeholder="Cerca amico…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem' }} autoFocus />
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><Loader size={18} className="spin" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Users size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><br />
            <span style={{ fontSize: '0.85rem' }}>{friends.length === 0 ? 'Nessun amico ancora.' : 'Nessun risultato.'}</span>
            {friends.length === 0 && <Link to="/amici" className="btn btn-ghost" style={{ marginTop: '0.5rem', fontSize: '0.82rem', display: 'inline-flex' }}><Users size={14} /> Aggiungi amici</Link>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {filtered.map(f => (
              <motion.button key={f} className="msg-friend-item" onClick={() => onSelect(f)} whileTap={{ scale: 0.98 }}>
                <div className="msg-avatar">{f[0]?.toUpperCase()}</div>
                <span style={{ fontWeight: 500 }}>{f}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── NotifSettings ── */
function NotifSettings({ onClose }) {
  const { supportato, attivo, attiva, disattiva } = useNotifiche();
  const [prefs, setPrefs] = useState(getNotifPrefs);
  const toggle = (k) => { const u = { ...prefs, [k]: !prefs[k] }; setPrefs(u); saveNotifPrefs(u); };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <button className="mod-icon-btn" onClick={onClose}><ArrowLeft size={16} /></button>
        <span style={{ fontWeight: 600, flex: 1, fontSize: '1rem' }}>Notifiche</span>
      </div>
      <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="msg-notif-row">
          <div><div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Notifiche push</div><div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{!supportato ? 'Non supportate' : attivo ? 'Attive' : 'Disattivate'}</div></div>
          <button className={`msg-toggle ${attivo ? 'msg-toggle-on' : ''}`} onClick={() => attivo ? disattiva() : attiva()} disabled={!supportato}><div className="msg-toggle-knob" /></button>
        </div>
        <div className="msg-notif-row">
          <div><div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Notifiche in-app</div><div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Banner per nuovi messaggi</div></div>
          <button className={`msg-toggle ${prefs.inApp ? 'msg-toggle-on' : ''}`} onClick={() => toggle('inApp')}><div className="msg-toggle-knob" /></button>
        </div>
        <div className="msg-notif-row">
          <div><div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Suono</div><div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Per i nuovi messaggi</div></div>
          <button className={`msg-toggle ${prefs.sound ? 'msg-toggle-on' : ''}`} onClick={() => toggle('sound')}><div className="msg-toggle-knob" /></button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── ConversationsList ── */
function ConversationsList({ conversations, onSelect, onNewMessage, onOpenSettings, onOpenSecuritySettings, nonLettiUtenti = new Set(), e2eNeedsSync }) {
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  if (conversations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <MessageSquare size={36} color="var(--text-faint)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nessuna conversazione</p>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-faint)', marginBottom: '1rem', lineHeight: 1.4 }}>Inizia a chattare con i tuoi amici.<br/>I messaggi sono crittografati E2E.</p>
        <button className="btn btn-primary" onClick={onNewMessage} style={{ fontSize: '0.88rem' }}><Plus size={15} /> Nuovo messaggio</button>
        <button className="btn btn-ghost" style={{ fontSize: '0.78rem', marginTop: '0.5rem', display: 'inline-flex' }} onClick={onOpenSecuritySettings}>
          <Shield size={13} /> Sicurezza chiavi
        </button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem' }}>Chat</span>
        <button className="mod-icon-btn" title="Sicurezza chiavi" onClick={onOpenSecuritySettings}><Shield size={15} /></button>
        <button className="mod-icon-btn" title="Notifiche" onClick={onOpenSettings}><Bell size={15} /></button>
        <button className="btn btn-primary" onClick={onNewMessage} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', borderRadius: 'var(--r-full)' }}><Plus size={13} /> Nuova</button>
      </div>
      {e2eNeedsSync && !syncBannerDismissed && (
        <motion.div className="glass-card" style={{ margin: '0.5rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,180,50,0.12)', border: '1px solid rgba(255,180,50,0.25)' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <AlertTriangle size={18} style={{ color: '#ffb432', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', flex: 1 }}>Le tue chiavi non sono ancora sincronizzate su altri dispositivi</span>
          <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setSyncBannerDismissed(true)}>Ignora</button>
        </motion.div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingTop: '0.5rem' }}>
        {conversations.map(cv => {
          const nonLetto = nonLettiUtenti.has(cv.user);
          return (
            <motion.button key={cv.user} className="msg-convo-item" onClick={() => onSelect(cv.user)} whileTap={{ scale: 0.98 }}>
              {/* Avatar con pallino non-letto sovrapposto */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className="msg-avatar">{cv.user[0]?.toUpperCase()}</div>
                {nonLetto && <span className="msg-pallino" aria-label="Messaggi non letti" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: nonLetto ? 700 : 600, fontSize: '0.92rem' }}>{cv.user}</div>
                <div className="msg-convo-time"><Clock size={10} /> {tempoRelativo(cv.lastMessageAt)}</div>
              </div>
              <ChevronDown size={14} color="var(--text-faint)" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── ForwardFriendList ── */
function ForwardFriendList({ twitchToken, onSelect, busy }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch(FRIENDS_API, { headers: { Authorization: `Bearer ${twitchToken}` } });
        if (res.ok) { const d = await res.json(); if (!c) setFriends(d.friends || []); }
      } catch { /* silent */ } finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [twitchToken]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? friends.filter(f => f.toLowerCase().includes(q)) : friends;
  }, [friends, search]);

  return (
    <>
      <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input type="text" className="mod-input" placeholder="Cerca amico…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem 0.35rem 2rem' }} />
        </div>
      </div>
      <div className="msg-forward-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}><Loader size={16} className="spin" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-faint)', fontSize: '0.82rem' }}>
            {friends.length === 0 ? 'Nessun amico.' : 'Nessun risultato.'}
          </div>
        ) : filtered.map(f => (
          <button key={f} className="msg-forward-friend" onClick={() => onSelect(f)} disabled={busy}>
            <div className="msg-avatar" style={{ width: 30, height: 30, fontSize: '0.8rem', flexShrink: 0 }}>{f[0]?.toUpperCase()}</div>
            <span>{f}</span>
            {busy && <Loader size={12} className="spin" style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════
   CHAT VIEW
   ═══════════════════════════════════════ */
function ChatView({ withUser, twitchUser, twitchToken, privateKeyRef, e2eReady, onBack, onResetE2E, emoteCanale, emoteGlobali, renderTestoConEmote }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isKeyError, setIsKeyError] = useState(false);
  const [aesKey, setAesKey] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [forwardSentTo, setForwardSentTo] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const lastMsgIdRef = useRef(null);
  const lastPollTimeRef = useRef(Date.now());
  const pollRef = useRef(null);
  const inputRef = useRef(null);
  const longPressRef = useRef(null);
  const { invia: inviaNotifica } = useNotifiche();

  // Derive AES key
  useEffect(() => {
    if (!e2eReady || !privateKeyRef.current) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt <= 2; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(withUser)}`);
          const data = await res.json();
          if (cancelled) return;
          if (!data.publicKey) { setError(`${withUser} non ha ancora il login.`); setLoading(false); return; }
          const theirPub = await importPublicKey(data.publicKey);
          const key = await deriveKey(privateKeyRef.current, theirPub);
          if (!cancelled) { setAesKey(key); setError(''); setIsKeyError(false); }
          return;
        } catch (e) {
          console.error(`Key derive attempt ${attempt + 1}:`, e);
          if (attempt < 2) await new Promise(r => setTimeout(r, DERIVE_RETRY_DELAY_MS * (attempt + 1)));
          else if (!cancelled) { setError('Impossibile derivare la chiave.'); setIsKeyError(true); setLoading(false); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [withUser, e2eReady, privateKeyRef]);

  const decryptMsg = useCallback(async (msg, key) => {
    if (msg.deleted) return { ...msg, text: null, media: undefined };
    try {
      const text = await decryptMessage(key, msg.encrypted, msg.iv);
      try { const p = JSON.parse(text); if (p?.type === 'media') return { ...msg, text: null, media: p }; } catch { /* plain text */ }
      return { ...msg, text };
    } catch { return { ...msg, text: '\u{1F512} [Impossibile decifrare]' }; }
  }, []);

  // Load history
  useEffect(() => {
    if (!aesKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}?action=history&with=${encodeURIComponent(withUser)}`, { headers: { Authorization: `Bearer ${twitchToken}` } });
        const data = await res.json();
        if (cancelled) return;
        const dec = await Promise.all((data.messages || []).map(m => decryptMsg(m, aesKey)));
        setMessages(dec);
        if (dec.length) lastMsgIdRef.current = dec[dec.length - 1].id;
        lastPollTimeRef.current = Date.now();
      } catch { if (!cancelled) setError('Errore nel caricamento.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [aesKey, withUser, twitchToken, decryptMsg]);

  // Polling
  useEffect(() => {
    if (!aesKey || !twitchToken) return;
    const poll = async () => {
      try {
        const afterP = lastMsgIdRef.current ? `&after=${lastMsgIdRef.current}` : '';
        const res = await fetch(`${API_URL}?action=poll&with=${encodeURIComponent(withUser)}${afterP}&since=${lastPollTimeRef.current}`, { headers: { Authorization: `Bearer ${twitchToken}` } });
        const data = await res.json();
        lastPollTimeRef.current = Date.now();
        if (data.messages?.length) {
          const dec = await Promise.all(data.messages.map(m => decryptMsg(m, aesKey)));
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const nw = dec.filter(m => !ids.has(m.id));
            return nw.length ? [...prev, ...nw] : prev;
          });
          lastMsgIdRef.current = dec[dec.length - 1].id;
          // Notify
          const prefs = getNotifPrefs();
          const incoming = dec.filter(m => m.from !== twitchUser);
          if (incoming.length && !prefs.muted?.includes(withUser)) {
            if (prefs.inApp && document.hidden) {
              inviaNotifica(`\u{1F4AC} ${withUser}`, { body: incoming[0].text?.slice(0, 80) || '\u{1F4CE} Media', tag: `msg-${withUser}`, data: { url: `/messaggi?con=${withUser}` } });
            }
          }
        }
        if (data.changed?.length) {
          const cm = new Map();
          for (const m of data.changed) cm.set(m.id, await decryptMsg(m, aesKey));
          setMessages(prev => prev.map(m => cm.has(m.id) ? cm.get(m.id) : m));
        }
      } catch { /* silent */ }
    };
    const gi = () => document.hidden ? POLL_HIDDEN : POLL_ACTIVE;
    pollRef.current = setInterval(poll, gi());
    const onVis = () => { clearInterval(pollRef.current); pollRef.current = setInterval(poll, gi()); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(pollRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [aesKey, withUser, twitchToken, twitchUser, decryptMsg, inviaNotifica]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Close context menu on outside click
  useEffect(() => {
    if (!menuMsgId) return;
    const close = (e) => { if (!e.target.closest('[data-msg-menu]')) { setMenuMsgId(null); setConfirmDelete(null); } };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuMsgId]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !aesKey || sending) return;
    setSending(true);
    try {
      const { encrypted, iv } = await encryptMessage(aesKey, text);
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` }, body: JSON.stringify({ action: 'send', to: withUser, encrypted, iv }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Errore');
      setMessages(prev => [...prev, { id: d.message.id, from: twitchUser, to: withUser, text, createdAt: d.message.createdAt }]);
      lastMsgIdRef.current = d.message.id;
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      inputRef.current?.focus();
    } catch (err) { setError(err.message); setTimeout(() => setError(''), 4000); }
    finally { setSending(false); }
  };

  const startEdit = (msg) => { setMenuMsgId(null); setEditingId(msg.id); setEditText(msg.text || ''); setTimeout(() => inputRef.current?.focus(), 50); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const submitEdit = async (e) => {
    e?.preventDefault();
    const text = editText.trim();
    if (!text || !aesKey) return;
    setSending(true);
    try {
      const { encrypted, iv } = await encryptMessage(aesKey, text);
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` }, body: JSON.stringify({ action: 'edit', msgId: editingId, convoWith: withUser, encrypted, iv }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Errore'); }
      setMessages(prev => prev.map(m => m.id === editingId ? { ...m, text, editedAt: Date.now() } : m));
      cancelEdit();
    } catch (err) { setError(err.message); setTimeout(() => setError(''), 4000); }
    finally { setSending(false); }
  };

  const deleteMessage = async (msgId) => {
    setMenuMsgId(null); setConfirmDelete(null);
    try {
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` }, body: JSON.stringify({ action: 'delete', msgId, convoWith: withUser }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Errore'); }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, text: null, media: undefined } : m));
    } catch (err) { setError(err.message); setTimeout(() => setError(''), 4000); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError('Max 8MB.'); setTimeout(() => setError(''), 4000); return; }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { setError('Solo immagini o video.'); setTimeout(() => setError(''), 4000); return; }
    setMediaPreview({ file, objectUrl: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') });
  };
  const cancelMedia = () => { if (mediaPreview?.objectUrl) URL.revokeObjectURL(mediaPreview.objectUrl); setMediaPreview(null); };

  const sendMedia = async () => {
    if (!mediaPreview || !aesKey || mediaUploading) return;
    setMediaUploading(true);
    try {
      let { file } = mediaPreview;
      if (!mediaPreview.isVideo) { try { const c = await compressImage(file); if (c) file = c; } catch { /* use original */ } }
      const buffer = await file.arrayBuffer();
      const { data: encData, iv: mediaIv } = await encryptBytes(aesKey, buffer);
      if (encData.length > MAX_MEDIA_B64) throw new Error('File troppo grande (max ~800KB).');
      const uploadRes = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` }, body: JSON.stringify({ action: 'upload_media', to: withUser, data: encData, mimeType: file.type, name: mediaPreview.file.name }) });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Errore upload');
      const payload = { type: 'media', mediaId: uploadData.mediaId, mimeType: file.type, name: mediaPreview.file.name, iv: mediaIv };
      const { encrypted, iv } = await encryptMessage(aesKey, JSON.stringify(payload));
      const sendRes = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` }, body: JSON.stringify({ action: 'send', to: withUser, encrypted, iv }) });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Errore invio');
      setMessages(prev => [...prev, { id: sendData.message.id, from: twitchUser, to: withUser, text: null, media: payload, createdAt: sendData.message.createdAt }]);
      lastMsgIdRef.current = sendData.message.id;
      cancelMedia();
    } catch (err) { setError(err.message); setTimeout(() => setError(''), 5000); }
    finally { setMediaUploading(false); }
  };

  const onMsgPointerDown = (msgId) => { longPressRef.current = setTimeout(() => setMenuMsgId(msgId), LONG_PRESS_DURATION); };
  const onMsgPointerUp = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };
  const openMsgMenu = (msgId) => { clearTimeout(longPressRef.current); setMenuMsgId(msgId); };

  const copyMessage = async (text, msgId) => {
    setMenuMsgId(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(m => m === msgId ? null : m), 1800);
    } catch {
      setError('Impossibile copiare negli appunti.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openForward = (msg) => {
    setMenuMsgId(null);
    setForwardSentTo(null);
    setForwardingMsg(msg);
  };

  const sendForward = async (toUser) => {
    if (!forwardingMsg?.text || !privateKeyRef.current || forwardBusy) return;
    setForwardBusy(true);
    try {
      const res = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(toUser)}`);
      const data = await res.json();
      if (!data.publicKey) throw new Error(`${toUser} non ha ancora la chiave pubblica.`);
      const theirPub = await importPublicKey(data.publicKey);
      const fwdKey = await deriveKey(privateKeyRef.current, theirPub);
      const { encrypted, iv } = await encryptMessage(fwdKey, forwardingMsg.text);
      const sendRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'send', to: toUser, encrypted, iv }),
      });
      if (!sendRes.ok) { const d = await sendRes.json(); throw new Error(d.error || 'Errore'); }
      setForwardSentTo(toUser);
      setTimeout(() => setForwardingMsg(null), 1400);
    } catch (err) { setError(err.message); setTimeout(() => setError(''), 4000); }
    finally { setForwardBusy(false); }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (editingId) setEditText(val); else setInput(val);
    const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editingId ? submitEdit() : sendMessage(); } };

  const messagesWithDates = useMemo(() => {
    const result = [];
    let lastDateStr = '';
    for (const msg of messages) {
      const ds = new Date(Number(msg.createdAt)).toLocaleDateString('it-IT');
      if (ds !== lastDateStr) { result.push({ type: 'date', ts: msg.createdAt, label: dateSeparatorLabel(msg.createdAt) }); lastDateStr = ds; }
      result.push({ type: 'msg', ...msg });
    }
    return result;
  }, [messages]);

  return (
    <div className="msg-chat-container">
      <div className="msg-chat-header">
        <button className="mod-icon-btn" onClick={onBack}><ArrowLeft size={16} /></button>
        <div className="msg-avatar msg-avatar-sm">{withUser[0]?.toUpperCase()}</div>
        <span style={{ fontWeight: 600, flex: 1, fontSize: '0.95rem' }}>{withUser}</span>
        {aesKey ? (
          <Lock size={14} style={{ color: '#4ade80', marginLeft: 4 }} title="Cifratura attiva" />
        ) : (
          <AlertTriangle size={14} style={{ color: '#fbbf24', marginLeft: 4 }} title="Cifratura non verificata" />
        )}
        <span className="chip" style={{ fontSize: '0.65rem', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', padding: '0.15rem 0.5rem' }}><Lock size={9} /> E2E</span>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="msg-error-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertTriangle size={13} /> {error}</div>
            {isKeyError && onResetE2E && <div style={{ marginTop: '0.4rem' }}><button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={onResetE2E}><Shield size={11} /> Reset chiavi E2E</button></div>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="msg-scroll-area" ref={scrollContainerRef} onScroll={handleScroll}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><Loader size={20} className="spin" /> Caricamento…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Shield size={28} style={{ marginBottom: '0.75rem', opacity: 0.5 }} /><br />
            <span style={{ fontSize: '0.9rem' }}>Conversazione E2E</span><br />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-faint)' }}>Solo tu e <strong>{withUser}</strong> potete leggere.</span>
          </div>
        ) : (
          messagesWithDates.map((item, idx) => {
            if (item.type === 'date') return <div key={`d-${item.ts}`} className="msg-date-separator"><span>{item.label}</span></div>;
            const msg = item;
            const isMine = msg.from === twitchUser;
            const isMenuOpen = menuMsgId === msg.id;
            const prev = idx > 0 ? messagesWithDates[idx - 1] : null;
            const isGrouped = prev?.type === 'msg' && prev.from === msg.from && (Number(msg.createdAt) - Number(prev.createdAt)) < 120000;

            return (
              <div key={msg.id} className={`msg-wrapper ${isGrouped ? 'msg-grouped' : ''}`} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <AnimatePresence>
                  {isMenuOpen && !msg.deleted && (
                    <motion.div data-msg-menu role="menu" aria-label="Opzioni messaggio"
                      initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                      onPointerDown={e => e.stopPropagation()} className="msg-context-menu"
                      style={{ [isMine ? 'right' : 'left']: 0 }}>
                      {msg.text && (
                        <button role="menuitem" className="msg-context-item" onClick={() => copyMessage(msg.text, msg.id)}>
                          {copiedMsgId === msg.id ? <><Check size={13} /> Copiato!</> : <><Copy size={13} /> Copia</>}
                        </button>
                      )}
                      {msg.text && <button role="menuitem" className="msg-context-item" onClick={() => openForward(msg)}><CornerUpRight size={13} /> Inoltra</button>}
                      {isMine && msg.text && <button role="menuitem" className="msg-context-item" onClick={() => startEdit(msg)}><Pencil size={13} /> Modifica</button>}
                      {isMine && (confirmDelete === msg.id
                        ? <button role="menuitem" className="msg-context-item msg-context-danger" onClick={() => deleteMessage(msg.id)}><Check size={13} /> Conferma</button>
                        : <button role="menuitem" className="msg-context-item msg-context-danger-light" onClick={() => setConfirmDelete(msg.id)}><Trash2 size={13} /> Elimina</button>)}
                    </motion.div>
                  )}
                </AnimatePresence>
                {isMine && !msg.deleted && (
                  <div className="msg-hover-actions">
                    {msg.text && <button className="mod-icon-btn" title="Modifica" style={{ padding: '4px', borderRadius: '6px' }} onClick={() => startEdit(msg)}><Pencil size={11} /></button>}
                    <button className="mod-icon-btn" title="Elimina" style={{ padding: '4px', borderRadius: '6px', color: '#f87171' }} onClick={() => { setMenuMsgId(msg.id); setConfirmDelete(msg.id); }}><Trash2 size={11} /></button>
                  </div>
                )}
                <div className={`msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'} ${isGrouped ? 'msg-bubble-grouped' : ''}`}
                  onPointerDown={(e) => { if (!msg.deleted) { e.preventDefault(); onMsgPointerDown(msg.id); } }}
                  onPointerUp={onMsgPointerUp} onPointerLeave={onMsgPointerUp}
                  onContextMenu={(e) => { e.preventDefault(); if (!msg.deleted) openMsgMenu(msg.id); }}
                  style={{ cursor: msg.deleted ? 'default' : 'pointer' }}>
                  {msg.deleted ? <p className="msg-deleted-text">{'\u{1F5D1}'} Messaggio eliminato</p>
                    : msg.media ? <MediaBubble mediaId={msg.media.mediaId} mediaIv={msg.media.iv} mimeType={msg.media.mimeType} name={msg.media.name} aesKey={aesKey} twitchToken={twitchToken} />
                    : <p className="msg-text">{renderTestoConEmote(msg.text)}</p>}
                  <span className="msg-time">{tempoMsg(msg.createdAt)}{msg.editedAt && <span className="msg-edited"> · mod.</span>}{isMine && !msg.deleted && <span className="msg-check"> ✓</span>}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button className="msg-scroll-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom}>
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Forward overlay */}
      <AnimatePresence>
        {forwardingMsg && (
          <motion.div className="msg-forward-overlay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <div className="msg-forward-header">
              <CornerUpRight size={14} color="var(--primary)" />
              <span style={{ flex: 1 }}>Inoltra messaggio</span>
              <button className="mod-icon-btn" onClick={() => setForwardingMsg(null)} disabled={forwardBusy}><X size={14} /></button>
            </div>
            <div className="msg-forward-preview">"{forwardingMsg.text?.slice(0, 80)}{(forwardingMsg.text?.length ?? 0) > 80 ? '…' : ''}"</div>
            {forwardSentTo ? (
              <div className="msg-forward-sent"><Check size={14} /> Inoltrato a <strong>{forwardSentTo}</strong></div>
            ) : (
              <ForwardFriendList twitchToken={twitchToken} onSelect={sendForward} busy={forwardBusy} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mediaPreview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="msg-media-preview">
            {mediaPreview.isVideo ? <video src={safeBlobUrl(mediaPreview.objectUrl)} className="msg-media-thumb" /> : <img src={safeBlobUrl(mediaPreview.objectUrl)} alt="preview" className="msg-media-thumb" />}
            <span className="msg-media-name">{mediaPreview.file.name}</span>
            {mediaUploading ? <Loader size={16} className="spin" style={{ flexShrink: 0 }} /> : (
              <>
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', flexShrink: 0 }} onClick={sendMedia}><Send size={12} /></button>
                <button className="mod-icon-btn" style={{ flexShrink: 0 }} onClick={cancelMedia}><X size={14} /></button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={editingId ? submitEdit : sendMessage} className="msg-input-form">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button type="button" className="mod-icon-btn" title="Foto o video" style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: '0.3rem' }}
          onClick={() => fileInputRef.current?.click()} disabled={!aesKey || mediaUploading || !!editingId}><ImageIcon size={18} /></button>
        <div style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: '0.3rem' }}>
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            onSelect={(nome) => {
              const setter = editingId ? setEditText : setInput;
              setter(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ');
              inputRef.current?.focus();
            }}
            disabled={!aesKey || mediaUploading}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingId && (
            <div className="msg-edit-label"><Pencil size={10} /> Modifica<button type="button" onClick={cancelEdit} className="msg-edit-cancel"><X size={11} /></button></div>
          )}
          <textarea ref={inputRef} value={editingId ? editText : input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder={editingId ? 'Modifica…' : 'Scrivi un messaggio…'} className="msg-textarea" rows={1} maxLength={2000} disabled={!aesKey} />
        </div>
        <button type="submit" className="msg-send-btn" disabled={!(editingId ? editText.trim() : input.trim()) || sending || !aesKey || mediaUploading}
          style={{ alignSelf: 'flex-end', marginBottom: '0.3rem' }}>
          {sending ? <Loader size={15} className="spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function MessagesPage() {
  const {
    isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl,
    e2eReady: ready, e2eError: keyError, e2ePrivateKeyRef: privateKeyRef,
    e2eNeedsPassphrase, e2eNeedsSync,
    e2eSetupToast, clearE2eToast,
    retryE2E, resetE2E,
    setupE2EPassphrase, unlockE2EPassphrase,
    setupE2EPasskey, unlockE2EPasskey,
    skipE2ESetup,
    getE2EBackupInfo,
  } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(searchParams.get('con') || null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
  const [backupInfo, setBackupInfo] = useState(null);
  const [loadingBackupInfo, setLoadingBackupInfo] = useState(false);
  const [confirmKeyErrorReset, setConfirmKeyErrorReset] = useState(false);
  /* Insieme degli utenti con almeno un messaggio non letto */
  const [nonLettiUtenti, setNonLettiUtenti] = useState(new Set());

  useEffect(() => {
    if (e2eNeedsPassphrase === 'unlock' && getE2EBackupInfo) {
      setLoadingBackupInfo(true);
      getE2EBackupInfo()
        .then(info => { setBackupInfo(info); })
        .finally(() => setLoadingBackupInfo(false));
    }
  }, [e2eNeedsPassphrase, getE2EBackupInfo]);

  const loadConversations = useCallback(async () => {
    if (!twitchToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=conversations`, { headers: { Authorization: `Bearer ${twitchToken}` } });
      if (res.ok) {
        const d = await res.json();
        const convos = d.conversations || [];
        setConversations(convos);
        if (twitchUser) {
          /* Prima visita assoluta: inizializza tutte come lette per evitare falsi non-letti */
          if (!localStorage.getItem(CHIAVE_ULTIMA_LETTURA)) {
            const init = {};
            convos.forEach(cv => { init[`${twitchUser}:${cv.user}`] = cv.lastMessageAt || 0; });
            localStorage.setItem(CHIAVE_ULTIMA_LETTURA, JSON.stringify(init));
            setNonLettiUtenti(new Set());
          } else {
            setNonLettiUtenti(calcolaNonLetti(convos, twitchUser));
          }
        }
      }
    } catch { /* silenzioso */ } finally { setLoading(false); }
  }, [twitchToken, twitchUser]);

  useEffect(() => { if (isLoggedIn && ready) loadConversations(); }, [isLoggedIn, ready, loadConversations]);

  /* Notifica la Navbar ogni volta che lo stato non-letti cambia */
  useEffect(() => { notificaNonLetti(nonLettiUtenti.size > 0); }, [nonLettiUtenti]);

  const selectChat = (user) => {
    /* Segna la conversazione come letta prima di aprirla */
    if (twitchUser) salvaUltimaLettura(twitchUser, user, Date.now());
    setNonLettiUtenti(prev => { const next = new Set(prev); next.delete(user); return next; });
    setActiveChat(user); setShowFriendPicker(false); setSearchParams({ con: user }, { replace: true });
  };
  const goBack = () => {
    setActiveChat(null); setShowFriendPicker(false); setShowSettings(false);
    setShowSecuritySettings(false); setSearchParams({}, { replace: true }); loadConversations();
  };

  const skipPassphrase = async () => {
    try {
      await skipE2ESetup();
      /* Segna come saltato intenzionalmente per non mostrare più il banner */
      sessionStorage.setItem('e2e_sync_skipped', '1');
    } catch { retryE2E(); }
  };

  if (!isLoggedIn) {
    return (
      <div className="main-content">
        <SEO title="Messaggi" description="Messaggi crittografati end-to-end" path="/messaggi" />
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginTop: '1rem' }} {...entrata(0.1)}>
          <Lock size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Messaggi Crittografati</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>Accedi con Twitch per messaggi privati E2E.</p>
          {clientId && <a href={getTwitchLoginUrl('/messaggi')} className="btn social-btn-twitch"><LogIn size={14} /> Accedi con Twitch</a>}
        </motion.div>
      </div>
    );
  }

  if (e2eNeedsPassphrase) {
    return (
      <div className="main-content">
        <SEO title="Messaggi" description="Messaggi crittografati end-to-end" path="/messaggi" />
        <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
          <motion.h1 className="title" {...entrata(0.05)}><Lock size={24} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /><span className="text-gradient">Messaggi</span></motion.h1>
        </section>
        <KeySetupDialog
          mode={e2eNeedsPassphrase}
          backupInfo={backupInfo}
          loadingBackupInfo={loadingBackupInfo}
          onSetupPassword={setupE2EPassphrase}
          onSetupPasskey={setupE2EPasskey}
          onUnlockPassword={unlockE2EPassphrase}
          onUnlockPasskey={unlockE2EPasskey}
          onSkip={e2eNeedsPassphrase === 'setup' ? skipPassphrase : null}
          onResetKeys={['unlock', 'sync_retry'].includes(e2eNeedsPassphrase) ? resetE2E : null}
          onRetrySync={e2eNeedsPassphrase === 'sync_retry' ? retryE2E : null}
        />
      </div>
    );
  }

  return (
    <div className="main-content">
      {e2eSetupToast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          onClick={clearE2eToast}
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, padding: '0.6rem 1.2rem', borderRadius: 12, background: e2eSetupToast.includes('✓') ? 'rgba(74,222,128,0.18)' : 'rgba(255,180,50,0.18)', border: `1px solid ${e2eSetupToast.includes('✓') ? 'rgba(74,222,128,0.3)' : 'rgba(255,180,50,0.3)'}`, backdropFilter: 'blur(12px)', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          {e2eSetupToast}
        </motion.div>
      )}
      <SEO title="Messaggi" description="Messaggi crittografati end-to-end" path="/messaggi" />
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}><Lock size={24} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /><span className="text-gradient">Messaggi</span></motion.h1>
        <motion.p className="subtitle" {...entrata(0.1)}>Conversazioni private crittografate end-to-end.</motion.p>
      </section>

      <motion.div {...entrata(0.12)} style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="chip" style={{ fontSize: '0.72rem', background: ready ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)', color: ready ? '#22c55e' : '#fbbf24', border: `1px solid ${ready ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
          <Shield size={11} /> {keyError ? 'Errore crittografia' : ready ? 'E2E attiva' : 'Inizializzazione…'}
        </span>
      </motion.div>

      {e2eNeedsSync && !showPassphraseSetup && !showSecuritySettings && !sessionStorage.getItem('e2e_sync_skipped') && <SyncBanner onSetup={() => setShowPassphraseSetup(true)} />}

      {showPassphraseSetup && (
        <KeySetupDialog mode="setup"
          onSetupPassword={async (p) => { await setupE2EPassphrase(p); setShowPassphraseSetup(false); }}
          onSetupPasskey={async (fp) => { await setupE2EPasskey(fp); setShowPassphraseSetup(false); }}
          onSkip={() => setShowPassphraseSetup(false)} />
      )}

      {keyError ? (
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent)' }} {...entrata(0.15)}>
          <AlertTriangle size={24} style={{ marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>{keyError}</p>
          {!confirmKeyErrorReset ? (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={retryE2E}><RefreshCw size={13} /> Riprova</button>
              <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setConfirmKeyErrorReset(true)}><Shield size={13} /> Reset chiavi</button>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '0.85rem', border: '1px solid rgba(248,113,113,0.35)', marginTop: '0.25rem', textAlign: 'left' }}>
              <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.3rem', lineHeight: 1.5 }}>
                ⚠️ <strong>Attenzione:</strong> il reset genera chiavi completamente nuove.
              </p>
              <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.6rem', lineHeight: 1.5 }}>
                <strong>Tutti i messaggi esistenti diventeranno illeggibili per sempre.</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setConfirmKeyErrorReset(false)}>Annulla</button>
                <button className="btn btn-primary" style={{ fontSize: '0.78rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }} onClick={resetE2E}>Sì, resetta</button>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div className="glass-panel msg-main-panel" {...entrata(0.15)}>
          <AnimatePresence mode="wait">
            {activeChat ? (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ height: '100%' }}>
                <ChatView withUser={activeChat} twitchUser={twitchUser} twitchToken={twitchToken} privateKeyRef={privateKeyRef} e2eReady={ready} onBack={goBack} onResetE2E={resetE2E} emoteCanale={emoteCanale} emoteGlobali={emoteGlobali} renderTestoConEmote={renderTestoConEmote} />
              </motion.div>
            ) : showFriendPicker ? (
              <motion.div key="picker" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <FriendPicker twitchToken={twitchToken} existingConvos={conversations} onSelect={selectChat} onClose={() => setShowFriendPicker(false)} />
              </motion.div>
            ) : showSettings ? (
              <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <NotifSettings onClose={() => setShowSettings(false)} />
              </motion.div>
            ) : showSecuritySettings ? (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <SecuritySettings
                  onClose={() => setShowSecuritySettings(false)}
                  onShowSetup={() => { setShowSecuritySettings(false); setShowPassphraseSetup(true); }}
                />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><Loader size={20} className="spin" /> Caricamento…</div>
                ) : (
                  <ConversationsList conversations={conversations} onSelect={selectChat} onNewMessage={() => setShowFriendPicker(true)}
                    onOpenSettings={() => setShowSettings(true)}
                    onOpenSecuritySettings={() => setShowSecuritySettings(true)}
                    nonLettiUtenti={nonLettiUtenti}
                    e2eNeedsSync={e2eNeedsSync} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
