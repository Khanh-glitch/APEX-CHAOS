import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root={APEX_ARSENAL_CONFIG:{isGun:id=>['PISTOL','SMG','SHOTGUN'].includes(id)}};
root.window=root;
vm.runInNewContext(readFileSync('public/game/quest/questCompanionNativeRuntime.js','utf8'),root);
const SK=root.APEX_QUEST_COMPANION_NATIVE;
let count=0;
function pass(condition,msg){assert.ok(condition,msg);console.log('PASS B6n '+msg);count++;}
function fighter(id,team,x=100,y=100,hp=1000){
 const f={questId:id,questTeam:team,x,y,hp,maxHp:1000,withdrawn:false,
   dir:{x:1,y:0},data:{},statusCalls:[]};
 f.setDir=function(dx,dy){this.dir={x:dx,y:dy};};
 f.applyStatus=function(name,seconds,data){this.statusCalls.push({name,seconds,data});
   this.statuses=this.statuses||{};this.statuses[name]={timer:seconds,...data};};
 f.hasStatus=function(name){return !!(this.statuses?.[name]?.timer>0)};
 return f;
}
function session(){
 const n=fighter('NEWBOT','ALLY',100,150),
       t=fighter('T.O.T','ALLY',200,180),
       r=fighter('RIVET','ALLY',400,180),
       e=fighter('ENEMY-1','HOSTILE',800,180,300),
       f=fighter('ENEMY-2','HOSTILE',900,220,300);
 const actors=[n,t,r,e,f];
 const state={active:true,questBreachEncounter:true,over:null,slots:[],
   questBreachRig:{snapshot:()=>({phase:'FRONTLINE_PASSIVE_HOLD'})},
   questBreachStoryView:{active:()=>false}};
 const policy={abilityRecipient:actors=>['NEWBOT','T.O.T','RIVET']
   .find(id=>actors.some(a=>a.questId===id&&a.hp>0&&!a.withdrawn))};
 const weaponApi={getHolder:who=>who?.data?.arsenal||null};
 const kit=SK.create({actors,policy,weaponApi,state});
 return {n,t,r,e,f,actors,state,kit,weaponApi};
}
pass(SK.CONFIG['T.O.T'].J.cooldown===10,'T.O.T shares Robot J 10s cooldown');
pass(SK.CONFIG['T.O.T'].J.dashSpeed===3400,'T.O.T shares Robot J 3400 dash');
pass(SK.CONFIG['T.O.T'].J.maxDashTime===.55,'T.O.T shares Robot J 0.55s travel');
pass(SK.CONFIG.RIVET.K.cooldown===10,'RIVET copies exact Robot K cooldown');
pass(SK.CONFIG.RIVET.K.duration===3,'RIVET copies exact Robot K duration');
pass(SK.CONFIG.RIVET.K.incomingMult===.45,'RIVET copies exact Robot K armor multiplier');
pass(SK.CONFIG.RIVET.K.ccImmunity===false,'RIVET K does not invent crowd-control immunity');
pass(SK.CONFIG.RIVET.J.catchRadius>=150+25,'RIVET J catch band extends beyond two real 75px Fighter collision radii');

