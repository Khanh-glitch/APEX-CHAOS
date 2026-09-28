# ROBOT + SLIME Model Qualification — Final Engineering Report (2026-09-28)

**Branch:** `arena/01a0e749-apex-chaos`
**Authority:** docs/hero-rework/phase1/10_ROBOT_SLIME_MODEL_QUALIFICATION_TASK_2026-09-28.md
**Owner-failure audit:** docs/hero-rework/phase1/09_OWNER_PLAYTEST_FAILURE_AUDIT_2026-09-28.md
**Scope (as instructed):** shared illegal locomotion/autopilot layer + ROBOT + SLIME only. The other
10 heroes' kits were NOT repaired. BLACK_HOLE visuals untouched. No blood/splatter/VFX reductions.

## Pushed SHAs in order (session checkpoints)

| # | Checkpoint | SHA | Notes |
|---|-----------|-----|-------|
| 1 | Q1 shared locomotion law | `2e4db2a` | prior session |
| 2 | Q2 ROBOT fidelity + Passive threshold blocker | `86de566` (+ reconcile `92ed757`) | prior session |
| — | (CI evidence-bot refreshes) | `afdc651`, `c8c3a4f`, `c09acff`, `2e80047` | `[skip ci]` bot commits, reconciled by merge |
| 3 | Q3a legacy/rework SLIME separation | `0e54134` | this session |
| 4 | Q3b SLIME A1/base multi-body physics | `eda32db` (+ reconcile merge `48bffa2`) | this session |
| 5 | Q4 SLIME A2/passive + real-browser hitch diagnostic | `150f26f` (+ reconcile merge `c7e78cc`) | this session |
| 6 | Q5 final report | this commit | **testable preview commit** |

## Files changed (qualification work)

**Shared locomotion (Q1):** `public/game/hero-rework/heroReworkRuntime.js` (shellUpdate = ROOT latch
only), `tools/testHeroReworkLocomotionGates.mjs` (new), `tools/smokeHeroReworkHeadless.mjs`
(+2 standing real-movement gates).

**ROBOT (Q2):** `heroReworkRuntime.js` (revealedPickups T6 id authority), `heroRegistry.js` (Passive
blocker citation), `tools/testHeroReworkRobotGates.mjs` (new),
`docs/hero-rework/phase1/11_ROBOT_PASSIVE_THRESHOLD_SOURCE_AUDIT_2026-09-28.md` (new).

**SLIME legacy separation (Q3a):** `public/apexEngine.js` (3 name-keyed takeDamage paths gated),
`public/game/core/apexPrecisionFixes.js` (SLIME counter/split block gated),
`public/game/guards/apexFreezeDisappearHotfix.js` (SLIME damage-window push gated),
`tools/testHeroReworkSlimeLegacySeparation.mjs` (new),
`docs/hero-rework/phase1/12_LEGACY_SLIME_DOUBLE_EXECUTION_AUDIT_2026-09-28.md` (new, full
classification table).

**SLIME multi-body + kit (Q3b/Q4):** `heroReworkRuntime.js` (slimeSplitPose, spawnSlimeChild,
mergeSlimeChild), `public/game/hero-rework/heroMechanicsRuntime.js` (3 slime executors),
`heroRegistry.js` (divergence slot documented UNRESOLVED), `tools/testHeroReworkSlimeGates.mjs`
(new), `tools/testHeroReworkSlimeKitGates.mjs` (new), `tools/measureSlimeHeavyHitHitch.mjs` (new).

**Evidence:** `docs/hero-rework/evidence/{robot-gates,slime-gates,slime-kit-gates,slime-legacy-separation,slime-heavy-hit-hitch}-report.json`.

## Root causes

1. **Shared locomotion autopilot (Q1, prior session).** `shellUpdate` contained an illegal global
   pickup-seeking + chase/kite + ideal-distance controller that contaminated every hero's motion.
   Fixed: shellUpdate latches only explicit-mechanic motion locks; movement is original APEX
   heading/engine/wall-bounce physics. Proven non-vacuous (4/4 with fix vs 0/4 against old autopilot).

