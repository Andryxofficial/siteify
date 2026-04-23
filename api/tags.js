/**
 * /api/tags — endpoint sistema tag intelligente
 *
 * GET  /api/tags
 *      → { popular: [...], macros: [...], following: [...] (se auth), trending: [...] }
 *
 * GET  /api/tags?slug=<slug>
 *      → { tag: { slug, displayName, postCount, followerCount, status, isFollowing },
 *          related: [...] }
 *
 * GET  /api/tags?action=autocomplete&q=<prefix>&limit=8
 *      → { suggestions: [{ slug, postCount, followerCount }] }
 *      Per il TagInput: ricerca prefix sulla zset `tags:popular`.
 *
 * POST /api/tags  { action: 'follow'|'unfollow', slug }
 *      → { ok: true, isFollowing: bool, followerCount: number }
 */

import { Redis } from '@upstash/redis';
import {
  getMacroCategories,
  followTag,
  unfollowTag,
  getFollowedTags,
  validateTag,
} from './_tagSystem.js';

async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.login ? { login: data.login } : null;
  } catch {
    return null;
  }
}

const POPULAR_LIMIT = 24;
const TRENDING_LIMIT = 12;
const RELATED_LIMIT = 6;
const AUTOCOMPLETE_LIMIT = 8;

/**
 * Fetch metadata bulk per una lista di slug. Ritorna oggetti normalizzati.
 */
async function fetchTagMetas(redis, slugs) {
  if (!slugs || slugs.length === 0) return [];
  const metas = await Promise.all(slugs.map(s => redis.hgetall(`tag:meta:${s}`)));
  return slugs.map((slug, i) => {
    const m = metas[i] || {};
    return {
      slug,
      displayName: m.displayName || slug,
      postCount: Number(m.postCount || 0),
      followerCount: Number(m.followerCount || 0),
      status: m.status || 'ok',
      firstUser: m.firstUser || '',
    };
  }).filter(t => t.status !== 'banned');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  /* ───────── GET ───────── */
  if (req.method === 'GET') {
    try {
      const action = req.query?.action;
      const slug = req.query?.slug;

      // ─── Autocomplete: ricerca prefix tra i tag popolari ───
      if (action === 'autocomplete') {
        const q = (req.query?.q || '').toString().toLowerCase().trim();
        if (q.length < 1) return res.status(200).json({ suggestions: [] });
        const valid = validateTag(q.replace(/[^a-z0-9-]/g, ''));
        // Anche se q è "in corso di typing" e non valida, proviamo lo stesso il prefix match
        const limit = Math.min(20, Math.max(1, parseInt(req.query?.limit) || AUTOCOMPLETE_LIMIT));
        // Non c'è ZRANGEBYLEX semplice su Upstash; usiamo top 200 popolari + filtro client-side
        const all = await redis.zrange('tags:popular', 0, 199, { rev: true });
        const matched = (all || [])
          .filter(s => typeof s === 'string' && s.startsWith(q))
          .slice(0, limit);
        const metas = await fetchTagMetas(redis, matched);
        return res.status(200).json({ suggestions: metas, query: q, queryValid: !!valid?.ok });
      }

      // ─── Dettaglio singolo tag ───
      if (slug) {
        const v = validateTag(slug);
        if (!v.ok && v.status === 'banned') {
          return res.status(404).json({ error: 'Tag non valido.' });
        }
        const meta = await redis.hgetall(`tag:meta:${slug}`);
        if (!meta || !meta.slug) {
          return res.status(404).json({ error: 'Tag non trovato.' });
        }
        // Controlla se l'utente segue il tag
        let isFollowing = false;
        const auth = await validateTwitch(req.headers.authorization);
        if (auth) {
          isFollowing = !!(await redis.sismember(`tag:followers:${slug}`, auth.login));
        }
        // Tag correlati: se il tag fa parte di un cluster macro, ritorna i fratelli
        const macros = await getMacroCategories(redis);
        const cluster = macros.find(m => m.tags.includes(slug));
        let related = [];
        if (cluster) {
          related = await fetchTagMetas(redis, cluster.tags.filter(t => t !== slug).slice(0, RELATED_LIMIT));
        }
        return res.status(200).json({
          tag: {
            slug: meta.slug,
            displayName: meta.displayName || meta.slug,
            postCount: Number(meta.postCount || 0),
            followerCount: Number(meta.followerCount || 0),
            status: meta.status || 'ok',
            firstUser: meta.firstUser || '',
            firstUseAt: Number(meta.firstUseAt || 0),
            isFollowing,
          },
          related,
        });
      }

      // ─── Vista generale: popular + trending + macros + following ───
      const [popularSlugs, trendingSlugs, macros] = await Promise.all([
        redis.zrange('tags:popular', 0, POPULAR_LIMIT - 1, { rev: true }),
        redis.zrange('tags:trending', 0, TRENDING_LIMIT - 1, { rev: true }),
        getMacroCategories(redis),
      ]);

      const [popular, trending] = await Promise.all([
        fetchTagMetas(redis, popularSlugs || []),
        fetchTagMetas(redis, trendingSlugs || []),
      ]);

      let following = [];
      const auth = await validateTwitch(req.headers.authorization);
      if (auth) {
        const slugs = await getFollowedTags(redis, auth.login);
        following = await fetchTagMetas(redis, slugs);
        // Ordina per postCount desc
        following.sort((a, b) => b.postCount - a.postCount);
      }

      return res.status(200).json({
        popular,
        trending,
        macros,
        following,
      });
    } catch (e) {
      console.error('[tags] GET error:', e);
      return res.status(500).json({ error: 'Errore nel caricamento dei tag.' });
    }
  }

  /* ───────── POST: follow/unfollow ───────── */
  if (req.method === 'POST') {
    try {
      const auth = await validateTwitch(req.headers.authorization);
      if (!auth) return res.status(401).json({ error: 'Devi effettuare il login con Twitch.' });

      const { action, slug } = req.body || {};
      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: 'slug richiesto.' });
      }
      const v = validateTag(slug);
      if (!v.ok || v.status === 'banned') {
        return res.status(400).json({ error: v.reason || 'Tag non valido.' });
      }
      // Verifica che il tag esista (ha almeno un post)
      const exists = await redis.exists(`tag:meta:${slug}`);
      if (!exists) {
        return res.status(404).json({ error: 'Tag non trovato.' });
      }

      if (action === 'follow') {
        await followTag(redis, auth.login, slug);
      } else if (action === 'unfollow') {
        await unfollowTag(redis, auth.login, slug);
      } else {
        return res.status(400).json({ error: 'Azione non valida.' });
      }

      const followerCount = Number(await redis.hget(`tag:meta:${slug}`, 'followerCount') || 0);
      return res.status(200).json({
        ok: true,
        isFollowing: action === 'follow',
        followerCount: Math.max(0, followerCount),
      });
    } catch (e) {
      console.error('[tags] POST error:', e);
      return res.status(500).json({ error: 'Errore nell\'operazione sul tag.' });
    }
  }

  return res.status(405).json({ error: 'Metodo non supportato.' });
}
