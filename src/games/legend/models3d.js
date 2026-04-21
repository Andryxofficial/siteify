/**
 * Andryx Legend — Modelli 3D low-poly (Three.js).
 *
 * Tutti i modelli sono costruiti programmaticamente con primitive
 * geometriche di Three.js (BoxGeometry, ConeGeometry, CylinderGeometry,
 * SphereGeometry, OctahedronGeometry, ecc.) — niente asset esterni,
 * niente texture: pure forme + colori, stile "DAVVERO 3D" low-poly come
 * Link's Awakening Switch / Captain Toad.
 *
 * Geometrie e materiali sono CONDIVISI quando possibile per ridurre i
 * draw call. Ogni mesh viene comunque clonata (Group) per permettere
 * trasformazioni indipendenti.
 *
 * Convenzione assi:
 *   – X: est (destra del mondo)
 *   – Z: sud (basso del mondo, equivalente a +y nelle coord 2D)
 *   – Y: alto (verticale)
 *
 * 1 unità Three.js = 1 tile = 16 px logici dell'engine 2D originale.
 */
import * as THREE from 'three';
import { darkenColor } from './tiles.js';

/* ─── Cache geometrie/materiali ─────────────────────────────────────── */
const geomCache = new Map();
const matCache = new Map();

function geom(key, factory) {
  if (!geomCache.has(key)) geomCache.set(key, factory());
  return geomCache.get(key);
}
function mat(key, factory) {
  if (!matCache.has(key)) matCache.set(key, factory());
  return matCache.get(key);
}

function lambert(color, opts = {}) {
  /* Chiave cache: ordine chiavi deterministico per evitare cache miss
     tra `{a:1,b:2}` e `{b:2,a:1}`. */
  const sortedOpts = JSON.stringify(opts, Object.keys(opts).sort());
  const k = `lamb_${color.toString(16)}_${sortedOpts}`;
  return mat(k, () => new THREE.MeshLambertMaterial({ color, ...opts }));
}
function emissive(color, intensity = 1.0) {
  const k = `emi_${color.toString(16)}_${intensity}`;
  return mat(k, () => new THREE.MeshBasicMaterial({ color }));
}

/* ─── Tile / mondo ──────────────────────────────────────────────────── */

/** Crea un piano orizzontale (terra/sentiero/sabbia/lava/acqua). */
export function makeGroundTile(color) {
  const g = geom('plane_1', () => new THREE.PlaneGeometry(1, 1));
  const m = new THREE.Mesh(g, lambert(color));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0;
  return m;
}

/** Albero: tronco cilindrico + chioma conica. */
export function makeTree(trunkColor, foliageColor) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    geom('cyl_trunk', () => new THREE.CylinderGeometry(0.18, 0.22, 0.7, 6)),
    lambert(trunkColor),
  );
  trunk.position.y = 0.35;
  const cone1 = new THREE.Mesh(
    geom('cone_foliage_l', () => new THREE.ConeGeometry(0.55, 0.9, 6)),
    lambert(foliageColor),
  );
  cone1.position.y = 1.0;
  const cone2 = new THREE.Mesh(
    geom('cone_foliage_s', () => new THREE.ConeGeometry(0.4, 0.6, 6)),
    lambert(darkenColor(foliageColor, 0.18)),
  );
  cone2.position.y = 1.4;
  g.add(trunk, cone1, cone2);
  return g;
}

/** Roccia: icosaedro grezzo. */
export function makeStone(color) {
  const m = new THREE.Mesh(
    geom('icos_stone', () => new THREE.IcosahedronGeometry(0.4, 0)),
    lambert(color, { flatShading: true }),
  );
  m.position.y = 0.32;
  m.rotation.y = Math.random() * Math.PI;
  return m;
}

/** Muro generico (caverna/dungeon). */
export function makeWall(color) {
  const m = new THREE.Mesh(
    geom('box_wall', () => new THREE.BoxGeometry(1, 1.4, 1)),
    lambert(color, { flatShading: true }),
  );
  m.position.y = 0.7;
  return m;
}

/** Cespuglio: sfera schiacciata verde. */
export function makeBush(color) {
  const m = new THREE.Mesh(
    geom('sph_bush', () => new THREE.SphereGeometry(0.4, 8, 6)),
    lambert(color, { flatShading: true }),
  );
  m.scale.y = 0.7;
  m.position.y = 0.25;
  return m;
}

