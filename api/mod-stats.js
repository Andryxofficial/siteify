import { Redis } from '@upstash/redis';
import {
  corsHeaders, modAuthGate, getBroadcasterId, helixGet,
} from './_modAuth.js';

/**
 * mod-stats.js — Statistiche e snapshot canale.
 *
 * GET  /api/mod-stats                → ultimi N snapshot da Redis
 * POST /api/mod-stats?action=snapshot → (cron o chiamata manuale) salva snapshot attuale
 *
 * Redis:
 *   mod:stats:snapshots → ZSET  score=timestamp, value=JSON snapshot
 *   Mantenuto a max 720 entry (30gg × 24h)
 */

const STATS_KEY  = 'mod:stats:snapshots';
const MAX_POINTS = 720;
// Chiave cron protetta con segreto admin
const CRON_SECRET = process.env.IUA_SECRET || '';

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  /* ─── POST snapshot (cron o manuale) ─── */
  if (req.method === 'POST') {
    // Accettato sia da mod autenticato sia da cron con IUA_SECRET
    const auth = req.headers.authorization || '';
    let autorizzato = false;

    if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
      autorizzato = true;
    } else {
      const { twitchUser, isMod } = await modAuthGate(req, redis);
      autorizzato = !!(twitchUser && isMod);
    }

    if (!autorizzato) return res.status(403).json({ error: 'Non autorizzato.' });

    try {
      const broadcasterId = await getBroadcasterId(redis);
      if (!broadcasterId) return res.status(400).json({ error: 'Broadcaster ID non disponibile.' });

      // Per lo snapshot usiamo un token "fantasma": quello del broadcaster
      // salvato in Redis. Per il cron però non abbiamo un token utente;
      // usiamo invece il client_credentials grant se TWITCH_CLIENT_SECRET è disponibile.
      // Altrimenti skippamo la chiamata Helix e salviamo solo un placeholder.
      const clientId     = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;

      let viewerCount   = null;
      let followerTotal = null;
      let subTotal      = null;

      if (clientId && clientSecret) {
        // Ottieni app access token
        const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const appToken = tokenData.access_token;
          // Stream info
          const streamData = await helixGet('streams', { user_id: broadcasterId, first: 1 }, appToken, clientId).catch(() => null);
          viewerCount = streamData?.data?.[0]?.viewer_count ?? 0;
          // Follower total
          const follData = await helixGet('channels/followers', { broadcaster_id: broadcasterId, first: 1 }, appToken, clientId).catch(() => null);
          followerTotal = follData?.total ?? null;
        }
      }

      const ts = Date.now();
      const snapshot = JSON.stringify({ ts, viewerCount, followerTotal, subTotal });
      await redis.zadd(STATS_KEY, { score: ts, member: snapshot });
      // Mantieni solo MAX_POINTS
      const count = await redis.zcard(STATS_KEY);
      if (count > MAX_POINTS) {
        await redis.zremrangebyrank(STATS_KEY, 0, count - MAX_POINTS - 1);
      }

      return res.status(200).json({ ok: true, snapshot: JSON.parse(snapshot) });
    } catch (e) {
      console.error('mod-stats snapshot error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── GET storico ─── */
  if (req.method === 'GET') {
    const { twitchUser, isMod } = await modAuthGate(req, redis);
    if (!twitchUser) return res.status(401).json({ error: 'Token mancante.' });
    if (!isMod)      return res.status(403).json({ error: 'Accesso riservato.' });

    try {
      const days   = Math.min(30, parseInt(req.query?.days) || 7);
      const since  = Date.now() - days * 24 * 60 * 60 * 1000;
      const rawItems = await redis.zrangebyscore(STATS_KEY, since, '+inf');
      const points = (rawItems || []).map(item => {
        try { return typeof item === 'string' ? JSON.parse(item) : item; } catch { return null; }
      }).filter(Boolean);

      return res.status(200).json({ points, days });
    } catch (e) {
      console.error('mod-stats GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
