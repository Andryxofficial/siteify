/**
 * _modAuth.js — Utilità di autenticazione condivisa per le API del Mod Panel.
 *
 * Importata dai vari endpoint mod-*.js.
 * Fornisce:
 *   - validateTwitch()       → valida token e restituisce info utente
 *   - getBroadcasterUsername() / getBroadcasterId()
 *   - isUserMod()            → controlla se l'utente è mod/streamer
 *   - syncModsFromTwitch()   → sincronizza lista mod da Helix API
 *   - helixGet() / helixPost() / helixPatch() / helixDelete() → wrapper Helix
 */

export const MOD_WHITELIST_KEY  = 'mod:whitelist';
export const MOD_SYNC_TS_KEY    = 'mod:whitelist:ts';
export const MOD_BROADCASTER_KEY = 'mod:broadcaster';
export const MOD_BROADCASTER_ID_KEY = 'mod:broadcaster:id';
// Token OAuth del broadcaster persistito in Redis: viene salvato ogni volta
// che il broadcaster apre il Mod Panel ed è usato dalle API mod-* per le
// chiamate Helix che richiedono il token del broadcaster (es. cambio titolo,
// poll, predictions, rewards, schedule, raid, commercial, VIP, sub-list…).
// In questo modo i moderatori possono eseguire azioni broadcaster anche senza
// avere personalmente gli scope/diritti, mantenendo l'audit corretto sui
// moderator-scoped endpoint (ban/timeout/chat-settings/shoutout) che continuano
// invece a usare il token del moderatore.
export const MOD_BROADCASTER_TOKEN_KEY    = 'mod:broadcaster:token';
export const MOD_BROADCASTER_SCOPES_KEY   = 'mod:broadcaster:scopes';
export const MOD_BROADCASTER_TOKEN_TS_KEY = 'mod:broadcaster:token:ts';
const MOD_SYNC_TTL = 3600; // 1 ora
// L'access token Twitch da implicit-flow dura ~60 giorni: usiamo 50 come TTL
// di sicurezza (verrà comunque ri-validato a ogni uso da getBroadcasterToken).
const BROADCASTER_TOKEN_TTL = 60 * 60 * 24 * 50;

/**
 * Recupera il nome utente del broadcaster.
 * Priorità: env BROADCASTER_USERNAME → Redis → primo in MOD_USERNAMES
 */
export async function getBroadcasterUsername(redis) {
  const explicit = (process.env.BROADCASTER_USERNAME || '').trim().toLowerCase();
  if (explicit) return explicit;
  try {
    const stored = await redis.get(MOD_BROADCASTER_KEY);
    if (stored) return String(stored).toLowerCase();
  } catch { /* continua */ }
  const raw = process.env.MOD_USERNAMES || '';
  const mods = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
  return mods[0] || null;
}

/**
 * Recupera lo user_id numerico del broadcaster da Redis.
 */
export async function getBroadcasterId(redis) {
  try {
    const id = await redis.get(MOD_BROADCASTER_ID_KEY);
    if (id) return String(id);
  } catch { /* continua */ }
  return null;
}

/**
 * Valida un token Twitch e restituisce le informazioni dell'utente.
 */
export async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.login) return null;
    return {
      login:    data.login.toLowerCase(),
      userId:   data.user_id,
      clientId: data.client_id,
      scopes:   data.scopes || [],
      token,
    };
  } catch {
    return null;
  }
}

/**
 * Sincronizza la lista dei moderatori da Twitch Helix API.
 *
 * - Se l'utente è il broadcaster: usa il suo token (autoritativo).
 * - Se l'utente è un mod e in Redis è già stato persistito un token
 *   broadcaster valido: usa quello (Helix /moderation/moderators richiede
 *   il token del broadcaster, non basta quello del mod).
 *
 * In entrambi i casi il risultato è cachato 1 ora (MOD_SYNC_TTL).
 */
