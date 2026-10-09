import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root={};for(const p of ['../public/game/quest/questBreachWavesCore.js',
'../public/game/quest/questBreachRetreatAuthority.js'])
vm.runInNewContext(fs.readFileSync(new URL(p,import.meta.url),'utf8'),
 {window:root,Number,Math,Object,Array,Set,Map});
const P=root.APEX_QUEST_BREACH_POLICY,C=root.APEX_QUEST_BREACH_RETREAT.create;
const source=fs.readFileSync(new URL('../public/apexEngine.js',import.meta.url),'utf8');
assert.ok(source.includes("typeof this.__apexQuestBeforeAcceptedDamage === 'function'")&&
 source.includes("typeof this.__apexQuestAfterAcceptedDamage === 'function'"));
let tested=0;const gate=(name,cond)=>{assert.ok(cond,name);tested++;console.log('PASS B6e '+name);};
const calls=[];
function ally(id,immunity=false){
 const a={questId:id,questTeam:'ALLY',hp:1000,maxHp:1000,
  data:{},damageTaken:0,immune:immunity};
 a.takeDamage=function(raw,source,label,statusDamage){
  if(this.immune)return; // ordinary native defense/early return.
  let accepted=raw*.65; // an adversarial native defense reduction BEFORE seam.
  if(this.__apexQuestBeforeAcceptedDamage)
    accepted=this.__apexQuestBeforeAcceptedDamage(accepted,source,label,statusDamage);
  if(!(accepted>0))return;
  const before=this.hp;
  this.hp=Math.max(0,this.hp-accepted);this.damageTaken+=accepted;
  this.__apexQuestAfterAcceptedDamage?.(before-this.hp,source,label,statusDamage);
  calls.push({raw,accepted,owner:this.questId});
 };
 return a;
}
const allies=P.ALLY_IDS.map(id=>ally(id)),events=[],session=C({policy:P,onRetreat:(f,receipt)=>events.push(receipt)});
gate('attach exactly 3 real native delegates',session.attach(allies).ok&&session.snapshot().attached===3);
const reaver={questId:'LV2_REAVER'};
allies[0].takeDamage(600,reaver,'melee');
gate('first hit keeps authentic defense at 65%',allies[0].hp===610&&events.length===0);
allies[0].takeDamage(1000,reaver,'melee');
gate('second post-mitigation hit reaches 100HP without resurrecting KO',
 allies[0].hp===100&&allies[0].damageTaken===900&&allies[0].withdrawn);
gate('damage beyond real accepted withdrawal point is not credited',
 calls.at(-1).accepted===510&&events.length===1&&events[0].unabsorbed===140);
allies[0].takeDamage(200,reaver,'extra');
gate('once withdrawn cannot lose any more HP or re-trigger event',
 allies[0].hp===100&&events.length===1);
gate('abilityRecipient respects physical voluntary withdrawal',
 P.abilityRecipient(allies)==='T.O.T');
allies[1].takeDamage(5000,reaver,'laser');
allies[2].takeDamage(5000,reaver,'laser');
gate('three threshold withdrawals are RETRY, not 0-HP fabricated death',
 allies.every(a=>a.hp===100&&a.withdrawn)&&P.abilityRecipient(allies)===null
 &&events.length===3);
const hostiles=P.resolveWave('A').hostiles.map(s=>({
 questId:s.id,questTeam:'HOSTILE',hp:s.hp,maxHp:s.hp}));
gate('wave RETRY authentic even with three living hostiles',
 P.waveOutcome([...allies,...hostiles],'A').status==='RETRY');
session.close();
gate('close disposes instance hooks and restores ordinary Fighter method',
 allies.every(a=>a.__apexQuestBeforeAcceptedDamage===undefined
 &&a.__apexQuestAfterAcceptedDamage===undefined)&&session.snapshot().attached===0);
const immune=P.ALLY_IDS.map(id=>ally(id)),protectedSession=C({policy:P});
immune[0].immune=true;protectedSession.attach(immune);
immune[0].takeDamage(9000,reaver,'immune');
gate('immune Fighter does not withdraw on an unaccepted raw attack',
 immune[0].hp===1000&&immune[0].withdrawn===false
 &&protectedSession.snapshot().events.length===0);
protectedSession.close();
console.log('B6e realized boundary '+tested+' PASS / 0 FAIL');
