// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_ENGINEER_WAR_MERGE_TARGET_BRIDGE(){
  if (window.__apexEngineerWarMergeTargetBridge) return;
  window.__apexEngineerWarMergeTargetBridge = true;
  const previousFighterUpdate = Fighter.prototype.update;
  Fighter.prototype.update = function(dt, enemy) {
    const directed = window.APEX_ENGINEER?.targetForDirected?.(enemy) || enemy;
    return previousFighterUpdate.call(this, dt, directed);
  };
})();
