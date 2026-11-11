# D0–D8 World Ontology — Implementation Gates & Owner Decision Register

**Design-only checkpoint; no runtime cutover.** Read alongside `00_D0_D8_ARCHITECTURE_DRAFT.md`. Source anchored at `main@2590beee79b9447fa3639870b6de6801428b7f42`. No code changes to `main`.

## Hard architecture gates
1. Original 12 canonical hero IDs / 36 skills / 41 equipment IDs remain required subsets, while added content must be admitted rather than rejected by brittle equality counts.
2. Semantic source = real effective Arsenal/Hero definitions, not a second hand-maintained registry. `arsenalIdentityRuntime.js` normalizes `ZBROYAR_Z15_S1/S2/S3` to a shared ballistic identity despite earlier configuration values; verify **effective** truth.
3. A role like Weapon/Defense differs from DamageSource; projectile vs continuous attack Stream differs from physical/energy material; entity phase differs from definition; source provenance differs from controller and holder.
4. Mode-specific team/spawn/objective/variant policies must be declared; no duplicate Free Battle vs Quest weapon registries. Quest has `questTeam` selectors already; adapt rather than replacing.
5. Query says `allowed | denied | unresolved` with reason. It never substitutes for actual swept collision/TOI, transfer, owner credit, damage, FX or asset readiness executor.
6. Each newly invented action is namespaced and registered with domain, mutation rights, lifecycle and real proof; unknown action/trait cannot silently default to allowed or denied.
7. Pure visual/effect/character/weapon skins cannot mutate gameplay parameters or hitboxes. Commercial skin with damage, fire cadence or mechanics changes has a separate GameplayVariant identity and admission proof; mode has explicit allow/normalize/deny policy.
8. No all-at-once projectile rewrite; regular and V43 frame ownership must stay exact-once. Preserve AIL T6, damage/credit, Frozen holder, Mirror neutral, Quest story rules. OWNER 2026-10-13 explicitly CHANGES historic HEXA reflect-first into same A1 breaking-hit pass-through as WALL; do not treat the prior reflect-first rule as protected.

## SHA-sourced key discrepancies
- Magnet A1 floor predicate uses `CFG.isGun` and omits V43 Weapon slots despite owner rule all eligible floor Weapons; Magnet V43 flight can be recognized by magnetizableKinds.
- Mirror F2 currently excludes `aq_v43` although owner now includes every independent flying Projectile, including energy; never automatically include streams or explosions.
- Robot A1 uses nearest revealed pickup; future separate defense items require role filtering.
- Hunter A2 currently tracks nearest living enemy Body while owner described random enemy; choosing *when* to lock/reselect is a gameplay decision.
- Frost predicate currently protects firearm-only Frozen Gun; expanding to all melee/hybrid weapons needs owner semantic clarification before production change.
- Crystala needs incoming Stream contact coverage and NEW unified Wall/HEXA breaking-hit rule: if incoming real hit/tick damage >= remaining contacted surface HP, destroy that Wall/facet and do NOT reflect the same hit. Historic Hexa reflect-first is superseded by newest owner decision.

## Review/approval decisions (only when crossing associated production seam)
**B01 — Crystala OWNER-RESOLVED 2026-10-13:** Option B reflects the intercepted portion of the ACTUAL Stream (no synthetic bullet). A1 WALL and HEXA share the SAME reflect-unless-breaking law for all eligible attack hits including real Stream damage ticks. A hit that consumes the HP of the Wall or contacted HEXA facet is the breaking hit and passes through **without** reflection, with original controller/payload. Historical HEXA reflect-first is explicitly superseded by latest owner authority. Separate geometry, per-facet HP, positioning and K/A2 remain. See `02_CRYSTALA_STREAM_REFLECTION_B.md`.

**B02 — Frost owner requirement ALREADY SPECIFIED:** A1 freezes all eligible non-T6 Weapons, including melee/specials; the Passive applies ONLY when a Frozen Weapon emits conventional bullets. New non-bullet freeze damage/procs are NOT authorized. Current firearm-only runtime restriction is an owner-law delta, and actual visual/holder semantics need distinct tests.

**B03 — Independent defense pool:** Trigger conditions, probability, cadence, cap and priority relative to offensive spawn. Cannot invent balance or change Quest T1/T2 story drops.

**B04 — Hunter multi-enemy:** Seeded random enemy selected at cast accept, dash start or retarget during flight? Body relations/Quest statuses matter.

**B05 — Self-thrown equipment and Mirror:** If Mirror receives the original Boomerang or thrown melee, which owner/catcher receives it after release? Must not clone holder/weapon identity by accident.

**B06 — Monetized gameplay variants:** Which modes permit stat/mechanics differences, which normalize to base stats, which require equalized/competitive policy? Architecture allows all configurations but **no paid-advantage policy was approved**.

## Evidence and stop/go
D0–D4 can be tested as a pure design/reference package outside production. Before production D5/D6: move one consumer at a time, genuinely change `APEX_ARSENAL_RUNTIME_REVISION` with lockfile, run real Arsenal/Quest headless physics and browser visual checks on the exact branch SHA, and preserve a revert point. D7/D8 require actual extension content + asset/locale/mode admission and owner playtest. **Never state D5–D8 PASS from static tests.**