/** Vaso. */
export function makePot(color, accent) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geom('cyl_pot', () => new THREE.CylinderGeometry(0.28, 0.22, 0.5, 8)),
    lambert(color),
  );
  body.position.y = 0.25;
  g.add(body);
  if (accent) {
    const ring = new THREE.Mesh(
      geom('cyl_pot_ring', () => new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8)),
      lambert(accent),
    );
    ring.position.y = 0.42;
    g.add(ring);
  }
  return g;
}

/** Blocco spingibile. */
export function makeBlock(color) {
  const m = new THREE.Mesh(
    geom('box_block', () => new THREE.BoxGeometry(0.9, 0.9, 0.9)),
    lambert(color, { flatShading: true }),
  );
  m.position.y = 0.45;
  return m;
}

/** Piastra a pressione. */
export function makePlate(color, pressed) {
  const m = new THREE.Mesh(
    geom('box_plate', () => new THREE.BoxGeometry(0.85, 0.08, 0.85)),
    lambert(color),
  );
  m.position.y = pressed ? 0.02 : 0.06;
  return m;
}

/** Porta. */
export function makeDoor(color, open) {
  if (open) {
    const m = new THREE.Mesh(
      geom('plane_door', () => new THREE.PlaneGeometry(1, 1)),
      lambert(0x2a1a08),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    return m;
  }
  const m = new THREE.Mesh(
    geom('box_door', () => new THREE.BoxGeometry(1, 1.35, 0.2)),
    lambert(color),
  );
  m.position.y = 0.68;
  return m;
}

/** Torcia: palo + fiamma emissiva. */
export function makeTorch(lit, glow = 0xffaa30) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    geom('cyl_torch_pole', () => new THREE.CylinderGeometry(0.07, 0.09, 0.85, 6)),
    lambert(0x4a2812),
  );
  pole.position.y = 0.42;
  g.add(pole);
  if (lit) {
    const flame = new THREE.Mesh(
      geom('sph_flame', () => new THREE.SphereGeometry(0.18, 8, 6)),
      emissive(glow),
    );
    flame.position.y = 0.95;
    flame.userData.flame = true;
    g.add(flame);
    const point = new THREE.PointLight(glow, 1.0, 3.5, 1.5);
    point.position.y = 1.0;
    g.add(point);
  }
  return g;
}

/** Portale: anello viola luminoso che ruota. */
export function makePortal(glow) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    geom('cyl_portal_base', () => new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16)),
    lambert(0x2a0a3a),
  );
  base.position.y = 0.02;
  g.add(base);
  const ring = new THREE.Mesh(
    geom('torus_portal', () => new THREE.TorusGeometry(0.42, 0.08, 8, 16)),
    emissive(glow),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  ring.userData.portalRing = true;
  g.add(ring);
  return g;
}

/** Fontana: cilindro grigio con cilindro acqua sopra. */
export function makeFountain() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    geom('cyl_fount_base', () => new THREE.CylinderGeometry(0.5, 0.55, 0.45, 12)),
    lambert(0xa0a0a8, { flatShading: true }),
  );
  base.position.y = 0.22;
  const water = new THREE.Mesh(
    geom('cyl_fount_water', () => new THREE.CylinderGeometry(0.36, 0.36, 0.08, 12)),
    lambert(0x3a72c8),
  );
  water.position.y = 0.48;
  const spire = new THREE.Mesh(
    geom('cone_fount_spire', () => new THREE.ConeGeometry(0.08, 0.4, 6)),
    lambert(0x7ab4f0),
  );
  spire.position.y = 0.7;
  g.add(base, water, spire);
  return g;
}

