/**
 * Andryx Legend — entry-point.
 *
 * Esporta `meta` e `createGame(canvas, callbacks)` secondo il contratto
 * dei moduli giochi (vedi src/games/registry.js), ma vive in un proprio
 * sotto-modulo perche` non e` un gioco mensile: e` il "gioco principale"
 * (sempre disponibile dall'hub /gioco).
 *
 * Differenza dai giochi mensili:
 *   – usa salvataggio localStorage (ripresa partita)
 *   – leaderboard separata (lb:legend:*) lato server
 *   – mondo persistente con piu` zone, dialoghi, quest
 */
import { startEngine } from './engine.js';
import { loadSave, saveSave, clearSave, hasSave } from './save.js';

export const meta = {
  id: 'legend',
  name: 'Andryx Legend',
  emoji: '🗡️',
  description: 'Avventura epica top-down stile Zelda: recupera i 3 Cristalli del Pixel e sconfiggi il Re Ombra.',
  color: '#3a8c3a',
  controls: 'wasd-action',
  instructions: 'WASD/Frecce per muoverti · SPAZIO per attaccare/parlare · Esplora 4 zone, risolvi puzzle, sconfiggi i boss.',
  gameOverTitle: 'Sei caduto in battaglia',
  actionLabel: '⚔️',
};

/**
 * Avvia il gioco. `options.continueSave` decide se riprendere o nuova partita.
 */
export function createGame(canvas, callbacks, options = {}) {
  const savedData = options.continueSave ? loadSave() : null;
  /* Se nuova partita esplicita, cancelliamo il save vecchio */
  if (!options.continueSave && options.fresh) clearSave();

  let lastSaveTs = 0;

  const engine = startEngine(canvas, {
    ...callbacks,
    onScore: (s) => { callbacks.onScore?.(s); maybeAutoSave(); },
    onHpChange: callbacks.onHpChange,
    onGameOver: (s) => {
      /* Su game over o vittoria, cancella il save (la partita e` finita) */
      clearSave();
      callbacks.onGameOver?.(s);
    },
    onInfo: callbacks.onInfo,
  }, {
    savedData,
    onAutoSave: (state) => saveSave(state),
  });

  function maybeAutoSave() {
    const now = Date.now();
    if (now - lastSaveTs > 5000) {
      lastSaveTs = now;
      try { saveSave(engine.getState()); } catch { /* ignored */ }
    }
  }

  return () => engine.cleanup();
}

/* Espongo helper per la GamePage hub (per mostrare "continua partita") */
export { hasSave, loadSave, clearSave };
