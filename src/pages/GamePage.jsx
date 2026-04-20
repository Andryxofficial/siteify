/**
 * GamePage — Modular game shell.
 *
 * Loads the game module for the current month from src/games/registry.js
 * and provides: Twitch OAuth, canvas, touch/keyboard controls, score/HP HUD,
 * and a season-based leaderboard with archive.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Twitch, LogIn, RotateCcw, Trophy, Calendar, Crown, Award, Zap, Keyboard,
} from 'lucide-react';
import SEO from '../components/SEO';
import { getGameForMonth, loadGameModule, getAllGameMetas } from '../games/registry';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;

/* ─── Season key helper: each month = a unique "season" ─── */
function getSeasonKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ─── Twitch OAuth helpers ─── */
function getTwitchLoginUrl() {
  const redirect = window.location.origin + '/gioco';
  return (
    `https://id.twitch.tv/oauth2/authorize?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=token&scope=user:read:email`
  );
}

const C = {
  player: '#00f5d4',
  heart: '#FF0050',
  text: '#f0ecf4',
  textMuted: '#a8a3b3',
  exit: '#FFD700',
};

export default function GamePage() {
  /* ─── Current month & game module ─── */
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const gameEntry = getGameForMonth(currentMonth);
  const gameMeta = gameEntry.meta;

  /* ─── Refs for game engine communication ─── */
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 });
  const joystickDivRef = useRef(null);
  const actionBtnRef = useRef(false);
  const startGameRef = useRef(null);
  const cleanupRef = useRef(null);

  /* ─── State ─── */
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | gameover
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [, setHp] = useState(0);
  const [, setMaxHp] = useState(0);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Twitch auth
  const [twitchUser, setTwitchUser] = useState(null);
  const [twitchToken, setTwitchToken] = useState(null);
  const [submitMsg, setSubmitMsg] = useState('');

  // Leaderboard
  const [weeklyBoard, setWeeklyBoard] = useState([]);
  const [monthlyBoard, setMonthlyBoard] = useState([]);
  const [generalBoard, setGeneralBoard] = useState([]);
  const [archiveData, setArchiveData] = useState([]);
  const [boardTab, setBoardTab] = useState('weekly');
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');

  /* ─── Twitch auth on mount ─── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('twitchGameToken', token);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    const saved = localStorage.getItem('twitchGameToken');
    if (saved) {
      setTwitchToken(saved);
      fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${saved}` },
      })
        .then(r => {
          if (!r.ok) throw new Error('Token expired');
          return r.json();
        })
        .then(d => setTwitchUser(d.login))
        .catch(() => {
          localStorage.removeItem('twitchGameToken');
          setTwitchToken(null);
        });
    }
  }, []);

  /* ─── Fetch leaderboard ─── */
  const fetchBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError('');
    try {
      const seasonKey = getSeasonKey();
      const r = await fetch(`/api/leaderboard?season=${seasonKey}`);
      if (!r.ok) throw new Error('Fetch failed');
      const data = await r.json();
      setWeeklyBoard(data.weekly || []);
      setMonthlyBoard(data.monthly || []);
      setGeneralBoard(data.general || []);
      setArchiveData(data.archive || []);
    } catch {
      setBoardError('Impossibile caricare la classifica.');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  /* ─── Submit score ─── */
  const submitScore = useCallback(async (finalScore) => {
    if (!twitchToken || !twitchUser) return;
    setSubmitMsg('Invio punteggio…');
    try {
      const seasonKey = getSeasonKey();
      const r = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ score: finalScore, season: seasonKey }),
      });
      const data = await r.json();
      setSubmitMsg(data.message || 'Punteggio inviato!');
      fetchBoard();
    } catch {
      setSubmitMsg('Errore nell\'invio del punteggio.');
    }
  }, [twitchToken, twitchUser, fetchBoard]);

  /* ─── Create game engine (caricamento dinamico) ─── */
  const gameModuleRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    /* Pre-carica il modulo gioco del mese corrente */
    loadGameModule(currentMonth).then(mod => { gameModuleRef.current = mod; });

    startGameRef.current = async () => {
      setScore(0);
      setHp(0);
      setMaxHp(0);
      setSubmitMsg('');

      /* Se non ancora caricato, carica ora */
      if (!gameModuleRef.current) {
        gameModuleRef.current = await loadGameModule(currentMonth);
      }

      const cleanup = gameModuleRef.current.createGame(canvasRef.current, {
        keysRef,
        joystickRef,
        actionBtnRef,
        onScore: (s) => setScore(s),
        onHpChange: (h, m) => { setHp(h); setMaxHp(m); },
        onGameOver: (finalScore) => {
          setScore(finalScore);
          setGameStatus('gameover');
          if (finalScore > highScore) setHighScore(finalScore);
          submitScore(finalScore);
        },
        onInfo: () => {},
      });
      return cleanup;
    };
  }, [currentMonth, highScore, submitScore]);

  /* ─── Start/stop game on status change ─── */
  useEffect(() => {
    if (gameStatus === 'playing') {
      const avvia = async () => {
        cleanupRef.current = await startGameRef.current();
      };
      avvia();
    }
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, [gameStatus]);

  /* ─── Keyboard listeners ─── */
  useEffect(() => {
    const down = (e) => {
      keysRef.current[e.key] = true;
      // Prevent page scroll when playing
      if (gameStatus === 'playing' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const up = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keysRef.current = {};
    };
  }, [gameStatus]);

  /* ─── Gamepad API polling ─── */
  const gamepadFrameRef = useRef(null);
  const prevGamepadBtns = useRef({});
  useEffect(() => {
    function pollGamepad() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        // Left stick → joystick
        const lx = gp.axes[0] ?? 0;
        const ly = gp.axes[1] ?? 0;
        const deadzone = 0.15;
        if (Math.abs(lx) > deadzone || Math.abs(ly) > deadzone) {
          joystickRef.current = { active: true, dx: lx, dy: ly };
        } else if (joystickRef.current.active && !joystickRef.current._touch) {
          joystickRef.current = { active: false, dx: 0, dy: 0 };
        }
        // D-pad (buttons 12-15 or axes)
        const k = keysRef.current;
        k['ArrowUp'] = gp.buttons[12]?.pressed || k['ArrowUp'] || k['w'] || k['W'] || false;
        k['ArrowDown'] = gp.buttons[13]?.pressed || k['ArrowDown'] || k['s'] || k['S'] || false;
        k['ArrowLeft'] = gp.buttons[14]?.pressed || k['ArrowLeft'] || k['a'] || k['A'] || false;
        k['ArrowRight'] = gp.buttons[15]?.pressed || k['ArrowRight'] || k['d'] || k['D'] || false;
        // Face buttons → action (A=0, B=1, X=2, Y=3) + space
        const actionPressed = gp.buttons[0]?.pressed || gp.buttons[2]?.pressed;
        const prev = prevGamepadBtns.current;
        if (actionPressed && !prev.action) {
          actionBtnRef.current = true;
        }
        prev.action = actionPressed;
        // Shoulder/trigger → action too
        if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed || gp.buttons[6]?.pressed || gp.buttons[7]?.pressed) {
          actionBtnRef.current = true;
        }
        // Right stick → also maps to joystick as alternative
        const rx = gp.axes[2] ?? 0;
        const ry = gp.axes[3] ?? 0;
        if (Math.abs(rx) > deadzone || Math.abs(ry) > deadzone) {
          joystickRef.current = { active: true, dx: rx, dy: ry };
        }
        break; // Use first connected gamepad
      }
      gamepadFrameRef.current = requestAnimationFrame(pollGamepad);
    }
    gamepadFrameRef.current = requestAnimationFrame(pollGamepad);
    return () => {
      if (gamepadFrameRef.current) cancelAnimationFrame(gamepadFrameRef.current);
    };
  }, []);

  /* ─── Touch handlers (ultra-responsive) ─── */
  const joystickTouchId = useRef(null);
  const joystickCenterRef = useRef({ cx: 0, cy: 0, r: 0 });

  const onJoystickStart = useCallback((e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (t) {
      joystickTouchId.current = t.identifier;
      // Use the actual touch position as the joystick centre (floating joystick)
      const el = joystickDivRef.current;
      const r = el ? el.getBoundingClientRect().width / 2 : 60;
      joystickCenterRef.current = { cx: t.clientX, cy: t.clientY, r };
      joystickRef.current = { active: true, dx: 0, dy: 0, _touch: true };
    }
  }, []);

  const onJoystickMove = useCallback((e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId.current) {
        const { cx, cy, r } = joystickCenterRef.current;
        let dx = (t.clientX - cx) / r;
        let dy = (t.clientY - cy) / r;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 1) { dx /= mag; dy /= mag; }
        joystickRef.current = { active: true, dx, dy, _touch: true };
        break;
      }
    }
  }, []);

  const onJoystickEnd = useCallback((e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        joystickRef.current = { active: false, dx: 0, dy: 0 };
        break;
      }
    }
  }, []);

  /* ─── Native touch listeners on joystick element (passive:false ensures preventDefault works) ─── */
  useEffect(() => {
    const el = joystickDivRef.current;
    if (!el) return;
    el.addEventListener('touchstart', onJoystickStart, { passive: false });
    el.addEventListener('touchmove', onJoystickMove, { passive: false });
    el.addEventListener('touchend', onJoystickEnd, { passive: false });
    el.addEventListener('touchcancel', onJoystickEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onJoystickStart);
      el.removeEventListener('touchmove', onJoystickMove);
      el.removeEventListener('touchend', onJoystickEnd);
      el.removeEventListener('touchcancel', onJoystickEnd);
    };
  }, [onJoystickStart, onJoystickMove, onJoystickEnd]);

  const onActionBtn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    actionBtnRef.current = true;
  }, []);

  /* ─── Also handle tap-anywhere on canvas for "tap" games ─── */
  const onCanvasTouch = useCallback((e) => {
    if (gameMeta.controls === 'tap' && gameStatus === 'playing') {
      e.preventDefault();
      actionBtnRef.current = true;
      keysRef.current[' '] = true;
      setTimeout(() => { keysRef.current[' '] = false; }, 80);
    }
  }, [gameMeta.controls, gameStatus]);

  function handleLogout() {
    localStorage.removeItem('twitchGameToken');
    setTwitchUser(null);
    setTwitchToken(null);
  }

  const themeColor = gameMeta.color || C.player;

  return (
    <div
      className="main-content"
      style={{ maxWidth: '960px' }}
    >
      <SEO
        title={`${gameMeta.emoji} ${gameMeta.name} — Gioco del mese`}
        description={gameMeta.description}
        path="/gioco"
        keywords="minigioco browser, gioco online gratuito, classifica twitch, arcade game italiano"
      />

      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 className="title">
          <span className="text-gradient">{gameMeta.emoji} {gameMeta.name}</span>
        </h1>
        <p className="subtitle">{gameMeta.description}</p>
      </header>

      <div className="game-layout">
        <div className="game-area">
          <div className="glass-panel game-canvas-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={480}
              height={480}
              className="game-canvas"
              onTouchStart={onCanvasTouch}
              style={{ touchAction: 'none' }}
            />

            {/* Idle overlay */}
            {gameStatus === 'idle' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <span style={{ fontSize: '3rem' }}>{gameMeta.emoji}</span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.5rem 0' }}>{gameMeta.name}</h2>
                  <p style={{ color: C.textMuted, fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto 0.75rem' }}>
                    {gameMeta.instructions}
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
                    <p style={{ color: themeColor, fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 700 }}>
                      🎮 Loggato come <strong>{twitchUser}</strong>
                    </p>
                  )}

                  <button onClick={() => setGameStatus('playing')} className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                    {gameMeta.emoji} Gioca!
                  </button>
                </div>
              </div>
            )}

            {/* Game over overlay */}
            {gameStatus === 'gameover' && (
              <div className="game-overlay">
                <div className="game-overlay-content">
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.heart }}>{gameMeta.gameOverTitle}</h2>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>✦ {score}</p>
                  {highScore > 0 && (
                    <p style={{ fontSize: '0.8rem', color: C.textMuted }}>Record personale: {highScore}</p>
                  )}
                  {submitMsg && (
                    <p style={{ fontSize: '0.82rem', color: themeColor, marginTop: '0.5rem' }}>{submitMsg}</p>
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

          {/* Touch controls (mobile) — ultra responsive */}
          <div className="game-touch-controls" style={{ touchAction: 'none' }}>
            <div
              ref={joystickDivRef}
              className="game-joystick"
              style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <div className="game-joystick-knob" style={{
                transform: `translate(${joystickRef.current.dx * 28}px, ${joystickRef.current.dy * 28}px)`,
                transition: joystickRef.current.active ? 'none' : 'transform 0.1s ease-out',
              }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className={`game-kb-toggle ${showKeyboard ? 'active' : ''}`}
                onClick={() => setShowKeyboard(v => !v)}
                title="Toggle tastiera"
              >
                <Keyboard size={18} />
              </button>
              <button
                className="game-attack-btn"
                onTouchStart={onActionBtn}
                onTouchEnd={(e) => e.preventDefault()}
                onPointerDown={onActionBtn}
                style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {gameMeta.actionLabel}
              </button>
            </div>
          </div>

          {showKeyboard && (
            <p className="game-controls-hint" style={{ display: 'block' }}>
              🎮 {gameMeta.instructions}
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="game-sidebar">
          {/* Twitch login (compact) */}
          <div className="glass-panel" style={{ padding: '1rem 1.2rem' }}>
            {twitchUser ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Twitch size={16} color="#9146FF" />
                  <span style={{ fontSize: '0.85rem', color: themeColor, fontWeight: 700 }}>
                    {twitchUser}
                  </span>
                </div>
                <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}>
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Twitch size={16} color="#9146FF" style={{ flexShrink: 0 }} />
                {CHIAVETWITCH ? (
                  <a href={getTwitchLoginUrl()} className="btn" style={{
                    background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                    color: '#fff', fontSize: '0.78rem', padding: '0.4rem 0.9rem',
                    boxShadow: '0 4px 16px rgba(145,70,255,.3)',
                    flex: 1, justifyContent: 'center',
                  }}>
                    <LogIn size={13} /> Login con Twitch
                  </a>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: C.textMuted }}>Login non disponibile</span>
                )}
              </div>
            )}
          </div>

          {/* Calendario Giochi — 12 months with #1 player — ABOVE leaderboard */}
          <GameCalendar archiveData={archiveData} monthlyBoard={monthlyBoard} />

          {/* Leaderboard */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Trophy size={18} color="#FFD700" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Classifica</h3>
            </div>

            <div className="leaderboard-tabs">
              <button className={`leaderboard-tab${boardTab === 'weekly' ? ' active' : ''}`} onClick={() => setBoardTab('weekly')}>
                <Calendar size={13} /> Sett.
              </button>
              <button className={`leaderboard-tab${boardTab === 'monthly' ? ' active' : ''}`} onClick={() => setBoardTab('monthly')}>
                <Award size={13} /> Mensile
              </button>
              <button className={`leaderboard-tab${boardTab === 'general' ? ' active' : ''}`} onClick={() => setBoardTab('general')}>
                <Crown size={13} /> Generale
              </button>
            </div>

            {boardLoading ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted, textAlign: 'center', padding: '1rem 0' }}>Caricamento…</p>
            ) : boardError ? (
              <p style={{ fontSize: '0.82rem', color: C.heart, textAlign: 'center', padding: '1rem 0' }}>{boardError}</p>
            ) : boardTab === 'monthly' ? (
              <MonthlyTab monthlyBoard={monthlyBoard} archiveData={archiveData} twitchUser={twitchUser} />
            ) : (boardTab === 'weekly' ? weeklyBoard : generalBoard).length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted }}>
                {boardTab === 'weekly'
                  ? 'Nessun punteggio questa settimana. Sii il primo!'
                  : 'Classifica generale vuota. Gioca per entrare!'}
              </p>
            ) : (
              <div className="leaderboard-list">
                {(boardTab === 'weekly' ? weeklyBoard : generalBoard).map((entry, i) => (
                  <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ─── */

function LeaderboardEntry({ entry, rank, twitchUser }) {
  const isMe = twitchUser === entry.username;
  return (
    <div className="leaderboard-entry" style={{
      background: rank === 0 ? 'rgba(255,215,0,0.08)' : rank === 1 ? 'rgba(192,192,192,0.06)' : rank === 2 ? 'rgba(205,127,50,0.06)' : 'transparent',
      borderLeft: rank < 3 ? `3px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][rank]}` : '3px solid transparent',
    }}>
      <span className="leaderboard-rank">{rank < 3 ? ['🥇', '🥈', '🥉'][rank] : `${rank + 1}.`}</span>
      <span className="leaderboard-name" style={{ color: isMe ? C.player : C.text, fontWeight: isMe ? 800 : 600 }}>
        {entry.username}{isMe && ' (tu)'}
      </span>
      <span className="leaderboard-score">✦ {entry.score}</span>
    </div>
  );
}

function MonthlyTab({ monthlyBoard, archiveData, twitchUser }) {
  const now = new Date();
  const currentLabel = `${['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const hasCurrent = monthlyBoard && monthlyBoard.length > 0;
  const hasHistory = archiveData && archiveData.length > 0;
  if (!hasCurrent && !hasHistory) {
    return <p style={{ fontSize: '0.82rem', color: C.textMuted }}>Nessun punteggio mensile ancora. Sii il primo!</p>;
  }
  return (
    <div className="leaderboard-list">
      {hasCurrent && (
        <div className="monthly-winners-block">
          <div className="monthly-winners-header" style={{ color: C.player }}>
            <Zap size={13} /> {currentLabel} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(in corso)</span>
          </div>
          {monthlyBoard.map((entry, i) => (
            <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
          ))}
        </div>
      )}
      {hasHistory && archiveData.map((month) => (
        <div key={month.season} className="monthly-winners-block">
          <div className="monthly-winners-header"><Award size={14} /> {month.label}</div>
          {month.top3.map((entry, i) => (
            <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
          ))}
        </div>
      ))}
    </div>
  );
}

function GameCalendar({ archiveData, monthlyBoard }) {
  const allMetas = getAllGameMetas();
  const currentMonth = new Date().getUTCMonth() + 1;

  // Build a map of month → #1 player from archive data
  const topByMonth = {};
  if (archiveData) {
    for (const entry of archiveData) {
      if (entry.top3 && entry.top3.length > 0) {
        topByMonth[entry.monthNum] = entry.top3[0];
      }
    }
  }
  // Current month from live monthly data
  if (monthlyBoard && monthlyBoard.length > 0) {
    topByMonth[currentMonth] = monthlyBoard[0];
  }

  return (
    <div className="glass-panel" style={{ padding: '1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <Zap size={18} color="#FFD700" />
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Calendario Giochi</h3>
      </div>
      <p style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: '0.75rem', opacity: 0.7 }}>
        Un gioco nuovo ogni mese. Il 🥇 viene mostrato accanto a chi è primo!
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {allMetas.map((m) => {
          const isCurrent = m.month === currentMonth;
          const isPast = m.month < currentMonth;
          const top1 = topByMonth[m.month];
          return (
            <div
              key={m.month}
              className="game-calendar-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                background: isCurrent ? 'rgba(0,245,212,0.06)' : 'transparent',
                borderLeft: isCurrent ? `3px solid ${m.color}` : '3px solid transparent',
                opacity: isPast && !isCurrent ? 0.55 : 1,
              }}
            >
              <span style={{ fontSize: '1rem', width: '22px', textAlign: 'center', flexShrink: 0 }}>{m.emoji}</span>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: isCurrent ? 800 : 600,
                color: isCurrent ? C.player : C.text,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {m.name}
              </span>
              {top1 ? (
                <span style={{
                  fontSize: '0.72rem',
                  color: isCurrent ? m.color : '#FFD700',
                  fontWeight: 700,
                  flexShrink: 0,
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  🥇 {top1.username}
                </span>
              ) : isCurrent ? (
                <span style={{
                  fontSize: '0.6rem',
                  background: `${m.color}22`,
                  color: m.color,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  flexShrink: 0,
                  letterSpacing: '0.03em',
                }}>
                  ORA
                </span>
              ) : isPast ? (
                <span style={{ fontSize: '0.68rem', color: C.textMuted, opacity: 0.5, flexShrink: 0 }}>—</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
