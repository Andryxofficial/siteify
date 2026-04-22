/**
 * Andryx Hourglass — TEMPIO DEL RE DEL MARE.
 *
 * Riproduce la meccanica chiave di Phantom Hourglass:
 *   – La clessitra (state.hourglassMs) si svuota mentre sei in questa scena.
 *   – In ZONA SICURA (tile verdi luminosi) il timer NON cala e si ricarica.
 *   – I PHANTOM pattugliano: se ti vedono ti inseguono. Tocco = -2 cuori e
 *     espulso al piano superiore (penalita`). Sono INVULNERABILI alla spada.
 *   – Per uscire: trovare la chiave del piano e raggiungere la scala "↑".
 *   – Se il timer arriva a 0 → game over.
 *
 * Il piano e` una griglia 15×15 di tile 32px (480×480 = 15×15 esatti).
 * Tile types:
 *   '.' floor   '#' wall   's' safe-zone   'k' key   'd' stair-up (uscita)
 *   'p' phantom-spawn   '@' player-spawn
 *
 * Floor 0 = piano introduttivo (chiave + esce facile).
 * Floor 1 = chiede il boomerang (interruttori a distanza).
 *
 * Per ora implementiamo Floor 0 (giocabile end-to-end). Floor 1+ generato
 * proceduralmente sulla stessa logica.
 */
import { C } from '../palette.js';
import { drawSprite } from '../sprites.js';
import { SFX, playMusic } from '../audio.js';
import { t } from '../i18n.js';
import { CANVAS_W, CANVAS_H } from '../render.js';
import { damage } from '../state.js';

const TILE = 32;
const COLS = 15;
const ROWS = 15;
const PLAYER_SPEED = 1.4;
const PLAYER_R = 7;
const PHANTOM_SPEED_PATROL = 0.55;
const PHANTOM_SPEED_CHASE  = 1.1;
const PHANTOM_SIGHT = 96;       /* pixel */
const PHANTOM_TOUCH_DAMAGE = 2;

/* Mappa Floor 0 — un percorso semplice con safe zones, una chiave, una scala. */
const FLOOR_0 = [
  '###############',
  '#@.....#......#',
  '#.sss..#..ss..#',
  '#.sss..#..ss..#',
  '#......#......#',
  '#.....k........',
  '#......#......#',
  '#......#..p...#',
  '########..#####',
  '#......#......#',
  '#..ss..........',
  '#..ss..#......#',
  '#......#..ss..#',
  '#......#..ssd.#',
  '###############',
];

/* Floor 1 — variant più tosta: due phantom, chiave più nascosta. */
const FLOOR_1 = [
  '###############',
  '#@.....#.....k#',
  '#.ss...#......#',
  '#.ss...#..p...#',
  '#......#......#',
  '#......#......#',
  '##.#####......#',
  '#.....p#######',
  '#......#......#',
  '#......#..ss..#',
  '#..ss..#..ss..#',
  '#..ss..#......#',
  '#......#......#',
  '#............d#',
  '###############',
];

const FLOORS = [FLOOR_0, FLOOR_1];

