/**
 * FEBBRAIO — Heart Breaker 💕
 * Valentine's-themed collection game.  Catch falling hearts for points,
 * dodge broken hearts (damage).  Action button triggers a brief shield.
 * Difficulty ramps with score.  Heal power-up every 1000 pts.
 *
 * Controls: joystick / WASD / arrows to move, action button for shield.
 */

export const meta = {
  name: 'Heart Breaker',
  emoji: '💕',
  description: 'Cattura i cuori e evita quelli spezzati!',
  color: '#FF69B4',
  controls: 'joystick',
  instructions: 'Muovi con joystick o WASD. Raccogli i cuori, evita quelli spezzati! Premi 💘 per lo scudo.',
  gameOverTitle: 'Cuore spezzato!',
  actionLabel: '💘',
};

/* ── constants ── */
const W = 480, H = 480;
const PLAYER_R = 16;
const HEART_R = 14;
const BROKEN_R = 14;
const HEAL_R = 14;
const SHIELD_DURATION = 90;   // frames (~1.5 s)
const SHIELD_COOLDOWN = 240;  // frames (~4 s)
const MAX_PARTICLES = 300;
const MAX_STARS = 60;

function rng(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ── canvas heart drawing (no emoji, pure vector) ── */
function drawHeart(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
  ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size);
  ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.6, x + size, y + size * 0.1);
  ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
  ctx.closePath();
}

function drawBrokenHeart(ctx, x, y, size) {
  ctx.save();
  // Left half
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
  ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size);
  ctx.lineTo(x - 2, y + size * 0.55);
  ctx.lineTo(x + 2, y + size * 0.3);
  ctx.lineTo(x - 1, y + size * 0.05);
  ctx.closePath();
  ctx.fill();
  // Right half (offset slightly)
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y - size * 0.3, x + size, y - size * 0.3, x + size, y + size * 0.1);
  ctx.bezierCurveTo(x + size, y + size * 0.6, x, y + size, x, y + size);
  ctx.lineTo(x + 2, y + size * 0.55);
  ctx.lineTo(x - 2, y + size * 0.3);
  ctx.lineTo(x + 1, y + size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCross(ctx, x, y, size) {
  const t = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - t, y - size);
  ctx.lineTo(x + t, y - size);
  ctx.lineTo(x + t, y - t);
  ctx.lineTo(x + size, y - t);
  ctx.lineTo(x + size, y + t);
  ctx.lineTo(x + t, y + t);
  ctx.lineTo(x + t, y + size);
  ctx.lineTo(x - t, y + size);
  ctx.lineTo(x - t, y + t);
  ctx.lineTo(x - size, y + t);
  ctx.lineTo(x - size, y - t);
  ctx.lineTo(x - t, y - t);
  ctx.closePath();
}

