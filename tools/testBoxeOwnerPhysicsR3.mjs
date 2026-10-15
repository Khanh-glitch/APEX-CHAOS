import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../public/game/hero-rework/boxeBattleRuntime.js',import.meta.url),'utf8');
function setup(start={x:160,y:300,fx:440,fy:300}){
 let time=0;const events=[],slots=[];
 const self={id:1,x:start.x,y:start.y,radius:75,hp:1000,dir:{x:1,y:0}},foe={id:2,x:start.fx,y:start.fy,radius:75,hp:1000};
 const ct={heroId:'BOXE',anchor:self,store:{},skills:{A1:{cdLeft:0},A2:{cdLeft:0}}},other={heroId:'ROBOT',anchor:foe};
 const held=new Map([[foe,{weaponId:'SMG',phase:'READY'}]]);
 const scope={GAME_SIZE:1000,APEX_ARSENAL:{weaponApi:{getHolder:f=>held.get(f)||null,consume:f=>held.delete(f),equip:(f,id)=>{held.set(f,{weaponId:id,phase:'READY'});return true;},aqDamage:(f,v)=>{f.hp-=v;return v;}},state:{slots}},console};
 scope.globalThis=scope;vm.runInNewContext(src,scope);
 const BX=scope.APEX_BOXE_BATTLE;
 const ctx={combatant:ct,api:{clock:()=>time,emitEvent:(name,payload)=>events.push({name,payload,time}),enemyOf:()=>other,combatantOfBody:body=>body===self?ct:body===foe?other:null,applyStunTo:(body,duration)=>events.push({name:'stun',body,duration,time}),dropWeaponSlot:(weaponId,x,y)=>{const item={id:slots.length+1,weaponId,x,y,phase:'REVEALED',kind:'WEAPON'};slots.push(item);return item;}}};
 const rocket=BX.executors['boxe.fist_rocket'],passive=BX.executors['boxe.heat'];
 function step(duration,delta=0.01){for(let n=0;n<Math.ceil(duration/delta);n++){time+=delta;rocket.onTick(ctx,delta);passive.onTick(ctx,delta);}}
 return{self,foe,ct,ctx,BX,events,held,slots,rocket,passive,step,get time(){return time;},set time(v){time=v;}};
}
// Unempowered casts must survive becoming heated MID-FLIGHT and hit without flurry.
{
 const t=setup();assert.equal(t.rocket.cast(t.ctx),true);
 t.step(0.04);const r=t.ct.store.__boxeBattle.rocket;
 assert.ok(r.x>t.self.x+45&&r.x<t.self.x+65,`1250u/s expected, travelled ${r.x-t.self.x}`);
 t.passive.onRealizedDamage(t.ctx,{amount:301,victimCombatant:{},creditedTo:t.ct});
 assert.ok(t.BX.snapshot(t.ctx).enhancedUntil>t.time);
 t.step(.20);
 assert.ok(t.events.some(e=>e.name==='boxe:rocket-impact'));
 assert.equal(t.events.filter(e=>e.name==='boxe:flurry-start').length,0,'cast snapshot must not change on impact');
 const reflection=t.events.find(e=>e.name==='boxe:rocket-reflect'&&e.payload.from==='fighter');
 assert.ok(reflection,'opponent is a physical reflective body');
 assert.ok(reflection.payload.vx<0,'rocket leaves opponent in reversed direction');
 t.step(4.79);
 assert.ok(t.events.some(e=>e.name==='boxe:rocket-return'),'five second deadline controls return');
}
// Enhanced casts must persist over heat expiry; both gloves punch at impact site
// while BOXE moves elsewhere; keep precisely 85ms per jab, 42.5ms stun.
{
 const t=setup();t.passive.onRealizedDamage(t.ctx,{amount:300,creditedTo:t.ct,victimCombatant:{}});
 const initialEnhanced=t.BX.snapshot(t.ctx).enhancedUntil;
 t.time=initialEnhanced-.025; // near heat expiry, still enhanced at ACTUAL cast
 assert.equal(t.rocket.cast(t.ctx),true);
 assert.equal(t.BX.snapshot(t.ctx).rocket.enhanced,true);
 t.step(.16);
 const initial=t.BX.snapshot(t.ctx);
 assert.equal(initial.rocket.phase,'flurry','rocket must stop at contact');
 assert.ok(initial.flurry,'Gold key 1 combo begins at Rocket impact');
 const anchor={x:initial.flurry.x,y:initial.flurry.y};
 t.self.x=900;t.self.y=900; // owner may move normally while gloves stay behind
 t.step(.80);
 const after=t.BX.snapshot(t.ctx);
 assert.equal(after.rocket.phase,'flurry');
 assert.equal(after.flurry.x,anchor.x);assert.equal(after.flurry.y,anchor.y);
 assert.equal(after.rocket.x,anchor.x);assert.equal(after.rocket.y,anchor.y);
 assert.ok(after.flurry.count>=9,'fixed 85ms cadence continues without owner body');
 assert.equal(t.BX.snapshot(t.ctx).enhancedUntil,0,'heat expired during locked empowered skill');
 const stun=t.events.filter(e=>e.name==='stun'&&e.duration===.0425);
 assert.ok(stun.length>=8,'owner requested half-of-85ms stun');
 t.step(1.25);
 assert.equal(t.BX.snapshot(t.ctx).flurry,null,'full 2-second Gold jab window finishes');
 assert.ok(t.events.some(e=>e.name==='boxe:flurry-end'));
 assert.equal(t.events.filter(e=>e.name==='boxe:flurry-punch').length,24,'exact punch count');
 assert.equal(t.foe.hp,1000,'normal and enhanced jab never deal HP damage');
 assert.equal(t.events.some(e=>e.name==='boxe:counter-contact'),false,'flurry never executes A2');
 t.step(4.0);
 assert.equal(t.BX.snapshot(t.ctx).rocket,null,'Rocket returns after its five second cast lifetime');
}
// Wall bounce uses fighter's restitution axis reflection, independent of opponent.
{
 const t=setup({x:900,y:500,fx:50,fy:60});
 t.rocket.cast(t.ctx);t.step(.15);
 assert.ok(t.BX.snapshot(t.ctx).rocket.vx<0,'right edge reflects horizontal velocity');
 const speed=Math.hypot(t.BX.snapshot(t.ctx).rocket.vx,t.BX.snapshot(t.ctx).rocket.vy);
 assert.ok(Math.abs(speed-1250)<.01,'speed conserved on reflection');
}
console.log('PASS owner R3 physics: 1250u/s, solid fighter+wall reflection, 5s active, 2s anchored flurry, 85ms/42.5ms, activation snapshot, independent moving owner, no skill damage');