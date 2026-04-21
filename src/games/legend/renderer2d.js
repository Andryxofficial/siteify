/**
 * Andryx Legend — Renderer 2D pixel-art ispirato a "The Minish Cap" (GBA).
 *
 * Stesso API del precedente Renderer3D ma:
 *   - Render su un singolo canvas 2D del DOM (no WebGL, no Three.js).
 *   - Backing buffer scalato per devicePixelRatio → testo crisp.
 *   - Variazione deterministica del terreno + ombre ovali sotto entita`.
 *   - Vignettatura ai bordi viewport, tinta di zona, fade nero su transizioni.
 *
 * Il world viene disegnato in coordinate logiche (TILE_SIZE px) scalato 2×;
 * l'HUD viene disegnato in coordinate "schermo logico" (480×480) sopra al
 * mondo, sempre sullo stesso ctx (no overlay canvas).
 */

import { SPRITES, drawSpriteScaled, getPlayerSprite } from './sprites.js';
import { TILE_SIZE, getTile } from './tiles.js';
import { getZone, ZONE_W, ZONE_H } from './world.js';

const SCALE = 2;
const VIEW_TILES = 15;
const VIEW_LOGICAL = VIEW_TILES * TILE_SIZE; // 240
const CANVAS_LOGICAL = VIEW_LOGICAL * SCALE; // 480

/* Hash deterministico (x, y, salt) → [0, 1) — usato per le micro-decorazioni
   del terreno (filo d'erba, sassolini, sfumature). */
function hash2(x, y, salt = 0) {
  let h = x * 374761393 + y * 668265263 + salt * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1000) / 1000;
}

/* Mappa kind nemico/NPC → sprite (per riferimento). */
const NPC_SPRITE = {
  elder: 'NPC_ELDER',
  merchant: 'NPC_MERCHANT',
  child: 'NPC_CHILD',
  king: 'NPC_KING',
};

const ENEMY_SPRITE = {
  slime: ['ENEMY_SLIME_0', 'ENEMY_SLIME_1'],
  bat: ['ENEMY_BAT_0', 'ENEMY_BAT_1'],
  skeleton: ['ENEMY_SKELETON_0', 'ENEMY_SKELETON_1'],
  mage: ['ENEMY_MAGE_0'],
  guardian: ['BOSS_GUARDIAN'],
  shadow_king: ['BOSS_SHADOW_KING'],
};

const ITEM_SPRITE = {
  heart: 'ITEM_HEART',
  rupee: 'ITEM_RUPEE',
  key: 'ITEM_KEY',
  house_key: 'ITEM_HOUSE_KEY',
  bomb: 'ITEM_BOMB',
  potion: 'ITEM_POTION',
  sword: 'ITEM_SWORD',
  shield: 'ITEM_SHIELD',
  heart_container: 'ITEM_HEART_CONTAINER',
  crystal_green: 'ITEM_CRYSTAL_GREEN',
  crystal_blue: 'ITEM_CRYSTAL_BLUE',
  crystal_red: 'ITEM_CRYSTAL_RED',
};

/* Tinta d'ambiente per zona (overlay multiplicativo leggero). */
const ZONE_TINT = {
  village: null,
  forest: 'rgba(40, 90, 30, 0.06)',
  cave: 'rgba(20, 10, 40, 0.32)',
  castle: 'rgba(40, 0, 60, 0.22)',
};

