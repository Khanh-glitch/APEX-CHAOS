/* BOT WAVE only: share arithmetic and raster work, never simulation steps,
 * cells, particles, optical passes, or resolution. Gold remains the authority.
 */
(function(root){
'use strict';
const installed=new WeakMap();
function install(fluid){
 if(installed.has(fluid))return installed.get(fluid);
 const stats={pairedAdvections:0,smokeRasterReuses:0};
 const originalStep=fluid.step,originalAdvect=fluid.advect,originalDraw=fluid.draw;
 const source=String(originalStep);
 // These pairs are adjacent in this Gold revision. In particular, Gold uses
 // u0 for BOTH velocity destinations: preserve that exact authored behavior.
 // An unfamiliar solver keeps its own advection implementation.
 const paired=source.replace(/\s+/g,' ').includes('this.advect(u, this.u0, this.u0, this.v0, dt * 1.0, i0b, i1b, j0b, j1b); this.advect(v, this.u0, this.u0, this.v0, dt * 1.0, i0b, i1b, j0b, j1b);')&&
  source.replace(/\s+/g,' ').includes('this.advect(d, this.dens0, u, v, dt, i0b, i1b, j0b, j1b); this.advect(t, this.temp0, u, v, dt, i0b, i1b, j0b, j1b);')&&
  (source.match(/this\.advect\(/g)||[]).length===4;
 const cacheSmoke=fluid.n===158&&String(originalDraw).includes("ctx.filter = layer === 'fire' ? 'blur(7px)' : 'blur(6px)'");
 let stepping=false,pending=null,inFrame=false,smokeReady=false;
 function invalidate(){smokeReady=false;}
 if(paired){
  fluid.advect=function(d,d0,u,v,dt,i0,i1,j0,j1){
   if(!stepping)return originalAdvect.apply(this,arguments);
   if(pending){
    const p=pending;pending=null;
    if(d===p.d&&d0===p.d0&&u===p.u&&v===p.v&&dt===p.dt&&
     i0===p.i0&&i1===p.i1&&j0===p.j0&&j1===p.j1)return;
   }
   let other,other0;
   if(d===this.u&&d0===this.u0&&u===this.u0&&v===this.v0){other=this.v;other0=this.u0;}
   else if(d===this.dens&&d0===this.dens0&&u===this.u&&v===this.v){other=this.temp;other0=this.temp0;}
   else return originalAdvect.apply(this,arguments);
   const n=this.n,sameSource=other0===d0;
   for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const idx=j*n+i;
    let x=i-dt*u[idx],y=j-dt*v[idx];
    if(x<.5)x=.5;if(x>n-1.5)x=n-1.5;
    if(y<.5)y=.5;if(y>n-1.5)y=n-1.5;
    const ii=x|0,jj=y|0,s1=x-ii,s0=1-s1,t1=y-jj,t0=1-t1,a=jj*n+ii;
    // Keep the original double-precision operation order and Float32 stores.
    const value=s0*(t0*d0[a]+t1*d0[a+n])+s1*(t0*d0[a+1]+t1*d0[a+n+1]);
    d[idx]=value;
    other[idx]=sameSource?value:s0*(t0*other0[a]+t1*other0[a+n])+s1*(t0*other0[a+1]+t1*other0[a+n+1]);
   }
   pending={d:other,d0:other0,u,v,dt,i0,i1,j0,j1};stats.pairedAdvections++;
  };
 }
 fluid.step=function(){
  invalidate();stepping=true;pending=null;
  try{return originalStep.apply(this,arguments);}
  finally{stepping=false;pending=null;}
 };
 for(const name of ['addHeat','addSmoke','addForce','burst','vortex','clear','touch']){
  const original=fluid[name];
  if(typeof original==='function')fluid[name]=function(){invalidate();return original.apply(this,arguments);};
 }
 fluid.draw=function(ctx,layer){
  if(cacheSmoke&&inFrame&&layer==='smoke'&&smokeReady){
   // Reuse the exact smoke bytes, retaining Gold's second upload as well:
   // skipping that upload can change Chrome's source residency/filter rounding.
   // Replay the SAME commands at the second authored position in depth.
   // Actor/projectile ordering, both smoke layers and their alpha all survive.
   this.cctx.putImageData(this.img,0,0);
   ctx.save();
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.filter='blur(6px)';
   const cell=12,half=936,sz=this.n*cell,offset=-half-cell*1.5;
   ctx.drawImage(this.cvs,offset,offset,sz,sz);
   ctx.filter='none';ctx.restore();stats.smokeRasterReuses++;
   return;
  }
  smokeReady=false;
  const result=originalDraw.apply(this,arguments);
  if(inFrame&&layer==='smoke'&&this.maxI>=this.minI)smokeReady=true;
  return result;
 };
 const api=Object.freeze({
  beginFrame(){inFrame=true;smokeReady=false;},
  endFrame(){inFrame=false;smokeReady=false;},
  snapshot:()=>({...stats,pairedAdvectionEnabled:paired})
 });
 installed.set(fluid,api);return api;
}
root.APEX_WAVE_LOSSLESS_FLUID=Object.freeze({install});
root.apexBotWaveLosslessFluid='ready';
})(window);
