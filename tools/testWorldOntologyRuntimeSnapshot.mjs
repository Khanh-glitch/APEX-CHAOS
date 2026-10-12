// D2-D4 ontology-versus-reality admission audit. Read-only; NO game mutation.
// Uses the actual shipped runtime via the existing CP2 boot harness.
// Reports approved owner-law DELTAS without rewriting legacy behavior/tests.
import assert from 'node:assert/strict';
import {bootHarness} from './lib/crystalaHarness.mjs';
import {BASE_WEAPON_IDS,BASE_V43_IDS} from './lib/contentBaseline.mjs';
const {win,loadErrors} = await bootHarness();
const C=win.APEX_ARSENAL_CONFIG, M=win.APEX_MAGNET, F=win.APEX_FROST;
const items=Array.from(C?.P0_WEAPON_IDS||[]);
assert.ok(items.length>=BASE_WEAPON_IDS.length,'missing original equipment');
assert.equal(new Set(items).size,items.length,'duplicate equipment IDs');
for(const id of BASE_WEAPON_IDS) assert.ok(items.includes(id),'missing original '+id);
assert.ok(Array.isArray(C.SHIELD_IDS) && typeof C.isGun==='function');
assert.ok(typeof M?.isEligibleFloorFirearm==='function');
assert.ok(typeof F?.isFreezableFirearm==='function');
assert.deepEqual(loadErrors.filter(e=>/arsenal|hero-rework/.test(e.file)),[]);
const shields=new Set(C.SHIELD_IDS);
const rows=items.map(id=>{
  const role=shields.has(id)?'defense':'weapon'; // THIS IS derived, not an invented second registry.
  const tier=C.tierOf?.(id)||null;
  const special=C.V43_WEAPONS?.[id]||null;
  const t6=tier==='T6'||id==='STORMBREAKER';
  const slot={weaponId:id,kind:'WEAPON',phase:'REVEALED',tier};
  const ownerRobotMagnetGoal=role==='weapon'&&!t6;
  return Object.freeze({
    id,role,tier,t6,
    emitter:special?.kind||(C.isGun(id)?'regular-bullet':null),
    specialKinds:special?Object.freeze({
      reflect:[...(special.reflectableKinds||[])],
      magnetic:[...(special.magnetizableKinds||[])],
    }):null,
    magnetA1Desired:ownerRobotMagnetGoal,
    magnetA1Runtime:!!M.isEligibleFloorFirearm(slot),
    frostRuntime:!!F.isFreezableFirearm(slot),
  });
});
const missing=rows.filter(x=>x.magnetA1Desired&&!x.magnetA1Runtime).map(x=>x.id);
const illegal=rows.filter(x=>x.magnetA1Runtime&&!x.magnetA1Desired).map(x=>x.id);
assert.equal(illegal.length,0,'live Magnet incorrectly admits Defense/T6 in sampled slot');
const newV43=BASE_V43_IDS.map(id=>rows.find(x=>x.id===id));
assert.ok(newV43.every(Boolean),'V43 not in canonical equipment pool');
assert.ok(newV43.every(x=>x.role==='weapon'),'V43 must still be Weapon role');
// Initial arsenalConfig defines DIFFERENT variants, but final ArsenalIdentity
// reassigns Z15 family/cadence/stats. Assert effective gameplay, not source order.
const ids=['ZBROYAR_Z15','ZBROYAR_Z15_S1','ZBROYAR_Z15_S2','ZBROYAR_Z15_S3'];
const keys=['family','shots','interval','damagePerShot','spread','knockback',
            'bulletSpeed','bulletLife','bulletRadius'];
const get=id=>Object.fromEntries(keys.map(k=>[k,C.WEAPONS[id]?.[k]]));
for(const id of ids.slice(1)) assert.deepEqual(get(id),get(ids[0]),
  'Z15 effective ballistic identity drift: '+id);
// Flame is one stream delivery inside aq_v43 plumbing, not an independent
// flying projectile just because it uses the aq_v43 JS type.
assert.equal(C.V43_WEAPONS.FLAMETHROWER.kind,'flame');
assert.deepEqual([...C.V43_WEAPONS.FLAMETHROWER.magnetizableKinds],[]);
console.log('WORLD ONTOLOGY RUNTIME READ-ONLY SNAPSHOT:',JSON.stringify({
  equipment:rows.length,weapon:rows.filter(x=>x.role==='weapon').length,
  defense:rows.filter(x=>x.role==='defense').length,
  v43:newV43.length,
  magnetA1OwnerLawMissing:missing,
  magnetA1UnexpectedAllowed:illegal,
  z15:'effective-ballistics-same',
  flame:'native-damage-stream-not-projectile-eligible-by-type',
},null,2));
console.log('WORLD ONTOLOGY RUNTIME SNAPSHOT PASS (audit only; owner deltas not shipped)');
