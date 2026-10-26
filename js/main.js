// Bootstrap, game loop, dan state machine layar:
// splash -> menu -> levels / settings / how / shop -> playing <-> paused -> result -> review
import {
  CFG, LOGICAL_W, DIFFICULTIES, DIFF_LABEL, DIFF_GRADE, FOCUS_LIST, FOCUS_LABEL, SPEED_LIST, SPEED_LABEL,
  VICTORY_TITLE, DEFEAT_TITLE, PAUSE_TITLE,
} from './config.js';
import * as UI from './ui.js';
import { Game, generateLevel, verifyLevel, laneCenter } from './game.js';
import { Renderer, ROAD_HALF_WIDTH } from './render.js';
import { Input } from './input.js';
import { SKINS, PETS, getSkin, getPet, drawRobotPreview, drawPetPreview } from './characters.js';
import * as Sound from './audio.js';
import * as Store from './storage.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const renderer = new Renderer($('game'));

const DIFF_INFO = {
  mudah: 'Angka 1-20, tambah dan kurang, kali 2/3/5. Soal hitung langsung dan angka hilang.',
  sedang: 'Angka sampai 100, tabel perkalian 2-10. Ditambah pilih operasi, perbandingan, dan soal cerita.',
  sulit: 'Angka sampai 500. Ditambah soal dua langkah, pola angka, dan soal cerita panjang.',
};
const SPEED_INFO = {
  santai: 'Lari lebih lambat dan waktu berpikir lebih lama. Cocok untuk pemula.',
  normal: 'Waktu berpikir seimbang: sekitar 5 detik (mudah), 4 detik (sedang), 3,5 detik (sulit).',
  cepat: 'Lari lebih cepat dan waktu berpikir lebih singkat. Untuk yang mau tantangan.',
};
const QUALITY_LABEL = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' };

let state = 'splash'; // splash | menu | levels | settings | how | shop | playing | paused | result | review
let game = null;
let currentNum = 1;
let hudKey = '';
let lastCombo = -1;
let lastHints = -1;
let starTimers = [];
let feedbackTimer = null;
let shopTab = 'skin';
let shopCards = []; // { canvas, ctx, kind, id } untuk animasi pratinjau
let slowT = 0; // slow-motion tersisa (detik, waktu nyata)
let hitStopT = 0; // hit-stop tersisa
let lastIntensity = -1;
let slowFrames = 0;
let autoQuality = true;

Store.load();
Sound.configure(Store.getSettings());

const { fmtNum, esc, fmtTime } = UI;
let settingsFrom = null; // 'paused' bila Pengaturan dibuka dari layar Jeda

UI.buildSpace();
// pastikan font Fredoka / Nunito siap (kanvas dan DOM); gambar ulang otomatis tiap frame
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('700 20px "Fredoka"'), document.fonts.load('800 14px "Nunito"')]).catch(() => {});
}

/** Terapkan opsi tampilan / aksesibilitas / skin yang dipakai. */
function applyOptions() {
  const s = Store.getSettings();
  renderer.setOptions({ quality: s.quality, reduceMotion: s.reduceMotion, colorblind: s.colorblind });
  document.body.classList.toggle('reduce-motion', s.reduceMotion);
  document.body.classList.toggle('cb', s.colorblind);
  const eq = Store.getEquipped();
  renderer.setLoadout(getSkin(eq.skin), eq.pet);
}
applyOptions();

/** Getar halus di HP (jika didukung dan tidak dimatikan). */
function vibrate(pattern) {
  if (!Store.getSettings().haptic || !navigator.vibrate) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // browser menolak sebelum ada ketukan
  try {
    navigator.vibrate(pattern);
  } catch (e) {
    /* diabaikan */
  }
}

// ---------- Input ----------
const input = new Input(stage, {
  canPause: () => state === 'playing' || state === 'paused',
  onPause: () => (state === 'playing' ? pauseGame() : resumeGame()),
  onChoice: (n) => chooseByNumber(n),
  onHint: () => useHint(),
});

