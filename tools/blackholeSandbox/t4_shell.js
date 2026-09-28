/* ============================================================================
   BLACK_HOLE battle sandbox — shell: overlay, HUD, input, loop.
   ============================================================================ */

/* ---------------- overlay (floating text + debug, production text style) ---- */
let showHitboxes = false, showUI = true, botFireEnabled = true;
function w2c(x, y){
  const k = CW / W;
  const [sx, sy] = w2s(x, y);
  return [sx * k, sy * k];
}
function drawOverlay(){
  ovx.setTransform(1, 0, 0, 1, 0, 0);
  ovx.clearRect(0, 0, CW, CH);
  if (!showUI) return;
  const k = CW / W;
  ovx.textAlign = 'center'; ovx.textBaseline = 'middle';
  for (const t of texts){
    const [sx, sy] = w2c(t.x, t.y);
    const a = clamp01(t.life / t.maxLife);
    ovx.globalAlpha = a;
    ovx.font = `900 ${Math.round(t.size * k * 1.15)}px ui-monospace, Menlo, Consolas, monospace`;
    ovx.lineWidth = 4 * k; ovx.strokeStyle = 'rgba(8,4,16,0.9)';
    ovx.strokeText(t.txt, sx, sy);
    ovx.fillStyle = t.color;
    ovx.fillText(t.txt, sx, sy);
  }
  ovx.globalAlpha = 1;
  if (A2.phase === 'vuln'){
    const [sx, sy] = w2c(BH.x, BH.y - BH.radius - 34);
    ovx.font = `900 ${Math.round(11 * k * 1.2)}px ui-monospace, monospace`;
    ovx.lineWidth = 3 * k; ovx.strokeStyle = 'rgba(8,4,16,0.9)';
    ovx.fillStyle = '#e2b8ff';
    const label = `EXPOSED ×2 · ${A2.vulnT.toFixed(1)}s`;
    ovx.strokeText(label, sx, sy); ovx.fillText(label, sx, sy);
  }
  if (showHitboxes) drawHitboxes(k);
}
function drawHitboxes(k){
  ovx.lineWidth = 1.5 * k;
  const circle = (x, y, r, col, dash) => {
    const [sx, sy] = w2c(x, y);
    ovx.strokeStyle = col; ovx.setLineDash(dash ? [6*k, 5*k] : []);
    ovx.beginPath(); ovx.arc(sx, sy, r * camZ * k, 0, Math.PI*2); ovx.stroke();
    ovx.setLineDash([]);
  };
  for (const f of [BH, BOT]){
    if (!f) continue;
    circle(f.x, f.y, f.radius, f.isBH ? 'rgba(220,180,255,0.9)' : 'rgba(255,150,110,0.9)', true);       // collision footprint
    circle(f.x, f.y, f.radius * CFG.BULLET_HIT_RADIUS_SCALE, 'rgba(255,255,255,0.35)', false);          // bullet hit volume
    if (f.isBH) circle(f.x, f.y, f.radius + CFG.PICKUP_TOUCH_BONUS, 'rgba(120,230,200,0.5)', true);     // pickup footprint
  }
  for (const s of [A1.entry, A1.exit]){
    if (!s || s.dead) continue;
    circle(s.x, s.y, s.R * Math.max(0, s.rs.v), 'rgba(255,255,255,0.85)', false);                       // horizon
    circle(s.x, s.y, s.R * 2.6, 'rgba(180,140,255,0.45)', true);                                        // influence
  }
  if (A1.exit && !A1.exit.dead) circle(BOT.x, BOT.y, BOT.radius + CFG.A1.margin, 'rgba(255,220,120,0.4)', true); // safe margin
  for (const pk of pickups) if (pk.alive) circle(pk.x, pk.y, 42, 'rgba(160,240,255,0.5)', true);
}

