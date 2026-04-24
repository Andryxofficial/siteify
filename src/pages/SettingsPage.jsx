/**
 * SettingsPage — Pagina impostazioni utente.
 * Route: /impostazioni
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Bell, Shield, Palette, Eye, Database, LogOut, Check, Download, LogIn, Accessibility, Sun, Moon, SunMoon, Sunrise, MapPin, Languages } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useTema } from '../contexts/TemaContext';
import { useLingua } from '../contexts/LinguaContext';
import { useNotifiche } from '../hooks/useNotifiche';
import SEO from '../components/SEO';

const NOTIF_PREFS_KEY       = 'andryxify_msg_notif_prefs';
const TEMA_KEY               = 'andryxify_tema';
const TEMA_MODALITA_KEY      = 'andryxify_tema_modalita';
const FONT_DIMENSIONE_KEY    = 'andryxify_font_dimensione';

const TEMI = [
  { id: 'default', label: 'Default', color: '#e040fb' },
  { id: 'magenta', label: 'Magenta', color: '#ff4081' },
  { id: 'cyan', label: 'Ciano', color: '#00e5ff' },
  { id: 'amber', label: 'Ambra', color: '#ffb300' },
  { id: 'emerald', label: 'Smeraldo', color: '#4ade80' },
];

/* Chiavi i18n risolte a runtime; gli id restano stabili per persistenza */
const MODALITA_TEMI = [
  { id: 'scuro',          labelKey: 'settings.tema.scuro',         Icon: Moon    },
  { id: 'chiaro',         labelKey: 'settings.tema.chiaro',        Icon: Sun     },
  { id: 'auto',           labelKey: 'settings.tema.auto',          Icon: SunMoon },
  { id: 'alba-tramonto',  labelKey: 'settings.tema.alba-tramonto', Icon: Sunrise },
];

const DIMENSIONI_FONT = [
  { id: 'normale', label: 'A', dimensione: '0.88rem', titoloKey: 'settings.font.normale' },
  { id: 'grande',  label: 'A', dimensione: '1.05rem', titoloKey: 'settings.font.grande'  },
  { id: 'gigante', label: 'A', dimensione: '1.22rem', titoloKey: 'settings.font.gigante' },
];

