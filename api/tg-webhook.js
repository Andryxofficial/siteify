import { Redis } from '@upstash/redis';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * tg-webhook.js — Webhook del bot Telegram per ANDRYXify.
 *
 * POST /api/tg-webhook
 *   Riceve gli aggiornamenti del bot inviati da Telegram.
 *   Autenticazione: header X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET
 *
 * Comandi supportati:
 *   /start    → Benvenuto + bottone per aprire la Mini App
 *   /live     → Stato live del canale Andryx (da Redis)
 *   /classifica → Top 5 classifica generale gioco del mese
 *   /aiuto    → Lista comandi disponibili
 *
 * Setup (da eseguire una sola volta dopo il deploy):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook \
 *     ?url=https://andryx.it/api/tg-webhook \
 *     &secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 *
 * Env vars richieste:
 *   TELEGRAM_BOT_TOKEN        — token del bot da @BotFather
 *   TELEGRAM_WEBHOOK_SECRET   — stringa segreta per verificare le richieste Telegram
 *   KV_REST_API_URL / KV_REST_API_TOKEN — Redis Upstash
 *   VITE_APP_URL              — URL pubblico del sito (es. https://andryx.it)
 */

const BOT_APP_URL  = process.env.VITE_APP_URL || 'https://andryx.it';
const MINI_APP_URL = `${BOT_APP_URL}/telegram`;

/** Invia una risposta al bot Telegram. */
async function inviaMessaggio(botToken, chatId, testo, opzioni = {}) {
  const payload = {
    chat_id:    chatId,
    text:       testo,
    parse_mode: 'HTML',
    ...opzioni,
  };
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[tg-webhook] inviaMessaggio errore:', e.message);
  }
}

