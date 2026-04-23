import { Redis } from '@upstash/redis';

/**
 * Profile API — Profilo utente "scheda Facebook ma meglio" per ANDRYXify
 *
 * Redis data model:
 *   profile:<u>            → Hash {
 *     bio,                  // max 300
 *     socials,              // JSON { twitch,youtube,instagram,tiktok,twitter,discord,spotify,website }
 *     friendRequestsOpen,   // "true" | "false"
 *     profileVisibility,    // "public" | "friends" | "private"
 *     theme,                // "default" | "magenta" | "cyan" | "amber" | "emerald" | "violet"
 *     accentColor,          // "#RRGGBB" (6-digit hex, opzionale, override del theme)
 *     coverMediaId,         // ID di /api/community-media (immagine custom)
 *     coverPreset,          // slug libreria preset (vedi COVER_PRESETS) — alternativo a coverMediaId
 *     customAvatarMediaId,  // override avatar Twitch
 *     pronomi, localita, lavoro, giocoPreferito, streamerPreferito,  // intro (max 60 ciascuno)
 *     updatedAt
 *   }
 *   profile:<u>:likes      → String (counter incrementato da community.js / community-replies.js)
 *   profile:rl:<u>         → String TTL (rate-limit scrittura)
 *   live:<u>               → String JSON { live, gameName, title, viewerCount, startedAt } TTL 60s
 *
 * GET    /api/profile?user=<u>                       → scheda profilo completa
 * POST   /api/profile  { action:'update', ... }      → aggiorna campi del proprio profilo
 *
 * Anche esposto come metodo helper per altri endpoint:
 *   ricalcolo del contatore like è effettuato lato community.js / community-replies.js
 *   tramite redis.incr / redis.decr di `profile:<author>:likes`.
 */

const MAX_BIO_LENGTH    = 300;
const MAX_SOCIAL_LENGTH = 200;
const MAX_INTRO_FIELD   = 60;
const RATE_LIMIT_SECONDS = 5;
const LIVE_CACHE_TTL    = 60;

const ALLOWED_SOCIAL_KEYS = ['twitch', 'youtube', 'instagram', 'tiktok', 'twitter', 'discord', 'spotify', 'website'];
const ALLOWED_VISIBILITY  = ['public', 'friends', 'private'];
const ALLOWED_THEMES      = ['default', 'magenta', 'cyan', 'amber', 'emerald', 'violet'];
const INTRO_FIELDS        = ['pronomi', 'localita', 'lavoro', 'giocoPreferito', 'streamerPreferito'];

/**
 * Libreria di copertine preset — gradienti coerenti col design Liquid Glass.
 * I gradienti sono CSS string puri, renderizzati lato frontend come `background:`.
 * Ogni preset ha un nome leggibile per i18n + tinta principale per accent fallback.
 */
