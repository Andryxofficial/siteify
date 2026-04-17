/**
 * APRILE — Andryx Quest ⚔️
 * Premium Zelda-like dungeon crawler with rich visuals.
 *
 * Features:
 * - Procedural rooms with decorative floor tiles, shadows, torches
 * - Animated player with directional facing, trail, iframes blink
 * - 3 enemy types (slime/bat/ghost) with smooth AI & death animations
 * - Gems with sparkle trails, portal with swirl effect
 * - Heal power-up every 1000 points (restores full HP)
 * - HUD with animated hearts, room counter, score
 * - Screen shake, particles, floating score text
 * - Smooth room transitions with fade
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Andryx Quest',
  emoji: '⚔️',
  description: 'Esplora i dungeon, sconfiggi i nemici e raccogli le gemme!',
  color: '#00f5d4',
  controls: 'joystick',
  instructions: 'Muoviti con WASD/frecce o joystick. Attacca con Spazio o il pulsante ⚔️. Sconfiggi tutti i nemici per aprire il portale!',
  gameOverTitle: 'Sei caduto!',
  actionLabel: '⚔️',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const TILE = 32;
const COLS = W / TILE; // 15
const ROWS = H / TILE; // 15
const PLAYER_R = 11;
const PLAYER_SPD = 2.6;
const ATTACK_DUR = 14;
const ATTACK_RANGE = 30;
const IFRAME_DUR = 45;
const ATTACK_HIT_R = 26;
const ENEMY_HIT_R = 16;
const GEM_R = 16;
const EXIT_R = 22;
const HEAL_R = 22;
const HEAL_MARGIN = 100;
const HEAL_THRESHOLD = 1000;
const WALL_CHECK_R = 10;

const ENEMY_STATS = {
  slime: { hp: 1, spd: 0.55, pts: 10, col: '#7c3aed', glow: 'rgba(124,58,237,0.5)' },
  bat:   { hp: 1, spd: 1.1,  pts: 20, col: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
  ghost: { hp: 2, spd: 0.75, pts: 30, col: '#06b6d4', glow: 'rgba(6,182,212,0.5)' },
};

/* ─── Color palette ─── */
const P = {
  bg: '#0a0e17',
  floor1: '#161c2e', floor2: '#131828', floor3: '#1a2035',
  wall: '#2a3350', wallTop: '#3a4a6e', wallEdge: '#1e2740',
  player: '#00f5d4', playerInner: '#00c4a8', playerTrail: 'rgba(0,245,212,0.15)',
  sword: '#f0ecf4', swordGlow: 'rgba(0,245,212,0.7)',
  gem: '#FF00D4', gemInner: '#ff66e5', gemGlow: 'rgba(255,0,212,0.45)',
  heart: '#FF0050', heartDim: 'rgba(255,0,80,0.32)',
  exit: '#FFD700', exitGlow: 'rgba(255,215,0,0.5)', exitInner: '#fff8dc',
  text: '#f0ecf4', textDim: '#7a7590',
  healGlow: 'rgba(0,255,128,0.5)', heal: '#00ff80',
  torch: '#f59e0b', torchGlow: 'rgba(245,158,11,0.12)',
};

/* ─── Helpers ─── */
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}


function rng(min, max) { return min + Math.random() * (max - min); }

function rngInt(min, max) { return Math.floor(rng(min, max + 1)); }

/** Generate a room grid with walls, keeping spawn & exit clear. */
function generateRoom(roomNum) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  // Border walls
  for (let x = 0; x < COLS; x++) { grid[0][x] = 1; grid[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { grid[y][0] = 1; grid[y][COLS - 1] = 1; }
  // Interior walls — increase with room progression
  const wallCount = 5 + Math.min(roomNum * 2, 16);
  for (let i = 0; i < wallCount; i++) {
    const x = rngInt(2, COLS - 3);
    const y = rngInt(2, ROWS - 3);
    grid[y][x] = 1;
    // Sometimes extend wall to form L-shapes
    if (Math.random() < 0.45) {
      const dx = Math.random() < 0.5 ? 1 : 0;
      const dy = dx === 0 ? 1 : 0;
      const nx = x + dx, ny = y + dy;
      if (ny > 0 && ny < ROWS - 1 && nx > 0 && nx < COLS - 1) grid[ny][nx] = 1;
    }
  }
  // Clear spawn area (bottom-left)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sy = ROWS - 3 + dy, sx = 2 + dx;
      if (sy > 0 && sy < ROWS - 1 && sx > 0 && sx < COLS - 1) grid[sy][sx] = 0;
    }
  }
  // Clear exit area (top-right)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ey = 2 + dy, ex = COLS - 3 + dx;
      if (ey > 0 && ey < ROWS - 1 && ex > 0 && ex < COLS - 1) grid[ey][ex] = 0;
    }
  }
  return grid;
}

