// Generates public/game/fighters/blackholeGoldenVisualRuntime.js — the in-game
// BLACK_HOLE golden visual layer for APEX CHAOS.
//
// GLSL is extracted VERBATIM from the approved golden pipeline build
// (public/playtest/blackhole-battle-sandbox.html), which itself assembles the
// golden baseline shaders with the documented battle-scale patches
// (uSeat / uGrowth / uVuln / uEscrow / uHitFlash / uKo / premultiplied overC).
// The two overlay adaptations (alpha-carrying lens, vignette-free premultiplied
// final) are written here and clearly marked as adaptations.
//
// Usage: node tools/blackholeSandbox/buildGoldenHeroRuntime.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const BUILT = path.join(REPO, 'public/playtest/blackhole-battle-sandbox.html');
const OUT = path.join(REPO, 'public/game/fighters/blackholeGoldenVisualRuntime.js');

const src = fs.readFileSync(BUILT, 'utf8');
function extract(name) {
  const re = new RegExp('const ' + name + ' = `([\\s\\S]*?)`;', '');
  const m = src.match(re);
  if (!m) throw new Error('build: could not extract ' + name + ' from built sandbox');
  return m[1];
}

const COMMON = extract('COMMON');
const VS_TRI = extract('VS_TRI');
// the battle head shader is assembled in the sandbox as FS_SCENE_HEAD +
// BATTLE_SCENE_MAIN (functions + battle main()); mirror that assembly here,
// then substitute the browser-side ${COMMON} placeholder so the runtime file
// is fully self-contained (no template interpolation at load time)
const FS_SCENE_HEAD = (extract('FS_SCENE_HEAD') + extract('BATTLE_SCENE_MAIN')).replace(/\$\{COMMON\}/g, COMMON);
const VS_PART = extract('VS_PART');
const FS_PART = extract('FS_PART');
const FS_DOWN = extract('FS_DOWN');
const FS_BLUR = extract('FS_BLUR');

// ---- ADAPTATION 1: lens carries alpha (vec4 sampling) so the golden lens can
// composite over the live 2D game. Emissive singularity terms raise coverage;
// the horizon punches OPAQUE BLACK (the hole must occlude the game behind it).
const FS_LENS_OV = `#version 300 es
${COMMON}
out vec4 o;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform int uNSing;
uniform vec2 uC[5];
uniform float uScaleA[5], uRs[5], uK[5], uSpin[5], uSuck[5];
uniform float uShockR[5], uShockA[5], uFlash[5], uAccP[5], uAccIn[5], uTensionA[5], uHot[5];
uniform float uTime;
vec4 sampPx(vec2 px){ return texture(uScene, px/uRes); }
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
  vec4 px4 = sampPx(uv);
  vec3 col = px4.rgb;
  float A = px4.a;
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
        vec4 s4 = sampPx(uC[i] + rot(ang)*dir*rsrc*(1.0 + kk*0.22)*uScaleA[i]);
        float w = exp(-fi*2.2);
        tr += max(s4.rgb - 0.12, 0.0)*w; ws += w;
        av += s4.rgb*w; wa += w;
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
      float acc = prof*dens*(0.5 + 2.2*heat)*(0.25 + 0.95*uSuck[i])*open01*uHot[i];
      col += accC*acc;
      float w1 = rs*0.028 + PX*0.9;
      float x1 = (r - rs*1.075)/w1;
      float x2 = (r - rs*1.2)/(rs*0.07);
      float pr = exp(-x1*x1);
      float pr2 = exp(-x2*x2);
      float beam = 0.7 + 0.5*cos(TAU*a + 1.2 - uTime*0.5);
      col += (vec3(1.0,0.9,1.0)*pr*2.6*beam + L(vec3(0.7,0.4,1.0))*pr2*0.5)*open01*uHot[i];
      col *= smoothstep(rs - PX*1.2, rs + PX*1.2, r);
      // overlay adaptation: coverage
      float inH = 1.0 - smoothstep(rs - PX*1.2, rs + PX*1.2, r);
      A = max(A, inH);
      A = max(A, clamp(acc*1.4 + (pr*2.6*beam + pr2*0.5)*open01*uHot[i]*0.8, 0.0, 1.0));
    }
    float rr = r*r;
    float fl = uFlash[i];
    if(fl > 0.001){
      col += vec3(1.0,0.9,1.0)*fl*exp(-rr/0.0012)*6.0;
      col += L(vec3(0.62,0.25,1.0))*fl*exp(-r*7.0)*0.9;
      A = max(A, clamp(fl*exp(-r*7.0)*1.2, 0.0, 1.0));
    }
    float tn = uTensionA[i]*(1.0 - smoothstep(0.0, 0.01, rs));
    if(tn > 0.001){
      col += L(vec3(0.8,0.5,1.0))*tn*exp(-rr/0.0005)*2.2;
      A = max(A, clamp(tn*exp(-rr/0.0005)*2.0, 0.0, 1.0));
    }
  }
  o = vec4(col, A);
}`;

// ---- ADAPTATION 2: final composite for a TRANSPARENT overlay — golden CA +
// bloom + ACES kept; vignette and dark background removed (they would darken
// the live game underneath). Output is premultiplied light.
const FS_FINAL_OV = `#version 300 es
precision highp float;
uniform sampler2D uLens, uB0, uB1, uB2, uB3;
uniform vec2 uRes, uCuv; uniform float uCA, uTime, uBloom, uExposure;
out vec4 o;
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  float asp = uRes.x/uRes.y;
  vec2 dv = uv - uCuv;
  float dl = length(dv*vec2(asp, 1.0));
  float ca = 0.0012 + uCA*exp(-dl*5.0)*0.02;
  vec2 off = dv*ca;
  vec4 px;
  px.r = texture(uLens, uv - off).r;
  px.g = texture(uLens, uv).g;
  px.b = texture(uLens, uv + off).b;
  px.a = texture(uLens, uv).a;
  vec3 b = texture(uB0, uv).rgb*0.55 + texture(uB1, uv).rgb*0.6 + texture(uB2, uv).rgb*0.7 + texture(uB3, uv).rgb*0.8;
  vec3 col = px.rgb + b*uBloom;
  float lum = dot(col, vec3(0.30, 0.45, 0.25));
  float A = clamp(max(px.a, lum), 0.0, 1.0);
  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1.0/2.2));
  col += (h12(gl_FragCoord.xy + fract(uTime*7.13)*97.0) - 0.5)*0.014*A;
  o = vec4(col, A);
}`;

const banner = `// BLACK_HOLE golden hero visual — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node tools/blackholeSandbox/buildGoldenHeroRuntime.mjs
//
// Renders the approved golden BLACK_HOLE identity (cosmos head, rupture eyes,
// horizon/accretion/photon-ring lens, bloom + ACES) as a transparent WebGL2
// overlay positioned exactly over #game-canvas, driven by the live production
// fighter state. The 2D body visual is replaced by a soft gravitational shadow.
// Gravity-well projectiles from the production kit render as golden world
// singularities in the same lens.
//
// Provenance: GLSL below is the golden pipeline assembled by
// tools/blackholeSandbox/build.mjs (verbatim golden baseline + documented
// battle patches). FS_LENS_OV and FS_FINAL_OV are overlay adaptations
// (alpha-carrying lens, vignette-free premultiplied final).`;

