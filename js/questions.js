// Generator soal untuk semua jenis + validasi. Murni logika (tanpa DOM) sehingga bisa diuji di Node / browser.
//
// Bentuk soal:
//   { type, op, text, short, choices: [string], correct: index, answerLabel, explain, readFactor, key, meta }
//   - text   : soal lengkap (ditampilkan di HUD)
//   - short  : teks pendek untuk banner di jalur
//   - meta   : data untuk verifikasi (dipakai tes)
import { CFG, OP_SYMBOL } from './config.js';

// ---------- Utilitas ----------

/** RNG berbenih (mulberry32) untuk pengujian yang bisa diulang. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng, a, b) => {
  if (b < a) b = a;
  return a + Math.floor(rng() * (b - a + 1));
};
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 0 di level 1, 1 di level 30. */
export const levelT = (level) => clamp((level - 1) / (CFG.levelsPerDifficulty - 1), 0, 1);

const SYM = OP_SYMBOL;
const OPS = ['add', 'sub', 'mul', 'div'];

/** Hitung "3 × 4 + 5" dengan urutan operasi yang benar. NaN jika tidak valid / pembagian tidak bulat. */
export function evalExpression(text) {
  const tokens = String(text).replace(/\s+/g, '').match(/\d+|[+\-−×÷*/]/g);
  if (!tokens || tokens.length % 2 === 0) return NaN;
  const nums = [Number(tokens[0])];
  const ops = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (op === '×' || op === '*') {
      nums[nums.length - 1] *= n;
    } else if (op === '÷' || op === '/') {
      const cur = nums[nums.length - 1];
      if (n === 0 || cur % n !== 0) return NaN;
      nums[nums.length - 1] = cur / n;
    } else {
      ops.push(op);
      nums.push(n);
    }
  }
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) result = ops[i] === '+' ? result + nums[i + 1] : result - nums[i + 1];
  return result;
}

const calc = (op, a, b) => (op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : a / b);

const maxNum = (diff, t) =>
  diff === 'mudah' ? Math.round(lerp(10, 20, t)) : diff === 'sedang' ? Math.round(lerp(30, 100, t)) : Math.round(lerp(100, 500, t));

// ---------- Soal dasar satu operasi: a op b = answer ----------

function baseOp(op, diff, t, rng) {
  const maxN = maxNum(diff, t);
  let a, b, answer;
  switch (op) {
    case 'add':
      if (diff === 'mudah') {
        a = randInt(rng, 1, maxN);
        b = randInt(rng, 1, maxN);
      } else {
        const lo = diff === 'sedang' ? 5 : 20;
        a = randInt(rng, lo, maxN - lo);
        b = randInt(rng, lo, maxN - a);
      }
      answer = a + b;
      break;
    case 'sub': {
      const lo = diff === 'mudah' ? 2 : diff === 'sedang' ? 10 : 50;
      a = randInt(rng, lo, maxN);
      b = randInt(rng, diff === 'mudah' ? 1 : Math.max(1, Math.round(a * 0.1)), a - 1);
      answer = a - b;
      break;
    }
    case 'mul':
      if (diff === 'mudah') {
        const f = pick(rng, [2, 3, 5]);
        const k = randInt(rng, 1, Math.round(lerp(5, 10, t)));
        [a, b] = rng() < 0.5 ? [f, k] : [k, f];
      } else if (diff === 'sedang') {
        a = randInt(rng, 2, 10);
        b = randInt(rng, 2, Math.round(lerp(6, 10, t)));
      } else {
        a = randInt(rng, 3, Math.round(lerp(12, 25, t)));
        b = randInt(rng, 2, Math.round(lerp(10, 20, t)));
      }
      answer = a * b;
      break;
    default: {
      // bagi: dibangun dari hasil kali supaya selalu bulat dan tidak pernah dibagi nol
      let d, q;
      if (diff === 'mudah') {
        d = pick(rng, [2, 3, 5]);
        q = randInt(rng, 1, Math.round(lerp(5, 10, t)));
      } else if (diff === 'sedang') {
        d = randInt(rng, 2, 10);
        q = randInt(rng, 2, Math.round(lerp(6, 10, t)));
      } else {
        d = randInt(rng, 2, Math.round(lerp(12, 25, t)));
        q = randInt(rng, 2, Math.round(lerp(10, 20, t)));
      }
      a = d * q;
      b = d;
      answer = q;
      break;
    }
  }
  return { a, b, answer, op };
}

