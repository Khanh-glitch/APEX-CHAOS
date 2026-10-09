import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const win={};
vm.runInNewContext(fs.readFileSync(new URL('../public/game/quest/questBreachWavesCore.js',import.meta.url),'utf8'),{window:win,Number,Array,Object,Set,Map});
const Q=win.APEX_QUEST_BREACH_POLICY;
let tested=0;
const gate=(msg,ok)=>{assert.ok(ok,msg);tested++;console.log('PASS B6d '+msg);};
function actor(s){return {questId:s.id,questTeam:'HOSTILE',hp:s.hp,maxHp:s.hp,x:400,withdrawn:false}}
const allies=Q.ALLY_IDS.map(id=>({questId:id,questTeam:'ALLY',hp:1000,maxHp:1000,withdrawn:false,gun:{id:'PISTOL'},cooldown:7}));
const mkRoster=wave=>[...allies,...Q.resolveWave(wave).hostiles.map(actor)];
const controller=Q.createWaveLifecycle(),first=mkRoster('A');
gate('starts exact A, not B or C',controller.snapshot().wave==='A'&&controller.snapshot().phase==='ACTIVE');
gate('no time-only wave completion',controller.observe(first).status==='ACTIVE');
first.slice(3).forEach(f=>f.hp=0);
gate('actual 3 zero-HP bodies issue real A receipt',
 controller.observe(first).status==='INTERLUDE'&&controller.snapshot().receipts[0].physicalKOs.length===3);
gate('cannot trigger A twice',controller.observe(first).status==='INTERLUDE'&&controller.snapshot().receipts.length===1);
gate('pre-interlude cannot spawn next wave',controller.prepareNext(first,actor).ok===false);
controller.tick(1);controller.tick(.8);
gate('1.8s interlude clock observed but does not alter allied HP or cooldown',
 controller.snapshot().holdElapsed>=1.8&&allies.every(a=>a.hp===1000&&a.cooldown===7&&a.gun.id==='PISTOL'));
const b=controller.prepareNext(first,actor);
gate('B physically authored with 4 enemies and same three Fighter objects',
 b.ok===true&&b.roster.length===7&&b.roster.slice(0,3).every((x,i)=>x===allies[i]));
gate('cannot duplicate pending hostiles',controller.prepareNext(first,actor).ok===false);
gate('reject uncommitted roster instead of skipping wave',
 controller.commitNext([...b.roster.slice(0,6)],b.ticket).ok===false);
gate('commit only exact actual new Fighter objects',
 controller.commitNext(b.roster,b.ticket).ok===true&&controller.snapshot().wave==='B');
gate('B includes different real movement/skill species',
 b.roster.slice(3).map(x=>x.questId).join('|')==='BREACH-B1|BREACH-B2|BREACH-B3|BREACH-B4');
allies[0].hp=120;allies[0].withdrawn=true;
gate('J/K recipient becomes T.O.T when NEWBOT withdrew',Q.abilityRecipient(allies)==='T.O.T');
b.roster.slice(3).forEach(x=>x.hp=0);
gate('B physical four-KO receipt is not full E06 completion',
 controller.observe(b.roster).status==='INTERLUDE'&&controller.snapshot().completed===2);
controller.tick(1.8);
allies[1].hp-=1;
const blocked=controller.prepareNext(b.roster,actor);
gate('B receipt rejects physical ally HP changes during the interlude',
 blocked.ok===false&&blocked.reason==='ally-HP-or-withdrawal-changed-in-interlude');
allies[1].hp+=1;
const poisoned=controller.prepareNext(b.roster,actor);
gate('B accepts correctly preserved ally HP once restored',poisoned.ok===true);
gate('prepare C retains withdrawn NEWBOT physically and faithfully',
 poisoned.roster[0]===allies[0]&&poisoned.roster[0].withdrawn===true);
gate('C commit needs actual physical roster reference',controller.commitNext(poisoned.roster,poisoned.ticket).ok);
poisoned.roster.slice(3).forEach(x=>x.hp=0);
gate('final three real C KOs complete exactly at third receipt',
 controller.observe(poisoned.roster).status==='COMPLETE'&&controller.snapshot().completed===3);
gate('no fourth stage/duplicate reward possible',controller.observe(poisoned.roster).status==='COMPLETE'&&Q.resolveWave('D')===null);
controller.close();
gate('close disposes pending transition state',controller.snapshot().closed&&controller.prepareNext(poisoned.roster,actor).ok===false);
const retry=Q.createWaveLifecycle(),r=mkRoster('A');
for(const a of allies)a.withdrawn=true;
gate('3 real withdrawals require RETRY even with hostiles alive',retry.observe(r).status==='RETRY');
console.log('B6d stage controller '+tested+' PASS / 0 FAIL');
