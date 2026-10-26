// Logika level: gerbang soal, combo, hint, dan pertarungan boss berbentuk soal.
// Tanpa DOM / canvas sehingga bisa diuji di Node / browser.
import { CFG } from './config.js';
import { QuestionDeck, gateChoiceCount, levelT, lerp, clamp } from './questions.js';

export const worldOf = (level) => Math.min(2, Math.floor((level - 1) / CFG.levelsPerWorld));
export const isBigBoss = (level) => level % CFG.bigBossEvery === 0;
export const bossQuestionCount = (big, level) => (big ? 5 : level <= 10 ? 3 : 4);

/** Multiplier combo menurut jumlah jawaban benar berturut-turut. */
export const comboMult = (streak) => CFG.comboMult[Math.min(Math.max(0, streak), CFG.comboMult.length - 1)];
export const correctGain = (streak) => Math.round(CFG.correctBonus * comboMult(streak));

/** Batas kiri-kanan (satuan lebar jalur) untuk gerbang ke-i dari n gerbang jawaban. */
export const laneBounds = (n, i) => [-1 + (2 * i) / n, -1 + (2 * (i + 1)) / n];
export const laneCenter = (n, i) => -1 + (2 * i + 1) / n;
export const laneAt = (n, x) => clamp(Math.floor(((x + 1) / 2) * n), 0, n - 1);

// ---------- Pembuatan level ----------

/** Simulasi permainan sempurna: semua jawaban benar. */
export function simulatePerfect(level) {
  let b = level.startBullets;
  let streak = 0;
  for (let i = 0; i < level.gates.length; i++) {
    streak++;
    b += correctGain(streak);
  }
  const bestBullets = b;
  const n = level.bossQuestions.length;
  let damage = 0;
  for (let i = 0; i < n; i++) {
    const shots = Math.ceil(b / (n - i));
    b -= shots;
    streak++;
    damage += Math.round(shots * comboMult(streak));
  }
  return { bestBullets, damage };
}

/** HP boss harus bisa dikalahkan oleh permainan sempurna. */
export function verifyLevel(level) {
  const s = simulatePerfect(level);
  return s.damage > level.bossHp && level.bossHp >= 1 && level.gates.length >= CFG.gatesMin;
}

/** Waktu berpikir (detik) untuk gerbang ke-i pada kecepatan level. */
export const thinkTime = (level, i) => (level.gates[i].z - (i ? level.gates[i - 1].z : 0)) / level.speed;

export function generateLevel(diff, num, focus = 'campuran', speedMode = 'normal', rng = Math.random) {
  const t = levelT(num);
  const big = isBigBoss(num);
  const mode = CFG.speedModes[speedMode] || CFG.speedModes.normal;
  const speed = lerp(CFG.speed[diff][0], CFG.speed[diff][1], t) * mode.speed;
  const think = lerp(CFG.thinkSeconds[diff][0], CFG.thinkSeconds[diff][1], t) * mode.think;
  let gateCount = Math.round(lerp(CFG.gatesMin, CFG.gatesMax, t));
  if (big) gateCount = Math.min(CFG.gatesMax, gateCount + 1);

  const deck = new QuestionDeck(diff, focus, num, rng);
  const gates = [];
  let z = 0;
  for (let i = 0; i < gateCount; i++) {
    const q = deck.next({ choices: gateChoiceCount(num, rng) });
    z += speed * think * q.readFactor + (i === 0 ? speed * CFG.firstGateExtraSeconds : 0);
    gates.push({
      kind: 'gate',
      z,
      prevZ: gates.length ? gates[gates.length - 1].z : 0,
      q,
      active: q.choices.map((_, k) => k), // pilihan yang masih tampil (hint menghapus satu yang salah)
      chosen: -1,
      ok: false,
      resolvedAt: 0,
    });
  }
  const bossZ = z + CFG.bossGap;
  const bossQuestions = [];
  for (let i = 0; i < bossQuestionCount(big, num); i++) bossQuestions.push(deck.next({ choices: 3 }));

  const level = {
    diff, num, focus, speedMode, world: worldOf(num), big, speed, think,
    startBullets: CFG.startBullets[diff],
    gates,
    items: gates,
    bossZ,
    stopDist: bossZ - CFG.bossStopDepth,
    bossQuestions,
    deck,
    bossHp: 1,
    bestBullets: 0,
    perfectDamage: 0,
  };
  const perfect = simulatePerfect(level);
  let factor = lerp(CFG.hpFactorMin, CFG.hpFactorMax, t);
  if (big) factor += CFG.bigBossHpBoost;
  level.bestBullets = perfect.bestBullets;
  level.perfectDamage = perfect.damage;
  level.bossHp = Math.max(5, Math.round(perfect.damage * factor));
  if (level.bossHp >= perfect.damage) level.bossHp = Math.max(1, perfect.damage - 1);
  return level;
}

