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
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function deriveKey(privateKey, publicKey) {
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
