// A5 — runtime asset classification audit.
//
// Classifies every file under public/ into:
//   SHIPPING_HOT                  — fetched on the menu-interactive critical path
//                                  (loader/menu chrome, menu BGM, engine, Tier-1
//                                  menu runtime scripts).
//   SHIPPING_LAZY                 — referenced by shipping runtime code but only
//                                  needed after a route intent / match start
//                                  (fighter packs, battle VFX, arsenal SFX...).
//   LEGACY_NON_SHIPPING           — not referenced by any shipping code. May be
//                                  referenced by legacy test tooling only.
//   SOURCE_MASTER_PROVENANCE_ONLY — raw sources kept for provenance (under a
//                                  */source/ folder, or WAV masters that already
//                                  have a compressed delivery sibling).
//
// Reference scanning covers shipping code (src/, public/*.js, public/game/**,
// index.html) and, separately, tooling (tools/). A file is "shipping" when any
// shipping file mentions its public path or its basename.
//
// Usage: node tools/assetAudit.mjs [--out reports/asset-audit.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(REPO, 'public');

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(REPO, 'reports', 'asset-audit.json');

const SHIP_GLOBS = [
  'index.html',
  'src',
  'public/game',
];
const SHIP_ROOT_FILES = fs.readdirSync(PUBLIC, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(js|json|html|css)$/i.test(e.name) && e.name !== 'asset-manifest.json')
  .map((e) => path.join(PUBLIC, e.name));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function listTextFiles(rootDir, skip) {
  const stat = fs.statSync(rootDir);
  const files = stat.isDirectory() ? walk(rootDir) : [rootDir];
  return files.filter((f) => /\.(js|jsx|cjs|mjs|json|html|css)$/i.test(f) && !skip(f));
}

const shipFiles = [
  ...SHIP_GLOBS.flatMap((g) => listTextFiles(path.join(REPO, g), () => false)),
  ...SHIP_ROOT_FILES,
];
const toolFiles = listTextFiles(path.join(REPO, 'tools'), (f) => f.includes(path.join('tools', 'arsenal-assets')));

const shipText = shipFiles.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') }));
const toolText = toolFiles.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') }));

const publicFiles = walk(PUBLIC);
const ASSET_EXTS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif', '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.mp4', '.webm', '.json', '.js']);
const assets = publicFiles.filter((f) => ASSET_EXTS.has(path.extname(f).toLowerCase()) && !/(^|\/)asset-manifest\.json$/.test(f));

// Hot-path membership: the exact criticalBootAssets() set from App.jsx plus
// the Tier-1 menu runtime scripts and menu BGM (see runtimeManifest.js).
const HOT_PATHS = new Set([
  '/assets/loading/loading-bg-portrait.webp',
  '/assets/loading/loading-bg-landscape.webp',
  '/assets/loading/apex-chaos-title.webp',
  '/assets/loading/loading-bar-frame.webp',
  '/assets/ui_2026/menu-bg-landscape.webp',
  '/assets/ui_2026/menu-bg-portrait.webp',
  '/assets/ui_2026/menu-vfx-overlay.webp',
  '/assets/ui_2026/menu-play.webp',
  '/assets/ui_2026/menu-pvp.webp',
  '/assets/ui_2026/menu-3phase.webp',
  '/assets/ui_2026/menu-saitama-test.webp',
  '/assets/ui_2026/menu-tournament.webp',
  '/assets/ui_2026/menu-solo.webp',
  '/assets/audio/menu_bgm.mp3',
  '/apexEngine.js',
]);

function toPublicPath(abs) {
  return '/' + path.relative(PUBLIC, abs).split(path.sep).join('/');
}

function findRefs(publicPath, corpus) {
  const base = path.basename(publicPath);
  const segments = publicPath.split('/').filter(Boolean);
  // Longest unambiguous path suffix (up to 4 segments) that identifies the
  // file: catches ROOT-relative refs like 'vfx/c/smoke_01.png' or
  // 'audio/fire_sfx.wav' without over-matching bare basenames.
  let suffix = base;
  for (let take = Math.min(4, segments.length); take >= 2; take -= 1) {
    const candidate = segments.slice(-take).join('/');
    const owners = assetIndex.filter((a) => a.publicPath.endsWith('/' + candidate) || a.publicPath === '/' + candidate);
    if (owners.length === 1) { suffix = candidate; break; }
  }
  const refs = [];
  for (const { file, text } of corpus) {
    const match = text.includes(publicPath) ? 'path'
      : text.includes(suffix) && suffix !== base ? 'suffix'
      : text.includes(base) ? 'basename' : null;
    if (match) refs.push({ file: path.relative(REPO, file).split(path.sep).join('/'), match });
  }
  return refs;
}

