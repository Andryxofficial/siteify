import { Redis } from '@upstash/redis';

/**
 * Emotes API — Emote Twitch del canale ANDRYXify
 *
 * Recupera le emote del canale + emote globali dall'API Twitch Helix.
 * Cache in Redis per 2 ore per evitare chiamate ripetute.
 *
 * Redis data model:
 *   emotes:canale        → JSON string (emote del canale, TTL 2h)
 *   emotes:globali       → JSON string (emote globali, TTL 2h)
 *   emotes:broadcaster_id → String (ID numerico del broadcaster, TTL 24h)
 *
 * GET /api/emotes
 *   Header: Authorization: Bearer <twitchToken> (necessario per Helix API)
 *   Returns: { canale: [...], globali: [...], aggiornamento: timestamp }
 */

const CACHE_TTL = 2 * 60 * 60;       // 2 ore
const BROADCASTER_TTL = 24 * 60 * 60; // 24 ore
const BROADCASTER_LOGIN = process.env.BROADCASTER_USERNAME || 'andryxify';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non supportato.' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch {
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  /* ─── Controlla la cache Redis ─── */
  try {
    const [cachedCanale, cachedGlobali] = await Promise.all([
      redis.get('emotes:canale'),
      redis.get('emotes:globali'),
    ]);

    if (cachedCanale && cachedGlobali) {
      return res.status(200).json({
        canale: typeof cachedCanale === 'string' ? JSON.parse(cachedCanale) : cachedCanale,
        globali: typeof cachedGlobali === 'string' ? JSON.parse(cachedGlobali) : cachedGlobali,
        daCache: true,
      });
    }
  } catch { /* cache miss, procediamo con la fetch */ }

  /* ─── Valida token Twitch per chiamate Helix ─── */
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token Twitch richiesto per aggiornare la cache emote.' });
  }

  const token = authHeader.split(' ')[1];
  let clientId;
  try {
    const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!valRes.ok) return res.status(401).json({ error: 'Token Twitch non valido.' });
    const valData = await valRes.json();
    clientId = valData.client_id;
    if (!clientId) return res.status(401).json({ error: 'Token Twitch incompleto.' });
  } catch {
    return res.status(500).json({ error: 'Errore nella validazione del token.' });
  }

  const helixHeaders = { Authorization: `Bearer ${token}`, 'Client-Id': clientId };

  /* ─── Ottieni broadcaster_id (cache 24h) ─── */
  let broadcasterId;
  try {
    broadcasterId = await redis.get('emotes:broadcaster_id');
  } catch { /* ignora */ }

  if (!broadcasterId) {
    try {
      const userRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${BROADCASTER_LOGIN}`,
        { headers: helixHeaders },
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        broadcasterId = userData.data?.[0]?.id;
        if (broadcasterId) {
          await redis.set('emotes:broadcaster_id', broadcasterId, { ex: BROADCASTER_TTL });
        }
      }
    } catch { /* ignora */ }
  }

  if (!broadcasterId) {
    return res.status(502).json({ error: 'Impossibile recuperare il broadcaster ID.' });
  }

  /* ─── Recupera emote canale + globali in parallelo ─── */
  let emoteCanale = [];
  let emoteGlobali = [];

  try {
    const [canaleRes, globaliRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${broadcasterId}`, { headers: helixHeaders }),
      fetch('https://api.twitch.tv/helix/chat/emotes/global', { headers: helixHeaders }),
    ]);

    if (canaleRes.ok) {
      const canaleData = await canaleRes.json();
      emoteCanale = (canaleData.data || []).map(e => ({
        id: e.id,
        nome: e.name,
        url: e.images?.url_1x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`,
        url2x: e.images?.url_2x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/2.0`,
        url4x: e.images?.url_4x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/3.0`,
        tipo: e.emote_type || 'canale',
      }));
    }

    if (globaliRes.ok) {
      const globaliData = await globaliRes.json();
      emoteGlobali = (globaliData.data || []).map(e => ({
        id: e.id,
        nome: e.name,
        url: e.images?.url_1x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`,
        url2x: e.images?.url_2x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/2.0`,
        url4x: e.images?.url_4x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/3.0`,
        tipo: 'globale',
      }));
    }
  } catch (e) {
    console.error('Errore nel recupero emote Twitch:', e);
    return res.status(502).json({ error: 'Errore nel recupero delle emote da Twitch.' });
  }

  /* ─── Salva in cache Redis ─── */
  try {
    await Promise.all([
      redis.set('emotes:canale', JSON.stringify(emoteCanale), { ex: CACHE_TTL }),
      redis.set('emotes:globali', JSON.stringify(emoteGlobali), { ex: CACHE_TTL }),
    ]);
  } catch { /* best effort — la risposta prosegue comunque */ }

  return res.status(200).json({
    canale: emoteCanale,
    globali: emoteGlobali,
    daCache: false,
  });
}
