import { Redis } from '@upstash/redis';
import { GENERAL_KEY, getMonthlyKey, getCurrentSeason, getLevel } from './social-leaderboard.js';

/**
 * User Export API — esporta tutti i dati social dell'utente in un JSON scaricabile
 *
 * GET /api/user-export
 *   Richiede: Authorization: Bearer <twitch_token>
 *   Risponde: JSON con tutti i dati dell'utente (post, risposte, amici, XP, profilo, preferiti)
 *
 * Dati inclusi:
 *   - Profilo (bio, sociali, impostazioni privacy)
 *   - Post pubblicati (titolo, corpo, categoria, media, like, risposte, data)
 *   - Risposte scritte (corpo, media, riferimento post, data)
 *   - Post preferiti (ID + titolo + autore)
 *   - Lista amici
 *   - Statistiche XP (totale, livello, mese corrente)
 */

export const config = { maxDuration: 25 };

const MAX_POST_EXPORT   = 500;
const MAX_REPLY_EXPORT  = 500;
const MAX_FAV_DETAIL    = 200; // post preferiti di cui recuperare i dettagli

function sanitize(str, maxLen = 5000) {
  if (typeof str !== 'string') return str;
  return str.slice(0, maxLen);
}

async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.login) return null;

  const clientId = data.client_id;
  let avatar = null;
  let displayName = data.login;
  try {
    const profileRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
    });
    if (profileRes.ok) {
      const pd = await profileRes.json();
      const u = pd.data?.[0];
      if (u) {
        avatar = u.profile_image_url || null;
        displayName = u.display_name || data.login;
      }
    }
  } catch { /* best effort */ }

  return { login: data.login, avatar, displayName };
}

function isoData(ts) {
  const n = Number(ts);
  if (!n || isNaN(n)) return null;
  return new Date(n).toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const twitchUser = await validateTwitch(req.headers.authorization);
  if (!twitchUser) {
    return res.status(401).json({ error: 'Accedi con Twitch per esportare i tuoi dati.' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  const redis = new Redis({ url: kvUrl, token: kvToken });
  const me    = twitchUser.login;
  const ora   = new Date().toISOString();

  try {
    /* ── Fetch parallelo dei dati base ── */
    const stagione = getCurrentSeason();

    const [
      profiloRaw,
      postIds,
      replyIds,
      favSet,
      amiciSet,
      xpGenerale,
      xpMese,
    ] = await Promise.all([
      redis.hgetall(`profile:${me}`),
      redis.zrange(`community:user:${me}`, 0, MAX_POST_EXPORT - 1, { rev: true }),
      redis.zrange(`community:user-replies:${me}`, 0, MAX_REPLY_EXPORT - 1, { rev: true }),
      redis.smembers(`favorites:${me}`),
      redis.smembers(`friends:${me}`),
      redis.zscore(GENERAL_KEY, me),
      redis.zscore(getMonthlyKey(stagione), me),
    ]);

    /* ── Fetch dati post ── */
    const postsRaw = postIds?.length
      ? await Promise.all(postIds.map(id => redis.hgetall(`community:post:${id}`)))
      : [];

    /* ── Fetch dati risposte ── */
    const risposteRaw = replyIds?.length
      ? await Promise.all(replyIds.map(id => redis.hgetall(`community:reply:${id}`)))
      : [];

    /* ── Fetch dettagli preferiti (titolo + autore) ── */
    const favIds = (favSet || []).slice(0, MAX_FAV_DETAIL);
    const favRaw = favIds.length
      ? await Promise.all(favIds.map(id => redis.hgetall(`community:post:${id}`)))
      : [];

    /* ── Calcola livello XP ── */
    const xpTotale = Number(xpGenerale || 0);
    const livello  = getLevel(xpTotale);

    /* ── Costruisce JSON export ── */
    const esportazione = {
      versione:    '2',
      esportatoIl: ora,
      nota:        'Esportazione dati SOCIALify — ANDRYXify. Conserva questo file in modo sicuro.',

      utente: {
        username:    me,
        displayName: twitchUser.displayName,
        avatar:      twitchUser.avatar,
        profilo: profiloRaw ? {
          bio:                  sanitize(profiloRaw.bio || ''),
          sociali:              (() => { try { return JSON.parse(profiloRaw.socials || '{}'); } catch { return {}; } })(),
          richiesteAmiciziaAperte: profiloRaw.friendRequestsOpen === 'true',
          visibilitaProfilo:    profiloRaw.profileVisibility || 'public',
          tema:                 profiloRaw.theme || 'default',
          aggiornato:           isoData(profiloRaw.updatedAt),
        } : null,
      },

      xp: {
        totale:           xpTotale,
        livello:          livello.level,
        livelloLabel:     livello.label,
        livelloEmoji:     livello.emoji,
        meseCorrente:     stagione,
        xpMeseCorrente:   Number(xpMese || 0),
      },

      post: postsRaw
        .filter(Boolean)
        .map(p => ({
          id:           p.id,
          titolo:       sanitize(p.title || ''),
          corpo:        sanitize(p.body || '', 10000),
          categoria:    p.tag || '',
          haMedia:      !!(p.mediaId || p.mediaUrl),
          tipoMedia:    p.mediaType || null,
          miPiace:      Number(p.likeCount || 0),
          risposte:     Number(p.replyCount || 0),
          creatoIl:     isoData(p.createdAt),
        })),

      risposte: risposteRaw
        .filter(Boolean)
        .map(r => ({
          id:        r.id,
          postId:    r.postId,
          corpo:     sanitize(r.body || '', 5000),
          haMedia:   !!(r.mediaId),
          tipoMedia: r.mediaType || null,
          creatoIl:  isoData(r.createdAt),
        })),

      preferiti: favRaw
        .filter(Boolean)
        .map(p => ({
          id:       p.id,
          titolo:   sanitize(p.title || ''),
          autore:   p.author || '',
          categoria: p.tag || '',
          creatoIl: isoData(p.createdAt),
        })),

      amici: (amiciSet || []).sort(),

      statistiche: {
        totalePost:     postsRaw.filter(Boolean).length,
        totaleRisposte: risposteRaw.filter(Boolean).length,
        totalePreferiti: favRaw.filter(Boolean).length,
        totaleAmici:    (amiciSet || []).length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(esportazione);

  } catch (err) {
    console.error('[user-export] errore:', err);
    return res.status(500).json({ error: 'Errore durante la raccolta dei dati. Riprova tra poco.' });
  }
}
