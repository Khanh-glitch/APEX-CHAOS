# POST-C envelope math + semantic part-map audit

Date: 2026-09-25  
SHA context: implementation following `3a6c15b` identity overlay.

## Expected connect (full pellet/shot connect, no miss)

Authority bands: T1 13–16, T2 16–22, T3 22–28, T4 28–34, T5 35–40.

| id | tier | grammar | expected connect | band |
|---|---|---|---|---|
| PISTOL | T1 | 3×4.5 | 13.5 | ok |
| GLOCK_17 | T1 | 4×3.5 | 14.0 | ok |
| TEC_9 | T1 | 5×3.0 | 15.0 | ok |
| MAC_10 | T1 | 8×2.0 | 16.0 | ok |
| DAGGER | T1 | melee×1.5 | 13.5 | ok |
| BERETTA_93R | T2 | 6×3.0 | 18.0 | ok |
| SMG | T2 | 8×2.25 | 18.0 | ok |
| P90 | T2 | 10×1.9 | 19.0 | ok |
| Z15 family | T2 | 4×4.75 | 19.0 | ok |
| MOSSBERG_500 | T2 | 7×2.8 | 19.6 | ok |
| SABRE | T2 | melee | 18.0 | ok |
| DESERT_DEAGLE | T3 | 2×10.5 | 21.0 | slightly under T3 |
| AK_47 | T3 | 6×3.8 | 22.8 | ok |
| M16 | T3 | 6×3.6 | 21.6 | slightly under |
| MBR | T3 | 2×11 | 22.0 | edge |
| SHOTGUN | T3 | 2×6×2.0 | 24.0 | ok |
| SAWED_OFF | T3 | 10×2.45 | 24.5 | ok |
| SPEAR | T3 | melee | 22.5 | ok |
| GRENADE | T3 | blast | ~10–22 positional | special |
| MAGNUM_500 | T4 | 1×28 | 28.0 | ok |
| M249_SAW | T4 | 12×2.5 | 30.0 | ok |
| MBR2 | T4 | 2×14 | 28.0 | ok |
| SZECSEI_FUCHS | T4 | 2×15 | 30.0 | ok |
| SPIKED_CLUB | T4 | melee | 27.0 | slightly under |
| SNIPER | T5 | 1×38 | 38.0 | ok |
| JACKHAMMER | T5 | 3×5×2.4 | 36.0 | ok |
| BATTLE_AXE | T5 | melee | 39.0 | ok |

Short `bulletLife` (shotguns) is the range limiter; `triggerRange` is the attempt window so moving fighters still take the shot.

## Semantic part maps

All 24 Senko SVGs were inspected for `<g id=...>`. **Zero groups are semantically named.** Group counts are raw vector clusters, not magazine/receiver/stock.

Per authority §1: do **not** animate anonymous `<g>` nodes. Runtime uses **whole-body physical exits** (`exit` field on each identity: magDrop, cylinderSpill, breakOpen, …). Skin3 remains 0-byte (`SKIN3_ZERO_BYTE_DISCLOSURE.md`).

High-priority candidates stay whole-body until a trustworthy named map exists.
