// Q4A pure receipt law; real Arsenal projectile/Cast proof is a separate gate.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('public/game/quest/questReflexReceipts.js','utf8');
const win={};vm.runInNewContext(src,{window:win});
assert.equal(win.apexQuestReflexReceipts,'ready');
let actors=[
 {id:1,questId:'NEWBOT',questTeam:'ALLY',hp:1000,maxHp:1000,x:210,y:340},
 {id:2,questId:'T.O.T',questTeam:'HOSTILE',hp:1000,maxHp:1000,x:775,y:665}
];
const make=()=>win.APEX_QUEST_REFLEX_RECEIPTS.create(()=>actors);
const g=make(),[n,t]=actors;
const hit=(a,v,label='arsenal-pistol',amount=20)=>({attacker:a,victim:v,label,amount,statusDamage:false});
const cast=(seq,slot,id=n.id,type='Cast')=>({type,seq,payload:{hero:'ROBOT',side:'p1',fighterId:id,slot}});
let count=0;const check=(name,pass)=>{assert.ok(pass,name);count++;console.log('PASS Q4A '+name)};
check('no fake J/K keydowns',!g.acceptCast({type:'keydown',seq:1,payload:{slot:'A1'}})&&g.snapshot().phase==='R1_PISTOL');
check('wrong source, weapon or status cannot satisfy R1',!g.acceptDamage(hit(t,n))&&!g.acceptDamage(hit(n,t,'burn'))&&!g.acceptDamage({...hit(n,t),statusDamage:true})&&g.snapshot().receipts.length===0);
check('real positive pistol R1',g.acceptDamage(hit(n,t))&&g.snapshot().phase==='R2_PISTOL');
check('R2 requires reverse physical direction',!g.acceptDamage(hit(n,t))&&g.acceptDamage(hit(t,n))&&g.snapshot().phase==='J_CAST');
check('K early rejected',!g.acceptCast(cast(10,'A2'))&&g.snapshot().phase==='J_CAST');
check('non Cast or wrong Fighter rejected',!g.acceptCast(cast(11,'A1',2))&&!g.acceptCast(cast(12,'A1',1,'AbilityPress')));
check('accepted NEWBOT A1 then A2 only',g.acceptCast(cast(13,'A1'))&&g.acceptCast(cast(14,'A2'))&&g.snapshot().phase==='BOTH_HALF');
check('HP comes from real actor objects not reported UI numbers',!g.snapshot().awaitingRivet&&g.snapshot().complete===false);
n.hp=510;t.hp=450;g.poll();check('both HP <=500 mandatory',g.snapshot().phase==='BOTH_HALF');
n.hp=500;g.poll();check('threshold leads only to RIVET hold',g.snapshot().phase==='AWAIT_RIVET'&&g.snapshot().complete===false);
check('cannot fabricate end with more casts or damage',!g.acceptCast(cast(15,'A1'))&&!g.acceptDamage(hit(n,t))&&!g.snapshot().storyProgress);
// Q4D pure negative-law acceptance. Proof is compiled from original gate
// receipt order + real Arsenal rig metadata, never by an unsafe save API.
const hold={phase:'AWAIT_RIVET',at:72,hp:[{id:'NEWBOT',hp:500},{id:'T.O.T',hp:450}]};
const b={kind:'aq_thrown',weapon:'STORMBREAKER',owner:'RIVET',x:500,y:78.24,vx:0,vy:1350};
const rig={authority:'ARSENAL_STORMBREAKER_EQUIP_PREVIEW',phase:'SETTLED',settled:true,
  sawFlight:true,peakFlight:1,storyComplete:false,birth:b,
  freeze:{time:72,hp:actors.map(a=>[a.questId,a.hp]),
    pos:actors.map(a=>[a.questId,a.x,a.y]),slots:[]},
  getSlots:()=>[]};
const proof=({projectiles=[],over=null,rigValue=rig,time=72,actorValue=actors,holdValue=hold}={})=>
  win.APEX_QUEST_REFLEX_RECEIPTS.technicalHandoff({
    gate:g,hold:holdValue,rig:rigValue,actors:actorValue,projectiles,time,over});
check('Q4D exact settled rig/receipts yields technical-only signal',
  proof().ready===true&&proof().checkpointAuthorized===false&&proof().storyComplete===false);
check('Q4D real flight mandatory; must not certify READY rig',
  proof({rigValue:{...rig,phase:'READY'}}).ready===false);
check('Q4D no fabricated Story completion, no duplicate projected projectile',
  proof({rigValue:{...rig,storyComplete:true}}).ready===false
  &&proof({projectiles:[{weapon:'STORMBREAKER'}]}).ready===false);
check('Q4D reject forged weapon owner, missing birth and double release',
  proof({rigValue:{...rig,birth:{...b,owner:'T.O.T'}}}).ready===false
  &&proof({rigValue:{...rig,birth:null}}).ready===false
  &&proof({rigValue:{...rig,peakFlight:2}}).ready===false);
check('Q4D reject hp, slot, position and clock changes',
  (()=>{
    const hp=n.hp;n.hp=499;const noHp=proof().ready===false;n.hp=hp;
    const x=n.x;n.x=x+1;const noPosition=proof().ready===false;n.x=x;
    return noHp&&noPosition&&proof({time:73}).ready===false
      &&proof({rigValue:{...rig,getSlots:()=>[{id:1,phase:'REVEALED'}]}}).ready===false;
  })());
check('Q4D stale/closed E01 gate cannot produce proof after exit',
  proof({over:'QUEST_TEST_COMPLETE'}).ready===false);
g.close();check('teardown closes old session',!g.acceptCast(cast(16,'A2'))&&!g.acceptDamage(hit(n,t))&&g.snapshot().phase==='CLOSED');
check('Q4D closed gate refuses previously valid technical preview',
  proof().ready===false);
actors=[{...n,id:1},{...t,id:1}];const invalid=make();check('duplicate fighter ids fail closed',invalid.snapshot().active===false&&!invalid.acceptDamage(hit(n,t)));
console.log('Q4A pure REFLEX receipt checks '+count+'/'+count+' PASS');
