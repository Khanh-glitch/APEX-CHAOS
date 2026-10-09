// Q5 E03 pure authored wave contract (NOT a fabricated gameplay win).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root={};vm.runInNewContext(fs.readFileSync(
  new URL('../public/game/quest/questMultiActorCore.js',import.meta.url),'utf8'),
  {window:root,console,Math,Number,Object,Array,Set});
const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
const build=phase=>Q.scrapSwarmRoster(phase).map((s,i)=>({
  ...s,id:i+1,maxHp:s.hp,radius:75
}));
let passed=0;
const gate=(name,ok)=>{console.log((ok?'PASS':'FAIL')+' Q5 '+name);assert.ok(ok,name);passed++;};
const A=build('A'),B=build('B');
gate('exact two-wave counts',A.length===4&&B.length===5);
gate('exact HP and protagonist',A[0].maxHp===1000&&B[0].maxHp===1000
  &&A.slice(1).every(x=>x.maxHp===120)&&B.slice(1).every(x=>x.maxHp===90));
gate('single allied NEWBOT; no T.O.T in field',A.concat(B).filter(a=>a.questTeam==='ALLY').every(a=>a.questId==='NEWBOT'));
gate('wave A authored roster valid',Q.validateScrapSwarmWave(A,'A').ok);
gate('wave B authored roster valid',Q.validateScrapSwarmWave(B,'B').ok);
gate('initial A/B remain active',Q.scrapSwarmOutcome(A,'A').status==='ACTIVE'&&Q.scrapSwarmOutcome(B,'B').status==='ACTIVE');
A.slice(1,3).forEach(a=>a.hp=0);
gate('partial A cannot start B',Q.scrapSwarmOutcome(A,'A').status==='ACTIVE');
A[3].hp=0;
gate('real wave A KO requests next wave only',Q.scrapSwarmOutcome(A,'A').status==='NEXT_WAVE');
gate('cannot misclassify A as final',Q.scrapSwarmOutcome(A,'A').status!=='COMPLETE');
B.slice(1).forEach(a=>a.hp=0);
gate('wave B all KO permits COMPLETE',Q.scrapSwarmOutcome(B,'B').status==='COMPLETE');
B[0].hp=0;
gate('NEWBOT KO overrides all hostile KO',Q.scrapSwarmOutcome(B,'B').status==='RETRY');
const swap=build('B');swap[1].questId='FAKE-SCRAP';
gate('invented wave B identity denied',!Q.validateScrapSwarmWave(swap,'B').ok);
const clone=build('A');clone[1].id=clone[0].id;
gate('duplicate physical body denied',!Q.validateScrapSwarmWave(clone,'A').ok);
const tamper=build('A');tamper[1].maxHp=999;
gate('wrong enemy max HP denied',!Q.validateScrapSwarmWave(tamper,'A').ok);
const original=Q.scrapSwarmRoster('B');original[1].hp=1;
gate('roster specs not mutated by caller',Q.scrapSwarmRoster('B')[1].hp===90);
gate('no third wave',Q.scrapSwarmRoster('C')===null);
gate('owner species motion law is invariant across waves',
  Q.enemySpecies('scout')?.speedFactor===1.2
  &&Q.enemySpecies('reaver')?.speedFactor===1.2
  &&Q.enemySpecies('sentinel')?.speedFactor===1
  &&!('enemySpeedFactor' in Q.SWARM_TUNING));
gate('E03 real pickup target and interlude defined centrally',
  Q.SWARM_TUNING.openingGun==='PISTOL'
  &&Q.SWARM_TUNING.openingGunAhead>0
  &&Q.SWARM_TUNING.interludeSeconds>=1.5);
console.log('Q5 E03 pure contract: '+passed+' PASS / 0 FAIL');
