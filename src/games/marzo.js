/**
 * MARZO — Wind Walker 🍃
 * Premium vertical-scrolling wind dodger with parallax, particles, and polished visuals.
 *
 * Controls: joystick/WASD to move left/right, action button for wind burst.
 * Features: 3 HP, heal every 1000 pts, leaf collectibles, thorn/branch hazards,
 *           wind gusts, parallax trees/clouds, leaf particles, screen shake, vignette.
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Wind Walker',
  emoji: '🍃',
  description: 'Cavalca il vento e raccogli le foglie!',
  color: '#4CAF50',
  controls: 'joystick',
  instructions: 'Muoviti con ← → o WASD. Premi 🌬️ per emettere una raffica di vento che respinge gli ostacoli!',
  gameOverTitle: 'Portato via dal vento!',
  actionLabel: '🌬️',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const PR = 13;
const SCROLL_BASE = 1.5;
const PLAYER_SPD = 3.8;
const BURST_COOLDOWN = 90;
const BURST_DURATION = 20;
const BURST_RADIUS = 100;
const IFRAME_DUR = 60;
const HEAL_THRESHOLD = 1000;
const LEAF_R = 10;
const THORN_R = 14;
const BRANCH_H = 10;
const HEAL_R = 14;

/* ─── Palette ─── */
const P = {
  bg1: '#060f08', bg2: '#0a1710', bg3: '#0f1f15',
  player: '#66BB6A', playerInner: '#2E7D32', playerGlow: 'rgba(102,187,106,0.25)',
  playerTrail: 'rgba(102,187,106,0.12)',
  leaf: '#FDD835', leafGlow: 'rgba(253,216,53,0.3)',
  leafAlt: '#AED581', leafAltGlow: 'rgba(174,213,129,0.25)',
  thorn: '#D32F2F', thornGlow: 'rgba(211,47,47,0.35)',
  branch: '#5D4037', branchLight: '#795548',
  heal: '#00E676', healGlow: 'rgba(0,230,118,0.4)',
  heart: '#FF1744', heartDim: 'rgba(255,23,68,0.32)',
  text: '#f0ecf4', textDim: '#7a8a70',
  windStreak: 'rgba(165,214,167,0.2)',
  cloud: 'rgba(200,230,201,0.04)',
  treeFar: 'rgba(27,94,32,0.18)', treeMid: 'rgba(27,94,32,0.28)', treeNear: 'rgba(27,94,32,0.45)',
  burstRing: 'rgba(165,214,167,0.35)',
  damage: '#FF1744',
};