// ---------- Permainan berjalan ----------

export class Game {
  /** opts.pet: objek pet (lihat characters.js) yang bonusnya berlaku selama level. */
  constructor(level, opts = {}) {
    this.level = level;
    this.items = level.gates;
    this.gates = level.gates;
    this.bonus = (opts.pet && opts.pet.bonus) || {};
    this.coins = 0; // koin yang didapat di level ini
    this.dist = 0;
    this.idx = 0; // gerbang berikutnya yang belum dilewati
    this.x = 0; // posisi robot: -1 (kiri) .. 1 (kanan)
    this.bullets = level.startBullets;
    this.streak = 0;
    this.maxCombo = 0;
    this.hints = CFG.hintsPerLevel + (this.bonus.hints || 0);
    this.hpLeft = level.bossHp;
    this.phase = 'run'; // run | bossIntro | bossAsk | bossFire | bossGap | bossHurt | won | lost
    this.time = 0;
    this.phaseTime = 0;
    this.elapsed = 0;
    this.speedNow = 0;
    this.stats = { right: 0, total: 0 };
    this.wrongs = []; // untuk halaman Ulasan: { q, chosen, timedOut }
    this.events = []; // dibaca & dikosongkan oleh main.js tiap frame
    this.bulletsAtBoss = 0;
    this.stars = 0;
    this.score = 0;
    // boss
    this.bossIdx = 0;
    this.bossQ = null;
    this.bossTimeMax = 1;
    this.bossTimeLeft = 1;
    this.fire = { shots: 0, dmg: 0, rate: 0, acc: 0 };
  }

  get combo() {
    return this.streak;
  }

  get mult() {
    return comboMult(this.streak);
  }

  get progress() {
    return clamp(this.dist / this.level.stopDist, 0, 1);
  }

  get finished() {
    return this.phase === 'won' || this.phase === 'lost';
  }

  get inBoss() {
    return this.phase.startsWith('boss') || (this.finished && this.bulletsAtBoss > 0);
  }

  get accuracy() {
    return this.stats.total ? this.stats.right / this.stats.total : 0;
  }

  update(dt, targetX) {
    this.time += dt;
    this.phaseTime += dt;
    if (!this.finished) this.elapsed += dt;
    const target = this.phase === 'run' ? clamp(targetX, -CFG.maxX, CFG.maxX) : 0;
    this.x += (target - this.x) * Math.min(1, CFG.followRate * dt);
    switch (this.phase) {
      case 'run': this._run(dt); break;
      case 'bossIntro':
        this.speedNow = 0;
        if (this.phaseTime >= CFG.bossIntroDelay) this._askBoss();
        break;
      case 'bossAsk':
        this.bossTimeLeft -= dt;
        if (this.bossTimeLeft <= 0) this.answerBoss(-1);
        break;
      case 'bossFire': this._fire(dt); break;
      case 'bossGap':
        if (this.phaseTime >= CFG.bossGapDelay) this._askBoss();
        break;
      case 'bossHurt':
        if (this.phaseTime >= CFG.bossHurtDelay) {
          if (this.bullets <= 0) this._finish(false);
          else this._askBoss();
        }
        break;
      default: this.speedNow = 0;
    }
  }

  // ----- Fase lari -----
  _run(dt) {
    const lv = this.level;
    const ramp = Math.min(1, 0.45 + this.time * 0.55); // percepatan halus di awal
    this.speedNow = lv.speed * ramp;
    this.dist = Math.min(lv.stopDist, this.dist + this.speedNow * dt);
    while (this.idx < this.gates.length && this.gates[this.idx].z <= this.dist) {
      this._resolveGate(this.gates[this.idx++]);
      if (this.phase !== 'run') return;
    }
    if (this.dist >= lv.stopDist) {
      this.phase = 'bossIntro';
      this.phaseTime = 0;
      this.speedNow = 0;
      this.bulletsAtBoss = this.bullets;
      this.events.push({ type: 'bossStart' });
    }
  }

  /** Gerbang berikutnya yang belum dilewati, atau null. */
  nextGate() {
    return this.idx < this.gates.length ? this.gates[this.idx] : null;
  }

