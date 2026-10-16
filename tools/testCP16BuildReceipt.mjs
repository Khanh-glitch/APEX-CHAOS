// Verify the actual packaged CP16 release carries exact source commit identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const r=JSON.parse(fs.readFileSync('dist/CP16_BUILD_RECEIPT.json','utf8'));
const m=fs.readFileSync('src/game/runtimeManifest.js','utf8').match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
const g=JSON.parse(fs.readFileSync('dist/gold/manifest.json','utf8'));
const l=JSON.parse(fs.readFileSync('tools/runtimeRevision.lock.json','utf8'));
assert.equal(r.gitCommit,sha,'CI checkout differs from release bundle');
assert.equal(r.revision,m?.[1],'runtime revision missing/mismatch');
assert.equal(r.revision,g.runtimeRevision,'Gold revision differs from release');
assert.equal(r.revision,l.revision,'locked revision differs from release');
assert.equal(r.goldShellSha256,g.files['shell.html'].sha256,'Gold shell evidence drift');
assert.equal(r.versionedRuntimeCount,Object.keys(l.files).length,'locked runtime count differs');
// CP17's locked 59 baseline executables remain, plus the three signed
// BOXE adapter/Gold presentation runtimes registered in the same graph.
const boxe=['boxeBattleRuntime.js','boxeGoldLibrary.js','boxeGoldPresentationRuntime.js'];
for(const name of boxe)assert.ok(Object.keys(l.files).some(f=>f.endsWith('/'+name)),'missing BOXE versioned runtime '+name);
assert.equal(r.versionedRuntimeCount,59+boxe.length,'unexpected runtime-graph size change');
console.log('CP16 PACKAGED BUILD RECEIPT PASS',r.gitCommit,r.revision);
