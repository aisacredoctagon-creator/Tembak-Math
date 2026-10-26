// Service worker sederhana: game bisa dipasang di HP dan jalan offline.
// Strategi: JARINGAN DULU (selalu ambil versi terbaru), cadangan dari cache bila offline.
// Semua path relatif terhadap lokasi sw.js, jadi aman di sub-path /Tembak-Math/.
// Naikkan CACHE_VERSION bila ingin memaksa pembersihan cache lama.
const CACHE_VERSION = 'v1';
const CACHE = `tembak-math-${CACHE_VERSION}`;

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/components.css',
  'css/layout.css',
  'js/main.js',
  'js/config.js',
  'js/questions.js',
  'js/game.js',
  'js/render.js',
  'js/characters.js',
  'js/ui.js',
  'js/input.js',
  'js/audio.js',
  'js/storage.js',
  'assets/fonts/fredoka-700-latin.woff2',
  'assets/fonts/nunito-latin-variable.woff2',
  'assets/star-gold-left.svg',
  'assets/star-gold-center.svg',
  'assets/star-dim.svg',
  'assets/icon-hint.svg',
  'assets/icon-pause.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // hapus cache versi lama
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tembak-math-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))),
  );
});
