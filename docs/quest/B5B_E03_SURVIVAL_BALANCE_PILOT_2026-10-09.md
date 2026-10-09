# B5b — E03 advertised HP-only balance experiment (NOT canonical until actual win)

Source head from B5a; changes **only** seven physical hostile max-HP values:
- E03 wave A: 3× Scout LV1 × **120 HP** (from 280).
- E03 wave B: 3× Scout LV1 + 1× Reaver LV2 × **90 HP** (from 220).
- All enemies retain exact Scout/Reaver speed 1.2× NEWBOT, real reflected collisions, Reaver 50 contact, full 1000 NEWBOT HP, gun pool T1/T2 and 4.5s cadence. No status or HP setter in the test.
- Actual Chrome runner plays E01–E05, demands real natural KOs and 2-wave continuity with save/reload. Passing syntactic roster checks is NOT evidence of survival. Compare full 24 trials before promoting any balance.
- E03 authored weapon spawn/pickup and HUD/Gold are unchanged in this trial; this isolates enemy HP from other variables.
- **Do not merge this experimental roster into the B4b/B5a production candidate until a real full-route win exists.** Record risk of overly easy 120/90 encounter and human playtest to tune later.

## Actual first Chrome pilot diagnosis
Run 37919983637 failed **before E03**, because the legacy full-route test asserts outdated Gold visual 0.82 scaling, an outdated single-Bar HP segment assumption and pre-floor Stormbreaker projectile choreography. These contradict later owner locks; the result provides **no E03 survival evidence**. Do not loosen the test to green it. The experimental runner instead enters E03 through an actual saved/replay Quest Hub via Gold desktop/mobile input, runs 12 independently loaded physical encounters, demands wave B plus a real COMPLETE, and stores each per-attempt HP/gun-uptime/slot/rarity receipt. The legacy full-route test remains a separate modernization task, not a proxy for the HP pilot.