/* Pezzi di casa modulari (3 colonne x 2 righe). */
function houseRoof(color, sub) {
  /* Tetto inclinato (prisma) — simulato con box ruotato. */
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    geom('box_roof_slab', () => new THREE.BoxGeometry(1.05, 0.5, 1.05)),
    lambert(color, { flatShading: true }),
  );
  slab.position.y = 1.4;
  g.add(slab);
  /* Linea di colmo gialla per distinguere il bordo del tetto */
  if (sub === 'roof_m') {
    const ridge = new THREE.Mesh(
      geom('box_roof_ridge', () => new THREE.BoxGeometry(1.05, 0.08, 0.18)),
      lambert(0xf0c850),
    );
    ridge.position.y = 1.7;
    g.add(ridge);
  }
  return g;
}
function houseWall(color, sub) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    geom('box_house_wall', () => new THREE.BoxGeometry(1.0, 1.0, 1.0)),
    lambert(color),
  );
  wall.position.y = 0.5;
  g.add(wall);
  if (sub === 'wall_window') {
    const win = new THREE.Mesh(
      geom('box_window', () => new THREE.BoxGeometry(0.4, 0.4, 0.06)),
      emissive(0x7ab4f0),
    );
    win.position.set(0, 0.55, 0.51);
    g.add(win);
  }
  return g;
}
function houseDoorClosed(color) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    geom('box_house_wall', () => new THREE.BoxGeometry(1.0, 1.0, 1.0)),
    lambert(0xfff5dd),
  );
  wall.position.y = 0.5;
  g.add(wall);
  const door = new THREE.Mesh(
    geom('box_house_door', () => new THREE.BoxGeometry(0.45, 0.75, 0.06)),
    lambert(color),
  );
  door.position.set(0, 0.4, 0.51);
  g.add(door);
  const knob = new THREE.Mesh(
    geom('sph_knob', () => new THREE.SphereGeometry(0.04, 6, 4)),
    emissive(0xf0c850),
  );
  knob.position.set(0.12, 0.4, 0.55);
  g.add(knob);
  return g;
}
function houseDoorOpen() {
  /* Soglia scura quasi a terra */
  const g = new THREE.Group();
  const sill = new THREE.Mesh(
    geom('plane_door_open', () => new THREE.PlaneGeometry(0.5, 0.2)),
    lambert(0x1a0a04),
  );
  sill.rotation.x = -Math.PI / 2;
  sill.position.y = 0.02;
  g.add(sill);
  return g;
}

/** Costruisce il pezzo di casa secondo il subKind. */
export function makeHousePiece(meta3d) {
  const sub = meta3d.subKind;
  if (sub && sub.startsWith('roof')) return houseRoof(meta3d.color, sub);
  if (sub === 'wall_l' || sub === 'wall_r' || sub === 'wall_window') return houseWall(meta3d.color, sub);
  if (sub === 'door_closed') return houseDoorClosed(meta3d.color);
  if (sub === 'door_open') return houseDoorOpen();
  if (sub === 'roof') return houseRoof(meta3d.color, 'roof_m');
  if (sub === 'door') return houseDoorClosed(meta3d.color);
  return houseWall(meta3d.color, 'wall_l');
}

/** Fiore: erba + 1 puntino colorato. */
export function makeFlower(groundColor, accent) {
  const g = new THREE.Group();
  const ground = makeGroundTile(groundColor);
  g.add(ground);
  const petal = new THREE.Mesh(
    geom('sph_petal', () => new THREE.SphereGeometry(0.08, 6, 4)),
    emissive(accent),
  );
  petal.position.set(0.18, 0.09, 0.12);
  g.add(petal);
  return g;
}

/* ─── Player (Andryx) ──────────────────────────────────────────────── */

export function makePlayer() {
  const g = new THREE.Group();
  /* Gambe verdi */
  const legL = new THREE.Mesh(
    geom('box_leg', () => new THREE.BoxGeometry(0.18, 0.28, 0.18)),
    lambert(0x266b26),
  );
  legL.position.set(-0.12, 0.14, 0);
  legL.userData.bodyPart = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.12;
  legR.userData.bodyPart = 'legR';
  /* Tunica verde */
  const torso = new THREE.Mesh(
    geom('box_torso', () => new THREE.BoxGeometry(0.42, 0.4, 0.28)),
    lambert(0x3a8c3a),
  );
  torso.position.y = 0.5;
  /* Cintura */
  const belt = new THREE.Mesh(
    geom('box_belt', () => new THREE.BoxGeometry(0.44, 0.06, 0.3)),
    lambert(0x4a2812),
  );
  belt.position.y = 0.32;
  /* Testa pelle */
  const head = new THREE.Mesh(
    geom('box_head', () => new THREE.BoxGeometry(0.36, 0.34, 0.34)),
    lambert(0xf7d4a3),
  );
  head.position.y = 0.85;
  /* Capelli scuri sopra */
  const hair = new THREE.Mesh(
    geom('box_hair', () => new THREE.BoxGeometry(0.4, 0.14, 0.36)),
    lambert(0x4a2812),
  );
  hair.position.y = 1.05;
  /* Cappello verde a punta (Link-style) */
  const hat = new THREE.Mesh(
    geom('cone_hat', () => new THREE.ConeGeometry(0.22, 0.38, 6)),
    lambert(0x266b26),
  );
  hat.position.y = 1.28;
  hat.rotation.x = -0.12;
  hat.rotation.z = 0.1;
  /* Naso piccolo */
  const nose = new THREE.Mesh(
    geom('box_nose', () => new THREE.BoxGeometry(0.05, 0.05, 0.05)),
    lambert(0xd6a373),
  );
  nose.position.set(0, 0.85, 0.18);
  /* Braccia */
  const armL = new THREE.Mesh(
    geom('box_arm', () => new THREE.BoxGeometry(0.14, 0.36, 0.16)),
    lambert(0x3a8c3a),
  );
  armL.position.set(-0.27, 0.5, 0);
  armL.userData.bodyPart = 'armL';
  const armR = armL.clone();
  armR.position.x = 0.27;
  armR.userData.bodyPart = 'armR';

  g.add(legL, legR, torso, belt, head, hair, hat, nose, armL, armR);
  g.userData.head = head;
  g.userData.hair = hair;
  g.userData.hat = hat;
  g.userData.armR = armR;
  return g;
}