2. **LEGACY SLIME DOUBLE-EXECUTION (Q3a — the major SLIME root cause).** Canonical playable REWORK
   SLIME (`makeReworkShell`, `type.arsenalShell`, the documented "runs NO legacy kit" law) was ALSO
   executing name-keyed (`f.name === 'SLIME'`) legacy mechanics from three boot-time layers:
   `apexPrecisionFixes` (legacy `slime_child` guard spawns on damage + `splitPrecisionSlime` pushing
   HP-duplicating CLONES INTO GLOBAL `fighters[]`), `apexFreezeDisappearHotfix` (legacy damage-window
   bookkeeping feeding the spawn/clone kits), and `apexEngine` takeDamage (slime_child guard ABSORBING
   UP TO 45% of incoming damage, gel-armor modifier, damage-window leak). Owner-observed as: wrong/
   drifting damage (per-hit ratio drift on top of shared roster tuning), legacy children/guards,
   synchronous spawn/clone work inside the damage call (hitch), and the architecture violation
   (children in `fighters[]`). Full classified call-site table: doc 12. Fixed with the narrowest
   in-tree discriminator (`this.type.arsenalShell` — already used by VAMPIRE/KUNGFU adapt hooks):
   the 5 name-keyed paths skip shell bodies; legacy Quest/boss SLIME (`FT('SLIME')`) keeps every
   behavior (proven preserved). Nothing renamed, nothing deleted.

3. **SLIME multi-body physics (Q3b).** Unseeded `Math.random` split axes; overlapping spawns
   (`a.radius+10`); all children hardcoded 90% speed (halves wrongly slowed); merge without footprint
   restore; A2 progress burned at child-cap/low-HP. Fixed: seeded `ctx.rng` everywhere (S13 scan:
   zero raw `Math.random`), `slimeSplitPose` non-overlap placement, halves at parent speed / A2
   children at `cfg.childSpeedPct`, proximity-gated merge restoring `r=√(rA²+rB²)` + HP/maxHp pools,
   deterministic equipment merge (unarmed survivor takes the child's weapon; else exactly one drop
   slot — never duplicated), A2 progress consumed only on successful spawn.

4. **SLIME kit edge bugs (Q4).** Passive Emergency Mitosis blocked at the spec's exact knife edge
   (80% loss at ref 1000 = hp 200 = halves of exactly 100) by IEEE noise — fixed with a 1e-9/1e-6
   float-hygiene epsilon (not a tuning change); reference HP = creation state (symmetric); A2 expiry
   returns HP ONLY — the child's physical area/radius is NEVER merged into the receiver (owner
   correction applied and gated: `radiusUntouched`).

## Targeted gate results (all green at final run)

| Suite | Result | Key numbers |
|-------|--------|-------------|
| Q1 locomotion gates (real movement, no freeze/pin) | 4/4 | non-vacuous 0/4 vs old autopilot |
| Q2 ROBOT gates (real cast + real aqDamage) | 9/9 | DR ratio exactly 0.45; A1 dash arrival 0.233s ≤ 0.55s; T6 fail-cue; refund sequence [0, 0.5, 1.0, 1.5]→+0.5 via labeled TEST-ONLY fixture |
| Q3a legacy separation | 6/6 | rework: 0 legacy entities, exact damage ratio 1.2084 every hit (shared tuning ICE.out × SLIME.taken), no legacy labels; legacy: child spawn + `fighters[]` clones preserved (2→4) |
| Q3b SLIME physics (S1–S8) | 9/9 | non-overlap 114.1px ≥ 106.1; travel 208px/0.4s at parent 520; merge HP 1000=500+500 + area restore; divergence knob LIVE + provisional metric ratio 1.6 = 40/25 + seeded reproducibility |
| Q4 SLIME kit (S9–S13) | 5/5 | carry exact 45.01; cap residue exact; killed-HP lost (isolated); resume-from-retained 35.02; expiry HP-only (radius untouched); passive split halves ≈100, refs 100; seeded-RNG scan clean |
| Smoke (incl. 2 standing locomotion gates) | 17/17 | |
| Goldens | 11/11 | |

