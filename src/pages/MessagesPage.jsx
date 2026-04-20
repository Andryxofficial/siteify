/**
 * MessagesPage — Messaggi privati E2E cifrati con chiavi ECDH P-256.
 *
 * Fasi principali:
 *   1. inizializzazione  — caricamento chiavi da IDB / server
 *   2. non-autenticato   — login Twitch richiesto
 *   3. setup-primo       — primo dispositivo: generazione chiavi
 *   4. setup-joiner      — altro dispositivo: inserimento codice / QR / passkey
 *   5. messaggi          — chat con lista conversazioni
 */
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, Send, ArrowLeft, ArrowDown, MessageSquare, Users, LogIn, Loader, Shield,
  Clock, AlertTriangle, Pencil, Trash2, X, Plus, Image as ImageIcon, Check, RefreshCw,
  Bell, KeyRound, ChevronDown, Search, Fingerprint, Key, Copy, CornerUpRight,
  Smartphone, QrCode, RotateCcw, Download, Upload, ShieldAlert, UserPlus,
  Mic, Square, Reply, Smile, Circle,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNotifiche } from '../hooks/useNotifiche';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import SEO from '../components/SEO';
import QRCode from 'qrcode';
import {
  getLocalPrivateKey,
  saveAndRegisterKeyPair,
  generateAndRegisterNewKeys,
  deleteLocalKeys,
  exportPublicKey,
  importPublicKey,
  deriveKey,
  encryptMessage,
  decryptMessage,
  isPasskeyPRFAvailable,
  createPasskeyAndEncryptKey,
  authenticatePasskeyAndDecryptKey,
  createSyncEphemeralPair,
  deleteSyncEphemeralPair,
  encryptIdentityKeyForSync,
  decryptIdentityKeyFromSync,
  exportKeyToEncryptedFile,
  importKeyFromEncryptedFile,
} from '../utils/e2eKeys';



const API = '/api/messages';
const REAZIONI_RAPIDE = ['❤️','😂','👍','🔥','😮','😢','🎉','💀'];

/* ─── Helper fetch autenticato ─── */
async function apiFetch(token, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Errore API: ${res.status}`);
  return res.json();
}

/* ─── Estrae chiave pubblica da una privata ECDH (senza importazione ridondante) ─── */
async function estraiChiavePubblica(privKey) {
  const jwkPriv = await crypto.subtle.exportKey('jwk', privKey);
  const pubJwk = { kty: jwkPriv.kty, crv: jwkPriv.crv, x: jwkPriv.x, y: jwkPriv.y, key_ops: [], ext: true };
  return JSON.stringify(pubJwk);
}

/* ─── Formatta timestamp in orario breve ─── */
function formatOra(ts) {
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Formatta data separatore ─── */
function formatData(ts) {
  const d = new Date(ts);
  const oggi = new Date();
  const ieri = new Date(oggi);
  ieri.setDate(oggi.getDate() - 1);
  if (d.toDateString() === oggi.toDateString()) return 'Oggi';
  if (d.toDateString() === ieri.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ─── Copia negli appunti con fallback ─── */
async function copiaNeglAppunti(testo) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch { /* fallback sotto */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = testo;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch { return false; }
}

/* ─── Compressore immagini lato client (canvas-based, veloce) ─── */
const COMPRESS_MAX_DIM = 2048;  // dimensione massima lato lungo
const COMPRESS_MAX_BYTES = 2_800_000; // ~2.8MB target (lascia margine per encryption overhead)

function isImageComprimibile(file) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|tiff?|avif|heic|heif|svg)$/i.test(file.name);
}

async function comprimeImmagine(file) {
  /* Se il file è già piccolo e in un formato web-friendly, non comprimerlo */
  if (file.size <= COMPRESS_MAX_BYTES && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  /* SVG: nessuna compressione necessaria, già leggero */
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.size <= COMPRESS_MAX_BYTES) return file;
    throw new Error('SVG troppo grande');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;

      /* Ridimensiona se supera le dimensioni massime */
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        const rapporto = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height);
        width = Math.round(width * rapporto);
        height = Math.round(height * rapporto);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      /* Prova prima WebP (più leggero), poi JPEG come fallback */
      let qualita = 0.82;
      const formati = ['image/webp', 'image/jpeg'];

      function tentaCompressione(idxFormato) {
        const formato = formati[idxFormato];
        if (!formato) {
          reject(new Error('Impossibile comprimere l\'immagine sotto il limite'));
          return;
        }
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              /* Formato non supportato dal browser, prova il prossimo */
              tentaCompressione(idxFormato + 1);
              return;
            }
            if (blob.size <= COMPRESS_MAX_BYTES) {
              const ext = formato === 'image/webp' ? '.webp' : '.jpg';
              const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'immagine';
              resolve(new File([blob], nomeBase + ext, { type: formato }));
            } else if (qualita > 0.35) {
              /* Riduci la qualità e riprova */
              qualita -= 0.12;
              canvas.toBlob(
                (blob2) => {
                  if (blob2 && blob2.size <= COMPRESS_MAX_BYTES) {
                    const ext = formato === 'image/webp' ? '.webp' : '.jpg';
                    const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'immagine';
                    resolve(new File([blob2], nomeBase + ext, { type: formato }));
                  } else {
                    tentaCompressione(idxFormato + 1);
                  }
                },
                formato, qualita
              );
            } else {
              tentaCompressione(idxFormato + 1);
            }
          },
          formato, qualita
        );
      }
      tentaCompressione(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Impossibile caricare l'immagine: ${file.name} (${file.type || 'tipo sconosciuto'})`));
    };
    img.src = url;
  });
}

/* ─── Normalizza campi messaggio API → formato UI italiano ─── */
function normalizzaMessaggio(raw) {
  return {
    ...raw,
    id: raw.id,
    da: raw.from || raw.da || null,
    a: raw.to || raw.a || null,
    ts: raw.createdAt || raw.ts || 0,
    eliminato: raw.deleted || raw.eliminato || false,
    modificato: !!raw.editedAt || raw.modificato || false,
  };
}

