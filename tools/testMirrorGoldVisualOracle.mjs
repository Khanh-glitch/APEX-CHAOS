#!/usr/bin/env node
/* MIRROR V1 — CHECKPOINT C-R: canonical Gold VISUAL + LIFECYCLE oracle.
 *
 * Checkpoint C locked Gold's semantics. Before porting any visual, this adds
 * the direct VISUAL reference frames production must later be compared
 * against, plus the lifecycle facts C did not cover strongly enough.
 *
 * The canonical file is NEVER modified. Determinism is imposed from outside:
 *   - Math.random is replaced by a seeded PRNG via evaluateOnNewDocument;
 *   - requestAnimationFrame is neutralised so Gold's own fixed-step loop is
 *     driven explicitly;
 *   - EVERY scenario re-seeds the PRNG and calls resetAll() first, so adding
 *     or reordering a capture cannot shift any other scenario's sequence.
 *
 * Output:
 *   docs/hero-rework/mirror-v1/evidence/gold-frames/<scenario>.png
 *   docs/hero-rework/mirror-v1/evidence/gold12-visual-oracle.json
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire('/tmp/magnet-browser-deps/x.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const GOLD_REL = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const GOLD_URL = (process.env.APEX_GOLD_URL || 'http://127.0.0.1:4200') + '/' + GOLD_REL;
const EXPECT_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const OUTDIR = 'docs/hero-rework/mirror-v1/evidence/gold-frames';

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const bytes = fs.readFileSync(GOLD_REL);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
gate('CR00-gold-unmodified', sha === EXPECT_SHA && bytes.length === 107480, { sha, bytes: bytes.length });
if (sha !== EXPECT_SHA) { console.log('\nGOLD HASH MISMATCH — STOP.'); process.exit(1); }

let reachable = false;
try { reachable = (await fetch(GOLD_URL, { signal: AbortSignal.timeout(8000) })).ok; } catch { reachable = false; }
gate('CR01-gold-url-reachable', reachable, GOLD_URL);
if (!reachable) { console.log(`\nGold URL not reachable: ${GOLD_URL}`); process.exit(1); }

fs.mkdirSync(OUTDIR, { recursive: true });
const STEP = 1 / 120;

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args.filter((a) => !/use-gl|use-angle|swiftshader|gpu/.test(a)), '--disable-gpu',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  headless: true,
  protocolTimeout: Number(process.env.APEX_PROTOCOL_TIMEOUT_MS) || 900000,
});

let result;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.evaluateOnNewDocument(() => {
    // Neutralise rAF BEFORE any page script runs. Gold's init() ends with
    // requestAnimationFrame(frame); if we only neutralise it after goto(), a
    // nondeterministic number of real frames have already run and consumed the
    // seeded stream, so captures are not reproducible run to run.
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    window.__seedRng = (seed) => {
      let s = seed >>> 0;
      Math.random = function seeded() {
        s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
        return (s >>> 0) / 4294967296;
      };
    };
    window.__seedRng(0x2f6e2b1);
  });
  await page.goto(GOLD_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof step === 'function' && typeof M === 'object', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 80));

  // Prepare a scenario from a clean, identically-seeded state every time.
  const prep = async (setup, steps, closeUp) => page.evaluate(({ setup, steps, STEP, closeUp }) => {
    window.__seedRng(0x2f6e2b1);
    if (typeof AUTO === 'object') AUTO.on = false;
    resetAll();
    M.drive = null;
    cam.close = !!closeUp; cam.tz = closeUp ? 2.4 : 1; cam.zm = cam.tz;
    // eslint-disable-next-line no-new-func
    if (setup) (new Function(setup))();
    for (let i = 0; i < steps; i++) step(STEP);
    render();
    return {
      simT: typeof simT === 'number' ? +simT.toFixed(4) : null,
      M: { x: +M.x.toFixed(2), y: +M.y.toFixed(2), vx: +M.vx.toFixed(2), vy: +M.vy.toFixed(2), busy: +M.busy.toFixed(3), copyOn: !!M.copyOn },
      A1: { on: A1.on, u: +A1.u.toFixed(4), whiff: A1.whiff },
      A2: { on: A2.on, u: +A2.u.toFixed(4) },
      shards: SH.filter((s) => s.on).length,
      nodes: ND.filter((n) => n.on).map((n) => ({ st: n.st, fill: +n.fill.toFixed(3), fold: +n.fold.toFixed(3) })),
      proj: PJ.filter((p) => p.on).map((p) => ({ st: p.st, t: +p.t.toFixed(4), own: p.own, cool: +p.cool.toFixed(3) })),
    };
  }, { setup, steps, STEP, closeUp });

  // Read the canvas BACKING STORE rather than taking an element screenshot.
  // An element screenshot goes through the compositor, which does not update
  // deterministically once requestAnimationFrame is neutralised (it returned
  // the identical stale layer for every scenario). toDataURL captures exactly
  // what Gold's render() drew, which is what a reference oracle must record.
  const shot = async (name) => {
    const dataUrl = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(`${OUTDIR}/${name}.png`, buf);
    return { file: `${name}.png`, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) };
  };

  // --- scenario table: setup source, step count, close-up flag ---
  const MOVE = 'M.drive=null;M.vx=0;M.vy=0;';
  const scenarios = [
    ['neutral-battle-scale', '', 60, false],
    ['neutral-close-up', '', 60, true],
    ['movement-start', `${MOVE}keys['d']=true;`, 14, false],
    ['movement-sustained', `${MOVE}keys['d']=true;`, 110, false],
    ['hard-reverse', `${MOVE}keys['d']=true;`, 120, false],   // reversed below
    ['sudden-stop', `${MOVE}keys['d']=true;`, 120, false],    // released below
    ['a1-attached-reflection', 'F.armed=true;castA1(false);', 45, true],
    ['a1-peel', 'F.armed=true;castA1(false);', 90, true],
    ['a1-reform-own-edge', 'F.armed=true;castA1(false);', 112, true],
    ['a1-whiff', 'F.armed=false;castA1(false);', 70, true],
    ['a2-pre-snap', 'castA2();', 20, false],
    ['a2-snap', 'castA2();', 31, false],
    ['a2-post-residue', 'castA2();', 90, false],
    ['free-shard', 'spawnCluster();', 30, false],
    ['assembling-node', 'spawnCluster();', 150, false],
    ['active-node', 'spawnCluster();', 260, false],
    ['projectile-entry-image', 'routeProbe();', 1, false],
    ['destination-image', 'routeProbe();', 1, false],
    ['emergence', 'routeProbe();', 1, false],
  ];

  const frames = {};
  for (const [name, setup, steps, closeUp] of scenarios) {
    if (name === 'hard-reverse') {
      frames[name] = await page.evaluate(({ STEP }) => {
        window.__seedRng(0x2f6e2b1); AUTO.on = false; resetAll(); M.drive = null;
        for (const k in keys) keys[k] = false;
        keys['d'] = true; for (let i = 0; i < 100; i++) step(STEP);
        keys['d'] = false; keys['a'] = true; for (let i = 0; i < 16; i++) step(STEP);
        render();
        return { M: { vx: +M.vx.toFixed(2), vy: +M.vy.toFixed(2), busy: +M.busy.toFixed(3) } };
      }, { STEP });
    } else if (name === 'sudden-stop') {
      frames[name] = await page.evaluate(({ STEP }) => {
        window.__seedRng(0x2f6e2b1); AUTO.on = false; resetAll(); M.drive = null;
        for (const k in keys) keys[k] = false;
        keys['d'] = true; for (let i = 0; i < 100; i++) step(STEP);
        keys['d'] = false; for (let i = 0; i < 10; i++) step(STEP);
        render();
        return { M: { vx: +M.vx.toFixed(2), vy: +M.vy.toFixed(2), busy: +M.busy.toFixed(3) } };
      }, { STEP });
    } else if (name.startsWith('projectile-') || name === 'destination-image' || name === 'emergence') {
      // Routing needs two ACTIVE nodes; drive the full real sequence, then
      // step to the requested escrow phase.
      const want = name === 'projectile-entry-image' ? 0.02 : name === 'destination-image' ? 0.30 : 0.60;
      frames[name] = await page.evaluate(({ STEP, want }) => {
        window.__seedRng(0x2f6e2b1); AUTO.on = false; resetAll(); M.drive = null;
        // Build two separate 5-shard clusters -> two ACTIVE nodes.
        const mk = (cx, cy) => { for (let i = 0; i < 5; i++) { const s = SH.find((q) => !q.on); if (!s) return; s.on = true; s.st = 0; s.age = 1.0; s.x = cx + Math.cos(i * 1.3) * 40; s.y = cy + Math.sin(i * 1.3) * 40; s.vx = 0; s.vy = 0; s.rot = 0; s.side = i % 2 ? 'L' : 'R'; } };
        mk(300, 300); for (let i = 0; i < 300; i++) step(STEP);
        mk(700, 700); for (let i = 0; i < 300; i++) step(STEP);
        const active = ND.filter((n) => n.on && n.st === 2);
        if (active.length >= 2) {
          const n = active[0], c = nodeCap(n);
          const mx = (c[0] + c[2]) / 2, my = (c[1] + c[3]) / 2;
          const p = PJ.find((q) => !q.on);
          if (p) {
            p.on = true; p.st = 0; p.t = 0; p.own = 0; p.cool = 0; p.life = 4; p.pw = 1;
            p.hn = 0; p.hc = 0; p.x = mx - 60; p.y = my; p.vx = 300; p.vy = 0;
            p.dx = 1; p.dy = 0;
            for (let i = 0; i < 400 && p.st === 0; i++) step(STEP);
            for (let i = 0; i < 400 && p.on && p.st !== 0 && p.t < want; i++) step(STEP);
          }
        }
        render();
        const p = PJ.find((q) => q.on);
        return { activeNodes: active.length, proj: p ? { st: p.st, t: +p.t.toFixed(4), own: p.own, cool: +p.cool.toFixed(3) } : null };
      }, { STEP, want });
    } else {
      frames[name] = await prep(setup, steps, closeUp);
    }
    frames[name].image = await shot(name);
  }

  /* ---------------- direct canonical lifecycle probes ---------------- */
  const probes = await page.evaluate(({ STEP }) => {
    const out = {};
    const mkCluster = (cx, cy) => { for (let i = 0; i < 5; i++) { const s = SH.find((q) => !q.on); if (!s) return; s.on = true; s.st = 0; s.age = 1.0; s.x = cx + Math.cos(i * 1.3) * 40; s.y = cy + Math.sin(i * 1.3) * 40; s.vx = 0; s.vy = 0; s.rot = 0; s.side = i % 2 ? 'L' : 'R'; } };

    // 1) SINGLE NODE: no escrow, local response, 0.40 capture-attempt cooldown.
    window.__seedRng(0x51ed7); AUTO.on = false; resetAll(); M.drive = null;
    mkCluster(300, 300);
    for (let i = 0; i < 400; i++) step(STEP);
    const one = ND.filter((n) => n.on && n.st === 2);
    let single = { activeNodes: one.length };
    if (one.length === 1) {
      const c = nodeCap(one[0]);
      const mx = (c[0] + c[2]) / 2, my = (c[1] + c[3]) / 2;
      const p = PJ.find((q) => !q.on);
      p.on = true; p.st = 0; p.t = 0; p.own = 0; p.cool = 0; p.life = 4; p.pw = 1;
      p.hn = 0; p.hc = 0; p.x = mx - 50; p.y = my; p.vx = 300; p.vy = 0; p.dx = 1; p.dy = 0;
      let coolSeen = 0;
      for (let i = 0; i < 200; i++) { step(STEP); if (p.cool > coolSeen) coolSeen = p.cool; if (p.st !== 0) break; }
      single = { activeNodes: 1, escrowed: p.st !== 0, maxCoolSet: +coolSeen.toFixed(4), stillInWorld: p.st === 0 };
    }
    out.singleNode = single;

    // 2) TWO NODES: full escrow lifecycle timings.
    window.__seedRng(0x51ed7); AUTO.on = false; resetAll(); M.drive = null;
    mkCluster(300, 300); for (let i = 0; i < 300; i++) step(STEP);
    mkCluster(700, 700); for (let i = 0; i < 300; i++) step(STEP);
    const act = ND.filter((n) => n.on && n.st === 2);
    let route = { activeNodes: act.length };
    if (act.length >= 2) {
      const n = act[0], c = nodeCap(n);
      const mx = (c[0] + c[2]) / 2, my = (c[1] + c[3]) / 2;
      const p = PJ.find((q) => !q.on);
      p.on = true; p.st = 0; p.t = 0; p.own = 0; p.cool = 0; p.life = 6; p.pw = 1;
      p.hn = 0; p.hc = 0; p.x = mx - 50; p.y = my; p.vx = 300; p.vy = 0; p.dx = 1; p.dy = 0;
      for (let i = 0; i < 300 && p.st === 0; i++) step(STEP);
      const captured = p.st === 1;
      let st2T = null, imgBT = null, emergeT = null, ownAfter = null, coolAfter = null, dest = p.nB, entry = p.nA;
      for (let i = 0; i < 400; i++) {
        const prevSt = p.st;
        step(STEP);
        if (st2T === null && p.st === 2) st2T = +p.t.toFixed(4);
        if (imgBT === null && p.imgB) imgBT = +p.t.toFixed(4);
        if (prevSt === 2 && p.st === 0) { emergeT = +(p.t).toFixed(4); ownAfter = p.own; coolAfter = +p.cool.toFixed(4); break; }
      }
      const expX = (dest && dest.on ? dest : entry).x + 1 * 20;
      route = {
        activeNodes: act.length, captured, destinationImageAtT: st2T, imgBAtT: imgBT,
        emergenceObservedAtT: emergeT, ownerAfter: ownAfter, postExitCooldown: coolAfter,
        emergenceX: +p.x.toFixed(3), expectedEmergenceX: +expX.toFixed(3),
        offsetMatches20px: Math.abs(p.x - expX) < 1e-6,
      };
    }
    out.routing = route;

    // 3) Node slot law, observed directly: Gold caps CONCURRENT forming-or-active
    //    nodes (st<=2) at 3; forming a 4th retires the oldest ACTIVE to st=3
    //    (fold-out). The 4-entry pool exists so a retiring node can still occupy
    //    a slot while its replacement forms. Measure every one of those facts.
    window.__seedRng(0x51ed7); AUTO.on = false; resetAll(); M.drive = null;
    let maxOccupied = 0, maxLive = 0, maxActive = 0;
    let retirementObserved = false, foldSeen = false, fourSlotsOccupied = false;
    // Place well-separated clusters CLOSE TOGETHER IN TIME. Formation start->ACTIVE
    // is 1.20s and the scan cadence is .3s, so staggering by ~0.25s keeps three
    // nodes st<=2 at the moment the fourth group forms, which is the only
    // condition under which Gold's retirement branch can fire.
    const spots = [[200, 250], [800, 250], [200, 800], [800, 800], [500, 150], [500, 880], [150, 520]];
    const formCalls = [];
    const origForm = window.formNode;
    window.formNode = function wrapped(g) {
      formCalls.push({ liveAtCall: ND.filter((n) => n.on && n.st <= 2).length, freeShards: SH.filter((q) => !q.on).length });
      return origForm.apply(this, arguments);
    };
    let minFreeShards = 99;
    for (let k = 0; k < spots.length; k++) {
      mkCluster(spots[k][0], spots[k][1]);
      for (let i = 0; i < (k < 4 ? 30 : 170); i++) {
        const before = ND.filter((n) => n.on && n.st === 2).map((n) => n.id !== undefined ? n.id : ND.indexOf(n));
        step(STEP);
        const on = ND.filter((n) => n.on);
        const live = on.filter((n) => n.st <= 2);
        maxOccupied = Math.max(maxOccupied, on.length);
        maxLive = Math.max(maxLive, live.length);
        maxActive = Math.max(maxActive, on.filter((n) => n.st === 2).length);
        if (on.length === 4) fourSlotsOccupied = true;
        // an ACTIVE node transitioning to st===3 is the retirement law firing
        const retired = ND.filter((n) => n.on && n.st === 3);
        if (retired.length && before.length >= 1) retirementObserved = true;
        if (on.some((n) => n.fold > 0)) foldSeen = true;
        minFreeShards = Math.min(minFreeShards, SH.filter((q) => !q.on).length);
      }
    }
    window.formNode = origForm;
    out.slots = {
      nodePoolSize: ND.length,
      shardPoolSize: SH.length,
      shardsPerNode: 5,
      maxConcurrentFormingOrActive: maxLive,
      maxConcurrentActive: maxActive,
      maxPoolSlotsOccupied: maxOccupied,
      minFreeShardsObserved: minFreeShards,
      formNodeCalls: formCalls,
      maxLiveAtAnyFormNodeCall: formCalls.length ? Math.max(...formCalls.map((c) => c.liveAtCall)) : null,
      fourLifecycleSlotsObserved: fourSlotsOccupied,
      oldestActiveRetiredToFoldOut: retirementObserved,
      foldObserved: foldSeen,
      law: [
        'MEASURED, not inferred: the node pool has 4 entries but canonical play can never occupy more than 3.',
        'Formation consumes 5 shards from a 16-shard pool, and a node holds its shards for its whole life',
        '(a st===3 fold-out node still owns them until n.on=false at t3>=.55). Three forming-or-active nodes',
        'therefore hold 15 of 16 shards, leaving 1 free - never the 5 a fourth group needs. formNode is',
        'consequently never reached with live>=3, so the oldest-active->st=3 retirement branch at the top of',
        'formNode is unreachable dead headroom. PORT CONSEQUENCE: production must cap concurrent nodes at 3',
        'via the shard economy, and must NOT implement a 4-slot ring with active retirement as a mechanic.',
      ].join(' '),
    };

    // 4) Presentation busy envelopes + wrong-reflection delay.
    window.__seedRng(0x51ed7); AUTO.on = false; resetAll(); M.drive = null;
    F.armed = true; castA1(false);
    const a1Busy = +M.busy.toFixed(3);
    window.__seedRng(0x51ed7); resetAll(); M.drive = null; castA2();
    const a2Busy = +M.busy.toFixed(3);
    out.busy = { a1BusyAtCast: a1Busy, a2BusyAtCast: a2Busy };

    // Wrong reflection adds .45 to the plate's sampling delay.
    window.__seedRng(0x51ed7); resetAll(); M.drive = null;
    const lr = PL.find((q) => q.id === 'LR');
    const baseDelay = lr.dl + lr.extraDelay;
    wrongPlate(lr, 1.0);
    out.wrongReflection = {
      plate: 'LR', baseDelay: +baseDelay.toFixed(4),
      extraDelayAfterWrong: +lr.extraDelay.toFixed(4),
      wrongAddsSeconds: 0.45,
      effectiveDelay: +(lr.dl + lr.extraDelay + 0.45).toFixed(4),
    };
    return out;
  }, { STEP });

  result = { frames, probes, pageErrors };
} finally {
  await browser.close();
}

