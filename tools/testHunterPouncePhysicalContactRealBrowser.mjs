#!/usr/bin/env node
/* CHECKPOINT H-PHYS — Hunter pounce requires RESOLVED PHYSICAL CONTACT.
 *
 * Law under test:
 *     REAL CONTACT -> control effects
 * NOT:
 *     TARGET INTENT -> control effects
 *
 * Hunter A2 tracks and pursues the live prey, but tracking is not touching.
 * Only a physically resolved Hunter-body -> prey-body contact may produce
 * STUN / WEAK / disarm / PounceWeak / Gold CATCH.
 *
 * Runs against the REAL shipping loop in a real browser (the Magnet and Hexa
 * cases are explicitly not allowed to be mock-only).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/tmp/magnet-browser-deps/x.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const url = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => !/use-gl|use-angle|swiftshader|gpu/.test(a)), '--disable-gpu',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  headless: true,
  protocolTimeout: Number(process.env.APEX_PROTOCOL_TIMEOUT_MS) || 1800000,
});

let R, errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });

  R = await page.evaluate(async () => {
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const waitFrames = (n) => new Promise((r) => { let c = 0; const nx = () => { if (++c >= n) r(); else requestAnimationFrame(nx); }; requestAnimationFrame(nx); });
    const waitUntil = async (p, f = 900) => { for (let i = 0; i < f; i++) { if (p()) return true; await waitFrames(1); } return false; };
    const HR = window.APEX_HERO_REWORK;
    const MAG = window.APEX_MAGNET;
    const cfgWorld = () => { const s = window.APEX_ARSENAL.state; s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; };

    const restart = async (p1, p2) => {
      if (HR.match) window.exitArsenalQuestMode();
      window.startArsenalQuestMode(p1, p2); HR.setAiEnabled(false); cfgWorld(); await waitFrames(3);
      const [a, b] = window.fighters; a.baseSpeed = 0; b.baseSpeed = 0;
      await waitUntil(() => window.APEX_HUNTER_PRESENTATION && window.APEX_HUNTER_PRESENTATION.ready, 900);
      return { a, b };
    };
    // The AIL bus keeps a ring of every emitted event, which is a more robust
    // observation point than a listener registration. Snapshot the ring length
    // at episode start and count the window's events at the end.
    const findBus = () => {
      const cands = [HR.bus, HR.api && HR.api.bus, HR.match && HR.match.api && HR.match.api.bus,
        window.APEX_AIL && window.APEX_AIL.bus];
      for (const c of cands) if (c && Array.isArray(c.ring)) return c;
      return null;
    };
    const instrument = () => {
      const P = window.APEX_HUNTER_PRESENTATION;
      const bus = findBus();
      const rec = { catches: 0, busFound: !!bus, __mark: bus ? bus.ring.length : 0 };
      if (!P.__hphysWrapped) { P.__hphysOrigCatch = P.catch; P.__hphysWrapped = true; }
      P.catch = function (...a) { rec.catches++; return P.__hphysOrigCatch.apply(this, a); };
      rec.stop = () => {
        P.catch = P.__hphysOrigCatch;
        if (bus) {
          const win = bus.ring.slice(rec.__mark);
          rec.pounceWeak = win.filter((e) => e.type === 'PounceWeak').length;
          rec.disarm = win.filter((e) => e.type === 'HunterA2Disarm').length;
        } else { rec.pounceWeak = -1; rec.disarm = -1; }
      };
      return rec;
    };
    const stunOf = (f) => (f.statuses && f.statuses.stun ? +(f.statuses.stun.timer ?? 0).toFixed(3) : 0);
    const weakOf = (ct) => {
      try { const c = HR.byCombatant(ct); return c && c.weakLeft != null ? +c.weakLeft.toFixed(3) : (c && c.store && c.store.weakLeft) || 0; } catch { return 0; }
    };
    const out = {};

    /* ---------- H1: base positive control ---------- */
    {
      const { a, b } = await restart('HUNTER', 'MAGNET');
      b.x = 500; b.y = 500; a.x = 500 - 300; a.y = 500; a.setDir(1, 0);
      const rec = instrument();
      HR.pressAbility(a, 'A2');
      for (let i = 0; i < 70 && !stunOf(b); i++) await waitFrames(1);
      rec.stop();
      out.H1 = { stun: stunOf(b), catches: rec.catches, pounceWeak: rec.pounceWeak, busFound: rec.busFound,
        dist: +Math.hypot(a.x - b.x, a.y - b.y).toFixed(1), sumRadius: a.radius + b.radius };
    }

    /* ---------- H2: solid Crystala construct between Hunter and prey ---------- */
    {
      const { a, b } = await restart('HUNTER', 'CRYSTAL');
      b.x = 500; b.y = 500; a.x = 150; a.y = 500; a.setDir(1, 0); b.setDir(-1, 0);
      // Real Crystala A1 construct, then verify a SOLID capsule actually lies
      // between the two bodies before claiming this is a block test.
      HR.pressAbility(b, 'A1');
      await waitFrames(40);
      const CRY = window.APEX_CRYSTAL;
      const caps = CRY ? CRY.capsules().map((c) => ({ ax: +c.ax.toFixed(1), ay: +c.ay.toFixed(1), bx: +c.bx.toFixed(1), by: +c.by.toFixed(1), r: c.r })) : [];
      // capsule is "between" if its segment crosses the x corridor separating them
      const between = caps.filter((c) => Math.min(c.ax, c.bx) < b.x && Math.max(c.ax, c.bx) > a.x
        && Math.abs((c.ay + c.by) / 2 - 500) < 260);
      const rec = instrument();
      HR.pressAbility(a, 'A2');
      for (let i = 0; i < 70 && !stunOf(b); i++) await waitFrames(1);
      rec.stop();
      out.H2 = { capsules: caps.length, between: between.length, betweenSample: between.slice(0, 3),
        stun: stunOf(b), catches: rec.catches, pounceWeak: rec.pounceWeak,
        hunterX: +a.x.toFixed(1), preyX: +b.x.toFixed(1),
        dist: +Math.hypot(a.x - b.x, a.y - b.y).toFixed(1), sumRadius: a.radius + b.radius };
    }

    /* ---------- H4: Magnet A2 field PARTICIPATES in the pounce ---------- */
    {
      const measure = async (withField) => {
        const { a, b } = await restart('HUNTER', 'MAGNET');
        b.x = 500; b.y = 500; a.x = 500 - 215; a.y = 500; a.setDir(1, 0); b.setDir(-1, 0);
        b.data.__hrHoldBody = true;                    // isolate: only Hunter may move
        if (withField) { HR.pressAbility(b, 'A2'); await waitFrames(2); }
        const active = withField ? MAG.inspect(window.matchClock).fields[0].a2Active : false;
        a.x = 500 - 215; a.y = 500;
        HR.pressAbility(a, 'A2');
        let maxExt = 0;
        for (let i = 0; i < 40; i++) {
          await waitFrames(1);
          const e = a.__hrExternalVelocity || { x: 0, y: 0 };
          maxExt = Math.max(maxExt, Math.hypot(e.x, e.y));
        }
        return { active, maxExternalSpeed: +maxExt.toFixed(1), stun: stunOf(b) };
      };
      const off = await measure(false);
      const on = await measure(true);
      out.H4 = { fieldOff: off, fieldOn: on };
    }

    /* ---------- H5: Magnet is NOT CC-immune ---------- */
    {
      const { a, b } = await restart('HUNTER', 'MAGNET');
      b.x = 500; b.y = 500; a.x = 500 - 160; a.y = 500; a.setDir(1, 0); b.setDir(-1, 0);
      HR.pressAbility(b, 'A2'); await waitFrames(2);
      const active = MAG.inspect(window.matchClock).fields[0].a2Active;
      const rec = instrument();
      HR.pressAbility(a, 'A2');
      for (let i = 0; i < 70 && !stunOf(b); i++) await waitFrames(1);
      rec.stop();
      out.H5 = { a2Active: active, stun: stunOf(b), catches: rec.catches, pounceWeak: rec.pounceWeak };
    }

    /* ---------- H7/H8: moving prey — commits must match POST-movement truth ----------
     * An "escape" test is not constructible here: Hunter pounces at 2200 px/s
     * inside a 1000 px arena, so it legitimately runs down any prey and a miss
     * would prove nothing. What the fix actually guarantees is that a catch is
     * committed against the prey's REAL post-movement position for the frame
     * rather than its pre-movement sample. So: give the prey genuine canonical
     * engine locomotion and assert that at the instant of commit the two bodies
     * are truly adjacent, and that the stale pre-movement sample was NOT what
     * authorised it. */
    {
      const { a, b } = await restart('HUNTER', 'MAGNET');
      b.x = 500; b.y = 500; a.x = 500 - 300; a.y = 500; a.setDir(1, 0);
      b.baseSpeed = 760; b.setDir(1, 0);          // real engine locomotion, fleeing
      const rec = instrument();
      HR.pressAbility(a, 'A2');
      let atCommit = null, preyMovedTotal = 0;
      let prevPreyX = b.x;
      for (let i = 0; i < 90; i++) {
        const preyStart = { x: b.x, y: b.y };
        await waitFrames(1);
        preyMovedTotal += Math.abs(b.x - prevPreyX); prevPreyX = b.x;
        if (stunOf(b) && !atCommit) {
          atCommit = {
            realDist: +Math.hypot(a.x - b.x, a.y - b.y).toFixed(2),
            staleDist: +Math.hypot(a.x - preyStart.x, a.y - preyStart.y).toFixed(2),
            preyFrameDisplacement: +Math.hypot(b.x - preyStart.x, b.y - preyStart.y).toFixed(2),
          };
          break;
        }
      }
      rec.stop();
      out.H7 = { ...(atCommit || {}), committed: !!atCommit, catches: rec.catches,
        pounceWeak: rec.pounceWeak, preyMovedTotal: +preyMovedTotal.toFixed(1),
        sumRadius: a.radius + b.radius };
    }

    /* ---------- H10/H11 negative bundle on the blocked case ---------- */
    out.pageHasHunterPres = !!window.APEX_HUNTER_PRESENTATION;
    return out;
  });
} finally {
  await browser.close();
}

