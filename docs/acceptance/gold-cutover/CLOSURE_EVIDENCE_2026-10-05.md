# GOLD PRODUCT CUTOVER — CLOSURE EVIDENCE (2026-10-05)

Branch: `arena/01a10805-apex-chaos` (session branch; all work pushed only here)
Authority baseline: `63622a42fa235fe2cc60b9f2d14d63fcf65a658a` (arena/01a1025a-apex-chaos tip)
Code checkpoint SHA for everything below: `94794ddbdeba9a562ddcae8839795050f065289f`

This document records what was proven, what was fixed, and what remains open.
It is a durability/closure record, **not** an owner acceptance claim.

---

## 1. Work completed in this session

### 1.1 Lucky Draw production truth (slice 5)

New harness: `tools/testLuckyDrawProductionTruthHeadless.mjs` — **14/14 gates PASS**
(`docs/acceptance/gold-cutover/headless/lucky-draw-production-truth-report.json`).

It mounts the **real generated** `public/gold/lucky-draw.html` into a **real
same-origin iframe** inside a jsdom window running the real engine + Arsenal
runtimes, replays the shell's exact production hand-off (generator patch
`SHL-S21`), and drives the **real draw control**. No economy authority was moved,
no save/currency system was duplicated, no draw result was faked.

Proven through the real production meta authority (`window.APEX_ARSENAL_META`):

| Property | Evidence |
|---|---|
| Donor boots in the iframe | `#btn1`, `#scrap`, `#drawerList` present, no load errors |
| `APEX_LUCKY_SYNC` registered in the **donor** window | `frameWin.APEX_LUCKY_SYNC !== win.APEX_LUCKY_SYNC`, parent has none |
| iframe receives the real parent production meta | `frameWin.APEX_ARSENAL_META === meta` (same object) |
| displayed credits sync from production | production `350` → shown `"350"` |
| spin called exactly once | `spinCalls: 1` |
| draw costs exactly 350 AC | `before 350 → after 0`, `delta 350` |
| credits decrease through the real economy | API credits === saved credits (`0`) |
| result maps to a real production fighter | `HUNTER`, `meta.owns() === true`, pool no longer contains it |
| pool is real / unowned-only / no duplicates | `poolSize 4`, `poolAllUnowned true`, `duplicates []` |
| insufficient funds from production truth | credits `100` → tag `"NEED 250 AC"`, spin attempted once, balance untouched |
| ROSTER COMPLETE from production truth | whole playable pool owned → tag `"ROSTER COMPLETE"`, production pool `0` |
| reopen re-syncs production truth | `meta.award('test-reopen', 425)` → shown `"425"`, drawer rows `5` === production pool `5` |
| same-origin idempotent bridge | two extra hand-offs keep the same object and stable credits |

### 1.2 Shell ↔ Battle HUD handoff protocol (closure item A)

New harness: `tools/testShellHudHandoffProtocolHeadless.mjs` — **16/16 gates PASS**
(`docs/acceptance/gold-cutover/headless/shell-hud-handoff-protocol-report.json`).

It mounts the **real generated** `public/gold/shell.html` exactly the way
`src/App.jsx` mounts it (fetch → parse → copy head/body into `#gold-shell-host`
→ execute the shell scripts) inside a jsdom document already running the real
engine, Arsenal runtimes and the real Gold product bridge, then drives the real
product flow with real DOM input (BATTLE → mode card → LOCK IN).

Proven on production truth:

- `APEX_CHAOS_BATTLE_HANDOFF` (`live:false`) carries the real mode (`1p` for BOT)
  and **production** hero ids/accents injected by the bridge's `onHandoff`
  (`newbot → ROBOT`, `frost → ICE`, accents from `APEX_ARSENAL_SHELLS`).
- `APEX_CHAOS_HUD_READY` — posted by the **real mounted donor** — makes the shell
  (re)send the handoff; exactly **one** shell protocol listener answers
  (`resendsForOneReadyMessage: 1`), which is the runtime proof the shell boots once.
- `APEX_CHAOS_BATTLE_LIVE` is posted once the transition commits and is followed by
  a `live:true` handoff; the bridge then starts the **real match**
  (`onBattleLive({mode:'bot',p1:'newbot',p2:'newbot'})`).
- The donor pump only ticks **after** LIVE (233 ticks in the observed window) —
  the pause protocol is proven behaviourally, not by reading a flag.