/* ─── Formatta timestamp relativo per lista conversazioni ─── */
function formatOraRelativa(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'adesso';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min fa`;
  const d = new Date(ts);
  const oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) return formatOra(ts);
  const ieri = new Date(oggi);
  ieri.setDate(oggi.getDate() - 1);
  if (d.toDateString() === ieri.toDateString()) return 'ieri';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/* ─── Cache globale chiavi AES per anteprime conversazioni ─── */
const _aesKeyCache = new Map();
async function ottieniAesKeyGlobale(privateKey, username) {
  if (_aesKeyCache.has(username)) return _aesKeyCache.get(username);
  const risposta = await fetch(`${API}?action=key&user=${username}`);
  const dati = await risposta.json();
  if (!dati.publicKey) return null;
  const pubKey = await importPublicKey(dati.publicKey);
  const aesKey = await deriveKey(privateKey, pubKey);
  _aesKeyCache.set(username, aesKey);
  return aesKey;
}

/* ═══════════════════════════════════════════════
   Spinner di caricamento
═══════════════════════════════════════════════ */
function SpinnerCentrale({ testo = 'Caricamento…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <Loader size={32} className="spin" style={{ color: 'var(--primary)' }} />
      <p style={{ color: 'var(--text-faint)', fontSize: '0.9rem' }}>{testo}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Primo dispositivo (setup-primo)
═══════════════════════════════════════════════ */
function FaseSetupPrimo({ username, token, onComplete }) {
  const [stato, setStato] = useState('generazione');
  const [errore, setErrore] = useState('');
  const [passkeyDispo, setPasskeyDispo] = useState(false);
  const [pwdBackup, setPwdBackup] = useState('');
  const [fileScaricat, setFileScaricat] = useState(false);
  const [scaricandoFile, setScaricandoFile] = useState(false);
  const privKeyTmpRef = useRef(null);

  useEffect(() => {
    isPasskeyPRFAvailable().then(setPasskeyDispo).catch(() => {});
  }, []);

  useEffect(() => {
    let annullato = false;
    async function inizializza() {
      try {
        const { privateKey } = await generateAndRegisterNewKeys(username, token);
        if (annullato) return;
        privKeyTmpRef.current = privateKey;

        /* ── Tenta salvataggio automatico nel portachiavi ── */
        const prfOk = await isPasskeyPRFAvailable().catch(() => false);
        if (prfOk && !annullato) {
          setStato('salvataggio-portachiavi');
          try {
            const { credentialId, encryptedPrivateKey, iv } = await createPasskeyAndEncryptKey(username, privateKey);
            if (annullato) return;
            const pubKeyStr = await estraiChiavePubblica(privateKey);
            await apiFetch(token, '', {
              method: 'POST',
              body: JSON.stringify({ action: 'save_passkey_backup', credentialId, encryptedPrivateKey, iv, publicKey: pubKeyStr }),
            });
            if (annullato) return;
            privKeyTmpRef.current = null;
            onComplete(privateKey);
            return;
          } catch (e) {
            /* PRF non supportato o utente ha annullato → mostra opzioni manuali */
            if (e?.message !== 'PRF_NOT_SUPPORTED') console.warn('Auto-passkey salvataggio fallito:', e);
            if (annullato) return;
          }
        }
        setStato('backup');
      } catch (e) {
        if (!annullato) setErrore(`Errore nella generazione chiavi: ${e.message}`);
      }
    }
    inizializza();
    return () => { annullato = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvaInPortachiavi() {
    const privKey = privKeyTmpRef.current;
    if (!privKey) return;
    try {
      setStato('generazione');
      const { credentialId, encryptedPrivateKey, iv } = await createPasskeyAndEncryptKey(username, privKey);
      const pubKeyStr = await estraiChiavePubblica(privKey);
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_passkey_backup', credentialId, encryptedPrivateKey, iv, publicKey: pubKeyStr }),
      });
      const pk = privKeyTmpRef.current;
      privKeyTmpRef.current = null;
      onComplete(pk);
    } catch (e) {
      if (e.message !== 'PRF_NOT_SUPPORTED') setErrore(`Errore salvataggio portachiavi: ${e.message}`);
      setStato('backup');
    }
  }

  async function scaricaBackupFile() {
    const privKey = privKeyTmpRef.current;
    if (!privKey || !pwdBackup) return;
    setScaricandoFile(true);
    setErrore('');
    try {
      const contenuto = await exportKeyToEncryptedFile(privKey, pwdBackup);
      const blob = new Blob([contenuto], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `andryx-backup-${username}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFileScaricat(true);
    } catch (e) {
      setErrore(`Errore download: ${e.message}`);
    } finally {
      setScaricandoFile(false);
    }
  }

  function completa() {
    const privKey = privKeyTmpRef.current;
    privKeyTmpRef.current = null;
    onComplete(privKey);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel"
      style={{ maxWidth: 480, margin: '40px auto', padding: '2rem', textAlign: 'center' }}
    >
      <Shield size={40} style={{ color: 'var(--primary)', marginBottom: 16 }} />
      <h2 style={{ marginBottom: 8 }}>Proteggi la tua chiave</h2>
      <p style={{ color: 'var(--text-faint)', marginBottom: 24, fontSize: '0.9rem' }}>
        Le tue chiavi E2E sono pronte. Scegli come salvarle in modo sicuro prima di continuare.
      </p>
      {errore && (
        <div className="msg-error-banner" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} /> {errore}
        </div>
      )}
      {(stato === 'generazione' || stato === 'salvataggio-portachiavi') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)' }}>
          <Loader size={18} className="spin" />
          <span>{stato === 'salvataggio-portachiavi' ? 'Salvataggio nel Portachiavi…' : 'Generazione chiavi in corso…'}</span>
        </div>
      )}
      {stato === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          {passkeyDispo && (
            <>
              <button
                className="msg-method-btn"
                style={{ border: '1px solid rgba(var(--primary-rgb, 99,102,241),0.6)', color: 'var(--primary)' }}
                onClick={salvaInPortachiavi}>
                <Fingerprint size={18} /> Salva nel Portachiavi — iCloud / Google
              </button>
              <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', margin: '-4px 0 4px 2px' }}>
                La chiave viene cifrata e sincronizzata automaticamente su tutti i tuoi dispositivi tramite iCloud Keychain o Google Password Manager. Opzione consigliata.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: '0.78rem', margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                oppure salva un backup file
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </>
          )}
          <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem', margin: 0 }}>
            Scarica un file JSON cifrato da password e conservalo su iCloud Drive, Google Drive o in un posto sicuro. Utile come copia extra o se non hai il Portachiavi.
          </p>
          <input
            className="mod-input"
            type="password"
            placeholder="Imposta password per il backup file…"
            value={pwdBackup}
            onChange={e => { setPwdBackup(e.target.value); setFileScaricat(false); }}
            onKeyDown={e => e.key === 'Enter' && pwdBackup && scaricaBackupFile()}
          />
          <button className="btn btn-ghost" disabled={!pwdBackup || scaricandoFile} onClick={scaricaBackupFile}>
            {scaricandoFile ? <Loader size={16} className="spin" /> : <Download size={16} />}
            {fileScaricat ? '✓ Scaricato — scarica di nuovo' : 'Scarica backup file'}
          </button>
          {fileScaricat && (
            <button className="btn btn-primary" onClick={completa}>
              <Check size={16} /> Continua
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 4 }}
            onClick={completa}>
            Salta (non consigliato)
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Altro dispositivo (setup-joiner)
═══════════════════════════════════════════════ */
function FaseSetupJoiner({ username, token, onComplete }) {
  const [metodo, setMetodo] = useState(null);
  const [codice, setCodice] = useState('');
  const [stato, setStato] = useState('attesa');
  const [errore, setErrore] = useState('');
  const [haBackup, setHaBackup] = useState(false);
  const [passkeyDispo, setPasskeyDispo] = useState(false);
  const [fileBackupContent, setFileBackupContent] = useState(null);
  const [pwdImport, setPwdImport] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pollTimerRef = useRef(null);
  const nuovaChiaveRef = useRef(null);
  const [pwdBackupNuova, setPwdBackupNuova] = useState('');
  const [fileScariNuova, setFileScariNuova] = useState(false);
  const [scariNuovaFile, setScariNuovaFile] = useState(false);

  useEffect(() => {
    let annullato = false;
    async function controllaEAutoRipristina() {
      try {
        const [backupRes, prfOk] = await Promise.all([
          fetch(`${API}?action=has_passkey_backup&user=${username}`).then(r => r.json()),
          isPasskeyPRFAvailable().catch(() => false),
        ]);
        if (annullato) return;
        const hb = !!backupRes.hasBackup;
        setHaBackup(hb);
        setPasskeyDispo(prfOk);

        /* ── Tentativo automatico di ripristino da portachiavi ── */
        if (hb && prfOk) {
          setMetodo('passkey');
          setStato('caricamento');
          try {
            const backup = await apiFetch(token, '?action=get_passkey_backup', {});
            if (annullato) return;
            const privKey = await authenticatePasskeyAndDecryptKey(backup.encryptedPrivateKey, backup.iv, backup.credentialId);
            if (annullato) return;
            await saveAndRegisterKeyPair(username, token, privKey, backup.publicKey);
            setStato('ok');
            setTimeout(() => onComplete(privKey), 600);
            return;
          } catch (e) {
            /* Utente ha annullato o PRF fallito → mostra selezione metodo */
            console.warn('Auto-passkey ripristino fallito:', e);
            if (annullato) return;
            setMetodo(null);
            setStato('attesa');
          }
        }
      } catch {
        if (!annullato) { setHaBackup(false); setPasskeyDispo(false); }
      }
    }
    controllaEAutoRipristina();
    return () => { annullato = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      clearTimeout(pollTimerRef.current);
    };
  }, []);

  async function attendiStatoSync(sessionId, statiTarget, tentativo = 0) {
    if (tentativo > 30) throw new Error('Timeout attesa sincronizzazione.');
    const dati = await apiFetch(token, `?action=sync_status&sessionId=${sessionId}`, {});
    if (statiTarget.includes(dati.status)) return dati;
    await new Promise(r => setTimeout(r, 2000));
    return attendiStatoSync(sessionId, statiTarget, tentativo + 1);
  }

  async function completaJoinConDati(codiceInput, sessionId, initiatorEphPubJwk) {
    setStato('caricamento');
    try {
      const joinerEphPair = await createSyncEphemeralPair(sessionId);
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_join', code: codiceInput, joinerEphemeralPubKey: joinerEphPair.publicKeyJwk }),
      });
      await attendiStatoSync(sessionId, ['ready', 'complete']);
      const datiSync = await apiFetch(token, `?action=sync_status&sessionId=${sessionId}`, {});
      const identityPrivKey = await decryptIdentityKeyFromSync(
        datiSync.encryptedKey,
        datiSync.iv,
        joinerEphPair.privateKey,
        initiatorEphPubJwk || datiSync.initiatorEphemeralPubKey
      );
      const pubKeyStr = await estraiChiavePubblica(identityPrivKey);
      await saveAndRegisterKeyPair(username, token, identityPrivKey, pubKeyStr);
      await apiFetch(token, '', { method: 'POST', body: JSON.stringify({ action: 'sync_complete', sessionId }) });
      await deleteSyncEphemeralPair(sessionId);
      setStato('ok');
      setTimeout(() => onComplete(identityPrivKey), 600);
    } catch (e) {
      setErrore(`Errore sincronizzazione: ${e.message}`);
      setStato('errore');
    }
  }

  async function completaJoinConCodice() {
    const c = codice.trim().replace(/\s/g, '');
    if (c.length !== 6) { setErrore('Il codice deve essere di 6 cifre.'); return; }
    setStato('caricamento');
    setErrore('');
    try {
      const peek = await fetch(`${API}?action=sync_peek&code=${c}`).then(r => r.json());
      if (!peek.sessionId) throw new Error('Codice non valido o scaduto.');
      await completaJoinConDati(c, peek.sessionId, peek.initiatorEphemeralPubKey);
    } catch (e) {
      setErrore(e.message);
      setStato('errore');
    }
  }

  async function avviaScansione() {
    setMetodo('qr');
    setStato('caricamento');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStato('attesa');
      avviaBarcodeDetector();
    } catch {
      setErrore('Impossibile accedere alla fotocamera.');
      setStato('errore');
    }
  }

  function avviaBarcodeDetector() {
    if (!('BarcodeDetector' in window)) {
      setErrore('BarcodeDetector non supportato. Usa il metodo manuale.');
      setStato('errore');
      return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    async function scansiona() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        pollTimerRef.current = setTimeout(scansiona, 300);
        return;
      }
      try {
        const risultati = await detector.detect(videoRef.current);
        if (risultati.length > 0) {
          const dati = JSON.parse(risultati[0].rawValue);
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          await completaJoinConDati(dati.code, dati.sessionId, dati.initiatorEphemeralPubKey);
          return;
        }
      } catch { /* continua */ }
      pollTimerRef.current = setTimeout(scansiona, 300);
    }
    scansiona();
  }

  async function ripristinaDaPortachiavi() {
    setMetodo('passkey');
    setStato('caricamento');
    try {
      const backup = await apiFetch(token, '?action=get_passkey_backup', {});
      const privKey = await authenticatePasskeyAndDecryptKey(backup.encryptedPrivateKey, backup.iv, backup.credentialId);
      await saveAndRegisterKeyPair(username, token, privKey, backup.publicKey);
      setStato('ok');
      setTimeout(() => onComplete(privKey), 600);
    } catch (e) {
      setErrore(`Errore ripristino portachiavi: ${e.message}`);
      setStato('errore');
    }
  }

  async function ripristinaDaFile() {
    if (!fileBackupContent || !pwdImport) return;
    setStato('caricamento');
    setErrore('');
    try {
      const privKey   = await importKeyFromEncryptedFile(fileBackupContent, pwdImport);
      const pubKeyStr = await estraiChiavePubblica(privKey);
      await saveAndRegisterKeyPair(username, token, privKey, pubKeyStr);
      setStato('ok');
      setTimeout(() => onComplete(privKey), 600);
    } catch (e) {
      setErrore(e.message);
      setStato('errore');
    }
  }

  async function creaNuovaChiave() {
    setStato('caricamento');
    setErrore('');
    try {
      const { privateKey } = await generateAndRegisterNewKeys(username, token);
      nuovaChiaveRef.current = privateKey;
      /* ── Tenta salvataggio automatico nel portachiavi ── */
      if (passkeyDispo) {
        try {
          const { credentialId, encryptedPrivateKey, iv } = await createPasskeyAndEncryptKey(username, privateKey);
          const pubKeyStr = await estraiChiavePubblica(privateKey);
          await apiFetch(token, '', {
            method: 'POST',
            body: JSON.stringify({ action: 'save_passkey_backup', credentialId, encryptedPrivateKey, iv, publicKey: pubKeyStr }),
          });
          nuovaChiaveRef.current = null;
          setStato('ok');
          setTimeout(() => onComplete(privateKey), 600);
          return;
        } catch (e) {
          if (e?.message !== 'PRF_NOT_SUPPORTED') console.warn('Auto-passkey salvataggio fallito:', e);
        }
      }
      setMetodo('nuova-chiave-backup');
      setStato('backup');
    } catch (e) {
      setErrore(`Errore nella generazione chiavi: ${e.message}`);
      setStato('errore');
    }
  }

  async function salvaPortachiaviNuova() {
    const privKey = nuovaChiaveRef.current;
    if (!privKey) return;
    try {
      setStato('caricamento');
      const { credentialId, encryptedPrivateKey, iv } = await createPasskeyAndEncryptKey(username, privKey);
      const pubKeyStr = await estraiChiavePubblica(privKey);
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_passkey_backup', credentialId, encryptedPrivateKey, iv, publicKey: pubKeyStr }),
      });
      const pk = nuovaChiaveRef.current;
      nuovaChiaveRef.current = null;
      onComplete(pk);
    } catch (e) {
      if (e.message !== 'PRF_NOT_SUPPORTED') setErrore(`Errore salvataggio portachiavi: ${e.message}`);
      setStato('backup');
    }
  }

  async function scaricaFileNuova() {
    const privKey = nuovaChiaveRef.current;
    if (!privKey || !pwdBackupNuova) return;
    setScariNuovaFile(true);
    setErrore('');
    try {
      const contenuto = await exportKeyToEncryptedFile(privKey, pwdBackupNuova);
      const blob = new Blob([contenuto], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `andryx-backup-${username}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFileScariNuova(true);
    } catch (e) {
      setErrore(`Errore download: ${e.message}`);
    } finally {
      setScariNuovaFile(false);
    }
  }

  function completaNuovaChiave() {
    const pk = nuovaChiaveRef.current;
    nuovaChiaveRef.current = null;
    onComplete(pk);
  }

  function tornaIndietro() {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    clearTimeout(pollTimerRef.current);
    setMetodo(null);
    setErrore('');
    setStato('attesa');
    setFileBackupContent(null);
    setPwdImport('');
  }

  /* ─── Selezione metodo ─── */
  if (!metodo) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 480, margin: '40px auto', padding: '2rem', textAlign: 'center' }}>
        <Key size={40} style={{ color: 'var(--accent)', marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Aggiungi questo dispositivo</h2>
        <p style={{ color: 'var(--text-faint)', marginBottom: 28, fontSize: '0.9rem' }}>
          Le tue chiavi esistono già. Scegli come ripristinarle su questo dispositivo.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {haBackup && passkeyDispo && (
            <button
              className="msg-method-btn"
              style={{ border: '1px solid rgba(var(--primary-rgb, 99,102,241),0.6)', color: 'var(--primary)' }}
              onClick={ripristinaDaPortachiavi}>
              <Fingerprint size={18} /> Portachiavi — iCloud / Google
            </button>
          )}
          <button className="msg-method-btn" onClick={() => setMetodo('file')}>
            <Upload size={18} /> Importa da backup file
          </button>
          <button className="msg-method-btn" onClick={() => setMetodo('codice')}>
            <KeyRound size={18} /> Inserisci codice di sincronizzazione
          </button>
          <button className="msg-method-btn" onClick={avviaScansione}>
            <QrCode size={18} /> Scansiona QR code
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <button
            className="msg-method-btn"
            style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}
            onClick={() => setMetodo('nuova-chiave')}>
            <ShieldAlert size={18} /> Crea nuova chiave (perdita totale)
          </button>
        </div>
      </motion.div>
    );
  }

  /* ─── Metodo portachiavi ─── */
  if (metodo === 'passkey') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 420, margin: '40px auto', padding: '2rem', textAlign: 'center' }}>
        {stato === 'caricamento' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Loader size={32} className="spin" style={{ color: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-faint)' }}>Verifica portachiavi in corso…</p>
          </div>
        )}
        {stato === 'ok' && (
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Check size={24} /> Ripristino completato!
          </div>
        )}
        {stato === 'errore' && (
          <>
            <div className="msg-error-banner" style={{ marginBottom: 16 }}><AlertTriangle size={14} /> {errore}</div>
            <button className="btn btn-ghost" onClick={tornaIndietro}><ArrowLeft size={16} /> Indietro</button>
          </>
        )}
      </motion.div>
    );
  }

  /* ─── Metodo file backup ─── */
  if (metodo === 'file') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 420, margin: '40px auto', padding: '2rem' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={tornaIndietro}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <h3 style={{ marginBottom: 8 }}>
          <Upload size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Importa backup file
        </h3>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginBottom: 16 }}>
          Seleziona il file <code>.json</code> salvato in precedenza (iCloud Drive, Google Drive, ecc.) e inserisci la password con cui è stato protetto.
        </p>
        {errore && <div className="msg-error-banner" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> {errore}</div>}
        {stato === 'ok' ? (
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Check size={20} /> Chiave ripristinata!
          </div>
        ) : (
          <>
            <label
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 10, cursor: 'pointer' }}>
              <Upload size={16} />
              {fileBackupContent ? '✓ File caricato — cambia file' : 'Seleziona file backup (.json)'}
              <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = ev => { setFileBackupContent(ev.target.result); setErrore(''); };
                  reader.readAsText(f);
                  e.target.value = '';
                }} />
            </label>
            <input
              className="mod-input"
              type="password"
              placeholder="Password del backup…"
              value={pwdImport}
              onChange={e => setPwdImport(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fileBackupContent && pwdImport && ripristinaDaFile()}
              style={{ marginBottom: 12 }}
            />
            <button className="btn btn-primary" style={{ width: '100%' }}
              disabled={!fileBackupContent || !pwdImport || stato === 'caricamento'}
              onClick={ripristinaDaFile}>
              {stato === 'caricamento' ? <Loader size={16} className="spin" /> : <Lock size={16} />}
              Ripristina chiave
            </button>
          </>
        )}
      </motion.div>
    );
  }

  /* ─── Metodo codice ─── */
  if (metodo === 'codice') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 420, margin: '40px auto', padding: '2rem' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={tornaIndietro}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <h3 style={{ marginBottom: 8 }}>
          <KeyRound size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Codice di sincronizzazione
        </h3>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginBottom: 16 }}>
          Inserisci il codice a 6 cifre mostrato sul tuo altro dispositivo.
        </p>
        {errore && <div className="msg-error-banner" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> {errore}</div>}
        <input
          className="mod-input"
          style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.4rem', marginBottom: 16 }}
          maxLength={6}
          placeholder="000000"
          value={codice}
          onChange={e => setCodice(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && completaJoinConCodice()}
        />
        {stato === 'ok' ? (
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Check size={20} /> Sincronizzato!
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }}
            disabled={codice.length !== 6 || stato === 'caricamento'}
            onClick={completaJoinConCodice}>
            {stato === 'caricamento' ? <Loader size={16} className="spin" /> : <Lock size={16} />}
            Sincronizza
          </button>
        )}
      </motion.div>
    );
  }

  /* ─── Metodo QR ─── */
  if (metodo === 'qr') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 420, margin: '40px auto', padding: '2rem', textAlign: 'center' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={tornaIndietro}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <h3 style={{ marginBottom: 12 }}>
          <QrCode size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Scansiona il QR code
        </h3>
        {errore && <div className="msg-error-banner" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> {errore}</div>}
        {stato === 'caricamento' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)', marginBottom: 16 }}>
            <Loader size={18} className="spin" /> Accesso fotocamera…
          </div>
        )}
        {stato === 'ok' && (
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Check size={20} /> Sincronizzato!
          </div>
        )}
        <video ref={videoRef}
          style={{ width: '100%', borderRadius: 12, display: stato === 'attesa' ? 'block' : 'none', background: '#000' }}
          muted playsInline />
      </motion.div>
    );
  }

  /* ─── Metodo nuova chiave (perdita totale) ─── */
  if (metodo === 'nuova-chiave') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 420, margin: '40px auto', padding: '2rem', textAlign: 'center' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={tornaIndietro}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <ShieldAlert size={40} style={{ color: '#f87171', marginBottom: 12 }} />
        <h3 style={{ marginBottom: 8 }}>Crea nuova chiave</h3>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginBottom: 8 }}>
          Usa questa opzione <strong>solo se hai perso sia il dispositivo che il backup</strong>.
        </p>
        <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 20 }}>
          ⚠️ I messaggi precedenti non saranno più leggibili. Questa azione è irreversibile.
        </p>
        {errore && <div className="msg-error-banner" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> {errore}</div>}
        {stato === 'ok' ? (
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Check size={20} /> Nuova chiave creata!
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
            disabled={stato === 'caricamento'}
            onClick={creaNuovaChiave}>
            {stato === 'caricamento' ? <Loader size={16} className="spin" /> : <ShieldAlert size={16} />}
            Confermo, crea nuova chiave
          </button>
        )}
      </motion.div>
    );
  }

  /* ─── Backup dopo creazione nuova chiave ─── */
  if (metodo === 'nuova-chiave-backup') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ maxWidth: 480, margin: '40px auto', padding: '2rem', textAlign: 'center' }}>
        <Shield size={40} style={{ color: 'var(--primary)', marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Proteggi la tua nuova chiave</h2>
        <p style={{ color: 'var(--text-faint)', marginBottom: 24, fontSize: '0.9rem' }}>
          Nuova chiave creata. Salva un backup prima di continuare per non perderla.
        </p>
        {errore && (
          <div className="msg-error-banner" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> {errore}
          </div>
        )}
        {stato === 'caricamento' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)' }}>
            <Loader size={18} className="spin" />
            <span>Salvataggio in corso…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            {passkeyDispo && (
              <>
                <button
                  className="msg-method-btn"
                  style={{ border: '1px solid rgba(var(--primary-rgb, 99,102,241),0.6)', color: 'var(--primary)' }}
                  onClick={salvaPortachiaviNuova}>
                  <Fingerprint size={18} /> Salva nel Portachiavi — iCloud / Google
                </button>
                <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', margin: '-4px 0 4px 2px' }}>
                  La chiave viene cifrata e sincronizzata automaticamente su tutti i tuoi dispositivi.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: '0.78rem', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  oppure salva un backup file
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>
              </>
            )}
            <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem', margin: 0 }}>
              Scarica un file JSON cifrato da conservare su iCloud Drive, Google Drive o in un posto sicuro.
            </p>
            <input
              className="mod-input"
              type="password"
              placeholder="Imposta password per il backup file…"
              value={pwdBackupNuova}
              onChange={e => { setPwdBackupNuova(e.target.value); setFileScariNuova(false); }}
              onKeyDown={e => e.key === 'Enter' && pwdBackupNuova && scaricaFileNuova()}
            />
            <button className="btn btn-ghost" disabled={!pwdBackupNuova || scariNuovaFile} onClick={scaricaFileNuova}>
              {scariNuovaFile ? <Loader size={16} className="spin" /> : <Download size={16} />}
              {fileScariNuova ? '✓ Scaricato — scarica di nuovo' : 'Scarica backup file'}
            </button>
            {fileScariNuova && (
              <button className="btn btn-primary" onClick={completaNuovaChiave}>
                <Check size={16} /> Continua
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 4 }}
              onClick={completaNuovaChiave}>
              Salta (non consigliato)
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  return null;
}
function PannelloSyncInitiator({ token, privateKeyRef, onChiudi }) {
  const [stato, setStato] = useState('avvio');
  const [codice, setCodice] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [errore, setErrore] = useState('');
  const [copiato, setCopiato] = useState(false);
  const pollTimerRef = useRef(null);
  const ephPairRef = useRef(null);
  const sessIdRef = useRef('');

  useEffect(() => {
    avviaSync();
    return () => clearTimeout(pollTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function avviaSync() {
    setStato('avvio');
    setErrore('');
    try {
      const tmpId = crypto.randomUUID();
      const ephPair = await createSyncEphemeralPair(tmpId);
      ephPairRef.current = ephPair;

      const risposta = await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_start', initiatorEphemeralPubKey: ephPair.publicKeyJwk }),
      });

      sessIdRef.current = risposta.sessionId;
      setCodice(risposta.code);

      const qrDati = JSON.stringify({ code: risposta.code, sessionId: risposta.sessionId, initiatorEphemeralPubKey: ephPair.publicKeyJwk });
      const url = await QRCode.toDataURL(qrDati, { width: 220, margin: 2 });
      setQrDataUrl(url);
      setStato('codice');

      pollAttesaJoin(risposta.sessionId, ephPair, 0);
    } catch (e) {
      setErrore(`Errore avvio sync: ${e.message}`);
      setStato('errore');
    }
  }

  function pollAttesaJoin(sessId, ephPair, tentativo) {
    if (tentativo > 60) { setErrore('Timeout: nessun dispositivo si è connesso.'); setStato('errore'); return; }
    pollTimerRef.current = setTimeout(async () => {
      try {
        const dati = await apiFetch(token, `?action=sync_status&sessionId=${sessId}`, {});
        if (dati.status === 'joined' || dati.status === 'pending_delivery') {
          setStato('consegna');
          await consegnaChiave(sessId, ephPair, dati.joinerEphemeralPubKey);
          return;
        }
      } catch { /* continua */ }
      pollAttesaJoin(sessId, ephPair, tentativo + 1);
    }, 2000);
  }

  async function consegnaChiave(sessId, ephPair, joinerEphPubJwk) {
    try {
      const { encryptedKey, iv } = await encryptIdentityKeyForSync(ephPair.privateKey, privateKeyRef.current, joinerEphPubJwk);
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_deliver', sessionId: sessId, encryptedKey, iv }),
      });
      attendiCompletamento(sessId, 0);
    } catch (e) {
      setErrore(`Errore consegna chiave: ${e.message}`);
      setStato('errore');
    }
  }

  function attendiCompletamento(sessId, tentativo) {
    if (tentativo > 30) { setStato('ok'); return; }
    pollTimerRef.current = setTimeout(async () => {
      try {
        const dati = await apiFetch(token, `?action=sync_status&sessionId=${sessId}`, {});
        if (dati.status === 'complete' || dati.status === 'ready' || dati.status === 'expired') { setStato('ok'); return; }
      } catch { /* continua */ }
      attendiCompletamento(sessId, tentativo + 1);
    }, 2000);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="glass-panel"
      style={{ maxWidth: 420, margin: '0 auto', padding: '1.5rem', textAlign: 'center', position: 'relative' }}>
      <button onClick={onChiudi}
        style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
        <X size={18} />
      </button>
      <h3 style={{ marginBottom: 12 }}>
        <Smartphone size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Aggiungi dispositivo
      </h3>

      {stato === 'avvio' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)' }}>
          <Loader size={18} className="spin" /> Generazione codice…
        </div>
      )}

      {stato === 'codice' && codice && (
        <>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', marginBottom: 16 }}>
            Mostra questo codice o QR al nuovo dispositivo. Scade in 5 minuti.
          </p>
          <div style={{ fontSize: '2.5rem', letterSpacing: '0.4em', fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
            {codice}
          </div>
          <button className="btn btn-ghost" style={{ marginBottom: 16, fontSize: '0.8rem' }}
            onClick={async () => { const ok = await copiaNeglAppunti(codice); if (ok) { setCopiato(true); setTimeout(() => setCopiato(false), 2000); } }}>
            {copiato ? <><Check size={14} /> Copiato!</> : <><Copy size={14} /> Copia codice</>}
          </button>
          {qrDataUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src={qrDataUrl} alt="QR code sincronizzazione" style={{ borderRadius: 8 }} />
            </div>
          )}
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
            <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            In attesa che il nuovo dispositivo si connetta…
          </p>
        </>
      )}

      {stato === 'consegna' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)' }}>
          <Loader size={18} className="spin" /> Trasmissione chiave cifrata…
        </div>
      )}

      {stato === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Check size={32} style={{ color: 'var(--accent)' }} />
          <p>Dispositivo sincronizzato con successo!</p>
          <button className="btn btn-primary" onClick={onChiudi}>Chiudi</button>
        </div>
      )}

      {stato === 'errore' && (
        <div>
          <div className="msg-error-banner" style={{ marginBottom: 16 }}><AlertTriangle size={14} /> {errore}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={avviaSync}><RefreshCw size={14} /> Riprova</button>
            <button className="btn btn-ghost" onClick={onChiudi}>Chiudi</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Gestione backup chiavi
═══════════════════════════════════════════════ */
function PannelloGestioneBackup({ token, username, privateKeyRef, onChiudi }) {
  const [stato, setStato] = useState('caricamento');
  const [haBackup, setHaBackup] = useState(false);
  const [dataBackup, setDataBackup] = useState(null);
  const [errore, setErrore] = useState('');
  const [passkeyDispo, setPasskeyDispo] = useState(false);
  const [pwdFile, setPwdFile] = useState('');
  const [fileScaricat, setFileScaricat] = useState(false);
  const [scaricandoFile, setScaricandoFile] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);

  useEffect(() => {
    let annullato = false;
    async function caricaStato() {
      try {
        const [backupRes, prfOk] = await Promise.all([
          fetch(`${API}?action=has_passkey_backup&user=${username}`).then(r => r.json()),
          isPasskeyPRFAvailable().catch(() => false),
        ]);
        if (annullato) return;
        setHaBackup(!!backupRes.hasBackup);
        setPasskeyDispo(prfOk);
        if (backupRes.hasBackup) {
          try {
            const dati = await apiFetch(token, '?action=get_passkey_backup', {});
            if (!annullato) setDataBackup(dati);
          } catch { /* best effort */ }
        }
      } catch { /* ignora */ }
      if (!annullato) setStato('pronto');
    }
    caricaStato();
    return () => { annullato = true; };
  }, [token, username]);

  async function salvaInPortachiavi() {
    const privKey = privateKeyRef.current;
    if (!privKey) return;
    setStato('salvataggio');
    setErrore('');
    try {
      const { credentialId, encryptedPrivateKey, iv } = await createPasskeyAndEncryptKey(username, privKey);
      const pubKeyStr = await estraiChiavePubblica(privKey);
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_passkey_backup', credentialId, encryptedPrivateKey, iv, publicKey: pubKeyStr }),
      });
      setHaBackup(true);
      setDataBackup({ savedAt: Date.now() });
      setStato('pronto');
    } catch (e) {
      if (e.message === 'PRF_NOT_SUPPORTED') setErrore('Il tuo browser non supporta il Portachiavi con PRF.');
      else setErrore(`Errore: ${e.message}`);
      setStato('pronto');
    }
  }

  async function scaricaBackupFile() {
    const privKey = privateKeyRef.current;
    if (!privKey || !pwdFile) return;
    setScaricandoFile(true);
    setErrore('');
    try {
      const contenuto = await exportKeyToEncryptedFile(privKey, pwdFile);
      const blob = new Blob([contenuto], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `andryx-backup-${username}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFileScaricat(true);
    } catch (e) {
      setErrore(`Errore download: ${e.message}`);
    } finally {
      setScaricandoFile(false);
    }
  }

  async function eliminaBackup() {
    setStato('salvataggio');
    setErrore('');
    try {
      await apiFetch(token, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_passkey_backup' }),
      });
      setHaBackup(false);
      setDataBackup(null);
      setConfermaElimina(false);
      setStato('pronto');
    } catch (e) {
      setErrore(`Errore eliminazione: ${e.message}`);
      setStato('pronto');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="glass-panel"
      style={{ maxWidth: 440, margin: '0 auto', padding: '1.5rem', textAlign: 'center', position: 'relative' }}>
      <button onClick={onChiudi}
        style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
        <X size={18} />
      </button>
      <Shield size={28} style={{ color: 'var(--primary)', marginBottom: 12 }} />
      <h3 style={{ marginBottom: 4 }}>Gestione backup</h3>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem', marginBottom: 20 }}>
        Gestisci il backup della tua chiave di cifratura E2E.
      </p>
      {errore && (
        <div className="msg-error-banner" style={{ marginBottom: 16 }}>
          <AlertTriangle size={14} /> {errore}
        </div>
      )}
      {(stato === 'caricamento' || stato === 'salvataggio') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)', marginBottom: 16 }}>
          <Loader size={18} className="spin" />
          <span>{stato === 'salvataggio' ? 'Salvataggio in corso…' : 'Caricamento…'}</span>
        </div>
      )}
      {stato === 'pronto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          {/* Stato backup portachiavi */}
          <div className="glass-card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Fingerprint size={16} style={{ color: haBackup ? 'var(--accent)' : 'var(--text-faint)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Portachiavi</span>
              <span style={{
                marginLeft: 'auto', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10,
                background: haBackup ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                color: haBackup ? '#22c55e' : '#ef4444',
              }}>
                {haBackup ? '✓ Attivo' : '✗ Non configurato'}
              </span>
            </div>
            {haBackup && dataBackup?.savedAt && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: 0 }}>
                Ultimo salvataggio: {new Date(dataBackup.savedAt).toLocaleString('it-IT')}
              </p>
            )}
          </div>

          {/* Azioni portachiavi */}
          {passkeyDispo && (
            <button
              className="msg-method-btn"
              style={{ border: '1px solid rgba(var(--primary-rgb, 99,102,241),0.6)', color: 'var(--primary)' }}
              onClick={salvaInPortachiavi}>
              <Fingerprint size={18} />
              {haBackup ? 'Aggiorna backup nel Portachiavi' : 'Salva nel Portachiavi — iCloud / Google'}
            </button>
          )}

          {/* Backup file */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: '0.78rem', margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            backup file
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem', margin: 0 }}>
            Scarica un file JSON cifrato da conservare come copia di sicurezza.
          </p>
          <input
            className="mod-input"
            type="password"
            placeholder="Password per il backup file…"
            value={pwdFile}
            onChange={e => { setPwdFile(e.target.value); setFileScaricat(false); }}
            onKeyDown={e => e.key === 'Enter' && pwdFile && scaricaBackupFile()}
          />
          <button className="btn btn-ghost" disabled={!pwdFile || scaricandoFile} onClick={scaricaBackupFile}>
            {scaricandoFile ? <Loader size={16} className="spin" /> : <Download size={16} />}
            {fileScaricat ? '✓ Scaricato — scarica di nuovo' : 'Scarica backup file'}
          </button>

          {/* Elimina backup */}
          {haBackup && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              {!confermaElimina ? (
                <button
                  className="btn btn-ghost"
                  style={{ color: '#f87171', fontSize: '0.82rem' }}
                  onClick={() => setConfermaElimina(true)}>
                  <Trash2 size={14} /> Elimina backup dal server
                </button>
              ) : (
                <div className="glass-card" style={{ padding: '0.6rem 0.75rem', border: '1px solid rgba(248,113,113,0.3)' }}>
                  <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                    Eliminare il backup dal server? Non potrai ripristinare la chiave da un nuovo dispositivo senza un altro backup.
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => setConfermaElimina(false)}>
                      Annulla
                    </button>
                    <button className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      onClick={eliminaBackup}>
                      Sì, elimina
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Avatar utente con immagine Twitch reale
   (se disponibile in cache) + fallback lettera
═══════════════════════════════════════════════ */
const AvatarUtente = memo(function AvatarUtente({ username, avatarCache, dimensione = 36, className = '' }) {
  /* Salva l'URL che ha generato errore — se l'URL cambia, l'immagine viene riprovata */
  const [urlErrore, setUrlErrore] = useState(null);
  const url = avatarCache?.[username] || null;
  const mostraImg = url && url !== urlErrore;
  const iniziale = username?.[0]?.toUpperCase() || '?';
  const stile = { width: dimensione, height: dimensione, fontSize: Math.round(dimensione * 0.36) };

  if (mostraImg) {
    return (
      <img
        src={url}
        alt={username}
        className={`msg-avatar${className ? ' ' + className : ''}`}
        style={{ ...stile, objectFit: 'cover' }}
        onError={() => setUrlErrore(url)}
      />
    );
  }
  return (
    <div className={`msg-avatar${className ? ' ' + className : ''}`} style={stile}>
      {iniziale}
    </div>
  );
});

/* ═══════════════════════════════════════════════
   Pannello nuova conversazione con lista amici
═══════════════════════════════════════════════ */
function PannelloNuovaConvo({ twitchUser, amici, conversazioni, avatarCache, onAvvia, onChiudi }) {
  const [cerca, setCerca] = useState('');
  const [errore, setErrore] = useState('');
  const [ricercando, setRicercando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const convoSet = new Set(conversazioni.map(c => c.user));
  const q = cerca.toLowerCase().trim();

  const amiciFiltrati = amici.filter(a => !q || a.toLowerCase().includes(q));
  const amiciInChat = amiciFiltrati.filter(a => convoSet.has(a));
  const amiciNuovi = amiciFiltrati.filter(a => !convoSet.has(a));
  const utenteManuale = q.length >= 2 && !amici.find(a => a === q) ? q : null;

  async function avvia(dest) {
    const d = dest.trim().toLowerCase();
    if (!d || d === twitchUser) { setErrore('Inserisci un utente valido.'); return; }
    setRicercando(true);
    setErrore('');
    try {
      const dati = await fetch(`${API}?action=key&user=${encodeURIComponent(d)}`).then(r => r.json()).catch(() => ({}));
      if (!dati.publicKey) {
        setErrore(`${d} non ha ancora attivato i messaggi sicuri.`);
        setRicercando(false);
        return;
      }
      onAvvia(d);
    } catch {
      setErrore('Errore di rete. Riprova.');
      setRicercando(false);
    }
  }

  return (
    <motion.div className="msg-forward-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onChiudi}>
      <motion.div
        className="glass-panel msg-nuova-convo-panel"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="msg-nuova-convo-header">
          <MessageSquare size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>Nuova conversazione</span>
          <button className="mod-icon-btn" style={{ marginLeft: 'auto' }} onClick={onChiudi}><X size={16} /></button>
        </div>

        {/* Campo ricerca */}
        <div className="msg-nuova-convo-search">
          <Search size={14} style={{
            position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-faint)', pointerEvents: 'none',
          }} />
          <input
            ref={inputRef}
            className="mod-input"
            style={{ paddingLeft: 34 }}
            placeholder="Cerca amico o username Twitch…"
            value={cerca}
            onChange={e => { setCerca(e.target.value); setErrore(''); }}
            onKeyDown={e => e.key === 'Enter' && cerca.trim().length >= 2 && avvia(cerca)}
          />
        </div>

        {errore && (
          <div className="msg-error-banner" style={{ margin: '0 0.6rem 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={12} /> {errore}
          </div>
        )}

        {/* Lista amici */}
        <div className="msg-nuova-convo-lista">

          {/* Amici già con chat aperta */}
          {amiciInChat.length > 0 && (
            <>
              <div className="msg-sezione-label">Chat esistenti</div>
              {amiciInChat.map(a => (
                <button key={a} className="msg-amico-item" onClick={() => avvia(a)}>
                  <AvatarUtente username={a} avatarCache={avatarCache} dimensione={36} />
                  <div className="msg-amico-info">
                    <span className="msg-amico-nome">{a}</span>
                    <span className="msg-amico-sub">Amico · Continua chat</span>
                  </div>
                  <MessageSquare size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}

          {/* Amici senza chat */}
          {amiciNuovi.length > 0 && (
            <>
              <div className="msg-sezione-label" style={{ marginTop: amiciInChat.length ? 8 : 0 }}>Amici</div>
              {amiciNuovi.map(a => (
                <button key={a} className="msg-amico-item" onClick={() => avvia(a)}>
                  <AvatarUtente username={a} avatarCache={avatarCache} dimensione={36} />
                  <div className="msg-amico-info">
                    <span className="msg-amico-nome">{a}</span>
                    <span className="msg-amico-sub" style={{ color: 'var(--primary)' }}>Inizia chat</span>
                  </div>
                  <Plus size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}

          {/* Utente non in lista amici (digitato manualmente) */}
          {utenteManuale && (
            <>
              {(amiciInChat.length > 0 || amiciNuovi.length > 0) && (
                <div className="msg-sezione-label" style={{ marginTop: 8 }}>Altro</div>
              )}
              <button className="msg-amico-item msg-amico-item-manual"
                disabled={ricercando} onClick={() => avvia(cerca)}>
                {ricercando
                  ? <Loader size={22} className="spin" style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  : <UserPlus size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                }
                <div className="msg-amico-info">
                  <span className="msg-amico-nome">Avvia chat con &ldquo;{cerca}&rdquo;</span>
                  <span className="msg-amico-sub">Utente non in lista amici</span>
                </div>
              </button>
            </>
          )}

          {/* Stato vuoto */}
          {amiciFiltrati.length === 0 && !utenteManuale && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-faint)' }}>
              <Users size={32} style={{ marginBottom: 10, opacity: 0.35, display: 'block', margin: '0 auto 10px' }} />
              {amici.length === 0 ? (
                <>
                  <p style={{ fontSize: '0.88rem', marginBottom: 4 }}>Nessun amico ancora.</p>
                  <p style={{ fontSize: '0.78rem' }}>Digita un username Twitch sopra per iniziare.</p>
                </>
              ) : (
                <p style={{ fontSize: '0.88rem' }}>Nessun amico trovato per &ldquo;{cerca}&rdquo;.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Player messaggio vocale
═══════════════════════════════════════════════ */
function VoiceMessagePlayer({ src, durata }) {
  const audioRef = useRef(null);
  const [inRiproduzione, setInRiproduzione] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [durataReale, setDurataReale] = useState(durata || 0);

  function toggle() {
    if (!audioRef.current || !src) return;
    if (inRiproduzione) { audioRef.current.pause(); setInRiproduzione(false); }
    else { audioRef.current.play().then(() => setInRiproduzione(true)).catch(() => {}); }
  }

  function onTimeUpdate() {
    if (!audioRef.current) return;
    const pct = audioRef.current.duration > 0 ? audioRef.current.currentTime / audioRef.current.duration : 0;
    setProgresso(pct);
  }

  function onLoaded() {
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setDurataReale(Math.round(audioRef.current.duration));
    }
  }

  function formattaDurata(sec) {
    if (!sec || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  if (!src) return <div className="msg-voice-placeholder"><Loader size={14} className="spin" /> Caricamento audio…</div>;

  return (
    <div className="msg-voice-player">
      <audio ref={audioRef} src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoaded}
        onEnded={() => { setInRiproduzione(false); setProgresso(0); }}
        preload="metadata" />
      <button className="msg-voice-play-btn" onClick={toggle}>
        {inRiproduzione
          ? <Square size={14} fill="currentColor" />
          : <Mic size={14} />}
      </button>
      <div className="msg-voice-track">
        <div className="msg-voice-progress" style={{ width: `${progresso * 100}%` }} />
      </div>
      <span className="msg-voice-duration">{formattaDurata(durataReale)}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Singolo messaggio
═══════════════════════════════════════════════ */
const MessaggioBubble = memo(function MessaggioBubble({ msg, mio, raggruppato, onModifica, onElimina, onInoltra, onRispondi, reazioni, onReazione, renderTestoConEmote, onApriMedia }) {
  const [menuAperto, setMenuAperto] = useState(false);
  /* Coordinate click destro (solo desktop) per posizionare il menu vicino al cursore */
  const [posMenu, setPosMenu] = useState(null);
  const [mostraReazioni, setMostraReazioni] = useState(false);
  const menuRef = useRef(null);
  const reazioniRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchMoved = useRef(false);

  useEffect(() => {
    if (!menuAperto && !mostraReazioni) return;
    const chiudi = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) { setMenuAperto(false); setPosMenu(null); }
      if (reazioniRef.current && !reazioniRef.current.contains(e.target)) setMostraReazioni(false);
    };
    document.addEventListener('pointerdown', chiudi);
    return () => document.removeEventListener('pointerdown', chiudi);
  }, [menuAperto, mostraReazioni]);

  /* Calcola posizione finale del menu evitando di uscire dal viewport (solo desktop) */
  const stileMenu = useMemo(() => {
    if (!posMenu) return undefined;
    const W_STIMATA = 180;
    const H_STIMATA = 220;
    const margine = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const x = Math.min(posMenu.x, vw - W_STIMATA - margine);
    const y = Math.min(posMenu.y, vh - H_STIMATA - margine);
    return {
      position: 'fixed',
      top: Math.max(margine, y),
      left: Math.max(margine, x),
      right: 'auto',
      bottom: 'auto',
    };
  }, [posMenu]);

  /* Long-press su mobile per aprire menu contestuale */
  useEffect(() => () => clearTimeout(longPressTimer.current), []);
  const onTouchStart = useCallback(() => {
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        try { navigator.vibrate?.(12); } catch { /* vibrazione non supportata */ }
        setMenuAperto(true);
      }
    }, 500);
  }, []);
  const onTouchMove = useCallback(() => { touchMoved.current = true; clearTimeout(longPressTimer.current); }, []);
  const onTouchEnd = useCallback(() => { clearTimeout(longPressTimer.current); }, []);

  const testoVisibile = msg.eliminato ? null : (msg.testoDecifrato || null);
  /* Renderizza testo con emote Twitch se disponibile */
  const testoRenderizzato = useMemo(() => {
    if (!testoVisibile) return null;
    if (renderTestoConEmote) return renderTestoConEmote(testoVisibile);
    return [testoVisibile];
  }, [testoVisibile, renderTestoConEmote]);

  /* Raggruppa reazioni per emoji */
  const reazioniRaggruppate = useMemo(() => {
    if (!reazioni || reazioni.length === 0) return [];
    const mappa = {};
    reazioni.forEach(r => {
      if (!mappa[r.emoji]) mappa[r.emoji] = { emoji: r.emoji, utenti: [], mioVoto: false };
      mappa[r.emoji].utenti.push(r.user);
      if (r.user === msg._twitchUser) mappa[r.emoji].mioVoto = true;
    });
    return Object.values(mappa);
  }, [reazioni, msg._twitchUser]);

  return (
    <div className={`msg-wrapper${mio ? ' msg-wrapper-mine' : ''}${raggruppato ? ' msg-grouped' : ''}`}>
      {!mio && !raggruppato && (
        <div className="msg-avatar msg-avatar-sm"
          style={{ backgroundImage: msg.avatarMittente ? `url(${msg.avatarMittente})` : undefined, flexShrink: 0 }}>
          {!msg.avatarMittente && (msg.da?.[0]?.toUpperCase() || '?')}
        </div>
      )}
      {!mio && raggruppato && <div style={{ width: 28, flexShrink: 0 }} />}
      <div style={{ position: 'relative', maxWidth: '72%', minWidth: 0 }}>

        {/* Citazione messaggio originale (reply) */}
        {msg.replyToId && msg.replyPreview && (
          <div className="msg-reply-quote" style={{ marginLeft: mio ? 'auto' : 0, marginRight: mio ? 0 : 'auto' }}>
            <Reply size={11} style={{ flexShrink: 0 }} />
            <span className="msg-reply-text">{msg.replyPreview}</span>
          </div>
        )}

        <div
          className={`msg-bubble${mio ? ' msg-mine' : ' msg-theirs'}${raggruppato ? ' msg-bubble-grouped' : ''}`}
          onContextMenu={e => { e.preventDefault(); setPosMenu({ x: e.clientX, y: e.clientY }); setMenuAperto(true); }}
          onDoubleClick={() => { if (!msg.eliminato) setMostraReazioni(true); }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}>
          {msg.eliminato ? (
            <span className="msg-deleted-text">
              <Trash2 size={12} style={{ marginRight: 4 }} /> Messaggio eliminato
            </span>
          ) : msg.tipoMedia === 'voice' ? (
            <div className="msg-voice-container">
              <VoiceMessagePlayer src={msg.mediaDecifrato} durata={msg.durata} />
              {testoRenderizzato && <p className="msg-text" style={{ marginTop: 4 }}>{testoRenderizzato}</p>}
            </div>
          ) : msg.tipoMedia === 'image' ? (
            <div className="msg-media-content">
              {msg.mediaDecifrato ? (
                <img src={msg.mediaDecifrato} alt="Immagine"
                  className="msg-media-img"
                  onClick={(e) => { e.stopPropagation(); onApriMedia?.(msg.mediaDecifrato); }} />
              ) : (
                <div className="msg-media-loading"><Loader size={18} className="spin" /> Caricamento…</div>
              )}
              {testoRenderizzato && <p className="msg-text" style={{ marginTop: 6 }}>{testoRenderizzato}</p>}
            </div>
          ) : msg.tipoMedia === 'file' ? (
            <div className="msg-media-content">
              <div className="msg-media-file-row">
                {msg.mediaDecifrato ? (
                  <a href={msg.mediaDecifrato} download={msg.nomeFile}
                    className="msg-media-file-link">
                    <Download size={16} /> <span className="msg-media-name">{msg.nomeFile}</span>
                  </a>
                ) : (
                  <div className="msg-media-loading">
                    <Loader size={16} className="spin" /> {msg.nomeFile}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="msg-text">{testoRenderizzato}</p>
          )}
          <div className="msg-time">
            {msg.modificato && <span className="msg-edited">mod.</span>}
            <span>{formatOra(msg.ts)}</span>
            {mio && <span className="msg-check"><Check size={12} /></span>}
          </div>
        </div>

        {/* Reazioni sotto la bolla */}
        {reazioniRaggruppate.length > 0 && (
          <div className="msg-reactions-bar" style={{ justifyContent: mio ? 'flex-end' : 'flex-start' }}>
            {reazioniRaggruppate.map(r => (
              <button key={r.emoji}
                className={`msg-reaction-pill${r.mioVoto ? ' msg-reaction-mine' : ''}`}
                onClick={() => onReazione && onReazione(msg.id, r.emoji)}
                title={r.utenti.join(', ')}>
                <span>{r.emoji}</span>
                {r.utenti.length > 1 && <span className="msg-reaction-count">{r.utenti.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Picker reazioni rapide (doppio tap / pulsante) */}
        <AnimatePresence>
          {mostraReazioni && !msg.eliminato && (
            <motion.div ref={reazioniRef}
              className="msg-reactions-picker"
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              style={{ [mio ? 'right' : 'left']: 0, bottom: '100%' }}>
              {REAZIONI_RAPIDE.map(e => (
                <button key={e} className="msg-reaction-btn"
                  onClick={() => { onReazione && onReazione(msg.id, e); setMostraReazioni(false); }}>
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Azioni hover */}
        {!msg.eliminato && (
          <div className="msg-hover-actions" style={{ [mio ? 'right' : 'left']: '100%' }}>
            <button className="mod-icon-btn" title="Rispondi" onClick={() => onRispondi && onRispondi(msg)}>
              <Reply size={13} />
            </button>
            <button className="mod-icon-btn" title="Reagisci" onClick={() => setMostraReazioni(true)}>
              <Smile size={13} />
            </button>
            {mio && (
              <button className="mod-icon-btn" title="Modifica" onClick={() => onModifica(msg)}>
                <Pencil size={13} />
              </button>
            )}
            <button className="mod-icon-btn" title="Inoltra" onClick={() => onInoltra(msg)}>
              <CornerUpRight size={13} />
            </button>
            {mio && (
              <button className="mod-icon-btn msg-context-danger-light" title="Elimina" onClick={() => onElimina(msg)}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Menu contestuale — desktop: dropdown, mobile: bottom sheet overlay */}
        <AnimatePresence>
          {menuAperto && (
            <>
              {/* Overlay mobile per chiudere toccando fuori */}
              <motion.div
                className="msg-context-overlay"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMenuAperto(false)} />
              <motion.div ref={menuRef} className="msg-context-menu"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                style={stileMenu}>
                {/* Maniglia visiva su mobile */}
                <div className="msg-context-handle" />
                {!msg.eliminato && (
                  <button className="msg-context-item"
                    onClick={() => { onRispondi && onRispondi(msg); setMenuAperto(false); }}>
                    <Reply size={16} /> Rispondi
                  </button>
                )}
                {!msg.eliminato && testoVisibile && (
                  <button className="msg-context-item"
                    onClick={() => { copiaNeglAppunti(testoVisibile); setMenuAperto(false); }}>
                    <Copy size={16} /> Copia
                  </button>
                )}
                {!msg.eliminato && (
                  <button className="msg-context-item"
                    onClick={() => { onInoltra(msg); setMenuAperto(false); }}>
                    <CornerUpRight size={16} /> Inoltra
                  </button>
                )}
                {mio && !msg.eliminato && (
                  <button className="msg-context-item"
                    onClick={() => { onModifica(msg); setMenuAperto(false); }}>
                    <Pencil size={16} /> Modifica
                  </button>
                )}
                {mio && (
                  <button className="msg-context-item msg-context-danger"
                    onClick={() => { onElimina(msg); setMenuAperto(false); }}>
                    <Trash2 size={16} /> Elimina
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   Pannello inoltra messaggio
═══════════════════════════════════════════════ */
/* Converte un Uint8Array in base64 a blocchi (evita stack overflow su file grandi) */
function bytesABase64(combinato) {
  const parti = [];
  const CHUNK = 8192;
  for (let i = 0; i < combinato.length; i += CHUNK) {
    const fetta = combinato.subarray(i, Math.min(i + CHUNK, combinato.length));
    let s = '';
    for (let j = 0; j < fetta.length; j++) s += String.fromCharCode(fetta[j]);
    parti.push(s);
  }
  return btoa(parti.join(''));
}

function PannelloInoltra({ msg, twitchToken, twitchUser, privateKeyRef, onChiudi }) {
  const [conversazioni, setConversazioni] = useState([]);
  const [inviati, setInviati] = useState({});
  const [inInvio, setInInvio] = useState({}); // { username: true } durante l'invio
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    apiFetch(twitchToken, '?action=conversations', {})
      .then(d => setConversazioni(d.conversations || []))
      .catch(() => {})
      .finally(() => setCaricamento(false));
  }, [twitchToken]);

  async function inoltraA(dest) {
    if (inviati[dest] || inInvio[dest]) return;
    setErrore('');
    setInInvio(prev => ({ ...prev, [dest]: true }));
    try {
      /* Recupera la chiave pubblica del destinatario e deriva la chiave AES condivisa */
      const risposta = await fetch(`${API}?action=key&user=${dest}`);
      const dati = await risposta.json();
      if (!dati.publicKey) throw new Error('Chiave del destinatario non disponibile');
      const pubKey = await importPublicKey(dati.publicKey);
      const aesKey = await deriveKey(privateKeyRef.current, pubKey);

      const testoOriginale = msg.testoDecifrato || '';
      const haMedia = !!(msg.tipoMedia && msg.mediaDecifrato);

      if (haMedia) {
        /* Inoltro media: scarica blob → ri-cifra con nuova aesKey → ri-uploada → invia */
        let blob;
        try {
          blob = await (await fetch(msg.mediaDecifrato)).blob();
        } catch {
          throw new Error('Impossibile leggere il media da inoltrare');
        }
        const buffer = await blob.arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, buffer);
        const combinato = new Uint8Array(iv.byteLength + cipher.byteLength);
        combinato.set(iv);
        combinato.set(new Uint8Array(cipher), iv.byteLength);
        const base64 = bytesABase64(combinato);

        const nome = msg.nomeFile || 'file';
        const uploadRis = await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({
            action: 'upload_media',
            to: dest,
            data: base64,
            mimeType: blob.type || 'application/octet-stream',
            name: nome,
          }),
        });
        if (!uploadRis?.mediaId) throw new Error('Upload del media non riuscito');

        const { encrypted: encNome, iv: ivNome } = await encryptMessage(aesKey, nome);
        const { encrypted: encTesto, iv: ivTesto } = await encryptMessage(aesKey, testoOriginale);
        await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({
            action: 'send', to: dest,
            encrypted: encTesto, iv: ivTesto,
            tipoMedia: msg.tipoMedia, mediaId: uploadRis.mediaId,
            nomeFile: encNome, ivNome,
            ...(msg.tipoMedia === 'voice' && typeof msg.durata === 'number' ? { durata: msg.durata } : {}),
          }),
        });
      } else {
        /* Inoltro testo semplice */
        if (!testoOriginale.trim()) throw new Error('Nessun contenuto da inoltrare');
        const { encrypted, iv } = await encryptMessage(aesKey, `\u21aa ${testoOriginale}`);
        await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({ action: 'send', to: dest, encrypted, iv }),
        });
      }

      setInviati(prev => ({ ...prev, [dest]: true }));
    } catch (e) {
      setErrore(`Inoltro a ${dest} fallito: ${e.message || 'errore sconosciuto'}`);
    } finally {
      setInInvio(prev => {
        const nuovo = { ...prev };
        delete nuovo[dest];
        return nuovo;
      });
    }
  }

  return (
    <motion.div className="msg-forward-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onChiudi}>
      <motion.div className="glass-panel msg-forward-header"
        initial={{ y: 30 }} animate={{ y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 360, width: '92%', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>
            <CornerUpRight size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Inoltra a&hellip;
          </span>
          <button className="mod-icon-btn" onClick={onChiudi}><X size={16} /></button>
        </div>
        <div className="msg-forward-preview">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msg.testoDecifrato || '[media]'}
          </p>
        </div>
        {errore && (
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            padding: '0.5rem 0.7rem',
            borderRadius: 8,
            fontSize: '0.78rem',
            marginBottom: 8,
          }}>
            {errore}
          </div>
        )}
        {caricamento ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}><Loader size={18} className="spin" /></div>
        ) : (
          <div className="msg-forward-list">
            {conversazioni.filter(c => c.user !== twitchUser).map(c => {
              const inCorso = !!inInvio[c.user];
              const fatto = !!inviati[c.user];
              return (
                <button key={c.user}
                  className={`msg-forward-friend${fatto ? ' msg-forward-sent' : ''}`}
                  disabled={inCorso || fatto}
                  onClick={() => inoltraA(c.user)}>
                  <div className="msg-avatar msg-avatar-sm">{c.user[0]?.toUpperCase()}</div>
                  <span>{c.user}</span>
                  {inCorso && <Loader size={14} className="spin" style={{ marginLeft: 'auto', color: 'var(--text-faint)' }} />}
                  {fatto && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Vista chat
═══════════════════════════════════════════════ */
function ChatView({ conUsr, twitchUser, twitchToken, privateKeyRef, onTorna, emoteCanale, emoteGlobali, avatarCache }) {
  const { renderTestoConEmote } = useEmoteTwitch(twitchToken);
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [modificandoId, setModificandoId] = useState(null);
  const [inoltraMsg, setInoltraMsg] = useState(null);
  const [mostraScorri, setMostraScorri] = useState(false);
  const [fileInUpload, setFileInUpload] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursorePag, setCursorePag] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState(null); // immagine aperta a schermo intero
  /* Nuove feature */
  const [rispondiA, setRispondiA] = useState(null); // messaggio a cui rispondere
  const [staDigitando, setStaDigitando] = useState(false); // l'altro sta scrivendo
  const [online, setOnline] = useState(false); // stato online dell'altro
  const [registrando, setRegistrando] = useState(false); // registrazione vocale attiva
  const [durataReg, setDurataReg] = useState(0); // secondi registrazione
  const [reazioni, setReazioni] = useState({}); // { msgId: [{user,emoji,ts}] }
  const [cercaInChat, setCercaInChat] = useState('');
  const [mostraCerca, setMostraCerca] = useState(false);
  const [risultatiCerca, setRisultatiCerca] = useState([]);
  const [indiceCerca, setIndiceCerca] = useState(-1);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const aesKeyCache = useRef(null);
  const ultimoIdRef = useRef(null);
  const ultimoTsRef = useRef(null);
  const typingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const regIntervalRef = useRef(null);
  const reazioniCaricateRef = useRef(new Set());

  /* ─── Ottieni chiave AES condivisa ─── */
  const ottieniAesKey = useCallback(async () => {
    if (aesKeyCache.current) return aesKeyCache.current;
    const risposta = await fetch(`${API}?action=key&user=${conUsr}`);
    const dati = await risposta.json();
    if (!dati.publicKey) throw new Error('Chiave pubblica non trovata per ' + conUsr);
    const pubKey = await importPublicKey(dati.publicKey);
    const aesKey = await deriveKey(privateKeyRef.current, pubKey);
    aesKeyCache.current = aesKey;
    return aesKey;
  }, [conUsr, privateKeyRef]);

  /* ─── Decifra un messaggio (testo + eventuale media via mediaId) ─── */
  const decifraMessaggio = useCallback(async (rawMsg) => {
    const msg = normalizzaMessaggio(rawMsg);
    if (msg.eliminato) return { ...msg, testoDecifrato: null, _twitchUser: twitchUser };
    if (msg.testoDecifrato !== undefined && msg.mediaDecifrato !== undefined) return { ...msg, _twitchUser: twitchUser };
    try {
      const aesKey = await ottieniAesKey();
      let testoDecifrato = '';
      try {
        testoDecifrato = await decryptMessage(aesKey, msg.encrypted, msg.iv);
      } catch { testoDecifrato = msg.tipoMedia ? '' : '[Impossibile decifrare]'; }

      /* Decifra nome file se presente */
      let nomeFile = msg.nomeFile || '';
      if (msg.nomeFile && msg.ivNome) {
        try { nomeFile = await decryptMessage(aesKey, msg.nomeFile, msg.ivNome); } catch { /* mantieni cifrato */ }
      }

      /* Recupera e decifra media se il messaggio ha un mediaId */
      let mediaDecifrato = msg.mediaDecifrato || null;
      if (msg.mediaId && !mediaDecifrato) {
        try {
          const mediaDati = await apiFetch(twitchToken, `?action=media&id=${msg.mediaId}`, {});
          if (mediaDati.data) {
            /* Decodifica base64 a blocchi per evitare stack overflow */
            const binStr = atob(mediaDati.data);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            /* IV sono i primi 12 bytes, ciphertext il resto */
            const mediaIv = bytes.slice(0, 12);
            const mediaCipher = bytes.slice(12);
            const decBuffer = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: mediaIv }, aesKey, mediaCipher
            );
            const tipoFile = mediaDati.mimeType || (msg.tipoMedia === 'image' ? 'image/jpeg' : 'application/octet-stream');
            const blob = new Blob([decBuffer], { type: tipoFile });
            mediaDecifrato = URL.createObjectURL(blob);
          }
        } catch { /* media non disponibile o errore di decifratura */ }
      }

      return { ...msg, testoDecifrato, nomeFile, mediaDecifrato, _twitchUser: twitchUser };
    } catch {
      return { ...msg, testoDecifrato: '[Impossibile decifrare]', _twitchUser: twitchUser };
    }
  }, [ottieniAesKey, twitchUser, twitchToken]);

  /* ─── Carica cronologia ─── */
  const caricaCronologia = useCallback(async (resetta = true) => {
    setCaricamento(true);
    try {
      const crs = resetta ? 0 : cursorePag;
      const dati = await apiFetch(twitchToken, `?action=history&with=${conUsr}&cursor=${crs}`, {});
      const decifrati = await Promise.all((dati.messages || []).map(decifraMessaggio));
      setMessaggi(prev => resetta ? decifrati : [...decifrati, ...prev]);
      setHasMore(!!dati.hasMore);
      setCursorePag(dati.cursor || 0);
      if (decifrati.length > 0) {
        const ultimo = decifrati[decifrati.length - 1];
        ultimoIdRef.current = ultimo.id;
        ultimoTsRef.current = ultimo.ts;
      }
    } catch (e) {
      setErrore(`Errore caricamento: ${e.message}`);
    } finally {
      setCaricamento(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conUsr, twitchToken, decifraMessaggio]);

  useEffect(() => {
    caricaCronologia(true);
    return () => {
      clearTimeout(pollTimerRef.current);
      clearTimeout(typingTimerRef.current);
      clearInterval(regIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conUsr]);

  /* ─── Auto-scroll alla fine ─── */
  useEffect(() => {
    if (!caricamento && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [caricamento]);

  function controllaScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setMostraScorri(scrollHeight - scrollTop - clientHeight > 150);
  }

  function scorriInBasso() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }

  /* ─── Polling nuovi messaggi con setTimeout ricorsivo ─── */
  useEffect(() => {
    if (caricamento) return;
    function poll() {
      apiFetch(twitchToken, `?action=poll&with=${conUsr}&after=${ultimoIdRef.current || ''}&since=${ultimoTsRef.current || 0}`, {})
        .then(async dati => {
          const nuovi = dati.messages || [];
          const modificati = dati.changed || [];
          if (nuovi.length > 0 || modificati.length > 0) {
            const tuttiNuovi = await Promise.all(nuovi.map(decifraMessaggio));
            const tuttiMod = await Promise.all(modificati.map(decifraMessaggio));
            setMessaggi(prev => {
              const mappa = new Map(prev.map(m => [m.id, m]));
              tuttiNuovi.forEach(m => mappa.set(m.id, m));
              tuttiMod.forEach(m => mappa.set(m.id, m));
              return Array.from(mappa.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
            });
            if (tuttiNuovi.length > 0) {
              const ultimo = tuttiNuovi[tuttiNuovi.length - 1];
              if (ultimo) { ultimoIdRef.current = ultimo.id; ultimoTsRef.current = ultimo.ts; }
            }
          }
          pollTimerRef.current = setTimeout(poll, 3000);
        })
        .catch(() => { pollTimerRef.current = setTimeout(poll, 5000); });
    }
    pollTimerRef.current = setTimeout(poll, 3000);
    return () => clearTimeout(pollTimerRef.current);
  }, [caricamento, conUsr, twitchToken, decifraMessaggio]);

  /* ─── Polling indicatore di digitazione ─── */
  useEffect(() => {
    if (caricamento) return;
    let attivo = true;
    function pollTyping() {
      if (!attivo) return;
      fetch(`${API}?action=typing_status&with=${conUsr}`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      })
        .then(r => r.ok ? r.json() : { typing: false })
        .then(d => { if (attivo) setStaDigitando(!!d.typing); })
        .catch(() => {});
      if (attivo) setTimeout(pollTyping, 4000);
    }
    setTimeout(pollTyping, 2000);
    return () => { attivo = false; };
  }, [caricamento, conUsr, twitchToken]);

  /* ─── Polling stato online ─── */
  useEffect(() => {
    let attivo = true;
    function pollOnline() {
      if (!attivo) return;
      fetch(`${API}?action=online_status&users=${conUsr}`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      })
        .then(r => r.ok ? r.json() : { online: {} })
        .then(d => { if (attivo) setOnline(!!d.online?.[conUsr]); })
        .catch(() => {});
      if (attivo) setTimeout(pollOnline, 30000);
    }
    pollOnline();
    return () => { attivo = false; };
  }, [conUsr, twitchToken]);

  /* ─── Heartbeat: aggiorna il proprio stato online ─── */
  useEffect(() => {
    let attivo = true;
    function heartbeat() {
      if (!attivo) return;
      apiFetch(twitchToken, '', { method: 'POST', body: JSON.stringify({ action: 'heartbeat' }) }).catch(() => {});
      if (attivo) setTimeout(heartbeat, 60000);
    }
    heartbeat();
    return () => { attivo = false; };
  }, [twitchToken]);

  /* ─── Segnala che sto digitando ─── */
  function segnalaDigitazione() {
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      apiFetch(twitchToken, '', { method: 'POST', body: JSON.stringify({ action: 'typing', to: conUsr }) }).catch(() => {});
    }, 300);
  }

  /* ─── Invia messaggio ─── */
  async function invia(e) {
    e.preventDefault();
    const t = testo.trim();
    if (!t || fileInUpload) return;
    setTesto('');
    setErrore('');
    try {
      const aesKey = await ottieniAesKey();
      if (modificandoId) {
        const { encrypted, iv } = await encryptMessage(aesKey, t);
        await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({ action: 'edit', convoWith: conUsr, msgId: modificandoId, encrypted, iv }),
        });
        setMessaggi(prev => prev.map(m => m.id === modificandoId ? { ...m, testoDecifrato: t, modificato: true } : m));
        setModificandoId(null);
      } else if (rispondiA) {
        /* Risposta a un messaggio */
        const { encrypted, iv } = await encryptMessage(aesKey, t);
        const anteprima = (rispondiA.testoDecifrato || '').slice(0, 80) || '[media]';
        const risposta = await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({ action: 'send_reply', to: conUsr, encrypted, iv, replyToId: rispondiA.id, replyPreview: anteprima }),
        });
        const nuovoMsg = await decifraMessaggio({ ...risposta.message, testoDecifrato: t });
        setMessaggi(prev => [...prev, nuovoMsg]);
        ultimoIdRef.current = nuovoMsg.id;
        ultimoTsRef.current = nuovoMsg.ts;
        setRispondiA(null);
        setTimeout(scorriInBasso, 50);
      } else {
        const { encrypted, iv } = await encryptMessage(aesKey, t);
        const risposta = await apiFetch(twitchToken, '', {
          method: 'POST',
          body: JSON.stringify({ action: 'send', to: conUsr, encrypted, iv }),
        });
        const nuovoMsg = await decifraMessaggio({ ...risposta.message, testoDecifrato: t });
        setMessaggi(prev => [...prev, nuovoMsg]);
        ultimoIdRef.current = nuovoMsg.id;
        ultimoTsRef.current = nuovoMsg.ts;
        setTimeout(scorriInBasso, 50);
      }
    } catch (err) {
      setErrore(`Errore invio: ${err.message}`);
    }
  }

  /* ─── Upload media cifrato (con compressione immagini) ─── */
  async function caricaMedia(file) {
    if (!file) return;
    setFileInUpload(true);
    setErrore('');
    try {
      let fileDaCaricare = file;

      /* Comprimi immagini prima dell'upload */
      if (isImageComprimibile(file)) {
        try {
          fileDaCaricare = await comprimeImmagine(file);
        } catch {
          /* Se la compressione fallisce, prova con il file originale */
          fileDaCaricare = file;
        }
      }

      const aesKey = await ottieniAesKey();
      const buffer = await fileDaCaricare.arrayBuffer();

      /* Cifra il file: IV (12 bytes) concatenato al ciphertext per upload self-contained */
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, buffer);
      const combinato = new Uint8Array(iv.byteLength + cipher.byteLength);
      combinato.set(iv, 0);
      combinato.set(new Uint8Array(cipher), iv.byteLength);

      /* Converti in base64 a blocchi per evitare stack overflow su file grandi */
      const parti = [];
      const CHUNK = 8192;
      for (let i = 0; i < combinato.length; i += CHUNK) {
        const fetta = combinato.subarray(i, Math.min(i + CHUNK, combinato.length));
        let s = '';
        for (let j = 0; j < fetta.length; j++) s += String.fromCharCode(fetta[j]);
        parti.push(s);
      }
      const base64 = btoa(parti.join(''));

      const tipoMedia = fileDaCaricare.type.startsWith('image/') ? 'image'
        : fileDaCaricare.type.startsWith('audio/') ? 'voice' : 'file';
      const { encrypted: encNome, iv: ivNome } = await encryptMessage(aesKey, fileDaCaricare.name);

      /* Upload media separato via upload_media, poi invia messaggio con riferimento */
      const uploadRis = await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({
          action: 'upload_media',
          to: conUsr,
          data: base64,
          mimeType: fileDaCaricare.type,
          name: fileDaCaricare.name,
        }),
      });
      const mediaId = uploadRis.mediaId;

      /* Messaggio con riferimento al media caricato */
      const { encrypted: encTesto, iv: ivTesto } = await encryptMessage(aesKey, '');
      const risposta = await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send', to: conUsr,
          encrypted: encTesto, iv: ivTesto,
          tipoMedia, mediaId, nomeFile: encNome, ivNome,
          ...(tipoMedia === 'voice' && fileDaCaricare.durata ? { durata: fileDaCaricare.durata } : {}),
        }),
      });

      const url = URL.createObjectURL(fileDaCaricare);
      const nuovoMsg = normalizzaMessaggio({
        ...risposta.message, testoDecifrato: '', tipoMedia, mediaId,
        nomeFile: fileDaCaricare.name, mediaDecifrato: url, _twitchUser: twitchUser,
      });
      setMessaggi(prev => [...prev, nuovoMsg]);
      ultimoIdRef.current = nuovoMsg.id;
      ultimoTsRef.current = nuovoMsg.ts;
      setTimeout(scorriInBasso, 50);
    } catch (err) {
      setErrore(`Errore upload: ${err.message}`);
    } finally {
      setFileInUpload(false);
    }
  }

  /* ─── Registrazione vocale ─── */
  async function avviaRegistrazione() {
    try {
      const supportaWebm = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm');
      const supportaMp4 = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4');
      if (!supportaWebm && !supportaMp4) { setErrore('Il tuo browser non supporta la registrazione audio.'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportaWebm ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setDurataReg(0);
      const startT = Date.now();
      regIntervalRef.current = setInterval(() => setDurataReg(Math.floor((Date.now() - startT) / 1000)), 500);
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        clearInterval(regIntervalRef.current);
        stream.getTracks().forEach(t => t.stop());
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const ext = recorder.mimeType.includes('webm') ? 'webm' : 'm4a';
          const file = new File([blob], `vocale_${Date.now()}.${ext}`, { type: recorder.mimeType });
          caricaMedia(file);
        }
        setRegistrando(false);
      };
      recorder.start();
      setRegistrando(true);
    } catch {
      setErrore('Impossibile accedere al microfono.');
    }
  }

  function fermaRegistrazione() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  /* ─── Elimina messaggio ─── */
  async function eliminaMessaggio(msg) {
    try {
      await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', convoWith: conUsr, msgId: msg.id }),
      });
      setMessaggi(prev => prev.map(m => m.id === msg.id ? { ...m, eliminato: true, testoDecifrato: null } : m));
    } catch (err) {
      setErrore(`Errore eliminazione: ${err.message}`);
    }
  }

  /* ─── Reazione a un messaggio ─── */
  async function reagisci(msgId, emoji) {
    try {
      const resp = await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', convoWith: conUsr, msgId, emoji }),
      });
      setReazioni(prev => ({ ...prev, [msgId]: resp.reactions || [] }));
    } catch { /* best effort */ }
  }

  /* ─── Carica reazioni per i messaggi visibili ─── */
  useEffect(() => {
    if (messaggi.length === 0) return;
    /* Carica reazioni solo per messaggi non ancora controllati */
    const idsDaCaricare = messaggi
      .filter(m => !m.eliminato && !reazioniCaricateRef.current.has(m.id))
      .slice(-30)
      .map(m => m.id);
    if (idsDaCaricare.length === 0) return;
    idsDaCaricare.forEach(id => reazioniCaricateRef.current.add(id));
    let attivo = true;
    Promise.all(
      idsDaCaricare.map(id =>
        fetch(`${API}?action=reactions&with=${conUsr}&msgId=${id}`, { headers: { Authorization: `Bearer ${twitchToken}` } })
          .then(r => r.ok ? r.json() : { reactions: [] })
          .then(d => ({ id, reactions: d.reactions || [] }))
          .catch(() => ({ id, reactions: [] }))
      )
    ).then(results => {
      if (!attivo) return;
      const nuove = {};
      results.forEach(r => { if (r.reactions.length > 0) nuove[r.id] = r.reactions; });
      if (Object.keys(nuove).length > 0) setReazioni(prev => ({ ...prev, ...nuove }));
    });
    return () => { attivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messaggi.length, conUsr, twitchToken]);

  /* ─── Ricerca messaggi nella chat ─── */
  useEffect(() => {
    if (!cercaInChat.trim()) { setRisultatiCerca([]); setIndiceCerca(-1); return; }
    const q = cercaInChat.toLowerCase();
    const risultati = messaggi
      .filter(m => m.testoDecifrato && m.testoDecifrato.toLowerCase().includes(q))
      .map(m => m.id);
    setRisultatiCerca(risultati);
    setIndiceCerca(risultati.length > 0 ? risultati.length - 1 : -1);
  }, [cercaInChat, messaggi]);

  /* Scorri al risultato di ricerca attivo */
  useEffect(() => {
    if (indiceCerca < 0 || risultatiCerca.length === 0) return;
    const targetId = risultatiCerca[indiceCerca];
    const el = scrollRef.current?.querySelector(`[data-msg-id="${targetId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [indiceCerca, risultatiCerca]);

  /* ─── Raggruppa messaggi per data/mittente ─── */
  const messaggiConMeta = messaggi.map((msg, i) => {
    const prev = messaggi[i - 1];
    const nuovaData = !prev || formatData(msg.ts) !== formatData(prev.ts);
    const raggruppato = !nuovaData && prev && prev.da === msg.da && !prev.eliminato && !msg.eliminato;
    const cambioMittente = !raggruppato && prev && prev.da !== msg.da && !nuovaData;
    return { msg, separatoreData: nuovaData ? formatData(msg.ts) : null, raggruppato, cambioMittente };
  });

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(e); }
    if (e.key === 'Escape') {
      if (modificandoId) { setModificandoId(null); setTesto(''); }
      else if (rispondiA) { setRispondiA(null); }
    }
  }

  function onInputChange(e) {
    setTesto(e.target.value);
    segnalaDigitazione();
  }

  return (
    <div className="msg-chat-container">
      {/* Header */}
      <div className="msg-chat-header">
        <button className="btn btn-ghost" onClick={onTorna}><ArrowLeft size={18} /></button>
        <div style={{ position: 'relative' }}>
          <AvatarUtente username={conUsr} avatarCache={avatarCache || {}} dimensione={32} className="msg-avatar-sm" />
          {online && <span className="msg-online-dot" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, display: 'block' }}>{conUsr}</span>
          <AnimatePresence mode="wait">
            {staDigitando ? (
              <motion.span key="typing" className="msg-typing-label"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                sta scrivendo<span className="msg-typing-dots" />
              </motion.span>
            ) : online ? (
              <motion.span key="online" className="msg-status-online"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Online
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="mod-icon-btn" title="Cerca nella chat" onClick={() => setMostraCerca(v => !v)}>
            <Search size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-faint)', fontSize: '0.72rem' }}>
            <Lock size={11} /> E2E
          </div>
        </div>
      </div>

      {/* Barra ricerca nella chat */}
      <AnimatePresence>
        {mostraCerca && (
          <motion.div className="msg-search-bar"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Search size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            <input className="msg-search-input" placeholder="Cerca nei messaggi…"
              value={cercaInChat}
              onChange={e => setCercaInChat(e.target.value)}
              autoFocus />
            {risultatiCerca.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {indiceCerca + 1}/{risultatiCerca.length}
                </span>
                <button className="mod-icon-btn" style={{ padding: 2 }}
                  onClick={() => setIndiceCerca(i => i > 0 ? i - 1 : risultatiCerca.length - 1)}>
                  <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button className="mod-icon-btn" style={{ padding: 2 }}
                  onClick={() => setIndiceCerca(i => i < risultatiCerca.length - 1 ? i + 1 : 0)}>
                  <ChevronDown size={13} />
                </button>
              </div>
            )}
            <button className="mod-icon-btn" onClick={() => { setMostraCerca(false); setCercaInChat(''); }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner errore */}
      <AnimatePresence>
        {errore && (
          <motion.div className="msg-error-banner"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AlertTriangle size={14} /> {errore}
            <button onClick={() => setErrore('')}
              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Area messaggi */}
      <div className="msg-scroll-area" ref={scrollRef} onScroll={controllaScroll}>
        {caricamento ? (
          <SpinnerCentrale testo="Caricamento messaggi…" />
        ) : (
          <>
            {hasMore && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => caricaCronologia(false)}>
                  <ChevronDown size={14} /> Carica precedenti
                </button>
              </div>
            )}
            {messaggi.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-faint)' }}>
                <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p>Nessun messaggio ancora. Di&rsquo; ciao!</p>
              </div>
            )}
            {messaggiConMeta.map(({ msg, separatoreData, raggruppato, cambioMittente }) => (
              <div key={msg.id} data-msg-id={msg.id}
                className={[
                  risultatiCerca.includes(msg.id) && risultatiCerca[indiceCerca] === msg.id && 'msg-search-highlight',
                  cambioMittente && 'msg-sender-change',
                ].filter(Boolean).join(' ') || undefined}>
                {separatoreData && (
                  <div className="msg-date-separator"><span>{separatoreData}</span></div>
                )}
                {!raggruppato && msg.da !== twitchUser && (
                  <div className="msg-sender-label">{msg.da}</div>
                )}
                <MessaggioBubble
                  msg={msg}
                  mio={msg.da === twitchUser}
                  raggruppato={raggruppato}
                  onModifica={m => { setModificandoId(m.id); setTesto(m.testoDecifrato || ''); setRispondiA(null); textareaRef.current?.focus(); }}
                  onElimina={eliminaMessaggio}
                  onInoltra={m => setInoltraMsg(m)}
                  onRispondi={m => { setRispondiA(m); setModificandoId(null); textareaRef.current?.focus(); }}
                  reazioni={reazioni[msg.id] || []}
                  onReazione={reagisci}
                  renderTestoConEmote={renderTestoConEmote}
                  onApriMedia={setLightboxSrc}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottone scorri in basso */}
      <AnimatePresence>
        {mostraScorri && (
          <motion.button className="msg-scroll-btn"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={scorriInBasso}>
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Form invio */}
      <form className="msg-input-form" onSubmit={invia}>
        {/* Barra risposta */}
        <AnimatePresence>
          {rispondiA && (
            <motion.div className="msg-reply-bar"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Reply size={13} style={{ flexShrink: 0, color: 'var(--primary)' }} />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)' }}>
                  {rispondiA.da === twitchUser ? 'Te stesso' : rispondiA.da}
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rispondiA.testoDecifrato || '[media]'}
                </p>
              </div>
              <button type="button" className="mod-icon-btn" onClick={() => setRispondiA(null)}>
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {modificandoId && (
          <div className="msg-edit-label">
            <Pencil size={13} /> Modifica messaggio
            <button type="button" className="msg-edit-cancel"
              onClick={() => { setModificandoId(null); setTesto(''); }}>
              <X size={13} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <button type="button" className="mod-icon-btn" disabled={fileInUpload || registrando}
            onClick={() => fileInputRef.current?.click()}>
            {fileInUpload ? <Loader size={16} className="spin" /> : <ImageIcon size={16} />}
          </button>
          <input ref={fileInputRef} type="file"
            accept="image/*,.heic,.heif,.avif,.webp,.bmp,.tiff,.svg,video/*,audio/*,application/pdf,.doc,.docx,.zip,.rar,.7z"
            style={{ display: 'none' }}
            onChange={e => { caricaMedia(e.target.files[0]); e.target.value = ''; }} />
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            disabled={false}
            onSelect={nome => setTesto(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ')}
          />
          <textarea
            ref={textareaRef}
            className="msg-textarea"
            rows={1}
            placeholder="Scrivi un messaggio…"
            value={testo}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={fileInUpload || registrando}
            style={{ resize: 'none', flex: 1, minHeight: 36, maxHeight: 120, overflow: 'auto' }}
          />
          {/* Mostra microfono se non c'è testo, altrimenti invia */}
          {testo.trim() || modificandoId ? (
            <button type="submit" className="msg-send-btn" disabled={!testo.trim() || fileInUpload}>
              {modificandoId ? <Check size={18} /> : <Send size={18} />}
            </button>
          ) : registrando ? (
            <button type="button" className="msg-send-btn msg-recording-btn" onClick={fermaRegistrazione}>
              <Square size={16} fill="currentColor" />
              <span className="msg-rec-timer">{durataReg}s</span>
            </button>
          ) : (
            <button type="button" className="msg-send-btn msg-mic-btn" onClick={avviaRegistrazione} disabled={fileInUpload}>
              <Mic size={18} />
            </button>
          )}
        </div>
      </form>

      {/* Overlay inoltra */}
      <AnimatePresence>
        {inoltraMsg && (
          <PannelloInoltra
            msg={inoltraMsg}
            twitchToken={twitchToken}
            twitchUser={twitchUser}
            privateKeyRef={privateKeyRef}
            onChiudi={() => setInoltraMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Lightbox — visualizzazione immagine a schermo intero */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div className="msg-lightbox-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxSrc(null)}>
            <button className="msg-lightbox-close" onClick={() => setLightboxSrc(null)}>
              <X size={22} />
            </button>
            <motion.img src={lightboxSrc} alt="Schermo intero"
              className="msg-lightbox-img"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()} />
            <a href={lightboxSrc} download className="msg-lightbox-download"
              onClick={e => e.stopPropagation()}>
              <Download size={16} /> Salva
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   COMPONENTE PRINCIPALE: MessagesPage
═══════════════════════════════════════════════ */
export default function MessagesPage() {
  const { twitchUser, twitchToken, isLoggedIn, getTwitchLoginUrl } = useTwitchAuth();
  const { supportato: notifSupportato, attivo: notifAttivo, attiva: attivaNot, disattiva: disattivaNot } = useNotifiche();
  const { emoteCanale, emoteGlobali } = useEmoteTwitch(twitchToken);

  const [fase, setFase] = useState('inizializzazione');
  const [conversazioni, setConversazioni] = useState([]);
  const [chatAperta, setChatAperta] = useState(null);
  const [ricercaAmico, setRicercaAmico] = useState('');
  const [nuovaConvo, setNuovaConvo] = useState(false);
  const [mostraSyncInit, setMostraSyncInit] = useState(false);
  const [caricandoConvo, setCaricandoConvo] = useState(false);
  const [confermaRimuoviChiavi, setConfermaRimuoviChiavi] = useState(false);
  const [mostraGestioneBackup, setMostraGestioneBackup] = useState(false);
  const [anteprime, setAnteprime] = useState({});
  const [amici, setAmici] = useState([]);
  const [avatarCache, setAvatarCache] = useState({});
  const [onlineMap, setOnlineMap] = useState({}); // { username: boolean }
  const privateKeyRef = useRef(null);
  const pollConvoRef = useRef(null);
  const avatarFetchSet = useRef(new Set());

  /* ─── Inizializzazione: controlla chiavi locali poi server ─── */
  useEffect(() => {
    if (!isLoggedIn) { setFase('non-autenticato'); return; }
    let annullato = false;
    async function controlla() {
      try {
        const localKey = await getLocalPrivateKey(twitchUser);
        if (localKey) { privateKeyRef.current = localKey; setFase('messaggi'); return; }
        const dati = await fetch(`${API}?action=key&user=${twitchUser}`).then(r => r.json());
        if (annullato) return;
        setFase(!dati.publicKey ? 'setup-primo' : 'setup-joiner');
      } catch { if (!annullato) setFase('setup-primo'); }
    }
    controlla();
    return () => { annullato = true; };
  }, [isLoggedIn, twitchUser]);

  /* ─── Carica lista conversazioni ─── */
  const caricaConversazioni = useCallback(async () => {
    if (!twitchToken) return;
    setCaricandoConvo(true);
    try {
      const dati = await apiFetch(twitchToken, '?action=conversations', {});
      setConversazioni(dati.conversations || []);
    } catch { /* ignora */ } finally { setCaricandoConvo(false); }
  }, [twitchToken]);

  /* ─── Polling conversazioni ogni 15 secondi ─── */
  useEffect(() => {
    if (fase !== 'messaggi') return;
    caricaConversazioni();
    function poll() {
      caricaConversazioni().finally(() => { pollConvoRef.current = setTimeout(poll, 15000); });
    }
    pollConvoRef.current = setTimeout(poll, 15000);
    return () => clearTimeout(pollConvoRef.current);
  }, [fase, caricaConversazioni]);

  /* ─── Carica lista amici per il picker ─── */
  const caricaAmici = useCallback(async () => {
    if (!twitchToken) return;
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (res.ok) {
        const dati = await res.json();
        setAmici((dati.friends || []).sort());
      }
    } catch { /* best effort */ }
  }, [twitchToken]);

  useEffect(() => {
    if (fase === 'messaggi') caricaAmici();
  }, [fase, caricaAmici]);

  /* ─── Precarica avatar per conversazioni e amici ─── */
  useEffect(() => {
    if (!twitchToken || fase !== 'messaggi') return;
    const tuttiUtenti = [...new Set([...conversazioni.map(c => c.user), ...amici])];
    const daFetchare = tuttiUtenti.filter(u => u && !(u in avatarCache) && !avatarFetchSet.current.has(u));
    if (daFetchare.length === 0) return;
    daFetchare.forEach(u => avatarFetchSet.current.add(u));
    Promise.allSettled(
      daFetchare.map(u =>
        fetch(`/api/profile?user=${encodeURIComponent(u)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => ({ u, url: d?.avatar || null }))
          .catch(() => ({ u, url: null })),
      ),
    ).then(results => {
      const nuovi = {};
      /* Salva solo URL validi — utenti senza avatar restano fuori dalla cache
         e vengono protetti da ri-fetch tramite avatarFetchSet */
      results.forEach(r => { if (r.status === 'fulfilled' && r.value.url) nuovi[r.value.u] = r.value.url; });
      if (Object.keys(nuovi).length > 0) setAvatarCache(prev => ({ ...prev, ...nuovi }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversazioni, amici, twitchToken, fase]);

  /* ─── Polling stato online utenti nelle conversazioni ─── */
  useEffect(() => {
    if (fase !== 'messaggi' || !twitchToken || conversazioni.length === 0) return;
    let attivo = true;
    function pollOnline() {
      if (!attivo) return;
      const utenti = conversazioni.map(c => c.user).filter(Boolean).join(',');
      if (!utenti) return;
      fetch(`${API}?action=online_status&users=${utenti}`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      })
        .then(r => r.ok ? r.json() : { online: {} })
        .then(d => { if (attivo) setOnlineMap(d.online || {}); })
        .catch(() => {});
      if (attivo) setTimeout(pollOnline, 45000);
    }
    pollOnline();
    return () => { attivo = false; };
  }, [conversazioni, twitchToken, fase]);

  function onSetupCompleto(privKey) {
    privateKeyRef.current = privKey;
    setFase('messaggi');
  }

  /* ─── Segna conversazione come letta ─── */
  async function segnaLetta(user) {
    try {
      await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', withUser: user }),
      });
      setConversazioni(prev => prev.map(c => c.user === user ? { ...c, unread: 0 } : c));
    } catch { /* best effort */ }
  }

  function selezionaChat(user) {
    setChatAperta(user);
    segnaLetta(user);
  }

  /* ─── Decifra anteprime conversazioni ─── */
  useEffect(() => {
    if (fase !== 'messaggi' || !privateKeyRef.current || conversazioni.length === 0) return;
    let annullato = false;
    async function decifra() {
      const nuove = {};
      await Promise.all(conversazioni.map(async (c) => {
        if (!c.lastMessage) return;
        if (c.lastMessage.deleted) { nuove[c.user] = '🚫 Messaggio eliminato'; return; }
        if (c.lastMessage.isMedia || !c.lastMessage.encrypted) { nuove[c.user] = (c.lastMessage.from === twitchUser ? 'Tu: ' : '') + '📎 Allegato'; return; }
        try {
          const aesKey = await ottieniAesKeyGlobale(privateKeyRef.current, c.user);
          if (!aesKey || annullato) return;
          const testo = await decryptMessage(aesKey, c.lastMessage.encrypted, c.lastMessage.iv);
          if (annullato) return;
          // eslint-disable-next-line no-control-regex
          const isText = testo.length < 2000 && !/[\x00-\x08\x0E-\x1F]/.test(testo.slice(0, 100));
          const prefix = c.lastMessage.from === twitchUser ? 'Tu: ' : '';
          nuove[c.user] = isText ? prefix + (testo.length > 60 ? testo.slice(0, 60) + '…' : testo) : prefix + '📎 Allegato';
        } catch {
          nuove[c.user] = '🔒 Messaggio cifrato';
        }
      }));
      if (!annullato) setAnteprime(prev => ({ ...prev, ...nuove }));
    }
    decifra();
    return () => { annullato = true; };
  }, [conversazioni, twitchUser, fase]);

  /* ─── Apre la chat con un utente (usata da PannelloNuovaConvo e suggerimenti) ─── */
  function apriChat(dest) {
    setChatAperta(dest);
    setNuovaConvo(false);
    setConversazioni(prev => prev.find(c => c.user === dest) ? prev : [{ user: dest, lastMessageAt: Date.now() }, ...prev]);
  }

  const convoSet = new Set(conversazioni.map(c => c.user));
  const convFiltrate = conversazioni.filter(c => c.user?.toLowerCase()?.includes(ricercaAmico.toLowerCase()));
  /* Amici non ancora in chat che corrispondono alla ricerca (max 5) */
  const amiciSuggeriti = ricercaAmico.trim().length >= 1
    ? amici.filter(a => a.toLowerCase().includes(ricercaAmico.toLowerCase()) && !convoSet.has(a) && a !== twitchUser).slice(0, 5)
    : [];

  /* ─── Fase: inizializzazione ─── */
  if (fase === 'inizializzazione') {
    return (
      <>
        <SEO title="Messaggi" />
        <SpinnerCentrale testo="Inizializzazione messaggi sicuri…" />
      </>
    );
  }

  /* ─── Fase: non-autenticato ─── */
  if (fase === 'non-autenticato') {
    return (
      <>
        <SEO title="Messaggi" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel"
          style={{ maxWidth: 420, margin: '60px auto', padding: '2.5rem', textAlign: 'center' }}>
          <MessageSquare size={44} style={{ color: 'var(--primary)', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Messaggi privati</h2>
          <p style={{ color: 'var(--text-faint)', marginBottom: 24, fontSize: '0.9rem' }}>
            I messaggi sono cifrati end-to-end con ECDH P-256.<br />
            Accedi con Twitch per iniziare.
          </p>
          <a href={getTwitchLoginUrl()} className="social-btn-twitch"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <LogIn size={18} /> Accedi con Twitch
          </a>
        </motion.div>
      </>
    );
  }

  /* ─── Fase: setup-primo ─── */
  if (fase === 'setup-primo') {
    return (
      <>
        <SEO title="Setup messaggi" />
        <div style={{ padding: '1rem' }}>
          <FaseSetupPrimo username={twitchUser} token={twitchToken} onComplete={onSetupCompleto} />
        </div>
      </>
    );
  }

  /* ─── Fase: setup-joiner ─── */
  if (fase === 'setup-joiner') {
    return (
      <>
        <SEO title="Sincronizza dispositivo" />
        <div style={{ padding: '1rem' }}>
          <FaseSetupJoiner username={twitchUser} token={twitchToken} onComplete={onSetupCompleto} />
        </div>
      </>
    );
  }

  /* ─── Fase: messaggi ─── */
  return (
    <>
      <SEO title="Messaggi" />
      <div className="msg-main-panel">
        {/* Barra laterale conversazioni */}
        <AnimatePresence mode="wait">
          {!chatAperta && (
            <motion.div key="lista"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-panel"
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={20} /> Messaggi
                  </h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {notifSupportato && (
                      <button className="mod-icon-btn"
                        title={notifAttivo ? 'Disattiva notifiche' : 'Attiva notifiche'}
                        onClick={notifAttivo ? disattivaNot : attivaNot}>
                        <Bell size={16} style={{ color: notifAttivo ? 'var(--primary)' : undefined }} />
                      </button>
                    )}
                    <button className="mod-icon-btn" title="Aggiungi dispositivo"
                      onClick={() => setMostraSyncInit(true)}>
                      <Smartphone size={16} />
                    </button>
                    <button className="mod-icon-btn" title="Gestione backup chiavi"
                      onClick={() => setMostraGestioneBackup(true)}>
                      <Shield size={16} />
                    </button>
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                      onClick={() => setNuovaConvo(true)}>
                      <Plus size={15} /> Nuovo
                    </button>
                  </div>
                </div>

                {/* Banner sicurezza */}
                <div className="msg-sync-banner" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <Lock size={12} />
                    <span>Messaggi cifrati E2E su questo dispositivo</span>
                    <button
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}
                      title="Rimuovi chiavi da questo dispositivo"
                      onClick={() => setConfermaRimuoviChiavi(true)}>
                      <RotateCcw size={11} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {confermaRimuoviChiavi && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ width: '100%', overflow: 'hidden' }}>
                        <div className="glass-card" style={{ padding: '0.6rem 0.75rem', border: '1px solid rgba(248,113,113,0.3)', marginTop: 4 }}>
                          <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                            Rimuovere le chiavi da questo dispositivo? Dovrai risincronizzarlo.
                          </p>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              onClick={() => setConfermaRimuoviChiavi(false)}>
                              Annulla
                            </button>
                            <button className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                              onClick={async () => { await deleteLocalKeys(twitchUser); setConfermaRimuoviChiavi(false); setFase('setup-joiner'); }}>
                              Sì, rimuovi
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Ricerca */}
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  <input className="mod-input" style={{ paddingLeft: 30, fontSize: '0.85rem' }}
                    placeholder="Cerca conversazione o amico…"
                    value={ricercaAmico}
                    onChange={e => setRicercaAmico(e.target.value)} />
                </div>
              </div>

              {/* Lista conversazioni */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.25rem 0.5rem' }}>
                {caricandoConvo && conversazioni.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>
                    <Loader size={20} className="spin" />
                  </div>
                ) : convFiltrate.length === 0 && amiciSuggeriti.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
                    <Users size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                    {ricercaAmico ? (
                      <>
                        <p>Nessun risultato per &ldquo;{ricercaAmico}&rdquo;.</p>
                        <p style={{ marginTop: 4 }}>Premi <strong>+</strong> per iniziare una nuova chat.</p>
                      </>
                    ) : (
                      <>
                        <p>Nessuna conversazione ancora.</p>
                        <p>Premi <strong>+</strong> per iniziare.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {convFiltrate.map(c => (
                      <button key={c.user}
                        className={`msg-convo-item${c.unread > 0 ? ' msg-convo-item-unread' : ''}`}
                        onClick={() => selezionaChat(c.user)}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <AvatarUtente username={c.user} avatarCache={avatarCache} dimensione={36} />
                          {c.unread > 0 && <span className="msg-pallino" />}
                          {onlineMap[c.user] && !c.unread && <span className="msg-convo-online-dot" />}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: c.unread > 0 ? 700 : 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.user}</span>
                            <span className="msg-convo-time" style={{ flexShrink: 0 }}>{c.lastMessageAt ? formatOraRelativa(c.lastMessageAt) : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{
                              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontSize: '0.8rem', color: c.unread > 0 ? 'var(--text-main)' : 'var(--text-faint)',
                              fontWeight: c.unread > 0 ? 500 : 400,
                            }}>
                              {anteprime[c.user] || ''}
                            </span>
                            {c.unread > 0 && (
                              <span className="msg-unread-badge">
                                {c.unread > 99 ? '99+' : c.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Amici suggeriti non ancora in chat */}
                    {amiciSuggeriti.length > 0 && (
                      <div style={{ marginTop: convFiltrate.length > 0 ? 4 : 0 }}>
                        <div className="msg-sezione-label" style={{ padding: '6px 6px 4px' }}>Amici</div>
                        {amiciSuggeriti.map(a => (
                          <button key={`sug-${a}`} className="msg-amico-item" style={{ padding: '0.55rem 0.5rem' }}
                            onClick={() => apriChat(a)}>
                            <AvatarUtente username={a} avatarCache={avatarCache} dimensione={36} />
                            <div className="msg-amico-info">
                              <span className="msg-amico-nome">{a}</span>
                              <span className="msg-amico-sub" style={{ color: 'var(--primary)' }}>Inizia chat</span>
                            </div>
                            <Plus size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vista chat */}
        <AnimatePresence mode="wait">
          {chatAperta && (
            <motion.div key={chatAperta}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ChatView
                conUsr={chatAperta}
                twitchUser={twitchUser}
                twitchToken={twitchToken}
                privateKeyRef={privateKeyRef}
                onTorna={() => { segnaLetta(chatAperta); setChatAperta(null); caricaConversazioni(); }}
                emoteCanale={emoteCanale}
                emoteGlobali={emoteGlobali}
                avatarCache={avatarCache}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overlay nuova conversazione */}
      <AnimatePresence>
        {nuovaConvo && (
          <PannelloNuovaConvo
            twitchUser={twitchUser}
            amici={amici}
            conversazioni={conversazioni}
            avatarCache={avatarCache}
            onAvvia={dest => apriChat(dest)}
            onChiudi={() => setNuovaConvo(false)}
          />
        )}
      </AnimatePresence>

      {/* Overlay sync initiator */}
      <AnimatePresence>
        {mostraSyncInit && (
          <motion.div className="msg-forward-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMostraSyncInit(false)}>
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '92%', maxWidth: 440 }}>
              <PannelloSyncInitiator
                token={twitchToken}
                privateKeyRef={privateKeyRef}
                onChiudi={() => setMostraSyncInit(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay gestione backup */}
      <AnimatePresence>
        {mostraGestioneBackup && (
          <motion.div className="msg-forward-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMostraGestioneBackup(false)}>
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '92%', maxWidth: 440 }}>
              <PannelloGestioneBackup
                token={twitchToken}
                username={twitchUser}
                privateKeyRef={privateKeyRef}
                onChiudi={() => setMostraGestioneBackup(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