export async function syncModsFromTwitch(redis, twitchUser) {
  if (!twitchUser.scopes.includes('moderation:read')) return;

  const broadcaster        = await getBroadcasterUsername(redis);
  const isBroadcaster      = broadcaster && twitchUser.login === broadcaster;
  const noBroadcasterKnown = !broadcaster;

  // Determina quale token + broadcaster_id usare per la chiamata Helix.
  let queryBroadcasterId = null;
  let queryToken         = null;
  let queryClientId      = twitchUser.clientId;

  if (isBroadcaster || noBroadcasterKnown) {
    queryBroadcasterId = twitchUser.userId;
    queryToken         = twitchUser.token;
  } else {
    // Un mod sta entrando: serve il token broadcaster persistito.
    const broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) return;
    const persisted = await getBroadcasterToken(redis);
    if (!persisted) return;
    queryBroadcasterId = broadcasterId;
    queryToken         = persisted.token;
    queryClientId      = persisted.clientId || twitchUser.clientId;
  }

  // TTL: evita di interrogare Helix a ogni request.
  try {
    const lastSync = await redis.get(MOD_SYNC_TS_KEY);
    if (lastSync && (Date.now() - Number(lastSync)) < MOD_SYNC_TTL * 1000) return;
  } catch { /* continua */ }

  try {
    const allMods = [];
    let cursor = '';
    do {
      const url = new URL('https://api.twitch.tv/helix/moderation/moderators');
      url.searchParams.set('broadcaster_id', queryBroadcasterId);
      url.searchParams.set('first', '100');
      if (cursor) url.searchParams.set('after', cursor);
      const helixRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${queryToken}`,
          'Client-Id':   queryClientId,
        },
      });
      if (!helixRes.ok) break;
      const helixData = await helixRes.json();
      allMods.push(...(helixData.data || []).map(m => m.user_login.toLowerCase()));
      cursor = helixData.pagination?.cursor || '';
    } while (cursor);

    // Solo il broadcaster (o il primo login se il broadcaster è ancora ignoto)
    // può "battezzare" i campi broadcaster username/id.
    if (isBroadcaster || noBroadcasterKnown) {
      if (noBroadcasterKnown) {
        await redis.set(MOD_BROADCASTER_KEY, twitchUser.login);
      }
      if (twitchUser.userId) {
        await redis.set(MOD_BROADCASTER_ID_KEY, twitchUser.userId);
      }
    }

    await redis.del(MOD_WHITELIST_KEY);
    const currentBroadcaster = broadcaster || (isBroadcaster || noBroadcasterKnown ? twitchUser.login : null);
    const members = [...new Set([...allMods, ...(currentBroadcaster ? [currentBroadcaster] : [])])];
    if (members.length) {
      await redis.sadd(MOD_WHITELIST_KEY, ...members);
    }
    await redis.set(MOD_SYNC_TS_KEY, String(Date.now()));
  } catch (e) {
    console.error('Mod sync Twitch fallito:', e);
  }
}

/**
 * Persiste il token OAuth del broadcaster in Redis se l'utente loggato è
 * effettivamente il broadcaster. È condizione richiesta lo scope
 * `channel:manage:broadcast`, che Twitch concede solo al proprietario del
 * canale.
 *
 * Salva: token, scope concessi, timestamp. Aggiorna anche broadcaster
 * username/id se non ancora presenti.
 *
 * Esportato perché viene chiamato sia da modAuthGate sia da mod-commands.js
 * (che è il primo endpoint hit dal Pannello Mod e quindi spesso il primo
 * trigger della persistenza del token broadcaster).
 */
export async function maybePersistBroadcasterToken(redis, twitchUser) {
  const stored = await getBroadcasterUsername(redis);
  if (stored) {
    if (twitchUser.login !== stored) return;
  } else {
    const envBroadcaster = (process.env.BROADCASTER_USERNAME || '').trim().toLowerCase();
    if (envBroadcaster) {
      if (twitchUser.login !== envBroadcaster) return;
    } else if (!twitchUser.scopes.includes('channel:manage:broadcast')) {
      return;
    }
  }

  try {
    await redis.set(MOD_BROADCASTER_TOKEN_KEY,    twitchUser.token,                  { ex: BROADCASTER_TOKEN_TTL });
    await redis.set(MOD_BROADCASTER_SCOPES_KEY,   JSON.stringify(twitchUser.scopes), { ex: BROADCASTER_TOKEN_TTL });
    await redis.set(MOD_BROADCASTER_TOKEN_TS_KEY, String(Date.now()),                { ex: BROADCASTER_TOKEN_TTL });
    if (!stored) {
      await redis.set(MOD_BROADCASTER_KEY, twitchUser.login);
    }
    if (twitchUser.userId) {
      await redis.set(MOD_BROADCASTER_ID_KEY, twitchUser.userId);
    }
  } catch (e) {
    console.error('Persistenza broadcaster token fallita:', e);
  }
}

/**
 * Recupera il token OAuth del broadcaster persistito in Redis.
 * Validato contro Twitch a ogni chiamata: se invalido viene cancellato e
 * la funzione ritorna `null`. Usa una mini-cache in-memory di 60s per
 * evitare di hitting `/oauth2/validate` ad ogni chiamata Helix dello
 * stesso cold start (Vercel mantiene il modulo caldo per qualche minuto).
 *
 * @returns {Promise<{token:string, clientId:string, scopes:string[], userId:string|null, login:string|null}|null>}
 */
let _broadcasterTokenCache = null; // { token, info, validatedAt }
const BROADCASTER_TOKEN_VALIDATE_TTL_MS = 60_000;

export async function getBroadcasterToken(redis) {
  let token = null;
  try {
    token = await redis.get(MOD_BROADCASTER_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) {
    _broadcasterTokenCache = null;
    return null;
  }
  token = String(token);

  // Mini-cache: se abbiamo validato lo stesso token negli ultimi 60s, riusa.
  if (
    _broadcasterTokenCache &&
    _broadcasterTokenCache.token === token &&
    (Date.now() - _broadcasterTokenCache.validatedAt) < BROADCASTER_TOKEN_VALIDATE_TTL_MS
  ) {
    return _broadcasterTokenCache.info;
  }

  try {
    const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (valRes.status === 401) {
      // Token genuinamente invalido: cancella tutto.
      await Promise.allSettled([
        redis.del(MOD_BROADCASTER_TOKEN_KEY),
        redis.del(MOD_BROADCASTER_SCOPES_KEY),
        redis.del(MOD_BROADCASTER_TOKEN_TS_KEY),
      ]);
      _broadcasterTokenCache = null;
      return null;
    }
    if (!valRes.ok) {
      // Errore transiente Twitch (5xx/429): non cancellare, ritorna null
      // senza cachare → al prossimo tentativo riprovamiamo.
      return null;
    }
    const data = await valRes.json();
    const info = {
      token,
      clientId: data.client_id,
      scopes:   data.scopes || [],
      userId:   data.user_id || null,
      login:    data.login?.toLowerCase() || null,
    };
    _broadcasterTokenCache = { token, info, validatedAt: Date.now() };
    return info;
  } catch {
    // Errore di rete: meglio non cancellare il token.
    return null;
  }
}

/**
 * Sceglie il token + clientId da usare per una chiamata Helix.
 *
 * Parametri:
 *   - `requireBroadcaster`: se true, ritorna le credenziali del broadcaster
 *     persistite in Redis. Se non disponibili o scadute → ritorna `null`
 *     (il chiamante deve rispondere con `broadcasterTokenMissing(res)`).
 *   - `requireScopes`: lista di scope richiesti per l'azione. Se almeno uno
 *     manca dal token scelto, viene ritornato `{missingScopes:[...], source}`.
 *     Il chiamante deve passarlo a `scopeMissing(res, missingScopes)`.
 *
 * @returns {Promise<
 *   |{token:string, clientId:string, source:'broadcaster'|'mod'}
 *   |{missingScopes:string[], source:'broadcaster'|'mod'}
 *   |null
 * >}
 */
export async function pickHelixAuth({ twitchUser, redis, requireBroadcaster, requireScopes }) {
  let auth;
  let availableScopes;
  if (requireBroadcaster) {
    const broadcaster = await getBroadcasterToken(redis);
    if (!broadcaster) return null;
    auth = {
      token:    broadcaster.token,
      clientId: broadcaster.clientId || twitchUser?.clientId,
      source:   'broadcaster',
    };
    availableScopes = broadcaster.scopes || [];
  } else {
    auth = {
      token:    twitchUser.token,
      clientId: twitchUser.clientId,
      source:   'mod',
    };
    availableScopes = twitchUser.scopes || [];
  }

  if (Array.isArray(requireScopes) && requireScopes.length) {
    const missing = requireScopes.filter(s => !availableScopes.includes(s));
    if (missing.length) {
      return { missingScopes: missing, source: auth.source };
    }
  }

  return auth;
}

/**
 * Predicate: true se l'utente ha TUTTI gli scope richiesti.
 */
export function hasScopes(twitchUser, scopes) {
  if (!twitchUser?.scopes || !Array.isArray(scopes)) return false;
  return scopes.every(s => twitchUser.scopes.includes(s));
}

/**
 * Risposta standard quando il token (mod o broadcaster) non ha gli scope
 * necessari per l'azione. HTTP 403 + `code:'scope_missing'` +
 * `requiredScopes` + `tokenSource` ('mod'|'broadcaster') così il frontend
 * può chiedere la riautenticazione corretta.
 */
export function scopeMissing(res, missingScopes, tokenSource = 'mod') {
  const list = Array.isArray(missingScopes) ? missingScopes : [missingScopes];
  const human = tokenSource === 'broadcaster'
    ? 'Andryx deve riautenticarsi al Mod Panel concedendo i permessi mancanti.'
    : 'Devi riautenticarti con Twitch concedendo i permessi mancanti.';
  return res.status(403).json({
    code:           'scope_missing',
    error:          `${human} (mancano: ${list.join(', ')})`,
    message:        `${human} (mancano: ${list.join(', ')})`,
    requiredScopes: list,
    tokenSource,
  });
}

/**
 * Risposta standard quando un mod tenta un'azione che richiede il token del
 * broadcaster ma in Redis non c'è (mai persistito o scaduto).
 *
 * Restituisce HTTP 503 con `code: 'broadcaster_token_missing'` (così il
 * frontend può intercettarlo programmaticamente) e un messaggio italiano
 * amichevole nel campo `error` (compatibile con i componenti esistenti che
 * leggono `data.error`).
 */
export function broadcasterTokenMissing(res) {
  return res.status(503).json({
    code:    'broadcaster_token_missing',
    error:   'Andryx deve aprire una volta il Mod Panel per autorizzare le azioni broadcaster.',
    message: 'Andryx deve aprire una volta il Mod Panel per autorizzare le azioni broadcaster.',
  });
}

/**
 * Verifica se un utente è moderatore (broadcaster > env > cache Redis).
 */
export async function isUserMod(redis, login) {
  const broadcaster = await getBroadcasterUsername(redis);
  if (broadcaster && login === broadcaster) return true;
  const raw = process.env.MOD_USERNAMES || '';
  const envMods = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
  if (envMods.includes(login)) return true;
  const inWhitelist = await redis.sismember(MOD_WHITELIST_KEY, login);
  return !!inWhitelist;
}

/** Helper per una GET Helix senza paginazione. */
export async function helixGet(path, params, token, clientId) {
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id':   clientId,
    },
  });
  if (!res.ok) {
    throw await buildHelixError('GET', path, res);
  }
  return res.json();
}

/** Helper per una POST Helix (o PATCH/DELETE). */
export async function helixRequest(method, path, body, token, clientId) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Client-Id':    clientId,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw await buildHelixError(method, path, res);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Costruisce un Error arricchito con le informazioni Helix:
 *   err.status   → HTTP status (401, 403, 422…)
 *   err.helix    → oggetto JSON Twitch parsato (se disponibile)
 *   err.path     → endpoint Helix richiamato
 *   err.message  → messaggio italiano leggibile
 *
 * In questo modo i mod-*.js endpoint possono distinguere "scope mancante" da
 * "rate-limit" e propagare un errore comprensibile al frontend.
 */
async function buildHelixError(method, path, res) {
  let parsed = null;
  let raw    = '';
  try { raw = await res.text(); } catch { /* ignore */ }
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
  }
  const helixMsg = parsed?.message || parsed?.error || raw || res.statusText;
  let friendly;
  if (res.status === 401) {
    friendly = `Token Twitch non valido o scaduto (${helixMsg}).`;
  } else if (res.status === 403) {
    friendly = `Permessi Twitch insufficienti per l'azione richiesta (${helixMsg}).`;
  } else if (res.status === 429) {
    friendly = `Twitch ha applicato un rate-limit, riprova tra poco.`;
  } else {
    friendly = `Twitch ha rifiutato la richiesta (${res.status}): ${helixMsg}`;
  }
  const err = new Error(friendly);
  err.status = res.status;
  err.helix  = parsed;
  err.path   = path;
  err.method = method;
  return err;
}

