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
  'T,SSS.........__......b,.,,,.T',
  'T,SXS,......p.__,,....p,..b..T',
  'T.S.S......,.,__,.,,,,.,..,..T',
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
  /* Anziano del villaggio — indica la via della grotta */
  { type: 'npc', kind: 'elder', x: 8, y: 12, dialog: 'elder_village' },
  /* Mercante e bambino vicino alla fontana (NE della croce) */
  { type: 'npc', kind: 'merchant', x: 19, y: 8, dialog: 'merchant' },
  { type: 'npc', kind: 'child', x: 13, y: 9, dialog: 'child' },
  /* Vaso speciale 'q' — gestito come tile, non entità (vedi engine trySmashTile) */
  /* La spada di papà Andryx — rimossa dal villaggio, ora nella Grotta del Saggio */
  /* Cartello al centro: indica le 4 direzioni */
  { type: 'sign', x: 16, y: 11, textKey: 'village_main', text: 'Crocevia del Villaggio.\nN: Castello (Cristallo Blu)\nS: Caverna delle Gemme\nE: Foresta Sussurrante\nO: Pianura dell\'Ovest' },
  /* Cartello fontana */
  { type: 'sign', x: 18, y: 9, textKey: 'village_fountain', text: 'Fontana del Villaggio.\nL\'acqua riflette le stelle.' },
  /* Cartello vicino all'imbocco nord: ricorda al player il gate del castello */
  { type: 'sign', x: 13, y: 1, textKey: 'village_castle', text: 'Strada per il Castello.\nRichiede il Cristallo Blu.' },
  /* Cartello vicino all'ingresso della grotta */
  { type: 'sign', x: 6, y: 4, textKey: 'village_cave_hint', text: 'Una vecchia grotta...\nSi dice che un saggio\nviva in queste rocce.' },
  /* Cartello vicino alla casa di Andryx (hint sul vaso dorato) */
  { type: 'sign', x: 6, y: 15, textKey: 'village_house', text: 'Casa di Andryx.\nI vasi dorati\nnascondono segreti preziosi...' },
  /* Cartello est: richiede spada e scudo per avventurarsi */
  { type: 'sign', x: 28, y: 10, textKey: 'village_east', text: 'Foresta Sussurrante.\nPericoloso! Servono\nspada e scudo.' },
  /* Cartello sud: caverna */
  { type: 'sign', x: 14, y: 18, textKey: 'village_south', text: 'Caverna delle Gemme.\nPorta spada e scudo\nper sopravvivere!' },
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
  /* Nemici nella prima area della foresta */
  { type: 'enemy', kind: 'slime', x: 8, y: 6 },
  { type: 'enemy', kind: 'slime', x: 18, y: 8 },
  { type: 'enemy', kind: 'slime', x: 12, y: 14 },
  { type: 'enemy', kind: 'slime', x: 25, y: 3 },
  { type: 'enemy', kind: 'bat', x: 22, y: 5 },
  { type: 'enemy', kind: 'bat', x: 10, y: 3 },
  { type: 'enemy', kind: 'bat', x: 6, y: 15 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 13 },
  { type: 'enemy', kind: 'skeleton', x: 16, y: 12 },
  { type: 'enemy', kind: 'skeleton', x: 20, y: 17 },
  { type: 'enemy', kind: 'mage', x: 26, y: 10 },
  /* Mini-boss: Troll della Foresta (zona profonda est-sud) */
  { type: 'enemy', kind: 'forest_troll', x: 24, y: 16 },
  /* Oggetti: heart container a destra profonda + ricompense troll */
  { type: 'item', kind: 'heart_container', x: 26, y: 17, requires: 'has_crystal_green:false' },
  { type: 'item', kind: 'bomb', x: 28, y: 5, requires: 'forest_troll_defeated' },
  { type: 'item', kind: 'rupee', x: 5, y: 2 },
  { type: 'item', kind: 'potion', x: 14, y: 16, requires: 'forest_troll_defeated' },
  /* Cristallo verde appare dopo aver ripulito la zona (vedi engine) */
  { type: 'item', kind: 'crystal_green', x: 14, y: 2, requires: 'forest_clear' },
  { type: 'sign', x: 2, y: 17, textKey: 'forest_main', text: 'Foresta Sussurrante.\nElimina tutti i nemici,\nincluso il Troll, per\nfar apparire il Cristallo.' },
  { type: 'sign', x: 18, y: 14, textKey: 'forest_troll_hint', text: 'Attenzione!\nSi sente un rumore pesante\nnella foresta profonda...' },
];

