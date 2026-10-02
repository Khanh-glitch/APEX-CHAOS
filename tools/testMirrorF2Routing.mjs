#!/usr/bin/env node
/* CHECKPOINT F2 — MIRROR Gold-first oriented-surface routing / escrow gates.
 *
 * Drives the REAL shipping runtime through the shared harness: real F1
 * per-owner ACTIVE nodes (seeded through the NON-SHIPPING mirrorTestNode
 * seam for exact geometry — the same node shape/lifecycle/routing authority
 * formed nodes use), real production projectile emission (fireBullet /
 * throwGrenade / spawnThrownMelee / TIME replay lineage), the real fixed
 * step, and the real ordered-path / Magnet TOI foundation.
 *
 * Laws under test (doc 08 §7-§9, doc 02 R01-R23, executable Gold CR10-CR14):
 *   eligible families by capability, T6 immune, non-projectiles never routed
 *   swept capsule surface contact on the REAL ordered path (no tunnelling)
 *   preview ~34px never mutates; capture ~17px(+radius)
 *   one node -> WORLD + local response + ~0.40s capture-attempt cooldown
 *   >=2 same-owner ACTIVE nodes -> escrow ACTUAL object, fixed nearest dest
 *   transit edges: image 0.2083 (authored .20), emergence 0.5667 (.56),
 *   canonical FIRST fixed-step crossing (1/120 accumulator law)
 *   emergence = node center + incomingDir*20, px/py reset, NEUTRAL output
 *   life/fuse/thrown timers frozen through escrow, exactly-one-object
 *   lost destination -> captured entry-transform fallback exactly once
 *   ~0.45s recapture lock, then valid routing again; no lastPortalId ever
 *   global TOI ordering vs Magnet (both directions) and body/Crystal
 */
import { bootHarness } from './lib/crystalaHarness.mjs';
import fs from 'node:fs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
const close = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const DT = 1 / 60;
// Canonical Gold edges reproduced through the SAME float-accumulation law
// the production transit uses (1/120 fixed substeps, strict first crossing):
// image at substep 25 = 0.2083..., emergence at substep 68 = 0.5667...
function canonT(nSubsteps) { let t = 0; for (let i = 0; i < nSubsteps; i++) t += 1 / 120; return t; }
const IMG_T = canonT(25);   // ≈ 0.2083 (authored .20)
const EM_T = canonT(68);    // ≈ 0.5667 (authored .56)
const IMG_FRAME = 13;       // first fixed step containing substep 25
const EM_FRAME = 34;        // first fixed step containing substep 68

function start(p1 = 'MIRROR', p2 = 'ROBOT') {
  T.start(p1, p2); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 150; a.y = 500; b.x = 850; b.y = 500;
  return { a, b, ct: HR.byCombatant(a), ctB: HR.byCombatant(b) };
}
function bus() { return HR.bus || (win.APEX_HERO_REWORK_AIL && win.APEX_HERO_REWORK_AIL.bus); }
function captureSeq(types) {
  const b = bus(); const mark = b.seq;
  return () => b.since(mark).filter((e) => types.includes(e.type));
}
const seed = (ct, x, y, rot = 0) => HR.match.api.mirrorTestNode(ct, x, y, rot);
const escrowList = () => ((HR.match && HR.match.world.mirrorF2) || { escrow: [] }).escrow;
const stepFrames = (n) => { for (let i = 0; i < n; i++) win.APEX_ARSENAL.step(DT); };
const W = () => win.APEX_ARSENAL.weaponApi;

/* Real production emission helpers (shipping spawn seams, real payloads).
 * Robust lookup: diff the live array so a fresh entity is returned even if
 * the array identity or contents shifted between harness scenarios. */
function newestAfter(before) {
  for (let i = win.projectiles.length - 1; i >= 0; i--) {
    const q = win.projectiles[i];
    if (q && q.aq && !before.has(q)) return q;
  }
  return null;
}
function emitBullet(o, over) {
  const spec = Object.assign({
    owner: o.b, x: 250, y: 500, angle: 0, speed: 1200, damage: 40,
    weapon: 'GLOCK_17', life: 6,
  }, over || {});
  const before = new Set(win.projectiles);
  W().fireBullet(spec);
  const p = newestAfter(before);
  if (!p) throw new Error('emitBullet: shipping fireBullet pushed no projectile');
  return p;
}
function emitGrenade(o, over) {
  const spec = Object.assign({ owner: o.b, x: 250, y: 500, angle: 0, speed: 300, weapon: 'GRENADE' }, over || {});
  const before = new Set(win.projectiles);
  W().throwGrenade(spec);
  const p = newestAfter(before);
  if (!p) throw new Error('emitGrenade: shipping throwGrenade pushed no projectile');
  return p;
}
function emitThrown(o, weaponId, angle = 0) {
  const idx = o.b === win.fighters[0] ? 0 : 1;
  W().equip(win.fighters[idx], weaponId);
  const before = new Set(win.projectiles);
  W().spawnThrownMelee(o.b, weaponId, angle);
  const p = newestAfter(before);
  if (!p) throw new Error('emitThrown: shipping spawnThrownMelee pushed no projectile');
  return p;
}
/* One capture cycle: step until emergence, return the timeline.
 * `snapAtCapture` (optional) is evaluated on the capture frame — used to
 * freeze lifecycle values (fuse/life/grace) exactly at escrow entry so the
 * pause law can be asserted against the emergence values. */