function explainOp(op, a, b, ans) {
  switch (op) {
    case 'add': return `${a} + ${b} = ${ans}. Tambahkan kedua angka.`;
    case 'sub': return `${a} − ${b} = ${ans}. Kurangkan ${b} dari ${a}.`;
    case 'mul': return `${a} × ${b} = ${ans}. Ada ${b} kelompok yang masing-masing berisi ${a}.`;
    default: return `${a} ÷ ${b} = ${ans}, karena ${b} × ${ans} = ${a}.`;
  }
}

const opHints = (b) => [b.a, b.b].filter((n) => n > 1 && n <= 25);

// ---------- Jenis soal (masing-masing mengembalikan soal mentah; pilihan dibuat oleh finish*) ----------

/** 1. Hitung langsung: 7 × 3 = ? */
function qDirect(op, diff, t, rng) {
  const b = baseOp(op, diff, t, rng);
  const expr = `${b.a} ${SYM[op]} ${b.b}`;
  return {
    type: 'direct', op, text: `${expr} = ?`, short: `${expr} = ?`, answer: b.answer, hints: opHints(b),
    explain: explainOp(op, b.a, b.b, b.answer), readFactor: 1, meta: { expr },
  };
}

/** 2. Angka hilang: □ + 9 = 17 */
function qMissing(op, diff, t, rng) {
  const b = baseOp(op, diff, t, rng);
  const hideFirst = rng() < 0.5;
  const s = SYM[op];
  const text = hideFirst ? `□ ${s} ${b.b} = ${b.answer}` : `${b.a} ${s} □ = ${b.answer}`;
  const hidden = hideFirst ? b.a : b.b;
  let how;
  if (hideFirst) {
    how = { add: `${b.answer} − ${b.b}`, sub: `${b.answer} + ${b.b}`, mul: `${b.answer} ÷ ${b.b}`, div: `${b.answer} × ${b.b}` }[op];
  } else {
    how = { add: `${b.answer} − ${b.a}`, sub: `${b.a} − ${b.answer}`, mul: `${b.answer} ÷ ${b.a}`, div: `${b.a} ÷ ${b.answer}` }[op];
  }
  return {
    type: 'missing', op, text, short: text, answer: hidden, hints: [hideFirst ? b.b : b.a],
    explain: `Angka yang hilang: ${how} = ${hidden}.`, readFactor: 1.1, meta: { hidden },
  };
}

/** 3. Pilih operasi: 12 ? 4 = 3 (tepat satu operasi yang benar) */
function qChooseOp(op, diff, t, rng, count) {
  for (let tries = 0; tries < 40; tries++) {
    const b = baseOp(op, diff, t, rng);
    const valid = OPS.filter((o) => {
      const v = calc(o, b.a, b.b);
      return Number.isInteger(v) && v === b.answer;
    });
    if (valid.length !== 1) continue;
    const others = shuffle(rng, OPS.filter((o) => o !== op)).slice(0, Math.max(1, count - 1));
    const choices = shuffle(rng, [op, ...others]).map((o) => SYM[o]);
    return {
      type: 'chooseOp', op, text: `${b.a} ? ${b.b} = ${b.answer}`, short: `${b.a} ? ${b.b} = ${b.answer}`,
      choices, correct: choices.indexOf(SYM[op]), answerLabel: SYM[op],
      explain: `${b.a} ${SYM[op]} ${b.b} = ${b.answer}, jadi operasinya ${SYM[op]}.`, readFactor: 1.15,
      meta: { a: b.a, b: b.b, result: b.answer },
    };
  }
  return null;
}

