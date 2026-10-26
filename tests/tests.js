// Tes generator soal, level, dan simulasi permainan.
// Jalankan di browser: buka tests/index.html lewat server statis. Atau di Node: `node tests/run.js`.
import { CFG, DIFFICULTIES, FOCUS_LIST, SPEED_LIST, OP_SYMBOL } from '../js/config.js';
import * as Q from '../js/questions.js';
import {
  Game, generateLevel, verifyLevel, simulatePerfect, thinkTime, comboMult, correctGain, laneAt, laneCenter, laneBounds,
  isBigBoss, worldOf, bossQuestionCount,
} from '../js/game.js';

import { SKINS, PETS, getSkin, getPet } from '../js/characters.js';
import * as Store from '../js/storage.js';

const SYMS = Object.values(OP_SYMBOL);
const MIN_THINK = { mudah: 5, sedang: 4, sulit: 3.5 }; // detik, mode Normal

/** Substitusi □ lalu periksa persamaan "kiri = kanan". */
function equationHolds(text, value) {
  const [l, r] = text.replace('□', String(value)).split(' = ');
  return Q.evalExpression(l) === Number(r);
}

/** Verifikasi satu soal; mengembalikan daftar pesan kesalahan (kosong = valid). */
export function validateQuestion(q, ctx) {
  const errs = [];
  const { diff, focus } = ctx;
  const tag = `${diff}/${focus}/${q.type} "${q.text}"`;
  const bad = (m) => errs.push(`${m}: ${tag}`);

  if (!Object.keys(Q.TYPE_WEIGHTS[diff]).includes(q.type)) bad('jenis tidak diizinkan di tingkat ini');
  if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 3) bad('jumlah pilihan harus 2-3');
  if (new Set(q.choices).size !== q.choices.length) bad('pilihan duplikat');
  if (!(q.correct >= 0 && q.correct < q.choices.length) || q.choices[q.correct] !== q.answerLabel) bad('indeks jawaban benar salah');
  if (!q.explain || !q.short || !q.text) bad('teks / penjelasan kosong');
  if (!(q.readFactor >= 1)) bad('readFactor');
  if (/÷ 0(\D|$)/.test(q.text)) bad('pembagian dengan nol');
  if (!/^[^\s].*[^\s]$/.test(q.text)) bad('spasi tepi');

  const numeric = q.choices.every((c) => /^\d+$/.test(c));
  const nums = (q.text.match(/\d+/g) || []).map(Number);
  const ops = q.text.match(/[+−×÷]/g) || [];

  switch (q.type) {
    case 'direct': {
      if (!/^\d+ [+−×÷] \d+ = \?$/.test(q.text)) bad('format direct');
      if (Q.evalExpression(q.meta.expr) !== Number(q.answerLabel)) bad('jawaban direct salah');
      break;
    }
    case 'missing': {
      if (!/□/.test(q.text) || !equationHolds(q.text, q.answerLabel)) bad('angka hilang salah');
      for (const w of q.choices) if (w !== q.answerLabel && equationHolds(q.text, w)) bad('distraktor juga benar (angka hilang)');
      break;
    }
    case 'chooseOp': {
      const { a, b, result } = q.meta;
      const valid = Object.entries(OP_SYMBOL).filter(([, s]) => {
        const v = s === '+' ? a + b : s === '−' ? a - b : s === '×' ? a * b : a / b;
        return Number.isInteger(v) && v === result;
      });
      if (valid.length !== 1 || valid[0][1] !== q.answerLabel) bad('pilih operasi: harus tepat satu operasi benar');
      if (!q.choices.every((c) => SYMS.includes(c))) bad('pilihan operasi');
      break;
    }
    case 'compare': {
      const vL = Q.evalExpression(q.meta.L), vR = Q.evalExpression(q.meta.R);
      const rel = vL > vR ? '>' : vL < vR ? '<' : '=';
      if (q.answerLabel !== rel || Number.isNaN(vL) || Number.isNaN(vR)) bad('perbandingan salah');
      if (q.choices.slice().sort().join('') !== ['<', '=', '>'].sort().join('')) bad('pilihan perbandingan harus > < =');
      if (q.meta.L === q.meta.R) bad('dua sisi sama persis');
      break;
    }
    case 'twoStep': {
      if (ops.length !== 2) bad('dua langkah harus dua operasi');
      if (Q.evalExpression(q.meta.expr) !== Number(q.answerLabel)) bad('jawaban dua langkah salah');
      break;
    }
    case 'story': {
      if (Q.evalExpression(q.meta.expr) !== Number(q.answerLabel)) bad('jawaban soal cerita salah');
      if (q.text.length < 25 || !/\?$/.test(q.text)) bad('soal cerita harus kalimat tanya');
      break;
    }
    case 'pattern': {
      const { seq, kind, next } = q.meta;
      const d = seq.map((v, i) => (i ? v - seq[i - 1] : null)).slice(1);
      const r = seq.map((v, i) => (i ? v / seq[i - 1] : null)).slice(1);
      let ok = false;
      if (kind === 'add') ok = d.every((x) => x === d[0] && x > 0) && next === seq[seq.length - 1] + d[0];
      else if (kind === 'sub') ok = d.every((x) => x === d[0] && x < 0) && next === seq[seq.length - 1] + d[0];
      else if (kind === 'mul') ok = r.every((x) => x === r[0] && x > 1) && next === seq[seq.length - 1] * r[0];
      else if (kind === 'div') ok = r.every((x) => x === r[0] && x < 1) && next * (1 / r[0]) === seq[seq.length - 1] && Number.isInteger(next);
      else ok = d.every((x, i) => i === 0 || x === d[i - 1] + 1) && next === seq[seq.length - 1] + d[d.length - 1] + 1;
      if (!ok || String(next) !== q.answerLabel) bad('pola salah');
      if (!/^\d+(, \d+)*, \?$/.test(q.text)) bad('format pola');
      break;
    }
    default:
      bad('jenis tidak dikenal');
  }

  if (numeric) {
    const all = q.choices.map(Number);
    if (!all.every((v) => Number.isInteger(v) && v >= 0)) bad('pilihan harus bilangan bulat >= 0');
  }

  // batas angka per tingkat
  if (q.type !== 'story' && q.type !== 'pattern') {
    const limit = diff === 'mudah' ? 50 : diff === 'sedang' ? 110 : 729;
    if (!nums.every((n) => n <= limit)) bad(`angka melebihi batas ${limit}`);
  }
  if (diff === 'mudah' && ['story', 'twoStep', 'pattern', 'compare', 'chooseOp'].includes(q.type)) bad('mudah hanya hitung langsung & angka hilang');
  if (diff === 'mudah' && q.type === 'direct' && q.op === 'mul') {
    const [a, b] = nums; // perkalian 2/3/5
    if (![a, b].some((n) => [2, 3, 5].includes(n))) bad('mudah: perkalian harus 2/3/5');
  }
  if (diff !== 'sulit' && ['twoStep', 'pattern'].includes(q.type)) bad('jenis khusus sulit');

  // fokus operasi
  if (focus !== 'campuran') {
    const sym = OP_SYMBOL[focus];
    if (['direct', 'missing', 'compare'].includes(q.type) && !ops.every((o) => o === sym)) bad('fokus operasi dilanggar');
    if (q.type === 'chooseOp' && q.answerLabel !== sym) bad('fokus pilih operasi dilanggar');
    if (q.type === 'twoStep' && !ops.every((o) => o === sym)) bad('fokus dua langkah dilanggar');
    if (q.type === 'story' && q.meta.expr && !(q.meta.expr.match(/[+−×÷]/g) || []).every((o) => o === sym)) bad('fokus cerita dilanggar');
    if (q.type === 'pattern' && q.op !== focus) bad('fokus pola dilanggar');
  }
  return errs;
}

