/**
 * TwitchAuthContext — Contesto di autenticazione Twitch per ANDRYXify.
 *
 * Gestisce:
 *   - Login OAuth implicit-flow con Twitch
 *   - Validazione e refresh del token
 *   - Dati utente: login, display_name, avatar, user_id
 *
 * La crittografia E2E è gestita localmente da MessagesPage/e2eKeys.js
 * senza alcuna dipendenza da questo contesto.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;
const STORAGE_KEY  = 'twitchGameToken';

const TwitchAuthContext = createContext(null);

/**
 * Costruisce l'URL di login OAuth Twitch (implicit-flow).
 * Usa sempre /gioco come redirect_uri (l'unico URI registrato su Twitch).
 * Se `returnPath` è fornito, viene salvato in sessionStorage per il redirect post-login.
 */
function buildTwitchLoginUrl(returnPath) {
  const redirect    = window.location.origin + '/gioco';
  const desiredPath = returnPath || window.location.pathname;
  if (desiredPath && desiredPath !== '/gioco') {
    sessionStorage.setItem('twitchAuthReturnPath', desiredPath);
  }
  return (
    `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=token&scope=user:read:email+moderation:read+channel:manage:broadcast+channel:read:subscriptions+channel:read:vips+channel:manage:polls+channel:manage:predictions+channel:manage:schedule+moderator:manage:banned_users+moderator:manage:chat_messages+moderator:manage:automod+moderator:manage:shoutouts+moderator:read:followers`
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTwitchAuth() {
  const ctx = useContext(TwitchAuthContext);
  if (!ctx) throw new Error('useTwitchAuth deve essere usato dentro TwitchAuthProvider');
  return ctx;
}

export function TwitchAuthProvider({ children }) {
  const [twitchUser,    setTwitchUser]    = useState(null); // login name
  const [twitchDisplay, setTwitchDisplay] = useState(null); // display_name
  const [twitchAvatar,  setTwitchAvatar]  = useState(null); // profile_image_url
  const [twitchToken,   setTwitchToken]   = useState(null);
  const [twitchUserId,  setTwitchUserId]  = useState(null); // user_id numerico stabile
  const [loading,       setLoading]       = useState(true);

  /* ── Valida un token contro Twitch e imposta lo stato ── */
  const validateToken = useCallback(async (token) => {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!res.ok) throw new Error('Token scaduto');
      const data = await res.json();
      setTwitchUser(data.login);
      setTwitchToken(token);
      setTwitchUserId(data.user_id || null);

      // Recupera profilo completo (display_name, avatar)
      try {
        const profileRes = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': CHIAVETWITCH,
          },
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const u = profileData.data?.[0];
          if (u) {
            setTwitchDisplay(u.display_name || data.login);
            setTwitchAvatar(u.profile_image_url || null);
          }
        }
      } catch { /* fetch profilo best-effort */ }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setTwitchToken(null);
      setTwitchUser(null);
      setTwitchDisplay(null);
      setTwitchAvatar(null);
      setTwitchUserId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── All'avvio: controlla URL hash (OAuth callback) o token salvato ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token  = params.get('access_token');
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
        window.history.replaceState(null, '', window.location.pathname);
        validateToken(token);
        return;
      }
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      validateToken(saved);
    } else {
      setLoading(false);
    }
  }, [validateToken]);

  /* ── Controllo periodico scadenza token (ogni 5 minuti) ── */
  useEffect(() => {
    if (!twitchToken) return;
    const check = async () => {
      try {
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `OAuth ${twitchToken}` },
        });
        if (!res.ok) logout();
      } catch { /* errore di rete, non disconnettere */ }
    };
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitchToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTwitchUser(null);
    setTwitchDisplay(null);
    setTwitchAvatar(null);
    setTwitchToken(null);
    setTwitchUserId(null);
  }, []);

  return (
    <TwitchAuthContext.Provider value={{
      twitchUser,
      twitchDisplay,
      twitchAvatar,
      twitchToken,
      twitchUserId,
      loading,
      isLoggedIn: !!twitchUser,
      clientId: CHIAVETWITCH,
      logout,
      getTwitchLoginUrl: buildTwitchLoginUrl,
    }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
