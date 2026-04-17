/**
 * LUGLIO — Wave Rider 🏄
 * Premium horizontal surfing game. Ride ocean waves, collect starfish, avoid
 * rocks & jellyfish. Action button = duck for brief invulnerability.
 *
 * Features:
 * - Multi-layer wave system with parallax depth, foam crests, and underwater caustics
 * - Surfer sprite with tilt animation, wake trail, and splash particles
 * - 3 obstacle types: rocks (static), jellyfish (bobbing), seagulls (aerial)
 * - Starfish collectibles with glow + float-text score popups
 * - 3 HP system with animated heart HUD; heal power-up every 1000 pts
 * - Duck mechanic (action btn) — invulnerability frames with underwater visual
 * - Ambient: bubbles, foam particles, fish silhouettes, animated sun, vignette
 * - Screen shake on hit, speed ramp, distance counter
 */

/* ─── Meta ─── */
export const meta = {
  name: 'Wave Rider',
  emoji: '🏄',
  description: 'Surfa le onde e raccogli le stelle marine!',
  color: '#00BCD4',
  controls: 'joystick',
  instructions:
    'Usa ↑↓ o joystick per muoverti. Raccogli le stelle marine ⭐ ed evita rocce e meduse! Premi Spazio o 🌊 per tuffarti sotto le onde (invulnerabilità breve).',
  gameOverTitle: 'Onda anomala!',
  actionLabel: '🌊',
};

/* ─── Constants ─── */
const W = 480, H = 480;
const PI2 = Math.PI * 2;
const PI = Math.PI;

const PLAYER_X = 100;
const PLAYER_R = 12;
const PLAYER_SPD = 3.2;
const SURF_MIN_Y = 60;
const SURF_MAX_Y = 400;

const DUCK_DUR = 40;
const DUCK_CD = 80;
const IFRAME_DUR = 50;

const HEAL_SCORE_INTERVAL = 1000;

const STARFISH_PTS = 30;
const DIST_PTS_INTERVAL = 25;

/* ─── Palette ─── */
const C = {
  bg: '#061a28',
  skyTop: '#041220', skyMid: '#0a2a45', skyBot: '#0d3b5e',
  waterTop: '#0e7490', waterMid: '#0277BD', waterDeep: '#01476e', waterAbyss: '#021e33',
  foam: '#b2ebf2', foamBright: '#e0f7fa',
  surfBoard: '#f5f5f5', surfStripe: '#FF7043',
  player: '#FFB74D', playerShirt: '#26C6DA', playerHair: '#5D4037',
  starfish: '#FFAB40', starfishGlow: 'rgba(255,171,64,0.5)',
  rock: '#455A64', rockDark: '#263238', rockHi: '#607D8B',
  jelly: '#CE93D8', jellyGlow: 'rgba(206,147,216,0.35)', jellyTentacle: '#AB47BC',
  seagull: '#ECEFF1',
  heart: '#FF1744', heartDim: 'rgba(255,23,68,0.2)',
  heal: '#00E676', healGlow: 'rgba(0,230,118,0.45)',
  text: '#f0ecf4', muted: '#8a9baa',
  sun: '#FFF176', sunGlow: 'rgba(255,241,118,0.12)',
  bubble: 'rgba(178,235,242,0.3)',
  fishSil: 'rgba(255,255,255,0.04)',
};

