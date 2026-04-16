/**
 * OTTOBRE — Shadow Maze 🎃
 * Procedural maze with limited flashlight visibility.
 * Collect candy, avoid ghosts, find the exit.
 * Controls: joystick to move.
 */
export const meta = {
  name: 'Shadow Maze',
  emoji: '🎃',
  description: 'Esplora il labirinto oscuro, raccogli caramelle e fuggi dai fantasmi!',
  color: '#FF6F00',
  controls: 'joystick',
  instructions: 'Muoviti con WASD/frecce o joystick. Raccogli le caramelle 🍬 ed evita i fantasmi 👻! Trova l\'uscita per avanzare.',
  gameOverTitle: 'I fantasmi ti hanno preso!',
  actionLabel: '🔦',
};

const W = 480, H = 480;
const TILE = 32;
const COLS = 15, ROWS = 15;
const PLAYER_R = 10;
const LIGHT_RADIUS = 90;

const C = {
  dark: '#0a0a0a',
  wall: '#2a1a10',
  wallTop: '#3a2a18',
  floor: '#1a1208',
  floorAlt: '#161008',
  player: '#FF6F00', playerDark: '#E65100',
  candy: '#FF4081', candyGlow: 'rgba(255,64,129,0.4)',
  ghost: '#B2EBF2', ghostGlow: 'rgba(178,235,242,0.3)',
  exit: '#76FF03', exitGlow: 'rgba(118,255,3,0.4)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  pumpkin: '#FF6F00',
};

