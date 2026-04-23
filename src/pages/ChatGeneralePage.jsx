/**
 * ChatGeneralePage — Chat generale della community ANDRYXify
 *
 * Route: /chat
 * Due tab: "Chat Twitch" (iframe embed) e "Chat Sito" (chat nativa con polling Redis)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Twitch, Users, LogIn, Lock, Paperclip, X } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import SEO from '../components/SEO';
import MessagesPage from './MessagesPage';
import { useLingua } from '../contexts/LinguaContext';
import { preparaMediaPerUpload, MEDIA_ACCETTATI } from '../utils/compressioneMedia';

const CHAT_API = '/api/chat';
const POLL_MS = 2000;

const entrata = (ritardo = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoFa(ts, lingua = 'it') {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (lingua === 'en') {
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const ore = Math.floor(min / 60);
    if (ore < 24) return `${ore}h ago`;
    const giorni = Math.floor(ore / 24);
    if (giorni < 30) return `${giorni}d ago`;
    return `${Math.floor(giorni / 30)} months ago`;
  }
  if (lingua === 'es') {
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const ore = Math.floor(min / 60);
    if (ore < 24) return `hace ${ore}h`;
    const giorni = Math.floor(ore / 24);
    if (giorni < 30) return `hace ${giorni}d`;
    return `hace ${Math.floor(giorni / 30)} meses`;
  }
  // it (default)
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore}h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 30) return `${giorni}g fa`;
  return `${Math.floor(giorni / 30)} mesi fa`;
}


/* ── Componente visualizzazione media messaggio chat ── */
function ChatMediaDisplay({ mediaId, mediaType }) {
  const [src, setSrc]     = useState(null);
  const [mime, setMime]   = useState('');
  const [caric, setCaric] = useState(true);
  const [err, setErr]     = useState(false);

  useEffect(() => {
    if (!mediaId) return;
    let annullato = false;
    (async () => {
      try {
        const res  = await fetch(`/api/chat?action=media&id=${encodeURIComponent(mediaId)}`);
        if (!res.ok) throw new Error();
        const dati = await res.json();
        if (annullato) return;
        const blob = await fetch(`data:${dati.mimeType};base64,${dati.data}`).then(r => r.blob());
        setSrc(URL.createObjectURL(blob));
        setMime(dati.mimeType || '');
      } catch { if (!annullato) setErr(true); }
      finally  { if (!annullato) setCaric(false); }
    })();
    return () => { annullato = true; };
  }, [mediaId]);

  if (!mediaId) return null;
  if (caric) return <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>⏳ Media…</span>;
  if (err)   return null;

  const tipo = mediaType || (mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'video');

  if (tipo === 'image') return (
    <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, marginTop: 4, display: 'block' }} />
  );
  if (tipo === 'audio') return (
    <audio src={src} controls preload="metadata" style={{ marginTop: 4, width: '100%', maxWidth: 280 }} />
  );
  return (
    <video src={src} controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 4, display: 'block' }} />
  );
}

