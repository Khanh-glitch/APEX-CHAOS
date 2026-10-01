# MIRROR — SAME-RELEASE COLOAD LOCK

Purpose: Magnet and Mirror may be uploaded/qualified in the same release batch, but Mirror gameplay is NOT part of this rework.

Baseline authority:
`5411906a741f87d637ee20535c82e96b866d4ab2`

## Frozen current Mirror semantics

### A1 MIRROR ARSENAL
- cooldown 15 s;
- copy lifetime 6 s;
- copies eligible opponent-held weapon as a fresh instance with fresh ammo;
- opponent keeps original;
- ineligible/unarmed/T6/shield cast may whiff but the attempted Active consumes normal cooldown;
- T6 copy false;
- SWIRL_SHIELD / TOWER_SHIELD excluded.

Do not make a copied firearm inherit MAGNET's passive. Magnet x1.18 belongs to the firing hero, not weapon identity.

### A2 MIRROR EXCHANGE
- cooldown 12 s;
- telegraph 0.25 s;
- atomic position swap only;
- each fighter keeps own velocity, HP, weapon and statuses.

Do not redesign this mechanic while implementing Magnet.

### PASSIVE SHATTERED MIRRORS
Frozen baseline values:
- damagePerShard 35;
- minEventDamage 20;
- maxShardsPerEvent 5;
- shardLifetime 6;
- 5 shards form mirror;
- form radius 130;
- mirror lifetime 10;
- max mirrors 3;
- exit controller NEUTRAL;
- damage unchanged;
- no hero credit;
- provenance retained;
- T6 immune;
- zero-progress-only loop suppression.

## Magnet integration expectations
- active Magnet field follows Magnet's authoritative post-swap position on subsequent ticks;
- neutral Mirror-routed firearm bullet can be physically bent if it is currently eligible/hostile to Magnet, but neutral/provenance metadata remains untouched;
- Mirror A1 copied firearm is a normal weapon copy; Magnet passive is not copied;
- floor-gun physics/pickup chain must work in a Magnet-vs-Mirror match.

## Change policy
Do not edit Mirror registry/executors/portal semantics for convenience.
If a shared Magnet hook touches a surface used by Mirror, prove Mirror before/after equivalence with a directed gate.
Any actual Mirror semantic change requires new owner authority and is outside this task.
