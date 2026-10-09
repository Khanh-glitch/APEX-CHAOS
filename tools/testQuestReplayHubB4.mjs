import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../public/game/quest/quest01Director.js',import.meta.url),'utf8');
const saved={
  schemaVersion:1,questId:'THE_ONES_THROWN_AWAY',
  contentRevision:'q1-director-20261008',
  checkpointId:'CHARGE_THE_BREAKER',encounterId:'E05',phaseId:'ENTRY',
  completedCueIds:['WAKE_OPEN','WORKSHOP_ARRIVAL','E02_FIRST_WAKE_ENTRY',
    'E02_FIRST_WAKE_CLEAR','E03_SCRAP_SWARM_CLEAR','E04_WEAPON_RAIN_CLEAR'],
  stormbreakerArtifactPhase:'SEALED',sessionId:'quest01-normal-session',
  updatedAt:100
};
let raw=JSON.stringify(saved),writes=0;
const storage={
 getItem:()=>raw,setItem:(_,v)=>{raw=v;writes++;}
};
const w={localStorage:storage};
vm.runInNewContext(source,{window:w,Date,Math,Number,Object,Array,Set,JSON});
const d=w.APEX_QUEST01_DIRECTOR;
let n=0;const gate=(label,test)=>{assert.ok(test,label);n++;console.log('PASS B4 '+label)};
gate('real save loads at E05',d.checkpoint().checkpointId==='CHARGE_THE_BREAKER');
const original=raw;
const e03=d.startReplay('SCRAP_SWARM');
gate('completed E03 opens a virtual Director only',
 e03.ok===true&&e03.ephemeral===true&&d.checkpoint().checkpointId==='SCRAP_SWARM'
 &&d.replayStatus().stageId==='SCRAP_SWARM');
gate('replay cannot modify serialized primary checkpoint',
 raw===original&&writes===0);
gate('cannot open future E06 or current incomplete E05',
 d.startReplay('BREACH_WAVES').ok===false
 &&d.startReplay('CHARGE_THE_BREAKER').ok===false);
gate('even replay cannot fake E03 combat completion without Arsenal receipts',
 d.acceptNativeBeat('E03_SCRAP_SWARM_CLEAR').ok===false);
const rev=d.beginOrResume();
gate('beginOrResume within replay remains in volatile session',
 rev.checkpointId==='SCRAP_SWARM'&&raw===original&&writes===0);
const e02=d.startReplay('FIRST_WAKE');
gate('completed E02 replay begins at WORKSHOP for native ENTRY law',
 e02.ok===true&&e02.entryId==='WORKSHOP'
 &&d.checkpoint().checkpointId==='WORKSHOP');
const e01=d.startReplay('REFLEX');
gate('E01 replay begins WAKE to reuse actual WAKE_OPEN proof',
 e01.ok===true&&e01.entryId==='WAKE'&&d.checkpoint().checkpointId==='WAKE');
gate('exiting replay restores original permanent checkpoint',
 d.exitReplay()===true&&d.checkpoint().checkpointId==='CHARGE_THE_BREAKER'
 &&d.replayStatus().active===false&&raw===original);
gate('replay cannot be started in the middle of live match',
 (()=>{w.APEX_ARSENAL={state:{active:true}};const out=d.startReplay('SCRAP_SWARM');
 return out.ok===false&&out.reason==='battle-already-active'
 &&d.checkpoint().checkpointId==='CHARGE_THE_BREAKER';})());
w.APEX_ARSENAL=null;
gate('no unauthorized replay of last locked mission',
 d.startReplay('RIVET_OVERRIDDEN').ok===false);
gate('no normal progression modified as side effect of replay tests',
 writes===0&&JSON.stringify(JSON.parse(raw))===JSON.stringify(saved));
console.log('B4 safe Quest hub '+n+' PASS / 0 FAIL');
