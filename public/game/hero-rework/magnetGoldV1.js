/* =============================================================================
 * MAGNET V1 — production Gold presentation engine.
 *
 * Source authority:
 * docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html
 * SHA-256 468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b
 *
 * This is presentation only. Production supplies resolved root/object truth;
 * this engine owns the canonical six-part rig, Gold channels, choreography,
 * sockets and fixed 1/120 stepping. It never integrates gameplay.
 * ========================================================================== */
(function (g) {
'use strict';
if (g.APEX_MAGNET_GOLD) return;

const DT=1/120,TAU=Math.PI*2,DEG=Math.PI/180;
const SOURCE_SCALE=170/1020;
const BODY_REF=Object.freeze({HX:96,HY:80});
// One production-only calibration. It maps the Gold demo's widest authored
// body half-extent (HX=96) to the live circular fighter radius. Mechanics and
// world VFX remain 1:1 world units.
const BODY_VISUAL_CALIBRATION=1.0;
const ORIGIN={x:627,y:610};
const IDS=['core','spine','polL','polR','lobeL','lobeR'];
const POLES=['polL','polR'],LOBES=['lobeL','lobeR'],INWARD=[1,-1];
const META={
  core:{ox:234,oy:47,w:786,h:1125,pivot:[627,640],channels:['main','eyes']},
  spine:{ox:411,oy:165,w:432,h:577,pivot:[627,660],channels:['main']},
  polL:{ox:-19,oy:50,w:591,h:1123,pivot:[470,820],channels:['in','out']},
  polR:{ox:682,oy:50,w:591,h:1123,pivot:[784,820],channels:['in','out']},
  lobeL:{ox:72,oy:730,w:329,h:371,pivot:[250,830],channels:[]},
  lobeR:{ox:852,oy:730,w:330,h:371,pivot:[1004,830],channels:[]},
};
const RC={core:[330,.78],spine:[360,.62],polL:[200,.55],polR:[200,.55],lobeL:[260,.55],lobeR:[260,.55]};
const CHANNELS=['core.main','core.eyes','spine.main','polL.in','polL.out','polR.in','polR.out'];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const bump=(t,u,h,d)=>t<0?0:t<u?smooth(0,u,t):t<u+h?1:t<u+h+d?1-smooth(0,d,t-u-h):0;

const images={};
let ready=false,loadError=null;
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`MAGNET Gold asset failed: ${src}`));im.src=src;});}
async function loadAssets(){
  try{
    const jobs=[];
    for(const id of IDS){
      images[id]=[];
      for(const tag of ['half','quarter']){
        const level={channels:{}};images[id].push(level);
        jobs.push(loadImage(`/assets/magnet_v1/gold/${id}-${tag}-base.png`).then(im=>{level.base=im;}));
        for(const channel of META[id].channels){
          const layers={};level.channels[channel]=layers;
          for(const kind of ['gold','dim','glow'])jobs.push(loadImage(`/assets/magnet_v1/gold/${id}-${tag}-${channel}-${kind}.png`).then(im=>{layers[kind]=im;}));
        }
      }
    }
    await Promise.all(jobs);ready=true;
  }catch(error){loadError=error;}
}
loadAssets();