function runCapture(p, seqs, maxFrames = 240, snapAtCapture = null) {
  const tl = { captureFrame: -1, imgFrame: -1, emergeFrame: -1, imgT: null,
    emT: null, emX: null, emY: null, emVia: null, emFallback: null, snap: null };
  for (let f = 1; f <= maxFrames; f++) {
    win.APEX_ARSENAL.step(DT);
    const ev = seqs();
    if (tl.captureFrame < 0) {
      const cap = ev.find((e) => e.type === 'MirrorRouteCapture');
      if (cap) {
        tl.captureFrame = f;
        if (snapAtCapture) tl.snap = snapAtCapture();
      }
    }
    const img = ev.find((e) => e.type === 'MirrorEscrowImage');
    if (tl.imgFrame < 0 && img) { tl.imgFrame = f; tl.imgT = (img.payload || img).t; }
    const em = ev.find((e) => e.type === 'MirrorRouteEmerge');
    if (tl.emergeFrame < 0 && em) {
      const q = em.payload || em;
      tl.emergeFrame = f; tl.emT = q.t; tl.emX = q.x; tl.emY = q.y;
      tl.emVia = q.via; tl.emFallback = q.fallback;
      tl.emClock = HR.AIL.clock();
      break;
    }
    if (tl.captureFrame >= 0 && f - tl.captureFrame > 90) break; // transit guard
  }
  return tl;
}