/** Spada visualizzata durante l'attacco (mesh esposta dall'engine). */
export function makeSword() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    geom('box_blade', () => new THREE.BoxGeometry(0.08, 0.08, 0.7)),
    lambert(0xd0e0f0),
  );
  blade.position.z = 0.42;
  const guard = new THREE.Mesh(
    geom('box_guard', () => new THREE.BoxGeometry(0.32, 0.06, 0.08)),
    lambert(0xf0c850),
  );
  const hilt = new THREE.Mesh(
    geom('box_hilt', () => new THREE.BoxGeometry(0.08, 0.08, 0.18)),
    lambert(0x7a4a25),
  );
  hilt.position.z = -0.12;
  g.add(blade, guard, hilt);
  return g;
}

/* ─── Nemici ───────────────────────────────────────────────────────── */

export function makeSlime() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geom('sph_slime', () => new THREE.SphereGeometry(0.32, 10, 8)),
    lambert(0x88c870, { transparent: true, opacity: 0.9 }),
  );
  body.scale.y = 0.7;
  body.position.y = 0.22;
  body.userData.bodyPart = 'slimeBody';
  const eyeL = new THREE.Mesh(
    geom('sph_eye', () => new THREE.SphereGeometry(0.04, 6, 4)),
    lambert(0x1a1a2e),
  );
  eyeL.position.set(-0.08, 0.32, 0.22);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  g.add(body, eyeL, eyeR);
  return g;
}

export function makeBat() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geom('sph_bat_body', () => new THREE.SphereGeometry(0.18, 8, 6)),
    lambert(0x4a2812),
  );
  body.position.y = 0.6;
  const wingL = new THREE.Mesh(
    geom('box_wing', () => new THREE.BoxGeometry(0.36, 0.04, 0.22)),
    lambert(0x4a2812),
  );
  wingL.position.set(-0.22, 0.62, 0);
  wingL.userData.bodyPart = 'wingL';
  const wingR = wingL.clone();
  wingR.position.x = 0.22;
  wingR.userData.bodyPart = 'wingR';
  /* Occhietti rossi */
  const eyeL = new THREE.Mesh(
    geom('sph_eye_red', () => new THREE.SphereGeometry(0.03, 6, 4)),
    emissive(0xff3030),
  );
  eyeL.position.set(-0.06, 0.62, 0.18);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.06;
  g.add(body, wingL, wingR, eyeL, eyeR);
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  return g;
}

export function makeSkeleton() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    geom('box_skel_torso', () => new THREE.BoxGeometry(0.32, 0.42, 0.2)),
    lambert(0xf0f0f0),
  );
  torso.position.y = 0.5;
  const head = new THREE.Mesh(
    geom('box_skel_head', () => new THREE.BoxGeometry(0.3, 0.3, 0.28)),
    lambert(0xfff5dd),
  );
  head.position.y = 0.86;
  const eyeL = new THREE.Mesh(
    geom('box_skel_eye', () => new THREE.BoxGeometry(0.06, 0.06, 0.04)),
    emissive(0xff5030),
  );
  eyeL.position.set(-0.07, 0.88, 0.16);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  const legL = new THREE.Mesh(
    geom('box_skel_leg', () => new THREE.BoxGeometry(0.1, 0.28, 0.1)),
    lambert(0xf0f0f0),
  );
  legL.position.set(-0.08, 0.14, 0);
  const legR = legL.clone();
  legR.position.x = 0.08;
  g.add(torso, head, eyeL, eyeR, legL, legR);
  return g;
}