  _resolveGate(g) {
    // gerbang mengisi seluruh lebar jalur: pilih gerbang yang berisi posisi pistol
    const lane = laneAt(g.active.length, this.x);
    const choice = g.active[lane];
    g.chosen = choice;
    g.ok = choice === g.q.correct;
    g.resolvedAt = this.time;
    this.stats.total++;
    const lanes = g.active.length;
    if (g.ok) {
      this.streak++;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      const gain = correctGain(this.streak) + (this.bonus.bulletsPerCorrect || 0);
      this.bullets += gain;
      this.stats.right++;
      this.coins += CFG.coinPerCorrect;
      this.events.push({ type: 'correct', gain, streak: this.streak, mult: this.mult, lane, lanes });
    } else {
      this.streak = 0;
      this.bullets = Math.max(0, this.bullets - CFG.wrongPenalty);
      this.wrongs.push({ q: g.q, chosen: g.q.choices[choice], timedOut: false });
      this.events.push({ type: 'wrong', q: g.q, penalty: CFG.wrongPenalty, lane, lanes });
    }
    if (this.bullets <= 0) this._finish(false);
  }

  /** Hint: hilangkan satu pilihan salah pada gerbang berikutnya. */
  useHint() {
    const g = this.nextGate();
    if (this.phase !== 'run' || !g || this.hints <= 0) return false;
    const wrong = g.active.filter((i) => i !== g.q.correct);
    if (g.active.length < 2 || !wrong.length) return false;
    const drop = wrong[Math.floor(Math.random() * wrong.length)];
    g.active = g.active.filter((i) => i !== drop);
    this.hints--;
    this.events.push({ type: 'hint' });
    return true;
  }

  // ----- Boss: soal cepat -----
  _askBoss() {
    const q = this.level.bossQuestions[this.bossIdx] || this.level.deck.next({ choices: 3 });
    const mode = CFG.speedModes[this.level.speedMode] || CFG.speedModes.normal;
    this.bossQ = q;
    this.bossTimeMax = CFG.bossTimeSeconds[this.level.diff] * q.readFactor * mode.think;
    this.bossTimeLeft = this.bossTimeMax;
    this.phase = 'bossAsk';
    this.phaseTime = 0;
    this.events.push({ type: 'bossQuestion', q });
  }

  /** Jawab soal boss (index pilihan; -1 = waktu habis). */
  answerBoss(i) {
    if (this.phase !== 'bossAsk') return false;
    const q = this.bossQ;
    const planned = this.level.bossQuestions.length;
    this.stats.total++;
    if (i === q.correct) {
      this.stats.right++;
      this.streak++;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.coins += CFG.coinPerCorrect;
      this.bullets += this.bonus.bulletsPerCorrect || 0;
      const remaining = Math.max(1, planned - this.bossIdx);
      const shots = Math.ceil(this.bullets / remaining); // soal terakhir menembakkan semua peluru
      const mult = this.mult;
      const dmg = Math.round(shots * mult);
      const dur = clamp(shots / CFG.firePerSecond, CFG.fireMinDuration, CFG.fireMaxDuration);
      this.fire = { shots, dmg, rate: shots / dur, acc: 0 };
      this.phase = 'bossFire';
      this.events.push({ type: 'bossCorrect', shots, damage: dmg, mult, streak: this.streak });
    } else {
      this.streak = 0;
      this.wrongs.push({ q, chosen: i >= 0 ? q.choices[i] : null, timedOut: i < 0 });
      const loss = Math.min(this.bullets, Math.max(CFG.bossAttackMin, Math.ceil(this.bullets * CFG.bossAttackFraction)));
      this.bullets -= loss;
      this.phase = 'bossHurt';
      this.events.push({ type: 'bossWrong', loss, q, timedOut: i < 0 });
    }
    this.bossIdx++;
    this.phaseTime = 0;
    return true;
  }

  _fire(dt) {
    const f = this.fire;
    f.acc += f.rate * dt;
    let n = Math.min(f.shots, Math.floor(f.acc));
    f.acc -= n;
    if (n > 0) {
      const d = n >= f.shots ? f.dmg : Math.round((f.dmg * n) / f.shots);
      f.dmg -= d;
      f.shots -= n;
      this.bullets -= n;
      this.hpLeft = Math.max(0, this.hpLeft - d);
      this.events.push({ type: 'shoot', count: n });
    }
    if (this.hpLeft <= 0) this._finish(true);
    else if (f.shots <= 0) {
      if (this.bullets <= 0) this._finish(false);
      else {
        this.phase = 'bossGap';
        this.phaseTime = 0;
      }
    }
  }

  _finish(won) {
    this.phase = won ? 'won' : 'lost';
    this.phaseTime = 0;
    if (!this.bulletsAtBoss) this.bulletsAtBoss = this.bullets;
    if (won) {
      const ratio = Math.min(1, this.bulletsAtBoss / Math.max(1, this.level.bestBullets));
      this.score = CFG.starWeightAccuracy * this.accuracy + CFG.starWeightBullets * ratio;
      this.stars = this.score >= CFG.starThree ? 3 : this.score >= CFG.starTwo ? 2 : 1;
      this.coins += CFG.coinLevelWin + CFG.coinPerStar * this.stars;
    }
    this.events.push({ type: won ? 'win' : 'lose' });
  }
}
