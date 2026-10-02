# MIRROR V1 — CAMPAIGN STATUS AND HANDOFF

Honest status of the Mirror V1 active campaign. **Checkpoints A, B and C are
complete and durable on the remote. Checkpoints D through J are NOT
implemented.** This document states exactly what exists, what was proven, and
what the next session must do.

Automated evidence here is **not** owner visual acceptance.

## 1. Checkpoint SHAs

| Checkpoint | SHA | Status |
|---|---|---|
| START | `3f6479683418e7b71518274f9a6121a6893badbc` | verified = remote at start |
| **A** — ordered path + Magnet A2 fighter push | `3d450cf2d52a1c6808c4c1ee36edc84954f3d821` | complete, pushed |
| **B** — preload transplant + activation | `2c830a995fd32127fce00d3e4fad4249eaaf7575` | complete, pushed |
| **C** — executable Gold 12 reference | `bbe0bd504790a7a508aec325b172d7bd7e21edd6` | complete, pushed |
| **A-R** — ordered event supersession | `109560e2a2dfe5edb7e35f39dbd65d19adbb86e3` | complete, pushed |
| **C-R** — Gold visual + lifecycle oracle | `43790bbde050c347011a009c35f6d96af89a7c09` | complete, pushed |
| **D1** — static/material Gold bridge (26 assets byte-identical) | `f92f2b3815642cfa576c7d42502949c05ecfc429` | complete, pushed |
| **H-PHYS** — Hunter resolved physical contact | `5c98e2d996d8571ea9d10090fbbe4e19c9185a5e` | complete, pushed |
| H-PHYS2 calibration | `9e7801e203deccc7825131b9481239ad4d5d8337` | complete, pushed |
| H-PHYS2 W1 projectile field | `facb5b3dd9f3ae46c7c3323180db530e5d78b229` | complete, pushed |
| H-PHYS2 W2 body + floor gun | `83954d3848a9eed2562a1bbd5c8dac372ea08172` | complete, pushed |
| **H-PHYS2** — W3-W7 + relock | **`43bfcaf51ec5b65ef407dbf838bdb0d1e25c653a`** | complete, pushed |
| **D2** — temporal history + locomotion | **`09e25ed55a7db4d1c2fb48fa02370edc74544a1b`** | complete, pushed |
| D3 — A1/A2 Gold choreography | — | in progress |
| D4 — passive shard/node/routing visual engine | — | not started |
| E — A1 + A2 gameplay (replaces scaffold) | — | not started |
| F1/F2/F3 — shards, routing, cross-hero matrix | — | not started |
| G — shipping presentation bridge | — | not started |
| H — real visual parity | — | not started |
| I — broad regression + final relock | — | not started |
| J — final hostile audit | — | not started |

Branch: `arena/01a0f862-apex-chaos`.
Runtime revision at D2: **`20261002-mirror-v1-r17`** (38 versioned runtimes).
Re-measure rather than trusting this number if HEAD has advanced.

> **STALE-AUTHORITY WARNINGS for any zero-context reader.**
> * Checkpoint rows above that once read "not started" for D-J were stale; the
>   campaign has reached **D2**.
> * Any sentence in this file claiming runtime revision **r11** is stale.
> * Any sentence describing Magnet's A2 body law as a **linear radial-speed
>   target** with `bodyAcceleration 2200` / `bodyRadialSpeedCap 650` is
>   **SUPERSEDED by H-PHYS2**. The current law is one shared continuous field
>   `S(d) = (R/max(d,dSafe))^2 - 1` inside `R = 225` with coupling `K = 73700`.
>   `3500` is an owner-facing calibration anchor only — never a runtime branch
>   and never a speed cap.
> * Mirror node concurrency is **3**, enforced by the per-owner 16-shard /
>   5-per-node economy. There is **no** fourth-node / oldest-retirement
>   mechanic; see the SUPERSEDED notes in `07_` and `08_`.
> * `mirrorGoldV1.js` is intentionally **not yet manifest-registered**;
>   registration is Checkpoint G.

## 2. What Checkpoint A delivered

### A1-A3 One authoritative ordered projectile path
`HR.geom.pathSegments(p)` is the single shared representation: ordered
sub-segments `{x0,y0,x1,y1,t0,t1}` in travel order with **global** frame
fractions. A frame with no corner returns exactly one segment, strictly
equivalent to the previous `p.px,p.py → p.x,p.y` chord.

Consumers corrected to use it: walls, bodies, **Crystala** (`shardToiSeg`
evaluates the moving gem over the same global sub-interval; capsules swept per
leg; contact point interpolated on the real leg) and the **Mirror portal seam**
(surface must be intersected by a real travelled segment; emits a global TOI;
calls `clearPath` after relocation).

Physical ordering is adjudicated, not detected after the fact:
`supersedeMagnetBoundary(p, t)` → `MAG.revokeEntry(p)` rolls the A2 entry
episode back and **withdraws the capture beat** so presentation never shows a
catch that did not physically occur.

### A5 Magnet A2 fighter push — owner defect fixed
Root cause: production used `bodyAcceleration * u * u` — the same non-donor
quadratic falloff already removed from the bullet law, applied as an
acceleration. Across the only legal spacing (d ≥ 150) `u*u` never exceeded
0.111. Donor (`MAGNET_FINAL_DONOR_MAX.html` L815-817) is a radial **velocity
target** with a **linear** falloff: `push = 1050*fall*f2`, approached at
`k = min(1, dt*10)`.

Real-browser evidence at legal spacing:

