/**
 * AGOSTO — Meteor Storm 💥
 * August-themed deep-space survival dodger.
 * Dodge raining meteors, collect star fragments, use shield pulse.
 *
 * Features:
 * - Multi-layer parallax starfield with nebula tints and twinkling
 * - Glowing meteors with fire trails and screen-shake impacts
 * - Particle explosions, float-text score popups, vignette overlay
 * - 4 HP heart system, heal power-up every 1000 pts (green cross → full HP)
 * - Shield pulse (action btn) destroys nearby small meteors, damages big ones
 * - Increasing difficulty: meteor rate, speed, and size ramp over time
 * - Ambient shooting-star streaks, subtle nebula colour wash
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Meteor Storm',
  emoji: '💥',
  description: 'Sopravvivi alla pioggia di meteoriti!',
  color: '#FF5722',
  controls: 'joystick',
  instructions:
    'Muoviti con WASD / joystick. Evita i meteoriti e raccogli i frammenti stellari ✦ per punti! Premi Spazio o 🛡️ per un\'onda scudo che distrugge i meteoriti vicini. Cura +❤️ ogni 1000 punti!',
  gameOverTitle: 'Disintegrato!',
  actionLabel: '🛡️',
};

/* ─── Constants ─── */
const W = 480;
const H = 480;
const TWO_PI = Math.PI * 2;
const PLAYER_R = 12;
const PLAYER_SPD = 3.2;
const SHIELD_CD = 180;   // 3 s at 60 fps
const SHIELD_R = 70;
const SHIELD_DUR = 18;

const C = {
  bg: '#050810',
  ship: '#4FC3F7', shipGlow: '#81D4FA', engine: '#FF6D00',
  meteorCore: '#BF360C', meteorEdge: '#FF5722', meteorTrail: '#FF8A65',
  meteorGlow: 'rgba(255,87,34,0.35)',
  fragment: '#FFD54F', fragmentGlow: 'rgba(255,213,79,0.5)',
  heal: '#66BB6A', healGlow: 'rgba(102,187,106,0.5)',
  shield: '#4FC3F7', shieldGlow: 'rgba(79,195,247,0.4)',
  heart: '#EF5350', heartEmpty: 'rgba(239,83,80,0.18)',
  text: '#ECEFF1', muted: '#78909C',
  scorePopup: '#FFD54F',
};

/* ─── Helpers ─── */
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rng(lo, hi) { return lo + Math.random() * (hi - lo); }

