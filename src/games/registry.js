/**
 * Game Registry — maps each month (1-12) to a game module.
 * The game that plays is determined by the current month.
 *
 * Each game module exports:
 *   meta   — { name, emoji, description, color, controls }
 *   createGame(canvas, callbacks) → cleanup()
 *
 * callbacks = {
 *   keysRef, joystickRef, actionBtnRef,
 *   onScore(score), onGameOver(finalScore), onHpChange(hp, maxHp), onInfo(text)
 * }
 */

import * as gennaio   from './gennaio';
import * as febbraio  from './febbraio';
import * as marzo     from './marzo';
import * as aprile    from './aprile';
import * as maggio    from './maggio';
import * as giugno    from './giugno';
import * as luglio    from './luglio';
import * as agosto    from './agosto';
import * as settembre from './settembre';
import * as ottobre   from './ottobre';
import * as novembre  from './novembre';
import * as dicembre  from './dicembre';

const GAMES = {
  1:  gennaio,
  2:  febbraio,
  3:  marzo,
  4:  aprile,
  5:  maggio,
  6:  giugno,
  7:  luglio,
  8:  agosto,
  9:  settembre,
  10: ottobre,
  11: novembre,
  12: dicembre,
};

/** Get the game module for the given month (1-12). */
export function getGameForMonth(month) {
  return GAMES[month] || GAMES[4]; // fallback to April
}

/** Get all 12 game metas (for archive display). */
export function getAllGameMetas() {
  return Object.entries(GAMES).map(([m, g]) => ({
    month: Number(m),
    ...g.meta,
  }));
}

/** Get game meta by month number. */
export function getGameMeta(month) {
  const g = GAMES[month];
  return g ? g.meta : null;
}
