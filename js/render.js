// Menggambar semua hal di kanvas 2D: jalur pseudo-3D, gerbang, Blaster Bot + cincin energi, boss, partikel.
// Koordinat logis: lebar 450, tinggi mengikuti layar (800 pada rasio 9:16).
import { LOGICAL_W, WORLDS, CFG } from './config.js';
import { laneBounds, laneAt, laneCenter } from './game.js';
import { SKINS, drawRobotBody, drawRing, drawPet } from './characters.js';
import { beat } from './audio.js';

const W = LOGICAL_W;
const CX = W / 2;
const BASE_CAM = 28; // jarak kamera: t = CAM / (CAM + kedalaman); mengecil saat combo tinggi (FOV melebar)
let CAM = BASE_CAM;
const ROAD_HW = 196; // piksel per 1 lebar jalur pada t = 1
const HU = 42; // piksel per 1 unit tinggi dunia pada t = 1
const MAX_DEPTH = 240;
const STRIPE = 9;
const GATE_H = 3.4;
const ROBOT_R = 50;
const FONT = '"Fredoka","Arial Rounded MT Bold","Trebuchet MS","Segoe UI",ui-rounded,system-ui,sans-serif';
const TAU = Math.PI * 2;

export const ROAD_HALF_WIDTH = ROAD_HW;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (n) => Math.round(n).toLocaleString('id-ID');