/* ---------------- world draw (sprites + bullets into scene batch) ---------------- */
function drawEntities(){
  if (BOT && BOT.hp > 0){
    const rot = -Math.atan2(BOT.dir.y, BOT.dir.x);
    const fl = BOT.flashT > 0 ? 1.8 : 1;
    pushSprite(botTex, BOT.x, BOT.y, 110, 110, rot, fl, fl * 0.92, fl * 0.85, 1);
  }
  for (const pk of pickups){
    if (!pk.alive) continue;
    const pulse = 1 + 0.06 * Math.sin(pk.t * 3.2);
    pushSprite(orbTex, pk.x, pk.y, 64 * pulse, 64 * pulse, 0, 1, 1, 1, 0.85 + 0.15 * Math.sin(pk.t * 3.2));
  }
  // bullets — production tracer language (thin core + bright head)
  for (const p of projectiles){
    const g = GUNS[p.weapon];
    const t = (g && g.tracer) || TRACER.PISTOL;
    const a = clamp(p.life / p.maxLife, 0.4, 1);
    bScene.wln(p.x - p.vx * t.trail, p.y - p.vy * t.trail, p.x, p.y, t.width, 0.9 * a, 0.95 * a, 1, p.color[0], p.color[1], p.color[2]);
    bScene.wpt(p.x, p.y, t.head * 2.2, a, 0.85, 1, 0.97, 0.88);
    if (p.t6){ // protected round reads over everything, horizon included
      bPost.wln(p.x - p.vx * t.trail * 1.4, p.y - p.vy * t.trail * 1.4, p.x, p.y, t.width * 2.2, 0.4 * a, 0.5 * a, 1, 1, 0.85, 0.42);
      bPost.wpt(p.x, p.y, t.head * 3.2, a, 0.9, 1, 0.9, 0.55);
    }
  }
  drawWorldVfx();
}

