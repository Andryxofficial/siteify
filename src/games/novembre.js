/**
 * NOVEMBRE — Cloud Hopper ☁️
 * Vertical jumper (Doodle Jump style). Auto-bounce on clouds.
 * Controls: left/right movement.
 */
export const meta = {
  name: 'Cloud Hopper',
  emoji: '☁️',
  description: 'Salta di nuvola in nuvola e raggiungi il cielo!',
  color: '#90CAF9',
  controls: 'lr',
  instructions: 'Muoviti con ← → o WASD. Il personaggio rimbalza automaticamente sulle nuvole!',
  gameOverTitle: 'Caduto dalle nuvole!',
  actionLabel: '☁️',
};

const W = 480, H = 480;
const PW = 18, PH = 22;
const GRAVITY = 0.32;
const BOUNCE_FORCE = -10;
const CLOUD_H = 12;

const C = {
  sky1: '#0a1a3a', sky2: '#1a3a6a', sky3: '#2a5a9a',
  cloud: '#90CAF9', cloudDark: '#64B5F6',
  cloudBreak: '#EF5350', cloudMove: '#81D4FA',
  player: '#FFD740', playerDark: '#FFC107',
  star: '#FFD700', starGlow: 'rgba(255,215,0,0.4)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  bird: '#fff',
};