/** Ekspresi satu operasi yang bernilai tepat v, atau null. */
function exprWithValue(op, v, diff, t, rng) {
  const cap = maxNum(diff, t);
  switch (op) {
    case 'add': {
      if (v < 2) return null;
      const x = randInt(rng, 1, v - 1);
      return `${x} + ${v - x}`;
    }
    case 'sub': {
      const room = cap - v;
      if (room < 1) return null;
      const y = randInt(rng, 1, Math.min(Math.max(1, Math.round(cap / 2)), room));
      return `${v + y} − ${y}`;
    }
    case 'mul': {
      const ds = [];
      for (let d = 2; d * 2 <= v; d++) if (v % d === 0) ds.push(d);
      if (!ds.length) return null;
      const d = pick(rng, ds);
      return `${d} × ${v / d}`;
    }
    default: {
      const maxD = Math.min(9, Math.floor(cap / Math.max(1, v)));
      if (maxD < 2 || v < 1) return null;
      const d = randInt(rng, 2, maxD);
      return `${v * d} ÷ ${d}`;
    }
  }
}

/** 4. Perbandingan: 6 × 4 ... 5 × 5 (pilihan > < =) */
function qCompare(op, diff, t, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const b = baseOp(op, diff, t, rng);
    const left = `${b.a} ${SYM[op]} ${b.b}`;
    const delta = rng() < 0.28 ? 0 : pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
    const v2 = b.answer + delta;
    if (v2 < 1) continue;
    const right = exprWithValue(op, v2, diff, t, rng);
    if (!right || right === left) continue;
    const swap = rng() < 0.5;
    const [L, R, vL, vR] = swap ? [right, left, v2, b.answer] : [left, right, b.answer, v2];
    const rel = vL > vR ? '>' : vL < vR ? '<' : '=';
    const choices = shuffle(rng, ['>', '<', '=']);
    return {
      type: 'compare', op, text: `${L} ... ${R}`, short: `${L} ... ${R}`, choices, correct: choices.indexOf(rel), answerLabel: rel,
      explain: `${L} = ${vL} dan ${R} = ${vR}, jadi ${vL} ${rel} ${vR}.`, readFactor: 1.2, meta: { L, R, rel },
    };
  }
  return null;
}

/** 5. Dua langkah: 3 × 4 + 5 = ? (urutan operasi standar) */
function qTwoStep(focus, t, rng) {
  let expr, answer, explain, hints = [];
  switch (focus) {
    case 'add': {
      const a = randInt(rng, 10, 150), b = randInt(rng, 10, 150), c = randInt(rng, 10, 150);
      expr = `${a} + ${b} + ${c}`; answer = a + b + c;
      explain = `${a} + ${b} = ${a + b}, lalu + ${c} = ${answer}.`;
      break;
    }
    case 'sub': {
      const a = randInt(rng, 80, 500);
      const b = randInt(rng, 5, Math.floor(a / 3)), c = randInt(rng, 5, Math.floor(a / 3));
      expr = `${a} − ${b} − ${c}`; answer = a - b - c;
      explain = `${a} − ${b} = ${a - b}, lalu − ${c} = ${answer}.`;
      break;
    }
    case 'mul': {
      const a = randInt(rng, 2, 9), b = randInt(rng, 2, 9), c = randInt(rng, 2, 6);
      expr = `${a} × ${b} × ${c}`; answer = a * b * c; hints = [a * b];
      explain = `${a} × ${b} = ${a * b}, lalu × ${c} = ${answer}.`;
      break;
    }
    case 'div': {
      const b = randInt(rng, 2, 9), c = randInt(rng, 2, 9), q = randInt(rng, 2, 6);
      const N = q * b * c;
      expr = `${N} ÷ ${b} ÷ ${c}`; answer = q; hints = [N / b];
      explain = `${N} ÷ ${b} = ${N / b}, lalu ÷ ${c} = ${q}.`;
      break;
    }
    default: {
      const kind = randInt(rng, 1, 5);
      if (kind === 1) {
        const a = randInt(rng, 3, 12), b = randInt(rng, 2, 12), c = randInt(rng, 2, 60);
        expr = `${a} × ${b} + ${c}`; answer = a * b + c; hints = [c];
        explain = `Kali dulu: ${a} × ${b} = ${a * b}, lalu + ${c} = ${answer}.`;
      } else if (kind === 2) {
        const a = randInt(rng, 3, 12), b = randInt(rng, 2, 12);
        const c = randInt(rng, 1, Math.min(60, a * b - 1));
        expr = `${a} × ${b} − ${c}`; answer = a * b - c; hints = [c];
        explain = `Kali dulu: ${a} × ${b} = ${a * b}, lalu − ${c} = ${answer}.`;
      } else if (kind === 3) {
        const a = randInt(rng, 5, 80), b = randInt(rng, 2, 12), c = randInt(rng, 2, 12);
        expr = `${a} + ${b} × ${c}`; answer = a + b * c; hints = [b * c, a];
        explain = `Kali dulu: ${b} × ${c} = ${b * c}, lalu ${a} + ${b * c} = ${answer}.`;
      } else if (kind === 4) {
        const b = randInt(rng, 2, 12), q = randInt(rng, 2, 30), c = randInt(rng, 2, 80);
        expr = `${b * q} ÷ ${b} + ${c}`; answer = q + c; hints = [c];
        explain = `Bagi dulu: ${b * q} ÷ ${b} = ${q}, lalu + ${c} = ${answer}.`;
      } else {
        const b = randInt(rng, 2, 10), c = randInt(rng, 2, 10), r = randInt(rng, 1, 60);
        expr = `${b * c + r} − ${b} × ${c}`; answer = r; hints = [b * c];
        explain = `Kali dulu: ${b} × ${c} = ${b * c}, lalu ${b * c + r} − ${b * c} = ${r}.`;
      }
    }
  }
  return {
    type: 'twoStep', op: focus === 'campuran' ? 'mix' : focus, text: `${expr} = ?`, short: `${expr} = ?`, answer, hints,
    explain, readFactor: 1.3, meta: { expr },
  };
}

