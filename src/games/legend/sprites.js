/**
 * Sprite system per Andryx Legend.
 *
 * Ogni sprite è una griglia ASCII dove ogni carattere è una chiave della
 * palette (vedi palette.js). '.' = pixel trasparente.
 *
 * I personaggi sono 16×16 (player, NPC, slime, scheletro) o 16×24 (boss),
 * disegnati a "vera" pixel art — testa, occhi, vestiti, armi visibili —
 * non cerchi astratti.
 *
 * Al primo uso, ogni sprite viene renderizzato a un canvas offscreen
 * (cache `_renderCache`) e da lì copiato sul main canvas via drawImage.
 * Questo è ~50× più veloce che disegnare singoli pixel ogni frame.
 */
import { PAL } from './palette.js';

/* ─── Helpers di costruzione sprite ─── */

/**
 * Crea uno sprite cache-able da una griglia ASCII.
 * Ritorna un oggetto opaco {grid, w, h, _cache}.
 */
function S(rows) {
  const w = rows[0].length;
  const h = rows.length;
  return { grid: rows, w, h, _cache: null };
}

/**
 * Riflette orizzontalmente una griglia (per le direzioni left/right).
 */
function flipH(rows) {
  return rows.map(r => r.split('').reverse().join(''));
}

/* ─── Player Andryx — 16×16, eroe in tunica verde con cappello ─── */

/* Idle DOWN (di fronte) — frame 0 */
const PLAYER_DOWN_0 = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggkkkkkgg.....',
  '..gkkhhhkk......',
  '..ekheekheee....',
  '..ekKekKkek.....',
  '..gkkkKkkkg.....',
  '...rkkkkkr......',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.b...',
  '.brRRRrRRRrbB...',
  'b.brRRrRRRb.B...',
  '...kkk.kkk......',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);
/* Walk DOWN — frame 1 (gambe avanti/indietro) */
const PLAYER_DOWN_1 = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggkkkkkgg.....',
  '..gkkhhhkk......',
  '..ekheekheee....',
  '..ekKekKkek.....',
  '..gkkkKkkkg.....',
  '...rkkkkkr......',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.....',
  '...rRRrRRRr.....',
  '...rrRRRrr......',
  '..bbB.kkk.......',
  '..BBB.kkbB......',
  '...B...BBB......',
]);

/* Idle UP (di spalle) */
const PLAYER_UP_0 = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggHHHHHgg.....',
  '..gHHHHHHHg.....',
  '..eHHHHHHHe.....',
  '..eHHHHHHHe.....',
  '..gHHHHHHHg.....',
  '...HHHHHHH......',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.....',
  '...rRRrRRr......',
  '...kkk.kkk......',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);
const PLAYER_UP_1 = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggHHHHHgg.....',
  '..gHHHHHHHg.....',
  '..eHHHHHHHe.....',
  '..eHHHHHHHe.....',
  '..gHHHHHHHg.....',
  '...HHHHHHH......',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.....',
  '...rRRrRRRr.....',
  '...rrRRRrr......',
  '..bbB.kkk.......',
  '..BBB.kkbB......',
  '...B...BBB......',
]);

/* Idle RIGHT (di lato) */
const PLAYER_RIGHT_0 = S([
  '.....ggggg......',
  '....gGGGGGg.....',
  '...gGggggGg.....',
  '...gkkkkkgg.....',
  '...gkhhhkkg.....',
  '..eHHkeekkg.....',
  '..eHHkkkkkg.....',
  '..gkkkkKkkg.....',
  '...rkkkkkr......',
  '...rRRRRRr......',
  '...rRRRrRr......',
  '...rRRRrRr......',
  '..brRRrrRrb.....',
  '...kkk.kkk......',
  '..bbB...BBB.....',
  '..BBB...BBB.....',
]);
const PLAYER_RIGHT_1 = S([
  '.....ggggg......',
  '....gGGGGGg.....',
  '...gGggggGg.....',
  '...gkkkkkgg.....',
  '...gkhhhkkg.....',
  '..eHHkeekkg.....',
  '..eHHkkkkkg.....',
  '..gkkkkKkkg.....',
  '...rkkkkkr......',
  '...rRRRRRr......',
  '...rRRRrRr......',
  '...rRRRrRr......',
  '...rRRrrRr......',
  '...kkk.kkk......',
  '....BB.kkb......',
  '....BB..BB......',
]);

const PLAYER_LEFT_0 = S(flipH(PLAYER_RIGHT_0.grid));
const PLAYER_LEFT_1 = S(flipH(PLAYER_RIGHT_1.grid));