const states=new Map();
function createState(combatant){
  const rig={},target={},gold={};
  for(const id of IDS){
    rig[id]={x:0,y:0,r:0,sx:1,sy:1,vx:0,vy:0,vr:0,vsx:0,vsy:0,k:RC[id][0],z:RC[id][1],kM:1};
    target[id]={x:0,y:0,r:0,sx:1,sy:1};
  }
  for(const key of CHANNELS)gold[key]={env:1,pulse:0,tau:.12,dip:0,hold:0,rec:.2,v:1};
  let seed = (0x4d41474e^(((combatant&&combatant.idx||0)+1)*0x9e3779b9))>>>0;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/0x100000000;};
  return{
    combatant,rig,target,gold,random,queue:[],accumulator:0,fixedSteps:0,droppedTime:0,simTime:0,frameCount:0,
    root:{x:combatant?.anchor?.x||0,y:combatant?.anchor?.y||0,radius:combatant?.anchor?.radius||75},
    lastRoot:null,velocity:{x:0,y:0},acceleration:{x:0,y:0},lastDir:{x:1,y:0},lastMoving:false,turnCooldown:0,
    hax:new Float32Array(128),hay:new Float32Array(128),hi:0,leadSide:1,
    wall:{L:false,R:false,T:false,B:false},slide:0,slideNormal:{x:0,y:0},
    a1:-1,a2:-1,a1Lead:1,a2Lead:1,a1Target:{x:0,y:0},desiredA1Target:{x:0,y:0},passive:0,lastAct:0,
    idle:{next:2.2,t0:-99,side:0,amp:2,rot:.8,dir:1,dy:0,w:1},
    objects:{a1:[],a2:[]},histories:new Map(),hot:new Float32Array(24),a2Seen:new Set(),
    arcs:[],bumps:[],echoes:[],corridors:[],rings:[],particles:[],sockets:null,
  };
}
function stateFor(combatant){let s=states.get(combatant);if(!s){s=createState(combatant);states.set(combatant,s);}return s;}
function after(s,ms,fn){s.queue.push({at:s.simTime+ms/1000,fn});}
function runQueue(s){for(let i=0;i<s.queue.length;){if(s.queue[i].at<=s.simTime){const q=s.queue[i];s.queue[i]=s.queue[s.queue.length-1];s.queue.pop();q.fn();}else i++;}}
function peakF(z){const q=Math.sqrt(1-z*z);return Math.exp(-(z/q)*Math.atan2(q,z));}
function kick(s,id,dx,dy,dr,ds){const p=s.rig[id];if(!p)return;const w=Math.sqrt(p.k*p.kM)/peakF(p.z);p.vx+=(dx||0)*w;p.vy+=(dy||0)*w;p.vr+=(dr||0)*w;if(ds){p.vsx+=ds*w;p.vsy+=ds*w;}}
function pulse(s,key,amount,tau){const q=s.gold[key];if(!q)return;q.pulse=Math.max(q.pulse,amount);q.tau=tau||.14;}
function dip(s,key,amount,hold,recover){const q=s.gold[key];if(!q)return;q.dip=Math.max(q.dip,amount);q.hold=hold;q.rec=recover;}
function poleChannels(side){return[`${POLES[side]}.in`,`${POLES[side]}.out`];}
function boundedPush(list,item,max){list.push(item);while(list.length>max)list.shift();}
function addArc(s,x,y,r,dr,a,span,d,w,color){boundedPush(s.arcs,{x,y,r,dr,a,span,age:0,d,w,color},28);}
function addBump(s,x,y,nx,ny,amp,sigma,d=.42){boundedPush(s.bumps,{x,y,nx,ny,amp,sigma,age:0,d},16);}
function addRing(s,object,d=.58,alpha=.72){if(object)boundedPush(s.rings,{key:object.key,object,age:0,d,alpha},16);}
function addCorridor(s,x,y,angle,len=170,width=14,d=.42,alpha=.85){boundedPush(s.corridors,{x,y,angle,len,width,age:0,d,alpha},8);}
function rigSnapshot(s){return Object.fromEntries(IDS.map(id=>[id,{x:s.rig[id].x,y:s.rig[id].y,r:s.rig[id].r,sx:s.rig[id].sx,sy:s.rig[id].sy}]));}
function addEcho(s,kind,dx,dy,alpha,d){boundedPush(s.echoes,{kind,x:s.root.x,y:s.root.y,dx,dy,alpha,age:0,d,bodyK:bodyK(s),rig:rigSnapshot(s)},10);}
function addParticle(s,p){boundedPush(s.particles,p,80);}
function addMotes(s,x,y,count){for(let i=0;i<count;i++){const a=s.random()*TAU,sp=20+s.random()*50;addParticle(s,{kind:'mote',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,age:0,d:.25+s.random()*.2,size:1+s.random()*.8});}}
function objectKey(o,index){return o&&((o.key!=null&&o.key)||(o.ref)||(o.object))||`${o?.kind||'object'}:${o?.id??index}`;}
function updateObjectTruth(s,input,dt){
  if(Array.isArray(input.a1Objects))s.objects.a1=input.a1Objects.slice();
  if(Array.isArray(input.a2Objects))s.objects.a2=input.a2Objects.slice();
  const active=[...s.objects.a1,...s.objects.a2],seen=new Set();
  active.forEach((o,index)=>{if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))return;const key=objectKey(o,index);o.key=key;seen.add(key);let h=s.histories.get(key);if(!h){h={kind:o.kind||'object',hostile:!!o.hostile,points:[],stale:0,object:o};s.histories.set(key,h);}h.object=o;h.hostile=!!o.hostile;h.stale=0;const last=h.points[h.points.length-1];if(!last||Math.hypot(o.x-last.x,o.y-last.y)>.25)h.points.push({x:o.x,y:o.y});if(h.points.length>20)h.points.shift();});
  for(const[key,h]of s.histories){if(!seen.has(key))h.stale+=dt;if(h.stale>.75)s.histories.delete(key);}
  const targets=s.objects.a1.filter(o=>o&&Number.isFinite(o.x)&&Number.isFinite(o.y)).sort((a,b)=>Math.hypot(a.x-s.root.x,a.y-s.root.y)-Math.hypot(b.x-s.root.x,b.y-s.root.y));
  if(targets.length){const o=targets[0],x=o.x-s.root.x,y=o.y-s.root.y,d=Math.hypot(x,y);s.desiredA1Target.x=d?x/d:0;s.desiredA1Target.y=d?y/d:0;s.a1Lead=x<0?0:1;}
  else if(input.a1Target){const x=Number(input.a1Target.x)||0,y=Number(input.a1Target.y)||0,d=Math.hypot(x,y);s.desiredA1Target.x=d?x/d:0;s.desiredA1Target.y=d?y/d:0;if(d)s.a1Lead=x<0?0:1;}
  else{s.desiredA1Target.x=0;s.desiredA1Target.y=0;}
  if(s.a2>=0&&s.a2<=1.8){for(let index=0;index<s.objects.a2.length;index++){const o=s.objects.a2[index],dx=o.x-s.root.x,dy=o.y-s.root.y,d=Math.hypot(dx,dy);if(!(d>0&&d<225))continue;const bin=(((Math.atan2(dy,dx)/TAU)%1+1)%1*24)|0,u=1-d/225;s.hot[bin]=Math.max(s.hot[bin],u*u);s.hot[(bin+1)%24]=Math.max(s.hot[(bin+1)%24],u*u*.7);s.hot[(bin+23)%24]=Math.max(s.hot[(bin+23)%24],u*u*.7);const key=objectKey(o,index);if(!s.a2Seen.has(key)){s.a2Seen.add(key);const side=dx<0?0:1;after(s,50,()=>kick(s,POLES[side],INWARD[side]*2,0,INWARD[side]*.65*DEG));addBump(s,o.x,o.y,dx/d,dy/d,4.2,o.radius?o.radius+12:28,.38);}}}
}
function ageEffects(s){
  for(const list of [s.arcs,s.bumps,s.echoes,s.corridors,s.rings])for(let i=list.length-1;i>=0;i--){list[i].age+=DT;if(list[i].age>=list[i].d)list.splice(i,1);}
  for(let i=s.particles.length-1;i>=0;i--){const p=s.particles[i];p.age+=DT;if(p.age>=p.d){s.particles.splice(i,1);continue;}p.x+=p.vx*DT;p.y+=p.vy*DT;const drag=Math.exp(-4*DT);p.vx*=drag;p.vy*=drag;}
  for(const a of s.arcs)a.r+=a.dr*DT;for(let i=0;i<24;i++)s.hot[i]*=Math.exp(-DT*5.5);
}

