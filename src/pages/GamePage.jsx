import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Twitch, Trophy, Sword, LogIn, RotateCcw, Calendar, Crown, Award, Zap, Keyboard } from 'lucide-react';
import SEO from '../components/SEO';

/* ─── Twitch OAuth config ─── */
const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;
const REDIRECT_URI = typeof window !== 'undefined'
  ? window.location.origin + '/gioco'
  : 'https://www.andryxify.it/gioco';

if (!CHIAVETWITCH) {
  console.warn('[GamePage] VITE_CHIAVETWITCH non configurata.');
}

function getTwitchLoginUrl() {
  if (!CHIAVETWITCH) return '#';
  return `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=user:read:email`;
}

/* ═══════════════════════════════════════════════════
   ANDRYX QUEST — Mini Zelda-like Dungeon Crawler
   ═══════════════════════════════════════════════════ */
const CANVAS_W = 480;
const CANVAS_H = 480;
const TILE = 32;
const COLS = CANVAS_W / TILE; // 15
const ROWS = CANVAS_H / TILE; // 15
const PLAYER_SPD = 2.4;
const ATTACK_DUR = 12;
const ATTACK_RANGE = 28;
const IFRAME_DUR = 40;

const C = {
  bg: '#0d1117',
  floor: '#1a1f2e',
  floorAlt: '#161b27',
  wall: '#2d3548',
  wallTop: '#3a4560',
  player: '#00f5d4',
  playerDark: '#00c4a8',
  sword: '#f0ecf4',
  swordGlow: 'rgba(0,245,212,0.6)',
  gem: '#FF00D4',
  gemGlow: 'rgba(255,0,212,0.5)',
  heart: '#FF0050',
  heartGlow: 'rgba(255,0,80,0.4)',
  slime: '#7c3aed',
  slimeGlow: 'rgba(124,58,237,0.4)',
  bat: '#f59e0b',
  batGlow: 'rgba(245,158,11,0.4)',
  ghost: '#06b6d4',
  ghostGlow: 'rgba(6,182,212,0.4)',
  text: '#f0ecf4',
  textMuted: '#a8a3b3',
  exit: '#FFD700',
  exitGlow: 'rgba(255,215,0,0.4)',
  particle: '#FF00D4',
};

/* Room generation: random dungeon room with walls and open spaces */
function generateRoom(roomNum) {
  // grid: 0=floor, 1=wall
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  // Border walls
  for (let x = 0; x < COLS; x++) { grid[0][x] = 1; grid[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { grid[y][0] = 1; grid[y][COLS - 1] = 1; }
  // Random inner pillars/walls (more walls in later rooms)
  const wallCount = 6 + Math.min(roomNum * 2, 14);
  for (let i = 0; i < wallCount; i++) {
    const x = 2 + Math.floor(Math.random() * (COLS - 4));
    const y = 2 + Math.floor(Math.random() * (ROWS - 4));
    grid[y][x] = 1;
    // Sometimes extend
    if (Math.random() < 0.5) {
      const dx = Math.random() < 0.5 ? 1 : 0;
      const dy = dx === 0 ? 1 : 0;
      if (y + dy < ROWS - 1 && x + dx < COLS - 1) grid[y + dy][x + dx] = 1;
    }
  }
  // Ensure spawn area (bottom-left) and exit area (top-right) are clear
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sy = ROWS - 3 + dy, sx = 2 + dx;
      const ey = 2 + dy, ex = COLS - 3 + dx;
      if (sy > 0 && sy < ROWS - 1 && sx > 0 && sx < COLS - 1) grid[sy][sx] = 0;
      if (ey > 0 && ey < ROWS - 1 && ex > 0 && ex < COLS - 1) grid[ey][ex] = 0;
    }
  }
  return grid;
}

