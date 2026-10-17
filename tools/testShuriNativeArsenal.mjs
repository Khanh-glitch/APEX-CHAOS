// SHURI admission uses the live APEX_ARSENAL match and real bootHarness.
// No independent combat simulation, gold demo or substitute weapon rules.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';
const H=await bootHarness(),{win,T}=H;
assert.equal(H.loadErrors.length,0,JSON.stringify(H.loadErrors));
assert.ok(win.APEX_ARSENAL&&win.APEX_SHURI_BATTLE&&H.HR);
H.HR.setAiEnabled?.(false);
function enter(p1,p2){
 const match=T.start(p1,p2);
 assert.ok(match?.combatants?.length===2,'native match admission failed');
 T.holdSpawns();
 return match;
}
let match=enter('SHURI','ROBOT');
assert.deepEqual(match.combatants.map(c=>c.heroId),['SHURI','ROBOT']);
const [shuri,robot]=match.combatants;
const enemyHp=robot.anchor.hp;
const a1=H.HR.abilityController(shuri).tryCast('A1',{source:'shuri-native-admission'});
assert.equal(a1.ok,true,'SHURI A1 cannot activate in native Arsenal');
assert.equal(robot.anchor.hp,enemyHp,'SHURI cast unexpectedly changes enemy HP without realized contact');
assert.ok(shuri.store.__shuri,'SHURI must retain canonical combatant state');
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null,'SHURI must teardown after exit');
match=enter('ROBOT','SHURI');
assert.equal(match.combatants[1].heroId,'SHURI','SHURI P2 not admitted');
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null);
match=enter('SHURI','SHURI');
assert.ok(match.combatants.every(c=>c.heroId==='SHURI'),'SHURI vs SHURI broken');
win.exitArsenalBattleMode();
assert.equal(H.HR.match,null);
console.log('PASS SHURI P1/P2/Local native Arsenal match admission, A1 and teardown');
H.dom.window.close();
process.exit(0);
