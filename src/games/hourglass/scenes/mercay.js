/**
 * Andryx Hourglass — Scena ISOLA MERCAY (versione 3D).
 *
 * La logica di gioco (update) rimane invariata.
 * setup3D costruisce la scena Three.js con tilemap, player e NPC.
 * render() è un no-op.
 */
import * as THREE from 'three';
import { C } from '../palette.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../renderer3d.js';
import { addRupees, damage } from '../state.js';
import {
  createPlayerModel, createNPCModel, createEnemyModel,
  px2wx, px2wz, disposeGroupGeometries,
} from '../models3d.js';
import { buildTileMap } from '../world.js';

const PLAYER_SPEED  = 1.4;
const PLAYER_R      = 7;
const ATTACK_RANGE  = 18;
const ATTACK_FRAMES = 14;
const TALK_RANGE    = 28;

/* AABB solidi: bordo mare, case, pietre */
const SOLIDS = [
  { x: 0,        y: 0,        w: CANVAS_W, h: 30 },
  { x: 0,        y: CANVAS_H - 30, w: CANVAS_W, h: 30 },
  { x: 0,        y: 0,        w: 30, h: CANVAS_H },
  { x: CANVAS_W - 30, y: 0,   w: 30, h: CANVAS_H },
  { x: 80,  y: 100, w: 60, h: 50 },
  { x: 320, y: 110, w: 70, h: 60 },
  { x: 200, y: 220, w: 24, h: 24 },
  { x: 260, y: 320, w: 20, h: 20 },
];

const DOCK = { x: 30, y: 240, w: 24, h: 60 };

const NPCS = [
  {
    id: 'oshus', label: 'Oshus', x: 110, y: 180, sprite: 'npc_oshus',
    dialog: (state) => state.flags.met_oshus
      ? (state.items.sword ? 'Va\', il mare ti aspetta. Dirigiti al Tempio del Re del Mare.' : t('npc.oshus_intro'))
      : t('npc.oshus_intro'),
    onTalk: (state, scene) => {
      if (!state.flags.met_oshus) {
        state.flags.met_oshus = true;
        state.sea.islandsUnlocked.temple = true;
      }
      if (!state.items.sword) {
        state.items.sword = true;
        state.sea.islandsUnlocked.fire = true;
        scene._toast = t('toast.got_sword');
        SFX.pickup();
      }
    },
  },
  {
    id: 'linebeck', label: 'Linebeck', x: 360, y: 200, sprite: 'npc_linebeck',
    dialog: (state) => state.flags.met_linebeck ? t('npc.linebeck_sail') : t('npc.linebeck_intro'),
    onTalk: (state) => { state.flags.met_linebeck = true; },
  },
  {
    id: 'shopkeeper', label: 'Negoziante', x: 200, y: 380, sprite: 'npc_shopkeeper',
    dialog: () => t('npc.shopkeeper'),
  },
];

/* Tilemap approssimata della Mercay per il render 3D */
const MERCAY_MAP = [
  '###############',
  '#.............#',
  '#.............#',
  '######.########',
  '#.......###.###',
  '#.......###.###',
  '#.............#',
  '##.###.########',
  '#.............#',
  '#.............#',
  '##.####.#######',
  '#.............#',
  '#.............#',
  '#.............#',
  '###############',
];

const SPAWN_ENEMIES = (state) => state.items.sword ? [] : [
  { kind: 'chuchu', x: 360, y: 360, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: 1 },
  { kind: 'chuchu', x: 280, y: 380, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: -1 },
];

