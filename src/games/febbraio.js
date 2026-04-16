/**
 * FEBBRAIO — Heart Breaker 💕
 * Breakout/Arkanoid with heart-themed blocks.
 * Controls: left/right to move paddle.
 */
export const meta = {
  name: 'Heart Breaker',
  emoji: '💕',
  description: 'Rompi tutti i blocchi cuore con la pallina!',
  color: '#FF6B9D',
  controls: 'lr',
  instructions: 'Muovi la barra con le frecce ← → o WASD. Non far cadere la pallina!',
  gameOverTitle: 'Cuore spezzato!',
  actionLabel: '💕',
};

const W = 480, H = 480;
const PADDLE_W = 70, PADDLE_H = 12;
const BALL_R = 6;
const BRICK_ROWS = 6, BRICK_COLS = 9;
const BRICK_W = 46, BRICK_H = 16;
const BRICK_GAP = 4;
const BRICK_OFFSET_X = (W - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
const BRICK_OFFSET_Y = 60;

const COLORS = ['#FF6B9D', '#FF1744', '#FF4081', '#F50057', '#E91E63', '#AD1457'];

const C = {
  bg: '#1a0a14', paddle: '#FF6B9D', paddleGlow: 'rgba(255,107,157,0.4)',
  ball: '#fff', ballGlow: 'rgba(255,255,255,0.5)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
};

export function createGame(canvas, { keysRef, joystickRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  // Build bricks
  function buildBricks() {
    const bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_GAP),
          y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W, h: BRICK_H,
          color: COLORS[r % COLORS.length],
          alive: true,
          points: (BRICK_ROWS - r) * 10,
        });
      }
    }
    return bricks;
  }

  const state = {
    paddleX: W / 2 - PADDLE_W / 2,
    ballX: W / 2, ballY: H - 60,
    bvx: 3.5, bvy: -3.5,
    score: 0,
    hp: 3, maxHp: 3,
    bricks: buildBricks(),
    particles: [],
    combo: 0,
    level: 1,
    running: true,
    frame: 0,
    screenShake: 0,
    speedMult: 1,
    lastHealAt: 0,
    healItems: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function resetBall() {
    state.ballX = state.paddleX + PADDLE_W / 2;
    state.ballY = H - 60;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const spd = 4 * state.speedMult;
    state.bvx = Math.cos(angle) * spd;
    state.bvy = Math.sin(angle) * spd;
    state.combo = 0;
  }

  function nextLevel() {
    state.level++;
    state.bricks = buildBricks();
    state.speedMult = 1 + (state.level - 1) * 0.15;
    resetBall();
    state.score += 200;
    onScore(state.score);
  }

  function update() {
    if (!state.running) return;
    state.frame++;

    // Paddle input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    if (mx > 1) mx = 1;
    if (mx < -1) mx = -1;

    state.paddleX += mx * 7;
    if (state.paddleX < 0) state.paddleX = 0;
    if (state.paddleX > W - PADDLE_W) state.paddleX = W - PADDLE_W;

    // Ball movement
    state.ballX += state.bvx;
    state.ballY += state.bvy;

    // Wall bounces
    if (state.ballX - BALL_R <= 0) { state.ballX = BALL_R; state.bvx = Math.abs(state.bvx); }
    if (state.ballX + BALL_R >= W) { state.ballX = W - BALL_R; state.bvx = -Math.abs(state.bvx); }
    if (state.ballY - BALL_R <= 0) { state.ballY = BALL_R; state.bvy = Math.abs(state.bvy); }

    // Ball fell off bottom
    if (state.ballY > H + BALL_R) {
      state.hp--;
      state.screenShake = 6;
      onHpChange(state.hp, state.maxHp);
      if (state.hp <= 0) {
        state.running = false;
        return;
      }
      resetBall();
      return;
    }

    // Paddle collision
    if (state.bvy > 0 &&
        state.ballY + BALL_R >= H - 40 - PADDLE_H &&
        state.ballY + BALL_R <= H - 40 &&
        state.ballX >= state.paddleX - BALL_R &&
        state.ballX <= state.paddleX + PADDLE_W + BALL_R) {
      const hitPos = (state.ballX - state.paddleX) / PADDLE_W; // 0-1
      const angle = -Math.PI / 2 + (hitPos - 0.5) * Math.PI * 0.7;
      const spd = Math.sqrt(state.bvx * state.bvx + state.bvy * state.bvy);
      state.bvx = Math.cos(angle) * spd;
      state.bvy = Math.sin(angle) * spd;
      state.ballY = H - 40 - PADDLE_H - BALL_R;
      state.combo = 0;
      addParticles(state.ballX, state.ballY, C.paddle, 3);
    }

    // Brick collision
    for (const b of state.bricks) {
      if (!b.alive) continue;
      if (state.ballX + BALL_R > b.x && state.ballX - BALL_R < b.x + b.w &&
          state.ballY + BALL_R > b.y && state.ballY - BALL_R < b.y + b.h) {
        b.alive = false;
        state.combo++;
        const pts = b.points * Math.min(state.combo, 5);
        state.score += pts;
        onScore(state.score);
        addParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 6);

        // Determine bounce direction
        const overlapLeft = (state.ballX + BALL_R) - b.x;
        const overlapRight = (b.x + b.w) - (state.ballX - BALL_R);
        const overlapTop = (state.ballY + BALL_R) - b.y;
        const overlapBottom = (b.y + b.h) - (state.ballY - BALL_R);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft || minOverlap === overlapRight) state.bvx = -state.bvx;
        else state.bvy = -state.bvy;
        break; // Only one brick per frame
      }
    }

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(state.score / 1000);
    if (healMilestone > state.lastHealAt && state.hp < state.maxHp) {
      state.lastHealAt = healMilestone;
      state.healItems.push({
        x: 40 + Math.random() * (W - 80),
        y: -15,
        vy: 1.2 + Math.random() * 0.5,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // Check if all bricks destroyed
    if (state.bricks.every(b => !b.alive)) {
      nextLevel();
    }

    // Heal items (falling hearts)
    for (let i = state.healItems.length - 1; i >= 0; i--) {
      const h = state.healItems[i];
      h.y += h.vy;
      h.pulse += 0.08;
      if (h.y > H + 20) { state.healItems.splice(i, 1); continue; }
      const dx = state.ballX - h.x, dy = state.ballY - h.y;
      if (Math.sqrt(dx * dx + dy * dy) < BALL_R + 12) {
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

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Background hearts decoration
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#FF6B9D';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 73 + state.frame * 0.2) % (W + 40)) - 20;
      const by = ((i * 97 + 30) % H);
      ctx.fillText('♥', bx, by);
    }
    ctx.globalAlpha = 1;

    // Bricks
    for (const b of state.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 4;
      // Rounded brick
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y);
      ctx.lineTo(b.x + b.w - r, b.y);
      ctx.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + r);
      ctx.lineTo(b.x + b.w, b.y + b.h - r);
      ctx.quadraticCurveTo(b.x + b.w, b.y + b.h, b.x + b.w - r, b.y + b.h);
      ctx.lineTo(b.x + r, b.y + b.h);
      ctx.quadraticCurveTo(b.x, b.y + b.h, b.x, b.y + b.h - r);
      ctx.lineTo(b.x, b.y + r);
      ctx.quadraticCurveTo(b.x, b.y, b.x + r, b.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, b.h / 3);
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
      ctx.fillText('♥', h.x, h.y + Math.sin(h.pulse * 1.5) * 3 + 5);
      ctx.restore();
    }

    // Paddle
    ctx.save();
    ctx.shadowColor = C.paddleGlow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = C.paddle;
    const pr = PADDLE_H / 2;
    ctx.beginPath();
    ctx.moveTo(state.paddleX + pr, H - 40 - PADDLE_H);
    ctx.lineTo(state.paddleX + PADDLE_W - pr, H - 40 - PADDLE_H);
    ctx.arc(state.paddleX + PADDLE_W - pr, H - 40 - pr, pr, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(state.paddleX + pr, H - 40);
    ctx.arc(state.paddleX + pr, H - 40 - pr, pr, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Ball
    ctx.save();
    ctx.shadowColor = C.ballGlow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.ball;
    ctx.beginPath();
    ctx.arc(state.ballX, state.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    // Ball trail
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(state.ballX - state.bvx * 0.5, state.ballY - state.bvy * 0.5, BALL_R * 0.7, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillText(`Livello ${state.level}`, W - 12, 34);
    if (state.combo > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.fillText(`Combo ×${state.combo}`, W - 12, 48);
    }
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
