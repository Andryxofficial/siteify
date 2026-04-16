import { Redis } from '@upstash/redis';

/**
 * POST /api/reset-leaderboard
 *
 * Admin endpoint: wipes every Redis key that starts with "neural_dash_leaderboard"
 * (used by Andryx Quest and legacy Neural Dash).
 * Protected by Authorization: Bearer <IUA_SECRET>.
 *
 * Usage (curl):
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>"
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non supportato.' });

  // Auth
  const secret = process.env.IUA_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'IUA_SECRET non configurato sul server.' });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  // Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch (e) {
    console.error('Redis init error:', e);
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  try {
    // Collect all matching keys via SCAN (handles large keyspaces safely)
    const keys = [];
    let cursor = 0;
    do {
      const [nextCursor, batch] = await redis.scan(cursor, {
        match: 'neural_dash_leaderboard*',
        count: 100,
      });
      cursor = Number(nextCursor);
      if (batch.length > 0) keys.push(...batch);
    } while (cursor !== 0);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    console.log(`[reset-leaderboard] Deleted ${keys.length} key(s):`, keys);
    return res.status(200).json({
      message: `Classifica resettata con successo. ${keys.length} chiave/i eliminate.`,
      deletedKeys: keys,
    });
  } catch (e) {
    console.error('Reset leaderboard error:', e);
    return res.status(500).json({ error: 'Errore durante il reset della classifica.' });
  }
}
