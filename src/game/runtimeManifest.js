export const BOOT_GAME_RUNTIMES = [
  ['/game/core/apexBattleAudioRuntime.js', 'apexBattleAudioRuntime'],
  ['/game/core/apexBattleSfxRuntime.js', 'apexBattleSfxRuntime'],
  ['/game/core/apexRenderPrimitives.js', 'apexRenderPrimitives'],
  ['/game/core/apexCombatEffectsRuntime.js', 'apexCombatEffectsRuntime'],
  ['/game/core/apexMajorMechanicVisuals.js', 'apexMajorMechanicVisuals'],
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
  ['/game/ui/apexCharacterSelectUi.js', 'apexCharacterSelectUi'],
  ['/game/ui/apexPickRuntime.js', 'apexPickRuntime'],
];

export const DEFERRED_GAME_RUNTIMES = [
  ['/game/core/apexFightTelemetry.js', 'apexFightTelemetry'],
  ['/game/fighters/musicianVisualRuntime.js', 'apexMusicianVisualRuntime'],
  ['/game/fighters/arcadeVisualRuntime.js', 'apexArcadeVisualRuntime'],
  ['/game/fighters/puppetVisualRuntime.js', 'apexPuppetVisualRuntime'],
  ['/game/fighters/bladeVisualRuntime.js', 'apexBladeVisualRuntime'],
  ['/game/fighters/ninjaVisualRuntime.js', 'apexNinjaVisualRuntime'],
  ['/game/modes/soloRuntime.js', 'apexSoloRuntime'],
  ['/game/modes/trialRuntime.js', 'apexTrialRuntime'],
  ['/game/fighters/stringHardeningRuntime.js', 'apexStringHardeningRuntime'],
  ['/game/fighters/galaxyRefinementRuntime.js', 'apexGalaxyRefinementRuntime'],
  ['/game/core/apexUtilityFeatures.js', 'apexUtilityFeatures'],
  ['/game/guards/apexGalaxyGuards.js', 'apexGalaxyGuards'],
  ['/game/guards/apexEngineerGuards.js', 'apexEngineerGuards'],
  ['/game/guards/apexFinalMatchGuard.js', 'apexFinalMatchGuard'],
  ['/game/modes/tamChienRuntime.js', 'apexTamChienRuntime'],
  ['/game/guards/apexBattleVisibilityGuard.js', 'apexBattleVisibilityGuard'],
  ['/game/guards/apexShotgunLateBinder.js', 'apexShotgunLateBinder'],
  ['/game/core/apexPoseLockRuntime.js', 'apexPoseLockRuntime'],
  ['/manualLab.js', 'apexManualLab'],
  ['/manualLabOnline.js', 'apexManualLabOnline', { optional: true }],
];

export const REQUIRED_GAME_RUNTIMES = BOOT_GAME_RUNTIMES;

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
  hintRuntimeSources(BOOT_GAME_RUNTIMES, 'preload');
}

export function prefetchDeferredRuntimeSources() {
  hintRuntimeSources(DEFERRED_GAME_RUNTIMES, 'prefetch');
}
