/**
 * Andryx Jump — entry-point.
 *
 * Esporta `meta` e `createGame(canvas, callbacks)` secondo il contratto
 * dei moduli giochi (vedi src/games/registry.js), ma vive in un proprio
 * sotto-modulo perche` non e` un gioco mensile: e` un gioco standalone
 * sempre disponibile dall'hub /gioco (terza modalità accanto a Mese e Legend).
 *
 * Differenze dai giochi mensili:
 *   – usa salvataggio localStorage (ripresa partita, sblocco mondi)
 *   – leaderboard separata (lb:platform:*) lato server
 *   – 10 mondi a tema, livelli con bandiera fine, checkpoint
 */

import { startEngine } from './engine.js';
import { loadSave, saveSave, clearSave, hasSave } from './save.js';
import { getMetaText, setPlatformLang } from './i18n.js';

export const meta = {
  id: 'platform',
  name: 'Andryx Jump',
  emoji: '🦘',
  description: 'Platformer 2D originale a scorrimento laterale: 10 mondi a tema Andryx, salti acrobatici, power-up e nemici originali.',
  color: '#e63946',
  controls: 'platformer',
  instructions: 'Frecce/A-D per muoverti · Spazio/W/Z per saltare (più tieni premuto, più salti alto) · Shift per correre · Salta sui nemici. Raggiungi la bandiera dorata!',
  gameOverTitle: 'Game Over',
  actionLabel: '🦘',
};

/**
 * Restituisce `meta` con i campi testuali tradotti nella lingua corrente
 * (impostata via `setPlatformLang`). Stessa convenzione di Andryx Legend.
 */
export function getTranslatedMeta() {
  return {
    ...meta,
    description: getMetaText('description') || meta.description,
    instructions: getMetaText('instructions') || meta.instructions,
    gameOverTitle: getMetaText('gameOverTitle') || meta.gameOverTitle,
    hubDescription: getMetaText('hubDescription') ||
      'Platformer originale: 10 mondi, power-up, classifica dedicata.',
  };
}

/**
 * Avvia il gioco. `options.continueSave` riprende dal salvataggio.
 */
export function createGame(canvas, callbacks, options = {}) {
  const engine = startEngine(canvas, callbacks, options);

  /* Auto-save throttled (ogni ~5s di gameplay) */
  let lastSave = 0;
  const wrappedOnScore = callbacks.onScore;
  callbacks.onScore = (s) => {
    wrappedOnScore?.(s);
    const now = Date.now();
    if (now - lastSave > 5000) {
      lastSave = now;
      try { saveSave(engine.getState()); } catch { /* ignore */ }
    }
  };

  return () => engine.cleanup();
}

export { hasSave, loadSave, clearSave };
export { setPlatformLang };