export function makeMage() {
  const g = new THREE.Group();
  /* Lunga veste viola: cono */
  const robe = new THREE.Mesh(
    geom('cone_mage_robe', () => new THREE.ConeGeometry(0.36, 1.0, 8)),
    lambert(0x4a1f60),
  );
  robe.position.y = 0.5;
  const hat = new THREE.Mesh(
    geom('cone_mage_hat', () => new THREE.ConeGeometry(0.22, 0.5, 8)),
    lambert(0x7a3aa0),
  );
  hat.position.y = 1.15;
  /* Faccia scura */
  const face = new THREE.Mesh(
    geom('box_mage_face', () => new THREE.BoxGeometry(0.22, 0.18, 0.04)),
    lambert(0x1a1a2e),
  );
  face.position.set(0, 0.85, 0.2);
  /* Occhi gialli */
  const eyeL = new THREE.Mesh(
    geom('sph_eye_yellow', () => new THREE.SphereGeometry(0.03, 6, 4)),
    emissive(0xffe060),
  );
  eyeL.position.set(-0.05, 0.86, 0.22);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.05;
  g.add(robe, hat, face, eyeL, eyeR);
  return g;
}

/* ─── Bosses ───────────────────────────────────────────────────────── */

export function makeGuardian() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geom('box_guardian_body', () => new THREE.BoxGeometry(0.9, 0.8, 0.6)),
    lambert(0x6a6a78, { flatShading: true }),
  );
  body.position.y = 0.6;
  const head = new THREE.Mesh(
    geom('box_guardian_head', () => new THREE.BoxGeometry(0.6, 0.5, 0.5)),
    lambert(0x888888, { flatShading: true }),
  );
  head.position.y = 1.25;
  const core = new THREE.Mesh(
    geom('sph_guardian_core', () => new THREE.SphereGeometry(0.14, 8, 6)),
    emissive(0xff5030),
  );
  core.position.set(0, 1.25, 0.26);
  const armL = new THREE.Mesh(
    geom('box_guardian_arm', () => new THREE.BoxGeometry(0.28, 0.7, 0.3)),
    lambert(0x6a6a78),
  );
  armL.position.set(-0.65, 0.6, 0);
  const armR = armL.clone();
  armR.position.x = 0.65;
  g.add(body, head, core, armL, armR);
  return g;
}

export function makeShadowKing() {
  const g = new THREE.Group();
  /* Veste nera lunga */
  const robe = new THREE.Mesh(
    geom('cone_king_robe', () => new THREE.ConeGeometry(0.55, 1.6, 8)),
    lambert(0x1a0a20),
  );
  robe.position.y = 0.8;
  /* Cappuccio */
  const hood = new THREE.Mesh(
    geom('sph_king_hood', () => new THREE.SphereGeometry(0.36, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
    lambert(0x1a0a20),
  );
  hood.position.y = 1.55;
  hood.rotation.x = Math.PI;
  /* Corona rossa */
  const crown = new THREE.Mesh(
    geom('cyl_crown', () => new THREE.CylinderGeometry(0.32, 0.32, 0.12, 8)),
    emissive(0xb01818),
  );
  crown.position.y = 1.65;
  /* Occhi rossi */
  const eyeL = new THREE.Mesh(
    geom('sph_king_eye', () => new THREE.SphereGeometry(0.05, 6, 4)),
    emissive(0xff3030),
  );
  eyeL.position.set(-0.1, 1.5, 0.32);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  g.add(robe, hood, crown, eyeL, eyeR);
  return g;
}

/* ─── NPCs ─────────────────────────────────────────────────────────── */

export function makeKing() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(
    geom('cone_npc_robe', () => new THREE.ConeGeometry(0.34, 0.9, 8)),
    lambert(0x7a3aa0),
  );
  robe.position.y = 0.45;
  const head = new THREE.Mesh(
    geom('box_npc_head', () => new THREE.BoxGeometry(0.32, 0.32, 0.32)),
    lambert(0xf7d4a3),
  );
  head.position.y = 1.05;
  const beard = new THREE.Mesh(
    geom('box_beard', () => new THREE.BoxGeometry(0.28, 0.22, 0.08)),
    lambert(0xfff5dd),
  );
  beard.position.set(0, 0.92, 0.18);
  const crown = new THREE.Mesh(
    geom('cyl_npc_crown', () => new THREE.CylinderGeometry(0.18, 0.18, 0.1, 6)),
    emissive(0xf0c850),
  );
  crown.position.y = 1.26;
  g.add(robe, head, beard, crown);
  return g;
}

export function makeElder() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(
    geom('cone_elder_robe', () => new THREE.ConeGeometry(0.32, 0.85, 8)),
    lambert(0x7a4a25),
  );
  robe.position.y = 0.42;
  const head = new THREE.Mesh(
    geom('box_npc_head', () => new THREE.BoxGeometry(0.32, 0.32, 0.32)),
    lambert(0xf7d4a3),
  );
  head.position.y = 1.0;
  const beard = new THREE.Mesh(
    geom('box_beard_long', () => new THREE.BoxGeometry(0.3, 0.4, 0.08)),
    lambert(0xcccccc),
  );
  beard.position.set(0, 0.78, 0.18);
  g.add(robe, head, beard);
  return g;
}

