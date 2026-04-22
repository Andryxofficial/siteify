/**
 * GamePage — Modular game shell.
 *
 * Loads the game module for the current month from src/games/registry.js
 * and provides: Twitch OAuth, canvas, touch/keyboard controls, score/HP HUD,
 * and a season-based leaderboard with archive.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Twitch, LogIn, RotateCcw, Trophy, Calendar, Crown, Award, Zap, Keyboard, WifiOff,
  Maximize2, Minimize2, Backpack, FlaskConical, Wand2,
} from 'lucide-react';
import SEO from '../components/SEO';
import { getGameForMonth, loadGameModule, getAllGameMetas } from '../games/registry';
import { meta as legendMeta, hasSave as hasLegendSave, clearSave as clearLegendSave, setLegendLang, getTranslatedMeta as getLegendTranslatedMeta } from '../games/legend/index.js';
import { meta as platformMeta, hasSave as hasPlatformSave, clearSave as clearPlatformSave, setPlatformLang, getTranslatedMeta as getPlatformTranslatedMeta } from '../games/platform/index.js';
import { useReti } from '../contexts/RetiContext';
import { useLingua } from '../contexts/LinguaContext';
import useWakeLock from '../hooks/useWakeLock';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;

/* Coda di punteggi salvati offline, sincronizzati al ritorno online. */
const CHIAVE_CODA_OFFLINE = 'andryxify_coda_punteggi_offline';
/* Massimo punteggi accodati offline. Cap per evitare bloat di localStorage:
   l'utente medio non gioca >20 partite consecutive senza connessione. */
const MAX_CODA_PUNTEGGI = 20;