/* ─── Game ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── state ── */
  const s = {
    running: true,
    frame: 0,
    time: 0,            // survival seconds
    score: 0,
    hp: 4, maxHp: 4,
    lastHealMilestone: 0,

    // player
    px: W / 2, py: H * 0.75,
    vx: 0, vy: 0,
    iframe: 0,           // invulnerability frames
    tilt: 0,             // visual lean

    // shield
    shieldCD: 0,
    shieldActive: 0,     // countdown for active pulse
    shieldX: 0, shieldY: 0,

    // world
    meteors: [],
    fragments: [],       // star fragments (score pickups)
    heals: [],
    particles: [],
    floatTexts: [],
    trails: [],          // meteor fire trails

    // spawning
    spawnTimer: 0,
    difficulty: 1,

    // screen shake
    shakeAmt: 0,

    // bg layers
    starsBack: [],
    starsMid: [],
    starsFront: [],
    nebulas: [],
    shootingStars: [],
  };

  /* ── init background ── */
  function initBg() {
    for (let i = 0; i < 90; i++) s.starsBack.push({ x: rng(0, W), y: rng(0, H), r: rng(0.3, 0.8), bri: rng(0.15, 0.35), phase: rng(0, TWO_PI) });
    for (let i = 0; i < 50; i++) s.starsMid.push({ x: rng(0, W), y: rng(0, H), r: rng(0.5, 1.2), bri: rng(0.25, 0.55), phase: rng(0, TWO_PI) });
    for (let i = 0; i < 25; i++) s.starsFront.push({ x: rng(0, W), y: rng(0, H), r: rng(0.8, 1.8), bri: rng(0.4, 0.7), phase: rng(0, TWO_PI) });
    for (let i = 0; i < 3; i++) s.nebulas.push({ x: rng(40, W - 40), y: rng(40, H - 40), rx: rng(60, 140), ry: rng(40, 100), hue: rng(0, 360), alpha: rng(0.015, 0.04) });
  }
  initBg();

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  /* ── spawn helpers ── */
  function spawnMeteor() {
    const big = Math.random() < 0.25 + s.difficulty * 0.02;
    const r = big ? rng(22, 34) : rng(10, 18);
    const hp = big ? 3 : 1;
    const sx = rng(r, W - r);
    const spd = rng(1.0, 2.0) + s.difficulty * 0.12;
    const angle = rng(Math.PI * 0.3, Math.PI * 0.7); // mostly downward
    s.meteors.push({
      x: sx, y: -r - rng(0, 40),
      vx: Math.cos(angle) * spd * (Math.random() < 0.5 ? 1 : -1),
      vy: Math.sin(angle) * spd,
      r, hp, maxHp: hp,
      rot: rng(0, TWO_PI),
      rotSpd: rng(-0.04, 0.04),
      jagged: Array.from({ length: 10 }, () => rng(0.72, 1.0)),
      big,
      flash: 0,
    });
  }

  function addParticles(x, y, color, count, spread, spdMul) {
    spread = spread || 4;
    spdMul = spdMul || 1;
    for (let i = 0; i < count; i++) {
      const a = rng(0, TWO_PI);
      const v = rng(0.5, spread) * spdMul;
      s.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1, decay: rng(0.015, 0.04),
        color, size: rng(1.5, 4),
      });
    }
  }

  function addFloatText(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color: color || C.scorePopup, life: 1, vy: -1.2 });
  }

  function addTrailPuff(x, y, r) {
    s.trails.push({
      x: x + rng(-r * 0.3, r * 0.3),
      y: y - r * 0.5,
      r: rng(r * 0.25, r * 0.55),
      life: 1, decay: rng(0.025, 0.05),
    });
  }

  function spawnShootingStar() {
    s.shootingStars.push({
      x: rng(-20, W + 20), y: rng(-20, 50),
      vx: rng(-2, 2), vy: rng(4, 8),
      life: 1, decay: rng(0.02, 0.04), len: rng(20, 50),
    });
  }

  /* ── update ── */
  function update() {
    if (!s.running) return;
    s.frame++;
    if (s.frame % 60 === 0) s.time++;
    s.difficulty = 1 + s.time * 0.06; // ramps every second

    if (s.iframe > 0) s.iframe--;
    if (s.shieldCD > 0) s.shieldCD--;
    if (s.shieldActive > 0) s.shieldActive--;
    if (s.shakeAmt > 0) s.shakeAmt *= 0.88;

    const keys = keysRef.current;
    const joy = joystickRef.current;

    /* ── player movement ── */
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
    if (joy.active && (Math.abs(joy.dx) > 0.15 || Math.abs(joy.dy) > 0.15)) {
      mx = joy.dx; my = joy.dy;
    }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 0.01) {
      const nm = Math.min(mag, 1);
      mx = (mx / mag) * nm;
      my = (my / mag) * nm;
    }
    s.vx = lerp(s.vx, mx * PLAYER_SPD, 0.18);
    s.vy = lerp(s.vy, my * PLAYER_SPD, 0.18);
    s.px = clamp(s.px + s.vx, PLAYER_R, W - PLAYER_R);
    s.py = clamp(s.py + s.vy, PLAYER_R, H - PLAYER_R);
    s.tilt = lerp(s.tilt, clamp(mx * 0.4, -0.4, 0.4), 0.12);

    /* ── shield pulse ── */
    if ((keys[' '] || keys['Space'] || actionBtnRef.current) && s.shieldCD === 0) {
      s.shieldCD = SHIELD_CD;
      s.shieldActive = SHIELD_DUR;
      s.shieldX = s.px;
      s.shieldY = s.py;
      actionBtnRef.current = false;
      addParticles(s.px, s.py, C.shield, 24, 6, 1.5);
    }

    /* ── meteor spawning ── */
    const spawnInterval = Math.max(12, 45 - s.difficulty * 2.5);
    s.spawnTimer++;
    if (s.spawnTimer >= spawnInterval) {
      s.spawnTimer = 0;
      const count = 1 + (Math.random() < s.difficulty * 0.04 ? 1 : 0);
      for (let i = 0; i < count; i++) spawnMeteor();
    }

    /* ── meteors ── */
    for (let i = s.meteors.length - 1; i >= 0; i--) {
      const m = s.meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.rot += m.rotSpd;
      if (m.flash > 0) m.flash--;

      // fire trail
      if (s.frame % 2 === 0) addTrailPuff(m.x, m.y, m.r);

      // off screen bottom → remove
      if (m.y > H + m.r + 60) {
        s.meteors.splice(i, 1);
        continue;
      }

      // shield hit
      if (s.shieldActive > 0) {
        const d = dist(m, { x: s.shieldX, y: s.shieldY });
        const pulseR = SHIELD_R * (1 - s.shieldActive / SHIELD_DUR) * 1.3;
        if (d < pulseR + m.r) {
          m.hp--;
          m.flash = 6;
          if (m.hp <= 0) {
            const pts = m.big ? 50 : 25;
            s.score += pts;
            onScore(s.score);
            addFloatText(m.x, m.y, `+${pts}`);
            addParticles(m.x, m.y, C.meteorEdge, m.big ? 18 : 10, 5);
            // chance to drop fragment
            if (Math.random() < 0.35) {
              s.fragments.push({ x: m.x, y: m.y, pulse: 0, vy: rng(0.2, 0.6) });
            }
            s.meteors.splice(i, 1);
            s.shakeAmt = Math.max(s.shakeAmt, m.big ? 6 : 3);
            continue;
          }
          addParticles(m.x, m.y, C.meteorTrail, 4, 3);
        }
      }

      // player collision
      if (s.iframe === 0) {
        const d = dist(m, { x: s.px, y: s.py });
        if (d < m.r + PLAYER_R - 4) {
          s.hp--;
          s.iframe = 90;
          s.shakeAmt = 12;
          onHpChange(s.hp, s.maxHp);
          addParticles(s.px, s.py, C.heart, 14, 5);
          addFloatText(s.px, s.py - 20, '-1 ❤️', C.heart);

          // destroy the meteor on hit
          addParticles(m.x, m.y, C.meteorEdge, 12, 5);
          s.meteors.splice(i, 1);

          if (s.hp <= 0) {
            s.running = false;
            return;
          }
          continue;
        }
      }
    }

    /* ── star fragments ── */
    for (let i = s.fragments.length - 1; i >= 0; i--) {
      const f = s.fragments[i];
      f.pulse += 0.07;
      f.y += f.vy;
      if (f.y > H + 20) { s.fragments.splice(i, 1); continue; }
      if (dist(f, { x: s.px, y: s.py }) < 22) {
        const pts = 100;
        s.score += pts;
        onScore(s.score);
        addParticles(f.x, f.y, C.fragment, 10, 4);
        addFloatText(f.x, f.y, `+${pts} ✦`, C.fragment);
        s.fragments.splice(i, 1);
      }
    }

    /* ── survival score (every second) ── */
    if (s.frame % 60 === 0 && s.time > 0) {
      const pts = 5 + Math.floor(s.difficulty * 2);
      s.score += pts;
      onScore(s.score);
    }

    /* ── heal power-up every 1000 pts ── */
    const milestone = Math.floor(s.score / 1000);
    if (milestone > s.lastHealMilestone) {
      s.lastHealMilestone = milestone;
      s.heals.push({
        x: rng(40, W - 40), y: -20,
        vy: rng(0.5, 1.0),
        pulse: rng(0, TWO_PI),
      });
    }
    for (let i = s.heals.length - 1; i >= 0; i--) {
      const h = s.heals[i];
      h.y += h.vy;
      h.pulse += 0.08;
      if (h.y > H + 30) { s.heals.splice(i, 1); continue; }
      if (dist(h, { x: s.px, y: s.py }) < 22) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, h.y, C.heal, 14, 5);
        addFloatText(h.x, h.y, 'FULL HP!', C.heal);
        s.heals.splice(i, 1);
      }
    }

    /* ── particles ── */
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    /* ── trails ── */
    for (let i = s.trails.length - 1; i >= 0; i--) {
      const t = s.trails[i];
      t.life -= t.decay;
      t.y -= 0.3;
      if (t.life <= 0) s.trails.splice(i, 1);
    }

    /* ── float texts ── */
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.018;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    /* ── shooting stars ── */
    if (Math.random() < 0.008 + s.difficulty * 0.002) spawnShootingStar();
    for (let i = s.shootingStars.length - 1; i >= 0; i--) {
      const ss = s.shootingStars[i];
      ss.x += ss.vx; ss.y += ss.vy;
      ss.life -= ss.decay;
      if (ss.life <= 0 || ss.y > H + 30) s.shootingStars.splice(i, 1);
    }

    /* ── parallax scroll ── */
    for (const star of s.starsBack) { star.y += 0.15; if (star.y > H) { star.y = 0; star.x = rng(0, W); } }
    for (const star of s.starsMid) { star.y += 0.35; if (star.y > H) { star.y = 0; star.x = rng(0, W); } }
    for (const star of s.starsFront) { star.y += 0.6; if (star.y > H) { star.y = 0; star.x = rng(0, W); } }
  }

  /* ─── Draw ─── */
  function drawStar5(cx, cy, outerR, innerR, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i / 10) * TWO_PI - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function drawHeart(cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size * 0.5, -size * 0.3, -size, size * 0.1, 0, size);
    ctx.bezierCurveTo(size, size * 0.1, size * 0.5, -size * 0.3, 0, size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.save();

    // screen shake
    if (s.shakeAmt > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * s.shakeAmt * 2,
        (Math.random() - 0.5) * s.shakeAmt * 2,
      );
    }

    // background
    ctx.fillStyle = C.bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // nebula blobs
    for (const nb of s.nebulas) {
      const g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.rx);
      g.addColorStop(0, `hsla(${nb.hue + s.frame * 0.03},60%,40%,${nb.alpha})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(nb.x, nb.y, nb.rx, nb.ry, 0, 0, TWO_PI);
      ctx.fill();
    }

    // stars (back)
    for (const star of s.starsBack) {
      const twinkle = star.bri + Math.sin(s.frame * 0.015 + star.phase) * 0.08;
      ctx.globalAlpha = clamp(twinkle, 0, 1);
      ctx.fillStyle = '#8899bb';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TWO_PI);
      ctx.fill();
    }
    // stars (mid)
    for (const star of s.starsMid) {
      const twinkle = star.bri + Math.sin(s.frame * 0.025 + star.phase) * 0.12;
      ctx.globalAlpha = clamp(twinkle, 0, 1);
      ctx.fillStyle = '#aabbdd';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TWO_PI);
      ctx.fill();
    }
    // stars (front)
    for (const star of s.starsFront) {
      const twinkle = star.bri + Math.sin(s.frame * 0.04 + star.phase) * 0.15;
      ctx.globalAlpha = clamp(twinkle, 0, 1);
      ctx.fillStyle = '#ddeeff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // shooting stars
    for (const ss of s.shootingStars) {
      const a = Math.atan2(ss.vy, ss.vx);
      const ex = ss.x - Math.cos(a) * ss.len * ss.life;
      const ey = ss.y - Math.sin(a) * ss.len * ss.life;
      const g = ctx.createLinearGradient(ss.x, ss.y, ex, ey);
      g.addColorStop(0, `rgba(255,255,255,${ss.life * 0.7})`);
      g.addColorStop(1, 'transparent');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // meteor fire trails
    for (const t of s.trails) {
      const a = t.life;
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
      g.addColorStop(0, `rgba(255,120,40,${a * 0.45})`);
      g.addColorStop(0.5, `rgba(255,60,20,${a * 0.2})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, TWO_PI);
      ctx.fill();
    }

    // meteors
    for (const m of s.meteors) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);

      // outer glow
      const gr = ctx.createRadialGradient(0, 0, m.r * 0.3, 0, 0, m.r * 1.6);
      gr.addColorStop(0, C.meteorGlow);
      gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, m.r * 1.6, 0, TWO_PI);
      ctx.fill();

      // main body (jagged)
      const bodyColor = m.flash > 0 ? '#fff' : C.meteorEdge;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      for (let j = 0; j < m.jagged.length; j++) {
        const angle = (j / m.jagged.length) * TWO_PI;
        const r = m.r * m.jagged[j];
        if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();

      // inner core (darker)
      ctx.fillStyle = C.meteorCore;
      ctx.beginPath();
      for (let j = 0; j < m.jagged.length; j++) {
        const angle = (j / m.jagged.length) * TWO_PI;
        const r = m.r * m.jagged[j] * 0.6;
        if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();

      // crater
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(m.r * 0.2, -m.r * 0.15, m.r * 0.22, 0, TWO_PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-m.r * 0.25, m.r * 0.2, m.r * 0.14, 0, TWO_PI);
      ctx.fill();

      // hp bar for big meteors
      if (m.big && m.hp < m.maxHp) {
        ctx.rotate(-m.rot); // un-rotate for readable bar
        const bw = m.r * 1.4;
        const bh = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-bw / 2, -m.r - 8, bw, bh);
        ctx.fillStyle = '#EF5350';
        ctx.fillRect(-bw / 2, -m.r - 8, bw * (m.hp / m.maxHp), bh);
      }

      ctx.restore();
    }

    // star fragments
    for (const f of s.fragments) {
      const glow = 0.6 + Math.sin(f.pulse) * 0.3;
      ctx.save();
      ctx.translate(f.x, f.y);
      // glow
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
      gr.addColorStop(0, `rgba(255,213,79,${glow * 0.5})`);
      gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TWO_PI);
      ctx.fill();
      // star shape
      ctx.fillStyle = C.fragment;
      drawStar5(0, 0, 7, 3, f.pulse * 0.5);
      ctx.fill();
      // bright center
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // heal power-ups (green cross)
    for (const h of s.heals) {
      const glow = 0.6 + Math.sin(h.pulse) * 0.3;
      ctx.save();
      ctx.translate(h.x, h.y + Math.sin(h.pulse * 1.5) * 3);
      // glow
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
      gr.addColorStop(0, `rgba(102,187,106,${glow * 0.5})`);
      gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, TWO_PI);
      ctx.fill();
      // green cross
      ctx.fillStyle = C.heal;
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
      // white highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
      ctx.restore();
    }

    // shield pulse
    if (s.shieldActive > 0) {
      const t = 1 - s.shieldActive / SHIELD_DUR;
      const r = SHIELD_R * t * 1.3;
      const alpha = (1 - t) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(79,195,247,${alpha})`;
      ctx.lineWidth = 3 - t * 2;
      ctx.beginPath();
      ctx.arc(s.shieldX, s.shieldY, r, 0, TWO_PI);
      ctx.stroke();
      // inner fill
      const g = ctx.createRadialGradient(s.shieldX, s.shieldY, 0, s.shieldX, s.shieldY, r);
      g.addColorStop(0, `rgba(79,195,247,${alpha * 0.3})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.shieldX, s.shieldY, r, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // player ship
    ctx.save();
    if (s.iframe > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.3;
    ctx.translate(s.px, s.py);
    ctx.rotate(s.tilt);

    // engine glow
    const engineAlpha = 0.3 + Math.sin(s.frame * 0.2) * 0.1;
    const eg = ctx.createRadialGradient(0, PLAYER_R + 4, 0, 0, PLAYER_R + 4, 12);
    eg.addColorStop(0, `rgba(255,109,0,${engineAlpha})`);
    eg.addColorStop(1, 'transparent');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(0, PLAYER_R + 4, 12, 0, TWO_PI);
    ctx.fill();

    // engine flame (animated)
    ctx.fillStyle = C.engine;
    ctx.globalAlpha = (s.iframe > 0 && s.frame % 4 < 2) ? 0.2 : 0.7 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.moveTo(-4, PLAYER_R * 0.6);
    ctx.lineTo(0, PLAYER_R + 5 + Math.random() * 6);
    ctx.lineTo(4, PLAYER_R * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFE082';
    ctx.globalAlpha = (s.iframe > 0 && s.frame % 4 < 2) ? 0.15 : 0.5 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(-2, PLAYER_R * 0.6);
    ctx.lineTo(0, PLAYER_R + 2 + Math.random() * 4);
    ctx.lineTo(2, PLAYER_R * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = (s.iframe > 0 && s.frame % 4 < 2) ? 0.3 : 1;

    // ship body glow
    const sg = ctx.createRadialGradient(0, 0, 2, 0, 0, PLAYER_R + 6);
    sg.addColorStop(0, 'rgba(79,195,247,0.15)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R + 6, 0, TWO_PI);
    ctx.fill();

    // ship main hull
    ctx.fillStyle = C.ship;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_R);             // nose
    ctx.lineTo(-PLAYER_R * 0.75, PLAYER_R * 0.5);
    ctx.lineTo(-PLAYER_R * 0.4, PLAYER_R * 0.7);
    ctx.lineTo(0, PLAYER_R * 0.4);
    ctx.lineTo(PLAYER_R * 0.4, PLAYER_R * 0.7);
    ctx.lineTo(PLAYER_R * 0.75, PLAYER_R * 0.5);
    ctx.closePath();
    ctx.fill();

    // cockpit
    ctx.fillStyle = '#B3E5FC';
    ctx.beginPath();
    ctx.ellipse(0, -PLAYER_R * 0.2, 3.5, 5, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-1, -PLAYER_R * 0.3, 1.5, 2.5, -0.3, 0, TWO_PI);
    ctx.fill();

    // wing highlights
    ctx.fillStyle = C.shipGlow;
    ctx.globalAlpha = (s.iframe > 0 && s.frame % 4 < 2) ? 0.15 : 0.35;
    ctx.beginPath();
    ctx.moveTo(-PLAYER_R * 0.55, PLAYER_R * 0.1);
    ctx.lineTo(-PLAYER_R * 0.72, PLAYER_R * 0.5);
    ctx.lineTo(-PLAYER_R * 0.35, PLAYER_R * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(PLAYER_R * 0.55, PLAYER_R * 0.1);
    ctx.lineTo(PLAYER_R * 0.72, PLAYER_R * 0.5);
    ctx.lineTo(PLAYER_R * 0.35, PLAYER_R * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // shield ready indicator (subtle ring)
    if (s.shieldCD === 0 && s.shieldActive === 0) {
      ctx.strokeStyle = 'rgba(79,195,247,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R + 4, 0, TWO_PI);
      ctx.stroke();
    }
    // shield cooldown arc
    if (s.shieldCD > 0) {
      const pct = 1 - s.shieldCD / SHIELD_CD;
      ctx.strokeStyle = `rgba(79,195,247,${0.15 + pct * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R + 4, -Math.PI / 2, -Math.PI / 2 + TWO_PI * pct);
      ctx.stroke();
    }

    ctx.restore();

    // particles
    for (const p of s.particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // float texts
    ctx.textAlign = 'center';
    for (const ft of s.floatTexts) {
      ctx.globalAlpha = clamp(ft.life, 0, 1);
      ctx.fillStyle = ft.color;
      ctx.font = `bold 13px Outfit, sans-serif`;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // ─── HUD ───
    ctx.textAlign = 'left';

    // hearts
    for (let i = 0; i < s.maxHp; i++) {
      ctx.fillStyle = i < s.hp ? C.heart : C.heartEmpty;
      const hx = 14 + i * 22;
      const hy = 14;
      const beat = i < s.hp ? 1 + Math.sin(s.frame * 0.06 + i * 0.5) * 0.06 : 1;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(beat, beat);
      drawHeart(0, 0, 8);
      ctx.restore();
    }

    // score
    ctx.fillStyle = C.text;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${s.score}`, W - 12, 19);

    // survival time
    const mins = Math.floor(s.time / 60);
    const secs = s.time % 60;
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${mins}:${secs < 10 ? '0' : ''}${secs}`, W - 12, 34);
    ctx.textAlign = 'left';

    // shield indicator
    if (s.shieldCD > 0) {
      ctx.fillStyle = C.muted;
      ctx.font = '10px Outfit, sans-serif';
      const cd = Math.ceil(s.shieldCD / 60);
      ctx.fillText(`🛡️ ${cd}s`, 12, 38);
    } else {
      ctx.fillStyle = C.shield;
      ctx.font = '10px Outfit, sans-serif';
      ctx.fillText('🛡️ PRONTO', 12, 38);
    }

    // vignette overlay
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    ctx.restore();
  }

  /* ─── Game loop ─── */
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
