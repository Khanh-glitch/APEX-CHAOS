import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../public/game/bot-wave/waveCampaign.js');
const {indexNative,planWave}=globalThis.APEX_BOT_WAVE_CAMPAIGN;
// Arsenal stays the source of truth: execute actual registry registration in
// an inert sandbox, never copy a second 41-item list into the wave director.
const sandbox={console,setTimeout(){return 0},clearTimeout(){},window:{addEventListener(){},removeEventListener(){}},
 document:{getElementById(){return null},addEventListener(){},querySelector(){return null}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8'),sandbox,{timeout:1000});
const config=sandbox.window.APEX_ARSENAL_CONFIG;
assert.ok(config?.P0_WEAPON_IDS,'native Arsenal config did not load in isolated test VM');
const catalog=indexNative(config);
assert.equal(catalog.records.length,41);
assert.equal(new Set(catalog.records.map(x=>x.id)).size,41);
const first=planWave(config,1,{seed:77});
assert.equal(first.wave,1);
assert.ok(first.composition.every(x=>x.weaponId==='PISTOL'));
assert.deepEqual(planWave(config,17,{seed:88}),planWave(config,17,{seed:88}));
assert.deepEqual(new Set([1,2,3,4].map(w=>planWave(config,w).beat)),new Set(['breather','teach','mix','crescendo']));
assert.equal(planWave(config,5).boss,true);
assert.equal(planWave(config,10).boss,true);
assert.equal(planWave(config,15).boss,true);
assert.equal(planWave(config,41).boss,false);
assert.equal(planWave(config,150).wave,150);
assert.equal(planWave(config,150).infinite,true);
let discovered=new Set();
for(let w=1;w<=32;w++){
 const p=planWave(config,w);
 for(const id of p.newWeapons)discovered.add(id);
 assert.ok(p.composition.every(e=>catalog.byId.has(e.weaponId)));
 assert.ok(p.concurrentLimit>=5&&p.concurrentLimit<=9);
 assert.equal(p.gunDamageScalar,1);
 assert.equal(p.gunCadenceScalar,1);
 assert.equal(p.gunProjectileSpeedScalar,1);
 assert.equal(p.reloadPolicy,'KEEP_WEAPON_AND_REFILL_MAGAZINE');
}
assert.equal(discovered.size,41,'All 41 distinct native weapons must be first encountered by wave 32');
for(const id of catalog.allWeaponIds){
 const native=config.WEAPONS[id];
 assert.strictEqual(catalog.byId.get(id).spec,native,'Wave must reference native spec, not make a damage copy: '+id);
}
for(const wave of [6,10,18,23,34,47]){
 const p=planWave(config,wave);
 assert.ok(p.composition.some(e=>e.weaponId));
}
assert.throws(()=>planWave(config,0),/INVALID/);
console.log('BOT WAVE unlimited campaign PASS: 41/41 native Arsenal, revealed by wave 32, chapter crescendo, no stat scaling');
