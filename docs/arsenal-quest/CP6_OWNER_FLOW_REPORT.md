# CP6 — Owner-Flow Correction Pass Report (Playtest Round 3)

Date: 2026-09-27 · Branch: `arena/01a0e086-apex-chaos` · Pass: CP6 (follows CP5 `8a4896f` / evidence tip `85b6e33`)

## The three owner complaints and what they turned out to be

| # | Complaint | Root cause (measured, not assumed) | Fix |
|---|---|---|---|
| 1 | Battle sounds keep playing after leaving a mode / leak across transitions | Only the Arsenal AV bank (HTMLAudio pool) was session-owned. Synthesized tones (`apexBattleSfxRuntime`), the direct-to-`audioCtx.destination` fighter producers (`galaxyRuntime`, `galaxyRefinementRuntime`, `shotgunRuntime` — incl. looping pressure-walk sources), and unregistered timers survived every teardown. | Global session registry in `apexBattleAudioRuntime.js`; every producer registers; termination stops+disconnects for real, clears timers, bumps a session token so stale callbacks no-op. Menu BGM stays outside the lifecycle. |
| 2 | ARSENAL button is dead for seconds, then everything arrives at once | CP5 moved the cost to the cold Arsenal press: the route intent awaited the full `arsenalQuest` group (36 scripts) **plus** two monolithic main-thread storms — `arsenalFeelRuntime.buildTintedAtlas` (all 4 palette kinds + band canvases in one `img.onload`, +2328ms of canvas ops) and `katanaRuntime` visual warmup (frame bakes + a 1535×1024 `getImageData` blade mask in one `.then`, +3543ms / a 1078ms long task). | Hub critical-path split: the hub opens on 4 small scripts (`ARSENAL_HUB_RUNTIMES`, prefetched at warmup start); both storms are chunked (one palette kind / one asset per idle slot); match starts still ensure the full group. |
| 3 | Delayed/janky UI while background work runs | The monolithic decode/bake work above ran on the main thread in single tasks; a press during the storm waited up to 1078ms for its first paint. | Chunked warmup (`requestIdleCallback`, 200ms timeout slots) everywhere the storms lived; background warmup never preempts a route intent (priority queue); input is measured at every gate. |

## Phase 1 — before waterfalls (canonical, measured first)

Cold owner path (`tools/measureArsenalEntry.mjs`, `/tmp/entry-cold3.json`):
menu interactive 736.7ms → click → pressed paint ~2ms → **hub paint +6357ms**; long tasks at +70/161/3521(1078ms storm)/4621/4685/4847; AV warm 5606→6710 (50 clips, 1103ms) painting ~190ms after the hub; 321 images + 38 scripts fetched though the hub needs 4. Attribution via a CDP `drawImage`/`getImageData` hook (`/tmp/drawtrace.mjs`): +2328ms feel atlas build, +3543ms katana warmup — the 1078ms long task. Warm variant (9s soak, `APEX_ENTRY_DELAY_MS=9000`): press→hub 475ms — confirming CP5 traded menu speed for cold Arsenal entry.

## Phase 2 — after (same tool, same machine, final build)

| Measurement | CP5 (before) | CP6 (after) |
|---|---|---|
| Cold press→pressed paint | ~2ms | ~2ms |
| **Cold press→hub paint** | **6357ms** | **1013ms** (`arsenal-entry-cp6-cold.json`) |
| Warm press→hub paint | 475ms | **128ms** (`arsenal-entry-cp6-warm.json`) |
| Worst long task during cold entry | 1078ms (monolith) | one eval chunk (391ms this run; ≤270ms in-suite) |
| Input latency during entry window | 83ms max | 68ms cold / 9.4ms warm, **0 inputs >100ms** |

The tradeoff is removed, not relocated: the menu keeps its CP5 numbers (below), and the cold press no longer pays for the whole battle tier. The roster-atlas decode hitch is gone as a monolith — the atlas build is per-kind chunked with a bounded synchronous fallback only if a match-time draw needs a kind that has not built yet.

### What changed (owner-visible behavior)

- ARSENAL QUEST from the menu opens the **hub** (Free/Quest/Shop/Draw/Lab) immediately; the heavy match tier keeps loading behind it.
- Hub buttons open their screens on the group that screen needs (`select` for Free, `arsenalQuest` for Lab/Quest), synchronously when warm, ensured when cold — the pressed/active state paints first in both cases.
- START from the select screen and stage starts from the ladder still guarantee the full `arsenalQuest` group before the match launches.
- `APEX_ARSENAL_RUNTIME_REVISION` bumped to `20260927-cp6-owner-flow-r1` (cache-bust for every changed runtime).

## Phase 3 — global battle-audio session ownership