function hasCompressedAudioSibling(abs) {
  const base = abs.slice(0, -path.extname(abs).length);
  return ['.mp3', '.ogg', '.m4a', '.aac'].some((ext) => fs.existsSync(base + ext));
}

// Template-literal asset refs that a static scan cannot see, e.g.
// `vfx/c/smoke_${n}.png` in arsenalPresentationRuntime.js.
const TEMPLATE_REFS = [
  { pattern: 'vfx/c/smoke_${n}.png', dir: '/assets/arsenal/av/vfx/c/', ext: '.png', file: 'public/game/arsenal/arsenalPresentationRuntime.js' },
  { pattern: 'vfx/c/spark_${n}.png', dir: '/assets/arsenal/av/vfx/c/', ext: '.png', file: 'public/game/arsenal/arsenalPresentationRuntime.js' },
];

const report = [];
const assetIndex = assets.map((abs) => ({ abs, publicPath: toPublicPath(abs) }));
for (const { abs, publicPath } of assetIndex) {
  const ext = path.extname(abs).toLowerCase();
  let shipRefs = findRefs(publicPath, shipText);
  let toolRefs = findRefs(publicPath, toolText);

  for (const t of TEMPLATE_REFS) {
    if (publicPath.startsWith(t.dir) && publicPath.endsWith(t.ext)) {
      shipRefs.push({ file: t.file, match: 'template' });
    }
  }

  const isSourceDir = /\/source\//.test(publicPath) || /\/sources?\//.test(publicPath);
  const isWavMaster = ext === '.wav' && hasCompressedAudioSibling(abs);
  // Full-res heal art under feel/heals/ is referenced only by the HEAL_MASTERS
  // provenance metadata in arsenalFeelRuntime.js (the `master:` descriptor
  // field has no consumers); runtime fetches feel/heals/runtime/* instead.
  const isHealMaster = ext === '.png' && /^\/assets\/arsenal\/feel\/heals\/[^/]+\.png$/.test(publicPath);
  // PNG whose shipping hits are basename-only while the same basename exists
  // elsewhere with a real path/suffix reference is a source master (e.g. the
  // full-res heal art next to feel/heals/runtime/*).
  const isPngMaster = ext === '.png'
    && shipRefs.length > 0
    && shipRefs.every((r) => r.match === 'basename')
    && assetIndex.some((other) => other.publicPath !== publicPath
      && path.basename(other.publicPath) === path.basename(publicPath)
      && findRefs(other.publicPath, shipText).some((r) => r.match !== 'basename'));

  let classification;
  if (isSourceDir || isWavMaster || isPngMaster || isHealMaster) classification = 'SOURCE_MASTER_PROVENANCE_ONLY';
  else if (HOT_PATHS.has(publicPath)) classification = 'SHIPPING_HOT';
  else if (shipRefs.length) classification = 'SHIPPING_LAZY';
  else classification = 'LEGACY_NON_SHIPPING';

  report.push({
    path: publicPath,
    bytes: fs.statSync(abs).size,
    type: ext.replace('.', ''),
    classification,
    shipRefs,
    toolRefs,
  });
}

const byClass = {};
for (const entry of report) {
  byClass[entry.classification] ??= { files: 0, bytes: 0 };
  byClass[entry.classification].files += 1;
  byClass[entry.classification].bytes += entry.bytes;
}
const hotBytes = report.filter((e) => e.classification === 'SHIPPING_HOT').reduce((s, e) => s + e.bytes, 0);

const summary = {
  generatedAt: new Date().toISOString(),
  totalFiles: report.length,
  totalBytes: report.reduce((s, e) => s + e.bytes, 0),
  byClassification: byClass,
  hotPathBytes: hotBytes,
  largestShippingLazy: report
    .filter((e) => e.classification === 'SHIPPING_LAZY')
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15)
    .map((e) => ({ path: e.path, bytes: e.bytes })),
  largestLegacyNonShipping: report
    .filter((e) => e.classification === 'LEGACY_NON_SHIPPING')
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15)
    .map((e) => ({ path: e.path, bytes: e.bytes })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ summary, assets: report }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`\nFull report: ${OUT}`);
