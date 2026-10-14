// CP8 owner Rocket Vua He: V7 smoke and V3 FULL-FRAME face source.
// Gold formulas below extracted without rewriting from owner 2026-10-14 HTML.
// This is visual-only: native RPG_7 projectiles, fuse, collision and AOE remain authoritative.
const ROOT='/assets/skins/rocket-vua-he/';
// Literal first-party paths are deliberate: the shipping asset audit must
// see and RETAIN every Gold texture, even though the renderer indexes by name.
export const rocketGoldAssets=Object.freeze([
  '/assets/skins/rocket-vua-he/launcher.png',
  '/assets/skins/rocket-vua-he/projectile.png',
  '/assets/skins/rocket-vua-he/fullFace.png',
  '/assets/skins/rocket-vua-he/v0.png',
  '/assets/skins/rocket-vua-he/v1.png',
  '/assets/skins/rocket-vua-he/v2.png',
  '/assets/skins/rocket-vua-he/v3.png',
  '/assets/skins/rocket-vua-he/v4.png',
  '/assets/skins/rocket-vua-he/v5.png',
  '/assets/skins/rocket-vua-he/v6.png',
  '/assets/skins/rocket-vua-he/v7.png',
  '/assets/skins/rocket-vua-he/v8.png',
  '/assets/skins/rocket-vua-he/v9.png',
  '/assets/skins/rocket-vua-he/s0.png',
  '/assets/skins/rocket-vua-he/s1.png',
  '/assets/skins/rocket-vua-he/s2.png',
  '/assets/skins/rocket-vua-he/s3.png',
  '/assets/skins/rocket-vua-he/s4.png',
  '/assets/skins/rocket-vua-he/s5.png',
  '/assets/skins/rocket-vua-he/s6.png',
  '/assets/skins/rocket-vua-he/s7.png',
  '/assets/skins/rocket-vua-he/s8.png',
  '/assets/skins/rocket-vua-he/s9.png',
]);
const GOLD={smokeLife:.68};
const BLAST=.80, SMOKE_WINDOW=1.38, W=1e8, H=1e8;
const settings=Object.freeze({density:1.3,opacity:1.3,scale:1.22,face:1.16});
const faceKeys=Object.freeze({start:.16,peakIn:.36,peakOut:.39,end:.99,opacity:.42,size:1});
const sizeKeys=Object.freeze({first:0,peak:.74,last:.74,growStart:.16,growEnd:.91,shrinkStart:.91,shrinkEnd:1.12});
const flowStrength=1,smokeDensity=1,textureDetail=1;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=p=>{p=clamp(p);return p*p*(3-2*p)};
const mix=(a,b,p)=>a+(b-a)*p;
const hash=n=>{const x=Math.sin(n*78.233+17.51)*43758.5453123;return x-Math.floor(x)};
const rotPoint=(dx,dy,a)=>({x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)});
let c=null,target={x:0,y:0},tex={};
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
// Original material is always rendered from one uncut 440x440 RGBA texture.
// Only the ENTER/EXIT states deform the original pixels. Peak draws the original image once.
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
  const subtleSize=requestedSize;
 const pad=subtleSize/2+18;
 const formation=m.phase==='GATHER'?m.warp:0;
 const departure=m.phase==='DISSOLVE'?m.warp:0;
 const x=target.x+(-9*formation+12*departure);
 const y=target.y+(-7*formation-10*departure);
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
function textures(resources){const out={};for(const path of rocketGoldAssets){const n=path.slice(ROOT.length,-4);out[n]=resources.get(path);}return out;}
export function drawRocketGoldWeapon(ctx,pose,resources){
 const im=resources.get(ROOT+'launcher.png');if(!im)return false;
 // Keep the actual complete Gold launcher, not the V4.3 placeholder aspect ratio.
 const w=pose.width||120,h=w*381/1656;
 ctx.drawImage(im,-w/2,-h/2,w,h);return true;
}
export function drawRocketGoldProjectile(ctx,pose,resources){
 if(pose.kind!=='rocket')return false;
 const im=resources.get(ROOT+'projectile.png');if(!im)return false;
 const angle=Math.atan2(pose.vy||0,pose.vx||1);
 // Gold projectile 104x24 and natural aim direction, with no orbit transform.
 ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(angle);
 ctx.drawImage(im,-52,-12,104,24);ctx.restore();
 // Physical history supplies the path; Gold smoke lifetime/shape formula stays unchanged.
 const smoke=resources.get(ROOT+'v3.png');
 const now=pose.age,history=pose.trail||[];
 for(let i=0;i<history.length;i++){
  const pos=history[i],born=pos.t;
  for(let j=0;j<2;j++){
   const seed=i*17+j*173.27;
   const age=now-born-(j*.012),life=GOLD.smokeLife*(.80+hash(seed+4)*.33);
   if(age<0||age>life)continue;
   const u=age/life,env=smooth(age/.058)*Math.pow(1-u,1.08),sway=(hash(seed+5)-.5)*24;
   const ga=angle,back=rotPoint(-43-u*(26+hash(seed+2)*22),0,ga);
   const side=rotPoint(0,(hash(seed+7)-.5)*16-18*u+sway*u+Math.sin(u*5+seed)*7*u,ga);
   const x=pos.x+back.x+side.x,y=pos.y+back.y+side.y;
   const spread=(36+hash(seed+8)*35)*(1+.9*u),w=spread,h=spread*(.69+hash(seed+9)*.49);
   const a=env*settings.opacity*(j===0?.47:.34),rot=ga+(hash(seed+19)-.5)*.6+u*.26;
   const img=resources.get(ROOT+'v'+Math.floor(hash(seed+32)*10)+'.png');
   if(img){ctx.save();ctx.globalAlpha=clamp(a);ctx.translate(x,y);ctx.rotate(rot);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();}
  }
 }
 if(now>.04&&smoke){const b=rotPoint(-53,0,angle);ctx.save();ctx.translate(pose.x+b.x,pose.y+b.y);ctx.rotate(angle);ctx.globalAlpha=clamp(.33*settings.opacity);ctx.drawImage(smoke,-18,-12,36,24);ctx.restore();}
 return true;
}
export function drawRocketGoldBlast(ctx,pose,resources){
 if(pose.kind!=='v43_blast'||pose.age<0||pose.age>SMOKE_WINDOW)return false;
 const f=resources.get(ROOT+'fullFace.png');if(!f)return false;
 // Render-safe setter: callbacks are synchronous, never run independent gameplay clocks.
 c=ctx;target={x:pose.x,y:pose.y};tex=textures(resources);
 try{drawSmokeCoreV7(pose.age);drawFaceMorph(pose.age);return true;}
 finally{c=null;tex={};}
}
