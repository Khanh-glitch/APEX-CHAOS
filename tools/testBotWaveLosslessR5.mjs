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
const prefix=binary.toString('utf8').split(proof.visual_prefix_delimiter)[0];
assert.equal(sha(Buffer.from(prefix)),proof.gold_visual_prefix_sha256,
 'Owner Gold art/motion/VFX core changed outside the isolated wave adapter');
assert.equal(proof.source_gold_visual_edits,0,'Owner Gold visual core edits forbidden');
const adapter=binary.toString('utf8').split(proof.visual_prefix_delimiter)[1]||'';
assert.ok(!adapter.includes("engine.drawArena=function("),"REJECT: BOT WAVE replaced owner Gold arena renderer");
for(const method of ['initRibbons','updateRibbons','resetRibbons','drawRibbons'])
 assert.ok(!adapter.includes('engine.'+method+'=function('),'REJECT: BOT WAVE disabled owner Gold '+method);

assert.equal(substitutions.length,10,'All original lossless PNGs must remain linked');
assert.ok(expanded.includes('WAVE_STICKY_ASSIST')&&expanded.includes('waveGunCue')&&expanded.includes('APEX_GUN_ART'),'R5.1 wave and Arsenal hooks missing');
console.log('BOXE R5.1 LOSSLESS RUNTIME PASS; raw='+proof.raw_sha256+' bytes='+proof.raw_bytes+' served='+binary.byteLength+' Gold PNG='+substitutions.length);