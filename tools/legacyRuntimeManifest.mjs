// TEST-ONLY legacy runtime compatibility graph.
//
// This module preserves the historical shared-engine/roster boot order used by
// regression harnesses. It is deliberately outside src/ so production loader
// code cannot import or expose these groups. Current Arsenal authority stays in
// src/game/runtimeManifest.js.
import {
  ARSENAL_PRODUCT_RUNTIMES,
  HUD_RUNTIMES,
  MENU_INTERACTIVE_RUNTIMES,
  PICK_RUNTIMES,
} from '../src/game/runtimeManifest.js';

export const LEGACY_ROSTER_RUNTIMES = [
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

export const LEGACY_COMBAT_CORE_RUNTIMES = [
  ['/game/core/apexBattleSfxRuntime.js', 'apexBattleSfxRuntime'],
  ['/game/core/apexRenderPrimitives.js', 'apexRenderPrimitives'],
  ['/game/core/apexCombatEffectsRuntime.js', 'apexCombatEffectsRuntime'],
  ['/game/core/apexMajorMechanicVisuals.js', 'apexMajorMechanicVisuals'],
];

export const LEGACY_BATTLE_CORE_RUNTIMES = [
  ...LEGACY_COMBAT_CORE_RUNTIMES,
  ...LEGACY_ROSTER_RUNTIMES,
  ...HUD_RUNTIMES,
];

export const LEGACY_BATTLE_DEFERRED_RUNTIMES = [
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

export const LEGACY_BATTLE_RUNTIMES = [
  ...LEGACY_BATTLE_CORE_RUNTIMES,
  ...LEGACY_BATTLE_DEFERRED_RUNTIMES,
];

// Compatibility names used by historical headless gates. They intentionally
// live only here; production src/game/runtimeManifest.js exports neither.
export const BOOT_GAME_RUNTIMES = [
  ...MENU_INTERACTIVE_RUNTIMES,
  ...LEGACY_COMBAT_CORE_RUNTIMES,
  ...LEGACY_ROSTER_RUNTIMES,
  ...PICK_RUNTIMES,
  ...HUD_RUNTIMES,
];

export const MODE_DEFERRED_RUNTIMES = Object.freeze({
  arsenalProduct: ARSENAL_PRODUCT_RUNTIMES,
});