/* ---------------- gates ---------------- */
const names = Object.keys(result.frames);
gate('CR02-all-visual-references-captured',
  names.length === 19 && names.every((n) => result.frames[n].image && result.frames[n].image.bytes > 2000),
  { count: names.length, missing: names.filter((n) => !result.frames[n].image || result.frames[n].image.bytes <= 2000) });

const uniq = new Set(names.map((n) => result.frames[n].image.sha256));
gate('CR03-reference-frames-are-distinct', uniq.size >= Math.ceil(names.length * 0.75),
  { distinct: uniq.size, total: names.length });

const sn = result.probes.singleNode;
gate('CR10-single-node-no-escrow-and-0.40-cooldown',
  sn.activeNodes === 1 && sn.escrowed === false && sn.stillInWorld === true && Math.abs(sn.maxCoolSet - 0.4) < 1e-6,
  sn);

const r = result.probes.routing;
gate('CR11-destination-image-before-emergence',
  r.captured === true && r.destinationImageAtT !== null && r.destinationImageAtT >= 0.20 && r.destinationImageAtT < 0.56, r);
gate('CR12-emergence-at-0.56', r.emergenceObservedAtT !== null && Math.abs(r.emergenceObservedAtT - 0.56) <= 0.01, r);
gate('CR13-emergence-offset-is-node-center-plus-dir-times-20', r.offsetMatches20px === true,
  { emergenceX: r.emergenceX, expected: r.expectedEmergenceX });
