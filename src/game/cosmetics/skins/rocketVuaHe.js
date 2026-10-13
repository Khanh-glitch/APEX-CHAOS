// CP8 Rocket Vua Hề — owner GOLD active V7 smoke and uncut full-face texture.
// Source authority SHA256: 03719b0a55a0c5cdcbd49d89647fb858e7c5a125bcdfeaa9447f2911818d3a0e
// Only the presentation interface is adapted to real engine positions and aim.
// The particle, smoke and face keyframe functions below are copied from owner Gold.
import { cosmetics } from '../cosmeticAuthority.js';
const ROOT='/assets/skins/rocket-vua-he/';
const names=['launcher','projectile',...Array.from({length:10},(_,i)=>'v'+i),...Array.from({length:10},(_,i)=>'s'+i),'face-full'];
const assets=Object.freeze(names.map(name=>ROOT+name+'.png'));
const tex={};
let c,target={x:0,y:0};
const W=1200,H=900,SMOKE_WINDOW=1.38;
const settings=Object.freeze({density:1.3,opacity:1.3,scale:1.22,face:1.16});
const faceKeys=Object.freeze({start:.16,peakIn:.36,peakOut:.39,end:.99,opacity:.42,size:1,preview:3.8});
const sizeKeys=Object.freeze({first:0,peak:.74,last:.74,growStart:.16,growEnd:.91,shrinkStart:.91,shrinkEnd:1.12});
const flowStrength=1,smokeDensity=1,textureDetail=1;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=p=>{p=clamp(p);return p*p*(3-2*p)},mix=(a,b,p)=>a+(b-a)*p;
const hash=n=>{const x=Math.sin(n*78.233+17.51)*43758.5453123;return x-Math.floor(x)};
const rotPoint=(dx,dy,a)=>({x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)});
function drawTex(img,x,y,w,h,alpha=1,angle=0,blend='source-over'){
 if(!img||alpha<=0)return;
 c.save();c.globalAlpha=clamp(alpha);c.globalCompositeOperation=blend;c.translate(x,y);if(angle)c.rotate(angle);c.drawImage(img,-w/2,-h/2,w,h);c.restore();
}
const V7_PARTICLES=Array.from({length:188},(_,i)=>{
 const seed=5.7+i*19.817;
 const wave=i<32?0:i<139?1:2;
 const angle=i*2.39996323+(hash(seed+1)-.5)*.58;
 const birth=wave===0?hash(seed+2)*.052:wave===1?.034+hash(seed+2)*.31:.23+hash(seed+2)*.32;
 const life=wave===0?.38+hash(seed+3)*.30:wave===1?.65+hash(seed+3)*.33:.72+hash(seed+3)*.38;
 const speed=wave===0?235+hash(seed+4)*140:wave===1?155+hash(seed+4)*110:82+hash(seed+4)*85;
 const drag=wave===0?3.7+hash(seed+5)*1.8:wave===1?2.7+hash(seed+5)*1.6:1.9+hash(seed+5)*1.4;
 const size=wave===0?83+hash(seed+6)*70:wave===1?82+hash(seed+6)*57:66+hash(seed+6)*45;
 return {seed,wave,angle,birth,life,speed,drag,size,texId:Math.floor(hash(seed+7)*10),
   squish:.74+hash(seed+8)*.36,spin:(hash(seed+9)-.5)*.48,lift:14+hash(seed+10)*35,
   phase:hash(seed+11)*6.28318530718,shift:(hash(seed+12)-.5)*12};
});
function v7Particle(p,age){
 const dt=age-p.birth;
 const lifespan=Math.min(p.life,SMOKE_WINDOW-p.birth-.003);
 if(dt<0||dt>=lifespan)return null;
 const u=clamp(dt/lifespan);
 const dist=p.speed*(-Math.expm1(-p.drag*dt))/p.drag;
 const vort=flowStrength;
 const dir=p.angle + Math.sin(dt*2.15+p.phase)*.105*vort + p.spin*dt*.45;
 const x=target.x+Math.cos(dir)*dist + p.shift*dt + Math.sin(dt*3.6+p.phase)*7*vort*u;
 const y=target.y+Math.sin(dir)*dist*.78 - p.lift*dt + Math.cos(dt*3+p.phase)*8*vort*u;
 const growth=smooth(clamp(dt/.24));
 const sz=p.size*settings.scale*(.41+.65*growth+.25*u);
 const born=smooth(clamp(dt/(p.wave===0?.036:.082)));
 const decayStart=p.wave===0?.42:(p.wave===1?.57:.63);
 const diss=1-smooth(clamp((u-decayStart)/(1-decayStart)));
 const alpha=born*diss*(p.wave===0?.37:p.wave===1?.25:.18)*settings.opacity*smokeDensity;
 return {dt,u,x,y,w:sz,h:sz*p.squish,alpha,rot:dir*.18+p.spin*dt*.6,tex:p.texId,seed:p.seed,wave:p.wave};
}
function drawV7Warp(img,v,amount=1){
 const alpha=v.alpha*amount;if(alpha<=.001)return;
 const parts=9,slice=256/parts;
 c.save();c.translate(v.x,v.y);c.rotate(v.rot);c.globalAlpha=clamp(alpha);
 for(let k=0;k<parts;k++){
  const yn=(k+.5)/parts,srcY=k*slice;
  const phase=v.dt*2.65+v.seed*.17;
  const dx=(Math.sin(yn*5.6+phase)+.48*Math.sin(yn*11.1-phase*.57))*(1+v.u*6.8)*flowStrength;
  const dw=v.w*(1+.019*Math.sin(yn*8.5+phase));
  // source crop overlaps to avoid strip gaps; all images remain texture assets
  c.drawImage(img,0,srcY,256,slice+1.0,-dw/2+dx,-v.h/2+k*v.h/parts,dw,v.h/parts+1.0);
 }
 c.restore();
}
function drawSmokeCoreV7(age){
 if(age<0||age>SMOKE_WINDOW)return;
 // Keep the original sharp initial impulse. This is not the late smoke mass.
 const impact=smooth(age/.012)*Math.pow(Math.max(0,1-age/.14),1.22);
 if(impact>.001){
  drawTex(tex.v4,target.x,target.y,(66+age*270)*settings.scale,(57+age*235)*settings.scale,.53*impact*settings.opacity,age*.11);
  drawTex(tex.v9,target.x+3,target.y-4,(57+age*245)*settings.scale,(48+age*200)*settings.scale,.39*impact*settings.opacity,-age*.14);
 }
 // Fog/volume first: soft sprites overlap into a shared smoke field.
 for(const wave of [2,1,0]){
  for(let i=V7_PARTICLES.length-1;i>=0;i--){
   const p=V7_PARTICLES[i];if(p.wave!==wave)continue;
   const v=v7Particle(p,age);if(!v||v.alpha<.0006)continue;
   drawTex(tex['s'+v.tex],v.x,v.y,v.w*1.20,v.h*1.24,v.alpha*(wave===0?.50:.55),v.rot);
  }
 }
 // Fine V3 ink/colour details: warped, smaller, lower alpha, short-lived.
 // The original large illustrations are never placed as independent full-size puffs.
 for(let i=0;i<V7_PARTICLES.length;i++){
  if(i%2!==0)continue;
  const p=V7_PARTICLES[i],v=v7Particle(p,age);
  if(!v||v.alpha<.002)continue;
  const reveal=smooth(clamp((v.dt-.035)/.09));
  const melt=1-smooth(clamp((v.u-.69)/.29));
  if(reveal*melt<.001)continue;
  v.w*=.91;v.h*=.91;
  drawV7Warp(tex['v'+v.tex],v, .61*textureDetail*reveal*melt);
 }
}
function faceEnvelope(age){
 const k=faceKeys;
 if(age<k.start || age>=k.end)return {alpha:0,warp:0,phase:'OFF'};
 if(age<k.peakIn){
  const u=smooth((age-k.start)/Math.max(.01,k.peakIn-k.start));
  return {alpha:u,warp:1-u,phase:'GATHER'};
 }
 if(age<=k.peakOut)return {alpha:1,warp:0,phase:'PEAK'};
 const u=smooth((age-k.peakOut)/Math.max(.01,k.end-k.peakOut));
 return {alpha:1-u,warp:u,phase:'DISSOLVE'};
}
function sizeAt(age){
 const k=sizeKeys;
 if(age<=k.growStart)return k.first;
 if(age<k.growEnd){const u=smooth((age-k.growStart)/Math.max(.01,k.growEnd-k.growStart));return mix(k.first,k.peak,u)}
 if(age<=k.shrinkStart)return k.peak;
 if(age<k.shrinkEnd){const u=smooth((age-k.shrinkStart)/Math.max(.01,k.shrinkEnd-k.shrinkStart));return mix(k.peak,k.last,u)}
 return k.last;
}
function drawFaceMorph(age){
 const m=faceEnvelope(age);
 if(m.alpha<.0001)return;
 const img=tex.fullFace;
 const alpha=clamp(m.alpha*faceKeys.opacity,0,1);
 // Independent size keyframes; one COMPLETE texture in every frame, with zero source slicing.
 // Safety fit to the 1200 x 900 viewport so very large user combinations do not crop artwork.
 const requestedSize=440*.91*settings.scale*faceKeys.size*sizeAt(age);
 if(requestedSize<=.001)return; // Avoid drawing a zero-size texture at first keyframe.
  const subtleSize=Math.min(requestedSize,Math.min(W,H)-36);
 const pad=subtleSize/2+18;
 const formation=m.phase==='GATHER'?m.warp:0;
 const departure=m.phase==='DISSOLVE'?m.warp:0;
 const x=target.x+(-9*formation+12*departure); // game: actual impact center, do not shift off collision
 const y=target.y+(-7*formation-10*departure); // game: actual impact center
 const rotation=(-.012*formation+.012*departure)*flowStrength;
 c.save();
 c.globalCompositeOperation='source-over';
 c.globalAlpha=alpha;
 c.translate(x,y);
 c.rotate(rotation);
 // One drawImage with no crop parameters. Full 440x440 source always visible.
 c.drawImage(img,-subtleSize/2,-subtleSize/2,subtleSize,subtleSize);
 c.restore();
}
const histories=new Map();
let cleanupTick=0;
function resourceReady(resources){
  for(const name of names){const im=resources.get(ROOT+name+'.png');if(!im||!im.complete||!im.naturalWidth)return false;tex[name==='face-full'?'fullFace':name]=im;}
  return true;
}
function shotHistory(pose){
 const id=pose.visualId;
 if(!Number.isInteger(id)||id<=0)return null;
 let h=histories.get(id);
 if(!h||pose.age<h.lastAge-.02)h={points:[],lastAge:-1,seen:0};
 h.lastAge=pose.age;h.seen=++cleanupTick;
 const a=Math.atan2(pose.vy||0,pose.vx||1);
 if(!h.points.length||pose.age-h.points[h.points.length-1].t>.008)
   h.points.push({x:pose.x,y:pose.y,t:pose.age,a});
 if(h.points.length>180)h.points.shift();
 histories.set(id,h);
 if(cleanupTick%250===0)for(const [k,v] of histories)if(cleanupTick-v.seen>500)histories.delete(k);
 return h;
}
function sample(h,t){
 if(!h?.points.length)return null;
 const q=h.points;
 if(t<q[0].t-.015||t>q[q.length-1].t+.035)return null;
 for(let i=q.length-1;i>0;i--){
   const r=q[i],l=q[i-1];
   if(t>=l.t){const f=clamp((t-l.t)/Math.max(.00001,r.t-l.t));
     return {x:mix(l.x,r.x,f),y:mix(l.y,r.y,f),a:r.a};}
 }
 return q[0];
}
function flightSmoke(h,now){
 // Gold trail: source textures, density, born period, age/life and local offsets
 // unchanged; only original analytic flightPos replaced by sampled real trajectory.
 if(!h)return;
 let period=.030/settings.density;period=Math.min(.085,Math.max(.013,period));
 const count=Math.min(140,Math.ceil(now/period)+1);
 for(let i=0;i<count;i++){
  const born=i*period;if(born>now)break;
  const pos=sample(h,born);if(!pos)continue;
  for(let j=0;j<2;j++){
   const seed=i*17+j*173.27;
   const age=now-born-(j*.012),life=.68*(.80+hash(seed+4)*.33);
   if(age<0||age>life)continue;
   const u=age/life,env=smooth(age/.058)*Math.pow(1-u,1.08),sway=(hash(seed+5)-.5)*24;
   const back=rotPoint(-43-u*(26+hash(seed+2)*22),0,pos.a);
   const side=rotPoint(0,(hash(seed+7)-.5)*16-18*u+sway*u+Math.sin(u*5+seed)*7*u,pos.a);
   const x=pos.x+back.x+side.x,y=pos.y+back.y+side.y;
   const spread=(36+hash(seed+8)*35)*(1+.9*u),w=spread,ht=spread*(.69+hash(seed+9)*.49);
   const alpha=env*settings.opacity*(j===0?.47:.34),angle=pos.a+(hash(seed+19)-.5)*.6+u*.26;
   drawTex(tex['v'+(Math.floor(hash(seed+32)*10))],x,y,w,ht,alpha,angle,'source-over');
  }
 }
}
function drawWeapon(ctx,pose,resources){
 if(pose.kind!=='RPG_7'||!resources.get(ROOT+'launcher.png'))return false;
 const img=resources.get(ROOT+'launcher.png');
 // Exactly one native Gold launcher image, inside the engine-owned pose/rotation.
 const w=pose.width||0,h=pose.height||0;
 if(w<=0||h<=0)return false;
 ctx.drawImage(img,-w/2,-h/2,w,h);
 return true;
}
function drawProjectile(ctx,pose,resources){
 if(pose.kind!=='rocket'||!resourceReady(resources))return false;
 const scale=98/104; // Gold 104×24 presentation adapted to 98px game rocket.
 const h=shotHistory(pose);
 c=ctx;
 c.save();c.scale(scale,scale);
 // Unscale physical position once; Gold numeric trail offsets remain proportional.
 const x=pose.x/scale,y=pose.y/scale;
 if(h){
   const local={points:h.points.map(p=>({x:p.x/scale,y:p.y/scale,t:p.t,a:p.a}))};
   flightSmoke(local,pose.age);
 }
 const angle=Math.atan2(pose.vy||0,pose.vx||1);
 drawTex(tex.projectile,x,y,104,24,1,angle);
 if(pose.age>.04){
   const back=rotPoint(-53,0,angle);
   drawTex(tex.v3,x+back.x,y+back.y,36,24,.33*settings.opacity,angle);
 }
 c.restore();
 return true;
}
function drawBlast(ctx,pose,resources){
 if(pose.kind!=='v43_blast'||!resourceReady(resources))return false;
 // V43 passes normalized remaining-life; source Gold uses seconds since contact.
 const age=clamp((1-pose.life)*.85,0,.85);
 const scale=(pose.scale||1)*.62; // Blast visual size adapts to game RPG radius.
 c=ctx; target={x:0,y:0};
 c.save();c.translate(pose.x,pose.y);c.scale(scale,scale);
 drawSmokeCoreV7(age);drawFaceMorph(age);
 c.restore();return true;
}
cosmetics.register({
 kind:'weapon',baseId:'RPG_7',id:'vua-he',
 label:'VUA HỀ · THE LAST LAUGH',
 detail:'Owner Gold · V7 smoke, uncut face, original launcher/projectile art',
 assets,preview:ROOT+'launcher.png',
 suppressBaseBlast:true,
 render:{weapon:drawWeapon,projectile:drawProjectile,blast:drawBlast}
});
export const ROCKET_VUA_HE_GOLD_ASSET_PATHS=assets;