/* ─── Helpers ─── */
function rng(min, max) { return min + Math.random() * (max - min); }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ─── Game ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── State ── */
  const s = {
    px: W / 2, py: H * 0.65, vx: 0,
    score: 0, altitude: 0, scrollSpeed: SCROLL_BASE,
    hp: 3, maxHp: 3,
    running: true, frame: 0,
    leaves: [], thorns: [], branches: [],
    particles: [], ambientLeaves: [], floatTexts: [],
    healItems: [], clouds: [],
    shake: 0, iframe: 0,
    wind: 0, windTarget: 0, windTimer: 0,
    burstCooldown: 0, burstActive: 0, burstX: 0, burstY: 0,
    lastHealAt: 0, actionHeld: false,
    nextLeaf: 40, nextThorn: 120, nextBranch: 200,
    // Parallax trees
    treeLayers: [],
    windArrows: [],
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  // Ambient leaf particles
  for (let i = 0; i < 35; i++) {
    s.ambientLeaves.push({
      x: rng(0, W), y: rng(0, H),
      size: rng(2, 5), rot: rng(0, Math.PI * 2), rotSpd: rng(-0.04, 0.04),
      vy: rng(0.2, 0.8), vx: rng(-0.3, 0.3),
      opacity: rng(0.08, 0.22),
      hue: Math.random() < 0.5 ? '#81C784' : '#A5D6A7',
    });
  }

  // Clouds
  for (let i = 0; i < 6; i++) {
    s.clouds.push({
      x: rng(0, W), y: rng(0, H),
      w: rng(60, 140), h: rng(20, 40),
      speed: rng(0.1, 0.3), opacity: rng(0.03, 0.06),
    });
  }

  // Parallax tree silhouette layers
  for (let layer = 0; layer < 3; layer++) {
    const trees = [];
    const count = 5 + layer * 2;
    for (let i = 0; i < count; i++) {
      trees.push({
        x: rng(0, W), trunkH: rng(60, 160) * (1 - layer * 0.2),
        crownR: rng(20, 45) * (1 - layer * 0.15),
      });
    }
    s.treeLayers.push({
      trees,
      parallax: 0.05 + layer * 0.08,
      color: layer === 0 ? P.treeFar : layer === 1 ? P.treeMid : P.treeNear,
    });
  }

  // Wind arrow particles (for visual wind effect)
  for (let i = 0; i < 8; i++) {
    s.windArrows.push({ x: rng(0, W), y: rng(0, H), life: rng(0, 1) });
  }

  /* ── Helpers ── */
  function addParticles(x, y, color, count, opts = {}) {
    const { spread = 4, gravity = 0.02, sizeMin = 1.5, sizeMax = 3.5, decayMin = 0.02, decayMax = 0.04 } = opts;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y, vx: rng(-spread, spread), vy: rng(-spread, spread * 0.5),
        life: 1, decay: rng(decayMin, decayMax),
        color, size: rng(sizeMin, sizeMax), gravity,
      });
    }
  }

  function addLeafBurst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = rng(0, Math.PI * 2);
      const spd = rng(1, 3);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 1, decay: rng(0.015, 0.03),
        color: Math.random() < 0.5 ? '#FDD835' : '#AED581',
        size: rng(2, 5), gravity: 0.01,
        isLeaf: true, rot: rng(0, Math.PI * 2),
      });
    }
  }

  function addFloatText(x, y, text, color) {
    s.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function spawnLeaf() {
    const gold = Math.random() < 0.2;
    s.leaves.push({
      x: rng(20, W - 20), y: -20,
      vy: rng(0.5, 1.2), vx: rng(-0.4, 0.4),
      rot: rng(0, Math.PI * 2), rotSpd: rng(-0.05, 0.05),
      pulse: rng(0, Math.PI * 2),
      gold,
      points: gold ? 30 : 10,
    });
    s.nextLeaf = rng(25, 55);
  }

  function spawnThorn() {
    s.thorns.push({
      x: rng(25, W - 25), y: -25,
      vy: rng(0.8, 1.6), vx: rng(-0.3, 0.3),
      rot: rng(0, Math.PI * 2), rotSpd: rng(-0.03, 0.03),
      spikes: Math.floor(rng(5, 8)),
    });
    const minGap = Math.max(50, 110 - Math.min(s.altitude / 400, 50));
    s.nextThorn = minGap + rng(0, 50);
  }

  function spawnBranch() {
    const fromLeft = Math.random() < 0.5;
    const bw = rng(100, 200);
    s.branches.push({
      x: fromLeft ? -bw : W,
      y: -20,
      w: bw, h: BRANCH_H + rng(0, 6),
      vx: fromLeft ? rng(0.5, 1.5) : rng(-1.5, -0.5),
      vy: rng(0.6, 1.2),
    });
    s.nextBranch = rng(140, 260);
  }

  /* ── Update ── */
  function update() {
    if (!s.running) return;
    s.frame++;
    s.scrollSpeed = SCROLL_BASE + Math.min(s.altitude / 800, 2.5);
    s.altitude += s.scrollSpeed * 0.5;
    const newScore = Math.floor(s.altitude);
    if (newScore !== s.score) {
      s.score = newScore;
      onScore(s.score);
    }

    // Wind gusts
    s.windTimer--;
    if (s.windTimer <= 0) {
      s.windTarget = rng(-2.5, 2.5);
      s.windTimer = rng(100, 220);
    }
    s.wind = lerp(s.wind, s.windTarget, 0.03);

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    mx = clamp(mx, -1, 1);

    // Wind burst action
    const wantAction = keys[' '] || keys['Space'] || actionBtnRef.current;
    if (wantAction && !s.actionHeld && s.burstCooldown <= 0) {
      s.burstActive = BURST_DURATION;
      s.burstCooldown = BURST_COOLDOWN;
      s.burstX = s.px;
      s.burstY = s.py;
      s.actionHeld = true;
      addParticles(s.px, s.py, 'rgba(165,214,167,0.6)', 15, { spread: 6, gravity: 0, sizeMin: 2, sizeMax: 5 });
    }
    if (!wantAction) {
      s.actionHeld = false;
      actionBtnRef.current = false;
    }
    if (s.burstCooldown > 0) s.burstCooldown--;
    if (s.burstActive > 0) s.burstActive--;

    // Physics
    const targetVx = mx * PLAYER_SPD + s.wind * 0.6;
    s.vx = lerp(s.vx, targetVx, 0.15);
    s.px += s.vx;
    s.px = clamp(s.px, PR + 4, W - PR - 4);

    if (s.iframe > 0) s.iframe--;

    // Heal power-up every 1000 points
    const healMilestone = Math.floor(s.score / HEAL_THRESHOLD);
    if (healMilestone > s.lastHealAt && s.hp < s.maxHp) {
      s.lastHealAt = healMilestone;
      s.healItems.push({ x: rng(40, W - 40), y: -20, vy: rng(0.6, 1.0), pulse: 0 });
      addFloatText(W / 2, 80, '🍀 CURA IN ARRIVO!', P.heal);
    }

    // Spawn
    s.nextLeaf--;
    if (s.nextLeaf <= 0) spawnLeaf();
    s.nextThorn--;
    if (s.nextThorn <= 0) spawnThorn();
    s.nextBranch--;
    if (s.nextBranch <= 0) spawnBranch();

    // Burst repel radius
    const burstRadius = s.burstActive > 0 ? BURST_RADIUS * (1 - s.burstActive / BURST_DURATION * 0.3) : 0;

    // ── Move leaves ──
    for (let i = s.leaves.length - 1; i >= 0; i--) {
      const l = s.leaves[i];
      l.y += l.vy + s.scrollSpeed * 0.5;
      l.x += l.vx + s.wind * 0.3;
      l.rot += l.rotSpd;
      l.pulse += 0.07;
      if (l.y > H + 30) { s.leaves.splice(i, 1); continue; }

      // Burst pushes leaves too (visual)
      if (s.burstActive > 0) {
        const d = dist(l.x, l.y, s.burstX, s.burstY);
        if (d < burstRadius && d > 0) {
          const force = (1 - d / burstRadius) * 3;
          l.x += (l.x - s.burstX) / d * force;
          l.y += (l.y - s.burstY) / d * force;
        }
      }

      if (dist(s.px, s.py, l.x, l.y) < PR + LEAF_R) {
        addLeafBurst(l.x, l.y, 6);
        addFloatText(l.x, l.y - 12, `+${l.points}`, l.gold ? '#FDD835' : '#AED581');
        s.score += l.points;
        onScore(s.score);
        s.leaves.splice(i, 1);
      }
    }

    // ── Move thorns ──
    for (let i = s.thorns.length - 1; i >= 0; i--) {
      const t = s.thorns[i];
      t.y += t.vy + s.scrollSpeed * 0.4;
      t.x += t.vx + s.wind * 0.2;
      t.rot += t.rotSpd;
      if (t.y > H + 30) { s.thorns.splice(i, 1); continue; }

      // Burst repels thorns
      if (s.burstActive > 0) {
        const d = dist(t.x, t.y, s.burstX, s.burstY);
        if (d < burstRadius && d > 0) {
          const force = (1 - d / burstRadius) * 5;
          t.x += (t.x - s.burstX) / d * force;
          t.y += (t.y - s.burstY) / d * force;
        }
      }

      if (s.iframe === 0 && dist(s.px, s.py, t.x, t.y) < PR + THORN_R * 0.6) {
        s.hp--;
        s.iframe = IFRAME_DUR;
        s.shake = 8;
        onHpChange(s.hp, s.maxHp);
        addParticles(s.px, s.py, P.damage, 10, { spread: 5 });
        addFloatText(s.px, s.py - 15, '-1 ♥', P.damage);
        s.thorns.splice(i, 1);
        if (s.hp <= 0) { s.running = false; }
      }
    }

    // ── Move branches ──
    for (let i = s.branches.length - 1; i >= 0; i--) {
      const b = s.branches[i];
      b.y += b.vy + s.scrollSpeed * 0.35;
      b.x += b.vx;
      if (b.y > H + 30 || b.x > W + 250 || b.x + b.w < -250) { s.branches.splice(i, 1); continue; }

      // Burst repels branches
      if (s.burstActive > 0) {
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
        const d = dist(bcx, bcy, s.burstX, s.burstY);
        if (d < burstRadius && d > 0) {
          const force = (1 - d / burstRadius) * 4;
          b.x += (bcx - s.burstX) / d * force;
          b.y += (bcy - s.burstY) / d * force;
        }
      }

      // Circle vs rect collision
      if (s.iframe === 0) {
        const nearX = clamp(s.px, b.x, b.x + b.w);
        const nearY = clamp(s.py, b.y, b.y + b.h);
        if (dist(s.px, s.py, nearX, nearY) < PR * 0.7) {
          s.hp--;
          s.iframe = IFRAME_DUR;
          s.shake = 8;
          onHpChange(s.hp, s.maxHp);
          addParticles(s.px, s.py, P.damage, 10, { spread: 5 });
          addFloatText(s.px, s.py - 15, '-1 ♥', P.damage);
          if (s.hp <= 0) { s.running = false; }
        }
      }
    }

    // ── Heal items ──
    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.y += h.vy + s.scrollSpeed * 0.3;
      h.pulse += 0.08;
      if (h.y > H + 30) { s.healItems.splice(i, 1); continue; }
      if (dist(s.px, s.py, h.x, h.y) < PR + HEAL_R) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, h.y, P.heal, 12, { spread: 5 });
        addFloatText(h.x, h.y - 15, '♥ MAX!', P.heal);
        s.healItems.splice(i, 1);
      }
    }

    // ── Particles ──
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      if (p.isLeaf) p.rot += 0.05;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // ── Float texts ──
    for (let i = s.floatTexts.length - 1; i >= 0; i--) {
      const ft = s.floatTexts[i];
      ft.y -= 0.8; ft.life -= 0.022;
      if (ft.life <= 0) s.floatTexts.splice(i, 1);
    }

    // ── Ambient leaves ──
    for (const al of s.ambientLeaves) {
      al.y += al.vy + s.scrollSpeed * 0.2;
      al.x += al.vx + s.wind * 0.15;
      al.rot += al.rotSpd;
      if (al.y > H + 10) { al.y = -10; al.x = rng(0, W); }
      if (al.x < -10) al.x = W + 10;
      if (al.x > W + 10) al.x = -10;
    }

    // ── Clouds ──
    for (const c of s.clouds) {
      c.x += c.speed + s.wind * 0.05;
      if (c.x > W + c.w) c.x = -c.w;
      if (c.x + c.w < -10) c.x = W;
    }

    // ── Wind arrows ──
    for (const wa of s.windArrows) {
      wa.life -= 0.008;
      wa.x += s.wind * 1.5;
      wa.y += 0.3;
      if (wa.life <= 0 || wa.y > H + 10 || wa.x < -30 || wa.x > W + 30) {
        wa.x = rng(0, W);
        wa.y = rng(-20, H * 0.3);
        wa.life = 1;
      }
    }

    // Player trail particles
    if (s.frame % 3 === 0) {
      s.particles.push({
        x: s.px + rng(-3, 3), y: s.py + PR,
        vx: rng(-0.3, 0.3), vy: rng(0.5, 1.5),
        life: 1, decay: 0.04, color: P.playerTrail, size: rng(2, 4), gravity: 0,
      });
    }

    if (s.shake > 0) s.shake = Math.max(0, s.shake - 0.5);
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();

    // Screen shake
    if (s.shake > 0) {
      ctx.translate(rng(-s.shake, s.shake), rng(-s.shake, s.shake));
    }

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, P.bg1);
    skyGrad.addColorStop(0.5, P.bg2);
    skyGrad.addColorStop(1, P.bg3);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle radial glow center ──
    const centerGlow = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.6);
    centerGlow.addColorStop(0, 'rgba(76,175,80,0.04)');
    centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Parallax tree silhouettes ──
    const treeOffset = (s.altitude * 0.3) % H;
    for (const layer of s.treeLayers) {
      ctx.fillStyle = layer.color;
      const layerOff = (treeOffset * layer.parallax) % 60;
      for (const tree of layer.trees) {
        const tx = tree.x + s.wind * layer.parallax * 8;
        const ty = H - 30 + layerOff;
        // Trunk
        ctx.fillRect(tx - 3, ty - tree.trunkH, 6, tree.trunkH);
        // Crown (triangle)
        ctx.beginPath();
        ctx.moveTo(tx - tree.crownR, ty - tree.trunkH + 10);
        ctx.lineTo(tx, ty - tree.trunkH - tree.crownR);
        ctx.lineTo(tx + tree.crownR, ty - tree.trunkH + 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Clouds ──
    for (const c of s.clouds) {
      ctx.fillStyle = `rgba(200,230,201,${c.opacity})`;
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.3, c.y, c.w * 0.3, c.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.6, c.y - c.h * 0.1, c.w * 0.25, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.5, c.y + c.h * 0.15, c.w * 0.35, c.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Wind streaks ──
    if (Math.abs(s.wind) > 0.5) {
      const windAlpha = Math.min(Math.abs(s.wind) / 3, 0.25);
      ctx.strokeStyle = `rgba(165,214,167,${windAlpha})`;
      ctx.lineWidth = 1.5;
      for (const wa of s.windArrows) {
        if (wa.life <= 0) continue;
        ctx.globalAlpha = wa.life * 0.5;
        const len = Math.abs(s.wind) * 12;
        ctx.beginPath();
        ctx.moveTo(wa.x, wa.y);
        ctx.lineTo(wa.x + (s.wind > 0 ? len : -len), wa.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ── Ambient leaves ──
    for (const al of s.ambientLeaves) {
      ctx.save();
      ctx.globalAlpha = al.opacity;
      ctx.translate(al.x, al.y);
      ctx.rotate(al.rot);
      ctx.fillStyle = al.hue;
      ctx.beginPath();
      ctx.ellipse(0, 0, al.size, al.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Branches ──
    for (const b of s.branches) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w, b.h);
      // Branch body
      const bGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      bGrad.addColorStop(0, P.branchLight);
      bGrad.addColorStop(1, P.branch);
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      // Bark texture
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let bx = b.x + 8; bx < b.x + b.w - 8; bx += 14) {
        ctx.fillRect(bx, b.y + 2, 6, 2);
      }
      // Knots
      ctx.fillStyle = 'rgba(62,39,25,0.6)';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Thorns ──
    for (const t of s.thorns) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      // Glow
      const tGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, THORN_R + 6);
      tGlow.addColorStop(0, P.thornGlow);
      tGlow.addColorStop(1, 'rgba(211,47,47,0)');
      ctx.fillStyle = tGlow;
      ctx.beginPath();
      ctx.arc(0, 0, THORN_R + 6, 0, Math.PI * 2);
      ctx.fill();
      // Spiky shape
      ctx.fillStyle = P.thorn;
      ctx.beginPath();
      for (let sp = 0; sp < t.spikes; sp++) {
        const a = (sp / t.spikes) * Math.PI * 2;
        const aNext = ((sp + 0.5) / t.spikes) * Math.PI * 2;
        const outerR = THORN_R;
        const innerR = THORN_R * 0.5;
        if (sp === 0) ctx.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        else ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        ctx.lineTo(Math.cos(aNext) * innerR, Math.sin(aNext) * innerR);
      }
      ctx.closePath();
      ctx.fill();
      // Center
      ctx.fillStyle = '#B71C1C';
      ctx.beginPath();
      ctx.arc(0, 0, THORN_R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Collectible leaves ──
    for (const l of s.leaves) {
      const bob = Math.sin(l.pulse) * 3;
      const glowR = LEAF_R + 6 + Math.sin(l.pulse) * 2;
      const baseCol = l.gold ? P.leaf : P.leafAlt;
      const baseGlow = l.gold ? P.leafGlow : P.leafAltGlow;
      // Glow
      const lGlow = ctx.createRadialGradient(l.x, l.y + bob, 0, l.x, l.y + bob, glowR);
      lGlow.addColorStop(0, baseGlow);
      lGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lGlow;
      ctx.beginPath();
      ctx.arc(l.x, l.y + bob, glowR, 0, Math.PI * 2);
      ctx.fill();
      // Leaf shape
      ctx.save();
      ctx.translate(l.x, l.y + bob);
      ctx.rotate(l.rot);
      ctx.fillStyle = baseCol;
      ctx.beginPath();
      // Draw a leaf shape: two bezier curves
      ctx.moveTo(0, -LEAF_R);
      ctx.bezierCurveTo(LEAF_R * 0.8, -LEAF_R * 0.5, LEAF_R * 0.8, LEAF_R * 0.5, 0, LEAF_R);
      ctx.bezierCurveTo(-LEAF_R * 0.8, LEAF_R * 0.5, -LEAF_R * 0.8, -LEAF_R * 0.5, 0, -LEAF_R);
      ctx.fill();
      // Leaf vein
      ctx.strokeStyle = l.gold ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -LEAF_R * 0.7);
      ctx.lineTo(0, LEAF_R * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    // ── Heal items ──
    for (const h of s.healItems) {
      const glow = 0.7 + Math.sin(h.pulse) * 0.3;
      const bobY = Math.sin(h.pulse) * 3;
      const hGrad = ctx.createRadialGradient(h.x, h.y + bobY, 0, h.x, h.y + bobY, 20 * glow);
      hGrad.addColorStop(0, P.healGlow);
      hGrad.addColorStop(1, 'rgba(0,230,118,0)');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.arc(h.x, h.y + bobY, 20 * glow, 0, Math.PI * 2);
      ctx.fill();
      // Cross
      ctx.fillStyle = P.heal;
      ctx.fillRect(h.x - 2.5, h.y + bobY - 8, 5, 16);
      ctx.fillRect(h.x - 8, h.y + bobY - 2.5, 16, 5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(h.x - 1, h.y + bobY - 6, 2, 12);
      ctx.fillRect(h.x - 6, h.y + bobY - 1, 12, 2);
    }

    // ── Wind burst ring ──
    if (s.burstActive > 0) {
      const progress = 1 - s.burstActive / BURST_DURATION;
      const ringR = BURST_RADIUS * progress;
      const ringAlpha = (1 - progress) * 0.6;
      ctx.strokeStyle = `rgba(165,214,167,${ringAlpha})`;
      ctx.lineWidth = 3 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.arc(s.burstX, s.burstY, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // Inner glow
      const bGrad = ctx.createRadialGradient(s.burstX, s.burstY, 0, s.burstX, s.burstY, ringR);
      bGrad.addColorStop(0, `rgba(165,214,167,${ringAlpha * 0.15})`);
      bGrad.addColorStop(1, 'rgba(165,214,167,0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(s.burstX, s.burstY, ringR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Player ──
    ctx.save();
    if (s.iframe > 0 && s.frame % 4 < 2) ctx.globalAlpha = 0.3;

    // Player glow
    const pGrad = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, PR + 14);
    pGrad.addColorStop(0, P.playerGlow);
    pGrad.addColorStop(1, 'rgba(102,187,106,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PR + 14, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = P.player;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PR, 0, Math.PI * 2);
    ctx.fill();

    // Inner
    ctx.fillStyle = P.playerInner;
    ctx.beginPath();
    ctx.arc(s.px, s.py, PR * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOff = clamp(s.vx * 0.5, -2.5, 2.5);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.px + eyeOff - 4, s.py - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.px + eyeOff + 4, s.py - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = P.bg1;
    ctx.beginPath();
    ctx.arc(s.px + eyeOff - 3.2, s.py - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.px + eyeOff + 4.8, s.py - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Scarf / wind tail
    const scarfWave = Math.sin(s.frame * 0.12) * 3;
    const scarfDir = s.vx > 0.3 ? -1 : s.vx < -0.3 ? 1 : 0;
    ctx.fillStyle = '#A5D6A7';
    ctx.beginPath();
    ctx.moveTo(s.px - 5, s.py + PR - 1);
    ctx.quadraticCurveTo(
      s.px - 10 + scarfDir * 6, s.py + PR + 6 + scarfWave,
      s.px - 16 + scarfDir * 10, s.py + PR + 10 + scarfWave * 1.5
    );
    ctx.lineTo(s.px - 8 + scarfDir * 6, s.py + PR + 5 + scarfWave * 0.8);
    ctx.closePath();
    ctx.fill();
    // Second scarf tail
    ctx.globalAlpha = ctx.globalAlpha * 0.7;
    ctx.beginPath();
    ctx.moveTo(s.px + 2, s.py + PR - 1);
    ctx.quadraticCurveTo(
      s.px - 5 + scarfDir * 4, s.py + PR + 8 + scarfWave * 0.8,
      s.px - 12 + scarfDir * 8, s.py + PR + 14 + scarfWave * 1.2
    );
    ctx.lineTo(s.px - 4 + scarfDir * 5, s.py + PR + 7 + scarfWave * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Particles ──
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (p.isLeaf) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── Float texts ──
    for (const ft of s.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.font = `bold ${12 + (1 - ft.life) * 3}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // ── HUD ──
    // Hearts
    const heartPulse = s.hp === 1 ? 15 + Math.sin(s.frame * 0.2) * 2 : 14;
    for (let i = 0; i < s.maxHp; i++) {
      ctx.fillStyle = i < s.hp ? P.heart : P.heartDim;
      ctx.font = `${i < s.hp ? heartPulse : 14}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('♥', 14 + i * 22, 22);
    }

    // Score
    ctx.fillStyle = P.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${s.score}`, W - 14, 18);

    // Altitude
    ctx.fillStyle = P.textDim;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${Math.floor(s.altitude)}m`, W - 14, 34);

    // Wind indicator
    if (Math.abs(s.wind) > 0.5) {
      const windStr = Math.min(Math.abs(s.wind) / 2.5, 1);
      ctx.fillStyle = `rgba(165,214,167,${0.4 + windStr * 0.3})`;
      ctx.font = '11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const arrow = s.wind > 0 ? '→' : '←';
      const bars = windStr > 0.6 ? '💨💨' : '💨';
      ctx.fillText(`${s.wind < 0 ? bars + ' ' : ''}${arrow}${s.wind > 0 ? ' ' + bars : ''}`, W / 2, 18);
    }

    // Burst cooldown indicator
    if (s.burstCooldown > 0) {
      const cdPct = s.burstCooldown / BURST_COOLDOWN;
      ctx.fillStyle = 'rgba(165,214,167,0.15)';
      ctx.fillRect(14, 34, 50, 5);
      ctx.fillStyle = `rgba(165,214,167,${0.3 + (1 - cdPct) * 0.4})`;
      ctx.fillRect(14, 34, 50 * (1 - cdPct), 5);
      ctx.fillStyle = P.textDim;
      ctx.font = '9px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🌬️', 14, 50);
    } else {
      ctx.fillStyle = 'rgba(165,214,167,0.6)';
      ctx.font = '9px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🌬️ PRONTO', 14, 50);
    }

    // Speed indicator
    ctx.fillStyle = 'rgba(129,199,132,0.35)';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`⚡ ${s.scrollSpeed.toFixed(1)}`, W - 14, 48);
    ctx.textAlign = 'left';

    // ── Vignette ──
    const vGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.72);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);

    // Damage red flash
    if (s.iframe > IFRAME_DUR * 0.7) {
      const flashAlpha = (s.iframe - IFRAME_DUR * 0.7) / (IFRAME_DUR * 0.3) * 0.15;
      ctx.fillStyle = `rgba(255,23,68,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  /* ── Game loop ── */
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
