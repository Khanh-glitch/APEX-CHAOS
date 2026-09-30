/* =============================================================================
 * CRYSTALA GOLD V6 — gameplay-neutral port of the owner-approved executable Gold
 *   docs/hero-rework/crystala-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html
 *   sha256 e5b90f78304cb8cf1fcdd0fd3e8c94069279040e2d3667050aee833446d65d30
 *
 * WHAT THIS MODULE IS
 *   The Gold's authored motion/choreography engine lifted out of the demo page:
 *   utilities, palette, gem builder, the six Stone identities, the awaken
 *   spring, spring-damper elliptical orbit + dynamic redistribution, Hermite
 *   outbound/return with live endpoint tangents, real-facet indexing, internal
 *   light refraction state, recoil, A1 wall / A2 prison build timelines, the
 *   dense 13-cell material growth, impact cracks/chips/stress, support-failure
 *   cascade, pooled Ancient Dust and bounded debris.
 *   Blocks between "VERBATIM Gold L<a>-<b>" / "END VERBATIM" markers are copied
 *   line-for-line from the Gold. Everything else is the minimum adaptation needed
 *   to run the same algorithms per-rig (no module globals, no DOM, no Math.random).
 *
 * WHAT IT IS NOT
 *   It owns NO gameplay truth: no HP, damage, cooldown, cast rules, threat
 *   selection, projectile collision, ownership/controller, movement blocking or
 *   match lifecycle. The real APEX runtime (crystalGameplayRuntime.js) decides
 *   all of that and merely DRIVES this rig through the small semantic API below.
 *   None of the Gold demo's J=Wall / K=Prison / P=passive controls, fake foe,
 *   fake projectiles, foe lock/root, per-cell gameplay HP, singleton passive,
 *   homing correction, arena, input or camera are ported.
 *
 * DETERMINISM
 *   Fixed 1/120 s sub-steps. Two seeded PRNGs: rngG (anything that can change
 *   stone motion) and rngV (pure visual dust/debris), so rendering can never
 *   perturb gameplay-visible motion. `visual:false` rigs (tests, headless,
 *   AI) allocate no pools and run the identical motion code.
 * ========================================================================== */
(function (g) {
'use strict';
if (g.APEX_CRYSTALA_GOLD) return;

/* VERBATIM Gold L160-204 */
/* ---------------------------------------------------------------- utilities */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return smooth(t); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
const easeInCubic = t => t * t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t, s = 1.35) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const wrapPI = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// cheap analytic divergence-free-ish flow field (curl of a sin potential)
function flow(x, y, t, out){
  const s = 0.0075;
  out.x =  Math.cos(y * s + t * 0.41) * 0.9 + Math.sin((x * 0.6 + y * 0.9) * s - t * 0.23) * 0.55;
  out.y = -Math.sin(x * s - t * 0.33) * 0.9 + Math.cos((x * 0.9 - y * 0.5) * s + t * 0.19) * 0.55;
}
// cubic hermite (position + derivative)
function hermite(p0, v0, p1, v1, T, u, out){
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u, h01 = -2*u3 + 3*u2, h11 = u3 - u2;
  out.x = h00*p0.x + h10*T*v0.x + h01*p1.x + h11*T*v1.x;
  out.y = h00*p0.y + h10*T*v0.y + h01*p1.y + h11*T*v1.y;
  const d00 = 6*u2 - 6*u, d10 = 3*u2 - 4*u + 1, d01 = -6*u2 + 6*u, d11 = 3*u2 - 2*u;
  out.vx = (d00*p0.x + d01*p1.x) / T + d10*v0.x + d11*v1.x;
  out.vy = (d00*p0.y + d01*p1.y) / T + d10*v0.y + d11*v1.y;
  return out;
}

/* ------------------------------------------------------------------ palette */
const AMETHYST = ['#150a2c','#261049','#3a1a6e','#552597','#7a3fc6','#a86ee6','#d3aef7','#f2e2ff','#ffffff'];
const BODYRAMP = ['#08050f','#0d0719','#140b26','#1b1033','#241543','#2e1b56','#3a2270'];
const MANTLE_R = ['#0d0720','#180d35','#26124f','#38196f','#55279c','#8a45d0','#c579ef','#f0c8ff'];
const CROWN_R  = ['#2a1550','#41207b','#5c2ea8','#8047cf','#ab73e6','#d3b0f6','#eddcff','#ffffff'];
const C = {
  void:'#05030b', ink:'#080512', line:'#080413',
  pale:'#f2e6ff', hot:'#ff7ae8', vio:'#a066f0', deep:'#2a1350',
  cyan:'#84e9ff', amber:'#ffb057', foe:'#4b5570', foeD:'#232a3c'
};
/* END VERBATIM Gold L160-204 */

/* VERBATIM Gold L275-324 */
/* ================================================================= GEOMETRY */
function centroid(p){ let x=0,y=0; for(const q of p){x+=q.x;y+=q.y;} return {x:x/p.length,y:y/p.length}; }
function P(...n){ const a=[]; for(let i=0;i<n.length;i+=2) a.push({x:n[i],y:n[i+1]}); return a; }
function tracePoly(c, pts){ c.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); }

/**
 * buildGem — outline + jittered inner core -> quad/tri facet set, cel-shaded by
 * a fixed light direction. (adapted from the geometry-shader crystal facet loop)
 */
function buildGem(outline, seed, opt = {}){
  const rnd = mulberry32(seed);
  const ramp = opt.ramp || AMETHYST;
  const c0 = centroid(outline);
  const cx = c0.x + (opt.cox || 0), cy = c0.y + (opt.coy || 0);
  const k = opt.coreScale != null ? opt.coreScale : 0.34;
  const core = outline.map(p => {
    const j = 0.82 + rnd() * 0.42;
    return { x: cx + (p.x - cx) * k * j, y: cy + (p.y - cy) * k * j };
  });
  const LX = opt.lx != null ? opt.lx : -0.52, LY = opt.ly != null ? opt.ly : -0.855;
  const base = opt.base != null ? opt.base : 0;
  const span = opt.span != null ? opt.span : (ramp.length - 1);
  const facets = [];
  const n = outline.length;
  const shadeOf = (px, py, bump) => {
    let dx = px - cx, dy = py - cy; const m = Math.hypot(dx, dy) || 1; dx/=m; dy/=m;
    let s = 0.5 + 0.5 * (dx*LX + dy*LY);
    s = clamp(s * 0.92 + bump + (rnd()-0.5)*0.09, 0, 1);
    return ramp[clamp(Math.round(base + s * span), 0, ramp.length-1)];
  };
  for (let i = 0; i < n; i++){
    const j = (i + 1) % n;
    const q = [outline[i], outline[j], core[j], core[i]];
    const qc = centroid(q);
    facets.push({ pts: q, color: shadeOf(qc.x, qc.y, 0) });
    const t = [core[i], core[j], { x: cx, y: cy }];
    const tc = centroid(t);
    facets.push({ pts: t, color: shadeOf(tc.x, tc.y, 0.26) });
  }
  // brightest rim edges (where the light hits) for the crisp graphic look
  const rim = [];
  for (let i = 0; i < n; i++){
    const j = (i+1)%n;
    const ex = outline[j].x - outline[i].x, ey = outline[j].y - outline[i].y;
    let nx = ey, ny = -ex; const m = Math.hypot(nx,ny)||1; nx/=m; ny/=m;
    if (nx*LX + ny*LY > 0.34) rim.push([outline[i], outline[j]]);
  }
  return { outline, facets, rim, c:{x:cx,y:cy}, ramp,
    r: Math.max(...outline.map(p => Math.hypot(p.x-cx, p.y-cy))) };
}
/* END VERBATIM Gold L275-324 */

/* VERBATIM Gold L566-593 */
/* ============================================================== SIX  STONES */
const StoneShape={
  blade:s=>P(0,-56*s,22*s,-26*s,24*s,15*s,0,58*s,-25*s,24*s,-23*s,-18*s),
  guard:s=>P(1*s,-24*s,12*s,-2*s,9*s,14*s,-2*s,24*s,-13*s,5*s,-9*s,-13*s),
  sentT:s=>P(0,-43*s,25*s,-2*s,0,43*s,-25*s,-2*s),
  sentB:s=>P(0,-33*s,22*s,-6*s,28*s,5*s,0,36*s,-25*s,3*s,-18*s,-14*s)
};
function seedGem(outline,role,id){
  const g=buildGem(outline,id,{ramp:AMETHYST,base:0,span:5,steps:5});
  const w=Math.max(...outline.map(p=>Math.abs(p.x))),h=Math.max(...outline.map(p=>Math.abs(p.y)));
  const face=(color,coords)=>({color,pts:coords.map(p=>({x:p.x*w,y:p.y*h}))});
  g.facets=[
    face('#d9b2ee',P(0,-1,-1,-.2,-.38,-.09)),
    face('#fff1ff',P(0,-1,-.68,-.5,-.38,-.09)),
    face('#7734be',P(0,-1,-.38,-.09,0,0)),
    face('#30104f',P(0,-1,1,-.1,.36,-.09)),
    face('#58309d',P(0,-1,.36,-.09,0,0)),
    face('#8a45cc',P(1,-.1,.36,-.09,0,0,.57,.39)),
    face('#3c1a69',P(1,-.1,.57,.39,0,1,1,.5)),
    face('#572099',P(-1,-.2,-.38,-.09,-.46,.44,-1,.5)),
    face('#bd49df',P(-.38,-.09,0,0,-.46,.44)),
    face('#9e39d0',P(0,0,-.46,.44,0,1)),
    face('#4b2184',P(0,0,.57,.39,0,1)),
    face('#edcffb',P(-1,.5,-.46,.44,0,1))
  ];
  g.star=role==='sentinel';g.starSize=0.31;g.c={x:0,y:0};
  return g;
}
/* END VERBATIM Gold L566-593 */

/* VERBATIM Gold L991-1020 */
function buildWallGeometry(a, b, seed){
  const rnd = mulberry32(seed);
  const dx = b.x-a.x, dy = b.y-a.y;
  const span = Math.hypot(dx,dy);
  const tx = dx/span, ty=dy/span, nx=-ty, ny=tx;
  const angle=Math.atan2(dy,dx);
  const N = 13;
  const segs = [];
  for (let i = 0; i < N; i++){
    const u = (i + 0.5) / N;
    const w = span / N;
    const h = (17 + 5 * Math.sin(u * Math.PI)) * (0.87 + rnd() * 0.24);
    const j=()=> (rnd()-.5)*3.2;
    // Faceted paving-stone cross-section, NOT a side-view rock/spike.
    const pts = P(
      -w*.62,-h*.58, -w*.32+j(),-h*.98, w*.17,-h*.82+j(),
       w*.61,-h*.68, w*.59,h*.49, w*.21+j(),h*.94,
      -w*.22,h*.78+j(), -w*.62,h*.50
    );
    const gem = buildGem(pts, 900 + seed + i*13,
      { ramp: AMETHYST, coreScale:0.38, base:0, span:6 });
    segs.push({ i, x:a.x+tx*span*u, y:a.y+ty*span*u, u, w, h, gem,
      grow:0, lit:0, hp:100, stress:0, cracks:[], chip:0, dead:false,
      failT:-1, seed:900+seed+i*13, driftX:0, driftY:0,
      fallVX:0, fallVY:0, fallR:0, _noSup:0 });
  }
  return { a,b,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,span,tx,ty,nx,ny,angle,
    segs,solid:false,frontL:0,frontR:0,lock:-1,seamT:-1,life:9,
    fading:0,collapsed:false,collapsing:false,seed };
}
/* END VERBATIM Gold L991-1020 */

/* VERBATIM Gold L1156-1174 */
class Timeline {
  constructor(phases){ this.phases = phases; this.i = -1; this.t = 0; this.active = false; }
  start(){ this.i = -1; this.t = 0; this.active = true; this._next(); }
  _next(){
    this.i++;
    if (this.i >= this.phases.length){ this.active = false; this.i = -1; if (this.onEnd) this.onEnd(); return; }
    this.t = 0; const p = this.phases[this.i]; if (p.enter) p.enter();
  }
  advance(){ if (!this.active) return; const p = this.phases[this.i]; if (p.exit) p.exit(); this._next(); }
  update(dt){
    if (!this.active) return;
    const p = this.phases[this.i];
    this.t += dt;
    const u = p.dur > 0 && isFinite(p.dur) ? clamp(this.t / p.dur, 0, 1) : (p.dur === 0 ? 1 : 0);
    if (p.update) p.update(u, this.t);
    if (isFinite(p.dur) && this.t >= p.dur){ if (p.exit) p.exit(); this._next(); }
  }
  get name(){ return this.active && this.phases[this.i] ? this.phases[this.i].name : ''; }
}
/* END VERBATIM Gold L1156-1174 */

/* VERBATIM Gold L1963-1970 */
function prisonSegGrow(e, sg){
  const N = e.wallGeom.segs.length;
  const half = 0.5 / N;
  const fromA = clamp((e.gA - (sg.u - half)) * N, 0, 1);
  if (!e.both) return fromA;
  const fromB = clamp((e.gB - ((1 - sg.u) - half)) * N, 0, 1);
  return Math.max(fromA, fromB);
}
/* END VERBATIM Gold L1963-1970 */


/* ------------------------------------------------------------ rig constants */
const TRAIL_N = 26;                 // Gold L622
const GDRIFT = 0.082;               // Gold L651
const DT = 1 / 120;                 // Gold fixed simulation step (L2263)
// Raw Gold reaches full material lock (end of ZIP-LOCK) at
// .14+.24+.20+.44+.22+.56+.09+.20 = 2.09 s. Owner retime: ~0.75 s, phase order,
// path geometry and material growth identity kept (phases, grow rate and the
// authored hand-off velocities are scaled together).
const GOLD_LOCK_DONE = 2.09;
const RETIME = 0.75 / GOLD_LOCK_DONE;
const GROW_RATE = 8.5 / RETIME;     // Gold L1093 cell growth, retimed with its phases

