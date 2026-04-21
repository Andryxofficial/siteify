/**
 * Andryx Legend — Renderer 3D (Three.js).
 *
 * Stile visivo: cel-shaded / toon, ispirato a *The Legend of Zelda: The Minish Cap*
 * e all'estetica di Link's Awakening Switch (geometrie low-poly + materiali
 * piatti a 2-3 toni, outline cartoon, palette satura). NON sprite billboard:
 * ogni elemento e` un vero modello 3D in scena.
 *
 * Caratteristiche chiave:
 *  – Camera prospettica con angolo 3/4 marcato (~50° tilt) e follow lerp smooth
 *    cosi` il movimento del player e della mappa e` SEMPRE percepibile.
 *  – Toon shading via `MeshToonMaterial` con gradient discreto a 4 toni.
 *  – Outline cartoon nera (mesh duplicata BackSide, scale leggera) sul player
 *    e sui nemici, esattamente come The Wind Waker / Minish Cap "fat outline".
 *  – Sky gradient + sole caldo per zone esterne; vault scuro + fog densa
 *    per zone interne.
 *  – Ombra blob soft sotto ogni entita` viva.
 *  – Erba/cespugli/fogliame oscillano col vento (rotazione sin(time)).
 *  – Camera shake breve su attacco/danno.
 *  – Fade nero al cambio zona.
 *
 * L'HUD/dialog/overlay restano disegnati su un canvas 2D sovrapposto
 * (gestito dall'engine).
 */
import * as THREE from 'three';
import { TILE_SIZE, getTile3D } from './tiles.js';
import { ZONE_W, ZONE_H } from './world.js';
import * as M from './models3d.js';

const VIEW_TILES = 15;
const VIEW_LOGICAL = VIEW_TILES * TILE_SIZE;

/** Direzione del player → angolo Y (radianti). */
const DIR_TO_YAW = {
  down:  0,              // verso +Z (sud, verso la camera)
  up:    Math.PI,        // verso -Z
  left:  Math.PI / 2,    // verso -X
  right: -Math.PI / 2,   // verso +X
};

const logicalToWorldX = (lx) => lx / TILE_SIZE;
const logicalToWorldZ = (ly) => ly / TILE_SIZE;

/* Gradient toon condiviso con i materiali in models3d.js per garantire
   shading coerente fra tile/entita`/sky (fonte unica di verita`). */
