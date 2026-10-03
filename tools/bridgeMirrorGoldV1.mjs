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
const springRegion = cut('FOE (functional opponent only) + SPRINGS',
  'A1 — MIRROR ARSENAL  (NOTICE → LOCK → REFLECT → PEEL → REFORM → OWN)');
const springMatch = springRegion.match(/function stepSprings\(dt\)\{[\s\S]*?\n\}/);
if (!springMatch) fail('Gold presentation springs function not found');
let externalSprings = springMatch[0]
  .replace('function stepSprings(dt)', 'function stepExternalSprings(dt)');
const CAMERA_SPRINGS = 'cam.sx.step(0,dt);cam.sy.step(0,dt);';
if (!externalSprings.includes(CAMERA_SPRINGS)) fail('camera spring cut site not found');
externalSprings = externalSprings.replace(CAMERA_SPRINGS, '');
externalSprings = externalSprings
  .replace("for(const s of ['L','R']){const h=H[s];h.x.step(0,dt);h.y.step(0,dt);h.r.step(0,dt)}",
    "for(let i=0;i<2;i++){const h=H[i?'R':'L'];h.x.step(0,dt);h.y.step(0,dt);h.r.step(0,dt)}")
  .replace('for(const p of PL){', 'for(let i=0;i<PL.length;i++){const p=PL[i];')
  .replace('for(const a of ACC){', 'for(let i=0;i<ACC.length;i++){const a=ACC[i];')
  .replace(/[ \\t]+$/gm, '');

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
  "if(!wf){if(!__externalTruth){M.copyOn=true;M.copyFx=0;emit('ownEdge',{t:A1.t,u:u})}}",
  'Gold granted a 6s demo copy at OWN. Production owns equip + lifetime (E).');

// 2. Demo foe weapon-spec mutation.
a1Region = stripMutation(a1Region, "F.wspec=0;", "",
  'mutated the demo foe actor; production has no such field.');

// 3. Presentation RNG for peel flecks.
a1Region = stripMutation(a1Region, "Math.random()<dt*28", "__rand()<dt*28",
  'presentation must never consume the gameplay/combat RNG stream.');
for (const [regionName, region] of [['A1', a1Region], ['A2', a2Region]]) {
  const needle = regionName === 'A1' ? 'M.busy=Math.max(M.busy,2.2);' : 'M.busy=Math.max(M.busy,1.8)';
  if (!region.includes(needle)) fail(`${regionName} cast busy edge not found`);
  if (regionName === 'A1') a1Region = region.replace(needle, 'if(!__externalTruth)M.busy=Math.max(M.busy,2.2);');
  else a2Region = region.replace(needle, 'if(!__externalTruth)M.busy=Math.max(M.busy,1.8)');
}

// 4. a2Snap moved the demo fighters. Production performs the ONE atomic
//    exchange (E); presentation receives the already-resolved coordinates.
a2Region = stripMutation(a2Region,
  "M.x=fx;M.y=fy;F.x=ox;F.y=oy;",
  "if(__applyExchange){M.x=fx;M.y=fy;F.x=ox;F.y=oy;}",
  'presentation may not relocate real fighters; gameplay owns the atomic swap.');

// shiftHist() is deliberately RETAINED: the contract requires history be
// REBASED across the exchange, never cleared. The executable real exchange
// event, not Gold's local .25 threshold, invokes a2Snap in external-truth mode.
if (!a2Region.includes('shiftHist(fx-ox,fy-oy)')) fail('A2 history rebase lost');
a2Region = a2Region.replace('shiftHist(fx-ox,fy-oy);',
  'if(!__skipExternalHistoryShift)shiftHist(fx-ox,fy-oy);');
const cameraSnap = 'cam.sx.v+=Math.sign(dx)*22;';
if (!a2Region.includes(cameraSnap)) fail('A2 camera-only snap mutation not found');
a2Region = stripMutation(a2Region, cameraSnap, '',
  'production has no Gold demo camera; actor roots and visual history remain authoritative');
const a2SnapEntry = 'function a2Snap(){';
if (!a2Region.includes(a2SnapEntry)) fail('A2 snap function entry not found');
a2Region = a2Region.replace(a2SnapEntry,
  'function a2Snap(){if(__externalTruth)__externalSnaps++;');

// Gold owns the authored finish choreography, while real Mirror end events
// remain the lifecycle authority in production. Preserve the original demo
// finish blocks and defer them to explicit external end calls when bridged.
function callbackBlock(region, needle, label, from = 0) {
  const start = region.indexOf(needle, from);
  if (start < 0) fail(`${label} callback not found`);
  const open = start + needle.length - 1;
  if (region[open] !== '{') fail(`${label} callback opening brace moved`);
  let depth = 0, quote = '', lineComment = false, blockComment = false;
  for (let i = open; i < region.length; i++) {
    const ch = region[i], next = region[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      if (region.slice(i, i + 3) !== '});') fail(`${label} callback closing edge changed`);
      return { start, open, close: i, body: region.slice(open + 1, i) };
    }
  }
  fail(`${label} callback is unterminated`);
}
const A1_END_EDGE = "once('end',u>=.92,()=>{";
let a1End = callbackBlock(a1Region, A1_END_EDGE, 'A1 end');
const a1FinishBody = a1End.body.trim();
if (!a1FinishBody.startsWith('A1.on=false;')) fail('A1 end body changed unexpectedly');
const a1FinishFn = `function finishA1(){if(!A1.on)return false;const pl=A1.pl;A1.on=false;${a1FinishBody.slice('A1.on=false;'.length)}return true}\n`;
const a1StepAt = a1Region.indexOf('function stepA1(dt){');
if (a1StepAt < 0) fail('A1 step function not found');
a1Region = a1Region.slice(0, a1StepAt) + a1FinishFn + a1Region.slice(a1StepAt);
a1End = callbackBlock(a1Region, A1_END_EDGE, 'A1 end', a1StepAt + a1FinishFn.length);
a1Region = a1Region.slice(0, a1End.start) +
  "once('end',u>=.92,()=>{if(!__externalTruth)finishA1();});" + a1Region.slice(a1End.close + 3);

const A2_CAST_EDGE = 'function castA2(){if(A1.on||A2.on)return;';
if (!a2Region.includes(A2_CAST_EDGE)) fail('A2 cast entry not found');
a2Region = a2Region.replace(A2_CAST_EDGE,
  'function castA2(){if(A1.on||A2.on)return;if(__externalTruth){__externalA2CastId=null;__externalA2Resolved=false;__externalExchangeCastId=null;}');
const A2_END_EDGE = "once('e',u>=.64,()=>{";
let a2End = callbackBlock(a2Region, A2_END_EDGE, 'A2 end');
const a2FinishBody = a2End.body.trim();
if (!a2FinishBody.startsWith('A2.on=false;')) fail('A2 end body changed unexpectedly');
const a2FinishFn = `function finishA2(){if(!A2.on)return false;A2.on=false;${a2FinishBody.slice('A2.on=false;'.length)}return true}\n`;
const a2StepAt = a2Region.indexOf('function stepA2(dt){');
if (a2StepAt < 0) fail('A2 step function not found');
a2Region = a2Region.slice(0, a2StepAt) + a2FinishFn + a2Region.slice(a2StepAt);
a2End = callbackBlock(a2Region, A2_END_EDGE, 'A2 end', a2StepAt + a2FinishFn.length);
a2Region = a2Region.slice(0, a2End.start) +
  "once('e',u>=.64,()=>{if(!__externalTruth)finishA2();});" + a2Region.slice(a2End.close + 3);
const A2_SNAP_EDGE = "once('x',u>=.25,a2Snap);";
if (!a2Region.includes(A2_SNAP_EDGE)) fail('A2 authored snap edge not found');
a2Region = a2Region.replace(A2_SNAP_EDGE,
  "once('x',u>=.25,()=>{if(!__externalTruth)a2Snap()});");

// Draw helpers the A1/A2 sites need: plate/half/site/residue rendering.
// Everything from the RENDERING banner up to the projectile marker; the
// shard/node/projectile draws after it belong to D4.
let renderRegion = src.slice(BANNER('RENDERING — MIRROR RIG (raster parts only)'));
const PROJ_MARK = '// ---------- projectiles ----------';
const pm = renderRegion.indexOf(PROJ_MARK);
if (pm < 0) fail('projectile marker not found in RENDERING');
renderRegion = renderRegion.slice(0, pm).replace(/\s+$/, '');

// --- REAL ARSENAL WEAPON ADAPTER (section 14 CRITICAL requirement) ---
// Gold draws its own demo weapon rasters P.wpnMV / P.wpn. The authored
// choreography (flat reflected image -> peel -> lifted slices -> material
// gain -> held weapon) stays exactly as Gold wrote it; ONLY the source
// imagery becomes the actual snapshotted Arsenal weapon.
const WEAPON_SITES = [];
function swapWeaponArt(region, needle, replacement, note) {
  if (!region.includes(needle)) fail(`weapon art site not found: ${needle}`);
  WEAPON_SITES.push({ site: needle, note });
  return region.replace(needle, replacement);
}
a1Region = swapWeaponArt(a1Region,
  "const pM=P.wpnMV,pR=P.wpn,ppu=PPW*WS*A1SS",
  "const __wa=__weaponArt(),pM=__wa.mv,pR=__wa.real,ppu=PPW*WS*A1SS",
  'A1 reflection + peel slices use the real copied weapon atlas');
