# CP6a — SEV-1 SHURI + hero name/tag truth (r14)

Owner decisions executed: D1 fix-now · D3 NEWBOT canonical.

## Changes (data tables only, no mechanics/CSS)
- `goldProductBridge.js`
  - `GOLD_SKILL_COPY.SHURI = { PASSIVE:'RECYCLE SNAP', A1:'SHOCK RECOIL', A2:'MECHANICAL GENESIS' }`
    (was missing → Pick printed literal PASSIVE/A1/A2; HUD derived 'MACHINE').
  - `GOLD_HERO_COPY.newbot.name: 'ROBOT' → 'NEWBOT'` (production id ROBOT untouched).
  - Locked six authored in `GOLD_HERO_COPY` (BLACK HOLE, MATH V2, RUBBER, TIME, SLIME, SNIPER)
    with tag `NOT YET AWAKENED`; fallback tag `LOCKED // PRE-PILOT` → `NOT YET AWAKENED`.
- `localeCatalog.js`: +5 VI pairs (RECYCLE SNAP, MECHANICAL GENESIS, BLOCK & HIT, SCRAP ENGINEER, NOT YET AWAKENED).
- Revision `20261017-shuri-rework-r13` → `20261018-content-cp6-r14` (manifest + gate + goldAssetManifest),
  cutover rebuilt (71 files, fonts restored), lock regenerated (66 runtimes).

## Live verification (desktop 1366×768, real runtime)
- Resource URLs carry `v=20261018-content-cp6-r14` (shell + bridge).
- API: newbot `NEWBOT`; black_hole `BLACK HOLE / NOT YET AWAKENED`; math_v2 `MATH V2`;
  `skillDisplay('shuri')` → [RECYCLE SNAP, SHOCK RECOIL, MECHANICAL GENESIS].
- Pick EN: chips `RECYCLE SNAP / SHOCK RECOIL / MECHANICAL GENESIS`; locked cards `BLACK HOLE`, `MATH V2`.
  (`cp6a-pick-shuri-en.png`)
- Battle HUD: tiles `SHOCK RECOIL`, `MECHANICAL GENESIS`; `.sk-name` scrollWidth == clientWidth on all
  four tiles (no overflow regression). (`cp6a-hud-shuri.png`)
- Pick VI: `TÁI CHẾ TỨC THÌ / GIẬT LÙI ĐIỆN TỪ / KHỞI NGUYÊN CƠ KHÍ`, tag `KỸ SƯ PHẾ LIỆU`.
  (`cp6a-pick-shuri-vi.png`)

## Gates
- testRuntimeRevisionGate PASS (r14/66); buildGoldCutover --check OK (71).
- testGoldRevisionIntegrityGate 18 ✓ · testLocalizationGate (310 phrases) ✓ ·
  testGoldFighterPickAdaptationGate 15 ✓ · testPickPresentationGate 15 ✓ ·
  testBattleHudLiveTruthGate 20 ✓ · testArsenalProductGraph ✓ ·
  testHomeStoryCopyAlignmentGate 17/17 ✓ · testGoldShellLoaderGate 9 ✓.
- testSkillHudTruthBrowser: first run 12/13 (one timing-family fail, line not captured),
  immediate re-run **13/13 PASS**. No CP6a code path touches cooldown truth.
