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

/* ─── Musica di sottofondo (loop semplice per zona) ─── */

const TRACKS = {
  village: [392, 440, 494, 523, 587, 523, 494, 440],   // melodia serena
  forest:  [330, 392, 440, 494, 392, 330, 294, 330],   // melodia misteriosa
  cave:    [220, 247, 294, 330, 294, 247, 220, 196],   // melodia cupa
  castle:  [196, 175, 165, 196, 220, 247, 220, 196],   // melodia tetra
};

let musicTimer = null;
let currentTrack = null;

export function playMusic(name) {
  const ctx = getCtx();
  if (!ctx) return;
  if (currentTrack === name) return;
  stopMusic();
  currentTrack = name;
  const notes = TRACKS[name] || TRACKS.village;
  let i = 0;
  const step = 320;  // ms per nota
  musicTimer = setInterval(() => {
    if (currentTrack !== name) return;
    tone(notes[i % notes.length], 0.18, 'triangle', 0.07);
    i++;
  }, step);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  currentTrack = null;
  if (musicNode) {
    try { musicNode.stop(); } catch { /* ignored */ }
    musicNode = null;
  }
}

export function ensureAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
