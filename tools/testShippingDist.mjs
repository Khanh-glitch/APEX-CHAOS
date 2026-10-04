import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO, 'dist');
const AUDIT = path.join(REPO, 'reports', 'asset-audit.json');
const MANIFEST = path.join(DIST, 'asset-manifest.json');

if (!fs.existsSync(DIST)) throw new Error('dist/ missing');
if (!fs.existsSync(AUDIT)) throw new Error('asset audit missing');
if (!fs.existsSync(MANIFEST)) throw new Error('dist/asset-manifest.json missing');

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const shipping = new Set(['SHIPPING_HOT', 'SHIPPING_LAZY']);
const nonShipping = new Set(['LEGACY_NON_SHIPPING', 'SOURCE_MASTER_PROVENANCE_ONLY']);

const missingShipping = [];
const leakedNonShipping = [];
for (const entry of audit.assets) {
  const target = path.join(DIST, String(entry.path).replace(/^\/+/, ''));
  if (shipping.has(entry.classification) && !fs.existsSync(target)) missingShipping.push(entry.path);
  if (nonShipping.has(entry.classification) && fs.existsSync(target)) leakedNonShipping.push(entry.path);
}

if (missingShipping.length) {
  throw new Error(`Shipping files missing from dist: ${missingShipping.slice(0, 20).join(', ')}`);
}
if (leakedNonShipping.length) {
  throw new Error(`Non-shipping files leaked into dist: ${leakedNonShipping.slice(0, 20).join(', ')}`);
}

const manifestPaths = new Set((manifest.assets || []).map((entry) => decodeURI(String(entry.path))));
for (const entry of audit.assets) {
  if (!shipping.has(entry.classification)) continue;
  const ext = path.extname(entry.path).toLowerCase();
  if (!['.png','.webp','.jpg','.jpeg','.gif','.svg','.avif','.mp3','.wav','.ogg','.m4a','.aac','.flac','.mp4','.webm','.mov','.json','.js'].includes(ext)) continue;
  if (!manifestPaths.has(entry.path)) {
    throw new Error(`Shipping manifest omitted ${entry.path}`);
  }
}

const allowedLegacyDonors = new Set([
  '/assets/fang_v1/speckBlood.webp', // current Arsenal feel layer uses this blood-speck donor directly
]);
const forbiddenPrefixes = [
  '/assets/katana_v1/',
  '/assets/fang_v1/',
  '/assets/engineer_v1/',
  '/assets/soccer_v1/',
  '/assets/string_v1/',
  '/assets/galaxy_v1/',
];
const forbiddenManifest = [...manifestPaths].filter((p) =>
  forbiddenPrefixes.some((prefix) => p.startsWith(prefix))
  && !allowedLegacyDonors.has(p));
if (forbiddenManifest.length) {
  throw new Error(`Legacy asset paths remain in shipping manifest: ${forbiddenManifest.slice(0, 20).join(', ')}`);
}

console.log(JSON.stringify({
  shippingFiles: audit.assets.filter((entry) => shipping.has(entry.classification)).length,
  manifestAssets: manifest.assets?.length || 0,
  nonShippingLeaks: leakedNonShipping.length,
  forbiddenManifestEntries: forbiddenManifest.length,
}, null, 2));