/** Decorative data for floor (cracks, dots) — computed once per room. */
function generateFloorDecor(grid) {
  const decor = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[y][x] !== 0) continue;
      if (Math.random() < 0.12) {
        decor.push({ x: x * TILE + rng(4, TILE - 4), y: y * TILE + rng(4, TILE - 4), type: 'dot', size: rng(1, 2.5) });
      }
      if (Math.random() < 0.04) {
        decor.push({ x: x * TILE + rng(6, TILE - 6), y: y * TILE + rng(6, TILE - 6), type: 'crack', angle: rng(0, Math.PI * 2), len: rng(4, 10) });
      }
    }
  }
  return decor;
}

/** Torch positions — placed on some wall edges adjacent to floor. */
function generateTorches(grid) {
  const torches = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[y][x] !== 1) continue;
      // Only place torch on wall that faces floor below
      if (y + 1 < ROWS && grid[y + 1][x] === 0 && Math.random() < 0.18) {
        torches.push({ x: x * TILE + TILE / 2, y: (y + 1) * TILE - 2, flicker: rng(0, Math.PI * 2) });
      }
    }
  }
  return torches;
}

function spawnEnemies(roomNum, grid) {
  const enemies = [];
  const count = Math.min(2 + roomNum, 10);
  const types = ['slime'];
  if (roomNum >= 2) types.push('bat');
  if (roomNum >= 4) types.push('ghost');
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = rngInt(2, COLS - 3);
      y = rngInt(2, ROWS - 3);
      tries++;
    } while ((grid[y][x] === 1 || (x < 5 && y > ROWS - 5)) && tries < 60);
    if (tries >= 60) continue;
    const type = types[Math.floor(Math.random() * types.length)];
    const base = ENEMY_STATS[type];
    const hpBonus = Math.floor(roomNum / 3);
    enemies.push({
      type, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
      hp: base.hp + hpBonus, maxHp: base.hp + hpBonus,
      spd: base.spd + roomNum * 0.035,
      dir: rng(0, Math.PI * 2), moveTimer: 0,
      hitFlash: 0, dead: false, deathTimer: 0,
      pulse: rng(0, Math.PI * 2),
    });
  }
  return enemies;
}

function spawnGems(roomNum, grid) {
  const gems = [];
  const count = 3 + Math.min(roomNum, 5);
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = rngInt(1, COLS - 2);
      y = rngInt(1, ROWS - 2);
      tries++;
    } while (grid[y][x] === 1 && tries < 40);
    if (tries >= 40) continue;
    gems.push({
      x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
      collected: false, pulse: rng(0, Math.PI * 2), sparkle: rng(0, 100),
    });
  }
  return gems;
}

