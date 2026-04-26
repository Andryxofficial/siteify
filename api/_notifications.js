import { Redis } from '@upstash/redis';
import webpush from 'web-push';
import { createHash } from 'crypto';

const PREF_DEFAULTS = {
  push: true,
  inApp: true,
  sound: true,
  vibration: true,
  quietHours: false,
  quietStart: '22:30',
  quietEnd: '08:00',
  categories: {
    messages: true,
    replies: true,
    likes: true,
    friends: true,
    community: true,
    live: true,
    system: true,
  },
};

const VALID_CATEGORIES = new Set(Object.keys(PREF_DEFAULTS.categories));
const MAX_TITLE = 90;
const MAX_BODY = 220;
const MAX_URL = 300;
const MAX_SUBS_PER_USER = 8;

export function getRedisFromEnv() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) throw new Error('Database non configurato.');
  return new Redis({ url: kvUrl, token: kvToken });
}

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function configureWebPush() {
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@andryxify.it',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  return true;
}

export async function validateTwitch(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.login ? { login: data.login, userId: data.user_id || null } : null;
  } catch {
    return null;
  }
}

function hashEndpoint(endpoint) {
  return createHash('sha256').update(String(endpoint || '')).digest('hex').slice(0, 32);
}

function cleanString(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function safeUrl(value) {
  const raw = cleanString(value || '/', MAX_URL);
  if (!raw) return '/';
  try {
    if (raw.startsWith('/')) return raw;
    const u = new URL(raw);
    if (u.hostname === 'andryxify.it') return `${u.pathname}${u.search}${u.hash}` || '/';
  } catch { /* fallback */ }
  return '/';
}

function mergePrefs(raw) {
  return {
    ...PREF_DEFAULTS,
    ...(raw || {}),
    categories: {
      ...PREF_DEFAULTS.categories,
      ...(raw?.categories || {}),
    },
  };
}

function sanitizzaPrefs(raw) {
  const merged = mergePrefs(raw);
  const categories = {};
  for (const key of Object.keys(PREF_DEFAULTS.categories)) {
    categories[key] = merged.categories?.[key] !== false;
  }
  return {
    push: merged.push !== false,
    inApp: merged.inApp !== false,
    sound: merged.sound !== false,
    vibration: merged.vibration !== false,
    quietHours: !!merged.quietHours,
    quietStart: /^\d{2}:\d{2}$/.test(merged.quietStart || '') ? merged.quietStart : PREF_DEFAULTS.quietStart,
    quietEnd: /^\d{2}:\d{2}$/.test(merged.quietEnd || '') ? merged.quietEnd : PREF_DEFAULTS.quietEnd,
    categories,
  };
}

function minutiDaHHMM(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function inQuietHours(prefs, now = new Date()) {
  if (!prefs.quietHours) return false;
  const start = minutiDaHHMM(prefs.quietStart);
  const end = minutiDaHHMM(prefs.quietEnd);
  if (start === null || end === null || start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export async function getPrefs(redis, login) {
  const raw = await redis.get(`notifications:prefs:${login}`);
  try {
    return sanitizzaPrefs(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return sanitizzaPrefs(null);
  }
}

export async function setPrefs(redis, login, prefs) {
  const clean = sanitizzaPrefs(prefs);
  await redis.set(`notifications:prefs:${login}`, JSON.stringify(clean));
  return clean;
}

export async function saveSubscription(redis, login, subscription, prefs = null) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('Subscription push non valida.');
  }
  const endpointHash = hashEndpoint(subscription.endpoint);
  const key = `notifications:subs:${login}`;
  const now = Date.now();
  const record = {
    endpointHash,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime || null,
    userAgent: cleanString(subscription.userAgent || '', 180),
    createdAt: now,
    updatedAt: now,
  };

  const current = await redis.hgetall(key);
  const entries = Object.entries(current || {});
  if (entries.length >= MAX_SUBS_PER_USER && !current?.[endpointHash]) {
    const parsed = entries
      .map(([hash, value]) => {
        try {
          const obj = typeof value === 'string' ? JSON.parse(value) : value;
          return { hash, updatedAt: Number(obj?.updatedAt || 0) };
        } catch { return { hash, updatedAt: 0 }; }
      })
      .sort((a, b) => a.updatedAt - b.updatedAt);
    const daRimuovere = parsed.slice(0, Math.max(1, entries.length - MAX_SUBS_PER_USER + 1));
    await Promise.all(daRimuovere.map(x => redis.hdel(key, x.hash)));
  }

  await redis.hset(key, { [endpointHash]: JSON.stringify(record) });
  if (prefs) await setPrefs(redis, login, prefs);
  return { endpointHash };
}

export async function removeSubscription(redis, login, endpoint) {
  if (!endpoint) {
    await redis.del(`notifications:subs:${login}`);
    return { removed: true, all: true };
  }
  await redis.hdel(`notifications:subs:${login}`, hashEndpoint(endpoint));
  return { removed: true, all: false };
}

export async function countSubscriptions(redis, login) {
  const subs = await redis.hgetall(`notifications:subs:${login}`);
  return Object.keys(subs || {}).length;
}

function buildPayload(payload = {}, prefs = PREF_DEFAULTS) {
  const category = VALID_CATEGORIES.has(payload.category) ? payload.category : 'system';
  return {
    title: cleanString(payload.title || 'ANDRYXify', MAX_TITLE),
    body: cleanString(payload.body || 'Nuovo aggiornamento disponibile.', MAX_BODY),
    url: safeUrl(payload.url || '/'),
    tag: cleanString(payload.tag || `andryxify-${category}`, 80),
    category,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    silent: prefs.sound === false,
    vibrate: prefs.vibration === false ? [] : [90, 40, 90],
    timestamp: Date.now(),
  };
}

export async function sendNotificationToUser(redis, login, payload, { force = false } = {}) {
  if (!configureWebPush()) {
    return { ok: false, reason: 'VAPID non configurato', sent: 0, removed: 0 };
  }

  const prefs = await getPrefs(redis, login);
  const category = VALID_CATEGORIES.has(payload?.category) ? payload.category : 'system';
  if (!force) {
    if (prefs.push === false) return { ok: true, skipped: 'push_disabled', sent: 0, removed: 0 };
    if (prefs.categories?.[category] === false) return { ok: true, skipped: 'category_disabled', sent: 0, removed: 0 };
    if (inQuietHours(prefs)) return { ok: true, skipped: 'quiet_hours', sent: 0, removed: 0 };
  }

  const subs = await redis.hgetall(`notifications:subs:${login}`);
  const entries = Object.entries(subs || {});
  if (!entries.length) return { ok: true, skipped: 'no_subscriptions', sent: 0, removed: 0 };

  const body = JSON.stringify(buildPayload(payload, prefs));
  let sent = 0;
  let removed = 0;
  const errors = [];

  await Promise.all(entries.map(async ([hash, raw]) => {
    let sub;
    try { sub = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { await redis.hdel(`notifications:subs:${login}`, hash); removed++; return; }

    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 60 * 60 });
      sent++;
      sub.updatedAt = Date.now();
      await redis.hset(`notifications:subs:${login}`, { [hash]: JSON.stringify(sub) });
    } catch (err) {
      const statusCode = err?.statusCode || err?.status;
      if (statusCode === 404 || statusCode === 410) {
        await redis.hdel(`notifications:subs:${login}`, hash);
        removed++;
      } else {
        errors.push({ hash, statusCode, message: err?.message || 'Errore push' });
      }
    }
  }));

  return { ok: errors.length === 0, sent, removed, errors };
}

export async function notifyEvent(login, payload, options = {}) {
  if (!login) return { ok: true, skipped: 'missing_user', sent: 0, removed: 0 };
  const redis = options.redis || getRedisFromEnv();
  return sendNotificationToUser(redis, login, payload, options);
}
