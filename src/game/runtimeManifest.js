// Cache-bust classic runtime scripts that live under /public and therefore do
// not receive Vite content hashes. This Phase 2B product-runtime transition
// from r38 to r39 must keep its lock and generated expectations in sync.
export const APEX_ARSENAL_RUNTIME_REVISION = '20261003-mirror-v1-r39';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime loading is classified by NEED, not by historical placement.
//   Tier 0  critical boot shell      — React bundle + loader art (index.html).
//   Tier 1  menu interactive         — engine + menu audio bridge.
//   Tier 2  likely-next warmup       — active Arsenal product core, then select.
//   Tier 3  intent-based             — a product action raises only its active
//                                      shared-engine/runtime group to priority.
//   Tier 4  match-specific           — assets required by the selected fighters
//                                      or arena are loaded by their runtimes.
// ─────────────────────────────────────────────────────────────────────────────

// Tier 1 — menu interactive. The engine's menu navigation uses the audio
// session runtime. Nothing else is needed before a product surface is entered.
export const MENU_INTERACTIVE_RUNTIMES = [
  ['/game/core/apexBattleAudioRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexBattleAudioRuntime'],
];

// Shared engine roster/fighter patch chain. Relative order is load-bearing:
// several runtimes wrap populateRoster / syncSelectedFighterVfx in sequence.
// These engine files remain shared infrastructure; product selectability is
// still governed only by src/game/productSurface.js.
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

// Current-neutral combat services shared by Arsenal and the generic engine.
export const CURRENT_COMBAT_CORE_RUNTIMES = [
  ['/game/core/apexBattleSfxRuntime.js', 'apexBattleSfxRuntime'],
  ['/game/core/apexRenderPrimitives.js', 'apexRenderPrimitives'],
  ['/game/core/apexCombatEffectsRuntime.js', 'apexCombatEffectsRuntime'],
];

// Generic Battle keeps its historical mechanic-visual patch after the current
// neutral services. The current Arsenal product does not execute that legacy
// mixed-mechanic runtime.
export const COMBAT_CORE_RUNTIMES = [
  ...CURRENT_COMBAT_CORE_RUNTIMES,
  ['/game/core/apexMajorMechanicVisuals.js', 'apexMajorMechanicVisuals'],
];

// Universal combat HUD state adapter + renderer.
export const HUD_RUNTIMES = [
  ['/game/ui/apexCombatHudRuntime.js', 'apexCombatHudRuntime'],
];

// Current Arsenal/Core Six character-select presentation.
export const PICK_RUNTIMES = [
  ['/game/ui/apexPickRuntime.js', 'apexPickRuntime'],
];

// Current product selection uses the shared UI/runtime primitive, not legacy
// fighter patches. Generic Battle retains the complete ROSTER_RUNTIMES group.
export const SELECT_RUNTIMES = [
  CURRENT_COMBAT_CORE_RUNTIMES[1], // apexRenderPrimitives
  ...PICK_RUNTIMES,
];

// Battle core = engine draw/update leaves, roster patches, and the combat HUD.
export const BATTLE_CORE_RUNTIMES = [
  ...COMBAT_CORE_RUNTIMES,
  ...ROSTER_RUNTIMES,
  ...HUD_RUNTIMES,
];

// Shared engine extras required by the current battle path. The ordering is
// preserved because these scripts wrap shared match lifecycle and rendering.
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

// Full shared battle group (core + active engine extras).
export const BATTLE_RUNTIMES = [
  ...BATTLE_CORE_RUNTIMES,
  ...BATTLE_DEFERRED_RUNTIMES,
];

// Current Arsenal engine chain. Collision, renderer/HUD and draw recovery are
// now product-owned current seams. No ROSTER_RUNTIMES bridge participates in
// the current Arsenal product path; generic Battle keeps its complete legacy
// BATTLE_CORE_RUNTIMES chain unchanged.
export const ARSENAL_SHARED_ENGINE_RUNTIMES = [
  ...CURRENT_COMBAT_CORE_RUNTIMES,
  ['/game/core/apexArsenalProductCollisionRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductCollisionRuntime'],
  ['/game/core/apexArsenalProductRenderHudRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductRenderHudRuntime'],
  ['/game/core/apexArsenalProductDrawRecoveryRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalProductDrawRecoveryRuntime'],
  ...HUD_RUNTIMES,
];

