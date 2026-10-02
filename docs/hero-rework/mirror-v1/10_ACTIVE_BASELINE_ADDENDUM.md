# MIRROR V1 — ACTIVE BASELINE ADDENDUM

Required by `09_TRANSPLANT_AND_ACTIVATION_CHECKLIST.md` section C. This file
records the **actual** parent the Mirror implementation is being built on. It
supersedes baseline-sensitive orientation facts in the preload; it does **not**
alter canonical Gold or the Gold-first mechanic lock.

## 1. Transplant identity

| Item | Value |
|---|---|
| Implementation branch | `arena/01a0f862-apex-chaos` |
| Campaign start SHA | `3f6479683418e7b71518274f9a6121a6893badbc` |
| **CHECKPOINT_A_SHA** (actual implementation parent) | **`3d450cf2d52a1c6808c4c1ee36edc84954f3d821`** |
| Preload commit cherry-picked | `618c86780ceadb2f53d6f9b49e29cceca7ddcc80` → `5bfd519` here |
| Preload commit touched | `docs/hero-rework/mirror-v1/MIRROR_V1_PRELOAD_PACKAGE.zip` only (checklist E satisfied) |
| Current runtime revision | `20261002-mirror-v1-r11` (38 versioned runtimes, gate PASS) |

### Historical SHAs inside the preload are NOT the baseline

`README_PRELOAD.md`, `04_PRELOAD_MANIFEST.json` and `03_ZERO_CONTEXT_HANDOFF.md`
reference `df3f9fbaaadef80c5c276c47dd96fc8d55857173` and
`arena/01a0f736-apex-chaos`. Those are **audit-snapshot metadata**. The live
parent is CHECKPOINT_A_SHA above. Test-matrix item **G03** is satisfied by that
SHA, not by the preload snapshot.

## 2. Canonical Gold — unchanged, re-verified on this parent

```
docs/hero-rework/mirror-v1/gold/MIRROR_GOLD_FUSION_12.html
sha256  c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205
bytes   107480
lines   1403
```

Matches the preload manifest exactly (G00/G01/G02). **`08_GOLD_FIRST_MECHANIC_LOCK.md`
and the canonical Gold remain unchanged and fully authoritative.** Nothing in
this addendum relaxes Gold-first authority; the baseline advancing is not a
reason to reinterpret Gold.

## 3. Ordered projectile path API (chosen in Checkpoint A)

The preload assumed a single-chord projectile path. That is no longer true:
Magnet A2 produces a real cornered path within one frame. Checkpoint A
established **one** shared representation, which Mirror routing **must** consume
(this is the foundation referenced by R10/R18/R22/R23 and X01/X02).

Exported on `HR.geom`:

| Export | Contract |
|---|---|
| `pathSegments(p)` | ordered sub-segments `{x0,y0,x1,y1,t0,t1}`, travel order, **global** frame fractions. No corner ⇒ exactly one segment `p.px,p.py → p.x,p.y` with `t0=0,t1=1`, strictly equivalent to the old chord. |
| `pathPointAt(p,t)` | point on the real path at a global frame fraction |
| `pathToPointDist(p,cx,cy)` | shortest distance from a point to the real path |
| `globalT(seg,u)` | map a sub-segment-local `u` onto the global frame fraction |
| `clearPath(p)` | **terminate** path metadata — MUST be called by anything that relocates a projectile mid-frame (Mirror capture/escrow/emergence) |
| `pendingMagnetToi(p)` | the Magnet A2 boundary TOI pending this frame, or null |
| `supersedeMagnetBoundary(p,t)` | if `t` is earlier than the pending Magnet boundary, roll the Magnet entry episode back via `MAG.revokeEntry(p)` and clear the path |

**Binding rules for Mirror (Checkpoint F):**
- a node surface may capture only if intersected by a **real travelled segment**;
- capture must report a **global** frame TOI and call `supersedeMagnetBoundary`
  so a Mirror capture earlier than a Magnet boundary prevents the Magnet
  capture beat from being presented;
