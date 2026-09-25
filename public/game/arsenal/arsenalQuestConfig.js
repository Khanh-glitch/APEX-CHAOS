// ARSENAL QUEST P0 — central tuning constants + shared runtime plumbing.
// Authoritative spec: docs/arsenal-quest/AGENT_HANDOFF.md
// Classic-script runtime; keep execution-order conventions (see src/game/runtimeManifest.js).
(function apexArsenalQuestConfig() {
  if (window.apexArsenalQuestConfig === 'ready') return;

  // First-pass tuning values from the handoff. All gameplay numbers live here
  // (or in the weapon registry below) so balance passes never touch logic.
  const CONFIG = {
    // --- Spawn law (handoff §5; V2 B-handoff A-CORR-1) ---
    SPAWN_CADENCE_SECONDS: 3.0,          // POST-C owner revision: exactly 3.0s
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
    MAX_ACTIVE_SLOTS: 8,                 // soft cap; suppression is logged

    // --- Fighters ---
    MATCH_HP: 100,
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
   * docs/arsenal-quest/POST_C_OWNER_FEEDBACK_REVISION_CONTRACT.md is the
   * authority for this block.
   *  §3 every staged Senko v9 gun is a separately spawnable weapon (data-driven
   *     registry — adding a gun never means another hand-written runtime);
   *  §4 weighted pickup selection (melee 0.5x, baseline 1.0x);
   *  §5 melee damage authority x1.5 + thrown-melee rules;
   *  §7 NEWBIE hero tuning.
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

  // Materialize WEAPONS entries for every non-compat registry gun.
  for (const e of GUN_REGISTRY) {
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
    const base = (CONFIG.WEAPONS[id] && CONFIG.WEAPONS[id].damage) || 0;
    return base * CONFIG.MELEE_DAMAGE_MULT;
  };

  // Thrown-melee tuning (owner: the throw must feel intentional — the actual
  // sprite flies straight, ricochets with per-weapon budgets, pins ~1s).
  CONFIG.THROWN_MELEE = {
    pinSeconds: 1.0,          // pinned into the struck opponent, following it
    pinDepth: 12,             // how deep the sprite sits into the target
    speed: { SABRE: 900, BATTLE_AXE: 820, DAGGER: 1080, SPEAR: 950, SPIKED_CLUB: 860 },
    ricochets: { BATTLE_AXE: 1, SPIKED_CLUB: 1, SPEAR: 2, SABRE: 3, DAGGER: 4 },
    pickupDelay: 0.35,        // owner grace before the thrower can re-collect
    spinRate: { SABRE: 9, BATTLE_AXE: 7, DAGGER: 12, SPEAR: 5, SPIKED_CLUB: 8 },
  };

  // ── §7 NEWBIE hero tuning ────────────────────────────────────────────────
  CONFIG.NEWBIE = {
    cooldown: 10,             // one active skill, 10s cooldown
    dashSpeed: 3400,          // fast — tuned in the real browser
    dashMaxSeconds: 0.55,     // fail-safe: never an endless chase
    turnRate: 11,             // trajectory bending (steering, rad/s)
    magnetRadius: 34,         // pickup collected when the dash passes this close
    magnetPull: 900,          // gentle last-metre pull on the pickup itself
  };

  CONFIG.GUN_REGISTRY = GUN_REGISTRY;
  CONFIG.GUN_FAMILIES = GUN_FAMILIES;

  // Owner-feedback heal support (independent of offensive 3.0s law).
  CONFIG.HEAL_ELIGIBLE_HP = 80;
  CONFIG.HEAL_MAX_ACTIVE = 1;
  CONFIG.HEAL_SPAWN_COOLDOWN = 9.0;
  CONFIG.HEAL_LIFETIME_SECONDS = 12;
  CONFIG.HEAL_RESTORE = {
    HEAL_H1: 10, HEAL_H2: 18, HEAL_H3: 28, HEAL_H4: 40, HEAL_H5: 55,
  };
  CONFIG.HEAL_WEIGHTS = {
    HEAL_H1: 7, HEAL_H2: 5, HEAL_H3: 3, HEAL_H4: 2, HEAL_H5: 1,
  };
  CONFIG.HEAL_IDS = ['HEAL_H1', 'HEAL_H2', 'HEAL_H3', 'HEAL_H4', 'HEAL_H5'];

  // P0 roster order matches docs/arsenal-quest/P0_ASSET_MANIFEST.csv
  // Spawn roster (POST-C §3): all 24 staged Senko v9 guns are separately
  // spawnable, plus GRENADE, the 5 melee weapons and the 2 shields.
  CONFIG.P0_WEAPON_IDS = [
    ...GUN_REGISTRY.map((e) => e.id),
    'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB',
    'SWIRL_SHIELD', 'TOWER_SHIELD',
  ];

  const API = {
    config: CONFIG,
    // Installed by arsenalQuestRuntime on mode entry; spawn/weapon runtimes read it.
    state: null,
    // Ring buffer of structured [AQ] events (handoff §11).
    events: [],
    log(event, fields) {
      const line = fields ? `[AQ] ${event} ${fields}` : `[AQ] ${event}`;
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
  window.apexArsenalQuestConfig = 'ready';
})();
