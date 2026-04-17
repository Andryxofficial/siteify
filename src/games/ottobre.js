/**
 * OTTOBRE — Shadow Maze 🎃
 * Premium procedural maze with limited flashlight visibility,
 * fog particles, ghost trails, pumpkin decor, float-text effects.
 * Action button = flashlight burst (reveals more, stuns ghosts).
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Shadow Maze',
  emoji: '🎃',
  description: 'Trova l\'uscita nel labirinto stregato!',
  color: '#FF6D00',
  controls: 'joystick',
  instructions:
    'Muoviti con WASD/frecce o joystick. Raccogli le caramelle 🍬, evita i fantasmi 👻 e trova il portale per avanzare! Premi 🔦 per illuminare e stordire i fantasmi vicini.',
  gameOverTitle: 'Catturato dai fantasmi!',
  actionLabel: '🔦',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const TILE = 32;
const COLS = 15, ROWS = 15;
const PR = 10;
const BASE_LIGHT = 100;
const FLASH_LIGHT = 200;
const FLASH_DUR = 25;
const FLASH_CD = 120;
const FLASH_STUN = 90;
const IFRAME_DUR = 75;
const PLAYER_SPD = 2.4;
const HEAL_THRESHOLD = 1000;
const FOG_COUNT = 40;

/* ─── Palette ─── */
const P = {
  bg: '#080808',
  wall: '#1e0f08', wallHi: '#30180e', wallEdge: '#0d0604',
  floor: '#110c06', floorAlt: '#0e0a05',
  floorCrack: 'rgba(255,109,0,0.04)',
  player: '#FF6D00', playerInner: '#E65100', playerGlow: 'rgba(255,109,0,0.3)',
  candy: '#FF4081', candyGlow: 'rgba(255,64,129,0.5)',
  ghost: '#B2EBF2', ghostGlow: 'rgba(178,235,242,0.35)',
  ghostTrail: 'rgba(178,235,242,0.08)',
  exit: '#76FF03', exitGlow: 'rgba(118,255,3,0.5)',
  exitRing: 'rgba(118,255,3,0.15)',
  heal: '#00E676', healGlow: 'rgba(0,230,118,0.5)',
  heart: '#FF1744', heartDim: 'rgba(255,23,68,0.32)',
  pumpkin: '#FF6D00', pumpkinDark: '#BF360C', pumpkinGlow: 'rgba(255,109,0,0.25)',
  text: '#f0ecf4', textDim: '#a8a3b3',
  fog: 'rgba(100,80,120,0.035)',
  flashRing: 'rgba(255,200,50,0.15)',
};

/* ─── Helpers ─── */
const dist = (ax, ay, bx, by) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ─── Maze generation (recursive backtracker) ─── */
function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [];
  const sx = 1, sy = 1;
  grid[sy][sx] = 0;
  visited[sy][sx] = true;
  stack.push([sx, sy]);
  const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && !visited[ny][nx]) {
        nb.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
    }
    if (nb.length) {
      const [nx, ny, wx, wy] = nb[Math.floor(Math.random() * nb.length)];
      grid[wy][wx] = 0;
      grid[ny][nx] = 0;
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }
  return grid;
}

