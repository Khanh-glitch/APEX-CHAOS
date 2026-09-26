# APEX Integration Mapping

This document describes conceptual mapping only.

Arena Agent must audit the live repo before choosing actual files/classes/hooks.

## State mapping

| Prototype concept | Production APEX source |
|---|---|
| spawned Stormbreaker | real weapon spawn / pickup state |
| global slow | actual movement/status modifier system |
| pickup | real pickup / ownership transition |
| throw start | actual Stormbreaker attack event |
| flight position | real projectile/weapon flight transform |
| spinning sprite | real weapon renderer / projectile renderer |
| contact position | actual weapon-victim collision |
| stun | actual combat status system |
| impact discharge | VFX consumer of confirmed hit |
| camera shake | existing APEX camera feedback API |
| arena illumination | existing render/composite layer if available |

## State machine target

Conceptually:

`SPAWNED_UNCLAIMED`
- floor lightning active
- linked weapon-body crackle active
- global slow active

→ pickup

`HELD`
- floor slow removed
- local held crackle
- attack available

→ attack

`THROWN`
- fast rotation
- cached motion ghosts
- short local arcs across whole weapon
- NO LONG TAIL

→ confirmed hit

`IMPACT`
- hit flash
- weapon hidden immediately after flash
- target stun
- arena discharge
- residual body crackle

→ resolve using the existing weapon lifecycle / cooldown / despawn rules

## Important separation of concerns

### Gameplay owns:
- spawn state
- slow
- ownership
- attack timing
- collision
- damage
- stun
- weapon lifecycle

### VFX owns:
- floor lightning rendering
- weapon crackle
- rotational ghosts
- hit flash
- arena electrical discharge
- transient sparks
- illumination presentation

VFX must consume gameplay truth, never create its own parallel damage/stun truth.

## Throw implementation

Preferred direction:

- draw real weapon sprite at actual transform
- rotation based on actual throw state
- cache/pre-scale source image if the renderer benefits
- draw 2–3 lightweight rotational ghosts
- compute a small fixed set of anchor points across the weapon
- draw short local arcs between anchors
- draw a few short outward snaps from distributed anchors

Do not create a history trail that visually connects back through the full flight path.

## Weapon anchor concept

The executable prototype samples several locations across:

- axe head top
- axe head lower region
- neck
- upper handle
- mid handle
- lower handle
- pommel

Production should derive anchors from the actual sprite geometry / transform.

Do not hardcode prototype image-space coordinates if APEX uses another crop, pivot, sprite atlas, scale, or orientation.

## Impact

Trigger only from a confirmed actual hit.

At contact:
- flash centered on real collision point if available
- hide Stormbreaker immediately after flash
- stun real victim
- fire discharge VFX
- invoke existing camera shake
- respect actual damage already resolved by combat

Do not invent fake damage values.

## Red tier

Integrate with existing rarity architecture rather than creating a parallel rarity system.

Stormbreaker should be represented as the first red-tier item only if the current rarity architecture supports/authorizes that addition.

If red tier does not yet exist, implement the minimum isolated extension required by current project authority, without refactoring unrelated rarity systems.