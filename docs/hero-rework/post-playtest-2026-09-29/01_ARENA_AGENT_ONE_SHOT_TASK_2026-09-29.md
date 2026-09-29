# APEX CHAOS — ACTIVE ARENA AGENT TASK
## Robot burst-passive correction + Hunter post-playtest completion + Hunter SFX + Chamber palettes

This task is intentionally one-shot: complete the whole pass without waiting for owner follow-up unless a true authority/file integrity blocker exists. Protect the repo with pushed checkpoints, not by doing less work.

## BRANCH / REMOTE LAW

Work only on:

`arena/01a0ead6-apex-chaos`

Recorded prepared base before this task package is committed was:

`9d160d6d846c04cdf72e34db4fbc25b66f131181`

The branch may now be one documentation/asset-preparation commit ahead of that. **Fetch remote first and use current remote branch HEAD as source of truth.** Do not trust a stale Arena workspace/local branch.

Do not merge `main` or `playtest/arsenal`. Do not create a parallel implementation branch.

If your local workspace does not exactly match the fetched remote tip, hard-reset/fast-forward the disposable local workspace to the remote branch before editing. If the remote moved for reasons unrelated to this prepared task, inspect the new commit before proceeding and report conflict only if it changes the same authority/code.

## READ IN THIS ORDER BEFORE EDITING

