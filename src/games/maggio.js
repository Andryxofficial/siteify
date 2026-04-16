/**
 * MAGGIO — Bloom Blitz 🌸
 * Garden defense action game — plant flowers, fight bug waves, survive.
 *
 * Features:
 * - Free-roam 480×480 garden with radial-gradient ground
 * - Player gardener with directional facing, glow trail, iframes blink
 * - Flowers that bloom over 4 stages with petal particles
 * - 3 bug types (aphid / beetle / moth) with wave scaling
 * - Spray attack with cone particles and knockback
 * - Heal power-up (green cross) every 1000 pts → full HP
 * - Animated HUD: hearts, score, wave counter
 * - Ambient floating petals, vignette, screen shake
 * - Float text for score, wave banners, damage
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Bloom Blitz',
  emoji: '🌸',
  description: 'Fai fiorire il giardino e difendilo dagli insetti!',
  color: '#E91E63',
  controls: 'joystick',
  instructions:
    'Muoviti con WASD/frecce o joystick. Premi Spazio o 🌺 per spruzzare insetticida. Pianta fiori automaticamente mentre cammini. Difendi il giardino dagli insetti!',
  gameOverTitle: 'Il giardino è appassito!',
  actionLabel: '🌺',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const PI2 = Math.PI * 2;
const PI = Math.PI;

const PLAYER_R = 13;
const PLAYER_SPD = 2.4;
const SPRAY_DUR = 18;
const SPRAY_RANGE = 55;
const SPRAY_CONE = PI * 0.45;
const IFRAME_DUR = 40;

const FLOWER_GROW_TIME = 300; // frames to full bloom
const FLOWER_MAX = 18;
const FLOWER_PLANT_CD = 50;
const FLOWER_R = 14;
const FLOWER_STAGES = 4; // seed → sprout → bud → bloom

const HEAL_R = 16;

const BUG_TYPES = {
  aphid:  { hp: 1, spd: 0.7,  pts: 10, r: 8,  col: '#8BC34A', glow: 'rgba(139,195,74,0.5)',  eatSpd: 0.4  },
  beetle: { hp: 2, spd: 0.5,  pts: 25, r: 11, col: '#FF9800', glow: 'rgba(255,152,0,0.5)',   eatSpd: 0.7  },
  moth:   { hp: 1, spd: 1.15, pts: 15, r: 9,  col: '#CE93D8', glow: 'rgba(206,147,216,0.5)', eatSpd: 0.3  },
};

/* ─── Palette ─── */
const P = {
  bg: '#0a0e15',
  ground1: '#0f1a10', ground2: '#0a1208',
  player: '#00E5FF', playerInner: '#00B8D4', playerTrail: 'rgba(0,229,255,0.12)',
  spray: '#76FF03', sprayGlow: 'rgba(118,255,3,0.4)',
  flowerPink: '#FF4081', flowerYellow: '#FFD740', flowerPurple: '#CE93D8',
  flowerBlue: '#40C4FF', flowerWhite: '#FAFAFA',
  stem: '#388E3C', leaf: '#4CAF50',
  heart: '#FF0050', heartDim: 'rgba(255,0,80,0.18)',
  heal: '#00E676', healGlow: 'rgba(0,230,118,0.45)',
  text: '#f0ecf4', textDim: '#7a7590',
  vignette: 'rgba(0,0,0,0.55)',
};

const FLOWER_PALETTES = [
  [P.flowerPink, '#FF80AB'],
  [P.flowerYellow, '#FFECB3'],
  [P.flowerPurple, '#E1BEE7'],
  [P.flowerBlue, '#B3E5FC'],
  [P.flowerWhite, '#E0E0E0'],
];

