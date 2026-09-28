/* ============================================================================
   BLACK_HOLE battle sandbox — battle layer.
   Golden motion vocabulary (springs, phase clocks, blink, orbital particle
   sim) is reused from the approved prototype; ability choreography recomposes
   the same spring bank exactly like the approved Skill Composer Lab presets.
   ============================================================================ */

/* ---------------- config (production numbers where they exist) ------------- */
const CFG = {
  MATCH_HP: 1000,                 // arsenalQuestConfig.MATCH_HP
  FIGHTER_SPEED: 520,             // arsenalQuestConfig.FIGHTER_SPEED
  BASE_RADIUS: 75,                // apexEngine Fighter.radius
  BULLET_HIT_RADIUS_SCALE: 0.78,  // arsenalQuestConfig.BULLET_HIT_RADIUS_SCALE
  HERO_COLOR: '#b98cff', RIVAL_COLOR: '#ff7043',
  A1: { cd: 14, duration: 2.7, cap: 8, delay: 0.35, margin: 120, R: 95 },
  A2: { cd: 18, absorb: 1.0, maxEscrow: 300, returnMult: 0.65, vuln: 3.0, range: 460 },
  PASSIVE: { perHp: 10, perRadius: 1, maxBonus: 100 },
  PICKUP_TOUCH_BONUS: 30,         // arsenalQuestConfig
};
/* ---------------- passive: growing event horizon ---------------- */
const PASS = {
  forced: null,
  realized: 0,
  bonus(){ return this.forced !== null ? this.forced : Math.min(CFG.PASSIVE.maxBonus, Math.floor(this.realized / CFG.PASSIVE.perHp)); },
};
function applyPassive(){
  const r = CFG.BASE_RADIUS + PASS.bonus();
  if (BH) BH.radius = r;
}

/* ---------------- tracer language ---------------- */
const TRACER = {                  // arsenalWeaponRuntime tracer language
  PISTOL: { trail: 0.050, width: 3.0, head: 2.6 },
  SMG:    { trail: 0.032, width: 2.2, head: 2.0 },
  HEAVY:  { trail: 0.075, width: 4.6, head: 3.6 },
  T6:     { trail: 0.110, width: 5.4, head: 4.2 },
  ALLY:   { trail: 0.060, width: 3.2, head: 2.8 },
};

/* ---------------- golden spring bank (verbatim class) ---------------- */
class Spring {
  constructor(v, w, z){ this.v = v; this.t = v; this.vel = 0; this.w = w; this.z = z; this.w0 = w; this.z0 = z; }
  step(dt){ const n = 4, h = dt / n; for (let i = 0; i < n; i++) { const a = this.w * this.w * (this.t - this.v) - 2 * this.z * this.w * this.vel; this.vel += a * h; this.v += this.vel * h; } }
  snap(v){ this.v = this.t = v; this.vel = 0; }
}
const SP = {
  tension: new Spring(0, 6, 1),
  K:       new Spring(0.025, 3.2, 1),
  rs:      new Spring(0, 4.8, 0.52),
  suck:    new Spring(0, 3.2, 1),
  stress:  new Spring(0.0, 2.6, 1),
  band:    new Spring(1, 1.6, 1),
  swirl:   new Spring(1, 1.8, 1),
  twist:   new Spring(0, 1.6, 1),
  eye:     new Spring(1, 7, 0.75),
  squint:  new Spring(0, 8, 0.85),
  spin:    new Spring(0, 2.4, 1),
  fall:    new Spring(-0.006, 1.2, 1),
};
const vulnSpring = new Spring(0, 5, 1);
const hitFlashSpring = new Spring(0, 14, 1);
const koSpring = new Spring(0, 3, 1);
const IDLE_T = { tension:0, K:0.025, rs:0, suck:0, stress:0, band:1, swirl:1, twist:0, eye:1, squint:0, spin:0, fall:-0.006 };
function setTargets(o){ for (const k in o) SP[k].t = o[k]; }

let T = 0;                 // shader time (scaled)
let timeScale = 1, timeDip = 1, dipTimer = 0, paused = false;
const PH = { band:0, swirl:0, inflow:0, fall:0, starSpin:0, acc:0, accIn:0 };

/* ---------------- head phase state machine ----------------
   Golden 'opening'/'closing' choreography is preserved exactly; battle phases
   (a1-hold, a2-absorb, a2-return) recompose the bank like Composer presets. */
let headPhase = 'intro', headTau = 0, headHidden = false;
let seatX = 0, seatY = 0.17;
let introDone = false;
function setHeadPhase(p){
  headPhase = p; headTau = 0;
  if (p === 'closing' || p === 'ko') { SP.rs.w = 9; SP.rs.z = 0.95; SP.K.w = 5.2; SP.K.z = 0.3; SP.band.w = 1.2; }
  else if (p === 'opening' || p === 'intro') { SP.rs.w = 4.8; SP.rs.z = 0.52; SP.K.w = 3.2; SP.K.z = 1; SP.band.w = 1.6; }
  else if (p === 'idle' || p === 'a1hold' || p === 'a2absorb' || p === 'a2return' || p === 'vuln') { SP.rs.w = 4.8; SP.rs.z = 0.52; SP.K.w = 2.2; SP.K.z = 1; SP.band.w = 1.6; }
}
const S = { shockT: 99, shockAmp: 0, flash: 0 };
function fireShock(a){ S.shockT = 0; S.shockAmp = a; }

