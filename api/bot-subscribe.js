/**
 * bot-subscribe.js — Gestione sottoscrizioni EventSub per il bot 24/7.
 *
 * GET    /api/bot-subscribe              → lista sottoscrizioni attive
 * POST   /api/bot-subscribe              → crea sottoscrizioni per il canale del broadcaster
 * DELETE /api/bot-subscribe?id=<subId>   → elimina una sottoscrizione specifica
 *
 * Protetto da token mod Twitch (o IUA_SECRET per accesso admin).
 */

import { Redis } from '@upstash/redis';
import { corsHeaders, modAuthGate } from './_modAuth.js';
import { ottieniTokenBot, ottieniAppToken } from './_botHelix.js';

const HELIX_EVENTSUB = 'https://api.twitch.tv/helix/eventsub/subscriptions';

/**
 * Crea una singola sottoscrizione EventSub via webhook.
 */
async function creaSubscription({ tipo, versione, condition, token }) {
  const clientId = process.env.CHIAVETWITCH_CLIENT_ID;
  const appUrl   = process.env.VITE_APP_URL || 'https://andryx.it';
  const secret   = process.env.EVENTSUB_SECRET;

  if (!secret) throw new Error('EVENTSUB_SECRET non configurato.');

  const res = await fetch(HELIX_EVENTSUB, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Client-Id':    clientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type:      tipo,
      version:   versione || '1',
      condition,
      transport: {
        method:   'webhook',
        callback: `${appUrl}/api/bot-eventsub`,
        secret,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // 409 = già esiste: non è un errore bloccante
    if (res.status === 409) return { giaEsistente: true, tipo };
    throw new Error(`Sottoscrizione ${tipo} fallita: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return { id: data.data?.[0]?.id, tipo, stato: data.data?.[0]?.status };
}

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  // Autenticazione: accetta token mod Twitch o IUA_SECRET come fallback admin
  const authHeader = req.headers.authorization;
  const iuaSecret  = process.env.IUA_SECRET;
  const isAdmin    = iuaSecret && (authHeader === `Bearer ${iuaSecret}` || authHeader === iuaSecret);

  if (!isAdmin) {
    const { isMod } = await modAuthGate(req, redis);
    if (!isMod) return res.status(403).json({ error: 'Accesso non autorizzato.' });
  }

  const clientId = process.env.CHIAVETWITCH_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'CHIAVETWITCH_CLIENT_ID non configurato.' });

  /* ─── GET: lista sottoscrizioni attive ─── */
  if (req.method === 'GET') {
    try {
      const token   = await ottieniAppToken(redis);
      const listRes = await fetch(`${HELIX_EVENTSUB}?first=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id':   clientId,
        },
      });

      if (!listRes.ok) {
        const err = await listRes.text();
        return res.status(listRes.status).json({ error: err });
      }

      const data = await listRes.json();
      return res.status(200).json({
        subscriptions: data.data || [],
        total:         data.total || 0,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── POST: crea sottoscrizioni ─── */
  if (req.method === 'POST') {
    try {
      // broadcaster_id: usa quello passato nel body, altrimenti legge da Redis
      const broadcasterId = String(
        req.body?.broadcaster_id ||
        (await redis.get('mod:broadcaster:id')) ||
        ''
      );

      if (!broadcasterId) {
        return res.status(400).json({ error: 'broadcaster_id obbligatorio. Assicurati che il broadcaster si sia connesso al Mod Panel almeno una volta.' });
      }

      const botUserId = await redis.get('bot:user:id');
      if (!botUserId) {
        return res.status(400).json({ error: 'Bot non autorizzato. Completa prima il flusso OAuth dal Mod Panel → Bot 24/7.' });
      }

      const [botToken, appToken] = await Promise.all([
        ottieniTokenBot(redis),
        ottieniAppToken(redis),
      ]);

      const risultati = [];
      const errori    = [];

      // channel.chat.message — usa bot user token (richiede user:read:chat)
      try {
        const r = await creaSubscription({
          tipo:      'channel.chat.message',
          condition: { broadcaster_user_id: broadcasterId, user_id: String(botUserId) },
          token:     botToken,
        });
        risultati.push(r);
      } catch (e) { errori.push(e.message); }

      // stream.online / stream.offline — usa app token
      for (const tipo of ['stream.online', 'stream.offline']) {
        try {
          const r = await creaSubscription({
            tipo,
            condition: { broadcaster_user_id: broadcasterId },
            token:     appToken,
          });
          risultati.push(r);
        } catch (e) { errori.push(e.message); }
      }

      // channel.follow v2 — usa app token
      try {
        const r = await creaSubscription({
          tipo:      'channel.follow',
          versione:  '2',
          condition: { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId },
          token:     appToken,
        });
        risultati.push(r);
      } catch (e) { errori.push(e.message); }

      // channel.subscribe, channel.subscription.gift, channel.cheer, channel.raid
      const eventiApp = [
        { tipo: 'channel.subscribe',          condition: { broadcaster_user_id: broadcasterId } },
        { tipo: 'channel.subscription.gift',  condition: { broadcaster_user_id: broadcasterId } },
        { tipo: 'channel.cheer',              condition: { broadcaster_user_id: broadcasterId } },
        { tipo: 'channel.raid',               condition: { to_broadcaster_user_id: broadcasterId } },
      ];

      for (const ev of eventiApp) {
        try {
          const r = await creaSubscription({ ...ev, token: appToken });
          risultati.push(r);
        } catch (e) { errori.push(e.message); }
      }

      // Salva broadcaster_id in Redis per uso nei cron
      await redis.set('bot:broadcaster:id', broadcasterId);
      await redis.set('bot:subscriptions:ts', String(Date.now()));

      return res.status(200).json({
        ok:         true,
        sottoscritte: risultati,
        errori,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── DELETE: elimina una sottoscrizione ─── */
  if (req.method === 'DELETE') {
    const subId = req.query?.id || req.body?.id;
    if (!subId) return res.status(400).json({ error: 'id sottoscrizione obbligatorio.' });

    try {
      const token  = await ottieniAppToken(redis);
      const delRes = await fetch(`${HELIX_EVENTSUB}?id=${encodeURIComponent(subId)}`, {
        method:  'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id':   clientId,
        },
      });

      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.text();
        return res.status(delRes.status).json({ error: err });
      }

      return res.status(200).json({ ok: true, id: subId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
