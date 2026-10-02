# MIRROR V1 — PHASE-2 ZERO-CONTEXT BASELINE (POST-D4 / CHECKPOINT E CLOSED)

> **AUTHORITATIVE CURRENT-STATE HANDOFF.**
> This document supersedes `11_CAMPAIGN_STATUS_AND_HANDOFF.md` and the early
> pre-C status sections of `10_ACTIVE_BASELINE_ADDENDUM.md` as the starting
> point for Phase 2 (**Checkpoints F1 → J**).
>
> **AUTOMATED VISUAL EVIDENCE IS NOT OWNER VISUAL ACCEPTANCE.**

---

## 1. Milestone Identity

| Item | Value |
|---|---|
| Repository | `Khanh-glitch/APEX-CHAOS` |
| Campaign branch (through E closure) | `arena/01a0f862-apex-chaos` |
| Active session branch | `arena/01a0fbae-apex-chaos` |
| `PHASE2_PARENT_SHA` (E partial parent) | `22e60357e21ef560932355852de357ccbf6b64a4` (`feat(mirror): replace A1/A2 scaffold with Gold-first gameplay (E, PARTIAL)`) |
| **`CHECKPOINT_E_SHA` (E closed)** | **`37b2ca92f40666625c150b85d2a207c41bf8a951`** (`fix(mirror): close Gold-first A1/A2 gameplay checkpoint E`) |
| Current runtime revision | **`20261002-mirror-v1-r19`** (38 versioned runtimes, `tools/testRuntimeRevisionGate.mjs` **PASS**) |
| Build status | `pnpm build` **PASS** |

---

## 2. Canonical Gold Identity (Unchanged & Binding)

```
File:    docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html
SHA-256: c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205
Size:    107480 bytes
Lines:   1403
```

`MIRROR_GOLD_FUSION_12.html` remains the **absolute visual, motion, VFX, and feel
authority** and the **Gold-first mechanic authority** for every Mirror-specific
causality that Gold models. Do not modify canonical Gold, do not reopen donor
selection, and do not substitute generic VFX.

---

## 3. Complete Checkpoint & Foundation Map

### 3.1 Mirror V1 Campaign Checkpoints

| Checkpoint | SHA | Gate / Verification | Status |
|---|---|---|---|
| **START** | `3f6479683418e7b71518274f9a6121a6893badbc` | Verified campaign start parent | Complete |
| **A** — Ordered projectile path + Magnet A2 fighter push | `3d450cf2d52a1c6808c4c1ee36edc84954f3d821` | `testOrderedProjectilePath` `14/14`, `probeMagnetA2FighterPush` `9/9` | Complete |
| **B** — Preload transplant + activation | `2c830a995fd32127fce00d3e4fad4249eaaf7575` | Preload zip + authority lock transplanted | Complete |
| **C** — Executable Gold 12 reference harness | `bbe0bd504790a7a508aec325b172d7bd7e21edd6` | `testMirrorGoldHarness` `24/24` | Complete |
| **C-R** — Executable Gold visual + lifecycle oracle | `43790bbde050c347011a009c35f6d96af89a7c09` | `testMirrorGoldVisualOracle` `14/14` (19 byte-reproducible frames) | Complete |
| **D1** — Static/material Gold bridge | `f92f2b3815642cfa576c7d42502949c05ecfc429` | `testMirrorGoldD1Raster` `13/13` (26/26 assets byte-identical) | Complete |
| **D2** — Temporal history (`HN=64`, `HS=22`) + locomotion + dedicated RNG | `09e25ed55a7db4d1c2fb48fa02370edc74544a1b` | `testMirrorGoldD1Raster` `23/23` (zero `Math.random` contamination) | Complete |
| **Authority Relock (pre-D3)** | `66f3e555956915b9df88ca153b4e7a51c68fab25` | Node 16/5 law + 18 parent baseline reds documented | Complete |
| **D3 (partial)** — A1/A2 authored choreography timeline | `469df9b68986b2574c5732ec2387d5031cffd192` | `testMirrorGoldD1Raster` `33/33` | Complete |
| **D3 CLOSED** — Real Arsenal weapon adapter + A1/A2 draw port | **`2a6a2df1b0e0492fda3d8080fab0319e12b4b7bb`** | `testMirrorGoldD3Choreography` `10/10` (7 frames + `SNIPER`/`BATTLE_AXE`/`PISTOL`) | **CLOSED** |
| **D4 COMPLETE** — Shard/node/routing presentation port | **`a10aa5a28e22623763d66e68f86bf05d06d5330d`** | `testMirrorGoldD3Choreography` `16/16` (`SH=16`, `ND=4`, `PJ=16`, oriented `NV` surface) | **COMPLETE** |
| **E (partial)** — Gold-first A1/A2 gameplay replacement | `22e60357e21ef560932355852de357ccbf6b64a4` | `testMirrorA1A2Gameplay` `28/32` (r18) | Superseded by `37b2ca9` |
| **E CLOSED** — Gold-first A1/A2 gameplay closure + rebased gates | **`37b2ca92f40666625c150b85d2a207c41bf8a951`** | `testMirrorA1A2Gameplay` **`32/32`**, `testMagnetV1GameplayGates` **`27/27`** (r19) | **CLOSED** |

