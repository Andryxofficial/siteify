/**
 * APRILE — Andryx Quest ⚔️
 * Mini Zelda-like dungeon crawler.
 * Explore rooms, defeat enemies, collect gems, advance through portals.
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Andryx Quest',
  emoji: '⚔️',
  description: 'Esplora i dungeon, sconfiggi i nemici e raccogli le gemme!',
  color: '#00f5d4',
  controls: 'joystick', // joystick + attack button
  instructions: 'Muoviti con WASD/frecce o joystick. Attacca con Spazio o il pulsante ⚔️. Sconfiggi tutti i nemici per aprire il portale!',
  gameOverTitle: 'Sei caduto!',
  actionLabel: '⚔️',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const TILE = 32;
const COLS = W / TILE; // 15
const ROWS = H / TILE; // 15
const PLAYER_SPD = 2.4;
const ATTACK_DUR = 12;
const ATTACK_RANGE = 28;
const IFRAME_DUR = 40;
const ATTACK_HIT_RADIUS = 24;
const ENEMY_COLLISION_RADIUS = 18;
const GEM_COLLECT_RADIUS = 16;
const EXIT_PORTAL_RADIUS = 20;

const ENEMY_STATS = {
  slime: { hp: 1, spd: 0.6, points: 10 },
  bat:   { hp: 1, spd: 1.2, points: 20 },
  ghost: { hp: 2, spd: 0.8, points: 30 },
};

const C = {
  bg: '#0d1117',
  floor: '#1a1f2e',
  floorAlt: '#161b27',
  wall: '#2d3548',
  wallTop: '#3a4560',
  player: '#00f5d4',
  playerDark: '#00c4a8',
  sword: '#f0ecf4',
  swordGlow: 'rgba(0,245,212,0.6)',
  gem: '#FF00D4',
  gemGlow: 'rgba(255,0,212,0.5)',
  heart: '#FF0050',
  heartGlow: 'rgba(255,0,80,0.4)',
  slime: '#7c3aed',
  slimeGlow: 'rgba(124,58,237,0.4)',
  bat: '#f59e0b',
  batGlow: 'rgba(245,158,11,0.4)',
  ghost: '#06b6d4',
  ghostGlow: 'rgba(6,182,212,0.4)',
  text: '#f0ecf4',
  textMuted: '#a8a3b3',
  exit: '#FFD700',
  exitGlow: 'rgba(255,215,0,0.4)',
  particle: '#FF00D4',
};

/* ─── Helpers ─── */
function generateRoom(roomNum) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) { grid[0][x] = 1; grid[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { grid[y][0] = 1; grid[y][COLS - 1] = 1; }
  const wallCount = 6 + Math.min(roomNum * 2, 14);
  for (let i = 0; i < wallCount; i++) {
    const x = 2 + Math.floor(Math.random() * (COLS - 4));
    const y = 2 + Math.floor(Math.random() * (ROWS - 4));
    grid[y][x] = 1;
    if (Math.random() < 0.5) {
      const dx = Math.random() < 0.5 ? 1 : 0;
      const dy = dx === 0 ? 1 : 0;
      if (y + dy < ROWS - 1 && x + dx < COLS - 1) grid[y + dy][x + dx] = 1;
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sy = ROWS - 3 + dy, sx = 2 + dx;
      const ey = 2 + dy, ex = COLS - 3 + dx;
      if (sy > 0 && sy < ROWS - 1 && sx > 0 && sx < COLS - 1) grid[sy][sx] = 0;
      if (ey > 0 && ey < ROWS - 1 && ex > 0 && ex < COLS - 1) grid[ey][ex] = 0;
    }
  }
  return grid;
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
      x = 2 + Math.floor(Math.random() * (COLS - 4));
      y = 2 + Math.floor(Math.random() * (ROWS - 4));
      tries++;
    } while ((grid[y][x] === 1 || (x < 4 && y > ROWS - 5)) && tries < 50);
    if (tries >= 50) continue;
    const type = types[Math.floor(Math.random() * types.length)];
    const baseHp = ENEMY_STATS[type].hp;
    const spd = ENEMY_STATS[type].spd;
    enemies.push({
      type, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
      hp: baseHp + Math.floor(roomNum / 3),
      maxHp: baseHp + Math.floor(roomNum / 3),
      spd: spd + roomNum * 0.04,
      dir: Math.random() * Math.PI * 2,
      moveTimer: 0, hitFlash: 0, dead: false,
      pulse: Math.random() * Math.PI * 2,
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
      x = 1 + Math.floor(Math.random() * (COLS - 2));
      y = 1 + Math.floor(Math.random() * (ROWS - 2));
      tries++;
    } while (grid[y][x] === 1 && tries < 40);
    if (tries >= 40) continue;
    gems.push({
      x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
      collected: false, pulse: Math.random() * Math.PI * 2,
    });
  }
  return gems;
}

