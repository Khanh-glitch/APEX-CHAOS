# Quest 01 — Q1 Director Checkpoint Evidence (2026-10-08)

**State: isolated Q1 infrastructure GREEN, NOT full Quest story or playable E01.**

## Provenance
- Feature branch: `quest/q1-director-from-q0` — based on Q0 `b8a18e5540218a1800749b6afe2a9196dbac3e77`.
- Immutable playable CP04 source SHA `350b9e234a165d3626cd388be7e66ebbd8c1f91c`.
- No commit or merge into `quest/cp04-multi-actor-spike-r59` or `arena/r59-recovery-d032880`.
- Q0 authority: `docs/quest/Q0_QUEST01_CANON_IMPLEMENTATION_CONTRACT_2026-10-08.md`.
- CI run **SUCCESS** https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37787922592 ; run tested `4c9a6445beddc7b66020d5ef68fcfa3a662621c1` (before this report-only commit).
- Gold donor / 13 locked lines / E06 conflict remain owned by Q0; Q1 did not change them.

## Implementation (Q1 ONLY)
- `public/game/quest/quest01Director.js` is a side-effect-free story checkpoint authority with versioned save schema. It enumerates 11 labels/10 story groups/8 encounter references without creating fake combat or dialogue.
- Save in localStorage under `apex-chaos.quest01.progress.v1`; validates schema version, quest ID, content revision, node ID, encounter ID, phase and artifact state. Safe fallback when storage blocked/corrupted. Future save migration must be authored explicitly, not guessed.
- `public/gold/shell.html` Continue Story now invokes `APEX_QUEST01_DIRECTOR.show()` at actual **WAKE**; previous CP04 direct-to-FIRST-WAKE behavior no longer occurs automatically.
- WAKE overlay is **clearly labeled unfinished infrastructure**, not an approved cinematic/story scene. ESC/back returns Home without modifying checkpoint.
- Explicit `PLAYTEST FIRST WAKE · CP04` button still launches FOUR real canonical Fighters with same Gold transition and game engine. It does **not** mark WAKE/REFLEX/FIRST WAKE complete, so owner can still regression-playtest CP04.
- Browser singleton exposes **no** `advance`/`setCheckpoint` or completion route. The complete eleven-node walk exists only in the Node test harness, not in production UI. Q4 will connect authenticated canonical encounter/story events, not a generic skip button.
- Absolutely no combat damage, Hero Rework ability scheduler, Gold HUD geometry, gameplay art, skill kit, public unlock/economy, first-boot audio, or R59 changes.

## Proof at green CI
1. `node tools/testQuestDirectorQ1.mjs`: **16 PASS / 0 FAIL**, including adjacent-only 11-node test walk, cross-instance persisted reload, corrupted/unknown-version save rejection, storage denial fallback and no fake combat state in save.
2. `node tools/testQuestMultiActorCore.mjs`: existing Quest pure selector PASS.
3. `node tools/testArsenalBattleHeadless.mjs --product-authentic --quest-first-wake`: existing real Arsenal 2v2 and product regressions PASS.
4. `pnpm build`: PASS on GitHub runner.
5. **Physical Chrome desktop mouse** AND **Chrome 390×844 emulated mobile touch**: both PASS actual START → Continue Story → WAKE (Quest not live yet) → ESC → Continue Story resume WAKE → CP04 preview four Fighters → ESC → reload START → Continue Story resumes WAKE.
6. Browser proves `window.__APEX_QUEST_DEV` is not leaked and 1000/350/1000/350HP Quest team identities stay exact. Screenshots and structured report in the run's `quest-q1-director-browser-and-headless` artifact.

## Limitations / no false acceptance
- E01 REFLEX, WORKSHOP, E03–E08 still NOT implemented; no automatic story completion. Current overlay is developer-stage UX, not shipping visual art or screenplay.
- Save preserves only an **authored safe entry checkpoint**, not real mid-combat projectile/HP restore. All progression beyond WAKE is **test-only** until Quest Director receives genuine accepted stage/encounter completion evidence in Q4.
- Existing CP04 art fidelity, 1v1-derived crit/Heavy projection, 2/3-ally segmented HP, faction visibility and generic N-actor engine remain Q2/Q3.
- Q0's conflict RIVET at E06 rig vs three-person ally combat and missing T.O.T/RIVET A1/A2 are intentionally unresolved until Q6. Never synthesize these mechanics.
- No physical owner-device playtest in this run. Mobile Chrome is emulation. Visual acceptance must be owner review.

## Q2 handoff
- Start Q2 from latest verified Q1 green doc HEAD, **not** from a moving R59 SHA.
- Keep Quest Director frozen except for minimal event seam necessary to connect true generic multi-actor outcomes.
- Generalize actors by stable ID/team and real damage; prove 1v2,2v2,3v4; no extra copies of Arsenal engine.
- Multi-actor combat outcome must carry exact actor IDs and canon event receipt. It must **not** silently persist story progress to bypass unfinished REFLEX.
- Preserve CP04 preview and non-Quest Bot/Local existing gates. Any Chrome screenshot is evidence for behavior checked, not art approval.
