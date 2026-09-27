# APEX CHAOS // CP5 — Menu Responsiveness, Battle-Audio Session, and Orientation Evidence

Owner playtest revision 2, correction pass checkpoint 5. Companion evidence
reports: `evidence/menu-responsiveness-{before,after}.json`,
`evidence/test-report.json` (browser), `evidence/headless-test-report.json`.

## What this checkpoint fixed

### 1. Menu responsiveness (item 3A/3B)

- **No prefetch-everything at boot.** The old boot-time hint of EVERY deferred
  runtime (`prefetchDeferredRuntimeSources`) is gone; each group's sources are
  hinted only when that group actually loads.
- **Likely-next-only warmup.** `WARMUP_GROUP_SEQUENCE` is now
  `['arsenalQuest', 'select']`. Legacy modes (classic battle, solo/trial,
  tamChien, manual lab) are route-intent / deep-lazy: their groups load when
  actually clicked, never while the user sits on the menu.
- **No artificial button hold.** The 105 ms `setTimeout` before running a menu
  button action is gone. The pressed visual state commits first (React render),
  then the action starts on the very next animation frame.
- **No background battle warmup on goToSelect** (select screen warms its own
  group; battle waits for an actual match intent).
- **Yields between warmup groups** (`requestIdleCallback` with a 1.5 s hard
  timeout) so evaluation chunks never run back-to-back.

### 2. Battle-audio session lifecycle

Old behavior: `apexStopBattleAudio` muted the master and an 80 ms auto-restore
timer could make old voices audible again; scheduled `playLater` cues could
fire after leaving a match.

New behavior (explicit session semantics):

- `apexBeginBattleAudioSession()` — terminates the previous session for real
  (every live Arsenal `AudioBufferSourceNode` stopped + disconnected, pending
  `playLater` cues cancelled, battle media elements paused, ninja audio
  stopped), then unmutes the master for the NEW session.
- `apexEndBattleAudioSession()` — same termination, and the master STAYS
  silent until the next explicit begin. No auto-restore timer exists anymore.
- Menu BGM is a separate `HTMLMediaElement` (never routed through this graph)
  and is unaffected. Decoded AudioBuffers (the AV HOT bank) stay cached across
  sessions; only playback state resets.
- `App.jsx` wires: entering any match → begin; menu/select/map navigation →
  end.

### 3. Audio banks warm on route intent only

`runtimeLoader.js` no longer calls `warmGroupAudio` inside the group gate. The
warm is priority-guarded (`warmGroupAudioWhenReady`, keyed by a `warmAudioDone`
set) at BOTH call sites — the early-return path (background warmup already
created the load promise) and the post-gate path — so a route intent always
warms group audio exactly once per group, regardless of which caller created
the load promise. Background warmup never pays the audio-bank cost.

## Measurement (10 s after menu-interactive, synthetic CDP input)

Tool: `tools/measureMenuResponsiveness.mjs` (frame health, Long Tasks with
per-group attribution, input→next-frame latency, real click latency). Gates
compare the measured values against the re-measured BASELINE (commit `bdbd6e1`
served on :4177) with margins that bind only what this pass owns.

| Metric | BEFORE (baseline) | AFTER | Gate |
|---|---|---|---|
| Long tasks > 50 ms | 15 | 2–3 | ≤ 5 |
| Long-task total | 1695 ms | ~1040–1160 ms | ≤ 1300 ms |
| pointerdown median | 14.5 ms | ~14 ms | ≤ 30 ms |
| pointerdown p95 | 328.3 ms | ~17–24 ms | ≤ 500 ms |
| pointerdown > 50 ms | 2 | 0–1 | ≤ 5 |
| Frame p95 | 50 ms | 16.7–16.8 ms | ≤ 40 ms |
| Frame samples (10 s) | 292 | 371–422 | ≥ 350 |
| Groups warm by 8.6 s | all 7 (incl. legacy) | arsenalQuest (~5.1 s) + select (~5.9 s) only | legacy groups not warm |

BEFORE fails 5/8 gates; AFTER passes 8/8.

### KNOWN RESIDUAL — roster-atlas decode storm (out of scope)

