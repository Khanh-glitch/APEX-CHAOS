// POST-C weapon identity / rarity / counter-shield authority.
// docs/arsenal-quest/POST_C_WEAPON_IDENTITY_RARITY_SHIELD_AUTHORITY.md
(function apexArsenalIdentityRuntime() {
  if (window.apexArsenalIdentityRuntime === 'ready') return;
  const CFG = window.APEX_ARSENAL_CONFIG;
  if (!CFG) return;

  const TIER_COLORS = {
    T1: '#C9D0D7', T2: '#63E28B', T3: '#4F9DFF', T4: '#B66CFF', T5: '#FFB33C',
  };
  const TIER_ROLL = [
    ['T1', 0.30], ['T2', 0.30], ['T3', 0.23], ['T4', 0.12], ['T5', 0.05],
  ];
  const WEAPON_TIER = {
    PISTOL: 'T1', GLOCK_17: 'T1', TEC_9: 'T1', MAC_10: 'T1', DAGGER: 'T1',
    BERETTA_93R: 'T2', SMG: 'T2', P90: 'T2', ZBROYAR_Z15: 'T2',
    ZBROYAR_Z15_S1: 'T2', ZBROYAR_Z15_S2: 'T2', ZBROYAR_Z15_S3: 'T2',
    MOSSBERG_500: 'T2', SABRE: 'T2',
    DESERT_DEAGLE: 'T3', AK_47: 'T3', M16: 'T3', MBR: 'T3', SHOTGUN: 'T3',
    SAWED_OFF: 'T3', SPEAR: 'T3', GRENADE: 'T3',
    MAGNUM_500: 'T4', M249_SAW: 'T4', MBR2: 'T4', SZECSEI_FUCHS: 'T4', SPIKED_CLUB: 'T4',
    SNIPER: 'T5', JACKHAMMER: 'T5', BATTLE_AXE: 'T5',
  };
  const BY_TIER = { T1: [], T2: [], T3: [], T4: [], T5: [] };
  for (const [id, t] of Object.entries(WEAPON_TIER)) BY_TIER[t].push(id);

  const SHIELD_IDS = ['SWIRL_SHIELD', 'TOWER_SHIELD'];
  const MELEE_IDS = CFG.MELEE_WEAPON_IDS || ['BATTLE_AXE', 'DAGGER', 'SABRE', 'SPEAR', 'SPIKED_CLUB'];
  const GUN_IDS = (CFG.GUN_REGISTRY || []).map((e) => e.id);
  const OFFENSIVE_IDS = [...GUN_IDS, 'GRENADE', ...MELEE_IDS];

  CFG.P0_WEAPON_IDS = OFFENSIVE_IDS.slice(); // shields out of random pool
  CFG.OFFENSIVE_WEAPON_IDS = OFFENSIVE_IDS;
  CFG.SHIELD_IDS = SHIELD_IDS;
  CFG.WEAPON_TIER = WEAPON_TIER;
  CFG.TIER_COLORS = TIER_COLORS;
  CFG.TIER_ROLL = TIER_ROLL;
  CFG.BY_TIER = BY_TIER;
  CFG.tierOf = (id) => WEAPON_TIER[id] || null;
  CFG.isOffensive = (id) => !!WEAPON_TIER[id];
  CFG.isMelee = (id) => MELEE_IDS.includes(id);
  CFG.isGun = (id) => GUN_IDS.includes(id);

  CFG.THROWN_MELEE.speed = {
    SABRE: 1010, BATTLE_AXE: 920, DAGGER: 1210, SPEAR: 1065, SPIKED_CLUB: 965,
  };

  // Z15 family shares one ballistic identity (skins only).
  const Z15 = {
    family: 'SEMI', shots: 4, interval: 0.16, damagePerShot: 4.75, spread: 0.035,
    knockback: 100, bulletSpeed: 3400, bulletLife: 0.40, bulletRadius: 6.5, longSide: 156,
    sfx: 'smg_shot', sfxRate: 1.0, noCasing: false, noPumpRack: true, vfx: 'ar',
  };
  const IDENTITY = {
    PISTOL: { family: 'SEMI', shots: 3, interval: 0.22, damagePerShot: 4.5, spread: 0.05, knockback: 120, bulletSpeed: 2600, bulletLife: 1.0, bulletRadius: 7, sfx: 'pistol_shot', sfxRate: 1.0, vfx: 'lightPistol', exit: 'pistolFlip' },
    GLOCK_17: { family: 'SEMI', shots: 4, interval: 0.12, damagePerShot: 3.5, spread: 0.04, knockback: 90, bulletSpeed: 2550, bulletLife: 0.32, bulletRadius: 6, sfx: 'pistol_shot', sfxRate: 1.08, vfx: 'lightPistol', exit: 'cartwheel' },
    TEC_9: { family: 'SEMI', shots: 5, interval: 0.09, damagePerShot: 3.0, spread: 0.07, knockback: 80, bulletSpeed: 2800, bulletLife: 0.30, bulletRadius: 6, sfx: 'smg_shot', sfxRate: 1.12, vfx: 'burstPistol', exit: 'rearToss' },
    MAC_10: { family: 'AUTO', shots: 8, interval: 0.055, damagePerShot: 2.0, spread: 0.14, knockback: 55, bulletSpeed: 2900, bulletLife: 0.26, bulletRadius: 5.5, sfx: 'smg_shot', sfxRate: 1.18, vfx: 'compactSmg', exit: 'tumble', casingFan: 1.4 },
    BERETTA_93R: { family: 'BURST', shots: 6, interval: 0.06, burstPause: 0.22, burstSize: 3, damagePerShot: 3.0, spread: 0.05, knockback: 100, bulletSpeed: 2500, bulletLife: 0.33, bulletRadius: 6.5, sfx: 'pistol_shot', sfxRate: 1.04, vfx: 'burstPistol', exit: 'sideSpin' },
    SMG: { family: 'AUTO', shots: 8, interval: 0.085, damagePerShot: 2.25, spread: 0.08, knockback: 60, bulletSpeed: 3100, bulletLife: 0.9, bulletRadius: 6, sfx: 'smg_shot', sfxRate: 1.0, vfx: 'compactSmg', exit: 'settleFall' },
    P90: { family: 'AUTO', shots: 10, interval: 0.065, damagePerShot: 1.9, spread: 0.06, knockback: 50, bulletSpeed: 3200, bulletLife: 0.32, bulletRadius: 5.5, sfx: 'smg_shot', sfxRate: 1.14, vfx: 'compactSmg', exit: 'rollOut' },
    ZBROYAR_Z15: Object.assign({}, Z15, { exit: 'magDrop' }),
    ZBROYAR_Z15_S1: Object.assign({}, Z15, { exit: 'magDrop' }),
    ZBROYAR_Z15_S2: Object.assign({}, Z15, { exit: 'magDrop' }),
    ZBROYAR_Z15_S3: Object.assign({}, Z15, { exit: 'magDrop' }),
    MOSSBERG_500: { family: 'SHOTGUN', pellets: 7, cone: 0.50, damagePerPellet: 2.8, knockback: 180, bulletSpeed: 2400, bulletLife: 0.18, bulletRadius: 7, triggerRange: 460, sfx: 'shotgun_shot', sfxRate: 0.96, vfx: 'pumpShot', pumpRack: true, exit: 'dropThrow' },
    DESERT_DEAGLE: { family: 'SEMI', shots: 2, interval: 0.38, damagePerShot: 10.5, spread: 0.035, knockback: 220, bulletSpeed: 2800, bulletLife: 0.42, bulletRadius: 7.5, sfx: 'pistol_shot', sfxRate: 0.86, vfx: 'heavyPistol', exit: 'heavySpin' },
    AK_47: { family: 'AUTO', shots: 6, interval: 0.11, damagePerShot: 3.8, spread: 0.09, knockback: 110, bulletSpeed: 3300, bulletLife: 0.36, bulletRadius: 6.5, sfx: 'smg_shot', sfxRate: 0.92, vfx: 'ar', exit: 'stockKick' },
    M16: { family: 'BURST', shots: 6, interval: 0.08, burstPause: 0.28, burstSize: 3, damagePerShot: 3.6, spread: 0.04, knockback: 100, bulletSpeed: 3400, bulletLife: 0.38, bulletRadius: 6.5, sfx: 'smg_shot', sfxRate: 1.02, vfx: 'ar', exit: 'longToss' },
    MBR: { family: 'PRECISION', shots: 2, aimTime: 0.28, interval: 0.45, damage: 11, knockback: 300, bulletSpeed: 5000, bulletLife: 0.7, bulletRadius: 7, sfx: 'sniper_shot', sfxRate: 1.06, vfx: 'dmr', exit: 'opticSettle' },
    SHOTGUN: { family: 'AUTOSHOT', shots: 2, interval: 0.28, pellets: 6, cone: 0.28, spread: 0, damagePerPellet: 2.0, knockback: 200, bulletSpeed: 2500, bulletLife: 0.17, bulletRadius: 7, triggerRange: 640, sfx: 'shotgun_shot', sfxRate: 1.0, vfx: 'semiShot', noPumpRack: true, exit: 'bodyPunch' },
    SAWED_OFF: { family: 'SHOTGUN', pellets: 10, cone: 0.55, damagePerPellet: 2.45, knockback: 280, bulletSpeed: 2100, bulletLife: 0.12, bulletRadius: 6.5, triggerRange: 900, sfx: 'shotgun_shot', sfxRate: 0.88, vfx: 'sawedOff', noPumpRack: true, noCasing: true, hullOnExit: true, exit: 'breakOpen' },
    MAGNUM_500: { family: 'SEMI', shots: 1, interval: 0, damagePerShot: 28, spread: 0.02, knockback: 380, bulletSpeed: 3000, bulletLife: 0.5, bulletRadius: 9, sfx: 'pistol_shot', sfxRate: 0.78, vfx: 'revolver', noCasing: true, hullOnExit: true, exit: 'cylinderSpill' },
    M249_SAW: { family: 'AUTO', shots: 12, interval: 0.075, damagePerShot: 2.5, spread: 0.12, knockback: 70, bulletSpeed: 3100, bulletLife: 0.34, bulletRadius: 6, sfx: 'smg_shot', sfxRate: 0.84, vfx: 'lmg', casingFan: 1.8, exit: 'noseSlump' },
    MBR2: { family: 'PRECISION', shots: 2, aimTime: 0.34, interval: 0.5, damage: 14, knockback: 360, bulletSpeed: 5200, bulletLife: 0.72, bulletRadius: 7.2, sfx: 'sniper_shot', sfxRate: 0.98, vfx: 'dmr', exit: 'deepRecoil' },
    SZECSEI_FUCHS: { family: 'PRECISION', shots: 2, aimTime: 0.40, interval: 0.55, damage: 15, knockback: 400, bulletSpeed: 5400, bulletLife: 0.8, bulletRadius: 7.5, sfx: 'sniper_shot', sfxRate: 0.90, vfx: 'heavyPrecision', exit: 'longDrop' },
    SNIPER: { family: 'PRECISION', shots: 1, aimTime: 0.8, damage: 38, knockback: 420, bulletSpeed: 5800, bulletLife: 1.0, bulletRadius: 8, sfx: 'sniper_shot', sfxRate: 0.82, vfx: 'snipex', exit: 'kickBack' },
    JACKHAMMER: { family: 'AUTOSHOT', shots: 3, interval: 0.14, pellets: 5, cone: 0.55, damagePerPellet: 2.4, knockback: 160, bulletSpeed: 2400, bulletLife: 0.16, bulletRadius: 6.5, triggerRange: 400, sfx: 'shotgun_shot', sfxRate: 1.05, vfx: 'autoShot', noPumpRack: true, exit: 'cassetteSpin' },
  };

  function applyIdentity(id, spec) {
    const w = CFG.WEAPONS[id] || (CFG.WEAPONS[id] = {});
    Object.assign(w, spec);
    w.family = spec.family;
    w.tier = WEAPON_TIER[id];
  }
  for (const [id, spec] of Object.entries(IDENTITY)) applyIdentity(id, spec);
  for (const entry of (CFG.GUN_REGISTRY || [])) {
    const spec = IDENTITY[entry.id];
    if (!spec) continue;
    entry.family = spec.family;
    Object.assign(entry, spec);
  }

  function weightFor(id) {
    return CFG.isMelee(id) ? 0.5 : 1.0;
  }
  function rollTier(rng) {
    let r = rng();
    for (const [tier, p] of TIER_ROLL) {
      r -= p;
      if (r <= 0) return tier;
    }
    return 'T1';
  }
  function selectOffensiveWeapon(rng) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const u = random();
    // Independent intra-tier sample even if the caller only advances RNG once
    // per select (headless LCG). Keep u in [0,1) for the tier table.
    const u2 = (u * 104729 + 0.6180339887) % 1;
    const tier = rollTier(() => u);
    const pool = BY_TIER[tier];
    let total = 0;
    for (const id of pool) total += weightFor(id);
    let roll = u2 * total;
    for (const id of pool) {
      roll -= weightFor(id);
      if (roll < 0) return { id, tier };
    }
    return { id: pool[pool.length - 1], tier };
  }

  function threatShield(weaponId) {
    const w = CFG.WEAPONS[weaponId] || {};
    const fam = w.family;
    if (fam === 'SHOTGUN' || fam === 'AUTOSHOT') return 'TOWER_SHIELD';
    if (weaponId === 'GRENADE' || CFG.isMelee(weaponId)) return 'TOWER_SHIELD';
    return 'SWIRL_SHIELD';
  }

  CFG.weightFor = weightFor;
  CFG.selectOffensiveWeapon = selectOffensiveWeapon;
  CFG.threatShield = threatShield;
  CFG.IDENTITY = IDENTITY;

  window.APEX_ARSENAL_IDENTITY = {
    TIER_COLORS, WEAPON_TIER, BY_TIER, OFFENSIVE_IDS, SHIELD_IDS,
    selectOffensiveWeapon, threatShield, weightFor, rollTier,
  };
  window.apexArsenalIdentityRuntime = 'ready';
})();
