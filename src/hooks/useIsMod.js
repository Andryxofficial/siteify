/**
 * useIsMod — Verifica se l'utente Twitch loggato è moderatore del canale.
 *
 * Esegue una richiesta a /api/mod-commands (che restituisce { isMod: bool })
 * e cacha il risultato in sessionStorage per evitare chiamate ripetute
 * durante la stessa sessione del browser.
 *
 * Restituisce uno dei tre stati:
 *   true   → l'utente è mod (o broadcaster)
 *   false  → l'utente è loggato ma non è mod
 *   null   → ancora in caricamento, oppure utente non loggato
 *
 * Usato da CommunityPage per nascondere il bottone "Mod Panel" ai non-mod
 * e potenzialmente da altri componenti che vogliono mostrare ornamenti
 * "premium" solo allo staff.
 */
import { useEffect, useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

const CHIAVE_CACHE = 'andryxify_is_mod_v1';

/* Legge un risultato cachato per quel login specifico (prevent leakage tra utenti) */
function leggiCache(login) {
  try {
    const raw = sessionStorage.getItem(CHIAVE_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.login === login && typeof parsed?.isMod === 'boolean') {
      return parsed.isMod;
    }
  } catch { /* ignore */ }
  return null;
}

function scriviCache(login, isMod) {
  try {
    sessionStorage.setItem(CHIAVE_CACHE, JSON.stringify({ login, isMod }));
  } catch { /* ignore */ }
}

export default function useIsMod() {
  const { twitchUser, twitchToken, isLoggedIn } = useTwitchAuth();
  const cached = isLoggedIn ? leggiCache(twitchUser) : null;
  const [isMod, setIsMod] = useState(cached);

  useEffect(() => {
    if (!isLoggedIn || !twitchToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stato mod su logout
      setIsMod(null);
      return;
    }
    // Se abbiamo già un valore in cache, non rifacciamo la chiamata
    const fromCache = leggiCache(twitchUser);
    if (typeof fromCache === 'boolean') {
      setIsMod(fromCache);
      return;
    }
    let attivo = true;
    fetch('/api/mod-commands', { headers: { Authorization: `Bearer ${twitchToken}` } })
      .then(r => r.ok ? r.json() : { isMod: false })
      .then(d => {
        if (!attivo) return;
        const valore = !!d.isMod;
        setIsMod(valore);
        scriviCache(twitchUser, valore);
      })
      .catch(() => { if (attivo) setIsMod(false); });
    return () => { attivo = false; };
  }, [isLoggedIn, twitchToken, twitchUser]);

  return isMod;
}
