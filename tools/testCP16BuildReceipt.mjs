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
const boxe=['boxeBattleRuntime.js','boxeGoldLibrary.js','boxeGoldPresentationRuntime.js','boxeSfxAuthority.js'];
for(const name of boxe)assert.ok(Object.keys(l.files).some(f=>f.endsWith('/'+name)),'missing BOXE versioned runtime '+name);
const shuri=['shuriBattleRuntime.js','shuriGoldLibrary.js','shuriGoldPresentationRuntime.js'];
for(const name of shuri)assert.ok(Object.keys(l.files).some(f=>f.endsWith('/'+name)),'missing SHURI versioned runtime '+name);
// BOT WAVE r19 registered its three versioned runtimes in the same graph.
const botwave=['waveCampaign.js','nativeArsenalGoldBridge.js','botWavePresentationV2.js','losslessFluidRuntime.js'];
for(const name of botwave)assert.ok(Object.keys(l.files).some(f=>f.endsWith('/'+name)),'missing BOT WAVE versioned runtime '+name);
// A1 r20 registered the P1/P2 skill-details presentation runtime.
const a1=['skillDetailsRuntime.js'];
for(const name of a1)assert.ok(Object.keys(l.files).some(f=>f.endsWith('/'+name)),'missing A1 versioned runtime '+name);
// Total Evolution is a versioned extension to the same product graph. The
// historical 71-runtime ceiling is obsolete: require every new signed module,
// and let the runtime lock remain the exact size / SHA authority.
const arenaModules=[
  'apexBeyondAudioEngine.js',
  'apexEvolutionArtAtlas.js',
  'apexEvolutionVfxLibrary.js',
  'apexEvolutionShaderCompositor.js',
  'apexEvolutionAudio.js',
  'apexEvolutionArenas.js',
  'apexBeyondArenaEngine.js',
  'apexBeyondVfxEngine.js',
  'apexBeyondCombatEngine.js',
];
for(const name of arenaModules)assert.ok(
  Object.keys(l.files).some(f=>f.endsWith('/'+name)),
  'missing Total Evolution versioned runtime '+name
);
const minimum=59+boxe.length+shuri.length+botwave.length+a1.length+arenaModules.length;
assert.ok(r.versionedRuntimeCount>=minimum,'missing signed runtime extension in product graph');
console.log('CP16 PACKAGED BUILD RECEIPT PASS',r.gitCommit,r.revision);
