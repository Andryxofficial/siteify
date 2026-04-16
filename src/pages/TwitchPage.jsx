import { motion } from 'framer-motion';
import { Twitch, ExternalLink, Calendar, Users, Star } from 'lucide-react';

const twitchStats = [
  { icon: <Users size={18} color="#9146FF" />, label: 'Community attiva' },
  { icon: <Star  size={18} color="#FFD700" />, label: 'Contenuti originali' },
  { icon: <Calendar size={18} color="#00f5d4" />, label: 'Live regolari' },
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

        {/* Twitch brand stats bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {twitchStats.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {s.icon}
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
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

      {/* Channel panel */}
      <motion.div
        className="glass-panel"
        style={{
          padding: '0',
          overflow: 'hidden',
          background: 'linear-gradient(135deg,rgba(145,70,255,.15),rgba(145,70,255,.04))',
          border: '1px solid rgba(145,70,255,.3)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Twitch-purple banner */}
        <div style={{
          height: 8,
          background: 'linear-gradient(90deg,#9146FF,#c800ff,#9146FF)',
          backgroundSize: '200% 100%',
          animation: 'twitch-shimmer 3s linear infinite',
        }} />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <Twitch size={28} color="#9146FF" />
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#9146FF' }}>
              andryxify su Twitch
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '560px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Seguimi su Twitch per non perderti nessuna diretta. Attiva le notifiche e unisciti alla community!
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.a
              href="https://twitch.tv/andryxify"
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{
                background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                color: '#fff',
                boxShadow: '0 5px 20px rgba(145,70,255,.4)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Twitch size={16} /> Segui su Twitch
            </motion.a>
            <motion.a
              href="https://x.la/@andryxify"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ gap: '8px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ExternalLink size={16} />
              Donazioni su x.la
            </motion.a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
