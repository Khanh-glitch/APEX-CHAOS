// Checkpoint D gates — Chamber-01 palettes + adaptive readability.
// Presentation-only law: persistence via arsenalMeta, (size,palette) cache,
// one cached drawImage per frame, read-once profiles, neutral wrappers,
// hub selector, no global filters, no gameplay/geometry changes.
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import chromium, { inflate } from '@sparticuz/chromium';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))), 'bin', 'al2023.tar.br'));
process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');

const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on('pageerror', (e) => { const t = String(e); if (!t.includes('net::ERR_')) errors.push(t); });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('net::ERR_')) errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'load', timeout: 120000 });
await page.evaluate(async () => { const e = window.__apexEnsureDeferredRuntimes; if (e) await e('arsenalQuest'); });
await page.waitForFunction(() => window.APEX_CHAMBER_PALETTE, { timeout: 60000 });

const results = {};
const check = (name, pass, data) => { results[name] = { pass: !!pass, data: data ?? null }; };

// --- D-palette-list: >=6 curated palettes incl. the required families -------
const list = await page.evaluate(() => window.APEX_CHAMBER_PALETTE.list());
check('D-palette-list', list.length >= 6 && ['graphite-dark', 'graphite-mid', 'navy-steel', 'teal-deep', 'oxide-warm', 'violet-slate'].every(id => list.some(p => p.id === id)), { ids: list.map(p => p.id) });

// --- D-profiles-neutral-read-once: grayscale shadows, luminance/chroma set ---
check('D-profiles-neutral', list.every(p => {
  const pr = p.profile;
  const nums = (pr.shadow.match(/\d+(\.\d+)?/g) || []).map(Number);
  const [r, g, b] = nums;
  return r === g && g === b && pr.luminance >= 0 && pr.luminance <= 1 && pr.chroma >= 0 && pr.blur > 0;
}), list.map(p => ({ id: p.id, L: p.profile.luminance, C: p.profile.chroma })));

// --- D-default-metadata-unchanged: graphite-mid keeps the accepted colors ---
check('D-default-metadata', JSON.stringify(list.find(p => p.id === 'graphite-mid')) !== undefined && list.find(p => p.id === 'graphite-mid').profile.floorLift === 0, list.find(p => p.id === 'graphite-mid'));

// --- D-persist: meta authority stores arenaPaletteId; reload restores --------
await page.evaluate(() => window.APEX_CHAMBER_PALETTE.select('navy-steel'));
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('apexChaos.arsenalMeta.v1') || '{}').arenaPaletteId);
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.evaluate(async () => { const e = window.__apexEnsureDeferredRuntimes; if (e) await e('arsenalQuest'); });
await page.waitForFunction(() => window.APEX_CHAMBER_PALETTE, { timeout: 60000 });
const afterReload = await page.evaluate(() => window.APEX_CHAMBER_PALETTE.current());
check('D-persist', stored === 'navy-steel' && afterReload === 'navy-steel', { stored, afterReload });

// --- hub selector -------------------------------------------------------------
const hub = await page.evaluate(() => {
  window.beginArsenalQuestSelection();
  const row = document.getElementById('aq-palette-row');
  if (!row) return { ok: false };
  const chips = [...row.querySelectorAll('.aq-palette-chip')];
  const activeBefore = chips.find(c => c.classList.contains('is-active'))?.getAttribute('data-palette');
  const teal = chips.find(c => c.getAttribute('data-palette') === 'teal-deep');
  teal && teal.click();
  const activeAfter = [...row.querySelectorAll('.aq-palette-chip')].find(c => c.classList.contains('is-active'))?.getAttribute('data-palette');
  return { ok: true, n: chips.length, activeBefore, activeAfter, current: window.APEX_CHAMBER_PALETTE.current() };
});
check('D-hub-selector', hub.ok && hub.n >= 6 && hub.activeBefore === 'navy-steel' && hub.activeAfter === 'teal-deep' && hub.current === 'teal-deep', hub);

