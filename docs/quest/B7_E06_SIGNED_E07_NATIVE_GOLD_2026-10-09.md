# B7 — signed E06 to real E07 Gold continuation (2026-10-09)

Base: B6n `da2d055be67af7239645c21097674134a71d6798`. The B6n companion J/K and rig passive work are preserved.

## Native authority
- E06 Director accepts `E06_OVERRIDE_BUILDUP` only after `BREACH_WAVES` truly ends in `QUEST_BREACH_WAVES_COMPLETE`, native lifecycle has exactly three waves and 10 real KO receipts, final C opponents actually have 0 HP, and the rig has an exact **six-receipt** causal history: RIG_LOCK, BREACH_CLEAR, RELAY_REPLY, NETWORK_SCAN, RIG_RETURN, OVERRIDE_BUILDUP. Gold scene must be acknowledged and closed; the Director, not the presentation, writes the checkpoint.
- Physical E07 reuses the **existing** B7e/Rivet REAL Fighter accepted damage adapter and its limits 1000 → 750 → 450 → 180. The actual boss and NEWBOT spawn with genuine 1000 HP; no heal/wound via Story and no fake HP award. Normal Arsenal projectiles are the only damage input.
- E07 Gold entrance is gated by the signed `RIVET_OVERRIDDEN` checkpoint, Gold live host and one Quest start lease. The localhost `__apexQuestRivetFixtureStart` remains a separate fixture and does not grant story.
- E07 line `Lùi lại.` is the original locked L-01 attributed to RIVET. Threshold/UI captions are system-only, not newly created character speech.
- E07 evidence accumulates in the boss native adapter; story panels are queued and presented **after** crossing from real accepted Fighter damage, in strict 750/450/180 order, then a recovery transition. Only acknowledged `E07_RECOVERY` and authentic 180 HP with full receipts can sign `TOT_LAST_CHOICE`.
- The runtime uses the same Gold HUD, Story Presentation, equipment, Fighter and input engine as E01–E06, without adding a second battle system. Canonical `tools/buildGoldCutover.mjs` uses `tools/questB7GoldShell.mjs` to reproduce the Gold shell exactly; no editing/overwriting Gold donor dimensions.

## Acceptance / limitations
- CI: `node tools/testQuestDirectorQ1Browser.mjs --verify-breach-entry --verify-breach-three-waves --verify-rivet-gold` on desktop and mobile, plus native boss+companion tests and Free Battle regressions.
- These Chrome tests still instrument a physical Fighter's position and supply a genuine native Arsenal projectile to enforce reproducibility. **Not unassisted beatability or owner visual/audio playtest.**
- E08 (Stormbreaker only once, first cap 700 / end cap 120, T.O.T voluntarily shuts down, OUTSIDE) is NOT part of this slice and is still incomplete. Do not claim Quest 01 finished.
- Global R76 runtime SHA lock remains a separate integration/cutover debt; do not relock prematurely or merge production to hide it.
