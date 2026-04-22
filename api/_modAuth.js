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
 */
async function maybePersistBroadcasterToken(redis, twitchUser) {
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
 * la funzione ritorna `null`.
 *
 * @returns {Promise<{token:string, clientId:string, scopes:string[], userId:string|null, login:string|null}|null>}
 */
export async function getBroadcasterToken(redis) {
  let token = null;
  try {
    token = await redis.get(MOD_BROADCASTER_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  token = String(token);

  try {
    const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!valRes.ok) {
      await Promise.allSettled([
        redis.del(MOD_BROADCASTER_TOKEN_KEY),
        redis.del(MOD_BROADCASTER_SCOPES_KEY),
        redis.del(MOD_BROADCASTER_TOKEN_TS_KEY),
      ]);
      return null;
    }
    const data = await valRes.json();
    return {
      token,
      clientId: data.client_id,
      scopes:   data.scopes || [],
      userId:   data.user_id || null,
      login:    data.login?.toLowerCase() || null,
    };
  } catch {
    // Errore di rete: meglio non cancellare il token.
    return null;
  }
}

/**
 * Sceglie il token + clientId da usare per una chiamata Helix.
 *
 * - Se `requireBroadcaster` è true: ritorna le credenziali del broadcaster
 *   persistite in Redis. Se non disponibili o scadute → ritorna `null`
 *   (il chiamante deve rispondere con `broadcasterTokenMissing(res)`).
 * - Altrimenti: ritorna le credenziali del moderatore loggato.
 *
 * @returns {Promise<{token:string, clientId:string, source:'broadcaster'|'mod'}|null>}
 */
export async function pickHelixAuth({ twitchUser, redis, requireBroadcaster }) {
  if (requireBroadcaster) {
    const broadcaster = await getBroadcasterToken(redis);
    if (!broadcaster) return null;
    return {
      token:    broadcaster.token,
      clientId: broadcaster.clientId || twitchUser?.clientId,
      source:   'broadcaster',
    };
  }
  return {
    token:    twitchUser.token,
    clientId: twitchUser.clientId,
    source:   'mod',
  };
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
