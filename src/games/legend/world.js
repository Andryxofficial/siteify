/**
 * World di Andryx Legend.
 *
 * Quattro zone collegate, ciascuna 30×20 tile (480×320 px logici).
 * Lo schermo (240×240 logici, 15×15 tile) è più piccolo della zona,
 * la camera segue il player.
 *
 * Trama: Andryx, eroe del regno di Twitchia, deve recuperare i 3
 * Cristalli del Pixel rubati dal Re Ombra e nascosti nelle 3 sub-zone:
 *   – Cristallo Verde nella Foresta Sussurrante
 *   – Cristallo Blu nella Caverna delle Gemme (custodito dal Golem)
 *   – Cristallo Rosso nel Castello del Re Ombra (boss finale)
 *
 * Ogni mappa è una matrice di stringhe, un carattere per tile.
 * Le entità (NPC, nemici, oggetti) sono dichiarate separatamente.
 */

export const ZONE_W = 30;
export const ZONE_H = 20;

/* ─── ZONA 0: Villaggio dei Pixel — punto di partenza ───
   Case = 3 tile larghi × 2 tile alti.
     Riga 0 (tetto):   1 2 3
     Riga 1 (muro):    7 8 9   (con finestra centrale, casa generica)
                       7 0 9   (con porta — casa di Andryx, sbloccabile)
   Layout:
   - Bordi alberi (T)
   - Casa Re a destra (cols 21-23, rows 1-2) — Re davanti
   - Casa Anziano centro (cols 13-15, rows 1-2) — Anziano davanti
   - Casa di Andryx a sinistra (cols 1-3, rows 10-11) — porta '0' bloccata, spada davanti
   - Fontana C circondata da pavimento _, lampioni
   - Vaso speciale q nascosto fra cespugli
   - Portale ** giù a destra (verso Caverna)
   - Bordo est apre la Foresta
*/
const VILLAGE_MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T,..,..b..,..123..,..123..,..T',
  'T.,..,...bb..789...,.789...,.T',
  'T,..,..,..,..,..,..,..,..,..,T',
  'T..b..,..,...,.,..p.,..,.,..,T',
  'T,..,..,..,..__.__.,...,..b,.T',
  'T..,..bb,...._..._...,..,..,.T',
  'T,..,..,..,.._..._..,..,..,..T',
  'T..,..,______._..._________,.T',
  'T,..,.._....._..._........_..T',
  'T123..b_..bb._..._...._..._..T',
  'T709..,_..,.._.C._..._....._.T',
  'T..,..b______._..._...._..._.T',
  'T..,..,..,..,_..._..._______.T',
  'T,..,..,..q.._..._.,..,..,..,T',
  'T..,..,..,..,_..._.,..,..,..,T',
  'Tb..,..,..,.._..._..,..,..,..T',
  'T..,bbb,..,.._..._...,..,..*,T',
  'T,..,..,..,.._..._....,..,.**T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const VILLAGE_ENTITIES = [
  /* Re davanti alla sua casa (a destra) */
  { type: 'npc', kind: 'king', x: 22, y: 4, dialog: 'king_intro' },
  /* Anziano davanti casa propria (in alto al centro) */
  { type: 'npc', kind: 'elder', x: 14, y: 4, dialog: 'elder_intro' },
  /* Mercante e bambino vicino alla fontana */
  { type: 'npc', kind: 'merchant', x: 24, y: 13, dialog: 'merchant' },
  { type: 'npc', kind: 'child', x: 18, y: 14, dialog: 'child' },
  /* Vaso speciale 'q' (col 11, row 14) — ora gestito come tile, non entita`. */
  /* La spada di papa` Andryx — appare DAVANTI casa appena la porta si apre */
  { type: 'item', kind: 'sword', x: 2, y: 13, requires: 'house_key' },
  { type: 'sign', x: 14, y: 17, text: 'Verso est: Foresta Sussurrante.\nVerso sud-est: Portale Caverna.\nLa tua casa: a ovest.' },
  { type: 'sign', x: 16, y: 9, text: 'Fontana del Villaggio.\nL\'acqua riflette le stelle.' },
];

