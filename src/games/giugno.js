/**
 * GIUGNO — Solar Surge ☀️
 * Arena shooter: you are a sun spirit battling waves of shadow creatures.
 * Move with WASD / joystick, fire solar projectiles with action button.
 *
 * Features:
 * - Radial-gradient arena with animated heat-haze background
 * - Player sun spirit with pulsing corona, directional aim, trail particles
 * - Solar projectiles with light trails and impact flashes
 * - 3 shadow enemy types (wisp / stalker / titan) across escalating waves
 * - Stalker+ enemies fire dark projectiles back at the player
 * - 4 HP system with animated heart HUD, iframes on hit
 * - Heal power-up (green cross) spawns every 1000 pts → full HP
 * - Float text for score pickups, wave banners, damage numbers
 * - Ambient heat particles, vignette overlay, screen shake
 * - Wave counter + score in animated HUD
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Solar Surge',
  emoji: '☀️',
  description: 'Cavalca i raggi solari ed evita le ombre!',
  color: '#FF9800',
  controls: 'joystick',
  instructions:
    'Muoviti con WASD/frecce o joystick. Premi Spazio o 🔥 per sparare proiettili solari. Elimina le creature d\'ombra e sopravvivi alle ondate!',
  gameOverTitle: 'Eclissi totale!',
  actionLabel: '🔥',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const CX = W / 2, CY = H / 2;
const PI2 = Math.PI * 2;
const PI = Math.PI;

const PLAYER_R = 14;
const PLAYER_SPD = 3.0;
const SHOOT_CD = 12;
const BULLET_SPD = 7;
const BULLET_R = 5;
const BULLET_LIFE = 80;
const IFRAME_DUR = 45;

const HEAL_R = 14;
const HEAL_SCORE_INTERVAL = 1000;

const ENEMY_TYPES = {
  wisp:    { r: 10, spd: 1.2, hp: 1, pts: 20,  color: '#6a1b9a', glow: '#9c27b0', shootChance: 0 },
  stalker: { r: 14, spd: 0.8, hp: 2, pts: 50,  color: '#283593', glow: '#5c6bc0', shootChance: 0.006 },
  titan:   { r: 22, spd: 0.5, hp: 5, pts: 120, color: '#1a237e', glow: '#3f51b5', shootChance: 0.012 },
};

const DARK_BULLET_SPD = 3.5;
const DARK_BULLET_R = 4;

/* ─── Palette ─── */
const C = {
  bg: '#0a0e15',
  player: '#FFB300', corona: '#FF9800', coronaOuter: '#FF6F00',
  bullet: '#FFEB3B', bulletGlow: '#FFF176',
  heart: '#FF1744', heartDim: 'rgba(255,23,68,0.2)',
  heal: '#00E676', healGlow: 'rgba(0,230,118,0.4)',
  text: '#f0ecf4', muted: '#8a8594',
  darkBullet: '#7e57c2', darkBulletGlow: '#b388ff',
  heatParticle: '#FF8F00',
};

/* ─── Helpers ─── */
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
function rndInt(lo, hi) { return Math.floor(rnd(lo, hi + 1)); }
function angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