const getToonGradient = M.getToonGradientMap;

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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88c8e8);
    this.scene.fog = new THREE.Fog(0x88c8e8, 16, 30);

    /* Camera prospettica: angolo 3/4 marcato per look Minish Cap 3D. */
    const aspect = canvas.width / canvas.height;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 100);

    /* Posizione camera "viva": viene aggiornata smooth verso il target. */
    this._camCurrent = new THREE.Vector3(0, 9, 8);
    this._camTarget = new THREE.Vector3(0, 0, 0);
    this._lookCurrent = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._camShake = 0;        // intensita` shake corrente (decade)
    this._fade = 0;            // 0=visibile, 1=nero pieno (per transizioni zona)
    this._fadeTarget = 0;

    /* Luci */
    this.ambient = new THREE.AmbientLight(0xfff5dd, 0.55);
    this.scene.add(this.ambient);
    /* Sole caldo, alto e di lato → ombre lunghe stile cartoon */
    this.sun = new THREE.DirectionalLight(0xffe8b0, 1.05);
    this.sun.position.set(8, 14, 4);
    this.scene.add(this.sun);
    /* Hemispheric leggero per dare colore al bordo opposto */
    this.hemi = new THREE.HemisphereLight(0x9ed8ff, 0x4a6020, 0.45);
    this.scene.add(this.hemi);

    /* Cielo gradient via grosso emisfero rovesciato (sky dome) */
    this.skyDome = this._makeSkyDome();
    this.scene.add(this.skyDome);

    /* Gruppi */
    this.zoneGroup = new THREE.Group();
    this.scene.add(this.zoneGroup);
    this.entitiesGroup = new THREE.Group();
    this.scene.add(this.entitiesGroup);
    this.shadowGroup = new THREE.Group();
    this.scene.add(this.shadowGroup);
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.particlesGroup);
    /* Gruppo "vento": tile/oggetti che oscillano (alberi, cespugli, fiori, erba) */
    this.windGroup = new THREE.Group();
    this.scene.add(this.windGroup);

    /* Player (creato una volta, riusato fra zone) */
    this.playerMesh = M.makePlayer({ toon: getToonGradient() });
    this.playerMesh.position.y = 0;
    this.scene.add(this.playerMesh);
    /* Outline player: copia delle mesh principali con BackSide nero scalato */
    this.playerOutline = M.makeOutlineFromGroup(this.playerMesh, 1.06);
    this.scene.add(this.playerOutline);
    /* Ombra blob player */
    this.playerShadow = makeShadowBlob(0.5);
    this.scene.add(this.playerShadow);

    /* Spada visualizzata durante l'attacco */
    this.swordMesh = M.makeSword();
    this.swordMesh.visible = false;
    this.scene.add(this.swordMesh);
    /* Effetto slash (arco bianco trasparente) */
    this.slashMesh = makeSlashArc();
    this.slashMesh.visible = false;
    this.scene.add(this.slashMesh);

    /* Cache: entityId → { mesh, outline, shadow } */
    this.entityRefs = new Map();
    this.tileMeshes = new Map();
    this.windyMeshes = []; // {mesh, basePhase, baseRot}

    /* Particle pool (sferette) */
    this.particlePool = [];
    this.activeParticles = [];

    this._zoneMode = null; // 'outdoor'|'indoor'

    this._lastPlayerYaw = 0;
  }

  /* ─── Sky dome ─── */
  _makeSkyDome() {
    const skyGeo = new THREE.SphereGeometry(60, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4a90e0) },
        bottomColor: { value: new THREE.Color(0xc8e8ff) },
        offset: { value: 4 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(skyGeo, skyMat);
    dome.userData.skyDome = true;
    return dome;
  }

  _setSkyColors(topHex, bottomHex) {
    if (!this.skyDome?.material?.uniforms) return;
    this.skyDome.material.uniforms.topColor.value.setHex(topHex);
    this.skyDome.material.uniforms.bottomColor.value.setHex(bottomHex);
  }

  /** Configura ambient/fog/sky per zona esterna (giorno) o interna (caverna/castello). */
  _applyZoneAmbience(zoneId) {
    const dark = zoneId === 'cave' || zoneId === 'castle';
    const mode = dark ? 'indoor' : 'outdoor';
    if (this._zoneMode === mode) return;
    this._zoneMode = mode;
    if (dark) {
      this.ambient.color.setHex(0x6a5a8a);
      this.ambient.intensity = 0.32;
      this.sun.color.setHex(0xa0a0c0);
      this.sun.intensity = 0.5;
      this.hemi.intensity = 0.18;
      const fogCol = zoneId === 'castle' ? 0x180828 : 0x0a0e1a;
      this.scene.background = new THREE.Color(fogCol);
      this.scene.fog.color.setHex(fogCol);
      this.scene.fog.near = 7;
      this.scene.fog.far = 17;
      this.skyDome.visible = false;
    } else {
      this.ambient.color.setHex(0xfff5dd);
      this.ambient.intensity = 0.6;
      this.sun.color.setHex(0xffe8b0);
      this.sun.intensity = 1.05;
      this.hemi.intensity = 0.45;
      this.scene.background = new THREE.Color(0xc8e8ff);
      this.scene.fog.color.setHex(0xc8e8ff);
      this.scene.fog.near = 16;
      this.scene.fog.far = 32;
      this.skyDome.visible = true;
      this._setSkyColors(0x4a90e0, 0xc8e8ff);
    }
  }

  /** Costruisce/ricostruisce la geometria della zona corrente. */
  setZone(zoneId, mutableMap) {
    /* Pulisci zona precedente */
    while (this.zoneGroup.children.length) this.zoneGroup.remove(this.zoneGroup.children[0]);
    while (this.windGroup.children.length) this.windGroup.remove(this.windGroup.children[0]);
    this.tileMeshes.clear();
    this.windyMeshes.length = 0;

    this._applyZoneAmbience(zoneId);

    /* Pavimento di base sotto tutto: un grande piano */
    const baseColor = zoneId === 'cave' ? 0x5a5a68
                    : zoneId === 'castle' ? 0x2a1a30
                    : 0x4a8c30;
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(ZONE_W + 8, ZONE_H + 8),
      new THREE.MeshToonMaterial({ color: baseColor, gradientMap: getToonGradient() }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(ZONE_W / 2 - 0.5, -0.02, ZONE_H / 2 - 0.5);
    this.zoneGroup.add(base);

    /* Aggiunge pattern erba a chiazze sulle zone esterne, con tonalita` random */
    if (zoneId !== 'cave' && zoneId !== 'castle') {
      const grassPatch = new THREE.PlaneGeometry(2, 2);
      const grassMat = new THREE.MeshToonMaterial({ color: 0x5fb33a, gradientMap: getToonGradient() });
      for (let i = 0; i < 28; i++) {
        const patch = new THREE.Mesh(grassPatch, grassMat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(
          Math.random() * ZONE_W,
          -0.01,
          Math.random() * ZONE_H,
        );
        patch.scale.setScalar(0.5 + Math.random() * 1.2);
        patch.rotation.z = Math.random() * Math.PI;
        this.zoneGroup.add(patch);
      }
    }

    for (let y = 0; y < ZONE_H; y++) {
      for (let x = 0; x < ZONE_W; x++) {
        this._placeTile(x, y, mutableMap[y][x]);
      }
    }

    /* Trigger fade-in: nero → trasparente */
    this._fade = 1;
    this._fadeTarget = 0;
  }

  /** Aggiorna un singolo tile. */
  updateMapTile(x, y, ch) {
    const key = `${x},${y}`;
    const old = this.tileMeshes.get(key);
    if (old) {
      this.zoneGroup.remove(old);
      const idx = this.windyMeshes.findIndex(w => w.mesh === old);
      if (idx >= 0) this.windyMeshes.splice(idx, 1);
      this.tileMeshes.delete(key);
    }
    this._placeTile(x, y, ch);
  }

  _placeTile(x, y, ch) {
    const meta3d = getTile3D(ch);
    let mesh = null;
    let windy = false;

    switch (meta3d.kind) {
      case 'ground':
        /* Coperto dal piano di base; nessuna mesh dedicata. */
        break;
      case 'path':
      case 'sand':
      case 'floor':
      case 'dirt':
        mesh = M.makeGroundTile(meta3d.color, getToonGradient());
        mesh.position.y = 0.01;
        break;
      case 'flower':
        mesh = M.makeFlower(meta3d.color, meta3d.accent, getToonGradient());
        windy = true;
        break;
      case 'water':
        mesh = M.makeGroundTile(meta3d.color, getToonGradient());
        mesh.position.y = -0.05;
        mesh.userData.water = true;
        break;
      case 'lava':
        mesh = M.makeGroundTile(meta3d.color, getToonGradient());
        mesh.position.y = 0.01;
        mesh.material = new THREE.MeshBasicMaterial({ color: meta3d.color });
        mesh.userData.lava = true;
        break;
      case 'tree':    mesh = M.makeTree(meta3d.color, meta3d.foliage, getToonGradient()); windy = true; break;
      case 'stone':   mesh = M.makeStone(meta3d.color, getToonGradient()); break;
      case 'wall':    mesh = M.makeWall(meta3d.color, getToonGradient()); break;
      case 'house':   mesh = M.makeHousePiece(meta3d, getToonGradient()); break;
      case 'fountain': mesh = M.makeFountain(getToonGradient()); break;
      case 'bush':    mesh = M.makeBush(meta3d.color, getToonGradient()); windy = true; break;
      case 'pot':     mesh = M.makePot(meta3d.color, meta3d.accent, getToonGradient()); break;
      case 'block':   mesh = M.makeBlock(meta3d.color, getToonGradient()); break;
      case 'plate':   mesh = M.makePlate(meta3d.color, meta3d.pressed, getToonGradient()); break;
      case 'door':    mesh = M.makeDoor(meta3d.color, meta3d.subKind === 'open', getToonGradient()); break;
      case 'torch':   mesh = M.makeTorch(meta3d.lit, meta3d.glow, getToonGradient()); break;
      case 'portal':  mesh = M.makePortal(meta3d.glow); break;
      default: break;
    }

    if (!mesh) return;
    mesh.position.x = x + 0.5;
    mesh.position.z = y + 0.5;
    /* Random tile rotation per varieta` su tree/stone/bush */
    if (meta3d.kind === 'tree' || meta3d.kind === 'stone' || meta3d.kind === 'bush') {
      mesh.rotation.y = ((x * 17 + y * 31) % 360) * Math.PI / 180;
    }
    this.zoneGroup.add(mesh);
    this.tileMeshes.set(`${x},${y}`, mesh);
    if (windy) {
      this.windyMeshes.push({
        mesh,
        basePhase: (x * 0.7 + y * 1.3) % (Math.PI * 2),
        baseRotZ: mesh.rotation.z,
        baseRotX: mesh.rotation.x,
        amp: meta3d.kind === 'tree' ? 0.04 : (meta3d.kind === 'bush' ? 0.07 : 0.12),
      });
    }
  }

  /** Aggiorna posizione/rotazione del player + sword + outline + shadow. */
  setPlayer(player, attackState) {
    const px = logicalToWorldX(player.x);
    const pz = logicalToWorldZ(player.y);
    /* Bobbing camminata */
    const walking = (player.frame || 0) >= 1;
    const bob = walking ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0;
    this.playerMesh.position.set(px, bob, pz);
    const yaw = DIR_TO_YAW[player.dir] ?? 0;
    /* Lerp leggero della rotazione per evitare snap */
    const dy = wrapPi(yaw - this._lastPlayerYaw);
    this._lastPlayerYaw = wrapPi(this._lastPlayerYaw + dy * 0.35);
    this.playerMesh.rotation.y = this._lastPlayerYaw;

    /* Outline e shadow */
    this.playerOutline.position.copy(this.playerMesh.position);
    this.playerOutline.rotation.y = this.playerMesh.rotation.y;
    this.playerShadow.position.set(px, 0.02, pz);

    /* Iframes lampeggio */
    if (player.iframes && Math.floor(player.iframes / 4) % 2 === 0) {
      this.playerMesh.visible = false;
      this.playerOutline.visible = false;
    } else {
      this.playerMesh.visible = true;
      this.playerOutline.visible = true;
    }

    /* Spada + slash */
    if (attackState) {
      this.swordMesh.visible = true;
      this.slashMesh.visible = true;
      const aYaw = DIR_TO_YAW[attackState.dir] ?? 0;
      const t = Math.min(1, attackState.frame / 14);
      const swing = (t - 0.5) * Math.PI * 0.7;
      const angle = aYaw + swing;
      this.swordMesh.position.x = px + Math.sin(angle) * 0.55;
      this.swordMesh.position.z = pz + Math.cos(angle) * 0.55;
      this.swordMesh.position.y = 0.55;
      this.swordMesh.rotation.set(0, angle, -Math.PI / 4);
      /* Slash arc segue il movimento */
      this.slashMesh.position.set(px, 0.55, pz);
      this.slashMesh.rotation.set(-Math.PI / 2, 0, angle - Math.PI / 2);
      const slashMat = this.slashMesh.material;
      if (slashMat) slashMat.opacity = 0.9 * (1 - t);
    } else {
      this.swordMesh.visible = false;
      this.slashMesh.visible = false;
    }
  }

  /** Sincronizza le mesh delle entita`. */
  setEntities(entities, tickCount) {
    const seen = new Set();
    for (const e of entities) {
      if (e.dead) continue;
      const id = e._id3d ?? (e._id3d = nextId());
      seen.add(id);
      let ref = this.entityRefs.get(id);
      if (!ref) {
        const mesh = this._createEntityMesh(e);
        if (!mesh) continue;
        let outline = null;
        if (e.type === 'enemy' || e.type === 'boss' || e.type === 'npc') {
          outline = M.makeOutlineFromGroup(mesh, e.type === 'boss' ? 1.05 : 1.07);
          this.entitiesGroup.add(outline);
        }
        let shadow = null;
        if (e.type === 'enemy' || e.type === 'boss' || e.type === 'npc' || e.type === 'item') {
          const sz = e.type === 'boss' ? 1.0 : (e.type === 'item' ? 0.3 : 0.45);
          shadow = makeShadowBlob(sz);
          this.shadowGroup.add(shadow);
        }
        this.entitiesGroup.add(mesh);
        ref = { mesh, outline, shadow };
        this.entityRefs.set(id, ref);
      }
      this._updateEntityMesh(ref, e, tickCount);
    }
    /* Rimuovi mesh di entita` sparite */
    for (const [id, ref] of this.entityRefs) {
      if (!seen.has(id)) {
        if (ref.mesh) this.entitiesGroup.remove(ref.mesh);
        if (ref.outline) this.entitiesGroup.remove(ref.outline);
        if (ref.shadow) this.shadowGroup.remove(ref.shadow);
        this.entityRefs.delete(id);
      }
    }
  }

  _createEntityMesh(e) {
    const tg = getToonGradient();
    if (e.type === 'enemy')   return M.makeEnemyByKind(e.kind, tg);
    if (e.type === 'boss')    return M.makeBossByKind(e.kind, tg);
    if (e.type === 'npc')     return M.makeNpcByKind(e.kind, tg);
    if (e.type === 'item')    return M.makeItemByKind(e.kind, tg);
    if (e.type === 'sign')    return M.makeSign(tg);
    if (e.type === 'projectile') {
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: e.col || 0xffffff }),
      );
    }
    return null;
  }

  _updateEntityMesh(ref, e, tickCount) {
    const mesh = ref.mesh;
    const ex = logicalToWorldX(e.x);
    const ez = logicalToWorldZ(e.y);
    mesh.position.x = ex;
    mesh.position.z = ez;

    let baseY = 0;
    if (e.type === 'item') {
      baseY = 0.4 + Math.sin((tickCount + (e.bobPhase || 0) * 60) * 0.08) * 0.1;
      mesh.rotation.y += 0.04;
    } else if (e.type === 'projectile') {
      baseY = 0.55;
    } else if (e.type === 'enemy' && e.kind === 'bat') {
      baseY = 0.6 + Math.sin(tickCount * 0.1 + (e._id3d || 0)) * 0.12;
      const flap = Math.sin(tickCount * 0.5) * 0.6;
      const wL = mesh.userData.wingL;
      const wR = mesh.userData.wingR;
      if (wL) wL.rotation.z = flap;
      if (wR) wR.rotation.z = -flap;
    } else if (e.type === 'enemy' && e.kind === 'slime') {
      const pulse = 0.7 + Math.sin(tickCount * 0.18 + (e._id3d || 0)) * 0.08;
      const body = mesh.userData.slimeBody;
      if (body) body.scale.y = pulse;
    }
    mesh.position.y = baseY;

    /* Cristalli: rotazione + bob ampio */
    if (e.type === 'item' && e.kind && e.kind.startsWith('crystal_')) {
      mesh.position.y = 0.6 + Math.sin(tickCount * 0.06) * 0.15;
      mesh.rotation.y = tickCount * 0.05;
    }

    /* Yaw da velocita`. Per nemici/boss usiamo (vx, vy); per NPC restano statici. */
    if (e.type === 'enemy' || e.type === 'boss') {
      if ((e.vx !== undefined) && (Math.abs(e.vx) + Math.abs(e.vy || 0) > 0.05)) {
        mesh.rotation.y = Math.atan2(e.vx, e.vy) + Math.PI;
      }
    }

    /* Outline segue */
    if (ref.outline) {
      ref.outline.position.copy(mesh.position);
      ref.outline.rotation.y = mesh.rotation.y;
    }

    /* Iframes nemici lampeggio */
    if (e.iframes && Math.floor(e.iframes / 3) % 2 === 0) {
      mesh.visible = false;
      if (ref.outline) ref.outline.visible = false;
    } else {
      mesh.visible = true;
      if (ref.outline) ref.outline.visible = true;
    }

    /* Ombra blob */
    if (ref.shadow) {
      ref.shadow.position.set(ex, 0.02, ez);
      /* Ombra piu` piccola se la entita` e` "in aria" (bat) o item che fluttua */
      const airLift = baseY > 0.45 ? 0.6 + (baseY - 0.45) * 0.4 : 1;
      ref.shadow.scale.setScalar(airLift);
      ref.shadow.material.opacity = mesh.visible ? 0.35 / Math.max(1, airLift) : 0;
    }
  }

  /** Particelle per il frame corrente. */
  setParticles(particles) {
    for (const p of this.activeParticles) {
      p.mesh.visible = false;
      this.particlePool.push(p.mesh);
    }
    this.activeParticles.length = 0;
    for (const pa of particles) {
      let mesh = this.particlePool.pop();
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 4, 3),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
        );
        this.particlesGroup.add(mesh);
      }
      mesh.material.color.set(pa.col);
      mesh.material.opacity = pa.life / pa.maxLife;
      mesh.position.set(logicalToWorldX(pa.x), 0.4 + (1 - pa.life / pa.maxLife) * 0.3, logicalToWorldZ(pa.y));
      mesh.visible = true;
      this.activeParticles.push({ mesh });
    }
  }

  /** Imposta il target della camera (chiamato ogni frame). */
  setCamera(cameraLogical, player) {
    /* Target di follow: il PLAYER, non il centro view. Cosi` il movimento del
       player e della scena si vede bene. La camera resta dietro/sopra. */
    const px = logicalToWorldX(player.x);
    const pz = logicalToWorldZ(player.y);

    /* Camera Minish Cap-style: angolo 3/4 marcato (~50° tilt), dietro il player.
       Distanza ridotta → zoom stretto, movimento percepibile. */
    const camHeight = 7.5;
    const camBack = 7.0;
    this._camTarget.set(px, camHeight, pz + camBack);
    /* Look-at quasi sul player con leggero offset in avanti per "anticipare" */
    this._lookTarget.set(px, 0.6, pz - 0.3);

    /* Manteniamo la camera dentro i bounds della zona usando cameraLogical
       come hint (gia` clampato dall'engine). Solo X: per Z lasciamo liberta`
       perche` il target e` dietro il view-center. */
    const camCx = logicalToWorldX(cameraLogical.x + VIEW_LOGICAL / 2);
    this._camTarget.x = THREE.MathUtils.clamp(this._camTarget.x, camCx - 1.5, camCx + 1.5);

    this.sun.position.set(px + 6, 14, pz - 4);
  }

  /** Trigger camera shake (intensita` 0..1). */
  shake(amount = 0.35) {
    this._camShake = Math.max(this._camShake, amount);
  }

  /** Render del frame. Applica smoothing camera, vento, animazioni, fade. */
  render() {
    const t = performance.now() * 0.001;

    /* Smooth follow camera */
    const lerpK = 0.18;
    this._camCurrent.lerp(this._camTarget, lerpK);
    this._lookCurrent.lerp(this._lookTarget, lerpK);
    this.camera.position.copy(this._camCurrent);
    /* Shake decay */
    if (this._camShake > 0.001) {
      const sx = (Math.random() - 0.5) * this._camShake * 0.6;
      const sy = (Math.random() - 0.5) * this._camShake * 0.6;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      this._camShake *= 0.85;
    }
    this.camera.lookAt(this._lookCurrent);

    /* Vento: oscilla tutti gli oggetti registrati */
    for (const w of this.windyMeshes) {
      const ph = t * 1.4 + w.basePhase;
      w.mesh.rotation.z = w.baseRotZ + Math.sin(ph) * w.amp;
      w.mesh.rotation.x = w.baseRotX + Math.cos(ph * 0.8) * w.amp * 0.5;
    }

    /* Anima portali, acqua, lava, fiamme */
    this.zoneGroup.traverse((o) => {
      if (o.userData?.portalRing) o.rotation.z = t * 1.5;
      if (o.userData?.water) {
        o.position.y = -0.05 + Math.sin(t * 1.5 + o.position.x * 0.5) * 0.025;
      }
      if (o.userData?.lava && o.material?.color) {
        const k = 0.85 + Math.sin(t * 2 + o.position.x) * 0.15;
        o.material.color.setRGB(1.0 * k, 0.45 * k, 0.12 * k);
      }
      if (o.userData?.flame) {
        const s = 1 + Math.sin(t * 8 + o.position.x * 13) * 0.15;
        o.scale.set(s, 1 + Math.sin(t * 11) * 0.2, s);
      }
    });

    /* Fade lerp */
    this._fade += (this._fadeTarget - this._fade) * 0.15;

    this.renderer.render(this.scene, this.camera);

    /* Render fade overlay come quad nero davanti alla camera (usando un'altra
       passata renderer e` overkill: usiamo un blend trick con clearColor? No.
       Soluzione semplice: drawOnOverlay() esposto all'engine via overlay 2D.
       Esponiamo `getFadeAlpha()` per disegnarlo dal canvas 2D. */
  }

  /** Alpha 0..1 del fade nero per l'overlay 2D. */
  getFadeAlpha() {
    return Math.max(0, Math.min(1, this._fade));
  }

  /** Trigger fade-out (per cambio zona / morte). */
  fadeOut() { this._fade = 0; this._fadeTarget = 1; }

  /** Cleanup: dispone scene + GPU resources. */
  dispose() {
    [this.zoneGroup, this.entitiesGroup, this.particlesGroup, this.shadowGroup, this.windGroup].forEach(g => {
      while (g.children.length) g.remove(g.children[0]);
    });
    this.entityRefs.clear();
    this.tileMeshes.clear();
    this.windyMeshes.length = 0;
    this.activeParticles.length = 0;
    this.particlePool.length = 0;
    this.skyDome?.material?.dispose?.();
    this.skyDome?.geometry?.dispose?.();
    M.disposeShared();
    this.renderer.dispose();
    _idCounter = 1;
  }
}

/* ─── Helpers locali ─── */

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

let _shadowGeom = null;
function makeShadowBlob(radius = 0.5) {
  if (!_shadowGeom) _shadowGeom = new THREE.CircleGeometry(0.5, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const m = new THREE.Mesh(_shadowGeom, mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(radius * 2);
  m.renderOrder = -1;
  return m;
}

let _slashGeom = null;
function makeSlashArc() {
  if (!_slashGeom) {
    /* Arco bianco semitrasparente: piano stretto curvo (anello sottile) */
    _slashGeom = new THREE.RingGeometry(0.5, 0.85, 16, 1, -Math.PI / 3, Math.PI * 2 / 3);
  }
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const m = new THREE.Mesh(_slashGeom, mat);
  m.renderOrder = 5;
  return m;
}

let _idCounter = 1;
function nextId() { return _idCounter++; }
