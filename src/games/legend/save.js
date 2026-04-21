/**
 * Save/Load per Andryx Legend.
 * Persistenza in localStorage versionata.
 */

const SAVE_KEY = 'andryxify_legend_save_v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSave(state) {
  try {
    const data = {
      version: 1,
      ts: Date.now(),
      zoneId: state.zoneId,
      px: state.player.x,
      py: state.player.y,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      rupees: state.rupees,
      keys: state.keys,
      bombs: state.bombs,
      potions: state.potions,
      flags: state.flags,
      quest: state.quest,
      kills: state.kills,
      defeatedBosses: Array.from(state.defeatedBosses || []),
      clearedZones: Array.from(state.clearedZones || []),
      mapMutations: state.mapMutations || {},
      elapsedMs: state.elapsedMs || 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignored */ }
}

export function hasSave() {
  return !!loadSave();
}
