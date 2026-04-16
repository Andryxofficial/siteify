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
import { getGameForMonth, getGameMeta, getAllGameMetas } from '../games/registry';

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
  const gameModule = getGameForMonth(currentMonth);
  const gameMeta = gameModule.meta;

  /* ─── Refs for game engine communication ─── */
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 });
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
  const [alltimeBoard, setAlltimeBoard] = useState([]);
  const [currentMonthData, setCurrentMonthData] = useState(null);
  const [monthlyWinners, setMonthlyWinners] = useState([]);
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
      setAlltimeBoard(data.alltime || []);
      setCurrentMonthData(data.currentMonth || null);
      setMonthlyWinners(data.monthlyWinners || []);
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

  /* ─── Create game engine ─── */
  useEffect(() => {
    if (!canvasRef.current) return;

    startGameRef.current = () => {
      setScore(0);
      setHp(0);
      setMaxHp(0);
      setSubmitMsg('');

      const cleanup = gameModule.createGame(canvasRef.current, {
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
  }, [gameModule, highScore, submitScore]);

  /* ─── Start/stop game on status change ─── */
  useEffect(() => {
    if (gameStatus === 'playing') {
      cleanupRef.current = startGameRef.current();
    }
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, [gameStatus]);

  /* ─── Keyboard listeners ─── */
  useEffect(() => {
    const down = (e) => { keysRef.current[e.key] = true; };
    const up = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keysRef.current = {};
    };
  }, []);

  /* ─── Touch handlers ─── */
  const onJoystickStart = (e) => {
    e.preventDefault();
    joystickRef.current.active = true;
  };
  const onJoystickMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (t.clientX - cx) / (rect.width / 2);
    let dy = (t.clientY - cy) / (rect.height / 2);
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    joystickRef.current.dx = dx;
    joystickRef.current.dy = dy;
  };
  const onJoystickEnd = () => {
    joystickRef.current = { active: false, dx: 0, dy: 0 };
  };
  const onActionBtn = (e) => {
    e.preventDefault();
    actionBtnRef.current = true;
  };

  function handleLogout() {
    localStorage.removeItem('twitchGameToken');
    setTwitchUser(null);
    setTwitchToken(null);
  }

  const themeColor = gameMeta.color || C.player;

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
        title={`${gameMeta.emoji} ${gameMeta.name} — Gioco del mese`}
        description={gameMeta.description}
        path="/gioco"
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
            <canvas ref={canvasRef} width={480} height={480} className="game-canvas" />

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
              <button
                className={`game-kb-toggle ${showKeyboard ? 'active' : ''}`}
                onClick={() => setShowKeyboard(v => !v)}
                title="Toggle tastiera"
              >
                <Keyboard size={18} />
              </button>
              <button className="game-attack-btn" onTouchStart={onActionBtn}>
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
          {/* Twitch */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Twitch size={18} color="#9146FF" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Account Twitch</h3>
            </div>
            {twitchUser ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: themeColor, fontWeight: 700, marginBottom: '0.5rem' }}>
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

          {/* Game of the month info */}
          <div className="glass-panel" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{gameMeta.emoji}</span>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Gioco del mese</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: C.textMuted, marginBottom: '0.5rem' }}>{gameMeta.description}</p>
            <div style={{ fontSize: '0.75rem', color: C.textMuted, opacity: 0.7 }}>
              Ogni mese un gioco diverso! Le classifiche mensili vengono archiviate automaticamente.
            </div>
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
              <button className={`leaderboard-tab${boardTab === 'archive' ? ' active' : ''}`} onClick={() => setBoardTab('archive')}>
                <Zap size={13} /> Archivio
              </button>
            </div>

            {boardLoading ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted, textAlign: 'center', padding: '1rem 0' }}>Caricamento…</p>
            ) : boardError ? (
              <p style={{ fontSize: '0.82rem', color: C.heart, textAlign: 'center', padding: '1rem 0' }}>{boardError}</p>
            ) : boardTab === 'archive' ? (
              <ArchiveTab archiveData={archiveData} twitchUser={twitchUser} />
            ) : boardTab === 'monthly' ? (
              <MonthlyTab currentMonthData={currentMonthData} monthlyWinners={monthlyWinners} twitchUser={twitchUser} />
            ) : (boardTab === 'weekly' ? weeklyBoard : alltimeBoard).length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: C.textMuted }}>
                {boardTab === 'weekly' ? 'Nessun punteggio questa settimana. Sii il primo!' : 'Nessun punteggio ancora. Sii il primo!'}
              </p>
            ) : (
              <div className="leaderboard-list">
                {(boardTab === 'weekly' ? weeklyBoard : alltimeBoard).map((entry, i) => (
                  <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
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

function MonthlyTab({ currentMonthData, monthlyWinners, twitchUser }) {
  const hasCurrentMonth = currentMonthData && currentMonthData.scores && currentMonthData.scores.length > 0;
  const hasHistory = monthlyWinners && monthlyWinners.length > 0;
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
            <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
          ))}
        </div>
      )}
      {hasHistory && monthlyWinners.map((month) => (
        <div key={month.month} className="monthly-winners-block">
          <div className="monthly-winners-header"><Award size={14} /> {month.label}</div>
          {month.top3.map((entry, i) => (
            <LeaderboardEntry key={entry.username} entry={entry} rank={i} twitchUser={twitchUser} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ArchiveTab({ archiveData, twitchUser }) {
  const allMetas = getAllGameMetas();
  if (!archiveData || archiveData.length === 0) {
    return (
      <div style={{ fontSize: '0.82rem', color: C.textMuted }}>
        <p style={{ marginBottom: '0.5rem' }}>L&apos;archivio conterrà le classifiche dei mesi precedenti.</p>
        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          Giochi disponibili:
        </p>
        {allMetas.map(m => (
          <div key={m.month} style={{ fontSize: '0.75rem', padding: '2px 0', opacity: m.month === (new Date().getUTCMonth() + 1) ? 1 : 0.5 }}>
            {m.emoji} {m.name} {m.month === (new Date().getUTCMonth() + 1) && <span style={{ color: C.player }}>← questo mese</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="leaderboard-list">
      {archiveData.map((entry) => {
        const meta = getGameMeta(entry.monthNum);
        return (
          <div key={entry.season} className="monthly-winners-block">
            <div className="monthly-winners-header">
              <span style={{ fontSize: '1rem' }}>{meta?.emoji || '🎮'}</span> {entry.label}
              {meta && <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '4px' }}>— {meta.name}</span>}
            </div>
            {entry.top3 && entry.top3.map((e, i) => (
              <LeaderboardEntry key={e.username} entry={e} rank={i} twitchUser={twitchUser} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