/* ─── createGame ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── State ── */
  const S = {
    px: CX, py: CY,
    aimAngle: -PI / 2,
    score: 0,
    hp: 4, maxHp: 4,
    wave: 0,
    waveEnemiesLeft: 0,
    spawnQueue: [],
    waveBanner: null,
    running: true,
    frame: 0,
    shootCD: 0,
    iframe: 0,
    screenShake: 0,
    lastHealMilestone: 0,

    bullets: [],
    enemies: [],
    darkBullets: [],
    healItems: [],
    particles: [],
    floatTexts: [],
    heatParticles: [],
    stars: [],
    trailParticles: [],
  };

  onHpChange(S.hp, S.maxHp);
  onScore(0);

  // Pre-generate background stars
  for (let i = 0; i < 80; i++) {
    S.stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.4 + Math.random() * 1.4,
      brightness: 0.15 + Math.random() * 0.45,
      twinkleOff: Math.random() * PI2,
    });
  }

  // Pre-generate ambient heat particles
  for (let i = 0; i < 30; i++) {
    S.heatParticles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: rnd(-0.3, 0.3),
      vy: rnd(-0.7, -0.2),
      size: rnd(1, 3),
      alpha: rnd(0.05, 0.15),
      life: rnd(0, 1),
    });
  }

  /* ── Particle helpers ── */
  function addParticles(x, y, color, count, opts = {}) {
    const { speed = 3, sizeMin = 1.5, sizeMax = 4, decayMin = 0.02, decayMax = 0.04, glow = false } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * PI2;
      const spd = Math.random() * speed;
      S.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 1,
        decay: rnd(decayMin, decayMax),
        color,
        size: rnd(sizeMin, sizeMax),
        glow,
      });
    }
  }

  function addTrail(x, y, color, size) {
    S.trailParticles.push({ x, y, life: 1, decay: 0.06, color, size });
  }

  function addFloatText(x, y, text, color, big = false) {
    S.floatTexts.push({
      x, y, text, color,
      life: 1,
      vy: -1.2,
      size: big ? 18 : 13,
    });
  }

  /* ── Wave system ── */
  function startNextWave() {
    S.wave++;
    const count = Math.min(4 + S.wave * 2, 30);
    S.waveEnemiesLeft = count;
    S.waveTimer = 0;

    S.waveBanner = { text: `— Ondata ${S.wave} —`, life: 1 };

    // Queue staggered spawns via frame-based delays (no setTimeout)
    for (let i = 0; i < count; i++) {
      S.spawnQueue.push(S.frame + i * rndInt(15, 30));
    }
  }

  function pickEnemyType() {
    if (S.wave <= 1) return 'wisp';
    if (S.wave <= 3) return Math.random() < 0.7 ? 'wisp' : 'stalker';
    if (S.wave <= 5) {
      const r = Math.random();
      return r < 0.4 ? 'wisp' : r < 0.8 ? 'stalker' : 'titan';
    }
    const r = Math.random();
    return r < 0.3 ? 'wisp' : r < 0.65 ? 'stalker' : 'titan';
  }

  function spawnEnemy() {
    const type = pickEnemyType();
    const def = ENEMY_TYPES[type];
    // Spawn from edges
    const side = rndInt(0, 3);
    let x, y;
    if (side === 0) { x = rnd(-30, -15); y = rnd(30, H - 30); }       // left
    else if (side === 1) { x = rnd(W + 15, W + 30); y = rnd(30, H - 30); } // right
    else if (side === 2) { x = rnd(30, W - 30); y = rnd(-30, -15); }   // top
    else { x = rnd(30, W - 30); y = rnd(H + 15, H + 30); }            // bottom

    S.enemies.push({
      type,
      x, y,
      hp: def.hp + Math.floor(S.wave / 4),
      maxHp: def.hp + Math.floor(S.wave / 4),
      r: def.r,
      spd: def.spd + S.wave * 0.03,
      pts: def.pts,
      color: def.color,
      glow: def.glow,
      shootChance: def.shootChance,
      shootCD: 60 + rndInt(0, 60),
      wobble: Math.random() * PI2,
      hitFlash: 0,
    });
  }

  // Start wave 1
  startNextWave();

  /* ── Update ── */
  function update() {
    if (!S.running) return;
    S.frame++;

    if (S.iframe > 0) S.iframe--;
    if (S.shootCD > 0) S.shootCD--;
    if (S.screenShake > 0) S.screenShake *= 0.88;
    if (S.screenShake < 0.3) S.screenShake = 0;

    // Wave banner fade
    if (S.waveBanner) {
      S.waveBanner.life -= 0.012;
      if (S.waveBanner.life <= 0) S.waveBanner = null;
    }

    // Process spawn queue (frame-based staggering)
    for (let i = S.spawnQueue.length - 1; i >= 0; i--) {
      if (S.frame >= S.spawnQueue[i]) {
        spawnEnemy();
        S.spawnQueue.splice(i, 1);
      }
    }

    /* Input */
    const keys = keysRef.current;
    let mx = 0, my = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my = 1;
    const joy = joystickRef.current;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 0.1) {
      const norm = mag > 1 ? mag : 1;
      mx /= norm;
      my /= norm;
      S.aimAngle = Math.atan2(my, mx);
    }

    const moving = mag > 0.1;
    S.px += mx * PLAYER_SPD;
    S.py += my * PLAYER_SPD;
    S.px = clamp(S.px, PLAYER_R + 4, W - PLAYER_R - 4);
    S.py = clamp(S.py, PLAYER_R + 4, H - PLAYER_R - 4);

    // Trail while moving
    if (moving && S.frame % 3 === 0) {
      addTrail(S.px, S.py, C.corona, rnd(3, 6));
    }

    /* Shoot */
    const wantShoot = keys[' '] || keys['Space'] || actionBtnRef.current;
    if (wantShoot && S.shootCD === 0) {
      // Find nearest enemy to auto-aim (or use movement direction)
      let aimA = S.aimAngle;
      let nearest = null, nearDist = Infinity;
      for (const e of S.enemies) {
        if (e.hp <= 0) continue;
        const d = dist(S.px, S.py, e.x, e.y);
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (nearest) aimA = angle(S.px, S.py, nearest.x, nearest.y);

      S.bullets.push({
        x: S.px + Math.cos(aimA) * PLAYER_R,
        y: S.py + Math.sin(aimA) * PLAYER_R,
        vx: Math.cos(aimA) * BULLET_SPD,
        vy: Math.sin(aimA) * BULLET_SPD,
        life: BULLET_LIFE,
      });
      // Muzzle flash particles
      addParticles(
        S.px + Math.cos(aimA) * (PLAYER_R + 4),
        S.py + Math.sin(aimA) * (PLAYER_R + 4),
        C.bulletGlow, 4, { speed: 2, sizeMax: 3, decayMin: 0.06 },
      );
      S.shootCD = SHOOT_CD;
      actionBtnRef.current = false;
    }

    /* Bullets vs Enemies */
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      // Trail
      if (S.frame % 2 === 0) addTrail(b.x, b.y, C.bullet, 2);

      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        S.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const e of S.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + BULLET_R) {
          e.hp--;
          e.hitFlash = 6;
          hit = true;
          addParticles(b.x, b.y, '#fff', 4, { speed: 2 });

          if (e.hp <= 0) {
            const pts = e.pts + S.wave * 5;
            S.score += pts;
            onScore(S.score);
            addFloatText(e.x, e.y - e.r, `+${pts}`, C.bullet);
            // Death explosion
            addParticles(e.x, e.y, e.glow, 12, { speed: 4, sizeMax: 5, glow: true });
            addParticles(e.x, e.y, '#fff', 6, { speed: 2.5, sizeMax: 3 });
            S.waveEnemiesLeft--;
          }
          break;
        }
      }
      if (hit) S.bullets.splice(i, 1);
    }

    /* Enemies */
    let allDead = true;
    for (let i = S.enemies.length - 1; i >= 0; i--) {
      const e = S.enemies[i];
      if (e.hp <= 0) { S.enemies.splice(i, 1); continue; }
      allDead = false;

      e.wobble += 0.04;
      if (e.hitFlash > 0) e.hitFlash--;

      // Move toward player with slight wobble
      const a = angle(e.x, e.y, S.px, S.py);
      const wobbleOffset = Math.sin(e.wobble) * 0.3;
      e.x += Math.cos(a + wobbleOffset) * e.spd;
      e.y += Math.sin(a + wobbleOffset) * e.spd;

      // Enemy shoot (stalkers and titans)
      if (e.shootChance > 0) {
        e.shootCD--;
        if (e.shootCD <= 0 && Math.random() < e.shootChance * (1 + S.wave * 0.1)) {
          const da = angle(e.x, e.y, S.px, S.py);
          S.darkBullets.push({
            x: e.x + Math.cos(da) * (e.r + 4),
            y: e.y + Math.sin(da) * (e.r + 4),
            vx: Math.cos(da) * DARK_BULLET_SPD,
            vy: Math.sin(da) * DARK_BULLET_SPD,
            life: 120,
          });
          addParticles(e.x, e.y, C.darkBullet, 3, { speed: 1.5, sizeMax: 2 });
          e.shootCD = 90 + rndInt(0, 40);
        }
      }

      // Collision with player
      if (S.iframe === 0 && dist(S.px, S.py, e.x, e.y) < PLAYER_R + e.r - 3) {
        takeDamage();
        if (!S.running) return;
        // Knockback enemy
        const ka = angle(S.px, S.py, e.x, e.y);
        e.x += Math.cos(ka) * 30;
        e.y += Math.sin(ka) * 30;
      }
    }

    /* Dark bullets vs Player */
    for (let i = S.darkBullets.length - 1; i >= 0; i--) {
      const db = S.darkBullets[i];
      db.x += db.vx;
      db.y += db.vy;
      db.life--;
      if (S.frame % 3 === 0) addTrail(db.x, db.y, C.darkBullet, 2);

      if (db.life <= 0 || db.x < -20 || db.x > W + 20 || db.y < -20 || db.y > H + 20) {
        S.darkBullets.splice(i, 1);
        continue;
      }

      if (S.iframe === 0 && dist(S.px, S.py, db.x, db.y) < PLAYER_R + DARK_BULLET_R) {
        S.darkBullets.splice(i, 1);
        takeDamage();
        if (!S.running) return;
      }
    }

    /* Next wave check */
    if (allDead && S.waveEnemiesLeft <= 0 && S.enemies.length === 0) {
      // Small bonus
      const waveBonus = S.wave * 50;
      S.score += waveBonus;
      onScore(S.score);
      addFloatText(CX, CY - 30, `Ondata ${S.wave} completata! +${waveBonus}`, '#FFD54F', true);
      startNextWave();
    }

    /* Heal power-up every 1000 pts */
    const healMilestone = Math.floor(S.score / HEAL_SCORE_INTERVAL);
    if (healMilestone > S.lastHealMilestone && S.hp < S.maxHp) {
      S.lastHealMilestone = healMilestone;
      const spawnAngle = Math.random() * PI2;
      const spawnDist = rnd(60, 180);
      S.healItems.push({
        x: clamp(CX + Math.cos(spawnAngle) * spawnDist, 30, W - 30),
        y: clamp(CY + Math.sin(spawnAngle) * spawnDist, 30, H - 30),
        pulse: 0,
        life: 600, // ~10 seconds
      });
    }

    for (let i = S.healItems.length - 1; i >= 0; i--) {
      const h = S.healItems[i];
      h.pulse += 0.07;
      h.life--;
      if (h.life <= 0) { S.healItems.splice(i, 1); continue; }

      if (dist(S.px, S.py, h.x, h.y) < PLAYER_R + HEAL_R) {
        S.hp = S.maxHp;
        onHpChange(S.hp, S.maxHp);
        addParticles(h.x, h.y, C.heal, 10, { speed: 3, glow: true });
        addFloatText(h.x, h.y - 16, 'HP MAX!', C.heal, true);
        S.healItems.splice(i, 1);
      }
    }

    /* Passive score */
    if (S.frame % 60 === 0) {
      S.score += 5;
      onScore(S.score);
    }

    /* Particles */
    updateParticleList(S.particles, true);
    updateParticleList(S.trailParticles, false);

    /* Float texts */
    for (let i = S.floatTexts.length - 1; i >= 0; i--) {
      const ft = S.floatTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.018;
      if (ft.life <= 0) S.floatTexts.splice(i, 1);
    }

    /* Ambient heat particles */
    for (const hp of S.heatParticles) {
      hp.x += hp.vx;
      hp.y += hp.vy;
      hp.life -= 0.005;
      if (hp.life <= 0 || hp.y < -10) {
        hp.x = Math.random() * W;
        hp.y = H + rnd(5, 20);
        hp.life = 1;
        hp.alpha = rnd(0.05, 0.15);
      }
    }
  }

  function updateParticleList(list, hasVelocity) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (hasVelocity) { p.x += p.vx; p.y += p.vy; p.vy += 0.02; }
      p.life -= p.decay;
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  function takeDamage() {
    S.hp--;
    S.iframe = IFRAME_DUR;
    S.screenShake = 10;
    onHpChange(S.hp, S.maxHp);
    addParticles(S.px, S.py, C.heart, 8, { speed: 4, glow: true });
    addFloatText(S.px, S.py - 20, '-1 ♥', C.heart);
    if (S.hp <= 0) {
      S.running = false;
      // Final explosion
      addParticles(S.px, S.py, C.corona, 20, { speed: 5, sizeMax: 6, glow: true });
      addParticles(S.px, S.py, '#fff', 12, { speed: 4, sizeMax: 4 });
    }
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();

    // Screen shake
    if (S.screenShake > 0) {
      const shk = S.screenShake;
      ctx.translate((Math.random() - 0.5) * shk * 2, (Math.random() - 0.5) * shk * 2);
    }

    drawBackground();
    drawHeatParticles();
    drawHealItems();
    drawDarkBullets();
    drawEnemies();
    drawTrailParticles();
    drawBullets();
    drawPlayer();
    drawParticles();
    drawFloatTexts();
    drawVignette();
    drawHUD();
    drawWaveBanner();

    ctx.restore();
  }

  /* ── Draw sub-routines ── */

  function drawBackground() {
    // Dark base
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial warm center glow
    const bgGrad = ctx.createRadialGradient(CX, CY, 20, CX, CY, 320);
    bgGrad.addColorStop(0, 'rgba(255,152,0,0.06)');
    bgGrad.addColorStop(0.5, 'rgba(255,87,34,0.02)');
    bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of S.stars) {
      const twinkle = 0.5 + Math.sin(S.frame * 0.015 + s.twinkleOff) * 0.5;
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,152,0,0.03)';
    ctx.lineWidth = 1;
    const gridOff = (S.frame * 0.3) % 40;
    for (let x = -40 + gridOff; x < W + 40; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = -40 + gridOff; y < H + 40; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawHeatParticles() {
    for (const hp of S.heatParticles) {
      ctx.globalAlpha = hp.alpha * hp.life;
      ctx.fillStyle = C.heatParticle;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, hp.size, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    ctx.save();
    if (S.iframe > 0 && S.frame % 4 < 2) ctx.globalAlpha = 0.3;

    const px = S.px, py = S.py;

    // Outer corona glow (large, dim)
    const coronaSize = PLAYER_R * 2.8 + Math.sin(S.frame * 0.08) * 4;
    const outerGlow = ctx.createRadialGradient(px, py, PLAYER_R * 0.5, px, py, coronaSize);
    outerGlow.addColorStop(0, 'rgba(255,183,77,0.25)');
    outerGlow.addColorStop(0.5, 'rgba(255,111,0,0.08)');
    outerGlow.addColorStop(1, 'rgba(255,87,34,0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(px, py, coronaSize, 0, PI2);
    ctx.fill();

    // Corona rays (rotating triangles)
    const rayCount = 8;
    const baseRayLen = PLAYER_R * 1.6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(S.frame * 0.015);
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * PI2;
      const rayLen = baseRayLen + Math.sin(S.frame * 0.1 + i * 1.3) * 4;
      const halfW = 3 + Math.sin(S.frame * 0.07 + i) * 1;
      ctx.fillStyle = `rgba(255,183,77,${0.3 + Math.sin(S.frame * 0.06 + i * 0.8) * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * PLAYER_R * 0.6, Math.sin(a) * PLAYER_R * 0.6);
      ctx.lineTo(
        Math.cos(a) * rayLen + Math.cos(a + PI / 2) * halfW,
        Math.sin(a) * rayLen + Math.sin(a + PI / 2) * halfW,
      );
      ctx.lineTo(
        Math.cos(a) * rayLen - Math.cos(a + PI / 2) * halfW,
        Math.sin(a) * rayLen - Math.sin(a + PI / 2) * halfW,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Core body (bright circle)
    const bodyGrad = ctx.createRadialGradient(px - 3, py - 3, 2, px, py, PLAYER_R);
    bodyGrad.addColorStop(0, '#FFF8E1');
    bodyGrad.addColorStop(0.4, C.player);
    bodyGrad.addColorStop(1, C.coronaOuter);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_R, 0, PI2);
    ctx.fill();

    // Bright highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(px - 3, py - 4, PLAYER_R * 0.35, 0, PI2);
    ctx.fill();

    // Aim indicator (small dot in aim direction)
    const aimDist = PLAYER_R + 8;
    ctx.fillStyle = 'rgba(255,235,59,0.7)';
    ctx.beginPath();
    ctx.arc(
      px + Math.cos(S.aimAngle) * aimDist,
      py + Math.sin(S.aimAngle) * aimDist,
      3, 0, PI2,
    );
    ctx.fill();

    ctx.restore();
  }

  function drawBullets() {
    for (const b of S.bullets) {
      ctx.save();
      // Glow
      const grd = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, BULLET_R * 2.5);
      grd.addColorStop(0, 'rgba(255,235,59,0.5)');
      grd.addColorStop(1, 'rgba(255,235,59,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R * 2.5, 0, PI2);
      ctx.fill();
      // Core
      ctx.fillStyle = C.bulletGlow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R, 0, PI2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R * 0.5, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDarkBullets() {
    for (const db of S.darkBullets) {
      ctx.save();
      const grd = ctx.createRadialGradient(db.x, db.y, 1, db.x, db.y, DARK_BULLET_R * 3);
      grd.addColorStop(0, 'rgba(126,87,194,0.5)');
      grd.addColorStop(1, 'rgba(126,87,194,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(db.x, db.y, DARK_BULLET_R * 3, 0, PI2);
      ctx.fill();

      ctx.fillStyle = C.darkBulletGlow;
      ctx.beginPath();
      ctx.arc(db.x, db.y, DARK_BULLET_R, 0, PI2);
      ctx.fill();
      ctx.fillStyle = '#e1bee7';
      ctx.beginPath();
      ctx.arc(db.x, db.y, DARK_BULLET_R * 0.45, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemies() {
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      ctx.save();
      ctx.translate(e.x, e.y);

      // Outer glow
      const grd = ctx.createRadialGradient(0, 0, e.r * 0.3, 0, 0, e.r * 2);
      grd.addColorStop(0, e.glow + '55');
      grd.addColorStop(1, e.glow + '00');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 2, 0, PI2);
      ctx.fill();

      // Hit flash
      if (e.hitFlash > 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 2, 0, PI2);
        ctx.fill();
      }

      // Body shape depends on type
      if (e.type === 'wisp') {
        drawWisp(e);
      } else if (e.type === 'stalker') {
        drawStalker(e);
      } else {
        drawTitan(e);
      }

      // HP bar for multi-hp enemies
      if (e.maxHp > 1) {
        const barW = e.r * 2;
        const barH = 3;
        const barY = e.r + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        ctx.fillStyle = e.glow;
        ctx.fillRect(-barW / 2, barY, barW * (e.hp / e.maxHp), barH);
      }

      ctx.restore();
    }
  }

  function drawWisp(e) {
    // Small flickering orb
    const flicker = 0.8 + Math.sin(S.frame * 0.15 + e.wobble) * 0.2;
    const bodyGrd = ctx.createRadialGradient(0, 0, 1, 0, 0, e.r);
    bodyGrd.addColorStop(0, '#ce93d8');
    bodyGrd.addColorStop(0.6, e.color);
    bodyGrd.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = bodyGrd;
    ctx.globalAlpha = flicker;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Eyes
    ctx.fillStyle = '#e1bee7';
    ctx.beginPath();
    ctx.arc(-3, -2, 2, 0, PI2);
    ctx.arc(3, -2, 2, 0, PI2);
    ctx.fill();
  }

  function drawStalker(e) {
    // Diamond shape
    const s = e.r;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    // Inner glow
    const innerGrd = ctx.createRadialGradient(0, 0, 1, 0, 0, s * 0.6);
    innerGrd.addColorStop(0, e.glow);
    innerGrd.addColorStop(1, e.color);
    ctx.fillStyle = innerGrd;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(s * 0.4, 0);
    ctx.lineTo(0, s * 0.6);
    ctx.lineTo(-s * 0.4, 0);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#b388ff';
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, PI2);
    ctx.fill();
  }

  function drawTitan(e) {
    // Large irregular body with tendrils
    const s = e.r;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI2;
      const r = s * (0.85 + Math.sin(S.frame * 0.05 + i * 2.1) * 0.15);
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    // Inner face
    const faceGrd = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 0.7);
    faceGrd.addColorStop(0, e.glow);
    faceGrd.addColorStop(1, e.color);
    ctx.fillStyle = faceGrd;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, PI2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(-6, -4, 3.5, 0, PI2);
    ctx.arc(6, -4, 3.5, 0, PI2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -4, 1.5, 0, PI2);
    ctx.arc(6, -4, 1.5, 0, PI2);
    ctx.fill();
  }

  function drawHealItems() {
    for (const h of S.healItems) {
      ctx.save();
      const pulse = 0.7 + Math.sin(h.pulse) * 0.3;
      const fade = h.life < 120 ? h.life / 120 : 1;

      // Outer glow
      const grd = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, HEAL_R * 2.5);
      grd.addColorStop(0, `rgba(0,230,118,${0.3 * pulse * fade})`);
      grd.addColorStop(1, 'rgba(0,230,118,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(h.x, h.y, HEAL_R * 2.5, 0, PI2);
      ctx.fill();

      ctx.globalAlpha = fade;
      // Green cross
      const cs = HEAL_R * 0.6;
      ctx.fillStyle = C.heal;
      ctx.fillRect(h.x - cs / 3, h.y - cs, cs * 0.67, cs * 2);
      ctx.fillRect(h.x - cs, h.y - cs / 3, cs * 2, cs * 0.67);

      // White highlight center
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 3, 0, PI2);
      ctx.fill();

      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of S.particles) {
      ctx.globalAlpha = p.life;
      if (p.glow) {
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * p.life * 2);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, p.color + '00');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 2, 0, PI2);
        ctx.fill();
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrailParticles() {
    for (const p of S.trailParticles) {
      ctx.globalAlpha = p.life * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    for (const ft of S.floatTexts) {
      ctx.save();
      ctx.globalAlpha = clamp(ft.life * 2, 0, 1);
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  function drawVignette() {
    const grd = ctx.createRadialGradient(CX, CY, W * 0.25, CX, CY, W * 0.72);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHUD() {
    ctx.save();

    // Hearts
    for (let i = 0; i < S.maxHp; i++) {
      const hx = 14 + i * 22;
      const hy = 16;
      const filled = i < S.hp;
      const scale = filled && S.iframe > 0 && S.iframe > IFRAME_DUR - 8
        ? 1 + Math.sin(S.frame * 0.5) * 0.2 : 1;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(scale, scale);
      drawHeart(0, 0, 7, filled ? C.heart : C.heartDim);
      ctx.restore();
    }

    // Score
    ctx.fillStyle = C.text;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${S.score}`, W - 12, 19);

    // Wave
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Ondata ${S.wave}`, W - 12, 35);

    ctx.restore();
  }

  function drawHeart(cx, cy, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const topY = cy - size * 0.4;
    ctx.moveTo(cx, cy + size * 0.7);
    ctx.bezierCurveTo(cx - size * 1.2, cy - size * 0.2, cx - size * 0.7, topY - size * 0.6, cx, topY);
    ctx.bezierCurveTo(cx + size * 0.7, topY - size * 0.6, cx + size * 1.2, cy - size * 0.2, cx, cy + size * 0.7);
    ctx.fill();
  }

  function drawWaveBanner() {
    if (!S.waveBanner) return;
    const wb = S.waveBanner;
    const alpha = wb.life > 0.7 ? (1 - wb.life) / 0.3 : wb.life > 0.3 ? 1 : wb.life / 0.3;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = '#FFD54F';
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wb.text, CX, CY * 0.4);
    ctx.restore();
  }

  /* ── Game loop ── */
  function gameLoop() {
    update();
    draw();
    if (S.running) {
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      onGameOver(S.score);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);

  return function cleanup() {
    S.running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
