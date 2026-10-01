# FROST V1 — FINAL ONE-SHOT REBUILD REPORT

Branch: `arena/01a0f2eb-apex-chaos` · base `477871dd` · final tree `895570b`+
(this document's commit). Authority: `00_FROST_IMPLEMENTATION_AUTHORITY.md`,
`03_IMPLEMENTATION_TEST_MATRIX.md`, `09_FINAL_GOLD_REBUILD_AUTHORITY.md`.

The owner's playtest rejected the previous build on four grounds: A2 looked
like detached ice chunks, A1/A2 corrupted the whole battle render, Frost was
too small, and the Gold lifecycle was not faithfully reproduced. This pass
rebuilt the visual chain from the canonical Gold instead of patching symptoms.

---

## 1. What was rebuilt

### 1.1 Gold module (the only visual authority)
`tools/bridgeFrostGoldV1.mjs` was rewritten and re-run against the
hash-verified canonical Gold:

| | value |
|---|---|
| source | `docs/hero-rework/frost-v1/gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html` |
| bytes | 981,597 |
| sha256 | `940fc9a8a181cc40d965ebf2c4309d1b4816d3016fc191b0d3df8a1a65be2475` |
| output | `public/game/hero-rework/frostGoldV1.js` — 9 art layers, ~103 k chars |

The bridge now exports a frozen `GOLD_REF` (the Gold's own authored reference
numbers: `FROST_R 34`, `ENEMY_R 41`, `A1_LEN 650`, `A1_WIDTH 160`,
`A1_CAST 0.25`, `A1_FLOOR_LIFE 4.5`, `A2_WIDTH 120`, `A2_SEGMENT_LIFE 3.5`,
`TRAIL_STEP 9`, `TRAIL_LEN 12–16`, `TRAIL_FOOT_Y 6`). Nothing in the
presentation layer invents a constant any more — scale and law are read from
the Gold. The retired 975,616-byte Gold is absent from the repository and is
gated against (F12.18).

### 1.2 Battle scale (owner defect #3)
Derived, never tuned:

```
kBody = APEX fighter radius / GOLD_REF.FROST_R = 75 / 34 = 2.206
laneK = cfg.a1.width  / GOLD_REF.A1_WIDTH = 160/160 = 1
trailK = cfg.a2.trailWidth / GOLD_REF.A2_WIDTH = 120/120 = 1
```

Measured on the real renderer at the same camera/arena scale (solid
silhouette box, ambient mist excluded): **Frost 161 × 150 vs ROBOT 146 × 145**
— peer-proportionate, `h / (2·radius) = 1.0`. No compensating multiplier
exists anywhere in the presentation layer (F12.22).

### 1.3 A2 continuity (owner defect #1)
The trail is the Gold's own choreography fed by production movement:

* live hunt — the adapter feeds real `fx/fy` every frame, so the Gold lays its
  own nodes with its own law: spacing `nd >= 9`, length `rng.range(12,16)`,
  width `A2_WIDTH*0.5 + rng.range(-2,2)`, `activeUntil = t + a2SegLife`,
  crust side flip every 26 px, carve from the Gold's own heading history.
* deferred admission (A1 owns the Gold engine when A2 starts) — `hydrateA2Trail`
  resamples the **authoritative gameplay trail history** at the Gold's 9 px
  step and lays the same node recipe at the real historical birth times, then
  hands the live lay-down over seamlessly. No restart at the admission point,
  no second algorithm, no connecting rectangles, no smoothing pass.

Measured (F12.19): live chain max neighbour gap **9.0 px** with segment length
≥ 12 px ⇒ segments overlap (continuous); **0** duplicate/parallel nodes; every
node inside the Gold length/width law; after a deferred admission with a real
L-shaped path the chain is still unbroken and the **start** of the real path is
on screen.

### 1.4 Scene isolation (owner defect #2)
Every Frost draw entry now goes through one guard (`isolated(ctx, fn)`):
snapshot of transform + `globalAlpha`, `globalCompositeOperation`, `filter`,
shadow\*, line\*, fill/stroke style, font, text\*, image smoothing and line
dash; `save()` → draw → `restore()` → re-assert + count any leak. Applied to
the fighter-draw bypass, the bypass-debt peer passes, `postWorld`, the
projectile under-pass, floor shapes, the bullet pass and the held-weapon
overlay. `drawIceComposite` was rebuilt to require a valid size/transform and
to restore in a `finally`, with a direct-render fallback.

`inspect().stateLeaks` is a release-gated counter and is **0** in every gate
and every evidence scenario — including a hostile test that makes a Gold layer
throw mid-pass (the frame still completes, the opponent still renders, the
static arena stays bitwise identical).

### 1.5 A1 anchored to gameplay truth
Two corrections made the visible lane equal the mechanical lane:

* `buildLane` uses the authoritative release origin (`a1Origin`) supplied by
  the adapter instead of the Gold demo's authored vent offset (which, scaled by
  `bodyK`, sat ~48 px ahead and ~30 px below the real lane rect);
