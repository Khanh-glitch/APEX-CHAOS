// APEX CHAOS — Phase 7 material chrome integrity check.
// Answers ONE question before anyone deploys or hands over a copy of the shell:
// "does every asset the phase7 block points at actually exist, and is the block
// actually inside the shell?" A missing sprite leaves a frame with no material —
// worse than the flat CSS it replaced — so this exits non-zero and says which file.
//
//   node tools/checkApexMaterialChrome.mjs            # check public/
//   node tools/checkApexMaterialChrome.mjs --dist     # check dist/ after a build
//   node tools/checkApexMaterialChrome.mjs --json     # machine readable
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const USE_DIST = process.argv.includes('--dist');
const AS_JSON = process.argv.includes('--json');
const ROOT = USE_DIST ? path.join(REPO, 'dist') : path.join(REPO, 'public');
const GOLD = path.join(ROOT, 'gold');

const fail = [];
const warn = [];
const ok = [];
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);

// 1. the block must be inside the shipping shell
const shellPath = path.join(GOLD, 'shell.html');
if (!fs.existsSync(shellPath)) fail.push(`shell.html missing at ${path.relative(REPO, shellPath)}`);
let block = '';
if (fs.existsSync(shellPath)) {
  const html = fs.readFileSync(shellPath, 'utf8');
  const a = html.indexOf('<style id="apex-phase7-material-chrome">');
  const b = a >= 0 ? html.indexOf('</style>', a) : -1;
  if (a < 0 || b < 0) fail.push('shell.html has no <style id="apex-phase7-material-chrome"> block — the material chrome is not installed');
  else {
    block = html.slice(a, b + 8);
    ok.push(`phase7 block present in shell.html (${(block.length / 1024).toFixed(1)} KB, ${block.split('\n').length} lines)`);
    // order matters: it must come after phase5 (which it overrides) and before the battle component CSS
    const i5 = html.indexOf('id="apex-phase5-superior"');
    const iB = html.indexOf('id="apex-battle-component-css"');
    if (i5 > a) fail.push('phase7 block sits BEFORE apex-phase5-superior — phase 5 rules would win');
    if (iB > -1 && a > iB) warn.push('phase7 block sits after the battle component CSS (works, but keep it before for review)');
    if (i5 > -1 && i5 < a) ok.push('phase7 block is ordered after apex-phase5-superior');
    // the rule the owner asked to keep
    if (!/#fighterSelectScreen\s+\.skillRows\{display:none!important\}/.test(html)) warn.push('the A1/A2 hide rule (#fighterSelectScreen .skillRows{display:none!important}) is not present');
  }
}

// 2. every url() the block points at must exist on disk
const refs = [...new Set([...block.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]))].sort();
if (!block) warn.push('no block to scan for url() references');
const assets = [];
for (const ref of refs) {
  // URLs inside shell.html resolve against <base href="/gold/">
  const rel = ref.startsWith('../') ? ref.slice(3) : ref.replace(/^\//, '');
  const abs = path.join(ROOT, rel);
  const rec = { ref, rel: `/${rel.replace(/^assets\//, 'assets/')}`, exists: fs.existsSync(abs), bytes: 0, sha12: '' };
  if (rec.exists) { rec.bytes = fs.statSync(abs).size; rec.sha12 = sha(abs); }
  assets.push(rec);
  if (rec.exists) ok.push(`${ref} — ${(rec.bytes / 1024).toFixed(1)} KB`);
  else fail.push(`MISSING ASSET: ${ref} → expected at ${path.relative(REPO, abs)}`);
}

// 3. the builder + the raw sources that regenerate those assets
const builder = path.join(REPO, 'tools', 'buildApexMaterialChrome.mjs');
if (!fs.existsSync(builder)) fail.push('tools/buildApexMaterialChrome.mjs missing — the 15 sprites cannot be regenerated');
else ok.push(`tools/buildApexMaterialChrome.mjs present (${(fs.statSync(builder).size / 1024).toFixed(1)} KB)`);
const brief = path.join(REPO, 'art-src', 'ui_material', 'MATERIAL_BRIEF.md');
if (!fs.existsSync(brief)) warn.push('art-src/ui_material/MATERIAL_BRIEF.md missing (material specs)');
const raws = ['tex/obsidian_scratch.jpg', 'tex/gold_leaf_worn.jpg', 'tex/gunmetal_scuffed.jpg', 'tex/ember_fissures.jpg', 'tex/rust_hazard.jpg', 'src/padlock_raw.png', 'src/corner_raw.png'];
for (const r of raws) {
  const p = path.join(REPO, 'art-src', 'ui_material', r);
  if (!fs.existsSync(p)) warn.push(`raw source missing: art-src/ui_material/${r} (builder needs it)`);
}
// 4. the audit registration, otherwise pruneShippingDist deletes the sprites from dist/
const reg = path.join(REPO, 'src', 'game', 'materialChromeAssets.js');
if (!fs.existsSync(reg)) fail.push('src/game/materialChromeAssets.js missing — tools/assetAudit.mjs would class the sprites LEGACY_NON_SHIPPING and pruneShippingDist would DELETE them from dist/');
else {
  const list = fs.readFileSync(reg, 'utf8');
  const missingInList = assets.filter((a) => a.exists && !list.includes(a.rel.replace(/^\//, '/'))).map((a) => a.rel);
  if (missingInList.length) warn.push(`not listed in materialChromeAssets.js: ${missingInList.join(', ')}`);
  else ok.push('all sprites listed in src/game/materialChromeAssets.js (assetAudit → SHIPPING_LAZY)');
}
if (USE_DIST && !fs.existsSync(path.join(ROOT, 'assets', 'ui_material'))) fail.push('dist/assets/ui_material/ does not exist — the build pruned the material chrome');

const summary = { root: path.relative(REPO, ROOT) || '.', spriteRefs: refs.length, spritesOk: assets.filter((a) => a.exists).length, fail: fail.length, warn: warn.length, assets };
if (AS_JSON) console.log(JSON.stringify(summary, null, 1));
else {
  console.log(`\nAPEX material chrome check — root: ${summary.root}`);
  console.log(`sprites referenced by the phase7 block: ${summary.spriteRefs}, present: ${summary.spritesOk}`);
  for (const l of ok) console.log(`  ok    ${l}`);
  for (const l of warn) console.log(`  WARN  ${l}`);
  for (const l of fail) console.log(`  FAIL  ${l}`);
  console.log(fail.length ? `\nRESULT: FAIL (${fail.length})\n` : '\nRESULT: PASS — the material chrome is complete.\n');
}
process.exit(fail.length ? 1 : 0);
