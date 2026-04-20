import { Redis } from '@upstash/redis';

/**
 * Emotes API — Emote Twitch + 7TV del canale ANDRYXify
 *
 * Recupera le emote del canale + emote globali dall'API Twitch Helix
 * e dall'API pubblica 7TV (https://7tv.io/v3). Cache in Redis per 2 ore.
 *
 * Le emote 7TV supportano formati animati (WebP animato) — il browser le
 * renderizza nativamente con il tag <img>.
 *
 * Redis data model:
 *   emotes:canale         → JSON string (emote Twitch del canale, TTL 2h)
 *   emotes:globali        → JSON string (emote Twitch globali, TTL 2h)
 *   emotes:7tv:canale     → JSON string (emote 7TV del canale, TTL 2h)
 *   emotes:7tv:globali    → JSON string (emote 7TV globali, TTL 2h)
 *   emotes:broadcaster_id → String (ID numerico del broadcaster, TTL 24h)
 *
 * GET /api/emotes
 *   Header: Authorization: Bearer <twitchToken> (necessario per Helix API)
 *   Returns: {
 *     canale, globali,                          // emote Twitch (retrocompatibile)
 *     seventv: { canale, globali },             // emote 7TV
 *     daCache: boolean,
 *   }
 *
 * Schema emote unificato: { id, nome, url, url2x, url4x, animata, provider, tipo }
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
    const [cachedCanale, cachedGlobali, cached7tvCanale, cached7tvGlobali] = await Promise.all([
      redis.get('emotes:canale'),
      redis.get('emotes:globali'),
      redis.get('emotes:7tv:canale'),
      redis.get('emotes:7tv:globali'),
    ]);

    // Riteniamo la cache valida se almeno le Twitch sono presenti.
    // Le 7TV vengono integrate quando disponibili (best-effort).
    if (cachedCanale && cachedGlobali) {
      const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);
      return res.status(200).json({
        canale:  parse(cachedCanale),
        globali: parse(cachedGlobali),
        seventv: {
          canale:  cached7tvCanale  ? parse(cached7tvCanale)  : [],
          globali: cached7tvGlobali ? parse(cached7tvGlobali) : [],
        },
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

  /* ─── Recupera emote canale + globali Twitch + 7TV in parallelo ─── */
  let emoteCanale = [];
  let emoteGlobali = [];
  let emote7tvCanale = [];
  let emote7tvGlobali = [];

  try {
    const [canaleRes, globaliRes, sevenTvCanaleData, sevenTvGlobaliData] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${broadcasterId}`, { headers: helixHeaders }),
      fetch('https://api.twitch.tv/helix/chat/emotes/global', { headers: helixHeaders }),
      fetch7tvUserEmotes(broadcasterId),
      fetch7tvGlobalEmotes(),
    ]);

    if (canaleRes.ok) {
      const canaleData = await canaleRes.json();
      emoteCanale = (canaleData.data || []).map(e => ({
        id: `twitch-${e.id}`,
        nome: e.name,
        url: e.images?.url_1x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`,
        url2x: e.images?.url_2x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/2.0`,
        url4x: e.images?.url_4x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/3.0`,
        animata: false,
        provider: 'twitch',
        tipo: e.emote_type || 'canale',
      }));
    }

    if (globaliRes.ok) {
      const globaliData = await globaliRes.json();
      emoteGlobali = (globaliData.data || []).map(e => ({
        id: `twitch-${e.id}`,
        nome: e.name,
        url: e.images?.url_1x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`,
        url2x: e.images?.url_2x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/2.0`,
        url4x: e.images?.url_4x || `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/3.0`,
        animata: false,
        provider: 'twitch',
        tipo: 'globale',
      }));
    }

    emote7tvCanale  = sevenTvCanaleData;
    emote7tvGlobali = sevenTvGlobaliData;
  } catch (e) {
    console.error('Errore nel recupero emote:', e);
    return res.status(502).json({ error: 'Errore nel recupero delle emote.' });
  }

  /* ─── Salva in cache Redis ─── */
  try {
    await Promise.all([
      redis.set('emotes:canale',      JSON.stringify(emoteCanale),     { ex: CACHE_TTL }),
      redis.set('emotes:globali',     JSON.stringify(emoteGlobali),    { ex: CACHE_TTL }),
      redis.set('emotes:7tv:canale',  JSON.stringify(emote7tvCanale),  { ex: CACHE_TTL }),
      redis.set('emotes:7tv:globali', JSON.stringify(emote7tvGlobali), { ex: CACHE_TTL }),
    ]);
  } catch { /* best effort — la risposta prosegue comunque */ }

  return res.status(200).json({
    canale:  emoteCanale,
    globali: emoteGlobali,
    seventv: {
      canale:  emote7tvCanale,
      globali: emote7tvGlobali,
    },
    daCache: false,
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Helper 7TV — endpoint pubblici, no auth necessaria.
   In caso di errore (utente non registrato, 7TV down) restituiamo []
   per non compromettere la risposta principale (best-effort).
   ═══════════════════════════════════════════════════════════════════════ */

/** Mappa un'emote dall'API 7TV al nostro schema unificato. */
function map7tvEmote(e, tipo) {
  // 7TV restituisce due forme: oggetto wrappato (user emote_set: { id, name, data: {...} })
  // oppure direttamente la forma "data" (global). Normalizziamo.
  const data = e.data || e;
  const host = data.host || {};
  const baseUrl = host.url ? `https:${host.url}` : '';
  if (!baseUrl) return null;

  // Files disponibili per dimensione: 1x.webp, 2x.webp, 3x.webp, 4x.webp.
  // Non tutte le emote hanno tutti i tagli — fileDisponibile() controlla
  // se il file esiste tra quelli annunciati; se la lista è vuota usiamo
  // comunque il path standard (best-effort, il CDN di solito risponde).
  const files = Array.isArray(host.files) ? host.files : [];
  const fileDisponibileOFallback = (n) =>
    files.some(f => f.name === n) || files.length === 0;
  const pick = (preferito, fallback) =>
    fileDisponibileOFallback(preferito) ? preferito : fallback;

  const file1x = pick('1x.webp', '2x.webp');
  const file2x = pick('2x.webp', file1x);
  const file4x = pick('4x.webp', pick('3x.webp', file2x));

  return {
    id: `7tv-${e.id || data.id}`,
    nome: e.name || data.name,
    url:   `${baseUrl}/${file1x}`,
    url2x: `${baseUrl}/${file2x}`,
    url4x: `${baseUrl}/${file4x}`,
    animata: !!data.animated,
    provider: '7tv',
    tipo,
  };
}

async function fetch7tvUserEmotes(twitchBroadcasterId) {
  try {
    const r = await fetch(`https://7tv.io/v3/users/twitch/${twitchBroadcasterId}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const j = await r.json();
    const emotes = j?.emote_set?.emotes || [];
    return emotes.map(e => map7tvEmote(e, 'canale')).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetch7tvGlobalEmotes() {
  try {
    const r = await fetch('https://7tv.io/v3/emote-sets/global', {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const j = await r.json();
    const emotes = j?.emotes || [];
    return emotes.map(e => map7tvEmote(e, 'globale')).filter(Boolean);
  } catch {
    return [];
  }
}
