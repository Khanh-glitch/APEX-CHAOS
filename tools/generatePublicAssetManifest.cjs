const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const outputPath = path.join(publicDir, 'asset-manifest.json');

const IMAGE_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const DATA_EXTENSIONS = new Set(['.json']);
const SCRIPT_EXTENSIONS = new Set(['.js']);

function toPublicPath(absPath) {
  return `/${path.relative(publicDir, absPath)
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function assetType(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (SCRIPT_EXTENSIONS.has(ext)) return 'script';
  if (DATA_EXTENSIONS.has(ext)) return 'data';
  return null;
}

function shouldPreloadPublicAsset(publicPath) {
  const normalized = publicPath.replace(/\\/g, '/');
  const soccerMove = normalized.match(/^\/assets\/soccer_v1\/move\/frame_(\d{3})\.webp$/i);
  if (soccerMove) return soccerMove[1] === '065' || soccerMove[1] === '066';
  return true;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

const files = [
  ...walk(path.join(publicDir, 'assets')),
  path.join(publicDir, 'apexEngine.js'),
  path.join(publicDir, 'game/core/apexMajorMechanicVisuals.js'),
  path.join(publicDir, 'game/fighters/shotgunRuntime.js'),
  path.join(publicDir, 'game/fighters/engineerRuntime.js'),
  path.join(publicDir, 'game/guards/apexEngineerMergeBridge.js'),
  path.join(publicDir, 'game/fighters/soccerChampionRuntime.js'),
  path.join(publicDir, 'game/core/apexPrecisionFixes.js'),
  path.join(publicDir, 'game/core/apexFullRosterQa.js'),
  path.join(publicDir, 'game/guards/apexFreezeDisappearHotfix.js'),
  path.join(publicDir, 'game/guards/apexRuntimeStability.js'),
  path.join(publicDir, 'game/guards/apexSlimeBodyCap.js'),
  path.join(publicDir, 'game/core/apexCanonicalBalance.js'),
  path.join(publicDir, 'game/core/apexRosterExtensions.js'),
  path.join(publicDir, 'game/core/apexFightTelemetry.js'),
  path.join(publicDir, 'game/fighters/musicianVisualRuntime.js'),
  path.join(publicDir, 'game/fighters/arcadeVisualRuntime.js'),
  path.join(publicDir, 'game/fighters/puppetVisualRuntime.js'),
  path.join(publicDir, 'game/fighters/bladeVisualRuntime.js'),
  path.join(publicDir, 'game/fighters/ninjaVisualRuntime.js'),
  path.join(publicDir, 'game/core/apexTextHygiene.js'),
  path.join(publicDir, 'game/fighters/iceVisualRuntime.js'),
  path.join(publicDir, 'game/fighters/stringRuntime.js'),
  path.join(publicDir, 'game/fighters/galaxyRuntime.js'),
  path.join(publicDir, 'game/fighters/stringHardeningRuntime.js'),
  path.join(publicDir, 'game/fighters/galaxyRefinementRuntime.js'),
  path.join(publicDir, 'game/core/apexUtilityFeatures.js'),
  path.join(publicDir, 'game/fighters/soccerRuntime.js'),
  path.join(publicDir, 'game/guards/apexGalaxyGuards.js'),
  path.join(publicDir, 'game/guards/apexEngineerGuards.js'),
  path.join(publicDir, 'game/guards/apexFinalMatchGuard.js'),
  path.join(publicDir, 'game/guards/apexBattleVisibilityGuard.js'),
  path.join(publicDir, 'game/guards/apexShotgunLateBinder.js'),
  path.join(publicDir, 'game/fighters/katanaRuntime.js'),
  path.join(publicDir, 'game/fighters/fangRuntime.js'),
  path.join(publicDir, 'game/ui/apexCharacterSelectUi.js'),
  path.join(publicDir, 'game/ui/apexPickRuntime.js'),
  path.join(publicDir, 'game/core/apexPoseLockRuntime.js'),
  path.join(publicDir, 'sniper_cloak_move_sprite.webp'),
  path.join(publicDir, 'sniper_cloak_sprite.webp'),
].filter((filePath) => {
  if (!fs.existsSync(filePath)) return false;
  const publicPath = toPublicPath(filePath);
  if (publicPath === '/asset-manifest.json') return false;
  if (/apexEngine\.before_/i.test(publicPath)) return false;
  if (!shouldPreloadPublicAsset(publicPath)) return false;
  return assetType(filePath);
});

const seen = new Set();
const assets = files
  .map((filePath) => ({
    path: toPublicPath(filePath),
    type: assetType(filePath),
    bytes: fs.statSync(filePath).size,
  }))
  .filter((asset) => {
    if (seen.has(asset.path)) return false;
    seen.add(asset.path);
    return true;
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const loadingAssets = {
  bgPortrait: '/assets/loading/loading-bg-portrait.webp',
  bgLandscape: '/assets/loading/loading-bg-landscape.webp',
  gameTitle: '/assets/loading/apex-chaos-title.webp',
  loadingBarFrame: '/assets/loading/loading-bar-frame.webp',
};

fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), loadingAssets, assets }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({ output: outputPath, assets: assets.length }, null, 2));
