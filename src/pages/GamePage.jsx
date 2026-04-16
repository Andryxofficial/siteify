import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Twitch, Trophy, Zap, LogIn, RotateCcw } from 'lucide-react';
import SEO from '../components/SEO';

/* ─── Twitch OAuth config ─── */
const TWITCH_CLIENT_ID = 'q03bz5gqylkeqpk5hnqhg9g1k3sdla';
const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/gioco`
  : 'https://andryxify.it/gioco';

function getTwitchLoginUrl() {
  return `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=user:read:email`;
}

/* ─── Game constants ─── */
const CANVAS_W = 480;
const CANVAS_H = 640;
const LANE_COUNT = 3;
const PLAYER_SIZE = 22;
const OBSTACLE_SIZE = 20;
const SYNAPSE_SIZE = 16;
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.0008;
const SPAWN_INTERVAL_MIN = 40;
const SPAWN_INTERVAL_MAX = 80;

/* ─── Colors ─── */
const COLORS = {
  bg: '#070708',
  lane: 'rgba(255,255,255,0.03)',
  laneDiv: 'rgba(255,255,255,0.06)',
  player: '#00f5d4',
  playerGlow: 'rgba(0,245,212,0.5)',
  synapse: '#FF00D4',
  synapseGlow: 'rgba(255,0,212,0.5)',
  obstacle: '#FF0050',
  obstacleGlow: 'rgba(255,0,80,0.5)',
  network: 'rgba(145,70,255,0.08)',
  networkNode: 'rgba(145,70,255,0.15)',
  text: '#f0ecf4',
  textMuted: '#a8a3b3',
};

function laneX(lane, w) {
  const laneW = w / LANE_COUNT;
  return laneW * lane + laneW / 2;
}

/* ─── Main component ─── */
export default function GamePage() {
  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const animFrameRef = useRef(null);

  const [twitchUser, setTwitchUser] = useState(null);
  const [twitchToken, setTwitchToken] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | gameover
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  /* ─── Check Twitch token on mount ─── */
  useEffect(() => {
    // Check URL hash for token (redirect from Twitch)
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
    if (savedToken) {
      validateTwitchToken(savedToken);
    }

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
    } catch {
      /* silent */
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      /* silent */
    }
  }

  const submitScore = useCallback(async (finalScore) => {
    if (!twitchToken || submitting) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ score: finalScore }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitMsg(data.message);
        fetchLeaderboard();
      } else {
        setSubmitMsg(data.error || 'Errore nel salvataggio.');
      }
    } catch {
      setSubmitMsg('Errore di rete.');
    } finally {
      setSubmitting(false);
    }
  }, [twitchToken, submitting]);

  /* ─── Game engine ─── */
  const startGame = useCallback(() => {
    setGameStatus('playing');
    setScore(0);
    setSubmitMsg('');

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const state = {
      playerLane: 1,
      targetLane: 1,
      playerY: h - 80,
      playerX: laneX(1, w),
      speed: INITIAL_SPEED,
      distance: 0,
      score: 0,
      entities: [],
      spawnTimer: 0,
      spawnInterval: SPAWN_INTERVAL_MAX,
      networkNodes: generateNetworkNodes(w, h),
      particles: [],
      running: true,
      frame: 0,
    };
    gameStateRef.current = state;

    function generateNetworkNodes(width, height) {
      const nodes = [];
      for (let i = 0; i < 25; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 2 + Math.random() * 3,
          connections: [],
        });
      }
      // Create random connections
      for (let i = 0; i < nodes.length; i++) {
        const numConn = 1 + Math.floor(Math.random() * 2);
        for (let c = 0; c < numConn; c++) {
          const j = Math.floor(Math.random() * nodes.length);
          if (j !== i) nodes[i].connections.push(j);
        }
      }
      return nodes;
    }

    function spawnEntity() {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const isSynapse = Math.random() < 0.4;
      state.entities.push({
        type: isSynapse ? 'synapse' : 'obstacle',
        lane,
        x: laneX(lane, w),
        y: -30,
        size: isSynapse ? SYNAPSE_SIZE : OBSTACLE_SIZE,
        pulse: 0,
      });
    }

    function addParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        state.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 1,
          decay: 0.02 + Math.random() * 0.03,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function update() {
      if (!state.running) return;
      state.frame++;
      state.speed += SPEED_INCREMENT;
      state.distance += state.speed;
      state.score = Math.floor(state.distance / 10);

      // Smooth lane transition
      const targetX = laneX(state.targetLane, w);
      state.playerX += (targetX - state.playerX) * 0.18;
      state.playerLane = state.targetLane;

      // Spawn
      state.spawnTimer++;
      state.spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX - state.speed * 3);
      if (state.spawnTimer >= state.spawnInterval) {
        spawnEntity();
        state.spawnTimer = 0;
      }

      // Update entities
      for (let i = state.entities.length - 1; i >= 0; i--) {
        const e = state.entities[i];
        e.y += state.speed;
        e.pulse = (e.pulse + 0.08) % (Math.PI * 2);

        // Off screen
        if (e.y > h + 40) {
          state.entities.splice(i, 1);
          continue;
        }

        // Collision
        const dx = Math.abs(e.x - state.playerX);
        const dy = Math.abs(e.y - state.playerY);
        const hitDist = (PLAYER_SIZE + e.size) / 2;

        if (dx < hitDist && dy < hitDist) {
          if (e.type === 'synapse') {
            state.score += 25;
            addParticles(e.x, e.y, COLORS.synapse, 8);
            state.entities.splice(i, 1);
          } else {
            // Game over
            addParticles(state.playerX, state.playerY, COLORS.obstacle, 15);
            state.running = false;
          }
        }
      }

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Scroll network nodes
      for (const n of state.networkNodes) {
        n.y += state.speed * 0.3;
        if (n.y > h + 20) {
          n.y = -20;
          n.x = Math.random() * w;
        }
      }
    }

    function draw() {
      // Clear
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // Draw neural network background
      ctx.strokeStyle = COLORS.network;
      ctx.lineWidth = 0.5;
      for (const node of state.networkNodes) {
        for (const ci of node.connections) {
          const target = state.networkNodes[ci];
          if (target) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
      }
      for (const node of state.networkNodes) {
        ctx.fillStyle = COLORS.networkNode;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw lane dividers
      ctx.strokeStyle = COLORS.laneDiv;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = (w / LANE_COUNT) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw entities
      for (const e of state.entities) {
        const glow = 0.5 + Math.sin(e.pulse) * 0.3;
        if (e.type === 'synapse') {
          // Synapse: diamond shape
          ctx.save();
          ctx.shadowColor = COLORS.synapseGlow;
          ctx.shadowBlur = 12 * glow;
          ctx.fillStyle = COLORS.synapse;
          ctx.translate(e.x, e.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-e.size / 2, -e.size / 2, e.size, e.size);
          ctx.restore();
        } else {
          // Obstacle: hexagonal shape
          ctx.save();
          ctx.shadowColor = COLORS.obstacleGlow;
          ctx.shadowBlur = 14 * glow;
          ctx.fillStyle = COLORS.obstacle;
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const angle = (Math.PI / 3) * j - Math.PI / 6;
            const px = e.x + (e.size / 2) * Math.cos(angle);
            const py = e.y + (e.size / 2) * Math.sin(angle);
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw particles
      for (const p of state.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw player (neural signal)
      ctx.save();
      ctx.shadowColor = COLORS.playerGlow;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(state.playerX, state.playerY, PLAYER_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      // Inner core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.playerX, state.playerY, PLAYER_SIZE / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Trail effect
      ctx.fillStyle = `rgba(0,245,212,${0.08 + Math.sin(state.frame * 0.1) * 0.04})`;
      ctx.beginPath();
      ctx.arc(state.playerX, state.playerY + 12, PLAYER_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(0,245,212,0.04)`;
      ctx.beginPath();
      ctx.arc(state.playerX, state.playerY + 22, PLAYER_SIZE / 4, 0, Math.PI * 2);
      ctx.fill();

      // HUD
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ ${state.score}`, 16, 30);
    }

    function gameLoop() {
      update();
      draw();
      setScore(state.score);

      if (state.running) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
      } else {
        // Game over
        const finalScore = state.score;
        setScore(finalScore);
        setGameStatus('gameover');
        setHighScore(prev => Math.max(prev, finalScore));

        // Auto submit if logged in
        if (twitchToken) {
          submitScore(finalScore);
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      state.running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [twitchToken, submitScore]);

  /* ─── Input handlers ─── */
  useEffect(() => {
    function handleKeyDown(e) {
      const state = gameStateRef.current;
      if (!state || !state.running) return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        state.targetLane = Math.max(0, state.targetLane - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        state.targetLane = Math.min(LANE_COUNT - 1, state.targetLane + 1);
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleCanvasTouch(e) {
    const state = gameStateRef.current;
    if (!state || !state.running) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const mid = rect.width / 2;

    if (touchX < mid) {
      state.targetLane = Math.max(0, state.targetLane - 1);
    } else {
      state.targetLane = Math.min(LANE_COUNT - 1, state.targetLane + 1);
    }
  }

  function handleLogout() {
    localStorage.removeItem('twitchGameToken');
    setTwitchUser(null);
    setTwitchToken(null);
  }

  const cleanupRef = useRef(null);
  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;

  useEffect(() => {
    if (gameStatus === 'playing') {
      cleanupRef.current = startGameRef.current();
    }
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [gameStatus]);

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
        title="Neural Dash — Minigioco Arcade con Classifica"
        description="Gioca a Neural Dash, il minigioco esclusivo di ANDRYXify! Guida il segnale neurale, raccogli sinapsi, evita i nodi corrotti e scala la classifica. Login con Twitch per salvare il tuo punteggio!"
        path="/gioco"
      />

      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 className="title">
          <span className="text-gradient">Neural</span> Dash
        </h1>
        <p className="subtitle">
          Guida il segnale neurale attraverso la rete sinaptica. Raccogli le sinapsi{' '}
          <span style={{ color: COLORS.synapse }}>◆</span>, evita i nodi corrotti{' '}
          <span style={{ color: COLORS.obstacle }}>⬡</span> e scala la classifica!
        </p>
      </header>

      <div className="game-layout">
        {/* Game area */}
        <div className="game-area">
          <div className="glass-panel game-canvas-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="game-canvas"
              onTouchStart={handleCanvasTouch}
              onClick={handleCanvasTouch}
            />

            {/* Overlays */}
            {gameStatus === 'idle' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <Zap size={48} color={COLORS.player} />
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0' }}>Neural Dash</h2>
                  <p style={{ color: COLORS.textMuted, fontSize: '0.85rem', maxWidth: '300px', margin: '0 auto 1rem' }}>
                    Usa <strong>← →</strong> o tocca lo schermo per muoverti tra le corsie.
                  </p>

                  {!twitchUser && (
                    <a href={getTwitchLoginUrl()} className="btn" style={{
                      background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                      color: '#fff',
                      marginBottom: '0.75rem',
                      boxShadow: '0 5px 20px rgba(145,70,255,.4)',
                    }}>
                      <Twitch size={16} /> Login con Twitch
                    </a>
                  )}
                  {twitchUser && (
                    <p style={{ color: COLORS.player, fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 700 }}>
                      🎮 Loggato come <strong>{twitchUser}</strong>
                    </p>
                  )}

                  <button onClick={() => setGameStatus('playing')} className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                    <Zap size={18} /> Gioca!
                  </button>
                </div>
              </div>
            )}

            {gameStatus === 'gameover' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: COLORS.obstacle }}>Game Over!</h2>
                  <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0' }}>
                    ⚡ {score}
                  </p>
                  {highScore > 0 && (
                    <p style={{ fontSize: '0.8rem', color: COLORS.textMuted }}>
                      Record personale: {highScore}
                    </p>
                  )}

                  {submitMsg && (
                    <p style={{ fontSize: '0.82rem', color: COLORS.player, marginTop: '0.5rem' }}>{submitMsg}</p>
                  )}

                  {!twitchUser && (
                    <a href={getTwitchLoginUrl()} className="btn" style={{
                      background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                      color: '#fff',
                      margin: '0.75rem 0',
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

          {/* Controls hint (mobile) */}
          <p className="game-controls-hint">
            ← Tocca a sinistra / destra → per muoverti
          </p>
        </div>

        {/* Sidebar: Auth + Leaderboard */}
        <div className="game-sidebar">
          {/* Twitch login card */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Twitch size={18} color="#9146FF" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Account Twitch</h3>
            </div>
            {twitchUser ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: COLORS.player, fontWeight: 700, marginBottom: '0.5rem' }}>
                  ✓ {twitchUser}
                </p>
                <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}>
                  Logout
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.82rem', color: COLORS.textMuted, marginBottom: '0.75rem' }}>
                  Accedi con Twitch per salvare i tuoi punteggi nella classifica!
                </p>
                <a href={getTwitchLoginUrl()} className="btn" style={{
                  background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  padding: '0.5rem 1rem',
                  boxShadow: '0 5px 20px rgba(145,70,255,.4)',
                  width: '100%',
                  justifyContent: 'center',
                }}>
                  <Twitch size={14} /> Login con Twitch
                </a>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Trophy size={18} color="#FFD700" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Classifica</h3>
            </div>
            {leaderboard.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: COLORS.textMuted }}>
                Nessun punteggio ancora. Sii il primo!
              </p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry, i) => (
                  <div key={entry.username} className="leaderboard-entry" style={{
                    background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(192,192,192,0.06)' : i === 2 ? 'rgba(205,127,50,0.06)' : 'transparent',
                    borderLeft: i < 3 ? `3px solid ${i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32'}` : '3px solid transparent',
                  }}>
                    <span className="leaderboard-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="leaderboard-name" style={{
                      color: twitchUser === entry.username ? COLORS.player : COLORS.text,
                      fontWeight: twitchUser === entry.username ? 800 : 600,
                    }}>
                      {entry.username}
                      {twitchUser === entry.username && ' (tu)'}
                    </span>
                    <span className="leaderboard-score">⚡ {entry.score}</span>
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