function updateHeadTimeline(dt){
  headTau += dt;
  const t = headTau, ph = headPhase;
  if (ph === 'intro' || ph === 'opening') {
    const B = 1.05; // singularity birth (golden)
    setTargets({
      tension: t < B ? easeIn(t / B) * 0.6 + ease(t / B) * 0.4 : 0.3,
      squint:  t < B ? 0.5 * ease(t / 0.9) : 0.12,
      eye:     t < B ? 1 + 0.6 * ease(t / B) : 1.3,
      K:       t < 0.45 ? 0.025 : t < B ? 0.025 + 0.06 * ease((t - 0.45) / 0.6) : 0.085 + 0.19 * easeOut((t - B) / 1.8),
      rs:      t < B ? 0 : 1,
      suck:    t < B ? 0.12 * ease(t / B) : 0.12 + 0.88 * ease((t - B) / 1.5),
      stress:  t < 0.7 ? 0.1 * ease(t / 0.7) : 0.1 + 0.9 * ease((t - 0.7) / 1.8),
      band:    t < B ? 1 - 0.7 * ease(t / B) : 2.8,
      swirl:   t < B ? 1 + 3 * ease(t / B) : 7,
      twist:   t < B ? 0.8 * ease(t / B) : 1.7,
      spin:    t < 0.45 ? 0 : t < B ? 0.6 * ease((t - 0.45) / 0.6) : 1.25,
      fall:    t < B ? 0.0 : 0.22,
    });
    if (t >= B && S.shockT > 1) { fireShock(1.0); S.flash = 1.0; }
    if (ph === 'intro' && t > 2.4) setHeadPhase('closing');
    if (ph === 'opening' && t > 1.35) setHeadPhase('a1hold');
  } else if (ph === 'a1hold') {
    const hb = Math.sin(T * 1.25);
    setTargets({ tension:0.3, K:0.17 + 0.01*hb, rs:0.34 + 0.02*hb, suck:0.5, stress:0.62 + 0.12*Math.sin(T*1.25 - 0.7),
                 band:2.3, swirl:4.6, twist:1.15, eye:1.24, squint:0.13, spin:0.8, fall:0.13 });
  } else if (ph === 'a2absorb') {
    // Composer A2_ABSORB preset + escrow pressure
    const eF = escrow01();
    setTargets({ tension:0.52 + 0.2*eF, K:0.105 + 0.05*eF, rs:0.46 + 0.14*eF, suck:0.36 + 0.2*eF, stress:0.76 + 0.5*eF,
                 band:1.35 + 0.5*eF, swirl:2.35 + 1.5*eF, twist:0.52, eye:1.18 + 0.3*eF, squint:0.18, spin:0.38 + 0.3*eF, fall:0.035 });
  } else if (ph === 'a2return') {
    // Composer A2_RETURN preset
    setTargets({ tension:0.18, K:-0.085, rs:0.10, suck:0, stress:1.0, band:1.55, swirl:1.4, twist:0.18, eye:1.42, squint:0.04, spin:0.16, fall:-0.015 });
    if (t > 0.55) setHeadPhase('vuln');
  } else if (ph === 'vuln') {
    const hb = Math.sin(T * 1.25);
    setTargets({ tension:0.12, K:0.025 + 0.012*Math.sin(T*3.1), rs:0.06 + 0.05*Math.max(0,Math.sin(T*2.2)), suck:0.04, stress:0.14 + 0.08*Math.sin(T*9.3),
                 band:0.75 + 0.1*hb, swirl:0.9, twist:0, eye:0.9, squint:0.06, spin:0.05, fall:-0.006 });
  } else if (ph === 'closing') {
    const C1 = 0.7; // horizon collapse (golden)
    setTargets({
      suck: 0,
      rs:   t < C1 ? 1 - easeIn(t / C1) : 0,
      K:    t < C1 ? 0.275 * (1 - 0.3 * ease(t / C1)) : 0.0,
      tension: t < C1 ? 0.5 : 0,
      eye:  t < C1 ? 1.1 : t < C1 + 0.3 ? 1.9 : 1,
      squint: t < C1 ? 0.3 : 0,
      stress: 0, band: t < C1 ? 1.5 : 1, swirl: 1, twist: 0,
      spin: t < C1 ? 1.25 : 0, fall: -0.006,
    });
    if (t >= C1 && S.shockT > 1) { fireShock(-0.85); S.flash = 0.85; releaseAll(); }
    if (t > 3.4) setHeadPhase(introDone ? 'idle' : 'idle');
  } else if (ph === 'ko') {
    const C1 = 0.7;
    setTargets({
      suck: 0, rs: t < C1 ? 1 - easeIn(t / C1) : 0, K: t < C1 ? 0.2 * (1 - ease(t / C1)) : 0,
      tension: t < C1 ? 0.5 : 0, eye: t < C1 ? 0.6 : 0, squint: t < C1 ? 0.8 : 0.9,
      stress: 0, band: t < C1 ? 1.2 : 0.6, swirl: 0.6, twist: 0, spin: t < C1 ? 0.9 : 0, fall: -0.02,
    });
    if (t >= C1 && S.shockT > 1) { fireShock(-0.7); S.flash = 0.6; releaseAll(); }
  } else { // idle
    const hb = Math.sin(T * 0.9);
    setTargets({ ...IDLE_T, stress: 0.02 + 0.02*Math.max(0, hb), K: 0.025 + 0.004*hb });
  }
  for (const k in SP) SP[k].step(dt);
  vulnSpring.step(dt); hitFlashSpring.step(dt); koSpring.step(dt);

  const suck = Math.max(0, SP.suck.v);
  PH.band += dt * 0.045 * SP.band.v;
  PH.swirl = (PH.swirl + dt * 0.02 * SP.swirl.v) % 1;
  PH.inflow += dt * (0.05 + 0.9 * suck);
  PH.fall += dt * SP.fall.v;
  PH.starSpin += dt * (0.003 + 0.09 * suck);
  PH.acc = (PH.acc + dt * (0.18 + 0.35 * suck)) % 1;
  PH.accIn += dt * (0.25 + 0.6 * suck);
  S.shockT += dt;
  S.flash *= Math.exp(-dt * 5);

  // singularity seat drift (Composer seat mechanism): leans toward the action
  let sx = 0, sy = 0.17;
  if (headPhase === 'a1hold' || headPhase === 'opening') {
    const e = A1.entry;
    if (e){ const d = norm(e.x - BH.x, e.y - BH.y); sx = clamp(d.x, -1, 1) * 0.3; sy = 0.17 + clamp(-d.y, -1, 1) * 0.1; }
  } else if (headPhase === 'a2absorb') { sx = 0; sy = 0.2; }
  else if (BOT) { const d = norm(BOT.x - BH.x, BOT.y - BH.y); sx = d.x * 0.05; }
  seatX += (sx - seatX) * Math.min(1, dt * 5);
  seatY += (sy - seatY) * Math.min(1, dt * 5);
}

/* ---------------- blink (golden) ---------------- */
let blinkT = 99, nextBlink = rnd(3, 6), blinkQueue = 0;
function startBlink(){ blinkT = 0; }
function blinkValue(){
  const t = blinkT;
  if (t < 0.075) return 1 - Math.pow(1 - t / 0.075, 2);
  if (t < 0.115) return 1;
  if (t < 0.33) return 1 - easeOut((t - 0.115) / 0.215);
  return 0;
}
function updateBlink(dt){
  blinkT += dt;
  if (blinkQueue > 0 && blinkT > 0.45) { blinkQueue--; startBlink(); }
  const preBirth = (headPhase === 'opening' || headPhase === 'intro') && headTau < 1.6;
  nextBlink -= dt;
  if (nextBlink <= 0 && !preBirth) { startBlink(); if (Math.random() < 0.22) blinkQueue = 1; nextBlink = rnd(3.5, 8.5); }
}

/* ---------------- golden head particles (dust / motes / shards) ---------------- */
const SCX = 0, SCY = 0.17;
function eggE(x, y){ const sx = 1 + 0.30 * sstep(0.25, -0.85, y); const sy = lerp(0.73, 0.84, sstep(-0.15, 0.15, y)); return Math.hypot(x * sx, y * sy); }
const ND = 1000, NM = 340, NP = ND + NM;
const parts = [];
function spawnDust(p, fresh){
  p.kind = 0; p.mode = 0;
  p.a = rnd(0, Math.PI * 2);
  const g = growth01();
  p.rad0 = (0.6 + Math.pow(Math.random(), 0.8) * 0.46) * (1 + 0.32 * g); p.rad = p.rad0; p.vr = 0;
  p.spd = 0.055 * Math.pow(0.8 / Math.min(p.rad0, 1.4), 1.5) * rnd(0.75, 1.25);
  p.size = rnd(1.0, 2.1) * (Math.random() < 0.06 ? 1.8 : 1);
  p.b = Math.random() < 0.07 ? rnd(0.5, 1.1) : rnd(0.05, 0.28);
  p.fade = fresh ? 0 : 1; p.heat = 0; p.wob = rnd(0, 6.28);
  p.x = Math.cos(p.a) * p.rad; p.y = Math.sin(p.a) * p.rad * 0.97; p.px = p.x; p.py = p.y;
}
function spawnMote(p, fresh){
  p.kind = 1; p.mode = 0;
  do { p.x = rnd(-0.45, 0.45); p.y = rnd(-0.66, 0.6); } while (eggE(p.x, p.y) > 0.45);
  p.bvx = rnd(-1, 1) * 0.004; p.bvy = rnd(-1, 1) * 0.004; p.vx = p.bvx; p.vy = p.bvy;
  p.size = rnd(0.8, 1.6); p.b = rnd(0.05, 0.24) * (Math.random() < 0.05 ? 3 : 1);
  p.fade = fresh ? 0 : 1; p.heat = 0; p.px = p.x; p.py = p.y; p.wob = rnd(0, 6.28);
}
for (let i = 0; i < NP; i++) { const p = {}; if (i < ND) spawnDust(p, false); else spawnMote(p, false); parts.push(p); }

const NS = 16, shards = [];
function spawnShard(s, fresh){
  s.mode = 0; s.a = rnd(0, Math.PI * 2); s.rad0 = rnd(0.93, 1.12) * (1 + 0.22 * growth01()); s.rad = s.rad0; s.vr = 0;
  s.spd = 0.035 * Math.pow(1 / Math.min(s.rad0, 1.3), 1.5) * rnd(0.7, 1.3);
  s.size = Math.random() < 0.35 ? rnd(0.03, 0.05) : rnd(0.055, 0.1);
  s.seed = Math.random(); s.alpha = fresh ? 0 : 1; s.stretch = 1; s.heat = 0; s.wob = rnd(0, 6.28); s.tilt = rnd(-0.5, 0.5);
  s.x = Math.cos(s.a) * s.rad; s.y = Math.sin(s.a) * s.rad * 0.97; s.phi = s.a - Math.PI / 2; s.dead = 0;
}
for (let i = 0; i < NS; i++) { const s = {}; spawnShard(s, false); shards.push(s); }

function releaseAll(){
  for (const p of parts) {
    if (p.mode !== 1) continue;
    p.mode = 0;
    if (p.kind === 0) { p.a = Math.atan2(p.y, p.x); p.rad = Math.hypot(p.x, p.y) / 0.985; p.vr = rnd(0.5, 1.1); }
    else { const dx = p.x - SCX, dy = p.y - SCY, l = Math.hypot(dx, dy) + 1e-4; const k = rnd(0.15, 0.4); p.vx = dx / l * k; p.vy = dy / l * k; }
  }
  for (const s of shards) {
    if (s.mode !== 1) continue;
    s.mode = 0; s.a = Math.atan2(s.y, s.x); s.rad = Math.hypot(s.x, s.y); s.vr = rnd(0.4, 0.9);
  }
}