const NAMES = ['Rina', 'Budi', 'Dewi', 'Andi', 'Sari', 'Doni'];
const ITEMS = ['peluru', 'kelereng', 'kartu', 'apel', 'stiker', 'kue'];

/** 6. Soal cerita singkat dengan template dan angka acak. */
function qStory(op, diff, t, rng) {
  const n = pick(rng, NAMES);
  const it = pick(rng, ITEMS);
  let text, answer, expr, explain, hints = [], factor = 1.6;

  const hardMixed = diff === 'sulit' && rng() < 0.55;
  if (diff === 'sulit' && (hardMixed || op !== 'mix')) {
    if (hardMixed && op === 'mix') {
      const kind = randInt(rng, 1, 4);
      if (kind === 1) {
        const k = randInt(rng, 3, 12), m = randInt(rng, 4, 25);
        const s = randInt(rng, 1, Math.floor((k * m) / 2));
        text = `Toko punya ${k} kotak ${it}. Tiap kotak berisi ${m} ${it}. Hari ini terjual ${s} ${it}. Berapa ${it} yang tersisa?`;
        expr = `${k} × ${m} − ${s}`; answer = k * m - s; hints = [k * m];
        explain = `${k} × ${m} = ${k * m}, lalu ${k * m} − ${s} = ${answer}.`;
      } else if (kind === 2) {
        const k = randInt(rng, 3, 12), m = randInt(rng, 4, 20), c = randInt(rng, 3, 40);
        text = `${n} membeli ${k} bungkus ${it}, tiap bungkus berisi ${m} buah. Lalu ${n} mendapat ${c} buah lagi dari temannya. Berapa total ${it} ${n} sekarang?`;
        expr = `${k} × ${m} + ${c}`; answer = k * m + c; hints = [c];
        explain = `${k} × ${m} = ${k * m}, lalu + ${c} = ${answer}.`;
      } else if (kind === 3) {
        const d = randInt(rng, 3, 12), q = randInt(rng, 4, 30), c = randInt(rng, 2, 25);
        text = `${d * q} ${it} dibagi rata ke ${d} kotak. Kemudian tiap kotak ditambah ${c} ${it}. Berapa isi tiap kotak sekarang?`;
        expr = `${d * q} ÷ ${d} + ${c}`; answer = q + c; hints = [c];
        explain = `${d * q} ÷ ${d} = ${q}, lalu + ${c} = ${answer}.`;
      } else {
        const a = randInt(rng, 60, 400), b = randInt(rng, 5, Math.floor(a / 3)), c = randInt(rng, 5, Math.floor(a / 3));
        text = `${n} punya ${a} ${it}. ${n} memberi ${b} ${it} kepada Budi dan ${c} ${it} kepada Sari. Berapa ${it} yang tersisa?`;
        expr = `${a} − ${b} − ${c}`; answer = a - b - c;
        explain = `${a} − ${b} = ${a - b}, lalu − ${c} = ${answer}.`;
      }
      factor = 1.9;
    } else {
      // sulit dengan fokus: tiga angka dengan operasi yang sama
      const o = op === 'mix' ? pick(rng, OPS) : op;
      if (o === 'add') {
        const a = randInt(rng, 20, 150), b = randInt(rng, 10, 150), c = randInt(rng, 10, 150);
        text = `${n} punya ${a} ${it}, diberi ${b} oleh ayah dan ${c} oleh ibu. Berapa ${it} ${n} sekarang?`;
        expr = `${a} + ${b} + ${c}`; answer = a + b + c;
        explain = `${a} + ${b} = ${a + b}, lalu + ${c} = ${answer}.`;
      } else if (o === 'sub') {
        const a = randInt(rng, 80, 500), b = randInt(rng, 5, Math.floor(a / 3)), c = randInt(rng, 5, Math.floor(a / 3));
        text = `${n} punya ${a} ${it}. Sebanyak ${b} ${it} dipakai pagi hari dan ${c} ${it} dipakai sore hari. Berapa ${it} yang tersisa?`;
        expr = `${a} − ${b} − ${c}`; answer = a - b - c;
        explain = `${a} − ${b} = ${a - b}, lalu − ${c} = ${answer}.`;
      } else if (o === 'mul') {
        const a = randInt(rng, 2, 6), b = randInt(rng, 2, 6), c = randInt(rng, 2, 9);
        text = `Ada ${a} rak. Tiap rak berisi ${b} kotak, dan tiap kotak berisi ${c} ${it}. Berapa total ${it}?`;
        expr = `${a} × ${b} × ${c}`; answer = a * b * c; hints = [a * b];
        explain = `${a} × ${b} = ${a * b}, lalu × ${c} = ${answer}.`;
      } else {
        const b = randInt(rng, 2, 9), c = randInt(rng, 2, 9), q = randInt(rng, 2, 6);
        text = `${q * b * c} ${it} dibagi rata ke ${b} kotak, lalu isi tiap kotak dibagi lagi ke ${c} kantong. Berapa ${it} di tiap kantong?`;
        expr = `${q * b * c} ÷ ${b} ÷ ${c}`; answer = q; hints = [q * c];
        explain = `${q * b * c} ÷ ${b} = ${q * c}, lalu ÷ ${c} = ${q}.`;
      }
      factor = 1.8;
    }
  } else {
    const o = op === 'mix' ? pick(rng, OPS) : op;
    const b = baseOp(o, diff, t, rng);
    const { a, b: bb } = b;
    const variants = {
      add: [
        `${n} punya ${a} ${it}. Lalu ${n} diberi ${bb} ${it} lagi. Berapa ${it} ${n} sekarang?`,
        `Di kotak merah ada ${a} ${it}, di kotak biru ada ${bb} ${it}. Berapa jumlah ${it} semuanya?`,
      ],
      sub: [
        `${n} punya ${a} ${it}. Sebanyak ${bb} ${it} diberikan kepada adiknya. Berapa ${it} ${n} yang tersisa?`,
        `Ada ${a} ${it} di dalam tas. Lalu ${bb} ${it} jatuh. Berapa ${it} yang masih ada di tas?`,
      ],
      mul: [
        `Ada ${a} kotak. Tiap kotak berisi ${bb} ${it}. Berapa total ${it}?`,
        `${n} membeli ${a} bungkus ${it}. Setiap bungkus berisi ${bb} buah. Berapa ${it} yang ${n} punya?`,
      ],
      div: [
        `${a} ${it} dibagi sama banyak kepada ${bb} anak. Berapa ${it} yang diterima tiap anak?`,
        `${a} ${it} dimasukkan ke dalam kotak, tiap kotak berisi ${bb} ${it}. Berapa kotak yang dibutuhkan?`,
      ],
    };
    text = pick(rng, variants[o]);
    answer = b.answer;
    expr = `${a} ${SYM[o]} ${bb}`;
    explain = explainOp(o, a, bb, answer);
    hints = opHints(b);
    factor = 1.6;
  }
  return {
    type: 'story', op: op === 'mix' ? 'mix' : op, text, short: 'SOAL CERITA', answer, hints, explain,
    readFactor: factor, meta: { expr },
  };
}