function goldRouteA1(s){
  after(s,70,()=>pulse(s,'spine.main',.72,.18));
  after(s,135,()=>{pulse(s,'core.main',.62,.18);pulse(s,'core.eyes',.34,.15);});
  after(s,190,()=>{pulse(s,'polL.in',.72,.17);pulse(s,'polR.in',.72,.17);});
  after(s,240,()=>{pulse(s,'polL.out',.36,.19);pulse(s,'polR.out',.36,.19);});
}
function goldRecover(s,side,level){
  after(s,170+level*40,()=>{pulse(s,'core.main',.48+.16*level,.18);pulse(s,'spine.main',.42+.1*level,.18);});
  if(side===0||side===1){
    after(s,245+level*45,()=>poleChannels(side).forEach(k=>pulse(s,k,.42+.16*level,.17)));
    after(s,310+level*48,()=>poleChannels(1-side).forEach(k=>pulse(s,k,.22+.1*level,.18)));
  }
}
function structural(s,dx,dy,mag,near,level){
  s.lastAct=s.simTime;
  const nearList=near===2?[0,1]:[near],far=near===2?[]:[1-near];
  for(const side of nearList){
    kick(s,POLES[side],dx*mag,dy*mag,dx*mag*.3*DEG-dy*INWARD[side]*.12*mag*DEG,-.016*mag/8);
    for(const key of poleChannels(side))dip(s,key,.85,.05+.03*level,.25);
    after(s,150,()=>poleChannels(side).forEach(key=>{dip(s,key,.35,.03,.18);pulse(s,key,.25,.15);}));
  }
  after(s,25,()=>{kick(s,'core',dx*mag*.42,dy*mag*.42);s.rig.core.vsy-=.4*mag/8*6;});
  after(s,35,()=>kick(s,'spine',dx*mag*.3,dy*mag*.3,dx*.15*mag*DEG));
  const delay=near===2?70:45+level*22;
  for(const side of far)after(s,delay,()=>kick(s,POLES[side],dx*mag*.55,dy*mag*.55,dx*mag*.22*DEG));
  after(s,50,()=>{const a=mag*.06*DEG;kick(s,'lobeL',-dx*mag*.25,-dy*mag*.25,a*(dx>=0?-1:1)*8);kick(s,'lobeR',-dx*mag*.25,-dy*mag*.25,-a*(dx>=0?-1:1)*8);});
}
function wallImpact(s,nx,ny,speed){
  const mag=clamp(2.5+speed*.015,2.5,13),level=speed<200?0:speed<450?1:2,near=nx>0?0:nx<0?1:2;
  structural(s,nx,ny,mag,near,level);if(near!==2)goldRecover(s,near,level);
  if(level>=1){addEcho(s,'wall',-nx*(5+level*2),-ny*(5+level*2),level===2?.11:.07,level===2?.26:.18);addBump(s,s.root.x-nx*s.root.radius,s.root.y-ny*s.root.radius,nx,ny,4.5+level*2.2,28+level*6,.42);addArc(s,s.root.x-nx*s.root.radius,s.root.y-ny*s.root.radius,10,45,Math.atan2(ny,nx),.44,.34,1.5,'impact');}
}
function impact(s,data={}){
  const dx=Number(data.dx)||0,dy=Number(data.dy)||0,mag=clamp(Number(data.magnitude)||5,2,14),level=mag<4.5?0:mag<8?1:2;
  structural(s,dx,dy,mag,data.side==null?(dx<0?0:1):data.side,level);
  pulse(s,'core.eyes',.4,.08);goldRecover(s,dx<0?0:1,level);
  addEcho(s,'hit',-dx*(level===2?9:6),-dy*(level===2?9:6),level===2?.12:.075,level===2?.24:.17);
  addBump(s,Number(data.x)||s.root.x,Number(data.y)||s.root.y,-dx,-dy,4.2+level*2.4,24+level*6,.38);
}

function startA1(s,data={}){
  s.a1=0;s.lastAct=s.simTime;
  const x=Number(data.x)||0,y=Number(data.y)||0,d=Math.hypot(x,y);
  s.desiredA1Target.x=d?x/d:0;s.desiredA1Target.y=d?y/d:0;s.a1Lead=x<0?0:1;
  goldRouteA1(s);addEcho(s,'a1',0,4,.07,.22);
  addArc(s,s.root.x,s.root.y,68,150,Math.PI,.56,.48,1.7,'a1');addArc(s,s.root.x,s.root.y,68,150,0,.56,.48,1.7,'a1');
  for(const object of(data.objects||[]))addRing(s,object);
}
function startA2(s){
  s.a2=0;s.a2Lead=s.random()<.5?0:1;s.lastAct=s.simTime;s.a2Seen.clear();
  after(s,70,()=>{pulse(s,'core.main',.75,.15);pulse(s,'core.eyes',.48,.14);});
  after(s,155,()=>{pulse(s,'polL.out',.72,.18);pulse(s,'polR.out',.72,.18);});
  s.rig.core.vsy+=-.03*14;s.rig.core.vsx+=.03*14;addEcho(s,'a2',0,-3,.07,.24);
  addArc(s,s.root.x,s.root.y,84,250,Math.PI,.54,.62,2,'a2');addArc(s,s.root.x,s.root.y,84,250,0,.54,.62,2,'a2');
}
function passiveEmission(s,data={}){
  const angle=Number(data.angle)||0,ax=Math.cos(angle),ay=Math.sin(angle),side=ax<0?0:1,other=1-side;
  s.passive=.42;s.lastAct=s.simTime;
  // Production exposes the real emission, not a universal pre-fire edge. The
  // Gold launch is therefore time zero; the delayed opposite response and
  // recovery remain authored while gameplay is never delayed.
  kick(s,POLES[side],ax*4,ay*4,ax*1.2*DEG*INWARD[side]*-1);
  poleChannels(side).forEach(k=>pulse(s,k,1,.045));
  pulse(s,'core.eyes',.3,.1);pulse(s,'spine.main',.3,.1);kick(s,'core',-ax*.6,-ay*.6);
  after(s,40,()=>kick(s,POLES[other],-ax*1.2,-ay*1.2));
  after(s,110,()=>goldRecover(s,side,0));
  addCorridor(s,Number(data.x)||s.root.x,Number(data.y)||s.root.y,angle);addEcho(s,'passive',-ax*5,-ay*5,.055,.14);
}
function cue(combatant,type,data){const s=stateFor(combatant);if(type==='a1')startA1(s,data);else if(type==='a2')startA2(s);else if(type==='passive')passiveEmission(s,data);else if(type==='impact')impact(s,data);else if(type==='wall')wallImpact(s,data?.nx||0,data?.ny||0,data?.speed||0);else if(type==='lateReveal'){addRing(s,data?.object);if(data?.object){addMotes(s,data.object.x,data.object.y,2);pulse(s,'core.eyes',.2,.14);}}}

