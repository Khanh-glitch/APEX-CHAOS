// Owner-approved BOXE R5: Q1=A Q2=A Q3=A Q4=B Q5=A Q6=A Q7=A Q8=A Q9=A
// Independent deterministic native Battle physics fixture; no Gold/SFX mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../public/game/hero-rework/boxeBattleRuntime.js',import.meta.url),'utf8');
function setup({enhanced=false,enemyX=440,enemyY=500}={}){
  let time=0;
  const events=[],slots=[],held=new Map();
  const self={id:1,x:160,y:500,radius:75,hp:1000,dir:{x:1,y:0}};
  const foe={id:2,x:enemyX,y:enemyY,radius:75,hp:1000,__hrVel:{x:0,y:0}};
  const ct={heroId:'BOXE',side:'p1',anchor:self,store:{},skills:{
    A1:{cdLeft:0,cfg:{cooldown:15}},A2:{cdLeft:0}}};
  const other={heroId:'ROBOT',side:'p2',anchor:foe,store:{}};
  held.set(foe,{weaponId:'SMG',phase:'READY'});
  const scope={GAME_SIZE:1000,console,APEX_ARSENAL:{
    state:{slots},weaponApi:{
      getHolder:b=>held.get(b)||null,
      consume:b=>held.delete(b),
      equip:(b,id)=>{held.set(b,{weaponId:id,phase:'READY'});return true;},
      aqDamage:(b,value)=>{b.hp-=value;return value;}
    }
  },APEX_HERO_REWORK:{match:{combatants:[ct,other]}},
  APEX_HERO_REWORK_AIL:{clock:()=>time,bus:{emit:(name,payload)=>events.push({name,payload,time})}}};
  scope.globalThis=scope;
  vm.runInNewContext(src,scope);
  const BX=scope.APEX_BOXE_BATTLE;
  const ctx={combatant:ct,api:{
    clock:()=>time,emitEvent:(name,payload)=>events.push({name,payload,time}),
    enemyOf:()=>other,combatantOfBody:b=>b===self?ct:b===foe?other:null,
    applyStunTo:(b,dur)=>events.push({name:'STUN',b,dur,time}),
    moveHunterBody:(b,x,y)=>{b.x=x;b.y=y;},
    dropWeaponSlot:(id,x,y)=>{const slot={id:slots.length+1,weaponId:id,x,y,kind:'WEAPON',phase:'REVEALED'};
      slots.push(slot);return slot;}
  }};
  const a1=BX.executors['boxe.fist_rocket'],passive=BX.executors['boxe.heat'];
  function step(duration,dt=.01){for(let j=0;j<Math.ceil(duration/dt);j++){
    time+=dt;a1.onTick(ctx,dt);passive.onTick(ctx,dt);
  }}
  if(enhanced)passive.onRealizedDamage(ctx,{amount:300,creditedTo:ct,victimCombatant:other});
  return{BX,scope,ct,other,self,foe,a1,events,slots,held,ctx,step,
    get time(){return time;},set time(t){time=t;}};
}
function shot(t,hand='L',kind='aq_bullet'){
  const state=t.ct.store.__boxeBattle;
  const h=state.flurry?.hands[hand]|| (hand==='L'?state.rocket:state.secondary);
  assert.ok(h,'shot needs actual glove');
  const x=h.x,y=h.y;
  const p={aq:true,life:2,type:kind,weapon:'PISTOL',owner:t.foe,
    px:x-120,py:y,x:x+120,y,radius:6,vx:1400,vy:0};
  const c=t.BX.candidateProjectile(p);
  assert.ok(c,'moving physical bullet must sweep the real glove');
  assert.equal(c.hand,hand);
  assert.equal(t.BX.confirmProjectileContact(p,c),true);
  return{p,c};
}
// A1 remains an impact, not a disarm. Contact affects native stun+movement.
{
  const t=setup();t.a1.cast(t.ctx);t.step(.18);
  assert.ok(t.events.some(e=>e.name==='boxe:rocket-impact'));
  assert.ok(t.held.has(t.foe),'A1 must never consume opponent firearm');
  assert.equal(t.slots.length,0,'no artificial gun drop on Rocket hit');
  assert.ok(t.events.some(e=>e.name==='STUN'&&e.dur>0&&e.dur<=.35));
  const before=t.foe.x;t.step(.1);
  assert.ok(t.foe.x>before,'contact imparts real outward movement to victim');
}
// Per-contact stun is angle-dependent: no hidden immunity between distinct hits.
{
  const t=setup();t.a1.cast(t.ctx);t.step(.05);
  const r=t.ct.store.__boxeBattle.rocket;
  const full=t.BX.values.rocketStunSeconds;
  assert.equal(full,.35);
  assert.equal('rocketHitGap' in t.BX.values,false);
  assert.ok(r,'authentic active Rocket');
}
// Real off-centre swept contact must stun less than the same-speed head-on hit.
{
  const t=setup();t.a1.cast(t.ctx);
  t.foe.y=600; // 100px tangent offset, within the authentic 121px collision sum
  t.step(.26);
  const stun=t.events.find(e=>e.name==='STUN')?.dur||0;
  assert.ok(stun>0&&stun<.35,'normal impulse falls with glancing contact angle');
  assert.ok(t.events.some(e=>e.name==='boxe:rocket-reflect'));
}
// The PRIMARY glove may be shot too; only that hand returns, the other keeps Jabbing.
{
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(.32);
  const st=t.ct.store.__boxeBattle;
  assert.equal(st.flurry?.hands.R.phase,'active');
  shot(t,'L');
  assert.equal(st.rocket.phase,'returning');
  assert.equal(st.flurry.hands.R.phase,'active');
}
// Bullet against outbound glove changes ONLY its physical flight state.
{
  const t=setup({enemyX:900,enemyY:850});t.a1.cast(t.ctx);t.step(.07);
  const {c}=shot(t);
  assert.ok(c.t>=0&&c.t<=1);
  assert.equal(t.ct.store.__boxeBattle.rocket.phase,'returning');
  assert.equal(t.ct.skills.A1.cdLeft,0,'returning has not started cooldown');
  shot(t); // Q3A: another bullet while returning never resets the return
  assert.equal(t.ct.store.__boxeBattle.rocket.phase,'returning');
  t.step(.3);
  assert.equal(t.ct.store.__boxeBattle.rocket,null);
  assert.equal(t.ct.skills.A1.cdLeft,15,'physical catch starts cooldown');
}
// Q4B: two real gloves, independently returnable; another remains punching.
{
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(.19);
  const st=t.ct.store.__boxeBattle;
  assert.equal(st.rocket.phase,'flurry');
  assert.ok(st.secondary,'second glove must physically exist');
  t.step(.13);
  assert.equal(st.secondary.phase,'active');
  const before=st.flurry.count;
  shot(t,'R');
  assert.equal(st.secondary.phase,'returning','shot secondary glove returns immediately');
  assert.equal(st.flurry.hands.L.phase,'active','primary glove continues combo');
  t.step(.27);
  assert.ok(st.flurry.count>before,'Gold 85ms timeline not cancelled on partial glove recall');
  assert.equal(t.foe.hp,1000,'all BOXE A1 skills still deal zero HP');
}
// Q5A/Q6A: only authentic world-floor contact reserves at most one gun.
{
  const t=setup({enemyX:900,enemyY:850});t.a1.cast(t.ctx);
  const r=t.ct.store.__boxeBattle.rocket;
  t.slots.push({id:41,weaponId:'PISTOL',phase:'REVEALED',kind:'WEAPON',x:r.x+20,y:r.y});
  t.step(.01);
  assert.equal(r.cargoWeapon,'PISTOL');
  assert.equal(t.slots.length,0);
  shot(t);
  t.step(.3);
  assert.equal(t.held.get(t.self)?.weaponId,'PISTOL','hit bullet cannot steal carried cargo');
}
console.log('PASS BOXE R5: relative impact, native push, zero A1 disarms, swept bullets, second glove, cargo, catch-only cooldown');
