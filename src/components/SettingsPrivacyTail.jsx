import { ShieldCheck, LockKeyhole, MessageCircle, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function SettingsPrivacyTail() {
  const location = useLocation();
  if (!location.pathname.startsWith('/impostazioni')) return null;

  return (
    <div
      className="main-content"
      aria-label="Privacy e sicurezza"
      style={{ paddingTop: 0, paddingBottom: 'calc(var(--native-bottom-nav-h, 74px) + env(safe-area-inset-bottom, 0px) + 2.5rem)' }}
    >
      <section
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.05rem 1.15rem',
          marginTop: '-0.75rem',
          marginBottom: '1rem',
          borderRadius: '22px',
          border: '1px solid color-mix(in srgb, var(--primary) 28%, var(--vetro-bordo-colore))',
          background: 'radial-gradient(circle at 8% 10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.32)',
            flex: '0 0 auto',
          }}
        >
          <ShieldCheck size={24} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', lineHeight: 1.25 }}>
            Visualizza informazioni privacy e sicurezza
          </h3>
          <p style={{ margin: '0 0 0.65rem', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.45 }}>
            Informativa completa su Ikigai, dati, notifiche, chat private, cifratura e cancellazione.
          </p>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }} aria-hidden="true">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--primary)', padding: '0.28rem 0.55rem', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
              <LockKeyhole size={13} /> Dati e cifratura
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--primary)', padding: '0.28rem 0.55rem', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
              <MessageCircle size={13} /> Chat private
            </span>
          </div>
        </div>

        <Link
          to="/privacy"
          aria-label="Apri informazioni privacy e sicurezza"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: '0.86rem',
            padding: '0.55rem 0.72rem',
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            flex: '0 0 auto',
          }}
        >
          Apri <ChevronRight size={16} />
        </Link>
      </section>
    </div>
  );
}
