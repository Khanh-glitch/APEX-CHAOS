import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=mkdtempSync(join(tmpdir(),'apex-layout-test-'));
try {
 const dist=join(root,'dist'), launcher=join(root,'launcher'),stage=join(root,'stage'),out=join(root,'restored');
 mkdirSync(join(dist,'assets'),{recursive:true});mkdirSync(join(launcher,'app','assets'),{recursive:true});
 for(const d of [dist,join(launcher,'app')]) {writeFileSync(join(d,'index.html'),'hello');writeFileSync(join(d,'assets','a.bin'),'binary bytes');}
 writeFileSync(join(launcher,'serve.ps1'),'launcher');const sha='a'.repeat(40);writeFileSync(join(launcher,'app','ARSENAL_BUILD_SHA.txt'),sha+'\n');
 const run=(...args)=>spawnSync(process.execPath,['tools/arsenalArtifactLayout.mjs',...args],{encoding:'utf8'});
 let x=run('prepare',dist,launcher,stage); assert.equal(x.status,0,x.stderr);
 x=run('restore',dist,stage,out);assert.equal(x.status,0,x.stderr);assert.equal(readFileSync(join(out,'app','assets','a.bin'),'utf8'),'binary bytes');assert.equal(readFileSync(join(out,'app','ARSENAL_BUILD_SHA.txt'),'utf8').trim(),sha);
 x=run('restore',dist,stage,out);assert.notEqual(x.status,0,'must not overwrite existing output');
 writeFileSync(join(dist,'index.html'),'tampered');x=run('restore',dist,stage,join(root,'bad'));assert.notEqual(x.status,0,'must reject tampered dist');
 x=run('prepare',dist,launcher,join(root,'badstage'));assert.notEqual(x.status,0,'must reject nonidentical app');
 console.log('PASS: layout, SHA, restore, mismatch and overwrite guards');
} finally {rmSync(root,{recursive:true,force:true});}
