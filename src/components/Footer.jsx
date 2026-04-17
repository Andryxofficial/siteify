import { Link } from 'react-router-dom';
import { Twitch, Youtube, Instagram, Mic } from 'lucide-react';
import TikTokIcon from './TikTokIcon';

const socials = [
  { href: 'https://twitch.tv/andryxify',       icon: <Twitch    size={18}/>, label: 'Twitch'    },
  { href: 'https://youtube.com/@ANDRYXify',    icon: <Youtube   size={18}/>, label: 'YouTube'   },
  { href: 'https://instagram.com/andryxify',   icon: <Instagram size={18}/>, label: 'Instagram' },
  { href: 'https://tiktok.com/@andryxify',     icon: <TikTokIcon size={18}/>, label: 'TikTok'  },
  { href: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9', icon: <Mic size={18}/>, label: 'Podcast' },
];

export default function Footer() {
  return (
    <footer className="footer glass-panel" style={{ margin: '2rem auto 2rem', maxWidth: '860px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        {/* Brand */}
        <Link to="/" aria-label="ANDRYXify – Home" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <img src="/firma_andryx.png" alt="ANDRYXify" className="footer-logo-img" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, letterSpacing: '0.2px' }}>
            Esplorando Umanità, IA & Gaming.
          </p>
        </Link>

        {/* Social links */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {socials.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
            >
              {s.icon} {s.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid rgba(130,170,240,0.08)', marginTop: '1.5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
          &copy; {new Date().getFullYear()} ANDRYXify. Fatto con ♥ per il futuro.
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
          andryxify.it
        </span>
      </div>
    </footer>
  );
}
