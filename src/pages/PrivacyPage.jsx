import { ShieldCheck, LockKeyhole, Brain, Trash2, EyeOff, MessageCircle, Bell, Activity } from 'lucide-react';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';
import { privacySecurityText } from '../i18n/privacySecurity';

export default function PrivacyPage() {
  const { lingua } = useLingua();
  const txt = privacySecurityText(lingua);

  return (
    <main className="main-content privacy-page">
      <SEO
        title={txt.seoTitle}
        description={txt.seoDescription}
        canonical="/privacy"
      />

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: 0 }}>
          <ShieldCheck size={30} /> {txt.heroTitle}
        </h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
          {txt.heroText}
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Brain size={22} /> {txt.ikigaiTitle}</h2>
        <p>{txt.ikigaiP1}</p>
        <p>{txt.ikigaiP2}</p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Activity size={22} /> {txt.cognitiveTitle}</h2>
        <p>{txt.cognitiveP1}</p>
        <p style={{ color: 'var(--text-muted)' }}>{txt.cognitiveP2}</p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><MessageCircle size={22} /> {txt.privateChatTitle}</h2>
        <p>{txt.privateChatP1}</p>
        <ul style={{ lineHeight: 1.75 }}>
          <li>{txt.privateChatLi1}</li>
          <li>{txt.privateChatLi2}</li>
          <li>{txt.privateChatLi3}</li>
          <li>{txt.privateChatLi4}</li>
          <li>{txt.privateChatLi5}</li>
        </ul>
        <p style={{ color: 'var(--text-muted)' }}>
          {txt.privateChatNote}
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Bell size={22} /> {txt.notificationsTitle}</h2>
        <p>{txt.notificationsP1}</p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><LockKeyhole size={22} /> {txt.cryptoTitle}</h2>
        <ul style={{ lineHeight: 1.75 }}>
          <li>{txt.cryptoLi1}</li>
          <li>{txt.cryptoLi2}</li>
          <li>{txt.cryptoLi3}</li>
          <li>{txt.cryptoLi4}</li>
          <li>{txt.cryptoLi5}</li>
        </ul>
        <p style={{ color: 'var(--text-muted)' }}>
          {txt.cryptoNote}
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><EyeOff size={22} /> {txt.controlTitle}</h2>
        <p>{txt.controlP1}</p>
        <p>{txt.controlP2}</p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Trash2 size={22} /> {txt.deletionTitle}</h2>
        <p>{txt.deletionP1}</p>
        <p>{txt.deletionP2}</p>
      </section>
    </main>
  );
}