/* ============ R09 preview threshold / no removal ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);                       // one ACTIVE node (preview only needs nodes)
  seed(o.ct, 700, 500, 0);
  // Path at y=600 stays ~38px from the surface endpoint: inside the 34+r
  // preview band, OUTSIDE the 17+r capture band.
  const p = emitBullet(o, { x: 250, y: 600, speed: 1200 });
  const seqs = captureSeq(['MirrorRoutePreview', 'MirrorRouteCapture', 'MirrorRouteLocal']);
  const vx0 = p.vx, vy0 = p.vy;
  stepFrames(30);
  const ev = seqs();
  const previews = ev.filter((e) => e.type === 'MirrorRoutePreview');
  const captures = ev.filter((e) => e.type !== 'MirrorRoutePreview');
  gate('F2-R09-preview-threshold-no-removal',
    previews.length >= 1 && captures.length === 0
    && win.projectiles.includes(p) && p.life > 0
    && close(p.vx, vx0) && close(p.vy, vy0),
    { previews: previews.length, captures: captures.length,
      inWorld: win.projectiles.includes(p), vxUnchanged: close(p.vx, vx0) });
} catch (e) { gate('F2-R09-preview-threshold-no-removal', false, String(e)); }

/* ============ R10 high-speed swept capture cannot tunnel ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);
  const nB = seed(o.ct, 700, 500, 0);
  // 12000 px/s = 200px per frame: both endpoints of the capture frame are
  // OUTSIDE the capture band; only a swept test can see the crossing.
  const p = emitBullet(o, { x: 250, y: 500, speed: 12000 });
  const seqs = captureSeq(['MirrorRouteCapture']);
  const tl = runCapture(p, seqs);
  const ev = seqs();
  gate('F2-R10-high-speed-swept-capture',
    tl.captureFrame > 0 && ev.length === 1 && (ev[0].payload || ev[0]).entry === nA.id,
    { captureFrame: tl.captureFrame, events: ev.length });
} catch (e) { gate('F2-R10-high-speed-swept-capture', false, String(e)); }

/* ============ R01 firearm bullet: full canonical transit ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);
  const nB = seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200, damage: 42, critical: true });
  p.__hr = p.__hr || {};
  p.__hr.frost = true;                            // R06 payload tag rides along
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorEscrowImage', 'MirrorRouteEmerge']);
  const dmg0 = p.damage, wx0 = p.weapon, crit0 = p.critical, sp0 = Math.hypot(p.vx, p.vy);
  const tl = runCapture(p, seqs);
  const ev = seqs();
  const cap = ev.find((e) => e.type === 'MirrorRouteCapture');
  const cp = cap && (cap.payload || cap);
  // R14/R15: canonical FIRST fixed-step crossings, exact accumulated edges.
  const imgOk = tl.imgFrame === tl.captureFrame + IMG_FRAME && tl.imgT === IMG_T;
  const emOk = tl.emergeFrame === tl.captureFrame + EM_FRAME && tl.emT === EM_T;
  // R15: emergence event point = dest center + incomingDir*20 exactly
  // (production transform is the shared 1:1 node transform).
  const posOk = tl.emX === nB.x + 20 && tl.emY === nB.y;
  // R16: direction/speed/damage/crit/weapon/payload preserved.
  const speedOk = close(Math.hypot(p.vx, p.vy), sp0) && close(p.vx, sp0) && close(p.vy, 0);
  const kept = p.damage === dmg0 && p.weapon === wx0 && p.critical === crit0 && p.__hr.frost === true;
  // R18: one frame after emergence, px/py trail exactly ONE frame of motion
  // from the emergence point (reset at emergence, no stale capture history).
  const pxOk = close(p.px, tl.emX) && close(p.py, tl.emY) && !(p.__hr && p.__hr.pathVia);
  gate('F2-R01-bullet-canonical-transit',
    tl.captureFrame > 0 && cp && cp.entry === nA.id && cp.dest === nB.id
    && imgOk && emOk && posOk && speedOk && kept && pxOk && tl.emVia === nB.id,
    { captureFrame: tl.captureFrame, imgFrame: tl.imgFrame, imgT: tl.imgT,
      emergeFrame: tl.emergeFrame, emT: tl.emT, via: tl.emVia,
      emPos: [tl.emX, tl.emY], expected: [nB.x + 20, nB.y], speedOk, kept, pxOk,
      canon: { img: IMG_T, em: EM_T } });
} catch (e) { gate('F2-R01-bullet-canonical-transit', false, String(e)); }

/* ============ R02 shotgun pellets (each real pellet entity) ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  // Two real SHOTGUN-family pellet entities through the shipping emission.
  const p1 = emitBullet(o, { weapon: 'SHOTGUN', x: 250, y: 495, angle: 0.02, speed: 1100 });
  const p2 = emitBullet(o, { weapon: 'SHOTGUN', x: 250, y: 505, angle: -0.02, speed: 1100 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  const tl = runCapture(p1, seqs, 300);
  const ev = seqs();
  const caps = ev.filter((e) => e.type === 'MirrorRouteCapture');
  const pelletCaptured = caps.some((e) => {
    const q = e.payload || e; return q.type === 'aq_bullet' && q.weapon === 'SHOTGUN';
  });
  // Each pellet is its own REAL detached projectile entity (family resolves
  // through the shipping config, here AUTOSHOT for the SHOTGUN id).
  const bothEntities = p1 !== p2 && p1.aq && p2.aq
    && p1.type === 'aq_bullet' && p2.type === 'aq_bullet'
    && p1.weapon === 'SHOTGUN' && p2.weapon === 'SHOTGUN'
    && p1.family === p2.family && !!p1.family;
  gate('F2-R02-shotgun-pellet-entity-routes',
    pelletCaptured && bothEntities && caps.length >= 2,
    { captures: caps.length, pelletCaptured, bothEntities, family: p1.family });
} catch (e) { gate('F2-R02-shotgun-pellet-entity-routes', false, String(e)); }

/* ============ R03 grenade: real fuse lifecycle through escrow ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const g = emitGrenade(o, { x: 250, y: 500, speed: 300 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  // Freeze fuse/life at the escrow-entry frame. During the ~0.5667s (34
  // fixed-step) transit the grenade is ABSENT from the live array: the engine
  // life pass never ticks it, and the rework fuse tick never runs. At the
  // emergence frame it rejoins the array, so exactly ONE rework-branch fuse
  // tick (the resume) may land — anything more would prove an escrow leak.
  const tl = runCapture(g, seqs, 300, () => ({ fuse: g.fuse, life: g.life }));
  const transitFrames = tl.emergeFrame - tl.captureFrame;
  gate('F2-R03-grenade-fuse-pauses-in-escrow',
    tl.captureFrame > 0 && tl.emergeFrame > 0 && tl.snap
    && transitFrames === EM_FRAME
    && g.life === tl.snap.life                       // zero engine ticks
    && close((tl.snap.fuse - g.fuse), DT, 1e-9)      // exactly the resume tick
    && g.type === 'aq_grenade' && win.projectiles.includes(g),
    { captureFrame: tl.captureFrame, emergeFrame: tl.emergeFrame, transitFrames,
      fuseAtCapture: tl.snap && tl.snap.fuse, fuseAtEmerge: g.fuse,
      lifeAtCapture: tl.snap && tl.snap.life, lifeAtEmerge: g.life });
} catch (e) { gate('F2-R03-grenade-fuse-pauses-in-escrow', false, String(e)); }

/* ============ R04 normal thrown melee: real flight lifecycle ============ */
try {
  const o = start();
  seed(o.ct, 500, 500, 0);
  seed(o.ct, 300, 500, 0);
  // Real shipping DAGGER throw (spawnThrownMelee) aimed LEFT, across both nodes.
  const t0 = emitThrown(o, 'DAGGER', Math.PI);
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  const tl = runCapture(t0, seqs, 300,
    () => ({ grace: t0.grace, spin: t0.spin, rico: t0.ricochetsLeft, life: t0.life, flight: t0.flightTime }));
  // grace + life are rework-branch timers: exactly ONE resume tick at the
  // emergence frame, ZERO across the 34-frame transit (else they would have
  // dropped by transitFrames*DT). flightTime only advances for maxFlight
  // weapons (DAGGER has none) and must be untouched.
  gate('F2-R04-thrown-melee-routes-with-lifecycle',
    tl.captureFrame > 0 && tl.emergeFrame > 0 && tl.snap
    && (tl.emergeFrame - tl.captureFrame) === EM_FRAME
    && t0.type === 'aq_thrown' && t0.weapon === 'DAGGER' && t0.state === 'flight'
    && close((tl.snap.grace - t0.grace), DT, 1e-9)
    && close((tl.snap.life - t0.life), DT, 1e-9)
    && t0.spin === tl.snap.spin && t0.ricochetsLeft === tl.snap.rico
    && t0.flightTime === tl.snap.flight
    && win.projectiles.includes(t0),
    { captureFrame: tl.captureFrame, emergeFrame: tl.emergeFrame,
      graceAtCapture: tl.snap && tl.snap.grace, graceAtEmerge: t0.grace,
      lifeAtCapture: tl.snap && tl.snap.life, lifeAtEmerge: t0.life,
      ricochetsLeft: t0.ricochetsLeft });
} catch (e) { gate('F2-R04-thrown-melee-routes-with-lifecycle', false, String(e)); }

