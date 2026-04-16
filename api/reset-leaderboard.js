import { Redis } from '@upstash/redis';

/**
 * POST /api/reset-leaderboard
 *
 * Admin endpoint with two modes:
 *
 * 1. Archive & reset current season:
 *    The current season's data (lb:YYYY-MM*) is kept as-is in Redis
 *    (it's already archived by its season key), and only the weekly
 *    sub-keys are cleared. This is the default behavior.
 *
 * 2. Full wipe (pass {"full": true} in body):
 *    Wipes every Redis key that starts with "lb:" or "neural_dash_leaderboard".
 *
 * Protected by Authorization: Bearer <IUA_SECRET>.
 *
 * Usage (curl):
 *   # Archive current season (keep scores, clear weeklies):
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>"
 *
 *   # Full wipe (delete everything):
 *   curl -X POST https://www.andryxify.it/api/reset-leaderboard \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"full": true}'
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

  const fullWipe = req.body?.full === true;

  try {
    if (fullWipe) {
      // Full wipe: delete all lb:* and neural_dash_leaderboard* keys
      const allKeys = [];
      for (const pattern of ['lb:*', 'neural_dash_leaderboard*']) {
        let cursor = 0;
        do {
          const [nextCursor, batch] = await redis.scan(cursor, {
            match: pattern,
            count: 100,
          });
          cursor = Number(nextCursor);
          if (batch.length > 0) allKeys.push(...batch);
        } while (cursor !== 0);
      }

      // Deduplicate
      const uniqueKeys = [...new Set(allKeys)];
      if (uniqueKeys.length > 0) {
        await redis.del(...uniqueKeys);
      }

      console.log(`[reset-leaderboard] FULL WIPE: Deleted ${uniqueKeys.length} key(s):`, uniqueKeys);
      return res.status(200).json({
        message: `Wipe completo. ${uniqueKeys.length} chiave/i eliminate.`,
        deletedKeys: uniqueKeys,
      });
    }

    // Default: archive current season — just clear weekly keys
    const now = new Date();
    const season = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const weeklyKeys = [];
    let cursor = 0;
    do {
      const [nextCursor, batch] = await redis.scan(cursor, {
        match: `lb:${season}:weekly:*`,
        count: 100,
      });
      cursor = Number(nextCursor);
      if (batch.length > 0) weeklyKeys.push(...batch);
    } while (cursor !== 0);

    if (weeklyKeys.length > 0) {
      await redis.del(...weeklyKeys);
    }

    console.log(`[reset-leaderboard] Archived season ${season}. Cleared ${weeklyKeys.length} weekly key(s).`);
    return res.status(200).json({
      message: `Stagione ${season} archiviata. ${weeklyKeys.length} chiave/i settimanali eliminate.`,
      season,
      deletedWeeklyKeys: weeklyKeys,
    });
  } catch (e) {
    console.error('Reset leaderboard error:', e);
    return res.status(500).json({ error: 'Errore durante il reset della classifica.' });
  }
}
