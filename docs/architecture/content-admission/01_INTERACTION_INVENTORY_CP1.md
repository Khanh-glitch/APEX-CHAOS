# APEX CHAOS — Content Interaction Audit (CP1 / frozen baseline)

> **Status:** evidence inventory / NOT a new gameplay law. Pinned source: `578098c73436e3263a34f5b83b6ceb8340b26258` (2026-10-11 main).
> **Scope:** gameplay relationships relevant to adding heroes and weapons; no Gold/Quest behavior changes authorized. CP2 baseline tests live under `tools/testContentInteractionBaseline.mjs`.

## 0. Vocabulary and authority

- **Weapon definition** = `public/game/arsenal/arsenalConfig.js`. `GUN_REGISTRY` has 24 conventional guns (six family executors). `V43_WEAPONS` has eight bespoke specials. The total `P0_WEAPON_IDS` includes 41 equipment IDs (including melee, shields, grenade, T6).
- **Hero definition** = `public/game/hero-rework/heroRegistry.js`; 12 canonical definitions/36 abilities are currently frozen. Public playability is a distinct product policy: six playable, six visible/locked (see `src/game/productSurface.js`).
- **Hero behavior** = `heroMechanicsRuntime.js` dispatches by `mechanicId` through `heroReworkRuntime.js`; specialty behavior also lives in `crystalGameplayRuntime.js`, `magnetGameplayRuntime.js` and `frostGameplayRuntime.js`.
- **Shared AIL capability** = `ailRuntime.js::CapabilityAuthority`, chiefly T6 immunity. This is NOT yet a complete projectile-family interaction policy.
- **Damage authority** = Arsenal `weaponApi.aqDamage` -> Fighter.takeDamage, wrapped by Hero Rework for per-combatant damage transforms and realized receipts. V4.3 calls `v43Deal` -> `aqDamage`; do not add independent HP subtraction.
- **Movement/hit ownership** = Hero Rework's `reworkUpdateProjectiles` handles `aq_bullet`, `aq_grenade`, `aq_thrown` when active. Arsenal then advances `aq_v43` via the base pass with `v43-only` dispatch. This is not a single universal contact adjudicator.
- **Proof classification**: `CODE` means directly observed in pinned source, `BASELINE` means preserved by the new CP2 gate, `REGRESSION` means an existing production harness exercises it, `OPEN` means owner/architecture decision required. Do not report code inspection as live runtime PASS.

## 1. Existing projectile and pickup families

| Family/state | Native authority | Typical payload | High-risk state changes |
| --- | --- | --- | --- |
| `aq_bullet` | Arsenal fireBullet; HR rework pass | owner, weapon, crit, family, damage, velocity, `__hr` tags | Magnet curve/path; Crystal reflection/hold; Mirror escrow; Frost proc; body impact |
| `aq_grenade` | Arsenal + HR rework pass | fuse, bounce, explosion | Mirror route while active; owner/provenance after transforms |
| `aq_thrown` flight | Arsenal + HR rework pass | melee identity, ricochet, grace, pinned state | T6 bypass; Mirror escrow only in flight; wall/construct earlier TOI |
| `aq_v43` mobile | Arsenal `v43Step` | special `kind`, phase, owner, damage, age | Crystal/Swirl reflect by kind; Magnet kinetic curve; per-kind effects |
| `aq_v43` stationary/status | Arsenal `v43Step` | mine arming/armed, burn timer, flame emitter | Must not masquerade as an ordinary reflectable/kinetic shot |
| Revealed floor slot | Arsenal spawn/pickup runtime | slot ID, weaponId, tier, phase | Magnet attraction vs Frost freezing use different admission rules |
| Equipped holder | Arsenal weapon runtime | weaponId, phase, ammo, active timer | Frost transfer gate; shields; Mirror weapon copy; loss/consumption |
| Extra hero bodies/constructs | Hero Rework/AIl | Combatant ownership, collision surfaces | SLIME single combatant/multi-body; Crystal wall; Mirror nodes; Magnet body force |

## 2. V4.3 special projectile capability snapshot (CODE; exact inputs for CP2)

The registry uses per-weapon `reflectableKinds` and `magnetizableKinds`. Eligibility is additionally conditioned on type, life, physical phase, team/owner, hold/reflected state and T6. **These arrays are not a promise that all reflectors implement identical geometry/effects.**

