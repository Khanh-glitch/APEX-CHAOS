// AUDIT-E Finding 1: deterministic cache-bust guard. Every public runtime URL
// versioned with APEX_ARSENAL_RUNTIME_REVISION must (a) actually carry the
// locked revision string and (b) match the locked content hash. Editing any
// versioned public runtime without bumping the revision + re-locking FAILS,
// so a stale revision can never silently ship again.
import fs from 'node:fs';
import crypto from 'node:crypto';
const LOCK = 'tools/runtimeRevision.lock.json';
const manifest = fs.readFileSync('src/game/runtimeManifest.js', 'utf8');
const mRev = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
if (!mRev) { console.error('FAIL revision constant missing'); process.exit(1); }
const revision = mRev[1];
const urls = [...manifest.matchAll(/'\(\/game\/[^']+\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION, '(\w+)'/g)].map(m => m[1].replace(/^'/, ''));
const paths = [...manifest.matchAll(/'\/(game\/[^']+?)\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION/g)].map(m => 'public/' + m[1]);
const required = [
  'public/game/arsenal/arsenalChamberPaletteRuntime.js',
  'public/game/arsenal/arsenalMetaRuntime.js',
  'public/game/modes/arsenalBattleRuntime.js',
];
const missing = required.filter(r => !paths.includes(r));
if (missing.length) { console.error('FAIL required runtimes not versioned:', missing); process.exit(1); }

// Pre-pilot routing closure: the normal product bundle must never accidentally
// absorb retired Quest code while its explicit compatibility bundle preserves
// versioned historical access.
const productBlock = manifest.match(/export const ARSENAL_PRODUCT_RUNTIMES = \[([\s\S]*?)\n\];/);
const legacyBlock = manifest.match(/export const ARSENAL_LEGACY_QUEST_RUNTIMES = \[([\s\S]*?)\n\];/);
if (!productBlock || /arsenalQuestRuntime\.js|arsenalQuestLadder\.js/.test(productBlock[1])) {
  console.error('FAIL neutral Arsenal product core references a detached Quest runtime');
  process.exit(1);
}
if (!legacyBlock || !/arsenalQuestRuntime\.js/.test(legacyBlock[1]) || !/arsenalQuestLadder\.js/.test(legacyBlock[1])) {
  console.error('FAIL explicit detached Quest compatibility group is incomplete');
  process.exit(1);
}
const warmupBlock = manifest.match(/export const WARMUP_GROUP_SEQUENCE = \[([\s\S]*?)\];/);
if (!warmupBlock || /(arsenalLegacyQuest|['"]arsenalQuest['"])/.test(warmupBlock[1])) {
  console.error('FAIL a detached Quest group is scheduled for normal warmup');
  process.exit(1);
}
const hashes = {};
for (const p of paths) hashes[p] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if (process.env.UPDATE_LOCK === '1') {
  fs.writeFileSync(LOCK, JSON.stringify({ revision, files: hashes }, null, 2));
  console.log(`[RUNTIME REVISION GATE] lock updated: ${revision}, ${paths.length} versioned runtimes`);
  process.exit(0);
}
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
let fail = 0;
if (lock.revision !== revision) { console.error(`FAIL revision bumped without re-lock: manifest=${revision} lock=${lock.revision}`); fail = 1; }
for (const [p, h] of Object.entries(lock.files)) {
  if (!paths.includes(p)) { console.error(`FAIL lock references unversioned path ${p}`); fail = 1; continue; }
  if (hashes[p] !== h) { console.error(`FAIL ${p} changed under locked revision ${lock.revision} — bump APEX_ARSENAL_RUNTIME_REVISION and re-lock (UPDATE_LOCK=1)`); fail = 1; }
}
for (const p of paths) if (!lock.files[p]) { console.error(`FAIL ${p} versioned but absent from lock`); fail = 1; }
console.log(fail ? '[RUNTIME REVISION GATE] FAIL' : `[RUNTIME REVISION GATE] PASS revision=${revision} versionedRuntimes=${paths.length}`);
process.exit(fail);