- on capture/escrow/emergence call `clearPath(p)` and reset `p.px/p.py` to the
  emergence point, so no phantom body/Crystal contact is tested across the
  teleport gap (R18).

## 4. Effective shipping renderer / wrapper chain (authority §4 gate)

Audited on this parent. `Fighter.prototype.draw` is wrapped, in load order:

1. `public/game/core/apexCanonicalBalance.js:1490` — base engine draw.
2. `arsenalChamberPaletteRuntime.installWrappers()` — chamber recolour /
   `actorRender` separation. (Its decorative fighter-underlay ellipse + rim
   ring were removed earlier in this branch; do not reintroduce.)
3. `hunterPresentationRuntime.js:93` — HUNTER actor + `postWorld(c)`.
4. `magnetPresentationRuntime.installDraw()` — **currently the outermost
   wrapper**. For non-Magnet it delegates once via `previous.call(this, ctx)`;
   for Magnet it draws `GOLD.drawBefore → drawActor → drawStatus → drawAfter`
   and then `renderPostWorldInterop(ctx, this)`, which preserves
   Crystala `renderWorldConstructsAndFx` + `runBloomPass` and
   Frost `renderPostWorld`.

Load order in `src/game/runtimeManifest.js` (deferred `arsenalQuest` list):
`crystalaGoldV6 → crystalGameplayRuntime → frostGameplayRuntime →
magnetGameplayRuntime → magnetGoldV1 → heroMechanicsRuntime →
heroReworkRuntime → robotPresentationRuntime → hunterGoldV10 →
hunterPresentationRuntime → crystalaPresentationRuntime → frostGoldV1 →
frostPresentationRuntime → magnetPresentationRuntime`.

**Consequence for Checkpoint G:** Mirror must NOT blindly add a fifth
`Fighter.prototype.draw` wrapper. If a wrapper is used it must be installed so
that the Magnet post-world interop chain still runs exactly once, non-Mirror
delegates exactly once, and P1 / P2 / Mirror-vs-Mirror each render exactly one
actor. Prove call order in a real browser (E05).

## 5. Magnet A2 fighter-push proof (Checkpoint A, owner defect)

The preload orientation did not know about this defect. It is fixed on this
parent and is a **protected regression** for Mirror work.

Donor law (`MAGNET_FINAL_DONOR_MAX.html` L815-817) is a radial-velocity target,
not an acceleration: `fall = clamp(1-d/225,0,1)`, `push = 1050*fall*f2`,
approached at `k = min(1, dt*10)`.

Real-browser evidence at legal spacing (75+75 collision radii forbid d<150):

| d | peak radial displacement | max external velocity | donor target | track |
|---|---|---|---|---|
| 150 | +119.4 px | 236.2 px/s | 350.0 | 0.675 |
| 170 | +90.1 px | 174.3 px/s | 256.7 | 0.679 |
| 200 | +41.6 px | 79.9 px/s | 116.7 | 0.685 |

Gates: `tools/probeMagnetA2FighterPush.mjs` (9/9) and real-browser
`a2-pushes-enemy-fighter-at-legal-spacing`.

## 6. Protected systems on this parent — do not retune for Mirror

- Magnet A2 bullet law: R=225 TOI, 0.07 s magnetic catch, immediate radial
  safety, outward ramp, tangential preservation, capture VFX, same-projectile
  identity.
- Magnet A1, wall visual rebound, fighter-underlay-circle removal, ordinary
  Magnet locomotion, floor-deformation architecture.
- Magnet A2 body push (section 5).
- The ordered projectile path contract (section 3).

## 7. Known baseline failures at CHECKPOINT_A_SHA

Reproduced at the baseline tree, **not** attributable to Mirror:

| Suite | Failure | Note |
|---|---|---|
| `testCrystalaGameplayGates` | `G07-anti-tunnelling-is-shared-geometry-not-robot-hunter-rewrites` | byte-identical at baseline incl. the same `changedProtectedFiles` list; its substantive assertions (`robotBlockIdentical`, `hunterBlockIdentical`, `sharedGeom`, `grant12000`) all pass |
| `testHeroReworkGoldens` | `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected` | pre-existing |
| `testHeroReworkRobotPresentationGates` | `P-A1-lock-dash-single-dispatch-bus`, `P-A1-dash-1-sfx`, `P-A2-auto-hits-per-hit`, `P-passive-*` | pre-existing |
| `testFrostV1Gates` | `F00.4-revision-lineage`, `F12.22-frost-battle-scale`, `F12.26-full-lifecycle-Gold-parity`, `F14.3-real-speed-history-seam-continuity` | pre-existing |
| `testHeroReworkHunterOwnerFixGates` | `runtime-cache-bust` | pre-existing |

Note `F00.4-revision-lineage` and Hunter `runtime-cache-bust` are revision-lineage
assertions and may react to the r9→r11 bumps; they were already failing at the
campaign start SHA.

## 8. Test-harness facts for this parent

- `@sparticuz/chromium` ≥ 121 no longer exports `inflate()`; harnesses tolerate
  both APIs.
- Headless swiftshader rasterises the 1280×1100 canvas ~7× slower than the
  plain software path; browser suites pass `--disable-gpu` plus rAF
  anti-throttling flags. Never measure projectile behaviour by rAF sampling —
  instrument the authoritative seam.
- Crystala's hero id is `CRYSTAL` (not `CRYSTALA`); its solid constructs come
  from **A1** (`crystal.context_construct`).

## 9. Status

Checkpoints A and B complete and durable. Checkpoints C–J (canonical Gold
harness, Gold engine port, A1/A2 gameplay, Shattered Mirrors, presentation
bridge, parity matrix, broad relock, hostile audit) are **not** implemented at
the time this addendum was written.

Automated evidence in this package is **not** owner visual acceptance.

---

## CHECKPOINT C-R — CANONICAL GOLD VISUAL + LIFECYCLE ORACLE

Harness: `tools/testMirrorGoldVisualOracle.mjs` — **14/14**.
Evidence: `docs/hero-rework/mirror-v1/evidence/gold12-visual-oracle.json`
Reference frames: `docs/hero-rework/mirror-v1/evidence/gold-frames/*.png` (19 frames).

