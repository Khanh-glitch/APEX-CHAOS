import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_FIXTURE_RUNTIME_PATHS,
  LEGACY_RUNTIME_FIXTURE_ROOT,
  resolveLegacyRuntimeFile,
} from './legacyRuntimeManifest.mjs';

const REPO = process.cwd();
const PUBLIC_GAME = path.join(REPO, 'public', 'game');
const manifestPath = path.join(REPO, 'src', 'game', 'runtimeManifest.js');
const enginePath = path.join(REPO, 'public', 'apexEngine.js');
const appPath = path.join(REPO, 'src', 'App.jsx');
const stylesPath = path.join(REPO, 'src', 'styles.css');
const pickRuntimePath = path.join(REPO, 'public', 'game', 'ui', 'apexPickRuntime.js');

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const runtimeKey = (src) => String(src).split(/[?#]/, 1)[0];
const manifestSource = fs.readFileSync(manifestPath, 'utf8');
const productionRuntimePaths = new Set(
  [...manifestSource.matchAll(/\['(\/game\/[^']+)'/g)].map((match) => runtimeKey(match[1])),
);
const publicRuntimePaths = new Set(
  walkJs(PUBLIC_GAME).map((file) => '/' + path.relative(path.join(REPO, 'public'), file).split(path.sep).join('/')),
);

assert.deepEqual(
  [...publicRuntimePaths].sort(),
  [...productionRuntimePaths].sort(),
  'public/game must contain exactly the production runtime graph and no legacy/orphan JS',
);

for (const logicalPath of LEGACY_FIXTURE_RUNTIME_PATHS) {
  assert.ok(!productionRuntimePaths.has(logicalPath), `legacy fixture leaked into production manifest: ${logicalPath}`);
  const publicPath = path.join(REPO, 'public', logicalPath.replace(/^\//, ''));
  assert.equal(fs.existsSync(publicPath), false, `legacy fixture still exists under public/: ${logicalPath}`);

  const resolved = resolveLegacyRuntimeFile(REPO, logicalPath);
  assert.ok(
    resolved.startsWith(path.join(REPO, LEGACY_RUNTIME_FIXTURE_ROOT) + path.sep),
    `legacy resolver did not quarantine ${logicalPath}: ${resolved}`,
  );
  assert.ok(fs.existsSync(resolved), `legacy fixture missing: ${resolved}`);
}

const fixtureReadme = path.join(REPO, LEGACY_RUNTIME_FIXTURE_ROOT, 'README.md');
assert.ok(fs.existsSync(fixtureReadme), 'legacy fixture quarantine README is missing');
assert.match(fs.readFileSync(fixtureReadme, 'utf8'), /not product authority/i);

const retiredOrphanPaths = [
  '/game/modes/apexControlChampionSkills.js',
  '/game/modes/soloRuntime.js',
  '/game/modes/tamChienRuntime.js',
  '/game/modes/trialRuntime.js',
  '/game/ui/apexCharacterSelectUi.js',
];
for (const logicalPath of retiredOrphanPaths) {
  assert.equal(
    fs.existsSync(path.join(REPO, 'public', logicalPath.replace(/^\//, ''))),
    false,
    `retired orphan runtime returned to public/: ${logicalPath}`,
  );
}

const engineSource = fs.readFileSync(enginePath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
const stylesSource = fs.readFileSync(stylesPath, 'utf8');
const pickRuntimeSource = fs.readFileSync(pickRuntimePath, 'utf8');
const productPresentationSources = [engineSource, appSource, stylesSource, pickRuntimeSource];
for (const logicalPath of [...LEGACY_FIXTURE_RUNTIME_PATHS, ...retiredOrphanPaths]) {
  assert.ok(!engineSource.includes(logicalPath), `apexEngine contains stale legacy runtime pointer: ${logicalPath}`);
}
assert.ok(!manifestSource.includes(LEGACY_RUNTIME_FIXTURE_ROOT), 'production manifest points into test fixtures');

for (const forbidden of ['/assets/shotgun_v1/', 'SELECTED_FIGHTER_VFX']) {
  assert.ok(
    productPresentationSources.every((source) => !source.includes(forbidden)),
    `retired generic select shell leaked back into production presentation: ${forbidden}`,
  );
}

console.log(JSON.stringify({
  productionPublicRuntimes: productionRuntimePaths.size,
  quarantinedLegacyRuntimes: LEGACY_FIXTURE_RUNTIME_PATHS.size,
  retiredOrphans: retiredOrphanPaths.length,
  staleEnginePointers: 0,
  retiredSelectShellLeaks: 0,
}, null, 2));
