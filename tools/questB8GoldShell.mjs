/* B8 Quest E08 canonical generated Gold route.
 * Strict post-B7 source anchors. No donor/viewport/HUD modifications.
 */
export function adaptTotGoldShellB8(html){
 let out=html;
 function one(a,b){
  const n=out.split(a).length-1;
  if(n!==1)throw Error('B8 Gold E08 source drift '+n+': '+a.slice(0,64));
  out=out.replace(a,b);
 }
 one('onRivetStory:launchQuestRivetStory});',
     'onRivetStory:launchQuestRivetStory,onTotStory:launchQuestTotStory});');
 one('  window.__apexGoldQuestRivetStoryEntry=launchQuestRivetStory;',
     '  window.__apexGoldQuestRivetStoryEntry=launchQuestRivetStory;\n'+
     "  function launchQuestTotStory(){\n"+
     "    if(screen!=='home'||window.APEX_SCENE_TRANSITION?.active?.())return false;\n"+
     "    if(window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId!=='TOT_LAST_CHOICE')return false;\n"+
     "    questPreview=true;questPreviewKind='tot-last-choice-story';\n"+
     "    battleMode='bot';p1Hero='newbot';p2Hero='newbot';\n"+
     "    void launchBattleHud();return true;\n"+
     "  }\n"+
     "  window.__apexGoldQuestTotStoryEntry=launchQuestTotStory;");
 one("questPreviewKind==='rivet-overridden-story'?'quest-rivet-story':'quest-first-wake'",
     "questPreviewKind==='rivet-overridden-story'?'quest-rivet-story':questPreviewKind==='tot-last-choice-story'?'quest-tot-story':'quest-first-wake'");
 one("questPreviewKind==='rivet-overridden-story'?'QUEST 01 // RIVET OVERRIDDEN':'QUEST 01 // FIRST WAKE PLAYTEST'",
     "questPreviewKind==='rivet-overridden-story'?'QUEST 01 // RIVET OVERRIDDEN':questPreviewKind==='tot-last-choice-story'?'QUEST 01 // T.O.T LAST CHOICE':'QUEST 01 // FIRST WAKE PLAYTEST'");
 one("questPreviewKind==='rivet-overridden-story'?'NEWBOT':'NEWBOT + T.O.T'",
     "questPreviewKind==='rivet-overridden-story'?'NEWBOT':questPreviewKind==='tot-last-choice-story'?'NEWBOT':'NEWBOT + T.O.T'");
 one("questPreviewKind==='rivet-overridden-story'?'RIVET':'SCRAP A + SCRAP B'",
     "questPreviewKind==='rivet-overridden-story'?'RIVET':questPreviewKind==='tot-last-choice-story'?'T.O.T':'SCRAP A + SCRAP B'");
 one("questPreviewKind==='rivet-overridden-story'?'ONE SURVIVOR':'TWO ALLIES'",
     "questPreviewKind==='rivet-overridden-story'?'ONE SURVIVOR':questPreviewKind==='tot-last-choice-story'?'ONE SURVIVOR':'TWO ALLIES'");
 one("questPreviewKind==='rivet-overridden-story'?'OVERRIDE · NONLETHAL':'TWO HOSTILES'",
     "questPreviewKind==='rivet-overridden-story'?'OVERRIDE · NONLETHAL':questPreviewKind==='tot-last-choice-story'?'LAST CHOICE · NONLETHAL':'TWO HOSTILES'");
 one("questPreviewKind==='rivet-overridden-story'?'RIVET // NONLETHAL':'FIRST WAKE // 2v2'",
     "questPreviewKind==='rivet-overridden-story'?'RIVET // NONLETHAL':questPreviewKind==='tot-last-choice-story'?'T.O.T // LAST CHOICE':'FIRST WAKE // 2v2'");
 return out;
}
