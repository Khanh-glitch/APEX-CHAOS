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
assert.ok(bridge.includes('const vx=actor.vx||0,vy=actor.vy||0') &&
 bridge.includes('if(actor.hp>0){actor.vx=vx;actor.vy=vy;}'),
 'Gold fixed knockback must not double native Arsenal push or pull BOXE toward shooter');
assert.ok(bridge.includes('Math.max(1,s.shots||1)'),
 'Wave shot count must project the actual native weapon spec, including SHOTGUN');
assert.ok(bridge.includes('config.WEAPONS.TOWER_SHIELD.damageTakenMult'),
 'Gold melee contacts must honor the exact canonical Tower Shield guard rule');
assert.ok(!bridge.includes('return amount*.5'),'No bespoke Wave shield nerf');
assert.ok(!bridge.includes('setInterval('),'No independent shooting clock');
assert.ok(bridge.includes("backend:'FREE_BATTLE_NATIVE'"));
const arsenal=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const config=fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8');
assert.ok(/SHOTGUN:\s*\{\s*family: 'SHOTGUN', shots: 2, interval: 0.28, pellets: 8/.test(config),
 'Free Battle SHOTGUN must preserve two 8-pellet volleys with 0.28s spacing');
assert.ok(arsenal.includes("SHOTGUN: makeGun('SHOTGUN'"),
 'Native SHOTGUN must use two timed volleys instead of an inert undefined magazine');
assert.ok(bridge.includes('projectile.life-=dt'),'Gold must advance canonical Arsenal projectile life once per tick');
assert.ok(bridge.includes('native.api.updateArsenalProjectiles(dt'),'Collision ownership must remain with Arsenal runtime');
assert.ok(!bridge.includes('engine.projs.splice('),'No fake projectile lifecycle allowed');
assert.ok(gold.includes('APEX_BOT_WAVE_NATIVE_BRIDGE'),'Gold wave must load actual native bridge');
assert.ok(!gold.includes('APEX_BOT_WAVE_ARMORY.createArmory'),
 'Deprecated fake Armory must never drive Gold');
const campaign=fs.readFileSync('public/game/bot-wave/waveCampaign.js','utf8');
assert.ok(campaign.includes('startingHP:1000') &&
 campaign.includes('baseKillHealFraction:.005')&&campaign.includes('gunDamageScalar:1'),
 'Survival pressure must use HP/recovery, never secret weapon stat scaling');
console.log('PASS: BOT WAVE Free Battle weapon executor parity architecture, no fake orb/projectile/shot timer');

assert.ok(gold.includes('ARMORY.drawEquipped(ctx,e)'),'Gold bot must use the real Arsenal weapon visual pose');
assert.ok(gold.includes('ARMORY.ensureAudio()'),'Gold interaction must initialize the existing Arsenal audio bank');
assert.ok(!gold.includes('Additional Arsenal tracer layer'),'Rejected homemade tracer visuals forbidden');