| Weapon ID | Main kind | Reflectable kinds | Magnetizable kinds | Important caveat |
| --- | --- | --- | --- | --- |
| FLARE_GUN | flare | flare | — | Burn ticks are not flare projectile contacts |
| TACTICAL_CROSSBOW | bolt | bolt | bolt | Acceleration, swept tip offset |
| STEEL_BALL_LAUNCHER | ball | ball | ball | Ricochet/splash |
| COMBAT_BOOMERANG | boomerang | boomerang | boomerang | Reflection breaks return spline and holder transaction |
| RPG_7 | rocket | rocket | rocket | Acceleration and blast ownership |
| FLAMETHROWER | flame | — | — | Flame/burn do not become physical reflectable bodies |
| PLASMA_SPLITTER | plasma-core / plasma | plasma-core, plasma | — | Core and shard have different damage stages |
| SHRAPNEL_MINE_LAUNCHER | mine / fragment | mine | mine, fragment | Only *flying* mine can be reflected/deflected as `mine`; armed mine cannot; fragment is magnetic but not reflectable |

Disabled concepts `CHAIN_WHIP`, `HARPOON_LAUNCHER`, `RAILGUN`, `TWIN_REAPER_SCYTHES` remain OUT by owner decision.

## 3. Consumer-by-consumer rules and seams (CODE)

| Consumer | Current query | Execution site | Implication for newly added content |
| --- | --- | --- | --- |
| Crystal K / construct | `aq_bullet` or V43 kind in `reflectableKinds`; exclude T6 / own / reflected / held | `crystalGameplayRuntime.js::notAThreat / resolveBullet` | Must register new special kind; state transitions may change eligibility |
| Magnet A1/A2 projectile | `aq_bullet` with `CFG.isGun` OR `aq_v43` kind in `magnetizableKinds`; exclude T6/hold | `magnetGameplayRuntime.js::isEligibleBullet` | Special physical projectile policy is distinct from conventional firearm |
| Swirl Shield | bullet or V43 `reflectableKinds`, with additional phase, hostility, previous-reflection and incoming-direction checks | `arsenalWeaponRuntime.js` shield update | Shield has a separate eligibility implementation |
| Mirror F2 surface | `aq_bullet`, `aq_grenade`, or detached `aq_thrown` in flight; NOT currently `aq_v43` | `heroReworkRuntime.js::mirrorF2Eligible` | A new special projectile does **not** automatically enter Mirror F2; OPEN whether desired |
| Frost floor / holder | `APEX_ARSENAL_WEAPONS[id].category === 'ranged'` except grenade/T6, not `CFG.isGun` | `frostGameplayRuntime.js::isFreezableFirearm` | Special ranged V4.3 items can be frozen; do not assume Magnet pickup policy |
| Magnet floor pickup | revealed slot, `CFG.isGun(weaponId)`, not T6 | `magnetGameplayRuntime.js::isEligibleFloorFirearm` | V4.3 special floor items are excluded by current `isGun` semantics |
| Magnet BOT opportunity | preflight for incoming projectile filters to `aq_bullet` / `isGun` | `heroMechanicsRuntime.js::magnetAiDecision` | AI may not decide to cast *because of* a V4.3 projectile even when gameplay can affect it; needs real test/decision |
| T6 global | `AIL.CapabilityAuthority` denies graph, gate, singularity, mirror, reflect, capture, dodge on T6 | `ailRuntime.js` plus consumers | Protect projectile/pickup from hero manipulation; its carrier body can still be displaced |
| Combat receipt | `aqDamage` -> `takeDamage`; realized HP difference and provenance after legal transforms | `arsenalWeaponRuntime.js`, `heroReworkRuntime.js` | No second damage authority, duplicate hit or forged credit |

## 4. Collision/event ordering hazards

The accepted physics is **ordered swept time-of-impact**, not source-code execution order:

1. Magnet may publish a non-straight multi-leg path; downstream consumers must read the actual traveled geometry.
2. Crystal construct/shard, Mirror nodes, walls and body hits compete for contact on the **same real path**. Earlier terminal or trajectory-changing contacts supersede later ones; a mere non-terminal pass-through does not.
3. Mirror escrow detaches the *same projectile object* temporarily; do not tick it in both worlds, leak it after rematch or create a replacement projectile.
4. Re-owning/reflection must preserve the proper launch/current owner provenance, crit, payload and credit rules; future damage/procs cannot use a stale pre-reflection trajectory or impact.
5. A new projectile must be advanced by **exactly one** production movement/lifetime owner each frame; adding a third pass without a certified routing policy is forbidden.
6. T6 is hero-manipulation immune, **not** universally invincible. Physical hit, holder body CC and prescribed wall shatter still occur.

Protected regressions already exist: `tools/testMirrorCoreSixInterop.mjs`, `tools/testFrostV1Gates.mjs`, `tools/testMagnetV1GameplayGates.mjs`, `tools/testHeroReworkGoldens.mjs`, `tools/testArsenalBattleHeadless.mjs`. CP2 does not replace them.

## 5. Issues classified for CP3, not changed in CP1–CP2

| Finding | Severity | Evidence | CP3 decision |
| --- | --- | --- | --- |
| Separate Crystal/Magnet/Swirl projectile predicates | High | Multiple consumers read the two V43 kind arrays independently | Introduce read-only authoritative policy/query; shadow compare before swapping |
| Two projectile passes, separate `aq_v43` branch | High | HR rework pass then Arsenal `v43-only` | Preserve present routing; design common event/TOI contract before consolidation |
| Mirror F2 excludes all V43 specials | Medium / OPEN | `mirrorF2Eligible` explicit type list | Do NOT silently enable V43; define per-phase rules and prove real geometry/escrow |
| Magnet AI opportunity vs gameplay eligibility | Medium / OPEN | AI `aq_bullet` filter vs gameplay `isEligibleBullet` | Real BOT intent/reaction test; preserve cast law until approved |
| Frost freeze predicate vs Magnet floor predicate differ | Medium / OPEN | Ranged-category vs conventional `isGun` | Record current intent; NEVER homogenize without owner approval |
| Hero registry / smoke test exact 12/36 counts | Scale blocker | `validateRegistry` and smoke/goldens fixtures | Preserve legacy Core 12 baseline, later move to baseline-subset + extension validation |
| Core Six presentation delivery exact 35 assets | Scale blocker | `testCoreSixArtDeliveryGate.mjs` | Continue asserting Core Six exactly, add per-hero extensible delivery tests separately |
| V43 addition affects Quest tier pool | Product risk | `arsenalConfig.js` T1/T2 pool comments/`BY_TIER` | Explicit release-scope approval before modifying any tier/pool |
| Special owners/shapes in damage/AI/FX | Medium | Per-kind `v43Step` and `aqDamage` adapters | Admission contract should distinguish impact/direct/splash/status, never invent expected behavior |

## 6. Add-content protocol until CP3 exists

- **NO new gameplay content on this branch.** CP1–CP2 only freeze facts and tests.
- New hero/weapon PR must declare ID, skill/attack executor, projectile kinds + phases, pickup/equip category, per-interaction policy, T6/Quest rules, damage source/credit, animation/SFX, AI, teardown and its regression scenario.
- If a capability or collision ordering is not yet modeled, record `UNRESOLVED` and ask for approval; never patch other hero runtimes solely to make the new content pass.
- Never weaken existing regression gates or unlock the six non-playable heroes by changing a roster count assertion.
- CP3 acceptance prerequisite: shadow-comparison proves the common policy returns **identical** answers to the current specialized consumers for all existing variants, including invalid/held/reflected/phased projectiles.

## CP5/Main audit correction — V43 floor holders are not ballistic bullets

At the original CP1 baseline, `CFG.isGun()` was used to exclude all V43 *floor* holders from Magnet. This proved unintended for the owner's real ranged V43 guns: `isGun` classifies conventional firearm *projectile families*, not the weapon slots eligible for Magnet A1/A2. The accepted corrected policy is: revealed non-heal non-T6 conventional gun **or registered V43 special with ranged holder category**. All eight current V43 ranged holders qualify; their **projectiles retain independent kinetic/energy capability tags** (flame/plasma emission remains nonmagnetic). The corrected policy has its own actual floor-motion test and updates the CP2 and CP3 shadow baselines. This change must not convert their projectile type to `aq_bullet` or bypass V43 physics.