### 3.2 Protected Physical Foundations (Do Not Re-implement or Retune)

| Foundation | SHA | Scope |
|---|---|---|
| **A-R** — Ordered event supersession | `109560e2a2dfe5edb7e35f39dbd65d19adbb86e3` | `testOrderedEventSupersession` `12/12`, `testOrderedProjectilePath` `15/15` |
| **H-PHYS** — Hunter explicit physical body-contact truth | `5c98e2d996d8571ea9d10090fbbe4e19c9185a5e` | `testHunterPouncePhysicalContact` `19/19` |
| **H-PHYS2** — Final continuous Magnet/body/path foundation (W1–W7 + relock) | `43bfcaf51ec5b65ef407dbf838bdb0d1e25c653a` | `testMagnetA2ContinuousField` `26/26` (builds on `9e7801e`, `facb5b3`, `83954d3`, `0385fb4`) |

---

## 4. Checkpoint E Closure Summary (`37b2ca92f40666625c150b85d2a207c41bf8a951`)

### 4.1 Final E Gate Count
* Suite: `tools/testMirrorA1A2Gameplay.mjs` — **`32/32 PASS`**
* Evidence: `docs/hero-rework/mirror-v1/evidence/e-a1-a2-gameplay.json`

### 4.2 Authoritative A1/A2 Gameplay Law Locked in Production
* **Scaffold removed, not wrapped:** `mirror.arsenal` contains zero calls to `grantWeaponCopy()`; `mirror.exchange` contains zero calls to `ctx.api.after(cfg.telegraph)` or `new AIL.RelocationTransaction(...)`. `heroRegistry.js` carries neither `telegraph` nor `usesRelocationTransaction`.
* **A1 (`mirror.arsenal`):**
  * Accepted cast snapshots an **immutable `weaponId`** at cast time; later target weapon swap, drop, or death does not invalidate the snapshot (`E-A1-07/08/09`).
  * Whiffs (unarmed, T6, shield) still consume the 15 s cooldown and never reach OWN (`E-A1-11/12/13`).
  * No copy exists at cast (`E-A1-01`) or before the OWN edge (`E-A1-02`).
  * Deterministic `1/120` fixed-step Mirror timeline (`mirrorAdvance`, `A1TS = 1.6`): OWN fires on the canonical first crossing of `u >= 0.58` at **step 112 (`~0.93333 s`)** (`E-A1-03`).
  * Materialises a **fresh** weapon holder via canonical equip while the opponent retains its original holder (`E-A1-04`, `E-A1-06`).
  * **6.0 s copy lifetime starts at OWN** (`until - ownClock === 6` to `1e-9`, `E-A1-14`) and expires cleanly (`E-A1-15`).
  * **Instance-safe expiry** via per-cast token + holder object identity: replacing the copy with another weapon (`E-A1-16`) or later equipping a new holder with the **same `weaponId`** (`E-A1-17`) is never consumed when the old 6 s timer elapses.
  * Mirror death before OWN produces no copy (`E-A1-10`).
* **A2 (`mirror.exchange`):**
  * Cooldown 12 s (`E-A2-01`), no legacy `after(telegraph)` / `RelocationTransaction` (`E-A2-02`).
  * Deterministic `1/120` fixed-step timeline (`A2TS = 1.0`): SNAP is requested on the canonical first crossing of `u >= 0.25` at **step 31 (`~0.25833 s`)**, with 0 exchanges after 30 steps and 1 exchange at step 31 (`E-A2-03`).
  * Request is queued during pre-movement `onTick` (`mirrorEnqueueSnap`) and resolved in post-movement `hrPostTick` (`resolvePendingMirrorSnaps`) **after** `resolvePendingBodyContacts`, so movement, walls, Magnet H-PHYS2 field motion, and Hunter physical body-contact adjudication resolve first.
  * Live post-movement coordinates of both fighters are sampled, **both positions are written before any event is emitted** (observer-atomic: synchronous listener sees both fighters already at their exchanged positions, `E-A2-10`), and velocity/HP/weapons remain with each original combatant (`E-A2-05/06/07/08`).
  * Death before SNAP cancels relocation while keeping cooldown spent (`E-A2-11/12`); teardown produces no late callback (`E-A2-13`).
  * Simultaneous Mirror-vs-Mirror same-pair SNAP coalesces on the unordered pair and exchanges coordinates **once** (`E-A2-17`).
