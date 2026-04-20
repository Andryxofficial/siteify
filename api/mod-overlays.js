import { Redis } from '@upstash/redis';
import { corsHeaders, modAuthGate } from './_modAuth.js';

/**
 * mod-overlays.js — Overlay OBS: gestione slug e payload dati.
 *
 * Endpoint pubblico (no auth) per la lettura, protetto per la scrittura.
 *
 * GET  /api/mod-overlays?type=goals|events&slug=<slug>
 *      → payload pubblico per browser source OBS
 *
 * GET  /api/mod-overlays?action=list  (+ auth mod)
 *      → lista overlay con slug e URL
 *
 * POST /api/mod-overlays  { action: 'regenerate', type }  (auth mod)
 *      → rigenera slug per tipo
 *
 * POST /api/mod-overlays  { action: 'save_goals', goals: [{label,current,target,color}] }
 *      → salva/aggiorna obiettivi
 *
 * POST /api/mod-overlays  { action: 'push_event', event: {type,user,message,ts} }
 *      → spinge un evento nella coda (usato dal browser-bot)
 *
 * Redis:
 *   mod:overlay:slug:<type>   → String  slug casuale 12 caratteri
 *   mod:overlay:goals         → String  JSON array di obiettivi
 *   mod:overlay:events        → List   ultimi 10 eventi (LPUSH+LTRIM)
 */

const OVERLAY_TYPES = ['goals', 'events', 'alerts'];
const SLUG_PREFIX   = 'mod:overlay:slug:';
const GOALS_KEY     = 'mod:overlay:goals';
const EVENTS_KEY    = 'mod:overlay:events';

function generateSlug() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

async function getOrCreateSlug(redis, type) {
  let slug = await redis.get(`${SLUG_PREFIX}${type}`);
  if (!slug) {
    slug = generateSlug();
    await redis.set(`${SLUG_PREFIX}${type}`, slug);
  }
  return String(slug);
}

export default async function handler(req, res) {
  corsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'Database non configurato.' });

  const redis = new Redis({ url: kvUrl, token: kvToken });

  /* ─── GET pubblico: payload per OBS ─── */
  if (req.method === 'GET' && req.query?.type && req.query?.slug) {
    const type = req.query.type;
    const slug = req.query.slug;
    if (!OVERLAY_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo overlay non valido.' });

    const storedSlug = await redis.get(`${SLUG_PREFIX}${type}`).catch(() => null);
    if (!storedSlug || String(storedSlug) !== slug) {
      return res.status(403).json({ error: 'Slug non valido.' });
    }

    try {
      if (type === 'goals') {
        const raw = await redis.get(GOALS_KEY);
        const goals = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        return res.status(200).json({ goals });
      }
      if (type === 'events' || type === 'alerts') {
        const rawEvents = await redis.lrange(EVENTS_KEY, 0, 9);
        const events = (rawEvents || []).map(e => {
          try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
        }).filter(Boolean);
        return res.status(200).json({ events });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── GET autenticato: lista overlay ─── */
  if (req.method === 'GET' && req.query?.action === 'list') {
    const { twitchUser, isMod } = await modAuthGate(req, redis);
    if (!twitchUser) return res.status(401).json({ error: 'Token mancante.' });
    if (!isMod)      return res.status(403).json({ error: 'Accesso riservato.' });

    try {
      const origin = req.headers.origin || req.headers.host || '';
      const base = origin.startsWith('http') ? origin : `https://${origin}`;

      const overlays = await Promise.all(OVERLAY_TYPES.map(async type => {
        const slug = await getOrCreateSlug(redis, type);
        return { type, slug, url: `${base}/overlay/${type}?slug=${slug}` };
      }));

      const rawGoals = await redis.get(GOALS_KEY);
      const goals = rawGoals ? (typeof rawGoals === 'string' ? JSON.parse(rawGoals) : rawGoals) : [];

      return res.status(200).json({ overlays, goals });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─── POST (tutte le azioni richiedono auth) ─── */
  if (req.method === 'POST') {
    const { twitchUser, isMod } = await modAuthGate(req, redis);
    if (!twitchUser) return res.status(401).json({ error: 'Token mancante.' });
    if (!isMod)      return res.status(403).json({ error: 'Accesso riservato.' });

    const body = req.body || {};

    if (body.action === 'regenerate') {
      const { type } = body;
      if (!OVERLAY_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo non valido.' });
      const newSlug = generateSlug();
      await redis.set(`${SLUG_PREFIX}${type}`, newSlug);
      return res.status(200).json({ ok: true, type, slug: newSlug });
    }

    if (body.action === 'save_goals') {
      const { goals } = body;
      if (!Array.isArray(goals)) return res.status(400).json({ error: 'goals deve essere un array.' });
      const sanitized = goals.slice(0, 6).map(g => ({
        label:   String(g.label   || '').slice(0, 40),
        current: Math.max(0, parseInt(g.current) || 0),
        target:  Math.max(1, parseInt(g.target)  || 100),
        color:   /^#[0-9A-Fa-f]{6}$/.test(g.color) ? g.color : '#E040FB',
      }));
      await redis.set(GOALS_KEY, JSON.stringify(sanitized));
      return res.status(200).json({ ok: true, goals: sanitized });
    }

    if (body.action === 'push_event') {
      const { event } = body;
      if (!event || !event.type) return res.status(400).json({ error: 'event.type obbligatorio.' });
      const entry = JSON.stringify({
        type:    event.type,
        user:    String(event.user    || '').slice(0, 50),
        message: String(event.message || '').slice(0, 200),
        ts:      new Date().toISOString(),
      });
      await redis.lpush(EVENTS_KEY, entry);
      await redis.ltrim(EVENTS_KEY, 0, 9);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Azione non riconosciuta.' });
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
