/**
 * Andryx Jump — sistema tile.
 *
 * Char legend:
 *   '.'  vuoto (cielo)
 *   '#'  ground solido
 *   'g'  grass top (solido, cima erbosa)
 *   'G'  earth/sottosuolo (solido, marrone)
 *   'b'  mattone breakable (big Andryx lo rompe)
 *   '?'  question block (nasconde power-up)
 *   'B'  question block usato (vuoto, solido)
 *   'p'  one-way platform
 *   'l'  lava (morte al tocco)
 *   'w'  acqua (rallenta)
 *   'i'  ghiaccio (solido, friction bassa)
 *   'c'  moneta
 *   'C'  checkpoint
 *   'F'  goal flag (fine livello)
 *   '|'  palo goal (solido decorativo)
 *   'P'  spawn player
 *   's'  spawn Sloimo (goomba)
 *   'k'  spawn Tartarax (koopa)
 *   'x'  spawn Spinazzo (spike statico)
 *   '*'  spawn power-up cristallo (cresci)
 *   '$'  spawn power-up stella (invuln)
 *   '~'  spawn power-up piuma (doppio salto)
 *   '@'  spawn fire flower (forma fire)
 *   '['  pipe cap sinistra (solido)
 *   ']'  pipe cap destra (solido)
 *   '{'  pipe corpo sinistra (solido)
 *   '}'  pipe corpo destra (solido)
 *   't'  tronco (decorativo solido)
 *   '='  ponte di legno (solido)
 */

export const TILE_SIZE = 16;

export const TILES = {
  EMPTY:      '.',
  GROUND:     '#',
  GRASS:      'g',
  EARTH:      'G',
  BRICK:      'b',
  QUESTION:   '?',
  USED:       'B',
  PLATFORM:   'p',
  LAVA:       'l',
  WATER:      'w',
  ICE:        'i',
  COIN:       'c',
  CHECKPOINT: 'C',
  GOAL:       'F',
  POLE:       '|',
  PLAYER:     'P',
  SLIME:      's',
  KOOPA:      'k',
  SPIKE:      'x',
  POW_CRYSTAL:'*',
  POW_STAR:   '$',
  POW_FEATHER:'~',
  POW_FIRE:   '@',
  PIPE_CAP_L: '[',
  PIPE_CAP_R: ']',
  PIPE_BODY_L:'{',
  PIPE_BODY_R:'}',
  TRUNK:      't',
  BRIDGE:     '=',
};

/** True se il tile e solido (impedisce movimento). */
export function isSolid(ch) {
  return ch === '#' || ch === 'g' || ch === 'G' ||
         ch === 'b' || ch === '?' || ch === 'B' ||
         ch === 'i' || ch === '=' || ch === 't' ||
         ch === '[' || ch === ']' || ch === '{' || ch === '}';
}

/** True se il tile e una piattaforma one-way. */
export function isOneWay(ch) { return ch === 'p'; }

/** True se il tile uccide al contatto. */
export function isLava(ch) { return ch === 'l'; }

/** True se il tile e acqua. */
export function isWater(ch) { return ch === 'w'; }

/** True se il tile e ghiaccio (solido + friction ridotta). */
export function isIce(ch) { return ch === 'i'; }

/** Char → tipo entita da spawnare, o null. */
export function getSpawnType(ch) {
  switch (ch) {
    case 's': return 'slime';
    case 'k': return 'koopa';
    case 'x': return 'spike';
    case '*': return 'pow_crystal';
    case '$': return 'pow_star';
    case '~': return 'pow_feather';
    case '@': return 'pow_fire';
    default:  return null;
  }
}

/** True se il tile e raccoglibile (moneta/power-up nel tile). */
export function isPickup(ch) {
  return ch === 'c' || ch === '*' || ch === '$' || ch === '~' || ch === '@';
}

/**
 * Legge il tile da una griglia (array di stringhe o array di char-array).
 * Restituisce '.' fuori dai limiti (sopra/sotto); '#' per le pareti laterali.
 */
export function getTile(grid, col, row) {
  if (row < 0) return '.';
  if (row >= grid.length) return '.';
  const r = grid[row];
  if (col < 0 || col >= r.length) return '#';
  return r[col];
}