/* ─── Helpers ─── */
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function rng(min, max) { return min + Math.random() * (max - min); }
function rngInt(min, max) { return Math.floor(rng(min, max + 1)); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

function normAngle(a) {
  while (a > PI) a -= PI2;
  while (a < -PI) a += PI2;
  return a;
}

/* ─── Main game factory ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ─── State ─── */
  const S = {
    running: true,
    frame: 0,

    // Player
    px: W / 2, py: H / 2,
    facing: 0,
    iframes: 0,
    attacking: 0,
    plantCD: 0,
    trail: [],

    // Stats
    hp: 5, maxHp: 5,
    score: 0,
    lastHealAt: 0,

    // Entities
    flowers: [],
    bugs: [],
    heals: [],

    // Wave system
    wave: 1,
    waveTimer: 0,
    waveBugsLeft: 0,
    waveSpawnCD: 0,
    waveBanner: null, // { text, life }
    betweenWaves: true,
    betweenTimer: 120, // short grace period at start

    // FX
    particles: [],
    floatTexts: [],
    petals: [],
    screenShake: 0,
  };

  // Initial ambient petals
  for (let i = 0; i < 25; i++) {
    S.petals.push(makePetal());
  }

  function makePetal() {
    const pal = FLOWER_PALETTES[rngInt(0, FLOWER_PALETTES.length - 1)];
    return {
      x: rng(0, W), y: rng(-H, H),
      size: rng(3, 6),
      rot: rng(0, PI2),
      rotSpd: rng(-0.03, 0.03),
      vx: rng(-0.3, 0.3),
      vy: rng(0.2, 0.6),
      color: pal[0],
      alpha: rng(0.06, 0.14),
    };
  }

  onHpChange(S.hp, S.maxHp);
  onScore(0);

  /* ─── Wave logic ─── */
  function startWave() {
    S.betweenWaves = false;
    const bugCount = 3 + S.wave * 2 + Math.floor(S.wave * S.wave * 0.15);
    S.waveBugsLeft = bugCount;
    S.waveSpawnCD = 0;
    S.waveBanner = { text: `~ Ondata ${S.wave} ~`, life: 1 };
  }

  function spawnBug() {
    const types = ['aphid'];
    if (S.wave >= 2) types.push('beetle');
    if (S.wave >= 3) types.push('moth');
    const type = types[rngInt(0, types.length - 1)];
    const stats = BUG_TYPES[type];

    // Spawn from edges
    let x, y;
    const side = rngInt(0, 3);
    if (side === 0) { x = rng(0, W); y = -20; }
    else if (side === 1) { x = W + 20; y = rng(0, H); }
    else if (side === 2) { x = rng(0, W); y = H + 20; }
    else { x = -20; y = rng(0, H); }

    const spdMul = 1 + S.wave * 0.04;
    S.bugs.push({
      x, y, type,
      hp: stats.hp + (S.wave >= 5 ? 1 : 0),
      maxHp: stats.hp + (S.wave >= 5 ? 1 : 0),
      spd: stats.spd * spdMul,
      pts: stats.pts,
      r: stats.r,
      col: stats.col,
      glow: stats.glow,
      eatSpd: stats.eatSpd,
      phase: rng(0, PI2),
      target: null,    // flower index or 'player'
      knockback: 0,
      kbAngle: 0,
      deathTimer: 0,   // >0 = dying
      hitFlash: 0,
    });
  }

  /* ─── Flower planting ─── */
  function plantFlower(x, y) {
    if (S.flowers.length >= FLOWER_MAX) return;
    // Don't plant too close to existing flowers
    for (const f of S.flowers) {
      if (dist(x, y, f.x, f.y) < FLOWER_R * 2.5) return;
    }
    const palIdx = rngInt(0, FLOWER_PALETTES.length - 1);
    S.flowers.push({
      x, y,
      growth: 0,  // 0 → FLOWER_GROW_TIME
      palIdx,
      hp: 3,
      phase: rng(0, PI2),
      scored: Array(FLOWER_STAGES).fill(false), // one-time stage score
    });
  }

  /* ─── Spray attack ─── */
  function doSpray() {
    if (S.attacking > 0) return;
    S.attacking = SPRAY_DUR;

    // Spawn spray particles
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = S.facing + rng(-SPRAY_CONE / 2, SPRAY_CONE / 2);
      const spd = rng(3, 7);
      S.particles.push({
        x: S.px + Math.cos(S.facing) * PLAYER_R,
        y: S.py + Math.sin(S.facing) * PLAYER_R,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 1,
        decay: rng(0.04, 0.07),
        color: P.spray,
        size: rng(2, 5),
        type: 'spray',
      });
    }
  }

  /* ─── Particle / text helpers ─── */
  function addParticles(x, y, color, count, spdMul = 1) {
    for (let i = 0; i < count; i++) {
      S.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4 * spdMul,
        vy: (Math.random() - 0.5) * 4 * spdMul,
        life: 1,
        decay: rng(0.02, 0.04),
        color,
        size: rng(2, 4),
        type: 'default',
      });
    }
  }

  function addPetalBurst(x, y, palIdx, count) {
    const pal = FLOWER_PALETTES[palIdx];
    for (let i = 0; i < count; i++) {
      const a = rng(0, PI2);
      const spd = rng(1, 3.5);
      S.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 1,
        decay: rng(0.015, 0.03),
        color: pal[rngInt(0, 1)],
        size: rng(3, 6),
        type: 'petal',
        rot: rng(0, PI2),
        rotSpd: rng(-0.1, 0.1),
      });
    }
  }

  function addFloat(x, y, text, color, big = false) {
    S.floatTexts.push({ x, y, text, color, life: 1, big });
  }

  /* ─── Damage player ─── */
  function hurtPlayer(dmg) {
    if (S.iframes > 0) return;
    S.hp = Math.max(0, S.hp - dmg);
    S.iframes = IFRAME_DUR;
    S.screenShake = 8;
    onHpChange(S.hp, S.maxHp);
    addParticles(S.px, S.py, P.heart, 6, 1.5);
    addFloat(S.px, S.py - 20, `-${dmg} ♥`, P.heart);
    if (S.hp <= 0) {
      S.running = false;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     UPDATE
     ═══════════════════════════════════════════════════════════ */
  function update() {
    if (!S.running) return;
    S.frame++;

    const keys = keysRef.current;
    const joy = joystickRef.current;

    /* ── Player movement ── */
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

    if (joy.active) {
      dx += joy.dx;
      dy += joy.dy;
    }

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0.2) {
      const nx = dx / mag, ny = dy / mag;
      S.px = clamp(S.px + nx * PLAYER_SPD, PLAYER_R + 4, W - PLAYER_R - 4);
      S.py = clamp(S.py + ny * PLAYER_SPD, PLAYER_R + 30, H - PLAYER_R - 4);
      S.facing = Math.atan2(ny, nx);

      // Trail
      if (S.frame % 3 === 0) {
        S.trail.push({ x: S.px, y: S.py, life: 1 });
      }

      // Auto-plant flowers while moving
      if (S.plantCD <= 0) {
        plantFlower(S.px, S.py + PLAYER_R + 8);
        S.plantCD = FLOWER_PLANT_CD;
      }
    }
    if (S.plantCD > 0) S.plantCD--;

    // Trim trail
    for (let i = S.trail.length - 1; i >= 0; i--) {
      S.trail[i].life -= 0.04;
      if (S.trail[i].life <= 0) S.trail.splice(i, 1);
    }

    /* ── Attack input ── */
    if (keys[' '] || keys['Space'] || actionBtnRef.current) {
      doSpray();
      actionBtnRef.current = false;
    }
    if (S.attacking > 0) S.attacking--;

    /* ── Iframes ── */
    if (S.iframes > 0) S.iframes--;

    /* ── Flower growth ── */
    for (const f of S.flowers) {
      if (f.hp <= 0) continue;
      if (f.growth < FLOWER_GROW_TIME) {
        f.growth++;
        f.phase += 0.03;

        // Award points for reaching new stages
        const stage = flowerStage(f);
        if (stage > 0 && !f.scored[stage]) {
          f.scored[stage] = true;
          const pts = stage * 15;
          S.score += pts;
          onScore(S.score);
          addFloat(f.x, f.y - 12, `+${pts}`, FLOWER_PALETTES[f.palIdx][0]);
          if (stage === 3) { // full bloom burst
            addPetalBurst(f.x, f.y, f.palIdx, 10);
          }
        }
      } else {
        f.phase += 0.02;
        // Passive score for fully bloomed flowers
        if (S.frame % 180 === 0) {
          S.score += 5;
          onScore(S.score);
        }
      }
    }
    // Remove dead flowers
    for (let i = S.flowers.length - 1; i >= 0; i--) {
      if (S.flowers[i].hp <= 0) {
        addPetalBurst(S.flowers[i].x, S.flowers[i].y, S.flowers[i].palIdx, 8);
        addFloat(S.flowers[i].x, S.flowers[i].y - 10, '💀', '#888');
        S.flowers.splice(i, 1);
      }
    }

    /* ── Wave system ── */
    if (S.betweenWaves) {
      S.betweenTimer--;
      if (S.betweenTimer <= 0) {
        startWave();
      }
    } else {
      // Spawn bugs for current wave
      if (S.waveBugsLeft > 0) {
        S.waveSpawnCD--;
        if (S.waveSpawnCD <= 0) {
          spawnBug();
          S.waveBugsLeft--;
          S.waveSpawnCD = Math.max(15, 60 - S.wave * 3);
        }
      }
      // Check wave complete (all spawned + all dead)
      const aliveBugs = S.bugs.filter(b => b.deathTimer === 0);
      if (S.waveBugsLeft <= 0 && aliveBugs.length === 0) {
        S.wave++;
        S.betweenWaves = true;
        S.betweenTimer = 150; // grace between waves
        const waveBonus = S.wave * 50;
        S.score += waveBonus;
        onScore(S.score);
        addFloat(W / 2, H / 2 - 30, `Ondata completata! +${waveBonus}`, '#FFD740', true);
      }
    }

    /* ── Bug AI ── */
    for (let i = S.bugs.length - 1; i >= 0; i--) {
      const b = S.bugs[i];

      // Death animation
      if (b.deathTimer > 0) {
        b.deathTimer--;
        if (b.deathTimer <= 0) {
          S.bugs.splice(i, 1);
        }
        continue;
      }

      if (b.hitFlash > 0) b.hitFlash--;

      // Knockback
      if (b.knockback > 0) {
        b.x += Math.cos(b.kbAngle) * b.knockback;
        b.y += Math.sin(b.kbAngle) * b.knockback;
        b.knockback *= 0.8;
        if (b.knockback < 0.3) b.knockback = 0;
        continue;
      }

      b.phase += 0.05;

      // Pick target: nearest flower, or player if no flowers
      let tx, ty;
      let targetFlower = null;
      let bestDist = Infinity;
      for (const f of S.flowers) {
        if (f.hp <= 0) continue;
        const d = dist(b.x, b.y, f.x, f.y);
        if (d < bestDist) { bestDist = d; targetFlower = f; }
      }

      if (targetFlower && bestDist < 300) {
        tx = targetFlower.x;
        ty = targetFlower.y;
      } else {
        tx = S.px;
        ty = S.py;
      }

      // Move toward target with slight wobble
      const toTarget = angle(b.x, b.y, tx, ty);
      const wobble = Math.sin(b.phase * 2) * 0.3;
      b.x += Math.cos(toTarget + wobble) * b.spd;
      b.y += Math.sin(toTarget + wobble) * b.spd;

      // Eat flower
      if (targetFlower) {
        const d = dist(b.x, b.y, targetFlower.x, targetFlower.y);
        if (d < b.r + FLOWER_R) {
          targetFlower.hp -= b.eatSpd * 0.05;
        }
      }

      // Hurt player on contact
      const playerDist = dist(b.x, b.y, S.px, S.py);
      if (playerDist < b.r + PLAYER_R) {
        hurtPlayer(1);
        b.knockback = 6;
        b.kbAngle = angle(S.px, S.py, b.x, b.y);
      }

      // Keep in bounds (with margin)
      b.x = clamp(b.x, -30, W + 30);
      b.y = clamp(b.y, -30, H + 30);
    }

    /* ── Spray collision with bugs ── */
    if (S.attacking > SPRAY_DUR - 6) {
      for (const b of S.bugs) {
        if (b.deathTimer > 0) continue;
        const d = dist(S.px, S.py, b.x, b.y);
        if (d > SPRAY_RANGE) continue;
        const a = angle(S.px, S.py, b.x, b.y);
        const diff = Math.abs(normAngle(a - S.facing));
        if (diff < SPRAY_CONE / 2) {
          b.hp--;
          b.hitFlash = 6;
          b.knockback = 5;
          b.kbAngle = a;
          if (b.hp <= 0) {
            b.deathTimer = 20;
            S.score += b.pts;
            onScore(S.score);
            addParticles(b.x, b.y, b.col, 10);
            addFloat(b.x, b.y - 10, `+${b.pts}`, b.col);
          }
        }
      }
    }

    /* ── Heal power-up (every 1000 pts) ── */
    const healMilestone = Math.floor(S.score / 1000);
    if (healMilestone > S.lastHealAt) {
      S.lastHealAt = healMilestone;
      S.heals.push({
        x: rng(40, W - 40),
        y: rng(60, H - 40),
        phase: 0,
        life: 600, // 10 seconds
      });
      addFloat(W / 2, H / 2, '💚 Cura apparsa!', P.heal, true);
    }

    for (let i = S.heals.length - 1; i >= 0; i--) {
      const h = S.heals[i];
      h.phase += 0.06;
      h.life--;
      if (h.life <= 0) { S.heals.splice(i, 1); continue; }
      if (dist(S.px, S.py, h.x, h.y) < PLAYER_R + HEAL_R) {
        S.hp = S.maxHp;
        onHpChange(S.hp, S.maxHp);
        addParticles(h.x, h.y, P.heal, 14, 1.5);
        addFloat(h.x, h.y - 20, '♥ MAX HP', P.heal);
        S.heals.splice(i, 1);
      }
    }

    /* ── Particles ── */
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'default') p.vy += 0.06;
      if (p.type === 'spray') { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.type === 'petal' && p.rotSpd) p.rot += p.rotSpd;
      p.life -= p.decay;
      if (p.life <= 0) S.particles.splice(i, 1);
    }

    /* ── Float texts ── */
    for (let i = S.floatTexts.length - 1; i >= 0; i--) {
      const ft = S.floatTexts[i];
      ft.y -= 0.8;
      ft.life -= 0.018;
      if (ft.life <= 0) S.floatTexts.splice(i, 1);
    }

    /* ── Wave banner ── */
    if (S.waveBanner) {
      S.waveBanner.life -= 0.012;
      if (S.waveBanner.life <= 0) S.waveBanner = null;
    }

    /* ── Ambient petals ── */
    for (const p of S.petals) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpd;
      if (p.y > H + 10) { p.y = -10; p.x = rng(0, W); }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
    }

    /* ── Screen shake ── */
    if (S.screenShake > 0) S.screenShake--;
  }

  /* ═══════════════════════════════════════════════════════════
     DRAW HELPERS
     ═══════════════════════════════════════════════════════════ */
  function flowerStage(f) {
    const pct = f.growth / FLOWER_GROW_TIME;
    if (pct < 0.15) return 0; // seed
    if (pct < 0.4) return 1;  // sprout
    if (pct < 0.75) return 2; // bud
    return 3;                  // bloom
  }

  /** Draw a multi-petal flower shape */
  function drawFlowerShape(x, y, r, petalCount, mainCol, innerCol, phase) {
    ctx.save();
    ctx.translate(x, y);

    // Glow
    ctx.shadowColor = mainCol;
    ctx.shadowBlur = 10 + Math.sin(phase) * 4;

    // Petals
    for (let i = 0; i < petalCount; i++) {
      const a = (PI2 / petalCount) * i + Math.sin(phase) * 0.08;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = mainCol;
      ctx.beginPath();
      ctx.ellipse(r * 0.5, 0, r * 0.55, r * 0.3, 0, 0, PI2);
      ctx.fill();
      ctx.restore();
    }

    // Center
    ctx.shadowBlur = 0;
    ctx.fillStyle = innerCol;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, PI2);
    ctx.fill();

    ctx.restore();
  }

  function drawBug(b) {
    const dying = b.deathTimer > 0;
    const alpha = dying ? b.deathTimer / 20 : 1;
    const scale = dying ? 0.5 + (b.deathTimer / 20) * 0.5 : 1;
    const flash = b.hitFlash > 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);
    ctx.scale(scale, scale);

    // Glow
    ctx.shadowColor = flash ? '#fff' : b.glow;
    ctx.shadowBlur = flash ? 14 : 8;

    const fillCol = flash ? '#fff' : b.col;

    if (b.type === 'aphid') {
      // Small round body with legs
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, PI2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-3, -3, 2, 0, PI2);
      ctx.arc(3, -3, 2, 0, PI2);
      ctx.fill();
      // Legs
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 1.5;
      const legOff = Math.sin(b.phase * 3) * 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * b.r, -2);
        ctx.lineTo(side * (b.r + 5), -5 + legOff);
        ctx.moveTo(side * b.r, 2);
        ctx.lineTo(side * (b.r + 5), 5 - legOff);
        ctx.stroke();
      }
    } else if (b.type === 'beetle') {
      // Oval body with shell
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 1.2, b.r, 0, 0, PI2);
      ctx.fill();
      // Shell line
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -b.r);
      ctx.lineTo(0, b.r);
      ctx.stroke();
      // Head
      ctx.fillStyle = flash ? '#eee' : '#5D4037';
      ctx.beginPath();
      ctx.arc(-b.r * 0.8, 0, b.r * 0.5, 0, PI2);
      ctx.fill();
      // Mandibles
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 2;
      const mand = Math.sin(b.phase * 2) * 0.2;
      ctx.beginPath();
      ctx.moveTo(-b.r * 1.2, -2);
      ctx.lineTo(-b.r * 1.6, -4 - mand * 3);
      ctx.moveTo(-b.r * 1.2, 2);
      ctx.lineTo(-b.r * 1.6, 4 + mand * 3);
      ctx.stroke();
    } else if (b.type === 'moth') {
      // Wings
      const wingFlap = Math.sin(b.phase * 6) * 0.3;
      ctx.fillStyle = fillCol;
      ctx.save();
      ctx.rotate(wingFlap);
      ctx.beginPath();
      ctx.ellipse(-4, 0, b.r * 1.2, b.r * 0.7, -0.3, 0, PI2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.rotate(-wingFlap);
      ctx.beginPath();
      ctx.ellipse(4, 0, b.r * 1.2, b.r * 0.7, 0.3, 0, PI2);
      ctx.fill();
      ctx.restore();
      // Body
      ctx.fillStyle = flash ? '#eee' : '#4A148C';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, b.r * 0.6, 0, 0, PI2);
      ctx.fill();
      // Antennae
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(-6, -b.r - 4, -8, -b.r - 6);
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(6, -b.r - 4, 8, -b.r - 6);
      ctx.stroke();
    }

    // HP bar for multi-hp bugs
    if (b.maxHp > 1 && !dying) {
      ctx.shadowBlur = 0;
      const barW = b.r * 2;
      const barH = 3;
      const barY = -b.r - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = b.col;
      ctx.fillRect(-barW / 2, barY, barW * (b.hp / b.maxHp), barH);
    }

    ctx.restore();
  }

  function drawHeart(x, y, size, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 12, size / 12);

    ctx.fillStyle = filled ? P.heart : P.heartDim;
    if (filled) {
      ctx.shadowColor = P.heart;
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-1, 0, -6, -2, -6, -5);
    ctx.bezierCurveTo(-6, -9, -1, -10, 0, -7);
    ctx.bezierCurveTo(1, -10, 6, -9, 6, -5);
    ctx.bezierCurveTo(6, -2, 1, 0, 0, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════════
     DRAW
     ═══════════════════════════════════════════════════════════ */
  function draw() {
    ctx.save();

    // Screen shake
    if (S.screenShake > 0) {
      const intensity = S.screenShake * 1.5;
      ctx.translate(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity,
      );
    }

    /* ── Background ── */
    // Dark base
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial ground gradient
    const grd = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.6);
    grd.addColorStop(0, 'rgba(30,70,30,0.12)');
    grd.addColorStop(0.5, 'rgba(20,50,20,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Grid dots (garden soil)
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let gx = 20; gx < W; gx += 32) {
      for (let gy = 36; gy < H; gy += 32) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, PI2);
        ctx.fill();
      }
    }

    /* ── Ambient petals ── */
    for (const p of S.petals) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, PI2);
      ctx.fill();
      ctx.restore();
    }

    /* ── Player trail ── */
    for (const t of S.trail) {
      ctx.globalAlpha = t.life * 0.25;
      ctx.fillStyle = P.playerTrail;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PLAYER_R * t.life, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* ── Flowers ── */
    for (const f of S.flowers) {
      if (f.hp <= 0) continue;
      const stage = flowerStage(f);
      const pal = FLOWER_PALETTES[f.palIdx];

      // Stem
      if (stage >= 1) {
        const stemH = stage === 1 ? 8 : stage === 2 ? 14 : 18;
        ctx.strokeStyle = P.stem;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x, f.y + stemH);
        ctx.stroke();

        // Leaf
        if (stage >= 2) {
          ctx.fillStyle = P.leaf;
          ctx.save();
          ctx.translate(f.x + 3, f.y + stemH * 0.5);
          ctx.rotate(0.4 + Math.sin(f.phase) * 0.1);
          ctx.beginPath();
          ctx.ellipse(3, 0, 5, 2.5, 0, 0, PI2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (stage === 0) {
        // Seed — small dot
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.arc(f.x, f.y, 3, 0, PI2);
        ctx.fill();
      } else if (stage === 1) {
        // Sprout — small green shoot
        ctx.fillStyle = P.leaf;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 2, 3, 5, 0, 0, PI2);
        ctx.fill();
      } else if (stage === 2) {
        // Bud — closed petals
        ctx.fillStyle = pal[0];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 3, 5, 7, 0, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // Full bloom
        const sway = Math.sin(f.phase) * 0.6;
        drawFlowerShape(f.x + sway, f.y - 4, FLOWER_R * (0.8 + f.growth / FLOWER_GROW_TIME * 0.2), 6, pal[0], pal[1], f.phase);
      }

      // Damage tint
      if (f.hp < 2) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'rgba(139,69,19,0.5)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, FLOWER_R * 0.6, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ── Heal items ── */
    for (const h of S.heals) {
      const pulse = Math.sin(h.phase) * 3;
      const alpha = h.life < 120 ? h.life / 120 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(h.x, h.y);

      // Glow ring
      ctx.shadowColor = P.healGlow;
      ctx.shadowBlur = 14 + pulse;

      // Green cross
      ctx.fillStyle = P.heal;
      const cs = 7 + pulse * 0.5;
      ctx.fillRect(-cs, -cs / 3, cs * 2, cs * 0.66);
      ctx.fillRect(-cs / 3, -cs, cs * 0.66, cs * 2);

      // Sparkle ring
      ctx.shadowBlur = 0;
      ctx.strokeStyle = P.heal;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, HEAL_R + pulse, 0, PI2);
      ctx.stroke();

      ctx.restore();
    }

    /* ── Bugs ── */
    for (const b of S.bugs) {
      drawBug(b);
    }

    /* ── Player ── */
    {
      const visible = S.iframes === 0 || Math.floor(S.iframes / 3) % 2 === 0;
      if (visible) {
        ctx.save();
        ctx.translate(S.px, S.py);

        // Player glow
        ctx.shadowColor = P.player;
        ctx.shadowBlur = 12;

        // Body
        ctx.fillStyle = P.player;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R, 0, PI2);
        ctx.fill();

        // Inner
        ctx.shadowBlur = 0;
        ctx.fillStyle = P.playerInner;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R * 0.6, 0, PI2);
        ctx.fill();

        // Facing indicator (eyes/direction)
        const ex = Math.cos(S.facing) * 5;
        const ey = Math.sin(S.facing) * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex - 2, ey - 1, 2.5, 0, PI2);
        ctx.arc(ex + 2, ey - 1, 2.5, 0, PI2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(ex - 1.5, ey - 0.5, 1.2, 0, PI2);
        ctx.arc(ex + 2.5, ey - 0.5, 1.2, 0, PI2);
        ctx.fill();

        // Spray indicator
        if (S.attacking > 0) {
          const sprayAlpha = S.attacking / SPRAY_DUR;
          ctx.globalAlpha = sprayAlpha * 0.4;
          ctx.fillStyle = P.sprayGlow;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, SPRAY_RANGE, S.facing - SPRAY_CONE / 2, S.facing + SPRAY_CONE / 2);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }
    }

    /* ── Particles ── */
    for (const p of S.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      if (p.type === 'petal') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, PI2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'spray' ? 6 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, PI2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* ── Float texts ── */
    for (const ft of S.floatTexts) {
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = ft.big ? 'bold 18px Outfit, sans-serif' : 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ft.big) {
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    /* ── Wave banner ── */
    if (S.waveBanner) {
      const wb = S.waveBanner;
      ctx.save();
      ctx.globalAlpha = wb.life > 0.8 ? (1 - wb.life) / 0.2 : wb.life < 0.3 ? wb.life / 0.3 : 1;
      ctx.fillStyle = '#FFD740';
      ctx.font = 'bold 24px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#FFD740';
      ctx.shadowBlur = 16;
      ctx.fillText(wb.text, W / 2, H * 0.35);
      ctx.restore();
    }

    /* ── HUD ── */
    // Top bar background
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 30);

    // Hearts
    for (let i = 0; i < S.maxHp; i++) {
      drawHeart(16 + i * 22, 16, 10, i < S.hp);
    }

    // Score
    ctx.fillStyle = P.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`✦ ${S.score}`, W - 14, 16);

    // Wave
    ctx.fillStyle = P.textDim;
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ondata ${S.wave}`, W / 2, 16);

    // Flower count
    ctx.fillStyle = P.textDim;
    ctx.textAlign = 'right';
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillText(`🌸 ${S.flowers.length}/${FLOWER_MAX}`, W - 14, 28);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* ── Vignette ── */
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, P.vignette);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Low HP red tint
    if (S.hp <= 2 && S.hp > 0) {
      const pulse = 0.08 + Math.sin(S.frame * 0.08) * 0.04;
      ctx.fillStyle = `rgba(255,0,50,${pulse})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  /* ─── Game loop ─── */
  function gameLoop() {
    update();
    draw();
    if (S.running) {
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      // Final frame already drawn, signal game over
      onGameOver(S.score);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);

  return function cleanup() {
    S.running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
