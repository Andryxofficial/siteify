/**
 * Andryx Hourglass — Scena ISOLA MERCAY (hub).
 *
 * Vista top-down 480×480. Player = Andryx.
 * Controlli STANDARD: WASD/frecce/joystick per muoversi, SPAZIO/A per attaccare/parlare.
 *
 * Contenuto:
 *   – Oshus (dà la spada se non l'hai)
 *   – Linebeck (sblocca navigazione, parla)
 *   – Shopkeeper (testo flavor)
 *   – Molo (avvicinati per tornare al mare)
 *   – ChuChu spawnati se non hai ancora la spada (intro fight)
 */
import { C } from '../palette.js';
import { drawSprite } from '../sprites.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../render.js';
import { addRupees, damage } from '../state.js';

const PLAYER_SPEED = 1.4;
const PLAYER_R = 7;
const ATTACK_RANGE = 18;
const ATTACK_FRAMES = 14;
const TALK_RANGE = 28;

/* AABB solidi: bordo mare, case, pietre. */
const SOLIDS = [
  { x: 0,        y: 0,        w: CANVAS_W, h: 30 },
  { x: 0,        y: CANVAS_H - 30, w: CANVAS_W, h: 30 },
  { x: 0,        y: 0,        w: 30, h: CANVAS_H },
  { x: CANVAS_W - 30, y: 0,   w: 30, h: CANVAS_H },
  { x: 80,  y: 100, w: 60, h: 50 },          /* Casa Oshus */
  { x: 320, y: 110, w: 70, h: 60 },          /* Casa Linebeck */
  { x: 200, y: 220, w: 24, h: 24 },          /* Pietra 1 */
  { x: 260, y: 320, w: 20, h: 20 },          /* Pietra 2 */
];
/* Apertura nel bordo mare per il molo */
const DOCK_OPENING = { x: 30, y: 220, w: 0, h: 60 };

const NPCS = [
  {
    id: 'oshus',     label: 'Oshus',  x: 110, y: 180, sprite: 'npc_oshus',
    dialog: (state) => state.flags.met_oshus
      ? (state.items.sword ? 'Va\', il mare ti aspetta. Dirigiti al Tempio del Re del Mare.' : t('npc.oshus_intro'))
      : t('npc.oshus_intro'),
    onTalk: (state, scene) => {
      if (!state.flags.met_oshus) {
        state.flags.met_oshus = true;
        state.sea.islandsUnlocked.temple = true;
      }
      if (!state.items.sword) {
        state.items.sword = true;
        state.sea.islandsUnlocked.fire = true;
        scene._toast = t('toast.got_sword');
        SFX.pickup();
      }
    },
  },
  {
    id: 'linebeck', label: 'Linebeck', x: 360, y: 200, sprite: 'npc_linebeck',
    dialog: (state) => state.flags.met_linebeck ? t('npc.linebeck_sail') : t('npc.linebeck_intro'),
    onTalk: (state) => { state.flags.met_linebeck = true; },
  },
  {
    id: 'shopkeeper', label: 'Negoziante', x: 200, y: 380, sprite: 'npc_shopkeeper',
    dialog: () => t('npc.shopkeeper'),
  },
];

/* Trigger del molo: avvicinandosi → torna al mare */
const DOCK = { x: 30, y: 240, w: 24, h: 60 };

const SPAWN_ENEMIES = (state) => state.items.sword ? [] : [
  { kind: 'chuchu', x: 360, y: 360, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: 1 },
  { kind: 'chuchu', x: 280, y: 380, hp: 1, maxHp: 1, vx: 0, vy: 0, iframes: 0, dir: -1 },
];

