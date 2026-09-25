# APEX CHAOS // FULL FEEL + READABILITY + SMOOTHNESS IMPLEMENTATION RUNBOOK

**Date:** 2026-09-25  
**Game repository:** `Khanh-glitch/APEX-CHAOS`  
**Work branch:** `arena/01a0cf5e-apex-chaos`  
**Prepared from current remote line:** `9679ab143e5ce17bac4cff5e8cb081d70ebdfe4e`  
**Asset repository:** `Khanh-glitch/APEX-CHAOS-ASSET-VAULT`  
**Asset source ref:** `main@c8e04857025507064aa02a6dbb2a76198cc0a21b`  

This is the execution runbook for one substantial Agent run.

The run must:
1. baseline the current build;
2. implement all currently frozen feel/readability additions;
3. produce a **FEATURE COMPLETE** checkpoint;
4. run a quality-preserving smoothness pass on that full workload;
5. produce a separate **SMOOTHNESS COMPLETE** checkpoint;
6. provide functional + browser + performance evidence.

Do not treat this as a prototype or partial demo.

---

# 0. Read authorities before editing

Read in full:

- `docs/arsenal-quest/GUN_PICKUP_READY_AND_CASING_AUDIO_AUTHORITY.md`
- `docs/arsenal-quest/LIGHT_FLOOR_DAMAGE_SPLATTER_AUTHORITY.md`
- `docs/arsenal-quest/POST_PASS1_NEXT_EXECUTION_PLAN.md`
- `docs/arsenal-quest/REV2_PERFORMANCE_LAG_AUDIT.md`
- `docs/arsenal-quest/REV2_PERFORMANCE_PASS1_IMPLEMENT.md`
- `docs/arsenal-quest/REV2_WEAPON_POWER_DAMAGE_READABILITY_AUDIT.md`
- `docs/arsenal-quest/OWNER_PLAYTEST_REVISION_2_CONTRACT.md`
- `docs/arsenal-quest/OWNER_PLAYTEST_REVISION_2_IMPLEMENT.md`

Preserve all already-accepted Revision 2 and Pass 1 behavior unless this runbook explicitly supersedes it.

---

# 1. Git / branch law

Work only on:

`arena/01a0cf5e-apex-chaos`

Do not modify:
- `main`
- `playtest/arsenal`

Fetch remote first.

If the branch tip has moved beyond the prepared SHA because CI evidence or compatible authority commits landed, inspect/follow the latest compatible tip. Never reset backward.

Asset source must be read from exactly:

`Khanh-glitch/APEX-CHAOS-ASSET-VAULT@c8e04857025507064aa02a6dbb2a76198cc0a21b`

unless the owner explicitly supplies a newer authority.

---

# 2. Exact new Asset Vault inventory

## 2.1 Heal masters — exact mapping

The five uploaded PNGs are the approved owner-selected heal visuals.

| Runtime identity | Asset Vault filename | Git blob SHA | Bytes |
|---|---|---|---:|
| H1 Field Dressing | `c8b1c5b1-16fd-4ea9-859f-7fc10cf212ac.png` | `61caf3a67180f509aeec5c373524ad831efeec05` | 1,536,601 |
| H2 Medication | `23464802-353c-47d0-b2d3-38ad03e0276e.png` | `189c6efcfdce760a1d08ee196d65cc417b689382` | 1,498,464 |
| H3 Auto-injector | `1cbcae0c-8e4c-4354-a38f-c59e0448055f.png` | `d2261aaa79218694ed994589ec4acd7859ba347e` | 1,279,663 |
| H4 IV / life-support pack | `4b10f10d-07ff-45a0-89e7-7a4edadae871.png` | `b36529387c7bb16593daf5ed27eb1412b33a9899` | 1,989,429 |
| H5 Trauma hard case | `61d62f60-1bac-49bc-8ecb-57b09ddb18bf.png` | `5467212915df33bd0ec10d3e8ef7a42f758940bb` | 2,389,477 |

