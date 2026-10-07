import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = pkg.scripts || {};
const ROOTS = [
  'test:product-graph',
  'test:source-hygiene',
  'test:runtime-revision',
  'test:r50-pre-transition',
  'test:core-six-art',
  'test:core-six-art-delivery',
  'test:core-six-hero-av',
  'test:product-music',
  'test:battle-transition',
  'test:ui-sfx',
  'test:home-story-alignment',
  'test:gold-favicon',
  'test:hero-rework:headless',
];

const leaves = [];
function expand(name, stack = []) {
  if (stack.includes(name)) throw new Error('owner candidate script cycle: ' + [...stack, name].join(' -> '));
  const command = scripts[name];
  if (!command) throw new Error('owner candidate script missing: ' + name);
  for (const raw of command.split(/\s*&&\s*/)) {
    const segment = raw.trim();
    if (!segment) continue;
    const nested = segment.match(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*pnpm\s+([A-Za-z0-9:_-]+)$/);
    if (nested && scripts[nested[1]]) {
      expand(nested[1], [...stack, name]);
      continue;
    }
    if (/[;|]|\|\||\n/.test(segment)) {
      throw new Error('owner candidate leaf uses unsupported shell control syntax: ' + segment);
    }
    leaves.push({ origin: [...stack, name].join(' > '), command: segment });
  }
}

for (const root of ROOTS) expand(root);

const failures = [];
console.log('[OWNER CANDIDATE] running ' + leaves.length + ' leaf gates without fail-fast');
for (let i = 0; i < leaves.length; i += 1) {
  const leaf = leaves[i];
  console.log('\n[OWNER CANDIDATE ' + (i + 1) + '/' + leaves.length + '] ' + leaf.origin);
  console.log('$ ' + leaf.command);
  const result = spawnSync(leaf.command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: 'inherit',
  });
  const code = Number.isInteger(result.status) ? result.status : 1;
  if (code !== 0) {
    failures.push({ ...leaf, code, signal: result.signal || null, error: result.error ? String(result.error.message || result.error) : null });
  }
}

if (failures.length) {
  console.error('\n[OWNER CANDIDATE] FAIL — ' + failures.length + '/' + leaves.length + ' leaf gates failed');
  for (const failure of failures) {
    console.error(' - [' + failure.code + '] ' + failure.origin + ' :: ' + failure.command
      + (failure.signal ? ' signal=' + failure.signal : '')
      + (failure.error ? ' error=' + failure.error : ''));
  }
  process.exit(1);
}

console.log('\n[OWNER CANDIDATE] PASS — all ' + leaves.length + ' leaf gates passed');
