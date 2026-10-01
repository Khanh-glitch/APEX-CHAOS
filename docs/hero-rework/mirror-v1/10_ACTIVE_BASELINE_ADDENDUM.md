# MIRROR V1 — ACTIVE BASELINE ADDENDUM

Required by `09_TRANSPLANT_AND_ACTIVATION_CHECKLIST.md` section C. This file
records the **actual** parent the Mirror implementation is being built on. It
supersedes baseline-sensitive orientation facts in the preload; it does **not**
alter canonical Gold or the Gold-first mechanic lock.

## 1. Transplant identity

| Item | Value |
|---|---|
| Implementation branch | `arena/01a0f862-apex-chaos` |
| Campaign start SHA | `3f6479683418e7b71518274f9a6121a6893badbc` |
| **CHECKPOINT_A_SHA** (actual implementation parent) | **`3d450cf2d52a1c6808c4c1ee36edc84954f3d821`** |
| Preload commit cherry-picked | `618c86780ceadb2f53d6f9b49e29cceca7ddcc80` → `5bfd519` here |
| Preload commit touched | `docs/hero-rework/mirror-v1/MIRROR_V1_PRELOAD_PACKAGE.zip` only (checklist E satisfied) |
| Current runtime revision | `20261002-mirror-v1-r11` (38 versioned runtimes, gate PASS) |

### Historical SHAs inside the preload are NOT the baseline

`README_PRELOAD.md`, `04_PRELOAD_MANIFEST.json` and `03_ZERO_CONTEXT_HANDOFF.md`
reference `df3f9fbaaadef80c5c276c47dd96fc8d55857173` and
`arena/01a0f736-apex-chaos`. Those are **audit-snapshot metadata**. The live
parent is CHECKPOINT_A_SHA above. Test-matrix item **G03** is satisfied by that
SHA, not by the preload snapshot.

## 2. Canonical Gold — unchanged, re-verified on this parent

```
docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html
sha256  c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205
bytes   107480
lines   1403
```

Matches the preload manifest exactly (G00/G01/G02). **`08_GOLD_FIRST_MECHANIC_LOCK.md`
and the canonical Gold remain unchanged and fully authoritative.** Nothing in
this addendum relaxes Gold-first authority; the baseline advancing is not a
reason to reinterpret Gold.

## 3. Ordered projectile path API (chosen in Checkpoint A)

The preload assumed a single-chord projectile path. That is no longer true:
Magnet A2 produces a real cornered path within one frame. Checkpoint A
established **one** shared representation, which Mirror routing **must** consume
(this is the foundation referenced by R10/R18/R22/R23 and X01/X02).

Exported on `HR.geom`:

| Export | Contract |
|---|---|
| `pathSegments(p)` | ordered sub-segments `{x0,y0,x1,y1,t0,t1}`, travel order, **global** frame fractions. No corner ⇒ exactly one segment `p.px,p.py → p.x,p.y` with `t0=0,t1=1`, strictly equivalent to the old chord. |
| `pathPointAt(p,t)` | point on the real path at a global frame fraction |
| `pathToPointDist(p,cx,cy)` | shortest distance from a point to the real path |
| `globalT(seg,u)` | map a sub-segment-local `u` onto the global frame fraction |
| `clearPath(p)` | **terminate** path metadata — MUST be called by anything that relocates a projectile mid-frame (Mirror capture/escrow/emergence) |
| `pendingMagnetToi(p)` | the Magnet A2 boundary TOI pending this frame, or null |
| `supersedeMagnetBoundary(p,t)` | if `t` is earlier than the pending Magnet boundary, roll the Magnet entry episode back via `MAG.revokeEntry(p)` and clear the path |

**Binding rules for Mirror (Checkpoint F):**
- a node surface may capture only if intersected by a **real travelled segment**;
- capture must report a **global** frame TOI and call `supersedeMagnetBoundary`
  so a Mirror capture earlier than a Magnet boundary prevents the Magnet
  capture beat from being presented;
- on capture/escrow/emergence call `clearPath(p)` and reset `p.px/p.py` to the
  emergence point, so no phantom body/Crystal contact is tested across the
  teleport gap (R18).

## 4. Effective shipping renderer / wrapper chain (authority §4 gate)

Audited on this parent. `Fighter.prototype.draw` is wrapped, in load order:

1. `public/game/core/apexCanonicalBalance.js:1490` — base engine draw.
2. `arsenalChamberPaletteRuntime.installWrappers()` — chamber recolour /
   `actorRender` separation. (Its decorative fighter-underlay ellipse + rim
   ring were removed earlier in this branch; do not reintroduce.)
3. `hunterPresentationRuntime.js:93` — HUNTER actor + `postWorld(c)`.
4. `magnetPresentationRuntime.installDraw()` — **currently the outermost
   wrapper**. For non-Magnet it delegates once via `previous.call(this, ctx)`;
   for Magnet it draws `GOLD.drawBefore → drawActor → drawStatus → drawAfter`
   and then `renderPostWorldInterop(ctx, this)`, which preserves
   Crystala `renderWorldConstructsAndFx` + `runBloomPass` and
   Frost `renderPostWorld`.

