// BLACK_HOLE battle sandbox — assembler.
//
// Composes public/playtest/blackhole-battle-sandbox.html from:
//   1. The APPROVED golden prototype GLSL, extracted VERBATIM from
//      docs/blackhole-playtest/golden/01_GOLDEN_BASELINE.html (the visual
//      authority). A short, loud-failing patch list adapts the SCENE shader to
//      battle scale (premultiplied world compositing, passive growth, A2
//      escrow pressure, vulnerability state). Every patch is documented below.
//   2. The sandbox template parts in this directory (arena/battle layer,
//      multi-singularity lens, HUD, debug tools).
//
// Run: node tools/blackholeSandbox/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const GOLDEN = path.join(REPO, 'docs/blackhole-playtest/golden/01_GOLDEN_BASELINE.html');
const OUT = path.join(REPO, 'public/playtest/blackhole-battle-sandbox.html');

const src = fs.readFileSync(GOLDEN, 'utf8');

// ---------------------------------------------------------------------------
// Extract the golden GLSL blocks exactly as authored.
// ---------------------------------------------------------------------------
function extract(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const m = src.match(re);
  if (!m) throw new Error(`build: could not extract ${name} from golden baseline`);
  return m[1];
}

const COMMON = extract('COMMON');
const VS_TRI = extract('VS_TRI');
const FS_SCENE_GOLDEN = extract('FS_SCENE');
const FS_LENS_GOLDEN = extract('FS_LENS');
const VS_PART = extract('VS_PART');
const FS_PART = extract('FS_PART');
const FS_DOWN = extract('FS_DOWN');
const FS_BLUR = extract('FS_BLUR');
const FS_FINAL = extract('FS_FINAL');

// ---------------------------------------------------------------------------
// SCENE patches — adapt the golden head shader for battle scale.
// The material functions (egg metric, cosmos, rupture eyes, eye streams,
// matter sheets, shards) stay byte-identical except for the listed patches.
// ---------------------------------------------------------------------------
const SCENE_PATCHES = [
  // (1) Singularity seat becomes a uniform (same change the approved Skill
  //     Composer Lab makes): the battle runtime drives the seat.
  ['const vec2 SC = vec2(0.0, 0.17);   // forehead singularity seat',
   'uniform vec2 uSeat;\n#define SC uSeat'],
  // (2) Battle-state inputs: passive growth, A2 vulnerability + escrow
  //     pressure, hit flash, KO fade.
  ['uniform vec4 uShardB[16];',
   'uniform vec4 uShardB[16];\nuniform float uGrowth, uVuln, uEscrow, uHitFlash, uKo;'],
  // (3) Escrow pressure / growth densify the nebula volume.
  ['  float dens = smoothstep(-0.2, 0.5, n);',
   '  float dens = smoothstep(-0.2 - 0.20*uEscrow - 0.10*uGrowth, 0.5, n);'],
  // (4) Growth: more cosmic interior; escrow: interior becomes denser/unstable.
  ['  col *= m;',
   '  col *= m*(1.0 + 0.30*uGrowth + 0.35*uEscrow);'],
  // (5) Growth: star field gains depth.
  ['  col += st*(0.65 + 0.35*smoothstep(0.2, 0.9, fE));',
   '  col += st*(0.65 + 0.35*smoothstep(0.2, 0.9, fE))*(1.0 + 0.35*uGrowth);'],
  // (6) Vulnerability: the ruptures lose intensity ("eyes lose some intensity").
  ['  float Ie = uEye*(0.93 + 0.07*sin(uTime*1.1 + side*0.7));',
   '  float Ie = uEye*(1.0 - 0.38*uVuln)*(0.93 + 0.07*sin(uTime*1.1 + side*0.7));'],
  // (7) Premultiplied over-compositing helper + shards become coverage-aware so
  //     the head can be composited over the arena (golden drew on black).
  ['vec3 shards(vec2 hp, vec3 col){',
   'vec4 overC(vec4 u, vec4 s){ return vec4(s.rgb*s.a + u.rgb*(1.0-s.a), s.a + u.a*(1.0-s.a)); }\nvec4 shards(vec2 hp, vec4 col){'],
  ['    col = mix(col, sc, al);',
   '    col = overC(col, vec4(sc, al));'],
];

let FS_SCENE = FS_SCENE_GOLDEN;
// Split at main(): the golden composition body is restructured for
// premultiplied world compositing (see BATTLE SCENE main below); everything
// above it (all material systems) is golden code + the patches above.
const MAIN_SPLIT = 'void main(){';
const mainAt = FS_SCENE.indexOf(MAIN_SPLIT);
if (mainAt < 0) throw new Error('build: FS_SCENE main() not found');
let sceneBody = FS_SCENE.slice(0, mainAt);
for (const [find, rep] of SCENE_PATCHES) {
  if (!sceneBody.includes(find)) throw new Error(`build: SCENE patch failed — pattern not found:\n${find}`);
  sceneBody = sceneBody.replace(find, rep);
}
// Drop the uniform declarations that only main() needed duplicated? No —
// uniforms are declared once above; nothing to do.

const FS_SCENE_HEAD = sceneBody; // golden material systems, patched

// ---------------------------------------------------------------------------
// Template parts.
// ---------------------------------------------------------------------------
const parts = ['t1_head.html', 't2_engine.js', 't3_battle.js', 't4_shell.js']
  .map((f) => fs.readFileSync(path.join(HERE, f), 'utf8'));

let html = parts.join('\n');

// Inject golden GLSL + the patched scene head.
const injections = {
  COMMON,
  VS_TRI,
  FS_SCENE_HEAD,
  VS_PART,
  FS_PART,
  FS_DOWN,
  FS_BLUR,
  FS_FINAL,
};
for (const [k, v] of Object.entries(injections)) {
  const marker = `/*@@${k}@@*/`;
  if (!html.includes(marker)) throw new Error(`build: template missing marker ${marker}`);
  // strip the template's leading newline so `#version` stays on line 1
  html = html.replace(marker, v.replace(/^\n/, ''));
}
// The golden single-slot LENS is ported into the multi-slot FS_LENS in the
// template; FS_LENS_GOLDEN is extracted above purely as a provenance check
// (the baseline must still contain the authoritative original).
if (!FS_LENS_GOLDEN.includes('uShockR')) throw new Error('build: golden lens extraction looks wrong');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`built ${path.relative(REPO, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
