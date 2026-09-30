/* V10 presentation adapter. Gameplay owns casts, contact, statuses and expiry.
 * No standalone Stage.step/render/prey/projectile loop is installed.
 * POST-PLAYTEST 2026-09-29: cast-local finite A1 recoil (no frame feedback
 * loop), Gold WEAK convergence visual bound to the real combatant debuff,
 * persistent aura clone removed (echoes only at high speed), trap footprint
 * measured from the rendered 40%-scale object, owner SFX event dispatch. */
(function(g){
'use strict';if(g.APEX_HUNTER_PRESENTATION)return;
const G=g.APEX_HUNTER_GOLD,HR=g.APEX_HERO_REWORK,states=new WeakMap();let assets=null;
const api=g.APEX_HUNTER_PRESENTATION={ready:false,trapWorldRadius:0};
G.load().then(a=>{assets=a;api.ready=true;measure();}).catch(e=>{api.error=String(e);console.error('[Hunter V10 assets]',e);});
const scale=f=>2*(f.radius||75)/(555*.335),offset=98*.335;
function hunter(f){return HR.byCombatant(f)?.heroId==='HUNTER';}
function state(f){if(states.has(f))return states.get(f);const cv=document.createElement('canvas');cv.width=cv.height=1;const s=new G.Stage(cv);s.auto=false;s.art=assets?.art||{};s.glow=assets?.glow||{};s.ready=!!assets;s.fighter=f;s.scale=scale(f);s.a1Motion=null;s.plantTrap=function(){G.Stage.prototype.plantTrap.call(this);this.pendingPlant=true;};states.set(f,s);sync(s);s.integrateHunter(0);return s;}
function sync(s,rigPos=true){const f=s.fighter,k=s.scale=scale(f);if(rigPos){s.h.x.x=s.h.px=f.x/k;s.h.y.x=s.h.py=f.y/k+offset;}s.ground=s.h.py+(609-430)*.335;const ct=HR.byCombatant(f),enemy=HR.match?.combatants.find(c=>c!==ct)?.anchor;
 if(enemy){s.p.x=enemy.x/k;s.p.y=enemy.y/k;s.p.hy=enemy.y/k+offset-s.ground+665*.33*.55;s.p.vx=(enemy.__hrVel?.x||0)/k;s.p.rooted=HR.AIL.StatusResolver.has(enemy,'ROOT');}
 s.coreY=()=>enemy?enemy.y/k:s.h.py;s.solveIntercept=()=>({x:s.p.x,y:s.coreY(),t:0});
}
// Measured visible world footprint of the rendered trap (horizontal extent),
// used to calibrate the gameplay trigger envelope to the visible object.
function measure(){if(!assets?.root)return;const k=scale({radius:75});const cv=document.createElement('canvas');cv.width=cv.height=640;const c=cv.getContext('2d');
 const st={tr:{on:true,x:0,y:0,phase:'unfold',t:0,lift:{x:0}},_rtImgs:assets.root};
 for(let i=0;i<50;i++){st.tr.t+=1/60;st.tr.phase=st.tr.t<.62?'unfold':'armed';G.rtUpdate(st,1/60);}
 c.save();c.translate(320,320);c.scale(k,k);G.rtDraw(st,c,null,'back');G.rtDraw(st,c,null,'front');c.restore();
 const d=c.getImageData(0,0,640,640).data;let maxX=0,maxY=0;
 for(let y=0;y<640;y++)for(let x=0;x<640;x++){if(d[(y*640+x)*4+3]>10){maxX=Math.max(maxX,Math.abs(x-320));maxY=Math.max(maxY,Math.abs(y-320));}}
 api.trapWorldRadius=Math.max(24,maxX/k* k); // world px at k scale == canvas px here
 api.trapMeasure={maxX,maxY,k};}
api.idle=f=>api.ready&&state(f).h.mode==='idle';
api.begin=(f,kind)=>{const s=state(f);sync(s);s.h.x.v=s.h.y.v=0;s.pendingPlant=false;
 if(kind==='a1'){
  // Independent Gold motion reference: never feed production body coordinates
  // back into the recoil spring.
  s.a1Motion={x:G.core.spring(340),px:340,offset:0,goldT:0,timeScale:1,dilate:0};
  s.timeScale=1;s.dilate=0;s.tsTarget=1;
  s.startA1();
 }else s.startA2();};
api.advanceA1=(f,rdt)=>{const s=state(f);sync(s,false),m=s.a1Motion;
 // Canonical Gold Stage.step timing: the trap's plant burst can temporarily
 // set timeScale=.22/dilate=.035 via the real Gold plantTrap implementation.
 s.dilate=Math.max(0,(s.dilate||0)-rdt);
 s.tsTarget=s.dilate>0?.3:1;
 s.timeScale=G.core.decayTo(s.timeScale==null?1:s.timeScale,s.tsTarget,s.dilate>0?.012:.06,rdt);
 const dt=Math.min(.05,rdt)*s.timeScale;
 s.updA1(dt);
 if(m&&s.h.t>=.30){
  // Exact V10 executable law:
  // springRatio(h.x, clamp(h.px - 55, 130, WW - 130), .6, .34, dt)
  G.core.springRatio(m.x,G.core.clamp(m.px-55,130,1150),.6,.34,dt);
  m.px=m.x.x;m.offset=(340-m.x.x)*s.scale;m.goldT=s.h.t;
 }
 const plant=s.pendingPlant;s.pendingPlant=false;
 return{offset:m?m.offset:0,goldT:s.h.t,plant,done:s.h.mode==='idle'};};
api.prelaunch=(f,dt)=>{const s=state(f);sync(s);s.updA2(dt*(.665/.16));};
api.travel=(f,heading,dt)=>{const s=state(f);sync(s);const A=s.a2;if(!A.dist){A.dist=1;A.total=Infinity;A.speed=0;A.dir=heading;A.oldDir=heading;s.launchBurst(heading);}if(!A.corrected&&Math.abs(G.core.angWrap(heading-A.oldDir))>.08){s.correctionBurst(G.core.angWrap(heading-A.oldDir));A.corrected=true;}A.dir=heading;s.updA2(dt);};
api.catch=f=>{const s=state(f);sync(s);s.h.phase='CATCH';s.h.t=0;s.catchImpact();};
api.miss=f=>{const s=state(f);s.h.phase='RECOVER';s.h.t=0;s.a2.dist=1;s.recSet=false;};
api.trapCreated=t=>{t.visual={tr:{on:true,x:t.x,y:t.y,phase:t.phase,t:0,lift:{x:0}},_rtImgs:assets?.root};};
api.trapTick=(t,dt)=>{if(!t.visual)api.trapCreated(t);const v=t.visual;v._rtImgs=assets?.root;v.tr.phase=t.phase;v.tr.t=t.phaseTime;G.rtUpdate(v,dt);};
api.tick=dt=>{if(!api.ready||!HR.match)return;for(const ct of HR.match.combatants){if(ct.heroId!=='HUNTER')continue;const s=state(ct.anchor);sync(s,s.h.mode!=='a1');s.time+=dt;
 // Gold WEAK visual consumes the REAL combatant debuff; no private timer.
 const enemy=HR.match.combatants.find(c=>c!==ct);
 const rem=enemy?HR.match.api.weakRemaining(enemy):0;
 if(rem>0){if((s.p.weak||0)<=0){s.p.weak=8.6;s.p.weakPulse=1.2;for(const m of s.marks){m.r.x=2.6;m.r.v=-4.5;m.fl=1;}}else s.p.weak=Math.min(s.p.weak,rem*8.6);}
 else s.p.weak=0;
 const mode=s.h.mode;
 if(mode==='idle'){s.h.vx=(ct.anchor.__hrVel?.x||0)/s.scale;s.updIdle(dt);}
 else if(mode==='a2'&&!ct.store.__hunterAction)s.updA2(dt);
 sync(s,s.h.mode!=='a1');s.integrateHunter(0);s.updateMarks&&s.updateMarks(dt);s.fx.update(dt);s.ribL.prune(s.time);s.ribR.prune(s.time);s.ribC.prune(s.time);
 for(const e of s.echoes)e.t-=dt;s.echoes=s.echoes.filter(e=>e.t>0);
}};
function xfOf(c){const m=c.getTransform();return new G.rig.Xf().set(m.a,m.b,m.c,m.d,m.e,m.f);}
// AUDIT-E: the expensive actor source (drawHunter) renders exactly once per
// frame — into the palette offscreen when readability is active, straight to
// the main ctx otherwise. Echoes/ribbons/weapon are fx layers drawn to the
// main ctx only; they never feed the readability silhouette.
function echoesBefore(c,f){const s=state(f);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.drawEchoes(c,xfOf(c));c.restore();}
function actorCore(c,f){const s=state(f);sync(s);s.integrateHunter(0);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.drawHunter(c,xfOf(c),s.pose,1);c.restore();}
function fxAfter(c,f){const s=state(f);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.ribL.draw(c,s.time);s.ribR.draw(c,s.time);c.restore();}
// Equipped-weapon dispatch lives ONLY in the Arsenal quest weapon pass (single
// dispatch law); body() never draws the weapon a second time.
function body(c,f){const P=g.APEX_CHAMBER_PALETTE;echoesBefore(c,f);if(P&&P.actorRender&&P.isActive())P.actorRender(c,f,f.x,f.y,oc=>actorCore(oc,f));else actorCore(c,f);fxAfter(c,f);}
function layer(c,which){if(!api.ready||!HR.match)return;for(const t of HR.match.world.snares){if(!t.visual)continue;const k=scale(t.owner.anchor),v=t.visual;v.tr.x=t.x/k;v.tr.y=t.y/k;c.save();c.scale(k,k);G.rtDraw(v,c,null,which);c.restore();}}
function weakLayer(c){if(!api.ready||!HR.match)return;for(const ct of HR.match.combatants){if(ct.heroId!=='HUNTER')continue;const s=states.get(ct.anchor);if(!s||(s.p.weak||0)<=0)continue;c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.drawWeak(c);c.restore();}}
const baseProjectiles=g.drawProjectiles;g.drawProjectiles=function(c){baseProjectiles(c);layer(c,'back');for(const ct of HR.match?.combatants||[])if(ct.heroId==='HUNTER'&&api.ready){const s=state(ct.anchor);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.fx.draw(c,false);c.restore();}};
function postWorld(c){layer(c,'front');weakLayer(c);for(const ct of HR.match?.combatants||[])if(ct.heroId==='HUNTER'&&api.ready){const s=state(ct.anchor);c.save();c.scale(s.scale,s.scale);c.translate(0,-offset);s.fx.draw(c,true);c.restore();}layer(c,'fx');}
api.renderPostWorld=postWorld;
const baseDraw=g.Fighter.prototype.draw;g.Fighter.prototype.draw=function(c){if(hunter(this)){if(api.ready&&this.hp>0)body(c,this);else if(!api.ready){c.save();c.fillStyle='#c8ff5e';c.font='12px monospace';c.fillText(api.error?'HUNTER ASSET ERROR':'LOADING HUNTER',this.x-65,this.y);c.restore();}}else baseDraw.call(this,c);if(this===g.fighters?.[g.fighters.length-1]||this===g.fighters?.[1])postWorld(c);};
// Owner SFX semantics: event edges own playback; single dispatch layer.
(function(){const bus=HR.AIL.bus,emit=bus.emit;
 bus.emit=function(type,payload){
  const AV=g.APEX_ARSENAL_AV;
  if(AV&&AV.playHunter){switch(type){
   case 'Cast':if(payload&&payload.hero==='HUNTER'&&payload.slot==='A1')AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a1_charge_personal.mp3',{vol:.45});break; // personal controller cue
   case 'SnarePlaced':AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a1_deploy_mechanism.mp3',{vol:.7});break;
   case 'HunterTrapPhase':if(payload&&payload.phase==='armed')AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a1_unfold_blade.mp3',{vol:.7});break;
   case 'SnareTriggered':AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a1_clamp.mp3',{vol:.85});break;
   case 'PounceLaunch':AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a2_pounce_sweep.mp3',{vol:.75});break;
   case 'PounceWeak':if(payload&&payload.swept)AV.playHunter('/assets/hero-rework/hunter-v10/sfx/hunter_a2_catch_flesh.mp3',{vol:.85});break;
  }}
  return emit.apply(this,arguments);};
})();
api.inspect=f=>{const s=state(f),m=s.a1Motion;return{mode:s.h.mode,phase:s.h.phase,scale:s.scale,pose:{...s.pose},aura:s.auraAlpha?.x||0,echoes:s.echoes.length,weak:s.p.weak||0,
 a1:m?{offset:m.offset,goldT:m.goldT,refX:m.x.x,refPx:m.px,timeScale:s.timeScale}:null};};
api.cacheStats=G.cacheStats;
g.apexHunterPresentationRuntime='ready';
})(window);