/* ── main ── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── state ── */
  const s = {
    px: W / 2, py: H - 60, vx: 0, vy: 0,
    score: 0, hp: 3, maxHp: 3,
    running: true, frame: 0,
    hearts: [], brokens: [], healItems: [],
    particles: [], floatTexts: [], stars: [],
    shake: 0, iframe: 0,
    shieldTimer: 0, shieldCooldown: 0,
    lastHealAt: 0,
    spawnTimer: 0,
    difficulty: 1,
    // parallax background
    bgLayers: [],
    trail: [],
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  // Generate background stars
  for (let i = 0; i < MAX_STARS; i++) {
    s.stars.push({
      x: rng(0, W), y: rng(0, H),
      size: rng(0.5, 2), twinkle: rng(0, Math.PI * 2),
      speed: rng(0.005, 0.03),
    });
  }

  // Parallax heart layers (ambient, not collectible)
  for (let layer = 0; layer < 3; layer++) {
    const items = [];
    for (let i = 0; i < 5 + layer * 2; i++) {
      items.push({
        x: rng(0, W), y: rng(0, H),
        size: rng(6, 14) * (1 - layer * 0.25),
        drift: rng(-0.15, 0.15),
        fall: rng(0.1, 0.35) * (1 - layer * 0.2),
      });
    }
    s.bgLayers.push({ items, opacity: 0.025 + layer * 0.008, parallax: 0.3 + layer * 0.2 });
  }

  /* ── helpers ── */
  function addParticles(x, y, color, count, opts = {}) {
    const { spread = 4, grav = 0.08, sMin = 1.5, sMax = 3.5, shape = 'circle' } = opts;
    for (let i = 0; i < count && s.particles.length < MAX_PARTICLES; i++) {
      s.particles.push({
        x, y, vx: rng(-spread, spread), vy: rng(-spread, spread * 0.5),
        life: 1, decay: rng(0.015, 0.035),
        color, size: rng(sMin, sMax), grav, shape,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
  }

  function spawnHeart() {
    const fast = Math.random() < 0.15 + s.difficulty * 0.04;
    const big = !fast && Math.random() < 0.12;
    s.hearts.push({
      x: rng(HEART_R + 10, W - HEART_R - 10),
      y: -HEART_R * 2,
      vy: (fast ? rng(3.5, 5) : rng(1.5, 2.5)) + s.difficulty * 0.25,
      vx: rng(-0.4, 0.4),
      size: big ? rng(18, 22) : rng(11, 15),
      points: big ? 25 : (fast ? 15 : 10),
      pulse: rng(0, Math.PI * 2),
      fast,
      rot: 0, rotSpeed: rng(-0.02, 0.02),
    });
  }

  function spawnBroken() {
    const sway = Math.random() < 0.3;
    s.brokens.push({
      x: rng(BROKEN_R + 10, W - BROKEN_R - 10),
      y: -BROKEN_R * 2,
      vy: rng(1.2, 2.5) + s.difficulty * 0.2,
      vx: sway ? rng(-1.5, 1.5) : rng(-0.3, 0.3),
      sway, swayPhase: rng(0, Math.PI * 2),
      size: rng(12, 16),
      rot: 0, rotSpeed: rng(-0.03, 0.03),
    });
  }

  function spawnHeal() {
    s.healItems.push({
      x: rng(HEAL_R + 20, W - HEAL_R - 20),
      y: -HEAL_R * 2,
      vy: rng(1.0, 1.6),
      pulse: rng(0, Math.PI * 2),
    });
  }

  function takeDamage() {
    if (s.iframe > 0 || s.shieldTimer > 0) return;
    s.hp--;
    s.shake = 10;
    s.iframe = 60;
    onHpChange(s.hp, s.maxHp);
    addParticles(s.px, s.py, '#ff2266', 20, { spread: 6 });
    if (s.hp <= 0) {
      s.running = false;
    }
  }

  /* ── update ── */
  function update() {
    if (!s.running) return;
    s.frame++;
    if (s.iframe > 0) s.iframe--;
    if (s.shieldTimer > 0) s.shieldTimer--;
    if (s.shieldCooldown > 0) s.shieldCooldown--;

    // Difficulty ramps with score
    s.difficulty = 1 + Math.floor(s.score / 300) * 0.15;

    /* ── input ── */
    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) my += 1;
    const joy = joystickRef.current;
    if (joy && joy.active) { mx += joy.dx; my += joy.dy; }
    const len = Math.sqrt(mx * mx + my * my);
    if (len > 1) { mx /= len; my /= len; }

    const speed = 5.5;
    s.vx = lerp(s.vx, mx * speed, 0.25);
    s.vy = lerp(s.vy, my * speed, 0.25);
    s.px = clamp(s.px + s.vx, PLAYER_R, W - PLAYER_R);
    s.py = clamp(s.py + s.vy, PLAYER_R + 40, H - PLAYER_R);

    // Trail (for visual flair)
    if (s.frame % 2 === 0) {
      s.trail.push({ x: s.px, y: s.py, life: 1 });
      if (s.trail.length > 15) s.trail.shift();
    }
    for (const t of s.trail) t.life -= 0.07;

    // Shield activation
    if (actionBtnRef && actionBtnRef.current && s.shieldTimer === 0 && s.shieldCooldown === 0) {
      s.shieldTimer = SHIELD_DURATION;
      s.shieldCooldown = SHIELD_COOLDOWN;
      addParticles(s.px, s.py, '#88eeff', 12, { spread: 3, sMin: 2, sMax: 4 });
    }

    /* ── spawning ── */
    s.spawnTimer++;
    const spawnRate = Math.max(18, 50 - s.difficulty * 3);
    if (s.spawnTimer >= spawnRate) {
      s.spawnTimer = 0;
      // Ratio of broken hearts increases with difficulty
      const brokenChance = clamp(0.2 + s.difficulty * 0.04, 0.2, 0.55);
      if (Math.random() < brokenChance) {
        spawnBroken();
      } else {
        spawnHeart();
      }
    }

    /* ── heal milestone ── */
    const milestone = Math.floor(s.score / 1000);
    if (milestone > s.lastHealAt) {
      s.lastHealAt = milestone;
      if (s.hp < s.maxHp) spawnHeal();
    }

    /* ── move & collide hearts ── */
    for (let i = s.hearts.length - 1; i >= 0; i--) {
      const h = s.hearts[i];
      h.y += h.vy;
      h.x += h.vx;
      h.pulse += 0.06;
      h.rot += h.rotSpeed;
      if (h.y > H + 30) { s.hearts.splice(i, 1); continue; }
      if (dist(s.px, s.py, h.x, h.y) < PLAYER_R + h.size * 0.7) {
        s.score += h.points;
        onScore(s.score);
        addFloatText(h.x, h.y - 10, `+${h.points}`, h.points >= 25 ? '#ffdd57' : '#ff7eb3');
        addParticles(h.x, h.y, '#ff7eb3', 8, { spread: 3, shape: 'heart' });
        s.hearts.splice(i, 1);
      }
    }

    /* ── move & collide broken hearts ── */
    for (let i = s.brokens.length - 1; i >= 0; i--) {
      const b = s.brokens[i];
      b.y += b.vy;
      b.x += b.vx;
      if (b.sway) b.x += Math.sin(s.frame * 0.05 + b.swayPhase) * 1.2;
      b.rot += b.rotSpeed;
      if (b.y > H + 30) { s.brokens.splice(i, 1); continue; }
      if (dist(s.px, s.py, b.x, b.y) < PLAYER_R + b.size * 0.6) {
        if (s.shieldTimer > 0) {
          // Shield deflects — bonus points
          s.score += 5;
          onScore(s.score);
          addFloatText(b.x, b.y - 10, '🛡+5', '#88eeff');
          addParticles(b.x, b.y, '#88eeff', 10, { spread: 5 });
        } else {
          takeDamage();
          addFloatText(b.x, b.y - 10, '-1 ♥', '#ff2266');
        }
        s.brokens.splice(i, 1);
      }
    }

    /* ── heal items ── */
    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.y += h.vy;
      h.pulse += 0.07;
      if (h.y > H + 30) { s.healItems.splice(i, 1); continue; }
      if (dist(s.px, s.py, h.x, h.y) < PLAYER_R + HEAL_R) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addFloatText(h.x, h.y - 10, '+HP', '#44ff88');
        addParticles(h.x, h.y, '#44ff88', 14, { spread: 4 });
        s.healItems.splice(i, 1);
      }
    }

    /* ── particles ── */
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.grav;
      p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    /* ── float texts ── */
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.018;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    /* ── background stars twinkle ── */
    for (const st of s.stars) st.twinkle += st.speed;

    /* ── parallax layers drift ── */
    for (const layer of s.bgLayers) {
      for (const item of layer.items) {
        item.y += item.fall;
        item.x += item.drift;
        if (item.y > H + 20) { item.y = -20; item.x = rng(0, W); }
        if (item.x < -20) item.x = W + 20;
        if (item.x > W + 20) item.x = -20;
      }
    }

    if (s.shake > 0) s.shake--;
  }

  /* ── draw ── */
  function draw() {
    ctx.save();

    // Screen shake
    if (s.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * s.shake * 2,
        (Math.random() - 0.5) * s.shake * 2,
      );
    }

    /* ── background gradient ── */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0e17');
    bg.addColorStop(0.6, '#12081f');
    bg.addColorStop(1, '#1a0a24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* ── stars ── */
    for (const st of s.stars) {
      const alpha = 0.25 + Math.sin(st.twinkle) * 0.25;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#eeddff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* ── parallax ambient hearts ── */
    for (const layer of s.bgLayers) {
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = '#ff69b4';
      for (const item of layer.items) {
        ctx.save();
        ctx.translate(item.x, item.y);
        drawHeart(ctx, 0, 0, item.size);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    /* ── falling hearts (collectibles) ── */
    for (const h of s.hearts) {
      const pulse = 1 + Math.sin(h.pulse) * 0.08;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.scale(pulse, pulse);
      // Glow
      ctx.shadowColor = h.fast ? '#ffaa44' : '#ff69b4';
      ctx.shadowBlur = h.fast ? 18 : 12;
      // Gradient fill
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, h.size);
      if (h.fast) {
        grad.addColorStop(0, '#ffcc66');
        grad.addColorStop(1, '#ff6633');
      } else if (h.points >= 25) {
        grad.addColorStop(0, '#ffee88');
        grad.addColorStop(1, '#ffaa44');
      } else {
        grad.addColorStop(0, '#ff9ec8');
        grad.addColorStop(1, '#ff3388');
      }
      ctx.fillStyle = grad;
      drawHeart(ctx, 0, -h.size * 0.25, h.size);
      ctx.fill();
      // Specular highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(-h.size * 0.3, -h.size * 0.15, h.size * 0.22, h.size * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ── broken hearts (hazards) ── */
    for (const b of s.brokens) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.shadowColor = '#8833aa';
      ctx.shadowBlur = 10;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
      grad.addColorStop(0, '#cc44aa');
      grad.addColorStop(1, '#662266');
      ctx.fillStyle = grad;
      drawBrokenHeart(ctx, 0, -b.size * 0.25, b.size);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* ── heal items (green cross) ── */
    for (const h of s.healItems) {
      const pulse = 1 + Math.sin(h.pulse) * 0.12;
      const bob = Math.sin(h.pulse * 1.3) * 3;
      ctx.save();
      ctx.translate(h.x, h.y + bob);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = '#44ff88';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#44ff88';
      drawCross(ctx, 0, 0, HEAL_R * 0.6);
      ctx.fill();
      // Inner glow
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      drawCross(ctx, 0, 0, HEAL_R * 0.3);
      ctx.fill();
      ctx.restore();
    }

    /* ── player trail ── */
    for (const t of s.trail) {
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life * 0.2;
      ctx.fillStyle = s.shieldTimer > 0 ? '#88eeff' : '#ff69b4';
      ctx.beginPath();
      ctx.arc(t.x, t.y, PLAYER_R * t.life * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* ── player ── */
    const blinkOff = s.iframe > 0 && Math.floor(s.iframe / 4) % 2 === 0;
    if (!blinkOff) {
      ctx.save();
      ctx.translate(s.px, s.py);

      // Shield bubble
      if (s.shieldTimer > 0) {
        const sa = s.shieldTimer < 30 ? s.shieldTimer / 30 : 1;
        ctx.globalAlpha = sa * 0.3;
        const shieldGrad = ctx.createRadialGradient(0, 0, PLAYER_R, 0, 0, PLAYER_R + 12);
        shieldGrad.addColorStop(0, 'rgba(136,238,255,0.5)');
        shieldGrad.addColorStop(1, 'rgba(136,238,255,0)');
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = sa * 0.6;
        ctx.strokeStyle = '#88eeff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Player body (radial gradient orb)
      const bodyGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, PLAYER_R);
      bodyGrad.addColorStop(0, '#ffe0f0');
      bodyGrad.addColorStop(0.5, '#ff69b4');
      bodyGrad.addColorStop(1, '#cc2277');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();

      // Inner heart on player
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const hs = 7;
      drawHeart(ctx, 0, -hs * 0.4, hs);
      ctx.fill();

      ctx.restore();
    }

    /* ── particles ── */
    for (const p of s.particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      if (p.shape === 'heart') {
        ctx.save();
        ctx.translate(p.x, p.y);
        drawHeart(ctx, 0, 0, p.size * p.life);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    /* ── float texts ── */
    for (const ft of s.floatTexts) {
      ctx.globalAlpha = clamp(ft.life, 0, 1);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    /* ── vignette ── */
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    /* ── HUD ── */
    // Hearts for HP
    ctx.textAlign = 'left';
    for (let i = 0; i < s.maxHp; i++) {
      const hx = 14 + i * 24, hy = 22;
      ctx.save();
      ctx.translate(hx, hy);
      if (i < s.hp) {
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff3366';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,51,102,0.2)';
      }
      drawHeart(ctx, 0, -5, 8);
      ctx.fill();
      ctx.restore();
    }

    // Score
    ctx.fillStyle = '#f0ecf4';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 4;
    ctx.fillText(`✦ ${s.score}`, W - 14, 22);
    ctx.shadowBlur = 0;

    // Shield cooldown indicator
    if (s.shieldCooldown > 0 && s.shieldTimer === 0) {
      const pct = 1 - s.shieldCooldown / SHIELD_COOLDOWN;
      ctx.fillStyle = 'rgba(136,238,255,0.3)';
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillText(`🛡 ${Math.ceil(pct * 100)}%`, W - 14, 38);
    } else if (s.shieldTimer > 0) {
      ctx.fillStyle = '#88eeff';
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillText('🛡 ATTIVO', W - 14, 38);
    } else {
      ctx.fillStyle = 'rgba(136,238,255,0.6)';
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillText('🛡 Pronto', W - 14, 38);
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ── game loop ── */
  function gameLoop() {
    update();
    draw();
    if (s.running) {
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      onGameOver(s.score);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);

  return function cleanup() {
    s.running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