## Full-suite / build results (final run)

- Arsenal headless: **334/334** (`quest-legacy-bosses-keep-encounter-identities` green — Quest 20-stage identities preserved).
- Real-browser suite (Chromium 153, vite 5173): **217/217** on the final run. Two prior runs failed
  `both-unarmed-no-spam` (and once `both-unarmed-retrigger`) — **flaky, out-of-scope gates** on the
  pure engine pair (rework layer not installed): the engine's `Math.random()` initial heading lets a
  fighter legally contact-collect the emergency fast-spawn pickup inside the free 1.0s measurement
  window (`mid=2` + `unarmedFastConsumed` state perturbation). Mechanism proven from run counters;
  CI history shows the same gates passing (`mid=1`). Not a ROBOT/SLIME regression; no gate logic was
  altered (no green-hacking).
- Build: `materializeArsenalFinalSfx` + `generatePublicAssetManifest` (690 assets) + `vite build` ✓.

## Browser heavy-hit hitch measurements (real Chromium 153, `tools/measureSlimeHeavyHitHitch.mjs`)

Method: live vite app, real `weaponApi.aqDamage` production path, STORMBREAKER heavy hit (800
realized), 5 reps/mode, impact-anchored pre/post frame + long-task sampling. Measured values only —
NO pass threshold invented. Blood/splatter/VFX untouched (full feel pipeline ran on every hit).

| Scenario | sync damage-call median (min–max) | bodies | post max frame Δ | long tasks |
|----------|----------------------------------|--------|------------------|------------|
| slime-split (crosses 80% passive) | 3.0ms (2.6–4.1) | 1→2 | 167.7ms | 1 |
| slime-nosplit (same target, 300) | 2.0ms (1.5–2.6) | 1→1 | 206.9ms | 0 |
| ice (same 800 hit, non-SLIME) | 2.8ms (1.7–4.5) | 1→1 | 187.4ms | 0 |
| legacy-split (legacy-type SLIME) | 4.4ms (1.7–7.7) | 1→0 | 197.0ms | 0 |

- **SLIME-specific synchronous split/child-creation cost: ~1.0ms** (split − nosplit medians).
- **No SLIME-specific frame hitch:** slime-split post max Δ (167.7ms) is at or below the non-SLIME
  scenarios — the ~100–200ms deltas are the shared headless software-rendering cadence (pre-impact
  maxima 85–126ms across all scenarios).
- **Intentional hit-stop separated:** requested 0.08s (STORMBREAKER spec 0.03–0.08s) simulated at
  10% speed; measured clock-rate signature `clockRateFirst300msPost` 0.035–0.06 vs pre-impact
  cadence 0.27–0.40 — SIM slowdown, not frame drops.
- **Legacy double-execution cost (pre-fix):** legacy-split sync median 4.4ms vs rework-split 3.0ms
  (+1.4ms median, tail to 7.7ms) AND unpredictable damage (guard absorb makes the probe scale 0.6646
  vs the exact 1.2084 shared-tuning ratio post-quarantine). Eliminated for rework SLIME by Q3a.

## ROBOT Passive threshold-source conclusion

An exhaustive whole-repo audit (docs/hero-rework/phase1/11) found **NO authoritative visible
cumulative damage-dealt milestone ladder** in the game. Near-candidates rejected: the burst
commentary tiers (4.5/9/15/23.5%) are windowed presentation; the ENERGY meter is explicitly
telemetry-only. The Passive therefore RECORDS credited realized damage but fires NO refunds on
invented numbers: `milestoneThresholds: null`, `UNRESOLVED_OWNER_TUNING_DEPENDENCY`. The refund
sequence (#1 none, #2 0.5s, #3 1.0s, #4 1.5s, later +0.5s; one proc each; refunding the currently
relevant Active) is frozen and proven only via a clearly-labeled TEST-ONLY threshold fixture (R8/R9
gates). **The Passive is NOT complete until the owner supplies the threshold ladder.**

