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

// Record what the package can actually rely on, so the ZIP never claims a
// self-contained runtime it does not contain.
let runtimeBundled = null;
function manifestIncludesRuntime(v) { runtimeBundled = v; }

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
  try {
    await download(url, nodeZip);
  } catch (e) {
    // A missing runtime must NOT destroy a package that is otherwise complete:
    // the launcher already knows how to fall back to a node on PATH, and a
    // package that says so still gets the owner a diagnosis.
    log(`WARNING: could not download Node (${e.message}).`);
    log('         The launcher will fall back to a Node already on PATH.');
    try { fs.rmSync(nodeZip, { force: true }); } catch (_) {}
  }
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
  manifestIncludesRuntime(true);
} else {
  // Fallback runtime source. nodejs.org is the canonical place for the official
  // Windows build, but it is not reachable from every build machine, and an
  // owner package whose launcher needs a Node they do not have is not a
  // one-double-click package. The PyPI wheel ships the SAME official node.exe
  // for win-x64, so try it before giving up.
  const ok = await fetchNodeFromPyPI(path.join(STAGE, 'runtime'));
  if (ok) {
    log('node.exe included (PyPI wheel fallback)');
  } else {
    log('WARNING: no Node runtime bundled; the package needs node on PATH');
    manifestIncludesRuntime(false);
  }
}


// The fallback: pip's nodejs-bin wheel contains the official win-x64 node.exe.
// Downloaded with pip so no extra tooling is assumed, then unpacked with the
// stdlib zip reader (the wheel is a plain ZIP).
async function fetchNodeFromPyPI(runtimeDir) {
  const tmp = path.join(OUT, 'nodewheel');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    sh('pip', ['download', 'nodejs-bin', '--platform', 'win_amd64',
               '--only-binary=:all:', '--no-deps', '-d', tmp], { stdio: 'pipe' });
  } catch (e) {
    log('pip fallback failed: ' + String(e.message).split('\n')[0]);
    return false;
  }
  const wheel = fs.readdirSync(tmp).find((f) => f.endsWith('.whl'));
  if (!wheel) return false;
  try {
    // -j: extract only the executable; the wheel's licenses/docs are not needed.
    sh('python3', ['-c', `
import zipfile,sys,os
src,dst=sys.argv[1],sys.argv[2]
with zipfile.ZipFile(src) as z:
    for n in z.namelist():
        if n.lower().endswith('node.exe'):
            os.makedirs(dst,exist_ok=True)
            with z.open(n) as f, open(os.path.join(dst,'node.exe'),'wb') as o:
                o.write(f.read())
            print('extracted',n)
`, path.join(tmp, wheel), runtimeDir], { stdio: 'inherit' });
  } catch (e) {
    log('wheel extract failed: ' + String(e.message).split('\n')[0]);
    return false;
  }
  const exe = path.join(runtimeDir, 'node.exe');
  return fs.existsSync(exe) && fs.statSync(exe).size > 10e6;
}


// -------------------------------------------------------------- 4. manifest --
const manifest = {
  schema: 'apex-p0-diagnosis-package/1',
  createdAt: new Date().toISOString(),
  baselineTag: TAG,
  gameBuild: receipt,
  runtimeBundled: runtimeBundled !== false,
  includes: ['game (frozen baseline build)', 'tools/p0diag', 'RUN-DIAGNOSIS.cmd',
             runtimeBundled ? 'node runtime (win-x64)' : 'node from PATH (runtime NOT bundled)'],
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