/* ─── Main game ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ─ Pre-baked off-screen canvases for performance ─ */
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = W; fogCanvas.height = H;
  const fogCtx = fogCanvas.getContext('2d');

  /* ─ Level builder ─ */
  function initLevel(lvl) {
    const grid = generateMaze(COLS, ROWS);
    const floorTiles = [];
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++)
        if (grid[y][x] === 0 && !(x === 1 && y === 1)) floorTiles.push([x, y]);
    shuffle(floorTiles);

    // Candies
    const candyCount = clamp(6 + lvl * 2, 6, 18);
    const candies = [];
    for (let i = 0; i < Math.min(candyCount, floorTiles.length); i++) {
      const [tx, ty] = floorTiles[i];
      candies.push({
        x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        collected: false, pulse: rnd(0, Math.PI * 2), type: Math.random() < 0.3 ? 1 : 0,
      });
    }

    // Pumpkin decorations (purely visual)
    const pumpkinCount = clamp(3 + lvl, 3, 8);
    const pumpkins = [];
    for (let i = candyCount; i < candyCount + pumpkinCount && i < floorTiles.length; i++) {
      const [tx, ty] = floorTiles[i];
      pumpkins.push({
        x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        pulse: rnd(0, Math.PI * 2), size: rnd(5, 8),
      });
    }

    // Exit — find a valid floor tile far from start
    let bestTile = floorTiles[floorTiles.length - 1] || [COLS - 2, ROWS - 2];
    let bestDist = 0;
    for (const [tx, ty] of floorTiles) {
      const d = dist(tx, ty, 1, 1);
      if (d > bestDist && grid[ty][tx] === 0) { bestDist = d; bestTile = [tx, ty]; }
    }
    const exitX = bestTile[0] * TILE + TILE / 2;
    const exitY = bestTile[1] * TILE + TILE / 2;

    // Ghosts
    const ghostCount = clamp(1 + Math.floor(lvl * 0.7), 1, 6);
    const ghosts = [];
    const ghostStart = candyCount + pumpkinCount;
    for (let i = 0; i < ghostCount; i++) {
      const idx = ghostStart + i;
      if (idx >= floorTiles.length) break;
      const [tx, ty] = floorTiles[idx];
      ghosts.push({
        x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        dir: rnd(0, Math.PI * 2), moveTimer: 0,
        pulse: rnd(0, Math.PI * 2),
        speed: clamp(0.5 + lvl * 0.12, 0.5, 2.2),
        stunTimer: 0,
        trail: [],
      });
    }

    // Fog particles
    const fog = [];
    for (let i = 0; i < FOG_COUNT; i++) {
      fog.push({
        x: rnd(0, COLS * TILE), y: rnd(0, ROWS * TILE),
        r: rnd(20, 50), vx: rnd(-0.15, 0.15), vy: rnd(-0.1, 0.1),
        alpha: rnd(0.02, 0.06),
      });
    }

    return { grid, candies, pumpkins, ghosts, exitX, exitY, exitOpen: false, fog };
  }

  /* ─ State ─ */
  const lv0 = initLevel(0);
  const s = {
    px: 1 * TILE + TILE / 2, py: 1 * TILE + TILE / 2,
    faceDx: 1, faceDy: 0,
    score: 0, hp: 4, maxHp: 4, level: 0,
    ...lv0,
    particles: [], floatTexts: [],
    running: true, frame: 0, iframe: 0, screenShake: 0,
    lightRadius: BASE_LIGHT,
    lightTarget: BASE_LIGHT,
    flashTimer: 0, flashCD: 0,
    lastHealMilestone: 0, healItems: [],
    levelFlash: 0,
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  /* ─ Collision helpers ─ */
  function wallAt(px, py, r) {
    const corners = [
      [px - r, py - r], [px + r, py - r],
      [px - r, py + r], [px + r, py + r],
    ];
    for (const [cx, cy] of corners) {
      const gx = Math.floor(cx / TILE), gy = Math.floor(cy / TILE);
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if (s.grid[gy][gx] === 1) return true;
    }
    return false;
  }

  /* ─ Effects ─ */
  function addParticles(x, y, color, count, spread = 4) {
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y, vx: rnd(-1, 1) * spread, vy: rnd(-1, 1) * spread,
        life: 1, decay: rnd(0.02, 0.04),
        color, size: rnd(1.5, 3.5),
      });
    }
  }

  function addFloat(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  }

  /* ─ Level advance ─ */
  function nextLevel() {
    s.level++;
    const lv = initLevel(s.level);
    Object.assign(s, lv);
    s.px = 1 * TILE + TILE / 2;
    s.py = 1 * TILE + TILE / 2;
    s.score += 150;
    s.lightTarget = clamp(BASE_LIGHT - s.level * 4, 55, BASE_LIGHT);
    s.levelFlash = 30;
    onScore(s.score);
    addFloat(W / 2, H / 2, `Livello ${s.level + 1}`, P.exit);
  }

  /* ─ Update ─ */
  function update() {
    if (!s.running) return;
    s.frame++;
    if (s.iframe > 0) s.iframe--;
    if (s.flashCD > 0) s.flashCD--;
    if (s.flashTimer > 0) s.flashTimer--;
    if (s.levelFlash > 0) s.levelFlash--;

    // Smooth light radius
    s.lightTarget = s.flashTimer > 0 ? FLASH_LIGHT : clamp(BASE_LIGHT - s.level * 4, 55, BASE_LIGHT);
    s.lightRadius = lerp(s.lightRadius, s.lightTarget, s.flashTimer > 0 ? 0.3 : 0.08);

    // ── Input ──
    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my = 1;
    const joy = joystickRef.current;
    if (joy && joy.active) { mx += joy.dx; my += joy.dy; }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 1) { mx /= mag; my /= mag; }

    if (Math.abs(mx) > 0.1 || Math.abs(my) > 0.1) {
      s.faceDx = mx; s.faceDy = my;
    }

    const nx = s.px + mx * PLAYER_SPD;
    const ny = s.py + my * PLAYER_SPD;
    if (!wallAt(nx, s.py, 7)) s.px = nx;
    if (!wallAt(s.px, ny, 7)) s.py = ny;

    // ── Action: flashlight burst ──
    const wantFlash = keys[' '] || keys['Space'] || (actionBtnRef && actionBtnRef.current);
    if (wantFlash && s.flashCD === 0) {
      s.flashTimer = FLASH_DUR;
      s.flashCD = FLASH_CD;
      if (actionBtnRef) actionBtnRef.current = false;
      addParticles(s.px, s.py, '#FFE082', 12, 6);
      // Stun nearby ghosts
      for (const g of s.ghosts) {
        if (dist(s.px, s.py, g.x, g.y) < FLASH_LIGHT) {
          g.stunTimer = FLASH_STUN;
        }
      }
    }
    if (actionBtnRef && actionBtnRef.current) actionBtnRef.current = false;

    // ── Candies ──
    for (const c of s.candies) {
      if (c.collected) continue;
      c.pulse += 0.07;
      if (dist(s.px, s.py, c.x, c.y) < 15) {
        c.collected = true;
        const pts = c.type === 1 ? 25 : 15;
        s.score += pts;
        onScore(s.score);
        addParticles(c.x, c.y, c.type === 1 ? '#FFD740' : P.candy, 8);
        addFloat(c.x, c.y - 8, `+${pts}`, c.type === 1 ? '#FFD740' : P.candy);
      }
    }

    // Exit opens when all candy collected
    if (!s.exitOpen && s.candies.every(c => c.collected)) {
      s.exitOpen = true;
      addFloat(s.exitX, s.exitY - 14, 'USCITA!', P.exit);
    }

    // Exit collision
    if (s.exitOpen && dist(s.px, s.py, s.exitX, s.exitY) < 16) {
      nextLevel();
      return;
    }

    // ── Ghosts ──
    for (const g of s.ghosts) {
      g.pulse += 0.05;
      if (g.stunTimer > 0) { g.stunTimer--; continue; }
      g.moveTimer++;
      // Smarter pathfinding — head toward player with random jitter
      if (g.moveTimer % 50 === 0) {
        g.dir = Math.atan2(s.py - g.y, s.px - g.x) + rnd(-1.2, 1.2);
      }
      const gSpeed = g.speed * (0.8 + Math.sin(g.pulse * 0.5) * 0.2);
      g.x += Math.cos(g.dir) * gSpeed;
      g.y += Math.sin(g.dir) * gSpeed;
      g.x = clamp(g.x, TILE, (COLS - 1) * TILE);
      g.y = clamp(g.y, TILE, (ROWS - 1) * TILE);

      // Ghost trail
      if (s.frame % 3 === 0) {
        g.trail.push({ x: g.x, y: g.y, life: 1 });
        if (g.trail.length > 12) g.trail.shift();
      }
      for (const t of g.trail) t.life -= 0.04;

      // Player collision
      if (s.iframe === 0 && dist(s.px, s.py, g.x, g.y) < PR + 10) {
        s.hp--;
        s.iframe = IFRAME_DUR;
        s.screenShake = 10;
        onHpChange(s.hp, s.maxHp);
        addParticles(s.px, s.py, P.heart, 10);
        addFloat(s.px, s.py - 14, '-1 ♥', P.heart);
        if (s.hp <= 0) { s.running = false; return; }
      }
    }

    // ── Heal every 1000 pts ──
    const milestone = Math.floor(s.score / HEAL_THRESHOLD);
    if (milestone > s.lastHealMilestone) {
      s.lastHealMilestone = milestone;
      // Place heal on a random visible floor tile
      const floors = [];
      for (let y = 1; y < ROWS - 1; y++)
        for (let x = 1; x < COLS - 1; x++)
          if (s.grid[y][x] === 0) floors.push([x, y]);
      if (floors.length) {
        const [hx, hy] = floors[Math.floor(Math.random() * floors.length)];
        s.healItems.push({
          x: hx * TILE + TILE / 2, y: hy * TILE + TILE / 2,
          pulse: 0,
        });
      }
    }

    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.pulse += 0.08;
      if (dist(s.px, s.py, h.x, h.y) < 16) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, h.y, P.heal, 12);
        addFloat(h.x, h.y - 10, 'HP MAX', P.heal);
        s.healItems.splice(i, 1);
      }
    }

    // ── Pumpkins pulse ──
    for (const pk of s.pumpkins) pk.pulse += 0.04;

    // ── Fog ──
    for (const f of s.fog) {
      f.x += f.vx; f.y += f.vy;
      if (f.x < -60) f.x = COLS * TILE + 30;
      if (f.x > COLS * TILE + 60) f.x = -30;
      if (f.y < -60) f.y = ROWS * TILE + 30;
      if (f.y > ROWS * TILE + 60) f.y = -30;
    }

    // ── Particles ──
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.02;
      p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // ── Float texts ──
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.02;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    if (s.screenShake > 0) s.screenShake *= 0.85;
    if (s.screenShake < 0.3) s.screenShake = 0;
  }

  /* ─── Visibility helper — returns alpha for a world position ─── */
  function visAlpha(wx, wy, extra) {
    const d = dist(wx, wy, s.px, s.py);
    const r = s.lightRadius + (extra || 0);
    if (d > r) return 0;
    return clamp(1 - d / r, 0, 1);
  }

  /* ─── Draw ─── */
  function draw() {
    ctx.save();
    if (s.screenShake > 0) {
      ctx.translate(rnd(-1, 1) * s.screenShake * 2, rnd(-1, 1) * s.screenShake * 2);
    }

    // Background
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Maze tiles ──
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tx = x * TILE, ty = y * TILE;
        const cx = tx + TILE / 2, cy = ty + TILE / 2;
        const a = visAlpha(cx, cy, TILE);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        if (s.grid[y][x] === 1) {
          // Wall with 3D shading
          ctx.fillStyle = P.wall;
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = P.wallHi;
          ctx.fillRect(tx, ty, TILE, 4);
          ctx.fillStyle = P.wallEdge;
          ctx.fillRect(tx, ty + TILE - 2, TILE, 2);
          // Subtle brick pattern
          if ((x + y) % 3 === 0) {
            ctx.fillStyle = 'rgba(255,109,0,0.03)';
            ctx.fillRect(tx + 2, ty + 8, TILE - 4, 1);
          }
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? P.floor : P.floorAlt;
          ctx.fillRect(tx, ty, TILE, TILE);
          // Random cracks
          if ((x * 7 + y * 13) % 11 === 0) {
            ctx.fillStyle = P.floorCrack;
            ctx.fillRect(tx + 6, ty + 10, 12, 1);
            ctx.fillRect(tx + 14, ty + 10, 1, 8);
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // ── Pumpkins ──
    for (const pk of s.pumpkins) {
      const a = visAlpha(pk.x, pk.y, 20);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(pk.x, pk.y);
      const glow = 0.6 + Math.sin(pk.pulse) * 0.4;
      // Glow
      ctx.shadowColor = P.pumpkinGlow;
      ctx.shadowBlur = 12 * glow;
      // Body
      ctx.fillStyle = P.pumpkin;
      ctx.beginPath();
      ctx.ellipse(0, 0, pk.size, pk.size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dark stripe
      ctx.fillStyle = P.pumpkinDark;
      ctx.fillRect(-1, -pk.size * 0.7, 2, pk.size * 1.4);
      // Stem
      ctx.fillStyle = '#33691E';
      ctx.fillRect(-1.5, -pk.size * 0.8 - 3, 3, 4);
      // Face (triangle eyes + mouth)
      ctx.fillStyle = '#FFE082';
      ctx.globalAlpha = a * glow;
      ctx.beginPath();
      ctx.moveTo(-3, -2); ctx.lineTo(-1, -4); ctx.lineTo(1, -2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(1, -2); ctx.lineTo(3, -4); ctx.lineTo(5, -2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3, 2); ctx.lineTo(0, 1); ctx.lineTo(3, 2); ctx.lineTo(1, 4); ctx.lineTo(-1, 4);
      ctx.fill();
      ctx.restore();
    }

    // ── Candies ──
    for (const c of s.candies) {
      if (c.collected) continue;
      const a = visAlpha(c.x, c.y, 20);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      const bob = Math.sin(c.pulse) * 2.5;
      ctx.translate(c.x, c.y + bob);
      ctx.shadowColor = c.type === 1 ? 'rgba(255,215,64,0.5)' : P.candyGlow;
      ctx.shadowBlur = 10;
      if (c.type === 1) {
        // Golden candy — pentagon star shape
        ctx.fillStyle = '#FFD740';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
          const r2 = i % 2 === 0 ? 7 : 3.5;
          ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Regular candy — wrapped candy shape
        ctx.fillStyle = P.candy;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        // Wrapper twists
        ctx.strokeStyle = P.candy;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(-9, -3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5.5, 0); ctx.lineTo(9, 3); ctx.stroke();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(-1.5, -1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Heal items (green cross) ──
    for (const h of s.healItems) {
      const a = visAlpha(h.x, h.y, 20);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a * (0.7 + Math.sin(h.pulse) * 0.3);
      ctx.translate(h.x, h.y + Math.sin(h.pulse * 1.2) * 3);
      ctx.shadowColor = P.healGlow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = P.heal;
      // Cross shape
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
      // White center
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    }

    // ── Exit portal ──
    if (s.exitOpen) {
      const a = visAlpha(s.exitX, s.exitY, 35);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        const pulse = 0.6 + Math.sin(s.frame * 0.06) * 0.4;
        // Outer rings
        for (let r = 3; r >= 0; r--) {
          ctx.strokeStyle = P.exitRing;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(s.exitX, s.exitY, 14 + r * 5 + Math.sin(s.frame * 0.04 + r) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Portal core
        ctx.shadowColor = P.exitGlow;
        ctx.shadowBlur = 20 * pulse;
        const grad = ctx.createRadialGradient(s.exitX, s.exitY, 0, s.exitX, s.exitY, 12);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, P.exit);
        grad.addColorStop(1, 'rgba(118,255,3,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.exitX, s.exitY, 12 * pulse, 0, Math.PI * 2);
        ctx.fill();
        // Spinning particles around portal
        for (let i = 0; i < 4; i++) {
          const angle = s.frame * 0.05 + i * Math.PI / 2;
          const orbX = s.exitX + Math.cos(angle) * 16;
          const orbY = s.exitY + Math.sin(angle) * 16;
          ctx.fillStyle = P.exit;
          ctx.globalAlpha = a * 0.6;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // ── Ghost trails ──
    for (const g of s.ghosts) {
      for (const t of g.trail) {
        if (t.life <= 0) continue;
        const a = visAlpha(t.x, t.y, 40) * t.life * 0.4;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = P.ghostTrail;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── Ghosts ──
    for (const g of s.ghosts) {
      const a = visAlpha(g.x, g.y, 50);
      if (a <= 0) continue;
      const stunned = g.stunTimer > 0;
      const bob = Math.sin(g.pulse) * 3;
      ctx.save();
      ctx.globalAlpha = a * (stunned ? 0.25 : (0.55 + Math.sin(g.pulse) * 0.2));
      ctx.translate(g.x, g.y + bob);
      ctx.shadowColor = stunned ? '#FFE082' : P.ghostGlow;
      ctx.shadowBlur = stunned ? 15 : 10;
      ctx.fillStyle = stunned ? '#FFE082' : P.ghost;
      // Ghost body
      ctx.beginPath();
      ctx.arc(0, -4, 11, Math.PI, 0);
      ctx.lineTo(11, 8);
      // Wavy bottom
      for (let i = 0; i < 5; i++) {
        const wx = 11 - i * (22 / 4);
        const wave = i % 2 === 0 ? 4 : 0;
        ctx.lineTo(wx, 8 + wave + Math.sin(s.frame * 0.1 + i) * 1.5);
      }
      ctx.closePath();
      ctx.fill();
      // Eyes
      if (!stunned) {
        // Eye direction toward player
        const toPlayerAngle = Math.atan2(s.py - g.y, s.px - g.x);
        const eyeOff = 1.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-4, -4, 3.5, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(4, -4, 3.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(-4 + Math.cos(toPlayerAngle) * eyeOff, -4 + Math.sin(toPlayerAngle) * eyeOff, 2, 0, Math.PI * 2);
        ctx.arc(4 + Math.cos(toPlayerAngle) * eyeOff, -4 + Math.sin(toPlayerAngle) * eyeOff, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stunned spiral eyes
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1.5;
        for (const ex of [-4, 4]) {
          ctx.beginPath();
          ctx.moveTo(ex - 2, -6); ctx.lineTo(ex + 2, -2);
          ctx.moveTo(ex + 2, -6); ctx.lineTo(ex - 2, -2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Player ──
    ctx.save();
    if (s.iframe > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.3;
    // Directional flashlight cone (subtle)
    if (s.flashTimer > 0) {
      const angle = Math.atan2(s.faceDy, s.faceDx);
      ctx.save();
      ctx.globalAlpha = 0.08 * (s.flashTimer / FLASH_DUR);
      ctx.fillStyle = '#FFE082';
      ctx.beginPath();
      ctx.moveTo(s.px, s.py);
      ctx.arc(s.px, s.py, FLASH_LIGHT, angle - 0.5, angle + 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Player glow
    ctx.shadowColor = P.playerGlow;
    ctx.shadowBlur = 14;
    // Body
    ctx.fillStyle = P.player;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PR, 0, Math.PI * 2);
    ctx.fill();
    // Inner
    ctx.fillStyle = P.playerInner;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (direction-aware)
    const eAngle = Math.atan2(s.faceDy, s.faceDx);
    const eDist = 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.px + Math.cos(eAngle - 0.4) * eDist, s.py + Math.sin(eAngle - 0.4) * eDist, 2.2, 0, Math.PI * 2);
    ctx.arc(s.px + Math.cos(eAngle + 0.4) * eDist, s.py + Math.sin(eAngle + 0.4) * eDist, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath();
    ctx.arc(s.px + Math.cos(eAngle - 0.4) * (eDist + 0.8), s.py + Math.sin(eAngle - 0.4) * (eDist + 0.8), 1, 0, Math.PI * 2);
    ctx.arc(s.px + Math.cos(eAngle + 0.4) * (eDist + 0.8), s.py + Math.sin(eAngle + 0.4) * (eDist + 0.8), 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Fog layer ──
    for (const f of s.fog) {
      const a = visAlpha(f.x, f.y, 30);
      if (a <= 0) continue;
      ctx.globalAlpha = a * f.alpha;
      ctx.fillStyle = P.fog;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Flashlight vignette (the core darkness mechanic) ──
    // Radial gradient centered on player
    const vig = ctx.createRadialGradient(
      s.px, s.py, s.lightRadius * 0.35,
      s.px, s.py, s.lightRadius * 1.1,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.5, 'rgba(0,0,0,0.15)');
    vig.addColorStop(0.75, 'rgba(0,0,0,0.6)');
    vig.addColorStop(1, 'rgba(0,0,0,0.97)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Hard darkness outside light circle
    fogCtx.clearRect(0, 0, W, H);
    fogCtx.fillStyle = P.bg;
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.globalCompositeOperation = 'destination-out';
    const fogGrad = fogCtx.createRadialGradient(
      s.px, s.py, 0, s.px, s.py, s.lightRadius * 1.15,
    );
    fogGrad.addColorStop(0, 'rgba(0,0,0,1)');
    fogGrad.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = fogGrad;
    fogCtx.beginPath();
    fogCtx.arc(s.px, s.py, s.lightRadius * 1.15, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0);

    // Flash ring effect
    if (s.flashTimer > 0) {
      const flashAlpha = s.flashTimer / FLASH_DUR;
      ctx.strokeStyle = P.flashRing;
      ctx.lineWidth = 3;
      ctx.globalAlpha = flashAlpha * 0.5;
      ctx.beginPath();
      ctx.arc(s.px, s.py, FLASH_LIGHT * (1 - flashAlpha * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Particles (on top of darkness) ──
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
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // ── Level flash overlay ──
    if (s.levelFlash > 0) {
      ctx.globalAlpha = s.levelFlash / 30 * 0.15;
      ctx.fillStyle = P.exit;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // ── Edge vignette ──
    const edgeVig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
    edgeVig.addColorStop(0, 'rgba(0,0,0,0)');
    edgeVig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(0, 0, W, H);

    // ══════════ HUD ══════════
    // Background bar
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 38);
    ctx.fillStyle = 'rgba(255,109,0,0.08)';
    ctx.fillRect(0, 37, W, 1);

    // Hearts
    for (let i = 0; i < s.maxHp; i++) {
      const hx = 14 + i * 22, hy = 13;
      if (i < s.hp) {
        // Filled heart — draw heart shape
        ctx.save();
        ctx.fillStyle = P.heart;
        ctx.shadowColor = P.heart;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(hx, hy + 3);
        ctx.bezierCurveTo(hx, hy, hx - 6, hy - 2, hx - 6, hy + 2);
        ctx.bezierCurveTo(hx - 6, hy + 6, hx, hy + 9, hx, hy + 11);
        ctx.bezierCurveTo(hx, hy + 9, hx + 6, hy + 6, hx + 6, hy + 2);
        ctx.bezierCurveTo(hx + 6, hy - 2, hx, hy, hx, hy + 3);
        ctx.fill();
        ctx.restore();
      } else {
        // Empty heart
        ctx.save();
        ctx.strokeStyle = P.heartDim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx, hy + 3);
        ctx.bezierCurveTo(hx, hy, hx - 6, hy - 2, hx - 6, hy + 2);
        ctx.bezierCurveTo(hx - 6, hy + 6, hx, hy + 9, hx, hy + 11);
        ctx.bezierCurveTo(hx, hy + 9, hx + 6, hy + 6, hx + 6, hy + 2);
        ctx.bezierCurveTo(hx + 6, hy - 2, hx, hy, hx, hy + 3);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Score
    ctx.fillStyle = P.text;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${s.score}`, W - 14, 16);

    // Level
    ctx.fillStyle = P.textDim;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`Livello ${s.level + 1}`, W - 14, 30);

    // Candy counter (center)
    const collected = s.candies.filter(c => c.collected).length;
    ctx.textAlign = 'center';
    ctx.fillStyle = s.exitOpen ? P.exit : P.textDim;
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillText(
      s.exitOpen ? '🚪 Trova l\'uscita!' : `🍬 ${collected}/${s.candies.length}`,
      W / 2, 24,
    );

    // Flash cooldown indicator
    if (s.flashCD > 0) {
      const pct = s.flashCD / FLASH_CD;
      ctx.fillStyle = 'rgba(255,224,130,0.15)';
      ctx.fillRect(0, 37, W * (1 - pct), 2);
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ─── Game loop ─── */
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