- Parent runtime freezes during battle (`__APEX_PARENT_RUNTIME_PAUSED`, stage
  `inert` + `aria-hidden="true"`, one `apex-parent-runtime-pause` event) and
  resumes on exit (one `apex-parent-runtime-resume` event, `paused === false`).
- The donor's **real Escape** posts `APEX_CHAOS_BATTLE_EXIT` → the HUD closes
  (host emptied, `aria-hidden="true"`), the parent resumes, and the shell returns
  to the fighter screen.
- Escape **during** the transition cancels it: no `battle-hud-open`, no freeze.
- Re-entry after exit is a fresh cycle: 3 mounts (one per entry attempt — the
  cancelled transition mounts then unmounts, like production), 2 LIVE cycles,
  10 handoffs — idempotent across sessions.

### 1.3 Protected regressions (closure item B)

Every runnable protected/focused suite was executed on this branch **and** on the
pre-slice-5 checkpoint `8da87ba6` in a scratch worktree. The failing gate sets are
**byte-identical** between the two trees, i.e. this work introduced **zero** new
protected regressions. See §4 for the exact pre-existing set.

---

## 2. Real defects found and fixed (all in generated output, via generator patches)

| Patch | Defect | Fix |
|---|---|---|
| `LKY-L13` | `setPreset(LAB.preset)` boot call survived the LAB-panel removal → `ReferenceError` at donor boot in the real browser path | dangling call dropped from the generated donor |
| `LKY-L14` / `LKY-L14b` | `showPoolTag()` reported insufficient-AC / ROSTER COMPLETE / DRAW UNAVAILABLE into a `#poolTag` node that **never existed** in the donor markup — those messages were silently invisible to players | the status node + donor-language styling is now generated; both messages are proven to come from production truth |
| `HUD-H26` | The donor's Escape handler was a document-level capture listener that **outlived the mount**. The bridge unmounts by emptying the host, which does not remove document-level listeners, so after the first battle session the donor swallowed **every** later Escape (`stopImmediatePropagation`) and the shell's back/unlock navigation died; every remount also added another copy | installed once (`document.__apexGoldHudExitKey`) and only owns the key while its own mount script is still connected |

No production law was mutated to make a test pass; every fix is in the generated
presentation layer, and each is proven by a harness gate.

---

## 3. Gate evidence (all re-run after the final code edit)

| Gate | Command | Result |
|---|---|---|
| Gold cutover build | `node tools/buildGoldCutover.mjs` | 70 files written |
| Generated-file integrity | `node tools/buildGoldCutover.mjs --check` | CHECK OK — 70 files match `public/gold` |
| Gold battle/product path | `node tools/testGoldBattlePathHeadless.mjs` | **21/21** |
| Lucky Draw production truth | `node tools/testLuckyDrawProductionTruthHeadless.mjs` | **14/14** |
| Shell↔HUD handoff protocol | `node tools/testShellHudHandoffProtocolHeadless.mjs` | **16/16** |
| Production source hygiene | `node tools/testProductionSourceHygiene.mjs` | 41 production runtimes, 34 quarantined legacy, 0 stale engine pointers, 0 retired-select leaks, 0 HUD authority leaks |
| Runtime revision gate | `node tools/testRuntimeRevisionGate.mjs` | PASS `20261003-mirror-v1-r42`, 37 versioned runtimes |
| Asset audit | `node tools/assetAudit.mjs` | PASS |
| Production build | `pnpm build` | built in ~2s, 260 assets, 32.29 MB shipping |
| Shipping dist | `node tools/testShippingDist.mjs` | 260/260 manifest assets, 0 leaks, 0 forbidden entries |
| Arsenal current contracts | render-HUD, collision, draw-recovery, legacy-isolation, product-graph | all PASS |
| Hero-rework protected chain (14 suites) | `test:hero-rework:headless` members | 10 pass, 4 fail — **pre-existing, identical at baseline** |

Responsive proof (headless layout truth at the four reference viewports, from the
battle-path harness): `desktop-1366x768 → desk`, `desktop-1920x1080 → desk`,
`mobile-landscape-844x390 → land`, `mobile-portrait-390x844 → port`, with the
portrait 2p rule mirroring only P2 territory.

Performance evidence available here: production loop frames stay bounded
(90 frames, 48.37 ms elapsed, **0.54 ms/frame** in the headless engine loop).

---

## 4. Pre-existing protected failures (NOT caused by this work)

Identical failure sets on this branch and on `8da87ba6` (scratch worktree):

