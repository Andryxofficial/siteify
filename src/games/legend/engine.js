/**
 * Andryx Legend — Engine principale.
 *
 * Game loop, input, fisica (collisioni AABB), camera, render, AI nemici,
 * combattimento, dialoghi, transizioni di zona, mini-mappa, HUD.
 *
 * Render strategy:
 *   – Mondo logico: tile 16px, zone 30×20 → 480×320 logici.
 *   – Schermo: 240×240 logici (15×15 tile visibili) scalato 2× sul
 *     canvas reale 480×480. drawImage(... w*2, h*2) con
 *     imageSmoothingEnabled=false → pixel art crispa "GBA-like".
 *   – Camera segue il player con clamp ai bordi della zona.
 *
 * Loop: requestAnimationFrame, fixed timestep ~60Hz logico ma render
 * ad ogni RAF (interpolazione visiva non necessaria a queste velocita`).
 */

import { SPRITES, getPlayerSprite, drawSpriteScaled, preloadSprites } from './sprites.js';
import { TILE_SIZE, TILES, getTile, getTileSprite } from './tiles.js';
import { getZone, cloneZoneMap, ZONE_W, ZONE_H } from './world.js';
import { getDialog, selectNpcDialog, calculateFinalScore } from './dialog.js';
import { SFX, playMusic, stopMusic, ensureAudio } from './audio.js';
import { C } from './palette.js';
import { getLegendSign, getLegendZoneName, getLegendEngineText } from './i18n.js';

const SCALE = 2;
const VIEW_TILES = 15;            // 15×15 tile visibili
const VIEW_LOGICAL = VIEW_TILES * TILE_SIZE; // 240
const CANVAS_SIZE = VIEW_LOGICAL * SCALE;    // 480
const PLAYER_SPEED = 1.6;         // pixel logici per frame (60fps)
const ENEMY_BASE_SPEED = 0.6;
const ATTACK_FRAMES = 14;         // durata animazione attacco
const ATTACK_RANGE = 14;          // raggio hit della spada (oltre il player)
const ATTACK_HIT_FRAMES = [4, 10]; // frame in cui la spada infligge danno
const IFRAMES = 60;               // invulnerabilita` post-hit (frame)
const KNOCKBACK = 6;
const TEXT_SPEED = 1.5;           // caratteri per frame nel typewriter

/* ─── Stato della partita (chiusura interna in createGame) ─── */
function makeInitialState(savedData) {
  const base = {
    zoneId: 'village',
    player: {
      /* Spawn villaggio: tile (5, 13) centrato (= pixel 88, 216).
         IMPORTANT: il +8 centra il player NEL tile, allineandosi a `enterZone`. */
      x: 5 * TILE_SIZE + 8, y: 13 * TILE_SIZE + 8,
      dir: 'down', hp: 6, maxHp: 6, frame: 0,
      iframes: 0, vx: 0, vy: 0,
    },
    rupees: 0,
    keys: 0,
    bombs: 0,
    potions: 0,
    flags: {},
    quest: 'start',
    kills: 0,
    defeatedBosses: new Set(),
    clearedZones: new Set(),
    mapMutations: {},        // { zoneId: { 'x,y': 'newChar' } }
    elapsedMs: 0,
    startedAt: Date.now(),
  };
  if (savedData) {
    base.zoneId = savedData.zoneId || base.zoneId;
    base.player.x = savedData.px ?? base.player.x;
    base.player.y = savedData.py ?? base.player.y;
    base.player.hp = savedData.hp ?? base.player.hp;
    base.player.maxHp = savedData.maxHp ?? base.player.maxHp;
    base.rupees = savedData.rupees || 0;
    base.keys = savedData.keys || 0;
    base.bombs = savedData.bombs || 0;
    base.potions = savedData.potions || 0;
    base.flags = savedData.flags || {};
    base.quest = savedData.quest || 'start';
    base.kills = savedData.kills || 0;
    base.defeatedBosses = new Set(savedData.defeatedBosses || []);
    base.clearedZones = new Set(savedData.clearedZones || []);
    base.mapMutations = savedData.mapMutations || {};
    base.elapsedMs = savedData.elapsedMs || 0;
  }
  return base;
}