export default function ChatGeneralePage() {
  const { isLoggedIn, twitchToken, getTwitchLoginUrl } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);
  const { t, lingua } = useLingua();

  const [tab, setTab] = useState('twitch'); // twitch | sito
  const tabBarRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const [mediaFile, setMediaFile]           = useState(null);
  const [mediaPreview, setMediaPreview]     = useState(null);
  const [mediaType, setMediaType]           = useState('');
  const [caricandoMedia, setCaricandoMedia] = useState(false);
  const fileInputChatRef = useRef(null);

  useEffect(() => {
    return () => { if (mediaPreview) URL.revokeObjectURL(mediaPreview); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recupera messaggi dal server
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${CHAT_API}?action=messages&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const newMsgs = data.messages || [];
          // Merge evitando duplicati (mantiene messaggi ottimistici)
          const ids = new Set(newMsgs.map((m) => m.id));
          const optimistic = prev.filter((m) => !ids.has(m.id));
          return [...optimistic, ...newMsgs];
        });
      }
    } catch { /* silenzioso */ }
  }, []);

  // Polling attivo solo nella tab "Chat Sito"
  useEffect(() => {
    if (tab !== 'sito') return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [tab, fetchMessages]);

  // Auto-scroll solo se l'utente è già vicino al fondo
  // Usa scrollTop diretto sul container (column-reverse: 0 = fondo) per evitare
  // che scrollIntoView faccia scorrere l'intera pagina su mobile
  const chatContainerRef = useRef(null);
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    // column-reverse: scrollTop 0 = fondo; valori negativi = scrollato verso l'alto
    const isNearBottom = Math.abs(container.scrollTop) < 80;
    if (isNearBottom) {
      container.scrollTop = 0;
    }
  }, [messages]);

  // Quando si cambia tab, riporta la pagina sul tab switcher
  // così l'utente può continuare a scegliere la tab senza essere "spinto" in basso
  useEffect(() => {
    tabBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [tab]);

  // Invio messaggio
  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !mediaFile) || sending) return;

    setSending(true);
    setError('');

    try {
      const payload = { action: 'send', text: text.trim() };

      // Upload media allegato se presente
      if (mediaFile) {
        setCaricandoMedia(true);
        const preparato = await preparaMediaPerUpload(mediaFile);
        const uploadRes = await fetch(CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
          body: JSON.stringify({ action: 'upload_media', ...preparato }),
        });
        setCaricandoMedia(false);
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Errore upload media');
        payload.mediaId   = uploadData.mediaId;
        payload.mediaType = preparato.mediaType;
      }

      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('chat.errore.invio'));
        return;
      }

      setText('');
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType('');
      // Aggiunge il messaggio subito evitando duplicati dal polling
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [data.message, ...prev];
      });
    } catch {
      setError(t('chat.errore.rete'));
    } finally {
      setCaricandoMedia(false);
      setSending(false);
    }
  };

  const tabs = [
    { id: 'twitch', label: t('chat.tab.twitch'), icon: Twitch },
    { id: 'sito', label: t('chat.tab.sito'), icon: Users },
    { id: 'privati', label: t('chat.tab.privati'), icon: Lock },
  ];

  return (
    <div className="main-content" style={{ paddingTop: '1.5rem' }}>
      <SEO
        title="Chat"
        description={t('chat.seo.desc')}
        path="/chat"
      />

      <motion.h1
        {...entrata(0)}
        style={{ textAlign: 'center', marginBottom: '1.2rem', fontSize: '1.8rem' }}
      >
        <MessageCircle size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        {t('chat.titolo')}
      </motion.h1>

      {/* Tab switcher */}
      <motion.div
        {...entrata(0.05)}
        ref={tabBarRef}
        className="glass-panel"
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem',
          marginBottom: '1rem',
          justifyContent: 'center',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* Tab: Chat Twitch */}
      {tab === 'twitch' && (
        <motion.div {...entrata(0.1)} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            src={`https://www.twitch.tv/embed/andryxify/chat?parent=${window.location.hostname}&darkpopout`}
            title={t('chat.twitch.iframe.title')}
            style={{
              width: '100%',
              height: 'min(600px, 80vh)',
              border: 'none',
              display: 'block',
              borderRadius: 'inherit',
            }}
            allowFullScreen
          />
        </motion.div>
      )}

      {/* Tab: Chat Sito */}
      {tab === 'sito' && (
        <motion.div {...entrata(0.1)}>
          {!isLoggedIn ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <LogIn size={40} style={{ marginBottom: '1rem', opacity: 0.6 }} />
              <p style={{ marginBottom: '1rem', opacity: 0.8 }}>
                {t('chat.login.prompt')}
              </p>
              <a href={getTwitchLoginUrl('/chat')} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Twitch size={18} />
                {t('chat.login.cta')}
              </a>
            </div>
          ) : (
            <div className="glass-panel chat-sito-panel">
              {/* Lista messaggi */}
                <div ref={chatContainerRef}
                  style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  gap: '0.6rem',
                }}
              >
                {messages.length === 0 && (
                  <p style={{ textAlign: 'center', opacity: 0.5, margin: 'auto' }}>
                    {t('chat.vuoto')}
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    {msg.authorAvatar ? (
                      <img
                        src={msg.authorAvatar}
                        alt={msg.author}
                        style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {msg.authorDisplay || msg.author}
                        </span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                          {tempoFa(msg.createdAt, lingua)}
                        </span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', wordBreak: 'break-word' }}>
                        {renderTestoConEmote(msg.text)}
                      </p>
                      {msg.mediaId && (
                        <ChatMediaDisplay mediaId={msg.mediaId} mediaType={msg.mediaType} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input invio */}
              <div style={{ borderTop: '1px solid rgba(130,170,240,0.1)', padding: '0.8rem 1rem', flexShrink: 0, position: 'relative', zIndex: 5, background: 'rgba(0,0,0,0.18)', paddingBottom: 'max(0.8rem, env(safe-area-inset-bottom, 0.8rem))' }}>
                {/* Anteprima media selezionato */}
                {mediaFile && mediaPreview && (
                  <div style={{ marginBottom: '0.5rem', position: 'relative', display: 'inline-flex', alignItems: 'flex-start' }}>
                    {mediaType === 'image' && (
                      <img src={mediaPreview} alt="" style={{ maxHeight: 100, maxWidth: 160, borderRadius: 6, display: 'block' }} />
                    )}
                    {mediaType === 'audio' && (
                      <audio src={mediaPreview} controls preload="metadata" style={{ width: 240 }} />
                    )}
                    {mediaType === 'video' && (
                      <video src={mediaPreview} controls preload="metadata" style={{ maxHeight: 100, maxWidth: 160, borderRadius: 6 }} />
                    )}
                    <button
                      type="button"
                      onClick={() => { if (mediaPreview) URL.revokeObjectURL(mediaPreview); setMediaFile(null); setMediaPreview(null); setMediaType(''); }}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={handleSend}
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                >
                  <EmotePicker
                    emoteCanale={emoteCanale}
                    emoteGlobali={emoteGlobali}
                    seventvCanale={seventvCanale}
                    seventvGlobali={seventvGlobali}
                    onSelect={(nome) => setText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ')}
                    disabled={sending}
                  />
                  {/* Pulsante allegato media */}
                  <button
                    type="button"
                    onClick={() => fileInputChatRef.current?.click()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: mediaFile ? 'var(--primary)' : 'var(--text-faint)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    title="Allega immagine, audio o video"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    ref={fileInputChatRef}
                    type="file"
                    accept={MEDIA_ACCETTATI}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
                      setMediaFile(file);
                      setMediaPreview(URL.createObjectURL(file));
                      setMediaType(
                        file.type.startsWith('image/') ? 'image' :
                        file.type.startsWith('audio/') ? 'audio' : 'video'
                      );
                      e.target.value = '';
                    }}
                  />
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('chat.placeholder')}
                    maxLength={500}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(130,170,240,0.14)', borderRadius: 12, padding: '0.6rem 0.9rem', color: 'inherit', fontSize: '0.9rem', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.7rem', opacity: 0.4, whiteSpace: 'nowrap' }}>
                    {text.length}/500
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={(!text.trim() && !mediaFile) || sending || caricandoMedia}
                    style={{ padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {caricandoMedia ? '⏳' : <Send size={16} />}
                  </button>
                </form>
              </div>

              {error && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', padding: '0 1rem 0.5rem', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
      {/* Tab: Messaggi Privati (cifrati end-to-end) */}
      {tab === 'privati' && (
        <motion.div {...entrata(0.1)}>
          <MessagesPage />
        </motion.div>
      )}
    </div>
  );
}
