/**
 * MAGGIO — Bloom Blitz 🌺
 * Falling flowers in 5 columns — catch matching colors for combos.
 * Controls: left/right to move, action to swap color.
 */
export const meta = {
  name: 'Bloom Blitz',
  emoji: '🌺',
  description: 'Cattura i fiori del colore giusto per fare combo!',
  color: '#E91E63',
  controls: 'joystick',
  instructions: 'Muoviti con ← → per posizionarti. Cattura i fiori dello stesso colore del tuo per ottenere punti! Premi Spazio per cambiare colore.',
  gameOverTitle: 'Giardino appassito!',
  actionLabel: '🔄',
};

const W = 480, H = 480;
const COLS = 5;
const COL_W = W / COLS;
const CATCHER_SIZE = 30;
const FLOWER_R = 12;

const FLOWER_COLORS = ['#FF4081', '#7C4DFF', '#FFD740', '#00E676', '#40C4FF'];
const FLOWER_NAMES = ['Rosa', 'Viola', 'Giallo', 'Verde', 'Azzurro'];

const C = {
  bg: '#1a0a1a',
  catcher: '#fff',
  heart: '#FF0050',
  text: '#f0ecf4',
  muted: '#a8a3b3',
  miss: 'rgba(255,0,80,0.3)',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  const state = {
    col: 2, // Current column (0-4)
    colorIdx: 0, // Current catcher color
    score: 0,
    hp: 5,
    maxHp: 5,
    combo: 0,
    maxCombo: 0,
    flowers: [],
    particles: [],
    floatTexts: [],
    running: true,
    frame: 0,
    nextFlower: 40,
    speed: 1.5,
    moveCD: 0,
    swapCD: 0,
    screenShake: 0,
    bgPetals: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Decorative background petals
  for (let i = 0; i < 20; i++) {
    state.bgPetals.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.5,
      speed: 0.3 + Math.random() * 0.4,
      color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)],
    });
  }

  function spawnFlower() {
    const col = Math.floor(Math.random() * COLS);
    const colorIdx = Math.floor(Math.random() * FLOWER_COLORS.length);
    state.flowers.push({
      col,
      x: col * COL_W + COL_W / 2,
      y: -FLOWER_R,
      colorIdx,
      pulse: Math.random() * Math.PI * 2,
    });
    // Increase speed over time
    state.speed = 1.5 + Math.min(state.score / 300, 3);
    state.nextFlower = Math.max(20, 50 - Math.min(state.score / 50, 25));
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 1) * 4,
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function update() {
    if (!state.running) return;
    state.frame++;

    // Input: move between columns
    if (state.moveCD > 0) state.moveCD--;
    if (state.swapCD > 0) state.swapCD--;

    const keys = keysRef.current;
    const joy = joystickRef.current;

    if (state.moveCD === 0) {
      let moved = false;
      if (keys['ArrowLeft'] || keys['a'] || keys['A'] || (joy.active && joy.dx < -0.5)) {
        if (state.col > 0) { state.col--; moved = true; }
      } else if (keys['ArrowRight'] || keys['d'] || keys['D'] || (joy.active && joy.dx > 0.5)) {
        if (state.col < COLS - 1) { state.col++; moved = true; }
      }
      if (moved) state.moveCD = 8;
    }

    // Swap color
    if (state.swapCD === 0 && (keys[' '] || keys['Space'] || actionBtnRef.current)) {
      state.colorIdx = (state.colorIdx + 1) % FLOWER_COLORS.length;
      state.swapCD = 12;
      actionBtnRef.current = false;
    }

    // Spawn flowers
    state.nextFlower--;
    if (state.nextFlower <= 0) spawnFlower();

    // Move flowers
    const catchY = H - 60;
    for (let i = state.flowers.length - 1; i >= 0; i--) {
      const f = state.flowers[i];
      f.y += state.speed;
      f.pulse += 0.06;

      // Check if caught
      if (f.col === state.col && f.y >= catchY - CATCHER_SIZE / 2 && f.y <= catchY + CATCHER_SIZE / 2) {
        if (f.colorIdx === state.colorIdx) {
          // Correct catch!
          state.combo++;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;
          const pts = 10 * Math.min(state.combo, 10);
          state.score += pts;
          onScore(state.score);
          addParticles(f.x, catchY, FLOWER_COLORS[f.colorIdx], 8);
          addFloatText(f.x, catchY - 20, `+${pts}`, FLOWER_COLORS[f.colorIdx]);
        } else {
          // Wrong color
          state.combo = 0;
          state.hp--;
          state.screenShake = 6;
          onHpChange(state.hp, state.maxHp);
          addParticles(f.x, catchY, C.heart, 4);
          addFloatText(f.x, catchY - 20, '✗', C.heart);
          if (state.hp <= 0) {
            state.running = false;
          }
        }
        state.flowers.splice(i, 1);
        continue;
      }

      // Missed (fell past)
      if (f.y > H + FLOWER_R) {
        state.flowers.splice(i, 1);
        state.combo = 0;
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Float texts
    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const ft = state.floatTexts[i];
      ft.y -= 1;
      ft.life -= 0.025;
      if (ft.life <= 0) state.floatTexts.splice(i, 1);
    }

    // Bg petals
    for (const p of state.bgPetals) {
      p.y += p.speed;
      p.x += p.drift;
      p.rot += 0.02;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
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

    // Bg petals
    for (const p of state.bgPetals) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Column guides
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = c === state.col ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(c * COL_W, 0, COL_W, H);
      if (c > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c * COL_W, 0);
        ctx.lineTo(c * COL_W, H);
        ctx.stroke();
      }
    }

    // Falling flowers
    for (const f of state.flowers) {
      const glow = 0.6 + Math.sin(f.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = FLOWER_COLORS[f.colorIdx];
      ctx.shadowBlur = 8 * glow;
      ctx.fillStyle = FLOWER_COLORS[f.colorIdx];
      ctx.beginPath();
      ctx.arc(f.x, f.y, FLOWER_R, 0, Math.PI * 2);
      ctx.fill();
      // Inner
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, FLOWER_R / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Catcher
    const catchX = state.col * COL_W + COL_W / 2;
    const catchY = H - 60;
    ctx.save();
    ctx.shadowColor = FLOWER_COLORS[state.colorIdx];
    ctx.shadowBlur = 14;
    ctx.strokeStyle = FLOWER_COLORS[state.colorIdx];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(catchX, catchY, CATCHER_SIZE / 2, 0, Math.PI * 2);
    ctx.stroke();
    // Color indicator
    ctx.fillStyle = FLOWER_COLORS[state.colorIdx];
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(catchX, catchY, CATCHER_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Color name
    ctx.fillStyle = C.text;
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(FLOWER_NAMES[state.colorIdx], catchX, catchY + CATCHER_SIZE / 2 + 14);
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

    // Float texts
    for (const ft of state.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px Outfit, sans-serif';
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
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    if (state.combo > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.fillText(`Combo ×${state.combo}`, W - 12, 34);
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
