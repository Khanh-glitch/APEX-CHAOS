// ARSENAL BATTLE — shared tuning constants and runtime plumbing.
// Current product authority: docs/CURRENT_PRODUCT_AUTHORITY.md
// Classic-script runtime; keep execution-order conventions (see src/game/runtimeManifest.js).
(function apexArsenalConfig() {
  if (window.apexArsenalConfig === 'ready') return;

  // First-pass tuning values from the handoff. All gameplay numbers live here
  // (or in the weapon registry below) so balance passes never touch logic.
  const CONFIG = {
    // --- Spawn law (handoff §5; V2 B-handoff A-CORR-1) ---
    SPAWN_CADENCE_SECONDS: 4.5,          // V3: 4.5s offensive cadence
    // V2 B-handoff A-CORR-2: whole-circle reveal. One shared radius so the
    // rendered question-mark circle and the reveal logic cannot drift.
    REVEAL_CIRCLE_RADIUS: 42,            // == PICKUP_RADIUS (visible circle)
    REVEAL_LEAD_SECONDS: 2.0,            // movement-triggered lead
    FORCE_REVEAL_AGE_SECONDS: 3.0,       // hidden slot force-reveals at this age
    // Deprecated Checkpoint A centerline fields (superseded by A-CORR-2):
    REVEAL_LOOKAHEAD_MIN_SECONDS: 1.2,
    REVEAL_LOOKAHEAD_MAX_SECONDS: 1.8,
    REVEAL_PREDICT_HORIZON_SECONDS: 2.0,
    REVEAL_PREDICT_STEP_SECONDS: 1 / 30,
    // Deprecated aliases retained only for compatibility with older debug/tests.
    REVEAL_DELAY_MIN_SECONDS: 1.2,
    REVEAL_DELAY_MAX_SECONDS: 1.8,
    SPAWN_MARGIN: 90,                    // keep slots away from walls
    PICKUP_RADIUS: 42,                   // floor pickup marker radius
    PICKUP_TOUCH_BONUS: 30,              // extra overlap allowance vs fighter collision volume
    FIRST_SPAWN_DELAY_SECONDS: 1.0,      // small breather before the first telegraph
    MIN_SLOT_SPACING: 150,               // keep telegraphs spread out

    // --- Safety valves (must NOT restore one-at-a-time spawning) ---
    PICKUP_LIFETIME_SECONDS: 20,         // revealed pickups expire
    MAX_ACTIVE_SLOTS: 5,                 // V3 offensive cap (production law — unchanged)
    // Arsenal Lab (V1): the Lab suppresses ALL automatic spawning; equipment
    // exists ONLY when the owner taps it. Manual lab slots get their OWN
    // bounded cap so the Lab can never out-run rendering/pickup budgets —
    // this is separate from MAX_ACTIVE_SLOTS on purpose.
    LAB_MANUAL_SLOT_CAP: 6,

    // --- Fighters ---
    MATCH_HP: 1000,
    ARSENAL_DAMAGE_SCALE: 7,
    CRIT_DAMAGE_MULTIPLIER: 1.50,
    FIGHTER_SPEED: 520,
    HERO_COLOR: '#4fc3f7',
    RIVAL_COLOR: '#ff7043',

    // --- Weapons shared values ---
    RANGED_READY_DELAY_SECONDS: 0.35,    // small beat between pickup and first trigger
    BULLET_HIT_RADIUS_SCALE: 0.78,       // fraction of fighter radius used for projectile hits

    // --- Per-weapon first-pass tuning (handoff §7) ---
    WEAPONS: {
      // Checkpoint C §5.2: guns read as tracer events, not floating balls.
      // Collision is swept-segment, so speeds are never compensated by radius.
      PISTOL:      { shots: 3, interval: 0.22, damagePerShot: 4.5, spread: 0.05, bulletSpeed: 2600, bulletRadius: 7, bulletLife: 1.0, knockback: 120 },
      SHOTGUN:     { pellets: 8, cone: 0.62, damagePerPellet: 3.6, bulletSpeed: 2500, bulletLife: 0.17, bulletRadius: 6, knockback: 950, triggerRange: 430 },
      SMG:         { shots: 8, interval: 0.085, damagePerShot: 2.4, spread: 0.10, bulletSpeed: 3100, bulletRadius: 6, bulletLife: 0.9, knockback: 60 },
      SNIPER:      { aimTime: 0.8, damage: 26, bulletSpeed: 5800, bulletRadius: 8, bulletLife: 1.0, knockback: 260 },
      GRENADE:     { throwSpeed: 540, fuse: 1.4, blastRadius: 155, maxDamage: 20, knockback: 900 },
      SABRE:       { triggerRange: 225, windup: 0.10, reach: 250, halfAngle: 0.95, damage: 12, knockback: 520 },
      BATTLE_AXE:  { triggerRange: 265, windup: 0.42, reach: 285, halfAngle: 1.05, damage: 26, knockback: 1000, hitStop: 0.06, shake: 12 },
      DAGGER:      { triggerRange: 210, dashSpeed: 1300, dashTime: 0.17, hitBonus: 34, damage: 9 },
      SPEAR:       { triggerRange: 345, windup: 0.18, reach: 360, halfAngle: 0.30, damage: 15, knockback: 1100 },
      SPIKED_CLUB: { triggerRange: 245, windup: 0.22, reach: 255, halfAngle: 1.00, damage: 18, knockback: 850, stun: 0.8 },
      // STORMBREAKER — first red-tier (T6) fantasy weapon. B1: the confirmed-hit
      // damage is an EXPLICIT production-audited final value (446) — it does
      // NOT ride the x1.5 melee authority + x7 Arsenal equipment scale chain
      // (the old 52 x 1.5 x 7 = 546). The value flows through the ONE damage
      // path (CFG.meleeDamage -> aqDamage -> takeDamage) with the equipment
      // scale explicitly exempt for final-authority weapons — no hidden
      // post-subtraction anywhere. Balance values are production-audited
      // (docs/stormbreaker/v1-port): the V9 demo numbers are effect/feel
      // authority only, not balance authority.
      STORMBREAKER:  { confirmedHitDamage: 446, knockback: 900, stun: 2.0, shake: 15, hitStop: 0.08, exit: 'stormRelease' },
      SWIRL_SHIELD:  { reflectRadius: 150, duration: 8 },
      TOWER_SHIELD:  { duration: 2.8, damageTakenMult: 0.25, speedMult: 0.55 },
    },

    // --- Checkpoint C §6: fighter vs weapon power hierarchy ---
    // Identity preserved, lethality normalized PER MECHANIC (never one blind
    // global multiplier). Target over 60-120s: weapons 70-80% of meaningful
    // direct damage, native kit 20-30% mostly as setup/control/mobility/defense.
    NATIVE_ARSENAL_MULT: {
      projectile: 0.55, // native shots / rockets / thrown impacts
      blast: 0.50,      // aoe nukes, mines, explosions
      beam: 0.50,       // lasers / fields / zones
      dot: 0.60,        // burn / poison / status ticks
      melee: 0.70,      // native close-combat hits
      contact: 0.85,    // body-slam / collision-family damage
      default: 0.65,
    },
  };

  /* ══ POST-C OWNER FEEDBACK REVISION ═══════════════════════════════════════
   * The accepted Arsenal tuning contract is preserved in this shared block.
   *  §3 every staged Senko v9 gun is a separately spawnable weapon (data-driven
   *     registry — adding a gun never means another hand-written runtime);
   *  §4 weighted pickup selection (melee 0.5x, baseline 1.0x);
   *  §5 melee damage authority x1.5 + thrown-melee rules;
   * ══════════════════════════════════════════════════════════════════════ */

  // ── §3 data-driven gun registry ──────────────────────────────────────────
  // ONE entry per staged Senko v9 asset (tools/arsenal-assets/source/guns/
  // senko-v9/). The weapon runtime picks its executor from `family`:
  //   SEMI/AUTO/BURST — sequential shots through the shared gun pipeline;
  //   PRECISION       — the aim-then-release C pipeline (charged long shot);
  //   SHOTGUN         — instant pellet fan (C shotgun pipeline, parameterized);
  //   AUTOSHOT        — short sequential blast sequence (fan per shot).
  // `sfx` reuses ONLY the locked Sonniss GDC baseline (§3: no new sourcing):
  // pistol_shot / smg_shot / shotgun_shot / sniper_shot.
  const GUN_FAMILIES = {
    SEMI: { sfx: 'pistol_shot', longSide: 148, recoilPx: 2.0, recoilRot: 0.024, recoilTau: 0.06 },
    AUTO: { sfx: 'smg_shot', longSide: 154, recoilPx: 1.2, recoilRot: 0.012, recoilTau: 0.05 },
    BURST: { sfx: 'smg_shot', longSide: 154, recoilPx: 1.6, recoilRot: 0.018, recoilTau: 0.055 },
    PRECISION: { sfx: 'sniper_shot', longSide: 188, recoilPx: 3.4, recoilRot: 0.038, recoilTau: 0.10 },
    SHOTGUN: { sfx: 'shotgun_shot', longSide: 166, recoilPx: 2.8, recoilRot: 0.032, recoilTau: 0.09 },
    AUTOSHOT: { sfx: 'shotgun_shot', longSide: 162, recoilPx: 2.2, recoilRot: 0.026, recoilTau: 0.07 },
  };

  // Compat guns keep their hand-tuned C entries above (PISTOL→colt, SMG→MP5,
  // SHOTGUN→SPAS 12, SNIPER→Snipex Alligator) and appear here so the registry
  // covers all 24 staged assets.
  const GUN_REGISTRY = [
    { id: 'PISTOL', art: 'colt', family: 'SEMI', compat: true },
    { id: 'SMG', art: 'MP5', family: 'AUTO', compat: true },
    { id: 'SHOTGUN', art: 'SPAS 12', family: 'SHOTGUN', compat: true },
    { id: 'SNIPER', art: 'Snipex Alligator', family: 'PRECISION', compat: true },

    // — pistols —
    { id: 'GLOCK_17', art: 'glock-17', family: 'SEMI',
      shots: 3, interval: 0.20, damagePerShot: 4.2, spread: 0.045, knockback: 110,
      bulletSpeed: 2600, bulletLife: 0.34, bulletRadius: 6.5, longSide: 142 },
    { id: 'BERETTA_93R', art: 'Beretta 93R', family: 'BURST',
      shots: 3, interval: 0.07, damagePerShot: 3.6, spread: 0.06, knockback: 110,
      bulletSpeed: 2500, bulletLife: 0.33, bulletRadius: 6.5, longSide: 144 },
    { id: 'DESERT_DEAGLE', art: 'desert deagle', family: 'SEMI',
      shots: 2, interval: 0.30, damagePerShot: 7.5, spread: 0.04, knockback: 180,
      bulletSpeed: 2800, bulletLife: 0.40, bulletRadius: 7.5, longSide: 148 },
    { id: 'MAGNUM_500', art: 'magnum 500', family: 'SEMI',
      shots: 2, interval: 0.34, damagePerShot: 9.0, spread: 0.03, knockback: 220,
      bulletSpeed: 2900, bulletLife: 0.44, bulletRadius: 8, longSide: 150 },
    { id: 'SZECSEI_FUCHS', art: 'szecsei & fuchs', family: 'SEMI',
      shots: 3, interval: 0.24, damagePerShot: 5.0, spread: 0.03, knockback: 120,
      bulletSpeed: 2700, bulletLife: 0.38, bulletRadius: 6.5, longSide: 146 },
    { id: 'TEC_9', art: 'tec 9', family: 'AUTO', sfx: 'smg_shot',
      shots: 6, interval: 0.09, damagePerShot: 2.6, spread: 0.09, knockback: 80,
      bulletSpeed: 2900, bulletLife: 0.30, bulletRadius: 6, longSide: 140 },

    // — SMGs / rifles / LMG —
    { id: 'MAC_10', art: 'MAC 10', family: 'AUTO',
      shots: 8, interval: 0.07, damagePerShot: 2.2, spread: 0.12, knockback: 70,
      bulletSpeed: 3000, bulletLife: 0.30, bulletRadius: 6, longSide: 136 },
    { id: 'P90', art: 'p90', family: 'AUTO',
      shots: 10, interval: 0.075, damagePerShot: 2.1, spread: 0.085, knockback: 70,
      bulletSpeed: 3200, bulletLife: 0.32, bulletRadius: 5.5, longSide: 142 },
    { id: 'AK_47', art: 'AK-47', family: 'AUTO',
      shots: 6, interval: 0.10, damagePerShot: 3.4, spread: 0.08, knockback: 100,
      bulletSpeed: 3300, bulletLife: 0.36, bulletRadius: 6.5, longSide: 158 },
    { id: 'M16', art: 'm16', family: 'BURST',
      shots: 3, interval: 0.09, damagePerShot: 4.0, spread: 0.05, knockback: 100,
      bulletSpeed: 3400, bulletLife: 0.38, bulletRadius: 6.5, longSide: 158 },
    { id: 'ZBROYAR_Z15', art: 'Zbroyar Z-15', family: 'SEMI',
      shots: 4, interval: 0.16, damagePerShot: 4.2, spread: 0.04, knockback: 100,
      bulletSpeed: 3400, bulletLife: 0.40, bulletRadius: 6.5, longSide: 156 },
    { id: 'ZBROYAR_Z15_S1', art: 'Zbroyar Z-15 skin1', family: 'BURST',
      shots: 3, interval: 0.09, damagePerShot: 4.2, spread: 0.045, knockback: 100,
      bulletSpeed: 3400, bulletLife: 0.40, bulletRadius: 6.5, longSide: 156 },
    { id: 'ZBROYAR_Z15_S2', art: 'Zbroyar Z-15 skin2', family: 'AUTO',
      shots: 7, interval: 0.085, damagePerShot: 2.8, spread: 0.07, knockback: 90,
      bulletSpeed: 3300, bulletLife: 0.38, bulletRadius: 6, longSide: 156 },
    { id: 'ZBROYAR_Z15_S3', art: 'Zbroyar Z-15 skin3', family: 'SEMI',
      shots: 3, interval: 0.20, damagePerShot: 5.2, spread: 0.03, knockback: 120,
      bulletSpeed: 3500, bulletLife: 0.44, bulletRadius: 6.5, longSide: 156 },
    { id: 'M249_SAW', art: 'm249 saw', family: 'AUTO',
      shots: 12, interval: 0.09, damagePerShot: 2.6, spread: 0.13, knockback: 70,
      bulletSpeed: 3100, bulletLife: 0.34, bulletRadius: 6, longSide: 164 },

    // — precision (aim-then-release; `damage` = charged shot total) —
    { id: 'MBR', art: 'project MBR', family: 'PRECISION',
      aimTime: 0.55, damage: 16, knockback: 420, stun: 0.12,
      bulletSpeed: 5200, bulletLife: 0.75, bulletRadius: 7.5, longSide: 184 },
    { id: 'MBR2', art: 'project MBR2', family: 'PRECISION',
      aimTime: 0.50, damage: 14, knockback: 380, stun: 0.10,
      bulletSpeed: 5400, bulletLife: 0.75, bulletRadius: 7, longSide: 186 },

    // — shotguns —
    { id: 'MOSSBERG_500', art: 'Mossberg 500', family: 'SHOTGUN',
      pellets: 7, cone: 0.55, damagePerPellet: 3.8, knockback: 150,
      bulletSpeed: 2400, bulletLife: 0.18, bulletRadius: 7, triggerRange: 460, longSide: 164 },
    { id: 'SAWED_OFF', art: 'sawed-off shotgun', family: 'SHOTGUN',
      pellets: 9, cone: 0.95, damagePerPellet: 3.0, knockback: 210,
      bulletSpeed: 2200, bulletLife: 0.13, bulletRadius: 6.5, triggerRange: 330, longSide: 128 },
    { id: 'JACKHAMMER', art: 'pancor jackhammer', family: 'AUTOSHOT',
      shots: 3, interval: 0.12, pellets: 5, cone: 0.5, damagePerPellet: 2.6, knockback: 120,
      bulletSpeed: 2400, bulletLife: 0.16, bulletRadius: 6.5, triggerRange: 420, longSide: 150 },
  ];


  // V4.3 OWNER HANDOFF — ONE authoritative special-weapon catalogue.
  // These ID records are shared by Free Battle and Quest. New T1/T2 records
  // auto-enter Quest through the ordinary CFG.BY_TIER pool; no quest ID list.
  // Art paths refer to faithful PNG-derived runtime sprite assets from the
  // user's handoff. Lab pixel values are 1000HP-world reference values;
  // 'finalDamage' prevents accidental second ×7 scaling on port.
  const V43 = Object.freeze({
    FLARE_GUN:Object.freeze({tier:'T2',name:'Flare Gun',kind:'flare',family:'SPECIAL',
      art:'/assets/arsenal/v43/FLARE_GUN.webp',worldWidth:150,muzzleU:.96,muzzleV:.34,
      reflectableKinds:['flare'],muzzleDx:3,muzzleDy:-8,speed:490,radius:10,drag:.23,
      direct:63,burnTicks:4,burnInterval:.3,burnDamage:14}),
    TACTICAL_CROSSBOW:Object.freeze({tier:'T2',name:'Tactical Crossbow',kind:'bolt',family:'SPECIAL',
      art:'/assets/arsenal/v43/TACTICAL_CROSSBOW.webp',projectile:'/assets/arsenal/v43/BOLT.webp',
      worldWidth:178,muzzleU:.96,muzzleV:.5,reflectableKinds:['bolt'],muzzleDx:0,muzzleDy:-10,
      speed:1480,maxSpeed:1700,acceleration:180,radius:7,projectileWidth:121,tipOffset:47,
      direct:112,slowSeconds:.3,slowMult:.85}),
    STEEL_BALL_LAUNCHER:Object.freeze({tier:'T2',name:'Steel Ball Launcher',kind:'ball',family:'SPECIAL',
      art:'/assets/arsenal/v43/STEEL_BALL_LAUNCHER.webp',projectile:'/assets/arsenal/v43/STEEL_BALL.webp',
      worldWidth:153,muzzleU:.95,muzzleV:.39,reflectableKinds:['ball'],muzzleDx:6,muzzleDy:-7,
      speed:1400,radius:12,projectileWidth:31,peak:98,ricochetPeak:109.76,
      blastRadius:90,restitution:.86,horizontalRetention:.94,maxBounces:1}),
    COMBAT_BOOMERANG:Object.freeze({tier:'T2',name:'Combat Boomerang',kind:'boomerang',family:'SPECIAL',
      art:'/assets/arsenal/v43/COMBAT_BOOMERANG.webp',worldWidth:124,
      muzzleU:.92,muzzleV:.5,reflectableKinds:['boomerang'],muzzleDx:-60,muzzleDy:-11,
      windup:.14,spin:54,spinEnd:.8,flightSeconds:1.7,
      speed:1450,minTurnSpeed:1150,maxTurnSpeed:1650,accelLimit:2100,
      outgoing:63,returning:63,radius:13,maxHitsPerLeg:1}),
    RPG_7:Object.freeze({tier:'T3',name:'RPG-7',kind:'rocket',family:'SPECIAL',
      art:'/assets/arsenal/v43/RPG_7.webp',projectile:'/assets/arsenal/v43/RPG_ROCKET.webp',
      worldWidth:190,muzzleU:.89,muzzleV:.5,reflectableKinds:['rocket'],muzzleDx:-12,muzzleDy:-6,
      speed:420,acceleration:760,maxSpeed:990,radius:15,projectileWidth:98,
      tipOffset:39,peak:161,blastRadius:126}),
    FLAMETHROWER:Object.freeze({tier:'T3',name:'Flamethrower',kind:'flame',family:'SPECIAL',
      art:'/assets/arsenal/v43/FLAMETHROWER.webp',worldWidth:174,muzzleU:.96,muzzleV:.37,
      reflectableKinds:[],muzzleDx:-1,muzzleDy:6,duration:.65,ticks:5,tickStart:.1,tickInterval:.13,
      tickDamage:18,range:650,cone:.36,burnTicks:5,burnInterval:.25,burnDamage:13,idealRange:530}),
    PLASMA_SPLITTER:Object.freeze({tier:'T4',name:'Plasma Splitter',kind:'plasma',family:'SPECIAL',
      art:'/assets/arsenal/v43/PLASMA_SPLITTER.webp',worldWidth:189,muzzleU:.95,muzzleV:.5,
      reflectableKinds:['plasma-core','plasma'],muzzleDx:-14,muzzleDy:-13,charge:.5,coreSpeed:525,splitAfter:.47,shards:3,
      shardSpeed:660,shardTurnRate:6.2,spread:[-.22,0,.22],shardDamage:67,coreDamage:42,radius:9}),
    SHRAPNEL_MINE_LAUNCHER:Object.freeze({tier:'T4',name:'Shrapnel Mine Launcher',kind:'mine',family:'SPECIAL',
      art:'/assets/arsenal/v43/SHRAPNEL_MINE_LAUNCHER.webp',
      projectile:'/assets/arsenal/v43/SHRAPNEL_MINE.webp',
      worldWidth:175,projectileWidth:78,muzzleU:.95,muzzleV:.44,reflectableKinds:['mine'],muzzleDx:2,muzzleDy:-8,
      deployDelay:.16,speed:540,drag:460,flightMax:.62,armSeconds:.48,
      triggerRadius:135,triggerAge:12,peak:140,blastRadius:150,
      fragments:8,fragmentSpeed:480,maxFragmentHits:2,fragmentDamage:31.5}),
  });
  // Disabled handoff concepts stay OUT of the catalogue by owner decision:
  // CHAIN_WHIP, HARPOON_LAUNCHER, RAILGUN, TWIN_REAPER_SCYTHES.
  CONFIG.V43_WEAPONS=V43;
  CONFIG.V43_SPECIAL_IDS=Object.freeze(Object.keys(V43));
  for(const [id,s] of Object.entries(V43)){
    if(CONFIG.WEAPONS[id]||GUN_REGISTRY.some(e=>e.id===id))
      throw Error('V43 duplicate weapon registry ID: '+id);
    // GUN_REGISTRY is the generic ranged/equipment pool; SPECIAL variants
    // override their executor below and are never emitted as default bullets.
    // SPECIAL is NOT one of the 24 conventional firearms; keep that family
    // stable for critical-hit/headless and Magnet mechanics. It remains a
    // ranged offensive pickup through the master tier pool.
    CONFIG.WEAPONS[id]={...s,shots:1,finalDamage:true,sfx:'skill',longSide:s.worldWidth,
      recoilPx:11,recoilRot:.1,recoilTau:.09};
    CONFIG.FIREARM_DISPLAY_MODE=CONFIG.FIREARM_DISPLAY_MODE||{};
  }

  // Materialize WEAPONS entries for every non-compat registry gun.
  for (const e of GUN_REGISTRY) {
    if (e.special) continue; // V4.3 bespoke physics, one shared catalogue
    if (e.compat) { CONFIG.WEAPONS[e.id].family = e.family; continue; }
    const fam = GUN_FAMILIES[e.family];
    CONFIG.WEAPONS[e.id] = {
      art: e.art,
      family: e.family,
      sfx: e.sfx || fam.sfx,
      longSide: e.longSide || fam.longSide,
      recoilPx: fam.recoilPx, recoilRot: fam.recoilRot, recoilTau: fam.recoilTau,
      shots: e.shots || 1,
      interval: e.interval || 0,
      pellets: e.pellets || 0,
      cone: e.cone || 0,
      damage: e.damage || 0,
      damagePerShot: e.damagePerShot || 0,
      damagePerPellet: e.damagePerPellet || 0,
      spread: e.spread || 0,
      knockback: e.knockback || 120,
      stun: e.stun || 0,
      aimTime: e.aimTime || 0,
      bulletSpeed: e.bulletSpeed,
      bulletLife: e.bulletLife,
      bulletRadius: e.bulletRadius,
      triggerRange: e.triggerRange || 0,
    };
  }

  // ── §4 weighted spawn selection ──────────────────────────────────────────
  // Raw selection weights: a melee pickup is 0.5 as likely as a baseline
  // non-melee pickup (owner: melee spawns felt far too frequent). The spawn
  // runtime consumes these through an injectable RNG (deterministic tests).
  CONFIG.SPAWN_WEIGHTS = { melee: 0.5, base: 1.0 };
  CONFIG.MELEE_WEAPON_IDS = ['BATTLE_AXE', 'DAGGER', 'SABRE', 'SPEAR', 'SPIKED_CLUB'];

  // ── §5 melee damage authority + thrown-melee rules ───────────────────────
  // ONE authority for melee damage: hand strikes AND thrown strikes both read
  // CONFIG.meleeDamage(). Every listed melee weapon is +50% from C values
  // (SABRE 12→18, BATTLE_AXE 26→39, DAGGER 9→13.5, SPEAR 15→22.5, CLUB 18→27).
  CONFIG.MELEE_DAMAGE_MULT = 1.5;
  CONFIG.meleeDamage = function meleeDamage(id) {
    const w = CONFIG.WEAPONS[id] || {};
    // B1: red-tier confirmed-hit damage is an explicit audited FINAL value —
    // it is not derived through the melee +50% authority.
    if (w.confirmedHitDamage != null) return w.confirmedHitDamage;
    return (w.damage || 0) * CONFIG.MELEE_DAMAGE_MULT;
  };

  // Thrown-melee tuning (owner: the throw must feel intentional — the actual
  // sprite flies straight, ricochets with per-weapon budgets, pins ~1s).
  CONFIG.THROWN_MELEE = {
    pinSeconds: 1.0,          // pinned into the struck opponent, following it
    pinDepth: 12,             // how deep the sprite sits into the target
    speed: { SABRE: 900, BATTLE_AXE: 820, DAGGER: 1080, SPEAR: 950, SPIKED_CLUB: 860, STORMBREAKER: 1350 },
    ricochets: { BATTLE_AXE: 1, SPIKED_CLUB: 1, SPEAR: 2, SABRE: 3, DAGGER: 4, STORMBREAKER: 1 },
    pickupDelay: 0.35,        // owner grace before the thrower can re-collect
    spinRate: { SABRE: 9, BATTLE_AXE: 7, DAGGER: 12, SPEAR: 5, SPIKED_CLUB: 8, STORMBREAKER: 82 },
  };

  // STORMBREAKER V9 executable-reference parity.
  // The HTML reference is the visual/feel authority; the live engine remains
  // physics/collision/damage authority. These visual dimensions are derived
  // literally from the reference PNG (1448px long side * scale):
  // spawn .18 = 260.64px, held .18*.86 = 224.15px, flight .18*.80 = 208.51px.
  CONFIG.STORMBREAKER = {
    windupSeconds: 0.28,
    readyDelaySeconds: 0.45,
    throwSpeed: 1350,
    spinRate: 82,
    // Confirmed-hit stun (matches WEAPONS.STORMBREAKER.stun). The floor
    // lightning hazard keeps its own distinct (shorter) pulse cadence.
    stunSeconds: 2.0,
    // B1 missed-storm failsafe: bounded flight lifetime (see
    // arsenalWeaponRuntime aq_thrown flight update). A release that connects
    // with nothing exits through the physical tumble — never lingers.
    maxFlightSeconds: 2.2,
    // B8 homing pursuit: bounded continuous steering (rad/s) toward the
    // owner's LIVING opponent after release. The cap is the whole identity:
    // the bolt CURVES after a moving opponent but can never snap/teleport
    // onto them, and the speed stays exactly throwSpeed (fast/heavy).
    homingTurnRateRadPerSec: 2.6,
    // B3 floor-lightning contact hazard: the VISIBLE floor-bolt geometry is
    // the hit authority. One discrete bolt↔fighter contact = one stun of
    // floorBoltStunSeconds (no damage), gated per pulse (bolt) per fighter.
    // floorBoltHazard is the balance kill-switch (default on).
    floorBoltHazard: true,
    floorBoltStunSeconds: 1.0,
    // B4/correction pass: body presentation shrank again (~86% of CP4) —
    // held 178 / flight 164 vs the 150px-diameter (radius 75) fighters.
    // ONLY the body and body-attached effects follow these — arena-edge
    // lightning reach, floor discharge reach, impact burst, and scene flash
    // keep their world scale (they are computed from world anchors, not from
    // the body long side).
    spawnLongSide: 240,
    heldLongSide: 178,
    flightLongSide: 164,
    // Compatibility aliases consumed by older Stormbreaker-only paths.
    worldLongSide: 164,
    floorLongSide: 240,
    // Correction pass: PROJECTILE COLLISION AUTHORITY, decoupled from every
    // presentation long side. Value = the pre-CP4 accepted behavior:
    // meleeDrawLong 209 * 0.14 = 29.26, i.e. swept hitR vs a 75-radius
    // fighter = 75*0.78 + 29.26 = 87.76 (B7/B8 acceptance campaign values).
    // spawnThrownMelee reads THIS, never a draw long side — shrinking the
    // body sprite can no longer change gameplay collision.
    thrownRadius: 29.26,
    // Owner correction: floor/spawn is flipped 180° from the original port.
    floorAngleRad: Math.PI * 1.5,
    // B6 owner correction: the held/flight change is a MIRROR REFLECTION of
    // the visual (local negative scale across the weapon long axis), NOT a
    // +pi rotation. The old rotation hack is retired (offset 0); world aim,
    // velocity, collision, and homing are untouched by presentation.
    flightVisualOffsetRad: 0,
    mirrorLocal: true,
  };

  // ── §B7 red-tier (T6) hero-manipulation immunity ─────────────────────────
  // While a red-tier weapon sits as a floor pickup, hero manipulation must
  // not move, yank, auto-acquire, deny, or reroute it: no magnetic pull, no
  // dash-to-weapon auto acquisition, no teleport/swap, no force drop/disarm,
  // no barrier/cage weapon-deny. PHYSICAL pickup (walk-over touch resolve)
  // always works, and the HOLDER of the weapon is NOT CC-immune — only the
  // pickup interaction and the thrown projectile are protected. The thrown
  // red-tier projectile carries heroManipulationImmune in the engine
  // (crystal-wall reflect/re-own, magnet shell, gravity-well absorb must all
  // leave it alone: hero manipulation can't redirect it).
  CONFIG.isHeroManipulablePickup = function isHeroManipulablePickup(slot) {
    if (!slot) return true;
    if (slot.heroInteractionImmune === true) return false;
    return !(slot.weaponId && CONFIG.tierOf && CONFIG.tierOf(slot.weaponId) === 'T6');
  };



  CONFIG.GUN_REGISTRY = GUN_REGISTRY;
  CONFIG.GUN_FAMILIES = GUN_FAMILIES;

  // Owner-feedback heal support (independent of offensive 3.0s law).
  CONFIG.HEAL_ELIGIBLE_HP = 800;
  CONFIG.HEAL_MAX_ACTIVE = 1;
  CONFIG.HEAL_SPAWN_COOLDOWN = 9.0;
  CONFIG.HEAL_LIFETIME_SECONDS = 12;
  CONFIG.HEAL_RESTORE = {
    HEAL_H1: 70, HEAL_H2: 126, HEAL_H3: 196, HEAL_H4: 280, HEAL_H5: 385,
  };
  CONFIG.CRIT_CHANCE = {
    PISTOL: 0.07, GLOCK_17: 0.06, TEC_9: 0.06, MAC_10: 0.05,
    BERETTA_93R: 0.07, SMG: 0.07, P90: 0.08,
    ZBROYAR_Z15: 0.09, ZBROYAR_Z15_S1: 0.09, ZBROYAR_Z15_S2: 0.08, ZBROYAR_Z15_S3: 0.10,
    MOSSBERG_500: 0.10, DESERT_DEAGLE: 0.13, AK_47: 0.10, M16: 0.11,
    MBR: 0.18, SHOTGUN: 0.12, SAWED_OFF: 0.11, MAGNUM_500: 0.18,
    M249_SAW: 0.10, MBR2: 0.22, SZECSEI_FUCHS: 0.24, SNIPER: 0.32, JACKHAMMER: 0.14,
  };
  CONFIG.FIREARM_DISPLAY_MODE = { equipped: 1, floor: 0.92, exit: 0.96 };
  // B11: normalized around the accepted rifle baseline (AK-47 / M16 / Z15,
  // 152-154). Class ladder reads with clear gaps in BOTH directions:
  // compact pistols (124-130) < heavy pistols (136-138) < SMG family
  // (140-145) < rifle baseline (152-154); shotguns/LMG/precision larger
  // where their silhouettes justify it (156-188).
  // Display scale for data-driven V4.3 special equipment is in V43 itself.
  CONFIG.FIREARM_LONG_SIDE = {
    PISTOL: 126, GLOCK_17: 124, TEC_9: 140, BERETTA_93R: 130, DESERT_DEAGLE: 136, MAGNUM_500: 138,
    MAC_10: 141, SMG: 145, P90: 143, AK_47: 154, M16: 154,
    ZBROYAR_Z15: 152, ZBROYAR_Z15_S1: 152, ZBROYAR_Z15_S2: 152, ZBROYAR_Z15_S3: 152,
    M249_SAW: 170, MBR: 174, MBR2: 176, SZECSEI_FUCHS: 176, SNIPER: 188,
    MOSSBERG_500: 158, SHOTGUN: 160, SAWED_OFF: 132, JACKHAMMER: 156,
    STORMBREAKER: 150, // red-tier floor read (x0.92 display mode ≈ 138px)
  };
  for(const [id,spec] of Object.entries(CONFIG.V43_WEAPONS||{})){
    CONFIG.FIREARM_LONG_SIDE[id]=spec.worldWidth;
  }
  CONFIG.HEAL_WEIGHTS = {
    HEAL_H1: 7, HEAL_H2: 5, HEAL_H3: 3, HEAL_H4: 2, HEAL_H5: 1,
  };
  CONFIG.HEAL_IDS = ['HEAL_H1', 'HEAL_H2', 'HEAL_H3', 'HEAL_H4', 'HEAL_H5'];

  // Active weapon roster and order.
  // Spawn roster (POST-C §3): all 24 staged Senko v9 guns are separately
  // spawnable, plus GRENADE, the 5 melee weapons and the 2 shields.
  CONFIG.P0_WEAPON_IDS = [
    ...GUN_REGISTRY.map((e) => e.id),...CONFIG.V43_SPECIAL_IDS,
    'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB',
    'STORMBREAKER',
    'SWIRL_SHIELD', 'TOWER_SHIELD',
  ];

  // Owner-only, keyboard-gated BOT weapon selector. OFF by default on
  // every page load. This is an ergonomic live-playtest tool, not an
  // alternate damage/spawn engine or public menu option.
  // All equipable offensive AND defensive weapons are addressable by ID.
  const ownerCatalog=Object.freeze(CONFIG.P0_WEAPON_IDS.filter((id,i,ids)=>
    ids.indexOf(id)===i));
  const ownerTest={
    active:false,selectedWeaponId:null,catalog:ownerCatalog,
    idForNumber(number){return ownerCatalog[number-1]||null;},
    numberForId(id){const i=ownerCatalog.indexOf(id);return i<0?null:i+1;},
    roster(){return ownerCatalog.map((id,i)=>({number:i+1,id,name:
      CONFIG.V43_WEAPONS?.[id]?.name||CONFIG.WEAPONS?.[id]?.name||
      CONFIG.GUN_REGISTRY?.find(g=>g.id===id)?.name||id}));},
    popup(message,showRoster=false){
      let el=document.getElementById('aq-owner-keyboard-overlay');
      if(!el){el=document.createElement('div');el.id='aq-owner-keyboard-overlay';
        el.setAttribute('aria-live','polite');document.body.appendChild(el);}
      Object.assign(el.style,{position:'fixed',right:'16px',top:'16px',zIndex:'2147482000',
        width:showRoster?'min(680px,calc(100vw - 32px))':'min(440px,calc(100vw - 32px))',
        maxHeight:'65vh',overflowY:'auto',pointerEvents:'none',
        padding:'14px 18px',background:'rgba(8,13,21,.93)',color:'#f6e3b8',
        border:'1px solid rgba(244,183,85,.65)',borderRadius:'9px',
        boxShadow:'0 12px 42px #000a',font:'600 13px/1.6 ui-monospace,Consolas,monospace',
        whiteSpace:'normal'});
      const title=document.createElement('div');title.textContent=message;title.style.marginBottom='8px';
      el.replaceChildren(title);
      if(showRoster){
        const body=document.createElement('div');
        Object.assign(body.style,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:'0 10px',
          fontWeight:'400',fontSize:'12px'});
        for(const {number,id} of ownerTest.roster()){
          const row=document.createElement('div');row.textContent=String(number).padStart(2,'0')+' · '+id;
          if(id===ownerTest.selectedWeaponId)row.style.color='#83f1d0';body.appendChild(row);
        }el.appendChild(body);
      }
      if(ownerTest._hide)clearTimeout(ownerTest._hide);
      ownerTest._hide=setTimeout(()=>{el?.remove();ownerTest._hide=null;},showRoster?14000:3200);
    }
  };
  window.APEX_ARSENAL_OWNER_TEST=ownerTest;
  let ownerDigits='';
  window.addEventListener('keydown',ev=>{
    const editable=ev.target?.closest?.('input,textarea,select,[contenteditable="true"]');
    if(editable)return;
    // Ctrl+Shift+F8 is deliberately uncommon in Chrome/Windows. A browser
    // cannot override a shortcut reserved by the host OS.
    if(ev.ctrlKey&&ev.shiftKey&&!ev.altKey&&!ev.metaKey&&ev.code==='F8'&&!ev.repeat){
      ev.preventDefault();ev.stopPropagation();
      if(!ownerTest.active&&window.APEX_ARSENAL?.state?.active){
        ownerTest.popup('OWNER BOT TEST: exit the current match before activation');return;
      }
      ownerTest.active=!ownerTest.active;ownerDigits='';
      ownerTest.selectedWeaponId=null;
      if(ownerTest.active){
        ownerTest.popup('OWNER BOT TEST ON · chọn tướng bình thường · giữ SHIFT, gõ ID, thả SHIFT',true);
        window.APEX_ARSENAL_META?.openBotPick?.();
      }else ownerTest.popup('OWNER BOT TEST OFF · chế độ spawn bình thường');
      return;
    }
    if(!ownerTest.active||!window.APEX_ARSENAL?.state?.active
      ||window.APEX_ARSENAL.state.battleMode!=='BOT'
      ||ev.altKey||ev.ctrlKey||ev.metaKey)return;
    if(ev.code==='ShiftLeft'||ev.code==='ShiftRight'){if(!ev.repeat)ownerDigits='';return;}
    const match=/^(?:Digit|Numpad)([0-9])$/.exec(ev.code||'');
    if(ev.shiftKey&&match&&!ev.repeat){
      ev.preventDefault();ev.stopPropagation();
      if(ownerDigits.length<3)ownerDigits+=match[1];
    }
  },true);
  window.addEventListener('keyup',ev=>{
    if(!ownerTest.active||!(ev.code==='ShiftLeft'||ev.code==='ShiftRight')||!ownerDigits)return;
    const number=Number(ownerDigits);ownerDigits='';
    const state=window.APEX_ARSENAL?.state;
    if(!state?.active||state.battleMode!=='BOT'||state.labMode)return;
    const id=ownerTest.idForNumber(number);
    if(!id){ownerTest.popup('ID '+number+' không tồn tại · hợp lệ 1–'+ownerCatalog.length);return;}
    ownerTest.selectedWeaponId=id;
    // Only the next ordinary native TELEGRAPH->REVEALED slot is overridden.
    // Do not forge pickup ownership, mutate Fighter equipment or Quest loot.
    state.spawnTimer=Math.min(state.spawnTimer,.45);
    ownerTest.popup('NEXT BOT SPAWN · #'+number+' · '+id);
    window.APEX_ARSENAL?.log?.('OWNER_TEST_WEAPON', 'id='+number+' weapon='+id);
  },true);

  const API = {
    config: CONFIG,
    // Installed by the neutral Arsenal Battle core on mode entry; spawn/weapon runtimes read it.
    state: null,
    // Ring buffer of structured [ARSENAL] events (handoff §11).
    events: [],
    log(event, fields) {
      const line = fields ? `[ARSENAL] ${event} ${fields}` : `[ARSENAL] ${event}`;
      console.log(line);
      API.events.push(line);
      if (API.events.length > 160) API.events.splice(0, API.events.length - 160);
      return line;
    },
  };

  window.APEX_ARSENAL_CONFIG = CONFIG;
  window.APEX_ARSENAL = API;
  // Semantic presentation hook (arsenalPresentationRuntime owns the mapping).
  // No-op until the presentation layer registers; gameplay never depends on it.
  window.avCue = function avCue(name, opts) {
    if (window.APEX_ARSENAL_AV && window.APEX_ARSENAL_AV.cue) window.APEX_ARSENAL_AV.cue(name, opts);
  };

  // ── CP7 (owner playtest round 4) — gameplay-ready barrier ──────────────
  // The Arsenal HUB opens fast on its small critical-path group (CP6), but
  // every transition from the product menu INTO gameplay (Lab, Bot/Local
  // Battle START, re-entry) is a HARD barrier: the combat shell, fighters,
  // battle controls and Lab controls must not exist until the full
  // arsenalProduct tier has loaded AND its presentation init (image atlas
  // fetch/decode) has settled. Script evaluation alone is not readiness.
  //
  // State machine (window.apexArsenalTransitionState()):
  //   idle → lab-loading | match-loading → lab-ready | match-ready
  // Readiness probes: 'hub-ready', 'arsenal-full-runtime-ready',
  // 'av-images-ready', 'av-audio-ready'.
  window.__apexArsenalTransition = {
    state: 'idle', destination: null, since: 0, lastDurationMs: null, error: null, _pending: null,
  };
  window.apexArsenalTransitionState = function () {
    const t = window.__apexArsenalTransition;
    const AV = window.APEX_ARSENAL_AV;
    return {
      state: t.state,
      destination: t.destination,
      lastDurationMs: t.lastDurationMs,
      error: t.error,
      readiness: {
        'hub-ready': !!(window.APEX_ARSENAL_META && document.getElementById('aq-meta-root')),
        'arsenal-full-runtime-ready': !!window['__apexDeferredRuntimesReady_arsenalProduct'],
        'selected-battle-runtime-ready': !!(window.__apexBattleRuntimeState && window.__apexBattleRuntimeState.ready === true),
        'av-images-ready': !!(AV && AV.imagesSettled && AV.imagesSettled()),
        // CP7: compare against the TOTAL — audioReady() is a count and its
        // truthiness was true after a single decode, reporting the audio
        // tier ready while the bank was still decoding.
        'av-audio-ready': !!(AV && AV.audioSettled && AV.audioSettled()),
      },
    };
  };
  function runtimeTierReady(destination) {
    const fullReady = !!window['__apexDeferredRuntimesReady_arsenalProduct'];
    if (destination === 'match') {
      const selected = window.__apexBattleRuntimeState;
      return fullReady || !!(selected && selected.ready === true);
    }
    // Lab/diagnostics keep the canonical full graph requirement.
    return fullReady;
  }
  window.apexArsenalBarrierSatisfied = function (destination) {
    // Warm fast path: the runtime tier required by THIS destination is loaded
    // and shared Arsenal presentation images are settled.
    return !!(runtimeTierReady(destination)
      && window.APEX_ARSENAL_AV
      && window.APEX_ARSENAL_AV.imagesSettled
      && window.APEX_ARSENAL_AV.imagesSettled());
  };
  function showTransitionBadge(destination) {
    try {
      // Host the badge where it is actually VISIBLE: on the select screen the
      // hub root is hidden, so a cold START that waits on the barrier must
      // show the hint on the body instead of inside the hidden hub.
      const hub = document.getElementById('aq-meta-root');
      const hubVisible = !!(hub && hub.style.display !== 'none' && hub.getBoundingClientRect().width > 50);
      const host = hubVisible ? hub : document.body;
      let badge = document.getElementById('aq-transition-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'aq-transition-badge';
        badge.setAttribute('role', 'status');
        badge.style.cssText = 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);'
          + 'z-index:60;padding:8px 18px;border-radius:999px;background:rgba(20,22,28,0.92);'
          + 'color:#e8d9a0;font:600 13px system-ui,sans-serif;letter-spacing:0.08em;'
          + 'border:1px solid rgba(232,217,160,0.4);pointer-events:none;';
        host.appendChild(badge);
      }
      badge.textContent = (destination === 'lab' ? 'ARSENAL LAB' : 'ARSENAL MATCH') + ' · PREPARING…';
    } catch (error) { /* the badge is cosmetic; never block the barrier */ }
  }
  function hideTransitionBadge() {
    try { document.getElementById('aq-transition-badge')?.remove(); } catch (error) {}
  }
  window.apexArsenalGameplayBarrierSync = function apexArsenalGameplayBarrierSync(destination) {
    // Synchronous fast path for warm destinations: records the ready state
    // (the state machine must reflect EVERY entry, sync or awaited) and
    // returns true so the caller can open the destination in the same task —
    // zero added latency for re-entry. Returns false when the async barrier
    // must be used instead.
    if (window.apexArsenalBarrierSatisfied(destination)) {
      const t = window.__apexArsenalTransition;
      t.state = destination === 'lab' ? 'lab-ready' : 'match-ready';
      t.destination = destination;
      t.lastDurationMs = 0;
      t.error = null;
      return true;
    }
    return false;
  };
  window.apexArsenalGameplayBarrier = async function apexArsenalGameplayBarrier(destination) {
    const t = window.__apexArsenalTransition;
    const readyState = destination === 'lab' ? 'lab-ready' : 'match-ready';
    const loadingState = destination === 'lab' ? 'lab-loading' : 'match-loading';
    if (window.apexArsenalBarrierSatisfied(destination)) {
      t.state = readyState;
      t.destination = destination;
      t.lastDurationMs = 0;
      t.error = null;
      return true;
    }
    if (t._pending && t.state === loadingState && t.destination === destination) return t._pending;
    t.state = loadingState;
    t.destination = destination;
    t.since = performance.now();
    t.error = null;
    showTransitionBadge(destination);
    t._pending = (async () => {
      try {
        // Public match entry already awaited the exact selected-combatant set
        // behind the Gold transition. Do not immediately load every other hero.
        // Lab and compatibility/direct entry still fail open to the canonical
        // full product graph.
        if (!runtimeTierReady(destination)) {
          const ensure = window.__apexEnsureDeferredRuntimes;
          if (typeof ensure === 'function') await ensure('arsenalProduct');
        }
        if (!runtimeTierReady(destination)) {
          throw new Error(destination === 'match'
            ? 'selected battle runtime set did not finish loading'
            : 'arsenalProduct runtime group did not finish loading');
        }
        const AV = window.APEX_ARSENAL_AV;
        if (AV && AV.preload) {
          // Route intent: full preload (images + audio head start). The
          // images are the blocking dependency; audio decodes in parallel
          // and clips no-op safely until ready.
          AV.preload();
          if (AV.whenImagesReady) {
            const ok = await AV.whenImagesReady(8000);
            if (!ok) throw new Error('Arsenal presentation images did not finish loading');
          }
        }
        t.state = readyState;
        t.lastDurationMs = Math.round(performance.now() - t.since);
        return true;
      } catch (error) {
        t.state = 'idle';
        t.error = String((error && error.message) || error);
        return false;
      } finally {
        hideTransitionBadge();
        t._pending = null;
      }
    })();
    return t._pending;
  };
  // When the background warmup finishes the arsenalProduct group, start the
  // image-side preload early (NO audio decode — that stays route-intent
  // only, per CP5). This makes the barrier resolve instantly in the common
  // case where the user browses the hub for a moment before entering.
  (function watchArsenalFullRuntime() {
    const tick = () => {
      try {
        if (window['__apexDeferredRuntimesReady_arsenalProduct']) {
          const AV = window.APEX_ARSENAL_AV;
          if (AV && AV.preload) AV.preload({ audio: false });
          return;
        }
        const gate = window['__apexDeferredRuntimesPromise_arsenalProduct'];
        if (gate && gate.then) {
          gate.then(() => {
            const AV2 = window.APEX_ARSENAL_AV;
            if (AV2 && AV2.preload) AV2.preload({ audio: false });
          }).catch(() => {});
          return;
        }
      } catch (error) { /* retry below */ }
      setTimeout(tick, 500);
    };
    tick();
  })();
  window.apexArsenalConfig = 'ready';
})();
