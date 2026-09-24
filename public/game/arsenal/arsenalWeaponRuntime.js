// ARSENAL QUEST P0 — weapon registry + holder-state runtime (handoff §7, §9).
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
    const enemy = (typeof fighters !== 'undefined' && fighters)
      ? fighters.find(q => q && q !== f) || null
      : null;
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
    if (h.def.cleanup) { try { h.def.cleanup(makeCtx(f)); } catch (error) { console.warn('[AQ] weapon cleanup failed', h.weaponId, error); } }
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
  function aqDamage(target, amount, source, weaponId, opts = {}) {
    if (!target || target.hp <= 0 || !(amount > 0)) return 0;
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
    const dealt = amount * mult;
    target.takeDamage(dealt, source && source !== target ? source : null, `arsenal-${(weaponId || 'unknown').toLowerCase()}`, !!opts.statusDamage);
    if (opts.knockback && source && source !== target && target.hp > 0) {
      const n = norm(target.x - source.x || 1, target.y - source.y);
      target.applyStatus('push', 0.18, { x: n.x, y: n.y, strength: opts.knockback });
    }
    if (opts.stun && target.hp > 0) target.applyStatus('stun', opts.stun, {});
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
  function fireBullet(spec) {
    const { owner, x, y, angle, speed, damage, weapon } = spec;
    if (!Number.isFinite(angle) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(speed)) return;
    const wspec = CFG.WEAPONS[weapon] || {};
    const family = wspec.family || (weapon === 'SNIPER' ? 'PRECISION' : weapon === 'SHOTGUN' ? 'SHOTGUN' : weapon === 'SMG' ? 'AUTO' : 'SEMI');
    projectiles.push({
      type: 'aq_bullet',
      aq: true,
      owner,
      weapon,
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
    });
  }

  function throwGrenade(spec) {
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
    });
  }

  function explodeGrenade(p) {
    const spec = CFG.WEAPONS.GRENADE;
    for (const f of fighters) {
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

  // Per-frame movement/hit resolution for aq_* projectiles.
  function updateArsenalProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !p.aq) continue;
      if (p.type === 'aq_bullet') {
        // C §5.2: swept segment vs fighter circle — speeds are tracer-grade and
        // tunneling is solved by continuous testing, never by bigger bullets.
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20 || p.x > GAME_SIZE + 20 || p.y < -20 || p.y > GAME_SIZE + 20) { p.life = 0; continue; }
        const target = fighters.find(f => f && f !== p.owner && f.hp > 0);
        if (target) {
          const hitR = target.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius;
          if (distPointToSegment(target.x, target.y, p.px, p.py, p.x, p.y) < hitR) {
            const heavy = !!p.heavy;
            aqDamage(target, p.damage, p.owner, p.weapon, { knockback: p.knockback, stun: p.stun, hitStop: heavy ? 0.05 : 0 });
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
          p.px = p.x; p.py = p.y;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          // Swept segment vs fighter circle — damage exactly once, on hit.
          const target = fighters.find(f => f && f !== p.owner && f.hp > 0);
          if (target && p.grace <= 0) {
            const hitR = target.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius;
            if (distPointToSegment(target.x, target.y, p.px, p.py, p.x, p.y) < hitR) {
              const spec = CFG.WEAPONS[p.weapon] || {};
              p.pinAngle = Math.atan2(p.vy, p.vx);
              // ONE melee damage authority: thrown hits read the same x1.5.
              aqDamage(target, CFG.meleeDamage(p.weapon), p.owner, p.weapon, {
                knockback: spec.knockback, stun: spec.stun, shake: 8, hitStop: 0.05,
              });
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
              p.spin *= -1;
              window.avCue('ricochet', { weapon: p.weapon, x: p.x, y: p.y, angle: Math.atan2(p.vy, p.vx) });
              emitParticles(p.x, p.y, '#ffe6a8', 10, 320, 4, 0.3, 'square');
              log('THROWN_RICOCHET', `weapon=${p.weapon} left=${p.ricochetsLeft}`);
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
  function drawArsenalProjectiles(ctx) {
    const av = window.APEX_ARSENAL_AV;
    for (const p of projectiles) {
      if (!p || !p.aq) continue;
      ctx.save();
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
          ctx.rotate(p.rot + Math.PI / 2);
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

  function gunWorldLong(weaponId) {
    const set = window.APEX_ARSENAL_C_SET && window.APEX_ARSENAL_C_SET.weapons && window.APEX_ARSENAL_C_SET.weapons[weaponId];
    if (set && set.worldW) return Math.max(set.worldW, set.worldH);
    return 120;
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
    const cx = f.x + Math.cos(aim) * offset + Math.cos(aim + Math.PI / 2) * lateral;
    const cy = f.y + Math.sin(aim) * offset + Math.sin(aim + Math.PI / 2) * lateral;
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
    return weaponId === 'SPEAR' ? 190 : weaponId === 'BATTLE_AXE' ? 155 : weaponId === 'SPIKED_CLUB' ? 150 : weaponId === 'DAGGER' ? 110 : 145;
  }
  function spawnThrownMelee(f, weaponId, angle) {
    const t = thrownSpec(weaponId);
    const h = getHolder(f);
    const pose = (h && h.meta && h.meta.pose) || {};
    const r = f.radius || 75;
    const ox = r * 0.78 + (pose.localX || 0);
    const oy = pose.localY || 0;
    const x = f.x + Math.cos(angle) * ox + Math.cos(angle + Math.PI / 2) * oy;
    const y = f.y + Math.sin(angle) * ox + Math.sin(angle + Math.PI / 2) * oy;
    const long = meleeDrawLong(weaponId);
    projectiles.push({
      type: 'aq_thrown',
      aq: true,
      owner: f,
      weapon: weaponId,
      x, y,
      px: x, py: y,
      vx: Math.cos(angle) * t.speed,
      vy: Math.sin(angle) * t.speed,
      radius: Math.max(10, long * 0.14),
      ricochetsLeft: t.ricochets,
      state: 'flight',
      pinnedTo: null,
      pinTimer: 0,
      pinAngle: angle,
      rot: angle,
      spin: t.spin,
      grace: CFG.THROWN_MELEE.pickupDelay || 0,
      life: 6.0,
      maxLife: 6.0,
    });
    window.avCue('melee_throw', { weapon: weaponId, x: f.x, y: f.y, angle });
    log('THROW', `fighter=${f.name} weapon=${weaponId} ricochets=${t.ricochets}`);
  }
  function thrownExit(p) {
    // Physical exit: the sprite tumbles away under gravity; alpha cleanup
    // only in the final moments (presentation), never as the primary exit.
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
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1);
        const spread = (Math.random() * 2 - 1) * (spec.spread || 0) + (pellets > 1 ? (t - 0.5) * (spec.cone || 0) : 0);
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
          knockback: pellets > 1 ? spec.knockback / pellets : spec.knockback,
          stun: spec.stun,
          color,
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
            const spread = (Math.random() * 2 - 1) * (spec.spread || 0.02);
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
            if (!p || p.type !== 'aq_bullet' || !p.owner || p.owner === f || p.aqReflected) continue;
            if (dist(p.x, p.y, f.x, f.y) > spec.reflectRadius + p.radius) continue;
            const toHolder = { x: f.x - p.x, y: f.y - p.y };
            if (p.vx * toHolder.x + p.vy * toHolder.y <= 0) continue; // moving away
            const originalOwner = p.owner;
            const speed = Math.hypot(p.vx, p.vy) || 700;
            p.owner = f; // ownership switches to the reflector
            p.aqReflected = true;
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
    const color = REGISTRY_COLORS[entry.family] || '#ffe08a';
    if (entry.family === 'PRECISION') WEAPONS[entry.id] = makePrecisionGun(entry.id, color);
    else if (entry.family === 'SHOTGUN') WEAPONS[entry.id] = makeBlastGun(entry.id, color);
    else WEAPONS[entry.id] = makeGun(entry.id, null, color);
  }

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
    POSE_RECIPES,
    FAMILY_POSE,
  };

  window.APEX_ARSENAL_WEAPONS = WEAPONS;
  AQ.weapons = WEAPONS;
  AQ.weaponApi = weaponApi;
  window.apexArsenalWeaponRuntime = 'ready';
})();
