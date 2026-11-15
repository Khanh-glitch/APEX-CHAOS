/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Core Combat, Agency, Rulesets & Tactical AI
 *
 *  Scope law: Evolution hooks activate ONLY for public Free Battle (BOT/LOCAL)
 *  Arsenal matches. Quest, Story, Admin Lab and multi-actor encounters are
 *  untouched (every hook checks evoActive()).
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_COMBAT) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const S = () => g.GAME_SIZE || 1000;

  const HERO_ULTIMATE_META = {
    ROBOT: { name: 'OMEGA RAIL BARRAGE', color: '#ff9f1c', rgb: [1.0, 0.62, 0.12], hint: 'Six laser-sighted rail slugs. Sidestep the sight line.' },
    HUNTER: { name: 'PREDATOR ECLIPSE', color: '#9ef01a', rgb: [0.62, 0.94, 0.12], hint: 'Cloaked rake combo. Parry mid-combo to deny.' },
    CRYSTAL: { name: 'PRISMATIC SUPERNOVA', color: '#c77dff', rgb: [0.78, 0.49, 1.0], hint: 'Citadel absorbs shots, then detonates into shards.' },
    MAGNET: { name: 'LORENTZ RAIL-STORM', color: '#90e0ef', rgb: [0.56, 0.88, 0.96], hint: 'Everything metal is dragged onto the line. Leave it.' },
    ICE: { name: 'ABSOLUTE ZERO BLIZZARD', color: '#5ce1ff', rgb: [0.36, 0.88, 1.0], hint: 'Out-run the frost front or be flash-frozen.' },
    MIRROR: { name: 'PHANTOM KALEIDOSCOPE', color: '#f1e8ff', rgb: [0.92, 0.86, 1.0], hint: 'Panes reflect your shots. Break them (3 hits).' },
    BOXE: { name: 'DAWNBREAKER METEOR', color: '#ff6b35', rgb: [1.0, 0.42, 0.18], hint: 'Reticle loses tracking late. Dodge at the last beat.' },
    SHURI: { name: 'ORBITAL SCRAP SIEGE', color: '#ff8c42', rgb: [1.0, 0.55, 0.25], hint: 'Three drones, 2 hits each. Shoot them down.' },
    BLACK_HOLE: { name: 'QUASAR SINGULARITY JET', color: '#b5179e', rgb: [0.78, 0.25, 1.0], hint: 'Twin sweeping jets. Move with the sweep or parry the edge.' },
    TIME: { name: 'CHRONO STASIS CATHEDRAL', color: '#4cc9f0', rgb: [0.30, 0.82, 0.98], hint: 'Your shots freeze inside. Escape before the toll.' },
  };

  const MYTHIC_POOL = ['STORMBREAKER', 'M249_SAW', 'SZECSEI_FUCHS', 'JACKHAMMER', 'DESERT_DEAGLE', 'AK_47', 'BATTLE_AXE'];

  const STYLE_RANKS = [
    { min: 0, grade: 'D', label: 'DORMANT', col: '#94a3b8' },
    { min: 18, grade: 'C', label: 'CHARGED', col: '#38bdf8' },
    { min: 38, grade: 'B', label: 'BRUTAL', col: '#a3e635' },
    { min: 62, grade: 'A', label: 'ASSAULT', col: '#facc15' },
    { min: 88, grade: 'S', label: 'SAVAGE', col: '#fb923c' },
    { min: 118, grade: 'APEX', label: 'APEX CHAOS!!', col: '#f43f5e' },
  ];

  // Four minds, not four multipliers.
  const AI_PROFILES = {
    recruit: { label: 'RECRUIT', think: 0.26, seek: 0.5, dodge: 0.15, parry: 0.12, odPolicy: 'asap', feint: 0, predict: 0, arena: 0 },
    veteran: { label: 'VETERAN', think: 0.16, seek: 0.85, dodge: 0.6, parry: 0.42, odPolicy: 'close', feint: 0.1, predict: 0.3, arena: 0.4 },
    grandmaster: { label: 'GRANDMASTER', think: 0.1, seek: 1.0, dodge: 0.85, parry: 0.7, odPolicy: 'punish', feint: 0.35, predict: 0.7, arena: 0.8 },
    nemesis: { label: 'NEMESIS', think: 0.06, seek: 1.15, dodge: 1.0, parry: 0.88, odPolicy: 'counter', feint: 0.5, predict: 1.0, arena: 1.0 },
  };

  let ruleset = 'standard';
  let aiTier = 'veteran';
  try {
    const sr = localStorage.getItem('apexEvolution.ruleset');
    if (['standard', 'mythic_mayhem', 'championship_bo3', 'tactical_lab'].includes(sr)) ruleset = sr;
    const sa = localStorage.getItem('apexEvolution.aiTier');
    if (AI_PROFILES[sa]) aiTier = sa;
  } catch (_) {}

  const keysHeld = new Set();
  const touchVec = { active: false, x: 0, y: 0 };
  let matchEvo = null;
  let series = { round: 1, p1Wins: 0, p2Wins: 0, log: [] };

  // ── scope law ─────────────────────────────────────────────────────────────
  function evoActive() {
    if (g.gameState !== 'ARSENAL') return false;
    const st = g.APEX_ARSENAL?.state;
    if (!st || !st.active) return false;
    if (st.labMode || st.questMultiActor || st.questStage || st.questReflex || st.questFirstWake || st.questBreachEncounter) return false;
    return true;
  }
  function isBotMode() { return g.__apexArsenalBattleProfile === 'BOT' || g.__apexArsenalSelectionMode === 'bot'; }
  function heroIdOf(f) {
    const ct = g.APEX_HERO_REWORK?.byCombatant?.(f);
    if (ct && ct.heroId) return ct.heroId;
    const raw = String(f?.type?.name || f?.name || 'ROBOT').toUpperCase();
    return raw === 'NEWBOT' ? 'ROBOT' : raw === 'CRYSTALA' ? 'CRYSTAL' : raw === 'FROST' ? 'ICE' : raw;
  }

  function makeSideState() {
    return {
      sync: 25, aegisCd: 0, aegisWindow: 0, lateGuard: 0, momentum: 0,
      overdriveLeft: 0, parryCount: 0, overdriveCount: 0, ricochets: 0, absorbs: 0,
      styleScore: 0, maxRankIdx: 0, recentActions: [], varietyChain: 0,
      steerVec: { x: 0, y: 0, active: false }, aiThinkCd: 0.2, aiSteer: { x: 0, y: 0, active: false },
      aiFeintT: 0, aiMemoryShots: 0, biggestHit: 0, damageDealt: 0, mythicPickups: 0,
    };
  }

  function resetMatchEvolution(preserveSeries) {
    if (!preserveSeries || ruleset !== 'championship_bo3') series = { round: 1, p1Wins: 0, p2Wins: 0, log: [] };
    matchEvo = {
      time: 0, sides: [makeSideState(), makeSideState()], evoBolts: [], callouts: [],
      supplyDrop: { nextAt: ruleset === 'mythic_mayhem' ? 8 : 20, cadence: ruleset === 'mythic_mayhem' ? 11 : 24, pod: null },
      cine: { zoom: 1, dilation: 1, hold: 0 }, ko: null, roundEnd: null, reportedToDb: false,
      highlights: [], arenaEvents: 0,
    };
    if (ruleset === 'mythic_mayhem') { matchEvo.sides[0].sync = 55; matchEvo.sides[1].sync = 55; }
    if (ruleset === 'tactical_lab') matchEvo.sides[0].sync = 100;
    g.APEX_EVOLUTION_ULTIMATES?.clear?.();
    g.APEX_EVOLUTION_VFX?.clear?.();
    g.APEX_EVOLUTION_ARENAS?.initMatchArena?.(S());
    g.APEX_EVOLUTION_HUD?.onMatchStart?.(matchEvo, series);
  }

  // ── feedback helpers ───────────────────────────────────────────────────────
  function callout(x, y, text, color = '#ffd166', scale = 1.0) {
    if (!matchEvo) return;
    if (matchEvo.callouts.length > 8) matchEvo.callouts.shift();
    matchEvo.callouts.push({ x, y, vy: -54, text, color, scale, life: 1.0, maxLife: 1.0, tilt: rnd(-0.06, 0.06) });
    g.APEX_EVOLUTION_HUD?.kinetic?.(x, y, text, color, scale);
  }
  function highlight(text, icon) { if (matchEvo && matchEvo.highlights.length < 14) matchEvo.highlights.push({ t: matchEvo.time, text, icon }); }

  function noteAction(sideIdx, type) {
    const st = matchEvo?.sides?.[sideIdx]; if (!st) return 1;
    const recent = st.recentActions;
    const last = recent[recent.length - 1];
    let mult = 1;
    if (last === type) { mult = 0.5; st.varietyChain = 0; }
    else { st.varietyChain = Math.min(6, st.varietyChain + 1); mult = 1 + st.varietyChain * 0.12; }
    recent.push(type); if (recent.length > 6) recent.shift();
    if (st.varietyChain === 4) callout(g.fighters?.[sideIdx]?.x || 500, (g.fighters?.[sideIdx]?.y || 500) - 120, 'VARIETY CHAIN', '#a3e635', 0.9);
    return mult;
  }
  function addStyleAndSync(sideIdx, styleGain, syncGain, actionType) {
    if (!matchEvo || (sideIdx !== 0 && sideIdx !== 1)) return;
    const st = matchEvo.sides[sideIdx];
    const mult = actionType ? noteAction(sideIdx, actionType) : 1;
    st.styleScore = clamp(st.styleScore + styleGain * mult, 0, 155);
    const rsMult = (ruleset === 'mythic_mayhem' ? 1.6 : 1) * (st.momentum > 0 ? 1.6 : 1);
    if (st.overdriveLeft <= 0) st.sync = clamp(st.sync + syncGain * rsMult, 0, 100);
    for (let i = STYLE_RANKS.length - 1; i >= 0; i--) if (st.styleScore >= STYLE_RANKS[i].min) { if (i > st.maxRankIdx) { st.maxRankIdx = i; if (i >= 4) highlight(`Reached STYLE ${STYLE_RANKS[i].grade}`, '★'); } break; }
    if (st.sync >= 100 && !st._odReadyShown && st.overdriveLeft <= 0) { st._odReadyShown = true; const f = g.fighters?.[sideIdx]; if (f) callout(f.x, f.y - 120, 'ULTIMATE READY', HERO_ULTIMATE_META[heroIdOf(f)]?.color || '#ffd166', 1.1); }
  }
  function currentRank(sideIdx) { const s = matchEvo?.sides?.[sideIdx]?.styleScore || 0; let pick = STYLE_RANKS[0]; for (const r of STYLE_RANKS) if (s >= r.min) pick = r; return pick; }
  function distPointSeg(px, py, x1, y1, x2, y2) { const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy; if (l2 < 1e-5) return Math.hypot(px - x1, py - y1); const t = clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1); return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t)); }

  // ── cinematic control (time dilation + camera) ─────────────────────────────
  function cinematic(o) {
    if (!matchEvo) return;
    const c = matchEvo.cine;
    if (o.zoom) c.zoom = Math.max(c.zoom, o.zoom);
    if (o.dilation != null) { c.dilation = Math.min(c.dilation, o.dilation); c.hold = Math.max(c.hold, o.hold || 0.3); }
  }

  // ── AEGIS CLASH ────────────────────────────────────────────────────────────
  function triggerAegis(sideIdx) {
    if (!evoActive() || !matchEvo) return false;
    const f = g.fighters?.[sideIdx]; if (!f || f.hp <= 0) return false;
    const st = matchEvo.sides[sideIdx];
    if (st.aegisCd > 0.01) return false;
    st.aegisCd = ruleset === 'tactical_lab' ? 0.8 : 4.6;
    st.aegisWindow = 0.24; st.lateGuard = 0.14;
    g.APEX_EVOLUTION_AUDIO?.playGuardPulse?.();
    g.APEX_EVOLUTION_SHADER?.pushLight?.(f.x, f.y, 0.45, 0.92, 1.0, 165, 0.85);
    g.APEX_EVOLUTION_VFX?.emit({ tex: 'ring', x: f.x, y: f.y, life: 0.3, s0: (f.radius || 75) * 1.2, s1: (f.radius || 75) * 3, tint: '#8ff6ff' });
    sweepParryProjectiles(f, sideIdx, st);
    return true;
  }
  function celebratePerfectParry(f, sideIdx, st, hx, hy, kind) {
    st.parryCount += 1; st.momentum = 1.3;
    st.aegisCd = Math.min(st.aegisCd, ruleset === 'tactical_lab' ? 0.3 : 1.2);
    addStyleAndSync(sideIdx, 26, 30, 'parry');
    g.hitStop = Math.max(g.hitStop || 0, 0.07); g.cameraShake = Math.max(g.cameraShake || 0, 9);
    g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(hx, hy, 0.56, 340, 780, 1.25);
    g.APEX_EVOLUTION_SHADER?.pushLight?.(hx, hy, 1.0, 0.88, 0.38, 240, 1.35);
    g.APEX_EVOLUTION_VFX?.recipes.plasmaBurst(hx, hy, 70, '#ffd166');
    g.APEX_EVOLUTION_VFX?.recipes.impactSparks(hx, hy, 14, '#fff1c2', hy + 50);
    g.APEX_EVOLUTION_AUDIO?.playPerfectParry?.();
    callout(f.x, f.y - (f.radius || 75) - 18, kind === 'clash' ? 'CLASH!' : 'PERFECT PARRY!', '#ffd166', 1.2);
    highlight(`${sideIdx === 0 ? 'P1' : 'P2'} perfect ${kind === 'clash' ? 'clash' : 'parry'} at ${matchEvo.time.toFixed(1)}s`, '⚡');
    cinematic({ zoom: 1.03, dilation: 0.55, hold: 0.18 });
  }
  function sweepParryProjectiles(f, sideIdx, st) {
    const enemy = g.fighters?.[1 - sideIdx];
    const parryR = (f.radius || 75) + 46;
    let any = false;
    for (const p of g.projectiles || []) {
      if (!p || p.owner === f || p.__parriedBy === f || (p.life !== undefined && p.life <= 0) || typeof p.x !== 'number') continue;
      const px0 = typeof p.px === 'number' ? p.px : p.x, py0 = typeof p.py === 'number' ? p.py : p.y;
      const lookX = p.x + (p.vx || 0) * 0.032, lookY = p.y + (p.vy || 0) * 0.032;
      const d = Math.min(distPointSeg(f.x, f.y, px0, py0, p.x, p.y), distPointSeg(f.x, f.y, p.x, p.y, lookX, lookY));
      if (d <= parryR + (p.radius || 8)) {
        p.__parriedBy = f; p.owner = f;
        if (p.__mythic || p.heavy) { // ABSORB: heavy ordnance is eaten for HP + sync
          p.life = 0; st.absorbs++; f.hp = Math.min(f.maxHp, f.hp + 45); addStyleAndSync(sideIdx, 18, 22, 'absorb');
          callout(f.x, f.y - 120, 'ABSORB +45', '#72efdd', 1.05); g.APEX_EVOLUTION_VFX?.recipes.plasmaBurst(p.x, p.y, 60, '#72efdd'); any = true; continue;
        }
        const aim = enemy ? Math.atan2(enemy.y - p.y, enemy.x - p.x) + rnd(-0.05, 0.05) : Math.atan2(-(p.vy || 0), -(p.vx || 1));
        const sp = Math.max(1400, Math.hypot(p.vx || 0, p.vy || 0)) * 1.32;
        p.vx = Math.cos(aim) * sp; p.vy = Math.sin(aim) * sp; p.px = p.x; p.py = p.y;
        if (typeof p.damage === 'number') p.damage *= 1.35; if (typeof p.dmg === 'number') p.dmg *= 1.35;
        p.color = '#ffd166'; p.heavy = true; p.__homing = enemy ? 2.2 : 0;
        if (typeof p.life === 'number') p.life = Math.max(p.life, 0.9);
        any = true; celebratePerfectParry(f, sideIdx, st, p.x, p.y, 'parry');
      }
    }
    for (const b of matchEvo?.evoBolts || []) {
      if (b.sideIdx === sideIdx) continue;
      if (Math.hypot(b.x - f.x, b.y - f.y) <= parryR + b.r) {
        b.sideIdx = sideIdx;
        const aim = enemy ? Math.atan2(enemy.y - b.y, enemy.x - b.x) : Math.atan2(-b.vy, -b.vx);
        const sp = Math.hypot(b.vx, b.vy) * 1.3;
        b.vx = Math.cos(aim) * sp; b.vy = Math.sin(aim) * sp; b.col = '#ffd166'; b.dmg *= b.rail ? 1.8 : 1.35; b.homing = 2.5;
        any = true; celebratePerfectParry(f, sideIdx, st, b.x, b.y, 'parry');
      }
    }
    return any;
  }

  // ── OVERDRIVE ──────────────────────────────────────────────────────────────
  function triggerOverdrive(sideIdx) {
    if (!evoActive() || !matchEvo) return false;
    const f = g.fighters?.[sideIdx], enemy = g.fighters?.[1 - sideIdx];
    if (!f || f.hp <= 0 || !enemy) return false;
    const st = matchEvo.sides[sideIdx];
    if (st.sync < 100 && ruleset !== 'tactical_lab') return false;
    if (st.overdriveLeft > 0.2 || g.APEX_EVOLUTION_ULTIMATES?.isActive?.(sideIdx)) return false;
    st.sync = ruleset === 'tactical_lab' ? 100 : 0; st._odReadyShown = false;
    st.overdriveLeft = 4.6; st.overdriveCount += 1;
    addStyleAndSync(sideIdx, 30, 0, 'overdrive');
    const hId = heroIdOf(f), meta = HERO_ULTIMATE_META[hId] || HERO_ULTIMATE_META.ROBOT;
    g.hitStop = Math.max(g.hitStop || 0, 0.06); g.cameraShake = Math.max(g.cameraShake || 0, 12);
    g.APEX_EVOLUTION_SHADER?.setOverdriveTint?.(1.0);
    g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(f.x, f.y, 0.72, 540, 860, 1.35);
    g.APEX_EVOLUTION_SHADER?.pushLight?.(f.x, f.y, meta.rgb[0], meta.rgb[1], meta.rgb[2], 340, 1.5);
    g.APEX_EVOLUTION_VFX?.recipes.plasmaBurst(f.x, f.y, 160, meta.color);
    g.APEX_EVOLUTION_AUDIO?.playOverdriveActivate?.(hId);
    g.APEX_EVOLUTION_HUD?.ultimateBanner?.(sideIdx, hId, meta);
    highlight(`${sideIdx === 0 ? 'P1' : 'P2'} unleashed ${meta.name}`, '★');
    const ct = g.APEX_HERO_REWORK?.byCombatant?.(f);
    if (ct && ct.skills) for (const slot of ['A1', 'A2']) if (ct.skills[slot]?.cdLeft > 0) ct.skills[slot].cdLeft *= 0.5;
    g.APEX_EVOLUTION_ULTIMATES?.cast?.(sideIdx, hId, f, enemy, meta);
    return true;
  }

  // ── bolts (ultimate projectiles) ──────────────────────────────────────────
  function spawnBolt(sideIdx, x, y, vx, vy, dmg, r, col, life = 1.3, homing = 0, extra = {}) {
    if (!matchEvo) return;
    matchEvo.evoBolts.push(Object.assign({ sideIdx, x, y, vx, vy, dmg, r, col, life, maxLife: life, homing, px: x, py: y }, extra));
  }

  // ── movement: thrusters, afterburner, drag states ─────────────────────────
  function readHumanVector(sideIdx) {
    let x = 0, y = 0;
    const arrows = () => { if (keysHeld.has('ArrowLeft')) x -= 1; if (keysHeld.has('ArrowRight')) x += 1; if (keysHeld.has('ArrowUp')) y -= 1; if (keysHeld.has('ArrowDown')) y += 1; };
    if (sideIdx === 0) {
      if (keysHeld.has('KeyA')) x -= 1; if (keysHeld.has('KeyD')) x += 1; if (keysHeld.has('KeyW')) y -= 1; if (keysHeld.has('KeyS')) y += 1;
      if (isBotMode()) arrows();
      if (touchVec.active) { x += touchVec.x; y += touchVec.y; }
    } else if (!isBotMode()) arrows();
    const len = Math.hypot(x, y);
    return len > 0.08 ? { x: x / Math.max(1, len), y: y / Math.max(1, len), active: true } : { x: 0, y: 0, active: false };
  }

  function applyThrusterAndTempo(f, sideIdx, dt) {
    if (!f || f.hp <= 0 || !f.dir || !matchEvo) return;
    const st = matchEvo.sides[sideIdx];
    const vec = (sideIdx === 0 || !isBotMode()) ? readHumanVector(sideIdx) : st.aiSteer;
    st.steerVec = vec;
    if (f.__evoAirborne) return;
    if (vec && vec.active) {
      const turn = 3.8 * dt;
      const nx = f.dir.x + vec.x * turn, ny = f.dir.y + vec.y * turn, nl = Math.hypot(nx, ny) || 1;
      f.dir.x = nx / nl; f.dir.y = ny / nl;
      if (Math.random() < 0.5) g.APEX_EVOLUTION_VFX?.recipes.thrusterPuff(f.x - vec.x * (f.radius || 75) * 0.9, f.y - vec.y * (f.radius || 75) * 0.9, Math.atan2(-vec.y, -vec.x), sideIdx === 0 ? '#ffb347' : '#5ce1ff');
    }
    let extra = 0;
    if ((f.__evoSpeedBoost || 0) > 0) { f.__evoSpeedBoost = Math.max(0, f.__evoSpeedBoost - dt); extra += 0.3; }
    if (st.overdriveLeft > 0) extra += 0.14;
    if (f.__evoStasis > 0) { f.__evoStasis -= dt; extra -= 0.55; }
    if (Math.abs(extra) > 0.01) { const s = S(), R = f.radius || 75, sp = f.speed || 520; f.x = clamp(f.x + f.dir.x * sp * extra * dt, R + 36, s - R - 36); f.y = clamp(f.y + f.dir.y * sp * extra * dt, R + 36, s - R - 36); }
    if (st.overdriveLeft > 0) { const ct = g.APEX_HERO_REWORK?.byCombatant?.(f); if (ct?.skills) for (const sl of ['A1', 'A2']) if (ct.skills[sl]?.cdLeft > 0) ct.skills[sl].cdLeft = Math.max(0, ct.skills[sl].cdLeft - dt * 0.55); }
  }

  // ── TACTICAL AI (four minds) ──────────────────────────────────────────────
  function timeToImpact(p, f) {
    const rx = f.x - p.x, ry = f.y - p.y, vx = p.vx || 0, vy = p.vy || 0, v2 = vx * vx + vy * vy;
    if (v2 < 1) return Infinity;
    const t = (rx * vx + ry * vy) / v2; if (t < 0) return Infinity;
    const cx = p.x + vx * t, cy = p.y + vy * t;
    return Math.hypot(cx - f.x, cy - f.y) < (f.radius || 75) + (p.radius || 8) + 10 ? t : Infinity;
  }
  function stepTacticalAi(dt) {
    if (!isBotMode() || !matchEvo) return;
    const bot = g.fighters?.[1], p1 = g.fighters?.[0];
    if (!bot || !p1 || bot.hp <= 0 || p1.hp <= 0) return;
    const st = matchEvo.sides[1], me = matchEvo.sides[0];
    const prof = AI_PROFILES[aiTier] || AI_PROFILES.veteran;
    const ULT = g.APEX_EVOLUTION_ULTIMATES;

    // Threat scan with time-to-impact (prediction quality scales by tier)
    let nearestTti = Infinity, threat = null;
    for (const p of g.projectiles || []) {
      if (!p || p.owner === bot || typeof p.x !== 'number') continue;
      const tti = timeToImpact(p, bot); if (tti < nearestTti) { nearestTti = tti; threat = p; }
    }
    for (const b of matchEvo.evoBolts) { if (b.sideIdx === 1) continue; const tti = timeToImpact(b, bot); if (tti < nearestTti) { nearestTti = tti; threat = b; } }

    // Reactive Aegis: tiers differ in WHEN they parry, not just how often
    if (st.aegisCd <= 0.01 && threat) {
      const window = 0.06 + prof.predict * 0.09;
      const heavyIncoming = !!(threat.heavy || threat.rail || threat.__mythic);
      if (nearestTti < window) {
        const chance = prof.parry * (heavyIncoming ? 1.25 : 1);
        if (Math.random() < chance) triggerAegis(1); else st.aegisCd = 0.35;
      }
    }

    // Overdrive policy
    if (st.sync >= 100 && st.overdriveLeft <= 0 && !ULT?.isActive?.(1)) {
      const d = Math.hypot(bot.x - p1.x, bot.y - p1.y);
      let fire = false;
      if (prof.odPolicy === 'asap') fire = true;
      else if (prof.odPolicy === 'close') fire = d < 560;
      else if (prof.odPolicy === 'punish') fire = (p1.hp / p1.maxHp < 0.5 || me.aegisCd > 2.5) && d < 620;
      else if (prof.odPolicy === 'counter') fire = ULT?.isActive?.(0) || me.aegisCd > 2.8 || (p1.hp / p1.maxHp < 0.42 && d < 600);
      st._odWait = (st._odWait || 0) + dt;
      if (fire && st._odWait > 0.2) { st._odWait = 0; triggerOverdrive(1); }
      else if (st._odWait > 9) { st._odWait = 0; triggerOverdrive(1); }
    }

    st.aiThinkCd -= dt;
    if (st.aiThinkCd > 0) return;
    st.aiThinkCd = prof.think;
    let tx = 0, ty = 0;
    const holder = g.APEX_ARSENAL?.weaponApi?.getHolder?.(bot);
    const unarmed = !holder || !holder.weaponId;
    const slots = g.APEX_ARSENAL?.state?.slots || [];
    let best = null, bestScore = -Infinity;
    for (const sl of slots) {
      if (!sl || (sl.phase !== 'REVEALED' && sl.phase !== 'HIDDEN' && sl.phase !== 'TELEGRAPH')) continue;
      const d = Math.hypot(sl.x - bot.x, sl.y - bot.y);
      const tierNum = sl.tier === 'T6' ? 6 : parseInt(String(sl.tier || 'T2').replace('T', ''), 10) || 2;
      const val = tierNum * 120 + (sl.__mythic ? 420 : 0);
      const contest = Math.hypot(sl.x - p1.x, sl.y - p1.y) < d ? -140 * prof.seek : 60;
      const score = val * (unarmed ? 1.7 : 0.8) - d * 0.9 + contest;
      if (score > bestScore) { bestScore = score; best = sl; }
    }
    const dx = p1.x - bot.x, dy = p1.y - bot.y, dist = Math.hypot(dx, dy) || 1;
    // Escape rival ultimate zones (grandmaster+)
    if (prof.arena > 0.6 && ULT?.isActive?.(0) && dist < 420) { tx -= (dx / dist) * 1.3; ty -= (dy / dist) * 1.3; }
    else if (best && (unarmed || best.__mythic || bestScore > 200)) { const bx = best.x - bot.x, by = best.y - bot.y, bl = Math.hypot(bx, by) || 1; tx += (bx / bl) * prof.seek; ty += (by / bl) * prof.seek; }
    else {
      // spacing with feints: grandmaster/nemesis fake an approach then strafe
      st.aiFeintT -= prof.think;
      if (st.aiFeintT <= 0 && Math.random() < prof.feint) st.aiFeintT = rnd(0.5, 1.1);
      const feinting = st.aiFeintT > 0;
      if (dist > 480) { tx += (dx / dist) * 0.6; ty += (dy / dist) * 0.6; }
      else if (dist < 210 || feinting) { const side = st._strafeSide || (st._strafeSide = Math.random() < 0.5 ? 1 : -1); tx += (-dy / dist) * 0.8 * side * prof.dodge; ty += (dx / dist) * 0.8 * side * prof.dodge; if (Math.random() < 0.08) st._strafeSide = -side; }
      // nemesis stays off the Lorentz line / out of vents (arena awareness)
      if (prof.arena > 0.3) { const hz = g.APEX_EVOLUTION_ARENAS?.hazardVector?.(bot); if (hz) { tx += hz.x * prof.arena; ty += hz.y * prof.arena; } }
    }
    // Lateral evasion against predicted impacts
    if (threat && nearestTti < 0.45 + prof.predict * 0.3) { const vl = Math.hypot(threat.vx || 0, threat.vy || 1) || 1; const side = ((bot.x - threat.x) * (threat.vy || 0) - (bot.y - threat.y) * (threat.vx || 0)) > 0 ? 1 : -1; tx += (-(threat.vy || 0) / vl) * 1.4 * prof.dodge * side; ty += ((threat.vx || 0) / vl) * 1.4 * prof.dodge * side; }
    const mag = Math.hypot(tx, ty);
    st.aiSteer = mag > 0.12 ? { x: tx / mag, y: ty / mag, active: true } : { x: 0, y: 0, active: false };
  }

  // ── Mythic supply drop (canonical Arsenal slot lifecycle) ─────────────────
  function spawnFloorWeaponDirect(weaponId, x, y, mythic) {
    const state = g.APEX_ARSENAL?.state, CFG = g.APEX_ARSENAL_CONFIG;
    if (!state || !Array.isArray(state.slots)) return null;
    const slot = {
      id: state.nextSlotId++, x, y, phase: 'REVEALED', kind: 'WEAPON', weaponId,
      forceFirearm: false, questWeaponId: null, questStage: null, questPickupOwner: null, questNarrativeOnly: false,
      tier: CFG?.tierOf ? CFG.tierOf(weaponId) : null,
      revealLeadSeconds: 0, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: state.time,
      predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null,
      __mythic: !!mythic,
    };
    state.slots.push(slot); state.spawnedTotal = (state.spawnedTotal || 0) + 1;
    return slot;
  }
  function stepSupplyDrop(dt) {
    if (ruleset === 'tactical_lab') return;
    const sd = matchEvo.supplyDrop, s = S();
    if (!sd.pod && matchEvo.time >= sd.nextAt) {
      const pick = MYTHIC_POOL[Math.floor(Math.random() * MYTHIC_POOL.length)];
      sd.pod = { x: s * 0.5 + rnd(-150, 150), y: s * 0.5 + rnd(-150, 150), weaponId: pick, t: 0, dur: 3.0, landed: false };
      g.APEX_EVOLUTION_AUDIO?.playArenaEvent?.('mythic_drop');
      g.APEX_EVOLUTION_HUD?.arenaBanner?.({ title: 'MYTHIC INBOUND', sub: pick.replace(/_/g, ' ') + ' · ORBITAL POD', color: '#ff941f', seconds: 3.0, kind: 'warn' });
      highlight(`Mythic pod: ${pick.replace(/_/g, ' ')}`, '◆');
    } else if (sd.pod) {
      sd.pod.t += dt;
      g.APEX_EVOLUTION_SHADER?.pushLight?.(sd.pod.x, sd.pod.y, 1, 0.58, 0.14, 200, 0.5 + (sd.pod.t / sd.pod.dur) * 0.6);
      if (sd.pod.t >= sd.pod.dur && !sd.pod.landed) {
        sd.pod.landed = true;
        const slot = spawnFloorWeaponDirect(sd.pod.weaponId, sd.pod.x, sd.pod.y, true);
        g.APEX_EVOLUTION_VFX?.recipes.explosion(sd.pod.x, sd.pod.y, 48, sd.pod.y + 50);
        g.APEX_EVOLUTION_ARENAS?.addScar?.('scorch', sd.pod.x, sd.pod.y, 90);
        g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(sd.pod.x, sd.pod.y, 0.5, 300, 700, 1.0);
        g.cameraShake = Math.max(g.cameraShake || 0, 8);
        // knock both fighters back if standing on the pad
        for (const f of g.fighters || []) if (f && f.hp > 0 && Math.hypot(f.x - sd.pod.x, f.y - sd.pod.y) < 120) { const a = Math.atan2(f.y - sd.pod.y, f.x - sd.pod.x); f.x += Math.cos(a) * 60; f.y += Math.sin(a) * 60; }
        g.APEX_EVOLUTION_HUD?.arenaBanner?.({ title: 'MYTHIC LANDED', sub: 'CONTEST THE PAD', color: '#ffd166', seconds: 2.0, kind: 'active' });
        sd.lastSlot = slot;
        setTimeout(() => { sd.pod = null; }, 400);
        sd.nextAt = matchEvo.time + sd.cadence;
      }
    }
    // mythic pickup detection → stats + projectile tagging
    if (sd.lastSlot && sd.lastSlot.pickedBy && !sd.lastSlot.__counted) {
      sd.lastSlot.__counted = true;
      const idx = g.fighters?.indexOf(sd.lastSlot.pickedBy);
      if (idx === 0 || idx === 1) { matchEvo.sides[idx].mythicPickups++; addStyleAndSync(idx, 14, 12, 'mythic'); callout(sd.lastSlot.pickedBy.x, sd.lastSlot.pickedBy.y - 110, 'MYTHIC ARMED', '#ff941f', 1.1); highlight(`${idx === 0 ? 'P1' : 'P2'} secured the Mythic drop`, '◆'); }
    }
  }

  // ── bolts step ─────────────────────────────────────────────────────────────
  function stepBolts(dt) {
    const s = S();
    for (let i = matchEvo.evoBolts.length - 1; i >= 0; i--) {
      const b = matchEvo.evoBolts[i];
      b.life -= dt; if (b.life <= 0) { matchEvo.evoBolts.splice(i, 1); continue; }
      const target = g.fighters?.[1 - b.sideIdx];
      if (b.homing > 0 && target && target.hp > 0) { const want = Math.atan2(target.y - b.y, target.x - b.x), cur = Math.atan2(b.vy, b.vx); let diff = want - cur; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU; const nx = cur + clamp(diff, -b.homing * dt, b.homing * dt), sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(nx) * sp; b.vy = Math.sin(nx) * sp; }
      b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.trail && Math.random() < 0.9) g.APEX_EVOLUTION_VFX?.emit({ tex: 'glow', x: b.x, y: b.y, life: 0.18, s0: b.r * 2.4, s1: 2, tint: b.trail, a0: 0.8 });
      if (b.x < 34 || b.x > s - 34 || b.y < 34 || b.y > s - 34) { g.APEX_EVOLUTION_VFX?.recipes.impactSparks(clamp(b.x, 40, s - 40), clamp(b.y, 40, s - 40), 6, b.col, b.y + 20); b.life = 0; continue; }
      if (target && target.hp > 0 && distPointSeg(target.x, target.y, b.px, b.py, b.x, b.y) < (target.radius || 75) * 0.85 + b.r) {
        const owner = g.fighters?.[b.sideIdx];
        target.takeDamage?.(b.dmg, owner, 'Apex Overdrive');
        g.APEX_EVOLUTION_VFX?.recipes.impactSparks(b.x, b.y, 8, b.col, b.y + 40);
        g.APEX_EVOLUTION_SHADER?.pushLight?.(b.x, b.y, 1, 0.8, 0.4, 120, 0.8);
        if (!b.pierce) { matchEvo.evoBolts.splice(i, 1); } else { b.pierce = false; b.dmg *= 0.6; }
      }
    }
    // parried projectiles gain homing
    for (const p of g.projectiles || []) { if (!p || !p.__homing || typeof p.vx !== 'number') continue; const t = g.fighters?.find(f => f && f !== p.owner && f.hp > 0); if (!t) continue; const want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.vy, p.vx); let diff = want - cur; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU; const nx = cur + clamp(diff, -p.__homing * dt, p.__homing * dt), sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(nx) * sp; p.vy = Math.sin(nx) * sp; }
  }

  // ── BO3 series ─────────────────────────────────────────────────────────────
  function interceptRoundEnd(state) {
    if (ruleset !== 'championship_bo3' || !matchEvo || !state || !state.over || !evoActiveLoose()) return false;
    if (state.__evoRoundConsumed) return !state.__evoSeriesFinal;
    state.__evoRoundConsumed = true;
    const winnerIdx = state.winnerSide === 'P1' ? 0 : 1;
    if (winnerIdx === 0) series.p1Wins++; else series.p2Wins++;
    series.log.push({ round: series.round, winner: winnerIdx, time: matchEvo.time });
    const final = series.p1Wins >= 2 || series.p2Wins >= 2;
    state.__evoSeriesFinal = final;
    matchEvo.roundEnd = { winnerIdx, final, t: 0 };
    g.APEX_EVOLUTION_HUD?.roundResult?.({ round: series.round, winnerIdx, p1Wins: series.p1Wins, p2Wins: series.p2Wins, final });
    if (!final) {
      const p1Name = g.fighters?.[0]?.name, p2Name = g.fighters?.[1]?.name;
      series.round++;
      setTimeout(() => { try { g.startArsenalBattleMode(p1Name, p2Name, { __bo3NextRound: true }); } catch (e) { console.warn('[bo3]', e); } }, 2600);
      return true;
    }
    return false;
  }
  function evoActiveLoose() { const st = g.APEX_ARSENAL?.state; return !!(st && !st.labMode && !st.questMultiActor && !st.questStage); }

  // ── render overlays ────────────────────────────────────────────────────────
  function drawPodUnderlay(c) {
    const pod = matchEvo?.supplyDrop?.pod; if (!pod) return;
    const u = clamp(pod.t / pod.dur, 0, 1);
    c.save(); c.translate(pod.x, pod.y);
    const rg = c.createRadialGradient(0, 0, 6, 0, 0, 90); rg.addColorStop(0, `rgba(255,168,52,${0.15 + u * 0.4})`); rg.addColorStop(1, 'rgba(255,110,24,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 90, 0, TAU); c.fill();
    c.strokeStyle = '#ff9f1c'; c.lineWidth = 2.6; c.setLineDash([12, 8]); c.beginPath(); c.arc(0, 0, 70 - u * 20, matchEvo.time * 4, matchEvo.time * 4 + TAU); c.stroke(); c.setLineDash([]);
    // landing crosshair + pod descending shadow
    c.strokeStyle = `rgba(255,209,102,${0.4 + u * 0.6})`; c.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); c.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); c.stroke(); }
    c.fillStyle = `rgba(0,0,0,${0.15 + u * 0.4})`; c.beginPath(); c.ellipse(0, 10, 26 + u * 20, 12 + u * 9, 0, 0, TAU); c.fill();
    c.restore();
    // mythic halo on landed slots
    for (const sl of g.APEX_ARSENAL?.state?.slots || []) if (sl && sl.__mythic && sl.phase === 'REVEALED') { c.save(); c.translate(sl.x, sl.y); c.strokeStyle = `rgba(255,148,31,${0.5 + 0.4 * Math.sin(matchEvo.time * 8)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.stroke(); c.restore(); g.APEX_EVOLUTION_SHADER?.pushLight?.(sl.x, sl.y, 1, 0.6, 0.2, 150, 0.6); }
  }
  function drawPodOver(c) {
    const pod = matchEvo?.supplyDrop?.pod; if (!pod || pod.landed) return;
    const u = clamp(pod.t / pod.dur, 0, 1);
    const alt = (1 - u) * (1 - u) * 520;
    c.save(); c.translate(pod.x, pod.y - alt);
    // capsule
    c.fillStyle = '#1b2029'; c.strokeStyle = '#ff9f1c'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(-22, -34, 44, 68, 12); c.fill(); c.stroke();
    c.fillStyle = '#ff9f1c'; c.fillRect(-22, -6, 44, 12);
    c.fillStyle = `rgba(255,220,120,${0.6 + 0.4 * Math.sin(pod.t * 30)})`; c.beginPath(); c.arc(0, -18, 6, 0, TAU); c.fill();
    c.restore();
    if (Math.random() < 0.9) { g.APEX_EVOLUTION_VFX?.emit({ tex: 'fire', x: pod.x + rnd(-10, 10), y: pod.y - alt + 36, vx: rnd(-30, 30), vy: rnd(60, 140), life: 0.35, s0: 30, s1: 6, tint: '#ffb347' }); }
  }

  function drawEvolutionForeground(c) {
    if (!matchEvo || !evoActive()) return;
    const fighters = g.fighters || [], now = matchEvo.time;
    c.save();
    for (let idx = 0; idx < 2; idx++) {
      const f = fighters[idx]; if (!f || f.hp <= 0) continue;
      const st = matchEvo.sides[idx], R = f.radius || 75;
      const meta = HERO_ULTIMATE_META[heroIdOf(f)] || HERO_ULTIMATE_META.ROBOT;
      if (st.steerVec?.active && !f.__evoAirborne) {
        const back = Math.atan2(-st.steerVec.y, -st.steerVec.x);
        c.save(); c.translate(f.x + Math.cos(back) * R * 0.88, f.y + Math.sin(back) * R * 0.88); c.rotate(back); c.globalCompositeOperation = 'lighter';
        const fg = c.createLinearGradient(0, 0, 44, 0); fg.addColorStop(0, idx === 0 ? 'rgba(255,200,90,0.95)' : 'rgba(110,230,255,0.95)'); fg.addColorStop(1, 'rgba(255,110,24,0)');
        c.fillStyle = fg; c.beginPath(); c.moveTo(0, -10); c.lineTo(38 + Math.sin(now * 42) * 8, 0); c.lineTo(0, 10); c.closePath(); c.fill(); c.restore();
      }
      if (st.aegisWindow > 0) {
        const a = clamp(st.aegisWindow / 0.24, 0, 1);
        c.save(); c.translate(f.x, f.y); c.rotate(now * 6); c.strokeStyle = `rgba(126,244,255,${0.45 + a * 0.55})`; c.fillStyle = `rgba(92,225,255,${0.14 * a})`; c.lineWidth = 3.8;
        c.beginPath(); for (let k = 0; k < 6; k++) { const ang = (k / 6) * TAU, rx = Math.cos(ang) * (R + 22), ry = Math.sin(ang) * (R + 22); if (k === 0) c.moveTo(rx, ry); else c.lineTo(rx, ry); } c.closePath(); c.fill(); c.stroke();
        // facet glints
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const ang = (k / 6) * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang) * (R + 22), Math.sin(ang) * (R + 22)); c.stroke(); }
        c.restore();
      }
      if (st.momentum > 0) { c.save(); c.translate(f.x, f.y); c.strokeStyle = `rgba(255,209,102,${st.momentum * 0.5})`; c.lineWidth = 2; c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, R + 10, -now * 8, -now * 8 + TAU); c.stroke(); c.restore(); }
      if (st.overdriveLeft > 0) { c.save(); c.translate(f.x, f.y); c.strokeStyle = meta.color; c.lineWidth = 3; c.globalAlpha = 0.7 + 0.25 * Math.sin(now * 16); c.setLineDash([18, 10]); c.beginPath(); c.arc(0, 0, R + 18, now * 5, now * 5 + TAU); c.stroke(); c.restore(); g.APEX_EVOLUTION_SHADER?.pushLight?.(f.x, f.y, meta.rgb[0], meta.rgb[1], meta.rgb[2], 190, 0.75); }
      if (f.__evoCloak) { c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 0.55; c.beginPath(); c.arc(f.x, f.y, R * 1.05, 0, TAU); c.fill(); c.restore(); }
    }
    g.APEX_EVOLUTION_ULTIMATES?.drawOver?.(c);
    // bolts
    for (const b of matchEvo.evoBolts) {
      c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx)); c.globalCompositeOperation = 'lighter';
      if (b.rail) { const lg = c.createLinearGradient(-b.r * 9, 0, b.r * 1.5, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.7, b.col); lg.addColorStop(1, '#ffffff'); c.fillStyle = lg; c.beginPath(); c.ellipse(-b.r * 3.5, 0, b.r * 5.5, b.r * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, 0, b.r * 1.6, b.r * 0.55, 0, 0, TAU); c.fill(); }
      else if (b.shard) { c.rotate(Math.PI / 2); g.APEX_EVOLUTION_VFX?.drawShard(c, b.r * 2.6, b.r, b.col === '#bff5ff' ? 195 : 275, 1); }
      else { c.shadowColor = b.col; c.shadowBlur = 12; c.fillStyle = '#fff'; c.strokeStyle = b.col; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, b.r * 2.1, b.r * 0.72, 0, 0, TAU); c.fill(); c.stroke(); }
      c.restore();
    }
    for (const p of g.projectiles || []) {
      if (!p || typeof p.x !== 'number') continue;
      if (p.__solarIgnited) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,148,31,0.7)'; c.beginPath(); c.arc(p.x, p.y, (p.radius || 7) * 1.9, 0, TAU); c.fill(); c.restore(); g.APEX_EVOLUTION_SHADER?.pushLight?.(p.x, p.y, 1, 0.52, 0.1, 95, 0.65); if (Math.random() < 0.6) g.APEX_EVOLUTION_VFX?.recipes.trailEmber(p.x, p.y, '#ff9f1c'); }
      else if (p.__parriedBy) { c.save(); c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, (p.radius || 7) * 2.1, 0, TAU); c.stroke(); c.restore(); g.APEX_EVOLUTION_SHADER?.pushLight?.(p.x, p.y, 1, 0.85, 0.35, 110, 0.85); }
      else if (p.__lorentzBoosted) { if (Math.random() < 0.7) g.APEX_EVOLUTION_VFX?.emit({ tex: 'spark', x: p.x, y: p.y, life: 0.15, s0: 18, s1: 4, tint: '#72efdd', rot: Math.atan2(p.vy || 0, p.vx || 1) }); }
    }
    drawPodOver(c);
    // KO speed lines converge on the finisher point
    if (matchEvo.ko) { const k = matchEvo.ko; const u = clamp(k.t / 0.9, 0, 1); g.APEX_EVOLUTION_VFX?.drawSpeedLines(c, k.x, k.y, S(), (1 - u) * 0.9, 'rgba(255,255,255,0.85)'); }
    c.restore();
  }

  // ── engine seam installation ──────────────────────────────────────────────
  function installEngineHooks() {
    if (installEngineHooks._done) return;
    if (typeof g.update !== 'function' || typeof g.draw !== 'function' || typeof g.Fighter !== 'function') return;
    installEngineHooks._done = true;

    const origTakeDamage = g.Fighter.prototype.takeDamage;
    g.Fighter.prototype.takeDamage = function evoTakeDamage(amount, source, label, statusDamage) {
      if (evoActive() && matchEvo && amount > 0 && !statusDamage) {
        const victimIdx = g.fighters?.[1] === this ? 1 : 0;
        const attackerIdx = g.fighters?.[1] === source ? 1 : g.fighters?.[0] === source ? 0 : -1;
        const vst = matchEvo.sides[victimIdx];
        if (vst && vst.aegisWindow > 0.03) {
          vst.aegisWindow = 0;
          celebratePerfectParry(this, victimIdx, vst, this.x, this.y, 'clash');
          if (source && source !== this && source.dir) { const ang = Math.atan2(source.y - this.y, source.x - this.x); source.dir.x = Math.cos(ang); source.dir.y = Math.sin(ang); source.__evoSpeedBoost = 0.5; source.applyStatus?.('stun', 0.35); }
          return 0;
        }
        let amt = amount;
        if (vst && vst.lateGuard > 0) { amt *= 0.5; vst.lateGuard = 0; callout(this.x, this.y - 90, 'GUARD', '#5ce1ff', 0.85); }
        if (attackerIdx >= 0 && matchEvo.sides[attackerIdx].momentum > 0) amt *= 1.25;
        const pre = this.hp;
        const res = origTakeDamage.call(this, amt, source, label, statusDamage);
        const realized = Math.max(0, pre - this.hp);
        if (realized > 0) {
          addStyleAndSync(victimIdx, 2, realized * 0.05);
          if (attackerIdx >= 0) { const ast = matchEvo.sides[attackerIdx]; ast.damageDealt += realized; if (realized > ast.biggestHit) ast.biggestHit = realized; addStyleAndSync(attackerIdx, clamp(realized * 0.14, 3, 20), realized * 0.11, label && /Overdrive|Jet|Meteor|Supernova|Eclipse|Zero|Refraction/.test(String(label)) ? 'ult' : 'hit'); }
          if (realized >= 110) { g.APEX_EVOLUTION_ARENAS?.addScar?.('scorch', this.x, this.y, clamp(realized * 0.35, 32, 85)); g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(this.x, this.y, clamp(realized / 360, 0.22, 0.55), 250, 680, 0.9); g.APEX_EVOLUTION_VFX?.recipes.impactSparks(this.x, this.y, 12, '#ffb347', this.y + 50); }
          if (this.hp <= 0 && !matchEvo.ko) {
            matchEvo.ko = { x: this.x, y: this.y, t: 0, winnerIdx: 1 - victimIdx, loserIdx: victimIdx, label: String(label || '') };
            g.cameraZoom = 1.1; g.cameraShake = 18;
            cinematic({ zoom: 1.12, dilation: 0.18, hold: 0.9 });
            g.APEX_EVOLUTION_SHADER?.spawnShockwave?.(this.x, this.y, 0.9, 700, 720, 1.5);
            g.APEX_EVOLUTION_VFX?.recipes.explosion(this.x, this.y, 60, this.y + 60);
            g.APEX_EVOLUTION_HUD?.koSequence?.(matchEvo.ko, matchEvo, series);
            g.APEX_EVOLUTION_AUDIO?.playKo?.();
          }
        }
        return res;
      }
      return origTakeDamage.apply(this, arguments);
    };

    if (typeof g.startArsenalBattleMode === 'function') {
      const origStart = g.startArsenalBattleMode;
      g.startArsenalBattleMode = function evoStart(p1Name, p2Name, options) {
        const ok = origStart.apply(this, arguments);
        if (ok && evoActive()) resetMatchEvolution(!!(options && options.__bo3NextRound));
        return ok;
      };
    }

    const origDrawBg = g.drawBackground;
    g.drawBackground = function evoDrawBackground(c) {
      if (evoActive() && g.APEX_EVOLUTION_ARENAS) {
        g.APEX_EVOLUTION_ARENAS.drawArenaFloor(c, S());
        g.APEX_FROST_PRESENTATION?.renderArenaAmbience?.(c);
        g.APEX_ARSENAL?.feel?.drawStain?.(c);
        g.APEX_ARSENAL_STORM?.drawFloor?.(c);
        g.APEX_FROST_PRESENTATION?.renderSurfaceUnderWeapons?.(c);
        if (matchEvo) { g.APEX_EVOLUTION_ULTIMATES?.drawUnder?.(c); drawPodUnderlay(c); }
        g.APEX_EVOLUTION_VFX?.draw?.(c, 'under');
        g.APEX_ARSENAL_SPAWN?.drawSlots?.(c);
        return;
      }
      return origDrawBg.apply(this, arguments);
    };

    const origUpdate = g.update;
    g.update = function evoUpdate(dt) {
      if (!evoActive()) return origUpdate.apply(this, arguments);
      if (!matchEvo) resetMatchEvolution(false);
      const raw = Math.min(0.05, Math.max(0, dt));
      // cinematic time dilation
      const cine = matchEvo.cine;
      if (cine.hold > 0) cine.hold -= raw; else cine.dilation = lerp(cine.dilation, 1, clamp(raw * 6, 0, 1));
      cine.zoom = lerp(cine.zoom, 1, clamp(raw * 2.2, 0, 1));
      if (cine.zoom > 1.001) g.cameraZoom = Math.max(g.cameraZoom || 1, cine.zoom);
      const effDt = raw * cine.dilation;
      matchEvo.time += effDt;
      for (let idx = 0; idx < 2; idx++) {
        const st = matchEvo.sides[idx];
        st.aegisCd = Math.max(0, st.aegisCd - effDt);
        st.lateGuard = Math.max(0, st.lateGuard - effDt);
        st.momentum = Math.max(0, st.momentum - effDt);
        if (st.aegisWindow > 0) { st.aegisWindow = Math.max(0, st.aegisWindow - effDt); if (g.fighters?.[idx]) sweepParryProjectiles(g.fighters[idx], idx, st); }
        st.overdriveLeft = Math.max(0, st.overdriveLeft - effDt);
        st.styleScore = Math.max(0, st.styleScore - effDt * 4.0);
        if (st.overdriveLeft <= 0) st.sync = clamp(st.sync + effDt * 2.0, 0, 100);
      }
      if (!matchEvo.ko) stepTacticalAi(effDt);
      if (g.fighters?.[0]) applyThrusterAndTempo(g.fighters[0], 0, effDt);
      if (g.fighters?.[1]) applyThrusterAndTempo(g.fighters[1], 1, effDt);
      g.APEX_EVOLUTION_ARENAS?.stepArenaMechanics?.(effDt);
      g.APEX_EVOLUTION_ULTIMATES?.step?.(effDt);
      stepBolts(effDt); stepSupplyDrop(effDt);
      g.APEX_EVOLUTION_VFX?.step?.(effDt);
      for (let i = matchEvo.callouts.length - 1; i >= 0; i--) { const co = matchEvo.callouts[i]; co.life -= effDt; co.y += co.vy * effDt; co.vy *= 0.92; if (co.life <= 0) matchEvo.callouts.splice(i, 1); }
      if (matchEvo.ko) matchEvo.ko.t += raw;
      const res = origUpdate.call(this, effDt);
      const st = g.APEX_ARSENAL?.state;
      if (st?.over && !matchEvo.reportedToDb) { matchEvo.reportedToDb = true; g.APEX_EVOLUTION_HUD?.reportCompletedMatch?.(matchEvo, series); }
      return res;
    };

    const origDraw = g.draw;
    g.draw = function evoDraw() {
      const res = origDraw.apply(this, arguments);
      if (evoActive() && g.ctx) {
        const cam = g.__apexCameraView || { shakeX: 0, shakeY: 0, zoom: 1 }, s = S();
        const applyCam = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.translate(s / 2 + (cam.shakeX || 0), s / 2 + (cam.shakeY || 0)); c.scale(cam.zoom || 1, cam.zoom || 1); c.translate(-s / 2, -s / 2); };
        g.ctx.save(); applyCam(g.ctx);
        drawEvolutionForeground(g.ctx);
        g.ctx.restore();
        g.APEX_EVOLUTION_VFX?.drawInCamera?.(g.ctx, 'over', applyCam);
        g.ctx.setTransform(1, 0, 0, 1, 0, 0); g.ctx.globalAlpha = 1; g.ctx.globalCompositeOperation = 'source-over';
      }
      g.APEX_EVOLUTION_SHADER?.stepAndComposite?.(1 / 60);
      return res;
    };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) return;
      keysHeld.add(e.code);
      if (!evoActive() || e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyL') { e.preventDefault(); triggerAegis(0); }
      else if (e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'KeyU') { e.preventDefault(); triggerOverdrive(0); }
      else if (!isBotMode() && (e.code === 'Enter' || e.code === 'Numpad0' || e.code === 'ShiftRight')) { e.preventDefault(); triggerAegis(1); }
      else if (!isBotMode() && (e.code === 'Slash' || e.code === 'KeyO' || e.code === 'NumpadDecimal')) { e.preventDefault(); triggerOverdrive(1); }
    });
    window.addEventListener('keyup', (e) => keysHeld.delete(e.code));
    window.addEventListener('blur', () => keysHeld.clear());
  }
  installEngineHooks();
  const hookTimer = setInterval(() => { installEngineHooks(); if (installEngineHooks._done) clearInterval(hookTimer); }, 120);

  g.APEX_EVOLUTION_COMBAT = {
    evoActive,
    getRuleset: () => ruleset,
    setRuleset(n) { if (['standard', 'mythic_mayhem', 'championship_bo3', 'tactical_lab'].includes(n)) { ruleset = n; try { localStorage.setItem('apexEvolution.ruleset', n); } catch (_) {} } return ruleset; },
    getAiTier: () => aiTier,
    setAiTier(n) { if (AI_PROFILES[n]) { aiTier = n; try { localStorage.setItem('apexEvolution.aiTier', n); } catch (_) {} } return aiTier; },
    aiProfiles: AI_PROFILES,
    getState: () => matchEvo, getSeries: () => series,
    currentRank, STYLE_RANKS,
    heroUltMeta: (id) => HERO_ULTIMATE_META[id] || HERO_ULTIMATE_META.ROBOT,
    triggerAegis, triggerOverdrive, spawnFloorWeaponDirect, spawnBolt, callout, cinematic, addStyleAndSync, highlight, interceptRoundEnd, heroIdOf,
    setTouchVector(active, x, y) { touchVec.active = !!active; touchVec.x = clamp(Number(x) || 0, -1, 1); touchVec.y = clamp(Number(y) || 0, -1, 1); },
    onWallBounce(f, sideIdx, nx, ny) {
      if (!matchEvo) return;
      const st = matchEvo.sides[sideIdx];
      if (st?.steerVec?.active) {
        f.__evoSpeedBoost = Math.max(f.__evoSpeedBoost || 0, 0.6); st.ricochets++;
        addStyleAndSync(sideIdx, 7, 6.5, 'ricochet');
        g.APEX_EVOLUTION_AUDIO?.playRicochetBoost?.();
        g.APEX_EVOLUTION_VFX?.recipes.impactSparks(f.x - nx * (f.radius || 75), f.y - ny * (f.radius || 75), 10, sideIdx === 0 ? '#ffb347' : '#5ce1ff', f.y + 40);
        if (st.ricochets % 3 === 0) callout(f.x, f.y - 100, 'RICOCHET!', sideIdx === 0 ? '#ffb347' : '#5ce1ff', 0.95);
      }
    },
    onArenaEvent(kind, x, y) { if (!matchEvo) return; matchEvo.arenaEvents++; },
  };
  g.apexEvolutionCombatRuntime = 'ready';
})(window);
