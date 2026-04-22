/**
 * Andryx Hourglass — World utilities: costruzione tilemap 3D e helpers.
 *
 * buildTileMap usa InstancedMesh per pavimenti e muri (molte istanze,
 * un solo draw call per tipo) e mesh individuali per tile speciali.
 */
import * as THREE from 'three';
import {
  createSafeZoneTile,
  createLavaTile,
  TILE_3D,
  px2wx,
  px2wz,
} from './models3d.js';

export const TILE = 32;

/**
 * Costruisce la geometria 3D da una tilemap (array di stringhe).
 * Restituisce { group, floorInst, wallInst, specialMeshes }.
 *
 * Tile types riconosciuti:
 *  '#'           → muro
 *  's'           → safe zone (mesh individuale emissiva)
 *  'L'           → lava (mesh individuale emissiva)
 *  qualsiasi altro carattere non vuoto → pavimento
 */
export function buildTileMap(mapLines, threeScene, opts = {}) {
  const group      = new THREE.Group();
  const floorColor = opts.floorColor !== undefined ? opts.floorColor : 0xd8c890;
  const wallColor  = opts.wallColor  !== undefined ? opts.wallColor  : 0x8a7860;

  /* Primo passaggio: conta istanze per InstancedMesh */
  let floorCount = 0;
  let wallCount  = 0;
  for (const line of mapLines) {
    for (const ch of line) {
      if (ch === '#') wallCount++;
      else if (ch !== ' ' && ch !== 's' && ch !== 'L') floorCount++;
    }
  }

  /* InstancedMesh pavimento */
  const floorGeo  = new THREE.BoxGeometry(TILE_3D - 0.04, 0.3, TILE_3D - 0.04);
  const floorMat  = new THREE.MeshToonMaterial({ color: floorColor });
  const floorInst = new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1, floorCount));
  floorInst.receiveShadow = true;

  /* InstancedMesh muri (più alti per dare spessore) */
  const wallGeo  = new THREE.BoxGeometry(TILE_3D, TILE_3D * 1.5, TILE_3D);
  const wallMat  = new THREE.MeshToonMaterial({ color: wallColor });
  const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, wallCount));
  wallInst.castShadow    = true;
  wallInst.receiveShadow = true;

  const dummy        = new THREE.Object3D();
  const specialMeshes = [];
  let fi = 0, wi = 0;

  for (let row = 0; row < mapLines.length; row++) {
    const line = mapLines[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (!ch || ch === ' ') continue;
      const wx = px2wx((col + 0.5) * TILE);
      const wz = px2wz((row + 0.5) * TILE);

      if (ch === '#') {
        dummy.position.set(wx, TILE_3D * 0.75, wz);
        dummy.updateMatrix();
        wallInst.setMatrixAt(wi++, dummy.matrix);
      } else if (ch === 's') {
        const m = createSafeZoneTile();
        m.position.set(wx, 0.01, wz);
        m.receiveShadow = true;
        group.add(m);
        specialMeshes.push(m);
      } else if (ch === 'L') {
        const m = createLavaTile();
        m.position.set(wx, 0, wz);
        if (!group.userData.lavaTiles) group.userData.lavaTiles = [];
        group.userData.lavaTiles.push(m);
        group.add(m);
        specialMeshes.push(m);
      } else {
        /* Pavimento standard (include spawn, items, porte, scale…) */
        dummy.position.set(wx, 0, wz);
        dummy.updateMatrix();
        floorInst.setMatrixAt(fi++, dummy.matrix);
      }
    }
  }

  /* Aggiusta il conteggio reale (può essere < del max allocato) */
  floorInst.count = fi;
  wallInst.count  = wi;
  floorInst.instanceMatrix.needsUpdate = true;
  wallInst.instanceMatrix.needsUpdate  = true;

  group.add(floorInst, wallInst);
  threeScene.add(group);
  return { group, floorInst, wallInst, specialMeshes };
}

/**
 * Crea il pavimento del mare: piano blu + strato superficiale
 * semitrasparente per simulare l'effetto di profondità.
 */
export function buildSeaFloor(threeScene) {
  const seaMat = new THREE.MeshToonMaterial({ color: 0x3070b8 });
  const sea    = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 20, 20), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  threeScene.add(sea);

  const shallowMat = new THREE.MeshToonMaterial({
    color: 0x4090d0, transparent: true, opacity: 0.3,
  });
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), shallowMat);
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = 0.05;
  threeScene.add(shallow);

  return { sea, shallow };
}

/**
 * Crea un pool di mesh per particelle/proiettili.
 * Tutte le mesh iniziano invisibili e vengono attivate su richiesta.
 */
export function createParticlePool(threeScene, count) {
  const n = count !== undefined ? count : 20;
  const geo = new THREE.SphereGeometry(0.08, 4, 3);
  const mat = new THREE.MeshToonMaterial({
    color: 0xf0c040, emissive: 0xf0c040, emissiveIntensity: 0.5,
  });
  const meshes = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    threeScene.add(m);
    meshes.push(m);
  }
  return meshes;
}
