# CP3 (r12) — Standing ink-height standard for Fighter Pick (2026-10-18)

Revision: `20261017-shuri-rework-r12` (lock 66). Owner decision: normalize by
real ink height (measure alpha bbox, one standing height, one baseline,
system-level so future heroes self-fit). The existing R49 presentation
authority is extended, not replaced: `HERO_PRESENTATION` remains the pre-load
fallback + facing authority; effective scale is now measured at runtime.

## Measured before (slot 690×595 @1366×768, ink from alpha scan)
| hero | natural | inkH ratio | table scale | rendered ink height |
|---|---|---|---|---|
| boxe | 1086×1448 | .990 | .94 (default) | ~554px |
| crystala | 768×1024 | 1.000 | .90 | ~536px |
| hunter | 1024×768 | .958 | .62 | ~308px |
| frost | 819×1024 | .703 | 1.53 | ~640px |
| magnet | 819×1024 | .969 | .92 | ~531px |
| newbot | 819×1024 | .979 | .94 | ~548px |
| shuri | 1122×1402 | .984 | .94 (default) | ~550px |

Target chosen from the data: **0.92 × slot height** (the existing cluster /
NEWBOT anchor), baseline unified at frost's authored **groundLine 1.025**.

## Change (all inside the R49 injection in `tools/buildGoldCutover.mjs`)
- `visualInkBox(img)`: cached alpha ink box (≤192px scan, same method as the
  existing `visualBottomRatio`, which is kept).
- `normalizedHeroScale(img,p)`: scale = target ink height / measured ink
  height, width-capped at 1.12× slot width, clamped [.35, 2.2].
- `presentationFor`: `groundLine` now defaults to 1.025 for every hero.
- `applyHeroPresentation`: the load/resize sync (previously frost-only) now
  applies the normalized scale + anchored Y for every hero; initial paint
  still uses the table fallback until the image is measurable.
- Adaptation gate gained a CP3 assertion for the new law; no assertion was
  removed (hunter/frost table strings remain as fallback authority).

## Measured after (independent recompute from live DOM)
Every selectable hero: **ink height 547px = 0.920 × slot**, ink bottom at
**1.025 × slot**. Effective scales: boxe .930, crystala .920, hunter 1.104,
frost 1.308, magnet .950, newbot .940, shuri .935.
Shots: `A-hunter-after.png`, `B-frost-after.png`, `C-newbot-anchor.png`.
Mirror reuses the opponent's art + same normalization by construction.
The 6 locked/artless heroes have no standing art yet; the runtime standard
applies automatically when art lands.

## Gates
- buildGoldCutover --check: OK (71 files)
- testGoldFighterPickAdaptationGate: PASS 15 (incl. new CP3 check)
- testCoreSixArtAuthorityGate: PASS 106
- testGoldPickBandLawGate: PASS 79
- testGoldRevisionIntegrityGate: PASS 18
- testGoldBattleHudAdaptationGate: PASS 57
- testRuntimeRevisionGate: PASS (r12, 66)
- testFighterSelectPagerBrowser: PASS 29/29
