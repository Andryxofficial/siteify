/**
 * GENNAIO — Frost Dash ❄️
 * Endless side-scroller on ice. Jump over obstacles, collect snowflakes.
 * Controls: tap/space to jump.
 */
export const meta = {
  name: 'Frost Dash',
  emoji: '❄️',
  description: 'Corri sul ghiaccio, salta gli ostacoli e raccogli i cristalli!',
  color: '#4FC3F7',
  controls: 'tap',
  instructions: 'Premi Spazio o tocca lo schermo per saltare. Evita gli ostacoli di ghiaccio!',
  gameOverTitle: 'Scivolato!',
  actionLabel: '🦘',
};

const W = 480, H = 480;
const GRAVITY = 0.55;
const JUMP_FORCE = -10;
const GROUND_Y = H - 80;
const PLAYER_X = 80;
const PLAYER_SIZE = 24;

const C = {
  bg1: '#0a1628', bg2: '#0f2240',
  ground: '#1a3a5c', groundTop: '#2a5a8c',
  player: '#4FC3F7', playerDark: '#0288D1',
  snow: '#ffffff', crystal: '#E1F5FE',
  obstacle: '#1565C0', obstacleDark: '#0D47A1',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  particle: '#81D4FA',
};

export function createGame(canvas, { keysRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  const state = {
    py: GROUND_Y - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    score: 0,
    distance: 0,
    hp: 3,
    maxHp: 3,
    speed: 3.5,
    running: true,
    frame: 0,
    obstacles: [],
    crystals: [],
    particles: [],
    snowflakes: [],
    screenShake: 0,
    iframe: 0,
    nextObstacle: 120,
    nextCrystal: 80,
    jumpPressed: false,
    lastHealAt: 0,
    healItems: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Pre-generate background snowflakes
  for (let i = 0; i < 40; i++) {
    state.snowflakes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 1 + Math.random() * 2.5,
      speed: 0.2 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.3,
    });
  }

  function spawnObstacle() {
    const h = 25 + Math.random() * 35;
    state.obstacles.push({
      x: W + 20,
      w: 18 + Math.random() * 14,
      h,
      y: GROUND_Y - h,
    });
    state.nextObstacle = 80 + Math.random() * 100 - Math.min(state.distance / 200, 40);
    if (state.nextObstacle < 50) state.nextObstacle = 50;
  }

  function spawnCrystal() {
    const flyHeight = Math.random() < 0.4;
    state.crystals.push({
      x: W + 20,
      y: flyHeight ? GROUND_Y - 90 - Math.random() * 60 : GROUND_Y - 30 - Math.random() * 20,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
    state.nextCrystal = 60 + Math.random() * 80;
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 4,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    state.distance += state.speed;
    state.speed = 3.5 + Math.min(state.distance / 600, 4);

    // Jump input
    const wantJump = keysRef.current[' '] || keysRef.current['Space'] ||
                     keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W'] ||
                     actionBtnRef.current;
    if (wantJump && !state.jumpPressed && state.onGround) {
      state.vy = JUMP_FORCE;
      state.onGround = false;
      state.jumpPressed = true;
      addParticles(PLAYER_X, GROUND_Y, C.particle, 4);
    }
    if (!wantJump) {
      state.jumpPressed = false;
      actionBtnRef.current = false;
    }

    // Physics
    state.vy += GRAVITY;
    state.py += state.vy;
    if (state.py >= GROUND_Y - PLAYER_SIZE) {
      state.py = GROUND_Y - PLAYER_SIZE;
      state.vy = 0;
      state.onGround = true;
    }

    // Score from distance
    const newScore = Math.floor(state.distance / 10);
    if (newScore !== state.score) {
      state.score = newScore;
      onScore(state.score);
    }

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(state.score / 1000);
    if (healMilestone > state.lastHealAt && state.hp < state.maxHp) {
      state.lastHealAt = healMilestone;
      state.healItems.push({
        x: W + 20,
        y: GROUND_Y - 40 - Math.random() * 60,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // iframes
    if (state.iframe > 0) state.iframe--;

    // Spawn
    state.nextObstacle--;
    if (state.nextObstacle <= 0) spawnObstacle();
    state.nextCrystal--;
    if (state.nextCrystal <= 0) spawnCrystal();

    // Move obstacles
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.x -= state.speed;
      if (o.x + o.w < -10) { state.obstacles.splice(i, 1); continue; }

      // Collision with player
      if (state.iframe === 0) {
        const px = PLAYER_X, py = state.py;
        const pw = PLAYER_SIZE * 0.7, ph = PLAYER_SIZE;
        if (px + pw > o.x && px < o.x + o.w && py + ph > o.y && py < o.y + o.h) {
          state.hp--;
          state.iframe = 60;
          state.screenShake = 8;
          onHpChange(state.hp, state.maxHp);
          addParticles(PLAYER_X + PLAYER_SIZE / 2, state.py + PLAYER_SIZE / 2, C.heart, 6);
          if (state.hp <= 0) {
            state.running = false;
          }
        }
      }
    }

    // Move crystals
    for (let i = state.crystals.length - 1; i >= 0; i--) {
      const c = state.crystals[i];
      c.x -= state.speed;
      c.pulse += 0.06;
      if (c.x < -20) { state.crystals.splice(i, 1); continue; }
      if (c.collected) continue;

      const dx = (PLAYER_X + PLAYER_SIZE / 2) - c.x;
      const dy = (state.py + PLAYER_SIZE / 2) - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        c.collected = true;
        state.score += 50;
        onScore(state.score);
        addParticles(c.x, c.y, C.crystal, 6);
      }
    }

    // Heal items
    for (let i = state.healItems.length - 1; i >= 0; i--) {
      const h = state.healItems[i];
      h.x -= state.speed;
      h.pulse += 0.08;
      if (h.x < -20) { state.healItems.splice(i, 1); continue; }
      const dx = (PLAYER_X + PLAYER_SIZE / 2) - h.x;
      const dy = (state.py + PLAYER_SIZE / 2) - h.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        state.hp = state.maxHp;
        onHpChange(state.hp, state.maxHp);
        addParticles(h.x, h.y, '#FF0050', 8);
        state.healItems.splice(i, 1);
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.1;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Snowflakes
    for (const s of state.snowflakes) {
      s.y += s.speed;
      s.x += s.drift;
      if (s.y > H) { s.y = -5; s.x = Math.random() * W; }
      if (s.x < 0) s.x = W;
      if (s.x > W) s.x = 0;
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

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.bg1);
    grad.addColorStop(1, C.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + state.frame * 0.1) % W);
      const sy = (i * 91 + 20) % (GROUND_Y - 40);
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snowflakes
    for (const s of state.snowflakes) {
      ctx.globalAlpha = 0.4 + s.size / 5;
      ctx.fillStyle = C.snow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = C.groundTop;
    ctx.fillRect(0, GROUND_Y, W, 4);
    // Ground texture
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < W; x += 24) {
      ctx.fillRect(x + ((state.frame * state.speed) % 24), GROUND_Y + 8, 12, 2);
    }

    // Obstacles
    for (const o of state.obstacles) {
      ctx.fillStyle = C.obstacle;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = C.obstacleDark;
      ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
      // Ice shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(o.x + 3, o.y + 3, 4, o.h * 0.6);
    }

    // Crystals
    for (const c of state.crystals) {
      if (c.collected) continue;
      const glow = 0.6 + Math.sin(c.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = C.crystal;
      ctx.shadowBlur = 10 * glow;
      ctx.fillStyle = C.crystal;
      ctx.translate(c.x, c.y + Math.sin(c.pulse * 1.5) * 3);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }

    // Heal items
    for (const h of state.healItems) {
      const glow = 0.6 + Math.sin(h.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = 'rgba(255,0,80,0.5)';
      ctx.shadowBlur = 12 * glow;
      ctx.fillStyle = '#FF0050';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', h.x, h.y + Math.sin(h.pulse) * 3 + 5);
      ctx.restore();
    }

    // Player
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    const px = PLAYER_X, py = state.py;
    // Body
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    // Inner
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, PLAYER_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE / 2 + 4, py + PLAYER_SIZE / 2 - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(px + PLAYER_SIZE / 2 + 4, py + PLAYER_SIZE / 2 + 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Scarf
    ctx.fillStyle = C.heart;
    ctx.fillRect(px + PLAYER_SIZE / 2 - 2, py + PLAYER_SIZE - 4, 10, 4);
    ctx.restore();

    // Particles
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
    ctx.fillText(`${Math.floor(state.distance)}m`, W - 12, 34);
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
