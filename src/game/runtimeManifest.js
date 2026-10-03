// Cache-bust classic runtime scripts that live under /public and therefore do
// not receive Vite content hashes. Without this, stable Cloudflare branch
// aliases can serve a previous Arsenal runtime even when index.html is new.
// Pre-pilot product-graph cutover: cache-bust the authority, product Meta /
// selection paths, shared core barrier, and compatibility ladder seam as one
// deliberate post-r33 revision.
export const APEX_ARSENAL_RUNTIME_REVISION = '20261003-pre-pilot-product-v1-r34';

// ─────────────────────────────────────────────────────────────────────────────
// PRE-REWORK BASELINE CLEANUP — runtime loading is classified by NEED, not by
// historical placement (authority §A2). Tiers:
//   Tier 0  critical boot shell      — React bundle + loader art (index.html).
//   Tier 1  menu interactive         — engine + the one runtime the menu nav
//                                      path actually calls into (audio bridge).
//   Tier 2  likely-next warmup       — after the menu is interactive, warm the
//                                      small public product graph and picker;
//                                      combat is route-intent and detached
//                                      history never warms. Background only.
//   Tier 3  intent-based             — a route click raises that route's group
//                                      to high priority and waits only for it.
//   Tier 4  match-specific           — assets actually needed by the selected
//                                      fighters/arena/encounter (loaded by the
//                                      runtimes themselves when they run).
//   Tier 5  deep lazy / rare         — Lab-only extras and legacy-mode assets
//                                      never sit on the first-interaction path.
// ─────────────────────────────────────────────────────────────────────────────

// Tier 1 — menu interactive. The engine's menu navigation (goToMenu /
// goToSelect / goToTournament / exitAutoBattle) calls stopBattleAudio(), which
// lives in apexBattleAudioRuntime. Nothing else from the old boot list is
// referenced before a route is entered (verified by call-graph audit + browser
// gate). The audio runtime also owns the eager AudioContext bootstrap.
export const MENU_INTERACTIVE_RUNTIMES = [
  ['/game/core/apexBattleAudioRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexBattleAudioRuntime'],
];

// Roster/fighter runtimes. Relative order is the historical boot order and is
// load-bearing: several of these chain-wrap populateRoster /
// syncSelectedFighterVfx (engineer → galaxy → katana → fang …), so the order
// must be preserved inside every group that includes them.
export const ROSTER_RUNTIMES = [
  ['/game/fighters/shotgunRuntime.js', 'apexShotgunRuntime'],
  ['/game/fighters/engineerRuntime.js', 'apexEngineerRuntime'],
  ['/game/guards/apexEngineerMergeBridge.js', 'apexEngineerMergeBridge'],
  ['/game/fighters/soccerChampionRuntime.js', 'apexSoccerChampionRuntime'],
  ['/game/core/apexPrecisionFixes.js', 'apexPrecisionFixes'],
  ['/game/core/apexFullRosterQa.js', 'apexFullRosterQa'],
  ['/game/guards/apexFreezeDisappearHotfix.js', 'apexFreezeDisappearHotfix'],
  ['/game/guards/apexRuntimeStability.js', 'apexRuntimeStability'],
  ['/game/guards/apexSlimeBodyCap.js', 'apexSlimeBodyCap'],
  ['/game/core/apexCanonicalBalance.js', 'apexCanonicalBalance'],
  ['/game/core/apexRosterExtensions.js', 'apexRosterExtensions'],
  ['/game/core/apexTextHygiene.js', 'apexTextHygiene'],
  ['/game/fighters/iceVisualRuntime.js', 'apexIceVisualRuntime'],
  ['/game/fighters/stringRuntime.js', 'apexStringRuntime'],
  ['/game/fighters/galaxyRuntime.js', 'apexGalaxyRuntime'],
  ['/game/fighters/soccerRuntime.js', 'apexSoccerRuntime'],
  ['/game/fighters/katanaRuntime.js', 'apexKatanaRuntime'],
  ['/game/fighters/fangRuntime.js', 'apexFangRuntime'],
];

