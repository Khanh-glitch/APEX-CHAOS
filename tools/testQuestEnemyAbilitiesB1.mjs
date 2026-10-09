import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root={};
for(const path of ['../public/game/quest/questMultiActorCore.js',
 '../public/game/quest/questEnemyAbilities.js']){
 const data=fs.readFileSync(new URL(path,import.meta.url),'utf8');
 vm.runInNewContext(data,{window:root,Math,Number,Object,Set,Map});
}
const Q=root.APEX_QUEST_MULTI_ACTOR_CORE,API=root.APEX_QUEST_ENEMY_ABILITIES;
let success=0;
const gate=(name,truth)=>{assert.ok(truth,name);success++;console.log('PASS B1 '+name)};
function f(id,team,x,y,species=null){
 const obj={questId:id,questTeam:team,questSpecies:species,x,y,radius:60,
  maxHp:1000,hp:1000,data:{},statuses:{},damageDone:0,
  hasStatus:(k)=>!!obj.statuses[k],
  applyStatus:(k,d)=>obj.statuses[k]=d,
  takeDamage:(amount,source,label)=>{obj.hp=Math.max(0,obj.hp-amount);obj.lastSource=source;obj.lastLabel=label;},
 };
 return obj;
}
const a=f('NEWBOT','ALLY',500,500),b=f('REAVER','HOSTILE',600,500,'reaver');
const ability=API.create({core:Q});
gate('Reaver true collision deducts exactly 50 real HP',ability.onContactEnter(a,b)===1&&a.hp===950&&a.lastSource===b&&a.lastLabel==='quest-reaver-contact');
gate('Reaver new physical contact has no time cooldown',ability.onContactEnter(a,b)===1&&a.hp===900);
const ally=f('ALLY','HOSTILE',550,500,'reaver');
gate('Reaver friendly bodies do not damage',ability.onContactEnter(b,ally)===0&&b.hp===1000);
const sent=f('SENTINEL','HOSTILE',250,500,'sentinel');
const victim=f('NEWBOT2','ALLY',800,500);
const duel=[sent,victim];
for(let i=0;i<19;i++)ability.tick(.05,duel);
gate('Sentinel telegraphs full 1s and locks movement without free damage',
 ability.snapshot().shots===0&&victim.hp===1000&&sent.data.positionLocked===true);
ability.tick(.1,duel);
gate('Sentinel fires only after charging',ability.snapshot().shots===1&&sent.data.positionLocked===false);
ability.tick(.2,duel);
gate('Sentinel laser uses real swept hit, 100 damage and 2s stun',
 victim.hp===900&&victim.lastLabel==='quest-sentinel-blue-laser'
 &&victim.statuses.stun===2&&ability.snapshot().hits===1);
const dodger=f('DODGER','ALLY',800,500),sent2=f('SENT2','HOSTILE',250,500,'sentinel');
const second=API.create({core:Q});
for(let i=0;i<21;i++)second.tick(.05,[sent2,dodger]);
dodger.y=950; // projectile remains on old straight heading, so can miss
second.tick(.2,[sent2,dodger]);
gate('laser misses if opponent moves off fired path; no invented stun',
 dodger.hp===1000&&!dodger.statuses.stun&&second.snapshot().hits===0);
sent.hp=0;ability.tick(.2,duel);
ability.close();second.close();
gate('encounter close and dead caster clear effects without changing HP',
 ability.snapshot().rays===0&&sent.data.questSentinelLock!==true);
console.log('B1 enemy ability '+success+' PASS / 0 FAIL');
