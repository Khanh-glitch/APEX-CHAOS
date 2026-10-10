// ARSENAL BATTLE — weapon registry + holder-state runtime.
// Data-driven definitions; no scattered string-conditionals in the engine.
// Reuses Apex globals: projectiles, particles, floatingTexts, shockwaves, cameraShake,
// hitStop, FloatingText, emitParticles, spawnShockwave, triggerFlash, playFighterSound.
(function apexArsenalWeaponRuntime() {
  if (window.apexArsenalWeaponRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const log = (event, fields) => AQ.log(event, fields);

  // ---------------------------------------------------------------------------
  // Holder state (handoff §9): one object answers weapon id / phase / ammo /
  // elapsed timers / consumed flag. Lives on fighter.data.arsenal.
  // ---------------------------------------------------------------------------
  function getHolder(f) { return (f && f.data && f.data.arsenal) || null; }
  function shieldBoundGone(h) {
    if (!h || !h.meta) return true;
    const ownerId = h.meta.boundOwnerId;
    const wId = h.meta.boundWeaponId;
    if (ownerId == null || !wId) return h.meta.timer <= 0;
    const owner = (typeof fighters !== 'undefined' ? fighters : []).find((x) => x && x.id === ownerId);
    if (!owner || owner.hp <= 0) return true;
    const oh = getHolder(owner);
    if (oh && oh.weaponId === wId) return false;
    if (typeof projectiles !== 'undefined' && projectiles.some((p) => p && p.aq && p.weapon === wId && p.owner && p.owner.id === ownerId && p.life > 0)) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // V2 B-handoff PART 2 — independent weapon pose state (Checkpoint B).
  // Motion comes from the equipped weapon sprite/pose, never from rewriting
  // fighter movement: every recipe below only moves/rotates/scales the WEAPON.
  // weaponPose = { aimAngle(on meta), recoil, rotKick, localX, localY,
  //                scaleX, scaleY, flourish, pulses, t }
  // recoil: positive = kickback along -aim; negative = forward pop.
  const POSE_RECIPES = {
    // B1 Pistol: 3 visually countable pulses, 12-16px kickback, fast spring.
    PISTOL:       { recoilPx: 14, rotKick: 0.10, returnTau: 0.05 },
    // B2 Shotgun: one heavy 24-32px recoil, larger rotational kick, slow settle.
    SHOTGUN:      { recoilPx: 28, rotKick: 0.24, returnTau: 0.17 },
    // B3 SMG: 8 micro pulses synced to fire interval, alternating jitter.
    SMG:          { recoilPx: 10, rotKick: 0.055, returnTau: 0.045, alternate: true },
    // B4 Sniper: stylized spin during latter aim, snap on target, long recoil.
    SNIPER:       { recoilPx: 34, rotKick: 0.16, returnTau: 0.20, flourishAfter: 0.55, flourishTurns: 1.5 },
    // B5 Grenade: backward draw -> forward throw (grenade leaves the hand pose).
    GRENADE:      { drawBack: 18, throwFwd: 30, throwTime: 0.34, throwRot: 0.5 },
    // B6 Sabre: backswing then fast cut/snap (no imported slash VFX).
    SABRE:        { windupRot: -0.85, strikeRot: 0.45, returnTau: 0.10 },
    // B7 Battle Axe: pronounced raise/windup, heavy chop, slower recovery.
    BATTLE_AXE:   { windupRot: -1.25, windupLift: 12, strikeRot: 0.75, returnTau: 0.20 },
    // B8 Dagger: weapon-only straight thrust, 60-90px extension, quick retract.
    DAGGER:       { thrustPx: 78, returnTau: 0.07 },
    // B9 Spear: long narrow thrust, 90-120px extension, controlled return.
    SPEAR:        { thrustPx: 108, returnTau: 0.14 },
    // B10 Spiked Club: backswing + blunt smash, heavier easing than blades.
    SPIKED_CLUB:  { windupRot: -1.00, strikeRot: 0.62, returnTau: 0.17 },
    // B11 Swirl Shield: idle settle; reflect = brief forward pop/tilt.
    SWIRL_SHIELD: { idleSettle: 0.05, reflectPop: 16, reflectRot: 0.22, returnTau: 0.10 },
    // B12 Tower Shield: forward guard pose; block = shield-only pushback/tilt.
    TOWER_SHIELD: { guardForward: 12, blockPop: 12, blockRot: 0.14, returnTau: 0.12 },
    // B13 Stormbreaker (red tier): heavy raised windup, then the weapon
    // LEAVES the hand along the aim (grenade-style forward throw) and scales
    // out — no axe lingers in the hand after the release.
    STORMBREAKER: { windupRot: -1.35, windupLift: 16, throwFwd: 46, throwTime: 0.22, throwRot: 0.6, returnTau: 0.14 },
    // V4.3 special devices share the SAME Arsenal pose springs and recoil.
    FLARE_GUN: { recoilPx: 16, rotKick: .12, returnTau: .13 },
    TACTICAL_CROSSBOW: { recoilPx: 12, rotKick: .08, returnTau: .16 },
    STEEL_BALL_LAUNCHER: { recoilPx: 25, rotKick: .23, returnTau: .21 },
    COMBAT_BOOMERANG: { windupRot: -.8, windupLift: 10, returnTau: .18 },
    RPG_7: { recoilPx: 34, rotKick: .20, returnTau: .28 },
    FLAMETHROWER: { recoilPx: 5, rotKick: .035, returnTau: .09 },
    PLASMA_SPLITTER: { windupRot: -.12, recoilPx: 24, rotKick: .16, returnTau: .22 },
    SHRAPNEL_MINE_LAUNCHER: { recoilPx: 26, rotKick: .20, returnTau: .21 },
  };
  // POST-C §3: registry guns have no hand-authored recipe — derive one from
  // the firing family so every staged gun gets sensible weapon-only motion.
  const FAMILY_POSE = {
    SEMI: { recoilPx: 12, rotKick: 0.08, returnTau: 0.055 },
    AUTO: { recoilPx: 9, rotKick: 0.05, returnTau: 0.045, alternate: true },
    BURST: { recoilPx: 11, rotKick: 0.07, returnTau: 0.05, alternate: true },
    PRECISION: { recoilPx: 30, rotKick: 0.15, returnTau: 0.18, flourishAfter: 0.5, flourishTurns: 1.2 },
    SHOTGUN: { recoilPx: 26, rotKick: 0.22, returnTau: 0.16 },
    AUTOSHOT: { recoilPx: 20, rotKick: 0.16, returnTau: 0.10, alternate: true },
  };
  function poseRecipe(id) {
    return POSE_RECIPES[id]
      || FAMILY_POSE[(CFG.WEAPONS[id] || {}).family]
      || { returnTau: 0.08 };
  }
  function makePose() {
    return { recoil: 0, rotKick: 0, localX: 0, localY: 0, scaleX: 1, scaleY: 1, flourish: 0, pulses: 0, t: 0 };
  }
  // One recoil pulse (guns). alternate flips rotational jitter sign per pulse.
  function poseKick(h, recipe) {
    const p = h && h.meta && h.meta.pose;
    if (!p || !recipe) return;
    const sign = recipe.alternate ? (p.pulses % 2 === 0 ? 1 : -1) : 1;
    p.recoil = recipe.recoilPx || 0;
    p.rotKick = (recipe.rotKick || 0) * sign;
    p.pulses += 1;
  }
  // Per-frame pose integration: springs toward the weapon-set targets. Runs
  // BEFORE weapon update so same-frame set values are authoritative.
  function integratePose(h, dt) {
    const p = h.meta.pose || (h.meta.pose = makePose());
    const recipe = poseRecipe(h.weaponId);
    p.t += dt;
    const tau = Math.max(0.01, recipe.returnTau || 0.08);
    const k = Math.min(1, dt / tau);
    // Melee windup holds a rotational target while WINDUP; everything springs to 0.
    const windupHold = h.phase === 'WINDUP' && recipe.windupRot != null;
    const rotTarget = windupHold ? recipe.windupRot : 0;
    p.rotKick += (rotTarget - p.rotKick) * Math.min(1, dt / (windupHold ? 0.05 : tau));
    p.recoil += (0 - p.recoil) * k;
    if (!p.directLocalX) p.localX += ((p.localTargetX || 0) - p.localX) * k;
    else p.directLocalX = false;
    const liftTarget = (h.phase === 'WINDUP' && recipe.windupLift) ? -recipe.windupLift : 0;
    p.localY += (liftTarget - p.localY) * k;
    p.scaleX += (1 - p.scaleX) * k;
    p.scaleY += (1 - p.scaleY) * k;
    // Sniper flourish decays to 0 (snap onto target) unless the weapon re-sets it.
    if (!p.holdFlourish) p.flourish += (0 - p.flourish) * Math.min(1, dt / 0.02);
    else p.holdFlourish = false;
  }
  // Pose ghosts: consume() snapshots the pose so recoil settles / throws /
  // thrust returns stay visible for a beat after the weapon leaves the hand.
  // Presentation-only; no gameplay reads these.
  function snapshotPoseGhost(f, h) {
    if (!f || !f.data || !h || !h.meta) return;
    const spec = (CFG.WEAPONS && CFG.WEAPONS[h.weaponId]) || {};
    const profile = (CFG.EXIT_PROFILES && spec.exit && CFG.EXIT_PROFILES[spec.exit]) || null;
    const aim = h.meta.aimAngle != null ? h.meta.aimAngle : Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const legacySpin = ({ PISTOL: 3.2, SMG: 3.8, SHOTGUN: -3.4, SNIPER: 2.0, SABRE: 2.6, BATTLE_AXE: -2.2, DAGGER: 1.8, SPEAR: 1.2, SPIKED_CLUB: -2.6 })[h.weaponId] || 0;
    const life = profile ? profile.life : 0.38;
    const cat = (h.def && h.def.category) || '';
    const isGun = cat === 'ranged' && h.weaponId !== 'GRENADE';
    if (isGun) {
      const pose = h.meta.pose || {};
      const r = f.radius || 75;
      const offset = r * 0.78 + (pose.localX || 0) - (pose.recoil || 0);
      const lateral = pose.localY || 0;
      const x = f.x + Math.cos(aim) * offset + Math.cos(aim + Math.PI / 2) * lateral;
      const y = f.y + Math.sin(aim) * offset + Math.sin(aim + Math.PI / 2) * lateral;
      const vxRel = profile ? profile.vx : 40;
      const vyRel = profile ? profile.vy : -180;
      const g = profile ? profile.g : 1500;
      const spin = profile ? profile.spin : legacySpin;
      if (!AQ.state.detachedWeapons) AQ.state.detachedWeapons = [];
      AQ.state.detachedWeapons.push({
        weaponId: h.weaponId,
        x, y,
        vx: Math.cos(aim) * vxRel,
        vy: Math.sin(aim) * vxRel + vyRel,
        rot: aim + (pose.rotKick || 0),
        spin,
        g,
        t: 0,
        life,
        maxLife: life,
        bounced: false,
        exitKey: spec.exit || null,
        ownerId: f.id,
        originX: x,
        originY: y,
      });
      f.data.arsenalFade = {
        weaponId: h.weaponId, exitKey: spec.exit || null, detached: true,
        t: 0, life, maxLife: life,
        pose: Object.assign(makePose(), h.meta.pose || {}),
        aimAngle: aim, category: cat,
      };
    } else {
      f.data.arsenalFade = {
        weaponId: h.weaponId,
        category: cat,
        aimAngle: aim,
        pose: Object.assign(makePose(), h.meta.pose || {}),
        t: 0,
        life,
        maxLife: life,
        drop: 0,
        dropV: profile ? profile.vy : -30,
        exitRot: profile ? profile.spin : legacySpin,
        exitVx: profile ? profile.vx : 0,
        exitG: profile ? profile.g : 1500,
        exitKey: spec.exit || null,
        lateral: 0,
      };
    }
    if (profile && (profile.hulls || spec.hullOnExit)) {
      const n = profile.hulls || 1;
      for (let i = 0; i < n; i++) ejectCasing(f, aim, 1.6, h.weaponId, true);
    }
  }

  function tickDetachedWeapons(dt) {
    const list = AQ.state && AQ.state.detachedWeapons;
    if (!list) return;
    const floor = (typeof GAME_SIZE === 'number' ? GAME_SIZE : 1000) - 28;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.t += dt;
      d.life -= dt;
      d.vy += (d.g || 1500) * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += (d.spin || 0) * dt;
      if (!d.bounced && d.vy > 0 && d.y > floor) {
        d.y = floor;
        d.vy *= -0.38;
        d.vx *= 0.55;
        d.bounced = true;
      }
      if (d.life <= 0) list.splice(i, 1);
    }
  }
  function advancePoseGhost(ghost, dt) {
    if (!ghost) return;
    const r = poseRecipe(ghost.weaponId);
    const p = ghost.pose;
    ghost.t += dt;
    ghost.life -= dt;
    if (ghost.weaponId === 'GRENADE') {
      // Backward draw already happened pre-throw; ghost animates the forward
      // throw so the grenade visibly leaves from the weapon/hand pose.
      const u = Math.min(1, ghost.t / (r.throwTime || 0.34));
      p.localX = -(r.drawBack || 18) + ((r.drawBack || 18) + (r.throwFwd || 30)) * u * u;
      p.rotKick = -(r.throwRot || 0.5) * (1 - u);
    } else if (ghost.weaponId === 'STORMBREAKER') {
      // Heavy release: the red-tier body visibly leaves the hand along the
      // aim and scales out as the real thrown projectile takes over — no
      // second axe remains in the hand (locked impact/vanish identity).
      const u = Math.min(1, ghost.t / (r.throwTime || 0.22));
      p.localX = (r.throwFwd || 46) * u * u;
      p.rotKick = (r.throwRot || 0.6) * (1 - u);
      p.scaleX = Math.max(0, 1 - u);
      p.scaleY = p.scaleX;
    } else if (ghost.weaponId === 'SPEAR' || ghost.weaponId === 'DAGGER') {
      // Thrust out-and-return: extension peaks at thrustPx then retracts.
      const u = Math.min(1, ghost.t / 0.30);
      p.localX = (r.thrustPx || 80) * Math.sin(u * Math.PI);
    } else {
      const k = Math.min(1, dt / Math.max(0.01, r.returnTau || 0.1));
      p.recoil += (0 - p.recoil) * k;
      p.rotKick += (0 - p.rotKick) * k;
    }
    // C §3.2 physical exit: the consumed weapon drops/rotates away (guns flick
    // off, heavies throw down), shields physically retract, the grenade scales
    // out along the throw. Alpha cleanup happens only in the final 15%
    // (drawPoseGhost), never as the primary consume read.
    if (ghost.weaponId === 'GRENADE') {
      const u = Math.min(1, ghost.t / (r.throwTime || 0.34));
      p.scaleX = Math.max(0.2, 1 - u * 0.8);
      p.scaleY = p.scaleX;
    } else if (ghost.weaponId === 'STORMBREAKER') {
      // Release is a forward scale-out, never a gravity drop.
    } else if (ghost.category === 'defense') {
      const u = Math.min(1, ghost.t / ghost.maxLife);
      p.scaleX = Math.max(0.5, 1 - u * 0.6);
      p.scaleY = p.scaleX;
      ghost.drop = (ghost.drop || 0) + 50 * dt;
    } else {
      ghost.dropV = (ghost.dropV == null ? -30 : ghost.dropV) + 1500 * dt;
      ghost.drop = (ghost.drop || 0) + ghost.dropV * dt;
      if (ghost.exitRot) p.rotKick += ghost.exitRot * dt;
    }
  }
  function tickPoseGhost(f, dt) {
    const g = f && f.data && f.data.arsenalFade;
    if (!g) return;
    if (g.detached) {
      g.t += dt;
      g.life -= dt;
      if (g.life <= 0) f.data.arsenalFade = null;
      return;
    }
    advancePoseGhost(g, dt);
    if (g.life <= 0) f.data.arsenalFade = null;
  }

  function makeCtx(f) {
    let enemy = (typeof fighters !== 'undefined' && fighters)
      ? fighters.find(q => q && q !== f) || null
      : null;
    // HERO REWORK (doc-06): audited body-aware enemy resolution. With the
    // rework layer active, resolve the nearest living enemy BODY (SLIME
    // children are valid auto-targets) and honor SNIPER aim-lost. Returns
    // undefined when no rework match exists -> base resolution is untouched.
    // Q4C: preview-only registered rig holder uses a NON-COMBATANT
    // aim marker. All real Fighter targeting and HR semantics are untouched.
    if (AQ.state?.questRivetPreview?.operator === f) {
      enemy = AQ.state.questRivetPreview.aimPoint;
    } else if (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.resolveEnemyBody) {
      const resolved = window.APEX_HERO_REWORK.resolveEnemyBody(f, enemy);
      if (resolved !== undefined) enemy = resolved;
    }
    return { fighter: f, enemy, holder: getHolder(f), api: weaponApi };
  }

  function equip(f, weaponId) {
    const def = WEAPONS[weaponId];
    if (!f || f.hp <= 0 || !def) return false;
    f.data.arsenal = {
      weaponId,
      def,
      phase: 'READY',
      elapsed: 0,
      shotsFired: 0,
      consumed: false,
      meta: { pose: makePose() },
    };
    // C §3.1 anticipation beat: the weapon arrives offset (raised/cocked) and
    // the pose spring settles it into ready — never an instant static equip.
    // POST-C §3: registry guns take their beat from the firing family.
    const ANTICIPATION = {
      PISTOL: [10, -0.10], SMG: [10, -0.06], SHOTGUN: [16, -0.20], SNIPER: [18, -0.10],
      SABRE: [8, -0.30], BATTLE_AXE: [10, -0.50], DAGGER: [6, -0.20],
      SPEAR: [8, -0.20], SPIKED_CLUB: [10, -0.40],
      STORMBREAKER: [16, -0.55],
    };
    const FAMILY_ANTICIPATION = {
      SEMI: [10, -0.10], AUTO: [10, -0.06], BURST: [10, -0.08],
      PRECISION: [18, -0.10], SHOTGUN: [16, -0.20], AUTOSHOT: [14, -0.16],
    };
    const ant = ANTICIPATION[weaponId] || FAMILY_ANTICIPATION[def.family];
    if (ant) { f.data.arsenal.meta.pose.localY = ant[0]; f.data.arsenal.meta.pose.rotKick = ant[1]; }
    if (def.onEquip) def.onEquip(makeCtx(f));
    playFighterSound(f, 'wall');
    // POST-C §8: no floating name text on the arena canvas — the pickup pop
    // (particles + shockwave + SFX) carries the moment instead.
    window.avCue('pickup', { x: f.x, y: f.y, weapon: weaponId });
    return true;
  }

  function consume(f, reason) {
    const h = getHolder(f);
    if (!h) return;
    h.consumed = true;
    snapshotPoseGhost(f, h);
    if (h.def.cleanup) { try { h.def.cleanup(makeCtx(f)); } catch (error) { console.warn('[ARSENAL] weapon cleanup failed', h.weaponId, error); } }
    f.data.arsenal = null; // holder returns to UNARMED; no stale owner/target refs remain
    log('CONSUME', `fighter=${f.name} weapon=${h.weaponId}${reason ? ` reason=${reason}` : ''}`);
  }

  function defColor(def) {
    return def.category === 'ranged' ? '#ffd479' : def.category === 'melee' ? '#ff9d7a' : '#9fd8ff';
  }

  // ---------------------------------------------------------------------------
  // Damage pipeline — single entry point so Tower Shield / logging / feedback
  // stay consistent (handoff §8 reuse policy).
  // ---------------------------------------------------------------------------
  function rollFirearmCrit(weaponId) {
    if (!(CFG.isGun && CFG.isGun(weaponId))) return false;
    const p = (CFG.CRIT_CHANCE && CFG.CRIT_CHANCE[weaponId]) || 0;
    const rng = (window.APEX_ARSENAL && window.APEX_ARSENAL.combatRng) || Math.random;
    return rng() < p;
  }
  function scaleEquipmentDamage(amount, weaponId, critical) {
    let dmg = amount;
    const gun = CFG.isGun && CFG.isGun(weaponId);
    const melee = CFG.isMelee && CFG.isMelee(weaponId);
    // B1 final-authority values: weapons with an explicit audited
    // confirmedHitDamage (red-tier STORMBREAKER: 446) define the FINAL
    // per-hit damage on a 1000 HP match directly — they ride the ONE damage
    // path (CFG.meleeDamage -> aqDamage -> takeDamage) but are explicitly
    // exempt from the x7 Arsenal equipment scale. Regular STORMBREAKER is
    // still equipment (red-tier, deliberately not a MELEE_IDS entry), so the
    // scale applies to every weapon EXCEPT the final-authority set.
    const finalAuthority = !!(CFG.WEAPONS[weaponId] &&
      (CFG.WEAPONS[weaponId].confirmedHitDamage != null ||
       CFG.WEAPONS[weaponId].finalDamage === true));
    if (!finalAuthority && (gun || melee || weaponId === 'GRENADE' || weaponId === 'STORMBREAKER')) dmg *= (CFG.ARSENAL_DAMAGE_SCALE || 1);
    if (critical && gun) dmg *= (CFG.CRIT_DAMAGE_MULTIPLIER || 1.5);
    return dmg;
  }
  function aqDamage(target, amount, source, weaponId, opts = {}) {
    // A late weapon transaction must not injure either training Fighter
    // after the genuine E01 rescue threshold. This checks the REAL receipt
    // gate, not a UI flag, and is inactive in every non-REFLEX match.
    if(AQ.state?.questReflex===true
      &&AQ.state.questReflexGate?.snapshot()?.awaitingRivet===true)return 0;
    if (!target || target.hp <= 0 || target.withdrawn===true || !(amount > 0)) return 0;
    // Native Quest team, including withdrawn allies; ordinary Free Battle unaffected.
    if(AQ.state?.questMultiActor===true && source?.questTeam && target.questTeam
      &&source.questTeam===target.questTeam)return 0;
    amount = scaleEquipmentDamage(amount, weaponId, !!opts.critical);
    let mult = 1;
    const th = getHolder(target);
    if (th && th.weaponId === 'TOWER_SHIELD' && th.phase === 'GUARD') {
      mult = CFG.WEAPONS.TOWER_SHIELD.damageTakenMult;
      // POST-C §8: the guard read is particles + pose + SFX, not a word.
      emitParticles(target.x, target.y, '#9fd8ff', 12, 240, 4, 0.35, 'square');
      const srcAngle = source && source !== target ? Math.atan2(source.y - target.y, source.x - target.x) : 0;
      window.avCue('tower_block', { x: target.x + Math.cos(srcAngle) * target.radius, y: target.y + Math.sin(srcAngle) * target.radius, angle: srcAngle, heavy: amount >= 10 });
      if (th.meta && th.meta.pose) { // B12: short shield-only pushback/tilt
        th.meta.pose.recoil = poseRecipe('TOWER_SHIELD').blockPop;
        th.meta.pose.rotKick = poseRecipe('TOWER_SHIELD').blockRot;
      }
    }
    // E01 pilot last-resort safety: keep BOTH training participants alive
    // until accepted J/K + half-HP receipts. Scoped to Quest REFLEX only;
    // all normal Arsenal weapon physics, percentages and crits unchanged.
    const reflexFloor=AQ.state?.questReflex===true
      && (target.questId==='NEWBOT'||target.questId==='T.O.T') ? 250 : 0;
    const dealt=reflexFloor>0
      ? Math.min(amount*mult,Math.max(0,target.hp-reflexFloor))
      : amount*mult;
    if(!(dealt>0))return 0;
    if (target) {
      target.__aqHitCrit = !!opts.critical;
      // V1 blood port §6: real firearm impact metadata rides next to the crit
      // flag (null for melee / grenade / native — they keep accepted behavior).
      target.__aqImpact = opts.impact || null;
      target.__aqResultSource=opts.resultSource||null;
    }
    const hpBefore=target.hp;
    target.takeDamage(dealt, source && source !== target ? source : null, `arsenal-${(weaponId || 'unknown').toLowerCase()}`, !!opts.statusDamage);
    const actual=Math.max(0,hpBefore-target.hp);
    if(actual>0&&mult<1)AQ.state?.resultLedger?.onBlocked?.(target,amount*(1-mult));
    // F1 PROVENANCE CORRECTION: __aqImpact is a TRANSIENT, transaction-scoped
    // marker. It is set immediately above and consumed synchronously inside
    // takeDamage (Robot armored-hit direction/point, MIRROR shard provenance,
    // AQ feel note). Clear it exactly once when the transaction unwinds so a
    // stale impact can never leak into a later direct/status/non-impact damage
    // event. Every set is paired with this synchronous clear.
    if (target){target.__aqImpact = null;target.__aqResultSource=null;}
    if (opts.knockback && source && source !== target && target.hp > 0) {
      const n = opts.impactDirection && Number.isFinite(opts.impactDirection.x)
        ? norm(opts.impactDirection.x,opts.impactDirection.y)
        : norm(target.x - source.x || 1, target.y - source.y);
      target.applyStatus('push', opts.knockbackSeconds || 0.18, { x: n.x, y: n.y, strength: opts.knockback });
    }
    if (opts.stun && target.hp > 0) target.applyStatus('stun', opts.stun, {});
    if(actual>0&&target.hp>0&&(opts.knockback||opts.stun))
      AQ.state?.resultLedger?.onControl?.(source,target);
    if (opts.shake) cameraShake = Math.max(cameraShake, opts.shake);
    if (opts.hitStop) hitStop = Math.max(hitStop, opts.hitStop);
    log('HIT', `source=${(source && source.name) || 'world'} target=${target.name} weapon=${weaponId || 'world'} damage=${dealt.toFixed(1)}`);
    return dealt;
  }

  // ---------------------------------------------------------------------------
  // Projectile helpers — Arsenal projectiles live in the shared global
  // `projectiles` collection with aq_* types (handoff §8). Movement/hit logic
  // is in updateArsenalProjectiles below; life/cleanup reuse the engine path.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // V1 blood port (docs/arsenal-quest/v1-blood-port/): exact swept
  // segment-vs-circle intersection, same math as the approved executable
  // reference. Used ONLY to resolve the real firearm collision point for VFX;
  // damage math is untouched.
  // ---------------------------------------------------------------------------
  function sweptSegmentCircleHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (!(a > 0)) return null;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a);
    let t = null;
    if (t1 >= 0 && t1 <= 1) t = t1; else if (t2 >= 0 && t2 <= 1) t = t2;
    return t === null ? null : { x: x1 + dx * t, y: y1 + dy * t };
  }

  function fireBullet(spec) {
    // HERO REWORK (doc-06): single audited hook — the rework layer may retarget
    // (SNIPER predictive intercept), boost speed (MAGNET passive), roll distance
    // crit (SNIPER passive) and record the emission (TIME loop) before the push.
    // Returns a tag object attached to the projectile (null = untouched).
    const __hrTag = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.onFireBullet)
      ? window.APEX_HERO_REWORK.onFireBullet(spec)
      : null;
    const { owner, x, y, angle, speed, damage, weapon } = spec;
    if (!Number.isFinite(angle) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(speed)) return;
    const wspec = CFG.WEAPONS[weapon] || {};
    const family = wspec.family || (weapon === 'SNIPER' ? 'PRECISION' : weapon === 'SHOTGUN' ? 'SHOTGUN' : weapon === 'SMG' ? 'AUTO' : 'SEMI');
    AQ.state?.resultLedger?.onShot?.(owner,weapon);
    projectiles.push({
      type: 'aq_bullet',
      aq: true,
      owner,
      weapon,
      critical: !!spec.critical,
      family,
      heavy: family === 'PRECISION',
      x, y,
      px: x, py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: spec.radius || 7,
      damage,
      life: spec.life || 2.2,
      maxLife: spec.life || 2.2,
      knockback: spec.knockback || 0,
      stun: spec.stun || 0,
      color: spec.color || (owner && owner.color) || '#ffffff',
      resultFinalShot:!!spec.finalShot,
      resultMirrorCopy:!!getHolder(owner)?.__hrMirrorCopy,
      resultMagnetPulled:!!AQ.state?.resultLedger?.onMagnetQualifiedHolder?.(owner,getHolder(owner)),
      __hr: __hrTag,
    });
  }

  // C §eject: spent casing leaves the port on every shot — open-mouth brass
  // arc/spin/fall with bounded life (presentation owns the physics).
  function ejectCasing(f, angle, power, weaponId, forceHull) {
    const spec = (CFG.WEAPONS && weaponId && CFG.WEAPONS[weaponId]) || {};
    if (spec.noCasing && !forceHull) return;
    const rear = angle + Math.PI;
    const side = angle + Math.PI / 2 + (Math.random() * 0.7 - 0.35);
    const mix = 0.55 + Math.random() * 0.35;
    const dirx = Math.cos(side) * mix + Math.cos(rear) * (1 - mix);
    const diry = Math.sin(side) * mix + Math.sin(rear) * (1 - mix);
    const origin = weaponId ? weaponWorldAnchor(f, weaponId, 'casing', angle) : null;
    const bx = origin ? origin.x : (f.x + Math.cos(angle) * (f.radius * 0.35) + dirx * 14);
    const by = origin ? origin.y : (f.y + Math.sin(angle) * (f.radius * 0.35) + diry * 14);
    const sp = (140 + Math.random() * 110) * (power || 1) * (spec.casingFan || 1);
    window.avCue('casing', {
      x: bx, y: by,
      vx: dirx * sp + Math.cos(rear) * 40,
      vy: diry * sp + Math.sin(rear) * 40 - 80,
      rot: Math.random() * TAU,
      vrot: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 7),
      weapon: weaponId,
      usedMeta: !!(origin && origin.usedMeta),
      hull: !!forceHull,
      shotgun: !!(weaponId === 'SHOTGUN' || weaponId === 'MOSSBERG_500' || weaponId === 'SAWED_OFF' || weaponId === 'JACKHAMMER'),
    });
  }

  function throwGrenade(spec) {
    // HERO REWORK (doc-06): audited recording hook for TIME loop replay.
    const __hrTag = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.onGrenade)
      ? window.APEX_HERO_REWORK.onGrenade(spec)
      : null;
    const { owner, x, y, angle, speed, weapon } = spec;
    projectiles.push({
      type: 'aq_grenade',
      aq: true,
      owner,
      weapon,
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 16,
      fuse: CFG.WEAPONS.GRENADE.fuse,
      life: CFG.WEAPONS.GRENADE.fuse + 0.6,
      maxLife: CFG.WEAPONS.GRENADE.fuse + 0.6,
      color: '#6d8f4e',
      __hr: __hrTag,
    });
  }

  function explodeGrenade(p) {
    const spec = CFG.WEAPONS.GRENADE;
    // HERO REWORK (doc-06): audited body-aware splash — SLIME child Bodies
    // are valid splash targets but never live in the global fighters[].
    // Without the rework layer this is exactly the base fighters iteration.
    const splashTargets = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.splashTargets)
      ? window.APEX_HERO_REWORK.splashTargets(p.owner)
      : undefined;
    const questCore=window.APEX_QUEST_MULTI_ACTOR_CORE;
    const splashList=AQ.state?.questMultiActor===true
      ?(questCore?.splashEnemies?.(p.owner,fighters)||[])
      :(splashTargets||fighters);
    for (const f of splashList) {
      if (!f || f.hp <= 0 || f === p.owner) continue;
      const d = dist(p.x, p.y, f.x, f.y);
      if (d > spec.blastRadius + f.radius * 0.4) continue;
      const falloff = clamp(1 - d / (spec.blastRadius + f.radius * 0.4), 0, 1);
      aqDamage(f, spec.maxDamage * falloff, p.owner, p.weapon || 'GRENADE', { knockback: spec.knockback * falloff, shake: 14, hitStop: 0.05 });
    }
    spawnShockwave(p.x, p.y, '#ffb347', 260);
    triggerFlash(255, 170, 60, 0.22);
    emitParticles(p.x, p.y, '#ffcf7a', 42, 620, 8, 0.7, 'square');
    emitParticles(p.x, p.y, '#8a5a2b', 26, 380, 6, 0.9, 'friction');
    playFighterSound(p.owner || 'VOLCANO', 'skill');
    window.avCue('explosion', { x: p.x, y: p.y });
    log('EXPLODE', `weapon=GRENADE x=${Math.round(p.x)} y=${Math.round(p.y)}`);
    p.life = 0;
  }


  // ---------------------------------------------------------------------------
  // V4.3 SPECIAL PHYSICS — single engine authority; never Lab/fixture damage.
  // All eight handlers inherit identity/tier/pool from CFG.V43_WEAPONS.
  // aq_v43 projectile bodies use real swept collision; hits ALWAYS pass
  // through aqDamage/Fighter.takeDamage, never virtual HP.
  // ---------------------------------------------------------------------------
  const V43=CFG.V43_WEAPONS||{};
  const v43min=(n,a,b)=>Math.max(a,Math.min(b,n));
  const v43Normalize=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
  function v43Enemies(owner){
    const list=AQ.state?.questMultiActor===true
      ?window.APEX_QUEST_MULTI_ACTOR_CORE?.livingEnemies?.(owner,fighters)
      :fighters.filter(f=>f&&f!==owner&&f.hp>0);
    return (list||[]).filter(f=>f&&f.hp>0&&f.withdrawn!==true
      &&(!AQ.state?.questMultiActor||f.questTeam!==owner?.questTeam));
  }
  // All collision consumers (Fighter + Crystal + Magnet) observe the ONE
  // ordered frame path. A kinetic V4.3 bullet bent by Magnet A2 cannot test
  // the fake straight frame-start -> endpoint chord (which tunnels barriers).
  function v43Hit(p,from,to){
    const geom=window.APEX_HERO_REWORK?.geom;
    const curved=!!(p.__hr?.pathPoly||p.__hr?.pathVia);
    const segs=curved&&geom?.pathSegments?.(p)||[{
      x0:from.x,y0:from.y,x1:to.x,y1:to.y,t0:0,t1:1
    }];
    const tip=(V43[p.weapon]?.tipOffset)||0;
    let best=null,bestT=Infinity;
    for(const seg of segs){
      const ang=Math.atan2(seg.y1-seg.y0,seg.x1-seg.x0);
      const leadX=Math.cos(ang)*tip,leadY=Math.sin(ang)*tip;
      const fromN={x:seg.x0+leadX,y:seg.y0+leadY};
      const toN={x:seg.x1+leadX,y:seg.y1+leadY};
      const length=Math.hypot(toN.x-fromN.x,toN.y-fromN.y)||1;
      const consider=(hit)=>{
        if(!hit?.actor)return;
        const sx=hit.x??toN.x,sy=hit.y??toN.y;
        const frac=v43min(Math.hypot(sx-fromN.x,sy-fromN.y)/length,0,1);
        const t=(seg.t0??0)+frac*((seg.t1??1)-(seg.t0??0));
        if(t<bestT){bestT=t;best={actor:hit.actor,x:sx,y:sy,t};}
      };
      if(AQ.state?.questMultiActor===true){
        consider(window.APEX_QUEST_MULTI_ACTOR_CORE?.firstProjectileHit?.({
          owner:p.owner,actors:fighters,from:fromN,to:toN,
          projectileRadius:p.radius||8,bodyRadiusScale:CFG.BULLET_HIT_RADIUS_SCALE
        }));
      }else{
        for(const fighter of v43Enemies(p.owner)){
          const radius=fighter.radius*CFG.BULLET_HIT_RADIUS_SCALE+(p.radius||8);
          const hit=sweptSegmentCircleHit(fromN.x,fromN.y,toN.x,toN.y,
            fighter.x,fighter.y,radius);
          if(hit)consider({actor:fighter,x:hit.x,y:hit.y});
        }
      }
    }
    return best;
  }
  function v43Pulse(x,y,kind,scale=1,weapon=null){
    const duration=kind==='blast'?.85:kind==='split'?.58:.40;
    if(AQ.state?.visuals) pushVisual({kind:'v43_'+kind,x,y,
      life:duration,maxLife:duration,scale,weapon});
    // Kinetic impact, metal wall bounce and return are NOT 400px orange
    // grenade detonations. Reserve the native explosion atlas for actual AOE.
    if(kind==='blast')window.avCue?.('explosion',{x,y,weapon:'V43_'+kind});
    else if(kind==='ricochet')window.avCue?.('ricochet',{x,y,weapon:'STEEL_BALL_LAUNCHER'});
  }
  // One resolved projectile carries one damage scalar through reflection,
  // ricochet, delayed split, ignite and fragment offspring. Never restore a
  // pre-reflection config peak after Crystal's passive already reduced it.
  function v43Redirected(p){return !!(p.__hr?.crystalReflected||p.aqReflected);}
  function v43DamageScale(p,base){return p.__hr?.crystalReflected
    ?v43min((p.damage||0)/Math.max(1e-6,base),0,2):1;}
  // Single V4.3 post-hit adapter: the ONLY damage authority remains
  // aqDamage -> Fighter.takeDamage. This receipt reports REAL hp loss through
  // the exact Crystal afterBodyHit/notBodyHit route ordinary aq_bullet uses.
  // The source marker also makes Gold result-ledger reflected damage visible.
  function v43Deal(p,target,amount,opts={}){
    const before=target?.hp??0;
    const applied=aqDamage(target,amount,p.owner,p.weapon,{
      ...opts,
      resultSource:opts.resultSource||{
        crystal:!!p.__hr?.crystalReflected,
        mirror:!!p.resultMirrorCopy,magnet:!!p.resultMagnetPulled,
        final:!!p.resultFinalShot
      }
    });
    const realized=Math.max(0,before-(target?.hp??0));
    if(realized>0){
      const crystal=window.APEX_CRYSTAL;
      crystal?.noteBodyHit?.(p,target);
      crystal?.afterBodyHit?.(p,target,realized);
    }
    return applied;
  }
  function v43Splash(p,peak,radius){
    const targets=v43Enemies(p.owner);
    for(const f of targets){
      const d=Math.hypot(f.x-p.x,f.y-p.y);
      // Nearest surface counts as in-blast; center is max, outer edge zero.
      const range=radius+(f.radius||75)*.25;
      // RPG nose-contact is on a fighter's *surface*, not its centre.
      // The outgoing rocket must still deal its ~161 HP direct-hit peak;
      // a centre-distance falloff previously halved a perfectly landed hit.
      // Mines retain their authored centre-to-centre AOE/falloff.
      const factor=v43min(1-d/range,0,1); // Original mine centre-falloff law
      const surfaceGap=Math.max(0,d-(f.radius||75)*CFG.BULLET_HIT_RADIUS_SCALE);
      const rocketFactor=v43min(1-surfaceGap/range,0,1);
      if(p.kind==='rocket'){
        if(rocketFactor<=0)continue;
        v43Deal(p,f,peak*rocketFactor,{
          knockback:320*rocketFactor,shake:5*rocketFactor,hitStop:.012});
      }else{
        if(factor<=0)continue;
        v43Deal(p,f,peak*factor,{
          knockback:320*factor,shake:5*factor,hitStop:.012});
      }
    }
    v43Pulse(p.x,p.y,'blast',radius/95,p.weapon);
  }
  function v43Muzzle(f,weaponId,angle){
    // One owner-authored Gold muzzle follows the exact rendered held art.
    // The former radial estimate was off the sprite, especially when left.
    const h=getHolder(f);
    const sameArt=window.APEX_ARSENAL_AV?.weaponMuzzleWorld?.(f,h,angle);
    if(sameArt&&Number.isFinite(sameArt.x)&&Number.isFinite(sameArt.y))
      return {x:sameArt.x,y:sameArt.y};
    // AV must normally be preloaded by Arsenal's gameplay barrier.
    // Missing art is never permission to fabricate an independent muzzle:
    // retain a deterministic fighter source only for cold-boot resilience.
    const dir=Math.cos(angle),side=Math.sin(angle),r=f.radius||75;
    return {x:f.x+dir*r*.78,y:f.y+side*r*.78};
  }
  function v43Spawn(f,id,kind,angle,extra={}){
    const c=V43[id],m=v43Muzzle(f,id,angle),speed=extra.speed??c.speed??c.shardSpeed??650;
    const p={aq:true,type:'aq_v43',kind,weapon:id,owner:f,launchOwner:f,
      x:m.x,y:m.y,px:m.x,py:m.y,ox:m.x,oy:m.y,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
      angle,spin:0,age:0,life:extra.life??3,maxLife:extra.life??3,
      radius:extra.radius??c.radius??8,damage:extra.damage??c.direct??0,
      phase:extra.phase||'flight',hits:new Set(),bounces:0,visual:[{x:m.x,y:m.y,t:0}],
      ...extra};
    projectiles.push(p);return p;
  }
  function v43ApplyBurn(target, owner, weapon, ticks, interval, damage, parent=null) {
    if (!target || target.hp <= 0) return;
    const burn={aq:true,type:'aq_v43',kind:'burn',owner,weapon,victim:target,
      x:target.x,y:target.y,age:0,life:ticks*interval+.15,
      maxLife:ticks*interval+.15,tickCount:0,burnTicks:ticks,
      burnInterval:interval,burnDamage:damage};
    if(parent?.__hr?.crystalReflected)burn.__hr={
      crystalReflected:true,cryOwner:parent.__hr.cryOwner,neutral:false};
    projectiles.push(burn);
  }
  function v43FlameHit(p,dt){
    const c=V43.FLAMETHROWER;
    // Continuous weapon-relative emission: each particle records the live
    // muzzle pose at birth; old particles keep their original world positions.
    const h=getHolder(p.owner),aim=h?.meta?.aimAngle;
    if(Number.isFinite(aim))p.angle=aim;
    const muzzle=v43Muzzle(p.owner,p.weapon,p.angle);
    p.x=muzzle.x;p.y=muzzle.y;
    if(!p.flameOrigins)p.flameOrigins=[];
    p.flameOrigins.push({time:p.age,x:p.x,y:p.y,angle:p.angle});
    if(p.flameOrigins.length>90)p.flameOrigins.shift();
    p.ticks=p.ticks||0;
    while(p.ticks<c.ticks){
      const due=c.tickStart+p.ticks*c.tickInterval;
      if(p.age+1e-6<due)break;
      const dir=p.angle;
      for(const f of v43Enemies(p.owner)){
        const dx=f.x-p.owner.x,dy=f.y-p.owner.y,d=Math.hypot(dx,dy);
        const off=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-dir),
          Math.cos(Math.atan2(dy,dx)-dir)));
        if(d<=c.range+(f.radius||75)*.2
          &&off<=c.cone+Math.asin(v43min((f.radius||75)*.35/Math.max(d,1),0,1))){
          v43Deal(p,f,c.tickDamage,{knockback:26});
          if(!p.burnRecipients)p.burnRecipients=new Set();
          if(!p.burnRecipients.has(f)){
            p.burnRecipients.add(f);
            v43ApplyBurn(f,p.owner,p.weapon,c.burnTicks,c.burnInterval,c.burnDamage,p);
          }
        }
      }
      p.ticks++;
    }
    if(p.ticks>=c.ticks)p.life=0;
  }
  // A fast, physically legible, TARGET-AIMED throw. Launch direction is fixed
  // at release (no cheating homing); outward leg crosses the enemy's recorded
  // center. Return bends around the target, then reconnects to launch origin.
  function v43MakeFlightPath(x,y,angle){
    // Ported from owner's *actual* V4.3 NATURAL_FLIGHT Gold HTML.
    // Target contributes to the INITIAL aiming angle only; trajectory shape
    // and tangential speed NEVER sample the opponent after release.
    const direction={x:Math.cos(angle),y:Math.sin(angle)};
    const cross={x:-direction.y,y:direction.x};
    const size=typeof GAME_SIZE==='number'?GAME_SIZE:1000;
    const bank=y>size*.45?1:-1;
    // The Gold Lab runs left-to-right; generalize available forward arena
    // distance along the shot direction so BOTH Arena players get the same
    // Gold 400..490px aerodynamic loop when their positions are mirrored.
    const dx=direction.x,dy=direction.y;
    const forwardX=Math.abs(dx)>.05?(dx>0?(size-x)/dx:-x/dx):1e6;
    const forwardY=Math.abs(dy)>.05?(dy>0?(size-y)/dy:-y/dy):1e6;
    const available=Math.max(0,Math.min(forwardX,forwardY));
    const distance=v43min(available*.77,400,490);
    const world=(u,v)=>({x:x+direction.x*u+cross.x*v*bank,
      y:y+direction.y*u+cross.y*v*bank});
    const a=world(0,0),b=world(distance,-50),c=world(distance*.49,-160);
    const legs=[
      [a,world(distance*.24,-1),world(distance*.73,-10),b],
      [b,world(distance*1.27,-92),world(distance*1.03,-167),c],
      [c,world(distance*-.05,-153),world(distance*.15,-19),a],
    ];
    const cubic=(v0,v1,v2,v3,t)=>{
      const u=1-t;return u*u*u*v0+3*u*u*t*v1+3*u*t*t*v2+t*t*t*v3;
    };
    const points=[{...a,s:0}],samples=80;
    let length=0,far=0,farX=-Infinity;
    for(const leg of legs)for(let i=1;i<=samples;i++){
      const t=i/samples,p={x:cubic(leg[0].x,leg[1].x,leg[2].x,leg[3].x,t),
        y:cubic(leg[0].y,leg[1].y,leg[2].y,leg[3].y,t)};
      const prior=points[points.length-1];
      length+=Math.hypot(p.x-prior.x,p.y-prior.y);
      points.push({...p,s:length});
      const longitudinal=(p.x-x)*direction.x+(p.y-y)*direction.y;
      if(longitudinal>farX){farX=longitudinal;far=length;}
    }
    return {points,total:length,far,farX,origin:{x,y},launchAngle:angle,
      bank,distance,apexProgress:far/Math.max(1e-6,length),
      revision:'NO_TARGET_WAYPOINTS_V43'};
  }
  function v43PathAt(path,distance){
    const pts=path.points,d=v43min(distance,0,path.total);
    let lo=0,hi=pts.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(pts[mid].s<d)lo=mid;else hi=mid;}
    const a=pts[lo],b=pts[hi],t=(d-a.s)/Math.max(1e-6,b.s-a.s);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,
      heading:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  function v43BoomerangCurvature(path,travel){
    const a=v43PathAt(path,travel-18),b=v43PathAt(path,travel+18);
    return Math.abs(Math.atan2(Math.sin(b.heading-a.heading),
      Math.cos(b.heading-a.heading)))/36;
  }
  function v43Step(p,dt){
    const c=V43[p.weapon];
    if(!c||!p.owner||p.owner.hp<=0||AQ.state?.over){p.life=0;return;}
    if(p.__hr?.cryHold)return;
    p.age+=dt; // Engine updateProjectiles owns every projectile's lifetime.
    // Magnet publishes a swept, force-integrated A2 path for kinetic specials.
    // Consume it once (normal bullets already consume theirs in Hero Rework).
    const magnetPlan=window.APEX_MAGNET?.consumeMovementPlan?.(p)||null;
    if(!magnetPlan&&p.__hr){p.__hr.pathVia=null;p.__hr.pathPoly=null;}
    if(p.kind==='boomerang'&&magnetPlan)p.magnetReleased=true;
    if(p.kind==='flame'){v43FlameHit(p,dt);return;}
    if(p.kind==='mine'&&p.phase==='armed'){
      p.armAge=(p.armAge||0)+dt;
      // Floor mine waits for a true opponent contact; timer only limits idle lifetime.
      if(v43Enemies(p.owner).some(f=>
        Math.hypot(f.x-p.x,f.y-p.y)<=c.triggerRadius+(f.radius||75)*.25)){
        v43Splash(p,p.damage??c.peak,c.blastRadius);
        // One explosion, one shared per-victim fragment budget: no target
        // can ever receive more than 2 of the 8 shrapnel impacts.
        const fragmentGroup={victimHits:new Map()};
        for(let i=0;i<c.fragments;i++){
          const angle=i*Math.PI*2/c.fragments;
          const child=v43Spawn(p.owner,p.weapon,'fragment',angle,{x:p.x,y:p.y,
            px:p.x,py:p.y,radius:4,
            damage:c.fragmentDamage*v43DamageScale(p,c.peak),fragmentGroup,
            life:.55,vx:Math.cos(angle)*c.fragmentSpeed,vy:Math.sin(angle)*c.fragmentSpeed});
          if(p.__hr?.crystalReflected)child.__hr={
            crystalReflected:true,cryOwner:p.__hr.cryOwner,neutral:false};
        }
        p.life=0;
      }
      return;
    }
    if(p.kind==='mine'&&p.phase==='flight'){
      const v=Math.hypot(p.vx,p.vy),next=Math.max(0,v-c.drag*dt);
      if(v>0){p.vx*=next/v;p.vy*=next/v;}
      if(p.age>=c.flightMax||next<=40){p.vx=0;p.vy=0;p.phase='arming';p.age=0;}
    }else if(p.kind==='mine'&&p.phase==='arming'){
      if(p.age>=c.armSeconds){p.phase='armed';p.armAge=0;}
      return;
    }
    if(p.kind==='plasma'&&p.homing&&!v43Redirected(p)){
      const target=v43Enemies(p.owner).reduce((best,f)=>!best||
        Math.hypot(f.x-p.x,f.y-p.y)<Math.hypot(best.x-p.x,best.y-p.y)?f:best,null);
      if(target){
        const want=Math.atan2(target.y-p.y,target.x-p.x),now=Math.atan2(p.vy,p.vx);
        const diff=Math.atan2(Math.sin(want-now),Math.cos(want-now));
        const aim=now+v43min(diff,-c.shardTurnRate*dt,c.shardTurnRate*dt);
        p.vx=Math.cos(aim)*c.shardSpeed;p.vy=Math.sin(aim)*c.shardSpeed;
      }
    }
    // Crystal reflected boomerang is now a free ballistic projectile: the
    // original owner's precomputed return spline cannot override Crystal's
    // outgoing vector or magically change the new owner's trajectory.
    if(p.kind==='boomerang'&&(v43Redirected(p)||p.magnetReleased)){
      p.phase='redirected';p.homing=false;p.spin=(p.spin||0)+c.spin*dt;
      const original=getHolder(p.launchOwner);
      if(original?.weaponId===p.weapon)original.meta.v43Interrupted=true;
    }
    if(p.kind==='bolt'){
      const sp=Math.hypot(p.vx,p.vy)||1;
      const ns=Math.min(c.maxSpeed,sp+c.acceleration*dt);
      p.vx=p.vx/sp*ns;p.vy=p.vy/sp*ns;
    }
    if(p.kind==='rocket'){
      const dir=Math.atan2(p.vy,p.vx);
      if(AQ.state?.visuals&&p.age<3.3)pushVisual({kind:'v43_smoke',
        x:p.x-Math.cos(dir)*35,y:p.y-Math.sin(dir)*35,
        angle:dir,seed:p.age*41,life:.68,maxLife:.68,scale:.88});
      const sp=Math.hypot(p.vx,p.vy)||1;
      const ns=Math.min(c.maxSpeed,sp+c.acceleration*dt);
      p.vx=p.vx/sp*ns;p.vy=p.vy/sp*ns;
    }
    if(p.kind==='flare'){
      const m=Math.max(0,1-c.drag*dt);
      p.vx*=m;p.vy*=m;
    }
    if(p.kind==='boomerang'&&!v43Redirected(p)&&!p.magnetReleased){
      // Gold V4.3 NATURAL_FLIGHT: three cubic legs, true arc-length
      // integration, centrifugal curve-drag and bounded acceleration.
      // No opponent tracking, no constant-time spline teleport.
      const path=p.flightPath;
      if(!path){p.life=0;return;}
      const u=p.travel/Math.max(1e-6,path.total);
      const curvature=v43BoomerangCurvature(path,p.travel);
      const desired=v43min(c.cruise+65*Math.sin(Math.PI*v43min(u,0,1))
        -curvature*c.curveDrag-100*u,c.minTurnSpeed,c.maxTurnSpeed);
      p.speed+=v43min(desired-p.speed,-c.accelLimit*dt,c.accelLimit*dt);
      const lastTravel=p.travel;
      p.travel=Math.min(path.total,p.travel+p.speed*dt);
      const q=v43PathAt(path,p.travel);
      p.px=p.x;p.py=p.y;
      p.x=q.x;p.y=q.y;p.angle=q.heading;
      p.vx=(p.x-p.px)/Math.max(dt,1e-5);
      p.vy=(p.y-p.py)/Math.max(dt,1e-5);
      p.spinRate=c.spin*(1-.20*v43min(u,0,1));
      p.spin+=p.spinRate*dt;
      if(p.phase==='out'&&lastTravel<path.far&&p.travel>=path.far){
        p.phase='return';p.damage=c.returning;p.hits=new Set();
      }
      if(p.travel>=path.total-.01||p.age>=c.maxFlightSeconds){
        const h=getHolder(p.launchOwner);
        if(h?.weaponId===p.weapon&&h.phase==='IN_FLIGHT'){
          h.phase='RETRIEVED';h.meta.v43Time=0;
        }
        v43Pulse(p.x,p.y,'retrieve');p.life=0;return;
      }
      const previous=p.visual[p.visual.length-1];
      if(!previous||Math.hypot(p.x-previous.x,p.y-previous.y)>4){
        p.visual.push({x:p.x,y:p.y,t:p.age});if(p.visual.length>24)p.visual.shift();
      }
      const hit=v43Hit(p,{x:p.px,y:p.py},{x:p.x,y:p.y});
      // Every physical SPECIAL flight must pass through Crystal's single
      // swept surface authority BEFORE native body damage. A K intercept
      // may hold/re-own the exact projectile; never apply the stale body hit.
      const crystal=window.APEX_CRYSTAL;
      if(crystal?.resolveBullet){
        const bodyT=hit?.t??2;
        const outcome=crystal.resolveBullet(p,bodyT,dt);
        if(outcome?.consumed){
          if(v43Redirected(p)){
            const original=getHolder(p.launchOwner);
            if(original?.weaponId===p.weapon)original.meta.v43Interrupted=true;
          }
          return;
        }
      }
      if(hit&&!p.hits.has(hit.actor)){
        p.hits.add(hit.actor);
        v43Deal(p,hit.actor,p.damage,{
          knockback:100,impact:{x:hit.x,y:hit.y,vx:p.vx,vy:p.vy}});
        v43Pulse(hit.x,hit.y,'strike');
      }
      return;
    }
    p.px=p.x;p.py=p.y;
    if(magnetPlan){
      const ex=magnetPlan.entryX??(p.px+magnetPlan.preVx*dt*magnetPlan.entryT);
      const ey=magnetPlan.entryY??(p.py+magnetPlan.preVy*dt*magnetPlan.entryT);
      p.vx=magnetPlan.postVx;p.vy=magnetPlan.postVy;
      p.x=magnetPlan.finalX??(ex+p.vx*dt*(1-magnetPlan.entryT));
      p.y=magnetPlan.finalY??(ey+p.vy*dt*(1-magnetPlan.entryT));
      p.__hr=p.__hr||{};
      p.__hr.pathVia={x:ex,y:ey,t:magnetPlan.entryT,
        preVx:magnetPlan.preVx,preVy:magnetPlan.preVy,
        postVx:magnetPlan.postVx,postVy:magnetPlan.postVy};
      p.__hr.pathPoly=magnetPlan.poly?.length?magnetPlan.poly:null;
    }else{p.x+=p.vx*dt;p.y+=p.vy*dt;}
    p.visual.push({x:p.x,y:p.y,t:p.age});if(p.visual.length>24)p.visual.shift();
    // Plasma core is a charged carrier, not a damaging early projectile.
    // Mine must land and arm first: an in-flight collision cannot bypass
    // the explicit 0.48s arming gate.
    const hit=p.kind==='mine'?null
      :v43Hit(p,{x:p.px,y:p.py},{x:p.x,y:p.y});
    // CRYSTALA K / J: same real swept segment, wall/shard BEFORE fighter.
    // Only mobile damage-bearing bodies are routed: an armed floor mine,
    // flame cone and timed burn never masquerade as reflectable bullets.
    const crystalEligible=V43[p.weapon]?.reflectableKinds?.includes(p.kind)
      &&(p.kind!=='mine'||p.phase==='flight');
    if(crystalEligible&&window.APEX_CRYSTAL?.resolveBullet){
      const bodyT=hit?.t??2;
      const outcome=window.APEX_CRYSTAL.resolveBullet(p,bodyT,dt);
      if(outcome?.consumed)return;
    }
    if(hit&&!p.hits.has(hit.actor)){
      p.x=hit.x;p.y=hit.y;
      if(p.kind==='plasma-core'){
        v43Deal(p,hit.actor,p.damage??c.coreDamage,{knockback:80,
          impact:{x:hit.x,y:hit.y,vx:p.vx,vy:p.vy}});
        v43Pulse(hit.x,hit.y,'plasma');p.life=0;return;
      }
      if(p.kind==='rocket'){
        v43Splash(p,p.damage??c.peak,c.blastRadius);
        p.life=0;return;
      }
      if(p.kind==='ball'){
        // Steel Ball is a direct kinetic collision, NEVER a scaled AOE.
        // Straight 98, one wall-bounce 109.76 (native Fighter.takeDamage).
        v43Deal(p,hit.actor,p.damage??c.peak,{
          knockback:720,knockbackSeconds:.29,
          impactDirection:{x:p.vx,y:p.vy},impact:{x:hit.x,y:hit.y,vx:p.vx,vy:p.vy}});
        v43Pulse(hit.x,hit.y,'strike');
        p.life=0;return;
      }
            if(p.kind==='fragment'&&p.fragmentGroup){
        const counts=p.fragmentGroup.victimHits;
        const n=counts.get(hit.actor)||0;
        if(n>=c.maxFragmentHits){p.hits.add(hit.actor);p.life=0;return;}
        counts.set(hit.actor,n+1);
      }
      v43Deal(p,hit.actor,p.damage,{
        knockback:p.kind==='bolt'?180:100,
        ...(p.kind==='bolt'?{stun:0}:{}),
        impact:{x:p.x,y:p.y,vx:p.vx,vy:p.vy}});
      if(p.kind==='flare'){
        const t=hit.actor;let burnCount=0;
        // Apply actual future burn ticks through game-time status via a world
        // projectile, not an interval (pauses with match engine).
        v43ApplyBurn(t,p.owner,p.weapon,c.burnTicks,c.burnInterval,
          c.burnDamage*v43DamageScale(p,c.direct),p);
      }
      if(p.kind==='bolt')hit.actor.applyStatus?.('slow',c.slowSeconds,{mult:c.slowMult});
      if(p.kind==='fragment'){
        p.hits.add(hit.actor);if(p.hits.size>=c.maxFragmentHits)p.life=0;
        return;
      }
      v43Pulse(p.x,p.y,p.kind==='plasma'?'plasma':'strike');
      p.life=0;return;
    }
    if(p.kind==='ball'){
      // One true ricochet; on hit/ground bounce, later explosion gains 12%.
      const wall=p.x<=p.radius||p.x>=GAME_SIZE-p.radius||
        p.y<=p.radius||p.y>=GAME_SIZE-p.radius;
      if(wall&&p.bounces<c.maxBounces){
        const currentScale=v43DamageScale(p,p.bounces?c.ricochetPeak:c.peak);
        p.bounces++;p.damage=c.ricochetPeak*currentScale;
        if(p.x<=p.radius||p.x>=GAME_SIZE-p.radius)p.vx=-p.vx*c.restitution;
        if(p.y<=p.radius||p.y>=GAME_SIZE-p.radius)p.vy=-p.vy*c.restitution;
        p.vx*=c.horizontalRetention;p.vy*=c.horizontalRetention;
        v43Pulse(p.x,p.y,'ricochet');
      }else if(wall){v43Pulse(p.x,p.y,'ricochet');p.life=0;}
    }
    if(p.kind==='rocket'&&(p.x<0||p.x>GAME_SIZE||p.y<0||p.y>GAME_SIZE)){
      p.x=v43min(p.x,0,GAME_SIZE);p.y=v43min(p.y,0,GAME_SIZE);
      v43Splash(p,p.damage??c.peak,c.blastRadius);p.life=0;
    }
    if(p.kind==='plasma-core'&&
      (p.x<0||p.x>GAME_SIZE||p.y<0||p.y>GAME_SIZE)){
      p.life=0;return; // A missed core outside the arena never divides.
    }
    if(p.kind==='plasma-core'&&p.age>=c.splitAfter){
      for(const da of c.spread){
        const angle=Math.atan2(p.vy,p.vx)+da;
        const child=v43Spawn(p.owner,p.weapon,'plasma',angle,{x:p.x,y:p.y,px:p.x,py:p.y,
          radius:c.radius,damage:c.shardDamage*v43DamageScale(p,c.coreDamage),
          vx:Math.cos(angle)*c.shardSpeed,vy:Math.sin(angle)*c.shardSpeed,
          life:2.3,homing:!v43Redirected(p)});
        if(v43Redirected(p)){
          child.aqReflected=!!p.aqReflected;
          child.__hr={crystalReflected:!!p.__hr?.crystalReflected,
            cryOwner:p.__hr?.cryOwner,neutral:false};
        }
      }
      v43Pulse(p.x,p.y,'split');p.life=0;
    }
    if(p.life<=0&&p.kind==='rocket'){
      v43Splash(p,p.damage??c.peak,c.blastRadius);
    }
  }
  function v43TickBurn(p,dt){
    const c=V43[p.weapon],t=p.victim;
    if(!t||t.hp<=0||t.withdrawn===true){p.life=0;return;}
    p.age+=dt;p.x=t.x;p.y=t.y; // Engine owns p.life.
    const ticks=p.burnTicks??c.burnTicks,interval=p.burnInterval??c.burnInterval;
    while((p.tickCount||0)<ticks
      &&p.age+1e-7>=((p.tickCount||0)+1)*interval){
      p.tickCount=(p.tickCount||0)+1;
      v43Deal(p,t,p.burnDamage??c.burnDamage,{statusDamage:true});
    }
  }
  // Native Arsenal holder driver owns equip/READY/ammo/pose/consume for all
  // weapons. SPECIAL is only an attack executor, not an independent battle
  // lifecycle or an extra per-frame clock.
  function makeV43Special(id){
    const c=V43[id];
    if(!c)throw Error('unknown special '+id);
    const recovery=id==='FLAMETHROWER'?c.duration+.08:(c.recoverySeconds||.30);
    return {
      id,category:'ranged',spriteKey:id,
      onEquip(ctx){ctx.holder.phase='READY';},
      canActivate(ctx){return ctx.holder.phase==='READY'
        &&ctx.holder.elapsed>=(c.readyDelaySeconds??CFG.RANGED_READY_DELAY_SECONDS)
        &&enemyAlive(ctx)
        &&(id!=='FLAMETHROWER'||Math.hypot(ctx.enemy.x-ctx.fighter.x,ctx.enemy.y-ctx.fighter.y)
          <=c.idealRange+(ctx.enemy.radius||75)*.25);},
      activate(ctx){
        const f=ctx.fighter,h=ctx.holder,a=angleToEnemy(ctx);
        h.phase='WINDUP';h.meta.v43Time=0;
        h.meta.v43Angle=a;
        h.meta.v43Wait=c.windup??c.deployDelay??c.charge??0;
        log('USE', 'fighter='+f.name+' weapon='+id+' kind='+c.kind);
      },
      update(ctx,dt){
        const h=ctx.holder,f=ctx.fighter;
        if(h.phase==='FOLLOW_THROUGH'||h.phase==='RETRIEVED'){
          h.meta.v43Time+=dt;
          if(h.meta.v43Time >= (h.phase==='RETRIEVED'?.30:recovery)){
            // Boomerang has physically returned: retire the spent body without
            // ejecting a fake copy from the fighter's hand.
            if(h.phase==='RETRIEVED'){
              f.data.arsenal=null;
              log('CONSUME','fighter='+f.name+' weapon='+id+' reason=boomerang-retrieved');
            }else consume(f,'sequence-complete');
          }
          return;
        }
        if(h.phase==='IN_FLIGHT'){
          // A lifecycle interruption must never strand a permanently armed
          // holder if a projectile was destroyed by external effects.
          if(!projectiles.some(p=>p?.aq&&p.weapon===id&&p.owner===f&&p.kind==='boomerang'&&p.life>0)){
            if(h.meta.v43Interrupted)consume(f,'boomerang-redirected-away');
            else{h.phase='RETRIEVED';h.meta.v43Time=0;}
          }
          return;
        }
        if(h.phase!=='WINDUP')return;
        h.meta.v43Time+=dt;
        if(h.meta.v43Time<h.meta.v43Wait)return;
        const a=id==='COMBAT_BOOMERANG'?angleToEnemy(ctx):h.meta.v43Angle;
        const kind={flare:'flare',bolt:'bolt',ball:'ball',boomerang:'boomerang',
          rocket:'rocket',flame:'flame',plasma:'plasma-core',mine:'mine'}[c.kind];
        if(!kind)throw Error('special executor not implemented '+c.kind);
        const x=v43Spawn(f,id,kind,a,{phase:kind==='boomerang'?'out':'flight',
          speed:kind==='plasma-core'?c.coreSpeed:undefined,
          life:kind==='flame'?c.duration:kind==='mine'?12.5:
            kind==='boomerang'?c.flightSeconds+.16:3.2,
          radius:c.radius||8,damage:c.direct??c.peak??c.outgoing??c.shardDamage??c.tickDamage??0});
        h.shotsFired+=1; // Same holder ammo/telemetry law as normal Arsenal guns.
        AQ.state?.resultLedger?.onShot?.(f,id);
        poseKick(h,poseRecipe(id));
        window.avCue?.('fire',{weapon:id,family:'SPECIAL',x:f.x,y:f.y,angle:a});
        if(kind==='flame'){x.ticks=0;x.damage=c.tickDamage;x.flameOrigins=[];}
        if(kind==='plasma-core'){x.damage=c.coreDamage;}
        if(kind==='boomerang'){
          x.spin=0;x.spinRate=c.spin;x.damage=c.outgoing;
          x.flightPath=v43MakeFlightPath(x.x,x.y,a);
          x.travel=0;x.speed=c.speed;
          x.life=x.maxLife=c.maxFlightSeconds+.35;
          h.phase='IN_FLIGHT';h.meta.v43Time=0;
        }else{
          h.phase='FOLLOW_THROUGH';h.meta.v43Time=0;
        }
      }
    };
  }

  // Per-frame movement/hit resolution for aq_* projectiles.
  // A live Core Six match delegates aq_bullet/grenade/thrown to Hero Rework,
  // but its replacement must still advance V4.3 aq_v43 exactly once.
  function updateArsenalProjectiles(dt, dispatch = 'all') {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !p.aq) continue;
      if (dispatch === 'v43-only' && p.type !== 'aq_v43') continue;
      if(p.type==='aq_v43'){
        // The global updateProjectiles(dt) already owns lifetime and cleanup.
        // NEVER subtract life a second time: that silently truncates burn,
        // shortens plasma/flame motion and destroys mine arming state.
        // Crystal's held body can refresh its own refraction escrow lifetime.
        if(p.__hr?.cryHold){window.APEX_CRYSTAL?.holdStep?.(p);continue;}
        if(p.kind==='burn')v43TickBurn(p,dt);else v43Step(p,dt);
        if(p.life<=0)projectiles.splice(i,1);
        continue;
      }
      if (p.type === 'aq_bullet') {
        // C §5.2: swept segment vs fighter circle — speeds are tracer-grade and
        // tunneling is solved by continuous testing, never by bigger bullets.
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20 || p.x > GAME_SIZE + 20 || p.y < -20 || p.y > GAME_SIZE + 20) { p.life = 0; continue; }
        const questHit=AQ.state?.questMultiActor===true
          ?window.APEX_QUEST_MULTI_ACTOR_CORE?.firstProjectileHit?.({
            owner:p.owner,actors:fighters,from:{x:p.px,y:p.py},
            to:{x:p.x,y:p.y},projectileRadius:p.radius,
            bodyRadiusScale:CFG.BULLET_HIT_RADIUS_SCALE
          }):null;
        const target=AQ.state?.questMultiActor===true
          ?questHit?.actor
          :fighters.find(f=>f&&f!==p.owner&&f.hp>0);
        if (target) {
          const hitR = target.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius;
          if(questHit||distPointToSegment(target.x,target.y,p.px,p.py,p.x,p.y)<hitR){
            const heavy = !!p.heavy;
            // V1 blood port §6: consume the REAL collision point + REAL
            // projectile travel vector at impact (visual consumer only —
            // never gameplay truth).
            const hit=questHit||
              sweptSegmentCircleHit(p.px,p.py,p.x,p.y,target.x,target.y,hitR)
              || {x:p.x,y:p.y};
            aqDamage(target, p.damage, p.owner, p.weapon, {
              knockback: p.knockback, stun: p.stun, hitStop: heavy ? 0.05 : 0, critical: !!p.critical,
              impact: { x: hit.x, y: hit.y, vx: p.vx, vy: p.vy },
              resultSource:{crystal:!!p.__hr?.crystalReflected,
                mirror:!!p.resultMirrorCopy,magnet:!!p.resultMagnetPulled,
                final:!!p.resultFinalShot},
            });
            // C §5.4 impact hierarchy, generalized to firing families (POST-C
            // §3): pistol tiny snap, SMG minimal repeated, shotgun broad
            // cluster, precision sharp focused.
            const fam = p.family || 'SEMI';
            if (fam === 'AUTO') emitParticles(p.x, p.y, p.color, 3, 260, 3, 0.2, 'square');
            else if (fam === 'SHOTGUN' || fam === 'AUTOSHOT') emitParticles(p.x, p.y, p.color, 9, 340, 5, 0.3, 'square');
            else if (heavy) emitParticles(p.x, p.y, p.color, 8, 420, 4, 0.3, 'square');
            else emitParticles(p.x, p.y, p.color, 5, 300, 3, 0.25, 'square');
            p.life = 0;
          }
        }
        continue;
      }
      if (p.type === 'aq_grenade') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot = (p.rot || 0) + dt * 9; // canonical sprite spins in flight (C §3.3)
        // Bounce off arena walls until the fuse burns out.
        if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); }
        if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx); }
        if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); }
        if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy); }
        p.fuse -= dt;
        if (p.fuse <= 0) explodeGrenade(p);
        continue;
      }
      if (p.type === 'aq_thrown') {
        // POST-C §5 thrown-melee lifecycle: flight -> pinned -> exit.
        p.grace = Math.max(0, (p.grace || 0) - dt);
        if (p.state === 'flight') {
          // B8 homing pursuit (STORMBREAKER): bounded continuous steering
          // toward the owner's LIVING opponent. The per-second turn cap is
          // the whole identity — the bolt CURVES after a moving opponent but
          // never snaps onto them, and the speed stays exactly throwSpeed
          // (fast/heavy). Nothing else can redirect it: the projectile is
          // heroManipulationImmune (crystal reflect / magnet shell /
          // gravity well all leave it alone), and the target is ONLY ever
          // the owner's living opponent.
          if (p.weapon === 'STORMBREAKER' && p.questRivetSuppression !== true) {
            const tgt=AQ.state?.questMultiActor===true
              ?window.APEX_QUEST_MULTI_ACTOR_CORE?.nearestEnemy?.(p.owner,fighters)
              :fighters.find(f=>f&&f!==p.owner&&f.hp>0);
            if (tgt) {
              let cur = Math.atan2(p.vy, p.vx);
              const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
              let dAng = want - cur;
              while (dAng > Math.PI) dAng -= 2 * Math.PI;
              while (dAng < -Math.PI) dAng += 2 * Math.PI;
              const maxTurn = ((CFG.STORMBREAKER && CFG.STORMBREAKER.homingTurnRateRadPerSec) || 2.6) * dt;
              cur += Math.max(-maxTurn, Math.min(maxTurn, dAng));
              const sp = Math.hypot(p.vx, p.vy) || (CFG.THROWN_MELEE.speed.STORMBREAKER || 1350);
              p.vx = Math.cos(cur) * sp;
              p.vy = Math.sin(cur) * sp;
            }
          }
          p.px = p.x; p.py = p.y;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          // Q4F: the OWNER-chosen RIVET suppression is a physical floor
          // strike between the TWO real Fighter positions, not a fake VFX at
          // throw timeout and not 446HP delivered to a training participant.
          // This in-weapon swept contact owns the single real projectile exit.
          if(p.weapon==='STORMBREAKER'&&p.questRivetSuppression===true){
            const rig=AQ.state?.questRivetPreview;
            const floor=rig?.aimPoint;
            if(rig?.operator===p.owner && floor && !rig.groundImpact
               && Number.isFinite(floor.x)&&Number.isFinite(floor.y)
               && distPointToSegment(floor.x,floor.y,p.px,p.py,p.x,p.y)<=p.radius+10){
              const point={x:floor.x,y:floor.y};
              rig.groundImpact=Object.freeze({
                x:point.x,y:point.y,owner:p.owner.questId,
                weapon:p.weapon,projectileType:p.type,
                flightTime:p.flightTime,
                kind:'REAL_ARSENAL_FLOOR_CONTACT'
              });
              window.APEX_ARSENAL_STORM?.onImpact?.(point.x,point.y,null);
              window.avCue('storm_impact',{weapon:'STORMBREAKER',x:point.x,y:point.y,
                questFloorSuppression:true});
              log('QUEST_RIVET_FLOOR_STRIKE',`x=${Math.round(point.x)} y=${Math.round(point.y)}`);
              projectiles.splice(i,1);
              continue;
            }
          }
          // Swept segment vs fighter circle — damage exactly once, on hit.
          const questHit=AQ.state?.questMultiActor===true
            ?window.APEX_QUEST_MULTI_ACTOR_CORE?.firstProjectileHit?.({
              owner:p.owner,actors:fighters,from:{x:p.px,y:p.py},
              to:{x:p.x,y:p.y},projectileRadius:p.radius,
              bodyRadiusScale:CFG.BULLET_HIT_RADIUS_SCALE
            }):null;
          const target=AQ.state?.questMultiActor===true
            ?questHit?.actor
            :fighters.find(f=>f&&f!==p.owner&&f.hp>0);
          // Never manufacture a 446HP impact on the paused friends;
          // this is a non-canonical, non-damaging lane flyby only.
          if (target && p.grace <= 0 && p.questRivetSuppression !== true) {
            const hitR = target.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius;
            if(questHit||distPointToSegment(target.x,target.y,p.px,p.py,p.x,p.y)<hitR){
              const spec = CFG.WEAPONS[p.weapon] || {};
              // STORMBREAKER: confirmed hit resolves damage through the ONE
              // melee authority (x1.5) + x7 scale, real engine stun, then the
              // weapon vanishes through the impact flash — it does NOT pin
              // into the victim (locked owner decision: no axe left standing
              // in the opponent). The VFX consumer gets the REAL swept
              // collision point (visual only — damage is already resolved).
              if (p.weapon === 'STORMBREAKER') {
                const hit=questHit||
                  sweptSegmentCircleHit(p.px,p.py,p.x,p.y,target.x,target.y,hitR)||
                  {x:p.x,y:p.y};
                const hpBeforeImpact=target.hp;
                aqDamage(target, CFG.meleeDamage('STORMBREAKER'), p.owner, 'STORMBREAKER', {
                  knockback: spec.knockback, stun: spec.stun,
                  shake: spec.shake != null ? spec.shake : 15,
                  hitStop: spec.hitStop != null ? spec.hitStop : 0.08,
                });
                if(p.__resultRicochet>0&&target.hp<hpBeforeImpact)
                  AQ.state?.resultLedger?.onRicochetHit?.(p.owner);
                // E08 causal receipt must be committed immediately after the
                // REAL swept hit + native damage, before any VFX/SFX callback
                // can re-enter presentation or clear a transient projectile.
                // E08's native Fighter-realized damage hook signs a true hit.
                // This collision callback is idempotent for the same original
                // projectile and resolution; no second Storm receipt is issued.
                if(p.questTotArtifactId&&p.questTotCommitResolution?.('HIT')!==true)
                  throw Error('E08 real Stormbreaker confirmed impact receipt denied');
                if (window.APEX_ARSENAL_STORM && window.APEX_ARSENAL_STORM.onImpact) {
                  window.APEX_ARSENAL_STORM.onImpact(hit.x, hit.y, target);
                }
                window.avCue('storm_impact', { weapon: 'STORMBREAKER', x: hit.x, y: hit.y });
                log('STORM_IMPACT', `target=${target.name} x=${Math.round(hit.x)} y=${Math.round(hit.y)}`);
                projectiles.splice(i, 1);
                continue;
              }
              p.pinAngle = Math.atan2(p.vy, p.vx);
              // ONE melee damage authority: thrown hits read the same x1.5.
              const hpBeforeThrow=target.hp;
              aqDamage(target, CFG.meleeDamage(p.weapon), p.owner, p.weapon, {
                knockback: spec.knockback, stun: spec.stun, shake: 8, hitStop: 0.05,
              });
              if(p.__resultRicochet>0&&target.hp<hpBeforeThrow)
                AQ.state?.resultLedger?.onRicochetHit?.(p.owner);
              window.avCue('melee_hit', { weapon: p.weapon, x: target.x, y: target.y, angle: p.pinAngle });
              p.state = 'pinned';
              p.pinnedTo = target;
              p.pinTimer = CFG.THROWN_MELEE.pinSeconds;
              log('THROWN_PIN', `weapon=${p.weapon} target=${target.name} pin=${CFG.THROWN_MELEE.pinSeconds}s`);
              continue;
            }
          }
          // Wall ricochet with the per-weapon budget; exhausted -> exit.
          let bounced = false;
          if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); bounced = true; }
          else if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx); bounced = true; }
          if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); bounced = true; }
          else if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy); bounced = true; }
          if (bounced) {
            if (p.ricochetsLeft <= 0) {
              thrownExit(p);
            } else {
              p.ricochetsLeft -= 1;
              p.__resultRicochet=(p.__resultRicochet||0)+1;
              AQ.state?.resultLedger?.onRicochet?.(p.owner);
              p.spin *= -1;
              window.avCue('ricochet', { weapon: p.weapon, x: p.x, y: p.y, angle: Math.atan2(p.vy, p.vx) });
              emitParticles(p.x, p.y, '#ffe6a8', 10, 320, 4, 0.3, 'square');
              log('THROWN_RICOCHET', `weapon=${p.weapon} left=${p.ricochetsLeft}`);
            }
          }
          // Missed-storm failsafe: bounded flight lifetime ends in the
          // physical exit (tumble), same as ricochet exhaustion — the
          // projectile is never silently spliced out of flight.
          if (p.state === 'flight' && p.maxFlight > 0) {
            p.flightTime += dt;
            if (p.flightTime >= p.maxFlight) {
              thrownExit(p);
              log('THROWN_MAXFLIGHT', `weapon=${p.weapon} flight=${p.flightTime.toFixed(2)}s`);
            }
          }
        } else if (p.state === 'pinned') {
          const t = p.pinnedTo;
          if (!t || t.hp <= 0) {
            thrownExit(p);
          } else {
            // Pinned INTO the struck fighter and following it (~1.0s).
            const long = meleeDrawLong(p.weapon);
            const depth = t.radius * 0.55 + long * 0.28;
            p.x = t.x - Math.cos(p.pinAngle) * depth;
            p.y = t.y - Math.sin(p.pinAngle) * depth;
            p.rot = p.pinAngle;
            p.pinTimer -= dt;
            if (p.pinTimer <= 0) thrownExit(p);
          }
        } else {
          // exit — physical tumble under gravity; no homing, no fade-as-exit.
          p.vy += 1500 * dt;
          p.px = p.x; p.py = p.y;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx) * 0.4; }
          else if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx) * 0.4; }
          if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy) * 0.35; p.vx *= 0.7; }
        }
        p.life -= dt;
        if (p.life <= 0 || p.y > GAME_SIZE + 60) { projectiles.splice(i, 1); }
        continue;
      }
    }
  }

  // C §5.3 tracer language: thin core from previous to current position,
  // bright short head, capped length; no outlined ellipse balls.
  // POST-C §3: registry guns derive their tracer from the firing family.
  const TRACER = {
    PISTOL:  { trail: 0.050, width: 3.0, head: 2.6 },
    SMG:     { trail: 0.032, width: 2.2, head: 2.0 },
    SHOTGUN: { trail: 0.024, width: 2.6, head: 2.2 },
    SNIPER:  { trail: 0.075, width: 4.0, head: 3.2, after: 1.3 },
  };
  const FAMILY_TRACER = {
    SEMI: TRACER.PISTOL,
    AUTO: TRACER.SMG,
    BURST: { trail: 0.040, width: 2.6, head: 2.3 },
    SHOTGUN: TRACER.SHOTGUN,
    AUTOSHOT: TRACER.SHOTGUN,
    PRECISION: { trail: 0.065, width: 3.6, head: 3.0, after: 1.2 },
  };
  function tracerFor(weaponId) {
    if (TRACER[weaponId]) return TRACER[weaponId];
    const fam = (CFG.WEAPONS[weaponId] || {}).family;
    return FAMILY_TRACER[fam] || TRACER.PISTOL;
  }
  const v43SpriteCache=new Map();
  function v43Sprite(url){
    if(!v43SpriteCache.has(url)&&typeof Image==='function'){
      const image=new Image();image.src=url;v43SpriteCache.set(url,image);
    }
    return (window.APEX_ARSENAL_AV?.imageByPath?.(url))||v43SpriteCache.get(url)||null;
  }
  // Owner V4.3 Gold visual recipe: ribbon geometry and layered flame are
  // PRESENTATION ONLY. The actual projectile path and Fighter damage remain
  // owned by the native Arsenal / Hero Rework engine.
  function v43GoldTongue(ctx,x,y,angle,size,seed,alpha=1,now=seed){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';
    // Gold fireTongue samples absolute simulation time AND per-particle seed.
    const yy=Math.sin(now*24+seed*2)*size*.18;
    for(const [k,color,opacity] of [[1.5,'#bd2418',.20],[1.06,'#ff521a',.42],[.68,'#ffad3c',.58],[.32,'#fff7c9',.65]]){
      ctx.globalAlpha=opacity*alpha;ctx.fillStyle=color;ctx.beginPath();
      ctx.moveTo(-size*.65*k,0);
      ctx.bezierCurveTo(-size*.38*k,-size*.65*k,-size*.06*k,-size*.56*k,size*.22*k,yy*.5);
      ctx.bezierCurveTo(size*.54*k,-size*.53*k,size*.9*k,-size*.16*k,size*1.5*k,yy);
      ctx.bezierCurveTo(size*.48*k,size*.16*k,size*.42*k,size*.60*k,size*.20*k,size*.48*k);
      ctx.bezierCurveTo(-size*.05*k,size*.35*k,-size*.42*k,size*.35*k,-size*.65*k,0);
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  // Direct authoring transfer from the Gold V4.3 Lab's flamethrower:
  // 470 emitted particles/s, spread ±.22 rad, 280-555 px/s, fast
  // 0.20-0.45s flame and 10% 0.42-0.65s smoke. Here a deterministic
  // particle field is sampled from projectile age, so game logic, target
  // collision and pause-time remain completely native and reproducible.
  function v43GoldFlamethrowerParticles(ctx,p) {
    const total=Math.min(310,Math.floor(Math.min(p.age,.65)*470));
    const originX=Number.isFinite(p.ox)?p.ox:p.x,
      originY=Number.isFinite(p.oy)?p.oy:p.y;
    const heading=Number.isFinite(p.angle)?p.angle:Math.atan2(p.vy||0,p.vx||1);
    const frac=x=>x-Math.floor(x);
    // Stable pseudorandom field; never generate flickering per-frame noise.
    const rnd=(i,s)=>frac(Math.sin(i*127.1+s*311.7)*43758.5453123);
    for(let i=0;i<total;i++){
      const birth=i/470,age=p.age-birth;
      if(age<0)continue;
      const type=rnd(i,7),life=type<.10?.42+rnd(i,8)*.23:.20+rnd(i,9)*.25;
      if(age>=life)continue;
      let pose={x:originX,y:originY,angle:heading};
       if(p.flameOrigins?.length){
         for(let j=p.flameOrigins.length-1;j>=0;j--){
           if(p.flameOrigins[j].time<=birth+.02){pose=p.flameOrigins[j];break;}
         }
       }
       const a=pose.angle+(rnd(i,1)*2-1)*.22;
      const v=280+rnd(i,2)*275;
      const travel=v*age*(1-.13*age);
      const px=pose.x+Math.cos(a)*travel+(rnd(i,3)-.5)*6;
      const py=pose.y+Math.sin(a)*travel+(rnd(i,4)-.5)*10-
        (type<.10?11*age*age:Math.sin(p.age*19+i*.74)*4*age);
      const opacity=Math.pow(1-age/life,.70);
      const size=type<.10?8+rnd(i,5)*9:5+rnd(i,5)*9;
      if(type<.10){
        ctx.save();ctx.translate(px,py);
        ctx.rotate(rnd(i,6)*6.28+p.age*.1);
        ctx.scale(1.28,.72);
        const radius=size*(.9+age*1.5);
        const g=ctx.createRadialGradient(-radius*.23,0,radius*.12,0,0,radius);
        g.addColorStop(0,'rgba(111,125,139,'+(opacity*.18)+')');
        g.addColorStop(.66,'rgba(82,94,108,'+(opacity*.1)+')');
        g.addColorStop(1,'rgba(44,48,56,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();
        ctx.restore();
      } else if(type<.28){
        const len=7+v*.022;
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=rnd(i,11)<.5?'#ffae4b':'#ff6d21';
        ctx.globalAlpha=opacity*.78;ctx.lineCap='round';ctx.lineWidth=Math.max(1,size*.35);
        ctx.beginPath();ctx.moveTo(px-Math.cos(a)*len,py-Math.sin(a)*len);
        ctx.lineTo(px,py);ctx.stroke();ctx.restore();
      } else {
        v43GoldTongue(ctx,px,py,a,size*(.56+opacity*.7),
          i*.038,opacity*.72,p.age);
      }
    }
  }
  // Faithful Gold Lab airfoil wake: time-gated path samples, twin rolling
  // wingtip vortices and two spinning local hook cuts. No static halos.
  // The time history lives on the same authoritative projectile positions;
  // Crystal re-direction therefore bends the VFX with the real trajectory.
  function v43GoldBoomerangAirflow(ctx,p,life){
    const q=p.visual,now=p.age;
    if(!q||q.length<3)return;
    const tail=q.filter(a=>now-(a.t??0)<.31);
    if(tail.length<3)return;
    const velocity=Math.hypot(p.vx||0,p.vy||0)||1;
    const strength=v43min((v43Redirected(p)?velocity:(p.speed||velocity))/600,.35,1.1);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';ctx.lineJoin='round';
    for(let layer=0;layer<3;layer++){
      const side=layer===0?-1:layer===1?1:0,points=[];
      for(let j=0;j<tail.length;j++){
        const a=tail[j],pr=tail[Math.max(0,j-1)],ne=tail[Math.min(tail.length-1,j+1)];
        const dx=ne.x-pr.x,dy=ne.y-pr.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
        const age=v43min((now-(a.t??0))/.31,0,1),old=age*age;
        const twist=side*(11+old*15)
          +Math.sin((a.t??0)*(p.spinRate||V43[p.weapon]?.spin||38)*.65+layer*2.1)
            *old*(5+8*old);
        points.push({x:a.x+nx*twist,y:a.y+ny*twist});
      }
      for(let pass=0;pass<2;pass++){
        const core=pass===1,t=points[0],h=points[points.length-1];
        const grad=ctx.createLinearGradient(t.x,t.y,h.x,h.y);
        const tint=layer===0?'169,232,254':layer===1?'109,201,238':'213,247,255';
        grad.addColorStop(0,'rgba('+tint+',0)');
        grad.addColorStop(.32,'rgba('+tint+','+(core?.06:.09)+')');
        grad.addColorStop(.75,'rgba('+tint+','+(core?.28:.17)+')');
        grad.addColorStop(1,'rgba('+tint+','+(core?.48:.28)+')');
        ctx.strokeStyle=grad;ctx.globalAlpha=strength*(core?.85:.80)*life;
        ctx.lineWidth=core?(layer===2?1.4:1.7):(layer===2?7:10);
        ctx.beginPath();ctx.moveTo(t.x,t.y);
        for(let j=1;j<points.length-1;j++){
          const a=points[j],b=points[j+1];
          ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);
        }
        ctx.lineTo(h.x,h.y);ctx.stroke();
      }
    }
    const tx=p.vx/velocity,ty=p.vy/velocity,nx=-ty,ny=tx;
    for(let j=0;j<2;j++){
      const phase=p.spin+j*Math.PI,side=Math.sin(phase),radius=16+Math.cos(phase)*5;
      ctx.globalAlpha=(.20+.16*(.5+.5*side))*strength*life;
      ctx.strokeStyle=j===0?'#d3f6ff':'#8fd9f2';ctx.lineWidth=1.8+j*.7;
      const x=p.x-tx*20+nx*side*radius,y=p.y-ty*20+ny*side*radius;
      ctx.beginPath();ctx.moveTo(x-tx*19,y-ty*19);
      ctx.quadraticCurveTo(x-tx*9+nx*side*9,y-ty*9+ny*side*9,
        x+tx*13+nx*side*5,y+ty*13+ny*side*5);
      ctx.stroke();
    }
    ctx.restore();
  }
  function v43GoldRibbon(ctx,p,life){
    const q=p.visual;if(!q||q.length<3)return;
    const boom=p.kind==='boomerang';
    if(boom){v43GoldBoomerangAirflow(ctx,p,life);return;}
    const color={flare:'#ff6530',rocket:'#e3b186',bolt:'#cfe5e9',ball:'#c6a87a'}[p.kind];
    if(!color&&!boom)return;
    const maxWidth=boom?30:p.kind==='flare'?18:p.kind==='rocket'?20:p.kind==='ball'?7:5;
    ctx.save();ctx.globalCompositeOperation=boom?'screen':'lighter';
    for(const k of (boom?[2.3,1.35,.55]:[1.9,1,.28])){
      ctx.beginPath();
      for(let i=0;i<q.length;i++){
        const pt=q[i],pr=q[Math.max(0,i-1)],ne=q[Math.min(q.length-1,i+1)];
        const dx=ne.x-pr.x,dy=ne.y-pr.y,ll=Math.hypot(dx,dy)||1;
        const radius=maxWidth*Math.pow(i/(q.length-1),boom?1.12:1.35)*k*.5;
        if(i)ctx.lineTo(pt.x-dy/ll*radius,pt.y+dx/ll*radius);
        else ctx.moveTo(pt.x-dy/ll*radius,pt.y+dx/ll*radius);
      }
      for(let i=q.length-1;i>=0;i--){
        const pt=q[i],pr=q[Math.max(0,i-1)],ne=q[Math.min(q.length-1,i+1)];
        const dx=ne.x-pr.x,dy=ne.y-pr.y,ll=Math.hypot(dx,dy)||1;
        const radius=maxWidth*Math.pow(i/(q.length-1),boom?1.12:1.35)*k*.5;
        ctx.lineTo(pt.x+dy/ll*radius,pt.y-dx/ll*radius);
      }
      ctx.closePath();
      if(boom){
        const a=q[0],b=q[q.length-1],g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
        g.addColorStop(0,'rgba(108,173,196,0)');
        g.addColorStop(.22,'rgba(109,201,228,.18)');
        g.addColorStop(.65,'rgba(170,236,255,.24)');
        g.addColorStop(1,'rgba(239,251,255,.34)');
        ctx.fillStyle=g;ctx.globalAlpha=.82*life/k;
      }else {ctx.fillStyle=color;ctx.globalAlpha=.16*life/k;}
      ctx.fill();
    }
    if(boom){
      ctx.lineWidth=1.35;ctx.strokeStyle='rgba(234,252,255,.78)';
      ctx.globalAlpha=.85*life;ctx.beginPath();
      for(let i=0;i<q.length;i++){if(!i)ctx.moveTo(q[i].x,q[i].y);else ctx.lineTo(q[i].x,q[i].y);}
      ctx.stroke();
      // Gold's airfoil wake follows the actual curved sample path (no halos).
      for(let j=0;j<3;j++){
        const i=Math.max(1,q.length-2-j*Math.max(2,Math.floor(q.length/5)));
        const pt=q[i],pr=q[Math.max(0,i-1)],ne=q[Math.min(q.length-1,i+1)];
        const dx=ne.x-pr.x,dy=ne.y-pr.y,ll=Math.hypot(dx,dy)||1,nx=-dy/ll,ny=dx/ll;
        const bend=10+j*8,reach=20+j*14;
        ctx.lineWidth=Math.max(.8,2.6-j*.45);
        ctx.strokeStyle=j===0?'rgba(245,254,255,.74)':'rgba(132,215,239,.38)';
        ctx.beginPath();ctx.moveTo(pt.x-dx/ll*reach+nx*5,pt.y-dy/ll*reach+ny*5);
        ctx.quadraticCurveTo(pt.x+nx*bend,pt.y+ny*bend,pt.x+dx/ll*10,pt.y+dy/ll*10);ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Exact owner Gold drawPremiumLayer plasma transport ribbons. This layer
  // reads the same physical carrier position/velocity as the native attack;
  // it NEVER creates a second projectile or extra damage authority.
  function v43GoldPlasmaTrail(ctx,p,life=1){
    ctx.save();ctx.globalCompositeOperation='lighter';
    const a=Math.atan2(p.vy,p.vx);ctx.translate(p.x,p.y);ctx.rotate(a);
    for(let j=0;j<3;j++){
      ctx.strokeStyle=['#793cc8','#bd83f8','#f1d7ff'][j];
      ctx.globalAlpha=[.15,.40,.73][j]*life;ctx.lineWidth=[23,8,1.5][j];
      ctx.lineCap='round';ctx.beginPath();
      ctx.moveTo(-72+j*12,Math.sin(p.age*18+j)*3);
      ctx.quadraticCurveTo(-40,Math.sin(p.age*15+j)*10,0,0);ctx.stroke();
    }
    ctx.restore();
  }
  // The exact owner Gold Lab's eight animated mine-arming spokes are
  // drawn in WORLD space after the sprite. The former version rotated this
  // halo with the image/velocity, producing a different motion signature.
  function v43GoldMineArming(ctx,p,life=1){
    const t=p.age*10;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(p.x,p.y);
    ctx.strokeStyle='#ffa44f';ctx.lineWidth=2;
    for(let i=0;i<8;i++){
      const a=i*TAU/8,r=38+Math.sin(t+i)*4;
      ctx.globalAlpha=(.15+.23*(.5+.5*Math.sin(t)))*life;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*27,Math.sin(a)*27);
      ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.stroke();
    }
    ctx.restore();
  }
  function v43GoldProjectile(ctx,p){
    const c=V43[p.weapon]||{},life=p.kind==='boomerang'
      ?v43min(p.life/.25,0,1):v43min(p.life/Math.max(.1,p.maxLife),0,1);
    const angle=Number.isFinite(p.angle)?p.angle:Math.atan2(p.vy||0,p.vx||1);
    v43GoldRibbon(ctx,p,life);
    if(p.kind==='flame'){
      // Gold V4.3 emits ~470 short-lived particles/sec for .65s.
      // Presentation reads p.age only; no projectile/HP mutations.
      v43GoldFlamethrowerParticles(ctx,p);
      return;
    }
    if(p.kind==='burn'){
      const t=p.victim;if(!t)return;
      for(let i=0;i<5;i++){
        const x=t.x+Math.sin(p.age*19+i*3.4)*24,y=t.y+
          Math.cos(p.age*23+i*7)*18-(p.age*18+i*13)%48;
        v43GoldTongue(ctx,x,y,-Math.PI/2+Math.sin(p.age*4+i)*.24,
          9+i*.8,i*.5,.67*life,p.age);
      }
      return;
    }
    if(p.kind==='plasma'||p.kind==='plasma-core'){
      // Gold's 3 ribbons are immutable; the 7 finer current-arcs below
      // are additive V4.3 detail, never a substitute for Gold transport.
      v43GoldPlasmaTrail(ctx,p,life);
      const heading=Math.atan2(p.vy||0,p.vx||1);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(heading);
      ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      const distance=p.kind==='plasma-core'?92:73;
      ctx.lineWidth=1.2;ctx.strokeStyle='#f7e8ff';ctx.globalAlpha=.38*life;
      for(let j=0;j<7;j++){
        const phase=p.age*27+j*1.91;
        ctx.beginPath();ctx.moveTo(-distance*.9+Math.sin(phase)*8,Math.cos(phase)*12);
        ctx.quadraticCurveTo(-distance*.5,Math.sin(phase*1.4)*21,-3,Math.cos(phase)*7);
        ctx.stroke();
      }
      ctx.restore();
      // Exact Gold Lab concentric energized core: four luminous passes with
      // individual bloom, not flat gradients that hide the inner ring.
      const radius=p.kind==='plasma-core'?18:10;
      ctx.save();ctx.translate(p.x,p.y);ctx.globalCompositeOperation='lighter';
      for(let i=3;i>=0;i--){
        ctx.globalAlpha=(.28+i*.18)*life;
        ctx.fillStyle=['#7125db','#9a52f5','#c69aff','#fff9ff'][i];
        ctx.shadowColor='#a65bff';ctx.shadowBlur=26-i*5;
        ctx.beginPath();ctx.arc(0,0,radius*(1.75-i*.26)+Math.sin(p.age*14+i)*1.5,0,TAU);ctx.fill();
      }
      ctx.shadowBlur=0;ctx.globalAlpha=.88*life;
      ctx.strokeStyle='#edccff';ctx.lineWidth=2;
      for(let i=0;i<5;i++){
        const a=p.age*25.2+i*TAU/5;
        ctx.beginPath();ctx.moveTo(Math.cos(a)*(radius+3),Math.sin(a)*(radius+3));
        ctx.lineTo(Math.cos(a)*(radius+9),Math.sin(a)*(radius+9));ctx.stroke();
      }
      ctx.restore();return;
    }
    if(p.kind==='flare'){
      const a=Math.atan2(p.vy||0,p.vx||1),clock=p.age;
      const pulse=1+Math.sin(clock*19)*.12;
      v43GoldTongue(ctx,p.x,p.y,a+.1,19*pulse,clock*19,life,clock);
      // Gold drawFlareHead's focused white elliptical spearhead, not the
      // former featureless 35px radial disk over the flame animation.
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
      ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fff6e1';
      ctx.shadowColor='#ff7140';ctx.shadowBlur=19;ctx.globalAlpha=life;
      ctx.beginPath();ctx.ellipse(4,0,9,4,0,0,TAU);ctx.fill();ctx.restore();
      return;
    }
    if(p.kind==='fragment'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy||0,p.vx||1));
      ctx.fillStyle='#d9e0dc';ctx.strokeStyle='#4c687c';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-4);ctx.lineTo(-3,0);
      ctx.lineTo(-7,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();return;
    }
    const id={bolt:'BOLT',ball:'STEEL_BALL',rocket:'RPG_ROCKET',
      mine:'SHRAPNEL_MINE',boomerang:'COMBAT_BOOMERANG'}[p.kind];
    const img=id?v43Sprite('/assets/arsenal/v43/'+id+'.webp'):null;
    let lift=0;
    if(p.kind==='mine'&&p.phase==='flight'){
      lift=Math.sin(Math.PI*Math.min(1,p.age/(c.flightMax||.7)))*62;
      ctx.save();ctx.globalAlpha=.19;ctx.fillStyle='#16191f';
      ctx.translate(p.x,p.y+10);ctx.scale(1,.35);
      ctx.beginPath();ctx.arc(0,0,26,0,TAU);ctx.fill();ctx.restore();
    }
    ctx.save();ctx.translate(p.x,p.y-lift);
    ctx.rotate(p.kind==='boomerang'?p.spin||0:
      p.kind==='ball'?Math.atan2(p.vy,p.vx)+p.age*5:
      p.kind==='mine'?Math.atan2(p.vy,p.vx)+p.age*3.2:Math.atan2(p.vy,p.vx));
    if(p.kind==='rocket'){
      const g=ctx.createRadialGradient(-45,0,0,-45,0,36);
      g.addColorStop(0,'rgba(255,246,180,.82)');g.addColorStop(.3,'rgba(255,154,52,.42)');
      g.addColorStop(1,'rgba(255,70,0,0)');
      ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(-45,0,36,0,TAU);ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
    if(img?.complete&&img.naturalWidth>0){
      const w=p.kind==='boomerang'?c.worldWidth:
        p.kind==='mine'&&p.phase==='flight'?47:(c.projectileWidth||Math.max(26,(p.radius||8)*3));
      const h=w*img.naturalHeight/img.naturalWidth;
      ctx.drawImage(img,-w/2,-h/2,w,h);
    }
    // Sprite-specific LED and corner brackets stay with the mine body;
    // its Gold arming halo is added after restoring world-space coordinates.
    if(p.kind==='mine'&&p.phase==='armed'){
      const beat=.3+.35*(1+Math.sin(p.age*14))/2;
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle='rgba(255,105,43,'+beat+')';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-29,-15);ctx.lineTo(-21,-18);
      ctx.moveTo(29,15);ctx.lineTo(21,18);ctx.stroke();
      ctx.shadowColor='#fa7c3e';ctx.shadowBlur=11;
      ctx.fillStyle='#ffd4a1';ctx.beginPath();ctx.arc(0,0,4,0,TAU);ctx.fill();
    }
    ctx.restore();
    // Render world-aligned GOLD eight-spoke halo AFTER the physical mine sprite.
    if(p.kind==='mine'&&p.phase==='armed')v43GoldMineArming(ctx,p,life);
  }

  function drawArsenalProjectiles(ctx) {
    const av = window.APEX_ARSENAL_AV;
    for (const p of projectiles) {
      if (!p || !p.aq) continue;
      ctx.save();
      if (p.type === 'aq_v43') {
        v43GoldProjectile(ctx,p);
        ctx.restore();
        continue;
      }
      if (p.type === 'aq_bullet') {
        const t = tracerFor(p.weapon);
        const a = clamp(p.life / p.maxLife, 0.4, 1);
        ctx.globalCompositeOperation = 'lighter';
        if (t.after) { // sniper afterimage: longer faint transient
          ctx.globalAlpha = 0.22 * a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = t.width * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * t.trail * t.after, p.y - p.vy * t.trail * t.after);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.9 * a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = t.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * t.trail, p.y - p.vy * t.trail);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, t.head, 0, TAU);
        ctx.fill();
      } else if (p.type === 'aq_thrown') {
        // Stormbreaker V9 presentation is owned by APEX_ARSENAL_STORM so its
        // draw order can match the executable ref exactly. Physics/collision
        // remain here; only the duplicate generic sprite draw is skipped.
        if (p.weapon === 'STORMBREAKER' && window.APEX_ARSENAL_STORM && window.APEX_ARSENAL_STORM.ownsFlightSprite) {
          ctx.restore();
          continue;
        }
        // POST-C §5: the ACTUAL weapon sprite flies — same authored art as the
        // pickup/equipped reads, oriented along its travel (tip-first).
        const av = window.APEX_ARSENAL_AV;
        const w = av && av.weaponImage ? av.weaponImage(p.weapon) : null;
        const fade = p.life < 0.18 ? Math.max(0, p.life / 0.18) : 1; // tiny final cleanup only
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        if (w) {
          // Melee sprites are authored upright (long axis -Y): rotate the long
          // axis onto the flight/pin direction.
          const stormVisualOffset = p.weapon === 'STORMBREAKER'
            ? ((CFG.STORMBREAKER && CFG.STORMBREAKER.flightVisualOffsetRad) || 0)
            : 0;
          ctx.rotate(p.rot + Math.PI / 2 + stormVisualOffset);
          const s = meleeDrawLong(p.weapon) / Math.max(w.w, w.h);
          ctx.drawImage(w.img, 0, 0, w.w, w.h, (-w.w * s) / 2, (-w.h * s) / 2, w.w * s, w.h * s);
        } else {
          ctx.rotate(p.rot);
          ctx.fillStyle = '#d8d2c0';
          ctx.strokeStyle = '#241f14';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 7, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      } else if (p.type === 'aq_grenade') {
        // Exact identity continuity: the same canonical sprite as pickup and
        // equipped states, spinning in flight (C §3.3 grenade).
        const g = av && av.weaponImage ? av.weaponImage('GRENADE') : null;
        ctx.translate(p.x, p.y);
        if (g) {
          ctx.rotate(p.rot || 0);
          const s = 40 / Math.max(g.w, g.h);
          ctx.drawImage(g.img, 0, 0, g.w, g.h, (-g.w * s) / 2, (-g.h * s) / 2, g.w * s, g.h * s);
        } else {
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#20280f';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.rotate(-(p.rot || 0));
        const blink = p.fuse < 0.5 && Math.floor(p.fuse * 12) % 2 === 0;
        ctx.fillStyle = blink ? '#ff5a3c' : '#c8b26a';
        ctx.beginPath();
        ctx.arc(0, -p.radius - 5, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Shared activation helpers
  // ---------------------------------------------------------------------------
  function enemyAlive(ctx) { return !!(ctx.enemy && ctx.enemy.hp > 0); }
  function enemyDistance(ctx) { return enemyAlive(ctx) ? dist(ctx.fighter.x, ctx.fighter.y, ctx.enemy.x, ctx.enemy.y) : Infinity; }
  function angleToEnemy(ctx) { return Math.atan2(ctx.enemy.y - ctx.fighter.y, ctx.enemy.x - ctx.fighter.x); }

  // ---------------------------------------------------------------------------
  // V2 Checkpoint A (V2_MAJOR_PASS_HANDOFF §A1/§A2): fighter movement and weapon
  // aim are separate systems. The independent aim angle lives on holder.meta and
  // is damped (~60ms) only to remove jitter. NO weapon path may call setDir.
  // ---------------------------------------------------------------------------
  function logicalAim(ctx) {
    return enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x);
  }
  function dampAngle(from, to, dt, tau = 0.06) {
    let d = to - from;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return from + d * Math.min(1, dt / Math.max(1e-3, tau));
  }
  function holderAim(ctx) {
    const h = ctx.holder || getHolder(ctx.fighter);
    if (h && h.meta && h.meta.aimAngle != null) return h.meta.aimAngle;
    return logicalAim(ctx);
  }
  // Legacy name kept for call sites; it now ONLY reports the weapon aim angle
  // and never mutates fighter.dir (product law §A1).
  function aimAtHolder(ctx) { return holderAim(ctx); }

  function distPointToSegment(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 1e-9) return dist(px, py, x1, y1);
    const t = clamp(((px - x1) * vx + (py - y1) * vy) / len2, 0, 1);
    return dist(px, py, x1 + vx * t, y1 + vy * t);
  }

  function gunMuzzleDistance(weaponId, fighter) {
    const r = fighter?.radius || 75;
    if (weaponId === 'SNIPER') return r + 72;
    if (weaponId === 'SHOTGUN') return r + 52;
    if (weaponId === 'SMG') return r + 38;
    if (weaponId === 'PISTOL') return r + 26;
    const spec = CFG.WEAPONS[weaponId] || {};
    const base = { PRECISION: 58, SHOTGUN: 46, AUTOSHOT: 44, AUTO: 34, BURST: 34, SEMI: 26 }[spec.family] || 28;
    return r + base;
  }

  function gunWorldLong(weaponId, mode) {
    const table = CFG.FIREARM_LONG_SIDE || {};
    const mul = (CFG.FIREARM_DISPLAY_MODE && CFG.FIREARM_DISPLAY_MODE[mode || 'equipped']) || 1;
    if (table[weaponId]) return table[weaponId] * mul;
    const set = window.APEX_ARSENAL_C_SET && window.APEX_ARSENAL_C_SET.weapons && window.APEX_ARSENAL_C_SET.weapons[weaponId];
    if (set && set.worldW) return Math.max(set.worldW, set.worldH) * mul;
    return 120 * mul;
  }
  function gunWorldSize(weaponId) {
    const set = window.APEX_ARSENAL_C_SET && window.APEX_ARSENAL_C_SET.weapons && window.APEX_ARSENAL_C_SET.weapons[weaponId];
    if (set && set.worldW) return { w: set.worldW, h: set.worldH };
    return { w: 120, h: 48 };
  }

  // Canonical weapon-space -> world transform for generated C-set anchors.
  function weaponWorldAnchor(f, weaponId, kind, angle) {
    const aim = Number.isFinite(angle) ? angle : Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
    const h = getHolder(f);
    const pose = (h && h.meta && h.meta.pose) || {};
    const spec = CFG.WEAPONS[weaponId] || {};
    const r = f.radius || 75;
    const targetLong = gunWorldLong(weaponId);
    const offset = r * 0.78 + (pose.localX || 0) - (pose.recoil || 0);
    const lateral = pose.localY || 0;
    // Robot's real muzzle/ejection anchors share its fixed jaw frame with
    // the equipped sprite. All other heroes retain the Arsenal pose frame.
    const robot = window.APEX_ROBOT_PRESENTATION;
    const socket = robot?.isRobotFighter(f) ? robot.getRobotWeaponSocketWorld(f) : null;
    const cx = socket ? socket.x : f.x + Math.cos(aim) * offset + Math.cos(aim + Math.PI / 2) * lateral;
    const cy = socket ? socket.y : f.y + Math.sin(aim) * offset + Math.sin(aim + Math.PI / 2) * lateral;
    const set = window.APEX_ARSENAL_C_SET && window.APEX_ARSENAL_C_SET.weapons && window.APEX_ARSENAL_C_SET.weapons[weaponId];
    const uv = set && set[kind];
    if (!uv || !set) {
      const d = gunMuzzleDistance(weaponId, f);
      return { x: f.x + Math.cos(aim) * d, y: f.y + Math.sin(aim) * d, usedMeta: false, cx, cy };
    }
    const longSide = Math.max(set.w, set.h) || 1;
    const scale = targetLong / longSide;
    const dw = set.w * scale;
    const dh = set.h * scale;
    let lx = (uv[0] - 0.5) * dw;
    let ly = (uv[1] - 0.5) * dh;
    if (Math.cos(aim) < 0) ly = -ly;
    return {
      x: cx + lx * Math.cos(aim) - ly * Math.sin(aim),
      y: cy + lx * Math.sin(aim) + ly * Math.cos(aim),
      usedMeta: true, cx, cy,
    };
  }

  function meleeSwingAnchor(weaponId, fighter, spec, angle) {
    const reach = spec?.reach || fighter?.radius || 75;
    let factor = 0.46;
    if (weaponId === 'SPEAR') factor = 0.58;
    else if (weaponId === 'SPIKED_CLUB') factor = 0.42;
    else if (weaponId === 'BATTLE_AXE') factor = 0.50;
    else if (weaponId === 'SABRE') factor = 0.48;
    const d = Math.max((fighter?.radius || 75) * 0.65, reach * factor);
    return {
      x: fighter.x + Math.cos(angle) * d,
      y: fighter.y + Math.sin(angle) * d,
      angle,
    };
  }

  function pushVisual(visual) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    state.visuals.push(visual);
    if (state.visuals.length > 24) state.visuals.shift();
  }

  // Melee strike geometry: cone + reach around holder facing (handoff §7).
  // POST-C §5: damage flows through the ONE melee authority (CFG.meleeDamage),
  // shared by hand strikes and thrown strikes.
  function strikeCone(ctx, spec, weaponId, extra = {}) {
    const { fighter: f, enemy: e } = ctx;
    let hit = false;
    if (enemyAlive(ctx)) {
      const d = dist(f.x, f.y, e.x, e.y);
      const ang = Math.atan2(e.y - f.y, e.x - f.x);
      // V2 §A1/§A2: strike geometry follows the independent weapon aim angle,
      // never the fighter movement direction.
      let diff = Math.abs(ang - holderAim(ctx));
      if (diff > Math.PI) diff = TAU - diff;
      if (d <= spec.reach + e.radius * 0.35 && diff <= spec.halfAngle) {
        aqDamage(e, CFG.meleeDamage(weaponId), f, weaponId, { knockback: spec.knockback, stun: spec.stun, shake: spec.shake || 7, hitStop: spec.hitStop });
        hit = true;
      }
    }
    // Curated slash VFX + SFX come from the presentation layer (avCue melee_*).
    return hit;
  }

  // ---------------------------------------------------------------------------
  // POST-C §5 — thrown melee. Decision happens at pickup: opponent inside the
  // weapon's trigger range -> iconic attack; otherwise the ACTUAL sprite is
  // thrown straight at the opponent. No homing, swept-segment collision,
  // damage once on fighter hit, pin into the struck target ~1.0s following
  // it, then a physical exit. Wall ricochets with per-weapon budgets; when
  // the budget is exhausted the weapon exits physically. Never rewrites
  // fighter.dir — only a projectile is spawned.
  // ---------------------------------------------------------------------------
  function thrownSpec(weaponId) {
    return {
      speed: CFG.THROWN_MELEE.speed[weaponId] || 900,
      ricochets: CFG.THROWN_MELEE.ricochets[weaponId] ?? 2,
      spin: CFG.THROWN_MELEE.spinRate[weaponId] || 8,
    };
  }
  function meleeDrawLong(weaponId) {
    if (weaponId === 'STORMBREAKER') return (CFG.STORMBREAKER && CFG.STORMBREAKER.flightLongSide) || 209;
    return weaponId === 'SPEAR' ? 190 : weaponId === 'BATTLE_AXE' ? 155 : weaponId === 'SPIKED_CLUB' ? 150 : weaponId === 'DAGGER' ? 110 : 145;
  }
  function spawnThrownMelee(f, weaponId, angle, extra) {
    // HERO REWORK (doc-06): audited recording hook for TIME loop replay
    // (extra.__hrReplay marks a re-emission of a recorded throw).
    const __hrTag = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.onThrownMelee)
      ? window.APEX_HERO_REWORK.onThrownMelee(f, weaponId, angle, extra)
      : null;
    const t = thrownSpec(weaponId);
    const h = getHolder(f);
    const pose = (h && h.meta && h.meta.pose) || {};
    const r = f.radius || 75;
    const ox = r * 0.78 + (pose.localX || 0);
    const oy = pose.localY || 0;
    const x = f.x + Math.cos(angle) * ox + Math.cos(angle + Math.PI / 2) * oy;
    const y = f.y + Math.sin(angle) * ox + Math.sin(angle + Math.PI / 2) * oy;
    const long = meleeDrawLong(weaponId);
    // Correction pass: STORMBREAKER collision radius is the explicit
    // gameplay authority in arsenalConfig (THROWN_MELEE-free) — it must
    // not move when the presentation long side shrinks. Other thrown melee
    // keep the historical formula.
    const radius = weaponId === 'STORMBREAKER'
      ? ((CFG.STORMBREAKER && CFG.STORMBREAKER.thrownRadius) || Math.max(10, long * 0.14))
      : Math.max(10, long * 0.14);
    const nativeThrow={
      type: 'aq_thrown',
      aq: true,
      owner: f,
      weapon: weaponId,
      x, y,
      px: x, py: y,
      vx: Math.cos(angle) * t.speed,
      vy: Math.sin(angle) * t.speed,
      radius,
      ricochetsLeft: t.ricochets,
      state: 'flight',
      pinnedTo: null,
      pinTimer: 0,
      pinAngle: angle,
      rot: angle,
      spin: t.spin,
      // STORMBREAKER exception: the red-tier release has no collision-grace
      // window. At 1350 px/s the 0.35s grace would tunnel ~470px — a
      // point-blank throw would pass THROUGH the opponent and only connect
      // off a wall bounce, breaking the committed-release identity. Its own
      // 0.45s ready + 0.28s windup already gates the release (no accidental
      // instant throw), and a missed storm simply exits — it never
      // re-enters the floor pickup pool, so the original re-collect concern
      // the grace encoded does not apply.
      grace: weaponId === 'STORMBREAKER' ? 0 : (CFG.THROWN_MELEE.pickupDelay || 0),
      life: 6.0,
      maxLife: 6.0,
      // B1 missed-storm failsafe: a red-tier release that connects with
      // nothing must never linger as a live projectile — after maxFlight it
      // exits through the same physical tumble as ricochet exhaustion
      // (never a silent fade). Regular thrown melees keep the plain 6s life.
      flightTime: 0,
      maxFlight: weaponId === 'STORMBREAKER' ? ((CFG.STORMBREAKER && CFG.STORMBREAKER.maxFlightSeconds) || 2.2) : 0,
      // B7/B8: the thrown red-tier projectile is immune to hero manipulation
      // — crystal walls can't reflect/re-own it, magnet shells can't destroy
      // or reposition it, gravity wells can't pull/absorb it. Hero
      // manipulation can't redirect the pursuit.
      heroManipulationImmune: weaponId === 'STORMBREAKER',
      questRivetSuppression: weaponId === 'STORMBREAKER'
        && AQ.state?.questRivetPreview?.operator === f,
      __hr: __hrTag,
    };
    projectiles.push(nativeThrow);
    if(weaponId==='STORMBREAKER'&&AQ.state?.questTotProgression===true
      &&f.questId==='T.O.T'
      &&AQ.state.questTotStormNative?.onThrow?.(f,nativeThrow)!==true)
      throw Error('E08 real STORMBREAKER projectile identity denied');
    window.avCue('melee_throw', { weapon: weaponId, x: f.x, y: f.y, angle });
    log('THROW', `fighter=${f.name} weapon=${weaponId} ricochets=${t.ricochets}`);
  }
  function thrownExit(p) {
    // Physical exit: the sprite tumbles away under gravity; alpha cleanup
    // only in the final moments (presentation), never as the primary exit.
    if(p.questTotArtifactId&&p.questTotCommitResolution?.('MISS')!==true)
      throw Error('E08 Stormbreaker missed projectile exit receipt denied');
    p.state = 'exit';
    p.vx *= 0.35;
    p.vy = -140;
    p.spin *= 1.6;
    p.life = Math.min(p.life, 0.75);
  }

  function makeMelee(id, spriteKey, color, extra = {}) {
    const spec = CFG.WEAPONS[id];
    return {
      id,
      category: 'melee',
      spriteKey,
      // POST-C §5: the decision is made IMMEDIATELY at pickup — opponent
      // inside trigger range -> iconic attack; outside -> throw the actual
      // sprite straight at the opponent. The weapon is still not consumed on
      // pickup; it resolves through the chosen branch.
      onEquip(ctx) {
        const h = ctx.holder;
        h.phase = 'READY';
        h.meta.decision = (enemyAlive(ctx) && enemyDistance(ctx) <= spec.triggerRange) ? 'strike' : 'throw';
        log('MELEE_DECIDE', `fighter=${ctx.fighter.name} weapon=${id} decision=${h.meta.decision}`);
      },
      canActivate(ctx) { return ctx.holder.phase === 'READY' && ctx.holder.meta.decision != null; },
      activate(ctx) {
        const h = ctx.holder;
        if (h.meta.decision === 'throw') {
          // Straight throw along the independent weapon aim; never the
          // fighter movement direction and never a setDir rewrite.
          const angle = holderAim(ctx);
          spawnThrownMelee(ctx.fighter, id, angle);
          consume(ctx.fighter, 'thrown');
          return;
        }
        h.phase = 'WINDUP';
        h.meta.windupLeft = spec.windup;
        aimAtHolder(ctx);
        log('USE', `fighter=${ctx.fighter.name} weapon=${id}`);
        if (spec.windup > 0.3) {
          pushVisual({ kind: 'windup', x: ctx.fighter.x, y: ctx.fighter.y, owner: ctx.fighter, life: spec.windup, maxLife: spec.windup, color });
        }
      },
      update(ctx, dt) {
        const h = ctx.holder;
        if (h.phase !== 'WINDUP') return;
        h.meta.windupLeft -= dt;
        if (h.meta.windupLeft <= 0) {
          h.phase = 'STRIKE';
          // B6/B7/B9/B10: the cut/chop/thrust snap lives on the weapon pose;
          // the pose ghost carries its recovery after consume().
          const recipe = poseRecipe(id);
          if (h.meta.pose) {
            h.meta.pose.rotKick = recipe.strikeRot || 0.4;
            h.meta.pose.recoil = 6;
            if (recipe.thrustPx) { h.meta.pose.localX = recipe.thrustPx * 0.55; h.meta.pose.directLocalX = true; }
          }
          const attackAngle = holderAim(ctx);
          const anchor = meleeSwingAnchor(id, ctx.fighter, spec, attackAngle);
          window.avCue('melee_swing', { weapon: id, x: anchor.x, y: anchor.y, angle: anchor.angle });
          const landed = strikeCone(ctx, spec, id, { color });
          if (landed) window.avCue('melee_hit', { weapon: id, x: ctx.enemy.x, y: ctx.enemy.y, angle: attackAngle });
          consume(ctx.fighter, 'melee-resolved');
        }
      },
      ...extra,
    };
  }

  // POST-C §3: one gun pipeline serves every firing family that fires
  // sequential shots (SEMI/AUTO/BURST, plus AUTOSHOT with pellets>0 which
  // releases a pellet fan per shot). All per-gun differences are DATA.
  function makeGun(id, spriteKey, color, extra = {}) {
    const spec = CFG.WEAPONS[id];
    const family = spec.family || 'SEMI';
    const casingPower = family === 'AUTO' ? 0.8 : family === 'PRECISION' ? 1.2 : 1;
    function fireOneShot(ctx, f) {
      const base = enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x);
      const muz = weaponWorldAnchor(f, id, 'muzzle', base);
      const pellets = spec.pellets > 1 ? spec.pellets : 1;
      const blastCrit = pellets > 1 ? rollFirearmCrit(id) : null;
      // HERO REWORK (doc-06): audited SNIPER-nest spread multiplier hook.
      const __hrSpread = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.spreadScaleFor)
        ? window.APEX_HERO_REWORK.spreadScaleFor(f) : 1;
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1);
        const spread = (Math.random() * 2 - 1) * (spec.spread || 0) * __hrSpread + (pellets > 1 ? (t - 0.5) * (spec.cone || 0) : 0);
        const angle = base + spread;
        fireBullet({
          owner: f,
          x: muz.x,
          y: muz.y,
          angle,
          speed: spec.bulletSpeed * (pellets > 1 ? (0.92 + Math.random() * 0.16) : 1),
          damage: pellets > 1 ? spec.damagePerPellet : spec.damagePerShot,
          radius: spec.bulletRadius,
          life: spec.bulletLife,
          weapon: id,
          critical: pellets > 1 ? blastCrit : rollFirearmCrit(id),
          knockback: pellets > 1 ? spec.knockback / pellets : spec.knockback,
          stun: spec.stun,
          color,
          finalShot:ctx.holder.shotsFired+1===spec.shots,
        });
      }
      window.avCue('fire', {
        weapon: id, family, sfx: spec.sfx, sfxRate: spec.sfxRate, vfx: spec.vfx,
        x: muz.x, y: muz.y, angle: base, usedMeta: muz.usedMeta,
      });
      ejectCasing(f, base, casingPower, id);
      log('SHOT', `fighter=${f.name} weapon=${id} t=${(typeof matchClock === 'number' ? matchClock : 0).toFixed(3)}`);
    }
    return {
      id,
      category: 'ranged',
      spriteKey,
      onEquip(ctx) { ctx.holder.phase = 'READY'; },
      canActivate(ctx) {
        return ctx.holder.phase === 'READY'
          && enemyAlive(ctx)
          && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS
          && (!spec.triggerRange || enemyDistance(ctx) <= spec.triggerRange);
      },
      activate(ctx) {
        const h = ctx.holder;
        h.phase = 'FIRING';
        h.meta.nextShot = 0;
        log('USE', `fighter=${ctx.fighter.name} weapon=${id}`);
      },
      update(ctx, dt) {
        const h = ctx.holder;
        if (h.phase !== 'FIRING') return;
        const f = ctx.fighter;
        h.meta.nextShot -= dt;
        let fired = false;
        while (h.meta.nextShot <= 0 && h.shotsFired < spec.shots) {
          fireOneShot(ctx, f);
          h.shotsFired += 1;
          const burstSize = spec.burstSize || 0;
          const atBurstEnd = burstSize > 0 && (h.shotsFired % burstSize === 0) && h.shotsFired < spec.shots;
          h.meta.nextShot += atBurstEnd ? (spec.burstPause || spec.interval) : spec.interval;
          poseKick(h, poseRecipe(id));
          fired = true;
        }
        if (fired) {
          cameraShake = Math.max(cameraShake, family === 'AUTOSHOT' ? 6 : 3);
          playFighterSound(f, 'skill');
        }
        const need = spec.shots || 1;
        if (h.shotsFired >= need) {
          const dump = family === 'AUTOSHOT' || family === 'SHOTGUN' || need === 1;
          if (dump || h.meta.nextShot <= 0) consume(f, 'sequence-complete');
        }
      },
      ...extra,
    };
  }

  // POST-C §3: instant pellet-fan blast (SHOTGUN family), parameterized —
  // same C pipeline as the SPAS 12, different data per gun.
  function makeBlastGun(id, color) {
    const spec = CFG.WEAPONS[id];
    return {
      id,
      category: 'ranged',
      spriteKey: null,
      onEquip(ctx) { ctx.holder.phase = 'READY'; },
      canActivate(ctx) {
        return ctx.holder.phase === 'READY'
          && enemyAlive(ctx)
          && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS
          && enemyDistance(ctx) <= spec.triggerRange;
      },
      activate(ctx) {
        const h = ctx.holder;
        h.phase = 'FIRING';
        const f = ctx.fighter;
        const base = angleToEnemy(ctx);
        const muz = weaponWorldAnchor(f, id, 'muzzle', base);
        const blastCrit = rollFirearmCrit(id);
        for (let i = 0; i < spec.pellets; i++) {
          const t = spec.pellets === 1 ? 0.5 : i / (spec.pellets - 1);
          const angle = base + (t - 0.5) * spec.cone;
          fireBullet({
            owner: f,
            x: muz.x,
            y: muz.y,
            angle,
            speed: spec.bulletSpeed * (0.92 + Math.random() * 0.16),
            damage: spec.damagePerPellet,
            radius: spec.bulletRadius,
            life: spec.bulletLife,
            weapon: id,
            critical: blastCrit,
            knockback: spec.knockback / spec.pellets,
            color,
          });
        }
        window.avCue('fire', {
          weapon: id, family: 'SHOTGUN', sfx: spec.sfx, sfxRate: spec.sfxRate, vfx: spec.vfx,
          x: muz.x, y: muz.y, angle: base, usedMeta: muz.usedMeta,
        });
        if (!spec.noPumpRack) window.avCue('shotgun_rack', { weapon: id, x: f.x, y: f.y, angle: base });
        ejectCasing(f, base, 1.4, id);
        spawnShockwave(f.x, f.y, color || '#ffbe6b', 130);
        cameraShake = Math.max(cameraShake, 9);
        hitStop = Math.max(hitStop, 0.03);
        playFighterSound(f, 'skill');
        log('USE', `fighter=${f.name} weapon=${id}`);
        h.shotsFired = 1;
        poseKick(h, poseRecipe(id));
        consume(f, 'blast-resolved');
      },
      update() {},
    };
  }

  // POST-C §3: aim-then-release precision family, parameterized from the
  // registry (aimTime / damage / bulletSpeed). Same C pipeline as the Snipex.
  function makePrecisionGun(id, color) {
    const spec = CFG.WEAPONS[id];
    return {
      id,
      category: 'ranged',
      spriteKey: null,
      onEquip(ctx) { ctx.holder.phase = 'READY'; },
      canActivate(ctx) {
        return ctx.holder.phase === 'READY' && enemyAlive(ctx) && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS;
      },
      activate(ctx) {
        const h = ctx.holder;
        h.phase = 'AIM';
        h.meta.aimLeft = spec.aimTime;
        log('USE', `fighter=${ctx.fighter.name} weapon=${id}`);
        playFighterSound(ctx.fighter, 'skill');
        window.avCue('sniper_aim', { x: ctx.fighter.x, y: ctx.fighter.y, angle: enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x) });
      },
      update(ctx, dt) {
        const h = ctx.holder;
        const f = ctx.fighter;
        if (h.phase === 'AIM') {
          // Visible aim telegraph; weapon tracks via holder.meta.aimAngle (§A2).
          if (enemyAlive(ctx)) {
            pushVisual({ kind: 'aimline', x1: f.x, y1: f.y, x2: ctx.enemy.x, y2: ctx.enemy.y, life: 0.06, maxLife: 0.06, color: '#ff4a4a' });
          }
          h.meta.aimLeft -= dt;
          const recipe = poseRecipe(id);
          const progress = clamp(1 - Math.max(0, h.meta.aimLeft) / spec.aimTime, 0, 1);
          const p = h.meta.pose;
          const flourishAfter = recipe.flourishAfter != null ? recipe.flourishAfter : 0.55;
          if (progress >= flourishAfter && h.meta.aimLeft > 0) {
            if (!h.meta.chambered) {
              h.meta.chambered = true;
              window.avCue('sniper_bolt_lock', { weapon: id, x: f.x, y: f.y, angle: enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x) });
            }
            const spinT = (progress - flourishAfter) / (1 - flourishAfter);
            p.flourish = spinT * TAU * (recipe.flourishTurns || 1.5);
            p.holdFlourish = true;
          }
          if (h.meta.aimLeft <= 0) {
            if (p) { p.flourish = 0; p.holdFlourish = false; }
            poseKick(h, recipe);
            // HERO REWORK (doc-06): audited SNIPER-nest spread multiplier hook.
            const __hrSpread = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.spreadScaleFor)
              ? window.APEX_HERO_REWORK.spreadScaleFor(ctx.fighter) : 1;
            const spread = (Math.random() * 2 - 1) * (spec.spread || 0.02) * __hrSpread;
            const angle = (enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x)) + spread;
            const muz = weaponWorldAnchor(f, id, 'muzzle', angle);
            fireBullet({
              owner: f,
              x: muz.x,
              y: muz.y,
              angle,
              speed: spec.bulletSpeed,
              damage: spec.damage,
              radius: spec.bulletRadius,
              life: spec.bulletLife,
              weapon: id,
              critical: rollFirearmCrit(id),
              knockback: spec.knockback,
              stun: spec.stun,
              color: color || '#f4f4f4',
            });
            cameraShake = Math.max(cameraShake, 8);
            triggerFlash(255, 250, 235, 0.12);
            playFighterSound(f, 'skill');
            window.avCue('sniper_shot', {
              x: muz.x, y: muz.y, angle, weapon: id, sfxRate: spec.sfxRate, vfx: spec.vfx, usedMeta: muz.usedMeta,
            });
            ejectCasing(f, angle, 1.2, id);
            log('SHOT', `fighter=${f.name} weapon=${id} t=${(typeof matchClock === 'number' ? matchClock : 0).toFixed(3)}`);
            h.shotsFired = (h.shotsFired || 0) + 1;
            const need = spec.shots || 1;
            if (h.shotsFired >= need) consume(f, 'shot-fired');
            else {
              h.meta.aimLeft = spec.interval || 0.45;
              h.meta.chambered = false;
            }
          }
        }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // The 12 P0 weapons (handoff §7). Sprite keys per P0_ASSET_MANIFEST.csv.
  // ---------------------------------------------------------------------------
  const WEAPONS = {
    PISTOL: makeGun('PISTOL', 'G01_pistol', '#ffe08a'),

    SHOTGUN: makeGun('SHOTGUN', 'G03_shotgun', '#ffbe6b'),
    _SHOTGUN_LEGACY: (() => {
      const spec = CFG.WEAPONS.SHOTGUN;
      return {
        id: 'SHOTGUN_LEGACY',
        category: 'ranged',
        spriteKey: 'G03_shotgun',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY'
            && enemyAlive(ctx)
            && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS
            && enemyDistance(ctx) <= spec.triggerRange;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'FIRING';
          const f = ctx.fighter;
          const base = angleToEnemy(ctx);
          for (let i = 0; i < spec.pellets; i++) {
            const t = spec.pellets === 1 ? 0.5 : i / (spec.pellets - 1);
            const angle = base + (t - 0.5) * spec.cone;
            fireBullet({
              owner: f,
              x: f.x + Math.cos(angle) * (f.radius * 0.7),
              y: f.y + Math.sin(angle) * (f.radius * 0.7),
              angle,
              speed: spec.bulletSpeed * (0.92 + Math.random() * 0.16),
              damage: spec.damagePerPellet,
              radius: spec.bulletRadius,
              life: spec.bulletLife,
              weapon: 'SHOTGUN',
              knockback: spec.knockback / spec.pellets,
              color: '#ffbe6b',
            });
          }
          const muzzleDistance = gunMuzzleDistance('SHOTGUN', f);
          window.avCue('fire', { weapon: 'SHOTGUN', x: f.x + Math.cos(base) * muzzleDistance, y: f.y + Math.sin(base) * muzzleDistance, angle: base });
          window.avCue('shotgun_rack', { weapon: 'SHOTGUN', x: f.x, y: f.y, angle: base });
          ejectCasing(f, base, 1.4);
          spawnShockwave(f.x, f.y, '#ffbe6b', 130);
          cameraShake = Math.max(cameraShake, 9);
          hitStop = Math.max(hitStop, 0.03);
          playFighterSound(f, 'skill');
          log('USE', `fighter=${f.name} weapon=SHOTGUN`);
          h.shotsFired = 1;
          poseKick(h, poseRecipe('SHOTGUN')); // one heavy weapon-only recoil (B2)
          consume(f, 'blast-resolved');
        },
        update() {},
      };
    })(),

    SMG: makeGun('SMG', 'G05_smg', '#b9f6ca'),

    SNIPER: (() => {
      const spec = CFG.WEAPONS.SNIPER;
      return {
        id: 'SNIPER',
        category: 'ranged',
        spriteKey: 'G08_sniper_rifle',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY' && enemyAlive(ctx) && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'AIM';
          h.meta.aimLeft = spec.aimTime;
          log('USE', `fighter=${ctx.fighter.name} weapon=SNIPER`);
          playFighterSound(ctx.fighter, 'skill');
          window.avCue('sniper_aim', { x: ctx.fighter.x, y: ctx.fighter.y, angle: enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x) });
        },
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase === 'AIM') {
            // Visible aim telegraph so the shot feels dangerous before firing.
            // The weapon tracks the opponent via holder.meta.aimAngle (§A2);
            // the fighter body is never steered (§A1).
            if (enemyAlive(ctx)) {
              pushVisual({ kind: 'aimline', x1: f.x, y1: f.y, x2: ctx.enemy.x, y2: ctx.enemy.y, life: 0.06, maxLife: 0.06, color: '#ff4a4a' });
            }
            h.meta.aimLeft -= dt;
            // B4: distinctive pre-fire preparation — stylized weapon spin during
            // the latter part of the aim, chamber beat, then snap onto target.
            const recipe = poseRecipe('SNIPER');
            const progress = clamp(1 - Math.max(0, h.meta.aimLeft) / spec.aimTime, 0, 1);
            const p = h.meta.pose;
            if (progress >= recipe.flourishAfter && h.meta.aimLeft > 0) {
              if (!h.meta.chambered) {
                h.meta.chambered = true;
                window.avCue('sniper_bolt_lock', { weapon: 'SNIPER', x: f.x, y: f.y, angle: enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x) });
              }
              const spinT = (progress - recipe.flourishAfter) / (1 - recipe.flourishAfter);
              p.flourish = spinT * TAU * recipe.flourishTurns;
              p.holdFlourish = true;
            }
            if (h.meta.aimLeft <= 0) {
              if (p) { p.flourish = 0; p.holdFlourish = false; } // snap exactly onto target
              poseKick(h, recipe); // strong long recoil
              const angle = enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x);
              const muz = weaponWorldAnchor(f, 'SNIPER', 'muzzle', angle);
              fireBullet({
                owner: f,
                x: muz.x,
                y: muz.y,
                angle,
                speed: spec.bulletSpeed,
                damage: spec.damage,
                radius: spec.bulletRadius,
                life: spec.bulletLife,
                weapon: 'SNIPER',
                knockback: spec.knockback,
                color: '#f4f4f4',
                finalShot:true,
              });
              cameraShake = Math.max(cameraShake, 8);
              triggerFlash(255, 250, 235, 0.12);
              playFighterSound(f, 'skill');
              window.avCue('sniper_shot', { x: muz.x, y: muz.y, angle, weapon: 'SNIPER', usedMeta: muz.usedMeta });
              ejectCasing(f, angle, 1.2, 'SNIPER');
              log('SHOT', `fighter=${f.name} weapon=SNIPER t=${(typeof matchClock === 'number' ? matchClock : 0).toFixed(3)}`);
              consume(f, 'shot-fired');
            }
          }
        },
      };
    })(),

    GRENADE: (() => {
      const spec = CFG.WEAPONS.GRENADE;
      return {
        id: 'GRENADE',
        category: 'ranged',
        spriteKey: 'G10_grenade',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) { return ctx.holder.phase === 'READY' && enemyAlive(ctx) && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS; },
        update(ctx) {
          // B5: short backward draw while the throw is winding up; the forward
          // throw motion is carried by the pose ghost after the release.
          const h = ctx.holder;
          if (h.phase === 'READY' && h.meta.pose) h.meta.pose.localTargetX = -(poseRecipe('GRENADE').drawBack || 18);
        },
        activate(ctx) {
          const f = ctx.fighter;
          const angle = angleToEnemy(ctx);
          // Lob so the grenade lands near the target around fuse time; walls
          // still bounce it when the arena geometry gets in the way.
          const targetDist = enemyDistance(ctx);
          const lobSpeed = clamp((targetDist / spec.fuse) * 0.8, 240, spec.throwSpeed);
          throwGrenade({
            owner: f,
            x: f.x + Math.cos(angle) * (f.radius * 0.7),
            y: f.y + Math.sin(angle) * (f.radius * 0.7),
            angle,
            speed: lobSpeed,
            weapon: 'GRENADE',
          });
          log('USE', `fighter=${f.name} weapon=GRENADE`);
          playFighterSound(f, 'skill');
          window.avCue('grenade_throw', { x: f.x + Math.cos(angle) * (f.radius + 24), y: f.y + Math.sin(angle) * (f.radius + 24), angle });
          // Consumed immediately after throw; grenade stays in world until it resolves.
          consume(f, 'thrown');
        },
      };
    })(),

    SABRE: makeMelee('SABRE', 'M01_sabre', '#c9e6ff'),
    BATTLE_AXE: makeMelee('BATTLE_AXE', 'M04_battle_axe', '#ffb3a0'),

    // STORMBREAKER — first red-tier (T6) fantasy weapon. The attack identity
    // is locked (V1 port, docs/stormbreaker/v1-port): there is no melee
    // strike/throw fork. After a short committed windup the ACTUAL weapon is
    // released at the opponent through the standard aq_thrown lifecycle
    // (swept-segment collision, wall ricochet budget, bounded homing
    // pursuit, physical exit on a miss). On a confirmed hit the weapon
    // vanishes through the impact flash instead of pinning (see
    // updateArsenalProjectiles).
    STORMBREAKER: (() => {
      const T = CFG.STORMBREAKER || { windupSeconds: 0.28, readyDelaySeconds: 0.45 };
      return {
        id: 'STORMBREAKER',
        category: 'melee',
        spriteKey: 'STORMBREAKER',
        exit: 'stormRelease',
        onEquip(ctx) {
          ctx.holder.phase = 'READY';
          ctx.holder.meta.decision = 'throw';
          log('MELEE_DECIDE', `fighter=${ctx.fighter.name} weapon=STORMBREAKER decision=throw`);
        },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY'
            && enemyAlive(ctx)
            && ctx.holder.elapsed >= T.readyDelaySeconds;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'WINDUP';
          h.meta.windupLeft = T.windupSeconds;
          aimAtHolder(ctx);
          window.avCue('storm_windup', { weapon: 'STORMBREAKER', x: ctx.fighter.x, y: ctx.fighter.y });
          pushVisual({ kind: 'windup', x: ctx.fighter.x, y: ctx.fighter.y, owner: ctx.fighter, life: T.windupSeconds, maxLife: T.windupSeconds, color: '#7fd4ff' });
          log('USE', `fighter=${ctx.fighter.name} weapon=STORMBREAKER`);
        },
        update(ctx, dt) {
          const h = ctx.holder;
          if (h.phase !== 'WINDUP') return;
          h.meta.windupLeft -= dt;
          if (h.meta.windupLeft > 0) return;
          // Committed heavy release: the real sprite flies, aimed at the
          // living opponent at the moment of release (independent weapon
          // aim, never fighter.dir); the bounded homing pursuit then steers
          // it after the opponent if they move (B8).
          const angle = holderAim(ctx);
          spawnThrownMelee(ctx.fighter, 'STORMBREAKER', angle);
          window.avCue('storm_throw', { weapon: 'STORMBREAKER', x: ctx.fighter.x, y: ctx.fighter.y, angle });
          consume(ctx.fighter, 'thrown');
        },
      };
    })(),

    DAGGER: (() => {
      const spec = CFG.WEAPONS.DAGGER;
      return {
        id: 'DAGGER',
        category: 'melee',
        spriteKey: 'M08_dagger',
        // POST-C §5: same immediate pickup decision as the other melee —
        // in range the iconic thrust, out of range an actual thrown dagger
        // (highest ricochet budget: 4 walls).
        onEquip(ctx) {
          const h = ctx.holder;
          h.phase = 'READY';
          h.meta.decision = (enemyAlive(ctx) && enemyDistance(ctx) <= spec.triggerRange) ? 'strike' : 'throw';
          log('MELEE_DECIDE', `fighter=${ctx.fighter.name} weapon=DAGGER decision=${h.meta.decision}`);
        },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY' && ctx.holder.meta.decision != null;
        },
        activate(ctx) {
          const h = ctx.holder;
          if (h.meta.decision === 'throw') {
            const angle = holderAim(ctx);
            spawnThrownMelee(ctx.fighter, 'DAGGER', angle);
            consume(ctx.fighter, 'thrown');
            return;
          }
          h.phase = 'DASH';
          h.meta.dashLeft = spec.dashTime;
          h.meta.hitDone = false;
          log('USE', `fighter=${ctx.fighter.name} weapon=DAGGER`);
          playFighterSound(ctx.fighter, 'skill');
          // V2 §A1: weapon-only thrust — the fighter body keeps its Apex
          // trajectory; only the dagger lunges toward the opponent.
          const thrustAngle = holderAim(ctx);
          const thrustOffset = ctx.fighter.radius + 48;
          window.avCue('melee_swing', {
            weapon: 'DAGGER',
            x: ctx.fighter.x + Math.cos(thrustAngle) * thrustOffset,
            y: ctx.fighter.y + Math.sin(thrustAngle) * thrustOffset,
            angle: thrustAngle,
          });
          pushVisual({
            kind: 'thrust',
            owner: ctx.fighter,
            life: spec.dashTime,
            maxLife: spec.dashTime,
            reach: spec.dashSpeed * spec.dashTime,
            color: '#e8f4ff',
          });
        },
        update(ctx, dt) {
          const h = ctx.holder;
          if (h.phase !== 'DASH') return;
          const f = ctx.fighter;
          // Weapon-only thrust probe swept along the independent aim angle.
          const progress = clamp(1 - Math.max(0, h.meta.dashLeft) / spec.dashTime, 0, 1);
          const extension = (spec.dashSpeed * spec.dashTime) * Math.sin(progress * Math.PI);
          // B8: the dagger sprite itself lunges (weapon-only, ~78px peak).
          if (h.meta.pose) { h.meta.pose.localX = Math.min(extension, poseRecipe('DAGGER').thrustPx); h.meta.pose.directLocalX = true; }
          const ang = holderAim(ctx);
          const tipX = f.x + Math.cos(ang) * (f.radius * 0.6 + extension);
          const tipY = f.y + Math.sin(ang) * (f.radius * 0.6 + extension);
          if (!h.meta.hitDone && enemyAlive(ctx)
            && distPointToSegment(ctx.enemy.x, ctx.enemy.y, f.x, f.y, tipX, tipY) < ctx.enemy.radius + spec.hitBonus) {
            h.meta.hitDone = true;
            // POST-C §5: ONE melee damage authority (C value x1.5).
            aqDamage(ctx.enemy, CFG.meleeDamage('DAGGER'), f, 'DAGGER', { shake: 5 });
            emitParticles(ctx.enemy.x, ctx.enemy.y, '#e8f4ff', 16, 340, 4, 0.4, 'square');
            window.avCue('melee_hit', { weapon: 'DAGGER', x: ctx.enemy.x, y: ctx.enemy.y, angle: ang });
          }
          h.meta.dashLeft -= dt;
          if (h.meta.dashLeft <= 0) consume(f, h.meta.hitDone ? 'stab-landed' : 'stab-whiffed');
        },
      };
    })(),

    SPEAR: makeMelee('SPEAR', 'M10_spear', '#d9ffb3'),
    SPIKED_CLUB: makeMelee('SPIKED_CLUB', 'M12_spiked_club', '#e6c9ff'),

    SWIRL_SHIELD: (() => {
      const spec = CFG.WEAPONS.SWIRL_SHIELD;
      return {
        id: 'SWIRL_SHIELD',
        category: 'defense',
        spriteKey: 'D03_swirl_shield',
        onEquip(ctx) {
          ctx.holder.phase = 'GUARD';
          ctx.holder.meta.timer = spec.duration;
          log('USE', `fighter=${ctx.fighter.name} weapon=SWIRL_SHIELD`);
          window.avCue('shield_activate', { weapon: 'SWIRL_SHIELD', x: ctx.fighter.x, y: ctx.fighter.y });
        },
        canActivate() { return false; },
        activate() {},
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase !== 'GUARD') return;
          h.meta.timer -= dt;
          // B11: faces opponent with a subtle idle settle (weapon-only wobble).
          if (h.meta.pose) h.meta.pose.rotKick = poseRecipe('SWIRL_SHIELD').idleSettle * Math.sin(h.elapsed * 8.4);
          // Reflect the first eligible hostile projectile that comes close.
          for (const p of projectiles) {
            const reflectable=p?.type==='aq_bullet'||(p?.type==='aq_v43'
              &&V43[p.weapon]?.reflectableKinds?.includes(p.kind)
              &&(p.kind!=='mine'||p.phase==='flight'));
            if(!p||!reflectable||!p.owner||p.owner===f||p.aqReflected
              ||p.__hr?.crystalReflected||p.__hr?.cryHold)continue;
            if (dist(p.x, p.y, f.x, f.y) > spec.reflectRadius + p.radius) continue;
            const toHolder = { x: f.x - p.x, y: f.y - p.y };
            if (p.vx * toHolder.x + p.vy * toHolder.y <= 0) continue; // moving away
            const originalOwner = p.owner;
            const speed = Math.hypot(p.vx, p.vy) || 700;
            p.owner = f; // ownership switches to the reflector
            p.aqReflected = true;
            if(p.kind==='boomerang'){
              const thrownHolder=getHolder(originalOwner);
              if(thrownHolder?.weaponId===p.weapon)
                thrownHolder.meta.v43Interrupted=true;
            }
            const back = norm(originalOwner.x - p.x || 1, originalOwner.y - p.y);
            p.vx = back.x * speed * 1.08;
            p.vy = back.y * speed * 1.08;
            window.avCue('reflect', { x: p.x, y: p.y, angle: Math.atan2(back.y, back.x) });
            spawnShockwave(p.x, p.y, '#9fe8ff', 150);
            emitParticles(p.x, p.y, '#cff4ff', 22, 420, 5, 0.5, 'square');
            // POST-C §8: the reflect reads through shockwave + particles + SFX,
            // never a floating word.
            if (h.meta.pose) { // brief forward pop/tilt on the shield only
              h.meta.pose.recoil = -poseRecipe('SWIRL_SHIELD').reflectPop;
              h.meta.pose.rotKick = poseRecipe('SWIRL_SHIELD').reflectRot;
            }
            cameraShake = Math.max(cameraShake, 6);
            playFighterSound(f, 'skill');
            log('REFLECT', `fighter=${f.name} weapon=SWIRL_SHIELD projectileFrom=${originalOwner.name}`);
            if (!h.meta.boundWeaponId) consume(f, 'reflect-resolved');
            else if (shieldBoundGone(h)) consume(f, 'bound-over');
            return;
          }
          if (h.meta.boundWeaponId) {
            if (shieldBoundGone(h) || h.elapsed > 12) consume(f, 'expired');
          } else if (h.meta.timer <= 0) consume(f, 'expired');
        },
      };
    })(),

    TOWER_SHIELD: (() => {
      const spec = CFG.WEAPONS.TOWER_SHIELD;
      return {
        id: 'TOWER_SHIELD',
        category: 'defense',
        spriteKey: 'D07_tower_shield',
        onEquip(ctx) {
          ctx.holder.phase = 'GUARD';
          ctx.holder.meta.timer = spec.duration;
          log('USE', `fighter=${ctx.fighter.name} weapon=TOWER_SHIELD`);
          window.avCue('shield_activate', { weapon: 'TOWER_SHIELD', x: ctx.fighter.x, y: ctx.fighter.y });
        },
        canActivate() { return false; },
        activate() {},
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase !== 'GUARD') return;
          h.meta.timer -= dt;
          // B12: visible forward guard pose (weapon-only offset toward opponent).
          if (h.meta.pose) h.meta.pose.localTargetX = poseRecipe('TOWER_SHIELD').guardForward;
          // Movement penalty while the fortress state is up (engine slow status).
          f.applyStatus('slow', 0.25, { mult: spec.speedMult });
          if (h.meta.boundWeaponId) {
            if (shieldBoundGone(h) || h.elapsed > 12) consume(f, 'expired');
          } else if (h.meta.timer <= 0) consume(f, 'expired');
        },
      };
    })(),
  };

  // ---------------------------------------------------------------------------
  // POST-C §3 — every staged Senko v9 gun is a real, separately spawnable
  // weapon. The 20 new entries are generated from GUN_REGISTRY data through
  // the shared family executors above; no per-gun hand-written runtimes.
  // ---------------------------------------------------------------------------
  const REGISTRY_COLORS = {
    SEMI: '#ffe08a', AUTO: '#b9f6ca', BURST: '#d7f7a8',
    PRECISION: '#f4f4f4', SHOTGUN: '#ffbe6b', AUTOSHOT: '#ffc98a',
  };
  for (const entry of (CFG.GUN_REGISTRY || [])) {
    if (entry.compat || WEAPONS[entry.id]) continue;
    if(entry.special){WEAPONS[entry.id]=makeV43Special(entry.id);continue;}
    const color = REGISTRY_COLORS[entry.family] || '#ffe08a';
    if (entry.family === 'PRECISION') WEAPONS[entry.id] = makePrecisionGun(entry.id, color);
    else if (entry.family === 'SHOTGUN') WEAPONS[entry.id] = makeBlastGun(entry.id, color);
    else WEAPONS[entry.id] = makeGun(entry.id, null, color);
  }

  // V4.3 special devices use the same equip/update loop but a separate
  // executor, NEVER a fake default firearm family.
  for(const id of (CFG.V43_SPECIAL_IDS||[]))WEAPONS[id]=makeV43Special(id);

  // ---------------------------------------------------------------------------
  // Per-frame holder driver — called by the mode runtime for each fighter.
  // ---------------------------------------------------------------------------
  function updateHolder(f, dt) {
    tickPoseGhost(f, dt); // ghosts must animate after consume() cleared the holder
    const h = getHolder(f);
    if (!h || f.hp <= 0) return;
    h.elapsed += dt;
    const ctx = makeCtx(f);
    ctx.holder = h;
    // Independent weapon aim (V2 §A2): continuous opponent facing, damped ~60ms.
    h.meta = h.meta || {};
    h.meta.aimAngle = h.meta.aimAngle == null ? logicalAim(ctx) : dampAngle(h.meta.aimAngle, logicalAim(ctx), dt);
    integratePose(h, dt); // Checkpoint B: weapon pose springs (weapon-only motion)
    tickPoseGhost(f, dt);
    if (h.phase === 'READY' && h.def.canActivate && h.def.canActivate(ctx)) {
      h.def.activate(ctx);
    }
    if (h.def.update) h.def.update(ctx, dt);
  }

  // V4.3 Gold authored impact mass. Gold blasts use layered soft pressure,
  // staggering billows, discontinuous arcs and sparks, never a generic solid
  // explosion circle or repeating five-segment ring for every weapon.
  function v43GoldImpact(ctx,v,life){
    const kind=v.kind.slice(4),age=1-life,blast=kind==='blast';
    if(kind==='smoke'){
      ctx.save();ctx.translate(v.x,v.y);ctx.rotate((v.angle||0)+Math.sin(v.seed||0)*.3);
      ctx.scale(1.35,.78);
      for(let i=0;i<4;i++){
        const x=-i*11*age+(i-2)*7,y=Math.sin((v.seed||0)+i*2.1)*11;
        const radius=(20+i*5)*(1+age*1.45);
        const g=ctx.createRadialGradient(x-radius*.22,y,2,x,y,radius);
        const alpha=(.21-i*.023)*Math.sin(Math.PI*Math.pow(age,.65));
        g.addColorStop(0,'rgba(138,143,149,'+alpha+')');
        g.addColorStop(.62,'rgba(88,93,105,'+(alpha*.68)+')');
        g.addColorStop(1,'rgba(37,43,51,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
      }
      ctx.restore();return;
    }
    const plasma=kind==='plasma'||kind==='split';
    const radius=(blast?120:plasma?62:40)*(v.scale||1);
    ctx.save();ctx.translate(v.x,v.y);
    ctx.globalCompositeOperation='lighter';
    if(blast){
      const flash=Math.pow(life,1.25),r=radius*(.32+1.15*age);
      const g=ctx.createRadialGradient(0,0,4,0,0,r);
      g.addColorStop(0,'rgba(255,249,212,'+(.95*flash)+')');
      g.addColorStop(.13,'rgba(255,205,102,'+(.70*flash)+')');
      g.addColorStop(.41,'rgba(238,113,39,'+(.37*flash)+')');
      g.addColorStop(.74,'rgba(173,58,40,'+(.16*flash)+')');
      g.addColorStop(1,'rgba(94,51,38,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      for(let i=0;i<17;i++){
        const theta=i*2.399963+(v.x*13+v.y*.3)*.002;
        const variation=.72+.27*Math.sin(i*4.7+v.y*.09);
        const dist=radius*(.10+.45*age)*variation;
        const x=Math.cos(theta)*dist,y=Math.sin(theta)*dist*.77;
        const puff=radius*(.22+.14*(i%4)/4+.23*age);
        const alpha=(.17+(i%4)*.035)*life;
        ctx.save();ctx.translate(x,y);ctx.rotate(theta);ctx.scale(1.24,.82);
        const smoke=ctx.createRadialGradient(-puff*.2,0,puff*.04,0,0,puff);
        smoke.addColorStop(0,i%3===0?'rgba(255,189,107,'+(alpha*1.4)+')':'rgba(120,84,78,'+alpha+')');
        smoke.addColorStop(.57,i%3===0?'rgba(210,93,39,'+(alpha*.8)+')':'rgba(94,86,88,'+(alpha*.64)+')');
        smoke.addColorStop(1,'rgba(48,55,65,0)');
        ctx.fillStyle=smoke;ctx.beginPath();ctx.arc(0,0,puff,0,TAU);ctx.fill();
        ctx.restore();
      }
    }
    if(blast){
      // Exact GOLD drawBlast pressure arcs: 5 broken arcs with per-arc
      // asymmetry, light falloff and stroke mass tied to the blast radius.
      // Match the owner Lab's Canvas trace BEFORE variant debris is added.
      for(let i=0;i<5;i++){
        const rot=v.x*.043+i*TAU/5;
        ctx.strokeStyle=i%2?'#ffe3b6':'#d88562';ctx.globalAlpha=Math.pow(life,1.25)*.28;
        ctx.lineWidth=Math.max(.7,3*life);ctx.lineCap='round';ctx.beginPath();
        ctx.arc(0,0,radius*(.22+.78*age)*(1+.018*Math.sin(i+v.y)),
          rot,rot+.50+age*.42);ctx.stroke();
      }
    }else{
      ctx.strokeStyle=plasma?'#cf92ff':'#f3d4a4';ctx.lineCap='round';
      for(let i=0;i<2;i++){
        const theta=v.x*.043+i*Math.PI*.91+age*.45;
        ctx.globalAlpha=life*.7;
        ctx.lineWidth=Math.max(1.1,(3-i*.7)*(1-age*.62));
        ctx.beginPath();ctx.arc(0,0,radius*(.18+age*.42),
          theta,theta+.45+age*.17);ctx.stroke();
      }
    }
    if(blast){
      const mine=v.weapon==='SHRAPNEL_MINE_LAUNCHER';
      for(let i=0;i<(mine?32:21);i++){
        const a=i*2.399963+v.x*.017;
        const reach=radius*(.22+age*(mine?1.55:1.1))*(.55+.45*Math.sin(i*17.1)**2);
        ctx.globalAlpha=life*(i%3===0?.8:.48);ctx.lineWidth=Math.max(1,3.4*(1-age));
        ctx.strokeStyle=mine?(i%2?'#ffe2a0':'#f0a34e'):(i%2?'#ffe9cf':'#f2a56b');
        ctx.beginPath();ctx.moveTo(Math.cos(a)*reach*.43,Math.sin(a)*reach*.43);
        ctx.lineTo(Math.cos(a)*reach,Math.sin(a)*reach);ctx.stroke();
      }
    }
    if(plasma){
      const r=radius*(.45+age*.85);
      const gl=ctx.createRadialGradient(0,0,0,0,0,r);
      gl.addColorStop(0,'rgba(249,226,255,'+(life*.6)+')');
      gl.addColorStop(.4,'rgba(178,96,248,'+(life*.28)+')');
      gl.addColorStop(1,'rgba(74,30,118,0)');
      ctx.fillStyle=gl;ctx.globalAlpha=1;
      ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  // World-space presentation for transient weapon visuals (slashes, aim lines).
  function drawArsenalVisuals(ctx) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    for (const v of state.visuals) {
      const a = clamp(v.life / v.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (v.kind === 'slash') {
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 16 * a + 4;
        ctx.beginPath();
        ctx.arc(0, 0, v.reach * 0.8, -v.halfAngle, v.halfAngle);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * a + 1;
        ctx.stroke();
      } else if(v.kind?.startsWith?.('v43_')){
        v43GoldImpact(ctx,v,a);
      } else if (v.kind === 'aimline') {
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(v.x1, v.y1);
        ctx.lineTo(v.x2, v.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(v.x2, v.y2, 26, 0, TAU);
        ctx.moveTo(v.x2 - 38, v.y2);
        ctx.lineTo(v.x2 + 38, v.y2);
        ctx.moveTo(v.x2, v.y2 - 38);
        ctx.lineTo(v.x2, v.y2 + 38);
        ctx.stroke();
      } else if (v.kind === 'windup') {
        const owner = v.owner;
        if (owner) {
          const t = 1 - clamp(v.life / v.maxLife, 0, 1);
          const h = getHolder(owner);
          const aim = (h && h.meta && h.meta.aimAngle != null) ? h.meta.aimAngle : Math.atan2(owner.dir.y, owner.dir.x);
          ctx.translate(owner.x, owner.y);
          ctx.rotate(aim);
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(0, 0, owner.radius + 34, -1.1 + t * 0.5, 1.1 - t * 0.5);
          ctx.stroke();
        }
      } else if (v.kind === 'thrust') {
        // Procedural weapon-only lunge (no imported slash art, V2 §A4).
        const owner = v.owner;
        if (owner) {
          const h = getHolder(owner);
          const aim = (h && h.meta && h.meta.aimAngle != null) ? h.meta.aimAngle : Math.atan2(owner.dir.y, owner.dir.x);
          const progress = clamp(1 - v.life / v.maxLife, 0, 1);
          const extension = (v.reach || 200) * Math.sin(progress * Math.PI);
          const a = clamp(Math.sin(progress * Math.PI), 0, 1);
          ctx.translate(owner.x, owner.y);
          ctx.rotate(aim);
          ctx.globalAlpha = 0.55 * a + 0.15;
          ctx.strokeStyle = v.color || '#ffffff';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(owner.radius * 0.5, 0);
          ctx.lineTo(owner.radius * 0.6 + extension, 0);
          ctx.stroke();
          ctx.fillStyle = v.color || '#ffffff';
          ctx.beginPath();
          ctx.moveTo(owner.radius * 0.6 + extension + 18, 0);
          ctx.lineTo(owner.radius * 0.6 + extension - 6, -9);
          ctx.lineTo(owner.radius * 0.6 + extension - 6, 9);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function tickVisuals(dt) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    for (let i = state.visuals.length - 1; i >= 0; i--) {
      state.visuals[i].life -= dt;
      if (state.visuals[i].life <= 0) state.visuals.splice(i, 1);
    }
  }

  const weaponApi = {
    getHolder,
    equip,
    consume,
    aqDamage,
    fireBullet,
    throwGrenade,
    explodeGrenade,
    spawnThrownMelee,
    thrownSpec,
    updateArsenalProjectiles,
    drawArsenalProjectiles,
    drawArsenalVisuals,
    tickVisuals,
    updateHolder,
    tickDetachedWeapons,
    strikeCone,
    makeCtx,
    poseRecipe,
    advancePoseGhost,
    worldAnchor: weaponWorldAnchor,
    // HERO REWORK (doc-06): exported so rework world geometry (crystal walls)
    // applies the exact same equipment-damage scale chain as real hits.
    scaledDamage: scaleEquipmentDamage,
    POSE_RECIPES,
    FAMILY_POSE,
  };

  window.APEX_ARSENAL_WEAPONS = WEAPONS;
  AQ.weapons = WEAPONS;
  AQ.weaponApi = weaponApi;
  window.apexArsenalWeaponRuntime = 'ready';
})();
