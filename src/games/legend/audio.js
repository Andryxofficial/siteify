/**
 * Audio sintetizzato per Andryx Legend.
 * Web Audio API — nessun asset esterno, tutti i suoni generati on the fly.
 *
 * Stile chip-tune semplice (square/triangle/noise) ispirato a GBA.
 * Volume rispetta una preferenza in localStorage.
 */

const VOL_KEY = 'andryxify_legend_volume';

let audioCtx = null;
let masterGain = null;
let musicNode = null;

function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = getSavedVolume();
    masterGain.connect(audioCtx.destination);
  } catch {
    return null;
  }
  return audioCtx;
}

function getSavedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.4;
  } catch {
    return 0.4;
  }
}

export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, String(vol)); } catch { /* ignored */ }
  if (masterGain) masterGain.gain.value = vol;
}

export function getVolume() { return getSavedVolume(); }

/** Suono generico: tono singolo con envelope. */
function tone(freq, dur = 0.1, type = 'square', vol = 0.5, slide = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ctx.currentTime + dur);
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(masterGain);
  o.start();
  o.stop(ctx.currentTime + dur);
}

/** Rumore (esplosioni, feriti). */
function noise(dur = 0.15, vol = 0.4) {
  const ctx = getCtx();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g); g.connect(masterGain);
  src.start();
}

/* ─── SFX api pubblica ─── */

export const SFX = {
  sword:    () => tone(880, 0.07, 'square', 0.18, 220),
  hit:      () => { tone(220, 0.08, 'square', 0.25); noise(0.05, 0.18); },
  enemyHit: () => tone(160, 0.1, 'square', 0.22, -60),
  death:    () => { tone(440, 0.18, 'sawtooth', 0.3, -300); noise(0.18, 0.2); },
  pickup:   () => { tone(880, 0.06, 'triangle', 0.3); setTimeout(() => tone(1320, 0.08, 'triangle', 0.3), 60); },
  rupee:    () => tone(1320, 0.1, 'triangle', 0.25, 100),
  heart:    () => { tone(660, 0.08, 'triangle', 0.3); setTimeout(() => tone(990, 0.1, 'triangle', 0.3), 70); },
  key:      () => { tone(880, 0.08, 'triangle', 0.3); setTimeout(() => tone(1100, 0.12, 'triangle', 0.3), 80); },
  door:     () => { tone(330, 0.15, 'sawtooth', 0.3, -110); noise(0.08, 0.12); },
  portal:   () => { tone(440, 0.2, 'triangle', 0.3, 220); setTimeout(() => tone(880, 0.2, 'triangle', 0.3, -440), 100); },
  bombSet:  () => tone(220, 0.05, 'square', 0.2),
  bomb:     () => { tone(110, 0.3, 'sawtooth', 0.4, -90); noise(0.4, 0.45); },
  text:     () => tone(660, 0.02, 'square', 0.08),
  menu:     () => tone(440, 0.04, 'square', 0.15),
  bossHit:  () => { tone(80, 0.18, 'sawtooth', 0.35, -30); noise(0.12, 0.22); },
  victory:  () => {
    [659, 784, 988, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.3), i * 90));
  },
  gameover: () => {
    [440, 330, 247, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.3), i * 130));
  },
};

/* ─── Musica di sottofondo (loop multistrato per zona) ───
   Ogni traccia definisce:
     - melody: sequenza note principale (semicrome)
     - bass:   linea di basso (note lunghe sotto)
     - mood:   forma d'onda della melodia (square/triangle/sine)
     - bpm:    velocita` (battiti per minuto)
     - swing:  frazione di swing (0 = retto, 0.2 = leggero swing)
   Le note sono in Hz; `0` = pausa. Le tracce sono melodicamente piu` ricche
   con variazioni di pattern A/B per evitare monotonia. */

/* Note utility (frequenze A4-based) */
const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C2:  65.41, D2:  73.42, E2:  82.41, F2:  87.31, G2:  98.00, A2: 110.00, B2: 123.47,
  R: 0,
};

