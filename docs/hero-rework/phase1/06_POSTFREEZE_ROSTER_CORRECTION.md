# APEX CHAOS — POST-FREEZE ROSTER CORRECTION
## 2026-09-27

Status: NEWER DESIGN AUTHORITY than the conflicting parts of Phase-1 roster cutover wording.
Purpose: correct one missed subsystem discovered during live implementation audit.

## Core correction

The canonical 12 are the **PLAYABLE HERO roster**, not the complete set of identities allowed to exist in Quest.

Do not collapse the current Quest ladder into only 12 identities.

## Roster classes

### ACTIVE_PLAYABLE_HERO
Exactly:
ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER.

These:
- use the Hero Rework registry/progression,
- may be selectable/unlockable,
- may appear in playable Hero pools.

### ACTIVE_QUEST_ENCOUNTER
Boss/encounter-only identities required by the current Quest ladder.

These:
- may remain in Quest,
- may retain audited legacy-compatible boss behavior during this campaign,
- must NOT leak into playable selection/progression/draw pools merely because Quest uses them.

Current ladder includes non-playable boss identities such as:
PAINTER, DRUM, CARD, BLADE, TOXIC, ORBIT, FLASH, ELECTRIC, VAMPIRE, SAW, WOLF, WITCH, MONK and others.

### LEGACY_QUARANTINED
Neither active playable Hero nor active Quest encounter/dependency.

### DELETED
Only after live reference/dependency proof.

## Bosses that are also canonical 12

If a Quest encounter identity is also one of the 12 (e.g. ICE, HUNTER, CRYSTAL, MAGNET, BLACK_HOLE, TIME):
- use the reworked Hero mechanic identity as the underlying Hero behavior,
- preserve audited Quest boss/encounter modifiers as a separate encounter layer,
- do not keep an unrelated old Hero kit only because the ladder references that name.

## Bosses outside the canonical 12

Preserve as boss-only compatibility path for this Hero-Rework campaign.
Do not spend Hero-Rework scope redesigning them.

## CP-HR6 / CP-HR7 correction

Production PLAYER roster becomes 12.

Quest ENCOUNTER roster may contain non-playable boss identities.

Shop/draw/free-pick/progression/random playable Hero pools expose only the canonical 12.

An active boss identity is not "retired" merely because it is not playable.

Do not remove a legacy runtime from Quest if an active boss still demonstrably needs it.

Audit toward:

```text
Quest core
+ Rework Hero runtimes
+ only required boss-compat runtimes
```

Add gates proving:
- every current Quest stage still resolves,
- boss-only IDs cannot leak into playable pools.

## SLIME architecture correction

Do not insert temporary SLIME child Bodies into the legacy global `fighters[]` merely to reuse Fighter behavior unless every global consumer is proven Body-safe.

The legacy array carries many implicit two-logical-fighter assumptions:
- enemy resolution,
- KO checks,
- HUD,
- collision,
- holder updates,
- emergency-gun logic,
- array order.

Prefer:
- stable logical Combatants,
- AIL Body collections,
- `getTargetableBodies(combatant)`,
- `getPickupActors(combatant)`,
- body-aware target/projectile/pickup queries.

Patch shared body queries rather than turning the old two-fighter array into a mixed Combatant+Body collection.

## Projectile resolver guardrail

A Rework-aware centralized projectile resolver is acceptable if needed.

If normal Arsenal projectiles are routed through replacement logic, require deterministic **no-transform parity tests** against current Arsenal projectile behavior.

With no Hero transform active, equivalent seeds/state should preserve:
- trajectory,
- hit time,
- hit target,
- realized damage,
- ricochet behavior,
- grenade semantics,
- thrown-melee semantics,

within explicit tolerance.

Hero Rework must not silently change ordinary gunplay.
