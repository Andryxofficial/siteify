import { ShieldCheck, LockKeyhole, MessageCircle, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function SettingsPrivacyTail() {
  const location = useLocation();
  if (!location.pathname.startsWith('/impostazioni')) return null;

  return (
    <div className="main-content settings-privacy-tail-wrap" aria-label="Privacy e sicurezza">
      <section className="glass-panel settings-privacy-tail">
        <div className="settings-privacy-tail-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <div className="settings-privacy-tail-copy">
          <h3>Visualizza informazioni privacy e sicurezza</h3>
          <p>
            Informativa completa su Ikigai, dati, notifiche, chat private, cifratura e cancellazione.
          </p>
          <div className="settings-privacy-tail-pills" aria-hidden="true">
            <span><LockKeyhole size={13} /> Dati e cifratura</span>
            <span><MessageCircle size={13} /> Chat private</span>
          </div>
        </div>
        <Link to="/privacy" className="settings-privacy-tail-link" aria-label="Apri informazioni privacy e sicurezza">
          Apri <ChevronRight size={16} />
        </Link>
      </section>
    </div>
  );
}