/** 7. Pola angka: 2, 4, 8, ? (sulit) */
function qPattern(op, t, rng) {
  let seq, answer, rule, step;
  const kind = op === 'mix' ? pick(rng, ['add', 'sub', 'mul', 'div', 'grow']) : op === 'add' && rng() < 0.3 ? 'grow' : op;
  switch (kind) {
    case 'add': {
      const s = randInt(rng, 2, 60), d = randInt(rng, 2, Math.round(lerp(6, 25, t)));
      seq = [0, 1, 2, 3].map((i) => s + i * d); answer = s + 4 * d; step = d;
      rule = `Tiap suku ditambah ${d}. ${seq[3]} + ${d} = ${answer}.`;
      break;
    }
    case 'sub': {
      const d = randInt(rng, 2, 12), s = randInt(rng, d * 5, d * 5 + 120);
      seq = [0, 1, 2, 3].map((i) => s - i * d); answer = s - 4 * d; step = d;
      rule = `Tiap suku dikurangi ${d}. ${seq[3]} − ${d} = ${answer}.`;
      break;
    }
    case 'mul': {
      const r = pick(rng, [2, 2, 3]);
      const s = randInt(rng, 1, Math.min(9, Math.floor(500 / r ** 3)));
      seq = [0, 1, 2].map((i) => s * r ** i); answer = s * r ** 3; step = r;
      rule = `Tiap suku dikali ${r}. ${seq[2]} × ${r} = ${answer}.`;
      break;
    }
    case 'div': {
      const r = pick(rng, [2, 2, 3]);
      const e = randInt(rng, 1, Math.min(9, Math.floor(500 / r ** 3)));
      seq = [3, 2, 1].map((i) => e * r ** i); answer = e; step = r;
      rule = `Tiap suku dibagi ${r}. ${seq[2]} ÷ ${r} = ${answer}.`;
      break;
    }
    default: {
      // selisih bertambah: s, s+d, s+d+(d+1), ...
      const s = randInt(rng, 1, 30), d0 = randInt(rng, 1, 3);
      seq = [s];
      for (let i = 0; i < 3; i++) seq.push(seq[i] + d0 + i);
      answer = seq[3] + d0 + 3; step = d0 + 3;
      rule = `Selisihnya naik 1 tiap langkah (${d0}, ${d0 + 1}, ${d0 + 2}, ...). ${seq[3]} + ${d0 + 3} = ${answer}.`;
    }
  }
  const text = `${seq.join(', ')}, ?`;
  return {
    type: 'pattern', op: kind === 'grow' ? 'add' : kind, text, short: text, answer, hints: [step],
    explain: `Pola: ${rule}`, readFactor: 1.2, meta: { seq, kind, next: answer },
  };
}

