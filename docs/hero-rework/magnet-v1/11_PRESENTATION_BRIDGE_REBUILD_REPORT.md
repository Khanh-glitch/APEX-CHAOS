# MAGNET V1 — PRESENTATION BRIDGE REBUILD REPORT

Date: 2026-10-01  
Session branch: `arena/01a0f736-apex-chaos`  
Frozen preload tip: `0897108387b29bc8332c5f23994dd8f5b4859890`  
Rejected-bridge recovery point: `4403c57c2620a6d32ce48442de0d92224f4f4594`  
Validated implementation/evidence tip before this report: `d409c7dd9250441ea471a6c35ffef5b2d4a4bdbb`  
Runtime revision: `20261001-magnet-v1-r2`

The final branch tip is the commit containing this report. The closing agent response records and remotely verifies its exact SHA.

## 1. Authority and source proof

- Gameplay authority remained `00_MAGNET_IMPLEMENTATION_AUTHORITY.md`.
- Visual/motion authority remained only `gold/MAGNET_FINAL_DONOR_MAX.html`.
- Canonical Gold proof: **3,095,049 bytes**, **1,242 lines**, SHA-256 `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`.
- The required hostile pre-code audit is `10_PRESENTATION_BRIDGE_REBUILD_AUDIT.md`.
- `5411906...`, the immutable preload tip, and recovery point `4403c57...` are all ancestors of the final work.
- No Magnet gameplay authority, hero registry, or Mirror gameplay file changed in this rebuild. The provisionally accepted gameplay implementation at `4403c57...` was retained.

## 2. Rebuilt architecture

### One production presentation clock

`heroReworkRuntime.js` now captures Magnet's pre-movement root in `hrPreTick(dt)` and advances Magnet presentation once in `hrPostTick(dt)`. Both `APEX_ARSENAL.step` and production `global update()`/rAF share this seam. The rejected independent `APEX_ARSENAL.step` presentation wrapper no longer exists.

The adapter exposes calls, advanced frames, duplicates, and pre/post root samples. At 1/60, both frame paths produce one presentation frame, two fixed Gold steps, and zero duplicate calls.

### Canonical Gold-owned engine

`magnetGoldV1.js` was reconstructed rather than incrementally amplified. Gold now owns:

- immutable six-part pre-baked art and authored pivots;
- deterministic local RNG;
- fixed 1/120 simulation with a six-step hitch cap;
- acceleration ring history and delayed sampling;
- Gold channels and per-part spring targets;
- idle, movement start, sustained movement, stop, hard-turn, wall/contact, A1, A2, passive and recovery choreography;
- sparse floor distortion, history trails, angular A2 sectors, pressure cues, selection rings, force arcs, corridors, echoes, particles and local lenses;
- all effect lifetimes/history bounds;
- three isolated render phases (`drawBefore`, `drawActor`, `drawAfter`);
- transformed attachment sockets from the same part transform used to draw the actor.

The single production-only art calibration is:

`(170 / 1020) × (live radius / Gold HX 96) × calibration 1.0`

For the production radius 75 this is `0.13020833333333331`. It changes presentation art only; gameplay radius and world laws remain untouched.

### Thin semantic adapter

`magnetPresentationRuntime.js` now supplies only real production truth:

- pre/post resolved root and live radius;
- active A1/A2 state;
- actual influenced revealed floor firearms;
- actual influenced hostile firearm bullets;
- actual A2 bodies;
- cast, late-reveal, passive-emission, and realized-damage events.

Gold chooses targets, timing, pose, effects, history, sockets, and rendering. A1 remains valid with zero objects, follows left/right real objects continuously, and acknowledges late reveal. Passive visualization follows the real emission event; gameplay speed remains exactly x1.18 once. Realized damage is translated into semantic impact direction/amount and Gold owns contact severity/recovery.

## 3. New acceptance gates

- `tools/testMagnetV1SchedulerParity.mjs` — shipping AQ-step and global-update exact-once parity.
- `tools/testMagnetGoldMotionTrace.mjs` — timestamped relative-transform sequences for start, sustained travel, stop, reverse, wall, A1, A2, passive, and idle.
- `tools/testMagnetV1PresentationSemantics.mjs` — real floor-gun left/right/zero/late-reveal, hostile-bullet A1, body+gun+bullet A2, real damage contact, passive timing, scale, exact transformed sockets, and three-phase render isolation.
- `tools/testMagnetV1RealBrowser.mjs` — real Chromium/rAF counters, fixed-step mapping, post-movement root correspondence, three-phase draw counts, real A1 direction, errors, and field frame-budget measurement.
- Browser telemetry: `evidence/presentation-rebuild/browser-telemetry.json`.

Final browser telemetry recorded:

- 36 rAF frame calls / 36 advanced frames / 0 duplicate calls;
- 86 Gold fixed steps over 0.7142 game seconds;
- 64 calls to each of `drawBefore`, `drawActor`, and `drawAfter`;
- production A1 desired direction `(-1, 0)` from a real floor firearm;
- A1 measured mean frame interval about 24.36 ms in headless Chromium;
- no browser runtime errors.

## 4. Durable checkpoints

