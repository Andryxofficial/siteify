/**
 * Andryx Jump — sprite pixel art (disegno diretto su Canvas 2D).
 *
 * Tutte le funzioni disegnano sul ctx fornito, a partire dalle coordinate (x, y).
 * Nessuna immagine esterna. Nessuna cache: il chiamante puo' cachare se vuole.
 */

/* ─── Helpers interni ─── */
function px(ctx, lx, ly, col, w = 1, h = 1) {
  ctx.fillStyle = col;
  ctx.fillRect(lx, ly, w, h);
}

/* Trasformazione flip orizzontale attorno al bordo destro dello sprite. */
function withFlip(ctx, x, y, w, dir, drawFn) {
  ctx.save();
  ctx.translate(x + (dir < 0 ? w : 0), y);
  if (dir < 0) ctx.scale(-1, 1);
  drawFn(ctx);
  ctx.restore();
}

/* ─── ANDRYX (player) ─── */
/* Palette per forma: small=blue, big=dark blue, fire=red tint */
const ANDRYX_PALETTE = {
  small: { tunic: '#1d72b8', tunicSh: '#0e4a80', pant: '#2a3a55' },
  big:   { tunic: '#1a5a9a', tunicSh: '#0a3060', pant: '#1e2a40' },
  fire:  { tunic: '#d62828', tunicSh: '#8a0020', pant: '#4a1010' },
};

function drawAndryxBody(ctx, form, animFrame) {
  const HAT    = '#e63946';
  const HAT_SH = '#a01020';
  const FACE   = '#fde0c8';
  const HAIR   = '#1a1a1a';
  const SKIN   = '#fde0c8';
  const SHOE   = '#5a3a1e';
  const pal    = ANDRYX_PALETTE[form] || ANDRYX_PALETTE.small;
  const TUNIC  = pal.tunic;
  const TUNIC_SH = pal.tunicSh;
  const PANT   = pal.pant;

  /* cappello */
  px(ctx, 4, 0, HAT, 5, 2);
  px(ctx, 3, 2, HAT, 7, 2);
  px(ctx, 2, 4, HAT_SH, 9, 2);
  /* capelli ai lati */
  px(ctx, 2, 6, HAIR, 1, 2);
  /* viso */
  px(ctx, 3, 6, FACE, 6, 5);
  /* occhio */
  px(ctx, 7, 7, '#000', 2, 1);
  /* bocca */
  px(ctx, 5, 9, HAT_SH, 3, 1);
  /* collo */
  px(ctx, 4, 11, SKIN, 4, 1);
  /* tunica */
  px(ctx, 2, 12, TUNIC, 8, 4);
  px(ctx, 3, 16, TUNIC_SH, 6, 2);
  /* braccia in base all'animFrame (0=idle, 1=walk1, 2=walk2, 3=jump) */
  if (animFrame === 1) {
    px(ctx, 1, 12, SKIN, 1, 2);
    px(ctx, 10, 13, SKIN, 1, 2);
  } else if (animFrame === 2) {
    px(ctx, 1, 13, SKIN, 1, 2);
    px(ctx, 10, 12, SKIN, 1, 2);
  } else if (animFrame === 3) {
    px(ctx, 1, 11, SKIN, 1, 2);
    px(ctx, 10, 11, SKIN, 1, 2);
  } else {
    px(ctx, 1, 12, SKIN, 1, 2);
    px(ctx, 10, 12, SKIN, 1, 2);
  }
  /* pantaloni e gambe */
  if (animFrame === 1) {
    px(ctx, 2, 18, PANT, 4, 4);
    px(ctx, 6, 18, PANT, 4, 4);
    px(ctx, 2, 20, SHOE, 5, 2);
    px(ctx, 7, 21, SHOE, 4, 1);
  } else if (animFrame === 2) {
    px(ctx, 2, 18, PANT, 4, 4);
    px(ctx, 6, 18, PANT, 4, 4);
    px(ctx, 3, 21, SHOE, 4, 1);
    px(ctx, 7, 20, SHOE, 4, 2);
  } else if (animFrame === 3) {
    px(ctx, 3, 18, PANT, 6, 4);
    px(ctx, 2, 20, SHOE, 4, 2);
    px(ctx, 7, 20, SHOE, 4, 2);
  } else {
    px(ctx, 3, 18, PANT, 3, 4);
    px(ctx, 6, 18, PANT, 3, 4);
    px(ctx, 2, 21, SHOE, 4, 1);
    px(ctx, 7, 21, SHOE, 4, 1);
  }
  /* fire flower dot sul cappello */
  if (form === 'fire') {
    px(ctx, 6, 0, '#ff8800', 2, 2);
  }
  /* big: aggiungi stivali grandi */
  if (form === 'big' || form === 'fire') {
    px(ctx, 1, 22, SHOE, 5, 2);
    px(ctx, 6, 22, SHOE, 5, 2);
  }
}

