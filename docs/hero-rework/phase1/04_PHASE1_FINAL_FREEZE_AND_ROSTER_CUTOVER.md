# APEX CHAOS — HERO REWORK PHASE 1 FINAL FREEZE + ROSTER CUTOVER
Status: IMPLEMENTATION-READY SYSTEM HANDOFF

## Phase 1 scope

Phase 1 freezes:
- gameplay concept,
- system architecture,
- Level-1 mechanics,
- progression structure,
- Hero Definition Contract,
- roster cutover strategy.

It deliberately does NOT wait for:
- final Hero body visual direction,
- final silhouettes,
- final VFX art direction,
- final animations,
- final icons/cards,
- final audio identity,
- final Hero assets.

Those belong to a separate parallel presentation/art phase.

Temporary implementation presentation may be neutral/debug-readable only and is never owner visual acceptance.

## Phase 1 final tracker

- P1.0 Documentation Recovery: DONE
- P1.1 AIL v2: DONE
- P1.2 12-Hero Level 1: DONE
- P1.3 independent A1/A2/Passive Lv1-Lv5 + one-knob law: DONE
- P1.4 progression architecture: DONE; exact Lv2-Lv5 live balance deferred to real-engine balance
- P1.5 Hero Definition Contract: DONE / owner-approved
- visual direction/assets: MOVED OUT OF PHASE 1
- P1.7 final audit/cutover plan: DONE

Phase 1 gameplay/system design is CLOSED.

## Progression knob map

Exact Lv2-Lv5 values are not frozen here. What may scale is frozen.

| Hero | A1 knob | A2 knob | Passive knob |
|---|---|---|---|
| ROBOT | cooldown | damage reduction | milestone refund step |
| CRYSTAL | wall HP | prison-wall HP | reflected-damage % |
| MAGNET | pull acceleration | repulsion strength | projectile/thrown velocity bonus |
| BLACK_HOLE | object capacity | stored-damage cap | growth efficiency |
| MATH_V2 | cooldown | cooldown | N for xN / /N |
| ICE | cooldown | cooldown | Deep-Freeze continuous-Chill threshold |
| RUBBER | max speed bonus | projectile capacity | Afterbounce push impulse |
| HUNTER | trap cooldown | Weak amplification | dodge chance |
| TIME | Loop cooldown | Rewind cooldown | far-history marker horizon |
| MIRROR | copy cooldown | Exchange cooldown | shard lifetime |
| SLIME | Mitosis cooldown | Damage-Shedding cooldown | HP-loss split threshold |
| SNIPER | Lost-Target duration | spread multiplier | distance-crit step |

Hard invariant: skill level resolution modifies only the approved knob field.

## Git preparation audit

At task preparation, authorized branch:
`arena/01a0e086-apex-chaos`

Tip:
`8ca566b378c48cfb6b81ec17711a7c8e6e16d139`
(evidence-only)

Latest gameplay/runtime code beneath it:
`2a93825f3208c0ed27c866abcbb25720858fd671`

Safety rollback branch:
`safety/pre-hero-rework-implementation-20260927`

Always fetch again before implementation.

## Current roster reality

### Arsenal shell path
`public/game/arsenal/arsenalShellSelectRuntime.js` currently exposes legacy 32 shells plus NEWBIE = 33 shells.

### Classic select
`public/game/ui/apexCharacterSelectUi.js` currently hardcodes:
SHOTGUN, KATANA, ENGINEER, GALAXY, ICE, NINJA, SOCCER, STRING, FANG.

Only ICE belongs to the canonical new 12.

### Quest loading
`src/game/runtimeManifest.js` currently has Arsenal Quest loading `BATTLE_CORE_RUNTIMES`, which includes legacy `ROSTER_RUNTIMES`.

This means Quest still loads many old fighter runtimes/patches even though the target product roster will be 12.

## Critical migration finding

Target roster:
ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER.

The current engine already has legacy identities/behaviors for the 11 non-ROBOT names.
ROBOT is the canonical replacement for NEWBIE.

Therefore implementation is primarily a **behavior replacement / authority cutover**, not merely adding missing names.

The key risk is legacy native behavior double-running with the new rework.

