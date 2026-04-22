/**
 * Andryx Jump — mondi e livelli (world.js rewrite).
 * Mondo 1: 3 livelli hand-crafted. Mondi 2-10: procedurali.
 */

import { TILES } from './tiles.js';

function buildGrid(W, H, buildFn) {
  const g = Array.from({length: H}, () => Array(W).fill('.'));
  const set = (r, c, ch) => { if (r>=0&&r<H&&c>=0&&c<W) g[r][c]=ch; };
  const hline = (r, c1, c2, ch) => { for(let c=c1;c<=c2;c++) set(r,c,ch); };
  const vline = (c, r1, r2, ch) => { for(let r=r1;r<=r2;r++) set(r,c,ch); };
  buildFn(g, set, hline, vline);
  return g.map(r => r.join(''));
}

/* ─── Mondo 1-1 "Pianure di Twitchia" 165×17 ─── */
const W1L1 = buildGrid(165, 17, (g, set, hline, vline) => {
  // Suolo rows 13-16
  hline(13, 0, 164, 'g'); hline(14, 0, 164, 'G'); hline(15, 0, 164, 'G'); hline(16, 0, 164, '#');
  // Gap cols 62-65 e 91-94
  for (const [a,b] of [[62,65],[91,94]]) for (let c=a;c<=b;c++) { set(13,c,'.'); set(14,c,'.'); set(15,c,'.'); set(16,c,'.'); }
  // Player
  set(12, 2, 'P');
  // Sloimo
  set(12, 11, 's'); set(12, 17, 's');
  // Q-blocks row 9
  set(9, 15, '?'); set(9, 20, '?'); set(9, 23, '?');
  // Pipe 2-tall cols 26-27
  set(11,26,'['); set(11,27,']'); set(12,26,'{'); set(12,27,'}');
  // Sloimo
  set(12,31,'s'); set(12,37,'s');
  // Brick platform row 7
  hline(7, 38, 44, 'b'); set(7, 41, '?');
  // Pipe 3-tall cols 48-49
  set(10,48,'['); set(10,49,']'); set(11,48,'{'); set(11,49,'}'); set(12,48,'{'); set(12,49,'}');
  // One-way + coins
  hline(8, 54, 61, 'p'); hline(7, 55, 60, 'c');
  // Tartarax
  set(12, 55, 'k');
  // Bricks row 9
  hline(9, 66, 72, 'b'); set(9, 69, '?');
  // Pipe 2-tall cols 73-74
  set(11,73,'['); set(11,74,']'); set(12,73,'{'); set(12,74,'}');
  // Sloimo + checkpoint
  set(12,77,'s'); set(12,81,'s'); set(12,85,'C');
  // Q-blocks row 7
  set(7,95,'?'); set(7,96,'b'); set(7,97,'?'); set(7,98,'b'); set(7,99,'?');
  // Pipe 3-tall cols 101-102
  set(10,101,'['); set(10,102,']'); set(11,101,'{'); set(11,102,'}'); set(12,101,'{'); set(12,102,'}');
  // Enemies
  set(12,106,'s'); set(12,110,'k');
  // Brick platform high row 5
  hline(5, 113, 126, 'b'); set(5,116,'?'); set(5,120,'?'); set(5,124,'?');
  // Fire flower above platform
  set(4, 122, '@');
  // Enemies
  set(12,127,'s'); set(12,131,'s'); set(12,134,'k');
  // Scalinata
  hline(12,139,148,'#'); hline(11,139,148,'#');
  hline(10,141,148,'#'); hline(9,143,148,'#'); hline(8,145,148,'#'); hline(7,147,148,'#');
  // Goal pole col 155
  vline(155, 3, 12, '|'); set(3, 155, 'F');
  // Monete decorative
  hline(11, 60, 61, 'c');
});