function updateParticles(dt){
  const suck = Math.max(0, SP.suck.v), rs = 0.125 * Math.max(SP.rs.v, 0);
  const bandK = 0.6 + 0.4 * SP.band.v;
  const vulnPull = clamp01(vulnSpring.v) * 0.25;   // exposed: orbits decay inward
  for (const p of parts) {
    p.px = p.x; p.py = p.y;
    if (p.mode === 0) {
      if (p.kind === 0) {
        p.a -= p.spd * dt * bandK;
        p.vr += ((p.rad0 - p.rad) * 3.0 - p.vr * 1.6) * dt;
        p.rad += p.vr * dt;
        p.rad -= vulnPull * p.rad * dt * 0.5;
        const w = 1 + 0.01 * Math.sin(T * 0.7 + p.wob);
        p.x = Math.cos(p.a) * p.rad * w; p.y = Math.sin(p.a) * p.rad * 0.97 * w;
      } else {
        p.vx += (p.bvx - p.vx) * Math.min(1, dt * 1.2); p.vy += (p.bvy - p.vy) * Math.min(1, dt * 1.2);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (eggE(p.x, p.y) > 0.47) { p.x -= p.vx * dt * 2; p.y -= p.vy * dt * 2; p.vx *= -0.6; p.vy *= -0.6; p.bvx *= -1; p.bvy *= -1; }
      }
      p.fade = Math.min(1, p.fade + dt * 0.6);
      if (suck > 0.04) {
        const dx = p.x - SCX, dy = p.y - SCY, d = Math.hypot(dx, dy);
        const rate = suck * (p.kind === 1 ? 0.55 : 0.16) * (0.4 + 1.2 * Math.exp(-d * 1.5));
        if (Math.random() < rate * dt) { p.mode = 1; p.rho = d; p.al = Math.atan2(dy, dx); }
      }
    } else {
      const rho = Math.max(p.rho, 0.02);
      const om = Math.min(0.34 * Math.pow(rho, -1.5), 14);
      p.al -= om * dt * (0.35 + 0.65 * Math.min(1, suck * 1.5));
      p.rho -= (0.07 + 0.022 / rho) * Math.max(suck, 0.05) * dt;
      p.x = SCX + Math.cos(p.al) * p.rho; p.y = SCY + Math.sin(p.al) * p.rho;
      p.heat = clamp01((0.32 - p.rho) / 0.22);
      if (p.rho < rs * 1.04 + 0.004) { if (p.kind === 0) spawnDust(p, true); else spawnMote(p, true); }
    }
  }
  for (const s of shards) {
    if (s.mode === 2) { s.dead -= dt; if (s.dead <= 0) spawnShard(s, true); continue; }
    if (s.mode === 0) {
      s.a -= s.spd * dt * (0.5 + 0.5 * SP.band.v);
      s.vr += ((s.rad0 - s.rad) * 2.5 - s.vr * 1.4) * dt; s.rad += s.vr * dt;
      const bob = 1 + 0.012 * Math.sin(T * 0.5 + s.wob);
      s.x = Math.cos(s.a) * s.rad * bob; s.y = Math.sin(s.a) * s.rad * 0.97 * bob;
      s.phi = s.a - Math.PI / 2 + s.tilt + 0.25 * Math.sin(T * 0.3 + s.wob);
      s.alpha = Math.min(1, s.alpha + dt * 0.5) * (1 - 0.4 * clamp01(vulnSpring.v)); s.stretch += (1 - s.stretch) * Math.min(1, dt * 3); s.heat *= Math.exp(-dt * 2);
      if (suck > 0.3 && Math.random() < 0.12 * suck * dt) {
        s.mode = 1; const dx = s.x - SCX, dy = s.y - SCY; s.rho = Math.hypot(dx, dy); s.rho0 = s.rho; s.al = Math.atan2(dy, dx); s.phi0 = s.phi;
      }
    } else {
      const rho = Math.max(s.rho, 0.02);
      const om = Math.min(0.3 * Math.pow(rho, -1.5), 10);
      s.al -= om * dt * (0.35 + 0.65 * Math.min(1, suck * 1.5));
      s.rho -= (0.05 + 0.016 / rho) * Math.max(suck, 0.05) * dt;
      s.x = SCX + Math.cos(s.al) * s.rho; s.y = SCY + Math.sin(s.al) * s.rho;
      const prog = ease(1 - s.rho / s.rho0);
      const tx = Math.cos(s.phi0), ty = Math.sin(s.phi0), rx = Math.cos(s.al), ry = Math.sin(s.al);
      s.phi = Math.atan2(lerp(ty, ry, prog), lerp(tx, rx, prog));
      s.stretch = 1 + 3.0 * prog * prog;
      s.heat = sstep(0.38, 0.12, s.rho);
      s.alpha = rs > 0.001 ? sstep(rs * 1.0, rs * 2.2, s.rho) : 1;
      if (s.rho < rs * 1.05 + 0.004) { s.mode = 2; s.dead = rnd(1.5, 4); s.alpha = 0; }
    }
  }
}

const ptData = new Float32Array(NP * 5), lnData = new Float32Array(NP * 10);
function mkVAO(data){
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
  gl.bindVertexArray(null); return { vao, buf };
}
const vPt = mkVAO(ptData), vLn = mkVAO(lnData);
let lnCount = 0, frameDt = 1/60;
function fillParticleBuffers(dt, pxScale){
  let li = 0;
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    const br = p.b * p.fade * (1 + p.heat * 2.5) * (p.mode === 1 ? 1.3 : 1) * (p.kind === 1 ? (0.75 + 0.25 * Math.sin(T * 1.3 + p.wob)) : 1);
    const o = i * 5;
    ptData[o] = p.x; ptData[o + 1] = p.y; ptData[o + 2] = p.size * (1 + p.heat * 0.6) * pxScale; ptData[o + 3] = br; ptData[o + 4] = p.heat;
    if (dt > 0) {
      let vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
      let tx = vx * 0.07, ty = vy * 0.07; const l = Math.hypot(tx, ty);
      if (l > 0.15) { tx *= 0.15 / l; ty *= 0.15 / l; }
      if (l > 0.003 && l < 1) {
        const q = li * 10;
        lnData[q] = p.x; lnData[q + 1] = p.y; lnData[q + 2] = 0; lnData[q + 3] = br * 0.9; lnData[q + 4] = p.heat;
        lnData[q + 5] = p.x - tx; lnData[q + 6] = p.y - ty; lnData[q + 7] = 0; lnData[q + 8] = 0; lnData[q + 9] = p.heat;
        li++;
      }
    }
  }
  lnCount = li * 2;
  gl.bindBuffer(gl.ARRAY_BUFFER, vPt.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ptData);
  gl.bindBuffer(gl.ARRAY_BUFFER, vLn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, lnData, 0, li * 10);
}
const shA = new Float32Array(NS * 4), shB = new Float32Array(NS * 4);
function fillShards(){
  for (let i = 0; i < NS; i++) {
    const s = shards[i], o = i * 4;
    const sz = s.mode === 1 ? s.size * (0.6 + 0.4 * s.rho / s.rho0) : s.size;
    shA[o] = s.x; shA[o + 1] = s.y; shA[o + 2] = s.phi - Math.PI / 2; shA[o + 3] = sz;
    shB[o] = s.stretch; shB[o + 1] = s.mode === 2 ? 0 : s.alpha; shB[o + 2] = s.seed; shB[o + 3] = s.heat;
  }
}
function drawHeadParticles(){
  if (!BH) return;
  fillParticleBuffers(frameDt, headScale() / 420);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  const P = P_PART; gl.useProgram(P.p);
  const sway = headSway(), swayR = headSwayR(), breath = headBreath();
  const [gx, gy] = w2gl(BH.x, BH.y);
  u2(P, 'uRes', W, H); u2(P, 'uCenter', gx, gy); u2(P, 'uSway', sway[0], sway[1]);
  u1(P, 'uScale', headScale()); u1(P, 'uSwayR', swayR); u1(P, 'uBreath', breath);
  u1(P, 'uPoint', 0); gl.bindVertexArray(vLn.vao); if (lnCount) gl.drawArrays(gl.LINES, 0, lnCount);
  u1(P, 'uPoint', 1); gl.bindVertexArray(vPt.vao); gl.drawArrays(gl.POINTS, 0, NP);
  gl.disable(gl.BLEND);
}

