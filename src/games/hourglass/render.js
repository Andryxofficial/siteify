/**
 * Andryx Hourglass — Renderer base e HUD/UI condivisa tra tutte le scene.
 *
 * Il canvas reale e` 480×480 (CSS), backing buffer scalato per devicePixelRatio.
 * Le scene disegnano sulla "view logica" 240×240 (DS-like top screen) scalata 2×;
 * la metà inferiore (240×240) e` riservata a HUD/inventario/mappa.
 *
 * Questa classe NON renderizza scene: espone solo il `ctx` + helpers.
 * Le scene chiamano direttamente le primitive Canvas2D.
 */
import { C } from './palette.js';
import { drawSprite, getSprite } from './sprites.js';
import { t } from './i18n.js';

export const VIEW_W = 240;
export const VIEW_H = 240;       /* schermo "alto" del DS (zona azione) */
export const HUD_H  = 240;       /* schermo "basso" del DS (HUD/inventory/mappa) */
export const CANVAS_W = 480;     /* 2× scaling visivo */
export const CANVAS_H = 480;     /* solo top screen + HUD compatto, NO schermo doppio */
/* In realta` per evitare un canvas alto 960px useremo un layout ibrido:
   – La meta` superiore del canvas (240..480 logici scaled) mostra l'azione 480x320 scaled 1.5x
   – La meta` inferiore mostra HUD compatto (cuori, oggetti, timer)
   In coordinate ctx (DPR-scaled gia` applicato dal renderer): 480x480.        */

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._setupBacking();
    this.shake = 0;
    this.fade = 0;          /* 0 = trasparente, 1 = nero */
    this.fadeDir = 0;       /* +1 = sta diventando nero (fade-out), -1 = clear */
    this.toast = { text: '', timer: 0 };
  }

  _setupBacking() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.canvas.width  = CANVAS_W * dpr;
    this.canvas.height = CANVAS_H * dpr;
    this.canvas.style.width  = '100%';
    this.canvas.style.height = '100%';
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
  }

  /** Avvia un fade-out a nero (durata ~30 frame). Callback opzionale a fade complete. */
  startFadeOut(onMid) { this.fadeDir = 1; this._fadeMidCb = onMid; }
  /** Avvia un fade-in dal nero (dopo il cambio scena). */
  startFadeIn() { this.fadeDir = -1; this.fade = 1; }

  updateFade() {
    if (this.fadeDir > 0) {
      this.fade = Math.min(1, this.fade + 0.05);
      if (this.fade >= 1 && this._fadeMidCb) {
        const cb = this._fadeMidCb;
        this._fadeMidCb = null;
        cb();
        /* Avvia fade-in successivo */
        this.fadeDir = -1;
      }
    } else if (this.fadeDir < 0) {
      this.fade = Math.max(0, this.fade - 0.05);
      if (this.fade <= 0) this.fadeDir = 0;
    }
  }

  triggerShake(intensity = 1) { this.shake = Math.max(this.shake, intensity * 8); }
  updateShake() { if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6); }
  applyShakeOffset() {
    if (this.shake <= 0) return { ox: 0, oy: 0 };
    return {
      ox: (Math.random() * 2 - 1) * this.shake,
      oy: (Math.random() * 2 - 1) * this.shake,
    };
  }

  showToast(text, frames = 90) { this.toast.text = text; this.toast.timer = frames; }
  updateToast() { if (this.toast.timer > 0) this.toast.timer--; }

  /** Pulisce l'intero canvas. */
  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /** Box stile pergamena (per dialoghi/menu). */
  drawPanel(x, y, w, h) {
    const c = this.ctx;
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
    const c = this.ctx;
    c.font = font;
    const out = [];
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (c.measureText(test).width > maxW && cur) {
          out.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) out.push(cur);
    }
    return out;
  }

  /** Disegna il fade-out attuale sopra il canvas. */
  drawFade() {
    if (this.fade <= 0) return;
    const c = this.ctx;
    c.fillStyle = `rgba(0,0,0,${this.fade})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /** Toast banner sopra l'azione. */
  drawToast() {
    if (!this.toast.timer || !this.toast.text) return;
    const c = this.ctx;
    const a = this.toast.timer > 60 ? 1 : this.toast.timer / 60;
    c.save();
    c.globalAlpha = a;
    c.font = 'bold 14px monospace';
    const text = this.toast.text;
    const w = c.measureText(text).width + 24;
    const h = 26;
    const x = (CANVAS_W - w) / 2;
    const y = 16;
    c.fillStyle = 'rgba(8,12,40,0.92)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = C.gold;
    c.lineWidth = 1.5;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.fillStyle = '#fff5b0';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 3;
    c.fillText(text, CANVAS_W / 2, y + h / 2);
    c.shadowBlur = 0;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.restore();
  }

  /** HUD compatto in cima: HP, rupie, timer. */
  drawHud(state) {
    const c = this.ctx;
    /* Bar di sfondo nero semi-trasparente */
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, 0, CANVAS_W, 14);

    /* Cuori (mezzi cuori = unita`) */
    const fullHearts = Math.floor(state.hp / 2);
    const half = state.hp % 2 === 1;
    const total = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < total; i++) {
      const hx = 4 + i * 13;
      const hy = 1;
      if (i < fullHearts) {
        drawSprite(c, 'item_heart', hx, hy, 12, 12);
      } else if (i === fullHearts && half) {
        c.save();
        c.beginPath();
        c.rect(hx, hy, 6, 12);
        c.clip();
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

    /* Rupie (centro-dx) */
    drawSprite(c, 'item_rupee', CANVAS_W - 70, 0, 14, 14);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 12px monospace';
    c.textAlign = 'left';
    c.fillText(state.rupees.toString().padStart(3, '0'), CANVAS_W - 54, 11);

    /* Score (right) */
    c.fillStyle = '#d0e0ff';
    c.font = '11px monospace';
    c.textAlign = 'right';
    c.fillText(`✦ ${state.score}`, CANVAS_W - 4, 11);

    /* Timer Phantom Hourglass — mostrato solo se in tempio o se attivo */
    if (state.sceneId === 'temple') {
      const m = Math.floor(state.hourglassMs / 60000);
      const s = Math.floor((state.hourglassMs % 60000) / 1000);
      const pct = state.hourglassMs / state.hourglassMax;

      const tx = (CANVAS_W - 90) / 2;
      const ty = 16;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(tx, ty, 90, 14);
      /* Bar */
      const barCol = state.inSafeZone ? C.safe_zone : (pct < 0.25 ? C.red : C.hourglass_glow);
      c.fillStyle = barCol;
      c.fillRect(tx + 2, ty + 2, 86 * pct, 10);
      c.strokeStyle = C.gold;
      c.lineWidth = 1;
      c.strokeRect(tx + 0.5, ty + 0.5, 89, 13);
      /* Testo MM:SS */
      c.fillStyle = '#1c1410';
      c.font = 'bold 10px monospace';
      c.textAlign = 'center';
      c.fillText(`⌛ ${m}:${s.toString().padStart(2,'0')}`, tx + 45, ty + 11);
    }

    /* Nome scena (in alto a sinistra sotto i cuori) */
    c.fillStyle = '#a8b8d8';
    c.font = '10px monospace';
    c.textAlign = 'left';
    c.fillText(`📍 ${t('scene.' + state.sceneId)}`, 4, 26);
  }

  /** Dialog box (stile Phantom Hourglass: pergamena in basso). */
  drawDialog(dialog) {
    if (!dialog) return;
    const c = this.ctx;
    const boxH = 96;
    const boxY = CANVAS_H - boxH - 6;
    const boxX = 8;
    const boxW = CANVAS_W - 16;
    this.drawPanel(boxX, boxY, boxW, boxH);

    /* Speaker */
    c.fillStyle = C.gold;
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText(dialog.speaker || '', boxX + 12, boxY + 18);

    /* Linea separatrice */
    c.strokeStyle = 'rgba(240,200,80,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(boxX + 10, boxY + 24);
    c.lineTo(boxX + boxW - 10, boxY + 24);
    c.stroke();

    /* Testo (typewriter) */
    const fullLine = dialog.lines[dialog.lineIdx] || '';
    const visible = fullLine.substring(0, Math.floor(dialog.charIdx));
    const wrapped = this.wrapText(visible, boxW - 24, '13px monospace');
    c.fillStyle = '#fff5b0';
    c.font = '13px monospace';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 3;
    for (let i = 0; i < Math.min(4, wrapped.length); i++) {
      c.fillText(wrapped[i], boxX + 12, boxY + 42 + i * 16);
    }
    c.shadowBlur = 0;

    /* Indicatore "next" */
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
    const c = this.ctx;
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.65 * anim})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.globalAlpha = anim;

    const pw = 440, ph = 444;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 + (1 - anim) * 16;
    this.drawPanel(px, py, pw, ph);

    /* Titolo */
    c.fillStyle = '#fff5b0';
    c.font = 'bold 22px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 5;
    c.fillText(t('ui.inventory_title'), CANVAS_W / 2, py + 32);
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(240,200,80,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px + 20, py + 42); c.lineTo(px + pw - 20, py + 42);
    c.stroke();

    /* Sezione cuori */
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText(`♥ ${t('ui.hp')}`, px + 18, py + 64);
    const fullH = Math.floor(state.hp / 2);
    const halfH = state.hp % 2 === 1;
    const totH = Math.ceil(state.maxHp / 2);
    for (let i = 0; i < totH; i++) {
      const hx = px + 90 + i * 16;
      const hy = py + 54;
      if (i < fullH) drawSprite(c, 'item_heart', hx, hy, 14, 14);
      else if (i === fullH && halfH) {
        c.save(); c.beginPath(); c.rect(hx, hy, 7, 14); c.clip();
        drawSprite(c, 'item_heart', hx, hy, 14, 14);
        c.restore();
      } else {
        c.strokeStyle = 'rgba(255,80,80,0.5)';
        c.lineWidth = 1;
        c.strokeRect(hx + 2, hy + 2, 10, 10);
      }
    }

    /* Sezione equipaggiamento */
    let sy = py + 84;
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.fillText(t('ui.items'), px + 18, sy);

    const slot = 36, sp = 8;
    const items = [
      { spr: 'item_sword',     have: state.items.sword,     count: null,           label: t('ui.item_sword') },
      { spr: 'item_shield',    have: state.items.shield,    count: null,           label: t('ui.item_shield') },
      { spr: 'item_boomerang', have: state.items.boomerang, count: null,           label: t('ui.item_boomerang') },
      { spr: 'item_bomb',      have: state.items.bombs > 0, count: state.items.bombs, label: t('ui.item_bombs') },
      { spr: 'item_bow',       have: state.items.bow,       count: state.items.arrows, label: t('ui.item_bow') },
      { spr: 'item_potion',    have: state.items.potions > 0, count: state.items.potions, label: t('ui.item_potion') },
    ];
    for (let i = 0; i < items.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const sx = px + 18 + col * (slot + sp + 80);
      const ssy = sy + 8 + row * (slot + 18);
      this._drawSlot(sx, ssy, slot, items[i].have);
      const it = items[i];
      c.save();
      if (!it.have) c.globalAlpha = anim * 0.3;
      drawSprite(c, it.spr, sx + 4, ssy + 4, slot - 8, slot - 8);
      c.restore();
      /* Etichetta */
      c.fillStyle = it.have ? '#fff5b0' : 'rgba(255,245,176,0.4)';
      c.font = '11px monospace';
      c.fillText(it.label, sx + slot + 4, ssy + 14);
      if (it.count != null) {
        c.fillStyle = '#d4e0ff';
        c.font = 'bold 13px monospace';
        c.fillText(`× ${it.count}`, sx + slot + 4, ssy + 30);
      }
    }

    /* Sezione chiavi/mappa */
    sy = py + 232;
    c.fillStyle = '#fff5b0';
    c.font = 'bold 13px monospace';
    c.fillText(t('ui.quest'), px + 18, sy);
    /* Quest line: scegli messaggio in base ai flag */
    const qLine = this._questLine(state);
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
    c.fillText(`☠ ${state.kills}  ·  💎 ${state.rupees}  ·  🗝 ${state.items.keys}  ·  ✦ ${state.score}`, px + 18, sy);

    /* Hint footer */
    c.fillStyle = 'rgba(240,200,80,0.85)';
    c.font = '11px monospace';
    c.textAlign = 'center';
    c.fillText('[I/Tab/M] ' + t('ui.close') + '  ·  [P] ' + t('ui.use') + ' ' + t('ui.item_potion'),
               CANVAS_W / 2, py + ph - 14);

    c.textAlign = 'left';
    c.restore();
  }

  _drawSlot(x, y, size, highlight) {
    const c = this.ctx;
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
    if (state.flags.met_oshus && !state.items.sword) return 'Prendi la spada da Oshus a Mercay.';
    return 'Parla con Oshus all\'inizio dell\'isola di Mercay.';
  }

  /** Schermata pausa (semplice). */
  drawPause() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 36px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 6;
    c.fillText(t('ui.pause'), CANVAS_W / 2, CANVAS_H / 2 - 10);
    c.font = '14px monospace';
    c.fillText('[ESC] ' + t('ui.resume'), CANVAS_W / 2, CANVAS_H / 2 + 24);
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }

  /** Loading screen tra scene (fade + spinner). */
  drawLoading(text) {
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = C.gold;
    c.font = 'bold 16px monospace';
    c.textAlign = 'center';
    c.fillText(text || t('ui.loading'), CANVAS_W / 2, CANVAS_H / 2);
    /* Mini spinner: punto rotante */
    const a = Date.now() / 300;
    c.fillStyle = '#fff5b0';
    c.beginPath();
    c.arc(CANVAS_W / 2 + Math.cos(a) * 40, CANVAS_H / 2 + 40 + Math.sin(a) * 6, 4, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'left';
  }

  /** Game-over overlay. */
  drawGameOver(text, sub) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.75)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = C.red;
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 6;
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
    const c = this.ctx;
    c.fillStyle = 'rgba(240,200,80,0.45)';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = '#fff5b0';
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 6;
    c.fillText('✦ VITTORIA ✦', CANVAS_W / 2, CANVAS_H / 2 - 10);
    c.font = '14px monospace';
    c.fillText('Il Re del Mare e` sconfitto.', CANVAS_W / 2, CANVAS_H / 2 + 16);
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }
}

/* Export anche getSprite per chi disegna su Renderer */
export { drawSprite, getSprite };
