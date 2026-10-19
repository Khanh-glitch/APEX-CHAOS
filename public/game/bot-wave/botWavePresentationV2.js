/* BOT WAVE R2 — standalone cinematic interface. We MOVE live Gold
 * controls and meters without cloning/removing their IDs or event handlers.
 * The owner Gold character/glove/VFX/audio engine is not touched.
 */
(function(window){
'use strict';
const doc=window.document;
if(window.APEX_BOT_WAVE_INTERFACE_V2)return;
const VERSION='owner-release-r17-ironworks-refined';
// Existing BOXE baseline was x1.5; owner requests another +30% -> x1.95.
 // Arsenal's compressor/voice-density mix follows this shared mode policy.
 const AUDIO_MIX=Object.freeze({boxe:1.95,weapons:.14,gunFloor:.12});
function installWaveAudioMix(){
 window.APEX_BOT_WAVE_AUDIO_MIX=AUDIO_MIX;
 // Testable game-only policy; the actual per-shot gain is recorded by native AV.
 window.APEX_BOT_WAVE_AUDIO_POLICY=Object.freeze({mode:'native-swarm',revision:VERSION,
   gunBase:AUDIO_MIX.weapons,gunFloor:AUDIO_MIX.gunFloor,
   snapshots:()=>({mix:window.APEX_ARSENAL_AV?.stats?.waveMix||null,
     recentVoice:window.APEX_ARSENAL_AV?.stats?.lastVoice||null,
     decoded:window.APEX_ARSENAL_AV?.audioStatus?.().decoded||0})});
 const director=window.BOXE_SFX?.audio;
 if(!director)return;
 const apply=()=>{
  if(!director.master?.gain)return;
  // Preserve the 1.95x owner gain while guarding peaks from stacked Gold
  // impact samples. This is output dynamics only: no source SFX mutation.
  const ctx=director.audioCtx;
  if(ctx?.createDynamicsCompressor&&!director.__apexWaveLimiter){
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=3;
   limiter.attack.value=.004;limiter.release.value=.19;
   director.master.disconnect();director.master.connect(limiter);limiter.connect(ctx.destination);
   Object.defineProperty(director,'__apexWaveLimiter',{value:limiter});
  }
  director.master.gain.value=director.globalGain*.54*AUDIO_MIX.boxe;
 };
 if(!director.__apexWaveMixed){
  const setup=director.setup.bind(director),gain=director.gain.bind(director);
  director.setup=function(...args){const r=setup(...args);apply();return r;};
  director.gain=function(...args){const r=gain(...args);apply();return r;};
  Object.defineProperty(director,'__apexWaveMixed',{value:true});
 }
 apply();
}
let installed=false,refresh=null;
function node(tag,cls,text){
 const el=doc.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
}
function decor(parent,cls,html){
 if(!parent||parent.querySelector('.'+cls.split(' ')[0]))return null;
 const el=node('div',cls);
 el.setAttribute('aria-hidden','true');
 if(html)el.innerHTML=html;
 parent.append(el);
 return el;
}
const ACTION_GLYPHS=Object.freeze({
 J:'<svg viewBox="0 0 24 24"><path class="gl-body" d="M8 20.5v-3C5.6 16.3 4.5 14.3 4.5 11.5V8.2C4.5 5.3 6.4 3.2 9 3.2c1 0 1.9.3 2.6.9.7-.6 1.6-.9 2.6-.9 2.5 0 4.3 2 4.3 4.7v2.8c1.1.5 1.8 1.4 1.8 2.6 0 1.8-1.3 3.1-3.1 3.1h-.8v4.1Z"/><path class="gl-cuff" d="M8 17.5h8.4v3H8Z"/><path class="gl-bolt" d="M13.1 5.6 9.9 10.3h2.1l-1 4.6 3.4-5h-2.2Z"/><path class="gl-seam" d="M8.7 4.2v5.1M14.5 4.2v5"/></svg>',
 K:'<svg viewBox="0 0 24 24"><path d="M12 3 19 5.2v5.7c0 4.8-2.9 8-7 10.1C7.9 18.9 5 15.7 5 10.9V5.2Z"/><path d="M8.7 11.7 11 14l4.4-4.7"/></svg>',
 L:'<svg viewBox="0 0 24 24"><path d="M4 5.5 10.5 12 4 18.5"/><path d="M11.5 5.5 18 12l-6.5 6.5"/><path d="M18.5 5.5 21 12l-2.5 6.5" opacity=".55"/></svg>',
 U:'<svg viewBox="0 0 24 24"><path d="M7 20v-8.2a5 5 0 0 1 10 0V20l-2.5-2.3L12 20l-2.5-2.3Z"/><circle cx="9.6" cy="11" r=".7" fill="currentColor"/><circle cx="14.4" cy="11" r=".7" fill="currentColor"/></svg>',
 I:'<svg viewBox="0 0 24 24"><path d="M4 18.5 3.2 7 8 10.7 12 4l4 6.7L20.8 7 20 18.5Z"/><path d="M5 21h14"/></svg>'
});
const ACTION_LOCK_GLYPH='<svg viewBox="0 0 24 24"><path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"/><path d="M5.5 10.5h13V20h-13Z"/><circle cx="12" cy="15.2" r="1.45" fill="currentColor" stroke="none"/><path d="M12 16.4v1.7"/></svg>';
function installActionGlyphs(actions){
 for(const button of actions.querySelectorAll('[data-act]')){
  const glyph=ACTION_GLYPHS[button.dataset.act];
  if(glyph&&!button.querySelector('.bw-action-glyph')){
   const holder=node('span','bw-action-glyph');
   holder.setAttribute('aria-hidden','true');
   holder.innerHTML=glyph;
   button.prepend(holder);
  }
  if(!button.querySelector('.bw-action-lock')){
   const lock=node('span','bw-action-lock');
   lock.setAttribute('aria-hidden','true');
   lock.innerHTML=ACTION_LOCK_GLYPH;
   button.append(lock);
  }
 }
}
/* R15 Relic Draft metadata. The pilot still owns card effects and legality;
 * presentation only gives each offer an emblem, class, headline value and
 * current stack trail. No upgrade copy is invented here. */
const UNLOCK_CARD_IDS=Object.freeze(['jab','rocket','uppercut','counter','phantom','ult']);
const CARD_CODES=Object.freeze({
 jab:'JB',rocket:'RK',uppercut:'UP',counter:'CT',phantom:'PH',ult:'UL',
 vitality:'HP',fist:'PW',tempo:'TM',agility:'AG',guard:'GD',heal:'HE',knock:'KN',
 dash:'DS',sustain:'SU',armor:'AR',insight:'XP',overclock:'OC',counterFocus:'CF',rocketPrimer:'RP'
});
const cardSigilSvg=body=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+body+'</svg>';
const CARD_SIGILS=Object.freeze({
 jab:ACTION_GLYPHS.J,
 rocket:cardSigilSvg('<path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M5 13v6h6"/>'),
 uppercut:cardSigilSvg('<path d="M12 20V5"/><path d="m6 10 6-6 6 6"/><path d="M5 21h14"/>'),
 counter:ACTION_GLYPHS.K,
 phantom:ACTION_GLYPHS.U,
 ult:ACTION_GLYPHS.I,
 vitality:cardSigilSvg('<path d="M12 20s-7-4.5-9-9c-1.2-2.8.7-6 3.7-6C9 5 10.8 6.2 12 8c1.2-1.8 3-3 5.3-3 3 0 4.9 3.2 3.7 6-2 4.5-9 9-9 9Z"/>'),
 fist:ACTION_GLYPHS.J,
 tempo:ACTION_GLYPHS.L,
 agility:cardSigilSvg('<path d="M4 6l7 6-7 6"/><path d="M12 6l7 6-7 6" opacity=".6"/>'),
 guard:ACTION_GLYPHS.K,
 heal:cardSigilSvg('<path d="M12 4v16M4 12h16"/>'),
 knock:cardSigilSvg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".65"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
 dash:ACTION_GLYPHS.L,
 sustain:cardSigilSvg('<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z"/><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>'),
 armor:cardSigilSvg('<path d="M12 3l7 3v6c0 4-2.8 7-7 9-4.2-2-7-5-7-9V6Z"/><path d="M12 7v10M8.5 9.5h7"/>'),
 insight:cardSigilSvg('<circle cx="12" cy="12" r="3"/><path d="M2.5 12C5 6.8 8.3 4.5 12 4.5S19 6.8 21.5 12C19 17.2 15.7 19.5 12 19.5S5 17.2 2.5 12Z"/>'),
 overclock:cardSigilSvg('<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
 counterFocus:cardSigilSvg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" opacity=".65"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
 rocketPrimer:cardSigilSvg('<path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M7 7l1 2.4L10.4 10 8 11 7 13.4 6 11 3.6 10 6 9.4Z"/>')
});
const CARD_VALUES=Object.freeze({
 jab:'J · LIÊN HOÀN',rocket:'7.5% · MỖI ĐÒN TRÚNG',uppercut:'J · KẾT LIỄU',
 counter:'GIỮ K · PHẢN ĐÒN',phantom:'U · PHANTOM STEP',ult:'I · CHIÊU CUỐI',heal:'+20% HP MAX'
});
function cardKind(card){
 if(UNLOCK_CARD_IDS.includes(card?.id))return'unlock';
 if(card?.id==='heal')return'instant';
 return'stack';
}
function cardKindLabel(card){
 const kind=cardKind(card);
 return kind==='unlock'?'MỞ KỸ NĂNG':kind==='instant'?'HỒI PHỤC NGAY':'THẺ CỘNG DỒN';
}
function cardValue(card){
 if(CARD_VALUES[card?.id])return CARD_VALUES[card.id];
 const text=String(card?.desc||card?.label||'');
 const match=text.match(/[+-]\s*\d+(?:[,.]\d+)?\s*(?:điểm\s*)?(?:%|s)(?=$|[\s,.);])/i);
 if(match)return match[0].replace(/\s+/g,' ').toUpperCase();
 const ratio=text.match(/\d+(?:[,.]\d+)?\s*%/);
 return ratio?ratio[0].replace(/\s+/g,' '):'BUILD';
}
// R13: every cluster beat must survive as one glanceable phrase in the top
// spine. These names are presentation law only; campaign numbers and spawn
// order remain owned by waveCampaign/pilot telemetry.
const BEATS=Object.freeze([
 Object.freeze({id:'farm',name:'DAWN HARVEST',verb:'HARVEST',hint:'Chain K.O. · bank XP · keep moving',accent:'#8dffb2'}),
 Object.freeze({id:'teach',name:'FIRST LESSON',verb:'READ GUNS',hint:'Learn each muzzle before it learns you',accent:'#8fe8ff'}),
 Object.freeze({id:'teach',name:'CROSS LESSON',verb:'SPLIT ANGLES',hint:'Never stand between two firing lanes',accent:'#8fe8ff'}),
 Object.freeze({id:'mix',name:'BROKEN CHORUS',verb:'CUT CROSSFIRE',hint:'Break one lane and rotate through it',accent:'#ffbb71'}),
 Object.freeze({id:'mix',name:'IRON WEATHER',verb:'OWN CENTER',hint:'Guard to buy time, dash to spend it',accent:'#ff9b57'}),
 Object.freeze({id:'spike',name:'REDLINE',verb:'SURVIVE',hint:'Spend mobility before you spend HP',accent:'#ff4057'}),
 Object.freeze({id:'power',name:'GOLD HARVEST',verb:'FEED BUILD',hint:'Hunt fast K.O. chains and green light',accent:'#ffe1a1'}),
 Object.freeze({id:'crescendo',name:'RISING FURNACE',verb:'TURN PRESSURE',hint:'Counter the lane that commits first',accent:'#ff7048'}),
 Object.freeze({id:'crescendo',name:'APEX STORM',verb:'NO SAFE LANE',hint:'Every gate is live—keep orbiting',accent:'#ff5964'}),
 Object.freeze({id:'boss',name:'LAST BELL',verb:'BREAK GUARDIAN',hint:'Boss at center · escorts are fuel',accent:'#ffc36b'})
]);
const PATTERN_LABEL=Object.freeze({front:'FRONT GATE',flank:'TWIN FLANKS',cross:'CROSS LANES',pincer:'PINCER','four-edge':'FOUR GATES'});
const FAMILY_SHORT=Object.freeze({SEMI:'SEMI',AUTO:'AUTO',BURST:'BURST',SHOTGUN:'SHOT',PRECISION:'SNIPER',AUTOSHOT:'A-SHOT',GRENADE:'NADE',MELEE:'MELEE',SHIELD:'SHIELD',SPECIAL:'SPECIAL'});
const FAMILY_COLORS=Object.freeze({SEMI:'#ffbb71',AUTO:'#ff8a4d',BURST:'#ffc36b',SHOTGUN:'#ff5964',PRECISION:'#8fe8ff',AUTOSHOT:'#ff7048',GRENADE:'#8dffb2',MELEE:'#ffe1a1',SHIELD:'#c9a7ff',SPECIAL:'#f6a6ff'});
const FAMILY_GLYPHS=Object.freeze({SEMI:'◆',AUTO:'▲',BURST:'⬢',SHOTGUN:'✦',PRECISION:'◎',AUTOSHOT:'⬣',GRENADE:'●',MELEE:'✕',SHIELD:'⛨',SPECIAL:'✧'});
const ARENA_RADIUS=920;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const formatInt=value=>Math.round(Number(value)||0).toLocaleString('en-US');
function setText(target,text){if(target&&target.textContent!==text)target.textContent=text;}
function xpThreshold(pilot,level){
 const safeLevel=Math.max(1,Math.floor(Number(level)||1));
 try{const value=Number(pilot?.xpNeeded?.(safeLevel));if(Number.isFinite(value)&&value>0)return value;}catch(_){/* Presentation falls back to the pilot's published curve. */}
 return Math.ceil(70*Math.pow(1.16,safeLevel-1));
}
const distanceLabel=value=>Math.max(1,Math.round((Number(value)||0)/10))+'m';
const familyColor=family=>FAMILY_COLORS[family]||'#ff8a4d';
const familyGlyph=family=>FAMILY_GLYPHS[family]||'▲';
function beatForWave(wave){return BEATS[(Math.max(1,wave||1)-1)%10]||BEATS[0];}
function nextWavePlan(pilot,wave){
 try{return pilot?.planWave?.(wave)?.plan||pilot?.planWave?.(wave)||null;}catch(_){return null;}
}
function spawnPoint(entry){
 const lane=Number.isFinite(entry?.edgeFraction)?entry.edgeFraction:.5,spread=lane*2-1;
 if(entry?.edge==='bottom')return{x:spread*660,y:590};
 if(entry?.edge==='left')return{x:-760,y:spread*510};
 if(entry?.edge==='right')return{x:760,y:spread*510};
 return{x:spread*660,y:-590};
}
let screenFrame={left:0,top:0,width:0,height:0};
function refreshScreenFrame(layer){
 const lab=window.handLab,canvas=lab?.canvas;
 const canvasRect=canvas?.getBoundingClientRect?.(),layerRect=layer?.getBoundingClientRect?.();
 if(canvasRect&&layerRect&&canvasRect.width>0&&canvasRect.height>0){
  screenFrame={left:canvasRect.left-layerRect.left,top:canvasRect.top-layerRect.top,
   width:canvasRect.width,height:canvasRect.height};
 }else if(lab?.w&&lab?.h)screenFrame={left:0,top:0,width:lab.w,height:lab.h};
 return screenFrame;
}
function worldToScreen(x,y){
 const lab=window.handLab;
 if(typeof lab?.toScreen==='function'){
  const point=lab.toScreen(x,y);
  if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))
   return{x:screenFrame.left+point.x,y:screenFrame.top+point.y};
 }
 const player=lab?.player||{x:0,y:0},zoom=lab?.camZoom||1;
 const width=screenFrame.width||lab?.w||window.innerWidth||960;
 const height=screenFrame.height||lab?.h||window.innerHeight||540;
 return{x:screenFrame.left+width/2+(x-(lab?.cam?.x??player.x))*zoom,
  y:screenFrame.top+height/2+(y-(lab?.cam?.y??player.y))*zoom};
}
/* R15 in-bar forge fire. The R14 renderer was physically right but visually
 * too large: this keeps the domain-warped FBM flame body and particle pool,
 * then confines both to short tongues rooted inside the Nhiệt Huyết trough.
 * No coals, sparks or flame body are authored at zero fury. */
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
function install(){
 if(installed)return true;
 installWaveAudioMix();
 const hud=doc.getElementById('wave-hud');
 const modal=doc.querySelector('#wave-modal .w-dialog');
 const stage=doc.getElementById('arena-experience-hud');
 const essential=[hud,modal,hud?.querySelector('.w-left'),hud?.querySelector('.w-right'),
   hud?.querySelector('.w-actions'),hud?.querySelector('#wave-stick'),hud?.querySelector('#wave-status'),
   hud?.querySelector('#resume-wave'),doc.getElementById('w-go')];
 if(essential.some(x=>!x))return false;
 const [, , left,right,actions,stick,status,pause]=essential;
 // R16 keeps the R13 information architecture but rebuilds every combat
 // instrument as machined ironworks: the vitality reactor carries fire in
 // its fury trough, the wave state hangs from an open mechanical spine with
 // no filled panel, and the true arena minimap remains at top-right. Native
 // Gold nodes are moved—not cloned—so IDs, handlers and refresh seams stay.
 const deck=node('div','bw-command-deck');
 deck.id='bw-interface-v2';
 deck.dataset.gold='intact';
 deck.dataset.revision=VERSION;
 deck.dataset.paused='false';
 const top=node('header','bw-top');
 const hero=node('section','bw-hero');
 hero.setAttribute('aria-label','BOXE status');
 const levelCore=node('div','bw-level-core');
 levelCore.id='bw-level-core';
 levelCore.setAttribute('aria-label','Cấp độ và kinh nghiệm của BOXE');
 levelCore.innerHTML='<small>LV</small><strong id="bw-level-value">1</strong><span id="bw-xp-ring-label">0 / 70 XP</span><b class="bw-momentum" id="bw-momentum" data-rank="D" title="Momentum">D</b>';
 const heroLabel=node('div','bw-hero-label');
 heroLabel.innerHTML='<strong>BOXE</strong><span class="bw-momentum-copy" id="bw-momentum-copy">MOMENTUM · OPENING</span>';
 const hpCopy=left.querySelector('#w-hp')?.closest('.w-small');
 hpCopy?.classList.add('bw-native-hp-copy');
 const levelCopy=left.querySelector('#w-level')?.closest('.w-small');
 levelCopy?.classList.add('bw-native-level-copy');
 const furyLine=left.querySelector('.w-fury-line');
 furyLine?.classList.add('bw-native-fury-copy');
 const hpMeter=left.querySelector('.hp-r2'),furyMeter=left.querySelector('.fury-r2');
 const vitalStack=node('div','bw-vital-stack');
 vitalStack.id='bw-vital-stack';
 if(hpMeter)vitalStack.append(hpMeter);
 if(furyMeter)vitalStack.append(furyMeter);
 left.append(vitalStack);
 pause.classList.add('bw-pause-trigger');
 pause.type='button';
 pause.innerHTML='<span></span><span></span>';
 pause.setAttribute('aria-label','Mở menu tạm dừng BOT WAVE');
 pause.title='Tạm dừng';
 hero.append(levelCore,heroLabel,left,pause);
 decor(hero,'bw-forge-shell','');
 // The flame canvases are children of the fused meter trough itself, not a
 // decorative overlay guessed against hero coordinates. Their roots and the
 // shader's fury front therefore stay locked to the Nhiệt Huyết bar.
 decor(vitalStack,'bw-forge-backlight','');
 const forgeFireCanvas=node('canvas','bw-fire-canvas');
 forgeFireCanvas.id='bw-fire-canvas';forgeFireCanvas.setAttribute('aria-hidden','true');
 const forgeParticleCanvas=node('canvas','bw-ember-canvas');
 forgeParticleCanvas.id='bw-ember-canvas';forgeParticleCanvas.setAttribute('aria-hidden','true');
 vitalStack.append(forgeFireCanvas,forgeParticleCanvas);
 const center=node('section','bw-encounter bw-wave-spine bw-paneless-crest bw-iron-spine');
 center.dataset.presentation='paneless-crest';
 center.setAttribute('aria-label','Tình hình trận BOT WAVE');
 const waveCore=node('div','bw-wave-core');
 const chapter=node('small','bw-chapter');
 chapter.id='bw-chapter';
 chapter.textContent='CLUSTER 01 · 1/10';
 const waveNumber=node('strong','bw-wave-number','WAVE 01');
 waveCore.append(chapter,waveNumber);
 const beatCard=node('div','bw-beat-card bw-beat-inline');
 beatCard.id='bw-beat-card';
 beatCard.innerHTML='<span class="bw-beat-kicker">CLUSTER BEAT</span><strong id="bw-beat-name">DAWN HARVEST</strong><span class="bw-beat-verb" id="bw-beat-verb">HARVEST</span><small id="bw-beat-hint">Chain K.O. · bank XP · keep moving</small>';
 const wave=node('div','bw-wave-line');
 wave.innerHTML='<span class="bw-witness">SURVIVE</span>';
 const oracle=node('aside','bw-oracle');
 oracle.id='bw-oracle';
 oracle.setAttribute('aria-label','Dự báo wave tiếp theo');
 oracle.innerHTML='<span class="bw-oracle-kicker">NEXT</span><strong id="bw-oracle-title">WAVE 02 · FIRST LESSON</strong><span id="bw-oracle-detail">READ GUNS</span><small id="bw-oracle-families">HOSTILE MIX SYNCING</small>';
 const pressure=node('div','bw-pressure');
 pressure.innerHTML='<span>PRESSURE</span><strong id="bw-pressure-label">STANDBY</strong><i id="bw-pressure-fill"></i>';
 const centerSegment=node('div','bw-beat-markers');
 centerSegment.id='bw-beat-markers';
 for(let i=0;i<10;i++){const segment=node('i');segment.setAttribute('aria-label','Wave trong cụm '+(i+1));centerSegment.append(segment);}
 center.append(waveCore,beatCard,wave,pressure,centerSegment,oracle);
 decor(center,'bw-spine-frame','<i class="is-left"></i><i class="is-right"></i><b></b>');
 decor(pressure,'bw-pressure-ticks','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
 const threat=node('section','bw-minimap');
 threat.id='bw-minimap';
 threat.setAttribute('aria-label','Bản đồ arena BOT WAVE');
 const minimapHead=node('div','bw-minimap-head');
 minimapHead.innerHTML='<span>RING MAP</span><strong id="bw-minimap-mode">LIVE</strong>';
 const minimapCanvas=node('canvas','bw-minimap-canvas');
 minimapCanvas.id='bw-minimap-canvas';
 minimapCanvas.setAttribute('aria-hidden','true');
 const minimapFoot=node('div','bw-minimap-foot');
 const nativeCount=right.querySelector('#w-count');
 if(nativeCount)minimapFoot.append(nativeCount);
 const minimapNext=node('span','bw-minimap-next','GATE SYNC');
 minimapNext.id='bw-minimap-next';
 minimapFoot.append(minimapNext);
 threat.append(minimapHead,minimapCanvas,minimapFoot);
 decor(threat,'bw-minimap-armor','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
 const dataVault=node('div','bw-data-vault');
 dataVault.hidden=true;
 dataVault.setAttribute('aria-hidden','true');
 dataVault.append(right);
 top.append(hero,center,threat);
 const lower=node('footer','bw-bottom');
 const move=node('div','bw-movement');
 const moveLabel=node('div','bw-joystick-caption','MOVE / EVADE');
 move.append(stick,moveLabel);
 const skill=node('div','bw-skill-deck bw-skill-fan bw-skill-console');
 skill.setAttribute('aria-label','Kỹ năng chiến đấu của BOXE');
 // Native J/K/L/U/I controls keep their key labels and ability states. R16
 // seats them in one bottom-right iron console: locked specials, the large
 // J punch core, then guard and dash in true input order.
 skill.append(actions);
 installActionGlyphs(actions);
 decor(skill,'bw-skill-dock','<i></i><i></i><i></i>');
 lower.append(move,skill);
 status.classList.add('bw-event-ticker');
 const spatial=node('div','bw-spatial-layer');
 spatial.id='bw-spatial-layer';
 spatial.setAttribute('aria-hidden','true');
 const peripheral=node('div','bw-peripheral');
 // Standing owner correction: presentation must never draw its own circle around
 // BOXE. Gold's native combat VFX remains the only player-centered effect.
 spatial.append(peripheral);
 const spatialMarkers=[];
 for(let i=0;i<9;i++){
  const marker=node('div','bw-spatial-marker');
  marker.innerHTML='<i class="bw-marker-arrow"></i><b class="bw-marker-badge"></b><span class="bw-marker-copy"><strong></strong><small></small></span><em class="bw-marker-meter"><i></i></em>';
  spatial.append(marker);spatialMarkers.push(marker);
 }
 const pauseMenu=node('div','bw-pause-menu');
 pauseMenu.id='bw-pause-menu';
 pauseMenu.hidden=true;
 pauseMenu.setAttribute('role','dialog');
 pauseMenu.setAttribute('aria-modal','true');
 pauseMenu.setAttribute('aria-labelledby','bw-pause-title');
 pauseMenu.innerHTML='<section class="bw-pause-card">'
  +'<header class="bw-pause-head"><span>RING COMMAND // BX-07</span><strong id="bw-pause-title">TẠM DỪNG</strong><small id="bw-pause-summary">WAVE 01 · CLUSTER 01 · LV 1</small></header>'
  +'<div class="bw-pause-stats"><div><small>K.O.</small><strong id="bw-pause-kills">0</strong></div><div><small>SÁT THƯƠNG</small><strong id="bw-pause-damage">0</strong></div><div><small>THỜI GIAN</small><strong id="bw-pause-time">00:00</strong></div><div><small>THẺ BUILD</small><strong id="bw-pause-cards-count">0</strong></div></div>'
  +'<nav class="bw-pause-actions" aria-label="Tùy chọn tạm dừng">'
  +'<button type="button" data-pause-action="resume" class="is-primary"><strong>TIẾP TỤC</strong><small>Quay lại sàn đấu</small></button>'
  +'<button type="button" data-pause-action="save-exit"><strong>LƯU & THOÁT</strong><small id="bw-pause-save-copy">Lưu tại đầu wave hiện tại</small></button>'
  +'<button type="button" data-pause-action="replay-wave"><strong>CHƠI LẠI WAVE</strong><small>Dùng snapshot đầu wave</small></button>'
  +'<button type="button" data-pause-action="replay-cluster"><strong>CHƠI LẠI CỤM 10</strong><small>Khôi phục build lúc vào cụm</small></button>'
  +'<button type="button" data-pause-action="restart-run" class="is-danger"><strong>CHƠI LẠI TỪ ĐẦU</strong><small>Xóa run và bắt đầu Wave 01</small></button>'
  +'</nav>'
  +'<div class="bw-pause-build-wrap"><span>BUILD HIỆN TẠI</span><div class="bw-pause-build" id="bw-pause-build"><em>CHƯA CÓ THẺ</em></div></div>'
  +'<p class="bw-pause-note" id="bw-pause-note">Tiến độ được lưu ở đầu mỗi wave. Thoát giữa wave vẫn giữ nguyên snapshot gần nhất.</p>'
  +'</section>';
 // R17 wave announcement: replaces Gold's center-screen canvas banner in
 // top-down play. Compact, hung under the wave spine, never over BOXE.
 const announce=node('div','bw-announce');
 announce.id='bw-announce';
 announce.setAttribute('aria-live','polite');
 announce.innerHTML='<strong id="bw-announce-text">WAVE 01</strong><span id="bw-announce-sub"></span>';
 deck.append(spatial,top,lower,status,pauseMenu,dataVault,announce);
 decor(deck,'bw-atmosphere','<i class="bw-corner is-tl"></i><i class="bw-corner is-tr"></i><i class="bw-corner is-bl"></i><i class="bw-corner is-br"></i>');
 hud.replaceChildren(deck);
 // The arena floor is prerendered once, so rebuild it after the shipped
 // Vietnamese faces actually arrive; otherwise its APEX/DEPLOY lettering can
 // be permanently baked with a platform fallback from the first frame.
 const refreshArenaType=(attempt=0)=>{
  if(!doc.fonts?.load)return;
  Promise.allSettled([
   doc.fonts.load('700 32px "ApexVietCondensed"','APEX'),
   doc.fonts.load('700 32px "Oswald"','APEX'),
   doc.fonts.load('600 12px "JetBrains Mono"','DEPLOY 01')
  ]).then(results=>{
   const loaded=results.reduce((sum,result)=>sum+(result.status==='fulfilled'?result.value.length:0),0);
   const stage=window.BOXE_ARENA_EXPERIENCE?.stage;
   if(stage&&loaded>=2){stage.base=null;return;}
   if(attempt<15)window.setTimeout(()=>refreshArenaType(attempt+1),250);
  });
 };
 refreshArenaType();
 // A cinematic chapter-opening screen, not a black dialog with 3 web cards.
 // Existing dialog title, card nodes and NEXT button stay direct children;
 // native Gold upgrade selection and modal report insertion keep working.
 if(!modal.querySelector('.bw-cover')){
  const art=node('aside','bw-cover');
  const image=node('img','bw-cover-art');
  image.src='/assets/dictionary/heroes/boxe/cover.png';
  image.alt='BOXE — The Fist of Dawn';
  image.decoding='async';
  const frame=node('div','bw-cover-frame');
  frame.innerHTML='<span>APEX  /  SPECIAL OPERATIONS</span><strong>THE LAST<br>ROUND</strong><small>UNLIMITED ARSENAL · BOXE</small>';
  art.append(image,frame);
  modal.prepend(art);
 }
 if(!modal.querySelector('.bw-dialog-kicker')){
  const kicker=node('div','bw-dialog-kicker');
  kicker.textContent='BOT WAVE  //  SURVIVAL PROTOCOL';
  modal.insertBefore(kicker,doc.getElementById('w-title'));
 }
 decor(modal,'bw-dialog-ornaments','<i class="is-tl"></i><i class="is-tr"></i><i class="is-bl"></i><i class="is-br"></i>');
 decor(modal,'bw-dialog-seal','APEX // LAST ROUND // 07');
 modal.dataset.presentation='relic-draft';
 const cardsRoot=doc.getElementById('w-cards');
 const decorateUpgradeCards=()=>{
  const state=window.BOXE_WAVE_PILOT?.state||{},offer=Array.isArray(state.offer)?state.offer:[];
  if(!cardsRoot||!offer.length)return;
  for(const [index,button] of [...cardsRoot.querySelectorAll('.w-card')].entries()){
   const card=offer[index];if(!card)continue;
   const kind=cardKind(card),tier=String(card.tier||'COMMON').toUpperCase();
   const valueText=cardValue(card),stacks=Math.max(0,Number(state.stacks?.[card.id])||0),max=Math.max(0,Number(card.max)||0);
   const footerText=kind==='unlock'?'ẤN KỸ NĂNG CHƯA MỞ':kind==='instant'?'KÍCH HOẠT NGAY KHI CHỌN':
    'STACK '+stacks+' → '+(stacks+1)+(max?' / '+max:'');
   button.classList.add('bw-relic-card');
   button.dataset.cardId=card.id;button.dataset.tier=tier;button.dataset.kind=kind;
   button.dataset.choice=String(index+1).padStart(2,'0');button.dataset.code=CARD_CODES[card.id]||'APX';
   button.style.setProperty('--bw-card-stack',String(kind==='stack'?(max?clamp(stacks/max):Math.min(1,.14+stacks*.08)):kind==='unlock'?.08:1));
   let sigil=button.querySelector('.bw-card-sigil');
   if(!sigil){sigil=node('span','bw-card-sigil');sigil.setAttribute('aria-hidden','true');button.insertBefore(sigil,button.querySelector('strong'));}
   if(sigil.dataset.cardId!==card.id){sigil.innerHTML=CARD_SIGILS[card.id]||'';sigil.dataset.cardId=card.id;}
   let value=button.querySelector('.bw-card-value');
   if(!value){value=node('b','bw-card-value');button.querySelector('strong')?.after(value);}
   setText(value,valueText);
   let footer=button.querySelector('.bw-card-footer');
   if(!footer){footer=node('span','bw-card-footer');button.append(footer);}
   setText(footer,footerText);
   setText(button.querySelector('small'),tier+' · '+cardKindLabel(card));
   button.setAttribute('aria-label',[card.label,valueText,card.desc,footerText].filter(Boolean).join('. '));
  }
 };
 const cardObserver=typeof window.MutationObserver==='function'?new window.MutationObserver(decorateUpgradeCards):null;
 if(cardObserver&&cardsRoot)cardObserver.observe(cardsRoot,{childList:true});
 decorateUpgradeCards();
 const oldTrack=stage?.querySelector('#arena-round-track');
 if(oldTrack){oldTrack.setAttribute('aria-hidden','true');oldTrack.hidden=true;}
 const bossPanel=stage?.querySelector('#r2-boss-panel');
 const tool=stage?.querySelector('#arena-experience-tools');
 if(tool){tool.hidden=true;tool.setAttribute('aria-hidden','true');}
 // HUD truth: 10-wave cluster beats, live pressure budget, wave identity.
 let lastChapter='',lastPressure='',lastBeat=-1,lastGuardState='',lastRank='',lastMomentumText='',lastAnnounceAt=-1,announceTimer=0;
 let forecastCacheWave=-1,forecastCache=null,spatialFrame=0,lastSpatialAt=0;
 let lastVitalsSignature='',lastPauseSignature='',pauseMenuOpen=false,pauseConfirmAction='',pauseConfirmTimer=0;
 const beatName=beatCard.querySelector('#bw-beat-name'),beatVerb=beatCard.querySelector('#bw-beat-verb'),
  beatHint=beatCard.querySelector('#bw-beat-hint'),beatKicker=beatCard.querySelector('.bw-beat-kicker'),
  oracleTitle=oracle.querySelector('#bw-oracle-title'),oracleDetail=oracle.querySelector('#bw-oracle-detail'),
  oracleFamilies=oracle.querySelector('#bw-oracle-families'),momentum=hero.querySelector('#bw-momentum'),
  momentumCopy=hero.querySelector('#bw-momentum-copy'),levelValue=hero.querySelector('#bw-level-value'),
  xpRingLabel=hero.querySelector('#bw-xp-ring-label'),minimapMode=threat.querySelector('#bw-minimap-mode'),
  pauseSummary=pauseMenu.querySelector('#bw-pause-summary'),pauseKills=pauseMenu.querySelector('#bw-pause-kills'),
  pauseDamage=pauseMenu.querySelector('#bw-pause-damage'),pauseTime=pauseMenu.querySelector('#bw-pause-time'),
  pauseCardsCount=pauseMenu.querySelector('#bw-pause-cards-count'),pauseBuild=pauseMenu.querySelector('#bw-pause-build'),
  pauseNote=pauseMenu.querySelector('#bw-pause-note'),pauseSaveCopy=pauseMenu.querySelector('#bw-pause-save-copy');
 const pauseButtons=[...pauseMenu.querySelectorAll('[data-pause-action]')];
 for(const button of pauseButtons)button.dataset.label=button.querySelector('strong')?.textContent||'';
 const prefersReducedMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const forgeFire=createForgeFire(forgeFireCanvas,forgeParticleCanvas,prefersReducedMotion);
 hero.dataset.fireRenderer=forgeFire.mode;
 let lastPulseWave=0,lastPulseLevel=0,lastBossPulse=false,lastIgnitedPulse=false;
 const minimapTrail=[];
 const eventTimers=new Map();
 const pulseDeck=(className,duration=950)=>{
  if(prefersReducedMotion)return;
  deck.classList.remove(className);void deck.offsetWidth;deck.classList.add(className);
  const old=eventTimers.get(className);if(old)window.clearTimeout(old);
  eventTimers.set(className,window.setTimeout(()=>deck.classList.remove(className),duration));
 };
 // R16 motion follows the pilot's own button classes. Presentation never
 // invents availability: it only turns native locked/cooling/guarding state
 // transitions into a socket flash, an unlock snap and a stable data state.
 const actionButtons=[...actions.querySelectorAll('[data-act]')];
 const actionMotion=new Map(actionButtons.map(button=>[button,{
  cooling:button.classList.contains('is-cooling'),disabled:!!button.disabled,
  readyTimer:0,unlockTimer:0}]));
 for(const button of actionButtons)button.addEventListener('animationend',event=>{
  if(event.target===button&&event.animationName==='bw-action-deploy')
   button.classList.add('bw-deployed');
 });
 const flashAction=(button,className,duration,timerKey)=>{
  if(prefersReducedMotion)return;
  const motion=actionMotion.get(button);if(!motion)return;
  button.classList.remove(className);void button.offsetWidth;button.classList.add(className);
  if(motion[timerKey])window.clearTimeout(motion[timerKey]);
  motion[timerKey]=window.setTimeout(()=>button.classList.remove(className),duration);
 };
 const syncActionMotion=()=>{
  for(const button of actionButtons){
   const motion=actionMotion.get(button);if(!motion)continue;
   const cooling=button.classList.contains('is-cooling'),disabled=!!button.disabled,
    guarding=button.classList.contains('is-guarding'),pressed=button.classList.contains('on');
   button.dataset.motionState=disabled?'locked':guarding?'guarding':cooling?'cooling':pressed?'pressed':'ready';
   if(motion.disabled&&!disabled)flashAction(button,'bw-unlock-flash',950,'unlockTimer');
   else if(button.dataset.act!=='J'&&motion.cooling&&!cooling&&!disabled&&!guarding)
    flashAction(button,'bw-ready-flash',680,'readyTimer');
   motion.cooling=cooling;motion.disabled=disabled;
  }
 };
 let lastHeroHp=null,heroHitTimer=0;
 const pulseHeroHit=()=>{
  if(prefersReducedMotion)return;
  hero.classList.remove('bw-took-hit');void hero.offsetWidth;hero.classList.add('bw-took-hit');
  if(heroHitTimer)window.clearTimeout(heroHitTimer);
  heroHitTimer=window.setTimeout(()=>hero.classList.remove('bw-took-hit'),310);
 };
 const resetPauseConfirm=()=>{
  pauseConfirmAction='';
  if(pauseConfirmTimer)window.clearTimeout(pauseConfirmTimer);
  pauseConfirmTimer=0;
  for(const button of pauseButtons){
   button.classList.remove('is-confirming');
   const label=button.querySelector('strong');if(label&&button.dataset.label)label.textContent=button.dataset.label;
  }
 };
 const updatePauseMenu=()=>{
  const pilot=window.BOXE_WAVE_PILOT,s=pilot?.state||{},wave=Math.max(1,Number(s.wave)||1);
  const cluster=Math.floor((wave-1)/10)+1,level=Math.max(1,Number(s.level)||1);
  const stacks=s.stacks&&typeof s.stacks==='object'?Object.entries(s.stacks).filter(([,count])=>Number(count)>0):[];
  const cardTotal=stacks.reduce((sum,[,count])=>sum+(Number(count)||0),0);
  const signature=[wave,level,s.kills||0,Math.round(s.waveDamageDealt||0),Math.floor(s.aliveTime||0),cardTotal,
   s.waveSnapshot?.wave||0,s.clusterSnapshot?.wave||0].join(':');
  setText(pauseSummary,'WAVE '+String(wave).padStart(2,'0')+' · CLUSTER '+String(cluster).padStart(2,'0')+' · LV '+level);
  setText(pauseKills,formatInt(s.kills));
  setText(pauseDamage,formatInt(s.waveDamageDealt));
  const alive=Math.max(0,Math.floor(Number(s.aliveTime)||0));
  setText(pauseTime,String(Math.floor(alive/60)).padStart(2,'0')+':'+String(alive%60).padStart(2,'0'));
  setText(pauseCardsCount,String(cardTotal));
  const savedWave=Number(s.waveSnapshot?.wave)||0,clusterWave=Number(s.clusterSnapshot?.wave)||0;
  setText(pauseSaveCopy,savedWave?'Đã khóa snapshot đầu Wave '+String(savedWave).padStart(2,'0'):'Chưa có snapshot để lưu');
  for(const button of pauseButtons){
   const action=button.dataset.pauseAction;
   button.disabled=action==='save-exit'? !savedWave : action==='replay-wave'? !savedWave : action==='replay-cluster'? !clusterWave : false;
  }
  const replayWaveButton=pauseButtons.find(button=>button.dataset.pauseAction==='replay-wave');
  if(replayWaveButton){
   replayWaveButton.dataset.label=s.autoNextWave&&savedWave?'VÀO WAVE '+String(savedWave).padStart(2,'0'):'CHƠI LẠI WAVE';
   if(pauseConfirmAction!=='replay-wave')setText(replayWaveButton.querySelector('strong'),replayWaveButton.dataset.label);
   setText(replayWaveButton.querySelector('small'),s.autoNextWave?'Bắt đầu ngay từ snapshot wave kế tiếp':'Dùng snapshot đầu wave');
  }
  if(!pauseConfirmAction)setText(pauseNote,savedWave?
   'Thoát lúc này sẽ tiếp tục từ đầu Wave '+savedWave+'. Nếu thua trong cụm, snapshot cụm ở Wave '+clusterWave+' vẫn được giữ nguyên.':
   'Hãy bắt đầu wave đầu tiên để tạo snapshot. Từ thời điểm đó, thoát game không làm mất tiến độ.');
  if(signature===lastPauseSignature)return;
  lastPauseSignature=signature;
  if(!stacks.length){pauseBuild.innerHTML='<em>CHƯA CÓ THẺ</em>';return;}
  pauseBuild.replaceChildren(...stacks.sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0)||a[0].localeCompare(b[0])).map(([id,count])=>{
   const chip=node('span','bw-pause-chip',String(id).replaceAll('_',' ').toUpperCase()+(Number(count)>1?' ×'+count:''));
   chip.dataset.cardId=id;chip.dataset.code=CARD_CODES[id]||'APX';
   chip.dataset.kind=UNLOCK_CARD_IDS.includes(id)?'unlock':id==='heal'?'instant':'stack';
   return chip;
  }));
 };
 const syncPauseMenu=()=>{
  const pilot=window.BOXE_WAVE_PILOT,s=pilot?.state||{},modalOpen=!!doc.getElementById('wave-modal')&&!doc.getElementById('wave-modal').hidden;
  const shouldOpen=!!window.handLab?.paused&&['combat','intermission'].includes(s.phase)&&!modalOpen;
  deck.dataset.paused=shouldOpen?'true':'false';
  pause.disabled=modalOpen||!['combat','intermission'].includes(s.phase);
  if(shouldOpen===pauseMenuOpen){if(shouldOpen)updatePauseMenu();return;}
  pauseMenuOpen=shouldOpen;pauseMenu.hidden=!shouldOpen;
  deck.classList.toggle('bw-is-paused',shouldOpen);
  if(shouldOpen){resetPauseConfirm();updatePauseMenu();pauseButtons[0]?.focus?.();}
  else{resetPauseConfirm();if(doc.activeElement&&pauseMenu.contains(doc.activeElement))pause.focus?.();}
 };
 const setPauseFromInterface=open=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(typeof pilot?.setPaused==='function')pilot.setPaused(!!open);
  else if(window.handLab)window.handLab.paused=!!open;
  syncPauseMenu();
 };
 pause.onclick=event=>{event.preventDefault();setPauseFromInterface(!window.handLab?.paused);};
 pauseMenu.addEventListener('click',event=>{if(event.target===pauseMenu)setPauseFromInterface(false);});
 for(const button of pauseButtons)button.addEventListener('click',()=>{
  const action=button.dataset.pauseAction,pilot=window.BOXE_WAVE_PILOT;
  if(action==='resume'){setPauseFromInterface(false);return;}
  if(action==='save-exit'){
   const result=pilot?.saveAndExit?.();
   if(!result?.saved)setText(pauseNote,'Chưa thể lưu vì snapshot đầu wave chưa tồn tại. Hãy vào wave trước khi thoát.');
   return;
  }
  if(pauseConfirmAction!==action){
   resetPauseConfirm();pauseConfirmAction=action;button.classList.add('is-confirming');
   const label=button.querySelector('strong');if(label)label.textContent='ẤN LẦN NỮA ĐỂ XÁC NHẬN';
   setText(pauseNote,action==='restart-run'?'Hành động này xóa toàn bộ run hiện tại và snapshot đã lưu.':
    action==='replay-cluster'?'Toàn bộ thẻ và tiến triển kiếm được trong cụm hiện tại sẽ bị thu hồi.':
    'Wave hiện tại sẽ bắt đầu lại từ snapshot đầu wave.');
   pauseConfirmTimer=window.setTimeout(()=>{resetPauseConfirm();updatePauseMenu();},3400);
   return;
  }
  resetPauseConfirm();pauseMenuOpen=false;pauseMenu.hidden=true;deck.classList.remove('bw-is-paused');
  if(action==='replay-wave')pilot?.replayWave?.();
  else if(action==='replay-cluster')pilot?.replayCluster?.();
  else if(action==='restart-run')pilot?.restartRun?.();
  syncPauseMenu();
 });
 window.addEventListener('keydown',event=>{
  if(event.code!=='Escape'||event.repeat)return;
  const phase=window.BOXE_WAVE_PILOT?.state?.phase;
  if(!['combat','intermission'].includes(phase))return;
  event.preventDefault();setPauseFromInterface(!window.handLab?.paused);
 });
 const drawMinimap=(lab,s,live)=>{
  const size=minimapCanvas.clientWidth||0;
  if(!size||!lab?.player)return;
  let ctx=null;
  try{ctx=minimapCanvas.getContext('2d');}catch(_){return;}
  if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),pixels=Math.max(2,Math.round(size*dpr));
  if(minimapCanvas.width!==pixels||minimapCanvas.height!==pixels){minimapCanvas.width=pixels;minimapCanvas.height=pixels;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
  const cx=size/2,cy=size/2,radius=size/2-8,scale=radius/ARENA_RADIUS,time=Number(lab.time)||0;
  const px=x=>cx+(Number(x)||0)*scale,py=y=>cy+(Number(y)||0)*scale;
  const beatIndex=Number.isInteger(s.hudBeatIndex)?clamp(s.hudBeatIndex,0,9):0,accent=BEATS[beatIndex]?.accent||'#8fe8ff';
  const bg=ctx.createRadialGradient(cx-radius*.22,cy-radius*.28,radius*.06,cx,cy,radius);
  bg.addColorStop(0,'#2a4a6c');bg.addColorStop(.38,'#1a3552');bg.addColorStop(.72,'#0c2138');bg.addColorStop(1,'#04101f');
  ctx.fillStyle=bg;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='rgba(255,226,176,.055)';
  for(let gy=-4;gy<=4;gy++)for(let gx=-4;gx<=4;gx++){
   const x=cx+gx*radius/4.4,y=cy+gy*radius/4.4;
   if(Math.hypot(x-cx,y-cy)<radius-4){ctx.beginPath();ctx.arc(x,y,.75,0,Math.PI*2);ctx.fill();}
  }
  for(const [ring,alpha,width] of [[.24,.22,1],[.48,.3,1],[.72,.24,1],[.92,.38,1.4]]){
   ctx.strokeStyle='rgba(143,232,255,'+alpha+')';ctx.lineWidth=width;
   ctx.beginPath();ctx.arc(cx,cy,radius*ring,0,Math.PI*2);ctx.stroke();
  }
  ctx.strokeStyle='rgba(255,226,176,.10)';ctx.lineWidth=1;
  for(const angle of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
   ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*radius*.16,cy+Math.sin(angle)*radius*.16);
   ctx.lineTo(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius);ctx.stroke();
  }
  ctx.strokeStyle='rgba(143,232,255,.15)';
  ctx.beginPath();ctx.moveTo(cx-radius,cy);ctx.lineTo(cx+radius,cy);ctx.moveTo(cx,cy-radius);ctx.lineTo(cx,cy+radius);ctx.stroke();
  const quadrant=[0,0,0,0],edges=['top','right','bottom','left'];
  for(const q of s.queue||[]){const i=edges.indexOf(q.edge);if(i>=0)quadrant[i]+=.35+(Number(q.pressure)||0)/260+(q.boss?1.3:0);}
  for(const e of live){const i=Math.abs(e.y||0)>Math.abs(e.x||0)?((e.y||0)<0?0:2):((e.x||0)<0?3:1);quadrant[i]+=.25+(Number(e.wavePressure)||0)/300+(e.waveBoss?1.2:0);}
  const maxQuadrant=Math.max(1,...quadrant);
  ctx.lineCap='round';
  for(let i=0;i<4;i++){
   const load=quadrant[i]/maxQuadrant,center=-Math.PI/2+i*Math.PI/2,span=.22+load*.72;
   ctx.strokeStyle=i===2&&live.some(e=>e.waveBoss)?'rgba(255,89,100,.88)':'rgba(255,187,113,'+(0.18+load*.58)+')';
   ctx.lineWidth=3+load*3;ctx.beginPath();ctx.arc(cx,cy,radius-3,center-span/2,center+span/2);ctx.stroke();
  }
  const cam=lab.cam||lab.player,zoom=Math.max(.1,Number(lab.camZoom)||.875);
  const halfW=(Number(lab.w)||size)/(2*zoom),halfH=(Number(lab.h)||size)/(2*zoom);
  const view={l:px((cam.x||0)-halfW),t:py((cam.y||0)-halfH),r:px((cam.x||0)+halfW),b:py((cam.y||0)+halfH)};
  const corner=Math.min(9,(view.r-view.l)*.15,(view.b-view.t)*.15);
  ctx.strokeStyle='rgba(255,243,220,.34)';ctx.lineWidth=1.15;ctx.lineCap='round';
  for(const [x,y,dx,dy] of [[view.l,view.t,1,1],[view.r,view.t,-1,1],[view.l,view.b,1,-1],[view.r,view.b,-1,-1]]){
   ctx.beginPath();ctx.moveTo(x+dx*corner,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*corner);ctx.stroke();
  }
  const sweepAngle=prefersReducedMotion?null:(time*1.45)%(Math.PI*2);
  if(sweepAngle!=null){
   const sweepGradient=ctx.createRadialGradient(cx,cy,2,cx,cy,radius);
   sweepGradient.addColorStop(0,'rgba(255,191,92,.27)');sweepGradient.addColorStop(.68,'rgba(255,161,66,.1)');sweepGradient.addColorStop(1,'rgba(255,161,66,0)');
   ctx.fillStyle=sweepGradient;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,radius,sweepAngle,sweepAngle+.58);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(255,226,160,.62)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweepAngle)*radius,cy+Math.sin(sweepAngle)*radius);ctx.stroke();
  }
  const diamond=(x,y,r,fill,stroke)=>{
   ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();
   if(fill){ctx.fillStyle=fill;ctx.fill();}
   if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  };
  (s.queue||[]).forEach((q,index)=>{const p=spawnPoint(q);diamond(px(p.x),py(p.y),index?2.4:4,index?'':'rgba(143,232,255,.9)',index?'rgba(143,232,255,.42)':'#dff8ff');});
  for(const pack of s.healthPacks||[]){
   const x=px(pack.x),y=py(pack.y);ctx.strokeStyle='#8dffb2';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();
  }
  for(const e of live){
   const x=px(e.x),y=py(e.y),color=familyColor(e.waveFamily);
   const vx=Number(e.vx)||0,vy=Number(e.vy)||0,speed=Math.hypot(vx,vy);
   if(speed>12){ctx.strokeStyle=color;ctx.globalAlpha=.55;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+vx/speed*7,y+vy/speed*7);ctx.stroke();ctx.globalAlpha=1;}
   if(sweepAngle!=null){
    const pingAge=((sweepAngle-Math.atan2(e.y||0,e.x||0))%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    if(pingAge<.92){const pingFade=1-pingAge/.92;ctx.strokeStyle='rgba(255,226,160,'+(pingFade*.58)+')';ctx.lineWidth=1.1;
     ctx.beginPath();ctx.arc(x,y,5+(1-pingFade)*9,0,Math.PI*2);ctx.stroke();}
   }
   if(e.waveBoss){ctx.strokeStyle='rgba(255,195,107,.78)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,7+Math.sin(time*6)*1.1,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(255,89,100,.42)';ctx.beginPath();ctx.arc(x,y,10+Math.sin(time*6+1)*1.4,0,Math.PI*2);ctx.stroke();}
   diamond(x,y,e.waveBoss?5.5:3.4,color,'rgba(255,243,220,.9)');
  }
  const player=lab.player,angle=Number.isFinite(player.aim)?player.aim:(Number(player.bodyAngle)||0);
  const lastTrail=minimapTrail[minimapTrail.length-1];
  if(!lastTrail||Math.hypot((player.x||0)-lastTrail.x,(player.y||0)-lastTrail.y)>24){
   minimapTrail.push({x:player.x||0,y:player.y||0});while(minimapTrail.length>20)minimapTrail.shift();
  }
  if(minimapTrail.length>1){
   ctx.lineCap='round';ctx.lineJoin='round';
   for(let i=1;i<minimapTrail.length;i++){
    const a=minimapTrail[i-1],b=minimapTrail[i];
    ctx.strokeStyle=accent;ctx.globalAlpha=.05+.30*(i/minimapTrail.length);ctx.lineWidth=1+.8*(i/minimapTrail.length);
    ctx.beginPath();ctx.moveTo(px(a.x),py(a.y));ctx.lineTo(px(b.x),py(b.y));ctx.stroke();
   }
   ctx.globalAlpha=1;
  }
  ctx.save();ctx.translate(px(player.x),py(player.y));ctx.rotate(angle);
  ctx.fillStyle='#ffe9bd';ctx.strokeStyle='#ff8a3d';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5.5,-5);ctx.lineTo(-2.8,0);ctx.lineTo(-5.5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(255,207,139,.34)';ctx.beginPath();ctx.arc(px(player.x),py(player.y),8+Math.sin(time*3.2)*1.2,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  const glass=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius*.4,cy+radius);
  glass.addColorStop(0,'rgba(255,255,255,.14)');glass.addColorStop(.28,'rgba(255,255,255,.035)');glass.addColorStop(.58,'rgba(255,255,255,0)');glass.addColorStop(1,'rgba(0,0,0,.20)');
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();ctx.fillStyle=glass;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);ctx.restore();
  ctx.strokeStyle='rgba(255,214,150,.82)';ctx.globalAlpha=.82;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(255,226,176,.72)';ctx.lineCap='round';
  for(let i=0;i<36;i++){
   const a=i/36*Math.PI*2,long=i%9===0,len=long?6:2.8;
   ctx.lineWidth=long?1.4:.8;ctx.globalAlpha=long?.88:.42;
   ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*(radius-1),cy+Math.sin(a)*(radius-1));
   ctx.lineTo(cx+Math.cos(a)*(radius+len),cy+Math.sin(a)*(radius+len));ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=3;
  ctx.fillStyle='rgba(255,231,194,.88)';ctx.font='600 9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('N',cx,11);ctx.fillText('S',cx,size-11);ctx.fillText('W',11,cy);ctx.fillText('E',size-11,cy);
 };
 const updateSpatial=()=>{
  const pilot=window.BOXE_WAVE_PILOT,lab=window.handLab,s=pilot?.state||{},player=lab?.player;
  if(!pilot||!lab||!player){
   for(const marker of spatialMarkers)marker.style.opacity='0';
   peripheral.style.opacity='0';return;
  }
  const width=spatial.clientWidth||window.innerWidth||lab.w||960,height=spatial.clientHeight||window.innerHeight||lab.h||540;
  const frame=refreshScreenFrame(spatial),frameRight=frame.left+(frame.width||width),frameBottom=frame.top+(frame.height||height);
  const layerRect=spatial.getBoundingClientRect?.(),panelRects=[];
  if(layerRect)for(const el of [hero,center,threat,move,skill,bossPanel,...(announce.classList.contains('is-show')?[announce]:[])]){
   const rect=el?.getBoundingClientRect?.();
   if(rect&&rect.width>0&&rect.height>0)panelRects.push({
    left:rect.left-layerRect.left-7,top:rect.top-layerRect.top-7,
    right:rect.right-layerRect.left+7,bottom:rect.bottom-layerRect.top+7});
  }
  const pointInPanel=point=>panelRects.some(rect=>point.x>=rect.left&&point.x<=rect.right&&point.y>=rect.top&&point.y<=rect.bottom);
  const avoidPanels=point=>{
   const result={x:point.x,y:point.y};
   for(let pass=0;pass<3;pass++)for(const rect of panelRects){
    if(result.x<rect.left||result.x>rect.right||result.y<rect.top||result.y>rect.bottom)continue;
    const exits=[result.x-rect.left,rect.right-result.x,result.y-rect.top,rect.bottom-result.y];
    const side=exits.indexOf(Math.min(...exits));
    if(side===0)result.x=rect.left-4;else if(side===1)result.x=rect.right+4;
    else if(side===2)result.y=rect.top-4;else result.y=rect.bottom+4;
   }
   return result;
  };
  const safe={left:frame.left+62,top:frame.top+38,right:Math.max(frame.left+120,frameRight-62),bottom:Math.max(frame.top+90,frameBottom-38)};
  const playerPoint=worldToScreen(player.x||0,player.y||0);
  const isOffscreen=point=>point.x<frame.left+2||point.x>frameRight-2||point.y<frame.top+2||point.y>frameBottom-2;
  const live=(lab.enemies||[]).filter(e=>!e.dead&&e.waveGunId);
  const entries=[];
  const push=(kind,x,y,main,detail,glyph,family='',options={})=>{
   const point=worldToScreen(x||0,y||0),offscreen=isOffscreen(point),occluded=!offscreen&&pointInPanel(point);
   if(!offscreen&&!occluded&&!options.force)return;
   entries.push({kind,point,main,detail,glyph,family,offscreen,occluded,
    distance:Math.hypot((x||0)-(player.x||0),(y||0)-(player.y||0)),
    meter:Number.isFinite(options.meter)?clamp(options.meter):null,count:Math.max(1,options.count||1)});
  };
  const boss=live.find(e=>e.waveBoss);
  if(boss)push('boss',boss.x,boss.y,boss.waveGunId||'GUARDIAN','BOSS · '+distanceLabel(Math.hypot((boss.x||0)-(player.x||0),(boss.y||0)-(player.y||0)))+' · '+formatInt(boss.hp)+' HP','♛',boss.waveFamily||'',{meter:boss.maxHp?boss.hp/boss.maxHp:null});
  const pack=s.healthPacks?.[0];
  if(pack){
   const remains=Math.max(0,(Number(pack.expiresAt)||0)-(Number(lab.time)||0));
   push('heal',pack.x,pack.y,'+10% HP',distanceLabel(Math.hypot((pack.x||0)-(player.x||0),(pack.y||0)-(player.y||0)))+(remains?' · '+remains.toFixed(1)+'s':''),'+','',{force:true,meter:remains?remains/8:null});
  }
  const next=s.queue?.[0];
  if(next&&s.phase==='combat'){
   const charge=1-clamp((Number(s.spawnT)||0)/Math.max(.18,Number(s.spawnInterval)||.37));
   if(charge>=.18){
    const point=spawnPoint(next);
    push('gate',point.x,point.y,next.gun||'HOSTILE',(next.edge||'gate').toUpperCase()+' GATE · '+((Number(s.spawnT)||0)>0?Math.max(0,Number(s.spawnT)||0).toFixed(1)+'s':'HOLD'),'◆',next.family||'',{meter:charge});
   }
  }
  const hostileCandidates=live.filter(e=>e!==boss).map(e=>{
   const point=worldToScreen(e.x||0,e.y||0),distance=Math.hypot((e.x||0)-(player.x||0),(e.y||0)-(player.y||0));
   const angle=Math.atan2((e.y||0)-(player.y||0),(e.x||0)-(player.x||0));
   const sector=((Math.round(angle/(Math.PI/6))%12)+12)%12;
   const score=(Number(e.wavePressure)||0)+3600/Math.max(160,distance)+(e.waveFamily==='PRECISION'?18:0);
   return {e,point,distance,sector,score,hidden:isOffscreen(point)||pointInPanel(point)};
  }).filter(item=>item.hidden);
  const hostileGroups=new Map();
  for(const item of hostileCandidates){
   if(!hostileGroups.has(item.sector))hostileGroups.set(item.sector,[]);
   hostileGroups.get(item.sector).push(item);
  }
  [...hostileGroups.values()].map(group=>group.sort((a,b)=>b.score-a.score)[0])
   .sort((a,b)=>b.score-a.score).slice(0,5).forEach(item=>{
    const group=hostileGroups.get(item.sector)||[item],e=item.e;
    push('hostile',e.x,e.y,(e.waveGunId||'HOSTILE')+(group.length>1?' +'+(group.length-1):''),
     (FAMILY_SHORT[e.waveFamily]||e.waveFamily||'HOSTILE')+' · '+distanceLabel(item.distance),
     familyGlyph(e.waveFamily),e.waveFamily||'',{force:true,count:group.length,meter:e.maxHp?e.hp/e.maxHp:null});
   });
  const placedMarkers=[];
  spatialMarkers.forEach((marker,index)=>{
   const entry=entries[index];
   if(!entry){marker.style.opacity='0';marker.className='bw-spatial-marker';marker.style.transform='translate3d(-300px,-300px,0)';return;}
   const markerHalfW=clamp(42+entry.main.length*3.2,54,88);
   let point=avoidPanels({
    x:clamp(entry.point.x,Math.max(safe.left,frame.left+markerHalfW+8),Math.min(safe.right,frameRight-markerHalfW-8)),
    y:clamp(entry.point.y,safe.top,safe.bottom)});
   point={x:clamp(point.x,frame.left+24,frameRight-24),y:clamp(point.y,frame.top+20,frameBottom-20)};
   if(pointInPanel(point)){
    const blockers=panelRects.filter(rect=>point.x>rect.left&&point.x<rect.right&&point.y>rect.top&&point.y<rect.bottom);
    const below=Math.max(...blockers.map(rect=>rect.bottom))+22,above=Math.min(...blockers.map(rect=>rect.top))-22;
    point.y=below<=frameBottom-20?below:Math.max(frame.top+20,above);
   }
   for(const placed of placedMarkers){
    if(Math.abs(placed.x-point.x)<118&&Math.abs(placed.y-point.y)<30)
     point.y=placed.y+34<=frameBottom-20?placed.y+34:placed.y-34;
   }
   placedMarkers.push({x:point.x,y:point.y});
   const angle=Math.atan2(entry.point.y-playerPoint.y,entry.point.x-playerPoint.x)*180/Math.PI;
   const scale=entry.kind==='boss'?1.08:entry.offscreen?clamp(1.08-entry.distance/2800,.84,1.08):.82;
   marker.className='bw-spatial-marker is-visible is-'+entry.kind+(entry.offscreen?' is-offscreen':entry.occluded?' is-occluded':' is-onscreen');
   marker.dataset.family=entry.family||'';
   marker.dataset.count=entry.count>1?'+'+(entry.count-1):'';
   marker.dataset.urgency=entry.kind==='boss'||entry.distance<430?'critical':entry.distance<850?'high':'tracked';
   marker.style.opacity=entry.offscreen?'1':'.92';
   marker.style.transform='translate3d('+point.x.toFixed(1)+'px,'+point.y.toFixed(1)+'px,0) translate(-50%,-50%) scale('+scale.toFixed(2)+')';
   marker.style.setProperty('--bw-marker-angle',angle.toFixed(1)+'deg');
   const arrowRadians=angle*Math.PI/180,arrowHalfH=entry.kind==='boss'?23:19;
   marker.style.setProperty('--bw-marker-arrow-x',(Math.cos(arrowRadians)*(markerHalfW+7)).toFixed(1)+'px');
   marker.style.setProperty('--bw-marker-arrow-y',(Math.sin(arrowRadians)*(arrowHalfH+7)).toFixed(1)+'px');
   setText(marker.querySelector('.bw-marker-badge'),entry.glyph);
   setText(marker.querySelector('.bw-marker-copy strong'),entry.main);
   setText(marker.querySelector('.bw-marker-copy small'),entry.detail);
   const meter=marker.querySelector('.bw-marker-meter'),fill=meter?.querySelector('i');
   if(meter)meter.style.opacity=entry.meter==null?'0':'1';
   if(fill)fill.style.width=Math.round((entry.meter||0)*100)+'%';
  });
  syncActionMotion();
  drawMinimap(lab,s,live);
  const hpNow=Number(player.hp)||0;
  if(lastHeroHp!=null&&hpNow<lastHeroHp-1&&hpNow>0)pulseHeroHit();
  lastHeroHp=hpNow;
  const hpPct=player.maxHp?clamp(player.hp/player.maxHp):1;
  forgeFire.render({fury:s.empowered?1:clamp((Number(s.passiveProgress)||0)/300),hp:hpPct});
  peripheral.style.opacity=String(player.hp>0&&hpPct<=.35?.32+.68*(1-hpPct/.35):0);
 };
 const update=()=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(!pilot)return;
  decorateUpgradeCards();
  const s=pilot.state||{},lab=window.handLab||{},player=lab.player||{},n=Math.max(1,s.wave||1);
  const cluster=Math.floor((n-1)/10)+1,beat=Number.isInteger(s.hudBeatIndex)?clamp(s.hudBeatIndex,0,9):(n-1)%10,
   beatInfo=BEATS[beat]||beatForWave(n),bossBeat=beat===9;
  const newChapter='CLUSTER '+String(cluster).padStart(2,'0')+' · '+(beat+1)+'/10';
  if(newChapter!==lastChapter){chapter.textContent=newChapter;lastChapter=newChapter;}
  const ann=s.announce;
  if(ann&&ann.at!==lastAnnounceAt){lastAnnounceAt=ann.at;
   const aText=announce.querySelector('#bw-announce-text'),aSub=announce.querySelector('#bw-announce-sub');
   if(aText)aText.textContent=ann.text||'';if(aSub)aSub.textContent=ann.sub||'';
   announce.classList.remove('is-show');void announce.offsetWidth;announce.classList.add('is-show');
   window.clearTimeout(announceTimer);
   announceTimer=window.setTimeout(()=>announce.classList.remove('is-show'),1900);
  }
  waveNumber.textContent='WAVE '+String(n).padStart(2,'0');
  center.classList.toggle('bw-is-boss',bossBeat);
  center.classList.toggle('bw-is-upgrade',s.phase==='upgrade');
  center.classList.toggle('bw-is-clear',!!s.autoNextWave);
  const beatKey=beat+(s.autoNextWave?100:0);
  if(beatKey!==lastBeat){for(const [i,el] of [...centerSegment.children].entries()){
   el.classList.toggle('done',i<beat||!!s.autoNextWave&&i<=beat);el.classList.toggle('active',i===beat&&!s.autoNextWave);
  }lastBeat=beatKey;}
  const phase=wave.querySelector('.bw-witness');
  if(phase)phase.textContent=s.autoNextWave?'WAVE CLEAR':bossBeat?'BOSS ROUND':s.phase==='combat'?'IN COMBAT':
   s.phase==='upgrade'?'UPGRADE':s.phase==='gameover'?'BOXE DOWN':'READY';
  setText(beatKicker,s.autoNextWave?'BEAT SEALED':'CLUSTER BEAT');
  setText(beatName,beatInfo.name);setText(beatVerb,beatInfo.verb);setText(beatHint,beatInfo.hint);
  beatCard.dataset.beat=beatInfo.id;center.dataset.beat=beatInfo.id;deck.dataset.beat=beatInfo.id;
  deck.style.setProperty('--bw-beat-accent',beatInfo.accent);
  const enemies=lab.enemies||[];
  const live=enemies.filter(e=>!e.dead&&e.waveGunId);
  const active=live.length,bossLive=live.some(e=>e.waveBoss);
  const queued=s.queue?.length||0;
  const activePressure=live.reduce((sum,e)=>sum+(Number(e.wavePressure)||0),0);
  const queuedPressure=(s.queue||[]).reduce((sum,e)=>sum+(Number(e.pressure)||0),0);
  const budget=Math.max(1,Number(s.pressureBudget)||260);
  const danger=s.autoNextWave?0:Math.min(1,activePressure/budget||active/Math.max(1,s.softCap||5));
  const text=s.autoNextWave?'NEXT '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active+' LIVE · '+queued+' IN · '+Math.round(activePressure)+'/'+Math.round(budget);
  if(text!==lastPressure){pressure.querySelector('strong').textContent=text;lastPressure=text;}
  pressure.style.setProperty('--bw-pressure',danger.toFixed(3));
  pressure.style.setProperty('--bw-inbound-pressure',clamp(queuedPressure/Math.max(1,activePressure+queuedPressure)).toFixed(3));
  center.classList.toggle('bw-under-pressure',danger>=.82);
  center.dataset.danger=danger>=.82?'critical':danger>=.55?'high':danger>=.28?'rising':'calm';
  threat.dataset.danger=center.dataset.danger;
  const hpPct=player.maxHp?clamp(player.hp/player.maxHp):1;
  const breather=!!s.autoNextWave||s.phase==='intermission';
  const focus=breather?'breather':(s.phase==='upgrade'||s.phase==='gameover'||s.phase==='intro')?'cinematic':
   hpPct<=.35&&player.hp>0?'danger':(danger>=.68||active>=5||bossLive)?'hot':'combat';
  deck.dataset.focus=focus;deck.dataset.phase=s.autoNextWave?'wave-clear':(s.phase||'intro');deck.dataset.danger=center.dataset.danger;
  hero.classList.toggle('bw-is-low',left.classList.contains('is-low'));
  hero.classList.toggle('bw-is-hot',left.classList.contains('r2-hot'));
  const level=Math.max(1,Math.floor(Number(s.level)||1)),xpNeed=xpThreshold(pilot,level),xpPct=clamp((Number(s.xp)||0)/Math.max(1,xpNeed));
  const furyPct=s.empowered?1:clamp((Number(s.passiveProgress)||0)/300),ignited=!!s.empowered||!!s.passiveReady||furyPct>=.999;
  const vitalsSignature=[level,Math.floor(Number(s.xp)||0),xpNeed,Math.round(furyPct*100),ignited?'hot':'cold'].join(':');
  if(vitalsSignature!==lastVitalsSignature){
   lastVitalsSignature=vitalsSignature;
   levelCore.style.setProperty('--bw-xp',xpPct.toFixed(3));
   hero.style.setProperty('--bw-fury',furyPct.toFixed(3));
   setText(levelValue,String(level));
   const xpCopy=formatInt(s.xp)+' / '+formatInt(xpNeed)+' XP';
   setText(xpRingLabel,xpCopy.length<=12?xpCopy:Math.round(xpPct*100)+'% XP');
  }
  hero.classList.toggle('bw-is-ignited',ignited);
  hero.dataset.furyState=s.empowered?'empowered':ignited?'ready':furyPct>=.66?'surging':furyPct>=.33?'warming':'cold';
  if(!lastPulseWave)lastPulseWave=n;
  else if(n!==lastPulseWave){lastPulseWave=n;pulseDeck('bw-event-wave',980);}
  if(!lastPulseLevel)lastPulseLevel=level;
  else if(level>lastPulseLevel){lastPulseLevel=level;pulseDeck('bw-event-level',1150);}
  else lastPulseLevel=Math.min(lastPulseLevel,level);
  if(bossLive&&!lastBossPulse)pulseDeck('bw-event-boss',1250);
  lastBossPulse=bossLive;
  if(ignited&&!lastIgnitedPulse)pulseDeck('bw-event-ignite',1100);
  lastIgnitedPulse=ignited;
  deck.style.setProperty('--bw-low-hp',(player.hp>0&&hpPct<=.35?1-hpPct/.35:0).toFixed(3));
  const kills=Number(s.waveKills)||0,dealt=Number(s.waveDamageDealt)||0,taken=Number(s.waveDamageReceived)||0;
  const totalHostiles=kills+active+queued,progress=totalHostiles?kills/totalHostiles:(breather&&n?1:0);
  const momentumScore=clamp(progress*.38+Math.min(.28,dealt/3800)+hpPct*.18+(s.empowered?.16:0)-Math.min(.3,taken/1300));
  const rank=momentumScore>=.82?'S':momentumScore>=.62?'A':momentumScore>=.42?'B':momentumScore>=.22?'C':'D';
  const momentumText='MOMENTUM · '+(breather?'WAVE SEALED':rank==='S'?'APEX FORM':rank==='A'?'SURGING':rank==='B'?'CONTROL':rank==='C'?'BUILDING':'UNDER FIRE');
  if(momentum&&(rank!==lastRank||momentumText!==lastMomentumText)){
   momentum.dataset.rank=rank;setText(momentum,rank);
   momentum.title=momentumText;setText(momentumCopy,momentumText);
   lastRank=rank;lastMomentumText=momentumText;
  }
  const forecastWave=breather?(Number(s.wave)||0)+1:n;
  if(forecastWave!==forecastCacheWave){forecastCache=nextWavePlan(pilot,forecastWave);if(forecastCache)forecastCacheWave=forecastWave;}
  const forecastBeat=beatForWave(forecastWave);
  const forecastCounts=new Map();
  for(const entry of forecastCache?.composition||[])forecastCounts.set(entry.family,(forecastCounts.get(entry.family)||0)+1);
  const forecastFamilies=[...forecastCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3)
   .map(([family,count])=>(FAMILY_SHORT[family]||family)+' ×'+count).join(' · ');
  const forecastNew=(forecastCache?.newWeapons||[]).slice(0,2).join(' + ');
  setText(oracleTitle,'WAVE '+String(forecastWave).padStart(2,'0')+' · '+forecastBeat.name);
  setText(oracleDetail,forecastBeat.verb+' · '+(PATTERN_LABEL[forecastCache?.pattern]||PATTERN_LABEL[forecastBeat.pattern]||'GATES SYNCING'));
  setText(oracleFamilies,(forecastFamilies||'HOSTILE MIX SYNCING')+(forecastNew?' · NEW '+forecastNew:''));
  oracle.classList.toggle('is-open',focus==='breather');
  oracle.dataset.beat=forecastBeat.id;
  const nextGate=s.queue?.[0];
  threat.dataset.intelMode=live.length||queued?'live':'forecast';
  setText(minimapMode,bossLive?'BOSS':breather?'NEXT GATE':danger>=.82?'RED ZONE':'LIVE');
  setText(minimapNext,nextGate?
   (nextGate.edge||'gate').toUpperCase()+' · '+(nextGate.gun||'HOSTILE')+' · '+((Number(s.spawnT)||0)>0?Math.max(0,Number(s.spawnT)||0).toFixed(1)+'s':'HOLD'):
   breather?'WAVE '+String(forecastWave).padStart(2,'0')+' · '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active?'ARENA LIVE':'GATES QUIET');
  const guardState=s.guardHeld?'held':(s.guardCdT>0?'cooling':'ready');
  deck.dataset.guard=guardState;
  lastGuardState=guardState;
  status.dataset.kind=(Number(s.waveToastT)>0&&s.waveToast)?'toast':'hint';
  syncPauseMenu();
  updateSpatial();
 };
 const spatialLoop=timestamp=>{
  if(!lastSpatialAt||timestamp-lastSpatialAt>=33){try{updateSpatial();}catch(_){}lastSpatialAt=timestamp;}
  spatialFrame=window.requestAnimationFrame(spatialLoop);
 };
 update();
 if(typeof window.requestAnimationFrame==='function')spatialFrame=window.requestAnimationFrame(spatialLoop);
 refresh=window.setInterval(update,90);
 window.addEventListener('pagehide',()=>{if(refresh)clearInterval(refresh);if(spatialFrame)window.cancelAnimationFrame?.(spatialFrame);if(heroHitTimer)clearTimeout(heroHitTimer);if(pauseConfirmTimer)clearTimeout(pauseConfirmTimer);for(const timer of eventTimers.values())clearTimeout(timer);for(const motion of actionMotion.values()){if(motion.readyTimer)clearTimeout(motion.readyTimer);if(motion.unlockTimer)clearTimeout(motion.unlockTimer);}cardObserver?.disconnect?.();forgeFire.dispose();},{once:true});
 installed=true;
 window.APEX_BOT_WAVE_INTERFACE_V2=Object.freeze({installed:true,version:VERSION,
  fireRenderer:()=>forgeFire.mode,
  openPauseMenu:()=>setPauseFromInterface(true),closePauseMenu:()=>setPauseFromInterface(false),
  togglePauseMenu:()=>setPauseFromInterface(!window.handLab?.paused)});
 doc.documentElement.dataset.botWavePresentation='gold-v2';
 return true;
}
if(!install()){
 const watch=new MutationObserver(()=>{if(install())watch.disconnect()});
 watch.observe(doc.documentElement,{subtree:true,childList:true});
 window.setTimeout(()=>watch.disconnect(),25000);
}
})(window);
