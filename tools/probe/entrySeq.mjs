// Measures WHEN each authored door phase appears after LOCK IN. The door must
// close first (clamp/seam well before the assets are ready) and hold at the
// seam while combat loads, instead of parking in the static lock pose.
import { open, wait, waitStage } from './lib.mjs';
const hero = process.argv[2] || 'magnet';
const { browser, page } = await open();
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), hero);
await wait(400);
await page.evaluate(() => {
  window.__seq = [];
  const t0 = performance.now();
  const tr = document.getElementById('battleTransition');
  const seen = new Set();
  const tick = () => {
    const cls = tr.className;
    for (const p of ['phase-lock', 'phase-clamp', 'phase-seam', 'phase-open', 'phase-handoff']) {
      if (cls.includes(p) && !seen.has(p)) { seen.add(p); window.__seq.push([Math.round(performance.now() - t0), p]); }
    }
    const body = document.body.className;
    if (/battle-hud-open/.test(body) && !seen.has('HUD-OPEN')) { seen.add('HUD-OPEN'); window.__seq.push([Math.round(performance.now() - t0), 'HUD-OPEN']); }
    if (!seen.has('DONE')) setTimeout(tick, 60);
  };
  tick();
});
await page.evaluate(() => document.getElementById('lockIn')?.click());
await wait(45000);
console.log('HERO ' + hero);
console.log('SEQ ' + JSON.stringify(await page.evaluate(() => window.__seq)));
await browser.close();
