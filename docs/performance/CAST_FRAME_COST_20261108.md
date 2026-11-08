# Skill-cast frame cost — measurement report (2026-11-08)

P0 follow-up on the owner's second report: *the cast stutter persists under
PERFORMANCE*. This report separates **what the owner measured**, **what the code
does**, and **what is actually expensive**, each with the tool that produced it.

Branch `arena/008e7af1-apex-chaos`. Sandbox has **no GPU** (SwiftShader), so no
absolute millisecond here is the owner's phone; only ratios and structure transfer.

---

## 1. The owner's trace did not come from the shipped build

| Fact | Evidence |
|---|---|
| Gate `if (window.devicePixelRatio < 3)` added in `3c6fea1` (2026-11-07 21:07 +0700) | `git log -S "window.devicePixelRatio<3"` |
| Shipped build `1aec3e64` (2026-11-08 12:18 UTC) contains that gate | `dist/assets/index-DzqN1W9g.js` ×1 |
| Pre-gate code had the region-capture call **unguarded** | `git show 3c6fea1^:src/game/ownerPlaytestCapture.js` |
| Owner's trace: DPR **3.5** + `captureRegion: browser-region` | supplied PERF JSON |

Before that gate, any DPR ≥ 3 reported `browser-region`; after it, DPR ≥ 3 can
only report a native-element fallback. A trace with DPR 3.5 **and**
`browser-region` is therefore impossible from `1aec3e64` — it is from a cached or
stale build. **This is a measurement-integrity problem, not a renderer problem**,
and the extended PERF JSON (below) now makes it self-evident.

## 2. PERF JSON now proves its own provenance

`src/game/ownerPlaytestCapture.js` → schema `APEX-CHAOS-owner-recording-perf-v2`:

| Field | Source (never the UI) |
|---|---|
| `build` / `buildAtEnd` | `APEX_RUNTIME_REVISION` → `meta[apex-build-sha]` → `window.__APEX_BUILD_SHA` |
| `graphics.start.mode` / `.end.mode` | `APEX_GRAPHICS_MODE_RUNTIME.diagnose().mode` |
| `graphics.start.flags` / `.end.flags` | the four globals the draw path reads: `APEX_GRAPHICS_BLOOM_WIDE`, `APEX_GRAPHICS_FLUID_SOFT_ALPHA`, `APEX_ICE_SHADOW_NODE_BUDGET`, `APEX_ICE_FLOW_MOTION_BUDGET` |
| `graphics.stable` | false when mode/DPR/flags changed mid-trace ⇒ trace is invalid |
| `capture.surfaceStart/End` | `game-canvas` CSS px, backing px, device px, DPR |
| `capture.method` | recorder `captureMethod` / track |
| `skills.marks[]` | every skill activation: `t`, `kind`, `vfxMs`, detail |
| `frames.marks[]` | frame instants |
| `summary.frameTotalMs` | `update()+draw()` per frame, measured in the engine loop |
| `summary.skillVfxMs` | per-skill VFX cost, measured inside the renderer |

Verified parse + build-clean; the flags in a real archive run are
`{bloom:1, fluid:1, shadow:"Inf", flow:"Inf"}` in HIGH and
`{bloom:1, fluid:0, shadow:5, flow:0.55}` in PERFORMANCE (bloom stays 1 in both by
design — see §4).

## 3. Submit time is not cost — the measurement had to change

The product canvas is `1000×1000` backing (`src/App.jsx`), and nothing ever feeds
`devicePixelRatio` into it. Two consequences that invalidate naive numbers:

1. `createBloomSystem({width,height,scale:0.5})` in the product carries **no
   `dpr`**, so the bloom surface is `500×500`, not `1750×1750`. An earlier probe
   of mine assumed `dpr` and produced a 2 572 ms figure that does not exist.
2. `draw()` returning in 10–35 ms says nothing: Canvas2D **queues**. Adding a
   forced `getImageData(0,0,1,1)` after every 8–10 frames moves the same frame
   from ~20 ms to **~450 ms**.

Every number below is flushed unless it says otherwise.

## 4. What a real cast frame actually costs

`tools/probe/evidence/bisectFrame.mjs` — real archive, real BOT battle, real
`pressSkill` casts, one subsystem disabled per arm, **fresh page per arm**, 3
interleaved passes, counters proving each arm was applied
(`no-bloom` blocked 52 composites, `no-ice` blocked 74 ice draws).

| arm | median ms/frame | vs full | saves |
|---|---|---|---|
| full | 510.1 | 100 % | — |
| no-ice | 304.9 | 60 % | **−205.2** |
| no-bloom | 501.4 | 98 % | −8.7 |

Ranking: **FROST ice dominates by an order of magnitude.** Earlier passes gave
−134.7 / −69.2 for the same two arms; repeated interleaved runs converge on the
ice being 40 % of a cast frame while the bloom is ~2 %. The ice order is solid;
individual milliseconds carry ±20 % run-to-run noise on this software rasteriser.

