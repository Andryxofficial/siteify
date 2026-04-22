/**
 * Andryx Jump — definizione dei 10 mondi e dei loro livelli.
 *
 * Ogni livello e` una griglia di stringhe (tilemap). I tile usano il
 * vocabolario di tiles.js. Ogni mondo ha:
 *   id          (1-10)
 *   nameKey     (per i18n, fallback al nome italiano)
 *   palette     (colori tematici per sfondo + tile)
 *   musicWorld  (1-10, indice della traccia in audio.js)
 *   levels      (array di livelli — ognuno: { name, map, parTime })
 *
 * I livelli del Mondo 1 (Foresta di Twitchia) sono completi e disegnati
 * a mano. I mondi 2-10 hanno UN livello ciascuno generato proceduralmente
 * (con tema visivo distinto) come "stub" suonabile, pronto per essere
 * sostituito con livelli disegnati a mano nelle PR successive.
 */

import { TILES } from './tiles.js';

/* ─── Helper: padding di una mappa a larghezza uniforme. ─── */
function pad(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.'));
}

/* ─── Helper: genera un livello procedurale "auto-scrolling-style".
   Lunghezza configurabile; piattaforme casuali ma deterministiche
   (seedate sul mondo) per garantire riproducibilita`. Posiziona
   spawn player, nemici, monete, power-up, bandiera. ─── */
function generateLevel(world, length = 96, height = 18, theme = {}) {
  let seed = (world * 2654435761 + 13) & 0xffffffff;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const groundChar  = theme.ground  || TILES.GRASS;
  const earthChar   = theme.earth   || TILES.EARTH;
  const enemyChars  = theme.enemies || [TILES.SLIME, TILES.BAT, TILES.SPIKE];
  const dangerChar  = theme.danger  || null; // 'l' (lava) o 'w' (water) opzionale per "buchi"

  /* griglia vuota */
  const grid = Array.from({ length: height }, () => new Array(length).fill('.'));

  /* riga del terreno: di base height-3, con qualche dislivello e qualche buco */
  let groundRow = height - 3;
  let i = 0;
  while (i < length) {
    /* a volte un buco */
    const gap = i > 8 && i < length - 12 && rand() < 0.07;
    if (gap) {
      const gapW = 2 + Math.floor(rand() * 3);
      /* riempi col danger sotto se richiesto */
      if (dangerChar) {
        for (let r = groundRow; r < height; r++) {
          for (let k = 0; k < gapW && i + k < length; k++) grid[r][i + k] = dangerChar;
        }
      }
      i += gapW;
      continue;
    }
    /* a volte un dislivello */
    if (i > 6 && rand() < 0.10) {
      groundRow += rand() < 0.5 ? -1 : 1;
      groundRow = Math.max(height - 8, Math.min(height - 2, groundRow));
    }
    /* terreno */
    grid[groundRow][i] = groundChar;
    for (let r = groundRow + 1; r < height; r++) grid[r][i] = earthChar;
    /* monete sopra */
    if (rand() < 0.10 && groundRow - 2 > 1) grid[groundRow - 2][i] = TILES.COIN;
    /* nemici */
    if (i > 12 && rand() < 0.06) {
      const e = enemyChars[Math.floor(rand() * enemyChars.length)];
      grid[groundRow - 1][i] = e;
    }
    /* piattaforma fluttuante ogni tanto */
    if (i > 8 && rand() < 0.05) {
      const platRow = Math.max(2, groundRow - 4 - Math.floor(rand() * 3));
      const platLen = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < platLen && i + k < length; k++) {
        if (grid[platRow][i + k] === '.') grid[platRow][i + k] = TILES.PLATFORM;
      }
      /* coin sopra la piattaforma */
      if (platRow - 1 >= 1) {
        for (let k = 0; k < platLen && i + k < length; k++) {
          if (grid[platRow - 1][i + k] === '.' && rand() < 0.5) grid[platRow - 1][i + k] = TILES.COIN;
        }
      }
    }
    /* question block ogni tanto */
    if (i > 10 && rand() < 0.04 && groundRow - 4 > 1) {
      grid[groundRow - 4][i] = TILES.QUESTION;
    }
    i++;
  }

  /* spawn player vicino all'inizio */
  grid[groundRow - 1][2] = TILES.PLAYER;

  /* checkpoint a meta` */
  const cpCol = Math.floor(length / 2);
  const cpRow = (() => {
    for (let r = 0; r < height; r++) {
      if (grid[r][cpCol] !== '.' && grid[r][cpCol] !== TILES.SLIME && grid[r][cpCol] !== TILES.BAT) {
        return r - 1;
      }
    }
    return height - 4;
  })();
  if (grid[cpRow][cpCol] === '.') grid[cpRow][cpCol] = TILES.CHECKPOINT;

  /* power-up casuale a 2/3 della corsa */
  const puCol = Math.floor(length * 2 / 3);
  for (let r = 1; r < height; r++) {
    if (grid[r][puCol] !== '.') {
      if (r > 2) grid[r - 2][puCol] = world % 3 === 0 ? TILES.POW_FEATHER : (world % 3 === 1 ? TILES.POW_CRYSTAL : TILES.POW_STAR);
      break;
    }
  }

  /* goal flag in fondo */
  for (let r = 1; r < height; r++) {
    if (grid[r][length - 4] !== '.') {
      grid[r - 1][length - 4] = TILES.GOAL;
      break;
    }
  }

  return grid.map(r => r.join(''));
}