{
 const s=session();
 pass(s.kit.currentRecipient()==='NEWBOT','initial J/K stays native NEWBOT');
 pass(!s.kit.press('K').ok,'companion cannot hijack NEWBOT controls');
 s.n.withdrawn=true;
 pass(s.kit.currentRecipient()==='T.O.T','first withdrawal transfers to T.O.T');
 const out=s.kit.press('K');
 pass(out.ok&&out.kind==='prime','T.O.T K primes 2-second real-pickup window');
 const slot={id:101,phase:'REVEALED',weaponId:'PISTOL'};
 const holder={weaponId:'PISTOL',def:{category:'ranged'},phase:'READY',
   shotsFired:0,ammo:7,elapsed:0,meta:{tier:2}};
 pass(!s.kit.onRealPickup(s.t,slot,holder),'cannot stash an unconfirmed floor pickup');
 slot.phase='PICKED_UP';s.t.data.arsenal=holder;
 pass(s.kit.onRealPickup(s.t,slot,holder),'stash only genuine equipped floor holder');
 pass(s.weaponApi.getHolder(s.t)===null,'stored gun is not held or auto-fired');
 pass(s.kit.snapshot().tot.storedWeapon==='PISTOL','one real gun kept in hidden reserve');
 pass(s.kit.snapshot().tot.kCooldown===0,'stored gun does not start cooldown');
 pass(!s.kit.onRealPickup(s.t,slot,holder),'same floor slot cannot duplicate gun');
 const another={weaponId:'SMG',def:{category:'ranged'},phase:'READY'};
 s.t.data.arsenal=another;
 pass(!s.kit.press('K').ok,'cannot draw stored gun over an existing holder');
 s.t.data.arsenal=null;
 pass(s.kit.press('K').ok,'second K retrieves the exact stashed holder');
 pass(s.t.data.arsenal===holder,'same gun object and ammo retained, no re-equip');
 pass(holder.ammo===7&&holder.shotsFired===0,'stored gun does not consume ammunition');
 pass(s.kit.snapshot().tot.storedWeapon===null,'one gun only, reserve now empty');
 pass(s.kit.snapshot().tot.kCooldown===8,'retrieval starts provisional reuse cooldown');
 pass(!s.kit.press('K').ok,'cooldown cannot be skipped');
 s.kit.close();
 pass(!s.kit.press('J').ok,'session cleanup invalidates old key leases');
}
{
 const s=session();s.n.withdrawn=true;
 pass(s.kit.press('K').ok,'new session primes independently');
 s.kit.tick(2.05);
 pass(s.kit.snapshot().tot.phase==='READY','empty capture expires after 2 seconds');
 pass(s.kit.snapshot().tot.kCooldown>0,'missed window has finite anti-spam penalty');
 const holder={weaponId:'PISTOL',def:{category:'ranged'},phase:'READY'};
 s.t.data.arsenal=holder;
 pass(!s.kit.onRealPickup(s.t,{phase:'PICKED_UP',weaponId:'PISTOL'},holder),
   'expired window never stores an arbitrary late gun');
}
{
 const s=session();s.n.withdrawn=true;
 const pick={id:201,weaponId:'SHOTGUN',phase:'REVEALED',kind:'GUN',x:570,y:180};
 s.state.slots=[pick];
 pass(s.kit.press('J').ok,'T.O.T J targets authentic revealed floor gun');
 pass(s.weaponApi.getHolder(s.t)===null,'dash start cannot instantly equip');
 const before=s.t.x;s.kit.tick(.28);
 pass(s.t.x>before,'J moves the actual Fighter with the 3400-speed dash');
 pass(s.t.data.positionLocked===true,'J native body move asserts engine lock');
 pass(s.weaponApi.getHolder(s.t)===null,'dash does not fabricate Arsenal pickup');
 pick.phase='REMOVED';s.kit.tick(.05);
 pass(!s.kit.snapshot().tot.dashing,'dash ends when the physical gun is gone');
}
{
 const s=session();s.n.withdrawn=true;
 const enemy=s.e;enemy.x=500;enemy.y=180;
 const slot={id:333,phase:'PICKED_UP',weaponId:'PISTOL'};
 pass(s.kit.press('K').ok,'manual store prime');
 const gun={weaponId:'PISTOL',def:{category:'ranged'},phase:'READY'};
 s.t.data.arsenal=gun;pass(s.kit.onRealPickup(s.t,slot,gun),'real store for AI policy test');
 s.n.withdrawn=false; // AI takes control again, never invent new weapon.
 s.state.slots=[];
 s.kit.tick(1);
 pass(s.kit.snapshot().tot.storedWeapon==='PISTOL','AI does not immediately withdraw stored gun');
 s.e.x=890; s.kit.tick(5.1);
 pass(s.kit.snapshot().tot.storedWeapon==='PISTOL','AI carries gun across calm time/long range');
 s.e.x=460;s.e.y=180; // credible threat within <=270, physically armed.
 s.e.data.arsenal={weaponId:'SMG',def:{category:'ranged'}};
 s.kit.tick(.1);
 pass(s.kit.snapshot().tot.storedWeapon===null,'AI retrieves when close armed enemy threatens');
 pass(s.t.data.arsenal===gun,'AI retrieval still uses same holder object');
}
{
 const s=session();s.n.withdrawn=true;s.t.withdrawn=true;
 pass(s.kit.currentRecipient()==='RIVET','second withdrawal transfers control to RIVET');
 s.e.x=650;s.e.y=180;
 pass(s.kit.press('J').ok,'research robot plants stationary interceptor');
 s.kit.tick(.1);
 pass(s.r.data.positionLocked===true,'RIVET anchors at physical location while waiting');
 pass(!s.e.statusCalls.length,'enemy outside entry radius is not auto-stunned');
 s.e.x=575;s.e.y=180; // distance 175: OUTSIDE 150 body contact, INSIDE 190 intercept
 s.kit.tick(.1);
 pass(s.e.statusCalls.some(c=>c.name==='stun'&&c.seconds===1.15),
   'only physical entry triggers one real native stun');
 pass(s.kit.snapshot().rivet.phase==='CLAMPED','RIVET holds the trap while lock active');
 const countAtHit=s.e.statusCalls.length;
 s.kit.tick(.4);
 pass(s.e.statusCalls.length===countAtHit,'no repeated contact status every frame');
 s.kit.tick(.85);
 pass(s.kit.snapshot().rivet.phase==='READY','RIVET resumes after lock interval');
 pass(!s.kit.press('J').ok,'RIVET J respects cooldown after valid clamp');
 s.kit.tick(12);
 pass(s.kit.press('K').ok,'RIVET K is playable after J, independent cooldown');
 pass(s.kit.mitigate(s.r,100)===45,'real 100 damage is reduced to 45, not fake healed');
 pass(s.kit.mitigate(s.t,100)===100,'RIVET armor never reduces T.O.T damage');
 s.kit.tick(3.1);
 pass(s.kit.mitigate(s.r,100)===100,'exact 3-second armor expiry');
}
{
 const s=session();s.n.withdrawn=true;s.t.withdrawn=true;
 s.e.x=425;s.e.y=180; // Already inside native catch radius at cast.
 pass(s.kit.press('J').ok,'intercept may plant while enemy is already nearby');
 s.kit.tick(.1);
 pass(!s.e.statusCalls.length,'no instant cast-on-occupied-square cheat');
 s.e.x=780;s.kit.tick(.1);
 s.e.x=575;s.kit.tick(.1); // native non-overlap reentry at distance 175
 pass(s.e.statusCalls.length===1,'must leave and re-enter the actual zone');
}
console.log('B6n native companion contract checks:',count);
