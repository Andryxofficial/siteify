/**
 * MessagesPage — E2E encrypted messaging.
 *
 * Route: /messaggi (hidden — not in navbar)
 * Uses Web Crypto API for ECDH key exchange + AES-GCM encryption.
 * Server stores only encrypted blobs — zero knowledge.
 *
 * Flow:
 *   1. On first use, generate ECDH key pair → store private in IndexedDB, public in Redis
 *   2. To send: derive shared secret (my private + their public) → AES-GCM encrypt → POST
 *   3. To read: derive shared secret (my private + their public) → AES-GCM decrypt
 *   4. Poll every 3s for new messages
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Send, ArrowLeft, MessageSquare, Users, Twitch, LogIn,
  Loader, Shield, Clock, AlertTriangle,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const API_URL = '/api/messages';
const POLL_INTERVAL = 3000;
const DB_NAME = 'andryx_e2e';
const DB_STORE = 'keys';

/* ═══════════════════════════════════════
   CRYPTO UTILS — Web Crypto API
   ═══════════════════════════════════════ */

/** Open IndexedDB for key storage */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (event) => event.target.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setInIDB(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Generate ECDH key pair */
async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey']
  );
}

/** Export public key to JWK JSON string */
async function exportPublicKey(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

/** Import public key from JWK JSON string */
async function importPublicKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/** Derive AES-GCM key from ECDH shared secret */
async function deriveKey(privateKey, publicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a string → { encrypted: base64, iv: base64 } */
async function encryptMessage(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/** Decrypt { encrypted: base64, iv: base64 } → string */
async function decryptMessage(aesKey, encrypted, iv) {
  const cipherBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuffer);
}

/* ═══════════════════════════════════════
   KEY MANAGEMENT HOOK
   ═══════════════════════════════════════ */
function useE2EKeys(twitchUser, twitchToken) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const privateKeyRef = useRef(null);

  useEffect(() => {
    if (!twitchUser || !twitchToken) return;

    (async () => {
      try {
        // Check if we have a stored key pair
        let privateKey = await getFromIDB(`privateKey:${twitchUser}`);
        let needsRegistration = !privateKey;

        if (!privateKey) {
          // Generate new key pair
          const keyPair = await generateKeyPair();
          privateKey = keyPair.privateKey;

          // Register public key on server first — if this fails, don't store locally
          const pubKeyStr = await exportPublicKey(keyPair.publicKey);
          const regRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
            body: JSON.stringify({ action: 'register_key', publicKey: pubKeyStr }),
          });
          if (!regRes.ok) throw new Error('Registrazione chiave pubblica fallita');

          // Only store private key after successful server registration
          await setInIDB(`privateKey:${twitchUser}`, privateKey);
          needsRegistration = false;
        }

        // If we have a local key but server might not have it (e.g. prior failure),
        // try to re-register — best effort
        if (!needsRegistration) {
          try {
            const checkRes = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(twitchUser)}`);
            const checkData = await checkRes.json();
            if (!checkData.publicKey) {
              // Re-export and register
              const pubKey = await getFromIDB(`publicKey:${twitchUser}`);
              if (pubKey) {
                await fetch(API_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
                  body: JSON.stringify({ action: 'register_key', publicKey: pubKey }),
                });
              }
            }
          } catch { /* best effort sync */ }
        }

        privateKeyRef.current = privateKey;
        setReady(true);
      } catch (e) {
        console.error('E2E key setup error:', e);
        setError('Impossibile inizializzare la crittografia. Prova a svuotare la cache del browser.');
      }
    })();
  }, [twitchUser, twitchToken]);

  return { ready, error, privateKeyRef };
}

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */
const entrata = (ritardo = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoMsg(ts) {
  const d = new Date(Number(ts));
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════
   CONVERSATIONS LIST
   ═══════════════════════════════════════ */
function ConversationsList({ conversations, onSelect }) {
  if (conversations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</p>
        <p style={{ fontSize: '0.9rem' }}>Nessuna conversazione. Aggiungi un amico e inizia a chattare!</p>
        <Link to="/amici" className="btn btn-ghost" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
          <Users size={14} /> Vai agli amici
        </Link>
      </div>
    );
  }

  return (
    <div className="mod-list">
      {conversations.map(c => (
        <motion.button
          key={c.user}
          className="mod-item glass-card"
          onClick={() => onSelect(c.user)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'inherit' }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Twitch size={16} color="#9146FF" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{c.user}</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
              <Clock size={10} /> {tempoMsg(c.lastMessageAt)}
            </div>
          </div>
          <MessageSquare size={16} color="var(--text-faint)" />
        </motion.button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   CHAT VIEW
   ═══════════════════════════════════════ */
function ChatView({ withUser, twitchUser, twitchToken, privateKeyRef, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aesKey, setAesKey] = useState(null);
  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const pollRef = useRef(null);

  // Derive shared AES key
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(withUser)}`);
        const data = await res.json();
        if (!data.publicKey) {
          setError('L\'utente non ha ancora configurato la crittografia. Chiedigli di visitare /messaggi.');
          setLoading(false);
          return;
        }
        const theirPublicKey = await importPublicKey(data.publicKey);
        const key = await deriveKey(privateKeyRef.current, theirPublicKey);
        if (!cancelled) setAesKey(key);
      } catch (e) {
        console.error('Key derivation error:', e);
        if (!cancelled) setError('Impossibile derivare la chiave di crittografia.');
      }
    })();
    return () => { cancelled = true; };
  }, [withUser, privateKeyRef]);

  // Load message history
  useEffect(() => {
    if (!aesKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}?action=history&with=${encodeURIComponent(withUser)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        const data = await res.json();
        if (cancelled) return;

        const decrypted = [];
        for (const msg of (data.messages || [])) {
          try {
            const text = await decryptMessage(aesKey, msg.encrypted, msg.iv);
            decrypted.push({ ...msg, text });
          } catch {
            decrypted.push({ ...msg, text: '🔒 [Impossibile decifrare]' });
          }
        }
        setMessages(decrypted);
        if (decrypted.length > 0) lastMsgIdRef.current = decrypted[decrypted.length - 1].id;
      } catch {
        if (!cancelled) setError('Errore nel caricamento dei messaggi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [aesKey, withUser, twitchToken]);

  // Polling for new messages
  useEffect(() => {
    if (!aesKey || !twitchToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const afterParam = lastMsgIdRef.current ? `&after=${lastMsgIdRef.current}` : '';
        const res = await fetch(
          `${API_URL}?action=poll&with=${encodeURIComponent(withUser)}${afterParam}`,
          { headers: { Authorization: `Bearer ${twitchToken}` } }
        );
        const data = await res.json();
        if (data.messages?.length > 0) {
          const decrypted = [];
          for (const msg of data.messages) {
            try {
              const text = await decryptMessage(aesKey, msg.encrypted, msg.iv);
              decrypted.push({ ...msg, text });
            } catch {
              decrypted.push({ ...msg, text: '🔒 [Impossibile decifrare]' });
            }
          }
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = decrypted.filter(m => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
          lastMsgIdRef.current = decrypted[decrypted.length - 1].id;
        }
      } catch { /* silent poll failure */ }
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [aesKey, withUser, twitchToken]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !aesKey || sending) return;
    setSending(true);
    try {
      const { encrypted, iv } = await encryptMessage(aesKey, text);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'send', to: withUser, encrypted, iv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');

      const newMsg = { id: data.message.id, from: twitchUser, to: withUser, text, createdAt: data.message.createdAt };
      setMessages(prev => [...prev, newMsg]);
      lastMsgIdRef.current = data.message.id;
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <button className="mod-icon-btn" onClick={onBack}><ArrowLeft size={16} /></button>
        <Twitch size={16} color="#9146FF" />
        <span style={{ fontWeight: 600, flex: 1 }}>{withUser}</span>
        <span className="chip" style={{ fontSize: '0.68rem', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Lock size={10} /> E2E
        </span>
      </div>

      {/* Messages area */}
      <div className="messages-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader size={20} className="spin" /> Caricamento messaggi…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--accent)', fontSize: '0.85rem' }}>
            <AlertTriangle size={20} style={{ marginBottom: '0.5rem' }} /><br />
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Shield size={24} style={{ marginBottom: '0.5rem' }} /><br />
            <span style={{ fontSize: '0.85rem' }}>Conversazione crittografata end-to-end.</span><br />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>I messaggi sono visibili solo a te e {withUser}.</span>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`msg-bubble ${msg.from === twitchUser ? 'msg-mine' : 'msg-theirs'}`}
            >
              <p className="msg-text">{msg.text}</p>
              <span className="msg-time">{tempoMsg(msg.createdAt)}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!error && (
        <form onSubmit={sendMessage}
          style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 0', borderTop: '1px solid var(--glass-border)' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Scrivi un messaggio…"
            className="mod-input"
            style={{ flex: 1 }}
            maxLength={2000}
            disabled={!aesKey}
          />
          <button type="submit" className="btn btn-primary"
            disabled={!input.trim() || sending || !aesKey}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
            {sending ? <Loader size={14} className="spin" /> : <Send size={14} />}
          </button>
        </form>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function MessagesPage() {
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();
  const { ready, error: keyError, privateKeyRef } = useE2EKeys(twitchUser, twitchToken);
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(searchParams.get('con') || null);

  const loadConversations = useCallback(async () => {
    if (!twitchToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=conversations`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [twitchToken]);

  useEffect(() => { if (isLoggedIn && ready) loadConversations(); }, [isLoggedIn, ready, loadConversations]);

  const selectChat = (user) => {
    setActiveChat(user);
    setSearchParams({ con: user }, { replace: true });
  };

  const goBack = () => {
    setActiveChat(null);
    setSearchParams({}, { replace: true });
    loadConversations();
  };

  /* ── Not logged in ── */
  if (!isLoggedIn) {
    return (
      <div className="main-content">
        <SEO title="Messaggi — SOCIALify" description="Messaggi crittografati end-to-end su ANDRYXify" path="/messaggi" />
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginTop: '1rem' }} {...entrata(0.1)}>
          <Lock size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Messaggi Crittografati</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Accedi con Twitch per inviare messaggi privati crittografati end-to-end.
          </p>
          {clientId && (
            <a href={getTwitchLoginUrl('/messaggi')} className="btn social-btn-twitch">
              <LogIn size={14} /> Accedi con Twitch
            </a>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <SEO title="Messaggi — SOCIALify" description="Messaggi crittografati end-to-end su ANDRYXify" path="/messaggi" />

      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <Lock size={24} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span className="text-gradient">Messaggi</span>
        </motion.h1>
        <motion.p className="subtitle" {...entrata(0.1)}>
          Conversazioni private crittografate end-to-end.
        </motion.p>
      </section>

      {/* E2E status badge */}
      <motion.div {...entrata(0.12)} style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
        <span className="chip" style={{
          fontSize: '0.72rem',
          background: ready ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
          color: ready ? '#22c55e' : '#fbbf24',
          border: `1px solid ${ready ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`,
        }}>
          <Shield size={11} />
          {keyError ? 'Errore crittografia' : ready ? 'Crittografia E2E attiva' : 'Inizializzazione chiavi…'}
        </span>
      </motion.div>

      {keyError ? (
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent)' }} {...entrata(0.15)}>
          <AlertTriangle size={24} style={{ marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.85rem' }}>{keyError}</p>
        </motion.div>
      ) : (
        <motion.div className="glass-panel" style={{ padding: '1rem', minHeight: '450px' }} {...entrata(0.15)}>
          <AnimatePresence mode="wait">
            {activeChat ? (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                style={{ height: '100%' }}>
                <ChatView
                  withUser={activeChat}
                  twitchUser={twitchUser}
                  twitchToken={twitchToken}
                  privateKeyRef={privateKeyRef}
                  onBack={goBack}
                />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <Loader size={20} className="spin" /> Caricamento conversazioni…
                  </div>
                ) : (
                  <ConversationsList
                    conversations={conversations}
                    onSelect={selectChat}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
