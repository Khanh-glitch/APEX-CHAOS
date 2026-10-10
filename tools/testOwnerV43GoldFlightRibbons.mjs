// Gold Lab canonical flight ribbons: Flare, Rocket, Crossbow, Steel Ball.
// Ref original owner HTML sha256 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// 12 exact Canvas2D traces emitted by Gold drawFlightTrails. No native baselines.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const key='function v43GoldRibbon(',start=src.indexOf(key);
assert.ok(start>=0,'Missing native Gold ribbon renderer');
let depth=0,end=-1;
for(let i=src.indexOf('{',start);i<src.length;i++){
 if(src[i]==='{')depth++;
 else if(src[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start);
const env=vm.createContext({Math,v43GoldBoomerangAirflow:()=>{throw Error('unexpected boomerang')},v43min:(v,a,b)=>Math.max(a,Math.min(b,v))});
vm.runInContext(src.slice(start,end)+'\nthis.draw=v43GoldRibbon;',env);
const reference={
 flare:[
  '8cfe580eb8d9dfcd735048d6b658e8f35a3546220a22fd1ee7bd994cbab243bc',
  '47a15bdd29252600beb42114e774d93ba0bada8d7f0bd9a0a665a02028e9b79f',
  '882cc36a333b813cb6f91ff23dd6bec6fe5b493cdc0b4029c6ca1a4fafec9fa6'],
 rocket:[
  '1cb7971976ee374570dd279388297bbc7a693221b1e507802eef3e48221a4f26',
  'c2534f1c93e35d56e406acfd34fd665911e1ffe351b0b8460d2fa6298fcd2fe2',
  '264b334bd35325470b0caea2f9a3581b2a0cc4805cf3a522537499b4cc293216'],
 bolt:[
  '55188b12fd176c5bbabc0055abbf165791e24981a8bc72eecfeeb0b5d5055cc9',
  'fc5f30d223f487e7393d77dbaab8905558bcfcaf6f91106e1ce64a10d68c3c34',
  '496e82670f276615e5ceb53a95c3d28f7dfd44d9fe90d453e635513a26c2d078'],
 ball:[
  'b8eec4f71704e2eabca19da3dd32e9f73c48c72cc295411ce3d88527a4d82054',
  'b2f741961cffdb38f17c72b9192c93b07eb931911c2c181292418e08300b4797',
  '5c8f3b072018e1e1e9b916ad5c015897993746334deb9572c1ea9069439a1e2b'],
};
function canvas(){
 const ops=[],norm=v=>typeof v==='number'?Math.round(v*1e5)/1e5:v;
 const methods=['save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke'];
 const target={};for(const k of methods)target[k]=(...a)=>ops.push([k,...a.map(norm)]);
 const ctx=new Proxy(target,{set(o,k,v){
  ops.push(['set',String(k),norm(v)]);o[k]=v;return true;
 }});
 return {ops,ctx};
}
for(const [kind,hashes] of Object.entries(reference)){
 for(let scenario=0;scenario<3;scenario++){
  const q=Array.from({length:scenario===0?6:scenario===1?10:14},(_,i)=>({
   x:210+i*(8+scenario*2.4),
   y:300+Math.sin(i*.31+scenario)*16+scenario*40,t:.03*i,
  }));
  const {ctx,ops}=canvas();
  env.draw(ctx,{kind,weapon:kind.toUpperCase(),visual:q},1);
  const size=54+scenario*24;
  assert.equal(ops.length,size,'Original Gold path command count '+kind+'/'+scenario);
  const digest=createHash('sha256').update(JSON.stringify(ops)).digest('hex');
  assert.equal(digest,hashes[scenario],'Gold flight ribbon regression '+kind+'/'+scenario);
  console.log('PASS Gold flight ribbon',kind,scenario,digest.slice(0,12));
 }
}
console.log('PASS GOLD RIBBON: 12 exact original flight-path draw-command traces');
