// Owner GOLD: exact 4-layer flame tongue Canvas VFX command trace.
// Reference original owner offline Lab HTML SHA256:
// 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// Gold's fireTongue(x,y,rotation,size,seed,life) also reads simTime;
// native uses explicit now. Match exactly after this mechanical time mapping.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const key='function v43GoldTongue(',a=src.indexOf(key);
assert.ok(a>=0,'Native flame layer missing');
let d=0,z=-1;
for(let i=src.indexOf('{',a);i<src.length;i++){
 if(src[i]==='{')d++;
 else if(src[i]==='}'&&--d===0){z=i+1;break;}
}
assert.ok(z>a,'Native flame source cannot be extracted');
const env=vm.createContext({Math});
vm.runInContext(src.slice(a,z)+'\nthis.draw=v43GoldTongue;',env);
function fakeCanvas(){
 const calls=[],norm=v=>typeof v==='number'?Math.round(v*1e5)/1e5:v;
 const o={};for(const k of ['save','restore','translate','rotate','beginPath',
  'moveTo','bezierCurveTo','closePath','fill']){
  o[k]=(...v)=>calls.push([k,...v.map(norm)]);
 }
 return {calls,c:new Proxy(o,{set(target,key,val){
  calls.push(['set',String(key),norm(val)]);target[key]=val;return true;
 }})};
}
const samples=[
 {name:'initial',now:.08,seed:.38,x:124,y:230,angle:-.15,size:19,life:.9,
  sha:'bff47a347b2d0ea93c4e2051b8dd74d9d11a915ab67443ae12b301eef0c1c67c'},
 {name:'sustained',now:.45,seed:3.2,x:220,y:350,angle:.92,size:12.5,life:.57,
  sha:'9ba05faedddec88dff57e22804d26ed125ea160d967c6a87ee55e91bc2034ffb'},
 {name:'late-embers',now:1.32,seed:21.3,x:470,y:260,angle:-1.5,size:26,life:.21,
  sha:'c0e3e4ab1c8a6e936df951d9d481e3f8b52704c3ba3d7f13b6242ecba3466199'},
];
for(const p of samples){
 const {calls,c}=fakeCanvas();
 env.draw(c,p.x,p.y,p.angle,p.size,p.seed,p.life,p.now);
 assert.equal(calls.length,46,'GOLD four-layer tongue command count: '+p.name);
 const sha=createHash('sha256').update(JSON.stringify(calls)).digest('hex');
 assert.equal(sha,p.sha,'Flame path/control points/color differ from GOLD: '+p.name);
 console.log('PASS Gold 4-layer flame tongue',p.name,sha.slice(0,14));
}
console.log('PASS GOLD FLAME CORE 3/3: all 46 Canvas commands per phase');
