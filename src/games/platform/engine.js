/**
 * Andryx Jump — engine completo.
 *
 * Singolo canvas 480x480: viewport di gioco 480x336 (21 colonne x 21 righe
 * di tile da 16px) + HUD top di 32px + 112px spazio dialoghi/menu (in alto
 * dell'area di gioco vengono disegnati come overlay).
 *
 * Render: tutto in pixel art via Canvas 2D. DPR scaling per testo crisp.
 * Le tile sono renderizzate vettorialmente (no atlas) usando la palette
 * del mondo corrente.
 *
 * Input: keysRef + joystickRef + actionBtnRef + secondaryBtnRef
 *        - sinistra/destra → axes o A/D/Frecce
 *        - jump → Spazio / W / Z / Su / actionBtn
 *        - run → Shift / secondaryBtn
 *        - down (fall-through) → S / Giu`
 *        - pause → Esc / P
 */

import { TILE_SIZE, TILES, isSolid, isOneWay, isLava, isWater, getSpawnType, isPickup, getTile } from './tiles.js';
import { PHYS, aabbOverlap, clamp } from './physics.js';
import { getAndryxSprite, getSloimoSprite, getBatSprite, getSpikeSprite, getCrystalSprite, getStarSprite, getFeatherSprite, getCoinSprite, getCheckpointSprite } from './sprites.js';
import { SFX, playMusic, stopMusic, resumeAudio } from './audio.js';
import { getLevel, nextLevel } from './world.js';
import { saveSave, loadSave, clearSave, newSave } from './save.js';
import { t } from './i18n.js';

const VIEW_W = 480;
const VIEW_H = 480;
const HUD_H = 36;
const PLAY_H = VIEW_H - HUD_H; // 444 → 27.75 tile (visualizziamo ~27 tile)

const PLAYER_W = 12;
const PLAYER_H_SMALL = 22;
const PLAYER_H_BIG = 30;

/**
 * Avvia il gioco. Restituisce funzione di cleanup.
 *
 * @param {HTMLCanvasElement} canvas — canvas 480x480
 * @param {object} cb — callbacks: keysRef, joystickRef, actionBtnRef, secondaryBtnRef,
 *                       inventoryBtnRef, potionBtnRef, onScore, onHpChange, onGameOver, onInfo
 * @param {object} opts — { continueSave, fresh }
 */
