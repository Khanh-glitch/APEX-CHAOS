// buildPackage.mjs — produce the owner's local diagnosis package.
//
//   node tools/p0diag/buildPackage.mjs
//
// It builds the FROZEN baseline (tag p0-baseline-44ba89c) into a throwaway
// worktree so the working tree is never touched, copies the itchio-packaged
// static build plus the tool, fetches the Windows Node runtime, and writes one
// ZIP the owner can extract anywhere.
//
// The package contains no installer and touches nothing outside its own folder.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TAG = process.env.P0_TAG || 'p0-baseline-44ba89c';
const OUT = path.join(HERE, 'dist');
const STAGE = path.join(OUT, 'APEX-CHAOS-P0-Diagnosis');
const WORK = path.join(OUT, '.worktree');
const NODE_VER = process.env.P0_NODE_VER || 'v22.14.0';

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: REPO, stdio: 'inherit', ...opts });
}
function log(m) { console.log('[pkg] ' + m); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- 1. build --
log(`building frozen baseline ${TAG} in a throwaway worktree`);
sh('git', ['worktree', 'add', '--force', WORK, TAG]);
try {
  sh(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'pnpm@9.15.9', 'install', '--frozen-lockfile'], { cwd: WORK });
  sh(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'pnpm@9.15.9', 'build'], { cwd: WORK });
  // The itch packer wants the receipt first; write it from the tag's own commit.
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORK, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(WORK, 'dist', 'ITCH_GUEST_BUILD_SHA.txt'), sha);
  sh('node', ['tools/packItchPortable.mjs'], { cwd: WORK });
  log(`baseline build sha ${sha}`);
  var buildSha = sha;
} finally {
  // Leave the worktree in place if the build failed, so the error is inspectable.
}

// ------------------------------------------------------------------- 2. stage
log('staging package');
fs.mkdirSync(STAGE, { recursive: true });
fs.cpSync(path.join(WORK, 'dist-itch-html5'), path.join(STAGE, 'game'), { recursive: true });
fs.mkdirSync(path.join(STAGE, 'tools', 'p0diag'), { recursive: true });
for (const f of ['p0diag.js', 'p0serve.mjs', 'p0run.mjs']) {
  fs.copyFileSync(path.join(HERE, f), path.join(STAGE, 'tools', 'p0diag', f));
}
fs.copyFileSync(path.join(HERE, 'launcher', 'RUN-DIAGNOSIS.cmd'), path.join(STAGE, 'RUN-DIAGNOSIS.cmd'));
fs.copyFileSync(path.join(HERE, 'PACKAGE-README.txt'), path.join(STAGE, 'README.txt'));
fs.mkdirSync(path.join(STAGE, 'tools', 'p0diag', 'results'), { recursive: true });

// The game build must be the frozen baseline, and it must actually be the code
// under test. Refuse to package a tree whose receipt disagrees.
const receipt = fs.readFileSync(path.join(STAGE, 'game', 'ITCH_GUEST_BUILD_SHA.txt'), 'utf8').trim();
if (receipt !== buildSha) throw new Error(`receipt/build mismatch: ${receipt} != ${buildSha}`);
log(`package game build = ${receipt}`);

// ------------------------------------------------------------------ 3. node --
// Node is required to run the local server. Vendoring it removes the only
// install step the owner would otherwise face.
const nodeZip = path.join(OUT, `node-${NODE_VER}-win-x64.zip`);
if (!fs.existsSync(nodeZip)) {
  const url = `https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-win-x64.zip`;
  log(`downloading ${url}`);
  await download(url, nodeZip);
}
if (fs.existsSync(nodeZip) && fs.statSync(nodeZip).size > 10e6) {
  log('extracting node runtime');
  const tar = path.join(OUT, 'node-extract');
  fs.mkdirSync(tar, { recursive: true });
  sh('unzip', ['-q', nodeZip, '-d', tar]);
  const inner = fs.readdirSync(tar).find((d) => d.startsWith('node-'));
  fs.mkdirSync(path.join(STAGE, 'runtime'), { recursive: true });
  fs.copyFileSync(path.join(tar, inner, 'node.exe'), path.join(STAGE, 'runtime', 'node.exe'));
  log('node.exe included');
} else {
  log('WARNING: no Node runtime bundled; the package needs node on PATH');
}

// -------------------------------------------------------------- 4. manifest --
const manifest = {
  schema: 'apex-p0-diagnosis-package/1',
  createdAt: new Date().toISOString(),
  baselineTag: TAG,
  gameBuild: receipt,
  includes: ['game (frozen baseline build)', 'tools/p0diag', 'RUN-DIAGNOSIS.cmd', 'node runtime'],
  entry: 'RUN-DIAGNOSIS.cmd',
  noGitHubActions: true,
  notes: 'Runs entirely offline on the owner machine. Writes only inside this folder.',
};
fs.writeFileSync(path.join(STAGE, 'PACKAGE.json'), JSON.stringify(manifest, null, 2));

// ------------------------------------------------------------------ 5. zip --
const zipPath = path.join(OUT, `APEX-CHAOS-P0-Diagnosis-${receipt.slice(0, 7)}.zip`);
log('writing ' + zipPath);
sh('zip', ['-q', '-r', zipPath, path.basename(STAGE)], { cwd: OUT });
const size = fs.statSync(zipPath).size;
log(`done: ${zipPath} (${(size / 1e6).toFixed(1)} MB)`);
console.log(JSON.stringify({ zip: zipPath, bytes: size, gameBuild: receipt }, null, 2));

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { fs.rmSync(dest, { force: true }); reject(e); });
  });
}