## Do not rewrite legacy FighterTypes in place first

Unsafe pattern:
legacy CRYSTAL mutation + shell delegation + new registry/AIl mechanic = hidden double execution.

Required pattern:

```text
legacy FighterTypes = compatibility/history/quarantine
new Hero Registry = canonical product authority
typed mechanic executors + AIL = reworked behavior
```

On the rework path, the 11 legacy target Hero native `init/update/onCollide/onTakeDamage` behaviors must not also run unless a specifically audited neutral helper is intentionally reused.

## Roster lifecycle states

### ACTIVE_PRODUCT
Only the canonical 12.

### LEGACY_QUARANTINED
Old Hero code may remain for rollback, historical tests or legacy/dev routes, but is:
- not user-selectable in new Quest,
- not in production random pools,
- not in progression/unlock choices,
- not in new product AI roster,
- not loaded by new Quest once dependency audit proves it unnecessary.

### DELETED
Only after:
- no production reference,
- no save/migration dependency,
- no retained legacy mode dependency,
- reference/test audit passes.

Quarantine before deletion.

## ROBOT migration

`NEWBIE -> ROBOT`

At cutover:
- UI/product ID = ROBOT
- registry = ROBOT
- mechanic IDs = `robot.*`
- old NEWBIE save/ID accepted through migration
- old special `makeNewbieType()` loses product authority
- old NEWBIE manual-gate special becomes legacy-only

Never expose both.

## Non-target old roster

If Hero ID is not one of the canonical 12, it is not ACTIVE_PRODUCT.

Current non-target surfaces include identities such as:
BLADE, CARD, DRUM, ELECTRIC, ENGINEER, FANG, FLASH, GALAXY, KATANA, MATH, MONK/KUNGFU, NINJA, NOVA, ORBIT, PAINTER, PIRATE, SAW, SHOTGUN, SOCCER, STRING, SUPERSTAR, TOXIC, VAMPIRE, VIRUS, VOLCANO, WIND/PUPPET, WITCH, WOLF and extension-era MUSICIAN/MASTER_CHEF/MASK/ARCADE.

Do not convert this paragraph into a blind delete list. Run a live reference graph first.

## Legacy code surfaces requiring caution

- `public/game/arsenal/arsenalShellSelectRuntime.js`
- `public/game/arsenal/arsenalManualSkillGate.js`
- `public/game/core/apexFullRosterQa.js`
- `public/game/core/apexRosterExtensions.js`
- `public/game/core/apexCanonicalBalance.js`
- `public/game/core/apexPrecisionFixes.js`
- `public/game/ui/apexCharacterSelectUi.js`
- `src/game/runtimeManifest.js`
- `public/apexEngine.js`

Several chain-wrap functions or contain shared fixes/load-order effects. Filename alone is not evidence a runtime is safe to delete.

## Safe cutover sequence

1. Preflight Git/dependency audit and baseline tests.
2. Add AIL + Hero Registry + AbilityController without changing product roster yet.
3. Implement target-12 Level-1 mechanics behind rework/dev path; legacy target kits disabled there.
4. Harden cross-Hero interactions/invariants.
5. Switch production Arsenal Quest roster from legacy 33 to canonical 12.
6. Audit and remove legacy roster-runtime dependencies from Quest where actually safe.
7. Switch production selection source to canonical registry 12; debug picker may remain visually temporary.
8. Quarantine all non-target Heroes from production pools.
9. Physically delete old Hero code/assets only after reference graph + tests + owner gameplay acceptance.

## Performance opportunity

Once Quest no longer depends on legacy roster runtimes, it may avoid evaluating many old champion/visual/guard patch layers.

Measure before/after:
- menu responsiveness,
- Quest readiness,
- long tasks,
- script/evaluation/request work.

This is a dependency cleanup opportunity, not permission to reduce combat VFX quality.

## Final audit

No material Level-1 Hero mechanic remains undocumented.
No unresolved system architecture blocks implementation.
Visual direction remains deliberately unresolved but non-blocking.
Final balance remains deliberately unproven.
Roster migration ambiguity is resolved by new-registry authority + staged quarantine/cutover.

Implementation may begin.