const TRACKS = {
  /* Villaggio: melodia allegra in C maggiore con quattro varianti (A/B/C/D). */
  village: {
    bpm: 110,
    mood: 'triangle',
    bassMood: 'sine',
    melody: [
      // A — tema principale
      N.G4, N.A4, N.B4, N.C5,  N.D5, N.C5, N.B4, N.A4,
      N.G4, N.E4, N.G4, N.A4,  N.B4, N.A4, N.G4, N.R,
      // B — risposta
      N.C5, N.B4, N.A4, N.G4,  N.E4, N.G4, N.A4, N.B4,
      N.C5, N.D5, N.E5, N.D5,  N.C5, N.B4, N.A4, N.G4,
      // C — sotto-dominante (F, Am)
      N.F4, N.A4, N.C5, N.A4,  N.F4, N.G4, N.A4, N.R,
      N.A4, N.C5, N.E5, N.C5,  N.A4, N.G4, N.F4, N.E4,
      // D — ritorno al tema + chiusura
      N.G4, N.B4, N.D5, N.G5,  N.F5, N.E5, N.D5, N.C5,
      N.B4, N.A4, N.G4, N.E4,  N.G4, N.R,  N.G4, N.R,
    ],
    bass: [
      N.C3, N.R, N.G3, N.R,    N.A3, N.R, N.G3, N.R,
      N.C3, N.R, N.E3, N.R,    N.G3, N.R, N.G3, N.R,
      N.A3, N.R, N.E3, N.R,    N.C3, N.R, N.G3, N.R,
      N.C3, N.R, N.G3, N.R,    N.C3, N.R, N.G3, N.R,
      N.F3, N.R, N.C3, N.R,    N.F3, N.R, N.E3, N.R,
      N.A3, N.R, N.A3, N.R,    N.F3, N.R, N.C3, N.R,
      N.G3, N.R, N.D3, N.R,    N.G3, N.R, N.C3, N.R,
      N.G3, N.R, N.E3, N.R,    N.C3, N.R, N.G3, N.R,
    ],
  },

  /* Foresta: minore naturale A, atmosfera misteriosa (A/B/C/D). */
  forest: {
    bpm: 96,
    mood: 'triangle',
    bassMood: 'sine',
    melody: [
      // A — tema E minore
      N.E4, N.G4, N.A4, N.B4,  N.A4, N.G4, N.E4, N.R,
      N.D4, N.E4, N.G4, N.A4,  N.G4, N.E4, N.D4, N.R,
      // B — ascesa e discesa
      N.E4, N.G4, N.B4, N.D5,  N.B4, N.A4, N.G4, N.E4,
      N.A4, N.G4, N.E4, N.D4,  N.E4, N.R,  N.E4, N.R,
      // C — relativo maggiore G
      N.G4, N.A4, N.B4, N.D5,  N.B4, N.G4, N.E4, N.D4,
      N.G4, N.B4, N.D5, N.G5,  N.D5, N.B4, N.A4, N.G4,
      // D — ritorno oscuro al minore
      N.E4, N.D4, N.C4, N.B3,  N.A3, N.B3, N.D4, N.E4,
      N.G4, N.A4, N.B4, N.A4,  N.G4, N.R,  N.E4, N.R,
    ],
    bass: [
      N.E3, N.R, N.E3, N.R,    N.A3, N.R, N.A3, N.R,
      N.D3, N.R, N.D3, N.R,    N.G3, N.R, N.G3, N.R,
      N.E3, N.R, N.E3, N.R,    N.B2, N.R, N.B2, N.R,
      N.A3, N.R, N.A3, N.R,    N.E3, N.R, N.E3, N.R,
      N.G3, N.R, N.G3, N.R,    N.D3, N.R, N.G3, N.R,
      N.G3, N.R, N.D3, N.R,    N.G3, N.R, N.E3, N.R,
      N.E3, N.R, N.B2, N.R,    N.A2, N.R, N.E3, N.R,
      N.E3, N.R, N.A3, N.R,    N.E3, N.R, N.E3, N.R,
    ],
  },

  /* Caverna: cupa, ostinato di basso ripetitivo + melodia eolio (A/B/C/D). */
  cave: {
    bpm: 88,
    mood: 'square',
    bassMood: 'triangle',
    melody: [
      // A — tema A eolio basso
      N.A3, N.C4, N.E4, N.A4,  N.G4, N.E4, N.C4, N.A3,
      N.A3, N.B3, N.D4, N.F4,  N.E4, N.D4, N.C4, N.B3,
      // B — tensione ascendente
      N.A3, N.E4, N.G4, N.A4,  N.B4, N.A4, N.G4, N.E4,
      N.D4, N.C4, N.B3, N.A3,  N.G3, N.A3, N.R,  N.R,
      // C — discesa cromatica (tensione max)
      N.A4, N.G4, N.F4, N.E4,  N.D4, N.C4, N.B3, N.A3,
      N.B3, N.C4, N.D4, N.E4,  N.F4, N.E4, N.D4, N.C4,
      // D — eco + silenzio
      N.A3, N.R,  N.E4, N.R,   N.A4, N.R,  N.E4, N.R,
      N.D4, N.C4, N.B3, N.A3,  N.G3, N.A3, N.R,  N.R,
    ],
    bass: [
      N.A2, N.R, N.A2, N.R,    N.A2, N.R, N.E3, N.R,
      N.D3, N.R, N.D3, N.R,    N.A2, N.R, N.E3, N.R,
      N.A2, N.R, N.A2, N.R,    N.E3, N.R, N.E3, N.R,
      N.D3, N.R, N.A2, N.R,    N.E3, N.R, N.A2, N.R,
      N.A2, N.R, N.G2, N.R,    N.F2, N.R, N.E2, N.R,
      N.D2, N.R, N.E2, N.R,    N.A2, N.R, N.E2, N.R,
      N.A2, N.R, N.A2, N.R,    N.A2, N.R, N.E3, N.R,
      N.D3, N.R, N.A2, N.R,    N.E2, N.R, N.A2, N.R,
    ],
  },

  /* Castello: tetra, marcia in D minore (A/B/C/D). */
  castle: {
    bpm: 80,
    mood: 'sawtooth',
    bassMood: 'triangle',
    melody: [
      // A — marcia principale
      N.D4, N.D4, N.F4, N.A4,  N.G4, N.F4, N.E4, N.D4,
      N.C4, N.D4, N.F4, N.A4,  N.B4, N.A4, N.G4, N.F4,
      // B — ascesa drammatica
      N.D4, N.F4, N.A4, N.D5,  N.C5, N.B4, N.A4, N.G4,
      N.F4, N.E4, N.D4, N.C4,  N.D4, N.R,  N.D4, N.R,
      // C — minore con sesta (Bb) — suona quasi sinistro
      N.D4, N.F4, N.G4, N.A4,  N.B4, N.A4, N.G4, N.F4,
      N.E4, N.D4, N.C4, N.B3,  N.A3, N.B3, N.C4, N.D4,
      // D — climax + risoluzione (fallace) sul VI grado
      N.D5, N.C5, N.B4, N.A4,  N.G4, N.A4, N.B4, N.G4,
      N.F4, N.E4, N.D4, N.R,   N.D4, N.R,  N.D4, N.R,
    ],
    bass: [
      N.D2, N.R, N.A2, N.R,    N.D2, N.R, N.F2, N.R,
      N.C2, N.R, N.G2, N.R,    N.D2, N.R, N.A2, N.R,
      N.D2, N.R, N.A2, N.R,    N.F2, N.R, N.C2, N.R,
      N.G2, N.R, N.D2, N.R,    N.A2, N.R, N.D2, N.R,
      N.D2, N.R, N.F2, N.R,    N.G2, N.R, N.F2, N.R,
      N.E2, N.R, N.D2, N.R,    N.A2, N.R, N.E2, N.R,
      N.D2, N.R, N.A2, N.R,    N.G2, N.R, N.D2, N.R,
      N.F2, N.R, N.E2, N.R,    N.D2, N.R, N.D2, N.R,
    ],
  },
};