`testHeroReworkGoldens` — `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected`
`testHeroReworkRobotPresentationGates` — `P-A1-lock-dash-single-dispatch-bus`, `P-A1-dash-1-sfx`, `P-A2-auto-hits-per-hit`, `P-passive-milestone-2-bus`, `P-passive-milestone-2-sfx`, `P-passive-null-0-milestone`, `P-passive-null-0-sfx`, `P-passive-null-0-upgrade`, `P-passive-upgrade-1-bus-test-threshold`, `P-passive-upgrade-1-sfx`
`testHeroReworkHunterOwnerFixGates` — `runtime-cache-bust`
`testFrostV1Gates` — `F00.4-revision-lineage`, `F01.11-no-undefined-scope-predicate`, `F12.22-frost-battle-scale`, `F12.26-full-lifecycle-Gold-parity`, `F14.3-real-speed-history-seam-continuity`

Characterisation (for the owner, no production law was touched to hide them):

- `runtime-cache-bust` and `F00.4-revision-lineage` are **stale test literals**:
  they hardcode revision `20261003-mirror-v1-r35` while the authoritative runtime
  revision (and `tools/runtimeRevision.lock.json`) is `r42` — the runtime revision
  gate passes on `r42`.
- `F01.11-no-undefined-scope-predicate` references
  `public/game/fighters/iceVisualRuntime.js` and a `isFrostReworkSource` predicate
  that no longer exist anywhere under `public/game/` — the gate needs re-deriving
  against the current runtime layout.
- The remaining seven are engine/presentation behaviour mismatches (SFX bus
  dispatch counts, passive milestone buses, Frost battle scale / full-lifecycle
  Gold parity / speed-history seam continuity, Crystal reflect and Rubber
  store-reflected goldens). They are outside the Gold cutover scope (hero
  mechanics, not the Gold surface) and require engine-side owner work.

---

## 5. Explicit remaining deviations (must not be read as passed)

1. **No real browser exists in this sandbox.** There is no puppeteer-core, no
   `@sparticuz/chromium` and no system Chromium, so the real-browser CDP suites in
   `tools/` cannot run here. Consequently:
   - **No real-browser visual acceptance** is claimed (acceptance layer D).
   - **No GPU visual parity** and **no measured touch-target geometry** are claimed.
   - The 1366×768 / 1920×1080 / 844×390 / 390×844 evidence here is **headless
     layout truth** (real jsdom layout + the real Gold CSS/DOM), not captured
     browser frames.
   - Acceptance layer E (real-browser product proof) and layer F's browser-side
     kill/screen-crack smoothness remain **owner/browser verification items**.
   No additional browser or npm dependency was installed to manufacture such claims.
2. **Owner visual acceptance (layer H) is not claimed.** Automated evidence
   establishes readiness for owner playtest only.
3. **Ten pre-existing protected-gate failures** remain open (§4).
4. **jsdom-only stubs** are used by the three new harnesses where browsers ship the
   API (`Element.animate` with its `finished` promise, `Element.getAnimations`,
   `document.getAnimations`, an iframe's own 2D canvas context, `matchMedia`,
   `ResizeObserver`, `document.fonts`). Each stub is documented in the harness that
   uses it; none of them changes production behaviour.
5. `#battleHudFrame` in the generated shell is a **vestigial iframe path**: its
   `src` is never assigned and production mounts the HUD same-document through the
   bridge. It is inert, not a defect, but it is dead surface worth an owner decision.
6. The Lucky Draw `same-origin` property is proven from the shipping shell's
   relative iframe src plus a successful cross-window object hand-off, because
   jsdom cannot give a `document.write`'d iframe a real `location.origin`
   (`about:blank`). Browser same-origin behaviour for that path is unchanged
   production code.

---

## 6. Reproduce

```
node tools/buildGoldCutover.mjs && node tools/buildGoldCutover.mjs --check
node tools/testLuckyDrawProductionTruthHeadless.mjs        # 14/14
node tools/testShellHudHandoffProtocolHeadless.mjs         # 16/16
node tools/testGoldBattlePathHeadless.mjs                  # 21/21
node tools/testProductionSourceHygiene.mjs
node tools/testRuntimeRevisionGate.mjs
pnpm build && node tools/testShippingDist.mjs
```

Evidence JSON: `docs/acceptance/gold-cutover/headless/`
(`lucky-draw-production-truth-report.json`, `shell-hud-handoff-protocol-report.json`,
`gold-battle-path-report.json`).
