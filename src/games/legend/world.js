/**
 * World di Andryx Legend.
 *
 * Quattro zone (+ una piccola zona-overworld a ovest) collegate al
 * Villaggio dei Pixel da STRADE visibili (tile sentiero `_`) lungo i 4
 * confini cardinali — niente piu` portali magici.
 *
 *   N → Castello del Re Ombra   (gated da `has_crystal_blue`)
 *   S → Caverna delle Gemme
 *   E → Foresta Sussurrante
 *   O → Pianura dell'Ovest
 *
 * Trama: Andryx, eroe del regno di Twitchia, deve recuperare i 3
 * Cristalli del Pixel rubati dal Re Ombra:
 *   – Cristallo Verde nella Foresta Sussurrante
 *   – Cristallo Blu nella Caverna delle Gemme (custodito dal Custode)
 *   – Cristallo Rosso nel Castello del Re Ombra (boss finale)
 *
 * Ogni mappa è una matrice di stringhe, un carattere per tile.
 * Le entità (NPC, nemici, oggetti) sono dichiarate separatamente.
 */

export const ZONE_W = 30;
export const ZONE_H = 20;

/* ─── ZONA 0: Villaggio dei Pixel — punto di partenza ───
   Layout a croce: due strade larghe 2 tile (`_`) si intersecano al
   centro, collegando i 4 confini cardinali alle rispettive zone. La
   fontana C e` posizionata a NE dell'incrocio, fra le due strade.

   Case (3 tile larghe × 2 tile alte):
     - Riga 0 (tetto):  1 2 3
     - Riga 1 (muro):   7 8 9   (finestra centrale, casa generica)
                        7 0 9   (porta — casa di Andryx, sbloccabile)

   Posizioni:
     - Casa Anziano:    cols 9-11, rows 1-2 (window)
     - Casa Re:         cols 19-21, rows 1-2 (window)
     - Casa villager:   cols 24-26, rows 13-14 (window)
     - Casa di Andryx:  cols 2-4, rows 13-14 (door '0' bloccata)
     - Vaso speciale q: (3, 15) — drop house_key
     - Fontana C:       (17, 8)
     - Strade _:        croce centrale (cols 14-15 verticali, rows 10-11 orizzontali)
*/
const VILLAGE_MAP = [
  'TTTTTTTTTTTTTT__TTTTTTTTTTTTTT',
  'T.,.,..,.123,.__...123,..,,..T',
  'T.....,b.789..__...789..,..,.T',
  'T,.b..........__......b,.,,,.T',
  'T,...,......p.__,,....p,..b..T',
  'T.b.,......,.,__,.,,,,.,..,..T',
  'T.,....,b...,,__,.,......,...T',
  'T....b......,,__........b....T',
  'T....,..b..,..__.C..,b,..,...T',
  'T..,,.........__...,.........T',
  '______________________________',
  '______________________________',
  'T.b..b......,.__...,...,b,..,T',
  'T.123,...,,..,__.,.,....123..T',
  'T,709.....,.,.__....,...789..T',
  'T..q...,,,..,,__.....,.......T',
  'T..b.....,.,.,__......b...,..T',
  'T,.....b......__..,,.,....b.,T',
  'T.....,..,....__....b.,,....,T',
  'TTTTTTTTTTTTTT__TTTTTTTTTTTTTT',
];

const VILLAGE_ENTITIES = [
  /* Re davanti alla sua casa (in alto a destra) */
  { type: 'npc', kind: 'king', x: 20, y: 4, dialog: 'king_intro' },
  /* Anziano davanti casa propria (in alto a sinistra) */
  { type: 'npc', kind: 'elder', x: 10, y: 4, dialog: 'elder_intro' },
  /* Mercante e bambino vicino alla fontana (NE della croce) */
  { type: 'npc', kind: 'merchant', x: 19, y: 8, dialog: 'merchant' },
  { type: 'npc', kind: 'child', x: 13, y: 9, dialog: 'child' },
  /* La spada di papa` Andryx — appare DAVANTI casa appena la porta si apre */
  { type: 'item', kind: 'sword', x: 3, y: 12, requires: 'house_key' },
  /* Cartello al centro: indica le 4 direzioni */
  { type: 'sign', x: 16, y: 11, text: 'Crocevia del Villaggio.\nN: Castello (Cristallo Blu)\nS: Caverna delle Gemme\nE: Foresta Sussurrante\nO: Pianura dell\'Ovest' },
  /* Cartello fontana */
  { type: 'sign', x: 18, y: 9, text: 'Fontana del Villaggio.\nL\'acqua riflette le stelle.' },
  /* Cartello vicino all'imbocco nord: ricorda al player il gate del castello */
  { type: 'sign', x: 13, y: 1, text: 'Strada per il Castello.\nRichiede il Cristallo Blu.' },
];

