import { motion } from 'framer-motion';
import { Twitch, ExternalLink } from 'lucide-react';

const features = [
  { emoji: '🎮', title: 'Variety Gaming', color: '#9146FF', desc: 'Dagli sparatutto adrenalinici ai capolavori indie. Gioco di tutto esplorando storie e meccaniche uniche, senza mai annoiarmi su un solo titolo.' },
  { emoji: '🎙️', title: 'Just Chatting & Tech', color: '#00f5d4', desc: 'Non solo gameplay: ci prendiamo il tempo per chiacchierare, analizzare l\'IA, commentare news tech e filosofeggiare sul futuro.' },
  { emoji: '🤖', title: 'Esperimenti IA Live', color: '#FF00D4', desc: 'Demo in diretta di strumenti di intelligenza artificiale, prompt engineering e scoperte tech commentate in tempo reale con la community.' },
  { emoji: '💬', title: 'Community First', color: '#FFD700', desc: 'Il chat è il cuore della live. Ogni domanda, battuta e idea della community plasmano lo show. Non sei spettatore, sei protagonista.' },
];

export default function TwitchPage() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
      style={{ maxWidth: '1100px' }}
    >
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title">
          <span style={{ color: '#9146FF' }}>Twitch</span> Experience
        </h1>
        <p className="subtitle">Segui le dirette, interagisci in chat e scopri i momenti migliori.</p>
      </header>

      {/* Player + Chat */}
      <div className="twitch-container glass-panel" style={{ padding: 0 }}>
        <div className="player-side">
          <iframe
            src={`https://player.twitch.tv/?channel=andryxify&parent=${window.location.hostname}`}
            height="100%"
            width="100%"
            allowFullScreen
            style={{ border: 'none', display: 'block', minHeight: 350 }}
          />
        </div>
        <div className="chat-side">
          <div style={{
            background: 'rgba(145,70,255,.12)',
            padding: '8px 14px',
            fontSize: '0.82rem',
            color: '#c9b8ff',
            borderBottom: '1px solid rgba(145,70,255,.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Twitch size={14} />
            Chat in diretta — scrivi qui o usa il tasto <strong>Accedi</strong> in alto
          </div>
          <iframe
            src={`https://www.twitch.tv/embed/andryxify/chat?parent=${window.location.hostname}&darkpopout`}
            height="100%"
            width="100%"
            style={{ flex: 1, border: 'none', display: 'block' }}
          />
        </div>
      </div>

      {/* What to expect */}
      <div>
        <h2 className="section-title">Cosa aspettarti 🎯</h2>
        <div className="links-grid">
          {features.map(f => (
            <motion.div
              key={f.title}
              className="glass-card link-item"
              style={{
                padding: '1.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'flex-start',
                background: `linear-gradient(135deg, ${f.color}18, ${f.color}06)`,
              }}
              whileHover={{ scale: 1.02 }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem' }}>{f.emoji}</span>
                <h3 style={{ color: f.color, margin: 0, fontSize: '1rem', fontWeight: 800 }}>{f.title}</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <span style={{ color: '#00f5d4' }}>💖</span> Supporta il Canale
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '560px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
          La tua partecipazione è il supporto più grande. Se desideri contribuire al progetto, puoi farlo qui!
        </p>
        <motion.a
          href="https://x.la/@andryxify"
          target="_blank"
          rel="noreferrer"
          className="btn"
          style={{
            background: 'linear-gradient(135deg,rgba(255,105,180,.25),rgba(255,105,180,.1))',
            border: '1px solid rgba(255,105,180,.4)',
            color: '#ff69b4',
            gap: '8px',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ExternalLink size={16} />
          Donazioni su x.la
        </motion.a>
      </div>
    </motion.div>
  );
}
