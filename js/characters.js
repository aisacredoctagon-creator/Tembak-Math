// Karakter: "Nobo" si Blaster Bot (robot meriam mungil melayang), skin, pet, dan fungsi menggambarnya.
// Semua digambar lewat kode canvas. Data skin berbasis data supaya mudah menambah skin baru.

const TAU = Math.PI * 2;

/**
 * Skin robot. Tambah skin baru cukup dengan menambah objek di sini.
 *  body: [terang, sedang, gelap]   rim: warna cahaya tepi     screen: warna layar wajah
 *  eye: warna mata / angka        eyeShape: round | tall | bar | heart | star | slit
 *  rings: tiga warna cincin energi   trail: warna jejak cahaya
 *  accessory: antenna | crown | headphones | bow | halo | spikes
 */
export const SKINS = [
  {
    id: 'klasik', name: 'Klasik Biru', price: 0,
    body: ['#9fe0ff', '#2f7bf0', '#15388f'], rim: '#d4f3ff', screen: '#071a45', eye: '#7df0ff', eyeShape: 'round',
    rings: ['#27e6ff', '#ff9a2e', '#ff4fd8'], trail: '#7df0ff', accessory: 'antenna',
  },
  {
    id: 'emas', name: 'Emas', price: 150,
    body: ['#fff1a8', '#f5b800', '#9a5a00'], rim: '#fffbe0', screen: '#3a2200', eye: '#ffe27a', eyeShape: 'tall',
    rings: ['#ffd23f', '#fff6c2', '#ff9a2e'], trail: '#ffe27a', accessory: 'crown',
  },
  {
    id: 'neon', name: 'Neon', price: 250,
    body: ['#6a5cff', '#2a1a6e', '#0d0830'], rim: '#b8ffea', screen: '#02061a', eye: '#3dffb5', eyeShape: 'bar',
    rings: ['#3dffb5', '#ff2fd0', '#35c7ff'], trail: '#3dffb5', accessory: 'headphones',
  },
  {
    id: 'permen', name: 'Permen', price: 300,
    body: ['#ffd1ec', '#ff7ac4', '#c93a8f'], rim: '#ffffff', screen: '#4a1240', eye: '#ffffff', eyeShape: 'heart',
    rings: ['#ff7ac4', '#ffffff', '#ffe27a'], trail: '#ffb6e0', accessory: 'bow',
  },
  {
    id: 'galaksi', name: 'Galaksi', price: 450,
    body: ['#b48cff', '#5a2fc2', '#1b0b52'], rim: '#e8d6ff', screen: '#0a0524', eye: '#ffe27a', eyeShape: 'star',
    rings: ['#b48cff', '#5de0ff', '#ff7bd5'], trail: '#c9b0ff', accessory: 'halo',
  },
  {
    id: 'dino', name: 'Dino', price: 600,
    body: ['#c9ff9a', '#4cc24a', '#1d6b2a'], rim: '#eaffd0', screen: '#0c2a12', eye: '#ffd23f', eyeShape: 'slit',
    rings: ['#9dff4a', '#ff9a2e', '#ffe27a'], trail: '#b6ff7a', accessory: 'spikes',
  },
];

/** Pet pendamping. `bonus` dibaca oleh Game. */
export const PETS = [
  { id: 'api', name: 'Bola Api', price: 120, desc: '+1 peluru setiap jawaban benar', bonus: { bulletsPerCorrect: 1 } },
  { id: 'kucing', name: 'Kucing Roket', price: 200, desc: '+1 hint di setiap level', bonus: { hints: 1 } },
];

export const getSkin = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
export const getPet = (id) => PETS.find((p) => p.id === id) || null;

// ---------- Bentuk bantu ----------

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

// ---------- Mata (ekspresi) ----------

/**
 * Gambar sepasang mata. expr: normal | focus | happy | dizzy | cheer | sad.
 * blink: 0 (terbuka) .. 1 (tertutup).
 */