a1Region = swapWeaponArt(a1Region,
  "masked(g,'wpnMV',ppu,sweepFill(clamp((A1.u-.12)/.14,0,1),.4,.2),.9*A1.rv,null)",
  "maskedEntry(g,pM,ppu,sweepFill(clamp((A1.u-.12)/.14,0,1),.4,.2),.9*A1.rv,null)",
  'flat-in-plate sheen masks the real weapon silhouette');
a1Region = swapWeaponArt(a1Region,
  "const pM=P.wpnMV,wl=pM.w/A1N,hh=pM.h/A1R",
  "const pM=__weaponArt().mv,wl=pM.w/A1N,hh=pM.h/A1R",
  'sliceState geometry derives from the real weapon bounds');
renderRegion = swapWeaponArt(renderRegion,
  "g.save();g.scale(1.08,1.14);masked(g,'wpn',PPW*WS,solidFill('rgba(165,105,255,1)'),.5,'lighter');g.restore();\n  dp(g,'wpn',PPW*WS);",
  "const __hw=__weaponArt().real;\n  g.save();g.scale(1.08,1.14);maskedEntry(g,__hw,PPW*WS,solidFill('rgba(165,105,255,1)'),.5,'lighter');g.restore();\n  dpEntry(g,__hw,PPW*WS);",
  'held weapon after OWN is the real copied weapon');
renderRegion = swapWeaponArt(renderRegion,
  "const sp=(simT*.45)%3;if(sp<.7&&M.copyFx<=0)masked(g,'wpn',PPW*WS,sweepFill(sp/.7,.4,.14),.35,null);",
  "const sp=(simT*.45)%3;if(sp<.7&&M.copyFx<=0)maskedEntry(g,__hw,PPW*WS,sweepFill(sp/.7,.4,.14),.35,null);",
  'held-weapon sweep masks the real weapon');
a1Region = swapWeaponArt(a1Region,
  "const kf=A1.q*1.35*A1N,i=A1N-kf,lx=P.wpnMV.ox+i*(P.wpnMV.w/A1N)-(P.wpnMV.ox+P.wpnMV.w/2);",
  "const __fm=__weaponArt().mv,kf=A1.q*1.35*A1N,i=A1N-kf,lx=__fm.ox+i*(__fm.w/A1N)-(__fm.ox+__fm.w/2);",
  'peel-edge flecks follow the real weapon bounds');
if (/P\.wpnMV|P\.wpn\b|'wpnMV'|'wpn'/.test(a1Region))
  fail('A1 still references Gold demo weapon rasters');

let d3Region = [a1Region, a2Region, renderRegion].join('\n\n');
const GOLD_WARM_PLATE_FILL = "const whiteFill=solidFill('rgba(240,234,255,1)'),warmFill=solidFill('rgba(255,150,70,1)');";
const GOLD_OPPONENT_PLATE_TINT = "if(p.tint>.01)masked(g,p.id,PU,warmFill,p.tint*.42);";
if (d3Region.split(GOLD_WARM_PLATE_FILL).length !== 2
    || d3Region.split(GOLD_OPPONENT_PLATE_TINT).length !== 2)
  fail('Gold opponent-derived plate tint insertion sites changed');
d3Region = d3Region.replace(GOLD_WARM_PLATE_FILL,
  "const whiteFill=solidFill('rgba(240,234,255,1)');");
d3Region = d3Region.replace(GOLD_OPPONENT_PLATE_TINT,
  'if(p.tint>.01)masked(g,p.id,PU,opponentReflectionFill,p.tint*.42);');
const GOLD_REFLECTION_SEAM = "let gr=g.createLinearGradient(ub-9,0,ub+9,0);gr.addColorStop(0,'rgba(170,120,255,0)');gr.addColorStop(.5,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(170,120,255,0)');";
if (d3Region.split(GOLD_REFLECTION_SEAM).length !== 2)
  fail('Gold A2 opponent-reflection seam insertion site changed');
d3Region = d3Region.replace(GOLD_REFLECTION_SEAM,
  "const opponentReflection=typeof __mirrorEntityOpponentDraw==='function';let gr=g.createLinearGradient(ub-9,0,ub+9,0);gr.addColorStop(0,opponentReflection?__opponentReflectionPaint.sweepClear:'rgba(170,120,255,0)');gr.addColorStop(.5,'rgba(255,255,255,.85)');gr.addColorStop(1,opponentReflection?__opponentReflectionPaint.sweepClear:'rgba(170,120,255,0)');");

// ---------- D4: shard / node / routing presentation ----------
// Everything from the projectile marker to the WORLD RENDER banner: the
// projectile bolt, free shard, assembling/ACTIVE node body, and the FX pool
// draw. Verbatim; the demo world render / camera / floor stay out.
let d4Region = src.slice(BANNER('RENDERING — MIRROR RIG (raster parts only)'));
const d4Start = d4Region.indexOf(PROJ_MARK);
const d4End = d4Region.indexOf('// =====================================================================================\n// WORLD RENDER');
if (d4Start < 0 || d4End < 0 || d4End < d4Start) fail('cannot isolate D4 render region');
d4Region = d4Region.slice(d4Start, d4End).replace(/\s+$/, '');

// drawFloor is the demo arena floor; it lives past the WORLD RENDER banner so
// the slice above already excludes it. Guard anyway.
const floorAt = d4Region.indexOf('function drawFloor(');
if (floorAt >= 0) d4Region = d4Region.slice(0, floorAt).replace(/\s+$/, '');

