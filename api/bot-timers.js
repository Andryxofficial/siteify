/**
 * bot-timers.js — Cron job per i timer automatici del bot.
 *
 * Invocato ogni minuto da Vercel Cron Jobs.
 * Per ogni timer abilitato controlla se l'intervallo è trascorso e, se sì,
 * invia il messaggio configurato nel canale del broadcaster.
 *
 * GET /api/bot-timers  (Vercel Cron: "* * * * *")
 * POST /api/bot-timers (trigger manuale da UI o admin)
 */

import { Redis } from '@upstash/redis';
import { caricaTimer } from './_botLogic.js';
import { inviaMessaggioChat, aggiungiLog } from './_botHelix.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  // Autenticazione: Vercel Cron invia l'header x-vercel-cron:1;
  // trigger manuale richiede IUA_SECRET
  const isCronVercel = req.headers['x-vercel-cron'] === '1';
  const authHeader   = req.headers.authorization;
  const iuaSecret    = process.env.IUA_SECRET;
  const isAdmin      = iuaSecret && authHeader === `Bearer ${iuaSecret}`;

  if (!isCronVercel && !isAdmin) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  // Controlla prerequisiti
  const broadcasterId = await redis.get('bot:broadcaster:id').catch(() => null);
  if (!broadcasterId) {
    return res.status(200).json({ ok: true, saltato: 'broadcaster_id non configurato' });
  }

  const botTokenEsiste = await redis.exists('bot:token:access').catch(() => 0);
  if (!botTokenEsiste) {
    return res.status(200).json({ ok: true, saltato: 'bot non ancora autorizzato' });
  }

  const timers    = await caricaTimer(redis);
  const abilitati = timers.filter(t => t.enabled);

  if (!abilitati.length) {
    return res.status(200).json({ ok: true, timer: 0, inviati: 0 });
  }

  const ora     = Date.now();
  let   inviati = 0;

  for (const timer of abilitati) {
    const intervalMs   = Math.max(60, timer.interval || 300) * 1000;
    const lastRunKey   = `bot:timer:lastrun:${timer.name}`;
    const lastRunRaw   = await redis.get(lastRunKey).catch(() => null);
    const ultimaEsecuzione = lastRunRaw ? Number(lastRunRaw) : 0;

    if (ora - ultimaEsecuzione < intervalMs) continue;

    try {
      await inviaMessaggioChat(redis, String(broadcasterId), timer.message);
      await redis.set(lastRunKey, String(ora));
      await aggiungiLog(redis, 'timer', `Timer "${timer.name}": ${timer.message.slice(0, 80)}`);
      inviati++;
    } catch (e) {
      console.error(`[bot-timers] Timer "${timer.name}" fallito:`, e.message);
    }
  }

  return res.status(200).json({ ok: true, timer: abilitati.length, inviati });
}
