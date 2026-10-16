# D6 — Native Stream Contacts (design contract, not shipped)

Baseline main 2590beee, owner clarification 2026-10-13. The following is a reusable AttackCarrier law, NOT an ad-hoc Flamethrower- or Crystala-specific list of weapon IDs.

## Authoritative concepts

An AttackCarrier describes how an attack exists in the world: independent flying Projectile, continuous Stream, Beam, melee contact, Field or Area Effect. The JavaScript object type aq_v43 does NOT determine this semantic type. Flamethrower uses a real muzzle-relative damaging cone and 5 real damage ticks; its Gold particles do not own damage.

Every emitted damaging Stream sample has an immutable emission identity, tick index, timestamp, source pose, actual damaging volume, original weapon, provenance and current damage controller. A contact witness contains the first physically reached LIVE construct surface along a segment, its normal, impacted facet and contact ordering. A native Stream can be clipped and reflected only along its actually intercepted portion, keeping other angular portions in the original direction with the original controller.

## Unified Crystala A1 structural adjudication — OWNER LOCKED

Wall and Hexa Wall use ONE reflect-unless-breaking rule. Compare authorized damage of each real hit/tick against the HP of the precise contacted Wall or Hexa facet BEFORE reflection.

If hit damage is lower than remaining HP: reflect the original attack (projectile or intersecting portion of the actual Stream), then subtract structure HP.

If hit damage equals/exceeds remaining HP: destroy that surface and allow the very same ORIGINAL damaging hit/tick to proceed through the new opening, unreflected, with its complete damage, source, direction and provenance. No residual arithmetic. Subsequent genuinely reached facets/surfaces remain independently governed by time-ordered collision. T6 manipulation immunity is separate; K/A2 shard and Gold choreography are unchanged.

Example: five Flamethrower damage ticks of 18 each, all striking one full Wall HP 80 or one Hexa facet HP 75: both reflect 4 ticks and let the 5th breaking tick through. This is NOT one event per render particle or frame.

## Production integration responsibilities

1. Publish the actual Stream geometry and tick identity from the real Arsenal executor BEFORE target damage; preserve current muzzle aiming, range, cone, firing and burn cadence.
2. Resolve earliest active geometry contact on a shared authority (current Crystala material runs/capsules are the existing input), never from VFX paths.
3. Adjudicate contacted surface HP through one common A1 structural rule (Wall vs Hexa only geometry, placement, HP and facet arrays).
4. For nonbreaking impact, redirect the intercepted portion of the SAME damaging Stream using contact normal; preserve source provenance while changing controlling damage credit to Crystala and apply approved passive exactly once.
5. For breaking impact, route the SAME original hit unchanged. Enforce no extra multiplied damage and no second critical roll. Deduplicate each attack tick / angular slice / target receipt.
6. Pass final damage, knockback and valid BURN through canonical Arsenal damage once; presentation subscribes to outcomes and does not create collision/damage truth.
7. Support more than two factions and Quest targets via generic allegiance/targetability, not Free Battle P1/P2 assumptions.

## Acceptance / limits

Test all normal and energy independent projectiles, true Stream cone intersections, phase-specific Wall/Hexa solidity, exact-HP breaking hits, 30/60/120Hz, status effects and BURN, T6, multi-surface ordering, ownership and damage receipts. Do not infer that the projectile-focused PR #37 implements native continuous Stream interception: it does NOT.

A future wide Stream tick could touch multiple distinct live Hexa facets along disjoint angular portions. Partition only by REAL damaging geometry. Never charge HP per visual particle. Keep genuine simultaneous angular overlap unresolved with a trace until a tested executor defines the ordering and prevents duplicate damage.

Status: ready as D6 implementation contract and test matrix, **no live Stream gameplay modifications**.
