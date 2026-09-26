// POST-C weapon identity / rarity / counter-shield authority.
// docs/arsenal-quest/POST_C_WEAPON_IDENTITY_RARITY_SHIELD_AUTHORITY.md
(function apexArsenalIdentityRuntime() {
  if (window.apexArsenalIdentityRuntime === 'ready') return;
  const CFG = window.APEX_ARSENAL_CONFIG;
  if (!CFG) return;

  // T6 RED is the first red tier (STORMBREAKER V1 port). Its 2% roll is carved
  // out of T1–T5 proportionally (x0.98), preserving the accepted relative
  // distribution of the existing tiers.
  const TIER_COLORS = {
    T1: '#C9D0D7', T2: '#63E28B', T3: '#4F9DFF', T4: '#B66CFF', T5: '#FFB33C', T6: '#FF4D5A',
  };
  const TIER_ROLL = [
    ['T1', 0.294], ['T2', 0.294], ['T3', 0.2254], ['T4', 0.1176], ['T5', 0.049], ['T6', 0.02],
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
    STORMBREAKER: 'T6',
  };
  const BY_TIER = { T1: [], T2: [], T3: [], T4: [], T5: [], T6: [] };
  for (const [id, t] of Object.entries(WEAPON_TIER)) BY_TIER[t].push(id);

  const SHIELD_IDS = ['SWIRL_SHIELD', 'TOWER_SHIELD'];
  const MELEE_IDS = CFG.MELEE_WEAPON_IDS || ['BATTLE_AXE', 'DAGGER', 'SABRE', 'SPEAR', 'SPIKED_CLUB'];
  const GUN_IDS = (CFG.GUN_REGISTRY || []).map((e) => e.id);
  // STORMBREAKER is offensive spawn pool material but is NOT a regular melee:
  // it keeps full base weight (no 0.5x melee penalty) and only ever rolls as
  // the T6 red tier.
  const OFFENSIVE_IDS = [...GUN_IDS, 'GRENADE', ...MELEE_IDS, 'STORMBREAKER'];

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
    STORMBREAKER: CFG.STORMBREAKER ? CFG.STORMBREAKER.throwSpeed : 1350,
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
    JACKHAMMER: { family: 'AUTOSHOT', shots: 3, interval: 0.14, pellets: 5, cone: 0.55, damagePerPellet: 2.4, knockback: 160, bulletSpeed: 2400, bulletLife: 0.16, bulletRadius: 6.5, triggerRange: 900, sfx: 'shotgun_shot', sfxRate: 1.05, vfx: 'autoShot', noPumpRack: true, exit: 'cassetteSpin' },
  };

  function applyIdentity(id, spec) {
    const w = CFG.WEAPONS[id] || (CFG.WEAPONS[id] = {});
    Object.assign(w, spec);
    w.family = spec.family;
    w.tier = WEAPON_TIER[id];
  }
  CFG.shotgunPelletLife = function shotgunPelletLife(speed) {
    const size = (typeof GAME_SIZE === 'number' && GAME_SIZE) || 1000;
    return (size * Math.SQRT2 + 80) / Math.max(1, speed);
  };
  for (const [id, spec] of Object.entries(IDENTITY)) applyIdentity(id, spec);
  for (const [id, spec] of Object.entries(IDENTITY)) {
    if (spec.family === 'SHOTGUN' || spec.family === 'AUTOSHOT') {
      const w = CFG.WEAPONS[id];
      if (w) w.bulletLife = CFG.shotgunPelletLife(w.bulletSpeed || spec.bulletSpeed);
    }
  }
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
    // STORMBREAKER is not a regular melee (isMelee is false), but its honest
    // counter is the TOWER fortress (25% damage + slow while guarding): the
    // swirl reflect only turns aq_bullet projectiles, never the thrown body.
    if (weaponId === 'STORMBREAKER') return 'TOWER_SHIELD';
    return 'SWIRL_SHIELD';
  }

  CFG.TIER_GLOW = {
    T1: { rx: 22, ry: 7, a: 0.20, pulse: 0.04, shimmer: false },
    T2: { rx: 28, ry: 8, a: 0.28, pulse: 0.08, shimmer: false },
    T3: { rx: 36, ry: 11, a: 0.38, pulse: 0.13, shimmer: false },
    T4: { rx: 48, ry: 14, a: 0.48, pulse: 0.18, shimmer: false },
    T5: { rx: 60, ry: 17, a: 0.58, pulse: 0.26, shimmer: true },
    // T6 RED — the red-tier floor presence; the live arena lightning (see
    // arsenalStormbreakerVfxRuntime) carries the rest of the escalation.
    T6: { rx: 78, ry: 22, a: 0.72, pulse: 0.32, shimmer: true },
  };

  CFG.EXIT_PROFILES = {
    pistolFlip:     { vx: 90,  vy: -240, g: 1650, spin: 11.5, life: 0.52 },
    cartwheel:      { vx: 70,  vy: -300, g: 1750, spin: 18,   life: 0.50 },
    rearToss:       { vx: -40, vy: -220, g: 1600, spin: 9,    life: 0.48 },
    tumble:         { vx: 50,  vy: -180, g: 1550, spin: 14,   life: 0.46 },
    sideSpin:       { vx: 110, vy: -160, g: 1500, spin: 16,   life: 0.50 },
    settleFall:     { vx: 20,  vy: -80,  g: 1400, spin: 4,    life: 0.42 },
    rollOut:        { vx: 130, vy: -90,  g: 1450, spin: 10,   life: 0.48 },
    magDrop:        { vx: 15,  vy: -60,  g: 1700, spin: 3.5,  life: 0.55, magBeat: true },
    dropThrow:      { vx: 40,  vy: -140, g: 1600, spin: -6,   life: 0.50 },
    heavySpin:      { vx: 55,  vy: -200, g: 1700, spin: 8,    life: 0.55 },
    stockKick:      { vx: -80, vy: -120, g: 1550, spin: -5,   life: 0.52 },
    longToss:       { vx: 70,  vy: -260, g: 1500, spin: 7,    life: 0.62 },
    opticSettle:    { vx: 25,  vy: -90,  g: 1400, spin: 2.2,  life: 0.48 },
    bodyPunch:      { vx: -30, vy: -70,  g: 1650, spin: -4,   life: 0.42 },
    breakOpen:      { vx: 20,  vy: -40,  g: 1200, spin: 2.8,  life: 0.70, hulls: 2 },
    cylinderSpill:  { vx: 10,  vy: -50,  g: 1300, spin: 1.6,  life: 0.65, hulls: 1 },
    noseSlump:      { vx: 15,  vy: -30,  g: 1800, spin: 1.2,  life: 0.70, nose: true },
    deepRecoil:     { vx: -100,vy: -80,  g: 1500, spin: -3,   life: 0.58 },
    longDrop:       { vx: 30,  vy: -220, g: 1450, spin: 5.5,  life: 0.68 },
    kickBack:       { vx: -140,vy: -60,  g: 1550, spin: -2.4, life: 0.60 },
    cassetteSpin:   { vx: 45,  vy: -110, g: 1500, spin: 22,   life: 0.55 },
    // STORMBREAKER release ghost: short forward scale-out, no gravity drop
    // (the real thrown projectile IS the weapon — no second axe in hand).
    stormRelease:  { vx: 0,   vy: 0,    g: 0,    spin: 0,    life: 0.22 },
  };

  CFG.VFX_RECIPES = {
    lightPistol:     { scale: 0.52, stretch: 0.82, smoke: 0.0,  smokeLife: 0.0,  impulse: 0 },
    burstPistol:     { scale: 0.62, stretch: 0.95, smoke: 0.15, smokeLife: 0.22, impulse: 1 },
    heavyPistol:     { scale: 1.05, stretch: 1.18, smoke: 0.45, smokeLife: 0.40, impulse: 4 },
    revolver:        { scale: 1.22, stretch: 1.25, smoke: 0.55, smokeLife: 0.48, impulse: 6 },
    compactSmg:      { scale: 0.48, stretch: 0.88, smoke: 0.25, smokeLife: 0.18, impulse: 1 },
    ar:              { scale: 0.78, stretch: 1.10, smoke: 0.35, smokeLife: 0.32, impulse: 3 },
    lmg:             { scale: 0.70, stretch: 1.05, smoke: 0.70, smokeLife: 0.55, impulse: 2 },
    pumpShot:        { scale: 1.45, stretch: 1.35, smoke: 1.10, smokeLife: 0.55, impulse: 8 },
    semiShot:        { scale: 1.15, stretch: 1.22, smoke: 0.70, smokeLife: 0.42, impulse: 6 },
    sawedOff:        { scale: 1.55, stretch: 1.10, smoke: 1.30, smokeLife: 0.62, impulse: 10 },
    autoShot:        { scale: 1.05, stretch: 1.15, smoke: 0.80, smokeLife: 0.36, impulse: 5 },
    dmr:             { scale: 0.95, stretch: 1.40, smoke: 0.40, smokeLife: 0.38, impulse: 5 },
    heavyPrecision:  { scale: 1.10, stretch: 1.55, smoke: 0.55, smokeLife: 0.48, impulse: 7 },
    snipex:          { scale: 1.35, stretch: 1.70, smoke: 0.75, smokeLife: 0.55, impulse: 9 },
  };

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
