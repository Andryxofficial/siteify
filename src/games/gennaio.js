/**
 * GENNAIO — Frost Dash ❄️
 * Premium endless ice runner with parallax, particle trails, and smooth physics.
 *
 * Controls: tap/space to jump (auto-runner).
 * Features: 3 HP, heal every 1000 pts, crystal collectibles, parallax mountains,
 *           ice obstacle variety, snowfall, screen shake, particle effects.
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
const GRAVITY = 0.52;
const JUMP_FORCE = -10.5;
const GROUND_Y = H - 80;
const PX = 80; // player X (fixed)
const PR = 14; // player radius

function rng(min, max) { return min + Math.random() * (max - min); }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

export function createGame(canvas, { keysRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── State ── */
  const s = {
    py: GROUND_Y - PR, vy: 0, onGround: true,
    score: 0, distance: 0, speed: 3.5,
    hp: 3, maxHp: 3,
    running: true, frame: 0,
    obstacles: [], crystals: [], particles: [], snowflakes: [],
    healItems: [], floatTexts: [],
    shake: 0, iframe: 0,
    nextObstacle: 100, nextCrystal: 70,
    jumpHeld: false, lastHealAt: 0,
    // Parallax layers
    mountains: [],
    groundOffset: 0,
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  // Generate snowflakes
  for (let i = 0; i < 50; i++) {
    s.snowflakes.push({
      x: rng(0, W), y: rng(0, H),
      size: rng(1, 3), speed: rng(0.3, 0.8),
      drift: rng(-0.2, 0.2), opacity: rng(0.2, 0.6),
    });
  }

  // Generate parallax mountains
  for (let layer = 0; layer < 3; layer++) {
    const peaks = [];
    const count = 6 + layer * 3;
    for (let i = 0; i < count; i++) {
      peaks.push({
        x: (W / count) * i + rng(-20, 20),
        h: rng(40, 120) * (1 - layer * 0.3),
        w: rng(40, 80),
      });
    }
    s.mountains.push({ peaks, parallax: 0.1 + layer * 0.15, color: `rgba(15,34,64,${0.8 - layer * 0.2})` });
  }

  /* ── Helpers ── */
  function addParticles(x, y, color, count, opts = {}) {
    const { spread = 4, gravity = 0.1, sizeMin = 1.5, sizeMax = 3.5 } = opts;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y, vx: rng(-spread, spread), vy: rng(-spread, spread / 2),
        life: 1, decay: rng(0.02, 0.04),
        color, size: rng(sizeMin, sizeMax), gravity,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function spawnObstacle() {
    const type = Math.random();
    let w, h;
    if (type < 0.4) {
      // Tall thin ice spike
      w = rng(14, 20); h = rng(35, 55);
    } else if (type < 0.7) {
      // Wide short ice block
      w = rng(25, 40); h = rng(20, 30);
    } else {
      // Medium
      w = rng(18, 28); h = rng(28, 42);
    }
    s.obstacles.push({ x: W + 20, w, h, y: GROUND_Y - h });
    const minGap = Math.max(45, 90 - Math.min(s.distance / 300, 40));
    s.nextObstacle = minGap + rng(0, 60);
  }

  function spawnCrystal() {
    const high = Math.random() < 0.35;
    s.crystals.push({
      x: W + 20,
      y: high ? GROUND_Y - rng(80, 140) : GROUND_Y - rng(25, 45),
      collected: false, pulse: rng(0, Math.PI * 2),
    });
    s.nextCrystal = rng(50, 90);
  }

  /* ── Update ── */
  function update() {
    if (!s.running) return;
    s.frame++;
    s.distance += s.speed;
    s.speed = 3.5 + Math.min(s.distance / 500, 5);
    s.groundOffset = (s.groundOffset + s.speed) % 24;

    // Score from distance
    const newScore = Math.floor(s.distance / 10);
    if (newScore !== s.score) {
      s.score = newScore;
      onScore(s.score);
    }

    // ── Jump input ──
    const wantJump = keysRef.current[' '] || keysRef.current['Space'] ||
                     keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W'] ||
                     actionBtnRef.current;
    if (wantJump && !s.jumpHeld && s.onGround) {
      s.vy = JUMP_FORCE;
      s.onGround = false;
      s.jumpHeld = true;
      addParticles(PX, GROUND_Y, 'rgba(129,212,250,0.6)', 5, { spread: 3 });
    }
    if (!wantJump) {
      s.jumpHeld = false;
      actionBtnRef.current = false;
    }

    // Physics
    s.vy += GRAVITY;
    s.py += s.vy;
    if (s.py >= GROUND_Y - PR) {
      s.py = GROUND_Y - PR;
      s.vy = 0;
      if (!s.onGround) {
        addParticles(PX, GROUND_Y, 'rgba(129,212,250,0.4)', 3, { spread: 2 });
      }
      s.onGround = true;
    }

    // Running particles (trail)
    if (s.onGround && s.frame % 4 === 0) {
      s.particles.push({
        x: PX - 8, y: GROUND_Y - 2,
        vx: rng(-1.5, -0.5), vy: rng(-0.5, 0),
        life: 1, decay: 0.05, color: 'rgba(255,255,255,0.3)', size: rng(1, 2.5), gravity: 0,
      });
    }

    // iframes
    if (s.iframe > 0) s.iframe--;

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(s.score / 1000);
    if (healMilestone > s.lastHealAt && s.hp < s.maxHp) {
      s.lastHealAt = healMilestone;
      s.healItems.push({
        x: W + 20, y: GROUND_Y - rng(40, 80), pulse: 0,
      });
      addFloatText(W / 2, 60, '♥ CURA IN ARRIVO!', '#00ff80');
    }

    // Spawn
    s.nextObstacle--;
    if (s.nextObstacle <= 0) spawnObstacle();
    s.nextCrystal--;
    if (s.nextCrystal <= 0) spawnCrystal();

    // ── Move obstacles ──
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const o = s.obstacles[i];
      o.x -= s.speed;
      if (o.x + o.w < -20) { s.obstacles.splice(i, 1); continue; }

      // Collision — circle vs rect
      if (s.iframe === 0) {
        const cx = PX, cy = s.py;
        const nearX = Math.max(o.x, Math.min(cx, o.x + o.w));
        const nearY = Math.max(o.y, Math.min(cy, o.y + o.h));
        if (dist(cx, cy, nearX, nearY) < PR * 0.65) {
          s.hp--;
          s.iframe = 60;
          s.shake = 8;
          onHpChange(s.hp, s.maxHp);
          addParticles(PX, s.py, '#FF0050', 8, { spread: 5 });
          if (s.hp <= 0) {
            s.running = false;
          }
        }
      }
    }

    // ── Move crystals ──
    for (let i = s.crystals.length - 1; i >= 0; i--) {
      const c = s.crystals[i];
      c.x -= s.speed;
      c.pulse += 0.06;
      if (c.x < -20) { s.crystals.splice(i, 1); continue; }
      if (c.collected) continue;

      if (dist(PX, s.py, c.x, c.y) < PR + 10) {
        c.collected = true;
        s.score += 50;
        onScore(s.score);
        addParticles(c.x, c.y, '#E1F5FE', 8, { spread: 4 });
        addFloatText(c.x, c.y - 15, '+50', '#E1F5FE');
      }
    }

    // ── Heal items ──
    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.x -= s.speed;
      h.pulse += 0.08;
      if (h.x < -20) { s.healItems.splice(i, 1); continue; }
      if (dist(PX, s.py, h.x, h.y) < PR + 12) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, h.y, '#00ff80', 10, { spread: 5 });
        addFloatText(h.x, h.y - 15, '♥ MAX!', '#00ff80');
        s.healItems.splice(i, 1);
      }
    }

    // ── Particles ──
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // ── Float texts ──
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y -= 0.7; ft.life -= 0.025;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    // ── Snowflakes ──
    for (const f of s.snowflakes) {
      f.y += f.speed;
      f.x += f.drift - s.speed * 0.1;
      if (f.y > H) { f.y = -5; f.x = rng(0, W); }
      if (f.x < -5) f.x = W + 5;
      if (f.x > W + 5) f.x = -5;
    }

    if (s.shake > 0) s.shake -= 0.5;
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();

    // Screen shake
    if (s.shake > 0) {
      ctx.translate(rng(-s.shake, s.shake), rng(-s.shake, s.shake));
    }

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#060d1f');
    skyGrad.addColorStop(0.5, '#0a1628');
    skyGrad.addColorStop(1, '#0f2240');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Stars ──
    for (let i = 0; i < 35; i++) {
      const sx = ((i * 137.5 + 23) % W);
      const sy = ((i * 91.3 + 10) % (GROUND_Y - 60)) + 10;
      const twinkle = 0.15 + Math.sin(s.frame * 0.02 + i) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Parallax mountains ──
    for (const layer of s.mountains) {
      const offset = (s.distance * layer.parallax) % W;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (const peak of layer.peaks) {
        const px = ((peak.x - offset) % W + W) % W;
        ctx.lineTo(px - peak.w / 2, GROUND_Y);
        ctx.lineTo(px, GROUND_Y - peak.h);
        ctx.lineTo(px + peak.w / 2, GROUND_Y);
      }
      ctx.lineTo(W, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    // ── Snowflakes (behind ground) ──
    for (const f of s.snowflakes) {
      ctx.globalAlpha = f.opacity;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Ground ──
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrad.addColorStop(0, '#2a5a8c');
    groundGrad.addColorStop(0.05, '#1a3a5c');
    groundGrad.addColorStop(1, '#0f2240');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    // Ice surface highlight
    ctx.fillStyle = 'rgba(129,212,250,0.12)';
    ctx.fillRect(0, GROUND_Y, W, 3);
    // Ground texture lines
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = -24; x < W + 24; x += 24) {
      ctx.fillRect(x - s.groundOffset, GROUND_Y + 10, 14, 2);
    }

    // ── Obstacles ──
    for (const o of s.obstacles) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(o.x + 3, GROUND_Y - 2, o.w, 4);
      // Main block
      const oGrad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
      oGrad.addColorStop(0, '#1976D2');
      oGrad.addColorStop(1, '#0D47A1');
      ctx.fillStyle = oGrad;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      // Top highlight
      ctx.fillStyle = 'rgba(129,212,250,0.25)';
      ctx.fillRect(o.x, o.y, o.w, 3);
      // Left shine
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(o.x + 2, o.y + 4, 3, o.h * 0.5);
      // Edge
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    }

    // ── Crystals ──
    for (const c of s.crystals) {
      if (c.collected) continue;
      const glow = 0.7 + Math.sin(c.pulse) * 0.3;
      const bobY = Math.sin(c.pulse * 1.3) * 3;
      // Glow
      const cGrad = ctx.createRadialGradient(c.x, c.y + bobY, 0, c.x, c.y + bobY, 16 * glow);
      cGrad.addColorStop(0, 'rgba(225,245,254,0.2)');
      cGrad.addColorStop(1, 'rgba(225,245,254,0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bobY, 16 * glow, 0, Math.PI * 2);
      ctx.fill();
      // Diamond
      ctx.save();
      ctx.translate(c.x, c.y + bobY);
      ctx.rotate(Math.PI / 4 + Math.sin(c.pulse * 0.5) * 0.1);
      ctx.fillStyle = '#B3E5FC';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#E1F5FE';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }

    // ── Heal items ──
    for (const h of s.healItems) {
      const glow = 0.7 + Math.sin(h.pulse) * 0.3;
      const bobY = Math.sin(h.pulse) * 3;
      const hGrad = ctx.createRadialGradient(h.x, h.y + bobY, 0, h.x, h.y + bobY, 18 * glow);
      hGrad.addColorStop(0, 'rgba(0,255,128,0.15)');
      hGrad.addColorStop(1, 'rgba(0,255,128,0)');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.arc(h.x, h.y + bobY, 18 * glow, 0, Math.PI * 2);
      ctx.fill();
      // Cross
      ctx.fillStyle = '#00ff80';
      ctx.fillRect(h.x - 2, h.y + bobY - 7, 4, 14);
      ctx.fillRect(h.x - 7, h.y + bobY - 2, 14, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(h.x - 1, h.y + bobY - 5, 2, 10);
      ctx.fillRect(h.x - 5, h.y + bobY - 1, 10, 2);
    }

    // ── Player ──
    ctx.save();
    if (s.iframe > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.25;
    const py = s.py;
    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(PX, GROUND_Y + 2, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    const pGrad = ctx.createRadialGradient(PX, py, 0, PX, py, 22);
    pGrad.addColorStop(0, 'rgba(79,195,247,0.12)');
    pGrad.addColorStop(1, 'rgba(79,195,247,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(PX, py, 22, 0, Math.PI * 2);
    ctx.fill();
    // Body (circle)
    ctx.fillStyle = '#4FC3F7';
    ctx.beginPath();
    ctx.arc(PX, py, PR, 0, Math.PI * 2);
    ctx.fill();
    // Inner
    ctx.fillStyle = '#0288D1';
    ctx.beginPath();
    ctx.arc(PX, py, PR * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Eyes — facing right
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PX + 5, py - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PX + 5, py + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#0a1628';
    ctx.beginPath();
    ctx.arc(PX + 6.5, py - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PX + 6.5, py + 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Scarf
    ctx.fillStyle = '#FF0050';
    const scarfBob = Math.sin(s.frame * 0.15) * 1.5;
    ctx.beginPath();
    ctx.moveTo(PX - 6, py + PR - 2);
    ctx.lineTo(PX - 12, py + PR + 4 + scarfBob);
    ctx.lineTo(PX - 4, py + PR + 2 + scarfBob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Particles ──
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Float texts ──
    for (const ft of s.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${12 + (1 - ft.life) * 2}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // ── HUD ──
    const heartSize = s.hp <= 1 && s.hp > 0 ? 15 + Math.sin(s.frame * 0.2) * 2 : 14;
    for (let i = 0; i < s.maxHp; i++) {
      ctx.fillStyle = i < s.hp ? '#FF0050' : 'rgba(255,0,80,0.15)';
      ctx.font = `${i < s.hp ? heartSize : 14}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('♥', 14 + i * 20, 22);
    }
    ctx.fillStyle = '#f0ecf4';
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${s.score}`, W - 14, 18);
    ctx.fillStyle = '#7a7590';
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${Math.floor(s.distance)}m`, W - 14, 34);
    // Speed indicator
    ctx.fillStyle = 'rgba(79,195,247,0.4)';
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillText(`⚡ ${s.speed.toFixed(1)}`, W - 14, 48);
    ctx.textAlign = 'left';

    // Vignette
    const vGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

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
