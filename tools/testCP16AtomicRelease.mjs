// CP16: source-to-artifact atomic release receipt + adversarial mixed-cache mutations.
// Never rewrite Gold artifacts here. This is read-only and fails closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const manifestSource = fs.readFileSync('src/game/runtimeManifest.js','utf8');
const m = manifestSource.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
assert.ok(m,'missing authoritative runtime revision');
const revision = m[1];
const goldURLs = fs.readFileSync('src/game/goldAssetManifest.js','utf8');
const shell = fs.readFileSync('public/gold/shell.html','utf8');
const gold = JSON.parse(fs.readFileSync('public/gold/manifest.json','utf8'));
const lock = JSON.parse(fs.readFileSync('tools/runtimeRevision.lock.json','utf8'));
const surfaces = ['shell.html','lucky-draw.html','battle-hud.html','transition/mechanical-door-v4.gold.js'];
const scriptPaths = ['/game/ui/uiSfxAuthority.js','/game/gold/goldProductBridge.js'];
function inspect(current){
  assert.equal(current.goldRevision,current.revision,'Gold and runtime revision split');
  assert.equal(current.lockRevision,current.revision,'SHA lock and runtime revision split');
  assert.ok(!current.urls.includes('20261014-cp8-owner-gold-content-r10'),
    'stale CP8 Gold surface cache token');
  for(const path of surfaces){
    const publicURL = '/gold/'+path+'?v='+current.revision;
    const name = path==='shell.html'?'SHELL':path==='lucky-draw.html'?'LUCKY_DRAW':
      path==='battle-hud.html'?'BATTLE_HUD':'TRANSITION';
    assert.ok(current.urls.includes("export const GOLD_"+name+" = '"+publicURL+"'"),
      'missing atomic Gold URL: '+path);
  }
  for(const path of scriptPaths){
    const occurrences=[...current.shell.matchAll(/<script src="([^"]+)"><\/script>/g)]
      .map(x=>x[1]).filter(x=>x.startsWith(path+'?v='));
    assert.deepEqual(occurrences,[path+'?v='+current.revision],
      'Gold executable imports disagree or duplicate: '+path);
  }
  assert.equal(current.goldShellHash,digest(Buffer.from(current.shell)),
    'generated Gold shell SHA mismatch');
  assert.equal(current.goldShellBytes,Buffer.byteLength(current.shell),
    'generated Gold shell byte length mismatch');
}
const state={
  revision,urls:goldURLs,shell,
  goldRevision:gold.runtimeRevision,lockRevision:lock.revision,
  goldShellHash:gold.files['shell.html'].sha256,
  goldShellBytes:gold.files['shell.html'].bytes
};
inspect(state);
for(const [name,mutation] of [
  ['manifest revision only',{goldRevision:'stale-gold'}],
  ['SHA lock revision only',{lockRevision:'stale-runtime'}],
  ['Gold surface URL only',{urls:goldURLs.replace('/gold/lucky-draw.html?v='+revision,'/gold/lucky-draw.html?v=stale-gold')}],
  ['Gold executable URL only',{shell:shell.replace('/game/gold/goldProductBridge.js?v='+revision,'/game/gold/goldProductBridge.js?v=stale-gold')}],
  ['Gold shell data without hash',{shell:shell+'<!-- invalidation canary -->'}]
]){
  assert.throws(()=>inspect({...state,...mutation}),undefined,
    'mixed-cache negative must fail closed: '+name);
}
for(const [file,record] of Object.entries(gold.files)){
  if(file.startsWith('../')) continue; // cross-tree Forward Drive source is independent
  const disk=fs.readFileSync('public/gold/'+file);
  assert.equal(record.bytes,disk.length,'Gold emitted byte length mismatch '+file);
  assert.equal(record.sha256,digest(disk),'Gold emitted SHA mismatch '+file);
}
assert.ok(Object.keys(lock.files).length>=40,'unexpectedly shortened runtime SHA lock');
for(const [file,sha] of Object.entries(lock.files)){
  assert.equal(digest(fs.readFileSync(file)),sha,'runtime changed without relock '+file);
}
console.log('CP16 ATOMIC RELEASE CANDIDATE PASS: 3-way cache authority, shell bytes, full Gold hashes, runtime lock, 5 negative mixed-cache cases');