/* Attack frames — spada estesa nella direzione */
/* DOWN attack — spada davanti */
const PLAYER_ATK_DOWN = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggkkkkkgg.....',
  '..gkkhhhkk......',
  '..ekheekheee....',
  '..ekKekKkek.....',
  '..gkkkKkkkg.....',
  '...rkkkkkr......',
  '..rRRRrRRRr.....',
  '...rRRrRRRr.....',
  '...rrRRRrr......',
  '...rkkkkkr......',
  '....kMWMk.......',
  '....kMWMk.......',
  '....kMWMk.......',
]);
/* UP attack — spada in alto */
const PLAYER_ATK_UP = S([
  '....kMWMk.......',
  '....kMWMk.......',
  '....kMWMk.......',
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGgggggGg.....',
  '..ggHHHHHgg.....',
  '..gHHHHHHHg.....',
  '..eHHHHHHHe.....',
  '..gHHHHHHHg.....',
  '...HHHHHHH......',
  '..rRRRrRRRr.....',
  '..rRRRrRRRr.....',
  '...kkk.kkk......',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);
/* RIGHT attack — spada a destra */
const PLAYER_ATK_RIGHT = S([
  '....ggggg.......',
  '...gGGGGGg......',
  '..gGggggGg......',
  '..gkkkkkgg......',
  '..gkhhhkkg......',
  '.eHHkeekkg......',
  '.eHHkkkkkg......',
  '..gkkkKkkg......',
  '...rkkkkr.kkkk..',
  '...rRRRRr.kMWM..',
  '...rRRRrR.kMWM..',
  '...rRRRrRr......',
  '..brRRrrRrb.....',
  '...kkk.kkk......',
  '..bbB...BBB.....',
  '..BBB...BBB.....',
]);
const PLAYER_ATK_LEFT = S(flipH(PLAYER_ATK_RIGHT.grid));

/* ─── NPC: Anziano del villaggio (saggio con barba bianca) ─── */
const NPC_ELDER = S([
  '....NNNNN.......',
  '...NWWWWWN......',
  '..NWWWWWWWN.....',
  '..NkkkkkkkN.....',
  '..NkeWWWek......',
  '..NkkWWWkkN.....',
  '..NkWWWWWkk.....',
  '..NWWWWWWWN.....',
  '..NWWWWWWWN.....',
  '..vVVVvVVVv.....',
  '..vVVVvVVVv.....',
  '..vVVVvVVVv.....',
  '..vVVVvVVVv.....',
  '..vWWvWWvWv.....',
  '..bb.....bb.....',
  '..BB.....BB.....',
]);

/* ─── NPC: Mercante (donna con foulard rosso, sorridente) ─── */
const NPC_MERCHANT = S([
  '....rrrrr.......',
  '...rRRRRRr......',
  '..rRrrrrrRr.....',
  '..rkkkkkkkr.....',
  '..rkhhhhhkr.....',
  '..ekheekhke.....',
  '..ekKkkKkek.....',
  '..rkkkpkkkr.....',
  '...kkkkkkk......',
  '..uUUUuUUUu.....',
  '..uUUUuUUUu.....',
  '..uUUUuUUUu.....',
  '..uUUUuUUUu.....',
  '..uUUUuUUUu.....',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);

/* ─── NPC: Bambino del villaggio ─── */
const NPC_CHILD = S([
  '................',
  '....yyyyy.......',
  '...yYYYYYy......',
  '..yYyyyyyYy.....',
  '..ykkkkkkk......',
  '..ekheekhee.....',
  '..ekKkkKkek.....',
  '..ykkkpkkky.....',
  '...kkkkkkk......',
  '..gGGGgGGGg.....',
  '..gGGGgGGGg.....',
  '...gGGgGGg......',
  '...gkkkkk.......',
  '...kkk.kkk......',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);

/* ─── NPC: Re Andryx (padre del villaggio, Twitch viola con corona) ─── */
const NPC_KING = S([
  '....yffyfy......',
  '...yfffffy......',
  '...vVVVVVv......',
  '..vVvvvvvVv.....',
  '..vkkkkkkk......',
  '..ekheekhee.....',
  '..ekKkhKkek.....',
  '..vkkkkkkkv.....',
  '...HHHHHHH......',
  '..vVVVvVVVv.....',
  '..vVyVvVyVv.....',
  '..vVVVvVVVv.....',
  '..vVVVvVVVv.....',
  '..vVVVvVVVv.....',
  '..bbB...bbB.....',
  '..BBB...BBB.....',
]);

/* ─── Nemici ─── */

/* Slime — verde gelatinoso */
const ENEMY_SLIME_0 = S([
  '................',
  '................',
  '....jjjjjj......',
  '...jllJJJjj.....',
  '..jllJJJJJjj....',
  '..jlJJlJlJJj....',
  '..jJJeJJeJJj....',
  '..jJJJJJJJJj....',
  '..jJJJJJJJJj....',
  '..jJJJlJJJJj....',
  '..jjJJJJJJjj....',
  '...jjjjjjjj.....',
  '....jJjJjJ......',
  '................',
  '................',
  '................',
]);
const ENEMY_SLIME_1 = S([
  '................',
  '................',
  '................',
  '....jjjjjj......',
  '...jllJJJjj.....',
  '..jllJJJJJjj....',
  '..jJJeJJeJJj....',
  '..jJJJJlJJJj....',
  '..jJJJJJJJJj....',
  '..jJJJlJJJJj....',
  '.jjJJJJJJJJjj...',
  '.jjjjjjjjjjjj...',
  '..jJjJjJjJjJ....',
  '................',
  '................',
  '................',
]);

/* Scheletro — guerriero osseo con spada */
const ENEMY_SKELETON_0 = S([
  '....WWWWW.......',
  '...WMMMMMW......',
  '..WMeMMMeMW.....',
  '..WMMMOMMMW.....',
  '..WMMOOOMMW.....',
  '...WMOOOMW......',
  '....WWWWW.......',
  '..MWMMMMMWMW....',
  '..M.MMMMM.MW....',
  '..M.MMMMM.MW....',
  '....MMMMM.MW....',
  '....MMMMM.M.....',
  '....M...M.......',
  '...MM...MM......',
  '...MMM.MMM......',
  '..MMMM.MMMM.....',
]);
const ENEMY_SKELETON_1 = S([
  '....WWWWW.......',
  '...WMMMMMW......',
  '..WMeMMMeMW.....',
  '..WMMMOMMMW.....',
  '..WMMOOOMMW.....',
  '...WMOOOMW......',
  '....WWWWW.......',
  '..M.MMMMM.M.....',
  '..MWMMMMMWMW....',
  '..MWMMMMMWMW....',
  '....MMMMM.MW....',
  '....MMMMM.M.....',
  '....M...M.......',
  '...MM...MM......',
  '..MMM...MMM.....',
  '..MM.....MM.....',
]);

/* Pipistrello — viola, ali aperte/chiuse */
const ENEMY_BAT_0 = S([
  '................',
  '................',
  '..v.........v...',
  '.vV.........Vv..',
  'vVVv.......vVVv.',
  'vVVVv.....vVVVv.',
  '.vVVVvHHHvVVVv..',
  '..vVVHeHeHVVv...',
  '...vHHKKKHHv....',
  '....HHHHHHH.....',
  '....HKKKKKH.....',
  '.....HHHHH......',
  '......HHH.......',
  '................',
  '................',
  '................',
]);
const ENEMY_BAT_1 = S([
  '................',
  '...v.......v....',
  '..vV.......Vv...',
  '.vVVv.....vVVv..',
  'vVVVVv...vVVVVv.',
  '.vVVVVvHvVVVVv..',
  '..vVVHeHeHVVv...',
  '...vHHKKKHHv....',
  '....HHHHHHH.....',
  '....HKKKKKH.....',
  '.....HHHHH......',
  '......HHH.......',
  '................',
  '................',
  '................',
  '................',
]);

/* Spettro/Mago Ombra — viola scuro, fluttuante */
const ENEMY_MAGE_0 = S([
  '....VVVVV.......',
  '...VVvvvVV......',
  '..VvvWWWvvV.....',
  '..VvWeWeWvV.....',
  '..VvWWWWWvV.....',
  '..VvvWWWvvV.....',
  '..VVVvvvVVV.....',
  '..VqQQqQQqV.....',
  '..VqQQqQQqV.....',
  '.VVVqQQQqVVV....',
  'VVVVVqqqVVVVV...',
  'VqQVVVQVVVQqV...',
  '.VqQQQQQQQqV....',
  '..VVQQQQQVV.....',
  '...VVVqVVV......',
  '....VVqVV.......',
]);

/* Mini-boss: Custode della Caverna (golem di pietra 24×24) */
const BOSS_GUARDIAN = S([
  '......OOOOOOOOOO........',
  '....OoooooooooooO.......',
  '...OooMMMMMMMMooO.......',
  '..OoMMyyMMMMyyMMoO......',
  '..OoMMyrMMMMryMMoO......',
  '..OoMMMMyyyyMMMMoO......',
  '..OoMMMMOOOOMMMMoO......',
  '..OoooMMMOOMMMooooO.....',
  '.OOoooMMMMMMMMooooOO....',
  'OoooMooMMMMMMMMooMoooO..',
  'OoooMMooMMMMMMooMMoooO..',
  'OoooMMMooMMMMooMMMoooO..',
  '.OoMMMMMooooooMMMMMOoO..',
  '..OoMMMMMooooMMMMMMoO...',
  '..OoMMooMMMMMMooMMoO....',
  '..OoMMooMMMMMMooMMoO....',
  '..OoooMMMMMMMMMMooo.....',
  '...OoOOMMMMMMMMOOoO.....',
  '...OoOOMMMMMMMMOOoO.....',
  '..OOoOOOMMMMMMOOOoOO....',
  '.OOoooooMMMMMMoooooOO...',
  '.OO....oOOOOOOoo....OO..',
  '.O.....OO....OOO.....O..',
  '......OOO....OOOO.......',
]);

/* Boss finale: Re Ombra (24×24, viola/nero, occhi rossi) */
const BOSS_SHADOW_KING = S([
  '......VVNNNVVNNNVV......',
  '.....VNNNvvNNNvvNNNV....',
  '....VNvvVVNNVVNNvvNV....',
  '....VNvVVqVqVqVqVvNV....',
  '...VNNVVVqQQQQqqVVNNV...',
  '...VNvVVVQQQrQQQVVvNV...',
  '...VNvVVQrrrrrrrQVvNV...',
  '...VNvQQQrrwwwrrQQQvNV..',
  '...VNVQQrrwReRwrrQQVNV..',
  '...VNVQQrrweeewrrQQVNV..',
  '...VNVQQrrwwhwwrrQQVNV..',
  '...VNvQQrrrhhhrrrQQvNV..',
  '...VNvQQQrrrrrrrQQQvNV..',
  '...VNNVQQQQrrrQQQQVNNV..',
  '...VNvVQQQQQQQQQQVvNV...',
  '....VNvVQQQqqqQQQVvNV...',
  '....VNvVVQqqqqqQVVvNV...',
  '....VNNVVQqqqqqQVVNNV...',
  '.....VNvVQqqqqqQVvNV....',
  '.....VNvVQqqqqqQVvNV....',
  '......VNvVqqqqqVvNV.....',
  '.......VNNvVVvNNV.......',
  '........VVNNNNVV........',
  '..........VVVV..........',
]);

/* ─── Items / Pickup ─── */

const ITEM_HEART = S([
  '..rR..rR........',
  '.rRRRrRRRr......',
  '.rRRrrRRRr......',
  '.rRRRrRRRr......',
  '.rRRRrRRRr......',
  '..rRRrRRr.......',
  '...rRrRr........',
  '....rrr.........',
  '.....r..........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

const ITEM_RUPEE = S([
  '................',
  '....gGGGGg......',
  '...gGGGgGg......',
  '..gGGGGGGgG.....',
  '.gGGwGGGGGGg....',
  '.gGwwgGGGGGg....',
  '.gGGgGGGGGGg....',
  '.gGGGGGGGGGg....',
  '.gGGGGGGGGGg....',
  '..gGGGGGGGg.....',
  '...gGGGGgg......',
  '....gGGgg.......',
  '.....gg.........',
  '................',
  '................',
  '................',
]);

const ITEM_KEY = S([
  '...yyy..........',
  '..yYfYy.........',
  '.yYf.fYy........',
  '.yYf.fYy........',
  '.yYf.fYy........',
  '..yYfYy.........',
  '...yYy..........',
  '....y...........',
  '....y...........',
  '....y...........',
  '....yyy.........',
  '....y...........',
  '....yyy.........',
  '....y...........',
  '................',
  '................',
]);

/* Chiave di casa di Andryx — più ornata, in oro/rame, con runa */
const ITEM_HOUSE_KEY = S([
  '....rRRr........',
  '...rYffYr.......',
  '..rYfWWfYr......',
  '..rYWeeWYr......',
  '.rYfWeKeWfYr....',
  '.rYfWeKeWfYr....',
  '..rYfWWfYr......',
  '...rYffYr.......',
  '....yYy.........',
  '....yYy.........',
  '....yYy.........',
  '....yYy.........',
  '....yYyyy.......',
  '....yYy.........',
  '....yYyy........',
  '....yYy.........',
]);


const ITEM_BOMB = S([
  '......yy........',
  '.......y........',
  '......y.........',
  '....NNNNNN......',
  '...NeOOOON......',
  '..NOOOOOOON.....',
  '..NOOOOOOON.....',
  '..NOOOWWOON.....',
  '..NOOWWOON......',
  '..NOOWOOON......',
  '..NOOOOOON......',
  '..NOOOOOON......',
  '...NOOOON.......',
  '....NNNN........',
  '................',
  '................',
]);

const ITEM_POTION = S([
  '....BBB.........',
  '....b.b.........',
  '....bWb.........',
  '....bWb.........',
  '...rRRRr........',
  '..rRRRRRr.......',
  '..rRwRRRr.......',
  '..rRRRRRr.......',
  '..rRRRRRr.......',
  '..rRRRRRr.......',
  '..rRRwRRr.......',
  '..rRRRRRr.......',
  '...rRRRr........',
  '....rrr.........',
  '................',
  '................',
]);

/* Cristallo — oggetto chiave della trama (3 colori: verde/blu/rosso) */
function CRYSTAL(coreCol, edgeCol) {
  return S([
    '................',
    '......W.........',
    '.....WqW........',
    '....W'+coreCol+coreCol+coreCol+'W.......',
    '...W'+coreCol+'W'+coreCol+'W'+coreCol+'W......',
    '..W'+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+'W.....',
    '..'+edgeCol+coreCol+coreCol+'W'+coreCol+'W'+coreCol+coreCol+edgeCol+'.....',
    '..'+edgeCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+edgeCol+'.....',
    '..'+edgeCol+coreCol+'W'+coreCol+coreCol+coreCol+'W'+coreCol+edgeCol+'.....',
    '..'+edgeCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+edgeCol+'.....',
    '...'+edgeCol+coreCol+coreCol+coreCol+coreCol+coreCol+coreCol+edgeCol+'......',
    '....'+edgeCol+coreCol+coreCol+coreCol+coreCol+edgeCol+'.......',
    '.....'+edgeCol+coreCol+coreCol+edgeCol+'........',
    '......'+edgeCol+edgeCol+'.........',
    '................',
    '................',
  ]);
}
const ITEM_CRYSTAL_GREEN = CRYSTAL('g', 'G');
const ITEM_CRYSTAL_BLUE  = CRYSTAL('u', 'U');
const ITEM_CRYSTAL_RED   = CRYSTAL('r', 'R');

/* Spada (oggetto pickup) */
const ITEM_SWORD = S([
  '.........WMW....',
  '........WMMMW...',
  '........MMMMM...',
  '........WMMMW...',
  '........WMMW....',
  '.......WMMW.....',
  '......WMMW......',
  '.....WMMW.......',
  '....WMMW........',
  '...WMMW.........',
  '..WMMW..........',
  '.WMMW...........',
  'yYYYYy..........',
  '.bBBb...........',
  '..bb............',
  '................',
]);

/* Scudo */
const ITEM_SHIELD = S([
  '...uUUUUUUu.....',
  '..uUuuuuuuUu....',
  '.uUuwwwwwwuUu...',
  '.uUuwUUUUuwUu...',
  '.uUuwUyUyUwUu...',
  '.uUuwUyyyUwUu...',
  '.uUuwUUUUUwUu...',
  '.uUuwwwwwwwUu...',
  '.uUuyyyyyyuUu...',
  '.uUuwwwwwwuUu...',
  '..uUuUUUUuUu....',
  '...uUUUUUUu.....',
  '....uUUUUu......',
  '.....uUUu.......',
  '......uu........',
  '................',
]);

/* Cuore container (HP +1 max) */
const ITEM_HEART_CONTAINER = S([
  '..rRr..rRr......',
  '.rRRRrrRRRr.....',
  '.rRWRrRWRRr.....',
  '.rRWWrRRRRr.....',
  '.rRRRrRRRRr.....',
  '.rRRRrRRRRr.....',
  '..rRRrRRRr......',
  '...rRrRRr.......',
  '....rrRr........',
  '.....rr.........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/* ─── Tile sprites — disegnate come 16×16, da tilare ─── */

/* Erba base (foresta/villaggio) */
/* Erba — texture a ciuffi sparsi con highlight, non solo rumore */
const TILE_GRASS = S([
  'JJJJJJJJJJJJJJJJ',
  'JjJJJjjJJJJJJjJJ',
  'JjlJJjJJJJJjjJJJ',
  'JjJJJJJJJjjlJJJJ',
  'JJJJJjJJJjJJJJjJ',
  'JJjjJjlJJJJJJjJJ',
  'JJjJJjJJJjJJJjlJ',
  'JJJJJJJJJjJJJjJJ',
  'JjJJJJjJJJJJJJJJ',
  'JjlJJjjJJjJJJJJJ',
  'JjJJJjJJJjlJJjJJ',
  'JJJJJJJJJjJJJjJJ',
  'JJjJJJjJJJJJJjlJ',
  'JJjlJjjJJJJjJJJJ',
  'JJjJJjJJJjjlJJJJ',
  'JJJJJJJJJJJJJJJJ',
]);

/* Erba con fiore — fiore centrale a 4 petali rossi + ciuffi ai lati */
const TILE_GRASS_FLOWER = S([
  'JJJJJJJJJJJJJJJJ',
  'JjJJJJJJJJJJJjJJ',
  'JjlJJJjJJJjJJjJJ',
  'JJJJJJJJJjjlJJJJ',
  'JJJJJrrJJJJJJJJJ',
  'JJjjJrWrJJJJJjJJ',
  'JJjJrWyWrJJJJjlJ',
  'JJJJrWyWrJjJJjJJ',
  'JJJJJrWrJJjlJJJJ',
  'JJJJJrrJJJJJJJJJ',
  'JjJJJJJJJfJJJJJJ',
  'JjlJjjJJfWfJjJJJ',
  'JJJJJjJJJfJJJjlJ',
  'JJJJJJJJJJJJJjJJ',
  'JJjJJjjlJJJJJJJJ',
  'JJJJJJJJJJJJJJJJ',
]);

/* Sentiero lastricato — pietre arrotondate con highlight + bordi scuri */
const TILE_PATH = S([
  'BcSScBcSScBcSScB',
  'cssScSscSScssScS',
  'cswSccswSccswScc',
  'cssScSssccsSscSS',
  'BcccBccSScBccSSB',
  'cscScSScssScScsB',
  'cwSScswScSswSScc',
  'cssScSScssScSScS',
  'BcSSccccBcSSccBc',
  'cscScssScSscScsS',
  'cwScssswScswSccs',
  'cSScssScssscSScS',
  'BcSSBcSSBcSSBcSS',
  'cscScScSscScScSc',
  'cssSccssScssSccs',
  'BcccBcSSccBcccBc',
]);

/* Albero — chioma piu` voluminosa con highlight definiti, ombra sotto */
const TILE_TREE = S([
  '....GGGGGG......',
  '...GgggggGG.....',
  '..GgglllggGG....',
  '.GgglllllggGG...',
  '.GggllWlllgggG..',
  'GgglWlllllgggGG.',
  'GgggllllllgggG..',
  'GgglWlWllgggggG.',
  '.GgglllllggGG...',
  '.GgggllllgggG...',
  '..GgggllggGG....',
  '...GggggGGG.....',
  '....bBcBb.......',
  '....bccBb.......',
  '....bBBBb.......',
  '...NNbbbNN......',
]);

/* Roccia/parete pietra */
const TILE_STONE = S([
  'OoOoOoOoOoOoOoOo',
  'oOoOoOoOoOoOoOoO',
  'OoOOOoOoOoOOOoOo',
  'oOoOoOoOoOoOoOoO',
  'OoOoOoOoOoOoOoOo',
  'oOoOoOOOOoOoOoOO',
  'OoOoOoOoOoOoOoOo',
  'oOoOoOoOoOoOoOoO',
  'OoOoOoOoOoOoOoOo',
  'oOoOOoOoOoOoOOoO',
  'OoOoOoOoOoOoOoOo',
  'oOoOoOoOOOoOoOoO',
  'OoOoOoOoOoOoOoOo',
  'oOoOoOoOoOoOoOoO',
  'OoOoOoOoOoOoOoOo',
  'oOoOoOoOoOoOoOoO',
]);

/* Acqua animata frame 0 */
const TILE_WATER_0 = S([
  'aAaAaAaAaAaAaAaA',
  'AaAaAaAaAaAaAaAa',
  'aAaAaiAaiAaAaAaA',
  'AaAaiiAaaaAaAaAa',
  'aAaAaAaAaAaAaAaA',
  'AaAaAaAaAaAaiAaA',
  'aAaAaiiaAaiAaAaA',
  'AaAaaaAaAaAaAaAa',
  'aAaAaAaAaAaAaAaA',
  'AaAaAaAaAaAaAaAa',
  'aAaAaiiAaAaAaAaA',
  'AaAaiiAaAaAaAaAa',
  'aAaAaAaAaAaAaAaA',
  'AaAaAaAaAaAiAaAa',
  'aAaAaAaAaAaiiAaA',
  'AaAaAaAaAaAaaaAa',
]);
const TILE_WATER_1 = S([
  'AaAaAaAaAaAaAaAa',
  'aAaAaAaAaAaAaAaA',
  'AaAaiiAaAaAaAaAa',
  'aAaiiAaaAaAaAaAa',
  'AaAaAaAaAaAaAaAa',
  'aAaAaAaAaAaiAaAa',
  'AaAaiiAaAaAaAaAa',
  'aAaaAaAaAaAaAaAa',
  'AaAaAaAaAaAaAaAa',
  'aAaAaAaAaAaAaAaA',
  'AaAaiAaAaAaAaAaA',
  'aAaiAAaAaAaAaAaA',
  'AaAaAaAaAaAaAaAa',
  'aAaAaAaAaAiAaAaA',
  'AaAaAaAaAaAiAaAa',
  'aAaAaAaAaAAAaAaA',
]);

/* Sabbia (deserto/spiaggia) */
const TILE_SAND = S([
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSwSsSsSwSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSsSsSsS',
  'SsSwsSsSsSsSsSsS',
  'sSsSsSsSsSwSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSwsSsSsSsS',
  'sSsSsSsSsSsSsSsS',
  'SsSsSwsSsSsSwSsS',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSwSsSsS',
  'SsSsSsSsSsSsSsSs',
]);

/* Pavimento dungeon (lastre di pietra) */
const TILE_FLOOR = S([
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oooooooooooooooo',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oOOOOOOOoOOOOOOO',
  'oooooooooooooooo',
]);

/* Muro dungeon */
const TILE_WALL = S([
  'NNNNNNNNNNNNNNNN',
  'NOOOOOOOOOOOOOON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOoOoOoOoOoOoOoN',
  'NoOoOoOoOoOoOoON',
  'NOOOOOOOOOOOOOON',
  'NNNNNNNNNNNNNNNN',
]);

/* Casa villaggio (parete con tetto) */
const TILE_HOUSE_ROOF = S([
  'rR............rR',
  'rRR..........RRr',
  'rRRR........RRRr',
  'rRRRR......RRRRr',
  'rRRRRR....RRRRRr',
  'rRRRRRR..RRRRRRr',
  'rRRRRRRRRRRRRRRr',
  'RRRRRRRRRRRRRRRR',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
]);

const TILE_HOUSE_DOOR = S([
  'sSsSsSsSsSsSsSsS',
  'SsSsSsSsSsSsSsSs',
  'sSsBBBBBBBBBSsSs',
  'sSBBbbbbbbbBBSsS',
  'SsBbbBbbbbBbbBsS',
  'sSBbbBbbbbBbbBSs',
  'SsBbbBbbbbBbbBsS',
  'sSBbbBbbbbBbbBSs',
  'SsBbbBbbbbBbbBsS',
  'sSBbbBbbbbBbbBSs',
  'SsBbbBbbbbBbbBsS',
  'sSBbbBbbyybbbBSs',
  'SsBbbBbbbbBbbBsS',
  'sSBbbBbbbbBbbBSs',
  'SsBBbbbbbbbbBBsS',
  'sSsBBBBBBBBBBSsS',
]);

/* Cespuglio (ostacolo distruttibile) */
const TILE_BUSH = S([
  '................',
  '....jJJJjJ......',
  '..jJjjJJjJjj....',
  '.jJjJJJjJJjJj...',
  '.jjJJJjJJJjJj...',
  '.jJJJjJJJJJjj...',
  '.jjJJjJJJjJJj...',
  '..JjJJJJjJJJ....',
  '..jJjJjJJjJj....',
  '...jjJJjJJj.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/* Vaso/giara (può contenere rupie/cuori) */
const TILE_POT = S([
  '................',
  '....BBBBBB......',
  '...bbbbbbbb.....',
  '...bcccccccb....',
  '...bccsScccb....',
  '...bcssScccb....',
  '..bccscscccc....',
  '..bccccccccb....',
  '..bccccccccb....',
  '..bccccscccb....',
  '..bccsscccccb...',
  '..bccccccccb....',
  '...bccccccb.....',
  '...bbBBBBbb.....',
  '....BBBBBB......',
  '................',
]);

/* Blocco spingibile (puzzle) */
const TILE_BLOCK = S([
  'OOOOOOOOOOOOOOOO',
  'OoooooooooooooOO',
  'OoMMMMMMMMMMMMoO',
  'OoMOOOOOOOOOOMoO',
  'OoMOoooooooOOMoO',
  'OoMOoMMMMooOOMoO',
  'OoMOoMooMooOOMoO',
  'OoMOoMooMooOOMoO',
  'OoMOoMooMooOOMoO',
  'OoMOoMMMMooOOMoO',
  'OoMOooooooooMoO.'.slice(0,16),
  'OoMOOOOOOOOOOMoO',
  'OoMMMMMMMMMMMMoO',
  'OOOOOOOOOOOOOOOO',
  'OooooooooooooooO',
  'OOOOOOOOOOOOOOOO',
]);

/* Piastra a pressione (puzzle) */
const TILE_PLATE_UP = S([
  '................',
  '................',
  '................',
  '...yyyyyyyyyy...',
  '..yYYYYYYYYYYy..',
  '..yYyyyyyyyyYy..',
  '..yYyfffffffYy..',
  '..yYyfYYYYYyYy..',
  '..yYyfYYYYYyYy..',
  '..yYyfYYYYYyYy..',
  '..yYyfffffffYy..',
  '..yYyyyyyyyyYy..',
  '..yYYYYYYYYYYy..',
  '...yyyyyyyyyy...',
  '................',
  '................',
]);
const TILE_PLATE_DOWN = S([
  '................',
  '................',
  '................',
  '................',
  '...yyyyyyyyyy...',
  '..yYYYYYYYYYYy..',
  '..yYyyyyyyyyYy..',
  '..yYyfYYYYYyYy..',
  '..yYyyyyyyyyYy..',
  '..yYYYYYYYYYYy..',
  '...yyyyyyyyyy...',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/* Porta chiusa */
const TILE_DOOR_CLOSED = S([
  'OOOOOOOOOOOOOOOO',
  'OBBBBBBBBBBBBBBO',
  'OBbbbbbbbbbbbbBO',
  'OBbBBBBBBBBBBbBO',
  'OBbBcccccccccBBO',
  'OBbBcyyyyyyycBBO',
  'OBbBcyOOOOOycBBO',
  'OBbBcyOyyOyycBBO',
  'OBbBcyOyyOyycBBO',
  'OBbBcyOOOOOycBBO',
  'OBbBcyyyyyyycBBO',
  'OBbBcccccccccBBO',
  'OBbBBBBBBBBBBbBO',
  'OBbbbbbbbbbbbbBO',
  'OBBBBBBBBBBBBBBO',
  'OOOOOOOOOOOOOOOO',
]);

/* Porta aperta (passaggio nero) */
const TILE_DOOR_OPEN = S([
  'OOOOOOOOOOOOOOOO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'ONNNNNNNNNNNNNNO',
  'OOOOOOOOOOOOOOOO',
]);

/* Torcia accesa (per puzzle candele) */
const TILE_TORCH_ON = S([
  '......yWy.......',
  '.....yfWfy......',
  '.....yfffy......',
  '......yfy.......',
  '.......y........',
  '......yYy.......',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......OOO.......',
  '.....OOOOO......',
  '................',
]);

/* Torcia spenta */
const TILE_TORCH_OFF = S([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......BoB.......',
  '......BBB.......',
  '......OOO.......',
  '.....OOOOO......',
  '................',
]);

/* Portale (passaggio fra zone) — magico viola */
const TILE_PORTAL = S([
  '................',
  '....mvvVvvm.....',
  '...mvVVVVVvm....',
  '..mvVqqqqqVvm...',
  '..mvqQQQQQqVm...',
  '.mVqQVVVVVQqVm..',
  '.mVqQVNNNVQqVm..',
  '.mVqQVNNNVQqVm..',
  '.mVqQVNNNVQqVm..',
  '.mVqQVVVVVQqVm..',
  '..mvqQQQQQqVm...',
  '..mvVqqqqqVvm...',
  '...mvVVVVVvm....',
  '....mvvVvvm.....',
  '................',
  '................',
]);

/* ─── Tile speciali aggiuntivi ─── */

/* Cespuglio bruciato/distrutto — terra esposta */
const TILE_DIRT = S([
  'BBBbBbBbBbBbBbBb',
  'bBbBbBbBbBbBbBbB',
  'BbBBbBbBbBbBbBbB',
  'bBbBbBbBbBbBbBbB',
  'BbBbBbBBbBbBbBbB',
  'bBbBbBbBbBbBBbBb',
  'BbBbBbBbBbBbBbBb',
  'bBbBbBbBbBBbBbBb',
  'BbBbBbBbBbBbBbBB',
  'bBbBbBbBbBbBbBbB',
  'BbBbBBbBbBbBbBbB',
  'bBbBbBbBbBbBbBbB',
  'BbBbBbBbBbBbBbBb',
  'bBbBbBbBbBBbBbBb',
  'BbBbBbBbBbBbBbBB',
  'bBbBbBbBbBbBbBbB',
]);

/* Lava (per dungeon castello) */
const TILE_LAVA = S([
  'rRrRrRrRrRrRrRrR',
  'RrRrRrRrRrRrRrRr',
  'rRyRrRrRyRrRrRrR',
  'RryyRrRrRyRrRrRr',
  'rRyRrRrRyRrRrRrR',
  'RrRrRyyRrRrRrRrR',
  'rRrRyyRrRrRrRrRr',
  'RrRrRrRrRrRryRrR',
  'rRrRrRrRrRryyRrR',
  'RrRrRrRrRrRyRrRr',
  'rRrRrRrRrRrRrRrR',
  'RrRrRryRrRrRrRrR',
  'rRrRryyRrRrRrRrR',
  'RrRrRyRrRrRrRryR',
  'rRrRrRrRrRrRryyR',
  'RrRrRrRrRrRrRyRr',
]);

/* ─── Case "vere" — sistema 3 wide × 2 tall (3 colonne, 2 righe) ───
   Riga 0: 1 2 3 = tetto pieno con tegole rosse
   Riga 1: 7 8 9 = muro con finestra centrale (oppure 7 0 9 con porta)
   Le pareti sono solide; la porta '0' diventa 'A' (passabile) quando aperta. */

/* Tetto SX — bordo diagonale + tegole, cornicione marrone */
const TILE_ROOF_TL = S([
  '..........RRRRRR',
  '........RRRrrrRR',
  '......RRRrrrRRrr',
  '....RRRrrrRRrrRR',
  '..RRRrrrRRrrRRrr',
  'RRRrrrRRrrRRrrRR',
  'RrrrrRrrrrrrrrrr',
  'rRrrRRrrRRrrRRrr',
  'rRrrrRrrrrrrrrrr',
  'RrrRRrrRRrrRRrrR',
  'rrrrRrrrrrrrrrrR',
  'RrRRrrRRrrRRrrRR',
  'rrrRrrrrrrrrrrrr',
  'BBBBBBBBBBBBBBBB',
  'cccccccccccccccc',
  'BBBBBBBBBBBBBBBB',
]);
/* Tetto centro — file di tegole con malta scura tra le file e divisori */
const TILE_ROOF_TM = S([
  'RRRRRRRRRRRRRRRR',
  'RrrrRrrrRrrrRrrr',
  'rRRrRRrRRrRRrRRr',
  'rrrrrrrrrrrrrrrr',
  'RRRRRRRRRRRRRRRR',
  'RrrrRrrrRrrrRrrR',
  'rRRrRRrRRrRRrRRR',
  'rrrrrrrrrrrrrrrR',
  'RRRRRRRRRRRRRRRR',
  'rRrrRrrrRrrrRrrr',
  'RRRrRRrRRrRRrRRr',
  'rrrrrrrrrrrrrrrr',
  'RRRRRRRRRRRRRRRR',
  'BBBBBBBBBBBBBBBB',
  'cccccccccccccccc',
  'BBBBBBBBBBBBBBBB',
]);
/* Tetto DX — diagonale opposta */
const TILE_ROOF_TR = S([
  'RRRRRR..........',
  'RRrrrRRR........',
  'rrRRrrrRRR......',
  'RRrrRRrrrRRR....',
  'rrRRrrRRrrrRRR..',
  'RRrrRRrrRRrrrRRR',
  'rrrrrrrrrrrrrrrr',
  'rRRrRRrRRrRRrRRr',
  'rrrrrrrrrrrrrrrr',
  'RrrRRrrRRrrRRrrR',
  'rrrrRrrrrrrrrrrR',
  'RrRRrrRRrrRRrrRR',
  'rrrRrrrrrrrrrrrr',
  'BBBBBBBBBBBBBBBB',
  'cccccccccccccccc',
  'BBBBBBBBBBBBBBBB',
]);

/* Muro casa SX — angolo + mattoni in pietra con malta scura */
const TILE_HWALL_L = S([
  'BBBBBBBBBBBBBBBB',
  'BcsssssssssssssB',
  'BcsBBssBBssBBssB',
  'BcsBBssBBssBBssB',
  'BcsssssssssssssB',
  'BcssBBssBBssBBsB',
  'BcssBBssBBssBBsB',
  'BcsssssssssssssB',
  'BcsBBssBBssBBssB',
  'BcsBBssBBssBBssB',
  'BcsssssssssssssB',
  'BcssBBssBBssBBsB',
  'BcssBBssBBssBBsB',
  'BcsssssssssssssB',
  'BcsBBssBBssBBssB',
  'OOOOOOOOOOOOOOOO',
]);
/* Muro casa centro — finestra ad arco con cornice e croce */
const TILE_HWINDOW = S([
  'BBBBBBBBBBBBBBBB',
  'ssssssssssssssss',
  'sBBssBBssBBssBBs',
  'ssssBBBBBBssssss',
  'sssBcUUUUcBsssss',
  'ssBcuddddduBssss',
  'ssBuddWWdduBssss',
  'ssBuddWWdduBssss',
  'ssBuddddddduBsss',
  'ssBcudddducBssss',
  'sssBcUUUUcBsssss',
  'ssssBBBBBBssssss',
  'sssssBccccBsssss',
  'sBBssBBssBBssBBs',
  'ssssssssssssssss',
  'OOOOOOOOOOOOOOOO',
]);
/* Muro casa DX — angolo + mattoni speculari */
const TILE_HWALL_R = S([
  'BBBBBBBBBBBBBBBB',
  'BsssssssssssssBB',
  'BssBBssBBssBBcBB',
  'BssBBssBBssBBcBB',
  'BsssssssssssssBB',
  'BsBBssBBssBBsscB',
  'BsBBssBBssBBsscB',
  'BsssssssssssssBB',
  'BssBBssBBssBBcBB',
  'BssBBssBBssBBcBB',
  'BsssssssssssssBB',
  'BsBBssBBssBBsscB',
  'BsBBssBBssBBsscB',
  'BsssssssssssssBB',
  'BssBBssBBssBBcBB',
  'OOOOOOOOOOOOOOOO',
]);

/* Porta in legno chiusa — assi verticali, ferri/pomello in oro */
const TILE_HDOOR = S([
  'BBBBBBBBBBBBBBBB',
  'BsssssssssssssBB',
  'BsBBBBBBBBBBBssB',
  'BsBcbcbcbcbcBssB',
  'BsBcbcbcbcbcBssB',
  'BsBYYbcbcbYYBssB',
  'BsBcbcbcbcbcBssB',
  'BsBcbcbcbcbcBssB',
  'BsBcbcbcyybcBssB',
  'BsBcbcbcyybcBssB',
  'BsBcbcbcbcbcBssB',
  'BsBYYbcbcbYYBssB',
  'BsBcbcbcbcbcBssB',
  'BsBBBBBBBBBBBssB',
  'BsssssssssssssBB',
  'OOOOOOOOOOOOOOOO',
]);
/* Porta aperta — interno buio con accenni di legno */
const TILE_HDOOR_OPEN = S([
  'BBBBBBBBBBBBBBBB',
  'BsssssssssssssBB',
  'BsBBBBBBBBBBBssB',
  'BsBNNNNNNNNNBssB',
  'BsBNeeeeeeeNBsB.',
  'BsBNeNNNNNeNBsB.',
  'BsBNeNyyNNeNBsB.',
  'BsBNeNNNNNeNBsB.',
  'BsBNeNNNNNeNBsB.',
  'BsBNeNNNNNeNBsB.',
  'BsBNeNNNNNeNBsB.',
  'BsBNeeeeeeeNBsB.',
  'BsBNNNNNNNNNBssB',
  'BsBBBBBBBBBBBssB',
  'BsssssssssssssBB',
  'OOOOOOOOOOOOOOOO',
]);

/* Vaso speciale (luccica oro): contiene la chiave di casa di Andryx */
const TILE_POT_SPECIAL = S([
  '................',
  '....yyyyyy......',
  '...yyyyyyyy.....',
  '...ycccccccy....',
  '...yccsScccy....',
  '...ycssScccy....',
  '..yccscscccy....',
  '..yccccccccy....',
  '..yccccyccccy...',
  '..yccccyycccy...',
  '..yccsscccccy...',
  '..yccccccccyy...',
  '...yccccccyy....',
  '...yyYYYYyy.....',
  '....yyYYyy......',
  '................',
]);

/* Fontana centrale del villaggio — bordo pietra, acqua azzurra, getto */
const TILE_FOUNTAIN = S([
  '....OOOOOOOO....',
  '...OoooooooooO..',
  '..OoaaiAaaaaaoO.',
  '..OaiAAAAAAAaaO.',
  '..OaAAdddddAAaO.',
  '..OaAddWdWdAAaO.',
  '..OaAdddddddAaO.',
  '..OaAddudddddaO.',
  '..OaAdduudddAaO.',
  '..OaAddddddAAaO.',
  '..OaiAAAAAAAaaO.',
  '..OoaaaaaaaaaoO.',
  '...OoooooooooO..',
  '....OOOOOOOO....',
  '....OOOOOOOO....',
  '................',
]);



/** Disegna uno sprite (cached) sul context al pixel (x, y). */
export function drawSprite(ctx, sprite, x, y) {
  if (!sprite._cache) {
    sprite._cache = renderSpriteToCanvas(sprite);
  }
  ctx.drawImage(sprite._cache, Math.round(x), Math.round(y));
}

/** Disegna lo sprite scalato (utile per HUD e cose ingrandite). */
export function drawSpriteScaled(ctx, sprite, x, y, w, h) {
  if (!sprite._cache) {
    sprite._cache = renderSpriteToCanvas(sprite);
  }
  ctx.drawImage(sprite._cache, Math.round(x), Math.round(y), w, h);
}

/** Render uno sprite a un canvas offscreen. */
function renderSpriteToCanvas(sprite) {
  const c = document.createElement('canvas');
  c.width = sprite.w;
  c.height = sprite.h;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (let y = 0; y < sprite.h; y++) {
    const row = sprite.grid[y];
    for (let x = 0; x < sprite.w; x++) {
      const ch = row[x];
      const col = PAL[ch];
      if (!col || col === 'transparent') continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Pre-render di tutti gli sprite (chiamato all'init per evitare scatti). */
export function preloadSprites() {
  for (const s of Object.values(SPRITES)) {
    if (s && s.grid && !s._cache) s._cache = renderSpriteToCanvas(s);
  }
}

/* ─── Esport: tutti gli sprite indicizzati ─── */
export const SPRITES = {
  /* Player */
  PLAYER_DOWN_0, PLAYER_DOWN_1,
  PLAYER_UP_0, PLAYER_UP_1,
  PLAYER_LEFT_0, PLAYER_LEFT_1,
  PLAYER_RIGHT_0, PLAYER_RIGHT_1,
  PLAYER_ATK_DOWN, PLAYER_ATK_UP,
  PLAYER_ATK_LEFT, PLAYER_ATK_RIGHT,

  /* NPCs */
  NPC_ELDER, NPC_MERCHANT, NPC_CHILD, NPC_KING,

  /* Enemies */
  ENEMY_SLIME_0, ENEMY_SLIME_1,
  ENEMY_SKELETON_0, ENEMY_SKELETON_1,
  ENEMY_BAT_0, ENEMY_BAT_1,
  ENEMY_MAGE_0,

  /* Bosses */
  BOSS_GUARDIAN, BOSS_SHADOW_KING,

  /* Items */
  ITEM_HEART, ITEM_RUPEE, ITEM_KEY, ITEM_HOUSE_KEY, ITEM_BOMB, ITEM_POTION,
  ITEM_CRYSTAL_GREEN, ITEM_CRYSTAL_BLUE, ITEM_CRYSTAL_RED,
  ITEM_SWORD, ITEM_SHIELD, ITEM_HEART_CONTAINER,

  /* Tiles */
  TILE_GRASS, TILE_GRASS_FLOWER, TILE_PATH, TILE_TREE, TILE_STONE,
  TILE_WATER_0, TILE_WATER_1, TILE_SAND, TILE_FLOOR, TILE_WALL,
  TILE_HOUSE_ROOF, TILE_HOUSE_DOOR, TILE_BUSH, TILE_POT, TILE_BLOCK,
  TILE_PLATE_UP, TILE_PLATE_DOWN, TILE_DOOR_CLOSED, TILE_DOOR_OPEN,
  TILE_TORCH_ON, TILE_TORCH_OFF, TILE_PORTAL, TILE_DIRT, TILE_LAVA,
  /* Case multi-tile + decorazioni villaggio (3 wide × 2 tall) */
  TILE_ROOF_TL, TILE_ROOF_TM, TILE_ROOF_TR,
  TILE_HWALL_L, TILE_HWINDOW, TILE_HWALL_R,
  TILE_HDOOR, TILE_HDOOR_OPEN,
  TILE_POT_SPECIAL, TILE_FOUNTAIN,
};

/* Helper: ritorna lo sprite del player per direzione + frame anim/attack */
export function getPlayerSprite(dir, frame, attacking) {
  if (attacking) {
    if (dir === 'up') return PLAYER_ATK_UP;
    if (dir === 'down') return PLAYER_ATK_DOWN;
    if (dir === 'left') return PLAYER_ATK_LEFT;
    return PLAYER_ATK_RIGHT;
  }
  const f = frame ? '1' : '0';
  if (dir === 'up') return f === '0' ? PLAYER_UP_0 : PLAYER_UP_1;
  if (dir === 'down') return f === '0' ? PLAYER_DOWN_0 : PLAYER_DOWN_1;
  if (dir === 'left') return f === '0' ? PLAYER_LEFT_0 : PLAYER_LEFT_1;
  return f === '0' ? PLAYER_RIGHT_0 : PLAYER_RIGHT_1;
}
