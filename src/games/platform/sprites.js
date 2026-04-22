/**
 * Andryx Jump — pixel art procedurale.
 *
 * Tutti gli sprite sono disegnati con primitive Canvas 2D.
 * Niente bitmap esterne. Cache dei "frame" pre-renderizzati su offscreen
 * canvas per perf (rifatti solo al primo uso).
 */

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function px(ctx, x, y, color, size = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

/* ─── ANDRYX (player) ─── */
/* Sprite 16x24 (small) o 16x32 (big). 4 stati: idle, walk(2 frames), jump, fall.
   Frontale stilizzato con cappello. */

function drawAndryxSmall(ctx, frame = 'idle', dir = 1) {
  /* base pixel art 16x24, palette: cappello rosso, capelli neri, viso, tunica blu, scarpe marroni. */
  const HAT = '#e63946';
  const HAT_SH = '#a01020';
  const FACE = '#fde0c8';
  const HAIR = '#1a1a1a';
  const TUNIC = '#1d72b8';
  const TUNIC_SH = '#0e4a80';
  const PANT = '#2a3a55';
  const SHOE = '#5a3a1e';
  const SKIN = '#fde0c8';

  ctx.save();
  if (dir < 0) { ctx.translate(16, 0); ctx.scale(-1, 1); }

  /* cappello (top, righe 0-3) */
  px(ctx, 5, 0, HAT, 6);
  px(ctx, 4, 1, HAT, 8);
  px(ctx, 3, 2, HAT, 10);
  px(ctx, 4, 3, HAT_SH, 8);
  /* visiera (riga 4) */
  px(ctx, 2, 4, HAT_SH, 10);
  /* capelli ai lati */
  px(ctx, 4, 5, HAIR, 1);
  px(ctx, 11, 5, HAIR, 1);
  /* viso (righe 5-9) */
  px(ctx, 5, 5, FACE, 6);
  px(ctx, 5, 6, FACE, 6);
  px(ctx, 5, 7, FACE, 6);
  px(ctx, 5, 8, FACE, 6);
  px(ctx, 5, 9, FACE, 6);
  /* occhio (orientato in base a dir, qui dir=1 → guarda destra) */
  px(ctx, 9, 6, '#000', 2);
  /* bocca */
  px(ctx, 7, 8, HAT_SH, 2);
  /* collo */
  px(ctx, 6, 10, SKIN, 4);
  /* tunica (righe 11-17) */
  px(ctx, 4, 11, TUNIC, 8);
  px(ctx, 3, 12, TUNIC, 10);
  px(ctx, 3, 13, TUNIC, 10);
  px(ctx, 3, 14, TUNIC_SH, 10);
  px(ctx, 4, 15, TUNIC, 8);
  px(ctx, 4, 16, TUNIC_SH, 8);
  /* braccia (variano con frame walk) */
  if (frame === 'walk1') {
    px(ctx, 2, 12, SKIN, 1); px(ctx, 2, 13, SKIN, 1);
    px(ctx, 13, 13, SKIN, 1); px(ctx, 13, 14, SKIN, 1);
  } else if (frame === 'walk2') {
    px(ctx, 2, 13, SKIN, 1); px(ctx, 2, 14, SKIN, 1);
    px(ctx, 13, 12, SKIN, 1); px(ctx, 13, 13, SKIN, 1);
  } else if (frame === 'jump') {
    px(ctx, 2, 11, SKIN, 1); px(ctx, 2, 12, SKIN, 1);
    px(ctx, 13, 11, SKIN, 1); px(ctx, 13, 12, SKIN, 1);
  } else if (frame === 'fall') {
    px(ctx, 1, 13, SKIN, 1); px(ctx, 1, 14, SKIN, 1);
    px(ctx, 14, 13, SKIN, 1); px(ctx, 14, 14, SKIN, 1);
  } else {
    px(ctx, 2, 12, SKIN, 1); px(ctx, 2, 13, SKIN, 1);
    px(ctx, 13, 12, SKIN, 1); px(ctx, 13, 13, SKIN, 1);
  }
  /* pantaloni / gambe (righe 17-22) */
  if (frame === 'walk1') {
    px(ctx, 4, 17, PANT, 3); px(ctx, 9, 17, PANT, 3);
    px(ctx, 4, 18, PANT, 3); px(ctx, 9, 18, PANT, 3);
    px(ctx, 4, 19, PANT, 3); px(ctx, 9, 19, PANT, 3);
    px(ctx, 3, 20, SHOE, 4); px(ctx, 9, 20, SHOE, 4);
    px(ctx, 2, 21, SHOE, 5); px(ctx, 10, 21, SHOE, 4);
  } else if (frame === 'walk2') {
    px(ctx, 4, 17, PANT, 3); px(ctx, 9, 17, PANT, 3);
    px(ctx, 4, 18, PANT, 3); px(ctx, 9, 18, PANT, 3);
    px(ctx, 4, 19, PANT, 3); px(ctx, 9, 19, PANT, 3);
    px(ctx, 4, 20, SHOE, 4); px(ctx, 10, 20, SHOE, 3);
    px(ctx, 4, 21, SHOE, 4); px(ctx, 10, 21, SHOE, 5);
  } else if (frame === 'jump' || frame === 'fall') {
    px(ctx, 5, 17, PANT, 6);
    px(ctx, 5, 18, PANT, 6);
    px(ctx, 4, 19, PANT, 8);
    px(ctx, 4, 20, SHOE, 8);
    px(ctx, 3, 21, SHOE, 4); px(ctx, 9, 21, SHOE, 4);
  } else {
    px(ctx, 5, 17, PANT, 6);
    px(ctx, 5, 18, PANT, 6);
    px(ctx, 5, 19, PANT, 6);
    px(ctx, 4, 20, SHOE, 4); px(ctx, 8, 20, SHOE, 4);
    px(ctx, 3, 21, SHOE, 5); px(ctx, 8, 21, SHOE, 5);
  }
  ctx.restore();
}

/** Restituisce la canvas dello sprite di Andryx, con cache. */
export function getAndryxSprite(state, dir, big = false) {
  const k = `andryx_${state}_${dir > 0 ? 'r' : 'l'}_${big ? 'b' : 's'}`;
  if (cache.has(k)) return cache.get(k);
  const h = big ? 32 : 24;
  const c = makeCanvas(16, h);
  const ctx = c.getContext('2d');
  if (big) {
    /* "big": disegna lo small scalato 1.33x verticalmente con bottom centrato */
    const tmp = makeCanvas(16, 24);
    drawAndryxSmall(tmp.getContext('2d'), state, dir);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, 16, 24, 0, 0, 16, 32);
  } else {
    drawAndryxSmall(ctx, state, dir);
  }
  cache.set(k, c);
  return c;
}

