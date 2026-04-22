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
const OAUTH_SCOPES = [
  'user:read:email',
  'moderation:read',
  'channel:manage:broadcast',
  'channel:read:subscriptions',
  'channel:read:vips',
  'channel:manage:vips',
  'channel:manage:moderators',
  'channel:manage:polls',
  'channel:manage:predictions',
  'channel:manage:schedule',
  'channel:manage:raids',
  'channel:edit:commercial',
  'channel:read:redemptions',
  'channel:manage:redemptions',
  'channel:read:goals',
  'channel:read:hype_train',
  'channel:read:charity',
  'moderator:manage:banned_users',
  'moderator:manage:chat_messages',
  'moderator:manage:chat_settings',
  'moderator:manage:automod',
  'moderator:manage:automod_settings',
  'moderator:manage:announcements',
  'moderator:manage:warnings',
  'moderator:manage:shield_mode',
  'moderator:manage:blocked_terms',
  'moderator:manage:unban_requests',
  'moderator:manage:shoutouts',
  'moderator:read:followers',
  'moderator:read:chatters',
  // Permette di scrivere in chat come broadcaster — usato dal bot 24/7 e dalla
  // sezione "Annuncia / Invia messaggio" del Pannello Mod (api/_botHelix.js).
  'user:write:chat',
  // scope richiesti dal bot IRC (wss://irc-ws.chat.twitch.tv)
  'chat:read',
  'chat:edit',
].join('+');

