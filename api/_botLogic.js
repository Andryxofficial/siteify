/**
 * _botLogic.js — Logica condivisa dei comandi bot (lato server).
 *
 * Estratta da src/utils/twitchBot.js (che resta invariato come tester browser).
 * I cooldown sono persistenti su Redis: sopravvivono ai cold start Vercel.
 */

const COMMANDS_KEY = 'mod:commands';
const QUOTES_KEY   = 'mod:quotes';
const COUNTERS_KEY = 'mod:counters';
const TIMERS_KEY   = 'mod:timers';

/** Controlla se un utente ha i permessi per usare un comando. */
export function puoUsareComando(cmd, userPerms) {
  const p = cmd.permission || 'everyone';
  if (p === 'everyone')   return true;
  if (p === 'subscriber') return userPerms.isSub || userPerms.isVip || userPerms.isMod || userPerms.isBroadcaster;
  if (p === 'vip')        return userPerms.isVip || userPerms.isMod || userPerms.isBroadcaster;
  if (p === 'mod')        return userPerms.isMod || userPerms.isBroadcaster;
  return false;
}

/**
 * Esegue un comando bot.
 *
 * @param {object} opts
 * @param {string}   opts.trigger    - trigger del comando (senza !)
 * @param {string[]} opts.args       - argomenti del comando
 * @param {object}   opts.userPerms  - { isMod, isVip, isSub, isBroadcaster }
 * @param {string}   opts.userLogin  - login Twitch dell'utente
 * @param {string}   opts.canale     - nome canale (usato per namespace cooldown)
 * @param {object}   opts.redis      - istanza @upstash/redis
 * @param {function} opts.invia      - async (testo: string) => void
 * @returns {Promise<boolean>} true se il comando è stato eseguito
 */
export async function eseguiComando({ trigger, args, userPerms, userLogin, canale, redis, invia }) {
  // Carica dati dalla stessa struttura Redis usata da mod-commands.js
  const [commandsRaw, quotesRaw, countersRaw] = await Promise.all([
    redis.hgetall(COMMANDS_KEY),
    redis.lrange(QUOTES_KEY, 0, -1),
    redis.hgetall(COUNTERS_KEY),
  ]);

  const commands = [];
  if (commandsRaw) {
    for (const [t, val] of Object.entries(commandsRaw)) {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        commands.push({ trigger: t, ...parsed });
      } catch {
        commands.push({ trigger: t, response: String(val), cooldown: 0, permission: 'everyone' });
      }
    }
  }

  const quotes = (quotesRaw || []).map(q => {
    try { return typeof q === 'string' ? JSON.parse(q) : q; }
    catch { return { text: String(q), addedAt: null }; }
  });

  const counters = [];
  if (countersRaw) {
    for (const [name, val] of Object.entries(countersRaw)) {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        counters.push({ name, ...parsed });
      } catch {
        counters.push({ name, value: parseInt(val) || 0, label: name });
      }
    }
  }

  // Comando built-in: !quote
  if (trigger === 'quote') {
    if (!quotes.length) { await invia('Nessuna citazione disponibile.'); return true; }
    const n = parseInt(args[0]);
    const q = (!isNaN(n) && n >= 1 && n <= quotes.length)
      ? quotes[n - 1]
      : quotes[Math.floor(Math.random() * quotes.length)];
    const idx = quotes.findIndex(x => x === q) + 1;
    await invia(`💬 #${idx}: "${q.text}" ${q.addedAt ? `(${new Date(q.addedAt).toLocaleDateString('it-IT')})` : ''}`);
    return true;
  }

  // Contatori
  const counter = counters.find(c => c.name === trigger);
  if (counter) {
    try {
      const raw = await redis.hget(COUNTERS_KEY, counter.name);
      const current = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { value: 0, label: counter.name };
      const nuovoValore = Math.max(0, (current.value || 0) + 1);
      await redis.hset(COUNTERS_KEY, { [counter.name]: JSON.stringify({ ...current, value: nuovoValore }) });
      await invia(`${current.label || counter.name}: ${nuovoValore}`);
    } catch { /* silenzioso, il contatore potrebbe non esistere più */ }
    return true;
  }

  // Comandi custom
  const cmd = commands.find(c => c.trigger === trigger);
  if (!cmd) return false;

  // Controlla cooldown (chiave Redis con TTL = cooldown secondi)
  const cooldownKey = `bot:cooldown:${canale}:${trigger}`;
  if (cmd.cooldown > 0) {
    const inCooldown = await redis.exists(cooldownKey).catch(() => 0);
    if (inCooldown) return false;
  }

  // Controlla permessi
  if (!puoUsareComando(cmd, userPerms)) return false;

  // Imposta cooldown
  if (cmd.cooldown > 0) {
    await redis.set(cooldownKey, '1', { ex: cmd.cooldown });
  }

  await invia(cmd.response);
  return true;
}

/** Carica tutti i timer dalla cache Redis. */
export async function caricaTimer(redis) {
  const timersRaw = await redis.hgetall(TIMERS_KEY).catch(() => null);
  if (!timersRaw) return [];
  return Object.entries(timersRaw).map(([name, val]) => {
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      return { name, ...parsed };
    } catch {
      return { name, message: String(val), interval: 300, enabled: false };
    }
  });
}