/** Recupera lo stato live dal Redis (cache aggiornata da api/profile.js). */
async function getLiveStatus(redis) {
  try {
    const raw = await redis.get('live:andryxify');
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/** Recupera i top 5 dalla classifica generale gioco del mese. */
async function getTop5(redis) {
  try {
    const raw = await redis.zrange('lb:general', 0, 4, { rev: true, withScores: true });
    if (!raw || raw.length === 0) return [];
    // Upstash può rispondere come array piatto [member, score, ...] o array di oggetti
    if (typeof raw[0] === 'object' && raw[0] !== null) {
      return raw.map(e => ({ username: e.value ?? e.member ?? '', score: Number(e.score ?? 0) }));
    }
    const result = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      result.push({ username: String(raw[i]), score: Number(raw[i + 1]) });
    }
    return result;
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  // Rispondi subito 200 a Telegram per evitare retry — gestione asincrona
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non supportato.' });
  }

  const botToken       = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret  = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    return res.status(500).json({ error: 'Bot non configurato.' });
  }

  // Verifica header segreto (protezione da richieste spurie)
  if (webhookSecret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'] || '';
    const expectedBuf = Buffer.from(
      createHmac('sha256', webhookSecret).update(webhookSecret).digest('hex'),
      'utf8',
    );
    const actualBuf = Buffer.from(
      createHmac('sha256', webhookSecret).update(incoming).digest('hex'),
      'utf8',
    );
    const valido = expectedBuf.length === actualBuf.length &&
                   timingSafeEqual(expectedBuf, actualBuf);
    if (!valido) {
      return res.status(403).json({ error: 'Token segreto non valido.' });
    }
  }

  // Risposta 200 immediata — Telegram si aspetta risposta entro ~5s
  res.status(200).json({ ok: true });

  // Elaborazione asincrona del messaggio (senza bloccare la risposta HTTP)
  const aggiornamento = req.body || {};
  const messaggio = aggiornamento.message || aggiornamento.edited_message;
  if (!messaggio) return;

  const chatId  = messaggio.chat?.id;
  const testo   = (messaggio.text || '').trim();
  const nome    = messaggio.from?.first_name || 'Utente';

  if (!chatId || !testo.startsWith('/')) return;

  // Inizializza Redis
  let redis = null;
  try {
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (kvUrl && kvToken) redis = new Redis({ url: kvUrl, token: kvToken });
  } catch { /* non bloccante */ }

  const comando = testo.split(' ')[0].toLowerCase().replace(/@\S+$/, '');

  if (comando === '/start') {
    const testoBenvenuto = (
      `🎮 <b>Ciao ${nome}!</b> Benvenuto su <b>ANDRYXify</b>!\n\n` +
      `Sono <b>Andryx</b> — streamer Twitch, gamer e content creator italiano.\n\n` +
      `Cosa trovi qui:\n` +
      `🕹️ <b>Giochi</b> — Andryx Legend, Andryx Jump e il Gioco del Mese\n` +
      `🏆 <b>Classifica</b> — sfida la community in tempo reale\n` +
      `💬 <b>Community</b> — SOCIALify, chat e messaggi privati\n` +
      `📺 <b>Twitch / YouTube</b> — stream live e video\n\n` +
      `Tocca il bottone qui sotto per aprire l'app! 👇`
    );
    await inviaMessaggio(botToken, chatId, testoBenvenuto, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Apri ANDRYXify', web_app: { url: MINI_APP_URL } },
        ]],
      },
    });
    return;
  }

  if (comando === '/live') {
    let risposta;
    if (redis) {
      const live = await getLiveStatus(redis);
      if (live?.live) {
        risposta = (
          `🔴 <b>Andryx è LIVE ora!</b>\n\n` +
          `🎮 ${live.gameName || 'Gioco sconosciuto'}\n` +
          `📝 ${live.title || ''}\n` +
          `👥 ${live.viewerCount || 0} spettatori\n\n` +
          `<a href="https://twitch.tv/andryxify">➡️ Guarda su Twitch</a>`
        );
      } else {
        risposta = `⚫ <b>Andryx non è in live al momento.</b>\n\nSeguilo su Twitch per non perderti le prossime dirette!\n<a href="https://twitch.tv/andryxify">🔔 twitch.tv/andryxify</a>`;
      }
    } else {
      risposta = `📺 Controlla lo stato live direttamente su <a href="https://twitch.tv/andryxify">twitch.tv/andryxify</a>!`;
    }
    await inviaMessaggio(botToken, chatId, risposta, { disable_web_page_preview: true });
    return;
  }

  if (comando === '/classifica') {
    let risposta;
    if (redis) {
      const top5 = await getTop5(redis);
      if (top5.length > 0) {
        const righe = top5.map((e, i) => {
          const medaglia = ['🥇','🥈','🥉','4️⃣','5️⃣'][i] || `${i+1}.`;
          return `${medaglia} <b>${e.username}</b> — ${e.score.toLocaleString('it-IT')} pt`;
        }).join('\n');
        risposta = `🏆 <b>Top 5 classifica generale:</b>\n\n${righe}\n\n<a href="${MINI_APP_URL}">➡️ Vedi classifica completa</a>`;
      } else {
        risposta = `🏆 La classifica è ancora vuota — sii il primo a giocare!\n\n<a href="${MINI_APP_URL}">🎮 Gioca ora</a>`;
      }
    } else {
      risposta = `🏆 Consulta la classifica completa su <a href="${MINI_APP_URL}">ANDRYXify</a>!`;
    }
    await inviaMessaggio(botToken, chatId, risposta, { disable_web_page_preview: true });
    return;
  }

  if (comando === '/aiuto' || comando === '/help') {
    const risposta = (
      `ℹ️ <b>Comandi disponibili:</b>\n\n` +
      `/start — Apri l'app ANDRYXify\n` +
      `/live — Controlla se Andryx è in live\n` +
      `/classifica — Top 5 giocatori\n` +
      `/aiuto — Mostra questa lista\n\n` +
      `Oppure tocca il bottone per aprire l'app direttamente 👇`
    );
    await inviaMessaggio(botToken, chatId, risposta, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Apri ANDRYXify', web_app: { url: MINI_APP_URL } },
        ]],
      },
    });
    return;
  }

  // Comando sconosciuto: suggerisce /aiuto
  await inviaMessaggio(botToken, chatId,
    `❓ Comando non riconosciuto. Usa /aiuto per vedere i comandi disponibili.`
  );
}
