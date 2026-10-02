#!/usr/bin/env node
/* CHECKPOINT D3 — A1/A2 authored choreography: real-weapon adapter + frame parity.
 *
 * Proves the shipped A1 reflection/peel renders the ACTUAL snapshotted Arsenal
 * weapon (not Gold's demo placeholder), and captures the seven A1/A2 frames.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire('/tmp/magnet-browser-deps/x.js');
const puppeteer = require('puppeteer-core');
const cm = require('@sparticuz/chromium');
const chromium = cm.default || cm;
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const BASE = process.env.APEX_GOLD_URL || 'http://127.0.0.1:4200';
const MOD = `${BASE}/public/game/hero-rework/mirrorGoldV1.js`;
const WEAPONS = ['SNIPER', 'BATTLE_AXE', 'PISTOL'];
const OUT = 'docs/hero-rework/mirror-v1/evidence/d3-frames';

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => !/use-gl|use-angle|swiftshader|gpu/.test(a)), '--disable-gpu'],
  headless: true, protocolTimeout: 900000,
});
let R, errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({ url: MOD });
  await page.waitForFunction(() => window.apexMirrorGoldV1 === 'ready', { timeout: 60000 });

  R = await page.evaluate(async (base, weapons) => {
    const G = window.APEX_MIRROR_GOLD;
    G.ensureBaked();
    const loadImg = (src) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + src)); i.src = src;
    });
    const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

    // Render A1 at a chosen choreography moment with a given weapon art.
    const renderA1 = async (weaponId, u) => {
      const inst = G.createMirrorInstance({ seed: 21 });
      inst.M.x = 500; inst.M.y = 500; inst.F.x = 760; inst.F.y = 500; inst.histFill();
      let src = 'gold-demo-fallback';
      if (weaponId) {
        const img = await loadImg(`${base}/public/assets/arsenal/weapons/c/${weaponId}.png`);
        const art = inst.setWeaponArt({ image: img, weaponId, w: img.width, h: img.height });
        src = art ? art.source : 'none';
      }
      const c = mkCanvas(520, 520), g = c.getContext('2d');
      g.fillStyle = '#111216'; g.fillRect(0, 0, 520, 520);
      g.setTransform(1.6, 0, 0, 1.6, 260 - 500 * 1.6, 260 - 500 * 1.6);
      inst.castA1(false);
      const STEP = inst.constants.STEP;
      let t = 0;
      while (t < u * 1.6) { inst.stepA1(STEP); t += STEP; }
      inst.drawA1World(g);
      return { url: c.toDataURL('image/png'), source: src, weaponArt: inst.weaponArt().weaponId || null };
    };

    const out = { weapons: {}, frames: {} };
    for (const w of weapons) out.weapons[w] = await renderA1(w, 0.30);
    out.weapons.__goldFallback = await renderA1(null, 0.30);

    // Seven canonical A1/A2 moments from the ported choreography.
    const shot = async (name, fn) => {
      const inst = G.createMirrorInstance({ seed: 31 });
      inst.M.x = 500; inst.M.y = 500; inst.F.x = 760; inst.F.y = 500; inst.histFill();
      const img = await loadImg(`${base}/public/assets/arsenal/weapons/c/SNIPER.png`);
      inst.setWeaponArt({ image: img, weaponId: 'SNIPER', w: img.width, h: img.height });
      const c = mkCanvas(560, 560), g = c.getContext('2d');
      g.fillStyle = '#111216'; g.fillRect(0, 0, 560, 560);
      g.setTransform(1.5, 0, 0, 1.5, 280 - 500 * 1.5, 280 - 500 * 1.5);
      fn(inst, g);
      out.frames[name] = c.toDataURL('image/png');
    };
    const run = (inst, step, secs) => { const S = inst.constants.STEP; let t = 0; while (t < secs) { step(S); t += S; } };

    // drawA1World is silent before u>=.1 and the flat in-plate stage ends once
    // A1.q>=.02 (u>=.244). t=0.25s sits inside that window: u=.156, q=0.
    await shot('a1-attached-reflection', (i, g) => { i.castA1(false); run(i, (s) => i.stepA1(s), 0.25); i.drawMirrorEntity(g); i.drawA1World(g); });
    await shot('a1-peel', (i, g) => { i.castA1(false); run(i, (s) => i.stepA1(s), 0.60); i.drawMirrorEntity(g); i.drawA1World(g); });
    await shot('a1-reform-own-edge', (i, g) => { i.castA1(false); run(i, (s) => i.stepA1(s), 0.95); i.drawMirrorEntity(g); i.drawA1World(g); i.drawHeld(g); });
    await shot('a1-whiff', (i, g) => { i.castA1(true); run(i, (s) => i.stepA1(s), 0.60); i.drawMirrorEntity(g); i.drawA1World(g); });
    await shot('a2-pre-snap', (i, g) => { i.castA2(); run(i, (s) => i.stepA2(s), 0.20); i.drawMirrorEntity(g); i.drawFoeEntity(g); });
    await shot('a2-snap', (i, g) => { i.castA2(); run(i, (s) => i.stepA2(s), 0.27); i.drawMirrorEntity(g); i.drawFoeEntity(g); i.drawResidue(g); });
    await shot('a2-post-residue', (i, g) => { i.castA2(); run(i, (s) => i.stepA2(s), 0.34); i.drawMirrorEntity(g); i.drawFoeEntity(g); i.drawResidue(g); });

    return out;
  }, BASE, WEAPONS);
} finally { await browser.close(); }

fs.mkdirSync(OUT, { recursive: true });
const sha = (u) => crypto.createHash('sha256').update(Buffer.from(u.split(',')[1], 'base64')).digest('hex');
const save = (name, url) => { fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); return sha(url); };

const wSha = {};
for (const k of Object.keys(R.weapons)) wSha[k] = { sha: save(`weapon-${k}`, R.weapons[k].url).slice(0, 16), source: R.weapons[k].source, id: R.weapons[k].weaponArt };
const fSha = {};
for (const k of Object.keys(R.frames)) fSha[k] = save(k, R.frames[k]).slice(0, 16);

gate('D3-W1-real-weapon-art-accepted',
  WEAPONS.every((w) => wSha[w].source === 'production' && wSha[w].id === w), wSha);
const distinct = new Set(WEAPONS.map((w) => wSha[w].sha));
gate('D3-W2-three-real-weapons-render-distinctly', distinct.size === 3,
  WEAPONS.map((w) => ({ weapon: w, sha: wSha[w].sha })));
gate('D3-W3-real-weapon-differs-from-gold-demo-placeholder',
  WEAPONS.every((w) => wSha[w].sha !== wSha.__goldFallback.sha),
  { goldFallback: wSha.__goldFallback.sha, real: WEAPONS.map((w) => wSha[w].sha) });
gate('D3-W4-no-placeholder-when-production-supplies-art',
  WEAPONS.every((w) => wSha[w].source !== 'gold-demo-fallback'), null);

const NEED = ['a1-attached-reflection', 'a1-peel', 'a1-reform-own-edge', 'a1-whiff', 'a2-pre-snap', 'a2-snap', 'a2-post-residue'];
gate('D3-F1-seven-choreography-frames-captured', NEED.every((n) => fSha[n]), Object.keys(fSha));
gate('D3-F2-all-frames-distinct', new Set(NEED.map((n) => fSha[n])).size === NEED.length, fSha);
gate('D3-F3-a1-peel-differs-from-attached',
  fSha['a1-peel'] !== fSha['a1-attached-reflection'], null);
gate('D3-F4-whiff-differs-from-valid-peel', fSha['a1-whiff'] !== fSha['a1-peel'], null);
gate('D3-F5-a2-snap-differs-from-pre-snap', fSha['a2-snap'] !== fSha['a2-pre-snap'], null);
gate('D3-99-no-page-errors', errors.length === 0, errors.slice(0, 4));

fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/d3-choreography.json', JSON.stringify({
  generatedAt: new Date().toISOString(), weapons: wSha, frames: fSha, ...report,
  pass: report.failures.length === 0,
}, null, 2));
const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR D3 CHOREOGRAPHY] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
