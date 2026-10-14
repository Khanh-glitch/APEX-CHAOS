// CP9 Gold rocket material-only regression.
// The physical carrier is NOT mocked here: this checks that the pure cosmetic
// adapter consumes any sampled world path without creating orbit sprites,
// stretched screenshots, frame-rate dependent emission or retroactive smoke turn.
import assert from 'node:assert/strict';
import {drawRocketGoldProjectile} from '../src/game/cosmetics/rocketVuaHeGold.js';

const ROOT='/assets/skins/rocket-vua-he/';
const resources={get:key=>key.startsWith(ROOT)?Object.freeze({key}):null};
function sampledPath(fps, curved=true){
  const age=.84,entries=[];
  for(let i=0;i<=Math.ceil(age*fps);i++){
    const t=Math.min(age,i/fps);
    const k=Math.max(0,t-.42);
    entries.push({t,x:120+420*t+380*t*t,y:420+(curved?360*k*k:0)});
    if(t===age)break;
  }
  return entries;
}
function capture(path, overrides={}){
  const images=[],stack=[];let tx=0,ty=0,rotation=0,alpha=1;
  const ctx={
    get globalAlpha(){return alpha;},set globalAlpha(v){alpha=v;},
    save(){stack.push({tx,ty,rotation,alpha});},
    restore(){const s=stack.pop();assert.ok(s,'unbalanced canvas save/restore');({tx,ty,rotation,alpha}=s);},
    translate(x,y){tx+=x;ty+=y;},
    rotate(a){rotation+=a;},
    drawImage(img,...args){
      assert.equal(args.length,4,'Never crop, stretch a strip or reuse a screenshot');
      const [x,y,w,h]=args;
      images.push({asset:img.key,x:tx,y:ty,rotation,alpha,width:w,height:h});
    }
  };
  const last=path.at(-1),prev=path.at(-2);
  const pose={kind:'rocket',age:.84,x:last.x,y:last.y,
    vx:(last.x-prev.x)/(last.t-prev.t),vy:(last.y-prev.y)/(last.t-prev.t),trail:path,
    ...overrides};
  assert.equal(drawRocketGoldProjectile(ctx,pose,resources),true);
  assert.equal(stack.length,0,'canvas state leaked');
  const [sprite,...smoke]=images;
  assert.equal(sprite.asset,ROOT+'projectile.png');
  assert.equal(sprite.width,104);assert.equal(sprite.height,24);
  assert.ok(smoke.length>=24,'smoke disappears from live trajectory');
  for(const p of smoke){
    assert.match(p.asset,/\/v[0-9]\.png$/,'Only owner-authored V3 smoke textures');
    assert.ok(p.width>0&&p.height>0&&p.width<170&&p.height<170,
      'Smokes are bounded Gold puffs, not a stretched flight image');
    assert.ok(p.width/p.height>.58&&p.width/p.height<1.52,'No anisotropic smoke sheet');
    assert.ok(p.alpha>0&&p.alpha<=1,'valid opacity');
    for(const k of ['x','y','rotation'])assert.ok(Number.isFinite(p[k]),'finite material transform');
  }
  return smoke;
}
const refs=[30,60,144,240].map(fps=>({fps,smoke:capture(sampledPath(fps))}));
for(const q of refs){
  assert.deepEqual(q.smoke,capture(sampledPath(q.fps)),
    'Absolute birth slot identities must not change between identical frames');
}
const counts=refs.map(q=>q.smoke.length);
assert.ok(Math.max(...counts)-Math.min(...counts)<=10,
  'Native path frame rate changed smoke emission count: '+counts.join('/'));
const path=sampledPath(60),base=capture(path);
const turned=capture(path,{vx:-700,vy:350,x:4000,y:-3000});
assert.deepEqual(base,turned,
  'Existing world smoke must not orbit, rotate or teleport when the rocket turns or changes position');
assert.ok(base.some(p=>p.y>430)&&base.some(p=>p.y<480),
  'Smoke must use spatially distinct native path samples');
const original=capture(sampledPath(60,false));
assert.notDeepEqual(base,original,'Curved physical path must actually bend cosmetic smoke');
console.log('CP9 GOLD ROCKET SMOKE SAMPLING PASS '+JSON.stringify({
  fps:refs.map((x,i)=>({fps:x.fps,puffs:counts[i]})),
  curved:true,immutableWorldTrail:true,uncroppedGoldV3:true,rocketWidth:104
}));