const driver = String.raw`
(function () {
  if (window.apexBlackholeGoldenVisualRuntime === 'ready') return;

  /* ---------------- tiny math (golden helpers) ---------------- */
  var clamp01 = function (x) { return Math.min(1, Math.max(0, x)); };
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var ease = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
  var easeIn = function (x) { x = clamp01(x); return x * x * x; };
  var easeOut = function (x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var sstep = function (e0, e1, x) { return ease((x - e0) / (e1 - e0)); };
  var rnd = function (a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return a + Math.random() * (b - a); };
  var norm = function (x, y) { var l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  var TAU = Math.PI * 2;

  /* ---------------- golden springs (verbatim bank) ---------------- */
  class Spring {
    constructor(v, w, z) { this.v = v; this.t = v; this.vel = 0; this.w = w; this.z = z; this.w0 = w; this.z0 = z; }
    step(dt) { var n = 4, h = dt / n; for (var i = 0; i < n; i++) { var a = this.w * this.w * (this.t - this.v) - 2 * this.z * this.w * this.vel; this.vel += a * h; this.v += this.vel * h; } }
    snap(v) { this.v = this.t = v; this.vel = 0; }
  }
  var IDLE_T = { tension: 0, K: 0.025, rs: 0, suck: 0, stress: 0, band: 1, swirl: 1, twist: 0, eye: 1, squint: 0, spin: 0, fall: -0.006 };

  function eggE(x, y) { var sx = 1 + 0.30 * sstep(0.25, -0.85, y); var sy = lerp(0.73, 0.84, sstep(-0.15, 0.15, y)); return Math.hypot(x * sx, y * sy); }

  var GAME = 1000;                      // engine GAME_SIZE / overlay backing size
  var ND = 560, NM = 200, NP = ND + NM; // golden head particles (scaled for live combat)
  var NS = 16;

  /* ---------------- one BLACK_HOLE head (per fighter) ---------------- */
  function HeadState(f) {
    this.f = f;
    this.T = 0;
    this.SP = {
      tension: new Spring(0, 6, 1), K: new Spring(0.025, 3.2, 1), rs: new Spring(0, 4.8, 0.52),
      suck: new Spring(0, 3.2, 1), stress: new Spring(0.0, 2.6, 1), band: new Spring(1, 1.6, 1),
      swirl: new Spring(1, 1.8, 1), twist: new Spring(0, 1.6, 1), eye: new Spring(1, 7, 0.75),
      squint: new Spring(0, 8, 0.85), spin: new Spring(0, 2.4, 1), fall: new Spring(-0.006, 1.2, 1)
    };
    this.vulnSpring = new Spring(0, 5, 1);
    this.hitFlashSpring = new Spring(0, 14, 1);
    this.koSpring = new Spring(0, 3, 1);
    this.PH = { band: 0, swirl: 0, inflow: 0, fall: 0, starSpin: 0, acc: 0, accIn: 0 };
    this.S = { shockT: 99, shockAmp: 0, flash: 0 };
    this.phase = 'opening'; this.tau = 0;
    this.rsW = [4.8, 0.52]; this.kW = [3.2, 1];
    this.seatX = 0; this.seatY = 0.17;
    this.blinkT = 99; this.nextBlink = rnd(3, 6); this.blinkQueue = 0;
    this.px = f.x; this.py = f.y; this.vx = 0; this.vy = 0;
    this.lastHp = f.hp; this.growth = 0; this.wasRage = false;
    this.parts = []; this.shards = [];
    for (var i = 0; i < NP; i++) { var p = {}; if (i < ND) this.spawnDust(p, false); else this.spawnMote(p, false); this.parts.push(p); }
    for (var j = 0; j < NS; j++) { var s = {}; this.spawnShard(s, false); this.shards.push(s); }
    this.ptData = new Float32Array(NP * 5); this.lnData = new Float32Array(NP * 10);
    this.lnCount = 0; this.frameDt = 1 / 60;
    this.shA = new Float32Array(NS * 4); this.shB = new Float32Array(NS * 4);
    this.vPt = null; this.vLn = null;                      // VAOs, created on first GL use
    this.dead = false;
  }
  HeadState.prototype.setTargets = function (o) { for (var k in o) this.SP[k].t = o[k]; };
  HeadState.prototype.fireShock = function (a) { this.S.shockT = 0; this.S.shockAmp = a; if (Math.abs(a) > 0.85) this.S.flash = Math.max(this.S.flash, Math.abs(a) * 0.95); };
  HeadState.prototype.growth01 = function () { return this.growth; };

  HeadState.prototype.spawnDust = function (p, fresh) {
    p.kind = 0; p.mode = 0;
    p.a = rnd(0, TAU);
    var g = this.growth01();
    p.rad0 = (0.6 + Math.pow(Math.random(), 0.8) * 0.46) * (1 + 0.32 * g); p.rad = p.rad0; p.vr = 0;
    p.spd = 0.055 * Math.pow(0.8 / Math.min(p.rad0, 1.4), 1.5) * rnd(0.75, 1.25);
    p.size = rnd(1.0, 2.1) * (Math.random() < 0.06 ? 1.8 : 1);
    p.b = Math.random() < 0.07 ? rnd(0.5, 1.1) : rnd(0.05, 0.28);
    p.fade = fresh ? 0 : 1; p.heat = 0; p.wob = rnd(0, 6.28);
    p.x = Math.cos(p.a) * p.rad; p.y = Math.sin(p.a) * p.rad * 0.97; p.px = p.x; p.py = p.y;
  };
  HeadState.prototype.spawnMote = function (p, fresh) {
    p.kind = 1; p.mode = 0;
    do { p.x = rnd(-0.45, 0.45); p.y = rnd(-0.66, 0.6); } while (eggE(p.x, p.y) > 0.45);
    p.bvx = rnd(-1, 1) * 0.004; p.bvy = rnd(-1, 1) * 0.004; p.vx = p.bvx; p.vy = p.bvy;
    p.size = rnd(0.8, 1.6); p.b = rnd(0.05, 0.24) * (Math.random() < 0.05 ? 3 : 1);
    p.fade = fresh ? 0 : 1; p.heat = 0; p.px = p.x; p.py = p.y; p.wob = rnd(0, 6.28);
  };
  HeadState.prototype.spawnShard = function (s, fresh) {
    s.mode = 0; s.a = rnd(0, TAU); s.rad0 = rnd(0.93, 1.12) * (1 + 0.22 * this.growth01()); s.rad = s.rad0; s.vr = 0;
    s.spd = 0.035 * Math.pow(1 / Math.min(s.rad0, 1.3), 1.5) * rnd(0.7, 1.3);
    s.size = Math.random() < 0.35 ? rnd(0.03, 0.05) : rnd(0.055, 0.1);
    s.seed = Math.random(); s.alpha = fresh ? 0 : 1; s.stretch = 1; s.heat = 0; s.wob = rnd(0, 6.28); s.tilt = rnd(-0.5, 0.5);
    s.x = Math.cos(s.a) * s.rad; s.y = Math.sin(s.a) * s.rad * 0.97; s.phi = s.a - Math.PI / 2; s.dead = 0;
  };
  HeadState.prototype.releaseAll = function () {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i]; if (p.mode !== 1) continue; p.mode = 0;
      if (p.kind === 0) { p.a = Math.atan2(p.y, p.x); p.rad = Math.hypot(p.x, p.y) / 0.985; p.vr = rnd(0.5, 1.1); }
      else { var dx = p.x, dy = p.y - 0.17, l = Math.hypot(dx, dy) + 1e-4; var k = rnd(0.15, 0.4); p.vx = dx / l * k; p.vy = dy / l * k; }
    }
    for (var j = 0; j < this.shards.length; j++) {
      var s = this.shards[j]; if (s.mode !== 1) continue; s.mode = 0; s.a = Math.atan2(s.y, s.x); s.rad = Math.hypot(s.x, s.y); s.vr = rnd(0.4, 0.9);
    }
  };

  HeadState.prototype.update = function (dt) {
    var f = this.f;
    this.T += dt;
    this.tau += dt;
    // velocity (engine fighters carry no vx/vy)
    var ivx = (f.x - this.px) / Math.max(dt, 1e-4), ivy = (f.y - this.py) / Math.max(dt, 1e-4);
    this.vx += (ivx - this.vx) * Math.min(1, dt * 12); this.vy += (ivy - this.vy) * Math.min(1, dt * 12);
    this.px = f.x; this.py = f.y;
    // damage → hit flash / growth evolution (visual adaptation: horizon grows with wounds)
    if (f.hp < this.lastHp - 0.01) {
      var amt = this.lastHp - f.hp;
      this.hitFlashSpring.t = Math.min(1, this.hitFlashSpring.t + amt / 40);
      this.SP.squint.t = Math.min(0.85, this.SP.squint.t + amt / 90); this.SP.squint.w = 8;
      this.SP.stress.t = Math.min(1.2, this.SP.stress.t + amt / 110);
    }
    this.lastHp = f.hp;
    this.hitFlashSpring.t *= Math.exp(-dt * 3.2);
    this.growth = clamp01((f.maxHp - f.hp) / f.maxHp);
    var rage = !!f.isRage;
    if (rage && !this.wasRage) { this.fireShock(0.7); this.S.flash = 0.7; }
    this.wasRage = rage;
    if (f.hp <= 0 && this.phase !== 'ko') this.setPhase('ko');

    // ---- golden head timeline (opening birth → idle combat → ko collapse)
    var t = this.tau, T = this.T, SP = this.SP;
    if (this.phase === 'opening') {
      var B = 1.05;
      this.setTargets({
        tension: t < B ? easeIn(t / B) * 0.6 + ease(t / B) * 0.4 : 0.3,
        squint: t < B ? 0.5 * ease(t / 0.9) : 0.12,
        eye: t < B ? 1 + 0.6 * ease(t / B) : 1.3,
        K: t < 0.45 ? 0.025 : t < B ? 0.025 + 0.06 * ease((t - 0.45) / 0.6) : 0.085 + 0.19 * easeOut((t - B) / 1.8),
        rs: t < B ? 0 : 1,
        suck: t < B ? 0.12 * ease(t / B) : 0.12 + 0.88 * ease((t - B) / 1.5),
        stress: t < 0.7 ? 0.1 * ease(t / 0.7) : 0.1 + 0.9 * ease((t - 0.7) / 1.8),
        band: t < B ? 1 - 0.7 * ease(t / B) : 2.8,
        swirl: t < B ? 1 + 3 * ease(t / B) : 7,
        twist: t < B ? 0.8 * ease(t / B) : 1.7,
        spin: t < 0.45 ? 0 : t < B ? 0.6 * ease((t - 0.45) / 0.6) : 1.25,
        fall: t < B ? 0.0 : 0.22
      });
      if (t >= B && this.S.shockT > 1) { this.fireShock(1.0); this.S.flash = 1.0; }
      if (t > 2.2) this.setPhase('idle');
    } else if (this.phase === 'ko') {
      var C1 = 0.7;
      this.setTargets({
        suck: 0, rs: t < C1 ? 1 - easeIn(t / C1) : 0, K: t < C1 ? 0.2 * (1 - ease(t / C1)) : 0,
        tension: t < C1 ? 0.5 : 0, eye: t < C1 ? 0.6 : 0, squint: t < C1 ? 0.8 : 0.9,
        stress: 0, band: t < C1 ? 1.2 : 0.6, swirl: 0.6, twist: 0, spin: t < C1 ? 0.9 : 0, fall: -0.02
      });
      this.koSpring.t = 1;
      if (t >= C1 && this.S.shockT > 1) { this.fireShock(-0.7); this.S.flash = 0.6; this.releaseAll(); }
    } else { // idle combat presence
      var hb = Math.sin(T * 0.9);
      var spd01 = clamp01(Math.hypot(this.vx, this.vy) / 520);
      var suckT = 0.14 + 0.5 * spd01 + (rage ? 0.5 : 0) + 0.2 * this.growth;
      this.setTargets({
        tension: 0.04 + 0.2 * spd01 + (rage ? 0.3 : 0),
        K: 0.025 + 0.004 * hb + 0.16 * this.growth + (rage ? 0.1 : 0),
        rs: 0,
        suck: suckT,
        stress: 0.02 + 0.02 * Math.max(0, hb) + 0.55 * clamp01(this.hitFlashSpring.v) + (rage ? 0.5 : 0),
        band: 1 + 0.6 * this.growth,
        swirl: 1 + 1.6 * spd01,
        twist: 0.2 * spd01,
        eye: 1 + 0.25 * this.growth + (rage ? 0.35 : 0) + 0.5 * clamp01(this.hitFlashSpring.v),
        squint: 0.05,
        spin: 0.3 + 0.7 * spd01 + (rage ? 0.5 : 0),
        fall: -0.006
      });
    }
    for (var k in SP) SP[k].step(dt);
    this.vulnSpring.step(dt); this.hitFlashSpring.step(dt); this.koSpring.step(dt);
    var suck = Math.max(0, SP.suck.v);
    this.PH.band += dt * 0.045 * SP.band.v;
    this.PH.swirl = (this.PH.swirl + dt * 0.02 * SP.swirl.v) % 1;
    this.PH.inflow += dt * (0.05 + 0.9 * suck);
    this.PH.fall += dt * SP.fall.v;
    this.PH.starSpin += dt * (0.003 + 0.09 * suck);
    this.PH.acc = (this.PH.acc + dt * (0.18 + 0.35 * suck)) % 1;
    this.PH.accIn += dt * (0.25 + 0.6 * suck);
    this.S.shockT += dt;
    this.S.flash *= Math.exp(-dt * 5);
    // blink (golden machine)
    this.blinkT += dt;
    if (this.blinkQueue > 0 && this.blinkT > 0.45) { this.blinkQueue--; this.blinkT = 0; }
    var preBirth = this.phase === 'opening' && this.tau < 1.6;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && !preBirth) { this.blinkT = 0; if (Math.random() < 0.22) this.blinkQueue = 1; this.nextBlink = rnd(3.5, 8.5); }
    // seat drift: lean toward the enemy (Composer seat mechanism)
    var enemy = null;
    try { var fs = window.fighters || []; for (var q = 0; q < fs.length; q++) if (fs[q] && fs[q] !== f) { enemy = fs[q]; break; } } catch (e) {}
    var sx = 0, sy = 0.17;
    if (enemy) { var d = norm(enemy.x - f.x, enemy.y - f.y); sx = d.x * 0.05; if (rage) sy = 0.2; }
    this.seatX += (sx - this.seatX) * Math.min(1, dt * 5);
    this.seatY += (sy - this.seatY) * Math.min(1, dt * 5);
    this.updateParticles(dt);
  };

  HeadState.prototype.setPhase = function (p) {
    this.phase = p; this.tau = 0;
    if (p === 'ko') { this.SP.rs.w = 9; this.SP.rs.z = 0.95; this.SP.K.w = 5.2; this.SP.K.z = 0.3; this.SP.band.w = 1.2; }
    else if (p === 'opening') { this.SP.rs.w = 4.8; this.SP.rs.z = 0.52; this.SP.K.w = 3.2; this.SP.K.z = 1; this.SP.band.w = 1.6; }
    else { this.SP.rs.w = 4.8; this.SP.rs.z = 0.52; this.SP.K.w = 2.2; this.SP.K.z = 1; this.SP.band.w = 1.6; }
  };

  HeadState.prototype.updateParticles = function (dt) {
    var suck = Math.max(0, this.SP.suck.v), rs = 0.125 * Math.max(this.SP.rs.v, 0);
    var bandK = 0.6 + 0.4 * this.SP.band.v, T = this.T;
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      p.px = p.x; p.py = p.y;
      if (p.mode === 0) {
        if (p.kind === 0) {
          p.a -= p.spd * dt * bandK;
          p.vr += ((p.rad0 - p.rad) * 3.0 - p.vr * 1.6) * dt;
          p.rad += p.vr * dt;
          var w = 1 + 0.01 * Math.sin(T * 0.7 + p.wob);
          p.x = Math.cos(p.a) * p.rad * w; p.y = Math.sin(p.a) * p.rad * 0.97 * w;
        } else {
          p.vx += (p.bvx - p.vx) * Math.min(1, dt * 1.2); p.vy += (p.bvy - p.vy) * Math.min(1, dt * 1.2);
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (eggE(p.x, p.y) > 0.47) { p.x -= p.vx * dt * 2; p.y -= p.vy * dt * 2; p.vx *= -0.6; p.vy *= -0.6; p.bvx *= -1; p.bvy *= -1; }
        }
        p.fade = Math.min(1, p.fade + dt * 0.6);
        if (suck > 0.04) {
          var dx0 = p.x, dy0 = p.y - 0.17, d0 = Math.hypot(dx0, dy0);
          var rate = suck * (p.kind === 1 ? 0.55 : 0.16) * (0.4 + 1.2 * Math.exp(-d0 * 1.5));
          if (Math.random() < rate * dt) { p.mode = 1; p.rho = d0; p.al = Math.atan2(dy0, dx0); }
        }
      } else {
        var rho = Math.max(p.rho, 0.02);
        var om = Math.min(0.34 * Math.pow(rho, -1.5), 14);
        p.al -= om * dt * (0.35 + 0.65 * Math.min(1, suck * 1.5));
        p.rho -= (0.07 + 0.022 / rho) * Math.max(suck, 0.05) * dt;
        p.x = Math.cos(p.al) * p.rho; p.y = 0.17 + Math.sin(p.al) * p.rho;
        p.heat = clamp01((0.32 - p.rho) / 0.22);
        if (p.rho < rs * 1.04 + 0.004) { if (p.kind === 0) this.spawnDust(p, true); else this.spawnMote(p, true); }
      }
    }
    for (var j = 0; j < this.shards.length; j++) {
      var s = this.shards[j];
      if (s.mode === 2) { s.dead -= dt; if (s.dead <= 0) this.spawnShard(s, true); continue; }
      if (s.mode === 0) {
        s.a -= s.spd * dt * (0.5 + 0.5 * this.SP.band.v);
        s.vr += ((s.rad0 - s.rad) * 2.5 - s.vr * 1.4) * dt; s.rad += s.vr * dt;
        var bob = 1 + 0.012 * Math.sin(T * 0.5 + s.wob);
        s.x = Math.cos(s.a) * s.rad * bob; s.y = Math.sin(s.a) * s.rad * 0.97 * bob;
        s.phi = s.a - Math.PI / 2 + s.tilt + 0.25 * Math.sin(T * 0.3 + s.wob);
        s.alpha = Math.min(1, s.alpha + dt * 0.5); s.stretch += (1 - s.stretch) * Math.min(1, dt * 3); s.heat *= Math.exp(-dt * 2);
        if (suck > 0.3 && Math.random() < 0.12 * suck * dt) {
          s.mode = 1; var dx = s.x, dy = s.y - 0.17; s.rho = Math.hypot(dx, dy); s.rho0 = s.rho; s.al = Math.atan2(dy, dx); s.phi0 = s.phi;
        }
      } else {
        var rho2 = Math.max(s.rho, 0.02);
        var om2 = Math.min(0.3 * Math.pow(rho2, -1.5), 10);
        s.al -= om2 * dt * (0.35 + 0.65 * Math.min(1, suck * 1.5));
        s.rho -= (0.05 + 0.016 / rho2) * Math.max(suck, 0.05) * dt;
        s.x = Math.cos(s.al) * s.rho; s.y = 0.17 + Math.sin(s.al) * s.rho;
        var prog = ease(1 - s.rho / s.rho0);
        var tx = Math.cos(s.phi0), ty = Math.sin(s.phi0), rx = Math.cos(s.al), ry = Math.sin(s.al);
        s.phi = Math.atan2(lerp(ty, ry, prog), lerp(tx, rx, prog));
        s.stretch = 1 + 3.0 * prog * prog;
        s.heat = sstep(0.38, 0.12, s.rho);
        s.alpha = rs > 0.001 ? sstep(rs * 1.0, rs * 2.2, s.rho) : 1;
        if (s.rho < rs * 1.05 + 0.004) { s.mode = 2; s.dead = rnd(1.5, 4); s.alpha = 0; }
      }
    }
  };

  HeadState.prototype.fillShards = function () {
    for (var i = 0; i < NS; i++) {
      var s = this.shards[i], o = i * 4;
      var sz = s.mode === 1 ? s.size * (0.6 + 0.4 * s.rho / s.rho0) : s.size;
      this.shA[o] = s.x; this.shA[o + 1] = s.y; this.shA[o + 2] = s.phi - Math.PI / 2; this.shA[o + 3] = sz;
      this.shB[o] = s.stretch; this.shB[o + 1] = s.mode === 2 ? 0 : s.alpha; this.shB[o + 2] = s.seed; this.shB[o + 3] = s.heat;
    }
  };
  HeadState.prototype.fillParticleBuffers = function (dt, pxScale) {
    var li = 0, T = this.T;
    for (var i = 0; i < NP; i++) {
      var p = this.parts[i];
      var br = p.b * p.fade * (1 + p.heat * 2.5) * (p.mode === 1 ? 1.3 : 1) * (p.kind === 1 ? (0.75 + 0.25 * Math.sin(T * 1.3 + p.wob)) : 1);
      var o = i * 5;
      this.ptData[o] = p.x; this.ptData[o + 1] = p.y; this.ptData[o + 2] = p.size * (1 + p.heat * 0.6) * pxScale; this.ptData[o + 3] = br; this.ptData[o + 4] = p.heat;
      if (dt > 0) {
        var vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
        var tx = vx * 0.07, ty = vy * 0.07; var l = Math.hypot(tx, ty);
        if (l > 0.15) { tx *= 0.15 / l; ty *= 0.15 / l; }
        if (l > 0.003 && l < 1) {
          var q = li * 10;
          this.lnData[q] = p.x; this.lnData[q + 1] = p.y; this.lnData[q + 2] = 0; this.lnData[q + 3] = br * 0.9; this.lnData[q + 4] = p.heat;
          this.lnData[q + 5] = p.x - tx; this.lnData[q + 6] = p.y - ty; this.lnData[q + 7] = 0; this.lnData[q + 8] = 0; this.lnData[q + 9] = p.heat;
          li++;
        }
      }
    }
    this.lnCount = li * 2;
    this.frameDt = dt;
  };
  HeadState.prototype.headScale = function () { return (this.f ? this.f.radius : 75) * 1.72; };
  HeadState.prototype.headSway = function () {
    var leanX = clamp(this.vx / 520, -1, 1) * 0.014;
    var leanY = clamp(-this.vy / 520, -1, 1) * 0.011;
    var T = this.T;
    return [Math.sin(T * 0.21) * 0.006 + Math.sin(T * 0.13 + 2) * 0.004 + leanX,
            Math.sin(T * 0.17 + 1) * 0.007 + Math.sin(T * 0.29) * 0.003 + leanY];
  };
  HeadState.prototype.headSwayR = function () { return Math.sin(this.T * 0.11) * 0.014 - clamp(this.vx / 520, -1, 1) * 0.02; };
  HeadState.prototype.headBreath = function () {
    var jolt = this.S.shockT < 3 ? Math.exp(-this.S.shockT * 4) * Math.sin(this.S.shockT * 18) * 0.012 * Math.sign(this.S.shockAmp || 1) : 0;
    return 1 + 0.006 * Math.sin(this.T * 0.5) - 0.014 * Math.max(0, this.SP.tension.v) + jolt;
  };
  HeadState.prototype.headFlare = function () { return (this.blinkT > 0.3 && this.blinkT < 1.2 ? Math.exp(-(this.blinkT - 0.3) * 6) * 0.1 : 0) + this.S.flash * 0.25; };
  HeadState.prototype.headStress = function () { return Math.max(0, this.SP.stress.v) + 0.04; };
  HeadState.prototype.blinkValue = function () {
    var t = this.blinkT;
    if (t < 0.075) return 1 - Math.pow(1 - t / 0.075, 2);
    if (t < 0.115) return 1;
    if (t < 0.33) return 1 - easeOut((t - 0.115) / 0.215);
    return 0;
  };

  /* ---------------- gravity-well singularities (production kit skill) ---------------- */
  function WellState(proj) {
    this.p = proj;
    this.rs = new Spring(0, 4.8, 0.52);
    this.K = new Spring(0.05, 3.2, 1);
    this.suck = new Spring(0, 3.2, 1);
    this.spin = new Spring(0, 2.4, 1);
    this.accP = Math.random(); this.accIn = Math.random() * 10;
    this.age = 0; this.dead = false;
  }
  WellState.prototype.update = function (dt) {
    var p = this.p;
    this.age += dt;
    var lifeLeft = p.life, total = p.maxLife || 3.1;
    var born = clamp01(this.age / 0.35);
    var dying = clamp01((0.5 - lifeLeft) / 0.45);
    this.rs.t = born * (1 - dying);
    this.K.t = dying > 0 ? -0.06 : 0.05 + 0.21 * born;
    this.suck.t = 0.8 * born * (1 - dying);
    this.spin.t = 1.2 * born;
    this.rs.step(dt); this.K.step(dt); this.suck.step(dt); this.spin.step(dt);
    var suck = Math.max(0, this.suck.v);
    this.accP = (this.accP + dt * (0.18 + 0.35 * suck)) % 1;
    this.accIn += dt * (0.25 + 0.6 * suck);
    if (p.life <= 0 || p.exploded) this.dead = true;
  };

  /* ================= overlay engine ================= */
  var overlay = null, gl = null, hasFloat = false, quality = 1;
  var P_SCENE = null, P_LENS = null, P_DOWN = null, P_BLUR = null, P_FINAL = null, P_PART = null;
  var tScene = null, tLens = null, bl = [], bt = [];
  var heads = new Map();   // fighter → HeadState
  var wells = new Map();   // projectile → WellState
  var singC = new Float32Array(10), singScale = new Float32Array(5), singRs = new Float32Array(5), singK = new Float32Array(5),
      singSpin = new Float32Array(5), singSuck = new Float32Array(5), singShockR = new Float32Array(5), singShockA = new Float32Array(5),
      singFlash = new Float32Array(5), singAccP = new Float32Array(5), singAccIn = new Float32Array(5), singTension = new Float32Array(5),
      singHot = new Float32Array(5);
  var singCount = 0;
  var T = 0, lastNow = 0, perfAcc = 0, perfN = 0, wrapped = false, failed = false;
  var gameCanvas = null;

  function compile(type, srcStr) {
    var s = gl.createShader(type); gl.shaderSource(s, srcStr); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('golden hero shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('golden hero link: ' + gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }
  function u1(P, n, v) { gl.uniform1f(P.u[n], v); }
  function u2(P, n, a, b) { gl.uniform2f(P.u[n], a, b); }
  function tex(P, n, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u[n], unit); }
  var triVao = null;
  function drawTri() { gl.bindVertexArray(triVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); }
  function makeTarget(w, h) {
    var texId = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texId);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (hasFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texId, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: texId, fb: fb, w: w, h: h };
  }
  function bindTarget(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : GAME, t ? t.h : GAME); }
  function allocTargets() {
    var q = quality, S = Math.round(GAME * q);
    tScene = makeTarget(S, S); tLens = makeTarget(S, S);
    bl = []; bt = [];
    var sizes = [Math.round(S / 2), Math.round(S / 4), Math.round(S / 8), Math.max(8, Math.round(S / 16))];
    for (var i = 0; i < 4; i++) { bl.push(makeTarget(sizes[i], sizes[i])); bt.push(makeTarget(sizes[i], sizes[i])); }
  }
  function mkVAO(data) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
    gl.bindVertexArray(null);
    return { vao: vao, buf: buf };
  }

  function initGL() {
    gl = overlay.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    hasFloat = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    P_SCENE = program(VS_TRI, FS_SCENE_HEAD);
    P_LENS = program(VS_TRI, FS_LENS_OV);
    P_DOWN = program(VS_TRI, FS_DOWN);
    P_BLUR = program(VS_TRI, FS_BLUR);
    P_FINAL = program(VS_TRI, FS_FINAL_OV);
    P_PART = program(VS_PART, FS_PART);
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    triVao = vao;
    allocTargets();
  }

  /* overlay placement: match #game-canvas exactly (any layout, any transform) */
  function syncOverlayRect() {
    if (!overlay || !gameCanvas) return;
    if (!gameCanvas.isConnected) return;
    var gr = gameCanvas.getBoundingClientRect();
    var parent = overlay.offsetParent || document.body;
    var pr = parent.getBoundingClientRect();
    var style = overlay.style;
    style.left = (gr.left - pr.left) + 'px';
    style.top = (gr.top - pr.top) + 'px';
    style.width = gr.width + 'px';
    style.height = gr.height + 'px';
    var vis = gr.width > 2 ? '' : 'none';
    if (style.display !== vis) style.display = vis;
  }

  function camView() {
    var v = window.__apexCameraView;
    return { z: (v && v.zoom) || window.cameraZoom || 1, sx: (v && v.shakeX) || 0, sy: (v && v.shakeY) || 0 };
  }
  function worldToOverlay(x, y, cam, q) {
    var sx = (x - GAME / 2) * cam.z + GAME / 2 + cam.sx;
    var sy = (y - GAME / 2) * cam.z + GAME / 2 + cam.sy;
    return [sx * q, (GAME - sy) * q];   // FBO px, y-up
  }

  function packSing(i, x, y, scale, rs, K, spin, suck, shockT, shockA, flash, accP, accIn, tension, hot) {
    singC[i * 2] = x; singC[i * 2 + 1] = y;
    singScale[i] = scale; singRs[i] = rs; singK[i] = K; singSpin[i] = spin; singSuck[i] = suck;
    singShockR[i] = shockT; singShockA[i] = shockA; singFlash[i] = flash;
    singAccP[i] = accP; singAccIn[i] = accIn; singTension[i] = tension; singHot[i] = hot;
  }

  function renderFrame(rawDt) {
    if (failed || !gl) return;
    var engineTs = typeof window.timeScale === 'number' ? window.timeScale : 1;
    var dt = Math.min(0.05, rawDt) * engineTs;
    T += dt;
    var cam = camView();
    var q = quality;
    var fighters = window.fighters || [];

    // collect BLACK_HOLE fighters (P1, P2, mirrors — any)
    var bhFighters = [];
    for (var i = 0; i < fighters.length; i++) {
      var f = fighters[i];
      if (f && f.name === 'BLACK_HOLE') bhFighters.push(f);
    }
    // drop heads for gone fighters
    heads.forEach(function (st, f) { if (bhFighters.indexOf(f) < 0) { heads.delete(f); } });
    if (!bhFighters.length) { wells.clear(); }

    var anyAlive = false;
    for (var j = 0; j < bhFighters.length; j++) {
      var f2 = bhFighters[j];
      anyAlive = true;
      var st = heads.get(f2);
      if (!st) { st = new HeadState(f2); heads.set(f2, st); }
      st.update(dt);
    }
    if (!bhFighters.length) {
      // nothing to render — keep the overlay fully transparent
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, GAME, GAME);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    // gravity wells from the production kit → golden world singularities
    var projs = window.projectiles || [];
    wells.forEach(function (w, p) { if (projs.indexOf(p) < 0 || w.dead) wells.delete(p); });
    for (var k = 0; k < projs.length; k++) {
      var pr = projs[k];
      if (pr && pr.type === 'gravity_well' && !pr.exploded && pr.life > 0) {
        if (!wells.has(pr)) wells.set(pr, new WellState(pr));
        wells.get(pr).update(dt);
      }
    }

    // ---- 1. scene pass: golden heads, scissored, premultiplied over transparent
    bindTarget(tScene);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    var headOrder = [];
    heads.forEach(function (st) { headOrder.push(st); });
    for (var h = 0; h < headOrder.length; h++) {
      var st2 = headOrder[h], f3 = st2.f;
      var sc = st2.headScale() * cam.z * q;
      var g = worldToOverlay(f3.x, f3.y, cam, q);
      var pad = sc * 1.45;
      var x0 = Math.max(0, Math.floor(g[0] - pad)), x1 = Math.min(tScene.w, Math.ceil(g[0] + pad));
      var y0 = Math.max(0, Math.floor(g[1] - pad)), y1 = Math.min(tScene.h, Math.ceil(g[1] + pad));
      if (x1 <= x0 || y1 <= y0) continue;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, y0, x1 - x0, y1 - y0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P_SCENE.p);
      var sway = st2.headSway(), swayR = st2.headSwayR(), breath = st2.headBreath();
      u2(P_SCENE, 'uRes', tScene.w, tScene.h); u2(P_SCENE, 'uCenter', g[0], g[1]); u2(P_SCENE, 'uSway', sway[0], sway[1]);
      u1(P_SCENE, 'uScale', sc); u1(P_SCENE, 'uTime', st2.T); u1(P_SCENE, 'uSwayR', swayR); u1(P_SCENE, 'uBreath', breath);
      u1(P_SCENE, 'uBandPhase', st2.PH.band); u1(P_SCENE, 'uSwirlPhase', st2.PH.swirl); u1(P_SCENE, 'uInflow', st2.PH.inflow);
      u1(P_SCENE, 'uFall', st2.PH.fall); u1(P_SCENE, 'uStarSpin', st2.PH.starSpin);
      u1(P_SCENE, 'uSuck', Math.max(0, st2.SP.suck.v)); u1(P_SCENE, 'uTension', Math.max(0, st2.SP.tension.v)); u1(P_SCENE, 'uStress', st2.headStress());
      u1(P_SCENE, 'uBlink', st2.blinkValue()); u1(P_SCENE, 'uEye', Math.max(0, st2.SP.eye.v) + st2.headFlare());
      u1(P_SCENE, 'uSquint', clamp01(st2.SP.squint.v)); u1(P_SCENE, 'uTwist', st2.SP.twist.v);
      u2(P_SCENE, 'uSeat', st2.seatX, st2.seatY);
      u1(P_SCENE, 'uGrowth', st2.growth01()); u1(P_SCENE, 'uVuln', 0); u1(P_SCENE, 'uEscrow', 0);
      u1(P_SCENE, 'uHitFlash', clamp01(st2.hitFlashSpring.v)); u1(P_SCENE, 'uKo', clamp01(st2.koSpring.v));
      st2.fillShards();
      gl.uniform4fv(P_SCENE.u.uShardA, st2.shA); gl.uniform4fv(P_SCENE.u.uShardB, st2.shB);
      drawTri();
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.BLEND);
    }

    // ---- 2. lens pass: all singularities (head seats + gravity wells)
    singCount = 0;
    for (var m = 0; m < headOrder.length && singCount < 5; m++) {
      var st3 = headOrder[m], f4 = st3.f;
      var sc2 = st3.headScale() * cam.z * q;
      var g2 = worldToOverlay(f4.x, f4.y, cam, q);
      packSing(singCount++, g2[0], g2[1], sc2, 0.125 * Math.max(0, st3.SP.rs.v) * st3.headBreath(),
               st3.SP.K.v + 0.05 * st3.growth01(), Math.max(0, st3.SP.spin.v) + 0.2 * st3.growth01(),
               Math.max(0, st3.SP.suck.v), st3.S.shockT, st3.S.shockAmp, st3.S.flash, st3.PH.acc, st3.PH.accIn,
               Math.max(0, st3.SP.tension.v), 1);
    }
    wells.forEach(function (w) {
      if (singCount >= 5 || w.dead) return;
      var R = w.p.core || 100;
      var g3 = worldToOverlay(w.p.x, w.p.y, cam, q);
      packSing(singCount++, g3[0], g3[1], (R / 0.125) * cam.z * q, 0.125 * Math.max(0, w.rs.v),
               w.K.v, Math.max(0, w.spin.v), Math.max(0, w.suck.v), 99, 0, 0, w.accP, w.accIn, 0, 1.15);
    });
    bindTarget(tLens);
    gl.useProgram(P_LENS.p);
    u2(P_LENS, 'uRes', tLens.w, tLens.h);
    tex(P_LENS, 'uScene', 0, tScene.tex);
    gl.uniform1i(P_LENS.u.uNSing, singCount);
    gl.uniform2fv(P_LENS.u.uC, singC);
    gl.uniform1fv(P_LENS.u.uScaleA, singScale); gl.uniform1fv(P_LENS.u.uRs, singRs); gl.uniform1fv(P_LENS.u.uK, singK);
    gl.uniform1fv(P_LENS.u.uSpin, singSpin); gl.uniform1fv(P_LENS.u.uSuck, singSuck);
    gl.uniform1fv(P_LENS.u.uShockR, singShockR); gl.uniform1fv(P_LENS.u.uShockA, singShockA); gl.uniform1fv(P_LENS.u.uFlash, singFlash);
    gl.uniform1fv(P_LENS.u.uAccP, singAccP); gl.uniform1fv(P_LENS.u.uAccIn, singAccIn); gl.uniform1fv(P_LENS.u.uTensionA, singTension); gl.uniform1fv(P_LENS.u.uHot, singHot);
    u1(P_LENS, 'uTime', T);
    drawTri();

    // ---- 3. golden head particles (additive, into the lensed frame)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P_PART.p);
    for (var n = 0; n < headOrder.length; n++) {
      var st4 = headOrder[n], f5 = st4.f;
      if (!st4.vPt) { st4.vPt = mkVAO(st4.ptData); st4.vLn = mkVAO(st4.lnData); }
      st4.fillParticleBuffers(st4.frameDt > 0 ? st4.frameDt : 1 / 60, st4.headScale() / 420);
      var sway2 = st4.headSway(), swayR2 = st4.headSwayR(), breath2 = st4.headBreath();
      var g4 = worldToOverlay(f5.x, f5.y, cam, q);
      u2(P_PART, 'uRes', tLens.w, tLens.h); u2(P_PART, 'uCenter', g4[0], g4[1]); u2(P_PART, 'uSway', sway2[0], sway2[1]);
      u1(P_PART, 'uScale', st4.headScale() * cam.z * q); u1(P_PART, 'uSwayR', swayR2); u1(P_PART, 'uBreath', breath2);
      gl.bindBuffer(gl.ARRAY_BUFFER, st4.vPt.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, st4.ptData);
      gl.bindBuffer(gl.ARRAY_BUFFER, st4.vLn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, st4.lnData);
      u1(P_PART, 'uPoint', 0);
      gl.bindVertexArray(st4.vLn.vao); if (st4.lnCount) gl.drawArrays(gl.LINES, 0, st4.lnCount);
      u1(P_PART, 'uPoint', 1);
      gl.bindVertexArray(st4.vPt.vao); gl.drawArrays(gl.POINTS, 0, NP);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    // ---- 4. bloom chain (golden)
    var srcT = tLens;
    for (var b = 0; b < 4; b++) {
      bindTarget(bl[b]); gl.useProgram(P_DOWN.p);
      tex(P_DOWN, 'uSrc', 0, srcT.tex); u2(P_DOWN, 'uSrcTexel', 0.5 / srcT.w, 0.5 / srcT.h);
      u2(P_DOWN, 'uDstRes', bl[b].w, bl[b].h); u1(P_DOWN, 'uThresh', b === 0 ? 0.55 : 0);
      drawTri();
      gl.useProgram(P_BLUR.p);
      bindTarget(bt[b]); tex(P_BLUR, 'uSrc', 0, bl[b].tex); u2(P_BLUR, 'uDir', 1 / bl[b].w, 0); u2(P_BLUR, 'uDstRes', bt[b].w, bt[b].h); drawTri();
      bindTarget(bl[b]); tex(P_BLUR, 'uSrc', 0, bt[b].tex); u2(P_BLUR, 'uDir', 0, 1 / bt[b].h); u2(P_BLUR, 'uDstRes', bl[b].w, bl[b].h); drawTri();
      srcT = bl[b];
    }

    // ---- 5. final overlay composite (premultiplied, vignette-free)
    bindTarget(null);
    gl.useProgram(P_FINAL.p);
    tex(P_FINAL, 'uLens', 0, tLens.tex); tex(P_FINAL, 'uB0', 1, bl[0].tex); tex(P_FINAL, 'uB1', 2, bl[1].tex);
    tex(P_FINAL, 'uB2', 3, bl[2].tex); tex(P_FINAL, 'uB3', 4, bl[3].tex);
    var st0 = headOrder[0];
    var gC = worldToOverlay(st0.f.x, st0.f.y, cam, 1);
    u2(P_FINAL, 'uRes', GAME, GAME); u2(P_FINAL, 'uCuv', clamp01(gC[0] / GAME), clamp01(gC[1] / GAME));
    var maxFlash = 0;
    for (var z = 0; z < singCount; z++) maxFlash = Math.max(maxFlash, singFlash[z]);
    u1(P_FINAL, 'uCA', 0.3 * Math.max(0, st0.SP.suck.v) + 0.4 * maxFlash);
    u1(P_FINAL, 'uTime', T); u1(P_FINAL, 'uBloom', hasFloat ? 0.9 : 1.4); u1(P_FINAL, 'uExposure', 1.15);
    drawTri();
  }

  /* ---------------- adaptive quality (golden strategy) ---------------- */
  function perfTick(rawDt) {
    perfAcc += rawDt; perfN++;
    if (perfAcc >= 2) {
      var avg = perfAcc / perfN * 1000;
      if (avg > 30 && quality > 0.5) { quality = Math.max(0.5, quality * 0.75); allocTargets(); }
      else if (avg < 17 && quality < 1) { quality = Math.min(1, quality * 1.15); allocTargets(); }
      perfAcc = 0; perfN = 0;
    }
  }

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (failed || !gl) return;
    var rawDt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
    lastNow = now;
    if (!wrapped) return;                 // engine draws drive the render
    try {
      syncOverlayRect();
      perfTick(rawDt);
    } catch (e) { fail(e); }
  }

  function fail(e) {
    failed = true;
    try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (_) {}
    try { restoreOriginalDraw(); } catch (_) {}
    console.error('[blackholeGoldenVisual] disabled:', e);
  }

  /* ---------------- 2D body replacement (soft gravitational shadow) ---------------- */
  var originalDraw = null;
  function patchBlackholeType() {
    var types = window.FighterTypes;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      if (t && t.name === 'BLACK_HOLE') {
        originalDraw = t.draw;
        t.draw = function (c, f) {
          var T = Math.PI * 2;
          var g = c.createRadialGradient(0, 0, f.radius * 0.15, 0, 0, f.radius * 1.55);
          g.addColorStop(0, 'rgba(5,2,10,0.9)');
          g.addColorStop(0.55, 'rgba(12,5,22,0.38)');
          g.addColorStop(1, 'rgba(12,5,22,0)');
          c.fillStyle = g;
          c.beginPath(); c.arc(0, 0, f.radius * 1.55, 0, T); c.fill();
          if (f.isRage) {
            c.strokeStyle = 'rgba(150,90,220,0.55)'; c.lineWidth = 3;
            c.beginPath(); c.arc(0, 0, f.radius * 1.2, 0, T); c.stroke();
          }
        };
        return true;
      }
    }
    return false;
  }
  function restoreOriginalDraw() {
    var types = window.FighterTypes;
    if (!types || !originalDraw) return;
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      if (t && t.name === 'BLACK_HOLE') { t.draw = originalDraw; originalDraw = null; return; }
    }
  }

  /* ---------------- hook: render right after each engine draw ---------------- */
  function wrapEngineDraw() {
    var base = window.draw;
    if (typeof base !== 'function') return false;
    window.draw = function () {
      var r = base.apply(this, arguments);
      try { renderFrame(lastNow ? Math.min(0.05, (performance.now() - lastNow) / 1000) : 1 / 60); lastNow = performance.now(); }
      catch (e) { fail(e); }
      return r;
    };
    wrapped = true;
    return true;
  }

  function createOverlay() {
    gameCanvas = document.getElementById('game-canvas');
    if (!gameCanvas) return false;
    overlay = document.createElement('canvas');
    overlay.id = 'blackhole-golden-overlay';
    overlay.width = GAME; overlay.height = GAME;
    var s = overlay.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.zIndex = '6';
    s.display = 'none';
    if (getComputedStyle(gameCanvas).position === 'static') gameCanvas.style.position = 'relative';
    gameCanvas.parentNode.insertBefore(overlay, gameCanvas.nextSibling);
    return true;
  }

  function init() {
    if (window.apexBlackholeGoldenVisualRuntime === 'ready') return;
    if (!window.FighterTypes || typeof window.draw !== 'function' || !document.getElementById('game-canvas')) return false;
    if (!patchBlackholeType()) return false;
    if (!createOverlay()) return false;
    try { initGL(); } catch (e) { fail(e); return true; } // stop polling; old visual restored
    if (!wrapEngineDraw()) { fail(new Error('could not wrap engine draw')); return true; }
    requestAnimationFrame(frameLoop);
    window.apexBlackholeGoldenVisualRuntime = 'ready';
    window.__BH_GOLDEN_DEBUG = {
      headCount: function () { return heads.size; },
      wellCount: function () { var n = 0; wells.forEach(function () { n++; }); return n; },
      singCount: function () { return singCount; },
      quality: function () { return quality; },
      overlayReady: function () { return !!(gl && overlay); }
    };
    console.info('[blackholeGoldenVisual] golden BLACK_HOLE visual active');
    return true;
  }

  // engine + React mount arrive at different times — poll until ready
  var tries = 0;
  var bootPoll = setInterval(function () {
    tries++;
    var done = false;
    try { done = init(); } catch (e) { fail(e); done = true; }
    if (done || tries > 600) clearInterval(bootPoll);
  }, 200);
})();
`;

