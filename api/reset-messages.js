import { Redis } from '@upstash/redis';

/**
 * Admin — reset dati messaggi privati E2E.
 * Protetto da: Authorization: Bearer <IUA_SECRET>
 *
 * Chiavi Redis gestite:
 *   userkeys:<user>         → chiave pubblica ECDH (associazione dispositivo)
 *   e2e_passkey:<user>      → backup passkey WebAuthn
 *   conversations:<user>    → Sorted Set conversazioni
 *   messages:<u1>:<u2>      → List messaggi cifrati
 *   media:<uuid>            → blob media cifrato
 *   media:<uuid>:meta       → metadati media
 *   sync:<sessionId>        → sessioni sync efimere
 *   sync_code:<code>        → codici sync
 *   msg:counter             → contatore auto-increment ID messaggi
 *
 * GET /api/reset-messages
 *   Ritorna il conteggio delle chiavi per ogni prefisso.
 *
 * POST /api/reset-messages
 *   Body: { "all": true }
 *     Cancella tutti i dati pregressi dei messaggi privati.
 *
 * Utilizzo (curl):
 *   curl -X GET https://www.andryxify.it/api/reset-messages \
 *        -H "Authorization: Bearer <IUA_SECRET>"
 *
 *   curl -X POST https://www.andryxify.it/api/reset-messages \
 *        -H "Authorization: Bearer <IUA_SECRET>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"all": true}'
 */

const PREFISSI = [
  'userkeys:',
  'e2e_passkey:',
  'conversations:',
  'messages:',
  'media:',
  'sync:',
  'sync_code:',
];

/** Raccoglie tutte le chiavi Redis con un dato prefisso tramite SCAN paginato */
async function scanByPrefix(redis, prefix) {
  const keys = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, { match: `${prefix}*`, count: 200 });
    keys.push(...batch);
    cursor = Number(nextCursor);
  } while (cursor !== 0);
  return keys;
}

/** Elimina un array di chiavi a blocchi di 100 (pipeline-friendly) */
async function deleteKeys(redis, keys) {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    if (batch.length > 0) {
      await redis.del(...batch);
      deleted += batch.length;
    }
  }
  return deleted;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ─── Autenticazione admin ─── */
  const secret = process.env.IUA_SECRET;
  const auth   = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  let redis;
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
  } catch {
    return res.status(500).json({ error: 'Errore di connessione al database.' });
  }

  /* ═══════════════════ GET — stato ═══════════════════ */
  if (req.method === 'GET') {
    try {
      const conteggi = {};
      for (const prefix of PREFISSI) {
        const keys = await scanByPrefix(redis, prefix);
        conteggi[prefix] = keys.length;
      }
      const counterExists = await redis.exists('msg:counter');
      conteggi['msg:counter'] = counterExists ? 1 : 0;
      const totale = Object.values(conteggi).reduce((a, b) => a + b, 0);
      return res.status(200).json({ conteggi, totale });
    } catch (e) {
      console.error('reset-messages GET error:', e);
      return res.status(500).json({ error: 'Errore nella lettura delle chiavi.' });
    }
  }

  /* ═══════════════════ POST — reset ═══════════════════ */
  if (req.method === 'POST') {
    const { all } = req.body || {};
    if (!all) {
      return res.status(400).json({ error: 'Specifica { "all": true } per confermare il reset.' });
    }

    try {
      const risultati = {};
      let totaleEliminato = 0;

      for (const prefix of PREFISSI) {
        const keys = await scanByPrefix(redis, prefix);
        const deleted = await deleteKeys(redis, keys);
        risultati[prefix] = deleted;
        totaleEliminato += deleted;
      }

      /* Elimina anche il contatore ID messaggi */
      const counterExisted = await redis.exists('msg:counter');
      if (counterExisted) {
        await redis.del('msg:counter');
        risultati['msg:counter'] = 1;
        totaleEliminato += 1;
      } else {
        risultati['msg:counter'] = 0;
      }

      return res.status(200).json({
        ok: true,
        messaggio: `Reset completato: ${totaleEliminato} chiavi eliminate.`,
        risultati,
        totaleEliminato,
      });
    } catch (e) {
      console.error('reset-messages POST error:', e);
      return res.status(500).json({ error: 'Errore durante il reset.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non consentito.' });
}