/* ─── Helpers ─── */
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ─── createGame ─── */
export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  /* ── State ── */
  const S = {
    py: 240,
    vy: 0,
    tilt: 0,
    score: 0,
    hp: 3, maxHp: 3,
    speed: 2.8,
    distance: 0,
    running: true,
    frame: 0,
    waveOffset: 0,

    // Duck mechanic
    ducking: false,
    duckTimer: 0,
    duckCooldown: 0,

    iframe: 0,
    screenShake: 0,
    lastHealMilestone: 0,

    starfish: [],
    obstacles: [],
    healItems: [],
    particles: [],
    floatTexts: [],
    bubbles: [],
    foamTrail: [],
    bgFish: [],

    nextStarfish: 50,
    nextObstacle: 100,
    nextBubble: 5,
    nextFish: 120,
    distAccum: 0,

    // Pre-generated
    stars: [],
    causticPhases: [],
  };

  onHpChange(S.hp, S.maxHp);
  onScore(0);

  // Pre-generate background stars
  for (let i = 0; i < 40; i++) {
    S.stars.push({
      x: Math.random() * W,
      y: Math.random() * (H * 0.25),
      size: 0.5 + Math.random() * 1.2,
      brightness: 0.15 + Math.random() * 0.4,
      twinkleOff: Math.random() * PI2,
    });
  }

  // Pre-generate caustic animation phases
  for (let i = 0; i < 20; i++) {
    S.causticPhases.push({ x: rnd(0, W), y: rnd(H * 0.45, H), phase: rnd(0, PI2), size: rnd(20, 60) });
  }

  /* ── Wave functions ── */
  function getWaveY(x, layer = 0) {
    const t = S.waveOffset;
    const offset = layer * 30;
    return H * 0.38 + offset +
      Math.sin((x + t) * 0.012 + layer * 0.8) * 22 +
      Math.sin((x + t) * 0.007 + layer * 1.5 + 1.0) * 15 +
      Math.sin((x + t) * 0.022 + layer * 0.3 + 2.5) * 8;
  }

  /* ── Particle helpers ── */
  function addParticles(x, y, color, count, opts = {}) {
    const { speed = 3, sizeMin = 1.5, sizeMax = 4, decayMin = 0.02, decayMax = 0.05, gravity = 0.05 } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * PI2;
      const spd = Math.random() * speed;
      S.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 1,
        decay: rnd(decayMin, decayMax),
        color, size: rnd(sizeMin, sizeMax),
        gravity,
      });
    }
  }

  function addSplash(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = -PI * 0.2 - Math.random() * PI * 0.6;
      S.particles.push({
        x, y,
        vx: Math.cos(a) * rnd(1, 4),
        vy: Math.sin(a) * rnd(2, 5),
        life: 1, decay: rnd(0.02, 0.04),
        color: C.foamBright, size: rnd(1.5, 3.5), gravity: 0.12,
      });
    }
  }

  function addFloatText(x, y, text, color, big = false) {
    S.floatTexts.push({ x, y, text, color, life: 1, vy: -1.3, size: big ? 18 : 13 });
  }

  /* ── Drawing sub-routines ── */

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    grad.addColorStop(0, C.skyTop);
    grad.addColorStop(0.5, C.skyMid);
    grad.addColorStop(1, C.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H * 0.45);

    // Stars
    for (const s of S.stars) {
      const twinkle = 0.5 + Math.sin(S.frame * 0.03 + s.twinkleOff) * 0.5;
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Sun (low on horizon)
    const sunX = W * 0.78;
    const sunY = H * 0.18 + Math.sin(S.frame * 0.008) * 4;
    const sunR = 28;

    // Large glow
    const outerGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 5);
    outerGlow.addColorStop(0, 'rgba(255,241,118,0.18)');
    outerGlow.addColorStop(0.4, 'rgba(255,183,77,0.06)');
    outerGlow.addColorStop(1, 'rgba(255,152,0,0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 5, 0, PI2);
    ctx.fill();

    // Sun body
    const sunGrad = ctx.createRadialGradient(sunX - 4, sunY - 4, 2, sunX, sunY, sunR);
    sunGrad.addColorStop(0, '#FFFDE7');
    sunGrad.addColorStop(0.5, C.sun);
    sunGrad.addColorStop(1, '#FFB300');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, PI2);
    ctx.fill();

    // Sun rays
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(S.frame * 0.004);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI2;
      const rayLen = sunR + 12 + Math.sin(S.frame * 0.06 + i * 1.1) * 6;
      ctx.strokeStyle = `rgba(255,241,118,${0.12 + Math.sin(S.frame * 0.04 + i) * 0.06})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (sunR + 2), Math.sin(a) * (sunR + 2));
      ctx.lineTo(Math.cos(a) * rayLen, Math.sin(a) * rayLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOcean() {
    // Main water body
    const wGrad = ctx.createLinearGradient(0, H * 0.35, 0, H);
    wGrad.addColorStop(0, C.waterTop);
    wGrad.addColorStop(0.25, C.waterMid);
    wGrad.addColorStop(0.6, C.waterDeep);
    wGrad.addColorStop(1, C.waterAbyss);
    ctx.fillStyle = wGrad;
    ctx.fillRect(0, H * 0.35, W, H * 0.65);

    // Underwater caustics
    ctx.globalAlpha = 0.06;
    for (const c of S.causticPhases) {
      const cx = ((c.x - S.waveOffset * 0.15) % (W + 100) + W + 100) % (W + 100) - 50;
      const cy = c.y + Math.sin(S.frame * 0.02 + c.phase) * 8;
      const r = c.size + Math.sin(S.frame * 0.03 + c.phase) * 10;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(178,235,242,0.5)');
      grad.addColorStop(1, 'rgba(178,235,242,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Background fish silhouettes
    for (const f of S.bgFish) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = C.fishSil;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.size, f.size);
      // Simple fish shape
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.quadraticCurveTo(4, -5, -6, 0);
      ctx.quadraticCurveTo(4, 5, 10, 0);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12, -4);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Wave layers (back to front)
    for (let layer = 2; layer >= 0; layer--) {
      const alpha = 0.2 + layer * 0.15;
      const lightness = layer === 0 ? C.waterTop : layer === 1 ? C.waterMid : C.waterDeep;
      ctx.globalAlpha = alpha + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 3) {
        ctx.lineTo(x, getWaveY(x, layer));
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = lightness;
      ctx.fill();

      // Foam crest on front wave
      if (layer === 0) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const wy = getWaveY(x, 0);
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = C.foam;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Secondary thin foam line
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const wy = getWaveY(x, 0) + 6;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = C.foamBright;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBubbles() {
    for (const b of S.bubbles) {
      ctx.globalAlpha = b.alpha * b.life;
      ctx.strokeStyle = C.bubble;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, PI2);
      ctx.stroke();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFoamTrail() {
    for (const f of S.foamTrail) {
      ctx.globalAlpha = f.life * 0.4;
      ctx.fillStyle = C.foamBright;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * f.life, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStarfish(s) {
    const bob = Math.sin(s.pulse) * 3;
    const glow = 0.6 + Math.sin(s.pulse) * 0.4;
    const sx = s.x, sy = s.y + bob;

    // Glow
    const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 18);
    grad.addColorStop(0, `rgba(255,171,64,${0.3 * glow})`);
    grad.addColorStop(1, 'rgba(255,171,64,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, PI2);
    ctx.fill();

    // Star shape (5-pointed)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.pulse * 0.3);
    ctx.fillStyle = C.starfish;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerA = (i / 5) * PI2 - PI / 2;
      const innerA = outerA + PI / 5;
      const outerR = 8;
      const innerR = 3.5;
      if (i === 0) ctx.moveTo(Math.cos(outerA) * outerR, Math.sin(outerA) * outerR);
      else ctx.lineTo(Math.cos(outerA) * outerR, Math.sin(outerA) * outerR);
      ctx.lineTo(Math.cos(innerA) * innerR, Math.sin(innerA) * innerR);
    }
    ctx.closePath();
    ctx.fill();
    // Center dot
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, PI2);
    ctx.fill();
    ctx.restore();
  }

  function drawRock(o) {
    const rx = o.x, ry = o.y, rr = o.r;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(rx + 2, ry + rr * 0.7, rr * 0.9, rr * 0.3, 0, 0, PI2);
    ctx.fill();
    // Body
    ctx.fillStyle = C.rock;
    ctx.beginPath();
    ctx.moveTo(rx - rr, ry);
    ctx.quadraticCurveTo(rx - rr * 0.8, ry - rr * 1.1, rx - rr * 0.2, ry - rr);
    ctx.quadraticCurveTo(rx + rr * 0.1, ry - rr * 1.3, rx + rr * 0.5, ry - rr * 0.8);
    ctx.quadraticCurveTo(rx + rr, ry - rr * 0.6, rx + rr, ry);
    ctx.quadraticCurveTo(rx + rr * 0.5, ry + rr * 0.3, rx, ry + rr * 0.2);
    ctx.quadraticCurveTo(rx - rr * 0.5, ry + rr * 0.3, rx - rr, ry);
    ctx.closePath();
    ctx.fill();
    // Dark face
    ctx.fillStyle = C.rockDark;
    ctx.beginPath();
    ctx.moveTo(rx - rr * 0.6, ry);
    ctx.quadraticCurveTo(rx - rr * 0.3, ry - rr * 0.5, rx + rr * 0.1, ry - rr * 0.3);
    ctx.quadraticCurveTo(rx + rr * 0.4, ry, rx, ry + rr * 0.15);
    ctx.quadraticCurveTo(rx - rr * 0.4, ry + rr * 0.2, rx - rr * 0.6, ry);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = C.rockHi;
    ctx.beginPath();
    ctx.arc(rx - rr * 0.2, ry - rr * 0.6, rr * 0.2, 0, PI2);
    ctx.fill();
  }

  function drawJellyfish(o) {
    const jx = o.x, jy = o.y + Math.sin(S.frame * 0.06 + o.phase) * 6;
    const jr = o.r;

    // Glow
    const grad = ctx.createRadialGradient(jx, jy, 1, jx, jy, jr * 3);
    grad.addColorStop(0, C.jellyGlow);
    grad.addColorStop(1, 'rgba(206,147,216,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(jx, jy, jr * 3, 0, PI2);
    ctx.fill();

    // Bell (dome)
    ctx.fillStyle = C.jelly;
    ctx.beginPath();
    ctx.arc(jx, jy, jr, -PI, 0);
    ctx.quadraticCurveTo(jx + jr, jy + jr * 0.3, jx, jy + jr * 0.2);
    ctx.quadraticCurveTo(jx - jr, jy + jr * 0.3, jx - jr, jy);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(jx - jr * 0.2, jy - jr * 0.3, jr * 0.35, 0, PI2);
    ctx.fill();

    // Tentacles
    ctx.strokeStyle = C.jellyTentacle;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    for (let i = -2; i <= 2; i++) {
      const tx = jx + i * (jr * 0.4);
      ctx.beginPath();
      ctx.moveTo(tx, jy + jr * 0.15);
      const wave1 = Math.sin(S.frame * 0.08 + i + o.phase) * 4;
      const wave2 = Math.sin(S.frame * 0.06 + i * 2 + o.phase) * 3;
      ctx.quadraticCurveTo(tx + wave1, jy + jr * 0.8, tx + wave2, jy + jr * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSeagull(o) {
    const sx = o.x, sy = o.y;
    const wingPhase = Math.sin(S.frame * 0.12 + o.phase) * 8;

    ctx.strokeStyle = C.seagull;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx - 8, sy - wingPhase - 4, sx - 16, sy - wingPhase);
    ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 8, sy - wingPhase - 4, sx + 16, sy - wingPhase);
    ctx.stroke();
    // Body dot
    ctx.fillStyle = C.seagull;
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, PI2);
    ctx.fill();
    ctx.lineCap = 'butt';
  }

  function drawPlayer() {
    ctx.save();
    const px = PLAYER_X;
    const py = S.py;
    const isDucking = S.ducking;

    if (S.iframe > 0 && S.frame % 4 < 2) ctx.globalAlpha = 0.35;
    if (isDucking) ctx.globalAlpha *= 0.6;

    ctx.translate(px, py);
    // Tilt based on vertical movement
    ctx.rotate(clamp(S.tilt, -0.35, 0.35));

    if (isDucking) ctx.translate(0, 8);

    // Wake/spray glow behind board
    const wakeGrad = ctx.createRadialGradient(-8, 6, 0, -8, 6, 20);
    wakeGrad.addColorStop(0, 'rgba(178,235,242,0.2)');
    wakeGrad.addColorStop(1, 'rgba(178,235,242,0)');
    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.arc(-8, 6, 20, 0, PI2);
    ctx.fill();

    // Surfboard
    ctx.fillStyle = C.surfBoard;
    ctx.beginPath();
    ctx.ellipse(0, 5, 18, 4, -0.05, 0, PI2);
    ctx.fill();
    // Board stripe
    ctx.fillStyle = C.surfStripe;
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 1.8, -0.05, 0, PI2);
    ctx.fill();
    // Board shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-4, 3.5, 8, 1.2, -0.1, 0, PI);
    ctx.fill();

    if (!isDucking) {
      // Legs
      ctx.fillStyle = C.player;
      ctx.fillRect(-3, -2, 3, 7);
      ctx.fillRect(2, -1, 3, 6);

      // Body/torso
      ctx.fillStyle = C.playerShirt;
      ctx.beginPath();
      ctx.roundRect(-6, -14, 12, 13, 3);
      ctx.fill();

      // Arms
      ctx.strokeStyle = C.player;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const armSwing = Math.sin(S.frame * 0.1) * 0.3;
      // Left arm
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(-12, -6 + Math.sin(S.frame * 0.08) * 3);
      ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.moveTo(6, -10);
      ctx.lineTo(12, -7 + Math.cos(S.frame * 0.08 + armSwing) * 3);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Head
      ctx.fillStyle = C.player;
      ctx.beginPath();
      ctx.arc(0, -19, 6, 0, PI2);
      ctx.fill();
      // Hair
      ctx.fillStyle = C.playerHair;
      ctx.beginPath();
      ctx.arc(0, -21, 6, -PI, -0.1);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2.5, -19, 1.5, 0, PI2);
      ctx.fill();
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(3, -19, 0.8, 0, PI2);
      ctx.fill();
    } else {
      // Ducking pose — crouched on board
      ctx.fillStyle = C.playerShirt;
      ctx.beginPath();
      ctx.ellipse(0, -2, 8, 5, 0, 0, PI2);
      ctx.fill();
      // Head peeking
      ctx.fillStyle = C.player;
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, PI2);
      ctx.fill();
      ctx.fillStyle = C.playerHair;
      ctx.beginPath();
      ctx.arc(0, -9.5, 5, -PI, 0);
      ctx.fill();

      // Underwater ripple effect
      ctx.strokeStyle = 'rgba(178,235,242,0.3)';
      ctx.lineWidth = 1;
      for (let r = 10; r < 30; r += 8) {
        const ripAlpha = 1 - r / 30;
        ctx.globalAlpha = ripAlpha * 0.3;
        ctx.beginPath();
        ctx.arc(0, 8, r + Math.sin(S.frame * 0.15) * 3, 0, PI2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawHealItem(h) {
    const glow = 0.6 + Math.sin(h.pulse) * 0.4;
    const hx = h.x, hy = h.y + Math.sin(h.pulse * 1.2) * 4;

    // Outer glow
    const grad = ctx.createRadialGradient(hx, hy, 2, hx, hy, 20);
    grad.addColorStop(0, `rgba(0,230,118,${0.35 * glow})`);
    grad.addColorStop(1, 'rgba(0,230,118,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, 20, 0, PI2);
    ctx.fill();

    // Green cross
    ctx.fillStyle = C.heal;
    ctx.fillRect(hx - 3, hy - 9, 6, 18);
    ctx.fillRect(hx - 9, hy - 3, 18, 6);
    // Bright center
    ctx.fillStyle = '#B9F6CA';
    ctx.fillRect(hx - 2, hy - 2, 4, 4);
  }

  function drawParticles() {
    for (const p of S.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * clamp(p.life, 0.3, 1), 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    for (const ft of S.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawHUD() {
    // Semi-transparent top bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, 40);
    barGrad.addColorStop(0, 'rgba(4,18,32,0.6)');
    barGrad.addColorStop(1, 'rgba(4,18,32,0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 40);

    // Hearts
    for (let i = 0; i < S.maxHp; i++) {
      const hx = 16 + i * 22;
      const hy = 16;
      const active = i < S.hp;
      const beatScale = active ? 1 + Math.sin(S.frame * 0.08 + i * 0.5) * 0.06 : 1;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(beatScale, beatScale);
      if (active) {
        // Glow
        ctx.shadowColor = C.heart;
        ctx.shadowBlur = 6;
      }
      drawHeart(0, 0, 7, active ? C.heart : C.heartDim);
      ctx.restore();
    }

    // Score
    ctx.fillStyle = C.text;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(`⭐ ${S.score}`, W - 12, 18);

    // Distance
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`${Math.floor(S.distance)}m`, W - 12, 34);

    // Duck cooldown indicator
    if (S.duckCooldown > 0) {
      const pct = S.duckCooldown / DUCK_CD;
      ctx.fillStyle = 'rgba(178,235,242,0.15)';
      ctx.fillRect(W / 2 - 30, H - 18, 60, 6);
      ctx.fillStyle = 'rgba(178,235,242,0.5)';
      ctx.fillRect(W / 2 - 30, H - 18, 60 * (1 - pct), 6);
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  function drawHeart(cx, cy, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.3);
    ctx.bezierCurveTo(cx, cy - size * 0.3, cx - size, cy - size * 0.3, cx - size, cy + size * 0.1);
    ctx.bezierCurveTo(cx - size, cy + size * 0.6, cx, cy + size, cx, cy + size * 1.1);
    ctx.bezierCurveTo(cx, cy + size, cx + size, cy + size * 0.6, cx + size, cy + size * 0.1);
    ctx.bezierCurveTo(cx + size, cy - size * 0.3, cx, cy - size * 0.3, cx, cy + size * 0.3);
    ctx.fill();
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── Update ── */
  function update() {
    if (!S.running) return;
    S.frame++;
    S.waveOffset += S.speed;
    S.distance += S.speed * 0.15;
    S.speed = 2.8 + Math.min(S.distance / 300, 3.2);

    if (S.iframe > 0) S.iframe--;
    if (S.duckCooldown > 0) S.duckCooldown--;
    if (S.screenShake > 0) S.screenShake *= 0.85;
    if (S.screenShake < 0.5) S.screenShake = 0;

    // ── Input ──
    const keys = keysRef.current;
    let my = 0;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) my = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) my = 1;
    const joy = joystickRef.current;
    if (joy.active) my += joy.dy;
    my = clamp(my, -1, 1);

    // Duck
    const wantDuck = keys[' '] || keys['Space'] || actionBtnRef.current;
    if (wantDuck && !S.ducking && S.duckCooldown <= 0) {
      S.ducking = true;
      S.duckTimer = DUCK_DUR;
      S.duckCooldown = DUCK_CD;
      S.iframe = DUCK_DUR;
      actionBtnRef.current = false;
      addSplash(PLAYER_X, S.py);
      addFloatText(PLAYER_X, S.py - 30, '🌊 TUFFO!', C.foam, false);
    }
    if (S.ducking) {
      S.duckTimer--;
      if (S.duckTimer <= 0) {
        S.ducking = false;
        addSplash(PLAYER_X, S.py);
      }
    }

    // Player vertical movement
    S.vy = lerp(S.vy, my * PLAYER_SPD, 0.15);
    S.py += S.vy;
    S.py = clamp(S.py, SURF_MIN_Y, SURF_MAX_Y);
    S.tilt = lerp(S.tilt, S.vy * 0.08, 0.12);

    // ── Foam trail ──
    if (S.frame % 2 === 0) {
      S.foamTrail.push({
        x: PLAYER_X - 12 + rnd(-3, 3),
        y: S.py + 6 + rnd(-2, 2),
        size: rnd(2, 4),
        life: 1,
      });
    }

    // ── Spawn starfish ──
    S.nextStarfish--;
    if (S.nextStarfish <= 0) {
      const count = Math.random() < 0.2 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        S.starfish.push({
          x: W + 20 + i * 30,
          y: rnd(SURF_MIN_Y + 20, SURF_MAX_Y - 20),
          pulse: rnd(0, PI2),
        });
      }
      S.nextStarfish = Math.max(30, 55 - S.distance / 80) + rnd(0, 20);
    }

    // ── Spawn obstacles ──
    S.nextObstacle--;
    if (S.nextObstacle <= 0) {
      const r = Math.random();
      if (r < 0.45) {
        // Rock
        S.obstacles.push({
          type: 'rock', x: W + 25,
          y: rnd(H * 0.35, SURF_MAX_Y),
          r: rnd(12, 20), phase: 0,
        });
      } else if (r < 0.8) {
        // Jellyfish
        S.obstacles.push({
          type: 'jelly', x: W + 25,
          y: rnd(SURF_MIN_Y + 30, SURF_MAX_Y - 30),
          r: rnd(10, 15), phase: rnd(0, PI2),
        });
      } else {
        // Seagull (aerial)
        S.obstacles.push({
          type: 'seagull', x: W + 25,
          y: rnd(SURF_MIN_Y, H * 0.32),
          r: 14, phase: rnd(0, PI2),
        });
      }
      S.nextObstacle = Math.max(40, 100 - S.distance / 40) + rnd(0, 25);
    }

    // ── Spawn bubbles ──
    S.nextBubble--;
    if (S.nextBubble <= 0) {
      S.bubbles.push({
        x: rnd(0, W),
        y: H + 5,
        r: rnd(2, 6),
        vx: rnd(-0.3, 0.3),
        vy: rnd(-0.8, -0.3),
        alpha: rnd(0.15, 0.4),
        life: 1,
      });
      S.nextBubble = rnd(3, 10);
    }

    // ── Spawn background fish ──
    S.nextFish--;
    if (S.nextFish <= 0) {
      S.bgFish.push({
        x: W + 20,
        y: rnd(H * 0.5, H - 20),
        size: rnd(1, 2.5),
        speed: rnd(0.5, 1.5),
        alpha: rnd(0.03, 0.08),
      });
      S.nextFish = rnd(60, 180);
    }

    // ── Update starfish ──
    for (let i = S.starfish.length - 1; i >= 0; i--) {
      const s = S.starfish[i];
      s.x -= S.speed;
      s.pulse += 0.05;
      if (s.x < -20) { S.starfish.splice(i, 1); continue; }
      if (dist(PLAYER_X, S.py, s.x, s.y) < 22) {
        S.score += STARFISH_PTS;
        onScore(S.score);
        addParticles(s.x, s.y, C.starfish, 7, { speed: 2.5 });
        addFloatText(s.x, s.y - 15, `+${STARFISH_PTS}`, C.starfish);
        S.starfish.splice(i, 1);
      }
    }

    // ── Update obstacles ──
    for (let i = S.obstacles.length - 1; i >= 0; i--) {
      const o = S.obstacles[i];
      const spd = o.type === 'seagull' ? S.speed * 1.3 : S.speed;
      o.x -= spd;
      if (o.x < -30) { S.obstacles.splice(i, 1); continue; }

      if (S.iframe <= 0) {
        const oy = o.type === 'jelly' ? o.y + Math.sin(S.frame * 0.06 + o.phase) * 6 : o.y;
        const hitDist = o.r + PLAYER_R - 2;
        if (dist(PLAYER_X, S.py, o.x, oy) < hitDist) {
          S.hp--;
          S.iframe = IFRAME_DUR;
          S.screenShake = 10;
          onHpChange(S.hp, S.maxHp);
          addParticles(PLAYER_X, S.py, C.heart, 8, { speed: 4 });
          addFloatText(PLAYER_X, S.py - 25, '-1 ♥', C.heart, true);
          if (S.hp <= 0) {
            S.running = false;
            return;
          }
        }
      }
    }

    // ── Distance score ──
    S.distAccum += S.speed * 0.15;
    if (S.distAccum >= DIST_PTS_INTERVAL) {
      const pts = Math.floor(S.distAccum / DIST_PTS_INTERVAL) * 5;
      S.score += pts;
      onScore(S.score);
      S.distAccum %= DIST_PTS_INTERVAL;
    }

    // ── Heal power-up ──
    const healMilestone = Math.floor(S.score / HEAL_SCORE_INTERVAL);
    if (healMilestone > S.lastHealMilestone) {
      S.lastHealMilestone = healMilestone;
      if (S.hp < S.maxHp) {
        S.healItems.push({
          x: W + 20,
          y: rnd(SURF_MIN_Y + 20, SURF_MAX_Y - 20),
          pulse: rnd(0, PI2),
        });
      }
    }

    for (let i = S.healItems.length - 1; i >= 0; i--) {
      const h = S.healItems[i];
      h.x -= S.speed;
      h.pulse += 0.07;
      if (h.x < -20) { S.healItems.splice(i, 1); continue; }
      if (dist(PLAYER_X, S.py, h.x, h.y) < 24) {
        S.hp = S.maxHp;
        onHpChange(S.hp, S.maxHp);
        addParticles(h.x, h.y, C.heal, 10, { speed: 3 });
        addFloatText(h.x, h.y - 15, '♥ MAX', C.heal, true);
        S.healItems.splice(i, 1);
      }
    }

    // ── Update bubbles ──
    for (let i = S.bubbles.length - 1; i >= 0; i--) {
      const b = S.bubbles[i];
      b.x += b.vx + Math.sin(S.frame * 0.05 + i) * 0.2 - S.speed * 0.15;
      b.y += b.vy;
      b.life -= 0.004;
      if (b.y < H * 0.3 || b.life <= 0) S.bubbles.splice(i, 1);
    }

    // ── Update foam trail ──
    for (let i = S.foamTrail.length - 1; i >= 0; i--) {
      const f = S.foamTrail[i];
      f.x -= S.speed * 0.7;
      f.life -= 0.03;
      if (f.life <= 0) S.foamTrail.splice(i, 1);
    }

    // ── Update background fish ──
    for (let i = S.bgFish.length - 1; i >= 0; i--) {
      const f = S.bgFish[i];
      f.x -= f.speed + S.speed * 0.3;
      if (f.x < -30) S.bgFish.splice(i, 1);
    }

    // ── Update particles ──
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.x += p.vx - S.speed * 0.2;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      if (p.life <= 0) S.particles.splice(i, 1);
    }

    // ── Update float texts ──
    for (let i = S.floatTexts.length - 1; i >= 0; i--) {
      const ft = S.floatTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.018;
      if (ft.life <= 0) S.floatTexts.splice(i, 1);
    }
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();
    if (S.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * S.screenShake * 2,
        (Math.random() - 0.5) * S.screenShake * 2,
      );
    }

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    drawSky();
    drawOcean();
    drawBubbles();
    drawFoamTrail();

    // Heal items
    for (const h of S.healItems) drawHealItem(h);

    // Starfish
    for (const s of S.starfish) drawStarfish(s);

    // Obstacles
    for (const o of S.obstacles) {
      if (o.type === 'rock') drawRock(o);
      else if (o.type === 'jelly') drawJellyfish(o);
      else if (o.type === 'seagull') drawSeagull(o);
    }

    drawPlayer();
    drawParticles();
    drawFloatTexts();

    // Vignette (drawn over everything except HUD)
    drawVignette();

    drawHUD();

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
