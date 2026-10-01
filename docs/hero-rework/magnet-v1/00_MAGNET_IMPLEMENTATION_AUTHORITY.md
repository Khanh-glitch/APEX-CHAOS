# MAGNET V1 — IMPLEMENTATION AUTHORITY

Status: OWNER-LOCKED Level-1 implementation contract prepared 2026-10-01.

## 0. Identity
MAGNET is the VECTOR CONTROL hero.

Core law:
**MAGNET controls real object trajectories through short-lived moving force fields.**
A1 = ATTRACT.
A2 = REPEL.
No teleport-to-target, no fake remote pickup, no scripted retarget, no ownership rewrite merely because Magnet applied force.

## 1. A1 — MAGNETIC ATTRACTION
Cooldown: **11.0 s**.
Gameplay force window: **exactly 1.00 s**.

A1 is a state, not a one-point cast transaction.
At cast acceptance Magnet enters ATTRACT immediately, even if there is currently no eligible floor firearm.
Every gameplay tick during the 1.00 s field:
- the force center is Magnet's current authoritative body/core position;
- every eligible revealed floor firearm is queried live;
- a firearm revealed after cast begins becomes affected for the remaining field time;
- all eligible firearms are affected simultaneously;
- no floor-firearm range limit;
- T6 / Stormbreaker is excluded;
- hostile eligible firearm bullets within **480 px** are physically bent toward Magnet.

Floor-firearm law:
- real persistent velocity state;
- acceleration recomputed each tick from firearm -> current Magnet center;
- distance-scaled acceleration **1400 -> 2400 px/s^2**, with stronger force at long distance;
- normalize distance using a 700 px tuning span; saturate beyond it;
- total floor-firearm speed cap **900 px/s**;
- no heading snap;
- no guaranteed arrival;
- no remote pickup/equip.

At t = 1.00 s the ATTRACT force becomes zero immediately.
Existing velocity is preserved.
Post-field floor drag target: `v *= exp(-1.8 * dt)`.
This is momentum/coast, not an authored delivery curve.

A1 hostile firearm bullet:
- only if the projectile is currently hostile to / capable of damaging Magnet under current controller/neutral semantics;
- radius **480 px**;
- `u = clamp(1 - d/480, 0, 1)`;
- acceleration magnitude **14000 * u^2 px/s^2** toward Magnet;
- speed cap **authored launch speed * 1.10**;
- same projectile, same owner/controller/provenance/damage/crit/payload;
- field end preserves the new trajectory.

Risk is intentional: A1 can pull enemy bullets toward Magnet.

## 2. A2 — MAGNETIC REPULSION
Cooldown: **13.0 s**.
Gameplay active duration: **exactly 1.80 s**.
Radius: **225 px**.

A2 is a moving radial state centered on Magnet's current authoritative body/core position.
An eligible object entering during the active window begins receiving force immediately.
Leaving radius stops new force immediately.
Existing momentum remains.

Shared falloff:
`u = clamp(1 - d/225, 0, 1)`
`accel = maxAccel * u^2`

Targets:
### Opponent living Bodies
- max acceleration **2200 px/s^2**
- outward radial speed cap target **650 px/s**
- external physical force only
- no damage, stun, teleport or disarm.

### Revealed floor firearms
- max acceleration **3000 px/s^2**
- total speed cap **950 px/s**
- no ownership change.

### Hostile firearm bullets
- max acceleration **18000 px/s^2**
- speed cap **authored launch speed * 1.10**
- trajectory bends outward; no delete/absorb/reflect/controller change.

Held firearm:
- receives no separate weapon force;
- follows its holder normally;
- no ejection/disarm/strip.
A fighter holding T6 may still be pushed as a fighter Body.

## 3. Passive — MAGNETIC ACCELERATION
Only a firearm bullet fired by MAGNET receives:
`launchVelocity = authoredLaunchVelocity * 1.18`

Exactly once at projectile emission.

Do not modify:
- damage;
- crit;
- spread/accuracy;
- shot count;
- fire interval/rate;
- ammo;
- bullet life;
- recoil;
- ownership;
- payload.

Thrown melee, grenade, Stormbreaker/T6 and non-firearm skill objects are not boosted.
Shotgun/autoshot pellets keep their authored per-pellet variation, each multiplied once by 1.18.

## 4. Mutual exclusion and timeline
Per Magnet:
- while A1 gameplay force is active, A2 cannot start;
- while A2 gameplay force is active, A1 cannot start.

This exclusion is tied to GAMEPLAY force windows only.
Gold presentation recovery may continue after gameplay force ends.
A1 presentation may settle toward ~1.6 s; A2 toward ~2.3 s.
If the opposite ability begins during recovery, presentation transitions directly from current pose; never snap to neutral first.

