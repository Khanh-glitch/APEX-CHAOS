// Acceptance run against the ZIP'S OWN EXTRACTED CONTENT, not the build tree.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('/home/user/APEX-CHAOS/tools/probe/node_modules/', 'file:///'));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { startServer } = await import('/home/user/APEX-CHAOS/tools/perf/goldNestedServer.mjs');
const REPO = '/home/user/APEX-CHAOS';
const ROOT = process.env.ZIP_ROOT || '/tmp/zipverify';
const OUT = process.env.OUT || '/tmp/zip-accept';
const seed = fs.readFileSync(REPO + '/tools/perf/qaProfile.js', 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (n, p, d) => { checks.push({ name: n, pass: !!p, detail: d });
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d === undefined ? '' : '  ' + JSON.stringify(d)}`); };

const srv = await startServer({ root: ROOT });
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [], http404 = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('response', r => { if (r.status() >= 400) http404.push(r.status() + ' ' + r.url().replace(srv.base, '')); });
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(seed);

await page.goto(srv.nested, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#apex-boot-start', { timeout: 180000 });
await page.evaluate(() => document.getElementById('apex-boot-start').click());
await page.waitForSelector('#freeBattle', { visible: true, timeout: 180000 });
await page.evaluate(() => {
  document.body.classList.remove('apex-scene-transition-active');
  document.body.dataset.apexSceneTransition = 'DONE';
  const c = document.getElementById('apex-scene-transition'); if (c) c.style.display = 'none';
});
await new Promise(r => setTimeout(r, 2000));

// --- served URL is the nested itch path, from the extracted ZIP ---
const where = await page.evaluate(() => ({
  href: location.href, base: document.baseURI,
  title: document.title,
}));
check('served from nested /html/apex/ path (itch layout)', /\/html\/apex\/?$/.test(new URL(where.href).pathname) || where.href.includes('/html/apex/'), where.href);

// --- root entry + asset integrity: every declared asset actually resolves ---
// The manifest is {generatedAt, authority, loadingAssets, assets:[{path,type,bytes}]}.
// Paths are root-absolute app paths (/game/...), not 'assets/'-relative, so they
// resolve against the app root — which is exactly what the nested itch layout
// exercises: a wrongly-rooted path 404s here and nowhere else.
const assets = await page.evaluate(async () => {
  const out = { manifest: null, missing: [], checked: 0, loading: 0, loadingMissing: [] };
  try {
    // The Gold shell loader retargets <base href="./gold/">, so document.baseURI
    // is /html/apex/gold/ and a bare relative fetch 404s. Resolve against the
    // APP ROOT (the document's own directory), never the <base>.
    const appRoot = new URL('./', location.href).href;   // .../html/apex/
    const m = await (await fetch(new URL('asset-manifest.json', appRoot).href, { cache: 'no-cache' })).json();
    const list = Array.isArray(m.assets) ? m.assets : [];
    out.manifest = list.length;
    for (const entry of list) {
      const rel = typeof entry === 'string' ? entry : entry && entry.path;
      if (!rel) continue;
      out.checked++;
      // Root-absolute paths must be requested from the SERVER ROOT, not from
      // document.baseURI, or a correct path would look broken.
      const base = appRoot.replace(/\/$/, '');
      const url = /^\//.test(rel) ? base.replace(/\/$/, '') + rel : new URL(rel, document.baseURI).href;
      try { const r = await fetch(url, { method: 'HEAD' }); if (!r.ok) out.missing.push(rel + ' -> ' + r.status); }
      catch (e) { out.missing.push(rel + ' -> throw'); }
    }
    for (const [k, v] of Object.entries(m.loadingAssets || {})) {
      out.loading++;
      try { const r = await fetch(new URL(String(v).replace(/^\//, ''), appRoot).href, { method: 'HEAD' });
        if (!r.ok) out.loadingMissing.push(k + ' -> ' + r.status); } catch (e) { out.loadingMissing.push(k + ' -> throw'); }
    }
  } catch (e) { out.err = String(e.message); }
  return out;
});
check('asset-manifest.json present', assets.manifest !== null, assets.manifest);
check('EVERY manifest asset resolves through the nested path', assets.missing.length === 0,
  { checked: assets.checked, missing: assets.missing.slice(0, 8) });
check('loading assets resolve', assets.loading > 0 && assets.loadingMissing.length === 0,
  { loading: assets.loading, missing: assets.loadingMissing });

// --- both modes: flags, HUD mirror, painted dialogs ---
const painted = (sel) => page.evaluate((q) => {
  const el = document.querySelector(q);
  if (!el) return { ok: false, why: 'absent' };
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  if (cs.display === 'none' || cs.visibility === 'hidden') return { ok: false, why: 'display' };
  if (+cs.opacity < 0.99) return { ok: false, why: 'opacity ' + cs.opacity };
  if (r.width < 24 || r.height < 24) return { ok: false, why: 'collapsed' };
  if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) return { ok: false, why: 'overflow' };
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  let n = hit, inside = false; while (n) { if (n === el) { inside = true; break; } n = n.parentElement; }
  return inside ? { ok: true, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }
                : { ok: false, why: 'covered by ' + (hit && (hit.id || hit.className)) };
}, sel);

const boot = await page.evaluate(() => ({
  chain: ['APEX_GRAPHICS_QUALITY', 'APEX_GRAPHICS_SETTINGS_UI', 'APEX_GRAPHICS_ADVISOR', 'APEX_GRAPHICS_MODE_RUNTIME', 'APEX_GRAPHICS_FRONTEND']
    .filter(k => !!window[k]),
  mode: window.APEX_GRAPHICS_QUALITY?.mode,
  drawer: !!document.getElementById('apex-graphics-open'),
  css: !!document.getElementById('apex-graphics-quality-ui-css'),
}));
check('quality stack present from ZIP', boot.chain.length === 5 && boot.drawer && boot.css, boot);
check('defaults to HIGH', boot.mode === 'high', boot.mode);

// HIGH
await page.evaluate(() => window.APEX_GRAPHICS_QUALITY.set('high', 'zip-accept'));
await new Promise(r => setTimeout(r, 500));
const highFlags = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY.mode,
  bloom: window.APEX_GRAPHICS_BLOOM_WIDE, fluid: window.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
  shadow: window.APEX_ICE_SHADOW_NODE_BUDGET, flow: window.APEX_ICE_FLOW_MOTION_BUDGET,
  // #hud belongs to the battle-HUD document; before a battle is mounted the
  // shell page legitimately has none, so report only what exists.
  hudGfx: document.getElementById('hud')?.getAttribute('data-gfx') ?? null,
}));
check('HIGH applies its flags', highFlags.mode === 'high' && highFlags.bloom === 1 && highFlags.fluid === 1,
  highFlags);
await page.screenshot({ path: `${OUT}/high.png` });

// PERF
await page.evaluate(() => window.APEX_GRAPHICS_QUALITY.set('performance', 'zip-accept'));
await new Promise(r => setTimeout(r, 600));
const perfFlags = await page.evaluate(() => ({
  mode: window.APEX_GRAPHICS_QUALITY.mode,
  bloom: window.APEX_GRAPHICS_BLOOM_WIDE, fluid: window.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
  shadow: window.APEX_ICE_SHADOW_NODE_BUDGET, flow: window.APEX_ICE_FLOW_MOTION_BUDGET,
  hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx') ?? null,
  stored: (() => { try { return JSON.parse(localStorage.getItem('apexChaos.graphicsQuality.v1')); } catch (e) { return null; } })(),
}));
// PERFORMANCE used to set the bloom flag to 0, which did not make the halo
// cheaper — composite() drew it with filter='none', i.e. without the
// convolution. Measured against HIGH that is max delta 29/255 over 18-25% of
// pixels, a visibly different image. The halo is now convolved at half
// resolution in BOTH modes (max delta 1-2/255, pixel-equivalent), so the
// correct PERFORMANCE expectation is bloom === 1 with the halo present.
check('PERFORMANCE applies its flags (halo kept on purpose)', perfFlags.mode === 'performance'
  && perfFlags.bloom === 1 && perfFlags.fluid === 0 && perfFlags.shadow === 5 && perfFlags.flow === 0.55,
  perfFlags);
// The HUD mirror is asserted AFTER the battle mounts (below), where the HUD
// document actually exists; here only the authority-side effect is checked.
check('mode persisted', perfFlags.stored?.mode === 'performance', perfFlags.stored);
await page.screenshot({ path: `${OUT}/performance.png` });

// settings panel painted
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.open(document.body));
await new Promise(r => setTimeout(r, 900));
const cardPaint = await painted('#apex-graphics-settings .aqs-card');
check('settings dialog painted (from ZIP)', cardPaint.ok, cardPaint);
await page.screenshot({ path: `${OUT}/settings.png` });
await page.evaluate(() => document.querySelector('#apex-graphics-settings [data-aqs-mode="high"]')?.click());
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.close());

// battle: real hand-off, mid-battle switch, advisor, toast
await page.evaluate(async () => {
  const h = document.getElementById('battleHudHost');
  h.classList.add('is-open'); document.body.classList.add('battle-hud-open');
  const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
  await new Promise(r => window.APEX_GOLD.mountBattleHud(html, r));
  await window.APEX_GOLD.onHandoff({ mode: 'LOCAL', p1: 'crystala', p2: 'frost', p1Hero: 'crystala', p2Hero: 'frost', shell: 'battle' });
  await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1: 'crystala', p2: 'frost' });
});
await new Promise(r => setTimeout(r, 2200));
const battle = await page.evaluate(() => ({ fighters: (window.fighters || []).length,
  hud: document.querySelector('#hud')?.getAttribute('data-gfx') }));
check('match runs with both fighters from ZIP', battle.fighters === 2, battle);
// Now that the HUD document is mounted, the consumer must mirror the authority.
const hudMirror = await page.evaluate(async () => {
  const before = document.querySelector('#hud')?.getAttribute('data-gfx') ?? null;
  window.APEX_GRAPHICS_QUALITY.set('performance', 'zip-accept');
  await new Promise(r => setTimeout(r, 450));
  const after = document.querySelector('#hud')?.getAttribute('data-gfx') ?? null;
  return { before, after, consumer: !!window.APEX_HUD_GRAPHICS_QUALITY };
});
check('HUD consumer mirrors the authority on a live battle',
  hudMirror.after === 'performance' && hudMirror.consumer, hudMirror);
await page.evaluate(() => window.APEX_GRAPHICS_QUALITY.set('high', 'zip-accept'));
await page.screenshot({ path: `${OUT}/battle.png` });

// mid-battle switch without reload
const mid = await page.evaluate(() => {
  window.APEX_GRAPHICS_SETTINGS_UI.open(document.body);
  document.querySelector('#apex-graphics-settings [data-aqs-mode="performance"]')?.click();
  return { mode: window.APEX_GRAPHICS_QUALITY.mode,
    hudGfx: document.querySelector('#hud')?.getAttribute('data-gfx'),
    fighters: (window.fighters || []).length, gameState: window.gameState };
});
check('mid-battle switch, no reload', mid.mode === 'performance' && mid.fighters === 2, mid);
await page.evaluate(() => window.APEX_GRAPHICS_SETTINGS_UI.close());

// advisor painted
const adv = await page.evaluate(() => {
  window.APEX_GRAPHICS_QUALITY.set('high', 'zip-accept');
  const a = window.APEX_GRAPHICS_ADVISOR;
  a._test.pause(); a._test.hide(); a._test.reset();
  const slow = new Array(30).fill(45);
  const r1 = a._test.evaluate(slow), r2 = a._test.evaluate(slow), r3 = a._test.evaluate(slow);
  a._test.hold();
  return { r1: r1.recommend, r2: r2.recommend, r3: r3.recommend };
});
check('advisor needs 3 windows', adv.r1 === false && adv.r2 === false && adv.r3 === true, adv);
const advPaint = await painted('#apex-quality-advisor');
check('advisor painted', advPaint.ok, advPaint);
await page.screenshot({ path: `${OUT}/advisor.png` });
await page.evaluate(() => document.querySelector('#apex-quality-advisor [data-aqa-action="switch"]')?.click());
const toastPaint = await painted('#apex-quality-toast');
check('toast painted and centred', toastPaint.ok, toastPaint);
await page.screenshot({ path: `${OUT}/toast.png` });

check('no JS exceptions', errs.length === 0, errs.slice(0, 4));
check('no HTTP 4xx/5xx', http404.filter(u => !u.includes('favicon')).length === 0,
  http404.filter(u => !u.includes('favicon')).slice(0, 4));

const summary = { source: ROOT, servedFrom: where.href, checks, passed: checks.filter(c => c.pass).length,
  failed: checks.filter(c => !c.pass).length, errs, http404 };
fs.writeFileSync(`${OUT}/zip-acceptance.json`, JSON.stringify(summary, null, 1));
console.log(`\n${summary.passed}/${checks.length} checks passed  (source: ${ROOT})`);
await browser.close();
await srv.server.close();
process.exit(summary.failed === 0 ? 0 : 1);
