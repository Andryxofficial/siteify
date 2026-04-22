/**
 * Andryx Jump — audio sintetizzato Web Audio (no asset esterni).
 *
 * SFX: jump, doubleJump, coin, stomp, hit, powerup, death, levelClear,
 *      pause, checkpoint.
 *
 * Musica: 10 brani originali (uno per mondo) generati proceduralmente
 *         con loop di 32 step, melodia + basso + accento. Ogni mondo ha
 *         scala/tempo/timbro suoi.
 */

const VOL_KEY = 'andryxify_platform_volume';

let ctx = null;
let masterGain = null;
let musicTimer = null;
let musicWorld = 0;

function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = getSavedVolume();
    masterGain.connect(ctx.destination);
  } catch { return null; }
  return ctx;
}

function getSavedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35;
  } catch { return 0.35; }
}

export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, String(vol)); } catch { /* ignored */ }
  if (masterGain) masterGain.gain.value = vol;
}

export function getVolume() { return getSavedVolume(); }

/** Resume del contesto audio (necessario dopo gesture utente). */
export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/* ─── Building blocks ─── */

function tone(freq, dur, type = 'square', vol = 0.2, attack = 0.005, release = 0.04) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.05);
}

function sweep(f0, f1, dur, type = 'square', vol = 0.2) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.04);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.1);
}

function noiseBurst(dur, vol = 0.18, lp = 1200) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t0);
}

/* ─── SFX ─── */

export const SFX = {
  jump:        () => sweep(420, 820, 0.12, 'square', 0.18),
  doubleJump:  () => { sweep(520, 980, 0.10, 'square', 0.18); setTimeout(() => sweep(700, 1200, 0.08, 'triangle', 0.16), 60); },
  coin:        () => { tone(988, 0.05, 'triangle', 0.22); setTimeout(() => tone(1318, 0.08, 'triangle', 0.20), 50); },
  stomp:       () => sweep(220, 90, 0.12, 'square', 0.22),
  hit:         () => { noiseBurst(0.18, 0.22, 800); sweep(360, 110, 0.16, 'sawtooth', 0.18); },
  powerup:     () => {
    const seq = [523, 659, 784, 1046];
    seq.forEach((f, i) => setTimeout(() => tone(f, 0.10, 'square', 0.18), i * 70));
  },
  death:       () => {
    const seq = [440, 392, 349, 311, 261, 220, 196, 165];
    seq.forEach((f, i) => setTimeout(() => tone(f, 0.15, 'square', 0.22), i * 100));
  },
  levelClear:  () => {
    const seq = [523, 659, 784, 1046, 1318, 1568, 2093];
    seq.forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', 0.20), i * 90));
  },
  pause:       () => tone(440, 0.06, 'sine', 0.18),
  checkpoint:  () => { tone(659, 0.08, 'triangle', 0.18); setTimeout(() => tone(988, 0.10, 'triangle', 0.18), 80); setTimeout(() => tone(1318, 0.14, 'square', 0.18), 170); },
  oneup:       () => { const s = [523, 659, 784, 1046, 1318]; s.forEach((f, i) => setTimeout(() => tone(f, 0.10, 'triangle', 0.20), i * 80)); },
  enemyShot:   () => sweep(800, 200, 0.08, 'square', 0.14),
  fireball:    () => sweep(440, 880, 0.08, 'sawtooth', 0.15),
  fireballHit: () => {
    tone(200, 0.05, 'square', 0.2);
    tone(100, 0.1, 'square', 0.15);
  },
  kick:        () => sweep(300, 600, 0.06, 'square', 0.2),
};

/* ─── Musica procedurale per mondo ─── */

/* Scala maggiore relativa alla tonica (semitoni). */
const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
const SCALE_PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

