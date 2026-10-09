import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const win={};
vm.runInNewContext(fs.readFileSync(
  new URL('../public/game/quest/questTotLastChoiceAuthority.js',import.meta.url),
  'utf8'),{window:win,Math,Number,Object,Set});
const Q=win.APEX_QUEST_TOT_LAST_CHOICE;
let count=0;
const pass=(name,cond)=>{assert.ok(cond,name);count++;console.log('PASS B8a '+name);};
const h={questId:'NEWBOT',questTeam:'ALLY',hp:1000,maxHp:1000};
const t={questId:'T.O.T',questTeam:'HOSTILE',hp:1000,maxHp:1000,
  takeDamage(amount){this.hp=Math.max(0,this.hp-amount)}};
const cues=[];
const verified=new Set();
const a=Q.create({onCue:c=>cues.push(c),verifyNativeStorm:r=>
  verified.has(r.artifactId+'|'+r.event)});
pass('reject premature forged Stormbreaker',!a.physicalStorm({
  artifactId:'s1',weaponId:'STORMBREAKER',ownerQuestId:'T.O.T',event:'SPAWN'}).ok);
pass('requires visibly repaired exact 1000HP participants',a.start(h,t).ok);
const hit=damage=>{
 const before=a.beforeAccepted(t,damage);
 if(!before.ok||before.allowed<=0)return before;
 t.takeDamage(before.allowed);
 return a.afterAccepted(t,before.allowed);
};
pass('700 milestone cannot be skipped by a heavy hit',
 hit(900).ok&&t.hp===700&&a.snapshot().phase===Q.PHASE.ELIGIBLE
 &&cues.length===1&&cues[0].cue==='E08_STORMBREAKER_ELIGIBLE');
pass('all combat HP loss locked while native artifact has not resolved',
 a.beforeAccepted(t,1000).allowed===0&&t.hp===700);
const claim={artifactId:'s1',weaponId:'STORMBREAKER',ownerQuestId:'T.O.T'};
pass('nonexistent visual object cannot be claimed',
 !a.physicalStorm({...claim,event:'SPAWN'}).ok);
verified.add('s1|SPAWN');
pass('native verified Stormbreaker appears exactly once',
 a.physicalStorm({...claim,event:'SPAWN'}).ok
 &&!a.physicalStorm({...claim,event:'SPAWN'}).ok);
verified.add('s1|PICKUP');
pass('only legitimate T.O.T pickup may arm the unique Stormbreaker',
 !a.physicalStorm({...claim,event:'PICKUP',ownerQuestId:'NEWBOT'}).ok
 &&a.physicalStorm({...claim,event:'PICKUP'}).ok);
verified.add('s1|RESOLVED');
pass('not a return until actual native projectile has settled',
 !a.physicalStorm({...claim,event:'RESOLVED',resolution:'HIT'}).ok);
pass('one physical shot resolution returns cradle and unlocks normal pool',
 a.physicalStorm({...claim,event:'RESOLVED',resolution:'HIT',
 returnedToCradle:true}).ok&&a.snapshot().phase===Q.PHASE.FINAL);
pass('no second Stormbreaker after resolved one',
 !a.physicalStorm({...claim,event:'SPAWN'}).ok
 &&a.snapshot().stormReceipts.length===3);
pass('real accepted damage drives last 120HP safe stop',
 hit(800).ok&&t.hp===120&&a.snapshot().combatStopped
 &&cues.map(x=>x.cue).join('|')===
 'E08_STORMBREAKER_ELIGIBLE|E08_TOT_NONLETHAL_CHOICE');
pass('further combat damage cannot KO or shut down T.O.T',
 a.beforeAccepted(t,100000).allowed===0&&t.hp===120
 &&a.snapshot().mayCompleteStory===false);
pass('exact 446-hit/2s stun/1350 speed Stormbreaker canon is immutable',
 Q.STORM.onHitDamage===446&&Q.STORM.stunSeconds===2
 &&Q.STORM.speed===1350&&Q.STORM.homingRadiansPerSecond===2.6
 &&Q.STORM.missDeadlineSeconds===2.2
 &&Q.STORM.groundDamage===0&&Q.STORM.groundStunSeconds===1);
a.close();
pass('closed timeline rejects all future physical Storm events',
 !a.physicalStorm({...claim,event:'RESOLVED',resolution:'HIT',
 returnedToCradle:true}).ok&&!a.snapshot().active);
console.log('B8a T.O.T pure nonlethal contract '+count+' PASS / 0 FAIL');
