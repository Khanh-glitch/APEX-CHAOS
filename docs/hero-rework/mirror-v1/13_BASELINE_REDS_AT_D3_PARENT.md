# BASELINE RED TESTS — measured at the exact D3 parent

**Parent SHA (`CHECKPOINT_D3_PARENT_SHA`):** `09e25ed55a7db4d1c2fb48fa02370edc74544a1b`
**Runtime revision:** `20261002-mirror-v1-r17` (38 versioned runtimes)
**Measured:** freshly re-run on this exact SHA, not quoted from any earlier doc.

These 18 reds are **pre-existing at this parent**. A later Mirror checkpoint may
inherit them unchanged, but may **not** add to them and may **not** weaken any
gate to turn one green. Any red not on this list is a NEW regression.

## Green at parent (no reds)

```
testMirrorGoldHarness             24/24     testMagnetV1PresentationGates     13/13
testMirrorGoldVisualOracle        14/14     testMagnetV1PresentationSemantics  PASS
testMirrorGoldD1Raster            23/23     testMagnetMotionAuthorityGates     PASS
testOrderedProjectilePath         15/15     testMagnetV1SchedulerParity        PASS
testOrderedEventSupersession      12/12     testHeroReworkLocomotionGates      4/4
testMagnetV1GameplayGates         27/27     testHeroReworkRobotGates           11/11
testMagnetA2ContinuousField       26/26     testHeroReworkSlimeGates           9/9
testHunterPouncePhysicalContact   19/19     testHeroReworkSlimeKitGates        5/5
testChamberPaletteGates           15/15
```

## Pre-existing reds (18 total)

### `testHeroReworkRobotPresentationGates` — 18/28, **10 reds**
```
P-A1-dash-1-sfx                      P-passive-null-0-milestone
P-A1-lock-dash-single-dispatch-bus   P-passive-null-0-sfx
P-A2-auto-hits-per-hit               P-passive-null-0-upgrade
P-passive-milestone-2-bus            P-passive-upgrade-1-bus-test-threshold
P-passive-milestone-2-sfx            P-passive-upgrade-1-sfx
```
Note: an earlier handoff recorded "4" here. That was stale — measured count is
**10**, confirmed previously by stashing to the parent tree and re-running.

### `testHeroReworkGoldens` — 9/11, **2 reds**
```
golden-crystal-reflect-ice-payload
golden-rubber-stores-reflected
```

### `testFrostV1Gates` — 162/166, **4 reds**
```
F00.4-revision-lineage                 (reacts to any revision bump)
F12.22-frost-battle-scale
F12.26-full-lifecycle-Gold-parity
F14.3-real-speed-history-seam-continuity
```

### `testCrystalaGameplayGates` — 72/73, **1 red**
```
G07-anti-tunnelling-is-shared-geometry-not-robot-hunter-rewrites
```
Already red before this campaign (`changedProtectedFiles`). It additionally
reports `hunterBlockIdentical:false` since the owner-directed H-PHYS change
legitimately edits the Hunter mechanic block. Its intent still holds
(`sharedGeom:true`, `robotBlockIdentical:true`, no tunnelling geometry added
to Hunter). **Not weakened** — its Hunter byte-identity proxy needs authority
re-baselining.

### `testHeroReworkHunterOwnerFixGates` — 10/11, **1 red**
```
runtime-cache-bust    (revision-lineage gate; reacts to any revision bump)
```
