import { Redis } from '@upstash/redis';

const LEADERBOARD_KEY = 'neural_dash_leaderboard';
const MAX_ENTRIES = 50;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // GET: return top scores
  if (req.method === 'GET') {
    try {
      const scores = await redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, { rev: true, withScores: true });
      const leaderboard = [];
      for (let i = 0; i < scores.length; i += 2) {
        leaderboard.push({
          username: scores[i],
          score: Number(scores[i + 1]),
        });
      }
      return res.status(200).json({ leaderboard });
    } catch (e) {
      console.error('Leaderboard GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero della classifica.' });
    }
  }

  // POST: submit a score (requires Twitch token)
  if (req.method === 'POST') {
    try {
      const { score } = req.body;

      if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || score > 999999) {
        return res.status(400).json({ error: 'Punteggio non valido.' });
      }

      // Validate Twitch token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token Twitch mancante. Effettua il login.' });
      }

      const twitchToken = authHeader.split(' ')[1];

      // Validate token with Twitch API
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${twitchToken}` },
      });

      if (!validateRes.ok) {
        return res.status(401).json({ error: 'Token Twitch non valido o scaduto.' });
      }

      const twitchData = await validateRes.json();
      const username = twitchData.login;

      if (!username) {
        return res.status(401).json({ error: 'Impossibile ottenere il nome utente Twitch.' });
      }

      // Only update if new score is higher than existing
      const currentScore = await redis.zscore(LEADERBOARD_KEY, username);
      if (currentScore !== null && Number(currentScore) >= score) {
        return res.status(200).json({
          message: 'Hai già un punteggio più alto!',
          username,
          currentBest: Number(currentScore),
          submitted: score,
        });
      }

      await redis.zadd(LEADERBOARD_KEY, { score, member: username });

      return res.status(200).json({
        message: 'Punteggio registrato!',
        username,
        score,
      });
    } catch (e) {
      console.error('Leaderboard POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio del punteggio.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