function drawEyes(ctx, x, y, e, skin, expr, blink, time, glow) {
  ctx.save();
  ctx.fillStyle = skin.eye;
  ctx.strokeStyle = skin.eye;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glow) {
    ctx.shadowColor = skin.eye;
    ctx.shadowBlur = e * 1.2;
  }
  for (const s of [-1, 1]) {
    const ex = x + s * e * 1.9;
    ctx.save();
    ctx.translate(ex, y);
    if (expr === 'happy' || expr === 'cheer') {
      ctx.lineWidth = e * 0.55;
      ctx.beginPath();
      ctx.arc(0, e * 0.35, e * 0.85, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      if (expr === 'cheer') {
        ctx.fillStyle = '#fff6c2';
        star(ctx, s * e * 0.1, -e * 1.15 + Math.sin(time * 9 + s) * e * 0.15, e * 0.42, 4);
        ctx.fill();
      }
    } else if (expr === 'dizzy') {
      ctx.lineWidth = e * 0.28;
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.2; a += 0.3) {
        const rad = (a / (TAU * 2.2)) * e * 1.05;
        const ang = a * s + time * 8;
        ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.stroke();
    } else if (expr === 'sad') {
      ctx.beginPath();
      ctx.ellipse(0, e * 0.15, e * 0.95, e * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = e * 0.32;
      ctx.beginPath();
      ctx.moveTo(-s * e * 1.0, -e * 0.55 - s * e * 0.1);
      ctx.lineTo(s * e * 0.9, -e * 1.05 + s * e * 0.2);
      ctx.stroke();
      if (s > 0) {
        ctx.fillStyle = '#8fd8ff';
        ctx.beginPath();
        ctx.ellipse(e * 0.5, e * 1.2 + ((time * 30) % (e * 1.4)), e * 0.25, e * 0.38, 0, 0, TAU);
        ctx.fill();
      }
    } else if (expr === 'focus') {
      ctx.beginPath();
      ctx.ellipse(0, 0, e * 1.1, e * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = skin.screen;
      ctx.beginPath();
      ctx.arc(s * e * 0.15, 0, e * 0.3, 0, TAU);
      ctx.fill();
      ctx.lineWidth = e * 0.3;
      ctx.beginPath();
      ctx.moveTo(-s * e * 1.1, -e * 1.05);
      ctx.lineTo(s * e * 0.7, -e * 0.75);
      ctx.stroke();
    } else {
      // normal: bentuk ikut skin
      const open = Math.max(0.08, 1 - blink);
      ctx.scale(1, open);
      switch (skin.eyeShape) {
        case 'tall':
          ctx.beginPath();
          ctx.ellipse(0, 0, e * 0.8, e * 1.2, 0, 0, TAU);
          ctx.fill();
          break;
        case 'bar':
          rr(ctx, -e * 1.0, -e * 0.4, e * 2.0, e * 0.8, e * 0.4);
          ctx.fill();
          break;
        case 'heart':
          heart(ctx, 0, 0, e * 0.9);
          ctx.fill();
          break;
        case 'star':
          star(ctx, 0, 0, e * 1.15);
          ctx.fill();
          break;
        case 'slit':
          ctx.beginPath();
          ctx.ellipse(0, 0, e, e, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = skin.screen;
          ctx.fillRect(-e * 0.14, -e, e * 0.28, e * 2);
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, e, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(-e * 0.3, -e * 0.35, e * 0.32, 0, TAU);
          ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Aksesori ----------

function drawAccessory(ctx, kind, r, skin, time) {
  ctx.save();
  switch (kind) {
    case 'antenna': {
      ctx.strokeStyle = skin.body[2];
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(r * 0.06, -r * 1.3);
      ctx.stroke();
      const pulse = 0.7 + 0.3 * Math.sin(time * 5);
      ctx.fillStyle = skin.rings[1];
      ctx.shadowColor = skin.rings[1];
      ctx.shadowBlur = r * 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(r * 0.06, -r * 1.34, r * 0.11, 0, TAU);
      ctx.fill();
      break;
    }
    case 'crown': {
      const g = ctx.createLinearGradient(0, -r * 1.3, 0, -r * 0.85);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(1, '#e09a00');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#9a5a00';
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.82);
      ctx.lineTo(-r * 0.55, -r * 1.25);
      ctx.lineTo(-r * 0.25, -r * 1.02);
      ctx.lineTo(0, -r * 1.36);
      ctx.lineTo(r * 0.25, -r * 1.02);
      ctx.lineTo(r * 0.55, -r * 1.25);
      ctx.lineTo(r * 0.5, -r * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff4fd8';
      ctx.beginPath();
      ctx.arc(0, -r * 1.0, r * 0.07, 0, TAU);
      ctx.fill();
      break;
    }
    case 'headphones': {
      ctx.strokeStyle = skin.rings[0];
      ctx.lineWidth = r * 0.1;
      ctx.shadowColor = skin.rings[0];
      ctx.shadowBlur = r * 0.3;
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, r * 1.0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.stroke();
      ctx.fillStyle = skin.rings[1];
      for (const s of [-1, 1]) {
        rr(ctx, s * r * 1.0 - r * 0.13, -r * 0.28, r * 0.26, r * 0.5, r * 0.1);
        ctx.fill();
      }
      break;
    }
    case 'bow': {
      ctx.fillStyle = '#ff3fa4';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.04;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.98);
        ctx.quadraticCurveTo(s * r * 0.5, -r * 1.45, s * r * 0.55, -r * 1.0);
        ctx.quadraticCurveTo(s * r * 0.4, -r * 0.8, 0, -r * 0.98);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(0, -r * 0.98, r * 0.1, 0, TAU);
      ctx.fill();
      break;
    }
    case 'halo': {
      ctx.strokeStyle = skin.rings[1];
      ctx.lineWidth = r * 0.06;
      ctx.shadowColor = skin.rings[1];
      ctx.shadowBlur = r * 0.3;
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.02, r * 0.75, r * 0.2, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#fff6c2';
      for (let i = 0; i < 4; i++) {
        const a = time * 1.6 + (i * TAU) / 4;
        star(ctx, Math.cos(a) * r * 0.75, -r * 1.02 + Math.sin(a) * r * 0.2, r * 0.1, 4);
        ctx.fill();
      }
      break;
    }
    case 'spikes': {
      ctx.fillStyle = '#ff9a2e';
      ctx.strokeStyle = '#a14a00';
      ctx.lineWidth = r * 0.04;
      for (const [sx, h] of [[-0.42, 0.28], [0, 0.38], [0.42, 0.28]]) {
        ctx.beginPath();
        ctx.moveTo(sx * r - r * 0.14, -r * 0.86 + Math.abs(sx) * r * 0.25);
        ctx.lineTo(sx * r, -r * (0.86 + h) + Math.abs(sx) * r * 0.2);
        ctx.lineTo(sx * r + r * 0.14, -r * 0.86 + Math.abs(sx) * r * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ---------- Badan robot ----------

/**
 * Gambar badan + layar wajah di (x, y) dengan jari-jari r.
 * st: { expr, blink, time, number, sx, sy, tilt, glow }
 */
export function drawRobotBody(ctx, x, y, r, skin, st) {
  const { expr = 'normal', blink = 0, time = 0, number = '', sx = 1, sy = 1, tilt = 0, glow = true } = st;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(sx, sy);

  // api roket kecil di bawah
  const fl = 0.75 + 0.25 * Math.sin(time * 28);
  const fg = ctx.createLinearGradient(0, r * 0.8, 0, r * (1.3 + 0.35 * fl));
  fg.addColorStop(0, skin.trail);
  fg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.82);
  ctx.quadraticCurveTo(0, r * (1.45 + 0.3 * fl), r * 0.3, r * 0.82);
  ctx.closePath();
  ctx.fill();

  // badan (orb glossy)
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  bg.addColorStop(0, skin.body[0]);
  bg.addColorStop(0.5, skin.body[1]);
  bg.addColorStop(1, skin.body[2]);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.9, 0, 0, TAU);
  ctx.fill();

  // pod di sisi kiri-kanan
  for (const s of [-1, 1]) {
    const pg = ctx.createLinearGradient(s * r * 0.9, 0, s * r * 1.25, 0);
    pg.addColorStop(0, skin.body[1]);
    pg.addColorStop(1, skin.body[2]);
    ctx.fillStyle = pg;
    rr(ctx, s > 0 ? r * 0.88 : -r * 1.22, -r * 0.25, r * 0.34, r * 0.5, r * 0.14);
    ctx.fill();
    ctx.fillStyle = skin.rings[0];
    ctx.shadowColor = skin.rings[0];
    ctx.shadowBlur = glow ? r * 0.25 : 0;
    ctx.beginPath();
    ctx.arc(s * r * 1.05, 0, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // cahaya tepi (rim light)
  const rg = ctx.createLinearGradient(-r, -r, r * 0.6, r * 0.6);
  rg.addColorStop(0, skin.rim);
  rg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = rg;
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.97, r * 0.87, 0, 0, TAU);
  ctx.stroke();

  // layar wajah (kaca gelap)
  const sw = r * 1.5;
  const sh = r * 1.12;
  const scr = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
  scr.addColorStop(0, skin.screen);
  scr.addColorStop(1, '#000000');
  ctx.fillStyle = scr;
  rr(ctx, -sw / 2, -sh / 2 + r * 0.06, sw, sh, r * 0.32);
  ctx.fill();
  ctx.strokeStyle = skin.eye;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = r * 0.04;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // mata + angka peluru
  drawEyes(ctx, 0, -r * 0.2, r * 0.17, skin, expr, blink, time, glow);
  if (number !== '') {
    const size = r * (number.length > 4 ? 0.36 : 0.48);
    ctx.font = `700 ${size}px "Fredoka","Arial Rounded MT Bold","Trebuchet MS","Segoe UI",ui-rounded,system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (glow) {
      ctx.shadowColor = skin.eye;
      ctx.shadowBlur = r * 0.35;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(number, 0, r * 0.28, sw * 0.88);
    ctx.shadowBlur = 0;
    ctx.fillStyle = skin.eye;
    ctx.globalAlpha = 0.5;
    ctx.fillText(number, 0, r * 0.28, sw * 0.88);
    ctx.globalAlpha = 1;
  }

  // kilap kaca layar
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(-sw / 2 + r * 0.2, -sh / 2 + r * 0.12);
  ctx.lineTo(-sw / 2 + r * 0.75, -sh / 2 + r * 0.12);
  ctx.lineTo(-sw / 2 + r * 0.25, sh / 2 - r * 0.05);
  ctx.lineTo(-sw / 2 + r * 0.05, sh / 2 - r * 0.2);
  ctx.closePath();
  ctx.fill();

  // highlight putih di atas badan
  const hg = ctx.createRadialGradient(-r * 0.4, -r * 0.62, 0, -r * 0.4, -r * 0.62, r * 0.5);
  hg.addColorStop(0, 'rgba(255,255,255,0.75)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.62, r * 0.45, r * 0.22, -0.5, 0, TAU);
  ctx.fill();

  drawAccessory(ctx, skin.accessory, r, skin, time);
  ctx.restore();
}

/** Satu cincin energi (lingkaran menghadap kamera). */
export function drawRing(ctx, x, y, rx, ry, color, width, alpha, glow) {
  if (rx < 1) return;
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 2.6;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = Math.min(1, alpha * 0.9);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(0.6, width * 0.28);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- Pet ----------

/** Pet kecil (ukuran s). */
export function drawPet(ctx, id, x, y, s, time) {
  ctx.save();
  ctx.translate(x, y);
  if (id === 'api') {
    // bola api mungil
    const g = ctx.createRadialGradient(0, s * 0.1, s * 0.1, 0, 0, s * 1.1);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.45, '#ffb02e');
    g.addColorStop(1, '#e8420f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, TAU);
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      const h = s * (0.9 + 0.35 * Math.sin(time * 9 + i * 1.7));
      ctx.fillStyle = i === 0 ? '#ffd23f' : '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(i * s * 0.55 - s * 0.28, -s * 0.55);
      ctx.quadraticCurveTo(i * s * 0.55, -s * 0.6 - h, i * s * 0.55 + s * 0.28, -s * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#3a1000';
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(e * s * 0.38, -s * 0.05, s * 0.13, s * 0.19, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#3a1000';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.arc(0, s * 0.22, s * 0.25, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // kucing roket
    const fl = 0.7 + 0.3 * Math.sin(time * 24);
    const fg = ctx.createLinearGradient(0, s * 0.8, 0, s * (1.9 + fl * 0.5));
    fg.addColorStop(0, '#ffd23f');
    fg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.85);
    ctx.quadraticCurveTo(0, s * (2 + fl * 0.5), s * 0.35, s * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7fb8ff';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.65, s * 0.55, s * 0.32, 0, 0, TAU);
    ctx.fill();
    const hg = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.1);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(1, '#c9d2e8');
    ctx.fillStyle = hg;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(e * s * 0.25, -s * 0.7);
      ctx.lineTo(e * s * 0.85, -s * 1.3);
      ctx.lineTo(e * s * 0.95, -s * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#243253';
    const blink = Math.sin(time * 1.3) > 0.97 ? 0.15 : 1;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(e * s * 0.38, -s * 0.05, s * 0.14, s * 0.2 * blink, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ff7aa8';
    ctx.beginPath();
    ctx.arc(0, s * 0.18, s * 0.09, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#243253';
    ctx.lineWidth = s * 0.05;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(e * s * 0.3, s * 0.22);
      ctx.lineTo(e * s * 0.95, s * 0.12);
      ctx.moveTo(e * s * 0.3, s * 0.3);
      ctx.lineTo(e * s * 0.95, s * 0.38);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Pratinjau datar untuk Toko: robot + cincin ke atas + pet. */
export function drawRobotPreview(ctx, w, h, skin, time, petId) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const r = Math.min(w, h) * 0.24;
  const cy = h * 0.66 + Math.sin(time * 2.4) * 3;
  for (let k = 5; k >= 0; k--) {
    const t = 1 - k * 0.11;
    const wave = 0.55 + 0.45 * Math.sin(time * 7 - k * 0.8);
    drawRing(ctx, cx, cy - r * 0.55 - k * r * 0.34, r * 0.62 * t, r * 0.5 * t, skin.rings[k % 3], Math.max(1.5, r * 0.09 * t), wave, true);
  }
  // sebagian besar waktu mata normal supaya bentuk mata tiap skin terlihat; sesekali senang
  const expr = Math.floor(time / 2.2) % 3 === 2 ? 'happy' : 'normal';
  const blink = Math.max(0, Math.sin(time * 1.9) - 0.9) * 10;
  drawRobotBody(ctx, cx, cy, r, skin, { expr, blink: Math.min(1, blink), time, number: '99', glow: true });
  if (petId) drawPet(ctx, petId, cx + r * 1.5, cy - r * 0.9 + Math.sin(time * 3) * 3, r * 0.3, time);
}

/** Pratinjau pet (untuk Toko). */
export function drawPetPreview(ctx, w, h, petId, time) {
  ctx.clearRect(0, 0, w, h);
  drawPet(ctx, petId, w / 2, h * 0.5 + Math.sin(time * 3) * 4, Math.min(w, h) * 0.26, time);
}
