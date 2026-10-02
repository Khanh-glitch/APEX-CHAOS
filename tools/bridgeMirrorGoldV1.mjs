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

// NV lives in the PASSIVE section but is pure geometry the node asset needs.
const nvLine = src.split('\n').find((l) => l.startsWith('const NV='));
if (!nvLine) fail('NV node silhouette not found');

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

${rasterRegion}

${assetKept}

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
  version: '1.0.0-d1-static-material-core',
  goldSha256: '${GOLD_SHA}',
  regionSha256: '${regionSha}',
  checkpoint: 'D1',
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
console.log(`[mirror-bridge]   bytes ${out.length}, lines ${out.split('\n').length}`);
