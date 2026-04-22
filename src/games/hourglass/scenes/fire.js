/**
 * Andryx Hourglass — TEMPIO DEL FUOCO.
 *
 * Mini-dungeon classico Zelda 2D:
 *   – Stanza 1: 3 ChuChu + scrigno con BOOMERANG.
 *   – Stanza 2: pavimento di lava con piattaforme; usa boomerang per
 *     attivare l'interruttore lontano e aprire la porta.
 *   – Stanza 3: BOSS — Chuchu Re Gigante. 6 colpi di spada per ucciderlo.
 *   – Drop: chiave finale che permette di tornare al mare con il boomerang.
 *
 * Mappa unica 480×480 con 3 zone delimitate da muri (porte chiuse fra di loro).
 */
import { C } from '../palette.js';
import { drawSprite } from '../sprites.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../render.js';
import { addRupees, damage } from '../state.js';

const TILE = 32;
const COLS = 15;
const ROWS = 15;
const PLAYER_SPEED = 1.4;
const PLAYER_R = 7;
const ATTACK_RANGE = 18;
const ATTACK_FRAMES = 14;
const BOOMERANG_SPEED = 4;
const BOOMERANG_RANGE = 180;

/* Mappa:
   '#' muro   '.' floor   'L' lava   'D' porta (passabile dopo trigger)
   '@' player spawn   'C' chuchu   'B' boss   'X' switch boomerang
   'T' chest (boomerang)   'd' stair (uscita)
*/
const MAP = [
  '###############',
  '#@.............#'.slice(0,15),
  '#.............#',
  '#....C........#',
  '#.............#',
  '#.....C....T..#',
  '#.............#',
  '#....C........#',
  '#######D#######',
  '#LLLLLLLLLLLLL#',
  '#LL.........LL#',
  '#L....LLL....X#',
  '#LL.........LL#',
  '#######D#######'.slice(0,15),
  '#......B.....d#',
];

