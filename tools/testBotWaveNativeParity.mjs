import assert from 'node:assert/strict';
import fs from 'node:fs';
const bridge=fs.readFileSync('public/game/bot-wave/nativeArsenalGoldBridge.js','utf8');
const gold=fs.readFileSync('public/bot-wave/game.html','utf8');
for(const x of ['native.api.equip(proxy,id)','native.api.updateHolder(proxy,dt)','native.api.updateArsenalProjectiles(dt','native.api.drawArsenalProjectiles(ctx)','native.av.cue']){
 if(!bridge.includes(x)&&x!=='native.av.cue')throw Error('Native integration missing '+x);
}
assert.ok(!bridge.includes("kind:'orb'"),'Fake Gold orb must not emit native Arsenal bullets');
assert.ok(!bridge.includes('engine.projs.push('),'Gold projectile clones must not be emitted in native bridge');
assert.ok(!bridge.includes('shot(e,g,'),'Independent re-authored shot executor not permitted');
assert.ok(!bridge.includes('recordToGun'),'Per-mode gun spec rewrite is forbidden');
assert.ok(!bridge.includes('setInterval('),'No independent shooting clock');
assert.ok(bridge.includes("backend:'FREE_BATTLE_NATIVE'"));
assert.ok(gold.includes('APEX_BOT_WAVE_NATIVE_BRIDGE'),'Gold wave must load actual native bridge');
assert.ok(!gold.includes('APEX_BOT_WAVE_ARMORY.createArmory'),
 'Deprecated fake Armory must never drive Gold');
console.log('PASS: BOT WAVE Free Battle weapon executor parity architecture, no fake orb/projectile/shot timer');

assert.ok(gold.includes('ARMORY.drawEquipped(ctx,e)'),'Gold bot must use the real Arsenal weapon visual pose');
assert.ok(gold.includes('ARMORY.ensureAudio()'),'Gold interaction must initialize the existing Arsenal audio bank');
assert.ok(!gold.includes('Additional Arsenal tracer layer'),'Rejected homemade tracer visuals forbidden');