function generateMaze(cols, rows) {
  // DFS maze generation
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [];
  const startX = 1, startY = 1;
  grid[startY][startX] = 0;
  visited[startY][startX] = true;
  stack.push([startX, startY]);

  const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && !visited[ny][nx]) {
        neighbors.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
    }
    if (neighbors.length > 0) {
      const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
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

export function createGame(canvas, { keysRef, joystickRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  function initLevel(levelNum) {
    const grid = generateMaze(COLS, ROWS);

    // Place candies on floor tiles
    const candies = [];
    const floorTiles = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (grid[y][x] === 0 && !(x === 1 && y === 1)) {
          floorTiles.push([x, y]);
        }
      }
    }
    // Shuffle and pick some for candies
    for (let i = floorTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [floorTiles[i], floorTiles[j]] = [floorTiles[j], floorTiles[i]];
    }
    const candyCount = Math.min(5 + levelNum, 12);
    for (let i = 0; i < Math.min(candyCount, floorTiles.length); i++) {
      candies.push({
        x: floorTiles[i][0] * TILE + TILE / 2,
        y: floorTiles[i][1] * TILE + TILE / 2,
        collected: false,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // Place exit at far corner
    let exitX = COLS - 2, exitY = ROWS - 2;
    // Make sure exit is on floor
    while (grid[exitY][exitX] === 1 && exitX > 1) exitX--;
    if (grid[exitY][exitX] === 1) { exitY--; exitX = COLS - 2; }

    // Place ghosts
    const ghosts = [];
    const ghostCount = Math.min(1 + Math.floor(levelNum / 2), 5);
    for (let i = 0; i < ghostCount; i++) {
      const idx = candyCount + i;
      if (idx < floorTiles.length) {
        ghosts.push({
          x: floorTiles[idx][0] * TILE + TILE / 2,
          y: floorTiles[idx][1] * TILE + TILE / 2,
          dir: Math.random() * Math.PI * 2,
          moveTimer: 0,
          pulse: Math.random() * Math.PI * 2,
          speed: 0.6 + levelNum * 0.1,
        });
      }
    }

    return {
      grid, candies, ghosts,
      exitX: exitX * TILE + TILE / 2,
      exitY: exitY * TILE + TILE / 2,
      exitOpen: false,
    };
  }

  const level = initLevel(0);
  const state = {
    px: 1 * TILE + TILE / 2,
    py: 1 * TILE + TILE / 2,
    score: 0,
    hp: 3, maxHp: 3,
    level: 0,
    ...level,
    particles: [],
    running: true,
    frame: 0,
    iframe: 0,
    screenShake: 0,
    lightRadius: LIGHT_RADIUS,
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  function wallAt(px, py, r) {
    const checks = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    for (const [cx, cy] of checks) {
      const gx = Math.floor(cx / TILE), gy = Math.floor(cy / TILE);
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if (state.grid[gy][gx] === 1) return true;
    }
    return false;
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  function nextLevel() {
    state.level++;
    const lv = initLevel(state.level);
    Object.assign(state, lv);
    state.px = 1 * TILE + TILE / 2;
    state.py = 1 * TILE + TILE / 2;
    state.score += 100;
    state.lightRadius = Math.max(60, LIGHT_RADIUS - state.level * 3);
    onScore(state.score);
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    if (state.iframe > 0) state.iframe--;

    // Input
    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my = 1;
    const joy = joystickRef.current;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 1) { mx /= mag; my /= mag; }

    const spd = 2.2;
    const nx = state.px + mx * spd;
    const ny = state.py + my * spd;
    if (!wallAt(nx, state.py, 8)) state.px = nx;
    if (!wallAt(state.px, ny, 8)) state.py = ny;

    // Candies
    for (const c of state.candies) {
      if (c.collected) continue;
      c.pulse += 0.06;
      const dx = state.px - c.x, dy = state.py - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        c.collected = true;
        state.score += 15;
        onScore(state.score);
        addParticles(c.x, c.y, C.candy, 6);
      }
    }

    // Check if exit opens
    if (!state.exitOpen && state.candies.every(c => c.collected)) {
      state.exitOpen = true;
    }

    // Exit collision
    if (state.exitOpen) {
      const dx = state.px - state.exitX, dy = state.py - state.exitY;
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        nextLevel();
        return;
      }
    }

    // Ghosts
    for (const g of state.ghosts) {
      g.pulse += 0.04;
      g.moveTimer++;
      if (g.moveTimer % 40 === 0) {
        g.dir = Math.atan2(state.py - g.y, state.px - g.x) + (Math.random() - 0.5) * 1.5;
      }
      // Ghosts phase through walls
      g.x += Math.cos(g.dir) * g.speed;
      g.y += Math.sin(g.dir) * g.speed;
      g.x = Math.max(TILE, Math.min(g.x, (COLS - 1) * TILE));
      g.y = Math.max(TILE, Math.min(g.y, (ROWS - 1) * TILE));

      if (state.iframe === 0) {
        const dx = state.px - g.x, dy = state.py - g.y;
        if (Math.sqrt(dx * dx + dy * dy) < PLAYER_R + 10) {
          state.hp--;
          state.iframe = 60;
          state.screenShake = 8;
          onHpChange(state.hp, state.maxHp);
          addParticles(state.px, state.py, C.heart, 6);
          if (state.hp <= 0) { state.running = false; return; }
        }
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    if (state.screenShake > 0) state.screenShake--;
  }

  function draw() {
    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * state.screenShake * 2,
        (Math.random() - 0.5) * state.screenShake * 2,
      );
    }

    // Dark background
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, 0, W, H);

    // Draw maze tiles
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tx = x * TILE, ty = y * TILE;
        const dx = (x * TILE + TILE / 2) - state.px;
        const dy = (y * TILE + TILE / 2) - state.py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const visible = dist < state.lightRadius + TILE;

        if (!visible) continue;

        const alpha = Math.max(0, 1 - dist / (state.lightRadius + TILE));

        ctx.globalAlpha = alpha;
        if (state.grid[y][x] === 1) {
          ctx.fillStyle = C.wall;
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = C.wallTop;
          ctx.fillRect(tx, ty, TILE, 3);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? C.floor : C.floorAlt;
          ctx.fillRect(tx, ty, TILE, TILE);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Candies
    for (const c of state.candies) {
      if (c.collected) continue;
      const dist = Math.sqrt((c.x - state.px) ** 2 + (c.y - state.py) ** 2);
      if (dist > state.lightRadius + 20) continue;
      const alpha = Math.max(0, 1 - dist / (state.lightRadius + 20));
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.shadowColor = C.candyGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = C.candy;
      ctx.beginPath();
      ctx.arc(c.x, c.y + Math.sin(c.pulse) * 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(c.x, c.y + Math.sin(c.pulse) * 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Exit
    if (state.exitOpen) {
      const dist = Math.sqrt((state.exitX - state.px) ** 2 + (state.exitY - state.py) ** 2);
      if (dist < state.lightRadius + 30) {
        const alpha = Math.max(0, 1 - dist / (state.lightRadius + 30));
        ctx.globalAlpha = alpha;
        const pulse = 0.6 + Math.sin(state.frame * 0.08) * 0.3;
        ctx.save();
        ctx.shadowColor = C.exitGlow;
        ctx.shadowBlur = 14 * pulse;
        ctx.fillStyle = C.exit;
        ctx.beginPath();
        ctx.arc(state.exitX, state.exitY, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(state.exitX, state.exitY, 4 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // Ghosts
    for (const g of state.ghosts) {
      const dist = Math.sqrt((g.x - state.px) ** 2 + (g.y - state.py) ** 2);
      const vis = Math.max(0, 1 - dist / (state.lightRadius + 40));
      if (vis <= 0) continue;
      ctx.save();
      ctx.globalAlpha = vis * (0.5 + Math.sin(g.pulse) * 0.2);
      ctx.shadowColor = C.ghostGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = C.ghost;
      ctx.translate(g.x, g.y + Math.sin(g.pulse) * 2);
      ctx.beginPath();
      ctx.arc(0, -3, 10, Math.PI, 0);
      ctx.lineTo(10, 7);
      for (let wx = 10; wx >= -10; wx -= 5) {
        ctx.lineTo(wx, 7 + (wx % 10 === 0 ? 4 : 0));
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Player
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PLAYER_R * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.px - 2.5, state.py - 2, 2, 0, Math.PI * 2);
    ctx.arc(state.px + 2.5, state.py - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Flashlight vignette overlay
    const vig = ctx.createRadialGradient(state.px, state.py, state.lightRadius * 0.5, state.px, state.py, state.lightRadius);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    vig.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Dark edges
    ctx.fillStyle = C.dark;
    // Top
    ctx.fillRect(0, 0, W, Math.max(0, state.py - state.lightRadius));
    // Bottom
    const bottomStart = state.py + state.lightRadius;
    if (bottomStart < H) ctx.fillRect(0, bottomStart, W, H - bottomStart);

    // Particles (drawn on top of vignette for visibility)
    for (const p of state.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // HUD
    for (let i = 0; i < state.maxHp; i++) {
      ctx.fillStyle = i < state.hp ? C.heart : 'rgba(255,0,80,0.2)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('♥', 12 + i * 18, 20);
    }
    ctx.fillStyle = C.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`Livello ${state.level + 1}`, W - 12, 34);
    // Candy counter
    const collected = state.candies.filter(c => c.collected).length;
    ctx.fillText(`🍬 ${collected}/${state.candies.length}`, W - 12, 48);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  function gameLoop() {
    update();
    draw();
    if (state.running) {
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      onGameOver(state.score);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);

  return function cleanup() {
    state.running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