/** Tombol angka 1/2/3: arahkan robot ke gerbang ke-n, atau jawab soal boss. */
function chooseByNumber(n) {
  if (state !== 'playing' || !game) return;
  if (game.phase === 'run') {
    const g = game.nextGate();
    if (g && n < g.active.length) input.target = Math.max(-CFG.maxX, Math.min(CFG.maxX, laneCenter(g.active.length, n)));
  } else if (game.phase === 'bossAsk' && game.bossQ && n < game.bossQ.choices.length) {
    game.answerBoss(n);
  }
}

function useHint() {
  if (state === 'playing' && game && game.useHint()) hudKey = ''; // bangun ulang chip jawaban
}

// ---------- Ukuran & responsif ----------
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let sw;
  let sh;
  if (vw <= 600) {
    // HP: isi seluruh layar; rasio diizinkan sampai 390:976 (desain Figma), tinggi logis 560..1126
    sw = vw;
    sh = vh;
    const lh = (LOGICAL_W * vh) / vw;
    if (lh > 1126) sh = (vw * 976) / 390;
    else if (lh < 560) sw = (vh * LOGICAL_W) / 560;
  } else {
    // Tablet / desktop: kontainer portrait di tengah, rasio mendekati 390:844 (maks lebar 480px, maks rasio 390:976)
    sw = Math.min(480, (vh * 390) / 844, vw);
    sh = Math.min(vh, (sw * 976) / 390);
    sw = Math.max(sw, Math.min(vw, 300, (sh * LOGICAL_W) / 560)); // jendela pendek: jangan lebih sempit dari 300px
  }
  sw = Math.floor(sw);
  sh = Math.floor(sh);
  const root = document.documentElement.style;
  root.setProperty('--sw', sw + 'px');
  root.setProperty('--sh', sh + 'px');
  root.setProperty('--d', sw / 390 + 'px'); // 1 satuan desain Figma (lebar acuan 390)
  renderer.resize(sw, sh, (LOGICAL_W * sh) / sw, Math.min(window.devicePixelRatio || 1, 2.5));
  input.setScale(sw, ROAD_HALF_WIDTH, LOGICAL_W);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 120));
layout();

const landscapePhone = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
landscapePhone.addEventListener?.('change', () => {
  if (landscapePhone.matches && state === 'playing') pauseGame();
});

// ---------- Layar ----------
const SCREENS = ['splash', 'menu', 'levels', 'settings', 'how', 'shop', 'pause', 'result', 'review'];

function showScreen(name) {
  for (const s of SCREENS) $('screen-' + s).classList.toggle('active', s === name);
}

function setState(next) {
  state = next;
  const inGame = next === 'playing' || next === 'paused' || next === 'result';
  $('stage').classList.toggle('in-game', inGame); // kanvas dunia hanya tampil saat bermain; layar lain memakai latar angkasa
  $('hud').classList.toggle('hidden', !inGame);
  $('hud').inert = next !== 'playing'; // HUD tidak bisa difokus saat pop-up terbuka
  input.enabled = next === 'playing';
  if (next === 'playing') showScreen(null);
  else if (next === 'paused') showScreen('pause');
  else showScreen(next);
  if (next !== 'playing' && next !== 'paused') hideFeedback();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (next === 'menu') renderMenuInfo();
  if (next === 'levels') renderLevels();
  if (next === 'settings') renderSettings();
  if (next === 'shop') renderShop();
}

function renderMenuInfo() {
  const s = Store.getSettings();
  const stars = Store.totalStars(s.difficulty);
  $('menu-info').textContent =
    `${DIFF_LABEL[s.difficulty]} (${DIFF_GRADE[s.difficulty]}) · ${FOCUS_LABEL[s.focus]} · ${SPEED_LABEL[s.speed]} · ★ ${stars}/${CFG.levelsPerDifficulty * 3}`;
  $('btn-play').textContent = Store.getStars(s.difficulty, 1) === 0 ? 'Main' : `Main · Level ${Store.nextLevel(s.difficulty)}`;
  UI.setCoinChip($('menu-coins'), Store.getCoins());
  updateMuteButtons();
}