function movementStart(s,dx,dy){
  const side=dx>=0?1:0,other=1-side;s.lastAct=s.simTime;
  kick(s,'core',dx*1.3,dy*1.3);
  after(s,65,()=>kick(s,POLES[side],-dx*1.6,-dy*1.6,-dx*.5*DEG));
  after(s,105,()=>kick(s,POLES[other],-dx*2.4,-dy*2.4,-dx*.7*DEG));
  after(s,135,()=>{kick(s,'lobeL',dx,dy);kick(s,'lobeR',dx,dy);});
}
function hardTurn(s,dx,dy,oldX,oldY){
  const side=dx>.25?1:dx<-.25?0:(oldX>0?0:1),other=1-side;s.lastAct=s.simTime;
  kick(s,'core',dx*1.2,dy*1.2);kick(s,POLES[side],dx*2.2,dy*2.2,dx*.8*DEG);
  after(s,50,()=>kick(s,'spine',dx,dy*.6));
  after(s,60,()=>kick(s,POLES[other],oldX*3.2,oldY*3.2,oldX*1.1*DEG));
  after(s,85,()=>{kick(s,'lobeL',-dx*1.6,-dy*1.2,dx*DEG);kick(s,'lobeR',-dx*1.6,-dy*1.2,dx*DEG);});
}
function movementStop(s,dx,dy){
  const side=dx>=0?1:0,other=1-side;s.lastAct=s.simTime;
  kick(s,'core',dx*.6,dy*.6);kick(s,POLES[side],dx*2,dy*2,dx*.7*DEG);
  after(s,60,()=>kick(s,POLES[other],dx*3,dy*3,dx*.9*DEG));
  after(s,90,()=>{kick(s,'lobeL',dx,dy);kick(s,'lobeR',dx,dy);});
  after(s,120,()=>{s.rig.spine.vsy-=.1;s.rig.spine.vsx+=.05;});
}
function sampleRoot(s,input,dt){
  const a=s.combatant?.anchor||{},before=input?.before||s.lastRoot||{x:a.x||0,y:a.y||0},after=input?.after||{x:a.x||0,y:a.y||0};
  const h=Math.max(dt,1e-4),vx=(after.x-before.x)/h,vy=(after.y-before.y)/h;
  const oldX=s.velocity.x,oldY=s.velocity.y,speed=Math.hypot(vx,vy),oldSpeed=Math.hypot(oldX,oldY);
  const ax=clamp((vx-oldX)/h,-2400,2400),ay=clamp((vy-oldY)/h,-2400,2400),f=1-Math.exp(-h/.03);
  s.acceleration.x+=(ax-s.acceleration.x)*f;s.acceleration.y+=(ay-s.acceleration.y)*f;
  if(speed>140&&oldSpeed>140&&(vx*oldX+vy*oldY)/(speed*oldSpeed)<-.25&&s.simTime>s.turnCooldown){s.turnCooldown=s.simTime+.4;hardTurn(s,vx/speed,vy/speed,oldX/oldSpeed,oldY/oldSpeed);}
  if(speed>25&&!s.lastMoving&&oldSpeed<90)movementStart(s,vx/(speed||1),vy/(speed||1));
  if(speed<35&&s.lastMoving&&oldSpeed>150)movementStop(s,s.lastDir.x,s.lastDir.y);
  if(speed>25){s.lastDir.x=vx/speed;s.lastDir.y=vy/speed;}
  s.lastMoving=speed>35;s.velocity.x=vx;s.velocity.y=vy;
  s.root.x=after.x;s.root.y=after.y;s.root.radius=a.radius||input?.radius||75;s.lastRoot={x:after.x,y:after.y};s.frameCount++;

  const size=Number(g.GAME_SIZE)||1000,r=s.root.radius;
  const contacts={L:after.x<=r+.5,R:after.x>=size-r-.5,T:after.y<=r+.5,B:after.y>=size-r-.5};
  const normals={L:[1,0],R:[-1,0],T:[0,1],B:[0,-1]};let sliding=null;
  for(const key of Object.keys(contacts)){
    const n=normals[key],tangent=(key==='L'||key==='R')?Math.abs(vy):Math.abs(vx);
    if(contacts[key]&&!s.wall[key]){const inward=Math.max(0,-(vx*n[0]+vy*n[1]));if(inward>25)wallImpact(s,n[0],n[1],inward);}
    s.wall[key]=contacts[key];if(contacts[key]&&tangent>110)sliding=n;
  }
  if(sliding){s.slideNormal.x=sliding[0];s.slideNormal.y=sliding[1];}
  s.slide+=((sliding?1:0)-s.slide)*(1-Math.exp(-h*(sliding?16:6)));
}