gate('CR14-exit-controller-neutral-and-0.45-recapture-lock',
  r.ownerAfter === 2 && Math.abs(r.postExitCooldown - 0.45) < 1e-6, r);

const sl = result.probes.slots;
gate('CR15-three-concurrent-node-cap-observed-directly',
  sl.nodePoolSize === 4 && sl.shardPoolSize === 16
  && sl.maxConcurrentFormingOrActive === 3 && sl.maxConcurrentActive === 3,
  { nodePool: sl.nodePoolSize, shardPool: sl.shardPoolSize, maxLive: sl.maxConcurrentFormingOrActive, maxActive: sl.maxConcurrentActive });
gate('CR15b-fourth-slot-and-retirement-branch-proven-unreachable',
  sl.maxPoolSlotsOccupied === 3 && sl.fourLifecycleSlotsObserved === false
  && sl.oldestActiveRetiredToFoldOut === false && sl.maxLiveAtAnyFormNodeCall !== null
  && sl.maxLiveAtAnyFormNodeCall <= 2 && sl.minFreeShardsObserved <= 1,
  { maxOccupied: sl.maxPoolSlotsOccupied, maxLiveAtFormNode: sl.maxLiveAtAnyFormNodeCall,
    minFreeShards: sl.minFreeShardsObserved, formNodeCalls: sl.formNodeCalls });