/* ---------------- HUD (production hp-bar behavior) ---------------- */
function updateHpLossTrail(fill, trail, visiblePct){
  if (!fill) return;
  const previous = Number(fill.dataset.hpPct);
  if (trail && Number.isFinite(previous) && visiblePct < previous - .01){
    trail.style.transition = 'none';
    trail.style.left = `${visiblePct}%`;
    trail.style.width = `${previous - visiblePct}%`;
    trail.style.opacity = '1';
    void trail.offsetWidth;
    trail.style.transition = 'opacity .62s ease-out';
    clearTimeout(trail.__apexFadeTimer);
    trail.__apexFadeTimer = setTimeout(() => { trail.style.opacity = '0'; }, 70);
  } else if (trail && Number.isFinite(previous) && visiblePct > previous + .01){
    trail.style.opacity = '0'; trail.style.width = '0';
  }
  fill.style.width = `${visiblePct}%`;
  fill.dataset.hpPct = String(visiblePct);
}
let hudClock = 0;
function updateHUD(){
  for (const [f, i] of [[BH, 1], [BOT, 2]]){
    if (!f) continue;
    const pct = Math.min(100, clamp((f.hp / f.maxHp) * 100, 0, 100));
    updateHpLossTrail($(`p${i}-hp`), $(`p${i}-hp-loss`), pct);
    $(`p${i}-hp-text`).textContent = `${Math.max(0, f.hp).toFixed(0)} / ${f.maxHp}`;
  }
  const chip1 = $('chipA1'), chip2 = $('chipA2');
  chip1.querySelector('.cd').style.width = A1.active ? '100%' : `${(1 - A1.cd / CFG.A1.cd) * 100}%`;
  chip1.classList.toggle('active', A1.active);
  chip1.classList.toggle('ready', !A1.active && A1.cd <= 0);
  chip1.querySelector('.st').textContent = A1.active
    ? `ACTIVE · ${A1.storedCount()}/${CFG.A1.cap}${A1.storedCount() >= CFG.A1.cap ? ' · SATURATED' : ''}`
    : (A1.cd <= 0 ? 'READY · PRESS J' : `${A1.cd.toFixed(1)}s`);
  chip2.querySelector('.cd').style.width = (A2.phase === 'absorb' || A2.phase === 'return') ? '100%' : `${(1 - A2.cd / CFG.A2.cd) * 100}%`;
  chip2.classList.toggle('active', A2.phase === 'absorb' || A2.phase === 'return');
  chip2.classList.toggle('ready', A2.phase === 'idle' && A2.cd <= 0);
  chip2.querySelector('.st').textContent =
    A2.phase === 'absorb' ? `ABSORBING · ${A2.escrow.toFixed(0)}/${CFG.A2.maxEscrow}` :
    A2.phase === 'return' ? 'RETURNING' :
    A2.phase === 'vuln' ? `EXPOSED ×2 · ${A2.vulnT.toFixed(1)}s` :
    (A2.cd <= 0 ? 'READY · PRESS K' : `${A2.cd.toFixed(1)}s`);
  const bonus = PASS.bonus();
  $('growVal').textContent = `+${bonus}${PASS.forced !== null ? ' (FORCED)' : ''}`;
  $('growBar').style.width = `${bonus}%`;
  const cs = $('condStore'), ce = $('condEscrow'), cv = $('condVuln');
  cs.classList.toggle('on', A1.active);
  if (A1.active) cs.textContent = `TRANSIT ${A1.storedCount()}/${CFG.A1.cap} · DELAY ${CFG.A1.delay}s`;
  ce.classList.toggle('on', A2.phase === 'absorb');
  if (A2.phase === 'absorb') ce.textContent = `ESCROW ${A2.escrow.toFixed(0)} / ${CFG.A2.maxEscrow} → RETURN ${(A2.escrow * CFG.A2.returnMult).toFixed(0)}`;
  cv.classList.toggle('on', A2.phase === 'vuln');
  $('mH').style.width = (clamp01(SP.rs.v) * 100).toFixed(1) + '%';
  $('mS').style.width = (clamp01(SP.suck.v) * 100).toFixed(1) + '%';
  $('mT').style.width = (clamp01(SP.stress.v) * 100).toFixed(1) + '%';
  const m = Math.floor(matchClock / 60), s = Math.floor(matchClock % 60);
  $('clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('wl').textContent = `W ${scoreW} — ${scoreL} L`;
}

/* ---------------- scheduled game-time events ---------------- */
const pending = [];
function later(sec, fn){ pending.push({ t: sec, fn }); }
function updatePending(dt){
  for (let i = pending.length - 1; i >= 0; i--){
    pending[i].t -= dt;
    if (pending[i].t <= 0){ const fn = pending[i].fn; pending.splice(i, 1); try { fn(); } catch (e) { console.error(e); } }
  }
}

/* ---------------- debug actions ---------------- */
const DBG = {
  stream(){ // bot SMG stream at BLACK_HOLE
    let n = 10;
    const tick = () => {
      if (!BOT || BOT.hp <= 0) return;
      const lead = norm(BH.vx || 0, BH.vy || 0);
      const tx = BH.x + lead.x * 110, ty = BH.y + lead.y * 110;
      const a = Math.atan2(ty - BOT.y, tx - BOT.x) + rnd(-0.05, 0.05);
      fireBullet(BOT, BOT.x + Math.cos(a) * (BOT.radius + 10), BOT.y + Math.sin(a) * (BOT.radius + 10), a, 'SMG');
      if (--n > 0) later(0.085, tick);
    };
    tick();
  },
  burst(){ // 3×30 direct damage — A2 escrow / vulnerability test
    for (let i = 0; i < 3; i++){
      later(i * 0.14, () => {
        if (over) return;
        const a = rnd(0, Math.PI * 2);
        dealDamage(BH, 30, BOT, { tier: 'T3', kind: 'burst', impact: { x: BH.x + Math.cos(a) * BH.radius, y: BH.y + Math.sin(a) * BH.radius } });
      });
    }
  },
  t6(){ // protected round: never captured, never escrowed
    if (!BOT || BOT.hp <= 0) return;
    const a = Math.atan2(BH.y - BOT.y, BH.x - BOT.x);
    fireBullet(BOT, BOT.x + Math.cos(a) * (BOT.radius + 14), BOT.y + Math.sin(a) * (BOT.radius + 14), a, 'T6');
    spawnText(BOT.x, BOT.y - BOT.radius - 40, 'T6 STORMBREAKER', '#ffd76a', 12);
  },
  ally(){ // BLACK_HOLE-side rounds — A1 flanking demo (ownership preserved)
    for (let i = 0; i < 6; i++){
      later(i * 0.09, () => {
        if (over) return;
        const a = Math.atan2(BOT.y - BH.y, BOT.x - BH.x) + rnd(-0.05, 0.05);
        fireBullet(BH, BH.x + Math.cos(a) * (BH.radius + 12), BH.y + Math.sin(a) * (BH.radius + 12), a, 'ALLY');
      });
    }
  },
};

/* ---------------- reset ---------------- */
function resetFight(keepScore){
  BH = makeFighter('BLACK_HOLE', 300, 500, true);
  BOT = makeFighter('RIVAL', 700, 500, false);
  projectiles.length = 0; texts.length = 0; rings.length = 0; world.length = 0; pending.length = 0;
  pickups.length = 0;
  for (const s of sings) s.dead = true;
  sings.length = 0;
  A1.cd = 0; A1.active = false; A1.entry = null; A1.exit = null; A1.store.length = 0;
  A2.cd = 0; A2.phase = 'idle'; A2.t = 0; A2.escrow = 0; A2.vulnT = 0; A2.field = null; A2.crush = null;
  PASS.realized = 0;
  matchClock = 0; over = false; graceT = 2.2; timeDip = 1; dipTimer = 0; allyCd = 0;
  if (timeScale === 0.3) timeScale = 1;
  koSpring.t = 0; koSpring.snap(0); vulnSpring.snap(0); hitFlashSpring.snap(0);
  for (const k in SP) { SP[k].snap(IDLE_T[k]); SP[k].w = SP[k].w0; SP[k].z = SP[k].z0; }
  for (let i = 0; i < NP; i++) { if (i < ND) spawnDust(parts[i], true); else spawnMote(parts[i], true); }
  for (const s of shards) spawnShard(s, true);
  S.shockT = 99; S.shockAmp = 0; S.flash = 0; blinkT = 99; blinkQueue = 0;
  seatX = 0; seatY = 0.17;
  setHeadPhase(introDone ? 'idle' : 'intro');
  $('banner').classList.remove('on');
  applyPassive();
  updateHUD();
}

/* ---------------- input ---------------- */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys[k] = true;
  if (e.repeat) return;
  if (k === 'j') A1.cast();
  else if (k === 'k') A2.cast();
  else if (k === 'r') resetFight();
  else if (k === 'p') togglePause();
  else if (k === 's') cycleSlow();
  else if (k === 'b') startBlink();
  else if (k === 'h') toggleUI();
  else if (k === 'd'){ showHitboxes = !showHitboxes; syncBtns(); }
  else if (k === 'c'){ cam.mode = cam.mode === 'full' ? 'follow' : 'full'; syncBtns(); }
  else if (k === 'g'){ PASS.forced = PASS.forced === null ? 0 : PASS.forced === 0 ? 50 : PASS.forced === 50 ? 100 : null; syncBtns(); }
  else if (k === 'o'){ autoMove = !autoMove; syncBtns(); }
  else if (k === 'l' || k === ' ') allyFire();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
function togglePause(){ paused = !paused; syncBtns(); }
function cycleSlow(){
  timeScale = timeScale === 1 ? 0.5 : timeScale === 0.5 ? 0.25 : 1;
  syncBtns();
}
function toggleUI(){
  showUI = !showUI;
  $('hud').classList.toggle('hidden', !showUI);
  syncBtns();
}
function syncBtns(){
  $('bSlow').textContent = `SLOW ${timeScale}×`;
  $('bSlow').classList.toggle('on', timeScale !== 1);
  $('bPause').classList.toggle('on', paused);
  $('bPause').textContent = paused ? 'RESUME' : 'PAUSE';
  $('bCam').textContent = `CAM: ${cam.mode === 'full' ? 'FULL' : 'FOLLOW'}`;
  $('bCam').classList.toggle('on', cam.mode === 'follow');
  $('bAuto').textContent = `MOVE: ${autoMove ? 'AUTO' : 'MANUAL'}`;
  $('bAuto').classList.toggle('on', autoMove);
  $('bBox').classList.toggle('on', showHitboxes);
  for (const [id, v] of [['bG0', 0], ['bG50', 50], ['bG100', 100]]){
    $(id).classList.toggle('on', PASS.forced === v);
  }
  $('bGAUTO').classList.toggle('on', PASS.forced === null);
}
$('panel').addEventListener('click', e => e.stopPropagation());
$('bStream').onclick = DBG.stream;
$('bBurst').onclick = DBG.burst;
$('bT6').onclick = DBG.t6;
$('bAlly').onclick = DBG.ally;
$('bA1').onclick = () => { A1.cd = 0; };
$('bA2').onclick = () => { A2.cd = 0; };
$('bHeal').onclick = () => { BH.hp = Math.min(BH.maxHp, BH.hp + 200); spawnText(BH.x, BH.y - BH.radius - 40, 'FIELD REPAIR +200', '#9fe8c8', 14); };
$('bG0').onclick = () => { PASS.forced = 0; syncBtns(); };
$('bG50').onclick = () => { PASS.forced = 50; syncBtns(); };
$('bG100').onclick = () => { PASS.forced = 100; syncBtns(); };
$('bGAUTO').onclick = () => { PASS.forced = null; syncBtns(); };
$('bSlow').onclick = cycleSlow;
$('bPause').onclick = togglePause;
$('bCam').onclick = () => { cam.mode = cam.mode === 'full' ? 'follow' : 'full'; syncBtns(); };
$('bAuto').onclick = () => { autoMove = !autoMove; syncBtns(); };
$('bBox').onclick = () => { showHitboxes = !showHitboxes; syncBtns(); };
$('bReset').onclick = () => resetFight();

/* ---------------- test API (used by tools/testBlackholeSandbox.mjs) ---------------- */
window.BH_SANDBOX = {
  ready: true,
  state(){
    return {
      bh: BH && { hp: BH.hp, x: BH.x, y: BH.y, radius: BH.radius, realized: PASS.realized },
      bot: BOT && { hp: BOT.hp, x: BOT.x, y: BOT.y },
      a1: { cd: A1.cd, active: A1.active, stored: A1.storedCount(), entry: A1.entry && { phase: A1.entry.phase, x: A1.entry.x, y: A1.entry.y, rs: A1.entry.rs.v }, exit: A1.exit && { phase: A1.exit.phase, x: A1.exit.x, y: A1.exit.y } },
      a2: { cd: A2.cd, phase: A2.phase, escrow: A2.escrow, vulnT: A2.vulnT, returned: A2.returned },
      passive: { realized: PASS.realized, bonus: PASS.bonus(), forced: PASS.forced },
      projectiles: projectiles.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, owner: p.owner && p.owner.name, tier: p.tier, t6: !!p.t6, damage: p.damage, released: !!p.released, relV: p.relV || 0 })),
      over, matchClock, fps: perfAvg, quality,
      head: { phase: headPhase, rs: SP.rs.v, suck: SP.suck.v, stress: SP.stress.v },
      escrowed: A2.phase, vfx: { world: world.length, texts: texts.length, sings: sings.filter(s => !s.dead).length },
    };
  },
  pressJ(){ return A1.cast(); },
  pressK(){ return A2.cast(); },
  forceReady(which){ if (which === 'a1') A1.cd = 0; else A2.cd = 0; },
  setGrowth(v){ PASS.forced = v; syncBtns(); },
  spawnStream: DBG.stream,
  spawnBurst: DBG.burst,
  spawnT6: DBG.t6,
  allyStream: DBG.ally,
  resetFight,
  setSlow(v){ timeScale = v; syncBtns(); },
  setCam(m){ cam.mode = m; syncBtns(); },
  setAutoMove(v){ autoMove = v; syncBtns(); },
  setBotFire(v){ botFireEnabled = v; },
  allyFire,
  pause(v){ paused = v; syncBtns(); },
};

