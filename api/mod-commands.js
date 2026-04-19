import { Redis } from '@upstash/redis';

/**
 * Mod Commands & Timers API
 *
 * CRUD for chat commands and timers, restricted to whitelisted Twitch users
 * (streamer + moderators).
 *
 * Redis data model:
 *   mod:commands  → Hash  { trigger: JSON string with response, cooldown, permission }
 *   mod:timers    → Hash  { name: JSON string with message, interval, enabled }
 *
 * Permission levels for commands:
 *   "everyone"    — any viewer can use the command
 *   "subscriber"  — only subscribers (and above)
 *   "vip"         — only VIPs (and above)
 *   "mod"         — only moderators and broadcaster
 *
 * Auth: Authorization: Bearer <twitchAccessToken>
 *       User's login must be in MOD_USERNAMES env var (comma-separated).
 *
 * GET    /api/mod-commands                         → list all commands + timers + check isMod
 * POST   /api/mod-commands  { type, ...data }      → create/update a command or timer
 * DELETE /api/mod-commands  { type, key }           → delete a command or timer
 */

const COMMANDS_KEY = 'mod:commands';
const TIMERS_KEY = 'mod:timers';

const MAX_TRIGGER = 50;
const MAX_RESPONSE = 500;
const MAX_TIMER_NAME = 50;
const MAX_TIMER_MSG = 500;
const VALID_PERMISSIONS = ['everyone', 'subscriber', 'vip', 'mod'];

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function getModUsernames() {
  const raw = process.env.MOD_USERNAMES || '';
  return raw
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
}

async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];

  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.login) return null;
  return { login: data.login.toLowerCase() };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'Database non configurato.' });
  }

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch {
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  /* ─── Authenticate ─── */
  const twitchUser = await validateTwitch(req.headers.authorization);
  const modList = getModUsernames();
  const isMod = twitchUser ? modList.includes(twitchUser.login) : false;

  /* ─── GET: list commands + timers ─── */
  if (req.method === 'GET') {
    // Check-only mode: just return isMod status without requiring mod access
    if (req.query?.check === 'true') {
      return res.status(200).json({ isMod, user: twitchUser?.login || null });
    }

    if (!twitchUser) {
      return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
    }
    if (!isMod) {
      return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });
    }

    try {
      const [commandsRaw, timersRaw] = await Promise.all([
        redis.hgetall(COMMANDS_KEY),
        redis.hgetall(TIMERS_KEY),
      ]);

      const commands = [];
      if (commandsRaw) {
        for (const [trigger, val] of Object.entries(commandsRaw)) {
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            commands.push({ trigger, ...parsed });
          } catch {
            commands.push({ trigger, response: String(val), cooldown: 0, permission: 'everyone' });
          }
        }
      }
      commands.sort((a, b) => a.trigger.localeCompare(b.trigger));

      const timers = [];
      if (timersRaw) {
        for (const [name, val] of Object.entries(timersRaw)) {
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            timers.push({ name, ...parsed });
          } catch {
            timers.push({ name, message: String(val), interval: 300, enabled: false });
          }
        }
      }
      timers.sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json({ commands, timers, isMod: true });
    } catch (e) {
      console.error('ModCommands GET error:', e);
      return res.status(500).json({ error: 'Errore nel recupero dei dati.' });
    }
  }

  /* ─── Auth gate for write operations ─── */
  if (!twitchUser) {
    return res.status(401).json({ error: 'Token Twitch mancante o non valido.' });
  }
  if (!isMod) {
    return res.status(403).json({ error: 'Accesso riservato ai moderatori.' });
  }

  /* ─── POST: create/update command or timer ─── */
  if (req.method === 'POST') {
    try {
      const { type } = req.body || {};

      if (type === 'command') {
        const trigger = sanitize(req.body.trigger, MAX_TRIGGER).toLowerCase().replace(/^!/, '');
        const response = sanitize(req.body.response, MAX_RESPONSE);
        const cooldown = Math.max(0, Math.min(3600, parseInt(req.body.cooldown) || 0));
        const permission = VALID_PERMISSIONS.includes(req.body.permission) ? req.body.permission : 'everyone';

        if (!trigger || trigger.length < 1) {
          return res.status(400).json({ error: 'Il trigger del comando è obbligatorio.' });
        }
        if (!response || response.length < 1) {
          return res.status(400).json({ error: 'La risposta del comando è obbligatoria.' });
        }

        await redis.hset(COMMANDS_KEY, { [trigger]: JSON.stringify({ response, cooldown, permission }) });
        return res.status(200).json({ ok: true, trigger, response, cooldown, permission });
      }

      if (type === 'timer') {
        const name = sanitize(req.body.name, MAX_TIMER_NAME).toLowerCase().replace(/\s+/g, '-');
        const message = sanitize(req.body.message, MAX_TIMER_MSG);
        const interval = Math.max(60, Math.min(7200, parseInt(req.body.interval) || 300));
        const enabled = req.body.enabled !== false;

        if (!name || name.length < 1) {
          return res.status(400).json({ error: 'Il nome del timer è obbligatorio.' });
        }
        if (!message || message.length < 1) {
          return res.status(400).json({ error: 'Il messaggio del timer è obbligatorio.' });
        }

        await redis.hset(TIMERS_KEY, { [name]: JSON.stringify({ message, interval, enabled }) });
        return res.status(200).json({ ok: true, name, message, interval, enabled });
      }

      return res.status(400).json({ error: 'Tipo non valido. Usa "command" o "timer".' });
    } catch (e) {
      console.error('ModCommands POST error:', e);
      return res.status(500).json({ error: 'Errore nel salvataggio.' });
    }
  }

  /* ─── DELETE: remove command or timer ─── */
  if (req.method === 'DELETE') {
    try {
      const { type, key } = req.body || {};

      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Chiave mancante.' });
      }

      if (type === 'command') {
        await redis.hdel(COMMANDS_KEY, key);
        return res.status(200).json({ deleted: true, type: 'command', key });
      }

      if (type === 'timer') {
        await redis.hdel(TIMERS_KEY, key);
        return res.status(200).json({ deleted: true, type: 'timer', key });
      }

      return res.status(400).json({ error: 'Tipo non valido. Usa "command" o "timer".' });
    } catch (e) {
      console.error('ModCommands DELETE error:', e);
      return res.status(500).json({ error: 'Errore nella cancellazione.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
