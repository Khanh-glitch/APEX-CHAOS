// ---------------------------------------------------------------------------
// HERO ACCENT LANGUAGE GATE  (owner report: "Crystal đang bị sai ngôn ngữ màu")
//
// A hero has exactly ONE colour language, and it comes from that hero's own art:
//   · the arena body colour  → apexEngine FighterTypes[].color  (the ONE source)
//   · the Gold product accent → APEX_ARSENAL_SHELLS.typeFor().color (reads it)
//   · the bridge fallback     → must not contradict it
//   · the generated shell     → must not contradict it (first painted frame)
//   · the crit/heavy slash    → accentOf(body) = body.color, so it follows too
//
// The bug this locks shut: CRYSTAL carried #6ed3d8 (teal) in the engine, #55bfff
// (sky) in the bridge fallback and #55bfff in the generated shell, while her
// entire authored palette is violet (AMETHYST, crystalaGoldV6.js). The wrong
// colour showed up wherever her accent was used: pick card, HUD accent, battle
// rail plate and the critical/heavy slash.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const failures = [];
const passes = [];
const check = (name, cond, detail) => (cond ? passes : failures).push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);

const engine = read('public/apexEngine.js');
const bridge = read('public/game/gold/goldProductBridge.js');
const gen = read('tools/buildGoldCutover.mjs');
const shell = read('public/gold/shell.html');
const crayArt = read('public/game/hero-rework/crystalaGoldV6.js');
const crayNamed = (() => {
  const m = crayArt.match(/const C = \{([\s\S]*?)\};/);
  const out = {};
  if (m) for (const [, k, v] of m[1].matchAll(/([a-zA-Z_]+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) out[k] = String(v).toLowerCase();
  return out;
})();

// shellKey -> the engine's fighter-type name (the ONE colour source).
const ROSTER = [
  { shellKey: 'newbot', engine: 'ROBOT' },
  { shellKey: 'hunter', engine: 'HUNTER' },
  { shellKey: 'crystala', engine: 'CRYSTAL' },
  { shellKey: 'magnet', engine: 'MAGNET' },
  { shellKey: 'frost', engine: 'ICE' },
  { shellKey: 'mirror', engine: 'MIRROR' },
];
// Production ids used by the generator's accent table.
const PRODUCTION = { newbot: 'ROBOT', hunter: 'HUNTER', crystala: 'CRYSTAL', magnet: 'MAGNET', frost: 'ICE', mirror: 'MIRROR' };

const HEX6 = /^#[0-9a-f]{6}$/;
const hex = (v) => String(v || '').toLowerCase();
const isHex6 = (v) => HEX6.test(hex(v));
const hue = (h) => {
  if (!HEX6.test(String(h))) return NaN;
  const n = parseInt(String(h).slice(1), 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  if (!d) return 0;
  let hh;
  if (max === r) hh = 60 * (((g - b) / d) % 6);
  else if (max === g) hh = 60 * (((b - r) / d) + 2);
  else hh = 60 * (((r - g) / d) + 4);
  return (hh + 360) % 360;
};

// ── 1. ONE product accent per hero across every declaration ─────────────────
const bridgeBlock = bridge.match(/const FALLBACK_ACCENTS = \{([\s\S]*?)\};/);
const bridgeAccents = {};
if (bridgeBlock) {
  for (const [, key, value] of bridgeBlock[1].matchAll(/([a-z0-9_]+):\s*'(#[0-9a-fA-F]{6})'/g)) bridgeAccents[key] = hex(value);
}
const genBlock = gen.match(/const GOLD_HERO_ACCENTS = \{([\s\S]*?)\};/);
const genAccents = {};
if (genBlock) {
  for (const [, key, value] of genBlock[1].matchAll(/([A-Z_]+):\s*'(#[0-9a-fA-F]{6})'/g)) genAccents[key] = hex(value);
}
const shellTable = (() => {
  const m = shell.match(/const HEROES = \(window\.APEX_GOLD_ROSTER \|\| (\{[\s\S]*?\})\);/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (_) { return null; }
})();
check('the generated shell carries a parseable fallback roster', !!shellTable);
check('the bridge declares a fallback accent for every shell hero',
  ROSTER.every((h) => !!bridgeAccents[h.shellKey]), Object.keys(bridgeAccents).join(','));
check('the generator declares an accent for every production hero',
  ROSTER.every((h) => !!genAccents[PRODUCTION[h.shellKey]]), Object.keys(genAccents).join(','));

for (const hero of ROSTER) {
  const product = bridgeAccents[hero.shellKey];
  check(`generator accent agrees with the bridge fallback for ${hero.shellKey}`,
    genAccents[PRODUCTION[hero.shellKey]] === product,
    `${genAccents[PRODUCTION[hero.shellKey]]} vs ${product}`);
  if (shellTable && shellTable[hero.shellKey]) {
    check(`generated shell fallback speaks the same accent for ${hero.shellKey}`,
      hex(shellTable[hero.shellKey].accent) === product,
      `${shellTable[hero.shellKey].accent} vs ${product}`);
  }
}

// ── 2. one accent per hero, never another hero's colour ─────────────────────
const productAccents = ROSTER.map((h) => bridgeAccents[h.shellKey]);
check('no two heroes share a product accent', new Set(productAccents).size === productAccents.length, productAccents.join(' '));

// ── 3. the accent must live in the hero's OWN art language ──────────────────
// An authored art palette is the hero's colour language. Where a palette is
// machine-readable, the accent has to be inside it (Crystal's old #55bfff was a
// sky-blue that appears nowhere in her violet palette — the owner's report).
function paletteOf(rel) {
  const src = read(rel);
  const out = new Map();
  const named = src.match(/const C = \{([\s\S]*?)\};/);
  if (named) for (const [, k, v] of named[1].matchAll(/([a-zA-Z_]+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) out.set(k, hex(v));
  const pal = src.match(/exports\.PAL = \{([\s\S]*?)\};/);
  if (pal) for (const [, k, v] of pal[1].matchAll(/([a-zA-Z_0-9]+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) out.set(k, hex(v));
  const ramp = src.match(/const ([A-Z_]+) = \[([^\]]*)\];/);
  if (ramp) for (const v of ramp[2].matchAll(/'(#[0-9a-fA-F]{6})'/g)) out.set('ramp' + out.size, hex(v[1]));
  return out;
}
function hueDistance(a, b) {
  const ha = hue(a); const hb = hue(b);
  if (!Number.isFinite(ha) || !Number.isFinite(hb)) return NaN;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d);
}
const ART_SOURCES = {
  crystala: 'public/game/hero-rework/crystalaGoldV6.js',
  hunter: 'public/game/hero-rework/hunterGoldV10.js',
};
for (const [hero, rel] of Object.entries(ART_SOURCES)) {
  const palette = paletteOf(rel);
  const accent = bridgeAccents[hero];
  const usable = [...palette.values()].filter(isHex6);
  const best = usable.map((v) => hueDistance(accent, v)).filter(Number.isFinite).sort((a, b) => a - b)[0];
  check(`${hero}'s accent is inside its own art palette (hue within 40 degrees)`,
    best !== undefined && best <= 40, `accent ${accent} hue ${Math.round(hue(accent))}°, nearest palette hue is ${best === undefined ? 'n/a' : Math.round(best)}° away`);
}
check('CRYSTAL\'s accent is her palette violet (not a teal/sky hue)',
  hex(bridgeAccents.crystala) === crayNamed.vio || (hue(bridgeAccents.crystala) >= 255 && hue(bridgeAccents.crystala) <= 300),
  `accent ${bridgeAccents.crystala} hue ${Math.round(hue(bridgeAccents.crystala))}°, palette vio ${crayNamed.vio}`);
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('CRYSTAL\'s previous colour language is gone from every authority',
  !/#6ed3d8/i.test(stripComments(engine))
  && !/#55bfff/i.test(stripComments(bridge))
  && !/#55bfff/i.test(stripComments(gen))
  && !/#55bfff/i.test(shell),
  'no live #6ed3d8 / #55bfff declaration remains');
// The engine table still owns the legacy arena body colour; Crystal's must be her
// own language there too (it was #6ed3d8 — the teal the owner called wrong).
const engineCrystal = (engine.match(/name: "CRYSTAL", color: "(#[0-9a-fA-F]{6})"/) || [])[1];
check('CRYSTAL\'s arena body colour is her art colour too (engine == product accent)',
  hex(engineCrystal) === bridgeAccents.crystala, `${engineCrystal} vs ${bridgeAccents.crystala}`);

// ── 5. the crit/heavy slash follows that same accent (owner item) ───────────
check('the impact accent is read from the body colour',
  /function accentOf\(body\) \{\s*\n\s*return \(body && body\.color\) \|\| '#[0-9a-f]{6}';/.test(bridge));
const hud = read('public/gold/battle-hud.html');
const hudGen = read('tools/buildGoldCutover.mjs');
check('crit/heavy damage colour is the per-hit impact accent, not a shared variable',
  /const col=\(tier==='crit'\|\|tier==='heavy'\)\?\(impactAccent\|\|ACC\[a\]\)/.test(hud));
check('the critical slash/sweep receives the event accent',
  /sweep\(a,v,'crit'\)/.test(hud) && /fxCrit\(a,v,amt,eventAccent\)/.test(hud));
check('the heavy slash/sweep receives the event accent',
  /sweep\(a,v,'heavy'\)/.test(hud) && /fxHeavy\(a,v,amt,eventAccent\)/.test(hud));
check('the bridge captures the source accent on the damage transaction',
  /const impactAccent = accentOf\(ev\.attacker\);/.test(bridge));
check('the generator table is the one place the shell accents come from',
  /for \(const entry of LUCKY_ROSTER\)/.test(gen) && /hero\.accent = accent;/.test(gen));

console.log(['HERO ACCENT LANGUAGE GATE (one colour language per hero)', ...passes].join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS (' + passes.length + ' checks)');
