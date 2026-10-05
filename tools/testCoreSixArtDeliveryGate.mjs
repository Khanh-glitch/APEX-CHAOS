import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(os.tmpdir(), 'apex-core-six-asset-audit-' + process.pid + '.json');
const pass = [];
const fail = [];
const check = (name, ok, detail = '') => (ok ? pass : fail).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));

try {
  execFileSync(process.execPath, ['tools/assetAudit.mjs', '--out', tmp], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const audit = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const core = audit.assets.filter((entry) => entry.path.startsWith('/assets/gold-ui/heroes/'));

  check('Core Six UI art inventory has exactly 35 authored WebPs', core.length === 35, 'count=' + core.length);
  check('every Core Six UI art file is classified shipping',
    core.every((entry) => entry.classification === 'SHIPPING_LAZY' || entry.classification === 'SHIPPING_HOT'),
    core.filter((entry) => !['SHIPPING_LAZY','SHIPPING_HOT'].includes(entry.classification))
      .map((entry) => entry.path + ':' + entry.classification).join(', '));

  for (const entry of core) {
    const file = path.join(ROOT, 'public', entry.path.replace(/^\/+/, ''));
    check('file exists ' + entry.path, fs.existsSync(file));
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    const riff = buf.subarray(0, 4).toString('ascii') === 'RIFF';
    const webp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
    check('valid WebP container ' + entry.path, riff && webp,
      'magic=' + buf.subarray(0, 12).toString('hex'));
    check('asset audit found a production shipping reference ' + entry.path,
      Array.isArray(entry.shipRefs) && entry.shipRefs.length > 0);
  }

  const bridge = fs.readFileSync(path.join(ROOT, 'public/game/gold/goldProductBridge.js'), 'utf8');
  check('hero UI URLs inherit cache key from the executing Gold bridge runtime',
    bridge.includes('const HERO_UI_ART_REVISION = (() =>')
    && bridge.includes("searchParams.get('v')")
    && bridge.includes("url + '?v=' + encodeURIComponent(HERO_UI_ART_REVISION)"));
  check('all authored hero art refs route through the cache-keyed helper',
    (bridge.match(/heroUiAsset\('[^']+\.webp'\)/g) || []).length === 35,
    'count=' + ((bridge.match(/heroUiAsset\('[^']+\.webp'\)/g) || []).length));

  const runtimeManifest = fs.readFileSync(path.join(ROOT, 'src/game/runtimeManifest.js'), 'utf8');
  check('Gold bridge remains a production runtime',
    runtimeManifest.includes("'/game/gold/goldProductBridge.js?v=' + APEX_ARSENAL_RUNTIME_REVISION"));
} catch (error) {
  fail.push('FAIL gate execution :: ' + (error && error.message ? error.message : String(error)));
} finally {
  try { fs.rmSync(tmp, { force: true }); } catch {}
}

const out = ['CORE SIX ART DELIVERY GATE (R47)', ...pass];
if (fail.length) {
  out.push('', ...fail, '', 'RESULT: FAIL (' + fail.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + pass.length + ' checks)');
console.log(out.join('\n'));
