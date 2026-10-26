// Jalankan: node tests/run.js
import { runTests } from './tests.js';

const t0 = Date.now();
const res = runTests();
console.log(`Lulus: ${res.passed}   Gagal: ${res.failed}   (${Date.now() - t0} ms)`);
res.failures.forEach((f) => console.log(' - ' + f));
console.log('\nPeluang menang bot (akurasi -> level 1 / 10 / 20 / 30):');
res.stats.forEach((s) => console.log(`  ${s.diff} ${Math.round(s.acc * 100)}%: ${[s.L1, s.L10, s.L20, s.L30].map((v) => Math.round(v * 100) + '%').join(' / ')}`));
process.exit(res.failed ? 1 : 0);
