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

/* ─── Metadati 3D per ogni tile ──────────────────────────────────────────
 * Usati da renderer3d.js / models3d.js per costruire la scena Three.js.
 * Ogni voce descrive:
 *   kind   — tipo di mesh ("ground"|"tree"|"stone"|"wall"|"house"|"door"
 *            |"fountain"|"bush"|"pot"|"block"|"plate"|"torch"|"portal"
 *            |"lava"|"water"|"path"|"sand"|"floor"|"dirt"|"flower")
 *   color  — colore base (esadecimale) per il materiale
 *   height — altezza in unita` mondo (1 unita` = 1 tile = 16 px logici).
 *            0 = piano a terra, valori positivi = oggetti rialzati.
 *   subKind — variante (es. tetto sinistro/centro/destro per le case).
 */
export const TILE_3D = {
  '.':  { kind: 'ground', color: 0x4a8830, height: 0 },
  ',':  { kind: 'flower', color: 0x4a8830, height: 0, accent: 0xff7a7a },
  '_':  { kind: 'path',   color: 0xc8a878, height: 0 },
  '~':  { kind: 'water',  color: 0x3a72c8, height: 0 },
  ':':  { kind: 'sand',   color: 0xe8c896, height: 0 },
  'F':  { kind: 'floor',  color: 0x6a6a78, height: 0 },
  'X':  { kind: 'dirt',   color: 0x7a4a25, height: 0 },
  'L':  { kind: 'lava',   color: 0xff5a20, height: 0 },

  'T':  { kind: 'tree',     color: 0x4a2812, height: 1.5, foliage: 0x266b26 },
  'S':  { kind: 'stone',    color: 0x888888, height: 0.7 },
  'W':  { kind: 'wall',     color: 0x4a4a55, height: 1.4 },
  'H':  { kind: 'house',    color: 0x8e1818, height: 1.5, subKind: 'roof' },
  'h':  { kind: 'house',    color: 0x7a4a25, height: 1.0, subKind: 'door' },

  /* Case modulari (3 colonne x 2 righe) */
  '1':  { kind: 'house', color: 0x8e1818, height: 1.4, subKind: 'roof_l' },
  '2':  { kind: 'house', color: 0x8e1818, height: 1.6, subKind: 'roof_m' },
  '3':  { kind: 'house', color: 0x8e1818, height: 1.4, subKind: 'roof_r' },
  '7':  { kind: 'house', color: 0xfff5dd, height: 1.0, subKind: 'wall_l' },
  '8':  { kind: 'house', color: 0xfff5dd, height: 1.0, subKind: 'wall_window' },
  '9':  { kind: 'house', color: 0xfff5dd, height: 1.0, subKind: 'wall_r' },
  '0':  { kind: 'house', color: 0x7a4a25, height: 1.0, subKind: 'door_closed' },
  'A':  { kind: 'house', color: 0x4a2812, height: 0.05, subKind: 'door_open' },
  'C':  { kind: 'fountain', color: 0xa0a0a8, height: 0.6 },

  'b':  { kind: 'bush',  color: 0x266b26, height: 0.45 },
  'p':  { kind: 'pot',   color: 0x7a4a25, height: 0.5 },
  'q':  { kind: 'pot',   color: 0xb88830, height: 0.5, accent: 0xf0c850 },
  'B':  { kind: 'block', color: 0x9c8060, height: 0.9 },
  'P':  { kind: 'plate', color: 0xb88830, height: 0.05 },
  'p2': { kind: 'plate', color: 0xb88830, height: 0.02, pressed: true },
  'D':  { kind: 'door',  color: 0x4a2812, height: 1.4, subKind: 'closed' },
  'd':  { kind: 'door',  color: 0x4a2812, height: 0.05, subKind: 'open' },
  't':  { kind: 'torch', color: 0x4a2812, height: 0.9, lit: false },
  'l':  { kind: 'torch', color: 0x4a2812, height: 0.9, lit: true, glow: 0xffaa30 },
  '*':  { kind: 'portal', color: 0xb870d0, height: 0.05, glow: 0xff5af0 },
};

/** Restituisce i metadati 3D di un tile (fallback erba). */
export function getTile3D(ch) {
  return TILE_3D[ch] || TILE_3D['.'];
}

/** Schiarisce/scurisce un colore esadecimale. amt in [-1, 1]. */
export function darkenColor(hex, amt) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
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
