# B2c E01 Story Stormbreaker floor candidate (NOT acceptance)
Base `4b34e7708e66a920e61407da70ab3113342fd9ce` is the Gold R90 + B1 + B2 transparent + B3 HUD integrated checkpoint.
Scene is only enabled after real PISTOL damage/J/K/dual HP ≤500. Then one real floor Arsenal slot `questNarrativeOnly` emits Gold Stormbreaker electric VFX for ≥3s; it is never loot or an equipped Throwable. The signed read authority is `REAL_ARSENAL_FLOOR_SPAWN`, not `aq_thrown`.
The old technicalHandoff demanded thrown projectile evidence: this is a known incompatible proof contract until the matching receipt module and adversarial test are rewritten in the next commit. Do not merge or call green until it is resolved. No Free Battle Stormbreaker changes.

## Revised signed receipt B2c
Old `aq_thrown` authority replaced by `REAL_ARSENAL_FLOOR_SPAWN`. Requires real 4 combat receipts, preserved HP/positions/frozen time, exactly one uncollectible real Arsenal T6 slot, >=3 seconds and >=10 Gold lightning frames with >0 bolts. No own HP damage or save. Unit adversarial gate validates every key bypass attempt. Pending: Chrome actual Gold frame/scene replay and replacement of old Q4 readouts that still expect thrown footage. This branch remains an isolated candidate.
