/**
 * LUGLIO — Wave Rider 🌊
 * Side-scrolling surfing game. Ride waves, do tricks, collect shells.
 * Controls: up/down to ride wave angle, action for tricks.
 */
export const meta = {
  name: 'Wave Rider',
  emoji: '🌊',
  description: 'Surfa sulle onde, fai trick e raccogli conchiglie!',
  color: '#00BCD4',
  controls: 'joystick',
  instructions: 'Usa ↑↓ o joystick per cavalcare le onde. Premi Spazio in aria per i trick! Raccogli le conchiglie 🐚.',
  gameOverTitle: 'Wipeout!',
  actionLabel: '🤸',
};

const W = 480, H = 480;
const WATER_Y = H * 0.6;

const C = {
  sky1: '#0a1a3a', sky2: '#1a3a6a',
  water: '#0277BD', waterDeep: '#01579B', waterLight: '#039BE5',
  foam: 'rgba(255,255,255,0.4)',
  player: '#00BCD4', playerDark: '#00838F',
  shell: '#FFB74D', shellGlow: 'rgba(255,183,77,0.4)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  trick: '#FFD700',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  const state = {
    px: 120, py: WATER_Y,
    vy: 0,
    score: 0,
    hp: 3, maxHp: 3,
    speed: 3,
    distance: 0,
    inAir: false,
    airTime: 0,
    trickDone: false,
    trickRotation: 0,
    combo: 0,
    shells: [],
    obstacles: [],
    particles: [],
    running: true,
    frame: 0,
    waveOffset: 0,
    nextShell: 60,
    nextObstacle: 120,
    iframe: 0,
    screenShake: 0,
    lastHealAt: 0,
    healItems: [],
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  function getWaveY(x) {
    const t = state.waveOffset;
    return WATER_Y +
      Math.sin((x + t) * 0.015) * 30 +
      Math.sin((x + t) * 0.008 + 1) * 20 +
      Math.sin((x + t) * 0.025 + 2) * 10;
  }

  function getWaveSlope(x) {
    const dx = 2;
    return (getWaveY(x + dx) - getWaveY(x - dx)) / (2 * dx);
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 3,
        life: 1, decay: 0.03 + Math.random() * 0.03,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    state.distance += state.speed;
    state.waveOffset += state.speed;
    state.speed = 3 + Math.min(state.distance / 1000, 3);

    if (state.iframe > 0) state.iframe--;

    // Input
    const keys = keysRef.current;
    let my = 0;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my = 1;
    const joy = joystickRef.current;
    if (joy.active) my += joy.dy;
    if (my > 1) my = 1;
    if (my < -1) my = -1;

    const waveY = getWaveY(state.px);
    const slope = getWaveSlope(state.px);

    if (state.inAir) {
      state.airTime++;
      state.vy += 0.35; // gravity
      state.py += state.vy;

      // Trick in air
      const wantTrick = keys[' '] || keys['Space'] || actionBtnRef.current;
      if (wantTrick && !state.trickDone) {
        state.trickDone = true;
        state.trickRotation = 0;
        actionBtnRef.current = false;
      }
      if (state.trickDone && state.trickRotation < Math.PI * 2) {
        state.trickRotation += 0.2;
      }

      // Land on water
      if (state.py >= waveY) {
        state.py = waveY;
        state.inAir = false;

        // Score for air time and tricks
        if (state.airTime > 15) {
          let pts = Math.floor(state.airTime * 2);
          if (state.trickDone) {
            pts *= 3;
            state.combo++;
          }
          state.score += pts;
          onScore(state.score);
          addParticles(state.px, state.py, C.trick, 6);
        }
        state.airTime = 0;
        state.trickDone = false;
        state.trickRotation = 0;
        addParticles(state.px, state.py, C.foam, 4);
      }
    } else {
      // On wave
      state.py = waveY;
      state.vy = my * -3 + slope * state.speed * -2;

      // Launch off wave crest
      if (slope < -0.3 && my < -0.2) {
        state.inAir = true;
        state.vy = -6 - Math.abs(slope) * 4;
        state.combo = 0;
        addParticles(state.px, state.py, C.foam, 5);
      }

      // Spray particles
      if (state.frame % 3 === 0) {
        addParticles(state.px - 8, state.py + 5, C.foam, 1);
      }
    }

    // Spawn stuff
    state.nextShell--;
    if (state.nextShell <= 0) {
      state.shells.push({
        x: W + 20,
        y: getWaveY(W + 20 + state.waveOffset) - 15 - Math.random() * 40,
        pulse: Math.random() * Math.PI * 2,
      });
      state.nextShell = 50 + Math.random() * 60;
    }

    state.nextObstacle--;
    if (state.nextObstacle <= 0) {
      state.obstacles.push({
        x: W + 20,
        y: getWaveY(W + 20 + state.waveOffset) - 10,
        r: 12 + Math.random() * 8,
      });
      state.nextObstacle = Math.max(60, 130 - state.distance / 50);
    }

    // Move shells
    for (let i = state.shells.length - 1; i >= 0; i--) {
      const s = state.shells[i];
      s.x -= state.speed;
      s.pulse += 0.06;
      if (s.x < -20) { state.shells.splice(i, 1); continue; }

      const dx = state.px - s.x, dy = state.py - s.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        state.score += 25;
        onScore(state.score);
        addParticles(s.x, s.y, C.shell, 5);
        state.shells.splice(i, 1);
      }
    }

    // Move obstacles
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.x -= state.speed;
      if (o.x < -30) { state.obstacles.splice(i, 1); continue; }

      if (state.iframe === 0) {
        const dx = state.px - o.x, dy = state.py - o.y;
        if (Math.sqrt(dx * dx + dy * dy) < o.r + 10) {
          state.hp--;
          state.iframe = 50;
          state.screenShake = 8;
          onHpChange(state.hp, state.maxHp);
          addParticles(state.px, state.py, C.heart, 6);
          if (state.hp <= 0) { state.running = false; return; }
        }
      }
    }

    // Score from distance
    if (state.frame % 30 === 0) {
      state.score += 5;
      onScore(state.score);
    }

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(state.score / 1000);
    if (healMilestone > state.lastHealAt && state.hp < state.maxHp) {
      state.lastHealAt = healMilestone;
      state.healItems.push({
        x: W + 20,
        y: getWaveY(W + 20 + state.waveOffset) - 20 - Math.random() * 40,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    for (let i = state.healItems.length - 1; i >= 0; i--) {
      const h = state.healItems[i];
      h.x -= state.speed;
      h.pulse += 0.08;
      if (h.x < -20) { state.healItems.splice(i, 1); continue; }
      const dx = state.px - h.x, dy = state.py - h.y;
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
      p.x += p.vx - state.speed * 0.3;
      p.y += p.vy;
      p.vy += 0.05;
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

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.sky1);
    grad.addColorStop(0.5, C.sky2);
    grad.addColorStop(1, C.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars in sky
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 20; i++) {
      const sx = (i * 137 + state.frame * 0.05) % W;
      const sy = (i * 91) % (WATER_Y * 0.6);
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wave
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      ctx.lineTo(x, getWaveY(x));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const waveGrad = ctx.createLinearGradient(0, WATER_Y - 40, 0, H);
    waveGrad.addColorStop(0, C.waterLight);
    waveGrad.addColorStop(0.3, C.water);
    waveGrad.addColorStop(1, C.waterDeep);
    ctx.fillStyle = waveGrad;
    ctx.fill();

    // Wave foam line
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const wy = getWaveY(x);
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.strokeStyle = C.foam;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shells
    for (const s of state.shells) {
      const glow = 0.6 + Math.sin(s.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = C.shellGlow;
      ctx.shadowBlur = 8 * glow;
      ctx.fillStyle = C.shell;
      ctx.beginPath();
      ctx.arc(s.x, s.y + Math.sin(s.pulse) * 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y + Math.sin(s.pulse) * 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Obstacles (rocks)
    for (const o of state.obstacles) {
      ctx.fillStyle = '#546E7A';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.arc(o.x + 2, o.y - 2, o.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
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

    // Player (surfer)
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.translate(state.px, state.py);
    if (state.trickDone && state.trickRotation < Math.PI * 2) {
      ctx.rotate(state.trickRotation);
    }
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 10;
    // Board
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 4, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(0, -6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, Math.PI * 2);
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

    // Trick indicator
    if (state.inAir && !state.trickDone) {
      ctx.fillStyle = 'rgba(255,215,0,0.6)';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🤸 TRICK!', state.px, state.py - 30);
    }

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