/* ============ R05 TIME replay lineage routes, tag preserved ============ */
try {
  T.start('TIME', 'MIRROR'); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 150; a.y = 500; b.x = 850; b.y = 500;
  const mir = HR.byCombatant(b);
  seed(mir, 350, 500, 0);
  seed(mir, 650, 500, 0);
  win.APEX_ARSENAL.weaponApi.equip(win.fighters[0], 'GLOCK_17');
  T.step(1.5);                                    // record real GLOCK fire
  const mark = bus().seq;
  const loop = HR.abilityController(HR.byCombatant(win.fighters[0])).tryCast('A1', 'f2gate');
  let replayRouted = null, emergedReplay = null;
  for (let f = 0; f < 480 && !emergedReplay; f++) {
    T.step(1 / 60);
    for (const p of win.projectiles) {
      if (p && p.aq && p.__hr && p.__hr.replay && p.__hr.neutral) emergedReplay = p;
    }
  }
  const evs = bus().since(mark).filter((e) => e.type === 'MirrorRouteCapture');
  replayRouted = evs.length > 0;
  gate('F2-R05-time-replay-lineage-routes',
    loop && loop.ok && replayRouted && !!emergedReplay
    && emergedReplay.__hr.replay && emergedReplay.__hr.neutral,
    { loopOk: loop && loop.ok, captures: evs.length, replayPreserved: !!(emergedReplay && emergedReplay.__hr.replay) });
} catch (e) { gate('F2-R05-time-replay-lineage-routes', false, String(e)); }

