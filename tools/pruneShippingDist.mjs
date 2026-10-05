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

// Fail-closed shipping surface: every INTERNAL src/href in a shipped HTML
// document must still exist in dist/ after pruning. The audit classification is
// a derived claim; the authored HTML is the contract. This guard turns
// "a referenced file was misclassified" from a silent black-screen regression
// (the R50K boot-door bug) into a build failure.
function shippedHtmlDocs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) shippedHtmlDocs(full, out);
    else if (/\.html$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const missingRefs = [];
for (const doc of shippedHtmlDocs(DIST)) {
  // Only real markup attributes are contracts. Inline <script>/<style> bodies
  // legitimately contain `src="..."` inside JS template literals (e.g. the
  // shell's `<img src="${h.portrait}">` builders), which are not references.
  const text = fs.readFileSync(doc, 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  for (const match of text.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    const target = clean.startsWith('/')
      ? path.join(DIST, clean.replace(/^\//, ''))
      : path.resolve(path.dirname(doc), clean);
    if (!target.startsWith(DIST)) continue;
    if (!fs.existsSync(target)) {
      missingRefs.push(`${path.relative(DIST, doc).split(path.sep).join('/')} -> ${raw}`);
    }
  }
}
if (missingRefs.length) {
  throw new Error(
    `dist pruning removed files referenced by shipped HTML:\n  ${missingRefs.join('\n  ')}`
  );
}

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
