// Owner V43 lifecycle regression: cross-file authority checks.
// Complements native Chrome battle tests; not a substitute for actual gameplay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rd=(p)=>fs.readFileSync(p,'utf8');
const w=rd('public/game/arsenal/arsenalWeaponRuntime.js');
const cfg=rd('public/game/arsenal/arsenalConfig.js');
const p=rd('public/game/arsenal/arsenalPresentationRuntime.js');
const f=rd('public/game/hero-rework/frostPresentationRuntime.js');
const result=rd('public/game/results/matchResultAuthority.js');
const weapon=rd('result-gold/src/components/Weapon.tsx');
const css=rd('result-gold/src/styles/components.css');
const eight=['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER','COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER'];
for (const id of eight){
  assert.match(cfg,new RegExp(id+':Object\\.freeze'),'missing special '+id);
  assert.match(w,new RegExp(id+': \\{'),'missing native recoil/pose for '+id);
}
assert.match(w,/h\.shotsFired\+=1/,'holder shot counter must track special shots');
assert.match(w,/h\.phase='FOLLOW_THROUGH'/,'special shot must complete native holder');
assert.match(w,/h\.phase='IN_FLIGHT'/,'physical Boomerang must own holder');
assert.match(w,/v43MakeFlightPath\(x\.x,x\.y,a\)/,'boomerang depends on launch geometry');
assert.doesNotMatch(w,/p\.owner\.x-p\.x|p\.owner\.y-p\.y/,'boomerang may not home to moving owner');
assert.doesNotMatch(w,/p\.age\+=dt;p\.life-=dt/,'the engine alone ages projectile life');
assert.match(w,/noseFrom/,'long bolt/rocket must use tip collision');
assert.match(w,/kind==='plasma-core'\?c\.coreSpeed/,'plasma core has independent speed');
assert.match(cfg,/projectileWidth:78/,'mine artwork must be legible independently of collision size');
assert.match(p,/holder\.weaponId === 'COMBAT_BOOMERANG' && holder\.phase === 'IN_FLIGHT'/,'no fake duplicate boomerang');
assert.match(f,/function drawQueuedA1Floor\(ctx,S\)/,'delayed A1 must receive gameplay-authoritative immediate visual feedback');
assert.match(f,/drawQueuedA1Floor\(ctx,S\)/,'the pending A1 feedback must actually render');
assert.match(f,/pumpCastQueue\(S, now, insp\)/,'Gold A1 deferred authored choreography must remain owned by the original queue');
assert.match(result,/APEX_COMBAT_HUD\?\.projection/,'Result must use Battle HUD color authority');
assert.match(result,/cfg\.TIER_COLORS\?\.\[tier\]/,'Result must use actual weapon tier palette');
assert.match(weapon,/weapon__rarity/,'Weapon Gold must visibly show tier');
assert.match(css,/--weapon-tier-rgb/,'Weapon Gold must illuminate by rarity');
console.log('PASS owner V43 source integration invariants: 8 weapon entries + native holder/pose/projectile/Frost/result gates');
