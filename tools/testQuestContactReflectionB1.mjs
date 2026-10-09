import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../public/apexEngine.js',import.meta.url),'utf8');
const primitive=source.slice(source.indexOf('function norm('),source.indexOf('function distToSegment('));
const impl=source.slice(source.indexOf('function handleQuestCollisions('),source.indexOf('function handleCollisions(dt)'));
assert.ok(primitive.includes('function reflectDir(')&&impl.includes('function handleQuestCollisions('));
const context={window:{},Math,Number,Set};
vm.runInNewContext(primitive+'\n'+impl+'\nwindow.resolve=handleQuestCollisions;',context);
const resolve=context.window.resolve;
let n=0;
const gate=(name,v)=>{assert.ok(v,name);console.log('PASS B1 '+name);n++};
const hits=[];
const mk=(id,team,x,dir)=>({
  id,questId:id,questTeam:team,x,y:500,radius:70,hp:1000,
  dir:{x:dir,y:0},type:{onCollide:(self,other)=>hits.push(self.id+':'+other.id)},
  hasStatus:()=>false,data:{}
});
const a=mk('NEWBOT','ALLY',400,1),b=mk('SCOUT','HOSTILE',490,-1);
const seen=[],s={activePairs:new Set(),onEnter:()=>seen.push('contact')};
const one=resolve(.05,[a,b],s);
gate('same Free Battle reflectDir reverses both actors',one.resolved===1
  &&a.dir.x<0&&b.dir.x>0&&b.x-a.x>=140);
gate('first hostile contact has two authentic onCollide callbacks and one enter',
  hits.length===2&&seen.length===1);
a.x=400;b.x=490;a.dir={x:1,y:0};b.dir={x:-1,y:0};
resolve(.05,[a,b],s);
gate('continuous overlap does not invent second new-contact event',seen.length===1);
a.x=200;b.x=800;resolve(.05,[a,b],s);
a.x=400;b.x=490;a.dir={x:1,y:0};b.dir={x:-1,y:0};
resolve(.05,[a,b],s);
gate('real departure followed by contact is a NEW collision',seen.length===2);
const c=mk('ALLY2','ALLY',400,1),d=mk('ALLY3','ALLY',490,-1),h=hits.length;
resolve(.05,[c,d],{activePairs:new Set()});
gate('allies bounce with no hostile skill callback',c.dir.x<0&&d.dir.x>0&&hits.length===h);
const world=mk('OBJECT','TARGET',490,-1),hero=mk('HERO','ALLY',400,1);
world.questWorldObject=true;
resolve(.05,[hero,world],{activePairs:new Set()});
gate('fixed world prop does not collide as Fighter body',hero.x===400&&world.x===490);
const m=[mk('M1','ALLY',300,1),mk('M2','HOSTILE',360,-1),
  mk('M3','HOSTILE',430,-1),mk('M4','ALLY',485,1)];
const crowd=resolve(.05,m,{activePairs:new Set()});
gate('four-body contacts use normalized headings',crowd.resolved>=2&&
  m.every(f=>Math.abs(Math.hypot(f.dir.x,f.dir.y)-1)<1e-6));
console.log('B1 shared reflect: '+n+' PASS / 0 FAIL');
