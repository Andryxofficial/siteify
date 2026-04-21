/**
 * Andryx Legend — Renderer 3D (Three.js).
 *
 * Sostituisce il vecchio renderer 2D (canvas ctx) con una scena 3D vera:
 * geometrie low-poly, illuminazione direzionale + ambient + point lights
 * delle torce, camera prospettica top-down con leggero angolo 3/4
 * (in stile Link's Awakening Switch / Captain Toad).
 *
 * Responsabilita`:
 *   – costruisce la scena dalla mappa di una zona (setZone)
 *   – aggiorna posizioni/rotazioni/animazioni di player/nemici/oggetti
 *   – fa pan della camera dietro il player
 *   – renderizza un frame
 *
 * Riceve UN canvas WebGL e gestisce solo il 3D. L'HUD (cuori, dialog,
 * minimap, overlay) e` disegnato dall'engine su un canvas overlay 2D
 * separato, sovrapposto a questo.
 */
import * as THREE from 'three';
import { TILE_SIZE, getTile3D } from './tiles.js';
import { ZONE_W, ZONE_H } from './world.js';
import * as M from './models3d.js';

const VIEW_TILES = 15;            // tile visibili (uguale a engine 2D)
const VIEW_LOGICAL = VIEW_TILES * TILE_SIZE;

/** Direzione del player → angolo di rotazione (radianti) attorno all'asse Y. */
const DIR_TO_YAW = {
  down:  Math.PI,        // verso +Z (sud) — guarda lontano dalla camera
  up:    0,              // verso -Z (nord)
  left:  Math.PI / 2,    // verso -X (ovest)
  right: -Math.PI / 2,   // verso +X (est)
};