/* ─── Mondo 1-2 "Grotte di Gemme" 160×17 ─── */
const W1L2 = buildGrid(160, 17, (g, set, hline, vline) => {
  // Soffitto
  hline(0, 0, 159, '#'); hline(1, 0, 159, '#');
  // Suolo tutto #
  hline(13,0,159,'#'); hline(14,0,159,'#'); hline(15,0,159,'#'); hline(16,0,159,'#');
  // Player
  set(12, 2, 'P');
  // Mattoni row 5
  hline(5,10,20,'b'); set(5,13,'?'); set(5,16,'?'); set(5,19,'?');
  hline(5,35,50,'b'); set(5,38,'?'); set(5,42,'?'); set(5,47,'?');
  hline(5,65,80,'b'); set(5,68,'?'); set(5,74,'?'); set(5,79,'?');
  hline(5,95,110,'b'); set(5,98,'?'); set(5,103,'?'); set(5,108,'?');
  // Monete in aree aperte
  for (let c=22; c<34; c+=3) set(9,c,'c');
  for (let c=52; c<64; c+=3) set(9,c,'c');
  for (let c=82; c<94; c+=3) set(9,c,'c');
  for (let c=112;c<128;c+=3) set(9,c,'c');
  // Nemici
  for (const c of [20,30,45,55,70,85,100,115,130]) set(12,c,'s');
  for (const c of [60,90,120,145]) set(12,c,'k');
  // Spike (x)
  set(12,25,'x'); set(12,75,'x'); set(12,125,'x');
  // Pipe
  set(11,40,'['); set(11,41,']'); set(12,40,'{'); set(12,41,'}');
  set(10,80,'['); set(10,81,']'); set(11,80,'{'); set(11,81,'}'); set(12,80,'{'); set(12,81,'}');
  // Checkpoint
  set(12,80,'C');
  // Power-up
  set(9,50,'$'); set(9,110,'~');
  // Scalinata
  hline(12,140,150,'#'); hline(11,140,150,'#'); hline(10,142,150,'#'); hline(9,144,150,'#');
  // Goal
  vline(155,3,12,'|'); set(3,155,'F');
});

/* ─── Mondo 1-3 "Ponte dei Pirati" 170×17 ─── */
const W1L3 = buildGrid(170, 17, (g, set, hline, vline) => {
  // Solo suolo inizio (0-14) e fine (155-169)
  for (const [a,b] of [[0,14],[155,169]]) {
    hline(13,a,b,'g'); hline(14,a,b,'G'); hline(15,a,b,'G'); hline(16,a,b,'#');
  }
  // Player
  set(12,2,'P');
  // Piattaforme fluttuanti one-way
  const plats = [
    [9,16,22],[8,26,32],[7,36,43],[9,48,55],[8,60,67],
    [6,72,79],[9,84,91],[7,96,103],[9,108,115],[7,120,127],
    [9,132,140],[8,142,149],[9,151,156]
  ];
  for (const [r,c1,c2] of plats) hline(r,c1,c2,'p');
  // Monete sulle piattaforme
  for (const [r,c1,c2] of plats) {
    const mid = Math.floor((c1+c2)/2);
    set(r-1, mid, 'c');
  }
  // Blocchi alti row 5
  hline(5,30,35,'b'); set(5,32,'?');
  hline(5,65,70,'b'); set(5,67,'?');
  hline(5,100,105,'b'); set(5,102,'@');
  hline(5,130,135,'b'); set(5,132,'?');
  // Nemici sulle piattaforme
  set(8,18,'s'); set(7,38,'s'); set(8,61,'s'); set(6,74,'s');
  set(8,29,'k'); set(8,62,'k'); set(7,97,'k'); set(8,143,'k');
  // Spike sulle piattaforme
  set(8,50,'x'); set(9,88,'x'); set(9,110,'x');
  // Checkpoint su piattaforma dedicata
  hline(9,89,91,'p'); set(8,90,'C');
  // Goal
  vline(160,3,12,'|'); set(3,160,'F');
});

/* ─── Livello procedurale (mondi 2-10) ─── */
function generateLevel(world, length=100, height=18, theme={}) {
  let seed = (world * 2654435761 + 13) & 0xffffffff;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gc = theme.ground || 'g';
  const ec = theme.earth  || 'G';
  const en = theme.enemies || ['s', 'x'];
  const dk = theme.danger  || null;

  const grid = Array.from({length: height}, () => new Array(length).fill('.'));
  let gRow = height - 3;
  let i = 0;
  while (i < length) {
    if (i > 8 && i < length-12 && rand() < 0.07) {
      const gw = 2 + Math.floor(rand()*3);
      if (dk) for (let r=gRow; r<height; r++) for (let k=0;k<gw&&i+k<length;k++) grid[r][i+k]=dk;
      i += gw; continue;
    }
    if (i > 6 && rand() < 0.10) { gRow += rand()<0.5?-1:1; gRow=Math.max(height-8,Math.min(height-2,gRow)); }
    grid[gRow][i] = gc;
    for (let r=gRow+1; r<height; r++) grid[r][i] = ec;
    if (rand() < 0.10 && gRow-2 > 1) grid[gRow-2][i] = 'c';
    if (i > 12 && rand() < 0.06) grid[gRow-1][i] = en[Math.floor(rand()*en.length)];
    if (i > 8 && rand() < 0.05) {
      const pr = Math.max(2, gRow-4-Math.floor(rand()*3));
      const pl = 2+Math.floor(rand()*4);
      for (let k=0;k<pl&&i+k<length;k++) if(grid[pr][i+k]==='.') grid[pr][i+k]='p';
    }
    if (i > 10 && rand() < 0.04 && gRow-4 > 1) grid[gRow-4][i] = '?';
    i++;
  }
  grid[gRow-1][2] = 'P';
  const cp = Math.floor(length/2);
  for (let r=0;r<height;r++) { if(grid[r][cp]!=='.') { if(grid[r-1][cp]==='.') grid[r-1][cp]='C'; break; } }
  const pu = Math.floor(length*2/3);
  for (let r=0;r<height;r++) { if(grid[r][pu]!=='.') { if(r>2) grid[r-2][pu]=world%3===0?'~':world%3===1?'*':'$'; break; } }
  for (let r=0;r<height;r++) { if(grid[r][length-4]!=='.') { grid[r-1][length-4]='F'; break; } }
  return grid.map(r=>r.join(''));
}