export function makeMerchant() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    geom('box_merchant_torso', () => new THREE.BoxGeometry(0.4, 0.5, 0.28)),
    lambert(0x3a72c8),
  );
  torso.position.y = 0.55;
  const head = new THREE.Mesh(
    geom('box_npc_head', () => new THREE.BoxGeometry(0.32, 0.32, 0.32)),
    lambert(0xf7d4a3),
  );
  head.position.y = 1.0;
  const hair = new THREE.Mesh(
    geom('box_hair_short', () => new THREE.BoxGeometry(0.34, 0.1, 0.34)),
    lambert(0x4a2812),
  );
  hair.position.y = 1.18;
  g.add(torso, head, hair);
  return g;
}

export function makeChild() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    geom('box_child_torso', () => new THREE.BoxGeometry(0.3, 0.32, 0.22)),
    lambert(0xff7a7a),
  );
  torso.position.y = 0.36;
  const head = new THREE.Mesh(
    geom('box_child_head', () => new THREE.BoxGeometry(0.28, 0.28, 0.28)),
    lambert(0xf7d4a3),
  );
  head.position.y = 0.7;
  const hair = new THREE.Mesh(
    geom('box_hair_short', () => new THREE.BoxGeometry(0.3, 0.08, 0.3)),
    lambert(0xf0c850),
  );
  hair.position.y = 0.86;
  g.add(torso, head, hair);
  return g;
}

/* ─── Items ────────────────────────────────────────────────────────── */

export function makeHeart(big = false) {
  const r = big ? 0.32 : 0.2;
  const g = new THREE.Group();
  const lobeL = new THREE.Mesh(
    geom(`sph_heart_${big}`, () => new THREE.SphereGeometry(r, 8, 6)),
    emissive(0xd23a3a),
  );
  lobeL.position.set(-r * 0.5, 0, 0);
  const lobeR = lobeL.clone();
  lobeR.position.x = r * 0.5;
  const tip = new THREE.Mesh(
    geom(`cone_heart_tip_${big}`, () => new THREE.ConeGeometry(r, r * 1.2, 6)),
    emissive(0xd23a3a),
  );
  tip.position.y = -r * 0.9;
  tip.rotation.x = Math.PI;
  g.add(lobeL, lobeR, tip);
  g.position.y = 0.4;
  return g;
}

export function makeRupee() {
  const m = new THREE.Mesh(
    geom('octa_rupee', () => new THREE.OctahedronGeometry(0.2, 0)),
    emissive(0x3a8c3a),
  );
  m.scale.y = 1.4;
  m.position.y = 0.4;
  return m;
}

export function makeKey(big = false) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    geom('torus_key', () => new THREE.TorusGeometry(0.12, 0.04, 6, 12)),
    emissive(0xf0c850),
  );
  ring.rotation.x = Math.PI / 2;
  const shaft = new THREE.Mesh(
    geom('box_key_shaft', () => new THREE.BoxGeometry(0.06, 0.06, 0.24)),
    emissive(0xf0c850),
  );
  shaft.position.z = 0.18;
  const teeth = new THREE.Mesh(
    geom('box_key_teeth', () => new THREE.BoxGeometry(0.14, 0.06, 0.06)),
    emissive(0xf0c850),
  );
  teeth.position.set(0.05, 0, 0.28);
  g.add(ring, shaft, teeth);
  if (big) g.scale.setScalar(1.3);
  g.position.y = 0.4;
  return g;
}