/* ---------------- head presentation helpers ---------------- */
function headScale(){ return (BH ? BH.radius : CFG.BASE_RADIUS) * 1.72; }
function headSway(){
  const vx = BH ? BH.vx : 0, vy = BH ? BH.vy : 0;
  const leanX = clamp(vx / CFG.FIGHTER_SPEED, -1, 1) * 0.014;
  const leanY = clamp(-vy / CFG.FIGHTER_SPEED, -1, 1) * 0.011;
  return [Math.sin(T * 0.21) * 0.006 + Math.sin(T * 0.13 + 2) * 0.004 + leanX,
          Math.sin(T * 0.17 + 1) * 0.007 + Math.sin(T * 0.29) * 0.003 + leanY];
}
function headSwayR(){
  const vx = BH ? BH.vx : 0;
  return Math.sin(T * 0.11) * 0.014 - clamp(vx / CFG.FIGHTER_SPEED, -1, 1) * 0.02;
}
function headBreath(){
  const jolt = S.shockT < 3 ? Math.exp(-S.shockT * 4) * Math.sin(S.shockT * 18) * 0.012 * Math.sign(S.shockAmp || 1) : 0;
  return 1 + 0.006 * Math.sin(T * 0.5) - 0.014 * Math.max(0, SP.tension.v) + jolt;
}
function headFlare(){
  return (blinkT > 0.3 && blinkT < 1.2 ? Math.exp(-(blinkT - 0.3) * 6) * 0.1 : 0) + S.flash * 0.25;
}
function headStress(){
  return Math.max(0, SP.stress.v) + 0.04 + clamp01(vulnSpring.v) * 0.22 * (0.65 + 0.35 * Math.sin(T * 9.3));
}
function growth01(){ return PASS.bonus() / CFG.PASSIVE.maxBonus; }
function escrow01(){ return A2.phase === 'absorb' ? clamp01(A2.escrow / CFG.A2.maxEscrow) : (A2.phase === 'return' && A2.t < 0.3 ? clamp01(A2.escrow / CFG.A2.maxEscrow) : 0); }

/* ============================================================================
   WORLD SINGULARITIES — golden singularity grammar at world scale.
   Each carries its own spring set (rs / K / suck / spin / tension), phase
   clocks (accretion), shock + flash, and a timeline.
   ============================================================================ */
class WSing {
  constructor(kind, x, y, R){
    this.kind = kind; this.x = x; this.y = y; this.R = R;
    this.age = 0; this.tau = 0; this.phase = 'wound'; this.dead = false;
    this.rs = new Spring(0, kind === 'exit' ? 6.2 : 4.8, kind === 'exit' ? 0.6 : 0.52);
    this.K = new Spring(kind === 'a2' ? 0.09 : 0.03, kind === 'crush' ? 7 : 3.2, 1);
    this.suck = new Spring(0, 3.2, 1);
    this.spin = new Spring(0, 2.4, 1);
    this.tension = new Spring(0, 6, 1);
    this.accP = Math.random(); this.accIn = Math.random() * 10;
    this.shockT = 99; this.shockA = 0; this.flash = 0;
    this.hot = kind === 'exit' ? 0.8 : (kind === 'crush' ? 1.3 : 1.0);
    this.followBH = (kind === 'a2');
    this.holdUntil = 0;
  }
  shock(a){ this.shockT = 0; this.shockA = a; if (Math.abs(a) > 0.85) this.flash = Math.max(this.flash, Math.abs(a) * 0.95); }
  slotScale(){ return this.R / 0.125; }
  update(dt){
    this.age += dt; this.tau += dt;
    const t = this.tau;
    if (this.kind === 'entry'){
      if (this.phase === 'wound'){
        this.tension.t = 0.7; this.K.t = 0.055; this.suck.t = 0.1; this.rs.t = 0; this.spin.t = 0;
        if (t > 0.45) this.phase = 'birth';
      } else if (this.phase === 'birth'){
        const u = ease((t - 0.45) / 0.6);
        this.tension.t = 0.5;
        this.K.t = 0.025 + 0.24 * u;
        this.rs.t = 1;
        this.suck.t = 0.12 + 0.55 * u;
        this.spin.t = 0.7 * u;
        if (t >= 1.05){ this.phase = 'sustain'; this.shock(0.95); this.flash = 0.9; spawnSingBurst(this, 1); cam.punch = Math.max(cam.punch, 0.05); }
      } else if (this.phase === 'sustain'){
        const hb = Math.sin(T * 1.25);
        const full = A1.storedCount() >= CFG.A1.cap;
        this.suck.t = full ? 0.5 : 1 + 0.04 * hb;
        this.spin.t = 1.25; this.K.t = 0.265 + 0.012 * hb; this.tension.t = 0.3;
        if (this.age > 1.05 + CFG.A1.duration) this.beginCollapse();
      } else if (this.phase === 'collapse'){
        const C1 = 0.7;
        this.suck.t = 0;
        this.rs.t = t < C1 ? 1 - easeIn(t / C1) : 0;
        this.K.t = t < C1 ? 0.265 * (1 - 0.3 * ease(t / C1)) : 0;
        this.tension.t = t < C1 ? 0.5 : 0;
        this.spin.t = t < C1 ? 1.25 : 0;
        if (t >= C1 && this.shockT > 1){ this.shock(-0.85); this.flash = 0.72; spawnSingBurst(this, -1); }
        if (t > 1.0) this.dead = true;
      }
    } else if (this.kind === 'exit'){
      if (this.phase === 'wound'){
        this.tension.t = 0.85; this.K.t = 0.04; this.suck.t = 0.04; this.rs.t = 0;
        if (t > 0.2) this.phase = 'birth';
      } else if (this.phase === 'birth'){
        this.rs.t = 1; this.K.t = 0.12; this.suck.t = 0.15; this.spin.t = 0.9; this.tension.t = 0.4;
        if (t >= 0.6){ this.phase = 'sustain'; this.shock(0.5); this.flash = 0.55; }
      } else if (this.phase === 'sustain'){
        const pend = A1.pendingCount();
        this.suck.t = 0.15; this.spin.t = 0.9 + 0.15 * Math.min(3, pend); this.K.t = 0.12; this.tension.t = 0.25;
        this.hot = 0.62 + 0.12 * Math.min(4, pend);
        if (this.age > 1.05 + CFG.A1.duration && pend === 0) this.beginCollapse();
        if (this.age > 5.2) this.beginCollapse();   // hard cap: never strand matter
      } else if (this.phase === 'collapse'){
        const C1 = 0.55;
        this.suck.t = 0;
        this.rs.t = t < C1 ? 1 - easeIn(t / C1) : 0;
        this.K.t = t < C1 ? 0.12 * (1 - ease(t / C1)) : -0.06;
        this.tension.t = t < C1 ? 0.4 : 0;
        this.spin.t = t < C1 ? 0.9 : 0;
        if (t >= C1 && this.shockT > 1){ this.shock(-0.7); this.flash = 0.6; spawnSingBurst(this, -1); }
        if (t > 0.9) this.dead = true;
      }
    } else if (this.kind === 'a2'){
      const eF = escrow01();
      this.K.t = 0.105 + 0.06 * eF; this.suck.t = 0.36 + 0.2 * eF; this.spin.t = 0.38 + 0.3 * eF; this.tension.t = 0.52 + 0.3 * eF;
      this.rs.t = 0;
      if (A2.phase !== 'absorb'){ this.K.t = 0; this.suck.t = 0; this.tension.t = 0; this.spin.t = 0; }
      if (this.age > 1.35) this.dead = true;
    } else if (this.kind === 'crush'){
      if (this.phase === 'wound'){
        this.tension.t = 1.0; this.K.t = 0.05; this.rs.t = 0;
        if (t > 0.08) this.phase = 'crush';
      } else if (this.phase === 'crush'){
        this.rs.t = 0.62; this.K.t = 0.32; this.spin.t = 0.5; this.suck.t = 0.25; this.tension.t = 0.6;
        if (!this.fired && t >= 0.22){ this.fired = true; A2.fireReturn(); }
        if (t >= 0.26) this.phase = 'collapse';
      } else if (this.phase === 'collapse'){
        const C1 = 0.3;
        this.rs.t = t < C1 ? 0.62 * (1 - easeIn(t / C1)) : 0;
        this.K.t = t < C1 ? 0.3 * (1 - ease(t / C1)) : -0.11;
        this.suck.t = 0; this.spin.t = 0.25; this.tension.t = 0;
        if (t >= C1 && this.shockT > 1){ this.shock(1.3); this.flash = 1.1; spawnSingBurst(this, -1); cam.punch = Math.max(cam.punch, 0.1); cam.shake = Math.max(cam.shake, 9); }
        if (t > 0.8) this.dead = true;
      }
    }
    if (this.followBH && BH){ this.x = BH.x; this.y = BH.y; }
    this.rs.step(dt); this.K.step(dt); this.suck.step(dt); this.spin.step(dt); this.tension.step(dt);
    const suck = Math.max(0, this.suck.v);
    this.accP = (this.accP + dt * (0.18 + 0.35 * suck)) % 1;
    this.accIn += dt * (0.25 + 0.6 * suck);
    this.shockT += dt;
    this.flash *= Math.exp(-dt * 5);
    // ambient infall: matter curling into any live horizon (golden capture law)
    if (suck > 0.45 && this.kind !== 'a2' && Math.random() < suck * 26 * dt){
      spawnInfall(this, rnd(0.3, 0.46));
    }
  }
  beginCollapse(){ if (this.phase !== 'collapse'){ this.phase = 'collapse'; this.tau = 0; this.rs.w = this.kind === 'crush' ? 11 : 9; this.rs.z = 0.95; this.K.w = 5.2; this.K.z = 0.3; } }
  pack(i){
    packSing(i, this.x, this.y, this.slotScale(), 0.125 * Math.max(0, this.rs.v), this.K.v, Math.max(0, this.spin.v),
             Math.max(0, this.suck.v), this.shockT, this.shockA, this.flash, this.accP, this.accIn, Math.max(0, this.tension.v), this.hot);
  }
}
const sings = [];

