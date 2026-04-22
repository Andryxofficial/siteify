/**
 * Andryx Hourglass — Salvataggio localStorage versionato.
 * Schema:
 *   { v, sceneId, hp, maxHp, rupees, items{}, flags{}, score, elapsedMs, oceanFloor }
 */
const KEY = 'andryxify_hourglass_save_v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch { return null; }
}

export function saveSave(state) {
  try {
    const data = {
      v: 1,
      sceneId: state.sceneId,
      hp: state.hp,
      maxHp: state.maxHp,
      rupees: state.rupees,
      items: state.items,
      flags: state.flags,
      score: state.score,
      elapsedMs: state.elapsedMs,
      oceanFloor: state.oceanFloor || 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* ignored: quota / privacy mode */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignored */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
