# D3 / B01 — Crystala A1 Wall & HEXA: reflect original attack Stream

> **OWNER-APPROVED on 2026-10-13**: choose **B**. A1 Wall and A1 HEXA are the **same ability with different construct geometry**. This is a design/cutover contract, NOT proof of runtime implementation.
> Anchored to `main@2590beee79b9447fa3639870b6de6801428b7f42`.

## Binding truths

1. Both Wall and HEXA use ONE semantic eligibility and attack-reflection protocol for **all independent flying projectiles (including energy) and incoming attack Streams**. No per-weapon IDs or different Wall/HEXA type allowlists. T6 exception retains priority.
2. WALL geometry, whole-wall HP, breaking-shot pass-through and existing owner-approved Gold remain as-is. HEXA uses its own facets, facet HP and **reflect-first** ordering; no new escape or facet mechanic. **Unify semantics, not distinct structural laws**.
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

`StructuralAdjudication`: determines whether this impact truly reflects, passes through broken Wall, or is otherwise absorbed. Existing WALL projectile breaking-shot and HEXA reflect-first laws are distinct. **Recurring stream-tick structural damage cadence/break-through is still OPEN**, and must be settled before live damage code changes; no synthetic per-frame HP drain authorized.

`DamageReceipt`: realized damage/status/BURN per tick goes through canonical `aqDamage` exactly once with traceable source, controller and no duplicate recipient tick. VFX subscribes to authoritative contact/reflection, never owns geometry/damage.

## Mandatory acceptance evidence before promotion

- Same A1 reflection eligibility for Wall and every active HEXA facet, including energy and streams; correct separate geometry and facet openings.
- Earlier body/wall contacts precede later structure, no missing or double hits; true clipped stream cannot damage behind an intact blocked path.
- Native same-stream redirection (not fake bullet), conserved source identity, Crystala controller credit only when legally reflected; status/BURN no duplicated damage.
- T6/owner-projectile/friendly structure controls preserved; normal physical damage law distinct.
- Ordinary projectiles keep existing swept/ordered Wall breakthrough and HEXA behavior exactly.
- Quest/Free Battle mode coverage; cold-load effects, desktop/mobile, rematch cleanup.
- Tests of the **same real engine branch SHA**, runtime revision / checksum cutover, and owner visual/gameplay review.

## Scope of current reference

Independent fixtures may verify owner decision B, phase/eligibility and a **preview** from injected contact witnesses. Such preview cannot replace the true cone collision/damage executor. D0-D4 pure fixtures are not production PASS.

## Decision status

- B SAME-STREAM redirection: **OWNER CONFIRMED**.
- Wall and HEXA same A1 different constructs: **OWNER CONFIRMED**.
- Original Wall/HEXA structural, T6, K/A2 and Gold laws: **PROTECTED**.
- Repeated stream tick structure HP budget/break timing: **OPEN**.
- Implemented in actual Arsenal/Crystala battle: **NOT YET**.
