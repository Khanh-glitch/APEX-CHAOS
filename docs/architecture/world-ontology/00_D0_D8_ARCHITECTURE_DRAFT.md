# APEX CHAOS World Ontology — D0–D8 Architecture Decision Draft
Status: **PROPOSED / NOT PRODUCTION GAMEPLAY**. Baseline: `main@2590beee79b9447fa3639870b6de6801428b7f42` (2026-10-13). Do **not** silently migrate or change runtime locks, Core Six Gold, Quest, spawn weights or balance.

## Mission
Build **world-first compositional semantics** for current and future heroes, weapons, projectiles, constructs, summons, modes and commercial content. New content enters known interaction laws by declaring properties/phase/relations **once**; novel mechanics extend versioned action contracts, not hand-written per-Hero×Weapon exceptions.

## Existing authority to preserve
- Hero / 12 canonical IDs: `public/game/hero-rework/heroRegistry.js` and `heroMechanicsRuntime.js` + specialty runtimes; only Core Six playable now.
- Weapons / 41 equipment IDs: `public/game/arsenal/arsenalConfig.js` and `arsenalIdentityRuntime.js`. `arsenalSpawnRuntime.js` owns current spawn/Quest special constraints.
- AIL v2 already describes Combatant≠Body, entity traits, capability laws, swept earliest TOI, damage/provenance, escrow, match lifecycle, and is the **existing semantic foundation**, not a reason to invent another engine.
- `docs/architecture/content-admission/02_SHARED_POLICY_SHADOW_CP3.md` is test-only; production readers do not use this candidate yet.
- `extensions.json` stays **admission ledger** for new IDs, never the authoritative weapon registry.

## Core definitions
Entity = immutable definition + unique live instance + state machine + relations. Roles are compositional: Equipment can be Weapon and Defense, and a thrown Equipment can also be a Projectile. DamageSource is not Weapon. AttackCarrier forms include independent flying Projectile (physical **or energy**), Stream, Beam, MeleeSweep, Wave and AreaEffect; an explosion is not automatically a flying projectile. Material composition and magnetic response are different axes. Entity phase (held/flight/deployed/stored/expired) changes interaction eligibility. SpawnLocation, SpawnPool, SpawnPolicy and spawned equipment are distinct. Quest/free battle/future modes provide policies and faction adapters, **not different weapon identities**.

## Current owner-confirmed scope
- T6 is protected from hero-object manipulation but still participates in prescribed physical damage/contact.
- Weapon and Defense are independent spawn pools; defense conditions/weights and the T6 special spawn route remain to be designed, not set by this ADR.
- ROBOT A1: nearest identifiable revealed floor Weapon; A2: all incoming eligible damage receipts.
- HUNTER: root hostile bodies on trap contact, move toward selected hostile and disarm eligible held Weapon, WEAK through damage law. Quest multiple enemies/teams must be recognized; selection randomness timing pending.
- CRYSTALA: construct contact for **all** independent flying Projectiles including energy AND attack Streams, with T6 exclusion; melee/body contacts separate. OWNER-APPROVED 2026-10-13 (B): A1 Wall and A1 HEXA share the SAME reflection eligibility and redirect the intercepted portion of the ORIGINAL Stream, preserving carrier nature/provenance (not a synthetic projectile). Wall/HEXA share ONE damage-to-structure decision: if an actual hit/tick depletes the struck Wall or HEXA facet, that SAME strike breaks through without reflection; otherwise it reflects. They differ only in geometry, placement, per-surface HP, and resulting material topology. This owner clarification explicitly supersedes the earlier legacy HEXA reflect-first ordering; stream contact still needs real damage geometry and authoritative receipts. K/A2 shard intercept remains separate. See `02_CRYSTALA_STREAM_REFLECTION_B.md`.
- MAGNET A1: any eligible floor Weapon and magnetic flying Projectile; A2: magnetically responsive floor Weapon/Projectile plus existing body push. No magical snap or held gun auto theft.
- FROST: freeze eligible Weapon, A2 real held-Weapon transfer, Passive only conventional bullets emitted by Frozen Gun. OWNER CLARIFICATION derived from explicit instructions: A1 creates Frozen Equipment for ANY eligible non-T6 Weapon (including melee/V43/hybrid); Passive is still ONLY ordinary-bullet emissions. Do not fabricate freeze damage/procs on melee, flame or beams; runtime firearm-only predicate requires separate verified cutover.
- MIRROR: copy eligible held Weapon; atomic exchange with enemy; Passive routes any independent flying Projectile **including energy**, not Stream or explosion. Preserve neutral controller/no hero credit and provenance. T6 protected.