/* ─── Main game function ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  const w = W, h = H;
  let animFrame = null;

  function initRoom(rn) {
    const grid = generateRoom(rn);
    return {
      grid,
      enemies: spawnEnemies(rn, grid),
      gems: spawnGems(rn, grid),
      exitOpen: false,
      exitX: (COLS - 3) * TILE + TILE / 2,
      exitY: 2 * TILE + TILE / 2,
    };
  }

  const room = initRoom(0);
  const state = {
    px: 2 * TILE + TILE / 2,
    py: (ROWS - 3) * TILE + TILE / 2,
    pdir: 0,
    hp: 5, maxHp: 5,
    score: 0, roomNum: 0,
    attacking: 0, iframe: 0,
    ...room,
    particles: [], floatTexts: [],
    running: true, frame: 0,
    screenShake: 0, transition: 0,
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  function wallAt(px, py, radius) {
    const r = radius || 10;
    const checks = [
      [px - r, py - r], [px + r, py - r],
      [px - r, py + r], [px + r, py + r],
    ];
    for (const [cx, cy] of checks) {
      const gx = Math.floor(cx / TILE);
      const gy = Math.floor(cy / TILE);
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if (state.grid[gy][gx] === 1) return true;
    }
    return false;
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1, decay: 0.025 + Math.random() * 0.03,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function enterNextRoom() {
    state.transition = 30;
    state.roomNum++;
    const room = initRoom(state.roomNum);
    Object.assign(state, room);
    state.px = 2 * TILE + TILE / 2;
    state.py = (ROWS - 3) * TILE + TILE / 2;
    state.score += 100;
    state.hp = Math.min(state.hp + 1, state.maxHp);
    onScore(state.score);
    onHpChange(state.hp, state.maxHp);
  }

  function getAttackPos() {
    const dist = ATTACK_RANGE;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirs[state.pdir];
    return { x: state.px + dx * dist, y: state.py + dy * dist };
  }

  /* ─── Update ─── */
  function update() {
    if (!state.running) return;
    state.frame++;

    if (state.transition > 0) { state.transition--; return; }

    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
    const joy = joystickRef.current;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 0) {
      mx /= mag; my /= mag;
      if (Math.abs(mx) > Math.abs(my)) state.pdir = mx > 0 ? 0 : 2;
      else state.pdir = my > 0 ? 1 : 3;
    }

    const nx = state.px + mx * PLAYER_SPD;
    const ny = state.py + my * PLAYER_SPD;
    if (!wallAt(nx, state.py)) state.px = nx;
    if (!wallAt(state.px, ny)) state.py = ny;

    // Attack
    if (state.attacking > 0) state.attacking--;
    if ((keys[' '] || keys['Space'] || actionBtnRef.current) && state.attacking === 0) {
      state.attacking = ATTACK_DUR;
      const ap = getAttackPos();
      for (const e of state.enemies) {
        if (e.dead) continue;
        const dx = e.x - ap.x, dy = e.y - ap.y;
        if (Math.sqrt(dx * dx + dy * dy) < ATTACK_HIT_RADIUS) {
          e.hp--;
          e.hitFlash = 8;
          addParticles(e.x, e.y, '#fff', 4);
          state.screenShake = 4;
          if (e.hp <= 0) {
            e.dead = true;
            const pts = ENEMY_STATS[e.type].points;
            state.score += pts;
            onScore(state.score);
            addParticles(e.x, e.y, C[e.type + 'Glow'] || C.particle, 10);
            addFloatText(e.x, e.y - 10, `+${pts}`, C[e.type]);
          }
        }
      }
      actionBtnRef.current = false;
    }

    if (state.iframe > 0) state.iframe--;

    // Enemies
    for (const e of state.enemies) {
      if (e.dead) continue;
      e.pulse = (e.pulse + 0.06) % (Math.PI * 2);
      if (e.hitFlash > 0) e.hitFlash--;
      e.moveTimer++;

      if (e.type === 'slime') {
        if (e.moveTimer % 60 === 0) {
          e.dir = Math.atan2(state.py - e.y, state.px - e.x) + (Math.random() - 0.5) * 1.2;
        }
        if (e.moveTimer % 3 === 0) {
          const enx = e.x + Math.cos(e.dir) * e.spd;
          const eny = e.y + Math.sin(e.dir) * e.spd;
          if (!wallAt(enx, e.y, 8)) e.x = enx;
          if (!wallAt(e.x, eny, 8)) e.y = eny;
        }
      } else if (e.type === 'bat') {
        if (e.moveTimer % 30 === 0) {
          e.dir = Math.atan2(state.py - e.y, state.px - e.x) + (Math.random() - 0.5) * 0.8;
        }
        const enx = e.x + Math.cos(e.dir) * e.spd;
        const eny = e.y + Math.sin(e.dir) * e.spd;
        if (!wallAt(enx, e.y, 6)) e.x = enx;
        if (!wallAt(e.x, eny, 6)) e.y = eny;
      } else if (e.type === 'ghost') {
        if (e.moveTimer % 45 === 0) {
          e.dir = Math.atan2(state.py - e.y, state.px - e.x);
        }
        e.x += Math.cos(e.dir) * e.spd;
        e.y += Math.sin(e.dir) * e.spd;
        e.x = Math.max(TILE, Math.min(e.x, w - TILE));
        e.y = Math.max(TILE, Math.min(e.y, h - TILE));
      }

      // Collision
      if (state.iframe === 0) {
        const dx = state.px - e.x, dy = state.py - e.y;
        if (Math.sqrt(dx * dx + dy * dy) < ENEMY_COLLISION_RADIUS) {
          state.hp--;
          state.iframe = IFRAME_DUR;
          state.screenShake = 8;
          addParticles(state.px, state.py, C.heart, 6);
          onHpChange(state.hp, state.maxHp);
          if (state.hp <= 0) {
            state.running = false;
          }
        }
      }
    }

    // Gems
    for (const g of state.gems) {
      if (g.collected) continue;
      g.pulse = (g.pulse + 0.05) % (Math.PI * 2);
      const dx = state.px - g.x, dy = state.py - g.y;
      if (Math.sqrt(dx * dx + dy * dy) < GEM_COLLECT_RADIUS) {
        g.collected = true;
        state.score += 15;
        onScore(state.score);
        addParticles(g.x, g.y, C.gem, 6);
        addFloatText(g.x, g.y - 10, '+15', C.gem);
      }
    }

    if (!state.exitOpen && state.enemies.every(e => e.dead)) {
      state.exitOpen = true;
    }

    if (state.exitOpen) {
      const dx = state.px - state.exitX, dy = state.py - state.exitY;
      if (Math.sqrt(dx * dx + dy * dy) < EXIT_PORTAL_RADIUS) {
        enterNextRoom();
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Float texts
    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const ft = state.floatTexts[i];
      ft.y -= 0.8; ft.life -= 0.025;
      if (ft.life <= 0) state.floatTexts.splice(i, 1);
    }

    if (state.screenShake > 0) state.screenShake--;
  }

  /* ─── Draw ─── */
  function draw() {
    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * state.screenShake * 2,
        (Math.random() - 0.5) * state.screenShake * 2,
      );
    }

    if (state.transition > 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1 - state.transition / 30;
    }

    // Floor + walls
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tx = x * TILE, ty = y * TILE;
        if (state.grid[y][x] === 1) {
          ctx.fillStyle = C.wall;
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = C.wallTop;
          ctx.fillRect(tx, ty, TILE, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx + 0.5, ty + 0.5, TILE - 1, TILE - 1);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? C.floor : C.floorAlt;
          ctx.fillRect(tx, ty, TILE, TILE);
          if ((x + y) % 3 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.beginPath();
            ctx.arc(tx + TILE / 2, ty + TILE / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Exit portal
    if (state.exitOpen) {
      const pulse = 0.7 + Math.sin(state.frame * 0.08) * 0.3;
      ctx.save();
      ctx.shadowColor = C.exitGlow;
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = C.exit;
      ctx.beginPath();
      ctx.arc(state.exitX, state.exitY, 12 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.exitX, state.exitY, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = C.exit;
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', state.exitX, state.exitY - 18 + Math.sin(state.frame * 0.1) * 3);
    }

    // Gems
    for (const g of state.gems) {
      if (g.collected) continue;
      const glow = 0.6 + Math.sin(g.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = C.gemGlow;
      ctx.shadowBlur = 10 * glow;
      ctx.fillStyle = C.gem;
      ctx.translate(g.x, g.y + Math.sin(g.pulse * 1.5) * 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }

    // Enemies
    for (const e of state.enemies) {
      if (e.dead) continue;
      const glow = 0.6 + Math.sin(e.pulse) * 0.25;
      ctx.save();
      if (e.hitFlash > 0) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fff';
      } else {
        ctx.shadowColor = C[e.type + 'Glow'];
        ctx.shadowBlur = 8 * glow;
        ctx.fillStyle = C[e.type];
      }

      if (e.type === 'slime') {
        const squish = 1 + Math.sin(e.pulse * 2) * 0.15;
        ctx.translate(e.x, e.y);
        ctx.scale(squish, 2 - squish);
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4, -4, 3, 4);
        ctx.fillRect(2, -4, 3, 4);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-3, -2, 2, 3);
        ctx.fillRect(3, -2, 2, 3);
      } else if (e.type === 'bat') {
        const wing = Math.sin(e.pulse * 3) * 0.4;
        ctx.translate(e.x, e.y + Math.sin(e.pulse * 2) * 3);
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.quadraticCurveTo(-16, -10 + wing * 15, -12, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, -2);
        ctx.quadraticCurveTo(16, -10 + wing * 15, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4, -3, 2, 2);
        ctx.fillRect(2, -3, 2, 2);
      } else if (e.type === 'ghost') {
        ctx.globalAlpha = 0.6 + Math.sin(e.pulse) * 0.2;
        ctx.translate(e.x, e.y + Math.sin(e.pulse) * 3);
        ctx.beginPath();
        ctx.arc(0, -3, 10, Math.PI, 0);
        ctx.lineTo(10, 8);
        for (let wx = 10; wx >= -10; wx -= 5) {
          ctx.lineTo(wx, 8 + (wx % 10 === 0 ? 4 : 0));
        }
        ctx.closePath();
        ctx.fill();
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
      ctx.restore();

      if (e.hp < e.maxHp && !e.dead) {
        const barW = 20, barH = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - barW / 2, e.y - 18, barW, barH);
        ctx.fillStyle = C.heart;
        ctx.fillRect(e.x - barW / 2, e.y - 18, barW * (e.hp / e.maxHp), barH);
      }
    }

    // Player
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 12;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(state.px, state.py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(state.px, state.py, 7, 0, Math.PI * 2);
    ctx.fill();
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [fdx, fdy] = dirs[state.pdir];
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.px + fdx * 4 - fdy * 2.5, state.py + fdy * 4 + fdx * 2.5, 2, 0, Math.PI * 2);
    ctx.arc(state.px + fdx * 4 + fdy * 2.5, state.py + fdy * 4 - fdx * 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Attack swing
    if (state.attacking > 0) {
      const ap = getAttackPos();
      const progress = 1 - state.attacking / ATTACK_DUR;
      const angle = state.pdir * Math.PI / 2 + (progress - 0.5) * Math.PI * 0.8;
      ctx.save();
      ctx.shadowColor = C.swordGlow;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = C.sword;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(state.px, state.py);
      ctx.lineTo(ap.x + Math.cos(angle) * 8, ap.y + Math.sin(angle) * 8);
      ctx.stroke();
      ctx.strokeStyle = `rgba(0,245,212,${0.6 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.px, state.py, ATTACK_RANGE, angle - 0.6, angle + 0.6);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of state.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Float texts
    for (const ft of state.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
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
    ctx.fillText(`✦ ${state.score}`, w - 12, 18);
    ctx.fillStyle = C.textMuted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`Stanza ${state.roomNum + 1}`, w - 12, 34);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  /* ─── Loop ─── */
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
