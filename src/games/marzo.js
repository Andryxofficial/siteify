/**
 * MARZO — Wind Walker 🌿
 * Vertical platformer with wind gusts. Jump between platforms, collect flowers.
 * Controls: left/right movement + jump (space/action).
 */
export const meta = {
  name: 'Wind Walker',
  emoji: '🌿',
  description: 'Salta tra le piattaforme nel vento e raccogli i fiori!',
  color: '#66BB6A',
  controls: 'joystick',
  instructions: 'Muoviti con ← → o WASD. Salta con Spazio o il pulsante 🌿. Attenzione al vento!',
  gameOverTitle: 'Caduto nel vuoto!',
  actionLabel: '🦘',
};

const W = 480, H = 480;
const GRAVITY = 0.4;
const JUMP_FORCE = -9.5;
const PW = 20, PH = 24;
const PLAT_H = 10;

const C = {
  bg1: '#0a1a0f', bg2: '#1a2f1a',
  player: '#66BB6A', playerDark: '#388E3C',
  plat: '#4CAF50', platEdge: '#2E7D32',
  flower: '#FF6F00', flowerGlow: 'rgba(255,111,0,0.4)',
  wind: 'rgba(200,255,200,0.15)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  leaf: '#81C784',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  function makePlatform(y, isFirst) {
    const w = isFirst ? 100 : 50 + Math.random() * 60;
    return {
      x: isFirst ? W / 2 - w / 2 : 20 + Math.random() * (W - w - 40),
      y,
      w,
      hasFlower: !isFirst && Math.random() < 0.35,
      flowerCollected: false,
      moving: !isFirst && Math.random() < 0.2,
      moveDir: Math.random() < 0.5 ? 1 : -1,
      moveSpeed: 0.5 + Math.random() * 1,
    };
  }

  const platforms = [];
  for (let i = 0; i < 12; i++) {
    platforms.push(makePlatform(H - 60 - i * 42, i === 0));
  }

  const state = {
    px: W / 2, py: H - 80,
    vx: 0, vy: 0,
    onGround: false,
    score: 0,
    maxHeight: 0,
    cameraY: 0,
    wind: 0, windTimer: 0,
    windDir: 0,
    hp: 1, maxHp: 1, // Single life
    running: true,
    frame: 0,
    particles: [],
    leaves: [],
    jumpPressed: false,
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Decorative leaves
  for (let i = 0; i < 15; i++) {
    state.leaves.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1,
    });
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 3,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  function update() {
    if (!state.running) return;
    state.frame++;

    // Wind
    state.windTimer--;
    if (state.windTimer <= 0) {
      state.wind = (Math.random() - 0.5) * 0.6;
      state.windDir = state.wind > 0 ? 1 : -1;
      state.windTimer = 120 + Math.random() * 180;
    }

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    if (mx > 1) mx = 1;
    if (mx < -1) mx = -1;

    const wantJump = keys[' '] || keys['Space'] || keys['ArrowUp'] || keys['w'] || keys['W'] || actionBtnRef.current;
    if (wantJump && !state.jumpPressed && state.onGround) {
      state.vy = JUMP_FORCE;
      state.onGround = false;
      state.jumpPressed = true;
      addParticles(state.px, state.py + PH / 2, C.leaf, 3);
    }
    if (!wantJump) {
      state.jumpPressed = false;
      actionBtnRef.current = false;
    }

    // Physics
    state.vx = mx * 4 + state.wind;
    state.vy += GRAVITY;
    state.px += state.vx;
    state.py += state.vy;

    // Wrap horizontally
    if (state.px < -PW / 2) state.px = W + PW / 2;
    if (state.px > W + PW / 2) state.px = -PW / 2;

    // Platform collision (only when falling)
    state.onGround = false;
    if (state.vy >= 0) {
      for (const p of platforms) {
        const screenY = p.y - state.cameraY;
        if (state.px + PW / 2 > p.x && state.px - PW / 2 < p.x + p.w) {
          const playerBottom = state.py + PH / 2;
          const prevBottom = playerBottom - state.vy;
          if (prevBottom <= p.y && playerBottom >= p.y) {
            state.py = p.y - PH / 2;
            state.vy = 0;
            state.onGround = true;

            // Collect flower
            if (p.hasFlower && !p.flowerCollected) {
              p.flowerCollected = true;
              state.score += 25;
              onScore(state.score);
              addParticles(state.px, p.y - 15, C.flower, 6);
            }
            break;
          }
        }
      }
    }

    // Camera follows player upward
    const targetCam = state.py - H * 0.6;
    if (targetCam < state.cameraY) {
      state.cameraY += (targetCam - state.cameraY) * 0.1;
    }

    // Track max height for score
    const height = Math.floor((-state.py + H - 80) / 10);
    if (height > state.maxHeight) {
      state.maxHeight = height;
      state.score = state.maxHeight;
      onScore(state.score);
    }

    // Generate new platforms above
    const topPlatY = Math.min(...platforms.map(p => p.y));
    if (topPlatY > state.cameraY - 100) {
      platforms.push(makePlatform(topPlatY - 38 - Math.random() * 15, false));
    }

    // Remove platforms far below
    for (let i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > state.cameraY + H + 100) {
        platforms.splice(i, 1);
      }
    }

    // Move moving platforms
    for (const p of platforms) {
      if (p.moving) {
        p.x += p.moveDir * p.moveSpeed;
        if (p.x < 10 || p.x + p.w > W - 10) p.moveDir *= -1;
      }
    }

    // Fall death
    if (state.py - state.cameraY > H + 50) {
      state.running = false;
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Leaves
    for (const l of state.leaves) {
      l.y += l.speed;
      l.x += state.wind * 2;
      l.rot += 0.03;
      if (l.y > state.cameraY + H + 20) {
        l.y = state.cameraY - 20;
        l.x = Math.random() * W;
      }
    }
  }

  function draw() {
    ctx.save();

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.bg1);
    grad.addColorStop(1, C.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(0, -state.cameraY);

    // Wind indicator
    if (Math.abs(state.wind) > 0.1) {
      ctx.fillStyle = C.wind;
      for (let i = 0; i < 5; i++) {
        const wx = ((state.frame * state.wind * 8 + i * 100) % (W + 40)) - 20;
        const wy = state.cameraY + 100 + i * 80;
        ctx.fillRect(wx, wy, 30, 2);
      }
    }

    // Leaves
    for (const l of state.leaves) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = C.leaf;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Platforms
    for (const p of platforms) {
      ctx.fillStyle = C.plat;
      ctx.shadowColor = 'rgba(76,175,80,0.3)';
      ctx.shadowBlur = 6;
      const r = 5;
      ctx.beginPath();
      ctx.moveTo(p.x + r, p.y);
      ctx.lineTo(p.x + p.w - r, p.y);
      ctx.quadraticCurveTo(p.x + p.w, p.y, p.x + p.w, p.y + r);
      ctx.lineTo(p.x + p.w, p.y + PLAT_H);
      ctx.lineTo(p.x, p.y + PLAT_H);
      ctx.lineTo(p.x, p.y + r);
      ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Grass top
      ctx.fillStyle = C.platEdge;
      ctx.fillRect(p.x, p.y, p.w, 3);

      // Flower
      if (p.hasFlower && !p.flowerCollected) {
        const fx = p.x + p.w / 2;
        const fy = p.y - 10;
        const pulse = Math.sin(state.frame * 0.06 + p.x) * 2;
        ctx.save();
        ctx.shadowColor = C.flowerGlow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = C.flower;
        ctx.beginPath();
        ctx.arc(fx, fy + pulse, 5, 0, Math.PI * 2);
        ctx.fill();
        // Petals
        ctx.fillStyle = '#FFA726';
        for (let a = 0; a < 5; a++) {
          const angle = (a / 5) * Math.PI * 2 + state.frame * 0.02;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(angle) * 6, fy + pulse + Math.sin(angle) * 6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Player
    ctx.save();
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PW / 3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    const eyeDir = state.vx > 0.5 ? 2 : state.vx < -0.5 ? -2 : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.px + eyeDir - 3, state.py - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(state.px + eyeDir + 3, state.py - 2, 2.5, 0, Math.PI * 2);
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

    ctx.restore(); // Remove camera translation

    // HUD (screen-space)
    ctx.fillStyle = C.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${state.maxHeight}m`, W - 12, 34);
    ctx.textAlign = 'left';

    // Wind indicator HUD
    if (Math.abs(state.wind) > 0.1) {
      ctx.fillStyle = 'rgba(129,199,132,0.6)';
      ctx.font = '11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(state.wind > 0 ? '💨 →' : '← 💨', 12, 20);
    }
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