## Query contract
`query(action, entity, context) -> {status:'allowed'|'denied'|'unresolved',reason,explanation?}`.
This decides semantic eligibility only. Collisions (swept contact/TOI), actual forces, mutation, weapon holder transactions, spawn, HP damage and rendering remain in **authorized executors**. A denial is not the same as unknown: missing traits/executor => `unresolved` with reason; never silently ignore a new family.

## Lifecycle / mutation invariants
Definition and instance IDs never conflated; `CLONE` new identity, `THROW_SELF` same equipment identity, `EMIT_CHILD` new projectile instance, `REFLECT` retains provenance while controller may change by law, `STORE` removes active spatial collision without duplicate movement, `TRANSFORM` retains identity but changes role/phase under transition authority. Exactly one movement/lifetime authority per live projectile per step. Ordered swept collision; damage goes through `aqDamage` once; match teardown clears subscribers/objects/FX.

## Commercial content design
**Presentation Cosmetic** (gun/hero/projectile/effect/HUD/arena skin): only visual, audio and non-authoritative animation bindings. Skin is never a damage, hitbox, cooldown, projectile family or spawn override. **Gameplay Variant** (including a *paid skin marketed with stat or mechanics changes*): separate approved gameplay identity/fingerprint, typed stat/mechanic delta, canonical executor/admission proofs, tier/spawn/mode eligibility; packaged with cosmetic as a **Commercial Bundle** if needed. Entitlement/store metadata is not a simulation authority. Mode decides whether gameplay variants are allowed/normalized/excluded; no pay-to-win/fairness policy is assumed. `ZBROYAR_Z15_S1/S2/S3` initially differ in `arsenalConfig.js`, **but `arsenalIdentityRuntime.js` normalizes them to one ballistic identity**: inspect final effective config, never infer current combat semantics from an intermediate config layer.

## Future mode extensibility
A Mode defines Roster/Team, Spawn, Objective, Equipment, Variant, Simulation and Presentation policies; no fork of Hero/Arsenal definitions. Free Battle 1v1, BOT, Quest multi-actor and future multiplayer, boss, wave or tournament modes can adapt their social/spawn/objective contracts independently. Quest's present `questTeam` is an existing adapter opportunity, not proof it already shares target authority with Hero Rework.

## Checkpoints
- **D0** World Lawbook with [OWNER]/[CANON]/[OBSERVED]/[PROPOSED]/[OPEN] and future counterexamples.
- **D1** Authoring schema and stable read-only adapter from canonical registries.
- **D2** All 41 equipment IDs, V43 phases, 12 heroes and Quest entities classified; missing traits flagged.
- **D3** Translate 36 skills to target query/action/executor/lifecycle; record differences without automatic balance changes.
- **D4** Pure reference tests plus Shadow parity against CP3 and shipped readers; demonstrate future energy/hybrid/summon/variants.
- **D5** One production consumer per revision/checkpoint with source, real headless, rollback and CI evidence.
- **D6** Projectile/TOI/owner, renderer and cold-loaded asset/SFX readiness hardening; actual Chrome device proof.
- **D7** New hero/gun/skin/variant/mode admission with CI/golden/Quest/locale/entitlements integrity.
- **D8** Adversarial future-feature playtest and owner signoff. **Do not call D5–D8 complete from a pure reference test.**

## Decision boundaries before gameplay cutover
Owner resolved Crystala B and unified WALL/HEXA reflect-unless-breaking law: each REAL damage tick is one hit; the same tick breaks through if its structural damage >= remaining HP of the contacted surface. Crystala stream cadence is no longer open. Remaining open: Defense spawn conditions and rates; Hunter multi-enemy random acquisition timing; Mirror capture of thrown original Equipment and return/catch; commercial power variant fairness and allowed modes. All other independent test/design work can proceed without these choices.

This ADR is intentionally a **non-production discussion checkpoint**. No real gameplay, balance, asset, cache revision or existing registry has changed.