Checkpoint C locked Gold's *semantics*. C-R adds the **direct visual reference
frames** production must be compared against at Checkpoint H, plus the lifecycle
facts C covered only by prose. The canonical file is never modified; determinism
is imposed externally (seeded `Math.random` via `evaluateOnNewDocument`, `rAF`
neutralised, Gold's own `step()` driven explicitly). **Every scenario re-seeds and
calls `resetAll()` first**, so adding or reordering a capture cannot shift any
other scenario's random sequence.

Frames are read from the canvas **backing store** (`toDataURL`), not element
screenshots. Element screenshots go through the compositor, which does not update
deterministically once `rAF` is neutralised — it returned the identical stale
layer for all 19 scenarios. The backing store is exactly what Gold's `render()`
drew, which is what a reference oracle must record.

### Directly measured routing lifecycle (not inferred)

| Fact | Canonical value | Gate |
|---|---|---|
| Capture-attempt cooldown, single node | `0.40` s, **no escrow**, object stays in world | CR10 |
| Entry-surface preview distance | `d < 34` (image), `d < 17` (capture) | source L739-741 |
| Destination image | `t = 0.2083` s (st 1→2 at `.20`, `imgB` gate `.14`) | CR11 |
| Emergence | `t = 0.5667` s (authored `.56`) | CR12 |
| Emergence position | `node.{x,y} + dir * 20`, exact to 1e-6 | CR13 |
| Owner after emergence | `own = 2` (**NEUTRAL**) | CR14 |
| Post-exit recapture lock | `cool = 0.45` s | CR14 |
| Destination lost | falls back to **entry node** `nA` (`const e=(n&&n.on)?n:p.nA`) | source L746 |
| A1 presentation envelope | `M.busy = 2.2` at cast | CR16 |
| A2 presentation envelope | `M.busy = 1.8` at cast | CR16 |
| LR wrong reflection | `extraDelay = 0.04`, plus `+0.45` in the sampling delay | CR17 |

Sampling delay law (L559): `delay = p.dl + p.extraDelay + (wrong ? .45 : 0)`.
For LR: `0.17 + 0.04 + 0.45 = 0.66` s.

### CORRECTION — node concurrency is 3, bounded by the shard economy

Prior prose (`07_PRELOAD_HOSTILE_AUDIT.md:94,112`, `08_GOLD_FIRST_MECHANIC_LOCK.md:104-105,111`,
`02_IMPLEMENTATION_TEST_MATRIX.md:93` P18) states Gold has **4 node lifecycle slots**
with an oldest-ACTIVE retirement branch, and that the 16-shard pool is *not* imported.
Measured against the executable, that combination describes behavior canonical Gold
**cannot produce**:

- `ND` pool is 4 entries, but **max occupancy observed is 3** (`maxPoolSlotsOccupied: 3`).
- `SH` pool is **16 shards** (L762); formation consumes **5**; a node owns its shards
  for its entire life — a `st===3` fold-out node still holds them until `n.on=false`
  at `t3 >= .55` (L841).
- Three forming-or-active nodes therefore hold **15 of 16** shards, leaving 1 free —
  never the 5 a fourth group needs.
- Instrumenting the real `formNode` call site proves it: free shards `11 → 6 → 1`,
  live-at-call `0 → 1 → 2`. **`formNode` is never reached with `live >= 3`**, so the
  `live.length>=3` oldest-ACTIVE→`st=3` retirement branch at L808-809 is
  **unreachable dead headroom**.

**PORT CONSEQUENCE (binding on D4 / F1 / H-P18):** production must cap concurrent
nodes at **3 through the shard economy** (16-shard pool, 5 per node, shards held for
the node's whole life including fold-out). It must **NOT** implement a 4-slot ring
with active retirement as a live mechanic — dropping the shard pool while keeping
4 slots would produce 4 concurrent nodes and visible ACTIVE-node retirement, neither
of which Gold ever exhibits. Gate CR15b locks the unreachability.

### Timing terminology (binding on E)

A2's authored threshold is `u = .25` (nominal `.25` s), but the canonical fixed-step
crossing is **`.25833` s**; A1 OWN is nominal `.928` s, canonical **`.93333` s**.
The production fixed-step event must land on the **same first canonical fixed-step
crossing** as the oracle. A raw `after(.25)` / `after(.928)` timer is **not** parity.

### Reference frames captured

`neutral-battle-scale`, `neutral-close-up`, `movement-start`, `movement-sustained`,
`hard-reverse`, `sudden-stop`, `a1-attached-reflection`, `a1-peel`,
`a1-reform-own-edge`, `a1-whiff`, `a2-pre-snap`, `a2-snap`, `a2-post-residue`,
`free-shard`, `assembling-node`, `active-node`, `projectile-entry-image`,
`destination-image`, `emergence`.

All 19 frames verified distinct (CR03). Spot-verified visually: `a1-peel` shows the
split L/R face, luminous seam, six-slice peel with a false-face eye per slice and the
captured weapon imaged in the upper-right slice; `destination-image` shows two ACTIVE
nodes carrying the routed object's surface image during escrow.

### Frame reproducibility (required for H to mean anything)

The frames are **byte-reproducible**: two consecutive full runs produce an
identical sha256 over the whole frame set. This was not true initially —
`rAF` was neutralised *after* `page.goto`, so a nondeterministic number of
Gold's own frames (`init()` ends with `requestAnimationFrame(frame)`) had
already run and consumed the seeded stream. `rAF` is now neutralised inside
`evaluateOnNewDocument`, before any page script executes. If a future run
produces different frame hashes with Gold unchanged, the harness determinism
has regressed — fix that before trusting any comparison against these frames.

> These are **automated** reference frames. They are **not** owner visual acceptance.


---

## CHECKPOINT D1 — GOLD STATIC / MATERIAL CORE

Bridge: `tools/bridgeMirrorGoldV1.mjs` (build-time only; never parses authority HTML at runtime).
Module: `public/game/hero-rework/mirrorGoldV1.js` (GENERATED — do not hand edit).
Gate: `tools/testMirrorGoldD1Raster.mjs` — **13/13**.
Evidence: `docs/hero-rework/mirror-v1/evidence/d1-raster-parity.json`.

Follows the established house pattern (`tools/bridgeFrostGoldV1.mjs`,
`tools/bridgeHunterGoldV10.mjs`): hash-verify Gold, extract the engine script,
keep the material/art layer **verbatim**, cut the demo.

**Why a generator and not a hand port.** The product law forbids simplifying Gold
into generic VFX, and hand-porting raster code is precisely how that drift occurs.
The bridge slices on Gold's **own section banners**, never on line numbers, and
refuses to emit if a required symbol was lost or a demo/gameplay symbol leaked.

**Kept verbatim:** UTIL; RASTER BAKER (`P` atlas, `STOPS`, `tone`, `facet`, `poly`,
`rimGlow`, `inkEdge`, `star`, `rrect`, `bake`, `pick`, `dp`, `masked`, `sweepFill`,
`solidFill`, `PTS`, `pinfo`, `drawEye`, `drawSmile`, `plateBody`, `bakePlate`,
`legacyBakeAll`, `foeShape`, `bakeSupport`); ASSET PACK v3 (`A_plane`, `A_line`,
`A_shell`, `A_plate`, `drawEye2`, `drawSmile2`, `bakeArt`, `PLI`); plus `NV`
hoisted as pure geometry.

**Cut:** demo loop/`init`/`resize`/camera, input, AUTO director, foe entity,
gameplay state/springs/history, movement/hit/projectile/passive systems, A1/A2
choreography, world render, diagnostic sheet. Those arrive in D2-D4.

### Raster determinism and the proof of zero drift

The bake path contains **zero** `Math.random`/`rr()` and draws only from Gold's
seeded Lehmer stream `br()` (`bs = 7`, never reseeded), so the atlas is
byte-reproducible **provided bake order is preserved**. `ensureBaked()` is the
single place that order exists (`bakeSupport()` then `bakeArt()`, as Gold's
`init()` does) and it restates `bs = 7` so a re-bake is identical.

Gold's ambient `rr = (a,b) => a + Math.random()*(b-a)` is **deliberately not
shipped**. D1 never needs it, and D2 must supply a *dedicated* presentation RNG
that cannot consume the gameplay/combat stream; the bridge fails if that
`Math.random` hook ever reappears in the emitted module.

**D1-07 proves the port is exact:** the atlas is baked in the canonical Gold page
and in the shipped module, and all **26 assets are BYTE-IDENTICAL** (per-asset
per-mip-level PNG sha256, plus identical `w/h/ox/oy`). Any changed colour stop,
dropped facet, or bake-order perturbation moves a hash and fails the gate.
The bridge is also idempotent: re-running emits an identical file sha256.

Asset inventory (from Gold's own diagnostic sheet): `Lh, Rh, UL, UR, LL, LR,
shard, eshard, ghost, eL, eR, sL, sR` (26 entries total in `P` including
support rasters).

`GOLD_REF` exports Gold's own reference numbers — `ARENA 1000`, `MIRROR_R 34`,
`FOE_R 26`, `SPD 250`, `REF_SPACE 1254`, `NV`, `PLATES` — so the production
adapter **derives** its scale instead of inventing a multiplier.

### Integration status (deliberate)

`mirrorGoldV1.js` is **not yet referenced by the manifest or any loader** —
verified by source grep. It is an inert artifact until **Checkpoint G**, which
owns manifest registration in dependency order. The runtime revision gate
therefore legitimately stays **PASS at r12** with no bump: the file is not yet a
versioned shipping runtime. Checkpoint G must bump and relock when it registers.

The module owns **no gameplay truth, no timers and no clock** (gate D1-02).


---

## CHECKPOINT D2 — TEMPORAL HISTORY + LOCOMOTION

Bridge: `tools/bridgeMirrorGoldV1.mjs` (extended). Module:
`public/game/hero-rework/mirrorGoldV1.js` (GENERATED). Gate:
`tools/testMirrorGoldD1Raster.mjs` — **23/23** (13 D1 + 10 D2).

Regions extracted verbatim from Gold's own banners: `STATE, SPRINGS, HISTORY,
TWEENS`, `FALSE-REFLECTION EXPRESSION ENGINE`, and `MOVEMENT, TURN, STOP, WALL,
BODY COLLISION`. D2 region sha recorded in the module header.

### Per-instance state

Gold declares E/M/F/H/PL/ACC/hist/TW/Q/SW/FX as module-level singletons because
the showcase only ever has one Mirror. Production needs P1 Mirror, P2 Mirror and
Mirror-vs-Mirror, so the whole region is wrapped in `createMirrorInstance()`:
each call gets its own closure, hence its own history ring, springs, plates and
pools. The baked atlas stays module-level because it is static and immutable
(and still byte-identical — D1-07 unchanged at 26/26 assets).

Verified: two instances hold independent roots (400 vs 700) and distinct
`hist` buffers.

### Dedicated presentation RNG (binding D2 requirement)

Gold's ambient `rr` is `Math.random`-backed, and the expression/locomotion beats
call `Math.random()` directly in **11** places (coin flips choosing which false
face reacts, which half twitches, slip sign, `addCrack` jitter). Presentation
must never consume the gameplay/combat stream, so:

* each instance owns a seeded **mulberry32**;
* `rr` is rebound to it inside the factory;
* the bridge asserts exactly 11 `Math.random()` sites and rewrites every one;
* the emitted module contains **zero** `Math.random` in code (D1-03).

Measured: same seed → identical streams; different seed → different stream;
**0** `Math.random` calls observed while exercising history, locomotion, turns
and plate reactions (D2-05, instrumented by replacing `Math.random` and counting).

### Measured behaviour

```
D2-02 history ring HN=64 HS=22, Float32Array length 1408   (exactly Gold)
D2-06 history lags: hs(0)=500 while hs(30*STEP)=100        (samples the past)
D2-07 locomotion start mv=0 -> sustained mv=1 -> stopped vel=0, moved 107.6 px
D2-08 hard turn kicks the new-heading half:  H.L.x.v  90 -> -240
      and stamps escalating plate delays [0.035, 0.055, 0.08, 0.12]
D2-09 role delays all distinct: UL .095 shameless | UR .115 observer
                                 LL .145 stale    | LR .17  wrong
D2-10 wrongPlate() sets extraDelay 0.04            (matches the C-R oracle)
```

`D2-09`/`D2-10` independently reproduce the C-R canonical oracle numbers from
the *ported* code, which is the cross-check that the port did not drift.

### Cuts

Demo-only state removed: `keys`, canvas/context handles, `VW/VH/DPR/baseZoom`.
`simT` is reintroduced as instance state (the expression code reads it).
`stepMirror`'s keyboard fallback is cut — production always supplies `M.drive`,
so no reference to a demo global ships.

### Integration status

Still **not** manifest-registered or loaded (grep-verified, 0 references).
Registration remains Checkpoint G; the revision gate therefore legitimately
stays PASS with no bump.

---

## CHECKPOINT D3 — A1 / A2 AUTHORED CHOREOGRAPHY (partial: timeline ported)

Gate: `tools/testMirrorGoldD1Raster.mjs` — **33/33** (13 D1 + 10 D2 + 10 D3).
Module version `1.2.0-d3-a1-a2-choreography`. D3 region sha in the header.

Regions extracted verbatim from Gold's own banners: `A1 — MIRROR ARSENAL
(NOTICE -> LOCK -> REFLECT -> PEEL -> REFORM -> OWN)` and `A2 — REFLECTION
EXCHANGE (MARK -> SPLIT -> INVERT -> SNAP -> CONTINUE)`, plus the `_t2` scratch
hoisted (the plate world-transform helpers `plW`/`plClip` already live inside
the A1 banner).

### Canonical timing reproduced from the PORT (not from the oracle)

```
A1 OWN edge     t = 0.93333 s   u = 0.5833   (canonical first crossing of u>=.58)
A1 visual end   t = 1.475   s                (canonical)
A1 busy         2.2 s
A2 SNAP         t = 0.25833 s                (canonical first crossing of u>=.25)
A2 busy         1.8 s
```

These are produced by stepping the ported timeline at `STEP = 1/120`, so they
are an independent confirmation that D3 did not drift — **not** a raw
`after(.928)` / `after(.25)` timer.

### The four demo gameplay mutations removed (enumerated, §14 requirement)

| # | removed from Gold | replaced with | why |
|---|---|---|---|
| 1 | `if(!wf){M.copyOn=true;M.copyT=6;M.copyFx=0}` | `…M.copyOn=true;M.copyFx=0;emit('ownEdge',{t,u})` | Gold granted a 6 s demo copy at OWN. Production owns the real equip and the 6 s lifetime (Checkpoint E). The timeline now only **reports** the edge. |
| 2 | `F.wspec=0;` | *(deleted)* | mutated the demo foe actor; production has no such field. |
| 3 | `Math.random()<dt*28` | `__rand()<dt*28` | presentation must never consume the gameplay/combat RNG. |
| 4 | `M.x=fx;M.y=fy;F.x=ox;F.y=oy;` | `if(__applyExchange){…}` | presentation may not relocate real fighters; gameplay owns the ONE atomic swap. |

`shiftHist(fx-ox, fy-oy)` is **deliberately retained** — the contract requires
history be **rebased** across the exchange, never cleared. The bridge fails if
that call disappears.

Proven: `D3-05` the whiff path never reaches the OWN grant (`reachedOwn:false`,
`copyOn:false`); `D3-08` with the production default the snap performs its full
visual consequence and history rebase but leaves both actors where they were;
`D3-09` the same code applies the exchange only when gameplay supplies it.

### A semantic edge bus, not a gameplay authority

Each instance exposes `on('ownEdge'|…)` so the Checkpoint-E gameplay owner can
subscribe. The presentation never decides that gameplay succeeded.

### NOT YET DONE in D3 (carried forward, do not mark D3 closed)

* **Real Arsenal weapon in the A1 reflection/peel.** The ported `sliceState`
  still reads Gold's demo raster `P.wpnMV`. §14's CRITICAL REAL-WEAPON
  REQUIREMENT — a thin adapter sourcing the real weapon silhouette, proven with
  three visibly different Arsenal weapons — is **outstanding**.
* The A1/A2 **draw** functions (`drawA1World`, `drawSite`, `drawHalf`,
  `clipHalf`, `strips`, `drawResidue`) still live in the un-ported RENDERING
  banner; only the authored timeline/state is ported so far.
* Canonical frame comparison for the seven A1/A2 reference frames.

---

## CHECKPOINT E — A1/A2 GAMEPLAY AUTHORITY (**CLOSED — 32/32**)

Suite: `tools/testMirrorA1A2Gameplay.mjs` — **28/32**. E is **not** complete.

### Scaffold removed (no longer reachable)
`mirror.arsenal` no longer calls `grantWeaponCopy()` at cast; `mirror.exchange`
no longer uses `ctx.api.after(telegraph)` nor `RelocationTransaction`. Both
executors were replaced wholesale, not wrapped.

### Proven green
* A1: **no copy at cast**, none before OWN, OWN at the canonical first crossing
  **0.93333 s**, fresh holder, opponent keeps original, cast-time snapshot
  survives opponent swap / drop / death, Mirror death before OWN yields no
  copy, all three whiffs (unarmed / T6 / shield) consume cooldown.
* A2: cooldown 12, **no** generic `after()`/`RelocationTransaction` path,
  exact coordinate exchange, velocity/HP/weapons retained,
  **observer sees no half-swap**, death before snap performs no relocation
  while cooldown stays spent, teardown produces no late callback,
  **Mirror-vs-Mirror simultaneous snap exchanges exactly once**.
* Action-window law both ways: A1/A2 cannot overlap authored windows, and each
  may cast once the *authored* window ends even though the longer presentation
  busy envelope (2.2 s / 1.8 s) is still running.

### Closure (all four previously-failing gates resolved)

`tools/testMirrorA1A2Gameplay.mjs` — **32/32**. No gameplay law was changed to
achieve this; three were fixture defects and one was a measurement artifact.

1. **`E-A1-14/15/16/17`** — fixture defect. An equipped firearm is auto-activated
   by `arsenalWeaponRuntime.updateHolder` whenever a live target exists, so a
   PISTOL was depleted long before 6 s; the earlier attempt to dodge this with
   `BATTLE_AXE`/`SPEAR` was worse (they do not persist in the holder as the
   fixture assumed, and the gate even asserted `'PISTOL'` after arming
   `BATTLE_AXE` — internally inconsistent). The controlled condition is now
   simply to remove the live fire target **after OWN**, which `E-A1-09` already
   proves cannot affect the cast-time snapshot. **No production code is
   special-cased for tests.**
   * `E-A1-14` proves the law exactly: `MirrorA1Own` now carries the match
     `clock` at materialisation, and `until - ownClock === 6` to **1e-9**, while
     `until - castClock` is demonstrably **not** 6.
   * `E-A1-16/17` assert holder **instance identity** — the replacement / later
     same-id pickup must be a *different* holder object with a different
     (absent) Mirror token. Direct probing confirmed holder objects are never
     reused across equips, so the token test is meaningful.
2. **`E-A2-03`** — measurement artifact; the implementation was already correct.
   The executor only *requests* the snap in pre-movement `onTick`; the exchange
   resolves in the post-movement resolver. The gate now steps **one canonical
   Mirror step at a time** (each `T.step` runs preTick → `Fighter.update` →
   postTick) and asserts **0 exchange events after 30 steps**, exactly **one**
   first observed at **step 31**, payload `t = 0.25833` (±1e-4).

### Superseded gates rebased (not deleted, not loosened)

* **`M00.3`** byte-freeze → **`M00.3-mirror-final-authority-semantic-invariant`**.
  The old gate pinned the MIRROR slice byte-for-byte; E is an owner-directed
  rewrite of exactly that slice, so a byte freeze would forbid the authored law.
  It now asserts, on the live slice: **absent** — `grantWeaponCopy`, raw
  `after(cfg.telegraph)`, `new AIL.RelocationTransaction`, raw `.25`/`.928`
  schedulers; **present** — the `mirrorAdvance` fixed-step timeline, the
  OWN-edge gate, `mirrorEnqueueSnap`, the post-movement
  `resolvePendingMirrorSnaps` running inside `hrPostTick`, the action-window
  lock, and token-based (not weaponId-only) expiry. A hash is deliberately
  **not** used so legitimate F/G Mirror work is not frozen.
* **`M10.1`** → **`M10.1-mirror-copy-materialises-at-OWN-fresh-no-passive-inheritance`**.
  Rewritten to the new law and strictly stronger: no copy at cast, none before
  OWN, a fresh copy at OWN, opponent keeps the original, and no Magnet passive
  inheritance (the only thing the old gate checked).

Both replacements are **green**, so these are owner-superseded tests with green
replacements — **not** tolerated new reds. The parent baseline of **18** stands.