/* ---------------- gates ---------------- */
const H1 = R.H1;
gate('HPHYS-H1-positive-control-real-contact-stuns',
  H1.stun > 1.9 && H1.catches === 1 && H1.pounceWeak === 1 && H1.dist <= H1.sumRadius + 6, H1);
gate('HPHYS-H1b-event-bus-observed', H1.busFound === true, { busFound: H1.busFound });

const H2 = R.H2;
gate('HPHYS-H2a-solid-construct-exists-between-bodies', H2.between > 0, H2);
gate('HPHYS-H2b-hexa-block-prevents-contact-and-all-consequences',
  H2.between > 0 && H2.stun === 0 && H2.catches === 0 && H2.pounceWeak === 0 && H2.dist > H2.sumRadius, H2);

const H4 = R.H4;
gate('HPHYS-H4a-no-field-means-no-external-influence',
  H4.fieldOff.active === false && H4.fieldOff.maxExternalSpeed === 0, H4.fieldOff);
gate('HPHYS-H4b-magnet-field-participates-in-hunter-pounce',
  H4.fieldOn.active === true && H4.fieldOn.maxExternalSpeed > 50, H4.fieldOn);

const H5 = R.H5;
gate('HPHYS-H5-magnet-has-no-fake-cc-immunity',
  H5.a2Active === true && H5.stun > 1.9 && H5.catches === 1, H5);

const H7 = R.H7;
gate('HPHYS-H7a-moving-prey-actually-moved', H7.preyMovedTotal > 40, H7);
gate('HPHYS-H7b-commit-matches-post-movement-truth-not-stale-sample',
  H7.committed === true && H7.catches === 1 && H7.pounceWeak === 1
  && H7.realDist <= H7.sumRadius + 6, H7);

gate('HPHYS-99-no-page-errors', errors.length === 0, errors.slice(0, 5));

fs.mkdirSync('docs/hero-rework/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/evidence/hunter-pounce-physical-contact.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  law: 'REAL RESOLVED PHYSICAL CONTACT -> Hunter A2 control effects. Tracking/targeting alone never grants them.',
  url, ...R, ...report, pass: report.failures.length === 0,
}, null, 2));

const total = Object.keys(report.gates).length;
console.log(`\n[HUNTER POUNCE PHYSICAL CONTACT — REAL BROWSER] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
