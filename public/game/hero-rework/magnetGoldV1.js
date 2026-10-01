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
    objects:{a1:[],a2:[]},sockets:null,
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
}
function impact(s,data={}){
  const dx=Number(data.dx)||0,dy=Number(data.dy)||0,mag=clamp(Number(data.magnitude)||5,2,14);
  structural(s,dx,dy,mag,data.side==null?(dx<0?0:1):data.side,mag<4.5?0:mag<8?1:2);
  pulse(s,'core.eyes',.4,.08);goldRecover(s,dx<0?0:1,mag<4.5?0:mag<8?1:2);
}

function startA1(s,data={}){
  s.a1=0;s.lastAct=s.simTime;
  const x=Number(data.x)||0,y=Number(data.y)||0,d=Math.hypot(x,y);
  s.desiredA1Target.x=d?x/d:0;s.desiredA1Target.y=d?y/d:0;s.a1Lead=x<0?0:1;
  goldRouteA1(s);
}
function startA2(s){
  s.a2=0;s.a2Lead=s.random()<.5?0:1;s.lastAct=s.simTime;
  after(s,70,()=>{pulse(s,'core.main',.75,.15);pulse(s,'core.eyes',.48,.14);});
  after(s,155,()=>{pulse(s,'polL.out',.72,.18);pulse(s,'polR.out',.72,.18);});
  s.rig.core.vsy+=-.03*14;s.rig.core.vsx+=.03*14;
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
}
function cue(combatant,type,data){const s=stateFor(combatant);if(type==='a1')startA1(s,data);else if(type==='a2')startA2(s);else if(type==='passive')passiveEmission(s,data);else if(type==='impact')impact(s,data);else if(type==='wall')wallImpact(s,data?.nx||0,data?.ny||0,data?.speed||0);}

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
  s.fixedSteps++;
}
function updateFrame(combatant,dt,input={}){
  if(!combatant||!combatant.anchor)return;const s=stateFor(combatant),frameDt=clamp(Number(dt)||0,0,.1);
  if(input.a1Target){const x=Number(input.a1Target.x)||0,y=Number(input.a1Target.y)||0,d=Math.hypot(x,y);s.desiredA1Target.x=d?x/d:0;s.desiredA1Target.y=d?y/d:0;if(d)s.a1Lead=x<0?0:1;}
  if(Array.isArray(input.a1Objects))s.objects.a1=input.a1Objects;if(Array.isArray(input.a2Objects))s.objects.a2=input.a2Objects;
  if(frameDt>0)sampleRoot(s,input.root||input,frameDt);
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
function draw(ctx,combatant){
  if(!ready||!ctx||!combatant||!combatant.anchor)return false;const s=stateFor(combatant),level=effectiveSourceScale(ctx,s)>.28?0:1;
  ctx.save();try{for(const id of IDS)drawPart(ctx,s,id,level,false);for(const id of IDS)drawPart(ctx,s,id,level,true);s.sockets=socketsFor(s);}finally{ctx.restore();}return true;
}
function teardown(combatant){if(combatant)states.delete(combatant);else states.clear();}
function stateSnapshot(s){return s&&{fixedSteps:s.fixedSteps,droppedTime:s.droppedTime,accumulator:s.accumulator,simTime:s.simTime,frameCount:s.frameCount,a1:s.a1,a2:s.a2,passive:s.passive,bodyScale:SOURCE_SCALE*bodyK(s),bodyCalibration:BODY_VISUAL_CALIBRATION,root:{...s.root},velocity:{...s.velocity},acceleration:{...s.acceleration},a1Target:{...s.a1Target},desiredA1Target:{...s.desiredA1Target},rig:s.rig,gold:s.gold,sockets:socketsFor(s)};}
function inspect(combatant){const s=combatant?states.get(combatant):null;return{ready,loadError:loadError&&String(loadError),stateCount:states.size,state:stateSnapshot(s)};}

g.APEX_MAGNET_GOLD={
  version:'2.0.0-canonical-engine',DT,META,BODY_REF,BODY_VISUAL_CALIBRATION,
  updateFrame,tick,cue,draw,drawActor:draw,getSockets,teardown,inspect,
  get ready(){return ready;},
};
g.apexMagnetGoldV1='ready';
})(typeof window!=='undefined'?window:globalThis);
