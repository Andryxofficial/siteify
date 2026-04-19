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
  if (!jwkString || typeof jwkString !== 'string') {
    throw new Error('Chiave pubblica mancante o non valida.');
  }
  let jwk;
  try { jwk = JSON.parse(jwkString); }
  catch { throw new Error('Chiave pubblica non è un JSON valido.'); }
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
