# Tembak Math (Math Gun Runner)

[![Deploy ke GitHub Pages](https://github.com/aisacredoctagon-creator/Tembak-Math/actions/workflows/deploy.yml/badge.svg)](https://github.com/aisacredoctagon-creator/Tembak-Math/actions/workflows/deploy.yml)
[![Lisensi: MIT](https://img.shields.io/badge/lisensi-MIT-blue.svg)](LICENSE)

**Main sekarang:** https://aisacredoctagon-creator.github.io/Tembak-Math/ (bisa dipasang di HP lewat "Tambahkan ke layar utama", dan jalan offline setelah dibuka sekali).

Game runner matematika (tambah, kurang, kali, bagi): pilih gerbang berisi jawaban yang benar, kumpulkan peluru, lalu kalahkan boss lewat soal cepat.

## Status versi

Versi saat ini: Blaster Bot dan tampilan premium (V3 tahap 1) dengan UI dari desain Figma (V4).

Game web hyper-casual bergaya "gun runner" untuk siswa SD kelas 3 sampai SMP. **Tidak ada gerbang gratis**: setiap gerbang adalah soal matematika, dan pertarungan boss juga berbentuk soal. Semua teks dalam Bahasa Indonesia.

**Nobo si Blaster Bot** (robot meriam mungil melayang) berlari otomatis di jalur. Layar wajahnya menampilkan jumlah peluru dan mata yang berubah ekspresi. Cincin energi bercahaya memanjang ke depan menjadi "laras". Soal tampil besar di bagian atas layar dan 2-3 gerbang kaca biru berisi pilihan jawaban. Geser robot ke gerbang yang benar sebelum gerbang tiba.

## Status versi 3

Tahap yang sudah selesai (dari rencana V3 delapan tahap):

- (a) **Karakter Blaster Bot**: badan glossy dengan layar wajah, ekspresi (normal, fokus, senang, pusing, bersorak, sedih) dan kedip acak, cincin energi (jumlah mengikuti peluru, maks 12, berdenyut bergelombang, "pop" saat bertambah, pecah saat berkurang), jejak cahaya, bayangan, 6 skin (Klasik Biru, Emas, Neon, Permen, Galaksi, Dino) dan 2 pet (Bola Api, Kucing Roket).
- (b) **Efek visual dan game feel**: glow/bloom, latar paralaks (bintang, planet, awan, bukit), jalur neon dengan lampu berkedip mengikuti beat, gerbang kaca dengan ikon ✓/✗, gerbang pecah jadi serpihan kristal yang melesat ke robot, slow-motion singkat saat melewati gerbang, hit-stop pada tembakan kuat, squash and stretch, angka peluru count-up, FOV melebar saat combo tinggi, musik berlapis (drum dan melodi bertambah seiring combo), nada "ting" naik tiap combo, getar HP, splash screen, UI kartu kaca dengan transisi.
- (f, sebagian) **Koin dan Toko**: koin dari jawaban benar dan level selesai, toko skin dan pet, tersimpan di `localStorage`.
- (h, sebagian) **Opsi kualitas** (Rendah/Sedang/Tinggi, turun otomatis bila FPS rendah), **Kurangi gerakan**, **Mode buta warna** (biru/kuning + ikon ✓/✗), dan opsi Getar.

Belum dikerjakan: dunia bertema matematika dengan boss khas (c), gerbang spesial, bar Fokus, boss tembak sasaran, finisher sinematik, mode Endless/Harian/Duel (d), adaptive difficulty, Peta Penguasaan, lencana, dan Laporan Orang Tua (e), peti hadiah, permata, dan pencapaian (f), serta slider volume dan musik per dunia (g).

### Koin, skin, dan pet

- Koin: +1 tiap jawaban benar, +10 dan +5 per bintang saat menang. Skin dan pet dibeli di **Toko**.
- Pet **Bola Api**: +1 peluru tiap jawaban benar. Pet **Kucing Roket**: +1 hint di tiap level.
- Menambah skin baru: tambahkan satu objek di `SKINS` pada `js/characters.js` (warna badan, cincin, bentuk mata, aksesori, harga). Pet baru di `PETS`.

HTML5 + CSS + JavaScript murni (ES modules). Tanpa framework, tanpa build step, tanpa CDN, tanpa file aset: semua grafis digambar di `<canvas>`, semua suara dibuat dengan Web Audio.

## Cara menjalankan

ES modules butuh server statis (tidak bisa dibuka lewat `file://`). Cara termudah di Windows: klik dua kali **`start.bat`**. Atau di folder ini:

```bash
python -m http.server 8000
```

```bash
npx serve .
```

Lalu buka `http://localhost:8000`. Untuk mencoba di HP, buka `http://<IP-komputer>:8000` dari HP yang satu jaringan Wi-Fi.

Setelah mengubah kode, tekan Ctrl+F5 di browser supaya file JavaScript terbaru dimuat.

## Cara bermain

| Hal | Efek |
|---|---|
| Gerbang soal, jawaban benar | +10 peluru x multiplier combo, gerbang bersinar hijau, efek "ting" |
| Gerbang soal, jawaban salah | −5 peluru, combo reset, gerbang berkedip merah, "buzz", jawaban benar ditampilkan sekitar 1,5 detik |
| Combo (jawaban benar berturut-turut) | x1, x1,5, x2, x2,5, maksimum x3 |
| Hint (3 per level) | menghilangkan satu pilihan yang salah (tombol 💡 atau tombol `H`) |
| Boss | soal cepat (3-5): benar = menembak, salah atau waktu habis = boss menyerang |

**Boss:** tiap jawaban benar menembakkan sebagian peluru (sisa peluru dibagi sisa soal; soal terakhir menembakkan semuanya), damage = jumlah tembakan x multiplier combo. Jawaban salah atau waktu habis membuat boss menyerang (peluru berkurang 20%, minimal 5). Jika HP boss belum habis setelah soal terakhir, soal tambahan terus muncul sampai boss kalah atau peluru habis.

**Bintang** dari skor = 70% akurasi + 30% (peluru saat sampai boss dibanding peluru permainan sempurna): >= 85% = 3 bintang, >= 60% = 2 bintang, selain itu 1 bintang.

**Layar hasil** menampilkan akurasi, combo tertinggi, waktu, dan tombol **Ulasan** berisi soal yang salah, jawaban benar, dan cara singkat menghitungnya.

### Kontrol

- **HP:** geser jari kiri/kanan di mana saja. Tombol besar di layar untuk jawaban boss.
- **Desktop:** panah kiri/kanan atau `A`/`D`, atau drag mouse. Tombol `1` `2` `3` langsung memilih gerbang (atau jawaban boss). `H` untuk hint. `Esc`, `P`, atau `Spasi` untuk jeda.
- Jika pistol berada di antara gerbang, gerbang yang dipilih adalah yang berisi posisi pistol saat melewatinya (gerbang mengisi seluruh lebar jalur, jadi selalu ada pilihan; tidak memilih sama dengan salah).
- Permainan otomatis dijeda saat tab/aplikasi tidak aktif atau HP di-landscape.

## Jenis soal

| Jenis | Contoh | Tingkat |
|---|---|---|
| Hitung langsung | `7 × 3 = ?` | semua |
| Angka hilang | `□ + 9 = 17` | semua |
| Pilih operasi | `12 ? 4 = 3` (+ − × ÷, hanya satu yang benar) | sedang, sulit |
| Perbandingan | `6 × 4 ... 5 × 5` (> < =) | sedang, sulit |
| Soal cerita | "Ada 4 kotak, tiap kotak berisi 6 peluru. Berapa total?" | sedang (pendek), sulit (panjang, dua langkah) |
| Dua langkah | `3 × 4 + 5 = ?` | sulit |
| Pola angka | `2, 4, 8, ?` | sulit |

Soal pertama tiap level selalu hitung langsung, dan tidak ada soal yang sama dalam satu level. Jawaban salah dibuat dekat dengan jawaban benar (kesalahan umum), bulat, tidak negatif, unik.

## Pengaturan

- **Tingkat kesulitan:** Mudah (kelas 1-3, angka 1-20), Sedang (kelas 4-6, angka sampai 100), Sulit (SMP, angka sampai 500).
- **Fokus operasi:** Campuran / Tambah / Kurang / Kali / Bagi. Berlaku untuk semua jenis soal (soal cerita, pola, dan pilih operasi ikut menyesuaikan).
- **Kecepatan:** Santai (lambat, waktu berpikir ±35% lebih lama), Normal, Cepat (waktu berpikir ±15% lebih singkat).
- **Suara:** efek suara dan musik bisa dimatikan terpisah.
- **Kualitas grafis:** Rendah (tanpa glow, partikel sedikit), Sedang, Tinggi. Bila FPS rendah terus-menerus, kualitas turun otomatis satu tingkat.
- **Kurangi gerakan:** mematikan guncangan layar, slow-motion, hit-stop, kilatan layar, dan perubahan FOV.
- **Getar:** getaran halus di HP saat benar, salah, dan menang.
- **Mode buta warna:** hasil jawaban memakai biru dan kuning, selain ikon ✓ dan ✗ yang selalu tampil.

**Waktu berpikir** = jarak antar gerbang / kecepatan lari. Pada mode Normal minimal 5 detik (mudah), 4 detik (sedang), 3,5 detik (sulit) per gerbang, dikali faktor baca (soal cerita lebih lama). Bar di bawah soal menunjukkan sisa waktu sampai gerbang.

Progres (level terbuka, bintang) dan pengaturan tersimpan di `localStorage`.

## Level

30 level per tingkat, 3 dunia (ungu, biru, oranye), 5 sampai 10 gerbang soal per level yang naik bertahap, Boss Besar (5 soal, tampilan monster) setiap level ke-5. HP boss = kapasitas damage permainan sempurna x faktor 0,12 (level 1) sampai 0,36 (level 30). `verifyLevel()` memastikan permainan sempurna selalu menang.

Hasil tes bot (peluang menang pada mode Normal, level 1 / 10 / 20 / 30): akurasi 90% sekitar 92-100% / 93-95% / 88-95% / 62-83%; akurasi 80% sekitar 82-90% / 67-75% / 43-60% / 37-38%.

## Struktur file

```
index.html          struktur halaman dan semua layar (DOM overlay)
css/tokens.css      token desain dari Figma (warna, font, @font-face) dan satuan --d
css/components.css  komponen: Button, HUD, Modal, StarRating, StatRow, CoinReward, kartu, tab
css/layout.css      kontainer game, latar angkasa, desktop shell, responsif, putar-ke-portrait
assets/             SVG dari Figma (bintang emas / redup, ikon hint, ikon pause) dan font woff2 (self-host)
js/config.js        SEMUA konstanta yang bisa disetel (+ VICTORY_TITLE, COIN_ICON, TOKENS)
js/ui.js            komponen UI DOM: pop-up Menang/Kalah/Jeda, bintang, koin, pill combo, latar angkasa
js/questions.js     generator soal semua jenis, jawaban salah, validasi
js/questions.js     generator soal semua jenis, jawaban salah, validasi
js/game.js          pembuatan level, gerbang soal, combo, hint, boss berbentuk soal
js/characters.js    Blaster Bot, skin, pet, ekspresi, cincin energi, pratinjau toko
js/render.js        jalur pseudo-3D, latar paralaks, gerbang kaca, robot + cincin, boss, partikel, glow
js/input.js         sentuh, mouse, keyboard
js/audio.js         efek suara + musik (Web Audio)
js/storage.js       localStorage berversi skema: progres, bintang, koin, skin, pengaturan (migrasi otomatis)
js/main.js          bootstrap, game loop, state machine layar, HUD, ulasan
tests/              tes soal, level, dan simulasi permainan dengan bot
start.bat           menjalankan server lokal dan membuka browser (Windows)
```

## Menyetel permainan

Ubah `js/config.js`:

- `CFG.speed`, `CFG.speedModes`, `CFG.thinkSeconds`: kecepatan dan waktu berpikir
- `CFG.correctBonus`, `CFG.wrongPenalty`, `CFG.comboMult`, `CFG.hintsPerLevel`: bonus, penalti, combo, hint
- `CFG.startBullets`, `CFG.gatesMin` / `CFG.gatesMax`: peluru awal dan jumlah gerbang
- `CFG.hpFactorMin` / `CFG.hpFactorMax` / `CFG.bigBossHpBoost`: kekuatan boss
- `CFG.bossTimeSeconds`, `CFG.bossAttackFraction`: soal boss
- `WORLDS`: warna tiap dunia

## Tes

Tes memeriksa puluhan ribu soal acak (semua jenis, tingkat, dan fokus): jawaban benar, pilihan unik dan valid, tanpa bagi nol, pilih operasi punya tepat satu jawaban, pola konsisten, batas angka per tingkat, soal tidak berulang. Juga memeriksa semua level (3 tingkat x 5 fokus x 30 level x 3 kecepatan): HP boss bisa dikalahkan, waktu berpikir cukup, hint, combo, dan simulasi permainan penuh dengan bot sempurna dan bot yang kadang salah.

- **Browser:** jalankan server statis lalu buka `/tests/index.html` (hasil tampil di halaman dan console).
- **Node** (jika terpasang): `node tests/run.js`

## Desain UI (V4, dari Figma)

UI mengikuti frame Figma "Mafufu Pop Up" (file `MC1Vqj2CudJw5NQoM55k3t`, node `2:91`, acuan 390 x 976): header HUD, pop-up Menang, dan latar angkasa. Gayanya dipakai di semua layar (menu, level, pengaturan, toko, ulasan, jeda, hasil).

- **Satuan `--d`** = lebar kontainer game / 390, jadi `calc(var(--d) * 42)` = 42px pada desain. Semua ukuran UI memakai satuan ini sehingga ikut membesar/mengecil dengan kontainer.
- **Token** ada di `css/tokens.css` (warna, font) dan `TOKENS` di `js/config.js` (untuk kanvas). Mengubah warna tombol / kartu cukup di `tokens.css`.
- **Teks dan ikon yang bisa diganti** di `js/config.js`: `VICTORY_TITLE` (default "Mafufu", placeholder dari desain), `DEFEAT_TITLE`, `PAUSE_TITLE`, dan `COIN_ICON` (SVG di dalam koin).
- **Font:** Fredoka Bold (judul, tombol, koin) dan Nunito 700-900 (HUD, statistik), disimpan di `assets/fonts/` (tanpa CDN) dengan cadangan `ui-rounded, system-ui`.
- **Catatan fidelitas:** Figma menggambar border di dalam kotak, jadi padding tombol dan kartu dikurangi lebar border agar ukurannya sama dengan desain (kartu 340 px, tombol 286 px lebar pada layar 390). Halo bintang memakai `drop-shadow` yang mengikuti bentuk bintang (di desain berupa bayangan kotak).
- **Pop-up** dibangun oleh `js/ui.js` dari data nyata (bintang, akurasi, combo, waktu, koin, jumlah soal salah). Fokus pertama ada di tombol utama, Tab/Enter/Spasi bekerja, `Esc` = Menu (atau kembali dari layar lain, atau lanjut dari Jeda), dan HUD dinonaktifkan (`inert`) saat pop-up terbuka.
- **Varian:** Kalah ("Coba Lagi!", bintang redup, tombol utama "Ulangi") dan Jeda ("Lanjutkan", "Ulangi", "Pengaturan", "Menu").

## Responsif

Kanvas memakai resolusi logis 450 px lebar dan mengikuti `devicePixelRatio`; UI DOM memakai satuan `--d`.

- **HP portrait (lebar <= 600 px):** kontainer memenuhi layar (rasio sampai 390:976), `env(safe-area-inset-*)` dihormati, target sentuh >= 44 px. Pada layar pendek (mis. 360 x 640) jarak vertikal pop-up dirapatkan; bila tetap tidak muat, kartu bisa digulir di dalamnya.
- **Tablet / desktop:** kontainer portrait di tengah (rasio mendekati 390:844, lebar maksimum 480 px), latar angkasa penuh di kiri-kanan, panel petunjuk kontrol dan tips di samping (layar >= 900 px). Pop-up tetap di dalam kontainer.
- **HP landscape (layar sentuh):** muncul pesan "Putar HP ke mode portrait" dan permainan dijeda. Jendela desktop yang pendek tetap bisa bermain; kartu bisa digulir.
- Hover hanya aktif di perangkat dengan pointer (`@media (hover: hover)`), dan `prefers-reduced-motion` serta opsi "Kurangi gerakan" mematikan animasi.

## Deploy dan cara memperbarui

Game ini situs statis (tanpa build) dan di-deploy ke **GitHub Pages** lewat GitHub Actions (`.github/workflows/deploy.yml`). Tiap push ke branch `main` otomatis men-deploy ulang dalam 1-2 menit.

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

- Folder yang dipublikasikan hanya berisi file game: `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `assets/`. Folder `tests/` tidak ikut.
- Semua path aset **relatif** (`css/...`, `js/...`) karena situs berjalan di sub-path `/Tembak-Math/`. Jangan menulis path berawalan `/`.
- **Cache dan service worker:** `sw.js` memakai strategi "jaringan dulu", jadi pemain selalu mendapat versi terbaru saat online dan versi tersimpan saat offline. Untuk memaksa pembersihan cache lama, naikkan `CACHE_VERSION` di `sw.js` (mis. `v1` menjadi `v2`). Bila menambah file JS/CSS/aset baru, tambahkan juga ke daftar `CORE` di `sw.js` agar ikut tersedia offline.
- Mengatur Pages (sekali saja): Settings, Pages, Build and deployment, Source: **GitHub Actions**.
- Alternatif hosting lain (Netlify, Cloudflare Pages) tinggal menyambungkan repo ini; tanpa perintah build, folder publikasi adalah root.

## Lisensi

[MIT](LICENSE)