Canonical derived runtime names:

- `heal_t1_field_dressing.png`
- `heal_t2_medication.png`
- `heal_t3_autoinjector.png`
- `heal_t4_iv_pack.png`
- `heal_t5_trauma_case.png`

Preserve source identity; crop transparent padding / derive appropriately sized runtime assets rather than repeatedly scaling 1254px masters in the hot render path.

## 2.2 Damage-number atlas

Owner-selected canonical sheet:

`damage1.png`

Asset Vault Git blob:
`1a68a295b13a02d53b37ccf499df76a6d1f8f777`

Bytes:
19,751

Do not use `damage.png` as the canonical runtime font unless the owner changes direction.

## 2.3 Audio source masters

- `sound-effect-recharge-gun.wav`
  - pistol pickup-ready source
  - blob `51aa3a8a5932f25addde137721c1ac5f66014f2a`

- `Rifle Reload Sound Effect.mp3`
  - SMG / rifle ready-source master
  - blob `7c910d0f574d8c60ea75b5cfc172910d0af0e266`
  - useful region begins around 15 seconds; inspect and cut real transient clusters, do not guess timestamps.

- `318964__gryffdavid__bouncing-shell-casings-various-sizes.wav`
  - non-shotgun casing source
  - blob `8a897b84936bcba3c372832954f195a19acfe922`

- `620929__metrolynn__empty-shotgun-shellscasings-hitting-ground-bouncing.wav`
  - shotgun shell source
  - blob `1d9a54dc15c7eee11c892c1d68b766eee612fe52`

---

# 3. PRE-FEATURE baseline

Before modifying runtime behavior:

Run the existing full functional suite and collect a real-browser performance snapshot where possible.

Capture:
- `apexPerfSummary()`
- `apexArsenalPerfSummary()`

Record:
- avg frame interval / reported FPS
- p95 frame interval
- max
- slowFrames
- longTasks
- simulation
- chamber
- pickupDraw
- foreground
- arsenalVfxDraw
- HUD
- peak particles / shockwaves / projectiles / detachedWeapons / arsenalVfx

Do not fabricate owner-device numbers if the sandbox cannot obtain them.

This is PRE-FEATURE baseline, not the smoothness comparison baseline.

---

# 4. FEATURE IMPLEMENTATION PHASE

Complete sections 4A–4F before performance optimization.

## 4A. Gun pickup-ready audio + real casing audio

Implement `GUN_PICKUP_READY_AND_CASING_AUDIO_AUTHORITY.md` in full.

Key points:

### Pistol pickup
Use a concise derived cue from:
`sound-effect-recharge-gun.wav`

Applies:
- PISTOL / Colt
- GLOCK_17
- TEC_9
- BERETTA_93R
- DESERT_DEAGLE
- MAGNUM_500

### SMG / rifle
Analyze `Rifle Reload Sound Effect.mp3` from approximately 15s onward.

Create actual trimmed derivatives from distinct high-amplitude mechanical clusters.

Maintain:
`docs/arsenal-quest/GUN_PICKUP_AUDIO_CUT_MAP.csv`

Required columns:
`derived_file,source_file,start_sec,end_sec,duration_sec,peak_or_rms,assigned_weapons`

Assignment intent:
- MAC_10 / MP5 / P90: shorter/lighter/sharper takes
- AK_47 / M16 / Z15 family: medium rifle takes
- MBR / MBR2 / M249 / SZECSEI_FUCHS: fuller/heavier remaining takes
- all Z15 cosmetic variants share the base Z15 cue

### Shotgun pickup
Use original game SHOTGUN audio:
`public/assets/shotgun_v1/audio/special_reloading_after_use_the_dash_skill.wav`

Derive the shortest complete satisfying early mechanical gesture, rather than the full source.

Use for:
- MOSSBERG_500
- SHOTGUN / SPAS12
- SAWED_OFF
- JACKHAMMER