| d | peak displacement | max external velocity | donor target | track |
|---|---|---|---|---|
| 150 | +119.4 px | 236.2 px/s | 350.0 | 0.675 |
| 170 | +90.1 px | 174.3 px/s | 256.7 | 0.679 |
| 200 | +41.6 px | 79.9 px/s | 116.7 | 0.685 |

Radius 225, duration 1.80, `bodyAcceleration` 2200, `bodyRadialSpeedCap` 650,
collision/wall authority and T6 pushability all preserved. The donor `f2` ramp
was deliberately not adopted (defect is magnitude, not onset).

## 3. What Checkpoint C delivered — canonical Gold facts

`tools/testMirrorGoldHarness.mjs` executes the canonical HTML directly,
24/24 gates. Evidence: `evidence/gold12-canonical-trace.json`.

```
engine   STEP 1/120, 120 Hz, max 12 substeps, HN=64 HS=22 (hist 1408)
plates   UL .095 shameless | UR .115 observer | LL .145 stale | LR .17 wrong
node     NV [[-5,-60],[28,-27],[20,28],[0,62],[-28,31]]
         route surface = vertex 0 -> vertex 3; 16 shards, 5/node => max 3 concurrent
A1       A1TS 1.6; OWN edge step 112 = 0.93333 s (u .58333, nominal .928)
         visual end 1.475 s (nominal 1.472); whiff never produces a copy
A2       A2TS 1.0; snap edge step 31 = 0.25833 s; exchange observed at the
         same step; exact-coordinate exchange (< 1e-6)
passive  formation start -> ACTIVE = 1.2000 s exactly
         node takes a lifecycle slot at 0.9083 s, confirming the >.7 s free
         shard age gate plus the .3 s scan cadence
history  10 populated channels after motion
```

Determinism is imposed from outside the canonical file (seeded `Math.random`
via `evaluateOnNewDocument`, neutralised `requestAnimationFrame`). The Gold
file is byte-identical: sha256
`c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205`,
107480 bytes, 1403 lines.

## 4. Test state at this SHA

All green:

| Suite | Result |
|---|---|
| `testOrderedProjectilePath` | 14/14 |
| `testMirrorGoldHarness` | 24/24 |
| `probeMagnetA2FighterPush` | 9/9 |
| `probeMagnetA2BulletRepel` | PASS |
| `testMagnetV1RealBrowser` | 22/22 (incl. new `a2-pushes-enemy-fighter-at-legal-spacing`) |
| `testMagnetCanonicalGoldParity` | PASS |
| `testMagnetV1GameplayGates` | 27/27 |
| `testMagnetV1PresentationGates` | 13/13 |
| `testMagnetV1PresentationSemantics` | PASS |
| `testMagnetMotionAuthorityGates` | PASS |
| `testMagnetGoldMotionTrace` | PASS |
| `testMagnetV1SchedulerParity` | PASS |
| `testChamberPaletteGates` | 15/15 |
| `testHeroReworkLocomotionGates` | 4/4 |
| `testHeroReworkRobotGates` | 11/11 |
| `testHeroReworkSlimeGates` | 9/9 |
| `testRuntimeRevisionGate` | PASS (r11, 38 runtimes) |
| `pnpm build` | PASS |

Pre-existing failures, reproduced at the baseline tree and **not** caused by
this work — see `10_ACTIVE_BASELINE_ADDENDUM.md` §7:
Crystala `G07`, Hero-Rework goldens (2), Robot presentation (4), Frost (4),
Hunter `runtime-cache-bust`.

## 5. Why D-J were not attempted

Checkpoint D alone is a port of a 1403-line canonical presentation engine
(actor raster/material construction, split identity, false reflections with
unequal delays, 64-sample history, A1 state machine, A2 identity-exchange
choreography, shard/node visual language). E, F and G add real gameplay truth,
escrow routing and a renderer-chain bridge; H is a 29-scenario real-browser
matrix.

Starting that work without finishing it would have produced exactly the failure
mode `07_PRELOAD_HOSTILE_AUDIT.md` and `06_PROCESS_LESSONS` warn about: a
half-ported Gold with generic substitutes standing in for unported effects,
unverified against the canonical trace. The campaign's own law — *"do not
continue while knowingly red"* and *"never accumulate completed slices without
pushing"* — is better served by three fully proven, durable checkpoints than by
a large unverified Mirror tree.

Nothing speculative was left in the tree. The working tree is clean and every
suite above is green.

## 6. Next session should start here

1. Verify remote `arena/01a0f862-apex-chaos` == `bbe0bd504790a7a508aec325b172d7bd7e21edd6`.
2. Read `10_ACTIVE_BASELINE_ADDENDUM.md` first — it carries the real baseline,
   the ordered-path API contract Mirror routing must use, and the audited
   renderer chain for the Checkpoint G wrapper gate.
3. Re-run `tools/testMirrorGoldHarness.mjs` (needs a static server rooted at
   the repo root; set `APEX_GOLD_URL`, default `http://127.0.0.1:4200`) to
   regenerate the canonical trace, then build `mirrorGoldV1.js` against
   `evidence/gold12-canonical-trace.json` — never against a reconstruction.
4. Proceed D → E → F → G → H → I → J, pushing after each.

Binding constraints that still apply: Gold 12 is absolute visual authority; no
generic portal circles / rune rings / crystal-loot shards; do not retune the
accepted Magnet A2 bullet catch-release law, A1, wall rebound, the
fighter-underlay-circle removal, or the Checkpoint A ordered-path contract and
A2 body push.
