# D3 / B01 — Crystala A1 Wall & HEXA: reflect original attack Stream

> **OWNER-APPROVED on 2026-10-13**: choose **B**. A1 Wall and A1 HEXA are the **same ability with different construct geometry**. This is a design/cutover contract, NOT proof of runtime implementation.
> Anchored to `main@2590beee79b9447fa3639870b6de6801428b7f42`.

## Binding truths

1. Both Wall and HEXA use ONE semantic eligibility and attack-reflection protocol for **all independent flying projectiles (including energy) and incoming attack Streams**. No per-weapon IDs or different Wall/HEXA type allowlists. T6 exception retains priority.
2. WALL and HEXA are **functionally identical as A1 reflectors**. For every valid projectile impact or true damage Stream tick, test the HP of the exact contacted surface *before* reflection. If damage >= remaining HP, that same hit destroys the Wall/HEXA facet and **passes through without reflection**, preserving original attack controller, velocity/direction, damage, statuses and provenance. Otherwise reflect, then decrement the struck surface HP. Differences are only geometry, placement, HP/independent HEXA facets and construct deployment. **Newest owner instruction supersedes the prior HEXA reflect-first contract** from Crystala V2. Do not alter Gold choreography, K/A2 or T6 policies.
3. Reflected Stream remains a **Stream**, never an `aq_bullet` synthetic body. It is the *intercepted part of the actual damaging stream*, redirected by the true contacted surface/normal, not all generated particles or the entire stream without a real intersection.
4. Its original emission/weapon source and provenance persist. The post-reflection controller/damage-credit law follows Crystala's canonical reflection policy and `aqDamage`; no double ×7, second critical roll, duplicate tick or independent HP subtraction.
5. Nonintercepted stream portions remain governed by their original source. A stream portion clipped/blocked by solid geometry cannot also independently hit the target behind that same surface.
6. T6 manipulation protection has precedence without turning T6 into generic physical-damage immunity. Own/allied attack behavior preserves the established friendly-material interaction law.
7. **K/A2 remains the six-shard Awakening interceptor.** Its eligibility, animation/resource timing, radius and separate projectiles are not silently expanded by this A1 decision.

## Source-grounded blocker

`public/game/arsenal/arsenalWeaponRuntime.js::v43FlameHit` (about L748-804) currently applies direct damage in scheduled ticks by checking the actual muzzle-origin aiming cone and enemy distance; it does **not** have authoritative Wall/HEXA contact/clip/reflected-cone resolution. Gold particles are render-only. In contrast, mobile `aq_v43` reflectable projectiles call `APEX_CRYSTAL.resolveBullet` during the kinetic step (about L1048-1057). Making `reflectableKinds` include `flame` would NOT produce correct gameplay.

## Required shared seam (future production D5/D6)

`AttackStreamEmission`: source Equipment/Combatant, unique attack/tick/slice IDs, simulation timestamp, actual emission pose, damaging cone/volume geometry, payload and provenance/controller.

`ContactWitness`: first real geometry contact (world TOI/normal, construct ID, facet ID, phase/solidity, obstruction ordering) calculated against **live damage geometry**, not VFX particle trajectories.

`StreamRoute`: clip only intersected stream slices at that surface; reflect the intercepted part of the same attack with adjusted path and effective owner, keep uncontacted coverage and timing. Never generate fake projectile/second fire.

`StructuralAdjudication`: **ONE common A1 rule** across WALL and HEXA. Each REAL Stream damage tick contacting a surface is one independent attack hit; compare its authorized structural damage with current Wall HP or contacted facet HP. If hit would deplete HP, break and pass the SAME hit/stream slice through unchanged; otherwise redirect that same slice, then subtract the tick structural damage. No particle/frame-rate-driven HP drain, no double counting, and no invented residual-damage arithmetic. This decision is OWNER-RESOLVED. In multi-facet trajectories, later independent contacts are decided by their actual later surface state/TOI, not a global HEXA immunity.

`DamageReceipt`: realized damage/status/BURN per tick goes through canonical `aqDamage` exactly once with traceable source, controller and no duplicate recipient tick. VFX subscribes to authoritative contact/reflection, never owns geometry/damage.

## Mandatory acceptance evidence before promotion

- Same A1 reflection eligibility for Wall and every active HEXA facet, including energy and streams; correct separate geometry and facet openings.
- Earlier body/wall contacts precede later structure, no missing or double hits; true clipped stream cannot damage behind an intact blocked path.
- Native same-stream redirection (not fake bullet), conserved source identity, Crystala controller credit only when legally reflected; status/BURN no duplicated damage.
- T6/owner-projectile/friendly structure controls preserved; normal physical damage law distinct.
- All eligible projectile and Stream hits follow unified breaking-hit pass-through for WALL and HEXA, explicitly updating the old HEXA reflect-first gameplay. Preserve ordered swept contacts, HP and Crystala passive/reflection credit.
- Quest/Free Battle mode coverage; cold-load effects, desktop/mobile, rematch cleanup.
- Tests of the **same real engine branch SHA**, runtime revision / checksum cutover, and owner visual/gameplay review.

## Scope of current reference

Independent fixtures may verify owner decision B, phase/eligibility and a **preview** from injected contact witnesses. Such preview cannot replace the true cone collision/damage executor. D0-D4 pure fixtures are not production PASS.

## Decision status

- B SAME-STREAM redirection: **OWNER CONFIRMED**.
- Wall and HEXA same A1 different constructs: **OWNER CONFIRMED**.
- WALL/HEXA geometry, HP, placement, T6, K/A2 and Gold: **PROTECTED**. HEXA old reflect-first ordering: **SUPERSEDED BY OWNER**.
- Each real Stream damage tick contributes exactly one structural hit at a contacted surface; breaking-hit pass-through: **OWNER CONFIRMED**.
- Implemented in actual Arsenal/Crystala battle: **NOT YET**.
