/**
 * Andryx Hourglass — TEMPIO DEL FUOCO (versione 3D).
 *
 * La logica di gioco rimane invariata.
 * setup3D costruisce la scena 3D; render() è un no-op.
 */
import * as THREE from 'three';
import { C } from '../palette.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../renderer3d.js';
import { addRupees, damage } from '../state.js';
import {
  createPlayerModel, createEnemyModel, createBossModel,
  createChestModel, createSwitchModel, createBoomerangModel,
  px2wx, px2wz, TILE_3D, disposeGroupGeometries,
} from '../models3d.js';
import { buildTileMap } from '../world.js';

const TILE             = 32;
const COLS             = 15;
const ROWS             = 15;
const PLAYER_SPEED     = 1.4;
const PLAYER_R         = 7;
const ATTACK_RANGE     = 18;
const ATTACK_FRAMES    = 14;
const BOOMERANG_SPEED  = 4;
const BOOMERANG_RANGE  = 180;

const MAP = [
  '###############',
  '#@.............#'.slice(0, 15),
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
  '#######D#######'.slice(0, 15),
  '#......B.....d#',
];

export function createFireScene(state) {
  state.flags.visited_fire = true;
  const map = MAP.map(r => r.padEnd(COLS, '#').slice(0, COLS).split(''));
  while (map.length < ROWS) map.push('###############'.split(''));

  const player  = { x: 0, y: 0, dir: 'down', iframes: 0, attack: null };
  const enemies = [];
  let chest    = null;
  let boss     = null;
  let bswitch  = null;
  let stair    = null;
  let bDoorOpen  = false;
  let cDoorOpen  = false;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = map[y][x];
      const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
      if (ch === '@') { player.x = px; player.y = py; map[y][x] = '.'; }
      else if (ch === 'C') {
        enemies.push({ kind: 'chuchu', x: px, y: py, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: Math.random() < 0.5 ? 1 : -1 });
        map[y][x] = '.';
      } else if (ch === 'T') { chest = { x: px, y: py, opened: false }; map[y][x] = '.'; }
      else if (ch === 'X') { bswitch = { x: px, y: py, on: false }; map[y][x] = '.'; }
      else if (ch === 'B') {
        boss = { x: px, y: py, hp: 6, maxHp: 6, vx: 0, vy: 0, iframes: 0, phase: 'idle', cooldown: 0 };
        map[y][x] = '.';
      } else if (ch === 'd') {
        stair = { x: px, y: py };
      }
    }
  }
  cDoorOpen = true;

  const boomerang = { active: false, x: 0, y: 0, vx: 0, vy: 0, dist: 0, returning: false };
  const scene = {
    id: 'fire', dialog: null, _toast: null,
    _3dRoot: null, _playerMesh: null, _enemyMeshEntries: [],
    _bossMesh: null, _chestMesh: null, _switchMesh: null,
    _boomerangMesh: null, _r3d: null,
    _doorMeshes: [],
  };

  playMusic('dungeon');

  const isWall = (x, y) => {
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    const t = map[cy][cx];
    if (t === '#') return true;
    if (t === 'D') {
      if (cy === 8)  return !cDoorOpen;
      if (cy === 13) return !bDoorOpen;
    }
    return false;
  };
  const isLava = (x, y) => {
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
    return map[cy][cx] === 'L';
  };

  function tryMove(p, dx, dy) {
    const r = PLAYER_R, nx = p.x + dx;
    if (!isWall(nx - r, p.y - r) && !isWall(nx + r, p.y - r) &&
        !isWall(nx - r, p.y + r) && !isWall(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isWall(p.x - r, ny - r) && !isWall(p.x + r, ny - r) &&
        !isWall(p.x - r, ny + r) && !isWall(p.x + r, ny + r)) p.y = ny;
  }

  function hurtPlayer(amount) {
    if (player.iframes > 0) return;
    if (damage(state, amount)) {
      state.flags.gameover = true; SFX.gameover();
    } else {
      SFX.hit(); player.iframes = 50;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Logica di gioco (invariata)                                         */
  /* ------------------------------------------------------------------ */

  scene.update = function update(input, _state, frame) {
    const { dx, dy } = input.move();
    if (dx || dy) {
      tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
      else                              player.dir = dy > 0 ? 'down'  : 'up';
    }

    if (isLava(player.x, player.y) && player.iframes === 0) {
      hurtPlayer(1);
      player.x -= dx * 6; player.y -= dy * 6;
    }

    if (chest && !chest.opened) {
      const ddx = player.x - chest.x, ddy = player.y - chest.y;
      if (ddx * ddx + ddy * ddy < 16 * 16) {
        chest.opened = true;
        state.items.boomerang = true;
        scene._toast = t('toast.got_boomerang');
        SFX.pickup();
      }
    }

    if (input.isSecondary() && state.items.boomerang && !boomerang.active) {
      const dirVec = player.dir === 'right' ? [1, 0]
                   : player.dir === 'left'  ? [-1, 0]
                   : player.dir === 'down'  ? [0, 1] : [0, -1];
      boomerang.active = true;
      boomerang.x = player.x; boomerang.y = player.y;
      boomerang.vx = dirVec[0] * BOOMERANG_SPEED;
      boomerang.vy = dirVec[1] * BOOMERANG_SPEED;
      boomerang.dist = 0; boomerang.returning = false;
      SFX.boomerang();
    }

    if (boomerang.active) {
      boomerang.x += boomerang.vx; boomerang.y += boomerang.vy;
      boomerang.dist += BOOMERANG_SPEED;
      if (isWall(boomerang.x, boomerang.y) && !boomerang.returning) boomerang.returning = true;
      if (bswitch && !bswitch.on) {
        const sdx = boomerang.x - bswitch.x, sdy = boomerang.y - bswitch.y;
        if (sdx * sdx + sdy * sdy < 14 * 14) {
          bswitch.on = true; bDoorOpen = true;
          scene._toast = '\u2713 Interruttore attivato \u2014 porta sud aperta';
          SFX.door();
        }
      }
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const edx = boomerang.x - e.x, edy = boomerang.y - e.y;
        if (edx * edx + edy * edy < 14 * 14) {
          e.hp = 0; state.kills++;
          addRupees(state, 5); SFX.enemy_hit();
        }
      }
      if (boomerang.dist > BOOMERANG_RANGE && !boomerang.returning) boomerang.returning = true;
      if (boomerang.returning) {
        const rdx = player.x - boomerang.x, rdy = player.y - boomerang.y;
        const m = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
        boomerang.vx = (rdx / m) * BOOMERANG_SPEED;
        boomerang.vy = (rdy / m) * BOOMERANG_SPEED;
        if (m < 12) boomerang.active = false;
      }
    }

    if (input.isAction() && state.items.sword && !player.attack) {
      player.attack = { frame: 0, dir: player.dir }; SFX.sword();
    }
    if (player.attack) {
      player.attack.frame++;
      if ([4, 8].includes(player.attack.frame)) {
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const adx = e.x - player.x, ady = e.y - player.y;
          const dist = Math.sqrt(adx * adx + ady * ady);
          const dir  = player.attack.dir;
          const inFront =
            (dir === 'right' && adx > -4) || (dir === 'left' && adx < 4) ||
            (dir === 'down'  && ady > -4) || (dir === 'up'   && ady < 4);
          if (dist < ATTACK_RANGE + 6 && inFront) {
            e.hp--; e.iframes = 18;
            e.vx = (adx / (dist || 1)) * 4;
            e.vy = (ady / (dist || 1)) * 4;
            SFX.enemy_hit();
            if (e.hp <= 0) { state.kills++; addRupees(state, 5); }
          }
        }
        if (boss && boss.hp > 0 && boss.iframes === 0) {
          const bdx = boss.x - player.x, bdy = boss.y - player.y;
          const dist = Math.sqrt(bdx * bdx + bdy * bdy);
          if (dist < ATTACK_RANGE + 14) {
            boss.hp--; boss.iframes = 28;
            boss.vx = (bdx / (dist || 1)) * 5;
            boss.vy = (bdy / (dist || 1)) * 5;
            SFX.enemy_hit();
            if (boss.hp <= 0) {
              state.kills++; state.score += 1000;
              state.flags.defeated_fire_boss = true;
              addRupees(state, 50);
              scene._toast = '\u2694 BOSS sconfitto! +50 rupie';
              SFX.victory();
            }
          }
        }
      }
      if (player.attack.frame >= ATTACK_FRAMES) player.attack = null;
    }

    if (player.iframes > 0) player.iframes--;

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

    if (boss && boss.hp > 0) {
      if (boss.iframes > 0) boss.iframes--;
      boss.x += boss.vx; boss.y += boss.vy;
      boss.vx *= 0.85; boss.vy *= 0.85;
      boss.cooldown--;
      if (boss.cooldown <= 0 && boss.iframes === 0) {
        const bdx = player.x - boss.x, bdy = player.y - boss.y;
        const m   = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        boss.vx = (bdx / m) * 1.6; boss.vy = (bdy / m) * 1.6;
        boss.cooldown = 90;
      }
      const cdx = player.x - boss.x, cdy = player.y - boss.y;
      if (cdx * cdx + cdy * cdy < 18 * 18) hurtPlayer(2);
    }

    if (stair) {
      const sdx = player.x - stair.x, sdy = player.y - stair.y;
      if (sdx * sdx + sdy * sdy < 14 * 14 && state.flags.defeated_fire_boss) {
        state.nextSceneId = 'sea'; SFX.door();
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Setup 3D                                                            */
  /* ------------------------------------------------------------------ */

  scene.setup3D = function setup3D(renderer3d) {
    scene._r3d = renderer3d;
    const s    = renderer3d.scene;

    s.background = new THREE.Color(0x2a1810);
    s.fog         = new THREE.Fog(0x2a1810, 15, 40);

    scene._3dRoot = new THREE.Group();
    s.add(scene._3dRoot);

    /* Tilemap: sostituiamo 'D' con '.' per renderla come pavimento;
       le porte vengono gestite con mesh separate */
    const mapForTiles = map.map(row =>
      row.map(ch => (ch === 'D' ? '.' : ch)).join(''),
    );
    buildTileMap(mapForTiles, scene._3dRoot, {
      floorColor: 0x605040,
      wallColor:  0x3a1a08,
    });

    /* Porte (mesh cubiche rosse che compaiono/spariscono) */
    scene._doorMeshes = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y] && MAP[y][x] === 'D') {
          const doorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_3D, TILE_3D, TILE_3D),
            new THREE.MeshToonMaterial({ color: 0xa08040 }),
          );
          doorMesh.position.set(
            px2wx((x + 0.5) * TILE),
            TILE_3D / 2,
            px2wz((y + 0.5) * TILE),
          );
          doorMesh.castShadow = true;
          scene._3dRoot.add(doorMesh);
          scene._doorMeshes.push({ y, mesh: doorMesh });
        }
      }
    }

    /* Player */
    scene._playerMesh = createPlayerModel();
    scene._playerMesh.castShadow = true;
    scene._3dRoot.add(scene._playerMesh);

    /* Nemici */
    scene._enemyMeshEntries = [];
    for (const e of enemies) {
      const em = createEnemyModel(e.kind || 'chuchu');
      em.position.set(px2wx(e.x), 0, px2wz(e.y));
      scene._3dRoot.add(em);
      scene._enemyMeshEntries.push({ enemy: e, mesh: em });
    }

    /* Boss */
    if (boss) {
      scene._bossMesh = createBossModel();
      scene._bossMesh.position.set(px2wx(boss.x), 0, px2wz(boss.y));
      scene._3dRoot.add(scene._bossMesh);
    }

    /* Chest */
    if (chest) {
      scene._chestMesh = createChestModel(false);
      scene._chestMesh.position.set(px2wx(chest.x), 0, px2wz(chest.y));
      scene._3dRoot.add(scene._chestMesh);
    }

    /* Switch */
    if (bswitch) {
      scene._switchMesh = createSwitchModel(false);
      scene._switchMesh.position.set(px2wx(bswitch.x), 0, px2wz(bswitch.y));
      scene._3dRoot.add(scene._switchMesh);
    }

    /* Boomerang */
    scene._boomerangMesh = createBoomerangModel();
    scene._boomerangMesh.visible = false;
    scene._3dRoot.add(scene._boomerangMesh);
  };

  /* ------------------------------------------------------------------ */
  /* Sync mesh ogni frame                                                */
  /* ------------------------------------------------------------------ */

  scene.syncMeshes = function syncMeshes() {
    if (!scene._playerMesh) return;

    scene._playerMesh.position.set(px2wx(player.x), 0, px2wz(player.y));
    if (player.iframes > 0) scene._playerMesh.visible = Math.floor(player.iframes / 3) % 2 === 0;
    else                    scene._playerMesh.visible = true;

    /* Nemici */
    for (const { enemy, mesh } of scene._enemyMeshEntries) {
      if (enemy.hp <= 0) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.position.set(px2wx(enemy.x), 0, px2wz(enemy.y));
      if (enemy.iframes > 0) mesh.visible = Math.floor(enemy.iframes / 3) % 2 === 0;
    }

    /* Boss */
    if (scene._bossMesh && boss) {
      scene._bossMesh.visible = boss.hp > 0;
      if (boss.hp > 0) {
        scene._bossMesh.position.set(px2wx(boss.x), 0, px2wz(boss.y));
        /* Oscillazione boss */
        scene._bossMesh.position.y = Math.sin(Date.now() * 0.003) * 0.1;
        if (boss.iframes > 0) scene._bossMesh.visible = Math.floor(boss.iframes / 3) % 2 === 0;
      }
    }

    /* Chest */
    if (scene._chestMesh && chest) {
      /* Aggiorna lid apertura (semplicemente mostra/nascondi per semplicità) */
    }

    /* Switch */
    if (scene._switchMesh && bswitch) {
      scene._switchMesh.traverse(obj => {
        if (obj.isMesh && obj.material) {
          obj.material.color?.set(bswitch.on ? 0x40c040 : 0xc04040);
        }
      });
    }

    /* Porte */
    for (const { y, mesh } of scene._doorMeshes) {
      const isOpen = (y === 8) ? cDoorOpen : bDoorOpen;
      mesh.visible = !isOpen;
    }

    /* Boomerang */
    if (scene._boomerangMesh) {
      scene._boomerangMesh.visible = boomerang.active;
      if (boomerang.active) {
        scene._boomerangMesh.position.set(px2wx(boomerang.x), 0.6, px2wz(boomerang.y));
        scene._boomerangMesh.rotation.y += 0.15;
      }
    }

    /* Animazione lava: pulse emissivo */
    if (scene._3dRoot) {
      const t = (Math.sin(Date.now() / 200) * 0.3 + 0.5);
      scene._3dRoot.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.emissive &&
            obj.material.color && obj.material.color.r > 0.8) {
          obj.material.emissiveIntensity = 0.4 + t * 0.4;
        }
      });
    }
  };

  scene.render    = function render() {};
  scene.pullToast = function pullToast() { const tt = scene._toast; scene._toast = null; return tt; };
  scene.getDialog = function getDialog() { return scene.dialog; };

  scene.dispose = function dispose() {
    if (scene._3dRoot && scene._r3d) {
      scene._r3d.scene.remove(scene._3dRoot);
      disposeGroupGeometries(scene._3dRoot);
      scene._3dRoot = null;
    }
    if (scene._r3d) scene._r3d.scene.fog = null;
    scene._playerMesh  = null;
    scene._enemyMeshEntries = [];
    scene._bossMesh    = null;
    scene._chestMesh   = null;
    scene._switchMesh  = null;
    scene._boomerangMesh = null;
    scene._doorMeshes  = [];
  };

  return scene;
}
