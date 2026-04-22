/**
 * Andryx Hourglass — Scena MARE.
 *
 * Vista dall'alto del mare con la S.S. Pixel come barchetta.
 * Controlli STANDARD: WASD/frecce/joystick per navigare, SPAZIO per attraccare
 * a un'isola sotto il mirino. Le isole compaiono come icone fisse:
 * arrivare sopra → si attracca automaticamente.
 *
 * Caricamento: questa scena viene importata via `import('./sea.js')`
 * solo quando serve (lazy).
 */
import { C } from '../palette.js';
import { drawSprite } from '../sprites.js';
import { SFX, playMusic } from '../audio.js';
import { CANVAS_W, CANVAS_H } from '../render.js';

const SHIP_SPEED = 1.4;          /* px/frame */
const ISLAND_RADIUS = 18;
const ISLAND_ENTER_DIST = 16;

/* Layout isole sulla mappa marina (coord 0..480 nel canvas). */
const ISLANDS = [
  { id: 'mercay', x: 120, y: 300, name: 'Mercay',  color: C.sand,    icon: '🏝️' },
  { id: 'fire',   x: 360, y: 200, name: 'Fuoco',   color: C.red,     icon: '🔥' },
  { id: 'temple', x: 240, y:  90, name: 'Tempio',  color: C.gold,    icon: '⌛' },
];