/* ─── ZONA 1: Foresta Sussurrante — primo dungeon all'aperto ─── */
const FOREST_MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T*..,..bb..,...T...bb,..,...T',
  'T*.,T...,..bb..T,..,..,..bb.T',
  'T,T.T...,..,..TT..bb..,..,..T',
  'T..,T..,bbb,..T..T..bb..,..,T',
  'T,T....T....T...T..,bb,..,..T',
  'T..T..,T..,..T,T..T,..,..,..T',
  'T,T....T..bbT..T...T..bb..,.T',
  'T..,..bT...,T,..T...T....,..T',
  'T,T....T,..T..,..T..,T..,..,T',
  'T..T..bT..,T..,..T,..T..,..,T',
  'T,..T...T...T..,bbT...T..,..T',
  'T..T..,..T,..T...T..,..T..,.T',
  'T,..T...T..T..bbb..T..T..,..T',
  'T..bb,..T,..T...T...T...,..,T',
  'T,..,bbT..T..T..T..T..,..,..T',
  'T..,..T..T..T..T..T...,bb..,T',
  'T,bb..T..T..T..T..T..,...,..T',
  'T..,bb..T..T..T..T....bb,..*T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const FOREST_ENTITIES = [
  { type: 'enemy', kind: 'slime', x: 8, y: 6 },
  { type: 'enemy', kind: 'slime', x: 18, y: 8 },
  { type: 'enemy', kind: 'slime', x: 12, y: 13 },
  { type: 'enemy', kind: 'bat', x: 22, y: 5 },
  { type: 'enemy', kind: 'bat', x: 6, y: 14 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 11 },
  { type: 'item', kind: 'heart_container', x: 25, y: 17, requires: 'has_crystal_green:false' },
  { type: 'item', kind: 'crystal_green', x: 14, y: 1, requires: 'forest_clear' },
  { type: 'sign', x: 2, y: 17, text: 'Foresta Sussurrante.\nElimina i nemici per\nfar apparire il Cristallo.' },
];

/* ─── ZONA 2: Caverna delle Gemme — dungeon con puzzle e mini-boss ─── */
const CAVE_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WFFFFFFFFFWWWWWWWWWFFFFFFFFFFW',
  'WFFFFFFFFFWWWWWWWWWFFFFFFFFFFW',
  'WFFpFFFFFFWWWWWWWWWFFFFFFppFFW',
  'WFFFFFFBFFWWWWWWWWWFFFFFFFFFFW',
  'WFFFFFFFFFDFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFPFFFFFFFFFFFFFFFFBFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFPFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFlFFFFFFFFFFFFFFFFFFFFFFlFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFtFFFFFFFFFFFFFFFFtFFFFW',
  'WFFFFFFFFFFFFDFFFFFFFFFFFFFFFW',
  'WWWWWWWWWWWWWFFWWWWWWWWWWWWWWW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

const CAVE_ENTITIES = [
  { type: 'enemy', kind: 'skeleton', x: 5, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 4 },
  { type: 'enemy', kind: 'bat', x: 14, y: 6 },
  { type: 'enemy', kind: 'bat', x: 20, y: 12 },
  { type: 'enemy', kind: 'mage', x: 22, y: 9, requires: 'cave_door1' },
  { type: 'boss', kind: 'guardian', x: 14, y: 18, requires: 'cave_torches' },
  { type: 'item', kind: 'shield', x: 3, y: 3, requires: 'has_shield:false' },
  { type: 'item', kind: 'key', x: 27, y: 3 },
  { type: 'item', kind: 'crystal_blue', x: 14, y: 18, requires: 'guardian_defeated' },
  { type: 'sign', x: 2, y: 1, text: 'Caverna delle Gemme.\nAccendi le 2 torce per\nrisvegliare il Custode.' },
];

