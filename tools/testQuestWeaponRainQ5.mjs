// E04 independent phase and roster law. No authored KO or fake active gun.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root={};vm.runInNewContext(fs.readFileSync(
  new URL('../public/game/quest/questMultiActorCore.js',import.meta.url),'utf8'),
  {window:root,console,Math,Number,Object,Array,Set});
const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
let n=0;const gate=(name,ok)=>{assert.ok(ok,name);n++;console.log('PASS E04 '+name);};
const f=Q.weaponRainRoster().map((x,i)=>({...x,id:i+1,maxHp:x.hp,radius:75}));
gate('native exact 1v2 HP',f.length===3&&f[0].maxHp===1000&&f[1].maxHp===180&&f[2].maxHp===160);
gate('roster validation',Q.validateWeaponRain(f).ok);
gate('armed combat initial active',Q.weaponRainOutcome(f,false).status==='ACTIVE');
f.slice(1).forEach(x=>x.hp=0);
gate('defeated enemies alone cannot skip final rain',Q.weaponRainOutcome(f,false).status==='AWAIT_OBSERVATION');
gate('scene observation plus actual two KO completes',Q.weaponRainOutcome(f,true).status==='COMPLETE');
f[0].hp=0;
gate('NEWBOT real KO always retries',Q.weaponRainOutcome(f,true).status==='RETRY');
const seq=Q.createWeaponRainSequence(),asked=[];
const request=()=>{asked.push(asked.length);return asked.length===1?{id:1}:null};
seq.tick(0,request);
gate('3.0s first rain phase',seq.snapshot().phase==='DRIZZLE'&&seq.cadence()===3);
seq.tick(11,request);
gate('1.6s downpour phase',seq.snapshot().phase==='DOWNPOUR'&&seq.cadence()===1.6);
seq.tick(22,request);seq.tick(22.38,request);seq.tick(22.75,request);
gate('precisely three real spawn attempts',asked.length===3&&seq.snapshot().attempted===3);
gate('accepted/rejected separate with cap pressure',seq.snapshot().accepted===1&&seq.snapshot().rejected===2);
gate('no premature rain observation',!seq.snapshot().observed);
seq.tick(24.1,request);
gate('observation is earned after held cinematic beat',seq.snapshot().observed&&seq.snapshot().phase==='OBSERVED');
seq.tick(50,request);
gate('no fourth burst request',asked.length===3);
seq.close();seq.tick(80,request);
gate('closed sequencer cannot resurrect',seq.snapshot().closed&&asked.length===3);
console.log('E04 pure policy: '+n+' PASS / 0 FAIL');
