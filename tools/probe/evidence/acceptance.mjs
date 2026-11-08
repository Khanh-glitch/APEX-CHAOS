// End-to-end acceptance on the PACKAGED build (dist-itch-html5), served through
// the nested /html/apex/ path itch.io uses. Every assertion is a real browser
// observation; nothing here is derived from source inspection.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('../../perf/goldNestedServer.mjs');
const REPO = '/home/user/APEX-CHAOS';
const seed = fs.readFileSync(REPO + '/tools/perf/qaProfile.js', 'utf8');
const OUT = process.argv[2] || '/tmp/acceptance';
fs.mkdirSync(OUT, { recursive: true });
const EV = JSON.parse(process.env.EV || '{}');

const checks = [];
const check = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  ' + JSON.stringify(detail)}`); };

const srv = await startServer({ root: REPO + '/dist-itch-html5' });
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [], http404 = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('response', r => { if (r.status() >= 400) http404.push(r.status() + ' ' + r.url().replace(srv.base, '')); });
await page.setViewport({ width: EV.w || 1440, height: EV.h || 900, deviceScaleFactor: EV.dpr || 1 });
await page.evaluateOnNewDocument(seed);

await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
await page.evaluate(() => {
  document.body.classList.remove('apex-scene-transition-active');
  document.body.dataset.apexSceneTransition = 'DONE';
  const cv = document.getElementById('apex-scene-transition'); if (cv) cv.style.display = 'none';
});
await new Promise(r => setTimeout(r, 2000));
const settle = async (ms = 900) => {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
  await new Promise(r => setTimeout(r, ms));
};

// ---------- boot ----------
const boot = await page.evaluate(() => ({
  authority: !!window.APEX_GRAPHICS_QUALITY,
  mode: window.APEX_GRAPHICS_QUALITY?.mode,
  chain: ['APEX_GRAPHICS_QUALITY','APEX_GRAPHICS_SETTINGS_UI','APEX_GRAPHICS_ADVISOR','APEX_GRAPHICS_MODE_RUNTIME','APEX_GRAPHICS_FRONTEND','APEX_HUD_GRAPHICS_QUALITY']
    .filter(k => !!window[k]),
  frontendReady: window.apexGraphicsQualityFrontend,
  drawer: !!document.getElementById('apex-graphics-open'),
  drawerValue: document.getElementById('apex-graphics-open-value')?.textContent,
  css: !!document.getElementById('apex-graphics-quality-ui-css'),
}));
check('authority present', boot.authority, boot.mode);
check('settings/advisor/mode/frontend runtimes present', boot.chain.length >= 5, boot.chain);
check('frontend readiness marker', boot.frontendReady === 'ready', boot.frontendReady);
check('defaults to HIGH', boot.mode === 'high', boot.mode);
check('drawer row rendered', boot.drawer, boot.drawerValue);
check('quality CSS linked', boot.css);

// ---------- panel ----------
await page.evaluate(() => document.getElementById('apex-graphics-open')?.click());
await settle(1200);
const panel = await page.evaluate(() => {
  const p = document.getElementById('apex-graphics-settings');
  const cs = p && getComputedStyle(p);
  const card = p?.querySelector('.aqs-card');
  const ccs = card && getComputedStyle(card);
  return {
    exists: !!p, hidden: p?.hidden,
    role: p?.getAttribute('role'), ariaModal: p?.getAttribute('aria-modal'),
    containerOpacity: cs?.opacity, cardOpacity: ccs?.opacity,
    panelOpacity: cs ? +cs.opacity : null,
    radios: [...(p?.querySelectorAll('[data-aqs-mode]') || [])].map(b => ({ mode: b.dataset.aqsMode, checked: b.getAttribute('aria-checked'), tabIndex: b.tabIndex })),
    hitTest: (() => { const r = card?.getBoundingClientRect(); if (!r) return null; const el = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return el ? (el.id || el.className || el.tagName) : null; })(),
  };
});
check('panel opens from drawer', panel.exists && !panel.hidden);
check('panel is a modal dialog', panel.role === 'dialog' && panel.ariaModal === 'true', { role: panel.role, ariaModal: panel.ariaModal });
check('panel is actually visible (opacity, not just hidden=false)', panel.containerOpacity === '1' && panel.cardOpacity === '1', { container: panel.containerOpacity, card: panel.cardOpacity });
check('radiogroup with correct checked state', panel.radios.find(r => r.mode === 'high')?.checked === 'true' && panel.radios.find(r => r.mode === 'performance')?.checked === 'false');
check('roving tabindex', panel.radios.find(r => r.mode === 'high')?.tabIndex === 0 && panel.radios.find(r => r.mode === 'performance')?.tabIndex === -1);
check('panel hit-tests at its own centre', /aqs/.test(String(panel.hitTest)), panel.hitTest);
await page.screenshot({ path: `${OUT}/settings-high.png` });

