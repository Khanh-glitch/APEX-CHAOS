// Measures the battle coach frame over 60 consecutive animation frames at the
// requested viewports. Output: chip position range and candidate switches.
// Usage: node tools/issue105/measure-guide-frames.mjs [WxH[@dpr]...]
// Requires the tutorial to be enabled (APEX_TUTORIAL_PREF=on seeds it, labelled).
import { launchBrowser, openApp, startBotBattle, wait } from './harness.mjs';

const specs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['1440x900', '390x844', '844x390', '320x568', '900x900'];
const pref = process.env.APEX_TUTORIAL_PREF || 'on';
const browser = await launchBrowser();
const out = [];
try {
  for (const spec of specs) {
    const [size] = spec.split('@');
    const [w, h] = size.split('x').map(Number);
    const { page, errors, context } = await openApp(browser, {
      width: w, height: h, mobile: w < 600,
      storage: { 'apex.alpha.tutorial.v1': pref },
    });
    await startBotBattle(page);
    await wait(400);
    const samples = await page.evaluate(async (n) => {
      const rows = [];
      for (let i = 0; i < n; i++) {
        const chip = document.querySelector('.apex-coach-chip');
        if (chip) {
          const r = chip.getBoundingClientRect();
          rows.push({ x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, c: chip.dataset.candidate || '' });
        } else rows.push(null);
        await new Promise((res) => requestAnimationFrame(() => res()));
      }
      return rows;
    }, Number(process.env.SAMPLES || 60));
    const visible = samples.filter(Boolean);
    const xs = visible.map((s) => s.x);
    const ys = visible.map((s) => s.y);
    const cands = visible.map((s) => s.c);
    const switches = cands.reduce((n, c, i) => (i && c !== cands[i - 1] ? n + 1 : n), 0);
    const xRange = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const yRange = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    const xFlips = xs.reduce((n, x, i) => (i && Math.abs(x - xs[i - 1]) > 8 ? n + 1 : n), 0);
    const jumps = []; for (let i = 1; i < visible.length; i++) if (visible[i].x !== visible[i-1].x || visible[i].c !== visible[i-1].c) jumps.push([i, visible[i-1].x, visible[i].x, visible[i].c]);
    const row = { jumps: jumps.slice(0, 12), jumpCount: jumps.length, spec, visibleFrames: visible.length, xRange, yRange, candidateSwitches: switches, xFlipsOver8px: xFlips, candidates: [...new Set(cands)], errors: errors.length };
    out.push(row);
    console.log('FRAMES', JSON.stringify(row));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('SUMMARY', JSON.stringify(out));
