# Robot passive completion — crash-recovery checkpoint

Authority: `01_ROBOT_PASSIVE_COMPLETION_AUTHORITY_2026-09-29.md`.

Production thresholds are now `[150,300,450,600,750,900]`. The existing executor owns cumulative credited positive realized damage, reached milestones, and actual before/after cooldown refund data. Its existing A1-first/A2-second targeting and refund ladder are unchanged. Both-ready crossings emit no refund/upgrade event. The existing combat panel reads a read-only projection; it does not count damage again. LIVE BURST code and its 1.20-second silence law are unchanged.

The compact six-segment panel shows reached count, cumulative damage, next threshold and brief milestone/refund feedback. Refund display truncates to milliseconds (never claims more than removed); event data retains the exact floating-point reduction. It is Robot-only and match-owned/reset. Passive presentation deduplicates by milestone number, rather than a time window that would swallow simultaneous legitimate crossings. Events identify their owning fighter, including mirror matches. The eight audio mappings and accepted body/skill motion are unchanged.

## Focused proof

- Build: PASS (`pnpm@9.15.9 build`).
- `robot-gates-report.json`: R1–R9 plus new R10 **10/10 PASS**. R8's obsolete unresolved-threshold expectation is explicitly replaced by the now-approved production ladder. R9 retains its isolated ladder fixture. R10 adds actual clamped refunds, both-ready silence and match reset.
- `browser-proof.json`: real production Chromium and real Arsenal projectile collision/damage path. Real A1/A2 casts establish cooldowns; time elapses naturally. No HP, cooldown, milestone or HUD state injection. Actor positions/headings are arranged between controlled shots; AI and random spawns are disabled. These are controlled production-path fixtures, not free-play video.
- 150 crossing: milestone only.
- 300 crossing: A1 **0.5s** applied.
- 450 crossing: requested 1s; A1 had **0.18333333333328503s**, exactly that amount removed; HUD shows **0.183s**.
- 600 crossing: A1 ready; A2 **1.5s** applied.
- 750/900 crossings: both ready; no upgrade/refund claims.
- After 1.4 seconds of wall-clock silence: LIVE BURST null; persistent 6/6 remains.
- New match: 0/6, cumulative 0, next 150.
- Audio: exactly **6 milestone / 3 upgrade** requests and started sources; alias does not duplicate playback.
- Browser exit/navigation cleanup: runtime errors **0**.

Eight numbered screenshots show each checkpoint inside the real combat HUD. `04-clamped-refund.png` was visually inspected at normal viewport size. Reproduce using `tools/captureRobotPassiveCompletion.mjs` against a fresh production preview on port 4173; run deterministic gates with `AQ_EVIDENCE_DIR=docs/hero-rework/robot-final/passive-completion node tools/testHeroReworkRobotGates.mjs`.

Production files: `heroRegistry.js`, `heroMechanicsRuntime.js`, `heroReworkRuntime.js`, `robotPresentationRuntime.js` under `public/game/hero-rework/`; `public/game/ui/apexCombatHudRuntime.js`; `src/App.jsx`; `src/styles.css`.

This is the requested Robot crash-recovery checkpoint, not a release-final declaration. Hunter integration is a separate following phase.