/**
 * Disegna Andryx al contesto (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  - pixel mondo (gia' traslato in viewport dal chiamante)
 * @param {number} y
 * @param {'small'|'big'|'fire'} form
 * @param {number} dir  - 1=destra, -1=sinistra
 * @param {number} animFrame  - 0-3
 * @param {number} iframes  - lampeggio se > 0
 */
export function drawAndryx(ctx, x, y, form, dir, animFrame, iframes) {
  if (iframes > 0 && Math.floor(iframes / 4) % 2 === 0) return;
  const w = 12;
  withFlip(ctx, x, y, w, dir, (c) => drawAndryxBody(c, form, animFrame));
}

/* ─── SLOIMO (Goomba) 14×14 ─── */
/**
 * Disegna Sloimo (fungo arrabbiato) a (x, y).
 */
export function drawSlimo(ctx, x, y, animFrame) {
  const A  = '#7a3a1e'; // marrone corpo
  const B  = '#5a2010'; // scuro
  const LT = '#c07050'; // luce
  const YE = '#ffd040'; // piedi
  ctx.save();
  ctx.translate(x, y);
  /* testa/corpo arrotondata */
  px(ctx, 2, 1, A, 10, 2);
  px(ctx, 1, 3, A, 12, 5);
  px(ctx, 0, 5, A, 14, 3);
  px(ctx, 1, 8, B, 12, 2);
  /* highlight */
  px(ctx, 3, 2, LT, 4, 2);
  /* sopracciglia arrabbiate */
  px(ctx, 1, 3, '#000', 3, 1);
  px(ctx, 10, 3, '#000', 3, 1);
  px(ctx, 2, 4, '#000', 2, 1);
  px(ctx, 10, 4, '#000', 2, 1);
  /* occhi */
  px(ctx, 3, 5, '#fff', 3, 3);
  px(ctx, 8, 5, '#fff', 3, 3);
  px(ctx, 4, 6, '#000', 1, 2);
  px(ctx, 9, 6, '#000', 1, 2);
  /* piedi — animati */
  const shift = animFrame % 2 === 0 ? 0 : 1;
  px(ctx, 1,    10 + shift, YE, 5, 4);
  px(ctx, 8,    10 - shift, YE, 5, 4);
  ctx.restore();
}

/* ─── TARTARAX (Koopa) walk 14×22 ─── */
/**
 * Disegna Tartarax in piedi/camminante a (x, y).
 */
export function drawTartaraxWalk(ctx, x, y, dir, animFrame) {
  const SH  = '#2d8a2d'; // guscio verde
  const SH2 = '#1a5a1a'; // scuro guscio
  const HEX = '#3daa3d'; // esagoni
  const SK  = '#c8e87a'; // pelle
  const EY  = '#fff';
  ctx.save();
  ctx.translate(x + (dir < 0 ? 14 : 0), y);
  if (dir < 0) ctx.scale(-1, 1);

  /* testa */
  px(ctx, 2, 0, SK, 10, 6);
  px(ctx, 1, 2, SK, 12, 4);
  /* occhi */
  px(ctx, 3, 1, EY, 3, 3);
  px(ctx, 9, 1, EY, 3, 3);
  px(ctx, 4, 2, '#000', 1, 2);
  px(ctx, 10, 2, '#000', 1, 2);
  /* collo */
  px(ctx, 4, 6, SK, 6, 2);
  /* guscio */
  px(ctx, 1, 8, SH, 12, 9);
  px(ctx, 0, 10, SH, 14, 5);
  px(ctx, 1, 8, SH2, 12, 1);
  px(ctx, 1, 16, SH2, 12, 1);
  /* pattern esagono guscio */
  px(ctx, 3, 10, HEX, 3, 3);
  px(ctx, 8, 10, HEX, 3, 3);
  px(ctx, 5, 13, HEX, 4, 3);
  /* gambe animate */
  const lOff = animFrame % 2 === 0 ? 0 : 2;
  px(ctx, 2,  17 + lOff, SK, 4, 5);
  px(ctx, 8,  17 - lOff, SK, 4, 5);
  /* piedi */
  px(ctx, 1,  20 + lOff, SK, 6, 2);
  px(ctx, 7,  20 - lOff, SK, 6, 2);
  ctx.restore();
}

