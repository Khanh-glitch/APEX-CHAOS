// Battle-entry timing probe: how long each entry step actually costs.
import { open, wait, waitStage, botMatch } from './lib.mjs';
const hero = process.argv[2] || 'robot';
const { browser, page } = await open();
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/, 20000);
await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), hero);
await wait(400);
await page.evaluate(() => {
  window.__steps = [];
  const t0 = performance.now();
  const mark = (name) => window.__steps.push(Math.round(performance.now() - t0) + ' | ' + name);
  const G = window.APEX_GOLD;
  const ps = G.prepareSurface.bind(G);
  G.prepareSurface = async function (...a) { mark('prepareSurface(' + a[0] + ') start'); const t = performance.now(); const r = await ps(...a); mark('prepareSurface(' + a[0] + ') end ' + Math.round(performance.now() - t) + 'ms'); return r; };
  const TR = window.APEX_SCENE_TRANSITION;
  const pe = TR.prepareElement.bind(TR);
  TR.prepareElement = async function (root, opts) { mark('prepareElement(' + ((root && (root.id || root.tagName)) || '?') + ')'); return pe(root, opts); };
});
await page.evaluate(() => document.getElementById('lockIn')?.click());
const t0 = Date.now();
for (let i = 0; i < 90; i += 1) {
  if (await page.evaluate(() => /battle-hud-open/.test(document.body.className))) break;
  await wait(400);
}
console.log('HERO ' + hero);
console.log('ENTRY_MS ' + (Date.now() - t0));
for (const s of await page.evaluate(() => window.__steps)) console.log('  ' + s);
console.log('ASSETS ' + JSON.stringify(await page.evaluate(() => {
  const st = window.apexProductAssets?.state?.();
  if (!st) return null;
  const d = st.records.filter((r) => r.fetchedAt && r.readyAt).map((r) => r.readyAt - r.fetchedAt).sort((a, b) => b - a);
  return { records: st.records.length, maxDecodeMs: Math.round(d[0] || 0), p50: Math.round(d[Math.floor(d.length / 2)] || 0) };
})));
void botMatch;
await browser.close();