Cooldown starts on accepted cast.
Gameplay force begins on the first authoritative gameplay tick; presentation anticipation must not delay force.

## 5. Floor firearm physical state
There is exactly one real Arsenal pickup slot/object.
Do not create a duplicate Magnet gun object.

Magnet may attach bounded physical metadata/state to a real floor slot:
- vx/vy;
- rotation response if presentation needs it;
- contact-enter state.

World integration rule:
**collect all active Magnet forces -> sum acceleration -> update each floor firearm velocity once -> integrate each firearm position once -> resolve collisions once.**
This prevents MAGNET-vs-MAGNET double stepping.

## 6. Floor firearm collision
Physical radius: **16 px**.

Wall:
- resolve penetration first;
- normal restitution **0.45**;
- tangential velocity retention target **0.82**;
- if field remains active, later ticks continue curving the bounced path.

Fighter:
- if the overlapping body is currently eligible to pick up the firearm, canonical Arsenal pickup transaction wins;
- if pickup is not allowed (e.g. body already armed), resolve physical deflection instead;
- armed-body restitution target **0.33**;
- bounce impulse only on contact-enter, not every overlap frame;
- no firearm-body damage;
- no body knockback from the loose firearm;
- no disarm;
- no ownership rewrite.

## 7. Arsenal chain law
Do not hack pickup/equip.
Canonical Arsenal overlap/pickup remains authority.

Desired emergent chain:
gun 1 physically arrives while Magnet is unarmed -> real pickup;
other guns may continue moving but cannot auto-pick while Magnet is armed;
the held weapon finishes/consumes under normal Arsenal law;
if another real floor firearm overlaps after Magnet is unarmed, normal pickup may occur.

Opponent interception is allowed by the same real pickup law.
No guaranteed chain.

## 8. Eligibility / special objects
Magnet active-field projectile manipulation is scoped to firearm bullets only.
Do not manipulate grenades, thrown melee, Stormbreaker, hero construct objects, shards, traps, gates, mirrors or singularities unless a later explicit owner authority says otherwise.

T6 / Stormbreaker:
- floor T6 immune to A1/A2 weapon manipulation;
- Stormbreaker projectile/throw immune;
- passive x1.18 does not apply;
- fighter holding it is still a physical Body and may be A2-pushed.

## 9. Cross-hero law
General invariant:
Magnet changes trajectory/velocity/position only. Preserve all semantic tags and gameplay transactions owned by other heroes.

ROBOT:
- a Magnet-moving floor firearm remains the same real slot; Robot acquisition reads its live position.

CRYSTAL:
- preserve reflection/controller/provenance/crit tags.
- after Crystal changes a projectile controller, Magnet evaluates the new state on the next tick.
- Magnet does not damage Crystal constructs with moving loose guns.

BLACK_HOLE:
- a stored projectile is outside Magnet manipulation while stored.
- after release, it may be affected on later ticks if eligible/in-field.

MATH_V2:
- Magnet changes trajectory; graph/gate semantics remain Math-owned.

FROST:
- Frozen floor firearm can physically move while retaining Frozen metadata and pickup denial.
- Frost bullet payload survives Magnet bending.
- Frost floor locomotion modifiers do not scale Magnet's external A2 force.

RUBBER:
- stored projectile is not Magnet-manipulated while stored.
- release returns to normal projectile truth and may later be bent.

HUNTER:
- loose firearm does not trigger trap.
- Hunter disarm consume semantics remain Hunter-owned.
- Magnet A2 external body force does not cancel Hunter skill by invention.

TIME:
- replayed firearm bullets are real bullets and may be bent.
- Time relocation/rewind does not imply world-gun rewind.

MIRROR:
- see `09_MIRROR_COLOAD_LOCK.md`; mechanics remain unchanged.
- copied gun does not copy Magnet passive; passive belongs to Magnet.
- Mirror A2 swap relocates Magnet; active field center follows Magnet's new authoritative position on later ticks.
- Mirror neutral projectile metadata is never stripped by Magnet.

SLIME:
- A2 applies to each eligible living Body individually.

SNIPER:
- movement lock/nest is self-locomotion law, not immunity to external A2 force.
- relocation remains Sniper-owned; later Magnet ticks use new position.

## 10. Out of scope
- no Mirror redesign;
- no new progression Lv2-Lv5;
- no unrelated SFX sourcing;
- no global engine rewrite;
- no blood/damage-number changes;
- no balance changes outside numbers locked above;
- no redesign of approved Magnet art.