/* ═══════════════════════════════════════════════════════════════════
   MONDO 1 — FORESTA DI TWITCHIA
   3 livelli disegnati a mano: introduce salto, monete, nemici, power-up,
   piattaforme one-way, question block, checkpoint, bandiera.
   ═══════════════════════════════════════════════════════════════════ */

const W1_L1 = pad([
  '............................................................................................',
  '............................................................................................',
  '............................................................................................',
  '............................................................................................',
  '...........................c.c.c.c..........................................................',
  '...................?bbb?...................b?b...................c.........................',
  '...........................................................................................',
  '...........................................................c......c....................F...',
  '..........c......................c.c.................ppp.........................gggg......',
  '...................c..............................................gggg....gggggGG..........',
  '..............ggg..............ggggggg.........s.....s.........ggGGGGGG....GGGGGGG..........',
  '...P..s............s..............GGGGG..gggggggGGGGGGGGGGGgggggGGGGGGGG....GGGGGGG..........',
  'gggggggggggggg..ggggggGGgggggggggggGGGGGggGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....GGGGGGG..........',
  'GGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....GGGGGGG..........',
  'GGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....GGGGGGG..........',
  'GGGGGGGGGGGGGGwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGwwwwGGGGGGG..........',
  'GGGGGGGGGGGGGGwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGwwwwGGGGGGG..........',
]);

const W1_L2 = pad([
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '....................c.c.c..........................c..c..c..............c.c.c.............',
  '..............?bbbb?...........bbbb?.................................?bbbbb?..............',
  '..........................c..............b?b...........c....b?b..........................',
  '..........................................................................................',
  '......c....................................................................c.....c...F....',
  '...........................................c......*..............$...............ggg.....',
  '......C............................................gggg............................GGG....',
  '...ggg......s..s.....v.....................gggggg..GGGG..............ggggg.gggggggggGGG....',
  '...GGG.....................s..s..s.........GGGGGG..GGGG.....v........GGGGGsGGGGGGGGGGGG....',
  'gggGGGggggggggggggggggggggggggGGGggggggggggggGGGGGGgGGGGggggggggggggggGGGGGGGGGGGGGGGGGG....',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG....',
]);

/* L1_L2 spawn position */
const W1_L2_FIXED = (() => {
  /* metti spawn player a riga 11 colonna 2 */
  const rows = W1_L2.map(r => r.split(''));
  rows[11][2] = TILES.PLAYER;
  return rows.map(r => r.join(''));
})();

const W1_L3 = pad([
  '...................................................................................................',
  '...................................................................................................',
  '...................c.c.c.c..............c.c.c......................................................',
  '...........................................................................................c.c.c..',
  '...........?bb?b?bb?...................?bbbbbbbb?......................................b?bbbbb?....',
  '...................................................b?b................c.c......................F.',
  '..........................................................................................gggggg..',
  '......c......................c..c...........................c......$.........c.....c......GGGGGG..',
  '..........x...x..............................................................................GGGG.',
  '...C..........................ppp........ppp.........s.....s.....s.....v......ggggg.....ggggGGGGG.',
  '...gggg........s..s...v..s.........................ggGGGGGggGGGGGGGGGGGGGGGGGGgGGGGGggggggGGGGGGGG.',
  'P..GGGGggggggggggGGgggggggggggggGGGGGggGGGGGGGGGgggggGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'gggGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGwwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGwwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
]);

/* ─── Definizione mondi ─── */

