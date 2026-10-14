// CP16: Git-authoritative, in-band, read-only provenance receipt.
// Emitted AFTER shipping pruning, into dist only. No gameplay/runtime mutation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const REPO=path.resolve('.');
const dist=path.join(REPO,'dist');
const revFile=fs.readFileSync(path.join(REPO,'src/game/runtimeManifest.js'),'utf8');
const match=revFile.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
if(!match)throw Error('CP16 source runtime revision missing');
const revision=match[1];
const gitSha=execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(gitSha))throw Error('CP16 invalid Git build SHA');
for(const [name,val] of [['CF_PAGES_COMMIT_SHA',process.env.CF_PAGES_COMMIT_SHA],
                          ['GITHUB_SHA',process.env.GITHUB_SHA]]){
 if(val && val!==gitSha)throw Error('CP16 '+name+' does not match checked-out Git HEAD');
}
const gold=JSON.parse(fs.readFileSync(path.join(dist,'gold/manifest.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(REPO,'tools/runtimeRevision.lock.json'),'utf8'));
if(gold.runtimeRevision!==revision||lock.revision!==revision)
 throw Error('CP16 build refused: runtime/Gold/lock revision mismatch');
const shell=fs.readFileSync(path.join(dist,'gold/shell.html'));
const shellHash=crypto.createHash('sha256').update(shell).digest('hex');
if(gold.files?.['shell.html']?.sha256!==shellHash ||
   gold.files?.['shell.html']?.bytes!==shell.length)
 throw Error('CP16 build refused: emitted Gold shell differs from source manifest');
const receipt=Object.freeze({
 schema:1,
 application:'APEX CHAOS',
 gitCommit:gitSha,
 gitBranch:process.env.CF_PAGES_BRANCH || process.env.GITHUB_HEAD_REF ||
    execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),
 revision,
 goldShellSha256:shellHash,
 versionedRuntimeCount:Object.keys(lock.files).length,
 provenance:'git-checkout/build: checked before publishing; not a deployment attestation'
});
fs.writeFileSync(path.join(dist,'CP16_BUILD_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('CP16 BUILD RECEIPT',receipt.gitCommit,receipt.revision,receipt.versionedRuntimeCount);