/* ─── NEMICI ─── */

/* Sloimo: blob viola che cammina. 2 frame. */
function drawSloimo(ctx, frame = 0) {
  const A = '#9c4ad8';
  const B = '#5a1e7a';
  const C2 = '#c08aff';
  /* corpo */
  px(ctx, 3, 6 - (frame === 1 ? 1 : 0), A, 10);
  px(ctx, 2, 7, A, 12);
  px(ctx, 1, 8, A, 14);
  px(ctx, 1, 9, A, 14);
  px(ctx, 1, 10, A, 14);
  px(ctx, 1, 11, A, 14);
  px(ctx, 1, 12, B, 14);
  px(ctx, 2, 13, B, 12);
  /* highlight */
  px(ctx, 4, 8, C2, 2);
  px(ctx, 4, 9, C2, 1);
  /* occhi */
  px(ctx, 5, 9, '#fff', 2);
  px(ctx, 9, 9, '#fff', 2);
  px(ctx, 6, 10, '#000', 1);
  px(ctx, 10, 10, '#000', 1);
  /* base wobble */
  if (frame === 0) {
    px(ctx, 1, 13, B, 14);
  } else {
    px(ctx, 0, 13, B, 16);
  }
}

export function getSloimoSprite(frame = 0) {
  const k = `sloimo_${frame}`;
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawSloimo(c.getContext('2d'), frame);
  cache.set(k, c);
  return c;
}

