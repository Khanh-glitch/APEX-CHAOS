// AUTHORITATIVE GOLD TRACE GATE, no screenshot-shape guesswork.
// Source: owner-provided APEX_CHAOS_ARSENAL_LAB_V4_3_NATURAL_FLIGHT_OFFLINE (1).html
// Unmodified GOLD HTML sha256: 8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d
// Reference hashes are 127 Canvas2D commands from Gold's drawBoomerangAirflow
// at 3 deterministic flight phases. NEVER regenerate baselines from native code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const runtime=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const fn='function v43GoldBoomerangAirflow(', start=runtime.indexOf(fn);
assert.ok(start>=0,'Missing native Gold boomerang airfoil renderer');
let pos=runtime.indexOf('{',start),depth=0,end=-1;
for(let i=pos;i<runtime.length;i++){
  if(runtime[i]==='{')depth++;
  else if(runtime[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>pos,'Native airfoil function not closed');
const code=runtime.slice(start,end);
const ctx=vm.createContext({
  Math,v43min:(x,a,b)=>Math.max(a,Math.min(b,x)),
  v43Redirected:()=>false,V43:{COMBAT_BOOMERANG:{spin:38}},
});
vm.runInContext(code+'\nthis.run=v43GoldBoomerangAirflow;',ctx);
const fixtures=[
 {name:'early-first-turn',now:.17,launchAt:0,speed:475,heading:.30,spin:1.3,
  sha:'378d9c48ed22e7f7367813be1eb945823cb0288ed031a68a66ea512f51135b15'},
 {name:'curve-return',now:.31,launchAt:0,speed:330,heading:2.16,spin:11.9,
  sha:'a786e344133ec0b70cb6da69975fe1df23da40263b75b322df275276b42a07ae'},
 {name:'moving-absolute-timeline',now:8.45,launchAt:8.1,speed:591,heading:-.88,spin:22.5,
  sha:'5975f77d85ad76b74cb273801e7096ff24fbcdecf6a7f8f6e7632c0282792555'},
];
function canvas(){
 const trace=[],norm=v=>typeof v==='number'?Math.round(v*1e5)/1e5:v;
 const grad={addColorStop:(at,color)=>trace.push(['stop',norm(at),color])};
 const methods=['save','restore','beginPath','moveTo','quadraticCurveTo','lineTo',
  'stroke','fill','arc','translate','closePath','clearRect'];
 const impl={createLinearGradient:(...p)=>(trace.push(['gradient',...p.map(norm)]),grad)};
 for(const name of methods)impl[name]=(...p)=>trace.push([name,...p.map(norm)]);
 const c=new Proxy(impl,{
  set(obj,k,v){trace.push(['set',String(k),norm(v===grad?'gradient':v)]);obj[k]=v;return true;}
 });
 return {trace,c};
}
for(const sc of fixtures){
 // Gold stores absolute lab time; native stores elapsed throw time.
 const age=sc.now-sc.launchAt;
 const visual=Array.from({length:8},(_,i)=>{
  const t=sc.now-.26+i*.037;
  return {x:273+i*7.1+Math.sin(i*.4)*3,
   y:458+Math.cos(i*.32)*18,t:t-sc.launchAt};
 });
 const p={weapon:'COMBAT_BOOMERANG',kind:'boomerang',visual,age,
  speed:sc.speed,spin:sc.spin,spinRate:38,
  vx:sc.speed*Math.cos(sc.heading),vy:sc.speed*Math.sin(sc.heading),
  x:visual.at(-1).x,y:visual.at(-1).y};
 const {trace,c}=canvas();ctx.run(c,p,1);
 assert.equal(trace.length,127,'Gold 3-vortex + 2-hook command count changed: '+sc.name);
 const actual=createHash('sha256').update(JSON.stringify(trace)).digest('hex');
 assert.equal(actual,sc.sha,'Gold airfoil command divergence: '+sc.name);
 console.log('PASS original Gold airfoil trace',sc.name,actual.slice(0,14));
}
console.log('PASS BOOMERANG GOLD: 3/3 exact Canvas commands at 5-decimal precision');