// ---------- switch + flags ----------
await page.evaluate(() => document.querySelector('[data-aqs-mode="performance"]')?.click());
await settle(700);
const switched = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY.mode,
  stored: localStorage.getItem('apexChaos.graphicsQuality.v1'),
  drawerValue: document.getElementById('apex-graphics-open-value')?.textContent,
  flags: { bloom: window.APEX_GRAPHICS_BLOOM_WIDE, fluid: window.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
           shadow: window.APEX_ICE_SHADOW_NODE_BUDGET, flow: window.APEX_ICE_FLOW_MOTION_BUDGET },
  radios: [...document.querySelectorAll('[data-aqs-mode]')].map(b => b.dataset.aqsMode + ':' + b.getAttribute('aria-checked')),
}));
check('switch applies PERFORMANCE', switched.mode === 'performance');
check('persisted to the one storage key', /performance/.test(switched.stored || ''), switched.stored);
check('drawer readout follows', /PERFORMANCE/i.test(switched.drawerValue || ''), switched.drawerValue);
check('all four candidate flags set', switched.flags.bloom === 0 && switched.flags.fluid === 0 && switched.flags.shadow === 5 && switched.flags.flow === 0.55, switched.flags);
check('radio state follows', switched.radios.includes('performance:true'));
await page.screenshot({ path: `${OUT}/settings-performance.png` });

// ---------- keyboard ----------
const kb = await page.evaluate(() => {
  const p = document.getElementById('apex-graphics-settings');
  const high = p.querySelector('[data-aqs-mode="high"]');
  high.focus();
  high.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  return { mode: window.APEX_GRAPHICS_QUALITY.mode, focused: document.activeElement?.dataset?.aqsMode };
});
check('arrow key selects and moves focus', kb.mode === 'performance' && kb.focused === 'performance', kb);
const esc = await page.evaluate(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { hidden: document.getElementById('apex-graphics-settings')?.hidden };
});
check('Escape closes the panel', esc.hidden === true);

// ---------- persistence across reload ----------
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
const persisted = await page.evaluate(() => ({ mode: window.APEX_GRAPHICS_QUALITY?.mode, stored: localStorage.getItem('apexChaos.graphicsQuality.v1') }));
check('mode persists across reload', persisted.mode === 'performance', persisted.mode);
await page.evaluate(() => { window.APEX_GRAPHICS_QUALITY.set('high', 'test'); });
await page.evaluate(() => document.getElementById('apex-boot-start')?.click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
await page.evaluate(() => {
  document.body.classList.remove('apex-scene-transition-active');
  document.body.dataset.apexSceneTransition = 'DONE';
  const cv = document.getElementById('apex-scene-transition'); if (cv) cv.style.display = 'none';
});
await settle(1800);

// ---------- battle: mid-battle switch + HUD mirror ----------
await page.evaluate(async () => {
  const h = document.getElementById('battleHudHost');
  h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
  const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
  await new Promise(r => window.APEX_GOLD.mountBattleHud(html, r));
  await window.APEX_GOLD.onHandoff({ mode: 'LOCAL', p1: 'crystala', p2: 'frost', p1Hero: 'crystala', p2Hero: 'frost', shell: 'battle' });
  await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1: 'crystala', p2: 'frost' });
});
await settle(2200);
const battle = await page.evaluate(() => ({
  fighters: (window.fighters || []).map(f => f.name),
  hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx'),
  hudConsumer: !!window.APEX_HUD_GRAPHICS_QUALITY,
  canvasSize: window.canvas ? [window.canvas.width, window.canvas.height] : null,
  abilityCount: document.querySelectorAll('#hud [class*="skill"], #hud [class*="ability"]').length,
}));
check('match runs with both fighters', battle.fighters.length === 2, battle.fighters);
check('HUD consumer mirrors the authority', battle.hudConsumer && battle.hudGfx === 'high', battle.hudGfx);
check('arena canvas sized', battle.canvasSize && battle.canvasSize[0] > 0, battle.canvasSize);
await page.screenshot({ path: `${OUT}/battle-high.png` });

const mid = await page.evaluate(() => {
  window.APEX_GRAPHICS_SETTINGS_UI.open(document.body);
  const opened = !document.getElementById('apex-graphics-settings').hidden;
  document.querySelector('[data-aqs-mode="performance"]')?.click();
  return { opened, mode: window.APEX_GRAPHICS_QUALITY.mode,
           hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx'),
           fighters: (window.fighters || []).length, gameState: window.gameState };
});
check('settings open during a live match', mid.opened);
check('mid-battle switch without reload', mid.mode === 'performance' && mid.fighters === 2, mid);
check('HUD mirror updates mid-battle', mid.hudGfx === 'performance', mid.hudGfx);
await settle(600);
await page.screenshot({ path: `${OUT}/battle-performance.png` });
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.close('test'));

