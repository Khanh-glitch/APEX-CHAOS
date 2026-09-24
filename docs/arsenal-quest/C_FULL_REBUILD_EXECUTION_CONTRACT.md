# ARSENAL QUEST — CHECKPOINT C FULL REBUILD EXECUTION CONTRACT

Status: IMPLEMENTATION AUTHORIZED  
Owner direction: 2026-09-24  
Implementation branch: `arena/01a0cf5e-apex-chaos`  
Pre-implementation HEAD: `4cdec50b78780c6cd0c4caaf7a33f1baf9da605f`

This document is the final execution contract for Checkpoint C.

It supersedes the earlier assumption that the owner must receive a partial or vertical-slice playable build before the complete Checkpoint C rebuild is implemented.

## 0. Delivery law

**The next owner-facing playable delivery must be a complete Checkpoint C rebuild, not a temporary demo.**

Internal implementation milestones are allowed and encouraged for verification, but they are not owner delivery milestones.

Do not stop and hand the owner:
- only 3 proof guns;
- only a visual slice;
- placeholder versions of remaining weapons;
- a mixed old/new asset build;
- unfinished arena/background;
- unbalanced native fighter lethality;
- temporary projectile language.

The owner should next experience the complete rebuilt Arsenal combat presentation in context.

## 1. Product outcome

The completed build must make the fantasy readable without HUD:

**The fighter creates the opportunity. The weapon delivers the payoff.**

The full mode must feel visually, sonically and physically coherent rather than like unrelated assets layered onto the old Apex battlefield.

## 2. Full implementation scope

### 2.1 All 12 canonical weapons

Implement production-intent visuals and motion for:

Ranged:
- PISTOL
- SHOTGUN
- SMG
- SNIPER
- GRENADE

Melee:
- SABRE
- BATTLE_AXE
- DAGGER
- SPEAR
- SPIKED_CLUB

Defense:
- SWIRL_SHIELD
- TOWER_SHIELD

No canonical weapon may remain on the rejected old visual language.

### 2.2 Gun family

Use the audited Senko v9 family as the primary source language.

The implementation may choose the best fitting individual Senko source per gun role while preserving:
- family coherence;
- strong class silhouette separation;
- visible mechanical detail;
- graphite/dark-steel body;
- consistent highlight/edge treatment;
- controlled warm/brass accents.

Do not mechanically repaint every gun identically.
Preserve useful weapon-specific structures for recoil, pump, chamber, tilt, climb and exit motion.

### 2.3 Melee / defense normalization

Use the strongest audited source geometry as input, then reprocess deliberately.

Required:
- Axe: industrialized heavy source, not medieval inventory-icon final.
- Swirl Shield: round source may be reprocessed if it supports catch/reject identity.
- Tower Shield: dedicated tall industrial silhouette. Never stretch a round shield.
- Remaining melee weapons must be normalized to the same material/edge/light language.

### 2.4 Canonical grenade

Create one production-quality grenade identity compatible with the final family.

The exact canonical identity must persist through:
`floor pickup -> equipped/wind-up -> released projectile -> in-flight spin`.

Do not ship the Kay donor unchanged.
Do not swap to a generic circle in flight.

### 2.5 Projectiles

Replace slow outlined oval bullets.

Production target:
- Pistol: fast short tracer
- SMG: finer rapid tracer rhythm
- Shotgun: near-instant pellet streak fan
- Sniper: strongest long near-hitscan transient

Allow a tiny projectile head only if it improves readability.

Implement high-speed projectile collision with swept/continuous testing where needed.
Do not solve tunneling by making projectiles visually large.

### 2.6 Spent casings

Implement visible casing ejection where mechanically appropriate.

A spent casing must read differently from a loaded cartridge:
- open-mouth / empty-shell silhouette;
- short physical arc;
- spin/fall;
- bounded lifetime.

Casing is secondary motion and must not dominate combat readability.

### 2.7 Motion V2 — all weapons

Use the authoritative signature motion targets.

Every weapon action must have:
`anticipation -> commit -> impact -> physical recovery/exit`.

No normal consume event may use alpha fade as its primary exit.

Required signatures include:
- Pistol triple punctuation
- Shotgun body punch + rack
- SMG progressive climb
- Sniper ceremony -> violence
- Grenade wind-up throw
- Sabre draw-cut
- Axe hang -> crush -> stuck/yank
- Dagger needle
- Spear line
- Club swing-through
- Swirl Shield catch/reject
- Tower Shield plant/absorb

### 2.8 VFX language

Use the curated existing sources as ingredients, not as automatic final compositions.

Required:
- weapon-specific muzzle behavior;
- restrained smoke;
- directional/contact-specific sparks or flashes;
- grenade explosion hierarchy;
- no generic slash sheet as primary melee read;
- no generic square-particle burst as primary read for every hit;
- no particle spam used to compensate for weak motion.

### 2.9 Audio

Keep the owner-preferred current gun-fire baseline unless in-context implementation proves a specific class fails:
- Pistol: cz
- SMG: sks slices
- Shotgun: shotty
- Sniper: mosin

Integrate the owner-PASSed Sonniss layers for:
- melee;
- shields;
- grenade;
- gun mechanisms.

Remove the sci-fi sniper charge from the final direction.

