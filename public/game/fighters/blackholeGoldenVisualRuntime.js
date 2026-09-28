// BLACK_HOLE golden hero visual — GENERATED FILE, DO NOT EDIT BY HAND.
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
// (alpha-carrying lens, vignette-free premultiplied final).
// GLSL strings are emitted as JSON literals (safe escaping, zero runtime
// template interpolation). Source: golden pipeline build, see banner.
window.__BLACKHOLE_GOLDEN_GLSL = {
COMMON: "precision highp float;\n#define PI 3.14159265359\n#define TAU 6.28318530718\nmat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }\nfloat hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }\nvec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }\nfloat gnoise(vec2 p){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float a=dot(hash22(i)*2.-1., f);\n  float b=dot(hash22(i+vec2(1,0))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(i+vec2(0,1))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(i+vec2(1,1))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat pnoise(vec2 p, float P){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float x0=mod(i.x,P), x1=mod(i.x+1.,P);\n  float a=dot(hash22(vec2(x0,i.y))*2.-1., f);\n  float b=dot(hash22(vec2(x1,i.y))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(vec2(x0,i.y+1.))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(vec2(x1,i.y+1.))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat fbm(vec2 p, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*gnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; }\n  return s;\n}\nfloat pfbm(vec2 p, float P, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<5;i++){ if(i>=oct) break; s+=a*pnoise(p,P); p=p*2.+vec2(0.,1.37); P*=2.; a*=.5; }\n  return s;\n}\nvec3 L(vec3 c){ return pow(c, vec3(2.2)); }\nfloat sdSeg(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }\n",
VS_TRI: "#version 300 es\nlayout(location=0) in vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos,0.,1.); }",
FS_SCENE_HEAD: "#version 300 es\nprecision highp float;\n#define PI 3.14159265359\n#define TAU 6.28318530718\nmat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }\nfloat hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }\nvec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }\nfloat gnoise(vec2 p){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float a=dot(hash22(i)*2.-1., f);\n  float b=dot(hash22(i+vec2(1,0))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(i+vec2(0,1))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(i+vec2(1,1))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat pnoise(vec2 p, float P){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float x0=mod(i.x,P), x1=mod(i.x+1.,P);\n  float a=dot(hash22(vec2(x0,i.y))*2.-1., f);\n  float b=dot(hash22(vec2(x1,i.y))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(vec2(x0,i.y+1.))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(vec2(x1,i.y+1.))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat fbm(vec2 p, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*gnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; }\n  return s;\n}\nfloat pfbm(vec2 p, float P, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<5;i++){ if(i>=oct) break; s+=a*pnoise(p,P); p=p*2.+vec2(0.,1.37); P*=2.; a*=.5; }\n  return s;\n}\nvec3 L(vec3 c){ return pow(c, vec3(2.2)); }\nfloat sdSeg(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }\n\nout vec4 fragColor;\nuniform vec2 uRes, uCenter, uSway;\nuniform float uScale, uTime, uSwayR, uBreath;\nuniform float uBandPhase, uSwirlPhase, uInflow, uFall, uStarSpin;\nuniform float uSuck, uTension, uStress, uBlink, uEye, uSquint, uTwist;\nuniform vec4 uShardA[16];\nuniform vec4 uShardB[16];\nuniform float uGrowth, uVuln, uEscrow, uHitFlash, uKo;\n\nuniform vec2 uSeat;\n#define SC uSeat\nfloat PX;\n\n// egg metric: wide cranium, tapered chin (face void boundary at E = 0.5)\nfloat eggE(vec2 p){\n  float sx = 1.0 + 0.30*smoothstep(0.25, -0.85, p.y);\n  float sy = mix(0.73, 0.84, smoothstep(-0.15, 0.15, p.y));\n  return length(vec2(p.x*sx, p.y*sy));\n}\n\nfloat starLayer(vec2 uv, float pxs, float seed){\n  vec2 id = floor(uv), gv = fract(uv) - 0.5;\n  float n = hash12(id + seed*17.3);\n  if(n < 0.62) return 0.0;\n  vec2 off = (hash22(id + seed*3.1) - 0.5)*0.76;\n  vec2 dd = gv - off;\n  float n2 = fract(n*37.17);\n  float sz = max(pxs*0.75, 1e-4)*(1.0 + 1.3*pow(n2, 8.0));\n  float b = exp(-dot(dd,dd)/(sz*sz));\n  float tw = 0.72 + 0.28*sin(uTime*(0.5 + n2*1.6) + n*60.0);\n  return b*tw*(0.12 + 1.4*pow(n2, 3.0));\n}\n\nvec2 vor2(vec2 x){\n  vec2 i=floor(x), f=fract(x); float f1=8., f2=8.;\n  for(int yy=-1;yy<=1;yy++) for(int xx=-1;xx<=1;xx++){\n    vec2 g=vec2(float(xx),float(yy)); vec2 o=hash22(i+g); vec2 r=g+o-f; float d=dot(r,r);\n    if(d<f1){ f2=f1; f1=d; } else if(d<f2){ f2=d; }\n  }\n  return vec2(sqrt(f1), sqrt(f2));\n}\n\n/* ---------- inner universe ---------- */\nfloat nebField(vec2 q, float seed){\n  float tt = uTime*0.01;\n  vec2 w = vec2(fbm(q*1.1 + vec2(seed, tt), 3), fbm(q*1.1 + vec2(5.2 - tt, 1.3 + seed), 3));\n  return fbm(q*1.8 + w*1.8 + seed, 5);\n}\n\nvec3 cosmos(vec2 hp, float fE){\n  vec2 d = hp - SC; float r = length(d);\n\n  // nebula volume: two depth slices flowing in scale-space toward/away from the\n  // singularity seat. two-phase crossfade (Vlachos) + variance-preserving blend.\n  float ph = uFall*0.5;\n  float fa = fract(ph), fb = fract(ph + 0.5);\n  float wa = 1.0 - abs(2.0*fa - 1.0), wb = 1.0 - wa;\n  vec2 dn = rot(uStarSpin*0.3)*d;\n  float na = nebField(dn*exp2(fa) + uSway*1.5, floor(ph)*7.31);\n  float nb = nebField(dn*exp2(fb) + uSway*1.5, floor(ph + 0.5)*7.31 + 3.7);\n  float n = (wa*na + wb*nb)/sqrt(wa*wa + wb*wb);\n\n  vec3 col = vec3(0.0);\n  float dens = smoothstep(-0.2 - 0.20*uEscrow - 0.10*uGrowth, 0.5, n);\n  col += L(vec3(0.15,0.07,0.36))*dens*0.7;\n  col += L(vec3(0.42,0.14,0.72))*pow(smoothstep(0.1, 0.55, n), 2.0)*0.8;\n  col += L(vec3(0.95,0.6,1.0))*pow(smoothstep(0.38, 0.75, n), 4.0)*0.9;\n  float lowC = smoothstep(0.1, -0.55, hp.y)*smoothstep(0.42, 0.05, abs(hp.x));\n  float m = mix(0.22, 0.85, smoothstep(0.35, 1.0, fE))*(1.0 - 0.75*lowC);\n  m *= 1.0 - 0.7*smoothstep(0.28, 0.0, r);\n  col *= m*(1.0 + 0.30*uGrowth + 0.35*uEscrow);\n\n  // stars with real depth: 4 layers cycling in depth (BigWings layering), zoom centred on the seat\n  vec3 st = vec3(0.0);\n  for(int i=0;i<4;i++){\n    float fi = float(i);\n    float z = fi*0.25 + uFall*0.5;\n    float dep = fract(z);\n    float sc = 8.0*exp2(dep*2.4);\n    float fade = smoothstep(0.0, 0.18, dep)*smoothstep(1.0, 0.72, dep);\n    vec2 sq = rot(uStarSpin*(0.5 + dep))*d + uSway*(1.0 - dep)*2.5;\n    vec2 uv = sq*sc + vec2(fi*37.7, fi*11.3) + floor(z)*vec2(13.1, 7.7);\n    float s = starLayer(uv, PX*sc, fi + floor(z));\n    vec3 sCol = mix(vec3(0.75,0.8,1.0), vec3(1.0,0.8,1.0), hash12(floor(uv)+3.0));\n    st += sCol*s*fade;\n  }\n  col += st*(0.65 + 0.35*smoothstep(0.2, 0.9, fE))*(1.0 + 0.35*uGrowth);\n\n  // distant galaxies — scale cue that this is a universe, not a texture\n  for(int g=0; g<2; g++){\n    vec2 gp = g==0 ? vec2(-0.26, 0.05) : vec2(0.29, 0.24);\n    vec2 gq = rot(g==0 ? 0.6 : -0.9)*(hp - gp + uSway*1.5);\n    gq.y *= 2.6;\n    float gr = length(gq);\n    float ga = atan(gq.y, gq.x);\n    float arms = 0.6 + 0.4*sin(2.0*ga + log(gr + 1e-3)*6.0 - uTime*0.02);\n    col += L(vec3(0.8,0.65,1.0))*exp(-gr*95.0)*0.8 + L(vec3(0.5,0.3,0.9))*exp(-gr*38.0)*arms*0.1;\n  }\n\n  // forehead vortex: brush-stroke strata in log-polar space (translation in log-polar\n  // = rigid rotation + self-similar inflow, never winds up)\n  float lr = log(max(r, 1e-3));\n  float a = atan(d.y, d.x)/TAU;\n  float tw = 0.14 + 0.2*uTwist;\n  float su = (a - tw*lr + uSwirlPhase)*5.0;\n  float sv = lr*6.5 + uInflow;\n  float s1 = pfbm(vec2(su, sv), 5.0, 4);\n  float s2 = pnoise(vec2(su*4.0, sv*0.6 + 3.0), 20.0);\n  float strokes = smoothstep(-0.02, 0.42, s1 + s2*0.12);\n  float vm = smoothstep(0.66, 0.2, r)*smoothstep(0.03, 0.16, r)*smoothstep(-0.28, 0.05, hp.y);\n  col += mix(L(vec3(0.09,0.06,0.28)), L(vec3(0.3,0.2,0.72)), strokes*strokes)*strokes*vm*(0.9 + 1.8*uSuck + 1.2*uTension);\n  return col;\n}\n\n/* ---------- eyes: ruptures in the shell exposing the hot layer behind ---------- */\nvec3 eyeShade(vec2 hp, float side, out float spill, out float dOut){\n  vec2 q = vec2(hp.x*side, hp.y);\n  const vec2 I = vec2(0.112, -0.372);\n  const vec2 O = vec2(0.36, -0.172);\n  vec2 ax = O - I; float Ln = length(ax); vec2 ad = ax/Ln; vec2 nd = vec2(-ad.y, ad.x);\n  vec2 rel = q - I;\n  float u = dot(rel, ad), v = dot(rel, nd);\n  float un = u/Ln, unc = clamp(un, 0.0, 1.0);\n  v -= 0.016*sin(PI*unc);                                 // slight arch in the hard lid line\n  float prof = pow(unc, 0.45)*pow(1.0 - unc, 1.1)/0.393;  // fat near the bridge, long blade outward\n  float H = 0.074*(1.0 - 0.5*uSquint);\n  float h = H*prof;\n  float top = -h*uBlink*0.97;                             // lid descends from the flat top edge\n  float bot = -h*(1.0 + 0.04*sin(uTime*0.9 + side));\n  float dv = max(v - top, bot - v);\n  float du = max(-u, u - Ln);\n  float d = max(dv, du*0.8);\n  d += gnoise(q*42.0 + vec2(side*7.1, uTime*0.12))*0.0042 + gnoise(q*110.0 + side*3.3)*0.0018; // torn rim\n  dOut = d;\n\n  float Ie = uEye*(1.0 - 0.38*uVuln)*(0.93 + 0.07*sin(uTime*1.1 + side*0.7));\n  float aa = PX*1.3;\n  float inside = smoothstep(aa, -aa, d);\n  float T = max(top - bot, 1e-4);\n  float depth = clamp(-d/(0.5*T), 0.0, 1.0);\n  float pl = fbm(vec2(u*22.0 - uTime*0.5, v*38.0 + side*4.0), 3);\n  float bias = mix(1.0, 0.5, smoothstep(0.22 + 0.08*sin(uTime*0.31 + side), 1.0, unc));\n  float core = pow(depth, 1.1)*bias + pl*0.3;\n  vec3 cV = L(vec3(0.64,0.2,1.0)), cM = L(vec3(0.86,0.42,1.0));\n  vec3 inC = mix(cV*2.4, vec3(1.0,0.95,1.0)*6.0, smoothstep(0.18, 0.78, core));\n  vec3 col = inC*inside*Ie;\n  float rim = exp(-abs(d)/(PX*1.4 + 0.0011));\n  col += cM*rim*2.2*Ie;\n  float dd = max(d, 0.0);\n  float dirB = 1.0 + 0.9*smoothstep(0.2, 1.3, un);\n  col += cV*(exp(-dd*40.0) + exp(-dd*10.0)*0.3)*dirB*(1.0 - 0.45*uBlink)*Ie*0.9;\n\n  // outer tail: the tear continues as a hairline fracture toward the temple\n  float ut = u - Ln;\n  if(ut > -0.02 && ut < 0.12){\n    float utp = max(ut, 0.0);\n    float vt = v - 2.2*utp*utp;\n    float wdt = 0.0032*(1.0 - utp/0.12) + 0.0004;\n    col += cM*exp(-abs(vt)/wdt)*smoothstep(0.12, 0.02, utp)*step(-0.005, ut)*1.8*Ie;\n  }\n  // inner hook: sharp predatory point dropping toward the bridge\n  {\n    vec2 hd = normalize(vec2(-0.42, -1.0));\n    float hh; float dh = sdSeg(q, I + vec2(0.004, 0.004), I + hd*0.052, hh);\n    float wdt = 0.0036*(1.0 - hh) + 0.0004;\n    col += mix(cM*2.0, vec3(3.0), 0.25)*exp(-dh/wdt)*Ie*(1.0 - 0.6*uBlink);\n  }\n  // fracture veins in the surrounding shell\n  if(dd < 0.085){\n    vec2 f = vor2(q*24.0 + side*5.3);\n    float cr = exp(-(f.y - f.x)*26.0);\n    float cm = smoothstep(0.085, 0.0, dd)*smoothstep(0.1, 0.45, gnoise(q*8.0 + side*2.0) + 0.25);\n    col += cV*cr*cm*0.4*Ie;\n  }\n  spill = exp(-dd*7.0)*0.55*Ie*(1.0 - 0.55*uBlink);\n  return col;\n}\n\nfloat browRidge(vec2 hp, float fE){\n  vec2 q = vec2(abs(hp.x), hp.y);\n  float ang = atan(q.y, q.x);\n  float m = smoothstep(-0.72, -0.48, ang)*smoothstep(0.62, -0.05, ang);\n  return (exp(-abs(fE - 0.975)*80.0) + exp(-abs(fE - 0.96)*16.0)*0.22)*m;\n}\n\n// eye energy drawn up into the forehead\nvec3 eyeStreams(vec2 hp){\n  if(uSuck < 0.01) return vec3(0.0);\n  vec3 acc = vec3(0.0);\n  for(int e=0;e<2;e++){\n    float sd = e==0 ? 1.0 : -1.0;\n    vec2 P0 = vec2(0.175*sd, -0.3), P1 = vec2(0.25*sd, -0.03), P2 = SC;\n    float best = 1e3, bt = 0.0;\n    vec2 prev = P0;\n    for(int i=1;i<=12;i++){\n      float t1 = float(i)/12.0;\n      vec2 cur = mix(mix(P0,P1,t1), mix(P1,P2,t1), t1);\n      float h; float dd = sdSeg(hp, prev, cur, h);\n      if(dd < best){ best = dd; bt = (float(i-1) + h)/12.0; }\n      prev = cur;\n    }\n    float reach = uSuck*1.25;\n    float grow = smoothstep(reach, reach - 0.15, bt);\n    float wdt = mix(0.010, 0.0025, bt);\n    float core = exp(-pow(best/wdt, 2.0));\n    float glow = exp(-best/0.035)*0.22;\n    float nz = clamp(0.55 + 1.3*fbm(vec2(bt*10.0 - uTime*3.2, sd*4.0 + uTime*0.2), 3), 0.0, 1.6);\n    float fadeEnds = smoothstep(0.0, 0.06, bt)*smoothstep(1.0, 0.82, bt);\n    vec3 c = mix(L(vec3(0.62,0.25,1.0)), vec3(1.0,0.93,1.0), core*0.7);\n    acc += c*(core*2.0 + glow)*nz*grow*fadeEnds;\n  }\n  return acc*uSuck*uEye;\n}\n\n/* ---------- orbiting matter: stacked sheets of torn, perforated substance ---------- */\nfloat holesF(vec2 x, float P){\n  vec2 i = floor(x), f = fract(x);\n  float res = 0.0;\n  for(int yy=-1; yy<=1; yy++){\n    for(int xx=-1; xx<=1; xx++){\n      vec2 g = vec2(float(xx), float(yy));\n      vec2 id = i + g; id.x = mod(id.x, P);\n      vec2 hh = hash22(id + 17.0);\n      vec2 o = 0.5 + (hh - 0.5)*0.7;\n      vec2 dv = (g + o - f)*vec2(1.0, 1.2);\n      float rad = 0.2 + 0.24*hh.y;\n      float on = step(0.4, fract(hh.x*7.13 + hh.y*3.1));\n      res = max(res, on*smoothstep(rad, rad*0.45, length(dv)));\n    }\n  }\n  return res;\n}\n\nvec4 bandSheet(vec2 bp, float rB, float s, float phase, float swirlK, float freq, float thr,\n               float ridgeW, float seed, bool holes, float bright, vec3 eyeL){\n  // rigid orbit + trailing shear (outer lags, Keplerian feel) + bounded tidal breathing\n  float sw = -swirlK*rB*rB + 0.2*sin(uTime*0.09 + seed*1.7)*(rB - 0.72);\n  vec2 q = rot(phase + sw)*bp;\n  float tt = uTime*0.03;\n  vec2 w = vec2(fbm(q*freq*0.6 + vec2(seed, tt), 3), fbm(q*freq*0.6 + vec2(tt*0.8 + 5.2, seed + 1.3), 3));\n  float n = fbm(q*freq + w*1.25 + seed*2.0, 5);\n  float rdg = ridgeW > 0.0 ? 1.0 - 2.0*abs(fbm(q*freq*1.7 + w*1.8 + seed + 11.0, 3)) : 0.66;\n  float env = smoothstep(-0.02, 0.14, s)*smoothstep(1.06, 0.58, s);\n  float D = n + (rdg - 0.66)*ridgeW + env*0.72 - 0.37 + thr;\n  float aq = atan(q.y, q.x)/TAU + 0.5;\n  if(holes){\n    vec2 cc = vec2(aq*26.0, rB*10.0) + w*vec2(2.0, 0.9);\n    D -= holesF(cc, 26.0)*0.75;\n  }\n  float aa = fwidth(D) + 1e-4;\n  float alpha = smoothstep(-aa, aa*0.6, D);\n  float hgt = smoothstep(0.0, 0.2, D);\n  vec2 g = vec2(dFdx(hgt), dFdy(hgt))/PX;\n  vec3 N = normalize(vec3(-g*0.016, 1.0));\n  vec3 Lk = normalize(vec3(-0.45, 0.62, 0.64));\n  float dif = max(dot(N, Lk), 0.0);\n  float spec = pow(max(dot(N, normalize(Lk + vec3(0.0,0.0,1.0))), 0.0), 26.0);\n  float rim = pow(1.0 - hgt, 2.2);\n  float stri = pnoise(vec2(aq*40.0, rB*70.0), 40.0);\n  float fold = smoothstep(-0.15, 0.5, n*1.4 + stri*0.28 + w.x*0.6);\n  vec3 cDeep = L(vec3(0.075,0.045,0.13)), cMid = L(vec3(0.38,0.26,0.58)), cLav = L(vec3(0.84,0.7,1.0)), cVio = L(vec3(0.62,0.28,1.0));\n  vec3 col = mix(cDeep, cMid, fold*(0.3 + 0.7*dif));\n  col = mix(col, cLav, pow(fold, 3.0)*dif*0.55);\n  col += cLav*rim*(0.3 + 1.1*dif + 0.9*spec);\n  col += vec3(1.0,0.95,1.0)*spec*0.8*(0.25 + rim);\n  float eT = eyeL.z*(0.3 + 1.6*max(dot(N.xy, eyeL.xy), 0.0));\n  col += cVio*eT*(0.4 + 1.6*rim);\n  vec2 toC = SC - bp; float dC = length(toC);\n  float cT = uSuck*exp(-dC*2.4)*(0.25 + 1.8*max(dot(N.xy, toC/max(dC,1e-3)), 0.0));\n  col += mix(cVio, vec3(1.0,0.9,1.0), 0.35)*cT*(0.35 + 1.6*rim);\n  col += cVio*uStress*rim*(0.6 + 1.6*smoothstep(0.35, 0.95, s));\n  float spk = starLayer(q*55.0 + seed*9.0, PX*55.0, seed + 5.0);\n  col += vec3(0.85,0.8,1.0)*spk*hgt*0.6;\n  return vec4(col*bright, alpha);\n}\n\n/* ---------- detached shards (driven by CPU orbital sim, spaghettify when captured) ---------- */\nfloat sdVesica(vec2 p, float r, float d){\n  p = abs(p); float b = sqrt(r*r - d*d);\n  return ((p.y - b)*d > p.x*b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;\n}\nvec4 overC(vec4 u, vec4 s){ return vec4(s.rgb*s.a + u.rgb*(1.0-s.a), s.a + u.a*(1.0-s.a)); }\nvec4 shards(vec2 hp, vec4 col){\n  vec3 cDeep=L(vec3(0.07,0.04,0.12)), cMid=L(vec3(0.42,0.3,0.66)), cLav=L(vec3(0.85,0.72,1.0)), cVio=L(vec3(0.62,0.28,1.0));\n  for(int i=0;i<16;i++){\n    vec4 A = uShardA[i], B = uShardB[i];\n    if(B.y < 0.004) continue;\n    vec2 lp = hp - A.xy;\n    float ext = A.w*B.x*0.75 + 0.02;\n    if(dot(lp,lp) > ext*ext) continue;\n    lp = rot(-A.z)*lp/A.w;\n    lp.y /= B.x; lp.x *= sqrt(B.x);\n    lp.x -= 0.3*lp.y*lp.y - 0.06;\n    float ds = sdVesica(lp, 1.0, 0.8)*A.w;\n    float al = smoothstep(PX, -PX, ds)*B.y;\n    if(al < 0.001) continue;\n    float inr = clamp(-ds/(0.2*A.w), 0.0, 1.0);\n    float side = smoothstep(-0.2, 0.2, lp.x + 0.1*lp.y);\n    vec3 sc = mix(cMid*(0.55 + 0.6*side), cDeep, smoothstep(0.3, 0.85, inr)*step(0.35, B.z));\n    sc += cLav*exp(-(-ds)/(0.03*A.w + PX))*(0.6 + 1.2*side);\n    sc += cVio*B.w*(0.8 + 1.5*(1.0 - inr));\n    col = overC(col, vec4(sc, al));\n  }\n  return col;\n}\n\n\nvoid main(){\n  PX = 1.0/uScale;\n  vec2 p = (gl_FragCoord.xy - uCenter)/uScale;\n  vec2 hp = rot(uSwayR)*(p - uSway)/uBreath;\n  float rC = length(hp);\n  vec3 add = vec3(0.7,0.72,1.0)*starLayer(p*22.0 + 91.0, PX*22.0, 9.0)*0.16;\n  vec4 ov = vec4(0.0);\n  if(rC < 1.3){\n    float E = eggE(hp); float fE = E/0.5;\n    vec3 cs = cosmos(hp, fE);\n    float faceM = 1.0 - smoothstep(0.97, 1.1, fE);\n    float headM = 1.0 - smoothstep(0.84, 0.97, length(hp*vec2(1.05,0.97)));\n    vec3 inner = cs*mix(0.3, 1.0, faceM);\n    inner *= mix(1.0, 0.55, smoothstep(0.78, 1.0, fE)*faceM);\n    inner += L(vec3(0.3,0.14,0.62))*exp(-abs(fE - 1.0)*14.0)*0.05*faceM;\n    inner *= mix(1.0, 0.74, uVuln);                       // exposed: shell thins\n    ov = vec4(inner*headM, headM);\n    float spR, spL, dR, dL;\n    vec3 eR = eyeShade(hp, 1.0, spR, dR);\n    vec3 eL = eyeShade(hp, -1.0, spL, dL);\n    ov.rgb += eR + eL;\n    ov.rgb += cs*(spR + spL)*3.0*faceM;\n    ov.rgb += L(vec3(0.68,0.28,1.0))*browRidge(hp, fE)*uEye*(1.0 - 0.6*uBlink)*1.3;\n    ov.rgb += eyeStreams(hp);\n    float dc = length(hp - SC);\n    ov.rgb += L(vec3(0.55,0.3,1.0))*uTension*exp(-dc*9.0)*0.25;\n    if(rC > 0.33){\n      vec2 bp = SC + (hp - SC)*(1.0 + uSuck*0.32*exp(-length(hp - SC)*2.2));\n      float rB = length(bp);\n      float rI = (0.5 - 0.07*uGrowth)*rB/max(eggE(bp), 1e-3);\n      float rO = (0.9 + 0.42*uGrowth)*rB/max(length(bp*vec2(1.05,0.97)), 1e-3);\n      float s = (rB - rI)/max(rO - rI, 1e-3);\n      s += 0.025*sin(uTime*0.37 + atan(bp.y, bp.x)*2.0);\n      vec2 E0 = vec2(sign(bp.x)*0.22, -0.29);\n      vec2 te = E0 - bp; float de = length(te);\n      vec3 eyeL = vec3(te/max(de,1e-3), uEye*exp(-de*4.2)*0.9*(1.0 - 0.5*uBlink));\n      vec4 bk = bandSheet(bp, rB, s, uBandPhase*0.62, 0.9 + uSuck*0.8, 2.1, -0.08, 0.0, 3.0, false, 0.34, eyeL);\n      ov = overC(ov, vec4(bk.rgb, bk.a*0.94*(1.0 - 0.35*uVuln)));\n      vec4 md = bandSheet(bp, rB, s, uBandPhase, 1.4 + uSuck*1.6, 2.7, -0.12*uEscrow, 0.22, 0.0, true, 1.0, eyeL);\n      ov = overC(ov, vec4(md.rgb, md.a*(1.0 - 0.45*uVuln)));\n      vec4 fr = bandSheet(bp, rB, s + 0.07, uBandPhase*1.45, 2.0 + uSuck*2.2, 3.3, -0.6, 0.38, 7.0, false, 1.15, eyeL);\n      ov = overC(ov, vec4(fr.rgb, fr.a*(1.0 - 0.5*uVuln)));\n      float angTop = abs(atan(hp.x, hp.y));\n      float wave = 0.55 + 0.45*sin(angTop*6.0 + uTime*2.2);\n      float halo = exp(-max(rC - 0.84, 0.0)*7.0)*smoothstep(0.62, 0.86, rC);\n      add += L(vec3(0.6,0.22,1.0))*halo*uStress*wave*0.55;\n    }\n    add += L(vec3(0.6,0.22,1.0))*exp(-abs(fE - 1.0)*26.0)*uStress*0.35;\n    if(uVuln > 0.003){                                    // exposed shell fractures\n      vec2 cf = vor2(hp*26.0);\n      float crack = exp(-(cf.y - cf.x)*30.0);\n      add += L(vec3(0.55,0.3,1.0))*crack*uVuln*smoothstep(1.07, 0.92, fE)*smoothstep(0.85, 0.97, fE)*1.1;\n      add += L(vec3(0.35,0.15,0.6))*uVuln*smoothstep(0.9, 1.0, fE)*0.22;\n    }\n    add += L(vec3(0.75,0.5,1.0))*uHitFlash*(exp(-abs(fE - 1.0)*10.0)*0.85 + 0.10)*faceM;\n    ov = shards(hp, ov);\n  }\n  ov.rgb *= (1.0 - uKo*0.85);\n  fragColor = vec4(ov.rgb + add, ov.a);\n}",
VS_PART: "#version 300 es\nlayout(location=0) in vec2 aPos;\nlayout(location=1) in vec3 aData;\nuniform vec2 uRes, uCenter, uSway; uniform float uScale, uSwayR, uBreath;\nout vec3 vData;\nvoid main(){\n  float c = cos(-uSwayR), s = sin(-uSwayR);\n  vec2 hp = aPos*uBreath;\n  vec2 p = vec2(c*hp.x - s*hp.y, s*hp.x + c*hp.y) + uSway;\n  vec2 px = p*uScale + uCenter;\n  gl_Position = vec4(px/uRes*2.0 - 1.0, 0.0, 1.0);\n  gl_PointSize = aData.x;\n  vData = aData;\n}",
FS_PART: "#version 300 es\nprecision highp float;\nin vec3 vData; uniform float uPoint; out vec4 o;\nvoid main(){\n  float a = 1.0;\n  if(uPoint > 0.5){ vec2 c = gl_PointCoord*2.0 - 1.0; float d = dot(c,c); a = exp(-d*3.5)*step(d, 1.0); }\n  vec3 col = mix(vec3(0.42,0.22,1.0), vec3(1.0,0.93,1.0), vData.z);\n  o = vec4(col*vData.y*a, 1.0);\n}",
FS_DOWN: "#version 300 es\nprecision highp float;\nuniform sampler2D uSrc; uniform vec2 uSrcTexel, uDstRes; uniform float uThresh;\nout vec4 o;\nvoid main(){\n  vec2 uv = gl_FragCoord.xy/uDstRes;\n  vec3 c = texture(uSrc, uv + uSrcTexel*vec2(-1.0,-1.0)).rgb + texture(uSrc, uv + uSrcTexel*vec2(1.0,-1.0)).rgb\n         + texture(uSrc, uv + uSrcTexel*vec2(-1.0, 1.0)).rgb + texture(uSrc, uv + uSrcTexel*vec2(1.0, 1.0)).rgb;\n  c *= 0.25;\n  if(uThresh > 0.0){\n    float l = max(c.r, max(c.g, c.b));\n    float knee = 0.5;\n    float soft = clamp(l - uThresh + knee, 0.0, 2.0*knee);\n    soft = soft*soft/(4.0*knee + 1e-5);\n    c *= max(soft, l - uThresh)/max(l, 1e-5);\n  }\n  o = vec4(c, 1.0);\n}",
FS_BLUR: "#version 300 es\nprecision highp float;\nuniform sampler2D uSrc; uniform vec2 uDir, uDstRes;\nout vec4 o;\nvoid main(){\n  vec2 uv = gl_FragCoord.xy/uDstRes;\n  vec3 c = texture(uSrc, uv).rgb*0.2270270270;\n  c += (texture(uSrc, uv + uDir*1.3846153846).rgb + texture(uSrc, uv - uDir*1.3846153846).rgb)*0.3162162162;\n  c += (texture(uSrc, uv + uDir*3.2307692308).rgb + texture(uSrc, uv - uDir*3.2307692308).rgb)*0.0702702703;\n  o = vec4(c, 1.0);\n}",
FS_LENS_OV: "#version 300 es\nprecision highp float;\n#define PI 3.14159265359\n#define TAU 6.28318530718\nmat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }\nfloat hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }\nvec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }\nfloat gnoise(vec2 p){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float a=dot(hash22(i)*2.-1., f);\n  float b=dot(hash22(i+vec2(1,0))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(i+vec2(0,1))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(i+vec2(1,1))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat pnoise(vec2 p, float P){\n  vec2 i=floor(p), f=fract(p);\n  vec2 u=f*f*f*(f*(f*6.-15.)+10.);\n  float x0=mod(i.x,P), x1=mod(i.x+1.,P);\n  float a=dot(hash22(vec2(x0,i.y))*2.-1., f);\n  float b=dot(hash22(vec2(x1,i.y))*2.-1., f-vec2(1,0));\n  float c=dot(hash22(vec2(x0,i.y+1.))*2.-1., f-vec2(0,1));\n  float d=dot(hash22(vec2(x1,i.y+1.))*2.-1., f-vec2(1,1));\n  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;\n}\nfloat fbm(vec2 p, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*gnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; }\n  return s;\n}\nfloat pfbm(vec2 p, float P, int oct){\n  float s=0., a=.5;\n  for(int i=0;i<5;i++){ if(i>=oct) break; s+=a*pnoise(p,P); p=p*2.+vec2(0.,1.37); P*=2.; a*=.5; }\n  return s;\n}\nvec3 L(vec3 c){ return pow(c, vec3(2.2)); }\nfloat sdSeg(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }\n\nout vec4 o;\nuniform sampler2D uScene;\nuniform vec2 uRes;\nuniform int uNSing;\nuniform vec2 uC[5];\nuniform float uScaleA[5], uRs[5], uK[5], uSpin[5], uSuck[5];\nuniform float uShockR[5], uShockA[5], uFlash[5], uAccP[5], uAccIn[5], uTensionA[5], uHot[5];\nuniform float uTime;\nvec4 sampPx(vec2 px){ return texture(uScene, px/uRes); }\nvoid main(){\n  vec2 frag = gl_FragCoord.xy;\n  vec2 uv = frag;\n  for(int i=0;i<5;i++){\n    if(i >= uNSing) break;\n    vec2 p = (frag - uC[i])/uScaleA[i];\n    float r = length(p) + 1e-6; vec2 dir = p/r;\n    float K2 = uK[i]*abs(uK[i]);\n    float rsrc = sqrt(max(r*r + K2, 0.0));\n    float rs = uRs[i];\n    float drag = uSpin[i]*(max(K2,0.0) + 0.35*rs*rs)/(r*r + 0.35*abs(K2) + 0.25*rs*rs + 1e-4);\n    float x = (r - uShockR[i])/0.07;\n    rsrc += uShockA[i]*x*exp(-x*x)*0.035;\n    uv = uC[i] + rot(drag)*dir*rsrc*uScaleA[i];\n  }\n  vec4 px4 = sampPx(uv);\n  vec3 col = px4.rgb;\n  float A = px4.a;\n  for(int i=0;i<5;i++){\n    if(i >= uNSing) break;\n    vec2 p = (frag - uC[i])/uScaleA[i];\n    float r = length(p) + 1e-6; vec2 dir = p/r;\n    float K2 = uK[i]*abs(uK[i]);\n    float rsrc = sqrt(max(r*r + K2, 0.0));\n    float rs = uRs[i];\n    float PX = 1.0/uScaleA[i];\n    float drag = uSpin[i]*(max(K2,0.0) + 0.35*rs*rs)/(r*r + 0.35*abs(K2) + 0.25*rs*rs + 1e-4);\n    float streak = uSuck[i]*smoothstep(1.05, 0.12, r);\n    if(streak > 0.002){\n      vec3 tr = vec3(0.0), av = col; float ws = 0.0, wa = 1.0;\n      for(int k=1;k<10;k++){\n        float fi = float(k)/9.0;\n        float kk = fi*streak;\n        float ang = drag + kk*0.5*(0.1/(r + 0.06));\n        vec4 s4 = sampPx(uC[i] + rot(ang)*dir*rsrc*(1.0 + kk*0.22)*uScaleA[i]);\n        float w = exp(-fi*2.2);\n        tr += max(s4.rgb - 0.12, 0.0)*w; ws += w;\n        av += s4.rgb*w; wa += w;\n      }\n      col = mix(col, av/wa, 0.3*streak);\n      col += tr/ws*streak*1.1;\n    }\n    if(rs > 0.0008){\n      float lr = log(r/rs);\n      col *= mix(1.0, smoothstep(0.0, 0.55, lr), 0.6);\n      float a = atan(p.y, p.x)/TAU;\n      float su = (a - 0.32*lr + uAccP[i])*6.0;\n      float sv = lr*4.5 + uAccIn[i];\n      float n = pfbm(vec2(su, sv), 6.0, 4);\n      float n2 = pnoise(vec2(su*2.0 + 3.0, sv*2.2), 12.0);\n      float prof = smoothstep(-0.02, 0.18, lr)*exp(-max(lr, 0.0)*1.7);\n      float heat = exp(-max(lr, 0.0)*2.4);\n      vec3 accC = mix(L(vec3(0.45,0.16,0.95)), vec3(1.0,0.9,1.0), heat*0.85);\n      float dens = smoothstep(-0.2, 0.45, n + n2*0.25);\n      float open01 = smoothstep(0.0, 0.5, rs/0.125);\n      float acc = prof*dens*(0.5 + 2.2*heat)*(0.25 + 0.95*uSuck[i])*open01*uHot[i];\n      col += accC*acc;\n      float w1 = rs*0.028 + PX*0.9;\n      float x1 = (r - rs*1.075)/w1;\n      float x2 = (r - rs*1.2)/(rs*0.07);\n      float pr = exp(-x1*x1);\n      float pr2 = exp(-x2*x2);\n      float beam = 0.7 + 0.5*cos(TAU*a + 1.2 - uTime*0.5);\n      col += (vec3(1.0,0.9,1.0)*pr*2.6*beam + L(vec3(0.7,0.4,1.0))*pr2*0.5)*open01*uHot[i];\n      col *= smoothstep(rs - PX*1.2, rs + PX*1.2, r);\n      // overlay adaptation: coverage\n      float inH = 1.0 - smoothstep(rs - PX*1.2, rs + PX*1.2, r);\n      A = max(A, inH);\n      A = max(A, clamp(acc*1.4 + (pr*2.6*beam + pr2*0.5)*open01*uHot[i]*0.8, 0.0, 1.0));\n    }\n    float rr = r*r;\n    float fl = uFlash[i];\n    if(fl > 0.001){\n      col += vec3(1.0,0.9,1.0)*fl*exp(-rr/0.0012)*6.0;\n      col += L(vec3(0.62,0.25,1.0))*fl*exp(-r*7.0)*0.9;\n      A = max(A, clamp(fl*exp(-r*7.0)*1.2, 0.0, 1.0));\n    }\n    float tn = uTensionA[i]*(1.0 - smoothstep(0.0, 0.01, rs));\n    if(tn > 0.001){\n      col += L(vec3(0.8,0.5,1.0))*tn*exp(-rr/0.0005)*2.2;\n      A = max(A, clamp(tn*exp(-rr/0.0005)*2.0, 0.0, 1.0));\n    }\n  }\n  o = vec4(col, A);\n}",
FS_FINAL_OV: "#version 300 es\nprecision highp float;\nuniform sampler2D uLens, uB0, uB1, uB2, uB3;\nuniform vec2 uRes, uCuv; uniform float uCA, uTime, uBloom, uExposure;\nout vec4 o;\nfloat h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }\nvec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }\nvoid main(){\n  vec2 uv = gl_FragCoord.xy/uRes;\n  float asp = uRes.x/uRes.y;\n  vec2 dv = uv - uCuv;\n  float dl = length(dv*vec2(asp, 1.0));\n  float ca = 0.0012 + uCA*exp(-dl*5.0)*0.02;\n  vec2 off = dv*ca;\n  vec4 px;\n  px.r = texture(uLens, uv - off).r;\n  px.g = texture(uLens, uv).g;\n  px.b = texture(uLens, uv + off).b;\n  px.a = texture(uLens, uv).a;\n  vec3 b = texture(uB0, uv).rgb*0.55 + texture(uB1, uv).rgb*0.6 + texture(uB2, uv).rgb*0.7 + texture(uB3, uv).rgb*0.8;\n  vec3 col = px.rgb + b*uBloom;\n  float lum = dot(col, vec3(0.30, 0.45, 0.25));\n  float A = clamp(max(px.a, lum), 0.0, 1.0);\n  col *= uExposure;\n  col = aces(col);\n  vec2 q = (uv - 0.5)*vec2(asp, 1.0);\n  col *= 1.0 - dot(q, q)*0.3;\n  col = pow(col, vec3(1.0/2.2));\n  col += (h12(gl_FragCoord.xy + fract(uTime*7.13)*97.0) - 0.5)*0.014*A;\n  o = vec4(col, A);\n}",
FS_BLIT: "#version 300 es\nprecision highp float;\nuniform sampler2D uTex;\nuniform vec2 uRes;\nout vec4 o;\nvoid main(){\n  vec2 uv = gl_FragCoord.xy/uRes;\n  o = vec4(texture(uTex, uv).rgb, 1.0);\n}",
};