export function createMercayScene(state) {
  const player = {
    x: state.spawnX || 80,
    y: state.spawnY || 240,
    dir: 'down',
    iframes: 0,
    attack: null,
  };
  state.spawnX = state.spawnY = null;

  const enemies = SPAWN_ENEMIES(state);
  const scene   = { id: 'mercay', dialog: null, _toast: null };

  if (!state.flags.met_oshus) {
    scene.dialog = makeDialog('Oshus', t('npc.oshus_intro'), () => {
      state.flags.met_oshus = true;
      state.sea.islandsUnlocked.temple = true;
      if (!state.items.sword) {
        state.items.sword = true;
        state.sea.islandsUnlocked.fire = true;
        scene._toast = t('toast.got_sword');
        SFX.pickup();
      }
    });
  }

  playMusic('island');

  function isSolid(x, y) {
    if (x > 0 && x < 30 && y > DOCK.y && y < DOCK.y + DOCK.h) return false;
    for (const s of SOLIDS) {
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
    }
    return false;
  }

  function tryMove(p, dx, dy) {
    const r  = PLAYER_R;
    const nx = p.x + dx;
    if (!isSolid(nx - r, p.y - r) && !isSolid(nx + r, p.y - r) &&
        !isSolid(nx - r, p.y + r) && !isSolid(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isSolid(p.x - r, ny - r) && !isSolid(p.x + r, ny - r) &&
        !isSolid(p.x - r, ny + r) && !isSolid(p.x + r, ny + r)) p.y = ny;
  }

  function nearestNpcInRange() {
    let best = null, bd = Infinity;
    for (const n of NPCS) {
      const dx = player.x - n.x, dy = player.y - n.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < TALK_RANGE && d < bd) { best = n; bd = d; }
    }
    return best;
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

    const { dx, dy } = input.move();
    if (dx || dy) {
      tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
      else                              player.dir = dy > 0 ? 'down'  : 'up';
    }

    if (input.isAction() && !player.attack) {
      const npc = nearestNpcInRange();
      if (npc) {
        scene.dialog = makeDialog(npc.label, npc.dialog(state), () => {
          if (npc.onTalk) npc.onTalk(state, scene);
        });
        SFX.text();
      } else if (state.items.sword) {
        player.attack = { frame: 0, dir: player.dir };
        SFX.sword();
      }
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
            if (e.hp <= 0) {
              state.kills++;
              addRupees(state, 5);
              scene._toast = t('toast.got_rupees', { n: 5 });
              SFX.rupee();
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
      if (e.kind === 'chuchu') {
        if (Math.random() < 0.02) e.dir = -e.dir;
        e.x += e.dir * 0.4;
        if (e.x < 50 || e.x > CANVAS_W - 50) e.dir = -e.dir;
      }
      const cdx = player.x - e.x, cdy = player.y - e.y;
      if (cdx * cdx + cdy * cdy < 14 * 14 && player.iframes === 0) {
        if (damage(state, 1)) {
          state.flags.gameover = true; SFX.gameover();
        } else {
          SFX.hit(); player.iframes = 50;
        }
      }
    }

    if (player.x > DOCK.x && player.x < DOCK.x + DOCK.w &&
        player.y > DOCK.y && player.y < DOCK.y + DOCK.h) {
      if (state.flags.met_oshus) { state.nextSceneId = 'sea'; SFX.sail(); }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Setup 3D                                                            */
  /* ------------------------------------------------------------------ */

  scene.setup3D = function setup3D(renderer3d) {
    scene._r3d  = renderer3d;
    const s     = renderer3d.scene;

    s.background = new THREE.Color(0x88b8e0);
    s.fog         = new THREE.Fog(0x88b8e0, 25, 60);

    scene._3dRoot = new THREE.Group();
    s.add(scene._3dRoot);

    /* Tilemap */
    const { group: tileGroup } = buildTileMap(MERCAY_MAP, scene._3dRoot, {
      floorColor: 0xe8d098,
      wallColor:  0x8a7860,
    });
    scene._tileGroup = tileGroup;

    /* Player */
    scene._playerMesh = createPlayerModel();
    scene._playerMesh.castShadow = true;
    scene._3dRoot.add(scene._playerMesh);

    /* NPC */
    scene._npcMeshes = {};
    for (const npc of NPCS) {
      const nm = createNPCModel(npc.id);
      nm.position.set(px2wx(npc.x), 0, px2wz(npc.y));
      scene._3dRoot.add(nm);
      scene._npcMeshes[npc.id] = nm;
    }

    /* Nemici */
    scene._enemyMeshEntries = [];
    for (const e of enemies) {
      const em = createEnemyModel(e.kind || 'chuchu');
      em.position.set(px2wx(e.x), 0, px2wz(e.y));
      scene._3dRoot.add(em);
      scene._enemyMeshEntries.push({ enemy: e, mesh: em });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sync mesh ogni frame                                                */
  /* ------------------------------------------------------------------ */

  scene.syncMeshes = function syncMeshes() {
    if (!scene._playerMesh) return;
    scene._playerMesh.position.set(px2wx(player.x), 0, px2wz(player.y));
    /* Bobbing durante attacco */
    if (player.attack) {
      scene._playerMesh.rotation.y = (player.attack.frame / ATTACK_FRAMES) * Math.PI * 2;
    }
    for (const { enemy, mesh } of scene._enemyMeshEntries) {
      if (enemy.hp <= 0) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.position.set(px2wx(enemy.x), 0, px2wz(enemy.y));
      /* Lampeggio durante iframes */
      if (enemy.iframes > 0) mesh.visible = Math.floor(enemy.iframes / 3) % 2 === 0;
    }
  };

  scene.render   = function render() {};
  scene.pullToast = function pullToast() { const tt = scene._toast; scene._toast = null; return tt; };
  scene.getDialog = function getDialog() { return scene.dialog; };

  scene.dispose = function dispose() {
    if (scene._3dRoot && scene._r3d) {
      scene._r3d.scene.remove(scene._3dRoot);
      disposeGroupGeometries(scene._3dRoot);
      scene._3dRoot = null;
    }
    if (scene._r3d) scene._r3d.scene.fog = null;
    scene._playerMesh = null;
    scene._npcMeshes  = {};
    scene._enemyMeshEntries = [];
  };

  return scene;
}

function makeDialog(speaker, text, onComplete) {
  return {
    speaker,
    lines: text.split('\n'),
    lineIdx: 0, charIdx: 0, completedAt: 0,
    onComplete,
  };
}