/* ---------------- main loop (golden adaptive quality) ---------------- */
let last = performance.now(), perfAcc = 0, perfN = 0, perfClock = 0, perfAvg = 0;
function frame(now){
  const raw = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (dipTimer > 0){ dipTimer -= raw; if (dipTimer <= 0) timeDip = 1; }
  const dt = paused ? 0 : raw * timeScale * timeDip;
  T += dt;
  if (dt > 0){
    updateBattle(dt);
    updatePending(dt);
  }
  updateCamera(raw);
  bScene.clear(); bPost.clear();
  drawEntities();
  renderWorld();
  drawOverlay();
  hudClock += raw;
  if (hudClock > 0.09){ hudClock = 0; updateHUD(); }
  perfAcc += raw; perfN++; perfClock += raw;
  if (perfClock > 2){
    perfAvg = perfAcc / perfN * 1000;
    if (perfAvg > 27 && quality > 0.5){ quality = Math.max(0.5, quality * 0.85); resize(); }
    else if (perfAvg < 15 && quality < 1){ quality = Math.min(1, quality * 1.1); resize(); }
    perfAcc = 0; perfN = 0; perfClock = 0;
  }
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
resize();
resetFight();
introDone = true;   // the birth intro plays on first load only; resets go straight to battle
syncBtns();
requestAnimationFrame(frame);
})();
</script>
</body>
</html>