/* ============================================================================
   BATTLE STATE — production Apex laws: 1000×1000 arena, radius 75, speed 520,
   wall bounce, fighter collision reflection, swept-segment bullets with
   BULLET_HIT_RADIUS_SCALE 0.78.
   ============================================================================ */
let BH = null, BOT = null;
const projectiles = [];
const pickups = [];
const rings = [];
const texts = [];
const world = [];      // world VFX particles
let matchClock = 0, over = false, overT = 0, scoreW = 0, scoreL = 0, graceT = 2.0;

function makeFighter(name, x, y, isBH){
  return {
    name, isBH, x, y, vx: 0, vy: 0, dir: norm(isBH ? 1 : -1, isBH ? 0.35 : -0.35),
    radius: CFG.BASE_RADIUS, baseRadius: CFG.BASE_RADIUS,
    hp: CFG.MATCH_HP, maxHp: CFG.MATCH_HP,
    speed: CFG.FIGHTER_SPEED, realized: 0, healCd: 0, flashT: 0,
    // bot fields
    strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1.2, 2.4), fireT: rnd(1.4, 2.2), heavyT: rnd(4.5, 6.5),
  };
}


/* ---------------- damage pipeline (A2 escrow + vulnerability + passive) ---------------- */
function dealDamage(target, amount, source, opts = {}){
  if (!target || target.hp <= 0 || over) return 0;
  let amt = amount, folded = 0, doubled = false;
  if (target.isBH){
    if (A2.phase === 'absorb' && opts.tier !== 'T6'){
      const room = CFG.A2.maxEscrow - A2.escrow;
      if (room > 0){
        folded = Math.min(room, amt);
        A2.escrow += folded;
        amt -= folded;
        if (opts.impact) spawnFold(opts.impact, folded);
      }
    }
    if (amt > 0.01){
      if (A2.vulnT > 0){ amt *= 2; doubled = true; }
      const before = target.hp;
      target.hp = Math.max(0, target.hp - amt);
      const realized = before - target.hp;
      PASS.realized += realized;              // escrowed damage never lands here
      hitFlashSpring.t = Math.min(1, hitFlashSpring.t + amt / 46);
      SP.squint.t = Math.min(0.85, SP.squint.t + amt / 90); SP.squint.w = 8;
      SP.stress.t = Math.min(1.2, SP.stress.t + amt / 130);
      cam.shake = Math.max(cam.shake, Math.min(9, amt * 0.1));
      if (opts.impact) spawnBurst(opts.impact.x, opts.impact.y, Math.min(16, 4 + amt*0.15), 260, [0.72,0.45,1], 3);
      spawnText(target.x + rnd(-24,24), target.y - target.radius - 24, `-${realized.toFixed(0)}${doubled ? ' ×2' : ''}`, doubled ? '#ffb0f0' : '#ffc9b0', realized >= 40 ? 20 : 15);
    }
  } else {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amt);
    target.flashT = 0.12;
    spawnText(target.x + rnd(-24,24), target.y - target.radius - 24, `-${(before - target.hp).toFixed(0)}`, '#e8d9ff', amt >= 40 ? 20 : 15);
    if (opts.impact) spawnBurst(opts.impact.x, opts.impact.y, Math.min(16, 4 + amt*0.12), 260, [1, 0.5, 0.3], 3);
    if (amt >= 40) cam.shake = Math.max(cam.shake, 6);
  }
  if (target.hp <= 0) triggerKO(target);
  return amt;
}

/* ---------------- A1: SINGULARITY TRANSIT ---------------- */
const A1 = {
  cd: 0, active: false, entry: null, exit: null, store: [],
  storedCount(){ return this.store.length; },
  pendingCount(){ return this.store.length; },
  cast(){
    if (this.cd > 0 || this.active || over) return false;
    const d = norm(BOT.x - BH.x, BOT.y - BH.y);
    const ex = clamp(BH.x + d.x * 185, 130, 870), ey = clamp(BH.y + d.y * 185, 130, 870);
    this.entry = new WSing('entry', ex, ey, CFG.A1.R);
    // exit: beyond the enemy along BH→enemy, ≥ radius+120 from any fighter
    const px = this.placeExit();
    this.exit = new WSing('exit', px[0], px[1], CFG.A1.R);
    sings.push(this.entry, this.exit);
    this.active = true; this.cd = CFG.A1.cd; this.store.length = 0;
    setHeadPhase('opening');
    spawnText(BH.x, BH.y - BH.radius - 60, 'SINGULARITY TRANSIT', '#d9c6ff', 15);
    return true;
  },
  placeExit(){
    const base = Math.atan2(BOT.y - BH.y, BOT.x - BH.x);
    const need = BOT.radius + CFG.A1.margin;      // safe margin from a fighter
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, Math.PI]){
      const a = base + off;
      const x = clamp(BOT.x + Math.cos(a) * (need + CFG.A1.R * 0.6), CFG.A1.R + 45, GAME_SIZE - CFG.A1.R - 45);
      const y = clamp(BOT.y + Math.sin(a) * (need + CFG.A1.R * 0.6), CFG.A1.R + 45, GAME_SIZE - CFG.A1.R - 45);
      if (dist(x, y, BOT.x, BOT.y) >= need && dist(x, y, BH.x, BH.y) >= BH.radius + CFG.A1.margin) return [x, y];
    }
    return [clamp(BOT.x + Math.cos(base) * (need + 100), 140, 860), clamp(BOT.y + Math.sin(base) * (need + 100), 140, 860)];
  },
  capture(b){
    if (this.store.length >= CFG.A1.cap) return false;
    this.store.push({ vx: b.vx, vy: b.vy, owner: b.owner, damage: b.damage, radius: b.radius, tier: b.tier, weapon: b.weapon, color: b.color, t6: b.t6, t: CFG.A1.delay });
    spawnCaptureVfx(this.entry, b);
    return true;
  },
  update(dt){
    this.cd = Math.max(0, this.cd - dt);
    if (!this.active) return;
    for (let i = this.store.length - 1; i >= 0; i--){
      const s = this.store[i];
      s.t -= dt;
      if (s.t <= 0 && this.exit && !this.exit.dead && this.exit.phase !== 'collapse'){
        // release with preserved momentum, velocity vector, ownership
        const ex = this.exit.x + norm(s.vx, s.vy).x * (this.exit.R * 0.35);
        const ey = this.exit.y + norm(s.vx, s.vy).y * (this.exit.R * 0.35);
        projectiles.push({ x: ex, y: ey, px: ex, py: ey, vx: s.vx, vy: s.vy, radius: s.radius, damage: s.damage,
                           life: 1.4, maxLife: 1.4, color: s.color, tier: s.tier, owner: s.owner, weapon: s.weapon,
                           heavy: s.weapon === 'HEAVY', t6: s.t6, released: true, relV: Math.hypot(s.vx, s.vy) });
        spawnReleaseVfx(this.exit, s);
        this.store.splice(i, 1);
      } else if (s.t <= 0 && (!this.exit || this.exit.dead)){
        // exit gone: energy dissipates (rare hard-cap edge)
        this.store.splice(i, 1);
      }
    }
    if (this.entry.dead && (!this.exit || this.exit.dead)){
      this.active = false;
      if (headPhase === 'a1hold' || headPhase === 'opening') setHeadPhase('closing');
    }
  },
};