export const COVER_PRESETS = {
  aurora:    { label: 'Aurora',    css: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 50%, #F59E0B 100%)', accent: '#DB2777' },
  cyber:     { label: 'Cyber',     css: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 60%, #8B5CF6 100%)', accent: '#3B82F6' },
  sunset:    { label: 'Sunset',    css: 'linear-gradient(135deg, #F97316 0%, #EF4444 50%, #BE185D 100%)', accent: '#EF4444' },
  forest:    { label: 'Foresta',   css: 'linear-gradient(135deg, #064E3B 0%, #10B981 60%, #84CC16 100%)', accent: '#10B981' },
  midnight:  { label: 'Mezzanotte',css: 'linear-gradient(135deg, #0F172A 0%, #1E40AF 60%, #312E81 100%)', accent: '#1E40AF' },
  candy:     { label: 'Candy',     css: 'linear-gradient(135deg, #F472B6 0%, #C084FC 50%, #60A5FA 100%)', accent: '#C084FC' },
  retro:     { label: 'Retrowave', css: 'linear-gradient(180deg, #1E1B4B 0%, #831843 60%, #F59E0B 100%)', accent: '#F59E0B' },
  emerald:   { label: 'Smeraldo',  css: 'linear-gradient(135deg, #022C22 0%, #047857 60%, #10B981 100%)', accent: '#10B981' },
  twitch:    { label: 'Twitch',    css: 'linear-gradient(135deg, #1F0A4A 0%, #6441A5 60%, #9146FF 100%)', accent: '#9146FF' },
  andryx:    { label: 'Andryx',    css: 'linear-gradient(135deg, #2A0533 0%, #E040FB 50%, #FF6B6B 100%)', accent: '#E040FB' },
};

const ALLOWED_COVER_PRESETS = Object.keys(COVER_PRESETS);

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function isHexColor(s) {
  return typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

/* Mese ISO corrente nel formato YYYY-MM */
function currentSeason() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* Etichetta italiana mese da YYYY-MM */
const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
function labelSeason(season) {
  const [y, m] = String(season).split('-');
  const idx = parseInt(m, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return season;
  return `${MESI_IT[idx]} ${y}`;
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

  return { login: data.login, avatar, displayName, clientId, token };
}

/** Cerca i metadata di più utenti Twitch in una sola chiamata helix (max 100). */
async function fetchTwitchUsersBatch(logins, clientId, token) {
  if (!Array.isArray(logins) || logins.length === 0 || !clientId || !token) return {};
  const unique = [...new Set(logins.map(l => String(l).toLowerCase()))].slice(0, 100);
  const params = unique.map(l => `login=${encodeURIComponent(l)}`).join('&');
  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
    });
    if (!res.ok) return {};
    const j = await res.json();
    const map = {};
    for (const u of (j.data || [])) {
      map[u.login] = {
        login: u.login,
        display: u.display_name || u.login,
        avatar: u.profile_image_url || null,
      };
    }
    return map;
  } catch { return {}; }
}

/** Verifica se un utente Twitch è in live, con cache 60s. */
async function getLiveStatus(redis, login, clientId, token) {
  if (!login) return null;
  const key = `live:${login.toLowerCase()}`;
  try {
    const cached = await redis.get(key);
    if (cached) {
      const obj = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return obj;
    }
  } catch { /* ignora cache rotta */ }

  if (!clientId || !token) return { live: false };

  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
    });
    if (!res.ok) return { live: false };
    const j = await res.json();
    const s = j.data?.[0];
    const obj = s
      ? {
          live: true,
          gameName: s.game_name || '',
          title: s.title || '',
          viewerCount: Number(s.viewer_count || 0),
          startedAt: s.started_at || '',
        }
      : { live: false };
    try { await redis.set(key, JSON.stringify(obj), { ex: LIVE_CACHE_TTL }); } catch { /* ignora */ }
    return obj;
  } catch {
    return { live: false };
  }
}

