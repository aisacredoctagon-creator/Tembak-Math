// Progres, bintang, koin, skin, dan pengaturan disimpan di localStorage (dengan cadangan di memori).
// Skema berversi: data lama otomatis dimigrasi dengan mengisi nilai bawaan.
import { CFG, DIFFICULTIES, FOCUS_LIST, SPEED_LIST } from './config.js';
import { SKINS, PETS } from './characters.js';

const KEY = 'mathGunRunner.v2';
export const SCHEMA = 3;

export const QUALITIES = ['rendah', 'sedang', 'tinggi'];

const defaults = () => ({
  schema: SCHEMA,
  settings: {
    difficulty: 'mudah', focus: 'campuran', speed: 'normal', sound: true, music: true,
    quality: 'tinggi', reduceMotion: false, haptic: true, colorblind: false,
  },
  stars: Object.fromEntries(DIFFICULTIES.map((d) => [d, new Array(CFG.levelsPerDifficulty).fill(0)])),
  wallet: { coins: 0, totalCoins: 0 },
  owned: { skins: ['klasik'], pets: [] },
  equipped: { skin: 'klasik', pet: null },
});

let data = defaults();

function sanitize(raw) {
  const out = defaults();
  if (!raw || typeof raw !== 'object') return out;
  const s = raw.settings || {};
  if (DIFFICULTIES.includes(s.difficulty)) out.settings.difficulty = s.difficulty;
  if (FOCUS_LIST.includes(s.focus)) out.settings.focus = s.focus;
  if (SPEED_LIST.includes(s.speed)) out.settings.speed = s.speed;
  if (QUALITIES.includes(s.quality)) out.settings.quality = s.quality;
  for (const k of ['sound', 'music', 'reduceMotion', 'haptic', 'colorblind']) {
    if (typeof s[k] === 'boolean') out.settings[k] = s[k];
  }
  for (const d of DIFFICULTIES) {
    const arr = raw.stars && raw.stars[d];
    if (Array.isArray(arr)) {
      for (let i = 0; i < CFG.levelsPerDifficulty; i++) {
        const v = Number(arr[i]);
        out.stars[d][i] = v >= 1 && v <= 3 ? Math.floor(v) : 0;
      }
    }
  }
  const w = raw.wallet || {};
  out.wallet.coins = Math.max(0, Math.floor(Number(w.coins) || 0));
  out.wallet.totalCoins = Math.max(out.wallet.coins, Math.floor(Number(w.totalCoins) || 0));
  const o = raw.owned || {};
  if (Array.isArray(o.skins)) out.owned.skins = ['klasik', ...o.skins.filter((id) => id !== 'klasik' && SKINS.some((k) => k.id === id))];
  if (Array.isArray(o.pets)) out.owned.pets = o.pets.filter((id) => PETS.some((p) => p.id === id));
  const e = raw.equipped || {};
  if (out.owned.skins.includes(e.skin)) out.equipped.skin = e.skin;
  if (out.owned.pets.includes(e.pet)) out.equipped.pet = e.pet;
  return out;
}

export function load() {
  try {
    data = sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    data = defaults();
  }
  return data;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    /* mode privat / penyimpanan penuh: abaikan, data tetap di memori */
  }
}

/** Hanya untuk tes: ganti data langsung. */
export function _reset(raw) {
  data = sanitize(raw);
  return data;
}

// ----- Pengaturan -----
export const getSettings = () => data.settings;

export function setSetting(name, value) {
  data.settings[name] = value;
  save();
}

// ----- Bintang & level -----
/** Bintang level (1-based); 0 = belum selesai. */
export const getStars = (diff, level) => data.stars[diff][level - 1] || 0;

/** Simpan bintang terbaik. */
export function setStars(diff, level, stars) {
  if (stars > getStars(diff, level)) {
    data.stars[diff][level - 1] = stars;
    save();
  }
}

/** Level 1 selalu terbuka; level berikutnya terbuka setelah level sebelumnya selesai. */
export const isUnlocked = (diff, level) => level === 1 || getStars(diff, level - 1) > 0;

/** Level pertama yang belum selesai (untuk tombol Main). */
export function nextLevel(diff) {
  for (let l = 1; l <= CFG.levelsPerDifficulty; l++) if (getStars(diff, l) === 0) return l;
  return CFG.levelsPerDifficulty;
}

export const totalStars = (diff) => data.stars[diff].reduce((a, b) => a + b, 0);

// ----- Koin, skin, pet -----
export const getCoins = () => data.wallet.coins;

export function addCoins(n) {
  const v = Math.max(0, Math.floor(n));
  data.wallet.coins += v;
  data.wallet.totalCoins += v;
  save();
  return data.wallet.coins;
}

export const ownsSkin = (id) => data.owned.skins.includes(id);
export const ownsPet = (id) => data.owned.pets.includes(id);
export const getEquipped = () => data.equipped;

/** Beli skin / pet. Mengembalikan true jika berhasil. */
export function buy(kind, id) {
  const list = kind === 'skin' ? SKINS : PETS;
  const item = list.find((x) => x.id === id);
  const owned = kind === 'skin' ? data.owned.skins : data.owned.pets;
  if (!item || owned.includes(id) || data.wallet.coins < item.price) return false;
  data.wallet.coins -= item.price;
  owned.push(id);
  save();
  return true;
}

/** Pakai skin / pet yang sudah dimiliki. `id = null` melepas pet. */
export function equip(kind, id) {
  if (kind === 'skin') {
    if (!data.owned.skins.includes(id)) return false;
    data.equipped.skin = id;
  } else {
    if (id !== null && !data.owned.pets.includes(id)) return false;
    data.equipped.pet = id;
  }
  save();
  return true;
}
