/**
 * Andryx Hourglass — Factory 3D models (Three.js, tutto procedurale).
 *
 * Tutti i modelli sono costruiti con primitive Three.js.
 * I materiali MeshToonMaterial sono condivisi tramite cache per performance.
 * Le geometrie NON sono in cache (ogni chiamata crea nuova istanza).
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Coordinate helpers (pixel → world)                                 */
/* ------------------------------------------------------------------ */

/** Converte coordinata X pixel (0-480) in coordinata X mondo Three.js. */
export function px2wx(px) { return (px - 240) / 20; }
/** Converte coordinata Y pixel (0-480) in coordinata Z mondo Three.js. */
export function px2wz(py) { return (py - 240) / 20; }

/** Dimensione tile in world units: 32px / 20 = 1.6 */
export const TILE_3D = 32 / 20;

/* ------------------------------------------------------------------ */
/* Cache materiali                                                     */
/* ------------------------------------------------------------------ */

const matCache = new Map();

function mat(color, emissive = 0x000000, emissiveIntensity = 0) {
  const key = `${color}_${emissive}_${emissiveIntensity}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity });
  matCache.set(key, m);
  return m;
}

/** Libera tutti i materiali in cache (da chiamare a fine partita). */
export function disposeMaterials() {
  matCache.forEach(m => m.dispose());
  matCache.clear();
}

/* ------------------------------------------------------------------ */
/* Player — Andryx con cappello a punta verde                         */
/* ------------------------------------------------------------------ */

export function createPlayerModel() {
  const g = new THREE.Group();
  /* Corpo (cappotto blu) */
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.4), mat(0x3070b8));
  body.position.y = 0.5; body.castShadow = true;
  /* Testa */
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), mat(0xf4d0a8));
  head.position.y = 1.25; head.castShadow = true;
  /* Cappello conico verde */
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.65, 4), mat(0x388040));
  hat.position.y = 1.78; hat.castShadow = true;
  /* Braccia */
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(0x3070b8));
  armL.position.set(-0.42, 0.52, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  /* Gambe */
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), mat(0x1a3060));
  legL.position.set(-0.18, 0.05, 0);
  const legR = legL.clone(); legR.position.x = 0.18;
  g.add(body, head, hat, armL, armR, legL, legR);
  return g;
}

/* ------------------------------------------------------------------ */
/* Phantom — armatura grigia con lanterna                             */
/* ------------------------------------------------------------------ */

export function createPhantomModel(type) {
  const g = new THREE.Group();
  const bodyColor = type === 'alert' ? 0xb04040 : 0x9090b0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.55), mat(bodyColor));
  body.position.y = 0.7; body.castShadow = true;
  const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.42, 8), mat(0x606070));
  helmet.position.y = 1.55;
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat(0xffd060, 0xffcc00, 0.8));
  lantern.position.set(0.5, 0.8, 0);
  g.add(body, helmet, lantern);
  return g;
}

/* ------------------------------------------------------------------ */
/* Nemici generici                                                     */
/* ------------------------------------------------------------------ */

export function createEnemyModel(kind) {
  const g = new THREE.Group();
  if (kind === 'chuchu') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), mat(0x40b840));
    body.scale.y = 0.75; body.position.y = 0.35; body.castShadow = true;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(0xffffff));
    eyeL.position.set(-0.18, 0.55, 0.35);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), mat(0x202020));
    pupilL.position.set(-0.18, 0.55, 0.42);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.18;
    const pupilR = pupilL.clone(); pupilR.position.x = 0.18;
    g.add(body, eyeL, pupilL, eyeR, pupilR);
  } else if (kind === 'slime') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0x6060e0));
    body.scale.y = 0.7; body.position.y = 0.3; body.castShadow = true;
    g.add(body);
  } else if (kind === 'bat') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), mat(0x3a2060));
    body.position.y = 0.7;
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.3), mat(0x3a2060));
    wingL.position.set(-0.5, 0.7, 0);
    const wingR = wingL.clone(); wingR.position.x = 0.5;
    g.add(body, wingL, wingR);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), mat(0xc04040));
    body.position.y = 0.35; body.castShadow = true;
    g.add(body);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Boss — Chuchu Re Gigante                                           */
/* ------------------------------------------------------------------ */

export function createBossModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), mat(0x40a040));
  body.scale.y = 0.8; body.position.y = 1.0; body.castShadow = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.5, 6), mat(0xf0c040));
  crown.position.y = 2.0;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), mat(0xffffff));
  eyeL.position.set(-0.45, 1.2, 1.0);
  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 3), mat(0x101010));
  pupilL.position.set(-0.45, 1.2, 1.15);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.45;
  const pupilR = pupilL.clone(); pupilR.position.x = 0.45;
  g.add(body, crown, eyeL, pupilL, eyeR, pupilR);
  return g;
}

/* ------------------------------------------------------------------ */
/* NPC                                                                 */
/* ------------------------------------------------------------------ */

export function createNPCModel(id) {
  const g = new THREE.Group();
  if (id === 'oshus') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.4), mat(0x8060a0));
    body.position.y = 0.48;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.45, 0.45), mat(0xf4d0a8));
    head.position.y = 1.2;
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.15), mat(0xe8e8e8));
    beard.position.set(0, 0.92, 0.2);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), mat(0x6a4830));
    staff.position.set(0.5, 0.75, 0);
    g.add(body, head, beard, staff);
  } else if (id === 'linebeck') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.4), mat(0x8a5030));
    body.position.y = 0.48;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), mat(0xd4a888));
    head.position.y = 1.2;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.35, 8), mat(0x3a2010));
    hat.position.y = 1.58;
    g.add(body, head, hat);
  } else {
    /* Negoziante generico */
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.4), mat(0xa06030));
    body.position.y = 0.48;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), mat(0xf4d0a8));
    head.position.y = 1.2;
    g.add(body, head);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Barca S.S. Pixel                                                   */
/* ------------------------------------------------------------------ */

export function createShipModel() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.8), mat(0x8a5030));
  hull.position.y = 0.25; hull.castShadow = true;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), mat(0x6a4020));
  mast.position.y = 1.5;
  const sail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.05), mat(0xf0e0c0));
  sail.position.y = 1.8;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.04), mat(0xd03030));
  flag.position.set(0.35, 2.85, 0);
  g.add(hull, mast, sail, flag);
  return g;
}

/* ------------------------------------------------------------------ */
/* Isola                                                               */
/* ------------------------------------------------------------------ */

export function createIslandModel(id) {
  const g = new THREE.Group();
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.3, 12), mat(0xe8d098));
  beach.receiveShadow = true;
  const land  = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.4, 12), mat(id === 'fire' ? 0xb84020 : 0x4a8030));
  land.position.y = 0.35; land.receiveShadow = true;
  if (id !== 'fire') {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), mat(0x6a4830));
      trunk.position.set(Math.cos(angle) * 1.1, 0.85, Math.sin(angle) * 1.1);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 7), mat(0x305020));
      foliage.position.set(Math.cos(angle) * 1.1, 1.6, Math.sin(angle) * 1.1);
      g.add(trunk, foliage);
    }
  }
  g.add(beach, land);
  return g;
}

/* ------------------------------------------------------------------ */
/* Chest (scrigno)                                                    */
/* ------------------------------------------------------------------ */

export function createChestModel(opened) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), mat(0x8a5030));
  base.position.y = 0.2;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.5), mat(0xc08040));
  lid.position.y = opened ? 0.7 : 0.5;
  if (opened) lid.rotation.x = -Math.PI / 3;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), mat(0xf0c040));
  lock.position.set(0, 0.42, 0.26);
  g.add(base, lid, lock);
  return g;
}

/* ------------------------------------------------------------------ */
/* Interruttore / pulsante dungeon                                     */
/* ------------------------------------------------------------------ */

export function createSwitchModel(on) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 8), mat(0x606070));
  base.position.y = 0.1;
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.15, 8),
    mat(on ? 0x40c040 : 0xc04040, on ? 0x40c040 : 0xc04040, on ? 0.5 : 0.2),
  );
  button.position.y = on ? 0.18 : 0.25;
  g.add(base, button);
  return g;
}

/* ------------------------------------------------------------------ */
/* Tile primitivi                                                      */
/* ------------------------------------------------------------------ */

/** Tile pavimento (flat). */
export function createTileFloor(color) {
  const c = color !== undefined ? color : 0xd8c890;
  const geo = new THREE.BoxGeometry(TILE_3D - 0.04, 0.3, TILE_3D - 0.04);
  return new THREE.Mesh(geo, mat(c));
}

/** Tile muro (cubo). */
export function createTileWall(color) {
  const c = color !== undefined ? color : 0x8a7860;
  const geo = new THREE.BoxGeometry(TILE_3D, TILE_3D, TILE_3D);
  return new THREE.Mesh(geo, mat(c));
}

/** Zona sicura (safe zone — verde luminosa). */
export function createSafeZoneTile() {
  const geo = new THREE.BoxGeometry(TILE_3D - 0.04, 0.32, TILE_3D - 0.04);
  return new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    color: 0x80f0a0, emissive: 0x40c070, emissiveIntensity: 0.4,
  }));
}

/** Tile lava (emissiva arancio). */
export function createLavaTile() {
  const geo = new THREE.BoxGeometry(TILE_3D - 0.04, 0.28, TILE_3D - 0.04);
  return new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    color: 0xff6010, emissive: 0xff4000, emissiveIntensity: 0.6,
  }));
}

/* ------------------------------------------------------------------ */
/* Oggetti raccoglibili / entità                                       */
/* ------------------------------------------------------------------ */

/** Proiettile (piccola sfera). */
export function createProjectileModel(color) {
  const c = color !== undefined ? color : 0xff4040;
  const geo = new THREE.SphereGeometry(0.18, 6, 4);
  return new THREE.Mesh(geo, mat(c, c, 0.4));
}

/** Cuore raccoglibile. */
export function createHeartModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mat(0xff2040, 0xff2040, 0.3));
  body.position.y = 0.4;
  g.add(body);
  return g;
}

/** Rupee (diamante ottaedro). */
export function createRupeeModel() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), mat(0x40d080, 0x40d080, 0.4));
  gem.position.y = 0.45;
  g.add(gem);
  return g;
}

/** Chiave. */
export function createKeyModel() {
  const g = new THREE.Group();
  const ring  = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 12), mat(0xf0c040));
  ring.position.y = 0.6; ring.rotation.x = Math.PI / 2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), mat(0xf0c040));
  shaft.position.y = 0.3;
  g.add(ring, shaft);
  return g;
}

/** Boomerang (disco piatto dorato). */
export function createBoomerangModel() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 12), mat(0xf0c040, 0xf0c040, 0.3));
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  return g;
}

/* ------------------------------------------------------------------ */
/* Helper: dispose geometry ricorsivo (NON dispone i materiali cache) */
/* ------------------------------------------------------------------ */

export function disposeGroupGeometries(group) {
  if (!group) return;
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    /* I materiali dalla cache matCache non vanno disposti qui */
  });
}
