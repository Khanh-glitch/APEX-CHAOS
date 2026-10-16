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
function shot(t,hand='L',kind='aq_bullet',preferHand=false){
  const state=t.ct.store.__boxeBattle;
  const h=state.flurry?.hands[hand]|| (hand==='L'?state.rocket:state.secondary);
  assert.ok(h,'shot needs actual glove');
  const x=h.x,y=h.y;
  const p={aq:true,life:2,type:kind,weapon:'PISTOL',owner:t.foe,
    px:preferHand?x:x-120,py:y,x:preferHand?x+1:x+120,y,
    radius:6,vx:1400,vy:0};
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
  shot(t,'L','aq_bullet',true);
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
// Owner follow-up: manual J recall is immediate, cancels all remaining
// attacks, and waits for BOTH physical catches before cooldown/A2 access.
{
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(.43);
  const st=t.ct.store.__boxeBattle;
  assert.ok(st.flurry&&st.secondary?.phase==='active');
  const committed=st.flurry.count;
  assert.ok(committed>0&&committed<24);
  // Move BOXE away BEFORE recall so real 1450u/s return travel is
  // measurably non-zero rather than immediately entering its catch radius.
  t.self.x=830;t.self.y=740;
  assert.equal(t.a1.recast(t.ctx),true);
  assert.equal(st.flurry,null,'manual A1 immediately ends remaining jab authority');
  assert.equal(st.rocket.phase,'returning');
  assert.equal(st.secondary.phase,'returning');
  assert.equal(t.ct.skills.A1.cdLeft,0,'no CD before the two returns');
  assert.equal(t.BX.executors['boxe.block_and_hit'].canCast(t.ctx),false,'A2 locked');
  t.step(.07);
  assert.equal(t.ct.skills.A1.cdLeft,0,'short recall travel is not an instant catch');
  t.step(.5);
  assert.equal(st.rocket,null);
  assert.equal(st.secondary,null);
  assert.ok(t.ct.skills.A1.cdLeft>14&&t.ct.skills.A1.cdLeft<=15,
    'cooldown is ticking only after both physical catches');
  assert.equal(t.BX.executors['boxe.block_and_hit'].canCast(t.ctx),true,'A2 regained');
  const end=t.events.filter(e=>e.name==='boxe:flurry-end');
  assert.equal(end.length,1,'early recall emits one Gold lifecycle finish');
  assert.equal(end[0].payload.reason,'manual-recall');
  assert.equal(end[0].payload.punches,committed);
  assert.ok(t.events.filter(e=>e.name==='boxe:flurry-punch').length<=committed,
    'no deferred phantom strikes after cancel');
  assert.equal(t.a1.recast(t.ctx),false,'recalled/caught skill never starts twice');
}
// A shot glove may already be returning or caught. Manual recall must STILL
// retrieve the other glove and must not restart the first glove's travel.
for(const hand of ['L','R']){
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(.32);
  const st=t.ct.store.__boxeBattle;
  shot(t,hand,'aq_bullet',true);
  t.step(.18);
  assert.ok(st.flurry,'one shot glove must not end the other glove combo');
  assert.equal(t.a1.recast(t.ctx),true,'manual recall works after individual hit');
  assert.equal(st.flurry,null);
  assert.ok(['returning','caught'].includes(st.rocket.phase));
  assert.ok(!st.secondary||st.secondary.phase==='returning');
  t.step(.7);
  assert.equal(st.rocket,null);
  assert.equal(st.secondary,null);
  assert.ok(t.ct.skills.A1.cdLeft>14&&t.ct.skills.A1.cdLeft<=15);
  assert.equal(t.events.filter(e=>e.name==='boxe:flurry-end').length,1);
}
// Natural completion after all 24 Gold jab beats auto-recovers BOTH hands,
// without allowing the primary Rocket to resume its old 5s outbound path.
{
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(.17);
  const st=t.ct.store.__boxeBattle;
  assert.ok(st.flurry);
  // Owner body is free to move; long real return proves no instantaneous CD.
  t.self.x=900;t.self.y=900;
  t.step(2.04);
  assert.ok(st.flurry||st.rocket,'Gold timeline in progress');
  t.step(.07);
  assert.equal(st.flurry,null,'all 24 beats completed');
  const ends=t.events.filter(e=>e.name==='boxe:flurry-end');
  assert.equal(ends.length,1);
  assert.equal(ends[0].payload.punches,24);
  assert.equal(ends[0].payload.reason,'completed');
  assert.equal(st.rocket?.phase,'returning');
  assert.equal(st.secondary?.phase,'returning');
  assert.equal(t.ct.skills.A1.cdLeft,0,'do not start cooldown at flurry end');
  t.step(1);
  assert.equal(st.rocket,null);
  assert.equal(st.secondary,null);
  assert.ok(t.ct.skills.A1.cdLeft>14&&t.ct.skills.A1.cdLeft<=15);
  const receipts=t.events.filter(e=>e.name==='boxe:rocket-cooldown-start');
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].payload.duration,15);
}
// Last jab of every Gold 6-beat phrase remains distinct without bonus HP,
// continuous stun or an artificial on-complete reward.
{
  const t=setup({enhanced:true});t.a1.cast(t.ctx);t.step(2.4);
  const punches=t.events.filter(e=>e.name==='boxe:flurry-punch');
  assert.equal(punches.length,24);
  for(const e of punches)
    if(e.payload.punchIndex%6===5)assert.equal(e.payload.heavy,true);
  assert.equal(punches.filter(e=>e.payload.heavy).length,4);
  assert.equal(t.foe.hp,1000,'all jabs still deal zero direct HP');
  assert.equal(t.events.filter(e=>e.name==='boxe:flurry-end').length,1);
}
console.log('PASS BOXE R5: relative impact, native push, zero A1 disarms, swept bullets, second glove, cargo, catch-only cooldown');
