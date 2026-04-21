import { Link } from 'react-router-dom';
import { Twitch, Youtube, Instagram, Mic } from 'lucide-react';
import TikTokIcon from './TikTokIcon';
import DiscordIcon from './DiscordIcon';
import { useLingua } from '../contexts/LinguaContext';

const LOGO_URL = '/Firma_Andryx.png';

const socials = [
  { href: 'https://twitch.tv/andryxify',       icon: <Twitch    size={18}/>, label: 'Twitch',    color: '#9146FF' },
  { href: 'https://youtube.com/@ANDRYXify',    icon: <Youtube   size={18}/>, label: 'YouTube',   color: '#FF0000' },
  { href: 'https://instagram.com/andryxify',   icon: <Instagram size={18}/>, label: 'Instagram', color: '#E1306C' },
  { href: 'https://tiktok.com/@andryxify',     icon: <TikTokIcon size={18}/>, label: 'TikTok',  color: '#00F2FE' },
  { href: 'https://open.spotify.com/show/1wtbUNmK9cWJXum02QsxW9', icon: <Mic size={18}/>, label: 'Podcast', color: '#1DB954' },
  { href: 'https://discord.gg/BuckKZ4',        icon: <DiscordIcon size={18}/>, label: 'Discord', color: '#5865F2' },
];

export default function Footer() {
  const { t } = useLingua();
  return (
    <footer className="footer glass-panel" style={{ margin: '2rem auto 2rem', maxWidth: '860px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem' }}>
        {/* Brand */}
        <Link to="/" aria-label={t('nav.aria.logo')} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <img src={LOGO_URL} alt="ANDRYXify" className="footer-logo-img" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, letterSpacing: '0.2px' }}>
            {t('footer.tagline')}
          </p>
        </Link>

        {/* Social links */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {socials.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost footer-social-btn"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                color: s.color,
                borderColor: `${s.color}25`,
                background: `linear-gradient(160deg, ${s.color}12 0%, ${s.color}06 100%)`,
              }}
            >
              {s.icon} {s.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-faint)' }}>
          &copy; {new Date().getFullYear()} ANDRYXify. {t('footer.copyright')}
        </span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-faint)' }}>
          · andryxify.it
        </span>
      </div>
    </footer>
  );
}