* the Gold's pressure→release beat is taken from `GOLD_REF.A1_CAST` and is
  snapped to the frame gameplay actually releases on (float `dt` accumulation
  was leaving the visual one frame behind the mechanic).

Deferred A1 replays still use the historical origin, direction, front window
and the original expiry (F13.12).

---

## 2. Test results on the final tree

### 2.1 Frost gates — `node tools/testFrostV1Gates.mjs`
**148 / 148 PASS**, including the new release-blocking matrix:

| gate | result |
|---|---|
| F12.18 correct-Gold-identity | PASS — canonical hash + derived `GOLD_REF` + verbatim A1/A2 law text |
| F12.19 A2-continuity | PASS — live `{n:28, maxGap:9, dupes:0}`, deferred `{n:42, maxGap:9, dupes:0, startCovered:true}` |
| F12.20 a1a2-scene-isolation | PASS — 0 bitwise breaks in Frost-free arena regions |
| F12.21 opponent-scale-stability | PASS — opponent box spread `0/0`, ink spread 0 |
| F12.22 frost-battle-scale | PASS — `kBody 2.206`, `laneK/trailK 1`, Frost 161×150 vs peer 146×145 |
| F12.23 canvas-state-integrity | PASS — props+transform identical, save/restore balanced (142), throwing layer survived, leaks 0 |
| F12.24 no-render-double-path | PASS — 1 engine/fighter, 1 body + 1 ice pass per frame, 0 legacy ice visuals |
| F12.25 no-frame-flicker | PASS — two redraws of one state bitwise identical, 0 ink jumps, 0 detail revivals |
| F12.26 full-lifecycle-Gold-parity | PASS — idle → A1 → A2 → gun → bullet → shell → thaw → rematch against Gold numbers |

Round-3/4 gates were renumbered (no assertion weakened) to **F13.8–F13.12**
because this matrix owns the F12.18+ range.

### 2.2 Whole-screen evidence — `node tools/generateFrostFinalEvidence.mjs`
**25 / 25 scenarios PASS** →
`docs/hero-rework/frost-v1/evidence/FROST_V1_FINAL_EVIDENCE.md` (+ `.json`,
+ one full-canvas PNG per scenario in `evidence/frames/`).

Matrix covered: idle / A1 / A2 against **Frost, Robot, Hunter, Crystala,
Slime**, both fighters moving, A2 wall bounce, A2 body contact, concurrent
A1+A2, Frozen Gun on the lane, Frozen Bullet, Freeze shell, full thaw, A2 exact
gun steal, cast-then-rematch, fresh rematch.

Method (built because a lucky frame proves nothing): every scenario runs
**three times** — two identical control legs with no Frost ability plus the
Frost leg. The controls measure the peer's own run-to-run variance, so Frost is
judged against measured noise. Per frame: bitwise hashes of Frost-free arena
regions, the opponent's solid silhouette box, whole-canvas ink in six bands,
and the canvas-state leak counter. Headline numbers: **0** quiet-region breaks,
**0** canvas-state leaks, opponent same-match size delta **0 px** in every
non-overlap scenario.

### 2.3 Protected suites (final tree)
| suite | result |
|---|---|
| Hero-rework goldens | 9/11 — `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected` (pre-existing) |
| Locomotion gates | 4/4 |
| Robot gates | 11/11 |
| Robot presentation gates | 18/28 — the 10 known `P-*` bus/SFX failures (pre-existing) |
| Robot recoil gate | 6/6 |
| Slime gates / kit / legacy separation / owner-fix | 9/9 · 5/5 · 6/6 · 7/7 |
| Hunter owner-fix gates | 11/11 |
| Crystala gameplay gates | **73/73** (was 72/73 until the revision relock) |
| Crystala gold parity | 25/25 |
| Arsenal Quest headless | 333/335 — `av-assets-preloaded` + `postc-robot-dash-to-revealed` |
| Realtime multiplayer | PASS |
| Runtime revision gate | PASS |
| `pnpm build` | PASS — 35 modules, `dist/assets/index-*.js` 217.6 kB |

