/* ============================================================================
   BLACK_HOLE battle sandbox — engine layer.
   GLSL below is injected at build time from the APPROVED golden prototype
   (docs/blackhole-playtest/golden/01_GOLDEN_BASELINE.html) — see
   tools/blackholeSandbox/build.mjs. The material systems are reused verbatim;
   only the documented battle-scale patches are applied.
   ============================================================================ */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const fail = msg => { const e = $('err'); e.style.display = 'flex'; e.textContent = 'BLACK_HOLE battle sandbox could not start:\n\n' + msg; };

/* ---- golden motion math (verbatim helpers) ---- */
const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const easeIn = x => { x = clamp01(x); return x * x * x; };
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (e0, e1, x) => ease((x - e0) / (e1 - e0));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
const rand = rnd;  // production helper name (drawSketchBlob port)

/* ================= golden GLSL (verbatim, injected) ================= */
const COMMON = `/*@@COMMON@@*/`;
const VS_TRI = `/*@@VS_TRI@@*/`;
/* Golden material systems (cosmic interior, rupture eyes, matter sheets,
   shards, noise toolkit) — patched for battle compositing by the builder. */
const FS_SCENE_HEAD = `/*@@FS_SCENE_HEAD@@*/`;
/* Battle composition main(): same layering as the golden main() (head → eyes
   → eye light → brow/streams/tension → matter sheets OVER eyes → flank
   stress → shards), restructured to emit premultiplied coverage so the head
   composites over the arena instead of black. */
const BATTLE_SCENE_MAIN = `
void main(){
  PX = 1.0/uScale;
  vec2 p = (gl_FragCoord.xy - uCenter)/uScale;
  vec2 hp = rot(uSwayR)*(p - uSway)/uBreath;
  float rC = length(hp);
  vec3 add = vec3(0.7,0.72,1.0)*starLayer(p*22.0 + 91.0, PX*22.0, 9.0)*0.16;
  vec4 ov = vec4(0.0);
  if(rC < 1.3){
    float E = eggE(hp); float fE = E/0.5;
    vec3 cs = cosmos(hp, fE);
    float faceM = 1.0 - smoothstep(0.97, 1.1, fE);
    float headM = 1.0 - smoothstep(0.84, 0.97, length(hp*vec2(1.05,0.97)));
    vec3 inner = cs*mix(0.3, 1.0, faceM);
    inner *= mix(1.0, 0.55, smoothstep(0.78, 1.0, fE)*faceM);
    inner += L(vec3(0.3,0.14,0.62))*exp(-abs(fE - 1.0)*14.0)*0.05*faceM;
    inner *= mix(1.0, 0.74, uVuln);                       // exposed: shell thins
    ov = vec4(inner*headM, headM);
    float spR, spL, dR, dL;
    vec3 eR = eyeShade(hp, 1.0, spR, dR);
    vec3 eL = eyeShade(hp, -1.0, spL, dL);
    ov.rgb += eR + eL;
    ov.rgb += cs*(spR + spL)*3.0*faceM;
    ov.rgb += L(vec3(0.68,0.28,1.0))*browRidge(hp, fE)*uEye*(1.0 - 0.6*uBlink)*1.3;
    ov.rgb += eyeStreams(hp);
    float dc = length(hp - SC);
    ov.rgb += L(vec3(0.55,0.3,1.0))*uTension*exp(-dc*9.0)*0.25;
    if(rC > 0.33){
      vec2 bp = SC + (hp - SC)*(1.0 + uSuck*0.32*exp(-length(hp - SC)*2.2));
      float rB = length(bp);
      float rI = (0.5 - 0.07*uGrowth)*rB/max(eggE(bp), 1e-3);
      float rO = (0.9 + 0.42*uGrowth)*rB/max(length(bp*vec2(1.05,0.97)), 1e-3);
      float s = (rB - rI)/max(rO - rI, 1e-3);
      s += 0.025*sin(uTime*0.37 + atan(bp.y, bp.x)*2.0);
      vec2 E0 = vec2(sign(bp.x)*0.22, -0.29);
      vec2 te = E0 - bp; float de = length(te);
      vec3 eyeL = vec3(te/max(de,1e-3), uEye*exp(-de*4.2)*0.9*(1.0 - 0.5*uBlink));
      vec4 bk = bandSheet(bp, rB, s, uBandPhase*0.62, 0.9 + uSuck*0.8, 2.1, -0.08, 0.0, 3.0, false, 0.34, eyeL);
      ov = overC(ov, vec4(bk.rgb, bk.a*0.94*(1.0 - 0.35*uVuln)));
      vec4 md = bandSheet(bp, rB, s, uBandPhase, 1.4 + uSuck*1.6, 2.7, -0.12*uEscrow, 0.22, 0.0, true, 1.0, eyeL);
      ov = overC(ov, vec4(md.rgb, md.a*(1.0 - 0.45*uVuln)));
      vec4 fr = bandSheet(bp, rB, s + 0.07, uBandPhase*1.45, 2.0 + uSuck*2.2, 3.3, -0.6, 0.38, 7.0, false, 1.15, eyeL);
      ov = overC(ov, vec4(fr.rgb, fr.a*(1.0 - 0.5*uVuln)));
      float angTop = abs(atan(hp.x, hp.y));
      float wave = 0.55 + 0.45*sin(angTop*6.0 + uTime*2.2);
      float halo = exp(-max(rC - 0.84, 0.0)*7.0)*smoothstep(0.62, 0.86, rC);
      add += L(vec3(0.6,0.22,1.0))*halo*uStress*wave*0.55;
    }
    add += L(vec3(0.6,0.22,1.0))*exp(-abs(fE - 1.0)*26.0)*uStress*0.35;
    if(uVuln > 0.003){                                    // exposed shell fractures
      vec2 cf = vor2(hp*26.0);
      float crack = exp(-(cf.y - cf.x)*30.0);
      add += L(vec3(0.55,0.3,1.0))*crack*uVuln*smoothstep(1.07, 0.92, fE)*smoothstep(0.85, 0.97, fE)*1.1;
      add += L(vec3(0.35,0.15,0.6))*uVuln*smoothstep(0.9, 1.0, fE)*0.22;
    }
    add += L(vec3(0.75,0.5,1.0))*uHitFlash*(exp(-abs(fE - 1.0)*10.0)*0.85 + 0.10)*faceM;
    ov = shards(hp, ov);
  }
  ov.rgb *= (1.0 - uKo*0.85);
  fragColor = vec4(ov.rgb + add, ov.a);
}`;
const FS_SCENE = FS_SCENE_HEAD + BATTLE_SCENE_MAIN;