/* ─── ZONA 2: Caverna delle Gemme — dungeon a 3 stanze con puzzle e boss ───
   Apertura sul bordo NORD (cols 14-15) per arrivo dal Villaggio.
   Struttura: Room 1 (rows 1-7) → porta D a col14 row8 → Room 2 (rows 9-13)
   → porta D a col8 row14 (aperta da puzzle blocchi) → Boss Room (rows 15-18). */
const CAVE_MAP = [
  'WWWWWWWWWWWWWWFFWWWWWWWWWWWWWW',  // 0: ingresso nord, porta a col14-15
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 1: Room 1 aperta
  'WFtFFFFFFFFFFFFFFFFFFFFFFFtFFW',  // 2: torce spente a col2 e col26
  'WFFFFpFFFFFFFFFFFFFFFFFpFFFFFW',  // 3: vasi a col5 e col22
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 4
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 5
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 6
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 7: fine Room 1
  'WWWWWWWWWWWWWWDWWWWWWWWWWWWWWW',  // 8: PORTA BLOCCATA D a col14 (Room 1→2)
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 9: Room 2 inizio
  'WFFFFBFFFFFFFFFFFFFFFFBFFFFFFW',  // 10: blocchi spingibili B a col5 e col22
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 11
  'WFFFFPFFFFFFFFFtFFFFFFFPFFFFFW',  // 12: piastre P a col5 e col23, torcia t a col15
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 13: fine Room 2
  'WWWWWWWWDWWWWWWWWWWWWWWWWWWWWW',  // 14: SECONDA PORTA D a col8 (Room 2→Boss)
  'WLFFFFFFFFFFFFFFFFFFFFFFFFFFLW',  // 15: Boss Room con lava perimetro
  'WLFFFFFFFFFFFFFFFFFFFFFFFFFFLW',  // 16
  'WLFFFFFFFFFFFFFFFFFFFFFFFFFFLW',  // 17
  'WLFFFFFFFFFFFFFFFFFFFFFFFFFFLW',  // 18
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 19: fondo
];

const CAVE_ENTITIES = [
  /* ─── Room 1 (rows 1-7) ─── */
  { type: 'enemy', kind: 'skeleton', x: 6, y: 3 },
  { type: 'enemy', kind: 'skeleton', x: 22, y: 3 },
  { type: 'enemy', kind: 'bat', x: 14, y: 5 },
  { type: 'enemy', kind: 'goblin', x: 8, y: 6 },
  { type: 'enemy', kind: 'goblin', x: 20, y: 5 },
  /* Chest con chiave in Room 1 */
  { type: 'chest', contains: 'key', x: 26, y: 5 },
  /* Oggetti Room 1 */
  { type: 'item', kind: 'rupee', x: 4, y: 2 },
  { type: 'item', kind: 'rupee', x: 25, y: 2 },
  { type: 'item', kind: 'potion', x: 3, y: 6 },

  /* ─── Room 2 (rows 9-13) — si popola dopo cave_door1 ─── */
  { type: 'enemy', kind: 'skeleton', x: 14, y: 10, requires: 'cave_door1' },
  { type: 'enemy', kind: 'mage', x: 8, y: 11, requires: 'cave_door1' },
  { type: 'enemy', kind: 'mage', x: 21, y: 11, requires: 'cave_door1' },
  /* Chest con heart container in Room 2 */
  { type: 'chest', contains: 'heart_container', x: 14, y: 12, requires: 'cave_door1' },
  /* Chiave extra per seconda porta */
  { type: 'item', kind: 'key', x: 26, y: 12, requires: 'cave_door1' },

  /* ─── Boss Room (rows 15-18) — si attiva con cave_torches ─── */
  { type: 'boss', kind: 'guardian', x: 14, y: 17, requires: 'cave_torches' },
  /* Ricompense post-boss */
  { type: 'item', kind: 'crystal_blue', x: 14, y: 15, requires: 'guardian_defeated' },
  { type: 'item', kind: 'heart_container', x: 4, y: 15, requires: 'guardian_defeated' },

  /* ─── Cartelli ─── */
  { type: 'sign', x: 14, y: 2, textKey: 'cave_main', text: 'Caverna delle Gemme.\nUsa le chiavi per aprire\nle porte. Accendi le torce\nper risvegliare il Custode.' },
  { type: 'sign', x: 2, y: 17, textKey: 'cave_deep', text: 'Sento passi pesanti...\nSii prudente, viandante.' },
];

