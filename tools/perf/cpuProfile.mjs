// CPU-profile a live match and rank self-time by function.
import fs from 'node:fs';
import { launch, newGamePage, bootToHome, sleep, closeAll } from './harness.mjs';
import { enterMatch } from './enterMatch.js';

const p1 = process.argv[2] || 'crystala';
const p2 = process.argv[3] || 'frost';
const mode = process.argv[4] || 'local1v1';
const outFile = process.argv[5] || `/tmp/cpuprofile-${p1}-${p2}.json`;
const scenario = process.argv[6] || 'skills';

const ctx = await launch({ distRoot: process.env.APEX_BENCH_DIST || 'dist-itch-html5' });
const { page, errors } = await newGamePage(ctx.browser, ctx.base);
await bootToHome(page);
await sleep(500);
await page.evaluate(() => new Promise((r) => setTimeout(r, 3500)));
const enter = await enterMatch(page, { p1, p2, mode });
await sleep(2500);
const client = await page.createCDPSession();
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 150 });
await client.send('Profiler.start');
await page.evaluate((how) => {
  window.__cast = setInterval(() => {
    try { window.APEX_GOLD.pressSkill(0, 0); } catch (_) {}
    try { window.APEX_GOLD.pressSkill(0, 1); } catch (_) {}
    if (how !== 'p1only') { try { window.APEX_GOLD.pressSkill(1, 0); } catch (_) {} try { window.APEX_GOLD.pressSkill(1, 1); } catch (_) {} }
  }, 600);
}, scenario);
await sleep(12000);
await page.evaluate(() => clearInterval(window.__cast));
const { profile } = await client.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const counts = new Map();
for (const id of profile.samples) counts.set(id, (counts.get(id) || 0) + 1);
const self = new Map();
const total = profile.samples.length;
for (const [id, c] of counts) {
  const n = byId.get(id); if (!n) continue;
  const cf = n.callFrame;
  const key = `${cf.functionName || '(anon)'} @ ${(cf.url || '').split('/').slice(-1)[0] || '(native)'}:${cf.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + c);
}
const rows = [...self.entries()].map(([k, c]) => ({ fn: k, ms: +(c * 150 / 1000).toFixed(1), pct: +((c / total) * 100).toFixed(1) })).sort((a, b) => b.ms - a.ms).slice(0, 40);
fs.writeFileSync(outFile, JSON.stringify({ p1, p2, mode, enter, totalSamples: total, rows }, null, 2));
console.log(`CPU PROFILE ${p1} vs ${p2} samples=${total}`);
for (const r of rows) console.log(`${String(r.ms).padStart(9)}ms ${String(r.pct).padStart(5)}%  ${r.fn}`);
console.log('ERRORS', errors.slice(0, 5));
await closeAll(ctx); process.exit(0);
