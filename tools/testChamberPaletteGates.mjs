// Checkpoint D+E gates — Chamber-01 palettes + adaptive readability (AUDIT-E).
// Presentation-only law: persistence via arsenalMeta, (size,palette) cache,
// one cached drawImage per frame, read-once profiles, actor-scoped single
// source-render readability, neutral wrappers, hub selector, no palette-owned
// filters, no gameplay/geometry changes.
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import * as chromiumModule from '@sparticuz/chromium';
const chromium = chromiumModule.default || chromiumModule;
const inflate = chromiumModule.inflate;
import { createRequire } from 'node:module';
// The cache-bust gate follows the CURRENT runtime revision (single source of truth).
import { APEX_ARSENAL_RUNTIME_REVISION } from '../src/game/runtimeManifest.js';
const require = createRequire(import.meta.url);
// Environment compatibility: @sparticuz/chromium >= 121 inflates its own
// payload inside executablePath() and no longer exports inflate(). The shared
// library bundle still has to be on LD_LIBRARY_PATH either way.
if (typeof inflate === 'function') await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))), 'bin', 'al2023.tar.br'));
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on('pageerror', (e) => { const t = String(e); if (!t.includes('net::ERR_')) errors.push(t); });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('net::ERR_')) errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
await page.evaluate(async () => { const e = window.__apexEnsureDeferredRuntimes; if (e) await e('arsenalQuest'); });
await page.waitForFunction(() => window.APEX_CHAMBER_PALETTE, { timeout: 60000 });

const results = {};
const check = (name, pass, data) => { results[name] = { pass: !!pass, data: data ?? null }; };

// --- E-urls: production resource URLs carry the NEW runtime revision --------
const urls = await page.evaluate((rev) => {
  const want = ['game/arsenal/arsenalChamberPaletteRuntime.js', 'game/arsenal/arsenalMetaRuntime.js', 'game/modes/arsenalQuestRuntime.js', 'game/arsenal/arsenalPresentationRuntime.js', 'game/hero-rework/hunterGoldV10.js'];
  const res = performance.getEntriesByType('resource').map(r => r.name);
  return want.map(w => ({ w, loaded: res.some(u => u.includes(w) && u.includes('v=' + rev)) }));
}, APEX_ARSENAL_RUNTIME_REVISION);
check('E-cachebust-urls-new-revision', urls.every(u => u.loaded), urls);

// --- D-palette-list -----------------------------------------------------------
const list = await page.evaluate(() => window.APEX_CHAMBER_PALETTE.list());
check('D-palette-list', list.length >= 6 && ['graphite-dark', 'graphite-mid', 'navy-steel', 'teal-deep', 'oxide-warm', 'violet-slate'].every(id => list.some(p => p.id === id)), { ids: list.map(p => p.id) });
check('D-profiles-neutral', list.every(p => {
  const pr = p.profile;
  const [r, g, b] = (pr.shadow.match(/\d+(\.\d+)?/g) || []).map(Number);
  return r === g && g === b && pr.luminance >= 0 && pr.luminance <= 1 && pr.chroma >= 0 && pr.blur > 0;
}), list.map(p => ({ id: p.id, L: p.profile.luminance, C: p.profile.chroma })));

// --- E-no-palette-filter: static + attributed runtime proof ------------------
const filt = await page.evaluate(async (rev) => {
  const rawSrc = await (await fetch('/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + rev)).text();
  const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const staticClean = !/\.filter\s*=/.test(src) && !/ctx\.filter/.test(src);
  let attributed = 0, total = 0;
  const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'filter');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) {
      total++;
      const top = ((new Error().stack || '').split('\n')[2] || '');
      if (top.includes('arsenalChamberPaletteRuntime')) attributed++;
      return desc.set.call(this, v);
    },
  });
  if (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active) window.exitArsenalQuestMode();
  window.startArsenalQuestMode('HUNTER', 'ICE');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }
  const s = window.APEX_ARSENAL.state; s.slots = []; s.spawnHeld = true; s.spawnTimer = 1e6; s.unarmedFastConsumed = true;
  const draw = window.draw; window.draw = () => {}; window.update = () => {};
  for (let i = 0; i < 60; i++) { window.APEX_ARSENAL.step(1 / 60); draw(); }
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', desc);
  return { staticClean, attributed, total };
}, APEX_ARSENAL_RUNTIME_REVISION);
check('E-no-palette-filter', filt.staticClean && filt.attributed === 0 && filt.total > 0, filt);

