# APEX CHAOS — overall runtime / recording performance pass

Date: 2026-11-07 · Branch `perf/full-battle-four-heroes-recording-20261107` · PR #126

## Scope: **keep image quality and game rules**

Continue atop existing CRYSTALA/SHURI/FROST/BOXE improvements, DO NOT rebase onto old r5, lower hero/skill/VFX asset fidelity, lower Canvas output resolution, reduce particles, reduce original source audio, alter weapon/skill collisions, or replace published itch.

### Changes across all heroes

1. **All V43 projectiles:** `public/game/arsenal/arsenalWeaponRuntime.js` — combine two per-query filter passes into one ordered array walk, preserving exact fighter list eligibility, withdrawn state, owner/team exclusions and Quest multi-actor delegated list. The old code allocated two temporary arrays in normal battles, for every target-selection call.
2. **Recording Canvas2D:** `src/game/ownerPlaytestCapture.js` — remove redundant 1080x1920 opaque black fill immediately before an opaque full-canvas tab video draw. This prevents a full extra canvas write on each recorded frame and does not lower 1080x1920 video dimensions or 22 Mbps bitrate. On native browser-region capture, skip parent `getCropRect()` layout read on each captured frame; the source is already the exact 9:16 region.
3. **Capture frame scheduling:** Prefer `HTMLVideoElement.requestVideoFrameCallback()` to a competing `requestAnimationFrame` loop, so the recorder draws only when the source tab presents a new video frame; maintain old RAF fallback if absent. Cancel the matching callback on STOP. Prevent near-30Hz callback jitter (~33.25ms) from halving submitted frames using 1ms scheduler tolerance. Retain `canvas.captureStream(0)` + frame requests where available; sound source and video pixel crop unchanged.
4. **Retain prior CRYSTALA bloom GPU-surface reuse and four-hero real render optimizations**; no art, blur intensity, effects, Gold sprite or skill semantic changes.

### Evidence

- Local JavaScript target-selection identity/ordering checks: **150 cases PASS**, including normal, Quest and atypical truthy states; same ordered combatant objects before and after.
- Node/V8 CPU microbenchmark with 24 actors (500,000 calls, after warmup): legacy double filters **~111–140ms** over 5 runs; single ordered pass **~55–59ms**. This is **not** end-to-end battle frame rate, not GPU and not encoded-video FPS. Small rosters and other JS hosts may behave differently.
- Frame-clock isolated test: ~33.25ms source cadence gives 60/60 frame submissions; 20ms interval is rejected by 30fps gate.
- Prior controlled Chromium A/B on unchanged RC5 versus Crystala surface reuse: prison p95 30.3→17.4ms and wall 25.5→14.4ms, plus four matchup alternating-order p95 regression check below +20%. See `RC5_CRYSTALA_FOUR_HERO_AB_20261107.md`.
- New regression files: `tools/testV43EnemyQueryPerformance.mjs` (production-function extraction; same order/eligibility), `tools/testOwnerRecordingCodecSelection.mjs` (new source clock and jitter), `tools/testOwnerRecordingOpaqueFrameParity.mjs` (Chromium pixel-identical check for opaque source draw).
- The new CI acceptance workflow additionally requires real packaged itch nested-path boot, real desktop and phone BOT battle, sample 1080x1920 recorded video decode, and Gold skill semantic tests.

### Current blocker — NOT READY for owner release

New GitHub Actions runs (e.g. [42377015916](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/42377015916)) terminate before steps begin: `runner_id=0`, zero actual steps, **0 billable runner ms**. All workflows on this commit fail in ~4s, which is *an infrastructure / runner allocation failure*, not a code-test result. Job logs are unavailable. The underlying GitHub billing / runner availability cause is **not confirmed**.

The sandbox Chromium headless also could not complete a local pixel test; do not assert browser pixel parity PASSED. A local equivalent of the enemy-query and source-frame timing logic passed, but the exact repository's full runtime and recording build were **not CI-verified** after these changes.

**Decision:** Keep everything in Draft PR #126 and do not distribute an untested ZIP, merge, replace public itch or claim an FPS increase on the owner's laptop. Resume the existing gate when runner allocation is restored; review the exact source artifact then require one whole-game recording ON/OFF session as the final physical-GPU check.
