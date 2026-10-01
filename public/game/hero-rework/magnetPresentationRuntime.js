/* =============================================================================
 * MAGNET V1 — gameplay-to-Gold presentation adapter.
 * Reads authoritative Magnet state; never writes gameplay position or velocity.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_MAGNET_PRESENTATION) return;

  const HR = g.APEX_HERO_REWORK, AIL = g.APEX_HERO_REWORK_AIL;
  const MAG = g.APEX_MAGNET, GOLD = g.APEX_MAGNET_GOLD;
  const TAU = Math.PI * 2;
  const states = new Map();
  let unsubscribers = [], lastTickClock = -Infinity;
  const scheduler = { tickCalls:0, advancedFrames:0, duplicateCalls:0 };
  const clamp = (v,a,b) => v<a?a:(v>b?b:v);
  const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t); };

  function magnets() {
    const match = HR && HR.match;
    return match ? match.combatants.filter((ct) => !ct.facade && ct.heroId === 'MAGNET') : [];
  }
  function stateFor(ct) {
    let s=states.get(ct);
    if(!s){s={ct,a1Age:-1,a2Age:-1,hot:new Float32Array(24),late:[],corridors:[],projectileHistory:new Map(),lastGameplayA1:false,lastGameplayA2:false,preRoot:null,frameSample:null};states.set(ct,s);}
    return s;
  }
  function capturePreMovement() {
    const clock=AIL&&AIL.clock?AIL.clock():Number(g.matchClock)||0;
    for(const ct of magnets()){
      const a=ct.anchor;if(!a)continue;
      stateFor(ct).preRoot={x:a.x,y:a.y,clock};
    }
  }
  function byIndex(index) { return magnets().find((ct) => ct.idx === index) || null; }
  function onEvent(ev) {
    const p=ev&&ev.payload||{},ct=byIndex(p.combatantIndex);
    if(!ct)return;const s=stateFor(ct);
    if(ev.type==='MagnetA1Start'){s.a1Age=0;s.lastGameplayA1=true;GOLD.cue(ct,'a1',{x:0,y:0});}
    else if(ev.type==='MagnetA2Start'){s.a2Age=0;s.lastGameplayA2=true;GOLD.cue(ct,'a2');}
    else if(ev.type==='MagnetLateReveal'){s.late.push({slotId:p.slotId,age:0});if(s.late.length>8)s.late.shift();}
    else if(ev.type==='MagnetPassiveEmission'){
      GOLD.cue(ct,'passive',{angle:p.angle});
      s.corridors.push({x:p.x,y:p.y,angle:p.angle,age:0,duration:.42});if(s.corridors.length>8)s.corridors.shift();
    }
  }
  function subscribe() {
    if(!AIL||!AIL.bus)return;
    for(const type of ['MagnetA1Start','MagnetA2Start','MagnetLateReveal','MagnetPassiveEmission']) unsubscribers.push(AIL.bus.on(type,onEvent));
  }
  function collectHot(s, snapshot, dt) {
    for(let i=0;i<24;i++)s.hot[i]*=Math.exp(-dt*7);
    if(!(s.a2Age>=0&&s.a2Age<=1.8))return;
    const a=s.ct.anchor,objects=[];
    for(const q of snapshot.floorFirearms)objects.push({x:q.slot.x,y:q.slot.y,r:16});
    for(const q of snapshot.bodies)objects.push({x:q.body.x,y:q.body.y,r:q.body.radius||75});
    for(const q of snapshot.projectileInfluence)if(q.fields.some((f)=>f.owner===s.ct&&f.kind==='a2'))objects.push({x:q.projectile.x,y:q.projectile.y,r:q.projectile.radius||5});
    for(const o of objects){const dx=o.x-a.x,dy=o.y-a.y,d=Math.hypot(dx,dy);if(d>=225||d<=1)continue;const bin=((Math.atan2(dy,dx)/TAU+1)%1*24)|0,u=1-d/225;s.hot[bin]=Math.max(s.hot[bin],u*u);}
  }
  function collectProjectileHistory(s,snapshot) {
    const seen=new Set();
    for(const q of snapshot.projectileInfluence){if(!q.fields.some((f)=>f.owner===s.ct))continue;const p=q.projectile;seen.add(p);let h=s.projectileHistory.get(p);if(!h){h={points:[],stale:0};s.projectileHistory.set(p,h);}h.stale=0;h.points.push({x:p.x,y:p.y});if(h.points.length>20)h.points.shift();}
    for(const [p,h] of s.projectileHistory){if(!seen.has(p))h.stale++;if(h.stale>45||p.life<=0)s.projectileHistory.delete(p);}
  }
  function tick(dt) {
    scheduler.tickCalls++;
    const clock=AIL&&AIL.clock?AIL.clock():Number(g.matchClock)||0;
    if(clock===lastTickClock){scheduler.duplicateCalls++;return;}
    lastTickClock=clock;scheduler.advancedFrames++;
    const snapshot=MAG.inspect(clock);
    const live=new Set(magnets());
    for(const ct of live){const s=stateFor(ct),field=snapshot.fields.find((f)=>f.combatant===ct),a=ct.anchor;
      const pre=s.preRoot||{x:a.x,y:a.y,clock};
      s.frameSample={before:{x:pre.x,y:pre.y},after:{x:a.x,y:a.y},dt,clock};
      s.preRoot=null;
      const activeA1=!!(field&&field.a1Active),activeA2=!!(field&&field.a2Active);
      // Edge fallback protects casts accepted before this adapter subscribed.
      if(activeA1&&!s.lastGameplayA1){s.a1Age=0;GOLD.cue(ct,'a1',{x:0,y:0});}
      if(activeA2&&!s.lastGameplayA2){s.a2Age=0;GOLD.cue(ct,'a2');}
      s.lastGameplayA1=activeA1;s.lastGameplayA2=activeA2;
      if(s.a1Age>=0){s.a1Age+=dt;if(s.a1Age>1.6)s.a1Age=-1;}
      if(s.a2Age>=0){s.a2Age+=dt;if(s.a2Age>2.3)s.a2Age=-1;}
      for(const q of s.late)q.age+=dt;s.late=s.late.filter((q)=>q.age<.58);
      for(const q of s.corridors)q.age+=dt;s.corridors=s.corridors.filter((q)=>q.age<q.duration);
      collectHot(s,snapshot,dt);collectProjectileHistory(s,snapshot);GOLD.tick(ct,dt);
    }
    for(const ct of states.keys())if(!live.has(ct)){GOLD.teardown(ct);states.delete(ct);}
  }
  function a1Intensity(s){return s.a1Age>=0&&s.a1Age<=1?smooth(.06,.22,s.a1Age):0;}
  function a2Intensity(s){return s.a2Age>=0&&s.a2Age<=1.8?smooth(.14,.26,s.a2Age):0;}
  function floorFor(snapshot){return snapshot.floorFirearms.filter((q)=>q.slot&&q.slot.phase==='REVEALED');}
  function a1Targets(s,snapshot){
    const a=s.ct.anchor,out=floorFor(snapshot).map((q)=>({x:q.slot.x,y:q.slot.y,kind:'gun',object:q.slot,speed:Math.hypot(q.vx,q.vy)}));
    for(const q of snapshot.projectileInfluence)if(q.fields.some((f)=>f.owner===s.ct&&f.kind==='a1'))out.push({x:q.projectile.x,y:q.projectile.y,kind:'bullet',object:q.projectile,speed:Math.hypot(q.projectile.vx,q.projectile.vy)});
    out.sort((u,v)=>Math.hypot(u.x-a.x,u.y-a.y)-Math.hypot(v.x-a.x,v.y-a.y));return out.slice(0,2);
  }
  function poleTip(s,side){
    const rig=GOLD.inspect(s.ct).state?.rig,id=side===0?'polL':'polR',p=rig&&rig[id],a=s.ct.anchor,sign=side===0?-1:1;
    if(!p)return{x:a.x+sign*36,y:a.y-85};const px=sign*33,py=-5,x=sign*35.8+p.x,y=-85+p.y,rx=x-sign*px,ry=y-py,c=Math.cos(p.r),sn=Math.sin(p.r);return{x:a.x+sign*px+rx*c-ry*sn,y:a.y+py+rx*sn+ry*c};
  }
  function drawRibbon(ctx,points,color,alpha,width) {
    if(points.length<2)return;for(let pass=0;pass<3;pass++){ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.strokeStyle=pass===0?`rgba(30,27,22,${alpha*.34})`:pass===1?`rgba(221,162,36,${alpha*.38})`:`rgba(${color},${alpha*.62})`;ctx.lineWidth=width*(pass===0?2.8:pass===1?1.65:.58);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  }
  function drawHistories(ctx,s,snapshot,intensity){
    if(intensity<.03)return;for(const q of floorFor(snapshot))drawRibbon(ctx,q.history,'255,238,174',intensity,1.2);
    for(const h of s.projectileHistory.values())drawRibbon(ctx,h.points,'255,218,120',intensity,1);
  }
  function drawFloorDistortion(ctx,s,snapshot,intensity){
    if(intensity<.03)return;const a=s.ct.anchor,targets=a1Targets(s,snapshot);ctx.beginPath();for(let ring=1;ring<=3;ring++){const r=30+ring*22;for(let k=0;k<=24;k++){const ang=k/24*TAU,x=a.x+Math.cos(ang)*r,y=a.y+Math.sin(ang)*r;let ox=0,oy=0;for(const t of targets){const dx=x-t.x,dy=y-t.y,d=Math.hypot(dx,dy);if(d<92&&d>1){const u=1-d/92,f=6*intensity*u*u;ox+=(t.x-a.x)*f/Math.max(1,Math.hypot(t.x-a.x,t.y-a.y));oy+=(t.y-a.y)*f/Math.max(1,Math.hypot(t.x-a.x,t.y-a.y));}}if(k)ctx.lineTo(x+ox,y+oy);else ctx.moveTo(x+ox,y+oy);}}ctx.strokeStyle=`rgba(214,222,226,${.08*intensity})`;ctx.lineWidth=.8;ctx.stroke();
  }
  function drawA1Filaments(ctx,s,snapshot,intensity){
    if(intensity<.04)return;const targets=a1Targets(s,snapshot);for(let side=0;side<2;side++){const p=poleTip(s,side);for(let ti=0;ti<targets.length;ti++){const t=targets[ti],ex=t.x-p.x,ey=t.y-p.y,len=Math.hypot(ex,ey)||1;if(len<105)continue;const mx=(p.x+t.x)/2,my=(p.y+t.y)/2,bow=(side===0?-1:1)*(.12+.03*ti)*len*(ti?-.75:1),cx=mx-ey/len*bow,cy=my+ex/len*bow,u=1-(((AIL.clock()*1.55)+side*.37+ti*.21)%1),seg=.23;
      for(let pass=0;pass<2;pass++){ctx.beginPath();for(let k=0;k<=18;k++){const q=clamp(u-seg+seg*k/18,0,1),iv=1-q,x=iv*iv*p.x+2*iv*q*cx+q*q*t.x,y=iv*iv*p.y+2*iv*q*cy+q*q*t.y;if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.strokeStyle=pass?`rgba(255,239,178,${intensity*(ti?.16:.24)})`:`rgba(205,145,24,${intensity*(ti?.16:.28)})`;ctx.lineWidth=pass?.72:2.7;ctx.lineCap='round';ctx.stroke();}
      const q=(AIL.clock()*1.45+side*.31+ti*.16)%1,iv=1-q,bx=iv*iv*p.x+2*iv*q*cx+q*q*t.x,by=iv*iv*p.y+2*iv*q*cy+q*q*t.y,rg=ctx.createRadialGradient(bx,by,0,bx,by,7);rg.addColorStop(0,`rgba(255,252,226,${intensity*.7})`);rg.addColorStop(.35,`rgba(255,210,72,${intensity*.42})`);rg.addColorStop(1,'rgba(255,190,40,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(bx,by,7,0,TAU);ctx.fill();}}
  }
  function drawPressureFronts(ctx,s,snapshot,intensity){
    if(intensity<.05)return;for(const q of floorFor(snapshot)){const speed=Math.hypot(q.vx,q.vy);if(speed<140)continue;const ang=Math.atan2(q.vy,q.vx),r=17+clamp(speed/900,0,1)*9,alpha=intensity*clamp(speed/800,0,1),x=q.slot.x+Math.cos(ang)*11,y=q.slot.y+Math.sin(ang)*11;ctx.strokeStyle=`rgba(255,230,160,${alpha*.34})`;ctx.lineWidth=1.45;ctx.beginPath();ctx.arc(x,y,r,ang-.75,ang+.75);ctx.stroke();ctx.strokeStyle=`rgba(255,188,38,${alpha*.18})`;ctx.lineWidth=3.2;ctx.beginPath();ctx.arc(x,y,r+4,ang-.58,ang+.58);ctx.stroke();}
  }
  function drawLateRings(ctx,s,snapshot){
    const slots=g.APEX_ARSENAL?.state?.slots||[];for(const q of s.late){const slot=slots.find((x)=>x.id===q.slotId);if(!slot)continue;const k=q.age/.58,r=20+34*k,alpha=(1-k)*Math.min(1,q.age/.06)*.72;ctx.strokeStyle=`rgba(255,205,72,${alpha*.42})`;ctx.lineWidth=2.3;ctx.beginPath();ctx.arc(slot.x,slot.y,r,0,TAU);ctx.stroke();ctx.strokeStyle=`rgba(255,239,176,${alpha})`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(slot.x,slot.y,r-3,0,TAU);ctx.stroke();}
  }
  function drawA2(ctx,s,intensity){
    if(intensity<.025)return;const a=s.ct.anchor,defs=[[.08,.88,.42,1],[Math.PI-.08,.88,.42,1],[-.95,.60,.58,.82],[Math.PI+.95,.60,.58,.82],[.85,.70,.72,.72],[Math.PI-.85,.70,.72,.72],[-2.05,.50,.86,.58],[-1.1,.45,.92,.52],[2.2,.55,.82,.62],[.4,.40,.96,.46]],time=AIL.clock();for(let i=0;i<defs.length;i++){const d=defs[i],ang=d[0]+Math.sin(time*.32+i*1.7)*.07,bin=(((ang/TAU)%1+1)%1*24)|0,hot=Math.max(s.hot[bin],s.hot[(bin+1)%24]*.8,s.hot[(bin+23)%24]*.8),r=225*d[2]*(1+.02*Math.sin(time*1.4+i)),alpha=intensity*(.14+.92*hot)*(1.12-d[2]*.34);ctx.strokeStyle=`rgba(255,178,32,${alpha*.42})`;ctx.lineWidth=4.1*d[3]+hot*4;ctx.beginPath();ctx.arc(a.x,a.y-6,r,ang-d[1]/2,ang+d[1]/2);ctx.stroke();ctx.strokeStyle=`rgba(255,236,158,${Math.min(.82,alpha*1.08)})`;ctx.lineWidth=1.15*d[3]+hot*1.5;ctx.beginPath();ctx.arc(a.x,a.y-6,r,ang-d[1]/2,ang+d[1]/2);ctx.stroke();}
  }
  function drawObjectPressure(ctx,s,snapshot,intensity){
    if(intensity<.05)return;const a=s.ct.anchor,items=[];for(const q of floorFor(snapshot))items.push({x:q.slot.x,y:q.slot.y,r:16});for(const q of snapshot.bodies)items.push({x:q.body.x,y:q.body.y,r:q.body.radius||75});for(const q of snapshot.projectileInfluence)if(q.fields.some((f)=>f.owner===s.ct&&f.kind==='a2'))items.push({x:q.projectile.x,y:q.projectile.y,r:q.projectile.radius||5});let n=0;for(const o of items){const dx=o.x-a.x,dy=o.y-a.y,d=Math.hypot(dx,dy);if(d>=225||d<=1||n++>=8)continue;const ang=Math.atan2(dy,dx),span=clamp((o.r+22)/d,.08,.48),power=clamp((225-d)/120,0,1)*intensity,r=Math.max(70,d-o.r-5);for(let j=0;j<2;j++){ctx.strokeStyle=`rgba(255,214,82,${power*(j?.28:.62)})`;ctx.lineWidth=j?2.8:1.2;ctx.beginPath();ctx.arc(a.x,a.y-4,r-j*7,ang-span*(1+j*.2),ang+span*(1+j*.2));ctx.stroke();}}
  }
  function drawCorridors(ctx,s){for(const q of s.corridors){const k=q.age/q.duration,env=Math.sin(Math.PI*clamp(k,0,1))*.85,ux=Math.cos(q.angle),uy=Math.sin(q.angle),nx=-uy,ny=ux,width=14*(1-smooth(.25,.7,k));for(const side of [-1,1]){const gr=ctx.createLinearGradient(q.x,q.y,q.x+ux*170,q.y+uy*170);gr.addColorStop(0,`rgba(255,226,135,${env*.72})`);gr.addColorStop(1,'rgba(255,226,135,0)');ctx.strokeStyle=gr;ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(q.x+nx*width*side,q.y+ny*width*side);ctx.lineTo(q.x+ux*170+nx*width*.42*side,q.y+uy*170+ny*width*.42*side);ctx.stroke();}}}
  function isolated(ctx,fn){ctx.save();try{ctx.globalCompositeOperation='lighter';ctx.lineCap='round';fn();}finally{ctx.restore();}}
  function drawEffects(ctx,s,before){const snapshot=MAG.inspect(AIL.clock()),f1=a1Intensity(s),f2=a2Intensity(s);isolated(ctx,()=>{if(before){drawHistories(ctx,s,snapshot,f1);drawFloorDistortion(ctx,s,snapshot,Math.max(f1,f2));drawA2(ctx,s,f2);}else{drawA1Filaments(ctx,s,snapshot,f1);drawPressureFronts(ctx,s,snapshot,f1);drawObjectPressure(ctx,s,snapshot,f2);drawLateRings(ctx,s,snapshot);drawCorridors(ctx,s);}});}
  function drawStatus(ctx,f){if(!f||!f.hasStatus)return;ctx.save();ctx.translate(f.x,f.y);for(const [name,color,r] of [['freeze','#a6f4ff',18],['stun','#4fe8ff',22]])if(f.hasStatus(name)){ctx.strokeStyle=color;ctx.lineWidth=4;ctx.setLineDash([6,10]);ctx.beginPath();ctx.arc(0,0,(f.radius||75)+r,0,TAU);ctx.stroke();ctx.setLineDash([]);}ctx.restore();}
  function isMagnet(f){const ct=HR&&HR.byCombatant?HR.byCombatant(f):null;return ct&&ct.heroId==='MAGNET'?ct:null;}
  function installDraw(){const F=g.Fighter;if(!F?.prototype||F.prototype.__magnetPresentationWrapped)return;const previous=F.prototype.draw;F.prototype.__magnetPresentationWrapped=true;F.prototype.draw=function(ctx){const ct=isMagnet(this);if(ct&&this.hp>0&&GOLD.ready){const s=stateFor(ct);drawEffects(ctx,s,true);ctx.save();try{ctx.globalAlpha=this.hasStatus&&this.hasStatus('immune')?.55:1;GOLD.draw(ctx,ct);}finally{ctx.restore();}drawStatus(ctx,this);drawEffects(ctx,s,false);
      if(this===g.fighters?.[g.fighters.length-1]||this===g.fighters?.[1]){try{g.APEX_HUNTER_PRESENTATION?.renderPostWorld?.(ctx);}catch(e){}try{g.APEX_CRYSTALA_PRESENTATION?.renderWorldConstructsAndFx?.(ctx,false,true);g.APEX_CRYSTALA_PRESENTATION?.runBloomPass?.(ctx);}catch(e){}try{g.APEX_FROST_PRESENTATION?.renderPostWorld?.(ctx);}catch(e){}}return;}
    return previous.call(this,ctx);};}
  function teardown(){for(const ct of states.keys())GOLD.teardown(ct);states.clear();lastTickClock=-Infinity;}
  function installLifecycle(){const exit=g.exitArsenalQuestMode;if(exit&&!exit.__magnetPresentationWrapped){const wrapped=function(){teardown();return exit.apply(this,arguments);};wrapped.__hrWrapped=exit.__hrWrapped;wrapped.__magnetPresentationWrapped=true;g.exitArsenalQuestMode=wrapped;}}
  subscribe();installDraw();installLifecycle();
  g.APEX_MAGNET_PRESENTATION={version:'1.1.0-r1-clock',capturePreMovement,tick,drawEffects,teardown,inspect(ct){const s=states.get(ct);return{ready:GOLD.ready,stateCount:states.size,scheduler:{...scheduler},state:s&&{a1Age:s.a1Age,a2Age:s.a2Age,late:s.late.length,corridors:s.corridors.length,projectileHistories:s.projectileHistory.size,hot:[...s.hot],frameSample:s.frameSample}};}};
  g.apexMagnetPresentationRuntime='ready';
})(typeof window!=='undefined'?window:globalThis);
