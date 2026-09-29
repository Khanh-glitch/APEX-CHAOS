/* V10 presentation adapter. Gameplay owns casts, contact, statuses and expiry.
 * No standalone Stage.step/render/prey/projectile loop is installed. */
(function(g){
'use strict';if(g.APEX_HUNTER_PRESENTATION)return;
const G=g.APEX_HUNTER_GOLD,HR=g.APEX_HERO_REWORK,states=new WeakMap();let assets=null;
const api=g.APEX_HUNTER_PRESENTATION={ready:false};
G.load().then(a=>{assets=a;api.ready=true;}).catch(e=>{api.error=String(e);console.error('[Hunter V10 assets]',e);});
const scale=f=>2*(f.radius||75)/(555*.335),offset=98*.335;
function hunter(f){return HR.byCombatant(f)?.heroId==='HUNTER';}
function state(f){if(states.has(f))return states.get(f);const cv=document.createElement('canvas');cv.width=cv.height=1;const s=new G.Stage(cv);s.auto=false;s.art=assets?.art||{};s.glow=assets?.glow||{};s.ready=!!assets;s.fighter=f;s.scale=scale(f);s.plantTrap=function(){G.Stage.prototype.plantTrap.call(this);this.pendingPlant=true;};states.set(f,s);sync(s);s.integrateHunter(0);return s;}
function sync(s){const f=s.fighter,k=s.scale=scale(f);s.h.x.x=s.h.px=f.x/k;s.h.y.x=s.h.py=f.y/k+offset;s.ground=s.h.py+(609-430)*.335;const ct=HR.byCombatant(f),enemy=HR.match?.combatants.find(c=>c!==ct)?.anchor;
 if(enemy){s.p.x=enemy.x/k;s.p.y=enemy.y/k;s.p.hy=enemy.y/k+offset-s.ground+665*.33*.55;s.p.vx=(enemy.__hrVel?.x||0)/k;s.p.rooted=HR.AIL.StatusResolver.has(enemy,'ROOT');s.p.weak=HR.AIL.StatusResolver.remaining(enemy,'WEAK');}
 s.coreY=()=>enemy?enemy.y/k:s.h.py;s.solveIntercept=()=>({x:s.p.x,y:s.coreY(),t:0});
}
api.idle=f=>api.ready&&state(f).h.mode==='idle';
api.begin=(f,kind)=>{const s=state(f);sync(s);s.h.x.v=s.h.y.v=0;s.pendingPlant=false;if(kind==='a1')s.startA1();else s.startA2();};
api.advanceA1=(f,dt)=>{const s=state(f);sync(s);const x=s.h.x.x;s.updA1(dt);const dx=(s.h.x.x-x)*s.scale,plant=s.pendingPlant;s.pendingPlant=false;return{dx,plant,done:s.h.mode==='idle'};};
api.prelaunch=(f,dt)=>{const s=state(f);sync(s);s.updA2(dt*(.665/.16));};
api.travel=(f,heading,dt)=>{const s=state(f);sync(s);const A=s.a2;if(!A.dist){A.dist=1;A.total=Infinity;A.speed=0;A.dir=heading;A.oldDir=heading;s.launchBurst(heading);}if(!A.corrected&&Math.abs(G.core.angWrap(heading-A.oldDir))>.08){s.correctionBurst(G.core.angWrap(heading-A.oldDir));A.corrected=true;}A.dir=heading;s.updA2(dt);};
api.catch=f=>{const s=state(f);sync(s);s.h.phase='CATCH';s.h.t=0;s.catchImpact();};
api.miss=f=>{const s=state(f);s.h.phase='RECOVER';s.h.t=0;s.a2.dist=1;s.recSet=false;};
api.dodge=(f,nx,ny)=>{const s=state(f);sync(s);s.pr.vx=-nx;s.startDodge();s.dodgeDir=nx<0?-1:1;};
api.trapCreated=t=>{t.visual={tr:{on:true,x:t.x,y:t.y,phase:t.phase,t:0,lift:{x:0}},_rtImgs:assets?.root};};
api.trapTick=(t,dt)=>{if(!t.visual)api.trapCreated(t);const v=t.visual;v._rtImgs=assets?.root;v.tr.phase=t.phase;v.tr.t=t.phaseTime;G.rtUpdate(v,dt);};
api.tick=dt=>{if(!api.ready)return;for(const ct of HR.match?.combatants||[]){if(ct.heroId!=='HUNTER')continue;const s=state(ct.anchor);sync(s);s.time+=dt;
 const mode=s.h.mode;
 if(mode==='idle'){s.h.vx=(ct.anchor.__hrVel?.x||0)/s.scale;s.updIdle(dt);}
 else if(mode==='dodge')s.updDodge(dt);
 else if(mode==='a2'&&!ct.store.__hunterAction)s.updA2(dt);
 // Authoritative body is always the render anchor, including wall-shortened recoil.
 sync(s);s.integrateHunter(0);s.updateAura(dt);s.fx.update(dt);s.ribL.prune(s.time);s.ribR.prune(s.time);s.ribC.prune(s.time);
 for(const e of s.echoes)e.t-=dt;s.echoes=s.echoes.filter(e=>e.t>0);
 }};
function body(c,f){const s=state(f);sync(s);s.integrateHunter(0);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);const m=c.getTransform(),v=new G.rig.Xf().set(m.a,m.b,m.c,m.d,m.e,m.f);s.drawEchoes(c,v);s.drawAura(c,v);s.drawHunter(c,v,s.pose,1);s.ribL.draw(c,s.time);s.ribR.draw(c,s.time);c.restore();const holder=g.APEX_ARSENAL.weaponApi.getHolder(f);if(holder)g.APEX_ARSENAL_AV?.drawEquippedWeapon(c,f,holder);}
function layer(c,which){if(!api.ready||!HR.match)return;for(const t of HR.match.world.snares){if(!t.visual)continue;const k=scale(t.owner.anchor),v=t.visual;v.tr.x=t.x/k;v.tr.y=t.y/k;c.save();c.scale(k,k);G.rtDraw(v,c,null,which);c.restore();}}
const baseProjectiles=g.drawProjectiles;g.drawProjectiles=function(c){baseProjectiles(c);layer(c,'back');for(const ct of HR.match?.combatants||[])if(ct.heroId==='HUNTER'&&api.ready){const s=state(ct.anchor);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.fx.draw(c,false);c.restore();}};
const baseDraw=g.Fighter.prototype.draw;g.Fighter.prototype.draw=function(c){if(hunter(this)){if(api.ready&&this.hp>0)body(c,this);else if(!api.ready){c.save();c.fillStyle='#c8ff5e';c.font='12px monospace';c.fillText(api.error?'HUNTER ASSET ERROR':'LOADING HUNTER',this.x-65,this.y);c.restore();}}else baseDraw.call(this,c);if(this===g.fighters?.[1]){layer(c,'front');for(const ct of HR.match?.combatants||[])if(ct.heroId==='HUNTER'&&api.ready){const s=state(ct.anchor);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.fx.draw(c,true);c.restore();}layer(c,'fx');}};
api.inspect=f=>{const s=state(f);return{mode:s.h.mode,phase:s.h.phase,scale:s.scale,pose:{...s.pose}};};api.cacheStats=G.cacheStats;
g.apexHunterPresentationRuntime='ready';
})(window);
