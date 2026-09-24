// ARSENAL QUEST P0 — central tuning constants + shared runtime plumbing.
// Authoritative spec: docs/arsenal-quest/AGENT_HANDOFF.md
// Classic-script runtime; keep execution-order conventions (see src/game/runtimeManifest.js).
(function apexArsenalQuestConfig() {
  if (window.apexArsenalQuestConfig === 'ready') return;

  // First-pass tuning values from the handoff. All gameplay numbers live here
  // (or in the weapon registry below) so balance passes never touch logic.
  const CONFIG = {
    // --- Spawn law (handoff §5; V2 B-handoff A-CORR-1) ---
    SPAWN_CADENCE_SECONDS: 4.5,          // owner playtest: 2/3 of the 3.0s A cadence
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
      PISTOL:      { shots: 3, interval: 0.22, damagePerShot: 4.5, spread: 0.05, bulletSpeed: 780, bulletRadius: 7, bulletLife: 2.2, knockback: 120 },
      SHOTGUN:     { pellets: 8, cone: 0.62, damagePerPellet: 3.6, bulletSpeed: 640, bulletLife: 0.42, bulletRadius: 6, knockback: 950, triggerRange: 430 },
      SMG:         { shots: 8, interval: 0.085, damagePerShot: 2.4, spread: 0.10, bulletSpeed: 820, bulletRadius: 6, bulletLife: 2.2, knockback: 60 },
      SNIPER:      { aimTime: 0.8, damage: 26, bulletSpeed: 1450, bulletRadius: 8, bulletLife: 2.0, knockback: 260 },
      GRENADE:     { throwSpeed: 540, fuse: 1.4, blastRadius: 155, maxDamage: 20, knockback: 900 },
      SABRE:       { triggerRange: 225, windup: 0.10, reach: 250, halfAngle: 0.95, damage: 12, knockback: 520 },
      BATTLE_AXE:  { triggerRange: 265, windup: 0.42, reach: 285, halfAngle: 1.05, damage: 26, knockback: 1000, hitStop: 0.06, shake: 12 },
      DAGGER:      { triggerRange: 210, dashSpeed: 1300, dashTime: 0.17, hitBonus: 34, damage: 9 },
      SPEAR:       { triggerRange: 345, windup: 0.18, reach: 360, halfAngle: 0.30, damage: 15, knockback: 1100 },
      SPIKED_CLUB: { triggerRange: 245, windup: 0.22, reach: 255, halfAngle: 1.00, damage: 18, knockback: 850, stun: 0.8 },
      SWIRL_SHIELD:  { reflectRadius: 150, duration: 8 },
      TOWER_SHIELD:  { duration: 2.8, damageTakenMult: 0.25, speedMult: 0.55 },
    },
  };

  // P0 roster order matches docs/arsenal-quest/P0_ASSET_MANIFEST.csv
  CONFIG.P0_WEAPON_IDS = [
    'PISTOL', 'SHOTGUN', 'SMG', 'SNIPER', 'GRENADE',
    'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB',
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