/* ─── ZONA 3: Castello del Re Ombra — boss finale ─── */
const CASTLE_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFLLFFFFFFFFFFFFFFFFFFFFFFLLFW',
  'WFLLLFFFFFFFFFFFFFFFFFFFFLLLFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFLLFFFFFFFFFFFFFFFFFFLLFFFW',
  'WFFLLLLFFFFFFFFFFFFFFFFLLLLFFW',
  'WFFFLLFFFFFFFFFFFFFFFFFFLLFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFDFFFFFFFFFFFFFFFW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

const CASTLE_ENTITIES = [
  { type: 'enemy', kind: 'skeleton', x: 6, y: 6 },
  { type: 'enemy', kind: 'skeleton', x: 23, y: 6 },
  { type: 'enemy', kind: 'mage', x: 8, y: 14 },
  { type: 'enemy', kind: 'mage', x: 21, y: 14 },
  { type: 'boss', kind: 'shadow_king', x: 14, y: 7, requires: 'castle_clear' },
  { type: 'item', kind: 'crystal_red', x: 14, y: 5, requires: 'shadow_king_defeated' },
  { type: 'sign', x: 14, y: 17, text: 'Castello del Re Ombra.\nIl tuo destino ti attende.' },
];

/* ─── Definizioni zone ─── */

export const ZONES = {
  village: {
    id: 'village',
    name: 'Villaggio dei Pixel',
    map: VILLAGE_MAP,
    entities: VILLAGE_ENTITIES,
    spawn: { x: 5, y: 13 },
    music: 'village',
    /* Transizioni: { fromBorder: 'east'|'west'|'north'|'south', toZone, spawn } */
    transitions: [
      { trigger: 'portal', x: 28, y: 17, toZone: 'cave', spawn: { x: 14, y: 18 } },
      { trigger: 'portal', x: 28, y: 18, toZone: 'cave', spawn: { x: 14, y: 18 } },
      { trigger: 'edge', side: 'east', toZone: 'forest', spawn: { x: 1, y: 10 } },
    ],
  },
  forest: {
    id: 'forest',
    name: 'Foresta Sussurrante',
    map: FOREST_MAP,
    entities: FOREST_ENTITIES,
    spawn: { x: 1, y: 10 },
    music: 'forest',
    transitions: [
      { trigger: 'edge', side: 'west', toZone: 'village', spawn: { x: 28, y: 10 } },
      { trigger: 'portal', x: 28, y: 18, toZone: 'castle', spawn: { x: 14, y: 17 }, requires: 'has_crystal_green' },
      { trigger: 'portal', x: 1, y: 1, toZone: 'village', spawn: { x: 4, y: 12 } },
    ],
  },
  cave: {
    id: 'cave',
    name: 'Caverna delle Gemme',
    map: CAVE_MAP,
    entities: CAVE_ENTITIES,
    spawn: { x: 14, y: 18 },
    music: 'cave',
    transitions: [
      { trigger: 'edge', side: 'south', toZone: 'village', spawn: { x: 28, y: 17 } },
    ],
  },
  castle: {
    id: 'castle',
    name: 'Castello del Re Ombra',
    map: CASTLE_MAP,
    entities: CASTLE_ENTITIES,
    spawn: { x: 14, y: 17 },
    music: 'castle',
    transitions: [
      { trigger: 'edge', side: 'south', toZone: 'forest', spawn: { x: 28, y: 18 } },
    ],
  },
};

export const START_ZONE = 'village';

/** Restituisce una zona per id, fallback a START. */
export function getZone(id) {
  return ZONES[id] || ZONES[START_ZONE];
}

/** Crea una copia mutabile della mappa di una zona (per trasformazioni in-game: porte aperte, blocchi spinti, torce accese). */
export function cloneZoneMap(zoneId) {
  const z = getZone(zoneId);
  return z.map.map(row => row.split(''));
}
