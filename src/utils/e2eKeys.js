/**
 * Utilità crittografiche E2E — ANDRYXify v3
 *
 * Gestione chiavi:
 *   IndexedDB (DB: andryx_e2e_v3):
 *     privateKey:<user>        → CryptoKey (ECDH privata, estrattibile)
 *     publicKeyString:<user>   → string (JWK chiave pubblica)
 *     syncEphemeral:<sessId>   → { privateKey: CryptoKey, publicKeyJwk: string }
 *
 * Server (via API):
 *     userkeys:<user>          → JWK chiave pubblica
 *     e2e_passkey:<user>       → { credentialId, encryptedPrivateKey, iv, publicKey }
 *
 * Protocollo di sincronizzazione multi-dispositivo:
 *   1. Initiator (dispositivo con chiavi) genera coppia efimera ECDH
 *   2. Server crea sessione con codice 6 cifre e TTL 5 min
 *   3. Joiner (nuovo dispositivo) si unisce con la propria coppia efimera
 *   4. Initiator cifra la chiave privata identity con il segreto ECDH condiviso
 *   5. Joiner decifra e salva la chiave in IDB
 */

const API_URL  = '/api/messages';
const DB_NAME  = 'andryx_e2e_v3';
const DB_STORE = 'keys';

const PRF_SALT = new TextEncoder().encode('ANDRYXify-e2e-v3');

/* ─── IndexedDB ─── */

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function getFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function setInIDB(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function deleteFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/* ─── Generazione coppia di chiavi ─── */

export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function exportPublicKey(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString) {
  if (!jwkString) throw new Error('Chiave pubblica mancante o non valida.');
  let jwk;
  if (typeof jwkString === 'string') {
    try { jwk = JSON.parse(jwkString); }
    catch { throw new Error('Chiave pubblica non è un JSON valido.'); }
  } else if (typeof jwkString === 'object' && jwkString !== null) {
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

/* ─── Derivazione chiave AES-GCM da ECDH ─── */

export async function deriveKey(privateKey, publicKey) {
  if (!privateKey) throw new Error('Chiave privata non disponibile.');
  if (!publicKey)  throw new Error('Chiave pubblica del destinatario non disponibile.');
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ─── Cifratura/decifratura messaggi ─── */

export async function encryptMessage(aesKey, plaintext) {
  const iv       = crypto.getRandomValues(new Uint8Array(12));
  const encoded  = new TextEncoder().encode(plaintext);
  const cipher   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(aesKey, encrypted, iv) {
  const cipherBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBytes     = Uint8Array.from(atob(iv),        c => c.charCodeAt(0));
  const plain       = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
  return new TextDecoder().decode(plain);
}

export async function encryptBytes(aesKey, buffer) {
  const iv     = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, buffer);
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptBytes(aesKey, data, iv) {
  const cipherBytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const ivBytes     = Uint8Array.from(atob(iv),   c => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
}

/* ─── Passkey (WebAuthn PRF) ─── */

/** Controlla se WebAuthn con PRF è disponibile sul dispositivo */
export async function isPasskeyPRFAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return true;
  } catch { return false; }
}

/** Importa i byte PRF come chiave AES-GCM via HKDF */
async function prfToAesKey(prfOutput, usage) {
  const keyMaterial = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: PRF_SALT, info: new TextEncoder().encode('e2e-identity-v3') },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Crea una passkey WebAuthn con estensione PRF e cifra la chiave privata ECDH.
 * Ritorna { credentialId, encryptedPrivateKey, iv } per il backup server.
 * Lancia 'PRF_NOT_SUPPORTED' se il browser non supporta l'estensione PRF.
 */
export async function createPasskeyAndEncryptKey(username, privateKey) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = new TextEncoder().encode(username.slice(0, 64));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'ANDRYXify', id: window.location.hostname },
      user: { id: userId, name: username, displayName: username },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256 fallback
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey:      'preferred',
      },
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  });

  const prfResult = credential.getClientExtensionResults()?.prf;
  if (!prfResult?.results?.first) throw new Error('PRF_NOT_SUPPORTED');

  const prfBytes = new Uint8Array(prfResult.results.first);
  const aesKey   = await prfToAesKey(prfBytes, ['encrypt']);
  const jwk      = await crypto.subtle.exportKey('jwk', privateKey);
  const plain    = new TextEncoder().encode(JSON.stringify(jwk));
  const iv       = crypto.getRandomValues(new Uint8Array(12));
  const cipher   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain);

  return {
    credentialId:       btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv:                 btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Autentica con passkey WebAuthn PRF e decifra la chiave privata ECDH.
 * @param {string} encryptedPrivateKey — base64
 * @param {string} ivB64 — base64
 * @param {string|null} credentialIdB64 — base64 (opzionale, filtra la credential)
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
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  });

  const prfResult = assertion.getClientExtensionResults()?.prf;
  if (!prfResult?.results?.first) throw new Error('PRF_NOT_SUPPORTED');

  const prfBytes    = new Uint8Array(prfResult.results.first);
  const aesKey      = await prfToAesKey(prfBytes, ['decrypt']);
  const cipherBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
  const iv          = Uint8Array.from(atob(ivB64),               c => c.charCodeAt(0));
  const plain       = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
  const jwk         = JSON.parse(new TextDecoder().decode(plain));

  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}

/* ─── Sync multi-dispositivo (ECDH efimero) ─── */

/**
 * Genera e salva in IDB una coppia ECDH efimera per una sessione di sync.
 * @returns {{ privateKey: CryptoKey, publicKeyJwk: string }}
 */
