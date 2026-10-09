import fs from 'node:fs';
import assert from 'node:assert/strict';
const spawn=fs.readFileSync(new URL('../public/game/arsenal/arsenalSpawnRuntime.js',import.meta.url),'utf8');
const battle=fs.readFileSync(new URL('../public/game/modes/arsenalBattleRuntime.js',import.meta.url),'utf8');
const receipt=fs.readFileSync(new URL('../public/game/quest/questReflexReceipts.js',import.meta.url),'utf8');
let n=0;
const gate=(name,ok)=>{assert.ok(ok,name);console.log('PASS B2 '+name);n++;};
const candidates=spawn.slice(spawn.indexOf('const questDirected=slot.questPickupOwner'),
  spawn.indexOf('const stageOwner=questDirected'));
const collector=spawn.slice(spawn.indexOf("for (const f of actors) { // HERO REWORK doc-06 body-aware actors",spawn.indexOf('function resolvePickups')),
  spawn.indexOf('// FROST V1',spawn.indexOf('function resolvePickups')));
const stages=battle.slice(battle.indexOf('if(state.questReflex && state.questReflexGate)'),
 battle.indexOf('// Fixed spawn cadence',battle.indexOf('if(state.questReflex && state.questReflexGate)')));
const distribution=battle.slice(battle.indexOf('// E01 no longer gates weapon supply'),
  battle.indexOf('SPAWN.trySpawnSlot();',battle.indexOf('// E01 no longer gates weapon supply'))+21);
gate('E01 telegraph does not privilege named owner',!candidates.includes("state.questReflex===true"));
gate('E01 physical pickup never rejects other fighter by ownership',!collector.includes("state.questReflex===true"));
gate('Stage changes never erase true physical unclaimed weapons',!stages.includes("slot.phase='REMOVED'"));
gate('E01 supply is independent of either opponent HP',!distribution.includes('hp>500')&&!distribution.includes('hp<250'));
gate('Only E01 opts into 2.25s faster authored spawn',battle.includes('state.questReflex===true?2.25:CFG.SPAWN_CADENCE_SECONDS'));
gate('E01 truly grounded technical result no longer requires artificial 250HP floor',
 !receipt.includes('n.hp<250')&&!receipt.includes('t.hp<250'));
gate('normal and other Quest directed holds intact',collector.includes('state.questScrapSwarmProgression===true')
 &&collector.includes('state.questBreakerChargeProgression===true'));
console.log('B2 transparent tutorial '+n+' PASS / 0 FAIL');