/* ─── Main game ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ─── State ─── */
  function initRoom(rn) {
    const grid = generateRoom(rn);
    return {
      grid,
      decor: generateFloorDecor(grid),
      torches: generateTorches(grid),
      enemies: spawnEnemies(rn, grid),
      gems: spawnGems(rn, grid),
      exitOpen: false,
      exitX: (COLS - 3) * TILE + TILE / 2,
      exitY: 2 * TILE + TILE / 2,
    };
  }

  const room0 = initRoom(0);
  const s = {
    px: 2 * TILE + TILE / 2,
    py: (ROWS - 3) * TILE + TILE / 2,
    pdir: 0, // 0=right 1=down 2=left 3=up
    pvx: 0, pvy: 0, // for trail smoothing
    hp: 5, maxHp: 5,
    score: 0, roomNum: 0,
    attacking: 0, iframe: 0,
    lastHealAt: 0, healItems: [],
    particles: [], floatTexts: [], trail: [],
    running: true, frame: 0,
    shake: 0, transition: 0, transitionDir: 1, // 1=fade-in, -1=fade-out
    ...room0,
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  /* ─── Collision ─── */
  function wallAt(px, py, r) {
    const rad = r || WALL_CHECK_R;
    const corners = [
      [px - rad, py - rad], [px + rad, py - rad],
      [px - rad, py + rad], [px + rad, py + rad],
    ];
    for (const [cx, cy] of corners) {
      const gx = Math.floor(cx / TILE);
      const gy = Math.floor(cy / TILE);
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if (s.grid[gy]?.[gx] === 1) return true;
    }
    return false;
  }

  /* ─── Effects ─── */
  function addParticles(x, y, color, count, opts = {}) {
    const { spread = 5, sizeMin = 1.5, sizeMax = 4, decayMin = 0.02, decayMax = 0.04 } = opts;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread,
        life: 1, decay: rng(decayMin, decayMax),
        color, size: rng(sizeMin, sizeMax),
      });
    }
  }

  function addFloatText(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function enterNextRoom() {
    s.transition = 30;
    s.transitionDir = -1; // fade out
    setTimeout(() => {
      s.roomNum++;
      const room = initRoom(s.roomNum);
      Object.assign(s, room);
      s.px = 2 * TILE + TILE / 2;
      s.py = (ROWS - 3) * TILE + TILE / 2;
      s.trail = [];
      s.score += 100;
      s.hp = Math.min(s.hp + 1, s.maxHp);
      onScore(s.score);
      onHpChange(s.hp, s.maxHp);
      s.transition = 30;
      s.transitionDir = 1; // fade in
    }, 500);
  }

  function getAttackPos() {
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirs[s.pdir];
    return { x: s.px + dx * ATTACK_RANGE, y: s.py + dy * ATTACK_RANGE };
  }

  /* ─── UPDATE ─── */
  function update() {
    if (!s.running) return;
    s.frame++;

    if (s.transition > 0) {
      s.transition--;
      return;
    }

    // ── Input ──
    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
    const joy = joystickRef.current;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 0.15) {
      mx /= mag; my /= mag;
      if (Math.abs(mx) > Math.abs(my)) s.pdir = mx > 0 ? 0 : 2;
      else s.pdir = my > 0 ? 1 : 3;
    }

    // ── Movement ──
    const nx = s.px + mx * PLAYER_SPD;
    const ny = s.py + my * PLAYER_SPD;
    if (!wallAt(nx, s.py)) s.px = nx;
    if (!wallAt(s.px, ny)) s.py = ny;
    s.pvx = mx * PLAYER_SPD;
    s.pvy = my * PLAYER_SPD;

    // Trail
    if (mag > 0.15 && s.frame % 2 === 0) {
      s.trail.push({ x: s.px, y: s.py, life: 1 });
    }
    for (let i = s.trail.length - 1; i >= 0; i--) {
      s.trail[i].life -= 0.06;
      if (s.trail[i].life <= 0) s.trail.splice(i, 1);
    }

    // ── Attack ──
    if (s.attacking > 0) s.attacking--;
    if ((keys[' '] || keys['Space'] || actionBtnRef.current) && s.attacking === 0) {
      s.attacking = ATTACK_DUR;
      const ap = getAttackPos();
      addParticles(ap.x, ap.y, P.swordGlow, 3, { spread: 3, sizeMin: 1, sizeMax: 2 });
      for (const e of s.enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, ap.x, ap.y) < ATTACK_HIT_R) {
          e.hp--;
          e.hitFlash = 10;
          s.shake = 5;
          addParticles(e.x, e.y, '#fff', 5, { spread: 4 });
          if (e.hp <= 0) {
            e.dead = true;
            e.deathTimer = 20;
            const pts = ENEMY_STATS[e.type].pts;
            s.score += pts;
            onScore(s.score);
            addParticles(e.x, e.y, ENEMY_STATS[e.type].col, 14, { spread: 6, sizeMin: 2, sizeMax: 5 });
            addFloatText(e.x, e.y - 12, `+${pts}`, ENEMY_STATS[e.type].col);
          }
        }
      }
      actionBtnRef.current = false;
    }
    // Clear actionBtn after reading
    if (actionBtnRef.current && s.attacking > 0) {
      actionBtnRef.current = false;
    }

    if (s.iframe > 0) s.iframe--;

    // ── Enemies ──
    for (const e of s.enemies) {
      if (e.dead) {
        if (e.deathTimer > 0) e.deathTimer--;
        continue;
      }
      e.pulse = (e.pulse + 0.06) % (Math.PI * 2);
      if (e.hitFlash > 0) e.hitFlash--;
      e.moveTimer++;

      // AI per type
      if (e.type === 'slime') {
        if (e.moveTimer % 50 === 0) {
          e.dir = Math.atan2(s.py - e.y, s.px - e.x) + rng(-0.6, 0.6);
        }
        if (e.moveTimer % 3 === 0) {
          const enx = e.x + Math.cos(e.dir) * e.spd;
          const eny = e.y + Math.sin(e.dir) * e.spd;
          if (!wallAt(enx, e.y, 8)) e.x = enx;
          if (!wallAt(e.x, eny, 8)) e.y = eny;
        }
      } else if (e.type === 'bat') {
        if (e.moveTimer % 25 === 0) {
          e.dir = Math.atan2(s.py - e.y, s.px - e.x) + rng(-0.5, 0.5);
        }
        const enx = e.x + Math.cos(e.dir) * e.spd;
        const eny = e.y + Math.sin(e.dir) * e.spd;
        if (!wallAt(enx, e.y, 6)) e.x = enx;
        if (!wallAt(e.x, eny, 6)) e.y = eny;
      } else if (e.type === 'ghost') {
        if (e.moveTimer % 40 === 0) {
          e.dir = Math.atan2(s.py - e.y, s.px - e.x);
        }
        // Ghost passes through walls
        e.x += Math.cos(e.dir) * e.spd;
        e.y += Math.sin(e.dir) * e.spd;
        e.x = Math.max(TILE, Math.min(e.x, W - TILE));
        e.y = Math.max(TILE, Math.min(e.y, H - TILE));
      }

      // Collision with player
      if (s.iframe === 0 && dist(s.px, s.py, e.x, e.y) < ENEMY_HIT_R + PLAYER_R) {
        s.hp--;
        s.iframe = IFRAME_DUR;
        s.shake = 10;
        addParticles(s.px, s.py, P.heart, 8, { spread: 5 });
        onHpChange(s.hp, s.maxHp);
        if (s.hp <= 0) {
          s.running = false;
        }
      }
    }

    // ── Gems ──
    for (const g of s.gems) {
      if (g.collected) continue;
      g.pulse = (g.pulse + 0.05) % (Math.PI * 2);
      g.sparkle++;
      if (dist(s.px, s.py, g.x, g.y) < GEM_R) {
        g.collected = true;
        s.score += 15;
        onScore(s.score);
        addParticles(g.x, g.y, P.gem, 8, { spread: 4, sizeMin: 1.5, sizeMax: 3.5 });
        addFloatText(g.x, g.y - 12, '+15', P.gem);
      }
    }

    // ── Heal power-up every HEAL_THRESHOLD ──
    const healMilestone = Math.floor(s.score / HEAL_THRESHOLD);
    if (healMilestone > s.lastHealAt && s.hp < s.maxHp) {
      s.lastHealAt = healMilestone;
      s.healItems.push({
        x: HEAL_MARGIN + Math.random() * (W - 2 * HEAL_MARGIN),
        y: HEAL_MARGIN + Math.random() * (H - 2 * HEAL_MARGIN),
        pulse: 0,
      });
      addFloatText(W / 2, 60, '♥ CURA DISPONIBILE!', P.heal);
    }

    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.pulse += 0.08;
      if (dist(s.px, s.py, h.x, h.y) < HEAL_R) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, h.y, P.heal, 12, { spread: 5, sizeMin: 2, sizeMax: 4 });
        addFloatText(h.x, h.y - 14, '♥ MAX!', P.heal);
        s.healItems.splice(i, 1);
      }
    }

    // ── Exit portal ──
    if (!s.exitOpen && s.enemies.every(e => e.dead)) {
      s.exitOpen = true;
      addParticles(s.exitX, s.exitY, P.exit, 10, { spread: 4, sizeMin: 2, sizeMax: 4 });
    }

    if (s.exitOpen && dist(s.px, s.py, s.exitX, s.exitY) < EXIT_R) {
      enterNextRoom();
    }

    // ── Particles ──
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.95; p.vy *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // ── Float texts ──
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y -= 0.7;
      ft.life -= 0.022;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    if (s.shake > 0) s.shake -= 0.5;
  }

  /* ─── DRAW ─── */
  function draw() {
    ctx.save();

    // Screen shake
    if (s.shake > 0) {
      const intensity = s.shake;
      ctx.translate(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2,
      );
    }

    // ── Background ──
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Floor tiles ──
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tx = x * TILE, ty = y * TILE;
        if (s.grid[y][x] === 1) {
          // Wall with top highlight and edge shadow
          ctx.fillStyle = P.wall;
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = P.wallTop;
          ctx.fillRect(tx, ty, TILE, 5);
          ctx.fillStyle = P.wallEdge;
          ctx.fillRect(tx, ty + TILE - 2, TILE, 2);
          // Subtle border
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(tx + 0.5, ty + 0.5, TILE - 1, TILE - 1);
        } else {
          // Floor with subtle pattern
          const pattern = (x + y) % 3;
          ctx.fillStyle = pattern === 0 ? P.floor1 : pattern === 1 ? P.floor2 : P.floor3;
          ctx.fillRect(tx, ty, TILE, TILE);
          // Tile border — very subtle
          ctx.strokeStyle = 'rgba(255,255,255,0.015)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(tx + 0.5, ty + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    // ── Floor decorations ──
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (const d of s.decor) {
      if (d.type === 'dot') {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'crack') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 0.5;
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.beginPath();
        ctx.moveTo(-d.len / 2, 0);
        ctx.lineTo(0, rng(-2, 2));
        ctx.lineTo(d.len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Torches ──
    for (const t of s.torches) {
      t.flicker += 0.12;
      const flick = 0.7 + Math.sin(t.flicker) * 0.2 + Math.sin(t.flicker * 2.7) * 0.1;
      // Glow on floor
      const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 50 * flick);
      grad.addColorStop(0, `rgba(245,158,11,${0.08 * flick})`);
      grad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(t.x - 50, t.y - 50, 100, 100);
      // Flame
      ctx.fillStyle = P.torch;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 3 * flick, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 6, 1.5 * flick, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Exit portal ──
    if (s.exitOpen) {
      const t = s.frame * 0.06;
      const pulse = 0.8 + Math.sin(t) * 0.2;
      // Outer glow
      const grad = ctx.createRadialGradient(s.exitX, s.exitY, 0, s.exitX, s.exitY, 28 * pulse);
      grad.addColorStop(0, 'rgba(255,215,0,0.25)');
      grad.addColorStop(0.5, 'rgba(255,215,0,0.08)');
      grad.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.exitX, s.exitY, 28 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Swirl ring
      ctx.save();
      ctx.translate(s.exitX, s.exitY);
      ctx.rotate(t);
      ctx.strokeStyle = P.exit;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14 * pulse, angle, angle + 1.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Core
      ctx.fillStyle = P.exit;
      ctx.beginPath();
      ctx.arc(s.exitX, s.exitY, 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.exitInner;
      ctx.beginPath();
      ctx.arc(s.exitX, s.exitY, 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Arrow indicator
      ctx.fillStyle = P.exit;
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', s.exitX, s.exitY - 22 + Math.sin(t * 1.5) * 3);
    }

    // ── Gems ──
    for (const g of s.gems) {
      if (g.collected) continue;
      const glow = 0.7 + Math.sin(g.pulse) * 0.3;
      const bobY = Math.sin(g.pulse * 1.3) * 2;
      // Glow
      const grad = ctx.createRadialGradient(g.x, g.y + bobY, 0, g.x, g.y + bobY, 14 * glow);
      grad.addColorStop(0, `rgba(255,0,212,${0.2 * glow})`);
      grad.addColorStop(1, 'rgba(255,0,212,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(g.x, g.y + bobY, 14 * glow, 0, Math.PI * 2);
      ctx.fill();
      // Diamond shape
      ctx.save();
      ctx.translate(g.x, g.y + bobY);
      ctx.rotate(Math.PI / 4 + Math.sin(g.pulse * 0.5) * 0.1);
      ctx.fillStyle = P.gem;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = P.gemInner;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
      // Sparkle
      if (g.sparkle % 30 < 6) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(g.x + 5, g.y + bobY - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Heal items ──
    for (const h of s.healItems) {
      const glow = 0.7 + Math.sin(h.pulse) * 0.3;
      const bobY = Math.sin(h.pulse) * 3;
      // Glow
      const grad = ctx.createRadialGradient(h.x, h.y + bobY, 0, h.x, h.y + bobY, 18 * glow);
      grad.addColorStop(0, 'rgba(0,255,128,0.15)');
      grad.addColorStop(1, 'rgba(0,255,128,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(h.x, h.y + bobY, 18 * glow, 0, Math.PI * 2);
      ctx.fill();
      // Cross shape
      ctx.fillStyle = P.heal;
      ctx.fillRect(h.x - 2, h.y + bobY - 7, 4, 14);
      ctx.fillRect(h.x - 7, h.y + bobY - 2, 14, 4);
      // Inner white
      ctx.fillStyle = '#fff';
      ctx.fillRect(h.x - 1, h.y + bobY - 5, 2, 10);
      ctx.fillRect(h.x - 5, h.y + bobY - 1, 10, 2);
    }

    // ── Enemies ──
    for (const e of s.enemies) {
      // Death fade-out
      if (e.dead) {
        if (e.deathTimer > 0) {
          ctx.globalAlpha = e.deathTimer / 20;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 8 * (1 - e.deathTimer / 20) + 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const base = ENEMY_STATS[e.type];
      const flash = e.hitFlash > 0;

      ctx.save();
      // Glow circle underneath
      if (!flash) {
        const grad = ctx.createRadialGradient(e.x, e.y + 6, 0, e.x, e.y + 6, 16);
        grad.addColorStop(0, base.glow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y + 6, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      // Body color
      ctx.fillStyle = flash ? '#fff' : base.col;

      if (e.type === 'slime') {
        const sq = 1 + Math.sin(e.pulse * 2) * 0.12;
        ctx.translate(e.x, e.y);
        ctx.scale(sq, 2 - sq);
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        // Face
        if (!flash) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(-4, -4, 3, 4);
          ctx.fillRect(2, -4, 3, 4);
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(-3, -2, 2, 3);
          ctx.fillRect(3, -2, 2, 3);
        }
      } else if (e.type === 'bat') {
        const wing = Math.sin(e.pulse * 3) * 0.4;
        const bob = Math.sin(e.pulse * 2) * 3;
        ctx.translate(e.x, e.y + bob);
        // Body
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.quadraticCurveTo(-16, -10 + wing * 15, -12, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, -2);
        ctx.quadraticCurveTo(16, -10 + wing * 15, 12, 2);
        ctx.fill();
        // Eyes
        if (!flash) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(-4, -3, 2, 2);
          ctx.fillRect(2, -3, 2, 2);
        }
      } else if (e.type === 'ghost') {
        ctx.globalAlpha = flash ? 1 : 0.55 + Math.sin(e.pulse) * 0.15;
        const bob = Math.sin(e.pulse) * 3;
        ctx.translate(e.x, e.y + bob);
        // Body
        ctx.beginPath();
        ctx.arc(0, -3, 10, Math.PI, 0);
        ctx.lineTo(10, 8);
        for (let wx = 10; wx >= -10; wx -= 5) {
          ctx.lineTo(wx, 8 + ((wx + 10) % 10 === 0 ? 4 : 0));
        }
        ctx.closePath();
        ctx.fill();
        // Eyes
        if (!flash) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(-3, -3, 3, 0, Math.PI * 2);
          ctx.arc(4, -3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1a1a2e';
          ctx.beginPath();
          ctx.arc(-2, -2, 1.5, 0, Math.PI * 2);
          ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // HP bar
      if (!e.dead && e.hp < e.maxHp) {
        const bw = 22, bh = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - bw / 2 - 1, e.y - 20, bw + 2, bh + 2);
        ctx.fillStyle = P.heart;
        ctx.fillRect(e.x - bw / 2, e.y - 19, bw * (e.hp / e.maxHp), bh);
      }
    }

    // ── Player trail ──
    for (const t of s.trail) {
      ctx.globalAlpha = t.life * 0.3;
      ctx.fillStyle = P.playerTrail;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PLAYER_R * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Player ──
    ctx.save();
    if (s.iframe > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.25;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(s.px, s.py + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    const pGrad = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, 20);
    pGrad.addColorStop(0, 'rgba(0,245,212,0.12)');
    pGrad.addColorStop(1, 'rgba(0,245,212,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(s.px, s.py, 20, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = P.player;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.playerInner;
    ctx.beginPath();
    ctx.arc(s.px, s.py, 7, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (direction-aware)
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [fdx, fdy] = dirs[s.pdir];
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.px + fdx * 4 - fdy * 2.5, s.py + fdy * 4 + fdx * 2.5, 2.2, 0, Math.PI * 2);
    ctx.arc(s.px + fdx * 4 + fdy * 2.5, s.py + fdy * 4 - fdx * 2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(s.px + fdx * 5 - fdy * 2.5, s.py + fdy * 5 + fdx * 2.5, 1, 0, Math.PI * 2);
    ctx.arc(s.px + fdx * 5 + fdy * 2.5, s.py + fdy * 5 - fdx * 2.5, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Attack swing ──
    if (s.attacking > 0) {
      const ap = getAttackPos();
      const progress = 1 - s.attacking / ATTACK_DUR;
      const baseAngle = s.pdir * Math.PI / 2;
      const swingAngle = baseAngle + (progress - 0.5) * Math.PI * 0.9;
      ctx.save();
      // Slash trail
      ctx.strokeStyle = `rgba(0,245,212,${0.7 * (1 - progress)})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.px, s.py, ATTACK_RANGE, swingAngle - 0.5, swingAngle + 0.5);
      ctx.stroke();
      // Sword line
      ctx.strokeStyle = P.sword;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.px + Math.cos(swingAngle) * 8, s.py + Math.sin(swingAngle) * 8);
      ctx.lineTo(s.px + Math.cos(swingAngle) * ATTACK_RANGE, s.py + Math.sin(swingAngle) * ATTACK_RANGE);
      ctx.stroke();
      // Tip glow
      ctx.fillStyle = P.swordGlow;
      ctx.beginPath();
      ctx.arc(ap.x + Math.cos(swingAngle) * 6, ap.y + Math.sin(swingAngle) * 6, 3 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Particles ──
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Float texts ──
    for (const ft of s.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${12 + (1 - ft.life) * 2}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // ── HUD ──
    drawHUD();

    // ── Transition overlay ──
    if (s.transition > 0) {
      const alpha = s.transitionDir === 1
        ? s.transition / 30
        : 1 - s.transition / 30;
      ctx.fillStyle = `rgba(10,14,23,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function drawHUD() {
    const heartSpacing = 26;
    const heartSize = s.hp <= 1 && s.hp > 0 ? 23 + Math.sin(s.frame * 0.2) * 3 : 22;

    // HUD background bar (top strip)
    ctx.save();
    ctx.fillStyle = 'rgba(7,7,14,0.62)';
    ctx.fillRect(0, 0, W, 44);
    ctx.restore();

    // Hearts
    ctx.font = `${heartSize}px sans-serif`;
    ctx.textAlign = 'left';
    for (let i = 0; i < s.maxHp; i++) {
      const hx = 10 + i * heartSpacing;
      const hy = 30;
      ctx.fillStyle = i < s.hp ? P.heart : P.heartDim;
      ctx.fillText(i < s.hp ? '♥' : '♡', hx, hy);
    }

    // Score (right side)
    ctx.fillStyle = P.text;
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${s.score}`, W - 10, 28);

    // Room number (right, below score)
    ctx.fillStyle = P.textDim;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`Stanza ${s.roomNum + 1}`, W - 10, 40);

    // Enemies remaining
    const alive = s.enemies.filter(e => !e.dead).length;
    ctx.font = '12px Outfit, sans-serif';
    ctx.textAlign = 'left';
    if (alive > 0) {
      ctx.fillStyle = 'rgba(255,0,80,0.7)';
      ctx.fillText(`👾 ${alive}`, 10 + s.maxHp * heartSpacing + 6, 30);
    } else if (s.exitOpen) {
      ctx.fillStyle = 'rgba(255,215,0,0.8)';
      ctx.fillText('✦ Portale!', 10 + s.maxHp * heartSpacing + 6, 30);
    }

    ctx.textAlign = 'left';
  }

  /* ─── Loop ─── */
  function gameLoop() {
    update();
    draw();
    if (s.running) {
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      onGameOver(s.score);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);

  return function cleanup() {
    s.running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