const entrata = (ritardo = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

function Interruttore({ attivo, onChange, etichetta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
      <span style={{ fontSize: '0.9rem' }}>{etichetta}</span>
      <button
        role="switch"
        aria-checked={attivo}
        onClick={() => onChange(!attivo)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: attivo ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: attivo ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const {
    isLoggedIn, twitchUser, twitchDisplay, twitchAvatar, twitchToken,
    logout, clientId, getTwitchLoginUrl,
  } = useTwitchAuth();

  /* i18n — label tradotte e selettore lingua */
  const { t, modalita: modalitaLingua, setModalita: setModalitaLingua, lingueDisponibili } = useLingua();

  // Sistema Endocrino: Notifiche
  const { attivo: notificheAttive, attiva: attivaNotifiche, disattiva: disattivaNotifiche, supportato: notificheSupportate } = useNotifiche();

  const [notificheLocali, setNotificheLocali] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTIF_PREFS_KEY);
      return saved ? JSON.parse(saved) : { inApp: true, sound: true };
    } catch { return { inApp: true, sound: true }; }
  });

  // Tema colore accent
  const [temaAttivo, setTemaAttivo] = useState(() => localStorage.getItem(TEMA_KEY) || 'default');
  const [customColor, setCustomColor] = useState(() => {
    const salvato = localStorage.getItem(TEMA_KEY);
    return (salvato && salvato.startsWith('#')) ? salvato : '#e040fb';
  });

  // Modalità chiaro/scuro — gestita dal TemaContext condiviso con la Navbar
  const { modalita: modalitaTema, setModalita: setModalitaTema, coordsRichieste, richiediCoords } = useTema();

  // Dimensione font (disponibile senza login)
  const [fontDimensione, setFontDimensione] = useState(
    () => localStorage.getItem(FONT_DIMENSIONE_KEY) || 'normale'
  );

  // Privacy
  const [privacy, setPrivacy] = useState({ friendRequestsOpen: true, visibility: 'public' });
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Export dati
  const [esportando, setEsportando] = useState(false);
  const [erroreExport, setErroreExport] = useState('');

  // Carica privacy dal server
  useEffect(() => {
    if (!twitchToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/profile?user=${encodeURIComponent(twitchUser)}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPrivacy({
            friendRequestsOpen: data.friendRequestsOpen !== false,
            visibility: data.visibility || 'public',
          });
        }
      } catch { /* silenzioso */ }
    })();
  }, [twitchToken, twitchUser]);

  // Salva notifiche locali
  useEffect(() => {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notificheLocali));
  }, [notificheLocali]);

  // Salva e applica tema colore
  useEffect(() => {
    localStorage.setItem(TEMA_KEY, temaAttivo);
    if (temaAttivo === 'custom') {
      document.documentElement.style.setProperty('--primary', customColor);
      localStorage.setItem(TEMA_KEY, customColor); // Salva direttamente il colore
    } else if (temaAttivo.startsWith('#')) {
      document.documentElement.style.setProperty('--primary', temaAttivo);
      setCustomColor(temaAttivo);
    } else {
      const tema = TEMI.find(t => t.id === temaAttivo);
      if (tema) document.documentElement.style.setProperty('--primary', tema.color);
    }
  }, [temaAttivo, customColor]);

  // Applica dimensione font
  useEffect(() => {
    localStorage.setItem(FONT_DIMENSIONE_KEY, fontDimensione);
    if (fontDimensione === 'normale') {
      document.documentElement.removeAttribute('data-font');
    } else {
      document.documentElement.setAttribute('data-font', fontDimensione);
    }
  }, [fontDimensione]);

  const aggiornaNotifica = (campo, valore) => {
    setNotificheLocali(prev => ({ ...prev, [campo]: valore }));
  };

  const handleTogglePush = async (attiva) => {
    if (attiva) await attivaNotifiche();
    else disattivaNotifiche();
  };

  const salvaPrivacy = useCallback(async (nuovaPrivacy) => {
    if (!twitchToken) return;
    setPrivacyLoading(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify(nuovaPrivacy),
      });
      setPrivacy(nuovaPrivacy);
    } catch { /* silenzioso */ }
    finally { setPrivacyLoading(false); }
  }, [twitchToken]);

  const esportaDati = async () => {
    if (!twitchToken) return;
    setEsportando(true);
    setErroreExport('');
    try {
      /* Dati server: post, risposte, amici, preferiti, XP, profilo */
      const res = await fetch('/api/user-export', {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Errore ${res.status}`);
      }
      const datiServer = await res.json();

      /* Arricchisci con impostazioni locali */
      const esportazione = {
        ...datiServer,
        impostazioniLocali: {
          notifiche,
          tema:          temaAttivo,
          modalitaTema,
          fontDimensione,
          privacy,
        },
      };

      /* Scarica JSON */
      const blob = new Blob([JSON.stringify(esportazione, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `andryxify-dati-${twitchUser}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErroreExport(e.message || 'Errore durante l\'esportazione. Riprova.');
    } finally {
      setEsportando(false);
    }
  };

  return (
    <div className="main-content">
      <SEO title={t('settings.titolo')} description="Gestisci il tuo account, notifiche, privacy e sicurezza su ANDRYXify." path="/impostazioni" noindex />

      {/* Intestazione */}
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <Settings size={28} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span className="text-gradient">{t('settings.titolo')}</span>
        </motion.h1>
      </section>

      {/* ═══ Accessibilità — visibile senza login ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.1)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.1rem', fontSize: '1rem' }}>
          <Accessibility size={18} /> {t('settings.accessibilita')}
        </h3>

        {/* Modalità tema */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>{t('settings.modalita_schermo')}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: coordsRichieste ? '0.7rem' : '1.2rem', flexWrap: 'wrap' }}>
          {MODALITA_TEMI.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              onClick={() => setModalitaTema(id)}
              aria-pressed={modalitaTema === id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', borderRadius: 'var(--r-full)',
                border: modalitaTema === id ? '1.5px solid var(--primary)' : '1.5px solid var(--vetro-bordo-colore)',
                background: modalitaTema === id ? 'var(--primary-light)' : 'transparent',
                color: modalitaTema === id ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                transition: 'all 0.2s var(--ease-glass)',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={14} /> {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Suggerimento permesso geolocazione per alba/tramonto */}
        {modalitaTema === 'alba-tramonto' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem',
            padding: '0.55rem 0.85rem', borderRadius: 'var(--r-md)',
            background: 'var(--surface-1)', border: '1px solid var(--vetro-bordo-colore)',
            fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45,
          }}>
            <MapPin size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <span style={{ flex: 1 }}>
              {coordsRichieste ? t('settings.alba.richiedi') : t('settings.alba.descr')}
            </span>
            {coordsRichieste && (
              <button
                onClick={() => richiediCoords()}
                className="btn btn-ghost"
                style={{ fontSize: '0.74rem', padding: '0.3rem 0.7rem', flexShrink: 0 }}
              >
                {t('settings.alba.concedi')}
              </button>
            )}
          </div>
        )}

        {/* Dimensione testo */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>{t('settings.dimensione_testo')}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {DIMENSIONI_FONT.map(({ id, label, dimensione, titoloKey }) => {
            const titolo = t(titoloKey);
            return (
              <button
                key={id}
                onClick={() => setFontDimensione(id)}
                aria-pressed={fontDimensione === id}
                title={titolo}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                  padding: '0.5rem 1.1rem', borderRadius: 'var(--r-md)',
                  border: fontDimensione === id ? '1.5px solid var(--primary)' : '1.5px solid var(--vetro-bordo-colore)',
                  background: fontDimensione === id ? 'var(--primary-light)' : 'transparent',
                  color: fontDimensione === id ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: 700,
                  transition: 'all 0.2s var(--ease-glass)',
                  fontFamily: 'inherit',
                  fontSize: dimensione,
                  lineHeight: 1.1,
                }}
              >
                {label}
                <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.2px', opacity: 0.75 }}>{titolo}</span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* ═══ Lingua — visibile senza login ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.13)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Languages size={18} /> {t('settings.lingua')}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
          {t('settings.lingua.descr')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Automatica: segue la lingua del dispositivo */}
          <button
            onClick={() => setModalitaLingua('auto')}
            aria-pressed={modalitaLingua === 'auto'}
            title={t('settings.lingua.auto_descr')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', borderRadius: 'var(--r-full)',
              border: modalitaLingua === 'auto' ? '1.5px solid var(--primary)' : '1.5px solid var(--vetro-bordo-colore)',
              background: modalitaLingua === 'auto' ? 'var(--primary-light)' : 'transparent',
              color: modalitaLingua === 'auto' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              transition: 'all 0.2s var(--ease-glass)',
              fontFamily: 'inherit',
            }}
          >
            🌐 {t('settings.lingua.auto')}
          </button>
          {lingueDisponibili.map(({ codice, nome, bandiera }) => (
            <button
              key={codice}
              onClick={() => setModalitaLingua(codice)}
              aria-pressed={modalitaLingua === codice}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', borderRadius: 'var(--r-full)',
                border: modalitaLingua === codice ? '1.5px solid var(--primary)' : '1.5px solid var(--vetro-bordo-colore)',
                background: modalitaLingua === codice ? 'var(--primary-light)' : 'transparent',
                color: modalitaLingua === codice ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                transition: 'all 0.2s var(--ease-glass)',
                fontFamily: 'inherit',
              }}
            >
              <span aria-hidden="true">{bandiera}</span> {nome}
            </button>
          ))}
        </div>
      </motion.section>

      {/* ═══ Aspetto — visibile senza login ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.15)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
          <Palette size={18} /> {t('settings.aspetto')}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>{t('settings.colore_principale')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {TEMI.map(tema => (
            <button
              key={tema.id}
              title={tema.label}
              onClick={() => setTemaAttivo(tema.id)}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: tema.color, cursor: 'pointer', position: 'relative',
                boxShadow: (temaAttivo === tema.id && !temaAttivo.startsWith('#')) ? `0 0 0 3px ${tema.color}44, inset 0 0 0 2px #fff` : '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.2s',
              }}
              aria-label={tema.label}
            >
              {(temaAttivo === tema.id && !temaAttivo.startsWith('#')) && (
                <Check size={16} color="#fff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              )}
            </button>
          ))}
          {/* Selettore Personalizzato Biologico */}
          <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', boxShadow: temaAttivo.startsWith('#') ? `0 0 0 3px ${customColor}44, inset 0 0 0 2px #fff` : '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer', overflow: 'hidden' }}>
            <input 
              type="color" 
              value={customColor} 
              onChange={(e) => { setCustomColor(e.target.value); setTemaAttivo(e.target.value); }}
              style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, padding: 0, border: 'none', cursor: 'pointer' }}
              title="Colore personalizzato"
            />
            {temaAttivo.startsWith('#') && (
              <Check size={16} color="#fff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
            )}
          </div>
        </div>
      </motion.section>

      {/* ═══ Sezioni che richiedono login ═══ */}
      {!isLoggedIn ? (
        <motion.div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1.5rem' }} {...entrata(0.2)}>
          <Settings size={32} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
          <h2 style={{ marginBottom: '0.4rem', fontSize: '1.1rem' }}>{t('settings.accedi_altre')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.2rem', lineHeight: 1.55 }}>
            {t('settings.accedi_descr')}
          </p>
          {clientId && (
            <a href={getTwitchLoginUrl('/impostazioni')} className="btn social-btn-twitch">
              <LogIn size={14} /> {t('settings.accedi_con_twitch')}
            </a>
          )}
        </motion.div>
      ) : (
        <>
          {/* ═══ Account ═══ */}
          <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.2)}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '1rem' }}>
              <User size={18} /> {t('settings.account')}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {twitchAvatar ? (
                <img src={twitchAvatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={28} />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{twitchDisplay || twitchUser}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{twitchUser}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to={`/profilo/${twitchUser}`} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                <User size={14} /> {t('settings.vedi_profilo')}
              </Link>
              <button className="btn btn-ghost" style={{ fontSize: '0.82rem', color: 'var(--accent)' }} onClick={logout}>
                <LogOut size={14} /> {t('settings.esci')}
              </button>
            </div>
          </motion.section>

          {/* ═══ Notifiche (Sistema Nervoso) ═══ */}
          <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.25)}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
              <Bell size={18} /> {t('settings.notifiche')}
            </h3>
            <Interruttore etichetta={t('settings.notif.in_app')} attivo={notificheLocali.inApp} onChange={v => aggiornaNotifica('inApp', v)} />
            {notificheSupportate ? (
              <Interruttore etichetta={t('settings.notif.push')} attivo={notificheAttive} onChange={handleTogglePush} />
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.5rem' }}>Le notifiche push non sono supportate da questa membrana cellulare (browser).</p>
            )}
            <Interruttore etichetta={t('settings.notif.suoni')} attivo={notificheLocali.sound} onChange={v => aggiornaNotifica('sound', v)} />
          </motion.section>

          {/* ═══ Sicurezza E2E ═══ */}
          <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.3)}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
              <Shield size={18} /> {t('settings.sicurezza')}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              {t('settings.e2e.descr')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to="/messaggi" className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                <Check size={13} /> {t('settings.e2e.vai_messaggi')}
              </Link>
            </div>
          </motion.section>

          {/* ═══ Privacy ═══ */}
          <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem' }} {...entrata(0.35)}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', fontSize: '1rem' }}>
              <Eye size={18} /> {t('settings.privacy')}
            </h3>
            <Interruttore
              etichetta={t('settings.privacy.amicizia')}
              attivo={privacy.friendRequestsOpen}
              onChange={v => salvaPrivacy({ ...privacy, friendRequestsOpen: v })}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span style={{ fontSize: '0.9rem' }}>{t('settings.privacy.visibilita')}</span>
              <select
                value={privacy.visibility}
                onChange={e => salvaPrivacy({ ...privacy, visibility: e.target.value })}
                disabled={privacyLoading}
                style={{
                  background: 'var(--surface-1)', color: 'var(--text-main)', border: '1px solid var(--glass-border)',
                  borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                <option value="public">{t('settings.privacy.pubblico')}</option>
                <option value="friends">{t('settings.privacy.amici')}</option>
                <option value="private">{t('settings.privacy.privato')}</option>
              </select>
            </div>
          </motion.section>

          {/* ═══ Dati ═══ */}
          <motion.section className="glass-panel" style={{ padding: '1.2rem', marginBottom: '2rem' }} {...entrata(0.4)}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.9rem', fontSize: '1rem' }}>
              <Database size={18} /> {t('settings.dati')}
            </h3>

            {/* Cosa viene incluso */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--glass-border)',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                Il file JSON includerà:
              </div>
              {[
                '📝 Tutti i tuoi post pubblicati',
                '💬 Tutte le tue risposte',
                '⭐ Post aggiunti ai preferiti',
                '👥 Lista amici',
                '🏆 Statistiche XP e livello',
                '👤 Profilo (bio, social, privacy)',
                '⚙️ Impostazioni locali (tema, notifiche)',
              ].map(voce => (
                <div key={voce} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {voce}
                </div>
              ))}
            </div>

            {/* Errore */}
            {erroreExport && (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                ⚠️ {erroreExport}
              </p>
            )}

            {/* Bottone export */}
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center', opacity: esportando ? 0.7 : 1 }}
              onClick={esportaDati}
              disabled={esportando}
            >
              {esportando ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--text-faint)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Raccolta dati in corso…
                </>
              ) : (
                <><Download size={15} /> Scarica i miei dati</>
              )}
            </button>

            <p style={{ fontSize: '0.73rem', color: 'var(--text-faint)', marginTop: '0.7rem', lineHeight: 1.5 }}>
              {t('settings.dati.elimina_descr')}
            </p>
          </motion.section>
        </>
      )}
    </div>
  );
}
