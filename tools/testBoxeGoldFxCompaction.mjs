// Compare exact production BOXE Gold FX advance against the prior expiry
// algorithm. No Gold particle caps, no frame skipping, no quality reduction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const src=fs.readFileSync('public/game/hero-rework/boxeGoldPresentationRuntime.js','utf8');
const begin=src.indexOf('function advanceGoldFx(g,dt){');
const end=src.indexOf('// Gold\'s ORIGINAL key-2 projectile',begin);
assert.ok(begin>=0 && end>begin,'production BOXE FX advance must be found');
const updated=vm.runInNewContext(src.slice(begin,end)+'\nadvanceGoldFx',{Math});
const legacy=(g,dt)=>{
  const p=g.player;g.time+=dt;
  for(let i=g.timeline.length-1;i>=0;i--){const e=g.timeline[i];e.t-=dt;if(e.t<=0){g.timeline.splice(i,1);e.fn();}}
  if(p.empoweredT>0&&Math.random()<.25)g.fire.puff(p.x+(Math.random()*52-26),p.y-Math.random()*40,14,0,-90,.45);
  for(const hand of ['L','R']){
    const h=g.hands[hand];
    if(h.t>=0){h.t+=dt/(h.dur||.26);if(h.t>=1)h.t=-1;}
    if(!h.missing){const pose=g.glovePose(hand);g.fx.trail(hand,pose.x,pose.y,g.trailColor,pose.active?30*pose.scale:13);
      if(p.empoweredT>0&&Math.random()<.3)g.fire.puff(pose.x+(Math.random()*20-10),pose.y+(Math.random()*16-8),12,0,-80,.4);
      if(pose.active){g.fluid.addForce(pose.x,pose.y,34,Math.cos(pose.angle)*9,Math.sin(pose.angle)*5);
        if(Math.random()<.5)g.after(pose.x,pose.y,pose.angle,'glove',g.trailColor,pose.mirror);
        if(Math.random()<.6)g.fx.addSpark(pose.x,pose.y,pose.angle+Math.PI,120+Math.random()*220,g.trailColor,1.2+Math.random()*1.2,.12+Math.random()*.12,p.y+34);}
    }
  }
  if(g.rocketCatch){g.rocketCatch.t+=dt;if(g.rocketCatch.t>=g.rocketCatch.life)g.rocketCatch=null;}
  g.rocketCatchApproach=Math.max(0,g.rocketCatchApproach-dt*4.2);
  for(const a of [...g.pressure]){a.life-=dt;if(a.life<=0)g.pressure.splice(g.pressure.indexOf(a),1);else{const k=1-a.life/a.max;a.r=6+(a.r1-6)*(1-Math.pow(1-k,2.4));}}
  for(const a of [...g.rings]){a.life-=dt;a.r+=a.vr*dt;if(a.life<=0)g.rings.splice(g.rings.indexOf(a),1);}
  for(const a of [...g.arcs]){a.life-=dt;if(a.life<=0)g.arcs.splice(g.arcs.indexOf(a),1);}
  for(const a of [...g.afters]){a.life-=dt;if(a.life<=0)g.afters.splice(g.afters.indexOf(a),1);}
  for(const a of [...g.particles]){a.life-=dt;a.vy+=(a.grav||0)*dt;const drag=Math.exp(-(a.drag||0)*dt);a.vx*=drag;a.vy*=drag;
    a.x+=a.vx*dt;a.y+=a.vy*dt;a.rot+=(a.vr||0)*dt;if(a.life<=0)g.particles.splice(g.particles.indexOf(a),1);}
  for(const zone of [...g.zones]){zone.t+=dt;if(zone.kind==='flame'&&!zone.pulsed&&zone.t>.12){zone.pulsed=true;g.fire.column(zone.x,zone.y,42,150,.65,.8);}
    if(zone.t>=zone.dur)g.zones.splice(g.zones.indexOf(zone),1);}
  g.material.update(dt);g.fluid.step(Math.min(dt,.034));g.fire.update(dt);g.lightning.update(dt);g.fx.update(dt,dt);
};
function state(n){
  const make=(m,fn)=>Array.from({length:m},(_,i)=>fn(i));
  const noop=()=>{};
  return {
    time:0,player:{empoweredT:0},timeline:[],
    hands:{L:{missing:true,t:-1},R:{missing:true,t:-1}},rocketCatch:null,rocketCatchApproach:0,
    pressure:make(n>>3,i=>({id:i,life:i%3===0?0.005:0.3+(i%17)*0.003,max:0.6,r1:80,r:0})),
    rings:make(n>>3,i=>({id:i,life:i%5===0?0.005:0.4,r:3,vr:20})),
    arcs:make(n>>3,i=>({id:i,life:i%4===0?0.005:0.5})),
    afters:make(n>>3,i=>({id:i,life:i%6===0?0.005:0.5})),
    particles:make(n,i=>({id:i,life:i%2===0?0.005:0.3+(i%7)*.002,vy:12,vx:4,grav:2,drag:0.2,x:i,y:i/2,rot:0,vr:0.3})),
    zones:make(n>>4,i=>({id:i,kind:'smoke',t:i%3===0?0.99:0.3,dur:1})),
    material:{update:noop},fluid:{step:noop},fire:{update:noop,puff:noop,column:noop},
    lightning:{update:noop},fx:{update:noop}
  };
}
function snap(g){const o={time:g.time};for(const key of ['pressure','rings','arcs','afters','particles','zones'])o[key]=g[key].map(x=>({...x}));return o;}
for(const n of [64,512,3072]){
  const a=state(n),b=state(n);
  for(let i=0;i<14;i++){
    legacy(a,0.016);updated(b,0.016);
    assert.deepEqual(snap(b),snap(a),'BOXE Gold particle order/state changes after '+i+' frames n='+n);
  }
  function bench(fn){const t=performance.now();for(let i=0;i<3;i++)fn(state(n),0.016);return performance.now()-t;}
  for(let i=0;i<3;i++){bench(legacy);bench(updated);}
  const before=bench(legacy),after=bench(updated);
  console.log(JSON.stringify({hero:'BOXE',particles:n,parity:'exact',legacyMs:+before.toFixed(3),optimizedMs:+after.toFixed(3),speedup:+(before/(after||1e-6)).toFixed(2)}));
}
console.log('PASS BOXE stable particle parity and expiry-scan test');
