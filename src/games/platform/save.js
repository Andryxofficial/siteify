/**
 * Andryx Jump — salvataggio localStorage versionato.
 *
 * Persiste:
 *   – mondi sbloccati (quanti mondi ha sbloccato il giocatore)
 *   – livelli completati per ciascun mondo
 *   – monete totali raccolte (cumulativo, mai decremento)
 *   – vite correnti
 *   – record personali per livello (tempo più basso e punteggio più alto)
 *   – stato della partita corrente (mondo/livello attivo, monete sessione, score sessione)
 */

const SAVE_KEY = 'andryxify_platform_save_v1';
const VERSION = 1;

/** Carica il salvataggio. Restituisce null se assente o incompatibile. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

/** Salva lo stato della partita. */
export function saveSave(state) {
  try {
    const data = {
      version: VERSION,
      ts: Date.now(),
      // progresso globale
      worldsUnlocked: state.worldsUnlocked || 1,
      completedLevels: state.completedLevels || {}, // { "1-1": true, "1-2": true, ... }
      totalCoins: state.totalCoins || 0,
      lives: state.lives ?? 3,
      bestTimes: state.bestTimes || {}, // { "1-1": 45.3, ... }
      bestScores: state.bestScores || {}, // { "1-1": 12000, ... }
      totalScore: state.totalScore || 0,
      // partita in corso
      currentWorld: state.currentWorld || 1,
      currentLevel: state.currentLevel || 1,
      sessionScore: state.sessionScore || 0,
      sessionCoins: state.sessionCoins || 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Cancella il salvataggio. */
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignored */ }
}

/** True se esiste un salvataggio caricabile. */
export function hasSave() {
  return !!loadSave();
}

/** Crea uno stato salvataggio iniziale (nuova partita). */
export function newSave() {
  return {
    worldsUnlocked: 1,
    completedLevels: {},
    totalCoins: 0,
    lives: 3,
    bestTimes: {},
    bestScores: {},
    totalScore: 0,
    currentWorld: 1,
    currentLevel: 1,
    sessionScore: 0,
    sessionCoins: 0,
  };
}