1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/hero-rework/post-playtest-2026-09-29/00_OWNER_POST_PLAYTEST_CORRECTION_AUTHORITY_2026-09-29.md` — **new superseding owner authority**
3. `docs/hero-rework/hunter-v1.1/02_ROBOT_HUNTER_ONE_SHOT_EXECUTION_TASK_2026-09-29.md` — historical implementation context; superseded where the new authority conflicts
4. `docs/hero-rework/robot-final/01_ROBOT_PASSIVE_COMPLETION_AUTHORITY_2026-09-29.md` — historical Robot context; cumulative law is superseded
5. `docs/hero-rework/hunter-v1.1/01_FINAL_GOLD_INTEGRATION_AUTHORITY_2026-09-29.md`
6. `docs/hero-rework/hunter-v1.1/03_GOLD_V10_SUPERSESSION_AUDIT_2026-09-29.md`
7. canonical Hunter Gold in full:
   `docs/hero-rework/hunter-v1.1/reference/HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html`
8. Hunter SFX mapping:
   `docs/hero-rework/post-playtest-2026-09-29/reference/HUNTER_SFX_README.md`
9. Hostile pre-implementation audit:
   `docs/hero-rework/post-playtest-2026-09-29/02_PRE_IMPLEMENTATION_HOSTILE_AUDIT_2026-09-29.md`
9. live production files relevant to Robot/Hunter/Chamber/audio, especially:
   - `public/game/hero-rework/heroRegistry.js`
   - `public/game/hero-rework/heroMechanicsRuntime.js`
   - `public/game/hero-rework/heroReworkRuntime.js`
   - `public/game/hero-rework/ailRuntime.js`
   - `public/game/hero-rework/hunterPresentationRuntime.js`
   - `public/game/hero-rework/hunterGoldV10.js`
   - `tools/bridgeHunterGoldV10.mjs`
   - `public/game/ui/apexCombatHudRuntime.js`
   - `public/game/modes/arsenalQuestRuntime.js`
   - `public/game/arsenal/arsenalPresentationRuntime.js`
   - `public/game/core/apexBattleAudioRuntime.js`
   - `src/App.jsx`
   - `src/game/runtimeManifest.js`

## PRE-FLIGHT INTEGRITY CHECKS

Before code edits:

- verify current remote branch HEAD and clean worktree;
- verify canonical Hunter Gold SHA-256 = `447cf549cceb955459eda4b74ef5a561c77fc2f574252783bc7921663578ae65`, bytes = `3,671,159`;
- run `node tools/materializeHunterSfxPrep.mjs`; it must read the staged exact ZIP, verify archive SHA-256 `e1aedcd48f5dc136fbf12aeb95145f87a9fc2ea2ff92ecb6bf21fe2146845014`, extract six MP3s, and verify each per-file SHA before any audio integration;
- inspect the six archive entries and extract/copy them into a sensible production Hunter audio asset path; do not rename semantics;
- confirm the live code defects called out by the new authority instead of assuming old docs are current;
- do not spend a long report on preflight: use it to prevent duplicate/obsolete implementation.

## EXECUTION PRINCIPLE

This is **not** a redesign from scratch. The reconstructed Hunter candidate already passed focused mechanics gates and has valid Gold integration. Correct the owner-observed defects surgically.

Use crash-safe checkpoints and PUSH EACH ONE before moving on. Arena workspaces are disposable; remote Git is authority.

---

# CHECKPOINT A — ROBOT PASSIVE CORRECTION

Implement the new rolling 1.2s damage-burst passive exactly from the new owner authority:

- positive realized Robot damage only;
- each new realized hit resets the gameplay deadline to now+1.2s;
- silence >=1.2s resets burst damage + milestone index;
- thresholds 150,200,250,300,350,...;
- large hit can cross multiple thresholds exactly once each;
- keep the existing refund amount ladder/slot selection semantics unless a narrower current owner authority proves otherwise;
- refund only the CURRENT remaining cooldown, never the base cooldown;
- truthful actual refund after clamp;
- remove the permanent cumulative milestone interpretation and adapt the existing side panel rather than adding a new HUD;
- simulation clock is gameplay authority; DOM/setTimeout is presentation only.

Add focused deterministic gates for window reset, deadline extension, threshold sequence, multi-cross, cooldown truth, reset/rematch.

Run focused Robot gates + build. Commit and PUSH before continuing.

Suggested commit:

`fix(robot): correct passive to rolling damage milestones`

---

# CHECKPOINT B — HUNTER WEAK / PASSIVE / A1+A2 MECHANICS

Implement the new Hunter law:

- remove old Killer Instinct projectile auto-dodge behavior completely;
- Lv1 WEAK = 1.0s;
- while WEAK, target takes x1.25 damage **from Hunter only**;
- while WEAK, target deals x0.75 outgoing damage;
- no multiplicative stacking on reapply; refresh only;
- **authoritative combatant-level WEAK state/timer**, not a one-time loop over currently living bodies; newly spawned Slime bodies automatically obey the remaining Combatant WEAK window;
- A1 real trap trigger applies ROOT 1.25 + WEAK 1.0;
- A1 expiry does not;
- A2 real swept contact remains zero direct skill damage, now applies STUN 2.0 + WEAK 1.0;
- A2 miss/timeout applies neither;
- exact-once provenance-aware damage modifiers in the central authoritative damage path;
- migrate registry/status law cleanly so old 3s/generic x1.25 and dodge config cannot remain active behind the new behavior;
- passive progression becomes a one-knob/profile selector capable of later scaling Weak duration+potency together; Lv2-Lv5 numeric production values remain unresolved.

Do not damage generic CRYSTAL/RUBBER/Stormbreaker projectile transforms when removing Hunter dodge.

Add deterministic gates proving:

- Hunter vs WEAK target x1.25 exactly once;
- non-Hunter/neutral damage not amplified by Hunter vulnerability;
- WEAK target outgoing x0.75 exactly once;
- refresh not stack;
- A1/A2 application law;
- A2 2s stun and zero direct damage;
- no old passive dodge proc;
- Slime/multi-body combatant Weak ownership.

Run focused Hunter mechanics + Robot regression + Slime owner-fix gates. Commit and PUSH.

Suggested commit:

`fix(hunter): replace dodge passive with weak control law`

---

# CHECKPOINT C — HUNTER PRESENTATION + TRAP PHYSICS + SFX

## Trap size / hit area

- final in-game trap visual = 40% of current pre-pass in-game size; current `rtScale=.43`, so `.172` is the first registration-preserving calibration anchor, then verify the measured world footprint;
- measure/calibrate gameplay trigger footprint to the new visible object;
- do not leave old `radius:46` blindly;
- do not blindly use `46*0.4` either: prove visible/physical match;
- add outside-silhouette no-trigger and inside-footprint trigger proof.

## Trap cleanup

Preserve original `public/assets/hero-rework/hunter-v10/part-10..16.png` as source/rollback.

Create cleaned derivatives safely:

- no green chroma-key;
- no hard crop that can amputate geometry;
- alpha/shape-driven mask cleanup;
- preserve high-alpha object core and anti-aliased edge;
- suppress only low-alpha fringe outside a narrowly dilated semantic core;
- if detached neighbor islands are removed, prove they are not part of the intended trap;
- browser A/B at old scale and final 40% scale;
- ARMED state must be mechanically readable but **energy-silent**: remove current periodic armed sweep/edge/pulsing slot behavior; trigger TENSION/SNAP/PIN is where energy activates.

Audit runtime `edge/glow/shadow` derivation so it does not recreate the fringe.

## Recoil

Replace runaway feedback with cast-local finite recoil trajectory:

- snapshot cast origin + movement axis;
- normalized Gold recoil progress;
- finite total retreat budget;
- apply only frame-to-frame delta of that progress;
- production collision clamps walls;
- no accumulated feedback;
- body and rendered rig aligned;
- browser tune around owner's "~one-third arena diagonal" feel, including cardinal/diagonal/near-wall cases.

## Weak visual

Recover the actual Gold `drawWeak` behavior from canonical HTML. The bridge currently strips it; change the bridge so future generation does not lose it.

Bind Gold three-point convergence/chevrons + radial stress glow to the real WEAK opponent. It must work for both A1 and A2 and use live status remaining state.

No generic substitute.

## Motion ghosts

- eliminate persistent `drawAura()` delayed blue clone;
- keep/tune `drawEchoes()` only for high-speed movement;
- slightly denser close trail;
- shorter lifetime/lag so no far-behind second Hunter;
- no passive-dodge ghost.

## SFX

Run the staged materializer first to create and hash-verify the six game-ready MP3s in the production Hunter SFX folder, then wire them exactly to semantic events from the authority. The staged ZIP is reference transport only and must never be loaded at runtime.

Critical negative tests:

- no A1 clamp sound on untriggered expiry;
- no A2 catch sound on miss;
- no double-dispatch;
- no old-session/delayed Hunter source after battle teardown.

Use the current battle-audio session registry/scheduler and preload architecture. Do not make a separate rogue audio engine.

Run browser normal-speed proof and focused performance/cache checks. Commit and PUSH.

Suggested commit:

`fix(hunter): align trap presentation recoil weak vfx and audio`

---

# CHECKPOINT D — CHAMBER PALETTES + ADAPTIVE READABILITY

Implement the owner-requested Arsenal arena color selection without changing Chamber geometry/gameplay.

- compact pre-match/hub palette selector;
- curated palette set: darker graphite, current/mid graphite reference, navy/steel, deep teal, warm oxide/brown, violet/slate;
- persist palette through the existing Arsenal meta state/sanitize path when practical (`arenaPaletteId` migration), rather than an unrelated new storage island;
- Chamber cache invalidates/builds on `(GAME_SIZE,paletteId)` or equivalent and then reuses one cached draw per frame;
- no per-frame gradients/material rebuilds.

Add one coherent actor/weapon readability profile per palette:

- based on curated luminance/chroma metadata computed/read when palette changes, not per-frame sampling;
- mild brightness/contrast/saturation + neutral keyline/drop-shadow/emissive gain only as needed;
- preserve hero/weapon hue identity;
- do not globally filter VFX/damage numbers/floor;
- apply through stable draw helpers/wrappers, not hero-by-hero hacks.

Browser matrix must include Hunter/current graphite, Hunter/darker graphite, Robot+dark weapon/darker graphite, and at least two colored palettes.

Commit and PUSH.

Suggested commit:

`feat(arsenal): add chamber palettes and adaptive readability`

---

# KNOWN BASELINE WARNINGS

Starting SHA `9d160d6...` has prior evidence of a launcher-only `smoke-robot-dash-moves-to-pickup` flake (0.20s smoke step vs ~0.26s Robot dash windup) and a headless-only Soccer Champion `image.addEventListener` load warning. If either appears, A/B against the exact prepared starting state before changing unrelated product code. Focused Robot 10/10, Slime 7/7, and Hunter 11/11 were previously green.

---

# FINAL VALIDATION / EVIDENCE

After all four production checkpoints are already remote-safe:

1. production build;
2. all new Robot deterministic gates;
3. all new Hunter mechanics gates;
4. existing Hunter charge/multiple-trap/A2 swept-contact gates updated for the new laws;
5. Robot regression suite;
6. Slime owner-fix suite;
7. launcher/browser smoke;
8. runtime errors = 0 for the target real browser run;
9. cache/performance check: no repeated root-trap material derivation and no per-frame Chamber repaint;
10. one concise 60–90s **normal-speed** owner reel covering:
   - Robot burst milestone reset + crossing;
   - Hunter A1 three charges + smaller traps;
   - outside/inside trap footprint behavior;
   - real trap trigger -> ROOT+WEAK visual/audio;
   - A1 finite recoil in at least two directions;
   - A2 retarget -> real hit -> 2s stun + WEAK visual/audio;
   - A2 miss with no fake catch sound/VFX;
   - no persistent Hunter aura clone;
   - at least 3 Chamber palettes and readability examples.

Evidence generation may be a final evidence-only commit. PUSH it.

If launcher smoke still shows an old unrelated Robot dash timing flake, do not hand-wave it: A/B against the prepared base and report whether it reproduces there. Do not mutate unrelated gameplay solely to make a flaky old smoke test green.

## FINAL REPORT

Report exactly:

- branch;
- prepared-task starting SHA;
- Robot checkpoint SHA;
- Hunter mechanics checkpoint SHA;
- Hunter presentation/audio checkpoint SHA;
- Chamber palette checkpoint SHA;
- final evidence SHA;
- final remote HEAD verification;
- exact production files changed;
- exact derived/new assets;
- gate totals/results;
- owner reel/evidence paths;
- any known failure with A/B proof;
- any deliberate Gold adaptation and why owner gameplay law required it.

Then STOP.

Do not call Hunter final or release-final. The next step is ChatGPT hostile audit + owner playtest.