// ---------- Pembuatan pilihan + generator utama ----------

function finishNumeric(q, count, rng) {
  const wrongs = makeDistractors(q.answer, count - 1, rng, q.hints || []);
  const labels = shuffle(rng, [String(q.answer), ...wrongs.map(String)]);
  q.choices = labels;
  q.correct = labels.indexOf(String(q.answer));
  q.answerLabel = String(q.answer);
  return q;
}

/**
 * Buat `count` jawaban salah yang masuk akal (dekat dengan jawaban benar),
 * bilangan bulat, tidak negatif, tidak sama dengan jawaban benar, dan tidak duplikat.
 */
export function makeDistractors(answer, count = 1, rng = Math.random, hints = []) {
  const spread = Math.max(3, Math.round(answer * 0.1));
  const pool = new Set();
  [1, 2, 3, 10].forEach((d) => {
    pool.add(answer + d);
    pool.add(answer - d);
  });
  hints.forEach((h) => {
    if (h > 0) {
      pool.add(answer + h);
      pool.add(answer - h);
    }
  });
  for (let i = 0; i < 8; i++) pool.add(answer + (rng() < 0.5 ? -1 : 1) * randInt(rng, 1, spread));

  const ranked = [...pool]
    .filter((v) => Number.isInteger(v) && v >= 0 && v !== answer)
    .map((v) => ({ v, k: Math.abs(v - answer) + rng() * spread }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.v);

  const out = ranked.slice(0, count);
  for (let k = 1; out.length < count; k++) {
    const v = answer + k;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Jenis soal yang tersedia per tingkat beserta bobotnya. */
export const TYPE_WEIGHTS = {
  mudah: { direct: 70, missing: 30 },
  sedang: { direct: 35, missing: 20, chooseOp: 15, compare: 15, story: 15 },
  sulit: { direct: 15, missing: 12, chooseOp: 10, compare: 10, twoStep: 20, story: 18, pattern: 15 },
};

function pickType(diff, rng) {
  const w = TYPE_WEIGHTS[diff];
  let r = rng() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [type, weight] of Object.entries(w)) {
    r -= weight;
    if (r < 0) return type;
  }
  return 'direct';
}

/** Banyak pilihan gerbang (2 atau 3), makin banyak 3 di level tinggi. */
export function gateChoiceCount(level, rng = Math.random) {
  const t = levelT(level);
  if (t < 0.25) return 2;
  if (t < 0.6) return rng() < 0.5 ? 2 : 3;
  return rng() < 0.7 ? 3 : 2;
}

/**
 * Buat satu soal.
 * opts: { choices: 2|3, type: paksa jenis soal }
 */
export function generateQuestion(diff, focus = 'campuran', level = 1, rng = Math.random, opts = {}) {
  const t = levelT(level);
  const count = clamp(opts.choices || 3, 2, 3);
  const opFor = () => (focus === 'campuran' ? pick(rng, OPS) : focus);
  for (let tries = 0; tries < 40; tries++) {
    const type = opts.type && tries < 20 ? opts.type : pickType(diff, rng);
    let q = null;
    switch (type) {
      case 'missing': q = finishNumeric(qMissing(opFor(), diff, t, rng), count, rng); break;
      case 'chooseOp': q = qChooseOp(opFor(), diff, t, rng, count); break;
      case 'compare': q = qCompare(opFor(), diff, t, rng); break;
      case 'twoStep': q = finishNumeric(qTwoStep(focus, t, rng), count, rng); break;
      case 'story': q = finishNumeric(qStory(focus === 'campuran' ? 'mix' : focus, diff, t, rng), count, rng); break;
      case 'pattern': q = finishNumeric(qPattern(focus === 'campuran' ? 'mix' : focus, t, rng), count, rng); break;
      default: q = finishNumeric(qDirect(opFor(), diff, t, rng), count, rng);
    }
    if (q && Number.isInteger(q.answer ?? 0) && (q.answer === undefined || q.answer >= 0)) {
      q.key = `${q.type}|${q.text}`;
      return q;
    }
  }
  const q = finishNumeric({
    type: 'direct', op: 'add', text: '2 + 3 = ?', short: '2 + 3 = ?', answer: 5, hints: [],
    explain: '2 + 3 = 5.', readFactor: 1, meta: { expr: '2 + 3' },
  }, count, rng);
  q.key = 'direct|2 + 3 = ?';
  return q;
}

/** Soal berurutan untuk satu level: tidak ada soal yang sama dua kali. Soal pertama selalu hitung langsung. */
export class QuestionDeck {
  constructor(diff, focus, level, rng = Math.random) {
    this.diff = diff;
    this.focus = focus;
    this.level = level;
    this.rng = rng;
    this.seen = new Set();
    this.count = 0;
  }

  next(opts = {}) {
    let q;
    for (let tries = 0; tries < 30; tries++) {
      q = generateQuestion(this.diff, this.focus, this.level, this.rng, {
        choices: opts.choices,
        type: this.count === 0 ? 'direct' : undefined,
      });
      if (!this.seen.has(q.key)) break;
    }
    this.seen.add(q.key);
    this.count++;
    return q;
  }
}
