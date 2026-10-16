// BOXE owner-supplied Gold fidelity gate. Gold engine, motion, SFX and VFX
// must match the attached R2 PLAYTEST source exactly; only the arena/wave
// adapter after this immutable region may evolve.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const game=fs.readFileSync('public/bot-wave/game.html','utf8');
const start=game.indexOf('const modules='),end=game.indexOf('/* BOXE BOT WAVE pilot',start);
assert.ok(start>0&&end>start,'Gold modules/adapter boundary missing');
const core=game.slice(start,end);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(core.length,901831,'Owner Gold source length changed');
assert.equal(sha(core),'00a14304c6c82efc337e78cbeb4f68ff9d1f15b4413016b6355a6c43dd3ffbc7',
 'Owner-approved Gold engine/VFX/BOXE sound banks mutated');
for(const item of ['class BoxeSoundDirector','const BOXE_AUDIO_BANK','const BOXE_FINAL_AUDIO_BANK',
 'BOXE_SFX','BOXE_FINAL_SFX','this.fire.draw(ctx)','this.lightning.draw(ctx)',
 'this.material.drawGround(ctx)','this.post.end(']){
 assert.ok(core.includes(item),'Original Gold visual/audio primitive absent: '+item);
}
const proof=JSON.parse(fs.readFileSync('docs/boxe/BOT_WAVE_R5_EXTERNAL_ASSETS_PROOF.json','utf8'));
for(const asset of proof.substitutions){
 const src='/assets/boxe-gold/'+asset.file;
 assert.ok(game.includes(src),'Original Gold sprite reference missing '+src);
 const binary=fs.readFileSync('public'+src);
 assert.equal(binary.length,asset.bytes,'Owner Gold artwork byte count changed: '+asset.file);
 assert.equal(sha(binary),asset.sha256,'Owner Gold artwork changed: '+asset.file);
}
console.log('OWNER GOLD R2 fidelity PASS: full original renderer, audio banks, 10 immutable PNGs, appended native Wave bridge');

assert.ok(game.includes('const ARENA_STAGE={')&&game.includes('engine.drawArena=function(ctx){ARENA_STAGE.draw(ctx);'), 'Owner circular R2 arena missing');
assert.ok(game.includes('const R2_PRESENT={')&&game.includes('R2_PRESENT.hit(e,done,opts||{})'),'Owner impact number VFX missing');
assert.ok(game.includes("engine.combatCue('WAVE_START',.8)"),'Owner fight SFX not routed');

for(const forbidden of ["name==='j_coil_b'","name==='j_arc_b'","name==='round_bell'","name.startsWith('blink_')"])
 assert.ok(game.includes(forbidden),'Original approved V3 sound rollback missing: '+forbidden);

assert.ok(game.includes('document.body.append(stageHud);'),'Owner arena round effects HUD must actually mount');