/* Configurazione per i 10 mondi: tonica MIDI, scala, timbro, BPM, pattern bassline. */
const WORLD_MUSIC = [
  { tonic: 60, scale: SCALE_MAJOR, type: 'square', bpm: 130, bass: [0, 0, 7, 0, 0, 0, 5, 0] }, // 1: Foresta — allegro
  { tonic: 62, scale: SCALE_MAJOR, type: 'square', bpm: 140, bass: [0, 7, 0, 7, 5, 7, 0, 7] }, // 2: Pianura
  { tonic: 57, scale: SCALE_MINOR, type: 'triangle', bpm: 110, bass: [0, 0, 0, 7, 0, 0, 0, 5] }, // 3: Caverna
  { tonic: 64, scale: SCALE_PENTA, type: 'square', bpm: 145, bass: [0, 5, 7, 5, 0, 5, 7, 10] }, // 4: Deserto
  { tonic: 55, scale: SCALE_MINOR, type: 'sawtooth', bpm: 95,  bass: [0, 0, 5, 0, 0, 0, 7, 0] }, // 5: Palude
  { tonic: 67, scale: SCALE_MAJOR, type: 'triangle', bpm: 150, bass: [0, 7, 5, 7, 0, 7, 5, 7] }, // 6: Vetta
  { tonic: 65, scale: SCALE_MAJOR, type: 'triangle', bpm: 125, bass: [0, 0, 5, 0, 7, 0, 5, 0] }, // 7: Ghiaccio
  { tonic: 53, scale: SCALE_MINOR, type: 'square', bpm: 135, bass: [0, 0, 7, 0, 5, 0, 7, 0] }, // 8: Lava
  { tonic: 56, scale: SCALE_MINOR, type: 'triangle', bpm: 100, bass: [0, 0, 5, 0, 0, 0, 3, 0] }, // 9: Notte
  { tonic: 50, scale: SCALE_MINOR, type: 'sawtooth', bpm: 115, bass: [0, 7, 5, 7, 0, 5, 7, 10] }, // 10: Castello
];

/* Genera deterministicamente una melodia di 32 step per il mondo dato.
   Usa LCG seedato sul mondo per riproducibilita`. */
function generateMelody(world) {
  const cfg = WORLD_MUSIC[world - 1] || WORLD_MUSIC[0];
  const len = 32;
  let seed = (world * 1103515245 + 12345) & 0x7fffffff;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const notes = [];
  for (let i = 0; i < len; i++) {
    /* Rest 25% del tempo, nota lunga su downbeat */
    if (rand() < 0.22 && i % 4 !== 0) {
      notes.push(null);
    } else {
      const idx = Math.floor(rand() * cfg.scale.length);
      const oct = rand() < 0.15 ? 12 : 0;
      notes.push(cfg.scale[idx] + oct);
    }
  }
  return { cfg, notes, len };
}

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Avvia loop musicale per il mondo (1-10). Sostituisce qualsiasi musica in corso. */
export function playMusic(world = 1) {
  const c = getCtx();
  if (!c) return;
  if (musicWorld === world && musicTimer) return; // già in riproduzione
  stopMusic();
  musicWorld = world;
  const { cfg, notes, len } = generateMelody(world);
  const stepDur = 60 / cfg.bpm / 2; // 8th notes
  let step = 0;
  const tick = () => {
    if (musicWorld !== world) return; // mondo cambiato → stop
    const noteOff = notes[step % len];
    if (noteOff !== null && noteOff !== undefined) {
      const freq = midiToFreq(cfg.tonic + noteOff + 12);
      tone(freq, stepDur * 0.85, cfg.type, 0.07, 0.005, 0.02);
    }
    /* Bassline ogni 4 step (quarto). */
    if (step % 4 === 0) {
      const bass = cfg.bass[(step / 4) % cfg.bass.length];
      const bf = midiToFreq(cfg.tonic + bass - 12);
      tone(bf, stepDur * 3.5, 'triangle', 0.08, 0.01, 0.05);
    }
    step++;
    musicTimer = setTimeout(tick, stepDur * 1000);
  };
  tick();
}

/** Ferma la musica corrente. */
export function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  musicWorld = 0;
}