export function createGame(canvas, { keysRef, joystickRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  function makeCloud(y, isFirst) {
    const w = isFirst ? 80 : 45 + Math.random() * 40;
    const type = isFirst ? 'normal' :
      Math.random() < 0.15 ? 'breaking' :
      Math.random() < 0.2 ? 'moving' : 'normal';
    return {
      x: isFirst ? W / 2 - w / 2 : 15 + Math.random() * (W - w - 30),
      y, w,
      type,
      breaking: false, breakTimer: 0,
      moveDir: Math.random() < 0.5 ? 1 : -1,
      moveSpeed: 0.8 + Math.random() * 1.2,
      hasStar: !isFirst && Math.random() < 0.25,
      starCollected: false,
    };
  }

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push(makeCloud(H - 60 - i * 36, i === 0));
  }

  const state = {
    px: W / 2, py: H - 80,
    vx: 0, vy: 0,
    score: 0,
    maxHeight: 0,
    cameraY: 0,
    hp: 1, maxHp: 1,
    running: true,
    frame: 0,
    particles: [],
    birds: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Decorative birds
  for (let i = 0; i < 5; i++) {
    state.birds.push({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 0.5 + Math.random() * 1,
      wing: Math.random() * Math.PI * 2,
    });
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  function update() {
    if (!state.running) return;
    state.frame++;

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    if (mx > 1) mx = 1;
    if (mx < -1) mx = -1;

    state.vx = mx * 5;
    state.vy += GRAVITY;
    state.px += state.vx;
    state.py += state.vy;

    // Wrap horizontal
    if (state.px < -PW) state.px = W + PW;
    if (state.px > W + PW) state.px = -PW;

    // Cloud collision (only when falling)
    if (state.vy >= 0) {
      for (const c of clouds) {
        if (c.breaking && c.breakTimer > 10) continue;
        if (state.px + PW / 2 > c.x && state.px - PW / 2 < c.x + c.w) {
          const playerBottom = state.py + PH / 2;
          const prevBottom = playerBottom - state.vy;
          if (prevBottom <= c.y && playerBottom >= c.y) {
            state.py = c.y - PH / 2;
            state.vy = BOUNCE_FORCE;
            addParticles(state.px, c.y, C.cloud, 3);

            if (c.type === 'breaking' && !c.breaking) {
              c.breaking = true;
            }

            if (c.hasStar && !c.starCollected) {
              c.starCollected = true;
              state.score += 50;
              onScore(state.score);
              addParticles(c.x + c.w / 2, c.y - 15, C.star, 6);
            }
          }
        }
      }
    }

    // Breaking clouds
    for (const c of clouds) {
      if (c.breaking) {
        c.breakTimer++;
      }
      if (c.type === 'moving') {
        c.x += c.moveDir * c.moveSpeed;
        if (c.x < 5 || c.x + c.w > W - 5) c.moveDir *= -1;
      }
    }

    // Camera follows player up
    const targetCam = state.py - H * 0.4;
    if (targetCam < state.cameraY) {
      state.cameraY += (targetCam - state.cameraY) * 0.12;
    }

    // Height score
    const height = Math.floor((-state.py + H - 60) / 8);
    if (height > state.maxHeight) {
      state.maxHeight = height;
      state.score = state.maxHeight;
      onScore(state.score);
    }

    // Generate clouds above
    const topCloudY = Math.min(...clouds.map(c => c.y));
    if (topCloudY > state.cameraY - 100) {
      clouds.push(makeCloud(topCloudY - 32 - Math.random() * 20, false));
    }

    // Remove clouds below
    for (let i = clouds.length - 1; i >= 0; i--) {
      if (clouds[i].y > state.cameraY + H + 80) {
        clouds.splice(i, 1);
      }
    }

    // Fall death
    if (state.py - state.cameraY > H + 60) {
      state.running = false;
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Birds
    for (const b of state.birds) {
      b.x += b.speed;
      b.wing += 0.1;
      if (b.x > W + 20) { b.x = -20; b.y = state.cameraY + Math.random() * H; }
    }
  }

  function draw() {
    ctx.save();

    // Sky gradient (changes with height)
    const heightFactor = Math.min(-state.cameraY / 3000, 1);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (heightFactor < 0.5) {
      grad.addColorStop(0, C.sky1);
      grad.addColorStop(1, C.sky2);
    } else {
      grad.addColorStop(0, '#050520');
      grad.addColorStop(1, C.sky1);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars (visible at height)
    if (heightFactor > 0.3) {
      ctx.globalAlpha = (heightFactor - 0.3) * 1.4;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137) % W;
        const sy = ((i * 91 + state.cameraY * 0.05) % H + H) % H;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.translate(0, -state.cameraY);

    // Birds
    for (const b of state.birds) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = C.bird;
      ctx.lineWidth = 1.5;
      ctx.translate(b.x, b.y);
      const wingY = Math.sin(b.wing) * 4;
      ctx.beginPath();
      ctx.moveTo(-8, wingY);
      ctx.quadraticCurveTo(-2, wingY - 4, 0, 0);
      ctx.quadraticCurveTo(2, wingY - 4, 8, wingY);
      ctx.stroke();
      ctx.restore();
    }

    // Clouds
    for (const c of clouds) {
      if (c.breaking && c.breakTimer > 15) continue;

      ctx.save();
      if (c.breaking) {
        ctx.globalAlpha = 1 - c.breakTimer / 15;
        ctx.translate(
          (Math.random() - 0.5) * c.breakTimer,
          (Math.random() - 0.5) * c.breakTimer,
        );
      }

      const color = c.type === 'breaking' ? C.cloudBreak :
                    c.type === 'moving' ? C.cloudMove : C.cloud;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;

      // Cloud shape: rounded rectangle with bumps
      const cx = c.x + c.w / 2;
      const r = CLOUD_H / 2;
      ctx.beginPath();
      ctx.arc(c.x + r, c.y + r, r, Math.PI, Math.PI * 1.5);
      ctx.arc(cx, c.y - r * 0.3, c.w * 0.2, Math.PI, 0);
      ctx.arc(c.x + c.w - r, c.y + r, r, Math.PI * 1.5, 0);
      ctx.lineTo(c.x + c.w, c.y + CLOUD_H);
      ctx.lineTo(c.x, c.y + CLOUD_H);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(c.x + 8, c.y + 2, c.w - 16, 3);

      // Star
      if (c.hasStar && !c.starCollected) {
        const sx = c.x + c.w / 2;
        const sy = c.y - 14;
        const sp = Math.sin(state.frame * 0.06 + c.x) * 2;
        ctx.save();
        ctx.shadowColor = C.starGlow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = C.star;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐', sx, sy + sp + 5);
        ctx.restore();
      }

      ctx.restore();
    }

    // Player
    ctx.save();
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 10;
    // Body
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(state.px, state.py, PW / 3, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.px - 3, state.py - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(state.px + 3, state.py - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Mouth (smile when going up, worried when falling)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (state.vy < 0) {
      ctx.arc(state.px, state.py + 2, 3, 0, Math.PI);
    } else {
      ctx.arc(state.px, state.py + 5, 3, Math.PI, 0);
    }
    ctx.stroke();
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

    ctx.restore(); // Remove camera

    // HUD
    ctx.fillStyle = C.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${state.maxHeight}m`, W - 12, 34);
    ctx.textAlign = 'left';
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