Audio events must synchronize to actual mechanical/contact moments, not merely animation start.

If the approved Sonniss final-lock bundle is not available in the working checkout, restore it from the owner-approved source before final delivery. Do not substitute random new SFX merely to fill the path.

### 2.10 Chamber 01

Implement the Arsenal-only environment:

**ARSENAL FIELD TEST // CHAMBER 01**

Required:
- dark graphite / charcoal;
- restrained test-range/grid markings;
- clear industrial boundaries;
- sparse measurement ticks / zone marks;
- neutral pickup presentation areas;
- low-contrast background hierarchy;
- no bright decorative lines competing with projectile lanes;
- no central obstacle added merely for decoration.

Do not redesign the global non-Arsenal Apex background.

### 2.11 Fighter vs weapon power hierarchy

Include the Checkpoint C power-hierarchy work in this same owner-facing delivery.

Target over representative matches:
- Arsenal weapons: ~70–80% meaningful direct damage
- native fighter kit: ~20–30%

Preserve fighter identity through setup, control, mobility, defense and sustain.
Do not make fighters inert.
Do not leave native fighter lethality at the old unchecked level.

Use per-mechanic adaptation where needed rather than one blind global multiplier.

### 2.12 All-32 compatibility

The completed delivery must preserve holder state and recognizable identity across all 32 fighters.

No recurring native ability may:
- steal holder state;
- visually overpower Arsenal payoff;
- create systematic pre-weapon kills;
- break aim independence / bounce / pickup rules already proven in prior checkpoints.

## 3. Creative autonomy boundary

This contract defines invariants and acceptance outcomes, not pixel-by-pixel implementation instructions.

The implementing agent is expected to exercise design/engineering judgment inside these boundaries.

The agent may decide:
- exact reprocessing technique;
- exact per-weapon accent placement;
- exact small timing adjustments;
- exact rendering implementation;
- exact casing arc parameters;
- exact internal code organization;
- which audited source variant best satisfies a role.

The agent may not reinterpret:
- product fantasy;
- canonical weapon list;
- rejected visual directions;
- grenade continuity;
- Tower Shield silhouette requirement;
- projectile language;
- physical-exit requirement;
- Chamber 01 hierarchy;
- required full-delivery scope.

When multiple valid implementations exist, optimize against the rendered/playable result, not adherence to an arbitrary implementation recipe.

## 4. Internal implementation loop

Do not rely on first-pass code quality.

The agent must repeatedly:
1. inspect current runtime and authoritative docs;
2. implement;
3. run automated checks;
4. boot the real game;
5. capture real browser screenshots/evidence at representative states;
6. inspect visual output;
7. correct clipping, scale, contrast, positioning, missing assets and incoherent motion;
8. repeat until acceptance criteria pass.

Visual QA is part of implementation, not a later polish phase.

Internal partial states must not be promoted to `playtest/arsenal`.

## 5. Required real-browser evidence

Before owner handoff, refresh evidence for at least:
- hidden/reveal/pickup continuity;
- Pistol triple fire;
- SMG burst/climb;
- Shotgun recoil + rack;
- Sniper aim/shot;
- Grenade pickup/wind-up/in-flight/explosion;
- each melee signature;
- Swirl reflect;
- Tower plant/block;
- tracer language;
- casing ejection;
- Chamber 01 wide combat frame;
- multiple simultaneous pickups;
- F3/debug state proving no asset/runtime failures.

Evidence must come from the actual running build, not a static concept board.

## 6. Verification

Required before owner delivery:
- existing automated Arsenal suite passes;
- no uncaught errors in long simulation;
- asset loads show no failures;
- projectile swept-collision checks pass;
- all 12 weapons can spawn, be collected, used and consumed;
- grenade visual identity stays continuous;
- no primary slash-sheet melee presentation;
- no slow oval projectile presentation;
- all 32 fighter compatibility checks pass;
- damage-share telemetry is within the intended hierarchy or deviations are explicitly documented and corrected;
- real-browser visual evidence is refreshed from this exact build SHA.

Do not modify tests merely to hide regressions.

## 7. Git / deployment law

- Work only on `arena/01a0cf5e-apex-chaos`.
- Do not modify `main`.
- Keep `playtest/arsenal` frozen during implementation.
- Do not deploy intermediate commits.
- Maintain coherent commits.
- Final owner playtest promotion happens only after the complete build passes verification/review.

## 8. Definition of done

Checkpoint C implementation is done only when:

1. all 12 weapons use the coherent rebuilt visual language;
2. all 12 have their intended signature action/physical exit;
3. grenade continuity is exact;
4. guns use the final tracer/projectile language and robust collision;
5. spent casings exist where appropriate;
6. impact/VFX hierarchy is weapon-specific;
7. approved audio/mechanism/contact layers are integrated;
8. Chamber 01 is active for Arsenal;
9. fighter/weapon power hierarchy has been normalized;
10. all 32 fighters remain compatible;
11. automated and real-browser verification passes;
12. there are no intentional placeholders or owner-facing TODO visuals in Checkpoint C scope.

At that point, provide the owner a full playable Checkpoint C rebuild for evaluation.

Checkpoint D (full HUD/menu/UX overhaul) remains a separate product checkpoint unless the owner explicitly expands this contract.