export const WORLDS = [
  {
    id:1, name:'Foresta di Twitchia', nameEn:'Forest of Twitchia', nameEs:'Bosque de Twitchia',
    palette:{ sky:'#7ed6e8',skyTop:'#5fb8d4',ground:'#5fa454',earth:'#7a4f2e',grassTop:'#88d65a',
              brick:'#e89c5a',brickShadow:'#a05010',crystal:'#22e0ff',cloud:'#ffffff',
              sun:'#ffeb6b',foliage:'#3d8b3d' },
    musicWorld:1,
    levels:[
      { name:'1-1', map:W1L1, parTime:300, hint:'Salta sui Sloimo!' },
      { name:'1-2', map:W1L2, parTime:280, hint:'Grotte oscure: attento ai nemici.' },
      { name:'1-3', map:W1L3, parTime:250, hint:'Ponte dei Pirati: non cadere!' },
    ],
  },
  { id:2,name:'Pianure di Pixel',nameEn:'Pixel Plains',nameEs:'Llanuras de Pixel',
    palette:{sky:'#a8e0ff',skyTop:'#7fc4f0',ground:'#7fb84a',earth:'#6b3a1e',grassTop:'#9fdb5a',brick:'#d6873e',brickShadow:'#8a4010',crystal:'#22e0ff',cloud:'#fff',sun:'#fff080',foliage:'#3d8b3d'},
    musicWorld:2, levels:[{name:'2-1',map:generateLevel(2,100,18,{ground:'g',earth:'G',enemies:['s','s','k']}),parTime:120,hint:'Aperto e veloce.'}] },
  { id:3,name:'Caverna delle Gemme',nameEn:'Cave of Gems',nameEs:'Cueva de las Gemas',
    palette:{sky:'#1a1a2e',skyTop:'#0f0f1a',ground:'#5a4a6a',earth:'#3a2a4a',grassTop:'#7a6a8a',brick:'#a89060',brickShadow:'#5a4830',crystal:'#ff66cc',cloud:'#3a3a5a',sun:'#fff0a0',foliage:'#5a4a6a'},
    musicWorld:3, levels:[{name:'3-1',map:generateLevel(3,100,18,{ground:'#',earth:'G',enemies:['x','s','k']}),parTime:130,hint:'Buio e gemme.'}] },
  { id:4,name:'Deserto del Lag',nameEn:'Lag Desert',nameEs:'Desierto del Lag',
    palette:{sky:'#f8c47a',skyTop:'#e89d4a',ground:'#e8c890',earth:'#b88850',grassTop:'#f8d8a8',brick:'#d6873e',brickShadow:'#8a4010',crystal:'#22e0ff',cloud:'#fff5d4',sun:'#ff9040',foliage:'#a87a40'},
    musicWorld:4, levels:[{name:'4-1',map:generateLevel(4,110,18,{ground:'g',earth:'G',enemies:['s','x','x']}),parTime:140,hint:'Salti sulle dune.'}] },
  { id:5,name:'Palude del Buffer',nameEn:'Buffer Swamp',nameEs:'Pantano del Buffer',
    palette:{sky:'#7a9a5a',skyTop:'#4a6a4a',ground:'#4a5a3a',earth:'#3a4a2a',grassTop:'#6a8a4a',brick:'#7a6a4a',brickShadow:'#3a3020',crystal:'#90ff70',cloud:'#a8b88a',sun:'#fff080',foliage:'#2a4a2a'},
    musicWorld:5, levels:[{name:'5-1',map:generateLevel(5,100,18,{ground:'g',earth:'G',enemies:['s','s','k'],danger:'w'}),parTime:150,hint:'Acqua melmosa.'}] },
  { id:6,name:'Vetta del Ping',nameEn:'Ping Peak',nameEs:'Cima del Ping',
    palette:{sky:'#b8d8ff',skyTop:'#88b8e8',ground:'#a8b8c8',earth:'#688090',grassTop:'#d8e8f8',brick:'#c0c0d0',brickShadow:'#606080',crystal:'#22e0ff',cloud:'#fff',sun:'#fff080',foliage:'#506070'},
    musicWorld:6, levels:[{name:'6-1',map:generateLevel(6,110,18,{ground:'g',earth:'G',enemies:['x','s','k']}),parTime:150,hint:'Alta quota.'}] },
  { id:7,name:'Tundra del Frame',nameEn:'Frame Tundra',nameEs:'Tundra del Frame',
    palette:{sky:'#c8e0f0',skyTop:'#90b8d0',ground:'#d0e8f0',earth:'#88a0b0',grassTop:'#ffffff',brick:'#a0c8d8',brickShadow:'#406080',crystal:'#90e0ff',cloud:'#fff',sun:'#ffe080',foliage:'#7090a0'},
    musicWorld:7, levels:[{name:'7-1',map:generateLevel(7,110,18,{ground:'i',earth:'G',enemies:['s','x','k']}),parTime:160,hint:'Ghiaccio scivoloso!'}] },
  { id:8,name:'Inferno del Crash',nameEn:'Crash Inferno',nameEs:'Infierno del Crash',
    palette:{sky:'#3a1010',skyTop:'#1a0505',ground:'#5a2010',earth:'#3a1005',grassTop:'#a04020',brick:'#c06030',brickShadow:'#601800',crystal:'#ff8040',cloud:'#5a2010',sun:'#ff4020',foliage:'#5a2010'},
    musicWorld:8, levels:[{name:'8-1',map:generateLevel(8,110,18,{ground:'#',earth:'#',enemies:['x','k','s'],danger:'l'}),parTime:170,hint:'Lava: un tocco e morte!'}] },
  { id:9,name:'Notte Stellare',nameEn:'Starry Night',nameEs:'Noche Estrellada',
    palette:{sky:'#1a1a4a',skyTop:'#0a0a2a',ground:'#3a3a5a',earth:'#1a1a3a',grassTop:'#5a5a8a',brick:'#7060a0',brickShadow:'#302050',crystal:'#a0a0ff',cloud:'#3a3a6a',sun:'#fff0c0',foliage:'#3a3a5a'},
    musicWorld:9, levels:[{name:'9-1',map:generateLevel(9,110,18,{ground:'g',earth:'G',enemies:['k','s','x']}),parTime:170,hint:'Stelle e nemici.'}] },
  { id:10,name:'Castello del Re Ombra',nameEn:'Shadow King Castle',nameEs:'Castillo del Rey Sombra',
    palette:{sky:'#2a1a3a',skyTop:'#150a20',ground:'#5a4060',earth:'#3a2040',grassTop:'#7a5080',brick:'#a08040',brickShadow:'#503020',crystal:'#ff40a0',cloud:'#3a2a4a',sun:'#ff8040',foliage:'#3a2a4a'},
    musicWorld:10, levels:[{name:'10-1',map:generateLevel(10,120,18,{ground:'#',earth:'#',enemies:['x','k','s'],danger:'l'}),parTime:200,hint:'Il livello finale.'}] },
];

export function getWorld(id) { return WORLDS.find(w=>w.id===id)||WORLDS[0]; }
export function getLevel(worldId, levelIdx) {
  const w = getWorld(worldId);
  const lev = w.levels[levelIdx-1]||w.levels[0];
  return { world:w, level:lev, levelIdx };
}
export function levelCount(worldId) { return getWorld(worldId).levels.length; }
export function hasLevel(worldId, levelIdx) { const w=WORLDS.find(x=>x.id===worldId); return !!(w&&w.levels[levelIdx-1]); }
export function nextLevel(worldId, levelIdx) {
  if (hasLevel(worldId, levelIdx+1)) return {world:worldId, level:levelIdx+1};
  if (hasLevel(worldId+1,1)) return {world:worldId+1, level:1};
  return null;
}