export function createTempleScene(state) {
  state.flags.visited_temple = true;
  /* Inizializza piano */
  let floorIdx = state.oceanFloor || 0;
  if (floorIdx >= FLOORS.length) floorIdx = FLOORS.length - 1;
  const map = FLOORS[floorIdx].map(r => r.split(''));

  let player = { x: 0, y: 0, dir: 'down', iframes: 0, attack: null };
  const phantoms = [];
  let key = null;
  let stair = null;
  /* Parsing mappa → entita` */
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = map[y][x];
      if (c === '@') {
        player.x = x * TILE + TILE / 2;
        player.y = y * TILE + TILE / 2;
        map[y][x] = '.';
      } else if (c === 'p') {
        phantoms.push({
          x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
          dir: 'down', state: 'patrol',  /* patrol | chase | alert */
          patrolT: 0, alertT: 0,
          patrolDir: { dx: 1, dy: 0 },
        });
        map[y][x] = '.';
      } else if (c === 'k') {
        key = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false };
        map[y][x] = '.';
      } else if (c === 'd') {
        stair = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        map[y][x] = 'd';  /* mantieni segno per render */
      }
    }
  }

  const scene = {
    id: 'temple',
    dialog: null,
    _toast: null,
    _floorIntroShown: false,
    _alertFlash: 0,
  };

  /* Dialogo introduttivo al primo ingresso */
  if (!state.flags.met_temple_intro) {
    scene.dialog = {
      speaker: 'Oshus',
      lines: t('npc.elder_temple').split('\n'),
      lineIdx: 0, charIdx: 0, completedAt: 0,
      onComplete: () => { state.flags.met_temple_intro = true; },
    };
  }

  playMusic('temple');

  /* Helpers */
  const isWall = (x, y) => {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    return map[cy][cx] === '#';
  };
  const tileAt = (x, y) => {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return '#';
    return map[cy][cx];
  };
  const isSafe = (x, y) => tileAt(x, y) === 's';

  function tryMove(p, dx, dy) {
    const r = PLAYER_R;
    const nx = p.x + dx;
    if (!isWall(nx - r, p.y - r) && !isWall(nx + r, p.y - r) &&
        !isWall(nx - r, p.y + r) && !isWall(nx + r, p.y + r)) p.x = nx;
    const ny = p.y + dy;
    if (!isWall(p.x - r, ny - r) && !isWall(p.x + r, ny - r) &&
        !isWall(p.x - r, ny + r) && !isWall(p.x + r, ny + r)) p.y = ny;
  }

  /** Linea di vista cardinale: phantom vede player se nessun muro fra loro
   *  e distanza < PHANTOM_SIGHT. Approccio: campiona ogni 6px tra i due. */
  function hasLineOfSight(ph, plX, plY) {
    const dx = plX - ph.x, dy = plY - ph.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > PHANTOM_SIGHT) return false;
    const steps = Math.ceil(dist / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(ph.x + dx * t, ph.y + dy * t)) return false;
    }
    return true;
  }

  function ejectPlayerToFloorAbove() {
    /* Penalita`: torna al piano superiore (o esce dal tempio se piano 0) */
    if (floorIdx > 0) {
      state.oceanFloor = floorIdx - 1;
      state.nextSceneId = 'temple';
      state.spawnX = null; state.spawnY = null;
    } else {
      /* Piano 0 → torna al mare */
      state.nextSceneId = 'sea';
    }
    SFX.gameover();
  }

  Object.assign(scene, {
    update(input, _state, frame) {
      /* Dialog typewriter */
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

      /* Timer hourglass */
      const inSafe = isSafe(player.x, player.y);
      state.inSafeZone = inSafe;
      if (inSafe) {
        state.hourglassMs = Math.min(state.hourglassMax, state.hourglassMs + 1000 / 60 * 2);  /* ricarica 2x */
      } else {
        state.hourglassMs -= 1000 / 60;
        if (state.hourglassMs <= 0) {
          state.flags.gameover = true;
          SFX.gameover();
          return;
        }
        /* Tick sonoro ogni secondo se sotto un minuto */
        if (state.hourglassMs < 60000 && Math.floor(state.hourglassMs / 1000) !== Math.floor((state.hourglassMs + 1000/60) / 1000)) {
          SFX.timer_tick();
          if (state.hourglassMs < 30000 && state.hourglassMs > 28000) {
            scene._toast = t('toast.timer_low');
          }
        }
      }
      /* Toast quando entri in safe zone */
      if (inSafe && !scene._wasInSafe) {
        scene._toast = t('toast.safe_entered');
        SFX.safe();
      }
      scene._wasInSafe = inSafe;

      /* Movimento player */
      const { dx, dy } = input.move();
      if (dx || dy) {
        tryMove(player, dx * PLAYER_SPEED, dy * PLAYER_SPEED);
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else                              player.dir = dy > 0 ? 'down' : 'up';
      }

      /* Pickup chiave */
      if (key && !key.taken) {
        const kdx = player.x - key.x, kdy = player.y - key.y;
        if (kdx * kdx + kdy * kdy < 14 * 14) {
          key.taken = true;
          state.items.keys++;
          scene._toast = t('toast.got_key');
          SFX.key();
        }
      }

      /* Stair (uscita): serve la chiave del piano */
      if (stair) {
        const sdx = player.x - stair.x, sdy = player.y - stair.y;
        if (sdx * sdx + sdy * sdy < 14 * 14) {
          if (state.items.keys > 0) {
            state.items.keys--;
            /* Avanza al piano successivo */
            if (floorIdx + 1 < FLOORS.length) {
              state.oceanFloor = floorIdx + 1;
              state.nextSceneId = 'temple';
              SFX.door();
            } else {
              /* Ultimo piano: vittoria del tempio */
              state.flags.defeated_phantom_lord = true;
              state.flags.win = true;
              state.score += 5000;
              SFX.victory();
              state.nextSceneId = 'sea';
            }
          } else {
            scene._toast = t('toast.door_locked');
          }
        }
      }

      /* Player iframes */
      if (player.iframes > 0) player.iframes--;
      if (scene._alertFlash > 0) scene._alertFlash--;

      /* Phantom AI */
      let anyChasing = false;
      for (const ph of phantoms) {
        const sees = hasLineOfSight(ph, player.x, player.y);
        if (sees) {
          if (ph.state !== 'chase') {
            ph.state = 'chase';
            ph.alertT = 30;
            scene._alertFlash = 40;
            SFX.phantom_alert();
          }
        } else if (ph.state === 'chase' && ph.alertT-- < -120) {
          ph.state = 'patrol';
          ph.alertT = 0;
        }
        if (ph.state === 'chase') anyChasing = true;

        let speed = PHANTOM_SPEED_PATROL;
        let pdx = 0, pdy = 0;
        if (ph.state === 'chase') {
          speed = PHANTOM_SPEED_CHASE;
          const ddx = player.x - ph.x, ddy = player.y - ph.y;
          const m = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          pdx = ddx / m;
          pdy = ddy / m;
        } else {
          ph.patrolT--;
          if (ph.patrolT <= 0) {
            ph.patrolT = 60 + Math.random() * 60;
            const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
            ph.patrolDir = dirs[Math.floor(Math.random() * 4)];
          }
          pdx = ph.patrolDir.dx;
          pdy = ph.patrolDir.dy;
        }

        const r = 9;
        const nx = ph.x + pdx * speed;
        const ny = ph.y + pdy * speed;
        let moved = false;
        if (!isWall(nx - r, ph.y - r) && !isWall(nx + r, ph.y - r) &&
            !isWall(nx - r, ph.y + r) && !isWall(nx + r, ph.y + r)) {
          ph.x = nx; moved = true;
        }
        if (!isWall(ph.x - r, ny - r) && !isWall(ph.x + r, ny - r) &&
            !isWall(ph.x - r, ny + r) && !isWall(ph.x + r, ny + r)) {
          ph.y = ny; moved = true;
        }
        if (!moved && ph.state === 'patrol') {
          /* Sceglie nuova direzione */
          ph.patrolT = 0;
        }
        if (Math.abs(pdx) > Math.abs(pdy)) ph.dir = pdx > 0 ? 'right' : 'left';
        else                                ph.dir = pdy > 0 ? 'down' : 'up';

        /* Touch del player (anche dentro safe zone — il phantom ti tocca lo stesso) */
        const tdx = player.x - ph.x, tdy = player.y - ph.y;
        if (tdx * tdx + tdy * tdy < 16 * 16 && player.iframes === 0) {
          /* Phantom = espulsione + danno */
          if (damage(state, PHANTOM_TOUCH_DAMAGE)) {
            state.flags.gameover = true;
            SFX.gameover();
          } else {
            SFX.hit();
            player.iframes = 60;
            ejectPlayerToFloorAbove();
            return;
          }
        }
      }

      /* La spada NON danneggia i phantom (Phantom Hourglass-style).
         L'azione fa solo flash visivo per chi prova a colpirli. */
      if (input.isAction() && state.items.sword && !player.attack) {
        player.attack = { frame: 0, dir: player.dir };
        SFX.sword();
      }
      if (player.attack) {
        player.attack.frame++;
        if (player.attack.frame >= 14) player.attack = null;
      }

      scene._anyChasing = anyChasing;
    },

    render(renderer) {
      const c = renderer.ctx;
      /* Sfondo dungeon: pavimento marrone scuro */
      c.fillStyle = '#3a2820';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);

      /* Tile */
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const ch = map[y][x];
          const px = x * TILE, py = y * TILE;
          if (ch === '#') {
            /* Muro */
            c.fillStyle = '#1a1010';
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = '#5a3020';
            c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            c.fillStyle = 'rgba(255,200,120,0.15)';
            c.fillRect(px + 4, py + 4, TILE - 8, 2);
          } else if (ch === 's') {
            /* Safe zone — pad verde luminoso pulsante */
            const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.15;
            c.fillStyle = '#605040';
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = `rgba(128,240,160,${pulse})`;
            c.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            c.strokeStyle = '#fff8c0';
            c.lineWidth = 1;
            c.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
            /* Cerchio centrale */
            c.fillStyle = `rgba(255,255,200,${pulse * 0.4})`;
            c.beginPath();
            c.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2);
            c.fill();
          } else if (ch === 'd') {
            /* Stair up */
            c.fillStyle = '#605040';
            c.fillRect(px, py, TILE, TILE);
            c.fillStyle = '#1a1010';
            c.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
            c.fillStyle = '#fff8c0';
            c.font = 'bold 18px monospace';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(state.items.keys > 0 ? '↑' : '🔒', px + TILE / 2, py + TILE / 2);
            c.textBaseline = 'alphabetic';
            c.textAlign = 'left';
          } else {
            /* Floor */
            c.fillStyle = '#605040';
            c.fillRect(px, py, TILE, TILE);
            c.strokeStyle = 'rgba(0,0,0,0.15)';
            c.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          }
        }
      }

      /* Chiave */
      if (key && !key.taken) {
        const bob = Math.sin(Date.now() / 200) * 2;
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.beginPath(); c.ellipse(key.x, key.y + 12, 7, 3, 0, 0, Math.PI * 2); c.fill();
        drawSprite(c, 'item_key', key.x - 12, key.y - 12 + bob, 24, 24);
      }

      /* Phantoms */
      for (const ph of phantoms) {
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.beginPath(); c.ellipse(ph.x, ph.y + 14, 12, 4, 0, 0, Math.PI * 2); c.fill();
        c.save();
        if (ph.state === 'chase') {
          /* Tinta rossa + leggero glow */
          c.shadowColor = C.phantom_red;
          c.shadowBlur = 10;
        }
        drawSprite(c, 'enemy_phantom', ph.x - 18, ph.y - 18, 36, 36);
        c.restore();

        /* Cono di vista (sottile, solo in patrol) */
        if (ph.state === 'patrol') {
          c.strokeStyle = 'rgba(255,255,180,0.18)';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(ph.x, ph.y, PHANTOM_SIGHT, 0, Math.PI * 2);
          c.stroke();
        } else {
          /* Linea di mira al player */
          c.strokeStyle = 'rgba(255,80,80,0.6)';
          c.lineWidth = 1;
          c.setLineDash([3, 3]);
          c.beginPath();
          c.moveTo(ph.x, ph.y);
          c.lineTo(player.x, player.y);
          c.stroke();
          c.setLineDash([]);
          /* "!" */
          c.fillStyle = C.red;
          c.font = 'bold 16px monospace';
          c.textAlign = 'center';
          c.shadowColor = 'rgba(0,0,0,0.9)';
          c.shadowBlur = 4;
          c.fillText('!', ph.x, ph.y - 22);
          c.shadowBlur = 0;
          c.textAlign = 'left';
        }
      }

      /* Player */
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(player.x, player.y + 12, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.save();
      if (player.iframes > 0 && Math.floor(player.iframes / 3) % 2) c.globalAlpha = 0.5;
      drawSprite(c, 'player_' + player.dir, player.x - 16, player.y - 16, 32, 32);
      c.restore();

      /* Slash */
      if (player.attack) {
        const a = player.attack;
        const angle = a.dir === 'right' ? 0 : a.dir === 'down' ? Math.PI / 2
                    : a.dir === 'left' ? Math.PI : -Math.PI / 2;
        const swing = (a.frame / 14) * Math.PI - Math.PI / 2;
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

      /* Flash di alert (cornice rossa pulsante) */
      if (scene._alertFlash > 0) {
        c.strokeStyle = `rgba(255,40,40,${scene._alertFlash / 40})`;
        c.lineWidth = 6;
        c.strokeRect(3, 3, CANVAS_W - 6, CANVAS_H - 6);
      }

      /* Info Floor */
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(CANVAS_W - 96, 16, 88, 16);
      c.fillStyle = '#fff8c0';
      c.font = 'bold 11px monospace';
      c.textAlign = 'center';
      c.fillText(`PIANO B${floorIdx + 1}`, CANVAS_W - 52, 28);
      c.textAlign = 'left';
    },

    pullToast() { const tt = scene._toast; scene._toast = null; return tt; },
    getDialog() { return scene.dialog; },
    dispose() { /* nothing */ },
  });

  return scene;
}
