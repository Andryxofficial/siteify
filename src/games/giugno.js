/**
 * GIUGNO — Solar Surge ☀️
 * Top-down space shooter. Dodge sun beams, destroy asteroids, collect energy.
 * Controls: joystick to move, action to shoot.
 */
export const meta = {
  name: 'Solar Surge',
  emoji: '☀️',
  description: 'Schiva i raggi solari e distruggi gli asteroidi!',
  color: '#FFB300',
  controls: 'joystick',
  instructions: 'Muoviti con WASD/frecce o joystick. Spara con Spazio o il pulsante ☀️!',
  gameOverTitle: 'Bruciato dal sole!',
  actionLabel: '🔫',
};

const W = 480, H = 480;
const PLAYER_R = 12;
const BULLET_SPD = 7;
const BULLET_R = 3;

const C = {
  bg: '#0a0a1a',
  player: '#FFB300', playerDark: '#FF8F00',
  bullet: '#FFEB3B',
  asteroid: '#5C6BC0', asteroidDark: '#3949AB',
  beam: 'rgba(255,179,0,0.15)',
  beamCore: 'rgba(255,179,0,0.4)',
  energy: '#76FF03', energyGlow: 'rgba(118,255,3,0.4)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  star: 'rgba(255,255,255,0.3)',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  const state = {
    px: W / 2, py: H - 80,
    score: 0,
    hp: 4, maxHp: 4,
    bullets: [],
    asteroids: [],
    energyCells: [],
    beams: [],
    particles: [],
    stars: [],
    running: true,
    frame: 0,
    shootCD: 0,
    nextAsteroid: 50,
    nextBeam: 200,
    nextEnergy: 150,
    iframe: 0,
    screenShake: 0,
    difficulty: 1,
  };

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Background stars
  for (let i = 0; i < 60; i++) {
    state.stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.5 + Math.random() * 1.5,
      brightness: 0.2 + Math.random() * 0.5,
    });
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1, decay: 0.03 + Math.random() * 0.03,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnAsteroid() {
    const fromTop = Math.random() < 0.7;
    state.asteroids.push({
      x: fromTop ? Math.random() * W : (Math.random() < 0.5 ? -20 : W + 20),
      y: fromTop ? -20 : Math.random() * H * 0.5,
      vx: (Math.random() - 0.5) * 2,
      vy: 1 + Math.random() * 2,
      r: 14 + Math.random() * 12,
      hp: 1 + Math.floor(state.difficulty / 3),
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.05,
    });
    state.nextAsteroid = Math.max(15, 50 - state.difficulty * 3);
  }

  function spawnBeam() {
    const x = 40 + Math.random() * (W - 80);
    state.beams.push({
      x,
      w: 30 + Math.random() * 40,
      timer: 90, // Warning phase
      active: false,
      lifetime: 60,
    });
    state.nextBeam = Math.max(80, 200 - state.difficulty * 8);
  }

  function spawnEnergy() {
    state.energyCells.push({
      x: 20 + Math.random() * (W - 40),
      y: -15,
      vy: 1 + Math.random(),
      pulse: Math.random() * Math.PI * 2,
    });
    state.nextEnergy = 100 + Math.random() * 80;
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    state.difficulty = 1 + Math.floor(state.score / 200);

    if (state.iframe > 0) state.iframe--;
    if (state.shootCD > 0) state.shootCD--;

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

    state.px += mx * 4.5;
    state.py += my * 4.5;
    state.px = Math.max(PLAYER_R, Math.min(W - PLAYER_R, state.px));
    state.py = Math.max(PLAYER_R, Math.min(H - PLAYER_R, state.py));

    // Shoot
    if ((keys[' '] || keys['Space'] || actionBtnRef.current) && state.shootCD === 0) {
      state.bullets.push({ x: state.px, y: state.py - PLAYER_R });
      state.shootCD = 10;
      actionBtnRef.current = false;
    }

    // Spawn
    state.nextAsteroid--;
    if (state.nextAsteroid <= 0) spawnAsteroid();
    state.nextBeam--;
    if (state.nextBeam <= 0) spawnBeam();
    state.nextEnergy--;
    if (state.nextEnergy <= 0) spawnEnergy();

    // Bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y -= BULLET_SPD;
      if (b.y < -10) { state.bullets.splice(i, 1); continue; }

      // Hit asteroids
      let hit = false;
      for (const a of state.asteroids) {
        if (a.hp <= 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.sqrt(dx * dx + dy * dy) < a.r + BULLET_R) {
          a.hp--;
          hit = true;
          addParticles(b.x, b.y, '#fff', 3);
          if (a.hp <= 0) {
            const pts = Math.round(a.r) * 2;
            state.score += pts;
            onScore(state.score);
            addParticles(a.x, a.y, C.asteroid, 8);
          }
          break;
        }
      }
      if (hit) state.bullets.splice(i, 1);
    }

    // Asteroids
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
      const a = state.asteroids[i];
      if (a.hp <= 0) { state.asteroids.splice(i, 1); continue; }
      a.x += a.vx;
      a.y += a.vy;
      a.rot += a.rotSpd;
      if (a.y > H + 40 || a.x < -40 || a.x > W + 40) {
        state.asteroids.splice(i, 1);
        continue;
      }

      // Player collision
      if (state.iframe === 0) {
        const dx = state.px - a.x, dy = state.py - a.y;
        if (Math.sqrt(dx * dx + dy * dy) < a.r + PLAYER_R - 4) {
          state.hp--;
          state.iframe = 50;
          state.screenShake = 8;
          onHpChange(state.hp, state.maxHp);
          addParticles(state.px, state.py, C.heart, 6);
          if (state.hp <= 0) { state.running = false; return; }
        }
      }
    }

    // Beams
    for (let i = state.beams.length - 1; i >= 0; i--) {
      const beam = state.beams[i];
      beam.timer--;
      if (beam.timer <= 0 && !beam.active) {
        beam.active = true;
      }
      if (beam.active) {
        beam.lifetime--;
        // Player damage
        if (state.iframe === 0 &&
            state.px > beam.x - beam.w / 2 - PLAYER_R &&
            state.px < beam.x + beam.w / 2 + PLAYER_R) {
          state.hp--;
          state.iframe = 50;
          state.screenShake = 10;
          onHpChange(state.hp, state.maxHp);
          addParticles(state.px, state.py, '#FFB300', 8);
          if (state.hp <= 0) { state.running = false; return; }
        }
        if (beam.lifetime <= 0) state.beams.splice(i, 1);
      }
    }

    // Energy cells
    for (let i = state.energyCells.length - 1; i >= 0; i--) {
      const e = state.energyCells[i];
      e.y += e.vy;
      e.pulse += 0.06;
      if (e.y > H + 20) { state.energyCells.splice(i, 1); continue; }

      const dx = state.px - e.x, dy = state.py - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < PLAYER_R + 10) {
        state.score += 30;
        onScore(state.score);
        addParticles(e.x, e.y, C.energy, 6);
        state.energyCells.splice(i, 1);
      }
    }

    // Score from time
    if (state.frame % 60 === 0) {
      state.score += 5;
      onScore(state.score);
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

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of state.stars) {
      ctx.globalAlpha = s.brightness + Math.sin(state.frame * 0.02 + s.x) * 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Beam warnings + active beams
    for (const beam of state.beams) {
      if (!beam.active) {
        // Warning: flashing zone
        ctx.globalAlpha = 0.05 + Math.sin(state.frame * 0.3) * 0.05;
        ctx.fillStyle = '#FFB300';
        ctx.fillRect(beam.x - beam.w / 2, 0, beam.w, H);
        ctx.globalAlpha = 1;
        // Warning lines
        ctx.strokeStyle = 'rgba(255,179,0,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(beam.x - beam.w / 2, 0);
        ctx.lineTo(beam.x - beam.w / 2, H);
        ctx.moveTo(beam.x + beam.w / 2, 0);
        ctx.lineTo(beam.x + beam.w / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Active beam
        const alpha = beam.lifetime / 60;
        ctx.fillStyle = C.beam;
        ctx.fillRect(beam.x - beam.w / 2, 0, beam.w, H);
        ctx.fillStyle = `rgba(255,179,0,${0.4 * alpha})`;
        ctx.fillRect(beam.x - beam.w / 4, 0, beam.w / 2, H);
      }
    }

    // Energy cells
    for (const e of state.energyCells) {
      const glow = 0.6 + Math.sin(e.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = C.energyGlow;
      ctx.shadowBlur = 10 * glow;
      ctx.fillStyle = C.energy;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Asteroids
    for (const a of state.asteroids) {
      if (a.hp <= 0) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.fillStyle = C.asteroid;
      ctx.beginPath();
      // Irregular asteroid shape
      for (let j = 0; j < 8; j++) {
        const angle = (j / 8) * Math.PI * 2;
        const r = a.r * (0.8 + ((j * 7 + a.r) % 5) / 12);
        if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.asteroidDark;
      ctx.beginPath();
      ctx.arc(2, -2, a.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    ctx.fillStyle = C.bullet;
    ctx.shadowColor = C.bullet;
    ctx.shadowBlur = 6;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 12;
    ctx.fillStyle = C.player;
    // Triangle ship
    ctx.beginPath();
    ctx.moveTo(state.px, state.py - PLAYER_R);
    ctx.lineTo(state.px - PLAYER_R * 0.8, state.py + PLAYER_R * 0.6);
    ctx.lineTo(state.px + PLAYER_R * 0.8, state.py + PLAYER_R * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.moveTo(state.px, state.py - PLAYER_R * 0.4);
    ctx.lineTo(state.px - PLAYER_R * 0.4, state.py + PLAYER_R * 0.3);
    ctx.lineTo(state.px + PLAYER_R * 0.4, state.py + PLAYER_R * 0.3);
    ctx.closePath();
    ctx.fill();
    // Engine glow
    ctx.fillStyle = `rgba(255,179,0,${0.3 + Math.sin(state.frame * 0.2) * 0.2})`;
    ctx.beginPath();
    ctx.arc(state.px, state.py + PLAYER_R * 0.8, 4 + Math.sin(state.frame * 0.3) * 2, 0, Math.PI * 2);
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