/* ============ R06 transformed CHILL/FROST payload preserved ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  p.__hr = p.__hr || {};
  p.__hr.frost = true;                            // real FROST V1 payload tag
  p.__hr.chill = true;                            // legacy chill payload tag
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs);
  gate('F2-R06-payload-tags-preserved',
    p.__hr.frost === true && p.__hr.chill === true && p.__hr.neutral === true,
    { frost: p.__hr.frost, chill: p.__hr.chill, neutral: p.__hr.neutral });
} catch (e) { gate('F2-R06-payload-tags-preserved', false, String(e)); }

/* ============ R07 T6/STORMBREAKER immune ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { weapon: 'STORMBREAKER', x: 250, y: 500, speed: 1200, damage: 446 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteLocal', 'MirrorRoutePreview', 'MirrorEscrowImage', 'MirrorRouteEmerge']);
  let everEscrowed = false;
  for (let f = 0; f < 25; f++) {
    win.APEX_ARSENAL.step(DT);
    if (escrowList().some((e) => e.p === p)) everEscrowed = true;
  }
  const ev = seqs();
  gate('F2-R07-t6-immune',
    ev.length === 0 && !everEscrowed && !(p.__hr && p.__hr.neutral)
    && win.projectiles.includes(p),
    { events: ev.length, everEscrowed, stillWorld: win.projectiles.includes(p) });
} catch (e) { gate('F2-R07-t6-immune', false, String(e)); }

/* ============ R08 non-projectile families never routed ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteLocal', 'MirrorRoutePreview']);
  // (a) direct melee/contact damage: no projectile exists at all.
  const hp0 = o.a.hp;
  W().aqDamage(o.a, 30, o.b, 'DAGGER', { knockback: 0 });
  stepFrames(5);
  // (b) a PINNED thrown melee (production lifecycle state) lying on the
  // surface is a melee-attached object, not a detached flight projectile.
  const pinned = {
    aq: true, type: 'aq_thrown', weapon: 'DAGGER', owner: o.b,
    state: 'pinned', pinnedTo: o.a, pinTimer: 5, life: 6,
    x: 397, y: 500, px: 397, py: 500, vx: 0, vy: 0, radius: 10,
    ricochetsLeft: 3, grace: 0, spin: 2, rot: 0, flightTime: 0.4, maxFlight: 0,
    damage: 20, critical: false, __hr: {},
  };
  win.projectiles.push(pinned);
  stepFrames(20);
  const ev = seqs();
  gate('F2-R08-non-projectile-families-ignored',
    o.a.hp < hp0 && ev.length === 0,
    { directDamageDealt: o.a.hp < hp0, routingEvents: ev.length });
} catch (e) { gate('F2-R08-non-projectile-families-ignored', false, String(e)); }

/* ============ R11 one node: WORLD + local response + ~0.40 cooldown ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);             // exactly ONE ACTIVE node
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteLocal', 'MirrorEscrowImage', 'MirrorRouteEmerge']);
  let localClock = null;
  for (let f = 0; f < 20; f++) {
    win.APEX_ARSENAL.step(DT);
    if (localClock == null && seqs().some((e) => e.type === 'MirrorRouteLocal')) {
      localClock = HR.AIL.clock();
    }
  }
  const ev = seqs();
  const locals = ev.filter((e) => e.type === 'MirrorRouteLocal');
  const escrowed = escrowList().length;
  const inWorld = win.projectiles.includes(p) && p.life > 0;
  const cd = p.__hr && p.__hr.mirrorAttemptCdUntil;
  // The cooldown is EXACTLY 0.40s from the local-response clock.
  const cdOk = cd != null && localClock != null && close(cd - localClock, 0.40, 1e-9);
  // Cooldown blocks an immediate second attempt: teleport the SAME bullet
  // back in front of the surface and cross again inside the 0.40s window.
  p.x = 250; p.px = 250; p.y = 500; p.py = 500;
  const seqs2 = captureSeq(['MirrorRouteLocal', 'MirrorRouteCapture']);
  stepFrames(5);                                  // re-crosses while cooling down
  const re = seqs2();
  // After the cooldown expires the same surface is a valid attempt again.
  for (let i = 0; i < 30; i++) win.APEX_ARSENAL.step(DT); // ride past + past cd
  p.x = 250; p.px = 250; p.y = 500; p.py = 500; p.vx = 1200; p.vy = 0;
  const seqs3 = captureSeq(['MirrorRouteLocal']);
  stepFrames(10);
  const again = seqs3();
  gate('F2-R11-one-node-world-local-cooldown',
    locals.length === 1 && ev.filter((e) => e.type !== 'MirrorRouteLocal').length === 0
    && escrowed === 0 && inWorld && cdOk
    && re.length === 0 && again.filter((e) => e.type === 'MirrorRouteLocal').length === 1,
    { locals: locals.length, escrowed, inWorld, cooldownOk: cdOk,
      blockedDuringCd: re.length === 0, afterCdLocal: again.length });
} catch (e) { gate('F2-R11-one-node-world-local-cooldown', false, String(e)); }

/* ============ R12 nearest OTHER ACTIVE same-owner destination ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);
  const nNear = seed(o.ct, 700, 500, 0);          // 300 from entry
  const nFar = seed(o.ct, 500, 200, 0);           // ~316 from entry
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  const tl = runCapture(p, seqs);
  const ev = seqs();
  const cap = ev.find((e) => e.type === 'MirrorRouteCapture');
  const cp = cap && (cap.payload || cap);
  const emergedAtNear = tl.emX === nNear.x + 20 && tl.emY === nNear.y && tl.emVia === nNear.id;
  gate('F2-R12-nearest-other-active-destination',
    cp && cp.dest === nNear.id && cp.dest !== nFar.id && emergedAtNear,
    { dest: cp && cp.dest, nearId: nNear.id, farId: nFar.id, emPos: [tl.emX, tl.emY] });
} catch (e) { gate('F2-R12-nearest-other-active-destination', false, String(e)); }

/* ============ Mirror-vs-Mirror network isolation ============ */
try {
  const o = start('MIRROR', 'MIRROR');
  // Owner A's network (high lane) and owner B's network (flight lane).
  seed(o.ct, 250, 200, 0); seed(o.ct, 400, 200, 0);
  const bEntry = seed(o.ctB, 500, 500, 0);
  const bDest = seed(o.ctB, 750, 500, 0);
  const p = emitBullet(o, { owner: o.a, x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture']);
  runCapture(p, seqs);
  const ev = seqs();
  const cp = ev.length && (ev[0].payload || ev[0]);
  gate('F2-mirror-vs-mirror-network-isolation',
    cp && cp.entry === bEntry.id && cp.dest === bDest.id
    && cp.owner === o.ctB.idx,
    cp ? { owner: cp.owner, bIdx: o.ctB.idx, entry: cp.entry, dest: cp.dest } : { captures: 0 });
} catch (e) { gate('F2-mirror-vs-mirror-network-isolation', false, String(e)); }

/* ============ FORMING / FOLD nodes cannot capture ============ */
try {
  const o = start();
  const nForming = seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  nForming.st = 1;                                // FORMING (fixture state flip)
  let p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture']);
  stepFrames(40);
  const evForming = seqs();
  // FOLD state cannot capture either.
  T.start('MIRROR', 'ROBOT'); T.holdSpawns();
  const [a2, b2] = H.fighters();
  a2.baseSpeed = 0; b2.baseSpeed = 0; a2.x = 150; a2.y = 500; b2.x = 850; b2.y = 500;
  const o2 = { a: a2, b: b2, ct: HR.byCombatant(a2), ctB: HR.byCombatant(b2) };
  const nFold = seed(o2.ct, 400, 500, 0);
  seed(o2.ct, 700, 500, 0);
  nFold.st = 3;                                   // FOLD (fixture state flip)
  p = emitBullet(o2, { x: 250, y: 500, speed: 1200 });
  const seqs2 = captureSeq(['MirrorRouteCapture']);
  stepFrames(40);
  const evFold = seqs2();
  gate('F2-forming-fold-nodes-cannot-capture',
    evForming.length === 0 && evFold.length === 0,
    { formingCaptures: evForming.length, foldCaptures: evFold.length });
} catch (e) { gate('F2-forming-fold-nodes-cannot-capture', false, String(e)); }

/* ============ R13 escrowed object absent from world collision ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs, 10);                        // capture frame only
  const captured = escrowList().some((e) => e.p === p) && !win.projectiles.includes(p);
  const xE = p.x, yE = p.y;
  let sawEscrowFrame = 0, everInWorldDuringEscrow = false, frozen = true, singleCopy = true;
  let emerged = false;
  for (let f = 0; f < 45 && !emerged; f++) {
    const inEscrow = escrowList().some((e) => e.p === p);
    const inWorld = win.projectiles.includes(p);
    if ((inEscrow ? 1 : 0) + (inWorld ? 1 : 0) !== 1) singleCopy = false;
    if (inEscrow) {
      sawEscrowFrame++;
      if (inWorld) everInWorldDuringEscrow = true;
      if (p.x !== xE || p.y !== yE) frozen = false;   // Magnet/walls/bodies cannot move it
    }
    win.APEX_ARSENAL.step(DT);
    emerged = seqs().some((e) => e.type === 'MirrorRouteEmerge');
  }
  gate('F2-R13-escrow-absent-from-world',
    captured && emerged && sawEscrowFrame >= 30
    && !everInWorldDuringEscrow && frozen && singleCopy,
    { captured, emerged, escrowFrames: sawEscrowFrame,
      neverInWorldDuringEscrow: !everInWorldDuringEscrow, frozen, singleCopy });
} catch (e) { gate('F2-R13-escrow-absent-from-world', false, String(e)); }

/* ============ R19 neutral output, no Hero credit, either side ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  // Bullet owned by o.b; after neutral emergence the SHOOTER SIDE body sits
  // ahead of the emergence point: a neutral object may hit either side.
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200, damage: 40 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs);
  o.b.x = 800; o.b.y = 500;
  const hp0 = o.b.hp;
  const dealtBefore = o.ctB.telemetry.damageDealt;
  const mirrorDealtBefore = o.ct.telemetry.damageDealt;
  stepFrames(12);                                 // neutral bullet reaches o.b
  const hitShooterSide = o.b.hp < hp0;
  gate('F2-R19-neutral-no-hero-credit',
    p.__hr && p.__hr.neutral === true && hitShooterSide
    && o.ctB.telemetry.damageDealt === dealtBefore
    && o.ct.telemetry.damageDealt === mirrorDealtBefore,
    { neutral: p.__hr && p.__hr.neutral, hitShooterSide,
      hpDelta: +(hp0 - o.b.hp).toFixed(2), creditUnchanged: o.ctB.telemetry.damageDealt === dealtBefore });
} catch (e) { gate('F2-R19-neutral-no-hero-credit', false, String(e)); }

/* ============ R20/R21 recapture lock then valid routing; no lastPortalId */
try {
  const o = start();
  seed(o.ct, 300, 500, 0); seed(o.ct, 420, 500, 0);   // pair 1
  seed(o.ct, 650, 500, 0); seed(o.ct, 800, 500, 0);   // pair 2
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });  // >65.5px from fighter a
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  const tl = runCapture(p, seqs);
  const lock = p.__hr && p.__hr.mirrorRecaptureUntil;
  // Lock is EXACTLY 0.45s measured from the emergence clock.
  const lockOk = tl.emergeFrame > 0 && lock != null && tl.emClock != null
    && close(lock - tl.emClock, 0.45, 1e-9);
  // INSIDE the lock: re-aim the SAME bullet at pair 2 -> crosses node 650 but
  // must NOT capture. Park it afterwards so it does not leave the arena while
  // we wait out the lock.
  p.x = 560; p.px = 560; p.y = 500; p.py = 500; p.vx = 1200; p.vy = 0;
  p.life = Math.max(p.life, 6);
  const seqsLocked = captureSeq(['MirrorRouteCapture']);
  stepFrames(6);                                   // crosses node 650 inside the lock
  const lockedCaptures = seqsLocked();
  p.x = 560; p.px = 560; p.y = 500; p.py = 500; p.vx = 0; p.vy = 0; // park
  stepFrames(30);                                  // > 0.45s -> lock expires
  // AFTER the lock: legitimate later routing works again (no permanent
  // lastPortalId suppression).
  p.vx = 1200; p.life = Math.max(p.life, 6);
  p.__hr = p.__hr || {};
  p.__hr.mirrorPreviewed = [];
  const seqsAfter = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqsAfter);
  const after = seqsAfter();
  const lastPortalIdAbsent = p.__hr.lastPortalId === undefined;
  gate('F2-R20-R21-recapture-lock-then-routing',
    lockOk && lockedCaptures.length === 0
    && after.some((e) => e.type === 'MirrorRouteCapture') && lastPortalIdAbsent,
    { lockOk, lockedCaptures: lockedCaptures.length,
      laterCaptures: after.filter((e) => e.type === 'MirrorRouteCapture').length,
      lastPortalIdAbsent });
} catch (e) { gate('F2-R20-R21-recapture-lock-then-routing', false, String(e)); }

