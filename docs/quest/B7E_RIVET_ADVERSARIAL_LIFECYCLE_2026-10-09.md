# B7e — RIVET isolated combat adversarial acceptance
Base: B7d `e0dcd7dc6cfa674b0500b4e64d393666ac5ead9b`, GitHub Actions run 37941836100 SUCCESS.

This branch adds adversarial **native Fighter** checks for the cases the first happy-path fixture did not cover:
1. A real NEWBOT lethal `Fighter.takeDamage` receipt results in Quest **RETRY**, never RIVET completion or Story credit.
2. Exiting a lost encounter detaches E07 accepted-damage hooks.
3. Two genuine PISTOL bullets from NEWBOT lower hostile RIVET HP, with one 750 crossing, but **abandoning** mid-fight must not produce a false victory.
4. Starting a new fixture creates a fresh 1000HP RIVET Fighter and zero previous receipts, then exits cleanly.
5. No test bypass saves `T.O.T_LAST_CHOICE`, and no Gold Quest story entry is introduced.

Owner-unapproved E06 story handoff, rig choreography and companion J/K kits remain pending. B7e is a test-only step; it is **not** E07 narrative final, not a public Quest button, and does not alter the shipped game.
