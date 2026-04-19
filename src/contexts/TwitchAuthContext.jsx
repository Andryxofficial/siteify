import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  ensureE2EKeysRegistered,
  forceResetE2EKeys,
  getFromIDB,
  setInIDB,
  encryptPrivateKeyForBackup,
  decryptPrivateKeyFromBackup,
  generateKeyPair,
  exportPublicKey,
  createPasskeyAndEncryptKey,
  authenticatePasskeyAndDecryptKey,
  createAutoSyncBackup,
  restoreFromAutoSync,
} from '../utils/e2eKeys';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;
const STORAGE_KEY = 'twitchGameToken';
const API_MSG = '/api/messages';

const TwitchAuthContext = createContext(null);

/**
 * Builds the Twitch OAuth implicit-flow URL.
 * Always uses /gioco as redirect_uri (the only URI registered in Twitch).
 * If `returnPath` is provided, it's saved in sessionStorage so the app
 * can navigate back after the OAuth callback.
 */
function buildTwitchLoginUrl(returnPath) {
  const redirect = window.location.origin + '/gioco';
  // Save desired return path so TwitchOAuthRedirect can navigate back
  const desiredPath = returnPath || window.location.pathname;
  if (desiredPath && desiredPath !== '/gioco') {
    sessionStorage.setItem('twitchAuthReturnPath', desiredPath);
  }
  return (
    `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=token&scope=user:read:email+moderation:read`
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTwitchAuth() {
  const ctx = useContext(TwitchAuthContext);
  if (!ctx) throw new Error('useTwitchAuth deve essere usato dentro TwitchAuthProvider');
  return ctx;
}

export function TwitchAuthProvider({ children }) {
  const [twitchUser, setTwitchUser] = useState(null);     // login name
  const [twitchDisplay, setTwitchDisplay] = useState(null); // display_name
  const [twitchAvatar, setTwitchAvatar] = useState(null);   // profile_image_url
  const [twitchToken, setTwitchToken] = useState(null);
  const [twitchUserId, setTwitchUserId] = useState(null);   // user_id numerico stabile
  const [loading, setLoading] = useState(true);

  // ── E2E key state (tracked, not fire-and-forget) ──
  const [e2eReady, setE2eReady] = useState(false);
  const [e2eError, setE2eError] = useState(null);
  const [e2eNeedsPassphrase, setE2eNeedsPassphrase] = useState(null); // null | 'setup' | 'unlock'
  const [e2eNeedsSync, setE2eNeedsSync] = useState(false); // local keys exist but no server backup
  const e2ePrivateKeyRef = useRef(null);

  /* ── Register E2E keys — handles cross-device passphrase flow ── */
  const registerE2EKeys = useCallback(async (user, token, userId) => {
    const API = '/api/messages';
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 1. Check local IndexedDB for existing keys
        const localKey = await getFromIDB(`privateKey:${user}`);
        if (localKey) {
          e2ePrivateKeyRef.current = localKey;
          setE2eReady(true);
          setE2eError(null);
          // Check if server backup exists — if not, suggest sync
          try {
            const r = await fetch(`${API}?action=has_passphrase`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const d = await r.json();
            if (!d.hasPassphrase) setE2eNeedsSync(true);
          } catch { /* non-blocking */ }
          // Best-effort: ensure public key is on server
          ensureE2EKeysRegistered(user, token).catch(() => {});
          // Best-effort: create auto-sync backup se non esiste ancora
          if (userId) {
            const localPubStr = await getFromIDB(`publicKeyString:${user}`).catch(() => null);
            createAutoSyncBackup(localKey, userId, token, localPubStr).catch(() => {});
          }
          return;
        }

        // 1b. Nessuna chiave locale — prova il ripristino automatico via Twitch (trasparente)
        if (userId) {
          try {
            const restoredKey = await restoreFromAutoSync(userId, token);
            if (restoredKey) {
              // Estrai la chiave pubblica dalla privata per salvarla in IDB
              const jwk = await crypto.subtle.exportKey('jwk', restoredKey);
              const pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: [] };
              const publicKeyString = JSON.stringify(pubJwk);
              await setInIDB(`privateKey:${user}`, restoredKey);
              await setInIDB(`publicKeyString:${user}`, publicKeyString);
              e2ePrivateKeyRef.current = restoredKey;
              // Assicura che la chiave pubblica sia aggiornata sul server
              await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
              }).catch(() => {});
              setE2eReady(true);
              setE2eError(null);
              return;
            }
          } catch { /* ripristino auto non riuscito — procedi con flusso manuale */ }
        }

        // 2. No local keys — check server for passphrase-protected backup
        // Gli errori di rete qui si propagano al catch esterno, che esegue il retry
        // con backoff. Questo impedisce che un errore temporaneo di rete faccia
        // mostrare il dialog di setup, che genererebbe nuove chiavi incompatibili
        // con i messaggi già cifrati su altri dispositivi.
        const r = await fetch(`${API}?action=has_passphrase`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (d.hasPassphrase) {
          setE2eNeedsPassphrase('unlock');
          return; // attendi che l'utente inserisca la passphrase
        }

        // 3. Nessuna chiave locale, nessun backup — primo accesso → setup
        setE2eNeedsPassphrase('setup');
        return;
      } catch (e) {
        console.warn(`E2E init attempt ${attempt + 1} failed:`, e);
        if (attempt === MAX_RETRIES) {
          setE2eError('Impossibile verificare le chiavi. Controlla la connessione e riprova.');
        } else {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
  }, []);

  /* ── Validate a stored token against Twitch ── */
  const validateToken = useCallback(async (token) => {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!res.ok) throw new Error('Token expired');
      const data = await res.json();
      setTwitchUser(data.login);
      setTwitchToken(token);
      const userId = data.user_id || null;
      setTwitchUserId(userId);

      // Register E2E keys (tracked with retry, so the user can receive messages
      // even before they ever visit /messaggi)
      registerE2EKeys(data.login, token, userId);

      // Fetch full profile (display_name, avatar)
      try {
        const profileRes = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': CHIAVETWITCH,
          },
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const u = profileData.data?.[0];
          if (u) {
            setTwitchDisplay(u.display_name || data.login);
            setTwitchAvatar(u.profile_image_url || null);
          }
        }
      } catch { /* profile fetch is best-effort */ }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setTwitchToken(null);
      setTwitchUser(null);
      setTwitchDisplay(null);
      setTwitchAvatar(null);
      setTwitchUserId(null);
    } finally {
      setLoading(false);
    }
  }, [registerE2EKeys]);

  /* ── On mount: check URL hash for fresh token, else use stored ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
        window.history.replaceState(null, '', window.location.pathname);
        validateToken(token);
        return;
      }
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      validateToken(saved);
    } else {
      setLoading(false);
    }
  }, [validateToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTwitchUser(null);
    setTwitchDisplay(null);
    setTwitchAvatar(null);
    setTwitchToken(null);
    setTwitchUserId(null);
    setE2eReady(false);
    setE2eError(null);
    setE2eNeedsPassphrase(null);
    setE2eNeedsSync(false);
    e2ePrivateKeyRef.current = null;
  }, []);

  /** Allow manual retry of E2E key registration (e.g. after a transient failure) */
  const retryE2E = useCallback(() => {
    if (!twitchUser || !twitchToken) return;
    setE2eReady(false);
    setE2eError(null);
    setE2eNeedsPassphrase(null);
    e2ePrivateKeyRef.current = null;
    registerE2EKeys(twitchUser, twitchToken, twitchUserId);
  }, [twitchUser, twitchToken, twitchUserId, registerE2EKeys]);

  /** Force-reset E2E keys: wipes old keys from IndexedDB and generates fresh ones.
   *  Use when existing keys are corrupted and causing derivation failures. */
  const resetE2E = useCallback(async () => {
    if (!twitchUser || !twitchToken) return;
    setE2eReady(false);
    setE2eError(null);
    setE2eNeedsPassphrase(null);
    setE2eNeedsSync(false);
    e2ePrivateKeyRef.current = null;
    try {
      const privateKey = await forceResetE2EKeys(twitchUser, twitchToken);
      e2ePrivateKeyRef.current = privateKey;
      setE2eReady(true);
      setE2eError(null);
      // Prompt to set up sync with new keys
      setE2eNeedsSync(true);
      // Crea subito il backup automatico con le nuove chiavi
      if (twitchUserId) {
        const pubStr = await getFromIDB(`publicKeyString:${twitchUser}`).catch(() => null);
        createAutoSyncBackup(privateKey, twitchUserId, twitchToken, pubStr)
          .catch(e => {
            console.warn('Auto-sync backup post-reset non riuscito:', e);
            setE2eNeedsSync(true);
          });
      }
    } catch (e) {
      console.error('E2E key reset failed:', e);
      setE2eError('Reset chiavi fallito. Riprova.');
    }
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Setup passphrase: generate keys (or use existing local ones) + encrypt + backup to server */
  const setupE2EPassphrase = useCallback(async (passphrase) => {
    if (!twitchUser || !twitchToken) throw new Error('Non autenticato.');
    const API = '/api/messages';

    // Use existing local keys if available, otherwise generate new
    let privateKey = await getFromIDB(`privateKey:${twitchUser}`);
    let publicKeyString = await getFromIDB(`publicKeyString:${twitchUser}`);

    if (!privateKey) {
      const keyPair = await generateKeyPair();
      privateKey = keyPair.privateKey;
      publicKeyString = await exportPublicKey(keyPair.publicKey);
      await setInIDB(`privateKey:${twitchUser}`, privateKey);
      await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
    }

    if (!publicKeyString) {
      // Extract public key from private
      const jwk = await crypto.subtle.exportKey('jwk', privateKey);
      const pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: [] };
      publicKeyString = JSON.stringify(pubJwk);
      await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
    }

    // Encrypt private key with passphrase
    const backup = await encryptPrivateKeyForBackup(privateKey, passphrase);

    // Upload encrypted key + public key to server
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({
        action: 'save_encrypted_key',
        ...backup,
        publicKey: publicKeyString,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Errore nel salvataggio.');
    }

    // Also ensure public key is registered
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
    }).catch(() => {});

    // Crea il backup automatico in background per accesso trasparente su altri dispositivi.
    // Se fallisce dopo tutti i tentativi, mostra il banner di sincronizzazione.
    if (twitchUserId) {
      createAutoSyncBackup(privateKey, twitchUserId, twitchToken, publicKeyString)
        .catch(e => {
          console.warn('setupE2EPassphrase: auto-sync backup non riuscito:', e);
          setE2eNeedsSync(true);
        });
    }

    e2ePrivateKeyRef.current = privateKey;
    setE2eReady(true);
    setE2eNeedsPassphrase(null);
    setE2eNeedsSync(false);
    setE2eError(null);
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Unlock passphrase: download encrypted key from server, decrypt, store locally */
  const unlockE2EPassphrase = useCallback(async (passphrase) => {
    if (!twitchUser || !twitchToken) throw new Error('Non autenticato.');
    const API = '/api/messages';

    const res = await fetch(`${API}?action=get_encrypted_key`, {
      headers: { Authorization: `Bearer ${twitchToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Backup non trovato.');

    // When the primary backup is passkey-based, the password fields live in passwordBackup
    let encKeyData, saltData, ivData;
    if (data.method === 'passkey') {
      if (!data.passwordBackup?.encryptedPrivateKey) {
        throw new Error('Nessuna password di recupero associata a questo backup passkey.');
      }
      encKeyData = data.passwordBackup.encryptedPrivateKey;
      saltData = data.passwordBackup.salt;
      ivData = data.passwordBackup.iv;
    } else {
      encKeyData = data.encryptedPrivateKey;
      saltData = data.salt;
      ivData = data.iv;
    }

    // Decrypt private key with passphrase (will throw if wrong passphrase)
    const privateKey = await decryptPrivateKeyFromBackup(encKeyData, saltData, ivData, passphrase);

    // Extract public key
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    const pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: [] };
    const publicKeyString = JSON.stringify(pubJwk);

    // Store locally
    await setInIDB(`privateKey:${twitchUser}`, privateKey);
    await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);

    // Ensure public key is on server
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
    }).catch(() => {});

    // Aggiorna l'auto-sync backup dopo sblocco password, per non richiedere
    // la password di nuovo su dispositivi futuri
    if (twitchUserId) {
      createAutoSyncBackup(privateKey, twitchUserId, twitchToken, publicKeyString)
        .catch(e => console.warn('unlockE2EPassphrase: auto-sync backup non riuscito:', e));
    }

    e2ePrivateKeyRef.current = privateKey;
    setE2eReady(true);
    setE2eNeedsPassphrase(null);
    setE2eError(null);
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Setup passkey: create WebAuthn credential with PRF, encrypt key, backup to server.
   *  @param {string|null} fallbackPassphrase — optional password stored as cross-device recovery */
  const setupE2EPasskey = useCallback(async (fallbackPassphrase = null) => {
    if (!twitchUser || !twitchToken) throw new Error('Non autenticato.');
    const API = '/api/messages';

    let privateKey = await getFromIDB(`privateKey:${twitchUser}`);
    let publicKeyString = await getFromIDB(`publicKeyString:${twitchUser}`);

    if (!privateKey) {
      const keyPair = await generateKeyPair();
      privateKey = keyPair.privateKey;
      publicKeyString = await exportPublicKey(keyPair.publicKey);
      await setInIDB(`privateKey:${twitchUser}`, privateKey);
      await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
    }

    if (!publicKeyString) {
      const jwk = await crypto.subtle.exportKey('jwk', privateKey);
      const pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: [] };
      publicKeyString = JSON.stringify(pubJwk);
      await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
    }

    const backup = await createPasskeyAndEncryptKey(twitchUser, privateKey);

    const saveBody = {
      action: 'save_encrypted_key',
      method: 'passkey',
      encryptedPrivateKey: backup.encryptedPrivateKey,
      iv: backup.iv,
      credentialId: backup.credentialId,
      publicKey: publicKeyString,
    };

    // If a fallback passphrase is provided, also encrypt with PBKDF2 for cross-device recovery
    if (fallbackPassphrase) {
      const pwBackup = await encryptPrivateKeyForBackup(privateKey, fallbackPassphrase);
      saveBody.passwordBackup = pwBackup;
    }

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify(saveBody),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Errore nel salvataggio.');
    }

    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
    }).catch(() => {});

    // Crea il backup automatico in background per accesso trasparente su altri dispositivi.
    // Se fallisce dopo tutti i tentativi, mostra il banner di sincronizzazione.
    if (twitchUserId) {
      createAutoSyncBackup(privateKey, twitchUserId, twitchToken, publicKeyString)
        .catch(e => {
          console.warn('setupE2EPasskey: auto-sync backup non riuscito:', e);
          setE2eNeedsSync(true);
        });
    }

    e2ePrivateKeyRef.current = privateKey;
    setE2eReady(true);
    setE2eNeedsPassphrase(null);
    setE2eNeedsSync(false);
    setE2eError(null);
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Unlock passkey: authenticate with WebAuthn PRF, decrypt key, store locally */
  const unlockE2EPasskey = useCallback(async () => {
    if (!twitchUser || !twitchToken) throw new Error('Non autenticato.');
    const API = '/api/messages';

    const res = await fetch(`${API}?action=get_encrypted_key`, {
      headers: { Authorization: `Bearer ${twitchToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Backup non trovato.');

    const privateKey = await authenticatePasskeyAndDecryptKey(
      data.encryptedPrivateKey, data.iv, data.credentialId
    );

    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    const pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: [] };
    const publicKeyString = JSON.stringify(pubJwk);

    await setInIDB(`privateKey:${twitchUser}`, privateKey);
    await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);

    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
    }).catch(() => {});

    // Aggiorna l'auto-sync backup con le chiavi sbloccate
    if (twitchUserId) {
      createAutoSyncBackup(privateKey, twitchUserId, twitchToken, publicKeyString)
        .catch(e => console.warn('unlockE2EPasskey: auto-sync backup non riuscito:', e));
    }

    e2ePrivateKeyRef.current = privateKey;
    setE2eReady(true);
    setE2eNeedsPassphrase(null);
    setE2eError(null);
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Add or update password fallback on an existing passkey backup */
  const addE2EPasswordFallback = useCallback(async (passphrase) => {
    if (!twitchUser || !twitchToken) throw new Error('Non autenticato.');
    const privateKey = await getFromIDB(`privateKey:${twitchUser}`);
    if (!privateKey) throw new Error('Chiave privata non trovata su questo dispositivo. Sblocca prima i messaggi con la tua passkey, poi aggiungi la password di recupero.');

    const backup = await encryptPrivateKeyForBackup(privateKey, passphrase);

    const res = await fetch(API_MSG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'add_password_fallback', ...backup }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Errore nel salvataggio.');
    }
  }, [twitchUser, twitchToken]);

  /**
   * Salta la configurazione del backup manuale (password/passkey).
   * Genera le chiavi localmente, le registra sul server (chiave pubblica)
   * e crea SOLO il backup automatico (auto-sync via Twitch userId).
   * NON crea `e2e_backup:user` con una password inaccessibile — questo
   * evitava che Device 2 vedesse il dialog "Inserisci password" senza poterlo
   * sbloccare, portando l'utente al reset e alla perdita di tutti i messaggi.
   */
  const skipE2ESetup = useCallback(async () => {
    if (!twitchUser || !twitchToken) return;
    try {
      // Genera (o usa) le chiavi locali e registra la chiave pubblica sul server
      const privateKey = await ensureE2EKeysRegistered(twitchUser, twitchToken);
      e2ePrivateKeyRef.current = privateKey;
      setE2eReady(true);
      setE2eNeedsPassphrase(null);
      setE2eError(null);
      // Crea solo il backup automatico — trasparente su altri dispositivi.
      // Se fallisce, mostra il banner per invitare a impostare un metodo manuale.
      if (twitchUserId) {
        const pubStr = await getFromIDB(`publicKeyString:${twitchUser}`).catch(() => null);
        createAutoSyncBackup(privateKey, twitchUserId, twitchToken, pubStr)
          .catch(e => {
            console.warn('skipE2ESetup: auto-sync backup non riuscito:', e);
            setE2eNeedsSync(true);
          });
      }
    } catch (e) {
      console.error('skipE2ESetup fallito:', e);
      setE2eError('Impossibile inizializzare la crittografia. Riprova.');
    }
  }, [twitchUser, twitchToken, twitchUserId]);

  /** Get backup metadata (method, credentialId, hasPasswordFallback) without downloading encrypted key */
  const getE2EBackupInfo = useCallback(async () => {
    if (!twitchToken) return null;
    try {
      const res = await fetch(`${API_MSG}?action=get_encrypted_key`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        method: data.method || 'password',
        credentialId: data.credentialId || null,
        hasPasswordFallback: data.hasPasswordFallback || false,
      };
    } catch { return null; }
  }, [twitchToken]);

  return (
    <TwitchAuthContext.Provider value={{
      twitchUser,
      twitchDisplay,
      twitchAvatar,
      twitchToken,
      twitchUserId,
      loading,
      isLoggedIn: !!twitchUser,
      clientId: CHIAVETWITCH,
      logout,
      getTwitchLoginUrl: buildTwitchLoginUrl,
      // E2E encryption state
      e2eReady,
      e2eError,
      e2ePrivateKeyRef,
      e2eNeedsPassphrase,
      e2eNeedsSync,
      retryE2E,
      resetE2E,
      setupE2EPassphrase,
      unlockE2EPassphrase,
      setupE2EPasskey,
      unlockE2EPasskey,
      addE2EPasswordFallback,
      skipE2ESetup,
      getE2EBackupInfo,
    }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