### Why the bloom's own cost is invisible here
Instrumenting `createBloomSystem().composite` inside the live product shows
**0.4 ms/frame over 52 calls** — i.e. it submits and returns; the raster cost is
paid later, in whichever frame the readback lands. That is exactly why the owner
sees frame stalls without Long Tasks.

## 5. The one optimisation this round actually validated

The wide Gold halo was filtered **on the destination** (`ctx.filter =
blur(9*dpr)` while drawing the 2×-upscaled half-res surface). Isolated cost of
that single draw at product region sizes (flushed, 7 reps):

| destination filter only | 9*dpr px blur | legacy half-res | quarter res |
|---|---|---|---|
| 560×560 region | **266 ms** | 89 ms | 34 ms |

Cost tracks **destination area**, not filtered area: the same draw into
`2000×2000` costs 1 052 ms vs 266 ms into `1000×1000`.

The halo is now convolved on the half-res surface and upscaled. Verified
**pixel-equivalent**, not assumed (`bloomAB.mjs`, fresh canvas each side,
interleaved ABBA, both DPR levels):

| region | px | before | after | speedup | maxΔ | >2/255 |
|---|---|---|---|---|---|---|
| body | 176 000 | 292.1 ms | 77.3 ms | 3.78× | 2 | 0 % |
| prison | 313 600 | 313.6 ms | 132.2 ms | 2.37× | 1 | 0 % |
| wall | 810 000 | 410.1 ms | 326.0 ms | 1.26× | 1 | 0 % |

**Rejected by the same test:** quarter-res convolution (maxΔ 31/255 over 45 % of
pixels — a visibly different halo) and dropping the halo (maxΔ 29/255 over
18–25 % of pixels, which is what PERFORMANCE used to do). PERFORMANCE therefore
now keeps the halo at 1/3 of the old HIGH cost instead of deleting it.

Honest limitation: this does **not** move the whole-frame number in §4 by a
measurable amount on this rasteriser, because the bloom is only 69 ms of a 476 ms
frame and the flush lands in a different frame. It is a real CPU-side win on the
compositor and it removes the most expensive single operation of a cast; it is
**not** a fix for the owner's stutter and is not reported as one.

## 6. Build tooling defect found and fixed

`tools/packItchPortable.mjs` checked for `ITCH_GUEST_BUILD_SHA.txt` **after**
`rm -rf`-ing its own output and copying `dist/` over it, so it only passed when
the tree had already been packed twice. It now carries the receipt across the
copy. Without this, no reproducible ZIP could be produced from a clean tree.

## 7. The FROST ice pass: where its 205 ms actually is

`iceSplit.mjs` splits the pass with the marks the shipped renderer already
calls. Per frame, in a live battle:

| stage | ms/frame |
|---|---|
| `ice.render` (all the slab/edge/frost path fills) | **1.1** |
| `iceClear` (dirty-rect clear of the offscreen) | 0.03 |
| `iceBlit` (one alpha-blended `drawImage` onto the arena) | **29.2** |

And the three parts measured in isolation:

| operation | median |
|---|---|
| paint the ice into the offscreen | 0.2 ms |
| clear the offscreen | ~0 ms |
| `drawImage(offscreen → arena)` at alpha 0.97 | 28.6 ms |
| the same ice painted straight onto the arena | **2.2 ms** |

So the ice art is essentially free and **the composite is the whole cost**. The
blend is not area-bound either: a canvas→canvas `drawImage` onto the 1000×1000
`alpha:false` arena costs ~11 ms even at 64×64 and ~23 ms at 1000×1000, while a
`fillRect` of the same size is free. It is a per-call surface transfer, not a
pixel operation.

### What was changed
The blit used to abandon its own optimisation whenever the painted bounds
touched any arena edge, falling back to a full 1000×1000 copy — measured 23 of
25 blits in a live battle. It now copies the painted bounds clamped into the
canvas. Verified **pixel-identical** (maxΔ 0 over the whole canvas) in four
scenarios including the edge and corner cases that used to trigger the
fallback (`iceBlitEquivalence.mjs`), and 15 % cheaper in a controlled A/B
(51.9 → 43.9 ms, 9 alternating repetitions in one process).

### What is still open, with the reason
The remaining ~40 ms is the per-call surface transfer. Collapsing it needs the
ice to be painted directly onto the arena — measured 2.2 ms, a 21× win — but
the ice field's material pass uses `globalCompositeOperation = 'source-atop'`,
which composites against whatever is already in the destination. On the arena
that would clip the ice against the background and change the material's
appearance. Removing the offscreen therefore requires re-expressing that pass
without a destination-dependent blend mode, and it must be proven pixel-equal
first. It is not attempted here: it is the next slice, not a finished fix.

Also unverified on real hardware: the owner's peaks are compositor cost that a
Canvas2D readback cannot localise. The v2 trace is what will make that
visible.
