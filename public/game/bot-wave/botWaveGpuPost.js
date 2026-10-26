/* BOT WAVE GPU post candidate. Keep Gold world at native DPR and preserve
   Gold refraction physics. Move quarter-res bloom + final full-res composite
   from CSS-filtered Canvas2D readbacks into WebGL2 fragment passes.
   HARDWARE ONLY by default. Fallback is the byte-exact native Gold Post.end.
   This experimental path requires visual owner acceptance before release. */
(()=>{
 'use strict';
 const vertex=`#version 300 es
 precision highp float;
 in vec2 a_pos;out vec2 v_uv;
 void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}`;
 const bright=`#version 300 es
 precision highp float;
 in vec2 v_uv;uniform sampler2D u_scene;uniform vec2 u_pixel;out vec4 color;
 vec3 grade(vec3 x){
  x=clamp(x*1.06,0.,1.);
  x=clamp((x-.5)*2.05+.5,0.,1.);
  float l=dot(x,vec3(.2126,.7152,.0722));
  return clamp(mix(vec3(l),x,1.18),0.,1.);
 }
 void main(){
  // First downsample AND identical small-radius bloom glow in one pass.
  vec3 s=vec3(0.);float total=0.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
   float weight=exp(-float(x*x+y*y)/2.42);
   s+=grade(texture(u_scene,v_uv+vec2(float(x),float(y))*u_pixel).rgb)*weight;
   total+=weight;
  }
  color=vec4(s/total,1.);
 }`;
 const blur=`#version 300 es
 precision highp float;
 in vec2 v_uv;uniform sampler2D u_source;uniform vec2 u_pixel;
 uniform vec2 u_axis;out vec4 color;
 void main(){
  vec3 sum=vec3(0.);float total=0.;
  for(int i=-9;i<=9;i++){
   float f=float(i),weight=exp(-f*f/23.12);
   sum+=texture(u_source,v_uv+u_pixel*u_axis*f).rgb*weight;
   total+=weight;
  }
  color=vec4(sum/total,1.);
 }`;
 const compose=`#version 300 es
 precision highp float;
 in vec2 v_uv;out vec4 color;
 uniform sampler2D u_scene;uniform sampler2D u_tight;uniform sampler2D u_wide;
 uniform vec2 u_size;uniform vec2 u_focus;uniform float u_bloom;
 uniform float u_vignette;uniform float u_grain;uniform float u_clock;
 float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){
  vec3 rgb=texture(u_scene,v_uv).rgb;
  rgb+=u_bloom*(.42*texture(u_tight,v_uv).rgb+.34*texture(u_wide,v_uv).rgb);
  // Gold radial vignette, normalized to native framebuffer pixel space.
  float d=distance(v_uv*u_size,u_focus);
  float inner=min(u_size.x,u_size.y)*.2;
  float outer=length(u_size)*.62;
  float t=clamp((d-inner)/max(1.,outer-inner),0.,1.);
  float shade=mix(.24*u_vignette,.82*u_vignette,smoothstep(.62,1.,t));
  shade*=smoothstep(0.,.62,t);
  rgb=mix(rgb,vec3(.012,.007,.025),clamp(shade,0.,1.));
  float n=noise(gl_FragCoord.xy+vec2(u_clock*13.,u_clock*23.))-.5;
  rgb=clamp(rgb+n*u_grain*.23,0.,1.);
  color=vec4(rgb,1.);
 }`;
 function program(gl,src){
  const make=(kind,text)=>{
   const shader=gl.createShader(kind);gl.shaderSource(shader,text);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
   return shader;
  };
  const p=gl.createProgram(),vs=make(gl.VERTEX_SHADER,vertex),fs=make(gl.FRAGMENT_SHADER,src);
  gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  return p;
 }
 function tex(gl){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return t;
 }
 function backend(){
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,
    preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl)return null;
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)||'');
  const forced=new URLSearchParams(location.search).get('gpuPost')==='force';
  if(!forced&&/SwiftShader|llvmpipe|software|Microsoft Basic/i.test(renderer))return null;
  try{
   const programs=[program(gl,bright),program(gl,blur),program(gl,compose)];
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW);
   const textures=[tex(gl),tex(gl),tex(gl),tex(gl)],fbos=[];
   for(let i=1;i<=3;i++){
    const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textures[i],0);fbos.push(fb);
   }
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   const uniforms=programs.map(p=>Object.fromEntries(
    ['u_scene','u_source','u_tight','u_wide','u_pixel','u_axis','u_size','u_focus','u_bloom','u_vignette','u_grain','u_clock']
    .map(name=>[name,gl.getUniformLocation(p,name)])));
   const stat={renderer,frames:0,gpuFailures:0,fullPixels:0,bloomPixels:0,lastMs:0};
   const bind=(p,index)=>{
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const loc=gl.getAttribLocation(p,'a_pos');
    gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    return uniforms[index];
   };
   const textureAt=(unit,t)=>{
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
   };
   const render=(post,dst,w,h,dpr,o={})=>{
    const stamp=performance.now();
    const pw=Math.max(2,Math.round(w*dpr)),ph=Math.max(2,Math.round(h*dpr));
    const bw=Math.max(2,Math.round(pw/4)),bh=Math.max(2,Math.round(ph/4));
    if(canvas.width!==pw||canvas.height!==ph){
      canvas.width=pw;canvas.height=ph;
      for(let i=1;i<=3;i++){
       gl.bindTexture(gl.TEXTURE_2D,textures[i]);
       gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,bw,bh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      }
    }
    // Refraction passes always remain original Gold optics.
    post.distort(w,h,dpr,o);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    textureAt(0,textures[0]);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,post.scene);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[0]);gl.viewport(0,0,bw,bh);
    const u=bind(programs[0],0);
    textureAt(0,textures[0]);gl.uniform1i(u.u_scene,0);
    gl.uniform2f(u.u_pixel,1/pw,1/ph);
    gl.drawArrays(gl.TRIANGLES,0,6);
    const blurPass=(dest,source,axisX,axisY)=>{
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[dest-1]);gl.viewport(0,0,bw,bh);
      const b=bind(programs[1],1);
      textureAt(0,textures[source]);gl.uniform1i(b.u_source,0);
      gl.uniform2f(b.u_pixel,1/bw,1/bh);gl.uniform2f(b.u_axis,axisX,axisY);
      gl.drawArrays(gl.TRIANGLES,0,6);
    };
    blurPass(2,1,1,0);blurPass(3,2,0,1);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);
    const c=bind(programs[2],2);
    textureAt(0,textures[0]);textureAt(1,textures[1]);textureAt(2,textures[3]);
    gl.uniform1i(c.u_scene,0);gl.uniform1i(c.u_tight,1);gl.uniform1i(c.u_wide,2);
    gl.uniform2f(c.u_size,pw,ph);
    gl.uniform2f(c.u_focus,(Number(o.fx)||w/2)*dpr,(ph-(Number(o.fy)||h/2)*dpr));
    gl.uniform1f(c.u_bloom,Number(o.bloom??1));
    gl.uniform1f(c.u_vignette,Number(o.vignette??.45));
    gl.uniform1f(c.u_grain,Number(o.grain??0));
    gl.uniform1f(c.u_clock,Number(o.time||0));
    gl.drawArrays(gl.TRIANGLES,0,6);
    dst.setTransform(1,0,0,1,0,0);
    dst.globalAlpha=1;dst.globalCompositeOperation='source-over';
    dst.drawImage(canvas,0,0,pw,ph);
    stat.frames++;stat.lastMs=performance.now()-stamp;stat.fullPixels=pw*ph;stat.bloomPixels=bw*bh;
    return true;
   };
   return{render,stat};
  }catch(err){console.warn('[gpu-post] compile',err);return null;}
 }
 let instance=null,unavailable=false;
 window.APEX_WAVE_GPU_POST={
  render(post,...args){
   if(unavailable)return false;
   if(!instance){instance=backend();if(!instance){unavailable=true;return false;}}
   try{return instance.render(post,...args);}
   catch(err){instance.stat.gpuFailures++;console.warn('[gpu-post] hardware failure; restoring Gold 2D',err);unavailable=true;return false;}
  },
  snapshot(){return instance?{...instance.stat}:{enabled:false,unavailable};}
 };
})();