function updateMuteButtons() {
  const s = Store.getSettings();
  const muted = !s.sound && !s.music;
  $('btn-mute-menu').textContent = muted ? '🔇' : '🔊';
  $('btn-mute-menu').setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara');
}

function toggleMute() {
  const s = Store.getSettings();
  const turnOn = !s.sound && !s.music;
  Store.setSetting('sound', turnOn);
  Store.setSetting('music', turnOn);
  Sound.configure(Store.getSettings());
  updateMuteButtons();
}

// ---------- Pilih level ----------
function segButtons(container, items, current, onPick) {
  container.textContent = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-btn' + (it.value === current ? ' on' : '');
    b.setAttribute('aria-pressed', String(it.value === current));
    b.innerHTML = it.html;
    b.addEventListener('click', () => onPick(it.value));
    container.appendChild(b);
  }
}

const diffItems = () =>
  DIFFICULTIES.map((d) => ({ value: d, html: `${DIFF_LABEL[d]}<small>${DIFF_GRADE[d]}</small>` }));

function renderLevels() {
  const s = Store.getSettings();
  segButtons($('levels-diff'), diffItems(), s.difficulty, (d) => {
    Store.setSetting('difficulty', d);
    renderLevels();
  });
  const grid = $('levels-grid');
  grid.textContent = '';
  const names = ['Dunia 1 · Ungu', 'Dunia 2 · Biru', 'Dunia 3 · Oranye'];
  for (let w = 0; w < 3; w++) {
    const title = document.createElement('div');
    title.className = `world-title world-${w}`;
    title.textContent = names[w];
    grid.appendChild(title);
    const wrap = document.createElement('div');
    wrap.className = 'level-grid';
    for (let i = 1; i <= CFG.levelsPerWorld; i++) {
      const n = w * CFG.levelsPerWorld + i;
      const stars = Store.getStars(s.difficulty, n);
      const unlocked = Store.isUnlocked(s.difficulty, n);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-cell' + (n % CFG.bigBossEvery === 0 ? ' big' : '') + (stars ? ' done' : '');
      b.disabled = !unlocked;
      b.setAttribute('aria-label', `Level ${n}${unlocked ? `, ${stars} bintang` : ', terkunci'}`);
      b.innerHTML = unlocked
        ? `<span>${n}</span><span class="st">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span>`
        : '<span>🔒</span><span class="st"></span>';
      if (unlocked) b.addEventListener('click', () => startLevel(n));
      wrap.appendChild(b);
    }
    grid.appendChild(wrap);
  }
}

// ---------- Pengaturan ----------
function toggleBtn(id, label, on) {
  const b = $(id);
  b.setAttribute('aria-pressed', String(on));
  b.textContent = `${label}: ${on ? 'Nyala' : 'Mati'}`;
}

function renderSettings() {
  const s = Store.getSettings();
  segButtons($('set-diff'), diffItems(), s.difficulty, (d) => {
    Store.setSetting('difficulty', d);
    renderSettings();
  });
  $('set-diff-info').textContent = DIFF_INFO[s.difficulty];
  segButtons($('set-focus'), FOCUS_LIST.map((f) => ({ value: f, html: FOCUS_LABEL[f] })), s.focus, (f) => {
    Store.setSetting('focus', f);
    renderSettings();
  });
  segButtons($('set-speed'), SPEED_LIST.map((m) => ({ value: m, html: SPEED_LABEL[m] })), s.speed, (m) => {
    Store.setSetting('speed', m);
    renderSettings();
  });
  $('set-speed-info').textContent = SPEED_INFO[s.speed];
  segButtons($('set-quality'), Store.QUALITIES.map((q) => ({ value: q, html: QUALITY_LABEL[q] })), s.quality, (q) => {
    Store.setSetting('quality', q);
    autoQuality = true;
    applyOptions();
    renderSettings();
  });
  toggleBtn('set-sound', 'Efek suara', s.sound);
  toggleBtn('set-music', 'Musik', s.music);
  toggleBtn('set-motion', 'Kurangi gerakan', s.reduceMotion);
  toggleBtn('set-haptic', 'Getar', s.haptic);
  toggleBtn('set-cb', 'Mode buta warna', s.colorblind);
}

