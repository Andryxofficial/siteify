/**
 * MessagesPage — E2E encrypted messaging.
 *
 * Route: /messaggi (hidden — not in navbar)
 * Crypto: ECDH P-256 key exchange + AES-GCM-256 (keys in IndexedDB, public keys in Redis)
 * Features: send/edit/delete text, send images & videos (E2E encrypted), fast polling
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Send, ArrowLeft, MessageSquare, Users, Twitch, LogIn,
  Loader, Shield, Clock, AlertTriangle, Pencil, Trash2, X,
  Image as ImageIcon, Video, Check,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';
import {
  ensureE2EKeysRegistered,
  importPublicKey,
  deriveKey,
  encryptMessage,
  decryptMessage,
  encryptBytes,
  decryptBytes,
} from '../utils/e2eKeys';

const API_URL = '/api/messages';
const POLL_ACTIVE = 1500;          // ms when tab is focused
const POLL_HIDDEN = 6000;          // ms when tab is hidden
const MAX_FILE_BYTES = 8_000_000;  // 8MB original file limit
const LONG_PRESS_DURATION = 450;   // ms for mobile long-press context menu
// Max base64-encoded encrypted blob accepted by the server (~1.1MB → ~800KB decoded)
const MAX_MEDIA_B64 = 1_100_000;

/** Ensure a blob URL is actually a blob: URL before putting it in the DOM */
function safeBlobUrl(url) {
  return typeof url === 'string' && url.startsWith('blob:') ? url : '';
}

/* ─── Image compression via canvas ─── */
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
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Impossibile comprimere l\'immagine. Prova con un formato diverso.')),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossibile caricare l\'immagine. Il file potrebbe essere corrotto o in un formato non supportato.')); };
    img.src = url;
  });
}

/* ─── Helpers ─── */
const entrata = (d = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: d, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoMsg(ts) {
  const d = new Date(Number(ts));
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/* ─── useE2EKeys hook ─── */
function useE2EKeys(twitchUser, twitchToken) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const privateKeyRef = useRef(null);

  useEffect(() => {
    if (!twitchUser || !twitchToken) return;
    let cancelled = false;
    (async () => {
      try {
        const privateKey = await ensureE2EKeysRegistered(twitchUser, twitchToken);
        if (!cancelled) {
          privateKeyRef.current = privateKey;
          setReady(true);
        }
      } catch (e) {
        console.error('E2E key setup error:', e);
        if (!cancelled) setError('Impossibile inizializzare la crittografia. Svuota la cache del browser e riprova.');
      }
    })();
    return () => { cancelled = true; };
  }, [twitchUser, twitchToken]);

  return { ready, error, privateKeyRef };
}

/* ─── MediaBubble — decrypt + render image/video ─── */
function MediaBubble({ mediaId, mediaIv, mimeType, name, aesKey, twitchToken }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?action=media&id=${encodeURIComponent(mediaId)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        const buffer = await decryptBytes(aesKey, data.data, mediaIv);
        const blob = new Blob([buffer], { type: mimeType || data.mimeType || 'application/octet-stream' });
        url = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(url);
      } catch (e) {
        console.warn('Media fetch/decrypt error:', e);
        if (!cancelled) setErr(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaId, mediaIv, mimeType, aesKey, twitchToken]);

  if (loading) {
    return (
      <div style={{ padding: '0.5rem', color: 'var(--text-faint)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Loader size={14} className="spin" /> Caricamento media…
      </div>
    );
  }
  if (err || !blobUrl) {
    return <div style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>🔒 [Media non disponibile]</div>;
  }

  const isVideo = mimeType && mimeType.startsWith('video/');
  const safeUrl = safeBlobUrl(blobUrl);
  if (isVideo) {
    return (
      <video
        src={safeUrl}
        controls
        style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', display: 'block' }}
      />
    );
  }
  return (
    <img
      src={safeUrl}
      alt={name || 'immagine'}
      style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', display: 'block', cursor: 'zoom-in' }}
      onClick={() => window.open(safeUrl, '_blank')}
    />
  );
}

/* ─── ConversationsList ─── */
function ConversationsList({ conversations, onSelect }) {
  if (conversations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</p>
        <p style={{ fontSize: '0.9rem' }}>Nessuna conversazione ancora.</p>
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
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={10} /> {tempoMsg(c.lastMessageAt)}
            </div>
          </div>
          <MessageSquare size={16} color="var(--text-faint)" />
        </motion.button>
      ))}
    </div>
  );
}