// --- E-sanitize: state truth == rendered truth (Finding 4) -------------------
await page.evaluate(() => {
  localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify({ version: 1, credits: 500, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 0, unlockedAt: { ROBOT: 0 }, arenaPaletteId: 'neon-9999' }));
});
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
await page.evaluate(async () => { const e = window.__apexEnsureDeferredRuntimes; if (e) await e('arsenalQuest'); });
await page.waitForFunction(() => window.APEX_CHAMBER_PALETTE && window.APEX_ARSENAL_META, { timeout: 60000 });
const stale = await page.evaluate(() => ({ state: window.APEX_ARSENAL_META.getState().arenaPaletteId, rendered: window.APEX_CHAMBER_PALETTE.current(), keys: Object.keys(localStorage).filter(k => /palette/i.test(k)) }));
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('apexChaos.arsenalMeta.v1'));
  st.arenaPaletteId = 'teal-deep';
  localStorage.setItem('apexChaos.arsenalMeta.v1', JSON.stringify(st));
});
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
await page.evaluate(async () => { const e = window.__apexEnsureDeferredRuntimes; if (e) await e('arsenalQuest'); });
await page.waitForFunction(() => window.APEX_CHAMBER_PALETTE && window.APEX_ARSENAL_META, { timeout: 60000 });
await page.waitForFunction(() => window.APEX_HUNTER_GOLD && window.APEX_HUNTER_PRESENTATION && window.APEX_ARSENAL_AV, { timeout: 60000 });
await page.waitForFunction(() => window.APEX_HUNTER_PRESENTATION.ready === true, { timeout: 90000 });
const valid = await page.evaluate(() => ({ state: window.APEX_ARSENAL_META.getState().arenaPaletteId, rendered: window.APEX_CHAMBER_PALETTE.current() }));
const nokey = await page.evaluate(() => window.APEX_ARSENAL_META.KEY);
check('E-sanitize-stale-to-default', stale.state === null && stale.rendered === 'graphite-mid' && stale.keys.length === 0, stale);
check('E-sanitize-valid-survives', valid.state === 'teal-deep' && valid.rendered === 'teal-deep' && nokey === 'apexChaos.arsenalMeta.v1', { valid, nokey });

// --- hub selector -------------------------------------------------------------
const hub = await page.evaluate(() => {
  window.beginArsenalQuestSelection();
  const row = document.getElementById('aq-palette-row');
  if (!row) return { ok: false };
  const chips = [...row.querySelectorAll('.aq-palette-chip')];
  const activeBefore = chips.find(c => c.classList.contains('is-active'))?.getAttribute('data-palette');
  const teal = chips.find(c => c.getAttribute('data-palette') === 'oxide-warm');
  teal && teal.click();
  const activeAfter = [...row.querySelectorAll('.aq-palette-chip')].find(c => c.classList.contains('is-active'))?.getAttribute('data-palette');
  return { ok: true, n: chips.length, activeBefore, activeAfter, current: window.APEX_CHAMBER_PALETTE.current() };
});
check('D-hub-selector', hub.ok && hub.n >= 6 && hub.activeBefore === 'teal-deep' && hub.activeAfter === 'oxide-warm' && hub.current === 'oxide-warm', hub);

