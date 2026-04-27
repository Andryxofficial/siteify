import { useState } from 'react';
import { ShieldCheck, LockKeyhole, MessageCircle, ChevronRight, Trash2, AlertTriangle, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLingua } from '../contexts/LinguaContext';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { privacySecurityText } from '../i18n/privacySecurity';

const LOCAL = {
  it: {
    title: 'Elimina dati account',
    intro: 'Elimina profilo, impostazioni server, post, risposte, like, preferiti, amici, XP, livelli, classifiche, notifiche e memoria Ikigai collegata al tuo account.',
    chatTitle: 'Elimina anche le chat private',
    chatText: 'Le chat private sono dati separati e più delicati. Se attivi questa opzione elimini anche conversazioni, messaggi cifrati, media privati, chiavi pubbliche e backup E2E salvati sul server.',
    warning: 'Azione definitiva: dopo l’eliminazione verrai disconnesso. Al prossimo login verrà creata un’utenza nuova, senza storico, classifica o dati precedenti.',
    confirmLabel: 'Scrivi ELIMINA per confermare',
    placeholder: 'ELIMINA',
    button: 'Elimina dati account',
    deleting: 'Eliminazione in corso…',
    error: 'Non sono riuscita a eliminare i dati. Riprova tra poco.',
    login: 'Accedi per gestire l’eliminazione dei dati account.',
  },
  en: {
    title: 'Delete account data',
    intro: 'Delete your profile, server settings, posts, replies, likes, favorites, friends, XP, levels, rankings, notifications and Ikigai memory linked to your account.',
    chatTitle: 'Also delete private chats',
    chatText: 'Private chats are separate and more sensitive data. If enabled, this also deletes conversations, encrypted messages, private media, public keys and E2E backups stored on the server.',
    warning: 'Permanent action: after deletion you will be logged out. The next login will create a new account state, with no previous history, rankings or data.',
    confirmLabel: 'Type DELETE to confirm',
    placeholder: 'DELETE',
    button: 'Delete account data',
    deleting: 'Deleting…',
    error: 'I could not delete the data. Try again shortly.',
    login: 'Sign in to manage account data deletion.',
  },
  es: {
    title: 'Eliminar datos de la cuenta',
    intro: 'Elimina perfil, ajustes del servidor, posts, respuestas, likes, favoritos, amigos, XP, niveles, clasificaciones, notificaciones y memoria de Ikigai vinculada a tu cuenta.',
    chatTitle: 'Eliminar también los chats privados',
    chatText: 'Los chats privados son datos separados y más sensibles. Si activas esta opción, también se eliminan conversaciones, mensajes cifrados, archivos privados, claves públicas y copias E2E guardadas en el servidor.',
    warning: 'Acción definitiva: después de eliminar los datos se cerrará tu sesión. En el próximo inicio se creará una cuenta nueva, sin historial, clasificación ni datos anteriores.',
    confirmLabel: 'Escribe ELIMINAR para confirmar',
    placeholder: 'ELIMINAR',
    button: 'Eliminar datos de la cuenta',
    deleting: 'Eliminando…',
    error: 'No he podido eliminar los datos. Inténtalo de nuevo dentro de poco.',
    login: 'Inicia sesión para gestionar la eliminación de datos de la cuenta.',
  },
};

function normLang(lingua) {
  const l = String(lingua || 'it').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'it';
}

const confermaPerLingua = { it: 'ELIMINA', en: 'DELETE', es: 'ELIMINAR' };

function AccountDeletionBox({ lingua }) {
  const lang = normLang(lingua);
  const copy = LOCAL[lang];
  const parola = confermaPerLingua[lang];
  const { isLoggedIn, twitchToken, logout } = useTwitchAuth();
  const [includePrivateChats, setIncludePrivateChats] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmed = confirm.trim().toUpperCase() === parola;

  const elimina = async () => {
    if (!isLoggedIn || !twitchToken || !confirmed || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user-delete?includePrivateChats=${includePrivateChats ? 'true' : 'false'}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || copy.error);
      }
      [
        'andryxify_msg_notif_prefs',
        'andryxify_tema',
        'andryxify_tema_modalita',
        'andryxify_font_dimensione',
        'andryxify_ha_non_letti',
        'andryxify_ikigai_anon',
      ].forEach(k => { try { localStorage.removeItem(k); } catch { /* ignora */ } });
      try { logout(); } catch { /* ignora */ }
      window.location.href = '/';
    } catch (e) {
      setError(e.message || copy.error);
      setLoading(false);
    }
  };

  return (
    <section className="settings-privacy-tail account-delete-box glass-panel" aria-labelledby="delete-account-title">
      <div className="settings-privacy-tail-orb danger" aria-hidden="true">
        <Trash2 size={25} />
      </div>

      <div className="settings-privacy-tail-content">
        <span className="settings-privacy-tail-kicker danger"><AlertTriangle size={13} /> Privacy & data control</span>
        <h3 id="delete-account-title">{copy.title}</h3>
        {!isLoggedIn ? (
          <p>{copy.login}</p>
        ) : (
          <>
            <p>{copy.intro}</p>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', marginTop: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includePrivateChats}
                onChange={e => setIncludePrivateChats(e.target.checked)}
                style={{ marginTop: '0.28rem', accentColor: 'var(--primary)' }}
              />
              <span>
                <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{copy.chatTitle}</strong>
                <span style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{copy.chatText}</span>
              </span>
            </label>

            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '18px', border: '1px solid rgba(248,113,113,.32)', background: 'rgba(248,113,113,.08)', color: 'var(--text-main)', lineHeight: 1.55 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}><XCircle size={15} /> {copy.warning}</strong>
              <label style={{ display: 'block', marginTop: '0.75rem', fontWeight: 800, fontSize: '0.84rem' }}>
                {copy.confirmLabel}
                <input
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder={copy.placeholder}
                  autoCapitalize="characters"
                  style={{ width: '100%', marginTop: '0.45rem', padding: '0.8rem 1rem', borderRadius: '16px' }}
                />
              </label>
            </div>

            {error && <p style={{ color: '#f87171', fontWeight: 700, marginTop: '0.8rem' }}>{error}</p>}
          </>
        )}
      </div>

      {isLoggedIn && (
        <button
          type="button"
          className="settings-privacy-tail-cta danger"
          onClick={elimina}
          disabled={!confirmed || loading}
          aria-disabled={!confirmed || loading}
          style={{ opacity: (!confirmed || loading) ? 0.55 : 1, cursor: (!confirmed || loading) ? 'not-allowed' : 'pointer' }}
        >
          {loading ? copy.deleting : copy.button} <Trash2 size={16} />
        </button>
      )}
    </section>
  );
}

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

      <AccountDeletionBox lingua={lingua} />
    </div>
  );
}
