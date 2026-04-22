/**
 * Andryx Hourglass — entry-point.
 *
 * Espone `meta` e `createGame(canvas, callbacks)` secondo il contratto
 * dei moduli giochi. Vive in un proprio sotto-modulo perche` non e` un
 * gioco mensile: e` il SECONDO gioco principale (oltre a Legend),
 * caricato lazy dall'hub /gioco quando l'utente seleziona "Hourglass".
 *
 * Caratteristiche:
 *   – ispirato strutturalmente a The Legend of Zelda: Phantom Hourglass
 *     (mare aperto + isole + Tempio del Re del Mare con timer)
 *   – controlli STANDARD (no stilo): tastiera/joystick/mouse/touch/gamepad
 *   – save su localStorage (chiave `andryxify_hourglass_save_v1`)
 *   – leaderboard dedicata (lb:hourglass:* lato server)
 *   – scene caricate lazy (sea/mercay/temple/fire) via dynamic import
 */
import { startEngine } from './engine.js';
import { loadSave, saveSave, clearSave, hasSave } from './save.js';
import { setLang as setHourglassLang, t } from './i18n.js';

export const meta = {
  id: 'hourglass',
  name: 'Andryx Hourglass',
  emoji: '⌛',
  description: 'Avventura marinaresca ispirata a Phantom Hourglass: naviga tra le isole, esplora dungeon, sfida il Re del Mare prima che la clessidra si svuoti.',
  color: '#3070b8',
  controls: 'wasd-action',
  instructions: 'WASD/Frecce/joystick per muoverti · SPAZIO per attaccare/parlare · B/X per oggetto secondario · I per inventario · ESC per pausa',
  gameOverTitle: 'La Clessidra si è fermata',
  actionLabel: '⚔️',
  hubDescription: 'Avventura marinaresca: naviga, esplora isole, dungeon a tempo. Classifica dedicata.',
};

/** Restituisce `meta` con campi tradotti nella lingua corrente. */
export function getTranslatedMeta() {
  return {
    ...meta,
    name: t('meta.name') || meta.name,
    description: t('meta.description') || meta.description,
    instructions: t('meta.instructions') || meta.instructions,
    gameOverTitle: t('meta.gameOverTitle') || meta.gameOverTitle,
    hubDescription: t('meta.hubDescription') || meta.hubDescription,
  };
}

/**
 * Avvia il gioco. `options.continueSave` decide se riprendere o nuova partita.
 * `options.fresh` cancella un eventuale save vecchio.
 */
export function createGame(canvas, callbacks, options = {}) {
  const savedData = options.continueSave ? loadSave() : null;
  if (!options.continueSave && options.fresh) clearSave();

  let lastSaveTs = 0;
  let engine = null;

  /* Wrappiamo le callback PRIMA di passarle a startEngine, cosi` engine
     riceve direttamente le versioni con autosave + cleanup save. */
  const wrappedCallbacks = {
    ...callbacks,
    onScore: (s) => {
      if (callbacks.onScore) callbacks.onScore(s);
      const now = Date.now();
      if (now - lastSaveTs > 5000 && engine) {
        lastSaveTs = now;
        try { saveSave(engine.getState()); } catch { /* ignored */ }
      }
    },
    onGameOver: (s) => {
      clearSave();
      if (callbacks.onGameOver) callbacks.onGameOver(s);
    },
  };

  engine = startEngine(canvas, wrappedCallbacks, {
    savedData,
    onAutoSave: (state) => saveSave(state),
  });

  return () => engine.cleanup();
}

export { hasSave, loadSave, clearSave };
export { setHourglassLang };