// Six stone identities — Gold L624-631 (shape/baseA/baseR/om/band/... verbatim).
const STONE_CFG = [
  { name:'BLADE L',  role:'blade',    shape: StoneShape.blade(0.88), baseA: Math.PI*1.00, baseR:170, om:1.00, band:0.19, bandT:11.0, rB:10, rT:8.3,  mass:1.55, k:165, rot0: 0.42 },
  { name:'BLADE R',  role:'blade',    shape: StoneShape.blade(0.86), baseA: 0.00,         baseR:170, om:0.95, band:0.21, bandT:9.4,  rB:10, rT:7.1,  mass:1.55, k:165, rot0:-0.42 },
  { name:'GUARD L',  role:'guard',    shape: StoneShape.guard(0.92), baseA: Math.PI*0.775,baseR:106, om:1.14, band:0.28, bandT:6.3,  rB:8,  rT:5.2,  mass:0.70, k:360, rot0:-0.30 },
  { name:'GUARD R',  role:'guard',    shape: StoneShape.guard(0.90), baseA: Math.PI*0.225,baseR:106, om:1.10, band:0.26, bandT:7.1,  rB:8,  rT:4.6,  mass:0.70, k:360, rot0: 0.30 },
  { name:'SENT ↑',   role:'sentinel', shape: StoneShape.sentT(0.88), baseA:-Math.PI*0.50-0.09, baseR:172, om:1.05, band:0.16, bandT:8.2, rB:9, rT:6.4, mass:1.05, k:250, rot0: 0.0 },
  { name:'SENT ↓',   role:'sentinel', shape: StoneShape.sentB(0.90), baseA: Math.PI*0.50+0.06, baseR:154, om:0.90, band:0.18, bandT:10.3,rB:9, rT:9.0, mass:1.05, k:250, rot0: 0.0 }
];

// Gold L595-621 — Stone. uid is rig-local (0..5) so two Crystalas share the
// exact same six identities instead of drifting a module-global counter.
class Stone {
  constructor(cfg, uid){
    Object.assign(this, cfg);
    this.uid = uid;
    this.gem = seedGem(cfg.shape, cfg.role, 300 + this.uid * 17);
    this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0;
    this.rot = cfg.rot0 || 0; this.prot = this.rot; this.rotV = 0; this.rotT = this.rot;
    this.scale = 1;
    this.state = 'orbit';    // orbit | travel | anchored | return | free (Gold motion modes)
    this.claim = false;      // adaptation: semantic owner holds the stone (reserved / construct select)
    this.rotHold = null;     // adaptation: anticipation rotation target while reserved
    this.angBias = 0; this.angBiasV = 0;
    this.radBias = 0;
    this.energy = 0;         // 0 dormant .. 1 charged
    this.trail = new Float32Array(TRAIL_N * 2);
    this.trailI = 0; this.trailFill = 0;
    this.spline = null;
    this.anchorRef = null;
    this.recoil = 0;
    this.internal = null;    // internal light path
    this.slot = { x:0, y:0, vx:0, vy:0, a:0 };
    this.depth = 0;
    this._acc = 0;
  }
  pushTrail(){
    this.trail[this.trailI*2] = this.x; this.trail[this.trailI*2+1] = this.y;
    this.trailI = (this.trailI + 1) % TRAIL_N;
    if (this.trailFill < TRAIL_N) this.trailFill++;
  }
  speed(){ return Math.hypot(this.vx, this.vy); }
}

