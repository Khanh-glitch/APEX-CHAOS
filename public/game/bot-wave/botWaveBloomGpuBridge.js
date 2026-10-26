// APEX BOT WAVE | experimental native-DPR GPU bright pass
// One Canvas2D choke point (filtering 1.3 million source pixels into the
// existing quarter-size Gold bloom buffer) is replaced by a WebGL2 fragment
// pass. Full Gold Post.end, final scene, wide bloom, grain, chroma,
// refraction, player, bot AI and HUD remain unchanged.
// Capability-gated and fail-closed: zero GPU support => exact Gold filter.
(()=>{
 'use strict';
 const state={ready:false,failed:false,frames:0,errors:0,ms:0,lastError:'',renderer:'',forced:false};
 let gpu=null,gl=null,pgm=null,tex=null,canvas=null,pos=null,sizeW=0,sizeH=0;
 const VERT=`#version 300 es
 in vec2 a_position;
 out vec2 uv;
 void main(){ uv = (a_position+1.0)*.5; gl_Position=vec4(a_position,0.,1.); }`;
 const FRAG=`#version 300 es
 precision highp float;
 in vec2 uv;
 uniform sampler2D sourceTex;
 uniform vec2 texel;
 out vec4 pixel;
 vec3 adjust(vec3 col){
   col=clamp(col*1.06,0.0,1.0);
   col=clamp((col-0.5)*2.05+0.5,0.0,1.0);
   float l=dot(col,vec3(0.2126,0.7152,0.0722));
   return clamp(mix(vec3(l),col,1.18),0.0,1.0);
 }
 void main(){
   // blur(1.1px) evaluated at Gold's existing quarter-resolution bloom.
   // 5x5 Gaussian with matched filter radius, high quality linear samples.
   vec3 accum=vec3(0.0);float total=0.0;
   for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
     float d=float(i*i+j*j);
     float weight=exp(-d/(2.0*1.1*1.1));
     accum+=adjust(texture(sourceTex,uv+vec2(float(i),float(j))*texel).rgb)*weight;
     total+=weight;
   }
   pixel=vec4(accum/total,1.0);
 }`;
 const shader=(type,src)=>{
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
  return s;
 };
 const init=()=>{
  canvas=document.createElement('canvas');
  gl=canvas.getContext('webgl2',{alpha:true,depth:false,stencil:false,
   antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL2 unavailable');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  state.renderer=String(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
  const params=new URLSearchParams(location.search);
  state.forced=params.get('gpuBloom')==='force';
  if(!state.forced && /SwiftShader|llvmpipe|Software Rasterizer|Microsoft Basic/i.test(state.renderer))
   throw Error('software WebGL2 excluded from hardware release');
  pgm=gl.createProgram();
  const vertex=shader(gl.VERTEX_SHADER,VERT),fragment=shader(gl.FRAGMENT_SHADER,FRAG);
  gl.attachShader(pgm,vertex);gl.attachShader(pgm,fragment);gl.linkProgram(pgm);
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(pgm,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pgm));
  const vbo=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW);
  pos=gl.getAttribLocation(pgm,'a_position');
  gl.useProgram(pgm);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(pgm,'sourceTex'),0);
  gpu={pixel:gl.getUniformLocation(pgm,'texel')};
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();state.failed=true;state.lastError='context lost';});
  state.ready=true;
 };
 const draw=(source,ctx,rawDraw,args)=>{
  if(state.failed)return false;
  const began=performance.now();
  try{
   if(!state.ready)init();
   const w=Math.max(2,Math.round(args[2])),h=Math.max(2,Math.round(args[3]));
   if(w!==sizeW||h!==sizeH){canvas.width=w;canvas.height=h;sizeW=w;sizeH=h;}
   gl.viewport(0,0,w,h);gl.useProgram(pgm);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.uniform2f(gpu.pixel,1/w,1/h);
   gl.drawArrays(gl.TRIANGLES,0,6);
   const savedFilter=ctx.filter;
   try{
    ctx.filter='none';
    rawDraw(canvas,...args);
   }finally{ctx.filter=savedFilter;}
   state.frames++;state.ms+=performance.now()-began;
   return true;
  }catch(e){
   state.failed=true;state.errors++;state.lastError=String(e);
   console.warn('[apex-bloom-gpu] native Gold fallback',e);
   return false;
  }
 };
 // Install after Gold engine exists, without touching Gold's engine code.
 const install=post=>{
  if(new URLSearchParams(location.search).get('gpuBloom')==='off')return false;
  if(!post?.scene||!post?.actx||post.actx.__apexGpuBloomBridge)return false;
  const actx=post.actx,raw=actx.drawImage.bind(actx);
  actx.__apexGpuBloomBridge=true;
  actx.drawImage=function(image,...args){
   const eligible=image===post.scene&&args.length===4&&
       typeof this.filter==='string'&&this.filter.includes('brightness(');
   if(eligible&&draw(image,actx,raw,args))return;
   return raw(image,...args);
  };
  return true;
 };
 window.APEX_WAVE_GPU_BLOOM={
  install,
  snapshot:()=>({...state}),
  retry:()=>{if(!state.frames){state.failed=false;state.ready=false;}}
 };
 // Probe Gold creation gently: game may be loaded without wave pilot.
 let checks=0;
 const poll=setInterval(()=>{
  if(install(window.handLab?.post) || ++checks>400)clearInterval(poll);
 },35);
})();