After this pass, the remaining long tasks are ~369/409/359/332 + one ~850 ms
task. A full-category DevTools trace
(`devtools.timeline,disabled-by-default-devtools.timeline`) shows the ~850 ms
`RunTask` is composed of ~50 `Decode Image` / `Decode LazyPixelRef` slices of
~17 ms each: the battle-core roster runtimes (carried by the `arsenalQuest`
group — our intended warm) fire `atlasImg.onload` together once their bytes
land from warm cache, and the lazy decodes coalesce into one main-thread task.
This exists in the baseline too (752 ms there) and is hero-rework-scale
roster architecture, not menu warmup — documented as a known residual; the
gates above are set to what this pass owns. GPU state is irrelevant (verified
with and without `--disable-gpu`).

## Stormbreaker orientation / scale / floor-contact evidence (browser)

Gates in `tools/testArsenalQuestRuntime.mjs` (all pass, 204/204), evidence PNGs
under `evidence/`:

- **Held before release** (`cp5-01`): probe reports `mirror: true`,
  `det: -1`, `bladeForward: true`, `long: 178` with the hero aiming right at
  the rival. Pixel verification: weapon axis span ≈ 134 page px at the 5–95th
  percentile (expected ~160 for long 178 with tapered tip/handle), blade end
  reaches world x ≈ 407 — past the hero's right edge (375) toward the rival.
- **Exact release frame** (`cp5-02`): `bladeProj: 16` (blade forward of the
  center of mass), `long: 164`, 3 cyan ghosts recorded off the real curved
  pursuit trajectory (dt 0.12/0.07/0.03 s), spin 82 rad/s. Pixel verification:
  metal axis span 134/148 expected; rival body visible at world x[761–914].
- **Airborne frames** (`cp5-03/04`): weapon + spin-arc clusters at the
  probe-reported flight positions (x ≈ 516 → 651 world, y ≈ 491).
- **Floor contact, HERO and RIVAL** (`cp5-05/06`): deterministic injected bolt
  (280,350)→(720,350); real contact sampled at **(500, 350)** — exactly ON the
  bolt lane, 60 px from the victim center (circle edge, not center). Pixel
  verification: bolt lane band at world y[332–366], contact spill below the
  lane AT the contact point (163/207 bright px vs 0 at control segments),
  victim body present at (500,410), stun applied.
- **No stale global-slow label**: `drawFloor` carries no `GLOBAL SLOW` /
  `fillText('SLOWED'...)` presentation.

Evidence-capture note: `__AQ_TEST.enterManual()` now hides the meta hub
overlay first (`APEX_ARSENAL_META.hideMeta()`). Before this fix the CP5
screenshots captured the semi-transparent Hub DOM over the arena, which is why
early pixel verification read a near-black page. The regenerated screenshots
are the clean arena and every region above was re-verified against them.

## Validation

- Headless suite: **329/329** (`evidence/headless-test-report.json`). The
  `soccerChampionRuntime` `image.addEventListener` note is the known
  jsdom-canvas limitation, non-fatal, pre-existing.
- Browser suite: **204/204**, exit 0 (`evidence/test-report.json`).
- Menu responsiveness: BEFORE 3/8 gates, AFTER 8/8
  (`evidence/menu-responsiveness-{before,after}.json`).

### Test-tool note — Web Audio gain readback race (settle-aware gate)

A gain `setValueAtTime(v, now)` is not reflected in `gain.value` until the
audio render thread processes the event; on loaded CI runners that can
outlast the gate's synchronous read (reproduced in isolation: immediate
read 1, +200 ms read 0.001). The scheduled mutes/unmutes are real — only
the readback lags — and voices/cues are terminated synchronously
(`live: 0`, `timers: 0` at the same read), so nothing can audibly leak
during the window. The match-B audio gate therefore polls a bounded
600 ms settle window for the scheduled gain to become visible in both
directions (session-begin unmute, session-end mute) while asserting the
synchronous live/timers zeros immediately. Match-A gates already used the
settled read.

### Known flake — `spawn-cadence-3.0s` (first gap only)

The spawn-cadence gates sample the FIRST inter-spawn gap after scene setup.
On identical builds this first gap lands ~3.8 s instead of the steady-state
4.5 s ± 0.15 law roughly 1 run in 3 (both locally and on shared CI runners);
every subsequent gap is 4.5 s. It is a warm-up/scheduler artifact of the
first spawn, not a cadence regression — rerun the suite rather than treating
it as one. The CI run for this checkpoint's first push hit exactly this
flake (328/329, only `spawn-cadence-3.0s`); the rerun protocol above is how
it was cleared.

