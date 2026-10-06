// ---------------------------------------------------------------------------
// HERO BATTLE RIG DELIVERY GATE
//
// Owner report 2026-10-06:
//   · "Magnet's assets load no visual in battle — neither skills nor fighter"
//   · "Frost loads later than the others"
//
// Root causes this gate locks shut:
//   1. The arena body rigs are loaded from URLs the runtimes COMPOSE at draw
//      time (`/assets/magnet_v1/gold/${id}-${tag}-base.png`). A literal-path
//      scanner cannot see them, so tools/assetAudit classified the whole rig
//      LEGACY_NON_SHIPPING and pruneShippingDist deleted it from dist — Magnet
//      then had NO visuals at all (its loadAssets() rejects, ready stays false).
//      The generated ONE authority (src/game/goldAssetManifest.js:
//      HERO_BATTLE_RIGS) now declares the intent, so the files are classified
//      SHIPPING and survive the prune.
//   2. Rigs used to load lazily on the match's first frames. The product asset
//      runtime now preloads them with the fighter/battle surfaces, so the
//      battle-entry handoff waits for the body instead of the player watching it
//      appear.
//
// This gate recomputes what each runtime will actually request (from its own
// declared ids/tags/channels/layers — not from the manifest it is checking) and
// proves every one of those files is (a) on disk, (b) declared shipping, and
// (c) present in the pruned dist build.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(REPO, rel));

// Recursive image walk of a rig directory, expressed as public URLs.
function walkRigDir(relDir, prefix = '') {
  const abs = path.join(REPO, relDir, prefix);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkRigDir(relDir, rel));
    else if (/\.(png|webp|jpg|jpeg|svg)$/i.test(entry.name)) out.push(`/${relDir.replace(/^public\//, '')}/${rel}`);
  }
  return out;
}

const failures = [];
const passes = [];
function check(name, cond, detail) {
  (cond ? passes : failures).push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ` :: ${detail}` : ''));
}

const manifest = read('src/game/goldAssetManifest.js');
const shipList = new Set([...manifest.matchAll(/'(\/[^']+)'/g)].map((m) => m[1]));
const rigTableMatch = manifest.match(/export const HERO_BATTLE_RIGS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
const rigTable = {};
if (rigTableMatch) {
  // Line-oriented parse: `  <hero>: Object.freeze([` … `  ]),`
  let hero = null;
  for (const line of rigTableMatch[1].split('\n')) {
    const open = line.match(/^ {2}([a-z_]+): Object\.freeze\(\[$/);
    if (open) { hero = open[1]; rigTable[hero] = []; continue; }
    if (/^ {2}\],?$/.test(line)) { hero = null; continue; }
    const url = line.match(/'([^']+)'/);
    if (hero && url) rigTable[hero].push(url[1]);
  }
}

check('the rig intent table is generated and exported', !!rigTableMatch && Object.keys(rigTable).length >= 4,
  Object.keys(rigTable).join(','));
check('the flattened rig asset list is exported for the app to publish',
  /export const HERO_BATTLE_RIG_ASSETS = Object\.freeze\(\s*Object\.values\(HERO_BATTLE_RIGS\)\.flat\(\),\s*\);/s.test(manifest));

// ── 1. MAGNET: recompute the composed set from the runtime's own declaration ──
{
  const src = read('public/game/hero-rework/magnetGoldV1.js');
  const ids = (src.match(/const IDS=\[([^\]]*)\]/) || [])[1];
  const idsList = ids ? ids.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  const metaEntries = [...src.matchAll(/(\w+):\{[^}]*?channels:\[([^\]]*)\]/g)]
    .map((m) => [m[1], m[2].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)]);
  const meta = Object.fromEntries(metaEntries);
  check('magnet runtime still declares its rig ids and channels', idsList.length === 6 && Object.keys(meta).length === 6,
    `${idsList.length} ids / ${Object.keys(meta).length} channel specs`);

  const expected = [];
  for (const id of idsList) {
    for (const tag of ['half', 'quarter']) {
      expected.push(`/assets/magnet_v1/gold/${id}-${tag}-base.png`);
      for (const channel of (meta[id] || [])) {
        for (const kind of ['gold', 'dim', 'glow']) expected.push(`/assets/magnet_v1/gold/${id}-${tag}-${channel}-${kind}.png`);
      }
    }
  }
  const missingOnDisk = expected.filter((u) => !exists('public' + u));
  check('every composed magnet rig file exists on disk', missingOnDisk.length === 0, missingOnDisk.slice(0, 3).join(' '));
  const undeclared = expected.filter((u) => !shipList.has(u));
  check('every composed magnet rig file is declared SHIPPING (prune cannot delete it)',
    undeclared.length === 0, `${undeclared.length} undeclared e.g. ${undeclared.slice(0, 2).join(' ')}`);
  const inTable = expected.filter((u) => (rigTable.magnet || []).includes(u));
  check('the magnet rig is in the preload table', inTable.length === expected.length,
    `${inTable.length}/${expected.length}`);
  check('the magnet rig set is exactly the runtime set (no dead entries)',
    (rigTable.magnet || []).length === expected.length, `${(rigTable.magnet || []).length} declared`);
}

