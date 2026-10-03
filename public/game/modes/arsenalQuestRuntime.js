// Detached compatibility bridge for the retired Arsenal Quest runtime name.
//
// Normal product loading uses /game/modes/arsenalBattleRuntime.js. The legacy
// ladder bundle loads that neutral core first, then evaluates this marker so
// historic diagnostics can distinguish an explicitly requested detached path.
(function apexArsenalQuestRuntimeCompatibilityBridge() {
  if (window.apexArsenalBattleRuntime === 'ready') {
    window.apexArsenalQuestRuntime = 'compat-ready';
    return;
  }
  // Do not bootstrap gameplay from a retired filename. A caller that wants
  // compatibility must request the explicit arsenalLegacyQuest runtime group.
  window.apexArsenalQuestRuntime = 'detached-unavailable';
})(typeof window !== 'undefined' ? window : globalThis);
