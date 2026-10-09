# Quest 01 — B8 E08 Native Last Choice to OUTSIDE
Verified integration scope · 2026-10-10

Base: B7 `16d3ab63e37aed3597e5f7deefb5cf46ee3f04f5` (CI [37960687593](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37960687593): 3/3 PASS).

## Causal contract
- E08 route only after B7's signed real RIVET 180-HP survival and checkpoint `TOT_LAST_CHOICE`.
- One original NEWBOT, one original hostile T.O.T Fighter, each with 1000 native HP.
- T.O.T receives native damage only to 700 HP; Stormbreaker T6 becomes eligible **once**. E08's authorized floor slot reveals, is physically picked up by T.O.T, and uses Arsenal's actual held weapon and `aq_thrown` projectile. No T6 spawn entitlement elsewhere in Quest or ordinary Arsenal.
- Native accepted-damage callback for NEWBOT signs the verified Storm **hit** only on real `Fighter.takeDamage` with the actual T.O.T as source, canonical `arsenal-stormbreaker` label, and the same live flight projectile, artifact ID and owner; the projectile's hit callback is idempotent. Actual missed projectiles use the physical tumble/exit authority. Both results are accounted against exactly one artifact and a non-pickable cradle return.
- Following the Storm resolution, T.O.T receives normal accepted damage down to **120 HP**, but cannot be KO'd as an ending shortcut. A loss by NEWBOT is RETRY.
- The 12 owner-locked L02–L13 lines are rendered verbatim in strict order. `OUTSIDE` signs only after the true physical 120-HP completion, sealed Storm lifecycle, the actual last voluntary spoken choice, and complete non-skipped story acknowledgments. The ending does not kill RIVET or T.O.T through a fake HP write.
- Gold generator + manifest SHA-256 remain authoritative; original HUD layout and Core Six art/motion were not redesigned.

## Verification / residual acceptance
- [B8 CI full run](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37966561066): native, desktop and mobile 3/3 PASS for 700→single Storm→120→L02–L13→OUTSIDE→save/reload.
- B8 final cleanup SHA and CI are the gating evidence for integration; previous green runs do **not** certify later commits.
- Chrome is instrumented for deterministic Fighter positions, genuine native bullets and non-automated chapter navigation. It does **not** prove unassisted difficulty, handheld touch ergonomics, artistic timing, sound quality or tablet appearance.
- `Arsenal Product Acceptance` has separately observed intermittent baseline guns/blood tests even on B7 parent; these are not waived by the B8 Quest gates.
- PR #18 is draft, based on B7 PR #17. No merge/deploy without user acceptance and coordination with responsive Gold branches; R76 runtime cache revision/cutover debt must be reconciled before production.