### Sniper pickup
Use existing:
- `sniper_chamber.wav`
- optionally useful `sniper_bolt_lock.wav` second beat

Move readiness identity to SNIPER pickup.
Do not then duplicate the same full readiness sequence in the aim/fire cycle.
Shot itself remains unchanged.

### Casing
Fix `casing_drop` vs `casing_land` semantic mismatch.

- shotgun family => derived shotgun-shell contacts
- all other guns => derived general brass-casing contacts
- no landing sound at casing creation
- one first-contact sound per casing/hull
- bounded polyphony
- later bounce does not replay

### Gun body drop
Do not add gun-body floor/drop SFX.

---

## 4B. Light-gray Chamber 01

Implement `LIGHT_FLOOR_DAMAGE_SPLATTER_AUTHORITY.md`.

Starting palette:
- floor base `#A4A7AC`
- center/material lift ~`#B9BCC1`
- edge falloff ~`#878C93`
- wall band ~`#747980`
- rail/boundary ~`#656A71`

Preserve:
- industrial room identity
- grid / ticks / walls
- no bright center lane
- existing Chamber cache architecture

Dark guns must separate immediately from the floor.

Do not restore the old black pickup oval.

---

## 4C. Colored damage splatter + persistent floor history

Reuse:
`public/assets/fang_v1/speckBlood.webp`

Do not download another blood pack.

Realized direct damage > 0:
- short directional spray
- irregular stain
- victim-color-derived liquid palette
- persistent floor mark for the current match

No:
- body parts
- wounds/organs
- generic forced-red coloring
- stain on MISS / blocked zero-damage / reveal / pickup
- DoT stain spam

Use one persistent offscreen stain surface.
Stamp historical stains once.
Composite the stain surface once per frame.

Temporary spray must be bounded/poolable.

Aggregate shotgun/automatic close hits so one attack does not create one large persistent decal per pellet/bullet.

---

## 4D. Damage-number atlas

Use canonical Asset Vault `damage1.png`.

Build a separate bounded/poolable atlas renderer.

Do NOT re-enable legacy Arsenal FloatingText lifecycle.

Rules:

### Normal
- damage = white
- healing = green with `+`
- heavy/major = larger gold/yellow presentation where appropriate

### MISS
**MISS means `MISS` only.**

Never:
- `MISS 0`
- `0 MISS`
- `0`
- `-0`
- any numeric companion to MISS

### Aggregation
- semi / sniper / melee / grenade: one resolved popup per hit transaction
- automatic: merge same-target hits in a short ~80–140 ms window
- shotgun / autoshot: one total popup per attack transaction, never per pellet

Damage numbers are a narrow approved exception to battlefield no-text law.

Do not add weapon names/tier/prose to the arena.

---

## 4E. Five heal visuals / health pickup integration

Import and map the five exact uploaded heal masters from section 2.1.

Use distinct silhouettes:
H1 cloth dressing
H2 medicine bottle
H3 injector
H4 IV fluid pack
H5 hard trauma case

Do not recolor one medkit into five tiers.

### Gameplay values

Before implementing restore amounts, exhaustively search:
- current source
- git history reachable in this project line
- owner authority docs
- issue #8 authority/comments

for an existing five-value health-restore law.

As of this runbook preparation, no explicit current Arsenal five-value restore table was verified.

**Do not invent H1–H5 heal amounts.**

If exact values exist, use them.

If they genuinely do not exist:
- implement asset pipeline/render/plumbing that can accept the five values;
- preserve the five exact identities;
- leave the gameplay value table blocked/unenabled rather than inventing numbers;
- report this as the single explicit owner-input blocker.

Do not let this one blocker stop all other feature and smoothness work.

### Heal popup
Once a real heal transaction exists:
- popup `+N`
- green
- use same bounded atlas architecture

---

## 4F. Preserve accepted gameplay

Do not rebalance weapon damage.