function bindToggle(id, key, after) {
  $(id).addEventListener('click', () => {
    Store.setSetting(key, !Store.getSettings()[key]);
    if (after) after();
    renderSettings();
  });
}
bindToggle('set-sound', 'sound', () => Sound.configure(Store.getSettings()));
bindToggle('set-music', 'music', () => Sound.configure(Store.getSettings()));
bindToggle('set-motion', 'reduceMotion', applyOptions);
bindToggle('set-haptic', 'haptic', () => vibrate(30));
bindToggle('set-cb', 'colorblind', applyOptions);

// ---------- Toko ----------
function renderShop() {
  UI.setCoinChip($('shop-coins'), Store.getCoins());
  segButtons($('shop-tabs'), [{ value: 'skin', html: 'Skin Robot' }, { value: 'pet', html: 'Pet' }], shopTab, (t) => {
    shopTab = t;
    renderShop();
  });
  const list = $('shop-list');
  list.textContent = '';
  shopCards = [];
  const eq = Store.getEquipped();
  const items = shopTab === 'skin' ? [...SKINS] : [{ id: null, name: 'Tanpa Pet', price: 0, desc: 'Robot melayang sendirian.' }, ...PETS];
  for (const it of items) {
    const kind = shopTab;
    const owned = it.id === null || (kind === 'skin' ? Store.ownsSkin(it.id) : Store.ownsPet(it.id));
    const equipped = kind === 'skin' ? eq.skin === it.id : eq.pet === it.id;
    const card = document.createElement('div');
    card.className = 'shop-card' + (equipped ? ' equipped' : '');
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    canvas.className = 'shop-preview';
    const info = document.createElement('div');
    info.className = 'shop-info';
    info.innerHTML = `<b>${esc(it.name)}</b>` + (it.desc ? `<small>${esc(it.desc)}</small>` : '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small ' + (equipped ? 'btn-ok' : owned ? '' : 'btn-primary');
    if (equipped) {
      btn.textContent = 'Dipakai ✓';
      btn.disabled = true;
    } else if (owned) {
      btn.textContent = 'Pakai';
      btn.addEventListener('click', () => {
        Store.equip(kind, it.id);
        applyOptions();
        renderShop();
      });
    } else {
      const buyLabel = `Beli ${UI.coinHTML()} ${it.price}`;
      btn.innerHTML = buyLabel;
      btn.addEventListener('click', () => {
        if (Store.buy(kind, it.id)) {
          Store.equip(kind, it.id);
          applyOptions();
          Sound.play('coin');
          vibrate(25);
          renderShop();
        } else {
          Sound.play('bad');
          const need = it.price - Store.getCoins();
          btn.textContent = `Kurang ${need} koin`;
          setTimeout(() => { btn.innerHTML = buyLabel; }, 1200);
        }
      });
    }
    card.append(canvas, info, btn);
    list.appendChild(card);
    if (it.id !== null || kind === 'skin') shopCards.push({ canvas, ctx: canvas.getContext('2d'), kind, id: it.id });
  }
}

function drawShopPreviews(time) {
  const eq = Store.getEquipped();
  for (const c of shopCards) {
    if (c.kind === 'skin') drawRobotPreview(c.ctx, c.canvas.width, c.canvas.height, getSkin(c.id), time, eq.pet);
    else drawPetPreview(c.ctx, c.canvas.width, c.canvas.height, c.id, time);
  }
}

// ---------- Mulai / jeda / hasil ----------
function startLevel(num) {
  const s = Store.getSettings();
  currentNum = num;
  const level = generateLevel(s.difficulty, num, s.focus, s.speed);
  if (!verifyLevel(level)) console.warn('Level tidak lolos verifikasi', level);
  game = new Game(level, { pet: getPet(Store.getEquipped().pet) });
  hudKey = '';
  lastCombo = -1;
  lastHints = -1;
  slowT = 0;
  hitStopT = 0;
  input.reset();
  applyOptions();
  renderer.clearFx();
  starTimers.forEach(clearTimeout);
  starTimers = [];
  hideFeedback();
  $('hud-level').textContent = `Level ${num}${level.big ? ' · BOSS' : ''}`;
  $('hud-level').title = `${DIFF_LABEL[s.difficulty]} (${DIFF_GRADE[s.difficulty]})`;
  $('hud-combo').dataset.streak = 0;
  UI.setCombo(0, 1);
  $('hud-hint').classList.add('hidden');
  $('boss-choices').classList.add('hidden');
  $('hud-progress-bar').style.width = '0%';
  setState('playing');
}

function pauseGame() {
  if (state !== 'playing' || game.finished) return;
  input.releaseKeys();
  UI.renderPauseCard($('pause-card'), {
    resume: resumeGame,
    restart: () => startLevel(currentNum),
    settings: () => { settingsFrom = 'paused'; setState('settings'); },
    menu: () => setState('menu'),
  }, PAUSE_TITLE);
  setState('paused');
  UI.focusPrimary($('pause-card'));
}

function resumeGame() {
  if (state !== 'paused') return;
  setState('playing');
}

function showResult() {
  const won = game.phase === 'won';
  const s = Store.getSettings();
  Store.addCoins(game.coins);
  if (won) Store.setStars(s.difficulty, currentNum, game.stars);
  UI.renderResultCard($('result-card'), {
    won,
    title: won ? VICTORY_TITLE : DEFEAT_TITLE,
    headline: won ? 'Boss dikalahkan!' : 'Pelurumu habis sebelum boss kalah.',
    accuracy: `${Math.round(game.accuracy * 100)}% (${game.stats.right}/${game.stats.total})`,
    combo: game.maxCombo,
    time: fmtTime(game.elapsed),
    coins: game.coins,
    stars: game.stars,
    wrongs: game.wrongs.length,
    hasNext: currentNum < CFG.levelsPerDifficulty,
  }, {
    next: () => startLevel(currentNum + 1),
    review: showReview,
    retry: () => startLevel(currentNum),
    menu: () => setState('menu'),
    onStar: () => { Sound.play('pickup'); vibrate(12); },
  });
  setState('result');
  UI.focusPrimary($('result-card'));
}

// ---------- Ulasan soal yang salah ----------
function showReview() {
  const list = $('review-list');
  list.textContent = '';
  if (!game.wrongs.length) {
    list.innerHTML = '<div class="review-empty">Tidak ada soal yang salah. Hebat! 🎉</div>';
  }
  for (const w of game.wrongs) {
    const q = w.q;
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML =
      `<div class="rq${q.text.length > 34 ? ' long' : ''}">${esc(q.text)}</div>` +
      `<div class="bad">✗ Jawabanmu: ${w.timedOut ? 'waktu habis' : esc(w.chosen)}</div>` +
      `<div class="good">✓ Jawaban benar: ${esc(q.answerLabel)}</div>` +
      `<div class="how">${esc(q.explain)}</div>`;
    list.appendChild(card);
  }
  setState('review');
}

/** Kembali dari layar ulasan ke pop-up hasil (kartu sudah dibangun; bintang tidak dianimasikan ulang). */
function backToResult() {
  setState('result');
  UI.focusPrimary($('result-card'));
}

// ---------- HUD ----------
function showFeedback(html, ok, ms) {
  const el = $('feedback');
  el.innerHTML = html;
  el.classList.toggle('ok', ok);
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(hideFeedback, ms);
}

function hideFeedback() {
  clearTimeout(feedbackTimer);
  $('feedback').classList.add('hidden');
}

function buildChips(labels) {
  const row = $('hint-choices');
  row.textContent = '';
  labels.forEach((label, i) => {
    const chip = document.createElement('span');
    chip.className = 'hint-chip';
    chip.innerHTML = `<small>${i + 1}</small>${esc(label)}`;
    row.appendChild(chip);
  });
}

function setQuestionPanel(q, labels) {
  const hq = $('hint-q');
  hq.className = 'hint-q' + (q.text.length > 34 ? ' long' : '');
  hq.textContent = q.text;
  $('hint-choices').classList.toggle('hidden', !labels);
  if (labels) buildChips(labels);
}

function updateHud() {
  $('hud-progress-bar').style.width = Math.round(game.progress * 1000) / 10 + '%';

  const streak = game.streak;
  if (streak !== lastCombo) {
    UI.setCombo(streak, game.mult);
    lastCombo = streak;
    // musik berlapis: makin tinggi combo, makin banyak layer
    const level = streak >= 4 ? 2 : streak >= 2 ? 1 : 0;
    if (level !== lastIntensity) {
      Sound.setIntensity(level);
      lastIntensity = level;
    }
  }

  const gate = game.phase === 'run' ? game.nextGate() : null;
  const hintBtn = $('btn-hint');
  if (game.hints !== lastHints) {
    $('hint-count').textContent = game.hints;
    lastHints = game.hints;
  }
  hintBtn.disabled = !(gate && game.hints > 0 && gate.active.length > 1);

  const panel = $('hud-hint');
  const bossAsk = game.phase === 'bossAsk';
  const key = gate ? `g${game.idx}:${gate.active.join('')}` : bossAsk ? `b${game.bossIdx}` : '';
  if (key !== hudKey) {
    hudKey = key;
    const bossBox = $('boss-choices');
    if (gate) {
      panel.classList.remove('hidden');
      bossBox.classList.add('hidden');
      setQuestionPanel(gate.q, gate.active.map((c) => gate.q.choices[c]));
    } else if (bossAsk) {
      panel.classList.remove('hidden');
      setQuestionPanel(game.bossQ, null);
      bossBox.textContent = '';
      game.bossQ.choices.forEach((label, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary';
        b.innerHTML = `<small>${i + 1}</small>${esc(label)}`;
        b.addEventListener('click', () => game.answerBoss(i));
        bossBox.appendChild(b);
      });
      bossBox.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
      bossBox.classList.add('hidden');
    }
  }
  // bar waktu: jarak ke gerbang (waktu berpikir) atau batas waktu soal boss
  let frac = null;
  if (gate) frac = (gate.z - game.dist) / Math.max(1, gate.z - gate.prevZ);
  else if (bossAsk) frac = game.bossTimeLeft / game.bossTimeMax;
  if (frac !== null) {
    const bar = $('hint-timer-bar');
    bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    bar.classList.toggle('low', frac < 0.25);
  }
}

function handleEvents() {
  const reduce = Store.getSettings().reduceMotion;
  const cb = Store.getSettings().colorblind;
  for (const e of game.events) {
    renderer.onEvent(e, game);
    switch (e.type) {
      case 'correct':
        Sound.playCorrect(e.streak);
        Sound.play('shatter');
        vibrate(15);
        if (!reduce) slowT = CFG.slowMoSeconds;
        break;
      case 'wrong':
        Sound.play('wrong');
        Sound.play('zap');
        vibrate([50, 40, 50]);
        if (!reduce) slowT = CFG.slowMoSeconds;
        showFeedback(`${cb ? '✗ ' : ''}Salah! Jawaban benar:<b>${esc(e.q.answerLabel)}</b>`, false, 1500);
        break;
      case 'hint': Sound.play('pickup'); break;
      case 'bossCorrect':
        Sound.playCorrect(e.streak);
        vibrate(20);
        if (!reduce && e.mult >= 2) hitStopT = CFG.hitStopSeconds;
        break;
      case 'bossWrong':
        Sound.play('wrong');
        Sound.play('hit');
        vibrate([60, 40, 60]);
        showFeedback(`${e.timedOut ? 'Waktu habis!' : 'Salah!'} Jawaban benar:<b>${esc(e.q.answerLabel)}</b>`, false, 1500);
        break;
      case 'shoot': Sound.playShoot(); break;
      case 'win':
        Sound.play('boom');
        Sound.play('win');
        vibrate([80, 40, 80, 40, 160]);
        if (!reduce) {
          hitStopT = 0.12;
          slowT = 0.6;
        }
        break;
      case 'lose': Sound.play('lose'); vibrate(200); break;
      default: break;
    }
  }
  game.events.length = 0;
}

/** Turunkan kualitas otomatis bila FPS rendah terus-menerus (hanya saat bermain). */
function watchFps(rawDt) {
  if (!autoQuality || renderer.quality === 0 || window.mathGunRunner.noAuto) return;
  if (rawDt > 0.25) return; // jeda / tab tidak aktif: abaikan
  slowFrames = rawDt > 0.028 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
  if (slowFrames > 90) {
    renderer.quality -= 1;
    slowFrames = 0;
  }
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.max(0, (now - last) / 1000);
  last = now;
  let dt = Math.min(0.05, rawDt);

  if (state === 'playing') {
    watchFps(rawDt);
    // hit-stop membekukan sejenak; slow-motion memperlambat waktu permainan
    if (hitStopT > 0) {
      hitStopT -= rawDt;
      dt = 0;
    } else if (slowT > 0) {
      slowT -= rawDt;
      dt *= CFG.slowMoScale;
    }
    input.update(dt);
    game.update(dt, input.target);
    handleEvents();
    updateHud();
    renderer.update(dt, game);
    renderer.render(game);
    if (game.finished && game.phaseTime > (game.phase === 'won' ? 1.7 : 1.1)) showResult();
  } else if (state === 'result') {
    game.update(dt, input.target);
    game.events.length = 0;
    renderer.update(dt, game);
    renderer.render(game);
  } else if (state === 'paused') {
    renderer.render(game);
  } else if (state === 'shop') {
    drawShopPreviews(now / 1000); // layar lain memakai latar angkasa CSS; kanvas dunia disembunyikan
  }
}

// ---------- Tombol ----------
$('btn-play').addEventListener('click', () => startLevel(Store.nextLevel(Store.getSettings().difficulty)));
$('btn-levels').addEventListener('click', () => setState('levels'));
$('btn-settings').addEventListener('click', () => setState('settings'));
$('btn-how').addEventListener('click', () => setState('how'));
$('btn-shop').addEventListener('click', () => setState('shop'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => setState('menu')));
$('btn-pause').addEventListener('click', pauseGame);
$('btn-hint').addEventListener('click', useHint);
$('btn-review-back').addEventListener('click', backToResult);
$('btn-settings-back').addEventListener('click', leaveSettings);
$('btn-mute-menu').addEventListener('click', toggleMute);
$('screen-splash').addEventListener('click', () => state === 'splash' && setState('menu'));

/** Tutup Pengaturan: kembali ke Jeda bila dibuka dari sana, selain itu ke Menu. */
function leaveSettings() {
  if (settingsFrom === 'paused' && game && !game.finished) {
    settingsFrom = null;
    setState('paused');
    UI.focusPrimary($('pause-card'));
  } else {
    settingsFrom = null;
    setState('menu');
  }
}

/** Esc di layar non-permainan: kembali / tutup sesuai konteks (di Jeda, Input menangani Esc = lanjutkan). */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.repeat) return;
  if (state === 'levels' || state === 'how' || state === 'shop') setState('menu');
  else if (state === 'settings') leaveSettings();
  else if (state === 'review') backToResult();
  else if (state === 'result') setState('menu');
  else if (state === 'splash') setState('menu');
  else return;
  e.preventDefault();
});

// Audio baru dimulai setelah interaksi pertama; klik tombol berbunyi
const unlockAudio = () => Sound.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .icon-btn, .seg-btn, .level-cell')) Sound.play('click');
});

// Jeda otomatis saat tab / aplikasi tidak aktif
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});
window.addEventListener('blur', () => {
  if (state === 'playing') pauseGame();
});

// Cegah gestur bawaan browser saat bermain (zoom / gulir)
document.addEventListener('gesturestart', (e) => e.preventDefault());
stage.addEventListener('touchmove', (e) => { if (state === 'playing') e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (state === 'playing') e.preventDefault(); });

// Akses untuk debugging / pengujian di console
window.mathGunRunner = {
  startLevel, input, noAuto: false, setState,
  get game() { return game; }, get state() { return state; }, get renderer() { return renderer; },
};

setState('splash');
setTimeout(() => state === 'splash' && setState('menu'), 2200);
requestAnimationFrame(frame);
