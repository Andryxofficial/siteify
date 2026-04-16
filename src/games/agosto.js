/**
 * AGOSTO — Meteor Storm 🌟
 * Asteroids-style space game. Rotate ship, thrust, shoot meteors.
 * Controls: left/right rotate, up thrust, action shoot.
 */
export const meta = {
  name: 'Meteor Storm',
  emoji: '🌟',
  description: 'Distruggi i meteoriti nello spazio profondo!',
  color: '#7C4DFF',
  controls: 'joystick',
  instructions: 'Ruota con ← →, accelera con ↑. Spara con Spazio o il pulsante 🌟! I meteoriti si spezzano!',
  gameOverTitle: 'Nave distrutta!',
  actionLabel: '🔫',
};

const W = 480, H = 480;
const SHIP_R = 14;
const FRICTION = 0.985;
const THRUST = 0.15;
const TURN_SPD = 0.07;
const BULLET_SPD = 6;
const BULLET_LIFE = 50;

const C = {
  bg: '#05051a',
  ship: '#7C4DFF', shipDark: '#512DA8', thrust: '#FF6D00',
  meteor: '#78909C', meteorDark: '#455A64',
  fragment: '#B0BEC5',
  bullet: '#EA80FC',
  star: '#B39DDB', starGlow: 'rgba(179,157,219,0.4)',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  function spawnMeteor(size, x, y) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 0.5 + Math.random() * 1.5;
    return {
      x: x ?? (Math.random() < 0.5 ? -20 : W + 20),
      y: y ?? Math.random() * H,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r: size === 'big' ? 30 + Math.random() * 10 : size === 'med' ? 16 + Math.random() * 6 : 8 + Math.random() * 4,
      size,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.04,
      jagged: Array.from({ length: 8 }, () => 0.7 + Math.random() * 0.3),
    };
  }

  const state = {
    px: W / 2, py: H / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    score: 0,
    hp: 3, maxHp: 3,
    bullets: [],
    meteors: [],
    starFragments: [],
    particles: [],
    bgStars: [],
    running: true,
    frame: 0,
    shootCD: 0,
    iframe: 0,
    screenShake: 0,
    thrusting: false,
    wave: 1,
    lastHealAt: 0,
    healItems: [],
  };

  // Spawn initial meteors
  for (let i = 0; i < 4; i++) state.meteors.push(spawnMeteor('big'));

  // Background stars
  for (let i = 0; i < 80; i++) {
    state.bgStars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.3 + Math.random() * 1.5,
      bri: 0.1 + Math.random() * 0.4,
    });
  }

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1, decay: 0.03 + Math.random() * 0.03,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  function wrap(obj) {
    if (obj.x < -40) obj.x = W + 40;
    if (obj.x > W + 40) obj.x = -40;
    if (obj.y < -40) obj.y = H + 40;
    if (obj.y > H + 40) obj.y = -40;
  }

  function update() {
    if (!state.running) return;
    state.frame++;
    if (state.iframe > 0) state.iframe--;
    if (state.shootCD > 0) state.shootCD--;

    const keys = keysRef.current;
    const joy = joystickRef.current;

    // Rotation
    let turnInput = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) turnInput = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) turnInput = 1;
    if (joy.active) {
      // Use joystick angle for direct aiming
      if (Math.abs(joy.dx) > 0.3 || Math.abs(joy.dy) > 0.3) {
        const targetAngle = Math.atan2(joy.dy, joy.dx);
        let diff = targetAngle - state.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        turnInput = Math.max(-1, Math.min(1, diff / 0.3));
      }
    }
    state.angle += turnInput * TURN_SPD;

    // Thrust
    state.thrusting = !!(keys['ArrowUp'] || keys['w'] || keys['W'] || (joy.active && (Math.abs(joy.dx) > 0.3 || Math.abs(joy.dy) > 0.3)));
    if (state.thrusting) {
      state.vx += Math.cos(state.angle) * THRUST;
      state.vy += Math.sin(state.angle) * THRUST;
    }

    // Friction
    state.vx *= FRICTION;
    state.vy *= FRICTION;
    state.px += state.vx;
    state.py += state.vy;
    wrap(state);

    // Shoot
    if ((keys[' '] || keys['Space'] || actionBtnRef.current) && state.shootCD === 0) {
      state.bullets.push({
        x: state.px + Math.cos(state.angle) * SHIP_R,
        y: state.py + Math.sin(state.angle) * SHIP_R,
        vx: Math.cos(state.angle) * BULLET_SPD + state.vx * 0.5,
        vy: Math.sin(state.angle) * BULLET_SPD + state.vy * 0.5,
        life: BULLET_LIFE,
      });
      state.shootCD = 12;
      actionBtnRef.current = false;
    }

    // Bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx; b.y += b.vy;
      b.life--;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        state.bullets.splice(i, 1);
        continue;
      }

      // Hit meteors
      let hit = false;
      for (let j = state.meteors.length - 1; j >= 0; j--) {
        const m = state.meteors[j];
        const dx = b.x - m.x, dy = b.y - m.y;
        if (Math.sqrt(dx * dx + dy * dy) < m.r + 4) {
          hit = true;
          addParticles(m.x, m.y, C.fragment, 6);

          // Split meteor
          if (m.size === 'big') {
            state.meteors.push(spawnMeteor('med', m.x - 10, m.y));
            state.meteors.push(spawnMeteor('med', m.x + 10, m.y));
            state.score += 20;
          } else if (m.size === 'med') {
            state.meteors.push(spawnMeteor('small', m.x - 5, m.y));
            state.meteors.push(spawnMeteor('small', m.x + 5, m.y));
            state.score += 50;
          } else {
            state.score += 100;
            // Drop star fragment
            if (Math.random() < 0.3) {
              state.starFragments.push({
                x: m.x, y: m.y,
                pulse: 0,
              });
            }
          }
          onScore(state.score);
          state.meteors.splice(j, 1);
          break;
        }
      }
      if (hit) state.bullets.splice(i, 1);
    }

    // Meteors movement
    for (const m of state.meteors) {
      m.x += m.vx; m.y += m.vy;
      m.rot += m.rotSpd;
      wrap(m);

      // Player collision
      if (state.iframe === 0) {
        const dx = state.px - m.x, dy = state.py - m.y;
        if (Math.sqrt(dx * dx + dy * dy) < m.r + SHIP_R - 6) {
          state.hp--;
          state.iframe = 60;
          state.screenShake = 10;
          onHpChange(state.hp, state.maxHp);
          addParticles(state.px, state.py, C.heart, 8);
          if (state.hp <= 0) { state.running = false; return; }
        }
      }
    }

    // Star fragments
    for (let i = state.starFragments.length - 1; i >= 0; i--) {
      const s = state.starFragments[i];
      s.pulse += 0.06;
      const dx = state.px - s.x, dy = state.py - s.y;
      if (Math.sqrt(dx * dx + dy * dy) < 18) {
        state.score += 150;
        onScore(state.score);
        addParticles(s.x, s.y, C.star, 8);
        state.starFragments.splice(i, 1);
      }
    }

    // New wave if all meteors destroyed
    if (state.meteors.length === 0) {
      state.wave++;
      const count = Math.min(3 + state.wave, 10);
      for (let i = 0; i < count; i++) state.meteors.push(spawnMeteor('big'));
      state.score += state.wave * 50;
      onScore(state.score);
    }

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(state.score / 1000);
    if (healMilestone > state.lastHealAt && state.hp < state.maxHp) {
      state.lastHealAt = healMilestone;
      state.healItems.push({
        x: Math.random() * W,
        y: Math.random() * H,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    for (let i = state.healItems.length - 1; i >= 0; i--) {
      const h = state.healItems[i];
      h.pulse += 0.08;
      const dx = state.px - h.x, dy = state.py - h.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
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

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Background stars
    for (const s of state.bgStars) {
      ctx.globalAlpha = s.bri + Math.sin(state.frame * 0.01 + s.x * 0.1) * 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Star fragments
    for (const s of state.starFragments) {
      const glow = 0.6 + Math.sin(s.pulse) * 0.3;
      ctx.save();
      ctx.shadowColor = C.starGlow;
      ctx.shadowBlur = 12 * glow;
      ctx.fillStyle = C.star;
      ctx.translate(s.x, s.y);
      // Star shape
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2 - Math.PI / 2 + s.pulse * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 5, Math.sin(angle) * 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Meteors
    for (const m of state.meteors) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      ctx.fillStyle = C.meteor;
      ctx.beginPath();
      for (let j = 0; j < m.jagged.length; j++) {
        const angle = (j / m.jagged.length) * Math.PI * 2;
        const r = m.r * m.jagged[j];
        if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.meteorDark;
      ctx.beginPath();
      ctx.arc(m.r * 0.15, -m.r * 0.15, m.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    ctx.fillStyle = C.bullet;
    ctx.shadowColor = C.bullet;
    ctx.shadowBlur = 6;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

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

    // Ship
    ctx.save();
    if (state.iframe > 0 && state.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.translate(state.px, state.py);
    ctx.rotate(state.angle + Math.PI / 2);
    ctx.shadowColor = C.ship;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.ship;
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_R);
    ctx.lineTo(-SHIP_R * 0.7, SHIP_R * 0.6);
    ctx.lineTo(0, SHIP_R * 0.3);
    ctx.lineTo(SHIP_R * 0.7, SHIP_R * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.shipDark;
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_R * 0.5);
    ctx.lineTo(-SHIP_R * 0.3, SHIP_R * 0.3);
    ctx.lineTo(SHIP_R * 0.3, SHIP_R * 0.3);
    ctx.closePath();
    ctx.fill();
    // Thrust flame
    if (state.thrusting) {
      ctx.fillStyle = C.thrust;
      ctx.globalAlpha = 0.6 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(-SHIP_R * 0.3, SHIP_R * 0.6);
      ctx.lineTo(0, SHIP_R * 0.6 + 8 + Math.random() * 8);
      ctx.lineTo(SHIP_R * 0.3, SHIP_R * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
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
    ctx.fillText(`Ondata ${state.wave}`, W - 12, 34);
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
