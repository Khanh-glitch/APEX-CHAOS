# CP7 — Owner-Playtest Round 4 Correction Report

Date: 2026-09-27 · Branch: `arena/01a0e086-apex-chaos` · Follows CP6 (`d34e8f8` / remote tip `e6ed0e5`)

Scope: exactly the two reported correctness bugs. No broad performance pass was performed; the only loading-architecture changes are the ones required to enforce the gameplay-ready barrier.

## BUG 1 — Arsenal gameplay could open before it was fully ready

### Exact partial-load root cause (measured first)

Cold-path reproduction (fresh page → ARSENAL the moment the menu permits → LAB the moment the hub permits), pre-fix:

| at lab open | value |
|---|---|
| AV presentation images loaded | **0 / 45** |
| AV audio decoded | 0 / 50 |
| `questGroupReady` | true |
| fighters created | `['NEWBIE','NEWBIE']` |
| `APEX_ARSENAL.state.active` | **true** |
| Lab panel mounted (33 weapon buttons) | **true** |

`startArsenalQuestMode` / `startArsenalLab` (public/game/modes/arsenalQuestRuntime.js) mount the combat shell, create fighters and mount the Lab panel unconditionally — and call `APEX_ARSENAL_AV.preload()` **at that moment**, i.e. the presentation tier's async init (45-image fetch/decode + 50-clip audio decode) only *begins* after the shell is already visible. Nothing waits for it. The arena therefore rendered broken/incomplete until loading finished — exactly what the owner saw (and why it "recovers after waiting"). A secondary hole found on the same audit: a cold Quest-stage P1 picker fell back to the classic roster screen because `openFighterPick` ran before the select group existed, and one hub handler (lab) could silently no-op when the quest tier wasn't evaluated yet.

### The fix — hard ready barrier with explicit states

- `public/game/arsenal/arsenalPresentationRuntime.js`: AV now exposes `imagesTotal()`, `imagesSettled()` (loaded+failed ≥ total) and `whenImagesReady(timeout)`; `preload({images,audio})` can be kicked selectively.
- `public/game/arsenal/arsenalQuestConfig.js` (loads with the fast hub group, so it exists before the full tier): a transition state machine + barrier —
  - `window.apexArsenalTransitionState()` → `{ state, destination, lastDurationMs, error, readiness: { 'hub-ready', 'arsenal-full-runtime-ready', 'av-images-ready', 'av-audio-ready' } }`
  - states: `idle → lab-loading | match-loading → lab-ready | match-ready`
  - `window.apexArsenalGameplayBarrier(destination)` — ensures the full `arsenalQuest` group **and** waits for image settle (audio decodes in parallel; clips no-op safely until ready — first-use audio latency is unchanged from CP6). Failure keeps the current screen and returns `false` — no half-open state.
  - `window.apexArsenalGameplayBarrierSync(destination)` — zero-latency warm path that still records the ready state (re-entry is synchronous, measured 1ms).
  - A background watcher kicks `preload({audio:false})` when the arsenalQuest group finishes loading (images only — audio warm stays route-intent-only, CP5 authority intact), so the barrier is usually already satisfied by click time.
- Gated transitions: hub **LAB** tile (arsenalMetaRuntime), select-screen **START** (arsenalShellSelectRuntime), **Quest stage** (arsenalQuestLadder), plus **openFighterPick** now ensures the select group so the real Arsenal picker (not the classic fallback) opens on a cold page. The hub itself stays fast: cold press→hub 1016ms, 0 long tasks during entry (evidence `arsenal-entry-cp7-cold.json`). While a barrier waits, the hub/map/select screen shows a "PREPARING…" badge (hosted wherever is actually visible).

Proven by the cold gates (each from a hard reload, clicking through the real UI the moment it permits): at no sample during `*-loading` do fighters exist, the AQ state activate, or the Lab panel mount; when gameplay first appears the state is `lab-ready`/`match-ready` with `arsenal-full-runtime-ready` and `av-images-ready` both true. Re-entry after returning to the hub is synchronous (1ms).

### Second bypass caught by CI (and its fix)

