// Gold shell loader seam gate (R45 owner-playtest correction).
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const loader = fs.readFileSync('src/game/runtimeLoader.js', 'utf8');
const failures = [];
const notes = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
}

const mountStart = app.indexOf('// ── Gold product shell');
const mountEnd = app.indexOf('useEffect(() => {\n    const launchAdminLab', mountStart);
const mount = mountStart >= 0 && mountEnd > mountStart ? app.slice(mountStart, mountEnd) : '';
check('Gold mount block exists', mount.length > 0);
check('executable DOMParser scripts are snapshotted',
  /const executableScripts = \[\.\.\.doc\.querySelectorAll\('script'\)\]/.test(mount) && /const scriptPlan = executableScripts\.map/.test(mount));
check('executable inert scripts are removed before DOM import',
  mount.indexOf('executableScripts.forEach((node) => node.remove())') >= 0 &&
  mount.indexOf('executableScripts.forEach((node) => node.remove())') < mount.indexOf('document.importNode(node, true)'));
check('text/plain battle payload is preserved by executable-only filter',
  /return !type \|\| type === 'text\/javascript' \|\| type === 'application\/javascript' \|\| type === 'module';/.test(mount));
check('external scripts preserve authored raw src',
  /src: node\.getAttribute\('src'\) \|\| ''/.test(mount) && /run\.src = planned\.src;/.test(mount) && !/run\.src\s*=\s*src\.src/.test(mount));
check('Gold-loaded scripts publish shared apexLoaded completion flag',
  /run\.dataset\.apexLoaded = 'true';/.test(mount) && /existing\.dataset\.apexLoaded = 'true';/.test(mount));
check('Gold mount normalizes script identity before dedupe',
  /const findExistingGoldScript = \(src\) =>/.test(mount) && /new URL\(raw, baseUrl\)\.href/.test(mount));
check('runtime loader uses normalized identity for both load and loaded probes',
  (loader.match(/const existing = runtimeScriptFor\(src\);/g) || []).length === 2);
check('runtime loader no longer uses brittle exact script[src] equality',
  !/document\.querySelector\(`script\[src="\$\{src\}"\]`\)/.test(loader));

const lines = ['GOLD SHELL LOADER SEAM GATE (R45 owner law)', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
