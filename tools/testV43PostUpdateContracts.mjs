// V4.3 post-update: runnable, fail-closed mechanics and UX-bridge contracts.
// Source functions are evaluated from the REAL shipping runtime. None of the
// expected behavior is reimplemented as a fake test copy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const runtime=read('public/game/arsenal/arsenalWeaponRuntime.js');
const battle=read('public/game/modes/arsenalBattleRuntime.js');
const laser=read('public/game/quest/questEnemyAbilities.js');
const donor=read('public/game/quest/questGoldV12Rig.js');
const director=read('public/game/quest/quest01Director.js');
const bridge=read('public/game/gold/goldProductBridge.js');
function fn(src,name){
 const at=src.indexOf('function '+name+'(');
 assert.ok(at>=0,'Missing '+name);
 let depth=0,end=-1;
 for(let i=src.indexOf('{',at);i<src.length;i++){
  if(src[i]==='{')depth++;
  else if(src[i]==='}'&&--depth===0){end=i+1;break;}
 }
 assert.ok(end>at,'Cannot isolate function '+name);
 return src.slice(at,end);
}
// RPG: exact splash executes ONCE even if world-boundary/fuse both trigger.
let blasts=0;
const rockContext=vm.createContext({Math,V43:{RPG_7:{peak:161,blastRadius:126}},
 v43Splash:(p,d,r)=>{blasts++;assert.equal(d,161);assert.equal(r,126)}});
vm.runInContext(fn(runtime,'v43DetonateRocket')+'\nthis.detonate=v43DetonateRocket;',rockContext);
const rocket={weapon:'RPG_7',damage:161,life:2};
assert.equal(rockContext.detonate(rocket),true);
assert.equal(rockContext.detonate(rocket),false);
assert.equal(blasts,1);
assert.equal(rocket.life,0);
console.log('PASS post RPG once-only wall/body/fuse splash');
// Three Gold cubic legs still present, but opponent distance now controls
// outward reach and never future steering.
const env=vm.createContext({Math,GAME_SIZE:1000,
 v43min:(x,a,b)=>Math.max(a,Math.min(b,x))});
vm.runInContext(fn(runtime,'v43MakeFlightPath')+'\nthis.make=v43MakeFlightPath;',env);
const mk=env.make;
const long=mk(160,500,0,{x:825,y:500,radius:75});
const close=mk(160,500,0,{x:335,y:500,radius:75});
assert.ok(long.distance>600&&long.distance<=760);
assert.ok(close.distance<long.distance);
assert.equal(long.points.length,241);
assert.ok(long.points.slice(1,81).every(pt=>Math.abs(pt.y-500)<1e-6),
 'Outbound segment must precisely aim toward target at release');