/** Bot: menjawab benar dengan peluang `acc`; mengembalikan game yang selesai. */
export function playLevel(level, acc, rng) {
  const game = new Game(level);
  const plan = new Map();
  for (let guard = 0; !game.finished && guard < 300000; guard++) {
    let target = 0;
    if (game.phase === 'run') {
      const g = game.nextGate();
      if (g && g.z - game.dist < 80) {
        if (!plan.has(g)) {
          const wrong = g.active.filter((c) => c !== g.q.correct);
          const want = rng() < acc || !wrong.length ? g.q.correct : wrong[Math.floor(rng() * wrong.length)];
          plan.set(g, want);
        }
        const want = plan.get(g);
        const lane = Math.max(0, g.active.indexOf(want));
        target = laneCenter(g.active.length, lane);
      }
    } else if (game.phase === 'bossAsk') {
      const q = game.bossQ;
      const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.correct);
      game.answerBoss(rng() < acc ? q.correct : wrong[Math.floor(rng() * wrong.length)]);
    }
    game.update(1 / 60, target);
    game.events.length = 0;
  }
  return game;
}

export function runTests() {
  const failures = [];
  let passed = 0;
  const check = (cond, msg) => {
    if (cond) passed++;
    else failures.push(msg);
  };
  const stats = [];

  // ----- evalExpression -----
  check(Q.evalExpression('3 × 4 + 5') === 17, 'eval 3×4+5');
  check(Q.evalExpression('5 + 3 × 4') === 17, 'eval presedensi');
  check(Q.evalExpression('20 − 2 × 3') === 14, 'eval 20−2×3');
  check(Number.isNaN(Q.evalExpression('7 ÷ 2')), 'eval pembagian tidak bulat -> NaN');
  check(Number.isNaN(Q.evalExpression('7 ÷ 0')), 'eval bagi nol -> NaN');

  // ----- Soal: semua jenis, tingkat, fokus -----
  const seenTypes = {};
  for (const diff of DIFFICULTIES) {
    for (const focus of FOCUS_LIST) {
      for (const level of [1, 8, 15, 22, 30]) {
        const rng = Q.makeRng(level * 7919 + focus.length * 31 + diff.length);
        for (let i = 0; i < 150; i++) {
          const choices = i % 2 ? 2 : 3;
          const q = Q.generateQuestion(diff, focus, level, rng, { choices });
          seenTypes[`${diff}:${q.type}`] = true;
          const errs = validateQuestion(q, { diff, focus });
          if (errs.length) failures.push(...errs.slice(0, 2));
          else passed++;
          if (q.type !== 'compare') check(q.choices.length === choices || q.type === 'chooseOp', `jumlah pilihan ${choices}: ${q.text}`);
        }
      }
    }
  }
  for (const diff of DIFFICULTIES) {
    for (const type of Object.keys(Q.TYPE_WEIGHTS[diff])) check(seenTypes[`${diff}:${type}`], `jenis ${type} muncul di ${diff}`);
  }

  // ----- Jawaban salah unik -----
  const rng0 = Q.makeRng(42);
  for (let ans = 0; ans < 600; ans += 7) {
    const ds = Q.makeDistractors(ans, 3, rng0);
    check(new Set(ds).size === 3, `distractor unik untuk ${ans}: ${ds}`);
    check(ds.every((d) => d !== ans && d >= 0 && Number.isInteger(d)), `distractor valid untuk ${ans}: ${ds}`);
  }

  // ----- Deck: tidak ada soal sama dalam satu level -----
  for (const diff of DIFFICULTIES) {
    for (const focus of FOCUS_LIST) {
      const deck = new Q.QuestionDeck(diff, focus, 5, Q.makeRng(11));
      const keys = [];
      for (let i = 0; i < 30; i++) keys.push(deck.next({ choices: 3 }).key);
      check(new Set(keys).size === keys.length, `deck tanpa duplikat ${diff}/${focus}`);
      check(keys[0].startsWith('direct|'), `soal pertama hitung langsung ${diff}/${focus}`);
    }
  }

  // ----- Combo & lajur -----
  check([1, 1.5, 2, 2.5, 3, 3].join() === [1, 2, 3, 4, 5, 9].map(comboMult).join(), 'multiplier combo x1 x1,5 x2 ... maks x3');
  check(correctGain(1) === 10 && correctGain(3) === 20 && correctGain(8) === 30, 'bonus benar = 10 x combo');
  for (const n of [1, 2, 3]) {
    for (let x = -1; x <= 1; x += 0.01) {
      const i = laneAt(n, x);
      check(i >= 0 && i < n, `lajur valid n=${n} x=${x.toFixed(2)}`);
    }
    for (let i = 0; i < n; i++) {
      const [l0, l1] = laneBounds(n, i);
      check(laneAt(n, laneCenter(n, i)) === i && l0 < l1, `pusat lajur ${i}/${n}`);
    }
  }

  // ----- Level -----
  let prevGates = {};
  for (const diff of DIFFICULTIES) {
    for (const focus of FOCUS_LIST) {
      for (let num = 1; num <= CFG.levelsPerDifficulty; num++) {
        for (const mode of SPEED_LIST) {
          const lv = generateLevel(diff, num, focus, mode, Q.makeRng(num * 131 + focus.length * 7 + mode.length));
          const tag = `${diff}/${focus}/L${num}/${mode}`;
          check(verifyLevel(lv), `level lolos verifikasi ${tag}`);
          check(lv.big === isBigBoss(num) && lv.world === worldOf(num), `boss/dunia ${tag}`);
          check(lv.gates.length >= 5 && lv.gates.length <= 10, `5-10 gerbang ${tag}: ${lv.gates.length}`);
          check(lv.bossQuestions.length === bossQuestionCount(lv.big, num) && lv.bossQuestions.length >= 3 && lv.bossQuestions.length <= 5, `3-5 soal boss ${tag}`);
          check(lv.gates.every((g, i, a) => i === 0 || a[i - 1].z < g.z) && lv.gates[lv.gates.length - 1].z < lv.stopDist, `gerbang terurut ${tag}`);
          check(lv.gates.every((g, i, a) => i === 0 || a[i - 1].q.key !== g.q.key), `soal tidak sama berurutan ${tag}`);
          const all = [...lv.gates.map((g) => g.q.key), ...lv.bossQuestions.map((q) => q.key)];
          check(new Set(all).size === all.length, `semua soal unik di level ${tag}`);
          for (const g of lv.gates) {
            const errs = validateQuestion(g.q, { diff, focus });
            if (errs.length) failures.push(`${tag}: ${errs[0]}`);
            else passed++;
          }
          for (const q of lv.bossQuestions) {
            const errs = validateQuestion(q, { diff, focus });
            if (errs.length) failures.push(`${tag} boss: ${errs[0]}`);
            else passed++;
          }
          if (mode === 'normal') {
            // waktu berpikir = jarak antar gerbang / kecepatan
            for (let i = 1; i < lv.gates.length; i++) check(thinkTime(lv, i) >= MIN_THINK[diff] - 1e-9, `waktu berpikir ${tag} gerbang ${i}: ${thinkTime(lv, i).toFixed(2)} dtk`);
          } else if (mode === 'santai') {
            for (let i = 1; i < lv.gates.length; i++) check(thinkTime(lv, i) >= MIN_THINK[diff], `santai >= normal ${tag}`);
          } else {
            for (let i = 1; i < lv.gates.length; i++) check(thinkTime(lv, i) >= 2.9, `cepat masih >= 2,9 dtk ${tag}`);
          }
          if (mode === 'normal' && focus === 'campuran') {
            const key = `${diff}`;
            if (prevGates[key] !== undefined && num > 1) check(lv.gates.length >= prevGates[key] - 1, `jumlah gerbang naik bertahap ${tag}`);
            prevGates[key] = lv.gates.length;
          }
        }
      }
    }
  }
  for (const diff of DIFFICULTIES) {
    const a = generateLevel(diff, 1, 'campuran', 'normal', Q.makeRng(5));
    const b = generateLevel(diff, 30, 'campuran', 'normal', Q.makeRng(5));
    check(b.speed > a.speed && b.gates.length > a.gates.length && b.bossHp > a.bossHp, `${diff}: level 30 lebih sulit dari level 1`);
  }

  // ----- Hint -----
  for (const diff of DIFFICULTIES) {
    for (let k = 0; k < 40; k++) {
      const lv = generateLevel(diff, 1 + (k % 30), 'campuran', 'normal', Q.makeRng(900 + k));
      const game = new Game(lv);
      const g = game.nextGate();
      const before = g.active.length;
      const ok = game.useHint();
      check(ok === (before > 1), 'hint berhasil jika ada >= 2 pilihan');
      if (ok) {
        check(g.active.length === before - 1 && g.active.includes(g.q.correct), 'hint menghapus satu pilihan salah, bukan yang benar');
        check(game.hints === CFG.hintsPerLevel - 1, 'hint berkurang');
      }
      let used = 0;
      for (let i = 0; i < 5; i++) if (game.useHint()) used++;
      check(game.hints >= 0 && game.hints <= CFG.hintsPerLevel, 'hint tidak negatif');
    }
  }

  // ----- Permainan: bot sempurna -----
  for (const diff of DIFFICULTIES) {
    for (const focus of FOCUS_LIST) {
      for (const num of [1, 5, 10, 15, 20, 25, 30]) {
        const lv = generateLevel(diff, num, focus, 'normal', Q.makeRng(num + 1000));
        const game = playLevel(lv, 1, Q.makeRng(1));
        check(game.phase === 'won', `bot sempurna menang ${diff}/${focus} L${num} (phase=${game.phase})`);
        check(game.stars === 3 && game.accuracy === 1, `bot sempurna 3 bintang ${diff}/${focus} L${num}: ${game.stars}`);
        check(game.wrongs.length === 0, 'tanpa jawaban salah');
        const sim = simulatePerfect(lv);
        check(sim.damage > lv.bossHp, `kapasitas damage cukup ${diff}/${focus} L${num}`);
      }
    }
  }

  // ----- Permainan: bot tidak sempurna (statistik + batas bawah) -----
  const trials = 60;
  const winRate = (diff, num, acc) => {
    let wins = 0;
    for (let k = 0; k < trials; k++) {
      const rng = Q.makeRng(num * 977 + k * 13 + Math.round(acc * 100));
      const lv = generateLevel(diff, num, 'campuran', 'normal', rng);
      if (playLevel(lv, acc, rng).phase === 'won') wins++;
    }
    return wins / trials;
  };
  for (const diff of DIFFICULTIES) {
    for (const acc of [0.6, 0.8, 0.9]) {
      const row = { diff, acc };
      for (const num of [1, 10, 20, 30]) row['L' + num] = winRate(diff, num, acc);
      stats.push(row);
      if (acc === 0.9) check(row.L1 >= 0.85 && row.L10 >= 0.8, `akurasi 90%: menang >= 80% di level awal (${diff}) ${JSON.stringify(row)}`);
      if (acc === 0.8) check(row.L1 >= 0.7, `akurasi 80%: menang >= 70% di level 1 (${diff}) ${JSON.stringify(row)}`);
    }
  }

  // ----- Permainan: waktu habis di boss dianggap salah; selalu berakhir -----
  const lv = generateLevel('sedang', 12, 'campuran', 'normal', Q.makeRng(3));
  const game = new Game(lv);
  let guard = 0;
  while (!game.finished && guard++ < 300000) {
    game.update(1 / 60, -0.7); // selalu di lajur kiri; tidak pernah menjawab boss -> waktu habis
    game.events.length = 0;
  }
  check(game.finished, 'permainan selalu berakhir (menang/kalah)');
  check(game.phase === 'lost' && game.wrongs.length > 0, 'tidak menjawab boss = salah / kalah');
  check(game.wrongs.every((w) => w.q && w.q.explain && w.q.answerLabel), 'ulasan menyimpan soal, jawaban benar, penjelasan');

  // ----- V3: data skin dan pet -----
  const EYES = ['round', 'tall', 'bar', 'heart', 'star', 'slit'];
  const ACCS = ['antenna', 'crown', 'headphones', 'bow', 'halo', 'spikes'];
  const hex = /^#[0-9a-f]{6}$/i;
  check(SKINS.length >= 6 && PETS.length >= 2, 'minimal 6 skin dan 2 pet');
  check(new Set(SKINS.map((s) => s.id)).size === SKINS.length, 'id skin unik');
  check(new Set(PETS.map((p) => p.id)).size === PETS.length, 'id pet unik');
  check(SKINS[0].id === 'klasik' && SKINS[0].price === 0, 'skin pertama gratis (Klasik Biru)');
  for (const s of SKINS) {
    check(s.body.length === 3 && s.body.every((c) => hex.test(c)), `warna badan ${s.id}`);
    check(s.rings.length === 3 && s.rings.every((c) => hex.test(c)), `warna cincin ${s.id}`);
    check(hex.test(s.rim) && hex.test(s.screen) && hex.test(s.eye) && hex.test(s.trail), `warna lain ${s.id}`);
    check(EYES.includes(s.eyeShape) && ACCS.includes(s.accessory), `bentuk mata / aksesori ${s.id}`);
    check(Number.isInteger(s.price) && s.price >= 0 && !!s.name, `harga / nama ${s.id}`);
  }
  for (const p of PETS) check(p.price > 0 && p.desc && p.bonus && (p.bonus.bulletsPerCorrect || p.bonus.hints), `data pet ${p.id}`);
  check(getSkin('tidak-ada').id === 'klasik' && getPet('tidak-ada') === null, 'getSkin / getPet fallback');

  // ----- V3: koin, toko, skema penyimpanan -----
  Store._reset({});
  check(Store.getCoins() === 0 && Store.ownsSkin('klasik') && Store.getEquipped().skin === 'klasik' && Store.getEquipped().pet === null, 'data awal');
  check(!Store.buy('skin', 'emas'), 'tidak bisa membeli tanpa koin');
  Store.addCoins(500);
  check(Store.getCoins() === 500, 'tambah koin');
  check(Store.buy('skin', 'emas') && Store.getCoins() === 350 && Store.ownsSkin('emas'), 'beli skin memotong koin');
  check(!Store.buy('skin', 'emas') && Store.getCoins() === 350, 'tidak bisa beli dua kali');
  check(Store.equip('skin', 'emas') && Store.getEquipped().skin === 'emas', 'pakai skin yang dimiliki');
  check(!Store.equip('skin', 'galaksi') && Store.getEquipped().skin === 'emas', 'tidak bisa memakai skin yang belum dimiliki');
  check(Store.buy('pet', 'api') && Store.equip('pet', 'api') && Store.getEquipped().pet === 'api', 'beli dan pakai pet');
  check(Store.equip('pet', null) && Store.getEquipped().pet === null, 'lepas pet');
  check(!Store.buy('skin', 'xyz') && !Store.buy('pet', 'xyz'), 'item tidak dikenal ditolak');
  Store.addCoins(-50);
  check(Store.getCoins() === 350 - 120, 'koin negatif diabaikan (setelah beli pet)');
  // migrasi: data V2 lama (tanpa wallet / skin) dan data rusak
  const old = { settings: { difficulty: 'sedang', focus: 'mul', speed: 'cepat', sound: false, music: true }, stars: { mudah: [3, 2, 1] } };
  const migrated = Store._reset(old);
  check(migrated.schema === Store.SCHEMA && migrated.wallet.coins === 0 && migrated.settings.quality === 'tinggi' && migrated.settings.difficulty === 'sedang' && migrated.settings.sound === false, 'migrasi data lama mengisi nilai bawaan');
  check(Store.getStars('mudah', 3) === 1 && Store.isUnlocked('mudah', 4), 'bintang lama terbawa');
  const junk = Store._reset({ wallet: { coins: -5 }, owned: { skins: ['x', 'galaksi'], pets: ['hantu'] }, equipped: { skin: 'dino', pet: 'api' }, settings: { quality: 'ultra' } });
  check(junk.wallet.coins === 0 && junk.owned.skins.join() === 'klasik,galaksi' && junk.owned.pets.length === 0, 'data rusak dibersihkan');
  check(junk.equipped.skin === 'klasik' && junk.equipped.pet === null && junk.settings.quality === 'tinggi', 'perlengkapan tidak sah dikembalikan ke bawaan');
  Store._reset({});

  // ----- V3: koin dan bonus pet di dalam permainan -----
  for (const diff of DIFFICULTIES) {
    const lv = generateLevel(diff, 7, 'campuran', 'normal', Q.makeRng(77));
    const perfect = playLevel(lv, 1, Q.makeRng(1));
    // boss bisa kalah sebelum semua soal terpakai, jadi minimal satu jawaban boss
    const answers = lv.gates.length + 1;
    check(perfect.coins >= answers * CFG.coinPerCorrect + CFG.coinLevelWin + CFG.coinPerStar * 3, `koin bot sempurna ${diff}: ${perfect.coins}`);
    check(perfect.coins === perfect.stats.right * CFG.coinPerCorrect + CFG.coinLevelWin + CFG.coinPerStar * perfect.stars, `koin = jawaban benar + bonus level (${diff})`);
    const lose = new Game(lv);
    for (let i = 0; i < 300000 && !lose.finished; i++) { lose.update(1 / 60, -0.7); lose.events.length = 0; }
    check(lose.phase === 'lost' && lose.coins >= 0 && lose.coins < perfect.coins, 'kalah mendapat lebih sedikit koin');
    const withApi = new Game(lv, { pet: getPet('api') });
    const noPet = new Game(lv);
    check(withApi.bonus.bulletsPerCorrect === 1 && noPet.bonus.bulletsPerCorrect === undefined, 'bonus pet api terbaca');
    const gate = lv.gates[0];
    for (const g of [withApi, noPet]) {
      for (let i = 0; i < 20000 && g.idx < 1; i++) g.update(1 / 60, laneCenter(gate.active.length, gate.q.correct));
      g.events.length = 0;
    }
    check(withApi.bullets === noPet.bullets + 1, `pet Bola Api: +1 peluru tiap jawaban benar (${diff})`);
    check(new Game(lv, { pet: getPet('kucing') }).hints === CFG.hintsPerLevel + 1 && noPet.hints === CFG.hintsPerLevel, 'pet Kucing Roket: +1 hint');
  }
  // event jawaban membawa info lajur untuk efek gerbang pecah
  const lvE = generateLevel('mudah', 3, 'campuran', 'normal', Q.makeRng(5));
  const gE = new Game(lvE);
  const evts = [];
  for (let i = 0; i < 20000 && gE.idx < 1; i++) {
    gE.update(1 / 60, laneCenter(lvE.gates[0].active.length, lvE.gates[0].q.correct));
    evts.push(...gE.events);
    gE.events.length = 0;
  }
  const ev = evts.find((e) => e.type === 'correct');
  check(ev && ev.lanes === lvE.gates[0].active.length && ev.lane >= 0 && ev.lane < ev.lanes, 'event correct memuat lajur');

  return { passed, failed: failures.length, failures: failures.slice(0, 40), stats };
}