* **Action-window law (`E-A1-19/20`, `E-A2-18/19`):**
  * A1 (`~1.475 s` authored end) and A2 (`~0.64 s` authored end) block overlapping authored casts, while longer presentation busy envelopes (`2.2 s` / `1.8 s`) do **not** extend the gameplay action lock.

### 4.3 Superseded Old-Law Gates Rebased in `tools/testMagnetV1GameplayGates.mjs` (`27/27 PASS`)
* **`M00.3-mirror-gameplay-byte-frozen` → `M00.3-mirror-final-authority-semantic-invariant` (GREEN):**
  * The historical byte-freeze pinned the pre-E scaffold (`5411906a...`). The replacement semantic gate inspects the live MIRROR slice in `public/game/hero-rework/heroMechanicsRuntime.js` and asserts that `grantWeaponCopy`, `after(cfg.telegraph)`, `new AIL.RelocationTransaction`, and raw `.25`/`.928` schedulers are **absent**, while `mirrorAdvance`, the OWN-edge gate, `mirrorEnqueueSnap`, post-movement `resolvePendingMirrorSnaps` in `hrPostTick`, the action-window lock, and token-based expiry are **present**. No byte hash is used so legitimate Checkpoint F/G Mirror additions are not frozen.
* **`M10.1-mirror-copy-fresh-no-passive-inheritance` → `M10.1-mirror-copy-materialises-at-OWN-fresh-no-passive-inheritance` (GREEN):**
  * Strictly stronger than the superseded immediate-copy test: asserts no copy at cast, no copy before OWN (`0.5 s`), fresh copy materialised after canonical OWN (`0.93333 s`), opponent retains original holder, and Magnet's `+18%` firearm passive is not inherited by Mirror.

---

## 5. Genuine Pre-Existing Baseline Reds (18 Total — Unchanged)

Per `docs/hero-rework/mirror-v1/13_BASELINE_REDS_AT_D3_PARENT.md`, the campaign
inherits **18 pre-existing reds** across 5 suites. With `M00.3` and `M10.1`
rebased to green replacements, the baseline red count remains **18** (no new
regressions):

| Suite | Score | Reds | Gate Names |
|---|---|---|---|
| `testHeroReworkRobotPresentationGates` | 18/28 | **10** | `P-A1-dash-1-sfx`, `P-A1-lock-dash-single-dispatch-bus`, `P-A2-auto-hits-per-hit`, `P-passive-milestone-2-bus`, `P-passive-milestone-2-sfx`, `P-passive-null-0-milestone`, `P-passive-null-0-sfx`, `P-passive-null-0-upgrade`, `P-passive-upgrade-1-bus-test-threshold`, `P-passive-upgrade-1-sfx` |
| `testHeroReworkGoldens` | 9/11 | **2** | `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected` |
| `testFrostV1Gates` | 162/166 | **4** | `F00.4-revision-lineage`, `F12.22-frost-battle-scale`, `F12.26-full-lifecycle-Gold-parity`, `F14.3-real-speed-history-seam-continuity` |
| `testCrystalaGameplayGates` | 72/73 | **1** | `G07-anti-tunnelling-is-shared-geometry-not-robot-hunter-rewrites` |
| `testHeroReworkHunterOwnerFixGates` | 10/11 | **1** | `runtime-cache-bust` |

Do **not** weaken unrelated gates to turn these green, and do **not** add any
new red beyond these 18.

---

## 6. Explicit Stale-Document Warnings

A zero-context agent reading the `docs/hero-rework/mirror-v1/` folder MUST treat
the following earlier passages as **historical / superseded**:

1. **`11_CAMPAIGN_STATUS_AND_HANDOFF.md` is historical:**
   Its checkpoint table stops at D2 (`r17`) and lists `D3 in progress`, `D4 not started`, and `E not started`. Git history and Section 3 above are authoritative: **D3 is CLOSED (`2a6a2df`), D4 is COMPLETE (`a10aa5a`), and E is CLOSED (`37b2ca9`, `r19`)**.
2. **Early sections of `10_ACTIVE_BASELINE_ADDENDUM.md` (§1, §9, and the D3 partial header):**
   Sections 1 and 9 still reflect the `r11` Checkpoint A/B transplant state, and the D3 section header inside `10_` was written at `469df9b` (D3 partial) before `2a6a2df` (D3 closed) and `a10aa5a` (D4 complete). Do not propagate `r11` or "D3 not closed" from those historical sections.
3. **`02_IMPLEMENTATION_TEST_MATRIX.md` nominal timing vs. executable fixed-step crossing:**
   * A2's authored threshold in Gold is `u >= 0.25` (nominal `0.25 s` at `A2TS = 1.0`), but repeated `STEP = 1/120` float addition crosses `0.25` on **step 31 (`~0.25833 s`)**.
   * A1's authored OWN threshold is `u >= 0.58` (nominal `0.928 s` at `A1TS = 1.6`), which crosses on **step 112 (`~0.93333 s`)**.
   * Raw `after(0.25)` or `after(0.928)` timers are **forbidden**.