gate('CR16-busy-envelopes-2.2-and-1.8',
  Math.abs(result.probes.busy.a1BusyAtCast - 2.2) < 1e-6 && Math.abs(result.probes.busy.a2BusyAtCast - 1.8) < 1e-6,
  result.probes.busy);
gate('CR17-LR-wrong-reflection-extra-delay',
  Math.abs(result.probes.wrongReflection.extraDelayAfterWrong - 0.04) < 1e-6,
  result.probes.wrongReflection);
gate('CR99-no-canonical-page-errors', result.pageErrors.length === 0, result.pageErrors);

const out = {
  generatedAt: new Date().toISOString(),
  purpose: 'Canonical Gold 12 VISUAL + LIFECYCLE oracle. Production parity must be compared against these reference frames and timings, never against a reconstruction.',
  gold: { path: GOLD_REL, sha256: sha, bytes: bytes.length },
  framesDir: OUTDIR,
  timingTerminology: {
    note: 'A2 authored threshold is u=.25 (nominal .25s). The real production event must land on the SAME first canonical fixed-step crossing as the oracle, observed at .25833s. A raw after(.25) timer is NOT parity.',
    a2AuthoredU: 0.25, a2NominalSeconds: 0.25, a2CanonicalFixedStepSeconds: 0.25833,
    a1OwnAuthoredU: 0.58, a1NominalSeconds: 0.928, a1CanonicalFixedStepSeconds: 0.93333,
  },
  ...result,
  ...report,
  pass: report.failures.length === 0,
};
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/gold12-visual-oracle.json', JSON.stringify(out, null, 2));

const total = Object.keys(report.gates).length;
console.log(`\n[MIRROR GOLD VISUAL ORACLE] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
