const EVENT_NAME = 'andryxify:ikigai:agency';
const STORAGE_KEY = 'andryxify_ikigai_agency_v1';

const DEFAULT_STATE = {
  enabled: true,
  quietUntil: 0,
  counters: {},
  lastAdviceAt: {},
  dismissedTopics: {},
};

function now() { return Date.now(); }

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function safeTopic(value = 'generale') {
  return String(value || 'generale').toLowerCase().replace(/[^a-z0-9:_-]/g, '').slice(0, 80) || 'generale';
}

export function emitIkigaiEvent(type, payload = {}) {
  if (typeof window === 'undefined') return;
  const detail = {
    type: safeTopic(type),
    payload: payload && typeof payload === 'object' ? payload : {},
    ts: now(),
    path: window.location?.pathname || '/',
  };
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function recordIkigaiSignal(type, payload = {}) {
  const state = readState();
  const topic = safeTopic(payload.topic || payload.gameId || payload.context || type);
  const key = `${safeTopic(type)}:${topic}`;
  state.counters[key] = {
    count: (state.counters[key]?.count || 0) + 1,
    firstAt: state.counters[key]?.firstAt || now(),
    lastAt: now(),
    payload: {
      topic,
      label: String(payload.label || payload.gameName || payload.title || topic).slice(0, 80),
    },
  };
  writeState(state);
  emitIkigaiEvent(type, { ...payload, topic, count: state.counters[key].count });
  return state.counters[key];
}

export function silenceIkigai(minutes = 20) {
  const state = readState();
  state.quietUntil = now() + Math.max(1, Number(minutes) || 20) * 60_000;
  writeState(state);
  emitIkigaiEvent('agency:silenced', { minutes });
}

export function setIkigaiAgencyEnabled(enabled) {
  const state = readState();
  state.enabled = !!enabled;
  writeState(state);
  emitIkigaiEvent('agency:toggle', { enabled: !!enabled });
}

export function dismissIkigaiTopic(topic, minutes = 90) {
  const state = readState();
  state.dismissedTopics[safeTopic(topic)] = now() + Math.max(1, Number(minutes) || 90) * 60_000;
  writeState(state);
}

export function canIkigaiAdvise(topic, minGapMinutes = 7) {
  const state = readState();
  const t = now();
  const clean = safeTopic(topic);
  if (!state.enabled || state.quietUntil > t) return false;
  if ((state.dismissedTopics[clean] || 0) > t) return false;
  const last = state.lastAdviceAt[clean] || 0;
  return t - last >= Math.max(1, Number(minGapMinutes) || 7) * 60_000;
}

export function markIkigaiAdvised(topic) {
  const state = readState();
  state.lastAdviceAt[safeTopic(topic)] = now();
  writeState(state);
}

export function getIkigaiAgencyState() {
  return readState();
}

export { EVENT_NAME as IKIGAI_AGENCY_EVENT };
