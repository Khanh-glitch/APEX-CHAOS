#!/usr/bin/env node
// Build-time bridge only. Never load or parse authority HTML during gameplay.
//
// MIRROR V1 Gold bridge — CHECKPOINT D1 (static / material core).
// Extracts the hash-verified CANONICAL Gold
//   docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html
//   107,480 bytes / sha256 c11a8f0f...ef5205
// into a production module (public/game/hero-rework/mirrorGoldV1.js).
//
// D1 KEEPS VERBATIM (no retyping, no "equivalent" rewrites — the product law
// forbids simplifying Gold into generic VFX, and hand-porting raster code is
// exactly how that drift happens):
//   - UTIL                      (TAU/clamp/lerp/sstep/eo3/eio/mk/angLerp/br)
//   - RASTER BAKER              (P atlas, STOPS, tone, poly, facet, rimGlow,
//                                inkEdge, star, rrect, bake, pick, dp, masked,
//                                sweepFill, solidFill, PTS, pinfo, drawEye,
//                                drawSmile, plateBody, bakePlate, legacyBakeAll,
//                                foeShape, bakeSupport)
//   - ASSET PACK v3             (A_path/A_plane/A_line/A_shell, drawEye2,
//                                drawSmile2, A_plate, bakeArt, PLI)
//   - NV node silhouette, hoisted from the PASSIVE section as a geometry const.
//
// D1 CUTS: demo loop/init/resize/camera, input, AUTO director, foe entity,
// gameplay state + springs + history, movement/hit/projectile/passive systems,
// A1/A2 choreography, world render, diagnostic sheet. Those arrive in D2-D4.
//
// RASTER DETERMINISM (verified by this bridge): the entire bake region contains
// zero Math.random/rr() calls and draws only from the seeded Lehmer stream
// `br()` (bs = 7, never reseeded). The baked atlas is therefore byte-reproducible
// PROVIDED the bake order is preserved — bakeSupport() then bakeArt(), exactly
// as Gold's init() does. The emitted module enforces that order in one place.
//
// Production gameplay (mirrorGameplayRuntime, Checkpoint E) owns all timers and
// truth; the presentation runtime drives this module and feeds it real state.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const fail = (m) => { throw new Error('[mirror-bridge] ' + m); };
const ROOT = process.cwd();

// ---------- S0: Gold identity ----------
const GOLD = 'docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html';
const GOLD_BYTES = 107480;
const GOLD_SHA = 'c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205';
const raw = fs.readFileSync(path.join(ROOT, GOLD));
if (raw.length !== GOLD_BYTES) fail(`Gold byte length ${raw.length} !== ${GOLD_BYTES}`);
if (crypto.createHash('sha256').update(raw).digest('hex') !== GOLD_SHA) fail('Gold SHA-256 mismatch');
const text = raw.toString();

// ---------- S1: isolate the single engine script block ----------
const blocks = text.split('<script>');
if (blocks.length !== 2) fail(`expected exactly 1 script block, saw ${blocks.length - 1}`);
const src = blocks[1].split('</script>')[0];

// ---------- S2: slice by Gold's own section banners (never by line number) ----------
const BANNER = (title) => {
  const needle = `// =====================================================================================\n// ${title}`;
  const at = src.indexOf(needle);
  if (at < 0) fail(`section banner not found: ${title}`);
  return at;
};
const cut = (fromTitle, toTitle) => src.slice(BANNER(fromTitle), BANNER(toTitle)).replace(/\s+$/, '');

const UTIL_START = src.indexOf("'use strict';");
if (UTIL_START < 0) fail("'use strict' not found");

let utilRegion = src.slice(UTIL_START + "'use strict';".length, BANNER('RASTER BAKER  (ref space = 1254x1254 MAIN LOOK coordinates)')).replace(/^\s+|\s+$/g, '');

