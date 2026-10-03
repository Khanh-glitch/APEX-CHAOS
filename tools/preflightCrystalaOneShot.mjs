#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SOURCE_BRANCH = 'arena/01a0ead6-apex-chaos';
const SOURCE_REF = 'refs/remotes/origin/' + SOURCE_BRANCH;
const BASELINE = '00d83e76d248c49ca65d8e546c67819d07a0d758';
const GOLD = 'docs/hero-rework/crystala-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html';
const MANIFEST = 'docs/hero-rework/crystala-v1/05_PRELOAD_MANIFEST.json';
const RUNTIME_MANIFEST = 'src/game/runtimeManifest.js';
const EXPECTED_PREP_REVISION = '20260930-crystala-prep-r1';
const KNOWN_BASELINE_RUN = '36614313983';

const args = new Set(process.argv.slice(2));
const wantAnchor = args.has('--anchor');
const wantPush = args.has('--push-anchor');

function sh(cmd, a = [], opts = {}) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', stdio: opts.stdio || 'pipe' });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || '').trim();
    throw new Error(`${cmd} ${a.join(' ')} failed (${r.status}): ${msg}`);
  }
  return (r.stdout || '').trim();
}
function git(...a) { return sh('git', a); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

const branch = git('branch','--show-current');
const initialHead = git('rev-parse','HEAD');
const dirty = git('status','--porcelain');
check(branch, 'Detached HEAD is not allowed for CRYSTALA one-shot implementation.');

console.log('[CRYSTALA PREFLIGHT] branch=' + branch);
console.log('[CRYSTALA PREFLIGHT] initialHead=' + initialHead);
console.log('[CRYSTALA PREFLIGHT] tree=' + (dirty ? 'DIRTY' : 'clean'));

git('fetch','origin',SOURCE_BRANCH + ':' + SOURCE_REF);
const sourceHead = git('rev-parse',SOURCE_REF);
const ancestry = spawnSync('git',['merge-base','--is-ancestor',BASELINE,SOURCE_REF]);
check(ancestry.status === 0, 'Mandatory Hunter-ownerfix baseline is NOT in canonical-source ancestry.');

console.log('[CRYSTALA PREFLIGHT] canonicalSource=' + sourceHead);
console.log('[CRYSTALA PREFLIGHT] baselineAncestor=PASS ' + BASELINE);

if (wantAnchor && initialHead !== sourceHead) {
  check(!dirty, '--anchor refused: working tree is dirty. Preserve legitimate work in a commit first.');
  git('reset','--hard',SOURCE_REF);
  console.log('[CRYSTALA PREFLIGHT] anchored current session branch to canonical source tip');
}

const head = git('rev-parse','HEAD');
const headAncestry = spawnSync('git',['merge-base','--is-ancestor',BASELINE,'HEAD']);
check(headAncestry.status === 0, 'Current HEAD does not contain mandatory gameplay baseline.');

check(fs.existsSync(MANIFEST), 'Missing CRYSTALA preload manifest after anchoring.');
check(fs.existsSync(GOLD), 'Missing owner-approved Gold reference after anchoring.');
const manifest = JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
check(manifest?.implementation_baseline?.commit === BASELINE, 'Manifest implementation baseline mismatch.');
const expectedGold = manifest?.gold?.sha256;
check(expectedGold && sha256File(GOLD) === expectedGold, 'Gold SHA-256 mismatch.');

const rm = fs.readFileSync(RUNTIME_MANIFEST,'utf8');
const m = rm.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
check(m, 'Runtime revision constant not found.');
console.log('[CRYSTALA PREFLIGHT] runtimeRevision=' + m[1]);
if (head === sourceHead) check(m[1] === EXPECTED_PREP_REVISION, 'Canonical prep runtime revision mismatch.');

const meta = fs.readFileSync('public/game/arsenal/arsenalMetaRuntime.js','utf8');
// Pre-pilot product law supersedes the old owner-test balance migration.
check(!/OWNER_TEST_CREDITS\s*=\s*12000/.test(meta), 'Removed 12,000 AC owner-test grant unexpectedly remains.');
check(!/OWNER_TEST_GRANT_KEY/.test(meta), 'Removed owner-test grant marker unexpectedly remains.');

if (wantPush) {
  check(wantAnchor, '--push-anchor requires --anchor.');
  check(/^arena\//.test(branch), '--push-anchor refused: current branch is not arena/*.');
  check(!git('status','--porcelain'), '--push-anchor refused: tree became dirty.');
  git('push','-u','origin','HEAD:refs/heads/' + branch);
  const remote = git('ls-remote','--heads','origin','refs/heads/' + branch).split(/\s+/)[0];
  check(remote === git('rev-parse','HEAD'), 'Remote anchor verification failed.');
  console.log('[CRYSTALA PREFLIGHT] remoteAnchor=PASS ' + remote);
}

console.log('[CRYSTALA PREFLIGHT] GoldHash=PASS ' + expectedGold);
console.log('[CRYSTALA PREFLIGHT] ownerTestCredits=PASS no automatic owner-test grant');
console.log('[CRYSTALA PREFLIGHT] knownBaselineCI=' + KNOWN_BASELINE_RUN + ' Hunter Gold headless asset/harness failure; do not misattribute to Crystal');
console.log('[CRYSTALA PREFLIGHT] PASS head=' + git('rev-parse','HEAD'));