export function createFireScene(state) {
  state.flags.visited_fire = true;
  const map = MAP.map(r => r.padEnd(COLS, '#').slice(0, COLS).split(''));
  /* Sanity */
  while (map.length < ROWS) map.push('###############'.split(''));

  const player = { x: 0, y: 0, dir: 'down', iframes: 0, attack: null };
  const enemies = [];
  let chest = null;       /* { x, y, opened } */
  let boss = null;        /* { x, y, hp, maxHp, vx, vy, iframes, phase } */
  let bswitch = null;     /* { x, y, on } */
  let stair = null;
  let bDoorOpen = false;  /* porta verso boss */
  let cDoorOpen = false;  /* porta tra stanza 1 e 2 (sempre aperta, decorativa) */

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = map[y][x];
      const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
      if (ch === '@') { player.x = px; player.y = py; map[y][x] = '.'; }
      else if (ch === 'C') {
        enemies.push({ kind: 'chuchu', x: px, y: py, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: Math.random() < 0.5 ? 1 : -1 });
        map[y][x] = '.';
      } else if (ch === 'T') {
        chest = { x: px, y: py, opened: false };
        map[y][x] = '.';
      } else if (ch === 'X') {
        bswitch = { x: px, y: py, on: false };
        map[y][x] = '.';
      } else if (ch === 'B') {
        boss = { x: px, y: py, hp: 6, maxHp: 6, vx: 0, vy: 0, iframes: 0, phase: 'idle', cooldown: 0 };
        map[y][x] = '.';
      } else if (ch === 'd') {
        stair = { x: px, y: py };
        /* tile resta 'd' per render */
      }
    }
  }
  cDoorOpen = true;  /* porta nord aperta */

  const boomerang = { active: false, x: 0, y: 0, vx: 0, vy: 0, dist: 0, returning: false };
  const scene = { id: 'fire', dialog: null, _toast: null };

  playMusic('dungeon');

  const isWall = (x, y) => {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    const t = map[cy][cx];
    if (t === '#') return true;
    if (t === 'D') {
      /* Porte: la prima (riga 8) sempre aperta, la seconda (riga 13) aperta se boss morto */
      if (cy === 8) return !cDoorOpen;
      if (cy === 13) return !bDoorOpen;
    }
    return false;
  };
  const isLava = (x, y) => {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
    return map[cy][cx] === 'L';
  };

  function tryMove(p, dx, dy) {
    const r = PLAYER_R;
    const nx = p.x + dx;
    if (!isWall(nx - r, p.y - r) && !isWall(nx + r, p.y - r) &&
        !isWall(nx - r, p.y + r) && !isWall(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isWall(p.x - r, ny - r) && !isWall(p.x + r, ny - r) &&
        !isWall(p.x - r, ny + r) && !isWall(p.x + r, ny + r)) p.y = ny;
  }

  function hurtPlayer(amount) {
    if (player.iframes > 0) return;
    if (damage(state, amount)) {
      state.flags.gameover = true;
      SFX.gameover();
    } else {
      SFX.hit();
      player.iframes = 50;
    }
  }

  Object.assign(scene, {
    update(input, _state, frame) {
      /* Movimento player */
      const { dx, dy } = input.move();
      if (dx || dy) {
        tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else                              player.dir = dy > 0 ? 'down' : 'up';
      }

      /* Lava: danno continuo se ci stai sopra (ma puoi attraversarla brevemente) */
      if (isLava(player.x, player.y) && player.iframes === 0) {
        hurtPlayer(1);
        /* Knock-back verso ultima posizione safe */
        player.x -= dx * 6; player.y -= dy * 6;
      }

      /* Pickup chest */
      if (chest && !chest.opened) {
        const ddx = player.x - chest.x, ddy = player.y - chest.y;
        if (ddx * ddx + ddy * ddy < 16 * 16) {
          chest.opened = true;
          state.items.boomerang = true;
          scene._toast = t('toast.got_boomerang');
          SFX.pickup();
        }
      }

      /* Boomerang lancio */
      if (input.isSecondary() && state.items.boomerang && !boomerang.active) {
        const dirVec = player.dir === 'right' ? [1, 0]
                     : player.dir === 'left'  ? [-1, 0]
                     : player.dir === 'down'  ? [0, 1] : [0, -1];
        boomerang.active = true;
        boomerang.x = player.x;
        boomerang.y = player.y;
        boomerang.vx = dirVec[0] * BOOMERANG_SPEED;
        boomerang.vy = dirVec[1] * BOOMERANG_SPEED;
        boomerang.dist = 0;
        boomerang.returning = false;
        SFX.boomerang();
      }

      /* Boomerang update */
      if (boomerang.active) {
        boomerang.x += boomerang.vx;
        boomerang.y += boomerang.vy;
        boomerang.dist += BOOMERANG_SPEED;
        /* Hit muro o lava */
        if (isWall(boomerang.x, boomerang.y) && !boomerang.returning) {
          boomerang.returning = true;
        }
        /* Hit switch */
        if (bswitch && !bswitch.on) {
          const sdx = boomerang.x - bswitch.x, sdy = boomerang.y - bswitch.y;
          if (sdx * sdx + sdy * sdy < 14 * 14) {
            bswitch.on = true;
            bDoorOpen = true;
            scene._toast = '✓ Interruttore attivato — porta sud aperta';
            SFX.door();
          }
        }
        /* Hit nemici */
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const edx = boomerang.x - e.x, edy = boomerang.y - e.y;
          if (edx * edx + edy * edy < 14 * 14) {
            e.hp = 0;
            state.kills++;
            addRupees(state, 5);
            SFX.enemy_hit();
          }
        }
        /* Range raggiunto → ritorno */
        if (boomerang.dist > BOOMERANG_RANGE && !boomerang.returning) {
          boomerang.returning = true;
        }
        if (boomerang.returning) {
          const rdx = player.x - boomerang.x, rdy = player.y - boomerang.y;
          const m = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          boomerang.vx = (rdx / m) * BOOMERANG_SPEED;
          boomerang.vy = (rdy / m) * BOOMERANG_SPEED;
          if (m < 12) boomerang.active = false;
        }
      }

      /* Attacco spada */
      if (input.isAction() && state.items.sword && !player.attack) {
        player.attack = { frame: 0, dir: player.dir };
        SFX.sword();
      }
      if (player.attack) {
        player.attack.frame++;
        if ([4, 8].includes(player.attack.frame)) {
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const adx = e.x - player.x, ady = e.y - player.y;
            const dist = Math.sqrt(adx * adx + ady * ady);
            const dir = player.attack.dir;
            const inFront =
              (dir === 'right' && adx > -4) || (dir === 'left' && adx < 4) ||
              (dir === 'down'  && ady > -4) || (dir === 'up'   && ady < 4);
            if (dist < ATTACK_RANGE + 6 && inFront) {
              e.hp--;
              e.iframes = 18;
              e.vx = (adx / (dist || 1)) * 4;
              e.vy = (ady / (dist || 1)) * 4;
              SFX.enemy_hit();
              if (e.hp <= 0) {
                state.kills++;
                addRupees(state, 5);
              }
            }
          }
          /* Boss hit */
          if (boss && boss.hp > 0 && boss.iframes === 0) {
            const bdx = boss.x - player.x, bdy = boss.y - player.y;
            const dist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (dist < ATTACK_RANGE + 14) {
              boss.hp--;
              boss.iframes = 28;
              boss.vx = (bdx / (dist || 1)) * 5;
              boss.vy = (bdy / (dist || 1)) * 5;
              SFX.enemy_hit();
              if (boss.hp <= 0) {
                state.kills++;
                state.score += 1000;
                state.flags.defeated_fire_boss = true;
                addRupees(state, 50);
                scene._toast = '⚔ BOSS sconfitto! +50 rupie';
                SFX.victory();
              }
            }
          }
        }
        if (player.attack.frame >= ATTACK_FRAMES) player.attack = null;
      }

      /* Player iframes */
      if (player.iframes > 0) player.iframes--;

      /* Update ChuChu */
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (e.iframes > 0) e.iframes--;
        e.x += e.vx; e.y += e.vy;
        e.vx *= 0.85; e.vy *= 0.85;
        if (Math.random() < 0.02) e.dir = -e.dir;
        const sx = e.x + e.dir * 0.4;
        if (!isWall(sx - 8, e.y)) e.x = sx; else e.dir = -e.dir;
        const cdx = player.x - e.x, cdy = player.y - e.y;
        if (cdx * cdx + cdy * cdy < 14 * 14) hurtPlayer(1);
      }

      /* Update boss */
      if (boss && boss.hp > 0) {
        if (boss.iframes > 0) boss.iframes--;
        boss.x += boss.vx; boss.y += boss.vy;
        boss.vx *= 0.85; boss.vy *= 0.85;
        boss.cooldown--;
        if (boss.cooldown <= 0 && boss.iframes === 0) {
          /* Charge towards player ogni 60-90 frame */
          const bdx = player.x - boss.x, bdy = player.y - boss.y;
          const m = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
          boss.vx = (bdx / m) * 1.6;
          boss.vy = (bdy / m) * 1.6;
          boss.cooldown = 90;
        }
        const cdx = player.x - boss.x, cdy = player.y - boss.y;
        if (cdx * cdx + cdy * cdy < 18 * 18) hurtPlayer(2);
      }

      /* Stair: esce dal dungeon (torna al mare) */
      if (stair) {
        const sdx = player.x - stair.x, sdy = player.y - stair.y;
        if (sdx * sdx + sdy * sdy < 14 * 14 && state.flags.defeated_fire_boss) {
          state.nextSceneId = 'sea';
          SFX.door();
        }
      }
    },

    render(renderer) {
      const c = renderer.ctx;
      c.fillStyle = '#2a1810';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);

      /* Tile */
      const lavaPulse = 0.7 + Math.sin(Date.now() / 200) * 0.2;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const ch = map[y][x];
          const px = x * TILE, py = y * TILE;
          if (ch === '#') {
            c.fillStyle = '#1a0808';
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = '#5a2010';
            c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            c.fillStyle = 'rgba(255,120,40,0.2)';
            c.fillRect(px + 4, py + 4, TILE - 8, 2);
          } else if (ch === 'L') {
            c.fillStyle = `rgba(${Math.floor(220*lavaPulse)},${Math.floor(80*lavaPulse)},20,1)`;
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = 'rgba(255,200,80,0.4)';
            c.fillRect(px + 4 + Math.sin(Date.now()/300 + x) * 2, py + 4, TILE - 8, 2);
          } else if (ch === 'D') {
            const isFirst = (y === 8);
            const open = isFirst ? cDoorOpen : bDoorOpen;
            c.fillStyle = open ? '#605040' : '#1a0808';
            c.fillRect(px, py, TILE, TILE);
            if (!open) {
              c.fillStyle = '#a08040';
              c.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
              c.fillStyle = '#fff';
              c.font = 'bold 16px monospace';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText('🔒', px + TILE/2, py + TILE/2);
              c.textBaseline = 'alphabetic';
              c.textAlign = 'left';
            }
          } else if (ch === 'd') {
            c.fillStyle = '#605040';
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = '#1a0808';
            c.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
            c.fillStyle = '#fff8c0';
            c.font = 'bold 18px monospace';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(state.flags.defeated_fire_boss ? '↑' : '🔒', px + TILE/2, py + TILE/2);
            c.textBaseline = 'alphabetic';
            c.textAlign = 'left';
          } else {
            c.fillStyle = '#605040';
            c.fillRect(px, py, TILE, TILE);
            c.strokeStyle = 'rgba(0,0,0,0.15)';
            c.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          }
        }
      }

      /* Switch */
      if (bswitch) {
        c.fillStyle = bswitch.on ? '#80f080' : '#c04040';
        c.fillRect(bswitch.x - 8, bswitch.y - 8, 16, 16);
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.strokeRect(bswitch.x - 7.5, bswitch.y - 7.5, 15, 15);
        c.fillStyle = '#fff';
        c.font = 'bold 11px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(bswitch.on ? '✓' : '◉', bswitch.x, bswitch.y);
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
      }

      /* Chest */
      if (chest) {
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.beginPath(); c.ellipse(chest.x, chest.y + 12, 12, 4, 0, 0, Math.PI * 2); c.fill();
        drawSprite(c, chest.opened ? 'chest_open' : 'chest_closed', chest.x - 16, chest.y - 16, 32, 32);
        if (!chest.opened) {
          /* "!" per chest */
          c.fillStyle = C.gold;
          c.font = 'bold 14px monospace';
          c.textAlign = 'center';
          const bob = Math.sin(Date.now() / 200) * 2;
          c.fillText('!', chest.x, chest.y - 18 + bob);
          c.textAlign = 'left';
        }
      }

      /* Nemici ChuChu */
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        c.save();
        if (e.iframes > 0 && Math.floor(e.iframes / 3) % 2) c.globalAlpha = 0.4;
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.ellipse(e.x, e.y + 12, 9, 3, 0, 0, Math.PI * 2); c.fill();
        drawSprite(c, 'enemy_chuchu', e.x - 16, e.y - 16, 32, 32);
        c.restore();
      }

      /* Boss */
      if (boss && boss.hp > 0) {
        c.save();
        if (boss.iframes > 0 && Math.floor(boss.iframes / 3) % 2) c.globalAlpha = 0.5;
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.beginPath(); c.ellipse(boss.x, boss.y + 18, 18, 6, 0, 0, Math.PI * 2); c.fill();
        /* Boss = ChuChu Re — chuchu sprite scalato + corona */
        drawSprite(c, 'enemy_chuchu', boss.x - 24, boss.y - 24, 48, 48);
        c.restore();
        /* Corona */
        c.fillStyle = C.gold;
        c.font = 'bold 14px monospace';
        c.textAlign = 'center';
        c.fillText('👑', boss.x, boss.y - 22);
        c.textAlign = 'left';
        /* HP bar boss */
        const bw = 80, bh = 6;
        const bx = boss.x - bw / 2;
        const by = boss.y - 32;
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(bx, by, bw, bh);
        c.fillStyle = C.red;
        c.fillRect(bx + 1, by + 1, (bw - 2) * boss.hp / boss.maxHp, bh - 2);
      }

      /* Boomerang */
      if (boomerang.active) {
        c.save();
        c.translate(boomerang.x, boomerang.y);
        c.rotate(Date.now() / 50);
        drawSprite(c, 'item_boomerang', -10, -10, 20, 20);
        c.restore();
      }

      /* Player */
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(player.x, player.y + 12, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.save();
      if (player.iframes > 0 && Math.floor(player.iframes / 3) % 2) c.globalAlpha = 0.5;
      drawSprite(c, 'player_' + player.dir, player.x - 16, player.y - 16, 32, 32);
      c.restore();

      /* Slash */
      if (player.attack) {
        const a = player.attack;
        const angle = a.dir === 'right' ? 0 : a.dir === 'down' ? Math.PI / 2
                    : a.dir === 'left' ? Math.PI : -Math.PI / 2;
        const swing = (a.frame / ATTACK_FRAMES) * Math.PI - Math.PI / 2;
        c.save();
        c.translate(player.x, player.y);
        c.rotate(angle + swing);
        c.strokeStyle = '#fff';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(8, 0); c.lineTo(20, 0);
        c.stroke();
        c.restore();
      }

      /* Hint boomerang */
      if (state.items.boomerang) {
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(8, CANVAS_H - 22, 140, 16);
        c.fillStyle = '#fff8c0';
        c.font = 'bold 10px monospace';
        c.fillText('🪃 [B/X] Lancia boomerang', 12, CANVAS_H - 11);
      }
    },

    pullToast() { const tt = scene._toast; scene._toast = null; return tt; },
    getDialog() { return scene.dialog; },
    dispose() { /* nothing */ },
  });

  return scene;
}
