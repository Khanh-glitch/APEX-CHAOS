import assert from 'node:assert/strict';
import {heroProfile,weaponProfile,skillRecords} from '../src/game/cosmetics/fieldArchiveProfiles.js';
const fixtureSkill=(slot,mechanicId,baseConfig)=>({slot,mechanicId,baseConfig});
const hero={id:'FUTURE_HERO_7',skills:{
 PASSIVE:fixtureSkill('PASSIVE','future_heal_guard',{heal:100,duration:2}),
 A1:fixtureSkill('A1','future_dash_strike',{dashSpeed:900,damage:25,cooldown:8}),
 A2:fixtureSkill('A2','future_root_zone',{rootSeconds:2,radius:150,cooldown:12})
}};
const a=heroProfile(hero);
assert.equal(a.axes.length,5);
assert.equal(a.status,'derived');
assert.ok(a.axes.find(x=>x.key==='control').value>0);
assert.ok(a.axes.find(x=>x.key==='mobility').value>0);
assert.ok(a.axes.find(x=>x.key==='defense').value>0);
assert.equal(skillRecords(hero).length,3);
const gun={id:'FUTURE_WEAPON_42',data:{kind:'rocket',damage:62,blastRadius:175,speed:630,acceleration:120}};
const b=weaponProfile(gun);
assert.equal(b.axes.length,5);
assert.ok(b.axes.find(x=>x.key==='damage').value>0);
assert.ok(b.axes.find(x=>x.key==='reach').value>0);
assert.deepEqual(heroProfile(hero),a);
assert.deepEqual(weaponProfile(gun),b);
assert.notDeepEqual(a.axes.map(x=>x.value),heroProfile({skills:{PASSIVE:fixtureSkill('PASSIVE','future_armor',{duration:5})}}).axes.map(x=>x.value));
for (const axis of [...a.axes,...b.axes]) assert.ok(axis.value>=0&&axis.value<=100);
console.log('C04 profile extension fixture PASS · hero 7 + weapon 42 · no ID-specific UI changes');
