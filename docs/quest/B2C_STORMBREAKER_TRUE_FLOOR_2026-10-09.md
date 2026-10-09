# B2c E01 Story Stormbreaker floor candidate (NOT acceptance)
Base `4b34e7708e66a920e61407da70ab3113342fd9ce` is the Gold R90 + B1 + B2 transparent + B3 HUD integrated checkpoint.
Scene is only enabled after real PISTOL damage/J/K/dual HP ≤500. Then one real floor Arsenal slot `questNarrativeOnly` emits Gold Stormbreaker electric VFX for ≥3s; it is never loot or an equipped Throwable. The signed read authority is `REAL_ARSENAL_FLOOR_SPAWN`, not `aq_thrown`.
The old technicalHandoff demanded thrown projectile evidence: this is a known incompatible proof contract until the matching receipt module and adversarial test are rewritten in the next commit. Do not merge or call green until it is resolved. No Free Battle Stormbreaker changes.