Load order in `src/game/runtimeManifest.js` (deferred `arsenalQuest` list):
`crystalaGoldV6 → crystalGameplayRuntime → frostGameplayRuntime →
magnetGameplayRuntime → magnetGoldV1 → heroMechanicsRuntime →
heroReworkRuntime → robotPresentationRuntime → hunterGoldV10 →
hunterPresentationRuntime → crystalaPresentationRuntime → frostGoldV1 →
frostPresentationRuntime → magnetPresentationRuntime`.

**Consequence for Checkpoint G:** Mirror must NOT blindly add a fifth
`Fighter.prototype.draw` wrapper. If a wrapper is used it must be installed so
that the Magnet post-world interop chain still runs exactly once, non-Mirror
delegates exactly once, and P1 / P2 / Mirror-vs-Mirror each render exactly one
actor. Prove call order in a real browser (E05).

## 5. Magnet A2 fighter-push proof (Checkpoint A, owner defect)

The preload orientation did not know about this defect. It is fixed on this
parent and is a **protected regression** for Mirror work.

Donor law (`MAGNET_FINAL_DONOR_MAX.html` L815-817) is a radial-velocity target,
not an acceleration: `fall = clamp(1-d/225,0,1)`, `push = 1050*fall*f2`,
approached at `k = min(1, dt*10)`.

Real-browser evidence at legal spacing (75+75 collision radii forbid d<150):

| d | peak radial displacement | max external velocity | donor target | track |
|---|---|---|---|---|
| 150 | +119.4 px | 236.2 px/s | 350.0 | 0.675 |
| 170 | +90.1 px | 174.3 px/s | 256.7 | 0.679 |
| 200 | +41.6 px | 79.9 px/s | 116.7 | 0.685 |

Gates: `tools/probeMagnetA2FighterPush.mjs` (9/9) and real-browser
`a2-pushes-enemy-fighter-at-legal-spacing`.

## 6. Protected systems on this parent — do not retune for Mirror

- Magnet A2 bullet law: R=225 TOI, 0.07 s magnetic catch, immediate radial
  safety, outward ramp, tangential preservation, capture VFX, same-projectile
  identity.
- Magnet A1, wall visual rebound, fighter-underlay-circle removal, ordinary
  Magnet locomotion, floor-deformation architecture.
- Magnet A2 body push (section 5).
- The ordered projectile path contract (section 3).

## 7. Known baseline failures at CHECKPOINT_A_SHA

Reproduced at the baseline tree, **not** attributable to Mirror:

| Suite | Failure | Note |
|---|---|---|
| `testCrystalaGameplayGates` | `G07-anti-tunnelling-is-shared-geometry-not-robot-hunter-rewrites` | byte-identical at baseline incl. the same `changedProtectedFiles` list; its substantive assertions (`robotBlockIdentical`, `hunterBlockIdentical`, `sharedGeom`, `grant12000`) all pass |
| `testHeroReworkGoldens` | `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected` | pre-existing |
| `testHeroReworkRobotPresentationGates` | `P-A1-lock-dash-single-dispatch-bus`, `P-A1-dash-1-sfx`, `P-A2-auto-hits-per-hit`, `P-passive-*` | pre-existing |
| `testFrostV1Gates` | `F00.4-revision-lineage`, `F12.22-frost-battle-scale`, `F12.26-full-lifecycle-Gold-parity`, `F14.3-real-speed-history-seam-continuity` | pre-existing |
| `testHeroReworkHunterOwnerFixGates` | `runtime-cache-bust` | pre-existing |

Note `F00.4-revision-lineage` and Hunter `runtime-cache-bust` are revision-lineage
assertions and may react to the r9→r11 bumps; they were already failing at the
campaign start SHA.

## 8. Test-harness facts for this parent

- `@sparticuz/chromium` ≥ 121 no longer exports `inflate()`; harnesses tolerate
  both APIs.
- Headless swiftshader rasterises the 1280×1100 canvas ~7× slower than the
  plain software path; browser suites pass `--disable-gpu` plus rAF
  anti-throttling flags. Never measure projectile behaviour by rAF sampling —
  instrument the authoritative seam.
- Crystala's hero id is `CRYSTAL` (not `CRYSTALA`); its solid constructs come
  from **A1** (`crystal.context_construct`).

## 9. Status

Checkpoints A and B complete and durable. Checkpoints C–J (canonical Gold
harness, Gold engine port, A1/A2 gameplay, Shattered Mirrors, presentation
bridge, parity matrix, broad relock, hostile audit) are **not** implemented at
the time this addendum was written.

Automated evidence in this package is **not** owner visual acceptance.