export async function createSyncEphemeralPair(sessionId) {
  const kp  = await generateKeyPair();
  const jwk = await exportPublicKey(kp.publicKey);
  await setInIDB(`syncEphemeral:${sessionId}`, { privateKey: kp.privateKey, publicKeyJwk: jwk });
  return { privateKey: kp.privateKey, publicKeyJwk: jwk };
}

/** Recupera la coppia efimera salvata in IDB */
export async function getSyncEphemeralPair(sessionId) {
  return getFromIDB(`syncEphemeral:${sessionId}`);
}

/** Elimina la coppia efimera (dopo il sync completato) */
export async function deleteSyncEphemeralPair(sessionId) {
  return deleteFromIDB(`syncEphemeral:${sessionId}`);
}

/**
 * Cifra la chiave privata identity per sync.
 * @param {CryptoKey} initiatorEphemeralPrivKey — chiave efimera PRIVATA dell'initiator
 * @param {CryptoKey} identityPrivKey — chiave identity da trasferire
 * @param {string} joinerEphemeralPubJwk — chiave efimera PUBBLICA del joiner (JWK)
 */
export async function encryptIdentityKeyForSync(initiatorEphemeralPrivKey, identityPrivKey, joinerEphemeralPubJwk) {
  const joinerPub = await importPublicKey(joinerEphemeralPubJwk);
  const sharedAes = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: joinerPub },
    initiatorEphemeralPrivKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const jwk   = await crypto.subtle.exportKey('jwk', identityPrivKey);
  const plain = new TextEncoder().encode(JSON.stringify(jwk));
  const iv    = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedAes, plain);
  return {
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decifra la chiave privata identity ricevuta dal server durante il sync.
 * @param {string} encryptedKey — base64
 * @param {string} ivB64 — base64
 * @param {CryptoKey} joinerEphemeralPrivKey — chiave efimera PRIVATA del joiner
 * @param {string} initiatorEphemeralPubJwk — chiave efimera PUBBLICA dell'initiator (JWK)
 */
export async function decryptIdentityKeyFromSync(encryptedKey, ivB64, joinerEphemeralPrivKey, initiatorEphemeralPubJwk) {
  const initiatorPub = await importPublicKey(initiatorEphemeralPubJwk);
  const sharedAes    = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: initiatorPub },
    joinerEphemeralPrivKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const cipherBytes = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const iv          = Uint8Array.from(atob(ivB64),        c => c.charCodeAt(0));
  const plain       = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedAes, cipherBytes);
  const jwk         = JSON.parse(new TextDecoder().decode(plain));
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}

/* ─── Gestione chiavi identity utente ─── */

/**
 * Verifica se l'utente ha chiavi locali in IDB.
 * @returns {CryptoKey|null}
 */
export async function getLocalPrivateKey(username) {
  return getFromIDB(`privateKey:${username}`);
}

/** Salva la coppia di chiavi in IDB e registra la pubblica sul server */
export async function saveAndRegisterKeyPair(username, token, privateKey, publicKeyString) {
  await Promise.all([
    setInIDB(`privateKey:${username}`, privateKey),
    setInIDB(`publicKeyString:${username}`, publicKeyString),
  ]);
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'register_key', publicKey: publicKeyString }),
  });
}

/**
 * Genera nuove chiavi identity, le salva in IDB e registra la pubblica sul server.
 * @returns {{ privateKey: CryptoKey, publicKeyString: string }}
 */
export async function generateAndRegisterNewKeys(username, token) {
  const kp             = await generateKeyPair();
  const publicKeyString = await exportPublicKey(kp.publicKey);
  await saveAndRegisterKeyPair(username, token, kp.privateKey, publicKeyString);
  return { privateKey: kp.privateKey, publicKeyString };
}

/**
 * Elimina le chiavi locali dell'utente da IDB.
 * Usato durante il reset o il logout.
 */
export async function deleteLocalKeys(username) {
  await Promise.all([
    deleteFromIDB(`privateKey:${username}`).catch(() => {}),
    deleteFromIDB(`publicKeyString:${username}`).catch(() => {}),
  ]);
}

/* ─── Backup file cifrato con password (PBKDF2 + AES-GCM) ─── */

/**
 * Esporta la chiave privata identity cifrandola con una password via PBKDF2.
 * Ritorna una stringa JSON pronta per il download come file .json.
 * Compatibile con qualsiasi cloud (iCloud Drive, Google Drive, ecc.).
 */
export async function exportKeyToEncryptedFile(privateKey, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const jwk    = await crypto.subtle.exportKey('jwk', privateKey);
  const plain  = new TextEncoder().encode(JSON.stringify(jwk));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain);
  return JSON.stringify({
    v:         1,
    salt:      btoa(String.fromCharCode(...salt)),
    iv:        btoa(String.fromCharCode(...iv)),
    encrypted: btoa(String.fromCharCode(...new Uint8Array(cipher))),
  });
}

/**
 * Importa e decifra una chiave privata da un file di backup.
 * Lancia un errore leggibile se la password è errata o il file è corrotto.
 */
export async function importKeyFromEncryptedFile(fileContent, password) {
  let parsed;
  try { parsed = JSON.parse(fileContent); } catch { throw new Error('File backup non valido.'); }
  const { v, salt, iv, encrypted } = parsed;
  if (v !== 1 || !salt || !iv || !encrypted) throw new Error('Formato backup non riconosciuto.');
  const saltBytes   = Uint8Array.from(atob(salt),      c => c.charCodeAt(0));
  const ivBytes     = Uint8Array.from(atob(iv),        c => c.charCodeAt(0));
  const cipherBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, cipherBytes);
  } catch {
    throw new Error('Password errata o file corrotto.');
  }
  const jwk = JSON.parse(new TextDecoder().decode(plain));
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}
