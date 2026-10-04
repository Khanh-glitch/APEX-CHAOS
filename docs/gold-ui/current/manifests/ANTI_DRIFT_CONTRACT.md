# APEX CHAOS Gold UI — Anti-Drift Contract

This source pack is the visual/interaction authority for the current Gold surfaces. Implementation may adapt plumbing to production runtime, but may **not reinterpret** the Gold design.

## Preserve exactly in meaning and perceived behavior

- Composition, spacing hierarchy, silhouette, framing and z-order.
- Motion choreography, durations, easing relationships, recoil direction, overshoot, settle, shake and impact hierarchy.
- FX layering and trigger meaning: flash, fracture/crack, side recoil, KO emphasis, skill state, hit/crit/heal distinction, transition seals/rails/handoff.
- Responsive layout families and the reason each element moves/reflows.
- P1/P2 color ownership as a semantic system across rails, accents, glows, skill state and impact feedback. Side colors must be data-driven; never hard-code a design that only works for the demo fighters.
- Interaction affordance and attention order: what looks selectable, locked, ready, dangerous, damaged, victorious, or unavailable.
- Reduced-motion behavior where authored.

## The only replaceable art slots

1. Lucky Draw fighter visual art.
2. Fighter Pick cover/card art.
3. Fighter Pick pose/stage art (Mirror may remain runtime-derived from the opponent identity).
4. Battle fighter avatar/portrait and passive/A1/A2 skill icons.

Replacing art means replacing the **content of the slot only**. Do not alter its frame, crop/focus contract, mask, geometry, effect envelope, responsive behavior, state machine, or motion timing.

## Integration law

Production state truth comes from the game/runtime. Gold owns presentation. Never move combat calculations, cooldown rules, HP math, ownership, or hero mechanics into the Gold renderer.
