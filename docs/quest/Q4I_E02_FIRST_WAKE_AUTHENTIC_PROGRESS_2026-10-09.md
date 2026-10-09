# Q4I — WORKSHOP → FIRST WAKE E02 genuine multi-actor Story cutover

Parent: Q4H green runtime `07a553eef487a49e091dc227b7b5069f2c3e72fa`, accepted WORKSHOP persistent save, documentation head `9634f3b284c82459e3be837b7130c5cdf1d28c4c`.

Separate **BEGIN FIRST WAKE · E02** at WORKSHOP/FIRST_WAKE. This is not the existing CP04 technical preview. It invokes the native same Arsenal four-Fighter mode with its exact 2v2 roster NEWBOT 1000, T.O.T 1000, SCRAP-A 350, SCRAP-B 350. The Story Director moves WORKSHOP→FIRST_WAKE only after the native roster is instantiated, validated and active. A failed battle start never advances save. T.O.T is Gold milky-white operator, both enemy bodies use the existing V12 scout/bulwark; no fabricated enemy abilities.

Normal Arsenal alone controls movement, pickup, damage, multi-actor targeting, KO and weapon cap. Q2 firstWakeOutcome takes priority: true NEWBOT KO => RETRY regardless of T.O.T; T.O.T KO alone does NOT defeat the team; both HOSTILE physical KOs while NEWBOT survives => COMPLETE. Story result panel is created from this real outcome, not a timer or direct HP mutation. A physical Continue on genuine E02 win is needed for FIRST_WAKE→SCRAP_SWARM save. Retry exits and preserves FIRST_WAKE without any checkpoint skip.

Director verifies real four-body roster including team identity, exact original HP on start, Q2 canonical KO result and committed win status at finish, scene panel already acknowledged, no fabricated winner/reward; attempts outside E02 live story and while result panel is open are denied. Q4G preview and CP04 development 2v2 are non-saving; existing Quest REFLEX route untouched.

Acceptance: Q1 hostile-save tests, Q4E cue receipts, eight native E01, production/CP04 and Bot/Local, production build; desktop+mobile Chrome route Q4H opening and full E02 organic Arsenal 2v2 (up to 5 physical matches to allow honest retries), first-wake node save/negative proof, live clear/retry scene, and actual reload at SCRAP_SWARM. Chrome attempts may fail if actual E02 gameplay balance is insufficient — DO NOT synthesize a winning KO to green CI.

Pending: authored WORKSHOP dialogue and bespoke art, E03–E08; current Gold global responsive branch unrelated. This is a Quest developer branch, no merge or Cloudflare deployment.

## Q4I.9 — crashed-run recovery and full signed acceptance (2026-10-09)

**Runtime and Chrome-tested SHA:** `62f60fba54cce0f2a5c8ce2f34415ba08cea8f3f`
**Actions run:** https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37885711421 — **SUCCESS** on every step (pure Director, Story beat, Q2 multi-actor, real Arsenal E01/E02, FIRST WAKE and BOT/Local regression, production build, actual Chrome desktop and mobile/touch).
**Evidence artifact:** `quest-q2-real-n-actors-and-browser`, artifact ID `11596635716`; downloadable from the Actions run; ~56.8 MB of native + real browser screenshots/reports. This file is documentation only. No new gameplay or responsive/HUD changes after the tested SHA.

### Root cause and surgical repair

Q4I.8 had two failed Chrome runs. FIRST WAKE Director button invoked `__apexQuestFirstWakeStoryStart` directly after a real page reload. Unlike the existing Gold battle handoff, direct execution lacked both the loaded Gold HUD and the scoped `__APEX_QUEST_DEV`/hosted-ready authority. Result: the saved WORKSHOP panel was still visible and no Arsenal step function had been initialized. Previous Chrome click-target failure on returning Gold START was corrected in Q4I.8.

Q4I.9 now makes the Gold shell exclusively own FIRST WAKE Story entry through `launchBattleHud`. The Gold bridge recognizes `quest-first-wake-story`, loads real Hero/Arsenal runtimes and Gold battle assets, mounts the real HUD, then temporarily grants `__APEX_QUEST_DEV` ONLY inside the bridge's existing synchronous native start authorization. The Director's fallback and the post-KO Retry callback both use this same Gold-owned route; no public generic checkpoint setter was added. The mode is scoped to Quest; normal Bot/Local remain unchanged.

An additional Q4I.9d gate requires real Gold-hosted readiness and a mounted open battle HUD, alongside the exact NEWBOT/SCRAP-A/T.O.T/SCRAP-B roster (1000/350/1000/350 HP). A failing start yields an explicit RED rather than throwing an unrelated `A.step is not a function`. Q4I.9e preserves the required old-HUD-is-closed assertion but waits for the genuine asynchronous `APEX_CHAOS_BATTLE_EXIT`/Gold teardown event before reading it.

### Physically verified browser route (both desktop and mobile/touch)

1. Physical START after reload preserves WORKSHOP and reveals Gold Home.
2. Physical Continue Story, then BEGIN FIRST WAKE starts an authenticated, Gold-mounted, native FOUR-Fighter battle and commits FIRST_WAKE only after real roster construction.
3. PREMATURE `E02_FIRST_WAKE_CLEAR` Director command is refused.
4. Two actual HOSTILE Arsenal HP values reach zero, NEWBOT survives, Q2 canonical outcome is COMPLETE, the result scene is visible and normal battle rewards remain untouched.
5. Physical acknowledgement of the real result commits `SCRAP_SWARM` with exactly 10 accepted cue IDs and encounter ID E03; Gold's old battle HUD is fully closed.
6. An actual page reload restores SCRAP_SWARM, not FIRST_WAKE and not a simulated unfinished combat frame.

Accepted E02 examples from the FINAL run: desktop completed in 264 × 0.05 s steps with NEWBOT 1000 HP and T.O.T 1000 HP; mobile completed in 651 × 0.05 s steps with NEWBOT 895.875 HP and T.O.T 1000 HP. Both SCRAP-A and SCRAP-B were genuinely KO at 0 HP. No fake damage or quest rewards were injected.

### Unclosed items (do not claim false scope)

- Native NEWBOT-KO Retry is implemented as an authenticated outcome law and pure/native tests; **the final two Chrome full-playthroughs produced wins**, so do not represent them as a directly observed physical Retry on a losing E02 match.
- 360x640 and 1024x768 geometry tests are not a substitute for the owner's aesthetic sign-off or actual device touch ergonomics.
- T.O.T uses approved white Gold OPERATOR chassis. Final ROBOT PUNK RIVET art is not yet proven against original Gold source; do not silently substitute a different enemy chassis.
- This is the VERIFIED E02 cutover and E03 checkpoint, not implemented E03 combat, E03-E08 Story, final dialogue/art, or production deployment. Q4I remains on an isolated Quest branch and **is not merged or deployed**.

**Next engineering boundary:** Q5/E03 SCRAP SWARM — exactly two REAL waves (3×280 then 4×220 HP), preserve NEWBOT HP, real weapon holder cooldowns and pickups across the wave seam; Story advance only after all four wave-two hostiles have been physically KO. Avoid a generic outcome shortcut, synthetic HP or five invented enemy types.