/* Pipistrellix: pipistrello blu. 2 frame ali. */
function drawBat(ctx, frame = 0) {
  const A = '#3a2a5a';
  const B = '#5a4080';
  const C2 = '#8060a0';
  /* corpo centrale */
  px(ctx, 6, 5, A, 4);
  px(ctx, 5, 6, A, 6);
  px(ctx, 5, 7, A, 6);
  px(ctx, 5, 8, B, 6);
  px(ctx, 6, 9, B, 4);
  /* orecchie */
  px(ctx, 5, 4, A, 1); px(ctx, 10, 4, A, 1);
  px(ctx, 6, 4, A, 1); px(ctx, 9, 4, A, 1);
  /* occhi rossi */
  px(ctx, 6, 6, '#ff4040', 1);
  px(ctx, 9, 6, '#ff4040', 1);
  /* ali */
  if (frame === 0) {
    /* ali stese */
    px(ctx, 0, 6, B, 5);
    px(ctx, 1, 7, C2, 4);
    px(ctx, 2, 8, B, 3);
    px(ctx, 11, 6, B, 5);
    px(ctx, 11, 7, C2, 4);
    px(ctx, 11, 8, B, 3);
  } else {
    /* ali su */
    px(ctx, 1, 4, B, 4);
    px(ctx, 2, 5, C2, 3);
    px(ctx, 3, 6, B, 2);
    px(ctx, 11, 4, B, 4);
    px(ctx, 11, 5, C2, 3);
    px(ctx, 11, 6, B, 2);
  }
}

export function getBatSprite(frame = 0) {
  const k = `bat_${frame}`;
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawBat(c.getContext('2d'), frame);
  cache.set(k, c);
  return c;
}

/* Spinazzo: cespuglio di spuntoni grigi. Statico. */
function drawSpike(ctx) {
  const A = '#888';
  const B = '#444';
  const C2 = '#bbb';
  /* base */
  px(ctx, 1, 12, B, 14);
  px(ctx, 1, 13, B, 14);
  px(ctx, 0, 14, B, 16);
  px(ctx, 0, 15, B, 16);
  /* spuntoni triangolari */
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 4;
    px(ctx, x, 11, A, 3);
    px(ctx, x + 1, 9, A, 1);
    px(ctx, x + 1, 10, A, 1);
    px(ctx, x, 11, C2, 1);
  }
  /* punte appuntite */
  px(ctx, 2, 8, A, 1);
  px(ctx, 6, 7, A, 1);
  px(ctx, 10, 8, A, 1);
  px(ctx, 14, 7, A, 1);
}

export function getSpikeSprite() {
  const k = 'spike';
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawSpike(c.getContext('2d'));
  cache.set(k, c);
  return c;
}

/* ─── POWER-UP ─── */

function drawCrystal(ctx, t = 0) {
  const A = '#22e0ff';
  const B = '#0080a0';
  const C2 = '#a0f0ff';
  const off = Math.sin(t * 0.1) * 1;
  /* esagono cristallo */
  px(ctx, 5, 4 + off, A, 6);
  px(ctx, 4, 5 + off, A, 8);
  px(ctx, 3, 6 + off, A, 10);
  px(ctx, 3, 7 + off, A, 10);
  px(ctx, 3, 8 + off, A, 10);
  px(ctx, 3, 9 + off, B, 10);
  px(ctx, 4, 10 + off, B, 8);
  px(ctx, 5, 11 + off, B, 6);
  /* highlight */
  px(ctx, 5, 5 + off, C2, 2);
  px(ctx, 5, 6 + off, C2, 1);
}

export function getCrystalSprite(t = 0) {
  const f = Math.floor(t / 8) % 4;
  const k = `crystal_${f}`;
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawCrystal(c.getContext('2d'), f * 2);
  cache.set(k, c);
  return c;
}

function drawStar(ctx) {
  const A = '#ffd040';
  const B = '#ff8000';
  /* stella 5 punte stilizzata */
  px(ctx, 7, 2, A, 2);
  px(ctx, 6, 3, A, 4);
  px(ctx, 5, 4, A, 6);
  px(ctx, 1, 5, A, 14);
  px(ctx, 2, 6, A, 12);
  px(ctx, 3, 7, A, 10);
  px(ctx, 4, 8, A, 8);
  px(ctx, 4, 9, B, 8);
  px(ctx, 3, 10, B, 4); px(ctx, 9, 10, B, 4);
  px(ctx, 2, 11, B, 3); px(ctx, 11, 11, B, 3);
  /* occhietti */
  px(ctx, 6, 7, '#000', 1);
  px(ctx, 9, 7, '#000', 1);
}

