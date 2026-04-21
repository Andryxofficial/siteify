/**
 * Tile definitions per Andryx Legend.
 *
 * Ogni tile ha:
 *   id      — chiave usata nelle mappe (carattere singolo)
 *   sprite  — sprite key in SPRITES (o function(frame) per animati)
 *   solid   — blocca il movimento del player
 *   damage  — danni inflitti (es. lava)
 *   trigger — tipo evento speciale (porta, portale, NPC, plate)
 *   layer   — 'ground' | 'object' (oggetti hanno ombra e profondità)
 */
import { SPRITES } from './sprites.js';

export const TILE_SIZE = 16;

/* Mappa carattere → definizione tile */
export const TILES = {
  '.': { id: '.', sprite: 'TILE_GRASS', solid: false, layer: 'ground' },
  ',': { id: ',', sprite: 'TILE_GRASS_FLOWER', solid: false, layer: 'ground' },
  '_': { id: '_', sprite: 'TILE_PATH', solid: false, layer: 'ground' },
  '~': { id: '~', sprite: ['TILE_WATER_0', 'TILE_WATER_1'], solid: true, layer: 'ground', anim: true },
  ':': { id: ':', sprite: 'TILE_SAND', solid: false, layer: 'ground' },
  'F': { id: 'F', sprite: 'TILE_FLOOR', solid: false, layer: 'ground' },
  'X': { id: 'X', sprite: 'TILE_DIRT', solid: false, layer: 'ground' },
  'L': { id: 'L', sprite: 'TILE_LAVA', solid: true, damage: 1, layer: 'ground', anim: false },

  /* Solid objects */
  'T': { id: 'T', sprite: 'TILE_TREE', solid: true, layer: 'object' },
  'S': { id: 'S', sprite: 'TILE_STONE', solid: true, layer: 'object' },
  'W': { id: 'W', sprite: 'TILE_WALL', solid: true, layer: 'object' },
  'H': { id: 'H', sprite: 'TILE_HOUSE_ROOF', solid: true, layer: 'object' },
  'h': { id: 'h', sprite: 'TILE_HOUSE_DOOR', solid: true, layer: 'object' },

  /* Case "vere" — composte da 3 tile larghi × 2 tile alti (tetto + muro/porta) */
  '1': { id: '1', sprite: 'TILE_ROOF_TL', solid: true, layer: 'object' },
  '2': { id: '2', sprite: 'TILE_ROOF_TM', solid: true, layer: 'object' },
  '3': { id: '3', sprite: 'TILE_ROOF_TR', solid: true, layer: 'object' },
  '7': { id: '7', sprite: 'TILE_HWALL_L', solid: true, layer: 'object' },
  '8': { id: '8', sprite: 'TILE_HWINDOW', solid: true, layer: 'object' },
  '9': { id: '9', sprite: 'TILE_HWALL_R', solid: true, layer: 'object' },
  '0': { id: '0', sprite: 'TILE_HDOOR', solid: true, layer: 'object', door: true, locked: true },
  'A': { id: 'A', sprite: 'TILE_HDOOR_OPEN', solid: false, layer: 'object', door: true, open: true },
  'C': { id: 'C', sprite: 'TILE_FOUNTAIN', solid: true, layer: 'object' },

  /* Interactive */
  'b': { id: 'b', sprite: 'TILE_BUSH', solid: true, layer: 'object', cuttable: true, drops: 'random' },
  'p': { id: 'p', sprite: 'TILE_POT', solid: true, layer: 'object', smashable: true, drops: 'random' },
  'q': { id: 'q', sprite: 'TILE_POT_SPECIAL', solid: true, layer: 'object', smashable: true, drops: 'house_key' },
  'B': { id: 'B', sprite: 'TILE_BLOCK', solid: true, layer: 'object', pushable: true },
  'P': { id: 'P', sprite: 'TILE_PLATE_UP', solid: false, layer: 'ground', plate: true },
  'p2': { id: 'p2', sprite: 'TILE_PLATE_DOWN', solid: false, layer: 'ground', plate: true, pressed: true },
  'D': { id: 'D', sprite: 'TILE_DOOR_CLOSED', solid: true, layer: 'object', door: true, locked: true },
  'd': { id: 'd', sprite: 'TILE_DOOR_OPEN', solid: false, layer: 'object', door: true, open: true },
  't': { id: 't', sprite: 'TILE_TORCH_OFF', solid: true, layer: 'object', torch: true, lit: false },
  'l': { id: 'l', sprite: 'TILE_TORCH_ON', solid: true, layer: 'object', torch: true, lit: true },
  '*': { id: '*', sprite: 'TILE_PORTAL', solid: false, layer: 'object', portal: true },
};

/** Restituisce la definizione tile, fallback erba. */
export function getTile(ch) {
  return TILES[ch] || TILES['.'];
}

/** Restituisce true se il carattere rappresenta un tile solido. */
export function isSolid(ch) {
  return getTile(ch).solid === true;
}

/**
 * Restituisce lo sprite corrente (gestendo animazioni).
 * `tick` è un contatore globale di frame.
 */
export function getTileSprite(tileDef, tick) {
  const sp = tileDef.sprite;
  if (Array.isArray(sp)) {
    const i = Math.floor(tick / 30) % sp.length;
    return SPRITES[sp[i]];
  }
  return SPRITES[sp];
}