1. `7a09ecad8cea98eb7389d7f44ce795d58d9ed192` — rejected-bridge subsystem audit.
2. `a2977038604d3e7e16a0c9af1114d4e89fd36c42` — shared exact-once frame seam.
3. `9e8a47a6886d35e564676744518939422ffff290` — canonical Gold motion engine.
4. `6940de976114e4434f55f38619ac0f6441ba14b6` — six-part motion trace gate.
5. `0d2b3e6c7d62279a041c1e4ffe01f9e02b4b4498` — Gold effect state/reactions.
6. `ff725ff3699a598180c3dbb7d6de96dc0c492c05` — Gold-owned field rendering.
7. `3a08103c5a57a23540bcbd9cab460efbd85f137f` — thin production adapter.
8. `a445632835f6778dd7e5373ab5bdb9097bbe95e6` — production object/scale/socket proof.
9. `e74976c47566e9a657a59fca9ad05448e329415a` — real damage contact grammar.
10. `588af96e764c13f6cd9d93aac014deda59331f5d` — first real-browser telemetry.
11. `bf287fb84fc198841c51cf9ded9f1b9342feec9c` — browser field-budget measurement.
12. `dad48e4fda16c2443e9dd171801ff189d11d12c9` — final runtime revision relock.
13. `d409c7dd9250441ea471a6c35ffef5b2d4a4bdbb` — final rAF/revision evidence.

Every checkpoint above was pushed to and remotely verified on the Arena branch before continuing.

## 5. Validation results

### Magnet and build — clean

| Gate | Result |
|---|---:|
| Magnet gameplay | 26/26 PASS |
| Scheduler parity | 7/7 PASS |
| Gold motion traces | 12/12 PASS |
| Presentation gates | 13/13 PASS |
| Production semantic/scale/socket gates | 15/15 PASS |
| Real Chromium/rAF | 8/8 PASS |
| Runtime revision/hash lock | PASS, 38 runtimes |
| Production Vite build | PASS |

### Protected systems — clean suites

| Gate | Result |
|---|---:|
| Robot gameplay | 11/11 PASS |
| Robot recoil | 6/6 PASS |
| Crystala Gold parity | 25/25 PASS |
| Slime core | 9/9 PASS |
| Slime kit | 5/5 PASS |
| Slime legacy separation | 6/6 PASS |
| Slime owner-fix | 7/7 PASS |
| Hero locomotion | 4/4 PASS |

Mirror co-load is covered by Magnet gameplay gates: fresh-copy/no-passive inheritance and live-field-center relocation both pass. Frozen Mirror file hashes also pass.

### Reproduced pre-existing residuals

These were reproduced against an extracted exact `4403c57...` tree and were not changed or reclassified as success:

- Robot presentation: final and baseline both **18/28**; the same ten pre-existing event/SFX expectations fail.
- Crystala gameplay: final and baseline both **72/73**; `G07` flags an older shared `arsenalQuestRuntime.js` difference.
- Hunter owner-fix: final and baseline both **10/11**; its cache-bust regex only accepts 2026-09-30 revisions.
- Frost: final has 162 passing assertions and four residual failures. The three substantive scale/lifecycle/history failures reproduce at baseline; the fourth is a hardcoded Frost-only revision string that rejects both Magnet runtime revisions.
- Hero Rework goldens: final and baseline both **9/11**, with the same Crystal/ICE reflection and Rubber reflection failures.
- Hero Rework smoke: the Robot dash assertion is pre-existing/flaky; repeated exact-baseline runs produced both 17/17 and the same 16/17 result seen final.
- Arsenal headless: final reaches **334/335** with the same `audio 50/56` preload residual present at baseline. The rejected baseline additionally crashes later in old Magnet Gold (`p.k` on an undefined rig part); the rebuild eliminates that crash.
- Arsenal real browser: final and baseline both reach **189 passing gates**, both fail the same Frost lane assertion, then both stop at the same unrelated lab pigment `liveSpray()[0].rgb` exception.

No protected-system source was edited to hide or bless these residuals.

## 6. Changed files from `4403c57...`

- `docs/hero-rework/magnet-v1/10_PRESENTATION_BRIDGE_REBUILD_AUDIT.md`
- `docs/hero-rework/magnet-v1/11_PRESENTATION_BRIDGE_REBUILD_REPORT.md`
- `docs/hero-rework/magnet-v1/evidence/presentation-rebuild/browser-telemetry.json`
- `public/asset-manifest.json` (required generated-manifest refresh)
- `public/game/hero-rework/heroReworkRuntime.js`
- `public/game/hero-rework/magnetGoldV1.js`
- `public/game/hero-rework/magnetPresentationRuntime.js`
- `src/game/runtimeManifest.js`
- `tools/runtimeRevision.lock.json`
- `tools/testMagnetGoldMotionTrace.mjs`
- `tools/testMagnetV1PresentationGates.mjs`
- `tools/testMagnetV1PresentationSemantics.mjs`
- `tools/testMagnetV1RealBrowser.mjs`
- `tools/testMagnetV1SchedulerParity.mjs`

## 7. Acceptance boundary

Automated gates and screenshots/telemetry are engineering evidence only. **Owner browser/playtest visual acceptance remains pending** until the owner personally evaluates silhouette, scale, motion grammar, A1/A2 readability, passive response, and overall feel in the production battle.