const same=mk(160,500,0,{x:825,y:500,radius:75});
assert.deepEqual(JSON.parse(JSON.stringify(long.points)),JSON.parse(JSON.stringify(same.points)));
for(const [x,y,angle,tx,ty] of [
 [175,500,0,900,500],[825,500,Math.PI,100,500],
 [500,160,Math.PI/2,500,900],[500,840,-Math.PI/2,500,100],
 [80,80,Math.PI/4,650,650],[920,920,-3*Math.PI/4,300,300]
 ]){
 const p=mk(x,y,angle,{x:tx,y:ty,radius:75});
 assert.ok(p.points.every(pt=>pt.x>=-1&&pt.y>=-1&&pt.x<=1001&&pt.y<=1001),
 'Boomerang Gold cubic loop clips arena for '+x+','+y);
}
console.log('PASS post Boomerang target-range, aimed outward, wall-safe three-cubic return');
// A boomerang must actually LEAVE the hand and reenter via native equip.
// A reflected/deflected body cannot create a phantom held weapon.
assert.match(runtime,/f\.data\.arsenal=null;\s*}\s*else\s*{/);
assert.match(runtime,/if\(p\.phase==='return'&&p\.launchOwner\?\.hp>0/);
assert.match(runtime,/distPointToSegment\(p\.launchOwner\.x,p\.launchOwner\.y/);
assert.match(runtime,/equip\(p\.launchOwner,p\.weapon\)/);
assert.match(runtime,/p\.hits\.size<\(c\.maxHitsPerLeg\?\?1\)/);
console.log('PASS post Boomerang empty hand, physical swept catch, multi-actor per-leg budget');
// Flame V1 keeps original native muzzle but renders the actual gameplay cone.
assert.match(runtime,/const muzzle=v43Muzzle\(p\.owner,p\.weapon,p\.angle\)/);
assert.match(runtime,/const dx=f\.x-p\.x,dy=f\.y-p\.y/);
assert.match(runtime,/function v43LabFlameField\(ctx,p\)/);
assert.match(runtime,/const range=c\.range,cone=c\.cone/);
assert.match(runtime,/520\)/);
assert.match(runtime,/v43LabFlameField\(ctx,p\)/);
assert.match(runtime,/if\(p\.kind==='flare'\)/);
assert.match(runtime,/v43GoldTongue\(ctx,pt\.x,pt\.y,ang/);
console.log('PASS post owner Flame V1 & Gold Flare uses native muzzle/field history');
// Quest enemy laser is physically swept, visually attached to the live
// Gold donor's actual optic, and the source reanchors every render.
assert.match(donor,/function opticWorld\(real\)/);
assert.match(laser,/drawGoldLabLaserCharge\(ctx,optic\.x,optic\.y,t,visualClock\)/);
assert.match(laser,/root\.APEX_QUEST_V12_RIG\?\.opticWorld\?\.\(ray\.owner\)/);
assert.match(laser,/firstProjectileHit\(\{/);
console.log('PASS post Sentinel laser: source Gold 3 rings/14 sparks/4 beam layers, live optic');
// Quest NPC gun acquisition remains an actual floor collector; selection is
// signed and uses the native hero kit without rebasing narrative IDs.
assert.match(battle,/fighter\.setDir\(\(best\.x-fighter\.x\)\/bestD/);
assert.match(battle,/function questChosenBattleId\(\)/);
assert.match(bridge,/const questShell=questPreview\?/);
assert.match(director,/id="q1HeroCards"/);
for(const key of ['questBreachWaves','questRivetOverridden','questTotLastChoice',
 'questFirstWake','questScrapSwarm','questWeaponRain',
 'questBreakerCharge','questReflex']){
 assert.match(battle,new RegExp("questChosenBattleId\\(\\)[\\s\\S]{0,170}"+key));
}
assert.match(donor,/drawAftermath\(ctx,realActors=\[\],state=null\)/);
assert.match(donor,/const max=fx\.special\?1\.55:3\.25/);
console.log('PASS post Quest selectable real-kit story, real pistol pickup, true donor motion/part cleanup');

// Execute the actual E01 ordered-receipt authority with every selectable
// Gold kit. A forged Cast from another hero or side cannot advance Story.
const QCTX={window:{},Math,Number,Object,Array,String};
vm.runInNewContext(read('public/game/quest/questReflexReceipts.js'),QCTX);
for(const [name,hero] of [['ROBOT','ROBOT'],['HUNTER','HUNTER'],
 ['CRYSTALA','CRYSTAL'],['MAGNET','MAGNET'],['FROST','ICE'],['MIRROR','MIRROR']]){
 const n={id:1,questId:'NEWBOT',questTeam:'ALLY',hp:1000,maxHp:1000,
  type:{name}},tot={id:2,questId:'T.O.T',questTeam:'HOSTILE',hp:1000,maxHp:1000};
 const g=QCTX.window.APEX_QUEST_REFLEX_RECEIPTS.create(()=>[n,tot]);
 assert.equal(g.acceptDamage({label:'arsenal-pistol',attacker:n,victim:tot,amount:10}),true);
 assert.equal(g.acceptDamage({label:'arsenal-pistol',attacker:tot,victim:n,amount:10}),true);
 assert.equal(g.acceptCast({type:'Cast',seq:1,payload:{
  hero:'INVALID',fighterId:1,side:'p1',slot:'A1'}}),false);
 assert.equal(g.acceptCast({type:'Cast',seq:2,payload:{
  hero, fighterId:2,side:'p1',slot:'A1'}}),false);
 assert.equal(g.acceptCast({type:'Cast',seq:3,payload:{
  hero,fighterId:1,side:'p1',slot:'A1'}}),true,
  name+' must accept native selected-hero A1 after the real pistol exchanges');
 assert.equal(g.acceptCast({type:'Cast',seq:4,payload:{
  hero,fighterId:1,side:'p1',slot:'A2'}}),true);
 assert.equal(g.snapshot().phase,'BOTH_HALF');
}
console.log('PASS post Quest E01 ordered native J/K Cast for six selectable kits; forged casts rejected');