function buildTwitchLoginUrl(returnPath, opzioni = {}) {
  const redirect    = window.location.origin + '/gioco';
  const desiredPath = returnPath || window.location.pathname;
  if (desiredPath && desiredPath !== '/gioco') {
    sessionStorage.setItem('twitchAuthReturnPath', desiredPath);
  }
  // force_verify=true forza Twitch a mostrare di nuovo la schermata di consenso,
  // utile quando aggiungiamo nuovi scope: senza questo flag Twitch può
  // re-autorizzare silenziosamente con i vecchi scope, lasciando l'utente
  // intrappolato in un loop di "permessi mancanti".
  const force = opzioni?.forceVerify !== false; // default ON
  return (
    `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=token&scope=${OAUTH_SCOPES}` +
    (force ? `&force_verify=true` : '')
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
  const [twitchScopes,  setTwitchScopes]  = useState([]);   // scope del token corrente
  const [loading,       setLoading]       = useState(true);

  /* ── Valida un token contro Twitch e imposta lo stato.
   *
   * Politica logout:
   *   - 401 dall'endpoint /oauth2/validate → token genuinamente invalido → logout.
   *   - Errore di rete / 429 / 5xx → NON disconnettere: mantieni lo stato
   *     precedente (se c'è già) o resta in attesa che il prossimo check
   *     periodico abbia successo. Disconnettere su un errore transiente
   *     causerebbe un logout fastidioso ogni volta che Twitch è instabile o
   *     l'utente è offline per qualche secondo.
   *   - L'errore HTTP più comune da Twitch è 401 quando il token è scaduto,
   *     revocato dall'utente o invalidato dopo un `force_verify` con scope
   *     diversi. In tutti gli altri casi conviene mantenere la sessione.
   */
  const validateToken = useCallback(async (token, { isInitial = true } = {}) => {
    let res;
    try {
      res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
    } catch {
      // Errore di rete (offline / DNS / timeout): NON disconnettere.
      // Se è il caricamento iniziale e non abbiamo ancora uno stato,
      // imposta comunque il token per non bloccare l'UI — la prossima
      // chiamata API rivelerà eventualmente l'invalidità.
      if (isInitial) {
        setTwitchToken(token);
        setLoading(false);
      }
      return;
    }

    // 401: token genuinamente invalido → logout pulito.
    if (res.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      setTwitchToken(null);
      setTwitchUser(null);
      setTwitchDisplay(null);
      setTwitchAvatar(null);
      setTwitchUserId(null);
      setTwitchScopes([]);
      setLoading(false);
      return;
    }

    // 4xx (eccetto 401) / 5xx / 429: errore transiente Twitch → non disconnettere.
    if (!res.ok) {
      if (isInitial) {
        // Mantieni il token in stato per poter ritentare; la UI mostrerà
        // l'errore solo se la successiva chiamata API fallisce.
        setTwitchToken(token);
        setLoading(false);
      }
      return;
    }

    // Successo: aggiorna tutto lo stato.
    let data;
    try { data = await res.json(); }
    catch {
      if (isInitial) { setTwitchToken(token); setLoading(false); }
      return;
    }
    setTwitchUser(data.login);
    setTwitchToken(token);
    setTwitchUserId(data.user_id || null);
    setTwitchScopes(data.scopes || []);

    // Recupera profilo completo (display_name, avatar) — best-effort.
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

    if (isInitial) setLoading(false);
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

  /* ── Controllo periodico scadenza token (ogni 10 minuti) ──
   * Politica: logout SOLO su 401 (token genuinamente invalido).
   * Errori transienti (rete, 429 rate-limit, 5xx Twitch instabile) NON
   * provocano la disconnessione: il prossimo check ritenterà.
   */
  useEffect(() => {
    if (!twitchToken) return;
    const check = async () => {
      let res;
      try {
        res = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `OAuth ${twitchToken}` },
        });
      } catch { return; /* errore di rete, non disconnettere */ }
      if (res.status === 401) logout();
      // qualsiasi altro stato: silenzio, ritenta al prossimo giro
    };
    const id = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitchToken]);

  /* ── Cross-tab sync via storage events ──
   * Se l'utente fa login/logout in un'altra scheda, propaga lo stato qui
   * senza ricaricare la pagina. Tipico per chi tiene Mod Panel + Stream
   * Manager Twitch in finestre separate.
   */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      // Logout in un'altra tab
      if (!e.newValue && twitchToken) {
        setTwitchUser(null);
        setTwitchDisplay(null);
        setTwitchAvatar(null);
        setTwitchToken(null);
        setTwitchUserId(null);
        setTwitchScopes([]);
        return;
      }
      // Token cambiato in un'altra tab: rivalida
      if (e.newValue && e.newValue !== twitchToken) {
        validateToken(e.newValue, { isInitial: false });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [twitchToken, validateToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTwitchUser(null);
    setTwitchDisplay(null);
    setTwitchAvatar(null);
    setTwitchToken(null);
    setTwitchUserId(null);
    setTwitchScopes([]);
  }, []);

  /** Predicato: l'utente ha TUTTI gli scope richiesti? */
  const hasScopes = useCallback((scopes) => {
    if (!Array.isArray(scopes) || !scopes.length) return true;
    if (!Array.isArray(twitchScopes)) return false;
    return scopes.every(s => twitchScopes.includes(s));
  }, [twitchScopes]);

  /** Lista scope mancanti rispetto a un set richiesto. */
  const missingScopes = useCallback((scopes) => {
    if (!Array.isArray(scopes)) return [];
    return scopes.filter(s => !twitchScopes.includes(s));
  }, [twitchScopes]);

  return (
    <TwitchAuthContext.Provider value={{
      twitchUser,
      twitchDisplay,
      twitchAvatar,
      twitchToken,
      twitchUserId,
      twitchScopes,
      loading,
      isLoggedIn: !!twitchUser,
      clientId: CHIAVETWITCH,
      logout,
      hasScopes,
      missingScopes,
      // Lista CANONICA degli scope OAuth richiesti dal sito.
      // Esposta per consentire ai consumer di confrontarli con `twitchScopes`.
      requiredScopes: OAUTH_SCOPES.split('+'),
      getTwitchLoginUrl: buildTwitchLoginUrl,
    }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
