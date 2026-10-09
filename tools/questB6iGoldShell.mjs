/* Quest E06 pilot in the reproducible Gold shell generator.
 * Source-anchored; never modify HUD Base64 or Free Battle routing.
 */
export function adaptBreachGoldShellB6i(html){
 let result=html;
 function one(oldValue,newValue){
  const n=result.split(oldValue).length-1;
  if(n!==1)throw Error('B6i Gold source drift ('+n+') at '+oldValue.slice(0,60));
  result=result.replace(oldValue,newValue);
 }
 one('onBreakerChargeStory:launchQuestBreakerChargeStory});',
     'onBreakerChargeStory:launchQuestBreakerChargeStory,onBreachStory:launchQuestBreachStory});');
 one('  window.__apexGoldQuestBreakerChargeStoryEntry=launchQuestBreakerChargeStory;',
     '  window.__apexGoldQuestBreakerChargeStoryEntry=launchQuestBreakerChargeStory;\n'+
     "  function launchQuestBreachStory(){\n"+
     "    if(screen!=='home'||window.APEX_SCENE_TRANSITION?.active?.())return false;\n"+
     "    if(window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId!=='BREACH_WAVES')return false;\n"+
     "    questPreview=true;questPreviewKind='breach-waves-story';\n"+
     "    battleMode='bot';p1Hero='newbot';p2Hero='newbot';\n"+
     "    void launchBattleHud();\n"+
     "    return true;\n"+
     "  }\n"+
     "  window.__apexGoldQuestBreachStoryEntry=launchQuestBreachStory;");
 one("questPreviewKind==='breaker-charge-story'?'quest-breaker-charge-story':'quest-first-wake'",
     "questPreviewKind==='breaker-charge-story'?'quest-breaker-charge-story':questPreviewKind==='breach-waves-story'?'quest-breach-story':'quest-first-wake'");
 one("questPreviewKind==='breaker-charge-story'?'QUEST 01 // CHARGE THE BREAKER':'QUEST 01 // FIRST WAKE PLAYTEST'",
     "questPreviewKind==='breaker-charge-story'?'QUEST 01 // CHARGE THE BREAKER':questPreviewKind==='breach-waves-story'?'QUEST 01 // BREACH WAVES':'QUEST 01 // FIRST WAKE PLAYTEST'");
 one("questPreviewKind==='weapon-rain-story'?'NEWBOT':'NEWBOT + T.O.T'",
     "questPreviewKind==='weapon-rain-story'?'NEWBOT':questPreviewKind==='breach-waves-story'?'NEWBOT + T.O.T + RIVET':'NEWBOT + T.O.T'");
 one("questPreviewKind==='breaker-charge-story'?'IMPACT ACCUMULATOR':'SCRAP A + SCRAP B'",
     "questPreviewKind==='breaker-charge-story'?'IMPACT ACCUMULATOR':questPreviewKind==='breach-waves-story'?'THREE SCRAP WAVES':'SCRAP A + SCRAP B'");
 one("questPreviewKind==='breaker-charge-story'?'ONE SURVIVOR':'TWO ALLIES'",
     "questPreviewKind==='breaker-charge-story'?'ONE SURVIVOR':questPreviewKind==='breach-waves-story'?'THREE ALLIES':'TWO ALLIES'");
 one("questPreviewKind==='breaker-charge-story'?'6000 IMPACT':'TWO HOSTILES'",
     "questPreviewKind==='breaker-charge-story'?'6000 IMPACT':questPreviewKind==='breach-waves-story'?'WAVES A / B / C':'TWO HOSTILES'");
 one("questPreviewKind==='breaker-charge-story'?'CHARGE // IMPACT':'FIRST WAKE // 2v2'",
     "questPreviewKind==='breaker-charge-story'?'CHARGE // IMPACT':questPreviewKind==='breach-waves-story'?'BREACH // DEFEND':'FIRST WAKE // 2v2'");
 return result;
}
