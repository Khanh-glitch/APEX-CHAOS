// Owner-requested packaging path: compile and package, without running tests.
// Requires installed dependencies in root, gold-mission-account and result-gold.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
// Vite/portable packaging replace these generated directories. Reject links
// before allowing a tool to recursively remove or overwrite their contents.
for (const rel of ['dist', 'dist-itch-html5', 'gold-mission-account/dist', 'public/result-gold']) {
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) throw Error('Build output escapes repository: ' + rel);
  if (fs.existsSync(full) && (fs.lstatSync(full).isSymbolicLink()
      || !fs.realpathSync(full).startsWith(fs.realpathSync(root) + path.sep))) {
    throw Error('Build output must be a real directory inside repository: ' + rel);
  }
}
function node(script, args = [], cwd = root) {
  execFileSync(process.execPath, [path.resolve(root, script), ...args], {cwd, stdio: 'inherit'});
}

const account = path.join(root, 'gold-mission-account');
const arena = path.join(account, 'src/assets/arena.jpg');
fs.writeFileSync(arena, Buffer.from(fs.readFileSync(arena + '.b64', 'utf8').trim(), 'base64'));
node('gold-mission-account/node_modules/vite/bin/vite.js', ['build'], account);
fs.mkdirSync(path.join(root, 'public/gold'), {recursive: true});
fs.copyFileSync(path.join(account, 'dist/index.html'), path.join(root, 'public/gold/mission-account.html'));
node('tools/buildResultGold.mjs');
node('tools/materializeArsenalFinalSfx.mjs');
// Asset classification is an input to shipping pruning, not a gameplay test.
node('tools/buildGoldBattleComponent.mjs');
node('tools/assetAudit.mjs');
node('node_modules/vite/bin/vite.js', ['build', '--base=./']);
node('tools/generatePublicAssetManifest.cjs', ['dist/asset-manifest.json']);
node('tools/pruneShippingDist.mjs');
node('tools/writeCP16BuildReceipt.mjs');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
fs.writeFileSync(path.join(root, 'dist/ITCH_GUEST_BUILD_SHA.txt'), sha + '\n');
node('tools/packItchPortable.mjs');
console.log('HTML5 shipping folder ready: dist-itch-html5 (archive its contents with index.html at ZIP root).');
