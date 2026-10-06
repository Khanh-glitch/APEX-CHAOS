// Fast transition lab: /gold/shell.html boots to Home in ~2 s, so the battle
// entry composite (rails, vignette, seam, core, HUD host reveal) can be driven
// by hand from the real CSS/markup instead of paying a 30 s asset entry per
// observation. Nothing here is a product path: it only toggles the canonical
// phase classes and photographs the result.
//
// Usage: node tools/probe/transitionLab.mjs <outDir> [viewport]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, wait } from './lib.mjs';

const outDir = process.argv[2] || '/tmp/lab';
const viewport = process.argv[3] || '1280x720';
const [w, h] = viewport.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const { browser, page } = await open({ viewport: { width: w, height: h } });

// The battle HUD host paints #020304 with the real HUD inside. Emulate a painted
// HUD (bright art on dark chrome) so the reveal can be judged, not guessed.
await page.evaluate(() => {
  const host = document.getElementById('battleHudHost');
  const frame = document.getElementById('battleHudFrame');
  if (frame) frame.remove();
  const art = document.createElement('div');
  art.style.cssText = 'position:absolute;inset:0;background:linear-gradient(140deg,#2b333b 0%,#5d6a58 38%,#8d5a2c 72%,#141a20 100%)';
  const bars = document.createElement('div');
  bars.style.cssText = 'position:absolute;left:0;right:0;top:0;height:52px;background:linear-gradient(180deg,rgba(255,255,255,.16),transparent)';
  host.append(art, bars);
});

const shot = async (name) => {
  const png = join(outDir, name + '.png');
  await page.screenshot({ path: png });
  return png;
};
const setPhase = async (cls) => {
  await page.evaluate((c) => {
    const bt = document.getElementById('battleTransition');
    const host = document.getElementById('battleHudHost');
    bt.className = c.bt;
    host.className = c.host;
    document.body.classList.toggle('battle-transition-active', !!c.body);
  }, cls);
};
const read = (label) => page.evaluate((l) => {
  const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
  const bt = document.getElementById('battleTransition');
  const host = document.getElementById('battleHudHost');
  const rail = bt && bt.querySelector('.bt-p1');
  return {
    label: l,
    railTf: cs(rail, 'transform'), railBg: cs(rail, 'background-image').slice(0, 40),
    railOpacity: cs(rail, 'opacity'), railZ: cs(rail, 'z-index'), railW: rail ? rail.getBoundingClientRect().width.toFixed(1) : null,
    railBox: rail ? JSON.stringify(rail.getBoundingClientRect().toJSON()) : null,
    hostClip: cs(host, 'clip-path'), hostTf: cs(host, 'transform'), hostZ: cs(host, 'z-index'),
    vigOpacity: bt ? cs(bt.querySelector('.bt-vignette'), 'opacity') : null,
  };
}, label);

const log = [];
log.push(await read('home'));
await shot('00-home');
await setPhase({ bt: 'is-bot is-active phase-lock', host: '', body: 1 });
await wait(400);
log.push(await read('phase-lock'));
await shot('01-lock');
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp', host: '', body: 1 });
await wait(500);
log.push(await read('phase-clamp'));
await shot('02-clamp');
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp', host: 'is-preloading', body: 1 });
await wait(200);
log.push(await read('preloading'));
await shot('03-preloading');
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp', host: 'is-transitioning', body: 1 });
await wait(200);
log.push(await read('transitioning'));
await shot('04-transitioning');
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp phase-seam', host: 'is-transitioning', body: 1 });
await wait(260);
log.push(await read('phase-seam'));
await shot('05-seam');
// The reveal beat: rails open + host sliver expands. Sampled mid-flight.
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp phase-seam phase-open', host: 'is-transitioning is-reveal', body: 1 });
await wait(120);
log.push(await read('open+120ms'));
await shot('06-open-120');
await wait(140);
log.push(await read('open+260ms'));
await shot('07-open-260');
await wait(300);
log.push(await read('open+560ms'));
await shot('08-open-560');
await setPhase({ bt: 'is-bot is-active phase-lock phase-clamp phase-seam phase-open phase-handoff', host: 'is-open', body: 1 });
await wait(250);
log.push(await read('handoff'));
await shot('09-handoff');
writeFileSync(join(outDir, 'composite.json'), JSON.stringify(log, null, 1));
console.log(log.map((l) => `${l.label}: railTf=${l.railTf} railW=${l.railW} z=${l.railZ} hostClip=${l.hostClip} hostTf=${l.hostTf} vig=${l.vigOpacity}`).join('\n'));
await browser.close();
