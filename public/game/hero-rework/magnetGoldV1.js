/* =============================================================================
 * MAGNET V1 — canonical Gold cutout rig.
 * Raster layers are immutable outputs of MAGNET_FINAL_DONOR_MAX.html's own
 * buildAssets pipeline. Presentation simulation advances only at 1/120 s.
 * ========================================================================== */
(function (globalScope) {
  'use strict';
  if (globalScope.APEX_MAGNET_GOLD) return;

  const DT = 1 / 120, DEG = Math.PI / 180, SCALE = 170 / 1020;
  const ORIGIN = { x: 627, y: 610 };
  const IDS = ['core', 'spine', 'polL', 'polR', 'lobeL', 'lobeR'];
  const POLES = ['polL', 'polR'], LOBES = ['lobeL', 'lobeR'], INWARD = [1, -1];
  const META = {
    core:  { ox:234, oy:47,  w:786, h:1125, pivot:[627,640], channels:['main','eyes'] },
    spine: { ox:411, oy:165, w:432, h:577,  pivot:[627,660], channels:['main'] },
    polL:  { ox:-19, oy:50, w:591, h:1123, pivot:[470,820], channels:['in','out'] },
    polR:  { ox:682, oy:50, w:591, h:1123, pivot:[784,820], channels:['in','out'] },
    lobeL: { ox:72,  oy:730,w:329, h:371,  pivot:[250,830], channels:[] },
    lobeR: { ox:852, oy:730,w:330, h:371,  pivot:[1004,830],channels:[] },
  };
  const RC = { core:[330,.78], spine:[360,.62], polL:[200,.55], polR:[200,.55], lobeL:[260,.55], lobeR:[260,.55] };
  const CHANNELS = ['core.main','core.eyes','spine.main','polL.in','polL.out','polR.in','polR.out'];
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a), 0, 1); return t*t*(3-2*t); };
  const bump = (t,u,h,d) => t < 0 ? 0 : t < u ? smooth(0,u,t) : t < u+h ? 1 : t < u+h+d ? 1-smooth(0,d,t-u-h) : 0;

  const images = {};
  let ready = false, loadError = null;
  function image(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`MAGNET Gold asset failed: ${src}`));
      im.src = src;
    });
  }
  async function load() {
    try {
      const jobs = [];
      for (const id of IDS) {
        images[id] = [];
        for (const tag of ['half','quarter']) {
          const level = { channels:{} }; images[id].push(level);
          jobs.push(image(`/assets/magnet_v1/gold/${id}-${tag}-base.png`).then((im) => { level.base = im; }));
          for (const channel of META[id].channels) {
            const layers = {}; level.channels[channel] = layers;
            for (const kind of ['gold','dim','glow']) jobs.push(
              image(`/assets/magnet_v1/gold/${id}-${tag}-${channel}-${kind}.png`).then((im) => { layers[kind] = im; })
            );
          }
        }
      }
      await Promise.all(jobs); ready = true;
    } catch (error) { loadError = error; }
  }
  load();

  const states = new Map();
  function createState(combatant) {
    const rig = {}, target = {}, gold = {};
    for (const id of IDS) {
      rig[id] = { x:0,y:0,r:0,sx:1,sy:1,vx:0,vy:0,vr:0,vsx:0,vsy:0,k:RC[id][0],z:RC[id][1],kM:1 };
      target[id] = { x:0,y:0,r:0,sx:1,sy:1 };
    }
    for (const key of CHANNELS) gold[key] = { env:1,pulse:0,tau:.12,dip:0,hold:0,rec:.2,v:1 };
    let seed = (0x4d41474e ^ ((combatant.idx + 1) * 0x9e3779b9)) >>> 0;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0x100000000; };
    return {
      combatant, rig, target, gold, random, accumulator:0, fixedSteps:0, droppedTime:0, simTime:0,
      a1:-1, a2:-1, a1Lead:1, a2Lead:1, a1Target:{x:0,y:0}, passive:0,
      hax:new Float32Array(128), hay:new Float32Array(128), hi:0, leadSide:1,
      prev:null, velocity:{x:0,y:0}, acceleration:{x:0,y:0}, lastMoving:false,
      lastDir:{x:1,y:0}, turnCooldown:0, wall:{L:false,R:false,T:false,B:false}, slide:0, slideNormal:{x:0,y:0},
      lastAct:0, idle:{next:2.2,t0:-99,side:0,amp:2,rot:.8,dir:1,dy:0,w:1}, queue:[],
    };
  }
  function stateFor(combatant) {
    let state = states.get(combatant);
    if (!state) { state = createState(combatant); states.set(combatant, state); }
    return state;
  }
  function after(s, ms, fn) { s.queue.push({ at:s.simTime + ms/1000, fn }); }
  function runQueue(s) {
    for (let i=0; i<s.queue.length;) {
      if (s.queue[i].at <= s.simTime) { const q=s.queue[i]; s.queue[i]=s.queue[s.queue.length-1]; s.queue.pop(); q.fn(); }
      else i++;
    }
  }
  function pulse(s,key,amount,tau) { const g=s.gold[key]; if (!g) return; g.pulse=Math.max(g.pulse,amount); g.tau=tau||.14; }
  function dip(s,key,amount,hold,recover) { const g=s.gold[key]; if (!g) return; g.dip=Math.max(g.dip,amount); g.hold=hold; g.rec=recover; }
  function peakF(z) { const q=Math.sqrt(1-z*z); return Math.exp(-(z/q)*Math.atan2(q,z)); }
  function kick(s,id,dx,dy,dr,ds) {
    const p=s.rig[id], w=Math.sqrt(p.k*p.kM)/peakF(p.z);
    p.vx+=(dx||0)*w; p.vy+=(dy||0)*w; p.vr+=(dr||0)*w;
    if (ds) { p.vsx+=ds*w; p.vsy+=ds*w; }
  }
  function poleChannels(side) { return [`${POLES[side]}.in`,`${POLES[side]}.out`]; }
  function startA1(s, targetX, targetY) {
    s.a1=0; s.a1Target.x=targetX||0; s.a1Target.y=targetY||0;
    s.a1Lead=s.a1Target.x<0?0:1; s.lastAct=s.simTime;
    after(s,70,()=>pulse(s,'spine.main',.72,.18));
    after(s,135,()=>{pulse(s,'core.main',.62,.18);pulse(s,'core.eyes',.34,.15);});
    after(s,190,()=>{pulse(s,'polL.in',.72,.17);pulse(s,'polR.in',.72,.17);});
    after(s,240,()=>{pulse(s,'polL.out',.36,.19);pulse(s,'polR.out',.36,.19);});
  }
  function startA2(s) {
    s.a2=0; s.a2Lead=s.random()<.5?0:1; s.lastAct=s.simTime;
    after(s,70,()=>{pulse(s,'core.main',.75,.15);pulse(s,'core.eyes',.48,.14);});
    after(s,155,()=>{pulse(s,'polL.out',.72,.18);pulse(s,'polR.out',.72,.18);});
    s.rig.core.vsy+=-.03*14; s.rig.core.vsx+=.03*14;
  }
  function passive(s, angle) {
    const ax=Math.cos(angle||0), ay=Math.sin(angle||0), side=ax<0?0:1, other=1-side;
    s.passive=.42; s.lastAct=s.simTime;
    kick(s,POLES[side],INWARD[side]*3,0,0,-.02); kick(s,POLES[other],-INWARD[side]*1.4,0,0);
    pulse(s,'core.eyes',.3,.1); pulse(s,'spine.main',.3,.1);
    kick(s,POLES[side],ax*4,ay*4,ax*1.2*DEG*INWARD[side]*-1);
    for (const k of poleChannels(side)) pulse(s,k,1,.045);
    after(s,40,()=>kick(s,POLES[other],-ax*1.2,-ay*1.2)); kick(s,'core',-ax*.6,-ay*.6,0,0);
  }
  function impact(s, dx, dy, magnitude, side) {
    const mag=clamp(magnitude||5,2,14), near=side==null?(dx<0?0:1):side;
    kick(s,POLES[near],dx*mag,dy*mag,dx*mag*.3*DEG-dy*INWARD[near]*.12*mag*DEG,-.016*mag/8);
    for (const k of poleChannels(near)) dip(s,k,.85,.08,.25);
    after(s,25,()=>kick(s,'core',dx*mag*.42,dy*mag*.42,0,0));
    after(s,35,()=>kick(s,'spine',dx*mag*.3,dy*mag*.3,dx*.15*mag*DEG));
    after(s,67,()=>kick(s,POLES[1-near],dx*mag*.55,dy*mag*.55,dx*mag*.22*DEG));
    after(s,50,()=>{const a=mag*.06*DEG;kick(s,'lobeL',-dx*mag*.25,-dy*mag*.25,a*(dx>=0?-1:1)*8);kick(s,'lobeR',-dx*mag*.25,-dy*mag*.25,-a*(dx>=0?-1:1)*8);});
    pulse(s,'core.eyes',.4,.08); s.lastAct=s.simTime;
  }
  function goldTarget(s,key) {
    let value=1;
    if (s.a1>=0) {
      const k=key.replace(/pol[LR]/,'pol');
      const c={ 'spine.main':[.08,1.12,1.6], 'core.main':[.14,1.08,1.45], 'core.eyes':[0,1.10,1.35], 'pol.in':[.20,1,1.95], 'pol.out':[.26,1.03,1.3] }[k];
      if (c && s.a1>=c[0] && s.a1<c[1]) value=c[2];
    }
    if (s.a2>=0) {
      const t=s.a2;
      if (key.startsWith('pol')&&key.endsWith('.out')) { if(t<.18)value=.35; else if(t<1.8)value=1.65; }
      else if(key.startsWith('pol')&&key.endsWith('.in')&&t>=.18&&t<1.86)value=1.25;
      else if(key==='core.main'){if(t<.18)value=1.8;else if(t<1.92)value=1.15;}
      else if(key==='core.eyes'){if(t<.18)value=1.7;else if(t<1.92)value=1.2;}
      else if(key==='spine.main'&&t>=.06&&t<2)value=1.3;
    }
    return value;
  }
  function startIdle(s) {
    const i=s.idle;i.t0=s.simTime;i.side=s.random()<.5?0:1;i.amp=1+s.random()*1.8;i.rot=.5+s.random()*.7;i.dir=s.random()<.5?-1:1;i.dy=-.8+s.random()*1.6;i.next=s.simTime+4+s.random()*3.2;
    after(s,170,()=>{if(i.w>.6)pulse(s,'spine.main',.22,.25);});
  }
  function senseRoot(s, body, dt) {
    if (!s.prev) s.prev={x:body.x,y:body.y};
    const vx=(body.x-s.prev.x)/dt, vy=(body.y-s.prev.y)/dt;
    const axr=clamp((vx-s.velocity.x)/dt,-2400,2400), ayr=clamp((vy-s.velocity.y)/dt,-2400,2400), f=1-Math.exp(-dt/.03);
    s.acceleration.x+=(axr-s.acceleration.x)*f;s.acceleration.y+=(ayr-s.acceleration.y)*f;
    const speed=Math.hypot(vx,vy), oldSpeed=Math.hypot(s.velocity.x,s.velocity.y);
    if (speed>140&&oldSpeed>140&&(vx*s.velocity.x+vy*s.velocity.y)/(speed*oldSpeed)<-.25&&s.simTime>s.turnCooldown) {
      s.turnCooldown=s.simTime+.4;const dx=vx/speed,dy=vy/speed,side=dx>.25?1:dx<-.25?0:(s.velocity.x>0?0:1);
      kick(s,'core',dx*1.2,dy*1.2);kick(s,POLES[side],dx*2.2,dy*2.2,dx*.8*DEG);after(s,60,()=>kick(s,POLES[1-side],s.lastDir.x*3.2,s.lastDir.y*3.2,s.lastDir.x*1.1*DEG));
    }
    if(speed>25&&!s.lastMoving&&oldSpeed<90){const dx=vx/(speed||1),dy=vy/(speed||1),side=dx>=0?1:0;kick(s,'core',dx*1.3,dy*1.3);after(s,65,()=>kick(s,POLES[side],-dx*1.6,-dy*1.6,-dx*.5*DEG));after(s,105,()=>kick(s,POLES[1-side],-dx*2.4,-dy*2.4,-dx*.7*DEG));}
    if(speed<35&&s.lastMoving&&oldSpeed>150){const d=s.lastDir,side=d.x>=0?1:0;kick(s,'core',d.x*.6,d.y*.6);kick(s,POLES[side],d.x*2,d.y*2,d.x*.7*DEG);after(s,60,()=>kick(s,POLES[1-side],d.x*3,d.y*3,d.x*.9*DEG));}
    if(speed>25){s.lastDir.x=vx/speed;s.lastDir.y=vy/speed;} s.lastMoving=speed>35;
    s.velocity.x=vx;s.velocity.y=vy;s.prev.x=body.x;s.prev.y=body.y;
    const size=Number(globalScope.GAME_SIZE)||1000,r=body.radius||75;
    const contact={L:body.x<=r+.5,R:body.x>=size-r-.5,T:body.y<=r+.5,B:body.y>=size-r-.5};
    const normals={L:[1,0],R:[-1,0],T:[0,1],B:[0,-1]};
    let sliding=null;
    for(const key of Object.keys(contact)){if(contact[key]&&!s.wall[key]){const n=normals[key],vn=Math.max(0,-(vx*n[0]+vy*n[1]));if(vn>25)impact(s,n[0],n[1],clamp(2.5+vn*.015,2.5,13),key==='L'?0:key==='R'?1:2);}s.wall[key]=contact[key];if(contact[key]&&(key==='L'||key==='R'?Math.abs(vy):Math.abs(vx))>110)sliding=normals[key];}
    if(sliding){s.slideNormal.x=sliding[0];s.slideNormal.y=sliding[1];}s.slide+=((sliding?1:0)-s.slide)*(1-Math.exp(-dt*(sliding?16:6)));
  }
  function fixedStep(s) {
    s.simTime+=DT; runQueue(s);
    if(s.a1>=0){s.a1+=DT;if(s.a1>=1.6)s.a1=-1;}if(s.a2>=0){s.a2+=DT;if(s.a2>=2.3)s.a2=-1;}if(s.passive>0)s.passive=Math.max(0,s.passive-DT);
    for(const key of CHANNELS){const g=s.gold[key];g.env+=(goldTarget(s,key)-g.env)*(1-Math.exp(-DT*15));g.pulse*=Math.exp(-DT/g.tau);if(g.hold>0)g.hold-=DT;else g.dip=Math.max(0,g.dip-DT/g.rec);g.v=clamp((g.env+g.pulse)*(1-g.dip),0,2.2);}
    s.hax[s.hi]=s.acceleration.x;s.hay[s.hi]=s.acceleration.y;s.hi=(s.hi+1)&127;
    for(const id of IDS){Object.assign(s.target[id],{x:0,y:0,r:0,sx:1,sy:1});s.rig[id].kM=1;}
    if(Math.abs(s.velocity.x)>60)s.leadSide=s.velocity.x>0?1:0;
    const speed=Math.hypot(s.velocity.x,s.velocity.y),busy=speed>25||s.a1>=0||s.a2>=0||s.simTime-s.lastAct<1,i=s.idle;
    i.w+=((busy?0:1)-i.w)*(1-Math.exp(-DT*(busy?14:1.5)));if(!busy&&s.simTime>i.next&&i.w>.85)startIdle(s);
    const lag=ms=>(s.hi-1-Math.min(127,Math.round(ms*.12))+256)&127;
    let j=lag(0);s.target.core.x+=s.velocity.x*.0072-s.hax[j]*.001;s.target.core.y+=s.velocity.y*.0068-s.hay[j]*.001;
    j=lag(28);s.target.spine.x+=-s.hax[j]*.0026;s.target.spine.y+=-s.hay[j]*.0024;
    for(let side=0;side<2;side++){const near=side===s.leadSide;j=lag(near?48:118);const gn=near?.00245:.00355,t=s.target[POLES[side]];t.x+=-s.hax[j]*gn;t.y+=-s.hay[j]*gn;t.r+=-s.hax[j]*.0000063*(near?1:1.32);j=lag(near?118:150);const l=s.target[LOBES[side]];l.x+=s.hax[j]*.0019;l.y+=s.hay[j]*.0017;l.r+=s.hax[j]*.000017*INWARD[side];}
    if(s.slide>.01){const n=s.slideNormal;for(const side of [0,1]){const f=(n.x>0&&side===0)||(n.x<0&&side===1)||!n.x?1.6:.6;s.target[POLES[side]].x+=n.x*f*s.slide;s.target[POLES[side]].y+=n.y*f*s.slide;s.target[LOBES[side]].x-=n.x*.6*s.slide;s.target[LOBES[side]].y-=n.y*.6*s.slide;}}
    const tt=s.simTime-i.t0;if(tt<2.4&&i.w>.02){const w=i.w,side=i.side,other=1-side,d=i.dir,b0=bump(tt,.3,.35,.45),b1=bump(tt-.06,.3,.3,.45),b2=bump(tt-.10,.3,.3,.45),b3=bump(tt-.15,.3,.25,.45);s.target[POLES[side]].x+=d*i.amp*b0*w;s.target[POLES[side]].y+=i.dy*b0*w;s.target[POLES[side]].r+=d*INWARD[side]*i.rot*DEG*b0*w;s.target.core.x+=d*.6*b1*w;s.target.core.y+=i.dy*.3*b1*w;s.target[POLES[other]].x-=d*i.amp*.45*b2*w;s.target[POLES[other]].r-=d*INWARD[other]*i.rot*.45*DEG*b2*w;s.target[LOBES[side]].x+=d*.4*b3*w;s.target[LOBES[other]].x-=d*.3*b3*w;}
    if(s.a1>=0){const t=s.a1;for(let side=0;side<2;side++){const lead=side===s.a1Lead,on=t>=(lead?.10:.13)&&t<(lead?1.08:1.16),p=s.target[POLES[side]];if(on){p.x+=INWARD[side]*12.5;p.y-=2.4;p.r+=INWARD[side]*4.6*DEG;p.sx*=.964;p.sy*=1.013;}if(t>=.06&&t<(lead?1.12:1.16)){const l=s.target[LOBES[side]];l.x+=INWARD[side]*3.8;l.y-=2.1;l.r+=INWARD[side]*2.25*DEG;}}if(t>=.06&&t<1.05){s.target.core.sy*=1.02;s.target.core.sx*=.97;s.target.core.y-=1.4;}if(t>=.06&&t<1.08){s.target.spine.y-=3.5;s.target.spine.sy*=1.046;}s.rig.core.kM=t>.22&&t<1.05?2.6:1;}
    if(s.a2>=0){const t=s.a2;for(let side=0;side<2;side++){const lead=side===s.a2Lead,on=t>=(lead?.08:.10)&&t<(lead?1.84:1.92),p=s.target[POLES[side]];if(on){p.x+=-INWARD[side]*24;p.y+=1.8;p.r+=-INWARD[side]*7.8*DEG;p.sx*=1.03;p.sy*=.992;}if(t>=.06&&t<1.95){const l=s.target[LOBES[side]];l.x+=INWARD[side]*5.4;l.y+=4;l.r+=-INWARD[side]*2.45*DEG;l.x-=INWARD[side]*(s.rig[POLES[side]].x*INWARD[side])*.075;}}if(t<.08){s.target.core.sy*=1.028;s.target.core.sx*=.987;}s.rig.core.kM=t<1.95?3:1;s.rig.spine.kM=t>=.06&&t<2?4.8:1;if(t>=.06&&t<2){s.target.spine.y-=2.4;s.target.spine.sy*=1.03;}}
    for(const id of IDS){const p=s.rig[id],t=s.target[id],w2=p.k*p.kM,c=2*p.z*Math.sqrt(w2);p.vx+=(w2*(t.x-p.x)-c*p.vx)*DT;p.x+=p.vx*DT;p.vy+=(w2*(t.y-p.y)-c*p.vy)*DT;p.y+=p.vy*DT;p.vr+=(w2*(t.r-p.r)-c*p.vr)*DT;p.r+=p.vr*DT;p.vsx+=(w2*(t.sx-p.sx)-c*p.vsx)*DT;p.sx+=p.vsx*DT;p.vsy+=(w2*(t.sy-p.sy)-c*p.vsy)*DT;p.sy+=p.vsy*DT;}
    s.fixedSteps++;
  }
  function tick(combatant, dt) {
    if(!combatant||!combatant.anchor)return;const s=stateFor(combatant),frameDt=Math.max(0,Math.min(dt,.1));
    if(frameDt>0)senseRoot(s,combatant.anchor,frameDt);
    s.accumulator+=frameDt;let n=0;while(s.accumulator>=DT&&n<6){fixedStep(s);s.accumulator-=DT;n++;}if(n>=6&&s.accumulator>=DT){s.droppedTime+=s.accumulator;s.accumulator=0;}
  }
  function cue(combatant, type, data) { const s=stateFor(combatant);if(type==='a1')startA1(s,data&&data.x,data&&data.y);else if(type==='a2')startA2(s);else if(type==='passive')passive(s,data&&data.angle);else if(type==='impact')impact(s,data&&data.dx||0,data&&data.dy||0,data&&data.magnitude,data&&data.side); }
  function draw(ctx, combatant) {
    if(!ready||!ctx||!combatant||!combatant.anchor)return false;const s=stateFor(combatant),body=combatant.anchor,zoom=(globalScope.__apexCameraView&&globalScope.__apexCameraView.zoom)||1,level=SCALE*zoom>.28?0:1;
    ctx.save();try{for(const id of IDS){const m=META[id],L=images[id][level],p=s.rig[id],pivot=m.pivot;ctx.save();ctx.translate(body.x,body.y);ctx.translate(p.x,p.y);ctx.scale(SCALE,SCALE);const px=pivot[0]-ORIGIN.x,py=pivot[1]-ORIGIN.y;ctx.translate(px,py);ctx.rotate(p.r);ctx.scale(p.sx,p.sy);ctx.translate(-px,-py);const dx=m.ox-ORIGIN.x,dy=m.oy-ORIGIN.y;ctx.drawImage(L.base,dx,dy,m.w,m.h);for(const channel of m.channels){const intensity=s.gold[`${id}.${channel}`].v,layers=L.channels[channel];if(intensity<.98){ctx.globalAlpha=clamp(1-intensity,0,1);ctx.drawImage(layers.dim,dx,dy,m.w,m.h);ctx.globalAlpha=1;}else if(intensity>1.02){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp((intensity-1)*.85,0,1);ctx.drawImage(layers.gold,dx,dy,m.w,m.h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}}ctx.restore();}
      ctx.globalCompositeOperation='lighter';for(const id of IDS){const m=META[id],L=images[id][level],p=s.rig[id],pivot=m.pivot;ctx.save();ctx.translate(body.x+p.x,body.y+p.y);ctx.scale(SCALE,SCALE);const px=pivot[0]-ORIGIN.x,py=pivot[1]-ORIGIN.y;ctx.translate(px,py);ctx.rotate(p.r);ctx.scale(p.sx,p.sy);ctx.translate(-px,-py);for(const channel of m.channels){const intensity=s.gold[`${id}.${channel}`].v,alpha=clamp(intensity*(.42+.25*(s.a1>=0)+.23*(s.a2>=0)),0,1);if(alpha>.01){ctx.globalAlpha=alpha;ctx.drawImage(L.channels[channel].glow,m.ox-ORIGIN.x,m.oy-ORIGIN.y,m.w,m.h);}}ctx.restore();}
    }finally{ctx.restore();}return true;
  }
  function teardown(combatant){if(combatant)states.delete(combatant);else states.clear();}
  function inspect(combatant){const s=combatant?states.get(combatant):null;return{ready,loadError:loadError&&String(loadError),stateCount:states.size,state:s&&{fixedSteps:s.fixedSteps,droppedTime:s.droppedTime,accumulator:s.accumulator,a1:s.a1,a2:s.a2,passive:s.passive,rig:s.rig,gold:s.gold}};}
  globalScope.APEX_MAGNET_GOLD={version:'1.0.0',DT,META,tick,cue,draw,teardown,inspect,get ready(){return ready;}};
  globalScope.apexMagnetGoldV1='ready';
})(typeof window!=='undefined'?window:globalThis);
