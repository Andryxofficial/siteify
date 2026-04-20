/**
 * bot-auth-callback.js — Callback OAuth (authorization_code flow) per il bot 24/7.
 *
 * GET /api/bot-auth-callback?code=...&state=...
 *
 * Gestisce due flussi distinti codificati nel parametro `state` (base64 JSON):
 *   { type: 'bot' }          → scambia il codice con token del bot, salva in Redis
 *   { type: 'broadcaster' }  → segna che il broadcaster ha concesso channel:bot
 *
 * Redirect finale: /mod-panel?bot=<esito>&sezione=bot24h
 */

import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  const { code, state, error: oauthError } = req.query;

  // L'utente ha negato l'accesso
  if (oauthError) {
    return res.redirect(302, '/mod-panel?bot=negato&sezione=bot24h');
  }

  if (!code) {
    return res.redirect(302, '/mod-panel?bot=errore&sezione=bot24h');
  }

  const clientId     = process.env.CHIAVETWITCH_CLIENT_ID;
  const clientSecret = process.env.CHIAVETWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.redirect(302, '/mod-panel?bot=no-config&sezione=bot24h');
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.redirect(302, '/mod-panel?bot=no-db&sezione=bot24h');
  }

  // Decodifica state → determina tipo
  let tipo = 'bot';
  try {
    const decoded = JSON.parse(Buffer.from(String(state || ''), 'base64url').toString('utf8'));
    if (decoded.type === 'broadcaster') tipo = 'broadcaster';
  } catch { /* assume 'bot' */ }

  const redis = new Redis({ url: kvUrl, token: kvToken });

  // L'URL di redirect deve essere identico a quello usato per generare il link OAuth
  const appUrl     = process.env.VITE_APP_URL || 'https://andryx.it';
  const redirectUri = `${appUrl}/api/bot-auth-callback`;

  // Scambia il codice con i token
  const tokenBody = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'authorization_code',
    code:          String(code),
    redirect_uri:  redirectUri,
  });

  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[bot-auth-callback] Scambio token fallito:', errText);
      return res.redirect(302, '/mod-panel?bot=token-errore&sezione=bot24h');
    }

    const tokenData = await tokenRes.json();

    // Valida il token per ottenere user_id e login
    const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    });

    if (!validateRes.ok) {
      return res.redirect(302, '/mod-panel?bot=token-non-valido&sezione=bot24h');
    }

    const validateData = await validateRes.json();

    if (tipo === 'bot') {
      const scadeAt = Date.now() + (tokenData.expires_in || 14400) * 1000;

      await Promise.all([
        redis.set('bot:token:access',    tokenData.access_token),
        redis.set('bot:token:refresh',   tokenData.refresh_token),
        redis.set('bot:token:expires_at', String(scadeAt)),
        redis.set('bot:user:id',         String(validateData.user_id)),
        redis.set('bot:user:login',      String(validateData.login).toLowerCase()),
      ]);

      return res.redirect(302, '/mod-panel?bot=ok&sezione=bot24h');
    }

    if (tipo === 'broadcaster') {
      // Salva login del broadcaster e flag di consenso channel:bot
      await Promise.all([
        redis.set('bot:broadcaster:channel_bot_login',   String(validateData.login).toLowerCase()),
        redis.set('bot:broadcaster:channel_bot_granted', '1'),
      ]);

      return res.redirect(302, '/mod-panel?bot=broadcaster-ok&sezione=bot24h');
    }

    return res.redirect(302, '/mod-panel?bot=errore&sezione=bot24h');

  } catch (e) {
    console.error('[bot-auth-callback] Errore:', e);
    return res.redirect(302, '/mod-panel?bot=errore&sezione=bot24h');
  }
}
