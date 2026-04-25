import { ShieldCheck, LockKeyhole, MessageCircle, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLingua } from '../contexts/LinguaContext';
import { privacySecurityText } from '../i18n/privacySecurity';

export default function SettingsPrivacyTail() {
  const location = useLocation();
  const { lingua } = useLingua();
  const txt = privacySecurityText(lingua);
  if (!location.pathname.startsWith('/impostazioni')) return null;

  return (
    <div className="settings-privacy-tail-wrap" aria-label={txt.settingsTitle}>
      <section className="settings-privacy-tail glass-panel">
        <div className="settings-privacy-tail-orb" aria-hidden="true">
          <ShieldCheck size={25} />
        </div>

        <div className="settings-privacy-tail-content">
          <span className="settings-privacy-tail-kicker">Privacy & Security</span>
          <h3>{txt.settingsTitle}</h3>
          <p>{txt.settingsText}</p>
          <div className="settings-privacy-tail-pills" aria-hidden="true">
            <span><LockKeyhole size={13} /> {txt.settingsPillCrypto}</span>
            <span><MessageCircle size={13} /> {txt.settingsPillChat}</span>
          </div>
        </div>

        <Link to="/privacy" className="settings-privacy-tail-cta" aria-label={txt.settingsAria}>
          {txt.settingsOpen} <ChevronRight size={16} />
        </Link>
      </section>
    </div>
  );
}
