# B6a — E06 BREACH WAVES owner-aligned production contract

Imported the previously tested pure Q6 module into B5a's real Responsive + Quest lineage, with owner 2026-10-09 species law. A=3 Scouts LV1, B=2 Scouts+1 Reaver+1 Sentinel, C=Scout+Reaver+Sentinel, fixed HP A300/B260/C320. No generic Bulwark hostile; RIVET alone uses Iron Bulwark visual.

ALLIES NEWBOT/T.O.T/RIVET (1000 HP each); at or below provisional 100 HP each voluntarily withdraws rather than dying; no automatic HP/cooldown reset between waves; J/K priorities NEWBOT then T.O.T then RIVET.

Pure `authorizedRetreatImpact` computes how much REAL damage can reach the threshold before the withdraw event, without writing HP or manufacturing healing. It MUST be invoked by the native damage authority **before** Fighter death and is not yet connected in this commit.

Original unresolved X-01: RIVET currently operates the rig. No unapproved autonomous-rig combat or hidden teleport. This contract is not playable until actual Gold/Fighter integration and visible rig-lock-to-frontline beat. E07–E08 unresolved ally kit content likewise cannot be fabricated.