// Combat leaf runtimes the engine's draw/update paths call (battle only —
// drawRosterPreview additionally needs renderPrimitives, hence its presence in
// the select group below).
export const COMBAT_CORE_RUNTIMES = [
  ['/game/core/apexBattleSfxRuntime.js', 'apexBattleSfxRuntime'],
  ['/game/core/apexRenderPrimitives.js', 'apexRenderPrimitives'],
  ['/game/core/apexCombatEffectsRuntime.js', 'apexCombatEffectsRuntime'],
  ['/game/core/apexMajorMechanicVisuals.js', 'apexMajorMechanicVisuals'],
];

// PASS B: universal combat HUD state adapter + renderer (battle shell).
export const HUD_RUNTIMES = [
  ['/game/ui/apexCombatHudRuntime.js', 'apexCombatHudRuntime'],
];

// JSON character-select presentation (wraps populateRoster at load time).
export const PICK_RUNTIMES = [
  ['/game/ui/apexPickRuntime.js', 'apexPickRuntime'],
];

// Tier 3 — the character-select route: roster patches + pick presentation.
// renderPrimitives comes first because drawRosterPreview calls drawSketchBlob.
export const SELECT_RUNTIMES = [
  COMBAT_CORE_RUNTIMES[1], // apexRenderPrimitives
  ...ROSTER_RUNTIMES,
  ...PICK_RUNTIMES,
];

// Battle core = everything a match needs that is not select-specific.
export const BATTLE_CORE_RUNTIMES = [
  ...COMBAT_CORE_RUNTIMES,
  ...ROSTER_RUNTIMES,
  ...HUD_RUNTIMES,
];

export const BATTLE_DEFERRED_RUNTIMES = [
  ['/game/core/apexFightTelemetry.js', 'apexFightTelemetry'],
  ['/game/fighters/musicianVisualRuntime.js', 'apexMusicianVisualRuntime'],
  ['/game/fighters/arcadeVisualRuntime.js', 'apexArcadeVisualRuntime'],
  ['/game/fighters/puppetVisualRuntime.js', 'apexPuppetVisualRuntime'],
  ['/game/fighters/bladeVisualRuntime.js', 'apexBladeVisualRuntime'],
  ['/game/fighters/ninjaVisualRuntime.js', 'apexNinjaVisualRuntime'],
  ['/game/fighters/stringHardeningRuntime.js', 'apexStringHardeningRuntime'],
  ['/game/fighters/galaxyRefinementRuntime.js', 'apexGalaxyRefinementRuntime'],
  ['/game/core/apexUtilityFeatures.js', 'apexUtilityFeatures'],
  ['/game/guards/apexGalaxyGuards.js', 'apexGalaxyGuards'],
  ['/game/guards/apexEngineerGuards.js', 'apexEngineerGuards'],
  ['/game/guards/apexFinalMatchGuard.js', 'apexFinalMatchGuard'],
  ['/game/guards/apexBattleVisibilityGuard.js', 'apexBattleVisibilityGuard'],
  ['/game/guards/apexShotgunLateBinder.js', 'apexShotgunLateBinder'],
  ['/game/core/apexPoseLockRuntime.js', 'apexPoseLockRuntime'],
];

// Full battle group (core + historically deferred battle extras).
export const BATTLE_RUNTIMES = [
  ...BATTLE_CORE_RUNTIMES,
  ...BATTLE_DEFERRED_RUNTIMES,
];

export const SOLO_RUNTIMES = [
  ['/game/modes/soloRuntime.js', 'apexSoloRuntime'],
];
export const TRIAL_RUNTIMES = [
  ['/game/modes/trialRuntime.js', 'apexTrialRuntime'],
];

