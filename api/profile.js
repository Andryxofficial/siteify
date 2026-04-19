import { Redis } from '@upstash/redis';

/**
 * Profile API — Profilo utente per ANDRYXify
 *
 * Redis data model:
 *   profile:<username> → Hash {
 *     bio,                  // max 300 chars
 *     socials,              // JSON: { twitch, youtube, instagram, tiktok, twitter, discord, spotify, website }
 *     friendRequestsOpen,   // "true" | "false"
 *     profileVisibility,    // "public" | "friends" | "private"
 *     theme,                // "default" | "magenta" | "cyan" | "amber" | "emerald"
 *     updatedAt             // timestamp
 *   }
 *
 * GET    /api/profile?user=<username>   → visualizza profilo (pubblico o con auth)
 * POST   /api/profile { action: "update", bio, socials, ... } → aggiorna il proprio profilo
 */

const MAX_BIO_LENGTH = 300;
const MAX_SOCIAL_LENGTH = 200;
const ALLOWED_SOCIAL_KEYS = ['twitch', 'youtube', 'instagram', 'tiktok', 'twitter', 'discord', 'spotify', 'website'];
const ALLOWED_VISIBILITY = ['public', 'friends', 'private'];
const ALLOWED_THEMES = ['default', 'magenta', 'cyan', 'amber', 'emerald'];

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

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

  /* ─── GET: visualizza profilo utente ─── */
  if (req.method === 'GET') {
    try {
      const targetUser = req.query?.user;
      if (!targetUser) {
        return res.status(400).json({ error: 'Parametro "user" richiesto.' });
      }

      const username = sanitize(targetUser, 50).toLowerCase();
      if (!username) {
        return res.status(400).json({ error: 'Username non valido.' });
      }

      // Recupera il profilo
      const profileData = await redis.hgetall(`profile:${username}`);
      const profile = profileData || {};

      const visibility = profile.profileVisibility || 'public';

      // Determina l'identità del richiedente (se autenticato)
      const twitchUser = await validateTwitch(req.headers.authorization);
      const requester = twitchUser?.login || null;
      const isOwnProfile = requester === username;

      // Controlla la visibilità
      if (visibility === 'private' && !isOwnProfile) {
        return res.status(403).json({ error: 'Questo profilo è privato.' });
      }

      if (visibility === 'friends' && !isOwnProfile) {
        if (!requester) {
          return res.status(403).json({ error: 'Profilo visibile solo agli amici. Effettua il login.' });
        }
        const isFriend = await redis.sismember(`friends:${username}`, requester);
        if (!isFriend) {
          return res.status(403).json({ error: 'Profilo visibile solo agli amici.' });
        }
      }

      // Recupera statistiche
      const now = new Date();
      const season = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [posts, friendCount, scoreGeneral, scoreMonthly] = await Promise.all([
        redis.zcard(`community:user:${username}`).catch(() => 0),
        redis.scard(`friends:${username}`).catch(() => 0),
        redis.zscore('lb:general', username).catch(() => null),
        redis.zscore(`lb:${season}:monthly`, username).catch(() => null),
      ]);

      // Parsa i socials se presenti
      let socials = {};
      if (profile.socials) {
        try {
          socials = typeof profile.socials === 'string' ? JSON.parse(profile.socials) : profile.socials;
        } catch {
          socials = {};
        }
      }

      return res.status(200).json({
        profile: {
          bio: profile.bio || '',
          socials,
          friendRequestsOpen: profile.friendRequestsOpen !== 'false',
          profileVisibility: visibility,
          theme: profile.theme || 'default',
          updatedAt: profile.updatedAt ? Number(profile.updatedAt) : null,
        },
        stats: {
          posts: posts || 0,
          friends: friendCount || 0,
          scoreGeneral: scoreGeneral ? Number(scoreGeneral) : null,
          scoreMonthly: scoreMonthly ? Number(scoreMonthly) : null,
        },
        isOwnProfile,
      });
    } catch (e) {
      console.error('Profile GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento del profilo.' });
    }
  }

  /* ─── POST: aggiorna profilo ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) {
      return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });
    }

    try {
      const { action, bio, socials, friendRequestsOpen, profileVisibility, theme } = req.body || {};

      if (action !== 'update') {
        return res.status(400).json({ error: 'Azione non valida. Usa: action=update' });
      }

      const me = twitchUser.login;
      const updates = {};

      // Valida bio
      if (bio !== undefined) {
        updates.bio = sanitize(bio, MAX_BIO_LENGTH);
      }

      // Valida socials
      if (socials !== undefined) {
        if (typeof socials !== 'object' || socials === null || Array.isArray(socials)) {
          return res.status(400).json({ error: 'Socials deve essere un oggetto.' });
        }

        const cleanSocials = {};
        for (const [key, value] of Object.entries(socials)) {
          if (!ALLOWED_SOCIAL_KEYS.includes(key)) {
            return res.status(400).json({ error: `Chiave social non valida: ${key}` });
          }
          if (value === null || value === '') {
            cleanSocials[key] = '';
            continue;
          }
          const cleaned = sanitize(String(value), MAX_SOCIAL_LENGTH);
          if (cleaned && !isValidUrl(cleaned)) {
            return res.status(400).json({ error: `URL non valido per ${key}: ${cleaned}` });
          }
          cleanSocials[key] = cleaned;
        }
        updates.socials = JSON.stringify(cleanSocials);
      }

      // Valida friendRequestsOpen
      if (friendRequestsOpen !== undefined) {
        if (typeof friendRequestsOpen !== 'boolean') {
          return res.status(400).json({ error: 'friendRequestsOpen deve essere un booleano.' });
        }
        updates.friendRequestsOpen = String(friendRequestsOpen);
      }

      // Valida profileVisibility
      if (profileVisibility !== undefined) {
        if (!ALLOWED_VISIBILITY.includes(profileVisibility)) {
          return res.status(400).json({ error: `Visibilità non valida. Usa: ${ALLOWED_VISIBILITY.join(', ')}` });
        }
        updates.profileVisibility = profileVisibility;
      }

      // Valida theme
      if (theme !== undefined) {
        if (!ALLOWED_THEMES.includes(theme)) {
          return res.status(400).json({ error: `Tema non valido. Usa: ${ALLOWED_THEMES.join(', ')}` });
        }
        updates.theme = theme;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare.' });
      }

      updates.updatedAt = String(Date.now());

      await redis.hset(`profile:${me}`, updates);

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Profile POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
