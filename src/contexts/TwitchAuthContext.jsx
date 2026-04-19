import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ensureE2EKeysRegistered, forceResetE2EKeys } from '../utils/e2eKeys';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;
const STORAGE_KEY = 'twitchGameToken';

const TwitchAuthContext = createContext(null);

/**
 * Builds the Twitch OAuth implicit-flow URL.
 * Always uses /gioco as redirect_uri (the only URI registered in Twitch).
 * If `returnPath` is provided, it's saved in sessionStorage so the app
 * can navigate back after the OAuth callback.
 */
function buildTwitchLoginUrl(returnPath) {
  const redirect = window.location.origin + '/gioco';
  // Save desired return path so TwitchOAuthRedirect can navigate back
  const desiredPath = returnPath || window.location.pathname;
  if (desiredPath && desiredPath !== '/gioco') {
    sessionStorage.setItem('twitchAuthReturnPath', desiredPath);
  }
  return (
    `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=token&scope=user:read:email+moderation:read`
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTwitchAuth() {
  const ctx = useContext(TwitchAuthContext);
  if (!ctx) throw new Error('useTwitchAuth deve essere usato dentro TwitchAuthProvider');
  return ctx;
}

export function TwitchAuthProvider({ children }) {
  const [twitchUser, setTwitchUser] = useState(null);     // login name
  const [twitchDisplay, setTwitchDisplay] = useState(null); // display_name
  const [twitchAvatar, setTwitchAvatar] = useState(null);   // profile_image_url
  const [twitchToken, setTwitchToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── E2E key state (tracked, not fire-and-forget) ──
  const [e2eReady, setE2eReady] = useState(false);
  const [e2eError, setE2eError] = useState(null);
  const e2ePrivateKeyRef = useRef(null);

  /* ── Register E2E keys with retry ── */
  const registerE2EKeys = useCallback(async (user, token) => {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const privateKey = await ensureE2EKeysRegistered(user, token);
        e2ePrivateKeyRef.current = privateKey;
        setE2eReady(true);
        setE2eError(null);
        return;
      } catch (e) {
        console.warn(`E2E key registration attempt ${attempt + 1} failed:`, e);
        if (attempt === MAX_RETRIES) {
          setE2eError('Impossibile inizializzare la crittografia.');
        } else {
          // Wait before retry (500ms, 1000ms)
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
  }, []);

  /* ── Validate a stored token against Twitch ── */
  const validateToken = useCallback(async (token) => {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!res.ok) throw new Error('Token expired');
      const data = await res.json();
      setTwitchUser(data.login);
      setTwitchToken(token);

      // Register E2E keys (tracked with retry, so the user can receive messages
      // even before they ever visit /messaggi)
      registerE2EKeys(data.login, token);

      // Fetch full profile (display_name, avatar)
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
      } catch { /* profile fetch is best-effort */ }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setTwitchToken(null);
      setTwitchUser(null);
      setTwitchDisplay(null);
      setTwitchAvatar(null);
    } finally {
      setLoading(false);
    }
  }, [registerE2EKeys]);

  /* ── On mount: check URL hash for fresh token, else use stored ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTwitchUser(null);
    setTwitchDisplay(null);
    setTwitchAvatar(null);
    setTwitchToken(null);
    setE2eReady(false);
    setE2eError(null);
    e2ePrivateKeyRef.current = null;
  }, []);

  /** Allow manual retry of E2E key registration (e.g. after a transient failure) */
  const retryE2E = useCallback(() => {
    if (!twitchUser || !twitchToken) return;
    setE2eReady(false);
    setE2eError(null);
    e2ePrivateKeyRef.current = null;
    registerE2EKeys(twitchUser, twitchToken);
  }, [twitchUser, twitchToken, registerE2EKeys]);

  /** Force-reset E2E keys: wipes old keys from IndexedDB and generates fresh ones.
   *  Use when existing keys are corrupted and causing derivation failures. */
  const resetE2E = useCallback(async () => {
    if (!twitchUser || !twitchToken) return;
    setE2eReady(false);
    setE2eError(null);
    e2ePrivateKeyRef.current = null;
    try {
      const privateKey = await forceResetE2EKeys(twitchUser, twitchToken);
      e2ePrivateKeyRef.current = privateKey;
      setE2eReady(true);
      setE2eError(null);
    } catch (e) {
      console.error('E2E key reset failed:', e);
      setE2eError('Reset chiavi fallito. Riprova.');
    }
  }, [twitchUser, twitchToken]);

  return (
    <TwitchAuthContext.Provider value={{
      twitchUser,
      twitchDisplay,
      twitchAvatar,
      twitchToken,
      loading,
      isLoggedIn: !!twitchUser,
      clientId: CHIAVETWITCH,
      logout,
      getTwitchLoginUrl: buildTwitchLoginUrl,
      // E2E encryption state
      e2eReady,
      e2eError,
      e2ePrivateKeyRef,
      retryE2E,
      resetE2E,
    }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
