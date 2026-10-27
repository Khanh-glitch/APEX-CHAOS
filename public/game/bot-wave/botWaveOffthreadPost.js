// Gold BOT WAVE off-thread compositor experiment. Uses the actual original
// Gold Post source in OffscreenCanvas; all bloom, chroma, shocks, heat,
// grain, resolution and vignette remain. No HUD or physics changes.
(()=>{
 const mode=new URLSearchParams(location.search).get('postWorker');
 const state={mode,ready:false,frames:0,display:0,fallback:0,skipped:0,
   workerTotalMs:0,workerAvgMs:0,transferMs:0,zeroCopyFrames:0,snapshotMs:0,swappedScene:false,failed:false,error:''};
 if(mode==='off')return void(window.APEX_WAVE_POST_WORKER={snapshot:()=>({...state})});
 let worker=null,last=null,pending=false,seq=0,disabled=false,sourcePost=null;
 const probes=new Map();
 function workerScript(){
  let post=null,out=null,ctx=null;
  self.onmessage=e=>{
   const q=e.data;
   try{
    if(q.type==='ping'){post=new Post();self.postMessage({type:'ready'});return;}
    if(q.type!=='frame'&&q.type!=='probe')return;
    const {bitmap,w,h,dpr,o}=q,pw=Math.max(2,Math.round(w*dpr)),ph=Math.max(2,Math.round(h*dpr));
    if(post.scene.width!==pw||post.scene.height!==ph){
     post.scene.width=pw;post.scene.height=ph;
    }
    post.sctx.setTransform(1,0,0,1,0,0);
    post.sctx.clearRect(0,0,pw,ph);
    post.sctx.drawImage(bitmap,0,0,pw,ph);
    bitmap.close();
    if(!out||out.width!==pw||out.height!==ph){
     out=new OffscreenCanvas(pw,ph);ctx=out.getContext('2d',{alpha:false});
    }
    const t=performance.now();
    post.end(ctx,w,h,dpr,o);
    const ms=performance.now()-t;
    const img=out.transferToImageBitmap();
    self.postMessage({type:q.type,id:q.id,img,ms},[img]);
   }catch(err){self.postMessage({type:'error',msg:String(err?.stack||err)})}
  };
 }
 function failure(err){
  disabled=true;state.ready=false;state.failed=true;state.error=String(err);
  worker?.terminate();worker=null;
  if(last)last.close();last=null;
 }
 const grainSrc=`function mk(){return new OffscreenCanvas(2,2);}
 const textures_1={grainTex:()=>{
  const c=new OffscreenCanvas(128,128),ctx=c.getContext('2d'),
        im=ctx.createImageData(128,128);
  let seed=4242;
  for(let i=0;i<16384;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const v=110+seed/4294967296*90,k=i*4;
   im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=255;
  }
  ctx.putImageData(im,0,0);return c;
 }};`;
 function start(post){
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return false;
  if(mode!=='force'&&navigator.hardwareConcurrency&&navigator.hardwareConcurrency<4)return false;
  try{
   const ctor=post.constructor.toString();
   if(!ctor.includes('distort(')||!ctor.includes('this.scene'))throw Error('Gold Post source unavailable');
   const src=grainSrc+'\nconst Post='+ctor+';\n('+workerScript.toString()+')();';
   const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
   worker=new Worker(url);URL.revokeObjectURL(url);
   worker.onmessage=e=>{
    const q=e.data;
    if(q.type==='error'){failure(q.msg);return;}
    if(q.type==='ready'){state.ready=true;return;}
    if(q.type==='probe'){
     const done=probes.get(q.id);probes.delete(q.id);
     if(done)done(q.img);else q.img.close();
     return;
    }
    if(q.type==='frame'){
     pending=false;state.frames++;state.workerTotalMs+=q.ms;
     state.workerAvgMs=state.workerTotalMs/state.frames;
     if(last)last.close();last=q.img;
     if(!state.swappedScene&&mode!=='bitmap'&&sourcePost){
      try{
       const off=new OffscreenCanvas(sourcePost.scene.width,sourcePost.scene.height);
       const ctx=off.getContext('2d',{alpha:true});
       if(ctx && typeof off.transferToImageBitmap==='function'){
        ctx.drawImage(sourcePost.scene,0,0);
        sourcePost.scene=off;sourcePost.sctx=ctx;
        state.swappedScene=true;
       }
      }catch(err){state.error='Zero-copy not available: '+String(err);}
     }
     if(mode!=='force'&&state.frames>=16&&state.workerAvgMs>48)
      failure('Slow Gold worker post: reverting to original renderer');
    }
   };
   worker.onerror=e=>failure(e.message);
   worker.postMessage({type:'ping'});
   return true;
  }catch(err){failure(err);return false;}
 }
 function install(post){
  if(!post||post.__apexOffthread||!start(post))return false;
  const native=post.end.bind(post);
  sourcePost=post;
  post.__apexOffthread=true;
  post.end=function(dst,w,h,dpr,o){
   if(disabled||!state.ready)return native(dst,w,h,dpr,o);
   // Snapshot the pristine Gold world before any post pass mutates it.
   if(!pending){
    pending=true;const t=performance.now();
    if(state.swappedScene&&typeof post.scene.transferToImageBitmap==='function'){
     try{
      const img=post.scene.transferToImageBitmap();
      state.snapshotMs+=performance.now()-t;state.zeroCopyFrames++;
      worker.postMessage({type:'frame',bitmap:img,w,h,dpr,o},[img]);
     }catch(err){failure('Zero-copy transfer: '+String(err));return native(dst,w,h,dpr,o);}
    }else{
     createImageBitmap(post.scene).then(img=>{
      if(disabled){img.close();return;}
      state.transferMs+=performance.now()-t;
      worker.postMessage({type:'frame',bitmap:img,w,h,dpr,o},[img]);
     }).catch(failure);
    }
   }else state.skipped++;
   const pw=Math.max(2,Math.round(w*dpr)),ph=Math.max(2,Math.round(h*dpr));
   if(last&&last.width===pw&&last.height===ph){
    dst.setTransform(1,0,0,1,0,0);
    dst.globalCompositeOperation='source-over';dst.globalAlpha=1;
    dst.drawImage(last,0,0,pw,ph);state.display++;
   }else{
    // One-time full Gold frame during worker startup.
    state.fallback++;
    return native(dst,w,h,dpr,o);
   }
  };
  return true;
 }
 async function probe(source,w,h,dpr,o){
  if(!state.ready||disabled)throw Error('Gold worker not ready: '+state.error);
  const id=++seq,bitmap=await createImageBitmap(source);
  return await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{probes.delete(id);reject(Error('Gold worker parity timeout'));},12000);
   probes.set(id,img=>{clearTimeout(timeout);resolve(img);});
   worker.postMessage({type:'probe',id,bitmap,w,h,dpr,o},[bitmap]);
  });
 }
 window.APEX_WAVE_POST_WORKER={install,probe,snapshot:()=>({...state})};
 let tries=0;
 const timer=setInterval(()=>{if(install(window.handLab?.post)||++tries>=500)clearInterval(timer)},40);
})();