## Unresolved items (owner authority required)

1. **ROBOT Passive milestone thresholds** — no ladder exists in-game; owner must supply (or
   explicitly authorize a mapping). Recording-only until then.
2. **SLIME `divergenceTarget` "±25" semantic/unit** — NOT frozen (degrees/px/px-per-s all plausible).
   Kept as an explicit unresolved tuning slot; the executor carries a clearly-labeled PROVISIONAL
   pilot reading (degrees about the split perpendicular) isolated behind cfg; gate S5 asserts the
   knob is LIVE + the provisional metric responds proportionally + seeded reproducibility — and
   explicitly does NOT assert a canonical unit.
3. **Flaky browser gates** `both-unarmed-no-spam` / `both-unarmed-retrigger` (arsenal spawn laws,
   outside this qualification's scope) — mechanism documented above; recommend the owning line pin
   headings/positions in that window the way the locomotion/kit gates do.
4. **HeroDefinition contract drift — CONFIRMED, not repaired** (per instruction): e.g. SLIME A2 cfg
   carries declarative law flags (`carryOverProgress`, `childValidAutoTarget`, `childMayEquip`,
   `expiryReturnHp`, `killedChildHpLost`) consumed by gates, not code; `minSplitHp`/`minSplitShareHp`
   dual knobs; ROBOT PASSIVE carries the unresolved-threshold marker. The 12-hero contract is NOT
   claimed repaired.
5. The other 10 hero kits (out of scope, deliberately untouched).

## Preservation checklist

canonical 12 roster ✓ · NEWBIE→ROBOT migration ✓ · Quest 20-stage identities ✓ (334-suite gate) ·
T6 manipulation immunity ✓ (R3) · Stormbreaker 446 + frozen flight/stun laws ✓ (untouched) · SLIME
children outside `fighters[]` ✓ (S2/L1) · CP7 menu/audio/readiness ✓ (browser suite) ·
blood/splatter ✓ (untouched, full pipeline in hitch runs) · weapon aim independent of movement ✓ ·
no raw gameplay `setTimeout` ✓ · original APEX locomotion ✓ (Q1).

## How to test this preview commit

```bash
npm install --no-package-lock
node tools/materializeArsenalFinalSfx.mjs
npx vite --host 0.0.0.0 --port 5173          # app on :5173
node tools/testHeroReworkLocomotionGates.mjs  # 4/4
node tools/testHeroReworkRobotGates.mjs       # 9/9
node tools/testHeroReworkSlimeLegacySeparation.mjs  # 6/6
node tools/testHeroReworkSlimeGates.mjs       # 9/9
node tools/testHeroReworkSlimeKitGates.mjs    # 5/5
node tools/smokeHeroReworkHeadless.mjs        # 17/17
node tools/testHeroReworkGoldens.mjs          # 11/11
node tools/testArsenalQuestHeadless.mjs       # 334/334
LD_LIBRARY_PATH=/tmp/al2023/lib CHROME_PATH=/tmp/chromium \
  APEX_APP_URL=http://127.0.0.1:5173 node tools/testArsenalQuestRuntime.mjs  # 217/217 (flaky pair noted)
LD_LIBRARY_PATH=/tmp/al2023/lib CHROME_PATH=/tmp/chromium \
  APEX_APP_URL=http://127.0.0.1:5173 node tools/measureSlimeHeavyHitHitch.mjs  # measured report
```

ENGINEERING CANDIDATE READY FOR OWNER ROBOT+SLIME PLAYTEST — NOT OWNER ACCEPTED