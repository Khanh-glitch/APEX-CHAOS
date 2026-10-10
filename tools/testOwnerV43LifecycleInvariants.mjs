// Owner V43 lifecycle regression: cross-file authority checks.
// Complements native Chrome battle tests; not a substitute for actual gameplay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rd=(p)=>fs.readFileSync(p,'utf8');
const w=rd('public/game/arsenal/arsenalWeaponRuntime.js');
const cfg=rd('public/game/arsenal/arsenalConfig.js');
const p=rd('public/game/arsenal/arsenalPresentationRuntime.js');
const auditPresentation=p;
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
assert.match(w,/v43MakeFlightPath\(x\.x,x\.y,a,ctx\.enemy\)/,'boomerang path depends on real opponent position at release');
assert.doesNotMatch(w,/p\.owner\.x-p\.x|p\.owner\.y-p\.y/,'boomerang may not home to moving owner');
assert.doesNotMatch(w,/p\.age\+=dt;p\.life-=dt/,'the engine alone ages projectile life');
assert.match(w,/if\(p\.life>0\)p\.life=Math\.max\(0,p\.life-dt\)/,
  'every non-held V4.3 projectile must share exactly one bounded lifetime');
assert.match(w,/if\(p\.__hr\?\.cryHold\)\{window\.APEX_CRYSTAL\?\.holdStep/,
  'Crystal held projectile must pause V4.3 lifetime during refract');
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
assert.ok(w.includes('function v43GoldFlamethrowerParticles('),'V43 Gold flamethrower needs its 470 particles/s plume, not ten static tongues');
assert.ok(auditPresentation.includes('function drawV43GoldPlasmaCharge('),'V43 Gold plasma charge must be visible before release');
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
assert.match(w,/flightSeconds=x\.flightPath\.total\/c\.speed/,'boomerang duration must vary by real flight distance');
assert.match(w,/const flightSeconds=p\.flightSeconds\|\|c\.flightSeconds/,'boomerang must tick per-throw duration');
const spawn=rd('public/game/arsenal/arsenalSpawnRuntime.js');
assert.match(spawn,/ownerBotForcedWeapon/,'owner BOT test must use true spawn authority');
assert.match(cfg,/Ctrl\+Shift\+F8/,'hidden owner keyboard chord exists');
assert.match(cfg,/selectedWeaponId=id/,'owner numeric selection resolves to catalog weapon');
assert.match(w,/burnRecipients=new Set\(\)/,'flamethrower burn once per contact source');
assert.match(w,/p\.kind==='plasma'&&p\.homing/,'only released split plasma shards chase');
assert.match(w,/kind==='smoke'/,'RPG smoke must have native world VFX');

// Round 3: the V4.3 flight pass must honor Crystal's *real* swept K/J
// contact surface before Fighter damage, without introducing a second
// projectile integrator or allowing reflected homing/spline takeover.
const cry=rd('public/game/hero-rework/crystalGameplayRuntime.js');
assert.match(cry,/p\?\.type==='aq_v43'/,'Crystal recognizes mobile V4.3 threats');
assert.match(cry,/hr\.crystalReflected = true/,'Crystal reflect preserves one-reflect provenance');
assert.match(w,/crystal\.resolveBullet\(p,bodyT,dt\)/,'Boomerang return path must traverse Crystal contact');
assert.match(w,/APEX_CRYSTAL\.resolveBullet\(p,bodyT,dt\)/,'Other V4.3 mobile projectiles must traverse Crystal contact');
assert.match(w,/p\.kind==='boomerang'&&!v43Redirected\(p\)/,'Reflected boomerang cannot override its new trajectory with the old return path');
assert.match(w,/p\.kind==='plasma'&&p\.homing&&!v43Redirected\(p\)/,"Reflected plasma shards cannot home toward the original owner's foe");
assert.match(w,/if\(outcome\?\.consumed\)/,'Crystal contact must supersede a stale body hit');
// R3: shared interaction policies, preserving reflected damage to descendants,
// and distinct Gold motion are release-blocking source contracts.
for(const [id,kind] of [['FLARE_GUN','flare'],['TACTICAL_CROSSBOW','bolt'],
  ['STEEL_BALL_LAUNCHER','ball'],['COMBAT_BOOMERANG','boomerang'],
  ['RPG_7','rocket'],['SHRAPNEL_MINE_LAUNCHER','mine']]){
  const start=cfg.indexOf(id+':Object.freeze(');
  assert.ok(start>=0,'missing special '+id);
  const record=cfg.slice(start,start+550);
  assert.ok(record.includes("reflectableKinds:['"+kind+"']"),
    'registry reflection capability missing: '+id);
}
assert.match(cfg,/reflectableKinds:\['plasma-core','plasma'\]/,
  'plasma core and released shards share one reflected-particle law');
assert.match(cfg,/reflectableKinds:\[\],magnetizableKinds:\[\],muzzleDx:-1/,'flame cone must not masquerade as a moving bullet');
assert.match(cry,/eligible\.includes\(p\.kind\)/,'Crystal K must query authoritative registry capabilities');
assert.match(rd('public/game/hero-rework/magnetGameplayRuntime.js'),/special\.magnetizableKinds\.includes\(p\.kind\)/,'Magnet must use shared kinetic registry');
assert.match(w,/v43DamageScale\(p,c\.coreDamage\)/,'plasma child damage must inherit the parent reflection scalar');
assert.match(w,/child\.aqReflected=!!p\.aqReflected/,'shards must inherit Swirl reflection provenance');
assert.match(w,/v43GoldBoomerangAirflow\(ctx,p,life\)/,'boomerang must render the Gold wingtip vortices');
assert.match(w,/ctx\.shadowBlur=26-i\*5/,'plasma core must have four-layer Gold bloom');
assert.match(p,/chargeClipMargin/,'plasma charged core must reserve full glow overhang');
console.log('PASS owner V43 source integration invariants: 8 weapon entries + native holder/pose/projectile/Frost/result gates');