// Active neutral Arsenal product runtime. Bot Battle, Local 1v1, Shop/Draw,
// and the admin-only Lab share this chain. It has product-owned engine seams
// and does not inherit ROSTER_RUNTIMES or their legacy recovery/mutation guards.
export const ARSENAL_PRODUCT_RUNTIMES = [
  ...ARSENAL_SHARED_ENGINE_RUNTIMES,
  ['/game/arsenal/arsenalCWeaponSet.generated.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalCSet'],
  ['/game/arsenal/arsenalConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalConfig'],
  ['/game/arsenal/arsenalIdentityRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalIdentityRuntime'],
  ['/game/arsenal/arsenalWeaponRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalWeaponRuntime'],
  ['/game/arsenal/arsenalSpawnRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalSpawnRuntime'],
  ['/game/arsenal/arsenalPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalPresentationRuntime'],
  ['/game/arsenal/arsenalFeelRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalFeelRuntime'],
  ['/game/arsenal/arsenalStormbreakerVfxRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalStormbreakerVfxRuntime'],
  ['/game/arsenal/arsenalManualSkillGate.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalManualSkillGate'],
  ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
  ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
  ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
  ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
  ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
  ['/game/modes/arsenalBattleRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalBattleRuntime'],
  ['/game/hero-rework/crystalaGoldV6.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaGoldV6'],
  ['/game/hero-rework/crystalGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalGameplayRuntime'],
  ['/game/hero-rework/frostGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGameplayRuntime'],
  ['/game/hero-rework/magnetGameplayRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGameplayRuntime'],
  ['/game/hero-rework/magnetGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetGoldV1'],
  ['/game/hero-rework/mirrorGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorGoldV1'],
  ['/game/hero-rework/heroMechanicsRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkMechanics'],
  ['/game/hero-rework/heroReworkRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRuntime'],
  ['/game/hero-rework/robotPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexRobotPresentationRuntime'],
  ['/game/hero-rework/hunterGoldV10.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterGoldV10'],
  ['/game/hero-rework/hunterPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHunterPresentationRuntime'],
  ['/game/hero-rework/crystalaPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexCrystalaPresentationRuntime'],
  ['/game/hero-rework/frostGoldV1.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostGoldV1'],
  ['/game/hero-rework/frostPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexFrostPresentationRuntime'],
  ['/game/hero-rework/magnetPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMagnetPresentationRuntime'],
  ['/game/hero-rework/mirrorPresentationRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexMirrorPresentationRuntime'],
];

// Product/admin groups only. All other product routes have been removed rather
// than retained as compatibility loaders.
export const MODE_DEFERRED_RUNTIMES = {
  arsenalProduct: ARSENAL_PRODUCT_RUNTIMES,
  battle: BATTLE_RUNTIMES,
  battleDeferred: BATTLE_DEFERRED_RUNTIMES,
  select: SELECT_RUNTIMES,
};

function uniqueRuntimeEntries(groups) {
  const seen = new Set();
  return groups.filter(([src]) => {
    const key = String(src).split(/[?#]/, 1)[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Back-compat aggregate consumed by diagnostics and preload tooling. It now
// contains only the shared engine, active product, and selection chain.
export const DEFERRED_GAME_RUNTIMES = uniqueRuntimeEntries([
  ...BATTLE_RUNTIMES,
  ...ARSENAL_PRODUCT_RUNTIMES,
  ...SELECT_RUNTIMES,
]);

// Tier 2 — background warmup after the menu is interactive. These are the
// only groups that benefit the current product's first interactions.
export const WARMUP_GROUP_SEQUENCE = [
  'arsenalProduct',
  'select',
];

// Product meta's critical path. Shop/Draw/selection needs save/config/shell
// scripts; combat presentation and AV remain lazy until the battle is entered.
export const ARSENAL_HUB_RUNTIMES = [
  ['/game/arsenal/arsenalConfig.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalConfig'],
  ['/game/hero-rework/ailRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkAil'],
  ['/game/hero-rework/heroRegistry.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexHeroReworkRegistry'],
  ['/game/arsenal/arsenalShellSelectRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalShellSelectRuntime'],
  ['/game/arsenal/arsenalChamberPaletteRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalChamberPaletteRuntime'],
  ['/game/arsenal/arsenalMetaRuntime.js?v=' + APEX_ARSENAL_RUNTIME_REVISION, 'apexArsenalMetaRuntime'],
];

// Shared-engine set used by headless/current-hero gates. Its historical order
// remains stable; product-specific behavior is loaded separately above.
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
