/**
 * Andryx Hourglass — Renderer 3D (Three.js) con overlay HUD 2D.
 *
 * Sostituisce render.js: il canvas principale ospita una scena Three.js;
 * un canvas 2D overlay trasparente (HUD) viene sovrapposto per cuori,
 * timer, dialoghi, inventario e tutti gli elementi UI flat.
 *
 * Le scene 3D chiamano setup3D(renderer3d) una volta per costruire la scena
 * e syncMeshes(state) ogni frame per aggiornare le posizioni dei mesh.
 */
import * as THREE from 'three';
import { drawSprite, getSprite } from './sprites.js';
import { t } from './i18n.js';
import { C } from './palette.js';

export const CANVAS_W = 480;
export const CANVAS_H = 480;

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;

    /* Renderer WebGL */
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(CANVAS_W, CANVAS_H, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    /* Scena Three.js condivisa tra tutte le scene di gioco */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a4080);

    /* Camera prospettica top-down leggermente inclinata (stile Minish Cap) */
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(0, 18, 12);
    this.camera.lookAt(0, 0, 0);

    /* Luci ambientali e direzionali con ombre */
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.dirLight = new THREE.DirectionalLight(0xfff5c0, 1.2);
    this.dirLight.position.set(10, 20, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left  = -25;
    this.dirLight.shadow.camera.right  = 25;
    this.dirLight.shadow.camera.top    = 25;
    this.dirLight.shadow.camera.bottom = -25;
    this.scene.add(this.ambientLight, this.dirLight);

    /* Canvas 2D overlay per HUD/dialoghi/inventario */
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:10;';
    if (canvas.parentElement) canvas.parentElement.appendChild(this.hudCanvas);
    this.hudCtx = this.hudCanvas.getContext('2d');

    /* Stato fade / shake / toast */
    this.shake = 0;
    this.fade  = 0;
    this.fadeDir  = 0;
    this._fadeMidCb = null;
    this.toast = { text: '', timer: 0 };

    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._applyHudScale();
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */

  _applyHudScale() {
    const dpr = this._dpr;
    this.hudCanvas.width  = CANVAS_W * dpr;
    this.hudCanvas.height = CANVAS_H * dpr;
    this.hudCanvas.style.width  = '100%';
    this.hudCanvas.style.height = '100%';
    const ctx = this.hudCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._applyHudScale();
  }

  dispose() {
    this.hudCanvas.remove();
    this.renderer.dispose();
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  /** Esegue il render Three.js (WebGL). */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** No-op: compatibilità con chiamate clear() del vecchio engine. */
  clear(_color) {}

  /** Pulisce l'overlay HUD 2D. Chiamare all'inizio di ogni frame HUD. */
  clearHud() {
    const ctx = this.hudCtx;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /* ------------------------------------------------------------------ */
  /* Fade                                                                */
  /* ------------------------------------------------------------------ */

  startFadeOut(onMid) { this.fadeDir = 1; this._fadeMidCb = onMid; }
  startFadeIn()       { this.fadeDir = -1; this.fade = 1; }

  updateFade() {
    if (this.fadeDir > 0) {
      this.fade = Math.min(1, this.fade + 0.05);
      if (this.fade >= 1 && this._fadeMidCb) {
        const cb = this._fadeMidCb;
        this._fadeMidCb = null;
        cb();
        this.fadeDir = -1;
      }
    } else if (this.fadeDir < 0) {
      this.fade = Math.max(0, this.fade - 0.05);
      if (this.fade <= 0) this.fadeDir = 0;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Camera shake                                                        */
  /* ------------------------------------------------------------------ */

  triggerShake(intensity = 1) { this.shake = Math.max(this.shake, intensity * 8); }
  updateShake() { if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6); }

  applyShakeOffset() {
    if (this.shake <= 0) return { ox: 0, oy: 0 };
    return {
      ox: (Math.random() * 2 - 1) * this.shake,
      oy: (Math.random() * 2 - 1) * this.shake,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */

  showToast(text, frames = 90) { this.toast.text = text; this.toast.timer = frames; }
  updateToast() { if (this.toast.timer > 0) this.toast.timer--; }

  /* ------------------------------------------------------------------ */
  /* Disegno HUD / UI su canvas 2D overlay                              */
  /* ------------------------------------------------------------------ */

  /** Box stile pergamena (per dialoghi/menu). */
  drawPanel(x, y, w, h) {
    const c = this.hudCtx;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(x + 3, y + 4, w, h);
    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(28,38,90,0.97)');
    grad.addColorStop(1, 'rgba(10,14,40,0.97)');
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
    c.strokeStyle = C.gold;
    c.lineWidth = 2;
    c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.strokeStyle = 'rgba(240,200,80,0.45)';
    c.lineWidth = 1;
    c.strokeRect(x + 5, y + 5, w - 10, h - 10);
  }

  /** Word-wrap helper. */
  wrapText(text, maxW, font) {
    const c = this.hudCtx;
    c.font = font;
    const out = [];
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (c.measureText(test).width > maxW && cur) {
          out.push(cur); cur = w;
        } else cur = test;
      }
      if (cur) out.push(cur);
    }
    return out;
  }

  /** HUD compatto in cima: HP, rupie, timer, nome scena. */
  drawHud(state) {
    const c = this.hudCtx;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, 0, CANVAS_W, 14);

    /* Cuori */
    const fullHearts = Math.floor(state.hp / 2);
    const half  = state.hp % 2 === 1;
    const total = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < total; i++) {
      const hx = 4 + i * 13, hy = 1;
      if (i < fullHearts) {
        drawSprite(c, 'item_heart', hx, hy, 12, 12);
      } else if (i === fullHearts && half) {
        c.save();
        c.beginPath(); c.rect(hx, hy, 6, 12); c.clip();
        drawSprite(c, 'item_heart', hx, hy, 12, 12);
        c.restore();
        c.strokeStyle = 'rgba(255,80,80,0.6)';
        c.lineWidth = 1;
        c.strokeRect(hx + 1, hy + 1, 10, 10);
      } else {
        c.strokeStyle = 'rgba(255,80,80,0.5)';
        c.lineWidth = 1;
        c.strokeRect(hx + 1, hy + 1, 10, 10);
      }
    }

    /* Rupie */
    drawSprite(c, 'item_rupee', CANVAS_W - 70, 0, 14, 14);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 12px monospace';
    c.textAlign = 'left';
    c.fillText(state.rupees.toString().padStart(3, '0'), CANVAS_W - 54, 11);

    /* Score */
    c.fillStyle = '#d0e0ff';
    c.font = '11px monospace';
    c.textAlign = 'right';
    c.fillText(`\u2746 ${state.score}`, CANVAS_W - 4, 11);

    /* Timer Phantom Hourglass (solo nel tempio) */
    if (state.sceneId === 'temple') {
      const m   = Math.floor(state.hourglassMs / 60000);
      const s   = Math.floor((state.hourglassMs % 60000) / 1000);
      const pct = state.hourglassMs / state.hourglassMax;
      const tx  = (CANVAS_W - 90) / 2;
      const ty  = 16;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(tx, ty, 90, 14);
      const barCol = state.inSafeZone ? C.safe_zone : (pct < 0.25 ? C.red : C.hourglass_glow);
      c.fillStyle = barCol;
      c.fillRect(tx + 2, ty + 2, 86 * pct, 10);
      c.strokeStyle = C.gold;
      c.lineWidth = 1;
      c.strokeRect(tx + 0.5, ty + 0.5, 89, 13);
      c.fillStyle = '#1c1410';
      c.font = 'bold 10px monospace';
      c.textAlign = 'center';
      c.fillText(`\u231b ${m}:${s.toString().padStart(2, '0')}`, tx + 45, ty + 11);
    }

    /* Nome scena */
    c.fillStyle = '#a8b8d8';
    c.font = '10px monospace';
    c.textAlign = 'left';
    c.fillText(`\ud83d\udccd ${t('scene.' + state.sceneId)}`, 4, 26);
  }

  /** Dialog box stile Phantom Hourglass (pergamena in basso). */
  drawDialog(dialog) {
    if (!dialog) return;
    const c = this.hudCtx;
    const boxH = 96, boxY = CANVAS_H - boxH - 6;
    const boxX = 8,  boxW = CANVAS_W - 16;
    this.drawPanel(boxX, boxY, boxW, boxH);

    c.fillStyle = C.gold;
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText(dialog.speaker || '', boxX + 12, boxY + 18);

    c.strokeStyle = 'rgba(240,200,80,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(boxX + 10, boxY + 24);
    c.lineTo(boxX + boxW - 10, boxY + 24);
    c.stroke();

    const fullLine = dialog.lines[dialog.lineIdx] || '';
    const visible  = fullLine.substring(0, Math.floor(dialog.charIdx));
    const wrapped  = this.wrapText(visible, boxW - 24, '13px monospace');
    c.fillStyle = '#fff5b0';
    c.font = '13px monospace';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur  = 3;
    for (let i = 0; i < Math.min(4, wrapped.length); i++) {
      c.fillText(wrapped[i], boxX + 12, boxY + 42 + i * 16);
    }
    c.shadowBlur = 0;

    if (dialog.charIdx >= fullLine.length) {
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      if (blink) {
        c.fillStyle = C.gold;
        c.font = 'bold 14px monospace';
        c.textAlign = 'right';
        c.fillText(t('dialog.next'), boxX + boxW - 12, boxY + boxH - 8);
      }
    }
  }

  /** Schermata inventario completa (overlay). */
  drawInventory(state, anim) {
    if (anim <= 0) return;
    const c = this.hudCtx;
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.65 * anim})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.globalAlpha = anim;

    const pw = 440, ph = 444;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 + (1 - anim) * 16;
    this.drawPanel(px, py, pw, ph);

    c.fillStyle = '#fff5b0';
    c.font = 'bold 22px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur  = 5;
    c.fillText(t('ui.inventory_title'), CANVAS_W / 2, py + 32);
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(240,200,80,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px + 20, py + 42); c.lineTo(px + pw - 20, py + 42);
    c.stroke();

    /* Cuori */
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText(`\u2665 ${t('ui.hp')}`, px + 18, py + 64);
    const fullH = Math.floor(state.hp / 2);
    const halfH = state.hp % 2 === 1;
    const totH  = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < totH; i++) {
      const hx = px + 90 + i * 16, hy = py + 54;
      if (i < fullH) drawSprite(c, 'item_heart', hx, hy, 14, 14);
      else if (i === fullH && halfH) {
        c.save(); c.beginPath(); c.rect(hx, hy, 7, 14); c.clip();
        drawSprite(c, 'item_heart', hx, hy, 14, 14); c.restore();
      } else {
        c.strokeStyle = 'rgba(255,80,80,0.5)';
        c.lineWidth = 1;
        c.strokeRect(hx + 2, hy + 2, 10, 10);
      }
    }

    /* Oggetti */
    let sy = py + 84;
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.fillText(t('ui.items'), px + 18, sy);
    const slot = 36, sp = 8;
    const items = [
      { spr: 'item_sword',     have: state.items.sword,          count: null,               label: t('ui.item_sword') },
      { spr: 'item_shield',    have: state.items.shield,         count: null,               label: t('ui.item_shield') },
      { spr: 'item_boomerang', have: state.items.boomerang,      count: null,               label: t('ui.item_boomerang') },
      { spr: 'item_bomb',      have: state.items.bombs > 0,      count: state.items.bombs,  label: t('ui.item_bombs') },
      { spr: 'item_bow',       have: state.items.bow,            count: state.items.arrows, label: t('ui.item_bow') },
      { spr: 'item_potion',    have: state.items.potions > 0,    count: state.items.potions,label: t('ui.item_potion') },
    ];
    for (let i = 0; i < items.length; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const sx  = px + 18 + col * (slot + sp + 80);
      const ssy = sy + 8 + row * (slot + 18);
      this._drawSlot(sx, ssy, slot, items[i].have);
      const it = items[i];
      c.save();
      if (!it.have) c.globalAlpha = anim * 0.3;
      drawSprite(c, it.spr, sx + 4, ssy + 4, slot - 8, slot - 8);
      c.restore();
      c.fillStyle = it.have ? '#fff5b0' : 'rgba(255,245,176,0.4)';
      c.font = '11px monospace';
      c.fillText(it.label, sx + slot + 4, ssy + 14);
      if (it.count != null) {
        c.fillStyle = '#d4e0ff';
        c.font = 'bold 13px monospace';
        c.fillText(`\xd7 ${it.count}`, sx + slot + 4, ssy + 30);
      }
    }

    /* Quest */
    sy = py + 232;
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.fillText(t('ui.quest'), px + 18, sy);
    const qLine  = this._questLine(state);
    const qLines = this.wrapText(qLine, pw - 36, '12px monospace');
    c.fillStyle = '#d4e0ff';
    c.font = '12px monospace';
    for (let i = 0; i < Math.min(3, qLines.length); i++) {
      c.fillText(qLines[i], px + 18, sy + 22 + i * 16);
    }

    /* Stats */
    sy = py + 322;
    c.fillStyle = '#a8b8d8';
    c.font = '12px monospace';
    c.fillText(`\u2620 ${state.kills}  \xb7  \ud83d\udc8e ${state.rupees}  \xb7  \ud83d\udddd ${state.items.keys}  \xb7  \u2746 ${state.score}`, px + 18, sy);

    /* Hint */
    c.fillStyle = 'rgba(240,200,80,0.85)';
    c.font = '11px monospace';
    c.textAlign = 'center';
    c.fillText(
      '[I/Tab/M] ' + t('ui.close') + '  \xb7  [P] ' + t('ui.use') + ' ' + t('ui.item_potion'),
      CANVAS_W / 2, py + ph - 14,
    );
    c.textAlign = 'left';
    c.restore();
  }

  _drawSlot(x, y, size, highlight) {
    const c = this.hudCtx;
    c.fillStyle = highlight ? 'rgba(60,80,140,0.85)' : 'rgba(20,28,60,0.85)';
    c.fillRect(x, y, size, size);
    c.strokeStyle = highlight ? C.gold : 'rgba(240,200,80,0.5)';
    c.lineWidth = highlight ? 2 : 1;
    c.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  _questLine(state) {
    const f = state.flags;
    if (f.win) return t('ui.score') + ' finale: ' + state.score;
    if (f.defeated_phantom_lord) return 'Hai sconfitto il Re del Mare. La maledizione si dissolve.';
    if (state.items.boomerang && !f.defeated_phantom_lord) return 'Torna al Tempio del Re del Mare con il Boomerang.';
    if (state.items.sword && !state.items.boomerang) return 'Salpa verso il Tempio del Fuoco e ottieni il Boomerang.';
    if (state.flags.met_oshus && !state.items.sword) return "Prendi la spada da Oshus a Mercay.";
    return "Parla con Oshus all'inizio dell'isola di Mercay.";
  }

  /** Overlay pausa. */
  drawPause() {
    const c = this.hudCtx;
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 36px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur  = 6;
    c.fillText(t('ui.pause'), CANVAS_W / 2, CANVAS_H / 2 - 10);
    c.font = '14px monospace';
    c.fillText('[ESC] ' + t('ui.resume'), CANVAS_W / 2, CANVAS_H / 2 + 24);
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }

  /** Loading screen tra scene. */
  drawLoading(text) {
    const c = this.hudCtx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = C.gold;
    c.font = 'bold 16px monospace';
    c.textAlign = 'center';
    c.fillText(text || t('ui.loading'), CANVAS_W / 2, CANVAS_H / 2);
    const a = Date.now() / 300;
    c.fillStyle = '#fff5b0';
    c.beginPath();
    c.arc(CANVAS_W / 2 + Math.cos(a) * 40, CANVAS_H / 2 + 40 + Math.sin(a) * 6, 4, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'left';
  }

  /** Game-over overlay. */
  drawGameOver(text, sub) {
    const c = this.hudCtx;
    c.fillStyle = 'rgba(0,0,0,0.75)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = C.red;
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur  = 6;
    c.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);
    if (sub) {
      c.fillStyle = '#fff5b0';
      c.font = '14px monospace';
      c.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 16);
    }
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }

  /** Win overlay. */
  drawWin() {
    const c = this.hudCtx;
    c.fillStyle = 'rgba(240,200,80,0.45)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur  = 6;
    c.fillText('\u2746 VITTORIA \u2746', CANVAS_W / 2, CANVAS_H / 2 - 10);
    c.font = '14px monospace';
    c.fillText('Il Re del Mare \xe8 sconfitto.', CANVAS_W / 2, CANVAS_H / 2 + 16);
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }

  /** Toast banner sopra l'azione. */
  drawToast() {
    if (!this.toast.timer || !this.toast.text) return;
    const c = this.hudCtx;
    const a = this.toast.timer > 60 ? 1 : this.toast.timer / 60;
    c.save();
    c.globalAlpha = a;
    c.font = 'bold 14px monospace';
    const text = this.toast.text;
    const w = c.measureText(text).width + 24;
    const h = 26;
    const x = (CANVAS_W - w) / 2, y = 16;
    c.fillStyle = 'rgba(8,12,40,0.92)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = C.gold;
    c.lineWidth = 1.5;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.fillStyle = '#fff5b0';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur  = 3;
    c.fillText(text, CANVAS_W / 2, y + h / 2);
    c.shadowBlur = 0;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.restore();
  }

  /** Fade-out overlay sopra tutto. */
  drawFade() {
    if (this.fade <= 0) return;
    const c = this.hudCtx;
    c.fillStyle = `rgba(0,0,0,${this.fade})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

/* Re-export per chi usa drawSprite / getSprite da render.js */
export { drawSprite, getSprite };
