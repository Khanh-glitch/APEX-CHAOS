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
| full | 475.7 | 100 % | — |
| no-ice | 341.0 | 72 % | **−134.7** |
| no-bloom | 406.5 | 85 % | −69.2 |
| no-hud | 452.4 | 95 % | −23.3 |
| no-bg | 4.2 | 1 % | −471.5 |

Ranking: **FROST ice > CRYSTALA bloom > HUD**. Sampling noise is ±20 % run to run
on this software rasteriser, so the ice/bloom order is solid but the individual
milliseconds are not.

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

## 7. What is still open

* FROST ice is the largest single cost (135 ms/frame). Its mip selection uses
  unclamped `devicePixelRatio` (3.5) while every other module clamps at 2, so it
  picks a mip level ~1.75× larger than authored. Not changed in this round: it
  selects source art, and changing it needs a pixel-equivalence test first.
* The peak of the owner's stalls is a compositor cost that a Canvas2D readback
  cannot localise. It needs an on-device trace, which is what the v2 JSON is for.
