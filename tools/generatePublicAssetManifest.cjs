const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'reports', 'asset-audit.json');
const outputPath = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, 'dist', 'asset-manifest.json');

const IMAGE_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const DATA_EXTENSIONS = new Set(['.json']);
const SCRIPT_EXTENSIONS = new Set(['.js']);

function assetType(publicPath) {
  const ext = path.extname(publicPath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (SCRIPT_EXTENSIONS.has(ext)) return 'script';
  if (DATA_EXTENSIONS.has(ext)) return 'data';
  return null;
}

function encodePublicPath(publicPath) {
  return '/' + String(publicPath)
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

if (!fs.existsSync(auditPath)) {
  throw new Error('Missing reports/asset-audit.json. Run tools/assetAudit.mjs before generating the public asset manifest.');
}
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const shipping = new Set(['SHIPPING_HOT', 'SHIPPING_LAZY']);

const assets = audit.assets
  .filter((entry) => shipping.has(entry.classification))
  .map((entry) => ({
    path: encodePublicPath(entry.path),
    type: assetType(entry.path),
    bytes: entry.bytes,
  }))
  .filter((entry) => entry.type)
  .sort((a, b) => a.path.localeCompare(b.path));

const loadingAssets = {
  bgPortrait: '/assets/loading/loading-bg-portrait.webp',
  bgLandscape: '/assets/loading/loading-bg-landscape.webp',
  gameTitle: '/assets/loading/apex-chaos-title.webp',
  loadingBarFrame: '/assets/loading/loading-bar-frame.webp',
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    authority: 'reports/asset-audit.json shipping reachability',
    loadingAssets,
    assets,
  }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({
  output: outputPath,
  assets: assets.length,
  shippingBytes: assets.reduce((sum, entry) => sum + entry.bytes, 0),
}, null, 2));
