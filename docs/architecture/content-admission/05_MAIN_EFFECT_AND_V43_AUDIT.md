# Main — Core Six Effect Timing + V43 integration audit

Baseline: `main@2590beee79b9447fa3639870b6de6801428b7f42`. This audit does **not** merge or rebase pending PR #34.

## Confirmed
- `Magnet.isEligibleFloorFirearm` used `CFG.isGun(id)`, which excludes **all** eight actual ranged V43 holders. The same gate was called for both A1 pull and A2 floor push. Fix: allow registered V43 ranged holder on revealed floor; disallow T6, unrevealed, HEAL and unknown IDs. Projectile kinetic kinds still use V43 `magnetizableKinds`; a magnetic gun does **not** imply magnetic flame/plasma.
- Hunter ROOT trap contains **seven actual PNG components**, including three blade assets. `rtLoadImages` used an asynchronous `throw` inside `img.onerror`, which leaves the `Promise.all` unresolved rather than reporting a terminal material error. Generated runtime and its source generator were fixed together. `hunter.whenReady` resolves only after the seven parts exist and are derived.
- Frost image/mip preparation was initiated only when the ICE battle state was first created. Gold uses a **module-global** `loadPromise`, so two engine instances cannot independently receive that promise's per-instance mip allocations. Fix: preload one dedicated Frost engine before battle readiness, publish a shared art cache, install it onto live and rematch engines. No cast animation/movement changes.
- Crystala Hexa Prison has six *independently evolving* edges. The generic construct raster cache previously trusted the parent `grown` state and could reuse a partial back/front snapshot. The prison now draws directly through the unchanged Gold renderer each frame; linear wall caching remains active. Mechanical wall collisions and HP are untouched.

## Test/Release boundaries
- Real-floor V43 Magnet slot integration + provenance: `tools/testV43MagnetFloorPickup.mjs`.
- First-cast and rematch ready material + repeat prison rendering: `tools/testCoreSixEffectMaterialReadiness.mjs`.
- Production Gold renderer and original V43 projectile physics remain independent truth authorities. No new gameplay policy is inferred for Mirror F2 V43, Magnet BOT preflight or V43 passive speed scaling.
- The actual owner V43 Gold visual-motion certification still lacks 40 phase proofs; this audit cannot honestly mark those green.