/* ===================================================================== RIG */
function createRig(opt) {
  opt = opt || {};
  const seed = (opt.seed >>> 0) || 1;
  let visual = !!opt.visual;
  const rngG = mulberry32(seed);                            // motion-affecting randomness
  const rngV = mulberry32((seed ^ 0x9E3779B9) >>> 0);       // visual-only randomness
  const R = { seed, visual, DT, RETIME, time: 0, acc: 0, constructSeq: 0,
    onDock: null, shakeV: 0, constructs: [], started: false };

  // ---- hero (Gold L464-473). Position is REAL (supplied by the game body);
  // only the awaken spring / eye flash / pendant state is Gold-authored.
  const hero = { x: 500, y: 500, px: 500, py: 500, vx: 0, vy: 0, facing: 1,
    awake: 0, awakeT: 0, awakeV: 0, eyeFlash: 0, bob: 0, pendantPulse: 0 };
  const bodyPrev = { x: 500, y: 500 }, bodyNext = { x: 500, y: 500, vx: 0, vy: 0 };
  // orbit centre is its own follower of the body -> double lag (Gold L636)
  const orbit = { x: 500, y: 500, vx: 0, vy: 0, t: 0, phase: 0, ripple: 0, compress: 0, compressT: 0 };
  const stones = STONE_CFG.map((c, i) => new Stone(c, i));
  const timers = [];
  const attractors = [];
  let fx = null;   // pooled dust/debris — allocated lazily, visual rigs only

  /* ------------------------------------------------------------- fx pools */
  const DUST_MAX = 780, DEB_MAX = 220;
  function ensureFx() {
    if (fx || !visual) return fx;
    fx = { dust: { x:new Float32Array(DUST_MAX), y:new Float32Array(DUST_MAX),
        px:new Float32Array(DUST_MAX), py:new Float32Array(DUST_MAX),
        vx:new Float32Array(DUST_MAX), vy:new Float32Array(DUST_MAX),
        life:new Float32Array(DUST_MAX), max:new Float32Array(DUST_MAX),
        sz:new Float32Array(DUST_MAX), hue:new Float32Array(DUST_MAX),
        alive:new Uint8Array(DUST_MAX), n:0, head:0 },
      debris: [] };
    for (let i = 0; i < DEB_MAX; i++) fx.debris.push({ on:false, x:0,y:0,px:0,py:0,vx:0,vy:0,r:0,rv:0,s:1,life:0,max:1,poly:null,lit:0 });
    return fx;
  }
  if (visual) ensureFx();
  const _fv = { x:0, y:0 };
  // Gold L807-822 (Math.random -> rngV)
  function spawnDust(x, y, vx, vy, life, sz, hue){
    if (!visual) return;
    const f = ensureFx(), dust = f.dust;
    // Recook-style readability budget: fewer, larger luminous motes.
    if (rngV() < 0.58) return;
    if (dust.n > 150) return;
    if (dust.n > 110 && rngV() < 0.72) return;
    if (dust.n > 80 && rngV() < 0.35) return;
    let i=-1;
    for(let k=0;k<DUST_MAX;k++){
      const j=(dust.head+k)%DUST_MAX;
      if(!dust.alive[j]){i=j;dust.head=(j+1)%DUST_MAX;break;}
    }
    if(i<0)return;
    dust.alive[i]=1; dust.x[i]=dust.px[i]=x; dust.y[i]=dust.py[i]=y;
    dust.vx[i]=vx; dust.vy[i]=vy; dust.life[i]=life; dust.max[i]=life;
    dust.sz[i]=sz; dust.hue[i]=hue; dust.n++;
  }
  // Gold L823-839
  function emitDust(s,dt){
    const sp=s.speed();
    const rate=(1.6+sp*0.022)*(0.28+s.energy*0.82);
    s._acc=(s._acc||0)+rate*dt;
    while(s._acc>=1){
      s._acc-=1;
      const ang=rngV()*TAU, rr=s.gem.r*(0.35+rngV()*0.75);
      const inh=0.30+rngV()*0.25+Math.min(0.22,sp*0.0016);
      spawnDust(
        s.x+Math.cos(ang)*rr,s.y+Math.sin(ang)*rr,
        s.vx*inh+Math.cos(ang)*(5+rngV()*11),
        s.vy*inh+Math.sin(ang)*(5+rngV()*11)-4,
        0.65+rngV()*1.15,
        1.45+rngV()*2.10+s.energy*1.25,
        s.energy);
    }
  }
  // Gold L840-860
  function dustStep(dt,time){
    if (!fx) return;
    const dust = fx.dust;
    for(let i=0;i<DUST_MAX;i++){
      if(!dust.alive[i])continue;
      dust.px[i]=dust.x[i]; dust.py[i]=dust.y[i];
      dust.life[i]-=dt;
      if(dust.life[i]<=0){dust.alive[i]=0;dust.n--;continue;}
      flow(dust.x[i],dust.y[i],time,_fv);
      dust.vx[i]+=_fv.x*16*dt;
      dust.vy[i]+=(_fv.y*16-7)*dt;
      for(const a of attractors){
        const dx=a.x-dust.x[i],dy=a.y-dust.y[i],d2=dx*dx+dy*dy;
        if(d2<a.r*a.r&&d2>4){
          const d=Math.sqrt(d2),f=a.s*(1-d/a.r)/d;
          dust.vx[i]+=dx*f*dt; dust.vy[i]+=dy*f*dt;
        }
      }
      const dr=Math.pow(0.30,dt);
      dust.vx[i]*=dr; dust.vy[i]*=dr;
      dust.x[i]+=dust.vx[i]*dt; dust.y[i]+=dust.vy[i]*dt;
    }
  }
  // Gold L898-911 (arena-independent seed; rngV)
  function spawnDebris(x, y, vx, vy, s, seedV){
    if (!visual) return;
    const f = ensureFx();
    const d = f.debris.find(q => !q.on); if (!d) return;
    const rnd = mulberry32(seedV | 0);
    const n = 3 + ((rnd()*3)|0);
    const pts = [];
    for (let i = 0; i < n; i++){
      const a = i / n * TAU + rnd()*0.5;
      const r = s * (0.55 + rnd()*0.7);
      pts.push({ x: Math.cos(a)*r, y: Math.sin(a)*r });
    }
    d.on = true; d.x = d.px = x; d.y = d.py = y; d.vx = vx; d.vy = vy;
    d.r = rnd()*TAU; d.rv = (rnd()-0.5)*9; d.s = s;
    d.life = d.max = 1.1 + rnd()*1.2; d.poly = pts; d.lit = 1;
  }
  // Gold L912-925. The Gold bounces debris off ITS demo arena rectangle; here
  // the real arena is the 0..bound square supplied by the host (default 1000).
  function debrisStep(dt){
    if (!fx) return;
    const B = R.bound || 1000;
    for (const d of fx.debris){
      if (!d.on) continue;
      d.px = d.x; d.py = d.y;
      const drag = Math.exp(-2.2 * dt);
      d.vx *= drag; d.vy *= drag; d.rv *= Math.exp(-1.4 * dt);
      d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.rv * dt;
      d.lit = Math.max(0, d.lit - dt * 2.4);
      if (d.x < 0 || d.x > B) d.vx *= -0.25;
      if (d.y < 0 || d.y > B) d.vy *= -0.25;
      d.life -= dt; if (d.life <= 0) d.on = false;
    }
  }
  const shake = (a) => { R.shakeV = Math.min(1.1, R.shakeV + a); };

  /* ------------------------------------------------------ sim-time timers */
  function setTimeoutSim(t, fn){ timers.push({ t, fn }); }
  function timersStep(dt){
    for (let i = timers.length-1; i >= 0; i--){
      timers[i].t -= dt;
      if (timers[i].t <= 0){ const f = timers[i].fn; timers.splice(i,1); f(); }
    }
  }

  /* ---------------------------------------------------------------- hero */
  function heroStep(dt, f){
    hero.px = hero.x; hero.py = hero.y;
    const oldVX = hero.vx, oldVY = hero.vy;
    hero.x = lerp(bodyPrev.x, bodyNext.x, f); hero.y = lerp(bodyPrev.y, bodyNext.y, f);
    hero.vx = bodyNext.vx; hero.vy = bodyNext.vy;
    const turn = Math.hypot(hero.vx - oldVX, hero.vy - oldVY);
    if (turn > 1.5 && Math.hypot(hero.vx, hero.vy) > 30)
      orbit.ripple = Math.max(orbit.ripple, Math.min(0.9, turn * 0.017));
    // awaken spring: fast rise, slow settle back to dormant (Gold L518-526)
    const rise = hero.awakeT > hero.awake;
    const ks = rise ? 340 : 46, cs = 2 * Math.sqrt(ks) * (rise ? 0.86 : 1.0);
    hero.awakeV += (ks * (hero.awakeT - hero.awake) - cs * hero.awakeV) * dt;
    hero.awake = clamp(hero.awake + hero.awakeV * dt, 0, 1.15);
    hero.awakeT = Math.max(0, hero.awakeT - dt * 0.55);
    hero.eyeFlash = Math.max(0, hero.eyeFlash - dt * 3.2);
    hero.pendantPulse = Math.max(0, hero.pendantPulse - dt * 2.0);
    hero.bob += dt;
  }

  /* --------------------------------------------------------------- orbit */
  // Gold L639-649 (body follower, then orbit phase drift)
  function orbitStep(dt){
    orbit.t += dt;
    const tx = hero.x, ty = hero.y;
    const k = 95, c = 2 * Math.sqrt(k) * 0.80;
    orbit.vx += (k * (tx - orbit.x) - c * orbit.vx) * dt;
    orbit.vy += (k * (ty - orbit.y) - c * orbit.vy) * dt;
    orbit.x += orbit.vx * dt; orbit.y += orbit.vy * dt;
    orbit.ripple *= Math.pow(0.12, dt);
    orbit.compress = lerp(orbit.compress, orbit.compressT || 0, 1 - Math.pow(0.004, dt));
    orbit.phase += dt * GDRIFT * (1 - orbit.compress * 0.83);
  }
  // Gold L652-667 (elliptical slots — never a perfect circle)
  function stoneSlot(s, dt){
    const band = Math.sin(orbit.t / s.bandT * TAU) * s.band * (1 - orbit.compress * 0.85);
    const ripple = Math.sin(orbit.t * 8 - s.uid * 0.85) * orbit.ripple * 0.055;
    const a = s.baseA + orbit.phase * s.om + band + s.angBias + ripple;
    const breathe = Math.sin(orbit.t / s.rT * TAU + s.uid) * s.rB;
    const r = (s.baseR + breathe + s.radBias) * (1 - orbit.compress * 0.42);
    const ex = 1.05, ey = 0.93;
    const sx = orbit.x + Math.cos(a) * r * ex;
    const sy = orbit.y + Math.sin(a) * r * ey;
    const om = GDRIFT * s.om * (1 - orbit.compress * 0.83);
    const svx = -Math.sin(a) * r * ex * om + orbit.vx;
    const svy =  Math.cos(a) * r * ey * om + orbit.vy;
    s.slot.x = sx; s.slot.y = sy; s.slot.vx = svx; s.slot.vy = svy; s.slot.a = a;
    s.depth = Math.sin(a - 0.35);
  }
  const inFormation = (s) => s.state === 'orbit';
  // Gold L670-697 dynamic redistribution. Adaptation: a semantically claimed
  // (reserved / construct-select) stone already counts as "away".
  function redistribute(dt){
    const act = stones.filter(s => inFormation(s) && !s.claim);
    const n = act.length;
    if (n > 0){
      const need = (TAU / n) * 0.88;
      for (const s of act){
        let push = 0;
        for (const o of act){
          if (o === s) continue;
          const d = wrapPI(s.slot.a - o.slot.a);
          const ad = Math.abs(d);
          if (ad < need) push += (d >= 0 ? 1 : -1) * (need - ad) * 0.55;
        }
        const target = clamp(push * 1.4, -1.25, 1.25);
        const k = 12, c = 2 * Math.sqrt(k) * 1.0;
        s.angBiasV += (k * (target - s.angBias) - c * s.angBiasV) * dt;
        s.angBias += s.angBiasV * dt;
        const rTarget = (6 - n) * (s.role === 'guard' ? 8 : 3.5);
        s.radBias = lerp(s.radBias, rTarget, 1 - Math.exp(-4 * dt));
      }
    }
    for (const s of stones){
      if (!(inFormation(s) && !s.claim)){
        s.angBiasV *= Math.pow(0.2, dt);
        s.angBias = lerp(s.angBias, 0, 1 - Math.pow(0.25, dt));
        s.radBias = lerp(s.radBias, 0, 1 - Math.exp(-4 * dt));
      }
    }
  }

  /* ----------------------------------------------------- stone integration */
  // Gold L699-776
  function stonesStep(dt){
    for (const s of stones){
      s.px = s.x; s.py = s.y; s.prot = s.rot;
      stoneSlot(s, dt);
    }
    redistribute(dt);
    for (const s of stones){
      if (s.state === 'orbit'){
        // spring-damper follower (damping on RELATIVE velocity, per Kanber)
        const k = s.k, c = 2 * Math.sqrt(k * s.mass) * 0.78;
        const ax = (k * (s.slot.x - s.x) - c * (s.vx - s.slot.vx)) / s.mass;
        const ay = (k * (s.slot.y - s.y) - c * (s.vy - s.slot.vy)) / s.mass;
        s.vx += ax * dt; s.vy += ay * dt;
        // local repulsion so they negotiate spacing physically
        for (const o of stones){
          if (o === s || o.state !== 'orbit') continue;
          const dx = s.x - o.x, dy = s.y - o.y;
          const d2 = dx*dx + dy*dy;
          const rr = (s.gem.r + o.gem.r) * 1.12;
          if (d2 < rr*rr && d2 > 0.01){
            const d = Math.sqrt(d2); const f = (rr - d) / rr * 720 / s.mass;
            s.vx += dx/d * f * dt; s.vy += dy/d * f * dt;
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        // orientation follows travel direction, softly
        const sp = s.speed();
        if (s.rotHold != null) s.rotT = s.rotHold;
        else if (sp > 6) s.rotT = Math.atan2(s.vy, s.vx) + Math.PI/2;
        else s.rotT = s.slot.a + Math.PI/2;
        const eT = s.claim ? Math.max(0.55, hero.awake * 0.55) : clamp(hero.awake*0.55, 0, 1);
        s.energy = lerp(s.energy, eT, 1 - Math.pow(0.05, dt));
      }
      else if (s.state === 'travel' || s.state === 'return'){
        const sp = s.spline;
        if (s.state === 'return'){
          sp.p1.x = s.slot.x; sp.p1.y = s.slot.y;
          sp.v1.x = s.slot.vx; sp.v1.y = s.slot.vy;
        }
        sp.t += dt;
        const u = clamp(sp.t / sp.T, 0, 1);
        // Linear parameter through the Hermite basis preserves BOTH endpoint
        // tangents. Applying an ease to u would silently erase orbital momentum.
        const o = hermite(sp.p0, sp.v0, sp.p1, sp.v1, sp.T, u, sp._o || (sp._o = {}));
        s.x = o.x; s.y = o.y;
        const du = Math.max(1e-4, dt);
        s.vx = (s.x - s.px) / du; s.vy = (s.y - s.py) / du;
        if (sp.rotT != null) s.rotT = lerp(sp.rot0, sp.rotT, easeOutCubic(u));
        s.energy = lerp(s.energy, 1, 1 - Math.pow(0.02, dt));
        if (u >= 1){
          s.vx = o.vx; s.vy = o.vy;           // C1 velocity handoff
          if (sp.onDone) sp.onDone(s);
        }
      }
      else if (s.state === 'anchored'){
        const a = s.anchorRef;
        const k = 520, c = 2 * Math.sqrt(k * s.mass) * 0.55;
        const ax = (k * (a.x - s.x) - c * s.vx) / s.mass;
        const ay = (k * (a.y - s.y) - c * s.vy) / s.mass;
        s.vx += ax * dt; s.vy += ay * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (a.rot != null) s.rotT = a.rot;
        s.energy = lerp(s.energy, a.energy != null ? a.energy : 0.75, 1 - Math.pow(0.08, dt));
      }
      else if (s.state === 'free'){
        s.vx *= Math.pow(0.28, dt); s.vy *= Math.pow(0.28, dt);
        s.x += s.vx * dt; s.y += s.vy * dt;
      }
      // rotation spring
      const dr = wrapPI(s.rotT - s.rot);
      const kr = 130, cr = 2 * Math.sqrt(kr) * 0.7;
      s.rotV += (kr * dr - cr * s.rotV) * dt;
      s.rot += s.rotV * dt;
      s.recoil = Math.max(0, s.recoil - dt * 2.2);
      s.pushTrail();
      if (s.internal){ s.internal.t += dt; if (s.internal.t > s.internal.T) s.internal = null; }
      if (visual) emitDust(s, dt);
    }
  }
  // Gold L778-794. Dock = the exact substep the return spline completes.
  function launch(s, p1, v1, T, o = {}){
    s.state = o.state || 'travel';
    s.spline = {
      p0: { x: s.x, y: s.y },
      v0: { x: s.vx * (o.keep != null ? o.keep : 1), y: s.vy * (o.keep != null ? o.keep : 1) },
      p1, v1, T, t: 0, onDone: o.onDone,
      rot0: s.rot, rotT: o.rot != null ? o.rot : null
    };
  }
  // retimed launch for construct choreography: T scales by RETIME, the authored
  // hand-off tangents scale by 1/RETIME so T*v (the curve shape) is preserved.
  function launchGold(s, p1, v1, Tgold, o){
    launch(s, p1, { x: v1.x / RETIME, y: v1.y / RETIME }, Tgold * RETIME, o);
  }
  function rejoinStone(s, T){
    if (T == null) T = 0.62;
    stoneSlot(s, 0);
    const tgt = { x: s.slot.x, y: s.slot.y };
    const tv = { x: s.slot.vx, y: s.slot.vy };
    launch(s, tgt, tv, T, { state:'return', keep: 1,
      onDone: (st) => { st.state = 'orbit'; st.anchorRef = null; st.claim = false; st.rotHold = null;
        if (R.onDock) R.onDock(st.uid); } });
  }

  /* --------------------------------------------- semantic intercept support */
  // Gold L1494-1509 — inspect the gem's REAL outline edges; the chosen broad
  // facet is rotated toward the incoming ray before the stone commits.
  function indexFacet(s, vx, vy){
    const want = Math.atan2(-vy, -vx), pts = s.gem.outline;
    let best = null, bestCost = Infinity;
    for (let i = 0; i < pts.length; i++){
      const a = pts[i], b = pts[(i+1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len < 7) continue;
      const local = Math.atan2(-dx, dy);
      const delta = Math.abs(wrapPI(want - (s.rot + local)));
      const cost = delta + 7/len*.23;
      if (cost < bestCost){ bestCost = cost; best = { i, local, desired: want - local, delta }; }
    }
    return best || { i:0, local:-Math.PI/2, desired:want+Math.PI/2, delta:0 };
  }
  // Gold L1510-1517 scoring concept (travel, facet delta, velocity alignment,
  // guards preferred) — used by the game for reachability ranking only.
  function scoreStone(s, vx, vy, ip){
    const travel = dist(s.x, s.y, ip.x, ip.y);
    const dA = indexFacet(s, vx, vy).delta;
    const vAlign = (s.vx * (ip.x - s.x) + s.vy * (ip.y - s.y)) / (travel + 1);
    return -travel * 1.0 - dA * 42 + vAlign * 0.9 + (s.role === 'guard' ? 55 : 0);
  }
  // RESERVED: immediate visible anticipation while the stone is still in its slot.
  function reserve(i, pv){
    const s = stones[i];
    s.claim = true;
    const facet = indexFacet(s, pv.x, pv.y);
    s.rotHold = facet.desired;
    s.energy = Math.max(s.energy, 0.85);
    hero.awakeT = Math.max(hero.awakeT, 0.52); hero.eyeFlash = 0.75;     // MICRO-AWAKEN (Gold L1537)
    return facet;
  }
  // OUTBOUND: Gold L1539-1545 — Hermite to the intercept point, arrival tangent
  // against the projectile, facet-desired rotation, then drift.
  function beginIntercept(i, ip, T, pv, facet){
    const s = stones[i];
    facet = facet || indexFacet(s, pv.x, pv.y);
    s.claim = true; s.rotHold = null;
    launch(s, { x: ip.x, y: ip.y }, { x: -pv.x * 0.17, y: -pv.y * 0.17 }, T,
      { keep: 1, rot: facet.desired, onDone: (st) => { st.state = 'free'; st.vx *= .35; st.vy *= .35; } });
    s.energy = 1;
    return facet;
  }
  // Gold L1563-1581 — internal light path in the rotating stone's local frame.
  function refract(i, contact, exitV, pr){
    const s = stones[i];
    const wx = contact.x - s.x, wy = contact.y - s.y, wm = Math.hypot(wx, wy) || 1;
    const em = Math.hypot(exitV.x, exitV.y) || 1, ex = exitV.x / em, ey = exitV.y / em;
    const cs = Math.cos(s.rot), sn = Math.sin(s.rot);
    const inX = wx/wm*s.gem.r*.72, inY = wy/wm*s.gem.r*.72;
    const outX = ex*s.gem.r*.72, outY = ey*s.gem.r*.72;
    const inLocal = { x: inX*cs + inY*sn, y: -inX*sn + inY*cs };
    const outLocal = { x: outX*cs + outY*sn, y: -outX*sn + outY*cs };
    s.internal = { t: 0, T: .16, a: inLocal, b: outLocal,
      m: { x: (inLocal.x + outLocal.x)*.18 - 3, y: (inLocal.y + outLocal.y)*.18 - 5 } };
    s.recoil = 1;
    for (let k = 0; k < 9; k++)
      spawnDust(contact.x, contact.y, (rngV()-0.5)*130, (rngV()-0.5)*130, 0.45, 1.5, 1);
    return { x: ex * (s.gem.r + pr + 4), y: ey * (s.gem.r + pr + 4) };
  }
  // Gold L1597-1601 — momentum consequence on the stone (recoil).
  function recoilKick(i, exitV){
    const s = stones[i];
    const m = Math.hypot(exitV.x, exitV.y) || 1;
    s.vx -= exitV.x / m * 210; s.vy -= exitV.y / m * 180;
    s.rotV += (rngG() - 0.5) * 16;
    s.state = 'free';
  }
  // facet normal in world space at this instant (real stone rotation).
  function facetNormal(i, facet){
    const s = stones[i], a = s.rot + facet.local;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  function returnHome(i, T){ rejoinStone(stones[i], T); }

  /* ============================================================= A1 — WALL */
  const D = (t) => t * RETIME;
  function planWall(ids, a0, a1){
    let best = null;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++){
      const s = stones[ids[x]], t = stones[ids[y]];
      const c0 = dist(s.x,s.y,a0.x,a0.y) + dist(t.x,t.y,a1.x,a1.y);
      const c1 = dist(s.x,s.y,a1.x,a1.y) + dist(t.x,t.y,a0.x,a0.y);
      const pick = c0 <= c1 ? { pair: [[ids[x],0],[ids[y],1]], cost: c0 } : { pair: [[ids[x],1],[ids[y],0]], cost: c1 };
      if (!best || pick.cost < best.cost - 1e-9) best = pick;
    }
    return best;
  }
  // Gold L1176-1275 castA1 — same phases/choreography/velocities, retimed.
  function castWall(spec){
    const a0 = { x: spec.a0.x, y: spec.a0.y }, a1 = { x: spec.a1.x, y: spec.a1.y };
    const tm = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, ux = (a1.x - a0.x) / tm, uy = (a1.y - a0.y) / tm;
    const anchors = [
      { x: a0.x, y: a0.y, rot: Math.atan2(uy, ux) + Math.PI/2, energy: .95 },
      { x: a1.x, y: a1.y, rot: Math.atan2(-uy, -ux) + Math.PI/2, energy: .95 }
    ];
    const pair = spec.pair.map(([si, ai]) => [stones[si], anchors[ai]]);
    const c = { id: ++R.constructSeq, kind: 'wall', a0, a1, anchors, pair, stoneIds: spec.pair.map(p => p[0]),
      geom: null, tl: null, locked: false, lockTime: null, solidTime: null, collapsed: false,
      detached: false, seed: spec.seed != null ? spec.seed : 7, _atL: null, _atR: null, builtAt: R.time };
    for (const [s] of pair) s.claim = true;
    c.tl = new Timeline([
      { name:'SELECT', dur:D(0.14), enter(){
          for (const [s] of pair){ s.energy = 0.55; s.rotT = s.rot + 0.55; }
        } },
      { name:'AWAKEN', dur:D(0.24), enter(){ hero.awakeT = 0.92; hero.eyeFlash = 0.85; hero.pendantPulse = 0.7; },
        update(u){ hero.awakeT = Math.max(hero.awakeT, 0.92);
          for (const [s] of pair) s.energy = lerp(0.55, 1, u); } },
      { name:'PEEL', dur:D(0.20), enter(){
          for (const [s, a] of pair){
            // peel WITH real tangential momentum: outward bulge keeps existing velocity
            const nx = s.x - orbit.x, ny = s.y - orbit.y; const m = Math.hypot(nx,ny)||1;
            const p1={x:s.x+s.vx*.20+nx/m*30,y:s.y+s.vy*.20+ny/m*30};
            const v1={x:s.vx*1.20+nx/m*40,y:s.vy*1.20+ny/m*40};
            launchGold(s, p1, v1, 0.20, { keep: 1 });
          }
        } },
      { name:'SWEEP', dur:D(0.44), enter(){
          for (const [s, a] of pair){
            const arrive={x:(a.x-s.x)*.22,y:(a.y-s.y)*.22};
            launchGold(s,{x:a.x,y:a.y},arrive,.44,
              { keep: 1, rot: a.rot,
                onDone: (st) => { st.state = 'anchored'; st.anchorRef = a; } });
          }
        },
        update(u){ hero.awakeT = Math.max(hero.awakeT, 0.85 - u*0.1); } },
      { name:'ANCHOR', dur:D(0.22), enter(){
          shake(0.20);
          for (const [s, a] of pair){
            s.state='anchored';s.anchorRef=a;s.recoil=1;
            // restrained, radial pressure response on the arena plane
            for (let i=0;i<12;i++){
              const ang=i/12*TAU+rngV()*.25;
              spawnDust(a.x,a.y,Math.cos(ang)*(35+rngV()*120),
                Math.sin(ang)*(35+rngV()*120),.55+rngV()*.5,1.7,.9);
            }
            for (let i = 0; i < 5; i++)
              spawnDebris(a.x+(rngV()-.5)*20,a.y+(rngV()-.5)*20,
                (rngV()-.5)*150,(rngV()-.5)*150,
                2+rngV()*3,(rngV()*1e6)|0);
          }
          c.geom = buildWallGeometry(anchors[0],anchors[1],c.seed);
          attractors.push(c._atL={x:c.geom.a.x,y:c.geom.a.y,r:70,s:240});
          attractors.push(c._atR={x:c.geom.b.x,y:c.geom.b.y,r:70,s:240});
        } },
      { name:'BLOOM', dur:D(0.56), update(u){
          const w = c.geom;
          const e = easeOutCubic(u) * 0.86;          // fronts approach but do not meet
          w.frontL = e; w.frontR = e;
          if(c._atL){
            c._atL.x=w.a.x+w.tx*w.span*.5*e;
            c._atL.y=w.a.y+w.ty*w.span*.5*e;
            c._atR.x=w.b.x-w.tx*w.span*.5*e;
            c._atR.y=w.b.y-w.ty*w.span*.5*e;
          }
          hero.awakeT = Math.max(hero.awakeT, 0.7);
        } },
      { name:'MEET', dur:D(0.09), update(u){
          const w = c.geom;
          const e = 0.86 + u * 0.09;                  // slow, a small seam remains
          w.frontL = e; w.frontR = e;
        } },
      { name:'ZIP-LOCK', dur:D(0.20), enter(){
          const w = c.geom;
          w.frontL = 1; w.frontR = 1; w.solid = true; w.seamT = 0;
          c.solidTime = R.time;
          shake(0.13); hero.pendantPulse = 0.8;
          for (let i = 0; i < 18; i++)
            spawnDust(w.cx+(rngV()-.5)*24,w.cy+(rngV()-.5)*28,
              (rngV()-.5)*110,(rngV()-.5)*110,.7,1.9,1);
          const iL = attractors.indexOf(c._atL); if (iL>=0) attractors.splice(iL,1);
          const iR = attractors.indexOf(c._atR); if (iR>=0) attractors.splice(iR,1);
          c._atL = c._atR = null;
        },
        update(u){ c.geom.lock = u; } },
      { name:'HOLD', dur: Infinity, enter(){ c.geom.lock = 1; c.locked = true; c.lockTime = R.time; } }
    ]);
    c.tl.onEnd = () => { c.tl = null; };
    R.constructs.push(c);
    c.tl.start();
    return c;
  }

  // Gold L1022-1063 impactWall — PRESENTATION ONLY. Damage/HP are real (the
  // game passes the real contact point, real damage fraction and velocity);
  // per-cell HP is never decremented and never decides gameplay.
  function wallHit(geom, hx, hy, frac, vx, vy, segOwner){
    if (!geom) return null;
    let px = hx, py = hy, f = frac;
    if (typeof hx === 'object' && hx !== null) {
      px = hx.x; py = hx.y; f = (hy != null ? hy : 0.25);
    }
    const dmg = clamp(f, 0, 1) * 120;           // Gold-unit impact strength
    let sg = null, bd = Infinity;
    for (const q of geom.segs){ if (q.dead) continue; const d = Math.hypot(q.x - px, q.y - py); if (d < bd){ bd = d; sg = q; } }
    if (!sg) return null;
    sg.stress = Math.min(1.6, sg.stress + dmg / 55);
    sg.lit = Math.max(sg.lit, 0.85);
    shake(dmg > 40 ? 0.28 : 0.13);
    const rnd = mulberry32((sg.seed + (px|0) * 7) | 0);
    const dx = px-sg.x, dy=py-sg.y;
    const lx=clamp(dx*geom.tx+dy*geom.ty,-sg.w*.56,sg.w*.56);
    const ly=clamp(dx*geom.nx+dy*geom.ny,-sg.h*.85,sg.h*.85);
    const pts = [{ x: lx, y: ly }];
    let a = (rnd()>.5 ? 0 : Math.PI) + (rnd()-0.5)*0.9;
    let px2 = lx, py2 = ly;
    const steps = 3 + ((rnd()*2)|0);
    for (let i = 0; i < steps; i++){
      const L = 3.5 + rnd() * 5;
      a += (rnd() - 0.5) * 0.8;
      px2 += Math.cos(a) * L; py2 += Math.sin(a) * L;
      py2 = clamp(py2, -sg.h * .88, sg.h*.88);
      px2 = clamp(px2, -sg.w*0.55, sg.w*0.55);
      pts.push({ x: px2, y: py2 });
    }
    sg.cracks.push({ pts, t: 0, glow: 1 });
    if (sg.cracks.length > 5) sg.cracks.shift();
    sg.chip = Math.min(1, sg.chip + dmg / 130);
    for (let i = 0; i < 4 + (dmg/14|0); i++)
      spawnDebris(hx, hy, vx*.12+(rngV()-.5)*190, vy*.12+(rngV()-.5)*190, 2.4+rngV()*3.6, (rnd()*1e6)|0);
    for (let i = 0; i < 12; i++)
      spawnDust(hx, hy,(rngV()-.5)*220,(rngV()-.5)*220, .4+rngV()*.5,1.5,1);
    // stress diffusion through the neighbour graph
    const idx = geom.segs.indexOf(sg);
    for (let d = 1; d <= 3; d++){
      const f = Math.pow(0.42, d);
      for (const j of [idx-d, idx+d]){
        const o = geom.segs[j];
        if (o && !o.dead){ o.stress = Math.min(1.5, o.stress + (dmg/55) * f); o.lit = Math.max(o.lit, 0.4*f+0.15); }
      }
    }
    return idx;
  }
  // Gold L1065-1084 failSegment (per-cell hp writes removed: no gameplay HP here)
  function failSegment(geom, sg){
    if (sg.dead) return;
    sg.dead = true; sg.failT = 0;
    const away=Math.sign(sg.u-.5) || 1;
    sg.fallVX=geom.tx*away*105+geom.nx*(rngG()-.5)*78;
    sg.fallVY=geom.ty*away*105+geom.ny*(rngG()-.5)*78;
    sg.fallR=(rngG()-.5)*1.3;
    for(const ni of [sg.i-1,sg.i+1]){
      const neighbour=geom.segs[ni];
      if(neighbour&&!neighbour.dead){ neighbour.stress=Math.max(neighbour.stress,.95);
        neighbour.lit=Math.max(neighbour.lit,.62); }
    }
    for (let i = 0; i < 9; i++)
      spawnDebris(sg.x+(rngV()-.5)*sg.w,sg.y+(rngV()-.5)*sg.h*2,
        (rngV()-.5)*200,(rngV()-.5)*200,3+rngV()*5,(rngV()*1e6)|0);
    for (let i = 0; i < 14; i++)
      spawnDust(sg.x+(rngV()-.5)*sg.w,sg.y+(rngV()-.5)*sg.h*2,
        (rngV()-.5)*190,(rngV()-.5)*190,.6+rngV()*.7,1.7,.9);
    shake(0.14);
  }
  // Gold L1086-1125 wallStep. Adaptations: growth rate retimed with the build;
  // per-cell HP failure removed (aggregate real HP decides); lifetime collapse
  // is triggered by the game via collapseWall() instead of a demo timer.
  function wallStep(c, dt){
    const w = c.geom;
    if (!w) return;
    for (const sg of w.segs){
      // coverage advances with the growth fronts (frame-rate independent)
      const covered = (sg.u <= w.frontL * 0.5) || (sg.u >= 1 - w.frontR * 0.5);
      if (covered && sg.grow < 1){
        sg.grow = Math.min(1, sg.grow + dt * GROW_RATE);
        if (sg.grow >= 1) sg.lit = Math.max(sg.lit, 0.85);
      }
      sg.lit = Math.max(0, sg.lit - dt * 1.7);
      sg.stress = Math.max(0, sg.stress - dt * 0.30);
      for (const cr of sg.cracks) cr.glow = Math.max(0, cr.glow - dt * 1.4);
      if (sg.dead){
        sg.failT += dt;
        sg.driftX += sg.fallVX * dt; sg.driftY += sg.fallVY * dt;
        sg.fallVX *= Math.exp(-2.9*dt); sg.fallVY *= Math.exp(-2.9*dt);
      }
    }
    // A stress wave removes support from the next physical segment; not an HP pop.
    if (w.collapsing){
      for (let i = 0; i < w.segs.length; i++){
        const sg = w.segs[i];
        if (sg.dead || sg.grow < 0.9) continue;
        const L = w.segs[i-1], Rr = w.segs[i+1];
        const unsupported = (L&&L.dead)||(Rr&&Rr.dead);
        if (unsupported && sg.stress > .30){
          sg._noSup += dt;
          if (sg._noSup > .18) failSegment(w, sg);
        } else sg._noSup = 0;
      }
      const alive = w.segs.filter(s=>!s.dead).length;
      if (alive === 0 && !w.collapsed) w.collapsed = true;
    }
    if (w.seamT >= 0){ w.seamT += dt; if (w.seamT > 0.75) w.seamT = -1; }
    if (w.collapsed){ w.fading += dt; }
  }
  // Gold L1127-1143 A1_collapse stone half: both anchors survive, are kicked
  // away from the failed structure, then rejoin with a Gold-style return.
  function detachWall(c, T){
    if (c.detached) return;
    c.detached = true;
    const w = c.geom || { cx: (c.a0.x+c.a1.x)/2, cy: (c.a0.y+c.a1.y)/2 };
    for (const s of c.pair.map(p => p[0])){
      const dx=s.x-w.cx,dy=s.y-w.cy;
      const m=Math.hypot(dx,dy)||1;
      s.state = 'free';
      s.vx=dx/m*205+(rngG()-.5)*35;
      s.vy=dy/m*205+(rngG()-.5)*35;
      s.anchorRef = null; s.spline = null;
      setTimeoutSim(0.28, () => rejoinStone(s, T != null ? T : 0.75));
    }
    if (c.tl){ c.tl.active=false; c.tl=null; }
    for (const k of ['_atL','_atR']) if (c[k]){ const i = attractors.indexOf(c[k]); if (i>=0) attractors.splice(i,1); c[k] = null; }
    hero.awakeT = Math.max(hero.awakeT, 0.35);
  }
  // visual collapse: seeded failure at the support-failure origin, cascade by stress.
  function collapseWall(c, originIdx){
    const w = c.geom;
    if (!w || w.collapsing) return;
    w.collapsing = true;
    const seg = w.segs[originIdx != null ? originIdx : 6] || w.segs[6];
    failSegment(w, seg);
    shake(0.32);
  }

  /* ========================================================== A2 — PRISON */
  // Gold L1281-1303 buildPrison. The per-edge wall material (A1 language) is
  // baked at NUCLEATE, when the centre freezes; before that nothing is visible.
  function buildPrison(cx, cy, Rr, pseed){
    const verts = [];
    for (let i = 0; i < 6; i++){
      const a = -Math.PI/2 + i * TAU/6 + 0.12;
      verts.push({ x: cx + Math.cos(a) * Rr, y: cy + Math.sin(a) * Rr, a });
    }
    const edges = [];
    for (let i = 0; i < 6; i++){
      const a = verts[i], b = verts[(i+1)%6];
      edges.push({ i, a, b, gA:0, gB:0, both:false, lit:0, grown:false, dead:false, stress:0,
        wallGeom:null, collapsing:false, hpFrac:1 });
    }
    return { cx, cy, R: Rr, verts, edges, solid:false, pulse:-1, fading:0, collapsed:false, seed: pseed, frozen:false };
  }
  function bakePrisonWalls(p){
    for (const e of p.edges) e.wallGeom = buildWallGeometry(e.a, e.b, 2400 + p.seed + e.i * 53);
  }
  function castPrison(spec){
    const p = buildPrison(spec.cx, spec.cy, spec.R, spec.seed != null ? spec.seed : 31);
    const c = { id: ++R.constructSeq, kind: 'prison', prison: p, tl: null, solidTime: null, locked: false,
      lockTime: null, collapsed: false, detached: false, assign: null, stoneIds: stones.map(s => s.uid), builtAt: R.time };
    // assign stones to vertices by angular affinity (shortest total travel) — Gold L1314-1321
    const order = stones.slice().sort((a,b) => Math.atan2(a.y-orbit.y, a.x-orbit.x) - Math.atan2(b.y-orbit.y, b.x-orbit.x));
    let bestOff = 0, bestCost = Infinity;
    for (let off = 0; off < 6; off++){
      let cst = 0;
      for (let i = 0; i < 6; i++) cst += dist(order[i].x, order[i].y, p.verts[(i+off)%6].x, p.verts[(i+off)%6].y);
      if (cst < bestCost){ bestCost = cst; bestOff = off; }
    }
    const assign = order.map((s, i) => [s, p.verts[(i + bestOff) % 6], (i + bestOff) % 6]);
    c.assign = assign;
    for (const s of stones) s.claim = true;
    const vRot = (v) => Math.atan2(v.y - p.cy, v.x - p.cx) + Math.PI/2;
    c.tl = new Timeline([
      { name:'STILL', dur:D(0.09), enter(){ hero.awakeT = 0.35; orbit.compressT = 0.0; } },
      { name:'ORBIT COMPRESS', dur:D(0.16), enter(){ orbit.compressT = 0.62; },
        update(u){ for (const s of stones) s.energy = lerp(0.2, 0.8, u); hero.awakeT = Math.max(hero.awakeT, 0.4 + u*0.4); } },
      { name:'FULL AWAKEN', dur:D(0.21), enter(){ hero.awakeT = 1.0; hero.eyeFlash = 1.0; hero.pendantPulse = 1.0; shake(0.10); },
        update(u){ hero.awakeT = 1.0; for (const s of stones) s.energy = lerp(0.8, 1, u); } },
      { name:'BURST', dur:D(0.14), enter(){
          orbit.compressT = 0; orbit.ripple = 1; shake(0.12);
          for (const [s] of assign){
            const nx = s.x - orbit.x, ny = s.y - orbit.y; const m = Math.hypot(nx,ny)||1;
            launchGold(s,{x:s.x+s.vx*.14+nx/m*44,y:s.y+s.vy*.14+ny/m*44},
              {x:s.vx*1.15+nx/m*130,y:s.vy*1.15+ny/m*130},.14,{keep:1});
          }
        } },
      { name:'ENCIRCLE', dur:D(0.56), enter(){
          // opposite halves take opposite flanks: upper group sweeps over the
          // top, lower group under the base -> the target is surrounded before
          // the cage exists. Arrival tangent is the circle tangent (not radial).
          for (const [s, v] of assign){
            const above = s.y < p.cy;
            const fromLeft = s.x < p.cx;
            const dirSign = (above ? 1 : -1) * (fromLeft ? 1 : -1);
            const inward = { x: (v.x - p.cx), y: (v.y - p.cy) };
            const im = Math.hypot(inward.x, inward.y) || 1;
            const tanx = -inward.y / im, tany = inward.x / im;
            const arriveV = { x: dirSign * tanx * 660 - inward.x/im * 210,
                              y: dirSign * tany * 660 - inward.y/im * 210 };
            launchGold(s, { x: v.x, y: v.y }, arriveV, 0.56,
              { keep: 1, rot: vRot(v),
                onDone:(st)=>{ st.state='anchored'; st.anchorRef = { x:v.x, y:v.y, rot: vRot(v), energy:1 }; } });
          }
        },
        update(u){ hero.awakeT = Math.max(hero.awakeT, 1 - u*0.12); } },
      { name:'INDEX', dur:D(0.10), enter(){
          for (const [s, v] of assign){ s.state = 'anchored';
            s.anchorRef = { x:v.x, y:v.y, rot: vRot(v), energy:1 }; }
        },
        update(){ for (const s of stones){ s.vx *= 0.55; s.vy *= 0.55; } } },
      { name:'NUCLEATE', dur:D(0.09), enter(){
          // freeze the cage centre: from here on the forming walls never chase.
          p.frozen = true;
          bakePrisonWalls(p);
          for (const v of p.verts){
            attractors.push({ x:v.x, y:v.y, r:70, s:260, _p:p });
            for (let i = 0; i < 7; i++)
              spawnDust(v.x + (rngV()-0.5)*16, v.y + (rngV()-0.5)*16,
                (rngV()-0.5)*70, (rngV()-0.5)*70, 0.55, 1.6, 1);
          }
        } },
      { name:'CHAIN-GROW', dur:D(0.44), update(u){
          // A -> AB -> B -> BC ... rapid chain travelling around the perimeter
          const t = u * 0.44;
          for (let i = 0; i < 5; i++){
            const st = i * 0.062;
            const gg = clamp((t - st) / 0.19, 0, 1);
            p.edges[i].gA = easeOutCubic(gg);
            p.edges[i].lit = Math.max(p.edges[i].lit, gg > 0 && gg < 1 ? 1 : 0.5);
            if (gg >= 1) p.edges[i].grown = true;
          }
          const last = p.edges[5]; last.both = true;
          const g5 = clamp((t - 0.315) / 0.12, 0, 1);
          last.gA = easeOutCubic(g5) * 0.40; last.gB = easeOutCubic(g5) * 0.40;
          last.lit = 1;
        } },
      { name:'LAST GAP', dur:D(0.10), update(){} },
      { name:'CLOSURE', dur:D(0.17), enter(){ shake(0.16); },
        update(u){
          const last = p.edges[5];
          last.gA = lerp(0.40, 0.5, easeOutQuint(u)); last.gB = lerp(0.40, 0.5, easeOutQuint(u));
          p.pulse = -1;
        },
        exit(){
          p.solid = true; p.pulse = 0; c.solidTime = R.time; c.locked = true; c.lockTime = R.time;
          p.edges[5].grown = true;
          for (let i = attractors.length-1; i>=0; i--) if (attractors[i]._p === p) attractors.splice(i,1);
        } },
      { name:'HOLD', dur: Infinity }
    ]);
    c.tl.onEnd = () => { c.tl = null; };
    R.constructs.push(c);
    c.tl.start();
    return c;
  }
  // pure-translation follow of the cage centre until NUCLEATE (presentation
  // continuity); the game calls this each tick with the real target position.
  function prisonFollow(c, cx, cy){
    const p = c.prison;
    if (!p || p.frozen) return false;
    const dx = cx - p.cx, dy = cy - p.cy;
    if (!dx && !dy) return true;
    p.cx = cx; p.cy = cy;
    for (const v of p.verts){ v.x += dx; v.y += dy; }
    for (const [s] of c.assign){
      if (s.spline && s.state === 'travel'){ s.spline.p1.x += dx; s.spline.p1.y += dy; }
      if (s.state === 'anchored' && s.anchorRef){ s.anchorRef.x += dx; s.anchorRef.y += dy; }
    }
    return true;
  }
  // Gold L1406-1425 prisonFailSegment (no per-cell HP writes)
  function prisonFailSegment(e, sg){
    if (sg.dead) return;
    sg.dead = true; sg.failT = 0;
    const w = e.wallGeom;
    const away = Math.sign(sg.u - .5) || 1;
    sg.fallVX = w.tx * away * 105 + w.nx * (rngG() - .5) * 78;
    sg.fallVY = w.ty * away * 105 + w.ny * (rngG() - .5) * 78;
    sg.fallR = (rngG() - .5) * 1.3;
    for (const ni of [sg.i-1, sg.i+1]){
      const n = w.segs[ni];
      if (n && !n.dead){ n.stress = Math.max(n.stress, .95); n.lit = Math.max(n.lit, .62); }
    }
    for (let i = 0; i < 9; i++)
      spawnDebris(sg.x + (rngV()-.5)*sg.w, sg.y + (rngV()-.5)*sg.h*2,
        (rngV()-.5)*200, (rngV()-.5)*200, 3+rngV()*5, (rngV()*1e6)|0);
    for (let i = 0; i < 14; i++)
      spawnDust(sg.x + (rngV()-.5)*sg.w, sg.y + (rngV()-.5)*sg.h*2,
        (rngV()-.5)*190, (rngV()-.5)*190, .6+rngV()*.7, 1.7, .9);
    shake(.12);
  }
  // Gold L1426-1451 prisonEdgeStep (cascade trigger per collapsing edge)
  function prisonEdgeStep(p, e, dt){
    const w = e.wallGeom;
    if (!w) return;
    for (const sg of w.segs){
      sg.lit = Math.max(0, (sg.lit||0) - dt * 1.7);
      sg.stress = Math.max(0, (sg.stress||0) - dt * 0.30);
      if (sg.dead){
        sg.failT += dt;
        sg.driftX = (sg.driftX||0) + sg.fallVX * dt;
        sg.driftY = (sg.driftY||0) + sg.fallVY * dt;
        sg.fallVX *= Math.exp(-2.9 * dt);
        sg.fallVY *= Math.exp(-2.9 * dt);
      }
    }
    if (p.collapsed || e.collapsing){
      for (const sg of w.segs){
        if (sg.dead) continue;
        const L = w.segs[sg.i-1], Rr = w.segs[sg.i+1];
        const unsupported = (L && L.dead) || (Rr && Rr.dead);
        if (unsupported && (sg.stress||0) > .30){
          sg._noSup = (sg._noSup||0) + dt;
          if (sg._noSup > .18) prisonFailSegment(e, sg);
        } else sg._noSup = 0;
      }
    }
  }
  function prisonStep(c, dt){
    const p = c.prison;
    for (const e of p.edges){
      e.lit = Math.max(0, e.lit - dt * 1.5);
      prisonEdgeStep(p, e, dt);
    }
    if (p.pulse >= 0 && p.solid){ p.pulse += dt * 1.8; if (p.pulse > 1.1) p.pulse = -1; }
    if (p.collapsed){ p.fading += dt; }
  }
  // per-facet visual hit (real contact point/fraction) — presentation only
  function facetHit(c, i, hx, hy, frac, vx, vy){
    const e = c.prison.edges[i];
    if (!e || !e.wallGeom) return null;
    e.lit = Math.max(e.lit, 0.85);
    return wallHit(e.wallGeom, hx, hy, frac, vx, vy);
  }
  // a single facet fails (real HP 75 exhausted): its side falls, cascade by stress.
  function breakFacet(c, i, originIdx){
    const e = c.prison.edges[i];
    if (!e || e.dead) return;
    e.dead = true; e.collapsing = true;
    if (e.wallGeom){
      const seg = e.wallGeom.segs[originIdx != null ? originIdx : (e.wallGeom.segs.length/2)|0] || e.wallGeom.segs[6];
      prisonFailSegment(e, seg);
    }
    shake(0.2);
  }
  // Gold L1460-1486 collapse: staggered seeded side failures; stones anchored at
  // the cage are kicked outward and rejoin on Gold-style returns.
  function collapsePrison(c){
    const p = c.prison;
    if (p.collapsed) return;
    p.collapsed = true;
    shake(0.34);
    for (let j = 0; j < 6; j++) setTimeoutSim(j*.085, () => {
      const e = p.edges[(5-j+6)%6];
      if (e.dead && e.collapsing) return;
      e.dead = true; e.collapsing = true;
      if (e.wallGeom) prisonFailSegment(e, e.wallGeom.segs[(e.wallGeom.segs.length/2)|0]);
    });
    detachPrisonStones(c, null);
    if (c.tl){ c.tl.active = false; c.tl = null; }
    hero.awakeT = Math.max(hero.awakeT, 0.3);
  }
  // release anchored stones (all, or only `ids`) away from the cage centre.
  function detachPrisonStones(c, ids){
    const p = c.prison;
    let i = 0;
    for (const s of stones){
      if (ids && ids.indexOf(s.uid) < 0) continue;
      if (s.state !== 'anchored') continue;
      const ox = s.x - p.cx, oy = s.y - p.cy; const m = Math.hypot(ox,oy)||1;
      s.state='free'; s.vx=ox/m*200; s.vy=oy/m*200; s.anchorRef = null; s.spline = null;
      setTimeoutSim(0.18 + i * 0.07, ((st, T) => () => rejoinStone(st, T))(s, 0.80 + rngG()*0.2));
      i++;
    }
  }

  /* --------------------------------------------------------- solid geometry */
  // World-space segments of the visibly grown material (cells with grow >= 0.5,
  // the Gold's own projectile threshold L949/L1063). Each contiguous run of grown
  // cells is ONE capsule axis. Used only as the physical truth source by the game.
  const CELL_SOLID = 0.5 - 1e-6;
  function cellRuns(geom, growOf, alive){
    const runs = [];
    if (!geom) return runs;
    const N = geom.segs.length, half = 0.5 / N;
    let start = -1;
    const close = (endIdx) => {
      const u0 = geom.segs[start].u - half, u1 = geom.segs[endIdx].u + half;
      runs.push({ ax: geom.a.x + (geom.b.x-geom.a.x)*u0, ay: geom.a.y + (geom.b.y-geom.a.y)*u0,
        bx: geom.a.x + (geom.b.x-geom.a.x)*u1, by: geom.a.y + (geom.b.y-geom.a.y)*u1,
        from: start, to: endIdx });
      start = -1;
    };
    for (let i = 0; i < N; i++){
      const sg = geom.segs[i];
      const solid = growOf(sg) >= CELL_SOLID && !(alive && sg.dead);
      if (solid && start < 0) start = i;
      else if (!solid && start >= 0) close(i - 1);
    }
    if (start >= 0) close(N - 1);
    return runs;
  }
  function wallRuns(c){ return cellRuns(c.geom, (sg) => sg.grow, true); }
  function facetRuns(c, i){
    const e = c.prison.edges[i];
    if (!e || !e.wallGeom || e.dead) return [];
    return cellRuns(e.wallGeom, (sg) => prisonSegGrow(e, sg), true);
  }

  /* ---------------------------------------------------------------- step */
  function step(dt, f){
    R.time += dt;
    timersStep(dt);
    heroStep(dt, f);
    orbitStep(dt);
    stonesStep(dt);
    for (const c of R.constructs){
      if (c.tl) c.tl.update(dt);
      if (c.kind === 'wall') wallStep(c, dt); else prisonStep(c, dt);
    }
    R.shakeV = Math.max(0, R.shakeV - dt * 2.6);
    debrisStep(dt);
    dustStep(dt, R.time);
  }
  function advance(dt){
    if (!(dt > 0)) return 0;
    R.acc += dt;
    let n = Math.floor(R.acc / DT + 1e-9);
    if (n > 40){ n = 40; R.acc = 0; } else R.acc -= n * DT;
    for (let k = 1; k <= n; k++) step(DT, k / n);
    if (n > 0){ bodyPrev.x = bodyNext.x; bodyPrev.y = bodyNext.y; }
    // prune fully faded constructs
    for (let i = R.constructs.length - 1; i >= 0; i--){
      const c = R.constructs[i];
      const faded = c.kind === 'wall' ? (c.geom && c.geom.collapsed && c.geom.fading > 1.6)
        : (c.prison.collapsed && c.prison.fading > 1.6);
      if (faded) R.constructs.splice(i, 1);
    }
    return n;
  }
  function setBody(x, y, vx, vy){
    if (!R.started){
      R.started = true;
      hero.x = hero.px = x; hero.y = hero.py = y;
      bodyPrev.x = bodyNext.x = x; bodyPrev.y = bodyNext.y = y;
      orbit.x = x; orbit.y = y; orbit.vx = orbit.vy = 0;
      for (const s of stones){
        stoneSlot(s, 0); s.x = s.px = s.slot.x; s.y = s.py = s.slot.y;
        s.vx = s.slot.vx; s.vy = s.slot.vy; s.trailFill = 0; s.trailI = 0;
        s.rot = s.prot = s.rotT = s.slot.a + Math.PI/2; s.rotV = 0;
      }
    }
    bodyNext.x = x; bodyNext.y = y; bodyNext.vx = vx || 0; bodyNext.vy = vy || 0;
  }
  function setVisual(v){ visual = !!v; R.visual = visual; if (visual) ensureFx(); }
  function awaken(v, flash){
    hero.awakeT = Math.max(hero.awakeT, v);
    if (flash){ hero.eyeFlash = Math.max(hero.eyeFlash, flash); hero.pendantPulse = Math.max(hero.pendantPulse, flash * 0.8); }
  }

  Object.assign(R, {
    hero, orbit, stones, attractors,
    get fx() { return fx; }, ensureFx,
    setBody, advance, awaken, setVisual, stoneSlot, scoreStone, indexFacet, facetNormal,
    reserve, beginIntercept, refract, recoilKick, returnHome,
    abortReturn: (i, T) => rejoinStone(stones[i], T != null ? T : 0.5),
    planWall, castWall, wallHit, collapseWall, detachWall, wallRuns,
    castPrison, prisonFollow, facetHit, breakFacet, collapsePrison, detachPrisonStones, facetRuns,
    rngG, rngV, spawnDust, spawnDebris, shake, setTimeoutSim,
    prisonSegGrow,
    // Gold L1166 semantics for hosts that need the raw launch (presentation tests)
    launch,
    renderBody: (c, emissive, alpha) => drawCrystala(c, hero, emissive, alpha),
    renderEyeAccent: (c, alpha) => drawEyeAccent(c, hero, alpha),
    renderStones: (c, alpha, emissive, filterFn) => {
      for (const s of stones) {
        if (filterFn && !filterFn(s)) continue;
        if (!emissive) drawTrail(c, s, alpha);
        drawStone(c, s, alpha, emissive);
      }
    },
    renderConstructs: (c, emissive, front = null) => {
      for (const cons of R.constructs) {
        if (cons.kind === 'wall' && cons.geom) drawWall(c, cons.geom, emissive);
        else if (cons.kind === 'prison' && cons.prison) drawPrison(c, cons.prison, emissive, front);
      }
    },
    renderDust: (c, alpha) => fx && drawDust(c, fx.dust, alpha),
    renderDebris: (c, alpha) => fx && drawDebris(c, fx.debris, alpha),
  });
  return R;
}

/* ========================================================== VISUAL / DRAWING */
/* Ported from Gold L326-550, L861-890, L1766-2060, L2125-2165                  */
const ART_INK = '#140d22';

let _Path2DClass = null;
function getPath2DFn() {
  if (_Path2DClass) return _Path2DClass;
  if (typeof Path2D !== 'undefined') _Path2DClass = Path2D;
  else if (typeof window !== 'undefined' && window.Path2D) _Path2DClass = window.Path2D;
  else if (typeof globalThis !== 'undefined' && globalThis.Path2D) _Path2DClass = globalThis.Path2D;
  return _Path2DClass;
}

let ART = null;
let ART_EYE = null;
let ART_MOUTH = null;
let ART_EYE_LIGHT = null;

function referencePath(encoded) {
  const s = encoded.replace(/(\d{3})(\d{3,4})/g, '$1 $2');
  const P2D = getPath2DFn();
  return P2D ? new P2D(s) : { _svg: s };
}

function artPart(d, base, faces = [], edge = '') {
  return {
    path: referencePath(d),
    base,
    faces: faces.map(f => ({ color: f[0], path: referencePath(f[1]) })),
    edge: edge ? referencePath(edge) : null
  };
}

function ensureArt() {
  if (ART) return ART;
  ART = {
    fan: artPart('M405694 C420752 389792 341819 Q285849 243810 Q257865 329893 L383861 Q425798 427742 Z', '#39205f', [
      ['#8742cf', 'M405694 L361824 L329893 L383861Z'],
      ['#c789ed', 'M243810 L361824 L292861Z'],
      ['#eee0fa', 'M243810 L311837 L292861Z'],
      ['#5924a3', 'M311837 L329893 L361824Z']
    ]),
    backTip: artPart('M393870 Q305934 217915 Q262959 338961 L380930Z', '#512682', [
      ['#e5c7f5', 'M217915 L327930 L280948Z'],
      ['#a560df', 'M327930 L338961 L393870Z']
    ]),
    tail: artPart('M461864 C437916 440960 4681003 L5191107 C4581081 4221042 4141001 C407950 432910 461864Z', '#25143f', [
      ['#432176', 'M461864 L4141001 L454970Z'],
      ['#7432ba', 'M4141001 L4681003 L5191107Z'],
      ['#c28de7', 'M454970 L4681003 L5191107 L4841048Z'],
      ['#e9d7fa', 'M4841048 L5191107 L4811079Z']
    ]),
    lock: artPart('M421756 C433815 407863 361905 C326938 305973 3481047 C3481008 387985 414946 C459900 461832 421756Z', '#442277', [
      ['#25143f', 'M421756 L361905 L406884Z'],
      ['#6228b3', 'M361905 L319964 L377963 L406884Z'],
      ['#984cdd', 'M421756 L406884 L414946 L442869Z'],
      ['#aa63e5', 'M319964 L3481047 L354988 L377963Z'],
      ['#e9cdf9', 'M319964 L3481047 L339994Z'],
      ['#cf99f0', 'M377963 L414946 L354988Z']
    ], 'M421761 Q424826 392866 M323963 Q3161002 3451034'),
    cheek: artPart('M450724 L498781 Q541849 474926 Q508863 455825 L426787Z', '#49237f', [
      ['#261440', 'M450724 L453806 L498781Z'],
      ['#8740c7', 'M498781 L453806 L511850Z'],
      ['#eebdfa', 'M453806 L493864 L474926 L511850Z'],
      ['#f9f1ff', 'M493864 L474926 L496894Z']
    ]),
    shell: artPart('M434574 L514496 L571435 L628394 L685435 L742496 L822574 L834700 L783805 L708877 L681840 L628871 L575840 L548877 L473805 L422700Z', '#170e28', [
      ['#2d194b', 'M434574 L532711 L473805 L422700Z'],
      ['#432567', 'M473805 L532711 L548877Z'],
      ['#301a4e', 'M822574 L724711 L783805 L834700Z'],
      ['#4d2b77', 'M724711 L783805 L708877Z'],
      ['#27113f', 'M548815 L628871 L708815 L628784Z'],
      ['#26133e', 'M514496 L628394 L582578 L532711Z'],
      ['#201032', 'M742496 L628394 L674578 L724711Z']
    ]),
    face: artPart('M530711 Q628729 726711 L713772 Q701807 628838 Q555807 543772Z', '#f2e6fa', [
      ['#d8bceb', 'M530711 L562765 L574808 L543772Z'],
      ['#fff5ff', 'M562765 L628786 L692765 L670819 L628838 L586819Z'],
      ['#e3caee', 'M726711 L692765 L670819 L713772Z']
    ]),
    crest: artPart('M628372 L690430 L741492 L719548 L686574 L628512 L568574 L539548 L513492 L567431Z', '#502093', [
      ['#d292eb', 'M628372 L567431 L550526 L589458Z'],
      ['#fff0ff', 'M628391 L576465 L565521 L596477Z'],
      ['#8424cb', 'M589458 L568574 L628512 L628392Z'],
      ['#3c146b', 'M628392 L628512 L686574 L665461Z'],
      ['#9e5cd7', 'M628372 L690430 L719510 L665461Z'],
      ['#5f26a0', 'M665461 L686574 L719548 L719510Z'],
      ['#261344', 'M513492 L539548 L568574 L550526Z'],
      ['#381759', 'M741492 L719548 L686574 L719510Z']
    ], 'M515491 L628376 L738491'),
    temple: artPart('M382438 Q345520 376591 L462715 L374653 L342567 Q366514 382438Z', '#522980', [
      ['#b17fdc', 'M382438 L362562 L399598Z'],
      ['#e9d5fa', 'M342567 L399598 L462715 L390659Z'],
      ['#8750b8', 'M362562 L376591 L399598Z'],
      ['#64329a', 'M399598 L462715 L390659Z']
    ]),
    crown: artPart('M628755 L443608 L419520 L442338 L500270 L468449 L505523 L550543 L580630Z', '#8253bb', [
      ['#faf4ff', 'M500270 L442338 L468449Z'],
      ['#d5adef', 'M442338 L419520 L451461Z'],
      ['#f2deff', 'M442338 L451461 L468449Z'],
      ['#9970cb', 'M451461 L419520 L505523Z'],
      ['#fff6ff', 'M419520 L550543 L576618Z'],
      ['#d3b0ee', 'M550543 L580630 L628755 L576618Z'],
      ['#65409d', 'M419520 L443608 L628755 L504600Z'],
      ['#a16ccd', 'M504600 L576618 L628755Z'],
      ['#e7cff8', 'M451461 L505523 L468449Z']
    ], 'M500270 L442338 L419520 L443608 M550545 L626751'),
    brow: artPart('M452642 L493693 L557718 L628738 L699718 L763693 L804642 L779714 L733746 L676759 L628779 L580759 L523746 L477714Z', '#221036', [
      ['#542381', 'M452642 L557718 L580759 L492716Z'],
      ['#8c2bc4', 'M492716 L580759 L552738Z'],
      ['#c95ce6', 'M492716 L552738 L535739Z'],
      ['#ead4fa', 'M495719 L552738 L571744 L521733Z'],
      ['#40166a', 'M804642 L699718 L676759 L764716Z'],
      ['#9e33d1', 'M764716 L676759 L704738Z'],
      ['#f0caff', 'M759719 L704738 L685744 L735733Z'],
      ['#45205f', 'M557718 L628738 L699718 L628779Z']
    ], 'M478713 Q550750 602756 M778713 Q706750 654756'),
    jewel: artPart('M628535 L679610 L628695 L577610Z', '#ac36d7', [
      ['#fae9ff', 'M628535 L577610 L599606Z'],
      ['#db8bec', 'M628535 L599606 L628610Z'],
      ['#602093', 'M628535 L679610 L653605Z'],
      ['#8831c0', 'M628535 L653605 L628610Z'],
      ['#e973f0', 'M577610 L628610 L628695Z'],
      ['#532080', 'M679610 L628610 L628695Z'],
      ['#f9ebff', 'M628561 L632605 L654610 L632615 L628673 L623616 L601610 L623604Z']
    ], 'M628537 L579610 L628693')
  };
  ART_EYE = referencePath('M540730 L613740 L602752 L559746Z');
  ART_MOUTH = referencePath('M613796 Q627786 643797 Q628792 613796Z');
  ART_EYE_LIGHT = referencePath('M554735 L605742 L593747 L566742Z M702735 L651742 L663747 L690742Z');
  return ART;
}

function paintPart(c, part, shade = 0) {
  if (!part || !part.path) return;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = ART_INK;
  c.lineWidth = 15;
  c.stroke(part.path);
  c.fillStyle = part.base;
  c.fill(part.path);
  c.save();
  c.clip(part.path);
  for (const f of part.faces) {
    c.fillStyle = f.color;
    c.fill(f.path);
    c.strokeStyle = f.color;
    c.lineWidth = 0.65;
    c.stroke(f.path);
  }
  if (shade) {
    c.globalAlpha *= shade;
    c.fillStyle = '#1a0730';
    c.fill(part.path);
  }
  c.restore();
  if (part.edge) {
    c.save();
    c.clip(part.path);
    c.strokeStyle = '#f6ecff';
    c.lineWidth = 4;
    c.stroke(part.edge);
    c.restore();
  }
  c.strokeStyle = ART_INK;
  c.lineWidth = 4;
  c.stroke(part.path);
  c.restore();
}

function paintPair(c, part, shade = 0.06) {
  paintPart(c, part);
  c.save();
  c.translate(1256, 0);
  c.scale(-1, 1);
  paintPart(c, part, shade);
  c.restore();
}

function heroTransform(c, hero, drawAlpha = 1) {
  const px = hero && hero.px !== undefined ? hero.px : (hero ? hero.x : 0);
  const py = hero && hero.py !== undefined ? hero.py : (hero ? hero.y : 0);
  const x = hero ? hero.x : 0, y = hero ? hero.y : 0;
  c.translate(lerp(px, x, drawAlpha), lerp(py, y, drawAlpha));
  c.scale(0.205, 0.205);
  c.translate(-628, -650);
}

function drawCrystala(c, hero, emissive = false, drawAlpha = 1) {
  ensureArt();
  const aw = smooth(clamp(hero ? hero.awake : 0, 0, 1));
  const lift = 54 * aw;
  const eyeFlash = hero ? (hero.eyeFlash || 0) : 0;
  c.save();
  heroTransform(c, hero, drawAlpha);
  if (emissive) {
    c.globalCompositeOperation = 'lighter';
    c.save();
    c.translate(0, -lift);
    c.globalAlpha = 0.08 + aw * 0.42 + eyeFlash * 0.18;
    c.fillStyle = '#b853ef';
    c.fill(ART.jewel.path);
    c.strokeStyle = '#e6b6ff';
    c.lineWidth = 8;
    c.stroke(ART.jewel.path);
    c.restore();
    if (aw > 0.08) {
      c.globalAlpha = 0.14 + aw * 0.52 + eyeFlash * 0.26;
      c.fillStyle = '#df9cff';
      c.fill(ART_EYE_LIGHT);
    }
    c.globalCompositeOperation = 'source-over';
    c.restore();
    return;
  }
  paintPair(c, ART.fan);
  paintPair(c, ART.backTip);
  paintPair(c, ART.tail);
  paintPair(c, ART.lock);
  paintPart(c, ART.shell);
  paintPair(c, ART.cheek);
  paintPair(c, ART.temple);
  paintPart(c, ART.face);
  c.fillStyle = '#442060';
  c.fill(ART_MOUTH);
  c.save();
  c.clip(ART.face.path);
  c.fillStyle = '#ad77dd';
  c.strokeStyle = '#2b123e';
  c.lineWidth = 8;
  c.stroke(ART_EYE);
  c.fill(ART_EYE);
  c.save();
  c.translate(1256, 0);
  c.scale(-1, 1);
  c.stroke(ART_EYE);
  c.fill(ART_EYE);
  c.restore();
  c.fillStyle = '#fff7ff';
  c.globalAlpha = 0.3 + 0.7 * aw;
  c.fill(ART_EYE_LIGHT);
  c.restore();
  c.save();
  c.translate(0, -lift * 0.42);
  paintPart(c, ART.crest);
  c.restore();
  c.save();
  c.translate(0, -lift);
  paintPair(c, ART.crown, 0.04);
  paintPart(c, ART.brow);
  paintPart(c, ART.jewel);
  c.restore();
  c.restore();
}

function drawEyeAccent(c, hero, drawAlpha = 1) {
  ensureArt();
  const aw = smooth(clamp(hero ? hero.awake : 0, 0, 1));
  if (aw < 0.08) return;
  const eyeFlash = hero ? (hero.eyeFlash || 0) : 0;
  c.save();
  heroTransform(c, hero, drawAlpha);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.16 + aw * 0.54 + eyeFlash * 0.34;
  c.fillStyle = '#fff7ff';
  c.fill(ART_EYE_LIGHT);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.restore();
}

let cachedSprites = null;
function getSprites() {
  if (cachedSprites) return cachedSprites;
  let createCanvasFn = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    createCanvasFn = (w, h) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      return cv;
    };
  } else if (typeof globalThis !== 'undefined' && globalThis.__createCanvas) {
    createCanvasFn = globalThis.__createCanvas;
  }
  if (!createCanvasFn) return null;
  function makeSprite(size, stops) {
    const cv = createCanvasFn(size, size);
    const g = cv.getContext('2d');
    if (!g) return cv;
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) gr.addColorStop(s[0], s[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return cv;
  }
  const dust = makeSprite(32, [
    [0, 'rgba(255,240,255,1)'],
    [0.22, 'rgba(214,150,255,0.85)'],
    [0.55, 'rgba(140,70,220,0.28)'],
    [1, 'rgba(90,40,180,0)']
  ]);
  const glow = makeSprite(64, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.25, 'rgba(224,140,255,0.55)'],
    [0.6, 'rgba(130,60,210,0.18)'],
    [1, 'rgba(80,30,160,0)']
  ]);
  cachedSprites = { dust, glow };
  return cachedSprites;
}