function startIdle(s){
  const i=s.idle;i.t0=s.simTime;i.side=s.random()<.5?0:1;i.amp=1+s.random()*1.8;i.rot=.5+s.random()*.7;i.dir=s.random()<.5?-1:1;i.dy=-.8+s.random()*1.6;i.next=s.simTime+4+s.random()*3.2;
  const variation=s.random();
  after(s,170,()=>{if(i.w>.6)pulse(s,'spine.main',.22,.25);});
  if(variation<.14)after(s,820,()=>{if(i.w>.6)kick(s,POLES[i.side],-i.dir*.7,0,0);});
  else if(variation<.28)['spine.main','core.main','polL.in','polL.out','polR.in','polR.out'].forEach((key,index)=>after(s,300+index*130,()=>{if(i.w>.6)pulse(s,key,.2,.22);}));
  else if(variation<.40){after(s,220,()=>{if(i.w>.6)pulse(s,'core.eyes',.3,.3);});after(s,520,()=>{if(i.w>.6)dip(s,'core.eyes',.14,.06,.25);});}
}
function goldTarget(s,key){
  let value=1;
  if(s.a1>=0){const k=key.replace(/pol[LR]/,'pol'),c={'spine.main':[.08,1.12,1.6],'core.main':[.14,1.08,1.45],'core.eyes':[0,1.10,1.35],'pol.in':[.20,1,1.95],'pol.out':[.26,1.03,1.3]}[k];if(c&&s.a1>=c[0]&&s.a1<c[1])value=c[2];}
  if(s.a2>=0){const t=s.a2;if(key.startsWith('pol')&&key.endsWith('.out')){if(t<.18)value=.35;else if(t<1.8)value=1.65;}else if(key.startsWith('pol')&&key.endsWith('.in')&&t>=.18&&t<1.86)value=1.25;else if(key==='core.main'){if(t<.18)value=1.8;else if(t<1.92)value=1.15;}else if(key==='core.eyes'){if(t<.18)value=1.7;else if(t<1.92)value=1.2;}else if(key==='spine.main'&&t>=.06&&t<2)value=1.3;}
  return value;
}
function fixedStep(s){
  s.simTime+=DT;runQueue(s);
  if(s.a1>=0){s.a1+=DT;if(s.a1>1.6)s.a1=-1;}if(s.a2>=0){s.a2+=DT;if(s.a2>2.3)s.a2=-1;}if(s.passive>0)s.passive=Math.max(0,s.passive-DT);
  const track=1-Math.exp(-DT*8);s.a1Target.x+=(s.desiredA1Target.x-s.a1Target.x)*track;s.a1Target.y+=(s.desiredA1Target.y-s.a1Target.y)*track;
  for(const key of CHANNELS){const q=s.gold[key];q.env+=(goldTarget(s,key)-q.env)*(1-Math.exp(-DT*15));q.pulse*=Math.exp(-DT/q.tau);if(q.hold>0)q.hold-=DT;else q.dip=Math.max(0,q.dip-DT/q.rec);q.v=clamp((q.env+q.pulse)*(1-q.dip),0,2.2);}
  s.hax[s.hi]=s.acceleration.x;s.hay[s.hi]=s.acceleration.y;s.hi=(s.hi+1)&127;
  for(const id of IDS){Object.assign(s.target[id],{x:0,y:0,r:0,sx:1,sy:1});s.rig[id].kM=1;}
  if(Math.abs(s.velocity.x)>60)s.leadSide=s.velocity.x>0?1:0;
  const speed=Math.hypot(s.velocity.x,s.velocity.y),busy=speed>25||s.a1>=0||s.a2>=0||s.simTime-s.lastAct<1,i=s.idle;
  i.w+=((busy?0:1)-i.w)*(1-Math.exp(-DT*(busy?14:1.5)));if(!busy&&s.simTime>i.next&&i.w>.85)startIdle(s);
  const lag=ms=>(s.hi-1-Math.min(127,Math.round(ms*.12))+256)&127;
  let j=lag(0);s.target.core.x+=s.velocity.x*.0072-s.hax[j]*.001;s.target.core.y+=s.velocity.y*.0068-s.hay[j]*.001;
  j=lag(28);s.target.spine.x+=-s.hax[j]*.0026;s.target.spine.y+=-s.hay[j]*.0024;
  for(let side=0;side<2;side++){const near=side===s.leadSide;j=lag(near?48:118);const gn=near?.00245:.00355,p=s.target[POLES[side]];p.x+=-s.hax[j]*gn;p.y+=-s.hay[j]*gn;p.r+=-s.hax[j]*.0000063*(near?1:1.32);j=lag(near?118:150);const l=s.target[LOBES[side]];l.x+=s.hax[j]*.0019;l.y+=s.hay[j]*.0017;l.r+=s.hax[j]*.000017*INWARD[side];}
  if(s.slide>.01){const n=s.slideNormal;s.target.core.x+=n.x*.8*s.slide;s.target.core.y+=n.y*.8*s.slide;for(let side=0;side<2;side++){const f=(n.x>0&&side===0)||(n.x<0&&side===1)||!n.x?1.6:.6;s.target[POLES[side]].x+=n.x*f*s.slide;s.target[POLES[side]].y+=n.y*f*s.slide;s.target[LOBES[side]].x-=n.x*.6*s.slide;s.target[LOBES[side]].y-=n.y*.6*s.slide;}}
  const tt=s.simTime-i.t0;if(tt<2.4&&i.w>.02){const w=i.w,side=i.side,other=1-side,d=i.dir,b0=bump(tt,.3,.35,.45),b1=bump(tt-.06,.3,.3,.45),b2=bump(tt-.10,.3,.3,.45),b3=bump(tt-.15,.3,.25,.45);s.target[POLES[side]].x+=d*i.amp*b0*w;s.target[POLES[side]].y+=i.dy*b0*w;s.target[POLES[side]].r+=d*INWARD[side]*i.rot*DEG*b0*w;s.target.core.x+=d*.6*b1*w;s.target.core.y+=i.dy*.3*b1*w;s.target[POLES[other]].x-=d*i.amp*.45*b2*w;s.target[POLES[other]].r-=d*INWARD[other]*i.rot*.45*DEG*b2*w;s.target[LOBES[side]].x+=d*.4*b3*w;s.target[LOBES[other]].x-=d*.3*b3*w;}
  if(s.a1>=0){const t=s.a1;for(let side=0;side<2;side++){const lead=side===s.a1Lead,on=t>=(lead?.10:.13)&&t<(lead?1.08:1.16),p=s.target[POLES[side]];if(on){p.x+=INWARD[side]*12.5;p.y-=2.4;p.r+=INWARD[side]*4.6*DEG;p.sx*=.964;p.sy*=1.013;}if(t>=.06&&t<(lead?1.12:1.16)){const l=s.target[LOBES[side]];l.x+=INWARD[side]*3.8;l.y-=2.1;l.r+=INWARD[side]*2.25*DEG;}}if(t>=.06&&t<1.05){s.target.core.sy*=1.02;s.target.core.sx*=.97;s.target.core.y-=1.4;}if(t>=.06&&t<1.08){s.target.spine.y-=3.5;s.target.spine.sy*=1.046;}s.rig.core.kM=t>.22&&t<1.05?2.6:1;if(t>.22&&t<1.05){const side=s.a1Target.x<0?0:1,p=s.target[POLES[side]];p.x+=s.a1Target.x*1.6;p.y+=s.a1Target.y*1.2;p.r+=s.a1Target.y*INWARD[side]*.5*DEG;}}
  if(s.a2>=0){const t=s.a2;for(let side=0;side<2;side++){const lead=side===s.a2Lead,on=t>=(lead?.08:.10)&&t<(lead?1.84:1.92),p=s.target[POLES[side]];if(on){p.x+=-INWARD[side]*24;p.y+=1.8;p.r+=-INWARD[side]*7.8*DEG;p.sx*=1.03;p.sy*=.992;}if(t>=.06&&t<1.95){const l=s.target[LOBES[side]];l.x+=INWARD[side]*5.4;l.y+=4;l.r+=-INWARD[side]*2.45*DEG;l.x-=INWARD[side]*(s.rig[POLES[side]].x*INWARD[side])*.075;}}if(t<.08){s.target.core.sy*=1.028;s.target.core.sx*=.987;}s.rig.core.kM=t<1.95?3:1;s.rig.spine.kM=t>=.06&&t<2?4.8:1;if(t>=.06&&t<2){s.target.spine.y-=2.4;s.target.spine.sy*=1.03;}}
  for(const id of IDS){const p=s.rig[id],t=s.target[id],w2=p.k*p.kM,c=2*p.z*Math.sqrt(w2);p.vx+=(w2*(t.x-p.x)-c*p.vx)*DT;p.x+=p.vx*DT;p.vy+=(w2*(t.y-p.y)-c*p.vy)*DT;p.y+=p.vy*DT;p.vr+=(w2*(t.r-p.r)-c*p.vr)*DT;p.r+=p.vr*DT;p.vsx+=(w2*(t.sx-p.sx)-c*p.vsx)*DT;p.sx+=p.vsx*DT;p.vsy+=(w2*(t.sy-p.sy)-c*p.vsy)*DT;p.sy+=p.vsy*DT;}
  ageEffects(s);s.fixedSteps++;
}
function updateFrame(combatant,dt,input={}){
  if(!combatant||!combatant.anchor)return;const s=stateFor(combatant),frameDt=clamp(Number(dt)||0,0,.1);
  if(frameDt>0)sampleRoot(s,input.root||input,frameDt);
  updateObjectTruth(s,input,frameDt);
  s.accumulator+=frameDt;let n=0;while(s.accumulator>=DT&&n<6){fixedStep(s);s.accumulator-=DT;n++;}
  if(n>=6&&s.accumulator>=DT){s.droppedTime+=s.accumulator;s.accumulator=0;}
}
// Unit compatibility only. Production integration calls updateFrame with an
// explicit pre/post root sample through the thin adapter.
function tick(combatant,dt){const s=stateFor(combatant),a=combatant?.anchor;if(!a)return;updateFrame(combatant,dt,{root:{before:s.lastRoot||{x:a.x,y:a.y},after:{x:a.x,y:a.y},radius:a.radius}});}

