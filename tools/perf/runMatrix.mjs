// Full mandated scenario matrix against one built tree -> JSON report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newGamePage, bootToHome, sleep, closeAll, instrumentSource } from './harness.mjs';
import { enterMatch } from './enterMatch.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , distRoot = 'dist-itch-html5', outFile = '/tmp/matrix.json', ...rest] = process.argv;
const frames = Number(process.env.APEX_BENCH_FRAMES || 150);
const dpr = Number(process.env.APEX_BENCH_DPR || 1);
const viewport = process.env.APEX_BENCH_VIEWPORT === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const only = process.env.APEX_BENCH_ONLY ? process.env.APEX_BENCH_ONLY.split(',') : null;
const budgetSource = fs.readFileSync(path.join(HERE, 'frameBudget.js'), 'utf8');

const SCENARIOS = [
  { id: 'crystala-frost-idle', p1: 'crystala', p2: 'frost', mode: 'local1v1', fn: 'none' },
  { id: 'crystala-frost-skills', p1: 'crystala', p2: 'frost', mode: 'local1v1', fn: 'skills' },
  { id: 'crystala-frost-burst', p1: 'crystala', p2: 'frost', mode: 'local1v1', fn: 'burst' },
  { id: 'boxe-frost-skills', p1: 'boxe', p2: 'frost', mode: 'local1v1', fn: 'skills' },
  { id: 'boxe-frost-burst', p1: 'boxe', p2: 'frost', mode: 'local1v1', fn: 'burst' },
  { id: 'shuri-frost-skills', p1: 'shuri', p2: 'frost', mode: 'local1v1', fn: 'skills' },
  { id: 'shuri-frost-burst', p1: 'shuri', p2: 'frost', mode: 'local1v1', fn: 'burst' },
  { id: 'crystala-boxe-burst', p1: 'crystala', p2: 'boxe', mode: 'local1v1', fn: 'burst' },
  { id: 'shuri-crystala-burst', p1: 'shuri', p2: 'crystala', mode: 'local1v1', fn: 'burst' },
  { id: 'botwave-skills', p1: 'newbot', p2: 'hunter', mode: 'bot', fn: 'skills' },
];

let order = rest.includes('--reverse') ? SCENARIOS.slice().reverse() : SCENARIOS;
if (only) order = order.filter((s) => only.includes(s.id));
const report = { distRoot, frames, viewport, dpr, startedAt: new Date().toISOString(), quality: process.env.APEX_BENCH_QUALITY || null, scenarios: [] };

const ctx = await launch({ distRoot });
for (const sc of order) {
  const { page, errors, http } = await newGamePage(ctx.browser, ctx.base, { viewport, dpr });
  try {
    await bootToHome(page);
    await sleep(300);
    if (process.env.APEX_BENCH_QUALITY) {
      await page.evaluate((q) => window.APEX_GRAPHICS_QUALITY?.set(q, 'bench'), process.env.APEX_BENCH_QUALITY);
    }
    await page.evaluate(() => new Promise((r) => setTimeout(r, 3000)));
    await page.addScriptTag({ content: instrumentSource });
    await page.addScriptTag({ content: budgetSource });
    const enter = await enterMatch(page, { p1: sc.p1, p2: sc.p2, mode: sc.mode });
    await sleep(900);
    const res = await page.evaluate(async ({ n, id, fnName, quality }) => {
      if (quality) window.APEX_GRAPHICS_QUALITY?.set(quality, 'bench');
      const api = window.APEX_GOLD;
      const map = {
        none: null,
        skills: (i) => {
          if (i % 22 === 0) try { api.pressSkill(0, 0); } catch (_) {}
          if (i % 34 === 11) try { api.pressSkill(0, 1); } catch (_) {}
          if (i % 28 === 5) try { api.pressSkill(1, 0); } catch (_) {}
          if (i % 38 === 19) try { api.pressSkill(1, 1); } catch (_) {}
        },
        burst: (i) => { if (i % 10 === 0) { try { api.pressSkill(0, 0); api.pressSkill(0, 1); api.pressSkill(1, 0); api.pressSkill(1, 1); } catch (_) {} } },
      };
      return await window.__APEX_FRAME_BUDGET({ frames: n, label: id, scenario: map[fnName] });
    }, { n: frames, id: sc.id, fnName: sc.fn, quality: process.env.APEX_BENCH_QUALITY || null });
    report.scenarios.push({ ...sc, enter, result: res, errors: errors.slice(0, 4), http: http.slice(0, 4) });
    console.log(`${sc.id.padEnd(26)} frame p50=${String(res.frame.p50).padStart(7)} p95=${String(res.frame.p95).padStart(8)} draw p50=${String(res.draw.p50).padStart(6)} update p50=${String(res.update.p50).padStart(6)} drawImage=${res.perFrameOps.drawImage} fill=${res.perFrameOps.fill}`);
  } catch (e) {
    report.scenarios.push({ ...sc, error: String((e && e.message) || e) });
    console.log(`${sc.id.padEnd(26)} ERROR ${(e && e.message) || e}`);
  }
  await page.close().catch(() => {});
}
await closeAll(ctx);
fs.writeFileSync(outFile, JSON.stringify(report, null, 1));
console.log('WROTE', outFile);
process.exit(0);
