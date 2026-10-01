#!/usr/bin/env node
/* MAGNET — unwanted fighter-underlay circle PROVENANCE probe.
 *
 * Instruments CanvasRenderingContext2D.arc / ellipse / stroke / fill in the
 * REAL production preview, maps every call into world space, keeps only calls
 * whose centre sits on a fighter centre, and captures the JS stack so the
 * drawing runtime is identified rather than guessed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/tmp/magnet-browser-deps/noop.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const execPath = await chromium.executablePath();
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', '/tmp/chromium/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const url = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({
  executablePath: execPath,
  args: [...chromium.args, '--autoplay-policy=no-user-gesture-required'],
  headless: true, protocolTimeout: 300000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let out;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
  out = await page.evaluate(async (ENEMY) => {
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const waitFrames = (n) => new Promise((r) => { let c = 0; const next = () => (++c >= n ? r() : requestAnimationFrame(next)); requestAnimationFrame(next); });

    if (window.APEX_HERO_REWORK.match) window.exitArsenalQuestMode();
    window.startArsenalQuestMode('MAGNET', ENEMY);
    window.APEX_HERO_REWORK.setAiEnabled(false);
    const st = window.APEX_ARSENAL.state; st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true;
    await waitFrames(5);
    const [hero, opp] = window.fighters;
    hero.baseSpeed = 0; opp.baseSpeed = 0;
    hero.x = 380; hero.y = 520; opp.x = 700; opp.y = 520;
    await waitFrames(8);

    const P = CanvasRenderingContext2D.prototype;
    const rec = [];
    const originals = {};
    let capturing = false;

    const worldOf = (ctx, x, y) => { try { const m = ctx.getTransform(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, scale: Math.hypot(m.a, m.b) }; } catch (e) { return null; } };
    const stackOf = () => {
      const s = new Error().stack || '';
      return s.split('\n').slice(2, 9).map((l) => l.trim()).filter((l) => !/probeStack|wrapped|at Object\.</.test(l));
    };

    for (const name of ['arc', 'ellipse']) {
      originals[name] = P[name];
      P[name] = function wrapped(x, y, ...rest) {
        if (capturing) {
          const w = worldOf(this, x, y);
          if (w) rec.push({ op: name, local: { x, y }, screen: { x: w.x, y: w.y }, radii: rest.slice(0, 2), style: { stroke: String(this.strokeStyle), fill: String(this.fillStyle), lineWidth: this.lineWidth, alpha: this.globalAlpha, dash: (this.getLineDash && this.getLineDash()) || [] }, stack: stackOf() });
        }
        return originals[name].call(this, x, y, ...rest);
      };
    }

    capturing = true;
    await waitFrames(6);
    capturing = false;
    for (const name of ['arc', 'ellipse']) P[name] = originals[name];

    // A fighter-underlay ring is drawn in the fighter's LOCAL space, so its
    // centre is at/near (0,0) after the engine's translate(f.x,f.y). That is
    // transform-independent, so no camera guess is needed.
    const groups = new Map();
    for (const c of rec) {
      const localR = Math.hypot(c.local.x, c.local.y);
      const key = c.stack.join(' | ') + '|' + c.op + '|' + Math.round(Number(c.radii[0]) || 0) + '|' + c.style.stroke + '|' + c.style.fill;
      if (!groups.has(key)) groups.set(key, { op: c.op, local: c.local, localOffset: +localR.toFixed(1), radii: c.radii, style: c.style, stack: c.stack, count: 0, onFighters: [] });
      const g0 = groups.get(key);
      for (const f of window.fighters) { const dd = Math.hypot(c.local.x - f.x, c.local.y - f.y); if (dd < (f.radius || 75) * 1.1 && !g0.onFighters.includes(f.name)) g0.onFighters.push(f.name); }
      groups.get(key).count++;
    }
    const all = [...groups.values()].sort((a, b) => a.localOffset - b.localOffset);
    return {
      totalCalls: rec.length,
      fighters: window.fighters.map((f) => ({ name: f.name, x: f.x, y: f.y, radius: f.radius })),
      allGroups: all,
      underlayCandidates: all.filter((c) => c.onFighters.length > 0),
    };
  }, process.env.APEX_PROBE_ENEMY || 'MIRROR');
} finally {
  await browser.close();
}

const dest = path.resolve('docs/hero-rework/magnet-v1/evidence/ground-circle-provenance.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ errors, ...out }, null, 2));
console.log(JSON.stringify({ errors, totalCalls: out.totalCalls, fighters: out.fighters, unwantedUnderlayGroups: out.underlayCandidates.length }, null, 2));
for (const c of out.allGroups) {
  console.log(`\n[${c.count}x] ${c.op} on=[${c.onFighters}] local=(${c.local.x},${c.local.y}) radii=${JSON.stringify(c.radii)}`);
  console.log(`   style stroke=${c.style.stroke} fill=${c.style.fill} lw=${c.style.lineWidth} a=${c.style.alpha} dash=[${c.style.dash}]`);
  c.stack.slice(0, 5).forEach((l) => console.log('   ' + l));
}

const unwanted = out.underlayCandidates;
console.log(unwanted.length === 0
  ? '\nFIGHTER-UNDERLAY CIRCLE PROBE: PASS (no fighter-centred underlay arc/ellipse)'
  : `\nFIGHTER-UNDERLAY CIRCLE PROBE: ${unwanted.length} underlay group(s) present on ${[...new Set(unwanted.flatMap((u) => u.onFighters))].join(', ')}`);
process.exit(unwanted.length === 0 ? 0 : 1);