/** Warna hasil jawaban; mode buta warna memakai biru / kuning (ditambah ikon ✓ ✗). */
const palette = (cb) => ({
  ok: cb ? { rgb: '77,163,255', hex: '#7dbcff', fill: 'rgba(40,120,255,0.72)', edge: '#a9d0ff' } : { rgb: '120,255,170', hex: '#7dffb2', fill: 'rgba(36,200,120,0.7)', edge: '#8dffb9' },
  bad: cb ? { rgb: '255,176,0', hex: '#ffc04d', fill: 'rgba(255,170,0,0.75)', edge: '#ffe0a0' } : { rgb: '255,70,70', hex: '#ff7b7b', fill: 'rgba(255,64,72,0.75)', edge: '#ffb4b8' },
});

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.H = 800;
    this.scale = 1;
    this.horizonY = 248;
    this.groundY = 682;
    this.scroll = 0;
    this.time = 0;
    this.shake = 0;
    this.pop = 0;
    this.muzzle = 0;
    this.bossHit = 0;
    this.lunge = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.gunX = CX;
    this.tipY = 420;
    this.tilt = 0;
    this.worldIdx = 0;
    this.visible = [];
    this.beatV = 0;
    this.fov = 0;

    // opsi
    this.quality = 2; // 0 rendah, 1 sedang, 2 tinggi
    this.reduceMotion = false;
    this.cb = false;

    // robot
    this.skin = SKINS[0];
    this.petId = null;
    this.shown = 10; // angka peluru yang tampil (count-up)
    this.ringCount = 6;
    this.ringAge = new Array(CFG.ringsMax).fill(1);
    this.blinkT = 0;
    this.nextBlink = 2;
    this.exprName = 'normal';
    this.exprUntil = 0;
    this.expr = 'normal';
    this.trailT = 0;
    this.petX = CX + 80;
    this.petY = 540;
    this.robotX = CX;
    this.robotY = 590;
    this.lastRobotX = CX;

    // object pool: partikel, teks melayang, peluru tembakan, garis kecepatan
    this.particles = Array.from({ length: 520 }, () => ({
      on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, color: '#fff', grav: 0, shape: 0,
      rot: 0, vr: 0, home: false, hx: 0, hy: 0, glow: false,
    }));
    this.texts = Array.from({ length: 16 }, () => ({ on: false, s: '', x: 0, y: 0, life: 0, max: 1, color: '#fff', size: 30 }));
    this.shots = Array.from({ length: 60 }, () => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0 }));
    this.streaks = Array.from({ length: 18 }, () => ({ lat: 0, d: 0, len: 6 }));
    this.streaks.forEach((s) => this._respawnStreak(s, true));
    this.hills = Array.from({ length: 24 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.9 + 1)));
    this.stars = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 97.3) % 1) * W + ((i * 53) % 7), y: (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1), tw: 1 + (i % 5) * 0.7, ph: i * 1.3, s: 0.6 + (i % 4) * 0.35,
    }));
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 110, y: 0.25 + ((i * 37) % 10) / 20, s: 5 + (i % 3) * 3, w: 60 + (i % 3) * 30 }));
  }

  /** Atur opsi dari pengaturan: { quality: 'rendah'|'sedang'|'tinggi', reduceMotion, colorblind }. */
  setOptions({ quality, reduceMotion, colorblind }) {
    if (quality !== undefined) this.quality = { rendah: 0, sedang: 1, tinggi: 2 }[quality] ?? 2;
    if (reduceMotion !== undefined) this.reduceMotion = reduceMotion;
    if (colorblind !== undefined) this.cb = colorblind;
  }

  setLoadout(skin, petId) {
    this.skin = skin || SKINS[0];
    this.petId = petId || null;
  }

  /** Bersihkan semua efek (saat level baru dimulai). */
  clearFx() {
    for (const p of this.particles) p.on = false;
    for (const t of this.texts) t.on = false;
    for (const s of this.shots) s.on = false;
    this.shake = this.pop = this.muzzle = this.bossHit = this.lunge = this.flash = 0;
    this.exprUntil = 0;
    this.shown = 0;
    this.ringCount = 1;
    this.ringAge.fill(1);
    this.fov = 0;
  }

  /** Atur ukuran: cssW/cssH piksel CSS, logicalH tinggi logis (lebar selalu 450). */
  resize(cssW, cssH, logicalH, dpr) {
    this.H = logicalH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = this.canvas.width / W;
    this.horizonY = Math.round(logicalH * 0.31);
    this.groundY = logicalH - 118;
  }

  // ---------- Proyeksi ----------
  _gy(t) {
    return this.horizonY + (this.groundY - this.horizonY) * t;
  }

  _respawnStreak(s, anywhere) {
    s.lat = (Math.random() * 2 - 1) * 0.95;
    s.len = 5 + Math.random() * 8;
    s.d = anywhere ? Math.random() * MAX_DEPTH : MAX_DEPTH * (0.6 + Math.random() * 0.4);
  }

  // ---------- Efek (dipanggil dari main.js) ----------
  _spawn() {
    for (const p of this.particles) if (!p.on) return p;
    return null;
  }

  burst(x, y, n, colors, speed, life, size, grav = 300, shape = 0, glow = false) {
    n = Math.max(1, Math.ceil(n * [0.35, 0.7, 1][this.quality]));
    for (let i = 0; i < n; i++) {
      const p = this._spawn();
      if (!p) return;
      const a = Math.random() * TAU;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.on = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - speed * 0.3;
      p.life = p.max = life * (0.6 + Math.random() * 0.4);
      p.size = size * (0.6 + Math.random() * 0.7);
      p.color = colors[(Math.random() * colors.length) | 0];
      p.grav = grav;
      p.shape = shape;
      p.rot = Math.random() * TAU;
      p.vr = (Math.random() - 0.5) * 12;
      p.home = false;
      p.glow = glow && this.quality > 0;
    }
  }

  /** Serpihan kristal yang melesat ke robot (gerbang benar pecah). */
  _shards(cx, halfW, colors) {
    const n = Math.ceil(26 * [0.4, 0.7, 1][this.quality]);
    for (let i = 0; i < n; i++) {
      const p = this._spawn();
      if (!p) return;
      p.on = true;
      p.x = cx + (Math.random() * 2 - 1) * halfW;
      p.y = this.groundY - Math.random() * GATE_H * HU;
      p.vx = (Math.random() - 0.5) * 260;
      p.vy = -80 - Math.random() * 200;
      p.life = p.max = 0.75 + Math.random() * 0.25;
      p.size = 5 + Math.random() * 6;
      p.color = colors[(Math.random() * colors.length) | 0];
      p.grav = 0;
      p.shape = 2;
      p.rot = Math.random() * TAU;
      p.vr = (Math.random() - 0.5) * 16;
      p.home = true;
      p.hx = this.robotX;
      p.hy = this.robotY;
      p.glow = this.quality > 0;
    }
  }

  floatText(s, x, y, color, size = 34, life = 1.1) {
    const t = this.texts.find((q) => !q.on) || this.texts[0];
    // geser ke atas bila menimpa teks lain yang masih tampil
    for (let tries = 0; tries < 5; tries++) {
      const hit = this.texts.some((q) => q.on && q !== t && Math.abs(q.y - y) < (q.size + size) * 0.55 && q.life > q.max * 0.3);
      if (!hit) break;
      y -= size * 1.05;
    }
    t.on = true;
    t.s = s;
    t.x = clamp(x, 70, W - 70);
    t.y = y;
    t.color = color;
    t.size = size;
    t.life = t.max = life;
  }

  confetti() {
    const colors = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b57bff', '#ff9a3c'];
    for (let i = 0; i < 6; i++) {
      this.burst(CX + (Math.random() - 0.5) * W * 0.9, this.horizonY * 0.6, 28, colors, 260, 2.4, 9, 260, 1);
    }
  }

  fireShots(count) {
    const n = Math.min(3, count);
    const tx = CX + (Math.random() - 0.5) * 120;
    const ty = this.horizonY + (this.groundY - this.horizonY) * 0.64 - 90;
    for (let i = 0; i < n; i++) {
      const s = this.shots.find((q) => !q.on);
      if (!s) break;
      s.on = true;
      s.t = 0;
      s.x0 = this.gunX + (Math.random() - 0.5) * 16;
      s.y0 = this.tipY;
      s.x1 = tx + (Math.random() - 0.5) * 60;
      s.y1 = ty + (Math.random() - 0.5) * 60;
    }
    this.muzzle = 1;
    this.shake = Math.max(this.shake, 4);
  }

  setExpr(name, seconds) {
    this.exprName = name;
    this.exprUntil = this.time + seconds;
  }

  /** Reaksi visual untuk event dari Game. */
  onEvent(e, game) {
    const gx = this.robotX;
    const ty = this.tipY;
    const pal = palette(this.cb);
    switch (e.type) {
      case 'correct': {
        this.pop = 1;
        this.flash = 0.4;
        this.flashColor = pal.ok.rgb;
        this.setExpr('happy', 1.0);
        const lat = laneCenter(e.lanes, e.lane);
        this._shards(CX + lat * ROAD_HW, (ROAD_HW / e.lanes) * 0.85, ['#bff6ff', '#ffffff', '#7df0ff', '#ffe27a']);
        this.burst(gx, this.robotY, 18, [pal.ok.hex, '#ffd23f', '#ffffff'], 330, 0.8, 6, 260, 0, true);
        this.floatText('Benar! +' + e.gain, gx, ty - 50, pal.ok.hex, 40, 1.3);
        if (e.streak >= 2) this.floatText('Combo ×' + String(e.mult).replace('.', ','), gx, ty - 95, '#ffd23f', 30, 1.3);
        break;
      }
      case 'wrong':
        this.pop = 0.6;
        this.shake = Math.max(this.shake, 12);
        this.flash = 0.45;
        this.flashColor = pal.bad.rgb;
        this.setExpr('dizzy', 1.3);
        this.burst(CX + laneCenter(e.lanes, e.lane) * ROAD_HW, this.groundY - 90, 22, ['#ff5a5a', '#ffa94d', '#ffffff'], 340, 0.7, 5, 380, 0, true);
        this.floatText('Salah! −' + e.penalty, gx, ty - 50, pal.bad.hex, 40, 1.6);
        break;
      case 'hint':
        this.burst(gx, this.robotY, 14, ['#ffe27a', '#ffffff'], 220, 0.7, 5, 120, 0, true);
        this.floatText('Hint!', gx, ty - 50, '#ffe27a', 36, 1);
        break;
      case 'bossCorrect':
        this.pop = 1;
        this.setExpr('happy', 0.9);
        this.floatText('Benar! ×' + String(e.mult).replace('.', ','), gx, ty - 50, pal.ok.hex, 40, 1.2);
        break;
      case 'bossWrong':
        this.shake = Math.max(this.shake, 16);
        this.flash = 0.5;
        this.flashColor = pal.bad.rgb;
        this.lunge = 1;
        this.pop = 0.6;
        this.setExpr('dizzy', 1.3);
        this.burst(gx, this.robotY, 20, ['#ff4d4d', '#ffa94d', '#ffffff'], 320, 0.7, 6, 300, 0, true);
        this.floatText(e.timedOut ? 'Waktu habis! −' + e.loss : 'Boss menyerang! −' + e.loss, gx, ty - 50, pal.bad.hex, 34, 1.5);
        break;
      case 'shoot':
        this.fireShots(e.count);
        break;
      case 'win':
        this.shake = 16;
        this.flash = 0.7;
        this.flashColor = '255,255,255';
        this.burst(CX, this.horizonY + 150, 70, ['#ffd23f', '#ff9a3c', '#ff4d4d', '#ffffff'], 520, 1.1, 10, 260, 0, true);
        this.confetti();
        break;
      case 'lose':
        this.shake = 10;
        break;
      default:
        break;
    }
  }

  // ---------- Update animasi ----------
  _pose(game) {
    const x = game ? game.x : Math.sin(this.time * 0.9) * 0.55;
    const bob = Math.sin(this.time * 2.4) * (this.reduceMotion ? 1.5 : 5);
    this.robotX = CX + x * ROAD_HW;
    this.robotY = this.groundY - 92 + bob;
    return x;
  }

  update(dt, game) {
    this.time += dt;
    const speed = game ? game.speedNow : 16;
    this.scroll += speed * dt * (1 + this.fov * 0.35);
    this.worldIdx = game ? game.level.world : (Math.floor(this.time / 14) % 3);
    this.pop = Math.max(0, this.pop - dt * 3.2);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.muzzle = Math.max(0, this.muzzle - dt * 9);
    this.bossHit = Math.max(0, this.bossHit - dt * 5);
    this.lunge = Math.max(0, this.lunge - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.beatV = beat();

    // FOV melebar saat combo tinggi
    const fovTarget = game && !this.reduceMotion ? clamp((game.streak - 1) / 4, 0, 1) : 0;
    this.fov += (fovTarget - this.fov) * Math.min(1, 2.5 * dt);
    CAM = BASE_CAM * (1 - 0.14 * this.fov);

    this._pose(game);

    // angka peluru (count-up) dan cincin energi
    const bullets = game ? game.bullets : 10;
    this.shown += (bullets - this.shown) * Math.min(1, 9 * dt);
    if (Math.abs(bullets - this.shown) < 0.5) this.shown = bullets;
    const target = clamp(bullets, 1, CFG.ringsMax);
    if (target > this.ringCount) {
      for (let k = this.ringCount; k < target; k++) this.ringAge[k] = 0;
    } else if (target < this.ringCount) {
      for (let k = target; k < this.ringCount; k++) {
        const pos = this._ringPos(k);
        this.burst(pos.x, pos.y, 8, [this.skin.rings[k % 3], '#ffffff'], 180, 0.5, 4, 200, 0, true);
      }
    }
    this.ringCount = target;
    for (let k = 0; k < this.ringCount; k++) this.ringAge[k] += dt;

    // ekspresi + kedip
    let expr = 'normal';
    if (game) {
      if (game.phase === 'won') expr = 'cheer';
      else if (game.phase === 'lost') expr = 'sad';
      else if (this.time < this.exprUntil) expr = this.exprName;
      else if (game.phase === 'bossAsk') expr = 'focus';
      else if (game.phase === 'run') {
        const g = game.nextGate();
        if (g && g.z - game.dist < 60) expr = 'focus';
      }
    }
    this.expr = expr;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.14;
      this.nextBlink = 2 + Math.random() * 3;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);

    // pet mengikuti dengan jeda
    const side = this.robotX > CX ? -1 : 1;
    this.petX += (this.robotX + side * 84 - this.petX) * Math.min(1, 5 * dt);
    this.petY = this.robotY - 34 + Math.sin(this.time * 3) * 6;

    // jejak cahaya di bawah robot
    if (speed > 0 && this.quality > 0) {
      this.trailT += dt;
      while (this.trailT > 0.035) {
        this.trailT -= 0.035;
        const p = this._spawn();
        if (!p) break;
        p.on = true;
        p.x = this.robotX + (Math.random() - 0.5) * ROBOT_R * 0.9;
        p.y = this.robotY + ROBOT_R * 1.0;
        p.vx = (Math.random() - 0.5) * 40;
        p.vy = 90 + Math.random() * 130;
        p.life = p.max = 0.5;
        p.size = 3 + Math.random() * 3.5;
        p.color = this.skin.trail;
        p.grav = 0;
        p.shape = 0;
        p.home = false;
        p.glow = true;
      }
    }

    for (const s of this.streaks) {
      s.d -= speed * dt * 1.2;
      if (s.d + s.len < -6) this._respawnStreak(s, false);
    }
    for (const p of this.particles) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      if (p.home) {
        p.vx += (p.hx - p.x) * 38 * dt;
        p.vy += (p.hy - p.y) * 38 * dt;
        p.vx *= 0.93;
        p.vy *= 0.93;
        if (Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) < 22 && p.life < p.max * 0.75) {
          p.on = false;
          this.pop = Math.max(this.pop, 0.5);
          continue;
        }
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (const t of this.texts) {
      if (!t.on) continue;
      t.life -= dt;
      t.y -= 38 * dt;
      if (t.life <= 0) t.on = false;
    }
    for (const s of this.shots) {
      if (!s.on) continue;
      s.t += dt / 0.13;
      if (s.t >= 1) {
        s.on = false;
        this.bossHit = 1;
        this.burst(s.x1, s.y1, 3, ['#ffd23f', '#ffffff'], 160, 0.35, 4, 200, 0, true);
      }
    }
  }

  // ---------- Gambar ----------
  render(game) {
    const ctx = this.ctx;
    const world = WORLDS[this.worldIdx];
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.save();
    if (this.reduceMotion) {
      this.shake = 0;
      this.flash = 0;
    }
    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this._background(world, game);
    this._road(world);
    this._streaks();
    this._sideDecor(world);
    if (game) {
      this._items(game);
      this._boss(game, world);
    }
    this._shots();
    this._robot(game);
    this._particles();
    this._texts();
    ctx.restore();

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`;
      ctx.fillRect(0, 0, W, this.H);
    }
  }

  _background(world, game) {
    const ctx = this.ctx;
    const H = this.H;
    const hz = this.horizonY;
    const px = game ? game.x : Math.sin(this.time * 0.7) * 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, hz + 20);
    g.addColorStop(0, world.skyTop);
    g.addColorStop(1, world.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, hz + 40);

    // bintang berkelap-kelip (paralaks paling jauh)
    if (this.quality > 0) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const y = s.y * hz * 0.85;
        const x = (((s.x - px * (3 + s.s * 4)) % W) + W) % W;
        ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(this.time * s.tw + s.ph)) * (1 - y / hz * 0.5);
        ctx.fillRect(x, y, s.s * 1.8, s.s * 1.8);
      }
      ctx.globalAlpha = 1;
    }

    // planet berlingkar
    if (this.quality > 0) {
      const pxp = W * 0.78 - px * 10;
      const pyp = hz * 0.42;
      const pg = ctx.createRadialGradient(pxp - 10, pyp - 10, 4, pxp, pyp, 34);
      pg.addColorStop(0, world.sun);
      pg.addColorStop(1, world.hill);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(pxp, pyp, 30, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = world.sun;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pxp, pyp, 52, 11, -0.35, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // matahari / bulan dengan cahaya
    const sy = hz - 34;
    const glow = ctx.createRadialGradient(CX, sy, 10, CX, sy, 150);
    glow.addColorStop(0, world.sun);
    glow.addColorStop(0.25, world.sun + 'aa');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, sy - 150, W, 300);
    ctx.fillStyle = world.sun;
    ctx.beginPath();
    ctx.arc(CX, sy, 44, 0, TAU);
    ctx.fill();

    // awan lembut bergerak
    if (this.quality > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (const c of this.clouds) {
        const x = (((c.x + this.time * c.s - px * 12) % (W + 160)) + (W + 160)) % (W + 160) - 80;
        const y = hz * (0.3 + c.y * 0.55);
        ctx.beginPath();
        ctx.ellipse(x, y, c.w * 0.5, 9, 0, 0, TAU);
        ctx.ellipse(x - c.w * 0.25, y + 3, c.w * 0.3, 7, 0, 0, TAU);
        ctx.ellipse(x + c.w * 0.25, y + 3, c.w * 0.35, 8, 0, 0, TAU);
        ctx.fill();
      }
    }

    // dua lapis bukit (paralaks mengikuti posisi robot)
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? world.hill : world.hill2;
      const amp = layer ? 46 : 70;
      const off = -px * (layer ? 14 : 6);
      ctx.beginPath();
      ctx.moveTo(-30, hz + 2);
      const n = this.hills.length;
      for (let i = 0; i < n; i++) {
        const hx = off + (i / (n - 1)) * (W + 80) - 40;
        const hh = this.hills[(i * (layer ? 1 : 3) + layer * 5) % n] * amp;
        ctx.lineTo(hx, hz + 2 - hh);
      }
      ctx.lineTo(W + 30, hz + 2);
      ctx.closePath();
      ctx.fill();
    }

    // tanah di kiri-kanan jalur
    const gg = ctx.createLinearGradient(0, hz, 0, H);
    gg.addColorStop(0, world.skyBottom);
    gg.addColorStop(0.08, world.side);
    gg.addColorStop(1, world.side);
    ctx.fillStyle = gg;
    ctx.fillRect(-20, hz, W + 40, H - hz + 20);
  }

  _road(world) {
    const ctx = this.ctx;
    const H = this.H;
    const tBottom = (H - this.horizonY) / (this.groundY - this.horizonY);
    const hwBottom = ROAD_HW * tBottom;
    ctx.fillStyle = world.roadB;
    ctx.beginPath();
    ctx.moveTo(CX, this.horizonY);
    ctx.lineTo(CX + hwBottom, H);
    ctx.lineTo(CX - hwBottom, H);
    ctx.closePath();
    ctx.fill();

    const off = this.scroll % (STRIPE * 2);
    for (let i = -2; i * STRIPE - off < MAX_DEPTH; i += 2) {
      const dn = Math.max(i * STRIPE - off, -14);
      const df = (i + 1) * STRIPE - off;
      if (df < -14) continue;
      const tn = CAM / (CAM + dn);
      const tf = CAM / (CAM + df);
      const yn = this._gy(tn);
      const yf = this._gy(tf);
      ctx.fillStyle = world.roadA;
      ctx.beginPath();
      ctx.moveTo(CX - ROAD_HW * tf, yf);
      ctx.lineTo(CX + ROAD_HW * tf, yf);
      ctx.lineTo(CX + ROAD_HW * tn, yn);
      ctx.lineTo(CX - ROAD_HW * tn, yn);
      ctx.closePath();
      ctx.fill();
    }

    // kilau permukaan jalur (refleksi halus): terang di dekat kamera, gelap di kejauhan
    if (this.quality > 0) {
      const sheen = ctx.createLinearGradient(0, this.horizonY, 0, H);
      sheen.addColorStop(0, 'rgba(0,0,0,0.25)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.14)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.moveTo(CX, this.horizonY);
      ctx.lineTo(CX + hwBottom, H);
      ctx.lineTo(CX - hwBottom, H);
      ctx.closePath();
      ctx.fill();
    }

    // garis jalur neon putih tipis (putus-putus mengikuti strip)
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    for (let i = -2; i * STRIPE - off < MAX_DEPTH; i += 2) {
      const dn = Math.max(i * STRIPE - off, -14);
      const df = (i + 1) * STRIPE - off;
      if (df < -14) continue;
      const tn = CAM / (CAM + dn);
      const tf = CAM / (CAM + df);
      ctx.lineWidth = Math.max(0.6, 3 * tn);
      for (const lat of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(CX + lat * ROAD_HW * tf, this._gy(tf));
        ctx.lineTo(CX + lat * ROAD_HW * tn, this._gy(tn));
        ctx.stroke();
      }
    }

    // tepi jalur bercahaya, berdenyut mengikuti beat musik
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX, this.horizonY);
      ctx.lineTo(CX + side * hwBottom, H);
      if (this.quality > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = world.edge;
        ctx.globalAlpha = 0.18 + 0.32 * this.beatV;
        ctx.lineWidth = 16 + 8 * this.beatV;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = world.edge + '55';
        ctx.lineWidth = 12;
        ctx.stroke();
      }
      ctx.strokeStyle = world.edge;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  _streaks() {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    const stretch = 1 + this.fov * 1.8;
    for (const s of this.streaks) {
      const d0 = Math.max(s.d, -10);
      const d1 = s.d + s.len * stretch;
      if (d1 < -10 || d0 > MAX_DEPTH) continue;
      const t0 = CAM / (CAM + d0);
      const t1 = CAM / (CAM + d1);
      ctx.globalAlpha = (0.55 + this.fov * 0.3) * Math.min(1, t0 * 2.2);
      ctx.lineWidth = Math.max(0.8, 2.6 * t0);
      ctx.beginPath();
      ctx.moveTo(CX + s.lat * ROAD_HW * t0, this._gy(t0));
      ctx.lineTo(CX + s.lat * ROAD_HW * t1, this._gy(t1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  _sideDecor(world) {
    const ctx = this.ctx;
    const spacing = 20;
    const off = this.scroll % spacing;
    const pulse = 1 + 0.5 * this.beatV;
    for (let k = 12; k >= 0; k--) {
      const d = k * spacing - off;
      if (d < -8 || d > MAX_DEPTH) continue;
      const t = CAM / (CAM + d);
      const gy = this._gy(t);
      for (const side of [-1, 1]) {
        const x = CX + side * 1.2 * ROAD_HW * t;
        const w = 9 * t;
        const h = 3.2 * HU * t;
        ctx.fillStyle = world.hill;
        ctx.fillRect(x - w / 2, gy - h, w, h);
        if (this.quality > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = world.accent;
          ctx.globalAlpha = 0.35 * this.beatV + 0.12;
          ctx.beginPath();
          ctx.arc(x, gy - h, 18 * t * pulse, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = world.accent;
        ctx.beginPath();
        ctx.arc(x, gy - h, 8 * t * pulse, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------- Bentuk bantu ----------
  _rr(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Teks tebal dengan outline; `glow` (warna) menambah cahaya pada kualitas Tinggi. */
  _text(str, x, y, size, fill, maxW, stroke = 'rgba(25,8,60,0.9)', glow = null) {
    if (size < 5) return;
    const ctx = this.ctx;
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.strokeStyle = stroke;
    if (maxW) ctx.strokeText(str, x, y, maxW);
    else ctx.strokeText(str, x, y);
    if (glow && this.quality > 1) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = size * 0.4;
    }
    ctx.fillStyle = fill;
    if (maxW) ctx.fillText(str, x, y, maxW);
    else ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  /** Ikon ✓ / ✗ digambar dengan garis (tidak bergantung font) supaya tidak hanya andalkan warna. */
  _icon(ok, x, y, s, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (ok) {
      ctx.moveTo(x - s * 0.5, y);
      ctx.lineTo(x - s * 0.12, y + s * 0.38);
      ctx.lineTo(x + s * 0.55, y - s * 0.42);
    } else {
      ctx.moveTo(x - s * 0.42, y - s * 0.42);
      ctx.lineTo(x + s * 0.42, y + s * 0.42);
      ctx.moveTo(x + s * 0.42, y - s * 0.42);
      ctx.lineTo(x - s * 0.42, y + s * 0.42);
    }
    ctx.strokeStyle = 'rgba(20,5,50,0.9)';
    ctx.lineWidth = Math.max(3, s * 0.36);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.24);
    ctx.stroke();
    ctx.restore();
  }

  /** Panel tegak di kedalaman d dengan rentang lateral [l0, l1] dan tinggi [h0, h1]. */
  _panel(d, l0, l1, h0, h1, fill, edge, alpha) {
    const ctx = this.ctx;
    const t = CAM / (CAM + d);
    const gy = this._gy(t);
    const x0 = CX + l0 * ROAD_HW * t;
    const x1 = CX + l1 * ROAD_HW * t;
    const yb = gy - h0 * HU * t;
    const yt = gy - h1 * HU * t;
    ctx.globalAlpha = alpha;
    // kartu kaca: isi + gradasi vertikal + kilau diagonal
    ctx.fillStyle = fill;
    this._rr(x0, yt, x1 - x0, yb - yt, 12 * t);
    ctx.fill();
    if (this.quality > 0) {
      const gl = ctx.createLinearGradient(0, yt, 0, yb);
      gl.addColorStop(0, 'rgba(255,255,255,0.28)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0.04)');
      gl.addColorStop(1, 'rgba(255,255,255,0.14)');
      ctx.fillStyle = gl;
      this._rr(x0, yt, x1 - x0, yb - yt, 12 * t);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.12, yt);
    ctx.lineTo(x0 + (x1 - x0) * 0.4, yt);
    ctx.lineTo(x0 + (x1 - x0) * 0.2, yb);
    ctx.lineTo(x0, yb);
    ctx.lineTo(x0, yt + (yb - yt) * 0.25);
    ctx.closePath();
    ctx.fill();
    if (this.quality > 1 && t > 0.15) {
      ctx.save();
      ctx.shadowColor = edge;
      ctx.shadowBlur = 14 * t;
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(1.5, 6 * t);
      this._rr(x0, yt, x1 - x0, yb - yt, 12 * t);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(1.5, 6 * t);
      this._rr(x0, yt, x1 - x0, yb - yt, 12 * t);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return { x0, x1, yt, yb, t, w: x1 - x0 };
  }

  _items(game) {
    const gates = game.gates;
    const list = this.visible;
    list.length = 0;
    for (let i = Math.max(0, game.idx - 3); i < gates.length; i++) {
      const d = gates[i].z - game.dist;
      if (d > MAX_DEPTH) break;
      if (d < -6) continue;
      list.push(gates[i]);
    }
    for (let k = list.length - 1; k >= 0; k--) this._gate(list[k], list[k].z - game.dist, game);
  }

  /** Tiang pembatas antar gerbang pada posisi lateral `lat`. */
  _post(d, h, lat) {
    const ctx = this.ctx;
    const t = CAM / (CAM + d);
    const gy = this._gy(t);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(CX + lat * ROAD_HW * t - 3 * t, gy - h * HU * t, 6 * t, h * HU * t);
  }

  /** Gerbang soal: banner di atas + 2-3 gerbang kaca biru yang mengisi seluruh lebar jalur. */
  _gate(g, d, game) {
    const ctx = this.ctx;
    const resolved = g.chosen >= 0;
    const fade = resolved ? clamp(1 + d / 6, 0, 1) : 1;
    const pal = palette(this.cb);
    const b = this._panel(d, -1.02, 1.02, GATE_H + 0.15, GATE_H + 2.05, 'rgba(48,14,104,0.92)', '#ffd84d', fade);
    ctx.globalAlpha = fade;
    this._text(g.q.short, CX, (b.yt + b.yb) / 2, 52 * b.t, '#ffffff', b.w * 0.94, undefined, '#ffd84d');
    ctx.globalAlpha = 1;

    const n = g.active.length;
    const under = !resolved && d < 70 ? laneAt(n, game.x) : -1; // gerbang yang sedang dituju robot
    const blink = Math.sin(this.time * 32) > 0;
    for (let k = 0; k < n; k++) {
      const choice = g.active[k];
      const [l0, l1] = laneBounds(n, k);
      let fill = 'rgba(52,140,255,0.5)';
      let edge = '#a9d6ff';
      let mark = 0; // 1 = ✓, -1 = ✗
      if (k === under) {
        fill = 'rgba(80,170,255,0.72)';
        edge = '#ffffff';
      }
      if (resolved) {
        if (choice === g.q.correct) {
          fill = pal.ok.fill;
          edge = pal.ok.edge;
          mark = 1;
        } else if (choice === g.chosen) {
          fill = blink ? pal.bad.fill : pal.bad.fill.replace(/[\d.]+\)$/, '0.3)');
          edge = pal.bad.edge;
          mark = -1;
        }
      }
      const p = this._panel(d, l0 + 0.02, l1 - 0.02, 0, GATE_H, fill, edge, fade);
      ctx.globalAlpha = fade;
      const cxp = (p.x0 + p.x1) / 2;
      const cyp = (p.yt + p.yb) / 2;
      this._text(g.q.choices[choice], cxp, mark ? cyp + p.t * 22 : cyp, (n === 3 ? 72 : 88) * p.t, '#ffffff', p.w * 0.84, undefined, '#9fd0ff');
      if (mark) this._icon(mark > 0, cxp, p.yt + (p.yb - p.yt) * 0.24, p.t * 38, mark > 0 ? pal.ok.hex : pal.bad.hex);
      ctx.globalAlpha = 1;
    }
    for (let k = 1; k < n; k++) this._post(d, GATE_H + 0.15, laneBounds(n, k)[0]);
  }

  // ---------- Boss ----------
  _boss(game, world) {
    const lv = game.level;
    const d = lv.bossZ - game.dist;
    if (d > MAX_DEPTH) return;
    const ctx = this.ctx;
    const t = CAM / (CAM + d);
    const gy = this._gy(t);
    const dead = game.phase === 'won';
    const deadT = dead ? clamp(game.phaseTime / 0.9, 0, 1) : 0;
    if (deadT >= 1) return;

    const big = lv.big;
    const wallW = ROAD_HW * 2.35 * t;
    // tembok dibatasi supaya label HP di atasnya tetap muat di layar pendek
    const wallH = Math.min((big ? 8.4 : 6.6) * HU * t, (gy - 62 - 100 * t) / 1.24);
    let x0 = CX - wallW / 2;
    let y0 = gy - wallH + Math.sin(this.lunge * Math.PI) * 26 * t; // boss maju saat menyerang
    if (this.bossHit > 0) {
      x0 += (Math.random() - 0.5) * 6 * this.bossHit;
      y0 += (Math.random() - 0.5) * 4 * this.bossHit;
    }
    ctx.save();
    ctx.globalAlpha = 1 - deadT;
    if (dead) {
      ctx.translate(CX, y0 + wallH / 2);
      ctx.scale(1 + deadT * 0.35, 1 + deadT * 0.35);
      ctx.translate(-CX, -(y0 + wallH / 2));
    }

    const body = world.boss;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(CX, gy, wallW * 0.55, 10 * t, 0, 0, TAU);
    ctx.fill();

    if (big) {
      // tanduk
      ctx.fillStyle = '#f4efe0';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(CX + s * wallW * 0.22, y0 + 4);
        ctx.lineTo(CX + s * wallW * 0.42, y0 - wallH * 0.22);
        ctx.lineTo(CX + s * wallW * 0.36, y0 + wallH * 0.1);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // bergerigi seperti benteng
      ctx.fillStyle = body;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x0 + (wallW / 5) * i + wallW * 0.02, y0 - wallH * 0.1, wallW / 5 - wallW * 0.04, wallH * 0.12);
      }
    }

    const g = ctx.createLinearGradient(0, y0, 0, gy);
    g.addColorStop(0, body);
    g.addColorStop(1, '#00000055');
    ctx.fillStyle = body;
    this._rr(x0, y0, wallW, wallH, 22 * t);
    ctx.fill();
    ctx.fillStyle = g;
    this._rr(x0, y0, wallW, wallH, 22 * t);
    ctx.fill();

    if (!big) {
      // pola bata
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = Math.max(1, 3 * t);
      const rows = 4;
      for (let r = 1; r < rows; r++) {
        const y = y0 + (wallH / rows) * r;
        ctx.beginPath();
        ctx.moveTo(x0 + 6 * t, y);
        ctx.lineTo(x0 + wallW - 6 * t, y);
        ctx.stroke();
      }
      for (let r = 0; r < rows; r++) {
        const y = y0 + (wallH / rows) * r;
        const shift = r % 2 ? 0.125 : 0;
        for (let c = 1; c < 4; c++) {
          const x = x0 + wallW * (c / 4 + shift);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + wallH / rows);
          ctx.stroke();
        }
      }
    } else {
      // wajah monster
      const ey = y0 + wallH * 0.28;
      for (const s of [-1, 1]) {
        const ex = CX + s * wallW * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, wallW * 0.085, wallH * 0.09, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#240a3f';
        ctx.beginPath();
        ctx.arc(ex - s * wallW * 0.01, ey + wallH * 0.015, wallW * 0.04, 0, TAU);
        ctx.fill();
        // alis marah
        ctx.strokeStyle = '#240a3f';
        ctx.lineWidth = Math.max(2, 9 * t);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - s * wallW * 0.1, ey - wallH * 0.14);
        ctx.lineTo(ex + s * wallW * 0.09, ey - wallH * 0.07);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // mulut bergigi
      const my = y0 + wallH * 0.86;
      ctx.fillStyle = '#240a3f';
      this._rr(CX - wallW * 0.3, my - wallH * 0.08, wallW * 0.6, wallH * 0.14, 10 * t);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const tx = CX - wallW * 0.3 + (wallW * 0.6 / 6) * i + wallW * 0.01;
        ctx.beginPath();
        ctx.moveTo(tx, my - wallH * 0.08);
        ctx.lineTo(tx + wallW * 0.04, my - wallH * 0.08);
        ctx.lineTo(tx + wallW * 0.02, my - wallH * 0.02);
        ctx.closePath();
        ctx.fill();
      }
    }

    // kilatan saat terkena
    if (this.bossHit > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.bossHit * 0.5})`;
      this._rr(x0, y0, wallW, wallH, 22 * t);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(2, 5 * t);
    this._rr(x0, y0, wallW, wallH, 22 * t);
    ctx.stroke();

    // bar HP + angka HP + label (di atas tembok supaya tidak tertutup robot)
    const barW = wallW * 0.86;
    const barH = 16 * t;
    const by = y0 - (big ? wallH * 0.24 : wallH * 0.14);
    ctx.fillStyle = 'rgba(15,5,40,0.75)';
    this._rr(CX - barW / 2, by, barW, barH, barH / 2);
    ctx.fill();
    const frac = clamp(game.hpLeft / lv.bossHp, 0, 1);
    ctx.fillStyle = frac > 0.5 ? '#43e08c' : frac > 0.25 ? '#ffd23f' : '#ff5a5a';
    this._rr(CX - barW / 2, by, Math.max(barH, barW * frac), barH, barH / 2);
    ctx.fill();
    this._text('HP ' + fmt(Math.ceil(Math.max(0, game.hpLeft))), CX, by - 40 * t, 84 * t, '#ffffff', wallW * 0.9);
    this._text(big ? 'BOSS BESAR' : 'TEMBOK ANGKA', CX, by - 88 * t, 24 * t, '#ffd23f');
    ctx.restore();
  }

  _shots() {
    const ctx = this.ctx;
    for (const s of this.shots) {
      if (!s.on) continue;
      const x = s.x0 + (s.x1 - s.x0) * s.t;
      const y = s.y0 + (s.y1 - s.y0) * s.t;
      const px = s.x0 + (s.x1 - s.x0) * Math.max(0, s.t - 0.25);
      const py = s.y0 + (s.y1 - s.y0) * Math.max(0, s.t - 0.25);
      const scale = 1 - s.t * 0.4;
      const c = this.skin.rings[1];
      ctx.lineCap = 'round';
      if (this.quality > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 18 * scale;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = 9 * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * scale;
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // ---------- Blaster Bot + cincin energi ----------
  _ringPos(k) {
    const d = 4 + k * 2.5;
    const t = CAM / (CAM + d);
    const lat = (this.robotX - CX) / ROAD_HW;
    const hover = (this.groundY - this.robotY) / HU;
    return { x: CX + lat * ROAD_HW * t, y: this._gy(t) - hover * HU * t, t };
  }

  _robot(game) {
    const ctx = this.ctx;
    const skin = this.skin;
    const gx = this.robotX;
    const by = this.robotY;
    const r = ROBOT_R;
    const bullets = game ? game.bullets : 10;
    const extra = bullets > CFG.ringsMax ? clamp(Math.log10(bullets / CFG.ringsMax) / 1.6, 0, 1) : 0;
    const glowOn = this.quality > 0;

    // bayangan lembut di jalur
    const sh = ctx.createRadialGradient(gx, this.groundY + 16, 4, gx, this.groundY + 16, r * 1.4);
    sh.addColorStop(0, 'rgba(0,0,0,0.38)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(gx, this.groundY + 16, r * 1.4, r * 0.34, 0, 0, TAU);
    ctx.fill();

    // rantai cincin energi (jauh -> dekat), menyala bergelombang dari belakang ke depan
    for (let k = this.ringCount - 1; k >= 0; k--) {
      const p = this._ringPos(k);
      const e = Math.max(0, 1 - this.ringAge[k] / 0.28); // squash & stretch saat cincin baru muncul
      const rx = r * 0.8 * p.t * (1 + extra * 0.45) * (1 + 0.45 * e);
      const ry = rx * 0.94 * (1 - 0.3 * e);
      const wave = 0.55 + 0.45 * Math.sin(this.time * 9 - k * 0.75);
      const alpha = clamp(wave * (0.8 + 0.2 * extra) + e * 0.4, 0.28, 1);
      drawRing(ctx, p.x, p.y, rx, ry, skin.rings[k % 3], Math.max(1.6, 6.5 * p.t * (1 + extra * 0.7)), alpha, glowOn);
      if (k === this.ringCount - 1) {
        this.gunX = p.x;
        this.tipY = p.y - rx;
      }
    }

    // kilatan di ujung rantai saat menembak
    if (this.muzzle > 0.05) {
      const tipP = this._ringPos(this.ringCount - 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mg = ctx.createRadialGradient(tipP.x, tipP.y, 2, tipP.x, tipP.y, 60 * this.muzzle + 10);
      mg.addColorStop(0, 'rgba(255,255,255,0.95)');
      mg.addColorStop(0.4, skin.rings[1] + 'cc');
      mg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(tipP.x, tipP.y, 60 * this.muzzle + 10, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // badan: squash & stretch + miring mengikuti gerak
    const vel = gx - this.lastRobotX;
    this.lastRobotX = gx;
    this.tilt += (clamp(vel * 0.03, -0.14, 0.14) - this.tilt) * 0.2;
    const squash = this.reduceMotion ? 0 : this.pop;
    const blink = this.blinkT > 0 ? Math.sin(Math.PI * (1 - this.blinkT / 0.14)) : 0;
    drawRobotBody(ctx, gx, by, r, skin, {
      expr: this.expr,
      blink,
      time: this.time,
      number: fmt(this.shown),
      sx: 1 + squash * 0.1,
      sy: 1 - squash * 0.08,
      tilt: this.tilt,
      glow: glowOn,
    });

    // pet pendamping
    if (this.petId) drawPet(ctx, this.petId, this.petX, this.petY, 15, this.time);
  }

  _particles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      if (!p.on) continue;
      ctx.globalAlpha = clamp(p.life / p.max * 1.6, 0, 1);
      ctx.fillStyle = p.color;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      if (p.shape === 1) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.shape === 2) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.6, p.size * 0.5);
        ctx.lineTo(-p.size * 0.6, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  _texts() {
    const ctx = this.ctx;
    for (const t of this.texts) {
      if (!t.on) continue;
      const k = clamp(t.life / t.max, 0, 1);
      const pop = 1 + Math.max(0, (k - 0.8) * 2.5);
      ctx.globalAlpha = Math.min(1, k * 2.5);
      this._text(t.s, t.x, t.y, t.size * pop, t.color, undefined, undefined, t.color);
    }
    ctx.globalAlpha = 1;
  }
}