export function getStarSprite() {
  const k = 'star';
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawStar(c.getContext('2d'));
  cache.set(k, c);
  return c;
}

function drawFeather(ctx) {
  const A = '#ffffff';
  const B = '#a0d8ff';
  const C2 = '#5090c0';
  /* asta */
  px(ctx, 8, 2, C2, 1);
  px(ctx, 8, 3, C2, 1);
  px(ctx, 8, 4, C2, 1);
  px(ctx, 8, 5, C2, 1);
  px(ctx, 8, 6, C2, 1);
  px(ctx, 8, 7, C2, 1);
  px(ctx, 8, 8, C2, 1);
  px(ctx, 8, 9, C2, 1);
  px(ctx, 8, 10, C2, 1);
  px(ctx, 8, 11, C2, 1);
  px(ctx, 8, 12, C2, 1);
  px(ctx, 8, 13, C2, 1);
  /* barbe */
  for (let i = 3; i <= 12; i++) {
    const w = i < 6 ? 2 : i < 9 ? 4 : 5;
    px(ctx, 8 - w, i, A, w);
    px(ctx, 9, i, B, w);
  }
  /* punta */
  px(ctx, 7, 1, A, 3);
}

export function getFeatherSprite() {
  const k = 'feather';
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawFeather(c.getContext('2d'));
  cache.set(k, c);
  return c;
}

/* ─── COIN ─── */
function drawCoin(ctx, frame = 0) {
  const A = '#ffd040';
  const B = '#a07020';
  const C2 = '#fff080';
  /* effetto rotazione: 3 frame */
  if (frame === 0) {
    /* faccia piena */
    px(ctx, 5, 4, A, 6);
    px(ctx, 4, 5, A, 8);
    px(ctx, 4, 6, A, 8);
    px(ctx, 4, 7, A, 8);
    px(ctx, 4, 8, A, 8);
    px(ctx, 4, 9, A, 8);
    px(ctx, 4, 10, B, 8);
    px(ctx, 5, 11, B, 6);
    px(ctx, 6, 6, C2, 1);
    px(ctx, 6, 7, '#000', 1);
    px(ctx, 6, 8, '#000', 1);
  } else if (frame === 1) {
    /* di lato */
    px(ctx, 7, 4, A, 2);
    px(ctx, 6, 5, A, 4);
    px(ctx, 6, 6, A, 4);
    px(ctx, 6, 7, A, 4);
    px(ctx, 6, 8, A, 4);
    px(ctx, 6, 9, A, 4);
    px(ctx, 6, 10, B, 4);
    px(ctx, 7, 11, B, 2);
  } else {
    /* sottile */
    px(ctx, 7, 4, A, 2);
    px(ctx, 7, 5, A, 2);
    px(ctx, 7, 6, A, 2);
    px(ctx, 7, 7, A, 2);
    px(ctx, 7, 8, A, 2);
    px(ctx, 7, 9, A, 2);
    px(ctx, 7, 10, B, 2);
    px(ctx, 7, 11, B, 2);
  }
}

export function getCoinSprite(t = 0) {
  const f = Math.floor(t / 8) % 4;
  const idx = f === 3 ? 1 : f; /* 0,1,2,1 */
  const k = `coin_${idx}`;
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawCoin(c.getContext('2d'), idx);
  cache.set(k, c);
  return c;
}

/* ─── BANDIERA / CHECKPOINT ─── */
function drawFlag(ctx, color = '#ffd040', poleColor = '#444') {
  /* asta */
  for (let y = 0; y < 16; y++) px(ctx, 7, y, poleColor, 1);
  /* bandiera triangolare */
  for (let i = 0; i < 6; i++) {
    px(ctx, 8, 1 + i, color, 6 - i);
  }
}

export function getGoalFlagSprite() {
  const k = 'goal_flag';
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawFlag(c.getContext('2d'), '#ffd040', '#a08040');
  cache.set(k, c);
  return c;
}

export function getCheckpointSprite() {
  const k = 'checkpoint';
  if (cache.has(k)) return cache.get(k);
  const c = makeCanvas(16, 16);
  drawFlag(c.getContext('2d'), '#22c0ff', '#446080');
  cache.set(k, c);
  return c;
}