// ── 2. FROST: literal layer table must be declared + preloaded ───────────────
{
  const src = read('public/game/hero-rework/frostGoldV1.js');
  const layers = [...src.matchAll(/["'](?:\/)?assets\/hero-rework\/frost-v1\/([A-Za-z0-9_.-]+)["']/g)].map((m) => m[1]);
  check('frost declares its layer files', layers.length >= 5, `${layers.length} layers`);
  const urls = layers.map((f) => `/assets/hero-rework/frost-v1/${f}`);
  check('every frost layer is declared shipping', urls.every((u) => shipList.has(u)));
  check('every frost layer is in the preload table',
    urls.every((u) => (rigTable.frost || []).includes(u)), `${(rigTable.frost || []).length} declared`);
}

// ── 3. HUNTER: parts + the composed clean set ────────────────────────────────
{
  const src = read('public/game/hero-rework/hunterGoldV10.js');
  // The runtime references both top-level parts and the composed `clean/` set;
  // the intent is the whole rig directory, so the expectation is the directory.
  const urls = walkRigDir('public/assets/hero-rework/hunter-v10');
  check('hunter rig files are on disk', urls.length >= 18, `${urls.length} files`);
  const refs = [...src.matchAll(/[\"']\/assets\/hero-rework\/hunter-v10\/([A-Za-z0-9_/.\-]+)[\"']/g)]
    .map((m) => `/assets/hero-rework/hunter-v10/${m[1]}`);
  check('hunter runtime references files inside its rig directory',
    refs.length > 0 && refs.every((u) => urls.includes(u)), `${refs.length} refs`);
  check('every hunter rig file is declared shipping', urls.every((u) => shipList.has(u)),
    urls.filter((u) => !shipList.has(u)).slice(0, 3).join(' '));
  check('every hunter rig file is in the preload table', urls.every((u) => (rigTable.hunter || []).includes(u)));
}

// ── 3b. the table is exactly the directory intent (no drift, no dead entries) ──
{
  const gen = read('tools/buildGoldCutover.mjs');
  const dirBlock = gen.match(/const HERO_BATTLE_RIG_DIRS = \{([\s\S]*?)\n  \};/);
  const dirs = dirBlock ? [...dirBlock[1].matchAll(/([a-z_]+): \[([^\]]*)\]/g)]
    .map((m) => [m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])]) : [];
  check('the generator declares the rig directories', dirs.length >= 4, `${dirs.length} heroes`);
  let drift = [];
  for (const [hero, list] of dirs) {
    const expected = list.flatMap((d) => walkRigDir('public' + d));
    const declared = rigTable[hero] || [];
    const diff = expected.filter((u) => !declared.includes(u)).concat(declared.filter((u) => !expected.includes(u)));
    if (diff.length) drift.push(`${hero}:${diff.length}`);
  }
  check('every declared rig directory matches the generated table exactly', drift.length === 0, drift.join(' '));
}

// ── 4. the preload wiring (product asset runtime + app publish) ──────────────
{
  const assets = read('public/game/product/productAssetRuntime.js');
  check('the product asset runtime resolves a rig role from the ONE authority',
    /function rigUrls\(heroIds, roles\)/.test(assets) && /window\.APEX_HERO_RIGS/.test(assets));
  check('the battle/transition surface preloads the match rig',
    /id === 'battle' \|\| id === 'transition'[\s\S]{0,400}rigUrls\(/.test(assets));
  check('the fighter surface preloads the focused rig', /if \(id === 'fighter'\)[\s\S]{0,400}rigUrls\(/.test(assets));

  const app = read('src/App.jsx');
  check('the app publishes the rig authority for the classic runtimes',
    /window\.APEX_HERO_RIGS = HERO_BATTLE_RIGS;/.test(app) && /window\.APEX_HERO_RIG_ASSETS = HERO_BATTLE_RIG_ASSETS;/.test(app));
  check('the app imports the generated rig authority', /HERO_BATTLE_RIGS, HERO_BATTLE_RIG_ASSETS \} from '\.\/game\/goldAssetManifest\.js'/.test(app));

  const gen = read('tools/buildGoldCutover.mjs');
  check('the generator owns the rig directory intent', /const HERO_BATTLE_RIG_DIRS = \{/.test(gen)
    && /heroBattleRigs/.test(gen));
}

// ── 4b. the asset AUDIT itself classifies them as shipping ───────────────────
// The audit is what the prune obeys, so the gate re-runs it (it writes the
// git-ignored reports/asset-audit.json) and proves the composed rig files are no
// longer LEGACY_NON_SHIPPING — the exact classification that deleted Magnet's
// 55-file rig and left the hero with no visuals at all.
{
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync(process.execPath, ['tools/assetAudit.mjs'], { cwd: REPO, encoding: 'utf8' });
  const auditPath = path.join(REPO, 'reports', 'asset-audit.json');
  if (run.status !== 0 || !fs.existsSync(auditPath)) {
    check('the asset audit runs (single source of truth for the prune)', false, String(run.stderr || '').slice(0, 200));
  } else {
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    const byPath = new Map((audit.assets || []).map((a) => [a.path, a]));
    const all = Object.values(rigTable).flat();
    const missing = all.filter((u) => !byPath.has(u));
    const legacy = all.filter((u) => (byPath.get(u) || {}).classification === 'LEGACY_NON_SHIPPING');
    check('the audit knows every declared rig file', missing.length === 0, `${missing.length} unknown`);
    check('no declared rig file is classified LEGACY_NON_SHIPPING',
      legacy.length === 0, legacy.slice(0, 3).join(' '));
    const magnetLegacy = (rigTable.magnet || []).filter((u) => (byPath.get(u) || {}).classification === 'LEGACY_NON_SHIPPING');
    check('the magnet rig is shipping-classified (owner report: no visuals in battle)',
      magnetLegacy.length === 0 && (rigTable.magnet || []).length >= 50);
  }
}

// ── 5. the pruned dist actually carries them ─────────────────────────────────
{
  const DIST = path.join(REPO, 'dist');
  if (!fs.existsSync(DIST)) {
    check('dist exists for the delivery check (run pnpm build first)', false, 'dist/ missing');
  } else {
    const all = Object.values(rigTable).flat();
    const missing = all.filter((u) => !fs.existsSync(path.join(DIST, u.replace(/^\//, ''))));
    check('every declared rig file survives the shipping prune', missing.length === 0,
      `${missing.length} missing e.g. ${missing.slice(0, 3).join(' ')}`);
    check('the delivery check has real coverage', all.length >= 80, `${all.length} rig files`);
  }
}

console.log(['HERO BATTLE RIG DELIVERY GATE', ...passes].join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS (' + passes.length + ' checks)');
