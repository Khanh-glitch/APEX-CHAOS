// Deterministic runtime cache-bust and pre-pilot product-closure gate.
// Every versioned public runtime must match the one manifest revision and the
// locked SHA-256; retired Quest executables must not re-enter the product graph.
import fs from 'node:fs';
import crypto from 'node:crypto';

const LOCK = 'tools/runtimeRevision.lock.json';
const manifest = fs.readFileSync('src/game/runtimeManifest.js', 'utf8');
const loader = fs.readFileSync('src/game/runtimeLoader.js', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const mRev = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
if (!mRev) { console.error('FAIL revision constant missing'); process.exit(1); }
const revision = mRev[1];
const expectedRevision = '20261003-mirror-v1-r35';
if (revision !== expectedRevision) {
  console.error(`FAIL this cutover permits exactly one revision: expected=${expectedRevision} actual=${revision}`);
  process.exit(1);
}
const paths = [...manifest.matchAll(/'\/(game\/[^']+?)\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION/g)]
  .map((match) => `public/${match[1]}`);
const required = [
  'public/game/arsenal/arsenalConfig.js',
  'public/game/arsenal/arsenalShellSelectRuntime.js',
  'public/game/arsenal/arsenalMetaRuntime.js',
  'public/game/modes/arsenalBattleRuntime.js',
  'public/game/hero-rework/heroReworkRuntime.js',
];
const missing = required.filter((file) => !paths.includes(file));
if (missing.length) {
  console.error('FAIL required active runtimes are not versioned:', missing);
  process.exit(1);
}

const productBlock = manifest.match(/export const ARSENAL_PRODUCT_RUNTIMES = \[([\s\S]*?)\n\];/);
const modeBlock = manifest.match(/export const MODE_DEFERRED_RUNTIMES = \{([\s\S]*?)\n\};/);
const warmupBlock = manifest.match(/export const WARMUP_GROUP_SEQUENCE = \[([\s\S]*?)\];/);
if (!productBlock || /arsenalQuest(Runtime|Ladder|Config)\.js/.test(productBlock[1])) {
  console.error('FAIL active Arsenal product runtimes reference retired Quest executables');
  process.exit(1);
}
if (!modeBlock || /arsenalQuest|arsenalLegacyQuest/i.test(modeBlock[1])) {
  console.error('FAIL retired Quest runtime group remains registered');
  process.exit(1);
}
if (!warmupBlock || /arsenalQuest|arsenalLegacyQuest/i.test(warmupBlock[1])
    || !/['"]arsenalProduct['"]/.test(warmupBlock[1])) {
  console.error('FAIL warmup must include the neutral Arsenal product group and exclude retired Quest groups');
  process.exit(1);
}
if (/arsenalLegacyQuest|arsenalQuestRuntime\.js|arsenalQuestLadder\.js/.test(loader)) {
  console.error('FAIL runtime loader retains a detached Quest compatibility path');
  process.exit(1);
}
if (/startArsenalQuestMode|exitArsenalQuestMode|beginArsenalQuestSelection|beginArsenalQuestMap/.test(app)) {
  console.error('FAIL React product bridge retains a retired Quest route alias');
  process.exit(1);
}
const retiredFiles = [
  'public/game/arsenal/arsenalQuestLadder.js',
  'public/game/modes/arsenalQuestRuntime.js',
  'public/game/arsenal/arsenalQuestConfig.js',
];
const stillPresent = retiredFiles.filter((file) => fs.existsSync(file));
if (stillPresent.length) {
  console.error('FAIL retired executable files remain:', stillPresent);
  process.exit(1);
}

const hashes = {};
for (const file of paths) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL manifest runtime missing: ${file}`);
    process.exit(1);
  }
  hashes[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
if (process.env.UPDATE_LOCK === '1') {
  fs.writeFileSync(LOCK, JSON.stringify({ revision, files: hashes }, null, 2) + '\n');
  console.log(`[RUNTIME REVISION GATE] lock updated: ${revision}, ${paths.length} versioned runtimes`);
  process.exit(0);
}
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
let fail = 0;
if (lock.revision !== revision) {
  console.error(`FAIL revision/lock mismatch: manifest=${revision} lock=${lock.revision}`);
  fail = 1;
}
for (const [file, sha] of Object.entries(lock.files || {})) {
  if (!paths.includes(file)) {
    console.error(`FAIL lock references unversioned runtime ${file}`);
    fail = 1;
  } else if (hashes[file] !== sha) {
    console.error(`FAIL ${file} changed under locked revision ${lock.revision} — relock only after implementation is final (UPDATE_LOCK=1)`);
    fail = 1;
  }
}
for (const file of paths) {
  if (!lock.files?.[file]) {
    console.error(`FAIL ${file} is versioned but absent from the lock`);
    fail = 1;
  }
}
console.log(fail ? '[RUNTIME REVISION GATE] FAIL'
  : `[RUNTIME REVISION GATE] PASS revision=${revision} versionedRuntimes=${paths.length}`);
process.exit(fail);