// Gold's ambient helper `rr` is Math.random-backed. D1's bake never calls it,
// and D2 must supply a DEDICATED presentation RNG that cannot consume the
// gameplay/combat stream, so the Math.random hook is cut here rather than
// shipped and later shadowed.
const RR_LINE = 'const rr=(a,b)=>a+Math.random()*(b-a);';
if (!utilRegion.includes(RR_LINE)) fail('expected ambient rr() helper in UTIL');
utilRegion = utilRegion.replace(RR_LINE + '\n', '');
const rasterRegion = cut('RASTER BAKER  (ref space = 1254x1254 MAIN LOOK coordinates)', 'ASSET PACK v3 — second-generation raster painter.');
const assetRegion = cut('ASSET PACK v3 — second-generation raster painter.', 'STATE, SPRINGS, HISTORY, TWEENS');

// The diagnostic asset sheet is a demo-only debug view. Cut it, keep PLI.
const DIAG_AT = assetRegion.indexOf('// ---- diagnostic asset sheet');
const PLI_AT = assetRegion.indexOf('const PLI={};');
if (DIAG_AT < 0 || PLI_AT < 0 || PLI_AT < DIAG_AT) fail('cannot isolate diagnostic sheet from PLI');
const assetKept = assetRegion.slice(0, DIAG_AT).replace(/\s+$/, '') + '\n' + assetRegion.slice(PLI_AT);

// ---------- D2: temporal history + false-reflection expression + locomotion ----------
const stateRegion = cut('STATE, SPRINGS, HISTORY, TWEENS', 'FALSE-REFLECTION EXPRESSION ENGINE');
const exprRegion = cut('FALSE-REFLECTION EXPRESSION ENGINE', 'MOVEMENT, TURN, STOP, WALL, BODY COLLISION');
let moveRegion = cut('MOVEMENT, TURN, STOP, WALL, BODY COLLISION', 'HIT SYSTEM (same language escalates into passive shard detachment)');

// Demo-only globals inside the state banner: canvas handles, input map, zoom.
// `cam` stays because wallHit/collide nudge it; production drives nothing from it.
const DEMO_STATE = [
  "const keys={};",
  "let VW=1,VH=1,DPR=1,cvs,ctx,baseZoom=1,simT=0;",
];
let d2State = stateRegion;
for (const line of DEMO_STATE) {
  if (!d2State.includes(line)) fail(`expected demo state line not found: ${line}`);
  d2State = d2State.replace(line + '\n', '');
}
// simT is read by the expression/locomotion code, so reintroduce it as pure
// instance state rather than a demo global.
d2State = d2State.replace("const cam={", "let simT=0;\nconst cam={");

// stepMirror falls back to the demo keyboard map when nothing drives it.
// Production always supplies M.drive, so the input branch is cut rather than
// shipping a reference to a demo global.
const KEY_LINE = "if(M.drive){ix=M.drive.x;iy=M.drive.y}else{ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);iy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)}";
if (!moveRegion.includes(KEY_LINE)) fail('expected demo input fallback in stepMirror');
moveRegion = moveRegion.replace(KEY_LINE, "if(M.drive){ix=M.drive.x;iy=M.drive.y}");

let d2Region = [d2State, exprRegion, moveRegion].join('\n\n');

// ---------- D3: A1 + A2 authored choreography ----------
let a1Region = cut('A1 — MIRROR ARSENAL  (NOTICE → LOCK → REFLECT → PEEL → REFORM → OWN)',
  'A2 — REFLECTION EXCHANGE  (MARK → SPLIT → INVERT → SNAP → CONTINUE)');
let a2Region = cut('A2 — REFLECTION EXCHANGE  (MARK → SPLIT → INVERT → SNAP → CONTINUE)',
  'RENDERING — MIRROR RIG (raster parts only)');

// === ENUMERATED DEMO GAMEPLAY MUTATIONS REMOVED FROM THE PRESENTATION PORT ===
// Each is replaced by a semantic EDGE the production adapter owns. The
// presentation module must never decide that gameplay succeeded.
const D3_MUTATIONS = [];
function stripMutation(region, needle, replacement, why) {
  if (!region.includes(needle)) fail(`D3 mutation not found: ${needle}`);
  D3_MUTATIONS.push({ removed: needle.replace(/Math\.random/g, 'Math[random]'),
    replacedWith: replacement.replace(/Math\.random/g, 'Math[random]'), why });
  return region.replace(needle, replacement);
}

