/**
 * Andryx Hourglass — SFX via Web Audio API (no asset esterni).
 * Suoni sintetizzati: spada, hit, pickup, sail, boomerang, bomb,
 * timer-tick, phantom-alert, victory, gameover.
 */
let ctx = null;
let muted = false;
let musicGain = null;
let musicNodes = [];
let musicTimer = null;

function getCtx() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch { /* ignored */ }
  }
  return ctx;
}

export function ensureAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(m) { muted = !!m; }

function tone(freq, dur, type = 'square', vol = 0.18, attack = 0.01, decay = 0.04) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.05);
  } catch { /* ignored */ }
}

function noise(dur, vol = 0.12) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * vol;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start();
  } catch { /* ignored */ }
}

export const SFX = {
  sword:       () => { tone(880, 0.08, 'square', 0.16); tone(440, 0.06, 'sawtooth', 0.10); },
  hit:         () => { tone(180, 0.18, 'sawtooth', 0.22); noise(0.08, 0.18); },
  enemy_hit:   () => { tone(320, 0.10, 'square', 0.18); },
  pickup:      () => { tone(660, 0.06, 'triangle', 0.18); tone(990, 0.08, 'triangle', 0.18); },
  rupee:       () => { tone(1200, 0.05, 'triangle', 0.16); tone(1600, 0.06, 'triangle', 0.16); },
  heart:       () => { tone(880, 0.08, 'sine', 0.18); tone(1320, 0.10, 'sine', 0.18); },
  key:         () => { tone(770, 0.10, 'square', 0.14); tone(1100, 0.12, 'square', 0.14); },
  door:        () => { tone(220, 0.18, 'sawtooth', 0.18); },
  text:        () => { tone(1100, 0.02, 'square', 0.06); },
  sail:        () => { noise(0.6, 0.06); },
  boomerang:   () => { tone(900, 0.18, 'triangle', 0.14); tone(700, 0.18, 'triangle', 0.14); },
  bomb_place:  () => { tone(440, 0.08, 'square', 0.12); },
  bomb_blast:  () => { noise(0.35, 0.30); tone(120, 0.25, 'sawtooth', 0.22); },
  arrow:       () => { tone(1400, 0.06, 'triangle', 0.12); noise(0.04, 0.06); },
  victory:     () => { tone(660, 0.12, 'square', 0.18); tone(880, 0.12, 'square', 0.18); tone(1320, 0.18, 'square', 0.18); },
  gameover:    () => { tone(330, 0.20, 'sawtooth', 0.20); tone(220, 0.30, 'sawtooth', 0.20); },
  timer_tick:  () => { tone(2000, 0.03, 'square', 0.08); },
  timer_warn:  () => { tone(440, 0.10, 'sawtooth', 0.20); },
  phantom_alert:() => { tone(110, 0.18, 'sawtooth', 0.24); tone(220, 0.18, 'sawtooth', 0.18); },
  safe:        () => { tone(660, 0.10, 'sine', 0.14); tone(990, 0.12, 'sine', 0.14); },
};

/* Musica di sottofondo: pattern arpeggiati semplici per scena.
   I tracks sono molto leggeri (no loop pesanti, niente asset). */
const MUSIC_TRACKS = {
  sea: {
    bpm: 92,
    notes: [330, 392, 494, 587, 494, 392, 330, 294], /* arpeggio E minore felice */
    type: 'triangle',
    vol: 0.06,
  },
  island: {
    bpm: 110,
    notes: [392, 440, 494, 587, 659, 587, 494, 440],
    type: 'triangle',
    vol: 0.06,
  },
  temple: {
    bpm: 78,
    notes: [220, 247, 294, 330, 294, 247, 220, 196],
    type: 'sine',
    vol: 0.05,
  },
  dungeon: {
    bpm: 88,
    notes: [196, 247, 294, 247, 196, 165, 196, 247],
    type: 'sawtooth',
    vol: 0.05,
  },
};

export function playMusic(trackName) {
  stopMusic();
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const track = MUSIC_TRACKS[trackName];
  if (!track) return;
  try {
    musicGain = c.createGain();
    musicGain.gain.value = track.vol;
    musicGain.connect(c.destination);
    let i = 0;
    const stepMs = 60000 / track.bpm / 2;
    musicTimer = setInterval(() => {
      const f = track.notes[i % track.notes.length];
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = track.type;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(1, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + stepMs / 1000 - 0.02);
      osc.connect(g).connect(musicGain);
      osc.start();
      osc.stop(c.currentTime + stepMs / 1000);
      musicNodes.push(osc);
      if (musicNodes.length > 32) musicNodes = musicNodes.slice(-16);
      i++;
    }, stepMs);
  } catch { /* ignored */ }
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicNodes = [];
  if (musicGain) {
    try { musicGain.disconnect(); } catch { /* ignored */ }
    musicGain = null;
  }
}
