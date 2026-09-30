#!/usr/bin/env node
/**
 * FROST V1 one-shot preflight.
 * Read-only by default. With --anchor it moves ONLY the current local Arena
 * branch to the fetched preload tip if the tree is clean. With --push-anchor
 * it also pushes ONLY the current Arena branch.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASELINE = '6b83fc6502eb8e23e4bd122074fc7fdfb47441ae';
const PRELOAD = 'director/frost-v1-preload-20260930';
const GOLD = 'docs/hero-rework/frost-v1/gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html';
const GOLD_SHA = '940fc9a8a181cc40d965ebf2c4309d1b4816d3016fc191b0d3df8a1a65be2475';

const args = new Set(process.argv.slice(2));
const run = (cmd, a = [], opts = {}) =>
  execFileSync(cmd, a, { encoding: opts.encoding === null ? null : 'utf8', stdio: opts.stdio || ['ignore','pipe','pipe'] });

function textRun(cmd,a=[]) { return String(run(cmd,a)).trim(); }
function fail(msg) { console.error('[FROST PREFLIGHT] FAIL:', msg); process.exit(1); }
function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

const branch = textRun('git',['branch','--show-current']);
if (!branch.startsWith('arena/')) fail('Current branch must be Arena-assigned arena/*, got '+branch);

const dirty = textRun('git',['status','--porcelain']);
if (dirty) fail('Working tree is dirty; preserve work before anchoring.');

run('git',['fetch','origin',
  'refs/heads/'+PRELOAD+':refs/remotes/origin/'+PRELOAD,
  'refs/heads/main:refs/remotes/origin/main'
], {stdio:['ignore','inherit','inherit']});

// Explicit auth heartbeat before any destructive anchor.
let authHead='';
try {
  authHead=textRun('git',['ls-remote','origin','refs/heads/'+PRELOAD]).split(/\s+/)[0] || '';
} catch {
  fail('Remote Git authentication/read check failed before anchor. Do not continue locally.');
}
if(!authHead) fail('Remote preload ref is not readable; do not continue locally.');

const preloadRef='refs/remotes/origin/'+PRELOAD;
const preloadTip=textRun('git',['rev-parse',preloadRef]);
const mainTip=textRun('git',['rev-parse','refs/remotes/origin/main']);
const currentHead=textRun('git',['rev-parse','HEAD']);
try { run('git',['merge-base','--is-ancestor',BASELINE,preloadTip]); }
catch { fail('Required baseline is not an ancestor of preload tip.'); }

const changed=textRun('git',['diff','--name-only',BASELINE+'..'+preloadTip])
  .split(/\r?\n/).filter(Boolean);
const PRELOAD_SUPPORT_TOOLS = new Set([
  'tools/preflightFrostOneShot.mjs',
  'tools/frostGitDurabilityCheckpoint.mjs',
]);
const illegal=changed.filter(p=>!p.startsWith('docs/hero-rework/frost-v1/')&&!PRELOAD_SUPPORT_TOOLS.has(p));
if(illegal.length) fail('Preload modifies production/unexpected files: '+illegal.join(', '));

// Verify the canonical Gold directly from the fetched preload ref BEFORE any reset.
let goldFromRef;
try {
  goldFromRef=run('git',['show',preloadRef+':'+GOLD],{encoding:null});
} catch {
  fail('Cannot read Gold from fetched preload ref.');
}
const refSha=sha256(goldFromRef);
if(refSha!==GOLD_SHA) fail('Gold SHA mismatch in fetched preload ref: '+refSha);

console.log('[FROST PREFLIGHT] baseline:',BASELINE);
console.log('[FROST PREFLIGHT] current HEAD:',currentHead);
console.log('[FROST PREFLIGHT] origin/main:',mainTip);
console.log('[FROST PREFLIGHT] preload tip:',preloadTip);
console.log('[FROST PREFLIGHT] preload files:',changed.length);
console.log('[FROST PREFLIGHT] Gold SHA OK in fetched ref:',refSha);

if(args.has('--anchor')){
  const isAncestorOf=(a,b)=>{try{run('git',['merge-base','--is-ancestor',a,b]);return true;}catch{return false;}};
  const representedByPreload=isAncestorOf(currentHead,preloadTip);
  const disposableMainline=isAncestorOf(currentHead,mainTip);
  if(!representedByPreload && !disposableMainline){
    fail('Refusing destructive anchor: current HEAD has committed history not represented by preload/main. Preserve and reconcile it first.');
  }
  run('git',['reset','--hard',preloadTip],{stdio:['ignore','inherit','inherit']});
  console.log('[FROST PREFLIGHT] anchored current session branch:',branch,
    representedByPreload?'(HEAD already represented by preload)':'(clean disposable mainline ancestor)');
  const localSha=sha256(readFileSync(GOLD));
  if(localSha!==GOLD_SHA) fail('Anchored working-tree Gold SHA mismatch: '+localSha);
  console.log('[FROST PREFLIGHT] anchored Gold SHA OK:',localSha);
}

if(args.has('--push-anchor')){
  if(!args.has('--anchor')) fail('--push-anchor requires --anchor');
  run('git',['push','origin','HEAD:refs/heads/'+branch],{stdio:['ignore','inherit','inherit']});
  const remote=textRun('git',['ls-remote','origin','refs/heads/'+branch]).split(/\s+/)[0];
  const local=textRun('git',['rev-parse','HEAD']);
  if(remote!==local) fail('Remote verification mismatch.');
  console.log('[FROST PREFLIGHT] remote anchor verified:',remote);
}

console.log('[FROST PREFLIGHT] PASS');