// 1. OWN edge granted the demo copy directly. Production equips the real
//    snapshotted Arsenal weapon at Checkpoint E; presentation only reports it.
a1Region = stripMutation(a1Region,
  "if(!wf){M.copyOn=true;M.copyT=6;M.copyFx=0}",
  "if(!wf){M.copyOn=true;M.copyFx=0;emit('ownEdge',{t:A1.t,u:u})}",
  'Gold granted a 6s demo copy at OWN. Production owns equip + lifetime (E).');

// 2. Demo foe weapon-spec mutation.
a1Region = stripMutation(a1Region, "F.wspec=0;", "",
  'mutated the demo foe actor; production has no such field.');

// 3. Presentation RNG for peel flecks.
a1Region = stripMutation(a1Region, "Math.random()<dt*28", "__rand()<dt*28",
  'presentation must never consume the gameplay/combat RNG stream.');

// 4. a2Snap moved the demo fighters. Production performs the ONE atomic
//    exchange (E); presentation receives the already-resolved coordinates.
a2Region = stripMutation(a2Region,
  "M.x=fx;M.y=fy;F.x=ox;F.y=oy;",
  "if(__applyExchange){M.x=fx;M.y=fy;F.x=ox;F.y=oy;}",
  'presentation may not relocate real fighters; gameplay owns the atomic swap.');

// shiftHist() is deliberately RETAINED: the contract requires history be
// REBASED across the exchange, never cleared.
if (!a2Region.includes('shiftHist(fx-ox,fy-oy)')) fail('A2 history rebase lost');

const d3Region = [a1Region, a2Region].join('\n\n');
const D3_REQUIRED = ['function castA1(', 'function stepA1(', 'function a1Frame(', 'function sliceState(',
  'function holdPos(', 'function castA2(', 'function stepA2(', 'function a2Snap('];
for (const r of D3_REQUIRED) if (!d3Region.includes(r)) fail(`D3 region lost required symbol: ${r}`);
if (/Math\.random/.test(d3Region)) fail('D3 region still consumes Math.random');
const d3Sha = crypto.createHash('sha256').update(d3Region).digest('hex');

// Rebind the presentation RNG. Gold calls Math.random directly in 11 places
// across the expression/locomotion beats (coin flips choosing which false face
// reacts, which half twitches, slip sign) plus addCrack's jitter. Presentation
// must never consume the gameplay/combat stream, so every one becomes the
// instance's own dedicated mulberry32. rr() is likewise rebound inside the
// factory. The emitted module is then asserted free of Math.random.
const MATH_RANDOM_SITES = 11;
const seen = (d2Region.match(/Math\.random\(\)/g) || []).length;
if (seen !== MATH_RANDOM_SITES) fail(`expected ${MATH_RANDOM_SITES} Math.random sites in D2, saw ${seen}`);
d2Region = d2Region.replace(/Math\.random\(\)/g, '__rand()');

const D2_REQUIRED = ['const HN=64,HS=22', 'function pushHist()', 'function hs(d,ch)', 'function histFill()',
  'function shiftHist(', 'class Sp{', 'function mkPlate(', 'function mkAcc(', 'function tw(', 'function twStep(',
  'function qStep(', 'function addSweep(', 'function fxStep(', 'function plateExpr(', 'function holdPlate(',
  'function wrongPlate(', 'function idleStep(', 'function beatA()', 'function beatE()', 'function lockStep(',
  'function stepMirror(', 'function onStart(', 'function onTurn(', 'function onStop(', 'function wallHit(',
  'function collide('];