function bodyK(s){return((s.root.radius||75)/BODY_REF.HX)*BODY_VISUAL_CALIBRATION;}
function transformPoint(s,id,sx,sy){
  const p=s.rig[id],pivot=META[id].pivot,k=bodyK(s),qx=sx-ORIGIN.x,qy=sy-ORIGIN.y,px=pivot[0]-ORIGIN.x,py=pivot[1]-ORIGIN.y;
  const lx=(qx-px)*p.sx,ly=(qy-py)*p.sy,c=Math.cos(p.r),sn=Math.sin(p.r);
  return{x:s.root.x+k*(p.x+SOURCE_SCALE*(px+lx*c-ly*sn)),y:s.root.y+k*(p.y+SOURCE_SCALE*(py+lx*sn+ly*c))};
}
function socketsFor(s){return{leftPoleTip:transformPoint(s,'polL',412,100),rightPoleTip:transformPoint(s,'polR',842,100),core:transformPoint(s,'core',627,610)};}
function getSockets(combatant){const s=states.get(combatant);return s?socketsFor(s):null;}
function effectiveSourceScale(ctx,s){let host=1;try{const m=ctx.getTransform();host=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));}catch(e){}return SOURCE_SCALE*bodyK(s)*host;}
function drawPart(ctx,s,id,level,bloom){
  const m=META[id],L=images[id][level],p=s.rig[id],pivot=m.pivot,k=bodyK(s);
  ctx.save();ctx.translate(s.root.x,s.root.y);ctx.scale(k,k);ctx.translate(p.x,p.y);ctx.scale(SOURCE_SCALE,SOURCE_SCALE);
  const px=pivot[0]-ORIGIN.x,py=pivot[1]-ORIGIN.y;ctx.translate(px,py);ctx.rotate(p.r);ctx.scale(p.sx,p.sy);ctx.translate(-px,-py);
  const dx=m.ox-ORIGIN.x,dy=m.oy-ORIGIN.y;
  if(!bloom){
    ctx.drawImage(L.base,dx,dy,m.w,m.h);
    for(const channel of m.channels){const value=s.gold[`${id}.${channel}`].v,layers=L.channels[channel];if(value<.98){ctx.globalAlpha=clamp(1-value,0,1);ctx.drawImage(layers.dim,dx,dy,m.w,m.h);ctx.globalAlpha=1;}else if(value>1.02){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp((value-1)*.85,0,1);ctx.drawImage(layers.gold,dx,dy,m.w,m.h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}}
  }else{
    ctx.globalCompositeOperation='lighter';for(const channel of m.channels){const value=s.gold[`${id}.${channel}`].v,alpha=clamp(value*(.42+.25*(s.a1>=0)+.23*(s.a2>=0)),0,1);if(alpha>.01){ctx.globalAlpha=alpha;ctx.drawImage(L.channels[channel].glow,dx,dy,m.w,m.h);}}
  }
  ctx.restore();
}
function a1Intensity(s){return s.a1>=0&&s.a1<=1?smooth(.06,.22,s.a1):0;}
function a2Intensity(s){return s.a2>=0&&s.a2<=1.8?smooth(.14,.26,s.a2):0;}
function importantA1(s,max=2){return s.objects.a1.filter(o=>o&&Number.isFinite(o.x)&&Number.isFinite(o.y)).sort((a,b)=>Math.hypot(a.x-s.root.x,a.y-s.root.y)-Math.hypot(b.x-s.root.x,b.y-s.root.y)).slice(0,max);}
function drawTrail(ctx,points,hostile,widthMul,bright){
  if(!points||points.length<2)return;const pts=points,n=pts.length,nx=new Float32Array(n),ny=new Float32Array(n);
  for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;nx[i]=-dy/d;ny[i]=dx/d;}
  const colors=hostile?['255,78,58','255,132,104','255,232,220']:['62,54,42','226,166,42','255,244,190'];
  ctx.save();ctx.lineJoin='round';for(let pass=0;pass<3;pass++){ctx.globalCompositeOperation=pass?'lighter':'source-over';for(let i=1;i<n;i++){const f0=(i-1)/(n-1),f1=i/(n-1),w0=lerp(.18,hostile?5.2:7.3,Math.pow(f0,1.35))*widthMul*[1,.48,.17][pass],w1=lerp(.22,hostile?5.2:7.3,Math.pow(f1,1.35))*widthMul*[1,.48,.17][pass],alpha=[.12,.36,.8][pass]*bright*Math.pow(f1,.75),a=pts[i-1],b=pts[i];ctx.fillStyle=`rgba(${colors[pass]},${alpha})`;ctx.beginPath();ctx.moveTo(a.x+nx[i-1]*w0,a.y+ny[i-1]*w0);ctx.lineTo(b.x+nx[i]*w1,b.y+ny[i]*w1);ctx.lineTo(b.x-nx[i]*w1,b.y-ny[i]*w1);ctx.lineTo(a.x-nx[i-1]*w0,a.y-ny[i-1]*w0);ctx.closePath();ctx.fill();}}ctx.restore();
}
function displacement(s,x,y){
  let dx=0,dy=0,f1=a1Intensity(s),f2=a2Intensity(s);
  if(f2>.02){const ex=x-s.root.x,ey=y-s.root.y,d=Math.hypot(ex,ey);if(d<240&&d>1){const u=d/240,f=8.2*u*(1-u)*(1-u)*16*f2;dx+=ex/d*f;dy+=ey/d*f;}}
  if(f1>.02)for(const o of importantA1(s,3)){const ex=x-o.x,ey=y-o.y,d=Math.hypot(ex,ey),sp=Math.hypot(o.vx||0,o.vy||0);if(d<92&&d>1&&sp>80){const u=1-d/92,f=10*Math.min(1,sp/700)*u*u;dx+=(o.vx||0)/(sp||1)*f;dy+=(o.vy||0)/(sp||1)*f;}}
  for(const b of s.bumps){const ex=x-b.x,ey=y-b.y,d2=ex*ex+ey*ey,sig=b.sigma*b.sigma;if(d2<sig*7){const k=1-b.age/b.d,p=Math.exp(-d2/sig)*b.amp*k;dx+=b.nx*p;dy+=b.ny*p;}}
  return[dx,dy];
}
function drawFloorDistortion(ctx,s){if(a1Intensity(s)<.02&&a2Intensity(s)<.02&&!s.bumps.length)return;ctx.save();ctx.lineWidth=.78;ctx.strokeStyle=a2Intensity(s)>.02?'rgba(214,222,226,.11)':'rgba(214,222,226,.075)';ctx.beginPath();for(let line=50;line<1000;line+=50){for(let p=0;p<=1000;p+=12.5){const o=displacement(s,line,p);if(!p)ctx.moveTo(line+o[0],p+o[1]);else ctx.lineTo(line+o[0],p+o[1]);}for(let p=0;p<=1000;p+=12.5){const o=displacement(s,p,line);if(!p)ctx.moveTo(p+o[0],line+o[1]);else ctx.lineTo(p+o[0],line+o[1]);}}ctx.stroke();ctx.restore();}
function drawHistories(ctx,s){const f=a1Intensity(s);if(f<.03)return;const active=new Set(s.objects.a1.map((o,i)=>objectKey(o,i)));for(const[key,h]of s.histories)if(active.has(key))drawTrail(ctx,h.points,h.hostile,h.object?.kind==='gun'?.8:1,f);}
function drawArcs(ctx,s){if(!s.arcs.length)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(const a of s.arcs){const k=a.age/a.d,env=(1-k)*Math.min(1,a.age/.055),base=a.color==='impact'?'255,224,176':a.color==='a1'?'234,174,42':'255,205,70';for(const q of [[1,.22,3],[.68,.48,1.75],[.34,.92,.82]]){ctx.strokeStyle=`rgba(${base},${env*q[1]})`;ctx.lineWidth=a.w*q[2];ctx.beginPath();ctx.arc(a.x,a.y,Math.max(2,a.r),a.a-a.span*q[0],a.a+a.span*q[0]);ctx.stroke();}}ctx.restore();}
function currentObject(s,ring){return[...s.objects.a1,...s.objects.a2].find((o,i)=>objectKey(o,i)===ring.key)||ring.object;}
function drawRings(ctx,s){ctx.save();ctx.globalCompositeOperation='lighter';for(const ring of s.rings){const o=currentObject(s,ring);if(!o)continue;const k=ring.age/ring.d,r=20+34*k,a=(1-k)*Math.min(1,ring.age/.06)*ring.alpha;ctx.strokeStyle=`rgba(255,205,72,${a*.42})`;ctx.lineWidth=2.3;ctx.beginPath();ctx.arc(o.x,o.y,r,0,TAU);ctx.stroke();ctx.strokeStyle=`rgba(255,239,176,${a})`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(o.x,o.y,r-3,0,TAU);ctx.stroke();}ctx.restore();}
function drawReactiveField(ctx,s){const f=a2Intensity(s);if(f<.025)return;const defs=[[.08,.88,.42,1],[Math.PI-.08,.88,.42,1],[-.95,.60,.58,.82],[Math.PI+.95,.60,.58,.82],[.85,.70,.72,.72],[Math.PI-.85,.70,.72,.72],[-2.05,.50,.86,.58],[-1.1,.45,.92,.52],[2.2,.55,.82,.62],[.4,.40,.96,.46]];ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(let i=0;i<defs.length;i++){const d=defs[i],a=d[0]+Math.sin(s.simTime*.32+i*1.7)*.07,bin=((((a/TAU)%1)+1)%1*24|0),hot=Math.max(s.hot[bin],s.hot[(bin+1)%24]*.8,s.hot[(bin+23)%24]*.8),r=225*d[2]*(1+.02*Math.sin(s.simTime*1.4+i)),alpha=f*(.14+.92*hot)*(1.12-d[2]*.34);ctx.strokeStyle=`rgba(255,178,32,${alpha*.42})`;ctx.lineWidth=4.1*d[3]+hot*4;ctx.beginPath();ctx.arc(s.root.x,s.root.y-6,r,a-d[1]/2,a+d[1]/2);ctx.stroke();ctx.strokeStyle=`rgba(255,236,158,${Math.min(.82,alpha*1.08)})`;ctx.lineWidth=1.15*d[3]+hot*1.5;ctx.beginPath();ctx.arc(s.root.x,s.root.y-6,r,a-d[1]/2,a+d[1]/2);ctx.stroke();}ctx.restore();}
function drawA1Filaments(ctx,s){const f=a1Intensity(s),targets=importantA1(s,2);if(f<.04||!targets.length)return;const sockets=socketsFor(s),tips=[sockets.leftPoleTip,sockets.rightPoleTip];ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(let side=0;side<2;side++){const p=tips[side];for(let i=0;i<targets.length;i++){const o=targets[i],ex=o.x-p.x,ey=o.y-p.y,len=Math.hypot(ex,ey)||1;if(len<105)continue;const mx=(p.x+o.x)/2,my=(p.y+o.y)/2,bow=(side?1:-1)*(.12+.03*i)*len*(i?-.75:1),cx=mx-ey/len*bow,cy=my+ex/len*bow,u=1-((s.simTime*1.55+side*.37+i*.21)%1),seg=.23;for(let pass=0;pass<2;pass++){ctx.beginPath();for(let k=0;k<=18;k++){const q=clamp(u-seg+seg*k/18,0,1),v=1-q,x=v*v*p.x+2*v*q*cx+q*q*o.x,y=v*v*p.y+2*v*q*cy+q*q*o.y;if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.strokeStyle=pass?`rgba(255,239,178,${f*(i?.16:.24)})`:`rgba(205,145,24,${f*(i?.16:.28)})`;ctx.lineWidth=pass?.72:2.7;ctx.stroke();}const q=(s.simTime*1.45+side*.31+i*.16)%1,v=1-q,x=v*v*p.x+2*v*q*cx+q*q*o.x,y=v*v*p.y+2*v*q*cy+q*q*o.y,gr=ctx.createRadialGradient(x,y,0,x,y,7);gr.addColorStop(0,`rgba(255,252,226,${f*.7})`);gr.addColorStop(.35,`rgba(255,210,72,${f*.42})`);gr.addColorStop(1,'rgba(255,190,40,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,7,0,TAU);ctx.fill();}}ctx.restore();}
function drawPressureFronts(ctx,s){const f=a1Intensity(s);if(f<.05)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(const o of s.objects.a1){if(o.kind!=='gun')continue;const speed=Math.hypot(o.vx||0,o.vy||0);if(speed<140)continue;const a=Math.atan2(o.vy,o.vx),r=17+clamp(speed/900,0,1)*9,alpha=f*clamp(speed/800,0,1),x=o.x+Math.cos(a)*11,y=o.y+Math.sin(a)*11;ctx.strokeStyle=`rgba(255,230,160,${alpha*.34})`;ctx.lineWidth=1.45;ctx.beginPath();ctx.arc(x,y,r,a-.75,a+.75);ctx.stroke();ctx.strokeStyle=`rgba(255,188,38,${alpha*.18})`;ctx.lineWidth=3.2;ctx.beginPath();ctx.arc(x,y,r+4,a-.58,a+.58);ctx.stroke();}ctx.restore();}
function drawObjectPressure(ctx,s){const f=a2Intensity(s);if(f<.05)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';let count=0;for(const o of s.objects.a2){const dx=o.x-s.root.x,dy=o.y-s.root.y,d=Math.hypot(dx,dy);if(!(d>1&&d<225)||count++>=8)continue;const a=Math.atan2(dy,dx),span=clamp(((o.radius||5)+22)/d,.08,.48),power=clamp((225-d)/120,0,1)*f,r=Math.max(70,d-(o.radius||5)-5);for(let j=0;j<2;j++){ctx.strokeStyle=`rgba(255,214,82,${power*(j?.28:.62)})`;ctx.lineWidth=j?2.8:1.2;ctx.beginPath();ctx.arc(s.root.x,s.root.y-4,r-j*7,a-span*(1+j*.2),a+span*(1+j*.2));ctx.stroke();}}ctx.restore();}
function drawCorridors(ctx,s){if(!s.corridors.length)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';for(const q of s.corridors){const k=q.age/q.d,env=Math.sin(Math.PI*clamp(k,0,1))*q.alpha,ux=Math.cos(q.angle),uy=Math.sin(q.angle),nx=-uy,ny=ux,width=q.width*(1-smooth(.25,.7,k));for(const side of[-1,1]){const gr=ctx.createLinearGradient(q.x,q.y,q.x+ux*q.len,q.y+uy*q.len);gr.addColorStop(0,`rgba(255,226,135,${env*.72})`);gr.addColorStop(1,'rgba(255,226,135,0)');ctx.strokeStyle=gr;ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(q.x+nx*width*side,q.y+ny*width*side);ctx.lineTo(q.x+ux*q.len+nx*width*.42*side,q.y+uy*q.len+ny*width*.42*side);ctx.stroke();}}ctx.restore();}
function drawEchoes(ctx,s){if(!ready)return;for(const e of s.echoes){const alpha=e.alpha*(1-e.age/e.d),level=effectiveSourceScale(ctx,s)>.28?0:1;if(alpha<=.004)continue;ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation='screen';for(const id of IDS){const m=META[id],L=images[id][level],p=e.rig[id],pivot=m.pivot,k=e.bodyK||bodyK(s);ctx.save();ctx.translate(e.x+e.dx,e.y+e.dy);ctx.scale(k,k);ctx.translate(p.x,p.y);ctx.scale(SOURCE_SCALE,SOURCE_SCALE);const px=pivot[0]-ORIGIN.x,py=pivot[1]-ORIGIN.y;ctx.translate(px,py);ctx.rotate(p.r);ctx.scale(p.sx,p.sy);ctx.translate(-px,-py);ctx.drawImage(L.base,m.ox-ORIGIN.x,m.oy-ORIGIN.y,m.w,m.h);ctx.restore();}ctx.restore();}}
function drawParticles(ctx,s){ctx.save();ctx.globalCompositeOperation='lighter';for(const p of s.particles){const a=1-p.age/p.d;if(p.kind==='mote'){ctx.fillStyle=`rgba(255,210,90,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}}ctx.restore();}
function lens(ctx,x,y,r,mag,sx,sy,alpha){try{const m=ctx.getTransform(),scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),cx=m.a*x+m.c*y+m.e,cy=m.b*x+m.d*y+m.f,rd=r*scale,canvas=ctx.canvas;if(!(rd>4)||!canvas)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.arc(cx,cy,rd,0,TAU);ctx.clip();ctx.globalAlpha=alpha;const sr=rd/mag;ctx.drawImage(canvas,cx-sr+sx*scale,cy-sr+sy*scale,sr*2,sr*2,cx-rd,cy-rd,rd*2,rd*2);ctx.restore();}catch(error){}}
function drawLenses(ctx,s){const f1=a1Intensity(s),f2=a2Intensity(s);if(f1>.05){const sockets=socketsFor(s),a=f1*.55*(1-smooth(.95,1.12,s.a1));lens(ctx,(sockets.leftPoleTip.x+s.root.x)/2,(sockets.leftPoleTip.y+s.root.y)/2,26,1.12,1.2,0,a);lens(ctx,(sockets.rightPoleTip.x+s.root.x)/2,(sockets.rightPoleTip.y+s.root.y)/2,26,1.12,-1.2,0,a);}let n=0;for(const b of s.bumps){if(n++>4)break;lens(ctx,b.x,b.y,b.sigma,1.15,b.nx*1.8,b.ny*1.8,.42*(1-b.age/b.d));}if(f2>.25){n=0;for(const o of s.objects.a2){if(n++>5)break;const vx=o.vx||0,vy=o.vy||0,sp=Math.hypot(vx,vy)||1;lens(ctx,o.x,o.y,(o.radius||5)+14,1.22,vx/sp*2,vy/sp*2,.6*f2*(1-smooth(1.75,1.9,s.a2)));}}}
function drawBefore(ctx,combatant){const s=states.get(combatant);if(!s||!ctx)return;ctx.save();try{drawFloorDistortion(ctx,s);drawHistories(ctx,s);drawRings(ctx,s);drawReactiveField(ctx,s);drawArcs(ctx,s);drawEchoes(ctx,s);}finally{ctx.restore();}}
function drawAfter(ctx,combatant){const s=states.get(combatant);if(!s||!ctx)return;ctx.save();try{drawA1Filaments(ctx,s);drawPressureFronts(ctx,s);drawObjectPressure(ctx,s);drawCorridors(ctx,s);drawParticles(ctx,s);drawLenses(ctx,s);}finally{ctx.restore();}}

function draw(ctx,combatant){
  if(!ready||!ctx||!combatant||!combatant.anchor)return false;const s=stateFor(combatant),level=effectiveSourceScale(ctx,s)>.28?0:1;
  ctx.save();try{for(const id of IDS)drawPart(ctx,s,id,level,false);for(const id of IDS)drawPart(ctx,s,id,level,true);s.sockets=socketsFor(s);}finally{ctx.restore();}return true;
}
function teardown(combatant){if(combatant)states.delete(combatant);else states.clear();}
function stateSnapshot(s){return s&&{fixedSteps:s.fixedSteps,droppedTime:s.droppedTime,accumulator:s.accumulator,simTime:s.simTime,frameCount:s.frameCount,a1:s.a1,a2:s.a2,passive:s.passive,bodyScale:SOURCE_SCALE*bodyK(s),bodyCalibration:BODY_VISUAL_CALIBRATION,root:{...s.root},velocity:{...s.velocity},acceleration:{...s.acceleration},a1Target:{...s.a1Target},desiredA1Target:{...s.desiredA1Target},rig:s.rig,gold:s.gold,sockets:socketsFor(s),effects:{histories:s.histories.size,arcs:s.arcs.length,bumps:s.bumps.length,echoes:s.echoes.length,corridors:s.corridors.length,rings:s.rings.length,particles:s.particles.length,hot:[...s.hot]}};}
function inspect(combatant){const s=combatant?states.get(combatant):null;return{ready,loadError:loadError&&String(loadError),stateCount:states.size,state:stateSnapshot(s)};}

g.APEX_MAGNET_GOLD={
  version:'2.0.0-canonical-engine',DT,META,BODY_REF,BODY_VISUAL_CALIBRATION,
  updateFrame,tick,cue,drawBefore,draw,drawActor:draw,drawAfter,getSockets,teardown,inspect,
  get ready(){return ready;},
};
g.apexMagnetGoldV1='ready';
})(typeof window!=='undefined'?window:globalThis);