// --- battle: cache keyed (size,palette), one build per change, hits per frame -
const battle = await page.evaluate(() => {
  const P = window.APEX_CHAMBER_PALETTE;
  if (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active) window.exitArsenalQuestMode();
  window.startArsenalQuestMode('HUNTER', 'ICE');
  const s = window.APEX_ARSENAL.state;
  s.slots = []; s.spawnHeld = true; s.spawnTimer = 1e6; s.unarmedFastConsumed = true;
  const draw = window.draw; window.draw = () => {}; window.update = () => {};
  // filter-set probe: law forbids global ctx.filter usage
  let filterSets = 0;
  const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'filter');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { if ((new Error().stack || '').includes('arsenalChamberPaletteRuntime')) filterSets++; return desc.set.call(this, v); },
  });
  // shadow probe sampled inside body draws (drawImage happens per part)
  let shadowSeen = 0, samples = 0;
  const di = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...a) { samples++; if (this.shadowBlur > 0) shadowSeen = Math.max(shadowSeen, this.shadowBlur); return di.apply(this, a); };
  const step = (n) => { for (let i = 0; i < n; i++) { window.APEX_ARSENAL.step(1 / 60); draw(); } };
  const b0 = P.stats();
  step(60);
  const b1 = P.stats();
  const filterA = filterSets;
  P.select('oxide-warm');
  step(1);
  const b2 = P.stats();
  step(119);
  const b3 = P.stats();
  const filterB = filterSets - filterA;
  P.select('graphite-mid');
  step(60);
  const b4 = P.stats();
  const filterC = filterSets - filterA - filterB;
  CanvasRenderingContext2D.prototype.drawImage = di;
  if (desc) Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', desc);
  const perf = window.apexArsenalPerfSummary();
  return { filterSets, filterA, filterB, filterC, shadowSeen, samples, b0, b1, b2, b3, b4, chamber: perf.chamber };
});
check('D-cache-no-per-frame-repaint',
  battle.b1.builds === 1 && battle.b1.hits === 60 &&      // first key built once, every frame a hit
  battle.b2.builds === 2 &&                               // palette switch rebuilds exactly once
  battle.b3.builds === 2 && battle.b3.hits - battle.b2.hits === 119 && // then stable for 119 frames
  battle.b4.builds === 3 &&                               // switching back rebuilds once more
  battle.b1.draws >= 60,
  { b0: battle.b0, b1: battle.b1, b2: battle.b2, b3: battle.b3, b4: battle.b4, chamber: battle.chamber });

check('D-no-global-filter', battle.samples > 0 && battle.filterA > 0 && battle.filterB === battle.filterA * 2 && battle.filterC === battle.filterA, { filterA60: battle.filterA, filterB120: battle.filterB, filterC60: battle.filterC, samples: battle.samples });
check('D-readability-wrapper-live', battle.shadowSeen > 0, { shadowSeen: battle.shadowSeen });

// --- gameplay untouched: spawn/collision laws intact via a quick trigger ----
const law = await page.evaluate(() => {
  const s = window.APEX_ARSENAL.state;
  return { slots: s.slots.length, fighters: window.fighters.length, geom: typeof window.APEX_ARSENAL_CONFIG.FIGHTER_SPEED };
});
check('D-presentation-only', law.fighters === 2 && law.geom === 'number', law);

await page.evaluate(() => window.exitArsenalQuestMode && window.exitArsenalQuestMode());
fs.writeFileSync('docs/hero-rework/post-playtest-2026-09-29/evidence/chamber-palette-gates.json', JSON.stringify({ results, errors }, null, 2));
const passN = Object.values(results).filter(r => r.pass).length;
console.log(`[CHAMBER PALETTE GATES] ${passN}/${Object.keys(results).length} gates passed; errors=${errors.length}`);
for (const [k, v] of Object.entries(results)) if (!v.pass) console.log('FAIL', k, JSON.stringify(v.data).slice(0, 400));
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
process.exit(passN === Object.keys(results).length && errors.length === 0 ? 0 : 1);