// The node/shard state Gold's draws read lives in the PASSIVE banner. Only the
// pure DATA declarations are imported; every gameplay function in that banner
// (spawnShard, tryForm, formNode, stepShards, stepNodes, routeProj, passiveProc)
// is deliberately EXCLUDED -- gameplay owns the lifecycle, F1/F2 own routing.
const passiveRegion = cut('PASSIVE — SHARDS, FORMATION, NODES', 'FOE (functional opponent only) + SPRINGS');
// SH/ND/PJ pool declarations are multi-line in Gold, so extract each by
// scanning to balanced brackets rather than by line.
// Each pool is `const X=[];for(...)X.push({...});` which may span lines, so
// capture from the declaration up to the next top-level statement rather than
// stopping at the first semicolon.
function extractDecl(text, startsWith) {
  const i = text.indexOf(startsWith);
  if (i < 0) return null;
  const lines = text.slice(i).split('\n');
  const out = [lines[0]];
  for (let k = 1; k < lines.length; k++) {
    if (/^(const |let |function |\/\/|\/\*)/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out.join('\n').replace(/\s+$/, '');
}
const D4_STATE_LINES = [];
for (const d of ['const SH=', 'const ND=']) {
  const got = extractDecl(passiveRegion, d);
  if (!got || !/\.push\(/.test(got)) fail(`D4 pool declaration not captured: ${d}`);
  D4_STATE_LINES.push(got);
}
const pjDecl = extractDecl(src, 'const PJ=');
if (!pjDecl || !/\.push\(/.test(pjDecl)) fail('PJ pool not captured');
D4_STATE_LINES.push(pjDecl);
const d4Helpers = ['function nodeToWorld(', 'function nodeCap(', 'function setImg(', 'function nodeRipple('];
const helperSrc = [];
for (const h of d4Helpers) {
  const i = passiveRegion.indexOf(h);
  if (i < 0) fail(`D4 helper not found: ${h}`);
  const j = passiveRegion.indexOf('\nfunction ', i + 1);
  helperSrc.push(passiveRegion.slice(i, j < 0 ? undefined : j).replace(/\s+$/, ''));
}
const d4State = [...D4_STATE_LINES, ...helperSrc].join('\n');

for (const forbidden of ['function tryForm(', 'function formNode(', 'function stepShards(',
  'function stepNodes(', 'function routeProj(', 'function spawnShard(', 'function passiveProc(']) {
  if (d4State.includes(forbidden) || d4Region.includes(forbidden))
    fail(`D4 leaked passive GAMEPLAY function: ${forbidden}`);
}
const D4_REQUIRED = ['function drawShardAt(', 'function drawFreeShard(', 'function drawNodeBody(',
  'function drawFX(', 'function drawProj(', 'function drawBolt('];
for (const r of D4_REQUIRED) if (!d4Region.includes(r)) fail(`D4 region lost required symbol: ${r}`);
if (/Math\.random/.test(d4Region)) fail('D4 region consumes Math.random');
// Production may provide the shared gameplay node transform as an affine
// basis. Gold retains its authored local NV art, but its world transform then
// comes from HR.mirrorNode rather than an independently reproduced rotation.
const NODE_ROTATE = 'g.rotate(n.rot);';
const nodeDrawAt = d4Region.indexOf('function drawNodeBody(');
const nodeDrawEnd = d4Region.indexOf('\nfunction drawFX(', nodeDrawAt);
if (nodeDrawAt < 0 || nodeDrawEnd < 0) fail('cannot isolate drawNodeBody for shared transform adapter');
let nodeDraw = d4Region.slice(nodeDrawAt, nodeDrawEnd);
if ((nodeDraw.match(/g\.rotate\(n\.rot\);/g) || []).length !== 1)
  fail('drawNodeBody shared transform insertion site changed');
nodeDraw = nodeDraw.replace(NODE_ROTATE,
  "if(n.worldTransform){const q=n.worldTransform;g.transform(q.a,q.b,q.c,q.d,0,0)}else g.rotate(n.rot);");
const GOLD_NODE_SWEEP = "gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.33,'rgba(236,230,255,'+(.4*(1-coh*.5))+')');gr.addColorStop(.46,'rgba(255,255,255,.1)');gr.addColorStop(.6,'rgba(205,195,255,.3)');gr.addColorStop(1,'rgba(255,255,255,0)');";
if (nodeDraw.split(GOLD_NODE_SWEEP).length !== 2)
  fail('drawNodeBody opponent-reflection sweep insertion site changed');
nodeDraw = nodeDraw.replace(GOLD_NODE_SWEEP,
  "gr.addColorStop(0,__opponentReflectionPaint.sweepClear);gr.addColorStop(.33,opponentReflectionColor(.4*(1-coh*.5)));gr.addColorStop(.46,'rgba(255,255,255,.1)');gr.addColorStop(.6,__opponentReflectionPaint.sweep30);gr.addColorStop(1,__opponentReflectionPaint.sweepClear);");
const GOLD_NODE_DYNAMIC_SWEEP = "for(const w of n.sw)if(w.on){const p=w.t/w.d,gr2=g.createLinearGradient(-40+p*100-16,-60,-40+p*100+16,60);gr2.addColorStop(0,'rgba(170,120,255,0)');gr2.addColorStop(.5,'rgba(255,255,255,'+(.7*w.amp*Math.sin(Math.PI*p))+')');gr2.addColorStop(1,'rgba(170,120,255,0)');g.fillStyle=gr2;g.fillRect(-40,-70,80,140)}";
if (nodeDraw.split(GOLD_NODE_DYNAMIC_SWEEP).length !== 2)
  fail('drawNodeBody formed-material sweep insertion site changed');
nodeDraw = nodeDraw.replace(GOLD_NODE_DYNAMIC_SWEEP,
  "for(const w of n.sw)if(w.on){const p=w.t/w.d,gr2=g.createLinearGradient(-40+p*100-16,-60,-40+p*100+16,60);gr2.addColorStop(0,__opponentReflectionPaint.sweepClear);gr2.addColorStop(.5,'rgba(255,255,255,'+(.7*w.amp*Math.sin(Math.PI*p))+')');gr2.addColorStop(1,__opponentReflectionPaint.sweepClear);g.fillStyle=gr2;g.fillRect(-40,-70,80,140)}");
d4Region = d4Region.slice(0, nodeDrawAt) + nodeDraw + d4Region.slice(nodeDrawEnd);
const GOLD_SHARD_SWEEP = "for(const s of SW)if(s.on&&s.dl<=0&&s.nm==='sh'+idx)masked(g,'shard',ppu,sweepFill(s.t/s.d,s.ang,s.bw),s.amp*Math.sin(Math.PI*clamp(s.t/s.d,0,1)),null);";
if (d4Region.split(GOLD_SHARD_SWEEP).length !== 2)
  fail('drawShardAt opponent-reflection sweep insertion site changed');
d4Region = d4Region.replace(GOLD_SHARD_SWEEP,
  "for(const s of SW)if(s.on&&s.dl<=0&&s.nm==='sh'+idx)masked(g,'shard',ppu,opponentReflectionSweepFill(s.t/s.d,s.ang,s.bw),s.amp*Math.sin(Math.PI*clamp(s.t/s.d,0,1)),null);");
const d4Full = [d4State, d4Region].join('\n\n');
const d4Sha = crypto.createHash('sha256').update(d4Full).digest('hex');
const D3_REQUIRED = ['function castA1(', 'function stepA1(', 'function a1Frame(', 'function sliceState(',
  'function holdPos(', 'function castA2(', 'function stepA2(', 'function a2Snap(',
  'function drawA1World(', 'function drawSite(', 'function drawHalf(', 'function clipHalf(',
  'function strips(', 'function drawResidue(', 'function drawPlate(', 'function rigFull(',
  'function drawHeld(', 'function drawMirrorEntity(', 'function drawFoeEntity('];
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

// The authored A2 sweep on its opponent-derived plate is reflection light,
// while all other plate sweeps remain generic Mirror specular. Resolve that
// narrow target at draw time; Gold retains the original sweep envelope.
const GOLD_SWEEPS_FOR = "function sweepsFor(g,nm){for(const s of SW){if(s.on&&s.dl<=0&&s.nm===nm)masked(g,nm,PU,sweepFill(s.t/s.d,s.ang,s.bw),s.amp*Math.sin(Math.PI*clamp(s.t/s.d,0,1)*.9+.15),null)}}";
if (!d2Region.includes(GOLD_SWEEPS_FOR)) fail('D2 opponent-reflection sweep insertion site changed');
d2Region = d2Region.replace(GOLD_SWEEPS_FOR,
  "function sweepsFor(g,nm){const reflected=A2.on&&A2.opp&&A2.opp.id===nm;for(const s of SW){if(s.on&&s.dl<=0&&s.nm===nm)masked(g,nm,PU,reflected?opponentReflectionSweepFill(s.t/s.d,s.ang,s.bw):sweepFill(s.t/s.d,s.ang,s.bw),s.amp*Math.sin(Math.PI*clamp(s.t/s.d,0,1)*.9+.15),null)}}");

const D2_REQUIRED = ['const HN=64,HS=22', 'function pushHist()', 'function hs(d,ch)', 'function histFill()',
  'function shiftHist(', 'class Sp{', 'function mkPlate(', 'function mkAcc(', 'function tw(', 'function twStep(',
  'function qStep(', 'function addSweep(', 'function fxStep(', 'function plateExpr(', 'function holdPlate(',
  'function wrongPlate(', 'function idleStep(', 'function beatA()', 'function beatE()', 'function lockStep(',
  'function stepMirror(', 'function onStart(', 'function onTurn(', 'function onStop(', 'function wallHit(',
  'function collide('];
for (const r of D2_REQUIRED) if (!d2Region.includes(r)) fail(`D2 region lost required symbol: ${r}`);
if (!externalSprings.includes('function stepExternalSprings(dt){')
  || externalSprings.includes('cam.sx.step') || externalSprings.includes('cam.sy.step'))
  fail('external spring region must retain authored body springs and omit camera simulation');
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

// R1 semantic boundary: Gold owns only bounded presentation proxies. Real
// shard/node/projectile lifecycle, F1 formation and F2 routing remain outside.
const EXTERNAL_PASSIVE_API = `
  // ---- R1: Gold-owned semantic passive presentation ----------------------
  // Slots are identities, not a second allocator. The caller supplies the real
  // stable shard slot and node ID; Gold only projects them into SH / bounded ND.
  const __externalShardIdentities = new Array(SH.length).fill(null);
  const __externalShardBound = new Array(SH.length).fill(false);
  const __externalNodeBindings = new Map();
  const __externalRoutes = new Map();
  const __externalImageOwners = new Map();
  const __externalHistoryKeys = new Map();
  let __externalPassiveSteps = 0, __externalRouteEvents = 0, __externalHistoryRebases = 0;

  function __finite(v, fallback) { return Number.isFinite(v) ? v : fallback; }
  function __validPoint(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  function __sweepReset(w) { w.on = false; w.t = 0; w.d = .7; w.ang = .8; w.amp = .8; }
  function __resetExternalShardSweeps(slotIndex) {
    const name = 'sh' + slotIndex;
    for (const w of SW) if (w.nm === name) {
      w.on = false; w.nm = ''; w.t = 0; w.d = 1; w.ang = 0; w.amp = .8; w.bw = .18; w.dl = 0;
    }
  }
  function __detachExternalNodeShard(s, n) {
    if (!s || s.node !== n) return;
    __resetExternalShardSweeps(SH.indexOf(s));
    delete s.node; s.rot = 0; s.ta = 0; s.frot = 0;
    s.tx = 0; s.ty = 0; s.trot = 0; s.tlen = 0; s.twid = 0; s.mt0 = 0;
    s.dsx = .087; s.dsy = .087; s.faceA = 0;
    delete s.dist; delete s.trotAdj; delete s.__externalTravelStarted;
  }
  function __resetExternalShard(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SH.length) return false;
    const s = SH[slotIndex];
    __resetExternalShardSweeps(slotIndex);
    for (const n of ND) {
      const at = n.sh.indexOf(s);
      if (at >= 0) n.sh.splice(at, 1);
    }
    s.on = false; s.st = 0; s.x = 0; s.y = 0; s.vx = 0; s.vy = 0;
    s.rot = 0; s.ta = 0; s.side = 'L'; s.pe = 0; s.pn = 0; s.ps = 0;
    s.ph = 0; s.age = 0; s.fx = 0; s.fy = 0; s.frot = 0;
    s.tx = 0; s.ty = 0; s.trot = 0; s.tlen = 0; s.twid = 0; s.mt0 = 0;
    s.moving = false; s.rep = 3; s.repT = 0; s.spt = 0; s.sa = 0;
    s.dsx = .087; s.dsy = .087; s.faceA = 0; s.eyeP = 0; s.spc = 0;
    delete s.node; delete s.dist; delete s.trotAdj; delete s.__externalTravelStarted;
    __externalShardIdentities[slotIndex] = null; __externalShardBound[slotIndex] = false;
    return true;
  }
  function __resetExternalNode(proxyIndex) {
    if (!Number.isInteger(proxyIndex) || proxyIndex < 0 || proxyIndex >= ND.length) return false;
    const n = ND[proxyIndex];
    const linked = n.sh.slice();
    for (const s of linked) __detachExternalNodeShard(s, n);
    n.on = false; n.st = 0; n.t = 0; n.age = 0; n.x = 0; n.y = 0; n.rot = 0;
    n.fill = 0; n.fold = 0; n.sh.length = 0; n.tlock = -1; n.t3 = 0; n.flash = 0;
    n.swc = 2; n.fa = 2; n.faT = -1; n.faW = 0;
    n.img.on = false; n.img.k = 0; n.img.t = 0; n.img.d = .5; n.img.ang = 0;
    n.img.pw = 1; n.img.own = 0; n.img.sx = 0; n.img.sy = 0; n.img.dx = 1; n.img.dy = 0;
    for (const r of n.rp) { r.t = 9; r.x = 0; r.y = 0; }
    for (const w of n.sw) __sweepReset(w);
    delete n.__externalPreviousStage; n.externalGeometry = null; n.worldTransform = null;
    return true;
  }
  function __removeRoute(routeId) {
    const route = __externalRoutes.get(routeId);
    if (!route) return false;
    for (const nodeId of [route.entryNodeId, route.destinationNodeId]) {
      const owners = __externalImageOwners.get(nodeId);
      if (owners) { owners.delete(routeId); if (!owners.size) __externalImageOwners.delete(nodeId); }
    }
    __externalRoutes.delete(routeId);
    return true;
  }
  // Node proxies own only node-local image feedback. Semantic route records
  // retain immutable IDs and survive either endpoint's visual-node lifetime.
  function __dropNodeImageOwners(nodeId) {
    __externalImageOwners.delete(nodeId);
  }
  function __nodeForExternalId(nodeId) {
    const proxyIndex = __externalNodeBindings.get(nodeId);
    return proxyIndex == null ? null : ND[proxyIndex];
  }
  function __addImageOwner(nodeId, routeId) {
    let owners = __externalImageOwners.get(nodeId);
    if (!owners) { owners = new Set(); __externalImageOwners.set(nodeId, owners); }
    owners.add(routeId);
  }
  function __sharedNodeGeometry(geometry) {
    if (!geometry || typeof geometry.toWorld !== 'function' || !Array.isArray(geometry.NV)
        || geometry.NV.length !== NV.length) return false;
    for (let i = 0; i < NV.length; i++) {
      if (!Array.isArray(geometry.NV[i]) || geometry.NV[i].length < 2
          || geometry.NV[i][0] !== NV[i][0] || geometry.NV[i][1] !== NV[i][1]) return false;
    }
    return true;
  }
  function __worldPoint(geometry, n, lx, ly) {
    const p = geometry.toWorld(n, lx, ly);
    if (!__validPoint(p)) throw new TypeError('HR.mirrorNode.toWorld must return a finite point');
    return p;
  }
  function __deriveExternalNodeEdges(n, geometry, memberSlots) {
    const origin = __worldPoint(geometry, n, 0, 0);
    const ux = __worldPoint(geometry, n, 1, 0), uy = __worldPoint(geometry, n, 0, 1);
    n.worldTransform = { a: ux.x - origin.x, b: ux.y - origin.y,
      c: uy.x - origin.x, d: uy.y - origin.y };
    const edges = [];
    for (let i = 0; i < NV.length; i++) {
      const a = NV[i], b = NV[(i + 1) % NV.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const wa = __worldPoint(geometry, n, a[0], a[1]);
      const wb = __worldPoint(geometry, n, b[0], b[1]);
      const wm = __worldPoint(geometry, n, mx, my);
      const dx = wb.x - wa.x, dy = wb.y - wa.y;
      edges.push({ x: wm.x, y: wm.y,
        rot: Math.atan2(dy, dx) - Math.PI / 2,
        len: Math.hypot(dx, dy) * 1.08,
        ang: Math.atan2(wm.y - n.y, wm.x - n.x) });
    }
    edges.sort((a, b) => a.ang - b.ang);
    const shards = memberSlots.map((slot) => SH[slot]).sort((a, b) =>
      Math.atan2(a.y - n.y, a.x - n.x) - Math.atan2(b.y - n.y, b.x - n.x));
    let bestShift = 0, bestDistance = Infinity;
    for (let shift = 0; shift < edges.length; shift++) {
      let total = 0;
      for (let i = 0; i < shards.length; i++) {
        const edge = edges[(i + shift) % edges.length];
        total += Math.hypot(shards[i].x - edge.x, shards[i].y - edge.y);
      }
      if (total < bestDistance) { bestDistance = total; bestShift = shift; }
    }
    shards.forEach((s, i) => {
      const edge = edges[(i + bestShift) % edges.length];
      s.tx = edge.x; s.ty = edge.y; s.trot = edge.rot; s.tlen = edge.len; s.twid = 9;
      s.dist = Math.hypot(s.x - edge.x, s.y - edge.y);
      s.faceA = Math.atan2(n.y - s.y, n.x - s.x) - Math.PI / 2;
      s.trotAdj = s.trot;
    });
    shards.sort((a, b) => a.dist - b.dist);
    const retained = new Set(memberSlots);
    for (const old of n.sh) if (!retained.has(SH.indexOf(old))) __detachExternalNodeShard(old, n);
    n.sh = shards;
    for (const s of shards) {
      if (s.node !== n) s.__externalTravelStarted = false;
      s.node = n;
    }
    return true;
  }
  function captureExternalShardSide(provenance, mirrorX) {
    if (!__externalTruth || !provenance) return null;
    const dx = __finite(provenance.dirX, 0), dy = __finite(provenance.dirY, 0);
    const mag = Math.hypot(dx, dy) || 1;
    const nx = dx / mag;
    const rootX = __finite(mirrorX, M.x);
    const hitX = __finite(provenance.hitX, rootX);
    return Math.abs(nx) > .25 ? (nx > 0 ? 'L' : 'R') : (hitX < rootX ? 'L' : 'R');
  }
  function syncExternalShardSlot(input, slotIndex) {
    const i = Number.isInteger(slotIndex) ? slotIndex : input && input.slotIndex;
    if (!__externalTruth || !input || !Number.isInteger(i) || i < 0 || i >= SH.length) return false;
    const active = input.on !== false && input.identity != null;
    if (!active) { __resetExternalShard(i); return true; }
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return false;
    const presentationSide = input.presentationSide;
    const hasPresentationSide = presentationSide === 'L' || presentationSide === 'R';
    const replacing = !__externalShardBound[i] || __externalShardIdentities[i] !== input.identity;
    if (replacing) {
      __resetExternalShard(i);
      const s = SH[i], provenance = input.provenance || {};
      const dx = __finite(provenance.dirX, __finite(input.vx, 0));
      const dy = __finite(provenance.dirY, __finite(input.vy, 0));
      const mag = Math.hypot(dx, dy) || 1;
      const nx = dx / mag, ny = dy / mag;
      const hx = __finite(provenance.hitX, __finite(input.x, M.x));
      const rootX = __finite(input.mirrorX, M.x);
      const side = hasPresentationSide ? presentationSide
        : (Math.abs(nx) > .25 ? (nx > 0 ? 'L' : 'R') : (hx < rootX ? 'L' : 'R'));
      // First semantic binding occurs before Gold's next fixed step, so these
      // remain the pre-hit expression channels without adapter-owned copies.
      const e = E['e' + side], n = E['n' + side], eye = E['s' + side];
      const sa = Math.atan2(ny, nx) + Math.PI / 2 + rr(-.3, .3);
      s.on = true; s.st = Number.isInteger(input.st) ? input.st : 0;
      s.side = side; s.pe = e; s.pn = n; s.ps = eye;
      s.ph = rr(0, 6); s.rep = rr(1.5, 4); s.repT = 0; s.spt = rr(.3, .8);
      s.sa = sa; s.rot = sa + rr(-.3, .3); s.ta = s.rot; s.dsx = .087; s.dsy = .087;
      s.mt0 = __finite(input.mt0, 0); s.eyeP = rr(0, 6); s.spc = rr(2, 5);
      __externalShardIdentities[i] = input.identity; __externalShardBound[i] = true;
    }
    const s = SH[i], wasMoving = s.moving;
    s.on = true; s.st = Number.isInteger(input.st) ? input.st : s.st;
    for (const key of ['x', 'y', 'vx', 'vy', 'age', 'fx', 'fy', 'tx', 'ty', 'mt0'])
      if (Number.isFinite(input[key])) s[key] = input[key];
    if (typeof input.moving === 'boolean') s.moving = input.moving;
    if (s.moving && !wasMoving) { s.frot = s.rot; s.fx = s.x; s.fy = s.y; }
    return true;
  }
  function syncExternalNode(input, sharedGeometry) {
    if (!__externalTruth || !input || input.id == null || !__sharedNodeGeometry(sharedGeometry)
        || ![1, 2, 3].includes(input.st) || !__validPoint(input)
        || !Number.isFinite(input.rot) || !Number.isFinite(input.t)
        || !Number.isFinite(input.age) || !Number.isFinite(input.t3)
        || !Number.isFinite(input.tlock) || !Array.isArray(input.memberSlots)
        || input.memberSlots.length !== NV.length) return false;
    const slots = input.memberSlots;
    if (new Set(slots).size !== NV.length || slots.some((i) => !Number.isInteger(i) || i < 0
        || i >= SH.length || !__externalShardBound[i] || !SH[i].on)) return false;
    const memberIds = new Set(slots.map((i) => __externalShardIdentities[i]));
    if (memberIds.size !== NV.length) return false;
    for (const [boundId, boundIndex] of __externalNodeBindings)
      if (boundId !== input.id && slots.some((i) => ND[boundIndex].sh.includes(SH[i]))) return false;
    let proxyIndex = __externalNodeBindings.get(input.id);
    const isNew = proxyIndex == null;
    if (isNew) {
      const used = new Set(__externalNodeBindings.values());
      proxyIndex = ND.findIndex((n, i) => !n.on && !used.has(i));
      if (proxyIndex < 0) return false;
      __resetExternalNode(proxyIndex);
      __externalNodeBindings.set(input.id, proxyIndex);
    }
    const n = ND[proxyIndex];
    n.on = true; n.st = input.st; n.t = input.t; n.age = input.age;
    n.x = input.x; n.y = input.y; n.rot = input.rot; n.t3 = input.t3; n.tlock = input.tlock;
    n.externalGeometry = sharedGeometry;
    n.fill = n.st >= 2 ? 1 : (n.tlock >= 0 ? sstep(n.tlock + .04, n.tlock + .34, n.t) : 0);
    n.fold = n.st === 3 ? sstep(0, .5, n.t3) : 0;
    if (n.st >= 2 && n.sw[0].on === false && n.__externalPreviousStage === 1) {
      const w = n.sw[0]; w.on = true; w.t = 0; w.d = .8; w.ang = .9; w.amp = 1;
    }
    if (isNew) { n.swc = rr(2, 3.5); n.fa = rr(1.5, 3); }
    try { __deriveExternalNodeEdges(n, sharedGeometry, slots); }
    catch (e) {
      if (isNew) { __externalNodeBindings.delete(input.id); __resetExternalNode(proxyIndex); }
      return false;
    }
    const assemblyStart = __finite(input.assemblyStart, .18);
    const assemblyStagger = __finite(input.assemblyStagger, .06);
    for (let order = 0; order < n.sh.length; order++) {
      const s = n.sh[order], slot = SH.indexOf(s);
      s.st = n.st === 1 ? 1 : 3;
      const suppliedMt0 = input.memberMt0 && input.memberMt0[slot];
      s.mt0 = Number.isFinite(suppliedMt0) ? suppliedMt0
        : (Number.isFinite(s.mt0) && s.mt0 > 0 ? s.mt0 : assemblyStart + order * assemblyStagger);
      if (!s.__externalTravelStarted && n.t >= s.mt0) {
        s.__externalTravelStarted = true; s.fx = s.x; s.fy = s.y; s.frot = s.rot;
      }
    }
    n.__externalPreviousStage = n.st;
    return true;
  }
  function releaseExternalNode(nodeId) {
    const proxyIndex = __externalNodeBindings.get(nodeId);
    if (proxyIndex == null) return false;
    __dropNodeImageOwners(nodeId);
    __externalNodeBindings.delete(nodeId);
    __resetExternalNode(proxyIndex);
    return true;
  }
  function syncExternalPassive(snapshot, sharedGeometry) {
    if (!__externalTruth || !snapshot || !Array.isArray(snapshot.shards) || !Array.isArray(snapshot.nodes)) return false;
    const geometry = sharedGeometry || snapshot.geometry;
    for (let i = 0; i < SH.length; i++) {
      const shard = snapshot.shards[i];
      if (!shard) __resetExternalShard(i);
      else if (!syncExternalShardSlot(shard, i)) return false;
    }
    const liveIds = new Set(snapshot.nodes.map((node) => node && node.id).filter((id) => id != null));
    for (const id of Array.from(__externalNodeBindings.keys())) if (!liveIds.has(id)) releaseExternalNode(id);
    for (const node of snapshot.nodes) if (!syncExternalNode(node, geometry)) return false;
    return true;
  }
  function __externalVisualPayload(event) {
    if (!event || !event.direction || !Number.isFinite(event.power)
        || !Number.isFinite(event.direction.x) || !Number.isFinite(event.direction.y)
        || Math.hypot(event.direction.x, event.direction.y) < 1e-9) return null;
    const p = event.point;
    if (!__validPoint(p)) return null;
    const d = Math.hypot(event.direction.x, event.direction.y);
    return { x: p.x, y: p.y, vx: event.direction.x / d, vy: event.direction.y / d,
      dx: event.direction.x / d, dy: event.direction.y / d, pw: event.power, own: 1 };
  }
  function presentExternalRoute(event) {
    if (!__externalTruth || !event || event.routeId == null) return false;
    const kind = event.kind;
    const needsProjectileImage = kind === 'preview' || kind === 'capture' || kind === 'destination-image';
    const payload = needsProjectileImage ? __externalVisualPayload(event)
      : (__validPoint(event.point) ? { x: event.point.x, y: event.point.y } : null);
    if (!payload) return false;
    const routeId = event.routeId;
    if (kind === 'local') {
      const n = __nodeForExternalId(event.nodeId);
      if (!n) return false;
      nodeRipple(n, payload.x, payload.y); __externalRouteEvents++; return true;
    }
    if (kind === 'preview') {
      const id = event.entryNodeId == null ? event.nodeId : event.entryNodeId;
      const n = __nodeForExternalId(id);
      if (!n) return false;
      if (!n.img.on) setImg(n, 0, payload);
      __externalRouteEvents++; return true;
    }
    if (kind === 'capture') {
      const entryId = event.entryNodeId, destinationId = event.destinationNodeId;
      if (entryId == null || destinationId == null) return false;
      const existing = __externalRoutes.get(routeId);
      if (existing) {
        if (existing.entryNodeId !== entryId || existing.destinationNodeId !== destinationId) return false;
        __externalRouteEvents++; return true;
      }
      // Capture truth creates a semantic record even if the entry proxy has
      // already gone. A live entry, when present, gets only its local feedback.
      const route = Object.freeze({ entryNodeId: entryId, destinationNodeId: destinationId });
      __externalRoutes.set(routeId, route);
      const n = __nodeForExternalId(entryId);
      if (n && n.on) {
        __addImageOwner(entryId, routeId);
        nodeRipple(n, payload.x, payload.y); setImg(n, 0, payload); n.flash = 1;
      }
      __externalRouteEvents++; return true;
    }
    const route = __externalRoutes.get(routeId);
    if (!route) return false;
    if (kind === 'destination-image') {
      if (event.destinationNodeId != null && event.destinationNodeId !== route.destinationNodeId) return false;
      if (event.destinationLive !== true) { __externalRouteEvents++; return true; }
      const n = __nodeForExternalId(route.destinationNodeId);
      if (n && n.on) {
        __addImageOwner(route.destinationNodeId, routeId); setImg(n, 1, payload);
      }
      // The real image event is consumed even when its node visual is gone.
      __externalRouteEvents++; return true;
    }
    if (kind === 'emerge') {
      const fallback = event.fallback === true || event.via === 'entry-fallback';
      const id = fallback ? route.entryNodeId
        : (event.viaNodeId == null ? route.destinationNodeId : event.viaNodeId);
      const relevant = id === route.entryNodeId || id === route.destinationNodeId;
      const n = relevant ? __nodeForExternalId(id) : null;
      if (n && n.on) nodeRipple(n, payload.x, payload.y);
      // Emerge is the only route terminal event. Feedback is optional; real
      // route completion and its supplied world point are authoritative.
      __removeRoute(routeId);
      __externalRouteEvents++; return true;
    }
    return false;
  }
  function __advanceExternalPassiveVisuals(dt) {
    for (let i = 0; i < SH.length; i++) {
      const s = SH[i]; if (!__externalShardBound[i] || !s.on) continue;
      s.ph += dt;
      if (s.st === 0) {
        s.spt -= dt;
        if (s.spt <= 0) {
          s.spt = rr(1.2, 2.6);
          let nearest = null, best = 260;
          for (const other of SH) if (other !== s && other.on && other.st === 0) {
            const d = Math.hypot(other.x - s.x, other.y - s.y);
            if (d < best) { best = d; nearest = other; }
          }
          s.ta = Math.atan2((nearest ? nearest.y : M.y) - s.y,
            (nearest ? nearest.x : M.x) - s.x) - Math.PI / 2 + rr(-.25, .25);
        }
        s.rot = angLerp(s.rot, s.ta, Math.min(1, dt * 2.2));
        s.rep -= dt; if (s.rep <= 0) { s.rep = rr(2.5, 5); s.repT = .7; }
        if (s.repT > 0) s.repT = Math.max(0, s.repT - dt);
        s.spc -= dt;
        if (s.spc <= 0) { s.spc = rr(3, 6); addSweep('sh' + i, .6, .9, .8, .2); }
      }
    }
    for (const proxyIndex of __externalNodeBindings.values()) {
      const n = ND[proxyIndex];
      if (!n || !n.on) continue;
      if (n.flash > 0) n.flash = Math.max(0, n.flash - dt * 3);
      n.fill = n.st >= 2 ? 1 : (n.tlock >= 0 ? sstep(n.tlock + .04, n.tlock + .34, n.t) : 0);
      n.fold = n.st === 3 ? sstep(0, .5, n.t3) : 0;
      if (n.st === 1) for (const s of n.sh) {
        if (n.t < s.mt0) { s.rot = angLerp(s.rot, s.faceA, Math.min(1, dt * 7)); continue; }
        if (!s.__externalTravelStarted) {
          s.__externalTravelStarted = true; s.fx = s.x; s.fy = s.y; s.frot = s.rot;
        }
        const p = clamp((n.t - s.mt0) / .4, 0, 1), e = eo3(p);
        s.rot = angLerp(s.frot, s.trot, e);
        s.dsx = lerp(.087, s.twid / 130, e); s.dsy = lerp(.087, s.tlen / 300, e);
      }
      if (n.st === 2) {
        n.swc -= dt;
        if (n.swc <= 0) {
          n.swc = rr(2.2, 4.5); const w = n.sw[n.sw[0].on ? 1 : 0];
          w.on = true; w.t = 0; w.d = .75; w.ang = rr(.5, 1.3); w.amp = .7;
        }
        n.fa -= dt;
        if (n.fa <= 0) { n.fa = rr(2, 4.2); n.faT = 0; n.faW = __rand() < .35 ? 1 : 0; }
        if (n.faT >= 0) { n.faT += dt; if (n.faT > 1.3) n.faT = -1; }
      }
      for (const w of n.sw) if (w.on) { w.t += dt; if (w.t >= w.d) w.on = false; }
      for (const r of n.rp) if (r.t < 9) r.t = Math.min(9, r.t + dt);
      if (n.img.on) {
        n.img.t += dt;
        if (n.img.t >= n.img.d + (n.img.k === 0 ? .25 : .08)) n.img.on = false;
      }
    }
    __externalPassiveSteps++;
  }
  function clearExternalPassive() {
    for (let i = 0; i < SH.length; i++) __resetExternalShard(i);
    for (let i = 0; i < ND.length; i++) __resetExternalNode(i);
    __externalNodeBindings.clear(); __externalRoutes.clear(); __externalImageOwners.clear();
    __externalPassiveSteps = 0; __externalRouteEvents = 0;
    return true;
  }
  function drawExternalPassive(ctx) {
    if (!__externalTruth || !ctx || !ensureBaked()) return false;
    for (let i = 0; i < SH.length; i++)
      if (__externalShardBound[i] && SH[i].on && SH[i].st === 0) drawFreeShard(ctx, SH[i], i);
    for (const proxyIndex of __externalNodeBindings.values()) {
      const n = ND[proxyIndex]; if (n && n.on) drawNodeBody(ctx, n);
    }
    return true;
  }
  function __externalExchangeHistoryKey(event) {
    // Coalesced Mirror-v-Mirror notices can have different castId/coalesced
    // values; the unordered pair plus both PRE/POST samples is the physical key.
    if (!event || !event.self || !event.opponent) return null;
    const actors = [event.self, event.opponent];
    if (actors.some((a) => a.id == null || !__validPoint(a.from) || !__validPoint(a.to))) return null;
    const rows = actors.map((a) => [typeof a.id, String(a.id),
      a.from.x === 0 ? 0 : a.from.x, a.from.y === 0 ? 0 : a.from.y,
      a.to.x === 0 ? 0 : a.to.x, a.to.y === 0 ? 0 : a.to.y]);
    rows.sort((a, b) => (a[0] + ':' + a[1]).localeCompare(b[0] + ':' + b[1]));
    return JSON.stringify(rows);
  }
  function __rememberExternalHistoryKey(key) {
    if (!key) return;
    __externalHistoryKeys.set(key, __externalSteps + 1);
    while (__externalHistoryKeys.size > 16)
      __externalHistoryKeys.delete(__externalHistoryKeys.keys().next().value);
  }
  function rebaseExternalExchangeHistory(event, mirrorId) {
    if (!__externalTruth || !event) return false;
    const key = __externalExchangeHistoryKey(event);
    if (!key) return false;
    const expires = __externalHistoryKeys.get(key);
    if (expires != null && expires >= __externalSteps) return false;
    const id = mirrorId == null ? M.id : mirrorId;
    const actor = [event.self, event.opponent].find((a) => a.id === id);
    if (!actor || !__validPoint(actor.from) || !__validPoint(actor.to)) return false;
    shiftHist(actor.to.x - actor.from.x, actor.to.y - actor.from.y);
    __rememberExternalHistoryKey(key); __externalHistoryRebases++;
    return true;
  }
  function externalPassiveAudit() {
    return Object.freeze({ shardBindings: __externalShardBound.filter(Boolean).length,
      nodeBindings: __externalNodeBindings.size, routes: __externalRoutes.size,
      imageOwners: Array.from(__externalImageOwners.values()).reduce((n, set) => n + set.size, 0),
      passiveSteps: __externalPassiveSteps, routeEvents: __externalRouteEvents,
      historyRebases: __externalHistoryRebases, goldProjectiles: PJ.filter((p) => p.on).length });
  }
`;

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
// This module is pure presentation material. In production, APEX supplies truth
// and exact STEP ticks; the showcase demo remains isolated. Checkpoint E
// (mirrorGameplayRuntime) owns mechanics and lifecycle.
(function (g) {
'use strict';
const doc = typeof document !== 'undefined' ? document : null;

${utilRegion}

// ---- node silhouette (geometry only; hoisted from Gold's PASSIVE section) ----
${nvLine}
${t2Line}

${rasterRegion}

${assetKept}

// Entry-based variants of Gold's dp()/masked(). Gold looks art up by NAME in
// its own atlas; the real Arsenal weapon is not in that atlas, so these take
// the atlas ENTRY directly. The drawing is otherwise identical to Gold's.
function dpEntry(g, p, ppu) { g.drawImage(pick(p, ppu || PU).c, p.ox, p.oy, p.w, p.h); }
function maskedEntry(g, p, ppu, fill, alpha, comp) {
  const l = pick(p, ppu), w = l.c.width, h = l.c.height;
  SG.globalCompositeOperation = 'source-over'; SG.clearRect(0, 0, 1100, 1100);
  SG.save(); fill(SG, w, h); SG.restore();
  SG.globalCompositeOperation = 'destination-in'; SG.drawImage(l.c, 0, 0);
  SG.globalCompositeOperation = 'source-over';
  g.save(); g.globalAlpha *= alpha; if (comp) g.globalCompositeOperation = comp;
  g.drawImage(SC, 0, 0, w, h, p.ox, p.oy, p.w, p.h); g.restore();
}

// Build a Gold-shaped atlas entry (with mip levels) from an arbitrary image
// source, so a REAL Arsenal weapon can flow through Gold's own draw path.
function weaponEntryFromImage(img, opts) {
  const o = opts || {};
  const w = o.w || img.width, h = o.h || img.height;
  const ox = o.ox == null ? -w / 2 : o.ox, oy = o.oy == null ? -h / 2 : o.oy;
  const lv = [];
  for (const sc of (o.scales || [1, 0.5, 0.25])) {
    const c = mk(Math.max(2, w * sc), Math.max(2, h * sc));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.drawImage(img, 0, 0, c.width, c.height);
    lv.push({ s: sc, c });
  }
  lv.sort((a, b) => a.s - b.s);
  return { w, h, ox, oy, ax: 0, ay: 0, lv };
}

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
  // Presentation-only opponent accent state belongs to this Gold instance.
  // Its neutral default is also the teardown/reset color; no global matchup
  // color can leak between two independently-created Mirrors.
  const NEUTRAL_REFLECTION_ACCENT = Object.freeze({ id: 'NEUTRAL', r: 194, g: 200, b: 208 });
  function makeOpponentReflectionPaint(accent) {
    const valid = accent && Number.isFinite(accent.r) && Number.isFinite(accent.g) && Number.isFinite(accent.b);
    const source = valid ? accent : NEUTRAL_REFLECTION_ACCENT;
    const r = Math.round(clamp(source.r, 0, 255));
    const gg = Math.round(clamp(source.g, 0, 255));
    const b = Math.round(clamp(source.b, 0, 255));
    const rgb = r + ',' + gg + ',' + b;
    return Object.freeze({
      id: typeof source.id === 'string' ? source.id : 'NEUTRAL', r, g: gg, b, rgb,
      css: 'rgb(' + rgb + ')',
      tint: 'rgba(' + rgb + ',1)',
      sweepClear: 'rgba(' + rgb + ',0)',
      sweep38: 'rgba(' + rgb + ',.38)',
      sweep62: 'rgba(' + rgb + ',.62)',
      sweep30: 'rgba(' + rgb + ',.3)',
      sweep20: 'rgba(' + rgb + ',.2)',
    });
  }
  let __opponentReflectionPaint = makeOpponentReflectionPaint(NEUTRAL_REFLECTION_ACCENT);
  function setOpponentReflectionAccent(accent) {
    __opponentReflectionPaint = makeOpponentReflectionPaint(accent);
    return __opponentReflectionPaint;
  }
  function getOpponentReflectionAccent() { return __opponentReflectionPaint; }
  function opponentReflectionColor(alpha) {
    const paint = __opponentReflectionPaint;
    return 'rgba(' + paint.rgb + ',' + alpha + ')';
  }
  function opponentReflectionFill(surface, w, h) {
    surface.fillStyle = __opponentReflectionPaint.tint;
    surface.fillRect(0, 0, w, h);
  }
  function opponentReflectionSweepFill(prog, ang, bw) {
    return (surface, w, h) => {
      const d = Math.hypot(w, h), c = Math.cos(ang), sn = Math.sin(ang);
      const pos = (prog - .5) * d * 1.5, cx = w / 2 + c * pos, cy = h / 2 + sn * pos, band = d * bw;
      const gr = surface.createLinearGradient(cx - c * band, cy - sn * band, cx + c * band, cy + sn * band);
      const paint = __opponentReflectionPaint;
      gr.addColorStop(0, paint.sweepClear);
      gr.addColorStop(.3, paint.sweep38);
      gr.addColorStop(.46, 'rgba(255,255,255,.92)');
      gr.addColorStop(.58, paint.sweep62);
      gr.addColorStop(.8, paint.sweep20);
      gr.addColorStop(1, paint.sweepClear);
      surface.fillStyle = gr;
      surface.fillRect(0, 0, w, h);
    };
  }
  // Dedicated presentation stream. Never the gameplay/combat RNG.
  let __rand = mulberry32((opts.seed >>> 0) || 0x9E3779B9);
  const rr = (a, b) => a + __rand() * (b - a);
  // External-truth mode is the sole production bridge: roots are assigned from
  // APEX after movement, while authored Gold pose/choreography advances only
  // through exact STEP-sized calls. The demo remains unchanged by default.
  let __externalTruth = false;
  let __externalSteps = 0, __externalExchanges = 0, __externalSnaps = 0;
  let __skipExternalHistoryShift = false;
  let __externalExchangeCastId = null;
  let __externalA1CastId = null, __externalA2CastId = null, __externalA2Resolved = false;
  let __externalPrevSpeed = 0, __externalMoving = false;

${d2Region.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

${externalSprings.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

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

  // ---- REAL ARSENAL WEAPON SOURCE (section 14) ---------------------------
  // The authored A1 choreography is unchanged; only the imagery it reflects
  // and peels comes from the actual snapshotted weapon. Falls back to Gold's
  // demo raster ONLY when production has not supplied one, so a missing
  // adapter is visible rather than silently shipping a placeholder.
  let __wpnArt = null;
  function __weaponArt() {
    return __wpnArt || { mv: P.wpnMV, real: P.wpn, source: 'gold-demo-fallback' };
  }
  function setWeaponArt(art) {
    // art: { mv, real } atlas entries, or { image } / { mvImage, realImage }
    if (!art) { __wpnArt = null; return null; }
    if (art.mv && art.real) { __wpnArt = { mv: art.mv, real: art.real, source: art.source || 'production' }; return __wpnArt; }
    const mvImg = art.mvImage || art.image, reImg = art.realImage || art.image;
    if (!mvImg || !reImg) return null;
    // Normalise to Gold's AUTHORED weapon bounds. The real Arsenal PNGs are
    // far larger than Gold's demo raster, and the peel geometry (slice width
    // wl = w/A1N, lift, travel) is authored against those bounds -- feeding
    // raw pixel sizes would scale the whole choreography wrongly. Fit by the
    // longer axis so silhouette proportions are preserved.
    const ref = P.wpnMV;
    const fit = art.fitToGold === false ? null : ref;
    const sourceW = Number.isFinite(art.w) && art.w > 0 ? art.w : mvImg.width;
    const sourceH = Number.isFinite(art.h) && art.h > 0 ? art.h : mvImg.height;
    let box = { w: sourceW, h: sourceH };
    if (fit) {
      const k = Math.min(fit.w / sourceW, fit.h / sourceH);
      box = { w: sourceW * k, h: sourceH * k };
    }
    const spec = { ...art, w: box.w, h: box.h, ox: -box.w / 2, oy: -box.h / 2 };
    __wpnArt = {
      mv: weaponEntryFromImage(mvImg, spec),
      real: weaponEntryFromImage(reImg, spec),
      goldRef: { w: ref.w, h: ref.h }, fitted: !!fit,
      source: art.source || 'production',
      weaponId: art.weaponId || null,
    };
    return __wpnArt;
  }

${d3Region.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

  // ---- D4: shard / node / routing presentation ---------------------------
  // Gameplay owns shard eligibility, formation, node lifetime, routing success
  // and escrow. These draws consume gameplay-provided node/shard state as
  // TRUTH; no independent lifecycle clock exists here that could drift.
${d4Full.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

${EXTERNAL_PASSIVE_API}

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

  // Production adapter contract. No physics, relocation, timers, or actor
  // lifecycle lives here: callers sample APEX truth after movement, then advance
  // the authored Gold presentation by exactly STEP from hrPostTick(dt).
  function validRoot(actor) {
    return !!actor && Number.isFinite(actor.x) && Number.isFinite(actor.y);
  }
  function syncExternalTruth(mirror, opponent) {
    if (!validRoot(mirror) || !validRoot(opponent)) return false;
    if (mirror.id != null) M.id = mirror.id;
    if (opponent.id != null) F.id = opponent.id;
    M.x = mirror.x; M.y = mirror.y;
    M.vx = Number.isFinite(mirror.vx) ? mirror.vx : 0;
    M.vy = Number.isFinite(mirror.vy) ? mirror.vy : 0;
    F.x = opponent.x; F.y = opponent.y;
    F.vx = Number.isFinite(opponent.vx) ? opponent.vx : 0;
    F.vy = Number.isFinite(opponent.vy) ? opponent.vy : 0;
    M.aim = Number.isFinite(mirror.aim) ? mirror.aim : Math.atan2(F.y - M.y, F.x - M.x);
    F.aim = Number.isFinite(opponent.aim) ? opponent.aim : Math.atan2(M.y - F.y, M.x - F.x);
    if (Object.prototype.hasOwnProperty.call(opponent, 'armed')) F.armed = !!opponent.armed;
    return true;
  }
  function enableExternalTruth(mirror, opponent) {
    if (!syncExternalTruth(mirror, opponent)) return false;
    __externalTruth = true;
    __applyExchange = false;
    __externalSteps = 0; __externalExchanges = 0; __externalSnaps = 0;
    __externalExchangeCastId = null;
    __externalA1CastId = __externalA2CastId = null; __externalA2Resolved = false;
    __externalPrevSpeed = Math.hypot(M.vx, M.vy);
    __externalMoving = __externalPrevSpeed >= 50;
    M.mv = __externalMoving ? 1 : 0;
    M.pkx = M.vx; M.pky = M.vy;
    simT = 0;
    histFill();
    return true;
  }
  function stepExternalPresentation(dt) {
    if (!__externalTruth) return false;
    if (!Number.isFinite(dt) || Math.abs(dt - STEP) > 1e-12)
      throw new RangeError('Mirror external presentation requires one exact 1/120s step');
    __externalSteps++;
    for (const [key, expires] of __externalHistoryKeys)
      if (expires < __externalSteps) __externalHistoryKeys.delete(key);
    simT += STEP;
    qStep(STEP); twStep(STEP);
    M.turnCd -= STEP; M.wallCd -= STEP; M.colCd -= STEP; M.hitCd -= STEP; M.busy -= STEP;
    const vx = M.vx, vy = M.vy, speed = Math.hypot(vx, vy);
    if (speed > 1e-6) {
      const ix = vx / speed, iy = vy / speed;
      const ovx = hs(.12, 12), ovy = hs(.12, 13), oldSpeed = Math.hypot(ovx, ovy);
      if (__externalMoving && oldSpeed > 135 && M.turnCd <= 0
          && (ovx * ix + ovy * iy) / oldSpeed < .05) {
        onTurn(ovx / oldSpeed, ovy / oldSpeed, ix, iy);
        M.turnCd = .45;
      }
      if (!__externalMoving && __externalPrevSpeed < 90) onStart(ix, iy);
      if (speed > 150) M.mv = 1;
      else if (!M.mv && speed >= 90) M.mv = 1;
      M.pkx = vx; M.pky = vy;
      __externalMoving = true;
    } else if (M.mv === 1 && speed < 50) {
      if (Math.hypot(M.pkx, M.pky) > 140) onStop(M.pkx, M.pky);
      M.mv = 0; __externalMoving = false;
    }
    __externalPrevSpeed = speed;
    M.rec.step(0, STEP); M.cs.step(0, STEP); M.sf = Math.max(0, M.sf - STEP * 3.2);
    // Preserve Gold's production presentation order after the external-motion
    // reaction above: authored action timelines, idle/lock, body springs, FX.
    stepA1(STEP); stepA2(STEP);
    idleStep(STEP); lockStep(STEP);
    stepExternalSprings(STEP); __advanceExternalPassiveVisuals(STEP); sweepStep(STEP); fxStep(STEP);
    pushHist();
    return true;
  }
  function applyExternalExchange(event, mirror, opponent) {
    if (!__externalTruth || !event || !A2.on || event.castId == null || __externalA2Resolved
        || __externalExchangeCastId === event.castId
        || (__externalA2CastId != null && event.castId !== __externalA2CastId)) return false;
    const self = event.self, other = event.opponent;
    if (!self || !other || !validRoot(self.from) || !validRoot(other.from)
        || !validRoot(mirror) || !validRoot(opponent)) return false;
    if (Object.prototype.hasOwnProperty.call(self, 'id') && mirror.id != null && self.id !== mirror.id) return false;
    if (Object.prototype.hasOwnProperty.call(other, 'id') && opponent.id != null && other.id !== opponent.id) return false;
    // Real event carries the PRE-SWAP sample; invoke the authored snap exactly
    // once there, then restore POST-SWAP roots and current velocities from APEX.
    // A non-casting receiver may already have rebased its history from this same
    // event; the payload-derived key prevents the caster's a2Snap shifting twice.
    const historyKey = __externalExchangeHistoryKey(event);
    const historyExpires = historyKey && __externalHistoryKeys.get(historyKey);
    const skipHistoryShift = historyExpires != null && historyExpires >= __externalSteps;
    M.x = self.from.x; M.y = self.from.y;
    F.x = other.from.x; F.y = other.from.y;
    __skipExternalHistoryShift = skipHistoryShift;
    try { a2Snap(); } finally { __skipExternalHistoryShift = false; }
    if (!skipHistoryShift) {
      if (historyKey) __rememberExternalHistoryKey(historyKey);
      __externalHistoryRebases++;
    }
    if (!syncExternalTruth(mirror, opponent)) return false;
    __externalExchangeCastId = event.castId;
    __externalA2Resolved = true;
    __externalExchanges++;
    return true;
  }
  let __mirrorEntityDrawContext = null, __mirrorEntityOpponentDraw = null;
  function drawCurrentMirrorBody() {
    if (__mirrorEntityDrawContext) rigFull(__mirrorEntityDrawContext, M.x, M.y);
  }
  function drawCurrentOpponentBody(alpha) {
    const ctx = __mirrorEntityDrawContext, drawOpponent = __mirrorEntityOpponentDraw;
    if (!ctx || typeof drawOpponent !== 'function') return;
    ctx.save();
    try { ctx.globalAlpha *= alpha; drawOpponent(ctx, M.x, M.y); }
    finally { ctx.restore(); }
  }
  function drawMirrorEntityWithOpponent(g, drawOpponent) {
    if (A2.on && (A2.band > .002 || A2.ghostA > .01)) {
      __mirrorEntityDrawContext = g;
      __mirrorEntityOpponentDraw = drawOpponent;
      try {
        drawSite(g, M.x, M.y, A2.band, A2.ghostA, A2.tear, A2.ang, 72,
          drawCurrentMirrorBody, drawCurrentOpponentBody);
      } finally {
        __mirrorEntityDrawContext = null;
        __mirrorEntityOpponentDraw = null;
      }
    } else rigFull(g, M.x, M.y);
  }
  function beginExternalA1(castId, whiff) {
    if (!__externalTruth || castId == null || A1.on || A2.on) return false;
    __externalA1CastId = castId; castA1(!!whiff); return A1.on;
  }
  function markExternalA1Whiff(castId) {
    if (!__externalTruth || !A1.on || castId == null || castId !== __externalA1CastId) return false;
    A1.whiff = true;
    return true;
  }
  function beginExternalA2(castId) {
    if (!__externalTruth || castId == null || A1.on || A2.on) return false;
    __externalA2CastId = castId; castA2();
    if (A2.on) __externalA2CastId = castId;
    return A2.on;
  }
  function endExternalA1(castId) {
    if (!__externalTruth || (castId != null && __externalA1CastId != null && castId !== __externalA1CastId)) return false;
    const ended = finishA1(); if (ended) __externalA1CastId = null; return ended;
  }
  function endExternalA2(castId) {
    if (!__externalTruth || (castId != null && __externalA2CastId != null && castId !== __externalA2CastId)) return false;
    const ended = finishA2(); if (ended) { __externalA2CastId = null; __externalA2Resolved = false; } return ended;
  }
  function clearExternalTruth() {
    __externalTruth = false; __applyExchange = !!opts.applyExchange;
    __externalExchangeCastId = null; __externalA1CastId = __externalA2CastId = null;
    __externalA2Resolved = false; __externalMoving = false; __externalPrevSpeed = 0;
    __skipExternalHistoryShift = false; __externalHistoryKeys.clear(); __externalHistoryRebases = 0;
    delete M.id; delete F.id;
    clearExternalPassive();
    A1.on = false; A1.f = {}; A2.on = false; A2.f = {};
    M.busy = 0; M.copyOn = false; M.copyT = 0; M.copyFx = 0; __wpnArt = null;
    setOpponentReflectionAccent(NEUTRAL_REFLECTION_ACCENT);
    for (const p of PJ) {
      p.on = false; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.own = 0; p.pw = 1;
      p.st = 0; p.t = 0; p.cool = 0; p.nA = null; p.nB = null; p.imgB = false;
      p.hx.fill(0); p.hy.fill(0); p.hn = 0; p.hc = 0; p.life = 0; p.dx = 1; p.dy = 0;
    }
    Q.length = 0;
    for (const s of TW) { s.on = false; s.o = null; }
    for (const s of SW) s.on = false;
    for (const f of FX) { f.on = false; f.nm = ''; }
    for (const key of Object.keys(__listeners)) __listeners[key].length = 0;
    histFill();
    return true;
  }
  function externalAudit() {
    return Object.freeze({ enabled: __externalTruth, fixedStep: STEP, simTime: simT,
      steps: __externalSteps, exchanges: __externalExchanges, snaps: __externalSnaps,
      lastExchangeCastId: __externalExchangeCastId, a1CastId: __externalA1CastId,
      a2CastId: __externalA2CastId, a2Resolved: __externalA2Resolved, applyExchange: __applyExchange,
      mirror: { x: M.x, y: M.y, vx: M.vx, vy: M.vy },
      opponent: { x: F.x, y: F.y, vx: F.vx, vy: F.vy },
      a1On: A1.on, a2On: A2.on });
  }

  return {
    // instance-local presentation-only opponent reflection hue
    setOpponentReflectionAccent, getOpponentReflectionAccent,
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
    // D4 shard / node / routing presentation (draw only)
    drawShardAt, drawFreeShard, drawNodeBody, drawFX, drawProj, drawBolt,
    nodeToWorld, nodeCap, nodeRipple,
    get SH() { return SH; }, get ND() { return ND; }, get PJ() { return PJ; },
    // D3 real-weapon visual adapter
    setWeaponArt, weaponArt: () => __weaponArt(),
    // D3 authored choreography (reports edges; performs no gameplay)
    castA1, stepA1, castA2, stepA2, a2Snap: () => __externalTruth ? false : a2Snap(), a1Frame, sliceState, holdPos,
    drawA1World, drawSite, drawHalf, clipHalf, strips, drawResidue, drawPlate,
    rigFull, drawHeld, drawMirrorEntity, drawMirrorEntityWithOpponent, drawFoeEntity, drawCracks, drawHistoryCore,
    foeReal, foeMV,
    get A1() { return A1; }, get A2() { return A2; },
    on, off,
    setApplyExchange(v) { __applyExchange = __externalTruth ? false : !!v; },
    get applyExchange() { return __applyExchange; },
    enableExternalTruth, syncExternalTruth, stepExternalPresentation,
    applyExternalExchange, beginExternalA1, markExternalA1Whiff, beginExternalA2,
    endExternalA1, endExternalA2, clearExternalTruth,
    captureExternalShardSide, syncExternalShardSlot, syncExternalNode, releaseExternalNode, syncExternalPassive,
    presentExternalRoute, rebaseExternalExchangeHistory, clearExternalPassive,
    drawExternalPassive, externalPassiveAudit,
    get externalTruth() { return __externalTruth; }, externalAudit,
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
  version: '1.4.0-g1-external-truth-foundation',
  goldSha256: '${GOLD_SHA}',
  regionSha256: '${regionSha}',
  checkpoint: 'G1',
  d2RegionSha256: '${d2Sha}',
  d3RegionSha256: '${d3Sha}',
  d3RemovedMutations: ${JSON.stringify(D3_MUTATIONS)},
  d4RegionSha256: '${d4Sha}',
  d3WeaponArtSites: ${JSON.stringify(WEAPON_SITES.map((w) => w.note))},
  weaponEntryFromImage, dpEntry, maskedEntry,
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
console.log(`[mirror-bridge]   d4     sha256 ${d4Sha}`);
console.log(`[mirror-bridge]   d3 removed ${D3_MUTATIONS.length} demo gameplay mutations`);
console.log(`[mirror-bridge]   bytes ${out.length}, lines ${out.split('\n').length}`);
