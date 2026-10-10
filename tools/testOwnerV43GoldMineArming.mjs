// Owner Lab Gold armed-mine eight-spoke VFX, without rotating the world halo.
// Unmodified owner HTML sha256: 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// Three traces taken from Gold drawPremiumLayer with one armed mine.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const name='function v43GoldMineArming(',at=src.indexOf(name);
assert.ok(at>=0,'Missing Gold mine arming VFX');
let d=0,end=-1;for(let i=src.indexOf('{',at);i<src.length;i++){
 if(src[i]==='{')d++;
 else if(src[i]==='}'&&--d===0){end=i+1;break;}
}
assert.ok(end>at);
const env=vm.createContext({Math,TAU:2*Math.PI});
vm.runInContext(src.slice(at,end)+'\nthis.draw=v43GoldMineArming;',env);
function canvas(){
 const calls=[],norm=x=>typeof x==='number'?Math.round(x*1e5)/1e5:x;
 const c0={};
 for(const key of ['save','restore','translate','beginPath','moveTo','lineTo','stroke']){
  c0[key]=(...a)=>calls.push([key,...a.map(norm)]);
 }
 const c=new Proxy(c0,{set(o,k,v){
  calls.push(['set',String(k),norm(v)]);o[k]=v;return true;
 }});
 return {calls,c};
}
const fixtures=[
 {name:'arming-early',age:.14,x:270,y:330,
  sha:'a87ff4e3842d25a028d9afa88a890b0ee71e4cb75102a3d94d9cfbdb63e9e426'},
 {name:'armed-beat',age:.74,x:500,y:430,
  sha:'dc230028683511373752f76bffddd91b0114f52736ada4104c04bf063713500d'},
 {name:'armed-late',age:2.17,x:820,y:140,
  sha:'fd413cdf5f1293b49539d6ff37ba59f2b91d91a70985625ab7ce4c38821f69a1'},
];
for(const f of fixtures){
 const {calls,c}=canvas();env.draw(c,{x:f.x,y:f.y,age:f.age},1);
 assert.equal(calls.length,46,'Gold eight-spoke commands should not change: '+f.name);
 const digest=createHash('sha256').update(JSON.stringify(calls)).digest('hex');
 assert.equal(digest,f.sha,'Gold mine arming pulse visually regressed: '+f.name);
 console.log('PASS original Gold mine arming',f.name,digest.slice(0,14));
}
console.log('PASS GOLD MINE ARMED: 3/3 exact Canvas traces, world-space halo independent of sprite rotation');
