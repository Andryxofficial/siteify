import { motion } from 'framer-motion';
import { Instagram, ExternalLink } from 'lucide-react';
import SEO from '../components/SEO';

export default function InstagramPage() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
    >
      <SEO
        title="Instagram — Dietro le Quinte & Aggiornamenti"
        description="Segui ANDRYXify (Andrea Taliento) su Instagram: dietro le quinte delle live, storie quotidiane e aggiornamenti dal mondo gaming e IA."
        path="/instagram"
      />
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 className="title">
          <span style={{ color: '#E1306C' }}>Instagram</span> Feed
        </h1>
        <p className="subtitle">Dietro le quinte, storie quotidiane e istanti catturati.</p>
      </header>

      {/* Profile card */}
      <motion.div
        className="glass-panel"
        style={{ padding: 0, overflow: 'hidden' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Gradient banner */}
        <div style={{
          height: 120,
          background: 'linear-gradient(135deg,#f09433 0%,#e6683c 20%,#dc2743 40%,#cc2366 70%,#bc1888 100%)',
          position: 'relative',
        }} />

        <div style={{
          padding: '0 2rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginTop: -50,
        }}>
          <div style={{
            width: 96, height: 96,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            padding: 3,
            position: 'relative',
            zIndex: 2,
            marginBottom: '1rem',
          }}>
            <img
              src="/logo.png"
              alt="andryxify"
              style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#111', objectFit: 'contain', padding: 8 }}
            />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.2rem' }}>@andryxify</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: 420, lineHeight: 1.6 }}>
            Dietro le quinte delle live, pillole di IA, gaming moments e contenuti esclusivi. Seguimi per non perderti nulla!
          </p>
          <motion.a
            href="https://instagram.com/andryxify"
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{
              background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)',
              color: '#fff',
              boxShadow: '0 5px 20px rgba(225,48,108,.3)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Instagram size={18} /> Segui su Instagram
          </motion.a>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        className="glass-panel"
        style={{ textAlign: 'center', padding: '2rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
          Le Stories di Instagram sono il posto migliore per seguire i miei aggiornamenti quotidiani in tempo reale.
        </p>
        <motion.a
          href="https://instagram.com/stories/andryxify"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
          whileHover={{ scale: 1.04 }}
        >
          <ExternalLink size={16} /> Apri le Stories
        </motion.a>
      </motion.div>
    </motion.div>
  );
}