// --- battle instrumentation: single actor render, no layer replay, cache -----
const battle = await page.evaluate(() => {
  const P = window.APEX_CHAMBER_PALETTE;
  if (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active) window.exitArsenalQuestMode();
  window.startArsenalQuestMode('HUNTER', 'ICE');
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }
  const s = window.APEX_ARSENAL.state; s.slots = []; s.spawnHeld = true; s.spawnTimer = 1e6; s.unarmedFastConsumed = true;
  window.APEX_ARSENAL.weaponApi.equip(fighters[0], 'PISTOL');
  window.__realDraw = window.draw; const draw = window.draw; window.draw = () => {}; window.update = () => {};
  // layer-replay spies: status/weak/echo/fx sources must never run inside the
  // actor readability pass.
  const G = window.APEX_HUNTER_GOLD;
  const spy = { weakInActor: 0, echoInActor: 0, weak: 0, echo: 0 };
  const dw = G.Stage.prototype.drawWeak, de = G.Stage.prototype.drawEchoes;
  G.Stage.prototype.drawWeak = function (...a) { spy.weak++; if (P.inActor()) spy.weakInActor++; return dw.apply(this, a); };
  G.Stage.prototype.drawEchoes = function (...a) { spy.echo++; if (P.inActor()) spy.echoInActor++; return de.apply(this, a); };
  const dsr = window.drawStatusRing;
  let ringInActor = 0, rings = 0;
  if (typeof dsr === 'function') { window.drawStatusRing = function (...a) { rings++; if (P.inActor()) ringInActor++; return dsr.apply(this, a); }; }
  // full Fighter.draw call counter (engine dispatches once per fighter/frame)
  const F = fighters[0].constructor;
  const baseDraw = F.prototype.draw;
  let fighterDraws = 0;
  F.prototype.draw = function (...a) { fighterDraws++; return baseDraw.apply(this, a); };
  // outermost weapon dispatch counter (palette wrapper sits below this one)
  const AV = window.APEX_ARSENAL_AV;
  const bw = AV.drawEquippedWeapon;
  let weaponCalls = 0;
  AV.drawEquippedWeapon = function (...a) { weaponCalls++; return bw.apply(this, a); };
  // real status/fx activity so the isolation spies are non-vacuous: enemy is
  // WEAK (drawWeak live) and the hunter pounces (echoes live at speed).
  window.APEX_HERO_REWORK.match.api.applyWeakCombatant(window.APEX_HERO_REWORK.byCombatant(fighters[1]), 4.0);
  window.APEX_HERO_REWORK.abilityController(window.APEX_HERO_REWORK.byCombatant(fighters[0])).tryCast('A2', 'gates');
  const deriv0 = window.APEX_HUNTER_GOLD.cacheStats.derivations;
  const r0 = P.renderStats();
  const b0 = P.stats();
  const step = (n) => { for (let i = 0; i < n; i++) { window.APEX_ARSENAL.step(1 / 60); draw(); } };
  step(60);
  const b1 = P.stats();
  const r1 = P.renderStats();
  P.select('graphite-dark');
  step(120);
  const b2 = P.stats();
  const r2 = P.renderStats();
  const deriv1 = window.APEX_HUNTER_GOLD.cacheStats.derivations;
  F.prototype.draw = baseDraw;
  AV.drawEquippedWeapon = bw;
  G.Stage.prototype.drawWeak = dw; G.Stage.prototype.drawEchoes = de;
  if (typeof dsr === 'function') window.drawStatusRing = dsr;
  return {
    fighterDraws, weaponCalls, spy, rings, ringInActor,
    r0, r1, r2, b0, b1, b2, deriv0, deriv1,
    chamber: window.apexArsenalPerfSummary().chamber,
  };
});
// HUNTER vs ICE: 180 frames; hunter actor renders once per frame; ICE uses the
// geometric path (no actor render). Weapon equipped on hunter: one dispatch
// per frame through the wrapper (which itself renders once).
check('E-actor-single-render',
  battle.r1.actorRenders === 60 && battle.r2.actorRenders - battle.r1.actorRenders === 120 &&
  battle.fighterDraws === 360 && battle.r2.actorRenders === 180,
  { fighterDraws: battle.fighterDraws, actorRenders: battle.r2.actorRenders, note: '360 full-draw dispatches (2 fighters x 180 frames), exactly 180 hunter actor source renders — one per hunter frame, zero for geometric ICE' });
