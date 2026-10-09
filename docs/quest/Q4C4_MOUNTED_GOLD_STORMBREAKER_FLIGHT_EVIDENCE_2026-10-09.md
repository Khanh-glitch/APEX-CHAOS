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


## Accepted evidence — 2026-10-09

- **Last runtime + browser harness SHA GREEN:** `52a6b009e72e351da4d8e82dd15ac37e9763d2df` (Q4C4.3).
- **CI SUCCESS:** https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37875977475
- **Artifact:** `quest-q2-real-n-actors-and-browser` ID `11592815560` (45,064,499 bytes). Retrieve it from the run's **Artifacts** section; do not invent Cloudflare preview URLs.
- **Evidence files captured:** `10-q4c-gold-real-stormbreaker-flight.png`, `10-q4c-gold-real-stormbreaker-flight-mobile.png`, `11-q4c-gold-stormbreaker-safe-settle.png`, `11-q4c-gold-stormbreaker-safe-settle-mobile.png`, and corresponding browser JSON reports.
- **Native tests:** all eight organic E01 duels crossed mandatory true R1/R2 hit + accepted J/K + both HP<=500 and kept the Q4B safe-hold invariant. Q4C4 now preserves the REAL thrown projectile's birth frame before stepping its physics. The projectile was not fabricated, the number of simultaneous rig Stormbreakers remained exactly one, and each throw reached SETTLED. Native acceptance additionally checks the actual RIVET projectile's downward velocity.
- **Physical Chrome desktop + emulated touch-mobile:** all four newly added Q4C4 gates PASS per environment: rejects release early; starts only one equipped Stormbreaker after the hold; captures the actual V9 sprite/flight stage; resolves without HP, position, timer, slot, J/K or Story progression drift. Both tested flights had `vx ≈ 0`, `vy=1350`, radius 29.26, 164px presentation long-side, three ghost samples and real loaded weapon art.
- **Production regression:** Q1 Director, CP04, Q2, Q4A, Q4B, FIRST WAKE, build, desktop Chrome and touch-mobile Chrome all PASS on the same SHA.
- **Bug actually fixed:** the pilot originally stepped newly created Stormbreaker flight in the same tick as its Arsenal holder's release, allowing immediate birth-frame retirement in stochastic duels. Q4C4.3 defers physical projectile stepping until the following tick and asserts true birth provenance; do not regress this order.

## What this does NOT prove

This is a one-shot **test-only rig preview** with noncanon coordinates and an intentionally non-damaging projectile pass. Neither the real RIVET character art nor a cinematic entrance/impact consequence/blackout/WORKSHOP script exists here; no Story checkpoint moves beyond WAKE. Chrome screenshots were captured and gate-verified, **not owner visually approved on real devices**. No production Cloudflare deploy, merge, economy change, responsive-grid change, or new dialogue.

## Crash recovery / next gated slice

The green Q4C4.3 SHA is `52a6b009`; this documentation append is evidence-only. Re-verify the current branch HEAD before any subsequent write. Preserve Q4A/Q4B golden tests, native eight-soak and both Chrome capture gates. The next legitimate scene integration needs the owner to approve suppression target/consequence and RIVET's model/entrance, then a separate E01 event completion → WORKSHOP Director/save link. Never promote this engineering preview to canonical rescue or mark Quest01 complete without those decisions.
