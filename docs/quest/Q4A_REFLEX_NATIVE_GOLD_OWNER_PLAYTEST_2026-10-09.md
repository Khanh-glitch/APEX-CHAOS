# Q4A — REFLEX native gameplay + Gold owner playtest checkpoint
Date: 2026-10-09
Branch: `quest/q4a-reflex-native-receipts-from-q3v`
Code HEAD tested: `8ca2495832b04db8d97140c25849151e937dcfa4`
Base Q3v visual checkpoint: `a67cb9ff48072ffe71d56bbb765985a661d63603`
CI verified success: [run 37867869014](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37867869014)
Do not merge into production arena or deploy `apex-chaos.pages.dev` without owner authorization.

## Acceptance truth — what is genuinely runnable
1. Gold Continue Story remains checkpoint **WAKE**. The owner-only **PLAYTEST REFLEX · Q4A** button starts E01 in the live Gold-hosted Arsenal engine (NEWBOT 1000HP versus T.O.T 1000HP). It never writes checkpoint progress.
2. Authored R1 and R2 PISTOL drops enter the actual Arsenal TELEGRAPH/REVEALED/pickup/equip pipeline. The pilot reaches J/K gates only on accepted REAL Arsenal PISTOL damage and the genuine HeroRework `Cast` bus, never keydown or HUD HP.
3. Unassisted engine acceptance (`--quest-reflex-real`, `q4a-organic-reflex-R1-R2-from-real-bot-pickups-no-test-bullets`) PASS: normal simulation without `fireBullet` or forced equips/positions reaches **R1 ~4s; R2 ~25s; J_CAST**. Each actual Fighter holds PISTOL during its stage. Engine HP after receipt pair [968.5,937]. Both sides stay alive.
4. Native headless test independently proves the two REAL PISTOL directions, successful NEWBOT A1/J and A2/K executor casts, real HP <=500 and `AWAIT_RIVET`. At this terminal **pilot** phase `complete=false`, `storyProgress=false`. The RIVET suppression and actual checkpoint progression are **NOT** implemented.
5. Desktop and mobile Chrome physically click Gold's REFLEX preview button, observe its authentic telegraph, verify NEWBOT/T.O.T labels and no unrelated Local control metadata, then exit cleanly while checkpoint remains WAKE. No runtime aliases are used to bypass the actual Gold mount/transition.

## RED -> GREEN evidence, not synthetic green gates
- Browser screenshot had real Fighter 1000, bridge projection 1000, but DOM 0/1000 and empty Gold fill. A browser red gate reproduced this on [run 37866215329](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37866215329). Real cause: Gold cached internal HP was initialized to 1000, equal to first genuine projection, while rail DOM started at 0 and was never rendered. `1c8c97ea` reconciles actual DOM value and fill with the live state; standalone and Shell embedded payload are byte-identical.
- Browser QA does NOT assume HP stays 1000 a second later: it checks rendered digits equal rounded live actor HP, projected HP equals actor HP, and fill scale equals the real HP ratio.
- The Q3 native PISTOL fixture had intermittent separate NPC shots during its own A.step. It now disarms unrelated prior holders through actual Arsenal `consume()` BEFORE the isolated genuine projectile, and still requires target HP loss with untouched teammates.
- An existing Frost AI tactical regression could lose its test PISTOL to automatic discharge before AI appraisal. Its real held PISTOL is held in a test-only non-discharge phase while the real Frost policy chooses `steal-frozen-gun`; the gate verifies actual holder, real AI decision and accepted cast, not a synthetic outcome.
- The earlier Robot A1 dash positional regression had an intermittent failure on an unchanged code path; no global Robot mechanics were modified or hidden. Final green run also covers this gate.

## Deliberate scope restrictions
- No Quest clone damage/physics system, no invented skills for T.O.T/RIVET, no synthetic HP awards, no Story skip, no merge/deploy.
- Q3v Gold cards remain in their original panel/cell footprints. Only Quest J/K name readability and redundant duplicate side-panel critical/heavy texts were modified. BOT/Local HUD layout remains original.
- REFLEX-specific last-resort 250HP floor was added in Arsenal weapon damage only; it is not yet a formally tested all-damage immunity guarantee. Never imply that all status/native/other damage sources are covered.
- The stage-directed training PISTOL spawns are ONLY for E01, not the normal Arsenal pool.

## Open — requires continued work / owner visual review
- **U-01**: Real Gold screenshot still shows V12 OPERATOR/T.O.T art partially clipped by canvas right edge in a desktop gameplay frame. Physics collider/muzzle and original Gold arena geometry were intentionally not altered. A separate art-to-world pose-boundary solution needs measured donor pixel extents and owner art judgement; do not silently alter model scale or body position and call it fixed.
- REFLEX has no authenticated RIVET Stormbreaker gate suppression, no finished WAKE/WORKSHOP scenes, no linked public story completion, no RIVET final art, and no full Quest 01 waves/ending. They remain Q4/Q5/Q6/Q7 work, not PASS.
- Organic R1→R2 is ~21 seconds in the sampled run; owner must judge pacing after actual play. The preview is a **testable pilot**, not a finished Quest episode.
- Q3 tablet overall visual hierarchy / potential art clipping from earlier findings remains owner-QA OPEN; no layout branch was merged.

## Owner acceptance point
Open the Quest Q4A branch preview (or run the branch's Vite product locally), choose Continue Story → **PLAYTEST REFLEX · Q4A**. Check 1) Gold HP digits; 2) R1 NEWBOT shot / R2 T.O.T shot and their pacing; 3) actual J and K presses after R2; 4) possible T.O.T clipping at arena edge; 5) Exit returns cleanly and Story stays at WAKE. This is the next meaningful owner action, not a request to run internal tests.