/* ─── TARTARAX shell 14×14 ─── */
/**
 * Disegna il guscio di Tartarax a (x, y).
 */
export function drawTartaraxShell(ctx, x, y) {
  const SH  = '#2d8a2d';
  const SH2 = '#1a5a1a';
  const HEX = '#3daa3d';
  ctx.save();
  ctx.translate(x, y);
  px(ctx, 0,  0, SH,  14, 14);
  px(ctx, 0,  0, SH2, 14,  1);
  px(ctx, 0, 13, SH2, 14,  1);
  px(ctx, 0,  0, SH2,  1, 14);
  px(ctx, 13, 0, SH2,  1, 14);
  /* esagoni */
  px(ctx, 2, 3, HEX, 3, 3);
  px(ctx, 9, 3, HEX, 3, 3);
  px(ctx, 5, 8, HEX, 4, 3);
  /* highlight */
  px(ctx, 2, 1, 'rgba(255,255,255,0.3)', 5, 2);
  ctx.restore();
}

/* ─── PALLA DI FUOCO 8×8 ─── */
/**
 * Disegna una palla di fuoco ruotante a (x, y).
 */
export function drawFireball(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x + 4, y + 4);
  ctx.rotate(angle);
  /* nucleo */
  ctx.fillStyle = '#ffee44';
  ctx.fillRect(-3, -3, 6, 6);
  /* bordo caldo */
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(-4, -2, 2, 4);
  ctx.fillRect( 2, -2, 2, 4);
  ctx.fillRect(-2, -4, 4, 2);
  ctx.fillRect(-2,  2, 4, 2);
  /* bagliore esterno */
  ctx.fillStyle = 'rgba(255,200,0,0.5)';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

/* ─── MONETA 8×8 ─── */
/**
 * Disegna una moneta (effetto spin) a (x, y). animFrame 0-3.
 */
export function drawCoin(ctx, x, y, animFrame) {
  const f = animFrame % 4;
  ctx.save();
  ctx.translate(x, y);
  if (f === 0) {
    /* faccia piena */
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(1, 0, 6, 8);
    ctx.fillRect(0, 1, 8, 6);
    ctx.fillStyle = '#a07020';
    ctx.fillRect(1, 7, 6, 1);
    ctx.fillStyle = '#fff8a0';
    ctx.fillRect(2, 1, 2, 3);
  } else if (f === 1 || f === 3) {
    /* di lato */
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(2, 0, 4, 8);
    ctx.fillStyle = '#a07020';
    ctx.fillRect(2, 7, 4, 1);
  } else {
    /* sottile */
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(3, 0, 2, 8);
  }
  ctx.restore();
}

/* ─── POWER-UP CRISTALLO 12×12 ─── */
export function drawPowerupCrystal(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const A  = '#22e0ff';
  const B  = '#0080a0';
  const LT = '#a0f8ff';
  /* corpo esagonale */
  px(ctx, 4, 0, A, 4, 2);
  px(ctx, 2, 2, A, 8, 3);
  px(ctx, 1, 5, A, 10, 3);
  px(ctx, 2, 8, B, 8, 3);
  px(ctx, 4, 11, B, 4, 1);
  /* highlight */
  px(ctx, 4, 1, LT, 2, 2);
  px(ctx, 3, 3, LT, 2, 1);
  ctx.restore();
}