/* ─── ZONA 1: Foresta Sussurrante — primo dungeon all'aperto ─── */
const FOREST_MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T......,...,.,..,....,,.,,.,.T',
  'T...............,......,.....T',
  'T,...TT..,.,,.,T.,.,.,.......T',
  'T....T......,,.TT......,,...,T',
  'T..b....,,TT.....,.,TT.....,.T',
  'T.,,..,b...T.,,,...,.T...,...T',
  'T............b...b.........,.T',
  'T,......TT,...,......,b.TT...T',
  'T,......T.........TT,.,..T.,,T',
  '____________________________.T',
  '____________________________.T',
  'T..,TT..,.,.,..,,...TT..,.b..T',
  'T....T....TT......,..T....,..T',
  'T....,.....T..,.,,.....,.,..,T',
  'T.....,........TT.......TT..,T',
  'T...,..TT...,...T,,,,...,T...T',
  'T.,,b.......TT.,.b.,,.b......T',
  'T........b........,..,.......T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const FOREST_ENTITIES = [
  { type: 'enemy', kind: 'slime', x: 8, y: 6 },
  { type: 'enemy', kind: 'slime', x: 18, y: 8 },
  { type: 'enemy', kind: 'slime', x: 12, y: 14 },
  { type: 'enemy', kind: 'bat', x: 22, y: 5 },
  { type: 'enemy', kind: 'bat', x: 6, y: 15 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 13 },
  { type: 'item', kind: 'heart_container', x: 26, y: 17, requires: 'has_crystal_green:false' },
  /* Cristallo verde appare dopo aver ripulito la zona (vedi engine) */
  { type: 'item', kind: 'crystal_green', x: 14, y: 2, requires: 'forest_clear' },
  { type: 'sign', x: 2, y: 17, text: 'Foresta Sussurrante.\nElimina i nemici per\nfar apparire il Cristallo.' },
];

/* ─── ZONA 2: Caverna delle Gemme — dungeon con puzzle e mini-boss ───
   Apertura sul bordo NORD (cols 14-15) per arrivo dal Villaggio. */
const CAVE_MAP = [
  'WWWWWWWWWWWWWWFFWWWWWWWWWWWWWW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFpFFFFFFFFFFFFFFFFFFFFFFFFpFW',
  'WFFFFFFBFFFFFFFFFFFFFFBFFFFFFW',
  'WFFFFFFFFDFFFFFFFFFFDFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFPFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFPFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFlFFFFFFFFFFFFFFFFFFFFFFFFlFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFtFFFFFFFFFFFFFFtFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFqFFFFFFFFFFFFFFW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

const CAVE_ENTITIES = [
  { type: 'enemy', kind: 'skeleton', x: 5, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 4 },
  { type: 'enemy', kind: 'bat', x: 14, y: 6 },
  { type: 'enemy', kind: 'bat', x: 20, y: 12 },
  { type: 'enemy', kind: 'mage', x: 22, y: 9, requires: 'cave_door1' },
  { type: 'boss', kind: 'guardian', x: 14, y: 16, requires: 'cave_torches' },
  { type: 'item', kind: 'shield', x: 3, y: 3, requires: 'has_shield:false' },
  { type: 'item', kind: 'key', x: 27, y: 3 },
  { type: 'item', kind: 'crystal_blue', x: 14, y: 16, requires: 'guardian_defeated' },
  { type: 'sign', x: 14, y: 2, text: 'Caverna delle Gemme.\nAccendi le 2 torce per\nrisvegliare il Custode.' },
];

/* ─── ZONA 3: Castello del Re Ombra — boss finale ───
   Apertura sul bordo SUD (cols 14-15) per arrivo dal Villaggio. */
const CASTLE_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFLLFFFFFFFFFFFFFFFFFFFFFFLLFW',
  'WFLLLFFFFFFFFFppFFFFFFFFFLLLFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFLLFFFFFFFFFFFFFFFFFFLLFFFW',
  'WFFFLLLFFFFFFFFFFFFFFFFLLLFFFW',
  'WFFFFLFFFFFFFFFFFFFFFFFFLFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',
  'WWWWWWWWWWWWWWFFWWWWWWWWWWWWWW',
];

