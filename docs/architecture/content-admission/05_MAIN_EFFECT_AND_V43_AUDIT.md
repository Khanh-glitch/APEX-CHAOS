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

## Additional confirmed V43 classification seams

- `heroMechanicsRuntime.magnetAiDecision` previously scanned only `CFG.isGun` floor slots and `aq_bullet` incoming threats. BOT Magnet could refuse an appropriate A1 even when gameplay could attract that V43 ranged floor gun, and did not proactively respond to kinetic V43 rocket/bolt/ball/mines. AI now delegates to the **same real Magnet gameplay eligibility predicates** for floor holders and incoming projectiles, retaining own-projectile and TOI geometry checks. Nonkinetic plasma/flame remains excluded.
- `arsenalBattleRuntime` emergency unarmed-rescue logic also treated a V43 equipped ranged holder as unarmed and V43 revealed guns as zero available guns, risking a needless additional emergency gun spawn. The local count now recognizes registered V43 ranged holders as actual equipment, without changing regular `CFG.isGun` projectile/damage-family semantics.
- Deliberately **not normalized:** `arsenalSpawnRuntime.selectFirearmWeapon` is a conventional-gun *fallback* chooser; `arsenalWeaponRuntime.scaleEquipmentDamage` applies the x7 ordinary family scale while V43 owns per-special damage values. Changing these without approved balance tests could double-scale V43 hits. Mirror F2 does not yet admit `aq_v43` by its current contract.

## CP6 foundation — semantic equipment contract

A `ranged` Arsenal holder is classified by the **actual equipped WEAPONS definition**; `CFG.isGun` is deliberately a narrow conventional *ballistic family* and MUST NOT be used as a synonym for "ranged weapon equipped" or "ranged floor slot". `CFG.isRangedEquipment(id)` is the only common equipment-class query; it has no V43/FUTURE version branch. Magnet A1/A2 floor force and the emergency unarmed-spawn detector now delegate to it. Action-specific T6 immunity remains separately enforced by Magnet. Crit, firearm passive emission, existing special projectile kinds, damage and release pools remain unchanged.

`tools/testEquipmentSemanticsContract.mjs` asserts all 41 current items against real WEAPONS, verifies all eight V43 holders, and temporarily registers a **hypothetical ninth/future ranged executor** without touching Magnet or the battle loop. That new holder must be recognized automatically while its unregistered `aq_v43`/ordinary `aq_bullet` must remain nonmagnetic. This is a metamorphic extension test, not proof of an actual new special executor's full rendering or damage.

**Remaining architectural debt:** common projectile identity/capability query is still CP3 shadow-only on `main` (pending separate CP5.1 PR #34). A future content admission must validate equipment class, produced projectile kinds, passive emissions, AI targetability, and visual-asset readiness as different contracts. Do not merge PR #34 or claim it is production-authoritative yet.
