# HUNTER FINAL GOLD INTEGRATION AUTHORITY — 2026-09-29

Status: OWNER-APPROVED GOLD PRESENTATION + GAMEPLAY V1.1 integration authority.

## Required source file

Owner gold HTML filename:
`HUNTER_ALT_FINAL_V9_ROOT_TRAP_SAFE_P(1).html`

Exact owner-source properties:
- SHA-256: `c8cde28f346bbbd99de0c448ccfb396eae210e4928436850ef82b488d765fc88`
- bytes: 3,664,135
- file lines: 3,176 newline-delimited lines / 3,177 logical lines

The Arena task must receive this exact HTML as an attachment/source and verify the SHA-256 before implementation.

The HTML identifies itself as:
`HUNTER FINAL V9 ROOT TRAP`

Its visible skill grammar includes:
- A2: `read -> coil -> snap -> correct -> catch`
- A1: `deploy -> unfold -> snap -> pin -> release`
- Passive: `incoming shot -> foreleg slip`

Do not substitute an older Hunter prototype.

## Gameplay authority

Read:
`docs/hero-rework/hunter-v1.1/00_GAMEPLAY_CHECKPOINT_2026-09-29.md`

That checkpoint supersedes old Hunter gameplay where conflicting.

### A1 SNARE

- max charges 3
- starts 3/3
- recharge 6.5s per charge
- recharge sequentially
- max active traps 3
- trap trigger radius 46
- lifetime 6.0s
- root duration 1.25s

Three charges mean three available casts; they do NOT authorize skipping/compressing the gold body-placement choreography. A subsequent cast may occur when the signature cast animation is ready under normal ability-control rules.

Each active production trap must own an independent copy of the gold trap presentation/lifecycle. Do not visually collapse three logical traps into one shared mutable trap state.

### A2 POUNCE

- cooldown 12s
- coil/wind-up 0.16s
- physical chase speed target ~2200 px/s
- max chase 0.50s
- continuously re-target/steer toward current opponent position
- swept body contact to prevent high-speed tunneling
- no teleport
- direct damage 0
- successful contact -> WEAK 3.0s
- WEAK incoming damage multiplier 1.25

Normal movement should be meaningfully chaseable. Exceptional relocation can still escape.

### PASSIVE KILLER INSTINCT

Enabled while opponent is Trapped OR Weak.

- eligible incoming projectile collision course only
- dodge chance 24%
- physical dodge distance 95
- anti-chain lockout 0.45s
- no invisibility
- no post-dodge invulnerability
- T6 excluded

## HARD presentation authority — what the HTML owns

The HTML is the golden master for what the player can perceive.

Preserve as faithfully as technically possible:

- Hunter silhouette and material identity;
- head/body/arm/scythe articulation;
- idle motion;
- anticipation and recovery;
- A1 body deploy motion;
- A1 authored post-plant snap/retreat/recover motion;
- trap unfolding, root-like mechanical tension, snap, pin, hold/release language;
- A2 read/coil/snap/correction/catch choreography;
- visual timing and rhythm;
- distortion/refractive language where safe;
- particles, dust, sparks, glints, ribbons and contact language;
- passive foreleg-slip presentation;
- prey/WEAK/snared visual treatment where applicable;
- authored relative scale/hierarchy;
- hit-stop / dilation / camera handshake translated into APEX without taking over global camera authority.

For A1 specifically: do NOT invent new recoil duration, distance or easing. Follow the gold HTML implementation. The source itself owns those values.

For A2: production gameplay now continuously chases under the hood. Preserve the gold visible `read -> coil -> snap -> correct -> catch` presentation, including a readable correction beat, while world-path steering follows gameplay authority. Do not revert mechanics to the old one-vector or one-correction-only miss behavior merely to copy demo plumbing.

## SOFT adaptation authority — what APEX owns

Allowed to adapt only as necessary:

- world/local coordinate conversion;
- opponent and projectile source data;
- current movement vector mapping;
- swept collision implementation;
- wall/arena/body collision;
- multiple active trap ownership;
- ability-controller charge/recharge state;
- status storage;
- event routing;
- audio routing;
- render caching / DPR / performance implementation;
- teardown and lifecycle;
- camera integration so existing APEX camera remains authoritative;
- replacing demo prey/fake projectile with real opponent/projectile truth.

These adaptations must preserve the visible gold output rather than redesign it.

## Forbidden shortcuts

Do not:
- replace Hunter with generic particles/shapes while leaving the gold rig unused;
- approximate the A1 snap-back with a generic reverse velocity if it visibly differs from gold;
- lock A2 to one initial heading;
- teleport A2;
- make a single mutable trap represent all three charges;
- invent new visual timing because production gameplay numbers differ;
- use demo prey/fake bullets as production truth;
- rotate/redesign the entire actor based on convenience;
- weaken APEX locomotion globally to make the prototype fit;
- remove gold details solely to pass performance without first proving a bottleneck.

## Evidence requirement

Real-browser production evidence must include at minimum:

1. idle + normal locomotion;
2. A1 full body deploy -> plant -> authored snap/recover;
3. three separate A1 trap placements visible/owned independently;
4. one trap root on real opponent body;
5. trap expiry/release cleanup;
6. A2 coil -> high-speed continuous chase -> real body contact;
7. A2 target changes direction during chase and Hunter follows;
8. A2 WEAK applied with zero direct skill damage;
9. passive projectile collision-course dodge while prey is Trapped/Weak;
10. passive does not trigger when prey state is absent;
11. T6 exclusion;
12. interaction with real Arsenal weapon/projectile environment;
13. no runtime errors / leaks after repeated skill use.

This is a gold-port task, not a new art-direction task.