/* ─── ZONA 3: Castello del Re Ombra — boss finale ───
   Apertura sul bordo SUD (cols 14-15) per arrivo dal Villaggio. */
const CASTLE_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 0: muro nord
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 1
  'WFLLFFFFFFFFFFFFFFFFFFFFFLLFFW',  // 2: lava agli angoli interni
  'WFLLFFFFFFFFFFFFFFFFFFFFLLFFFW',  // 3
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 4
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 5
  'WFWWWFFFFFFFFFFFFFFFFFFFFWWWFW',  // 6: muri sala trono (ovest/est)
  'WFWFFFFFFFFFFFFFFFFFFFFFFFFWFW',  // 7: corridoi laterali
  'WFWFFFFFFFFFFFFFFFFFFFFFFFFWFW',  // 8
  'WFWFFFFFFFFFFFFFFFFFFFFFFFFWFW',  // 9
  'WFWWWFFFFFFFFFFFFFFFFFFFFWWWFW',  // 10
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 11: cortile interno
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 12
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 13
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 14: muro divisorio
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 15: cortile esterno
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 16
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 17
  'WFFFFFFFFFFFFFFFFFFFFFFFFFFFFW',  // 18
  'WWWWWWWWWWWWWWFFWWWWWWWWWWWWWW',  // 19: ingresso dal basso
];

