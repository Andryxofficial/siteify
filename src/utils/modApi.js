/**
 * modApi.js — Wrapper centralizzato per tutte le chiamate al backend del Mod Panel.
 *
 * Obiettivo: garantire che ogni chiamata API alle endpoint /api/mod-* passi
 * per un singolo punto di gestione errori, evitando comportamenti incoerenti
 * tra le diverse sezioni del pannello.
 *
 * Caratteristiche:
 *   - Allega automaticamente l'header Authorization col token Twitch
 *   - Body serializzato come JSON con Content-Type
 *   - Risposta sempre normalizzata in `{ ok, status, data, error, code }`
 *     - `code` riflette il `code` machine-readable del backend, p.es.
 *       `scope_missing`, `broadcaster_token_missing`, `not_mod`, `unauthenticated`
 *   - Notifica un set globale di listener su errori "speciali" (scope mancanti,
 *     broadcaster token mancante) così il banner del Pannello si aggiorna
 *     automaticamente quando QUALSIASI sezione incappa nel problema.
 *
 * Uso:
 *   import { modFetch, onAuthEvent } from '@/utils/modApi';
 *   const r = await modFetch('/api/mod-moderation', { method:'POST', token, body:{action:'ban',...} });
 *   if (!r.ok) showToast(r.error);
 */

/* ─── Listener globali per eventi auth ─── */
const listeners = new Set();

/**
 * Registra un listener per eventi auth globali.
 * Eventi possibili:
 *   - 'scope_missing'              → payload { requiredScopes:[...], tokenSource }
 *   - 'broadcaster_token_missing'  → payload {}
 *   - 'unauthenticated'            → payload {}  (token mod scaduto)
 *   - 'not_mod'                    → payload {}  (utente non più mod)
 *
 * @returns {() => void} unsubscribe
 */
export function onAuthEvent(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit(event, payload) {
  for (const h of listeners) {
    try { h(event, payload); } catch { /* listener non deve poter rompere altri */ }
  }
}

/**
 * Wrapper fetch per le API mod-*.
 *
 * @param {string} url
 * @param {object} opts
 *   - token       (string, obbligatorio per endpoint protetti)
 *   - method      (string, default 'GET')
 *   - body        (object|FormData|string|undefined) — auto-JSON se object
 *   - signal      (AbortSignal opzionale)
 *   - headers     (object opzionale, merged)
 *   - silentAuth  (bool, default false) — se true non emette eventi globali
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   status: number,
 *   data: any,
 *   error: string|null,
 *   code: string|null,
 *   requiredScopes?: string[],
 *   tokenSource?: 'mod'|'broadcaster',
 * }>}
 */
export async function modFetch(url, opts = {}) {
  const { token, method = 'GET', body, signal, headers = {}, silentAuth = false } = opts;

  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let finalBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    finalBody = JSON.stringify(body);
    if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, { method, headers: finalHeaders, body: finalBody, signal });
  } catch (e) {
    // Errore di rete / abort: ritorna risultato non-ok ma non emettere eventi auth
    return {
      ok:     false,
      status: 0,
      data:   null,
      error:  e?.name === 'AbortError' ? 'Richiesta annullata.' : 'Errore di rete: impossibile contattare il server.',
      code:   e?.name === 'AbortError' ? 'aborted' : 'network_error',
    };
  }

  // Tenta di leggere il body come JSON; tollerante se vuoto
  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  const ok      = response.ok;
  const status  = response.status;
  const code    = data?.code || null;
  const error   = data?.error || data?.message || (ok ? null : `HTTP ${status}`);

  // Emetti eventi globali per i casi auth-related — il Pannello aggiorna
  // banner / forza re-auth / mostra istruzioni.
  if (!ok && !silentAuth) {
    if (code === 'scope_missing' && Array.isArray(data?.requiredScopes)) {
      emit('scope_missing', {
        requiredScopes: data.requiredScopes,
        tokenSource:    data.tokenSource || 'mod',
        endpoint:       url,
      });
    } else if (code === 'broadcaster_token_missing') {
      emit('broadcaster_token_missing', { endpoint: url });
    } else if (code === 'unauthenticated' || status === 401) {
      emit('unauthenticated', { endpoint: url });
    } else if (code === 'not_mod') {
      emit('not_mod', { endpoint: url });
    }
  }

  return {
    ok,
    status,
    data,
    error,
    code,
    requiredScopes: data?.requiredScopes,
    tokenSource:    data?.tokenSource,
  };
}

/* ─── Helper di convenienza ─── */
export const modGet    = (url, token, opts)       => modFetch(url, { ...opts, token, method: 'GET' });
export const modPost   = (url, token, body, opts) => modFetch(url, { ...opts, token, method: 'POST',   body });
export const modPatch  = (url, token, body, opts) => modFetch(url, { ...opts, token, method: 'PATCH',  body });
export const modDelete = (url, token, body, opts) => modFetch(url, { ...opts, token, method: 'DELETE', body });
