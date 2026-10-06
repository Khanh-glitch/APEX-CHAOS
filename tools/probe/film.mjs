// Headless film probe: records the REAL pick -> battle entry as a frame strip
// (CDP screencast, so frames carry their own capture timestamps instead of
// paying a screenshot round-trip per frame).
//
// Usage: node tools/probe/film.mjs <outDir> [heroId] [viewport]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, wait, waitStage } from './lib.mjs';

const outDir = process.argv[2] || '/tmp/film';
const heroId = process.argv[3] || 'ROBOT';
const viewport = process.argv[4] || '1280x720';
const [w, h] = viewport.split('x').map(Number);
mkdirSync(outDir, { recursive: true });

const { browser, page } = await open({ viewport: { width: w, height: h } });
const client = await page.target().createCDPSession();
const frames = [];
client.on('Page.screencastFrame', async (ev) => {
  frames.push({ n: frames.length, t: Date.now(), data: ev.data });
  try { await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch (_) {}
});
await client.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });

// Ride the real flow, but only start the film at the LOCK IN intent.
await page.click('#freeBattle');
await waitStage(page, /screen-mode/);
await page.click('.modeCard[data-mode="bot"]');
await waitStage(page, /screen-fighter/);
await page.evaluate((id) => document.querySelector(`.rosterCard[data-hero="${id}"]`)?.click(), heroId);
await wait(500);
const t0 = Date.now();
await page.evaluate(() => document.getElementById('lockIn')?.click());
// The page main thread is saturated while the 39 battle runtimes decode, so no
// per-frame evaluate polling here: one long wait, and the screencast keeps
// filming. Class transitions are stamped by an in-page observer instead.
await page.evaluate(() => {
  window.__apexFilm = [];
  const t0 = performance.now();
  const watch = ['battleTransition', 'battleHudHost'];
  const note = () => {
    const bt = document.getElementById('battleTransition');
    const host = document.getElementById('battleHudHost');
    window.__apexFilm.push({
      t: +(performance.now() - t0).toFixed(1),
      bt: bt ? bt.className : null,
      host: host ? host.className : null,
      clip: host ? getComputedStyle(host).clipPath : null,
      tf: host ? getComputedStyle(host).transform : null,
      vig: bt ? getComputedStyle(bt.querySelector('.bt-vignette')).opacity : null,
      body: document.body.className,
    });
  };
  note();
  for (const id of watch) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(note).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  new MutationObserver(note).observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
await page.waitForFunction(() => document.body.classList.contains('battle-hud-open'), { timeout: 90000, polling: 250 });
await wait(700);
const phases = await page.evaluate(() => window.__apexFilm || []);
await client.send('Page.stopScreencast').catch(() => {});
const t1 = Date.now();
for (const f of frames) writeFileSync(join(outDir, `f${String(f.n).padStart(3, '0')}.jpg`), Buffer.from(f.data, 'base64'));
writeFileSync(join(outDir, 'phases.json'), JSON.stringify({ heroId, viewport, t0, t1, frames: frames.length, phases }, null, 1));
console.log(`FRAMES ${frames.length} in ${t1 - t0}ms -> ${outDir}`);
await browser.close();
