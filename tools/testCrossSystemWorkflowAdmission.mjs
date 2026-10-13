// Cross-system CI admission contract — no shipping source edits.
// Every shared weapon/hero interaction change MUST fan out to the owner
// World Weapon, Crystala and Native Stream proof suites. Product Acceptance
// is a broad smoke, not a replacement for those specialist gates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const world = '.github/workflows/d5-world-weapon-role.yml';
const crystal = '.github/workflows/d5-crystala-a1-shared-break.yml';
const stream = '.github/workflows/d6-native-stream-characterization.yml';
const product = '.github/workflows/arsenal-product-acceptance.yml';
const content = '.github/workflows/content-interaction-cp2.yml';
const paths = (name) => {
  const text=fs.readFileSync(name,'utf8');
  const m=text.match(/^  pull_request:\s*\n    paths:\s*\n((?:      - [^\n]+\n)+)/m);
  assert.ok(m,name+' must keep explicit PR path admission list');
  const list=m[1].split('\n').filter(Boolean).map(line=>{
    const matched=line.match(/^      - ['"]([^'"]+)['"](?:\s+#.*)?$/);
    assert.ok(matched,name+' malformed PR path: '+line);
    return matched[1];
  });
  assert.equal(list.length,new Set(list).size,name+' duplicate trigger entries');
  return new Set(list);
};
const RULES = {
  [world]: [
    'public/game/arsenal/arsenalConfig.js',
    'public/game/arsenal/arsenalIdentityRuntime.js',
    'public/game/arsenal/arsenalWeaponRuntime.js',
    'public/game/arsenal/arsenalSpawnRuntime.js',
    'public/game/hero-rework/ailRuntime.js',
    'public/game/hero-rework/heroRegistry.js',
    'public/game/hero-rework/heroReworkRuntime.js',
    'public/game/hero-rework/magnetGameplayRuntime.js',
    'public/game/hero-rework/frostGameplayRuntime.js',
    'tools/testFrostV1Gates.mjs',
    'tools/testV43KineticHeroInteractions.mjs'
  ],
  [crystal]: [
    'public/game/arsenal/arsenalConfig.js',
    'public/game/arsenal/arsenalIdentityRuntime.js',
    'public/game/arsenal/arsenalWeaponRuntime.js',
    'public/game/hero-rework/ailRuntime.js',
    'public/game/hero-rework/heroRegistry.js',
    'public/game/hero-rework/heroReworkRuntime.js',
    'public/game/hero-rework/crystalGameplayRuntime.js',
    'tools/testCrystalaGameplayGates.mjs',
    'tools/testOwnerCrystalaA1SharedBreak.mjs'
  ],
  [stream]: [
    'public/game/arsenal/arsenalConfig.js',
    'public/game/arsenal/arsenalIdentityRuntime.js',
    'public/game/arsenal/arsenalSpawnRuntime.js',
    'public/game/arsenal/arsenalWeaponRuntime.js',
    'public/game/hero-rework/ailRuntime.js',
    'public/game/hero-rework/heroRegistry.js',
    'public/game/hero-rework/heroReworkRuntime.js',
    'public/game/hero-rework/crystalGameplayRuntime.js',
    'tools/testV43PostUpdateContracts.mjs',
    'tools/testOwnerD6StreamLiveGap.mjs'
  ]
};
// New files must be admitted automatically. Checking only explicit existing
// paths would give false confidence when a future weapon/hero owns a brand-new
// module and the specialist workflow simply never starts.
const EXTENSION_GLOBS = [
  'public/game/arsenal/**',
  'public/game/hero-rework/**',
  'public/game/product/**',
  'public/game/gold/**',
  'src/game/**',
];
for(const file of [world,crystal,stream]){
  const declared=paths(file);
  for(const pattern of EXTENSION_GLOBS){
    assert.ok(declared.has(pattern),file+' does not auto-test NEW source '+pattern);
  }
  assert.ok(declared.has('tools/testExtensionCapacityGates.mjs'),
    file+' must re-run on shared extension stress changes');
  console.log('CROSS SYSTEM EXTENSION ADMISSION '+file+': all '+EXTENSION_GLOBS.length+' future-module families protected');
}
const owner=fs.readFileSync(world,'utf8');
assert.match(owner,/node tools\\/testExtensionCapacityGates\\.mjs/,
  'D5 must actually execute the future-content stress gate, not merely watch it');
const genericProduct=fs.readFileSync(product,'utf8');
assert.match(genericProduct,/node tools\\/testExtensionCapacityGates\\.mjs/,
  'Product Acceptance must run the future-content stress gate on every PR');

let assertions=0;
for (const [workflow,needed] of Object.entries(RULES)){
  const declared=paths(workflow);
  for (const path of needed){
    assert.ok(declared.has(path),workflow+' must rerun when '+path+' changes');
    assertions++;
  }
  console.log('CROSS SYSTEM TRIGGER '+workflow+': '+needed.length+'/'+needed.length+' protected');
}
const app=fs.readFileSync(product,'utf8');
assert.match(app,/^  pull_request:\s*$/m,'full Product Acceptance must remain unfiltered on PRs');
assert.doesNotMatch(app,/^  pull_request:\s*\n    paths:/m,
  'full Product Acceptance cannot use narrower path list');
assert.match(app,/node tools\/testCrossSystemWorkflowAdmission\.mjs/,
  'full Product Acceptance must enforce this gate');
assert.match(fs.readFileSync(content,'utf8'),/^      - 'public\/game\/arsenal\/\*\*'$/m,
  'Content Interaction must receive all future Arsenal runtime changes');
assert.match(fs.readFileSync(content,'utf8'),/^      - 'public\/game\/hero-rework\/\*\*'$/m,
  'Content Interaction must receive all future Hero runtime changes');
console.log('CROSS SYSTEM CI ADMISSION PASS '+assertions+' owner trigger edges + universal product/content coverage');
