/* B7 Gold E07 route, source-anchored and deliberately separate from Gold donor.
 * Append after B6i's overlay so canonical generated shell matches public/gold/shell.html
 * exactly. No changes to HUD Base64, responsive geometry, or Free Battle.
 */
export function adaptRivetGoldShellB7(html){
 let result=html;
 function one(a,b){
  const n=result.split(a).length-1;
  if(n!==1)throw Error('B7 Gold E07 source drift ('+n+') at '+a.slice(0,72));
  result=result.replace(a,b);
 }
 one('onBreachStory:launchQuestBreachStory});',
     'onBreachStory:launchQuestBreachStory,onRivetStory:launchQuestRivetStory});');
 one('  window.__apexGoldQuestBreachStoryEntry=launchQuestBreachStory;',
     '  window.__apexGoldQuestBreachStoryEntry=launchQuestBreachStory;\n'+
     "  function launchQuestRivetStory(){\n"+
     "    if(screen!=='home'||window.APEX_SCENE_TRANSITION?.active?.())return false;\n"+
     "    if(window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId!=='RIVET_OVERRIDDEN')return false;\n"+
     "    questPreview=true;questPreviewKind='rivet-overridden-story';\n"+
     "    battleMode='bot';p1Hero='newbot';p2Hero='newbot';\n"+
     "    void launchBattleHud();return true;\n"+
     "  }\n"+
     "  window.__apexGoldQuestRivetStoryEntry=launchQuestRivetStory;");
 one("questPreviewKind==='breach-waves-story'?'quest-breach-story':'quest-first-wake'",
     "questPreviewKind==='breach-waves-story'?'quest-breach-story':questPreviewKind==='rivet-overridden-story'?'quest-rivet-story':'quest-first-wake'");
 one("questPreviewKind==='breach-waves-story'?'QUEST 01 // BREACH WAVES':'QUEST 01 // FIRST WAKE PLAYTEST'",
     "questPreviewKind==='breach-waves-story'?'QUEST 01 // BREACH WAVES':questPreviewKind==='rivet-overridden-story'?'QUEST 01 // RIVET OVERRIDDEN':'QUEST 01 // FIRST WAKE PLAYTEST'");
 one("questPreviewKind==='breach-waves-story'?'NEWBOT + T.O.T + RIVET':'NEWBOT + T.O.T'",
     "questPreviewKind==='breach-waves-story'?'NEWBOT + T.O.T + RIVET':questPreviewKind==='rivet-overridden-story'?'NEWBOT':'NEWBOT + T.O.T'");
 one("questPreviewKind==='breach-waves-story'?'THREE SCRAP WAVES':'SCRAP A + SCRAP B'",
     "questPreviewKind==='breach-waves-story'?'THREE SCRAP WAVES':questPreviewKind==='rivet-overridden-story'?'RIVET':'SCRAP A + SCRAP B'");
 one("questPreviewKind==='breach-waves-story'?'THREE ALLIES':'TWO ALLIES'",
     "questPreviewKind==='breach-waves-story'?'THREE ALLIES':questPreviewKind==='rivet-overridden-story'?'ONE SURVIVOR':'TWO ALLIES'");
 one("questPreviewKind==='breach-waves-story'?'WAVES A / B / C':'TWO HOSTILES'",
     "questPreviewKind==='breach-waves-story'?'WAVES A / B / C':questPreviewKind==='rivet-overridden-story'?'OVERRIDE · NONLETHAL':'TWO HOSTILES'");
 one("questPreviewKind==='breach-waves-story'?'BREACH // DEFEND':'FIRST WAKE // 2v2'",
     "questPreviewKind==='breach-waves-story'?'BREACH // DEFEND':questPreviewKind==='rivet-overridden-story'?'RIVET // NONLETHAL':'FIRST WAKE // 2v2'");
 return result;
}
