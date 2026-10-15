// BOXE — native product admission: actually starts and exits Arsenal matches.
// Uses the canonical bootHarness and APEX_ARSENAL simulation, not a
// sidecar model. HUD art is intentionally pending owner supply.
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
assert.equal(H.loadErrors.length, 0, JSON.stringify(H.loadErrors));
assert.ok(win.APEX_ARSENAL && win.APEX_BOXE_BATTLE && H.HR);
H.HR.setAiEnabled?.(false);

function enter(p1, p2) {
  const match=T.start(p1,p2);
  assert.ok(match?.combatants?.length===2, 'real Arsenal match did not launch');
  T.holdSpawns();
  return match;
}

let match=enter('BOXE','ROBOT');
let [ct,enemy]=match.combatants;
assert.equal(ct.heroId,'BOXE');
assert.equal(enemy.heroId,'ROBOT');
const skill=H.HR.abilityController(ct);
const originalHp=enemy.anchor.hp;
assert.equal(skill.tryCast('A1',{source:'boxe-native-integration'}).ok,true);
assert.equal(skill.tryCast('A2',{source:'boxe-native-integration'}).ok,false,
  'A2 must be blocked while rocket exists');
assert.ok(ct.store.__boxeBattle?.rocket, 'BOXE rocket not engine-owned');
assert.equal(ct.skills.A1.cdLeft,0,'A1 cooldown waits for return');
const recall=skill.tryCast('A1',{source:'manual-early-recall'});
assert.equal(recall.ok,true);
assert.equal(recall.recast,true);
assert.equal(ct.store.__boxeBattle?.rocket.phase,'returning');
assert.equal(enemy.anchor.hp,originalHp, 'zero-damage cast changed opponent HP');
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null,'exit did not teardown live match');
assert.equal(ct.store.__boxeBattle?.rocket,null,'rocket survived match teardown');

match=enter('ROBOT','BOXE');
assert.equal(match.combatants[1].heroId,'BOXE','P2 BOXE missing');
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null);
match=enter('BOXE','BOXE');
assert.ok(match.combatants.every(c=>c.heroId==='BOXE'),'same-hero Local battle absent');
assert.equal(H.HR.abilityController(match.combatants[0]).tryCast('A2',{source:'local'}).ok,true);
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null);
console.log('PASS BOXE native Arsenal BOT, P2, same-hero Local, no-skill-damage, A1/A2 exclusion, cleanup');
// jsdom hosts legacy frame/timer observers. Assertions above run to completion;
// explicitly close the harness so this proof exits instead of timing out in
// CP4 spawnSync(180000), which would otherwise report status=null after PASS.
H.dom.window.close();
process.exit(0);