for (const r of D2_REQUIRED) if (!d2Region.includes(r)) fail(`D2 region lost required symbol: ${r}`);
for (const f of ['document.getElementById', 'addEventListener', 'requestAnimationFrame', 'function render('])
  if (d2Region.includes(f)) fail(`D2 region leaked demo symbol: ${f}`);

const d2Sha = crypto.createHash('sha256').update(d2Region).digest('hex');

// NV lives in the PASSIVE section but is pure geometry the node asset needs.
const nvLine = src.split('\n').find((l) => l.startsWith('const NV='));
if (!nvLine) fail('NV node silhouette not found');
// Shared scratch vector used by the plate world-transform helpers (plW/plClip,
// which live inside the A1 banner). Pure scratch, hoisted like NV.
const t2Line = src.split('\n').find((l) => l.startsWith('const _t2='));
if (!t2Line) fail('_t2 scratch not found');

// ---------- S3: prove the cuts kept what D1 must keep ----------
const kept = [utilRegion, rasterRegion, assetKept].join('\n');
const REQUIRED = ['const TAU=', 'const br=', 'function bake(', 'function tone(', 'function facet(',
  'function masked(', 'function bakePlate(', 'function legacyBakeAll(', 'function drawEye(',
  'function drawSmile(', 'function plateBody(', 'function bakeSupport(', 'function bakeArt(',
  'function A_plate(', 'function drawEye2(', 'function drawSmile2(', 'function A_shell(',
  'const PTS=', 'const PLI={};', 'function pinfo(', 'function pick(', 'function dp(',
  'function rimGlow(', 'function inkEdge(', 'function star(', 'function rrect(', 'function foeShape('];
for (const r of REQUIRED) if (!kept.includes(r)) fail(`D1 region lost required symbol: ${r}`);

const FORBIDDEN = ['function frame(', 'function init(', 'function resize(', 'function step(',
  'function resetAll(', 'function buildAuto(', 'function autoStep(', 'function drawDiag(',
  'function castA1(', 'function castA2(', 'function stepProj(', 'function stepNodes(',
  'addEventListener', 'requestAnimationFrame'];
for (const f of FORBIDDEN) if (kept.includes(f)) fail(`D1 region leaked demo/gameplay symbol: ${f}`);