function makeSprite(size, stops) {
  let createCanvasFn = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    createCanvasFn = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
  } else if (typeof globalThis !== 'undefined' && globalThis.__createCanvas) {
    createCanvasFn = globalThis.__createCanvas;
  }
  if (!createCanvasFn) return null;
  const cv = createCanvasFn(size, size);
  const g = cv.getContext('2d');
  if (!g) return cv;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return cv;
}

function drawStar4(c, cx, cy, size, rot = 0, color = '#ffffff') {
  const s = size, s2 = size * 0.20;
  c.save();
  c.translate(cx, cy);
  c.rotate(rot || 0);
  c.beginPath();
  c.moveTo(0, -s);
  c.lineTo(s2, -s2);
  c.lineTo(s, 0);
  c.lineTo(s2, s2);
  c.lineTo(0, s);
  c.lineTo(-s2, s2);
  c.lineTo(-s, 0);
  c.lineTo(-s2, -s2);
  c.closePath();
  c.fillStyle = color || '#ffffff';
  c.fill();
  c.restore();
}

function drawGem(c, gem, o = {}) {
  if (!gem || !gem.outline) return;
  c.save();
  const a = c.globalAlpha * (o.alpha != null ? o.alpha : 1);
  c.globalAlpha = a;
  c.beginPath();
  tracePoly(c, gem.outline);
  c.fillStyle = (gem.ramp && gem.ramp[1]) || '#58309d';
  c.fill();
  c.save();
  c.clip();
  if (gem.facets) {
    for (const f of gem.facets) {
      c.beginPath();
      tracePoly(c, f.pts);
      c.fillStyle = f.color;
      c.fill();
    }
  }
  if (o.tint) {
    c.globalAlpha = a * (o.tintA != null ? o.tintA : 1);
    c.beginPath();
    tracePoly(c, gem.outline);
    c.fillStyle = o.tint;
    c.fill();
    c.globalAlpha = a;
  }
  if (o.rim !== false && gem.rim && gem.rim.length) {
    c.lineWidth = (o.lw || 2.6) * 1.2;
    c.strokeStyle = o.rimColor || '#eee0fb';
    c.beginPath();
    for (const e of gem.rim) {
      c.moveTo(e[0].x, e[0].y);
      c.lineTo(e[1].x, e[1].y);
    }
    c.stroke();
  }
  if (gem.star) {
    const s = gem.r * (gem.starSize || 0.31);
    drawStar4(c, gem.c.x, gem.c.y, s, o.starRot || 0, '#ffffff');
    drawStar4(c, gem.c.x, gem.c.y, s * 0.42, (o.starRot || 0) + Math.PI / 4, '#f0d8ff');
  }
  c.restore();
  if (o.outline !== false) {
    c.lineWidth = o.lw || 2.8;
    c.strokeStyle = o.stroke || '#190d2a';
    c.lineJoin = 'round';
    c.beginPath();
    tracePoly(c, gem.outline);
    c.stroke();
  }
  c.restore();
}

