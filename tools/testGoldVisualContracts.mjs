// CP11 fail-closed Gold family admission. No combat or cosmetic drawing is
// simulated here; real Chrome and Gold motion tests remain separate gates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cosmetics} from '../src/game/cosmetics/cosmeticAuthority.js';
globalThis.Path2D ??= class Path2DStub {constructor(){}};
await import('../src/game/cosmetics/approvedGoldSkins.js');

const robot=fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js','utf8');
const eco=fs.readFileSync('src/game/cosmetics/ecoNewbotV17WorldGold.js','utf8');
const gun=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const av=fs.readFileSync('public/game/arsenal/arsenalPresentationRuntime.js','utf8');
const chrome=fs.readFileSync('tools/testOwnerGoldSkinsChrome.mjs','utf8');
const contracts=[
 {kind:'hero',baseId:'ROBOT',skinId:'ecobot',
  passes:['actor','worldBack','worldFront','targetLock','targetMeasure'],
  families:['actor-pose','target-lock','target-measure','a1-launch','a1-contact','a1-fail',
   'a2-on','a2-off','passive','hit','wall','fire']},
 {kind:'weapon',baseId:'RPG_7',skinId:'vua-he',
  passes:['weapon','projectile','blast'],
  families:['held-launcher','rocket-flight-smoke','rocket-native-detonation']}
];
for(const law of contracts){
 const rec=cosmetics.variants(law.kind,law.baseId).find(x=>x.id===law.skinId);
 assert.ok(rec,'approved Gold pack absent: '+law.skinId);
 assert.equal(rec.fidelity,'owner-gold');
 const contract=rec.visualContract;
 assert.ok(Object.isFrozen(contract)&&Object.isFrozen(contract.families),
  'Gold inventory is not immutable');
 assert.deepEqual([...contract.requiredPasses].sort(),[...law.passes].sort(),
  'Gold visual pass silently lost or added: '+law.skinId);
 assert.deepEqual(contract.families.map(x=>x.name).sort(),[...law.families].sort(),
  'Gold owner family silently lost or added: '+law.skinId);
 for(const fam of contract.families){
  assert.ok(fam.passes.every(x=>typeof rec.render[x]==='function'),
    'Family points at non-existent visual hook: '+fam.name);
  assert.ok(fam.proof.startsWith('tools/')&&fs.existsSync(fam.proof),
    'Family has no executable proof file: '+fam.name);
  if(fam.nativeSource.startsWith('ecoFx:')){
    const id=fam.nativeSource.slice(6);
    assert.ok(robot.includes("ecoFx(st,'"+id+"'"),
      'Native Robot event producer missing: '+fam.name);
    assert.ok(eco.includes("ev.kind==='"+id+"'"),
      'Gold presentation event consumer missing: '+fam.name);
    assert.ok(chrome.includes("'"+id+"'"),
      'Isolated Gold Chrome paint proof missing event family: '+fam.name);
  }
 }
}
assert.match(robot,/render\?\.\('actor'/);
for(const hook of ['targetLock','targetMeasure','worldBack','worldFront'])
 assert.ok(robot.includes("'"+hook+"'"),
  'Native Robot compositor does not consume required Gold pass '+hook);
for(const marker of ["type === 'RobotA1Lock'","drawEcoGoldTargetLock","drawEcoGoldTargetMeasure"])
 assert.ok((robot+eco).includes(marker),'Native targeting Gold hook disconnected '+marker);
assert.ok(gun.includes("'projectile'"),'real Arsenal projectile cosmetic dispatch missing');
assert.ok(av.includes('suppressDefaultBlast'),'real Arsenal native blast dispatch missing');
assert.ok(chrome.includes('familyInk'),'Gold Chrome coverage must include family pixels');
const canary={kind:'hero',baseId:'CP11_GOLD_CANARY',id:'bad',fidelity:'owner-gold',
 render:{actor:()=>true}};
assert.throws(()=>cosmetics.register(canary),/requires version 1/);
const goodContract={version:1,ownerReference:'fixture-owned-source',
 requiredPasses:['actor','worldBack'],
 families:[{name:'living-a1',nativeSource:'RobotA1Lock',passes:['actor','worldBack'],proof:'tools/testGoldVisualContracts.mjs'}]};
assert.throws(()=>cosmetics.register({...canary,visualContract:goodContract}),/missing renderer: worldBack/);
assert.throws(()=>cosmetics.register({...canary,render:{actor:()=>true,worldBack:()=>true},
 visualContract:{...goodContract,families:[...goodContract.families,goodContract.families[0]]}}),
 /duplicate Gold visual family/);
assert.throws(()=>cosmetics.register({...canary,render:{actor:()=>true,worldBack:()=>true,worldFront:()=>true},
 visualContract:goodContract}),/not declared/);
assert.equal(cosmetics.variants('hero','CP11_GOLD_CANARY').length,1,
 'Rejected Gold inventory must never mutate the cosmetic registry');
console.log('CP11 GOLD VISUAL CONTRACT PASS: 2 approved packs, 8 render passes, 15 reviewed families, producer+consumer+Chrome proof, fail-closed negatives');
