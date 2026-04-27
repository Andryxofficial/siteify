/**
 * SETTEMBRE — Leaf Catcher 🍂
 * High-quality autumn-themed catching game.
 *
 * Parallax forest backdrop, 5 distinct leaf types drawn with unique canvas
 * shapes (oak, maple, golden, acorn bonus, rotten), wind-drift physics,
 * combo scoring, wind-gust action button, heal power-ups every 1000 pts,
 * 5 HP heart system, vignette overlay, animated HUD.
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Leaf Catcher',
  emoji: '🍂',
  description: 'Raccogli le foglie d\'autunno prima che tocchino terra!',
  color: '#FF6F00',
  controls: 'joystick',
  instructions:
    'Muovi il cesto con WASD / frecce / joystick. Raccogli foglie 🍁 per punti (quercia 10, acero 25, oro 50). Ghiande 🌰 = bonus! Evita le foglie marce ☠. Premi Spazio o 🍁 per una raffica di vento che attira le foglie verso di te! Cura ✚ ogni 1000 punti.',
  gameOverTitle: 'L\'autunno è finito!',
  actionLabel: '🍁',
};

/* ─── Constants ─── */
const W = 480;
const H = 480;
const TWO_PI = Math.PI * 2;
const BASKET_W = 56;
const BASKET_H = 30;
const BASKET_Y = H - 52;
const PLAYER_SPD = 5;
const GUST_COOLDOWN = 180; // 3 s at 60 fps
const GUST_DURATION = 24;
const GUST_STRENGTH = 3.5;

/* Leaf kinds */
const LEAF_OAK    = { id: 'oak',    pts: 10, color: '#E65100', glow: '#FF8F00' };
const LEAF_MAPLE  = { id: 'maple',  pts: 25, color: '#D32F2F', glow: '#FF5252' };
const LEAF_GOLDEN = { id: 'golden', pts: 50, color: '#FFD600', glow: '#FFFF8D' };
const LEAF_ACORN  = { id: 'acorn',  pts: 35, color: '#6D4C41', glow: '#A1887F' };
const LEAF_ROTTEN = { id: 'rotten', pts: 0,  color: '#37474F', glow: '#546E7A' };

const GOOD_LEAVES = [LEAF_OAK, LEAF_OAK, LEAF_OAK, LEAF_MAPLE, LEAF_MAPLE, LEAF_GOLDEN, LEAF_ACORN];

/* Palette */
const C = {
  bg: '#12100a',
  skyTop: '#1a120a', skyBot: '#2a1a0c',
  treeTrunk: '#3e2510', treeTrunkHi: '#5c3a1a',
  canopy1: '#4e3118', canopy2: '#6b3e1e', canopy3: '#8a5228',
  ground: '#1e1608', groundHi: '#2c2010',
  basket: '#8D6E63', basketDark: '#5D4037', basketRim: '#4E342E',
  basketWeave: '#A1887F',
  heart: '#EF5350', heartEmpty: 'rgba(239,83,80,0.18)',
  heal: '#66BB6A', healGlow: 'rgba(102,187,106,0.5)',
  text: '#ECEFF1', muted: '#90A4AE',
  golden: '#FFD54F', combo: '#FFAB40',
  vignette: '#12100a',
};

/* ─── Helpers ─── */
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }

