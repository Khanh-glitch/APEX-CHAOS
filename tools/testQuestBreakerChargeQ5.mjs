// Q5w E05 validates real accepted-target-HP and cap-aware choreography;
 // no artificial combat hit is claimed by these pure tests.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const w={};vm.runInNewContext(fs.readFileSync(
  new URL('../public/game/quest/questMultiActorCore.js',import.meta.url),'utf8'),
  {window:w,Math,Number,Object,Array,Set});
const Q=w.APEX_QUEST_MULTI_ACTOR_CORE;let n=0;
const gate=(name,pass)=>{assert.ok(pass,name);n++;console.log('PASS E05 '+name);};
const a=Q.breakerChargeRoster().map((s,i)=>({...s,id:i+1,maxHp:s.hp,radius:75}));
gate('one NEWBOT and inert world target',a.length===2&&a[1].questTeam==='TARGET'&&a[1].maxHp===6000);
gate('target collider contract',Q.validateBreakerCharge(a).ok);
gate('no damage means zero charge',Q.breakerChargeProgress(a)===0);
a[1].hp=4500;
gate('real accepted 1500 damage reads 25%',Q.breakerAcceptedDamage(a)===1500&&Q.breakerChargeProgress(a)===.25);
gate('no timer-only completion',Q.breakerChargeOutcome(a,true).status==='ACTIVE');
a[1].hp=0;
gate('6000 without pulse does not save',Q.breakerChargeOutcome(a,false).status==='AWAIT_PULSE');
gate('6000 plus final physical phase completes',Q.breakerChargeOutcome(a,true).status==='COMPLETE');
const forged=Q.breakerChargeRoster().map((s,i)=>({...s,id:i+1,maxHp:s.hp,radius:75}));
forged[1].questWorldObject=false;
gate('reject fighter masquerading as world collider',!Q.validateBreakerCharge(forged).ok);
const sequence=Q.createBreakerChargeSequence();let requested=0;
const req=()=>{requested++;return requested===1?{id:1}:null};
sequence.tick(1,.25,req);
gate('25pct milestone without fake weapon',requested===0&&sequence.snapshot().milestones.length===1);
sequence.tick(2,.5,req);
gate('real 2.2s cadence after threshold',sequence.cadence(.50)===2.2&&sequence.snapshot().phase==='OVERDRIVE');
sequence.tick(3,.85,req);
sequence.tick(3.40,.85,req);
sequence.tick(3.75,1,req);
gate('3 real-cap requests at high charge',requested===3&&sequence.snapshot().requested===3);
gate('actual accepted vs suppressed receipts',sequence.snapshot().accepted===1&&sequence.snapshot().suppressed===2);
gate('no premature infrastructure pulse',sequence.snapshot().pulseObserved===false);
sequence.tick(5.1,1,req);
gate('pulse only after real completion hold',sequence.snapshot().pulseObserved&&sequence.snapshot().phase==='PULSE');
gate('milestones all reached once',sequence.snapshot().milestones.join('|')==='0.25|0.5|0.75|0.9|1');
sequence.close();sequence.tick(99,1,req);
gate('closing prevents new slot requests',requested===3&&sequence.snapshot().closed===true);
console.log('E05 charge pure: '+n+' PASS / 0 FAIL');