Pre-existence of the Arsenal failures was re-proven **in this session** with a
clean worktree at the base commit `477871dd`: `av-assets-preloaded` fails there
too, and `postc-robot-dash-to-revealed` fails identically at base (2/2 runs) and
at HEAD (2/2 runs) — it is the known flaky/environmental ROBOT dash gate, not a
Frost regression.

### 2.4 Performance (software canvas, no GPU — relative numbers)
| scene | ms/frame |
|---|---|
| Frost idle vs Robot | 4.0 |
| Robot vs Hunter (no Frost) | 8.4 |
| Hunter A1+A2 | 11.0 |
| Robot A1+A2 | 11.1 |
| **Frost A1+A2 active (73 lane + 52 trail nodes)** | **22.6** |
| Crystala A1+A2 (shipped peer) | 41.5 |

Frost's heaviest state costs about half of the shipped Crystala heavy state on
the same software backend. `F13.3-steady-no-alloc` proves no per-frame canvas
or image allocation; `F13.5-bounded-counts` caps live node counts (measured
`lane 73 / trail 52 / carve 0 / total 126` against a 350 ceiling).

### 2.5 Environment-blocked (not failures of this work)
No Chrome/Chromium binary and no package-download network exist in this
sandbox, so these could not run: `F13.6-browser-perf` (reports
`BLOCKED-no-chrome-binary`, headless 30-redraw 709 ms), `testChamberPaletteGates`
(needs `puppeteer-core`), `testArsenalQuestRuntime`, `testFangRuntime`,
`testKatanaRuntime`, `testShotgunRuntime` (all spawn Chrome).

---

## 3. Acceptance conditions

| # | condition | status |
|---|---|---|
| 1 | canonical Gold verified | ✅ hash + size re-checked by F12.1 / F12.18 |
| 2 | old Gold authority gone | ✅ absent from tree, gated |
| 3 | bridge independently audited + re-run | ✅ rewritten, `GOLD_REF` emitted, PNGs byte-identical |
| 4 | presentation rebuilt on correct Gold | ✅ scale, isolation, hydration rewritten |
| 5 | A2 continuity | ✅ F12.19 + evidence 03/04/05/06 |
| 6 | no scene flicker | ✅ F12.25 + bitwise arena hashes every frame |
| 7 | no opponent scale flicker | ✅ F12.21 + paired-control evidence |
| 8 | correct battle scale | ✅ F12.22, derived from `radius / FROST_R` |
| 9 | no canvas-state leakage | ✅ F12.23, `stateLeaks 0` everywhere incl. hostile throw |
| 10 | no duplicate/legacy render path | ✅ F12.24 |
| 11 | lifecycle parity with the Gold | ✅ F12.26 + 25 evidence scenarios |
| 12 | browser evidence | ⚠️ **blocked** — no Chrome binary / no network. Real-renderer whole-screen evidence provided instead; owner live-preview playtest still required |
| 13 | Frost gates green | ✅ 148/148 |
| 14 | protected suites green or proven pre-existing | ✅ see §2.3 |
| 15 | build green | ✅ |
| 16 | performance acceptable | ✅ see §2.4 |
| 17 | revision relocked on the final tree | ✅ `20261001-crystala-v2-r11-frost-v1-final`, 35 runtimes |
| 18 | remote == local | ✅ every slice pushed and remote-verified |
| 19 | clean tree | ✅ |

**Not accepted yet:** condition 12. Headless green is explicitly insufficient
per the authority; the owner's own playtest in a real browser is the last step.

---

## 4. Files that matter

| path | role |
|---|---|
| `docs/hero-rework/frost-v1/gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html` | the ONLY visual authority |
| `tools/bridgeFrostGoldV1.mjs` | canonical Gold → runtime module bridge (audited, re-run) |
| `public/game/hero-rework/frostGoldV1.js` | generated Gold engine + `GOLD_REF` (do not hand-edit) |
| `public/game/hero-rework/frostPresentationRuntime.js` | thin adapter: truth in, Gold choreography out, one isolated draw pass |
| `public/game/hero-rework/frostGameplayRuntime.js` | gameplay truth (unchanged this pass) |
| `tools/testFrostV1Gates.mjs` | 148 release gates incl. F12.18–F12.26 |
| `tools/generateFrostFinalEvidence.mjs` | whole-screen paired-control evidence generator |
| `docs/hero-rework/frost-v1/evidence/` | the evidence report + per-scenario frames |
