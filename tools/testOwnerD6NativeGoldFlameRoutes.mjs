// D6 production-source visual routing probe. Uses the actual Gold Flame
// renderer FUNCTION extracted from shipping Arsenal source, not a fake copy.
// Does not certify browser pixels or the original Gold fidelity matrix.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
function extract(name){
  const anchor='function '+name+'(',start=source.indexOf(anchor);
  assert.ok(start>=0,name+' missing');
  let depth=0,end=-1;
  for(let i=source.indexOf('{',start);i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0){end=i+1;break;}
  }
  assert.ok(end>start,name+' unbalanced');
  return source.slice(start,end);
}
const env=vm.createContext({Math,TAU:Math.PI*2,
  V43:{FLAMETHROWER:{duration:.325,cone:.18,range:325}},
  v43GoldTongue:(ctx,x,y,angle,size,seed,alpha,now)=>{
    ctx.tongues.push({x,y,angle,size,seed,alpha,now});
  }});
vm.runInContext(extract('v43GoldFlamethrowerParticles')+
  '\nthis.drawFlame=v43GoldFlamethrowerParticles;',env);
function render(extra={}){
  const ctx={tongues:[],strokes:[],createRadialGradient:()=>({addColorStop(){}})};
  for(const k of ['save','restore','translate','rotate','scale','beginPath','arc','fill','stroke'])
    ctx[k]=()=>{};
  ctx.moveTo=()=>{};ctx.lineTo=()=>{};
  const p={age:.30,ox:100,oy:100,x:100,y:100,angle:0,
    flameOrigins:[{time:0,x:100,y:100,angle:0}],...extra};
  env.drawFlame(ctx,p);
  return ctx.tongues;
}
const control=render();
assert.ok(control.length>30,'Gold Lab tongues must exist');
const empty=render({flameReflectHistory:[]});
assert.deepEqual(JSON.parse(JSON.stringify(control)),JSON.parse(JSON.stringify(empty)),
  'visual feature must be byte-for-byte neutral with no Crystala contacts');
const routes=Array.from({length:33},(_,i)=>({
  angle:(i/32*2-1)*.18,travel:40,
  from:{x:140,y:100+(i-16)*.35},to:{x:-185,y:100+(i-16)*.35}
}));
const bounce=render({flameReflectHistory:[{time:.05,emissionTick:0,routes}]});
assert.equal(bounce.length,control.length,'redirect uses same Gold tongue particle count');
const forward=control.map(x=>x.x),retro=bounce.map(x=>x.x);
const min=x=>Math.min(...x);
assert.ok(min(retro)<min(forward)-20,
  'Gold tongue visual did not bend back along physically reflected native Stream');
assert.ok(bounce.some(x=>Math.abs(x.angle)>2.5),
  'Gold tongues must rotate along reflected direction, not merely move');
const untouched=render({flameReflectHistory:[{time:.05,
  routes:[{angle:Math.PI,travel:40,from:{x:140,y:100},to:{x:-185,y:100}}]}]});
assert.deepEqual(JSON.parse(JSON.stringify(untouched)),JSON.parse(JSON.stringify(control)),
  'nonintercepted angular range must NEVER inherit nearby reflection Gold');
const narrow=render({flameReflectHistory:[{time:.05,routes:[routes[16]]}]});
const changed=narrow.filter((t,i)=>Math.abs(t.x-control[i].x)>20).length;
assert.ok(changed>0&&changed<control.length/2,
  'one small intercepted angular slice cannot visually redirect whole flame cone');
assert.match(source,/flameReflectHistory:\(p\.flameReflectHistory\|\|\[\]\)\.slice\(\)/,
  'Gold tail must retain authoritative reflection snapshots');
assert.match(source,/flameReflectHistory:v\.flameReflectHistory/,
  'Gold tail renderer must reuse same reflected trajectories');
console.log('D6 Native Gold Flame routing PROBE: 7/7 PASS (source renderer, not browser pixel certification)');
