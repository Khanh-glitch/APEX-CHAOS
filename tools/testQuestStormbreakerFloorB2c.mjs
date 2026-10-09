import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const w={};vm.runInNewContext(fs.readFileSync(
 new URL('../public/game/quest/questReflexReceipts.js',import.meta.url),'utf8'),
 {window:w,Number,Math,JSON,Object,Array});
const proof=w.APEX_QUEST_REFLEX_RECEIPTS.technicalHandoff;
const actors=[
 {id:1,questId:'NEWBOT',questTeam:'ALLY',hp:480,x:230,y:500},
 {id:2,questId:'T.O.T',questTeam:'HOSTILE',hp:430,x:770,y:500}
];
const snap={
 active:true,phase:'AWAIT_RIVET',awaitingRivet:true,complete:false,storyProgress:false,
 hp:{newbot:480,tot:430},
 receipts:[
  {kind:'PISTOL_HIT',from:'NEWBOT',to:'T.O.T'},
  {kind:'PISTOL_HIT',from:'T.O.T',to:'NEWBOT'},
  {kind:'CAST',slot:'A1',seq:8},
  {kind:'CAST',slot:'A2',seq:9}
 ]
};
const slot={id:41,phase:'REVEALED',weaponId:'STORMBREAKER',
 questNarrativeOnly:true,questStage:'E01_GROUND_SUPPRESSION',tier:'T6',x:500,y:500};
const rig={
 authority:'ARSENAL_STORMBREAKER_FLOOR_MANIFEST',phase:'SETTLED',
 settled:true,elapsed:3.05,electricFrames:18,peakBolts:6,
 storyComplete:false,slotId:41,aimPoint:{x:500,y:500},
 groundImpact:{kind:'REAL_ARSENAL_FLOOR_SPAWN',x:500,y:500,slotId:41},
 freeze:{time:21,hp:actors.map(f=>[f.questId,f.hp]),
         pos:actors.map(f=>[f.questId,f.x,f.y]),slots:[[4,'REMOVED']]},
 getSlots:()=>[slot]
};
const state={gate:{snapshot:()=>snap},hold:{phase:'AWAIT_RIVET',
 hp:actors.map(f=>({id:f.questId,hp:f.hp})),at:21},
 rig,actors,projectiles:[],time:21,over:null};
let n=0;const gate=(title,result)=>{assert.ok(result,title);n++;console.log('PASS B2c '+title)};
gate('real manifested Gold floor object after 3s electricity is accepted',
 proof(state).ready===true&&proof(state).groundImpact?.kind==='REAL_ARSENAL_FLOOR_SPAWN');
gate('no authored save or synthetic story credit is possible',
 proof(state).checkpointAuthorized===false&&proof(state).storyComplete===false);
rig.phase='FLOOR_CHARGING';
gate('cannot accept before electric scene settles',!proof(state).ready);
rig.phase='SETTLED';rig.elapsed=2.99;
gate('cannot accept before three seconds',!proof(state).ready);
rig.elapsed=3.05;rig.electricFrames=0;
gate('cannot accept without live Gold bolt frames',!proof(state).ready);
rig.electricFrames=18;rig.peakBolts=0;
gate('cannot accept without real Gold lightning bolts',!proof(state).ready);
rig.peakBolts=6;slot.questNarrativeOnly=false;
gate('ordinary obtainable T6 weapon cannot masquerade as narrative',!proof(state).ready);
slot.questNarrativeOnly=true;slot.weaponId='PISTOL';
gate('T1 ordinary pistol cannot be accepted as story Stormbreaker',!proof(state).ready);
slot.weaponId='STORMBREAKER';rig.groundImpact.kind='REAL_ARSENAL_FLOOR_CONTACT';
gate('old thrown/impact receipt explicitly rejected',!proof(state).ready);
rig.groundImpact.kind='REAL_ARSENAL_FLOOR_SPAWN';state.projectiles=[{type:'aq_thrown'}];
gate('unresolved Arsenal projectiles deny safe cinematic',!proof(state).ready);
state.projectiles=[];actors[0].hp=0;
gate('real NEWBOT death still blocks technical proof',!proof(state).ready);
actors[0].hp=480;slot.x=700;
gate('floor spawn must be physically centered between live bodies',!proof(state).ready);
slot.x=500;state.hold.at=22;
gate('fight state clock drifting during hold invalidates scene',!proof(state).ready);
state.hold.at=21;state.gate.snapshot=()=>({...snap,receipts:[...snap.receipts.slice(0,3)]});
gate('missing actual cast proof invalidates scene',!proof(state).ready);
console.log('B2c narrative floor acceptance '+n+' PASS / 0 FAIL');
