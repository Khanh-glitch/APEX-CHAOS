// Q4A pure receipt law; real Arsenal projectile/Cast proof is a separate gate.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('public/game/quest/questReflexReceipts.js','utf8');
const win={};vm.runInNewContext(src,{window:win});
assert.equal(win.apexQuestReflexReceipts,'ready');
let actors=[
 {id:1,questId:'NEWBOT',questTeam:'ALLY',hp:1000,maxHp:1000},
 {id:2,questId:'T.O.T',questTeam:'HOSTILE',hp:1000,maxHp:1000}
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
g.close();check('teardown closes old session',!g.acceptCast(cast(16,'A2'))&&!g.acceptDamage(hit(n,t))&&g.snapshot().phase==='CLOSED');
actors=[{...n,id:1},{...t,id:1}];const invalid=make();check('duplicate fighter ids fail closed',invalid.snapshot().active===false&&!invalid.acceptDamage(hit(n,t)));
console.log('Q4A pure REFLEX receipt checks '+count+'/'+count+' PASS');
