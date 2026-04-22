/**
 * Andryx Jump — sistema tile.
 *
 * Una mappa è un array di stringhe; ogni char rappresenta un tile.
 * I tile sono 16x16 pixel logici (TILE_SIZE).
 *
 * Char legend:
 *   '.'  vuoto (cielo)
 *   '#'  ground solido (mattone)
 *   'g'  grass top (solido, variante visiva: cima erbosa)
 *   'G'  grass underground (solido, marrone scuro)
 *   'b'  block crystal (solido, breakable se cresci)
 *   '?'  question block (con coin / power-up nascosto)
 *   'B'  block usato (vuoto, solido)
 *   'p'  one-way platform
 *   'l'  lava (tocco = morte)
 *   'w'  acqua (movimento rallentato)
 *   'i'  ghiaccio (solido, friction bassa)
 *   'c'  coin (collezionabile)
 *   'C'  checkpoint (bandierina blu)
 *   'F'  goal flag (bandiera dorata, fine livello)
 *   'P'  player spawn
 *   's'  spawn Sloimo
 *   'v'  spawn Pipistrellix (bat che vola sinusoide)
 *   'x'  spawn Spinazzo (statico, danneggia al tocco)
 *   '*'  spawn power-up cristallo (cresci)
 *   '$'  spawn power-up stella (invuln)
 *   '~'  spawn power-up piuma (doppio salto)
 *   't'  tronco / albero (decorativo solido sottile)
 *   '='  ponte di legno (solido)
 *   '|'  palo (decorativo solido sottile)
 */

export const TILE_SIZE = 16;

export const TILES = {
  EMPTY:     '.',
  GROUND:    '#',
  GRASS:     'g',
  EARTH:     'G',
  BRICK:     'b',
  QUESTION:  '?',
  USED:      'B',
  PLATFORM:  'p',
  LAVA:      'l',
  WATER:     'w',
  ICE:       'i',
  COIN:      'c',
  CHECKPOINT:'C',
  GOAL:      'F',
  PLAYER:    'P',
  SLIME:     's',
  BAT:       'v',
  SPIKE:     'x',
  POW_CRYSTAL:'*',
  POW_STAR:  '$',
  POW_FEATHER:'~',
  TRUNK:     't',
  BRIDGE:    '=',
  POLE:      '|',
};

/** True se il tile è solido (impedisce movimento). */
export function isSolid(ch) {
  return ch === TILES.GROUND || ch === TILES.GRASS || ch === TILES.EARTH ||
         ch === TILES.BRICK  || ch === TILES.QUESTION || ch === TILES.USED ||
         ch === TILES.ICE    || ch === TILES.BRIDGE   || ch === TILES.TRUNK ||
         ch === TILES.POLE;
}

/** True se il tile è una piattaforma one-way (collide solo da sopra). */
export function isOneWay(ch) {
  return ch === TILES.PLATFORM;
}

/** True se il tile è dannoso al contatto. */
export function isLava(ch) { return ch === TILES.LAVA; }

/** True se il tile è acqua. */
export function isWater(ch) { return ch === TILES.WATER; }

/** True se il tile è ghiaccio (solido + friction bassa). */
export function isIce(ch) { return ch === TILES.ICE; }

/** Char → entity-spawn type, o null se non spawnabile. */
export function getSpawnType(ch) {
  switch (ch) {
    case TILES.SLIME: return 'slime';
    case TILES.BAT:   return 'bat';
    case TILES.SPIKE: return 'spike';
    case TILES.POW_CRYSTAL: return 'pow_crystal';
    case TILES.POW_STAR:    return 'pow_star';
    case TILES.POW_FEATHER: return 'pow_feather';
    default: return null;
  }
}

/** True se il tile è raccoglibile (coin/power) — viene rimosso al pickup. */
export function isPickup(ch) {
  return ch === TILES.COIN || ch === TILES.POW_CRYSTAL ||
         ch === TILES.POW_STAR || ch === TILES.POW_FEATHER;
}

/**
 * Helper di lettura tile da una mappa:
 * grid è array di stringhe, restituisce '.' se fuori bounds (cielo/aria).
 * Gli array di righe sono indicizzati top-down (row 0 = in alto).
 * Per le tile sotto il livello giocabile (oltre l'ultima riga) restituiamo
 * GROUND in modo che il giocatore non possa "cadere all'infinito" dentro
 * un buco senza morire — viene gestito dall'engine come fall-out.
 */
export function getTile(grid, col, row) {
  if (row < 0) return TILES.EMPTY;
  if (row >= grid.length) return TILES.EMPTY; // sotto: vuoto → death-zone
  const r = grid[row];
  if (col < 0 || col >= r.length) return TILES.GROUND; // pareti laterali invisibili
  return r[col];
}