/* ─── Game factory ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── Offscreen caches ── */
  const bgCache = document.createElement('canvas');
  bgCache.width = W; bgCache.height = H;
  const vigCache = document.createElement('canvas');
  vigCache.width = W; vigCache.height = H;

  /* ── State ── */
  const s = {
    running: true, frame: 0,
    basketX: W / 2 - BASKET_W / 2,
    score: 0, hp: 5, maxHp: 5,
    combo: 0, bestCombo: 0,
    leaves: [], particles: [], floats: [],
    bgLeaves: [], healItems: [],
    spawnTimer: 0, spawnInterval: 50,
    speed: 1.4,
    screenShake: 0,
    lastHealMilestone: 0,
    gustCd: 0, gustTimer: 0, gustActive: false,
    wind: 0, windTarget: 0, windTimer: 0,
    trees: [], // parallax trees
  };

  onHpChange(s.hp, s.maxHp);
  onScore(0);

  /* ── Generate parallax trees ── */
  function genTrees() {
    // 3 layers: far, mid, near
    const layers = [
      { count: 5, yBase: 180, hMin: 160, hMax: 220, wMin: 40, wMax: 60, alpha: 0.25, parallax: 0.15, canopy: C.canopy1 },
      { count: 4, yBase: 220, hMin: 180, hMax: 260, wMin: 50, wMax: 75, alpha: 0.4, parallax: 0.3, canopy: C.canopy2 },
      { count: 3, yBase: 270, hMin: 140, hMax: 200, wMin: 55, wMax: 80, alpha: 0.55, parallax: 0.5, canopy: C.canopy3 },
    ];
    for (const lay of layers) {
      for (let i = 0; i < lay.count; i++) {
        const tw = rand(lay.wMin, lay.wMax);
        s.trees.push({
          x: rand(-20, W + 20),
          trunkW: rand(8, 14),
          trunkH: rand(lay.hMin, lay.hMax),
          canopyW: tw,
          canopyH: rand(tw * 0.7, tw * 1.1),
          yBase: lay.yBase + rand(-15, 15),
          alpha: lay.alpha,
          parallax: lay.parallax,
          canopyColor: lay.canopy,
        });
      }
    }
  }
  genTrees();

  /* ── Background decorative leaves ── */
  for (let i = 0; i < 18; i++) {
    s.bgLeaves.push({
      x: rand(0, W), y: rand(0, H),
      size: rand(4, 10),
      rot: rand(0, TWO_PI),
      rotSpd: rand(-0.015, 0.015),
      drift: rand(-0.3, 0.3),
      speed: rand(0.2, 0.5),
      alpha: rand(0.04, 0.1),
      color: GOOD_LEAVES[randInt(0, GOOD_LEAVES.length - 1)].color,
    });
  }

  /* ── Pre-render static background ── */
  function renderBgCache() {
    const bctx = bgCache.getContext('2d');
    // Sky gradient
    const grad = bctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.skyTop);
    grad.addColorStop(0.55, C.skyBot);
    grad.addColorStop(1, C.ground);
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, W, H);

    // Warm ambient glow at top center
    const glow = bctx.createRadialGradient(W / 2, 30, 10, W / 2, 30, 260);
    glow.addColorStop(0, 'rgba(255,140,40,0.06)');
    glow.addColorStop(1, 'rgba(255,140,40,0)');
    bctx.fillStyle = glow;
    bctx.fillRect(0, 0, W, H);

    // Ground
    bctx.fillStyle = C.ground;
    bctx.fillRect(0, H - 36, W, 36);
    const grdGrad = bctx.createLinearGradient(0, H - 36, 0, H);
    grdGrad.addColorStop(0, C.groundHi);
    grdGrad.addColorStop(1, C.ground);
    bctx.fillStyle = grdGrad;
    bctx.fillRect(0, H - 36, W, 36);

    // Ground texture dots
    bctx.fillStyle = 'rgba(60,40,20,0.3)';
    for (let i = 0; i < 50; i++) {
      bctx.beginPath();
      bctx.arc(rand(0, W), rand(H - 34, H - 2), rand(1, 3), 0, TWO_PI);
      bctx.fill();
    }
  }
  renderBgCache();

  /* ── Vignette cache ── */
  function renderVignetteCache() {
    const vctx = vigCache.getContext('2d');
    const vig = vctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'rgba(18,16,10,0)');
    vig.addColorStop(1, 'rgba(18,16,10,0.55)');
    vctx.fillStyle = vig;
    vctx.fillRect(0, 0, W, H);
  }
  renderVignetteCache();

  /* ── Drawing primitives ── */

  function drawTree(tree) {
    ctx.save();
    ctx.globalAlpha = tree.alpha;
    const tx = tree.x;
    const by = tree.yBase;
    // Trunk
    const tw2 = tree.trunkW / 2;
    ctx.fillStyle = C.treeTrunk;
    ctx.beginPath();
    ctx.moveTo(tx - tw2 - 2, by);
    ctx.lineTo(tx - tw2 + 1, by - tree.trunkH);
    ctx.lineTo(tx + tw2 - 1, by - tree.trunkH);
    ctx.lineTo(tx + tw2 + 2, by);
    ctx.closePath();
    ctx.fill();
    // Trunk highlight
    ctx.fillStyle = C.treeTrunkHi;
    ctx.fillRect(tx - tw2 + 2, by - tree.trunkH, 3, tree.trunkH);

    // Canopy (layered circles for organic look)
    const cy = by - tree.trunkH;
    const cw = tree.canopyW;
    const ch = tree.canopyH;
    ctx.fillStyle = tree.canopyColor;
    for (let j = 0; j < 5; j++) {
      const ox = (j - 2) * cw * 0.22;
      const oy = -ch * 0.3 + Math.abs(j - 2) * ch * 0.08;
      const r = cw * 0.32 + (j % 2) * cw * 0.05;
      ctx.beginPath();
      ctx.arc(tx + ox, cy + oy, r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOakLeaf(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    // Oak leaf: lobed shape
    const lobes = 5;
    for (let i = 0; i <= lobes * 2; i++) {
      const a = (i / (lobes * 2)) * Math.PI * 2 - Math.PI / 2;
      const isLobe = i % 2 === 0;
      const dist = isLobe ? r : r * 0.55;
      ctx.lineTo(Math.cos(a) * dist * 0.8, Math.sin(a) * dist);
    }
    ctx.closePath();
    ctx.fill();
    // Stem
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(0, r * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  function drawMapleLeaf(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    // 5-pointed maple
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * TWO_PI - Math.PI / 2;
      const dist = i % 2 === 0 ? r : r * 0.4;
      ctx.lineTo(Math.cos(a) * dist, Math.sin(a) * dist);
    }
    ctx.closePath();
    ctx.fill();
    // Veins
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < points; i++) {
      const a = (i * 2 / (points * 2)) * TWO_PI - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGoldenLeaf(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Elliptical golden leaf with shimmer
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r, 0, 0, TWO_PI);
    ctx.fill();
    // Highlight shimmer
    ctx.fillStyle = 'rgba(255,255,200,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 0.2, r * 0.2, r * 0.5, -0.3, 0, TWO_PI);
    ctx.fill();
    // Stem
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    ctx.restore();
  }

  function drawAcorn(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.3); // acorns rotate slowly
    // Cap
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.6, Math.PI, 0);
    ctx.fill();
    // Cap texture
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.6, Math.PI, 0);
    ctx.fill();
    // Cross-hatch on cap
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.15, -r * 0.6);
      ctx.lineTo(i * r * 0.15, -r * 0.2);
      ctx.stroke();
    }
    // Body (nut)
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.45, r * 0.55, 0, 0, TWO_PI);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, r * 0.1, r * 0.12, r * 0.3, -0.2, 0, TWO_PI);
    ctx.fill();
    // Stem nub
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.arc(0, -r * 0.7, r * 0.1, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  function drawRottenLeaf(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Wilted jagged shape
    ctx.beginPath();
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TWO_PI - Math.PI / 2;
      const jitter = 0.7 + Math.sin(i * 2.7) * 0.3;
      ctx.lineTo(Math.cos(a) * r * jitter, Math.sin(a) * r * jitter);
    }
    ctx.closePath();
    ctx.fill();
    // Spots
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.cos(i * 2.1) * r * 0.35,
        Math.sin(i * 2.1) * r * 0.35,
        r * 0.12, 0, TWO_PI
      );
      ctx.fill();
    }
    // Skull warning
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', 0, 0);
    ctx.restore();
  }

  function drawLeaf(leaf) {
    const { x, y, kind, rot, r, pulse } = leaf;
    const glow = kind === LEAF_ROTTEN ? 0 : 0.4 + Math.sin(pulse) * 0.25;

    ctx.save();
    if (kind !== LEAF_ROTTEN) {
      ctx.shadowColor = kind.glow;
      ctx.shadowBlur = 8 * glow;
    }
    ctx.fillStyle = kind.color;

    switch (kind.id) {
      case 'oak':    drawOakLeaf(x, y, r, rot); break;
      case 'maple':  drawMapleLeaf(x, y, r, rot); break;
      case 'golden': drawGoldenLeaf(x, y, r, rot); break;
      case 'acorn':  drawAcorn(x, y, r, rot); break;
      case 'rotten': drawRottenLeaf(x, y, r, rot); break;
    }
    ctx.restore();
  }

  function drawBasket(bx, by) {
    ctx.save();
    // Shadow under basket
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(bx + BASKET_W / 2, by + BASKET_H + 4, BASKET_W * 0.52, 4, 0, 0, TWO_PI);
    ctx.fill();

    // Body trapezoid
    ctx.fillStyle = C.basket;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by);
    ctx.lineTo(bx + 5, by + BASKET_H);
    ctx.lineTo(bx + BASKET_W - 5, by + BASKET_H);
    ctx.lineTo(bx + BASKET_W + 5, by);
    ctx.closePath();
    ctx.fill();

    // Weave horizontal
    ctx.strokeStyle = 'rgba(78,52,46,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ly = by + 4 + i * (BASKET_H / 5);
      const inset = (i + 1) * 1;
      ctx.beginPath();
      ctx.moveTo(bx - 5 + inset, ly);
      ctx.lineTo(bx + BASKET_W + 5 - inset, ly);
      ctx.stroke();
    }
    // Weave vertical
    for (let i = 1; i < 6; i++) {
      const lx = bx + (BASKET_W / 6) * i;
      ctx.beginPath();
      ctx.moveTo(lx + 3, by + 1);
      ctx.lineTo(lx - 2, by + BASKET_H - 1);
      ctx.stroke();
    }

    // Rim highlight
    ctx.fillStyle = C.basketRim;
    const rimH = 5;
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - 1);
    ctx.lineTo(bx - 5, by + rimH);
    ctx.lineTo(bx + BASKET_W + 5, by + rimH);
    ctx.lineTo(bx + BASKET_W + 7, by - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.basketWeave;
    ctx.fillRect(bx - 6, by - 1, BASKET_W + 12, 2);

    // Handle
    ctx.strokeStyle = C.basketDark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx + BASKET_W / 2, by - 2, BASKET_W * 0.38, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = C.basketWeave;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + BASKET_W / 2, by - 2, BASKET_W * 0.38, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawHeart(x, y, size, filled) {
    ctx.save();
    ctx.translate(x, y);
    const s2 = size / 2;
    ctx.beginPath();
    ctx.moveTo(0, s2 * 0.3);
    ctx.bezierCurveTo(-s2, -s2 * 0.5, -s2, -s2 * 1.2, 0, -s2 * 0.5);
    ctx.bezierCurveTo(s2, -s2 * 1.2, s2, -s2 * 0.5, 0, s2 * 0.3);
    ctx.closePath();
    ctx.fillStyle = filled ? C.heart : C.heartEmpty;
    ctx.fill();
    if (filled) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(-s2 * 0.25, -s2 * 0.35, s2 * 0.15, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHealCross(x, y, size, pulse) {
    const glow = 0.6 + Math.sin(pulse) * 0.35;
    ctx.save();
    ctx.translate(x, y + Math.sin(pulse * 1.3) * 3);
    ctx.shadowColor = C.healGlow;
    ctx.shadowBlur = 14 * glow;
    ctx.fillStyle = C.heal;
    const arm = size * 0.35;
    const thick = size * 0.22;
    ctx.fillRect(-thick, -arm, thick * 2, arm * 2);
    ctx.fillRect(-arm, -thick, arm * 2, thick * 2);
    // white center
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-thick * 0.5, -thick * 0.5, thick, thick);
    ctx.restore();
  }

  /* ── Spawning ── */

  function pickLeafKind() {
    const r = Math.random();
    const rottenChance = 0.15 + Math.min(s.score / 2000, 0.2);
    if (r < rottenChance) return LEAF_ROTTEN;
    return GOOD_LEAVES[randInt(0, GOOD_LEAVES.length - 1)];
  }

  function spawnLeaf() {
    const kind = pickLeafKind();
    const isGolden = kind === LEAF_GOLDEN;
    const isAcorn = kind === LEAF_ACORN;
    const baseR = kind === LEAF_ACORN ? 9 : 11;
    s.leaves.push({
      x: rand(20, W - 20),
      y: -15,
      kind,
      r: baseR + rand(-1, 2) + (isGolden ? 2 : 0),
      rot: rand(0, TWO_PI),
      rotSpd: rand(-0.04, 0.04) * (isAcorn ? 0.3 : 1),
      drift: rand(-0.6, 0.6),
      speed: s.speed + rand(0, 0.6) - (isGolden ? 0.3 : 0) + (isAcorn ? 0.2 : 0),
      pulse: rand(0, TWO_PI),
      swayAmp: rand(0.3, 0.8),
      swayFreq: rand(0.02, 0.04),
    });
  }

  function spawnHeal() {
    s.healItems.push({
      x: rand(30, W - 30),
      y: -20,
      pulse: rand(0, TWO_PI),
      size: 14,
    });
  }

  /* ── Particles & floats ── */

  function addParticles(x, y, color, count, spread) {
    const sp = spread || 4;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: rand(-sp, sp),
        vy: rand(-sp * 0.8, -0.5),
        life: 1, decay: rand(0.02, 0.04),
        color,
        size: rand(1.5, 4),
        type: 'circle',
      });
    }
  }

  function addLeafParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: rand(-3, 3),
        vy: rand(-2.5, 0.5),
        life: 1, decay: rand(0.015, 0.03),
        color,
        size: rand(3, 6),
        rot: rand(0, TWO_PI),
        rotSpd: rand(-0.1, 0.1),
        type: 'leaf',
      });
    }
  }

  function addFloat(x, y, text, color, big) {
    s.floats.push({
      x, y, text, color,
      life: 1,
      scale: big ? 1.3 : 1,
      vy: big ? -1.2 : -0.9,
    });
  }

  /* ── Wind gust ── */

  function triggerGust() {
    if (s.gustCd > 0 || !s.running) return;
    s.gustCd = GUST_COOLDOWN;
    s.gustTimer = GUST_DURATION;
    s.gustActive = true;
    // Visual feedback particles
    const bx = s.basketX + BASKET_W / 2;
    for (let i = 0; i < 12; i++) {
      s.particles.push({
        x: bx + rand(-30, 30), y: BASKET_Y - rand(5, 30),
        vx: rand(-1, 1), vy: rand(-4, -1),
        life: 1, decay: rand(0.03, 0.05),
        color: 'rgba(255,200,100,0.6)',
        size: rand(2, 5),
        type: 'circle',
      });
    }
  }

  /* ── Update ── */

  function update() {
    if (!s.running) return;
    s.frame++;

    // Difficulty ramp
    s.speed = 1.4 + Math.min(s.score / 300, 2.8);
    s.spawnInterval = Math.max(14, 48 - Math.min(s.score / 60, 30));

    // Wind drift changes
    s.windTimer--;
    if (s.windTimer <= 0) {
      s.windTarget = rand(-0.6, 0.6);
      s.windTimer = randInt(120, 360);
    }
    s.wind = lerp(s.wind, s.windTarget, 0.01);

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy && joy.active) mx += joy.dx;
    mx = clamp(mx, -1, 1);

    s.basketX += mx * PLAYER_SPD;
    s.basketX = clamp(s.basketX, 0, W - BASKET_W);

    // Action button: wind gust
    const act = actionBtnRef ? actionBtnRef.current : 0;
    if (act || keys[' '] || keys['Space']) triggerGust();

    if (s.gustCd > 0) s.gustCd--;
    if (s.gustTimer > 0) {
      s.gustTimer--;
      if (s.gustTimer <= 0) s.gustActive = false;
    }

    // Spawn leaves
    s.spawnTimer--;
    if (s.spawnTimer <= 0) {
      spawnLeaf();
      s.spawnTimer = s.spawnInterval + randInt(-5, 5);
    }

    // Heal every 1000 pts
    const healMs = Math.floor(s.score / 1000);
    if (healMs > s.lastHealMilestone) {
      s.lastHealMilestone = healMs;
      spawnHeal();
    }

    // Update leaves
    const catchLeft = s.basketX - 6;
    const catchRight = s.basketX + BASKET_W + 6;
    const catchTop = BASKET_Y - 2;
    const catchBot = BASKET_Y + BASKET_H;
    const bcx = s.basketX + BASKET_W / 2;

    for (let i = s.leaves.length - 1; i >= 0; i--) {
      const l = s.leaves[i];
      l.y += l.speed;
      l.x += l.drift + s.wind + Math.sin(s.frame * l.swayFreq + l.pulse) * l.swayAmp;
      l.rot += l.rotSpd;
      l.pulse += 0.05;

      // Gust: attract toward basket
      if (s.gustActive) {
        const dx = bcx - l.x;
        const dist = Math.abs(dx);
        if (dist > 1) {
          l.x += (dx / dist) * GUST_STRENGTH;
        }
        l.y -= 0.5; // slight upward push
      }

      // Bounds
      l.x = clamp(l.x, l.r, W - l.r);

      // Catch collision
      if (l.y + l.r >= catchTop && l.y - l.r <= catchBot &&
          l.x >= catchLeft && l.x <= catchRight) {
        if (l.kind === LEAF_ROTTEN) {
          // Caught rotten leaf: lose HP
          s.hp--;
          s.combo = 0;
          s.screenShake = 8;
          onHpChange(s.hp, s.maxHp);
          addParticles(l.x, catchTop, C.heart, 8, 5);
          addFloat(l.x, catchTop - 12, '−1 ♥', C.heart, true);
          if (s.hp <= 0) { s.running = false; }
        } else {
          s.combo++;
          if (s.combo > s.bestCombo) s.bestCombo = s.combo;
          const multiplier = Math.min(s.combo, 5);
          const pts = l.kind.pts * multiplier;
          s.score += pts;
          onScore(s.score);
          addLeafParticles(l.x, catchTop, l.kind.color, 6);
          const label = l.kind === LEAF_ACORN ? `🌰+${pts}` : `+${pts}`;
          addFloat(l.x, catchTop - 12, label, l.kind.glow, l.kind === LEAF_GOLDEN);
          if (multiplier >= 3) {
            addFloat(l.x, catchTop - 28, `×${multiplier}`, C.combo, false);
          }
        }
        s.leaves.splice(i, 1);
        continue;
      }

      // Ground miss
      if (l.y > H + 15) {
        if (l.kind !== LEAF_ROTTEN) {
          s.hp--;
          s.combo = 0;
          onHpChange(s.hp, s.maxHp);
          addFloat(l.x, H - 40, 'Miss!', C.heart, false);
          addParticles(l.x, H - 36, 'rgba(200,120,60,0.5)', 4, 2);
          if (s.hp <= 0) { s.running = false; }
        }
        s.leaves.splice(i, 1);
      }
    }

    // Update heal items
    for (let i = s.healItems.length - 1; i >= 0; i--) {
      const h = s.healItems[i];
      h.y += s.speed * 0.6;
      h.pulse += 0.07;
      h.x += Math.sin(s.frame * 0.025 + h.pulse) * 0.5;
      if (h.y > H + 20) { s.healItems.splice(i, 1); continue; }
      if (h.y + h.size >= catchTop && h.y - h.size <= catchBot &&
          h.x >= catchLeft && h.x <= catchRight) {
        s.hp = s.maxHp;
        onHpChange(s.hp, s.maxHp);
        addParticles(h.x, catchTop, C.heal, 12, 6);
        addFloat(h.x, catchTop - 15, '♥ FULL HP!', C.heal, true);
        s.healItems.splice(i, 1);
      }
    }

    // Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05;
      p.vx *= 0.98;
      p.life -= p.decay;
      if (p.rot !== undefined) p.rot += p.rotSpd;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Float texts
    for (let i = s.floats.length - 1; i >= 0; i--) {
      const f = s.floats[i];
      f.y += f.vy;
      f.life -= 0.022;
      if (f.life <= 0) s.floats.splice(i, 1);
    }

    // Bg leaves
    for (const l of s.bgLeaves) {
      l.y += l.speed;
      l.x += l.drift + s.wind * 0.3;
      l.rot += l.rotSpd;
      if (l.y > H + 15) { l.y = -15; l.x = rand(0, W); }
    }

    if (s.screenShake > 0) s.screenShake -= 0.6;
    if (s.screenShake < 0) s.screenShake = 0;
  }

  /* ── Draw ── */

  function draw() {
    ctx.save();
    // Screen shake
    if (s.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * s.screenShake * 2.5,
        (Math.random() - 0.5) * s.screenShake * 2.5,
      );
    }

    // Static background
    ctx.drawImage(bgCache, 0, 0);

    // Parallax trees
    for (const tree of s.trees) {
      drawTree(tree);
    }

    // Background decorative leaves
    for (const l of s.bgLeaves) {
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = l.color;
      drawOakLeaf(l.x, l.y, l.size, l.rot);
      ctx.globalAlpha = 1;
    }

    // Warm ambient glow that follows basket
    const ambGlow = ctx.createRadialGradient(
      s.basketX + BASKET_W / 2, BASKET_Y, 5,
      s.basketX + BASKET_W / 2, BASKET_Y - 20, 100,
    );
    ambGlow.addColorStop(0, 'rgba(255,160,60,0.04)');
    ambGlow.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, W, H);

    // Gust visual: swirl lines when active
    if (s.gustActive) {
      const gcx = s.basketX + BASKET_W / 2;
      ctx.strokeStyle = 'rgba(255,200,100,0.15)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + s.frame * 0.15;
        const r1 = 20 + i * 8;
        ctx.beginPath();
        ctx.arc(gcx, BASKET_Y - 10, r1, a, a + 0.8);
        ctx.stroke();
      }
    }

    // Heal items
    for (const h of s.healItems) {
      drawHealCross(h.x, h.y, h.size, h.pulse);
    }

    // Falling leaves
    for (const l of s.leaves) {
      drawLeaf(l);
    }

    // Basket
    drawBasket(s.basketX, BASKET_Y);

    // Particles
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (p.type === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        // Tiny leaf particle
        ctx.ellipse(0, 0, p.size * 0.4, p.size * p.life, 0, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Float texts
    for (const f of s.floats) {
      const alpha = f.life > 0.7 ? 1 : f.life / 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.round(13 * f.scale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Slight scale-up on spawn
      const scaleAnim = f.life > 0.85 ? 1 + (1 - (1 - f.life) / 0.15) * 0.3 : 1;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(scaleAnim, scaleAnim);
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Vignette overlay
    ctx.drawImage(vigCache, 0, 0);

    // ── HUD ──
    ctx.save();

    // Hearts (top left)
    for (let i = 0; i < s.maxHp; i++) {
      drawHeart(16 + i * 20, 18, 14, i < s.hp);
    }

    // Score (top right)
    ctx.fillStyle = C.text;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`✦ ${s.score}`, W - 14, 8);

    // Combo (below score)
    if (s.combo > 1) {
      const comboAlpha = Math.min(s.combo / 5, 1);
      ctx.fillStyle = C.combo;
      ctx.globalAlpha = 0.5 + comboAlpha * 0.5;
      ctx.font = `bold ${11 + Math.min(s.combo, 5)}px Outfit, sans-serif`;
      ctx.fillText(`Combo ×${s.combo}`, W - 14, 26);
      ctx.globalAlpha = 1;
    }

    // Gust cooldown indicator (bottom-right area, small)
    const gustReady = s.gustCd <= 0;
    const gustFrac = gustReady ? 1 : 1 - s.gustCd / GUST_COOLDOWN;
    ctx.globalAlpha = gustReady ? 0.85 : 0.4;
    ctx.fillStyle = gustReady ? '#FFB74D' : C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(gustReady ? '🍁 Raffica!' : `🍁 ${Math.ceil(s.gustCd / 60)}s`, W - 14, H - 10);
    // Tiny cooldown arc
    if (!gustReady) {
      ctx.strokeStyle = '#FFB74D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W - 64, H - 17, 6, -Math.PI / 2, -Math.PI / 2 + gustFrac * TWO_PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // HUD restore
    ctx.restore(); // shake restore
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