/* Golden particle shaders (head dust/motes — verbatim). */
const VS_PART = `/*@@VS_PART@@*/`;
const FS_PART = `/*@@FS_PART@@*/`;
/* Golden bloom + final composite (verbatim). */
const FS_DOWN = `/*@@FS_DOWN@@*/`;
const FS_BLUR = `/*@@FS_BLUR@@*/`;
const FS_FINAL = `/*@@FS_FINAL@@*/`;

/* ================= battle shaders (new, same visual language) ================= */

/* Chamber01 arena blit: the production paintChamber01() output (rendered once
   to a canvas with the exact production painter) drawn through the battle camera. */
const FS_ARENA = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uCam;
uniform float uZoom, uTime;
out vec4 o;
void main(){
  vec2 w = vec2((gl_FragCoord.x - uCam.x)/uZoom, (uCam.y - gl_FragCoord.y)/uZoom);
  if(w.x < -1.0 || w.y < -1.0 || w.x > 1001.0 || w.y > 1001.0){
    vec2 c = (w - vec2(500.0))/700.0;
    o = vec4(vec3(0.016,0.014,0.022)*(1.0 - dot(c,c)*0.55), 1.0);
    return;
  }
  vec2 uv = clamp(w, vec2(0.0), vec2(1000.0))/1000.0;
  vec3 col = texture(uTex, uv).rgb;
  float ex = max(abs(w.x-500.0), abs(w.y-500.0));
  col *= 1.0 - smoothstep(488.0, 500.0, ex)*0.35;
  o = vec4(col, 1.0);
}`;

/* Premultiplied world sprite (bot / pickups). */
const VS_SPRITE = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform vec2 uRes, uPos, uHalf;
uniform float uRot;
out vec2 vUv;
void main(){
  float c = cos(uRot), s = sin(uRot);
  vec2 q = vec2(c*aCorner.x - s*aCorner.y, s*aCorner.x + c*aCorner.y)*uHalf;
  gl_Position = vec4((uPos + q)/uRes*2.0 - 1.0, 0.0, 1.0);
  vUv = aCorner*0.5 + 0.5;
}`;
const FS_SPRITE = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec4 uTint;
in vec2 vUv; out vec4 o;
void main(){
  vec4 t = texture(uTex, vUv);
  o = vec4(t.rgb*uTint.rgb, t.a*uTint.a);
}`;

/* World VFX points — golden FS_PART grammar, world-space positions. */
const VS_WPOINT = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec3 aData;
layout(location=2) in vec3 aCol;
uniform vec2 uRes;
out vec3 vCol; out float vA;
void main(){
  gl_Position = vec4(aPos/uRes*2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aData.x;
  vCol = mix(aCol, vec3(1.0,0.93,1.0), aData.z);
  vA = aData.y;
}`;
const FS_WPOINT = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; out vec4 o;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float d = dot(c,c);
  if(d > 1.0) discard;
  o = vec4(vCol*(exp(-d*3.5)*vA), 1.0);
}`;

/* World VFX soft beams (bullet tracers, suction streaks, crush lances). */
const VS_WLINE = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec3 aAux;   // lateral -1..1, alpha, soft
layout(location=2) in vec3 aCol;
uniform vec2 uRes;
out vec3 vCol; out float vA; out float vSoft; out float vLat;
void main(){
  gl_Position = vec4(aPos/uRes*2.0 - 1.0, 0.0, 1.0);
  vCol = aCol; vA = aAux.y; vSoft = aAux.z; vLat = aAux.x;
}`;
const FS_WLINE = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; in float vSoft; in float vLat; out vec4 o;
void main(){
  float d = abs(vLat);
  float core = exp(-d*d*5.0);
  float glow = exp(-d*2.6)*0.34;
  o = vec4(vCol*((core + glow*vSoft)*vA), 1.0);
}`;

/* Multi-singularity spacetime lens. The golden single-slot LENS math
   (signed collapse/rebound map, frame dragging, refractive shock front,
   motion streaks, horizon dimming, log-polar accretion inflow, photon ring,
   flash, pre-birth tension pinprick) applied to up to 5 simultaneous
   singularities: [0] head forehead seat, [1..4] world singularities.
   Radial warps compose analytically; additive terms apply per slot.
   (Golden single-slot reference preserved at @@FS_LENS_GOLDEN_REF@@.) */
const FS_LENS = `#version 300 es
${COMMON}
out vec4 o;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform int uNSing;
uniform vec2 uC[5];
uniform float uScaleA[5], uRs[5], uK[5], uSpin[5], uSuck[5];
uniform float uShockR[5], uShockA[5], uFlash[5], uAccP[5], uAccIn[5], uTensionA[5], uHot[5];
uniform float uTime;
vec3 sampPx(vec2 px){ return texture(uScene, px/uRes).rgb; }
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag;
  for(int i=0;i<5;i++){
    if(i >= uNSing) break;
    vec2 p = (frag - uC[i])/uScaleA[i];
    float r = length(p) + 1e-6; vec2 dir = p/r;
    float K2 = uK[i]*abs(uK[i]);
    float rsrc = sqrt(max(r*r + K2, 0.0));
    float rs = uRs[i];
    float drag = uSpin[i]*(max(K2,0.0) + 0.35*rs*rs)/(r*r + 0.35*abs(K2) + 0.25*rs*rs + 1e-4);
    float x = (r - uShockR[i])/0.07;
    rsrc += uShockA[i]*x*exp(-x*x)*0.035;
    uv = uC[i] + rot(drag)*dir*rsrc*uScaleA[i];
  }
  vec3 col = sampPx(uv);
  for(int i=0;i<5;i++){
    if(i >= uNSing) break;
    vec2 p = (frag - uC[i])/uScaleA[i];
    float r = length(p) + 1e-6; vec2 dir = p/r;
    float K2 = uK[i]*abs(uK[i]);
    float rsrc = sqrt(max(r*r + K2, 0.0));
    float rs = uRs[i];
    float PX = 1.0/uScaleA[i];
    float drag = uSpin[i]*(max(K2,0.0) + 0.35*rs*rs)/(r*r + 0.35*abs(K2) + 0.25*rs*rs + 1e-4);
    float streak = uSuck[i]*smoothstep(1.05, 0.12, r);
    if(streak > 0.002){
      vec3 tr = vec3(0.0), av = col; float ws = 0.0, wa = 1.0;
      for(int k=1;k<10;k++){
        float fi = float(k)/9.0;
        float kk = fi*streak;
        float ang = drag + kk*0.5*(0.1/(r + 0.06));
        vec3 s = sampPx(uC[i] + rot(ang)*dir*rsrc*(1.0 + kk*0.22)*uScaleA[i]);
        float w = exp(-fi*2.2);
        tr += max(s - 0.12, 0.0)*w; ws += w;
        av += s*w; wa += w;
      }
      col = mix(col, av/wa, 0.3*streak);
      col += tr/ws*streak*1.1;
    }
    if(rs > 0.0008){
      float lr = log(r/rs);
      col *= mix(1.0, smoothstep(0.0, 0.55, lr), 0.6);
      float a = atan(p.y, p.x)/TAU;
      float su = (a - 0.32*lr + uAccP[i])*6.0;
      float sv = lr*4.5 + uAccIn[i];
      float n = pfbm(vec2(su, sv), 6.0, 4);
      float n2 = pnoise(vec2(su*2.0 + 3.0, sv*2.2), 12.0);
      float prof = smoothstep(-0.02, 0.18, lr)*exp(-max(lr, 0.0)*1.7);
      float heat = exp(-max(lr, 0.0)*2.4);
      vec3 accC = mix(L(vec3(0.45,0.16,0.95)), vec3(1.0,0.9,1.0), heat*0.85);
      float dens = smoothstep(-0.2, 0.45, n + n2*0.25);
      float open01 = smoothstep(0.0, 0.5, rs/0.125);
      col += accC*prof*dens*(0.5 + 2.2*heat)*(0.25 + 0.95*uSuck[i])*open01*uHot[i];
      float w1 = rs*0.028 + PX*0.9;
      float x1 = (r - rs*1.075)/w1;
      float x2 = (r - rs*1.2)/(rs*0.07);
      float pr = exp(-x1*x1);
      float pr2 = exp(-x2*x2);
      float beam = 0.7 + 0.5*cos(TAU*a + 1.2 - uTime*0.5);
      col += (vec3(1.0,0.9,1.0)*pr*2.6*beam + L(vec3(0.7,0.4,1.0))*pr2*0.5)*open01*uHot[i];
      col *= smoothstep(rs - PX*1.2, rs + PX*1.2, r);
    }
    float rr = r*r;
    col += vec3(1.0,0.9,1.0)*uFlash[i]*exp(-rr/0.0012)*6.0;
    col += L(vec3(0.62,0.25,1.0))*uFlash[i]*exp(-r*7.0)*0.9;
    col += L(vec3(0.8,0.5,1.0))*uTensionA[i]*(1.0 - smoothstep(0.0, 0.01, rs))*exp(-rr/0.0005)*2.2;
  }
  o = vec4(col, 1.0);
}`;

/* ================= GL plumbing (golden) ================= */
const canvas = $('gl');
const gl = canvas.getContext('webgl2', { antialias:false, alpha:false, depth:false, stencil:false, premultipliedAlpha:false, powerPreference:'high-performance' });
if (!gl) { fail('WebGL2 is not available in this browser.'); return; }
let hasFloat = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); fail(log); throw new Error(log); }
  return s;
}
function program(vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); fail(log); throw new Error(log); }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
let P_SCENE, P_LENS, P_PART, P_DOWN, P_BLUR, P_FINAL, P_ARENA, P_SPRITE, P_WPOINT, P_WLINE;
try {
  P_SCENE  = program(VS_TRI, FS_SCENE);
  P_LENS   = program(VS_TRI, FS_LENS);
  P_PART   = program(VS_PART, FS_PART);
  P_DOWN   = program(VS_TRI, FS_DOWN);
  P_BLUR   = program(VS_TRI, FS_BLUR);
  P_FINAL  = program(VS_TRI, FS_FINAL);
  P_ARENA  = program(VS_TRI, FS_ARENA);
  P_SPRITE = program(VS_SPRITE, FS_SPRITE);
  P_WPOINT = program(VS_WPOINT, FS_WPOINT);
  P_WLINE  = program(VS_WLINE, FS_WLINE);
} catch (e) { console.error(e); return; }

const triVAO = gl.createVertexArray();
gl.bindVertexArray(triVAO);
const triBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);
const drawTri = () => { gl.bindVertexArray(triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); };

function makeTarget(w, h){
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (hasFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok && hasFloat) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); hasFloat = false; return makeTarget(w, h); }
  return { tex, fb, w, h };
}
function freeTarget(t){ if (!t) return; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }

let CW = 0, CH = 0, W = 0, H = 0, quality = 1;
let tScene, tLens, bl = [], bt = [];
function buildTargets(){
  freeTarget(tScene); freeTarget(tLens); bl.forEach(freeTarget); bt.forEach(freeTarget);
  tScene = makeTarget(W, H); tLens = makeTarget(W, H); bl = []; bt = [];
  for (let i = 0; i < 4; i++) {
    const w = Math.max(2, Math.floor(W / Math.pow(2, i + 1))), h = Math.max(2, Math.floor(H / Math.pow(2, i + 1)));
    bl.push(makeTarget(w, h)); bt.push(makeTarget(w, h));
  }
}
const ovCanvas = $('ov');
const ovx = ovCanvas.getContext('2d');
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CW = Math.max(2, Math.floor(innerWidth * dpr)); CH = Math.max(2, Math.floor(innerHeight * dpr));
  canvas.width = CW; canvas.height = CH;
  ovCanvas.width = CW; ovCanvas.height = CH;
  let w = CW * quality, h = CH * quality;
  const maxPix = 1.1e6;
  if (w * h > maxPix) { const k = Math.sqrt(maxPix / (w * h)); w *= k; h *= k; }
  W = Math.max(2, Math.floor(w)); H = Math.max(2, Math.floor(h));
  buildTargets();
}
window.addEventListener('resize', resize);

/* ================= camera (production law: full-arena transform + shake/zoom) ================= */
const GAME_SIZE = 1000;
const cam = { x: 500, y: 500, shake: 0, punch: 0, mode: 'full', fx: 500, fy: 500 };
function fitScale(){ return Math.min(W, H) / GAME_SIZE; }
let camShX = 0, camShY = 0, camAx = 0, camAy = 0, camZ = 1;
function updateCamera(dt){
  cam.shake = Math.max(0, cam.shake - dt * 22);
  cam.punch *= Math.exp(-dt * 5);
  const fit = fitScale();
  const zoom = (cam.mode === 'follow' ? fit * 1.55 : fit) * (1 + cam.punch);
  if (cam.mode === 'follow'){
    cam.fx += ((BH ? BH.x : 500) - cam.fx) * Math.min(1, dt * 3.2);
    cam.fy += ((BH ? BH.y : 500) - cam.fy) * Math.min(1, dt * 3.2);
    const halfW = W / (2 * zoom), halfH = H / (2 * zoom);
    cam.fx = clamp(cam.fx, halfW - 140, GAME_SIZE - halfW + 140);
    cam.fy = clamp(cam.fy, halfH - 140, GAME_SIZE - halfH + 140);
    cam.x = cam.fx; cam.y = cam.fy;
  } else { cam.x = 500; cam.y = 500; }
  camZ = zoom;
  camShX = (Math.random()*2-1) * cam.shake;
  camShY = (Math.random()*2-1) * cam.shake;
  camAx = W/2 - cam.x*camZ + camShX;
  camAy = H/2 + cam.y*camZ - camShY;
}
function w2gl(x, y){ return [x*camZ + camAx, -y*camZ + camAy]; }           // FBO px (y-up)
function w2s(x, y){ return [(x - cam.x)*camZ + W/2 + camShX, (y - cam.y)*camZ + H/2 + camShY]; } // overlay px

/* ================= static textures (painted once) ================= */
function canvasTex(cv, flip){
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* Chamber01 — EXACT production painter (public/game/modes/arsenalQuestRuntime.js
   ::paintChamber01), ported verbatim to this standalone page. */
function paintChamber01(c, S){
  c.save();
  c.fillStyle = '#626A74';
  c.fillRect(0, 0, S, S);
  const grad = c.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
  grad.addColorStop(0, 'rgba(114,123,134,0.78)');
  grad.addColorStop(1, 'rgba(79,87,97,0.92)');
  c.fillStyle = grad;
  c.fillRect(0, 0, S, S);
  c.strokeStyle = 'rgba(12,14,18,0.22)';
  c.lineWidth = 1;
  for (let g = 125; g < S; g += 125) {
    c.beginPath(); c.moveTo(g, 40); c.lineTo(g, S - 40); c.stroke();
    c.beginPath(); c.moveTo(40, g); c.lineTo(S - 40, g); c.stroke();
  }
  c.strokeStyle = 'rgba(10,12,16,0.38)';
  c.lineWidth = 2;
  for (let g = 100; g < S; g += 100) {
    c.beginPath(); c.moveTo(g, 34); c.lineTo(g, 46); c.stroke();
    c.beginPath(); c.moveTo(g, S - 46); c.lineTo(g, S - 34); c.stroke();
    c.beginPath(); c.moveTo(34, g); c.lineTo(46, g); c.stroke();
    c.beginPath(); c.moveTo(S - 46, g); c.lineTo(S - 34, g); c.stroke();
  }
  c.strokeStyle = 'rgba(18,20,24,0.28)';
  c.lineWidth = 2;
  c.beginPath(); c.arc(S / 2, S / 2, 62, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  c.moveTo(S / 2 - 88, S / 2); c.lineTo(S / 2 - 40, S / 2);
  c.moveTo(S / 2 + 40, S / 2); c.lineTo(S / 2 + 88, S / 2);
  c.moveTo(S / 2, S / 2 - 88); c.lineTo(S / 2, S / 2 - 40);
  c.moveTo(S / 2, S / 2 + 40); c.lineTo(S / 2, S / 2 + 88);
  c.stroke();
  c.fillStyle = '#3C434C';
  c.fillRect(0, 0, S, 30); c.fillRect(0, S - 30, S, 30);
  c.fillRect(0, 0, 30, S); c.fillRect(S - 30, 0, 30, S);
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 2;
  for (let g = 0; g <= S; g += 125) {
    c.beginPath(); c.moveTo(g, 0); c.lineTo(g, 30); c.stroke();
    c.beginPath(); c.moveTo(g, S - 30); c.lineTo(g, S); c.stroke();
    c.beginPath(); c.moveTo(0, g); c.lineTo(30, g); c.stroke();
    c.beginPath(); c.moveTo(S - 30, g); c.lineTo(S, g); c.stroke();
  }
  c.strokeStyle = '#2C3239';
  c.lineWidth = 6;
  c.strokeRect(30, 30, S - 60, S - 60);
  c.strokeStyle = 'rgba(255,255,255,0.05)';
  c.lineWidth = 2;
  c.strokeRect(36, 36, S - 72, S - 72);
  c.strokeStyle = 'rgba(255,255,255,0.045)';
  c.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    c.beginPath(); c.moveTo(52 + i * 10, 52); c.lineTo(52 + i * 10, 84); c.stroke();
    c.beginPath(); c.moveTo(S - 84 + i * 10, S - 84); c.lineTo(S - 84 + i * 10, S - 52); c.stroke();
  }
  c.restore();
}
const arenaTex = (() => {
  const cv = mkCanvas(GAME_SIZE, GAME_SIZE);
  const c = cv.getContext('2d', { alpha: false });
  paintChamber01(c, GAME_SIZE);
  return canvasTex(cv, false);
})();

/* drawSketchBlob — production helper (public/game/core/apexRenderPrimitives.js). */
function drawSketchBlob(ctx, r, color, seed = 10) {
  ctx.save();
  ctx.beginPath();
  const TAU2 = Math.PI * 2;
  for (let i=0; i<=seed; i++) {
    const a = i / seed * TAU2;
    const jitter = 0.88 + 0.14 * Math.sin(i*2.17 + r) + 0.06 * Math.cos(i*5.1);
    const rr = r * jitter;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 6;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let i=0; i<4; i++) {
    ctx.beginPath();
    ctx.moveTo(rand(-r*0.55,r*0.2), rand(-r*0.55,r*0.55));
    ctx.lineTo(rand(-r*0.15,r*0.65), rand(-r*0.55,r*0.55));
    ctx.stroke();
  }
  ctx.restore();
}
/* RIVAL bot sprite — arsenal blank-fighter grammar (sketch blob + heading
   arrow) plus a visor so it reads as an opponent, not a rock. */
function makeBotSprite(){
  const S = 220, cv = mkCanvas(S, S), c = cv.getContext('2d');
  c.translate(S/2, S/2);
  drawSketchBlob(c, 75, '#ff7043', 17);
  c.fillStyle = '#1b1a16';
  c.beginPath();
  c.moveTo(75*0.55, 0); c.lineTo(75*0.18, -12); c.lineTo(75*0.18, 12);
  c.closePath(); c.fill();
  c.fillStyle = '#241109';
  c.beginPath(); c.ellipse(16, -20, 26, 13, -0.28, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(16, 20, 26, 13, 0.28, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ffe9d2';
  c.beginPath(); c.ellipse(24, -20, 9, 4.5, -0.28, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(24, 20, 9, 4.5, 0.28, 0, Math.PI*2); c.fill();
  return canvasTex(cv, true);
}
function makeOrbSprite(){
  const S = 128, cv = mkCanvas(S, S), c = cv.getContext('2d');
  c.translate(S/2, S/2);
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(0, 0, 42, 0, Math.PI*2); c.stroke();
  const g = c.createRadialGradient(0, 0, 2, 0, 0, 34);
  g.addColorStop(0, '#eaffff'); g.addColorStop(0.35, '#4fc3f7'); g.addColorStop(1, 'rgba(20,60,90,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, 34, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#eafcff'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -10); c.lineTo(0, 10); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
  return canvasTex(cv, true);
}
const botTex = makeBotSprite(), orbTex = makeOrbSprite();

/* ================= sprite batch (bot, pickups) ================= */
const SPR_MAX = 24;
const sprQuad = new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]);
const sprVAO = gl.createVertexArray();
gl.bindVertexArray(sprVAO);
const sprBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf);
gl.bufferData(gl.ARRAY_BUFFER, sprQuad.byteLength, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
gl.bindVertexArray(null);
const sprites = [];
function pushSprite(tex, wx, wy, halfW, halfH, rot, tr, tg, tb, ta){
  if (sprites.length >= SPR_MAX) return;
  sprites.push({ tex, wx, wy, halfW, halfH, rot, t: [tr, tg, tb, ta] });
}
function drawSprites(){
  if (!sprites.length) return;
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(P_SPRITE.p);
  gl.uniform2f(P_SPRITE.u.uRes, W, H);
  gl.uniform1i(P_SPRITE.u.uTex, 0);
  let lastTex = null;
  for (const s of sprites){
    const [gx, gy] = w2gl(s.wx, s.wy);
    if (s.tex !== lastTex){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); lastTex = s.tex; }
    gl.uniform2f(P_SPRITE.u.uPos, gx, gy);
    gl.uniform2f(P_SPRITE.u.uHalf, s.halfW*camZ, s.halfH*camZ);
    gl.uniform1f(P_SPRITE.u.uRot, s.rot);
    gl.uniform4f(P_SPRITE.u.uTint, s.t[0], s.t[1], s.t[2], s.t[3]);
    gl.bindVertexArray(sprVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprQuad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  sprites.length = 0;
  gl.disable(gl.BLEND);
}

/* ================= world VFX batches (points + soft lines) ================= */
class WFXBatch {
  constructor(maxPts, maxLn){
    this.maxPts = maxPts; this.maxLn = maxLn;
    this.pt = new Float32Array(maxPts * 8);
    this.ln = new Float32Array(maxLn * 6 * 8);
    this.ptN = 0; this.lnN = 0;
    const mk = (data) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
      gl.bindVertexArray(null); return { vao, buf };
    };
    this.ptG = mk(this.pt); this.lnG = mk(this.ln);
  }
  clear(){ this.ptN = 0; this.lnN = 0; }
  ptRaw(gx, gy, size, alpha, heat, r, g, b){
    if (this.ptN >= this.maxPts) return;
    const o = this.ptN*8;
    this.pt[o]=gx; this.pt[o+1]=gy; this.pt[o+2]=size; this.pt[o+3]=alpha; this.pt[o+4]=heat;
    this.pt[o+5]=r; this.pt[o+6]=g; this.pt[o+7]=b; this.ptN++;
  }
  lnRaw(x1, y1, x2, y2, width, a1, a2, soft, r, g, b){
    if (this.lnN >= this.maxLn) return;
    const dx = x2-x1, dy = y2-y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy/L*width, ny = dx/L*width;
    const base = this.lnN*6*8;
    const V = [
      [x1+nx, y1+ny, -1, a1], [x1-nx, y1-ny, -1, a1], [x2-nx, y2-ny, 1, a2],
      [x1+nx, y1+ny, -1, a1], [x2-nx, y2-ny, 1, a2], [x2+nx, y2+ny, 1, a2],
    ];
    for (let i=0;i<6;i++){
      const v = V[i], o = base + i*8;
      this.ln[o]=v[0]; this.ln[o+1]=v[1]; this.ln[o+2]=v[2]; this.ln[o+3]=v[3]; this.ln[o+4]=soft;
      this.ln[o+5]=r; this.ln[o+6]=g; this.ln[o+7]=b;
    }
    this.lnN++;
  }
  wpt(x, y, size, alpha, heat, r, g, b){
    const [gx, gy] = w2gl(x, y);
    this.ptRaw(gx, gy, Math.max(1, size*camZ), alpha, heat, r, g, b);
  }
  wln(x1, y1, x2, y2, width, a1, a2, soft, r, g, b){
    const [ax, ay] = w2gl(x1, y1), [bx, by] = w2gl(x2, y2);
    this.lnRaw(ax, ay, bx, by, Math.max(0.65, width*camZ*0.5), a1, a2, soft, r, g, b);
  }
  ring(x, y, radius, width, alpha, r, g, b, segs = 26){
    for (let i=0;i<segs;i++){
      const a0 = i/segs*Math.PI*2, a1 = (i+1)/segs*Math.PI*2;
      this.wln(x+Math.cos(a0)*radius, y+Math.sin(a0)*radius, x+Math.cos(a1)*radius, y+Math.sin(a1)*radius, width, alpha, alpha, 1, r, g, b);
    }
  }
  draw(){
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    if (this.ptN){
      gl.useProgram(P_WPOINT.p); gl.uniform2f(P_WPOINT.u.uRes, W, H);
      gl.bindVertexArray(this.ptG.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ptG.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pt, 0, this.ptN*8);
      gl.drawArrays(gl.POINTS, 0, this.ptN);
    }
    if (this.lnN){
      gl.useProgram(P_WLINE.p); gl.uniform2f(P_WLINE.u.uRes, W, H);
      gl.bindVertexArray(this.lnG.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lnG.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ln, 0, this.lnN*6*8);
      gl.drawArrays(gl.TRIANGLES, 0, this.lnN*6);
    }
    gl.disable(gl.BLEND);
  }
}
const bScene = new WFXBatch(600, 700);   // pre-lens  (bullets — get lensed)
const bPost  = new WFXBatch(2400, 1500); // post-lens (emissive VFX)

/* ================= singularity slot packing ================= */
const MAX_SING = 5;
const singC = new Float32Array(MAX_SING*2);
const singScale = new Float32Array(MAX_SING);
const singRs = new Float32Array(MAX_SING);
const singK = new Float32Array(MAX_SING);
const singSpin = new Float32Array(MAX_SING);
const singSuck = new Float32Array(MAX_SING);
const singShockR = new Float32Array(MAX_SING);
const singShockA = new Float32Array(MAX_SING);
const singFlash = new Float32Array(MAX_SING);
const singAccP = new Float32Array(MAX_SING);
const singAccIn = new Float32Array(MAX_SING);
const singTension = new Float32Array(MAX_SING);
const singHot = new Float32Array(MAX_SING);
let singCount = 0;
function packSing(i, wx, wy, scalePx, rs, K, spin, suck, shockT, shockA, flash, accP, accIn, tension, hot){
  const [gx, gy] = w2gl(wx, wy);
  singC[i*2] = gx; singC[i*2+1] = gy;
  singScale[i] = scalePx; singRs[i] = rs; singK[i] = K; singSpin[i] = spin; singSuck[i] = suck;
  singShockR[i] = shockT; singShockA[i] = shockT < 3 ? shockA * Math.exp(-shockT*1.4) : 0;
  singFlash[i] = flash; singAccP[i] = accP; singAccIn[i] = accIn; singTension[i] = tension; singHot[i] = hot;
}

/* ================= render pipeline ================= */
function bindTarget(t){ gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : CW, t ? t.h : CH); }
function tex(P, name, unit, t){ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u[name], unit); }
const u1 = (P, n, v) => { if (P.u[n] != null) gl.uniform1f(P.u[n], v); };
const u2 = (P, n, a, b) => { if (P.u[n] != null) gl.uniform2f(P.u[n], a, b); };

let caU = 0.5, caV = 0.5, maxFlash = 0;

function renderWorld(){
  /* 1. arena (opaque) */
  bindTarget(tScene);
  let P = P_ARENA; gl.useProgram(P.p);
  tex(P, 'uTex', 0, arenaTex);
  u2(P, 'uRes', W, H); u2(P, 'uCam', camAx, camAy); u1(P, 'uZoom', camZ); u1(P, 'uTime', T);
  gl.disable(gl.BLEND);
  drawTri();
  /* 2. world sprites (bot, pickups) */
  drawSprites();
  /* 3. pre-lens world VFX (bullet tracers — these get lensed by singularities) */
  bScene.draw();
  /* 4. BLACK_HOLE head — golden SCENE pass, scissored to its bounding box */
  if (BH && BH.hp > -1 && !headHidden){
    const sc = headScale();
    const [gx, gy] = w2gl(BH.x, BH.y);
    const pad = sc * 1.45;
    const x0 = Math.max(0, Math.floor(gx - pad)), x1 = Math.min(W, Math.ceil(gx + pad));
    const y0 = Math.max(0, Math.floor(gy - pad)), y1 = Math.min(H, Math.ceil(gy + pad));
    if (x1 > x0 && y1 > y0){
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      P = P_SCENE; gl.useProgram(P.p);
      const sway = headSway(), swayR = headSwayR(), breath = headBreath();
      u2(P, 'uRes', W, H); u2(P, 'uCenter', gx, gy); u2(P, 'uSway', sway[0], sway[1]);
      u1(P, 'uScale', sc); u1(P, 'uTime', T); u1(P, 'uSwayR', swayR); u1(P, 'uBreath', breath);
      u1(P, 'uBandPhase', PH.band); u1(P, 'uSwirlPhase', PH.swirl); u1(P, 'uInflow', PH.inflow); u1(P, 'uFall', PH.fall); u1(P, 'uStarSpin', PH.starSpin);
      u1(P, 'uSuck', Math.max(0, SP.suck.v)); u1(P, 'uTension', Math.max(0, SP.tension.v)); u1(P, 'uStress', headStress());
      u1(P, 'uBlink', blinkValue()); u1(P, 'uEye', Math.max(0, SP.eye.v) + headFlare()); u1(P, 'uSquint', clamp01(SP.squint.v)); u1(P, 'uTwist', SP.twist.v);
      u2(P, 'uSeat', seatX, seatY);
      u1(P, 'uGrowth', growth01()); u1(P, 'uVuln', clamp01(vulnSpring.v)); u1(P, 'uEscrow', escrow01()); u1(P, 'uHitFlash', clamp01(hitFlashSpring.v)); u1(P, 'uKo', clamp01(koSpring.v));
      fillShards();
      gl.uniform4fv(P.u.uShardA, shA); gl.uniform4fv(P.u.uShardB, shB);
      drawTri();
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    }
  }
  /* 5. spacetime lens over the whole world (all singularities at once) */
  bindTarget(tLens);
  P = P_LENS; gl.useProgram(P.p);
  u2(P, 'uRes', tLens.w, tLens.h);
  tex(P, 'uScene', 0, tScene.tex);
  gl.uniform1i(P.u.uNSing, singCount);
  gl.uniform2fv(P.u.uC, singC);
  gl.uniform1fv(P.u.uScaleA, singScale); gl.uniform1fv(P.u.uRs, singRs); gl.uniform1fv(P.u.uK, singK);
  gl.uniform1fv(P.u.uSpin, singSpin); gl.uniform1fv(P.u.uSuck, singSuck);
  gl.uniform1fv(P.u.uShockR, singShockR); gl.uniform1fv(P.u.uShockA, singShockA); gl.uniform1fv(P.u.uFlash, singFlash);
  gl.uniform1fv(P.u.uAccP, singAccP); gl.uniform1fv(P.u.uAccIn, singAccIn); gl.uniform1fv(P.u.uTensionA, singTension); gl.uniform1fv(P.u.uHot, singHot);
  u1(P, 'uTime', T);
  drawTri();
  /* 6. post-lens emissive VFX (capture bursts, folds, glints, rings) */
  bPost.draw();
  /* 7. golden head particles (dust/motes) inside the lensed frame */
  drawHeadParticles();
  /* 8. bloom chain (golden) */
  let src = tLens;
  for (let i = 0; i < 4; i++) {
    bindTarget(bl[i]); P = P_DOWN; gl.useProgram(P.p);
    tex(P, 'uSrc', 0, src.tex); u2(P, 'uSrcTexel', 0.5 / src.w, 0.5 / src.h); u2(P, 'uDstRes', bl[i].w, bl[i].h); u1(P, 'uThresh', i === 0 ? 0.55 : 0);
    drawTri();
    P = P_BLUR; gl.useProgram(P.p);
    bindTarget(bt[i]); tex(P, 'uSrc', 0, bl[i].tex); u2(P, 'uDir', 1 / bl[i].w, 0); u2(P, 'uDstRes', bt[i].w, bt[i].h); drawTri();
    bindTarget(bl[i]); tex(P, 'uSrc', 0, bt[i].tex); u2(P, 'uDir', 0, 1 / bl[i].h); u2(P, 'uDstRes', bl[i].w, bl[i].h); drawTri();
    src = bl[i];
  }
  /* 9. final composite (golden: CA + bloom + ACES + vignette + grain) */
  bindTarget(null);
  P = P_FINAL; gl.useProgram(P.p);
  tex(P, 'uLens', 0, tLens.tex); tex(P, 'uB0', 1, bl[0].tex); tex(P, 'uB1', 2, bl[1].tex); tex(P, 'uB2', 3, bl[2].tex); tex(P, 'uB3', 4, bl[3].tex);
  u2(P, 'uRes', CW, CH); u2(P, 'uCuv', caU, caV);
  u1(P, 'uCA', 0.3*Math.max(0, SP.suck.v) + 0.4*maxFlash); u1(P, 'uTime', T); u1(P, 'uBloom', hasFloat ? 0.9 : 1.4); u1(P, 'uExposure', 1.15);
  drawTri();
}
/* @@FS_LENS_GOLDEN_REF@@: the golden single-slot LENS this multi-slot pass is
   ported from lives verbatim in docs/blackhole-playtest/golden/01_GOLDEN_BASELINE.html (FS_LENS). */
