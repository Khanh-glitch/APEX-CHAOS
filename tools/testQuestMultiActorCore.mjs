// CP04a — pure 2v2 selector tests. NO canvas, no game boot, no fake PASS.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const sandbox = { window: {} };
runInNewContext(readFileSync(new URL('../public/game/quest/questMultiActorCore.js', import.meta.url), 'utf8'), sandbox);
const Q = sandbox.window.APEX_QUEST_MULTI_ACTOR_CORE;
assert.ok(Q, 'Quest core must load without injecting into game production');
const make = (id, questId, questTeam, x, y, hp, radius=20) =>
  ({ id, questId, questTeam, x, y, hp, radius });
const fresh = () => [
  make(101,'NEWBOT','ALLY',0,0,1000),
  make(102,'T.O.T','ALLY',40,0,1000),
  make(201,'SCRAP-A','HOSTILE',100,0,350),
  make(202,'SCRAP-B','HOSTILE',200,0,350),
];
let assertions=0;
const check = (fn) => { fn(); assertions++; };
const a=fresh(), [newbot,tot,scrapA,scrapB]=a;
check(()=>assert.equal(Q.validateFirstWake(a).ok,true));
check(()=>assert.equal(Q.hostile(newbot,tot),false));
check(()=>assert.equal(Q.hostile(newbot,scrapA),true));
check(()=>assert.equal(Q.livingEnemies(newbot,a).length,2));
check(()=>assert.equal(Q.livingEnemies(scrapA,a).length,2));
check(()=>assert.equal(Q.nearestEnemy(newbot,a).id,201));
check(()=>assert.equal(Q.nearestEnemy(scrapA,a).id,102));
check(()=>assert.equal(Q.nearestEnemy({...newbot,hp:0},a),null));
check(()=>assert.equal(Q.firstWakeOutcome(a).status,'ACTIVE'));
{
  const b=fresh();b[1].hp=0;
  check(()=>assert.equal(Q.firstWakeOutcome(b).status,'ACTIVE')); // Ally KO isn't immediate retry
  b[2].hp=0;b[3].hp=0;
  check(()=>assert.equal(Q.firstWakeOutcome(b).status,'COMPLETE'));
}
{
  const b=fresh();b[0].hp=0;b[2].hp=0;b[3].hp=0;
  check(()=>assert.equal(Q.firstWakeOutcome(b).status,'RETRY')); // Protagonist KO takes priority
}
{
  const b=fresh();b[1].id=b[0].id;
  check(()=>assert.equal(Q.validateFirstWake(b).reason,'duplicate-actor-id'));
}
{
  const b=fresh();b[1].questTeam='HOSTILE';
  check(()=>assert.equal(Q.validateFirstWake(b).reason,'not-2v2'));
}
{
  const b=fresh();b[0].questId='OTHER';
  check(()=>assert.equal(Q.validateFirstWake(b).reason,'missing-story-allies'));
  check(()=>assert.equal(Q.firstWakeOutcome(b).reason,'missing-player'));
}
{
  // Incoming segment crosses ally T.O.T first; hit must be SCRAP-A.
  const hit=Q.firstProjectileHit({owner:newbot,actors:a,from:{x:0,y:0},to:{x:250,y:0},projectileRadius:3});
  check(()=>assert.equal(hit.actor.id,201));
  check(()=>assert.ok(hit.t<1&&hit.t>0));
  // Segment misses both enemies; may be physically near ally.
  const miss=Q.firstProjectileHit({owner:newbot,actors:a,from:{x:0,y:0},to:{x:75,y:0},projectileRadius:3});
  check(()=>assert.equal(miss,null));
}
{
  // Geometrically nearest hostile must win, not first in fighters[].
  const b=fresh();b[2].x=210;b[3].x=90;
  const hit=Q.firstProjectileHit({owner:b[0],actors:b,from:{x:0,y:0},to:{x:300,y:0},projectileRadius:3});
  check(()=>assert.equal(hit.actor.id,202));
}
{
  // Independent of actor array permutation when collisions tie.
  const b=fresh();b[2].x=120;b[3].x=120;
  const h1=Q.firstProjectileHit({owner:b[0],actors:b,from:{x:0,y:0},to:{x:300,y:0},projectileRadius:3});
  const h2=Q.firstProjectileHit({owner:b[0],actors:[b[3],b[1],b[2],b[0]],from:{x:0,y:0},to:{x:300,y:0},projectileRadius:3});
  check(()=>assert.equal(h1.actor.id,h2.actor.id));
}
{
  // A pickup may be claimed by an enemy or ally, but only when eligible.
  const slot={x:95,y:0};
  check(()=>assert.equal(Q.closestEligiblePickup(slot,a,()=>60,()=>true).id,201));
  check(()=>assert.equal(Q.closestEligiblePickup(slot,a,()=>60,(f)=>f.id!==201).id,102));
  check(()=>assert.equal(Q.closestEligiblePickup(slot,a,()=>60,()=>false),null));
}
{
  const b=fresh();b[2].hp=0;
  check(()=>assert.equal(Q.livingEnemies(b[0],b).length,1));
  check(()=>assert.deepEqual(Q.splashEnemies(b[0],b).map(x=>x.id),[202]));
}
{
  const b=fresh();b[2].questTeam='ALLY';b[2].x=90;
  check(()=>assert.equal(Q.nearestEnemy(b[0],b).id,202)); // no friendly targeting
}
console.log('CP04 selector tests PASS: '+assertions+' assertions');