export function createSeaScene(state) {
  if (!state.sea) {
    state.sea = {
      shipX: 120, shipY: 300, shipDir: 0,
      currentIslandId: 'mercay',
      islandsUnlocked: { mercay: true, temple: false, fire: false },
    };
  }
  /* Posiziona la barca all'isola da cui veniamo, leggermente fuori dalla zona di attracco
     così il player non rientra subito */
  const cur = state.sea.currentIslandId;
  const fromIs = ISLANDS.find(i => i.id === cur);
  if (fromIs) {
    state.sea.shipX = fromIs.x;
    state.sea.shipY = fromIs.y + ISLAND_RADIUS + 14;
    state.sea.shipDir = -Math.PI / 2; /* punta a nord */
  }
  /* Sblocca isole secondo flag */
  if (state.flags.met_oshus) state.sea.islandsUnlocked.temple = true;
  if (state.items.sword) state.sea.islandsUnlocked.fire = true;

  let waveT = 0;
  let _toast = null;
  const scene = {
    id: 'sea',
    dialog: null,

    update(input) {
      waveT += 0.05;
      const { dx, dy } = input.move();
      if (dx || dy) {
        const m = Math.sqrt(dx * dx + dy * dy) || 1;
        const vx = (dx / m) * SHIP_SPEED;
        const vy = (dy / m) * SHIP_SPEED;
        state.sea.shipX = Math.max(20, Math.min(CANVAS_W - 20, state.sea.shipX + vx));
        state.sea.shipY = Math.max(36, Math.min(CANVAS_H - 20, state.sea.shipY + vy));
        state.sea.shipDir = Math.atan2(dy, dx);
      }

      /* Verifica arrivo/azione su un'isola */
      let nearestIsland = null;
      let nearestDist = Infinity;
      for (const isl of ISLANDS) {
        const ddx = state.sea.shipX - isl.x;
        const ddy = state.sea.shipY - isl.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < nearestDist) { nearestDist = d; nearestIsland = isl; }
      }
      scene._nearIsland = (nearestIsland && nearestDist < ISLAND_RADIUS + 18) ? nearestIsland : null;

      /* Auto-attracco: arrivando entro ISLAND_ENTER_DIST */
      if (nearestIsland && nearestDist < ISLAND_ENTER_DIST) {
        if (state.sea.islandsUnlocked[nearestIsland.id]) {
          state.sea.currentIslandId = nearestIsland.id;
          state.nextSceneId = nearestIsland.id;
          SFX.door();
        } else {
          /* Respinge dolcemente la nave (isola bloccata) */
          const bx = state.sea.shipX - nearestIsland.x;
          const by = state.sea.shipY - nearestIsland.y;
          const bm = Math.sqrt(bx * bx + by * by) || 1;
          state.sea.shipX = nearestIsland.x + (bx / bm) * (ISLAND_ENTER_DIST + 2);
          state.sea.shipY = nearestIsland.y + (by / bm) * (ISLAND_ENTER_DIST + 2);
          if (!scene._blockedShown) {
            scene._toast = '🔒 Isola non ancora accessibile';
            scene._blockedShown = 30;
          }
        }
      }
      if (scene._blockedShown > 0) scene._blockedShown--;

      /* SPAZIO: forza attracco se vicino e sbloccato */
      if (input.isAction() && scene._nearIsland && nearestDist < ISLAND_RADIUS + 12) {
        if (state.sea.islandsUnlocked[scene._nearIsland.id]) {
          state.sea.currentIslandId = scene._nearIsland.id;
          state.nextSceneId = scene._nearIsland.id;
          SFX.door();
        }
      }
    },

    render(renderer) {
      const c = renderer.ctx;
      /* Sfondo mare */
      const g = c.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, C.sea_shallow);
      g.addColorStop(1, C.sea_deep);
      c.fillStyle = g;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);

      /* Onde animate */
      c.strokeStyle = 'rgba(160,200,240,0.25)';
      c.lineWidth = 1;
      for (let y = 40; y < CANVAS_H; y += 18) {
        c.beginPath();
        for (let x = 0; x < CANVAS_W; x += 8) {
          const yy = y + Math.sin((x + waveT * 30 + y) * 0.04) * 1.5;
          if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
        }
        c.stroke();
      }

      /* Isole */
      for (const isl of ISLANDS) {
        const unlocked = state.sea.islandsUnlocked[isl.id];
        c.save();
        if (!unlocked) c.globalAlpha = 0.45;
        c.fillStyle = C.sand_dark;
        c.beginPath(); c.arc(isl.x, isl.y, ISLAND_RADIUS + 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = isl.color;
        c.beginPath(); c.arc(isl.x, isl.y, ISLAND_RADIUS, 0, Math.PI * 2); c.fill();
        c.strokeStyle = unlocked ? C.gold : 'rgba(255,255,255,0.4)';
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(isl.x, isl.y, ISLAND_RADIUS, 0, Math.PI * 2); c.stroke();
        /* Icona */
        c.fillStyle = '#fff';
        c.font = 'bold 18px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(isl.icon, isl.x, isl.y);
        /* Nome */
        c.fillStyle = unlocked ? C.parchment : 'rgba(255,255,255,0.55)';
        c.font = 'bold 11px monospace';
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 3;
        c.fillText(isl.name, isl.x, isl.y + ISLAND_RADIUS + 11);
        c.shadowBlur = 0;
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.restore();
      }

      /* Ring attorno all'isola vicina (hint di attracco) */
      if (scene._nearIsland) {
        c.strokeStyle = state.sea.islandsUnlocked[scene._nearIsland.id]
          ? 'rgba(255,245,176,0.7)' : 'rgba(255,80,80,0.7)';
        c.lineWidth = 2;
        c.setLineDash([4, 3]);
        c.beginPath();
        c.arc(scene._nearIsland.x, scene._nearIsland.y, ISLAND_RADIUS + 8, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }

      /* Ship sprite (ruotato) */
      c.save();
      c.translate(state.sea.shipX, state.sea.shipY);
      c.rotate((state.sea.shipDir || 0) + Math.PI / 2);
      drawSprite(c, 'boat', -16, -16, 32, 32);
      c.restore();

      /* Hint bottom */
      c.fillStyle = 'rgba(255,245,176,0.85)';
      c.font = '11px monospace';
      c.textAlign = 'center';
      const msg = scene._nearIsland
        ? (state.sea.islandsUnlocked[scene._nearIsland.id]
            ? `▶ ${scene._nearIsland.name}: avvicinati o premi A per attraccare`
            : `🔒 ${scene._nearIsland.name}: bloccata`)
        : '🎮 WASD/Frecce/Joystick per navigare';
      c.fillText(msg, CANVAS_W / 2, CANVAS_H - 10);
      c.textAlign = 'left';
    },

    pullToast() { const t = scene._toast; scene._toast = null; return t; },
    getDialog() { return null; },
    dispose() { /* nothing */ },
  };

  playMusic('sea');
  return scene;
}
