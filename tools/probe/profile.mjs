// Frame profile: where does the battle frame budget actually go?
import { open, wait, waitStage } from './lib.mjs';
const { browser, page } = await open();
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await page.evaluate(() => document.querySelector('.rosterCard[data-hero="newbot"]')?.click());
await wait(400);
await page.evaluate(() => document.getElementById('lockIn')?.click());
await waitStage(page, /battle-hud-open/, 90000);
await wait(2500);
console.log('PROFILE ' + JSON.stringify(await page.evaluate(async () => {
  const acc = {};
  const time = (key, fn) => { const t = performance.now(); const r = fn(); acc[key] = (acc[key] || 0) + (performance.now() - t); return r; };
  const F = window.Fighter;
  const heroDraws = new WeakMap();
  const origDraw = F.prototype.draw;
  F.prototype.draw = function (...a) { const t = performance.now(); const r = origDraw.apply(this, a); const key = 'heroDraw:' + (this.name || '?'); acc[key] = (acc[key] || 0) + (performance.now() - t); return r; };
  const origUpdate = window.update;
  const origDraw2 = window.draw;
  window.update = function (...a) { return time('update', () => origUpdate.apply(this, a)); };
  window.draw = function (...a) { return time('draw', () => origDraw2.apply(this, a)); };
  await new Promise((r) => setTimeout(r, 2500));
  window.update = origUpdate; window.draw = origDraw2; F.prototype.draw = origDraw;
  const frames = (await new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(n); }; requestAnimationFrame(tick); }));
  return { acc: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v)])), framesIn1500ms: frames, heroDraws: [...(window.fighters || [])].map((f) => f.name) };
})));
await browser.close();
