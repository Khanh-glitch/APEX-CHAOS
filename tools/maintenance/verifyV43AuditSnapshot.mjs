#!/usr/bin/env node
// Static, fail-closed provenance audit. This checks bookkeeping only; it
// NEVER grants Gold certification or authorizes deleting a GitHub ref.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const inventory=read('docs/maintenance/V43_BRANCH_INVENTORY_2026-10-10.json');
const evidence=read('docs/maintenance/V43_GOLD_40_PHASE_EVIDENCE_BACKLOG_2026-10-10.json');
const sha=/^[0-9a-f]{40}$/;
assert.equal(inventory.repo,'Khanh-glitch/APEX-CHAOS');
assert.match(inventory.canonicalSha,sha);
assert.equal(inventory.schema,'apex-chaos-branch-snapshot-v2');
assert.equal(inventory.branches.length,171);
assert.equal(new Set(inventory.branches.map(b=>b.name)).size,171);
for(const b of inventory.branches){
  assert.match(b.sha,sha,'Unpinned branch '+b.name);
  assert.equal(typeof b.protected,'boolean');
  assert.equal(typeof b.role,'string');
}
const byName=new Map(inventory.branches.map(b=>[b.name,b]));
assert.equal(byName.get(inventory.canonicalDevelopment)?.sha,inventory.canonicalSha);
assert.equal(byName.get('main')?.role,'default-branch');
assert.equal(byName.get('cleanup/v43-repository-hygiene-20261010')?.role,'staged-cleanup');
assert.equal(byName.get('fix/v43-runtime-integrity-20261010')?.role,'open-pr-dependency');
assert.equal(inventory.openPullRequests.length,12);
const ids=inventory.openPullRequests.map(p=>p.number).sort((a,b)=>a-b);
assert.deepEqual(ids,Array.from({length:12},(_,i)=>i+15));
for(const p of inventory.openPullRequests){
  assert.equal(byName.has(p.head),true,'Missing PR head '+p.number);
  assert.equal(byName.has(p.base),true,'Missing PR base '+p.number);
}
const tally={};
for(const b of inventory.branches)tally[b.role]=(tally[b.role]||0)+1;
assert.deepEqual(tally,inventory.summary);
assert.equal(tally['ancestor-review-candidate'],120);
assert.equal(tally['diverged-preserve'],35);
assert.equal(tally['open-pr-dependency'],12);
assert.equal(evidence.status,'EVIDENCE_ONLY_NOT_CERTIFICATION');
assert.equal(evidence.summary.verifiedGoldPhases,0);
assert.equal(evidence.summary.unverifiedGoldPhases,40);
assert.equal(evidence.goldCert.phasePassed,0);
assert.equal(evidence.goldCert.phaseTotal,40);
assert.equal(evidence.goldCert.strictStatus,'BLOCKED');
assert.equal(evidence.goldCert.sourcePassed,7);
assert.equal(evidence.goldCert.sourceTotal,7);
assert.match(evidence.ownerBaselineGoldHtmlSha256,/^[0-9a-f]{64}$/);
const eight=['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER',
  'COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER',
  'SHRAPNEL_MINE_LAUNCHER'];
const five=['ready','attack','contact','afterglow','counter'];
const expected=new Set(eight.flatMap(w=>five.map(p=>w+'/'+p)));
const actual=new Set();
for(const p of evidence.pendingPhases){
  assert.equal(p.status,'UNVERIFIED');
  assert.ok(eight.includes(p.weapon));
  assert.ok(five.includes(p.phase));
  assert.ok(Array.isArray(p.goldProofsMissing)&&p.goldProofsMissing.length>0);
  assert.ok(p.goldProofsMissing.every(k=>k.startsWith('gold:')));
  assert.equal(actual.has(p.weapon+'/'+p.phase),false,'Duplicate phase');
  actual.add(p.weapon+'/'+p.phase);
}
assert.deepEqual([...actual].sort(),[...expected].sort());
console.log('PASS V4.3 audit snapshot: 171 SHA-pinned refs, 12 open PRs, 40/40 correctly BLOCKED Gold phases');
console.log('NOTE: Static snapshot self-check only. No GitHub deletion, deployment, or visual certification.');
