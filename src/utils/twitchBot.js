/**
 * twitchBot.js — Client IRC WebSocket lato browser per il Mod Panel.
 *
 * Si connette a wss://irc-ws.chat.twitch.tv usando il token OAuth dello streamer.
 * Funziona come bot di chat finché la tab del Mod Panel è aperta.
 *
 * Utilizzo:
 *   const bot = createTwitchBot({ token, username, channel, onMessage, onStatus });
 *   bot.connect();
 *   bot.send('Ciao chat! 👋');
 *   bot.disconnect();
 *
 * Funzionalità:
 *   - Risposta automatica ai comandi (!trigger) con controllo permessi
 *   - Timer automatici (invio messaggi a intervalli configurabili)
 *   - Contatori incrementali (!morti, !rage, ecc.)
 *   - Citazioni random (!quote, !quote N)
 */

const IRC_WS_URL    = 'wss://irc-ws.chat.twitch.tv:443';
const RECONNECT_MS  = 5000;
const PING_INTERVAL = 60_000; // PING ogni 60s per tenere viva la connessione

export function createTwitchBot({ token, username, channel, onMessage, onStatus, onRawLine }) {
  let ws          = null;
  let destroyed   = false;
  let erroreAuth  = false; // flag: disconnessione causata da errore di autenticazione IRC
  let pingTimer   = null;
  let reconnTimer = null;
  let commandData = { commands: [], timers: [], quotes: [], counters: [] };
  let timerHandles = [];
  const cooldowns = new Map(); // trigger → lastUsedTs

  // Stato interno
  let statusValue = 'disconnected';

  function setStatus(s) {
    statusValue = s;
    onStatus?.(s);
  }

  function stopTimers() {
    timerHandles.forEach(h => clearInterval(h));
    timerHandles = [];
  }

  function startTimers(timers, sendFn) {
    stopTimers();
    (timers || []).filter(t => t.enabled).forEach(t => {
      const ms = Math.max(60, t.interval || 300) * 1000;
      const h = setInterval(() => {
        sendFn(t.message);
      }, ms);
      timerHandles.push(h);
    });
  }

  function canUseCommand(cmd, userPerms) {
    // userPerms: { isMod, isVip, isSub, isBroadcaster }
    const p = cmd.permission || 'everyone';
    if (p === 'everyone')   return true;
    if (p === 'subscriber') return userPerms.isSub || userPerms.isVip || userPerms.isMod || userPerms.isBroadcaster;
    if (p === 'vip')        return userPerms.isVip || userPerms.isMod || userPerms.isBroadcaster;
    if (p === 'mod')        return userPerms.isMod || userPerms.isBroadcaster;
    return false;
  }

  function parseTags(rawTags) {
    if (!rawTags) return {};
    const tags = {};
    rawTags.split(';').forEach(pair => {
      const [k, v] = pair.split('=');
      tags[k] = v;
    });
    return tags;
  }

  function sendMsg(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(`PRIVMSG #${channel} :${text}`);
  }

  async function handleCommand(triggerRaw, args, userPerms, userLogin) {
    const { commands, quotes, counters } = commandData;

    // Comandi built-in
    if (triggerRaw === 'quote') {
      if (!quotes?.length) { sendMsg('Nessuna citazione disponibile.'); return; }
      const n = parseInt(args[0]);
      const q = (!isNaN(n) && n >= 1 && n <= quotes.length)
        ? quotes[n - 1]
        : quotes[Math.floor(Math.random() * quotes.length)];
      const idx = quotes.indexOf(q) + 1;
      sendMsg(`💬 #${idx}: "${q.text}" ${q.addedAt ? `(${new Date(q.addedAt).toLocaleDateString('it-IT')})` : ''}`);
      return;
    }

    // Contatori
    const counter = (counters || []).find(c => c.name === triggerRaw);
    if (counter) {
      // Aggiorna contatore via API
      try {
        await fetch('/api/mod-commands', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: 'counter', key: counter.name, delta: 1 }),
        }).then(r => r.json()).then(d => {
          sendMsg(`${counter.label || counter.name}: ${d.value}`);
        });
      } catch { /* fallback silenzioso */ }
      return;
    }

    // Comandi custom
    const cmd = (commands || []).find(c => c.trigger === triggerRaw);
    if (!cmd) return;

    // Controlla cooldown
    const lastUsed = cooldowns.get(triggerRaw) || 0;
    const cdMs = (cmd.cooldown || 0) * 1000;
    if (Date.now() - lastUsed < cdMs) return;

    // Controlla permessi
    if (!canUseCommand(cmd, userPerms)) return;

    cooldowns.set(triggerRaw, Date.now());
    sendMsg(cmd.response);
  }

  function processLine(line) {
    onRawLine?.(line);

    if (line === 'PING :tmi.twitch.tv') {
      ws.send('PONG :tmi.twitch.tv');
      return;
    }

    // Errori fatali di autenticazione IRC: interrompi la connessione senza riprovare.
    // Il pattern controlla il formato IRC standard (:server NOTICE * :msg o :server NOTICE #ch :msg)
    // per evitare falsi positivi su messaggi di chat contenenti la parola NOTICE.
    if (/NOTICE [*#][^ ]* :/.test(line) && (
      line.includes('Login authentication failed') ||
      line.includes('Improperly formatted auth') ||
      line.includes('Invalid NICK')
    )) {
      erroreAuth = true;
      destroyed  = true;
      ws?.close();
      setStatus('error');
      return;
    }

    if (line.includes('PRIVMSG')) {
      // Formato: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :!comando args
      const tagMatch = line.match(/^@([^ ]+) /);
      const tags = tagMatch ? parseTags(tagMatch[1]) : {};
      const msgMatch = line.match(/:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)$/);
      if (!msgMatch) return;
      const userLogin = msgMatch[1].toLowerCase();
      const text = msgMatch[2];

      // Determina permessi dal messaggio
      const badgesRaw = tags.badges || '';
      const isMod       = badgesRaw.includes('moderator') || userLogin === channel;
      const isBroadcaster = userLogin === channel;
      const isVip       = badgesRaw.includes('vip');
      const isSub       = badgesRaw.includes('subscriber') || tags.subscriber === '1';
      const userPerms   = { isMod, isBroadcaster, isVip, isSub };

      onMessage?.({ user: userLogin, text, tags, userPerms });

      if (text.startsWith('!')) {
        const parts   = text.slice(1).split(' ');
        const trigger = parts[0].toLowerCase();
        const args    = parts.slice(1);
        handleCommand(trigger, args, userPerms, userLogin);
      }
    }
  }

  function connect() {
    if (destroyed) return;
    erroreAuth = false;
    setStatus('connecting');

    ws = new WebSocket(IRC_WS_URL);

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      ws.send(`PASS oauth:${token}`);
      ws.send(`NICK ${username}`);
      ws.send(`JOIN #${channel}`);

      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send('PING :tmi.twitch.tv');
      }, PING_INTERVAL);
    };

    ws.onclose = () => {
      clearInterval(pingTimer);
      // Preserva lo stato 'error' se la chiusura è causata da un errore di autenticazione
      if (!erroreAuth) setStatus('disconnected');
      if (!destroyed && !erroreAuth) {
        reconnTimer = setTimeout(() => connect(), RECONNECT_MS);
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onmessage = (e) => {
      const lines = e.data.split('\r\n').filter(Boolean);
      for (const line of lines) {
        if (line.includes(':Welcome, GLHF!') || line.includes('001')) {
          setStatus('connected');
          startTimers(commandData.timers, sendMsg);
        }
        processLine(line);
      }
    };
  }

  function disconnect() {
    destroyed = true;
    clearInterval(pingTimer);
    clearTimeout(reconnTimer);
    stopTimers();
    ws?.close();
    setStatus('disconnected');
  }

  function updateData(data) {
    commandData = { ...commandData, ...data };
    // Riavvia i timer con la nuova configurazione
    if (statusValue === 'connected') {
      startTimers(commandData.timers, sendMsg);
    }
  }

  return { connect, disconnect, send: sendMsg, updateData, getStatus: () => statusValue };
}
