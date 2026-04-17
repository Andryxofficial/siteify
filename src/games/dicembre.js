/**
 * DICEMBRE — Gift Rush 🎄
 * Collect gifts falling from the sky and deliver them down chimneys.
 * Controls: left/right to move, action to drop gift.
 */
export const meta = {
  name: 'Gift Rush',
  emoji: '🎄',
  description: 'Raccogli i regali e consegnali nei camini prima che scada il tempo!',
  color: '#F44336',
  controls: 'joystick',
  instructions: 'Muoviti con ← → per raccogliere regali. Portali sui camini 🏠 e premi Spazio per consegnare!',
  gameOverTitle: 'Tempo scaduto!',
  actionLabel: '🎁',
};

const W = 480, H = 480;
const PLAYER_W = 24, PLAYER_H = 28;
const GROUND_Y = H - 50;

const GIFT_COLORS = ['#F44336', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

const C = {
  bg1: '#0a0a2a', bg2: '#1a1a4a',
  ground: '#1B5E20', groundSnow: '#E8F5E9',
  player: '#F44336', playerDark: '#C62828',
  chimney: '#5D4037', chimneyTop: '#795548',
  gift: '#F44336',
  star: '#FFD700', starGlow: 'rgba(255,215,0,0.4)',
  snow: '#fff',
  heart: '#FF0050', text: '#f0ecf4', muted: '#a8a3b3',
  timer: '#FFD740',
};

export function createGame(canvas, { keysRef, joystickRef, actionBtnRef, onScore, onGameOver, onHpChange }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let animFrame = null;

  function makeHouses() {
    const houses = [];
    const count = 3 + Math.min(Math.floor(state.round / 2), 3);
    const spacing = W / (count + 1);
    for (let i = 0; i < count; i++) {
      houses.push({
        x: spacing * (i + 1) - 20,
        w: 40,
        delivered: false,
        giftColor: GIFT_COLORS[Math.floor(Math.random() * GIFT_COLORS.length)],
      });
    }
    return houses;
  }

  const state = {
    px: W / 2, py: GROUND_Y - PLAYER_H,
    score: 0,
    round: 0,
    timer: 30 * 60, // 30 seconds at 60fps
    carrying: null, // Gift color or null
    houses: [],
    fallingGifts: [],
    particles: [],
    snowflakes: [],
    floatTexts: [],
    running: true,
    frame: 0,
    nextGift: 40,
    deliveries: 0,
    roundTarget: 3,
    screenShake: 0,
    hp: 1, maxHp: 1,
  };

  state.houses = makeHouses();
  state.roundTarget = state.houses.length;

  onHpChange(state.hp, state.maxHp);
  onScore(0);

  // Snowflakes
  for (let i = 0; i < 35; i++) {
    state.snowflakes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 1 + Math.random() * 2,
      speed: 0.5 + Math.random() * 1,
      drift: (Math.random() - 0.5) * 0.3,
    });
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1) * 3,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        color, size: 2 + Math.random() * 2,
      });
    }
  }

  function addFloatText(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 1 });
  }

  function spawnGift() {
    const neededColors = state.houses.filter(h => !h.delivered).map(h => h.giftColor);
    const color = neededColors.length > 0 && Math.random() < 0.6
      ? neededColors[Math.floor(Math.random() * neededColors.length)]
      : GIFT_COLORS[Math.floor(Math.random() * GIFT_COLORS.length)];
    state.fallingGifts.push({
      x: 30 + Math.random() * (W - 60),
      y: -15,
      color,
      speed: 1.5 + Math.random(),
    });
    state.nextGift = Math.max(20, 50 - state.round * 3);
  }

  function nextRound() {
    state.round++;
    state.houses = makeHouses();
    state.roundTarget = state.houses.length;
    state.deliveries = 0;
    state.timer += 15 * 60; // Bonus time
    state.score += 100 * state.round;
    onScore(state.score);
  }

  function update() {
    if (!state.running) return;
    state.frame++;

    // Timer
    state.timer--;
    if (state.timer <= 0) {
      state.running = false;
      return;
    }

    // Input
    const keys = keysRef.current;
    let mx = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
    const joy = joystickRef.current;
    if (joy.active) mx += joy.dx;
    if (mx > 1) mx = 1;
    if (mx < -1) mx = -1;

    state.px += mx * 5;
    if (state.px < PLAYER_W / 2) state.px = PLAYER_W / 2;
    if (state.px > W - PLAYER_W / 2) state.px = W - PLAYER_W / 2;

    // Spawn gifts
    state.nextGift--;
    if (state.nextGift <= 0) spawnGift();

    // Falling gifts
    for (let i = state.fallingGifts.length - 1; i >= 0; i--) {
      const g = state.fallingGifts[i];
      g.y += g.speed;

      // Catch gift (if not carrying one)
      if (!state.carrying) {
        const dx = state.px - g.x, dy = (GROUND_Y - PLAYER_H / 2) - g.y;
        if (Math.sqrt(dx * dx + dy * dy) < 22) {
          state.carrying = g.color;
          state.fallingGifts.splice(i, 1);
          addParticles(g.x, g.y, g.color, 4);
          continue;
        }
      }

      // Gift hits ground
      if (g.y > GROUND_Y) {
        state.fallingGifts.splice(i, 1);
      }
    }

    // Deliver gift
    const wantDeliver = keys[' '] || keys['Space'] || keys['ArrowDown'] || keys['s'] || keys['S'] || actionBtnRef.current;
    if (wantDeliver && state.carrying) {
      actionBtnRef.current = false;
      // Check if near a matching house
      for (const h of state.houses) {
        if (h.delivered) continue;
        if (Math.abs(state.px - (h.x + h.w / 2)) < h.w * 0.8) {
          if (state.carrying === h.giftColor) {
            h.delivered = true;
            state.deliveries++;
            const pts = 50 + state.round * 10;
            state.score += pts;
            onScore(state.score);
            addParticles(h.x + h.w / 2, GROUND_Y - 30, state.carrying, 8);
            addFloatText(h.x + h.w / 2, GROUND_Y - 50, `+${pts}`, C.star);
            state.carrying = null;

            // Check if round complete
            if (state.deliveries >= state.roundTarget) {
              nextRound();
            }
            break;
          } else {
            // Wrong color - drop the gift
            state.carrying = null;
            addParticles(state.px, GROUND_Y - 20, C.heart, 3);
            addFloatText(state.px, GROUND_Y - 40, 'Colore sbagliato!', C.heart);
            state.screenShake = 4;
            break;
          }
        }
      }
      // Drop if not near house
      if (state.carrying) {
        // Just drop it
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.06;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Float texts
    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const ft = state.floatTexts[i];
      ft.y -= 0.8;
      ft.life -= 0.025;
      if (ft.life <= 0) state.floatTexts.splice(i, 1);
    }

    // Snowflakes
    for (const s of state.snowflakes) {
      s.y += s.speed;
      s.x += s.drift;
      if (s.y > H) { s.y = -5; s.x = Math.random() * W; }
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

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.bg1);
    grad.addColorStop(1, C.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 25; i++) {
      const sx = (i * 137) % W;
      const sy = (i * 91) % (GROUND_Y - 60);
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snowflakes
    for (const s of state.snowflakes) {
      ctx.globalAlpha = 0.5 + s.size / 5;
      ctx.fillStyle = C.snow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = C.groundSnow;
    ctx.fillRect(0, GROUND_Y, W, 4);

    // Houses with chimneys
    for (const h of state.houses) {
      const houseH = 35;
      const roofH = 18;
      const bx = h.x, by = GROUND_Y - houseH;

      // House body
      ctx.fillStyle = '#37474F';
      ctx.fillRect(bx, by, h.w, houseH);
      // Roof
      ctx.fillStyle = '#455A64';
      ctx.beginPath();
      ctx.moveTo(bx - 5, by);
      ctx.lineTo(bx + h.w / 2, by - roofH);
      ctx.lineTo(bx + h.w + 5, by);
      ctx.closePath();
      ctx.fill();
      // Chimney
      ctx.fillStyle = C.chimney;
      ctx.fillRect(bx + h.w - 14, by - roofH - 5, 10, roofH + 5);
      ctx.fillStyle = C.chimneyTop;
      ctx.fillRect(bx + h.w - 16, by - roofH - 8, 14, 4);
      // Door
      ctx.fillStyle = h.giftColor;
      ctx.fillRect(bx + h.w / 2 - 5, by + houseH - 16, 10, 16);
      // Window
      ctx.fillStyle = 'rgba(255,200,0,0.3)';
      ctx.fillRect(bx + 6, by + 6, 8, 8);

      // Delivered indicator
      if (h.delivered) {
        ctx.fillStyle = '#76FF03';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', bx + h.w / 2, by - roofH - 12);
      } else {
        // Show needed gift color
        ctx.fillStyle = h.giftColor;
        ctx.shadowColor = h.giftColor;
        ctx.shadowBlur = 6;
        ctx.fillRect(bx + h.w / 2 - 5, by - roofH - 16, 10, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(bx + h.w / 2 - 1, by - roofH - 16, 2, 10);
        ctx.fillRect(bx + h.w / 2 - 5, by - roofH - 12, 10, 2);
        ctx.shadowBlur = 0;
      }
    }

    // Falling gifts
    for (const g of state.fallingGifts) {
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(g.x - 7, g.y - 7, 14, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(g.x - 1, g.y - 7, 2, 14);
      ctx.fillRect(g.x - 7, g.y - 1, 14, 2);
      ctx.shadowBlur = 0;
    }

    // Player (Santa)
    ctx.save();
    const px = state.px, py = GROUND_Y - PLAYER_H;
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 8;
    // Body
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(px, py + PLAYER_H / 2 - 2, PLAYER_W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerDark;
    ctx.beginPath();
    ctx.arc(px, py + PLAYER_H / 2 - 2, PLAYER_W / 3, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#FFCCBC';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    // Hat
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 2);
    ctx.lineTo(px, py - 14);
    ctx.lineTo(px + 8, py - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py - 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 9, py - 3, 18, 3);
    ctx.restore();

    // Carrying indicator
    if (state.carrying) {
      ctx.fillStyle = state.carrying;
      ctx.shadowColor = state.carrying;
      ctx.shadowBlur = 8;
      ctx.fillRect(px - 5, py - 26, 10, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(px - 1, py - 26, 2, 10);
      ctx.fillRect(px - 5, py - 22, 10, 2);
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const p of state.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Float texts
    for (const ft of state.floatTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // HUD
    // Timer
    const seconds = Math.ceil(state.timer / 60);
    ctx.fillStyle = seconds <= 10 ? C.heart : C.timer;
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${seconds}s`, 12, 20);
    // Score
    ctx.fillStyle = C.text;
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${state.score}`, W - 12, 18);
    ctx.fillStyle = C.muted;
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`Round ${state.round + 1}`, W - 12, 34);
    // Deliveries
    ctx.fillText(`🎁 ${state.deliveries}/${state.roundTarget}`, W - 12, 48);
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
