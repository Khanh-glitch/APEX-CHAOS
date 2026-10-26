// Gold BOT WAVE CPU bloom candidate: same quarter-resolution Gold
// bright-pass, contrast, saturation and Gaussian blur, no sprite/VFX removal.
// Replaces the costly Canvas2D .filter draw with a single unfiltered
// quarter-res draw + premultiplied-color separable convolution.
// Never changes the original owner Gold Post class or final compositor.
// Automatically reverts to Gold native if an unsupported surface or a
// slower CPU is detected. Proof must be measured on real Chrome.
(()=>{
 'use strict';
 const state={installed:false,frames:0,failed:false,fallbacks:0,
   elapsed:0,steadyFrames:0,steadyMs:0,error:'',forced:false};
 const qs=new URLSearchParams(location.search);
 state.forced=qs.get('cpuBloom')==='force';
 const weights=[.36267,.23910,.07158,.00877];
 let tmp=null,tw=0,th=0;
 const clip=v=>v<0?0:v>255?255:v;
 function filter(ctx,originalDraw,scene,args){
  const t=performance.now();
  const w=Math.round(args[2]),h=Math.round(args[3]);
  if(w<2||h<2||w*h>2000000)throw Error('unsupported bloom buffer');
  const saved=ctx.filter;
  let data;
  try{
   ctx.filter='none';
   originalDraw(scene,...args);
   data=ctx.getImageData(0,0,w,h);
  }finally{ctx.filter=saved;}
  if(w!==tw||h!==th||!tmp){
   tmp=new Float32Array(w*h*3);tw=w;th=h;
  }
  const src=data.data;
  // Gold's original CSS pipeline: brightness(1.06), contrast(2.05),
  // saturate(1.18), blur(1.1px), in the existing Gold bloom texture.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const o=(y*w+x)*4;
   let r=clip((src[o]*1.06-127.5)*2.05+127.5),
       g=clip((src[o+1]*1.06-127.5)*2.05+127.5),
       b=clip((src[o+2]*1.06-127.5)*2.05+127.5);
   const l=r*.2126+g*.7152+b*.0722;
   r=clip(l+(r-l)*1.18);g=clip(l+(g-l)*1.18);b=clip(l+(b-l)*1.18);
   src[o]=r;src[o+1]=g;src[o+2]=b;
  }
  // Gaussian horizontal 7-tap, preserving transparent out-of-bounds.
  const stride=w*4;
  for(let y=0;y<h;y++){
   const row=y*w;
   for(let x=0;x<w;x++){
    const o=(row+x)*4,p=(row+x)*3;
    for(let c=0;c<3;c++){
     let sum=src[o+c]*weights[0];
     for(let k=1;k<=3;k++){
      const t=weights[k];
      if(x-k>=0)sum+=src[o-k*4+c]*t;
      if(x+k<w)sum+=src[o+k*4+c]*t;
     }
     tmp[p+c]=sum;
    }
   }
  }
  // Gaussian vertical 7-tap into Gold's original ImageData.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=(y*w+x)*3,o=(y*w+x)*4;
   for(let c=0;c<3;c++){
    let sum=tmp[p+c]*weights[0];
    for(let k=1;k<=3;k++){
     const t=weights[k],off=k*w*3;
     if(y-k>=0)sum+=tmp[p-off+c]*t;
     if(y+k<h)sum+=tmp[p+off+c]*t;
    }
    src[o+c]=sum;
   }
  }
  const prior=ctx.filter;
  try{ctx.filter='none';ctx.putImageData(data,0,0);}
  finally{ctx.filter=prior;}
  state.frames++;
  const cost=performance.now()-t;state.elapsed+=cost;
  if(state.frames>4){state.steadyFrames++;state.steadyMs+=cost;}
  if(!state.forced&&state.steadyFrames>=18&&state.steadyMs/state.steadyFrames>32){
   state.failed=true;state.error='CPU Gaussian slower than threshold: restore Gold';
  }
 }
 function install(post){
  if(qs.get('cpuBloom')==='off')return false;
  if(!post?.scene||!post?.actx||post.actx.__apexBloomCPU)return false;
  const c=post.actx,raw=c.drawImage.bind(c);
  c.__apexBloomCPU=true;state.installed=true;
  c.drawImage=function(source,...args){
   const target=source===post.scene && args.length===4 &&
     typeof this.filter==='string'&&this.filter.includes('brightness(');
   if(!target || state.failed)return raw(source,...args);
   try{return filter(c,raw,source,args);}
   catch(e){
    state.failed=true;state.fallbacks++;state.error=String(e);
    console.warn('[apex-cpu-bloom] Gold fallback',e);
    return raw(source,...args);
   }
  };
  return true;
 }
 window.APEX_WAVE_CPU_BLOOM={install,snapshot:()=>({...state})};
 let count=0;
 const poll=setInterval(()=>{if(install(window.handLab?.post)||++count>3000)clearInterval(poll)},40);
})();
