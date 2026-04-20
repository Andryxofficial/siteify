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
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, Send, ArrowLeft, ArrowDown, MessageSquare, Users, LogIn, Loader, Shield,
  Clock, AlertTriangle, Pencil, Trash2, X, Plus, Image as ImageIcon, Check, RefreshCw,
  Bell, KeyRound, ChevronDown, Search, Fingerprint, Key, Copy, CornerUpRight,
  Smartphone, QrCode, RotateCcw, Download, Upload, ShieldAlert,
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
  encryptBytes,
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
          } catch {
            /* Utente ha annullato o PRF fallito → mostra selezione metodo */
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
      setStato('ok');
      setTimeout(() => onComplete(privateKey), 600);
    } catch (e) {
      setErrore(`Errore nella generazione chiavi: ${e.message}`);
      setStato('errore');
    }
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

  return null;
}

/* ═══════════════════════════════════════════════
   Initiator di sincronizzazione (ha già le chiavi)
═══════════════════════════════════════════════ */
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
        if (dati.status === 'complete' || dati.status === 'ready') { setStato('ok'); return; }
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
   Singolo messaggio
═══════════════════════════════════════════════ */
const MessaggioBubble = memo(function MessaggioBubble({ msg, mio, raggruppato, onModifica, onElimina, onInoltra }) {
  const [menuAperto, setMenuAperto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuAperto) return;
    const chiudi = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAperto(false); };
    document.addEventListener('pointerdown', chiudi);
    return () => document.removeEventListener('pointerdown', chiudi);
  }, [menuAperto]);

  const testoVisibile = msg.eliminato ? null : (msg.testoDecifrato || null);

  return (
    <div className={`msg-wrapper${raggruppato ? ' msg-grouped' : ''}`}
      style={{ justifyContent: mio ? 'flex-end' : 'flex-start' }}>
      {!mio && !raggruppato && (
        <div className="msg-avatar msg-avatar-sm"
          style={{ backgroundImage: msg.avatarMittente ? `url(${msg.avatarMittente})` : undefined }}>
          {!msg.avatarMittente && (msg.da?.[0]?.toUpperCase() || '?')}
        </div>
      )}
      {!mio && raggruppato && <div style={{ width: 28 }} />}
      <div style={{ position: 'relative', maxWidth: '72%' }}>
        <div
          className={`msg-bubble${mio ? ' msg-mine' : ' msg-theirs'}${raggruppato ? ' msg-bubble-grouped' : ''}`}
          onContextMenu={e => { e.preventDefault(); setMenuAperto(true); }}>
          {msg.eliminato ? (
            <span className="msg-deleted-text">
              <Trash2 size={12} style={{ marginRight: 4 }} /> Messaggio eliminato
            </span>
          ) : msg.tipoMedia === 'image' ? (
            <div className="msg-media-content">
              {msg.mediaDecifrato ? (
                <img src={msg.mediaDecifrato} alt="Immagine"
                  className="msg-media-preview" style={{ borderRadius: 8, maxWidth: '100%' }} />
              ) : (
                <div className="msg-media-loading"><Loader size={18} className="spin" /> Caricamento…</div>
              )}
              {testoVisibile && <p className="msg-text" style={{ marginTop: 6 }}>{testoVisibile}</p>}
            </div>
          ) : msg.tipoMedia === 'file' ? (
            <div className="msg-media-content">
              <div className="msg-media-thumb">
                {msg.mediaDecifrato ? (
                  <a href={msg.mediaDecifrato} download={msg.nomeFile}
                    style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={16} /> <span className="msg-media-name">{msg.nomeFile}</span>
                  </a>
                ) : (
                  <div className="msg-media-loading">
                    <Loader size={16} className="spin" /> {msg.nomeFile}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="msg-text">{testoVisibile}</p>
          )}
          <div className="msg-time">
            {msg.modificato && <span className="msg-edited">mod.</span>}
            <span>{formatOra(msg.ts)}</span>
            {mio && <span className="msg-check"><Check size={12} /></span>}
          </div>
        </div>

        {/* Azioni hover */}
        {!msg.eliminato && (
          <div className="msg-hover-actions" style={{ [mio ? 'right' : 'left']: '100%' }}>
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

        {/* Menu contestuale */}
        <AnimatePresence>
          {menuAperto && (
            <motion.div ref={menuRef} className="msg-context-menu"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ [mio ? 'right' : 'left']: 0, top: '100%', zIndex: 50 }}>
              {!msg.eliminato && testoVisibile && (
                <button className="msg-context-item"
                  onClick={() => { copiaNeglAppunti(testoVisibile); setMenuAperto(false); }}>
                  <Copy size={13} /> Copia
                </button>
              )}
              {!msg.eliminato && (
                <button className="msg-context-item"
                  onClick={() => { onInoltra(msg); setMenuAperto(false); }}>
                  <CornerUpRight size={13} /> Inoltra
                </button>
              )}
              {mio && !msg.eliminato && (
                <button className="msg-context-item"
                  onClick={() => { onModifica(msg); setMenuAperto(false); }}>
                  <Pencil size={13} /> Modifica
                </button>
              )}
              {mio && (
                <button className="msg-context-item msg-context-danger"
                  onClick={() => { onElimina(msg); setMenuAperto(false); }}>
                  <Trash2 size={13} /> Elimina
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   Pannello inoltra messaggio
═══════════════════════════════════════════════ */
function PannelloInoltra({ msg, twitchToken, twitchUser, privateKeyRef, onChiudi }) {
  const [conversazioni, setConversazioni] = useState([]);
  const [inviati, setInviati] = useState({});
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    apiFetch(twitchToken, '?action=conversations', {})
      .then(d => setConversazioni(d.conversations || []))
      .catch(() => {})
      .finally(() => setCaricamento(false));
  }, [twitchToken]);

  async function inoltraA(dest) {
    if (inviati[dest]) return;
    try {
      const risposta = await fetch(`${API}?action=key&user=${dest}`);
      const dati = await risposta.json();
      if (!dati.publicKey) return;
      const pubKey = await importPublicKey(dati.publicKey);
      const aesKey = await deriveKey(privateKeyRef.current, pubKey);
      const testo = msg.testoDecifrato || '';
      const { encrypted, iv } = await encryptMessage(aesKey, `\u21aa ${testo}`);
      await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', to: dest, encrypted, iv }),
      });
      setInviati(prev => ({ ...prev, [dest]: true }));
    } catch { /* ignora */ }
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
        {caricamento ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}><Loader size={18} className="spin" /></div>
        ) : (
          <div className="msg-forward-list">
            {conversazioni.filter(c => c.user !== twitchUser).map(c => (
              <button key={c.user}
                className={`msg-forward-friend${inviati[c.user] ? ' msg-forward-sent' : ''}`}
                onClick={() => inoltraA(c.user)}>
                <div className="msg-avatar msg-avatar-sm">{c.user[0]?.toUpperCase()}</div>
                <span>{c.user}</span>
                {inviati[c.user] && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Vista chat
═══════════════════════════════════════════════ */
function ChatView({ conUsr, twitchUser, twitchToken, privateKeyRef, onTorna, emoteCanale, emoteGlobali }) {
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
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const aesKeyCache = useRef(null);
  const ultimoIdRef = useRef(null);
  const ultimoTsRef = useRef(null);

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

  /* ─── Decifra un messaggio ─── */
  const decifraMessaggio = useCallback(async (msg) => {
    if (msg.eliminato) return { ...msg, testoDecifrato: null };
    try {
      const aesKey = await ottieniAesKey();
      const testoDecifrato = await decryptMessage(aesKey, msg.encrypted || msg.testo, msg.iv);
      return { ...msg, testoDecifrato };
    } catch {
      return { ...msg, testoDecifrato: '[Impossibile decifrare]' };
    }
  }, [ottieniAesKey]);

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
    return () => clearTimeout(pollTimerRef.current);
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
          if (dati.changed && dati.messages?.length > 0) {
            const decifrati = await Promise.all(dati.messages.map(decifraMessaggio));
            setMessaggi(prev => {
              const mappa = new Map(prev.map(m => [m.id, m]));
              decifrati.forEach(m => mappa.set(m.id, m));
              return Array.from(mappa.values()).sort((a, b) => a.ts - b.ts);
            });
            const ultimo = decifrati[decifrati.length - 1];
            if (ultimo) { ultimoIdRef.current = ultimo.id; ultimoTsRef.current = ultimo.ts; }
          }
          pollTimerRef.current = setTimeout(poll, 3000);
        })
        .catch(() => { pollTimerRef.current = setTimeout(poll, 5000); });
    }
    pollTimerRef.current = setTimeout(poll, 3000);
    return () => clearTimeout(pollTimerRef.current);
  }, [caricamento, conUsr, twitchToken, decifraMessaggio]);

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

  /* ─── Upload media cifrato ─── */
  async function caricaMedia(file) {
    if (!file) return;
    setFileInUpload(true);
    setErrore('');
    try {
      const aesKey = await ottieniAesKey();
      const buffer = await file.arrayBuffer();
      const { data, iv } = await encryptBytes(aesKey, buffer);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      const ivBase64 = btoa(String.fromCharCode(...new Uint8Array(iv)));
      const tipoMedia = file.type.startsWith('image/') ? 'image' : 'file';
      const { encrypted: encNome, iv: ivNome } = await encryptMessage(aesKey, file.name);
      const risposta = await apiFetch(twitchToken, '', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', to: conUsr, encrypted: base64, iv: ivBase64, tipoMedia, nomeFile: encNome, ivNome }),
      });
      const url = URL.createObjectURL(file);
      const nuovoMsg = { ...risposta.message, testoDecifrato: '', tipoMedia, nomeFile: file.name, mediaDecifrato: url };
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

  /* ─── Raggruppa messaggi per data/mittente ─── */
  const messaggiConMeta = messaggi.map((msg, i) => {
    const prev = messaggi[i - 1];
    const nuovaData = !prev || formatData(msg.ts) !== formatData(prev.ts);
    const raggruppato = !nuovaData && prev && prev.da === msg.da && !prev.eliminato && !msg.eliminato;
    return { msg, separatoreData: nuovaData ? formatData(msg.ts) : null, raggruppato };
  });

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(e); }
    if (e.key === 'Escape' && modificandoId) { setModificandoId(null); setTesto(''); }
  }

  return (
    <div className="msg-chat-container">
      {/* Header */}
      <div className="msg-chat-header">
        <button className="btn btn-ghost" onClick={onTorna}><ArrowLeft size={18} /></button>
        <div className="msg-avatar msg-avatar-sm">{conUsr[0]?.toUpperCase()}</div>
        <span style={{ fontWeight: 600 }}>{conUsr}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-faint)', fontSize: '0.75rem' }}>
          <Lock size={12} /> E2E
        </div>
      </div>

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
            {messaggiConMeta.map(({ msg, separatoreData, raggruppato }) => (
              <div key={msg.id}>
                {separatoreData && (
                  <div className="msg-date-separator"><span>{separatoreData}</span></div>
                )}
                <MessaggioBubble
                  msg={msg}
                  mio={msg.da === twitchUser}
                  raggruppato={raggruppato}
                  onModifica={m => { setModificandoId(m.id); setTesto(m.testoDecifrato || ''); textareaRef.current?.focus(); }}
                  onElimina={eliminaMessaggio}
                  onInoltra={m => setInoltraMsg(m)}
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
          <button type="button" className="mod-icon-btn" disabled={fileInUpload}
            onClick={() => fileInputRef.current?.click()}>
            {fileInUpload ? <Loader size={16} className="spin" /> : <ImageIcon size={16} />}
          </button>
          <input ref={fileInputRef} type="file"
            accept="image/*,application/pdf,.doc,.docx,.zip"
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
            onChange={e => setTesto(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={fileInUpload}
            style={{ resize: 'none', flex: 1, minHeight: 36, maxHeight: 120, overflow: 'auto' }}
          />
          <button type="submit" className="msg-send-btn" disabled={!testo.trim() || fileInUpload}>
            {modificandoId ? <Check size={18} /> : <Send size={18} />}
          </button>
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
  const [cercaUtente, setCercaUtente] = useState('');
  const [erroreRicerca, setErroreRicerca] = useState('');
  const [mostraSyncInit, setMostraSyncInit] = useState(false);
  const [caricandoConvo, setCaricandoConvo] = useState(false);
  const [confermaRimuoviChiavi, setConfermaRimuoviChiavi] = useState(false);
  const privateKeyRef = useRef(null);
  const pollConvoRef = useRef(null);

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

  function onSetupCompleto(privKey) {
    privateKeyRef.current = privKey;
    setFase('messaggi');
  }

  async function avviaNuovaConvo() {
    const dest = cercaUtente.trim().toLowerCase();
    if (!dest || dest === twitchUser) { setErroreRicerca('Inserisci un utente valido.'); return; }
    setErroreRicerca('');
    const dati = await fetch(`${API}?action=key&user=${dest}`).then(r => r.json()).catch(() => ({}));
    if (!dati.publicKey) { setErroreRicerca(`${dest} non ha ancora abilitato i messaggi.`); return; }
    setChatAperta(dest);
    setNuovaConvo(false);
    setCercaUtente('');
    setConversazioni(prev => prev.find(c => c.user === dest) ? prev : [{ user: dest, lastMessageAt: Date.now() }, ...prev]);
  }

  const convFiltrate = conversazioni.filter(c => c.user.toLowerCase().includes(ricercaAmico.toLowerCase()));

  /* ─── Fase: inizializzazione ─── */
  if (fase === 'inizializzazione') {
    return (
      <>
        <SEO titolo="Messaggi" />
        <SpinnerCentrale testo="Inizializzazione messaggi sicuri…" />
      </>
    );
  }

  /* ─── Fase: non-autenticato ─── */
  if (fase === 'non-autenticato') {
    return (
      <>
        <SEO titolo="Messaggi" />
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
        <SEO titolo="Setup messaggi" />
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
        <SEO titolo="Sincronizza dispositivo" />
        <div style={{ padding: '1rem' }}>
          <FaseSetupJoiner username={twitchUser} token={twitchToken} onComplete={onSetupCompleto} />
        </div>
      </>
    );
  }

  /* ─── Fase: messaggi ─── */
  return (
    <>
      <SEO titolo="Messaggi" />
      <div className="msg-main-panel">
        {/* Barra laterale conversazioni */}
        <AnimatePresence mode="wait">
          {!chatAperta && (
            <motion.div key="lista"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-panel"
              style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                      onClick={() => setNuovaConvo(v => !v)}>
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
                    placeholder="Cerca conversazione…"
                    value={ricercaAmico}
                    onChange={e => setRicercaAmico(e.target.value)} />
                </div>

                {/* Form nuova conversazione */}
                <AnimatePresence>
                  {nuovaConvo && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="mod-input" style={{ flex: 1, fontSize: '0.85rem' }}
                          placeholder="Username Twitch…"
                          value={cercaUtente}
                          onChange={e => { setCercaUtente(e.target.value); setErroreRicerca(''); }}
                          onKeyDown={e => e.key === 'Enter' && avviaNuovaConvo()} />
                        <button className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={avviaNuovaConvo}>
                          <Send size={14} />
                        </button>
                      </div>
                      {erroreRicerca && <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: 4 }}>{erroreRicerca}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Lista conversazioni */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {caricandoConvo && conversazioni.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>
                    <Loader size={20} className="spin" />
                  </div>
                ) : convFiltrate.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
                    <Users size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p>Nessuna conversazione ancora.</p>
                    <p>Premi &ldquo;Nuovo&rdquo; per iniziare.</p>
                  </div>
                ) : (
                  convFiltrate.map(c => (
                    <button key={c.user} className="msg-convo-item" onClick={() => setChatAperta(c.user)}>
                      <div className="msg-avatar msg-avatar-sm">{c.user[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.user}</div>
                      </div>
                      <div className="msg-convo-time">{c.lastMessageAt ? formatOra(c.lastMessageAt) : ''}</div>
                    </button>
                  ))
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
              style={{ flex: 1, height: '100%' }}>
              <ChatView
                conUsr={chatAperta}
                twitchUser={twitchUser}
                twitchToken={twitchToken}
                privateKeyRef={privateKeyRef}
                onTorna={() => { setChatAperta(null); caricaConversazioni(); }}
                emoteCanale={emoteCanale}
                emoteGlobali={emoteGlobali}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    </>
  );
}