`apexBattleAudioRuntime.js` now owns a session registry: `window.apexRegisterBattleAudioSource(src)` (Web Audio sources + HTMLMediaElements), `window.apexBattleAudioScheduleCue(fn, ms)` (token-checked delayed cues), `window.apexBattleAudioSessionInfo()` (sessionId/active/registeredSources/pendingCues). `terminateBattleAudioPlayback` — called by every session boundary — stops and disconnects all registered sources, clears every tracked timer, and increments the token so an old-session callback is a no-op even if its timer somehow survives. Decoded AudioBuffers/caches stay reusable; menu BGM (`menu_bgm.mp3`, React-owned) is outside the lifecycle by design.

Registered/routed in this pass: `apexBattleSfxRuntime` (playTone/playNoise), `galaxyRuntime` (incl. looping pressure-walk, now routed through `battleAudioMaster`), `galaxyRefinementRuntime`, `shotgunRuntime`, plus the existing AV pool. `startSpecificMatch` (engine) and `startTamChienMode` (React chain) now begin sessions. Zero-latency-when-warm preserved for hub handlers and match starts (`__apexDeferredRuntimesReady_*` checks).

## Phase 4 — input/button/effect responsiveness

Pressed-state measurement is anchored to the real `pointerdown` event (not dispatch overhead) and to the frame that paints `.is-pressed`. During the cold entry + background warmup window the suite drives continuous pointer traffic: p95 input→paint ≈ 2–3ms, max ≤ 267ms (one script-eval chunk), zero inputs over 400ms. No spinner hides a stall — the stalls were split instead.

## Phase 5 — regression proof (all on the final build)

- Browser suite `tools/testArsenalQuestRuntime.mjs`: **211/211** (incl. all CP1–CP5 authorities, Stormbreaker correction-pass gates, and the 7 new `owner-cp6-*` gates).
- Headless suite `tools/testArsenalQuestHeadless.mjs`: **329/329**. (Pre-existing, non-fatal, out-of-scope: `soccerChampionRuntime.js` boot warning under jsdom — file unchanged since CP2.)
- Menu responsiveness `tools/measureMenuResponsiveness.mjs`: **9/9** gates. Chunking moved the warmup from 3×~400ms monoliths to 8×~140–200ms tasks (total 1141ms ≤ 1300; **new** `menu-longtask-longest-ms ≤ 250` gate, measured 201ms vs the 1078ms baseline; frame p95 16.8ms; pointerdown p95 15.6ms; only `select`+`arsenalQuest` warm — no legacy re-warming). Gate bounds recalibrated from fresh measurements, not invented.
- New owner-flow gates: entry immediacy + input liveness during warmup; session begins on enter; exit terminates everything (registered=0, pending=0, master ≤0.01, looping source stopped-for-real via `ended`, pending cue no-op); rapid re-enter gets a clean session with live SFX; engine matches begin sessions; cross-mode boundaries zero-leak; menu BGM alive at the end of the matrix.

Evidence: `docs/arsenal-quest/evidence/arsenal-entry-cp6-cold.json`, `arsenal-entry-cp6-warm.json`, `cp6-01-arsenal-hub-entry.png`, `cp6-02-post-audio-matrix-menu.png`, `test-report.json`, `menu-responsiveness-*.json`.

## Owner playtest checklist (the three exact complaints)

1. **Sounds leaking after leaving a mode** — enter an Arsenal match, throw Stormbreaker, exit to the menu mid-flight: the throw/windup sound cuts immediately. Do the same from a Classic battle and from 3-Phase Battle. Enter/exit/quickly re-enter: no ghost of the previous match's audio, new match sounds fire instantly, menu music keeps playing throughout and is still playing when you return.
2. **Dead ARSENAL button** — hard-refresh the page (cold cache equivalent), click ARSENAL QUEST the moment the menu appears: the button presses instantly and the hub opens ~1s later (was 6s+); everything else streams in behind it.
3. **Janky/delayed UI during background loading** — while the hub/match assets are still loading, move the mouse and press buttons: hover/press feedback should feel immediate; watch a damage-number-heavy fight start without a hitch when the atlas would previously have stalled.

## Explicit statement on the CP5 tradeoff

CP5 did improve the menu partly by moving expensive work to the Arsenal route intent — the before-waterfall proves it (menu interactive 737ms but cold press→hub 6357ms, with the AV warm and both decode storms inside the entry window). This pass removes the tradeoff rather than moving it again: the menu's numbers are unchanged or better (frame p95 16.8ms, pointerdown p95 15.6ms, warmup still only `arsenalQuest`+`select`), while the cold Arsenal press dropped 6357→1013ms and the warm press 475→128ms, with no input over 400ms anywhere in the window.
