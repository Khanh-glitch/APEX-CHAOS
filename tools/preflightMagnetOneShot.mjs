#!/usr/bin/env node
/**
 * MAGNET V1 preload preflight.
 * Read-only by default.
 * --anchor safely moves ONLY the current Arena session branch to the fetched preload tip.
 * --push-anchor then pushes/verifies ONLY that Arena branch.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BASELINE = '5411906a741f87d637ee20535c82e96b866d4ab2';
const PRELOAD = 'magnet-v1-preload-20261001';
const GOLD = 'docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html';
const GOLD_SHA = '468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b';
const GOLD_BYTES = 3095049;

const args = new Set(process.argv.slice(2));
const run = (cmd,a=[],opts={}) => execFileSync(cmd,a,{encoding:opts.encoding===null?null:'utf8',stdio:opts.stdio||['ignore','pipe','pipe']});
const textRun = (cmd,a=[]) => String(run(cmd,a)).trim();
const fail = (m) => { console.error('[MAGNET PREFLIGHT] FAIL:',m); process.exit(1); };
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const isAncestor = (a,b) => { try { run('git',['merge-base','--is-ancestor',a,b]); return true; } catch { return false; } };

const branch=textRun('git',['branch','--show-current']);
if(!branch.startsWith('arena/')) fail('Current branch must be Arena-assigned arena/*, got '+branch);
if(textRun('git',['status','--porcelain'])) fail('Working tree dirty; preserve legitimate work before anchoring.');

run('git',['fetch','origin',
  'refs/heads/'+PRELOAD+':refs/remotes/origin/'+PRELOAD,
  'refs/heads/main:refs/remotes/origin/main'
],{stdio:['ignore','inherit','inherit']});

let auth='';
try { auth=textRun('git',['ls-remote','origin','refs/heads/'+PRELOAD]).split(/\s+/)[0]||''; }
catch { fail('Remote authentication/read heartbeat failed.'); }
if(!auth) fail('Remote preload ref not readable.');

const preloadRef='refs/remotes/origin/'+PRELOAD;
const preloadTip=textRun('git',['rev-parse',preloadRef]);
const mainTip=textRun('git',['rev-parse','refs/remotes/origin/main']);
const currentHead=textRun('git',['rev-parse','HEAD']);

if(!isAncestor(BASELINE,preloadTip)) fail('Required baseline is not ancestor of preload.');

const changed=textRun('git',['diff','--name-only',BASELINE+'..'+preloadTip]).split(/\r?\n/).filter(Boolean);
const illegal=changed.filter(p=>!p.startsWith('docs/hero-rework/magnet-v1/') && p!=='tools/preflightMagnetOneShot.mjs');
if(illegal.length) fail('Preload contains production/unexpected files: '+illegal.join(', '));

let gold;
try { gold=run('git',['show',preloadRef+':'+GOLD],{encoding:null}); }
catch { fail('Cannot read canonical Gold from fetched preload.'); }
if(gold.length!==GOLD_BYTES) fail('Gold byte mismatch: '+gold.length);
const gh=sha256(gold);
if(gh!==GOLD_SHA) fail('Gold SHA mismatch: '+gh);

console.log('[MAGNET PREFLIGHT] baseline:',BASELINE);
console.log('[MAGNET PREFLIGHT] current HEAD:',currentHead);
console.log('[MAGNET PREFLIGHT] origin/main:',mainTip);
console.log('[MAGNET PREFLIGHT] preload tip:',preloadTip);
console.log('[MAGNET PREFLIGHT] preload files:',changed.length);
console.log('[MAGNET PREFLIGHT] Gold OK:',gold.length,gh);

if(args.has('--anchor')){
  const represented=isAncestor(currentHead,preloadTip);
  const disposableMainline=isAncestor(currentHead,mainTip);
  if(!represented && !disposableMainline){
    fail('Refusing destructive anchor: current HEAD has committed history not represented by preload/main.');
  }
  run('git',['reset','--hard',preloadTip],{stdio:['ignore','inherit','inherit']});
  console.log('[MAGNET PREFLIGHT] anchored session branch:',branch);
}
if(args.has('--push-anchor')){
  if(!args.has('--anchor')) fail('--push-anchor requires --anchor');
  run('git',['push','origin','HEAD:refs/heads/'+branch],{stdio:['ignore','inherit','inherit']});
  const remote=textRun('git',['ls-remote','origin','refs/heads/'+branch]).split(/\s+/)[0];
  const local=textRun('git',['rev-parse','HEAD']);
  if(remote!==local) fail('Remote anchor verification mismatch.');
  console.log('[MAGNET PREFLIGHT] remote anchor verified:',remote);
}
console.log('[MAGNET PREFLIGHT] PASS');
