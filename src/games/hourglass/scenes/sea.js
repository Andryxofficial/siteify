/**
 * Andryx Hourglass — Scena MARE (versione 3D).
 *
 * La logica di gioco (update) rimane invariata.
 * setup3D costruisce la scena Three.js; syncMeshes aggiorna le posizioni ogni frame.
 * render() è un no-op: il Renderer3D gestisce tutto il rendering.
 */
import * as THREE from 'three';
import { C } from '../palette.js';
import { SFX, playMusic } from '../audio.js';
import { CANVAS_W, CANVAS_H } from '../renderer3d.js';
import { createShipModel, createIslandModel, px2wx, px2wz, disposeGroupGeometries } from '../models3d.js';

const SHIP_SPEED       = 1.4;
const ISLAND_RADIUS    = 18;
const ISLAND_ENTER_DIST = 16;

const ISLANDS = [
  { id: 'mercay', x: 120, y: 300, name: 'Mercay', color: C.sand,  icon: '\ud83c\udfd9\ufe0f' },
  { id: 'fire',   x: 360, y: 200, name: 'Fuoco',  color: C.red,   icon: '\ud83d\udd25' },
  { id: 'temple', x: 240, y:  90, name: 'Tempio', color: C.gold,  icon: '\u231b' },
];

/* helper: distanza tra un punto e un'isola */
function distToIsland(sx, sy, isl) {
  const dx = sx - isl.x, dy = sy - isl.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createSeaScene(state) {
  if (!state.sea) {
    state.sea = {
      shipX: 120, shipY: 300, shipDir: 0,
      currentIslandId: 'mercay',
      islandsUnlocked: { mercay: true, temple: false, fire: false },
    };
  }

  const cur    = state.sea.currentIslandId;
  const fromIs = ISLANDS.find(i => i.id === cur);
  if (fromIs) {
    state.sea.shipX  = fromIs.x;
    state.sea.shipY  = fromIs.y + ISLAND_RADIUS + 14;
    state.sea.shipDir = -Math.PI / 2;
  }

  if (state.flags.met_oshus)   state.sea.islandsUnlocked.temple = true;
  if (state.items.sword)       state.sea.islandsUnlocked.fire   = true;

  let _waveT = 0;

  const scene = {
    id: 'sea',
    dialog: null,
    _toast: null,
    _nearIsland: null,
    _blockedShown: 0,
    /* Riferimenti 3D — popolati in setup3D */
    _3dRoot: null,
    _shipMesh: null,
    _seaMeshes: null,
    _islandMeshes: {},
    _r3d: null,
  };

  /* ------------------------------------------------------------------ */
  /* Logica di gioco (invariata)                                         */
  /* ------------------------------------------------------------------ */

  scene.update = function update(input) {
    _waveT += 0.05;
    const { dx, dy } = input.move();
    if (dx || dy) {
      const m  = Math.sqrt(dx * dx + dy * dy) || 1;
      const vx = (dx / m) * SHIP_SPEED;
      const vy = (dy / m) * SHIP_SPEED;
      state.sea.shipX = Math.max(20, Math.min(CANVAS_W - 20, state.sea.shipX + vx));
      state.sea.shipY = Math.max(36, Math.min(CANVAS_H - 20, state.sea.shipY + vy));
      state.sea.shipDir = Math.atan2(dy, dx);
    }

    let nearestIsland = null, nearestDist = Infinity;
    for (const isl of ISLANDS) {
      const d = distToIsland(state.sea.shipX, state.sea.shipY, isl);
      if (d < nearestDist) { nearestDist = d; nearestIsland = isl; }
    }
    scene._nearIsland = (nearestIsland && nearestDist < ISLAND_RADIUS + 18) ? nearestIsland : null;

    if (nearestIsland && nearestDist < ISLAND_ENTER_DIST) {
      if (state.sea.islandsUnlocked[nearestIsland.id]) {
        state.sea.currentIslandId = nearestIsland.id;
        state.nextSceneId = nearestIsland.id;
        SFX.door();
      } else {
        const bx = state.sea.shipX - nearestIsland.x, by = state.sea.shipY - nearestIsland.y;
        const bm = Math.sqrt(bx * bx + by * by) || 1;
        state.sea.shipX = nearestIsland.x + (bx / bm) * (ISLAND_ENTER_DIST + 2);
        state.sea.shipY = nearestIsland.y + (by / bm) * (ISLAND_ENTER_DIST + 2);
        if (!scene._blockedShown) {
          scene._toast = '\ud83d\udd12 Isola non ancora accessibile';
          scene._blockedShown = 30;
        }
      }
    }
    if (scene._blockedShown > 0) scene._blockedShown--;

    if (input.isAction() && scene._nearIsland && nearestDist < ISLAND_RADIUS + 12) {
      if (state.sea.islandsUnlocked[scene._nearIsland.id]) {
        state.sea.currentIslandId = scene._nearIsland.id;
        state.nextSceneId = scene._nearIsland.id;
        SFX.door();
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Setup 3D (chiamato una volta dopo il caricamento della scena)      */
  /* ------------------------------------------------------------------ */

  scene.setup3D = function setup3D(renderer3d) {
    scene._r3d = renderer3d;
    const s    = renderer3d.scene;

    s.background = new THREE.Color(0x1a4080);
    s.fog         = new THREE.Fog(0x1a4080, 30, 80);

    /* Radice per cleanup */
    scene._3dRoot = new THREE.Group();
    s.add(scene._3dRoot);

    /* Pavimento mare */
    scene._seaMeshes = buildSeaFloorInGroup(scene._3dRoot);

    /* Barca */
    scene._shipMesh = createShipModel();
    scene._3dRoot.add(scene._shipMesh);

    /* Isole */
    scene._islandMeshes = {};
    for (const isl of ISLANDS) {
      const im = createIslandModel(isl.id);
      im.position.set(px2wx(isl.x), 0, px2wz(isl.y));
      scene._3dRoot.add(im);
      scene._islandMeshes[isl.id] = im;
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sincronizzazione mesh ogni frame                                    */
  /* ------------------------------------------------------------------ */

  scene.syncMeshes = function syncMeshes() {
    if (!scene._shipMesh) return;
    const sx = px2wx(state.sea.shipX);
    const sz = px2wz(state.sea.shipY);
    /* Oscillazione ondosa */
    const bob = Math.sin(Date.now() * 0.002) * 0.05;
    scene._shipMesh.position.set(sx, 0.25 + bob, sz);
    scene._shipMesh.rotation.y = -(state.sea.shipDir || 0) + Math.PI / 2;

    /* Opacità isole bloccate (tramite materiale — usa traverse per semplicità) */
    for (const isl of ISLANDS) {
      const im = scene._islandMeshes[isl.id];
      if (!im) continue;
      const unlocked = state.sea.islandsUnlocked[isl.id];
      im.traverse(obj => {
        if (obj.isMesh && obj.material) {
          obj.material.opacity      = unlocked ? 1 : 0.45;
          obj.material.transparent  = !unlocked;
        }
      });
    }
  };

  /* render() è un no-op: il Renderer3D gestisce il rendering */
  scene.render = function render() {};

  scene.pullToast = function pullToast() { const t = scene._toast; scene._toast = null; return t; };
  scene.getDialog = function getDialog() { return null; };

  scene.dispose = function dispose() {
    if (scene._3dRoot && scene._r3d) {
      scene._r3d.scene.remove(scene._3dRoot);
      disposeGroupGeometries(scene._3dRoot);
      scene._3dRoot = null;
    }
    scene._shipMesh    = null;
    scene._seaMeshes   = null;
    scene._islandMeshes = {};
    /* Rimuovi fog e background dalla scena Three.js */
    if (scene._r3d) {
      scene._r3d.scene.fog = null;
    }
  };

  playMusic('sea');
  return scene;
}

/**
 * Helper: crea pavimento del mare nel gruppo specificato.
 * Wrapper locale di buildSeaFloor per passare un parentGroup invece della scena.
 */
function buildSeaFloorInGroup(parentGroup) {
  const seaMat = new THREE.MeshToonMaterial({ color: 0x3070b8 });
  const sea    = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 20, 20), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  parentGroup.add(sea);

  const shallowMat = new THREE.MeshToonMaterial({ color: 0x4090d0, transparent: true, opacity: 0.3 });
  const shallow    = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), shallowMat);
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y  = 0.05;
  parentGroup.add(shallow);

  return { sea, shallow };
}
