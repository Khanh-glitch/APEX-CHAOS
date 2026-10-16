import assert from 'node:assert/strict';
import {buildWavePlan,createBotWaveDirector} from '../src/game/botWave/waveDirector.js';
import {DEFAULT_ROBOTS,createWaveUpgradePool} from '../src/game/botWave/upgradeRegistry.js';
const p=buildWavePlan(1,{seed:721});
assert.equal(p.wave,1);assert.equal(p.enemies.length,6);assert.ok(p.enemies.every(e=>e.gunId==='PISTOL'&&e.equipment.magazineCapacity===3));
assert.deepEqual(buildWavePlan(1,{seed:721}),p);
assert.deepEqual(new Set(p.enemies.map(e=>e.edge)),new Set(['north','east','south','west']));
assert.ok(p.enemies.every(e=>e.edgeFraction>=.08&&e.edgeFraction<=.92));
assert.ok(buildWavePlan(5,{seed:721}).enemies.length>1);
assert.equal(buildWavePlan(5,{seed:721}).enemies.find(e=>e.boss).archetypeId,'bossAlpha');
assert.equal(buildWavePlan(10,{seed:721}).enemies.find(e=>e.boss).archetypeId,'bossOmega');
assert.ok(buildWavePlan(10,{seed:721}).enemies.some(e=>!e.boss&&e.gunId==='GRENADE'));
assert.equal(buildWavePlan(10,{seed:721}).reloadPolicy,'KEEP_WEAPON_AND_REFILL_MAGAZINE');
assert.equal(buildWavePlan(15,{seed:721}).enemies.find(e=>e.boss).archetypeId,'bossEndless');
assert.throws(()=>buildWavePlan(1,{registry:{}}),/NO_REGISTERED_ENEMY/);
const x=buildWavePlan(7,{seed:6,registry:{...DEFAULT_ROBOTS,'robot-mini':{minWave:1,xp:5,boss:false}}});
assert.ok(x.enemies.length>=6);
const events=[],d=createBotWaveDirector({seed:99,onEvent:e=>events.push(e)});
assert.deepEqual(d.snapshot().activeKeys,['J','K','L']);
assert.deepEqual(d.snapshot().activeGoldKeys,[]);
assert.throws(()=>d.offerLevelUp(),/NOT_WAITING_FOR_LEVEL_UP/);
let wave=d.startWave();
assert.equal(wave.wave,1);
assert.equal(d.snapshot().status,'in-wave');
assert.throws(()=>d.startWave(),/WAVE_NOT_READY/);
assert.equal(d.verifiedDeath('made-up-enemy').accepted,false);
assert.equal(d.verifiedDeath(wave.enemies[0].id).accepted,true);
assert.equal(d.verifiedDeath(wave.enemies[0].id).accepted,false);
for(const enemy of wave.enemies.slice(1))d.verifiedDeath(enemy.id);
assert.equal(d.snapshot().totalXp,6*15);
assert.equal(d.snapshot().status,'level-up');
assert.ok(d.snapshot().pendingLevelUps>=1);
assert.throws(()=>d.startWave(),/SELECT_LEVEL_UP_CARDS_FIRST/);
while(d.snapshot().pendingLevelUps){
 const cards=d.offerLevelUp();
 assert.equal(cards.length,3);assert.equal(new Set(cards.map(c=>c.id)).size,3);
 assert.deepEqual(d.snapshot().activeKeys,['J','K','L']);
 assert.throws(()=>d.startWave(),/SELECT_LEVEL_UP_CARDS_FIRST/);
 d.selectLevelUp(cards[0].id);
}
assert.equal(d.snapshot().status,'cleared');
for(let i=2;i<=15;i++){
 wave=d.startWave();assert.equal(wave.wave,i);
 for(const e of wave.enemies)d.verifiedDeath(e.id);
 while(d.snapshot().pendingLevelUps){
  const cards=d.offerLevelUp();
  d.selectLevelUp(cards[0].id);
 }
 assert.equal(d.snapshot().status,'cleared');
}
assert.equal(d.startWave().wave,16);
assert.equal(d.snapshot().endless,true);
assert.equal(buildWavePlan(30,{seed:721}).enemies.find(e=>e.boss).archetypeId,'bossEndless');
assert.ok(buildWavePlan(99,{seed:721}).enemies.length>0);
console.log('BOXE BOT WAVE director PASS: seeded four-edge spawns, real XP, 3-card gating, no wave-10 ending, recurring five-wave bosses');