/* ---------------- A2: DAMAGE SINGULARITY ---------------- */
const A2 = {
  cd: 0, phase: 'idle', t: 0, escrow: 0, vulnT: 0, field: null, crush: null, returned: 0,
  cast(){
    if (this.cd > 0 || this.phase !== 'idle' || over) return false;
    this.phase = 'absorb'; this.t = 0; this.escrow = 0;
    this.field = new WSing('a2', BH.x, BH.y, 130);
    sings.push(this.field);
    this.cd = CFG.A2.cd;
    setHeadPhase('a2absorb');
    spawnText(BH.x, BH.y - BH.radius - 60, 'DAMAGE SINGULARITY', '#d9c6ff', 15);
    return true;
  },
  fireReturn(){
    // ONE concentrated spatial damage event (called at crush peak)
    const dmg = this.escrow * CFG.A2.returnMult;
    const inRange = BOT && BOT.hp > 0 && dist(BH.x, BH.y, BOT.x, BOT.y) <= CFG.A2.range;
    if (inRange && dmg > 0){
      dealDamage(BOT, dmg, BH, { kind: 'crush', impact: { x: BOT.x, y: BOT.y } });
      spawnText(BOT.x, BOT.y - BOT.radius - 66, `SINGULARITY RETURN ${dmg.toFixed(0)}`, '#f0e4ff', 20);
    } else if (dmg > 0){
      spawnText(BH.x, BH.y - BH.radius - 66, 'RETURN LOST TO DISTANCE', '#b9a8d8', 13);
    }
    // recoil: matter flung outward from BLACK_HOLE
    for (let i = 0; i < 26; i++){
      const a = rnd(0, Math.PI * 2), sp = rnd(180, 560);
      spawnW('free', BH.x + Math.cos(a) * BH.radius * 0.7, BH.y + Math.sin(a) * BH.radius * 0.7, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.3, 0.7), size: rnd(2, 4.5), col: [0.72, 0.4, 1], heat: 0.8 });
    }
    rings.push({ x: BH.x, y: BH.y, r: BH.radius * 0.6, vr: 900, alpha: 0.8, col: [0.8, 0.55, 1], width: 5 });
    this.returned = dmg;
  },
  update(dt){
    this.cd = Math.max(0, this.cd - dt);
    if (this.phase === 'absorb'){
      this.t += dt;
      if (this.t >= CFG.A2.absorb){
        this.phase = 'return'; this.t = 0;
        dipTimer = 0.12; timeDip = 0.12;             // silence before the event
        const inRange = dist(BH.x, BH.y, BOT.x, BOT.y) <= CFG.A2.range;
        const tx = inRange ? BOT.x : BH.x + norm(BOT.x - BH.x, BOT.y - BH.y).x * 240;
        const ty = inRange ? BOT.y : BH.y + norm(BOT.x - BH.x, BOT.y - BH.y).y * 240;
        this.crush = new WSing('crush', tx, ty, 110);
        sings.push(this.crush);
        setHeadPhase('a2return');
      }
    } else if (this.phase === 'return'){
      this.t += dt;
      if (this.crush && this.crush.dead){ this.phase = 'vuln'; this.vulnT = CFG.A2.vuln; vulnSpring.t = 1; }
      if (this.t > 1.4){ this.phase = 'vuln'; this.vulnT = CFG.A2.vuln; vulnSpring.t = 1; }
    } else if (this.phase === 'vuln'){
      this.vulnT -= dt;
      if (this.vulnT <= 0){ this.phase = 'idle'; this.escrow = 0; vulnSpring.t = 0; }
    }
  },
};

/* ---------------- projectiles (production aq_bullet laws) ---------------- */
const GUNS = {
  PISTOL: { speed: 2600, radius: 7, dmg: 12, life: 1.0, tracer: TRACER.PISTOL, col: [1.0, 0.44, 0.26] },
  SMG:    { speed: 3100, radius: 6, dmg: 8,  life: 0.9, tracer: TRACER.SMG,    col: [1.0, 0.5, 0.3] },
  HEAVY:  { speed: 1250, radius: 11, dmg: 60, life: 1.6, tracer: TRACER.HEAVY, col: [1.0, 0.62, 0.3], heavy: true },
  T6:     { speed: 640,  radius: 13, dmg: 220, life: 3.0, tracer: TRACER.T6,   col: [1.0, 0.85, 0.42], tier: 'T6' },
  ALLY:   { speed: 2400, radius: 7,  dmg: 18, life: 1.2, tracer: TRACER.ALLY,  col: [0.72, 0.5, 1.0] },
};
function fireBullet(owner, x, y, angle, gunId, dmgOverride){
  const g = GUNS[gunId];
  projectiles.push({
    x, y, px: x, py: y,
    vx: Math.cos(angle) * g.speed, vy: Math.sin(angle) * g.speed,
    radius: g.radius, damage: dmgOverride !== undefined ? dmgOverride : g.dmg,
    life: g.life, maxLife: g.life, color: g.col, tier: g.tier || 'T' + (gunId === 'T6' ? 6 : 1),
    owner, weapon: gunId, heavy: !!g.heavy, t6: gunId === 'T6',
  });
  // muzzle spark (tracer language: bright head + short flash lines)
  bScene.wpt(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 5, 0.9, 0.6, g.col[0], g.col[1], g.col[2]);
}
/* player basic attack: ALLY rounds, auto-aim at the rival (L / SPACE) */
let allyCd = 0;
function allyFire(){
  if (allyCd > 0 || over || !BOT || BOT.hp <= 0) return false;
  allyCd = 0.24;
  const a = Math.atan2(BOT.y - BH.y, BOT.x - BH.x) + rnd(-0.035, 0.035);
  fireBullet(BH, BH.x + Math.cos(a) * (BH.radius + 12), BH.y + Math.sin(a) * (BH.radius + 12), a, 'ALLY');
  return true;
}