export class Renderer2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    /* Backing buffer scalato per crispness su HiDPI */
    canvas.width = CANVAS_LOGICAL * this.dpr;
    canvas.height = CANVAS_LOGICAL * this.dpr;
    /* Lascia che il CSS dimensioni la canvas come gia` impostato dal layout */
    if (!canvas.style.width) canvas.style.width = '100%';
    if (!canvas.style.height) canvas.style.height = 'auto';

    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    /* Stato interno aggiornato dall'engine prima di ogni render. */
    this.zoneId = 'village';
    this.mutableMap = null;
    this.camera = { x: 0, y: 0 };
    this.player = null;
    this.attackState = null;
    this.entities = [];
    this.particles = [];
    this.tickCount = 0;

    /* Effetti */
    this.shakeAmt = 0;     // 0..1
    this.fadeAlpha = 0;    // 0..1
    this.fadeDir = 0;      // -1 fade-out, +1 fade-in, 0 idle
  }

  /* ─── API: aggiornamenti per frame ─── */
  setZone(zoneId, mutableMap) {
    this.zoneId = zoneId;
    this.mutableMap = mutableMap;
  }

  updateMapTile(_x, _y, _ch) {
    /* Il rendering legge sempre da mutableMap, quindi nessuna azione qui. */
  }

  setCamera(camera, _player) {
    this.camera = camera;
  }

  setPlayer(player, attackState) {
    this.player = player;
    this.attackState = attackState;
  }

  setEntities(entities, tickCount) {
    this.entities = entities;
    this.tickCount = tickCount;
  }

  setParticles(particles) {
    this.particles = particles;
  }

  /* ─── Effetti ─── */
  shake(amt = 0.4) {
    this.shakeAmt = Math.min(1, Math.max(this.shakeAmt, amt));
  }

  fadeOut() {
    this.fadeAlpha = 1;
    this.fadeDir = -1;
  }

  getFadeAlpha() {
    return this.fadeAlpha;
  }

  /* ─── Loop di rendering ─── */
  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;

    /* Reset trasformazione + DPR scaling base */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    /* Sfondo zona (riempito sotto al mondo per coprire eventuali bordi) */
    ctx.fillStyle = this._zoneBackground();
    ctx.fillRect(0, 0, CANVAS_LOGICAL, CANVAS_LOGICAL);

    /* ─── Mondo ─── */
    ctx.save();
    /* Camera shake + zoom 2× */
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0) {
      sx = (Math.random() - 0.5) * this.shakeAmt * 8;
      sy = (Math.random() - 0.5) * this.shakeAmt * 8;
      this.shakeAmt *= 0.85;
      if (this.shakeAmt < 0.02) this.shakeAmt = 0;
    }
    ctx.translate(sx, sy);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-this.camera.x, -this.camera.y);

    this._drawGround();
    this._drawObjects();
    this._drawEntities();
    this._drawParticles();
    this._drawAttack();

    ctx.restore();

    /* Tinta zona + vignetta (in coord schermo logico) */
    this._drawZoneTint();
    this._drawVignette();

    /* Fade nero (transizione zona) */
    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
      ctx.fillRect(0, 0, CANVAS_LOGICAL, CANVAS_LOGICAL);
      if (this.fadeDir < 0) {
        this.fadeAlpha -= 0.04;
        if (this.fadeAlpha <= 0) { this.fadeAlpha = 0; this.fadeDir = 0; }
      }
    }
  }

  /* ─── Background zona (colore sotto la mappa) ─── */
  _zoneBackground() {
    switch (this.zoneId) {
      case 'cave':   return '#1a1424';
      case 'castle': return '#1c1030';
      case 'forest': return '#1f3a1a';
      default:       return '#3a8c3a'; // erba villaggio
    }
  }

  /* ─── Layer: terreno (tile ground + path + acqua + lava + fiori) ─── */
  _drawGround() {
    const ctx = this.ctx;
    const map = this.mutableMap;
    if (!map) return;

    const cx0 = Math.floor(this.camera.x / TILE_SIZE);
    const cy0 = Math.floor(this.camera.y / TILE_SIZE);
    const cx1 = Math.min(ZONE_W - 1, cx0 + VIEW_TILES + 1);
    const cy1 = Math.min(ZONE_H - 1, cy0 + VIEW_TILES + 1);

    for (let y = Math.max(0, cy0 - 1); y <= cy1; y++) {
      const row = map[y];
      if (!row) continue;
      for (let x = Math.max(0, cx0 - 1); x <= cx1; x++) {
        const ch = row[x];
        const def = getTile(ch);
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        /* Tile di terreno SEMPRE riempito sotto (per oggetti high-up). */
        this._drawGroundBase(x, y, px, py);

        if (def.layer === 'ground' && def.id !== '.') {
          this._drawGroundTile(def, px, py, x, y);
        }
      }
    }

    /* Reticolo ombre sottili tra tile (effetto Minish Cap "shading bands") */
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = Math.max(0, cy0); y <= cy1; y++) {
      ctx.fillRect(cx0 * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - 1,
                   (cx1 - cx0 + 1) * TILE_SIZE, 1);
    }
  }

  /* Erba di base: variazione deterministica leggera per evitare il
     "tappeto verde piatto". */
  _drawGroundBase(x, y, px, py) {
    const ctx = this.ctx;
    const r = hash2(x, y, 7);
    let col;
    if (r < 0.15) col = '#3f8030';        // verde scuro
    else if (r < 0.92) col = '#4a8c34';   // verde base
    else col = '#5fa040';                 // verde chiaro

    /* Per zone non-erba, usa colore neutro */
    if (this.zoneId === 'cave' || this.zoneId === 'castle') {
      col = (x + y) % 2 === 0 ? '#3a3848' : '#332f40';
    } else if (this.zoneId === 'forest') {
      col = r < 0.5 ? '#357a2a' : '#3f8a30';
    }

    ctx.fillStyle = col;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    /* Filo d'erba decorativo (solo zone esterne, raro) */
    if ((this.zoneId === 'village' || this.zoneId === 'forest')
        && r > 0.62 && r < 0.72) {
      const r2 = hash2(x, y, 13);
      const dx = Math.floor(r2 * (TILE_SIZE - 4)) + 2;
      const dy = Math.floor(hash2(x, y, 19) * (TILE_SIZE - 4)) + 2;
      ctx.fillStyle = '#266b26';
      ctx.fillRect(px + dx, py + dy + 1, 1, 2);
      ctx.fillStyle = '#5fb35f';
      ctx.fillRect(px + dx, py + dy, 1, 1);
    }
  }

  _drawGroundTile(def, px, py, tx, ty) {
    const ctx = this.ctx;
    if (def.id === '~') {
      /* Acqua animata + spuma */
      const phase = Math.floor(this.tickCount / 30) % 2;
      const a = phase ? '#3a78c0' : '#5fa0e0';
      const b = phase ? '#5fa0e0' : '#3a78c0';
      ctx.fillStyle = a;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      /* Onde */
      ctx.fillStyle = b;
      const wy = (Math.floor(this.tickCount / 6) + tx + ty) % TILE_SIZE;
      ctx.fillRect(px + 2, py + wy, TILE_SIZE - 4, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px + 2, py + ((wy + 4) % TILE_SIZE), 4, 1);
      return;
    }
    if (def.id === 'L') {
      /* Lava: caldo pulsante */
      const t = this.tickCount * 0.1 + tx * 0.5 + ty * 0.7;
      const k = (Math.sin(t) + 1) * 0.5;
      ctx.fillStyle = '#d23a1a';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = `rgba(255,200,80,${0.3 + k * 0.4})`;
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      return;
    }
    if (def.id === '_') {
      /* Sentiero terra battuta */
      ctx.fillStyle = '#c8a878';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#a88858';
      const r = hash2(tx, ty, 3);
      if (r < 0.5) ctx.fillRect(px + Math.floor(r * 12) + 1,
                                py + Math.floor(hash2(tx, ty, 5) * 12) + 1, 2, 2);
      return;
    }
    if (def.id === ':') {
      ctx.fillStyle = '#e8c896';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (def.id === 'F') {
      /* Pavimento castello/dungeon: piastrelle */
      const dark = (tx + ty) % 2 === 0;
      ctx.fillStyle = dark ? '#5a5868' : '#6a6878';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      return;
    }
    if (def.id === ',') {
      /* Erba con fiore: erba di base sotto + fiore sopra */
      const fr = hash2(tx, ty, 11);
      const fcol = fr < 0.33 ? '#ff7a7a' : fr < 0.66 ? '#fff5dd' : '#f0c850';
      ctx.fillStyle = fcol;
      ctx.fillRect(px + 6, py + 6, 2, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(px + 6, py + 6, 1, 1);
      return;
    }
    if (def.id === 'X') {
      ctx.fillStyle = '#7a4a25';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (def.id === 'P' || def.id === 'p2') {
      /* Piastra a pressione */
      const pressed = def.id === 'p2';
      ctx.fillStyle = pressed ? '#866020' : '#b88830';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.strokeStyle = '#604010';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
      return;
    }
    /* Fallback: usa lo sprite originale se esiste */
    const sp = SPRITES[def.sprite];
    if (sp) drawSpriteScaled(ctx, sp, px, py, TILE_SIZE, TILE_SIZE);
  }

  /* ─── Layer: oggetti (alberi, muri, case, casse, torce, portali) ─── */
  _drawObjects() {
    const ctx = this.ctx;
    const map = this.mutableMap;
    if (!map) return;

    const cx0 = Math.floor(this.camera.x / TILE_SIZE);
    const cy0 = Math.floor(this.camera.y / TILE_SIZE);
    const cx1 = Math.min(ZONE_W - 1, cx0 + VIEW_TILES + 1);
    const cy1 = Math.min(ZONE_H - 1, cy0 + VIEW_TILES + 1);

    /* Pass 1: ombre sotto oggetti alti */
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    for (let y = Math.max(0, cy0); y <= cy1; y++) {
      const row = map[y];
      if (!row) continue;
      for (let x = Math.max(0, cx0); x <= cx1; x++) {
        const ch = row[x];
        const def = getTile(ch);
        if (def.layer !== 'object') continue;
        if (ch === '*' || ch === 'P' || ch === 'p2'
            || ch === 't' || ch === 'l' || ch === 'A' || ch === 'd') continue;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.beginPath();
        ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2,
                    TILE_SIZE / 2 - 1, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Pass 2: oggetti veri */
    for (let y = Math.max(0, cy0); y <= cy1; y++) {
      const row = map[y];
      if (!row) continue;
      for (let x = Math.max(0, cx0); x <= cx1; x++) {
        const ch = row[x];
        const def = getTile(ch);
        if (def.layer !== 'object') continue;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        this._drawObjectTile(def, ch, px, py, x, y);
      }
    }
  }

  _drawObjectTile(def, ch, px, py, tx, ty) {
    const ctx = this.ctx;

    if (ch === '*') {
      /* Portale magico: cerchio pulsante */
      const t = this.tickCount * 0.15;
      const r = 6 + Math.sin(t) * 1.5;
      const grad = ctx.createRadialGradient(
        px + TILE_SIZE / 2, py + TILE_SIZE / 2, 0,
        px + TILE_SIZE / 2, py + TILE_SIZE / 2, r);
      grad.addColorStop(0, '#ff5af0');
      grad.addColorStop(0.6, '#b870d0');
      grad.addColorStop(1, 'rgba(120,60,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (ch === 't' || ch === 'l') {
      /* Torcia: base + fiamma animata se accesa */
      ctx.fillStyle = '#4a2812';
      ctx.fillRect(px + 6, py + 6, 4, 10);
      ctx.fillStyle = '#7a4a25';
      ctx.fillRect(px + 7, py + 6, 2, 10);
      if (ch === 'l') {
        const f = (Math.floor(this.tickCount / 4) % 2);
        ctx.fillStyle = '#ffaa30';
        ctx.fillRect(px + 6, py + 2 - f, 4, 4 + f);
        ctx.fillStyle = '#ffe040';
        ctx.fillRect(px + 7, py + 3 - f, 2, 2);
        /* Glow */
        const glow = ctx.createRadialGradient(
          px + 8, py + 4, 1, px + 8, py + 4, 14);
        glow.addColorStop(0, 'rgba(255,170,48,0.5)');
        glow.addColorStop(1, 'rgba(255,170,48,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(px - 6, py - 10, 28, 28);
      }
      return;
    }

    if (ch === 'T') {
      /* Albero stile Minish: tronco + chioma rotonda con highlight */
      ctx.fillStyle = '#4a2812';
      ctx.fillRect(px + 6, py + 11, 4, 5);
      /* Chioma */
      ctx.fillStyle = '#266b26';
      ctx.beginPath();
      ctx.arc(px + 8, py + 7, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a8c3a';
      ctx.beginPath();
      ctx.arc(px + 6, py + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5fb35f';
      ctx.beginPath();
      ctx.arc(px + 5, py + 4, 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (ch === 'S') {
      /* Sasso */
      ctx.fillStyle = '#666e78';
      ctx.beginPath();
      ctx.arc(px + 8, py + 9, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a929c';
      ctx.beginPath();
      ctx.arc(px + 6, py + 7, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (ch === 'b') {
      /* Cespuglio */
      ctx.fillStyle = '#1f5a1f';
      ctx.beginPath();
      ctx.arc(px + 8, py + 10, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a8c3a';
      ctx.beginPath();
      ctx.arc(px + 7, py + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5fb35f';
      ctx.fillRect(px + 5, py + 6, 2, 2);
      return;
    }

    if (ch === 'p' || ch === 'q') {
      /* Vaso */
      const accent = ch === 'q' ? '#f0c850' : '#a87045';
      const body = ch === 'q' ? '#b88830' : '#7a4a25';
      ctx.fillStyle = body;
      ctx.fillRect(px + 4, py + 5, 8, 9);
      ctx.fillStyle = accent;
      ctx.fillRect(px + 3, py + 4, 10, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(px + 5, py + 6, 1, 6);
      return;
    }

    if (ch === 'B') {
      /* Blocco spingibile */
      ctx.fillStyle = '#9c8060';
      ctx.fillRect(px + 1, py + 1, 14, 14);
      ctx.fillStyle = '#6a4830';
      ctx.fillRect(px + 1, py + 13, 14, 2);
      ctx.fillRect(px + 13, py + 1, 2, 14);
      ctx.fillStyle = '#c8a878';
      ctx.fillRect(px + 1, py + 1, 14, 1);
      ctx.fillRect(px + 1, py + 1, 1, 14);
      return;
    }

    if (ch === 'D' || ch === 'd') {
      /* Porta dungeon */
      const open = ch === 'd';
      ctx.fillStyle = open ? '#1a1424' : '#4a2812';
      ctx.fillRect(px + 2, py + 1, 12, 14);
      if (!open) {
        ctx.fillStyle = '#7a4a25';
        ctx.fillRect(px + 3, py + 2, 10, 12);
        ctx.fillStyle = '#f0c850';
        ctx.fillRect(px + 11, py + 8, 2, 2);
      }
      return;
    }

    if (ch === 'W') {
      /* Muro pietra */
      ctx.fillStyle = '#4a4a55';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#5a5a65';
      ctx.fillRect(px, py, TILE_SIZE, 4);
      ctx.fillStyle = '#3a3a45';
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const off = (tx + ty) % 2 === 0 ? 4 : 0;
      ctx.moveTo(px + off, py + 4); ctx.lineTo(px + off, py + 12);
      ctx.moveTo(px + 8 + off, py + 4); ctx.lineTo(px + 8 + off, py + 12);
      ctx.moveTo(px, py + 8); ctx.lineTo(px + TILE_SIZE, py + 8);
      ctx.stroke();
      return;
    }

    if (ch === '1' || ch === '2' || ch === '3') {
      /* Tetto rosso casa */
      ctx.fillStyle = '#8e1818';
      ctx.fillRect(px, py + 2, TILE_SIZE, TILE_SIZE - 2);
      ctx.fillStyle = '#b82a2a';
      ctx.fillRect(px, py + 2, TILE_SIZE, 3);
      ctx.fillStyle = '#5a0e0e';
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
      /* Listelli verticali */
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + 4, py + TILE_SIZE);
      ctx.moveTo(px + 12, py + 4); ctx.lineTo(px + 12, py + TILE_SIZE);
      ctx.stroke();
      return;
    }

    if (ch === '7' || ch === '8' || ch === '9') {
      /* Muro casa beige */
      ctx.fillStyle = '#fff5dd';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#d6c8a8';
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
      if (ch === '8') {
        /* Finestra */
        ctx.fillStyle = '#7ab4f0';
        ctx.fillRect(px + 4, py + 4, 8, 8);
        ctx.fillStyle = '#3a72c8';
        ctx.fillRect(px + 4, py + 4, 8, 1);
        ctx.fillRect(px + 4, py + 4, 1, 8);
        ctx.fillStyle = '#fff5dd';
        ctx.fillRect(px + 7, py + 4, 1, 8);
        ctx.fillRect(px + 4, py + 7, 8, 1);
      }
      return;
    }

    if (ch === '0' || ch === 'A') {
      const open = ch === 'A';
      /* Stipite */
      ctx.fillStyle = '#fff5dd';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      /* Anta */
      ctx.fillStyle = open ? '#1a1424' : '#7a4a25';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 2);
      if (!open) {
        ctx.fillStyle = '#4a2812';
        ctx.fillRect(px + 8, py + TILE_SIZE / 2, 1, 4);
        ctx.fillStyle = '#f0c850';
        ctx.fillRect(px + 11, py + TILE_SIZE / 2, 2, 2);
      }
      return;
    }

    if (ch === 'C') {
      /* Fontana */
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(px + 8, py + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5fa0e0';
      ctx.beginPath();
      ctx.arc(px + 8, py + 9, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(px + 7, py + 7, 2, 1);
      return;
    }

    if (ch === 'H' || ch === 'h') {
      /* House roof / door — riusa lo sprite */
      const sp = SPRITES[def.sprite];
      if (sp) drawSpriteScaled(ctx, sp, px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    /* Fallback generico: sprite originale */
    const sp = SPRITES[def.sprite];
    if (sp) drawSpriteScaled(ctx, sp, px, py, TILE_SIZE, TILE_SIZE);
  }

  /* ─── Layer: entita` (NPC, nemici, item, boss, projectile) + player ─── */
  _drawEntities() {
    /* Ordina per Y per overlap "isometrico" leggero */
    const list = [];
    for (const e of this.entities) {
      if (e.hp <= 0 && e.type !== 'item' && e.type !== 'projectile') continue;
      list.push(e);
    }
    /* Player tra le entita` per ordering Y */
    const p = this.player;
    if (p) list.push({ __isPlayer: true, x: p.x, y: p.y });
    list.sort((a, b) => (a.y - b.y));

    for (const e of list) {
      if (e.__isPlayer) {
        this._drawPlayer();
      } else {
        this._drawEntity(e);
      }
    }
  }

  _drawEntityShadow(x, y, w = TILE_SIZE - 2) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEntity(e) {
    const ctx = this.ctx;
    const cx = e.x;
    const cy = e.y;
    const half = TILE_SIZE / 2;

    if (e.type === 'item') {
      /* Bobbing leggero */
      const yOff = Math.sin(this.tickCount * 0.12 + e.x * 0.1) * 1.2;
      this._drawEntityShadow(cx, cy + half - 2);
      const key = ITEM_SPRITE[e.kind];
      const sp = key && SPRITES[key];
      if (sp) {
        drawSpriteScaled(ctx, sp, cx - half + 2, cy - half + 2 + yOff,
                         TILE_SIZE - 4, TILE_SIZE - 4);
      } else {
        ctx.fillStyle = '#f0c850';
        ctx.fillRect(cx - 3, cy - 3 + yOff, 6, 6);
      }
      /* Sparkle */
      if ((this.tickCount + e.x) % 60 < 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(cx + 4, cy - 5 + yOff, 1, 1);
      }
      return;
    }

    if (e.type === 'projectile') {
      ctx.fillStyle = '#b870d0';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(cx - 1, cy - 1, 1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (e.type === 'npc') {
      this._drawEntityShadow(cx, cy + half - 1);
      const key = NPC_SPRITE[e.kind];
      const sp = key && SPRITES[key];
      if (sp) {
        drawSpriteScaled(ctx, sp, cx - half, cy - half, TILE_SIZE, TILE_SIZE);
      }
      /* Indicatore "!" sopra NPC con dialogo disponibile (bobbing) */
      if (e.dialog) {
        const t = this.tickCount * 0.12;
        const yo = Math.sin(t) * 1.2;
        ctx.fillStyle = '#fff5b0';
        ctx.fillRect(cx - 1, cy - half - 6 + yo, 2, 4);
        ctx.fillRect(cx - 1, cy - half - 1 + yo, 2, 1);
      }
      return;
    }

    if (e.type === 'enemy' || e.type === 'boss') {
      const isBoss = e.type === 'boss';
      const w = isBoss ? TILE_SIZE * 1.6 : TILE_SIZE - 2;
      this._drawEntityShadow(cx, cy + half - 1, w);

      /* Lampeggio durante iframes */
      if (e.iframes > 0 && (e.iframes % 6) < 3) {
        ctx.globalAlpha = 0.4;
      }

      const sprites = ENEMY_SPRITE[e.kind];
      if (sprites) {
        const f = sprites[Math.floor(this.tickCount / 12) % sprites.length];
        const sp = SPRITES[f];
        const size = isBoss ? TILE_SIZE * 2 : TILE_SIZE;
        if (sp) drawSpriteScaled(ctx, sp, cx - size / 2, cy - size / 2, size, size);
      } else {
        ctx.fillStyle = '#d23a3a';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
      }
      ctx.globalAlpha = 1;

      /* Barra HP per boss e nemici medi */
      if (e.maxHp > 1 && (isBoss || e.maxHp > 2)) {
        const w2 = isBoss ? 30 : 16;
        const h2 = isBoss ? 3 : 2;
        const hpx = cx - w2 / 2;
        const hpy = cy - half - (isBoss ? 14 : 8);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(hpx - 1, hpy - 1, w2 + 2, h2 + 2);
        ctx.fillStyle = '#3a8c3a';
        ctx.fillRect(hpx, hpy, Math.max(0, w2 * (e.hp / e.maxHp)), h2);
      }
    }
  }

  _drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    if (!p) return;
    const cx = p.x;
    const cy = p.y;
    const half = TILE_SIZE / 2;

    this._drawEntityShadow(cx, cy + half - 1);

    /* Lampeggio iframes */
    if (p.iframes > 0 && (p.iframes % 6) < 3) {
      ctx.globalAlpha = 0.4;
    }
    const attacking = !!this.attackState;
    const frame = Math.floor(this.tickCount / 10) % 2;
    const sp = getPlayerSprite(p.dir, frame, attacking);
    if (sp) drawSpriteScaled(ctx, sp, cx - half, cy - half, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = 1;
  }

  /* ─── Slash arc spada ─── */
  _drawAttack() {
    const a = this.attackState;
    if (!a || !this.player) return;
    const ctx = this.ctx;
    const p = this.player;
    const t = a.frame / 14; // 0..1
    if (t > 1) return;

    /* Origine al centro player, leggermente avanti nella direzione */
    let ox = p.x, oy = p.y;
    let baseAng;
    if (p.dir === 'up')    { oy -= 10; baseAng = -Math.PI / 2; }
    else if (p.dir === 'down')  { oy += 10; baseAng =  Math.PI / 2; }
    else if (p.dir === 'left')  { ox -= 10; baseAng =  Math.PI; }
    else                        { ox += 10; baseAng =  0; }

    /* Arco di 110° che spazza */
    const sweep = (Math.PI / 180) * 110;
    const startA = baseAng - sweep / 2 + sweep * t;
    const grad = ctx.createRadialGradient(ox, oy, 2, ox, oy, 14);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, 14, startA - 0.18, startA + 0.18);
    ctx.closePath();
    ctx.fill();
  }

  /* ─── Particelle ─── */
  _drawParticles() {
    const ctx = this.ctx;
    for (const pa of this.particles) {
      const a = Math.max(0, pa.life / pa.maxLife);
      ctx.fillStyle = pa.col || '#ffffff';
      ctx.globalAlpha = a;
      ctx.fillRect(Math.round(pa.x - 1), Math.round(pa.y - 1), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ─── Tinta zona (in coord schermo) ─── */
  _drawZoneTint() {
    const tint = ZONE_TINT[this.zoneId];
    if (!tint) return;
    this.ctx.fillStyle = tint;
    this.ctx.fillRect(0, 0, CANVAS_LOGICAL, CANVAS_LOGICAL);
  }

  /* ─── Vignettatura morbida ai bordi ─── */
  _drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      CANVAS_LOGICAL / 2, CANVAS_LOGICAL / 2, CANVAS_LOGICAL * 0.35,
      CANVAS_LOGICAL / 2, CANVAS_LOGICAL / 2, CANVAS_LOGICAL * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_LOGICAL, CANVAS_LOGICAL);
  }

  /* ─── Teardown ─── */
  dispose() {
    /* Ripristina default canvas */
    try {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } catch { /* ignored */ }
  }
}

/* Costanti utili per chi consuma il renderer */
export { CANVAS_LOGICAL, SCALE, VIEW_LOGICAL, VIEW_TILES };

/* getZone: re-export per compatibilita` */
export { getZone };
