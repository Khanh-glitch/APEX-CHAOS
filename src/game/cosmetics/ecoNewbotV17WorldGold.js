// ECOBOT V17 Gold world-space FX adaptation (owner source: ECO_NEWBOT_RECYCLE_CORE_V17.html).
// Native Robot events/position/velocity are authoritative. NO actor physics, ability timers,
// collision, weapon ownership, damage or cooldowns are driven by this renderer.
// Gold motifs: V3 living leaves, 3-pass A1 ribbon, V5 volumetric wall material response.
import {drawEcoLeafGold} from './ecoNewbotV17Gold.js';

const TAU=Math.PI*2, states=new Map();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
function reset(side,now){const s={time:now,lastSerial:-1,rng:side==='p2'?75013:39127,
  leaves:[],puffs:[],flecks:[],history:[],dashEnd:-100,activeDash:false,leafClock:0,scuff:null,
  lastX:null,lastY:null,emissions:{a1:0,a2:0,hit:0,wall:0,passive:0}};
  states.set(side,s);return s;}
function rnd(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function leaf(s,x,y,dx,dy,opt={}){
 const life=opt.life||(.8+rnd(s)*1.4),v=opt.speed||35;
 s.leaves.push({x,y,vx:dx*v+(rnd(s)-.5)*65,vy:dy*v+(rnd(s)-.5)*75,
  age:0,life,size:opt.size||(6+rnd(s)*9),rot:rnd(s)*TAU,spin:(rnd(s)-.5)*8,
  drift:rnd(s)*TAU,kind:opt.kind||'leaf'});
 if(s.leaves.length>110)s.leaves.splice(0,s.leaves.length-110);
}
function burst(s,n,x,y,dx=0,dy=-1,kind='leaf'){
 for(let i=0;i<n;i++){const a=Math.atan2(dy,dx)+(rnd(s)-.5)*2.6;
  leaf(s,x+(rnd(s)-.5)*38,y+(rnd(s)-.5)*30,Math.cos(a),Math.sin(a),
   {size:5+rnd(s)*12,speed:70+rnd(s)*125,life:.7+rnd(s)*1.35,kind});}
}
function impact(s,at,armored){
 for(let i=0;i<(armored?14:9);i++){const a=-1.9+rnd(s)*3.8,sp=40+rnd(s)*(armored?165:110);
  s.flecks.push({x:at.x+(rnd(s)-.5)*8,y:at.y+(rnd(s)-.5)*8,
   vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-10,a:rnd(s)*TAU,vr:(rnd(s)-.5)*18,
   sz:1.1+rnd(s)*2.4,age:0,life:.24+rnd(s)*.42,
   type:i%4===0?'leaf':i%2===0?'metal':'soil'});}
 for(let i=0;i<(armored?5:3);i++){const sp=34+rnd(s)*96;
  leaf(s,at.x+(rnd(s)-.5)*14,at.y+(rnd(s)-.5)*16,
   (rnd(s)-.5)*1.2,-.6+rnd(s)*.45,{size:4+rnd(s)*5,speed:sp,life:.7+rnd(s)*.55});}
 s.flecks.splice(0,Math.max(0,s.flecks.length-90));
}
function wallImpact(s,at,body){
 s.scuff={x:at.x,y:at.y,t:0,life:2.15};
 for(let i=0;i<16;i++){const a=(-1.15+(i/15)*2.3)+(rnd(s)-.5)*.6,sp=24+rnd(s)*110;
  s.puffs.push({x:at.x+rnd(s)*5,y:at.y+(rnd(s)-.5)*17,
   vx:Math.max(12,Math.cos(a)*sp),vy:Math.sin(a)*sp*.72-7,
   radius:7+rnd(s)*14,age:0,life:.85+rnd(s)*.65,
   brown:i%4===0,phase:rnd(s)*TAU});}
 for(let i=0;i<16;i++){const a=-1.1+rnd(s)*2.2,sp=45+rnd(s)*185;
  s.flecks.push({x:at.x+2,y:at.y+(rnd(s)-.5)*13,
   vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-15,
   a:rnd(s)*TAU,vr:(rnd(s)-.5)*21,
   sz:1.2+rnd(s)*2.6,age:0,life:.34+rnd(s)*.7,
   type:i%5===0?'soil':i%3===0?'leaf':'metal'});}
 // Gold V5: living leaves come from the moving pod, never from the metal wall.
 for(let i=0;i<5;i++){const sp=42+rnd(s)*120;
  leaf(s,body.x+23,body.y+(rnd(s)-.5)*55,.55+rnd(s)*.5,-.7+rnd(s)*.8,
   {size:5+rnd(s)*6,speed:sp,life:1+rnd(s)*.75});}
 s.puffs.splice(0,Math.max(0,s.puffs.length-80));
 s.flecks.splice(0,Math.max(0,s.flecks.length-90));
}
function step(s,dt,now){
 for(let i=s.leaves.length-1;i>=0;i--){const p=s.leaves[i];p.age+=dt;
  if(p.age>=p.life){s.leaves.splice(i,1);continue;}
  p.vx+=Math.sin(now*2+p.drift)*8*dt;p.vx*=Math.max(0,1-dt*.55);p.vy+=9*dt;
  p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt*(1-p.age/p.life*.5);}
 for(let i=s.puffs.length-1;i>=0;i--){const p=s.puffs[i];p.age+=dt;
  if(p.age>=p.life){s.puffs.splice(i,1);continue;}
  const drag=Math.exp(-dt*2.6);p.vx*=drag;p.vy=p.vy*drag-3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
 for(let i=s.flecks.length-1;i>=0;i--){const p=s.flecks[i];p.age+=dt;
  if(p.age>=p.life){s.flecks.splice(i,1);continue;}
  p.vx*=Math.exp(-dt*1.8);p.vy+=125*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.vr*dt;}
 if(s.scuff){s.scuff.t+=dt;if(s.scuff.t>=s.scuff.life)s.scuff=null;}
 while(s.history.length&&now-s.history[0].t>2.7)s.history.shift();
}
function sync(pose){
 const r=pose.robot;if(!r)return null;
 const now=Number(r.time),side=pose.side||'unknown';
 if(!Number.isFinite(now))return null;
 let s=states.get(side);
 if(!s||now<s.time-0.001||now-s.time>8)s=reset(side,now);
 const dt=clamp(now-s.time,0,.2);
 if(dt>0)step(s,dt,now);
 const body={x:pose.x,y:pose.y};
 // The event sequence is written ONLY by native Robot mechanics/presentation.
 for(const ev of (r.fxEvents||[])){
  if(!Number.isFinite(ev.serial)||ev.serial<=s.lastSerial)continue;
  s.lastSerial=ev.serial;
  if(now-ev.t>2.2)continue;
  const at=Number.isFinite(ev.x)&&Number.isFinite(ev.y)?{x:ev.x,y:ev.y}:body;
  if(ev.kind==='a1-launch'){s.activeDash=true;s.history=[];burst(s,9,at.x,at.y,-1,0);s.emissions.a1++;}
  else if(ev.kind==='a1-contact'){s.activeDash=false;s.dashEnd=now;burst(s,14,at.x,at.y,0,-1);}
  else if(ev.kind==='a1-fail')burst(s,3,at.x,at.y,0,-1,'dust');
  else if(ev.kind==='a2-on'||ev.kind==='a2-off'){burst(s,ev.kind==='a2-on'?8:7,at.x,at.y,0,-1);s.emissions.a2++;}
  else if(ev.kind==='passive'){burst(s,12,at.x,at.y-10,0,-1);s.emissions.passive++;}
  else if(ev.kind==='hit'){impact(s,at,!!ev.armored);s.emissions.hit++;}
  else if(ev.kind==='wall'){wallImpact(s,at,body);s.emissions.wall++;}
  else if(ev.kind==='fire'){burst(s,2,at.x,at.y,0,-1);}
 }
 // Source of truth for dash path is the real Robot renderer's sampled physical path.
 const isDash=r.mode==='dash'&&r.trailOn===true;
 const trail=r.dashTrail||[];
 if(isDash){s.activeDash=true;for(const p of trail){
   if(!Number.isFinite(p.t)||s.history.some(h=>h.t===p.t))continue;
   s.history.push({x:p.x,y:p.y,t:p.t});
   if(s.history.length>320)s.history.shift();
 }}else if(s.activeDash){s.activeDash=false;s.dashEnd=now;}
 // Match V17 19ms dash leaf cadence / 230ms walking cadence on native time.
 const vx=Number(r.vx)||0,vy=Number(r.vy)||0,v=Math.hypot(vx,vy);
 s.leafClock+=dt;
 if(isDash&&s.leafClock>.019){s.leafClock=0;const dx=v>1?-vx/v:-1,dy=v>1?-vy/v:0;
  leaf(s,body.x+dx*36,body.y+dy*36,dx,dy,
   {life:1.05+rnd(s)*.9,size:6+rnd(s)*11,speed:80+rnd(s)*120});
 }else if(!isDash&&v>80&&s.leafClock>.23){s.leafClock=0;
  leaf(s,body.x,body.y+28,-vx/Math.max(1,v),-vy/Math.max(1,v),
   {size:5+rnd(s)*4,life:1,speed:36});}
 s.lastX=body.x;s.lastY=body.y;s.time=now;return s;
}
function trail(ctx,s,now){
 if(s.history.length<3)return;
 const post=s.activeDash?1:clamp(1-(now-s.dashEnd)/1.85);
 if(post<=0)return;
 const a=s.history[0],b=s.history[s.history.length-1];
 const path=()=>{ctx.beginPath();ctx.moveTo(a.x,a.y);
  for(let i=1;i<s.history.length-1;i++){const p=s.history[i],n=s.history[i+1];
   ctx.quadraticCurveTo(p.x,p.y,(p.x+n.x)*.5,(p.y+n.y)*.5);}ctx.lineTo(b.x,b.y);};
 const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
 g.addColorStop(0,'rgba(66,147,81,'+(.015*post)+')');
 g.addColorStop(.25,'rgba(84,183,86,'+(.26*post)+')');
 g.addColorStop(.77,'rgba(128,239,117,'+(.5*post)+')');
 g.addColorStop(1,'rgba(175,255,151,'+(.64*post)+')');
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor='#a2ed86';ctx.shadowBlur=20;
 ctx.strokeStyle=g;ctx.lineWidth=26;path();ctx.stroke();
 ctx.shadowBlur=8;ctx.lineWidth=10;path();ctx.stroke();
 const fine=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
 fine.addColorStop(0,'rgba(212,255,177,0)');
 fine.addColorStop(.45,'rgba(218,255,170,'+(.5*post)+')');
 fine.addColorStop(1,'rgba(239,255,200,'+(.88*post)+')');
 ctx.strokeStyle=fine;ctx.lineWidth=2.8;ctx.shadowBlur=0;path();ctx.stroke();ctx.restore();
}
export function drawEcoGoldWorldBack(ctx,pose){
 const s=sync(pose);if(!s)return false;
 trail(ctx,s,Number(pose.robot.time));
 if(s.scuff){const q=s.scuff,t=q.t/q.life,a=Math.pow(1-t,2);
  ctx.save();ctx.globalAlpha=a;const g=ctx.createRadialGradient(q.x-2,q.y,1,q.x+2,q.y,30+t*6);
  g.addColorStop(0,'rgba(17,20,18,.60)');g.addColorStop(.35,'rgba(34,40,33,.37)');
  g.addColorStop(1,'rgba(34,40,33,0)');ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(q.x-2,q.y,11,33,0,0,TAU);ctx.fill();ctx.restore();}
 for(const p of s.puffs){const q=p.age/p.life,fade=Math.min(1,p.age/.09)*Math.pow(1-q,1.85);
  const radius=p.radius*(.65+q*2.5);
  ctx.save();ctx.globalAlpha=fade*(p.brown?.18:.22);
  const g=ctx.createRadialGradient(p.x-radius*.14,p.y-radius*.16,0,p.x,p.y,radius);
  if(p.brown){g.addColorStop(0,'rgba(130,95,69,.8)');g.addColorStop(.47,'rgba(81,68,55,.38)');}
  else{g.addColorStop(0,'rgba(135,144,126,.68)');g.addColorStop(.47,'rgba(83,102,87,.34)');}
  g.addColorStop(1,'rgba(42,47,38,0)');ctx.fillStyle=g;ctx.beginPath();
  ctx.ellipse(p.x,p.y,radius,radius*(.7+.35*Math.sin(p.phase)),p.phase*.2,0,TAU);ctx.fill();ctx.restore();}
 return true;
}
export function drawEcoGoldWorldFront(ctx,pose){
 const s=sync(pose);if(!s)return false;
 for(const p of s.flecks){const q=p.age/p.life,fade=Math.min(1,p.age/.035)*Math.pow(1-q,1.5);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.globalAlpha=fade*.9;
  if(p.type==='leaf')drawEcoLeafGold(ctx,0,0,p.sz*4,p.sz*1.7,0,'#5eaa77',.7);
  else{ctx.fillStyle=p.type==='soil'?'#79583a':'#81978a';ctx.beginPath();
   ctx.moveTo(-p.sz,-p.sz*.25);ctx.quadraticCurveTo(p.sz*.1,-p.sz*.8,p.sz,p.sz*.25);
   ctx.quadraticCurveTo(p.sz*.7,p.sz*.84,-p.sz*.55,p.sz*.52);ctx.closePath();ctx.fill();}
  ctx.restore();}
 for(const p of s.leaves){const q=p.age/p.life;
  const fade=q<.13?q/.13:q<.58?1:Math.pow((1-q)/.42,1.8);
  if(fade<.005)continue;
  if(p.kind==='dust'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
   ctx.strokeStyle='rgba(168,197,126,'+(fade*.22)+')';ctx.lineWidth=Math.max(1,p.size*.16);
   ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-p.size*.42,0);ctx.lineTo(p.size*.42,0);ctx.stroke();ctx.restore();}
  else drawEcoLeafGold(ctx,p.x,p.y,p.size*1.85,p.size*.55,p.rot,'#8fb37f',fade*.86);}
 return true;
}
export function ecoGoldWorldSnapshot(side){const s=states.get(side);return s?{
 leaves:s.leaves.length,puffs:s.puffs.length,flecks:s.flecks.length,trail:s.history.length,
 emissions:{...s.emissions},lastSerial:s.lastSerial}:null;}


// ECO V17 TARGETING FAMILY. Owner Gold drawBrackets()/drawMeasure()
// (ECO_NEWBOT_RECYCLE_CORE_V17.html): circular living-seed reticle, two
// counter-rotating arcs, and a luminous calibrated acquisition ray.
// The authoritative NEWBOT state supplies the target/lock timing. All visual
// phases are derived from its presentation clock; no targeting or gameplay.
function validPoint(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y);}
function ecoTargetMarkState(r) {
 const b=r.brackets;
 if(!b||!validPoint(b.target)||!Number.isFinite(b.t0))return null;
 const t=Math.max(0,r.time-b.t0),closing=b.state==='out';
 const end=Number.isFinite(b.t1)?b.t1-b.t0:t;
 const elapsed=closing?Math.max(0,r.time-b.t1):t;
 const f=clamp((closing?elapsed/.14:t/.14));
 const radius=closing?mix(58,34,f):mix(86,58,1-Math.pow(1-f,2.2));
 const alpha=closing?1-f:clamp(t/.06);
 const sweep=closing?mix(1.4,.7,f):mix(.9,1.9,1-Math.pow(1-f,2.2));
 // Original V17 drives ecoMarkSpin at 8.4 rad/s while acquiring,
 // 5.2 rad/s while releasing. Reticle never spins the physical target.
 const spin=8.4*(closing?Math.max(0,end):t)+(closing?5.2*elapsed:0);
 const pulse=.82+.18*Math.sin((Number(r.time)||0)*7*2.2);
 return {x:b.target.x,y:b.target.y,radius,alpha,sweep,spin,pulse};
}
export function drawEcoGoldTargetLock(ctx,pose){
 if(pose.kind!=='ROBOT'||!pose.robot)return false;
 const m=ecoTargetMarkState(pose.robot);
 // Skin owns this pass even when there is no authoritative target.
 // Never draw a fake lock in front of the character as ORIGINAL did.
 if(!m||m.alpha<=0)return true;
 const {x,y,radius:r,alpha,sweep,spin,pulse}=m;
 ctx.save();
 try{
  ctx.globalAlpha*=alpha;
  ctx.translate(x,y);
  ctx.lineCap='round';
  ctx.globalCompositeOperation='lighter';
  const rg=ctx.createRadialGradient(0,0,8,0,0,r+34);
  rg.addColorStop(0,'rgba(205,255,188,0)');
  rg.addColorStop(.55,'rgba(182,255,163,.07)');
  rg.addColorStop(1,'rgba(182,255,163,0)');
  ctx.fillStyle=rg;ctx.beginPath();ctx.arc(0,0,r+34,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(215,255,200,'+(.72*pulse)+')';ctx.lineWidth=3.8;
  for(const off of [0,Math.PI]){
   ctx.beginPath();ctx.arc(0,0,r,spin+off+.22,spin+off+.22+sweep);ctx.stroke();
  }
  ctx.strokeStyle='rgba(124,224,150,'+(.8*pulse)+')';ctx.lineWidth=2.2;
  for(const off of [.92,Math.PI+.92]){
   ctx.beginPath();ctx.arc(0,0,r-12,-spin*.86+off,-spin*.86+off+.8);ctx.stroke();
  }
  ctx.strokeStyle='rgba(210,255,206,'+(.52*pulse)+')';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,0,r+8,0,TAU);ctx.stroke();
  // GOLD: four soft living cardinal seeds, not polygon brackets.
  for(let i=0;i<4;i++){
   const a=spin*.55+i*TAU/4;
   ctx.save();ctx.translate(Math.cos(a)*(r+5),Math.sin(a)*(r+5));
   ctx.rotate(a+Math.PI/2);
   ctx.fillStyle=i%2?'rgba(166,241,153,.72)':'rgba(231,255,214,.74)';
   ctx.beginPath();ctx.moveTo(0,-8);ctx.quadraticCurveTo(7,0,0,8);
   ctx.quadraticCurveTo(-7,0,0,-8);ctx.fill();ctx.restore();
  }
 }finally{ctx.restore();}
 return true;
}
export function drawEcoGoldTargetMeasure(ctx,pose){
 if(pose.kind!=='ROBOT'||!pose.robot)return false;
 const m=pose.robot.measure, b=pose.robot.brackets;
 if(!m||pose.robot.held)return true;
 const target=validPoint(m.target)?m.target:b?.target;
 if(!validPoint(target)||!Number.isFinite(m.t0))return true;
 const t=pose.robot.time-m.t0;
 if(t<0||t>.34)return true;
 const p=clamp(t/.08),alpha=t<.16?1:clamp(1-(t-.16)/.18);
 const source=validPoint(pose.robot.scanSource)?pose.robot.scanSource:
  {x:pose.x,y:pose.y-(Number(pose.robot.radius)||0)*.8};
 const ex=mix(source.x,target.x,p),ey=mix(source.y,target.y,p);
 const dx=target.x-source.x,dy=target.y-source.y,L=Math.hypot(dx,dy)||1;
 const nx=-dy/L,ny=dx/L;
 ctx.save();
 try{
  ctx.globalAlpha*=alpha*.9;ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle='rgba(172,245,165,.42)';ctx.lineWidth=4.5;
  ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(ex,ey);ctx.stroke();
  ctx.strokeStyle='rgba(228,255,218,.75)';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(ex,ey);ctx.stroke();
  for(const f of [.18,.36,.54,.72,.90]){
   if(f>p)continue;
   const x=mix(source.x,target.x,f),y=mix(source.y,target.y,f);
   const w=3+4*Math.sin(pose.robot.time*7*2+f*6);
   ctx.strokeStyle='rgba(220,255,216,.5)';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(x-nx*(5+w),y-ny*(5+w));
   ctx.lineTo(x+nx*(5+w),y+ny*(5+w));ctx.stroke();
  }
  ctx.fillStyle='rgba(228,255,218,.86)';
  ctx.beginPath();ctx.arc(ex,ey,2.2,0,TAU);ctx.fill();
 }finally{ctx.restore();}
 return true;
}
