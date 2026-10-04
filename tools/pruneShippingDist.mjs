import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO, 'dist');
const AUDIT = path.join(REPO, 'reports', 'asset-audit.json');

if (!fs.existsSync(DIST)) throw new Error('dist/ does not exist; run vite build first.');
if (!fs.existsSync(AUDIT)) throw new Error('reports/asset-audit.json is missing; run asset audit first.');

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const nonShipping = new Set(['LEGACY_NON_SHIPPING', 'SOURCE_MASTER_PROVENANCE_ONLY']);
let removedFiles = 0;
let removedBytes = 0;

for (const entry of audit.assets) {
  if (!nonShipping.has(entry.classification)) continue;
  const rel = String(entry.path).replace(/^\/+/, '');
  const target = path.join(DIST, rel);
  if (!fs.existsSync(target)) continue;
  const stat = fs.statSync(target);
  if (!stat.isFile()) continue;
  removedFiles += 1;
  removedBytes += stat.size;
  fs.rmSync(target, { force: true });
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== DIST && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}
removeEmptyDirs(DIST);

const forbidden = [
  'game/fighters/katanaRuntime.js',
  'game/fighters/fangRuntime.js',
  'game/fighters/shotgunRuntime.js',
  'game/fighters/engineerRuntime.js',
  'game/fighters/soccerChampionRuntime.js',
  'game/fighters/stringRuntime.js',
  'game/fighters/galaxyRuntime.js',
  'game/fighters/soccerRuntime.js',
  'game/core/apexMajorMechanicVisuals.js',
];
const survivors = forbidden.filter((rel) => fs.existsSync(path.join(DIST, rel)));
if (survivors.length) {
  throw new Error(`Legacy runtime files survived dist pruning: ${survivors.join(', ')}`);
}

console.log(JSON.stringify({
  removedFiles,
  removedBytes,
  forbiddenRuntimeSurvivors: survivors,
}, null, 2));
