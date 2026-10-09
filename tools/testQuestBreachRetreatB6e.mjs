import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const window={};
for(const p of ['../public/game/quest/questBreachWavesCore.js',
 '../public/game/quest/questBreachRetreatAuthority.js']){
 vm.runInNewContext(fs.readFileSync(new URL(p,import.meta.url),'utf8'),
  {window,Number,Math,Object,Array,Set,Map});
}
const policy=window.APEX_QUEST_BREACH_POLICY,create=window.APEX_QUEST_BREACH_RETREAT.create;
const events=[],session=create({policy,onRetreat:(f,e)=>events.push({f,e})});
const own=(id)=>({questId:id,questTeam:'ALLY',hp:1000,maxHp:1000,data:{},damageTaken:0,
 takeDamage(amount,source,label){this.hp=Math.max(0,this.hp-amount);this.damageTaken+=amount;
  this.last={amount,source,label};}});
const actors=policy.ALLY_IDS.map(own);
let total=0;const gate=(name,ok)=>{assert.ok(ok,name);total++;console.log('PASS B6e '+name);};
gate('E06 attach requires EXACT three 1000HP eligible Fighter delegates',
 session.attach(actors).ok===true&&session.snapshot().attached===3);
const attacker={questId:'LV2_REAVER'};
actors[0].takeDamage(700,attacker,'arsenal-pistol',false);
gate('genuine direct hit still uses unmodified delegate damage',
 actors[0].hp===300&&actors[0].damageTaken===700&&events.length===0);
actors[0].takeDamage(500,attacker,'reaver-contact',false);
gate('lethal overflow stops at truthful threshold before KO, never heals',
 actors[0].hp===100&&actors[0].damageTaken===900
 &&actors[0].last.amount===200&&actors[0].withdrawn===true);
gate('one observed NEWBOT retreat event carries source and overflow',
 events.length===1&&events[0].e.id==='NEWBOT'
 &&events[0].e.sourceId==='LV2_REAVER'
 &&events[0].e.unabsorbed===300);
actors[0].takeDamage(100,attacker,'extra-bullet',false);
gate('withdrawn actor cannot absorb further damage or duplicate a retreat',
 actors[0].hp===100&&events.length===1);
gate('control priority moves J/K to real T.O.T, not a fabricated copy',
 policy.abilityRecipient(actors)==='T.O.T');
actors[1].takeDamage(900,attacker,'laser',false);
gate('exact threshold causes actual T.O.T withdrawal',
 actors[1].hp===100&&actors[1].withdrawn&&events.length===2);
actors[2].takeDamage(1200,attacker,'laser',false);
gate('all three real withdrawals yield authentic RETRY policy',
 actors[2].hp===100&&actors[2].withdrawn
 &&policy.abilityRecipient(actors)===null&&events.length===3);
const dead=actors.map((a)=>({ ...a })),enemy=policy.resolveWave('A').hostiles.map(s=>({
 questId:s.id,questTeam:'HOSTILE',hp:s.hp,maxHp:s.hp}));
gate('wave predicate sees RETRY only when all allies physically withdrew',
 policy.waveOutcome([...actors,...enemy],'A').status==='RETRY');
session.close();
gate('lifecycle restores every original Fighter.takeDamage delegate',
 session.snapshot().attached===0&&session.snapshot().active===false);
const immunity=create({policy});
const fresh=policy.ALLY_IDS.map(own);
fresh[0].takeDamage=function(){};
gate('immune target is not falsely withdrawn by a rejected damage hit',
 immunity.attach(fresh).ok&& (fresh[0].takeDamage(2000,attacker,'immune'),fresh[0].hp===1000)
 &&fresh[0].withdrawn===false);
immunity.close();
console.log('B6e physical retreat authority '+total+' PASS / 0 FAIL');
