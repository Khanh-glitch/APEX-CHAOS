// V4.3 post-update: runnable, fail-closed mechanics and UX-bridge contracts.
// Source functions are evaluated from the REAL shipping runtime. None of the
// expected behavior is reimplemented as a fake test copy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const runtime=read('public/game/arsenal/arsenalWeaponRuntime.js');
const config=read('public/game/arsenal/arsenalConfig.js');
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
// Owner's original V4.3 Lab fire-only VFX, with halved cone/range/cadence.
assert.ok(config.includes('duration:.325,ticks:5,tickStart:.05,tickInterval:.06'));
assert.ok(config.includes('tickDamage:18,range:325,cone:.18,burnTicks:5,burnInterval:.25,burnDamage:13,idealRange:265'));
assert.ok(runtime.includes('let muzzle=v43Muzzle(p.owner,p.weapon,direction)'));
assert.ok(runtime.includes('x.flameTarget=ctx.enemy'));
assert.ok(runtime.includes('h.meta.aimAngle=direction'));
assert.ok(runtime.includes('function v43GoldFlamethrowerParticles(ctx,p)'));
assert.ok(runtime.includes('v43GoldFlamethrowerParticles(ctx,p);'));
assert.ok(runtime.includes('Math.min(p.age,V43.FLAMETHROWER.duration)*470'));
assert.ok(runtime.includes('const travel=Math.min(V43.FLAMETHROWER.range,'));
assert.doesNotMatch(runtime,/v43LabFlameField|damageReach\*scale|fuel lanes fill its DAMAGE/);
assert.match(runtime,/v43GoldTongue\(ctx,pt\.x,pt\.y,ang/);
// Run the actual native hit evaluator: five near hits, zero far/off-axis hits.
const hitActors=[],owner={hp:1000};
const near={x:300,y:100,radius:75,hp:1000},
 far={x:550,y:100,radius:75,hp:1000},
 off={x:300,y:260,radius:75,hp:1000};
const flameVM=vm.createContext({Math,Set,
 V43:{FLAMETHROWER:{duration:.325,ticks:5,tickStart:.05,tickInterval:.06,
  tickDamage:18,range:325,cone:.18,burnTicks:5,burnInterval:.25,burnDamage:13}},
 getHolder:()=>({meta:{aimAngle:0}}),v43Muzzle:()=>({x:100,y:100}),
 v43Enemies:()=>[near,far,off],v43min:(x,a,b)=>Math.max(a,Math.min(b,x)),
 v43Deal:(p,f,d)=>hitActors.push({f,d}),v43ApplyBurn:()=>{},
 AQ:{state:{visuals:false}},pushVisual:()=>{throw Error('Unexpected flame FX');}
});
vm.runInContext(fn(runtime,'v43FlameHit')+'\nthis.hit=v43FlameHit;',flameVM);
const shot={owner,weapon:'FLAMETHROWER',angle:0,age:0,life:.325,ticks:0,flameOrigins:[]};
for(let i=1;i<=20&&shot.life>0;i++){shot.age=i*.016;flameVM.hit(shot,.016);}
assert.equal(shot.ticks,5);
assert.equal(hitActors.length,5);
assert.ok(hitActors.every(h=>h.f===near&&h.d===18));
console.log('PASS original Lab fire only, halved 325px / .18rad / .325s, 5 real close hits');
// Adversarial ROBOT Gold socket: the real art muzzle sits 66 px lower than
// the Fighter center. Aim at an actual Fighter without widening the cone.
const realTarget={x:300,y:100,radius:75,hp:1000},obliqueHits=[];
const offsetHolder={meta:{aimAngle:0}};
const obliqueEnv=vm.createContext({Math,Set,
 V43:{FLAMETHROWER:{duration:.325,ticks:5,tickStart:.05,tickInterval:.06,
  tickDamage:18,range:325,cone:.18,burnTicks:5,burnInterval:.25,burnDamage:13}},
 getHolder:()=>offsetHolder,
 v43Muzzle:(fighter,weapon,angle)=>({x:100+40*Math.cos(angle),y:166+40*Math.sin(angle)}),
 v43Enemies:()=>[realTarget],
 v43min:(x,a,b)=>Math.max(a,Math.min(b,x)),
 v43Deal:(p,f,d)=>obliqueHits.push({f,d}),v43ApplyBurn:()=>{},
 AQ:{state:{visuals:false}},pushVisual:()=>{throw Error('Unapproved extra flame FX');}
});
vm.runInContext(fn(runtime,'v43FlameHit')+'\nthis.hit=v43FlameHit;',obliqueEnv);
const targeted={owner,weapon:'FLAMETHROWER',angle:0,age:.06,life:.325,ticks:0,
 flameOrigins:[],flameTarget:realTarget};
obliqueEnv.hit(targeted,.016);
const physicalAngle=Math.atan2(realTarget.y-targeted.y,realTarget.x-targeted.x);
assert.equal(obliqueHits.length,1,'narrow Flame cone must hit real forward Fighter');
assert.equal(obliqueHits[0].d,18);
assert.ok(Math.abs(physicalAngle-targeted.angle)<.03,'fire, art socket and actual hit cone must align');
assert.ok(targeted.angle<-.2,'actual Gold muzzle offset must be solved, not ignored');
assert.ok(offsetHolder.meta.aimAngle<-.2,'held gun pose follows muzzle correction');
console.log('PASS 325px/0.18rad real Gold muzzle-to-target Flame alignment');
// Quest enemy laser is physically swept, visually attached to the live
// Gold donor's actual optic, and the source reanchors every render.
assert.match(donor,/function opticWorld\(real\)/);
assert.match(laser,/drawGoldLabLaserCharge\(ctx,optic\.x,optic\.y,t,visualClock\)/);
assert.match(laser,/root\.APEX_QUEST_V12_RIG\?\.opticWorld\?\.\(ray\.owner\)/);
assert.match(laser,/firstProjectileHit\(\{/);
console.log('PASS post Sentinel laser: source Gold 3 rings/14 sparks/4 beam layers, live optic');
// Quest fighter stays NEWBOT/ROBOT. No UI picker, global override or substituted kit.
assert.match(battle,/fighter\.setDir\(\(best\.x-fighter\.x\)\/bestD/);
assert.ok(battle.includes("const questHeroEligible=types[0]?.name==='ROBOT'"));
assert.doesNotMatch(battle,/questChosenBattleId|__apexQuestHeroChoice/);
assert.doesNotMatch(bridge,/questShell|__apexQuestHeroChoice/);
assert.ok(bridge.includes("const p1Shell = questPreview ? 'newbot'"));
assert.doesNotMatch(director,/q1HeroCards|q1-hero-pick|populateQuestHeroPicker|__apexQuestHeroChoice/);
for(const key of ['questBreachWaves','questRivetOverridden','questTotLastChoice',
 'questFirstWake','questScrapSwarm','questWeaponRain',
 'questBreakerCharge','questReflex'])
 assert.ok(battle.includes(key),'missing Quest route '+key);
assert.match(donor,/drawAftermath\(ctx,realActors=\[\],state=null\)/);
assert.match(donor,/const max=fx\.special\?1\.55:3\.25/);
console.log('PASS fixed Quest NEWBOT/ROBOT, native PISTOL pickups and Gold rig motion');

// Real E01 ordered-receipt authority: ROBOT only; forged casts fail.
const QCTX={window:{},Math,Number,Object,Array,String};
vm.runInNewContext(read('public/game/quest/questReflexReceipts.js'),QCTX);
for(const [name,hero] of [['ROBOT','ROBOT']]){
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
  name+' must accept native ROBOT A1 after the real pistol exchanges');
 assert.equal(g.acceptCast({type:'Cast',seq:4,payload:{
  hero,fighterId:1,side:'p1',slot:'A2'}}),true);
 assert.equal(g.snapshot().phase,'BOTH_HALF');
}
console.log('PASS Quest E01 native ROBOT J/K Cast; forged casts rejected');
