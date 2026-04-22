/**
 * Andryx Jump — engine SMB-accurate.
 *
 * Architettura:
 *  - Canvas 480x480 con DPR scaling per testo crisp
 *  - Game loop a 60fps (requestAnimationFrame)
 *  - Tilemap a stringhe; tile 16x16
 *  - Player state machine: small | big | fire
 *  - Fisica: gravita asimmetrica (rise / fall), salto variabile (hold),
 *    coyote time, jump buffer, friction differenziata (ground/air/ice)
 *  - Camera NES-style: scrolla SOLO a destra, mai indietro
 *  - Nemici: Sloimo (Goomba), Tartarax (Koopa walk/shell), Spinazzo (spike)
 *  - Power-up: cristallo (big), fire flower (fire), stella (invuln), piuma (doppio salto)
 *  - Fireball: solo in forma fire, rimbalza, uccide nemici al contatto
 *  - HUD su stesso canvas
 */

import { TILE_SIZE, TILES, isSolid, isOneWay, isLava, isIce, getSpawnType, getTile } from './tiles.js';
import { PHYS, aabbOverlap, clamp } from './physics.js';
import {
  drawAndryx, drawSlimo, drawTartaraxWalk, drawTartaraxShell, drawFireball,
  drawCoin, drawPowerupCrystal, drawPowerupStar, drawPowerupFeather, drawPowerupFire,
  drawCheckpointFlag, drawGoalPole,
} from './sprites.js';
import { SFX, playMusic, stopMusic, resumeAudio } from './audio.js';
import { getLevel, nextLevel } from './world.js';
import { saveSave, loadSave, clearSave, newSave } from './save.js';
import { t } from './i18n.js';

const VIEW_W = 480;
const VIEW_H = 480;
const HUD_H = 36;

const PLAYER_W = 12;
const PLAYER_H_SMALL = 14;
const PLAYER_H_BIG = 22;

/* Spinazzo (spike) hitbox 14x12 — niente stomp possibile. */