export const MODE_DEFERRED_RUNTIMES = {
  manualLab: [
    ...BATTLE_CORE_RUNTIMES,
    ['/game/modes/apexControlChampionSkills.js', 'apexControlChampionSkills'],
    ['/manualLab.js', 'apexManualLab'],
    ['/game/network/apexRealtimeMultiplayer.js', 'apexRealtimeMultiplayer'],
    ['/manualLabOnline.js', 'apexManualLabOnline', { optional: true }],
  ],
  solo: SOLO_RUNTIMES,
  trial: TRIAL_RUNTIMES,
  tamChien: [
    ...BATTLE_CORE_RUNTIMES,
    ['/game/modes/tamChienRuntime.js', 'apexTamChienRuntime'],
  ],
  // Neutral shared Arsenal combat/product spine. It supports active Local
  // 1v1 and Bot Battle without loading the retired 20-stage quest ladder.
  arsenalCore: [
    ...BATTLE_CORE_RUNTIMES,
    ['/game/arsenal/arsenalCWeaponSet.generated.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalCSet'],
    ['/game/arsenal/arsenalQuestConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalQuestConfig'],
    ['/game/arsenal/arsenalIdentityRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalIdentityRuntime'],
    ['/game/arsenal/arsenalWeaponRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalWeaponRuntime'],
    ['/game/arsenal/arsenalSpawnRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalSpawnRuntime'],
    ['/game/arsenal/arsenalPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalPresentationRuntime'],
    ['/game/arsenal/arsenalFeelRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalFeelRuntime'],
    ['/game/arsenal/arsenalStormbreakerVfxRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalStormbreakerVfxRuntime'],
    ['/game/arsenal/arsenalManualSkillGate.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalManualSkillGate'],
    // HERO REWORK (doc-06): AIL + registry load BEFORE the shell select so the
    // playable-roster cutover is active wherever shells resolve.
    ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
    ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
    ['/game/arsenal/apexProductSurfaceRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexProductSurfaceRuntime'],
    ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
    ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
    ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
    ['/game/modes/arsenalQuestRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalQuestRuntime'],
    // CRYSTALA V1: gameplay-neutral Gold rig (authored motion/material) and the
    // real gameplay truth module. Both load BEFORE the mechanics/integration
    // runtimes that dispatch into them.
    ['/game/hero-rework/crystalaGoldV6.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaGoldV6'],
    ['/game/hero-rework/crystalGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalGameplayRuntime'],
    // FROST V1: gameplay truth module (same placement law as CRYSTAL).
    ['/game/hero-rework/frostGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGameplayRuntime'],
    // MAGNET V1: authoritative field/physics truth + canonical Gold rig before
    // thin executors; its presentation adapter loads last below.
    ['/game/hero-rework/magnetGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGameplayRuntime'],
    ['/game/hero-rework/magnetGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGoldV1'],
    // MIRROR G1A/B: deterministic canonical Gold bridge source; the thin
    // production adapter is loaded after the completed Hero presentation chain.
    ['/game/hero-rework/mirrorGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorGoldV1'],
    // HERO REWORK: mechanics + integration load AFTER the quest runtime so
    // they wrap its step/entry/exit hooks (never inside ARSENAL_HUB_RUNTIMES).
    ['/game/hero-rework/heroMechanicsRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkMechanics'],
    ['/game/hero-rework/heroReworkRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRuntime'],
    // ROBOT final presentation (2026-09-29): articulated 1280 head-space, springs,
    // jaw socket, wall/hit/fire, A1/A2/passive SFX, semantic events, teardown.
    ['/game/hero-rework/robotPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexRobotPresentationRuntime'],
    ['/game/hero-rework/hunterGoldV10.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterGoldV10'],
    ['/game/hero-rework/hunterPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterPresentationRuntime'],
    ['/game/hero-rework/crystalaPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaPresentationRuntime'],
    // FROST V1: Fusion Gold rig + presentation adapter (outermost draw chain).
    ['/game/hero-rework/frostGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGoldV1'],
    ['/game/hero-rework/frostPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostPresentationRuntime'],
    // MAGNET V1 outermost actor/effect adapter (preserves prior post-world debts).
    ['/game/hero-rework/magnetPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetPresentationRuntime'],
    // MIRROR G1B lifecycle/fixed-step bridge; G2A/G2B add Gold actor and A1/A2 presentation.
    ['/game/hero-rework/mirrorPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorPresentationRuntime'],
  ],
  select: SELECT_RUNTIMES,
  battle: BATTLE_RUNTIMES,
  // Historical load order (battle core → mode → battle deferred) preserved.
  soloBattle: [...BATTLE_CORE_RUNTIMES, ...SOLO_RUNTIMES, ...BATTLE_DEFERRED_RUNTIMES],
  trialBattle: [...BATTLE_CORE_RUNTIMES, ...TRIAL_RUNTIMES, ...BATTLE_DEFERRED_RUNTIMES],
};