The first CI run of the cold suite exposed a deeper variant of the same bug class on slow machines: the pick-UI START is routed through a wrapper in `arsenalShellSelectRuntime.js` (hub group — always installed before the picker can open), but that wrapper **fell through to the classic engine's `startMatch`** when `window.startArsenalQuestMode` (defined by `modes/arsenalQuestRuntime.js`, quest group, still background-loading) was not yet available. Result on CI: a **classic match** opened with the picked fighters — combat shell live, Arsenal runtime absent (gate read `stateAtOpen:"idle"`, all Arsenal readiness probes false). Fix: while an Arsenal selection is pending, the wrapper **never** falls through — it routes through the barrier (which itself ensures the quest group that defines `startArsenalQuestMode`, then settles the presentation images) and re-opens the picker if no selection can be resolved. The cold gates were also strengthened to assert the opened match is the Arsenal one (`aqActive`), so this bypass class fails on every machine, not only slow ones.

Proof against the exact race (forced locally with CDP request interception holding the quest-group-exclusive scripts): START clicked with `startArsenalQuestMode` undefined and the quest group pending → barrier held in `match-loading` for 8.7 s → **zero** classic-match samples → opened at `match-ready` with every readiness probe true and the Arsenal state active.

## BUG 2 — one sound "loops" from match start until the first pickup

### Exact looping source and why first pickup stopped it

Instrumentation (CDP `addScriptToEvaluateOnNewDocument` hooking `AudioBufferSourceNode.start/stop`, `OscillatorNode.start`, `HTMLMediaElement.play`, `fetch`+`decodeAudioData` for buffer→URL attribution, full creation stacks) on a live NEWBIE-vs-NEWBIE match, sampled at match start/+0.5s/+1s/+3s/+8s/no-floor-weapons/before+after pickup:

- The "loop" was **`sfx/rpg/metalClick.ogg` (the AV `newbie_fail` cue) re-triggered ~10×/second** — 26 plays in the first 3 seconds, continuing for 8+ seconds with all floor weapons cleared and spawns held (i.e. indefinitely while nobody picks up). Every play's stack: `playEntry ← playAll ← cue('newbie_fail') ← avCue ← tryLaunchDash (arsenalShellSelectRuntime.js) ← NEWBIE update ← Fighter.update`.
- Why it started while both fighters were unarmed: the NEWBIE P2 **auto-cast** (`if (!isP1 && nbCd <= 0) tryLaunchDash(f)`) re-attempts its dash **every simulation tick** while no REVEALED pickup exists — and a failed activation deliberately does **not** consume the cooldown ("Activation fails (cooldown NOT consumed)"), so the retry never stops. Each failed attempt cued `newbie_fail`.
- Why the first pickup stopped it: once a gun was picked up, revealed weapons existed on the floor (spawn cadence) or the seeker was armed, so `nearestRevealedPickup()` stopped returning null and the fail path stopped firing — the machine-gun click stopped.
- AV clips cannot loop by construction (`src.start(now, offset, duration)` with an explicit duration); no `loop=true` source existed anywhere in the match. This was a re-trigger lifecycle bug, not a looping buffer.

### The fix (producer lifecycle, not muting)