function leggiCodaOffline() {
  try {
    const raw = localStorage.getItem(CHIAVE_CODA_OFFLINE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function salvaCodaOffline(coda) {
  try { localStorage.setItem(CHIAVE_CODA_OFFLINE, JSON.stringify(coda)); }
  catch { /* quota piena: ignoriamo silenziosamente */ }
}
function aggiungiACoda(elemento) {
  const coda = leggiCodaOffline();
  coda.push(elemento);
  if (coda.length > MAX_CODA_PUNTEGGI) coda.splice(0, coda.length - MAX_CODA_PUNTEGGI);
  salvaCodaOffline(coda);
}

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

/* C — palette del gioco. text/textMuted usano CSS variables per seguire il
   tema chiaro/scuro; gli altri sono colori vivaci leggibili su entrambi. */
const C = {
  player: '#00f5d4',
  heart: '#FF0050',
  text: 'var(--text-main)',
  textMuted: 'var(--text-muted)',
  exit: '#FFD700',
};

export default function GamePage() {
  const location = useLocation();
  const { online } = useReti();
  const { lingua } = useLingua();

  /* Sincronizza la lingua dei motori Andryx Legend e Andryx Jump con
     quella del sito. I motori sono JS puri e non usano i contesti React:
     leggiamo `lingua` da useLingua e lo propaghiamo ai moduli ogni volta
     che cambia (es. utente cambia lingua dalle Impostazioni). I dialoghi
     aperti dopo questo momento saranno nella nuova lingua; quelli già in
     corso restano nella lingua in cui sono stati aperti. */
  useEffect(() => {
    try { setLegendLang(lingua); } catch { /* no-op */ }
    try { setPlatformLang(lingua); } catch { /* no-op */ }
  }, [lingua]);

  /* ─── Current month & game module ─── */
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1; // 1-12

  /* ─── Modalita` di gioco: 'monthly' (gioco del mese), 'legend' (Andryx Legend),
        'platform' (Andryx Jump — platformer 2D originale a scorrimento laterale,
        10 mondi a tema Andryx). Ognuno ha la sua classifica server-side dedicata. ─── */
  const [modalitaGioco, setModalitaGioco] = useState('monthly');
  const isLegend = modalitaGioco === 'legend';
  const isPlatform = modalitaGioco === 'platform';
  const isStandalone = isLegend || isPlatform;

  /* ─── Mese selezionato per giocare (default = mese corrente).
        I mesi diversi da quello corrente vengono giocati in
        "Modalità Prova": niente invio in classifica.
        Nei giochi standalone (Legend/Platform) questa scelta non e` rilevante. ─── */
  const [meseSelezionato, setMeseSelezionato] = useState(currentMonth);
  const isModalitaProva = !isStandalone && meseSelezionato !== currentMonth;

  const monthlyEntry = getGameForMonth(meseSelezionato);
  /* Meta di Legend con testi tradotti nella lingua attiva.
     Chiamiamo `setLegendLang(lingua)` sincronamente prima di leggere il
     meta tradotto, così la prima render dopo un cambio di lingua mostra
     già i testi corretti (l'useEffect sopra mantiene lo stesso valore,
     quindi è idempotente). La dipendenza su `lingua` è implicita: viene
     letta dentro l'IIFE e passata a setLegendLang. */
  const legendMetaTradotta = (() => {
    try { setLegendLang(lingua); return getLegendTranslatedMeta(); }
    catch { return legendMeta; }
  })();
  /* Meta di Platform tradotta — stesso pattern di Legend. */
  const platformMetaTradotta = (() => {
    try { setPlatformLang(lingua); return getPlatformTranslatedMeta(); }
    catch { return platformMeta; }
  })();
  const gameMeta = isLegend ? legendMetaTradotta
                : isPlatform ? platformMetaTradotta
                : monthlyEntry.meta;

  /* Stato "ho un salvataggio?" — uno per ciascun gioco standalone. */
  const [legendSaveAvailable, setLegendSaveAvailable] = useState(() => {
    try { return hasLegendSave(); } catch { return false; }
  });
  const [platformSaveAvailable, setPlatformSaveAvailable] = useState(() => {
    try { return hasPlatformSave(); } catch { return false; }
  });

  /* ─── Refs for game engine communication ─── */
  const canvasRef = useRef(null);
  const gameAreaRef = useRef(null);
  const keysRef = useRef({});
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 });
  const joystickDivRef = useRef(null);
  const actionBtnRef = useRef(false);
  const secondaryBtnRef = useRef(false);
  const inventoryBtnRef = useRef(false);
  const potionBtnRef = useRef(false);
  const startGameRef = useRef(null);
  const cleanupRef = useRef(null);

  /* ─── State ─── */
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | gameover
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [, setHp] = useState(0);
  const [, setMaxHp] = useState(0);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Wake Lock — mantiene lo schermo acceso durante una partita,
     così non si spegne dopo i 30s di inattività di Android/iOS. */
  useWakeLock(gameStatus === 'playing');

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

  /* ─── Fetch leaderboard (separata per modalita`) ─── */
  const fetchBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError('');
    try {
      const seasonKey = getSeasonKey();
      const gameParam = isLegend ? '&game=legend'
                       : isPlatform ? '&game=platform'
                       : '';
      const r = await fetch(`/api/leaderboard?season=${seasonKey}${gameParam}`);
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
  }, [isLegend, isPlatform]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  /* ─── Scroll alla classifica se l'hash URL lo richiede ─── */
  useEffect(() => {
    if (!boardLoading && location.hash === '#classifica') {
      document.getElementById('classifica')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [boardLoading, location.hash]);

  /* ─── Submit score ─── */
  const submitScore = useCallback(async (finalScore) => {
    if (!twitchToken || !twitchUser) return;
    /* In Modalità Prova non inviamo il punteggio in classifica. */
    if (isModalitaProva) {
      setSubmitMsg('🎮 Modalità Prova — punteggio non registrato in classifica.');
      return;
    }
    const seasonKey = getSeasonKey();
    const gameParam = isLegend ? 'legend' : isPlatform ? 'platform' : 'monthly';
    /* Offline: accoda il punteggio per inviarlo al ritorno della rete. */
    if (!online) {
      aggiungiACoda({ score: finalScore, season: seasonKey, game: gameParam, token: twitchToken, ts: Date.now() });
      setSubmitMsg('📡 Offline — punteggio salvato, verrà inviato al ritorno della rete.');
      return;
    }
    setSubmitMsg('Invio punteggio…');
    try {
      const r = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ score: finalScore, season: seasonKey, game: gameParam }),
      });
      const data = await r.json();
      setSubmitMsg(data.message || 'Punteggio inviato!');
      fetchBoard();
    } catch {
      /* Fallita per qualunque motivo (DNS, fetch abort) → accoda anche qui */
      aggiungiACoda({ score: finalScore, season: seasonKey, game: gameParam, token: twitchToken, ts: Date.now() });
      setSubmitMsg('Errore rete — punteggio salvato, verrà inviato più tardi.');
    }
  }, [twitchToken, twitchUser, fetchBoard, isModalitaProva, online, isLegend, isPlatform]);

  /* ─── Sync coda offline al ritorno della rete ─── */
  useEffect(() => {
    if (!online || !twitchToken) return;
    const coda = leggiCodaOffline();
    if (coda.length === 0) return;
    let cancellato = false;
    (async () => {
      const rimasti = [];
      for (const item of coda) {
        if (cancellato) { rimasti.push(item); continue; }
        try {
          const r = await fetch('/api/leaderboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${item.token || twitchToken}`,
            },
            body: JSON.stringify({ score: item.score, season: item.season, game: item.game || 'monthly' }),
          });
          if (!r.ok) rimasti.push(item);
        } catch {
          rimasti.push(item);
        }
      }
      if (cancellato) return;
      salvaCodaOffline(rimasti);
      const inviati = coda.length - rimasti.length;
      if (inviati > 0) {
        setSubmitMsg(`✅ Sincronizzati ${inviati} punteggi offline.`);
        fetchBoard();
      }
    })();
    return () => { cancellato = true; };
  }, [online, twitchToken, fetchBoard]);

  /* ─── Create game engine (caricamento dinamico) ─── */
  const gameModuleRef = useRef(null);
  /* Quando si avvia un gioco standalone con save, l'utente puo` scegliere "continua partita". */
  const legendContinueRef = useRef(false);
  const platformContinueRef = useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    /* Pre-carica il modulo gioco appropriato (standalone o mese selezionato).
       Invalida il riferimento precedente per forzare ricaricamento al cambio modalita`.
       NB: il chunk `platform` viene scaricato SOLO quando l'utente seleziona
       Andryx Jump (e il primo `import()` accade qui). All'apertura della pagina
       /gioco l'utente vede solo l'hub: nessun chunk platform viene scaricato. */
    gameModuleRef.current = null;
    const loader = isLegend
      ? import('../games/legend/index.js').then(m => ({ createGame: m.createGame, meta: m.meta }))
      : isPlatform
      ? import('../games/platform/index.js').then(m => ({ createGame: m.createGame, meta: m.meta }))
      : loadGameModule(meseSelezionato);
    loader
      .then(mod => { gameModuleRef.current = mod; })
      .catch(() => { /* pre-caricamento fallito, verrà riprovato in startGame */ });

    startGameRef.current = async () => {
      setScore(0);
      setHp(0);
      setMaxHp(0);
      setSubmitMsg('');

      /* Se non ancora caricato, carica ora */
      try {
        if (!gameModuleRef.current) {
          gameModuleRef.current = isLegend
            ? await import('../games/legend/index.js').then(m => ({ createGame: m.createGame, meta: m.meta }))
            : isPlatform
            ? await import('../games/platform/index.js').then(m => ({ createGame: m.createGame, meta: m.meta }))
            : await loadGameModule(meseSelezionato);
        }
      } catch {
        setSubmitMsg('Errore nel caricamento del gioco. Controlla la connessione e riprova.');
        return;
      }

      /* Opzioni extra per giochi standalone (ignorate dai giochi mensili). */
      const extraOpts = isLegend
        ? { continueSave: legendContinueRef.current, fresh: !legendContinueRef.current }
        : isPlatform
        ? { continueSave: platformContinueRef.current, fresh: !platformContinueRef.current }
        : undefined;

      const cleanup = gameModuleRef.current.createGame(canvasRef.current, {
        keysRef,
        joystickRef,
        actionBtnRef,
        secondaryBtnRef,
        inventoryBtnRef,
        potionBtnRef,
        onScore: (s) => setScore(s),
        onHpChange: (h, m) => { setHp(h); setMaxHp(m); },
        onGameOver: (finalScore) => {
          setScore(finalScore);
          setGameStatus('gameover');
          if (finalScore > highScore) setHighScore(finalScore);
          submitScore(finalScore);
          /* Aggiorna lo stato di "save disponibile" — i giochi standalone cancellano il save su game-over */
          if (isLegend) {
            try { setLegendSaveAvailable(hasLegendSave()); } catch { /* ignored */ }
          } else if (isPlatform) {
            try { setPlatformSaveAvailable(hasPlatformSave()); } catch { /* ignored */ }
          }
        },
        onInfo: () => {},
      }, extraOpts);
      return cleanup;
    };
  }, [meseSelezionato, highScore, submitScore, isLegend, isPlatform]);

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
      // Prevent page scroll/focus jump when playing
      if (gameStatus === 'playing' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab'].includes(e.key)) {
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
        // Face buttons → action (A=0, X=2) + space
        const actionPressed = gp.buttons[0]?.pressed || gp.buttons[2]?.pressed;
        const prev = prevGamepadBtns.current;
        if (actionPressed && !prev.action) {
          actionBtnRef.current = true;
        }
        prev.action = actionPressed;
        // Bottone B (1) e Y (3) → azione secondaria
        const secondaryPressed = gp.buttons[1]?.pressed || gp.buttons[3]?.pressed;
        if (secondaryPressed && !prev.secondary) {
          secondaryBtnRef.current = true;
        }
        prev.secondary = secondaryPressed;
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
  /* Ref diretto al knob: aggiorniamo il DOM senza passare da React
     per avere feedback visivo immediato senza re-render. */
  const joystickKnobRef = useRef(null);

  const onJoystickStart = useCallback((e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t || !joystickDivRef.current) return;
    joystickTouchId.current = t.identifier;
    const r = joystickDivRef.current.getBoundingClientRect().width / 2;
    joystickCenterRef.current = { cx: t.clientX, cy: t.clientY, r };
    joystickRef.current = { active: true, dx: 0, dy: 0, _touch: true };
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
        /* Aggiornamento DOM diretto: 0 lag visivo */
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
          joystickKnobRef.current.style.transition = 'none';
        }
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
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
          joystickKnobRef.current.style.transition = 'transform 0.18s cubic-bezier(.34,1.56,.64,1)';
        }
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

  /* ─── Fullscreen esclusivo del canvas wrapper ───
        Usa la Fullscreen API (con fallback webkit). Mostra Maximize quando
        non in fullscreen e Minimize altrimenti. Lo stato `isFullscreen`
        si sincronizza tramite l'evento `fullscreenchange`. */
  const toggleFullscreen = useCallback(() => {
    const el = gameAreaRef.current;
    if (!el) return;
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          const p = req.call(el);
          if (p && typeof p.catch === 'function') p.catch(() => { /* permesso negato/denied */ });
        } catch { /* ignored */ }
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try {
          const p = exit.call(document);
          if (p && typeof p.catch === 'function') p.catch(() => { /* ignored */ });
        } catch { /* ignored */ }
      }
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(!!fs);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const onActionBtnPress = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    actionBtnRef.current = true;
    e.currentTarget?.classList?.add('pressed');
  }, []);

  const onActionBtnRelease = useCallback((e) => {
    e.preventDefault();
    e.currentTarget?.classList?.remove('pressed');
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

  /* ─── Selezione mese da calendario.
        Se è in corso una partita, la interrompe e torna allo stato idle. ─── */
  const selezionaMese = useCallback((mese) => {
    if (mese === meseSelezionato) return;
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setGameStatus('idle');
    setScore(0);
    setSubmitMsg('');
    setMeseSelezionato(mese);
  }, [meseSelezionato]);

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

      {/* ─── Hub modalita`: gioco del mese vs Andryx Legend vs Andryx Jump ─── */}
      <div className="game-mode-hub" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <button
          type="button"
          onClick={() => {
            if (gameStatus === 'playing') return;
            setModalitaGioco('monthly');
            setGameStatus('idle');
            setSubmitMsg('');
          }}
          className="glass-card"
          aria-pressed={modalitaGioco === 'monthly'}
          style={{
            cursor: gameStatus === 'playing' ? 'not-allowed' : 'pointer',
            padding: '0.75rem',
            textAlign: 'left',
            border: modalitaGioco === 'monthly' ? `1.5px solid ${monthlyEntry.meta.color || C.player}` : '1.5px solid var(--vetro-bordo-color, rgba(130,170,240,0.14))',
            opacity: gameStatus === 'playing' && modalitaGioco !== 'monthly' ? 0.5 : 1,
            transition: 'opacity 0.2s, border 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>🗓️</span>
            <strong style={{ fontSize: '0.95rem', color: C.text }}>Gioco del Mese</strong>
            {modalitaGioco === 'monthly' && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: monthlyEntry.meta.color || C.player, fontWeight: 700 }}>● ATTIVO</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.4 }}>
            {monthlyEntry.meta.emoji} {monthlyEntry.meta.name} — cambia ogni mese, classifica competitiva
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            if (gameStatus === 'playing') return;
            setModalitaGioco('legend');
            setGameStatus('idle');
            setSubmitMsg('');
            try { setLegendSaveAvailable(hasLegendSave()); } catch { /* ignored */ }
          }}
          className="glass-card"
          aria-pressed={isLegend}
          style={{
            cursor: gameStatus === 'playing' ? 'not-allowed' : 'pointer',
            padding: '0.75rem',
            textAlign: 'left',
            border: isLegend ? `1.5px solid ${legendMeta.color}` : '1.5px solid var(--vetro-bordo-color, rgba(130,170,240,0.14))',
            opacity: gameStatus === 'playing' && !isLegend ? 0.5 : 1,
            transition: 'opacity 0.2s, border 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>{legendMeta.emoji}</span>
            <strong style={{ fontSize: '0.95rem', color: C.text }}>{legendMeta.name}</strong>
            {isLegend && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: legendMeta.color, fontWeight: 700 }}>● ATTIVO</span>}
            {legendSaveAvailable && !isLegend && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--accent-warm, #ffb86c)', fontWeight: 700 }}>⏵ SAVE</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.4 }}>
            {legendMetaTradotta.hubDescription}
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            if (gameStatus === 'playing') return;
            setModalitaGioco('platform');
            setGameStatus('idle');
            setSubmitMsg('');
            try { setPlatformSaveAvailable(hasPlatformSave()); } catch { /* ignored */ }
          }}
          className="glass-card"
          aria-pressed={isPlatform}
          style={{
            cursor: gameStatus === 'playing' ? 'not-allowed' : 'pointer',
            padding: '0.75rem',
            textAlign: 'left',
            border: isPlatform ? `1.5px solid ${platformMeta.color}` : '1.5px solid var(--vetro-bordo-color, rgba(130,170,240,0.14))',
            opacity: gameStatus === 'playing' && !isPlatform ? 0.5 : 1,
            transition: 'opacity 0.2s, border 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>{platformMeta.emoji}</span>
            <strong style={{ fontSize: '0.95rem', color: C.text }}>{platformMeta.name}</strong>
            {isPlatform && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: platformMeta.color, fontWeight: 700 }}>● ATTIVO</span>}
            {platformSaveAvailable && !isPlatform && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--accent-warm, #ffb86c)', fontWeight: 700 }}>⏵ SAVE</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.4 }}>
            {platformMetaTradotta.hubDescription}
          </div>
        </button>
      </div>

      {isModalitaProva && (
        <div className="trial-banner" role="status">
          <span className="trial-banner-pill">🎮 Modalità Prova</span>
          <span className="trial-banner-text">
            Stai provando un gioco di un altro mese — i punteggi <strong>non vengono registrati in classifica</strong>.
          </span>
          <button
            type="button"
            className="trial-banner-btn"
            onClick={() => selezionaMese(currentMonth)}
          >
            Torna al gioco del mese →
          </button>
        </div>
      )}

      <div className="game-layout">
        <div ref={gameAreaRef} className={`game-area${isFullscreen ? ' is-fullscreen' : ''}`}>
          {/* Toolbar sopra il canvas (fuori dal wrapper di gioco) — contiene
              il bottone schermo intero. Sta volutamente FUORI dal canvas-wrapper
              cosi` non copre mai l'HUD del gioco ne` gli overlay idle/game-over. */}
          <div className="game-toolbar">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="game-fullscreen-btn"
              aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
              title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="game-fullscreen-btn-label">
                {isFullscreen ? 'Esci' : 'Schermo intero'}
              </span>
            </button>
          </div>

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

                  {isModalitaProva && (
                    <p style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(255,184,108,0.12)',
                      color: 'var(--accent-warm)',
                      border: '1px solid rgba(255,184,108,0.28)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                    }}>
                      🎮 Modalità Prova — punteggio non in classifica
                    </p>
                  )}

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

                  {isLegend && legendSaveAvailable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { legendContinueRef.current = true; setGameStatus('playing'); }}
                        className="btn btn-primary"
                        style={{ fontSize: '1rem', padding: '0.75rem 2rem', minWidth: '220px' }}
                      >
                        ⏵ Continua avventura
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm('Iniziare una nuova partita? Il salvataggio attuale verra` cancellato.')) return;
                          try { clearLegendSave(); } catch { /* ignored */ }
                          legendContinueRef.current = false;
                          setLegendSaveAvailable(false);
                          setGameStatus('playing');
                        }}
                        className="btn"
                        style={{
                          fontSize: '0.85rem', padding: '0.5rem 1.5rem',
                          background: 'rgba(255,80,80,0.12)',
                          color: '#ff8080',
                          border: '1px solid rgba(255,80,80,0.3)',
                          minWidth: '220px',
                        }}
                      >
                        🆕 Nuova partita
                      </button>
                    </div>
                  ) : isPlatform && platformSaveAvailable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { platformContinueRef.current = true; setGameStatus('playing'); }}
                        className="btn btn-primary"
                        style={{ fontSize: '1rem', padding: '0.75rem 2rem', minWidth: '220px' }}
                      >
                        ⏵ Continua avventura
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm('Iniziare una nuova partita? Il salvataggio attuale verra` cancellato.')) return;
                          try { clearPlatformSave(); } catch { /* ignored */ }
                          platformContinueRef.current = false;
                          setPlatformSaveAvailable(false);
                          setGameStatus('playing');
                        }}
                        className="btn"
                        style={{
                          fontSize: '0.85rem', padding: '0.5rem 1.5rem',
                          background: 'rgba(255,80,80,0.12)',
                          color: '#ff8080',
                          border: '1px solid rgba(255,80,80,0.3)',
                          minWidth: '220px',
                        }}
                      >
                        🆕 Nuova partita
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (isLegend) legendContinueRef.current = false;
                        if (isPlatform) platformContinueRef.current = false;
                        setGameStatus('playing');
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
                    >
                      {gameMeta.emoji} Gioca!
                    </button>
                  )}
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
              {/* Indicatori direzionali */}
              <div className="game-joystick-dirs">
                <span>▲</span><span>▶</span><span>▼</span><span>◀</span>
              </div>
              <div ref={joystickKnobRef} className="game-joystick-knob" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className={`game-kb-toggle ${showKeyboard ? 'active' : ''}`}
                onClick={() => setShowKeyboard(v => !v)}
                title="Toggle tastiera"
              >
                <Keyboard size={18} />
              </button>
              {isStandalone && (
                <>
                  <button
                    className="game-kb-toggle"
                    onClick={() => { inventoryBtnRef.current = true; }}
                    title="Inventario (I)"
                    aria-label="Inventario"
                  >
                    <Backpack size={18} />
                  </button>
                  <button
                    className="game-kb-toggle"
                    onClick={() => { potionBtnRef.current = true; }}
                    title="Usa pozione (P)"
                    aria-label="Usa pozione"
                  >
                    <FlaskConical size={18} />
                  </button>
                  {isPlatform && (
                    <button
                      className="game-kb-toggle"
                      onClick={() => { secondaryBtnRef.current = true; }}
                      title="Corsa (Shift)"
                      aria-label="Corsa"
                    >
                      <Wand2 size={18} />
                    </button>
                  )}
                </>
              )}
              <button
                className="game-attack-btn"
                onTouchStart={onActionBtnPress}
                onTouchEnd={onActionBtnRelease}
                onTouchCancel={onActionBtnRelease}
                onPointerDown={onActionBtnPress}
                onPointerUp={onActionBtnRelease}
                style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                <span className="game-attack-label">{gameMeta.actionLabel}</span>
                <span className="game-attack-letter">A</span>
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
          {/* Badge offline — mostrato quando l'utente perde la rete */}
          {!online && (
            <div className="glass-panel" style={{
              padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.55rem',
              borderColor: 'rgba(255,107,107,0.4)',
            }}>
              <WifiOff size={14} style={{ color: '#ff6b6b', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Modalità offline — i punteggi verranno sincronizzati al ritorno della rete.
              </span>
            </div>
          )}

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
          <GameCalendar
            archiveData={archiveData}
            monthlyBoard={monthlyBoard}
            meseSelezionato={meseSelezionato}
            onSelezionaMese={selezionaMese}
          />

          {/* Leaderboard */}
          <div id="classifica" className="glass-panel" style={{ padding: '1.2rem' }}>
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

function GameCalendar({ archiveData, monthlyBoard, meseSelezionato, onSelezionaMese }) {
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
      <p style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: '0.75rem', opacity: 0.8, lineHeight: 1.5 }}>
        Un gioco nuovo ogni mese. Clicca un titolo per <strong style={{ color: C.text }}>provarlo in Modalità Prova</strong> —
        solo il gioco del mese corrente registra punteggi in classifica.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {allMetas.map((m) => {
          const isCurrent = m.month === currentMonth;
          const isSelected = m.month === meseSelezionato;
          const isPast = m.month < currentMonth;
          const top1 = topByMonth[m.month];
          /* Bordo: priorità al mese selezionato, poi al mese corrente. */
          const coloreBordo = isSelected
            ? m.color
            : isCurrent
              ? `${m.color}88`
              : 'transparent';
          const sfondo = isSelected
            ? `${m.color}18`
            : isCurrent
              ? 'rgba(0,245,212,0.04)'
              : 'transparent';
          return (
            <button
              type="button"
              key={m.month}
              className="game-calendar-row"
              onClick={() => onSelezionaMese && onSelezionaMese(m.month)}
              title={isCurrent
                ? `${m.name} — Gioco del mese, punteggi in classifica`
                : `${m.name} — Modalità Prova (no classifica)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                background: sfondo,
                opacity: isPast && !isCurrent && !isSelected ? 0.65 : 1,
                /* reset stile bottone nativo */
                border: 'none',
                borderLeft: `3px solid ${coloreBordo}`,
                color: 'inherit',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '1rem', width: '22px', textAlign: 'center', flexShrink: 0 }}>{m.emoji}</span>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: isSelected || isCurrent ? 800 : 600,
                color: isSelected ? m.color : isCurrent ? C.player : C.text,
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
              ) : isSelected ? (
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
                  PROVA
                </span>
              ) : isPast ? (
                <span style={{ fontSize: '0.68rem', color: C.textMuted, opacity: 0.5, flexShrink: 0 }}>—</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