Do not alter:
- tier probabilities
- 3.0s spawn law
- 30 offensive item roster
- melee +50% law / bounce caps
- NEWBIE cooldown law
- Quest stage order / progression
- shotgun traversal rules
- skill ownership/gating
- accepted Quest UI fixes

No balance changes based only on damage popup visibility.

---

# 5. FEATURE COMPLETE checkpoint — mandatory

When 4A–4F are complete to the maximum supported by existing authority:

1. run headless;
2. run Vite build;
3. run full browser suite;
4. capture normal-speed browser evidence;
5. commit a distinct **FEATURE COMPLETE** implementation checkpoint.

Do not begin smoothness work until feature behavior is proven functional.

Record a second performance snapshot:

**FEATURE-COMPLETE / PRE-SMOOTHNESS baseline**

This is the primary benchmark for the smoothness phase.

---

# 6. SMOOTHNESS PHASE — HARD QUALITY LAW

The owner explicitly wants **smoothness, not reduced VFX/SFX quality**.

Performance work MUST NOT hit targets by reducing perceived presentation quality.

Forbidden as performance shortcuts:

- reducing particle counts;
- reducing VFX lifetime;
- reducing blood droplet count merely for FPS;
- shrinking stain visibility merely for FPS;
- lowering sprite/runtime texture resolution below visually equivalent derived sizing;
- lowering animation FPS;
- disabling glow, smoke, muzzle, impact, rarity, blood or other accepted effects;
- reducing SFX layers/voice quality/bitrate/duration merely for CPU savings;
- lowering sound volume to hide overlap;
- reducing max voices below current perceptual behavior merely for performance;
- 30 FPS cap;
- intentional frame skipping;
- lowering render resolution/device pixel ratio;
- weakening accepted weapon motion;
- changing gameplay cadence to make rendering easier.

If an optimization perceptibly degrades the game, it fails even if profiler numbers improve.

---

# 7. Allowed smoothness work

Optimize implementation cost while preserving visible/audible output.

## 7A. Rarity under-light caching

Current audit identified per-frame gradient/shadow work.

Pre-render/cache T1–T5 under-light visuals.

If pulse is required, use a small pre-rendered/quantized pulse set or equivalent cached method.

Normal hot path should not rebuild radial gradients / expensive shadow blur per pickup every frame.

Appearance must remain equivalent or better.

## 7B. Particle hot path

Pass 1 peak observed ~190 particles.

Do not lower effect count.

Allowed:
- object pooling
- freelists
- reuse allocation
- in-place compaction
- fewer redundant canvas state writes
- safe batching of visually identical primitives
- pre-resolved style/material state
- cached sprites
- reuse temporary vectors/arrays

Preserve particle count, lifetime and intended visual density.

## 7C. Blood effect

Persistent stain canvas is already the optimization architecture:
- stamp once
- draw once/frame

Pool/reuse temporary spray particles.

Do not maintain/repaint hundreds of persistent decal objects individually.

## 7D. Damage/heal popup

Use glyph atlas, object pooling and bounded queues.

Do not allocate new DOM nodes or canvas/text gradients per popup.

## 7E. Audio

All trimming/normalization must be build-time/repository-time.

Do not:
- parse/crop MP3 every pickup
- decode source masters repeatedly
- create unnecessary AudioContext graphs each event

Preload final runtime derivatives and reuse pools.

Do not degrade audio to achieve performance.

## 7F. Images

Use appropriately sized runtime derivatives and preload/cache them.

Do not repeatedly scale huge source masters with expensive filtering if a visually equivalent runtime derivative can be shipped.

## 7G. Chamber

Preserve Pass 1 cached Chamber behavior.

Light-gray redesign is painted into the cached surface, not recomputed every frame.

## 7H. Canvas state

Profile and remove redundant:
- `save()/restore()`
- filter resets
- shadow changes
- composite changes
- repeated path/state setup

Only where output remains equivalent.

---

# 8. Frame-pacing diagnosis

Extend performance diagnostics sufficiently to distinguish:

- near-16.7ms frames
- 16.7–20ms
- 20–33ms
- 33–50ms
- >50ms

Report counts/percentages over a bounded recent sample.

Do not change the engine's variable-dt simulation or introduce interpolation merely because the chart exists.

If after all safe render/allocation optimization:
- p95 is healthy;
- spikes are low;
- owner still perceives stepped motion;

then report movement/render interpolation as the next diagnosis rather than reducing effects.

---

# 9. SMOOTHNESS COMPLETE checkpoint — mandatory

After optimization:

1. rerun all headless tests;
2. Vite build;
3. full browser suite;
4. normal-speed visual/audio regression;
5. capture POST-SMOOTHNESS perf report;
6. compare FEATURE-COMPLETE baseline vs POST-SMOOTHNESS;
7. create a separate **SMOOTHNESS COMPLETE** commit.

The final evidence must make it possible to distinguish:
- feature implementation changes;
- smoothness-only implementation changes.

---

# 10. Required visual/audio evidence

At minimum prove in real browser:

## Audio
- pistol pickup-ready cue
- at least one SMG pickup cue
- AK or M16 pickup cue
- shotgun original-game pickup cue
- Snipex pickup chamber/readiness cue
- general casing first floor contact
- shotgun shell first floor contact

## Floor/readability
- dark/black gun on new light-gray floor
- bright/light-colored weapon/effect still readable
- rarity under-light visible on new floor

## Splatter
- two differently colored fighters leave different-color stains
- pistol
- automatic
- shotgun
- heavy/sniper
- melee
- persistent history across multiple hits
- reset on new match

## Damage numbers
- normal white hit
- automatic aggregation
- shotgun single-total popup
- heavy gold/yellow
- MISS with **no number**
- heal green `+N` only if real heal system is enabled

## Quest/free-play regression
- Quest stage select / shell select
- NEXT / RETRY / QUEST MAP
- free-play remains separate

---

# 11. Required performance comparison

Provide a table:

| Metric | PRE-FEATURE | FEATURE COMPLETE / PRE-SMOOTHNESS | POST-SMOOTHNESS |
|---|---:|---:|---:|
| avg frame ms | | | |
| p95 frame ms | | | |
| max frame ms | | | |
| slow frames | | | |
| long tasks | | | |
| simulation avg/p95 | | | |
| chamber avg/p95 | | | |
| pickupDraw avg/p95 | | | |
| arsenalVfxDraw avg/p95 | | | |
| HUD avg/p95 | | | |
| particle peak | | | |

If a value cannot be measured in the Agent environment, mark it unavailable. Never fabricate it.

Also report the frame-interval bucket distribution.

---

# 12. Anti-false-positive gates

Tests must verify actual runtime effects, not just configuration declarations.

Examples:
- audio event must resolve to an actual final runtime buffer/file, not just a key string;
- casing landing must schedule playback on contact, not just increment a counter;
- damage popup must result from realized damage transaction, not test-only direct constructor calls;
- MISS must assert no numeric glyph transaction exists;
- persistent stain must be drawn from the persistent surface;
- rarity cache must be reused under repeated frames;
- particle optimization must demonstrate reuse/allocation behavior, not merely a pool object that is never hit.

---

# 13. Final report contract

Return concise but complete:

- fetched starting SHA
- FEATURE COMPLETE SHA
- SMOOTHNESS COMPLETE SHA
- evidence SHA if separate
- CI run URL/id/status
- headless count
- browser count
- Vite build status
- exact imported/derived asset files
- exact rifle source cut timestamps
- final weapon -> pickup cue map
- casing source mapping
- floor palette used
- blood architecture + reset behavior
- damage-number aggregation behavior
- heal integration status + exact restore values if found
- pre/feature/post performance table
- frame buckets
- proof no VFX/SFX quality was intentionally reduced
- genuine blockers only

Do not move `playtest/arsenal` in this task.

Do not touch game `main`.
