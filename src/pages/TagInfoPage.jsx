/* ─────────────────────────────────────────────────────────
   TagInfoPage — pagina informativa sul sistema tag smart
   ─────────────────────────────────────────────────────────
   Spiega all'utente come funziona il sistema:
   - Tag liberi (free-form, max 5 per post)
   - Macro-categorie automatiche (clusterizzazione co-occorrenza)
   - Sistema di reward (XP per tag che diventano popolari)
   - Sistema di penalità (anti-spam, anti-scam, profanity)
   - Privacy: tutto avviene server-side, nessun training su LLM esterni
   ───────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tag, Sparkles, TrendingUp, Award, ShieldAlert, Brain, ArrowLeft, Hash, Users, Bookmark } from 'lucide-react';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';

const su = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 26 },
});

export default function TagInfoPage() {
  const { t } = useLingua();

  return (
    <div className="main-content" style={{ paddingTop: '2rem', minHeight: '60vh' }}>
      <SEO
        title="Sistema Tag Smart — SOCIALify"
        description="Come funzionano i tag liberi e le categorie smart automatiche di SOCIALify. Sistema anti-spam, reward per i creatori di tag popolari, privacy-first (zero LLM esterni)."
        path="/socialify/info-tag"
      />

      {/* Back link */}
      <motion.div {...su(0)}>
        <Link to="/socialify" className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <ArrowLeft size={14} /> {t('community.tag.info.indietro')}
        </Link>
      </motion.div>

      {/* Hero */}
      <motion.section
        {...su(0.05)}
        className="glass-panel"
        style={{ padding: '2rem 1.8rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.9rem', background: 'rgba(224,64,251,0.12)', border: '1px solid rgba(224,64,251,0.24)', borderRadius: '999px', fontSize: '0.72rem', color: 'var(--primary)', marginBottom: '1rem', fontWeight: 600 }}>
          <Sparkles size={12} /> {t('community.tag.info.badge')}
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', 'Outfit-fallback', sans-serif", fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 0.6rem', minHeight: 'clamp(1.8rem, 5vw, 2.8rem)' }}>
          {t('community.tag.info.titolo')}
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 580, margin: '0 auto', lineHeight: 1.7, fontSize: '0.98rem' }}>
          {t('community.tag.info.intro')}
        </p>
      </motion.section>

      {/* Come funziona */}
      <motion.section {...su(0.1)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <Hash size={18} color="var(--primary)" /> {t('community.tag.info.come.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          {t('community.tag.info.come.testo')}
        </p>
        <ul className="tag-info-lista">
          <li><strong>{t('community.tag.info.come.regole.lunghezza_titolo')}:</strong> {t('community.tag.info.come.regole.lunghezza')}</li>
          <li><strong>{t('community.tag.info.come.regole.caratteri_titolo')}:</strong> {t('community.tag.info.come.regole.caratteri')}</li>
          <li><strong>{t('community.tag.info.come.regole.massimo_titolo')}:</strong> {t('community.tag.info.come.regole.massimo')}</li>
          <li><strong>{t('community.tag.info.come.regole.normalizzato_titolo')}:</strong> {t('community.tag.info.come.regole.normalizzato')}</li>
        </ul>
      </motion.section>

      {/* Macro-categorie */}
      <motion.section {...su(0.15)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <Brain size={18} color="var(--secondary)" /> {t('community.tag.info.macro.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          {t('community.tag.info.macro.testo1')}
        </p>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem', marginTop: '0.5rem' }}>
          {t('community.tag.info.macro.testo2')}
        </p>

        <div className="tag-info-tecnica">
          <div className="tag-info-tecnica-titolo">
            <Sparkles size={13} /> {t('community.tag.info.macro.dettaglio_titolo')}
          </div>
          <ul className="tag-info-lista" style={{ fontSize: '0.84rem' }}>
            <li>{t('community.tag.info.macro.dettaglio.cooccurrenza')}</li>
            <li>{t('community.tag.info.macro.dettaglio.jaccard')}</li>
            <li>{t('community.tag.info.macro.dettaglio.unionfind')}</li>
            <li>{t('community.tag.info.macro.dettaglio.cache')}</li>
          </ul>
        </div>
      </motion.section>

      {/* Reward */}
      <motion.section {...su(0.2)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <Award size={18} color="var(--accent-warm)" /> {t('community.tag.info.reward.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          {t('community.tag.info.reward.testo')}
        </p>
        <div className="tag-info-milestones">
          <div className="tag-info-milestone">
            <span className="tag-info-milestone-soglia">5 post</span>
            <span className="tag-info-milestone-xp">+15 XP</span>
            <span className="tag-info-milestone-desc">{t('community.tag.info.reward.m1')}</span>
          </div>
          <div className="tag-info-milestone">
            <span className="tag-info-milestone-soglia">25 post</span>
            <span className="tag-info-milestone-xp">+60 XP</span>
            <span className="tag-info-milestone-desc">{t('community.tag.info.reward.m2')}</span>
          </div>
          <div className="tag-info-milestone">
            <span className="tag-info-milestone-soglia">100 post</span>
            <span className="tag-info-milestone-xp">+250 XP</span>
            <span className="tag-info-milestone-desc">{t('community.tag.info.reward.m3')}</span>
          </div>
        </div>
      </motion.section>

      {/* Penalità */}
      <motion.section {...su(0.25)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <ShieldAlert size={18} color="var(--accent)" /> {t('community.tag.info.penalita.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          {t('community.tag.info.penalita.testo')}
        </p>
        <ul className="tag-info-lista">
          <li><strong>Spam / scam:</strong> {t('community.tag.info.penalita.spam')}</li>
          <li><strong>Profanity:</strong> {t('community.tag.info.penalita.profanity')}</li>
          <li><strong>Tag generici:</strong> {t('community.tag.info.penalita.generici')}</li>
          <li><strong>Tag duplicati:</strong> {t('community.tag.info.penalita.duplicati')}</li>
        </ul>
      </motion.section>

      {/* Trending + Following */}
      <motion.section {...su(0.3)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <TrendingUp size={18} color="var(--secondary)" /> {t('community.tag.info.scopri.titolo')}
        </h2>
        <div className="tag-info-griglia">
          <div className="tag-info-card">
            <TrendingUp size={20} color="var(--secondary)" />
            <h3>{t('community.tag.info.scopri.trend_titolo')}</h3>
            <p>{t('community.tag.info.scopri.trend_desc')}</p>
          </div>
          <div className="tag-info-card">
            <Bookmark size={20} color="var(--accent-warm)" />
            <h3>{t('community.tag.info.scopri.segui_titolo')}</h3>
            <p>{t('community.tag.info.scopri.segui_desc')}</p>
          </div>
          <div className="tag-info-card">
            <Users size={20} color="var(--primary)" />
            <h3>{t('community.tag.info.scopri.community_titolo')}</h3>
            <p>{t('community.tag.info.scopri.community_desc')}</p>
          </div>
        </div>
      </motion.section>

      {/* Privacy */}
      <motion.section {...su(0.35)} className="glass-panel" style={{ padding: '1.6rem 1.8rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', margin: '0 0 1rem', fontFamily: "'Space Grotesk', 'SpaceGrotesk-fallback', sans-serif" }}>
          <Tag size={18} color="var(--primary)" /> {t('community.tag.info.privacy.titolo')}
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          {t('community.tag.info.privacy.testo')}
        </p>
      </motion.section>

      {/* CTA */}
      <motion.div {...su(0.4)} style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
        <Link to="/socialify" className="btn btn-primary">
          <Tag size={15} /> {t('community.tag.info.cta')}
        </Link>
      </motion.div>
    </div>
  );
}
