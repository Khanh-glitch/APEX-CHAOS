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
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalIdentityRuntime.js','utf8'),sandbox,{timeout:1000});
const config=sandbox.window.APEX_ARSENAL_CONFIG;
assert.equal(sandbox.window.apexArsenalIdentityRuntime,'ready','campaign balance must be planned from the post-identity Free Battle specs');
assert.equal(config.isGun?.('PISTOL'),true,'campaign pressure must classify guns through Arsenal identity');
assert.ok(config?.P0_WEAPON_IDS,'native Arsenal config did not load in isolated test VM');
const catalog=indexNative(config);
assert.equal(catalog.records.length,41);
assert.equal(new Set(catalog.records.map(x=>x.id)).size,41);
const first=planWave(config,1,{seed:77});
assert.equal(first.wave,1);
assert.equal(first.concurrentLimit,2,'the opening Pistol tutorial must not stack six post-x7 guns at once');
assert.equal(first.pressureBudget,110);
assert.ok(first.composition.every(x=>x.weaponId==='PISTOL'));
assert.ok(first.composition[0].pressure>45&&first.composition[0].pressure<60,
 'PISTOL pressure must be derived from post-x7 sustained damage, not authored 4.5 alone');
assert.deepEqual(planWave(config,17,{seed:88}),planWave(config,17,{seed:88}));
assert.deepEqual(new Set([1,2,3,4,5,6,7,8,9,10].map(w=>planWave(config,w).beat)),new Set(['farm','teach','mix','spike','power','crescendo','boss']));
assert.equal(planWave(config,1).revealedWeapons,1);
assert.equal(planWave(config,2).revealedWeapons,2);
assert.equal(planWave(config,3).revealedWeapons,3);
assert.equal(planWave(config,4).revealedWeapons,4);
assert.equal(planWave(config,5).revealedWeapons,5,'The fifth starter debuts on wave 5');
assert.ok(planWave(config,5).newWeapons.includes('GRENADE'),'Explosives complete the starter set on wave 5');
assert.equal(planWave(config,6).revealedWeapons,6);
assert.equal(planWave(config,5).boss,false);
assert.equal(planWave(config,10).boss,true);
assert.equal(planWave(config,15).boss,false);
assert.equal(planWave(config,20).boss,true);
assert.equal(planWave(config,41).boss,false);
assert.equal(planWave(config,150).wave,150);
assert.equal(planWave(config,150).infinite,true);
let discovered=new Set(),actualEncountered=new Set();
for(let w=1;w<=30;w++){
 const p=planWave(config,w);
 for(const id of p.newWeapons){
  discovered.add(id);
  assert.ok(p.composition.some(x=>x.weaponId===id),
   'New identity must be wielded in its debut wave: '+id+' wave '+w);
 }
 for(const foe of p.composition)actualEncountered.add(foe.weaponId);
 assert.ok(p.composition.every(e=>catalog.byId.has(e.weaponId)));
 assert.ok(p.composition.every(e=>Number.isFinite(e.pressure)&&e.pressure>=0),
  'every carrier must carry a finite post-x7 pressure score');
 assert.ok(p.concurrentLimit>=2&&p.concurrentLimit<=8);
 assert.ok(Number.isFinite(p.pressureBudget)&&p.pressureBudget>0);
 assert.equal(p.boss,w%10===0);
 assert.equal(p.cluster,Math.floor((w-1)/10)+1);
 assert.equal(p.clusterWave,((w-1)%10)+1);
 assert.ok(p.spawnInterval>=.24&&p.spawnInterval<=.7);
 assert.ok(p.enemyHpMultiplier>0);
 assert.equal(p.bossHp>0,p.boss);
 if(p.boss)assert.equal(p.composition[0].boss,true);
 assert.equal(p.gunDamageScalar,1);
 assert.equal(p.gunCadenceScalar,1);
 assert.equal(p.gunProjectileSpeedScalar,1);
 assert.equal(p.reloadPolicy,'KEEP_WEAPON_AND_REFILL_MAGAZINE');
}
assert.equal(discovered.size,41,'All 41 native weapons must debut by wave 30');
assert.equal(actualEncountered.size,41,'All 41 native weapons must physically appear in real wave compositions, not only unlock lists');
for(const id of catalog.allWeaponIds){
 const native=config.WEAPONS[id];
 assert.strictEqual(catalog.byId.get(id).spec,native,'Wave must reference native spec, not make a damage copy: '+id);
}
for(const wave of [6,10,18,23,34,47]){
 const p=planWave(config,wave);
 assert.ok(p.composition.some(e=>e.weaponId));
}
assert.throws(()=>planWave(config,0),/INVALID/);
console.log('BOT WAVE unlimited campaign PASS: 41/41 native Arsenal, revealed by wave 30, 10-wave clusters, Free Battle damage scalars');
