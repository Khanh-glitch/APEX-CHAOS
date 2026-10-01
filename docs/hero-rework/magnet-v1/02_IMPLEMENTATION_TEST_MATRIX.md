# MAGNET V1 — IMPLEMENTATION TEST MATRIX

Automated gates are necessary evidence, never owner visual acceptance.
Every final claim must be rerun on the exact final SHA.

## M00 — source / preload
- M00.1 baseline `5411906...` is in implementation ancestry.
- M00.2 canonical Gold exists at the locked path.
- M00.3 Gold SHA/bytes match exactly.
- M00.4 preload changes only Magnet docs/Gold + preflight tool.
- M00.5 Mirror production files are unchanged by preload.
- M00.6 no production Magnet edit before preflight passes.

## M01 — A1 state and timing
- cast succeeds with no eligible floor gun and consumes cooldown.
- cooldown = 11 s.
- field active exactly 1.00 s.
- A2 rejected only while A1 gameplay field active.
- visual recovery cannot prolong gameplay exclusion.
- late reveal inside the 1.00 s window becomes affected.
- late reveal after field end is unaffected by that cast.

## M02 — A1 all-floor-firearm physics
- 3+ eligible revealed floor firearms receive force in the same tick.
- no range limit for eligible floor firearms.
- T6 floor weapon unaffected.
- acceleration increases with distance and clamps to locked band.
- speed cap = 900.
- moving Magnet center curves trajectories continuously.
- off-axis path curves; heading never snaps to center.
- force end preserves velocity.
- post-field drag follows the locked lightweight coast law.
- no teleport / no direct equip.

## M03 — A1 hostile firearm bullets
- 479 px: eligible bullet bends.
- 481 px: bullet does not receive A1 force.
- force follows `14000*u^2`.
- cap <= launch * 1.10.
- same projectile identity.
- controller/owner/provenance/damage/crit/Frost/Rubber/etc. tags unchanged.
- field end preserves new trajectory.

## M04 — floor firearm world integration
- each real slot has at most one Magnet physical state.
- two simultaneous Magnets sum forces then integrate slot exactly once.
- one Magnet A1 + other Magnet A2 composes vector forces without double movement step.
- teardown/rematch clears physical/contact state.
- no duplicate pickup slots are created.
- slot remains visible to spawn-cap/emergency law exactly as the real slot.

## M05 — collision/pickup
- wall radius 16.
- wall restitution 0.45.
- tangential retention near 0.82.
- field can bend path again after bounce.
- eligible unarmed-body overlap resolves pickup, not bounce.
- armed-body overlap does not pickup.
- armed-body contact deflects once; no overlap jitter/repeated impulse.
- loose gun causes no body damage/knockback/disarm.
- opponent can intercept.
- chain: pickup -> consume -> later overlapping gun can be picked normally.

## M06 — A2
- cooldown 13 s.
- duration exactly 1.80 s.
- radius 225.
- object entering during window is affected.
- object leaving radius stops new force.
- body max accel 2200*u^2 / cap target 650.
- floor firearm max accel 3000*u^2 / cap 950.
- hostile bullet max accel 18000*u^2 / cap launch*1.10.
- held gun not separately manipulated.
- no damage/stun/teleport/disarm/controller rewrite.
- momentum persists after field.

## M07 — passive
- Magnet firearm bullet launch velocity exactly x1.18 once.
- shotgun/autoshot variation preserved then x1.18.
- no repeat multiplication per frame.
- damage/crit/spread/shot count/fire rate/ammo/life unchanged.
- thrown melee unaffected.
- grenade unaffected.
- T6/Stormbreaker unaffected.
- no artificial range property mutation.

## M08 — T6
- floor Stormbreaker unaffected by A1/A2.
- Stormbreaker flight unaffected.
- passive does not boost it.
- fighter holding T6 is still A2 body-pushable.

## M09 — cross-hero regression
Required matchups / directed gates:
- ROBOT moving pickup target remains same live slot.
- CRYSTAL reflected projectile preserves tags/controller transaction and Magnet only changes velocity.
- BLACK_HOLE store removes projectile from field manipulation; release restores eligibility later.
- MATH graph/gate behavior unchanged under curved approach.
- FROST Frozen slot keeps frozen/pickup metadata while physically moved.
- FROST projectile payload survives bend.
- RUBBER stored/released projectile semantics preserved.
- HUNTER trap not triggered by loose gun; Hunter disarm semantics unchanged.
- TIME replay firearm projectile can be bent; world state not rewound by Magnet.
- SLIME every living body receives A2 separately.
- SNIPER self-movement lock is not external-force immunity.
- MAGNET vs MAGNET no double integration.

## M10 — Mirror co-load
Mirror gameplay must be byte/semantic unchanged unless a true shared-hook necessity is proven.
Directed gates:
- Mirror A1 copy of Magnet-held firearm is a fresh normal copy; no Magnet passive inheritance.
- Mirror A2 swap during active Magnet field relocates field center to Magnet's new position on subsequent ticks.
- Mirror neutral portal projectile keeps neutral/provenance flags under Magnet bending.
- Magnet physical gun chain works in a Magnet-vs-Mirror match.
- existing Mirror cooldown/whiff/copy/passive portal behavior remains unchanged.

## M11 — Gold presentation
- exact Reference-A identity, no fallback redraw.
- six-part rig retained.
- fixed 1/120 presentation stepping under normal and hitch frames.
- no raw-hitch spring explosion.
- movement/start/stop/hard-turn/wall articulation remains Gold-like.
- A1 current-routing order visible.
- A1 filament is bowed/partial, not generic straight beam.
- bullet-only A1 still has readable Gold response.
- late-reveal acknowledgement appears.
- A2 stays sparse/angular, never a filled shield.
- object pressure cues correspond to real affected objects.
- passive presentation follows real fire event with no gameplay shot delay.

## M12 — render isolation / lifecycle
- Magnet draw pass leaves canvas/global renderer state unchanged after return.
- no opponent scale flicker.
- no camera mutation.
- no duplicate actor/double render.
- rematch/re-entry clean.
- teardown clears timers/state/listeners.
- immutable source decode/material derivation does not repeat per frame/match unnecessarily.
- no unbounded arrays/trails.
- steady-state allocations/perf measured.

## M13 — evidence
- focused deterministic Magnet suite.
- existing Robot/Hunter/Crystala/Frost focused suites.
- Hero Rework goldens.
- Arsenal headless.
- real-browser Arsenal suite.
- production build.
- real-browser Magnet evidence at actual battle scale:
  idle/move, A1 no-gun, A1 multi-gun, late reveal, bullet bend/risk, chain/intercept, A2 body+gun+bullet, wall bounce, passive firearm, T6, Magnet-vs-Magnet, Magnet-vs-Mirror, rematch.
- owner playtest required for final visual/feel acceptance.

Do not bless a stale historical failure without reproducing it on the exact starting/final SHA.
Do not alter a test merely to make new code green.
