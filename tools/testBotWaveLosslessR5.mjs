// OWNER R5.1 — lossless runtime externalization gate.
// The Gold source is immutable. Its 10 embedded PNGs are replaced by identical
// existing, hash-checked /assets/boxe-gold images for efficient cloud delivery.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const proof=JSON.parse(fs.readFileSync('docs/boxe/BOT_WAVE_R5_EXTERNAL_ASSETS_PROOF.json','utf8'));
const binary=fs.readFileSync('public/bot-wave/game.html');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(binary.byteLength,proof.externalized_bytes,'BOT WAVE HTML byte count drift');
assert.equal(sha(binary),proof.externalized_sha256,'BOT WAVE altered post-externalization');
const substitutions=[];
const expanded=binary.toString('utf8').replace(/\/assets\/boxe-gold\/([A-Za-z0-9_-]+\.png)/g,(full,name)=>{
 const match=proof.substitutions.find(a=>a.file===name);
 assert.ok(match,'unexpected Gold asset path '+name);
 const disk=path.join('public/assets/boxe-gold',name);
 assert.ok(fs.existsSync(disk),'Gold sprite missing: '+name);
 const bytes=fs.readFileSync(disk);
 assert.equal(bytes.length,match.bytes,'PNG size mismatch: '+name);
 assert.equal(sha(bytes),match.sha256,'Gold PNG content changed: '+name);
 substitutions.push(name);
 return 'data:image/png;base64,'+bytes.toString('base64');
});
assert.equal(substitutions.length,10,'exactly ten Gold images must externalize');
assert.equal(new Set(substitutions).size,10,'duplicate/missing sprite mappings');
assert.equal(Buffer.byteLength(expanded),proof.raw_bytes,'Gold R5.1 restored size changed');
assert.equal(sha(Buffer.from(expanded)),proof.raw_sha256,'Gold R5.1 gameplay or VFX bytes changed');
assert.equal(proof.vfx_and_gameplay_edits,0,'Gold gameplay edits forbidden');
assert.ok(expanded.includes('WAVE_STICKY_ASSIST')&&expanded.includes('waveGunCue')&&expanded.includes('APEX_GUN_ART'),'R5.1 wave and Arsenal hooks missing');
console.log('BOXE R5.1 LOSSLESS RUNTIME PASS; raw='+proof.raw_sha256+' bytes='+proof.raw_bytes+' served='+binary.byteLength+' Gold PNG='+substitutions.length);