/* ─── POWER-UP STELLA 12×12 ─── */
export function drawPowerupStar(ctx, x, y, frame) {
  ctx.save();
  ctx.translate(x, y);
  const bright = (frame % 4 < 2);
  const A = bright ? '#ffd040' : '#ffb800';
  const B = '#ff8000';
  /* stella a 5 punte stilizzata */
  px(ctx, 5, 0, A, 2, 2);
  px(ctx, 3, 2, A, 6, 2);
  px(ctx, 0, 4, A, 12, 3);
  px(ctx, 2, 7, A, 8, 2);
  px(ctx, 1, 9, B, 4, 2);
  px(ctx, 7, 9, B, 4, 2);
  /* occhietti */
  px(ctx, 4, 5, '#000', 1, 1);
  px(ctx, 7, 5, '#000', 1, 1);
  ctx.restore();
}

/* ─── POWER-UP PIUMA 12×12 ─── */
export function drawPowerupFeather(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const W  = '#ffffff';
  const BL = '#a0d8ff';
  const C2 = '#5090c0';
  /* asta */
  for (let i = 2; i <= 11; i++) px(ctx, 5, i, C2, 1, 1);
  /* punta */
  px(ctx, 4, 0, W, 4, 2);
  /* barbe */
  for (let i = 3; i <= 10; i++) {
    const w = i < 6 ? 2 : i < 9 ? 4 : 5;
    px(ctx, 5 - w, i, W, w, 1);
    px(ctx, 6, i, BL, Math.min(w, 5), 1);
  }
  ctx.restore();
}

/* ─── POWER-UP FIRE FLOWER 12×12 ─── */
export function drawPowerupFire(ctx, x, y, frame) {
  ctx.save();
  ctx.translate(x, y);
  const anim = (frame % 6 < 3);
  /* stelo verde */
  px(ctx, 5, 7, '#2a7a2a', 2, 5);
  /* petali */
  const PC = anim ? '#ff4444' : '#ff8800';
  px(ctx, 4, 2, PC, 4, 2);
  px(ctx, 1, 4, PC, 3, 3);
  px(ctx, 8, 4, PC, 3, 3);
  px(ctx, 3, 7, PC, 6, 2);
  /* centro giallo */
  px(ctx, 4, 4, '#ffd040', 4, 3);
  /* occhietti */
  px(ctx, 5, 5, '#000', 1, 1);
  px(ctx, 7, 5, '#000', 1, 1);
  ctx.restore();
}

/* ─── CHECKPOINT FLAG 16×20 ─── */
/**
 * Disegna una bandierina checkpoint a (x, y). reached: bool.
 */
export function drawCheckpointFlag(ctx, x, y, reached) {
  ctx.save();
  ctx.translate(x, y);
  /* asta */
  px(ctx, 7, 0, '#446080', 2, 20);
  /* bandiera triangolare */
  const col = reached ? '#22c0ff' : '#8899aa';
  for (let i = 0; i < 8; i++) {
    px(ctx, 9, 1 + i, col, 8 - i, 1);
  }
  /* pallina cima */
  px(ctx, 6, 0, '#88bbcc', 4, 2);
  ctx.restore();
}

/* ─── PALO GOAL 16×h ─── */
/**
 * Disegna il palo della bandiera goal (altezza h pixel) a (x, y).
 */
export function drawGoalPole(ctx, x, y, h) {
  ctx.save();
  ctx.translate(x, y);
  /* palo metallico */
  px(ctx, 7, 0, '#888', 2, h);
  px(ctx, 7, 0, '#aaa', 1, h); // highlight
  /* pallina in cima */
  px(ctx, 5, 0, '#ffd040', 6, 4);
  px(ctx, 4, 1, '#ffd040', 8, 2);
  px(ctx, 6, 0, '#fff8c0', 2, 2); // highlight pallina
  /* bandiera */
  px(ctx, 9, 4,  '#ffd040', 8, 2);
  px(ctx, 9, 6,  '#ffd040', 6, 2);
  px(ctx, 9, 8,  '#ffd040', 4, 2);
  px(ctx, 9, 10, '#ffd040', 2, 2);
  px(ctx, 9, 4,  '#ff8000', 8, 1); // bordo bandiera
  ctx.restore();
}
