/**
 * _botLogic.js — Logica condivisa dei comandi bot (lato server).
 *
 * Estratta da src/utils/twitchBot.js (che resta invariato come tester browser).
 * I cooldown sono persistenti su Redis: sopravvivono ai cold start Vercel.
 *
 * Due tipi di comandi supportati:
 *   tipo 'comando' (default) → attivati solo con !trigger all'inizio del messaggio
 *   tipo 'keyword'           → attivati quando la parola chiave appare in qualsiasi punto
 *                              del messaggio (case insensitive, word boundary)
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
 * Carica e analizza tutti i comandi da Redis.
 * Ritorna { comandi, keywords, quotes, counters }.
 */
async function caricaComandi(redis) {
  const [commandsRaw, quotesRaw, countersRaw] = await Promise.all([
    redis.hgetall(COMMANDS_KEY),
    redis.lrange(QUOTES_KEY, 0, -1),
    redis.hgetall(COUNTERS_KEY),
  ]);

  const comandi  = []; // tipo 'comando' (trigger con !)
  const keywords = []; // tipo 'keyword' (parola naturale)

  if (commandsRaw) {
    for (const [t, val] of Object.entries(commandsRaw)) {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        const entry = { trigger: t, ...parsed };
        if (entry.tipo === 'keyword') keywords.push(entry);
        else comandi.push(entry);
      } catch {
        comandi.push({ trigger: t, response: String(val), cooldown: 0, permission: 'everyone', tipo: 'comando' });
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

  return { comandi, keywords, quotes, counters };
}

/**
 * Esegue un comando !trigger.
 *
 * @param {object} opts
 * @param {string}   opts.trigger    - trigger del comando (senza !)
 * @param {string[]} opts.args       - argomenti del comando
 * @param {object}   opts.userPerms  - { isMod, isVip, isSub, isBroadcaster }
 * @param {string}   opts.userLogin  - login Twitch dell'utente
 * @param {string}   opts.canale     - nome canale (namespace cooldown)
 * @param {object}   opts.redis      - istanza @upstash/redis
 * @param {function} opts.invia      - async (testo: string) => void
 * @returns {Promise<boolean>} true se il comando è stato eseguito
 */
export async function eseguiComando({ trigger, args, userPerms, userLogin, canale, redis, invia }) {
  void userLogin; // non usato direttamente ma mantenuto per compatibilità futura
  const { comandi, quotes, counters } = await caricaComandi(redis);

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

  // Contatori built-in (ogni contatore risponde a !nomecounter)
  const counter = counters.find(c => c.name === trigger);
  if (counter) {
    try {
      const raw = await redis.hget(COUNTERS_KEY, counter.name);
      const current = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { value: 0, label: counter.name };
      const nuovoValore = Math.max(0, (current.value || 0) + 1);
      await redis.hset(COUNTERS_KEY, { [counter.name]: JSON.stringify({ ...current, value: nuovoValore }) });
      await invia(`${current.label || counter.name}: ${nuovoValore}`);
    } catch { /* silenzioso */ }
    return true;
  }

  // Comandi custom (solo tipo 'comando', non keyword)
  const cmd = comandi.find(c => c.trigger === trigger);
  if (!cmd) return false;

  // Controlla cooldown (chiave Redis con TTL = cooldown secondi)
  const cooldownKey = `bot:cooldown:${canale}:${trigger}`;
  if (cmd.cooldown > 0) {
    const inCooldown = await redis.exists(cooldownKey).catch(() => 0);
    if (inCooldown) return false;
  }

  if (!puoUsareComando(cmd, userPerms)) return false;

  if (cmd.cooldown > 0) {
    await redis.set(cooldownKey, '1', { ex: cmd.cooldown });
  }

  await invia(cmd.response);
  return true;
}

/**
 * Scansiona il testo del messaggio alla ricerca di parole chiave registrate
 * e risponde al primo match trovato (al massimo una risposta per messaggio).
 *
 * La corrispondenza è case-insensitive e avviene a word-boundary, quindi
 * "sito" matcha "ho visitato il sito!" ma non "visitositowebcom".
 *
 * @param {object} opts
 * @param {string}   opts.testo      - testo completo del messaggio
 * @param {object}   opts.userPerms  - { isMod, isVip, isSub, isBroadcaster }
 * @param {string}   opts.userLogin  - login Twitch dell'utente
 * @param {string}   opts.canale     - nome canale (namespace cooldown)
 * @param {object}   opts.redis      - istanza @upstash/redis
 * @param {function} opts.invia      - async (testo: string) => void
 * @returns {Promise<boolean>} true se almeno una keyword ha risposto
 */
export async function eseguiKeywords({ testo, userPerms, userLogin, canale, redis, invia }) {
  void userLogin;
  const { keywords } = await caricaComandi(redis);
  if (!keywords.length) return false;

  const testoNorm = testo.toLowerCase();

  for (const kw of keywords) {
    // Genera regex con word boundary; escapa caratteri speciali della keyword
    const escaped = kw.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'iu');

    if (!re.test(testoNorm)) continue;

    // Controlla cooldown
    const cooldownKey = `bot:cooldown:${canale}:kw:${kw.trigger}`;
    if (kw.cooldown > 0) {
      const inCooldown = await redis.exists(cooldownKey).catch(() => 0);
      if (inCooldown) continue;
    }

    if (!puoUsareComando(kw, userPerms)) continue;

    if (kw.cooldown > 0) {
      await redis.set(cooldownKey, '1', { ex: kw.cooldown });
    }

    await invia(kw.response);
    return true; // una sola risposta per messaggio
  }

  return false;
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
