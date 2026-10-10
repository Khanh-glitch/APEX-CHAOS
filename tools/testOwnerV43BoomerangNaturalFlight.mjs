// Round 3 GOLD NATURAL_FLIGHT: execute the *actual* production path helpers
// extracted from shipping runtime, not a rewritten mock. Reference:
 // owner V4.3 offline Lab — three cubic legs, non-homing throw, curve drag.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const begin=source.indexOf('function v43MakeFlightPath(');
const end=source.indexOf('  function v43Step(',begin);
assert.ok(begin>=0&&end>begin,'shipping natural-flight helpers missing');
const code=source.slice(begin,end);
const sandbox=vm.createContext({
  GAME_SIZE:1000,
  v43min:(n,a,b)=>Math.max(a,Math.min(b,n)),
  Math
});
vm.runInContext(code+'\nthis.flight={path:v43MakeFlightPath,at:v43PathAt,curve:v43BoomerangCurvature};',sandbox);
const {path,at,curve}=sandbox.flight;
const cfg=fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8');
const start=cfg.indexOf('COMBAT_BOOMERANG:Object.freeze(');
assert.ok(start>=0,'boomerang registry entry missing');
const entry=cfg.slice(start,start+850);
const get=key=>{
  const m=entry.match(new RegExp('\\b'+key+':([0-9]+(?:\\.[0-9]+)?)'));
  assert.ok(m,'missing Gold tunable '+key);return Number(m[1]);
};
const speed0=get('speed'),cruise=get('cruise'),curveDrag=get('curveDrag'),
      accel=get('accelLimit'),min=get('minTurnSpeed'),max=get('maxTurnSpeed'),
      maxFlight=get('maxFlightSeconds');

for(const [x,y,angle] of [[270,500,0],[730,500,Math.PI],[500,270,Math.PI/2],
                            [500,730,-Math.PI/2]]){
  const a=path(x,y,angle),b=path(x,y,angle,{x:x+12,y:y+12});
  assert.equal(a.revision,'NO_TARGET_WAYPOINTS_V43');
  assert.equal(a.points.length,241,'three Gold cubic legs must each have 80 samples');
  assert.ok(a.total>950&&a.total<2200,'arc length should represent full returning flight');
  assert.ok(a.far>0&&a.far<a.total);
  assert.ok(a.apexProgress>.15&&a.apexProgress<.85);
  // Post-update: the initially acquired target distance is now allowed
  // to change reach, but never changes direction again after release.
  const reachable=path(150,500,0,{x:830,y:500,radius:75});
  assert.ok(reachable.distance>600,'long-distance opponent must be within outward throw');
  assert.ok(reachable.distance<=760,'throw must have a finite range cap');
  const near=path(150,500,0,{x:330,y:500,radius:75});
  assert.ok(near.distance<reachable.distance,'close opponent cannot force same tiny/fixed loop');
  assert.equal(JSON.stringify(reachable.points),
    JSON.stringify(path(150,500,0,{x:830,y:500,radius:75}).points),
    'locked target at release yields deterministic repeatable arc');
  const first=at(a,0),last=at(a,a.total);
  assert.ok(Math.hypot(first.x-x,first.y-y)<1e-7);
  assert.ok(Math.hypot(last.x-x,last.y-y)<1e-6,'Gold body must return to LAUNCH point');
  let maxCurve=0;
  for(let s=20;s<a.total-20;s+=20)maxCurve=Math.max(maxCurve,curve(a,s));
  assert.ok(maxCurve>.001,'continuous aerodynamic banking should contain true curvature');
}
function integrate(dt){
  const p=path(270,500,0);
  let time=0,travel=0,speed=speed0,maxSpeed=0;
  while(travel<p.total-.01&&time<maxFlight){
    const u=travel/p.total;
    const desired=Math.max(min,Math.min(max,cruise+65*Math.sin(Math.PI*u)
      -curve(p,travel)*curveDrag-100*u));
    speed+=Math.max(-accel*dt,Math.min(accel*dt,desired-speed));
    travel=Math.min(p.total,travel+speed*dt);
    maxSpeed=Math.max(maxSpeed,speed);
    time+=dt;
  }
  return {time,travel,maxSpeed,total:p.total};
}
const r30=integrate(1/30),r60=integrate(1/60),r120=integrate(1/120);
for(const r of [r30,r60,r120]){
  assert.ok(Math.abs(r.travel-r.total)<.02,'Gold return must close before timeout');
  assert.ok(r.time>1.2&&r.time<maxFlight,'flight needs visible anticipation, turn and return');
  assert.ok(r.maxSpeed<=max+1,'speed stays in the authored Gold envelope');
}
assert.ok(Math.abs(r30.time-r120.time)<.11,
  'curved flight duration must converge at 30/60/120Hz');
assert.doesNotMatch(code,/ctx\.enemy|target\.x\s*\+=|target\.y\s*\+=/,
  'post-update Gold loop must not track a moving enemy after release');
console.log('PASS GOLD V4.3 BOOMERANG: 3 natural cubic legs, target-independent return, curvature drag and 30/60/120Hz timing',
  JSON.stringify({r30,r60,r120}));