/* ============ R18 no teleport-gap phantom hit ============ */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs, 10);
  // Victim sits ON the capture -> emergence line (the teleport gap). With a
  // stale swept history the emergence frame would sweep capture->emergence
  // and hit it; with the reset it never does.
  o.a.x = 560; o.a.y = 500;
  const hp0 = o.a.hp;
  const tl = runCapture(p, seqs, 60);
  // At the emergence frame px/py were reset to the emergence point: one
  // frame later they trail exactly ONE frame of motion from it.
  const pxReset = close(p.px, tl.emX) && close(p.py, tl.emY) && !(p.__hr && p.__hr.pathVia);
  gate('F2-R18-no-teleport-gap-phantom-hit',
    tl.emergeFrame > 0 && o.a.hp === hp0 && pxReset,
    { emerged: tl.emergeFrame > 0, victimHp0: hp0, victimHp: o.a.hp,
      px: p.px, emX: tl.emX, pxReset });
} catch (e) { gate('F2-R18-no-teleport-gap-phantom-hit', false, String(e)); }

/* ============ R22 lost destination -> entry-transform fallback once ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);
  const nDest = seed(o.ct, 700, 500, 0);
  const nThird = seed(o.ct, 900, 150, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs, 10);                        // capture frame
  // Destination folds mid-transit; entry node is even RELOCATED after
  // capture — emergence must use the CAPTURED entry snapshot, exactly once,
  // and never retarget to the third node.
  nDest.st = 3;
  const snapX = nA.x, snapY = nA.y;
  nA.x += 500; nA.y -= 300;                       // entry moved AFTER capture
  const tl = runCapture(p, seqs, 60);
  const ev = seqs();
  const ems = ev.filter((e) => e.type === 'MirrorRouteEmerge');
  gate('F2-R22-lost-destination-entry-fallback',
    ems.length === 1 && tl.emVia === 'entry-fallback' && tl.emFallback === true
    && tl.emX === snapX + 20 && tl.emY === snapY
    && !(tl.emX === nThird.x + 20 && tl.emY === nThird.y),
    { emerges: ems.length, via: tl.emVia, emPos: [tl.emX, tl.emY],
      expected: [snapX + 20, snapY], thirdAt: [nThird.x + 20, nThird.y] });
} catch (e) { gate('F2-R22-lost-destination-entry-fallback', false, String(e)); }

/* ============ R23 lifecycle churn in escrow: never duplicate/lose ============ */
try {
  const o = start();
  const nA = seed(o.ct, 400, 500, 0);
  const nDest = seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorRouteEmerge']);
  runCapture(p, seqs, 10);
  // Entry node folds mid-transit (destination stays alive).
  nA.st = 3;
  let singleCopy = true, lost = false, emerged = false;
  for (let f = 0; f < 45 && !emerged; f++) {
    win.APEX_ARSENAL.step(DT);
    const copies = (win.projectiles.includes(p) ? 1 : 0) + escrowList().filter((e) => e.p === p).length;
    if (copies !== 1) singleCopy = false;
    if (copies === 0) lost = true;
    emerged = seqs().some((e) => e.type === 'MirrorRouteEmerge');
  }
  const ev = seqs();
  const em = ev.find((e) => e.type === 'MirrorRouteEmerge');
  gate('F2-R23-lifecycle-churn-no-dup-no-loss',
    singleCopy && !lost && em && ((em.payload || em).via === nDest.id)
    && win.projectiles.includes(p),
    { singleCopy, lost, emergedVia: em && (em.payload || em).via, destId: nDest.id });
} catch (e) { gate('F2-R23-lifecycle-churn-no-dup-no-loss', false, String(e)); }

