# Quest Q4C4 — Mounted Gold Stormbreaker screenshot acceptance

Starting SHA: `c80ac43d2913bb15876950391676dfef4aebf89c`. Branch: `quest/q4c4-rivet-gold-flight-proof-from-q4c3`. Never deploy/merge without owner approval.

## Purpose
Q4C.3 proved an off-roster RIVET rig can use the **real** Arsenal Stormbreaker weapon lifecycle while the canonical E01 NEWBOT/T.O.T duel is stopped. Its CI browser flow did not yet see the flight. Q4C4 adds native Chrome screenshot + state-based evidence on both desktop and emulated mobile.

## Browser gates
- The mounted Gold E01 refuses premature Stormbreaker release before its true R1/R2 + accepted J/K + two real <=500HP threshold.
- The existing organic E01 playthrough reaches and holds `AWAIT_RIVET`.
- Exactly one test-only RIVET rig `weaponApi.equip` succeeds; a duplicate call fails. Original live Fighter roster remains the two actual opponents.
- The Gold browser sees a real `aq_thrown / STORMBREAKER` projectile with RIVET owner, actual resolved weapon art and Storm V9 flight presentation. Screenshot while in flight: `10-q4c-gold-real-stormbreaker-flight*.png`.
- A resolved `SETTLED` postflight screenshot: `11-q4c-gold-stormbreaker-safe-settle*.png`; HP, position, slots, game clock, locked J/K and `WAKE` checkpoint remain unchanged. No fake hit or mission completion.

## Limits
This is **not** the approved RIVET rig, entrance animation, suppression consequence, blackout, WORKSHOP dialogue, E01 completion or a real-device artistic assessment. The literal test origin/aim marker remains noncanon; production and Gold responsive layout are untouched. Screenshots are evidence only; owner visual judgement remains open.
