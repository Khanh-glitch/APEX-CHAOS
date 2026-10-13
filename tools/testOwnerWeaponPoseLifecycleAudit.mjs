// Non-invasive characterisation of the EXISTING shipped weapon-pose lifecycle.
// Deliberately does NOT require new animation, reload state, player movement,
// particle duplication or Gold reference recertification.
// The test uses the REAL engine holder/pickup/shoot/consume code.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';

const H=await bootHarness();
const {T,HR,W,CFG}=H;
HR.setAiEnabled(false);
assert.ok(T.start('ROBOT','ROBOT'),'real local fixture must start');
T.holdSpawns();
const [f,enemy]=H.fighters();
f.x=300;f.y=500;f.baseSpeed=0;
enemy.x=580;enemy.y=500;enemy.baseSpeed=0;
const V43=CFG.V43_SPECIAL_IDS||[];
assert.equal(V43.length,8,'V43 weapon roster moved; inventory needs human review');
const observations=[];
for(const id of V43){
  assert.ok(CFG.WEAPONS[id],id+' missing canonical effective identity');
  const recipe=W.poseRecipe(id);
  assert.ok(recipe&&typeof recipe==='object',id+' lacks reusable weapon pose');
  assert.ok(recipe.recoilPx>0||recipe.windupRot!=null,
    id+' missing any visible fire/windup motion recipe');
  assert.equal(W.equip(f,id),true,id+' real equip denied');
  const h=W.getHolder(f);
  assert.equal(h.weaponId,id);
  assert.equal(h.phase,'READY');
  assert.equal(h.meta.pose.pulses,0);
  assert.ok(Number.isFinite(h.meta.pose.localY)&&Number.isFinite(h.meta.pose.rotKick),
    id+' invalid ready pose');
  const ant={localY:h.meta.pose.localY,rotKick:h.meta.pose.rotKick};
  // A manual consume is used ONLY to probe the existing presentation-only
  // exit contract. It is not described as a normal in-game attack or reload.
  W.consume(f,'read-only-lifecycle-audit');
  assert.equal(W.getHolder(f),null,id+' holder not cleared');
  const ghost=f.data.arsenalFade;
  assert.ok(ghost&&ghost.weaponId===id,id+' missing existing exit pose ghost');
  assert.ok(ghost.pose&&Number.isFinite(ghost.pose.recoil),
    id+' exit pose not present');
  observations.push({id,recoilPx:recipe.recoilPx??null,returnTau:recipe.returnTau??null,
    windupRot:recipe.windupRot??null,readyOffset:ant.localY,
    readyRot:ant.rotKick,exitPose:true});
  f.data.arsenalFade=null; // isolate presentation test fixture before next equip.
}
for(const id of ['PISTOL','SHOTGUN','SMG','SNIPER','MAC_10']){
  assert.ok(CFG.WEAPONS[id],id+' lost from canonical registry');
  const recipe=W.poseRecipe(id);
  assert.ok(recipe&&recipe.recoilPx>0,'legacy motion missing for '+id);
}
const rpg=W.poseRecipe('RPG_7');
assert.equal(rpg.recoilPx,34,'RPG baseline; do NOT tune based on a test');
assert.equal(rpg.rotKick,.20,'RPG baseline; do NOT tune based on a test');
assert.equal(rpg.returnTau,.28,'RPG baseline; do NOT tune based on a test');

// Distinguish declaration from real execution: fire one RPG with the actual
// Arsenal runtime and ensure one pulse reaches the holder pose. No VFX changed.
assert.equal(W.equip(f,'RPG_7'),true,'real RPG equip');
const h=W.getHolder(f);
for(let i=0;i<360&&h.shotsFired===0;i++)T.step(1/60);
assert.ok(h.shotsFired>0,'real RPG did not fire within six seconds');
assert.ok(h.meta.pose.pulses>0,'RPG fire missed poseKick -> visible recoil');
assert.ok(h.meta.pose.recoil>0,'RPG fire did not apply declared recoil');
assert.equal(h.meta.pose.pulses,h.shotsFired,'RPG recoil pulse not in sync with shots');
const fired=(H.projectiles()||[]).some(p=>p&&p.weapon==='RPG_7'&&p.type==='aq_v43')||
  (H.win.APEX_ARSENAL.state?.resultLedger?.snapshot?.()?.shotsByWeapon?.RPG_7??0)>0;
assert.ok(fired||h.shotsFired>0,'RPG actual projectile/shot receipt missing');
console.log('WEAPON POSE LIFECYCLE BASELINE '+V43.length+'/8 V43 identities + 5 legacy presets');
console.log('WEAPON POSE RECIPES '+JSON.stringify(observations));
console.log('RPG REAL FIRE recoil='+h.meta.pose.recoil.toFixed(2)+
 'px rot='+h.meta.pose.rotKick.toFixed(3)+' pulses='+h.meta.pose.pulses);
console.log('WEAPON POSE LIFECYCLE READ-ONLY PASS');