/* ============ Global TOI: Mirror EARLIER than Magnet boundary ============ */
// A REAL Magnet A2 corner frame is built through Magnet's own movement-plan
// seam (entry boundary at t=0.5). The entry-node surface sits on the INBOUND
// leg, so the capture TOI is earlier than the pending boundary: the capture
// must supersede it (revoke + terminate the stale travelled path).
try {
  const o = start('MIRROR', 'ROBOT');
  const MAGR = win.APEX_MAGNET;
  o.a.x = 150; o.a.y = 150; o.b.x = 850; o.b.y = 850;
  seed(o.ct, 330, 500, 0);                        // INBOUND leg (before t=0.5)
  seed(o.ct, 900, 120, 0);
  const PRE_VX = 300 / (DT * 0.5);
  const plan = { entryT: 0.5, entryX: 500, entryY: 500, preVx: PRE_VX, preVy: 0, postVx: 0, postVy: 300 / (DT * 0.5) };
  const p = { aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 4, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: {},
    x: 200, y: 500, vx: PRE_VX, vy: 0 };
  win.projectiles.length = 0; win.projectiles.push(p);
  const realConsume = MAGR.consumeMovementPlan;
  let served = false;
  MAGR.consumeMovementPlan = function (proj) {
    if (proj === p && !served) { served = true; return plan; }
    return realConsume.call(this, proj);
  };
  const mark = bus().seq;
  let restoreErr = null;
  try { win.APEX_ARSENAL.step(DT); } catch (e) { restoreErr = String(e); }
  MAGR.consumeMovementPlan = realConsume;
  const caps = bus().since(mark).filter((e) => e.type === 'MirrorRouteCapture');
  const cp = caps.length ? (caps[0].payload || caps[0]) : null;
  gate('F2-mirror-earlier-supersedes-magnet',
    !restoreErr && caps.length === 1 && cp && cp.toi < 0.5
    && !(p.__hr && p.__hr.pathVia) && escrowList().length === 1,
    { captures: caps.length, toi: cp && cp.toi,
      pathViaCleared: !(p.__hr && p.__hr.pathVia), escrowed: escrowList().length, restoreErr });
} catch (e) { gate('F2-mirror-earlier-supersedes-magnet', false, String(e)); }