// Explicit compatibility-only route for the detached historical 20-stage
// ladder. It is intentionally absent from normal boot, warmup, hub, and
// product actions. The shared core remains first; the ladder attaches only
// when a developer/history caller deliberately asks for this group.
const LEGACY_LADDER_INSERT_AT = MODE_DEFERRED_RUNTIMES.arsenalCore.findIndex(([src]) => src.includes('/game/arsenal/arsenalChamberPaletteRuntime.js'));
export const LEGACY_ARSENAL_QUEST_RUNTIMES = [
  // Preserve the old wrapper order exactly for an explicit history load: the
  // ladder used to install between Shell Select and palette/meta/mode hooks.
  ...MODE_DEFERRED_RUNTIMES.arsenalCore.slice(0, LEGACY_LADDER_INSERT_AT),
  ['/game/arsenal/arsenalQuestLadder.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalQuestLadder'],
  ...MODE_DEFERRED_RUNTIMES.arsenalCore.slice(LEGACY_LADDER_INSERT_AT),
];
MODE_DEFERRED_RUNTIMES.arsenalQuest = LEGACY_ARSENAL_QUEST_RUNTIMES;
MODE_DEFERRED_RUNTIMES.legacyArsenalQuest = LEGACY_ARSENAL_QUEST_RUNTIMES;

export const DEFERRED_GAME_RUNTIMES = [
  ...BATTLE_RUNTIMES,
  ...MODE_DEFERRED_RUNTIMES.manualLab.filter((entry) => !BATTLE_RUNTIMES.some((b) => b[0] === entry[0])),
  ...MODE_DEFERRED_RUNTIMES.solo,
  ...MODE_DEFERRED_RUNTIMES.trial,
  ...MODE_DEFERRED_RUNTIMES.tamChien.filter((entry) => !BATTLE_RUNTIMES.some((b) => b[0] === entry[0])),
  ...MODE_DEFERRED_RUNTIMES.arsenalCore.filter((entry) => !BATTLE_RUNTIMES.some((b) => b[0] === entry[0])),
  ...MODE_DEFERRED_RUNTIMES.select.filter((entry) => !BATTLE_RUNTIMES.some((b) => b[0] === entry[0])),
];

// Tier 2 — background warmup order after the menu is interactive.
// Warm only the tiny public product authority/hub and picker renderer. Shared
// combat is route-intent; the historical quest ladder is explicit legacy-only
// and must never enter this sequence. Loading remains sequential and
// priority-preemptable (see loader).
export const WARMUP_GROUP_SEQUENCE = [
  'arsenalHub',
  'select',
];

// Public product hub critical path. The graph/shop/draw shell loads its own
// save/config/selection/meta scripts only. Heavy Arsenal combat, weapons,
// presentation, and AV banks remain route-intent under arsenalCore; the
// detached ladder is not represented here. Internal order mirrors the shared
// core's early product dependencies.
export const ARSENAL_HUB_RUNTIMES = [
  ['/game/arsenal/arsenalQuestConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalQuestConfig'],
  // HERO REWORK: tiny pure-JS registry (no assets) so the hub's shell/meta
  // cards already reflect the playable-12 cutover. Keeps hub entry fast.
  ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
  ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
  ['/game/arsenal/apexProductSurfaceRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexProductSurfaceRuntime'],
  ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
  ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
  ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
];

// Back-compat aggregate: the engine-following set the old boot list implied
// (menu + battle core + select presentation), in the historical order. Used by
// the headless harness so it exercises the same world a real browser reaches
// after warmup.
export const BOOT_GAME_RUNTIMES = [
  ...MENU_INTERACTIVE_RUNTIMES,
  ...COMBAT_CORE_RUNTIMES,
  ...ROSTER_RUNTIMES,
  ...PICK_RUNTIMES,
  ...HUD_RUNTIMES,
];

export const REQUIRED_GAME_RUNTIMES = MENU_INTERACTIVE_RUNTIMES;

export function hintRuntimeSources(runtimes, rel = 'preload') {
  for (const [src] of runtimes) {
    if (document.head.querySelector(`link[data-apex-runtime-hint="${rel}:${src}"]`)) continue;
    const link = document.createElement('link');
    link.rel = rel;
    link.as = 'script';
    link.href = src;
    link.dataset.apexRuntimeHint = `${rel}:${src}`;
    document.head.appendChild(link);
  }
}

export function preloadRuntimeSources() {
  hintRuntimeSources(MENU_INTERACTIVE_RUNTIMES, 'preload');
}

export function prefetchDeferredRuntimeSources() {
  hintRuntimeSources(DEFERRED_GAME_RUNTIMES, 'prefetch');
}