4. **`02_IMPLEMENTATION_TEST_MATRIX.md` P15/P18 fourth-node / oldest-ACTIVE retirement prose is SUPERSEDED:**
   * Canonical Gold has **16 shard slots per owner (`SH = 16`)** and **5 shards per formed node**, with shards held for the node's entire life including fold-out (`st === 3` until `t3 >= 0.55`).
   * Three concurrent nodes hold **15 of 16** shards, leaving **1 free shard** — never the 5 required by `tryForm`.
   * Therefore **max concurrent nodes per owner is 3**, a fourth concurrent node is **unproducible** through the shard economy, and Gold's `live.length >= 3` retirement branch is unreachable dead headroom (locked by gate `CR15b`).
   * Do **NOT** implement a 4-slot ring or live oldest-ACTIVE retirement mechanic in F1.

---

## 7. Current `mirrorGoldV1.js` Shipping Status & D3 Visual Note

1. **Unregistered until Checkpoint G:**
   `public/game/hero-rework/mirrorGoldV1.js` (generated by `tools/bridgeMirrorGoldV1.mjs`, currently `1.3.0-d4-shard-node-routing-visuals`) remains **intentionally UNREGISTERED** in `src/game/runtimeManifest.js` and unreferenced by shipping runtime loaders. **Checkpoint G** owns manifest registration, runtime revision bump/relock for registration, and `Fighter.prototype.draw` wrapper integration.
2. **D3 real-weapon peel visual note for G/H:**
   In D3 (`2a6a2df`), real Arsenal weapon imagery (`SNIPER`, `BATTLE_AXE`, `PISTOL`) flows through Gold's A1 reflection and 6-slice peel choreography via `__weaponArt()` normalised to Gold's weapon bounds, and all three weapons are proven distinct in `testMirrorGoldD3Choreography`. However, the fitted production weapon currently reads subtler than the canonical C-R `a1-peel` reference frame. Inspect and tune this **ONLY** during **Checkpoint G / H** bridge and visual-parity work — never by casually modifying Gold choreography.

---

## 8. Next Roadmap (Phase 2: Checkpoints F1 → J)

Proceed in strict order, pushing a clean, gate-verified checkpoint at each step:

1. **Checkpoint F1 — Passive shard / formation gameplay:**
   Replace the legacy shard/portal passive scaffold with Gold-first per-owner shard spawning (`SH = 16`), `> 0.7 s` free-shard age gate, `0.3 s` scan cadence, 5-shard assembly (`1.2000 s` formation to ACTIVE), oriented thin mirror surface (`NV` `v0(-5,-60) → v3(0,62)`), and the **3-node concurrency cap enforced naturally by the 16/5 shard economy** (fourth node unproducible).
2. **Checkpoint F2 — Routing / escrow gameplay:**
   Implement Gold-first surface intersection on `HR.geom.pathSegments(p)`, global TOI ordering (`supersedeMagnetBoundary` + `clearPath`), single-node `0.40 s` no-escrow cooldown, multi-node escrow (`st 1→2` at `0.20 s`, emergence at `0.5667 s` at `node.{x,y} + dir * 20`, neutral owner `own = 2`, `0.45 s` post-exit recapture lock, fallback to entry node `nA` if destination node is lost).
3. **Checkpoint F3 — Cross-system lifecycle matrix:**
   Verify Mirror routing/nodes/A1/A2 across Crystala constructs, Frost, Magnet A1/A2 continuous field, Robot, Slime, Hunter pounce contact, T6 immunities, and round teardown.
4. **Checkpoint G — Shipping presentation bridge:**
   Register `mirrorGoldV1.js` in `src/game/runtimeManifest.js`, wire gameplay state/events (`MirrorA1Cast`, `MirrorA1Own`, `MirrorExchange` with `shiftHist` rebase, shard/node/routing pools) to per-fighter `createMirrorInstance()`, integrate into the `Fighter.prototype.draw` chain without breaking Magnet/Crystala/Frost post-world interop, and bump/relock runtime revision.
5. **Checkpoint H — Real-browser visual parity:**
   Execute the full real-browser visual parity matrix against the C-R canonical oracle frames and judge/tune the D3 real-weapon peel readability.
6. **Checkpoint I — Broad regression + final relock:**
   Run the full protected regression matrix and relock runtime revision and manifests.
7. **Checkpoint J — Hostile final audit:**
   Perform final code/doc/evidence audit and dead-helper cleanup if applicable.

> **REMINDER:** **AUTOMATED VISUAL EVIDENCE IS NOT OWNER VISUAL ACCEPTANCE.**