/* ─── Engine principale ─── */
export function startEngine(canvas, callbacks, options = {}) {
  preloadSprites();

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const state = makeInitialState(options.savedData);
  let mutableMap = cloneZoneMap(state.zoneId);
  applyMutations(state.zoneId);

  /* Entita` runtime: caricate da zona */
  let entities = [];
  let particles = [];
  let dialogState = null;       // { dialogId, lineIdx, charIdx, lines, speaker, portrait, onComplete }
  let attackState = null;       // { frame, dir }
  let camera = { x: 0, y: 0 };
  let tickCount = 0;
  let runningRef = { running: true };
  let pausedRef = { paused: false };
  let gameOverRef = { gameOver: false };
  let winRef = { win: false };
  let lastTimestamp = 0;
  let rafId = 0;

  /* Carica entita` zona */
  function loadZone() {
    const z = getZone(state.zoneId);
    mutableMap = cloneZoneMap(state.zoneId);
    applyMutations(state.zoneId);
    entities = z.entities
      .filter(e => evalRequires(e.requires))
      .map(e => instantiateEntity(e));
    /* Verifica cancellazione: se una zona e` stata pulita, non rispawnare nemici */
    if (state.clearedZones.has(state.zoneId)) {
      entities = entities.filter(e => e.type !== 'enemy');
    }
    particles = [];
    playMusic(z.music);
    dialogState = null;
    callbacks.onInfo?.(`📍 ${getLegendZoneName(z.id) || z.name}`);
  }

  function applyMutations(zoneId) {
    const muts = state.mapMutations[zoneId] || {};
    for (const k of Object.keys(muts)) {
      const [mx, my] = k.split(',').map(Number);
      if (mutableMap[my]?.[mx] !== undefined) mutableMap[my][mx] = muts[k];
    }
  }

  function setMutation(x, y, ch) {
    if (!state.mapMutations[state.zoneId]) state.mapMutations[state.zoneId] = {};
    state.mapMutations[state.zoneId][`${x},${y}`] = ch;
    if (mutableMap[y]) mutableMap[y][x] = ch;
  }

  function evalRequires(req) {
    if (!req) return true;
    /* Sintassi:
       'has_sword:false'           → richiede flag === false
       'has_sword'                 → richiede flag === true
       'forest_clear'              → richiede clearedZones.has('forest')
       'guardian_defeated'         → richiede defeatedBosses.has('guardian')  */
    if (req.includes(':')) {
      const [k, v] = req.split(':');
      const want = v === 'true';
      return !!state.flags[k] === want;
    }
    if (req.endsWith('_clear')) {
      const z = req.replace('_clear', '');
      return state.clearedZones.has(z);
    }
    if (req.endsWith('_defeated')) {
      const b = req.replace('_defeated', '');
      return state.defeatedBosses.has(b);
    }
    if (req === 'cave_torches') {
      /* Richiede tutte e 2 le torce accese — controlliamo nelle mutazioni */
      const muts = state.mapMutations.cave || {};
      let lit = 0;
      for (const v of Object.values(muts)) if (v === 'l') lit++;
      const baseLit = countInMap('l', getZone('cave').map);
      return (lit + baseLit) >= 2;
    }
    if (req === 'cave_door1') {
      return !!state.flags.cave_door1_opened;
    }
    return !!state.flags[req];
  }

  function countInMap(ch, map) {
    let n = 0;
    for (const row of map) for (const c of row) if (c === ch) n++;
    return n;
  }

  function instantiateEntity(def) {
    const e = {
      type: def.type,
      kind: def.kind,
      x: (def.x ?? 0) * TILE_SIZE + TILE_SIZE / 2,
      y: (def.y ?? 0) * TILE_SIZE + TILE_SIZE / 2,
      tx: def.x,
      ty: def.y,
      hp: 0,
      maxHp: 0,
      dir: 'down',
      frame: 0,
      iframes: 0,
      vx: 0,
      vy: 0,
      cooldown: 0,
      def,
    };
    if (def.type === 'enemy') {
      const stats = ENEMY_STATS[def.kind] || ENEMY_STATS.slime;
      e.hp = stats.hp;
      e.maxHp = stats.hp;
      e.speed = stats.speed;
      e.damage = stats.damage;
      e.points = stats.points;
    } else if (def.type === 'boss') {
      const stats = BOSS_STATS[def.kind] || BOSS_STATS.guardian;
      e.hp = stats.hp;
      e.maxHp = stats.hp;
      e.speed = stats.speed;
      e.damage = stats.damage;
      e.points = stats.points;
      e.phase = 0;
    } else if (def.type === 'item') {
      e.bobPhase = Math.random() * Math.PI * 2;
    }
    return e;
  }

  /* ─── Input ─── */

  const keys = callbacks.keysRef;
  const joystick = callbacks.joystickRef;
  const actionBtn = callbacks.actionBtnRef;

  function readMovement() {
    let dx = 0, dy = 0;
    const k = keys.current || {};
    if (k.ArrowUp || k.w || k.W) dy -= 1;
    if (k.ArrowDown || k.s || k.S) dy += 1;
    if (k.ArrowLeft || k.a || k.A) dx -= 1;
    if (k.ArrowRight || k.d || k.D) dx += 1;
    const j = joystick.current;
    if (j && j.active) {
      if (Math.abs(j.dx) > 0.2) dx = j.dx;
      if (Math.abs(j.dy) > 0.2) dy = j.dy;
    }
    if (dx !== 0 && dy !== 0) {
      /* Diagonale: normalizza per non andare piu` veloci */
      const m = Math.sqrt(dx * dx + dy * dy);
      dx /= m; dy /= m;
    }
    return { dx, dy };
  }

  /* Edge-trigger: una pressione = un evento, non frame-by-frame.
     Evita che tenere SPAZIO premuto skippi tutti i dialoghi e che si attacchi
     a raffica tenendo il tasto premuto. */
  let prevActionDown = false;
  let actionEdge = false;
  function refreshActionEdge() {
    const k = keys.current || {};
    const down = !!(k[' '] || k.z || k.Z || k.x || k.X || k.j || k.J);
    actionEdge = (down && !prevActionDown);
    prevActionDown = down;
  }
  function consumeAction() {
    if (actionEdge) { actionEdge = false; return true; }
    if (actionBtn.current) { actionBtn.current = false; return true; }
    return false;
  }

  /* ─── Collisione AABB con tile ─── */
  function tileSolidAt(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= ZONE_W || ty >= ZONE_H) return true;
    const ch = mutableMap[ty]?.[tx];
    return getTile(ch).solid;
  }

  function tileDamageAt(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= ZONE_W || ty >= ZONE_H) return 0;
    const ch = mutableMap[ty]?.[tx];
    return getTile(ch).damage || 0;
  }

  /* Box collision per il player (10×10 al centro 16×16) */
  function tryMovePlayer(dx, dy) {
    const p = state.player;
    const r = 5;            // mezza hitbox
    const newX = p.x + dx;
    if (!tileSolidAt(newX - r, p.y - r) &&
        !tileSolidAt(newX + r, p.y - r) &&
        !tileSolidAt(newX - r, p.y + r) &&
        !tileSolidAt(newX + r, p.y + r)) {
      p.x = newX;
    }
    const newY = p.y + dy;
    if (!tileSolidAt(p.x - r, newY - r) &&
        !tileSolidAt(p.x + r, newY - r) &&
        !tileSolidAt(p.x - r, newY + r) &&
        !tileSolidAt(p.x + r, newY + r)) {
      p.y = newY;
    }
  }

  /* ─── Player update ─── */
  function updatePlayer() {
    const p = state.player;
    if (p.iframes > 0) p.iframes--;
    if (attackState) {
      attackState.frame++;
      if (attackState.frame >= ATTACK_FRAMES) attackState = null;
      else {
        /* Sword hit detection on enemies */
        if (ATTACK_HIT_FRAMES.includes(attackState.frame)) {
          const hit = swordHitbox(p, attackState.dir);
          for (const e of entities) {
            if ((e.type === 'enemy' || e.type === 'boss') && e.hp > 0 && e.iframes === 0) {
              if (rectIntersect(hit, entityHitbox(e))) {
                e.hp--;
                e.iframes = 20;
                /* knockback */
                const dx = e.x - p.x, dy = e.y - p.y;
                const m = Math.sqrt(dx*dx + dy*dy) || 1;
                e.vx = (dx / m) * KNOCKBACK;
                e.vy = (dy / m) * KNOCKBACK;
                if (e.type === 'boss') SFX.bossHit(); else SFX.enemyHit();
                if (e.hp <= 0) onEnemyDeath(e);
              }
            }
          }
          /* Cespugli e vasi */
          tryDestroyTile(hit);
          /* Torce */
          tryLightTorch(p, attackState.dir);
        }
        return;  /* niente movimento mentre attacca */
      }
    }

    const { dx, dy } = readMovement();
    if (dx !== 0 || dy !== 0) {
      tryMovePlayer(dx * PLAYER_SPEED, dy * PLAYER_SPEED);
      /* Direzione visiva */
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
      else p.dir = dy > 0 ? 'down' : 'up';
      p.frame = (p.frame + 0.15) % 2;
    }

    /* Damage da tile (es. lava) */
    const d = tileDamageAt(p.x, p.y);
    if (d > 0 && p.iframes === 0) damagePlayer(d);

    /* Collisione con entita` */
    for (const e of entities) {
      if (e.type === 'enemy' || e.type === 'boss') {
        if (e.hp > 0 && entitiesOverlap(p, e, 12)) {
          if (p.iframes === 0) damagePlayer(e.damage || 1);
        }
      } else if (e.type === 'item' && !e.collected) {
        if (entitiesOverlap(p, e, 14)) onItemPickup(e);
      } else if (e.type === 'sign') {
        if (entitiesOverlap(p, e, 14) && consumeAction()) openSignDialog(e);
      } else if (e.type === 'npc') {
        if (entitiesOverlap(p, e, 18) && consumeAction()) openNpcDialog(e);
      }
    }

    /* Azione: attacco se non in dialogo. Edge-trigger (consume) per evitare
       spam di attacchi tenendo premuto SPAZIO. */
    if (!dialogState && !attackState && consumeAction()) {
      if (state.flags.has_sword) {
        attackState = { frame: 0, dir: p.dir };
        SFX.sword();
      } else {
        /* Senza spada: interazione diretta — rompi vaso/cespuglio adiacente,
           accendi torcia. Nessun danno ai nemici. */
        const hit = swordHitbox(p, p.dir);
        const broke = tryDestroyTile(hit);
        tryLightTorch(p, p.dir);
        if (!broke) SFX.text();
      }
    }

    /* Transizioni zona */
    checkTransitions();
  }

  function damagePlayer(amount) {
    const p = state.player;
    let dmg = amount;
    if (state.flags.has_shield) dmg = Math.max(1, Math.ceil(dmg / 2));
    p.hp -= dmg;
    p.iframes = IFRAMES;
    SFX.hit();
    if (p.hp <= 0) {
      p.hp = 0;
      onGameOver();
    }
    callbacks.onHpChange?.(p.hp, p.maxHp);
  }

  function onGameOver() {
    if (gameOverRef.gameOver) return;
    gameOverRef.gameOver = true;
    SFX.gameover();
    stopMusic();
    state.elapsedMs += Date.now() - state.startedAt;
    const finalScore = calculateFinalScore({ ...state, maxHp: state.player.maxHp });
    setTimeout(() => callbacks.onGameOver?.(finalScore), 800);
  }

  function onWin() {
    if (winRef.win) return;
    winRef.win = true;
    SFX.victory();
    stopMusic();
    state.elapsedMs += Date.now() - state.startedAt;
    const finalScore = calculateFinalScore({ ...state, maxHp: state.player.maxHp });
    setTimeout(() => callbacks.onGameOver?.(finalScore), 1200);
  }

  function swordHitbox(p, dir) {
    if (dir === 'up')    return { x: p.x - 6, y: p.y - 8 - ATTACK_RANGE, w: 12, h: ATTACK_RANGE };
    if (dir === 'down')  return { x: p.x - 6, y: p.y + 8,                w: 12, h: ATTACK_RANGE };
    if (dir === 'left')  return { x: p.x - 8 - ATTACK_RANGE, y: p.y - 6, w: ATTACK_RANGE, h: 12 };
    return                       { x: p.x + 8, y: p.y - 6, w: ATTACK_RANGE, h: 12 };
  }

  function entityHitbox(e) {
    const r = (e.type === 'boss') ? 12 : 7;
    return { x: e.x - r, y: e.y - r, w: r * 2, h: r * 2 };
  }

  function rectIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function entitiesOverlap(a, b, dist) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx*dx + dy*dy < dist*dist;
  }

  function tryDestroyTile(hitbox) {
    let any = false;
    const x0 = Math.floor(hitbox.x / TILE_SIZE);
    const x1 = Math.floor((hitbox.x + hitbox.w) / TILE_SIZE);
    const y0 = Math.floor(hitbox.y / TILE_SIZE);
    const y1 = Math.floor((hitbox.y + hitbox.h) / TILE_SIZE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = mutableMap[y]?.[x];
        const t = getTile(ch);
        if (t.cuttable || t.smashable) {
          setMutation(x, y, '.');
          /* Vaso speciale 'q': droppa la chiave di casa */
          if (ch === 'q' && !state.flags.house_key) {
            spawnItem(x * TILE_SIZE + 8, y * TILE_SIZE + 8, 'house_key');
          } else {
            spawnDrop(x * TILE_SIZE + 8, y * TILE_SIZE + 8);
          }
          SFX.hit();
          any = true;
        }
      }
    }
    return any;
  }

  function spawnItem(x, y, kind) {
    entities.push({
      type: 'item', kind, x, y, tx: 0, ty: 0,
      hp: 0, maxHp: 0, dir: 'down', frame: 0, iframes: 0,
      vx: 0, vy: 0, cooldown: 0, bobPhase: 0,
    });
  }

  function tryLightTorch(p, dir) {
    /* Torcia adiacente nella direzione */
    let tx = Math.floor(p.x / TILE_SIZE);
    let ty = Math.floor(p.y / TILE_SIZE);
    if (dir === 'up') ty--;
    else if (dir === 'down') ty++;
    else if (dir === 'left') tx--;
    else tx++;
    if (mutableMap[ty]?.[tx] === 't') {
      setMutation(tx, ty, 'l');
      SFX.bombSet();
      /* Trigger porte/eventi se applicabili */
      checkPuzzles();
    }
  }

  function checkPuzzles() {
    /* Caverna: 2 torce → apri porta nord per accesso al boss */
    if (state.zoneId === 'cave') {
      const litCount = countInMap('l', mutableMap);
      if (litCount >= 2 && !state.flags.cave_door1_opened) {
        state.flags.cave_door1_opened = true;
        /* Apri la porta D in posizione nota */
        for (let y = 0; y < ZONE_H; y++) {
          for (let x = 0; x < ZONE_W; x++) {
            if (mutableMap[y][x] === 'D') setMutation(x, y, 'd');
          }
        }
        SFX.door();
        showSystemMessage(getLegendEngineText('doors_open'));
        /* Ricarica entita` per spawnare boss/mago */
        const z = getZone(state.zoneId);
        const newEnts = z.entities.filter(e => e.requires === 'cave_door1' || e.requires === 'cave_torches');
        for (const ne of newEnts) {
          if (!entities.find(ex => ex.def === ne)) entities.push(instantiateEntity(ne));
        }
      }
    }
  }

  function showSystemMessage(msg) {
    callbacks.onInfo?.(msg);
  }

  function spawnDrop(x, y) {
    const r = Math.random();
    let kind = null;
    if (r < 0.18) kind = 'heart';
    else if (r < 0.55) kind = 'rupee';
    if (kind) {
      entities.push({
        type: 'item', kind, x, y, tx: 0, ty: 0,
        hp: 0, maxHp: 0, dir: 'down', frame: 0, iframes: 0,
        vx: 0, vy: 0, cooldown: 0, bobPhase: 0,
        despawnAt: tickCount + 60 * 6,
      });
    }
  }

  function onItemPickup(e) {
    e.collected = true;
    if (e.kind === 'heart') {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 2);
      SFX.heart();
      callbacks.onHpChange?.(state.player.hp, state.player.maxHp);
    } else if (e.kind === 'rupee') {
      state.rupees++;
      SFX.rupee();
    } else if (e.kind === 'key') {
      state.keys++;
      SFX.key();
    } else if (e.kind === 'house_key') {
      state.flags.house_key = true;
      SFX.key();
      /* Sblocca la porta di casa di Andryx nel villaggio:
         '0' (TILE_HDOOR chiusa) → 'A' (TILE_HDOOR_OPEN aperta).
         Anche eventuali porte 'D' generiche se presenti. */
      if (state.zoneId === 'village') {
        for (let y = 0; y < ZONE_H; y++) {
          for (let x = 0; x < ZONE_W; x++) {
            const ch = mutableMap[y][x];
            if (ch === '0') setMutation(x, y, 'A');
            else if (ch === 'D') setMutation(x, y, 'd');
          }
        }
        SFX.door();
        /* Forza il rispawn della spada ora che il requires e` soddisfatto */
        const z = getZone(state.zoneId);
        for (const ent of z.entities) {
          if (ent.kind === 'sword' && evalRequires(ent.requires)) {
            if (!entities.find(ex => ex.def === ent)) entities.push(instantiateEntity(ent));
          }
        }
      }
      openDialogById('house_key_pickup');
    } else if (e.kind === 'bomb') {
      state.bombs++;
      SFX.pickup();
    } else if (e.kind === 'potion') {
      state.potions++;
      SFX.pickup();
    } else if (e.kind === 'sword') {
      state.flags.has_sword = true;
      SFX.pickup();
      openDialogById('sword_pickup');
    } else if (e.kind === 'shield') {
      state.flags.has_shield = true;
      SFX.pickup();
      openDialogById('shield_pickup');
    } else if (e.kind === 'heart_container') {
      state.player.maxHp += 2;
      state.player.hp = state.player.maxHp;
      SFX.heart();
      callbacks.onHpChange?.(state.player.hp, state.player.maxHp);
      openDialogById('heart_container_pickup');
    } else if (e.kind === 'crystal_green') {
      state.flags.has_crystal_green = true;
      SFX.victory();
      openDialogById('crystal_green_pickup');
    } else if (e.kind === 'crystal_blue') {
      state.flags.has_crystal_blue = true;
      SFX.victory();
      openDialogById('crystal_blue_pickup');
    } else if (e.kind === 'crystal_red') {
      state.flags.has_crystal_red = true;
      SFX.victory();
      openDialogById('crystal_red_pickup');
    }
    callbacks.onScore?.(calculateFinalScore({ ...state, maxHp: state.player.maxHp }));
  }

  function onEnemyDeath(e) {
    state.kills++;
    SFX.death();
    /* particelle */
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: e.x, y: e.y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 30, maxLife: 30,
        col: '#ffffff',
      });
    }
    /* Drop occasionale */
    if (Math.random() < 0.4) spawnDrop(e.x, e.y);
    if (e.type === 'boss') {
      state.defeatedBosses.add(e.kind);
      if (e.kind === 'guardian') {
        openDialogById('victory_guardian');
        /* Spawna cristallo blu */
        const cz = getZone(state.zoneId);
        for (const ent of cz.entities) {
          if (ent.kind === 'crystal_blue') entities.push(instantiateEntity(ent));
        }
      } else if (e.kind === 'shadow_king') {
        openDialogById('victory_shadow_king');
        const cz = getZone(state.zoneId);
        for (const ent of cz.entities) {
          if (ent.kind === 'crystal_red') entities.push(instantiateEntity(ent));
        }
      }
    }
    /* Verifica clear zona */
    const remaining = entities.filter(en => en.type === 'enemy' && en.hp > 0);
    if (remaining.length === 0 && !state.clearedZones.has(state.zoneId)) {
      state.clearedZones.add(state.zoneId);
      /* Spawna eventuale cristallo green nella foresta */
      if (state.zoneId === 'forest') {
        const cz = getZone('forest');
        for (const ent of cz.entities) {
          if (ent.kind === 'crystal_green') entities.push(instantiateEntity(ent));
        }
      }
    }
    callbacks.onScore?.(calculateFinalScore({ ...state, maxHp: state.player.maxHp }));
  }

  /* ─── AI nemici ─── */
  function updateEnemy(e) {
    if (e.hp <= 0) return;
    if (e.iframes > 0) e.iframes--;

    /* knockback */
    if (Math.abs(e.vx) > 0.05 || Math.abs(e.vy) > 0.05) {
      tryMoveEntity(e, e.vx, e.vy);
      e.vx *= 0.78;
      e.vy *= 0.78;
      return;
    }

    const p = state.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    if (e.type === 'boss' && e.kind === 'shadow_king') {
      bossShadowKing(e, dx, dy, dist);
      return;
    }
    if (e.type === 'boss' && e.kind === 'guardian') {
      bossGuardian(e, dx, dy, dist);
      return;
    }

    if (e.kind === 'slime') {
      /* Slime: salti pigri verso il player */
      e.cooldown--;
      if (e.cooldown <= 0) {
        e.cooldown = 60;
        e.jumpVx = (dx / dist) * 1.5;
        e.jumpVy = (dy / dist) * 1.5;
      }
      if (e.jumpVx !== undefined) {
        tryMoveEntity(e, e.jumpVx, e.jumpVy);
        e.jumpVx *= 0.92;
        e.jumpVy *= 0.92;
      }
      e.frame = (e.frame + 0.06) % 2;
    } else if (e.kind === 'bat') {
      /* Pipistrello: insegue veloce, ali sempre in moto */
      const sp = e.speed || 1.0;
      tryMoveEntity(e, (dx / dist) * sp, (dy / dist) * sp);
      e.frame = (e.frame + 0.25) % 2;
    } else if (e.kind === 'skeleton') {
      /* Scheletro: insegue medio, ferma quando colpito */
      const sp = e.speed || 0.7;
      tryMoveEntity(e, (dx / dist) * sp, (dy / dist) * sp);
      e.frame = (e.frame + 0.12) % 2;
      /* Direzione visiva */
      if (Math.abs(dx) > Math.abs(dy)) e.dir = dx > 0 ? 'right' : 'left';
      else e.dir = dy > 0 ? 'down' : 'up';
    } else if (e.kind === 'mage') {
      /* Mago: si tiene a distanza, lancia magie viola */
      const sp = 0.4;
      const ideal = 80;
      if (dist < ideal - 10) {
        tryMoveEntity(e, -(dx / dist) * sp, -(dy / dist) * sp);
      } else if (dist > ideal + 10) {
        tryMoveEntity(e, (dx / dist) * sp, (dy / dist) * sp);
      }
      e.cooldown--;
      if (e.cooldown <= 0 && dist < 140) {
        e.cooldown = 100;
        spawnProjectile(e.x, e.y, dx / dist, dy / dist, '#b870d0', 1, 200);
      }
    }
  }

  function tryMoveEntity(e, dx, dy) {
    const r = 6;
    const newX = e.x + dx;
    if (!tileSolidAt(newX - r, e.y - r) &&
        !tileSolidAt(newX + r, e.y - r) &&
        !tileSolidAt(newX - r, e.y + r) &&
        !tileSolidAt(newX + r, e.y + r)) {
      e.x = newX;
    }
    const newY = e.y + dy;
    if (!tileSolidAt(e.x - r, newY - r) &&
        !tileSolidAt(e.x + r, newY - r) &&
        !tileSolidAt(e.x - r, newY + r) &&
        !tileSolidAt(e.x + r, newY + r)) {
      e.y = newY;
    }
  }

  function spawnProjectile(x, y, dx, dy, col, dmg, life) {
    entities.push({
      type: 'projectile', kind: 'magic', x, y,
      vx: dx * 1.6, vy: dy * 1.6,
      dmg, col, life, hp: 1,
    });
  }

  function updateProjectile(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0 || tileSolidAt(p.x, p.y)) { p.dead = true; return; }
    /* Hit player */
    if (state.player.iframes === 0) {
      const dx = state.player.x - p.x, dy = state.player.y - p.y;
      if (dx*dx + dy*dy < 100) {
        damagePlayer(p.dmg);
        p.dead = true;
      }
    }
  }

  /* ─── Boss patterns ─── */
  function bossGuardian(e, dx, dy, dist) {
    /* Custode: lento, fa shockwave ogni 3 secondi */
    e.cooldown--;
    const sp = 0.4;
    if (dist > 30) {
      tryMoveEntity(e, (dx / dist) * sp, (dy / dist) * sp);
    }
    if (e.cooldown <= 0) {
      e.cooldown = 180;
      /* 8 proiettili in cerchio */
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawnProjectile(e.x, e.y, Math.cos(a), Math.sin(a), '#888888', 1, 180);
      }
    }
  }

  function bossShadowKing(e, dx, dy, dist) {
    e.cooldown--;
    /* Phase 0 (>50% HP): teleport + 4 magie */
    /* Phase 1 (<50% HP): teleport veloce + 8 magie */
    if (e.hp < e.maxHp / 2) e.phase = 1;
    if (e.cooldown <= 0) {
      e.cooldown = e.phase === 1 ? 120 : 200;
      /* Teletrasporto in una posizione random valida */
      for (let attempt = 0; attempt < 20; attempt++) {
        const tx = 4 + Math.floor(Math.random() * (ZONE_W - 8));
        const ty = 4 + Math.floor(Math.random() * (ZONE_H - 8));
        const ch = mutableMap[ty]?.[tx];
        if (ch === 'F' || ch === '.' || ch === '_') {
          e.x = tx * TILE_SIZE + 8;
          e.y = ty * TILE_SIZE + 8;
          break;
        }
      }
      /* Spara magie */
      const count = e.phase === 1 ? 8 : 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        spawnProjectile(e.x, e.y, Math.cos(a), Math.sin(a), '#b870d0', 2, 220);
      }
      SFX.bossHit();
    }
  }

  /* ─── Transizioni zona ─── */
  function checkTransitions() {
    const z = getZone(state.zoneId);
    const tx = Math.floor(state.player.x / TILE_SIZE);
    const ty = Math.floor(state.player.y / TILE_SIZE);
    for (const t of z.transitions || []) {
      if (t.requires && !evalRequires(t.requires)) continue;
      if (t.trigger === 'edge') {
        if ((t.side === 'east' && tx >= ZONE_W - 1) ||
            (t.side === 'west' && tx <= 0) ||
            (t.side === 'north' && ty <= 0) ||
            (t.side === 'south' && ty >= ZONE_H - 1)) {
          transitionTo(t.toZone, t.spawn);
          return;
        }
      } else if (t.trigger === 'portal') {
        if (Math.abs(tx - t.x) <= 0 && Math.abs(ty - t.y) <= 0) {
          /* Su tile portal: aspetta input azione? Auto. */
          transitionTo(t.toZone, t.spawn);
          return;
        }
      }
    }
  }

  function transitionTo(zoneId, spawn) {
    SFX.portal();
    state.zoneId = zoneId;
    state.player.x = (spawn?.x ?? 4) * TILE_SIZE + 8;
    state.player.y = (spawn?.y ?? 4) * TILE_SIZE + 8;
    loadZone();
    /* Auto-save al cambio zona */
    if (options.onAutoSave) options.onAutoSave(state);
  }

  /* ─── Camera ─── */
  function updateCamera() {
    const targetX = state.player.x - VIEW_LOGICAL / 2;
    const targetY = state.player.y - VIEW_LOGICAL / 2;
    camera.x = Math.max(0, Math.min(ZONE_W * TILE_SIZE - VIEW_LOGICAL, targetX));
    camera.y = Math.max(0, Math.min(ZONE_H * TILE_SIZE - VIEW_LOGICAL, targetY));
  }

  /* ─── Dialoghi ─── */
  function openDialogById(id) {
    const d = getDialog(id, state);
    if (!d) return;
    dialogState = {
      dialogId: id,
      lineIdx: 0,
      charIdx: 0,
      lines: d.lines,
      speaker: d.speaker,
      portrait: d.portrait,
      onComplete: d.onComplete,
    };
  }

  function openNpcDialog(npc) {
    if (dialogState) return;
    const dialogId = selectNpcDialog(npc.def.dialog, state);
    openDialogById(dialogId);
  }

  function openSignDialog(sign) {
    if (dialogState) return;
    /* Usa textKey (tradotto) se presente, altrimenti fallback a text hardcoded. */
    const rawText = sign.def.textKey ? (getLegendSign(sign.def.textKey) || sign.def.text || '') : (sign.def.text || '');
    const lines = rawText.split('\n');
    dialogState = {
      dialogId: 'sign',
      lineIdx: 0, charIdx: 0,
      lines, speaker: getLegendEngineText('sign_speaker') || 'Cartello', portrait: null,
    };
  }

  function updateDialog() {
    if (!dialogState) return;
    const d = dialogState;
    const line = d.lines[d.lineIdx] || '';
    if (d.charIdx < line.length) {
      /* Pause naturali su punteggiatura */
      const nextChar = line.charAt(Math.floor(d.charIdx));
      const pause = (nextChar === '.' || nextChar === '!' || nextChar === '?') ? 0.45
                  : (nextChar === ',' || nextChar === ';') ? 0.7
                  : 1;
      d.charIdx = Math.min(line.length, d.charIdx + TEXT_SPEED * pause);
      if (Math.floor(d.charIdx) % 3 === 0) SFX.text();
      if (d.charIdx >= line.length) {
        d.completedAt = tickCount;       // cooldown anti-skip
      }
    }
    /* Permetti di accelerare il typewriter (porta charIdx a fine riga)
       solo all'edge della pressione, non in continuo. */
    const pressed = consumeAction();
    if (pressed) {
      if (d.charIdx < line.length) {
        d.charIdx = line.length;
        d.completedAt = tickCount;
      } else {
        /* Cooldown: almeno 8 frame da quando il typewriter ha finito,
           cosi` se rilasci e ripremi non skippi una riga involontariamente. */
        const ready = (tickCount - (d.completedAt || 0)) >= 8;
        if (!ready) return;
        if (d.lineIdx < d.lines.length - 1) {
          d.lineIdx++;
          d.charIdx = 0;
          d.completedAt = 0;
        } else {
          /* Fine dialogo */
          applyDialogComplete(d);
          dialogState = null;
        }
      }
    }
  }

  function applyDialogComplete(d) {
    if (!d.onComplete) return;
    const oc = d.onComplete;
    if (oc.setQuest) state.quest = oc.setQuest;
    if (oc.setFlag) state.flags[oc.setFlag] = true;
    if (oc.addMaxHp) {
      state.player.maxHp += oc.addMaxHp;
      state.player.hp = state.player.maxHp;
      callbacks.onHpChange?.(state.player.hp, state.player.maxHp);
    }
    if (oc.triggerEnding) {
      onWin();
    }
  }

  /* ─── Render ─── */
  function clear() {
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function renderTiles() {
    /* Disegna solo i tile visibili attorno alla camera */
    const x0 = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const y0 = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const x1 = Math.min(ZONE_W - 1, x0 + VIEW_TILES + 1);
    const y1 = Math.min(ZONE_H - 1, y0 + VIEW_TILES + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = mutableMap[y][x];
        const t = getTile(ch);
        const sp = getTileSprite(t, tickCount);
        if (sp) {
          /* Erba di base sotto agli oggetti */
          if (t.layer === 'object') {
            const grass = getTileSprite(getTile('.'), tickCount);
            blit(grass, x * TILE_SIZE, y * TILE_SIZE);
          }
          blit(sp, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
  }

  /** Disegna uno sprite a coordinate logiche, applicando camera + scale. */
  function blit(sprite, lx, ly) {
    const sx = (lx - camera.x) * SCALE;
    const sy = (ly - camera.y) * SCALE;
    if (sx < -32 * SCALE || sy < -32 * SCALE || sx > CANVAS_SIZE || sy > CANVAS_SIZE) return;
    drawSpriteScaled(ctx, sprite, sx, sy, sprite.w * SCALE, sprite.h * SCALE);
  }

  function renderEntities() {
    /* Ordina per Y per profondità */
    const sorted = [...entities].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      if (e.dead) continue;
      let sp = null;
      let offsetY = 0;
      if (e.type === 'enemy') {
        if (e.kind === 'slime')    sp = e.frame < 1 ? SPRITES.ENEMY_SLIME_0    : SPRITES.ENEMY_SLIME_1;
        if (e.kind === 'bat')      sp = e.frame < 1 ? SPRITES.ENEMY_BAT_0      : SPRITES.ENEMY_BAT_1;
        if (e.kind === 'skeleton') sp = e.frame < 1 ? SPRITES.ENEMY_SKELETON_0 : SPRITES.ENEMY_SKELETON_1;
        if (e.kind === 'mage')     sp = SPRITES.ENEMY_MAGE_0;
      } else if (e.type === 'boss') {
        if (e.kind === 'guardian')    sp = SPRITES.BOSS_GUARDIAN;
        if (e.kind === 'shadow_king') sp = SPRITES.BOSS_SHADOW_KING;
      } else if (e.type === 'item') {
        const map = {
          heart: 'ITEM_HEART', rupee: 'ITEM_RUPEE', key: 'ITEM_KEY', house_key: 'ITEM_HOUSE_KEY',
          bomb: 'ITEM_BOMB', potion: 'ITEM_POTION',
          sword: 'ITEM_SWORD', shield: 'ITEM_SHIELD',
          heart_container: 'ITEM_HEART_CONTAINER',
          crystal_green: 'ITEM_CRYSTAL_GREEN',
          crystal_blue: 'ITEM_CRYSTAL_BLUE',
          crystal_red: 'ITEM_CRYSTAL_RED',
        };
        sp = SPRITES[map[e.kind]];
        offsetY = Math.sin((tickCount + e.bobPhase * 60) * 0.08) * 1.5;
      } else if (e.type === 'npc') {
        const map = { king: 'NPC_KING', elder: 'NPC_ELDER', merchant: 'NPC_MERCHANT', child: 'NPC_CHILD' };
        sp = SPRITES[map[e.kind]];
      } else if (e.type === 'projectile') {
        /* Disegnato come cerchio luminoso */
        const sx = (e.x - camera.x) * SCALE;
        const sy = (e.y - camera.y) * SCALE;
        ctx.fillStyle = e.col;
        ctx.beginPath();
        ctx.arc(sx, sy, 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = e.col;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 * SCALE, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        continue;
      } else if (e.type === 'sign') {
        /* Cartello: piccolo blocco marrone con punto giallo */
        const sx = (e.x - camera.x - 6) * SCALE;
        const sy = (e.y - camera.y - 6) * SCALE;
        ctx.fillStyle = '#7a4a25';
        ctx.fillRect(sx, sy, 12 * SCALE, 12 * SCALE);
        ctx.fillStyle = '#f0c850';
        ctx.fillRect(sx + 4 * SCALE, sy + 3 * SCALE, 4 * SCALE, 6 * SCALE);
        continue;
      }
      if (!sp) continue;
      /* Centra sprite sul punto x,y dell'entita` */
      const drawX = e.x - sp.w / 2;
      const drawY = e.y - sp.h / 2 + offsetY;
      /* Lampeggio se iframes */
      if (e.iframes && Math.floor(e.iframes / 3) % 2 === 0) continue;
      blit(sp, drawX, drawY);
    }
  }

  function renderPlayer() {
    const p = state.player;
    /* Lampeggio se iframes */
    if (p.iframes && Math.floor(p.iframes / 4) % 2 === 0) return;
    const sp = getPlayerSprite(p.dir, p.frame >= 1, !!attackState);
    blit(sp, p.x - sp.w / 2, p.y - sp.h / 2);
  }

  function renderParticles() {
    for (const pa of particles) {
      const sx = (pa.x - camera.x) * SCALE;
      const sy = (pa.y - camera.y) * SCALE;
      ctx.fillStyle = pa.col;
      ctx.globalAlpha = pa.life / pa.maxLife;
      ctx.fillRect(sx, sy, 2 * SCALE, 2 * SCALE);
    }
    ctx.globalAlpha = 1;
  }

  function renderHud() {
    /* Cuori in alto a sinistra */
    const fullHearts = Math.floor(state.player.hp / 2);
    const halfHeart  = state.player.hp % 2 === 1;
    const totalHearts = Math.ceil(state.player.maxHp / 2);
    const heartSize = 16;
    const padding = 8;
    for (let i = 0; i < totalHearts; i++) {
      const x = padding + i * (heartSize + 2);
      const y = padding;
      if (i < fullHearts) {
        drawSpriteScaled(ctx, SPRITES.ITEM_HEART, x, y, heartSize, heartSize);
      } else if (i === fullHearts && halfHeart) {
        /* Mezzo cuore: clip a meta` */
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, heartSize / 2, heartSize);
        ctx.clip();
        drawSpriteScaled(ctx, SPRITES.ITEM_HEART, x, y, heartSize, heartSize);
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.strokeRect(x, y, heartSize, heartSize);
      } else {
        /* Cuore vuoto: outline */
        ctx.strokeStyle = 'rgba(255,80,80,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, heartSize - 4, heartSize - 4);
      }
    }

    /* Rupie in alto a destra */
    const text = `\u2666 ${state.rupees}`;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(text, CANVAS_SIZE - padding, padding + 12);

    /* Chiavi/bombe */
    let yIcon = padding + 26;
    if (state.keys > 0) {
      drawSpriteScaled(ctx, SPRITES.ITEM_KEY, CANVAS_SIZE - padding - 50, yIcon, 16, 16);
      ctx.fillText(`x${state.keys}`, CANVAS_SIZE - padding, yIcon + 12);
      yIcon += 18;
    }

    /* Indicatore cristalli (in alto centro) */
    const crystals = [
      { flag: 'has_crystal_green', sprite: 'ITEM_CRYSTAL_GREEN' },
      { flag: 'has_crystal_blue',  sprite: 'ITEM_CRYSTAL_BLUE'  },
      { flag: 'has_crystal_red',   sprite: 'ITEM_CRYSTAL_RED'   },
    ];
    const cSize = 14;
    const cPad = 2;
    const cTotal = crystals.length * (cSize + cPad);
    const cStartX = (CANVAS_SIZE - cTotal) / 2;
    for (let i = 0; i < crystals.length; i++) {
      const cx = cStartX + i * (cSize + cPad);
      const cy = padding;
      if (state.flags[crystals[i].flag]) {
        drawSpriteScaled(ctx, SPRITES[crystals[i].sprite], cx, cy, cSize, cSize);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(cx + 2, cy + 2, cSize - 4, cSize - 4);
      }
    }

    /* Mini-mappa in basso a destra */
    renderMiniMap();

    /* Reset */
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  function renderMiniMap() {
    const mmSize = 60;
    const mmX = CANVAS_SIZE - mmSize - 8;
    const mmY = CANVAS_SIZE - mmSize - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeStyle = 'rgba(240,200,80,0.6)';
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);
    /* Tile colorati */
    const sx = mmSize / ZONE_W;
    const sy = mmSize / ZONE_H;
    for (let y = 0; y < ZONE_H; y++) {
      for (let x = 0; x < ZONE_W; x++) {
        const ch = mutableMap[y][x];
        const t = getTile(ch);
        let col = null;
        if (t.solid) col = '#222';
        if (t.id === '.' || t.id === ',' || t.id === '_') col = '#3a8c3a';
        if (t.id === '~') col = '#3a72c8';
        if (t.id === 'F') col = '#888';
        if (t.id === '*') col = '#b870d0';
        if (t.id === 'L') col = '#d23a3a';
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(mmX + x * sx, mmY + y * sy, sx + 0.5, sy + 0.5);
        }
      }
    }
    /* Player */
    ctx.fillStyle = '#00f5d4';
    const pmx = mmX + (state.player.x / TILE_SIZE) * sx;
    const pmy = mmY + (state.player.y / TILE_SIZE) * sy;
    ctx.fillRect(pmx - 1.5, pmy - 1.5, 3, 3);
    /* Nemici */
    ctx.fillStyle = '#ff4040';
    for (const e of entities) {
      if ((e.type === 'enemy' || e.type === 'boss') && e.hp > 0) {
        const ex = mmX + (e.x / TILE_SIZE) * sx;
        const ey = mmY + (e.y / TILE_SIZE) * sy;
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
      }
    }
    /* Etichetta zona */
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    const z = getZone(state.zoneId);
    ctx.fillText(getLegendZoneName(z.id) || z.name, mmX + mmSize / 2, mmY - 3);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
  }

  function renderDialog() {
    if (!dialogState) return;
    const boxH = 96;
    const boxY = CANVAS_SIZE - boxH - 8;
    const boxX = 8;
    const boxW = CANVAS_SIZE - 16;

    /* Pannello */
    ctx.fillStyle = 'rgba(20,20,40,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f0c850';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    /* Ritratto NPC (se presente) */
    let textX = boxX + 12;
    if (dialogState.portrait && SPRITES[dialogState.portrait]) {
      drawSpriteScaled(ctx, SPRITES[dialogState.portrait], boxX + 8, boxY + 12, 64, 64);
      textX = boxX + 80;
    }

    /* Speaker */
    ctx.fillStyle = '#f0c850';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(dialogState.speaker || '', textX, boxY + 16);

    /* Linea corrente con typewriter */
    const line = dialogState.lines[dialogState.lineIdx] || '';
    const visible = line.substring(0, Math.floor(dialogState.charIdx));
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    /* Wrap manuale: line e` gia` corta, no wrap */
    ctx.fillText(visible, textX, boxY + 38);

    /* Linee successive (preview leggera) */
    for (let i = 1; i < 3; i++) {
      const next = dialogState.lines[dialogState.lineIdx + i];
      if (!next) break;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(next, textX, boxY + 38 + i * 16);
    }

    /* Indicatore "premi azione" lampeggiante (solo dopo cooldown anti-skip) */
    const ready = dialogState.charIdx >= line.length &&
                  (tickCount - (dialogState.completedAt || 0)) >= 8;
    if (ready) {
      const pulse = Math.sin(tickCount * 0.2);
      if (pulse > 0) {
        ctx.fillStyle = '#f0c850';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('▼', boxX + boxW - 12, boxY + boxH - 8);
        ctx.textAlign = 'left';
      }
    }
  }

  function renderOverlay() {
    if (gameOverRef.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#d23a3a';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(getLegendEngineText('game_over') || 'SEI CADUTO', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.textAlign = 'left';
    } else if (winRef.win) {
      ctx.fillStyle = 'rgba(240,200,80,0.4)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(getLegendEngineText('victory') || 'VITTORIA!', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(getLegendEngineText('victory_sub') || 'Twitchia è salva', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
      ctx.textAlign = 'left';
    }
  }

  /* ─── Loop ─── */
  function update() {
    tickCount++;
    refreshActionEdge();
    if (gameOverRef.gameOver || winRef.win) return;
    if (dialogState) {
      updateDialog();
      return;
    }
    updatePlayer();
    for (const e of entities) {
      if (e.type === 'enemy' || e.type === 'boss') updateEnemy(e);
      else if (e.type === 'projectile') updateProjectile(e);
      else if (e.type === 'item') {
        if (e.despawnAt && tickCount >= e.despawnAt) e.dead = true;
      }
    }
    /* Pulisci entita` morte */
    entities = entities.filter(e => !e.dead && !(e.collected) && !((e.type === 'enemy' || e.type === 'boss') && e.hp <= 0));
    /* Particles */
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function render() {
    clear();
    updateCamera();
    renderTiles();
    renderEntities();
    renderPlayer();
    renderParticles();
    renderHud();
    renderDialog();
    renderOverlay();
  }

  function loop(ts) {
    if (!runningRef.running) return;
    if (!lastTimestamp) lastTimestamp = ts;
    /* fixed step ~60Hz */
    const elapsed = ts - lastTimestamp;
    if (elapsed >= 16) {
      lastTimestamp = ts;
      if (!pausedRef.paused) update();
      render();
    }
    rafId = requestAnimationFrame(loop);
  }

  /* Init */
  loadZone();
  callbacks.onHpChange?.(state.player.hp, state.player.maxHp);
  callbacks.onScore?.(0);
  ensureAudio();
  rafId = requestAnimationFrame(loop);

  /* ─── API esposta ─── */
  return {
    cleanup() {
      runningRef.running = false;
      cancelAnimationFrame(rafId);
      stopMusic();
    },
    getState() { return state; },
    pause() { pausedRef.paused = true; },
    resume() { pausedRef.paused = false; },
  };
}

/* ─── Stats nemici / bosses ─── */
const ENEMY_STATS = {
  slime:    { hp: 1, speed: 0.5, damage: 1, points: 10 },
  bat:      { hp: 1, speed: 1.0, damage: 1, points: 20 },
  skeleton: { hp: 2, speed: 0.7, damage: 1, points: 30 },
  mage:     { hp: 3, speed: 0.4, damage: 1, points: 50 },
};
const BOSS_STATS = {
  guardian:    { hp: 12, speed: 0.4, damage: 2, points: 500 },
  shadow_king: { hp: 18, speed: 0.6, damage: 2, points: 1000 },
};