export function createMercayScene(state) {
  const player = {
    x: state.spawnX || 80,
    y: state.spawnY || 240,
    dir: 'down',
    iframes: 0,
    attack: null,
  };
  state.spawnX = state.spawnY = null;

  const enemies = SPAWN_ENEMIES(state);
  const scene = {
    id: 'mercay',
    dialog: null,
    _toast: null,
  };

  /* Auto-trigger dialogo Oshus al primo ingresso */
  if (!state.flags.met_oshus) {
    scene.dialog = makeDialog('Oshus', t('npc.oshus_intro'), () => {
      state.flags.met_oshus = true;
      state.sea.islandsUnlocked.temple = true;
      if (!state.items.sword) {
        state.items.sword = true;
        state.sea.islandsUnlocked.fire = true;
        scene._toast = t('toast.got_sword');
        SFX.pickup();
      }
    });
  }

  playMusic('island');

  function isSolid(x, y) {
    /* Apertura del molo (passabile attraverso il bordo sinistro) */
    if (x > 0 && x < 30 && y > DOCK.y && y < DOCK.y + DOCK.h) return false;
    for (const s of SOLIDS) {
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
    }
    return false;
  }

  function tryMove(p, dx, dy) {
    const r = PLAYER_R;
    const nx = p.x + dx;
    if (!isSolid(nx - r, p.y - r) && !isSolid(nx + r, p.y - r) &&
        !isSolid(nx - r, p.y + r) && !isSolid(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isSolid(p.x - r, ny - r) && !isSolid(p.x + r, ny - r) &&
        !isSolid(p.x - r, ny + r) && !isSolid(p.x + r, ny + r)) p.y = ny;
  }

  function nearestNpcInRange() {
    let best = null, bd = Infinity;
    for (const n of NPCS) {
      const dx = player.x - n.x, dy = player.y - n.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < TALK_RANGE && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  Object.assign(scene, {
    update(input, _state, frame) {
      /* Dialog: typewriter + skip con AZIONE */
      if (scene.dialog) {
        const d = scene.dialog;
        const line = d.lines[d.lineIdx] || '';
        if (d.charIdx < line.length) {
          d.charIdx = Math.min(line.length, d.charIdx + 1.5);
          if (Math.floor(d.charIdx) % 4 === 0) SFX.text();
          if (d.charIdx >= line.length) d.completedAt = frame;
        }
        if (input.isAction()) {
          if (d.charIdx < line.length) { d.charIdx = line.length; d.completedAt = frame; }
          else if ((frame - (d.completedAt || 0)) >= 4) {
            if (d.lineIdx < d.lines.length - 1) {
              d.lineIdx++; d.charIdx = 0; d.completedAt = 0;
            } else {
              if (d.onComplete) d.onComplete();
              scene.dialog = null;
            }
          }
        }
        return;
      }

      /* Movimento */
      const { dx, dy } = input.move();
      if (dx || dy) {
        tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else                              player.dir = dy > 0 ? 'down' : 'up';
      }

      /* Azione: parla con NPC vicino, altrimenti attacca */
      if (input.isAction() && !player.attack) {
        const npc = nearestNpcInRange();
        if (npc) {
          scene.dialog = makeDialog(npc.label, npc.dialog(state), () => {
            if (npc.onTalk) npc.onTalk(state, scene);
          });
          SFX.text();
        } else if (state.items.sword) {
          player.attack = { frame: 0, dir: player.dir };
          SFX.sword();
        }
      }

      /* Animazione attacco + hit */
      if (player.attack) {
        player.attack.frame++;
        if ([4, 8].includes(player.attack.frame)) {
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const adx = e.x - player.x, ady = e.y - player.y;
            const dist = Math.sqrt(adx * adx + ady * ady);
            /* Solo se il nemico è davanti rispetto alla direzione di attacco */
            const dir = player.attack.dir;
            const inFront =
              (dir === 'right' && adx > -4) || (dir === 'left' && adx < 4) ||
              (dir === 'down'  && ady > -4) || (dir === 'up'   && ady < 4);
            if (dist < ATTACK_RANGE + 6 && inFront) {
              e.hp--;
              e.iframes = 18;
              e.vx = (adx / (dist || 1)) * 4;
              e.vy = (ady / (dist || 1)) * 4;
              SFX.enemy_hit();
              if (e.hp <= 0) {
                state.kills++;
                addRupees(state, 5);
                scene._toast = t('toast.got_rupees', { n: 5 });
                SFX.rupee();
              }
            }
          }
        }
        if (player.attack.frame >= ATTACK_FRAMES) player.attack = null;
      }

      /* Player iframes */
      if (player.iframes > 0) player.iframes--;

      /* Update enemies */
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (e.iframes > 0) e.iframes--;
        e.x += e.vx; e.y += e.vy;
        e.vx *= 0.85; e.vy *= 0.85;
        if (e.kind === 'chuchu') {
          if (Math.random() < 0.02) e.dir = -e.dir;
          e.x += e.dir * 0.4;
          if (e.x < 50 || e.x > CANVAS_W - 50) e.dir = -e.dir;
        }
        const cdx = player.x - e.x, cdy = player.y - e.y;
        if (cdx * cdx + cdy * cdy < 14 * 14 && player.iframes === 0) {
          if (damage(state, 1)) {
            state.flags.gameover = true;
            SFX.gameover();
          } else {
            SFX.hit();
            player.iframes = 50;
          }
        }
      }

      /* Trigger molo → torna al mare */
      if (player.x > DOCK.x && player.x < DOCK.x + DOCK.w &&
          player.y > DOCK.y && player.y < DOCK.y + DOCK.h) {
        if (state.flags.met_oshus) {
          state.nextSceneId = 'sea';
          SFX.sail();
        }
      }
    },

    render(renderer) {
      const c = renderer.ctx;
      /* Sabbia */
      c.fillStyle = C.sand;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const g = c.createRadialGradient(CANVAS_W/2, CANVAS_H/2, 80, CANVAS_W/2, CANVAS_H/2, 320);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      c.fillStyle = g;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      /* Bordo mare */
      c.fillStyle = C.sea_shallow;
      c.fillRect(0, 0, CANVAS_W, 30);
      c.fillRect(0, CANVAS_H - 30, CANVAS_W, 30);
      c.fillRect(0, 0, 30, CANVAS_H);
      c.fillRect(CANVAS_W - 30, 0, 30, CANVAS_H);
      /* Apertura molo nel bordo */
      c.fillStyle = '#6a4830';
      c.fillRect(0, DOCK.y - 4, 30, DOCK.h + 8);
      c.fillStyle = C.sea_foam;
      c.fillRect(28, 30, CANVAS_W - 56, 2);
      c.fillRect(28, CANVAS_H - 32, CANVAS_W - 56, 2);
      c.fillRect(CANVAS_W - 30, 30, 2, CANVAS_H - 60);

      /* Case */
      drawHouse(c, 80, 100, 60, 50, '#8a4030');
      drawHouse(c, 320, 110, 70, 60, '#3060a0');

      /* Pietre */
      for (const s of SOLIDS.slice(6)) {
        c.fillStyle = C.rock;
        c.fillRect(s.x, s.y, s.w, s.h);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(s.x + 2, s.y + s.h - 4, s.w - 4, 4);
      }

      /* Alberi */
      drawTree(c, 180, 80);
      drawTree(c, 420, 380);
      drawTree(c, 70, 340);

      /* Molo (assi) */
      c.fillStyle = '#6a4830';
      c.fillRect(DOCK.x, DOCK.y, DOCK.w, DOCK.h);
      c.fillStyle = '#4a3020';
      for (let i = 0; i < 6; i++) {
        c.fillRect(DOCK.x + 2, DOCK.y + 4 + i * 10, DOCK.w - 4, 2);
      }
      c.fillStyle = '#fff5b0';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.fillText('▶ MARE', DOCK.x + DOCK.w / 2, DOCK.y - 4);
      c.textAlign = 'left';

      /* NPCs */
      const nearNpc = nearestNpcInRange();
      for (const n of NPCS) {
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.ellipse(n.x, n.y + 14, 10, 4, 0, 0, Math.PI * 2); c.fill();
        drawSprite(c, n.sprite, n.x - 16, n.y - 16, 32, 32);
        if (nearNpc === n) {
          /* Indicatore "A" sopra alla testa */
          c.fillStyle = C.gold;
          c.font = 'bold 11px monospace';
          c.textAlign = 'center';
          c.shadowColor = 'rgba(0,0,0,0.8)';
          c.shadowBlur = 3;
          c.fillText('▼ A', n.x, n.y - 18);
          c.shadowBlur = 0;
          c.textAlign = 'left';
        } else if (n.id === 'oshus' && !state.flags.met_oshus) {
          c.fillStyle = C.gold;
          c.font = 'bold 16px monospace';
          c.textAlign = 'center';
          c.fillText('!', n.x, n.y - 18);
          c.textAlign = 'left';
        }
      }

      /* Nemici */
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        c.save();
        if (e.iframes > 0 && Math.floor(e.iframes / 3) % 2) c.globalAlpha = 0.4;
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.ellipse(e.x, e.y + 12, 9, 3, 0, 0, Math.PI * 2); c.fill();
        drawSprite(c, 'enemy_chuchu', e.x - 16, e.y - 16, 32, 32);
        c.restore();
      }

      /* Player */
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(player.x, player.y + 12, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.save();
      if (player.iframes > 0 && Math.floor(player.iframes / 3) % 2) c.globalAlpha = 0.5;
      drawSprite(c, 'player_' + player.dir, player.x - 16, player.y - 16, 32, 32);
      c.restore();

      /* Slash arc */
      if (player.attack) {
        const a = player.attack;
        const angle = a.dir === 'right' ? 0 : a.dir === 'down' ? Math.PI / 2
                    : a.dir === 'left' ? Math.PI : -Math.PI / 2;
        const swing = (a.frame / ATTACK_FRAMES) * Math.PI - Math.PI / 2;
        c.save();
        c.translate(player.x, player.y);
        c.rotate(angle + swing);
        c.strokeStyle = '#fff';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(8, 0); c.lineTo(20, 0);
        c.stroke();
        c.restore();
      }
    },

    pullToast() { const tt = scene._toast; scene._toast = null; return tt; },
    getDialog() { return scene.dialog; },
    dispose() { /* nothing */ },
  });

  return scene;
}

/* Helper: costruisce un dialog state. */
function makeDialog(speaker, text, onComplete) {
  return {
    speaker,
    lines: text.split('\n'),
    lineIdx: 0,
    charIdx: 0,
    completedAt: 0,
    onComplete,
  };
}

function drawHouse(c, x, y, w, h, color) {
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(x + 4, y + h, w, 4);
  c.fillStyle = '#d8b070';
  c.fillRect(x, y + 12, w, h - 12);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - 6, y + 14);
  c.lineTo(x + w / 2, y - 6);
  c.lineTo(x + w + 6, y + 14);
  c.closePath();
  c.fill();
  c.fillStyle = '#4a3020';
  c.fillRect(x + w / 2 - 6, y + h - 18, 12, 18);
  c.fillStyle = '#80c0e0';
  c.fillRect(x + 6, y + 22, 10, 8);
  c.fillRect(x + w - 16, y + 22, 10, 8);
}

function drawTree(c, x, y) {
  c.fillStyle = C.trunk;
  c.fillRect(x - 4, y, 8, 16);
  c.fillStyle = C.leaf_dark;
  c.beginPath(); c.arc(x, y - 4, 14, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.leaf;
  c.beginPath(); c.arc(x - 3, y - 6, 10, 0, Math.PI * 2); c.fill();
}
