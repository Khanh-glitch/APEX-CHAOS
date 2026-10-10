// Owner Gold V4.3 plasma transport: exact three-layer energy ribbon commands.
// Original owner offline Lab SHA256:
// 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// Gold drawPremiumLayer emits these 29 Canvas commands for one plasmaCore
// when no other FX exist. Match colors, positions, wiggle, thickness and alpha.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const name='function v43GoldPlasmaTrail(',start=src.indexOf(name);
assert.ok(start>=0,'Native Gold plasma ribbons missing');
let depth=0,last=-1;
for(let i=src.indexOf('{',start);i<src.length;i++){
 if(src[i]==='{')depth++;
 else if(src[i]==='}'&&--depth===0){last=i+1;break;}
}
assert.ok(last>start);
const env=vm.createContext({Math});
vm.runInContext(src.slice(start,last)+'\nthis.draw=v43GoldPlasmaTrail;',env);
function capture(){
 const ops=[],norm=n=>typeof n==='number'?Math.round(n*1e5)/1e5:n;
 const impl={};
 for(const key of ['save','restore','translate','rotate','beginPath',
  'moveTo','quadraticCurveTo','stroke'])impl[key]=(...a)=>ops.push([key,...a.map(norm)]);
 const ctx=new Proxy(impl,{set(o,k,v){
  ops.push(['set',String(k),norm(v)]);o[k]=v;return true;
 }});
 return {ops,ctx};
}
const refs=[
 {name:'spark-open',age:.13,x:235,y:220,vx:470,vy:90,
  sha:'3b2ea5489464d11137f3cf382bf89b32da043a28acba9cd54d17911b003eba5a'},
 {name:'core-mid',age:.46,x:360,y:290,vx:200,vy:-165,
  sha:'ccb17b32f09cb913c4726121a209f697e176d0994ee11f73f795cb70c3082a3d'},
 {name:'split-late',age:1.44,x:700,y:486,vx:-300,vy:150,
  sha:'c846d3663803b0abb288000a7e0a960c691a0d6f254a25681c75a14acb80b907'},
];
for(const v of refs){
 const {ops,ctx}=capture();
 env.draw(ctx,v,1);
 assert.equal(ops.length,29,'Gold plasma has precisely 3 ribbons: '+v.name);
 const digest=createHash('sha256').update(JSON.stringify(ops)).digest('hex');
 assert.equal(digest,v.sha,'GOLD plasma transport mismatch: '+v.name);
 console.log('PASS GOLD plasma three-layer tail',v.name,digest.slice(0,14));
}
console.log('PASS GOLD PLASMA TRANSPORT 3/3: 29 Canvas commands per phase');