const CASTLE_ENTITIES = [
  /* ─── Cortile esterno (rows 15-18) ─── */
  { type: 'enemy', kind: 'skeleton', x: 7, y: 16 },
  { type: 'enemy', kind: 'skeleton', x: 22, y: 16 },
  { type: 'enemy', kind: 'goblin', x: 14, y: 15 },
  { type: 'enemy', kind: 'goblin', x: 6, y: 17 },
  { type: 'enemy', kind: 'goblin', x: 23, y: 17 },
  /* Chest nel cortile esterno */
  { type: 'chest', contains: 'key', x: 26, y: 16 },
  { type: 'chest', contains: 'potion', x: 3, y: 16 },

  /* ─── Corridoi interni (rows 11-13) ─── */
  { type: 'enemy', kind: 'mage', x: 5, y: 12 },
  { type: 'enemy', kind: 'mage', x: 24, y: 12 },
  { type: 'enemy', kind: 'skeleton', x: 14, y: 11 },
  { type: 'enemy', kind: 'skeleton', x: 8, y: 13 },
  { type: 'enemy', kind: 'skeleton', x: 20, y: 13 },

  /* ─── Anticamera trono (rows 4-5) ─── */
  { type: 'enemy', kind: 'mage', x: 8, y: 5 },
  { type: 'enemy', kind: 'mage', x: 21, y: 5 },
  { type: 'enemy', kind: 'skeleton', x: 3, y: 4 },
  { type: 'enemy', kind: 'skeleton', x: 26, y: 4 },

  /* ─── Boss: Re Ombra ─── */
  { type: 'boss', kind: 'shadow_king', x: 14, y: 7, requires: 'castle_clear' },

  /* ─── Loot ─── */
  { type: 'item', kind: 'crystal_red', x: 14, y: 5, requires: 'shadow_king_defeated' },
  { type: 'item', kind: 'potion', x: 2, y: 9, requires: 'has_crystal_red:false' },
  { type: 'item', kind: 'rupee', x: 27, y: 9, requires: 'has_crystal_red:false' },
  { type: 'item', kind: 'heart_container', x: 2, y: 3, requires: 'shadow_king_defeated' },

  /* ─── Cartelli ─── */
  { type: 'sign', x: 14, y: 17, textKey: 'castle_main', text: 'Castello del Re Ombra.\nSconfiggi le guardie per\nrisvegliare il Re.' },
  { type: 'sign', x: 2, y: 2, textKey: 'castle_lava', text: 'Attento alla lava!' },
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

/* ─── ZONA 5: Grotta del Saggio — caverna dove il vecchio dona la spada ───
   Ispirata al primo The Legend of Zelda (1986): il vecchietto nella caverna.
   Ingresso dal Villaggio tramite portal trigger al tile (3,4).
   Uscita: bordo sud → Villaggio spawn (3,6).
   Pareti: S (massi naturali), pavimento: X (terra scura). */
const ELDER_CAVE_MAP = [
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'SSSSSSSSSXXXXXXXXXXXXXSSSSSSSS',
  'SSSSSSSXXXXXXXXXXXXXXXXSSSSSSS',
  'SSSSSlXXXXXXXXXXXXXXXXXXXSSSSS',
  'SSSSXXXXXXXXXXXXXXXXXXXXXXSSSS',
  'SSSSXXXXXXXXXXXXXXXXXXXXXXSSSS',
  'SSSSXXXXXXXXXXXXXXXXXXXXXXSSSS',
  'SSSSXXXXXXXXXXXXXXXXXXXXlXSSSS',
  'SSSSSSXXXXXXXXXXXXXXXXXXSSSSSS',
  'SSSSSSSSSSXXXXXXXXXXSSSSSSSSSS',
  'SSSSSSSSSSSSSXXXXSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSXXXXSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSXXXXSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSXXXXSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSXXXXSSSSSSSSSSSSS',
];

const ELDER_CAVE_ENTITIES = [
  /* L'Anziano siede al centro della grotta con la spada di papà Andryx */
  { type: 'npc', kind: 'elder', x: 14, y: 10, dialog: 'elder_intro' },
  /* La spada del padre — raccolta solo se non già posseduta */
  { type: 'item', kind: 'sword', x: 13, y: 10, requires: 'has_sword:false' },
  /* Piccola ricompensa nascosta nella grotta */
  { type: 'item', kind: 'rupee', x: 8, y: 9, requires: 'has_sword:false' },
  { type: 'item', kind: 'rupee', x: 20, y: 11, requires: 'has_sword:false' },
];


/* ─── ZONA 6: Casa di Andryx — interno cozy con scudo e storia ───
   Ingresso dal Villaggio via portal trigger al tile (3,14) — porta sbloccata
   con house_key. Uscita: bordo sud (col 14, row 19) → Villaggio spawn (3,15).
   Layout: stanza centrale 15×7 (cols 8-22, rows 7-13) con torce, vasi,
   scudo del padre. Corridoio di uscita su col 14, rows 14-19. */
const ANDRYX_HOUSE_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 0
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 1
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 2
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 3
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 4
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 5
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 6
  'WWWWWWWWlFFFFFFFFFFFFFlWWWWWWW',  // 7: torce(8,22), stanza(9-21)
  'WWWWWWWWFpFFFFFFFFFFFpFWWWWWWW',  // 8: vasi(9,21)
  'WWWWWWWWFFFFFFFFFFFFFFFWWWWWWW',  // 9: (Fix a uppercase sotto)
  'WWWWWWWWFFFFFFFFFFFFFFFWWWWWWW',  // 10
  'WWWWWWWWFFFFFFFFFFFFFFFWWWWWWW',  // 11: scudo a (14,11)
  'WWWWWWWWFFFFFFFFFFFFFFFWWWWWWW',  // 12
  'WWWWWWWWlFFFFFFFFFFFFFlWWWWWWW',  // 13: torce basse(8,22)
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 14: corridoio (col 14)
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 15
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 16
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 17: spaWn player
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 18
  'WWWWWWWWWWWWWWFWWWWWWWWWWWWWWW',  // 19: uscita (south edge)
];

