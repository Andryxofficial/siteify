/**
 * ChatGeneralePage — Chat generale della community ANDRYXify
 *
 * Route: /chat
 * Due tab: "Chat Twitch" (iframe embed) e "Chat Sito" (chat nativa con polling Redis)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Twitch, Users, LogIn } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import SEO from '../components/SEO';

const CHAT_API = '/api/chat';
const POLL_MS = 2000;

const entrata = (ritardo = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function tempoFa(ts) {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore}h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 30) return `${giorni}g fa`;
  return `${Math.floor(giorni / 30)} mesi fa`;
}

export default function ChatGeneralePage() {
  const { isLoggedIn, twitchToken, getTwitchLoginUrl } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);

  const [tab, setTab] = useState('twitch'); // twitch | sito
  const tabBarRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

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
    if (!text.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ action: 'send', text: text.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore nell\'invio.');
        return;
      }

      setText('');
      // Aggiunge il messaggio subito evitando duplicati dal polling
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [data.message, ...prev];
      });
    } catch {
      setError('Errore di rete.');
    } finally {
      setSending(false);
    }
  };

  const tabs = [
    { id: 'twitch', label: 'Chat Twitch', icon: Twitch },
    { id: 'sito', label: 'Chat Sito', icon: Users },
  ];

  return (
    <div className="main-content" style={{ paddingTop: '1.5rem' }}>
      <SEO
        title="Chat"
        description="Chat generale della community ANDRYXify — Twitch chat e chat sito."
        path="/chat"
      />

      <motion.h1
        {...entrata(0)}
        style={{ textAlign: 'center', marginBottom: '1.2rem', fontSize: '1.8rem' }}
      >
        <MessageCircle size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Chat Generale
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
            title="Chat Twitch ANDRYXify"
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
                Effettua il login con Twitch per partecipare alla chat del sito.
              </p>
              <a href={getTwitchLoginUrl('/chat')} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Twitch size={18} />
                Accedi con Twitch
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
                    Nessun messaggio ancora. Scrivi il primo!
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
                          {tempoFa(msg.createdAt)}
                        </span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', wordBreak: 'break-word' }}>
                        {renderTestoConEmote(msg.text)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input invio */}
              <form
                onSubmit={handleSend}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.8rem 1rem',
                  borderTop: '1px solid rgba(130,170,240,0.1)',
                  alignItems: 'center',
                }}
              >
                <EmotePicker
                  emoteCanale={emoteCanale}
                  emoteGlobali={emoteGlobali}
                  onSelect={(nome) => setText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + nome + ' ')}
                  disabled={sending}
                />
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Scrivi un messaggio..."
                  maxLength={500}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(130,170,240,0.14)',
                    borderRadius: 12,
                    padding: '0.6rem 0.9rem',
                    color: 'inherit',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.7rem', opacity: 0.4, whiteSpace: 'nowrap' }}>
                  {text.length}/500
                </span>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!text.trim() || sending}
                  style={{ padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Send size={16} />
                </button>
              </form>

              {error && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', padding: '0 1rem 0.5rem', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
