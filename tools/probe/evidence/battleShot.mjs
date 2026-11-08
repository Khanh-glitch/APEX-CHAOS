// Deterministic battle evidence capture.
// The sandbox compositor is starved, so the mechanical-door transition can
// stall. We drive a REAL transition, wait for its own DONE state, and only
// then fall back to force-finishing it — record which path was used so the
// evidence never overstates what was exercised.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');
const seed = fs.readFileSync('/home/user/APEX-CHAOS/tools/perf/qaProfile.js', 'utf8');

const OUT = process.argv[2] || '/tmp/evidence';
fs.mkdirSync(OUT, { recursive: true });
const EV = JSON.parse(process.env.EV || '{}');
const srv = await startServer({ root: '/home/user/APEX-CHAOS/dist-itch-html5' });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true, protocolTimeout: 600000,
  args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const settle = async (page, ms = 900) => {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
  await new Promise(r => setTimeout(r, ms));
};
async function clearTransition(page) {
  const via = await page.evaluate(() => new Promise((resolve) => {
    const coord = window.APEX_SCENE_TRANSITION;
    if (!coord || typeof coord.run !== 'function') return resolve('no-coordinator');
    const t = setTimeout(() => resolve('timeout'), 9000);
    coord.run({ name: 'evidence-reveal', prepare: () => Promise.resolve(), commit: () => {} })
      .then(() => { clearTimeout(t); resolve('door-done'); })
      .catch(() => { clearTimeout(t); resolve('door-error'); });
  }));
  if (via === 'door-done') return via;
  await page.evaluate(() => {
    document.body.classList.remove('apex-scene-transition-active');
    document.body.dataset.apexSceneTransition = 'DONE';
    const cv = document.getElementById('apex-scene-transition');
    if (cv) { cv.style.display = 'none'; cv.setAttribute('aria-hidden', 'true'); }
  });
  return via + '+forced';
}
const page = await browser.newPage();
const errs = [], http = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
page.on('response', r => { if (r.status() >= 400) http.push(r.status() + ' ' + r.url().replace(srv.base, '')); });
await page.setViewport({ width: EV.w || 1440, height: EV.h || 900, deviceScaleFactor: EV.dpr || 1 });
await page.evaluateOnNewDocument(seed);
await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
const path = await clearTransition(page);
console.log('TRANSITION_PATH', path);
await settle(page, 2000);
await page.screenshot({ path: `${OUT}/01-home.png` });

await page.evaluate(() => document.getElementById('apex-graphics-open')?.click());
await settle(page, 1200);
await page.screenshot({ path: `${OUT}/02-settings-home-high.png` });
await page.evaluate(() => document.querySelector('[data-aqs-mode="performance"]')?.click());
await settle(page, 900);
await page.screenshot({ path: `${OUT}/03-settings-home-performance.png` });
await page.evaluate(() => { window.APEX_GRAPHICS_SETTINGS_UI.close('evidence'); window.APEX_GRAPHICS_QUALITY.set('high', 'evidence'); });
await settle(page, 600);

const p1 = EV.p1 || 'crystala', p2 = EV.p2 || 'frost';
const entered = await page.evaluate(async ({ p1, p2 }) => {
  const h = document.getElementById('battleHudHost');
  h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
  const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
  await new Promise(r => window.APEX_GOLD.mountBattleHud(html, r));
  await window.APEX_GOLD.onHandoff({ mode: 'LOCAL', p1, p2, p1Hero: p1, p2Hero: p2, shell: 'battle' });
  await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1, p2 });
  return (window.fighters || []).map(f => f.name);
}, { p1, p2 });
console.log('FIGHTERS', entered);
await settle(page, 2500);
async function fireSkills(rounds) {
  await page.evaluate(async (rounds) => {
    const api = window.APEX_GOLD;
    for (let r = 0; r < rounds; r += 1) {
      for (const [side, slot] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { try { api.pressSkill(side, slot); } catch (e) {} }
      await new Promise(res => setTimeout(res, 260));
    }
  }, rounds);
}
await fireSkills(4); await settle(page, 500);
await page.screenshot({ path: `${OUT}/04-battle-high-${p1}-${p2}.png` });
await page.evaluate(() => window.APEX_GRAPHICS_QUALITY.set('performance', 'evidence'));
await settle(page, 800);
await fireSkills(4); await settle(page, 500);
await page.screenshot({ path: `${OUT}/05-battle-performance-${p1}-${p2}.png` });
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.open(document.body));
await settle(page, 1200);
await page.screenshot({ path: `${OUT}/06-settings-midbattle.png` });
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.close('evidence'));
await page.evaluate(() => {
  window.APEX_GRAPHICS_QUALITY.set('high', 'evidence');
  const a = window.APEX_GRAPHICS_ADVISOR;
  // Isolate: the live rAF sampler would otherwise judge this genuinely slow
  // sandbox on its own, hide()/re-show the panel at will and race the shot.
  a._test.pause(); a._test.hide(); a._test.reset();
  const slow = new Array(30).fill(45);
  a._test.evaluate(slow); a._test.evaluate(slow); a._test.evaluate(slow);
});
// The panel lives 5 s; this sandbox starves timers and the screenshot path is
// slow, so re-show it right before the shot instead of racing PANEL_MS. Re-show
// is also the path that used to be undone by a stale exit timer, so this
// exercises the fixed code rather than dodging it.
await settle(page, 500);
await page.evaluate(() => {
  const a = window.APEX_GRAPHICS_ADVISOR;
  if (!a.isOpen()) a.showNow({ p95: 52, slowRatio: 0.42, hz: 60, n: 240 });
  a._test.hold();   // a screenshot must not race the 5 s life rail
});
const advisorState = await page.evaluate(() => {
  const p = document.getElementById('apex-quality-advisor');
  const card = p?.querySelector('.aqa-card');
  const r = card?.getBoundingClientRect();
  const cs = p ? getComputedStyle(p) : null;
  const hit = r ? document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)) : null;
  let n = hit, inside = false;
  while (n) { if (n === p) { inside = true; break; } n = n.parentElement; }
  return { open: !!p && !p.hidden, painted: !!p && !p.hidden && !!cs && +cs.opacity > 0.99 && inside,
           title: p?.querySelector('.aqa-title')?.textContent,
           rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null };
});
if (!advisorState.painted) console.log('WARN: advisor not painted before capture', JSON.stringify(advisorState));
await page.screenshot({ path: `${OUT}/07-advisor-panel.png` });
console.log('ADVISOR', JSON.stringify(advisorState));
await page.evaluate(() => document.querySelector('#apex-quality-advisor [data-aqa-action="switch"]')?.click());
await settle(page, 900);
await page.screenshot({ path: `${OUT}/08-advisor-accepted-toast.png` });
const afterAccept = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY.mode,
  hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx'),
  toast: document.getElementById('apex-quality-toast')?.textContent,
}));
console.log('AFTER_ACCEPT', JSON.stringify(afterAccept));
console.log('ERRORS', errs.slice(0, 6));
console.log('HTTP404', http.filter(u => !u.includes('favicon')).slice(0, 6));
fs.writeFileSync(`${OUT}/capture.json`, JSON.stringify({ path, entered, advisorState, afterAccept, errs, http, opts: EV }, null, 1));
await browser.close(); await srv.server.close(); process.exit(0);