function updateProjectiles(dt){
  for (let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    p.px = p.x; p.py = p.y;
    // A1 gravitational influence BEFORE the horizon: eligible rounds feel the
    // pull and visibly fall; protected T6 rounds fly straight through.
    if (A1.active && A1.entry && !p.t6 && A1.entry.suck.v > 0.4 && A1.storedCount() < CFG.A1.cap){
      const e = A1.entry;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.max(24, Math.hypot(dx, dy));
      const reach = e.R * 2.6;
      if (d < reach){
        const a = clamp(5.5e7 / (d * d), 400, 20000) * dt;
        const nx = dx / d, ny = dy / d;
        p.vx += (nx * a + (-ny) * a * 0.5);
        p.vy += (ny * a + (nx) * a * 0.5);
        if (d < e.R * 0.98){
          if (A1.capture(p)){ projectiles.splice(i, 1); continue; }
        }
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || p.x < -20 || p.x > GAME_SIZE + 20 || p.y < -20 || p.y > GAME_SIZE + 20){ projectiles.splice(i, 1); continue; }
    for (const f of [BH, BOT]){
      if (!f || f === p.owner || f.hp <= 0) continue;
      const hitR = f.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius;
      if (distPointToSegment(f.x, f.y, p.px, p.py, p.x, p.y) < hitR){
        const hit = sweptHit(p.px, p.py, p.x, p.y, f.x, f.y, hitR) || { x: p.x, y: p.y };
        dealDamage(f, p.damage, p.owner, { tier: p.tier, kind: 'bullet', impact: hit });
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}
function distPointToSegment(px, py, x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
function sweptHit(x1, y1, x2, y2, cx, cy, r){
  const dx = x2 - x1, dy = y2 - y1;
  const fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const t = (-b - disc) / (2 * a);
  if (t >= 0 && t <= 1) return { x: x1 + dx * t, y: y1 + dy * t };
  const t2 = (-b + disc) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return { x: x1 + dx * t2, y: y1 + dy * t2 };
  return c < 0 ? { x: x1, y: y1 } : null;
}

/* ---------------- fighters (production movement/collision laws) ---------------- */
const keys = {};
let autoMove = false;
function updateBH(dt){
  const f = BH;
  if (f.hp <= 0) return;
  let ix = 0, iy = 0;
  if (keys['w'] || keys['arrowup']) iy -= 1;
  if (keys['s'] || keys['arrowdown']) iy += 1;
  if (keys['a'] || keys['arrowleft']) ix -= 1;
  if (keys['d'] || keys['arrowright']) ix += 1;
  if (autoMove || over){ // classic Apex auto-battle law
    f.x += f.dir.x * f.speed * dt; f.y += f.dir.y * f.speed * dt;
    f.vx = f.dir.x * f.speed; f.vy = f.dir.y * f.speed;
  } else if (ix || iy){
    const n = norm(ix, iy);
    f.x += n.x * f.speed * dt; f.y += n.y * f.speed * dt;
    f.vx = n.x * f.speed; f.vy = n.y * f.speed;
    f.dir = n;
  } else { f.vx = 0; f.vy = 0; }
  resolveWalls(f);
}
function updateBOT(dt){
  const f = BOT;
  if (f.hp <= 0) return;
  f.strafeT -= dt;
  if (f.strafeT <= 0){ f.strafe *= -1; f.strafeT = rnd(1.2, 2.6); }
  const d = norm(BH.x - f.x, BH.y - f.y);
  const dd = dist(f.x, f.y, BH.x, BH.y);
  let mx = 0, my = 0;
  if (dd > 560){ mx = d.x; my = d.y; }
  else if (dd < 300){ mx = -d.x; my = -d.y; }
  mx += -d.y * f.strafe * 0.8; my += d.x * f.strafe * 0.8;
  // wall avoidance
  if (f.x < 150) mx += 0.6; if (f.x > GAME_SIZE - 150) mx -= 0.6;
  if (f.y < 150) my += 0.6; if (f.y > GAME_SIZE - 150) my -= 0.6;
  const n = norm(mx, my);
  f.dir = n;
  f.x += n.x * f.speed * dt; f.y += n.y * f.speed * dt;
  f.vx = n.x * f.speed; f.vy = n.y * f.speed;
  resolveWalls(f);
  if (over || graceT > 0) return;
  // pistol bursts
  f.fireT -= dt;
  if (f.fireT <= 0 && BH.hp > 0 && botFireEnabled){
    f.fireT = rnd(1.7, 2.4);
    f.burst = 3; f.burstT = 0;
  }
  if (f.burst > 0){
    f.burstT -= dt;
    if (f.burstT <= 0){
      f.burstT = 0.22; f.burst--;
      const lead = norm(BH.vx || 0, BH.vy || 0);
      const tx = BH.x + lead.x * 90, ty = BH.y + lead.y * 90;
      const a = Math.atan2(ty - f.y, tx - f.x) + rnd(-0.06, 0.06);
      fireBullet(f, f.x + Math.cos(a) * (f.radius + 10), f.y + Math.sin(a) * (f.radius + 10), a, 'PISTOL');
    }
  }
  // heavy shot
  f.heavyT -= dt;
  if (f.heavyT <= 0 && BH.hp > 0 && botFireEnabled){
    f.heavyT = rnd(6, 7.5);
    const lead = norm(BH.vx || 0, BH.vy || 0);
    const tx = BH.x + lead.x * 220, ty = BH.y + lead.y * 220;
    const a = Math.atan2(ty - f.y, tx - f.x) + rnd(-0.03, 0.03);
    fireBullet(f, f.x + Math.cos(a) * (f.radius + 12), f.y + Math.sin(a) * (f.radius + 12), a, 'HEAVY');
  }
}
function resolveWalls(f){
  // production resolveWalls: clamp + flip direction component
  let side = false;
  if (f.x - f.radius < 0){ f.x = f.radius; f.dir.x = Math.abs(f.dir.x); side = true; }
  if (f.x + f.radius > GAME_SIZE){ f.x = GAME_SIZE - f.radius; f.dir.x = -Math.abs(f.dir.x); side = true; }
  if (f.y - f.radius < 0){ f.y = f.radius; f.dir.y = Math.abs(f.dir.y); side = true; }
  if (f.y + f.radius > GAME_SIZE){ f.y = GAME_SIZE - f.radius; f.dir.y = -Math.abs(f.dir.y); side = true; }
  if (side) f.dir = norm(f.dir.x, f.dir.y);
}
function handleFighterCollision(){
  // production handleCollisions (no pierce special-cases): separate + reflect
  const a = BH, b = BOT;
  if (!a || !b || a.hp <= 0 || b.hp <= 0) return;
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const minD = a.radius + b.radius;
  if (d < minD){
    const nx = dx / d, ny = dy / d;
    const overlap = minD - d;
    a.x -= nx * overlap * .5; a.y -= ny * overlap * .5;
    b.x += nx * overlap * .5; b.y += ny * overlap * .5;
    const ra = reflect(a.dir, -nx, -ny), rb = reflect(b.dir, nx, ny);
    a.dir = ra; b.dir = rb;
    // body contact chip (production onCollide scale)
    if (over) return;
    dealDamage(a, 2.5, b, { kind: 'contact', impact: { x: a.x + nx * a.radius, y: a.y + ny * a.radius } });
    dealDamage(b, 2.5, a, { kind: 'contact', impact: { x: b.x - nx * b.radius, y: b.y - ny * b.radius } });
  }
}
function reflect(dir, nx, ny){
  const d = dir.x * nx + dir.y * ny;
  return norm(dir.x - 2 * d * nx, dir.y - 2 * d * ny);
}

/* ---------------- pickups ---------------- */
function resetPickup(pk){
  let x, y, tries = 0;
  do { x = rnd(140, GAME_SIZE - 140); y = rnd(140, GAME_SIZE - 140); tries++; }
  while (tries < 20 && ((BH && dist(x, y, BH.x, BH.y) < 240) || (BOT && dist(x, y, BOT.x, BOT.y) < 240)));
  pk.x = x; pk.y = y; pk.alive = true; pk.t = 0;
}
function updatePickups(dt){
  if (pickups.length < 2) for (let i = pickups.length; i < 2; i++){ const pk = {}; resetPickup(pk); pickups.push(pk); }
  for (const pk of pickups){
    pk.t += dt;
    if (!pk.alive){ pk.respawn -= dt; if (pk.respawn <= 0) resetPickup(pk); continue; }
    for (const f of [BH, BOT]){
      if (!f || f.hp <= 0) continue;
      if (dist(f.x, f.y, pk.x, pk.y) < f.radius + CFG.PICKUP_TOUCH_BONUS){ // footprint grows with BH
        pk.alive = false; pk.respawn = 9;
        const before = f.hp;
        f.hp = Math.min(f.maxHp, f.hp + 40);
        spawnText(pk.x, pk.y - 40, `+${(f.hp - before).toFixed(0)} HP`, '#9fe8c8', 15);
        spawnBurst(pk.x, pk.y, 10, 220, [0.4, 0.85, 0.95], 2.5);
      }
    }
  }
}

/* ---------------- world VFX particle pool ---------------- */
function spawnW(mode, x, y, o){
  if (world.length > 1400) world.shift();
  world.push(Object.assign({ mode, x, y, px: x, py: y, life: 0.6, maxLife: 0.6, size: 3, col: [0.72, 0.4, 1], heat: 0, alpha: 1, vx: 0, vy: 0, damp: 2.2, born: T }, o, { maxLife: o.life !== undefined ? o.life : 0.6 }));
}
function spawnBurst(x, y, n, speed, col, size){
  for (let i = 0; i < n; i++){
    const a = rnd(0, Math.PI * 2), sp = speed * rnd(0.35, 1);
    spawnW('free', x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.25, 0.6), size: size * rnd(0.7, 1.5), col, heat: rnd(0.2, 0.9) });
  }
}
function spawnInfall(sing, rhoU){
  // golden capture law in slot units, converted to world px
  const a = rnd(0, Math.PI * 2);
  spawnW('infall', sing.x + Math.cos(a) * rhoU * sing.slotScale(), sing.y + Math.sin(a) * rhoU * sing.slotScale(),
    { sing, rhoU, al: a, life: 3, size: rnd(1.8, 3.4), col: [0.6, 0.35, 1], heat: 0 });
}
function spawnCaptureVfx(sing, b){
  const d = norm(b.vx, b.vy);
  for (let i = 0; i < 3; i++){
    spawnW('infall', sing.x + d.x * sing.R * (1.1 + i * 0.2), sing.y + d.y * sing.R * (1.1 + i * 0.2),
      { sing, rhoU: (1.1 + i * 0.2) * 0.125, al: Math.atan2(d.y, d.x), life: 1.4, size: rnd(2.5, 4), col: [0.72, 0.42, 1], heat: 0.5 });
  }
  sing.flash = Math.min(1, sing.flash + 0.3);
  rings.push({ x: sing.x, y: sing.y, r: sing.R * 0.9, vr: -300, alpha: 0.5, col: [0.8, 0.6, 1], width: 3 });
}
function spawnReleaseVfx(sing, s){
  sing.flash = Math.min(1, sing.flash + 0.42);
  sing.shock(0.45);
  const d = norm(s.vx, s.vy);
  for (let i = 0; i < 7; i++){
    const sp = rnd(120, 420);
    const a = Math.atan2(d.y, d.x) + rnd(-0.7, 0.7);
    spawnW('free', sing.x + d.x * sing.R * 0.5, sing.y + d.y * sing.R * 0.5, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.2, 0.45), size: rnd(2, 4), col: [0.75, 0.5, 1], heat: 0.7 });
  }
  rings.push({ x: sing.x, y: sing.y, r: sing.R * 0.4, vr: 700, alpha: 0.55, col: [0.85, 0.65, 1], width: 3.5 });
}
function spawnSingBurst(sing, sign){
  const n = 20, dir = sign >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++){
    const a = rnd(0, Math.PI * 2), sp = rnd(160, 520) * dir;
    spawnW('free', sing.x + Math.cos(a) * sing.R * 0.6, sing.y + Math.sin(a) * sing.R * 0.6, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.3, 0.7), size: rnd(2, 4.5), col: [0.7, 0.4, 1], heat: rnd(0.3, 1) });
  }
  rings.push({ x: sing.x, y: sing.y, r: sing.R * 0.5, vr: 850, alpha: 0.7, col: [0.75, 0.5, 1], width: 4 });
}
function spawnFold(impact, amount){
  // A2: impact energy folds toward a compressed point beside the body
  const i = Math.floor(rnd(0, 3));
  spawnW('fold', impact.x, impact.y, { cp: i, life: 0.85, size: clamp(2 + amount * 0.06, 2, 7), col: [0.78, 0.45, 1], heat: clamp01(amount / 60), stage: 0 });
}
function updateWorldVfx(dt){
  const eF = escrow01();
  for (let i = world.length - 1; i >= 0; i--){
    const p = world[i];
    p.px = p.x; p.py = p.y;
    p.life -= dt;
    if (p.life <= 0){ world.splice(i, 1); continue; }
    if (p.mode === 'free'){
      p.vx *= Math.exp(-dt * p.damp); p.vy *= Math.exp(-dt * p.damp);
      p.x += p.vx * dt; p.y += p.vy * dt;
    } else if (p.mode === 'infall'){
      const s = p.sing;
      if (!s || s.dead || s.suck.v < 0.1){ world.splice(i, 1); continue; }
      const rho = Math.max(p.rhoU, 0.126);
      const om = Math.min(0.34 * Math.pow(rho, -1.5), 14);
      p.al -= om * dt * (0.35 + 0.65 * Math.min(1, s.suck.v * 1.5));
      p.rhoU -= (0.07 + 0.022 / rho) * Math.max(s.suck.v, 0.05) * dt;
      p.x = s.x + Math.cos(p.al) * p.rhoU * s.slotScale();
      p.y = s.y + Math.sin(p.al) * p.rhoU * s.slotScale();
      p.heat = clamp01((0.3 - p.rhoU) / 0.18);
      if (p.rhoU < 0.128){ world.splice(i, 1); continue; }
    } else if (p.mode === 'fold'){
      const a = T * 0.7 + p.cp * (Math.PI * 2 / 3);
      const rr = BH.radius * (0.92 + 0.12 * eF);
      const tx = BH.x + Math.cos(a) * rr, ty = BH.y + Math.sin(a) * rr;
      const k = Math.min(1, dt * 9);
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
      p.heat = Math.min(1, p.heat + dt * 1.4);
      p.size *= Math.exp(-dt * 0.5);
    }
  }
  for (let i = rings.length - 1; i >= 0; i--){
    const r = rings[i];
    r.r += r.vr * dt; r.alpha -= dt * 1.7;
    if (r.alpha <= 0 || r.r < 4) rings.splice(i, 1);
  }
}
function drawWorldVfx(){
  // infall + free + fold particles (post-lens, additive)
  for (const p of world){
    const fade = clamp01(p.life / Math.min(0.35, p.maxLife));
    bPost.wpt(p.x, p.y, p.size * (1 + p.heat * 0.7), 0.85 * fade, p.heat, p.col[0], p.col[1], p.col[2]);
    if (p.mode === 'infall' || p.mode === 'free'){
      const vx = (p.x - p.px), vy = (p.y - p.py);
      const L = Math.hypot(vx, vy);
      if (L > 1.2) bPost.wln(p.x, p.y, p.x - vx * 2.2, p.y - vy * 2.2, 1.6, 0.5 * fade, 0, 1, p.col[0], p.col[1], p.col[2]);
    }
  }
  for (const r of rings){
    bPost.ring(r.x, r.y, Math.max(4, r.r), r.width, Math.max(0, r.alpha), r.col[0], r.col[1], r.col[2]);
  }
  // A2 return crush beam (one concentrated event)
  if (A2.crush && !A2.crush.dead && A2.phase === 'return'){
    const c = A2.crush;
    const pulse = 0.55 + 0.45 * Math.sin(T * 40);
    const d = norm(c.x - BH.x, c.y - BH.y);
    bPost.wln(BH.x + d.x * BH.radius * 0.4, BH.y + d.y * BH.radius * 0.4, c.x, c.y, 7, 0.85 * pulse, 0.9, 1, 0.85, 0.62, 1);
    bPost.wln(BH.x + d.x * BH.radius * 0.4, BH.y + d.y * BH.radius * 0.4, c.x, c.y, 2.2, 1, 1, 0, 1, 0.95, 1);
  }
  // stored-object glints orbiting the exit horizon ("matter visible inside")
  if (A1.exit && !A1.exit.dead && A1.store.length){
    for (let i = 0; i < A1.store.length; i++){
      const s = A1.store[i];
      const a = T * 3.1 + i * 1.7;
      const rr = A1.exit.R * (1.22 + 0.1 * Math.sin(T * 2 + i));
      bPost.wpt(A1.exit.x + Math.cos(a) * rr, A1.exit.y + Math.sin(a) * rr, 4.5, 0.9, 0.75, s.color[0], s.color[1], s.color[2]);
      bPost.wln(A1.exit.x + Math.cos(a) * rr, A1.exit.y + Math.sin(a) * rr,
                A1.exit.x + Math.cos(a - 0.5) * rr, A1.exit.y + Math.sin(a - 0.5) * rr, 1.8, 0.5, 0, 1, s.color[0], s.color[1], s.color[2]);
    }
  }
}

