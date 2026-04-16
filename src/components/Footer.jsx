import { Link } from 'react-router-dom';
import { Twitch, Youtube, Instagram, Mic } from 'lucide-react';
import TikTokIcon from './TikTokIcon';

const LOGO_URL = 'https://github.com/user-attachments/assets/473c6ca9-3173-4fdf-958c-faa4bda57230';

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
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <img
            src={LOGO_URL}
            alt="Andryx"
            style={{ height: '30px', width: 'auto', filter: 'invert(1) hue-rotate(180deg)', mixBlendMode: 'screen' }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
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

      <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '1.5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
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
