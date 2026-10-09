/* Quest 01 E06: owner-revised companion abilities, native Arsenal-only.
 * Skills do not create weapons, damage, HP, checkpoints, or new actors.
 * Genuine weaponApi holders and actual Fighter bodies own all consequences.
 */
(function installQuestCompanionNative(root) {
'use strict';
if(root.APEX_QUEST_COMPANION_NATIVE)return;
const CONFIG=Object.freeze({
 'T.O.T':Object.freeze({
  J:Object.freeze({name:'WEAPON DASH',cooldown:10,windup:.26,dashSpeed:3400,
    maxDashTime:.55,turnRate:11,arriveRadius:34}),
  K:Object.freeze({name:'WEAPON RESERVE',window:2,afterDrawCooldown:8,failedWindowCooldown:3,
    minimumAiHold:1.5})
 }),
 RIVET:Object.freeze({
  J:Object.freeze({name:'FIELD INTERCEPT',cooldown:12,waitSeconds:2.4,
    // Real Fighter radii are 75+75; a 145 center-distance catch is
    // unreachable after native body collision separation. Keep a 40px
    // arrival band OUTSIDE the solid 150px combined collision diameter.
    catchRadius:190,lockSeconds:1.15}),
  K:Object.freeze({name:'VIRTUAL ARMOR',cooldown:10,duration:3,incomingMult:.45,
    ccImmunity:false})
 })
});
const PLAN=Object.freeze(['NEWBOT','T.O.T','RIVET']);
const finite=Number.isFinite;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=f=>!!f&&f.questTeam==='ALLY'&&f.hp>0&&f.withdrawn!==true;
const viable=f=>!!f&&f.questTeam==='HOSTILE'&&f.hp>0&&f.withdrawn!==true;
const deny=reason=>Object.freeze({ok:false,reason});
function create({actors,policy,weaponApi,state,log}={}){
 if(!Array.isArray(actors)||!policy?.abilityRecipient||!weaponApi?.getHolder||
    !state||actors.slice(0,3).map(a=>a?.questId).join('|')!==PLAN.join('|'))
    throw Error('E06 actual actor/weapon/policy authority required');
 const tot=actors[1],rivet=actors[2];
 const states={
   'T.O.T':{J:{cd:0,dash:null},K:{cd:0,phase:'READY',captureLeft:0,
     stored:null,storedAt:null}},
   RIVET:{J:{cd:0,phase:'READY',waitLeft:0,lockLeft:0,
     initialInside:new Set(),target:null},K:{cd:0,armorLeft:0}}
 };
 let closed=false,time=0;
 const events=[],visualBursts=[],dashTrail=[];
 const maxBurst=24;
 function emit(id,kind,more={}){
   const entry=Object.freeze({id,kind,at:time,...more});
   events.push(entry);log?.('QUEST_COMPANION_'+kind,id);
   if(['DASH_LOCK','DASH_LAUNCH','STORE_REAL_GUN','DRAW_STORED','RESERVE_WINDOW',
     'INTERCEPT_PLANT','PHYSICAL_INTERCEPT','INTERCEPT_RELEASE','ARMOR_ON','ARMOR_END'].includes(kind)){
     const actor=id==='T.O.T'?tot:rivet;
     visualBursts.push({x:actor.x,y:actor.y,kind,age:0});
     if(visualBursts.length>maxBurst)visualBursts.shift();
   }
   return entry;
 }
 function getId(){return closed?null:policy.abilityRecipient(actors);}
 function candidates(owner){return actors.filter(viable).sort((a,b)=>
   dist(a,owner)-dist(b,owner)||String(a.questId).localeCompare(String(b.questId)));}
 function floorWeapons(){
   return (state.slots||[]).filter(s=>s?.phase==='REVEALED'&&s.kind!=='HEAL'&&
     s.questNarrativeOnly!==true&&s.weaponId!=='STORMBREAKER'&&
     !s.weaponId?.startsWith?.('T6'));
 }
 function nearestPickup(owner){
   return floorWeapons().sort((a,b)=>dist(a,owner)-dist(b,owner))[0]||null;
 }
 function living(){
   return !closed&&state.questBreachEncounter===true&&state.active===true&&
     !state.over&&!state.questBreachStoryView?.active?.()&&
     state.questBreachRig?.snapshot?.().phase==='FRONTLINE_PASSIVE_HOLD';
 }
 function cast(owner,slot,source='manual'){
   if(!living()||!active(owner)||!CONFIG[owner?.questId])
     return deny('not-active-e06-companion');
   if(owner.hasStatus?.('stun')||owner.hasStatus?.('freeze')||
     owner.hasStatus?.('abilityDisabled'))return deny('disabled');
   const id=owner.questId,kit=states[id],s=kit[slot];
   if(!s)return deny('unknown-slot');
   if(s.cd>0)return deny('cooldown');
   if(id==='T.O.T'&&slot==='J'){
     const pickup=nearestPickup(owner);
     if(!pickup)return deny('no-physical-pickup');
     const heading=Math.atan2(pickup.y-owner.y,pickup.x-owner.x);
     s.dash={slotId:pickup.id,heading,windup:0,elapsed:0,launched:false};
     s.cd=CONFIG[id].J.cooldown;
     emit(id,'DASH_LOCK',{source,slotId:pickup.id});return {ok:true,kind:'dash'};
   }
   if(id==='T.O.T'&&slot==='K'){
     if(s.phase==='STORED'){
       if(weaponApi.getHolder(owner))return deny('hands-occupied');
       if(!s.stored||!owner.data)return deny('holder-lost');
       // SAME native holder object; cannot magically replenish ammo.
       owner.data.arsenal=s.stored;
       s.stored=null;s.storedAt=null;s.phase='READY';
       s.cd=CONFIG[id].K.afterDrawCooldown;
       emit(id,'DRAW_STORED',{source,weaponId:owner.data.arsenal.weaponId});
       return {ok:true,kind:'draw'};
     }
     if(s.phase==='CAPTURE')return deny('already-capturing');
     if(weaponApi.getHolder(owner))return deny('must-be-unarmed-to-reserve');
     s.phase='CAPTURE';s.captureLeft=CONFIG[id].K.window;
     emit(id,'RESERVE_WINDOW',{source,seconds:s.captureLeft});
     return {ok:true,kind:'prime'};
   }
   if(id==='RIVET'&&slot==='J'){
     if(s.phase!=='READY')return deny('interceptor-already-planted');
     s.phase='WAITING';s.waitLeft=CONFIG[id].J.waitSeconds;
     // Freeze the actual research chassis as a collision-static body.
     // Native Quest separation transfers overlap to the moving opponent.
     if(rivet.data)rivet.data.questResearchAnchored=true;
     s.initialInside=new Set(candidates(owner).filter(x=>
       dist(x,owner)<=CONFIG[id].J.catchRadius).map(x=>x.questId));
     s.target=null;s.cd=CONFIG[id].J.cooldown;
     emit(id,'INTERCEPT_PLANT',{source,atX:owner.x,atY:owner.y});
     return {ok:true,kind:'plant'};
   }
   if(id==='RIVET'&&slot==='K'){
     s.armorLeft=CONFIG[id].K.duration;s.cd=CONFIG[id].K.cooldown;
     emit(id,'ARMOR_ON',{source,duration:s.armorLeft,mult:CONFIG[id].K.incomingMult});
     return {ok:true,kind:'armor'};
   }
   return deny('unsupported');
 }
 function press(slot,source='manual'){
   if(slot!=='J'&&slot!=='K')return deny('unknown-slot');
   const id=getId();
   if(id==='NEWBOT')return deny('native-newbot-rework-owns-input');
   const owner=actors.find(a=>a?.questId===id);
   return cast(owner,slot,source);
 }
 function onRealPickup(owner,slot,holder){
   if(closed||!living()||owner!==tot||!active(owner)||
      !slot||slot.phase!=='PICKED_UP'||!holder||!owner.data||
      holder!==weaponApi.getHolder(owner))return false;
   const k=states['T.O.T'].K;
   if(k.phase!=='CAPTURE'||k.captureLeft<=0||k.stored)return false;
   if(holder.weaponId!==slot.weaponId||holder.consumed===true||
     holder.def?.category!=='ranged'||root.APEX_ARSENAL_CONFIG?.isGun?.(holder.weaponId)!==true)
     return false;
   // Physical Arsenal equip happened in the actual REVEALED-slot pickup
   // transaction. Remove holder immediately, BEFORE updateHolder can shoot.
   // Do NOT consume/cleanup/re-equip. One exact holder object becomes dormant.
   owner.data.arsenal=null;k.stored=holder;k.storedAt=time;
   k.phase='STORED';k.captureLeft=0;
   emit('T.O.T','STORE_REAL_GUN',{slotId:slot.id,weaponId:holder.weaponId});
   return true;
 }
 function cooldowns(dt){
   for(const skills of Object.values(states))
     for(const s of Object.values(skills))s.cd=Math.max(0,s.cd-dt);
 }
 function tickDash(dt){
   const s=states['T.O.T'].J,d=s.dash;
   if(!d)return;
   if(!active(tot)){s.dash=null;return;}
   const slot=(state.slots||[]).find(x=>x.id===d.slotId&&x.phase==='REVEALED');
   if(!slot){s.dash=null;return;}
   tot.data.positionLocked=true;
   if(!d.launched){
     d.windup+=dt;
     if(d.windup<CONFIG['T.O.T'].J.windup)return;
     d.launched=true;emit('T.O.T','DASH_LAUNCH',{slotId:d.slotId});
   }
   const cfg=CONFIG['T.O.T'].J;
   d.elapsed+=dt;
   const target=Math.atan2(slot.y-tot.y,slot.x-tot.x);
   const delta=Math.atan2(Math.sin(target-d.heading),Math.cos(target-d.heading));
   d.heading+=Math.max(-cfg.turnRate*dt,Math.min(cfg.turnRate*dt,delta));
   const dx=Math.cos(d.heading),dy=Math.sin(d.heading);
   tot.setDir?.(dx,dy);
   // Same native-world body movement and wall resolution as Robot A1.
   tot.x+=dx*cfg.dashSpeed*dt;tot.y+=dy*cfg.dashSpeed*dt;
   dashTrail.push({x:tot.x,y:tot.y,dx,dy,age:0});if(dashTrail.length>12)dashTrail.shift();
   if(dist(tot,slot)<=cfg.arriveRadius||d.elapsed>=cfg.maxDashTime)s.dash=null;
 }
 function tickIntercept(dt){
   const s=states.RIVET.J;
   if(s.phase==='READY'){
     if(rivet.data)rivet.data.questResearchAnchored=false;
     return;
   }
   if(!active(rivet)||rivet.hasStatus?.('stun')||rivet.hasStatus?.('freeze')){
     s.phase='READY';s.target=null;
     if(rivet.data)rivet.data.questResearchAnchored=false;
     return;
   }
   if(rivet.data)rivet.data.questResearchAnchored=true;
   if(s.phase==='WAITING'){
     rivet.data.positionLocked=true;s.waitLeft-=dt;
     const radius=CONFIG.RIVET.J.catchRadius;
     const near=candidates(rivet);
     let caught=null;
     for(const enemy of near){
       const inside=dist(enemy,rivet)<=radius;
       if(inside&&!s.initialInside.has(enemy.questId)){caught=enemy;break;}
       if(!inside)s.initialInside.delete(enemy.questId);
     }
     if(caught){
       caught.applyStatus?.('stun',CONFIG.RIVET.J.lockSeconds,{source:rivet});
       s.target=caught;s.phase='CLAMPED';s.lockLeft=CONFIG.RIVET.J.lockSeconds;
       emit('RIVET','PHYSICAL_INTERCEPT',{victim:caught.questId});
     }else if(s.waitLeft<=0){
       s.phase='READY';
       if(rivet.data)rivet.data.questResearchAnchored=false;
       emit('RIVET','INTERCEPT_TIMEOUT');
     }
   }else if(s.phase==='CLAMPED'){
     rivet.data.positionLocked=true;s.lockLeft-=dt;
     if(!viable(s.target)||s.lockLeft<=0){
       s.phase='READY';s.target=null;
       if(rivet.data)rivet.data.questResearchAnchored=false;
       emit('RIVET','INTERCEPT_RELEASE');
     }
   }
 }
 function ai(){
   const recipient=getId();
   if(!recipient||!living())return;
   if(recipient!=='T.O.T'&&active(tot)){
     const floor=nearestPickup(tot);
     const k=states['T.O.T'].K;
     if(k.phase==='STORED'){
       const nearest=candidates(tot)[0];
       const enemyDistance=nearest?dist(tot,nearest):Infinity;
       const age=time-(k.storedAt??time);
       const nearFreshWeapon=floor&&dist(tot,floor)<=300;
       const teamDanger=actors.slice(0,3).some(a=>a!==tot&&
         active(a)&&a.hp/Math.max(1,a.maxHp)<=.28);
       const enemyArmed=nearest&&!!weaponApi.getHolder(nearest);
       const imminent=enemyDistance<=270&&enemyArmed;
       const emergency=tot.hp<=390||teamDanger;
       const drought=age>=6&&enemyDistance<=470&&!nearFreshWeapon;
       // Tactical reserve: keep the genuine gun across calm moments and
       // future waves, try picking an ordinary floor gun first. Early draw
       // is reserved for credible danger, never elapsed-time spam.
       const shouldDraw=(emergency&&enemyDistance<650)||
         (age>=CONFIG['T.O.T'].K.minimumAiHold&&imminent&&!nearFreshWeapon)||
         drought;
       if(!weaponApi.getHolder(tot)&&shouldDraw)cast(tot,'K','ai');
     }else{
       if(k.phase==='READY'&&k.cd<=0&&!weaponApi.getHolder(tot)&&
         floor&&dist(tot,floor)<540)cast(tot,'K','ai');
       const j=states['T.O.T'].J;
       if(j.cd<=0&&!j.dash&&!weaponApi.getHolder(tot)&&floor&&
          dist(tot,floor)<650)cast(tot,'J','ai');
     }
   }
   if(recipient!=='RIVET'&&active(rivet)){
     const enemies=candidates(rivet),near=enemies[0],d=near?dist(near,rivet):Infinity;
     const j=states.RIVET.J,k=states.RIVET.K;
     if(j.cd<=0&&j.phase==='READY'&&d>170&&d<410){
       const dx=rivet.x-near.x,dy=rivet.y-near.y;
       const dir=near.dir||{x:0,y:0};
       if(dx*dir.x+dy*dir.y>d*.33)cast(rivet,'J','ai');
     }
     if(k.cd<=0&&k.armorLeft<=0&&d<420&&
       (rivet.hp<=620||!!weaponApi.getHolder(near)))
       cast(rivet,'K','ai');
   }
 }
 function tick(dt){
   if(!living()||!finite(dt)||dt<=0)return;
   time+=dt;cooldowns(dt);
   for(let i=visualBursts.length-1;i>=0;i--){visualBursts[i].age+=dt;if(visualBursts[i].age>.48)visualBursts.splice(i,1);}
   for(let i=dashTrail.length-1;i>=0;i--){dashTrail[i].age+=dt;if(dashTrail[i].age>.28)dashTrail.splice(i,1);}
   const k=states['T.O.T'].K;
   if(k.phase==='CAPTURE'){
     k.captureLeft=Math.max(0,k.captureLeft-dt);
     if(k.captureLeft===0){
       k.phase='READY';k.cd=CONFIG['T.O.T'].K.failedWindowCooldown;
       emit('T.O.T','RESERVE_EXPIRED');
     }
   }
   if(states.RIVET.K.armorLeft>0){
     states.RIVET.K.armorLeft=Math.max(0,states.RIVET.K.armorLeft-dt);
     if(states.RIVET.K.armorLeft===0)emit('RIVET','ARMOR_END');
   }
   ai();tickDash(dt);tickIntercept(dt);
 }
 function mitigate(f,amount){
   if(closed||!finite(amount)||amount<0)return amount;
   const armor=states.RIVET.K.armorLeft;
   return f===rivet&&active(f)&&armor>0?
     amount*CONFIG.RIVET.K.incomingMult:amount;
 }
 function skillProjection(){
   const id=getId();
   if(!CONFIG[id])return null;
   return ['J','K'].map(slot=>{
     const cfg=CONFIG[id][slot],s=states[id][slot];
     const phase=id==='T.O.T'&&slot==='K'?s.phase:null;
     const label=phase==='STORED'?'DRAW '+s.stored.weaponId:
       phase==='CAPTURE'?'RESERVE · '+Math.ceil(s.captureLeft*10)/10+'S':
       id==='RIVET'&&slot==='J'&&s.phase!=='READY'?'INTERCEPT · '+s.phase:
       cfg.name;
     return {name:label,cd:cfg.cooldown||cfg.afterDrawCooldown||10,
       nextIn:s.cd,charges:1,max:1,truth:true,
       kind:phase==='STORED'?'stored':'cooldown',
       duration:cfg.duration||0,storedWeapon:phase==='STORED'?
         s.stored.weaponId:null};
   });
 }
 function draw(ctx){
   if(closed||!ctx||!living())return;
   const t=states['T.O.T'],v=states.RIVET;
   ctx.save();
   // Ivory/amber exhaust ribbons are the REAL T.O.T dash sample positions.
   // No separate dash silhouette, virtual hitbox, or synthetic gun pickup.
   for(const s of dashTrail){
     const k=Math.max(0,1-s.age/.28);ctx.save();ctx.globalAlpha=k*.65;
     ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.dy,s.dx));
     for(const side of [-1,1]){
       ctx.strokeStyle=side===1?'#ffe0a4':'#f7aa46';ctx.lineWidth=2+3*k;
       ctx.beginPath();ctx.moveTo(-18,side*17);
       ctx.quadraticCurveTo(-42-19*k,side*(23+7*k),-95*k,side*11);ctx.stroke();
     }
     ctx.restore();
   }
   if(active(tot)&&(t.K.phase==='CAPTURE'||t.K.phase==='STORED')){
     ctx.save();ctx.translate(tot.x,tot.y);
     ctx.rotate(Math.atan2(tot.dir?.y||0,tot.dir?.x||1));
     const held=t.K.phase==='STORED',u=held?1:1-t.K.captureLeft/CONFIG['T.O.T'].K.window;
     ctx.shadowColor='#f4b756';ctx.shadowBlur=held?11:7;ctx.lineWidth=2.8;
     ctx.strokeStyle='#ffe3ae';ctx.fillStyle='rgba(128,76,25,.72)';
     ctx.beginPath();ctx.moveTo(-20,10);ctx.lineTo(20,10);
     ctx.lineTo(17,31);ctx.lineTo(-17,31);ctx.closePath();ctx.fill();ctx.stroke();
     ctx.shadowBlur=0;
     // Sliding magnetic jaws close on genuine stored holder.
     const open=held?0:8*(1-u);
     for(const side of [-1,1]){
       ctx.strokeStyle='#ffdb91';ctx.lineWidth=3.2;
       ctx.beginPath();ctx.moveTo(side*(19+open),8);
       ctx.lineTo(side*(11+open),17);ctx.lineTo(side*(10+open),25);ctx.stroke();
     }
     ctx.fillStyle=held?'#fff4d7':'#ffa94c';ctx.globalAlpha=.65+.35*Math.sin(time*12)**2;
     ctx.fillRect(-12,19,24*(held?1:Math.max(.08,1-u)),3);
     ctx.restore();
   }
   if(active(rivet)&&v.J.phase!=='READY'){
     const c=v.J,waiting=c.phase==='WAITING';
     const u=waiting?1-c.waitLeft/CONFIG.RIVET.J.waitSeconds:1;
     ctx.save();ctx.translate(rivet.x,rivet.y);
     const angle=time*(waiting?1.5:.25),radius=CONFIG.RIVET.J.catchRadius;
     // Bolted jaws, not an oversized magical disk. Ground radius is the real catch radius.
     for(let i=0;i<4;i++){
       const a=i*Math.PI/2+angle,outer=radius*(.88+.12*u);
       ctx.save();ctx.rotate(a);ctx.strokeStyle=waiting?'rgba(244,188,98,.69)':'#fce1a1';
       ctx.lineWidth=2.6+u;ctx.beginPath();ctx.arc(0,0,outer,-.31,.31);ctx.stroke();
       ctx.beginPath();ctx.moveTo(outer-18,-8);ctx.lineTo(outer+4,0);ctx.lineTo(outer-18,8);ctx.stroke();
       ctx.restore();
     }
     for(const side of [-1,1]){
       const rr=Math.max(26,rivet.radius||68),yy=side*rr*.64;
       ctx.strokeStyle='#e6b56b';ctx.lineWidth=5;
       ctx.beginPath();ctx.moveTo(-rr*.3,yy);ctx.lineTo(-rr*.53,yy+side*17);
       ctx.lineTo(-rr*.86,yy+side*17);ctx.stroke();
     }
     ctx.restore();
     if(c.phase==='CLAMPED'&&viable(c.target)){
       ctx.save();ctx.translate(c.target.x,c.target.y);
       const rr=(c.target.radius||68)+13;
       for(let i=0;i<4;i++){
         const a=i*Math.PI/2+Math.PI/4;
         ctx.save();ctx.rotate(a);ctx.strokeStyle='#ffcf86';ctx.lineWidth=6;
         ctx.beginPath();ctx.moveTo(rr-14,-15);ctx.lineTo(rr+2,-9);
         ctx.lineTo(rr+2,9);ctx.lineTo(rr-14,15);ctx.stroke();ctx.restore();
       }
       ctx.restore();
     }
   }
   if(active(rivet)&&v.K.armorLeft>0){
     const remaining=Math.max(0,v.K.armorLeft/CONFIG.RIVET.K.duration),r=(rivet.radius||72)+13;
     ctx.save();ctx.translate(rivet.x,rivet.y);
     const sway=(1-remaining)*.13;
     for(let i=0;i<6;i++){
       const a=(i+.5)*Math.PI/3+sway,half=.34;
       ctx.strokeStyle=i%2?'rgba(255,209,120,.88)':'rgba(244,232,208,.92)';
       ctx.lineWidth=5;ctx.shadowColor='#e9a951';ctx.shadowBlur=7;
       ctx.beginPath();ctx.arc(0,0,r,a-half,a+half);ctx.stroke();
       ctx.shadowBlur=0;ctx.lineWidth=1;
       ctx.beginPath();ctx.arc(0,0,r+8,a-half*.8,a+half*.8);ctx.stroke();
     }
     ctx.restore();
   }
   for(const b of visualBursts){
     const q=Math.max(0,1-b.age/.48),t=1-q,isArmor=b.kind.indexOf('ARMOR')>=0;
     const isLock=b.kind.indexOf('INTERCEPT')>=0,rad=(isLock?90:isArmor?65:36)+t*(isLock?140:70);
     ctx.save();ctx.translate(b.x,b.y);ctx.globalAlpha=q*q*.65;
     ctx.strokeStyle=isArmor?'#8cddff':isLock?'#f2c079':'#ffda99';
     ctx.lineWidth=2.5+q*3;
     // Broken arcs signal finite gameplay windows, not a continuous collision volume.
     for(let i=0;i<4;i++){const a=i*Math.PI/2+time*.35;
       ctx.beginPath();ctx.arc(0,0,rad,a-.22,a+.22);ctx.stroke();}
     ctx.restore();
   }
   ctx.restore();
 }
 function snapshot(){
   const t=states['T.O.T'],v=states.RIVET;
   return Object.freeze({closed,time,currentRecipient:getId(),
    tot:{jCooldown:t.J.cd,dashing:!!t.J.dash,kCooldown:t.K.cd,phase:t.K.phase,
      captureLeft:t.K.captureLeft,storedWeapon:t.K.stored?.weaponId||null,
      storedAt:t.K.storedAt},
    rivet:{jCooldown:v.J.cd,phase:v.J.phase,waitLeft:v.J.waitLeft,
      lockLeft:v.J.lockLeft,armorLeft:v.K.armorLeft,kCooldown:v.K.cd},
    events:events.slice()});
 }
 function close(){
   closed=true;states['T.O.T'].J.dash=null;states['T.O.T'].K.stored=null;
   states.RIVET.J.phase='READY';states.RIVET.J.target=null;
   if(rivet.data)rivet.data.questResearchAnchored=false;
   states.RIVET.K.armorLeft=0;
 }
 return Object.freeze({press,tick,onRealPickup,mitigate,skillProjection,draw,snapshot,close,
   currentRecipient:getId});
}
root.APEX_QUEST_COMPANION_NATIVE=Object.freeze({CONFIG,create});
})(typeof window!=='undefined'?window:globalThis);
