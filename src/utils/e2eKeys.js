/**
 * E2E Encryption utilities — shared between TwitchAuthContext and MessagesPage.
 *
 * Key storage (IndexedDB — DB: andryx_e2e):
 *   privateKey:<user>       → CryptoKey (ECDH private, extractable)
 *   publicKeyString:<user>  → string (JWK JSON of public key, for re-registration)
 *
 * Redis (via API):
 *   userkeys:<user>         → JWK JSON string of ECDH public key
 */

const API_URL = '/api/messages';
const DB_NAME = 'andryx_e2e';
const DB_STORE = 'keys';

/* ─── IndexedDB ─── */

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setInIDB(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ─── Web Crypto helpers ─── */

export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey']
  );
}

export async function exportPublicKey(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString) {
  if (!jwkString) {
    throw new Error('Chiave pubblica mancante o non valida.');
  }
  let jwk;
  if (typeof jwkString === 'string') {
    try { jwk = JSON.parse(jwkString); }
    catch { throw new Error('Chiave pubblica non è un JSON valido.'); }
  } else if (typeof jwkString === 'object' && jwkString !== null) {
    // @upstash/redis may auto-parse the stored JSON string into an object
    jwk = jwkString;
  } else {
    throw new Error('Chiave pubblica mancante o non valida.');
  }
  if (!jwk || jwk.kty !== 'EC' || !jwk.x || !jwk.y) {
    throw new Error('Chiave pubblica con formato non valido (campi EC mancanti).');
  }
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function deriveKey(privateKey, publicKey) {
  if (!privateKey) {
    throw new Error('Chiave privata non disponibile. Le chiavi E2E non sono ancora state inizializzate.');
  }
  if (!publicKey) {
    throw new Error('Chiave pubblica del destinatario non disponibile.');
  }
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a UTF-8 string → { encrypted: base64, iv: base64 } */
export async function encryptMessage(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/** Decrypt { encrypted: base64, iv: base64 } → string */
export async function decryptMessage(aesKey, encrypted, iv) {
  const cipherBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
  return new TextDecoder().decode(plainBuffer);
}

/** Encrypt an ArrayBuffer → { data: base64, iv: base64 } */
export async function encryptBytes(aesKey, buffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, buffer);
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/** Decrypt { data: base64, iv: base64 } → ArrayBuffer */
export async function decryptBytes(aesKey, data, iv) {
  const cipherBytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
}

/* ─── Key registration ─── */

/**
 * Ensures the logged-in user has an E2E key pair registered in Redis.
 * - Checks IndexedDB for existing keys
 * - Migration: if only privateKey exists (old format), extracts public key from private JWK
 * - If no keys: generates new pair, registers public key on server, stores both in IDB
 * - If local private key exists but server key missing: re-registers
 * Returns the private CryptoKey.
 */
export async function ensureE2EKeysRegistered(twitchUser, twitchToken) {
  let privateKey = await getFromIDB(`privateKey:${twitchUser}`);
  let publicKeyString = await getFromIDB(`publicKeyString:${twitchUser}`);

  if (privateKey && !publicKeyString) {
    // Migration path: extract public key coords from existing private key JWK
    try {
      const privateJwk = await crypto.subtle.exportKey('jwk', privateKey);
      const publicJwk = {
        kty: privateJwk.kty,
        crv: privateJwk.crv,
        x: privateJwk.x,
        y: privateJwk.y,
        key_ops: [],
      };
      publicKeyString = JSON.stringify(publicJwk);
      await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
      // Re-register in case server is missing it
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
      }).catch((e) => console.warn('Key re-registration failed (migration):', e));
    } catch (e) {
      console.warn('Public key migration failed, will generate new pair:', e);
      // If extraction fails (e.g. old non-extractable key), generate fresh pair below
      privateKey = null;
      publicKeyString = null;
    }
  }

  if (!privateKey || !publicKeyString) {
    // Generate fresh key pair
    const keyPair = await generateKeyPair();
    privateKey = keyPair.privateKey;
    publicKeyString = await exportPublicKey(keyPair.publicKey);

    const regRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
    });
    if (!regRes.ok) throw new Error('Registrazione chiave pubblica fallita');

    await setInIDB(`privateKey:${twitchUser}`, privateKey);
    await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);
    return privateKey;
  }

  // Both keys exist locally — best-effort re-sync if server lost the public key
  try {
    const checkRes = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(twitchUser)}`);
    const checkData = await checkRes.json();
    if (!checkData.publicKey) {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
      }).catch((e) => console.warn('Key re-sync failed:', e));
    }
  } catch (e) { console.warn('Key sync check failed:', e); }

  return privateKey;
}

/**
 * Force-reset E2E keys: deletes old keys from IndexedDB, generates a fresh pair,
 * and registers the new public key on the server.
 * Use when existing keys are corrupted or causing derivation failures.
 * WARNING: this makes previously encrypted messages unreadable.
 */
export async function forceResetE2EKeys(twitchUser, twitchToken) {
  // 1. Delete old keys from IndexedDB (may not exist, that's ok)
  await deleteFromIDB(`privateKey:${twitchUser}`).catch((e) => console.warn('deleteFromIDB privateKey:', e));
  await deleteFromIDB(`publicKeyString:${twitchUser}`).catch((e) => console.warn('deleteFromIDB publicKeyString:', e));

  // 2. Generate fresh key pair
  const keyPair = await generateKeyPair();
  const publicKeyString = await exportPublicKey(keyPair.publicKey);

  // 3. Register new public key on server
  const regRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
    body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
  });
  if (!regRes.ok) throw new Error('Registrazione nuova chiave pubblica fallita');

  // 4. Store new keys in IndexedDB
  await setInIDB(`privateKey:${twitchUser}`, keyPair.privateKey);
  await setInIDB(`publicKeyString:${twitchUser}`, publicKeyString);

  return keyPair.privateKey;
}

/* ─── Passphrase-protected key backup (cross-device sync) ─── */

/** Derive an AES-GCM-256 key from a passphrase + salt using PBKDF2 */
export async function derivePassphraseKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt an ECDH private key with a user passphrase for server backup */
export async function encryptPrivateKeyForBackup(privateKey, passphrase) {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const plaintext = new TextEncoder().encode(JSON.stringify(jwk));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePassphraseKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
  return {
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/** Decrypt an ECDH private key from a server backup using the user passphrase */
export async function decryptPrivateKeyFromBackup(encryptedPrivateKey, saltB64, ivB64, passphrase) {
  const cipherBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const aesKey = await derivePassphraseKey(passphrase, salt);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
  const jwk = JSON.parse(new TextDecoder().decode(plainBuffer));
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}

/* ─── Passkey (WebAuthn PRF) key backup ─── */

const PRF_SALT = new TextEncoder().encode('ANDRYXify-e2e-v1');

/** Check if passkeys with PRF extension are available (locally or via cross-device hybrid) */
export async function isPasskeyPRFAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    // Platform authenticator (Face ID, Touch ID, Windows Hello) → best case
    const platformOk = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (platformOk) return true;
    // No local platform authenticator, but WebAuthn is still available.
    // The browser can use hybrid transport (phone-as-authenticator via QR + Bluetooth)
    // so passkeys should still be offered.
    return true;
  } catch { return false; }
}

/**
 * Import raw PRF output bytes as an AES-GCM key for encrypting/decrypting the ECDH private key.
 */
async function prfToAesKey(prfOutput, usage) {
  // HKDF-derive a proper AES key from the PRF output for domain separation
  const keyMaterial = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: PRF_SALT, info: new TextEncoder().encode('e2e-backup') },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Create a passkey (WebAuthn credential) with PRF and encrypt the ECDH private key.
 * Returns { credentialId, encryptedPrivateKey, iv } ready for server storage.
 */
export async function createPasskeyAndEncryptKey(username, privateKey) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(username.slice(0, 64));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'ANDRYXify', id: window.location.hostname },
      user: { id: userId, name: username, displayName: username },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      extensions: {
        prf: { eval: { first: PRF_SALT } },
      },
    },
  });

  const prfResult = credential.getClientExtensionResults()?.prf;
  if (!prfResult?.results?.first) {
    throw new Error('PRF_NOT_SUPPORTED');
  }

  const prfBytes = new Uint8Array(prfResult.results.first);
  const aesKey = await prfToAesKey(prfBytes, ['encrypt']);

  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const plaintext = new TextEncoder().encode(JSON.stringify(jwk));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

  return {
    credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Authenticate with an existing passkey and decrypt the ECDH private key.
 * @param {string|null} credentialIdB64 — if provided, limits to this credential
 */
export async function authenticatePasskeyAndDecryptKey(encryptedPrivateKey, ivB64, credentialIdB64) {
  const allowCredentials = [];
  if (credentialIdB64) {
    allowCredentials.push({
      id: Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0)),
      type: 'public-key',
      transports: ['internal', 'hybrid'],
    });
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: PRF_SALT } },
      },
    },
  });

  const prfResult = assertion.getClientExtensionResults()?.prf;
  if (!prfResult?.results?.first) {
    throw new Error('PRF_NOT_SUPPORTED');
  }

  const prfBytes = new Uint8Array(prfResult.results.first);
  const aesKey = await prfToAesKey(prfBytes, ['decrypt']);

  const cipherBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
  const jwk = JSON.parse(new TextDecoder().decode(plainBuffer));

  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}

/* ─── Auto-sync trasparente via Twitch OAuth ───────────────────────────────
 *
 * Meccanismo: il server genera un salt casuale per-utente (legato all'user_id Twitch,
 * stabile tra login). Il client ottiene il salt, deriva una chiave AES via PBKDF2
 * (userId + salt) e cifra/decifra la chiave privata ECDH localmente.
 *
 * Sicurezza: il server conosce il salt e l'userId → potrebbe ricostruire la chiave
 * AES in teoria. Tuttavia, poiché il server valida già i token OAuth e non è
 * zero-knowledge, questo è un trade-off accettabile per un'UX trasparente.
 * Il backup manuale (password/passkey) rimane disponibile per chi vuole garanzie
 * più forti.
 * ─────────────────────────────────────────────────────────────────────────── */

const AUTO_SYNC_DOMAIN = 'ANDRYXify-auto-sync-v1';

/** Deriva una chiave AES-GCM-256 dall'userId Twitch + il salt fornito dal server */
async function deriveAutoSyncKey(twitchUserId, saltB64, usage) {
  // Valida il salt prima di decodificare per prevenire eccezioni atob()
  if (typeof saltB64 !== 'string' || saltB64.length === 0) {
    throw new Error('Salt non valido per il backup automatico.');
  }
  let saltBytes;
  try {
    saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  } catch {
    throw new Error('Salt non è un Base64 valido.');
  }
  if (saltBytes.length < 16) {
    throw new Error('Salt troppo corto per essere sicuro.');
  }
  const rawMaterial = new TextEncoder().encode(`${twitchUserId}:${AUTO_SYNC_DOMAIN}`);
  const keyMaterial = await crypto.subtle.importKey('raw', rawMaterial, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 400_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Crea un backup automatico della chiave privata ECDH sul server,
 * cifrato con una chiave derivata dall'identità Twitch.
 * Viene chiamato silenziosamente in background — nessuna interazione utente.
 *
 * @param {CryptoKey} privateKey  — chiave privata ECDH da cifrare
 * @param {string}    twitchUserId — user_id numerico stabile di Twitch
 * @param {string}    twitchToken  — Bearer token per autenticarsi all'API
 * @param {string}    publicKeyString — chiave pubblica JWK (opzionale, per re-sync)
 */
export async function createAutoSyncBackup(privateKey, twitchUserId, twitchToken, publicKeyString = null) {
  if (!twitchUserId) return; // senza userId non possiamo creare il backup

  const MAX_TENTATIVI = 3;
  for (let attempt = 0; attempt < MAX_TENTATIVI; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }

      // 1. Ottieni (o crea) il salt per-utente dal server
      const saltRes = await fetch(`${API_URL}?action=get_sync_secret`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!saltRes.ok) throw new Error(`get_sync_secret: ${saltRes.status}`);
      const { salt } = await saltRes.json();
      if (!salt) throw new Error('Salt mancante nella risposta');

      // 2. Cifra la chiave privata localmente con AES-GCM
      const aesKey = await deriveAutoSyncKey(twitchUserId, salt, ['encrypt']);
      const jwk = await crypto.subtle.exportKey('jwk', privateKey);
      const plaintext = new TextEncoder().encode(JSON.stringify(jwk));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

      // 3. Invia il backup cifrato al server (non contiene la chiave di cifratura)
      const body = {
        action: 'save_auto_backup',
        encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...iv)),
      };
      if (publicKeyString) body.publicKey = publicKeyString;

      const saveRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify(body),
      });
      if (!saveRes.ok) throw new Error(`save_auto_backup: ${saveRes.status}`);
      return; // successo
    } catch (e) {
      if (attempt < MAX_TENTATIVI - 1) {
        console.warn(`Auto-sync backup tentativo ${attempt + 1}/${MAX_TENTATIVI} fallito:`, e);
      } else {
        console.warn('Auto-sync backup fallito dopo', MAX_TENTATIVI, 'tentativi:', e);
      }
    }
  }
}

/**
 * Ripristina la chiave privata ECDH dall'auto-sync backup in modo trasparente.
 * Se il backup non esiste o c'è un errore, restituisce null (il caller gestisce il fallback).
 *
 * @param {string} twitchUserId — user_id numerico stabile di Twitch
 * @param {string} twitchToken  — Bearer token
 * @returns {CryptoKey|null}
 */
export async function restoreFromAutoSync(twitchUserId, twitchToken) {
  if (!twitchUserId) return null;
  try {
    // 1. Recupera il salt per-utente
    const saltRes = await fetch(`${API_URL}?action=get_sync_secret`, {
      headers: { Authorization: `Bearer ${twitchToken}` },
    });
    if (!saltRes.ok) return null;
    const { salt } = await saltRes.json();
    if (!salt) return null;

    // 2. Recupera il backup cifrato
    const backupRes = await fetch(`${API_URL}?action=get_auto_backup`, {
      headers: { Authorization: `Bearer ${twitchToken}` },
    });
    if (!backupRes.ok) return null;
    const { encryptedPrivateKey, iv } = await backupRes.json();
    if (!encryptedPrivateKey || !iv) return null;

    // 3. Decifra localmente
    const aesKey = await deriveAutoSyncKey(twitchUserId, salt, ['decrypt']);
    const cipherBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
    const jwk = JSON.parse(new TextDecoder().decode(plainBuffer));
    // Importa la chiave privata
    return crypto.subtle.importKey(
      'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
    );
  } catch (e) {
    console.warn('Auto-sync restore fallito (non bloccante):', e);
    return null;
  }
}