/* ─── Avvio engine. Restituisce { cleanup, getState }. ─── */
export function startEngine(canvas, cb, opts = {}) {
  /* Setup canvas: pixel-perfect (NO DPR scaling — distrugge la pixel-art).
   * Il browser fara upscale via CSS con image-rendering: pixelated. */
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.imageRendering = 'crisp-edges';
  /* Doppia dichiarazione: alcuni browser preferiscono uno o l'altro. */
  canvas.style.setProperty('image-rendering', 'pixelated');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /* Stato persistente (savefile) */
  const persistent = (opts.continueSave ? loadSave() : null) || newSave();
  if (opts.fresh) clearSave();

  /* Stato di sessione */
  const state = {
    persistent,
    worldId: persistent.currentWorld || 1,
    levelIdx: persistent.currentLevel || 1,
    grid: null, world: null, level: null,
    player: null,
    entities: [],          // nemici + power-up dropped
    fireballs: [],
    particles: [],
    floats: [],
    camX: 0,
    coins: persistent.sessionCoins || 0,
    score: persistent.sessionScore || 0,
    lives: persistent.lives ?? 3,
    timeLeft: 0, timeMax: 0,
    checkpoint: null,
    paused: false,
    transition: null,      // { type:'fade-in'|'fade-out', t, dur, then }
    levelStarted: false,
    levelComplete: false,
    gameOver: false,
    elapsedSeconds: 0,
    /* edge detection input */
    prevJump: false, prevDown: false, prevPause: false, prevFire: false,
  };

  /* Carica un livello (con eventuale checkpoint per il respawn). */
  function loadLevel(worldId, levelIdx, fromCheckpoint = null) {
    const { world, level } = getLevel(worldId, levelIdx);
    state.worldId = worldId; state.levelIdx = levelIdx;
    state.world = world; state.level = level;
    state.grid = level.map.map(r => r.split(''));
    state.entities = []; state.fireballs = [];
    state.particles = []; state.floats = [];
    state.camX = 0;
    state.timeMax = level.parTime; state.timeLeft = level.parTime;
    state.elapsedSeconds = 0;
    state.levelStarted = true; state.levelComplete = false; state.gameOver = false;
    state.transition = { type: 'fade-in', t: 0, dur: 24 };

    /* Spawn player + entita */
    let spawn = null;
    for (let r = 0; r < state.grid.length; r++) {
      const row = state.grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === TILES.PLAYER) {
          spawn = { col: c, row: r };
          row[c] = TILES.EMPTY;
        } else {
          const sp = getSpawnType(ch);
          if (sp) {
            spawnEntity(sp, c, r);
            row[c] = TILES.EMPTY;
          }
        }
      }
    }
    if (!spawn) spawn = { col: 2, row: state.grid.length - 4 };
    const sp = fromCheckpoint || spawn;

    /* Forma player: persistente attraverso il livello (NON tra retry post-morte) */
    const carryForm = persistent.bigCarryOver === `${worldId}:${levelIdx}` ? (persistent.bigCarryForm || 'small') : 'small';
    const form = carryForm;
    const ph = form === 'small' ? PLAYER_H_SMALL : PLAYER_H_BIG;

    state.player = {
      x: sp.col * TILE_SIZE + (TILE_SIZE - PLAYER_W) / 2,
      y: sp.row * TILE_SIZE + (TILE_SIZE - ph),
      vx: 0, vy: 0, w: PLAYER_W, h: ph,
      dir: 1,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeldFrames: 0,
      jumpReleased: true,
      form,                   // 'small' | 'big' | 'fire'
      animFrame: 0, animTimer: 0,
      stateAnim: 'idle',
      iframes: 0,
      invincibleFrames: 0,
      doubleJumpAvail: false, doubleJumpFrames: 0,
      onIce: false,
      fireCooldown: 0,
    };
    state.checkpoint = fromCheckpoint;

    cb.onScore?.(state.score);
    cb.onHpChange?.(form === 'small' ? 1 : 2, 2);
    try { playMusic(world.musicWorld); } catch { /* ignore */ }
  }

  function spawnEntity(type, col, row) {
    const x = col * TILE_SIZE, y = row * TILE_SIZE;
    if (type === 'slime') {
      state.entities.push({ type: 'slime', x, y, w: 14, h: 14,
        vx: -0.7, vy: 0, dir: -1, alive: true, animTimer: 0, animFrame: 0, grounded: false });
    } else if (type === 'koopa') {
      state.entities.push({ type: 'koopa', subState: 'walk', x, y, w: 14, h: 22,
        vx: -0.6, vy: 0, dir: -1, alive: true, animTimer: 0, animFrame: 0,
        shellTimer: 0, grounded: false });
    } else if (type === 'spike') {
      state.entities.push({ type: 'spike', x, y: y + 4, w: 14, h: 12, alive: true });
    } else if (type === 'pow_crystal' || type === 'pow_star' || type === 'pow_feather' || type === 'pow_fire') {
      state.entities.push({ type, x, y, w: 14, h: 14, alive: true,
        vx: 0, vy: 0, grounded: false, dropped: false });
    }
  }

  /* ─── Input ─── */
  function readInput() {
    const k = cb.keysRef?.current || {};
    const j = cb.joystickRef?.current || { dx: 0, dy: 0 };
    const left  = k['ArrowLeft']  || k['a'] || k['A'] || j.dx < -0.3;
    const right = k['ArrowRight'] || k['d'] || k['D'] || j.dx > 0.3;
    const down  = k['ArrowDown']  || k['s'] || k['S'] || j.dy > 0.5;
    const jump  = !!(k[' '] || k['Spacebar'] || k['w'] || k['W'] || k['ArrowUp'] || cb.actionBtnRef?.current);
    const run   = !!(k['Shift'] || k['Control'] || cb.secondaryBtnRef?.current);
    const fire  = !!(k['z'] || k['Z'] || k['x'] || k['X'] || k['j'] || k['J']);
    const pause = !!(k['Escape'] || k['p'] || k['P']);
    return { left, right, down, jump, run, fire, pause };
  }

  /* ─── AABB collision: muove p di dx separatamente da dy. ─── */

  function moveX(p, dx) {
    p.x += dx;
    if (dx === 0) return;
    const dir = dx > 0 ? 1 : -1;
    const probeX = dir > 0 ? p.x + p.w : p.x;
    const c = Math.floor(probeX / TILE_SIZE);
    const rTop = Math.floor(p.y / TILE_SIZE);
    const rBot = Math.floor((p.y + p.h - 0.01) / TILE_SIZE);
    for (let r = rTop; r <= rBot; r++) {
      const ch = getTile(state.grid, c, r);
      if (isSolid(ch)) {
        if (dir > 0) p.x = c * TILE_SIZE - p.w - 0.01;
        else p.x = (c + 1) * TILE_SIZE + 0.01;
        p.vx = 0;
        return ch;
      }
    }
    return null;
  }

  function moveY(p, dy, opts2 = {}) {
    p.y += dy;
    if (dy === 0) return null;
    const dir = dy > 0 ? 1 : -1;
    const probeY = dir > 0 ? p.y + p.h : p.y;
    const r = Math.floor(probeY / TILE_SIZE);
    const cLeft = Math.floor(p.x / TILE_SIZE);
    const cRight = Math.floor((p.x + p.w - 0.01) / TILE_SIZE);
    for (let c = cLeft; c <= cRight; c++) {
      const ch = getTile(state.grid, c, r);
      if (isSolid(ch)) {
        if (dir > 0) {
          p.y = r * TILE_SIZE - p.h - 0.01;
          p.vy = 0; p.grounded = true;
          p.onIce = isIce(ch);
        } else {
          p.y = (r + 1) * TILE_SIZE + 0.01;
          p.vy = 0;
          /* Hit dal basso: question / brick */
          if (opts2.isPlayer) {
            if (ch === TILES.QUESTION) {
              hitQuestionBlock(c, r);
            } else if (ch === TILES.BRICK) {
              if (p.form === 'big' || p.form === 'fire') {
                breakBrick(c, r);
              } else {
                SFX.stomp();
                bumpParticles(c, r, '#e89c5a');
              }
            }
          }
        }
        return ch;
      } else if (isOneWay(ch) && dir > 0) {
        const tileTop = r * TILE_SIZE;
        const wasAbove = (p.y + p.h - dy) <= tileTop + 0.5;
        if (wasAbove && !p.fallThrough) {
          p.y = tileTop - p.h - 0.01;
          p.vy = 0; p.grounded = true;
          p.onIce = false;
          return ch;
        }
      }
    }
    return null;
  }

  function hitQuestionBlock(c, r) {
    state.grid[r][c] = TILES.USED;
    /* roll: 70% coin, 18% crystal, 7% feather, 3% star, 2% fire flower (se big => fire) */
    const roll = Math.random();
    let drop;
    if (roll < 0.70) drop = 'coin';
    else if (roll < 0.88) drop = 'pow_crystal';
    else if (roll < 0.95) drop = 'pow_feather';
    else if (roll < 0.98) drop = 'pow_fire';
    else drop = 'pow_star';

    if (drop === 'coin') {
      state.particles.push({ type: 'coin_pop', x: c * TILE_SIZE + 4, y: r * TILE_SIZE - 8, vy: -3.2, life: 32 });
      state.coins += 1; state.score += 100;
      cb.onScore?.(state.score); SFX.coin();
      maybeOneUp();
    } else {
      /* spawn power-up sopra il blocco, cade poi a terra */
      state.entities.push({ type: drop, x: c * TILE_SIZE + 1, y: (r - 1) * TILE_SIZE,
        w: 14, h: 14, alive: true, vx: 0, vy: -2, grounded: false, dropped: true });
      SFX.powerup();
    }
    bumpParticles(c, r, '#ffd040');
  }

  function breakBrick(c, r) {
    state.grid[r][c] = TILES.EMPTY;
    state.score += 50; cb.onScore?.(state.score);
    SFX.stomp();
    /* shards */
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        type: 'shard', x: c * TILE_SIZE + 8, y: r * TILE_SIZE + 8,
        vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 2, life: 32,
        color: '#e89c5a',
      });
    }
  }

  function bumpParticles(c, r, color) {
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        type: 'shard', x: c * TILE_SIZE + 4 + Math.random() * 8, y: r * TILE_SIZE + 4,
        vx: (Math.random() - 0.5) * 2.5, vy: -2 - Math.random() * 1.5, life: 18, color,
      });
    }
  }

  function maybeOneUp() {
    while (state.coins >= 100) {
      state.coins -= 100; state.lives += 1;
      state.persistent.lives = state.lives;
      state.floats.push({ text: '1UP!', x: state.player.x - state.camX, y: state.player.y - 8, vy: -0.7, life: 80, color: '#5af066' });
      SFX.oneup();
    }
  }

  /* ─── Update player ─── */
  function updatePlayer(input) {
    const p = state.player; if (!p) return;
    if (state.transition?.type === 'fade-out') return;

    /* Pause toggle */
    if (input.pause && !state.prevPause) {
      state.paused = true; SFX.pause();
    }

    /* Coyote / jump buffer */
    if (p.grounded) p.coyote = PHYS.COYOTE_FRAMES;
    else if (p.coyote > 0) p.coyote--;

    if (input.jump && !state.prevJump) p.jumpBuffer = PHYS.JUMP_BUFFER_FRAMES;
    else if (p.jumpBuffer > 0) p.jumpBuffer--;
    if (!input.jump) { p.jumpReleased = true; p.jumpHeldFrames = 0; }

    /* Salto: avvia se buffer + (grounded || coyote) e tasto stato rilasciato */
    if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0) && p.jumpReleased) {
      /* Mario-style: piu velocita orizzontale → salto piu alto */
      const speedRatio = Math.min(1, Math.abs(p.vx) / PHYS.RUN_SPEED);
      p.vy = PHYS.JUMP_VEL + PHYS.JUMP_VEL_RUN_BONUS * speedRatio;
      p.grounded = false; p.coyote = 0; p.jumpBuffer = 0;
      p.jumpHeldFrames = 1; p.jumpReleased = false;
      SFX.jump();
    } else if (p.jumpBuffer > 0 && !p.grounded && p.coyote <= 0 && p.doubleJumpAvail && p.jumpReleased) {
      /* Doppio salto piuma */
      p.vy = PHYS.DOUBLE_JUMP_VEL;
      p.doubleJumpAvail = false; p.jumpBuffer = 0;
      p.jumpReleased = false; p.jumpHeldFrames = 1;
      SFX.doubleJump();
    }

    /* Hold: estende il salto applicando gravita ridotta nei prossimi N frame */
    let g;
    if (p.vy < 0) {
      if (input.jump && p.jumpHeldFrames > 0 && p.jumpHeldFrames < PHYS.JUMP_HOLD_FRAMES) {
        g = PHYS.GRAVITY_RISE * PHYS.JUMP_HOLD_GRAVITY_FACTOR;
        p.jumpHeldFrames++;
      } else {
        g = PHYS.GRAVITY_RISE;
      }
    } else {
      /* caduta */
      g = input.down ? PHYS.GRAVITY_FAST_FALL : PHYS.GRAVITY_FALL;
    }
    p.vy = clamp(p.vy + g, -20, PHYS.MAX_FALL);

    /* Movimento orizzontale */
    const accel = input.run ? PHYS.ACCEL_RUN : PHYS.ACCEL_GROUND;
    const maxSpd = input.run ? PHYS.RUN_SPEED : PHYS.WALK_SPEED;
    if (input.left) {
      /* Skid: se sta andando a destra e preme sinistra, decelera prima */
      if (p.vx > 0.2 && p.grounded) p.vx -= PHYS.SKID_DECEL;
      else p.vx -= accel;
      p.dir = -1;
    } else if (input.right) {
      if (p.vx < -0.2 && p.grounded) p.vx += PHYS.SKID_DECEL;
      else p.vx += accel;
      p.dir = 1;
    } else {
      const fric = !p.grounded ? PHYS.FRICTION_AIR : (p.onIce ? PHYS.FRICTION_ICE : PHYS.FRICTION_GROUND);
      p.vx *= fric;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }
    p.vx = clamp(p.vx, -maxSpd, maxSpd);

    /* Fall-through one-way */
    p.fallThrough = input.down && p.grounded;

    /* Reset grounded prima di moveY (potrebbe essere riaffermato) */
    p.grounded = false;
    moveX(p, p.vx);
    moveY(p, p.vy, { isPlayer: true });

    /* Tile-effects sul tile dei piedi */
    const fc = Math.floor((p.x + p.w / 2) / TILE_SIZE);
    const fr = Math.floor((p.y + p.h + 0.1) / TILE_SIZE);
    const ftile = getTile(state.grid, fc, fr);
    if (ftile === TILES.LAVA || isLava(ftile)) { killPlayer(); return; }

    /* Tile sotto la testa per pickup-coin in mid-air */
    const colCenter = Math.floor((p.x + p.w / 2) / TILE_SIZE);
    const rowsToCheck = [
      Math.floor(p.y / TILE_SIZE),
      Math.floor((p.y + p.h / 2) / TILE_SIZE),
      Math.floor((p.y + p.h - 1) / TILE_SIZE),
    ];
    for (const rr of rowsToCheck) {
      const ch = getTile(state.grid, colCenter, rr);
      if (ch === TILES.COIN) {
        state.grid[rr][colCenter] = TILES.EMPTY;
        state.coins += 1; state.score += 100;
        cb.onScore?.(state.score); SFX.coin();
        maybeOneUp();
      } else if (ch === TILES.GOAL || ch === TILES.POLE) {
        completeLevel();
        return;
      } else if (ch === TILES.CHECKPOINT) {
        if (!state.checkpoint || state.checkpoint.col !== colCenter || state.checkpoint.row !== rr) {
          state.checkpoint = { col: colCenter, row: rr };
          state.floats.push({ text: t('checkpointReached'), x: p.x - state.camX, y: p.y - 8, vy: -0.6, life: 70, color: '#22c0ff' });
          SFX.checkpoint();
        }
      }
    }

    /* Fall pit */
    if (p.y > state.grid.length * TILE_SIZE + 64) { killPlayer(); return; }

    /* Iframes / power timer */
    if (p.iframes > 0) p.iframes--;
    if (p.invincibleFrames > 0) p.invincibleFrames--;
    if (p.doubleJumpFrames > 0) {
      p.doubleJumpFrames--;
      if (p.doubleJumpFrames === 0) p.doubleJumpAvail = false;
    }
    if (p.fireCooldown > 0) p.fireCooldown--;

    /* Fireball: solo in fire form */
    if (p.form === 'fire' && input.fire && !state.prevFire && p.fireCooldown === 0) {
      shootFireball();
      p.fireCooldown = 18;
    }

    /* Anim state */
    if (!p.grounded) p.stateAnim = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 0.4) {
      p.animTimer++;
      if (p.animTimer >= Math.max(3, 8 - Math.abs(p.vx))) {
        p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 2;
      }
      p.stateAnim = p.animFrame === 0 ? 'walk1' : 'walk2';
    } else {
      p.stateAnim = 'idle'; p.animFrame = 0;
    }
  }

  function shootFireball() {
    const p = state.player;
    state.fireballs.push({
      x: p.x + (p.dir > 0 ? p.w : -6), y: p.y + 6,
      vx: p.dir * PHYS.FIREBALL_VX, vy: PHYS.FIREBALL_VY_INIT,
      bounces: 0, alive: true, angle: 0,
    });
    SFX.fireball();
  }

  /* ─── Update entita ─── */
  function updateEntities() {
    const p = state.player;
    for (const e of state.entities) {
      if (!e.alive) continue;

      /* Power-up dropped: cade fino al primo terreno */
      if (e.type === 'pow_crystal' || e.type === 'pow_star' || e.type === 'pow_feather' || e.type === 'pow_fire') {
        if (!e.grounded) {
          e.vy = clamp(e.vy + PHYS.GRAVITY_FALL, -10, PHYS.MAX_FALL);
          e.y += e.vy;
          const r = Math.floor((e.y + e.h) / TILE_SIZE);
          const cL = Math.floor(e.x / TILE_SIZE);
          const cR = Math.floor((e.x + e.w - 0.01) / TILE_SIZE);
          for (let cc = cL; cc <= cR; cc++) {
            if (isSolid(getTile(state.grid, cc, r))) {
              e.y = r * TILE_SIZE - e.h - 0.01;
              e.vy = 0; e.grounded = true; break;
            }
          }
        }
        /* Drift orizzontale per cristallo */
        if (e.grounded && e.type === 'pow_crystal') {
          e.vx = e.vx || 0.9;
          e.x += e.vx;
          const dirP = e.vx > 0 ? 1 : -1;
          const c2 = Math.floor((dirP > 0 ? e.x + e.w : e.x) / TILE_SIZE);
          const rT2 = Math.floor(e.y / TILE_SIZE);
          const rB2 = Math.floor((e.y + e.h - 0.01) / TILE_SIZE);
          for (let r2 = rT2; r2 <= rB2; r2++) {
            if (isSolid(getTile(state.grid, c2, r2))) { e.vx = -e.vx; break; }
          }
        }
        continue;
      }

      /* Sloimo (Goomba) */
      if (e.type === 'slime') {
        e.vy = clamp(e.vy + PHYS.GRAVITY_FALL, -10, PHYS.MAX_FALL);
        e.x += e.vx;
        /* collisione X (rimbalzo su muro) */
        const dirS = e.vx > 0 ? 1 : -1;
        const cS = Math.floor((dirS > 0 ? e.x + e.w : e.x) / TILE_SIZE);
        const rT = Math.floor(e.y / TILE_SIZE);
        const rB = Math.floor((e.y + e.h - 0.01) / TILE_SIZE);
        let hit = false;
        for (let rr = rT; rr <= rB; rr++) {
          if (isSolid(getTile(state.grid, cS, rr))) { hit = true; break; }
        }
        if (hit) {
          if (dirS > 0) e.x = cS * TILE_SIZE - e.w - 0.01;
          else e.x = (cS + 1) * TILE_SIZE + 0.01;
          e.vx = -e.vx; e.dir = -e.dir;
        }
        /* check burrone: se sotto i piedi nel verso di marcia non c'e terreno → inverti */
        if (!hit) {
          const probeC = Math.floor((dirS > 0 ? e.x + e.w + 1 : e.x - 1) / TILE_SIZE);
          const probeR = Math.floor((e.y + e.h + 2) / TILE_SIZE);
          if (!isSolid(getTile(state.grid, probeC, probeR)) && !isOneWay(getTile(state.grid, probeC, probeR))) {
            /* solo se attualmente a terra (non gia in caduta nel buco) */
            if (e.grounded) { e.vx = -e.vx; e.dir = -e.dir; }
          }
        }
        /* Y move */
        e.y += e.vy;
        const rg = Math.floor((e.y + e.h) / TILE_SIZE);
        const cgL = Math.floor(e.x / TILE_SIZE);
        const cgR = Math.floor((e.x + e.w - 0.01) / TILE_SIZE);
        e.grounded = false;
        for (let cc = cgL; cc <= cgR; cc++) {
          const tt = getTile(state.grid, cc, rg);
          if (isSolid(tt)) {
            e.y = rg * TILE_SIZE - e.h - 0.01;
            e.vy = 0; e.grounded = true; break;
          }
        }
        e.animTimer++;
        if (e.animTimer >= 12) { e.animTimer = 0; e.animFrame = (e.animFrame + 1) % 2; }
      }
      /* Tartarax (Koopa) */
      else if (e.type === 'koopa') {
        e.vy = clamp(e.vy + PHYS.GRAVITY_FALL, -10, PHYS.MAX_FALL);
        if (e.subState === 'shell' && Math.abs(e.vx) < 0.05) {
          /* shell ferma — countdown per riprendere */
          e.shellTimer--;
          if (e.shellTimer <= 0) { e.subState = 'walk'; e.vx = -0.6; e.dir = -1; }
        }
        if (Math.abs(e.vx) > 0.05) {
          e.x += e.vx;
          const dirK = e.vx > 0 ? 1 : -1;
          const cK = Math.floor((dirK > 0 ? e.x + e.w : e.x) / TILE_SIZE);
          const rT = Math.floor(e.y / TILE_SIZE);
          const rB = Math.floor((e.y + e.h - 0.01) / TILE_SIZE);
          let hit = false;
          for (let rr = rT; rr <= rB; rr++) {
            if (isSolid(getTile(state.grid, cK, rr))) { hit = true; break; }
          }
          if (hit) {
            if (dirK > 0) e.x = cK * TILE_SIZE - e.w - 0.01;
            else e.x = (cK + 1) * TILE_SIZE + 0.01;
            if (e.subState === 'shell') {
              e.vx = -e.vx; SFX.stomp();
            } else {
              e.vx = -e.vx; e.dir = -e.dir;
            }
          }
          /* shell in volo: uccide altri nemici */
          if (e.subState === 'shell' && Math.abs(e.vx) > 1) {
            for (const o of state.entities) {
              if (!o.alive || o === e) continue;
              if (o.type !== 'slime' && o.type !== 'koopa') continue;
              if (aabbOverlap(e, o)) {
                o.alive = false;
                state.score += 200; cb.onScore?.(state.score);
                SFX.stomp();
              }
            }
          }
          /* check burrone (solo walk) */
          if (!hit && e.subState === 'walk' && e.grounded) {
            const probeC = Math.floor((dirK > 0 ? e.x + e.w + 1 : e.x - 1) / TILE_SIZE);
            const probeR = Math.floor((e.y + e.h + 2) / TILE_SIZE);
            if (!isSolid(getTile(state.grid, probeC, probeR)) && !isOneWay(getTile(state.grid, probeC, probeR))) {
              e.vx = -e.vx; e.dir = -e.dir;
            }
          }
        }
        /* Y move */
        e.y += e.vy;
        const rg = Math.floor((e.y + e.h) / TILE_SIZE);
        const cgL = Math.floor(e.x / TILE_SIZE);
        const cgR = Math.floor((e.x + e.w - 0.01) / TILE_SIZE);
        e.grounded = false;
        for (let cc = cgL; cc <= cgR; cc++) {
          const tt = getTile(state.grid, cc, rg);
          if (isSolid(tt)) {
            e.y = rg * TILE_SIZE - e.h - 0.01;
            e.vy = 0; e.grounded = true; break;
          }
        }
        e.animTimer++;
        if (e.animTimer >= 14) { e.animTimer = 0; e.animFrame = (e.animFrame + 1) % 2; }
      }
      /* Spinazzo: statico — niente */
    }

    /* Cull entita uscite dal mondo (sotto) */
    for (const e of state.entities) {
      if (e.y > state.grid.length * TILE_SIZE + 100) e.alive = false;
    }

    /* Player <-> entita */
    if (!p) return;
    for (const e of state.entities) {
      if (!e.alive) continue;
      if (!aabbOverlap(p, e)) continue;

      /* Power-up pickup */
      if (e.type === 'pow_crystal') { e.alive = false; applyCrystal(); continue; }
      if (e.type === 'pow_fire')    { e.alive = false; applyFire();    continue; }
      if (e.type === 'pow_star')    { e.alive = false; applyStar();    continue; }
      if (e.type === 'pow_feather') { e.alive = false; applyFeather(); continue; }

      /* Spinazzo: pura collisione laterale */
      if (e.type === 'spike') {
        if (p.invincibleFrames > 0) { e.alive = false; state.score += 200; cb.onScore?.(state.score); }
        else damagePlayer();
        continue;
      }

      /* Stella: tutto muore */
      if (p.invincibleFrames > 0) {
        e.alive = false; state.score += 200; cb.onScore?.(state.score);
        SFX.stomp();
        continue;
      }

      /* Tartarax shell ferma → kick */
      if (e.type === 'koopa' && e.subState === 'shell' && Math.abs(e.vx) < 0.05) {
        const fromLeft = (p.x + p.w / 2) < (e.x + e.w / 2);
        e.vx = fromLeft ? PHYS.SHELL_SPEED : -PHYS.SHELL_SPEED;
        e.dir = fromLeft ? 1 : -1;
        e.shellTimer = 600; // resta shell per ~10s prima di tornare walk
        SFX.kick();
        state.floats.push({ text: t('shellKick'), x: p.x - state.camX, y: p.y - 6, vy: -0.7, life: 60, color: '#5af066' });
        continue;
      }

      /* Stomp test: cadendo + piedi sopra il top */
      const feet = p.y + p.h;
      const enemyTop = e.y;
      if (p.vy > 0 && feet - p.vy <= enemyTop + 4) {
        if (e.type === 'slime') {
          e.alive = false;
          state.score += 100; cb.onScore?.(state.score);
        } else if (e.type === 'koopa') {
          if (e.subState === 'walk') {
            e.subState = 'shell'; e.vx = 0; e.h = 14;
            e.shellTimer = 600;
            state.score += 200; cb.onScore?.(state.score);
            state.floats.push({ text: t('tartaraxStomp'), x: p.x - state.camX, y: p.y - 6, vy: -0.7, life: 60, color: '#22e0ff' });
          } else if (e.subState === 'shell' && Math.abs(e.vx) > 1) {
            /* fermo lo shell in volo stompandolo */
            e.vx = 0; e.shellTimer = 600;
          }
        }
        const k = cb.keysRef?.current || {};
        const holdJump = k[' '] || k['Spacebar'] || k['w'] || k['W'] || k['ArrowUp'];
        p.vy = holdJump ? PHYS.STOMP_BOUNCE_HOLD : PHYS.STOMP_BOUNCE;
        SFX.stomp();
      } else {
        damagePlayer();
      }
    }

    /* Fireball update */
    for (const f of state.fireballs) {
      if (!f.alive) continue;
      f.vy = clamp(f.vy + PHYS.FIREBALL_GRAVITY, -10, 8);
      f.x += f.vx; f.y += f.vy; f.angle += 0.3;
      /* off-camera o off-world */
      if (f.x < state.camX - 32 || f.x > state.camX + VIEW_W + 32) { f.alive = false; continue; }
      if (f.y > state.grid.length * TILE_SIZE) { f.alive = false; continue; }
      /* Collisione tile */
      const cF = Math.floor((f.x + 4) / TILE_SIZE);
      const rF = Math.floor((f.y + 4) / TILE_SIZE);
      const tt = getTile(state.grid, cF, rF);
      if (isSolid(tt)) {
        /* rimbalzo sul pavimento */
        if (f.vy > 0) {
          f.vy = PHYS.FIREBALL_BOUNCE_VY;
          f.bounces++;
          if (f.bounces > PHYS.FIREBALL_MAX_BOUNCES) { f.alive = false; SFX.fireballHit(); }
        } else {
          f.alive = false; SFX.fireballHit();
        }
      }
      /* Hit nemici */
      if (f.alive) {
        for (const e of state.entities) {
          if (!e.alive) continue;
          if (e.type !== 'slime' && e.type !== 'koopa') continue;
          if (aabbOverlap({ x: f.x, y: f.y, w: 8, h: 8 }, e)) {
            e.alive = false; f.alive = false;
            state.score += 200; cb.onScore?.(state.score);
            SFX.fireballHit();
            break;
          }
        }
      }
    }

    /* Cleanup */
    state.entities = state.entities.filter(e => e.alive);
    state.fireballs = state.fireballs.filter(f => f.alive);
  }

  /* ─── Power-up effetti ─── */
  function applyCrystal() {
    const p = state.player;
    if (p.form === 'small') growBig();
    state.score += 1000; cb.onScore?.(state.score);
    state.floats.push({ text: t('bigGet'), x: p.x - state.camX - 30, y: p.y, vy: -0.6, life: 90, color: '#22e0ff' });
    SFX.powerup();
    cb.onHpChange?.(p.form === 'small' ? 1 : 2, 2);
  }

  function applyFire() {
    const p = state.player;
    if (p.form === 'small') growBig();
    p.form = 'fire';
    state.score += 1000; cb.onScore?.(state.score);
    state.floats.push({ text: t('fireGet'), x: p.x - state.camX - 30, y: p.y, vy: -0.6, life: 90, color: '#ff5050' });
    SFX.powerup();
    cb.onHpChange?.(2, 2);
  }

  function applyStar() {
    const p = state.player;
    p.invincibleFrames = 60 * 8;
    state.score += 1000; cb.onScore?.(state.score);
    state.floats.push({ text: t('starGet'), x: p.x - state.camX - 30, y: p.y, vy: -0.6, life: 90, color: '#ffd040' });
    SFX.powerup();
  }

  function applyFeather() {
    const p = state.player;
    p.doubleJumpFrames = 60 * 12;
    p.doubleJumpAvail = true;
    state.score += 1000; cb.onScore?.(state.score);
    state.floats.push({ text: t('featherGet'), x: p.x - state.camX - 30, y: p.y, vy: -0.6, life: 90, color: '#ffffff' });
    SFX.powerup();
  }

  function growBig() {
    const p = state.player;
    p.form = 'big';
    const oldH = p.h; p.h = PLAYER_H_BIG;
    p.y -= (p.h - oldH);
  }

  function shrinkSmall() {
    const p = state.player;
    p.form = 'small';
    const oldH = p.h; p.h = PLAYER_H_SMALL;
    p.y += (oldH - p.h);
  }

  function damagePlayer() {
    const p = state.player;
    if (p.iframes > 0 || p.invincibleFrames > 0) return;
    if (p.form === 'fire') {
      p.form = 'big'; p.iframes = PHYS.IFRAME_FRAMES;
      cb.onHpChange?.(2, 2); SFX.hit();
    } else if (p.form === 'big') {
      shrinkSmall(); p.iframes = PHYS.IFRAME_FRAMES;
      cb.onHpChange?.(1, 2); SFX.hit();
    } else {
      killPlayer();
    }
  }

  function killPlayer() {
    if (state.gameOver || state.transition?.type === 'fade-out') return;
    SFX.death();
    state.lives -= 1;
    state.persistent.lives = state.lives;
    cb.onHpChange?.(0, 2);
    state.transition = { type: 'fade-out', t: 0, dur: 60, then: () => {
      if (state.lives <= 0) triggerGameOver();
      else loadLevel(state.worldId, state.levelIdx, state.checkpoint);
    } };
  }

  function triggerGameOver() {
    state.gameOver = true;
    stopMusic();
    cb.onGameOver?.(state.score);
    /* Reset sessione */
    state.persistent.sessionScore = 0;
    state.persistent.sessionCoins = 0;
    state.persistent.lives = 3;
    state.persistent.currentWorld = 1;
    state.persistent.currentLevel = 1;
    delete state.persistent.bigCarryOver;
    delete state.persistent.bigCarryForm;
    saveSave(state.persistent);
  }

  function completeLevel() {
    if (state.levelComplete) return;
    state.levelComplete = true;
    SFX.levelClear();
    const timeBonus = Math.max(0, Math.floor(state.timeLeft) * 50);
    state.score += timeBonus; cb.onScore?.(state.score);
    /* Aggiorna best */
    const lk = `${state.worldId}-${state.levelIdx}`;
    state.persistent.completedLevels = state.persistent.completedLevels || {};
    state.persistent.completedLevels[lk] = true;
    state.persistent.bestTimes = state.persistent.bestTimes || {};
    state.persistent.bestScores = state.persistent.bestScores || {};
    const usedTime = state.timeMax - state.timeLeft;
    if (!state.persistent.bestTimes[lk] || usedTime < state.persistent.bestTimes[lk]) {
      state.persistent.bestTimes[lk] = usedTime;
    }
    if (!state.persistent.bestScores[lk] || state.score > state.persistent.bestScores[lk]) {
      state.persistent.bestScores[lk] = state.score;
    }
    /* Carry-over forma per il prossimo livello */
    const nxt = nextLevel(state.worldId, state.levelIdx);
    if (nxt) {
      state.persistent.bigCarryOver = `${nxt.world}:${nxt.level}`;
      state.persistent.bigCarryForm = state.player.form;
    }
    saveSave(state.persistent);
    /* Transizione al prossimo livello */
    state.transition = { type: 'fade-out', t: 0, dur: 80, then: () => {
      if (nxt) loadLevel(nxt.world, nxt.level, null);
      else { /* Game finished */ triggerGameOver(); }
    } };
  }

  /* ─── Update particelle ─── */
  function updateParticles() {
    for (const p of state.particles) {
      if (p.type === 'coin_pop') {
        p.y += p.vy; p.vy += 0.3; p.life--;
      } else if (p.type === 'shard') {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life--;
      }
    }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const f of state.floats) { f.y += f.vy; f.life--; }
    state.floats = state.floats.filter(f => f.life > 0);
  }

  /* ─── Camera NES-style: scrolla SOLO a destra ─── */
  function updateCamera() {
    const p = state.player; if (!p) return;
    const targetX = p.x + p.w / 2 - VIEW_W * 0.38;
    if (targetX > state.camX) state.camX = targetX;
    const maxCam = state.grid[0].length * TILE_SIZE - VIEW_W;
    state.camX = clamp(state.camX, 0, Math.max(0, maxCam));
  }

  /* ─── Render ─── */
  function renderBackground() {
    const pal = state.world.palette;
    /* Cielo a 3 stop per profondita */
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.skyTop || pal.sky);
    grad.addColorStop(0.6, pal.sky);
    grad.addColorStop(1, pal.skyBottom || pal.sky);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* Sole/Luna fisso (non scrolla) */
    ctx.fillStyle = pal.sun || '#ffeb6b';
    ctx.beginPath(); ctx.arc(VIEW_W - 70, 80, 20, 0, Math.PI * 2); ctx.fill();
    /* Glow del sole */
    ctx.fillStyle = 'rgba(255,235,107,0.18)';
    ctx.beginPath(); ctx.arc(VIEW_W - 70, 80, 32, 0, Math.PI * 2); ctx.fill();

    /* Parallax 0: cime di montagne lontane (semplici triangoli) */
    const px0 = state.camX * 0.10;
    ctx.fillStyle = pal.mountainFar || 'rgba(120,140,180,0.55)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 280) - px0) % (VIEW_W + 280);
      const xx = x < 0 ? x + VIEW_W + 280 : x;
      const y = VIEW_H - 200;
      ctx.beginPath();
      ctx.moveTo(xx, VIEW_H - 80);
      ctx.lineTo(xx + 90, y);
      ctx.lineTo(xx + 180, VIEW_H - 80);
      ctx.closePath(); ctx.fill();
    }

    /* Parallax 1: nuvole pixel-art */
    const px1 = state.camX * 0.25;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 200) - px1) % (VIEW_W + 200);
      const xx = Math.round((x < 0 ? x + VIEW_W + 200 : x));
      const y = 60 + (i % 3) * 30;
      drawCloud(xx, y);
    }

    /* Parallax 2: colline pixel-art */
    const px2 = state.camX * 0.55;
    for (let i = 0; i < 12; i++) {
      const x = ((i * 110) - px2) % (VIEW_W + 220);
      const xx = Math.round((x < 0 ? x + VIEW_W + 220 : x));
      const y = VIEW_H - 100;
      drawHill(xx, y, pal.foliage || '#3d8b3d');
    }
  }

  function drawCloud(x, y) {
    /* Nuvola pixel-art a blocchetti */
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y, 14, 4);
    ctx.fillRect(x + 2, y + 4, 22, 6);
    ctx.fillRect(x, y + 6, 26, 4);
    ctx.fillRect(x + 18, y, 8, 4);
    /* Ombra inferiore */
    ctx.fillStyle = '#d8e4f0';
    ctx.fillRect(x, y + 9, 26, 1);
    ctx.fillRect(x + 2, y + 10, 22, 1);
  }

  function drawHill(x, y, color) {
    /* Collina arrotondata pixel */
    ctx.fillStyle = color;
    ctx.fillRect(x + 24, y, 24, 6);
    ctx.fillRect(x + 18, y + 4, 36, 8);
    ctx.fillRect(x + 12, y + 8, 48, 10);
    ctx.fillRect(x + 6, y + 14, 60, 14);
    ctx.fillRect(x, y + 22, 72, 16);
    /* Ombra a destra */
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 38, y + 4, 16, 6);
    ctx.fillRect(x + 44, y + 12, 22, 10);
    ctx.fillRect(x + 50, y + 22, 22, 16);
    /* Highlight a sinistra */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 24, y, 4, 4);
    ctx.fillRect(x + 18, y + 4, 4, 4);
    ctx.fillRect(x + 12, y + 8, 4, 6);
  }

  function drawTile(ch, x, y) {
    const pal = state.world.palette;
    if (ch === TILES.GROUND) {
      ctx.fillStyle = pal.earth || '#7a4f2e'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* Pattern mattoncini */
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(x, y + 7, TILE_SIZE, 1);
      ctx.fillRect(x + 5, y + 1, 1, 6);
      ctx.fillRect(x + 11, y + 8, 1, 7);
      /* Highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 1);
      ctx.fillRect(x + 1, y + 8, TILE_SIZE - 2, 1);
    } else if (ch === TILES.GRASS) {
      ctx.fillStyle = pal.earth || '#7a4f2e'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* Strato erbaceo top */
      ctx.fillStyle = pal.ground || '#5fa454'; ctx.fillRect(x, y, TILE_SIZE, 6);
      ctx.fillStyle = pal.grassTop || '#88d65a'; ctx.fillRect(x, y, TILE_SIZE, 3);
      /* Filamenti d'erba sopra */
      ctx.fillStyle = pal.grassTop || '#88d65a';
      ctx.fillRect(x + 2, y - 2, 1, 2);
      ctx.fillRect(x + 3, y - 1, 1, 1);
      ctx.fillRect(x + 7, y - 3, 1, 3);
      ctx.fillRect(x + 8, y - 2, 1, 2);
      ctx.fillRect(x + 12, y - 2, 1, 2);
      ctx.fillRect(x + 13, y - 1, 1, 1);
      /* Ombra nel sottosuolo + highlight erba */
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(x, y + 6, TILE_SIZE, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, TILE_SIZE, 1);
      /* Sassolini nella terra */
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(x + 4, y + 10, 2, 1);
      ctx.fillRect(x + 11, y + 13, 2, 1);
    } else if (ch === TILES.EARTH) {
      ctx.fillStyle = pal.earth || '#7a4f2e'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* Granuli */
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(x + 3, y + 5, 2, 1);
      ctx.fillRect(x + 10, y + 9, 2, 1);
      ctx.fillRect(x + 6, y + 12, 1, 1);
      ctx.fillRect(x + 13, y + 4, 1, 1);
      ctx.fillStyle = '#a07050';
      ctx.fillRect(x + 8, y + 3, 1, 1);
      ctx.fillRect(x + 2, y + 11, 1, 1);
    } else if (ch === TILES.BRICK) {
      ctx.fillStyle = pal.brick || '#e89c5a'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      const sh = pal.brickShadow || '#a05010';
      /* Borde scuro */
      ctx.fillStyle = sh;
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
      /* Linee orizzontali (giunto malta) */
      ctx.fillRect(x, y + 7, TILE_SIZE, 1);
      /* Linee verticali alternate (mattoni sfalsati) */
      ctx.fillRect(x + 4, y + 1, 1, 6);
      ctx.fillRect(x + 12, y + 1, 1, 6);
      ctx.fillRect(x, y + 8, 1, 7);
      ctx.fillRect(x + 8, y + 8, 1, 7);
      /* Highlight chiaro top di ogni mattone */
      ctx.fillStyle = '#ffd0a0';
      ctx.fillRect(x + 1, y + 1, 3, 1);
      ctx.fillRect(x + 5, y + 1, 7, 1);
      ctx.fillRect(x + 13, y + 1, 2, 1);
      ctx.fillRect(x + 1, y + 8, 7, 1);
      ctx.fillRect(x + 9, y + 8, 6, 1);
    } else if (ch === TILES.QUESTION) {
      const pulse = Math.floor(state.elapsedSeconds * 4) % 3;
      const cBase = pulse === 0 ? '#ffb820' : pulse === 1 ? '#ffd040' : '#ff9000';
      ctx.fillStyle = cBase; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* Bordo inciso */
      ctx.fillStyle = '#a06000';
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(x, y, 1, TILE_SIZE);
      ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      /* Borchie negli angoli */
      ctx.fillStyle = '#fff8a0';
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 3, y + 1, 2, 2);
      ctx.fillRect(x + 1, y + TILE_SIZE - 3, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 3, y + TILE_SIZE - 3, 2, 2);
      /* "?" disegnato a pixel */
      ctx.fillStyle = '#fff';
      /* curva sopra */
      ctx.fillRect(x + 6, y + 4, 4, 1);
      ctx.fillRect(x + 5, y + 5, 1, 1); ctx.fillRect(x + 10, y + 5, 1, 1);
      ctx.fillRect(x + 9, y + 6, 2, 1);
      ctx.fillRect(x + 8, y + 7, 2, 1);
      /* asta */
      ctx.fillRect(x + 7, y + 8, 2, 2);
      /* punto */
      ctx.fillRect(x + 7, y + 11, 2, 2);
      /* Ombra del "?" */
      ctx.fillStyle = '#a06000';
      ctx.fillRect(x + 6, y + 5, 4, 1);
      ctx.fillRect(x + 7, y + 13, 2, 1);
    } else if (ch === TILES.USED) {
      ctx.fillStyle = '#7a5020'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(x, y, TILE_SIZE, 1); ctx.fillRect(x, y + 15, TILE_SIZE, 1);
      ctx.fillRect(x, y, 1, TILE_SIZE); ctx.fillRect(x + 15, y, 1, TILE_SIZE);
      /* Borchie spente */
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + 13, y + 1, 2, 2);
      ctx.fillRect(x + 1, y + 13, 2, 2);
      ctx.fillRect(x + 13, y + 13, 2, 2);
    } else if (ch === TILES.PLATFORM) {
      ctx.fillStyle = '#a87844'; ctx.fillRect(x, y, TILE_SIZE, 5);
      ctx.fillStyle = '#7a5020'; ctx.fillRect(x, y + 5, TILE_SIZE, 1);
      ctx.fillStyle = '#d09866'; ctx.fillRect(x, y, TILE_SIZE, 1);
      /* venature */
      ctx.fillStyle = '#7a5020';
      ctx.fillRect(x + 3, y + 2, 1, 2);
      ctx.fillRect(x + 9, y + 1, 1, 3);
    } else if (ch === TILES.LAVA) {
      const t2 = state.elapsedSeconds;
      ctx.fillStyle = '#c01010'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = `rgba(255,${120 + Math.sin(t2 * 4 + x) * 60},20,1)`;
      ctx.fillRect(x, y + 2, TILE_SIZE, TILE_SIZE - 2);
      /* Bolle */
      ctx.fillStyle = '#ffe080';
      const bx = (Math.sin(t2 * 2 + x * 0.1) * 6) | 0;
      ctx.fillRect(x + 1 + bx, y + 1, 3, 1);
      ctx.fillRect(x + 9 - bx, y + 2, 4, 1);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 2, y + 1, 1, 1);
    } else if (ch === TILES.WATER) {
      const t2 = state.elapsedSeconds;
      ctx.fillStyle = 'rgba(50,120,200,0.7)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(180,220,255,0.8)';
      const wave = Math.floor(Math.sin(t2 * 3 + x * 0.3));
      ctx.fillRect(x, y + 1 + wave, TILE_SIZE, 1);
      ctx.fillStyle = 'rgba(120,180,230,0.6)';
      ctx.fillRect(x, y + 5, TILE_SIZE, 1);
      ctx.fillRect(x, y + 11, TILE_SIZE, 1);
    } else if (ch === TILES.ICE) {
      ctx.fillStyle = '#a8d8ff'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x + 1, y + 1, 4, 1);
      ctx.fillRect(x + 8, y + 4, 4, 1);
      ctx.fillRect(x + 2, y + 10, 3, 1);
      ctx.fillStyle = '#5090c0'; ctx.fillRect(x, y + 15, TILE_SIZE, 1);
      ctx.fillStyle = '#88c0e8'; ctx.fillRect(x, y, TILE_SIZE, 1);
      /* Crepe */
      ctx.fillStyle = '#7ab0d8';
      ctx.fillRect(x + 6, y + 6, 1, 4);
      ctx.fillRect(x + 7, y + 8, 1, 1);
    } else if (ch === TILES.PIPE_CAP_L || ch === TILES.PIPE_CAP_R) {
      ctx.fillStyle = '#1ca53b'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* Bordo cap */
      ctx.fillStyle = '#0a5a1a';
      ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
      ctx.fillRect(x, y, TILE_SIZE, 1);
      /* Rim luminoso */
      ctx.fillStyle = '#7af060';
      ctx.fillRect(x + (ch === TILES.PIPE_CAP_L ? 2 : 0), y + 2, ch === TILES.PIPE_CAP_L ? 4 : 14, 3);
      /* Bordo laterale esterno */
      ctx.fillStyle = '#0a5a1a';
      if (ch === TILES.PIPE_CAP_L) ctx.fillRect(x, y, 2, TILE_SIZE);
      else ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
      /* Banda mediana ombra */
      ctx.fillStyle = '#118a30';
      ctx.fillRect(x, y + 8, TILE_SIZE, 2);
    } else if (ch === TILES.PIPE_BODY_L || ch === TILES.PIPE_BODY_R) {
      ctx.fillStyle = '#1ca53b'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#7af060';
      ctx.fillRect(x + (ch === TILES.PIPE_BODY_L ? 2 : 0), y, ch === TILES.PIPE_BODY_L ? 4 : 14, 4);
      ctx.fillStyle = '#0a5a1a';
      if (ch === TILES.PIPE_BODY_L) ctx.fillRect(x, y, 2, TILE_SIZE);
      else ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
      ctx.fillStyle = '#118a30';
      ctx.fillRect(x, y + 7, TILE_SIZE, 2);
    } else if (ch === TILES.BRIDGE) {
      ctx.fillStyle = '#a87844'; ctx.fillRect(x, y, TILE_SIZE, 6);
      ctx.fillStyle = '#7a5020'; ctx.fillRect(x, y + 6, TILE_SIZE, 2);
      /* Asse di legno */
      ctx.fillStyle = '#7a5020';
      ctx.fillRect(x + 4, y, 1, 6);
      ctx.fillRect(x + 12, y, 1, 6);
    } else if (ch === TILES.TRUNK) {
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 4, y, 8, TILE_SIZE);
      ctx.fillStyle = '#3a2410'; ctx.fillRect(x + 6, y, 2, TILE_SIZE);
      ctx.fillStyle = '#7a5028'; ctx.fillRect(x + 4, y, 1, TILE_SIZE);
    } else if (ch === TILES.POLE) {
      ctx.fillStyle = '#666'; ctx.fillRect(x + 7, y, 2, TILE_SIZE);
      ctx.fillStyle = '#aaa'; ctx.fillRect(x + 7, y, 1, TILE_SIZE);
    }
  }

  function renderTiles() {
    const startCol = Math.max(0, Math.floor(state.camX / TILE_SIZE) - 1);
    const endCol = Math.min(state.grid[0].length - 1, Math.ceil((state.camX + VIEW_W) / TILE_SIZE) + 1);
    for (let r = 0; r < state.grid.length; r++) {
      const row = state.grid[r];
      for (let c = startCol; c <= endCol; c++) {
        const ch = row[c]; if (!ch || ch === TILES.EMPTY) continue;
        const x = Math.round(c * TILE_SIZE - state.camX);
        const y = Math.round(r * TILE_SIZE + HUD_H);
        if (ch === TILES.COIN) {
          drawCoin(ctx, x, y, Math.floor(state.elapsedSeconds * 8) % 4);
        } else if (ch === TILES.GOAL) {
          drawGoalPole(ctx, x, y - TILE_SIZE * 5, TILE_SIZE * 6);
        } else if (ch === TILES.CHECKPOINT) {
          drawCheckpointFlag(ctx, x, y - TILE_SIZE,
            !!(state.checkpoint && state.checkpoint.col === c && state.checkpoint.row === r));
        } else {
          drawTile(ch, x, y);
        }
      }
    }
  }

  function renderEntities() {
    for (const e of state.entities) {
      if (!e.alive) continue;
      const x = Math.round(e.x - state.camX);
      const y = Math.round(e.y + HUD_H);
      if (x < -32 || x > VIEW_W + 32) continue;
      if (e.type === 'slime') drawSlimo(ctx, x, y, e.animFrame || 0);
      else if (e.type === 'koopa') {
        if (e.subState === 'walk') drawTartaraxWalk(ctx, x, y, e.dir, e.animFrame || 0);
        else drawTartaraxShell(ctx, x, y);
      }
      else if (e.type === 'spike') {
        ctx.fillStyle = '#888'; ctx.fillRect(x, y + 8, 14, 4);
        ctx.fillStyle = '#bbb';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * 4, y + 8);
          ctx.lineTo(x + i * 4 + 2, y + 2);
          ctx.lineTo(x + i * 4 + 4, y + 8);
          ctx.fill();
        }
      }
      else if (e.type === 'pow_crystal') drawPowerupCrystal(ctx, x, y);
      else if (e.type === 'pow_star')    drawPowerupStar(ctx, x, y, Math.floor(state.elapsedSeconds * 8) % 4);
      else if (e.type === 'pow_feather') drawPowerupFeather(ctx, x, y);
      else if (e.type === 'pow_fire')    drawPowerupFire(ctx, x, y, Math.floor(state.elapsedSeconds * 6) % 4);
    }
  }

  function renderFireballs() {
    for (const f of state.fireballs) {
      if (!f.alive) continue;
      drawFireball(ctx, Math.round(f.x - state.camX), Math.round(f.y + HUD_H), f.angle);
    }
  }

  function renderPlayer() {
    const p = state.player; if (!p) return;
    if (p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 0) return;
    const x = Math.round(p.x - state.camX);
    const y = Math.round(p.y + HUD_H);
    if (p.invincibleFrames > 0) {
      ctx.save();
      const hue = (state.elapsedSeconds * 600) % 360;
      ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
      ctx.shadowBlur = 8;
      drawAndryx(ctx, x, y, p.form, p.dir, framePoseFor(p), p.iframes);
      ctx.restore();
    } else {
      drawAndryx(ctx, x, y, p.form, p.dir, framePoseFor(p), p.iframes);
    }
    if (p.doubleJumpFrames > 0) {
      const sec = (p.doubleJumpFrames / 60).toFixed(1);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🪶${sec}`, x + p.w / 2, y - 4);
    }
  }

  function framePoseFor(p) {
    if (p.stateAnim === 'jump') return 3;
    if (p.stateAnim === 'fall') return 3;
    if (p.stateAnim === 'walk1') return 1;
    if (p.stateAnim === 'walk2') return 2;
    return 0;
  }

  function renderParticles() {
    for (const pp of state.particles) {
      const x = Math.round(pp.x - state.camX);
      const y = Math.round(pp.y + HUD_H);
      if (pp.type === 'coin_pop') {
        ctx.fillStyle = '#ffd040'; ctx.fillRect(x, y, 6, 8);
        ctx.fillStyle = '#a07020'; ctx.fillRect(x, y + 6, 6, 2);
      } else if (pp.type === 'shard') {
        ctx.fillStyle = pp.color || '#fff'; ctx.fillRect(x, y, 4, 4);
      }
    }
    for (const f of state.floats) {
      ctx.fillStyle = f.color || '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y + HUD_H));
    }
  }

  function renderHUD() {
    ctx.fillStyle = 'rgba(15,20,40,0.85)';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);

    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${t('world')} ${state.worldId}-${state.levelIdx}`, 10, HUD_H / 2);

    /* Monete */
    ctx.fillStyle = '#ffd040';
    ctx.beginPath(); ctx.arc(120, HUD_H / 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${String(state.coins).padStart(2, '0')}`, 134, HUD_H / 2);

    /* Vite */
    ctx.fillStyle = '#ff5050'; ctx.fillText('♥', 200, HUD_H / 2);
    ctx.fillStyle = '#fff'; ctx.fillText(`x${state.lives}`, 215, HUD_H / 2);

    /* Forma player */
    const p = state.player;
    if (p) {
      const formIco = p.form === 'fire' ? '🔥' : p.form === 'big' ? '🛡️' : '';
      if (formIco) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(formIco, 250, HUD_H / 2);
      }
    }

    /* Score destra */
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${t('score')}: ${state.score}`, VIEW_W - 10, HUD_H / 2);

    /* Tempo centro */
    ctx.textAlign = 'center';
    const tcol = state.timeLeft < 20 ? '#ff5050' : '#fff';
    ctx.fillStyle = tcol;
    ctx.fillText(`${t('time')} ${Math.max(0, Math.ceil(state.timeLeft))}`, VIEW_W / 2, HUD_H / 2);
  }

  function renderTransition() {
    const tr = state.transition; if (!tr) return;
    const a = tr.type === 'fade-in' ? 1 - tr.t / tr.dur : tr.t / tr.dur;
    ctx.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function renderPause() {
    if (!state.paused) return;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t('pause'), VIEW_W / 2, VIEW_H / 2 - 14);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(t('resume') + ' (P / ESC)', VIEW_W / 2, VIEW_H / 2 + 24);
  }

  function renderGameOver() {
    if (!state.gameOver) return;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ff5050'; ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t('gameOver'), VIEW_W / 2, VIEW_H / 2);
  }

  /* ─── Game loop ─── */
  let rafId = null;
  let lastTime = 0;
  let accum = 0;
  const STEP = 1000 / 60;

  function step(now) {
    rafId = requestAnimationFrame(step);
    if (!lastTime) lastTime = now;
    let dt = now - lastTime; lastTime = now;
    if (dt > 100) dt = 100;
    accum += dt;
    while (accum >= STEP) { tick(); accum -= STEP; }
    render();
  }

  function tick() {
    if (!state.world) return;
    if (state.gameOver) return;
    if (!state.paused && state.transition?.type !== 'fade-out' && !state.levelComplete) {
      const input = readInput();
      updatePlayer(input);
      updateEntities();
      updateParticles();
      updateCamera();
      if (state.levelStarted && !state.levelComplete) {
        state.timeLeft -= 1 / 60;
        state.elapsedSeconds += 1 / 60;
        if (state.timeLeft <= 0) { state.timeLeft = 0; killPlayer(); }
      }
      state.prevJump  = input.jump;
      state.prevDown  = input.down;
      state.prevPause = input.pause;
      state.prevFire  = input.fire;
    } else if (state.paused) {
      const input = readInput();
      if (input.pause && !state.prevPause) { state.paused = false; SFX.pause(); }
      state.prevPause = input.pause;
    } else if (state.transition?.type === 'fade-out' || state.levelComplete) {
      /* lascia avanzare solo le particelle e i floats */
      updateParticles();
      updateCamera();
      state.elapsedSeconds += 1 / 60;
    }

    /* Avanza transizione */
    if (state.transition) {
      state.transition.t++;
      if (state.transition.t >= state.transition.dur) {
        const cb2 = state.transition.then;
        state.transition = null;
        cb2 && cb2();
      }
    }
  }

  function render() {
    if (!state.world) return;
    renderBackground();
    renderTiles();
    renderEntities();
    renderFireballs();
    renderParticles();
    renderPlayer();
    renderHUD();
    renderTransition();
    renderPause();
    renderGameOver();
  }

  /* ─── Avvio ─── */
  loadLevel(state.worldId, state.levelIdx, null);
  resumeAudio();
  rafId = requestAnimationFrame(step);

  return {
    cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      stopMusic();
      if (!state.gameOver && state.player) {
        state.persistent.sessionScore = state.score;
        state.persistent.sessionCoins = state.coins;
        state.persistent.lives = state.lives;
        state.persistent.currentWorld = state.worldId;
        state.persistent.currentLevel = state.levelIdx;
        try { saveSave(state.persistent); } catch { /* ignore */ }
      }
    },
    getState() { return state.persistent; },
  };
}
