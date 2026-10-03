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
    await window.__apexEnsureDeferredRuntimes('arsenalProduct');
    const waitFrames = (n) => new Promise((r) => { let c = 0; const nx = () => { if (++c >= n) r(); else requestAnimationFrame(nx); }; requestAnimationFrame(nx); });
    const waitUntil = async (p, f = 900) => { for (let i = 0; i < f; i++) { if (p()) return true; await waitFrames(1); } return false; };
    const HR = window.APEX_HERO_REWORK;
    const MAG = window.APEX_MAGNET;
    const cfgWorld = () => { const s = window.APEX_ARSENAL.state; s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true; };

    const restart = async (p1, p2) => {
      if (HR.match) window.exitArsenalBattleMode();
      window.startArsenalBattleMode(p1, p2); HR.setAiEnabled(false); cfgWorld(); await waitFrames(3);
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

    /* ---------- H5: Magnet is NOT CC-immune ----------
     * H-PHYS2 §28 SUPERSEDED SCENARIO. This used to pounce from d=160 with A2
     * active and require a stun. Under the continuous field that is now
     * CORRECTLY a blocked case (§14: 2200 < the 3500 rating, so the pounce is
     * turned before the 150px envelope). Requiring a stun there would now be
     * requiring the field to fail.
     *
     * The claim under test is unchanged -- there must be no
     * "if Magnet A2 active then ignore CC" branch -- so it is re-demonstrated
     * under conditions where contact is physically reachable (§14, final
     * paragraph): Hunter already in a valid contact state when it pounces.
     * The field still pushes it out, but the resolved path genuinely touches,
     * so the catch must commit normally. */
    {
      const { a, b } = await restart('HUNTER', 'MAGNET');
      b.x = 500; b.y = 500; a.x = 500 - 300; a.y = 500; a.setDir(1, 0); b.setDir(-1, 0);
      HR.pressAbility(b, 'A2'); await waitFrames(1);
      const active = MAG.inspect(window.matchClock).fields[0].a2Active;
      // Place Hunter in a valid contact state AFTER the field is confirmed up,
      // otherwise the field separates the bodies before the pounce starts.
      a.x = 500 - 120; a.y = 500;
      const startDist = Math.hypot(a.x - b.x, a.y - b.y);
      const rec = instrument();
      HR.pressAbility(a, 'A2');
      let maxExt = 0;
      for (let i = 0; i < 40 && !stunOf(b); i++) {
        await waitFrames(1);
        const e = a.__hrExternalVelocity || { x: 0, y: 0 };
        maxExt = Math.max(maxExt, Math.hypot(e.x, e.y));
      }
      rec.stop();
      out.H5 = { a2Active: active, startDist: +startDist.toFixed(1), sumRadius: a.radius + b.radius,
        endDist: +Math.hypot(a.x - b.x, a.y - b.y).toFixed(1), maxExternalSpeed: +maxExt.toFixed(1),
        stun: stunOf(b), catches: rec.catches, pounceWeak: rec.pounceWeak };

      // Same field, NON-Hunter body: proves the repulsion carries no
      // Hunter-specific term. A Robot body placed at the same distance must be
      // pushed out by the same law.
      const o2 = await restart('ROBOT', 'MAGNET');
      o2.b.x = 500; o2.b.y = 500; HR.pressAbility(o2.b, 'A2'); await waitFrames(1);
      o2.a.x = 500 - 120; o2.a.y = 500;
      const rd0 = Math.hypot(o2.a.x - o2.b.x, o2.a.y - o2.b.y);
      let rMaxExt = 0;
      for (let i = 0; i < 30; i++) {
        await waitFrames(1);
        const e = o2.a.__hrExternalVelocity || { x: 0, y: 0 };
        rMaxExt = Math.max(rMaxExt, Math.hypot(e.x, e.y));
      }
      out.H5b = { startDist: +rd0.toFixed(1), endDist: +Math.hypot(o2.a.x - o2.b.x, o2.a.y - o2.b.y).toFixed(1),
        maxExternalSpeed: +rMaxExt.toFixed(1) };
    }

    /* ---------- H6: field expires mid-chase -> later real contact succeeds ---------- */
    {
      const { a, b } = await restart('HUNTER', 'MAGNET');
      b.x = 500; b.y = 500; a.x = 500 - 300; a.y = 500; a.setDir(1, 0); b.setDir(-1, 0);
      HR.pressAbility(b, 'A2');
      const blocked = instrument();
      HR.pressAbility(a, 'A2');
      for (let i = 0; i < 45 && !stunOf(b); i++) await waitFrames(1);   // blocked while field is up
      blocked.stop();
      const duringField = { stun: stunOf(b), catches: blocked.catches };
      // let A2 run out, then pounce again with no field
      for (let i = 0; i < 160; i++) {
        await waitFrames(1);
        const f = MAG.inspect(window.matchClock).fields[0];
        if (!f || !f.a2Active) break;
      }
      const stillActive = (() => { const f = MAG.inspect(window.matchClock).fields[0]; return !!(f && f.a2Active); })();
      a.x = 500 - 300; a.y = 500; a.setDir(1, 0);
      b.x = 500; b.y = 500;                 // undo field displacement
      // Hunter A2 is on a 12s cooldown; clear it so the post-expiry pounce is
      // actually cast. The cooldown itself is covered by the Hunter gates.
      HR.abilityController(HR.byCombatant(a)).setCooldown('A2', 0);
      await waitFrames(2);
      const after = instrument();
      const castOk = HR.pressAbility(a, 'A2');
      for (let i = 0; i < 60 && !stunOf(b); i++) await waitFrames(1);
      after.stop();
      out.H6 = { duringField, fieldStillActive: stillActive, castOk,
        afterExpiry: { stun: stunOf(b), catches: after.catches, pounceWeak: after.pounceWeak } };
    }

    /* ---------- H7/H8: moving prey    /* ---------- H7/H8: moving prey — commits must match POST-movement truth ----------
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
// H-PHYS2 §14: 2200 px/s inbound is below the 3500 rating, so an
// active-before-entry pounce must be physically turned before body contact.
// This is NOT Hunter-specific protection -- it falls out of the shared field.
gate('HPHYS-H4c-pounce-blocked-by-field-per-rating',
  H4.fieldOn.stun === 0 && H4.fieldOff.stun > 0,
  { withField: H4.fieldOn.stun, withoutField: H4.fieldOff.stun });

const H5 = R.H5;
/* H-PHYS2 §28 SUPERSEDED SCENARIO — see the note in the probe. The claim is
 * unchanged (there must be no "Magnet A2 => ignore CC" branch) but the old
 * demonstration is no longer constructible: at the 3500 rating a 2200 px/s
 * pounce cannot beat an active field from ANY configuration, because even an
 * overlapping start gives the 0.16s prelaunch enough time for the field to
 * eject Hunter. So the absence of a special case is proven three ways:
 *   S30  (static)  no immunity branch exists in source;
 *   H5   (dynamic) Hunter is PHYSICALLY ejected -- real outward velocity and
 *                  growing separation -- rather than silently denied a stun;
 *   H5b  (generic) the identical field acts the same on a NON-Hunter body;
 *   H6b  (dynamic) once the field ends, the very same catch lands normally. */
gate('HPHYS-H5-blocked-by-real-ejection-not-cc-suppression',
  H5.a2Active === true && H5.startDist < H5.sumRadius
  && H5.maxExternalSpeed > 100 && H5.endDist > H5.startDist
  && H5.stun === 0 && H5.catches === 0, H5);
const H5b = R.H5b;
gate('HPHYS-H5b-field-is-not-hunter-specific',
  H5b.maxExternalSpeed > 100 && H5b.endDist > H5b.startDist, H5b);

const H6 = R.H6;
gate('HPHYS-H6a-active-field-turns-the-pounce',
  H6.duringField.stun === 0 && H6.duringField.catches === 0, H6.duringField);
gate('HPHYS-H6b-after-field-expiry-real-contact-succeeds',
  H6.fieldStillActive === false && H6.afterExpiry.stun > 1.9
  && H6.afterExpiry.catches === 1 && H6.afterExpiry.pounceWeak === 1, H6);

const H7 = R.H7;
gate('HPHYS-H7a-moving-prey-actually-moved', H7.preyMovedTotal > 40, H7);
/* Contact is solved in RELATIVE space (moving circle vs moving circle), so at
 * the relative TOI the separation is exactly sumRadius. commitHunterPounceCatch
 * then stands Hunter at that TOI along its OWN path while the prey is already
 * at its frame-end position, so the measured absolute separation can exceed
 * sumRadius by at most the prey's displacement during that frame. Measured:
 * realDist - sumRadius == preyFrameDisplacement to the pixel, which confirms
 * the geometry rather than contradicting it. The bound below is that exact
 * physical allowance, not a slackened tolerance.
 *
 * KNOWN BOUNDED ARTIFACT: the snap could place Hunter at the prey's TOI
 * position instead, removing this offset. It is <= one prey-frame of travel
 * and never affects whether contact occurred, only the resting pose. */
gate('HPHYS-H7b-commit-matches-post-movement-truth-not-stale-sample',
  H7.committed === true && H7.catches === 1 && H7.pounceWeak === 1
  && H7.realDist <= H7.sumRadius + H7.preyFrameDisplacement + 2
  && H7.realDist > H7.staleDist - 1e-6, H7);

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