export const WORLDS = [
  {
    id: 1,
    name: 'Foresta di Twitchia',
    nameEn: 'Forest of Twitchia',
    nameEs: 'Bosque de Twitchia',
    palette: {
      sky:    '#7ed6e8',
      skyTop: '#5fb8d4',
      ground: '#5fa454',
      earth:  '#7a4f2e',
      grassTop:'#88d65a',
      brick:  '#e89c5a',
      brickShadow:'#a05010',
      crystal:'#22e0ff',
      cloud:  '#ffffff',
      sun:    '#ffeb6b',
      foliage:'#3d8b3d',
    },
    musicWorld: 1,
    levels: [
      { name: '1-1', map: W1_L1,        parTime: 90, hint: 'Salta sui Sloimo, raccogli le monete!' },
      { name: '1-2', map: W1_L2_FIXED,  parTime: 110, hint: 'Question block: salta sotto per rivelarli.' },
      { name: '1-3', map: W1_L3,        parTime: 140, hint: 'Attento agli spuntoni!' },
    ],
  },
  {
    id: 2,
    name: 'Pianure di Pixel',
    nameEn: 'Pixel Plains',
    nameEs: 'Llanuras de Pixel',
    palette: {
      sky: '#a8e0ff', skyTop: '#7fc4f0',
      ground: '#7fb84a', earth: '#6b3a1e',
      grassTop: '#9fdb5a', brick: '#d6873e', brickShadow: '#8a4010',
      crystal: '#22e0ff', cloud: '#ffffff', sun: '#fff080', foliage: '#3d8b3d',
    },
    musicWorld: 2,
    levels: [
      { name: '2-1', map: generateLevel(2, 100, 18, { ground: TILES.GRASS, earth: TILES.EARTH, enemies: [TILES.SLIME, TILES.SLIME, TILES.BAT] }), parTime: 120, hint: 'Aperto e veloce.' },
    ],
  },
  {
    id: 3,
    name: 'Caverna delle Gemme',
    nameEn: 'Cave of Gems',
    nameEs: 'Cueva de las Gemas',
    palette: {
      sky: '#1a1a2e', skyTop: '#0f0f1a',
      ground: '#5a4a6a', earth: '#3a2a4a',
      grassTop: '#7a6a8a', brick: '#a89060', brickShadow: '#5a4830',
      crystal: '#ff66cc', cloud: '#3a3a5a', sun: '#fff0a0', foliage: '#5a4a6a',
    },
    musicWorld: 3,
    levels: [
      { name: '3-1', map: generateLevel(3, 100, 18, { ground: TILES.GROUND, earth: TILES.EARTH, enemies: [TILES.BAT, TILES.SPIKE, TILES.SLIME] }), parTime: 130, hint: 'Buio, attento ai pipistrelli.' },
    ],
  },
  {
    id: 4,
    name: 'Deserto del Lag',
    nameEn: 'Lag Desert',
    nameEs: 'Desierto del Lag',
    palette: {
      sky: '#f8c47a', skyTop: '#e89d4a',
      ground: '#e8c890', earth: '#b88850',
      grassTop: '#f8d8a8', brick: '#d6873e', brickShadow: '#8a4010',
      crystal: '#22e0ff', cloud: '#fff5d4', sun: '#ff9040', foliage: '#a87a40',
    },
    musicWorld: 4,
    levels: [
      { name: '4-1', map: generateLevel(4, 110, 18, { ground: TILES.GRASS, earth: TILES.EARTH, enemies: [TILES.SLIME, TILES.SPIKE, TILES.SPIKE] }), parTime: 140, hint: 'Salti lunghi sulle dune.' },
    ],
  },
  {
    id: 5,
    name: 'Palude del Buffer',
    nameEn: 'Buffer Swamp',
    nameEs: 'Pantano del Buffer',
    palette: {
      sky: '#7a9a5a', skyTop: '#4a6a4a',
      ground: '#4a5a3a', earth: '#3a4a2a',
      grassTop: '#6a8a4a', brick: '#7a6a4a', brickShadow: '#3a3020',
      crystal: '#90ff70', cloud: '#a8b88a', sun: '#fff080', foliage: '#2a4a2a',
    },
    musicWorld: 5,
    levels: [
      { name: '5-1', map: generateLevel(5, 100, 18, { ground: TILES.GRASS, earth: TILES.EARTH, enemies: [TILES.BAT, TILES.SLIME, TILES.SLIME], danger: TILES.WATER }), parTime: 150, hint: 'Acqua melmosa: cammina lento.' },
    ],
  },
  {
    id: 6,
    name: 'Vetta del Ping',
    nameEn: 'Ping Peak',
    nameEs: 'Cima del Ping',
    palette: {
      sky: '#b8d8ff', skyTop: '#88b8e8',
      ground: '#a8b8c8', earth: '#688090',
      grassTop: '#d8e8f8', brick: '#c0c0d0', brickShadow: '#606080',
      crystal: '#22e0ff', cloud: '#ffffff', sun: '#fff080', foliage: '#506070',
    },
    musicWorld: 6,
    levels: [
      { name: '6-1', map: generateLevel(6, 110, 18, { ground: TILES.GRASS, earth: TILES.EARTH, enemies: [TILES.BAT, TILES.BAT, TILES.SPIKE] }), parTime: 150, hint: 'Salta da nuvola in nuvola.' },
    ],
  },
  {
    id: 7,
    name: 'Tundra del Frame',
    nameEn: 'Frame Tundra',
    nameEs: 'Tundra del Frame',
    palette: {
      sky: '#c8e0f0', skyTop: '#90b8d0',
      ground: '#d0e8f0', earth: '#88a0b0',
      grassTop: '#ffffff', brick: '#a0c8d8', brickShadow: '#406080',
      crystal: '#90e0ff', cloud: '#ffffff', sun: '#ffe080', foliage: '#7090a0',
    },
    musicWorld: 7,
    levels: [
      { name: '7-1', map: generateLevel(7, 110, 18, { ground: TILES.ICE, earth: TILES.EARTH, enemies: [TILES.SLIME, TILES.BAT, TILES.SPIKE] }), parTime: 160, hint: 'Ghiaccio scivoloso!' },
    ],
  },
  {
    id: 8,
    name: 'Inferno del Crash',
    nameEn: 'Crash Inferno',
    nameEs: 'Infierno del Crash',
    palette: {
      sky: '#3a1010', skyTop: '#1a0505',
      ground: '#5a2010', earth: '#3a1005',
      grassTop: '#a04020', brick: '#c06030', brickShadow: '#601800',
      crystal: '#ff8040', cloud: '#5a2010', sun: '#ff4020', foliage: '#5a2010',
    },
    musicWorld: 8,
    levels: [
      { name: '8-1', map: generateLevel(8, 110, 18, { ground: TILES.GROUND, earth: TILES.EARTH, enemies: [TILES.SPIKE, TILES.BAT, TILES.SLIME], danger: TILES.LAVA }), parTime: 170, hint: 'Lava: un tocco e morte!' },
    ],
  },
  {
    id: 9,
    name: 'Notte Stellare',
    nameEn: 'Starry Night',
    nameEs: 'Noche Estrellada',
    palette: {
      sky: '#1a1a4a', skyTop: '#0a0a2a',
      ground: '#3a3a5a', earth: '#1a1a3a',
      grassTop: '#5a5a8a', brick: '#7060a0', brickShadow: '#302050',
      crystal: '#a0a0ff', cloud: '#3a3a6a', sun: '#fff0c0', foliage: '#3a3a5a',
    },
    musicWorld: 9,
    levels: [
      { name: '9-1', map: generateLevel(9, 110, 18, { ground: TILES.GRASS, earth: TILES.EARTH, enemies: [TILES.BAT, TILES.BAT, TILES.SPIKE] }), parTime: 170, hint: 'Stelle lampeggianti.' },
    ],
  },
  {
    id: 10,
    name: 'Castello del Re Ombra',
    nameEn: 'Shadow King Castle',
    nameEs: 'Castillo del Rey Sombra',
    palette: {
      sky: '#2a1a3a', skyTop: '#150a20',
      ground: '#5a4060', earth: '#3a2040',
      grassTop: '#7a5080', brick: '#a08040', brickShadow: '#503020',
      crystal: '#ff40a0', cloud: '#3a2a4a', sun: '#ff8040', foliage: '#3a2a4a',
    },
    musicWorld: 10,
    levels: [
      { name: '10-1', map: generateLevel(10, 120, 18, { ground: TILES.GROUND, earth: TILES.EARTH, enemies: [TILES.SPIKE, TILES.BAT, TILES.SPIKE], danger: TILES.LAVA }), parTime: 200, hint: 'Il livello finale.' },
    ],
  },
];

/** Restituisce il mondo per id (1-10). */
export function getWorld(id) {
  return WORLDS.find(w => w.id === id) || WORLDS[0];
}

/** Restituisce un livello specifico { world, level, def }. */
export function getLevel(worldId, levelIdx) {
  const w = getWorld(worldId);
  const lev = w.levels[levelIdx - 1] || w.levels[0];
  return { world: w, level: lev, levelIdx };
}

/** Numero totale di livelli del mondo. */
export function levelCount(worldId) {
  return getWorld(worldId).levels.length;
}

/** True se un livello esiste (per la transizione next-level). */
export function hasLevel(worldId, levelIdx) {
  const w = WORLDS.find(x => x.id === worldId);
  return !!(w && w.levels[levelIdx - 1]);
}

/** Restituisce la coppia (world,level) successiva a quella data (o null se finale). */
export function nextLevel(worldId, levelIdx) {
  if (hasLevel(worldId, levelIdx + 1)) return { world: worldId, level: levelIdx + 1 };
  if (hasLevel(worldId + 1, 1)) return { world: worldId + 1, level: 1 };
  return null;
}
