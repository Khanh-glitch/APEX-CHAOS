// Cache-bust classic runtime scripts that live under /public and therefore do
// not receive Vite content hashes. Without this, stable Cloudflare branch
// aliases can serve a previous Arsenal runtime even when index.html is new.
export const APEX_ARSENAL_RUNTIME_REVISION = '20260926-storm-v9-parity-r5-flight';

export const BOOT_GAME_RUNTIMES = [
  ['/game/core/apexBattleAudioRuntime.js?v=20260926-mobile-sfx-unlock1', 'apexBattleAudioRuntime'],
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
  ['/game/ui/apexPickRuntime.js', 'apexPickRuntime'],
  // PASS B: universal combat HUD state adapter + renderer (boot-wide shell).
  ['/game/ui/apexCombatHudRuntime.js', 'apexCombatHudRuntime'],
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

export const MODE_DEFERRED_RUNTIMES = {
  manualLab: [
  ['/game/modes/apexControlChampionSkills.js', 'apexControlChampionSkills'],
  ['/manualLab.js', 'apexManualLab'],
  ['/game/network/apexRealtimeMultiplayer.js', 'apexRealtimeMultiplayer'],
  ['/manualLabOnline.js', 'apexManualLabOnline', { optional: true }],
  ],
  solo: [
    ['/game/modes/soloRuntime.js', 'apexSoloRuntime'],
  ],
  trial: [
    ['/game/modes/trialRuntime.js', 'apexTrialRuntime'],
  ],
  tamChien: [
    ['/game/modes/tamChienRuntime.js', 'apexTamChienRuntime'],
  ],
  arsenalQuest: [
    ['/game/arsenal/arsenalCWeaponSet.generated.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalCSet'],
    ['/game/arsenal/arsenalQuestConfig.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalQuestConfig'],
    ['/game/arsenal/arsenalIdentityRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalIdentityRuntime'],
    ['/game/arsenal/arsenalWeaponRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalWeaponRuntime'],
    ['/game/arsenal/arsenalSpawnRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalSpawnRuntime'],
    ['/game/arsenal/arsenalPresentationRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalPresentationRuntime'],
    ['/game/arsenal/arsenalFeelRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalFeelRuntime'],
    ['/game/arsenal/arsenalStormbreakerVfxRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalStormbreakerVfxRuntime'],
    ['/game/arsenal/arsenalManualSkillGate.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalManualSkillGate'],
    ['/game/arsenal/arsenalShellSelectRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalShellSelectRuntime'],
    ['/game/arsenal/arsenalQuestLadder.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalQuestLadder'],
    ['/game/arsenal/arsenalMetaRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalMetaRuntime'],
    ['/game/modes/arsenalQuestRuntime.js?v=20260926-storm-v9-parity-r5-flight', 'apexArsenalQuestRuntime'],
  ],
};

export const DEFERRED_GAME_RUNTIMES = [
  ...BATTLE_DEFERRED_RUNTIMES,
  ...MODE_DEFERRED_RUNTIMES.manualLab,
  ...MODE_DEFERRED_RUNTIMES.solo,
  ...MODE_DEFERRED_RUNTIMES.trial,
  ...MODE_DEFERRED_RUNTIMES.tamChien,
  ...MODE_DEFERRED_RUNTIMES.arsenalQuest,
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