// ---------- advisor ----------
// NOTE: the real sampler is live during this battle and this sandbox's rAF is
// genuinely 2-6 Hz, so the advisor may legitimately have already recommended.
// Hide any such panel first so the following assertions observe ONLY the
// windows this test drives.
const advBlocked = await page.evaluate(() => {
  const a = window.APEX_GRAPHICS_ADVISOR;
  a._test.pause();          // the real sampler must not add windows here
  a._test.hide();
  a._test.reset();
  const slow = new Array(30).fill(45);
  const recs = [a._test.evaluate(slow), a._test.evaluate(slow), a._test.evaluate(slow)].map(r => r.recommend);
  const el = document.getElementById('apex-quality-advisor');
  return { opened: recs.some(Boolean), reasons: recs,
           suppressed: a._test.debug().suppressedReason,
           // hide() is an animation: `hidden` flips 180 ms later, so the
           // synchronous truth is state.panelOpen / the is-open class.
           panelOpen: a.state.panelOpen === true || !!(el && el.classList.contains('is-open')),
           windows: a._test.debug().windows };
});
check('advisor never recommends while already PERFORMANCE',
  advBlocked.opened === false && advBlocked.panelOpen === false, advBlocked);

const adv = await page.evaluate(() => {
  window.APEX_GRAPHICS_QUALITY.set('high', 'test');
  const a = window.APEX_GRAPHICS_ADVISOR;
  a._test.pause();          // the real sampler must not add windows here
  a._test.hide();
  a._test.reset();
  const slow = new Array(30).fill(45);
  const r1 = a._test.evaluate(slow);
  const r2 = a._test.evaluate(slow);
  const after2 = !!document.getElementById('apex-quality-advisor')?.classList.contains('is-open');
  const r3 = a._test.evaluate(slow);
  window.__advShownAt = performance.now();
  const p = document.getElementById('apex-quality-advisor');
  return { r1: r1.recommend, r2: r2.recommend, r3: r3.recommend,
           after2, after3: !!p && p.classList.contains('is-open'),
           title: p?.querySelector('.aqa-title')?.textContent,
           actions: [...(p?.querySelectorAll('[data-aqa-action]') || [])].map(b => b.dataset.aqaAction),
           hasLife: !!p?.querySelector('.aqa-life') };
});
check('advisor needs 3 consecutive windows, not 2',
  adv.r1 === false && adv.r2 === false && adv.r3 === true && adv.after2 === false,
  { r1: adv.r1, r2: adv.r2, r3: adv.r3, after2: adv.after2 });
check('advisor title', adv.title === 'LOW PERFORMANCE DETECTED', adv.title);
check('advisor offers SWITCH and KEEP HIGH', adv.actions.includes('switch') && adv.actions.includes('dismiss'), adv.actions);
check('advisor has the 5 s life rail', adv.hasLife);
await settle(700);
await page.screenshot({ path: `${OUT}/advisor.png` });

const dismissed = await page.evaluate(() => new Promise(res => {
  // Timed from the instant the panel was shown (__advShownAt), so the settle +
  // screenshot time spent above cannot be mistaken for the life rail expiring.
  const tick = () => {
    const el = document.getElementById('apex-quality-advisor');
    const life = Math.round(performance.now() - (window.__advShownAt || performance.now()));
    if (el && el.hidden) return res({ hidden: true, lifeMs: life });
    if (life > 25000) return res({ hidden: false, lifeMs: life });
    setTimeout(tick, 100);
  };
  tick();
}));
// The rail is 5 s. Under SwiftShader on 2 vCPU the main thread is saturated, so
// the observed latency runs several seconds long; only the lower bound is a
// meaningful assertion here (a >5 s rail would be a real defect).
check('advisor auto-dismisses, never before the 5 s rail',
  dismissed.hidden === true && dismissed.lifeMs >= 4500, dismissed);

// ---------- accept via the panel ----------
await page.evaluate(() => {
  window.APEX_GRAPHICS_QUALITY.set('high', 'test');
  const a = window.APEX_GRAPHICS_ADVISOR;
  a._test.pause();          // the real sampler must not add windows here
  a._test.hide();
  a._test.reset();
  const slow = new Array(30).fill(45);
  a._test.evaluate(slow); a._test.evaluate(slow); a._test.evaluate(slow);
});
await settle(500);
await page.evaluate(() => document.querySelector('#apex-quality-advisor [data-aqa-action="switch"]')?.click());
await settle(700);
const accepted = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY.mode,
  toast: document.getElementById('apex-quality-toast')?.textContent,
  toastVisible: !document.getElementById('apex-quality-toast')?.hidden,
  hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx'),
}));
check('SWITCH applies PERFORMANCE', accepted.mode === 'performance');
check('confirmation toast shown', accepted.toastVisible && /PERFORMANCE/.test(accepted.toast || ''), accepted.toast);
await page.screenshot({ path: `${OUT}/advisor-accepted.png` });

// ---------- invariants ----------
await page.evaluate(() => { const a = window.APEX_GRAPHICS_ADVISOR; if (a && a._test) a._test.resume(); });
check('no JS exceptions', errs.length === 0, errs.slice(0, 4));
check('no HTTP 4xx/5xx', http404.filter(u => !u.includes('favicon')).length === 0, http404.filter(u => !u.includes('favicon')).slice(0, 4));

const summary = { viewport: EV, checks, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, errs, http404 };
fs.writeFileSync(`${OUT}/acceptance.json`, JSON.stringify(summary, null, 1));
console.log(`\n${summary.passed}/${checks.length} checks passed`);
await browser.close(); await srv.server.close();
process.exit(summary.failed === 0 ? 0 : 1);
