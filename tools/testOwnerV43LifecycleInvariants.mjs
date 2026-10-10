// Owner V43 lifecycle regression: cross-file authority checks.
// Complements native Chrome battle tests; not a substitute for actual gameplay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rd=(p)=>fs.readFileSync(p,'utf8');
const w=rd('public/game/arsenal/arsenalWeaponRuntime.js');
const cfg=rd('public/game/arsenal/arsenalConfig.js');
const p=rd('public/game/arsenal/arsenalPresentationRuntime.js');
const f=rd('public/game/hero-rework/frostPresentationRuntime.js');
const hr=rd('public/game/hero-rework/heroReworkRuntime.js');
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
assert.match(hr,/baseUpdateArsenalProjectiles\(dt, 'v43-only'\)/,
  'REAL Core Six projectile override must delegate eight V4.3 weapons exactly once');
assert.match(w,/dispatch === 'v43-only' && p\.type !== 'aq_v43'/,
  'native V4.3 dispatch may not double-step conventional Hero Rework bullets');
assert.match(p,/function weaponMuzzleWorld\(fighter, holder, aimAngle\)/,
  'V4.3 emission must share actual Gold held sprite center, angle and scaled pose');
assert.match(w,/weaponMuzzleWorld\?\.\(f,h,angle\)/,
  'firing muzzle must use authored V4.3 sprite calibration, not radius estimate');
for(const part of ['v43GoldTongue','v43GoldRibbon','v43GoldProjectile','v43GoldImpact'])
  assert.ok(w.includes('function '+part+'('),'original Gold V4.3 visual layer missing: '+part);
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