/* ============ Global TOI: Magnet boundary EARLIER (capture later, POST leg) */
try {
  const o = start('MIRROR', 'ROBOT');
  const MAGR = win.APEX_MAGNET;
  o.a.x = 150; o.a.y = 150; o.b.x = 850; o.b.y = 850;
  seed(o.ct, 500, 700, 0);                        // on the OUTBOUND leg only
  seed(o.ct, 900, 120, 0);
  const PRE_VX = 300 / (DT * 0.5), POST_VY = 300 / (DT * 0.5);
  const plan = { entryT: 0.5, entryX: 500, entryY: 500, preVx: PRE_VX, preVy: 0, postVx: 0, postVy: POST_VY };
  const p = { aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 4, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: {},
    x: 200, y: 500, vx: PRE_VX, vy: 0 };
  win.projectiles.length = 0; win.projectiles.push(p);
  const realConsume = MAGR.consumeMovementPlan;
  let served = false;
  MAGR.consumeMovementPlan = function (proj) {
    if (proj === p && !served) { served = true; return plan; }
    return realConsume.call(this, proj);
  };
  const mark = bus().seq;
  let restoreErr = null;
  try { win.APEX_ARSENAL.step(DT); } catch (e) { restoreErr = String(e); }
  MAGR.consumeMovementPlan = realConsume;
  const caps = bus().since(mark).filter((e) => e.type === 'MirrorRouteCapture');
  const cp = caps.length ? (caps[0].payload || caps[0]) : null;
  // Capture TOI must sit on the OUTBOUND leg (after the t=0.5 boundary) and
  // carry the POST-boundary velocity: the boundary was physically earlier.
  gate('F2-magnet-earlier-mirror-captures-post-leg',
    !restoreErr && caps.length === 1 && cp && cp.toi > 0.5
    && Math.abs(p.vx - 0) < 1e-6 && Math.abs(p.vy - POST_VY) < 1e-6,
    { captures: caps.length, toi: cp && cp.toi, vx: p.vx, vy: p.vy, restoreErr });
} catch (e) { gate('F2-magnet-earlier-mirror-captures-post-leg', false, String(e)); }

/* ============ Preview never revokes a pending Magnet boundary ============ */
try {
  const o = start('MIRROR', 'ROBOT');
  const MAGR = win.APEX_MAGNET;
  o.a.x = 150; o.a.y = 150; o.b.x = 850; o.b.y = 850;
  seed(o.ct, 400, 410, 0);                        // preview band only (d=28)
  const PRE_VX = 300 / (DT * 0.5), POST_VY = 300 / (DT * 0.5);
  const plan = { entryT: 0.5, entryX: 500, entryY: 500, preVx: PRE_VX, preVy: 0, postVx: 0, postVy: POST_VY };
  const p = { aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 4, radius: 7,
    owner: o.b, damage: 10, critical: false, __hr: {},
    x: 200, y: 500, vx: PRE_VX, vy: 0 };
  win.projectiles.length = 0; win.projectiles.push(p);
  const realConsume = MAGR.consumeMovementPlan;
  let served = false;
  MAGR.consumeMovementPlan = function (proj) {
    if (proj === p && !served) { served = true; return plan; }
    return realConsume.call(this, proj);
  };
  const mark = bus().seq;
  let restoreErr = null;
  try { win.APEX_ARSENAL.step(DT); } catch (e) { restoreErr = String(e); }
  MAGR.consumeMovementPlan = realConsume;
  const ev = bus().since(mark);
  const previews = ev.filter((e) => e.type === 'MirrorRoutePreview');
  const caps = ev.filter((e) => e.type === 'MirrorRouteCapture');
  // The pending Magnet boundary (t=0.5) must remain UNrevoked: the travelled
  // path metadata survives the frame because preview is non-terminal and the
  // projectile was not captured.
  gate('F2-preview-never-revokes-magnet',
    !restoreErr && previews.length >= 1 && caps.length === 0
    && !!(p.__hr && p.__hr.pathVia) && escrowList().length === 0,
    { previews: previews.length, captures: caps.length,
      pathViaPending: !!(p.__hr && p.__hr.pathVia), restoreErr });
} catch (e) { gate('F2-preview-never-revokes-magnet', false, String(e)); }

/* ============ R14/R15 first-crossing negative: nothing before the edge === */
try {
  const o = start();
  seed(o.ct, 400, 500, 0);
  seed(o.ct, 700, 500, 0);
  const p = emitBullet(o, { x: 250, y: 500, speed: 1200 });
  const seqs = captureSeq(['MirrorRouteCapture', 'MirrorEscrowImage', 'MirrorRouteEmerge']);
  let capF = -1, imgF = -1, emF = -1, imgT = null, emT = null, earlyImg = false, earlyEm = false;
  for (let f = 1; f <= 90; f++) {
    win.APEX_ARSENAL.step(DT);
    const ev = seqs();
    if (capF < 0 && ev.some((e) => e.type === 'MirrorRouteCapture')) capF = f;
    if (capF > 0) {
      const off = f - capF;
      const img = ev.find((e) => e.type === 'MirrorEscrowImage');
      const em = ev.find((e) => e.type === 'MirrorRouteEmerge');
      if (img && imgF < 0) { imgF = f; imgT = (img.payload || img).t; }
      if (em && emF < 0) { emF = f; emT = (em.payload || em).t; break; }
      if (img && off < IMG_FRAME) earlyImg = true;
      if (em && off < EM_FRAME) earlyEm = true;
    }
  }
  gate('F2-R14-R15-first-crossing-exact',
    capF > 0 && imgF === capF + IMG_FRAME && emF === capF + EM_FRAME
    && imgT === IMG_T && emT === EM_T && !earlyImg && !earlyEm,
    { capF, imgOff: imgF - capF, emOff: emF - capF, imgT, emT,
      canonImg: IMG_T, canonEm: EM_T, earlyImg, earlyEm });
} catch (e) { gate('F2-R14-R15-first-crossing-exact', false, String(e)); }

if (HR.match) win.exitArsenalQuestMode();

fs.mkdirSync('docs/hero-rework/mirror-v1/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/mirror-v1/evidence/f2-routing-escrow.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));

const total = Object.keys(report.gates).length;
const passed = total - report.failures.length;
console.log(`\n[MIRROR F2 ROUTING/ESCROW] ${passed}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