const ANDRYX_HOUSE_ENTITIES = [
  /* Lo scudo del padre — oggetto principale della stanza */
  { type: 'item', kind: 'shield', x: 14, y: 11, requires: 'has_shield:false' },
  /* Rupie nei vasi decorativi (loot) */
  { type: 'item', kind: 'rupee', x: 12, y: 9 },
  { type: 'item', kind: 'heart', x: 16, y: 9 },
  /* Nota del padre: racconta la storia */
  { type: 'sign', x: 10, y: 10, text: 'Caro figlio mio,\nse stai leggendo questo,\nil regno è in pericolo.\nPrendi la mia spada\ne lo scudo di tua madre.\nProteggi Twitchia.\n— Tuo padre, Andryx Senior' },
];

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
      /* Foresta e Caverna: richiedono spada + scudo */
      { trigger: 'edge', side: 'east',  toZone: 'forest', spawn: { x: 1, y: 10 },
        requires: 'has_sword&has_shield',
        blockedMsg: 'Troppo pericoloso! Hai bisogno di spada e scudo.\nLo scudo è nella tua casa.' },
      { trigger: 'edge', side: 'south', toZone: 'cave',   spawn: { x: 14, y: 1 },
        requires: 'has_sword&has_shield',
        blockedMsg: 'Troppo pericoloso! Hai bisogno di spada e scudo.\nLo scudo è nella tua casa.' },
      /* Pianura: basta la spada */
      { trigger: 'edge', side: 'west',  toZone: 'plains', spawn: { x: 28, y: 10 },
        requires: 'has_sword',
        blockedMsg: 'Hai bisogno almeno della spada.\nParla con il saggio nella grotta.' },
      /* Nord → Castello: gated dal Cristallo Blu (devi prima battere il Custode) */
      { trigger: 'edge', side: 'north', toZone: 'castle', spawn: { x: 14, y: 18 }, requires: 'has_crystal_blue',
        blockedMsg: 'La strada per il Castello è sbarrata.\nPorta il Cristallo Blu!' },
      /* Ingresso alla Grotta del Saggio — tile (3,4) è l'apertura nella roccia */
      { trigger: 'portal', x: 3, y: 4, toZone: 'elder_cave', spawn: { x: 14, y: 17 } },
      /* Ingresso alla Casa di Andryx — porta si apre con la chiave di casa */
      { trigger: 'portal', x: 3, y: 14, toZone: 'andryx_house', spawn: { x: 14, y: 17 }, requires: 'house_key' },
    ],
    firstEntryDialog: 'village_intro',
  },
  forest: {
    id: 'forest',
    name: 'Foresta Sussurrante',
    map: FOREST_MAP,
    entities: FOREST_ENTITIES,
    spawn: { x: 1, y: 10 },
    music: 'forest',
    firstEntryDialog: 'forest_enter',
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
    firstEntryDialog: 'cave_enter',
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
    firstEntryDialog: 'castle_enter',
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
  elder_cave: {
    id: 'elder_cave',
    name: 'Grotta del Saggio',
    map: ELDER_CAVE_MAP,
    entities: ELDER_CAVE_ENTITIES,
    spawn: { x: 14, y: 17 },
    music: 'cave',
    /* Uscita: bordo sud → torna nel villaggio appena fuori dall'ingresso */
    transitions: [
      { trigger: 'edge', side: 'south', toZone: 'village', spawn: { x: 3, y: 6 } },
    ],
  },
  andryx_house: {
    id: 'andryx_house',
    name: 'Casa di Andryx',
    map: ANDRYX_HOUSE_MAP,
    entities: ANDRYX_HOUSE_ENTITIES,
    spawn: { x: 14, y: 17 },
    music: 'village',
    firstEntryDialog: 'andryx_house_enter',
    /* Uscita: bordo sud → torna nel villaggio appena fuori dalla porta */
    transitions: [
      { trigger: 'edge', side: 'south', toZone: 'village', spawn: { x: 4, y: 15 } },
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
