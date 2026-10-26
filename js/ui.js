// Lapisan UI DOM: komponen pop-up (Modal, StarRating, StatRow, CoinReward), HUD, latar angkasa, fokus.
// Gaya ada di css/components.css (token dari Figma). Logika game tetap di main.js / game.js.
import { COIN_ICON, TOKENS } from './config.js';

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const fmtNum = (n) => Math.round(n).toLocaleString('id-ID');
export const fmtMult = (m) => String(m).replace('.', ',');
export const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function h(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

const reducedMotion = () =>
  document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Latar angkasa (Figma node 2:6) ----------

function starDot(size, color, opacity, style) {
  const s = h('i', 'star-dot');
  s.style.cssText = `width:${size}px;height:${size}px;background:${color};--o:${opacity};opacity:${opacity};animation-delay:${(-Math.random() * 3).toFixed(2)}s;${style}`;
  return s;
}

/** Bintang acuan dari desain + bintang acak bergaya sama, untuk latar halaman dan latar kontainer game. */
export function buildSpace() {
  const page = document.getElementById('space');
  const stage = document.getElementById('stage-space');
  const palette = TOKENS.starColors;
  for (let i = 0; i < 70; i++) {
    const size = [2, 3, 4, 4, 6][i % 5];
    page.appendChild(starDot(size, palette[i % 3], (0.3 + Math.random() * 0.5).toFixed(2), `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 85).toFixed(1)}%;`));
  }
  const d = 'var(--d)';
  // posisi acuan (lebar desain 388): kiri 32/atas 40, kiri 96/atas 96, kanan 64/atas 32, kanan 32/atas 144
  stage.appendChild(starDot(4, '#ffffff', 0.6, `left:calc(${d}*32);top:calc(${d}*40);`));
  stage.appendChild(starDot(6, '#fef08a', 0.7, `left:calc(${d}*96);top:calc(${d}*96);`));
  stage.appendChild(starDot(4, '#ffffff', 0.5, `right:calc(${d}*64);top:calc(${d}*32);`));
  stage.appendChild(starDot(4, '#d8b4fe', 0.8, `right:calc(${d}*32);top:calc(${d}*144);`));
  for (let i = 0; i < 26; i++) {
    const size = [2, 3, 4, 4][i % 4];
    stage.appendChild(starDot(size, palette[i % 3], (0.3 + Math.random() * 0.5).toFixed(2), `left:${(Math.random() * 98).toFixed(1)}%;top:${(Math.random() * 68).toFixed(1)}%;`));
  }
}

// ---------- Koin ----------

/** Koin kecil (untuk chip koin dan tombol Toko). */
export const coinHTML = (mini = true) =>
  `<span class="coin${mini ? ' mini' : ''}"><span class="coin-in">${COIN_ICON}</span></span>`;

export function setCoinChip(el, n) {
  el.innerHTML = `${coinHTML()}<span>${fmtNum(n)}</span>`;
}

/** Animasi angka naik (count-up). */
export function countUp(el, to, ms, prefix = '') {
  const t0 = performance.now();
  const instant = reducedMotion();
  const tick = (now) => {
    const k = instant ? 1 : Math.min(1, (now - t0) / ms);
    el.textContent = prefix + fmtNum(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- StarRating ----------

function starEl(index, earned) {
  const star = h('div', `star star-${index + 1} ${earned ? 'star-on' : 'star-dim'}`);
  const rot = h('div', 'star-rot');
  const body = h('div', 'star-body');
  const art = h('div', 'star-art');
  const inner = h('div', 'star-art-in');
  const img = document.createElement('img');
  img.alt = '';
  img.src = earned ? (index === 1 ? 'assets/star-gold-center.svg' : 'assets/star-gold-left.svg') : 'assets/star-dim.svg';
  inner.appendChild(img);
  art.appendChild(inner);
  body.appendChild(art);
  if (earned) body.appendChild(h('div', 'star-hi'));
  rot.appendChild(body);
  star.appendChild(rot);
  return star;
}

/**
 * 3 bintang sejajar (rotasi -6 / 3 / 6 derajat). Yang diraih emas dengan halo berdenyut,
 * yang belum diraih ungu-abu redup. Bintang masuk berurutan (jeda 250 ms); onStar(i) dipanggil tiap bintang emas.
 */
export function starRating(count, onStar) {
  const wrap = h('div', 'stars');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${count} dari 3 bintang`);
  const instant = reducedMotion();
  const timers = [];
  for (let i = 0; i < 3; i++) {
    const earned = i < count;
    const el = starEl(i, earned);
    wrap.appendChild(el);
    if (instant) continue;
    el.classList.add('pre');
    timers.push(setTimeout(() => {
      el.classList.remove('pre');
      el.classList.add('show');
      if (earned && onStar) onStar(i);
    }, 300 + i * 250));
  }
  if (instant && onStar) for (let i = 0; i < count; i++) onStar(i);
  wrap.cancel = () => timers.forEach(clearTimeout);
  return wrap;
}

// ---------- Modal ----------

function button(id, label, cls, onClick) {
  const b = h('button', `btn ${cls || ''}`.trim());
  b.type = 'button';
  b.id = id;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

let activeStars = null;

/** Fokus pertama pada tombol utama (aksesibilitas keyboard). */
export function focusPrimary(card) {
  const target = card.querySelector('.btn-primary') || card.querySelector('.btn');
  if (target) target.focus({ preventScroll: true });
}

/**
 * Pop-up Menang / Kalah (Figma node 2:36).
 * data: { won, title, headline, accuracy, combo, time, coins, stars, wrongs, hasNext }
 * handlers: { next, review, retry, menu, onStar }
 */
export function renderResultCard(card, data, handlers) {
  if (activeStars) activeStars.cancel();
  card.textContent = '';
  card.classList.toggle('lose', !data.won);
  card.appendChild(h('h2', 'modal-title', esc(data.title)));
  activeStars = starRating(data.won ? data.stars : 0, handlers.onStar);
  card.appendChild(activeStars);

  const stats = h('div', 'stats');
  stats.appendChild(h('div', 'stat-main', esc(data.headline)));
  stats.appendChild(h('div', 'stat-acc', `Akurasi: <b>${esc(data.accuracy)}</b>`));
  stats.appendChild(h('div', 'stat-sub', `Combo tertinggi: ${data.combo} <span class="dot">·</span> Waktu: ${esc(data.time)}`));
  card.appendChild(stats);

  const reward = h('div', 'coin-reward' + (data.coins > 0 ? '' : ' hidden'));
  reward.innerHTML = `<span class="coin"><span class="coin-in">${COIN_ICON}</span></span><span class="coin-value"><span id="coin-n">+0</span> koin</span>`;
  card.appendChild(reward);
  if (data.coins > 0) countUp(reward.querySelector('#coin-n'), data.coins, 900, '+');

  const actions = h('div', 'modal-actions');
  const col = h('div', 'btn-col');
  if (data.won && data.hasNext) col.appendChild(button('btn-next', 'Level Berikutnya', 'btn-primary', handlers.next));
  if (data.wrongs > 0) col.appendChild(button('btn-review', `Ulasan Soal Salah (${data.wrongs})`, '', handlers.review));
  col.appendChild(button('btn-retry', 'Ulangi', data.won && data.hasNext ? '' : 'btn-primary', handlers.retry));
  col.appendChild(button('btn-result-menu', 'Menu', '', handlers.menu));
  actions.appendChild(col);
  card.appendChild(actions);
  // urutan sesuai desain: Level Berikutnya, Ulasan, Ulangi, Menu; pada kalah tombol utama = Ulangi
  if (!data.won) {
    const retry = col.querySelector('#btn-retry');
    col.prepend(retry);
  }
  card.scrollTop = 0;
}

/** Pop-up Jeda: Lanjutkan (utama), Ulangi, Pengaturan, Menu. */
export function renderPauseCard(card, handlers, title) {
  card.textContent = '';
  card.appendChild(h('h2', 'modal-title small', esc(title)));
  const actions = h('div', 'modal-actions');
  const col = h('div', 'btn-col');
  col.appendChild(button('btn-resume', 'Lanjutkan', 'btn-primary', handlers.resume));
  col.appendChild(button('btn-restart', 'Ulangi', '', handlers.restart));
  col.appendChild(button('btn-pause-settings', 'Pengaturan', '', handlers.settings));
  col.appendChild(button('btn-quit', 'Menu', '', handlers.menu));
  actions.appendChild(col);
  card.appendChild(actions);
}

// ---------- HUD ----------

/** Pill combo di header: muncul saat combo >= 1 dan "pop" tiap naik. */
export function setCombo(streak, mult) {
  const pill = document.getElementById('hud-combo');
  const was = pill.dataset.streak ? Number(pill.dataset.streak) : 0;
  pill.dataset.streak = streak;
  pill.classList.toggle('is-off', streak < 1);
  if (streak >= 1) {
    document.getElementById('combo-n').textContent = `Combo ${streak}`;
    document.getElementById('combo-m').textContent = `×${fmtMult(mult)}`;
    if (streak > was && !reducedMotion()) {
      pill.classList.remove('pop');
      void pill.offsetWidth; // mulai ulang animasi
      pill.classList.add('pop');
    }
  }
}
