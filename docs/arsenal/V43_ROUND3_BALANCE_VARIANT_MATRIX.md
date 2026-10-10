# APEX CHAOS V4.3 — Round 3 variant capability and balance contract
Date: 2026-10-10 · PR #24 · Draft only · no production merge

## One source of truth
`CFG.V43_WEAPONS[id]` records remain the unique owner of each special's tier, damage, attack timing and all hero interaction capabilities. An `aq_v43` is not a second damage engine. Every confirmed Fighter hit still goes through `aqDamage → Fighter.takeDamage`.

`reflectableKinds` is consumed by Crystal K (and native Swirl Shield); `magnetizableKinds` is consumed by Magnet A2. A non-moving flame or status DOT is not reflectable. Armed mines are not treated as flying projectiles, but their airborne metal body can interact with shields and magnets; fragments remain magnetizable but not Crystal-reflectable. Each projectile retains physical identity through ownership changes.

| Weapon | Tier | Crystal | Magnet | Main balance / motion role |
|---|---|---|---|---|
| Flare Gun | T2 | flare | none | direct 63 + four burn ticks of 14 =119; delayed status counterplay |
| Tactical Crossbow | T2 | bolt | bolt | 112; fast precise shot and brief slow |
| Steel Ball Launcher | T2 | ball | ball | 98 straight, 109.76 bank; strong directional physical push |
| Combat Boomerang | T2 | body | body | 63 outgoing + 63 return, second hit can miss; curved dual-vortex Gold trail |
| RPG-7 | T3 | rocket | rocket | 161 peak explosion, distance falloff and billowing smoke |
| Flamethrower | T3 | none | none | 90 direct across 5 contact pulses + 65 nonstacked burn =155; requires range |
| Plasma Splitter | T4 | core and shards | none | 76 core-contact damage after buff; or 3×67=201 split route, slower bounded turn |
| Shrapnel Mine Launcher | T4 | flying mine only | flying mine and fragments | centre 140 + up to two×31.5 secondary; delayed floor arming/contact |

## Round 3 tuning decision
Plasma directly striking a Fighter before the split used to waste the entire charged shot for just **42** damage while a clean split could deliver 201. This is a severe 21% return for a .5-second telegraphed T4 charge. Round 3 increases core direct damage to **76** (38% of full 201 split), while reducing shard homing angular rate from **6.2 rad/s to 4.5 rad/s** so dodging still matters. The goal is to improve early-contact fairness without making an all-shards-hit case stronger. The values require actual moving-target and hero-interaction tests; they are *candidate tuning*, not an owner-approved balance patch.

## Ordered projectile travel
A V4.3 mobile projectile consumes Magnet's single integrated A2 flight plan if present. Its `__hr.pathVia/pathPoly` then drives both Crystal's K/J swept surface resolver and native swept Fighter contact; no straight-line chord across a curved path. Crystal's one-reflect provenance is carried into plasma descendants. An intercepted or Magnet-deflected boomerang follows its new physical vector and does not teleport along the original return spline. On permanent deflection the original held copy is retired without a fake return animation.

## Gold visual fidelity contract
- Gold Lab's boomerang: two wing-tip vortices, curved air wake and orbiting air hooks anchored to the actual path history.
- Plasma: four concentric luminous passes with per-layer bloom, four charge rings, thirteen motes, compressing core, charged tail, three-way split and bounded charge footprint. World-edge-safe VFX and physical launch share a single adjusted source.
- Mine: Gold armed eight spokes, status LED and pressure arcs; no forced timeout explosion.
- Existing flame emission and smoke must retain 470 deterministic particles/s and time-stable world origin, not bounce back to ten decorative static tongues.
- Animation/brightness comparison requires real browser screenshots and moving clips across desktop/mobile and Gold Lab. Passing source checks, still images, or HP checks alone DOES NOT certify 100% Gold equivalence.

## Release blockers
CI real browser + native gameplay, weapon-to-weapon BOT distribution, Crystal K/J, Swirl, Magnet and Quest regressions must pass. A separate Cloudflare Direct Upload preview must then be visually accepted by owner. Do not mark PR ready for review, merge or update production without explicit approval.