/* ─── ChatView ─── */
function ChatView({ withUser, twitchUser, twitchToken, privateKeyRef, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aesKey, setAesKey] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Context menu
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Media upload
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); // { file, objectUrl, isVideo }
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const lastPollTimeRef = useRef(Date.now());
  const pollRef = useRef(null);
  const inputRef = useRef(null);
  const longPressRef = useRef(null);

  // ── Derive shared AES key ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?action=key&user=${encodeURIComponent(withUser)}`);
        const data = await res.json();
        if (!data.publicKey) {
          setError(`${withUser} non ha ancora effettuato il login. Chiedigli di accedere al sito con Twitch.`);
          setLoading(false);
          return;
        }
        const theirPub = await importPublicKey(data.publicKey);
        const key = await deriveKey(privateKeyRef.current, theirPub);
        if (!cancelled) setAesKey(key);
      } catch (e) {
        console.error('Key derivation error:', e);
        if (!cancelled) setError('Impossibile derivare la chiave di crittografia.');
      }
    })();
    return () => { cancelled = true; };
  }, [withUser, privateKeyRef]);

  // ── Decrypt helper (text or media payload) ──
  const decryptMsg = useCallback(async (msg, key) => {
    if (msg.deleted) return { ...msg, text: null, media: undefined };
    try {
      const text = await decryptMessage(key, msg.encrypted, msg.iv);
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'media') return { ...msg, text: null, media: parsed };
      } catch { /* plain text */ }
      return { ...msg, text };
    } catch {
      return { ...msg, text: '🔒 [Impossibile decifrare]' };
    }
  }, []);

  // ── Load history ──
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
        const decrypted = await Promise.all((data.messages || []).map(m => decryptMsg(m, aesKey)));
        setMessages(decrypted);
        if (decrypted.length > 0) lastMsgIdRef.current = decrypted[decrypted.length - 1].id;
        lastPollTimeRef.current = Date.now();
      } catch {
        if (!cancelled) setError('Errore nel caricamento dei messaggi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [aesKey, withUser, twitchToken, decryptMsg]);

  // ── Polling ──
  useEffect(() => {
    if (!aesKey || !twitchToken) return;

    const poll = async () => {
      try {
        const afterParam = lastMsgIdRef.current ? `&after=${lastMsgIdRef.current}` : '';
        const sinceParam = `&since=${lastPollTimeRef.current}`;
        const res = await fetch(
          `${API_URL}?action=poll&with=${encodeURIComponent(withUser)}${afterParam}${sinceParam}`,
          { headers: { Authorization: `Bearer ${twitchToken}` } },
        );
        const data = await res.json();
        lastPollTimeRef.current = Date.now();

        if (data.messages && data.messages.length > 0) {
          const decrypted = await Promise.all(data.messages.map(m => decryptMsg(m, aesKey)));
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = decrypted.filter(m => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
          lastMsgIdRef.current = decrypted[decrypted.length - 1].id;
        }

        if (data.changed && data.changed.length > 0) {
          const changedMap = new Map();
          for (const m of data.changed) {
            changedMap.set(m.id, await decryptMsg(m, aesKey));
          }
          setMessages(prev => prev.map(m => changedMap.has(m.id) ? changedMap.get(m.id) : m));
        }
      } catch (e) { console.warn('Poll error:', e); }
    };

    const getInterval = () => document.hidden ? POLL_HIDDEN : POLL_ACTIVE;
    pollRef.current = setInterval(poll, getInterval());
    const onVis = () => { clearInterval(pollRef.current); pollRef.current = setInterval(poll, getInterval()); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(pollRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [aesKey, withUser, twitchToken, decryptMsg]);

  // ── Auto-scroll ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Close context menu on outside click ──
  useEffect(() => {
    if (!menuMsgId) return;
    const close = (e) => {
      if (!e.target.closest('[data-msg-menu]')) {
        setMenuMsgId(null);
        setConfirmDelete(null);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuMsgId]);

  /* ── Send text ── */
  const sendMessage = async (e) => {
    e?.preventDefault();
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
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Errore');
      setMessages(prev => [...prev, { id: d.message.id, from: twitchUser, to: withUser, text, createdAt: d.message.createdAt }]);
      lastMsgIdRef.current = d.message.id;
      setInput('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 4000);
    } finally {
      setSending(false);
    }
  };

  /* ── Edit ── */
  const startEdit = (msg) => {
    setMenuMsgId(null);
    setEditingId(msg.id);
    setEditText(msg.text || '');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const submitEdit = async (e) => {
    e?.preventDefault();
    const text = editText.trim();
    if (!text || !aesKey) return;
    setSending(true);
    try {
      const { encrypted, iv } = await encryptMessage(aesKey, text);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'edit', msgId: editingId, convoWith: withUser, encrypted, iv }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Errore');
      setMessages(prev => prev.map(m => m.id === editingId ? { ...m, text, editedAt: Date.now() } : m));
      cancelEdit();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 4000);
    } finally {
      setSending(false);
    }
  };

  /* ── Delete ── */
  const deleteMessage = async (msgId) => {
    setMenuMsgId(null);
    setConfirmDelete(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'delete', msgId, convoWith: withUser }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Errore');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, text: null, media: undefined } : m));
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  /* ── Media file select ── */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('File troppo grande (max 8MB).');
      setTimeout(() => setError(''), 4000);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      setError('Formato non supportato. Usa immagini o video.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    setMediaPreview({ file, objectUrl: URL.createObjectURL(file), isVideo });
  };

  const cancelMedia = () => {
    if (mediaPreview?.objectUrl) URL.revokeObjectURL(mediaPreview.objectUrl);
    setMediaPreview(null);
  };

  /* ── Send media ── */
  const sendMedia = async () => {
    if (!mediaPreview || !aesKey || mediaUploading) return;
    setMediaUploading(true);
    try {
      let { file } = mediaPreview;
      if (!mediaPreview.isVideo) {
        try { const c = await compressImage(file); if (c) file = c; } catch (e) { console.warn('Image compression failed, using original:', e); }
      }
      const buffer = await file.arrayBuffer();
      const { data: encData, iv: mediaIv } = await encryptBytes(aesKey, buffer);

      if (encData.length > MAX_MEDIA_B64) {
        throw new Error('File troppo grande dopo la codifica (max ~800KB compressi). Riduci le dimensioni.');
      }

      const uploadRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'upload_media', to: withUser, data: encData, mimeType: file.type, name: mediaPreview.file.name }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Errore upload');

      const payload = { type: 'media', mediaId: uploadData.mediaId, mimeType: file.type, name: mediaPreview.file.name, iv: mediaIv };
      const { encrypted, iv } = await encryptMessage(aesKey, JSON.stringify(payload));
      const sendRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'send', to: withUser, encrypted, iv }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Errore invio');

      setMessages(prev => [...prev, { id: sendData.message.id, from: twitchUser, to: withUser, text: null, media: payload, createdAt: sendData.message.createdAt }]);
      lastMsgIdRef.current = sendData.message.id;
      cancelMedia();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setMediaUploading(false);
    }
  };

  /* ── Long-press for mobile context menu ── */
  const onMsgPointerDown = (msgId) => {
    longPressRef.current = setTimeout(() => setMenuMsgId(msgId), LONG_PRESS_DURATION);
  };
  const onMsgPointerUp = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
        <button className="mod-icon-btn" onClick={onBack}><ArrowLeft size={16} /></button>
        <Twitch size={16} color="#9146FF" />
        <span style={{ fontWeight: 600, flex: 1 }}>{withUser}</span>
        <span className="chip" style={{ fontSize: '0.68rem', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Lock size={10} /> E2E
        </span>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <AlertTriangle size={13} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="messages-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader size={20} className="spin" /> Caricamento…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Shield size={24} style={{ marginBottom: '0.5rem' }} /><br />
            <span style={{ fontSize: '0.85rem' }}>Conversazione crittografata end-to-end.</span><br />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Solo tu e {withUser} potete leggere questi messaggi.</span>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.from === twitchUser;
            const isMenuOpen = menuMsgId === msg.id;
            return (
              <div
                key={msg.id}
                className="msg-wrapper"
                style={{ position: 'relative', alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}
              >
                {/* Context menu (own, non-deleted) */}
                <AnimatePresence>
                  {isMenuOpen && !msg.deleted && isMine && (
                    <motion.div
                      data-msg-menu
                      initial={{ opacity: 0, scale: 0.9, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onPointerDown={e => e.stopPropagation()}
                      style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 10, background: 'rgba(14,18,34,0.96)', backdropFilter: 'blur(24px)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '4px', minWidth: '130px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    >
                      {msg.text && (
                        <button className="mod-item" onClick={() => startEdit(msg)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '7px', fontSize: '0.82rem', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)', width: '100%', textAlign: 'left' }}>
                          <Pencil size={13} /> Modifica
                        </button>
                      )}
                      {confirmDelete === msg.id ? (
                        <button className="mod-item" onClick={() => deleteMessage(msg.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '7px', fontSize: '0.82rem', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#f87171', width: '100%', textAlign: 'left' }}>
                          <Check size={13} /> Conferma eliminazione
                        </button>
                      ) : (
                        <button className="mod-item" onClick={() => setConfirmDelete(msg.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '7px', fontSize: '0.82rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#f87171', width: '100%', textAlign: 'left' }}>
                          <Trash2 size={13} /> Elimina
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Desktop hover actions */}
                {isMine && !msg.deleted && (
                  <div className="msg-hover-actions" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 'calc(100% + 4px)', display: 'flex', gap: '2px' }}>
                    {msg.text && (
                      <button className="mod-icon-btn" title="Modifica" style={{ padding: '4px', borderRadius: '6px' }} onClick={() => startEdit(msg)}>
                        <Pencil size={11} />
                      </button>
                    )}
                    <button className="mod-icon-btn" title="Elimina" style={{ padding: '4px', borderRadius: '6px', color: '#f87171' }}
                      onClick={() => { setMenuMsgId(msg.id); setConfirmDelete(msg.id); }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}`}
                  onPointerDown={() => isMine && !msg.deleted && onMsgPointerDown(msg.id)}
                  onPointerUp={onMsgPointerUp}
                  onPointerLeave={onMsgPointerUp}
                  style={{ cursor: isMine && !msg.deleted ? 'pointer' : 'default', userSelect: 'none' }}
                >
                  {msg.deleted ? (
                    <p className="msg-text" style={{ fontStyle: 'italic', opacity: 0.5, fontSize: '0.8rem' }}>🗑 Messaggio eliminato</p>
                  ) : msg.media ? (
                    <MediaBubble
                      mediaId={msg.media.mediaId}
                      mediaIv={msg.media.iv}
                      mimeType={msg.media.mimeType}
                      name={msg.media.name}
                      aesKey={aesKey}
                      twitchToken={twitchToken}
                    />
                  ) : (
                    <p className="msg-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</p>
                  )}
                  <span className="msg-time">
                    {tempoMsg(msg.createdAt)}
                    {msg.editedAt && <span style={{ marginLeft: '0.3rem', opacity: 0.6 }}>· mod.</span>}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Media preview strip */}
      <AnimatePresence>
        {mediaPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--glass-border)', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}
          >
            {mediaPreview.isVideo
              ? <video src={safeBlobUrl(mediaPreview.objectUrl)} style={{ height: '56px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
              : <img src={safeBlobUrl(mediaPreview.objectUrl)} alt="preview" style={{ height: '56px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
            }
            <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mediaPreview.file.name}
            </span>
            {mediaUploading ? (
              <Loader size={16} className="spin" style={{ flexShrink: 0 }} />
            ) : (
              <>
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', flexShrink: 0 }} onClick={sendMedia}>
                  <Send size={12} />
                </button>
                <button className="mod-icon-btn" style={{ flexShrink: 0 }} onClick={cancelMedia}><X size={14} /></button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form
        onSubmit={editingId ? submitEdit : sendMessage}
        style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 0', borderTop: '1px solid var(--glass-border)', flexShrink: 0, alignItems: 'flex-end' }}
      >
        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button type="button" className="mod-icon-btn" title="Invia foto o video" style={{ flexShrink: 0, marginBottom: '1px' }}
          onClick={() => fileInputRef.current?.click()} disabled={!aesKey || mediaUploading || !!editingId}>
          <ImageIcon size={16} />
        </button>

        <div style={{ flex: 1 }}>
          {editingId && (
            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Pencil size={10} /> Modifica messaggio
              <button type="button" onClick={cancelEdit}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0 }}>
                <X size={11} />
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={editingId ? editText : input}
            onChange={e => editingId ? setEditText(e.target.value) : setInput(e.target.value)}
            placeholder={editingId ? 'Modifica il messaggio…' : 'Scrivi un messaggio…'}
            className="mod-input"
            style={{ width: '100%' }}
            maxLength={2000}
            disabled={!aesKey}
          />
        </div>

        <button type="submit" className="btn btn-primary"
          disabled={!(editingId ? editText.trim() : input.trim()) || sending || !aesKey || mediaUploading}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', flexShrink: 0 }}>
          {sending ? <Loader size={14} className="spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
}

/* ─── Main page ─── */
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
      const res = await fetch(`${API_URL}?action=conversations`, { headers: { Authorization: `Bearer ${twitchToken}` } });
      if (res.ok) { const d = await res.json(); setConversations(d.conversations || []); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [twitchToken]);

  useEffect(() => { if (isLoggedIn && ready) loadConversations(); }, [isLoggedIn, ready, loadConversations]);

  const selectChat = (user) => { setActiveChat(user); setSearchParams({ con: user }, { replace: true }); };
  const goBack = () => { setActiveChat(null); setSearchParams({}, { replace: true }); loadConversations(); };

  if (!isLoggedIn) {
    return (
      <div className="main-content">
        <SEO title="Messaggi — ANDRYXify" description="Messaggi crittografati end-to-end su ANDRYXify" path="/messaggi" />
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
      <SEO title="Messaggi — ANDRYXify" description="Messaggi crittografati end-to-end su ANDRYXify" path="/messaggi" />

      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <Lock size={24} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span className="text-gradient">Messaggi</span>
        </motion.h1>
        <motion.p className="subtitle" {...entrata(0.1)}>Conversazioni private crittografate end-to-end.</motion.p>
      </section>

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
        <motion.div className="glass-panel" style={{ padding: '1rem', minHeight: '460px' }} {...entrata(0.15)}>
          <AnimatePresence mode="wait">
            {activeChat ? (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ height: '100%' }}>
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
                  <ConversationsList conversations={conversations} onSelect={selectChat} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