function spawnEnemies(roomNum, grid) {
  const enemies = [];
  const count = Math.min(2 + roomNum, 10);
  const types = ['slime'];
  if (roomNum >= 2) types.push('bat');
  if (roomNum >= 4) types.push('ghost');
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = 2 + Math.floor(Math.random() * (COLS - 4));
      y = 2 + Math.floor(Math.random() * (ROWS - 4));
      tries++;
    } while ((grid[y][x] === 1 || (x < 4 && y > ROWS - 5)) && tries < 50);
    if (tries >= 50) continue;
    const type = types[Math.floor(Math.random() * types.length)];
    const baseHp = type === 'slime' ? 1 : type === 'bat' ? 1 : 2;
    const spd = type === 'slime' ? 0.6 : type === 'bat' ? 1.2 : 0.8;
    enemies.push({
      type,
      x: x * TILE + TILE / 2,
      y: y * TILE + TILE / 2,
      hp: baseHp + Math.floor(roomNum / 3),
      maxHp: baseHp + Math.floor(roomNum / 3),
      spd: spd + roomNum * 0.04,
      dir: Math.random() * Math.PI * 2,
      moveTimer: 0,
      hitFlash: 0,
      dead: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
  return enemies;
}

function spawnGems(roomNum, grid) {
  const gems = [];
  const count = 3 + Math.min(roomNum, 5);
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = 1 + Math.floor(Math.random() * (COLS - 2));
      y = 1 + Math.floor(Math.random() * (ROWS - 2));
      tries++;
    } while (grid[y][x] === 1 && tries < 40);
    if (tries >= 40) continue;
    gems.push({
      x: x * TILE + TILE / 2,
      y: y * TILE + TILE / 2,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
  return gems;
}

/* ─── Main Component ─── */
export default function GamePage() {
  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const animFrameRef = useRef(null);
  const keysRef = useRef({});

  const [twitchUser, setTwitchUser] = useState(null);
  const [twitchToken, setTwitchToken] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [roomNum, setRoomNum] = useState(0);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [weeklyBoard, setWeeklyBoard] = useState([]);
  const [alltimeBoard, setAlltimeBoard] = useState([]);
  const [monthlyWinners, setMonthlyWinners] = useState([]);
  const [currentMonthData, setCurrentMonthData] = useState(null);
  const [boardTab, setBoardTab] = useState('weekly');
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  /* ─── Touch joystick state ─── */
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 });
  const attackBtnRef = useRef(false);

  /* ─── Twitch token check ─── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('twitchGameToken', token);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    const savedToken = localStorage.getItem('twitchGameToken');
    if (savedToken) validateTwitchToken(savedToken);
    fetchLeaderboard();
  }, []);

  async function validateTwitchToken(token) {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTwitchUser(data.login);
        setTwitchToken(token);
      } else {
        localStorage.removeItem('twitchGameToken');
        setTwitchUser(null);
        setTwitchToken(null);
      }
    } catch { /* silent */ }
  }

  async function fetchLeaderboard() {
    setBoardLoading(true);
    setBoardError('');
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setWeeklyBoard(data.weekly || []);
      setAlltimeBoard(data.alltime || data.leaderboard || []);
      setMonthlyWinners(data.monthlyWinners || []);
      setCurrentMonthData(data.currentMonth || null);
    } catch (e) {
      console.error('fetchLeaderboard:', e);
      setBoardError('Impossibile caricare la classifica.');
    } finally {
      setBoardLoading(false);
    }
  }

  const submitScore = useCallback(async (finalScore) => {
    if (!twitchToken || submitting) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ score: finalScore }),
      });
      const data = await res.json();
      if (res.ok) { setSubmitMsg(data.message); fetchLeaderboard(); }
      else setSubmitMsg(data.error || 'Errore nel salvataggio.');
    } catch { setSubmitMsg('Errore di rete.'); }
    finally { setSubmitting(false); }
  }, [twitchToken, submitting]);

  /* ═══════════════════════════════════════════════════
     GAME ENGINE
     ═══════════════════════════════════════════════════ */
  const startGame = useCallback(() => {
    setGameStatus('playing');
    setScore(0);
    setRoomNum(0);
    setSubmitMsg('');

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    function initRoom(rn) {
      const grid = generateRoom(rn);
      return {
        grid,
        enemies: spawnEnemies(rn, grid),
        gems: spawnGems(rn, grid),
        exitOpen: false,
        exitX: (COLS - 3) * TILE + TILE / 2,
        exitY: 2 * TILE + TILE / 2,
      };
    }

    const room = initRoom(0);
    const state = {
      px: 2 * TILE + TILE / 2,
      py: (ROWS - 3) * TILE + TILE / 2,
      pdir: 0, // 0=right,1=down,2=left,3=up
      hp: 5,
      maxHp: 5,
      score: 0,
      roomNum: 0,
      attacking: 0,
      iframe: 0,
      ...room,
      particles: [],
      floatTexts: [],
      running: true,
      frame: 0,
      screenShake: 0,
      transition: 0,
    };
    gameStateRef.current = state;

    function wallAt(px, py, radius) {
      const r = radius || 10;
      const checks = [
        [px - r, py - r], [px + r, py - r],
        [px - r, py + r], [px + r, py + r],
      ];
      for (const [cx, cy] of checks) {
        const gx = Math.floor(cx / TILE);
        const gy = Math.floor(cy / TILE);
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
        if (state.grid[gy][gx] === 1) return true;
      }
      return false;
    }

    function addParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        state.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 1, decay: 0.025 + Math.random() * 0.03,
          color, size: 2 + Math.random() * 3,
        });
      }
    }

    function addFloatText(x, y, text, color) {
      state.floatTexts.push({ x, y, text, color, life: 1 });
    }

    function enterNextRoom() {
      state.transition = 30;
      state.roomNum++;
      const room = initRoom(state.roomNum);
      Object.assign(state, room);
      state.px = 2 * TILE + TILE / 2;
      state.py = (ROWS - 3) * TILE + TILE / 2;
      state.score += 100;
      // Heal 1 hp on room clear
      state.hp = Math.min(state.hp + 1, state.maxHp);
    }

    function getAttackPos() {
      const dist = ATTACK_RANGE;
      const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const [dx, dy] = dirs[state.pdir];
      return { x: state.px + dx * dist, y: state.py + dy * dist };
    }

    function update() {
      if (!state.running) return;
      state.frame++;

      if (state.transition > 0) {
        state.transition--;
        return;
      }

      // Input (keyboard via keysRef + touch joystick)
      const keys = keysRef.current;
      let mx = 0, my = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
      // Touch joystick override
      const joy = joystickRef.current;
      if (joy.active) {
        mx += joy.dx;
        my += joy.dy;
      }
      // Normalize
      const mag = Math.sqrt(mx * mx + my * my);
      if (mag > 0) {
        mx /= mag; my /= mag;
        // Update facing direction
        if (Math.abs(mx) > Math.abs(my)) state.pdir = mx > 0 ? 0 : 2;
        else state.pdir = my > 0 ? 1 : 3;
      }

      // Move player
      const spd = PLAYER_SPD;
      const nx = state.px + mx * spd;
      const ny = state.py + my * spd;
      if (!wallAt(nx, state.py)) state.px = nx;
      if (!wallAt(state.px, ny)) state.py = ny;

      // Attack
      if (state.attacking > 0) state.attacking--;
      if ((keys[' '] || keys['Space'] || attackBtnRef.current) && state.attacking === 0) {
        state.attacking = ATTACK_DUR;
        // Check hit enemies
        const ap = getAttackPos();
        for (const e of state.enemies) {
          if (e.dead) continue;
          const dx = e.x - ap.x, dy = e.y - ap.y;
          if (Math.sqrt(dx * dx + dy * dy) < 24) {
            e.hp--;
            e.hitFlash = 8;
            addParticles(e.x, e.y, '#fff', 4);
            state.screenShake = 4;
            if (e.hp <= 0) {
              e.dead = true;
              const pts = e.type === 'ghost' ? 30 : e.type === 'bat' ? 20 : 10;
              state.score += pts;
              addParticles(e.x, e.y, C[e.type + 'Glow'] || C.particle, 10);
              addFloatText(e.x, e.y - 10, `+${pts}`, C[e.type]);
            }
          }
        }
        attackBtnRef.current = false;
      }

      // iframes
      if (state.iframe > 0) state.iframe--;

      // Update enemies
      for (const e of state.enemies) {
        if (e.dead) continue;
        e.pulse = (e.pulse + 0.06) % (Math.PI * 2);
        if (e.hitFlash > 0) e.hitFlash--;
        e.moveTimer++;

        // AI movement
        if (e.type === 'slime') {
          if (e.moveTimer % 60 === 0) {
            e.dir = Math.atan2(state.py - e.y, state.px - e.x) + (Math.random() - 0.5) * 1.2;
          }
          if (e.moveTimer % 3 === 0) {
            const enx = e.x + Math.cos(e.dir) * e.spd;
            const eny = e.y + Math.sin(e.dir) * e.spd;
            if (!wallAt(enx, e.y, 8)) e.x = enx;
            if (!wallAt(e.x, eny, 8)) e.y = eny;
          }
        } else if (e.type === 'bat') {
          // Bat: fast, erratic
          if (e.moveTimer % 30 === 0) {
            e.dir = Math.atan2(state.py - e.y, state.px - e.x) + (Math.random() - 0.5) * 0.8;
          }
          const enx = e.x + Math.cos(e.dir) * e.spd;
          const eny = e.y + Math.sin(e.dir) * e.spd;
          if (!wallAt(enx, e.y, 6)) e.x = enx;
          if (!wallAt(e.x, eny, 6)) e.y = eny;
        } else if (e.type === 'ghost') {
          // Ghost: phases through walls, slow but relentless
          if (e.moveTimer % 45 === 0) {
            e.dir = Math.atan2(state.py - e.y, state.px - e.x);
          }
          e.x += Math.cos(e.dir) * e.spd;
          e.y += Math.sin(e.dir) * e.spd;
          // Keep in bounds
          e.x = Math.max(TILE, Math.min(e.x, w - TILE));
          e.y = Math.max(TILE, Math.min(e.y, h - TILE));
        }

        // Enemy-player collision
        if (state.iframe === 0) {
          const dx = state.px - e.x, dy = state.py - e.y;
          if (Math.sqrt(dx * dx + dy * dy) < 18) {
            state.hp--;
            state.iframe = IFRAME_DUR;
            state.screenShake = 8;
            addParticles(state.px, state.py, C.heart, 6);
            if (state.hp <= 0) {
              state.running = false;
            }
          }
        }
      }

      // Gems
      for (const g of state.gems) {
        if (g.collected) continue;
        g.pulse = (g.pulse + 0.05) % (Math.PI * 2);
        const dx = state.px - g.x, dy = state.py - g.y;
        if (Math.sqrt(dx * dx + dy * dy) < 16) {
          g.collected = true;
          state.score += 15;
          addParticles(g.x, g.y, C.gem, 6);
          addFloatText(g.x, g.y - 10, '+15', C.gem);
        }
      }

      // Check if exit should open (all enemies dead)
      if (!state.exitOpen && state.enemies.every(e => e.dead)) {
        state.exitOpen = true;
      }

      // Check exit collision
      if (state.exitOpen) {
        const dx = state.px - state.exitX, dy = state.py - state.exitY;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          enterNextRoom();
        }
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.96; p.vy *= 0.96;
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

      if (state.screenShake > 0) state.screenShake--;
    }

    function draw() {
      ctx.save();
      // Screen shake
      if (state.screenShake > 0) {
        const sx = (Math.random() - 0.5) * state.screenShake * 2;
        const sy = (Math.random() - 0.5) * state.screenShake * 2;
        ctx.translate(sx, sy);
      }

      // Room transition fade
      if (state.transition > 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1 - state.transition / 30;
      }

      // Floor
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const tx = x * TILE, ty = y * TILE;
          if (state.grid[y][x] === 1) {
            // Wall
            ctx.fillStyle = C.wall;
            ctx.fillRect(tx, ty, TILE, TILE);
            // Top highlight
            ctx.fillStyle = C.wallTop;
            ctx.fillRect(tx, ty, TILE, 4);
            // Edge lines
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, TILE - 1, TILE - 1);
          } else {
            // Floor tile with subtle checker
            ctx.fillStyle = (x + y) % 2 === 0 ? C.floor : C.floorAlt;
            ctx.fillRect(tx, ty, TILE, TILE);
            // Subtle dot pattern
            if ((x + y) % 3 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.02)';
              ctx.beginPath();
              ctx.arc(tx + TILE / 2, ty + TILE / 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Exit portal
      if (state.exitOpen) {
        const pulse = 0.7 + Math.sin(state.frame * 0.08) * 0.3;
        ctx.save();
        ctx.shadowColor = C.exitGlow;
        ctx.shadowBlur = 18 * pulse;
        ctx.fillStyle = C.exit;
        ctx.beginPath();
        ctx.arc(state.exitX, state.exitY, 12 * pulse, 0, Math.PI * 2);
        ctx.fill();
        // Inner swirl
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(state.exitX, state.exitY, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Arrow indicator
        ctx.fillStyle = C.exit;
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▼', state.exitX, state.exitY - 18 + Math.sin(state.frame * 0.1) * 3);
      }

      // Gems
      for (const g of state.gems) {
        if (g.collected) continue;
        const glow = 0.6 + Math.sin(g.pulse) * 0.3;
        ctx.save();
        ctx.shadowColor = C.gemGlow;
        ctx.shadowBlur = 10 * glow;
        ctx.fillStyle = C.gem;
        ctx.translate(g.x, g.y + Math.sin(g.pulse * 1.5) * 2);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      }

      // Enemies
      for (const e of state.enemies) {
        if (e.dead) continue;
        const glow = 0.6 + Math.sin(e.pulse) * 0.25;
        ctx.save();

        if (e.hitFlash > 0) {
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#fff';
        } else {
          ctx.shadowColor = C[e.type + 'Glow'];
          ctx.shadowBlur = 8 * glow;
          ctx.fillStyle = C[e.type];
        }

        if (e.type === 'slime') {
          // Slime: bouncy blob
          const squish = 1 + Math.sin(e.pulse * 2) * 0.15;
          ctx.translate(e.x, e.y);
          ctx.scale(squish, 2 - squish);
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(-4, -4, 3, 4);
          ctx.fillRect(2, -4, 3, 4);
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(-3, -2, 2, 3);
          ctx.fillRect(3, -2, 2, 3);
        } else if (e.type === 'bat') {
          // Bat: flappy wings
          const wing = Math.sin(e.pulse * 3) * 0.4;
          ctx.translate(e.x, e.y + Math.sin(e.pulse * 2) * 3);
          // Body
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          // Wings
          ctx.beginPath();
          ctx.moveTo(-7, -2);
          ctx.quadraticCurveTo(-16, -10 + wing * 15, -12, 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(7, -2);
          ctx.quadraticCurveTo(16, -10 + wing * 15, 12, 2);
          ctx.fill();
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(-4, -3, 2, 2);
          ctx.fillRect(2, -3, 2, 2);
        } else if (e.type === 'ghost') {
          // Ghost: ethereal, semi-transparent
          ctx.globalAlpha = 0.6 + Math.sin(e.pulse) * 0.2;
          ctx.translate(e.x, e.y + Math.sin(e.pulse) * 3);
          ctx.beginPath();
          ctx.arc(0, -3, 10, Math.PI, 0);
          ctx.lineTo(10, 8);
          // Wavy bottom
          for (let wx = 10; wx >= -10; wx -= 5) {
            ctx.lineTo(wx, 8 + (wx % 10 === 0 ? 4 : 0));
          }
          ctx.closePath();
          ctx.fill();
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(-3, -3, 3, 0, Math.PI * 2);
          ctx.arc(4, -3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1a1a2e';
          ctx.beginPath();
          ctx.arc(-2, -2, 1.5, 0, Math.PI * 2);
          ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // HP bar (if damaged)
        if (e.hp < e.maxHp && !e.dead) {
          const barW = 20, barH = 3;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(e.x - barW / 2, e.y - 18, barW, barH);
          ctx.fillStyle = C.heart;
          ctx.fillRect(e.x - barW / 2, e.y - 18, barW * (e.hp / e.maxHp), barH);
        }
      }

      // Player
      ctx.save();
      // Blink during iframes
      if (state.iframe > 0 && state.frame % 4 < 2) {
        ctx.globalAlpha = 0.3;
      }
      ctx.shadowColor = C.player;
      ctx.shadowBlur = 12;
      // Body
      ctx.fillStyle = C.player;
      ctx.beginPath();
      ctx.arc(state.px, state.py, 11, 0, Math.PI * 2);
      ctx.fill();
      // Inner
      ctx.fillStyle = C.playerDark;
      ctx.beginPath();
      ctx.arc(state.px, state.py, 7, 0, Math.PI * 2);
      ctx.fill();
      // Eyes (face direction)
      const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const [fdx, fdy] = dirs[state.pdir];
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.px + fdx * 4 - fdy * 2.5, state.py + fdy * 4 + fdx * 2.5, 2, 0, Math.PI * 2);
      ctx.arc(state.px + fdx * 4 + fdy * 2.5, state.py + fdy * 4 - fdx * 2.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Attack swing
      if (state.attacking > 0) {
        const ap = getAttackPos();
        const progress = 1 - state.attacking / ATTACK_DUR;
        const angle = state.pdir * Math.PI / 2 + (progress - 0.5) * Math.PI * 0.8;
        ctx.save();
        ctx.shadowColor = C.swordGlow;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = C.sword;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(state.px, state.py);
        ctx.lineTo(ap.x + Math.cos(angle) * 8, ap.y + Math.sin(angle) * 8);
        ctx.stroke();
        // Slash arc
        ctx.strokeStyle = `rgba(0,245,212,${0.6 * (1 - progress)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.px, state.py, ATTACK_RANGE, angle - 0.6, angle + 0.6);
        ctx.stroke();
        ctx.restore();
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
      // Hearts
      for (let i = 0; i < state.maxHp; i++) {
        const hx = 12 + i * 18;
        ctx.fillStyle = i < state.hp ? C.heart : 'rgba(255,0,80,0.2)';
        ctx.font = '14px sans-serif';
        ctx.fillText('♥', hx, 20);
      }
      // Score
      ctx.fillStyle = C.text;
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`✦ ${state.score}`, w - 12, 18);
      // Room number
      ctx.fillStyle = C.textMuted;
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillText(`Stanza ${state.roomNum + 1}`, w - 12, 34);
      ctx.textAlign = 'left';

      ctx.restore();
    }

    function gameLoop() {
      update();
      draw();
      setScore(state.score);
      setRoomNum(state.roomNum);

      if (state.running) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
      } else {
        const finalScore = state.score;
        setScore(finalScore);
        setGameStatus('gameover');
        setHighScore(prev => Math.max(prev, finalScore));
        if (twitchToken) submitScore(finalScore);
      }
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      state.running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [twitchToken, submitScore]);

  /* ─── Keyboard ─── */
  const gameStatusRef = useRef(gameStatus);
  gameStatusRef.current = gameStatus;

  useEffect(() => {
    function onDown(e) {
      if ((e.key === ' ' || e.key === 'Enter') && gameStatusRef.current !== 'playing') {
        e.preventDefault();
        setGameStatus('playing');
        return;
      }
      keysRef.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    }
    function onUp(e) { keysRef.current[e.key] = false; }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  /* ─── Touch joystick handlers ─── */
  const joystickTouchId = useRef(null);
  const joystickCenter = useRef({ x: 0, y: 0 });

  function onJoystickStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystickTouchId.current = t.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joystickRef.current = { active: true, dx: 0, dy: 0 };
  }
  function onJoystickMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId.current) {
        const dx = t.clientX - joystickCenter.current.x;
        const dy = t.clientY - joystickCenter.current.y;
        const max = 40;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, max);
        const angle = Math.atan2(dy, dx);
        joystickRef.current = {
          active: true,
          dx: (clamped / max) * Math.cos(angle),
          dy: (clamped / max) * Math.sin(angle),
        };
      }
    }
  }
  function onJoystickEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        joystickRef.current = { active: false, dx: 0, dy: 0 };
      }
    }
  }
  function onAttackBtn(e) {
    e.preventDefault();
    attackBtnRef.current = true;
  }

  /* ─── Lifecycle ─── */
  const cleanupRef = useRef(null);
  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;

  useEffect(() => {
    if (gameStatus === 'playing') {
      cleanupRef.current = startGameRef.current();
    }
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, [gameStatus]);

  function handleLogout() {
    localStorage.removeItem('twitchGameToken');
    setTwitchUser(null);
    setTwitchToken(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      className="main-content"
      style={{ maxWidth: '960px' }}
    >
      <SEO
        title="Andryx Quest — Minigioco Dungeon Crawler"
        description="Gioca ad Andryx Quest, il minigioco esclusivo di ANDRYXify! Esplora dungeon, sconfiggi nemici, raccogli gemme e scala la classifica. Login con Twitch per salvare il punteggio!"
        path="/gioco"
      />

      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 className="title">
          <span className="text-gradient">Andryx</span> Quest
        </h1>
        <p className="subtitle">
          Esplora i dungeon, sconfiggi i nemici{' '}
          <span style={{ color: C.slime }}>●</span>{' '}
          <span style={{ color: C.bat }}>●</span>{' '}
          <span style={{ color: C.ghost }}>●</span>, raccogli le gemme{' '}
          <span style={{ color: C.gem }}>◆</span> e avanza il più possibile!
        </p>
      </header>

      <div className="game-layout">
        <div className="game-area">
          <div className="glass-panel game-canvas-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="game-canvas"
            />

            {/* Idle overlay */}
            {gameStatus === 'idle' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <Sword size={48} color={C.player} />
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.5rem 0' }}>Andryx Quest</h2>
                  <p style={{ color: C.textMuted, fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto 0.75rem' }}>
                    Muoviti con il <strong>joystick</strong> (mobile) o <strong>WASD / frecce</strong>.<br />
                    Attacca con il <strong>pulsante ⚔️</strong> o <strong>Spazio</strong>.<br />
                    Sconfiggi tutti i nemici per sbloccare il portale!
                  </p>

                  {!twitchUser && !CHIAVETWITCH && (
                    <p style={{ color: '#FF0050', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                      ⚠️ Login Twitch non disponibile — VITE_CHIAVETWITCH non configurata.
                    </p>
                  )}
                  {!twitchUser && CHIAVETWITCH && (
                    <a href={getTwitchLoginUrl()} className="btn" style={{
                      background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                      color: '#fff', marginBottom: '0.75rem',
                      boxShadow: '0 5px 20px rgba(145,70,255,.4)',
                    }}>
                      <Twitch size={16} /> Login con Twitch
                    </a>
                  )}
                  {twitchUser && (
                    <p style={{ color: C.player, fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 700 }}>
                      🎮 Loggato come <strong>{twitchUser}</strong>
                    </p>
                  )}

                  <button onClick={() => setGameStatus('playing')} className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                    <Sword size={18} /> Gioca!
                  </button>
                </div>
              </div>
            )}

            {/* Game over overlay */}
            {gameStatus === 'gameover' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.heart }}>Sei caduto!</h2>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>
                    ✦ {score}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: C.textMuted, marginBottom: '0.25rem' }}>
                    Stanza raggiunta: <strong style={{ color: C.exit }}>{roomNum + 1}</strong>
                  </p>
                  {highScore > 0 && (
                    <p style={{ fontSize: '0.8rem', color: C.textMuted }}>
                      Record personale: {highScore}
                    </p>
                  )}
                  {submitMsg && (
                    <p style={{ fontSize: '0.82rem', color: C.player, marginTop: '0.5rem' }}>{submitMsg}</p>
                  )}
                  {!twitchUser && CHIAVETWITCH && (
                    <a href={getTwitchLoginUrl()} className="btn" style={{
                      background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                      color: '#fff', margin: '0.75rem 0',
                      boxShadow: '0 5px 20px rgba(145,70,255,.4)',
                    }}>
                      <LogIn size={16} /> Login per salvare il punteggio
                    </a>
                  )}
                  <button onClick={() => setGameStatus('playing')} className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
                    <RotateCcw size={16} /> Riprova
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Touch controls (mobile) */}
          <div className="game-touch-controls">
            <div
              className="game-joystick"
              onTouchStart={onJoystickStart}
              onTouchMove={onJoystickMove}
              onTouchEnd={onJoystickEnd}
            >
              <div className="game-joystick-knob" style={{
                transform: `translate(${joystickRef.current.dx * 20}px, ${joystickRef.current.dy * 20}px)`,
              }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {/* Keyboard toggle */}
              <button
                className={`game-kb-toggle ${showKeyboard ? 'active' : ''}`}
                onClick={() => setShowKeyboard(v => !v)}
                title="Toggle tastiera"
              >
                <Keyboard size={18} />
              </button>

              <button
                className="game-attack-btn"
                onTouchStart={onAttackBtn}
              >
                ⚔️
              </button>
            </div>
          </div>

          {showKeyboard && (
            <p className="game-controls-hint" style={{ display: 'block' }}>
              🎮 WASD / Frecce = muovi · Spazio = attacca
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="game-sidebar">
          {/* Twitch */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Twitch size={18} color="#9146FF" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Account Twitch</h3>
            </div>
            {twitchUser ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: C.player, fontWeight: 700, marginBottom: '0.5rem' }}>
                  ✓ {twitchUser}
                </p>
                <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}>
                  Logout
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.82rem', color: C.textMuted, marginBottom: '0.75rem' }}>
                  {CHIAVETWITCH
                    ? 'Accedi con Twitch per salvare i tuoi punteggi nella classifica!'
                    : '⚠️ Login Twitch non disponibile — configurazione mancante.'}
                </p>
                {CHIAVETWITCH && (
                  <a href={getTwitchLoginUrl()} className="btn" style={{
                    background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                    color: '#fff', fontSize: '0.82rem', padding: '0.5rem 1rem',
                    boxShadow: '0 5px 20px rgba(145,70,255,.4)',
                    width: '100%', justifyContent: 'center',
                  }}>
                    <Twitch size={14} /> Login con Twitch
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Trophy size={18} color="#FFD700" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Classifica</h3>
            </div>

            <div className="leaderboard-tabs">
              <button className={`leaderboard-tab${boardTab === 'weekly' ? ' active' : ''}`} onClick={() => setBoardTab('weekly')}>
                <Calendar size={13} /> Settimanale
              </button>
              <button className={`leaderboard-tab${boardTab === 'alltime' ? ' active' : ''}`} onClick={() => setBoardTab('alltime')}>
                <Crown size={13} /> Generale
              </button>
              <button className={`leaderboard-tab${boardTab === 'monthly' ? ' active' : ''}`} onClick={() => setBoardTab('monthly')}>
                <Award size={13} /> Mensili
              </button>
            </div>

            {boardLoading ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted, textAlign: 'center', padding: '1rem 0' }}>Caricamento…</p>
            ) : boardError ? (
              <p style={{ fontSize: '0.82rem', color: C.heart, textAlign: 'center', padding: '1rem 0' }}>{boardError}</p>
            ) : boardTab === 'monthly' ? (
              (() => {
                const hasCurrentMonth = currentMonthData && currentMonthData.scores.length > 0;
                const hasHistory = monthlyWinners.length > 0;
                if (!hasCurrentMonth && !hasHistory) {
                  return <p style={{ fontSize: '0.82rem', color: C.textMuted }}>Nessun punteggio mensile ancora. Sii il primo!</p>;
                }
                return (
                  <div className="leaderboard-list">
                    {hasCurrentMonth && (
                      <div className="monthly-winners-block">
                        <div className="monthly-winners-header" style={{ color: C.player }}>
                          <Zap size={13} /> {currentMonthData.label} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(in corso)</span>
                        </div>
                        {currentMonthData.scores.map((entry, i) => (
                          <div key={entry.username} className="leaderboard-entry" style={{
                            background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(192,192,192,0.06)' : i === 2 ? 'rgba(205,127,50,0.06)' : 'transparent',
                            borderLeft: i < 3 ? `3px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][i]}` : '3px solid transparent',
                          }}>
                            <span className="leaderboard-rank">{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span>
                            <span className="leaderboard-name" style={{ color: twitchUser === entry.username ? C.player : C.text, fontWeight: twitchUser === entry.username ? 800 : 600 }}>
                              {entry.username}{twitchUser === entry.username && ' (tu)'}
                            </span>
                            <span className="leaderboard-score">✦ {entry.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasHistory && monthlyWinners.map((month) => (
                      <div key={month.month} className="monthly-winners-block">
                        <div className="monthly-winners-header"><Award size={14} /> {month.label}</div>
                        {month.top3.map((entry, i) => (
                          <div key={entry.username} className="leaderboard-entry" style={{
                            background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(192,192,192,0.06)' : 'rgba(205,127,50,0.06)',
                            borderLeft: `3px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][i]}`,
                          }}>
                            <span className="leaderboard-rank">{['🥇', '🥈', '🥉'][i]}</span>
                            <span className="leaderboard-name" style={{ color: twitchUser === entry.username ? C.player : C.text, fontWeight: twitchUser === entry.username ? 800 : 600 }}>
                              {entry.username}{twitchUser === entry.username && ' (tu)'}
                            </span>
                            <span className="leaderboard-score">✦ {entry.score}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (boardTab === 'weekly' ? weeklyBoard : alltimeBoard).length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted }}>
                {boardTab === 'weekly' ? 'Nessun punteggio questa settimana. Sii il primo!' : 'Nessun punteggio ancora. Sii il primo!'}
              </p>
            ) : (
              <div className="leaderboard-list">
                {(boardTab === 'weekly' ? weeklyBoard : alltimeBoard).map((entry, i) => (
                  <div key={entry.username} className="leaderboard-entry" style={{
                    background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(192,192,192,0.06)' : i === 2 ? 'rgba(205,127,50,0.06)' : 'transparent',
                    borderLeft: i < 3 ? `3px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][i]}` : '3px solid transparent',
                  }}>
                    <span className="leaderboard-rank">{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span>
                    <span className="leaderboard-name" style={{ color: twitchUser === entry.username ? C.player : C.text, fontWeight: twitchUser === entry.username ? 800 : 600 }}>
                      {entry.username}{twitchUser === entry.username && ' (tu)'}
                    </span>
                    <span className="leaderboard-score">✦ {entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
