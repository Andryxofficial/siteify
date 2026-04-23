import { Redis } from '@upstash/redis';

/**
 * Mention Search API — suggerimenti @mention per la community ANDRYXify
 *
 * Redis data model:
 *   users:mention                 → Sorted Set (score = ultimo_timestamp, member = username)
 *   users:mention:meta:<username> → Hash { displayName, avatar, updatedAt }
 *
 * GET /api/mention-search?q=<query>
 *   → { users: [{ username, displayName, avatar }] } — max 8 risultati
 *   → ricerca **substring** case-insensitive su username e displayName
 *   → se la query è vuota restituisce gli 8 utenti più recenti
 *   → se la query non matcha nessun utente locale, prova un fallback su
 *     Twitch Helix (`users?login=`) e auto-cacha i risultati nell'indice
 *     locale per le ricerche successive.
 */

const MAX_RISULTATI = 8;
const MAX_SCANSIONE = 500; // utenti più recenti da scansionare

/* Sanifica la query in input — Twitch login: a-z, 0-9, underscore, max 25 */
function sanitizeQ(q) {
  if (typeof q !== 'string') return '';
  return q.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 25);
}

/* Helix users?login=<q> — fallback per nick non ancora nell'indice locale */
async function lookupHelixUser(login) {
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) return null;
    const { access_token: appToken } = await tokenRes.json();
    if (!appToken) return null;

    const userRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
      { headers: { Authorization: `Bearer ${appToken}`, 'Client-Id': clientId } },
    );
    if (!userRes.ok) return null;
    const userData = await userRes.json();
    const u = userData.data?.[0];
    if (!u) return null;
    return {
      username:    u.login,
      displayName: u.display_name || u.login,
      avatar:      u.profile_image_url || null,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const q = sanitizeQ(req.query?.q || '');

  try {
    const redis = new Redis({
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    /* Prendi fino a MAX_SCANSIONE utenti più recenti (score DESC) */
    const usernames = await redis.zrange('users:mention', 0, MAX_SCANSIONE - 1, { rev: true });

    let results = [];

    if (usernames && usernames.length > 0) {
      /* Prima passata: filtra per match sull'username (cheap, niente fetch) */
      const matchUsername = q
        ? usernames.filter(u => u.includes(q))
        : usernames;

      /* Carica metadati per la prima passata di candidati (max MAX_RISULTATI * 4
         per tenere spazio al match displayName, ma cappato a 32 per non esagerare) */
      const candidatiIniziali = matchUsername.slice(0, Math.max(MAX_RISULTATI, 32));
      const metasIniziali = await Promise.all(
        candidatiIniziali.map(u => redis.hgetall(`users:mention:meta:${u}`)),
      );

      const candidatiArricchiti = candidatiIniziali.map((username, i) => ({
        username,
        displayName: metasIniziali[i]?.displayName || username,
        avatar:      metasIniziali[i]?.avatar      || null,
      }));

      /* Scoring: match esatto > prefix > substring nell'username > substring nel displayName */
      function scoreOf(u) {
        if (!q) return 0;
        const uname = u.username.toLowerCase();
        const dname = (u.displayName || '').toLowerCase();
        if (uname === q) return 100;
        if (uname.startsWith(q)) return 80;
        if (dname === q) return 70;
        if (dname.startsWith(q)) return 60;
        if (uname.includes(q)) return 40;
        if (dname.includes(q)) return 30;
        return 0;
      }

      const filtrati = q
        ? candidatiArricchiti.filter(u => scoreOf(u) > 0)
        : candidatiArricchiti;

      /* Se siamo ancora sotto soglia e la query c'è, tenta un secondo passaggio:
         carica metadati anche per gli username che non matchano direttamente
         ma i cui displayName potrebbero matchare. Lo facciamo solo per i restanti
         max 32 candidati per tenere il costo basso. */
      if (q && filtrati.length < MAX_RISULTATI) {
        const restanti = usernames
          .filter(u => !candidatiIniziali.includes(u))
          .slice(0, 32);
        if (restanti.length > 0) {
          const metasRestanti = await Promise.all(
            restanti.map(u => redis.hgetall(`users:mention:meta:${u}`)),
          );
          restanti.forEach((username, i) => {
            const dn = (metasRestanti[i]?.displayName || '').toLowerCase();
            if (dn && dn.includes(q)) {
              filtrati.push({
                username,
                displayName: metasRestanti[i].displayName || username,
                avatar:      metasRestanti[i].avatar      || null,
              });
            }
          });
        }
      }

      results = filtrati
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, MAX_RISULTATI);
    }

    /* Fallback Helix: la query è almeno 2 caratteri, sembra un login Twitch
       (lettere/numeri/underscore) e nessun risultato locale combacia
       esattamente con la query → prova a cercarla su Twitch e cachala. */
    const matchEsatto = q && results.some(u => u.username === q);
    if (q && q.length >= 2 && !matchEsatto && results.length < MAX_RISULTATI) {
      const helixUser = await lookupHelixUser(q);
      if (helixUser) {
        const now = Date.now();
        /* Salva nell'indice locale per le ricerche successive (best-effort) */
        try {
          await Promise.all([
            redis.zadd('users:mention', { score: now, member: helixUser.username }),
            redis.hset(`users:mention:meta:${helixUser.username}`, {
              displayName: helixUser.displayName,
              avatar:      helixUser.avatar || '',
              updatedAt:   now,
            }),
          ]);
        } catch { /* best-effort */ }

        /* Mettilo in cima ai risultati se non già presente */
        if (!results.some(u => u.username === helixUser.username)) {
          results = [helixUser, ...results].slice(0, MAX_RISULTATI);
        }
      }
    }

    /* Refresh in background dei metadati incompleti — best-effort,
       non blocca la risposta. Migliora gradualmente la qualità dei suggerimenti. */
    if (results.length > 0) {
      ;(async () => {
        try {
          const ora = Date.now();
          const dapprov = results.filter((u) => !u.avatar);
          for (const u of dapprov.slice(0, 3)) {
            const fresh = await lookupHelixUser(u.username);
            if (fresh) {
              await redis.hset(`users:mention:meta:${u.username}`, {
                displayName: fresh.displayName,
                avatar:      fresh.avatar || '',
                updatedAt:   ora,
              });
            }
          }
        } catch { /* best-effort */ }
      })();
    }

    return res.status(200).json({ users: results });
  } catch (err) {
    console.error('[mention-search] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}
