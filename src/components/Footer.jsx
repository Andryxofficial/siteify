import { Link } from 'react-router-dom';
import { useLingua } from '../contexts/LinguaContext';

const LOGO_URL = '/Firma_Andryx.png';

export default function Footer() {
  const { t } = useLingua();
  return (
    <footer className="footer glass-panel" style={{ margin: '2rem auto 2rem', maxWidth: '860px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        {/* Brand */}
        <Link to="/" aria-label={t('nav.aria.logo')} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <img src={LOGO_URL} alt="ANDRYXify" className="footer-logo-img" width="200" height="44" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, letterSpacing: '0.2px' }}>
            {t('footer.tagline')}
          </p>
        </Link>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '1.25rem', paddingTop: '0.9rem', paddingBottom: '0.3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
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
