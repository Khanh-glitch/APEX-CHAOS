# CRYSTALA V2 Minimal-Delta — Implementation Report

- **Arena session branch:** `arena/01a0f1e7-apex-chaos` (push only to this branch)
- **Exact starting baseline SHA:** `810f58b39f492515f0739cccc4b803009e027c24`
  (head of the frozen reference branch `arena/crystala-v2-minimal-20260930`; session
  branch hard-reset to it before any edit)
- **Implementation commit SHA:** `c376641b5086aaaf85abc5c29d1092a059d7b048`
- **Authority:** `docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md`
  (supersedes the over-broad V2 draft) + `03_ACTIVE_AGENT_TASK_CRYSTALA_V2.md`

## Changed files

| File | What changed |
| --- | --- |
| `public/game/hero-rework/crystalGameplayRuntime.js` | K acquisition rewritten (450/300/1.60s, no prediction), wall fallback routing (blades `[0,1]`, K-off allowed), wall breaking-shot law, immediate shard launch timed to the 300 px contact |
| `public/game/hero-rework/heroRegistry.js` | CRYSTAL numbers only: A1 `cooldown 8.0 / requiresAwakening false / wall.hp 80`, A2 `cooldown 12.0 / scanRadius 450 / interceptBand 300 / contactToDock 1.6`. Prison (135/6/75/3.0) and PASSIVE (0.50) untouched |
| `public/game/hero-rework/heroMechanicsRuntime.js` | CRYSTAL-slice comments only (routing note); ROBOT/HUNTER slices byte-identical (G07 protected hashes green) |
| `tools/testCrystalaGameplayGates.mjs` | V2 law rewrites (C05/C08/C12/C15/C18/C21–23/C28–31/C34/C34b/C36/C48/L02/M01 …) + new law gates V02/V04/V05/V06/V07 |
| `tools/analyzeCrystalaDecisionTradeoffs.mjs` | V2 wall setup (K-off wall / window-closed fallback) + late-J falls back to wall |
| `tools/profileCrystalaPerformance.mjs` | `buildRealWall` uses the V2 wall path (no 5-shard busywork trick) |
| `tools/profileCrystalaPerformanceHeadless.mjs` | NEW — sandbox fallback perf proxy (jsdom + napi-canvas) |
| `docs/hero-rework/crystala-v1/perf/crystala-performance-profile-headless.json` | NEW — headless step/draw profile evidence |
| `src/game/runtimeManifest.js` | `APEX_ARSENAL_RUNTIME_REVISION` `20260930-crystala-commit-r10` → `20260930-crystala-v2-r11` |
| `tools/runtimeRevision.lock.json` | relocked (`UPDATE_LOCK=1`), 32 versioned runtimes |

## Test / evidence results

| Evidence | Result |
| --- | --- |
| Focused + full Crystala gameplay gates (`tools/testCrystalaGameplayGates.mjs`) | **73/73 PASS** (V2 laws + untouched-gate regression proof) |
| Runtime revision / hash gate (`tools/testRuntimeRevisionGate.mjs`) | **PASS** revision `20260930-crystala-v2-r11`, 32 runtimes |
| Production build (`pnpm build`) | **PASS** (vite, 3.1 s) |
| Crystala Gold parity/readability (`tools/testCrystalaGoldParity.mjs`) | **25/25 PASS** (Gold HTML hash + verbatim blocks intact) |
| HeroRework suites (Locomotion / Robot / HunterOwnerFix) | **4/4, 11/11, 11/11 PASS** |
| Arsenal Quest headless (`tools/testArsenalQuestHeadless.mjs`) | **334/335** — only `av-assets-preloaded` fails (jsdom image API; pre-existing, fails on baseline too) |
| Headless perf proxy (`tools/profileCrystalaPerformanceHeadless.mjs`) | step p50 ≤ 0.33 ms all scenarios; evidence JSON committed. Directional only |

### Blocked evidence (environment, not skipped silently)

- **Crystala production-browser performance profile** (`tools/profileCrystalaPerformance.mjs`) — BLOCKED: no Chrome binary in sandbox, Chrome download CDN unreachable, no root for package install. The tool is updated for V2 and ready to run where `CHROME_PATH` exists.
- `tools/analyzeCrystalaDecisionTradeoffs.mjs`, `auditCrystalaRealBrowser.mjs`, `captureCrystalaVisualParity.mjs`, `testArsenalQuestRuntime.mjs` — same Chrome requirement (the last one also hardcodes a Windows Chrome path).
- Visual quality: **nothing was cut or changed** — `crystalaGoldV6.js` and `crystalaPresentationRuntime.js` are byte-untouched; all visual assets/GOLD draw code identical to baseline.

### Unrelated pre-existing failures (verified on clean baseline)

- `smokeHeroReworkHeadless.mjs` → `smoke-robot-dash-moves-to-pickup` (16/17) — fails identically at baseline SHA (robot-dash-to-pickup timing; unrelated to Crystal; the same family `postc-robot-dash-to-revealed` is flaky in the AQ headless suite).
- `testArsenalQuestHeadless.mjs` → `av-assets-preloaded` — jsdom cannot load images; fails at baseline too.
- `testArsenalQuestRuntime.mjs` — needs Chrome (blocked, see above).

## HEXA (prison) non-change — explicit confirmation

**The HEXA/prison mechanic and numbers are NOT changed.** Facet HP stays **75**
(radius 135, 6 facets, 3.0 s solid life untouched); its reflect-first removal law
is untouched — even the shot that removes the last facet HP is still reflected
(new gate `V05` proves exactly this contrast against the Wall's new breaking
shot). The prism keeps `castPrison` geometry/seed/assignment byte-identical and
the routing evaluates the live HEXA path first (K decision window + 6 ORBIT +
anchor), exactly as live code resolves it. `crystalaGoldV6.js`,
`heroReworkRuntime.js`, `crystalaPresentationRuntime.js` and every arsenal /
other-hero file are byte-untouched (git diff + G07 protected hashes).

## Key V2 laws now enforced (gate references)

- Wall castable K-off; HEXA-first routing; wall shardIds always `[0,1]`; both
  blades ORBIT else fail `'condition'` with **no cooldown** (C08/C11/C12/C13a/V04).
- Wall HP 80, width 220, 4.0 s from material lock (C18); J cooldown 8.0 s (C13/L02).
- Breaking shot: `dmg >= remaining HP` → hit + destroy + same projectile
  continues through unreflected at full damage/owner/velocity/crit (C48/V02);
  below-HP shots keep reflect + Passive first (C42–C47 unchanged and green).
- K: claims on 450 px entry (C28), every contact ring exactly 300 px (C29/V06),
  near-miss/short-life/blocked-first waste shards by design (C21/C22/C23),
  stable first-seen order, no damage priority (C31), 6 independent shards +
  per-shard dock reopen (C10/C34c), contact→dock 1.60 s (M01), K cooldown
  12.0 s / active 2.4 s (C02), assignment never consumes the projectile and
  travel never teleports (C36/C34b/V07).
