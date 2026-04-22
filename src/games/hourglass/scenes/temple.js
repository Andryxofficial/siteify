/**
 * Andryx Hourglass — TEMPIO DEL RE DEL MARE (versione 3D).
 *
 * La logica di gioco rimane invariata (timer hourglass, phantom AI, safe zones).
 * setup3D costruisce la scena 3D; render() è un no-op.
 */
import * as THREE from 'three';
import { C } from '../palette.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../renderer3d.js';
import { damage } from '../state.js';
import {
  createPlayerModel, createPhantomModel, createKeyModel,
  px2wx, px2wz, disposeGroupGeometries,
} from '../models3d.js';
import { buildTileMap } from '../world.js';

const TILE                   = 32;
const COLS                   = 15;
const ROWS                   = 15;
const PLAYER_SPEED           = 1.4;
const PLAYER_R               = 7;
const PHANTOM_SPEED_PATROL   = 0.55;
const PHANTOM_SPEED_CHASE    = 1.1;
const PHANTOM_SIGHT          = 96;
const PHANTOM_TOUCH_DAMAGE   = 2;

const FLOOR_0 = [
  '###############',
  '#@.....#......#',
  '#.sss..#..ss..#',
  '#.sss..#..ss..#',
  '#......#......#',
  '#.....k........',
  '#......#......#',
  '#......#..p...#',
  '########..#####',
  '#......#......#',
  '#..ss..........',
  '#..ss..#......#',
  '#......#..ss..#',
  '#......#..ssd.#',
  '###############',
];

const FLOOR_1 = [
  '###############',
  '#@.....#.....k#',
  '#.ss...#......#',
  '#.ss...#..p...#',
  '#......#......#',
  '#......#......#',
  '##.#####......#',
  '#.....p#######',
  '#......#......#',
  '#......#..ss..#',
  '#..ss..#..ss..#',
  '#..ss..#......#',
  '#......#......#',
  '#............d#',
  '###############',
];

const FLOORS = [FLOOR_0, FLOOR_1];