/** Calcola i trofei dinamici per un utente — best effort, scansione limitata. */
async function computeTrofei(redis, username) {
  const trofei = [];
  try {
    /* Trofei classifica generale (Mese/Legend/Jump) */
    const giochi = [
      { game: 'monthly',  prefix: 'lb',          label: 'Gioco del Mese' },
      { game: 'legend',   prefix: 'lb:legend',   label: 'Andryx Legend' },
      { game: 'platform', prefix: 'lb:platform', label: 'Andryx Jump' },
    ];

    /* Posizioni storiche nella classifica generale (top 3) */
    const generalChecks = await Promise.all(
      giochi.map(async g => {
        try {
          const rank = await redis.zrevrank(`${g.prefix}:general`, username);
          const score = await redis.zscore(`${g.prefix}:general`, username);
          if (rank === null || rank === undefined) return null;
          return { rank: Number(rank), score: Number(score || 0), ...g };
        } catch { return null; }
      })
    );
    for (const r of generalChecks) {
      if (r && r.rank < 3) {
        trofei.push({
          id: `gen-${r.game}-${r.rank}`,
          icon: r.rank === 0 ? 'crown' : 'medal',
          tier: r.rank === 0 ? 'gold' : r.rank === 1 ? 'silver' : 'bronze',
          title: r.rank === 0 ? `🥇 Re di ${r.label}` : r.rank === 1 ? `🥈 Sfidante di ${r.label}` : `🥉 Veterano di ${r.label}`,
          description: `Posizione #${r.rank + 1} nella classifica generale (${r.score.toLocaleString('it-IT')} punti).`,
        });
      }
    }

    /* Trofei mensili — scansione delle ultime 12 stagioni */
    const now = new Date();
    const seasons = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      seasons.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    const monthlyKeys = [];
    for (const s of seasons) {
      for (const g of giochi) {
        monthlyKeys.push({ season: s, game: g.game, label: g.label, key: `${g.prefix}:${s}:monthly` });
      }
    }

    const monthlyResults = await Promise.all(
      monthlyKeys.map(async k => {
        try {
          const rank = await redis.zrevrank(k.key, username);
          if (rank === null || rank === undefined || rank > 2) return null;
          return { ...k, rank: Number(rank) };
        } catch { return null; }
      })
    );
    for (const r of monthlyResults) {
      if (!r) continue;
      const podio = ['🥇','🥈','🥉'][r.rank];
      trofei.push({
        id: `month-${r.game}-${r.season}-${r.rank}`,
        icon: r.rank === 0 ? 'trophy' : 'medal',
        tier: r.rank === 0 ? 'gold' : r.rank === 1 ? 'silver' : 'bronze',
        title: `${podio} ${r.label} — ${labelSeason(r.season)}`,
        description: `Top ${r.rank + 1} mensile.`,
        season: r.season,
      });
    }

    /* Trofei community — milestones post / amici / like */
    const [postCount, friendCount, likeCount] = await Promise.all([
      redis.zcard(`community:user:${username}`).catch(() => 0),
      redis.scard(`friends:${username}`).catch(() => 0),
      redis.get(`profile:${username}:likes`).catch(() => 0),
    ]);

    const postMilestones = [
      { soglia: 1,   title: '✍️ Primo post',           desc: 'Hai condiviso il primo post sulla community.' },
      { soglia: 10,  title: '📚 Posteggiatore',        desc: 'Hai pubblicato 10 post.' },
      { soglia: 50,  title: '📰 Cronista',             desc: 'Hai pubblicato 50 post.' },
      { soglia: 100, title: '📕 Centurione',           desc: 'Hai superato i 100 post.' },
    ];
    for (const m of postMilestones) {
      if (Number(postCount) >= m.soglia) {
        trofei.push({ id: `post-${m.soglia}`, icon: 'message', tier: 'community', title: m.title, description: m.desc });
      }
    }
    const friendMilestones = [
      { soglia: 1,  title: '🤝 Prima amicizia',  desc: 'Hai aggiunto il primo amico.' },
      { soglia: 10, title: '👥 Cerchia',         desc: 'Hai 10 amici.' },
      { soglia: 50, title: '🌐 Hub sociale',     desc: 'Hai 50 amici.' },
    ];
    for (const m of friendMilestones) {
      if (Number(friendCount) >= m.soglia) {
        trofei.push({ id: `friend-${m.soglia}`, icon: 'users', tier: 'community', title: m.title, description: m.desc });
      }
    }
    const likeMilestones = [
      { soglia: 10,  title: '❤️ Apprezzato',     desc: '10 like ricevuti.' },
      { soglia: 100, title: '💖 Beniamino',      desc: '100 like ricevuti.' },
      { soglia: 500, title: '🌟 Star',           desc: '500 like ricevuti.' },
    ];
    for (const m of likeMilestones) {
      if (Number(likeCount || 0) >= m.soglia) {
        trofei.push({ id: `like-${m.soglia}`, icon: 'heart', tier: 'community', title: m.title, description: m.desc });
      }
    }

    /* Trofeo "Mod del canale" se in mod:whitelist */
    try {
      const isMod = await redis.sismember('mod:whitelist', username);
      if (isMod) {
        trofei.push({ id: 'mod', icon: 'shield', tier: 'gold', title: '🛡️ Mod del canale', description: 'Aiuta Andryx a moderare la community.' });
      }
    } catch { /* ignora */ }

  } catch (e) {
    console.warn('computeTrofei error:', e);
  }
  return trofei;
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

  /* ─── GET: scheda profilo completa ─── */
  if (req.method === 'GET') {
    try {
      /* Endpoint diagnostico per la libreria di copertine */
      if (req.query?.action === 'cover_presets') {
        return res.status(200).json({
          presets: Object.entries(COVER_PRESETS).map(([slug, p]) => ({ slug, label: p.label, css: p.css, accent: p.accent })),
        });
      }

      const targetUser = req.query?.user;
      if (!targetUser) return res.status(400).json({ error: 'Parametro "user" richiesto.' });

      const username = sanitize(targetUser, 50).toLowerCase();
      if (!username) return res.status(400).json({ error: 'Username non valido.' });

      const profileData = await redis.hgetall(`profile:${username}`);
      const profile = profileData || {};

      const visibility = profile.profileVisibility || 'public';

      const twitchUser = await validateTwitch(req.headers.authorization);
      const requester = twitchUser?.login || null;
      const isOwnProfile = requester === username;

      if (visibility === 'private' && !isOwnProfile) {
        return res.status(403).json({ error: 'Questo profilo è privato.' });
      }
      if (visibility === 'friends' && !isOwnProfile) {
        if (!requester) {
          return res.status(403).json({ error: 'Profilo visibile solo agli amici. Effettua il login.' });
        }
        const isFriend = await redis.sismember(`friends:${username}`, requester);
        if (!isFriend) return res.status(403).json({ error: 'Profilo visibile solo agli amici.' });
      }

      /* Stats parallele */
      const season = currentSeason();
      const [
        postCount, friendCount,
        scoreGeneral, scoreMonthly, scoreLegend, scorePlatform,
        likesReceived,
        firstPostList, lastPostList,
      ] = await Promise.all([
        redis.zcard(`community:user:${username}`).catch(() => 0),
        redis.scard(`friends:${username}`).catch(() => 0),
        redis.zscore('lb:general', username).catch(() => null),
        redis.zscore(`lb:${season}:monthly`, username).catch(() => null),
        redis.zscore('lb:legend:general', username).catch(() => null),
        redis.zscore('lb:platform:general', username).catch(() => null),
        redis.get(`profile:${username}:likes`).catch(() => 0),
        redis.zrange(`community:user:${username}`, 0, 0, { withScores: true }).catch(() => []),
        redis.zrange(`community:user:${username}`, 0, 0, { rev: true, withScores: true }).catch(() => []),
      ]);

      /* Anteprima amici (massimo 9) */
      let friendsPreview = [];
      try {
        const sample = await redis.srandmember(`friends:${username}`, 9);
        const list = Array.isArray(sample) ? sample : (sample ? [sample] : []);
        if (list.length > 0 && twitchUser?.token && twitchUser?.clientId) {
          const meta = await fetchTwitchUsersBatch(list, twitchUser.clientId, twitchUser.token);
          friendsPreview = list.map(login => ({
            login,
            display: meta[login]?.display || login,
            avatar:  meta[login]?.avatar || null,
          }));
        } else {
          friendsPreview = list.map(login => ({ login, display: login, avatar: null }));
        }
      } catch { /* best effort */ }

      /* Avatar custom (se impostato) o Twitch helix */
      let targetAvatar = null;
      let targetDisplay = username;
      if (twitchUser?.token && twitchUser?.clientId) {
        try {
          const twitchProfileRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
            { headers: { Authorization: `Bearer ${twitchUser.token}`, 'Client-Id': twitchUser.clientId } },
          );
          if (twitchProfileRes.ok) {
            const tpd = await twitchProfileRes.json();
            const tu = tpd.data?.[0];
            if (tu) {
              targetAvatar = tu.profile_image_url || null;
              targetDisplay = tu.display_name || username;
            }
          }
        } catch { /* best effort */ }
      }

      const customAvatarUrl = profile.customAvatarMediaId
        ? `/api/community-media?action=get&id=${encodeURIComponent(profile.customAvatarMediaId)}`
        : null;
      const avatar = customAvatarUrl || targetAvatar;

      /* Cover URL: priorità a coverMediaId, poi coverPreset */
      let coverUrl = null;
      let coverPreset = null;
      if (profile.coverMediaId) {
        coverUrl = `/api/community-media?action=get&id=${encodeURIComponent(profile.coverMediaId)}`;
      } else if (profile.coverPreset && ALLOWED_COVER_PRESETS.includes(profile.coverPreset)) {
        coverPreset = {
          slug: profile.coverPreset,
          label: COVER_PRESETS[profile.coverPreset].label,
          css:   COVER_PRESETS[profile.coverPreset].css,
          accent: COVER_PRESETS[profile.coverPreset].accent,
        };
      }

      /* Parsing socials */
      let socials = {};
      if (profile.socials) {
        try { socials = typeof profile.socials === 'string' ? JSON.parse(profile.socials) : profile.socials; }
        catch { socials = {}; }
      }

      /* Intro dati */
      const intro = {};
      for (const f of INTRO_FIELDS) {
        if (profile[f]) intro[f] = profile[f];
      }

      /* Stato live (broadcaster, opzionale) */
      const live = await getLiveStatus(redis, username, twitchUser?.clientId, twitchUser?.token);

      /* Ruolo sul canale (best effort) */
      let isMod = false;
      try { isMod = !!(await redis.sismember('mod:whitelist', username)); } catch { /* ignora */ }

      /* Trofei dinamici */
      const trofei = await computeTrofei(redis, username);

      /* Date attività (firstPost, lastPost) — score = timestamp ms */
      const firstPostAt = Array.isArray(firstPostList) && firstPostList.length > 0
        ? Number(firstPostList[firstPostList.length - 1] || firstPostList[1]) || null
        : null;
      const lastPostAt = Array.isArray(lastPostList) && lastPostList.length > 0
        ? Number(lastPostList[lastPostList.length - 1] || lastPostList[1]) || null
        : null;

      return res.status(200).json({
        username,
        display: targetDisplay,
        avatar,
        avatarSource: customAvatarUrl ? 'custom' : 'twitch',
        bio: profile.bio || '',
        socials,
        friendRequestsOpen: profile.friendRequestsOpen !== 'false',
        profileVisibility: visibility,
        theme: profile.theme || 'default',
        accentColor: isHexColor(profile.accentColor) ? profile.accentColor : null,
        coverUrl,
        coverPreset,
        intro,
        updatedAt: profile.updatedAt ? Number(profile.updatedAt) : null,
        stats: {
          postCount: Number(postCount || 0),
          friendCount: Number(friendCount || 0),
          likesReceived: Number(likesReceived || 0),
          scoreMonthly: scoreMonthly ? Number(scoreMonthly) : 0,
          scoreGeneral: scoreGeneral ? Number(scoreGeneral) : 0,
          scoreLegend:  scoreLegend ? Number(scoreLegend) : 0,
          scorePlatform: scorePlatform ? Number(scorePlatform) : 0,
        },
        firstPostAt,
        lastPostAt,
        friendsPreview,
        trofei,
        live: live || { live: false },
        roles: { mod: isMod, broadcaster: username === 'andryxify' },
        isOwnProfile,
        coverPresetsAvailable: ALLOWED_COVER_PRESETS,
        // Retro-compatibilità con la vecchia shape flat (alcuni componenti la leggono):
        postCount: Number(postCount || 0),
        friendCount: Number(friendCount || 0),
        gameScore: scoreGeneral ? Number(scoreGeneral) : (scoreMonthly ? Number(scoreMonthly) : 0),
      });
    } catch (e) {
      console.error('Profile GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento del profilo.' });
    }
  }

  /* ─── POST: aggiorna profilo ─── */
  if (req.method === 'POST') {
    const twitchUser = await validateTwitch(req.headers.authorization);
    if (!twitchUser) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });

    const me = twitchUser.login;

    /* Rate-limit anti-flood */
    try {
      const rlKey = `profile:rl:${me}`;
      const rlExists = await redis.exists(rlKey);
      if (rlExists) {
        return res.status(429).json({ error: 'Aspetta qualche secondo prima di salvare di nuovo.' });
      }
      await redis.set(rlKey, '1', { ex: RATE_LIMIT_SECONDS });
    } catch { /* best effort: se il rate-limit fallisce non bloccare */ }

    try {
      const body = req.body || {};
      const { action } = body;
      if (action !== 'update') {
        return res.status(400).json({ error: 'Azione non valida. Usa: action=update' });
      }

      const updates = {};
      const deletes = [];

      /* bio */
      if (body.bio !== undefined) {
        updates.bio = sanitize(body.bio, MAX_BIO_LENGTH);
      }

      /* socials */
      if (body.socials !== undefined) {
        if (typeof body.socials !== 'object' || body.socials === null || Array.isArray(body.socials)) {
          return res.status(400).json({ error: 'Socials deve essere un oggetto.' });
        }
        const cleanSocials = {};
        for (const [key, value] of Object.entries(body.socials)) {
          if (!ALLOWED_SOCIAL_KEYS.includes(key)) {
            return res.status(400).json({ error: `Chiave social non valida: ${key}` });
          }
          if (value === null || value === '') { cleanSocials[key] = ''; continue; }
          const cleaned = sanitize(String(value), MAX_SOCIAL_LENGTH);
          if (cleaned && !isValidUrl(cleaned)) {
            return res.status(400).json({ error: `URL non valido per ${key}.` });
          }
          cleanSocials[key] = cleaned;
        }
        updates.socials = JSON.stringify(cleanSocials);
      }

      /* friendRequestsOpen */
      if (body.friendRequestsOpen !== undefined) {
        if (typeof body.friendRequestsOpen !== 'boolean') {
          return res.status(400).json({ error: 'friendRequestsOpen deve essere un booleano.' });
        }
        updates.friendRequestsOpen = String(body.friendRequestsOpen);
      }

      /* profileVisibility */
      if (body.profileVisibility !== undefined) {
        if (!ALLOWED_VISIBILITY.includes(body.profileVisibility)) {
          return res.status(400).json({ error: `Visibilità non valida. Usa: ${ALLOWED_VISIBILITY.join(', ')}` });
        }
        updates.profileVisibility = body.profileVisibility;
      }

      /* theme */
      if (body.theme !== undefined) {
        if (!ALLOWED_THEMES.includes(body.theme)) {
          return res.status(400).json({ error: `Tema non valido. Usa: ${ALLOWED_THEMES.join(', ')}` });
        }
        updates.theme = body.theme;
      }

      /* accentColor (hex 6-digit, opzionale; '' = rimuovi) */
      if (body.accentColor !== undefined) {
        if (body.accentColor === '' || body.accentColor === null) {
          deletes.push('accentColor');
        } else if (!isHexColor(body.accentColor)) {
          return res.status(400).json({ error: 'accentColor deve essere un hex a 6 cifre (#RRGGBB).' });
        } else {
          updates.accentColor = body.accentColor;
        }
      }

      /* coverPreset (slug libreria) — '' = rimuovi */
      if (body.coverPreset !== undefined) {
        if (body.coverPreset === '' || body.coverPreset === null) {
          deletes.push('coverPreset');
        } else if (!ALLOWED_COVER_PRESETS.includes(body.coverPreset)) {
          return res.status(400).json({ error: `Preset copertina non valido.` });
        } else {
          updates.coverPreset = body.coverPreset;
          /* Una copertina preset esclude il media custom */
          deletes.push('coverMediaId');
        }
      }

      /* coverMediaId (custom upload) — '' = rimuovi; va validato che esista e sia immagine */
      if (body.coverMediaId !== undefined) {
        if (body.coverMediaId === '' || body.coverMediaId === null) {
          deletes.push('coverMediaId');
        } else {
          const id = sanitize(String(body.coverMediaId), 100);
          if (!id) return res.status(400).json({ error: 'coverMediaId non valido.' });
          /* Verifica esistenza + tipo immagine */
          let metaRaw = null;
          try { metaRaw = await redis.get(`cm:${id}:meta`); } catch { /* ignora */ }
          if (!metaRaw) return res.status(400).json({ error: 'Il media indicato non esiste.' });
          let meta;
          try { meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw; }
          catch { return res.status(400).json({ error: 'Metadati media non leggibili.' }); }
          if (meta.mediaType !== 'image') {
            return res.status(400).json({ error: 'La copertina deve essere un\'immagine.' });
          }
          /* Solo l'autore del media può usarlo come copertina */
          if (meta.author && meta.author !== me) {
            return res.status(403).json({ error: 'Non puoi usare un media caricato da un altro utente.' });
          }
          updates.coverMediaId = id;
          /* Una cover custom esclude il preset */
          deletes.push('coverPreset');
        }
      }

      /* customAvatarMediaId (override avatar Twitch) — '' = rimuovi */
      if (body.customAvatarMediaId !== undefined) {
        if (body.customAvatarMediaId === '' || body.customAvatarMediaId === null) {
          deletes.push('customAvatarMediaId');
        } else {
          const id = sanitize(String(body.customAvatarMediaId), 100);
          if (!id) return res.status(400).json({ error: 'customAvatarMediaId non valido.' });
          let metaRaw = null;
          try { metaRaw = await redis.get(`cm:${id}:meta`); } catch { /* ignora */ }
          if (!metaRaw) return res.status(400).json({ error: 'Il media indicato non esiste.' });
          let meta;
          try { meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw; }
          catch { return res.status(400).json({ error: 'Metadati media non leggibili.' }); }
          if (meta.mediaType !== 'image') {
            return res.status(400).json({ error: 'L\'avatar deve essere un\'immagine.' });
          }
          if (meta.author && meta.author !== me) {
            return res.status(403).json({ error: 'Non puoi usare un media caricato da un altro utente.' });
          }
          updates.customAvatarMediaId = id;
        }
      }

      /* Campi intro (max 60 char ciascuno). '' = rimuovi. */
      for (const f of INTRO_FIELDS) {
        if (body[f] === undefined) continue;
        if (body[f] === '' || body[f] === null) {
          deletes.push(f);
        } else {
          updates[f] = sanitize(String(body[f]), MAX_INTRO_FIELD);
        }
      }

      if (Object.keys(updates).length === 0 && deletes.length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare.' });
      }

      updates.updatedAt = String(Date.now());

      const ops = [redis.hset(`profile:${me}`, updates)];
      if (deletes.length > 0) ops.push(redis.hdel(`profile:${me}`, ...deletes));
      await Promise.all(ops);

      return res.status(200).json({ ok: true, updated: Object.keys(updates), removed: deletes });
    } catch (e) {
      console.error('Profile POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
