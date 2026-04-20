/**
 * _botHelix.js — Helper per invio messaggi via Twitch Helix API e gestione token bot.
 *
 * Funzioni esportate:
 *   refreshBotToken(redis)         → rinnova access token con il refresh token
 *   ottieniTokenBot(redis)         → legge il token (rinnova automaticamente se in scadenza)
 *   ottieniAppToken(redis)         → app access token (client credentials) per EventSub
 *   inviaMessaggioChat(redis, broadcasterId, testo) → POST Helix con auto-refresh su 401
 *   aggiungiLog(redis, tipo, msg)  → appende voce al log bot (ultimi 50)
 */

const HELIX_CHAT_URL = 'https://api.twitch.tv/helix/chat/messages';
const HELIX_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

const BOT_TOKEN_KEY     = 'bot:token:access';
const BOT_REFRESH_KEY   = 'bot:token:refresh';
const BOT_EXPIRES_KEY   = 'bot:token:expires_at';
const BOT_USER_ID_KEY   = 'bot:user:id';
const APP_TOKEN_KEY     = 'bot:app:token:access';
const APP_TOKEN_EXP_KEY = 'bot:app:token:expires_at';

/** Rinnova l'access token del bot usando il refresh token salvato in Redis. */
export async function refreshBotToken(redis) {
  const refreshToken = await redis.get(BOT_REFRESH_KEY);
  if (!refreshToken) throw new Error('Nessun refresh token trovato. Autorizza prima il bot tramite il Mod Panel.');

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CHIAVETWITCH_CLIENT_ID / CHIAVETWITCH_CLIENT_SECRET non configurati.');
  }

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'refresh_token',
    refresh_token: String(refreshToken),
  });

  const res = await fetch(HELIX_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Refresh token bot fallito: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const scadeAt = Date.now() + (data.expires_in || 14400) * 1000;

  await Promise.all([
    redis.set(BOT_TOKEN_KEY,   data.access_token),
    redis.set(BOT_REFRESH_KEY, data.refresh_token),
    redis.set(BOT_EXPIRES_KEY, String(scadeAt)),
  ]);

  return data.access_token;
}

/**
 * Ottieni il token del bot da Redis.
 * Se scade entro 5 minuti, rinnova automaticamente.
 */
export async function ottieniTokenBot(redis) {
  const [token, scadeAtRaw] = await Promise.all([
    redis.get(BOT_TOKEN_KEY),
    redis.get(BOT_EXPIRES_KEY),
  ]);

  if (!token) throw new Error('Token bot non trovato. Autorizza il bot dal Mod Panel → Bot 24/7.');

  const scadeAt = scadeAtRaw ? Number(scadeAtRaw) : 0;
  if (scadeAt - Date.now() < 5 * 60 * 1000) {
    return refreshBotToken(redis);
  }

  return String(token);
}

/**
 * Ottieni un app access token (client credentials).
 * Usato per creare/gestire le sottoscrizioni EventSub.
 */
export async function ottieniAppToken(redis) {
  const [token, scadeAtRaw] = await Promise.all([
    redis.get(APP_TOKEN_KEY),
    redis.get(APP_TOKEN_EXP_KEY),
  ]);

  const scadeAt = scadeAtRaw ? Number(scadeAtRaw) : 0;
  if (token && scadeAt - Date.now() > 5 * 60 * 1000) {
    return String(token);
  }

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CHIAVETWITCH_CLIENT_ID / CHIAVETWITCH_CLIENT_SECRET non configurati.');
  }

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'client_credentials',
  });

  const res = await fetch(HELIX_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`App token fallito: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const nuovaScadenza = Date.now() + (data.expires_in || 14400) * 1000;

  await Promise.all([
    redis.set(APP_TOKEN_KEY,     data.access_token),
    redis.set(APP_TOKEN_EXP_KEY, String(nuovaScadenza)),
  ]);

  return data.access_token;
}

/**
 * Invia un messaggio nella chat Twitch tramite Helix API.
 * Auto-rinnova il token bot se riceve 401.
 *
 * @param {object} redis          - istanza @upstash/redis
 * @param {string} broadcasterId  - user_id del broadcaster (canale destinazione)
 * @param {string} testo          - testo del messaggio (max 500 caratteri)
 */
export async function inviaMessaggioChat(redis, broadcasterId, testo) {
  const clientId = process.env.CHIAVETWITCH_CLIENT_ID;
  if (!clientId) throw new Error('CHIAVETWITCH_CLIENT_ID non configurato.');

  const botUserId = await redis.get(BOT_USER_ID_KEY);
  if (!botUserId) throw new Error('ID utente bot non trovato. Autorizza il bot dal Mod Panel.');

  async function tentaInvio(token) {
    return fetch(HELIX_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Client-Id':    clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        broadcaster_id: String(broadcasterId),
        sender_id:      String(botUserId),
        message:        testo.slice(0, 500),
      }),
    });
  }

  let token = await ottieniTokenBot(redis);
  let res   = await tentaInvio(token);

  // Token scaduto: forza rinnovo e riprova
  if (res.status === 401) {
    token = await refreshBotToken(redis);
    res   = await tentaInvio(token);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Invio messaggio fallito: ${res.status} — ${errText}`);
  }

  return res.json();
}

/**
 * Aggiunge una voce al log del bot in Redis.
 * La lista è mantenuta agli ultimi 50 elementi.
 */
export async function aggiungiLog(redis, tipo, messaggio) {
  const entry = JSON.stringify({ tipo, messaggio, ts: new Date().toISOString() });
  await redis.rpush('bot:log', entry);
  await redis.ltrim('bot:log', -50, -1);
}