// Raster determinism: the bake path must not consume the ambient RNG.
if (/Math\.random/.test(kept)) fail('D1 region unexpectedly consumes Math.random');
if (/(^|[^\w])rr\(/m.test(kept)) fail('D1 region unexpectedly calls the ambient rr() helper');

const regionSha = crypto.createHash('sha256').update(kept).digest('hex');

// ---------- S4: emit ----------
const out = `// GENERATED by tools/bridgeMirrorGoldV1.mjs — DO NOT EDIT BY HAND.
// Re-run the bridge instead; hand edits are raster drift and the product law forbids them.
//
// Source of truth: ${GOLD}
//   sha256 ${GOLD_SHA} (${GOLD_BYTES} bytes)
// Extracted D1 region sha256: ${regionSha}
//
// CHECKPOINT D1 — Gold static / material core, VERBATIM:
//   baked art atlas, split face + L/R identity, seam, false-face plate assets,
//   living mirror material (tone/facet/rimGlow/inkEdge/sweep), shard + node assets.
//
// Raster determinism: the bake path consumes only the seeded Lehmer stream br()
// (bs = 7, never reseeded) and never Math.random, so the atlas is byte-reproducible
// as long as bake order is bakeSupport() -> bakeArt(). ensureBaked() is the single
// place that order exists; nothing else may bake.
//
// This module is pure presentation material. It owns NO gameplay truth, NO timers
// and NO clock. Checkpoint E (mirrorGameplayRuntime) owns mechanics.
(function (g) {
'use strict';
const doc = typeof document !== 'undefined' ? document : null;

${utilRegion}

// ---- node silhouette (geometry only; hoisted from Gold's PASSIVE section) ----
${nvLine}
${t2Line}

${rasterRegion}

${assetKept}

// =====================================================================================
// CHECKPOINT D2 — temporal history + false-reflection expression + locomotion
// =====================================================================================
//
// PER-INSTANCE STATE. Gold declares its state (E/M/F/H/PL/ACC/hist/TW/Q/SW/FX)
// as module-level singletons because the showcase only ever has one Mirror.
// Production can have P1 Mirror, P2 Mirror, or Mirror-vs-Mirror, so the whole
// region is wrapped in a factory: every call gets its own closure, hence its
// own history ring, springs, plates and pools. The baked art atlas stays
// module-level because it is static and immutable.
//
// DEDICATED PRESENTATION RNG. Gold's ambient rr() is Math.random-backed and
// addCrack calls Math.random directly. Presentation must never consume the
// gameplay/combat stream, so each instance owns a seeded mulberry32 and rr()
// is rebound to it. The bridge fails if Math.random survives anywhere.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMirrorInstance(options) {
  const opts = options || {};
  ensureBaked();
  // Dedicated presentation stream. Never the gameplay/combat RNG.
  let __rand = mulberry32((opts.seed >>> 0) || 0x9E3779B9);
  const rr = (a, b) => a + __rand() * (b - a);

${d2Region.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

  // ---- D3 semantic edges + exchange control -------------------------------
  // The authored timeline REPORTS its canonical edges; it never performs the
  // gameplay effect. Production subscribes and owns equip / relocation.
  const __listeners = {};
  function on(evt, fn) { (__listeners[evt] || (__listeners[evt] = [])).push(fn); return () => off(evt, fn); }
  function off(evt, fn) { const a = __listeners[evt]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  function emit(evt, payload) { const a = __listeners[evt]; if (a) for (const f of a.slice()) { try { f(payload); } catch (e) { /* listener isolation */ } } }
  // When false (production default) a2Snap performs its visual consequences and
  // REBASES history, but does not move the actors -- gameplay already did.
  let __applyExchange = !!opts.applyExchange;

${d3Region.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

  // Instance initialisation. Gold builds these inside the demo's resetAll();
  // only the state-construction part belongs in production.
  PL = [
    mkPlate('UL', 'L', .095, .30, 230, 10, .8, 10),
    mkPlate('UR', 'R', .115, .26, 170, 12, .6, 7),
    mkPlate('LL', 'L', .145, .36, 200, 9, 1.0, 14),
    mkPlate('LR', 'R', .17, .4, 150, 9, 1.25, 18),
  ];
  ACC = mkAcc();
  hHead = 0;
  histFill();

  return {
    // state
    get E() { return E; }, get M() { return M; }, get F() { return F; },
    get H() { return H; }, get PL() { return PL; }, get ACC() { return ACC; },
    get I() { return I; }, get cam() { return cam; },
    hist, HN, HS, get hHead() { return hHead; },
    // temporal history
    pushHist, hs, histFill, shiftHist,
    // expression engine
    plateExpr, holdPlate, wrongPlate, busy, idleStep,
    // locomotion + reactions
    stepMirror, onStart, onTurn, onStop, wallHit, collide, lockStep,
    // scheduling / fx pools
    tw, twStep, later, qStep, addSweep, sweepStep, sweepsFor,
    fxNew, chips, flecks, ripple, addCrack, fxStep,
    mkPlate, mkAcc,
    // D3 authored choreography (reports edges; performs no gameplay)
    castA1, stepA1, castA2, stepA2, a2Snap, a1Frame, sliceState, holdPos,
    get A1() { return A1; }, get A2() { return A2; },
    on, off,
    setApplyExchange(v) { __applyExchange = !!v; },
    get applyExchange() { return __applyExchange; },
    // deterministic presentation RNG control
    reseed(seed) { __rand = mulberry32((seed >>> 0) || 0x9E3779B9); },
    random() { return __rand(); },
    constants: Object.freeze({ K, CX, CY, MR, FR, SPD, WS, STEP, ARENA, HN, HS }),
  };
}

// =====================================================================================
// PRODUCTION SURFACE (D1)
// =====================================================================================
// Gold bakes at init(). Production bakes lazily on first use, in Gold's order.
let baked = false;
let bakeError = null;
function ensureBaked() {
  if (baked || bakeError) return baked;
  if (!doc) { bakeError = new Error('no document'); return false; }
  try {
    bs = 7;              // Gold's authored baker seed, restated so a re-bake is identical
    bakeSupport();
    bakeArt();
    baked = true;
  } catch (e) {
    bakeError = e;
  }
  return baked;
}

// Asset inventory, taken from Gold's own diagnostic sheet.
const ASSET_NAMES = Object.freeze(['Lh', 'Rh', 'UL', 'UR', 'LL', 'LR', 'shard', 'eshard', 'ghost', 'eL', 'eR', 'sL', 'sR']);

// Authored reference geometry the production adapter derives its scale from.
// These are Gold's OWN numbers; production must divide by them rather than
// invent a multiplier.
const GOLD_REF = Object.freeze({
  ARENA: 1000,          // Gold arena extent
  MIRROR_R: 34,         // Gold's own fighter radius (MR)
  FOE_R: 26,            // Gold's foe radius (FR)
  SPD: 250,             // Gold locomotion speed
  REF_SPACE: 1254,      // raster baker reference space (1254x1254 MAIN LOOK)
  NV,                   // node silhouette, node-local units
  PLATES: Object.freeze(['UL', 'UR', 'LL', 'LR']),
});

function assetInfo(name) {
  if (!ensureBaked()) return null;
  const p = P[name];
  return p ? { name, w: p.w, h: p.h, ox: p.ox, oy: p.oy, levels: p.lv.length } : null;
}

function drawAsset(ctx2d, name, ppu) {
  if (!ensureBaked() || !P[name]) return false;
  dp(ctx2d, name, ppu);
  return true;
}

function drawAssetMasked(ctx2d, name, ppu, fill, alpha, comp) {
  if (!ensureBaked() || !P[name]) return false;
  masked(ctx2d, name, ppu, fill, alpha, comp);
  return true;
}

g.APEX_MIRROR_GOLD = {
  version: '1.2.0-d3-a1-a2-choreography',
  goldSha256: '${GOLD_SHA}',
  regionSha256: '${regionSha}',
  checkpoint: 'D3',
  d2RegionSha256: '${d2Sha}',
  d3RegionSha256: '${d3Sha}',
  d3RemovedMutations: ${JSON.stringify(D3_MUTATIONS)},
  createMirrorInstance, mulberry32,
  // material / raster core
  P, PTS, PLI, NV, STOPS, ASSET_NAMES, GOLD_REF,
  ensureBaked, assetInfo, drawAsset, drawAssetMasked,
  get baked() { return baked; },
  get bakeError() { return bakeError; },
  // Gold primitives the later D phases draw with
  tone, poly, facet, rimGlow, inkEdge, star, rrect, bake, pick, dp, masked,
  sweepFill, solidFill, pinfo, plateBody, drawEye, drawSmile, drawEye2, drawSmile2,
  foeShape, A_plate, A_shell, A_plane, A_line,
  // util
  TAU, clamp, lerp, sstep, eo3, eio, mk, angLerp,
};
g.apexMirrorGoldV1 = 'ready';

})(typeof window !== 'undefined' ? window : globalThis);
`;

const DEST = 'public/game/hero-rework/mirrorGoldV1.js';
fs.writeFileSync(path.join(ROOT, DEST), out);
console.log(`[mirror-bridge] D1 wrote ${DEST}`);
console.log(`[mirror-bridge]   gold   sha256 ${GOLD_SHA}`);
console.log(`[mirror-bridge]   region sha256 ${regionSha}`);
console.log(`[mirror-bridge]   d2     sha256 ${d2Sha}`);
console.log(`[mirror-bridge]   d3     sha256 ${d3Sha}`);
console.log(`[mirror-bridge]   d3 removed ${D3_MUTATIONS.length} demo gameplay mutations`);
console.log(`[mirror-bridge]   bytes ${out.length}, lines ${out.split('\n').length}`);
