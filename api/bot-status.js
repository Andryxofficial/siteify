/**
 * bot-status.js — Stato del bot 24/7 per il Mod Panel.
 *
 * GET /api/bot-status
 *
 * Ritorna:
 *   botAutorizzato       → se il bot ha un access token salvato in Redis
 *   botLogin             → username Twitch dell'account bot
 *   botTokenScadeAt      → timestamp (ms) di scadenza del token bot
 *   broadcasterGranted   → se il broadcaster ha concesso channel:bot
 *   subscriptioniTs      → timestamp ultima creazione sottoscrizioni EventSub
 *   log                  → ultimi 20 eventi del bot (più recenti prima)
 */

import { Redis } from '@upstash/redis';
import { corsHeaders, modAuthGate } from './_modAuth.js';

export default async function handler(req, res) {
  corsHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non supportato.' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  const { isMod } = await modAuthGate(req, redis);
  if (!isMod) return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });

  try {
    const [
      botTokenEsiste,
      botLogin,
      botExpiresAt,
      broadcasterGranted,
      subscriptionTs,
      logRaw,
    ] = await Promise.all([
      redis.exists('bot:token:access'),
      redis.get('bot:user:login'),
      redis.get('bot:token:expires_at'),
      redis.get('bot:broadcaster:channel_bot_granted'),
      redis.get('bot:subscriptions:ts'),
      redis.lrange('bot:log', -20, -1),
    ]);

    const log = (logRaw || [])
      .map(entry => {
        try { return typeof entry === 'string' ? JSON.parse(entry) : entry; }
        catch { return { tipo: 'raw', messaggio: String(entry), ts: null }; }
      })
      .reverse(); // più recenti prima

    return res.status(200).json({
      botAutorizzato:    !!botTokenEsiste,
      botLogin:          botLogin ? String(botLogin) : null,
      botTokenScadeAt:   botExpiresAt ? Number(botExpiresAt) : null,
      broadcasterGranted: !!broadcasterGranted,
      subscriptioniTs:   subscriptionTs ? Number(subscriptionTs) : null,
      log,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