export function createTempleScene(state) {
  state.flags.visited_temple = true;

  let floorIdx = state.oceanFloor || 0;
  if (floorIdx >= FLOORS.length) floorIdx = FLOORS.length - 1;
  const map = FLOORS[floorIdx].map(r => r.split(''));

  let player = { x: 0, y: 0, dir: 'down', iframes: 0, attack: null };
  const phantoms = [];
  let key   = null;
  let stair = null;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = map[y][x];
      if (c === '@') {
        player.x = x * TILE + TILE / 2;
        player.y = y * TILE + TILE / 2;
        map[y][x] = '.';
      } else if (c === 'p') {
        phantoms.push({
          x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
          dir: 'down', state: 'patrol', patrolT: 0, alertT: 0,
          patrolDir: { dx: 1, dy: 0 },
        });
        map[y][x] = '.';
      } else if (c === 'k') {
        key = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false };
        map[y][x] = '.';
      } else if (c === 'd') {
        stair = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      }
    }
  }

  const scene = {
    id: 'temple', dialog: null, _toast: null,
    _alertFlash: 0, _wasInSafe: false, _anyChasing: false,
    _3dRoot: null, _playerMesh: null, _phantomMeshes: [],
    _keyMesh: null, _r3d: null,
  };

  if (!state.flags.met_temple_intro) {
    scene.dialog = {
      speaker: 'Oshus',
      lines: t('npc.elder_temple').split('\n'),
      lineIdx: 0, charIdx: 0, completedAt: 0,
      onComplete: () => { state.flags.met_temple_intro = true; },
    };
  }

  playMusic('temple');

  const isWall = (x, y) => {
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    return map[cy][cx] === '#';
  };
  const tileAt = (x, y) => {
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return '#';
    return map[cy][cx];
  };
  const isSafe = (x, y) => tileAt(x, y) === 's';

  function tryMove(p, dx, dy) {
    const r = PLAYER_R, nx = p.x + dx;
    if (!isWall(nx - r, p.y - r) && !isWall(nx + r, p.y - r) &&
        !isWall(nx - r, p.y + r) && !isWall(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isWall(p.x - r, ny - r) && !isWall(p.x + r, ny - r) &&
        !isWall(p.x - r, ny + r) && !isWall(p.x + r, ny + r)) p.y = ny;
  }

  function hasLineOfSight(ph, plX, plY) {
    const dx = plX - ph.x, dy = plY - ph.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > PHANTOM_SIGHT) return false;
    const steps = Math.ceil(dist / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(ph.x + dx * t, ph.y + dy * t)) return false;
    }
    return true;
  }

  function ejectPlayerToFloorAbove() {
    if (floorIdx > 0) {
      state.oceanFloor = floorIdx - 1;
      state.nextSceneId = 'temple';
      state.spawnX = null; state.spawnY = null;
    } else {
      state.nextSceneId = 'sea';
    }
    SFX.gameover();
  }

  /* ------------------------------------------------------------------ */
  /* Logica di gioco (invariata)                                         */
  /* ------------------------------------------------------------------ */

  scene.update = function update(input, _state, frame) {
    if (scene.dialog) {
      const d    = scene.dialog;
      const line = d.lines[d.lineIdx] || '';
      if (d.charIdx < line.length) {
        d.charIdx = Math.min(line.length, d.charIdx + 1.5);
        if (Math.floor(d.charIdx) % 4 === 0) SFX.text();
        if (d.charIdx >= line.length) d.completedAt = frame;
      }
      if (input.isAction()) {
        if (d.charIdx < line.length) { d.charIdx = line.length; d.completedAt = frame; }
        else if ((frame - (d.completedAt || 0)) >= 4) {
          if (d.lineIdx < d.lines.length - 1) {
            d.lineIdx++; d.charIdx = 0; d.completedAt = 0;
          } else {
            if (d.onComplete) d.onComplete();
            scene.dialog = null;
          }
        }
      }
      return;
    }

    const inSafe = isSafe(player.x, player.y);
    state.inSafeZone = inSafe;
    if (inSafe) {
      state.hourglassMs = Math.min(state.hourglassMax, state.hourglassMs + 1000 / 60 * 2);
    } else {
      state.hourglassMs -= 1000 / 60;
      if (state.hourglassMs <= 0) { state.flags.gameover = true; SFX.gameover(); return; }
      if (state.hourglassMs < 60000 &&
          Math.floor(state.hourglassMs / 1000) !== Math.floor((state.hourglassMs + 1000 / 60) / 1000)) {
        SFX.timer_tick();
        if (state.hourglassMs < 30000 && state.hourglassMs > 28000) scene._toast = t('toast.timer_low');
      }
    }
    if (inSafe && !scene._wasInSafe) { scene._toast = t('toast.safe_entered'); SFX.safe(); }
    scene._wasInSafe = inSafe;

    const { dx, dy } = input.move();
    if (dx || dy) {
      tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
      else                              player.dir = dy > 0 ? 'down'  : 'up';
    }

    if (key && !key.taken) {
      const kdx = player.x - key.x, kdy = player.y - key.y;
      if (kdx * kdx + kdy * kdy < 14 * 14) {
        key.taken = true;
        state.items.keys++;
        scene._toast = t('toast.got_key');
        SFX.key();
      }
    }

    if (stair) {
      const sdx = player.x - stair.x, sdy = player.y - stair.y;
      if (sdx * sdx + sdy * sdy < 14 * 14) {
        if (state.items.keys > 0) {
          state.items.keys--;
          if (floorIdx + 1 < FLOORS.length) {
            state.oceanFloor = floorIdx + 1;
            state.nextSceneId = 'temple';
            SFX.door();
          } else {
            state.flags.defeated_phantom_lord = true;
            state.flags.win = true;
            state.score += 5000;
            SFX.victory();
            state.nextSceneId = 'sea';
          }
        } else {
          scene._toast = t('toast.door_locked');
        }
      }
    }

    if (player.iframes > 0) player.iframes--;
    if (scene._alertFlash > 0) scene._alertFlash--;

    let anyChasing = false;
    for (const ph of phantoms) {
      const sees = hasLineOfSight(ph, player.x, player.y);
      if (sees) {
        if (ph.state !== 'chase') {
          ph.state = 'chase'; ph.alertT = 30;
          scene._alertFlash = 40; SFX.phantom_alert();
        }
      } else if (ph.state === 'chase' && ph.alertT-- < -120) {
        ph.state = 'patrol'; ph.alertT = 0;
      }
      if (ph.state === 'chase') anyChasing = true;

      let speed = PHANTOM_SPEED_PATROL, pdx = 0, pdy = 0;
      if (ph.state === 'chase') {
        speed = PHANTOM_SPEED_CHASE;
        const ddx = player.x - ph.x, ddy = player.y - ph.y;
        const m   = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        pdx = ddx / m; pdy = ddy / m;
      } else {
        ph.patrolT--;
        if (ph.patrolT <= 0) {
          ph.patrolT = 60 + Math.random() * 60;
          const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
          ph.patrolDir = dirs[Math.floor(Math.random() * 4)];
        }
        pdx = ph.patrolDir.dx; pdy = ph.patrolDir.dy;
      }

      const r  = 9;
      const nx = ph.x + pdx * speed, ny = ph.y + pdy * speed;
      let moved = false;
      if (!isWall(nx - r, ph.y - r) && !isWall(nx + r, ph.y - r) &&
          !isWall(nx - r, ph.y + r) && !isWall(nx + r, ph.y + r)) { ph.x = nx; moved = true; }
      if (!isWall(ph.x - r, ny - r) && !isWall(ph.x + r, ny - r) &&
          !isWall(ph.x - r, ny + r) && !isWall(ph.x + r, ny + r)) { ph.y = ny; moved = true; }
      if (!moved && ph.state === 'patrol') ph.patrolT = 0;
      if (Math.abs(pdx) > Math.abs(pdy)) ph.dir = pdx > 0 ? 'right' : 'left';
      else                                ph.dir = pdy > 0 ? 'down'  : 'up';

      const tdx = player.x - ph.x, tdy = player.y - ph.y;
      if (tdx * tdx + tdy * tdy < 16 * 16 && player.iframes === 0) {
        if (damage(state, PHANTOM_TOUCH_DAMAGE)) {
          state.flags.gameover = true; SFX.gameover();
        } else {
          SFX.hit(); player.iframes = 60;
          ejectPlayerToFloorAbove(); return;
        }
      }
    }

    if (input.isAction() && state.items.sword && !player.attack) {
      player.attack = { frame: 0, dir: player.dir }; SFX.sword();
    }
    if (player.attack) {
      player.attack.frame++;
      if (player.attack.frame >= 14) player.attack = null;
    }

    scene._anyChasing = anyChasing;
  };

  /* ------------------------------------------------------------------ */
  /* Setup 3D                                                            */
  /* ------------------------------------------------------------------ */

  scene.setup3D = function setup3D(renderer3d) {
    scene._r3d = renderer3d;
    const s    = renderer3d.scene;

    s.background = new THREE.Color(0x2a1a14);
    s.fog         = new THREE.Fog(0x2a1a14, 18, 45);

    scene._3dRoot = new THREE.Group();
    s.add(scene._3dRoot);

    /* Tilemap (usa la mappa corrente con '@', 'p', 'k' già rimossi) */
    const mapStrings = map.map(row => row.join(''));
    buildTileMap(mapStrings, scene._3dRoot, {
      floorColor: 0x605040,
      wallColor:  0x3a2820,
    });

    /* Player */
    scene._playerMesh = createPlayerModel();
    scene._playerMesh.castShadow = true;
    scene._3dRoot.add(scene._playerMesh);

    /* Phantom */
    scene._phantomMeshes = [];
    for (const ph of phantoms) {
      const pm = createPhantomModel('normal');
      pm.position.set(px2wx(ph.x), 0, px2wz(ph.y));
      scene._3dRoot.add(pm);
      scene._phantomMeshes.push({ phantom: ph, mesh: pm });
    }

    /* Chiave */
    if (key) {
      scene._keyMesh = createKeyModel();
      scene._keyMesh.position.set(px2wx(key.x), 0, px2wz(key.y));
      scene._3dRoot.add(scene._keyMesh);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sync mesh ogni frame                                                */
  /* ------------------------------------------------------------------ */

  scene.syncMeshes = function syncMeshes() {
    if (!scene._playerMesh) return;
    scene._playerMesh.position.set(px2wx(player.x), 0, px2wz(player.y));
    if (player.iframes > 0) scene._playerMesh.visible = Math.floor(player.iframes / 3) % 2 === 0;
    else                    scene._playerMesh.visible = true;

    for (const { phantom, mesh } of scene._phantomMeshes) {
      mesh.position.set(px2wx(phantom.x), 0, px2wz(phantom.y));
      /* Cambia colore in base allo stato di allerta */
      const isAlert = phantom.state === 'chase';
      mesh.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.color) {
          if (isAlert) obj.material.emissiveIntensity = 0.4;
          else         obj.material.emissiveIntensity = 0;
        }
      });
    }

    if (scene._keyMesh) scene._keyMesh.visible = !(key && key.taken);
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
    scene._playerMesh   = null;
    scene._phantomMeshes = [];
    scene._keyMesh      = null;
  };

  return scene;
}
