/**
 * Game Registry — mappa ogni mese (1-12) a un modulo gioco.
 *
 * I metadati (meta) sono importati staticamente (leggeri, poche righe).
 * Il codice gioco pesante (createGame) è caricato on-demand via dynamic import
 * per ridurre drasticamente il bundle iniziale di GamePage (~168KB → ~20KB).
 *
 * Ogni modulo gioco esporta:
 *   meta   — { name, emoji, description, color, controls }
 *   createGame(canvas, callbacks) → cleanup()
 *
 * callbacks = {
 *   keysRef, joystickRef, actionBtnRef,
 *   onScore(score), onGameOver(finalScore), onHpChange(hp, maxHp), onInfo(text)
 * }
 */

import { meta as gennaioMeta }   from './gennaio';
import { meta as febbraioMeta }  from './febbraio';
import { meta as marzoMeta }     from './marzo';
import { meta as aprileMeta }    from './aprile';
import { meta as maggioMeta }    from './maggio';
import { meta as giugnoMeta }    from './giugno';
import { meta as luglioMeta }    from './luglio';
import { meta as agostoMeta }    from './agosto';
import { meta as settembreMeta } from './settembre';
import { meta as ottobreMeta }   from './ottobre';
import { meta as novembreMeta }  from './novembre';
import { meta as dicembreMeta }  from './dicembre';

/* Mappa mese → { meta, loader (dynamic import) } */
const GAMES = {
  1:  { meta: gennaioMeta,   loader: () => import('./gennaio') },
  2:  { meta: febbraioMeta,  loader: () => import('./febbraio') },
  3:  { meta: marzoMeta,     loader: () => import('./marzo') },
  4:  { meta: aprileMeta,    loader: () => import('./aprile') },
  5:  { meta: maggioMeta,    loader: () => import('./maggio') },
  6:  { meta: giugnoMeta,    loader: () => import('./giugno') },
  7:  { meta: luglioMeta,    loader: () => import('./luglio') },
  8:  { meta: agostoMeta,    loader: () => import('./agosto') },
  9:  { meta: settembreMeta, loader: () => import('./settembre') },
  10: { meta: ottobreMeta,   loader: () => import('./ottobre') },
  11: { meta: novembreMeta,  loader: () => import('./novembre') },
  12: { meta: dicembreMeta,  loader: () => import('./dicembre') },
};

/** Restituisce meta + loader per il mese dato (1-12). */
export function getGameForMonth(month) {
  return GAMES[month] || GAMES[4]; // fallback ad Aprile
}

/**
 * Carica dinamicamente il modulo gioco e restituisce createGame.
 * Il risultato è cachato: import() risolve dalla cache Vite/browser.
 */
export async function loadGameModule(month) {
  const entry = GAMES[month] || GAMES[4];
  const mod = await entry.loader();
  return mod;
}

/** Restituisce tutti i 12 meta (per calendario/archivio). */
export function getAllGameMetas() {
  return Object.entries(GAMES).map(([m, g]) => ({
    month: Number(m),
    ...g.meta,
  }));
}

/** Restituisce il meta di un mese specifico. */
export function getGameMeta(month) {
  const g = GAMES[month];
  return g ? g.meta : null;
}