export function makeBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    geom('sph_bomb', () => new THREE.SphereGeometry(0.2, 8, 6)),
    lambert(0x1a1a2e),
  );
  body.position.y = 0.2;
  const fuse = new THREE.Mesh(
    geom('cyl_fuse', () => new THREE.CylinderGeometry(0.02, 0.02, 0.12, 4)),
    lambert(0xf0c850),
  );
  fuse.position.y = 0.42;
  g.add(body, fuse);
  return g;
}

export function makePotion() {
  const g = new THREE.Group();
  const bottle = new THREE.Mesh(
    geom('cyl_potion', () => new THREE.CylinderGeometry(0.13, 0.15, 0.32, 8)),
    lambert(0x7ab4f0, { transparent: true, opacity: 0.8 }),
  );
  bottle.position.y = 0.2;
  const cork = new THREE.Mesh(
    geom('cyl_cork', () => new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6)),
    lambert(0x7a4a25),
  );
  cork.position.y = 0.4;
  g.add(bottle, cork);
  return g;
}

export function makeSwordItem() {
  const g = makeSword();
  g.rotation.x = -Math.PI / 4;
  g.position.y = 0.5;
  return g;
}

export function makeShield() {
  const m = new THREE.Mesh(
    geom('cyl_shield', () => new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12)),
    lambert(0x3a72c8),
  );
  m.rotation.z = Math.PI / 2;
  m.position.y = 0.3;
  const cross = new THREE.Mesh(
    geom('box_shield_cross', () => new THREE.BoxGeometry(0.12, 0.04, 0.12)),
    emissive(0xf0c850),
  );
  cross.position.set(0.04, 0.3, 0);
  const g = new THREE.Group();
  g.add(m, cross);
  return g;
}

export function makeCrystal(color, glow) {
  const m = new THREE.Mesh(
    geom('octa_crystal', () => new THREE.OctahedronGeometry(0.28, 0)),
    emissive(glow || color),
  );
  m.scale.y = 1.6;
  m.position.y = 0.5;
  return m;
}

/* Indica un cartello: paletto + tavola. */
export function makeSign() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    geom('cyl_sign_pole', () => new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4)),
    lambert(0x4a2812),
  );
  pole.position.y = 0.25;
  const board = new THREE.Mesh(
    geom('box_sign_board', () => new THREE.BoxGeometry(0.45, 0.3, 0.05)),
    lambert(0x7a4a25),
  );
  board.position.y = 0.55;
  g.add(pole, board);
  return g;
}

/* ─── Selettori comodi ─────────────────────────────────────────────── */

export function makeEnemyByKind(kind) {
  switch (kind) {
    case 'slime': return makeSlime();
    case 'bat': return makeBat();
    case 'skeleton': return makeSkeleton();
    case 'mage': return makeMage();
    default: return makeSlime();
  }
}

export function makeBossByKind(kind) {
  if (kind === 'shadow_king') return makeShadowKing();
  return makeGuardian();
}

export function makeNpcByKind(kind) {
  switch (kind) {
    case 'king': return makeKing();
    case 'elder': return makeElder();
    case 'merchant': return makeMerchant();
    case 'child': return makeChild();
    default: return makeMerchant();
  }
}

export function makeItemByKind(kind) {
  switch (kind) {
    case 'heart': return makeHeart(false);
    case 'heart_container': return makeHeart(true);
    case 'rupee': return makeRupee();
    case 'key': return makeKey(false);
    case 'house_key': return makeKey(true);
    case 'bomb': return makeBomb();
    case 'potion': return makePotion();
    case 'sword': return makeSwordItem();
    case 'shield': return makeShield();
    case 'crystal_green': return makeCrystal(0x3a8c3a, 0x88ff88);
    case 'crystal_blue': return makeCrystal(0x3a72c8, 0x88c8ff);
    case 'crystal_red': return makeCrystal(0xd23a3a, 0xff8888);
    default: return makeRupee();
  }
}

/** Libera tutte le risorse GPU condivise (chiamare a scaricamento del modulo). */
export function disposeShared() {
  for (const g of geomCache.values()) g.dispose?.();
  for (const m of matCache.values()) m.dispose?.();
  geomCache.clear();
  matCache.clear();
}
