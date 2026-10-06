// Measures the frame budget of the battle compositor with and without the
// Critical/Heavy FX families, using the HUD's own production entry points.
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
await wait(3000);
// The HUD is mounted in the shell document: find the document that owns #hud.
const target = await page.evaluate(() => {
  const direct = window.APEX_GOLD_HUD && document.getElementById('hud');
  return { sameDoc: !!direct, hasApi: !!(window.APEX_GOLD_HUD && window.APEX_GOLD_HUD.hit) };
});
console.log('TARGET ' + JSON.stringify(target));
const sampler = `(() => {
  const d = [];
  let last = performance.now();
  const tick = (now) => { d.push(now - last); last = now; if (d.length < 400) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__frames = d;
  return true;
})()`;
const stats = async (label) => {
  const frames = await page.evaluate(() => { const f = (window.__frames || []).slice(); window.__frames = []; return f; });
  const sorted = frames.slice().sort((a, b) => a - b);
  const p = (q) => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(1) : 0;
  const over = (ms) => frames.filter((f) => f > ms).length;
  console.log(`${label} n=${frames.length} p50=${p(.5)} p90=${p(.9)} p99=${p(.99)} max=${p(1)} >33ms=${over(33)} >50ms=${over(50)}`);
};
await page.evaluate(sampler);
await wait(2000);
await stats('IDLE');
// burst of Critical + Heavy through the production seam
await page.evaluate(() => {
  window.__fx = { heavy: 0, crit: 0 };
  const H = window.APEX_GOLD_HUD;
  window.__burst = setInterval(() => {
    try {
      H.hit(0, 1, 120, 'crit', 700, '#ff941f'); window.__fx.crit++;
      H.hit(1, 0, 240, 'heavy', 640, '#7ee8ff'); window.__fx.heavy++;
      H.hitStorm(0, 1, 260, 600, '#ff941f'); window.__fx.heavy++;
    } catch (e) { window.__err = String(e && e.message || e); }
  }, 260);
});
await page.evaluate(sampler);
await wait(2000);
await stats('FX    ');
await page.evaluate(() => clearInterval(window.__burst));
console.log('COUNTS ' + JSON.stringify(await page.evaluate(() => ({ ...window.__fx, err: window.__err || null }))));
await browser.close();
