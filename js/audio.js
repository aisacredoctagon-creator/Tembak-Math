// Efek suara dan musik latar sederhana dengan Web Audio (oscillator), tanpa file audio.
// AudioContext baru dibuat setelah interaksi pertama pengguna (kebijakan autoplay browser).

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let enabled = { sound: true, music: true };

let musicTimer = null;
let nextNoteTime = 0;
let step = 0;
let lastShoot = 0;

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const ARP = [0, 2, 4, 2, 5, 4, 2, 4, 1, 3, 5, 3, 6, 5, 3, 5];
const BASS = [130.81, 130.81, 196.0, 164.81, 146.83, 146.83, 196.0, 174.61];
const STEP_SEC = 0.2;

/** Panggil dari event interaksi pengguna (klik / sentuh / tombol). */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = enabled.sound ? 0.55 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = enabled.music ? 0.1 : 0;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  syncMusic();
}

export function configure({ sound, music }) {
  enabled = { sound, music };
  if (!ctx) return;
  sfxBus.gain.value = sound ? 0.55 : 0;
  musicBus.gain.value = music ? 0.1 : 0;
  syncMusic();
}

let musicStart = 0;
let intensity = 0; // 0 = dasar, 1 = + drum, 2 = + melodi tinggi (naik seiring combo)

/** Atur lapisan musik: 0..2 (dipanggil dari main.js sesuai combo). */
export function setIntensity(level) {
  intensity = Math.max(0, Math.min(2, level));
}

/** Denyut beat 0..1 (1 tepat di ketukan) untuk lampu jalur yang berkedip mengikuti musik. */
export function beat() {
  const beatSec = STEP_SEC * 2;
  const t = ctx && musicTimer ? ctx.currentTime - musicStart : performance.now() / 1000;
  const phase = (((t / beatSec) % 1) + 1) % 1;
  return Math.pow(1 - phase, 3);
}

function syncMusic() {
  if (!ctx) return;
  if (enabled.music && !musicTimer) {
    nextNoteTime = ctx.currentTime + 0.1;
    musicStart = nextNoteTime;
    musicTimer = setInterval(scheduleMusic, 90);
  } else if (!enabled.music && musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') {
    if (ctx) nextNoteTime = Math.max(nextNoteTime, ctx.currentTime);
    return;
  }
  while (nextNoteTime < ctx.currentTime + 0.3) {
    const i = step % ARP.length;
    tone(SCALE[ARP[i]], STEP_SEC * 0.9, { type: 'triangle', vol: 0.5, at: nextNoteTime, bus: musicBus });
    if (i % 2 === 0) {
      const bar = Math.floor(step / 4) % BASS.length;
      tone(BASS[bar], STEP_SEC * 1.8, { type: 'sine', vol: 0.9, at: nextNoteTime, bus: musicBus });
    }
    if (intensity >= 1) {
      // drum: kick tiap ketukan, hi-hat di antaranya
      if (i % 2 === 0) tone(150, 0.16, { type: 'sine', vol: 1.1, at: nextNoteTime, endFreq: 45, bus: musicBus });
      else noise(0.04, { vol: 0.25, freq: 6000, at: nextNoteTime, bus: musicBus });
    }
    if (intensity >= 2) {
      tone(SCALE[ARP[(i + 4) % ARP.length]] * 2, STEP_SEC * 0.6, { type: 'square', vol: 0.18, at: nextNoteTime, bus: musicBus });
    }
    nextNoteTime += STEP_SEC;
    step++;
  }
}

/** Satu nada: oscillator + envelope. */
function tone(freq, dur, { type = 'sine', vol = 0.4, delay = 0, at = null, endFreq = null, bus = null } = {}) {
  if (!ctx) return;
  const t0 = (at ?? ctx.currentTime) + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(bus || sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.3, freq = 2000, delay = 0, at = null, bus = null } = {}) {
  if (!ctx || !noiseBuf) return;
  const t0 = (at ?? ctx.currentTime) + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(bus || sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  shatter: () => {
    noise(0.22, { vol: 0.35, freq: 3500 });
    tone(2400, 0.12, { type: 'triangle', vol: 0.25, endFreq: 900 });
  },
  zap: () => {
    noise(0.18, { vol: 0.4, freq: 800 });
    tone(220, 0.2, { type: 'sawtooth', vol: 0.3, endFreq: 60 });
  },
  boom: () => {
    noise(0.5, { vol: 0.6, freq: 200 });
    tone(110, 0.5, { type: 'sine', vol: 0.9, endFreq: 30 });
    tone(880, 0.35, { type: 'triangle', vol: 0.3, delay: 0.1, endFreq: 1760 });
  },
  coin: () => {
    tone(1319, 0.08, { type: 'square', vol: 0.2 });
    tone(1760, 0.18, { type: 'square', vol: 0.2, delay: 0.07 });
  },
  click: () => tone(660, 0.07, { type: 'square', vol: 0.15 }),
  pickup: () => tone(700, 0.09, { type: 'sine', vol: 0.4, endFreq: 1200 }),
  good: () => {
    tone(523, 0.12, { type: 'triangle', vol: 0.4 });
    tone(784, 0.12, { type: 'triangle', vol: 0.4, delay: 0.07 });
    tone(1047, 0.18, { type: 'triangle', vol: 0.4, delay: 0.14 });
  },
  bad: () => tone(320, 0.28, { type: 'sawtooth', vol: 0.3, endFreq: 110 }),
  correct: () => {
    tone(988, 0.25, { type: 'sine', vol: 0.5 });
    tone(1319, 0.4, { type: 'sine', vol: 0.45, delay: 0.09 });
  },
  wrong: () => {
    tone(130, 0.18, { type: 'sawtooth', vol: 0.4 });
    tone(110, 0.3, { type: 'sawtooth', vol: 0.4, delay: 0.17 });
  },
  hit: () => tone(140, 0.2, { type: 'sine', vol: 0.7, endFreq: 50 }),
  win: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.22, { type: 'triangle', vol: 0.45, delay: i * 0.11 }));
  },
  lose: () => {
    [440, 392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.3, delay: i * 0.18 }));
  },
};

export function play(name) {
  if (!ctx || !enabled.sound) return;
  const fn = SOUNDS[name];
  if (fn) fn();
}

/** Suara "ting" jawaban benar: nadanya naik setengah nada tiap combo (maks 12). */
export function playCorrect(streak) {
  if (!ctx || !enabled.sound) return;
  const k = 2 ** (Math.min(Math.max(streak, 1) - 1, 12) / 12);
  tone(988 * k, 0.25, { type: 'sine', vol: 0.5 });
  tone(1319 * k, 0.4, { type: 'sine', vol: 0.45, delay: 0.09 });
}

/** Suara tembakan dibatasi supaya tidak berisik saat menembak cepat. */
export function playShoot() {
  if (!ctx || !enabled.sound) return;
  const now = ctx.currentTime;
  if (now - lastShoot < 0.07) return;
  lastShoot = now;
  noise(0.06, { vol: 0.35, freq: 1800 });
  tone(520, 0.08, { type: 'square', vol: 0.18, endFreq: 140 });
}