/* Converte coord logiche (px) in coord world (1 tile = 1 unit). */
function logicalToWorldX(lx) { return lx / TILE_SIZE; }
function logicalToWorldZ(ly) { return ly / TILE_SIZE; }

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.setClearColor(0x0a0e17, 1);
    this.renderer.shadowMap.enabled = false; // perf

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0e17, 14, 26);

    /* Camera prospettica con angolo 3/4 stile Link's Awakening Switch */
    const aspect = canvas.width / canvas.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);

    /* Luci globali */
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);
    this.dir = new THREE.DirectionalLight(0xffe8c0, 0.95);
    this.dir.position.set(8, 14, 6);
    this.scene.add(this.dir);
    /* Hemispheric per dare un tocco di cielo */
    this.hemi = new THREE.HemisphereLight(0x88c8ff, 0x4a3820, 0.35);
    this.scene.add(this.hemi);

    /* Gruppi per organizzazione e cleanup veloce */
    this.zoneGroup = new THREE.Group();
    this.scene.add(this.zoneGroup);
    this.entitiesGroup = new THREE.Group();
    this.scene.add(this.entitiesGroup);
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.particlesGroup);

    /* Mesh del player (creato una sola volta) */
    this.playerMesh = M.makePlayer();
    this.scene.add(this.playerMesh);
    this.swordMesh = M.makeSword();
    this.swordMesh.visible = false;
    this.scene.add(this.swordMesh);

    /* Mappa entityId → mesh per riuso fra frame */
    this.entityMeshes = new Map();
    /* Mappa tile coord → mesh per aggiornamenti puntuali */
    this.tileMeshes = new Map();

    /* Particelle: pool di piccoli quad billboard riutilizzati */
    this.particlePool = [];
    this.activeParticles = [];

    this._zoneAmbientTone = null;
  }

  /** Imposta il tono ambient/cielo in base al tipo di zona (interno vs esterno). */
  _applyZoneAmbience(zoneId) {
    const dark = zoneId === 'cave' || zoneId === 'castle';
    if (this._zoneAmbientTone === dark) return;
    this._zoneAmbientTone = dark;
    if (dark) {
      this.ambient.intensity = 0.32;
      this.dir.intensity = 0.55;
      this.hemi.intensity = 0.18;
      this.scene.fog.color.setHex(zoneId === 'castle' ? 0x100818 : 0x080a14);
      this.scene.fog.near = 8;
      this.scene.fog.far = 18;
      this.renderer.setClearColor(zoneId === 'castle' ? 0x100818 : 0x080a14, 1);
    } else {
      this.ambient.intensity = 0.6;
      this.dir.intensity = 1.0;
      this.hemi.intensity = 0.4;
      this.scene.fog.color.setHex(0x88c0e8);
      this.scene.fog.near = 14;
      this.scene.fog.far = 28;
      this.renderer.setClearColor(0x88c0e8, 1);
    }
  }

  /** Costruisce/ricostruisce la geometria della zona corrente. */
  setZone(zoneId, mutableMap) {
    /* Pulisci zona precedente */
    while (this.zoneGroup.children.length) {
      const c = this.zoneGroup.children.pop();
      this.zoneGroup.remove(c);
    }
    this.tileMeshes.clear();

    this._applyZoneAmbience(zoneId);

    /* Pavimento di base sotto tutto: un grande piano per evitare il "vuoto" */
    const baseColor = zoneId === 'cave' ? 0x6a6a78
                    : zoneId === 'castle' ? 0x2a1a30
                    : 0x4a8830;
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(ZONE_W + 4, ZONE_H + 4),
      new THREE.MeshLambertMaterial({ color: baseColor }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(ZONE_W / 2 - 0.5, -0.02, ZONE_H / 2 - 0.5);
    this.zoneGroup.add(base);

    /* Tile: per ogni cella aggiungo la mesh corrispondente */
    for (let y = 0; y < ZONE_H; y++) {
      for (let x = 0; x < ZONE_W; x++) {
        this._placeTile(x, y, mutableMap[y][x]);
      }
    }
  }

  /** Aggiorna un singolo tile (porta aperta, blocco spinto, torcia accesa). */
  updateMapTile(x, y, ch) {
    const key = `${x},${y}`;
    const old = this.tileMeshes.get(key);
    if (old) {
      this.zoneGroup.remove(old);
      this.tileMeshes.delete(key);
    }
    this._placeTile(x, y, ch);
  }

  _placeTile(x, y, ch) {
    const meta3d = getTile3D(ch);
    let mesh = null;

    switch (meta3d.kind) {
      case 'ground':
      case 'path':
      case 'sand':
      case 'floor':
      case 'dirt':
        /* Per il pavimento di base non aggiungo mesh: il piano grosso copre tutto.
           Ma path/sand/floor/dirt hanno colore diverso → mesh dedicato. */
        if (meta3d.kind !== 'ground') {
          mesh = M.makeGroundTile(meta3d.color);
          mesh.position.y = 0.01;
        }
        break;
      case 'flower':
        mesh = M.makeFlower(meta3d.color, meta3d.accent);
        break;
      case 'water':
        mesh = M.makeGroundTile(meta3d.color);
        mesh.position.y = -0.05;
        mesh.userData.water = true;
        break;
      case 'lava':
        mesh = M.makeGroundTile(meta3d.color);
        mesh.position.y = 0.01;
        mesh.material = new THREE.MeshBasicMaterial({ color: meta3d.color });
        mesh.userData.lava = true;
        break;
      case 'tree':    mesh = M.makeTree(meta3d.color, meta3d.foliage); break;
      case 'stone':   mesh = M.makeStone(meta3d.color); break;
      case 'wall':    mesh = M.makeWall(meta3d.color); break;
      case 'house':   mesh = M.makeHousePiece(meta3d); break;
      case 'fountain': mesh = M.makeFountain(); break;
      case 'bush':    mesh = M.makeBush(meta3d.color); break;
      case 'pot':     mesh = M.makePot(meta3d.color, meta3d.accent); break;
      case 'block':   mesh = M.makeBlock(meta3d.color); break;
      case 'plate':   mesh = M.makePlate(meta3d.color, meta3d.pressed); break;
      case 'door':    mesh = M.makeDoor(meta3d.color, meta3d.subKind === 'open'); break;
      case 'torch':   mesh = M.makeTorch(meta3d.lit, meta3d.glow); break;
      case 'portal':  mesh = M.makePortal(meta3d.glow); break;
      default: break;
    }

    if (!mesh) return;
    /* Allineo il pivot al CENTRO del tile (x+0.5, z+0.5) cosi` corrisponde
       all'engine 2D dove la coord (x,y) e` l'angolo top-left e gli oggetti
       sono disegnati centrati nel loro tile. */
    mesh.position.x = x + 0.5;
    mesh.position.z = y + 0.5;
    if (mesh.position.y === 0) mesh.position.y = 0;
    this.zoneGroup.add(mesh);
    this.tileMeshes.set(`${x},${y}`, mesh);
  }

  /** Aggiorna posizione/rotazione del player + sword. */
  setPlayer(player, attackState) {
    this.playerMesh.position.x = logicalToWorldX(player.x);
    this.playerMesh.position.z = logicalToWorldZ(player.y);
    this.playerMesh.position.y = 0;
    this.playerMesh.rotation.y = DIR_TO_YAW[player.dir] ?? 0;

    /* Lampeggio iframes: alterna visibilita` */
    if (player.iframes && Math.floor(player.iframes / 4) % 2 === 0) {
      this.playerMesh.visible = false;
    } else {
      this.playerMesh.visible = true;
    }

    /* Bobbing camminata: leggera oscillazione torso */
    if (player.frame >= 1) {
      this.playerMesh.position.y = 0.04;
    }

    /* Spada visibile solo durante attacco */
    if (attackState) {
      this.swordMesh.visible = true;
      const yaw = DIR_TO_YAW[attackState.dir] ?? 0;
      /* Rotazione dell'arco di attacco (-45°…+45° lungo la durata) */
      const t = attackState.frame / 14;
      const swing = (t - 0.5) * Math.PI * 0.7;
      this.swordMesh.position.x = this.playerMesh.position.x + Math.sin(yaw + swing + Math.PI) * 0.55;
      this.swordMesh.position.z = this.playerMesh.position.z + Math.cos(yaw + swing + Math.PI) * 0.55;
      this.swordMesh.position.y = 0.55;
      this.swordMesh.rotation.y = yaw + swing + Math.PI / 2;
      this.swordMesh.rotation.x = 0;
    } else {
      this.swordMesh.visible = false;
    }
  }

  /** Sincronizza le mesh delle entita` (nemici, NPC, item, boss, sign, projectile). */
  setEntities(entities, tickCount) {
    const seen = new Set();
    for (const e of entities) {
      if (e.dead) continue;
      seen.add(e._id3d ?? (e._id3d = nextId()));
      let mesh = this.entityMeshes.get(e._id3d);
      if (!mesh) {
        mesh = this._createEntityMesh(e);
        if (!mesh) continue;
        mesh.userData.kind = e.kind;
        mesh.userData.type = e.type;
        this.entityMeshes.set(e._id3d, mesh);
        this.entitiesGroup.add(mesh);
      }
      this._updateEntityMesh(mesh, e, tickCount);
    }
    /* Rimuovi mesh di entita` sparite */
    for (const [id, mesh] of this.entityMeshes) {
      if (!seen.has(id)) {
        this.entitiesGroup.remove(mesh);
        this.entityMeshes.delete(id);
      }
    }
  }

  _createEntityMesh(e) {
    if (e.type === 'enemy')   return M.makeEnemyByKind(e.kind);
    if (e.type === 'boss')    return M.makeBossByKind(e.kind);
    if (e.type === 'npc')     return M.makeNpcByKind(e.kind);
    if (e.type === 'item')    return M.makeItemByKind(e.kind);
    if (e.type === 'sign')    return M.makeSign();
    if (e.type === 'projectile') {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 6),
        new THREE.MeshBasicMaterial({ color: e.col || 0xffffff }),
      );
      return mesh;
    }
    return null;
  }

  _updateEntityMesh(mesh, e, tickCount) {
    mesh.position.x = logicalToWorldX(e.x);
    mesh.position.z = logicalToWorldZ(e.y);

    /* Bobbing item */
    if (e.type === 'item') {
      mesh.position.y = 0.4 + Math.sin((tickCount + (e.bobPhase || 0) * 60) * 0.08) * 0.08;
      mesh.rotation.y += 0.04;
    } else if (e.type === 'projectile') {
      mesh.position.y = 0.55;
    } else if (e.type === 'sign') {
      mesh.position.y = 0;
    } else {
      mesh.position.y = 0;
    }

    /* Bat: ali sbattono */
    if (e.type === 'enemy' && e.kind === 'bat') {
      const flap = Math.sin(tickCount * 0.5) * 0.6;
      const wL = mesh.userData.wingL;
      const wR = mesh.userData.wingR;
      if (wL) wL.rotation.z = flap;
      if (wR) wR.rotation.z = -flap;
      mesh.position.y = 0.2 + Math.sin(tickCount * 0.1) * 0.1;
    }

    /* Slime: pulse verticale */
    if (e.type === 'enemy' && e.kind === 'slime') {
      const pulse = 0.7 + Math.sin(tickCount * 0.18 + (e._id3d || 0)) * 0.08;
      const body = mesh.children.find(c => c.userData.bodyPart === 'slimeBody');
      if (body) body.scale.y = pulse;
    }

    /* Boss + nemici hanno yaw verso il player non lo conosciamo qui;
       per semplicita` ruotano in base alla direzione di moto stimata da vx/vy */
    if (e.vx !== undefined && (Math.abs(e.vx) + Math.abs(e.vy) > 0.05)) {
      const ang = Math.atan2(e.vx, e.vy);
      mesh.rotation.y = ang + Math.PI;
    }

    /* Cristalli: rotazione + bob ampio */
    if (e.type === 'item' && e.kind && e.kind.startsWith('crystal_')) {
      mesh.position.y = 0.6 + Math.sin(tickCount * 0.06) * 0.12;
      mesh.rotation.y = tickCount * 0.05;
    }

    /* Lampeggio iframes nemici */
    if (e.iframes && Math.floor(e.iframes / 3) % 2 === 0) {
      mesh.visible = false;
    } else {
      mesh.visible = true;
    }
  }

  /** Sostituisce le particelle con quelle del frame corrente. */
  setParticles(particles) {
    /* Riavvolgi tutte e re-popola dal pool */
    for (const p of this.activeParticles) {
      p.mesh.visible = false;
      this.particlePool.push(p.mesh);
    }
    this.activeParticles.length = 0;
    for (const pa of particles) {
      let mesh = this.particlePool.pop();
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 4, 3),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
        );
        this.particlesGroup.add(mesh);
      }
      mesh.material.color.set(pa.col);
      mesh.material.opacity = pa.life / pa.maxLife;
      mesh.position.set(logicalToWorldX(pa.x), 0.4, logicalToWorldZ(pa.y));
      mesh.visible = true;
      this.activeParticles.push({ mesh });
    }
  }

  /** Aggiorna la camera in base alla camera logica dell'engine + posizione player. */
  setCamera(cameraLogical, player) {
    /* Centro della view in coord world */
    const cx = logicalToWorldX(cameraLogical.x + VIEW_LOGICAL / 2);
    const cz = logicalToWorldZ(cameraLogical.y + VIEW_LOGICAL / 2);
    /* Camera offset: alta e leggermente indietro rispetto al player.
       Look-at target leggermente sopra il piano per inquadrare le mesh. */
    const camHeight = 11;
    const camBack = 6;
    /* Punta sempre dalla stessa direzione (sud→nord) per look stabile. */
    this.camera.position.set(cx, camHeight, cz + camBack);
    this.camera.lookAt(cx, 0.4, cz - 0.5);

    /* Rotazione lieve della direzionale per dare profondita` mentre la camera segue */
    this.dir.position.set(cx + 6, camHeight + 4, cz - 3);
  }

  /** Render del frame. */
  render() {
    /* Anima portali e fiamme */
    const t = performance.now() * 0.001;
    this.zoneGroup.traverse((o) => {
      if (o.userData?.portalRing) o.rotation.z = t * 1.5;
      if (o.userData?.water) {
        o.position.y = -0.05 + Math.sin(t * 1.5 + o.position.x * 0.5) * 0.02;
      }
      if (o.userData?.lava && o.material?.color) {
        const k = 0.85 + Math.sin(t * 2 + o.position.x) * 0.15;
        o.material.color.setRGB(1.0 * k, 0.4 * k, 0.1 * k);
      }
    });
    this.renderer.render(this.scene, this.camera);
  }

  /** Cleanup: dispone scene + GPU resources. */
  dispose() {
    /* Svuota gruppi */
    [this.zoneGroup, this.entitiesGroup, this.particlesGroup].forEach(g => {
      while (g.children.length) g.remove(g.children[0]);
    });
    this.entityMeshes.clear();
    this.tileMeshes.clear();
    this.activeParticles.length = 0;
    this.particlePool.length = 0;
    M.disposeShared();
    this.renderer.dispose();
    /* Reset id counter cosi` start/stop ripetuti non lo fanno crescere indefinitamente */
    _idCounter = 1;
  }
}

let _idCounter = 1;
function nextId() { return _idCounter++; }