export function startEngine(canvas, cb, opts = {}) {
  /* ─── Setup canvas con DPR scaling per testo crisp ─── */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEW_W * dpr;
  canvas.height = VIEW_H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(dpr, dpr);

  /* ─── Stato persistente ─── */
  const persistent = (opts.continueSave ? loadSave() : null) || newSave();
  if (opts.fresh) clearSave();

  /* ─── Stato di sessione ─── */
  const state = {
    /* progresso globale */
    persistent,                     // riferimento al save
    /* corrente */
    worldId: persistent.currentWorld || 1,
    levelIdx: persistent.currentLevel || 1,
    grid: null,
    world: null,
    level: null,
    /* giocatore */
    player: null,
    /* entità: nemici, pickup, particelle, decorazioni, scintille */
    entities: [],
    particles: [],
    floats: [],                     // testi che salgono (+100, +1up, ecc)
    /* camera */
    camX: 0,
    /* HUD */
    coins: persistent.sessionCoins || 0,
    score: persistent.sessionScore || 0,
    lives: persistent.lives ?? 3,
    timeLeft: 0,
    timeMax: 0,
    /* checkpoint corrente */
    checkpoint: null,               // { col, row } in tile coords
    /* meta-game */
    paused: false,
    transition: null,               // { type, t, dur }
    levelStarted: false,
    levelComplete: false,
    gameOver: false,
    /* timing */
    elapsedSeconds: 0,
    accumDelta: 0,
    /* input edge detection */
    prevJump: false,
    prevDown: false,
    prevPause: false,
    /* effetti player */
    iframes: 0,
    invincibleFrames: 0,            // stella
    doubleJumpFrames: 0,            // piuma
  };

  /* ─── Helpers ─── */

  function loadLevel(worldId, levelIdx, fromCheckpoint = null) {
    const { world, level } = getLevel(worldId, levelIdx);
    state.worldId = worldId;
    state.levelIdx = levelIdx;
    state.world = world;
    state.level = level;
    state.grid = level.map.map(r => r.split(''));
    state.entities = [];
    state.particles = [];
    state.floats = [];
    state.camX = 0;
    state.timeMax = level.parTime;
    state.timeLeft = level.parTime;
    state.elapsedSeconds = 0;
    state.levelStarted = true;
    state.levelComplete = false;
    state.gameOver = false;
    state.transition = { type: 'fade-in', t: 0, dur: 30 };

    /* Trova spawn player + spawn entità */
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
            /* per nemici, cancella il tile spawn (resta vuoto) */
            row[c] = TILES.EMPTY;
          }
        }
      }
    }
    if (!spawn) spawn = { col: 2, row: state.grid.length - 4 };

    /* Se abbiamo un checkpoint per questo livello, usa quello */
    const sp = fromCheckpoint || spawn;

    state.player = {
      x: sp.col * TILE_SIZE + (TILE_SIZE - PLAYER_W) / 2,
      y: sp.row * TILE_SIZE + (TILE_SIZE - PLAYER_H_SMALL),
      vx: 0, vy: 0,
      w: PLAYER_W, h: PLAYER_H_SMALL,
      dir: 1,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      ranOff: 0,
      big: persistent.bigCarryOver === worldId + ':' + levelIdx, // mantiene big tra retry stesso livello
      animFrame: 0,
      animTimer: 0,
      state: 'idle',
      inWater: false,
      onIce: false,
      fellOff: false,
    };
    state.checkpoint = fromCheckpoint;
    state.iframes = 0;
    state.invincibleFrames = 0;
    state.doubleJumpFrames = 0;

    /* notifica score e hp */
    cb.onScore?.(state.score);
    cb.onHpChange?.(state.player.big ? 2 : 1, 2);

    /* musica */
    try { playMusic(world.musicWorld); } catch { /* ignore */ }
  }

  function spawnEntity(type, col, row) {
    const baseX = col * TILE_SIZE;
    const baseY = row * TILE_SIZE;
    if (type === 'slime') {
      state.entities.push({
        type: 'slime', x: baseX, y: baseY, w: 14, h: 14,
        vx: -0.6, vy: 0, dir: -1, alive: true, animFrame: 0, animTimer: 0,
      });
    } else if (type === 'bat') {
      state.entities.push({
        type: 'bat', x: baseX, y: baseY, w: 14, h: 12,
        vx: 0, vy: 0, dir: -1, alive: true,
        baseY, phase: Math.random() * Math.PI * 2,
        animFrame: 0, animTimer: 0,
      });
    } else if (type === 'spike') {
      state.entities.push({
        type: 'spike', x: baseX, y: baseY, w: 16, h: 16, alive: true,
      });
    } else if (type === 'pow_crystal' || type === 'pow_star' || type === 'pow_feather') {
      state.entities.push({
        type, x: baseX, y: baseY, w: 14, h: 14, alive: true, vy: 0, grounded: false,
      });
    }
  }

  /* ─── Input ─── */

  function readInput() {
    const k = cb.keysRef?.current || {};
    const j = cb.joystickRef?.current || { dx: 0, dy: 0 };
    const left = k['ArrowLeft'] || k['a'] || k['A'] || j.dx < -0.3;
    const right = k['ArrowRight'] || k['d'] || k['D'] || j.dx > 0.3;
    const down = k['ArrowDown'] || k['s'] || k['S'] || j.dy > 0.5;
    const jump = k[' '] || k['Spacebar'] || k['w'] || k['W'] || k['z'] || k['Z'] || k['ArrowUp'] || cb.actionBtnRef?.current;
    const run = k['Shift'] || k['Control'] || cb.secondaryBtnRef?.current;
    const pause = k['Escape'] || k['p'] || k['P'];
    /* edge: action button è "one-shot" — lo resetta GamePage al frame successivo no, lo facciamo qui */
    if (cb.actionBtnRef && cb.actionBtnRef.current) {
      /* Lo lasciamo true durante il frame; poi GamePage lo resetta? No, è un "click"; lo gestiamo come "tenuto" sostenuto via touch event start/end */
    }
    return { left, right, down, jump, run, pause };
  }

  /* ─── Movimento orizzontale + collisioni X ─── */

  function moveX(p, dx) {
    p.x += dx;
    /* AABB vs tile solidi */
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
        return;
      }
    }
  }

  function moveY(p, dy) {
    p.y += dy;
    if (dy === 0) return;
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
          p.grounded = true;
          p.onIce = (ch === TILES.ICE);
          /* hit question block dal sotto (opposite case): no, qui siamo cadendo */
        } else {
          p.y = (r + 1) * TILE_SIZE + 0.01;
          /* hit dal sotto: question block → spawn power-up; brick → break se big */
          if (ch === TILES.QUESTION) {
            state.grid[r][c] = TILES.USED;
            spawnPowerupFromBlock(c, r);
            SFX.coin();
          } else if (ch === TILES.BRICK && p.big) {
            state.grid[r][c] = TILES.EMPTY;
            spawnBrickShards(c, r);
            state.score += 50;
            cb.onScore?.(state.score);
          } else if (ch === TILES.BRICK) {
            /* small player: rimbalzo + suono */
            SFX.stomp();
          }
        }
        p.vy = 0;
        return;
      } else if (isOneWay(ch) && dir > 0) {
        /* Atterro su one-way solo se i miei piedi erano sopra il top del tile prima di muovermi */
        const tileTop = r * TILE_SIZE;
        const wasAbove = (p.y + p.h - dy) <= tileTop + 0.5;
        if (wasAbove && !p.fallThrough) {
          p.y = tileTop - p.h - 0.01;
          p.vy = 0;
          p.grounded = true;
          p.onIce = false;
          return;
        }
      }
    }
  }

  function spawnPowerupFromBlock(c, r) {
    /* 70% coin, 20% crystal, 8% feather, 2% star */
    const roll = Math.random();
    let kind;
    if (roll < 0.70) kind = 'coin_pop';
    else if (roll < 0.90) kind = 'pow_crystal';
    else if (roll < 0.98) kind = 'pow_feather';
    else kind = 'pow_star';

    if (kind === 'coin_pop') {
      /* moneta che spawna sopra il blocco e sale brevemente */
      state.particles.push({
        type: 'coin_pop',
        x: c * TILE_SIZE + 4, y: r * TILE_SIZE - 8,
        vy: -3, life: 30,
      });
      state.coins += 1;
      state.score += 100;
      cb.onScore?.(state.score);
      SFX.coin();
      maybeOneUp();
    } else {
      /* power-up che spunta sopra il blocco */
      state.entities.push({
        type: kind, x: c * TILE_SIZE + 1, y: r * TILE_SIZE - 16,
        w: 14, h: 14, alive: true, vy: -2, grounded: false,
        sprouting: 14,
      });
      SFX.powerup();
    }
  }

  function spawnBrickShards(c, r) {
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        type: 'shard',
        x: c * TILE_SIZE + 8, y: r * TILE_SIZE + 8,
        vx: (i % 2 === 0 ? -1 : 1) * (1 + Math.random() * 2),
        vy: -3 - Math.random() * 2,
        life: 40,
        color: state.world?.palette?.brick || '#d6873e',
      });
    }
  }

  function maybeOneUp() {
    if (state.coins > 0 && state.coins % 100 === 0) {
      state.lives += 1;
      state.persistent.lives = state.lives;
      state.floats.push({ text: '1UP', x: state.player.x - state.camX, y: state.player.y, vy: -1, life: 50, color: '#40ff40' });
      SFX.oneup();
    }
  }

  /* ─── Update player ─── */

  function updatePlayer(input) {
    const p = state.player;
    if (!p || state.paused || state.transition?.type === 'fade-out') return;

    /* Reset onIce / inWater (verranno re-impostati durante movimento) */
    p.onIce = false;

    /* Acqua: il player è in acqua se il punto centrale è in un tile water */
    const cMid = Math.floor((p.x + p.w / 2) / TILE_SIZE);
    const rMid = Math.floor((p.y + p.h / 2) / TILE_SIZE);
    p.inWater = isWater(getTile(state.grid, cMid, rMid));

    /* Input → accelerazione orizzontale */
    const wantRun = input.run;
    const maxSpeed = wantRun ? PHYS.RUN_SPEED : PHYS.WALK_SPEED;
    const accel = p.grounded ? PHYS.ACCEL_GROUND : PHYS.ACCEL_AIR;
    if (input.left) {
      p.vx -= accel;
      p.dir = -1;
    } else if (input.right) {
      p.vx += accel;
      p.dir = 1;
    } else if (p.grounded) {
      const f = p.onIce ? PHYS.FRICTION_ICE : PHYS.FRICTION_GROUND;
      p.vx *= f;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    } else {
      p.vx *= PHYS.FRICTION_AIR;
    }
    p.vx = clamp(p.vx, -maxSpeed, maxSpeed);

    /* Jump buffer */
    if (input.jump && !state.prevJump) {
      p.jumpBuffer = PHYS.JUMP_BUFFER_FRAMES;
    }
    if (p.jumpBuffer > 0) p.jumpBuffer--;

    /* Variable jump cut */
    if (!input.jump && p.vy < 0 && p.jumpHeld) {
      p.vy *= PHYS.JUMP_VAR_CUT;
      p.jumpHeld = false;
    }

    /* Coyote time */
    if (p.grounded) p.coyote = PHYS.COYOTE_FRAMES;
    else if (p.coyote > 0) p.coyote--;

    /* Jump effettivo */
    const canJump = p.grounded || p.coyote > 0;
    const canDoubleJump = state.doubleJumpFrames > 0 && !p.grounded && !p.usedDouble;
    if (p.jumpBuffer > 0 && (canJump || canDoubleJump)) {
      if (canJump) {
        p.vy = PHYS.JUMP_VEL;
        if (Math.abs(p.vx) > PHYS.WALK_SPEED + 0.5) p.vy += PHYS.JUMP_RUN_BOOST;
        if (p.inWater) p.vy = -3.5;
        SFX.jump();
        p.jumpHeld = true;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.usedDouble = false;
      } else if (canDoubleJump) {
        p.vy = PHYS.DOUBLE_JUMP_VEL;
        SFX.doubleJump();
        p.usedDouble = true;
        p.jumpBuffer = 0;
        /* particelle */
        for (let i = 0; i < 6; i++) {
          state.particles.push({
            type: 'feather',
            x: p.x + p.w / 2, y: p.y + p.h,
            vx: (Math.random() - 0.5) * 2.5, vy: 1 + Math.random(),
            life: 24, color: '#ffffff',
          });
        }
      }
    }

    /* Down + jump → fall through one-way */
    if (input.down && input.jump && !state.prevJump && p.grounded) {
      p.fallThrough = PHYS.FALL_THROUGH_FRAMES;
      p.y += 2;
    }
    if (p.fallThrough && p.fallThrough > 0) p.fallThrough--;

    /* Gravità */
    p.vy += p.inWater ? PHYS.GRAVITY_WATER : PHYS.GRAVITY;
    const maxFall = p.inWater ? PHYS.MAX_FALL_WATER : PHYS.MAX_FALL;
    if (p.vy > maxFall) p.vy = maxFall;

    /* Reset grounded prima del move (verrà ri-set in moveY se atterriamo) */
    p.grounded = false;

    moveX(p, p.vx);
    moveY(p, p.vy);
    if (p.grounded) p.usedDouble = false;

    /* Death se cade fuori dalla mappa */
    if (p.y > state.grid.length * TILE_SIZE + 32) {
      killPlayer();
      return;
    }

    /* Lava check (centro) */
    if (isLava(getTile(state.grid, cMid, rMid + 1)) || isLava(getTile(state.grid, cMid, rMid))) {
      killPlayer();
      return;
    }

    /* Pickup tile (coin/power) */
    const tilesPlayerOverlaps = [
      [Math.floor(p.x / TILE_SIZE), Math.floor(p.y / TILE_SIZE)],
      [Math.floor((p.x + p.w) / TILE_SIZE), Math.floor(p.y / TILE_SIZE)],
      [Math.floor(p.x / TILE_SIZE), Math.floor((p.y + p.h) / TILE_SIZE)],
      [Math.floor((p.x + p.w) / TILE_SIZE), Math.floor((p.y + p.h) / TILE_SIZE)],
    ];
    const seen = new Set();
    for (const [c, r] of tilesPlayerOverlaps) {
      const key = c + ',' + r;
      if (seen.has(key)) continue;
      seen.add(key);
      const ch = getTile(state.grid, c, r);
      if (isPickup(ch)) {
        if (ch === TILES.COIN) {
          state.grid[r][c] = TILES.EMPTY;
          state.coins += 1;
          state.score += 100;
          cb.onScore?.(state.score);
          SFX.coin();
          maybeOneUp();
        } else {
          state.grid[r][c] = TILES.EMPTY;
          applyPowerUp(ch);
        }
      } else if (ch === TILES.GOAL) {
        completeLevel();
        return;
      } else if (ch === TILES.CHECKPOINT) {
        if (!state.checkpoint || state.checkpoint.col !== c || state.checkpoint.row !== r) {
          state.checkpoint = { col: c, row: r };
          state.floats.push({ text: t('checkpointReached'), x: p.x - state.camX, y: p.y - 8, vy: -0.6, life: 70, color: '#22c0ff' });
          SFX.checkpoint();
        }
      }
    }

    /* Iframes */
    if (state.iframes > 0) state.iframes--;
    if (state.invincibleFrames > 0) state.invincibleFrames--;
    if (state.doubleJumpFrames > 0) state.doubleJumpFrames--;

    /* Anim */
    if (!p.grounded) p.state = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 0.4) {
      p.animTimer++;
      if (p.animTimer >= 6) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 2; }
      p.state = p.animFrame === 0 ? 'walk1' : 'walk2';
    } else { p.state = 'idle'; p.animFrame = 0; }
  }

  function applyPowerUp(ch) {
    if (ch === TILES.POW_CRYSTAL) {
      growBig();
      state.score += 1000;
      cb.onScore?.(state.score);
      state.floats.push({ text: t('crystalGet'), x: state.player.x - state.camX - 30, y: state.player.y, vy: -0.6, life: 100, color: '#22e0ff' });
    } else if (ch === TILES.POW_STAR) {
      state.invincibleFrames = 60 * 8;
      state.score += 1000;
      cb.onScore?.(state.score);
      state.floats.push({ text: t('starGet'), x: state.player.x - state.camX - 40, y: state.player.y, vy: -0.6, life: 100, color: '#ffd040' });
    } else if (ch === TILES.POW_FEATHER) {
      state.doubleJumpFrames = 60 * 12;
      state.score += 1000;
      cb.onScore?.(state.score);
      state.floats.push({ text: t('featherGet'), x: state.player.x - state.camX - 40, y: state.player.y, vy: -0.6, life: 100, color: '#ffffff' });
    }
    SFX.powerup();
    cb.onHpChange?.(state.player.big ? 2 : 1, 2);
  }

  function growBig() {
    const p = state.player;
    if (!p.big) {
      p.big = true;
      const oldH = p.h;
      p.h = PLAYER_H_BIG;
      p.y -= (p.h - oldH);
    }
  }

  function shrinkSmall() {
    const p = state.player;
    if (p.big) {
      p.big = false;
      const oldH = p.h;
      p.h = PLAYER_H_SMALL;
      p.y += (oldH - p.h);
    }
  }

  function damagePlayer() {
    const p = state.player;
    if (state.iframes > 0 || state.invincibleFrames > 0) return;
    if (p.big) {
      shrinkSmall();
      state.iframes = PHYS.IFRAME_FRAMES;
      cb.onHpChange?.(1, 2);
      SFX.hit();
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
      if (state.lives <= 0) {
        triggerGameOver();
      } else {
        /* respawn dal checkpoint o dall'inizio livello */
        loadLevel(state.worldId, state.levelIdx, state.checkpoint);
      }
    } };
  }

  function triggerGameOver() {
    state.gameOver = true;
    stopMusic();
    cb.onGameOver?.(state.score);
    /* clear sessione su game-over (next start = nuova sessione) */
    state.persistent.sessionScore = 0;
    state.persistent.sessionCoins = 0;
    state.persistent.lives = 3;
    state.persistent.currentWorld = 1;
    state.persistent.currentLevel = 1;
    saveSave(state.persistent);
  }

  function completeLevel() {
    if (state.levelComplete) return;
    state.levelComplete = true;
    SFX.levelClear();
    /* bonus tempo */
    const timeBonus = Math.max(0, Math.floor(state.timeLeft) * 50);
    state.score += timeBonus;
    cb.onScore?.(state.score);
    /* aggiorna best per livello */
    const lk = `${state.worldId}-${state.levelIdx}`;
    state.persistent.completedLevels = state.persistent.completedLevels || {};
    state.persistent.completedLevels[lk] = true;
    state.persistent.bestTimes = state.persistent.bestTimes || {};
    state.persistent.bestScores = state.persistent.bestScores || {};
    const elapsed = state.elapsedSeconds;
    if (!state.persistent.bestTimes[lk] || elapsed < state.persistent.bestTimes[lk]) state.persistent.bestTimes[lk] = elapsed;
    if (!state.persistent.bestScores[lk] || state.score > state.persistent.bestScores[lk]) state.persistent.bestScores[lk] = state.score;
    state.persistent.totalCoins = (state.persistent.totalCoins || 0) + state.coins;
    state.persistent.totalScore = state.score;
    state.persistent.lives = state.lives;
    /* sblocca prossimo mondo se completi ultimo livello del mondo */
    const nl = nextLevel(state.worldId, state.levelIdx);
    if (nl && nl.world > state.worldId && nl.world > (state.persistent.worldsUnlocked || 1)) {
      state.persistent.worldsUnlocked = nl.world;
    }
    state.persistent.currentWorld = nl?.world || state.worldId;
    state.persistent.currentLevel = nl?.level || state.levelIdx;
    state.persistent.sessionScore = state.score;
    state.persistent.sessionCoins = state.coins;
    saveSave(state.persistent);
    state.transition = { type: 'level-complete', t: 0, dur: 180, then: () => {
      if (nl) {
        loadLevel(nl.world, nl.level, null);
      } else {
        /* finito tutto! credit & game over con score finale */
        state.transition = { type: 'credits', t: 0, dur: 240, then: () => triggerGameOver() };
      }
    } };
  }

  /* ─── Update entità ─── */

  function updateEntities() {
    const p = state.player;
    for (const e of state.entities) {
      if (!e.alive) continue;
      if (e.type === 'slime') {
        e.animTimer++;
        if (e.animTimer >= 18) { e.animTimer = 0; e.animFrame ^= 1; }
        /* gravità */
        e.vy = (e.vy || 0) + PHYS.GRAVITY * 0.6;
        if (e.vy > 6) e.vy = 6;
        /* X */
        e.x += e.vx;
        const probeX = e.vx > 0 ? e.x + e.w : e.x;
        const c = Math.floor(probeX / TILE_SIZE);
        const rT = Math.floor(e.y / TILE_SIZE);
        const rB = Math.floor((e.y + e.h - 0.01) / TILE_SIZE);
        let blocked = false;
        for (let r = rT; r <= rB; r++) if (isSolid(getTile(state.grid, c, r))) { blocked = true; break; }
        if (blocked) { e.vx = -e.vx; e.dir = -e.dir; e.x += e.vx * 2; }
        /* Y */
        e.y += e.vy;
        const probeY = e.vy > 0 ? e.y + e.h : e.y;
        const r = Math.floor(probeY / TILE_SIZE);
        const cL = Math.floor(e.x / TILE_SIZE);
        const cR = Math.floor((e.x + e.w - 0.01) / TILE_SIZE);
        for (let cc = cL; cc <= cR; cc++) {
          if (isSolid(getTile(state.grid, cc, r))) {
            if (e.vy > 0) e.y = r * TILE_SIZE - e.h - 0.01;
            else e.y = (r + 1) * TILE_SIZE + 0.01;
            e.vy = 0;
            break;
          }
        }
        /* fall off cliff: inverti se davanti a te non c'è terreno e sei "grounded" */
        if (e.vy === 0) {
          const aheadCol = Math.floor((e.x + (e.vx > 0 ? e.w + 1 : -1)) / TILE_SIZE);
          const belowRow = Math.floor((e.y + e.h + 1) / TILE_SIZE);
          if (!isSolid(getTile(state.grid, aheadCol, belowRow))) {
            e.vx = -e.vx; e.dir = -e.dir;
          }
        }
      } else if (e.type === 'bat') {
        e.phase += 0.06;
        e.y = e.baseY + Math.sin(e.phase) * 24;
        /* segui orizzontalmente il player se entro range */
        if (p && Math.abs(p.x - e.x) < VIEW_W * 0.6) {
          const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
          e.x += Math.sign(dx) * 0.7;
          e.dir = dx > 0 ? 1 : -1;
        }
        e.animTimer++;
        if (e.animTimer >= 8) { e.animTimer = 0; e.animFrame ^= 1; }
      } else if (e.type === 'spike') {
        /* statico */
      } else if (e.type === 'pow_crystal' || e.type === 'pow_star' || e.type === 'pow_feather') {
        if (e.sprouting > 0) { e.sprouting--; e.y += 16 / 14; if (e.sprouting === 0) e.y = Math.round(e.y / TILE_SIZE) * TILE_SIZE; }
        else {
          /* gravità leggera + bounce sulle piattaforme */
          e.vy = (e.vy || 0) + PHYS.GRAVITY * 0.6;
          if (e.vy > 5) e.vy = 5;
          e.y += e.vy;
          const probeY = e.y + e.h;
          const r = Math.floor(probeY / TILE_SIZE);
          const cL = Math.floor(e.x / TILE_SIZE);
          const cR = Math.floor((e.x + e.w - 0.01) / TILE_SIZE);
          for (let cc = cL; cc <= cR; cc++) {
            if (isSolid(getTile(state.grid, cc, r))) {
              e.y = r * TILE_SIZE - e.h - 0.01; e.vy = 0; e.grounded = true; break;
            }
          }
          /* drift orizzontale per crystal/feather una volta a terra */
          if (e.grounded && e.type === 'pow_crystal') {
            e.vx = e.vx || 0.8;
            e.x += e.vx;
            const c2 = Math.floor((e.vx > 0 ? e.x + e.w : e.x) / TILE_SIZE);
            const rT2 = Math.floor(e.y / TILE_SIZE);
            const rB2 = Math.floor((e.y + e.h - 0.01) / TILE_SIZE);
            for (let r2 = rT2; r2 <= rB2; r2++) if (isSolid(getTile(state.grid, c2, r2))) { e.vx = -e.vx; break; }
          }
        }
      }
    }

    /* Collisione player-entità */
    if (!p) return;
    const pBox = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const e of state.entities) {
      if (!e.alive) continue;
      const eBox = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (!aabbOverlap(pBox, eBox)) continue;
      if (e.type === 'pow_crystal' || e.type === 'pow_star' || e.type === 'pow_feather') {
        e.alive = false;
        applyPowerUp(e.type === 'pow_crystal' ? TILES.POW_CRYSTAL : e.type === 'pow_star' ? TILES.POW_STAR : TILES.POW_FEATHER);
        continue;
      }
      /* nemico */
      if (state.invincibleFrames > 0) {
        e.alive = false;
        state.score += 200;
        cb.onScore?.(state.score);
        SFX.stomp();
        continue;
      }
      /* stomp test: se sto cadendo e i miei piedi sono sopra il top del nemico */
      const feet = p.y + p.h;
      const enemyTop = e.y;
      if (e.type !== 'spike' && p.vy > 0 && feet - p.vy <= enemyTop + 4) {
        e.alive = false;
        state.score += 200;
        cb.onScore?.(state.score);
        const k = cb.keysRef?.current || {};
        const holdJump = k[' '] || k['Spacebar'] || k['w'] || k['W'] || k['z'] || k['Z'] || k['ArrowUp'];
        p.vy = holdJump ? PHYS.STOMP_BOUNCE_HOLD : PHYS.STOMP_BOUNCE;
        SFX.stomp();
      } else {
        damagePlayer();
      }
    }

    /* Cleanup */
    state.entities = state.entities.filter(e => e.alive);
  }

  /* ─── Update particelle/floats ─── */
  function updateParticles() {
    for (const p of state.particles) {
      if (p.type === 'coin_pop') {
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
      } else if (p.type === 'shard') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.life--;
      } else if (p.type === 'feather') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.92;
        p.life--;
      }
    }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const f of state.floats) { f.y += f.vy; f.life--; }
    state.floats = state.floats.filter(f => f.life > 0);
  }

  /* ─── Update camera ─── */
  function updateCamera() {
    const p = state.player; if (!p) return;
    const targetX = p.x + p.w / 2 - VIEW_W / 2;
    /* dead-zone: cam segue solo se player oltre 80px dal centro orizzontale */
    const dz = 80;
    const desiredCam = targetX;
    const dx = desiredCam - state.camX;
    if (Math.abs(dx) > dz) state.camX += (dx - Math.sign(dx) * dz) * 0.18;
    /* smooth follow always */
    state.camX += dx * 0.05;
    /* clamp */
    const maxCam = state.grid[0].length * TILE_SIZE - VIEW_W;
    state.camX = clamp(state.camX, 0, Math.max(0, maxCam));
  }

  /* ─── Render ─── */

  function renderBackground() {
    const pal = state.world.palette;
    /* gradiente cielo */
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.skyTop);
    grad.addColorStop(1, pal.sky);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* Sole/Luna */
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(VIEW_W - 60, 60, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Parallax 1: nuvole/montagne lontane */
    const px1 = state.camX * 0.25;
    ctx.fillStyle = pal.cloud;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 200) - px1) % (VIEW_W + 200);
      const xx = x < 0 ? x + VIEW_W + 200 : x;
      const y = 80 + (i % 3) * 30;
      ctx.beginPath();
      ctx.arc(xx, y, 22, 0, Math.PI * 2);
      ctx.arc(xx + 18, y - 8, 18, 0, Math.PI * 2);
      ctx.arc(xx + 36, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Parallax 2: alberi/colline più vicine */
    const px2 = state.camX * 0.55;
    ctx.fillStyle = pal.foliage;
    for (let i = 0; i < 12; i++) {
      const x = ((i * 110) - px2) % (VIEW_W + 220);
      const xx = x < 0 ? x + VIEW_W + 220 : x;
      const y = VIEW_H - 100;
      ctx.beginPath();
      ctx.arc(xx + 30, y, 36, 0, Math.PI * 2);
      ctx.arc(xx + 60, y + 10, 30, 0, Math.PI * 2);
      ctx.arc(xx, y + 12, 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTile(ch, x, y) {
    const pal = state.world.palette;
    if (ch === TILES.GROUND) {
      ctx.fillStyle = pal.earth;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, TILE_SIZE, 2);
      ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
      ctx.globalAlpha = 1;
    } else if (ch === TILES.GRASS) {
      ctx.fillStyle = pal.earth;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = pal.ground;
      ctx.fillRect(x, y, TILE_SIZE, 6);
      ctx.fillStyle = pal.grassTop;
      ctx.fillRect(x, y, TILE_SIZE, 3);
      /* ciuffi d'erba */
      ctx.fillRect(x + 2, y - 2, 2, 2);
      ctx.fillRect(x + 7, y - 3, 2, 3);
      ctx.fillRect(x + 12, y - 2, 2, 2);
    } else if (ch === TILES.EARTH) {
      ctx.fillStyle = pal.earth;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      /* punte sassi */
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x + 3, y + 5, 3, 2);
      ctx.fillRect(x + 10, y + 9, 3, 2);
      ctx.globalAlpha = 1;
    } else if (ch === TILES.BRICK) {
      ctx.fillStyle = pal.brick;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = pal.brickShadow;
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + 7, TILE_SIZE, 1);
      ctx.fillRect(x, y + 15, TILE_SIZE, 1);
      ctx.fillRect(x + 4, y, 1, 7);
      ctx.fillRect(x + 12, y, 1, 7);
      ctx.fillRect(x + 0, y + 8, 1, 7);
      ctx.fillRect(x + 8, y + 8, 1, 7);
    } else if (ch === TILES.QUESTION) {
      const pulse = 0.85 + 0.15 * Math.sin(state.elapsedSeconds * 5);
      ctx.fillStyle = `rgba(240,180,40,${pulse})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#a06000';
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + 15, TILE_SIZE, 1);
      ctx.fillRect(x, y, 1, TILE_SIZE);
      ctx.fillRect(x + 15, y, 1, TILE_SIZE);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + 8, y + 9);
    } else if (ch === TILES.USED) {
      ctx.fillStyle = '#7a5020';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + 15, TILE_SIZE, 1);
      ctx.fillRect(x, y, 1, TILE_SIZE);
      ctx.fillRect(x + 15, y, 1, TILE_SIZE);
    } else if (ch === TILES.PLATFORM) {
      ctx.fillStyle = '#a87844';
      ctx.fillRect(x, y, TILE_SIZE, 5);
      ctx.fillStyle = '#7a5020';
      ctx.fillRect(x, y + 5, TILE_SIZE, 1);
    } else if (ch === TILES.LAVA) {
      const t2 = state.elapsedSeconds;
      ctx.fillStyle = '#c01010';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = `rgba(255,${120 + Math.sin(t2 * 4 + x) * 60},20,1)`;
      ctx.fillRect(x, y + 2, TILE_SIZE, TILE_SIZE - 2);
      ctx.fillStyle = '#ffe080';
      ctx.fillRect(x + 1, y + 1, 4, 1);
      ctx.fillRect(x + 9, y + 2, 5, 1);
    } else if (ch === TILES.WATER) {
      const t2 = state.elapsedSeconds;
      ctx.fillStyle = 'rgba(50,120,200,0.65)';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(180,220,255,0.7)';
      const wave = Math.sin(t2 * 3 + x * 0.3) * 1;
      ctx.fillRect(x, y + 1 + wave, TILE_SIZE, 1);
    } else if (ch === TILES.ICE) {
      ctx.fillStyle = '#a8d8ff';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x + 1, y + 1, 3, 1);
      ctx.fillRect(x + 8, y + 4, 4, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5090c0';
      ctx.fillRect(x, y + 15, TILE_SIZE, 1);
    }
  }

  function renderTiles() {
    const startCol = Math.max(0, Math.floor(state.camX / TILE_SIZE) - 1);
    const endCol = Math.min(state.grid[0].length - 1, Math.ceil((state.camX + VIEW_W) / TILE_SIZE) + 1);
    const startRow = 0;
    const endRow = state.grid.length - 1;
    for (let r = startRow; r <= endRow; r++) {
      const row = state.grid[r];
      for (let c = startCol; c <= endCol; c++) {
        const ch = row[c];
        if (!ch || ch === '.') continue;
        const x = c * TILE_SIZE - state.camX;
        const y = r * TILE_SIZE + HUD_H;
        if (ch === TILES.COIN) {
          const sprite = getCoinSprite(state.elapsedSeconds * 60);
          ctx.drawImage(sprite, Math.round(x), Math.round(y));
        } else if (ch === TILES.GOAL) {
          /* asta lunga + bandiera */
          ctx.fillStyle = '#888';
          ctx.fillRect(x + 7, y - TILE_SIZE * 5, 2, TILE_SIZE * 6);
          ctx.fillStyle = '#ffd040';
          ctx.beginPath();
          ctx.moveTo(x + 9, y - TILE_SIZE * 5 + 2);
          ctx.lineTo(x + 9 + 14, y - TILE_SIZE * 5 + 8);
          ctx.lineTo(x + 9, y - TILE_SIZE * 5 + 14);
          ctx.fill();
          ctx.fillStyle = '#a06000';
          ctx.beginPath();
          ctx.arc(x + 8, y - TILE_SIZE * 5, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === TILES.CHECKPOINT) {
          ctx.drawImage(getCheckpointSprite(), Math.round(x), Math.round(y - TILE_SIZE * 0.5));
        } else if (ch === TILES.POW_CRYSTAL) {
          ctx.drawImage(getCrystalSprite(state.elapsedSeconds * 60), Math.round(x), Math.round(y));
        } else if (ch === TILES.POW_STAR) {
          ctx.drawImage(getStarSprite(), Math.round(x), Math.round(y));
        } else if (ch === TILES.POW_FEATHER) {
          ctx.drawImage(getFeatherSprite(), Math.round(x), Math.round(y));
        } else {
          drawTile(ch, Math.round(x), Math.round(y));
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
      if (e.type === 'slime') ctx.drawImage(getSloimoSprite(e.animFrame || 0), x, y);
      else if (e.type === 'bat') ctx.drawImage(getBatSprite(e.animFrame || 0), x, y);
      else if (e.type === 'spike') ctx.drawImage(getSpikeSprite(), x, y);
      else if (e.type === 'pow_crystal') ctx.drawImage(getCrystalSprite(state.elapsedSeconds * 60), x, y);
      else if (e.type === 'pow_star') ctx.drawImage(getStarSprite(), x, y);
      else if (e.type === 'pow_feather') ctx.drawImage(getFeatherSprite(), x, y);
    }
  }

  function renderPlayer() {
    const p = state.player; if (!p) return;
    /* lampeggio iframes */
    if (state.iframes > 0 && Math.floor(state.iframes / 4) % 2 === 0) return;
    const x = Math.round(p.x - state.camX);
    const y = Math.round(p.y + HUD_H);
    /* tinta invincibilità */
    if (state.invincibleFrames > 0) {
      const hue = (state.elapsedSeconds * 600) % 360;
      ctx.save();
      ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
      ctx.shadowBlur = 8;
      ctx.drawImage(getAndryxSprite(p.state, p.dir, p.big), x, y);
      ctx.restore();
    } else {
      ctx.drawImage(getAndryxSprite(p.state, p.dir, p.big), x, y);
    }
    /* indicatore doppio salto rimanente */
    if (state.doubleJumpFrames > 0) {
      const sec = (state.doubleJumpFrames / 60).toFixed(1);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🪶${sec}`, x + p.w / 2, y - 4);
    }
  }

  function renderParticles() {
    for (const p of state.particles) {
      const x = Math.round(p.x - state.camX);
      const y = Math.round(p.y + HUD_H);
      if (p.type === 'coin_pop') {
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(x, y, 6, 8);
        ctx.fillStyle = '#a07020';
        ctx.fillRect(x, y + 6, 6, 2);
      } else if (p.type === 'shard') {
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, 4, 4);
      } else if (p.type === 'feather') {
        ctx.globalAlpha = Math.max(0, p.life / 24);
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const f of state.floats) {
      ctx.fillStyle = f.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y + HUD_H));
    }
  }

  function renderHUD() {
    /* Sfondo HUD */
    ctx.fillStyle = 'rgba(15,20,40,0.85)';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    /* Mondo X-Y */
    ctx.fillText(`${t('world')} ${state.worldId}-${state.levelIdx}`, 10, HUD_H / 2);

    /* Monete */
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.arc(120, HUD_H / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${String(state.coins).padStart(2, '0')}`, 134, HUD_H / 2);

    /* Vite */
    ctx.fillStyle = '#ff5050';
    ctx.fillText('♥', 200, HUD_H / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${state.lives}`, 215, HUD_H / 2);

    /* Score */
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(`${t('score')}: ${state.score}`, VIEW_W - 10, HUD_H / 2);

    /* Tempo */
    ctx.textAlign = 'center';
    const tcol = state.timeLeft < 20 ? '#ff5050' : '#fff';
    ctx.fillStyle = tcol;
    ctx.fillText(`${t('time')} ${Math.max(0, Math.ceil(state.timeLeft))}`, VIEW_W / 2, HUD_H / 2);
  }

  function renderTransition() {
    const tr = state.transition;
    if (!tr) return;
    if (tr.type === 'fade-in') {
      const a = 1 - tr.t / tr.dur;
      if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    } else if (tr.type === 'fade-out') {
      const a = tr.t / tr.dur;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (tr.type === 'level-complete') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#ffd040';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('levelComplete'), VIEW_W / 2, VIEW_H / 2 - 50);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${t('time')}: ${state.elapsedSeconds.toFixed(1)}s`, VIEW_W / 2, VIEW_H / 2 - 14);
      ctx.fillText(`${t('coins')}: ${state.coins}`, VIEW_W / 2, VIEW_H / 2 + 10);
      ctx.fillStyle = '#80ff80';
      ctx.fillText(`${t('score')}: ${state.score}`, VIEW_W / 2, VIEW_H / 2 + 36);
      const lk = `${state.worldId}-${state.levelIdx}`;
      if (state.persistent.bestScores?.[lk] === state.score && state.score > 0) {
        ctx.fillStyle = '#ffd040';
        ctx.fillText(t('newRecord'), VIEW_W / 2, VIEW_H / 2 + 64);
      }
    } else if (tr.type === 'credits') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#ffd040';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏆 ANDRYX JUMP 🏆', VIEW_W / 2, VIEW_H / 2 - 60);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Hai completato tutti i 10 mondi!', VIEW_W / 2, VIEW_H / 2 - 16);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#80ff80';
      ctx.fillText(`Score finale: ${state.score}`, VIEW_W / 2, VIEW_H / 2 + 24);
    }
  }

  function renderPause() {
    if (!state.paused) return;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('pause'), VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#a0c0e0';
    ctx.fillText(`${t('resume')} → ESC / P`, VIEW_W / 2, VIEW_H / 2 + 16);
  }

  function renderGameOver() {
    if (!state.gameOver) return;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ff5050';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('gameOver'), VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${t('score')}: ${state.score}`, VIEW_W / 2, VIEW_H / 2 + 14);
  }

  /* ─── Loop ─── */

  let rafId = null;
  let lastTs = performance.now();

  function step(now) {
    const dt = Math.min(33, now - lastTs); // cap to ~30fps min
    lastTs = now;
    state.accumDelta += dt;
    while (state.accumDelta >= 1000 / 60) {
      tick();
      state.accumDelta -= 1000 / 60;
    }
    render();
    rafId = requestAnimationFrame(step);
  }

  function tick() {
    if (!state.gameOver && !state.paused) {
      const input = readInput();
      /* edge: pausa */
      if (input.pause && !state.prevPause) {
        state.paused = !state.paused;
        SFX.pause();
      }
      state.prevPause = input.pause;
      if (state.paused) return;

      updatePlayer(input);
      updateEntities();
      updateParticles();
      updateCamera();

      /* timer */
      if (state.levelStarted && !state.levelComplete && state.transition?.type !== 'fade-out') {
        state.timeLeft -= 1 / 60;
        state.elapsedSeconds += 1 / 60;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          killPlayer();
        }
      }

      /* clear edge action button (one-shot touch) */
      if (cb.actionBtnRef && cb.actionBtnRef.current) {
        /* Manteniamo true mentre il dito è premuto (gestione GamePage); qui non resettiamo */
      }

      state.prevJump = input.jump;
      state.prevDown = input.down;
    } else if (state.paused) {
      const input = readInput();
      if (input.pause && !state.prevPause) {
        state.paused = false;
        SFX.pause();
      }
      state.prevPause = input.pause;
    }

    /* avanza transizione */
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
      /* Salva stato di sessione (se non game-over) */
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
