import { Redis } from '@upstash/redis';

/**
 * Mention Search API — suggerimenti @mention per la community ANDRYXify
 *
 * Redis data model:
 *   users:mention                 → Sorted Set (score = ultimo_timestamp, member = username)
 *   users:mention:meta:<username> → Hash { displayName, avatar, updatedAt }
 *
 * GET /api/mention-search?q=<query>
 *   → [{ username, displayName, avatar }] — max 8 risultati
 *   → filtra per prefix sulla query (case-insensitive)
 *   → se q è vuota restituisce gli 8 utenti più recenti
 */

const MAX_RISULTATI = 8;
const MAX_SCANSIONE = 200; // utenti più recenti da scansionare

/* Sanifica la query in input */
function sanitizeQ(q) {
  if (typeof q !== 'string') return '';
  return q.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 25);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const q = sanitizeQ(req.query?.q || '');

  /* Rate limit leggero per IP */
  try {
    const redis = new Redis({
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    /* Prendi fino a MAX_SCANSIONE utenti più recenti (score DESC) */
    const usernames = await redis.zrange('users:mention', 0, MAX_SCANSIONE - 1, { rev: true });

    if (!usernames || usernames.length === 0) {
      return res.status(200).json({ users: [] });
    }

    /* Filtra per prefix */
    const filtrati = q
      ? usernames.filter(u => u.startsWith(q))
      : usernames;

    const top = filtrati.slice(0, MAX_RISULTATI);

    if (top.length === 0) {
      return res.status(200).json({ users: [] });
    }

    /* Carica metadati in parallelo */
    const metas = await Promise.all(
      top.map(u => redis.hgetall(`users:mention:meta:${u}`))
    );

    const users = top.map((username, i) => ({
      username,
      displayName: metas[i]?.displayName || username,
      avatar:      metas[i]?.avatar      || null,
    }));

    return res.status(200).json({ users });
  } catch (err) {
    console.error('[mention-search] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}