let musicTimer = null;
let currentTrack = null;
let musicStep = 0;

/** Riproduce una nota con envelope ADSR semplice per un suono piu` morbido. */
function playMusicNote(freq, dur, type, vol) {
  const ctx = getCtx();
  if (!ctx || freq <= 0 || vol <= 0) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime;
  /* Envelope ADSR: attack rapido, decay corto, sustain medio, release lento */
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);          // A
  g.gain.exponentialRampToValueAtTime(vol * 0.55, t + 0.06); // D
  g.gain.setValueAtTime(vol * 0.55, t + Math.max(0.07, dur * 0.6)); // S
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);    // R
  o.connect(g);
  g.connect(masterGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Percussione sintetizzata — hi-hat (rumore breve filtrato) e kick (boom breve). */
function playHihat(vol = 0.018) {
  const ctx = getCtx();
  if (!ctx) return;
  const bufSize = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  const src = ctx.createBufferSource();
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(hpf); hpf.connect(g); g.connect(masterGain);
  src.start();
}

function playKick(vol = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 100;
  o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.14);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  o.connect(g); g.connect(masterGain);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.16);
}

export function playMusic(name) {
  const ctx = getCtx();
  if (!ctx) return;
  if (currentTrack === name) return;
  stopMusic();
  currentTrack = name;
  const track = TRACKS[name] || TRACKS.village;
  const stepMs = 60000 / track.bpm / 2; // semicrome (16th note)
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (currentTrack !== name) return;
    const i = musicStep % track.melody.length;
    const beat = musicStep % 8; // posizione dentro una misura di 4/4 (8 semicrome)

    /* Melodia (sopra) — volume leggermente più alto per chiarezza */
    const mFreq = track.melody[i];
    if (mFreq > 0) {
      playMusicNote(mFreq, stepMs * 0.0018, track.mood || 'triangle', 0.065);
    }
    /* Basso (sotto) — meno frequente, durata più lunga */
    const bFreq = track.bass[i % track.bass.length];
    if (bFreq > 0) {
      playMusicNote(bFreq, stepMs * 0.004, track.bassMood || 'sine', 0.048);
    }
    /* Piccolo accento armonico ogni 8 step (terza sopra la melodia) */
    if ((musicStep % 8) === 0 && mFreq > 0) {
      playMusicNote(mFreq * 1.25, stepMs * 0.0014, 'sine', 0.025);
    }
    /* Percussione: hi-hat ogni semibattuta, kick sulla 1 e 5 */
    playHihat(0.018);
    if (beat === 0 || beat === 4) {
      playKick(track.bpm >= 100 ? 0.055 : 0.045);
    }

    musicStep++;
  }, stepMs);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  currentTrack = null;
  musicStep = 0;
  if (musicNode) {
    try { musicNode.stop(); } catch { /* ignored */ }
    musicNode = null;
  }
}

export function ensureAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
