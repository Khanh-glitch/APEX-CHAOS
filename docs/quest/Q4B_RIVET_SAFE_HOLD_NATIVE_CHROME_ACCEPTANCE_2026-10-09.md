# Q4B — RIVET safe-hold native/browser acceptance (2026-10-09)

**Scope:** Quest 01 E01 REFLEX mechanical handoff to RIVET. Technical safe-hold accepted; **RIVET release/story transition NOT IMPLEMENTED**.

- Branch: `quest/q4b-rivet-handoff-from-q4a`; isolated from production arena/layout branch.
- Base accepted Q4A runtime: `c4003117af2d546f9a4b190d5ec7c31121a1d338`.
- Last tested Q4B runtime: `37eac446e7a6b96c01ab93a58c85e9a04e72dec3`.
- CI **SUCCESS**: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37872988896 .
- Evidence artifact: `quest-q2-real-n-actors-and-browser` ID `11591270936`, includes both `09-q4b-real-gold-rivet-hold.png` and mobile variant, plus native game and viewport JSON. Retrieve via the CI run's Artifacts section; do not guess a Cloudflare branch URL.

## Actual acceptance, no invented game progress

1. Q4A regressions remain green: real Gold click/touch route, first R1/R2 canonical PISTOL TELEGRAPH → REVEALED → floor pickup, 12 independent physical R1/R2 hits in correct direction, 12 successful J/K hero executor casts, 8 native HP<=500 runs and verified 250HP weapon-floor protection.
2. **Q4B native safe-hold**: on the next `stepSimulation` frame after actual accepted `AWAIT_RIVET`, Quest-specific simulation freezes without mutating HP, fighter coordinates, timer, pickup slots, skill cooldowns or economy. It does not complete Quest or award Story progress.
3. Both real hero J/K abilities are rejected with `quest-stage-locked` after hold. Gold's two skill cards are also visibly `LOCKED`, not deceptive READY tiles.
4. Any unresolved pre-rescue projectiles are retired harmlessly (no damage, fabricated impact or stolen equip). Preexisting particles/shockwaves and camera effects **decay visually**; no permanently suspended gunfire.
5. 8 native regression holds passed after an additional 120 x 0.05s ticks: HP, positions, game time and slots unchanged; 0 live projectiles; late J/K rejected; one attempted late direct Arsenal damage transaction returned 0.
6. **Physical Chrome desktop AND touch-mobile** started through the owner-visible Quest Gold button, played actual Arsenal simulation + genuine HeroRework J/K input to `AWAIT_RIVET`, and took `09-q4b-real-gold-rivet-hold` screenshots. Desktop hold true HP 464.5 / 496 rendered 465 / 496; mobile true HP 496 / 464.5 rendered 496 / 465. Real UI cards were disabled and LOCKED, checkpoint persisted WAKE; no fake Story completion. CI run 37872988896 succeeded all production/regression/Chrome stages.

## Out of scope / NOT accepted

- RIVET rig-bound entrance and final model/visual identity; owner-approved choreography unknown.
- ONE authentic Stormbreaker-controlled suppression release, proper physical floor/hit authority and its appropriate stun/damage outcome, safe settle/blackout, exact WORKSHOP text, actual WAKE→REFLEX→WORKSHOP→FIRST WAKE Director/save progression, and E02 linked resolution. **No synthetic projectile or made-up dialogue** is an acceptable replacement.
- Old 3v4 tablet visual hierarchy remains owner VISUAL FAIL even when responsive bounding-box tests pass; another branch owns Gold responsive re-layout. Existing T.O.T/Operator V12 art can be clipped at arena perimeter. Do not change global grid/breakpoints or claim art approved.
- No production Cloudflare deployment, merge or economy change.

## Next legitimate OWNER decision (before visual release of E01)

Recommendation for consideration, **not canon approval**: RIVET remains at the registered Stormbreaker rig (rather than joining the duel); after the frozen HP+skills threshold he triggers **one authentic Stormbreaker equipment release** that crosses the center lane and suppresses the combat **without inflicting another 446HP hit on either already-low-health friend**, preserving the existing real floor stun authority where contacted. Then a short authored blackout can enter WORKSHOP once original dialogue/art is approved. Alternative would be an actual confirmed fighter hit and the canonical Stormbreaker damage/stun; that changes E01 narrative meaning and needs explicit owner choice.

The owner needs to approve the suppression target/consequence and whether existing brown RIVET placeholder can be used for a temporary motion test, or provide a definitive RIVET identity anchor. Do not silently decide those two story/art elements and claim Quest 01 finished.

## Recovery instructions after crash

Lease-check this branch HEAD before any new GitHub write. The newest Q4B patch does not modify production arena layout or Quest 01 saving. Run Q4B workflow; preserve real viewport + natural-gun + accepted-Cast + HP hold gates. Q4A accepted base remains `c4003117`. No RIVET creation/cutover or Story save rewrite occurred in Q4B.
