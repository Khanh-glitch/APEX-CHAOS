import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const window={};vm.runInNewContext(fs.readFileSync(
 new URL('../public/game/quest/questBreachWavesCore.js',import.meta.url),'utf8'),
 {window,Number,Array,Object,Set});
const Q=window.APEX_QUEST_BREACH_POLICY;
let count=0;const gate=(name,condition)=>{assert.ok(condition,name);count++;console.log('PASS Q6 '+name)};
const ally=id=>({questId:id,questTeam:'ALLY',hp:1000,maxHp:1000,withdrawn:false});
const roster=wave=>[
 ...Q.ALLY_IDS.map(ally),
 ...Q.resolveWave(wave).hostiles.map(s=>({questId:s.id,questTeam:'HOSTILE',
  hp:s.hp,maxHp:s.hp,withdrawn:false}))
];
const a=roster('A'),b=roster('B'),c=roster('C');
gate('canon A/B/C 3 4 3 chassis',a.length===6&&b.length===7&&c.length===6);
gate('HP A300 B260 C320',a.slice(3).every(x=>x.maxHp===300)
 &&b.slice(3).every(x=>x.maxHp===260)&&c.slice(3).every(x=>x.maxHp===320));
gate('cadences 4.5 3.5 3 and two C burst requests',
 Q.resolveWave('A').cadence===4.5&&Q.resolveWave('B').cadence===3.5
 &&Q.resolveWave('C').cadence===3&&Q.resolveWave('C').burst===2);
gate('NEWBOT gets first available J/K',Q.abilityRecipient(a)==='NEWBOT');
a[0].hp=100;
gate('retreat command is read-only physical request',
 Q.incomingRetreat(a).commands.map(x=>x.id).join('|')==='NEWBOT'
 &&a[0].hp===100&&a[0].withdrawn===false);
a[0].withdrawn=true;
gate('J/K only passes to T.O.T',Q.abilityRecipient(a)==='T.O.T');
a[1].withdrawn=true;
gate('J/K passes to RIVET if T.O.T withdraws',Q.abilityRecipient(a)==='RIVET');
gate('one living ally keeps E06 alive',Q.waveOutcome(a,'A').status==='ACTIVE');
a[2].withdrawn=true;
gate('three actual withdrawals mean RETRY',Q.waveOutcome(a,'A').status==='RETRY');
gate('no J/K owner if all withdrawn',Q.abilityRecipient(a)===null);
b.slice(3).forEach(x=>x.hp=0);
gate('real 4 hostile KOs require NEXT_WAVE not COMPLETE',Q.waveOutcome(b,'B').status==='NEXT_WAVE');
c.slice(3).forEach(x=>x.hp=0);
gate('final wave KOs allow COMPLETE',Q.waveOutcome(c,'C').status==='COMPLETE');
c[0].hp=0;
gate('accidental combat KO cannot masquerade as retreat',Q.waveOutcome(c,'C').status==='INVALID');
gate('offensive cap5 suppresses overflow',
 Q.eligibleOffensiveRequests(4,2).accepted===1
 &&Q.eligibleOffensiveRequests(4,2).suppressed===1);
gate('immutable authored rigs remain blocked',Q.integrationAuthority().ready===false
 &&Q.integrationAuthority().blocker.includes('X-01'));
gate('no fourth wave',Q.resolveWave('D')===null);
console.log('Q6 BREACH policy '+count+' PASS / 0 FAIL');
