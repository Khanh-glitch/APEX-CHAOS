// ARSENAL BATTLE CORE — neutral shared combat runtime (handoff §4, §10, §11, §12).
// Runs INSIDE the Apex engine: reuses Fighter movement/bounce/collision,
// handleCollisions, projectiles/particles/floatingTexts/shockwaves, camera
// shake / hit stop, HUD and SFX hooks. No standalone engine, no weapon-seeking
// AI — HERO and RIVAL ride the normal Apex auto movement law.
(function apexArsenalBattleRuntime() {
  if (window.apexArsenalBattleRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const SPAWN = window.APEX_ARSENAL_SPAWN;
  const weaponApi = AQ.weaponApi;

  // -------------------------------------------------------------------------
  // Blank fighter model (handoff §4): standard Apex Fighter machinery,
  // 100 HP, no update ability logic, no onCollide intrinsic damage, no rage.
  // -------------------------------------------------------------------------
  function makeArsenalFighterType(name, color, startDx, startDy) {
    return {
      name,
      color,
      desc: 'Arsenal Battle blank fighter — no intrinsic kit',
      speed: CFG.FIGHTER_SPEED,
      startDx,
      startDy,
      noRage: true,
      arsenalBlank: true,
      init: () => {},
      draw: (c, f) => {
        drawSketchBlob(c, f.radius, f.color, name === 'HERO' ? 13 : 17);
        c.save();
        c.rotate(-Math.atan2(f.dir.y, f.dir.x));
        c.fillStyle = name === 'HERO' ? '#efe6c8' : '#1b1a16';
        c.beginPath();
        c.moveTo(f.radius * 0.55, 0);
        c.lineTo(f.radius * 0.18, -12);
        c.lineTo(f.radius * 0.18, 12);
        c.closePath();
        c.fill();
        c.restore();
      },
    };
  }

  const HERO_TYPE = makeArsenalFighterType('HERO', CFG.HERO_COLOR, 1, 0.55);
  const RIVAL_TYPE = makeArsenalFighterType('RIVAL', CFG.RIVAL_COLOR, -1, -0.55);

  const AQ_PERF = {
    sections: {},
    peaks: {},
    chamber: { builds: 0, draws: 0, hits: 0, size: 0, usedCacheLast: false },
    hud: { projectionReads: 0, winWrites: 0, debugWrites: 0 },
  };
  function aqPerfMark(name, ms) {
    const s = AQ_PERF.sections[name] || (AQ_PERF.sections[name] = { n: 0, sum: 0, max: 0 });
    s.n += 1;
    s.sum += ms;
    if (ms > s.max) s.max = ms;
  }
  function aqPerfPeak(name, value) {
    const v = value || 0;
    if (v > (AQ_PERF.peaks[name] || 0)) AQ_PERF.peaks[name] = v;
  }
  function aqPerfSampleCounts() {
    const av = window.APEX_ARSENAL_AV;
    const slots = (AQ.state && AQ.state.slots) || [];
    let aqProj = 0;
    for (const p of (typeof projectiles !== 'undefined' && projectiles) || []) if (p && p.aq) aqProj += 1;
    aqPerfPeak('slots', slots.length);
    aqPerfPeak('aqProjectiles', aqProj);
    aqPerfPeak('projectiles', (typeof projectiles !== 'undefined' && projectiles.length) || 0);
    aqPerfPeak('particles', (typeof particles !== 'undefined' && particles.length) || 0);
    aqPerfPeak('floatingTexts', (typeof floatingTexts !== 'undefined' && floatingTexts.length) || 0);
    aqPerfPeak('shockwaves', (typeof shockwaves !== 'undefined' && shockwaves.length) || 0);
    aqPerfPeak('arsenalVfx', av && av.activeVfx ? av.activeVfx() : 0);
    aqPerfPeak('detachedWeapons', (AQ.state && AQ.state.detachedWeapons && AQ.state.detachedWeapons.length) || 0);
    const storm = window.APEX_ARSENAL_STORM;
    if (storm) {
      aqPerfPeak('stormBolts', storm.boltCount());
      aqPerfPeak('stormSparks', storm.sparkCount());
    }
  }
  function aqPerfSectionSummary() {
    const out = {};
    for (const [k, s] of Object.entries(AQ_PERF.sections)) {
      out[k] = { n: s.n, avgMs: s.n ? +(s.sum / s.n).toFixed(3) : 0, maxMs: +s.max.toFixed(3) };
    }
    return out;
  }
  window.apexArsenalPerfSummary = function apexArsenalPerfSummary() {
    const global = (typeof window.apexPerfReport === 'function') ? window.apexPerfReport() : null;
    return {
      frames: global && global.frames,
      longTasks: global && global.longTasks && { count: global.longTasks.count, slowest: global.longTasks.slowest && global.longTasks.slowest[0] },
      sections: aqPerfSectionSummary(),
      peaks: Object.assign({}, AQ_PERF.peaks),
      chamber: Object.assign({}, AQ_PERF.chamber),
      hud: Object.assign({}, AQ_PERF.hud),
      rarity: SPAWN.rarityStats ? Object.assign({}, SPAWN.rarityStats) : null,
      feel: AQ.feel && AQ.feel.stats ? {
        stamps: AQ.feel.stats.stamps,
        stainDraws: AQ.feel.stats.stainDraws,
        sprayPeak: AQ.feel.stats.sprayPeak,
        sprayReuse: AQ.feel.stats.sprayReuse,
        popupReuse: AQ.feel.stats.popupReuse,
      } : null,
      interpolation: false,
    };
  };
  window.apexArsenalObserveRaf = function apexArsenalObserveRaf(frames) {
    const n = Math.max(30, frames || 90);
    const samples = [];
    return new Promise((resolve) => {
      let last = 0;
      let left = n;
      const tick = (t) => {
        if (last > 0) samples.push(t - last);
        last = t;
        left -= 1;
        if (left <= 0) {
          const sorted = samples.slice().sort((a, b) => a - b);
          const sum = samples.reduce((s, v) => s + v, 0);
          const pct = (r) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * r))] || 0;
          const buckets = { le16_7: 0, gt16_7_20: 0, gt20_25: 0, gt25_33: 0, gt33_50: 0, gt50: 0 };
          for (const v of samples) {
            if (v <= 16.7) buckets.le16_7 += 1;
            else if (v <= 20) buckets.gt16_7_20 += 1;
            else if (v <= 25) buckets.gt20_25 += 1;
            else if (v <= 33) buckets.gt25_33 += 1;
            else if (v <= 50) buckets.gt33_50 += 1;
            else buckets.gt50 += 1;
          }
          resolve({
            samples: samples.length,
            avgMs: samples.length ? sum / samples.length : 0,
            medianMs: pct(0.5),
            p95Ms: pct(0.95),
            p99Ms: pct(0.99),
            maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
            buckets,
            interpolation: false,
          });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  let lastBattleProfile = 'LOCAL';
  function resolvedBattleProfile() {
    const requested = String(window.__apexArsenalBattleProfile || lastBattleProfile || 'LOCAL').toUpperCase();
    return requested === 'BOT' ? 'BOT' : 'LOCAL';
  }

  function resetState() {
    const battleMode = resolvedBattleProfile();
    lastBattleProfile = battleMode;
    const state = {
      active: true,
      battleMode,
      time: 0,
      spawnTimer: CFG.SPAWN_CADENCE_SECONDS,
      unarmedFastConsumed: false,
      unarmedFastPending: false,
      spawnHeld: false,
      labMode: false,
      labDamage: 0,
      labHits: 0,
      healCooldown: 0,
      forceHealId: null,
      slots: [],
      visuals: [],
      detachedWeapons: [],
      nextSlotId: 1,
      spawnedTotal: 0,
      suppressedSpawns: 0,
      maxActiveSlots: 0,
      over: null,
      winnerSide: null,
      // C §6 telemetry: realized direct damage split weapon vs native kit.
      dmg: { weapon: 0, native: 0, byMechanic: {} },
      debugOverlay: AQ.state ? AQ.state.debugOverlay : false,
    };
    AQ.state = state;
    return state;
  }

  // ---------------------------------------------------------------------------
  // C §6 native lethality normalization — per-mechanic adaptation applied only
  // while the Arsenal mode is live. Identity (setup/control/mobility/defense/
  // sustain) is untouched; only realized direct damage is scaled, and every
  // point is telemetered for the acceptance suite.
  // ---------------------------------------------------------------------------
  function nativeMechanic(label, statusDamage) {
    const l = String(label || '');
    if (statusDamage) return 'dot';
    if (/explosion|blast|divine|planet|nuke|mine/.test(l)) return 'blast';
    if (/laser|beam|field/.test(l)) return 'beam';
    if (/butt|strike|slash|stab|punch|melee|kick|drive/.test(l)) return 'melee';
    if (/shot|bullet|rocket|ball|impact|proj/.test(l)) return 'projectile';
    if (/collide|contact|body/.test(l)) return 'contact';
    return 'default';
  }
  if (typeof Fighter !== 'undefined' && !Fighter.prototype.__aqNativeAdapt) {
    Fighter.prototype.__aqNativeAdapt = true;
    const baseTakeDamage = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function aqAdaptedTakeDamage(amount, source, label, statusDamage) {
      const st = (typeof gameState !== 'undefined' && gameState === 'ARSENAL') ? (AQ.state || null) : null;
      if (!st || !(amount > 0)) return baseTakeDamage.call(this, amount, source, label, statusDamage);
      const isWeapon = String(label || '').startsWith('arsenal-');
      let scaled = amount;
      let mech = null;
      if (!isWeapon) {
        mech = nativeMechanic(label, statusDamage);
        const mult = CFG.NATIVE_ARSENAL_MULT[mech] != null ? CFG.NATIVE_ARSENAL_MULT[mech] : CFG.NATIVE_ARSENAL_MULT.default;
        scaled = amount * mult;
      }
      // Lab: temporary HP headroom lets the unmodified engine resolve the
      // ENTIRE real hit (including lethal-equivalent damage, HUD, VFX and
      // callbacks), without ever reaching zero/KO. Restore only AFTER the
      // transaction; do not short-circuit the damage path.
      if (st.labMode) this.hp += scaled + 1;
      const before = this.hp;
      const out = baseTakeDamage.call(this, scaled, source, label, statusDamage);
      const dealt = Math.max(0, before - this.hp);
      if (st.labMode) {
        st.labDamage += dealt;
        st.labHits += dealt > 0 ? 1 : 0;
        this.hp = this.maxHp;
        if (typeof updateHUD === 'function') updateHUD();
      }
      st.dmg = st.dmg || { weapon: 0, native: 0, byMechanic: {} };
      if (isWeapon) st.dmg.weapon += dealt;
      else {
        st.dmg.native += dealt;
        st.dmg.byMechanic[mech] = (st.dmg.byMechanic[mech] || 0) + dealt;
      }
      if (AQ.feel && AQ.feel.noteDamage) {
        AQ.feel.noteDamage({
          dealt,
          miss: dealt <= 0 && amount > 0 && !statusDamage,
          victim: this,
          source,
          label,
          statusDamage: !!statusDamage,
          critical: !!this.__aqHitCrit,
          impact: this.__aqImpact || null, // V1: real firearm collision point + projectile velocity
        });
        this.__aqHitCrit = false;
        this.__aqImpact = null;
      }
      return out;
    };
  }

  // -------------------------------------------------------------------------
  // Simulation tick — the ONLY gameplay step; rAF and headless tests share it.
  // -------------------------------------------------------------------------
  function presentNextRealStoryBeat(state){
    const view=state?.questStoryView;
    if(!view||view.active())return;
    // The final accepted HP crossing is published during the NORMAL frame.
    // The authoritative Q4B safe-hold record is established by the NEXT
    // stepSimulation tick. Never show the RIVET hold modal before that tick,
    // or a modal pause would stop that tick and the genuine rescue release
    // could never obtain its original safe-hold authority.
    if(state.questReflexGate?.snapshot()?.awaitingRivet===true
       &&state.questReflexHold?.phase!=='AWAIT_RIVET')return;
    // take() is presentation-only. It cannot advance Director or spoof a Cast.
    let cue;
    while((cue=state.questStory?.take?.())){
      // Q4E ledger intentionally queues immutable scene ID strings. The
      // compositor requires an object with an id; adapt here, not in combat.
      const scene=typeof cue==='string'?{id:cue}:cue;
      if(view.offer(scene))return;
    }
  }

  function stepSimulation(dt) {
    const state = AQ.state;
    if (!state || !state.active) return;
    // One Quest-owned lease pauses the ENTIRE Arsenal simulation only
    // while a physically earned story panel is visible. BOT/Local unchanged.
    // No internal clocks, weapon projectiles or cooldowns advance here.
    if(state.questReflex===true&&state.questStoryView?.active())return;
    if(state.questFirstWakeProgression===true
       &&state.questFirstWakeStoryView?.active())return;
    // Q4B: once all four actual REFLEX receipts and BOTH true <=500 HP
    // crossings have been accepted, stop the training exchange. The next
    // authorized story action belongs to RIVET (NOT a generic winner/KO).
    // This is a reversible pilot hold, not an invented Stormbreaker release.
    if(state.questReflex===true && state.questReflexGate?.snapshot()?.awaitingRivet===true){
      if(!state.questReflexHold){
        // Resolve the last Arsenal projectiles harmlessly at cinematic
        // interception. A frozen bullet would otherwise hang in the arena
        // indefinitely while genuine RIVET choreography is pending.
        // Do not apply damage or generate an imitation Stormbreaker impact.
        const interruptedProjectiles=projectiles.length;
        projectiles.length=0;
        state.questReflexHold={
          phase:'AWAIT_RIVET',at:state.time,
          hp:(fighters||[]).map(f=>({id:f.questId,hp:f.hp})),
          interruptedProjectiles
        };
        AQ.log('QUEST_REFLEX_SAFE_HOLD','accepted real J/K + both real HP<=500; awaiting RIVET');
      }
      // Preserve the cinematic freeze of game physics while allowing
      // noncombat visuals to decay and camera shake to settle naturally.
      // No actor movement, pickup updates, damage or weapon cooldown tick.
      // Q4C preview: tick ONLY the real RIVET rig holder and its Arsenal
      // projectile, never resume fighters, spawns, time, skills or pickups.
      const rig=state.questRivetPreview;
      if(rig && rig.phase!=='SETTLED'){
        // A real thrown weapon can be created inside updateHolder. Never
        // simulate and remove it in its birth frame before a Gold frame
        // has a chance to see the actual STORMBREAKER flight. This is an
        // isolated rig handoff, not synthetic projectile creation.
        const before=projectiles.filter(p=>p.questRivetSuppression===true);
        weaponApi.updateHolder(rig.operator,dt);
        const born=projectiles.filter(p=>p.questRivetSuppression===true);
        const justLaunched=!rig.sawFlight&&before.length===0&&born.length>0;
        if(justLaunched){
          rig.birth=Object.freeze({
            x:born[0].x,y:born[0].y,vx:born[0].vx,vy:born[0].vy,
            weapon:born[0].weapon,owner:born[0].owner?.questId,
            kind:born[0].type
          });
        }else{
          weaponApi.updateArsenalProjectiles(dt);
        }
        const live=projectiles.filter(p=>p.questRivetSuppression===true);
        if(live.length){
          rig.sawFlight=true;
          rig.phase='FLIGHT';
          rig.peakFlight=Math.max(rig.peakFlight,live.length);
        }else if(rig.sawFlight){
          rig.phase='SETTLED';rig.settled=true;
          AQ.log('QUEST_RIVET_PREVIEW_SETTLED','real flight resolved; Story stays WAKE');
        }
      }
      weaponApi.tickVisuals(dt);
      window.APEX_ARSENAL_AV?.tick?.(dt);
      if(rig)window.APEX_ARSENAL_STORM?.tick?.(dt);
      // Q4E: event observation only, never Story save or combat mutation.
      state.questStory?.observeReflex?.(
        state.questReflexGate?.snapshot?.(),
        window.__apexQuestReflexTechnicalRead?.());
      presentNextRealStoryBeat(state);
      if(AQ.feel?.tick)AQ.feel.tick(dt);
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];p.update(dt);
        if(p.life<=0)particles.splice(i,1);
      }
      for(let i=shockwaves.length-1;i>=0;i--){
        const s=shockwaves[i];s.r+=420*dt;s.alpha=Math.max(0,1-s.r/s.maxR);
        if(s.alpha<=0)shockwaves.splice(i,1);
      }
      floatingTexts.length=0;
      if(arenaFlash.a>0)arenaFlash.a=Math.max(0,arenaFlash.a-dt*1.6);
      if(cameraShake>0)cameraShake=Math.max(0,cameraShake-dt*22);
      cameraZoom=lerp(cameraZoom,1,dt*2);
      return;
    }
    matchClock += dt;
    state.time += dt;
    if (!state.over) {
      const living = (typeof fighters !== 'undefined' ? fighters : []).filter((f) => f && f.hp > 0);
      const holdsGun = (f) => {
        const h = weaponApi.getHolder(f);
        return !!(h && CFG.isGun && CFG.isGun(h.weaponId));
      };
      const revealedGuns = (state.slots || []).filter((s) => s.phase === 'REVEALED' && s.kind !== 'HEAL' && CFG.isGun && CFG.isGun(s.weaponId)).length;
      const emergencyGunNeeded = !state.labMode && living.length >= 2 && living.every((f) => !holdsGun(f)) && revealedGuns === 0;
      let emergencySpawned = false;
      if (!emergencyGunNeeded) {
        state.unarmedFastConsumed = false;
        state.unarmedFastPending = false;
      } else if (!state.spawnHeld && !state.unarmedFastConsumed) {
        const cap = CFG.MAX_ACTIVE_SLOTS;
        const active = (state.slots || []).filter((s) => s.phase !== 'REMOVED' && s.kind !== 'HEAL').length;
        if (active >= cap) {
          state.unarmedFastPending = true;
        } else {
          const slot = SPAWN.trySpawnSlot({ forceFirearm: true });
          if (slot) {
            state.spawnTimer = CFG.SPAWN_CADENCE_SECONDS;
            state.unarmedFastConsumed = true;
            state.unarmedFastPending = false;
            emergencySpawned = true;
          } else {
            state.unarmedFastPending = true;
          }
        }
      }
      // E01 only: a directed PISTOL spawns near the STAGE'S true Fighter,
      // never teleports into their hand. If it expires or is fully discharged
      // without a valid hit, re-telegraph a new REAL pickup. Prevents the
      // observed R2 soft-lock (T.O.T remained unarmed for 90s), while leaving
      // the production Arsenal pool, collision and max-five cap untouched.
      if(state.questReflex && state.questReflexGate){
        const stage=state.questReflexGate.snapshot().phase;
        const q=state.questReflexSpawns||(state.questReflexSpawns={lastAt:{},jDrop:false});
        for(const slot of state.slots){
          if(slot.questStage && slot.questStage!==stage)slot.phase='REMOVED';
        }
        if(stage==='R1_PISTOL'||stage==='R2_PISTOL'){
          const wanted=stage==='R1_PISTOL'?'NEWBOT':'T.O.T';
          const owner=(fighters||[]).find(f=>f?.questId===wanted&&f.hp>0);
          const held=owner&&weaponApi.getHolder(owner)?.weaponId==='PISTOL';
          const pending=state.slots.some(slot=>slot.questStage===stage
            &&slot.phase!=='REMOVED');
          const lastAt=q.lastAt?.[stage]??-1e9;
          if(owner&&!held&&!pending&&state.time-lastAt>=1.75){
            const towardCenter=owner.x>500?-65:65;
            const slot=SPAWN.trySpawnSlot({
              questWeaponId:'PISTOL',questStage:stage,questPickupOwner:wanted,
              questPoint:{x:owner.x+towardCenter,y:owner.y}
            });
            if(slot){(q.lastAt||(q.lastAt={}))[stage]=state.time;}
          }
        }else if(stage==='J_CAST'&&!q.jDrop){
          q.jDrop=true;
          // Real Arsenal cadence restarts after BOTH real gun hits. Never
          // fake an eligible J pickup or claim an A1 cast from keydown alone.
          state.spawnTimer=Math.min(state.spawnTimer,0);
        }
      }
      // Fixed spawn cadence — independent of collection state (handoff §5).
      if (!state.labMode) state.spawnTimer -= dt;
      let guard = 0;
      while (!state.labMode && state.spawnTimer <= 0 && guard++ < 4) {
        state.spawnTimer += CFG.SPAWN_CADENCE_SECONDS;
        if (emergencySpawned) continue;
        // E01 post-J/K is still a REAL physical Arsenal gun cycle. The
        // 4.5s cadence, live-slot cap 5, reveal and pickup all remain intact.
        // Direct each trial's PISTOL to an unarmed Fighter whose opponent
        // still needs to cross 500 HP; no damage or equip is injected.
        if(state.questReflex===true
          &&state.questReflexGate?.snapshot()?.phase==='BOTH_HALF'){
          const newbot=(fighters||[]).find(f=>f?.questId==='NEWBOT'&&f.hp>0);
          const tot=(fighters||[]).find(f=>f?.questId==='T.O.T'&&f.hp>0);
          const wants=[];
          if(newbot&&tot&&tot.hp>500)wants.push(newbot);
          if(newbot&&tot&&newbot.hp>500)wants.push(tot);
          const q=state.questReflexSpawns||(state.questReflexSpawns={lastAt:{},jDrop:true});
          const eligible=wants.filter(f=>!weaponApi.getHolder(f)
            &&!state.slots.some(slot=>slot.questStage==='BOTH_HALF'
              &&slot.questPickupOwner===f.questId&&slot.phase!=='REMOVED'));
          if(eligible.length){
            const selected=eligible[(q.assaultTurn||0)%eligible.length];
            q.assaultTurn=(q.assaultTurn||0)+1;
            SPAWN.trySpawnSlot({
              questWeaponId:'PISTOL',questStage:'BOTH_HALF',
              questPickupOwner:selected.questId,
              questPoint:{x:selected.x+(selected.x>500?-65:65),y:selected.y}
            });
          }
          continue;
        }
        SPAWN.trySpawnSlot();
      }
      SPAWN.updateSlots(dt);
      // B1 owner correction: the unclaimed STORMBREAKER no longer applies a
      // GLOBAL slow to both fighters while it sits on the floor. The danger
      // read is local (floor lightning VFX around the slot itself) and the
      // threat is the committed release — not an arena-wide movement debuff.
      // POST-C §6: P1 cooldown-only skills wait for J. Gate wraps P1 update
      // only; P2 keeps automatic kit behavior.
      const gate = window.APEX_ARSENAL_SKILL_GATE;
      if (state.questMultiActor && window.APEX_QUEST_MULTI_ACTOR_CORE) {
        const Q = window.APEX_QUEST_MULTI_ACTOR_CORE;
        // Quest actor update follows the SAME Fighter.update and holder pipeline.
        // Resolve hostiles by team, never by index. Do not run legacy 1v1
        // collision callbacks against the two anchors as though they were
        // always enemies (Quest includes allies and more than two bodies).
        for (const fighter of fighters) {
          if (!fighter || fighter.hp <= 0) continue;
          const enemy = Q.nearestEnemy(fighter, fighters);
          if (fighter === fighters[0] && gate?.preUpdate) gate.preUpdate(fighter, dt);
          fighter.update(dt, enemy);
          if (fighter === fighters[0] && gate?.postUpdate) gate.postUpdate(fighter);
        }
        Q.separateBodyOverlaps(fighters);
      } else if (fighters[0] && fighters[1]) {
        if (gate && gate.preUpdate) gate.preUpdate(fighters[0], dt);
        fighters[0].update(dt, fighters[1]);
        if (gate && gate.postUpdate) gate.postUpdate(fighters[0]);
        fighters[1].update(dt, fighters[0]);
        handleCollisions(dt);
      }
      SPAWN.resolvePickups();
      for (const f of fighters) if (f) weaponApi.updateHolder(f, dt);
      if (weaponApi.tickDetachedWeapons) weaponApi.tickDetachedWeapons(dt);
      updateProjectiles(dt);                     // engine lifecycle + cleanup
      weaponApi.updateArsenalProjectiles(dt);    // aq_* movement + hits
    }
    weaponApi.tickVisuals(dt);
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.tick(dt);
    if (window.APEX_ARSENAL_STORM) window.APEX_ARSENAL_STORM.tick(dt);
    // B3 floor-lightning contact hazard: the VISIBLE bolt geometry sampled
    // just above (post-regeneration, pre-draw — the same polylines that
    // render this frame) is the hit authority. Each discrete bolt↔fighter
    // contact applies one floorBoltStunSeconds stun — no damage — through
    // the standard engine status. Both fighters are valid targets: the
    // floor weapon has no owner. Per-pulse/per-fighter gating lives in the
    // sampler; an in-flight longer stun is never shortened by a floor hit.
    if (window.APEX_ARSENAL_STORM && window.APEX_ARSENAL_STORM.floorContacts
        && CFG.STORMBREAKER && CFG.STORMBREAKER.floorBoltHazard !== false) {
      const stunSeconds = CFG.STORMBREAKER.floorBoltStunSeconds != null ? CFG.STORMBREAKER.floorBoltStunSeconds : 1.0;
      // Doc 14 R2: the floor-lightning sampler enumerates ALL eligible
      // living bodies — normal fighters plus every living rework body
      // (extra SLIME Bodies / promoted anchors; retired/dead/invisible
      // anchors excluded). Generic query, no SLIME-name conditional.
      // Extra SLIME Bodies are NOT electrically immune (no such frozen
      // mechanic). Frozen floor law preserved: visible bolt geometry is
      // the contact authority, damage = 0, stun = 1.0s, a shorter floor
      // stun never shortens a longer one, per-pulse/per-body gating.
      const H = window.APEX_HERO_REWORK;
      const stormTargets = (H && H.environmentTargets) ? H.environmentTargets() : fighters;
      for (const c of window.APEX_ARSENAL_STORM.floorContacts(stormTargets)) {
        const f = c.fighter;
        if (!f || f.hp <= 0 || !f.applyStatus) continue;
        const cur = f.statuses && f.statuses.stun;
        if (!cur || cur.timer <= 0 || cur.timer < stunSeconds) {
          f.applyStatus('stun', stunSeconds, {});
        }
        window.APEX_ARSENAL_STORM.onFloorContact(c);
        AQ.log('STORM_FLOOR_STRIKE', `target=${f.name} x=${Math.round(f.x)} y=${Math.round(f.y)}`);
      }
    }
    // Presentation decay over the shared engine collections.
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.update(dt); if (p.life <= 0) particles.splice(i, 1); }
    // Pass 1: battlefield typography is muted in Arsenal. Native kits may still
    // allocate FloatingText; sink them before update/draw so they incur no
    // lifecycle cost. Other modes keep the legacy path.
    if (floatingTexts.length) floatingTexts.length = 0;
    if (AQ.feel && AQ.feel.tick) AQ.feel.tick(dt);
    for (let i = shockwaves.length - 1; i >= 0; i--) { const s = shockwaves[i]; s.r += 420 * dt; s.alpha = Math.max(0, 1 - s.r / s.maxR); if (s.alpha <= 0) shockwaves.splice(i, 1); }
    if (arenaFlash.a > 0) arenaFlash.a = Math.max(0, arenaFlash.a - dt * 1.6);
    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 22);
    cameraZoom = lerp(cameraZoom, 1, dt * 2);
    // HERO REWORK (doc 02/06): KO/victory truth is COMBATANT-level — a
    // SLIME Combatant lives while any Body lives; the legacy fighters[]
    // entry may be a retired anchor at 0 HP. Shared-query patch: route
    // through the rework HP authority when present (legacy behavior
    // unchanged otherwise).
    const HRW = window.APEX_HERO_REWORK;
    const aqKO = (f) => (HRW && HRW.bodyKO) ? HRW.bodyKO(f) : (f.hp <= 0);
    const aqHp = (f) => (HRW && HRW.bodyHudHp) ? HRW.bodyHudHp(f).hp : f.hp;
    if (state.questMultiActor && !state.over && !state.labMode && window.APEX_QUEST_MULTI_ACTOR_CORE) {
      const Q = window.APEX_QUEST_MULTI_ACTOR_CORE;
      // E01 can only reach the RIVET hold after genuine PISTOL + J/K receipts;
      // no two-team KO rule may auto-complete this tutorial encounter.
      const pilot = state.questReflex ? state.questReflexGate?.poll() : null;
      if(pilot)state.questStory?.observeReflex?.(pilot,null);
      if(pilot)presentNextRealStoryBeat(state);
      const outcome = state.questReflex
        ? {status:fighters.some(f=>f?.hp<=0)?'RETRY':'ACTIVE',reason:'reflex-pilot-'+(pilot?.phase||'closed')}
        : state.questFirstWake ? Q.firstWakeOutcome(fighters)
        : Q.teamsOutcome(fighters);
      if (outcome.status === 'RETRY' || outcome.status === 'COMPLETE') {
        state.over = 'QUEST_' + (state.questFirstWake ? 'FIRST_WAKE_' : 'FIXTURE_') + outcome.status;
        state.questOutcome = outcome.status;
        // No economy award, no 1v1 winnerSide or Gold result transition.
        AQ.log('QUEST_OUTCOME', outcome.status + ' reason=' + outcome.reason);
        // Story panel is earned ONLY by real Arsenal team KO outcome. Q4I
        // does not own combat HP, attack scheduling or projectile production.
        if(state.questFirstWakeProgression===true
           &&state.questFirstWakeStoryView){
          state.questFirstWakeStoryView.offer({id:outcome.status==='COMPLETE'
            ?'E02_FIRST_WAKE_CLEAR':'E02_FIRST_WAKE_RETRY'});
        }
        updateHUD();
      }
    } else if (!state.questFirstWake && !state.labMode && !state.over && fighters[0] && fighters[1] && (aqKO(fighters[0]) || aqKO(fighters[1]))) {
      const winner = aqHp(fighters[0]) > aqHp(fighters[1]) ? fighters[0] : fighters[1];
      const winnerSide = winner === fighters[0] ? 'P1' : 'P2';
      // Side is the outcome authority. Fighter name remains legacy display
      // copy only, because Local may legally use the same hero on both sides.
      state.winnerSide = winnerSide;
      state.over = winner.name;
      AQ.log('KO', `winnerSide=${winnerSide} winner=${winner.name}`);
      window.APEX_ARSENAL_META?.awardBattleResult?.(winnerSide, state);
      updateHUD();
    }
  }

  function updateArsenalBattle(dt) {
    const t0 = performance.now();
    if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
    stepSimulation(dt);
    aqPerfMark('simulation', performance.now() - t0);
    aqPerfSampleCounts();
  }

  // -------------------------------------------------------------------------
  // Engine integration — wrap update/draw/background/projectile passes,
  // following the same convention as solo/trial/tamChien mode runtimes.
  // -------------------------------------------------------------------------
  const baseUpdate = update;
  const baseDraw = draw;
  const baseDrawBackground = drawBackground;
  const baseDrawProjectiles = drawProjectiles;

  update = function (dt) {
    if (gameState === 'ARSENAL') { updateArsenalBattle(dt); return; }
    return baseUpdate(dt);
  };

  drawBackground = function (c) {
    if (gameState === 'ARSENAL') {
      const t0 = performance.now();
      drawChamber01(c); // Arsenal-only arena; global Apex background untouched
      // Frost ambience belongs to the battle world, not the final canvas:
      // paint it directly over Chamber 01 before ice, pickups, actors,
      // projectiles, damage numbers and HUD. The Frost pass is fully isolated
      // and becomes an exact no-op at baseline.
      if (window.APEX_FROST_PRESENTATION?.renderArenaAmbience) {
        window.APEX_FROST_PRESENTATION.renderArenaAmbience(c);
      }
      const t1 = performance.now();
      if (AQ.feel && AQ.feel.drawStain) AQ.feel.drawStain(c);
      // Stormbreaker floor lightning sits UNDER the actors (V9 layering).
      if (window.APEX_ARSENAL_STORM) window.APEX_ARSENAL_STORM.drawFloor(c);
      // Frost Slice 1 ordering: active ice is a world surface, so it belongs
      // above the chamber floor but below actual pickup sprites. The Frost
      // actor/head remains in the normal Fighter pass and held guns remain in
      // Arsenal foreground; this hook moves only the surface material.
      if (window.APEX_FROST_PRESENTATION?.renderSurfaceUnderWeapons) {
        window.APEX_FROST_PRESENTATION.renderSurfaceUnderWeapons(c);
      }
      SPAWN.drawSlots(c);
      aqPerfMark('pickupDraw', performance.now() - t1);
      aqPerfMark('background', performance.now() - t0);
      return;
    }
    baseDrawBackground(c);
  };

  // ---------------------------------------------------------------------------
  // C §7 — ARSENAL FIELD TEST // CHAMBER 01. Dark graphite evaluation room:
  // restrained range grid, sparse ticks/zone marks, industrial wall panels,
  // neutral pickup floor. Low contrast, no bright lanes, no center obstacle.
  // ---------------------------------------------------------------------------
  let chamberCache = null;
  let chamberCacheSize = 0;
  function makeChamberSurface(S) {
    if (typeof OffscreenCanvas !== 'undefined') {
      try { return new OffscreenCanvas(S, S); } catch (e) { /* fall through */ }
    }
    const el = document.createElement('canvas');
    el.width = S;
    el.height = S;
    return el;
  }
  function paintChamber01(c, S) {
    c.save();
    // Base graphite with subtle material variation.
    c.fillStyle = '#626A74';
    c.fillRect(0, 0, S, S);
    const grad = c.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, 'rgba(114,123,134,0.78)');
    grad.addColorStop(1, 'rgba(79,87,97,0.92)');
    c.fillStyle = grad;
    c.fillRect(0, 0, S, S);

    // Very restrained range grid.
    c.strokeStyle = 'rgba(12,14,18,0.22)';
    c.lineWidth = 1;
    for (let g = 125; g < S; g += 125) {
      c.beginPath(); c.moveTo(g, 40); c.lineTo(g, S - 40); c.stroke();
      c.beginPath(); c.moveTo(40, g); c.lineTo(S - 40, g); c.stroke();
    }
    // Sparse measurement ticks along the walls.
    c.strokeStyle = 'rgba(10,12,16,0.38)';
    c.lineWidth = 2;
    for (let g = 100; g < S; g += 100) {
      c.beginPath(); c.moveTo(g, 34); c.lineTo(g, 46); c.stroke();
      c.beginPath(); c.moveTo(g, S - 46); c.lineTo(g, S - 34); c.stroke();
      c.beginPath(); c.moveTo(34, g); c.lineTo(46, g); c.stroke();
      c.beginPath(); c.moveTo(S - 46, g); c.lineTo(S - 34, g); c.stroke();
    }
    // POST-C §8: zone marks are glyph-free ticks, never Z-01..Z-04 numerals.

    // Central alignment marks (no obstacle, no glow).
    c.strokeStyle = 'rgba(18,20,24,0.28)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, 62, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(S / 2 - 88, S / 2); c.lineTo(S / 2 - 40, S / 2);
    c.moveTo(S / 2 + 40, S / 2); c.lineTo(S / 2 + 88, S / 2);
    c.moveTo(S / 2, S / 2 - 88); c.lineTo(S / 2, S / 2 - 40);
    c.moveTo(S / 2, S / 2 + 40); c.lineTo(S / 2, S / 2 + 88);
    c.stroke();

    // Industrial wall band: panels + guard rail, brighter boundary read.
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
    // Corner vent slats, slow static machinery hint.
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.moveTo(52 + i * 10, 52); c.lineTo(52 + i * 10, 84); c.stroke();
      c.beginPath(); c.moveTo(S - 84 + i * 10, S - 84); c.lineTo(S - 84 + i * 10, S - 52); c.stroke();
    }
    // POST-C §8: chamber identity is the graphite room itself — no title plate.
    c.restore();
  }
  function drawChamber01(c) {
    const S = GAME_SIZE;
    const t0 = performance.now();
    let usedCache = true;
    const P = window.APEX_CHAMBER_PALETTE;
    if (P && P.surface) {
      // §D: surface cache is keyed (GAME_SIZE, paletteId) inside the palette
      // runtime; rebuilt exactly once per key change; one drawImage per frame.
      if (P.installWrappers) P.installWrappers();
      const surf = P.surface(S);
      usedCache = !surf.rebuilt;
      c.drawImage(surf.canvas, 0, 0);
    } else if (!chamberCache || chamberCacheSize !== S) {
      const surface = makeChamberSurface(S);
      const sc = surface.getContext('2d');
      paintChamber01(sc, S);
      chamberCache = surface;
      chamberCacheSize = S;
      usedCache = false;
      c.drawImage(chamberCache, 0, 0);
    } else {
      c.drawImage(chamberCache, 0, 0);
    }
    AQ_PERF.chamber.builds += usedCache ? 0 : 1;
    AQ_PERF.chamber.size = S;
    AQ_PERF.chamber.draws += 1;
    if (usedCache) AQ_PERF.chamber.hits += 1;
    AQ_PERF.chamber.usedCacheLast = usedCache;
    aqPerfMark('chamber', performance.now() - t0);
  }

  drawProjectiles = function (c) {
    if (gameState === 'ARSENAL') weaponApi.drawArsenalProjectiles(c);
    baseDrawProjectiles(c);
  };

  function drawEquippedWeapons(c) {
    const av = window.APEX_ARSENAL_AV;
    if (!av || !av.drawEquippedWeapon) return;
    // Doc 14 R1: equipped-weapon presentation enumerates EVERY living
    // physical body that can legally hold a weapon. Rework SLIME keeps
    // extra Bodies outside global fighters[] (doc 06) — the generic rework
    // enumerator supplies exactly those (anchors stay covered by the
    // fighters[] pass below, so each weapon draws exactly once).
    const H = window.APEX_HERO_REWORK;
    const extras = (H && H.extraLivingBodies) ? H.extraLivingBodies() : [];
    for (const f of fighters.concat(extras)) {
      if (!f) continue;
      const h = weaponApi.getHolder(f);
      if (h) av.drawEquippedWeapon(c, f, h);
      // Checkpoint B pose ghost: recoil settle / throw / thrust return keeps
      // animating for a beat after the weapon is consumed.
      if (f.data && f.data.arsenalFade && !f.data.arsenalFade.detached && av.drawPoseGhost) av.drawPoseGhost(c, f, f.data.arsenalFade);
    }
    const detached = AQ.state && AQ.state.detachedWeapons;
    if (detached && av.drawDetachedWeapon) {
      for (const d of detached) av.drawDetachedWeapon(c, d);
    }
  }

  function drawHolderTags(c) {
    if (!(AQ.state && AQ.state.debugOverlay)) return;
    for (const f of fighters) {
      const h = weaponApi.getHolder(f);
      if (!f || !h) continue;
      c.save();
      c.fillStyle = h.def.category === 'ranged' ? '#ffd479' : h.def.category === 'melee' ? '#ff9d7a' : '#9fd8ff';
      c.fillRect(f.x - 22, f.y - f.radius - 48, 44, 8);
      c.restore();
    }
  }

  const hudRefs = { root: null, hint: null, win: null, dbg: null };
  const hudLast = { hintDisplay: null, winKey: null, debugText: null, debugOn: false, debugAt: 0 };

  function projectSkillLines(f) {
    if (!f) return [];
    const H = window.APEX_HERO_REWORK;
    if (H && H.isReworkFighter && H.isReworkFighter(f) && H.skillHud) return H.skillHud(f) || [];
    const gate = window.APEX_ARSENAL_SKILL_GATE;
    const snap = gate && gate.snapshot ? gate.snapshot(f) : null;
    const lines = [];
    if (snap && snap.keys && snap.keys.length) {
      for (const k of snap.keys) {
        const v = k.value;
        if (typeof v !== 'number') continue;
        const label = k.key.replace(/Cd$/, '').slice(0, 8);
        lines.push(v > 0.09 ? label + ' · ' + v.toFixed(1) + 's' : label + ' · READY');
      }
    }
    return lines;
  }

  function hudProjectionFor(f, sideIndex) {
    const state = AQ.state;
    const active = !!(state && state.active);
    const modeLabel = !active ? '' : state.labMode ? 'ARSENAL LAB'
      : state.battleMode === 'BOT' ? 'BOT BATTLE' : 'LOCAL 1V1';
    const skillLines = active ? projectSkillLines(f) : [];
    AQ_PERF.hud.projectionReads += 1;
    return {
      active, side: Number(sideIndex) + 1, modeLabel,
      battleMode: state && state.battleMode || null,
      labMode: !!(state && state.labMode),
      skillLines, skillText: skillLines.join(' | '),
    };
  }

  function resultProjection() {
    const state = AQ.state;
    if (!state || !state.over) return null;
    const award = window.APEX_ARSENAL_META && window.APEX_ARSENAL_META.lastAward
      ? window.APEX_ARSENAL_META.lastAward() : null;
    return {
      winner: state.over,
      battleMode: state.battleMode || 'LOCAL',
      award: award && award.amount ? { amount: award.amount, balance: award.balance } : null,
    };
  }

  AQ.hudProjectionFor = hudProjectionFor;
  AQ.resultProjection = resultProjection;

  function hudRoot() {
    if (hudRefs.root && hudRefs.root.isConnected) {
      if (window.__apexGoldBattleHosted === true) hudRefs.root.style.display = 'none';
      return hudRefs.root;
    }
    let el = document.getElementById('aq-dom-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aq-dom-hud';
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;font-family:monospace;';
      (document.getElementById('game-wrapper') || document.getElementById('game-wrap') || document.body).appendChild(el);
    }
    // Gold HUD is the only visible battle presentation. This root may be
    // created asynchronously after the bridge's initial legacy capture, so
    // suppress it at SOURCE whenever Gold owns the battle.
    if (window.__apexGoldBattleHosted === true) el.style.display = 'none';
    hudRefs.root = el;
    return el;
  }

  function disposeArsenalDomHud() {
    const el = (hudRefs.root && hudRefs.root.isConnected)
      ? hudRefs.root
      : document.getElementById('aq-dom-hud');
    if (el) el.remove();
    hudRefs.root = null;
    hudRefs.hint = null;
    hudRefs.exitBtn = null;
    hudRefs.win = null;
    hudRefs.dbg = null;
    hudLast.hintDisplay = null;
    hudLast.winKey = null;
    hudLast.debugText = null;
    hudLast.debugOn = false;
    hudLast.debugAt = 0;
  }
  function ensureArsenalBattleUiStyle() {
    if (document.getElementById('aq-battle-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'aq-battle-ui-style';
    style.textContent = `
      #aq-dom-hud{font-family:"ApcKanit","Segoe UI",sans-serif!important;pointer-events:none!important}
      #aq-dom-hud #aq-hint,#aq-dom-hud #aq-debug{pointer-events:none!important}
      #aq-dom-hud #aq-battle-exit,#aq-dom-hud #aq-win,#aq-dom-hud #aq-win *{pointer-events:auto!important}
      #aq-dom-hud button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #aq-dom-hud button:focus-visible{outline:2px solid #f3d477;outline-offset:2px}
      #aq-hint{position:absolute!important;left:50%!important;right:auto!important;bottom:12px!important;z-index:40;transform:translateX(-50%);padding:7px 10px;border:1px solid rgba(255,255,255,.1);background:rgba(8,11,15,.72);color:rgba(224,219,205,.62)!important;font:800 9px/1 ui-monospace,monospace!important;letter-spacing:.12em}
      #aq-battle-exit.aq-battle-exit-btn{position:absolute;right:14px;bottom:12px;z-index:41;pointer-events:auto;min-width:92px;min-height:44px;padding:0 12px;border:1px solid #444d56;background:linear-gradient(180deg,rgba(32,38,45,.95),rgba(13,18,23,.95));color:#e8e2d3;cursor:pointer;font:900 10px/1 "Segoe UI",sans-serif;letter-spacing:.08em;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
      #aq-win.aq-result-layer{position:absolute!important;inset:0!important;z-index:80!important;display:grid!important;place-items:center!important;padding:20px;background:rgba(4,7,10,.58);backdrop-filter:blur(3px);text-align:left!important;color:#f4f0e6!important}
      .aq-result-card{pointer-events:auto;width:min(560px,92%);padding:28px;border:1px solid #454f59;background:linear-gradient(180deg,rgba(23,29,36,.98),rgba(10,14,18,.98));box-shadow:0 24px 70px rgba(0,0,0,.48);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
      .aq-result-kicker{color:#d7bd72;font:800 9px/1 ui-monospace,monospace;letter-spacing:.18em}
      .aq-result-title{margin-top:8px;font-size:clamp(36px,5vw,64px);font-style:italic;font-weight:900;line-height:.86}
      .aq-result-reward{margin-top:16px;padding:10px 12px;border:1px solid #3b4338;background:#11160f;color:#d8c982;font:800 11px/1.35 ui-monospace,monospace}
      .aq-result-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:20px}
      .aq-result-actions button{min-height:44px;border:1px solid #424b55;background:#171d24;color:#f1ece1;cursor:pointer;font:900 11px/1 "Segoe UI",sans-serif;letter-spacing:.06em}
      .aq-result-actions button:first-child{border-color:#62583b;background:#3c341f;color:#f4df9a}
      @media(max-width:520px){.aq-result-actions{grid-template-columns:1fr}}
      /* Arsenal Lab: compact scrollable dock, never an opaque full-screen layer. */
      #aq-lab-panel{position:absolute;top:12px;right:12px;z-index:45;pointer-events:auto;
        width:min(230px,28%);max-height:min(68vh,570px);overflow:auto;overscroll-behavior:contain;
        color:#ede9df;background:rgba(11,17,23,.94);border:1px solid #627080;
        box-shadow:0 10px 32px #0008;font:700 11px/1.3 "ApcKanit","Segoe UI",sans-serif}
      #aq-lab-panel summary{cursor:pointer;padding:12px;color:#d7bd72;font-size:13px;letter-spacing:.09em}
      #aq-lab-panel .aq-lab-intro{margin:0 10px 8px;color:#adb9c2}
      #aq-lab-panel .aq-lab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:6px}
      #aq-lab-panel button{cursor:pointer;color:#f4f0e6;background:#1d2832;border:1px solid #45525e;
        min-width:0;min-height:62px;padding:3px;font:700 10px/1.15 "Segoe UI",sans-serif;overflow-wrap:anywhere}
      #aq-lab-panel button:hover{background:#344754}
      #aq-lab-panel button img{display:block;margin:auto;width:70%;height:36px;object-fit:contain}
      #aq-lab-panel .aq-lab-exit{display:block;width:calc(100% - 12px);margin:6px;min-height:44px;color:#f7d79b}
      #aq-lab-panel .aq-lab-message{min-height:22px;padding:4px 10px;color:#d7bd72}
      @media(max-width:600px){#aq-lab-panel{top:auto;bottom:6px;right:6px;left:6px;width:auto;max-height:min(24vh,160px)}
        #aq-lab-panel:not([open]){max-height:none;width:max-content;left:auto}
        #aq-lab-panel .aq-lab-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}

    `;
    document.head.appendChild(style);
  }

  function syncDomHud(force) {
    const t0 = performance.now();
    ensureArsenalBattleUiStyle();
    const state = AQ.state;
    const el = hudRoot();
    const now = t0;
    if (!hudRefs.hint) {
      let hint = document.getElementById('aq-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'aq-hint';
        hint.textContent = 'B / ESC · EXIT';
        el.appendChild(hint);
      }
      hudRefs.hint = hint;
    }
    const hintDisplay = (state && state.active) ? 'block' : 'none';
    if (hudLast.hintDisplay !== hintDisplay) {
      hudRefs.hint.style.display = hintDisplay;
      hudLast.hintDisplay = hintDisplay;
    }
    // A discoverable visible way out of every active Arsenal Battle.
    if (!hudRefs.exitBtn) {
      let btn = document.getElementById('aq-battle-exit');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'aq-battle-exit';
        btn.type = 'button';
        btn.textContent = 'EXIT';
        btn.className = 'aq-battle-exit-btn';
        btn.addEventListener('click', () => {
          if (AQ.state && AQ.state.labMode) window.exitArsenalLab();
          else window.exitArsenalBattleMode();
        });
        el.appendChild(btn);
      }
      hudRefs.exitBtn = btn;
    }
    const exitDisplay = (state && state.active) ? 'block' : 'none';
    // Compare against the element's real style: exitArsenalBattleMode hides the
    // button directly (outside this sync), so a cached flag can go stale.
    if (hudRefs.exitBtn.style.display !== exitDisplay) {
      hudRefs.exitBtn.style.display = exitDisplay;
      hudLast.exitDisplay = exitDisplay;
    }
    let win = hudRefs.win || document.getElementById('aq-win');
    const result = resultProjection();
    if (result) {
      const winKey = result.winner + '|' + result.battleMode;
      if (hudLast.winKey !== winKey) {
        if (!win) {
          win = document.createElement('div');
          win.id = 'aq-win';
          el.appendChild(win);
        }
        win.className = 'aq-result-layer';
        hudRefs.win = win;
        const actions = ['REMATCH', 'PICK AGAIN', 'PRODUCT MENU'];
        const award = result.award;
        const reward = award
          ? '<div class="aq-result-reward">+' + award.amount + ' AC · BALANCE ' + award.balance + '</div>' : '';
        win.innerHTML = '<div class="aq-result-card"><div class="aq-result-kicker">ARSENAL RESULT</div><div class="aq-result-title">' + result.winner + ' WINS</div>'
          + reward + '<div id="arsenal-result-actions" class="aq-result-actions">' + actions.map((action) => '<button type="button" data-arsenal-act="' + action + '">' + action + '</button>').join('') + '</div></div>';
        win.onclick = (event) => {
          const button = event.target && event.target.closest ? event.target.closest('[data-arsenal-act]') : null;
          const action = button && button.getAttribute('data-arsenal-act');
          if (!action) return;
          if (action === 'REMATCH') window.startArsenalBattleMode();
          else if (action === 'PICK AGAIN') window.APEX_ARSENAL_META?.openFighterPick?.({ mode: state.battleMode || 'local' });
          else if (action === 'PRODUCT MENU') {
            window.exitArsenalBattleMode();
            window.APEX_ARSENAL_META?.returnToProductMenu?.();
          }
        };
        hudLast.winKey = winKey;
        AQ_PERF.hud.winWrites += 1;
      }
    } else if (win) {
      win.remove();
      hudRefs.win = null;
      hudLast.winKey = null;
    }
    const wantDebug = !!(state && state.debugOverlay);
    if (wantDebug !== hudLast.debugOn) {
      hudLast.debugOn = wantDebug;
      hudLast.debugAt = 0;
    }
    if (wantDebug) {
      if (!force && now - hudLast.debugAt < 100 && hudRefs.dbg) {
        aqPerfMark('hud', performance.now() - t0);
        return;
      }
      hudLast.debugAt = now;
      const s = window.getArsenalBattleDebugState();
      if (!hudRefs.dbg) {
        const dbg = document.createElement('div');
        dbg.id = 'aq-debug';
        dbg.style.cssText = 'position:absolute;left:16px;top:96px;padding:12px;background:rgba(6,6,10,0.78);color:#d8d2c0;font:700 14px monospace;white-space:pre;border:2px solid #6d8f4e;';
        el.appendChild(dbg);
        hudRefs.dbg = dbg;
      }
      const text = [
        'ARSENAL BATTLE DEBUG',
        'spawn in: ' + s.spawnIn.toFixed(1) + 's',
        'active slots: ' + s.activeSlots,
        'telegraphs: ' + s.telegraphs,
        'revealed: ' + s.revealed,
        (s.hero ? s.hero.name : 'P1') + '  HP ' + (s.hero ? s.hero.hp : 0) + '/' + CFG.MATCH_HP + '   weapon: ' + (s.hero ? s.hero.weapon : 'NONE'),
        (s.rival ? s.rival.name : 'P2') + ' HP ' + (s.rival ? s.rival.hp : 0) + '/' + CFG.MATCH_HP + '   weapon: ' + (s.rival ? s.rival.weapon : 'NONE'),
      ].join('\n');
      if (text !== hudLast.debugText) {
        hudRefs.dbg.textContent = text;
        hudLast.debugText = text;
        AQ_PERF.hud.debugWrites += 1;
      }
    } else if (hudRefs.dbg) {
      hudRefs.dbg.remove();
      hudRefs.dbg = null;
      hudLast.debugText = null;
    }
    aqPerfMark('hud', performance.now() - t0);
  }

  function drawForeground() {
    const t0 = performance.now();
    const view = window.__apexCameraView || { shakeX: 0, shakeY: 0, zoom: 1 };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(GAME_SIZE / 2 + view.shakeX, GAME_SIZE / 2 + view.shakeY);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);
    const tEq = performance.now();
    // baseDraw renders two primary bodies; Quest extra Fighter anchors use
    // this world-space pass, before real equipment and VFX. No HUD takeover.
    if (AQ.state?.questMultiActor) {
      for (const f of fighters.slice(2)) if (f) f.draw(ctx);
      // The original Gold HUD already gives two team totals and one
      // independent segment per fighter. Suppress redundant developer IDs
      // above every moving head. Only show compact local HP for injury.
      ctx.save();
      for (const f of fighters) {
        if (!f || f.hp<=0 || f.hp>=f.maxHp-0.1) continue;
        const x=f.x,y=f.y-(f.radius||75)-19;
        const ratio=Math.max(0,Math.min(1,f.hp/Math.max(1,f.maxHp)));
        ctx.fillStyle='rgba(7,11,15,.8)';ctx.fillRect(x-27,y,54,5);
        ctx.fillStyle=f.questTeam==='ALLY'?'#65cfc4':'#df7859';
        ctx.fillRect(x-26,y+1,52*ratio,3);
      }
      if (AQ.state.questOutcome) {
        ctx.font='900 48px sans-serif';ctx.fillStyle='#ffdf9e';
        ctx.fillText(AQ.state.questOutcome==='COMPLETE'?(AQ.state.questFirstWake?'FIRST WAKE CLEAR':'QUEST TEST CLEAR'):'NEWBOT KO — RETRY',GAME_SIZE/2,148);
      }
      ctx.restore();
    }
    // baseDraw has already rendered primary bodies. Preserve Gold's exact
    // order: body → A2 residue → real held weapon → plate-clipped A1World.
    window.APEX_MIRROR_PRESENTATION?.renderPostFighterResidue?.(ctx);
    drawEquippedWeapons(ctx);
    window.APEX_MIRROR_PRESENTATION?.renderPostFighters?.(ctx);
    weaponApi.drawArsenalVisuals(ctx);
    aqPerfMark('foreground', performance.now() - tEq);
    const tVfx = performance.now();
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.draw(ctx);
    aqPerfMark('arsenalVfxDraw', performance.now() - tVfx);
    // Red-tier presentation (fixed cost; zero in-flight bolt objects).
    const tStorm = performance.now();
    if (window.APEX_ARSENAL_STORM) window.APEX_ARSENAL_STORM.draw(ctx);
    aqPerfMark('stormVfxDraw', performance.now() - tStorm);
    drawHolderTags(ctx);
    if (AQ.feel && AQ.feel.drawForeground) AQ.feel.drawForeground(ctx);
    ctx.restore();
    syncDomHud();
    aqPerfMark('foregroundTotal', performance.now() - t0);
  }

  // POST-C §8: mute typographic fill/stroke on the battlefield canvas while
  // the engine draws fighters/projectiles/particles. HUD/debug overlays
  // restore the original methods before they paint.
  function muteArenaGlyphs(c) {
    const fill = c.fillText;
    const stroke = c.strokeText;
    c.fillText = function mutedFillText() {};
    c.strokeText = function mutedStrokeText() {};
    return function restoreArenaGlyphs() { c.fillText = fill; c.strokeText = stroke; };
  }

  draw = function () {
    if (gameState !== 'ARSENAL') { baseDraw(); return; }
    const t0 = performance.now();
    baseDraw();
    drawForeground();
    aqPerfMark('arsenalFrame', performance.now() - t0);
  };

  // -------------------------------------------------------------------------
  // Entry / exit (handoff §12)
  // -------------------------------------------------------------------------
  let keyListener = null;
  // E01 Q4A pilot: observing original engine events is allowed; modifying
  // realized damage, skill cooldown or the Director checkpoint is not.
  let reflexUnbind = null;
  function detachReflexReceipt() {
    if(reflexUnbind){const fn=reflexUnbind;reflexUnbind=null;fn();}
    // Do not leave an inactive match's receipt object readable or attached
    // to Gold/AIL. Teardown must be symmetrical for RETURN, REMATCH and retry.
    if(AQ.state){
      AQ.state.questReflexGate?.close?.();
      AQ.state.questReflexGate=null;
      AQ.state.questStoryView?.close?.();
      AQ.state.questStoryView=null;
      AQ.state.questStory?.close?.();
      AQ.state.questStory=null;
      AQ.state.questReflex=false;
    }
  }
  function attachReflexReceipt(gate) {
    const hud=window.APEX_COMBAT_HUD;
    const bus=window.APEX_HERO_REWORK_AIL?.bus;
    if(!hud||typeof hud.onRealizedDamage!=='function'||!bus?.on)return false;
    const previous=hud.onRealizedDamage;
    const observer=function onQuestReflexDamage(ev) {
      // Original damage + Gold observers keep their unchanged authority.
      const result=previous.apply(this,arguments);
      gate.acceptDamage(ev);
      return result;
    };
    hud.onRealizedDamage=observer;
    const off=bus.on('Cast',ev=>gate.acceptCast(ev));
    reflexUnbind=()=>{
      if(hud.onRealizedDamage===observer)hud.onRealizedDamage=previous;
      if(typeof off==='function')off();
    };
    return true;
  }

  function onKeyDown(e) {
    if (e.code === 'F3') {
      e.preventDefault();
      if (gameState === 'ARSENAL' && AQ.state) AQ.state.debugOverlay = !AQ.state.debugOverlay;
      return;
    }
    if (gameState !== 'ARSENAL') return;
    if (e.code === 'KeyJ' && !e.repeat) {
      const gate = window.APEX_ARSENAL_SKILL_GATE;
      if (gate && fighters[0]) gate.pressJ(fighters[0]);
      return;
    }
    if (e.code === 'KeyT' && AQ.state && AQ.state.over) {
      window.startArsenalBattleMode();
      return;
    }
    if (e.code === 'KeyB' || e.code === 'Escape') {
      if (AQ.state && AQ.state.labMode) window.exitArsenalLab();
      else window.exitArsenalBattleMode();
    }
  }

  let lastShells = null;

  function startArsenalBattleMode(p1Name, p2Name, options = {}) {
    const shells = window.APEX_ARSENAL_SHELLS || null;
    const want1 = p1Name || (lastShells && lastShells[0]) || null;
    const want2 = p2Name || (lastShells && lastShells[1]) || null;
    const localTestHost = ['localhost', '127.0.0.1', '::1'].includes(String(window.location?.hostname || ''));
    const testFixture = options.testFixture === true && window.__APEX_TEST_MODE === true && localTestHost;
    const isBlankFixture = testFixture && want1 === 'HERO' && want2 === 'RIVAL';
    let types;

    if (isBlankFixture) {
      types = [HERO_TYPE, RIVAL_TYPE];
    } else {
      if (!shells || !want1 || !want2) return false;
      if (testFixture) {
        // Local acceptance harnesses may exercise visible locked shells without
        // changing public selection authority. This seam is unavailable outside
        // an explicitly marked localhost test run.
        if (!shells.isVisible(want1) || !shells.isVisible(want2)) return false;
      } else {
        if (!shells.isPlayable(want1) || !shells.isPlayable(want2)) return false;
        if (!options.adminLab && (!shells.canPublicSelect(want1) || !shells.canPublicSelect(want2))) return false;
      }
      const p1 = shells.typeFor(want1);
      const p2 = shells.typeFor(want2);
      if (!p1 || !p2) return false;
      types = [p1, p2];
    }

    // Q2 internal-only N-actor fixtures are never public Quest progression.
    // Public Gold Continue Story retains exact CP04 FIRST WAKE composition.
    const questCore = window.APEX_QUEST_MULTI_ACTOR_CORE;
    const questFixture = typeof options.questFixture === 'string'
      && window.__APEX_TEST_MODE === true && localTestHost && questCore
      ? questCore.fixtureRoster(options.questFixture) : null;
    if (options.questFixture && !questFixture) return false;
    // Q4A native REFLEX pilot is loopback TEST ONLY, never a story skip.
    const reflexAuthorized=(window.__APEX_TEST_MODE===true&&localTestHost)
      ||(window.__APEX_QUEST_DEV===true&&window.__apexGoldBattleHosted===true);
    const questReflex=options.questReflex===true
      && reflexAuthorized
      && !!questCore && !!window.APEX_QUEST_REFLEX_RECEIPTS;
    if(options.questReflex && !questReflex)return false;
    const directorCheckpoint=window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId;
    const storyCompletion=questReflex===true
      &&options.questStoryCompletion===true
      &&options.questStoryPresentation===true
      &&window.__APEX_QUEST_DEV===true
      &&window.__apexGoldBattleHosted===true
      &&['WAKE','REFLEX'].includes(directorCheckpoint)
      &&typeof window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat==='function';
    if(options.questStoryCompletion===true&&!storyCompletion)return false;
    const firstWakeStory=options.questFirstWakeProgression===true
      &&options.questFirstWake===true
      &&types[0]?.name==='ROBOT'
      &&!questReflex&&!!questCore
      &&window.__APEX_QUEST_DEV===true&&window.__apexGoldBattleHosted===true
      &&['WORKSHOP','FIRST_WAKE'].includes(directorCheckpoint)
      &&typeof window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat==='function'
      &&!!window.APEX_QUEST_STORY_PRESENTATION;
    if(options.questFirstWakeProgression===true&&!firstWakeStory)return false;
    detachReflexReceipt();
    resetState();
    if (AQ.feel && AQ.feel.resetMatch) AQ.feel.resetMatch();
    // OWNER LAW (R52): the legacy menu/select DOM is deleted from the product —
    // there is nothing to hide. The Gold surface owns its own screens.
    // Legacy HUD only (owner law 2026-10-05): a global id lookup would resolve
    // the Gold donor battle HUD while a Gold battle is mounted.
    const hud = (typeof legacyUiElement === 'function')
      ? legacyUiElement('hud')
      : document.getElementById('hud');
    if (hud) hud.style.opacity = 1;

    const [t1, t2] = types;
    lastShells = [t1.name, t2.name];
    const questFirstWake = options.questFirstWake === true
      && t1.name === 'ROBOT'
      && !!questCore;
    const questMultiActor = questFirstWake || !!questFixture || questReflex;
    if (questMultiActor) {
      // Same engine Fighter instances, same physical weapon/damage update and
      // same per-actor HP. No cloned Quest combat loop. TEST fixture is
      // isolated from the story Director and makes NO progress/save changes.
      const specs = questReflex
        ? [{questId:'NEWBOT',questTeam:'ALLY',hp:1000,x:230,y:500,kind:'newbot'},
           {questId:'T.O.T',questTeam:'HOSTILE',hp:1000,x:770,y:500,kind:'tot'}]
        : (questFirstWake ? questCore.fixtureRoster('2v2') : questFixture);
      const NPC_TYPES = Object.freeze({
        scout:['SCRAP SCOUT','#c88d48'],bulwark:['IRON BULWARK','#6f7f90'],
        tot:['T.O.T','#e8e2d2'],rivet:['RIVET','#c39f76'],
        reaver:['CLAW REAVER','#b07e6b'],sentinel:['CORE SENTINEL','#8898a5'],
      });
      const makeNpc = (kind) => {
        const spec = NPC_TYPES[kind];
        if (!spec) return null;
        const def = makeArsenalFighterType(spec[0], spec[1], -1, 0.5);
        def.arsenalBlank = true; // No fabricated skills or passive.
        def.draw = function (c, f) {
          const gold = window.APEX_QUEST_GOLD_ENEMIES;
          if (gold?.draw && gold.draw(c, f)) return;
          drawSketchBlob(c, f.radius, f.color, 17);
        };
        return def;
      };
      fighters = specs.map((spec, i) => {
        const type = spec.kind === 'newbot' ? t1 : makeNpc(spec.kind);
        const f = new Fighter(i+1, spec.x, spec.y, type);
        f.questId = spec.questId;
        f.questTeam = spec.questTeam;
        if (spec.kind === 'scout' || spec.kind === 'bulwark' ||
            spec.kind === 'reaver' || spec.kind === 'sentinel')
          f.questVisualId = spec.kind;
        // T.O.T gets the owner's Gold V12 fifth "OPERATOR" chassis for now.
        // Quest still owns T.O.T identity, HP, allegiance, AI and no skills.
        if (spec.kind === 'tot') f.questVisualId = 'operator';
        f.maxHp = spec.hp;
        f.hp = spec.hp;
        return f;
      });
      // Fail closed before a simulation frame can run on bad Quest inputs.
      const validated = questCore.validateRoster(fighters);
      if (!validated.ok || (questFirstWake && !questCore.validateFirstWake(fighters).ok)) {
        AQ.log('QUEST_ROSTER_INVALID', validated.reason);
        AQ.state.active=false;
        return false;
      }
      AQ.state.questMultiActor = true;
      AQ.state.questFirstWake = questFirstWake;
      AQ.state.questFirstWakeProgression = firstWakeStory;
      AQ.state.questReflex = questReflex;
      AQ.state.questStoryCompletion = storyCompletion;
      AQ.state.questTestFixture = questReflex||questFirstWake ? null : String(options.questFixture);
      AQ.state.questActorCount = validated.count;
      AQ.state.questOutcome = null;
      if(questFirstWake&&firstWakeStory){
        const ownerState=AQ.state;
        AQ.state.questFirstWakeStoryView=window.APEX_QUEST_STORY_PRESENTATION.create({
          onAdvance:(beatId)=>{
            if(AQ.state!==ownerState||!ownerState.active
               ||ownerState.questFirstWakeProgression!==true)return;
            if(beatId==='E02_FIRST_WAKE_CLEAR'){
              const out=window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat?.(beatId);
              if(!out?.ok){AQ.log('QUEST_E02_SAVE_DENIED',String(out?.reason));return;}
              AQ.log('QUEST_E02_COMPLETE','checkpoint=SCRAP_SWARM');
            }else if(beatId==='E02_FIRST_WAKE_RETRY'){
              if(ownerState.questOutcome!=='RETRY')return;
              AQ.log('QUEST_E02_RETRY','checkpoint remains FIRST_WAKE');
            }else return;
            // No fabricated winner/award. Return to the REAL saved Director.
            window.exitArsenalBattleMode?.();
            window.APEX_QUEST01_DIRECTOR?.show?.({
              onReflexPreview:window.__apexQuestReflexStart,
              onPreview:window.__apexQuestFirstWakeStart,
              onFirstWakeStory:window.__apexQuestFirstWakeStoryStart
            });
          }
        });
      }
      if(questReflex){
        const gate=window.APEX_QUEST_REFLEX_RECEIPTS.create(()=>fighters);
        if(!attachReflexReceipt(gate)){
          gate.close(); AQ.state.active=false; return false;
        }
        AQ.state.questReflexGate=gate;
        AQ.state.questStory=window.APEX_QUEST_STORY_BEATS?.create?.()||null;
        AQ.state.questStory?.observeReflex?.(gate.snapshot(),null);
        if(options.questStoryPresentation===true && window.__apexGoldBattleHosted===true
          && window.APEX_QUEST_STORY_PRESENTATION){
          const ownerState=AQ.state;
          AQ.state.questStoryView=window.APEX_QUEST_STORY_PRESENTATION.create({
            onAdvance:(beatId)=>{
              if(AQ.state!==ownerState||!ownerState.active
                 ||ownerState.questReflex!==true)return;
              if(beatId==='WAKE_OPEN'){
                if(ownerState.questStoryCompletion===true){
                  const out=window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat?.('WAKE_OPEN');
                  ownerState.questWakeAuthorized=out?.ok===true;
                  if(!out?.ok)AQ.log('QUEST_WAKE_DENIED',String(out?.reason||'unknown'));
                }
              }else if(beatId==='E01_RIVET_HOLD'){
                // Only the real four receipts + safe hold can enter this
                // Story-owned path. Skip/Continue affects presentation only:
                // the ONE canonical Arsenal throw still has to fly and HIT
                // the arena floor. No checkpoint can advance from the click.
                ownerState.questStoryRescueStart=beginQuestRivetPreview(true);
              }else if(beatId==='E01_RIVET_SUPPRESSION_TECH'){
                const proof=window.__apexQuestReflexTechnicalRead?.();
                if(proof?.ready===true && proof?.groundImpact?.kind===
                   'REAL_ARSENAL_FLOOR_CONTACT'
                   &&proof.checkpointAuthorized===false){
                  // A genuine settled E01 may preview the next cinematic
                  // storytelling PANEL, but there is NO WORKSHOP save/write.
                  ownerState.questWorkshopPreview=true;
                  ownerState.questStoryView?.offer({id:'WORKSHOP_ARRIVAL'});
                }
              }else if(beatId==='WORKSHOP_ARRIVAL'){
                if(ownerState.questStoryCompletion===true){
                  const out=window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat?.('WORKSHOP_ARRIVAL');
                  ownerState.questWorkshopAuthorized=out?.ok===true;
                  if(!out?.ok)AQ.log('QUEST_WORKSHOP_DENIED',String(out?.reason||'unknown'));
                  else{
                    AQ.log('QUEST_E01_AUTHENTIC_COMPLETE','checkpoint=WORKSHOP');
                    ownerState.questOutcome='E01_RESCUED_WORKSHOP';
                    // Battle has already been legitimately frozen after the
                    // physical Stormbreaker floor hit. Normal match victory
                    // and fake KO counters are NOT involved.
                    window.exitArsenalBattleMode?.();
                    window.APEX_QUEST01_DIRECTOR?.show?.({
                      onReflexPreview:window.__apexQuestReflexStart,
                      onPreview:window.__apexQuestFirstWakeStart
                    });
                    return;
                  }
                }
              }
              presentNextRealStoryBeat(ownerState);
            }
          });
          // A full Quest starts at WAKE; resume begins at REFLEX without
          // replaying an already-acknowledged opening. The old non-saving
          // Story preview still begins at the real R1 hit as before.
          if(storyCompletion&&directorCheckpoint==='WAKE')
            AQ.state.questWakeEntryPending=true;
        }
        // Only scripted R1/R2 spawn at first. The normal Arsenal cadence
        // resumes when J needs a real revealed pickup after R2.
        AQ.state.spawnTimer=1e6;
        AQ.state.spawnHeld=true;
        AQ.state.questReflexSpawns={lastAt:{},jDrop:false};
      }
    } else {
      fighters = [
        new Fighter(1, 220, GAME_SIZE / 2, t1),
        new Fighter(2, GAME_SIZE - 220, GAME_SIZE / 2, t2),
      ];
    }
    for (const f of fighters) {
      // Quest actor HP is specified by their encounter roster; normal 1v1
      // continues using canonical MATCH_HP. Do not manufacture shared HP.
      if (!questMultiActor) f.maxHp = CFG.MATCH_HP;
      f.hp = f.maxHp;
      const a = Math.random() * TAU;
      f.setDir(Math.cos(a), Math.sin(a));
    }

    // Clear prior normal-match projectiles/effects.
    projectiles = [];
    particles = [];
    floatingTexts = [];
    shockwaves = [];
    timeScale = 1.0;
    cameraZoom = 1.0;
    cameraShake = 0;
    hitStop = 0;
    matchClock = 0;
    arenaFlash = { r: 0, g: 0, b: 0, a: 0 };
    sawWallRage = { timer: 0, owner: null, phase: 0 };

    updateHUD();
    // PASS B §11: ENERGY B1 is match state — reset on every match start.
    if (window.APEX_COMBAT_HUD && window.APEX_COMBAT_HUD.onMatchStart) {
      try { window.APEX_COMBAT_HUD.onMatchStart(); } catch (apexCombatHudErr) { /* HUD failure never breaks match start */ }
    }

    // Correction pass: match start = begin a NEW battle-audio session (the
    // previous session's live sources/cues are terminated inside), then the
    // AV runtime re-arms its HOT bank (buffers stay decoded across sessions).
    window.apexBeginBattleAudioSession?.('arsenal:match-start');
    if (window.APEX_ARSENAL_AV) { window.APEX_ARSENAL_AV.clear(); window.APEX_ARSENAL_AV.preload(); }
    if (window.APEX_ARSENAL_STORM) window.APEX_ARSENAL_STORM.clear();
    gameState = 'ARSENAL';
    window.APEX_COMBAT_HUD?.onProjectionChanged?.();
    lastTime = performance.now();
    if (!reqId) reqId = requestAnimationFrame(loop);
    if (!keyListener) {
      keyListener = onKeyDown;
      window.addEventListener('keydown', keyListener);
    }
    AQ.log('MODE_ENTER', `mode=ARSENAL_BATTLE profile=${(AQ.state && AQ.state.battleMode) || 'LOCAL'}`);
    try { draw(); } catch (error) { console.warn('[ARSENAL] initial draw failed', error); }
    // Screenshot live NEW MATCH pixels, never a stale previous-match frame.
    // The scene then owns the simulation lease until physically acknowledged.
    if(AQ.state?.questWakeEntryPending===true&&AQ.state.questStoryView){
      AQ.state.questWakeEntryPending=false;
      AQ.state.questStoryView.offer({id:'WAKE_OPEN'});
    }
    return true;
  }
  window.startArsenalBattleMode = function startProductArsenalBattle(p1Name, p2Name, options) {
    return startArsenalBattleMode(p1Name, p2Name, options);
  };
  window.__apexQuestFirstWakeStart = function startQuestFirstWakeSpike() {
    // Explicit feature opt-in on the disposable Quest branch only.
    if (window.__APEX_QUEST_DEV !== true) return false;
    return window.startArsenalBattleMode('ROBOT', 'ROBOT', { questFirstWake: true });
  };
  window.__apexQuestFirstWakeStoryStart=function startRealE02FromDirector(){
    if(window.__APEX_QUEST_DEV!==true||window.__apexGoldBattleHosted!==true)
      return false;
    const D=window.APEX_QUEST01_DIRECTOR;
    const before=D?.checkpoint?.()?.checkpointId;
    if(!['WORKSHOP','FIRST_WAKE'].includes(before))return false;
    const started=window.startArsenalBattleMode('ROBOT','ROBOT',{
      questFirstWake:true,questFirstWakeProgression:true
    });
    if(!started)return false;
    if(before==='WORKSHOP'){
      // Physical 2v2 MUST be live before advancing a checkpoint.
      const proof=D.acceptNativeBeat('FIRST_WAKE_ENTER');
      if(proof?.ok!==true){
        window.exitArsenalBattleMode?.();
        return false;
      }
    }
    return true;
  };
  window.__apexQuestReflexStart = function startQ4ARealReflexPilot() {
    if(!((window.__APEX_TEST_MODE===true
      && ['localhost','127.0.0.1','::1'].includes(String(window.location?.hostname||'')))
      ||(window.__APEX_QUEST_DEV===true&&window.__apexGoldBattleHosted===true)))return false;
    const withStory=window.__APEX_QUEST_STORY_PLAYBACK===true
      &&window.__APEX_QUEST_DEV===true&&window.__apexGoldBattleHosted===true;
    const withFull=withStory&&window.__APEX_QUEST_STORY_FULL===true;
    delete window.__APEX_QUEST_STORY_PLAYBACK;
    delete window.__APEX_QUEST_STORY_FULL;
    return window.startArsenalBattleMode('ROBOT','ROBOT',
      {questReflex:true,questStoryPresentation:withStory,
       questStoryCompletion:withFull});
  };
  // One-shot RIVET engineering preview. Owner has NOT approved the rescue
  // choreography, final model, target or Story progression. The weapon must
  // actually equip, wind up, throw and exit via Arsenal; no synthetic bolt.
  function beginQuestRivetPreview(internalStory=false){
    const state=AQ.state;
    const storyAuthorized=internalStory===true
      &&state?.active===true&&state?.questReflex===true
      &&state?.questStoryView
      &&window.__apexGoldBattleHosted===true;
    const authorized=storyAuthorized||(window.__APEX_TEST_MODE===true
      && ['localhost','127.0.0.1','::1'].includes(String(window.location?.hostname||'')))
      ||(window.__APEX_QUEST_DEV===true&&window.__apexGoldBattleHosted===true);
    if(!authorized)return {ok:false,reason:'preview-only'};
    if(!state?.active||state.questReflex!==true
       ||state.questReflexGate?.snapshot()?.awaitingRivet!==true
       ||state.questReflexHold?.phase!=='AWAIT_RIVET')
      return {ok:false,reason:'real-safe-hold-required'};
    if(state.questRivetPreview)return {ok:false,reason:'already-released'};
    if(projectiles.length)return {ok:false,reason:'unsettled-projectiles'};
    // Recalculate the world-ground target only AFTER real HP/skill hold.
    // This is a non-combatant floor point, never a Fighter or dummy HP pool.
    const alive=(fighters||[]).filter(f=>f?.hp>0);
    if(alive.length!==2)return {ok:false,reason:'wrong-fighter-pair'};
    const floorX=Math.max(45,Math.min(955,(alive[0].x+alive[1].x)/2));
    const floorY=Math.max(45,Math.min(955,(alive[0].y+alive[1].y)/2));
    const operator={id:'Q01-RIVET-RIG-PREVIEW',name:'RIVET',questId:'RIVET',
      questTeam:'RIG_OPERATOR',hp:1000,maxHp:1000,
      // Keep the thrown-weapon spawn safely INSIDE the arena even when
      // the midpoint is near the north wall. Too-near-wall launches
      // ricochet/exit before any real ground contact (Q4F RED finding).
      // A low midpoint flips the shot northward instead of forcing it
      // against the world boundary. Arsenal owns the resulting direction.
      x:floorX,y:floorY>=180?Math.max(85,floorY-270):Math.min(915,floorY+270),
      radius:8,dir:{x:0,y:floorY>=180?1:-1},data:{}};
    // Suppression reaches the computed midpoint via the original weapon's
    // real throw lifecycle; neither friend becomes a target or loses HP.
    state.questRivetPreview={
      phase:'READY',operator,aimPoint:{x:floorX,y:floorY,hp:1},
      sawFlight:false,peakFlight:0,settled:false,groundImpact:null,
      storyComplete:false,authority:'ARSENAL_STORMBREAKER_EQUIP_PREVIEW',
      freeze:{
        time:state.time,
        hp:(fighters||[]).map(f=>[f.questId,f.hp]),
        pos:(fighters||[]).map(f=>[f.questId,f.x,f.y]),
        slots:(state.slots||[]).map(s=>[s.id,s.phase])
      },
      getSlots:()=>state.slots||[]
    };
    if(!weaponApi.equip(operator,'STORMBREAKER')){
      state.questRivetPreview=null;
      return {ok:false,reason:'real-equip-failed'};
    }
    AQ.log('QUEST_RIVET_PREVIEW_START','real Stormbreaker equipped off roster');
    return {ok:true,phase:'READY'};
  }
  // Public engineering preview deliberately receives no internalStory
  // capability. Passing arbitrary arguments cannot promote it to Story.
  AQ.beginQuestRivetPreview=()=>beginQuestRivetPreview(false);
  window.__apexQuestRivetPreviewRelease=()=>beginQuestRivetPreview(false);
  // Read-only, no save transitions or Stage mutation. A valid response still
  // means TECHNICAL PREVIEW ONLY, not a canonical rescue or WORKSHOP unlock.
  window.__apexQuestStoryBeatsRead=function(){
    const s=AQ.state;
    return s?.active&&s.questReflex===true?s.questStory?.snapshot?.()||null:null;
  };
  window.__apexQuestStoryViewRead=function(){
    const s=AQ.state;
    return s?.active&&s.questReflex===true?s.questStoryView?.snapshot?.()||null:null;
  };
  window.__apexQuestReflexTechnicalRead=function(){
    const s=AQ.state;
    if(!s?.active||s.questReflex!==true)return {
      ready:false,reason:'no-active-reflex',storyComplete:false
    };
    return window.APEX_QUEST_REFLEX_RECEIPTS.technicalHandoff({
      gate:s.questReflexGate,hold:s.questReflexHold,rig:s.questRivetPreview,
      actors:typeof fighters!=='undefined'?fighters:[],
      projectiles:typeof projectiles!=='undefined'?projectiles:[],
      time:s.time,over:s.over
    });
  };
  // Read-only pilot receipt snapshot; no mission advance, no fake HP setter.
  window.__apexQuestReflexRead = function readQ4ARealReflexPilot() {
    return AQ.state?.active&&AQ.state?.questReflex
      ? AQ.state.questReflexGate?.snapshot() : null;
  };
  window.__apexQuestTestRosterStart = function startQuestNActorFixture(name) {
    // Hard boundary: test-only on loopback. Not a Story skip or public entry.
    if (window.__APEX_TEST_MODE !== true ||
        !['localhost', '127.0.0.1', '::1'].includes(String(window.location?.hostname || '')))
      return false;
    if (!window.APEX_QUEST_MULTI_ACTOR_CORE?.fixtureRoster(name)) return false;
    return window.startArsenalBattleMode('ROBOT', 'ROBOT', { questFixture: name });
  };
  window.__apexArsenalTestStartMatch = function startArsenalTestFixture(p1Name, p2Name) {
    if (window.__APEX_TEST_MODE !== true || !['localhost', '127.0.0.1', '::1'].includes(String(window.location?.hostname || ''))) return false;
    return window.startArsenalBattleMode(p1Name, p2Name, { testFixture: true });
  };

  // Lab entry deliberately reuses the default playable shell (ROBOT after the
  // HERO REWORK cutover) and the Arsenal combat mode. Only spawn cadence, KO/reward and HP persistence are Lab-specific.
  function mountLabPanel() {
    const host = document.getElementById('aq-dom-hud') || hudRoot();
    document.getElementById('aq-lab-panel')?.remove();
    const panel = document.createElement('details');
    panel.id = 'aq-lab-panel';
    if (window.innerWidth > 600) panel.open = true;
    const set = window.APEX_ARSENAL_C_SET && window.APEX_ARSENAL_C_SET.weapons || {};
    const list = (CFG.P0_WEAPON_IDS || []).map((id) => {
      const meta = set[id];
      const img = meta && meta.file ? '<img alt="" src="/assets/arsenal/' + meta.file + '">' : '';
      return '<button type="button" data-lab-weapon="' + id + '">' + img + id.replace(/_/g, ' ') + '</button>';
    }).join('');
    panel.innerHTML = '<summary>ARSENAL LAB · EQUIPMENT</summary>'
      + '<div class="aq-lab-intro">Tap a weapon to reveal one pickup. ROBOT vs ROBOT · endless HP.</div>'
      + '<button type="button" class="aq-lab-exit">← PRODUCT MENU</button>'
      + '<div class="aq-lab-message" role="status" aria-live="polite"></div>'
      + '<div class="aq-lab-grid">' + list + '</div>';
    panel.querySelector('.aq-lab-exit').addEventListener('click', () => window.exitArsenalLab());
    panel.querySelectorAll('[data-lab-weapon]').forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-lab-weapon');
      const slot = SPAWN.spawnLabWeapon(id);
      panel.querySelector('.aq-lab-message').textContent = slot
        ? id.replace(/_/g, ' ') + ' · READY' : 'LAB FULL — collect a pickup first';
    }));
    host.appendChild(panel);
  }

  window.startArsenalLab = function startArsenalLab() {
    if (!startArsenalBattleMode('ROBOT', 'ROBOT', { adminLab: true })) return false;
    const state = AQ.state;
    state.labMode = true;
    state.spawnHeld = true;
    state.spawnTimer = Infinity;
    state.unarmedFastConsumed = true;
    mountLabPanel();
    AQ.log('LAB_ENTER', 'fighters=ROBOT,ROBOT'); // HERO REWORK: lab runs the ROBOT rework shell
  };
  window.exitArsenalLab = function exitArsenalLab() {
    window.exitArsenalBattleMode();
    window.APEX_ARSENAL_META?.returnToProductMenu?.();
  };

  window.exitArsenalBattleMode = function exitArsenalBattleMode(options = {}) {
    detachReflexReceipt();
    const opts = (options && typeof options === 'object') ? options : {};
    const goldHosted = opts.goldHosted === true || window.__apexGoldBattleHosted === true;
    const state = AQ.state;
    if (state) {
      // Story listeners/surfaces are match-owned. No ghost E02 panel after
      // a retry, voluntary exit or successful Quest chapter handoff.
      state.questFirstWakeStoryView?.close?.();
      state.questFirstWakeStoryView=null;
      for (const f of fighters || []) if (f && f.data) f.data.arsenal = null;
      state.active = false;
      state.slots = [];
      state.visuals = [];
      state.over = null;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i] && projectiles[i].aq) projectiles.splice(i, 1);
    particles.length = 0;
    floatingTexts.length = 0;
    shockwaves.length = 0;
    const labPanel = document.getElementById('aq-lab-panel');
    if (labPanel) labPanel.remove();
    const battleExitBtn = document.getElementById('aq-battle-exit');
    if (battleExitBtn) battleExitBtn.style.display = 'none'; // PASS A: never leaks a legacy menu surface
    // Exiting always tears down the battle-audio/AV session. Presentation
    // destination is a separate concern owned by the host surface.
    window.apexEndBattleAudioSession?.('arsenal:match-exit');
    if (window.APEX_ARSENAL_AV) window.APEX_ARSENAL_AV.clear();
    if (window.APEX_ARSENAL_STORM) window.APEX_ARSENAL_STORM.clear();
    if (keyListener) {
      window.removeEventListener('keydown', keyListener);
      keyListener = null; // no leaked listeners
    }
    disposeArsenalDomHud();
    AQ.log('MODE_EXIT', 'mode=ARSENAL_BATTLE');

    if (goldHosted) {
      // Gold-hosted battle: engine teardown ONLY. Never open the legacy product
      // menu, never reset/restart theme music, and never expose legacy select.
      gameState = 'MENU';
      // The retired screens no longer exist; only the parked legacy HUD node
      // is touched, and never the Gold donor that shares the id.
      const legacyHud = (typeof legacyUiElement === 'function')
        ? legacyUiElement('hud')
        : document.getElementById('hud');
      if (legacyHud) legacyHud.style.opacity = 0;
      if (!opts.silentGoldExit) {
        try { window.postMessage({ type: 'APEX_CHAOS_BATTLE_EXIT' }, '*'); } catch (error) {}
      }
      return true;
    }

    // Q2 teardown authority: the game must cease being ARSENAL before
    // handing back to any menu navigator, including a replaced/async menu
    // adapter. The Gold-hosted path already applies this exact state law.
    // Mark MENU synchronously to prevent a stale simulation frame/input.
    gameState = 'MENU';
    // Legacy/non-Gold entry keeps its historical destination, but resumes the
    // ONE theme element from its preserved playhead (never restart at 0).
    goToMenu();
    window.apexPlayMenuMusic?.(false);
    return true;
  };

  // -------------------------------------------------------------------------
  // Inspection API (handoff §11)
  // -------------------------------------------------------------------------
  function fighterSnapshot(f) {
    if (!f) return null;
    const h = weaponApi.getHolder(f);
    return {
      name: f.name,
      hp: Math.round(f.hp * 10) / 10,
      maxHp: f.maxHp,
      x: Math.round(f.x),
      y: Math.round(f.y),
      weapon: h ? h.weaponId : 'NONE',
      weaponPhase: h ? h.phase : null,
      shotsFired: h ? h.shotsFired : 0,
    };
  }

  window.getArsenalBattleDebugState = function getArsenalBattleDebugState() {
    const state = AQ.state;
    if (!state) return { active: false, gameState };
    const telegraphs = state.slots.filter(s => s.phase === 'TELEGRAPH').length;
    const revealed = state.slots.filter(s => s.phase === 'REVEALED').length;
    return {
      active: state.active,
      gameState,
      over: state.over,
      winnerSide: state.winnerSide || null,
      labMode: !!state.labMode,
      battleMode: state.battleMode || 'LOCAL',
      labDamage: state.labDamage || 0,
      labHits: state.labHits || 0,
      time: Math.round(state.time * 100) / 100,
      spawnIn: Math.max(0, Math.round(state.spawnTimer * 100) / 100),
      activeSlots: state.slots.length,
      telegraphs,
      revealed,
      spawnedTotal: state.spawnedTotal,
      suppressedSpawns: state.suppressedSpawns,
      maxActiveSlots: state.maxActiveSlots,
      dmg: state.dmg || null,
      weaponDamageShare: state.dmg && (state.dmg.weapon + state.dmg.native) > 0
        ? Math.round(100 * state.dmg.weapon / (state.dmg.weapon + state.dmg.native)) / 100
        : null,
      aqProjectiles: projectiles.filter(p => p && p.aq).length,
      hero: fighterSnapshot(fighters[0]),
      rival: fighterSnapshot(fighters[1]),
      questFirstWake: !!state.questFirstWake,
      questMultiActor: !!state.questMultiActor,
      questTestFixture: state.questTestFixture || null,
      questOutcome: state.questOutcome || null,
      questActors: state.questMultiActor ? fighters.map(f => ({
        questId: f.questId, questTeam: f.questTeam, ...fighterSnapshot(f),
      })) : null,
      slots: state.slots.map(slot => ({
        id: slot.id,
        phase: slot.phase,
        age: Math.max(0, Math.round((state.time - (slot.spawnTime || 0)) * 100) / 100),
        weaponId: slot.weaponId || null,
        revealLeadSeconds: slot.revealLeadSeconds == null ? null : Math.round(slot.revealLeadSeconds * 100) / 100,
        predictedHeroETA: slot.predictedHeroETA == null ? null : Math.round(slot.predictedHeroETA * 100) / 100,
        predictedRivalETA: slot.predictedRivalETA == null ? null : Math.round(slot.predictedRivalETA * 100) / 100,
        earliestETA: slot.earliestETA == null ? null : Math.round(slot.earliestETA * 100) / 100,
        predictedFighter: slot.predictedFighter || null,
      })),
      events: AQ.events.slice(-40),
    };
  };

  // Headless stepping hook — identical code path to the rAF update.
  AQ.step = updateArsenalBattle;
  AQ.resetState = resetState;

  window.apexArsenalBattleRuntime = 'ready';
})();