const out = `${banner}
// GLSL strings are emitted as JSON literals (safe escaping, zero runtime
// template interpolation). Source: golden pipeline build, see banner.
window.__BLACKHOLE_GOLDEN_GLSL = {
COMMON: ${JSON.stringify(COMMON)},
VS_TRI: ${JSON.stringify(VS_TRI)},
FS_SCENE_HEAD: ${JSON.stringify(FS_SCENE_HEAD)},
VS_PART: ${JSON.stringify(VS_PART)},
FS_PART: ${JSON.stringify(FS_PART)},
FS_DOWN: ${JSON.stringify(FS_DOWN)},
FS_BLUR: ${JSON.stringify(FS_BLUR)},
FS_LENS_OV: ${JSON.stringify(FS_LENS_OV)},
FS_FINAL_OV: ${JSON.stringify(FS_FINAL_OV)},
};
${driver.replace('/* ---------------- tiny math (golden helpers) ---------------- */', '/* ---------------- tiny math (golden helpers) ---------------- */\n  var GL = window.__BLACKHOLE_GOLDEN_GLSL;\n  var FS_SCENE_HEAD = GL.FS_SCENE_HEAD;\n  var FS_LENS_OV = GL.FS_LENS_OV;\n  var FS_FINAL_OV = GL.FS_FINAL_OV;\n  var VS_TRI = GL.VS_TRI;\n  var VS_PART = GL.VS_PART;\n  var FS_PART = GL.FS_PART;\n  var FS_DOWN = GL.FS_DOWN;\n  var FS_BLUR = GL.FS_BLUR;')}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, (out.length / 1024).toFixed(1) + ' KB');
