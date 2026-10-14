import assert from 'node:assert/strict';
import {APEX_WAVE_GUNS,APEX_WAVE_LOADOUTS,BOXE_WAVE_SURVIVAL,getWaveLoadout,makeWaveEnemyEquipment,weaponThreatBudget} from '../src/game/botWave/apexGunLoadouts.js';
assert.equal(APEX_WAVE_LOADOUTS.length,10);
assert.equal(BOXE_WAVE_SURVIVAL.initialHP,3200);
assert.equal(BOXE_WAVE_SURVIVAL.baseOnKillHealFraction,.012);
assert.equal(APEX_WAVE_GUNS.PISTOL.ammo,3);assert.equal(APEX_WAVE_GUNS.SMG.ammo,8);
assert.equal(APEX_WAVE_GUNS.SHOTGUN.pellets,8);
assert.equal(APEX_WAVE_GUNS.SHOTGUN.ammo,1,'Native shotgun is one 8-pellet burst, not invented four shells');
assert.equal(APEX_WAVE_GUNS.SNIPER.aimTime,.8);
assert.equal(APEX_WAVE_GUNS.GRENADE.blastRadius,155);
const threat=[];
for(let w=1;w<=10;w++){
 const p=getWaveLoadout(w,{seed:77});
 const repeat=getWaveLoadout(w,{seed:77});
 assert.deepEqual(p,repeat);
 assert.ok(p.composition.length>=6);
 assert.ok(p.composition.every(id=>APEX_WAVE_GUNS[id]));
 assert.equal(p.boss,w===5||w===10);
 assert.ok(p.concurrentLimit>=6&&p.concurrentLimit<=11);
 assert.equal(p.reloadPolicy,'KEEP_WEAPON_AND_REFILL_MAGAZINE');
 if(w<=2)assert.ok(p.composition.every(id=>['PISTOL','SMG'].includes(id)));
 if(w<=3)assert.ok(!p.composition.includes('SNIPER'));
 if(w<=7)assert.ok(!p.composition.includes('GRENADE'));
 threat.push(p.pressureEstimate);
}
for(let i=1;i<threat.length;i++)assert.ok(threat[i]>threat[i-1],'Wave '+(i+1)+' pressure must exceed prior wave '+threat);
const sniper=makeWaveEnemyEquipment('SNIPER',7);assert.equal(sniper.aimTelegraphSeconds,.8);
const shotgun=makeWaveEnemyEquipment('SHOTGUN',7);assert.equal(shotgun.pellets,8);
// No changes to one gun's damage, cadence, bullet velocity, ammo or reload
// between any two waves or for the boss who holds it.
for(const id of Object.keys(APEX_WAVE_GUNS)){
 const a=makeWaveEnemyEquipment(id,1),b=makeWaveEnemyEquipment(id,10),c=makeWaveEnemyEquipment(id,10,{boss:true});
 assert.deepEqual(a,b,'WAVE_STATS_DRIFT '+id);assert.deepEqual(a,c,'BOSS_WEAPON_BUFF '+id);
 assert.equal(a.damageScale,7,'Auto Battle equipment damage multiplier');
}
const smg=makeWaveEnemyEquipment('SMG',7);assert.equal(smg.magazineCapacity,8);
assert.ok(smg.reloadSeconds>0&&smg.bulletsReloadInsteadOfDiscard);
assert.equal(smg.owner,'enemy-robot');
assert.ok(weaponThreatBudget('PISTOL')>0);
assert.equal(getWaveLoadout(15).boss,true);
console.log('BOXE R3 Arsenal pressure PASS; per-wave values',threat.join(' → '),'HP base 3200 / healing / magazines / reload');