(function () {
  if (window.apexBlackholeGoldenVisualRuntime === 'ready') return;

  /* ---------------- tiny math (golden helpers) ---------------- */
  var GL = window.__BLACKHOLE_GOLDEN_GLSL;
  var FS_SCENE_HEAD = GL.FS_SCENE_HEAD;
  var FS_LENS_OV = GL.FS_LENS_OV;
  var FS_FINAL_OV = GL.FS_FINAL_OV;
  var VS_TRI = GL.VS_TRI;
  var VS_PART = GL.VS_PART;
  var FS_PART = GL.FS_PART;
  var FS_DOWN = GL.FS_DOWN;
  var FS_BLUR = GL.FS_BLUR;
  var FS_BLIT = GL.FS_BLIT;
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
  var T = 0, lastNow = 0, lastRenderT = 0, perfAcc = 0, perfN = 0, wrapped = false, failed = false;
  var gameCanvas = null;
  var texGame = null, texGameW = 0, texGameH = 0, lastGlError = 0;
  var P_BLIT = null;

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
    P_BLIT = program(VS_TRI, FS_BLIT);
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
    texGame = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texGame);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // DOM-source form (6 args): width/height come from the canvas itself
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);
    texGameW = gameCanvas.width || GAME; texGameH = gameCanvas.height || GAME;
  }

  function uploadGameFrame() {
    var cw = gameCanvas.width || GAME, ch = gameCanvas.height || GAME;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texGame);
    if (cw !== texGameW || ch !== texGameH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);
      texGameW = cw; texGameH = ch;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    lastGlError = gl.getError();
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

  function renderFrame() {
    if (failed || !gl) return;
    var now = performance.now();
    var rawDt = lastRenderT ? (now - lastRenderT) / 1000 : 1 / 60;
    lastRenderT = now;
    var gs = window.gameState;
    var inBattle = gs === 'PLAYING' || gs === 'ARSENAL' || gs === 'COUNTDOWN' || gs === 'TRIAL' || gs === 'END';
    var engineTs = typeof window.timeScale === 'number' ? window.timeScale : 1;
    var dt = Math.min(0.05, rawDt) * engineTs;
    T += dt;
    var cam = camView();
    var q = quality;
    var fighters = window.fighters || [];

    // collect BLACK_HOLE fighters (P1, P2, mirrors — any)
    var bhFighters = [];
    if (inBattle) {
      for (var i = 0; i < fighters.length; i++) {
        var f = fighters[i];
        if (f && f.name === 'BLACK_HOLE') bhFighters.push(f);
      }
    }
    heads.forEach(function (st, f) { if (bhFighters.indexOf(f) < 0) heads.delete(f); });
    var projs = window.projectiles || [];
    wells.forEach(function (w, pr) { if (projs.indexOf(pr) < 0 || w.dead) wells.delete(pr); });

    if (!inBattle || !bhFighters.length) {
      if (overlay && overlay.style.display !== 'none') overlay.style.display = 'none';
      return;
    }
    if (overlay.style.display === 'none') overlay.style.display = '';

    for (var j = 0; j < bhFighters.length; j++) {
      var f2 = bhFighters[j];
      var st = heads.get(f2);
      if (!st) { st = new HeadState(f2); heads.set(f2, st); }
      st.update(dt);
    }

    // gravity wells from the production kit -> golden world singularities
    for (var k = 0; k < projs.length; k++) {
      var pr = projs[k];
      if (pr && pr.type === 'gravity_well' && !pr.exploded && pr.life > 0) {
        if (!wells.has(pr)) wells.set(pr, new WellState(pr));
        wells.get(pr).update(dt);
      }
    }

    // upload the LIVE 2D game frame — the arena itself becomes golden material
    uploadGameFrame();

    // ---- 1. scene = the real game frame; golden heads drawn over it
    bindTarget(tScene);
    gl.disable(gl.BLEND);
    gl.useProgram(P_BLIT.p);
    tex(P_BLIT, 'uTex', 0, texGame);
    u2(P_BLIT, 'uRes', tScene.w, tScene.h);
    drawTri();
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

    // ---- 2. spacetime lens over the WHOLE game frame (arena bends around
    // every singularity: head seats + gravity wells)
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

    // ---- 3. golden head particles (additive, inside the lensed frame)
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
      bindTarget(bl[b]); tex(P_BLUR, 'uSrc', 0, bt[b].tex); u2(P_BLUR, 'uDir', 0, 1 / bl[b].h); u2(P_BLUR, 'uDstRes', bl[b].w, bl[b].h); drawTri();
      srcT = bl[b];
    }

    // ---- 5. final composite — the golden grade over the ENTIRE game frame
    // (radial CA centered on the most active singularity, bloom, ACES,
    // vignette, grain — exactly the golden final pass)
    bindTarget(null);
    gl.useProgram(P_FINAL.p);
    tex(P_FINAL, 'uLens', 0, tLens.tex); tex(P_FINAL, 'uB0', 1, bl[0].tex); tex(P_FINAL, 'uB1', 2, bl[1].tex);
    tex(P_FINAL, 'uB2', 3, bl[2].tex); tex(P_FINAL, 'uB3', 4, bl[3].tex);
    var bi = 0, bestAct = -1;
    for (var z = 0; z < singCount; z++) {
      var act = singRs[z] * 4 * singSuck[z] + singFlash[z] * 2 + Math.abs(singK[z]) * 0.5;
      if (act > bestAct) { bestAct = act; bi = z; }
    }
    var maxFlash = 0;
    for (var z2 = 0; z2 < singCount; z2++) maxFlash = Math.max(maxFlash, singFlash[z2]);
    u2(P_FINAL, 'uRes', GAME, GAME); u2(P_FINAL, 'uCuv', clamp01(singC[bi * 2] / tLens.w), clamp01(singC[bi * 2 + 1] / tLens.h));
    u1(P_FINAL, 'uCA', 0.3 * singSuck[bi] + 0.4 * maxFlash);
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
      try { renderFrame(); }
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
      glError: function () { return lastGlError; },
      // read a pixel of an internal target (FBO textures persist between frames)
      probe: function (which, x, y) {
        var t = which === 'lens' ? tLens : which === 'scene' ? tScene : null;
        if (!t) return null;
        var px = new Float32Array(4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.readPixels(Math.max(0, Math.min(t.w - 1, x | 0)), Math.max(0, Math.min(t.h - 1, y | 0)), 1, 1, gl.RGBA, gl.FLOAT, px, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return [+px[0].toFixed(3), +px[1].toFixed(3), +px[2].toFixed(3), +px[3].toFixed(3)];
      },
      targetSize: function () { return tScene ? [tScene.w, tScene.h] : null; },
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

