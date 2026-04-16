/**
 * SETTEMBRE — Leaf Catcher 🍁
 * Catch falling autumn leaves with a basket. Avoid rotten ones.
 * Controls: left/right to move basket.
 */
export const meta = {
  name: 'Leaf Catcher',
  emoji: '🍁',
  description: 'Cattura le foglie autunnali e evita quelle marce!',
  color: '#FF6D00',
  controls: 'lr',
  instructions: 'Muovi il cesto con ← → o WASD. Cattura le foglie colorate, evita quelle scure!',
  gameOverTitle: 'Il cesto è pieno di foglie marce!',
  actionLabel: '🧺',
};

const W = 480, H = 480;
const BASKET_W = 50, BASKET_H = 28;
const LEAF_R = 10;

const LEAF_TYPES = [
  { color: '#FF6D00', points: 10, name: 'arancio' },
  { color: '#FDD835', points: 15, name: 'giallo' },
  { color: '#E53935', points: 20, name: 'rosso' },
  { color: '#8D6E63', points: 25, name: 'marrone' },
];
const BAD_LEAF = { color: '#263238', points: -1, name: 'marcio' };

const C = {
  bg1: '#1a0f05', bg2: '#2a1a0a',
  basket: '#8D6E63', basketDark: '#5D4037',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  golden: '#FFD700',
};

