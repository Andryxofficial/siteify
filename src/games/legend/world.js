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
  /* La spada di papà Andryx — appare DAVANTI casa appena la porta si apre */
  { type: 'item', kind: 'sword', x: 2, y: 13, requires: 'house_key' },
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
  /* Nemici distribuiti per la grotta */
  { type: 'enemy', kind: 'skeleton', x: 5, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 24, y: 4 },
  { type: 'enemy', kind: 'skeleton', x: 26, y: 14 },
  { type: 'enemy', kind: 'bat', x: 14, y: 6 },
  { type: 'enemy', kind: 'bat', x: 20, y: 12 },
  { type: 'enemy', kind: 'bat', x: 4, y: 15 },
  { type: 'enemy', kind: 'mage', x: 22, y: 9, requires: 'cave_door1' },
  { type: 'enemy', kind: 'mage', x: 8, y: 14, requires: 'cave_door1' },
  /* Boss Custode: appare solo dopo aver acceso le 2 torce */
  { type: 'boss', kind: 'guardian', x: 14, y: 16, requires: 'cave_torches' },
  /* Oggetti: scudo nella prima stanza, pozione e rupie sparse, heart container dopo boss */
  { type: 'item', kind: 'shield', x: 3, y: 3, requires: 'has_shield:false' },
  { type: 'item', kind: 'potion', x: 3, y: 10 },
  { type: 'item', kind: 'rupee', x: 27, y: 3 },
  { type: 'item', kind: 'key', x: 27, y: 10 },
  { type: 'item', kind: 'heart_container', x: 3, y: 15, requires: 'guardian_defeated' },
  { type: 'item', kind: 'crystal_blue', x: 14, y: 16, requires: 'guardian_defeated' },
  { type: 'sign', x: 14, y: 2, textKey: 'cave_main', text: 'Caverna delle Gemme.\nAccendi le 2 torce per\nrisvegliare il Custode.\nLa chiave apre la porta.' },
  { type: 'sign', x: 2, y: 17, textKey: 'cave_deep', text: 'Sento passi pesanti\nprovenire dal fondo...\nSii prudente, viandante.' },
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
  /* Guardie: scheletri e maghi distribuiti per la sala */
  { type: 'enemy', kind: 'skeleton', x: 6, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 23, y: 8 },
  { type: 'enemy', kind: 'skeleton', x: 4, y: 4 },
  { type: 'enemy', kind: 'skeleton', x: 25, y: 4 },
  { type: 'enemy', kind: 'skeleton', x: 14, y: 11 },
  { type: 'enemy', kind: 'mage', x: 8, y: 14 },
  { type: 'enemy', kind: 'mage', x: 21, y: 14 },
  { type: 'enemy', kind: 'mage', x: 4, y: 16 },
  { type: 'enemy', kind: 'mage', x: 25, y: 16 },
  /* Boss Re Ombra: appare solo dopo aver sconfitto tutte le guardie */
  { type: 'boss', kind: 'shadow_king', x: 14, y: 7, requires: 'castle_clear' },
  /* Cristallo rosso appare dopo la sconfitta del boss */
  { type: 'item', kind: 'crystal_red', x: 14, y: 5, requires: 'shadow_king_defeated' },
  /* Pozione e rupee nascosti */
  { type: 'item', kind: 'potion', x: 2, y: 9, requires: 'has_crystal_red:false' },
  { type: 'item', kind: 'rupee', x: 27, y: 9, requires: 'has_crystal_red:false' },
  { type: 'sign', x: 14, y: 17, textKey: 'castle_main', text: 'Castello del Re Ombra.\nIl tuo destino ti attende.\nSconfiggi tutte le guardie\nper risvegliare il Re.' },
  { type: 'sign', x: 2, y: 2, textKey: 'castle_lava', text: 'Attento alle piastrelle\nincandescenti di lava!' },
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
