// Owner Gold V4.3 BLAST VFX: exact Canvas2D command-prefix snapshots.
// Reference: owner-supplied offline Gold Lab HTML, unmodified sha256
// 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// The real Gold drawBlast produces 270 commands (save/restore included).
// Native may add variant debris AFTER these 269 original commands, but may NOT
// omit or change the original 17 billows, flash, or five pressure arcs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const key='function v43GoldImpact(',start=src.indexOf(key);
assert.ok(start>=0,'Missing native blast renderer');
let depth=0,close=-1;
for(let i=src.indexOf('{',start);i<src.length;i++){
 if(src[i]==='{')depth++;
 else if(src[i]==='}'&&--depth===0){close=i+1;break;}
}
assert.ok(close>start,'Blast renderer has no closing brace');
const env=vm.createContext({Math,TAU:2*Math.PI,V43:{},
 v43min:(v,low,high)=>Math.max(low,Math.min(high,v))});
vm.runInContext(src.slice(start,close)+'\nthis.draw=v43GoldImpact;',env);
function contextTrace(){
 const trace=[],normalize=v=>typeof v==='number'?Math.round(v*1e5)/1e5:v;
 const grad={addColorStop:(at,color)=>trace.push(['stop',normalize(at),color])};
 const methods=['save','restore','beginPath','arc','fill','stroke','translate',
  'rotate','scale','moveTo','lineTo'];
 const target={createRadialGradient:(...p)=>(trace.push(['radial',...p.map(normalize)]),grad),
  createLinearGradient:(...p)=>(trace.push(['linear',...p.map(normalize)]),grad)};
 for(const k of methods)target[k]=(...p)=>trace.push([k,...p.map(normalize)]);
 const ctx=new Proxy(target,{set(o,k,v){
  trace.push(['set',String(k),normalize(v===grad?'gradient':v)]);o[k]=v;return true;
 }});
 return {trace,ctx};
}
const fixtures=[
 {name:'strike-first',age:.08,x:222,y:311,r:120,
  sha:'9aa97cb27470013d6aca699adb722f1abe814e3c8551a1e44edee84729459163'},
 {name:'smoke-roll',age:.45,x:550,y:485,r:155,
  sha:'38e157f9700d40bffa2f1be41e86401aea677380b727a9266c8681d159653503'},
 {name:'fade-late',age:.79,x:740,y:175,r:95,
  sha:'7b9873396c3ab3f681ad5b55c81d670588b5de8e36efa158d26f7addd4cd09fb'},
];
for(const item of fixtures){
 const {trace,ctx}=contextTrace();
 env.draw(ctx,{kind:'v43-blast',x:item.x,y:item.y,scale:item.r/120},1-item.age);
 // Exactly the first 269 Canvas2D commands of original Gold drawBlast.
 assert.ok(trace.length>=269,'Gold blast VFX commands incomplete: '+item.name);
 const nativeGold=trace.slice(0,269);
 const actual=createHash('sha256').update(JSON.stringify(nativeGold)).digest('hex');
 assert.equal(actual,item.sha,'Gold 17-billow blast + 5 pressure arcs diverged: '+item.name);
 console.log('PASS original Gold blast core',item.name,actual.slice(0,14));
}
console.log('PASS BLAST GOLD: original 269 Canvas2D commands at 3 phases; extra variant debris separate');