function drawTrail(c, s, alpha = 1, sprites = null) {
  if (!s || s.trailFill < 5) return;
  const spd = typeof s.speed === 'function' ? s.speed() : Math.hypot(s.vx, s.vy);
  const strength = clamp((spd - 18) / 320, 0, 1) * (0.28 + (s.energy || 0) * 0.62);
  if (strength < 0.025) return;
  const spr = sprites || getSprites();
  c.save();
  for (let sample = 3; sample <= 11; sample += 4) {
    if (sample >= s.trailFill) break;
    const idx = (s.trailI - 1 - sample + TRAIL_N * 2) % TRAIL_N;
    const next = (s.trailI - 1 - Math.max(0, sample - 2) + TRAIL_N * 2) % TRAIL_N;
    const x = s.trail[idx * 2], y = s.trail[idx * 2 + 1];
    const nx = s.trail[next * 2], ny = s.trail[next * 2 + 1];
    const dx = nx - x, dy = ny - y;
    const fade = 1 - sample / 14;
    const size = (2.4 + strength * 3.6) * fade;
    const stretch = clamp(1 + Math.hypot(dx, dy) * 0.05, 1, 2.4);
    c.save();
    c.translate(x, y);
    if (Math.abs(dx) + Math.abs(dy) > 0.1) c.rotate(Math.atan2(dy, dx));
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = strength * fade * 0.16;
    c.fillStyle = '#7d40ac';
    c.beginPath();
    c.ellipse(0, 0, size * stretch * 1.7, size * 0.95, 0, 0, TAU);
    c.fill();
    if (spr && spr.dust) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = strength * fade * 0.52;
      c.drawImage(spr.dust, -size * stretch * 3, -size * 3, size * stretch * 6, size * 6);
    }
    c.restore();
  }
  c.restore();
}