`tryLaunchDash(f, opts)` — auto-cast failures are **silent** (`{ auto: true }`); the fail cue remains only for **deliberate** activation (P1's skill-gate J pulse), which is bounded by button presses. No audio path was muted; legitimate looping fighter-ability SFX (e.g. galaxy pressure-walk) are untouched. Post-fix instrumentation: **0** metalClick plays across the same timeline (evidence below); regression gate `owner-cp7-newbie-no-fail-loop`: 4s hold with no pickup → 0 fail cues, 0 active AV voices; real pickup still fires the pickup cue and equips the weapon. CP6 cross-session teardown gates all still green (217/217 includes them).

## Files changed

- `public/game/arsenal/arsenalPresentationRuntime.js` — readiness API (`imagesTotal/imagesSettled/whenImagesReady`), `preload(opts)`.
- `public/game/arsenal/arsenalQuestConfig.js` — barrier state machine, sync fast path, preparing badge, image-only background preload watcher.
- `public/game/arsenal/arsenalMetaRuntime.js` — LAB through the barrier; `openFighterPick` ensures the select group (no classic fallback on cold).
- `public/game/arsenal/arsenalShellSelectRuntime.js` — START through the barrier; BUG 2 fail-cue fix.
- `public/game/arsenal/arsenalQuestLadder.js` — stage start through the barrier (map stays visible until ready).
- `src/game/runtimeManifest.js` — runtime revision bump `20260927-cp7-barriers-r1`.
- `tools/testArsenalQuestRuntime.mjs` — 8 new `owner-cp7-*` gates (cold lab/free/quest barriers + functional lab + warm re-entry + no-fail-loop) and a settle-poll for the CP6 BGM read.
- `tools/testArsenalQuestHeadless.mjs` — declares loader group flags for the direct-load harness (its own image/audio waits unchanged).

## Evidence

- Browser suite **217/217** (includes all CP1–CP6 authorities), headless **329/329**, menu responsiveness **9/9** (longest warmup task 147ms ≤ 250 gate; frame p95 and pointerdown p95 unchanged).
- Cold entry after CP7: press→hub 1016ms, pressed 1.9ms, **0 long tasks during entry**, 0 inputs >100ms (`evidence/arsenal-entry-cp7-cold.json`).
- Screenshots: `cp7-01-cold-lab-barrier`, `cp7-02-cold-free-battle-barrier`, `cp7-03-cold-quest-stage-barrier`, `cp7-04-newbie-no-fail-loop` (+ refreshed full evidence set).

## Owner playtest checklist (two items)

1. **Half-loaded Arsenal**: hard-refresh, click ARSENAL QUEST immediately, then click LAB (or FREE → START, or QUEST → stage) the instant it permits. The hub/map shows a brief "PREPARING…" badge and only then does the Lab/battle open — complete arena, working weapon buttons, correct fighters, no broken state. Going back to the hub and re-entering must feel instant.
2. **Start-of-match "looping" sound**: start a fresh Arsenal battle with NEWBIE vs NEWBIE and pick nothing up for several seconds — the machine-gun click from match start must be gone; the first pickup still sounds normal, and weapon/ability sounds during the fight are unchanged.

## CI hardening found during final verification (all producer-level or test-side, no gate relaxations)

Chasing CI to green on the final code exposed four more real defects, each fixed at its producer:

1. **Cold START could fall through to a CLASSIC match** (the CI failure): the select-screen START wrapper fell through to the classic engine's `startMatch` when `startArsenalQuestMode` was not yet defined (quest group still warming). Fixed: while an Arsenal selection is pending the wrapper never calls the classic engine — it routes through the barrier (which loads the group and settles the images first). Proven with a forced race (CDP request hold): 8.7 s `match-loading` hold, zero classic-match samples, opened at `match-ready`.
2. **Menu BGM could stay silent forever**: the exit-to-menu resume is fire-once and the user-gesture unlock was `{once:true}` (long consumed) — a transient pause at the handoff left the menu silent for the whole session. Fixed in `App.jsx`: the resume retries briefly when no menu screen is visible yet, and the unlock re-arms on every interaction, so the next click/keypress always heals it. Proven: a post-exit pause now heals on the next pointerdown; the battle-audio session stays torn down (zero-leak intact).
3. **`av-audio-ready` lied / cp6 mid-flight gate raced the decode**: `AV.audioReady()` returns a COUNT — its truthiness was true after ONE clip decoded, so the browser suite's wait never waited and the storm cues raced the 50-clip bank (`avPlayed` 0/1/2 by luck). Fixed: new `audioSettled()` predicate (loaded+failed ≥ total), the readiness probe uses it, and the gate waits for it. `avPlayed` is now deterministic.
4. **Two headless test-side races** (no gameplay change): the forced heal spawns at a random position — when it landed near the hero's fixed parking spot the injured hero legitimately picked it up during the full-health rival's check (now parked in the opposite quadrant, worst case ~597 px vs a 117 px touch radius); and casings still airborne from earlier sections could land inside the shotgun-shell gate's window and overwrite `lastCasingLand` (now drained first). The `spawn-cadence` first-gap flake remains under the standing rerun-don't-fix instruction.

## Final acceptance state

- Final code SHA: **`2a93825f3208c0ed27c866abcbb25720858fd671`** (`fix(arsenal): CP7 r4 — audioSettled predicate…`) on `arena/01a0e086-apex-chaos`; remote fast-forward verified after each push.
- **CI GREEN on exactly that code** — run 36323363959, `stabilize` job success, zero failed steps. The workflow's own committed logs show **browser 217/217** and **headless 329/329**, with every critical gate passing on the real runner: free-battle cold `match-ready` + `aqActive:true`, cross-mode zero-leak with both BGM reads `readyState:4 paused:false`, cp6 exit-teardown with deterministic `avPlayed:3`, NEWBIE no-fail-loop with 0 fail cues and working pickup.
- Local verification of the same code: browser 217/217 **twice in a row** against the dev server (CI's own invocation), headless 329/329 (plus 4 consecutive earlier), menu 9/9 (141 ms worst warmup task), forced-race and BGM probes PASS.
- Runtime revision: `20260927-cp7-barriers-r2`.
- No Hero Rework work was started; no broad performance pass was performed.