/* ---------------- floating combat text (production FloatingText style) ---------------- */
function spawnText(x, y, txt, color, size){
  texts.push({ x, y, txt, color, size: size || 15, life: 1.1, maxLife: 1.1 });
  if (texts.length > 40) texts.shift();
}
function updateTexts(dt){
  for (let i = texts.length - 1; i >= 0; i--){
    const t = texts[i];
    t.life -= dt; t.y -= dt * 46;
    if (t.life <= 0) texts.splice(i, 1);
  }
}

/* ---------------- KO ---------------- */
function triggerKO(loser){
  if (over) return;
  over = true; overT = 0;
  const bhWon = !loser.isBH;
  if (bhWon) scoreW++; else scoreL++;
  timeScale = 0.3;
  setTimeout(() => { if (timeScale === 0.3) timeScale = 1; }, 1100);
  cam.shake = 14; cam.punch = 0.12;
  setHeadPhase(loser.isBH ? 'ko' : 'a2return');
  if (loser.isBH) koSpring.t = 1;
  $('bannerText').textContent = bhWon ? 'RIVAL CONSUMED' : 'BLACK_HOLE COLLAPSED';
  $('bannerSub').textContent = bhWon ? 'BLACK_HOLE WINS' : 'RIVAL WINS';
  $('banner').classList.add('on');
}

/* ---------------- master update ---------------- */
function updateBattle(dt){
  frameDt = Math.max(dt, 1e-4);
  if (over){
    overT += dt;
    if (overT > 3.4) resetFight();
  } else {
    matchClock += dt;
    graceT = Math.max(0, graceT - dt);
  }
  applyPassive();
  updateBH(dt); updateBOT(dt);
  handleFighterCollision();
  updateProjectiles(dt);
  A1.update(dt); A2.update(dt);
  for (let i = sings.length - 1; i >= 0; i--){
    sings[i].update(dt);
    if (sings[i].dead) sings.splice(i, 1);
  }
  allyCd = Math.max(0, allyCd - dt);
  updatePickups(dt);
  updateWorldVfx(dt);
  updateTexts(dt);
  if (BH.flashT > 0) BH.flashT -= dt;
  if (BOT.flashT > 0) BOT.flashT -= dt;
  updateHeadTimeline(dt);
  updateBlink(dt);
  updateParticles(dt);
  // pack singularity slots: [0] head seat, then entry/exit/a2/crush
  singCount = 0;
  {
    const sc = headScale();
    const sway = headSway(), swayR = headSwayR(), breath = headBreath();
    const bx = seatX * breath, by = seatY * breath;
    const c = Math.cos(-swayR), s = Math.sin(-swayR);
    const hx = BH.x + (c * bx - s * by + sway[0]) * sc / 1;   // head-space → world scale
    const hy = BH.y - (s * bx + c * by + sway[1]) * sc / 1;
    packSing(singCount++, hx, hy, sc, 0.125 * Math.max(0, SP.rs.v) * breath, SP.K.v + 0.05 * growth01(),
             Math.max(0, SP.spin.v) + 0.2 * growth01(), Math.max(0, SP.suck.v), S.shockT, S.shockAmp, S.flash, PH.acc, PH.accIn, Math.max(0, SP.tension.v), 1);
  }
  for (const s of [A1.entry, A1.exit, A2.field, A2.crush]){
    if (s && !s.dead && singCount < MAX_SING) s.pack(singCount++);
  }
  // chromatic-aberration center: most active singularity, else the head
  let best = -1, bi = 0;
  for (let i = 0; i < singCount; i++){
    const act = singRs[i] * 4 * singSuck[i] + singFlash[i] * 2 + Math.abs(singK[i]) * 0.5;
    if (act > best){ best = act; bi = i; }
  }
  caU = singC[bi*2] / W; caV = singC[bi*2+1] / H;
  maxFlash = 0;
  for (let i = 0; i < singCount; i++) maxFlash = Math.max(maxFlash, singFlash[i]);
  maxFlash = Math.max(maxFlash, S.flash);
}