const CASTLE_ENTITIES = [
  { type: 'enemy', kind: 'skeleton', x: 6, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 23, y: 8 },
  { type: 'enemy', kind: 'mage', x: 8, y: 14 },
  { type: 'enemy', kind: 'mage', x: 21, y: 14 },
  { type: 'boss', kind: 'shadow_king', x: 14, y: 7, requires: 'castle_clear' },
  { type: 'item', kind: 'crystal_red', x: 14, y: 5, requires: 'shadow_king_defeated' },
  { type: 'sign', x: 14, y: 17, text: 'Castello del Re Ombra.\nIl tuo destino ti attende.' },
];

/* ─── ZONA 4: Pianura dell'Ovest — overworld breve, presto un nuovo dungeon ───
   Apertura sul bordo EST (rows 10-11) per arrivo dal Villaggio. */
const PLAINS_MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'T...,...,,...,,.....,........T',
  'T...,.....,,..,,,,..........,T',
  'T........,.,.,...........,,.,T',
  'T..,,.,b.....................T',
  'T,......,.......,..,b,.,..,..T',
  'T......,......p............,,T',
  'T...,.,........,...,.,....,..T',
  'T,..,,.,.C.b.....,,.,........T',
  'T......,...,....,.,...b.....,T',
  'T......_______________________',
  'T.,,.b._______________________',
  'T.,..,.,,..........,..,.,b,.,T',
  'T.,......,.......,....,..,,..T',
  'T.......b........,..,...,....T',
  'T,..,....,....,...b..,.......T',
  'T,..,...,.......,............T',
  'T.,,..,.......,b.....,.......T',
  'T.,.......,...,,,,...,.......T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const PLAINS_ENTITIES = [
  /* Un piccolo nemico per dare colore */
  { type: 'enemy', kind: 'slime', x: 16, y: 8 },
  { type: 'enemy', kind: 'slime', x: 12, y: 14 },
  /* Heart container come ricompensa esplorazione */
  { type: 'item', kind: 'heart_container', x: 4, y: 8 },
  /* Cartello "presto un nuovo dungeon" */
  { type: 'sign', x: 9, y: 9, text: 'Pianura dell\'Ovest.\nUn nuovo dungeon\nsta per arrivare...' },
  { type: 'sign', x: 27, y: 11, text: 'Verso est: si torna al\nVillaggio dei Pixel.' },
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
    /* Transizioni a EDGE: il player esce dal lato cardinale corrispondente
       e arriva nella zona di destinazione. Niente piu` portali magici. */
    transitions: [
      { trigger: 'edge', side: 'east',  toZone: 'forest', spawn: { x: 1, y: 10 } },
      { trigger: 'edge', side: 'south', toZone: 'cave',   spawn: { x: 14, y: 1 } },
      { trigger: 'edge', side: 'west',  toZone: 'plains', spawn: { x: 28, y: 10 } },
      /* Nord → Castello: gated dal Cristallo Blu (devi prima battere il Custode) */
      { trigger: 'edge', side: 'north', toZone: 'castle', spawn: { x: 14, y: 18 }, requires: 'has_crystal_blue' },
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
    ],
  },
  cave: {
    id: 'cave',
    name: 'Caverna delle Gemme',
    map: CAVE_MAP,
    entities: CAVE_ENTITIES,
    spawn: { x: 14, y: 1 },
    music: 'cave',
    transitions: [
      { trigger: 'edge', side: 'north', toZone: 'village', spawn: { x: 14, y: 18 } },
    ],
  },
  castle: {
    id: 'castle',
    name: 'Castello del Re Ombra',
    map: CASTLE_MAP,
    entities: CASTLE_ENTITIES,
    spawn: { x: 14, y: 18 },
    music: 'castle',
    transitions: [
      { trigger: 'edge', side: 'south', toZone: 'village', spawn: { x: 14, y: 1 } },
    ],
  },
  plains: {
    id: 'plains',
    name: 'Pianura dell\'Ovest',
    map: PLAINS_MAP,
    entities: PLAINS_ENTITIES,
    spawn: { x: 28, y: 10 },
    music: 'village',
    transitions: [
      { trigger: 'edge', side: 'east', toZone: 'village', spawn: { x: 1, y: 10 } },
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
