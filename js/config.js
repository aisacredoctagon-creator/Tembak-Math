// Semua konstanta yang bisa disetel ada di sini: kecepatan, jarak, bonus, penalti, HP boss, dst.

export const LOGICAL_W = 450; // lebar logis kanvas (tinggi logis = 800 pada rasio 9:16, bisa lebih tinggi di HP tinggi)
export const LOGICAL_H = 800;

export const DIFFICULTIES = ['mudah', 'sedang', 'sulit'];
export const DIFF_LABEL = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
export const DIFF_GRADE = { mudah: 'Kelas 1-3', sedang: 'Kelas 4-6', sulit: 'SMP' };

export const FOCUS_LIST = ['campuran', 'add', 'sub', 'mul', 'div'];
export const FOCUS_LABEL = {
  campuran: 'Campuran',
  add: 'Tambah saja',
  sub: 'Kurang saja',
  mul: 'Kali saja',
  div: 'Bagi saja',
};

export const SPEED_LIST = ['santai', 'normal', 'cepat'];
export const SPEED_LABEL = { santai: 'Santai', normal: 'Normal', cepat: 'Cepat' };

export const OP_SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };

// ---- Teks dan ikon pop-up (dari desain Figma; mudah diganti) ----
export const VICTORY_TITLE = 'Mafufu'; // judul pop-up menang (placeholder di desain Figma)
export const DEFEAT_TITLE = 'Coba Lagi!';
export const PAUSE_TITLE = 'Jeda';
/** Ikon di dalam koin (SVG, bukan emoji). Ganti dengan SVG lain bila perlu; memakai warna teks (#78350f). */
export const COIN_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.4l-6 3.5 1.3-6.7-5-4.7 6.8-.8z"/></svg>';

// ---- Token warna untuk kanvas (sama dengan css/tokens.css) ----
export const TOKENS = {
  bgDeep: '#0d0221',
  titleYellow: '#ffde38',
  coinYellow: '#ffd93b',
  cardBorder: '#9167f5',
  starColors: ['#ffffff', '#fef08a', '#d8b4fe'],
};

export const CFG = {
  // Level
  levelsPerDifficulty: 30,
  levelsPerWorld: 10,
  bigBossEvery: 5,
  gatesMin: 5, // jumlah gerbang soal: level 1 -> level 30
  gatesMax: 10,

  // Peluru, combo
  startBullets: { mudah: 10, sedang: 15, sulit: 20 },
  correctBonus: 10, // bonus dasar jawaban benar (dikali multiplier combo)
  wrongPenalty: 5,
  // multiplier combo menurut jumlah jawaban benar berturut-turut (indeks = streak): x1, x1.5, x2, x2.5, x3 (maks)
  comboMult: [1, 1, 1.5, 2, 2.5, 3],
  hintsPerLevel: 3,

  // Kecepatan lari (unit dunia / detik): [level 1, level 30]
  speed: { mudah: [16, 24], sedang: [18, 28], sulit: [20, 32] },
  // Waktu berpikir per gerbang (detik) pada mode Normal: [level 1, level 30].
  // Jarak antar gerbang = kecepatan x waktu berpikir x faktor baca soal.
  thinkSeconds: { mudah: [6.5, 5], sedang: [5.5, 4], sulit: [4.5, 3.5] },
  speedModes: {
    santai: { speed: 0.7, think: 1.35 },
    normal: { speed: 1, think: 1 },
    cepat: { speed: 1.3, think: 0.85 },
  },
  firstGateExtraSeconds: 1.2, // tambahan jarak sebelum gerbang pertama (percepatan awal)
  bossGap: 100, // jarak gerbang terakhir ke boss
  bossStopDepth: 14, // pistol berhenti sedekat ini dari boss

  // Boss: soal cepat
  bossIntroDelay: 0.8,
  bossTimeSeconds: { mudah: 16, sedang: 13, sulit: 11 }, // batas waktu menjawab (x faktor baca x mode)
  bossAttackFraction: 0.2, // peluru hilang saat boss menyerang (bagian dari peluru)
  bossAttackMin: 5,
  firePerSecond: 70, // kecepatan animasi menembak
  fireMinDuration: 0.6,
  fireMaxDuration: 1.6,
  bossGapDelay: 0.5,
  bossHurtDelay: 0.9,

  // HP boss = kapasitas damage permainan sempurna x faktor (level 1 -> level 30)
  hpFactorMin: 0.12,
  hpFactorMax: 0.36,
  bigBossHpBoost: 0.03,

  // Bintang: skor = akurasi x bobot + (peluru saat boss / peluru sempurna) x bobot
  starWeightAccuracy: 0.7,
  starWeightBullets: 0.3,
  starThree: 0.85,
  starTwo: 0.6,

  // Koin
  coinPerCorrect: 1, // tiap jawaban benar
  coinLevelWin: 10, // bonus menyelesaikan level
  coinPerStar: 5, // bonus per bintang

  // Efek (game feel)
  slowMoSeconds: 0.25, // slow-motion singkat saat melewati gerbang
  slowMoScale: 0.35,
  hitStopSeconds: 0.07, // hit-stop saat tembakan kuat
  ringsMax: 12, // batas cincin energi yang ditampilkan

  // Kontrol
  maxX: 0.88, // batas kiri/kanan pistol (satuan lebar jalur)
  followRate: 14, // kehalusan gerak pistol
  keySpeed: 1.9, // kecepatan geser dengan keyboard (lebar jalur / detik)
  pointerGain: 1.15, // sensitivitas drag
};

// Tema warna tiap dunia: ungu, biru, oranye
export const WORLDS = [
  {
    name: 'Dunia Ungu',
    skyTop: '#150632', // selaras dengan latar Figma (#2a1450 -> #0d0221)
    skyBottom: '#7b3fd0',
    sun: '#ffc2f5',
    hill: '#35157a',
    hill2: '#27105c',
    side: '#160835',
    roadA: '#7442e0',
    roadB: '#6234c8',
    edge: '#ffd6ff',
    accent: '#ff7bd5',
    boss: '#e0486a',
  },
  {
    name: 'Dunia Biru',
    skyTop: '#06306b',
    skyBottom: '#37b0ff',
    sun: '#e6f9ff',
    hill: '#14509f',
    hill2: '#0e3d7d',
    side: '#072a5c',
    roadA: '#3a85f5',
    roadB: '#2b6fdc',
    edge: '#c6ecff',
    accent: '#5de0ff',
    boss: '#7a4be0',
  },
  {
    name: 'Dunia Oranye',
    skyTop: '#661a0a',
    skyBottom: '#ffa23f',
    sun: '#fff3b8',
    hill: '#a63a12',
    hill2: '#852d0c',
    side: '#4a1608',
    roadA: '#f67f31',
    roadB: '#e06a24',
    edge: '#ffe6b0',
    accent: '#ffd23f',
    boss: '#2f9e8f',
  },
];