function drawStone(c, s, alpha = 1, emissive = false, sprites = null) {
  if (!s || !s.gem) return;
  const px = s.px !== undefined ? s.px : s.x;
  const py = s.py !== undefined ? s.py : s.y;
  const prot = s.prot !== undefined ? s.prot : s.rot;
  const x = lerp(px, s.x, alpha), y = lerp(py, s.y, alpha);
  const r = lerp(prot, s.rot, alpha);
  const dScale = 1 + (s.depth || 0) * 0.055;
  const spr = sprites || getSprites();
  c.save();
  c.translate(x, y);
  c.rotate(r);
  c.scale(dScale, dScale);
  if (emissive) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.09 + (s.energy || 0) * 0.42 + (s.recoil || 0) * 0.25;
    c.beginPath();
    tracePoly(c, s.gem.outline);
    c.fillStyle = '#9b55ee';
    c.fill();
    if (spr && spr.glow) {
      if ((s.energy || 0) > 0.5) {
        c.globalAlpha = (s.energy - 0.5) * 0.7;
        c.drawImage(spr.glow, -s.gem.r * 1.8, -s.gem.r * 1.8, s.gem.r * 3.6, s.gem.r * 3.6);
      }
      if (s.internal && s.internal.T > 0) {
        const k = s.internal.t / s.internal.T;
        c.globalAlpha = Math.sin(k * Math.PI) * 0.9;
        c.drawImage(spr.glow, -s.gem.r * 2.2, -s.gem.r * 2.2, s.gem.r * 4.4, s.gem.r * 4.4);
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.restore();
    return;
  }
  drawGem(c, s.gem, {
    lw: 2.3,
    tint: (s.energy || 0) > 0.02 ? '#dfa8ff' : null,
    tintA: (s.energy || 0) * 0.20 + (s.recoil || 0) * 0.18
  });
  // INTERNAL LIGHT PATH — clipped to the material (never a laser in open air)
  if (s.internal && s.internal.T > 0) {
    const it = s.internal, k = clamp(it.t / it.T, 0, 1);
    c.save();
    c.beginPath();
    tracePoly(c, s.gem.outline);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    const steps = 18;
    c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      const head = clamp(k * 1.35, 0, 1), tail = clamp(k * 1.35 - 0.45, 0, 1);
      for (let i = 0; i <= steps; i++) {
        const u = tail + (head - tail) * (i / steps);
        const mx = (1 - u) * (1 - u) * it.a.x + 2 * (1 - u) * u * it.m.x + u * u * it.b.x;
        const my = (1 - u) * (1 - u) * it.a.y + 2 * (1 - u) * u * it.m.y + u * u * it.b.y;
        if (i === 0) c.moveTo(mx, my); else c.lineTo(mx, my);
      }
      c.strokeStyle = pass === 0 ? 'rgba(180,110,255,0.75)' : 'rgba(255,245,255,0.95)';
      c.lineWidth = pass === 0 ? 8 : 2.6;
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

function drawWall(c, w, emissive = false, sprites = null) {
  if (!w || !w.segs) return;
  const spr = sprites || getSprites();
  const fade = w.collapsed ? clamp(1 - (w.fading || 0) / 1.6, 0, 1) : 1;
  for (const sg of w.segs) {
    if (!sg || sg.grow <= 0.001) continue;
    const g = easeOutBack(clamp(sg.grow, 0, 1), 0.45);
    c.save();
    c.translate(sg.x + (sg.driftX || 0), sg.y + (sg.driftY || 0));
    c.rotate((w.angle || 0) + (sg.dead ? (sg.fallR || 0) * Math.min(1, (sg.failT || 0) * 2) : 0));
    c.globalAlpha = fade * (sg.dead ? clamp(1 - (sg.failT || 0) / 1.1, 0, 1) : 1);
    c.scale(clamp(g, 0.02, 1.08), 0.61 + 0.39 * clamp(g, 0, 1.08));
    if (emissive) {
      c.globalCompositeOperation = 'lighter';
      const e = 0.055 + (sg.lit || 0) * 0.62 + (sg.stress || 0) * 0.42 + (1 - clamp(sg.grow, 0, 1)) * 0.65;
      c.globalAlpha = clamp(e, 0, 0.88) * fade;
      c.beginPath();
      tracePoly(c, sg.gem.outline);
      c.fillStyle = '#a45cf0';
      c.fill();
      c.globalCompositeOperation = 'source-over';
      c.restore();
      continue;
    }
    const heavy = clamp(sg.grow, 0, 1);
    drawGem(c, sg.gem, {
      lw: 2.15,
      stroke: '#05030b',
      tint: '#e8b9ff',
      tintA: (1 - heavy) * 0.68 + (sg.lit || 0) * 0.30,
      rimColor: `rgba(222,184,255,${0.35 + (sg.lit || 0) * 0.45})`
    });
    if (heavy > 0.99 && w.solid) {
      c.globalAlpha *= 0.34;
      c.beginPath();
      tracePoly(c, sg.gem.outline);
      c.fillStyle = '#100820';
      c.fill();
    }
    if ((sg.chip || 0) > 0.08) {
      c.globalAlpha = fade;
      c.beginPath();
      c.moveTo(sg.w * 0.59, -sg.h * 0.64);
      c.lineTo(sg.w * (0.59 - 0.34 * sg.chip), -sg.h * 0.57);
      c.lineTo(sg.w * 0.57, -sg.h * (0.64 - 0.39 * sg.chip));
      c.closePath();
      c.fillStyle = '#090713';
      c.fill();
    }
    if (sg.cracks) {
      for (const cr of sg.cracks) {
        c.beginPath();
        for (let i = 0; i < cr.pts.length; i++) {
          const p = cr.pts[i];
          if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
        }
        c.strokeStyle = '#04020a';
        c.lineWidth = 1.8;
        c.stroke();
        if (cr.glow > 0.01) {
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(255,190,255,${cr.glow * 0.8})`;
          c.lineWidth = 1;
          c.stroke();
          c.globalCompositeOperation = 'source-over';
        }
      }
    }
    if ((sg.stress || 0) > 0.25) {
      c.globalAlpha = clamp(sg.stress - 0.2, 0, 0.6) * fade;
      c.strokeStyle = '#ffd0ff';
      c.lineWidth = 1;
      c.beginPath();
      tracePoly(c, sg.gem.outline);
      c.stroke();
    }
    c.restore();
  }
  if (emissive) return;
  if (w.seamT !== undefined && w.seamT >= 0) {
    const k = clamp(w.seamT / 0.6, 0, 1), reach = k * w.span * 0.5;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const dir of [-1, 1]) {
      const x = w.cx + dir * w.tx * reach, y = w.cy + dir * w.ty * reach;
      c.save();
      c.translate(x, y);
      c.rotate(w.angle || 0);
      c.globalAlpha = (1 - k) * 0.72;
      c.strokeStyle = '#fff4ff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-4, -18);
      c.lineTo(3, 18);
      c.stroke();
      if (spr && spr.glow) c.drawImage(spr.glow, -26, -30, 52, 60);
      c.restore();
    }
    c.restore();
  }
  if (!w.solid && w.a && w.b && w.frontL !== undefined && w.frontR !== undefined) {
    const fl = { x: w.a.x + w.tx * w.span * 0.5 * w.frontL, y: w.a.y + w.ty * w.span * 0.5 * w.frontL };
    const fr = { x: w.b.x - w.tx * w.span * 0.5 * w.frontR, y: w.b.y - w.ty * w.span * 0.5 * w.frontR };
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const front of [fl, fr]) {
      c.save();
      c.translate(front.x, front.y);
      c.rotate(w.angle || 0);
      c.globalAlpha = 0.78;
      if (spr && spr.glow) c.drawImage(spr.glow, -31, -34, 62, 68);
      c.strokeStyle = 'rgba(255,240,255,0.95)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-3, -18);
      c.lineTo(3, 0);
      c.lineTo(-2, 18);
      c.stroke();
      c.restore();
    }
    c.restore();
  }
}

function prisonSegGrow(e, sg) {
  if (!e || !e.wallGeom || !e.wallGeom.segs) return 0;
  const N = e.wallGeom.segs.length;
  const half = 0.5 / N;
  const fromA = clamp((e.gA - (sg.u - half)) * N, 0, 1);
  if (!e.both) return fromA;
  const fromB = clamp((e.gB - ((1 - sg.u) - half)) * N, 0, 1);
  return Math.max(fromA, fromB);
}

function drawPrisonWallCell(c, p, e, sg, grow, emissive = false, fade = 1) {
  if (!sg || !sg.gem || !e || !e.wallGeom) return;
  const g = easeOutBack(clamp(grow, 0, 1), 0.45);
  c.save();
  c.translate(sg.x + (sg.driftX || 0), sg.y + (sg.driftY || 0));
  c.rotate(e.wallGeom.angle + ((sg.dead && sg.failT >= 0) ? (sg.fallR || 0) * Math.min(1, sg.failT * 2) : 0));
  c.globalAlpha = fade * (sg.dead ? clamp(1 - (sg.failT || 0) / 1.1, 0, 1) : 1);
  c.scale(clamp(g, 0.02, 1.08), 0.61 + 0.39 * clamp(g, 0, 1.08));
  if (emissive) {
    c.globalCompositeOperation = 'lighter';
    const ee = 0.055 + (e.lit || 0) * 0.62 + (1 - clamp(grow, 0, 1)) * 0.65;
    c.globalAlpha = clamp(ee, 0, 0.88) * fade;
    c.beginPath();
    tracePoly(c, sg.gem.outline);
    c.fillStyle = '#a45cf0';
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.restore();
    return;
  }
  const heavy = clamp(grow, 0, 1);
  drawGem(c, sg.gem, {
    lw: 2.15,
    stroke: '#05030b',
    tint: '#e8b9ff',
    tintA: (1 - heavy) * 0.68 + (e.lit || 0) * 0.30,
    rimColor: `rgba(222,184,255,${0.35 + (e.lit || 0) * 0.45})`
  });
  if (heavy > 0.99 && p && p.solid) {
    c.globalAlpha *= 0.34;
    c.beginPath();
    tracePoly(c, sg.gem.outline);
    c.fillStyle = '#100820';
    c.fill();
  }
  c.restore();
}

function drawPrisonBuildHead(c, e, u, sprites = null) {
  if (!e || !e.a || !e.b) return;
  const spr = sprites || getSprites();
  const hx = lerp(e.a.x, e.b.x, u), hy = lerp(e.a.y, e.b.y, u);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.82;
  if (spr && spr.glow) c.drawImage(spr.glow, hx - 31, hy - 34, 62, 68);
  c.strokeStyle = 'rgba(255,240,255,0.95)';
  c.lineWidth = 2;
  const ang = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
  c.translate(hx, hy);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(-3, -18);
  c.lineTo(3, 0);
  c.lineTo(-2, 18);
  c.stroke();
  c.restore();
}

function drawPrison(c, p, emissive = false, front = null, sprites = null) {
  if (!p || !p.edges) return;
  const spr = sprites || getSprites();
  const fade = p.collapsed ? clamp(1 - (p.fading || 0) / 1.5, 0, 1) : 1;
  for (const e of p.edges) {
    if (!e || !e.wallGeom || !e.wallGeom.segs) continue;
    const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    const isFront = mid.y > (p.cy || 0) - 6;
    if (front !== null && isFront !== front) continue;
    for (const sg of e.wallGeom.segs) {
      const grow = prisonSegGrow(e, sg);
      if (grow <= 0.001) continue;
      drawPrisonWallCell(c, p, e, sg, grow, emissive, fade);
    }
    if (!emissive && !e.grown) {
      if (e.both) {
        if (e.gA > 0.002) drawPrisonBuildHead(c, e, e.gA, spr);
        if (e.gB > 0.002) drawPrisonBuildHead(c, e, 1 - e.gB, spr);
      } else if (e.gA > 0.002) drawPrisonBuildHead(c, e, e.gA, spr);
    }
  }
  if (emissive) return;
  if (p.pulse !== undefined && p.pulse >= 0) {
    const k = p.pulse;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const total = 6;
    const pos = (k % 1) * total;
    const ei = Math.floor(pos) % 6;
    const eu = pos - Math.floor(pos);
    const e = p.edges[ei];
    if (e && e.a && e.b) {
      const px = lerp(e.a.x, e.b.x, eu), py = lerp(e.a.y, e.b.y, eu);
      c.globalAlpha = clamp(1 - k / 2.2, 0, 1);
      if (spr && spr.glow) c.drawImage(spr.glow, px - 40, py - 40, 80, 80);
    }
    c.restore();
  }
}

function drawDust(c, pool, alpha = 1, sprites = null) {
  if (!pool || !pool.alive) return;
  const spr = sprites || getSprites();
  const n = pool.alive.length;
  for (let i = 0; i < n; i++) {
    if (!pool.alive[i]) continue;
    const k = pool.life[i] / (pool.max[i] || 1);
    const pulse = Math.sin(clamp(k, 0, 1) * Math.PI);
    const a = pulse * (0.18 + (pool.hue ? pool.hue[i] : 0.5) * 0.34);
    if (a < 0.012) continue;
    const px = pool.px ? pool.px[i] : pool.x[i];
    const py = pool.py ? pool.py[i] : pool.y[i];
    const x = lerp(px, pool.x[i], alpha), y = lerp(py, pool.y[i], alpha);
    const sp = Math.hypot(pool.vx[i], pool.vy[i]);
    const st = clamp(1 + sp * 0.0105, 1, 3.1);
    const s = pool.sz[i] * (0.56 + k * 0.72);
    c.save();
    c.translate(x, y);
    if (st > 1.10) c.rotate(Math.atan2(pool.vy[i], pool.vx[i]));
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = a * 0.34;
    c.fillStyle = '#7d3db0';
    c.beginPath();
    c.ellipse(0, 0, s * st * 2.0, s * 1.15, 0, 0, TAU);
    c.fill();
    if (spr && spr.dust) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * 0.72;
      c.drawImage(spr.dust, -s * st * 3.1, -s * 3.1, s * st * 6.2, s * 6.2);
    }
    if (spr && spr.glow && pool.hue && pool.hue[i] > 0.70) {
      c.globalAlpha = a * 0.24;
      c.drawImage(spr.glow, -s * st * 2.2, -s * 2.2, s * st * 4.4, s * 4.4);
    }
    c.restore();
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

function drawDebris(c, list, alpha = 1) {
  if (!list || !Array.isArray(list)) return;
  for (const d of list) {
    if (!d.on || !d.poly) continue;
    const px = d.px !== undefined ? d.px : d.x;
    const py = d.py !== undefined ? d.py : d.y;
    const x = lerp(px, d.x, alpha), y = lerp(py, d.y, alpha);
    c.save();
    c.translate(x, y);
    c.rotate(d.r || 0);
    c.globalAlpha = clamp(d.life / (d.max || 1), 0, 1);
    c.beginPath();
    tracePoly(c, d.poly);
    c.fillStyle = (d.lit || 0) > 0.2 ? '#b177e8' : '#2c1750';
    c.fill();
    c.strokeStyle = '#06030e';
    c.lineWidth = 1.1;
    c.stroke();
    c.globalAlpha = 1;
    c.restore();
  }
}

function createBloomSystem(opts = {}) {
  const GS = opts.scale || 0.5;
  let dpr = opts.dpr || 1;
  let w = opts.width || 1000;
  let h = opts.height || 1000;
  let glowCv = null, glowB = null, glowC = null;
  let gx = null, gbx = null, gcx = null;
  let filterOk = false;

  function ensure(targetW, targetH, targetDpr) {
    if (targetW) w = targetW;
    if (targetH) h = targetH;
    if (targetDpr) dpr = targetDpr;
    const bw = Math.max(1, Math.round(w * dpr * GS));
    const bh = Math.max(1, Math.round(h * dpr * GS));
    if (!glowCv) {
      let createCanvasFn = null;
      if (typeof document !== 'undefined' && document.createElement) {
        createCanvasFn = (cw, ch) => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; return cv; };
      } else if (opts.createCanvas) {
        createCanvasFn = opts.createCanvas;
      } else if (typeof globalThis !== 'undefined' && globalThis.__createCanvas) {
        createCanvasFn = globalThis.__createCanvas;
      }
      if (createCanvasFn) {
        glowCv = createCanvasFn(bw, bh);
        glowB = createCanvasFn(bw, bh);
        glowC = createCanvasFn(bw, bh);
      }
      if (glowCv) {
        gx = glowCv.getContext('2d');
        gbx = glowB.getContext('2d');
        gcx = glowC.getContext('2d');
        try {
          if (gx && typeof gx.filter === 'string') {
            gx.filter = 'blur(2px)';
            filterOk = (gx.filter || '').includes('blur');
            gx.filter = 'none';
          }
        } catch (e) { filterOk = false; }
      }
    }
    if (glowCv && (glowCv.width !== bw || glowCv.height !== bh)) {
      glowCv.width = glowB.width = glowC.width = bw;
      glowCv.height = glowB.height = glowC.height = bh;
    }
  }

  ensure(w, h, dpr);

  function begin(worldTransform) {
    ensure();
    if (!gx) return null;
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, glowCv.width, glowCv.height);
    if (worldTransform) {
      gx.setTransform(
        worldTransform.a * GS * dpr,
        worldTransform.b * GS * dpr,
        worldTransform.c * GS * dpr,
        worldTransform.d * GS * dpr,
        worldTransform.e * GS * dpr,
        worldTransform.f * GS * dpr
      );
    } else {
      gx.setTransform(GS * dpr, 0, 0, GS * dpr, 0, 0);
    }
    return gx;
  }

  function composite(targetCtx, destW, destH) {
    if (!glowCv || !gx) return;
    const dw = destW || w;
    const dh = destH || h;
    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    if (filterOk && gbx && gcx) {
      gbx.setTransform(1, 0, 0, 1, 0, 0);
      gbx.globalCompositeOperation = 'copy';
      gbx.filter = 'blur(' + (2.6 * dpr * GS).toFixed(2) + 'px)';
      gbx.drawImage(glowCv, 0, 0);
      gbx.filter = 'none';

      gcx.setTransform(1, 0, 0, 1, 0, 0);
      gcx.globalCompositeOperation = 'copy';
      gcx.filter = 'blur(' + (9 * dpr * GS).toFixed(2) + 'px)';
      gcx.drawImage(glowB, 0, 0);
      gcx.filter = 'none';

      targetCtx.globalCompositeOperation = 'lighter';
      targetCtx.globalAlpha = 0.56;
      targetCtx.drawImage(glowB, 0, 0, dw, dh);
      targetCtx.globalAlpha = 0.25;
      targetCtx.drawImage(glowC, 0, 0, dw, dh);
    } else {
      targetCtx.globalCompositeOperation = 'lighter';
      targetCtx.globalAlpha = 0.38;
      targetCtx.drawImage(glowCv, 0, 0, dw, dh);
    }
    targetCtx.restore();
  }

  return {
    ensure,
    begin,
    composite,
    get glowCanvas() { return glowCv; },
    get glowCtx() { return gx; },
    get isFilterSupported() { return filterOk; }
  };
}

g.APEX_CRYSTALA_GOLD = {
  version: 'V6-rig-1',
  createRig, DT, RETIME, GROW_RATE, STONE_CFG, TRAIL_N,
  drawCrystala, drawEyeAccent, drawStone, drawTrail, drawWall,
  drawPrison, drawPrisonWallCell, drawPrisonBuildHead,
  drawDust, drawDebris, drawGem, drawStar4,
  createBloomSystem, getSprites, makeSprite, ensureArt,
  get ART() { return ensureArt(); },
  util: { TAU, clamp, lerp, smooth, smoother, ss, easeOutCubic, easeOutQuint, easeOutBack, wrapPI, dist,
    mulberry32, hermite, flow, buildGem, buildWallGeometry, prisonSegGrow, tracePoly, P, centroid,
    referencePath, heroTransform },
};
g.apexCrystalaGoldV6 = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
