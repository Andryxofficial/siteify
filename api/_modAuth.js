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
const MOD_SYNC_TTL = 3600; // 1 ora

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
 * Eseguita solo dal broadcaster; risultato cachato 1 ora.
 */
export async function syncModsFromTwitch(redis, twitchUser) {
  if (!twitchUser.scopes.includes('moderation:read')) return;
  const broadcaster = await getBroadcasterUsername(redis);
  const isKnownBroadcaster = broadcaster && twitchUser.login === broadcaster;
  const noBroadcasterKnown = !broadcaster;
  if (broadcaster && !isKnownBroadcaster) return;
  if (isKnownBroadcaster) {
    const lastSync = await redis.get(MOD_SYNC_TS_KEY);
    if (lastSync && (Date.now() - Number(lastSync)) < MOD_SYNC_TTL * 1000) return;
  }
  try {
    const allMods = [];
    let cursor = '';
    do {
      const url = new URL('https://api.twitch.tv/helix/moderation/moderators');
      url.searchParams.set('broadcaster_id', twitchUser.userId);
      url.searchParams.set('first', '100');
      if (cursor) url.searchParams.set('after', cursor);
      const helixRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${twitchUser.token}`,
          'Client-Id':   twitchUser.clientId,
        },
      });
      if (!helixRes.ok) break;
      const helixData = await helixRes.json();
      allMods.push(...(helixData.data || []).map(m => m.user_login.toLowerCase()));
      cursor = helixData.pagination?.cursor || '';
    } while (cursor);

    if (noBroadcasterKnown) {
      await redis.set(MOD_BROADCASTER_KEY, twitchUser.login);
    }
    // Salva anche l'user_id del broadcaster
    await redis.set(MOD_BROADCASTER_ID_KEY, twitchUser.userId);

    await redis.del(MOD_WHITELIST_KEY);
    const currentBroadcaster = broadcaster || twitchUser.login;
    const members = [...new Set([...allMods, currentBroadcaster])];
    await redis.sadd(MOD_WHITELIST_KEY, ...members);
    await redis.set(MOD_SYNC_TS_KEY, String(Date.now()));
  } catch (e) {
    console.error('Mod sync Twitch fallito:', e);
  }
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
    const errText = await res.text();
    throw new Error(`Helix GET /${path} → ${res.status}: ${errText}`);
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
    const errText = await res.text();
    throw new Error(`Helix ${method} /${path} → ${res.status}: ${errText}`);
  }
  if (res.status === 204) return null;
  return res.json();
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
    try { await syncModsFromTwitch(redis, twitchUser); } catch { /* non bloccante */ }
  }
  const isMod = twitchUser ? await isUserMod(redis, twitchUser.login) : false;
  return { twitchUser, isMod };
}