export function createGame(canvas, { keysRef, joystickRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  const state = {
    basketX: W / 2 - BASKET_W / 2,
    score: 0,
    hp: 4, maxHp: 4,
    leaves: [],
    particles: [],
    floatTexts: [],
    bgLeaves: [],
    running: true,
    frame: 0,
    nextLeaf: 30,
    speed: 1.5,
    combo: 0,
    screenShake: 0,
    lastHealAt: 0,
    healItems: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Background decorative leaves
  for (let i = 0; i < 12; i++) {
    state.bgLeaves.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 5 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.02,
      drift: (Math.random() - 0.5) * 0.4,
      speed: 0.3 + Math.random() * 0.5,
      color: LEAF_TYPES[Math.floor(Math.random() * LEAF_TYPES.length)].color,
    });
  }

  function spawnLeaf() {
    const isBad = Math.random() < 0.2 + Math.min(state.score / 1000, 0.15);
    const type = isBad ? BAD_LEAF : LEAF_TYPES[Math.floor(Math.random() * LEAF_TYPES.length)];
    state.leaves.push({
      x: 20 + Math.random() * (W - 40),
      y: -LEAF_R,
      type,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.06,
      drift: (Math.random() - 0.5) * 0.8,
      speed: state.speed + Math.random() * 0.5,
      pulse: Math.random() * Math.PI * 2,
    });
    state.nextLeaf = Math.max(12, 35 - Math.min(state.score / 80, 18));
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 3,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    state.speed = 1.5 + Math.min(state.score / 200, 3);

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    if (mx > 1) mx = 1;
    if (mx < -1) mx = -1;

    state.basketX += mx * 6;
    if (state.basketX < 0) state.basketX = 0;
    if (state.basketX > W - BASKET_W) state.basketX = W - BASKET_W;

    // Spawn
    state.nextLeaf--;
    if (state.nextLeaf <= 0) spawnLeaf();

    // Move leaves
    const catchTop = H - 60;
    const catchBottom = H - 60 + BASKET_H;
    for (let i = state.leaves.length - 1; i >= 0; i--) {
      const l = state.leaves[i];
      l.y += l.speed;
      l.x += l.drift + Math.sin(state.frame * 0.03 + l.pulse) * 0.5;
      l.rot += l.rotSpd;
      l.pulse += 0.04;

      // Keep in bounds horizontally
      if (l.x < LEAF_R) l.x = LEAF_R;
      if (l.x > W - LEAF_R) l.x = W - LEAF_R;

      // Check catch
      if (l.y >= catchTop && l.y <= catchBottom &&
          l.x >= state.basketX - LEAF_R && l.x <= state.basketX + BASKET_W + LEAF_R) {
        if (l.type === BAD_LEAF) {
          state.hp--;
          state.combo = 0;
          state.screenShake = 6;
          onHpChange(state.hp, state.maxHp);
          addParticles(l.x, catchTop, C.heart, 4);
          addFloatText(l.x, catchTop - 10, '✗', C.heart);
          if (state.hp <= 0) { state.running = false; }
        } else {
          state.combo++;
          const pts = l.type.points * Math.min(state.combo, 5);
          state.score += pts;
          onScore(state.score);
          addParticles(l.x, catchTop, l.type.color, 5);
          addFloatText(l.x, catchTop - 10, `+${pts}`, l.type.color);
        }
        state.leaves.splice(i, 1);
        continue;
      }

      // Missed (fell past basket)
      if (l.y > H + LEAF_R) {
        if (l.type !== BAD_LEAF) {
          state.combo = 0; // Reset combo on miss
        }
        state.leaves.splice(i, 1);
      }
    }

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(state.score / 1000);
    if (healMilestone > state.lastHealAt && state.hp < state.maxHp) {
      state.lastHealAt = healMilestone;
      state.healItems.push({
        x: 20 + Math.random() * (W - 40),
        y: -LEAF_R,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    for (let i = state.healItems.length - 1; i >= 0; i--) {
      const h = state.healItems[i];
      h.y += state.speed * 0.7;
      h.pulse += 0.08;
      h.x += Math.sin(state.frame * 0.03 + h.pulse) * 0.4;
      if (h.y > H + 20) { state.healItems.splice(i, 1); continue; }
      const catchTop = H - 60;
      const catchBottom = H - 60 + BASKET_H;
      if (h.y >= catchTop && h.y <= catchBottom &&
          h.x >= state.basketX - LEAF_R && h.x <= state.basketX + BASKET_W + LEAF_R) {
        state.hp = state.maxHp;
        onHpChange(state.hp, state.maxHp);
        addParticles(h.x, catchTop, '#FF0050', 8);
        addFloatText(h.x, catchTop - 10, '♥ MAX', '#FF0050');
        state.healItems.splice(i, 1);
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.06;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Float texts
    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const ft = state.floatTexts[i];
      ft.y -= 0.8;
      ft.life -= 0.025;
      if (ft.life <= 0) state.floatTexts.splice(i, 1);
    }

    // Bg leaves
    for (const l of state.bgLeaves) {
      l.y += l.speed;
      l.x += l.drift;
      l.rot += l.rotSpd;
      if (l.y > H + 20) { l.y = -20; l.x = Math.random() * W; }
    }

    if (state.screenShake > 0) state.screenShake--;
  }

  function drawLeafShape(x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.3, r * 0.6, r * 0.2);
    ctx.quadraticCurveTo(r * 0.2, r * 0.8, 0, r);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.8, -r * 0.6, r * 0.2);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.3, 0, -r);
    ctx.closePath();
    ctx.fill();
    // Vein
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.lineTo(0, r * 0.7);
    ctx.stroke();
    ctx.restore();
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
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.bg1);
    grad.addColorStop(1, C.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Bg decorative leaves
    for (const l of state.bgLeaves) {
      ctx.globalAlpha = 0.08;
      drawLeafShape(l.x, l.y, l.size, l.rot, l.color);
      ctx.globalAlpha = 1;
    }

    // Falling leaves
    for (const l of state.leaves) {
      const glow = l.type === BAD_LEAF ? 0 : 0.3 + Math.sin(l.pulse) * 0.2;
      ctx.save();
      if (l.type !== BAD_LEAF) {
        ctx.shadowColor = l.type.color;
        ctx.shadowBlur = 6 * glow;
      }
      drawLeafShape(l.x, l.y, LEAF_R, l.rot, l.type.color);
      if (l.type === BAD_LEAF) {
        // Skull indicator
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☠', l.x, l.y + 3);
      }
      ctx.restore();
    }

    // Heal items
    for (const h of state.healItems) {
      const glow = 0.6 + Math.sin(h.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = 'rgba(255,0,80,0.5)';
      ctx.shadowBlur = 12 * glow;
      ctx.fillStyle = '#FF0050';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', h.x, h.y + Math.sin(h.pulse * 1.5) * 3 + 5);
      ctx.restore();
    }

    // Basket
    ctx.save();
    ctx.fillStyle = C.basket;
    const bx = state.basketX, by = H - 60;
    // Basket shape
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + 4, by + BASKET_H);
    ctx.lineTo(bx + BASKET_W - 4, by + BASKET_H);
    ctx.lineTo(bx + BASKET_W + 4, by);
    ctx.closePath();
    ctx.fill();
    // Basket rim
    ctx.fillStyle = C.basketDark;
    ctx.fillRect(bx - 6, by - 3, BASKET_W + 12, 5);
    // Weave pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ly = by + 5 + i * 6;
      ctx.beginPath();
      ctx.moveTo(bx, ly);
      ctx.lineTo(bx + BASKET_W, ly);
      ctx.stroke();
    }
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
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    if (state.combo > 1) {
      ctx.fillStyle = C.golden;
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
