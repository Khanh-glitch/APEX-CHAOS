function createForgeFire(glCanvas,particleCanvas,reducedMotion){
 const state={mode:'particle-fallback',intensity:0,clock:Math.random()*20,last:0,
  particles:[],flameSpawn:0,emberSpawn:0,smokeSpawn:0,seed:Math.random()*80};
 let gl=null,program=null,buffer=null;const uniforms={};
 const vertexSource='attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';
 const fragmentSource=`
 precision highp float;
 uniform vec2 u_res;uniform float u_time;uniform float u_intensity;
 uniform float u_fill;uniform float u_hp;uniform float u_seed;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
 float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
 float fbm(vec2 p){float v=0.0;float a=0.55;mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=0.5;}return v;}
 float fall(float edge0,float edge1,float x){return 1.0-smoothstep(edge0,edge1,x);}
 vec3 fireRamp(float t){t=clamp(t,0.0,1.0);
  vec3 c=mix(vec3(0.05,0.0,0.0),vec3(0.38,0.015,0.0),smoothstep(0.0,0.24,t));
  c=mix(c,vec3(0.92,0.10,0.005),smoothstep(0.20,0.45,t));
  c=mix(c,vec3(1.0,0.38,0.015),smoothstep(0.42,0.63,t));
  c=mix(c,vec3(1.0,0.68,0.09),smoothstep(0.60,0.80,t));
  c=mix(c,vec3(1.0,0.94,0.58),smoothstep(0.82,0.97,t));
  return mix(c,vec3(1.0,1.0,0.88),smoothstep(0.96,1.0,t));}
 void main(){
  vec2 uv=gl_FragCoord.xy/max(u_res,vec2(1.0));
  float aspect=u_res.x/max(u_res.y,1.0);
  vec2 p=vec2(uv.x*aspect,uv.y);
  float rise=u_time*(0.72+u_intensity*0.62);
  vec2 warpA=vec2(fbm(p*3.1+vec2(0.0,-rise*0.72)+u_seed),
                  fbm(p*3.1+vec2(5.2,1.3-rise*0.58)-u_seed));
  vec2 warpB=vec2(fbm(p*4.2+2.3*warpA+vec2(1.7,9.2-rise)),
                  fbm(p*4.2+2.1*warpA+vec2(8.3,2.8-rise*1.18)));
  float turbulence=fbm(p*vec2(4.6,3.3)+2.5*warpB+vec2(0.0,-rise*1.72));
  float columns=fbm(vec2(p.x*2.4,u_seed-rise*0.34));
  float tongueHeight=(0.05+u_intensity*0.54)*(0.34+0.88*turbulence+0.34*columns+0.18*(warpB.y-0.5));
  tongueHeight=clamp(tongueHeight,0.012,0.68);
  float front=fall(u_fill-0.035,u_fill+0.075,uv.x)*smoothstep(-0.01,0.045,uv.x);
  float body=fall(tongueHeight-0.16,tongueHeight+0.045,uv.y);
  float vertical=clamp(1.0-uv.y/max(tongueHeight,0.04),0.0,1.0);
  float broken=smoothstep(0.16,0.58,turbulence+vertical*0.24);
  float density=body*front*broken*clamp(u_intensity*1.2,0.0,1.0);
  float root=fall(0.0,0.28,uv.y)*front;
  float heat=clamp(density*(0.20+vertical*1.02)+(turbulence-0.48)*0.40*body+root*0.26,0.0,1.12);
  vec3 color=fireRamp(heat);
  color=mix(color*vec3(1.08,0.58,0.50),color,clamp(u_hp,0.0,1.0));
  float alpha=clamp(density*(0.26+heat*0.78)+root*u_intensity*0.18,0.0,0.84);
  float coalNoise=fbm(p*19.0+u_seed+vec2(0.0,-u_time*0.16));
  float coals=fall(0.015,0.13,uv.y)*smoothstep(0.42,0.88,coalNoise)*front*(u_intensity*0.62);
  color+=vec3(1.0,0.20,0.015)*coals*1.35;alpha=max(alpha,coals*0.68);
  vec2 sparkCell=floor(vec2(p.x*74.0,p.y*40.0-u_time*14.0));
  float sparks=step(0.994,hash(sparkCell))*body*front*u_intensity;
  color+=vec3(1.0,0.72,0.24)*sparks*1.45;alpha=max(alpha,sparks*0.72);
  gl_FragColor=vec4(color*alpha*1.20,alpha);
 }`;
 const compile=(type,source)=>{
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('forge shader');}
  return shader;
 };
 try{
  gl=glCanvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})||
     glCanvas.getContext('experimental-webgl',{alpha:true,antialias:false,depth:false,stencil:false});
  if(gl){
   program=gl.createProgram();
   gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
   gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
   gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('forge link');
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'a_pos');gl.enableVertexAttribArray(position);
   gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   for(const name of ['u_res','u_time','u_intensity','u_fill','u_hp','u_seed'])uniforms[name]=gl.getUniformLocation(program,name);
   gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   state.mode='webgl-fbm-domain-warp';
  }
 }catch(_){gl=null;program=null;state.mode='particle-fallback';}
 let pctx=null;try{pctx=particleCanvas.getContext('2d');}catch(_){pctx=null;}
 const makeSprite=(stops)=>{
  try{
   const sprite=doc.createElement('canvas');sprite.width=64;sprite.height=64;
   const ctx=sprite.getContext('2d');if(!ctx)return null;
   const gradient=ctx.createRadialGradient(32,32,1,32,32,31);
   for(const [at,color] of stops)gradient.addColorStop(at,color);
   ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return sprite;
  }catch(_){return null;}
 };
 const flameSprites=[
  makeSprite([[0,'rgba(255,244,180,.95)'],[.22,'rgba(255,172,42,.78)'],[.52,'rgba(255,72,0,.42)'],[1,'rgba(120,8,0,0)']]),
  makeSprite([[0,'rgba(255,190,82,.92)'],[.3,'rgba(255,92,4,.66)'],[.62,'rgba(190,20,0,.30)'],[1,'rgba(90,4,0,0)']]),
  makeSprite([[0,'rgba(255,118,40,.88)'],[.38,'rgba(215,38,0,.52)'],[1,'rgba(80,3,0,0)']])
 ].filter(Boolean);
 const smokeSprite=makeSprite([[0,'rgba(92,88,96,.34)'],[.48,'rgba(48,45,54,.20)'],[1,'rgba(20,19,26,0)']]);
 const resize=(canvas,maxScale)=>{
  const width=canvas.clientWidth||0,height=canvas.clientHeight||0;
  if(!width||!height)return null;
  const scale=Math.min(maxScale,window.devicePixelRatio||1);
  const pixelsW=Math.max(2,Math.round(width*scale)),pixelsH=Math.max(2,Math.round(height*scale));
  if(canvas.width!==pixelsW||canvas.height!==pixelsH){canvas.width=pixelsW;canvas.height=pixelsH;}
  return{width,height,scale,pixelsW,pixelsH};
 };
 const spawn=(kind,width,height,fill,intensity)=>{
  if(state.particles.length>=72)return;
  const front=Math.max(.05,fill);
  const x=(.015+Math.random()*front*.97)*width,y=height-1-Math.random()*4;
  const base={kind,x,y,px:x,py:y,age:0,seed:Math.random()*Math.PI*2,sprite:0};
  if(kind==='flame')Object.assign(base,{vx:(Math.random()-.5)*4,vy:-(8+Math.random()*13)*(.55+intensity*.45),
   life:.36+Math.random()*.42,size:(8+Math.random()*10)*(.55+intensity*.38),sprite:Math.floor(Math.random()*3)});
  else if(kind==='ember')Object.assign(base,{vx:(Math.random()-.5)*8,vy:-(16+Math.random()*28)*(.55+intensity*.5),
   life:.42+Math.random()*.58,size:.55+Math.random()*.9});
  else Object.assign(base,{x:x+(Math.random()-.5)*8,y:height-5-Math.random()*5,vx:(Math.random()-.5)*2.5,
   vy:-(4+Math.random()*6),life:.8+Math.random()*.8,size:7+Math.random()*8});
  state.particles.push(base);
 };
 const drawParticles=(size,dt,fill,intensity)=>{
  if(!pctx||!size)return;
  pctx.setTransform(size.scale,0,0,size.scale,0,0);pctx.clearRect(0,0,size.width,size.height);
  if(!reducedMotion&&intensity>.08){
   if(!gl){state.flameSpawn+=dt*42*intensity;while(state.flameSpawn>=1){state.flameSpawn--;spawn('flame',size.width,size.height,fill,intensity);}}
   state.emberSpawn+=dt*(gl?7:12)*intensity;
   while(state.emberSpawn>=1){state.emberSpawn--;spawn('ember',size.width,size.height,fill,intensity);}
   state.smokeSpawn+=dt*1.1*intensity;
   while(state.smokeSpawn>=1){state.smokeSpawn--;spawn('smoke',size.width,size.height,fill,intensity);}
  }
  for(const particle of state.particles){
   particle.px=particle.x;particle.py=particle.y;particle.age+=dt;
   const curl=Math.sin(particle.seed+particle.age*4.6+particle.y*.085)*10;
   particle.x+=(particle.vx+curl*(particle.kind==='ember'?.32:1))*dt;
   particle.y+=particle.vy*dt*(particle.kind==='flame'?1+particle.age*.22:1);
   if(particle.kind==='ember')particle.vy-=9*dt;
  }
  state.particles=state.particles.filter(particle=>particle.age<particle.life&&particle.y>-14);
  if(smokeSprite){
   pctx.globalCompositeOperation='source-over';
   for(const particle of state.particles.filter(item=>item.kind==='smoke')){
    const t=particle.age/particle.life,size=particle.size*(.55+t*1.15);
    pctx.globalAlpha=.055*Math.sin(Math.PI*Math.min(1,t));
    pctx.drawImage(smokeSprite,particle.x-size/2,particle.y-size/2,size,size);
   }
  }
  pctx.globalCompositeOperation='lighter';
  for(const particle of state.particles){
   const t=particle.age/particle.life,lifeCurve=Math.sin(Math.PI*Math.min(1,t));
   if(particle.kind==='flame'&&flameSprites.length){
    const sprite=flameSprites[particle.sprite%flameSprites.length],size=particle.size*(.45+lifeCurve*.78);
    pctx.globalAlpha=.14+.42*lifeCurve;
    pctx.drawImage(sprite,particle.x-size/2,particle.y-size*.68,size,size*1.24);
   }else if(particle.kind==='ember'){
    pctx.globalAlpha=.18+.52*(1-t);pctx.strokeStyle='#ffb03a';pctx.lineWidth=particle.size;pctx.lineCap='round';
    pctx.beginPath();pctx.moveTo(particle.px,particle.py);pctx.lineTo(particle.x,particle.y);pctx.stroke();
    pctx.fillStyle='#fff0ad';pctx.beginPath();pctx.arc(particle.x,particle.y,particle.size*.62,0,Math.PI*2);pctx.fill();
   }
  }
  pctx.globalAlpha=1;pctx.globalCompositeOperation='source-over';
 };
 const drawGL=(size,fill,hp)=>{
  if(!gl||!program||!size)return;
  gl.viewport(0,0,size.pixelsW,size.pixelsH);gl.useProgram(program);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.u_res,size.pixelsW,size.pixelsH);
  gl.uniform1f(uniforms.u_time,state.clock);gl.uniform1f(uniforms.u_intensity,state.intensity);
  gl.uniform1f(uniforms.u_fill,fill);gl.uniform1f(uniforms.u_hp,hp);gl.uniform1f(uniforms.u_seed,state.seed);
  gl.drawArrays(gl.TRIANGLES,0,6);
 };
 return Object.freeze({
  get mode(){return state.mode;},
  render({fury=0,hp=1}={}){
   const glSize=resize(glCanvas,1.35),particleSize=resize(particleCanvas,1.6);
   if(!glSize&&!particleSize)return;
   const stamp=(window.performance?.now?.()||Date.now())/1000;
   const dt=state.last?Math.min(.05,Math.max(.001,stamp-state.last)):.033;state.last=stamp;
   const fill=clamp(fury),heat=fill<=.08?0:clamp((fill-.08)/.92);
   let target=heat<=0?0:.12+.68*Math.pow(heat,.72);
   if(fill>=.999)target=.92;
   if(reducedMotion)target=Math.min(.38,target);
   state.intensity+=(target-state.intensity)*Math.min(1,dt*3.4);
   if(heat<=0&&state.intensity<.012)state.intensity=0;
   if(!reducedMotion)state.clock+=dt*(.72+state.intensity*.55);
   drawGL(glSize,Math.max(.035,fill),clamp(hp));
   drawParticles(particleSize,reducedMotion?0:dt,Math.max(.035,fill),state.intensity);
  },
  dispose(){try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){}}
 });
}