check('E-weapon-single-dispatch', battle.weaponCalls > 0 && battle.weaponCalls === battle.r2.weaponRenders, { weaponCalls: battle.weaponCalls, weaponRenders: battle.r2.weaponRenders, note: 'every weapon dispatch renders exactly once' });
check('E-status-not-in-silhouette', battle.spy.weakInActor === 0 && battle.spy.echoInActor === 0 && battle.ringInActor === 0 && battle.spy.weak > 0, { spy: battle.spy, rings: battle.rings });
check('D-cache-no-per-frame-repaint',
  battle.b1.builds === battle.b0.builds && battle.b1.hits === 60 &&
  battle.b2.builds === battle.b1.builds + 1 && battle.b2.hits - battle.b1.hits === 119,
  { b0: battle.b0, b1: battle.b1, b2: battle.b2, chamber: battle.chamber });
check('E-no-per-frame-growth',
  battle.r2.actorAllocs <= 2 && battle.deriv1 === battle.deriv0,
  { actorAllocs: battle.r2.actorAllocs, deriv0: battle.deriv0, deriv1: battle.deriv1 });

// --- robot actor single render ------------------------------------------------
const robot = await page.evaluate(() => {
  const P = window.APEX_CHAMBER_PALETTE;
  if (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active) window.exitArsenalQuestMode();
  window.startArsenalQuestMode('ROBOT', 'ICE');
  const s = window.APEX_ARSENAL.state; s.slots = []; s.spawnHeld = true; s.spawnTimer = 1e6; s.unarmedFastConsumed = true;
  const draw = window.__realDraw || window.draw;
  const r0 = P.renderStats();
  for (let i = 0; i < 60; i++) { window.APEX_ARSENAL.step(1 / 60); draw(); }
  const r1 = P.renderStats();
  return { d: r1.actorRenders - r0.actorRenders };
});
check('E-robot-single-render', robot.d === 60, robot);

// --- owner-playtest regression: palette must NEVER recolor actor source -------
const colorPreserve = await page.evaluate(() => {
  const P = window.APEX_CHAMBER_PALETTE;
  P.select('graphite-dark');
  const out = document.createElement('canvas');
  out.width = out.height = 256;
  const c = out.getContext('2d');
  const key = {};
  P.actorRender(c, key, 128, 128, (oc) => {
    oc.fillStyle = '#ff0000';
    oc.fillRect(96, 112, 24, 24);
    oc.fillStyle = '#0066ff';
    oc.fillRect(136, 112, 24, 24);
  }, 'probe');
  const left = [...c.getImageData(100, 116, 1, 1).data];
  const right = [...c.getImageData(140, 116, 1, 1).data];
  return { left, right, palette: P.current() };
});
check('E2-full-color-source-preserved',
  colorPreserve.left[0] > 220 && colorPreserve.left[1] < 40 && colorPreserve.left[2] < 40 &&
  colorPreserve.right[0] < 40 && colorPreserve.right[1] > 70 && colorPreserve.right[2] > 220,
  colorPreserve);

// --- gameplay untouched --------------------------------------------------------
const law = await page.evaluate(() => ({ fighters: window.fighters.length, speed: typeof window.APEX_ARSENAL_CONFIG.FIGHTER_SPEED }));
check('D-presentation-only', law.fighters === 2 && law.speed === 'number', law);

await page.evaluate(() => window.exitArsenalQuestMode && window.exitArsenalQuestMode());
fs.mkdirSync('docs/hero-rework/post-playtest-2026-09-29/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/post-playtest-2026-09-29/evidence/chamber-palette-gates.json', JSON.stringify({ results, errors }, null, 2));
const passN = Object.values(results).filter(r => r.pass).length;
console.log(`[CHAMBER PALETTE GATES] ${passN}/${Object.keys(results).length} gates passed; errors=${errors.length}`);
for (const [k, v] of Object.entries(results)) if (!v.pass) console.log('FAIL', k, JSON.stringify(v.data).slice(0, 400));
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
process.exit(passN === Object.keys(results).length && errors.length === 0 ? 0 : 1);
