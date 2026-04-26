import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const RADICE = 'ikigai:custodia:v1';
const VERSIONE = 1;
const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const LIMITE_EVENTI = 80;

function segreto() {
  const valore = process.env.IKIGAI_CUSTODIA_SECRET || process.env.JWT_SECRET || process.env.TWITCH_CLIENT_SECRET;
  if (!valore || valore.length < 24) return null;
  return crypto.createHash('sha256').update(valore).digest();
}

function purifica(valore, massimo = 500) {
  return String(valore || '')
    .normalize('NFKC')
    .replace(/[\x00-\x1F]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, massimo);
}

function impronta(valore) {
  const sale = process.env.IKIGAI_HASH_SALT || process.env.IKIGAI_CUSTODIA_SECRET || 'andryxify-ikigai-sale-locale';
  return crypto.createHmac('sha256', sale).update(String(valore || 'anonimo')).digest('hex').slice(0, 48);
}

function chiaveProfilo(idCustodia) { return `${RADICE}:profilo:${idCustodia}`; }
function chiaveEventi(idCustodia) { return `${RADICE}:eventi:${idCustodia}`; }
function chiaveIndice() { return `${RADICE}:indice`; }

export async function ottieniRedisCustodia() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

export function identificaCustodia(req, corpo = {}) {
  const auth = req?.headers?.authorization || '';
  const twitch = corpo?.twitchUser || corpo?.utente || corpo?.user || '';
  const anon = corpo?.anonId || corpo?.idAnonimo || req?.headers?.['x-ikigai-anon'] || req?.headers?.['x-andryx-client'] || '';
  const base = twitch || auth.replace(/^Bearer\s+/i, '').slice(0, 80) || anon || req?.headers?.['user-agent'] || 'anonimo';
  const tipo = twitch || auth ? 'registrato' : 'anonimo';
  return { idCustodia: impronta(base), tipo };
}

export function cifraOggetto(oggetto) {
  const key = segreto();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const testo = Buffer.from(JSON.stringify(oggetto), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cifrato = Buffer.concat([cipher.update(testo), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: VERSIONE,
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: cifrato.toString('base64'),
  };
}

export function decifraOggetto(payload) {
  const key = segreto();
  if (!key || !payload?.iv || !payload?.tag || !payload?.data) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const chiaro = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
  return JSON.parse(chiaro.toString('utf8'));
}

function profiloVuoto(tipo = 'anonimo') {
  return {
    tipo,
    creatoIl: Date.now(),
    aggiornatoIl: Date.now(),
    optOut: false,
    preferenze: {
      tono: 'naturale',
      profondita: 'media',
      mostraPercorsi: false,
      suggerimentiProattivi: true,
    },
    interessi: {},
    intenti: {},
    pagine: {},
    ultimiEventi: [],
  };
}

export async function leggiProfiloIkigai(redis, idCustodia, tipo = 'anonimo') {
  if (!redis || !idCustodia) return profiloVuoto(tipo);
  try {
    const raw = await redis.get(chiaveProfilo(idCustodia));
    const decifrato = typeof raw === 'string' ? decifraOggetto(JSON.parse(raw)) : decifraOggetto(raw);
    return decifrato || profiloVuoto(tipo);
  } catch {
    return profiloVuoto(tipo);
  }
}

export async function salvaProfiloIkigai(redis, idCustodia, profilo) {
  if (!redis || !idCustodia) return { salvato: false, motivo: 'redis_mancante' };
  const cifrato = cifraOggetto({ ...profilo, aggiornatoIl: Date.now() });
  if (!cifrato) return { salvato: false, motivo: 'segreto_mancante' };
  await redis.set(chiaveProfilo(idCustodia), JSON.stringify(cifrato), { ex: Math.ceil(RETENTION_MS / 1000) });
  await redis.zadd(chiaveIndice(), { score: Date.now(), member: idCustodia });
  return { salvato: true };
}

export async function dimenticaProfiloIkigai(redis, idCustodia) {
  if (!redis || !idCustodia) return { eliminato: false };
  await Promise.allSettled([
    redis.del(chiaveProfilo(idCustodia)),
    redis.del(chiaveEventi(idCustodia)),
    redis.zrem(chiaveIndice(), idCustodia),
  ]);
  return { eliminato: true };
}

export async function registraUsoIkigai(redis, idCustodia, evento = {}) {
  if (!redis || !idCustodia) return { registrato: false };
  const profilo = await leggiProfiloIkigai(redis, idCustodia, evento.tipo || 'anonimo');
  if (profilo.optOut) return { registrato: false, motivo: 'opt_out' };

  const intent = purifica(evento.intent || evento.intento || 'generale', 40);
  const pagina = purifica(evento.pagina || evento.pathname || '', 120);
  const domanda = purifica(evento.domanda || '', 240);
  const termini = Array.isArray(evento.termini) ? evento.termini.slice(0, 12).map(x => purifica(x, 32)).filter(Boolean) : [];

  profilo.intenti[intent] = (profilo.intenti[intent] || 0) + 1;
  if (pagina) profilo.pagine[pagina] = (profilo.pagine[pagina] || 0) + 1;
  for (const termine of termini) profilo.interessi[termine] = (profilo.interessi[termine] || 0) + 1;
  profilo.ultimiEventi = [
    { ts: Date.now(), intent, pagina, domanda: domanda ? crypto.createHash('sha256').update(domanda).digest('hex').slice(0, 16) : '' },
    ...(profilo.ultimiEventi || []),
  ].slice(0, LIMITE_EVENTI);

  await salvaProfiloIkigai(redis, idCustodia, profilo);
  return { registrato: true };
}

export function orientamentoIkigai(profilo = {}) {
  const topIntenti = Object.entries(profilo.intenti || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const topInteressi = Object.entries(profilo.interessi || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const topPagine = Object.entries(profilo.pagine || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return {
    tono: profilo.preferenze?.tono || 'naturale',
    profondita: profilo.preferenze?.profondita || 'media',
    suggerimentiProattivi: profilo.preferenze?.suggerimentiProattivi !== false,
    topIntenti,
    topInteressi,
    topPagine,
  };
}

export async function impostaConsensoIkigai(redis, idCustodia, { optOut = false, preferenze = {} } = {}) {
  const profilo = await leggiProfiloIkigai(redis, idCustodia);
  profilo.optOut = !!optOut;
  profilo.preferenze = { ...profilo.preferenze, ...preferenze };
  await salvaProfiloIkigai(redis, idCustodia, profilo);
  return { ok: true, optOut: profilo.optOut, preferenze: profilo.preferenze };
}