/** Headers CORS standard per le API mod. */
export function corsHeaders(res, methods = 'GET, POST, PATCH, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Gate di autenticazione condiviso: valida token, sync mod, controlla accesso. */
export async function modAuthGate(req, redis) {
  const twitchUser = await validateTwitch(req.headers.authorization);
  if (twitchUser) {
    // Persisti il token del broadcaster (no-op se l'utente non è il broadcaster).
    try { await maybePersistBroadcasterToken(redis, twitchUser); } catch { /* non bloccante */ }
    try { await syncModsFromTwitch(redis, twitchUser); } catch { /* non bloccante */ }
  }
  const isMod = twitchUser ? await isUserMod(redis, twitchUser.login) : false;
  return { twitchUser, isMod };
}

/**
 * Gate "tutto-in-uno" usato dagli endpoint mod-*.js per ridurre il boilerplate
 * e garantire che ogni endpoint applichi i controlli di permessi corretti.
 *
 * Esegue:
 *   1. modAuthGate (valida token, sync mod, persisti broadcaster token)
 *   2. risposta 401 se token mancante/invalido
 *   3. risposta 403 se utente non è mod
 *   4. opzionalmente: ritorna `auth` (mod o broadcaster) se `requireBroadcaster`
 *      o `requireScopes` sono specificati.
 *      - Se broadcaster token non disponibile → 503 broadcaster_token_missing
 *      - Se mancano scope sul token scelto → 403 scope_missing
 *
 * Ritorna:
 *   - `null` se la risposta è già stata inviata (errore / accesso negato).
 *     Il chiamante deve fare `if (!gated) return;`.
 *   - `{twitchUser, isMod, broadcasterId, auth}` in caso di successo.
 *
 * @example
 *   const g = await ensureModAccess(req, res, redis, {
 *     requireBroadcaster: true,
 *     requireScopes: ['channel:manage:broadcast'],
 *   });
 *   if (!g) return;
 *   const { auth, broadcasterId } = g;
 *   await helixRequest('PATCH', `channels?broadcaster_id=${broadcasterId}`, body, auth.token, auth.clientId);
 */
export async function ensureModAccess(req, res, redis, opts = {}) {
  const { requireBroadcaster = false, requireScopes = null, requireBroadcasterId = true } = opts;
  const { twitchUser, isMod } = await modAuthGate(req, redis);

  if (!twitchUser) {
    res.status(401).json({ code: 'unauthenticated', error: 'Token Twitch mancante o non valido.' });
    return null;
  }
  if (!isMod) {
    res.status(403).json({ code: 'not_mod', error: 'Accesso riservato ai moderatori.' });
    return null;
  }

  let broadcasterId = null;
  if (requireBroadcasterId) {
    broadcasterId = await getBroadcasterId(redis);
    if (!broadcasterId) {
      res.status(503).json({
        code: 'broadcaster_id_missing',
        error: 'Broadcaster ID non disponibile. Andryx deve aprire una volta il Mod Panel.',
      });
      return null;
    }
  }

  let auth = null;
  if (requireBroadcaster || (requireScopes && requireScopes.length)) {
    auth = await pickHelixAuth({ twitchUser, redis, requireBroadcaster, requireScopes });
    if (!auth) {
      broadcasterTokenMissing(res);
      return null;
    }
    if (auth.missingScopes) {
      scopeMissing(res, auth.missingScopes, auth.source);
      return null;
    }
  }

  return { twitchUser, isMod, broadcasterId, auth };
}

/**
 * Convertitore standard di un errore Helix (lanciato da helixGet/helixRequest)
 * in una risposta HTTP coerente. Propaga lo stato originale (401/403/429/422)
 * con un payload utile al frontend invece di restituire sempre 500.
 *
 * Particolarmente utile per intercettare 401/403 da Twitch e farli risalire
 * come "scope_missing" o "broadcaster_token_invalid" invece di un opaco 500.
 *
 * @example
 *   try {
 *     await helixRequest(...);
 *   } catch (e) {
 *     return sendHelixError(res, e, 'cambiare il titolo');
 *   }
 */
export function sendHelixError(res, e, azione = 'eseguire l\'azione') {
  const status   = e?.status || 500;
  const helix    = e?.helix || null;
  const path     = e?.path || null;
  const baseBody = { error: e?.message || `Errore durante: ${azione}.`, helix, path, twitchStatus: status };

  if (status === 401) {
    return res.status(401).json({ ...baseBody, code: 'twitch_unauthorized' });
  }
  if (status === 403) {
    // 403 da Twitch può significare: scope mancanti, mod non autorizzato,
    // azione non consentita per questo utente sul canale.
    return res.status(403).json({ ...baseBody, code: 'twitch_forbidden' });
  }
  if (status === 429) {
    return res.status(429).json({ ...baseBody, code: 'twitch_rate_limited' });
  }
  if (status === 422) {
    return res.status(422).json({ ...baseBody, code: 'twitch_unprocessable' });
  }
  if (status >= 500) {
    return res.status(502).json({ ...baseBody, code: 'twitch_upstream_error' });
  }
  return res.status(status).json({ ...baseBody, code: 'twitch_error' });
}

/**
 * Forza il refresh della whitelist dei moderatori da Twitch.
 * Cancella il TTL e richiama syncModsFromTwitch; usato dal pulsante
 * "Aggiorna lista mod" della Diagnostica.
 */
export async function forceSyncMods(redis, twitchUser) {
  try { await redis.del(MOD_SYNC_TS_KEY); } catch { /* ignore */ }
  await syncModsFromTwitch(redis, twitchUser);
}

/**
 * Diagnostica completa dello stato auth, usata da /api/mod-commands per
 * popolare la card "Diagnostica" del Pannello Mod. Consente al mod di
 * capire al volo perché un'azione fallisce.
 */
export async function getAuthDiagnostics(redis, twitchUser) {
  const broadcaster = await getBroadcasterToken(redis);
  const broadcasterUsername = await getBroadcasterUsername(redis);
  const broadcasterId       = await getBroadcasterId(redis);
  let lastSync = null;
  try { lastSync = Number(await redis.get(MOD_SYNC_TS_KEY)) || null; } catch { /* */ }
  let modCount = 0;
  try { modCount = (await redis.scard(MOD_WHITELIST_KEY)) || 0; } catch { /* */ }
  let broadcasterTokenAgeMs = null;
  try {
    const ts = await redis.get(MOD_BROADCASTER_TOKEN_TS_KEY);
    if (ts) broadcasterTokenAgeMs = Date.now() - Number(ts);
  } catch { /* */ }

  return {
    me: twitchUser ? {
      login:  twitchUser.login,
      userId: twitchUser.userId,
      scopes: twitchUser.scopes || [],
    } : null,
    broadcaster: {
      username:   broadcasterUsername,
      userId:     broadcasterId,
      tokenStored: !!broadcaster,
      tokenScopes: broadcaster?.scopes || [],
      tokenLogin:  broadcaster?.login || null,
      tokenAgeMs:  broadcasterTokenAgeMs,
    },
    modWhitelist: {
      count:    modCount,
      lastSyncTs: lastSync,
    },
  };
}
